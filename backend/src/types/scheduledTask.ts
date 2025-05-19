/**
 * 定时任务类型定义
 */

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  ENABLED = 'enabled',
  DISABLED = 'disabled',
  DELETED = 'deleted'
}

/**
 * 执行状态枚举
 */
export enum ExecutionStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  RUNNING = 'running',
  CANCELED = 'canceled'
}

/**
 * 锁状态枚举
 */
export enum LockStatus {
  ACQUIRED = 'acquired',
  RELEASED = 'released'
}

/**
 * 触发类型枚举
 */
export enum TriggerType {
  SCHEDULED = 'scheduled',
  MANUAL = 'manual'
}

/**
 * 处理器类型枚举
 */
export enum HandlerType {
  FUNCTION = 'function',  // 直接函数调用
  HTTP = 'http',          // HTTP请求
  SERVICE = 'service'     // 服务方法调用
}

/**
 * 函数处理器参数
 */
export interface FunctionHandlerParams {
  type: HandlerType.FUNCTION;
  functionName: string;
  params?: Record<string, any>;
}

/**
 * HTTP处理器参数
 */
export interface HttpHandlerParams {
  type: HandlerType.HTTP;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: Record<string, any>;
  timeout?: number;
}

/**
 * 服务处理器参数
 */
export interface ServiceHandlerParams {
  type: HandlerType.SERVICE;
  serviceName: string;
  methodName: string;
  params?: Record<string, any>;
}

/**
 * 任务处理器参数联合类型
 */
export type TaskHandlerParams = FunctionHandlerParams | HttpHandlerParams | ServiceHandlerParams;

/**
 * 定时任务数据库实体
 */
export interface ScheduledTask {
  id: number;
  task_name: string;
  task_key: string;
  cron_expression: string;
  handler: string; // JSON字符串，包含处理器类型和参数
  status: TaskStatus;
  retry_count: number;
  retry_interval: number;
  description?: string;
  last_execution_time?: Date;
  next_execution_time?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * 任务执行历史数据库实体
 */
export interface TaskExecutionHistory {
  id: number;
  task_id: number;
  task_key: string;
  status: ExecutionStatus;
  start_time: Date;
  end_time?: Date;
  execution_time_ms?: number;
  trigger_type: TriggerType;
  node_id?: string;
  error_message?: string;
  execution_log?: string;
  attempt: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * 任务锁数据库实体
 */
export interface TaskLock {
  id: number;
  task_key: string;
  node_id: string;
  lock_status: LockStatus;
  lock_time: Date;
  release_time?: Date;
  expires_at: Date;
  context?: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * 任务创建/更新DTO
 */
export interface TaskDTO {
  taskName: string;
  taskKey: string;
  cronExpression: string;
  handler: TaskHandlerParams;
  status: TaskStatus;
  retryCount?: number;
  retryInterval?: number;
  description?: string;
}

/**
 * 任务执行结果
 */
export interface TaskExecutionResult {
  success: boolean;
  data?: any;
  error?: Error | string;
  executionTimeMs: number;
  logs?: string[];
}

/**
 * 任务事件类型
 */
export enum TaskEventType {
  SCHEDULED = 'task.scheduled',
  STARTED = 'task.started',
  COMPLETED = 'task.completed',
  FAILED = 'task.failed',
  RETRY = 'task.retry',
  LOCKED = 'task.locked',
  UNLOCKED = 'task.unlocked'
}

/**
 * 任务事件数据
 */
export interface TaskEvent {
  type: TaskEventType;
  taskId: number;
  taskKey: string;
  timestamp: Date;
  data?: any;
}