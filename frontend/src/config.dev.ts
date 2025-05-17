/**
 * 开发环境配置
 * 这个文件包含仅用于开发环境的配置参数
 */

// 开发环境API基础URL - 直接指向本地后端服务
export const API_BASE_URL = 'http://localhost:33201';

// 开发服务器端口配置
export const PORT = 33202;

// 其他开发环境特定配置可以在这里添加
export const CONFIG = {
  environment: 'development',
  apiBaseUrl: API_BASE_URL,
  port: PORT,
  debug: true,
  logLevel: 'debug'
};

export default CONFIG;