/**
 * Docker环境配置
 * 这个文件包含仅用于Docker环境的配置参数
 */

// Docker环境API基础URL - 使用相对路径，由Nginx代理转发
export const API_BASE_URL = '';

// 其他Docker环境特定配置可以在这里添加
export const CONFIG = {
  environment: 'docker',
  apiBaseUrl: API_BASE_URL,
  debug: false,
  logLevel: 'info'
};

export default CONFIG;