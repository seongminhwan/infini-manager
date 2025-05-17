/**
 * 默认配置文件
 * 在开发环境中直接使用，在Docker环境中会被替换
 */

// 导入开发环境配置
import { API_BASE_URL, CONFIG } from './config.dev';

// 重新导出配置
export { API_BASE_URL, CONFIG };
export default CONFIG;