/**
 * Axios全局拦截器
 * 用于记录所有axios请求和响应信息，确保金融交易数据不会丢失
 * 支持业务上下文信息传递，类似于Java的ThreadLocal机制
 */
import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { AxiosLoggingService } from '../service/AxiosLoggingService';
import { BusinessContextManager } from './BusinessContextManager';

/**
 * 配置Axios全局拦截器
 */
export function setupAxiosInterceptors() {
  console.log('正在配置Axios全局拦截器（支持业务上下文）...');
  
  // 请求拦截器
  axios.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // 为请求添加开始时间戳
      (config as any)._requestStartTime = Date.now();
      
      // 获取当前业务上下文信息
      const businessContext = BusinessContextManager.getContext();
      if (businessContext) {
        // 将业务上下文信息存储在请求配置中，以便在响应拦截器中使用
        (config as any)._businessModule = businessContext.module;
        (config as any)._businessOperation = businessContext.operation;
        (config as any)._businessContextString = BusinessContextManager.getContextString();
        
        // 输出业务上下文信息（仅调试用）
        console.log(`业务上下文: 模块=${businessContext.module}, 操作=${businessContext.operation}`);
      }
      
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
  axios.interceptors.response.use(
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
        
        // 记录请求和响应详情
        const requestHeaders = JSON.stringify(response.config.headers || {});
        const responseHeaders = JSON.stringify(response.headers || {});
        
        // 处理请求体，确保完整记录原始内容
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
        
        // 获取请求配置中的业务上下文信息
        const businessModule = (response.config as any)._businessModule;
        const businessOperation = (response.config as any)._businessOperation;
        const businessContext = (response.config as any)._businessContextString;
        
        // 将请求和响应信息记录到数据库
        await AxiosLoggingService.logRequest({
          url: fullUrl,
          method: (response.config.method || 'GET').toUpperCase(),
          duration_ms: duration,
          status_code: response.status,
          request_body: requestBody,
          response_body: responseBody,
          request_headers: requestHeaders,
          success: true,
          // 添加业务上下文信息
          business_module: businessModule,
          business_operation: businessOperation,
          business_context: businessContext
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
        
        // 获取请求和响应相关信息
        const requestHeaders = JSON.stringify(config.headers || {});
        const responseHeaders = error.response ? JSON.stringify(error.response.headers || {}) : '';
        
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
        
        // 获取请求配置中的业务上下文信息
        const businessModule = (config as any)._businessModule;
        const businessOperation = (config as any)._businessOperation;
        const businessContext = (config as any)._businessContextString;
        
        // 将请求和错误信息记录到数据库
        await AxiosLoggingService.logRequest({
          url: fullUrl,
          method: (config.method || 'GET').toUpperCase(),
          duration_ms: duration,
          status_code: error.response ? error.response.status : 0,
          request_body: requestBody,
          response_body: responseBody,
          request_headers: requestHeaders,
          error_message: error.message,
          success: false,
          // 添加业务上下文信息
          business_module: businessModule,
          business_operation: businessOperation,
          business_context: businessContext
        });
      } catch (loggingError) {
        // 日志记录失败不应影响正常请求流程
        console.error('记录失败的API请求日志时发生错误:', loggingError);
      }
      
      return Promise.reject(error);
    }
  );
  
  console.log('Axios全局拦截器配置完成');
}