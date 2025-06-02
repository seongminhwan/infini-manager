/**
 * Infini管理系统后端启动文件
 */
import app from './app';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/db';
import { initializeTaskService } from './controllers/taskController';
import { imapIdleServiceInstance } from './service/ImapIdleService';

// 加载环境变量
dotenv.config();

// 设置端口
const PORT: number = parseInt(process.env.PORT || '5000', 10);

// 初始化数据库并启动服务器
initializeDatabase()
  .then(async () => {
    try {
      // 初始化任务服务
      console.log('正在初始化定时任务服务...');
      await initializeTaskService();
      console.log('定时任务服务初始化完成');
      
      // 初始化IMAP IDLE长连接服务
      console.log('正在初始化IMAP IDLE长连接服务...');
      try {
        await imapIdleServiceInstance.initialize();
        console.log('IMAP IDLE长连接服务初始化完成');
      } catch (idleError) {
        console.error('IMAP IDLE长连接服务初始化失败:', idleError);
        // IDLE服务初始化失败不影响服务器启动
      }
    } catch (error) {
      console.error('后台服务初始化失败:', error);
      // 后台服务初始化失败不影响服务器启动
    }

    // 启动服务器 - 监听所有网络接口以支持容器化环境
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`服务器已启动，监听地址 0.0.0.0:${PORT}`);
      console.log(`Swagger文档地址: http://localhost:${PORT}/api-docs`);
      console.log(`健康检查地址: http://localhost:${PORT}/api/health`);
    });
  })
    // 添加进程退出处理
    const gracefulShutdown = async () => {
      console.log('接收到退出信号,正在关闭应用...');
      
      // 停止所有IMAP IDLE连接
      try {
        console.log('正在关闭IMAP IDLE长连接...');
        await imapIdleServiceInstance.stopAllConnections();
        console.log('IMAP IDLE长连接已关闭');
      } catch (error) {
        console.error('关闭IMAP IDLE长连接失败:', error);
      }
      
      // 关闭HTTP服务器
      server.close(() => {
        console.log('HTTP服务器已关闭');
        process.exit(0);
      });
      
      // 设置超时强制退出
      setTimeout(() => {
        console.error('应用关闭超时,强制退出');
        process.exit(1);
      }, 10000);
    };
    
    // 注册进程信号处理
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  })
  .catch((error) => {
    console.error('服务器启动失败，数据库初始化错误:', error);
    process.exit(1);
  });