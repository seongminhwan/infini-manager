/**
 * 业务上下文使用示例
 * 
 * 在Node.js中实现类似Java ThreadLocal的业务上下文传递机制
 * 主要通过Express中间件在路由层面设置业务上下文，无需开发者手动处理
 */
import { Request, Response, NextFunction, Router } from 'express';
import axios from 'axios';
import { BusinessContextManager } from './BusinessContextManager';

/**
 * 业务上下文中间件工厂函数
 * 创建一个为请求自动设置业务上下文的Express中间件
 * 
 * @param module 业务模块名称
 * @param operation 业务操作类型
 * @param getMetadata 可选函数，从请求中提取额外的上下文元数据
 */
export function createBusinessContextMiddleware(
  module: string, 
  operation: string,
  getMetadata?: (req: Request) => Record<string, any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 默认元数据
    const defaultMetadata = {
      requestId: req.headers['x-request-id'] || `req_${Date.now()}`,
      userId: (req as any).user?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };
    
    // 合并自定义元数据（如果有）
    const customMetadata = getMetadata ? getMetadata(req) : {};
    const metadata = { ...defaultMetadata, ...customMetadata };
    
    // 使用BusinessContextManager包装后续处理
    BusinessContextManager.run(
      { module, operation, metadata },
      next
    );
  };
}

/**
 * 示例1：在app.ts中设置全局路由前缀中间件
 * 
 * ```typescript
 * import express from 'express';
 * import { createBusinessContextMiddleware } from './utils/BusinessContextExample';
 * 
 * const app = express();
 * 
 * // 在所有路由前应用前缀中间件
 * app.use('/api', (req, res, next) => {
 *   // 从URL路径提取业务模块和操作
 *   const path = req.path;
 *   const segments = path.split('/').filter(Boolean);
 *   
 *   // 第一段通常是业务模块
 *   const module = segments[0] || 'unknown';
 *   
 *   // 基于HTTP方法确定操作类型
 *   let operation = 'unknown';
 *   switch(req.method) {
 *     case 'GET': operation = 'query'; break;
 *     case 'POST': operation = 'create'; break;
 *     case 'PUT': operation = 'update'; break;
 *     case 'DELETE': operation = 'delete'; break;
 *     default: operation = req.method.toLowerCase(); break;
 *   }
 *   
 *   // 创建并应用业务上下文中间件
 *   const contextMiddleware = createBusinessContextMiddleware(module, operation);
 *   contextMiddleware(req, res, next);
 * });
 * ```
 */

/**
 * 示例2：在路由文件中使用业务上下文中间件
 * 
 * ```typescript
 * // src/routes/infiniCards.ts
 * import { Router } from 'express';
 * import { createBusinessContextMiddleware } from '../utils/BusinessContextExample';
 * import { infiniCardController } from '../controllers/infiniCardController';
 * 
 * const router = Router();
 * 
 * // 为所有卡片路由设置业务模块
 * router.use(createBusinessContextMiddleware('card', 'general'));
 * 
 * // 为特定路由设置具体的业务操作
 * router.post('/apply', 
 *   createBusinessContextMiddleware('card', 'apply', (req) => ({
 *     cardType: req.body.cardType,    // 从请求体提取卡片类型作为元数据
 *     source: req.query.source || 'web'  // 来源渠道
 *   })), 
 *   infiniCardController.applyCard
 * );
 * 
 * // 批量申请卡片
 * router.post('/batch-apply', 
 *   createBusinessContextMiddleware('card', 'batch_apply'), 
 *   infiniCardController.batchApplyCards
 * );
 * 
 * export default router;
 * ```
 */

/**
 * 示例3：使用中间件包装整个路由模块
 * 
 * ```typescript
 * // app.ts中的路由注册部分
 * import { createBusinessContextMiddleware } from './utils/BusinessContextExample';
 * 
 * // 使用中间件包装路由模块，自动设置业务上下文
 * app.use('/api/infini-accounts', 
 *   createBusinessContextMiddleware('account', 'api'),
 *   infiniAccountsRoutes
 * );
 * 
 * app.use('/api/infini-cards', 
 *   createBusinessContextMiddleware('card', 'api'),
 *   infiniCardsRoutes
 * );
 * 
 * app.use('/api/transfers', 
 *   createBusinessContextMiddleware('transfer', 'api'),
 *   transferRoutes
 * );
 * ```
 */

/**
 * 示例4：高级用法 - 为不同HTTP方法设置不同业务操作
 * 
 * ```typescript
 * // src/routes/infiniAccounts.ts
 * import { Router } from 'express';
 * import { createBusinessContextMiddleware } from '../utils/BusinessContextExample';
 * import { infiniAccountController } from '../controllers/infiniAccountController';
 * 
 * const router = Router();
 * 
 * // 查询账户列表
 * router.get('/',
 *   createBusinessContextMiddleware('account', 'query'),
 *   infiniAccountController.getAccounts
 * );
 * 
 * // 创建账户
 * router.post('/',
 *   createBusinessContextMiddleware('account', 'create'),
 *   infiniAccountController.createAccount
 * );
 * 
 * // 更新账户
 * router.put('/:id',
 *   createBusinessContextMiddleware('account', 'update'),
 *   infiniAccountController.updateAccount
 * );
 * 
 * // 删除账户
 * router.delete('/:id',
 *   createBusinessContextMiddleware('account', 'delete'),
 *   infiniAccountController.deleteAccount
 * );
 * 
 * export default router;
 * ```
 */

/**
 * 注意：如果在特殊情况下需要手动设置业务上下文（不推荐），可以使用以下方式
 */
export async function manualContextExample(): Promise<void> {
  // 手动设置业务上下文并在其中执行异步操作
  // 不推荐在业务代码中直接使用此方式，应优先使用路由中间件
  await BusinessContextManager.runAsync(
    {
      module: 'batch_job',
      operation: 'cron_task',
      metadata: { 
        jobId: `job_${Date.now()}`,
        source: 'scheduler'
      }
    },
    async () => {
      // 在上下文中执行的代码...
      await axios.get('https://api.example.com/data');
      
      // 子任务也会继承上下文
      await processSubTask();
    }
  );
}

/**
 * 子任务示例
 */
async function processSubTask(): Promise<void> {
  // 这个函数内的所有axios请求都会自动包含父函数设置的业务上下文
  await axios.post('https://api.example.com/subtask', { data: 'example' });
}