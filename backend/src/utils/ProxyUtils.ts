/**
 * 代理工具类
 * 提供代理获取和应用的通用方法
 */
import { ProxyServer } from "../service/ProxyPoolService";
import db from '../db/db';

// 代理服务器接口 - 所有字段都是必需的
export interface SimpleProxyConfig {
  host: string;
  port: number;
  type: 'http' | 'https' | 'socks4' | 'socks5';
  auth?: {
    username?: string;
    password?: string;
  };
}

// 可选代理配置接口 - 所有字段都是可选的
export interface OptionalProxyConfig {
  host?: string;
  port?: number;
  type?: 'http' | 'https' | 'socks4' | 'socks5';
  auth?: {
    username?: string;
    password?: string;
  };
}

/**
 * 将可选代理配置转换为完整的代理配置
 * @param optionalConfig 可选代理配置
 * @returns 完整的代理配置或null
 */
export function convertToSimpleProxyConfig(optionalConfig: OptionalProxyConfig): SimpleProxyConfig | null {
  if (!optionalConfig.host || !optionalConfig.port || !optionalConfig.type) {
    return null;
  }
  
  return {
    host: optionalConfig.host,
    port: optionalConfig.port,
    type: optionalConfig.type,
    auth: optionalConfig.auth
  };
}
/**
 * 获取指定ID的代理服务器
 * @param proxyServerId 代理服务器ID
 * @returns 代理服务器配置
 */
export async function getProxyById(proxyServerId: number): Promise<SimpleProxyConfig | null> {
  try {
    const proxy = await db('proxy_servers').where({ id: proxyServerId }).first();
    
    if (!proxy) {
      console.warn(`未找到ID为${proxyServerId}的代理服务器`);
      return null;
    }
    
    if (!proxy.enabled) {
      console.warn(`ID为${proxyServerId}的代理服务器已禁用`);
      return null;
    }
    
    return {
      host: proxy.host,
      port: proxy.port,
      type: proxy.proxy_type,
      auth: proxy.username && proxy.password ? {
        username: proxy.username,
        password: proxy.password
      } : undefined
    };
  } catch (error) {
    console.error('获取代理服务器失败:', error);
    return null;
  }
}

/**
 * 根据标签随机获取一个代理服务器
 * @param tag 代理标签
 * @returns 代理服务器配置
 */
export async function getRandomProxyByTag(tag: string): Promise<SimpleProxyConfig | null> {
  try {
    // 获取带有指定标签的代理服务器列表
    const proxies = await db('proxy_servers')
      .join('proxy_server_tags', 'proxy_servers.id', 'proxy_server_tags.proxy_server_id')
      .join('proxy_tags', 'proxy_server_tags.tag_id', 'proxy_tags.id')
      .where('proxy_tags.name', tag)
      .where('proxy_servers.enabled', true)
      .select('proxy_servers.*');
    
    if (!proxies || proxies.length === 0) {
      console.warn(`未找到标签为"${tag}"的可用代理服务器`);
      return null;
    }
    
    // 随机选择一个代理服务器
    const randomIndex = Math.floor(Math.random() * proxies.length);
    const proxy = proxies[randomIndex];
    
    return {
      host: proxy.host,
      port: proxy.port,
      type: proxy.proxy_type,
      auth: proxy.username && proxy.password ? {
        username: proxy.username,
        password: proxy.password
      } : undefined
    };
  } catch (error) {
    console.error(`根据标签"${tag}"获取随机代理服务器失败:`, error);
    return null;
  }
}

/**
 * 创建IMAP代理代理对象
 * @param proxyConfig 代理配置
 * @returns 代理代理对象或null
 */
export function createImapProxyAgent(proxyConfig: SimpleProxyConfig): any {
  try {
    // 根据代理类型创建不同的代理代理
    if (proxyConfig.type === 'socks4' || proxyConfig.type === 'socks5') {
      // 对于SOCKS代理，使用socks-proxy-agent
      const { SocksProxyAgent } = require('socks-proxy-agent');
      
      const socksVersion = proxyConfig.type === 'socks5' ? 5 : 4;
      const proxyUrl = `socks${socksVersion}://${proxyConfig.auth?.username ? `${proxyConfig.auth.username}:${proxyConfig.auth.password}@` : ''}${proxyConfig.host}:${proxyConfig.port}`;
      
      return new SocksProxyAgent(proxyUrl);
    } else {
      // 对于HTTP/HTTPS代理，使用http-proxy-agent或https-proxy-agent
      const { HttpProxyAgent } = require('http-proxy-agent');
      const { HttpsProxyAgent } = require('https-proxy-agent');
      
      const Agent = proxyConfig.type === 'https' ? HttpsProxyAgent : HttpProxyAgent;
      const proxyUrl = `${proxyConfig.type}://${proxyConfig.auth?.username ? `${proxyConfig.auth.username}:${proxyConfig.auth.password}@` : ''}${proxyConfig.host}:${proxyConfig.port}`;
      
      return new Agent(proxyUrl);
    }
  } catch (error) {
    console.error('创建IMAP代理代理对象失败:', error);
    return null;
  }
}

/**
 * 获取SMTP代理配置
 * @param proxyConfig 代理配置
 * @param logId 可选的日志ID，用于跟踪日志
 * @returns SMTP代理配置对象或null
 */
export function createSmtpProxyConfig(proxyConfig: SimpleProxyConfig, logId?: string): any {
  try {
    const logPrefix = logId ? `[${logId}]` : '';
    
    // 检查代理配置的有效性
    if (!proxyConfig.host || !proxyConfig.port || !proxyConfig.type) {
      console.error(`${logPrefix} SMTP代理配置不完整:`, JSON.stringify(proxyConfig));
      return null;
    }
    
    // 记录详细的代理配置信息
    console.log(`${logPrefix} 创建SMTP代理配置:`);
    console.log(`${logPrefix} - 代理类型: ${proxyConfig.type}`);
    console.log(`${logPrefix} - 代理服务器: ${proxyConfig.host}:${proxyConfig.port}`);
    console.log(`${logPrefix} - 认证信息: ${proxyConfig.auth ? (proxyConfig.auth.username ? '有用户名/密码' : '无用户名') : '无认证'}`);
    
    // 根据代理类型创建不同的代理配置
    const authString = proxyConfig.auth?.username ? 
      `${encodeURIComponent(proxyConfig.auth.username)}:${encodeURIComponent(proxyConfig.auth.password || '')}@` : 
      '';
    
    const proxyUrl = `${proxyConfig.type}://${authString}${proxyConfig.host}:${proxyConfig.port}`;
    console.log(`${logPrefix} - 最终代理URL: ${proxyConfig.type}://${proxyConfig.auth?.username ? '***:***@' : ''}${proxyConfig.host}:${proxyConfig.port}`);
    
    return {
      url: proxyUrl,
      secure: proxyConfig.type === 'https',
      onProxyError: (err: Error) => {
        console.error(`${logPrefix} SMTP代理连接错误:`, err.message);
        if (err.stack) {
          console.error(`${logPrefix} 错误堆栈:`, err.stack);
        }
      }
    };
  } catch (error) {
    console.error(`${logId ? `[${logId}]` : ''} 创建SMTP代理配置时发生异常:`, error);
    return null;
  }
}

/**
 * 尝试使用不同代理类型创建SMTP代理配置
 * 当HTTP代理失败时，会尝试SOCKS5代理
 * @param proxyConfig 代理配置
 * @param logId 可选的日志ID，用于跟踪日志
 * @returns SMTP代理配置对象数组，按优先级排序
 */
export function createFallbackSmtpProxyConfigs(proxyConfig: SimpleProxyConfig, logId?: string): any[] {
  const proxyConfigs = [];
  const logPrefix = logId ? `[${logId}]` : '';
  
  // 首先尝试使用原始代理类型
  const originalConfig = createSmtpProxyConfig({...proxyConfig}, logId);
  if (originalConfig) {
    proxyConfigs.push(originalConfig);
    console.log(`${logPrefix} 添加原始代理类型(${proxyConfig.type})配置`);
  }
  
  // 如果原始类型是HTTP或HTTPS，添加SOCKS5作为备选
  if (proxyConfig.type === 'http' || proxyConfig.type === 'https') {
    console.log(`${logPrefix} 添加SOCKS5备选代理配置`);
    const socks5Config = createSmtpProxyConfig({
      ...proxyConfig,
      type: 'socks5'
    }, logId);
    
    if (socks5Config) {
      proxyConfigs.push(socks5Config);
    }
  }
  // 如果原始类型是SOCKS，添加HTTP作为备选
  else if (proxyConfig.type === 'socks4' || proxyConfig.type === 'socks5') {
    console.log(`${logPrefix} 添加HTTP备选代理配置`);
    const httpConfig = createSmtpProxyConfig({
      ...proxyConfig,
      type: 'http'
    }, logId);
    
    if (httpConfig) {
      proxyConfigs.push(httpConfig);
    }
  }
  
  console.log(`${logPrefix} 创建了${proxyConfigs.length}个备选SMTP代理配置`);
  return proxyConfigs;
}