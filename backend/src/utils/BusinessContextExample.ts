/**
 * 业务上下文使用示例
 * 演示如何在业务代码中使用BusinessContextManager
 */
import axios from 'axios';
import { BusinessContextManager, withBusinessContext } from './BusinessContextManager';

/**
 * 卡片服务示例类
 * 展示两种使用业务上下文的方式：手动设置和使用装饰器
 */
export class CardServiceExample {
  /**
   * 方式一：手动设置业务上下文
   * 在方法内部使用BusinessContextManager.run()手动设置业务上下文
   */
  async getCardDetails(cardId: string): Promise<any> {
    // 设置业务上下文并在其中执行异步操作
    return BusinessContextManager.runAsync(
      {
        module: 'card',
        operation: 'query',
        metadata: { cardId }
      },
      async () => {
        // 在这个异步函数中执行的所有操作都可以访问到业务上下文
        // 包括内部调用的所有axios请求
        
        try {
          const response = await axios.get(`/api/cards/${cardId}`);
          return response.data;
        } catch (error) {
          console.error('获取卡片详情失败:', error);
          throw error;
        }
      }
    );
  }

  /**
   * 方式二：使用装饰器自动应用业务上下文
   * 使用@withBusinessContext装饰器自动为方法应用业务上下文
   */
  @withBusinessContext({
    module: 'card',
    operation: 'apply',
    metadata: { source: 'web' }
  })
  async applyNewCard(userId: string, cardType: string): Promise<any> {
    // 该方法中的所有axios请求都会自动包含业务上下文
    // 无需手动设置BusinessContextManager.run()
    
    try {
      const response = await axios.post('/api/cards/apply', {
        userId,
        cardType
      });
      
      return response.data;
    } catch (error) {
      console.error('申请新卡失败:', error);
      throw error;
    }
  }
}

/**
 * 账户服务示例类
 * 展示嵌套业务上下文的情况
 */
export class AccountServiceExample {
  private cardService = new CardServiceExample();
  
  /**
   * 创建账户并申请卡片
   * 演示业务上下文的嵌套使用
   */
  async createAccountWithCard(userData: any, cardType: string): Promise<any> {
    return BusinessContextManager.runAsync(
      {
        module: 'account',
        operation: 'create',
        metadata: { source: 'app', userData }
      },
      async () => {
        // 创建账户
        const accountResponse = await axios.post('/api/accounts', userData);
        const accountId = accountResponse.data.id;
        
        // 这里调用另一个带有业务上下文的方法，将创建一个新的业务上下文
        // 但原始请求仍然会保留'account'业务上下文
        await this.cardService.applyNewCard(accountId, cardType);
        
        return {
          accountId,
          message: '账户创建并申请卡片成功'
        };
      }
    );
  }
}

/**
 * 示例：使用业务上下文中间件（Express）
 * 可以在路由处理前自动设置业务上下文
 */
export function businessContextMiddleware(module: string, operation: string) {
  return (req: any, res: any, next: () => void) => {
    // 从请求中获取额外的上下文信息
    const metadata = {
      userId: req.user?.id,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };
    
    // 使用BusinessContextManager包装后续处理
    BusinessContextManager.run(
      { module, operation, metadata },
      () => next()
    );
  };
}

/**
 * 示例：在Express路由中使用业务上下文中间件
 * 
 * ```typescript
 * import express from 'express';
 * import { businessContextMiddleware } from './BusinessContextExample';
 * 
 * const router = express.Router();
 * 
 * // 为整个路由组应用业务上下文
 * router.use('/cards', businessContextMiddleware('card', 'api'));
 * 
 * // 或为特定路由应用业务上下文
 * router.post('/transfers', 
 *   businessContextMiddleware('transfer', 'create'), 
 *   transferController.createTransfer
 * );
 * ```
 */