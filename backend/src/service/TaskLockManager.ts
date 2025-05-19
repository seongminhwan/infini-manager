/**
 * 任务锁管理器
 * 用于防止任务在分布式环境下重复执行
 */
import { v4 as uuidv4 } from 'uuid';
import db from '../db/db';
import { LockStatus, TaskLock } from '../types/scheduledTask';

export class TaskLockManager {
  private nodeId: string;

  /**
   * 构造函数
   * @param nodeId 可选的节点ID，如果不提供会自动生成
   */
  constructor(nodeId?: string) {
    // 生成唯一的节点ID，用于标识当前进程
    this.nodeId = nodeId || `node-${uuidv4()}`;
    console.log(`任务锁管理器初始化，节点ID: ${this.nodeId}`);
  }

  /**
   * 获取任务锁
   * @param taskKey 任务唯一标识
   * @param lockTimeoutSeconds 锁超时时间（秒）
   * @returns 是否成功获取锁
   */
  async acquireLock(taskKey: string, lockTimeoutSeconds: number = 300): Promise<boolean> {
    try {
      // 计算锁过期时间
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + lockTimeoutSeconds);
      
      // 使用事务确保原子性
      const trx = await db.transaction();
      
      try {
        // 清理过期的锁
        await trx('infini_task_locks')
          .where('expires_at', '<', new Date())
          .where('lock_status', LockStatus.ACQUIRED)
          .update({
            lock_status: LockStatus.RELEASED,
            release_time: new Date(),
            updated_at: new Date()
          });
        
        // 获取当前有效的锁
        const existingLock = await trx('infini_task_locks')
          .where('task_key', taskKey)
          .where('lock_status', LockStatus.ACQUIRED)
          .where('expires_at', '>', new Date())
          .first();
        
        // 如果已存在有效锁，则获取锁失败
        if (existingLock) {
          await trx.commit();
          return false;
        }
        
        // 尝试获取锁
        try {
          await trx('infini_task_locks').insert({
            task_key: taskKey,
            node_id: this.nodeId,
            lock_status: LockStatus.ACQUIRED,
            lock_time: new Date(),
            expires_at: expiresAt,
            created_at: new Date(),
            updated_at: new Date()
          });
          
          // 提交事务
          await trx.commit();
          console.log(`任务 ${taskKey} 已获取锁，节点: ${this.nodeId}, 过期时间: ${expiresAt}`);
          return true;
        } catch (error) {
          // 如果插入失败，通常是因为违反了唯一约束
          await trx.rollback();
          console.warn(`获取任务锁失败: ${taskKey}`, error);
          return false;
        }
      } catch (error) {
        // 其他错误，回滚事务
        await trx.rollback();
        throw error;
      }
    } catch (error) {
      console.error(`获取锁过程中发生错误: ${taskKey}`, error);
      return false;
    }
  }

  /**
   * 释放任务锁
   * @param taskKey 任务唯一标识
   * @returns 是否成功释放锁
   */
  async releaseLock(taskKey: string): Promise<boolean> {
    try {
      // 使用事务确保原子性
      const trx = await db.transaction();
      
      try {
        // 查找当前节点持有的锁
        const lock = await trx('infini_task_locks')
          .where('task_key', taskKey)
          .where('node_id', this.nodeId)
          .where('lock_status', LockStatus.ACQUIRED)
          .first();
        
        // 如果没有找到锁，或者锁不是由当前节点持有，则释放失败
        if (!lock) {
          await trx.commit();
          console.warn(`无法释放锁: ${taskKey}, 未找到由当前节点 ${this.nodeId} 持有的锁`);
          return false;
        }
        
        // 释放锁
        await trx('infini_task_locks')
          .where('id', lock.id)
          .update({
            lock_status: LockStatus.RELEASED,
            release_time: new Date(),
            updated_at: new Date()
          });
        
        // 提交事务
        await trx.commit();
        console.log(`任务 ${taskKey} 锁已释放，节点: ${this.nodeId}`);
        return true;
      } catch (error) {
        // 其他错误，回滚事务
        await trx.rollback();
        throw error;
      }
    } catch (error) {
      console.error(`释放锁过程中发生错误: ${taskKey}`, error);
      return false;
    }
  }

  /**
   * 更新锁过期时间
   * @param taskKey 任务唯一标识
   * @param extendSeconds 延长的秒数
   * @returns 是否成功更新
   */
  async extendLock(taskKey: string, extendSeconds: number = 300): Promise<boolean> {
    try {
      // 计算新的过期时间
      const newExpiresAt = new Date();
      newExpiresAt.setSeconds(newExpiresAt.getSeconds() + extendSeconds);
      
      // 查找当前节点持有的锁
      const lock = await db('infini_task_locks')
        .where('task_key', taskKey)
        .where('node_id', this.nodeId)
        .where('lock_status', LockStatus.ACQUIRED)
        .first();
      
      // 如果没有找到锁，或者锁不是由当前节点持有，则更新失败
      if (!lock) {
        console.warn(`无法更新锁: ${taskKey}, 未找到由当前节点 ${this.nodeId} 持有的锁`);
        return false;
      }
      
      // 更新锁过期时间
      await db('infini_task_locks')
        .where('id', lock.id)
        .update({
          expires_at: newExpiresAt,
          updated_at: new Date()
        });
      
      console.log(`任务 ${taskKey} 锁已延长，新过期时间: ${newExpiresAt}`);
      return true;
    } catch (error) {
      console.error(`更新锁过期时间过程中发生错误: ${taskKey}`, error);
      return false;
    }
  }

  /**
   * 检查任务是否已锁定
   * @param taskKey 任务唯一标识
   * @returns 是否已锁定
   */
  async isLocked(taskKey: string): Promise<boolean> {
    try {
      // 查找有效的锁
      const lock = await db('infini_task_locks')
        .where('task_key', taskKey)
        .where('lock_status', LockStatus.ACQUIRED)
        .where('expires_at', '>', new Date())
        .first();
      
      return !!lock;
    } catch (error) {
      console.error(`检查锁状态过程中发生错误: ${taskKey}`, error);
      return false;
    }
  }

  /**
   * 清理过期锁
   * @returns 清理的锁数量
   */
  async cleanupExpiredLocks(): Promise<number> {
    try {
      // 清理过期的锁
      const result = await db('infini_task_locks')
        .where('expires_at', '<', new Date())
        .where('lock_status', LockStatus.ACQUIRED)
        .update({
          lock_status: LockStatus.RELEASED,
          release_time: new Date(),
          updated_at: new Date()
        });
      
      console.log(`已清理 ${result} 个过期锁`);
      return result;
    } catch (error) {
      console.error('清理过期锁过程中发生错误', error);
      return 0;
    }
  }

  /**
   * 获取节点ID
   * @returns 节点ID
   */
  getNodeId(): string {
    return this.nodeId;
  }
}

export default TaskLockManager;