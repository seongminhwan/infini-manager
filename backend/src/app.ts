/**
 * Infini管理系统后端主入口文件
 */
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

// 导入路由
import accountRoutes from './routes/accounts';
import transferRoutes from './routes/transfers';
import registerRoutes from './routes/registers';
import notificationRoutes from './routes/notifications';
import emailAccountsRoutes from './routes/emailAccounts';
import kycImagesRoutes from './routes/kycImages';
import infiniAccountsRoutes from './routes/infiniAccounts';
import infiniCardsRoutes from './routes/infiniCards';
import randomUsersRoutes from './routes/randomUsers';
import totpToolsRoutes from './routes/totpTools';

// 导入类型
import { ApiResponse } from './types';

// 加载环境变量
dotenv.config();

// 初始化Express应用
const app: Application = express();

// 中间件配置 - 确保body-parser配置在最前面
// 先配置请求体大小限制，避免上传大文件时的413错误
app.use(express.json({ limit: '20mb' })); // 解析JSON请求体，设置合理限制
app.use(express.urlencoded({ extended: true, limit: '20mb' })); // 解析URL编码的请求体
app.use(cors()); // 启用CORS
app.use(morgan('dev')); // 日志记录

// Swagger文档配置
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Infini管理系统API文档',
      version: '1.0.0',
      description: '用于批量监测和维护Infini账号的系统API',
      contact: {
        name: 'API开发团队',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: '开发服务器',
      },
    ],
  },
  // 指定API路由文件路径
  apis: ['./src/routes/*.ts', './src/swagger/*.ts'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 健康检查路由
app.get('/api/health', (req: Request, res: Response) => {
  const response: ApiResponse = {
    success: true,
    data: {
      status: 'ok',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }
  };
  
  res.json(response);
});

// 注册API路由
app.use('/api/accounts', accountRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/registers', registerRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/email-accounts', emailAccountsRoutes);
app.use('/api/kyc-images', kycImagesRoutes);
app.use('/api/infini-accounts', infiniAccountsRoutes);
app.use('/api/infini-cards', infiniCardsRoutes);
app.use('/api/random-users', randomUsersRoutes);
app.use('/api/totp-tools', totpToolsRoutes);

// 404错误处理
app.use((req: Request, res: Response, next: NextFunction) => {
  const response: ApiResponse = {
    success: false,
    message: '未找到请求的资源'
  };
  
  res.status(404).json(response);
});

// 全局错误处理中间件
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  
  const response: ApiResponse = {
    success: false,
    message: err.message || '服务器内部错误'
  };
  
  res.status(err.statusCode || 500).json(response);
});

// 导出APP实例

export default app;