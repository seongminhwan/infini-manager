/**
 * HTTP客户端工具
 * 配置好拦截器的axios实例，所有服务都应该使用这个实例而不是直接导入axios
 * 集成代理池功能，可以自动选择和使用代理
 */
import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios';
import { AxiosLoggingService } from '../service/AxiosLoggingService';
import { ProxyPoolService } from '../service/ProxyPoolService';

// 创建代理池服务实例
const proxyPoolService = new ProxyPoolService();

// 默认代理池ID
const DEFAULT_PROXY_POOL_ID = 1;

// 扩展AxiosRequestConfig类型，添加代理池相关配置
interface EnhancedRequestConfig extends AxiosRequestConfig {
  useProxy?: boolean;          // 是否使用代理
  proxyPoolId?: number;        // 使用的代理池ID
  proxyServerId?: number;      // 使用特定的代理服务器ID
  _currentProxyId?: number;    // 当前使用的代理ID（内部使用）
}

// 创建一个自定义的axios实例
const httpClient = axios.create();

/**
 * 从代理池中选择代理并配置到请求中
 * @param config axios请求配置
 * @returns 配置了代理的请求配置
 */
const configureProxy = async (config: EnhancedRequestConfig): Promise<EnhancedRequestConfig> => {
  // 如果明确指定不使用代理，直接返回原配置
  if (config.useProxy === false) {
    console.log(`[代理日志] 请求 ${config.url} 明确指定不使用代理`);
    return config;
  }
  
  try {
    // 确定使用哪个代理池，默认使用ID为1的代理池
    const poolId = config.proxyPoolId || DEFAULT_PROXY_POOL_ID;
    console.log(`[代理日志] 为请求 ${config.url} 选择代理，使用代理池ID: ${poolId}`);
    
    // 如果指定了具体的代理服务器ID，则获取该代理
    if (config.proxyServerId) {
      console.log(`[代理日志] 使用指定的代理服务器ID: ${config.proxyServerId}`);
      const proxyResult = await proxyPoolService.getProxyServer(config.proxyServerId);
      if (proxyResult.success && proxyResult.data) {
        const proxy = proxyResult.data;
        // 记录当前使用的代理ID
        config._currentProxyId = proxy.id;
        
        console.log(`[代理日志] 成功获取代理服务器 #${proxy.id}: ${proxy.proxy_type}://${proxy.host}:${proxy.port}`);
        
        // 配置代理
        const configWithProxy = proxyPoolService.configureRequestProxy(proxy, config);
        console.log(`[代理日志] 已为请求 ${config.url} 配置代理 #${proxy.id}`);
        return configWithProxy;
      } else {
        console.warn(`[代理日志] 获取指定代理服务器失败: ${proxyResult.message || '未知原因'}`);
      }
    } else {
      // 否则从代理池中选择代理
      console.log(`[代理日志] 从代理池 #${poolId} 自动选择代理`);
      const proxy = await proxyPoolService.selectProxy(poolId);
      if (proxy) {
        // 记录当前使用的代理ID
        config._currentProxyId = proxy.id;
        
        console.log(`[代理日志] 成功选择代理 #${proxy.id}: ${proxy.name} (${proxy.proxy_type}://${proxy.host}:${proxy.port})`);
        
        // 配置代理
        const configWithProxy = proxyPoolService.configureRequestProxy(proxy, config);
        console.log(`[代理日志] 已为请求 ${config.url} 配置代理 #${proxy.id}`);
        return configWithProxy;
      } else {
        console.warn(`[代理日志] 代理池 #${poolId} 中未找到可用代理`);
      }
    }
    
    console.log(`[代理日志] 未找到可用代理，请求 ${config.url} 将使用直连模式`);
    return config;
  } catch (error) {
    console.error(`[代理日志] 配置代理失败:`, error);
    return config; // 出错时使用原配置
  }
};

// 请求拦截器
httpClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 为请求添加开始时间戳
    (config as any)._requestStartTime = Date.now();
    
    // 打印请求信息
    console.log(`发送${config.method?.toUpperCase()}请求: ${config.url}`);
    
    // 应用代理配置（如果需要）
    const enhancedConfig = config as EnhancedRequestConfig;
    console.log(`[代理日志] 开始为请求 ${config.url} 配置代理`);
    
    if (enhancedConfig.useProxy !== false) {
      const proxyConfig = await configureProxy(enhancedConfig);
      Object.assign(config, proxyConfig);
      
      // 记录代理配置结果
      if (enhancedConfig._currentProxyId) {
        console.log(`[代理日志] 请求 ${config.url} 成功配置代理 #${enhancedConfig._currentProxyId}`);
      } else {
        console.log(`[代理日志] 请求 ${config.url} 将使用直连模式`);
      }
    } else {
      console.log(`[代理日志] 请求 ${config.url} 不使用代理`);
    }
    
    return config;
  },
  (error: AxiosError) => {
    // 请求错误处理
    console.error('Axios请求拦截器捕获错误:', error.message);
    return Promise.reject(error);
  }
);

// 响应拦截器
httpClient.interceptors.response.use(
  async (response: AxiosResponse) => {
    try {
      // 计算请求耗时
      const startTime = (response.config as any)._requestStartTime || Date.now();
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 构建完整URL（包含查询参数）
      const url = response.config.url || '';
      const baseURL = response.config.baseURL || '';
      const fullUrl = url.startsWith('http') ? url : `${baseURL}${url}`;
      
      // 打印响应信息
      const resEnhancedConfig = response.config as EnhancedRequestConfig;
      if (resEnhancedConfig._currentProxyId) {
        console.log(`[代理日志] 收到响应: ${response.config.method?.toUpperCase()} ${fullUrl} - 状态: ${response.status} - 耗时: ${duration}ms - 使用代理: #${resEnhancedConfig._currentProxyId}`);
      } else {
        console.log(`收到响应: ${response.config.method?.toUpperCase()} ${fullUrl} - 状态: ${response.status} - 耗时: ${duration}ms - 直连模式`);
      }
      
      // 记录请求体，确保完整记录原始内容
      let requestBody = '';
      if (response.config.data) {
        // 如果请求体是对象，转换为JSON字符串
        if (typeof response.config.data === 'object') {
          requestBody = JSON.stringify(response.config.data);
        } else {
          requestBody = String(response.config.data);
        }
      }
      
      // 处理响应体
      let responseBody = '';
      if (response.data) {
        // 如果是对象，转换为JSON字符串
        if (typeof response.data === 'object') {
          responseBody = JSON.stringify(response.data);
        } else {
          responseBody = String(response.data);
        }
        
        // 如果响应体太大，只保留一部分（防止数据库存储问题）
        const maxLength = 10000; // 设置最大长度
        if (responseBody.length > maxLength) {
          responseBody = responseBody.substring(0, maxLength) + `... [截断，完整长度: ${responseBody.length}]`;
        }
      }
      
      // 将请求和响应信息记录到数据库
      await AxiosLoggingService.logRequest({
        url: fullUrl,
        method: (response.config.method || 'GET').toUpperCase(),
        duration_ms: duration,
        status_code: response.status,
        request_body: requestBody,
        response_body: responseBody,
        success: true // 修改字段名，与数据库列名保持一致
      });
      
      // 如果使用了代理，记录代理使用情况（成功）
      // 重用上面已声明的enhancedConfig变量
      if (enhancedConfig._currentProxyId) {
      // 使用上面定义的resEnhancedConfig变量
      if (resEnhancedConfig._currentProxyId) {
        console.log(`[代理日志] 记录代理 #${resEnhancedConfig._currentProxyId} 使用成功 - 响应时间: ${duration}ms`);
        try {
          await proxyPoolService.recordProxyUsage(
            resEnhancedConfig._currentProxyId,
            true, // 成功
            duration // 响应时间
          );
          console.log(`[代理日志] 代理使用统计已更新: #${resEnhancedConfig._currentProxyId} - 成功请求`);
        }
      }
    } catch (loggingError) {
      // 日志记录失败不应影响正常请求流程
      console.error('记录API请求日志失败:', loggingError);
    }
    
    return response;
  },
  async (error: AxiosError) => {
    try {
      // 计算请求耗时
      const config = error.config || {} as InternalAxiosRequestConfig;
      const startTime = (config as any)._requestStartTime || Date.now();
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // 构建完整URL
      const url = config.url || '';
      const baseURL = config.baseURL || '';
      const fullUrl = url.startsWith('http') ? url : `${baseURL}${url}`;
      
      // 打印错误信息
      const enhancedConfig = config as EnhancedRequestConfig;
      if (enhancedConfig._currentProxyId) {
        console.error(`[代理日志] 请求失败: ${config.method?.toUpperCase()} ${fullUrl} - 错误: ${error.message} - 使用代理: #${enhancedConfig._currentProxyId}`);
      } else {
        console.error(`请求失败: ${config.method?.toUpperCase()} ${fullUrl} - 错误: ${error.message} - 直连模式`);
      }
      
      // 处理请求体，确保完整记录原始内容
      let requestBody = '';
      if (config.data) {
        if (typeof config.data === 'object') {
          requestBody = JSON.stringify(config.data);
        } else {
          requestBody = String(config.data);
        }
      }
      
      // 处理响应体
      let responseBody = '';
      if (error.response && error.response.data) {
        if (typeof error.response.data === 'object') {
          responseBody = JSON.stringify(error.response.data);
        } else {
          responseBody = String(error.response.data);
        }
      }
      
      // 将请求和错误信息记录到数据库
      await AxiosLoggingService.logRequest({
        url: fullUrl,
        method: (config.method || 'GET').toUpperCase(),
        duration_ms: duration,
        status_code: error.response ? error.response.status : 0,
        request_body: requestBody,
        response_body: responseBody,
        error_message: error.message,
        success: false // 修改字段名，与数据库列名保持一致
      });
      
      // 如果使用了代理，记录代理使用情况（失败）
      // 重用上面已声明的enhancedConfig变量
      if (enhancedConfig._currentProxyId) {
        console.log(`[代理日志] 记录代理 #${enhancedConfig._currentProxyId} 使用失败 - 响应时间: ${duration}ms - 错误: ${error.message}`);
        try {
          await proxyPoolService.recordProxyUsage(
            enhancedConfig._currentProxyId,
            false, // 失败
            duration // 响应时间
          );
          console.log(`[代理日志] 代理使用统计已更新: #${enhancedConfig._currentProxyId} - 失败请求`);
        } catch (proxyLogError) {
          console.error(`[代理日志] 记录代理使用统计失败:`, proxyLogError);
        }
      }
    } catch (loggingError) {
      // 日志记录失败不应影响正常请求流程
      console.error('记录失败的API请求日志时发生错误:', loggingError);
    }
    
    return Promise.reject(error);
  }
);

console.log('[代理日志] HTTP客户端已配置，拦截器设置完成，代理池集成已启用');

// 导出配置好的axios实例
export default httpClient;