/**
 * Infini管理系统后端启动文件
 */
import app from './app';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/db';

// 加载环境变量
dotenv.config();

// 设置端口
const PORT: number = parseInt(process.env.PORT || '5000', 10);

// 初始化数据库并启动服务器
initializeDatabase()
  .then(() => {
// 启动服务器 - 监听所有网络接口以支持容器化环境
    app.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器已启动，监听地址 0.0.0.0:${PORT}`);
  console.log(`Swagger文档地址: http://localhost:${PORT}/api-docs`);
  console.log(`健康检查地址: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((error) => {
    console.error('服务器启动失败，数据库初始化错误:', error);
    process.exit(1);
  });