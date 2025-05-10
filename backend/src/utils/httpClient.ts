/**
 * HTTP客户端工具
 * 配置好拦截器的axios实例，所有服务都应该使用这个实例而不是直接导入axios
 */
import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { AxiosLoggingService } from '../service/AxiosLoggingService';

// 创建一个自定义的axios实例
const httpClient = axios.create();

// 请求拦截器
httpClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 为请求添加开始时间戳
    (config as any)._requestStartTime = Date.now();
    
    // 打印请求信息
    console.log(`发送${config.method?.toUpperCase()}请求: ${config.url}`);
    
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
      console.log(`收到响应: ${response.config.method?.toUpperCase()} ${fullUrl} - 状态: ${response.status} - 耗时: ${duration}ms`);
      
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
        request_url: fullUrl,
        request_method: (response.config.method || 'GET').toUpperCase(),
        duration_ms: duration,
        response_status: response.status,
        request_body: requestBody,
        response_data: responseBody,
        is_success: true
      });
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
      console.error(`请求失败: ${config.method?.toUpperCase()} ${fullUrl} - 错误: ${error.message}`);
      
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
        request_url: fullUrl,
        request_method: (config.method || 'GET').toUpperCase(),
        duration_ms: duration,
        response_status: error.response ? error.response.status : 0,
        request_body: requestBody,
        response_data: responseBody,
        error_message: error.message,
        is_success: false
      });
    } catch (loggingError) {
      // 日志记录失败不应影响正常请求流程
      console.error('记录失败的API请求日志时发生错误:', loggingError);
    }
    
    return Promise.reject(error);
  }
);

console.log('HTTP客户端已配置，拦截器设置完成');

// 导出配置好的axios实例
export default httpClient;