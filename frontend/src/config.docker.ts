/**
 * Docker环境配置
 * 这个文件包含仅用于Docker环境的配置参数
 */

// Docker环境API基础URL - 使用相对路径，由Nginx代理转发
export const API_BASE_URL = '';

// Docker环境端口配置 - 容器内使用80端口
export const PORT = 80;

// 其他Docker环境特定配置可以在这里添加
export const CONFIG = {
  environment: 'docker',
  apiBaseUrl: API_BASE_URL,
  port: PORT,
  debug: false,
  logLevel: 'info'
};

export default CONFIG;