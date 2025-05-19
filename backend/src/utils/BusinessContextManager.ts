/**
 * 业务上下文管理器
 * 基于Node.js AsyncLocalStorage API实现，类似于Java的ThreadLocal机制
 * 用于在异步调用链中存储和传递业务相关的上下文信息
 */
import { AsyncLocalStorage } from 'async_hooks';

// 业务上下文接口定义
export interface BusinessContext {
  module?: string;       // 业务模块名称，如：'account', 'card', 'transfer'等
  operation?: string;    // 业务操作类型，如：'create', 'update', 'query'等
  metadata?: Record<string, any>; // 其他业务相关的元数据
}

// 创建AsyncLocalStorage实例
const asyncLocalStorage = new AsyncLocalStorage<BusinessContext>();

/**
 * 业务上下文管理器
 * 提供在异步操作链中存储和获取业务上下文信息的功能
 */
export class BusinessContextManager {
  /**
   * 在业务上下文中执行回调函数
   * @param context 业务上下文
   * @param callback 回调函数
   * @returns 回调函数的返回值
   */
  static run<T>(context: BusinessContext, callback: () => T): T {
    return asyncLocalStorage.run(context, callback);
  }

  /**
   * 在业务上下文中执行异步回调函数
   * @param context 业务上下文
   * @param callback 异步回调函数
   * @returns Promise<回调函数的返回值>
   */
  static async runAsync<T>(context: BusinessContext, callback: () => Promise<T>): Promise<T> {
    return asyncLocalStorage.run(context, callback);
  }

  /**
   * 获取当前业务上下文
   * @returns 当前业务上下文或undefined
   */
  static getContext(): BusinessContext | undefined {
    return asyncLocalStorage.getStore();
  }

  /**
   * 获取当前业务模块名称
   * @returns 业务模块名称或undefined
   */
  static getModule(): string | undefined {
    const context = this.getContext();
    return context?.module;
  }

  /**
   * 获取当前业务操作类型
   * @returns 业务操作类型或undefined
   */
  static getOperation(): string | undefined {
    const context = this.getContext();
    return context?.operation;
  }

  /**
   * 获取当前业务上下文元数据
   * @returns 业务上下文元数据或undefined
   */
  static getMetadata(): Record<string, any> | undefined {
    const context = this.getContext();
    return context?.metadata;
  }

  /**
   * 创建业务上下文的完整字符串表示
   * @returns JSON字符串或undefined
   */
  static getContextString(): string | undefined {
    const context = this.getContext();
    if (!context) return undefined;
    return JSON.stringify(context);
  }
}

/**
 * 业务上下文装饰器
 * 用于自动将业务上下文应用到类方法
 * 
 * 使用示例:
 * @withBusinessContext({ module: 'account', operation: 'create' })
 * async createAccount() { ... }
 */
export function withBusinessContext(context: BusinessContext) {
  return function(
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function(...args: any[]) {
      return BusinessContextManager.runAsync(context, () => {
        return originalMethod.apply(this, args);
      });
    };
    
    return descriptor;
  };
}

export default BusinessContextManager;