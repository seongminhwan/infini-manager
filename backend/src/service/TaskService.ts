/**
 * 定时任务服务
 */
import * as cron from 'node-cron';
// 使用CommonJS的方式导入cron-parser，避免TypeScript类型错误
const parser = require('cron-parser');
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/db';
import TaskLockManager from './TaskLockManager';
import {
  ScheduledTask,
  TaskDTO,
  TaskStatus,
  TaskHandlerParams,
  HandlerType,
  ExecutionStatus,
  TriggerType,
  TaskExecutionResult
} from '../types/scheduledTask';

/**
 * 任务服务类
 */
export class TaskService {
  private taskMap: Map<string, cron.ScheduledTask> = new Map();
  private lockManager: TaskLockManager;
  private nodeId: string;
  private registeredHandlers: Map<string, Function> = new Map();

  /**
   * 构造函数
   */
  constructor() {
    // 生成唯一的节点ID
    this.nodeId = `node-${uuidv4()}`;
    // 初始化锁管理器
    this.lockManager = new TaskLockManager(this.nodeId);
    console.log(`任务服务初始化，节点ID: ${this.nodeId}`);
  }

  /**
   * 初始化任务服务
   */
  async initialize(): Promise<void> {
    try {
      // 清理过期锁
      await this.lockManager.cleanupExpiredLocks();
      
      // 加载并调度所有启用的任务
      const tasks = await this.getAllEnabledTasks();
      console.log(`开始加载 ${tasks.length} 个启用的任务`);
      
      for (const task of tasks) {
        this.scheduleTask(task);
      }
      
      console.log('任务服务初始化完成');
    } catch (error) {
      console.error('任务服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有启用的任务
   */
  private async getAllEnabledTasks(): Promise<ScheduledTask[]> {
    return await db('infini_scheduled_tasks')
      .where('status', TaskStatus.ENABLED)
      .select('*');
  }

  /**
   * 创建任务
   * @param taskDTO 任务数据
   * @returns 创建的任务ID
   */
  async createTask(taskDTO: TaskDTO): Promise<number> {
    try {
      // 检查任务键是否已存在
      const existingTask = await db('infini_scheduled_tasks')
        .where('task_key', taskDTO.taskKey)
        .whereNot('status', TaskStatus.DELETED)
        .first();
      
      if (existingTask) {
        throw new Error(`任务键 ${taskDTO.taskKey} 已存在`);
      }
      
      // 验证cron表达式
      if (!cron.validate(taskDTO.cronExpression)) {
        throw new Error(`无效的cron表达式: ${taskDTO.cronExpression}`);
      }
      
      // 计算下次执行时间
      const interval = parser.parseExpression(taskDTO.cronExpression, { currentDate: new Date() });
      const nextExecutionTime = interval.next().toDate();
      
      // 转换处理器参数为JSON字符串
      const handlerJson = JSON.stringify(taskDTO.handler);
      
      // 插入任务记录
      const [taskId] = await db('infini_scheduled_tasks').insert({
        task_name: taskDTO.taskName,
        task_key: taskDTO.taskKey,
        cron_expression: taskDTO.cronExpression,
        handler: handlerJson,
        status: taskDTO.status,
        retry_count: taskDTO.retryCount || 0,
        retry_interval: taskDTO.retryInterval || 0,
        description: taskDTO.description || null,
        next_execution_time: nextExecutionTime,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      // 如果任务是启用状态，则调度任务
      if (taskDTO.status === TaskStatus.ENABLED) {
        const task = await db('infini_scheduled_tasks')
          .where('id', taskId)
          .first();
        
        if (task) {
          this.scheduleTask(task);
        }
      }
      
      return taskId;
    } catch (error) {
      console.error('创建任务失败:', error);
      throw error;
    }
  }

  /**
   * 更新任务
   * @param taskId 任务ID
   * @param taskDTO 任务数据
   * @returns 更新是否成功
   */
  async updateTask(taskId: number, taskDTO: Partial<TaskDTO>): Promise<boolean> {
    try {
      // 获取当前任务信息
      const currentTask = await db('infini_scheduled_tasks')
        .where('id', taskId)
        .first();
      
      if (!currentTask) {
        throw new Error(`任务ID ${taskId} 不存在`);
      }
      
      // 如果要更新cron表达式，则验证其有效性
      if (taskDTO.cronExpression && !cron.validate(taskDTO.cronExpression)) {
        throw new Error(`无效的cron表达式: ${taskDTO.cronExpression}`);
      }
      
      // 准备更新数据
      const updateData: any = {
        updated_at: new Date()
      };
      
      if (taskDTO.taskName !== undefined) {
        updateData.task_name = taskDTO.taskName;
      }
      
      if (taskDTO.cronExpression !== undefined) {
        updateData.cron_expression = taskDTO.cronExpression;
        
        // 计算新的下次执行时间
        const interval = parser.parseExpression(taskDTO.cronExpression, { currentDate: new Date() });
        updateData.next_execution_time = interval.next().toDate();
      }
      
      if (taskDTO.handler !== undefined) {
        updateData.handler = JSON.stringify(taskDTO.handler);
      }
      
      if (taskDTO.status !== undefined) {
        updateData.status = taskDTO.status;
      }
      
      if (taskDTO.retryCount !== undefined) {
        updateData.retry_count = taskDTO.retryCount;
      }
      
      if (taskDTO.retryInterval !== undefined) {
        updateData.retry_interval = taskDTO.retryInterval;
      }
      
      if (taskDTO.description !== undefined) {
        updateData.description = taskDTO.description;
      }
      
      // 更新任务记录
      await db('infini_scheduled_tasks')
        .where('id', taskId)
        .update(updateData);
      
      // 如果任务已经被调度，则取消原调度
      if (this.taskMap.has(currentTask.task_key)) {
        this.taskMap.get(currentTask.task_key)?.stop();
        this.taskMap.delete(currentTask.task_key);
      }
      
      // 如果任务是启用状态，则重新调度任务
      if ((taskDTO.status === TaskStatus.ENABLED) || 
          (currentTask.status === TaskStatus.ENABLED && taskDTO.status === undefined)) {
        const updatedTask = await db('infini_scheduled_tasks')
          .where('id', taskId)
          .first();
        
        if (updatedTask) {
          this.scheduleTask(updatedTask);
        }
      }
      
      return true;
    } catch (error) {
      console.error('更新任务失败:', error);
      throw error;
    }
  }

  /**
   * 删除任务
   * @param taskId 任务ID
   * @returns 删除是否成功
   */
  async deleteTask(taskId: number): Promise<boolean> {
    try {
      // 获取当前任务信息
      const currentTask = await db('infini_scheduled_tasks')
        .where('id', taskId)
        .first();
      
      if (!currentTask) {
        throw new Error(`任务ID ${taskId} 不存在`);
      }
      
      // 更新任务状态为已删除
      await db('infini_scheduled_tasks')
        .where('id', taskId)
        .update({
          status: TaskStatus.DELETED,
          updated_at: new Date()
        });
      
      // 如果任务已经被调度，则取消调度
      if (this.taskMap.has(currentTask.task_key)) {
        this.taskMap.get(currentTask.task_key)?.stop();
        this.taskMap.delete(currentTask.task_key);
      }
      
      return true;
    } catch (error) {
      console.error('删除任务失败:', error);
      throw error;
    }
  }

  /**
   * 手动触发任务
   * @param taskId 任务ID
   * @returns 执行结果
   */
  async triggerTask(taskId: number): Promise<TaskExecutionResult> {
    try {
      // 获取任务信息
      const task = await db('infini_scheduled_tasks')
        .where('id', taskId)
        .first();
      
      if (!task) {
        throw new Error(`任务ID ${taskId} 不存在`);
      }
      
      // 如果任务已禁用或已删除，则拒绝执行
      if (task.status !== TaskStatus.ENABLED) {
        throw new Error(`任务 ${task.task_key} 当前状态为 ${task.status}，无法手动触发`);
      }
      
      // 执行任务并返回结果
      return await this.executeTask(task, TriggerType.MANUAL);
    } catch (error) {
      console.error('手动触发任务失败:', error);
      const errMsg = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        error: errMsg,
        executionTimeMs: 0,
        logs: [`手动触发任务失败: ${errMsg}`]
      };
    }
  }

  /**
   * 调度任务
   * @param task 任务信息
   */
  private scheduleTask(task: ScheduledTask): void {
    try {
      // 如果任务已被调度，则先取消
      if (this.taskMap.has(task.task_key)) {
        this.taskMap.get(task.task_key)?.stop();
        this.taskMap.delete(task.task_key);
      }
      
      // 验证cron表达式
      if (!cron.validate(task.cron_expression)) {
        console.error(`无效的cron表达式: ${task.cron_expression}，任务 ${task.task_key} 将不会被调度`);
        return;
      }
      
      // 调度任务
      const scheduledTask = cron.schedule(task.cron_expression, async () => {
        try {
          // 执行任务，并记录日志
          const result = await this.executeTask(task, TriggerType.SCHEDULED);
          
          if (result.success) {
            console.log(`任务 ${task.task_key} 执行成功，耗时: ${result.executionTimeMs}ms`);
          } else {
            console.error(`任务 ${task.task_key} 执行失败:`, result.error);
          }
        } catch (error) {
          console.error(`任务 ${task.task_key} 执行时发生异常:`, error);
        }
      });
      
      // 保存调度任务引用
      this.taskMap.set(task.task_key, scheduledTask);
      console.log(`任务 ${task.task_key} 已调度，cron表达式: ${task.cron_expression}`);
    } catch (error) {
      console.error(`调度任务 ${task.task_key} 失败:`, error);
    }
  }

  /**
   * 执行任务
   * @param task 任务信息
   * @param triggerType 触发类型
   * @param attempt 尝试次数
   * @returns 执行结果
   */
  private async executeTask(
    task: ScheduledTask, 
    triggerType: TriggerType,
    attempt: number = 1
  ): Promise<TaskExecutionResult> {
    // 记录开始时间
    const startTime = Date.now();
    const logs: string[] = [];
    
    // 创建执行历史记录
    const [historyId] = await db('infini_task_execution_histories').insert({
      task_id: task.id,
      task_key: task.task_key,
      status: ExecutionStatus.RUNNING,
      start_time: new Date(),
      trigger_type: triggerType,
      node_id: this.nodeId,
      attempt: attempt,
      created_at: new Date(),
      updated_at: new Date()
    });
    
    try {
      logs.push(`开始执行任务: ${task.task_name} (${task.task_key}), 触发类型: ${triggerType}, 尝试次数: ${attempt}`);
      
      // 尝试获取任务锁
      const lockAcquired = await this.lockManager.acquireLock(task.task_key);
      
      if (!lockAcquired) {
        logs.push(`任务 ${task.task_key} 无法获取锁，可能正在其他节点执行`);
        
        // 更新执行历史记录
        await db('infini_task_execution_histories')
          .where('id', historyId)
          .update({
            status: ExecutionStatus.CANCELED,
            end_time: new Date(),
            execution_time_ms: Date.now() - startTime,
            execution_log: logs.join('\n'),
            updated_at: new Date()
          });
        
        return {
          success: false,
          error: '无法获取任务锁，可能正在其他节点执行',
          executionTimeMs: Date.now() - startTime,
          logs
        };
      }
      
      try {
        // 解析处理器参数
        const handlerParams: TaskHandlerParams = JSON.parse(task.handler);
        
        logs.push(`处理器类型: ${handlerParams.type}`);
        
        // 根据处理器类型执行不同的处理逻辑
        let result: any;
        switch (handlerParams.type) {
          case HandlerType.FUNCTION:
            result = await this.executeFunctionHandler(handlerParams, logs);
            break;
            
          case HandlerType.HTTP:
            result = await this.executeHttpHandler(handlerParams, logs);
            break;
            
          case HandlerType.SERVICE:
            result = await this.executeServiceHandler(handlerParams, logs);
            break;
            
          default:
            throw new Error(`不支持的处理器类型: ${(handlerParams as any).type}`);
        }
        
        // 释放任务锁
        await this.lockManager.releaseLock(task.task_key);
        
        // 更新任务最后执行时间
        const interval = parser.parseExpression(task.cron_expression, { currentDate: new Date() });
        const nextExecutionTime = interval.next().toDate();
        
        await db('infini_scheduled_tasks')
          .where('id', task.id)
          .update({
            last_execution_time: new Date(),
            next_execution_time: nextExecutionTime,
            updated_at: new Date()
          });
        
        // 更新执行历史记录
        await db('infini_task_execution_histories')
          .where('id', historyId)
          .update({
            status: ExecutionStatus.SUCCESS,
            end_time: new Date(),
            execution_time_ms: Date.now() - startTime,
            execution_log: logs.join('\n'),
            updated_at: new Date()
          });
        
        logs.push(`任务执行成功，耗时: ${Date.now() - startTime}ms`);
        
        return {
          success: true,
          data: result,
          executionTimeMs: Date.now() - startTime,
          logs
        };
      } catch (error) {
        // 释放任务锁
        await this.lockManager.releaseLock(task.task_key);
        
        const errMsg = error instanceof Error ? error.message : String(error);
        logs.push(`任务执行失败: ${errMsg}`);
        
        // 检查是否需要重试
        if (attempt < task.retry_count + 1) {
          logs.push(`任务将在 ${task.retry_interval} 秒后重试 (${attempt}/${task.retry_count + 1})`);
          
          // 更新执行历史记录
          await db('infini_task_execution_histories')
            .where('id', historyId)
            .update({
              status: ExecutionStatus.FAILED,
              end_time: new Date(),
              execution_time_ms: Date.now() - startTime,
              error_message: errMsg,
              execution_log: logs.join('\n'),
              updated_at: new Date()
            });
          
          // 延迟重试
          await new Promise(resolve => setTimeout(resolve, task.retry_interval * 1000));
          
          // 重试执行
          return await this.executeTask(task, triggerType, attempt + 1);
        }
        
        // 更新执行历史记录
        await db('infini_task_execution_histories')
          .where('id', historyId)
          .update({
            status: ExecutionStatus.FAILED,
            end_time: new Date(),
            execution_time_ms: Date.now() - startTime,
            error_message: errMsg,
            execution_log: logs.join('\n'),
            updated_at: new Date()
          });
        
        return {
          success: false,
          error: errMsg,
          executionTimeMs: Date.now() - startTime,
          logs
        };
      }
    } catch (error) {
      // 确保锁被释放
      try {
        await this.lockManager.releaseLock(task.task_key);
      } catch (lockError) {
        console.error(`释放锁失败:`, lockError);
      }
      
      const errMsg = error instanceof Error ? error.message : String(error);
      logs.push(`任务执行过程中发生异常: ${errMsg}`);
      
      // 更新执行历史记录
      await db('infini_task_execution_histories')
        .where('id', historyId)
        .update({
          status: ExecutionStatus.FAILED,
          end_time: new Date(),
          execution_time_ms: Date.now() - startTime,
          error_message: errMsg,
          execution_log: logs.join('\n'),
          updated_at: new Date()
        });
      
      return {
        success: false,
        error: errMsg,
        executionTimeMs: Date.now() - startTime,
        logs
      };
    }
  }

  /**
   * 执行函数处理器
   * @param handlerParams 处理器参数
   * @param logs 日志数组
   * @returns 执行结果
   */
  private async executeFunctionHandler(handlerParams: any, logs: string[]): Promise<any> {
    const { functionName, params } = handlerParams;
    
    // 检查函数是否已注册
    if (!this.registeredHandlers.has(functionName)) {
      throw new Error(`函数 ${functionName} 未注册`);
    }
    
    logs.push(`执行函数: ${functionName}`);
    
    // 执行函数
    const handler = this.registeredHandlers.get(functionName);
    return await handler!(params);
  }

  /**
   * 执行HTTP处理器
   * @param handlerParams 处理器参数
   * @param logs 日志数组
   * @returns 执行结果
   */
  private async executeHttpHandler(handlerParams: any, logs: string[]): Promise<any> {
    const { method, url, headers, body, timeout } = handlerParams;
    
    logs.push(`执行HTTP请求: ${method} ${url}`);
    
    // 执行HTTP请求
    const response = await axios({
      method,
      url,
      headers,
      data: body,
      timeout: timeout || 30000
    });
    
    logs.push(`HTTP请求响应状态: ${response.status}`);
    
    return response.data;
  }

  /**
   * 执行服务处理器
   * @param handlerParams 处理器参数
   * @param logs 日志数组
   * @returns 执行结果
   */
  private async executeServiceHandler(handlerParams: any, logs: string[]): Promise<any> {
    const { serviceName, methodName, params } = handlerParams;
    
    logs.push(`执行服务方法: ${serviceName}.${methodName}`);
    
    // 这里可以根据serviceName查找对应的服务实例，然后调用其方法
    // 简单起见，这里仅实现了一个示例
    if (serviceName === 'taskService' && methodName === 'getNodeId') {
      return this.getNodeId();
    }
    
    throw new Error(`服务 ${serviceName} 的方法 ${methodName} 未实现`);
  }

  /**
   * 注册函数处理器
   * @param functionName 函数名
   * @param handler 处理函数
   */
  registerFunctionHandler(functionName: string, handler: Function): void {
    this.registeredHandlers.set(functionName, handler);
    console.log(`函数处理器已注册: ${functionName}`);
  }

  /**
   * 获取节点ID
   * @returns 节点ID
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * 停止所有任务
   */
  stopAllTasks(): void {
    for (const [taskKey, scheduledTask] of this.taskMap.entries()) {
      scheduledTask.stop();
      console.log(`任务 ${taskKey} 已停止`);
    }
    
    this.taskMap.clear();
    console.log('所有任务已停止');
  }

  /**
   * 获取任务执行历史
   * @param taskId 任务ID
   * @param limit 限制数量
   * @param offset 偏移量
   * @returns 任务执行历史记录
   */
  async getTaskExecutionHistory(
    taskId: number, 
    limit: number = 10, 
    offset: number = 0
  ): Promise<any[]> {
    return await db('infini_task_execution_histories')
      .where('task_id', taskId)
      .orderBy('id', 'desc')
      .limit(limit)
      .offset(offset)
      .select('*');
  }
}

export default TaskService;