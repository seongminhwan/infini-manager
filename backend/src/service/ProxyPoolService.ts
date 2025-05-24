/**
 * 代理池管理服务
 * 提供代理池配置、代理验证、代理选择策略等功能
 */
import db from '../db/db';
import axios, { AxiosProxyConfig } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { ApiResponse } from '../types';

export interface ProxyPool {
  id?: number;
  name: string;
  description?: string;
  proxy_mode: 'none' | 'round_robin' | 'random' | 'failover';
  enabled: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProxyServer {
  id?: number;
  pool_id: number;
  name: string;
  proxy_type: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
  enabled: boolean;
  is_healthy: boolean;
  last_check_at?: string;
  response_time?: number;
  success_count: number;
  failure_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface ProxyUsageStats {
  id?: number;
  proxy_id: number;
  date: string;
  request_count: number;
  success_count: number;
  failure_count: number;
  avg_response_time: number;
  created_at?: string;
  updated_at?: string;
}

export interface ParsedProxy {
  proxy_type: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  remark?: string;       // 代理备注信息
  refreshUrl?: string;   // 代理刷新URL
}

export class ProxyPoolService {
  // 代理轮询索引
  private roundRobinIndex: Map<number, number> = new Map();

  /**
   * 解析代理字符串
   * 支持格式：
   * - http://ip:port
   * - https://ip:port
   * - socks5://ip:port
   * - socks4://ip:port
   * - http://username:password@ip:port
   * - ip:port (默认http)
   * 
   * 以下为新增支持的格式：
   * - ip:port{备注}
   * - ip:port:username:password{备注}
   * - socks5://ip:port[刷新URL]{备注}
   * - http://[IPv6]:port[刷新URL]{备注}
   * - socks5://username:password@ip:port[刷新URL]{备注}
   * - username:password@ip:port
   */
  parseProxyString(proxyString: string): ParsedProxy | null {
    try {
      // 清理输入
      let cleaned = proxyString.trim();
      
      // 提取备注（如果有）
      let remark: string | undefined;
      const remarkMatch = cleaned.match(/{([^}]*)}/);
      if (remarkMatch) {
        remark = remarkMatch[1];
        cleaned = cleaned.replace(/{[^}]*}/, ''); // 移除备注部分
      }
      
      // 提取刷新URL（如果有）
      let refreshUrl: string | undefined;
      const refreshMatch = cleaned.match(/\[([^\]]*)\]/);
      if (refreshMatch) {
        refreshUrl = refreshMatch[1];
        cleaned = cleaned.replace(/\[[^\]]*\]/, ''); // 移除刷新URL部分
      }
      
      // 处理特殊格式：ip:port:username:password
      const specialFormatMatch = cleaned.match(/^([^:]+):(\d+):([^:]+):(.+)$/);
      if (specialFormatMatch) {
        return {
          proxy_type: 'http', // 默认为http
          host: specialFormatMatch[1],
          port: parseInt(specialFormatMatch[2]),
          username: specialFormatMatch[3],
          password: specialFormatMatch[4],
          remark,
          refreshUrl
        };
      }
      
      // 处理格式：username:password@ip:port（不含协议前缀）
      const authWithoutProtocolMatch = cleaned.match(/^([^:]+):([^@]+)@([^:]+):(\d+)$/);
      if (authWithoutProtocolMatch && !cleaned.includes('://')) {
        return {
          proxy_type: 'http', // 默认为http
          host: authWithoutProtocolMatch[3],
          port: parseInt(authWithoutProtocolMatch[4]),
          username: authWithoutProtocolMatch[1],
          password: authWithoutProtocolMatch[2],
          remark,
          refreshUrl
        };
      }
      
      // 处理常规格式
      // 如果没有协议前缀，默认为http
      let fullUrl = cleaned;
      if (!cleaned.includes('://')) {
        fullUrl = `http://${cleaned}`;
      }
      
      const url = new URL(fullUrl);
      
      return {
        proxy_type: url.protocol.replace(':', ''),
        host: url.hostname,
        port: parseInt(url.port) || this.getDefaultPort(url.protocol.replace(':', '')),
        username: url.username || undefined,
        password: url.password || undefined,
        remark,
        refreshUrl
      };
    } catch (error) {
      console.error('解析代理字符串失败:', error);
      return null;
    }
  }

  /**
   * 获取协议默认端口
   */
  private getDefaultPort(protocol: string): number {
    switch (protocol) {
      case 'http': return 8080;
      case 'https': return 8443;
      case 'socks4': return 1080;
      case 'socks5': return 1080;
      default: return 8080;
    }
  }

  /**
   * 批量解析代理字符串
   */
  parseProxyBatch(proxyStrings: string[]): ParsedProxy[] {
    return proxyStrings
      .map(str => this.parseProxyString(str))
      .filter((proxy): proxy is ParsedProxy => proxy !== null);
  }

  /**
   * 验证代理有效性
   * 改进后的验证逻辑：
   * 1. 依次尝试多个测试URL，而不是随机选择一个
   * 2. 更准确地区分不同类型的错误
   * 3. 根据HTTP状态码准确判断代理有效性
   */
  async validateProxy(proxy: ProxyServer, timeout: number = 10000): Promise<{
    isValid: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    
    // 测试目标URL（按优先级排序）
    const testUrls = [
      'https://httpbin.org/ip',
      'https://api.ipify.org',
      'https://icanhazip.com',
      'https://www.google.com',
      'https://www.baidu.com'  // 添加百度作为中国区域测试点
    ];
    
    // 构建代理配置
    const proxyConfig = this.buildProxyConfig(proxy);
    
    // 依次尝试每个测试URL
    for (const testUrl of testUrls) {
      try {
        console.log(`[代理验证] 正在验证代理 ${proxy.name} (${proxy.proxy_type}://${proxy.host}:${proxy.port}) 访问 ${testUrl}`);
        
        const response = await axios.get(testUrl, {
          timeout,
          proxy: {
            ...proxyConfig.proxy
          },
          validateStatus: () => true // 允许所有状态码
        });
        
        const responseTime = Date.now() - startTime;
        console.log(`[代理验证] 代理 ${proxy.name} 访问 ${testUrl} 获得响应: HTTP ${response.status} - 耗时: ${responseTime}ms`);
        
        // 根据HTTP状态码判断代理有效性
        if (response.status >= 200 && response.status < 300) {
          // 2xx 状态码表示成功
          console.log(`[代理验证] 代理 ${proxy.name} 验证成功: 返回成功状态码 ${response.status}`);
          return {
            isValid: true,
            responseTime,
            error: undefined
          };
        } else if (response.status >= 400 && response.status < 500) {
          // 4xx 客户端错误，通常表示代理有问题或配置不正确
          // 分析错误原因
          console.log(`[代理验证] 代理 ${proxy.name} 验证失败: 返回客户端错误 ${response.status}`);
          
          // 记录详细错误信息，帮助诊断为什么会返回400
          let responseBody = '';
          try {
            if (response.data) {
              if (typeof response.data === 'object') {
                responseBody = JSON.stringify(response.data);
              } else {
                responseBody = String(response.data);
              }
            }
            
            console.log(`[代理验证] 400错误诊断 - 响应头:`, response.headers);
            console.log(`[代理验证] 400错误诊断 - 响应体: ${responseBody}`);
            
            // 分析可能的错误原因
            let errorReason = '未知原因';
            if (responseBody.includes('Proxy Authentication Required')) {
              errorReason = '代理需要认证';
            } else if (responseBody.includes('Bad Request')) {
              errorReason = '请求格式不正确';
            } else if (responseBody.includes('blocked') || responseBody.includes('forbidden')) {
              errorReason = '代理IP被目标网站封锁';
            }
            
            console.log(`[代理验证] 400错误诊断 - 可能原因: ${errorReason}`);
          } catch (diagError) {
            console.error(`[代理验证] 400错误诊断失败:`, diagError);
          }
          
          // 尝试使用不同的请求头再次测试
          try {
            console.log(`[代理验证] 尝试使用不同的User-Agent重新测试代理...`);
            const retryResponse = await axios.get(testUrl, {
              timeout,
              ...proxyConfig,
              validateStatus: () => true,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
              }
            });
            
            if (retryResponse.status >= 200 && retryResponse.status < 300) {
              console.log(`[代理验证] 使用不同的User-Agent成功: 返回成功状态码 ${retryResponse.status}`);
              return {
                isValid: true,
                responseTime,
                error: undefined
              };
            } else {
              console.log(`[代理验证] 使用不同的User-Agent仍然失败: 返回状态码 ${retryResponse.status}`);
            }
          } catch (retryError) {
            console.error(`[代理验证] 使用不同的User-Agent重试失败:`, retryError);
          }
          
          // 只有这一个URL返回了响应，即使是错误响应，也继续尝试其他URL
          if (testUrl !== testUrls[testUrls.length - 1]) {
            continue;
          }
          
          return {
            isValid: false,
            responseTime,
            error: `代理返回客户端错误: HTTP ${response.status} ${response.statusText}`
          };
        } else if (response.status >= 500) {
          // 5xx 服务器错误，可能是目标网站问题，尝试下一个URL
          console.log(`[代理验证] 代理 ${proxy.name} 访问 ${testUrl} 返回服务器错误 ${response.status}，尝试下一个URL`);
          continue;
        } else if (response.status >= 300 && response.status < 400) {
          // 3xx 重定向，可能表示代理工作正常但需要重定向，尝试下一个URL
          console.log(`[代理验证] 代理 ${proxy.name} 访问 ${testUrl} 返回重定向 ${response.status}，尝试下一个URL`);
          continue;
        }
      } catch (error: any) {
        // 记录错误，但继续尝试下一个URL
        console.error(`[代理验证] 代理 ${proxy.name} 访问 ${testUrl} 失败: ${error.message}`);
        
        // 如果是最后一个URL，并且所有URL都失败了，则返回失败结果
        if (testUrl === testUrls[testUrls.length - 1]) {
          const responseTime = Date.now() - startTime;
          
          // 超时或连接拒绝，确实意味着代理无效
          const isTimeoutError = error.message.includes('timeout') || error.code === 'ECONNABORTED';
          const isConnectionError = error.message.includes('ECONNREFUSED') || 
                                   error.message.includes('ECONNRESET') || 
                                   error.message.includes('ENOTFOUND');
          
          if (isTimeoutError) {
            console.log(`[代理验证] 代理 ${proxy.name} 验证超时，响应时间: ${responseTime}ms`);
            return {
              isValid: false,
              responseTime,
              error: `代理连接超时: ${error.message}`
            };
          } else if (isConnectionError) {
            console.log(`[代理验证] 代理 ${proxy.name} 连接错误，响应时间: ${responseTime}ms`);
            return {
              isValid: false,
              responseTime,
              error: `代理连接错误: ${error.message}`
            };
          } else {
            // 其他错误，认为代理无效
            console.log(`[代理验证] 代理 ${proxy.name} 验证过程中发生其他错误，响应时间: ${responseTime}ms`);
            return {
              isValid: false, // 修改：对于未知错误，也认为代理无效
              responseTime,
              error: `代理验证时发生错误: ${error.message}`
            };
          }
        }
      }
    }
    
    // 这行代码理论上不会执行，因为前面的循环会确保返回结果
    // 但为了TypeScript类型安全，我们还是提供一个默认返回值
    return {
      isValid: false,
      responseTime: Date.now() - startTime,
      error: '无法验证代理'
    };
  }

  /**
   * 构建axios代理配置
   * @private 仅供内部使用
   * @param proxy 代理服务器
   * @param targetUrl 目标URL（可选），用于判断协议是否匹配
   */
  private buildProxyConfig(proxy: ProxyServer, targetUrl?: string): any {
    const config: any = {};
    
    // 判断目标URL是否为HTTPS
    const isTargetHttps = targetUrl && targetUrl.startsWith('https://');
    console.log(`[代理配置] 目标URL: ${targetUrl || '未指定'}, 是否HTTPS: ${isTargetHttps}`);
    
    if (proxy.proxy_type === 'http' || proxy.proxy_type === 'https') {
      // 构建基本代理配置
      const proxyConfig: AxiosProxyConfig = {
        protocol: proxy.proxy_type,
        host: proxy.host,
        port: proxy.port
      };
      
      // 设置认证信息
      if (proxy.username && proxy.password) {
        console.log(`[代理配置] 使用认证信息: ${proxy.username}:${proxy.password}`);
        proxyConfig.auth = {
          username: proxy.username,
          password: proxy.password
        };
      }
      
      // 如果代理是HTTP类型但目标是HTTPS，单独处理
      if (proxy.proxy_type === 'http' && isTargetHttps) {
        console.log(`[代理配置] 检测到HTTP代理访问HTTPS网站，采用特殊处理`);
        
        // 构建代理URL字符串
        let proxyUrl;
        if (proxy.username && proxy.password) {
          // 使用完整认证字符串，不分解或编码
          proxyUrl = `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
          console.log(`[代理配置] 使用完整认证字符串: ${proxyUrl}`);
        } else {
          proxyUrl = `http://${proxy.host}:${proxy.port}`;
        }
        
        console.log(`[代理配置] HTTP代理访问HTTPS站点，模拟curl行为`);
        
        // 关键修改：不同时使用proxy和httpsAgent配置，只使用httpsAgent
        // 这避免了axios内部处理的冲突
        const httpsAgent = new HttpsProxyAgent(proxyUrl);
        config.httpsAgent = httpsAgent;
        
        // 为了调试，输出完整的代理配置
        console.log(`[代理配置] 使用HttpsProxyAgent创建隧道，完整URL: ${proxyUrl}`);
        
        // 模拟curl的行为，添加一些必要的头部
        if (!config.headers) {
          config.headers = {};
        }
        
        // 确保有正确的Accept和Connection头部
        if (!config.headers['Accept']) {
          config.headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
        }
        
        if (!config.headers['Connection']) {
          config.headers['Connection'] = 'close';
        }
        
        // 这些设置帮助确保axios使用CONNECT方法建立隧道
        config.maxRedirects = 5;
        config.maxBodyLength = Infinity;
        config.decompress = true;
        
        console.log(`[代理配置] HTTP代理访问HTTPS站点配置完成，使用隧道模式`);
      } else {
        // 普通情况，直接使用代理配置
        config.proxy = proxyConfig;
      }
    } else if (proxy.proxy_type === 'socks4' || proxy.proxy_type === 'socks5') {
      // SOCKS代理
      let proxyUrl = `${proxy.proxy_type}://${proxy.host}:${proxy.port}`;
      if (proxy.username && proxy.password) {
        proxyUrl = `${proxy.proxy_type}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
      }
      
      const agent = new SocksProxyAgent(proxyUrl);
      config.httpAgent = agent;
      config.httpsAgent = agent;
    }
    
    return config;
  }

  /**
   * 为HTTP请求配置代理
   * 公开接口，供httpClient等使用
   * @param proxy 代理服务器
   * @param requestConfig axios请求配置（可选）
   * @returns 配置了代理的请求配置
   */
  configureRequestProxy(proxy: ProxyServer, requestConfig: any = {}): any {
    // 获取目标URL
    const targetUrl = requestConfig.url || '';
    const proxyConfig = this.buildProxyConfig(proxy, targetUrl);
    return { ...requestConfig, ...proxyConfig };
  }

  /**
   * 根据策略选择代理
   */
  async selectProxy(poolId: number): Promise<ProxyServer | null> {
    // 获取代理池配置
    const pool = await db('proxy_pools').where({ id: poolId, enabled: true }).first();
    if (!pool) {
      return null;
    }
    
    // 获取健康的代理服务器
    const proxies = await db('proxy_servers')
      .where({ 
        pool_id: poolId, 
        enabled: true, 
        is_healthy: true 
      })
      .orderBy('id');
    
    if (proxies.length === 0) {
      return null;
    }
    
    switch (pool.proxy_mode) {
      case 'none':
        return null;
        
      case 'round_robin':
        return this.selectRoundRobin(poolId, proxies);
        
      case 'random':
        return this.selectRandom(proxies);
        
      case 'failover':
        return this.selectFailover(proxies);
        
      default:
        return null;
    }
  }

  /**
   * 轮询选择代理
   */
  private selectRoundRobin(poolId: number, proxies: ProxyServer[]): ProxyServer {
    const currentIndex = this.roundRobinIndex.get(poolId) || 0;
    const nextIndex = (currentIndex + 1) % proxies.length;
    this.roundRobinIndex.set(poolId, nextIndex);
    return proxies[currentIndex];
  }

  /**
   * 随机选择代理
   */
  private selectRandom(proxies: ProxyServer[]): ProxyServer {
    const randomIndex = Math.floor(Math.random() * proxies.length);
    return proxies[randomIndex];
  }

  /**
   * 故障转移选择代理（选择成功率最高的）
   */
  private selectFailover(proxies: ProxyServer[]): ProxyServer {
    return proxies.reduce((best, current) => {
      const bestSuccessRate = best.success_count / (best.success_count + best.failure_count) || 0;
      const currentSuccessRate = current.success_count / (current.success_count + current.failure_count) || 0;
      return currentSuccessRate > bestSuccessRate ? current : best;
    });
  }

  /**
   * 记录代理使用统计
   */
  async recordProxyUsage(proxyId: number, success: boolean, responseTime: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      // 更新代理服务器统计
      if (success) {
        await db('proxy_servers')
          .where({ id: proxyId })
          .increment('success_count', 1);
      } else {
        await db('proxy_servers')
          .where({ id: proxyId })
          .increment('failure_count', 1);
      }
      
      // 更新代理使用统计
      await db.raw(`
        INSERT INTO proxy_usage_stats (proxy_id, date, request_count, success_count, failure_count, avg_response_time)
        VALUES (?, ?, 1, ?, ?, ?)
        ON CONFLICT(proxy_id, date) DO UPDATE SET
          request_count = request_count + 1,
          success_count = success_count + ?,
          failure_count = failure_count + ?,
          avg_response_time = (avg_response_time * (request_count - 1) + ?) / request_count,
          updated_at = CURRENT_TIMESTAMP
      `, [
        proxyId, today,
        success ? 1 : 0,
        success ? 0 : 1,
        responseTime,
        success ? 1 : 0,
        success ? 0 : 1,
        responseTime
      ]);
      
    } catch (error) {
      console.error('记录代理使用统计失败:', error);
    }
  }

  /**
   * 健康检查所有代理
   */
  async healthCheckAll(): Promise<void> {
    const proxies = await db('proxy_servers').where({ enabled: true });
    
    for (const proxy of proxies) {
      const result = await this.validateProxy(proxy, 5000);
      
      await db('proxy_servers')
        .where({ id: proxy.id })
        .update({
          is_healthy: result.isValid,
          response_time: result.responseTime,
          last_check_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    }
  }

  // ==================== CRUD 操作 ====================

  /**
   * 获取所有代理池
   */
  async getProxyPools(): Promise<ApiResponse> {
    try {
      const pools = await db('proxy_pools').orderBy('created_at', 'desc');
      
      // 获取每个池的代理数量
      for (const pool of pools) {
        const stats = await db('proxy_servers')
          .where({ pool_id: pool.id })
          .select(
            db.raw('COUNT(*) as total'),
            db.raw('COUNT(CASE WHEN enabled = 1 THEN 1 END) as enabled'),
            db.raw('COUNT(CASE WHEN is_healthy = 1 THEN 1 END) as healthy')
          )
          .first();
        
        pool.proxy_stats = stats;
      }
      
      return {
        success: true,
        data: pools
      };
    } catch (error) {
      console.error('获取代理池列表失败:', error);
      return {
        success: false,
        message: `获取代理池列表失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 创建代理池
   */
  async createProxyPool(poolData: Omit<ProxyPool, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse> {
    try {
      const [id] = await db('proxy_pools').insert({
        ...poolData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      const pool = await db('proxy_pools').where({ id }).first();
      
      return {
        success: true,
        message: '代理池创建成功',
        data: pool
      };
    } catch (error) {
      console.error('创建代理池失败:', error);
      return {
        success: false,
        message: `创建代理池失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取代理池中的代理服务器
   */
  async getProxyServers(poolId: number): Promise<ApiResponse> {
    try {
      const servers = await db('proxy_servers')
        .where({ pool_id: poolId })
        .orderBy('created_at', 'desc');
      
      return {
        success: true,
        data: servers
      };
    } catch (error) {
      console.error('获取代理服务器列表失败:', error);
      return {
        success: false,
        message: `获取代理服务器列表失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 添加代理服务器
   */
  async addProxyServer(serverData: Omit<ProxyServer, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse> {
    try {
      const [id] = await db('proxy_servers').insert({
        ...serverData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      const server = await db('proxy_servers').where({ id }).first();
      
      return {
        success: true,
        message: '代理服务器添加成功',
        data: server
      };
    } catch (error) {
      console.error('添加代理服务器失败:', error);
      return {
        success: false,
        message: `添加代理服务器失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 批量添加代理服务器
   */
  async addProxyServersBatch(poolId: number, proxyStrings: string[]): Promise<ApiResponse> {
    try {
      const parsedProxies = this.parseProxyBatch(proxyStrings);
      
      if (parsedProxies.length === 0) {
        return {
          success: false,
          message: '没有有效的代理地址'
        };
      }
      
      const servers = parsedProxies.map((proxy, index) => ({
        pool_id: poolId,
        name: `代理${Date.now()}-${index + 1}`,
        proxy_type: proxy.proxy_type,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username,
        password: proxy.password,
        enabled: true,
        is_healthy: true,
        success_count: 0,
        failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      await db('proxy_servers').insert(servers);
      
      return {
        success: true,
        message: `成功添加 ${servers.length} 个代理服务器`,
        data: { added: servers.length, total: proxyStrings.length }
      };
    } catch (error) {
      console.error('批量添加代理服务器失败:', error);
      return {
        success: false,
        message: `批量添加代理服务器失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 更新代理池配置
   */
  async updateProxyPool(id: number, poolData: Partial<Omit<ProxyPool, 'id' | 'created_at' | 'updated_at'>>): Promise<ApiResponse> {
    try {
      const pool = await db('proxy_pools').where({ id }).first();
      if (!pool) {
        return {
          success: false,
          message: '代理池不存在'
        };
      }
      
      await db('proxy_pools')
        .where({ id })
        .update({
          ...poolData,
          updated_at: new Date().toISOString()
        });
      
      const updatedPool = await db('proxy_pools').where({ id }).first();
      
      return {
        success: true,
        message: '代理池更新成功',
        data: updatedPool
      };
    } catch (error) {
      console.error('更新代理池失败:', error);
      return {
        success: false,
        message: `更新代理池失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 删除代理池
   */
  async deleteProxyPool(id: number): Promise<ApiResponse> {
    try {
      // 检查是否存在
      const pool = await db('proxy_pools').where({ id }).first();
      if (!pool) {
        return {
          success: false,
          message: '代理池不存在'
        };
      }
      
      // 删除代理池（关联的代理服务器会通过外键级联删除）
      const deleted = await db('proxy_pools').where({ id }).del();
      
      if (deleted === 0) {
        return {
          success: false,
          message: '代理池删除失败'
        };
      }
      
      return {
        success: true,
        message: '代理池删除成功'
      };
    } catch (error) {
      console.error('删除代理池失败:', error);
      return {
        success: false,
        message: `删除代理池失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取单个代理服务器
   */
  async getProxyServer(id: number): Promise<ApiResponse> {
    try {
      const server = await db('proxy_servers').where({ id }).first();
      
      if (!server) {
        return {
          success: false,
          message: '代理服务器不存在'
        };
      }
      
      return {
        success: true,
        data: server
      };
    } catch (error) {
      console.error('获取代理服务器失败:', error);
      return {
        success: false,
        message: `获取代理服务器失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 更新代理服务器
   */
  async updateProxyServer(id: number, serverData: Partial<Omit<ProxyServer, 'id' | 'created_at' | 'updated_at'>>): Promise<ApiResponse> {
    try {
      const server = await db('proxy_servers').where({ id }).first();
      if (!server) {
        return {
          success: false,
          message: '代理服务器不存在'
        };
      }
      
      await db('proxy_servers')
        .where({ id })
        .update({
          ...serverData,
          updated_at: new Date().toISOString()
        });
      
      const updatedServer = await db('proxy_servers').where({ id }).first();
      
      return {
        success: true,
        message: '代理服务器更新成功',
        data: updatedServer
      };
    } catch (error) {
      console.error('更新代理服务器失败:', error);
      return {
        success: false,
        message: `更新代理服务器失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 获取代理使用统计数据
   */
  async getProxyUsageStats(proxyId: number, dateRange?: { startDate: string, endDate: string }): Promise<ApiResponse> {
    try {
      let query = db('proxy_usage_stats').where({ proxy_id: proxyId });
      
      if (dateRange) {
        query = query.whereBetween('date', [dateRange.startDate, dateRange.endDate]);
      }
      
      const stats = await query.orderBy('date', 'desc');
      
      // 计算总计和平均值
      const summary = stats.reduce((acc, curr) => {
        acc.total_requests += curr.request_count;
        acc.total_success += curr.success_count;
        acc.total_failure += curr.failure_count;
        acc.avg_response_time = (acc.avg_response_time * acc.count + curr.avg_response_time) / (acc.count + 1);
        acc.count += 1;
        return acc;
      }, { total_requests: 0, total_success: 0, total_failure: 0, avg_response_time: 0, count: 0 });
      
      // 计算成功率
      summary.success_rate = summary.total_requests > 0 
        ? (summary.total_success / summary.total_requests * 100).toFixed(2) + '%' 
        : '0%';
      
      return {
        success: true,
        data: {
          stats,
          summary
        }
      };
    } catch (error) {
      console.error('获取代理使用统计数据失败:', error);
      return {
        success: false,
        message: `获取代理使用统计数据失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 刷新代理（使用refreshUrl）
   */
  async refreshProxy(id: number): Promise<ApiResponse> {
    try {
      // 获取代理服务器信息
      const server = await db('proxy_servers').where({ id }).first();
      
      if (!server) {
        return {
          success: false,
          message: '代理服务器不存在'
        };
      }
      
      // 检查是否有刷新URL
      const proxyString = `${server.proxy_type}://${server.username ? `${server.username}:${server.password}@` : ''}${server.host}:${server.port}`;
      const parsedProxy = this.parseProxyString(proxyString);
      
      if (!parsedProxy?.refreshUrl) {
        return {
          success: false,
          message: '该代理没有配置刷新URL'
        };
      }
      
      // 访问刷新URL
      try {
        console.log(`刷新代理 ${server.name}，URL: ${parsedProxy.refreshUrl}`);
        const response = await axios.get(parsedProxy.refreshUrl, { timeout: 10000 });
        
        // 检查响应状态
        if (response.status >= 200 && response.status < 300) {
          // 刷新成功，更新代理信息
          await db('proxy_servers')
            .where({ id })
            .update({
              is_healthy: true,
              last_check_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          return {
            success: true,
            message: '代理刷新成功',
            data: { 
              status: response.status, 
              message: response.statusText,
              responseData: response.data
            }
          };
        } else {
          return {
            success: false,
            message: `代理刷新失败: HTTP ${response.status} ${response.statusText}`
          };
        }
      } catch (error: any) {
        return {
          success: false,
          message: `代理刷新失败: ${error.message || '未知错误'}`
        };
      }
    } catch (error) {
      console.error('刷新代理失败:', error);
      return {
        success: false,
        message: `刷新代理失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 验证单个代理服务器
   * 与healthCheckAll不同，这个方法会更新服务器的健康状态并返回验证结果
   */
  async validateServer(serverId: number): Promise<ApiResponse> {
    try {
      const server = await db('proxy_servers').where({ id: serverId }).first();
      
      if (!server) {
        return {
          success: false,
          message: '代理服务器不存在'
        };
      }
      
      const result = await this.validateProxy(server);
      
      // 更新代理服务器状态
      await db('proxy_servers')
        .where({ id: serverId })
        .update({
          is_healthy: result.isValid,
          response_time: result.responseTime,
          last_check_at: new Date().toISOString(),
          success_count: db.raw(`success_count + ${result.isValid ? 1 : 0}`),
          failure_count: db.raw(`failure_count + ${result.isValid ? 0 : 1}`),
          updated_at: new Date().toISOString()
        });
      
      // 记录代理使用统计
      await this.recordProxyUsage(serverId, result.isValid, result.responseTime);
      
      return {
        success: true,
        message: result.isValid ? '代理验证成功' : `代理验证失败: ${result.error}`,
        data: {
          is_healthy: result.isValid,
          response_time: result.responseTime,
          error: result.error
        }
      };
    } catch (error) {
      console.error('验证代理服务器失败:', error);
      return {
        success: false,
        message: `验证代理服务器失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 删除代理服务器
   */
  async deleteProxyServer(id: number): Promise<ApiResponse> {
    try {
      const deleted = await db('proxy_servers').where({ id }).del();
      
      if (deleted === 0) {
        return {
          success: false,
          message: '代理服务器不存在'
        };
      }
      
      return {
        success: true,
        message: '代理服务器删除成功'
      };
    } catch (error) {
      console.error('删除代理服务器失败:', error);
      return {
        success: false,
        message: `删除代理服务器失败: ${(error as Error).message}`
      };
    }
  }
} 