/**
 * 定时任务控制器
 */
import { Request, Response } from 'express';
import TaskService from '../service/TaskService';
import { TaskStatus, TaskDTO, HandlerType } from '../types/scheduledTask'; // 添加 HandlerType
import { ApiResponse } from '../types';
import { taskHandlers } from '../service/TaskHandlers';

// 创建任务服务实例
const taskService = new TaskService();

/**
 * 初始化任务服务
 */
export const initializeTaskService = async (): Promise<void> => {
  try {
    // 注册任务处理器
    console.log('注册任务处理器...');
    Object.entries(taskHandlers).forEach(([name, handler]) => {
      taskService.registerFunctionHandler(name, handler);
      console.log(`已注册处理器: ${name}`);
    });
    
    // 初始化任务服务
    await taskService.initialize();
    console.log('任务服务初始化成功');

    // 确保内置邮件同步任务存在
    const builtinTaskKey = 'BUILTIN_INCREMENTAL_EMAIL_SYNC';
    // 使用正确的 HandlerType.FUNCTION 结构
    const expectedHandler = JSON.stringify({
      type: HandlerType.FUNCTION,
      functionName: 'syncAllEmailsIncrementally',
      params: {}
    });
    const expectedCron = '*/5 * * * * *'; // 默认cron
    const taskDefaults = {
      task_name: '内置邮件增量同步',
      task_key: builtinTaskKey,
      cron_expression: expectedCron,
      handler: expectedHandler,
      status: TaskStatus.ENABLED, // 使用枚举成员初始化
      retry_count: 3,
      retry_interval: 60,
      description: '内置定时任务，每5秒调用一次增量同步接口，同步所有邮箱中的邮件内容。此任务不可删除。',
    };

    console.log(`[TaskInit] 检查内置任务: ${builtinTaskKey}`);
    const existingBuiltinTask = await db('infini_scheduled_tasks').where({ task_key: builtinTaskKey }).first();

    if (!existingBuiltinTask) {
      console.log(`[TaskInit] 内置任务 ${builtinTaskKey} 不存在，尝试创建...`);
      try {
        await db('infini_scheduled_tasks').insert(taskDefaults);
        console.log(`[TaskInit] 内置任务 ${builtinTaskKey} 插入完成。`);
        const newlyCreatedTask = await db('infini_scheduled_tasks').where({ task_key: builtinTaskKey }).first();
        if (newlyCreatedTask) {
          // 简化日志
          console.log(`[TaskInit] 内置任务 ${builtinTaskKey} 已成功创建/验证: ID=${newlyCreatedTask.id}, Status=${newlyCreatedTask.status}`);
        } else {
          console.error(`[TaskInit] 严重错误：内置任务 ${builtinTaskKey} 插入后未能查询到！`);
        }
      } catch (insertError) {
        console.error(`[TaskInit] 创建内置任务 ${builtinTaskKey} 失败:`, insertError);
        throw insertError;
      }
    } else {
      // 简化日志
      console.log(`[TaskInit] 内置任务 ${builtinTaskKey} 已存在: ID=${existingBuiltinTask.id}, Status=${existingBuiltinTask.status}, TaskName=${existingBuiltinTask.task_name}`);
      // 定义一个对象来收集需要更新的字段
      const updates: Partial<typeof taskDefaults & { updated_at: any }> = {};
      let needsUpdate = false;

      // 1. 如果状态是 'deleted'，则恢复为 'enabled'
      if (existingBuiltinTask.status === TaskStatus.DELETED) { // 使用枚举成员进行比较
        updates.status = TaskStatus.ENABLED; // 使用枚举成员进行赋值
        console.log(`[TaskInit] 内置任务 ${builtinTaskKey} 状态为 'deleted'，将恢复为 'enabled'。`);
        needsUpdate = true;
      }

      // 2. 确保 handler 是正确的 (因为 handler 不允许用户修改)
      if (existingBuiltinTask.handler !== expectedHandler) {
        updates.handler = expectedHandler;
        console.log(`[TaskInit] 内置任务 ${builtinTaskKey} handler 不正确，将恢复为预设值。`);
        needsUpdate = true;
      }
      
      // 3. 确保 task_name 是正确的 (因为 task_name 不允许用户修改)
      if (existingBuiltinTask.task_name !== taskDefaults.task_name) {
        updates.task_name = taskDefaults.task_name;
        console.log(`[TaskInit] 内置任务 ${builtinTaskKey} task_name 不正确，将恢复为预设值。`);
        needsUpdate = true;
      }

      // 4. 确保 description 是正确的 (如果描述也视为核心属性)
      //    或者，如果description允许用户修改，则不应在此处强制更新，除非是从deleted状态恢复。
      //    当前需求是“其他的均不可修改”，但cron和status可以。description未明确。暂时不强制更新description。
      // if (existingBuiltinTask.description !== taskDefaults.description) {
      //   updates.description = taskDefaults.description;
      //   console.log(`[TaskInit] 内置任务 ${builtinTaskKey} description 不正确，将恢复为预设值。`);
      //   needsUpdate = true;
      // }


      if (needsUpdate) {
        updates.updated_at = new Date(); // 使用 new Date() 代替 db.fn.now()
        console.log(`[TaskInit] 内置任务 ${builtinTaskKey} 需要更新，更新内容 (部分): status=${updates.status}, handler=${updates.handler ? 'changed' : 'unchanged'}, task_name=${updates.task_name || 'unchanged'}`);
        try {
          await db('infini_scheduled_tasks').where({ id: existingBuiltinTask.id }).update(updates);
          const updatedTask = await db('infini_scheduled_tasks').where({ id: existingBuiltinTask.id }).first();
          // 简化日志，避免循环引用问题，只记录关键信息
          if (updatedTask) {
            console.log(`[TaskInit] 内置任务 ${builtinTaskKey} 更新完成: ID=${updatedTask.id}, Status=${updatedTask.status}, TaskName=${updatedTask.task_name}`);
          } else {
            console.error(`[TaskInit] 严重错误：内置任务 ${builtinTaskKey} 更新后未能查询到！`);
          }
        } catch (updateError) {
          console.error(`[TaskInit] 更新内置任务 ${builtinTaskKey} 失败:`, updateError);
          throw updateError;
        }
      } else {
        console.log(`[TaskInit] 内置任务 ${builtinTaskKey} 状态、handler 和 task_name 正确，无需更新。`);
      }
    }
  } catch (error) {
    console.error('任务服务初始化或内置任务检查/创建/更新过程中发生错误:', error);
  }
};

/**
 * 注册函数处理器
 * @param functionName 函数名
 * @param handler 处理函数
 */
export const registerTaskHandler = (functionName: string, handler: Function): void => {
  taskService.registerFunctionHandler(functionName, handler);
};

/**
 * 获取任务列表
 * @param req 请求对象
 * @param res 响应对象
 */
export const getTaskList = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, page = '1', limit = '10' } = req.query;
    
    // 创建查询构建器
    const query = status ? 
      db('infini_scheduled_tasks').where('status', status as string) : 
      db('infini_scheduled_tasks').whereNot('status', TaskStatus.DELETED);
    
    // 获取总数
    const countResult = await query.clone().count('id as count').first();
    const total = countResult ? (countResult as any).count : 0;
    
    // 分页查询
    const pageNum = parseInt(page as string, 10);
    const pageSize = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * pageSize;
    
    const tasks = await query
      .orderBy('id', 'desc')
      .limit(pageSize)
      .offset(offset)
      .select('*');
    
    // 处理任务数据
    const processedTasks = tasks.map(task => ({
      ...task,
      handler: JSON.parse(task.handler)
    }));
    
    // 构造响应
    const response: ApiResponse = {
      success: true,
      data: {
        tasks: processedTasks,
        pagination: {
          total,
          page: pageNum,
          limit: pageSize,
          pages: Math.ceil(total / pageSize)
        }
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('获取任务列表失败:', error);
    
    const response: ApiResponse = {
      success: false,
      message: `获取任务列表失败: ${(error as Error).message}`
    };
    
    res.status(500).json(response);
  }
};

/**
 * 获取任务详情
 * @param req 请求对象
 * @param res 响应对象
 */
export const getTaskDetail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    
    // 获取任务信息
    const task = await db('infini_scheduled_tasks')
      .where('id', taskId)
      .first();
    
    if (!task) {
      const response: ApiResponse = {
        success: false,
        message: `任务ID ${taskId} 不存在`
      };
      
      res.status(404).json(response);
      return;
    }
    
    // 获取任务执行历史
    const histories = await taskService.getTaskExecutionHistory(parseInt(taskId, 10), 5);
    
    // 处理任务数据
    const processedTask = {
      ...task,
      handler: JSON.parse(task.handler),
      histories
    };
    
    // 构造响应
    const response: ApiResponse = {
      success: true,
      data: processedTask
    };
    
    res.json(response);
  } catch (error) {
    console.error('获取任务详情失败:', error);
    
    const response: ApiResponse = {
      success: false,
      message: `获取任务详情失败: ${(error as Error).message}`
    };
    
    res.status(500).json(response);
  }
};

/**
 * 创建任务
 * @param req 请求对象
 * @param res 响应对象
 */
export const createTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const taskDTO: TaskDTO = req.body;
    
    // 验证请求数据
    if (!taskDTO.taskName || !taskDTO.taskKey || !taskDTO.cronExpression || !taskDTO.handler) {
      const response: ApiResponse = {
        success: false,
        message: '缺少必要的任务参数: taskName, taskKey, cronExpression, handler 为必填项'
      };
      
      res.status(400).json(response);
      return;
    }
    
    // 创建任务
    const taskId = await taskService.createTask(taskDTO);
    
    // 构造响应
    const response: ApiResponse = {
      success: true,
      data: { taskId },
      message: '任务创建成功'
    };
    
    res.json(response);
  } catch (error) {
    console.error('创建任务失败:', error);
    
    const response: ApiResponse = {
      success: false,
      message: `创建任务失败: ${(error as Error).message}`
    };
    
    res.status(500).json(response);
  }
};

/**
 * 更新任务
 * @param req 请求对象
 * @param res 响应对象
 */
export const updateTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const taskDTO: Partial<TaskDTO> = req.body;
    
    // 检查任务是否存在
    const existingTask = await db('infini_scheduled_tasks')
      .where('id', taskId)
      .first();
    
    if (!existingTask) {
      const response: ApiResponse = {
        success: false,
        message: `任务ID ${taskId} 不存在`
      };
      
      res.status(404).json(response);
      return;
    }

    // 如果是内置任务，则限制可修改的字段
    if (existingTask.task_key && existingTask.task_key.startsWith('BUILTIN_')) {
      const forbiddenUpdates = ['task_key', 'handler', 'task_name'];
      const updates = Object.keys(taskDTO);
      const forbiddenUpdateAttempt = updates.find(key => forbiddenUpdates.includes(key));

      if (forbiddenUpdateAttempt) {
        const response: ApiResponse = {
          success: false,
          message: `内置任务 (task_key: ${existingTask.task_key}) 的 '${forbiddenUpdateAttempt}' 字段不允许修改。只允许修改 cron_expression, status, retry_count, retry_interval, description。`
        };
        res.status(403).json(response);
        return;
      }
    }
    
    // 更新任务
    await taskService.updateTask(parseInt(taskId, 10), taskDTO);
    
    // 构造响应
    const response: ApiResponse = {
      success: true,
      message: '任务更新成功'
    };
    
    res.json(response);
  } catch (error) {
    console.error('更新任务失败:', error);
    
    const response: ApiResponse = {
      success: false,
      message: `更新任务失败: ${(error as Error).message}`
    };
    
    res.status(500).json(response);
  }
};

/**
 * 删除任务
 * @param req 请求对象
 * @param res 响应对象
 */
export const deleteTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;

    // 检查是否为内置任务
    const taskToDelete = await db('infini_scheduled_tasks').where({ id: taskId }).first();
    if (taskToDelete && taskToDelete.task_key && taskToDelete.task_key.startsWith('BUILTIN_')) {
      const response: ApiResponse = {
        success: false,
        message: `内置任务 (task_key: ${taskToDelete.task_key}) 不允许删除。`
      };
      res.status(403).json(response); // 403 Forbidden
      return;
    }
    
    // 删除任务
    await taskService.deleteTask(parseInt(taskId, 10));
    
    // 构造响应
    const response: ApiResponse = {
      success: true,
      message: '任务删除成功'
    };
    
    res.json(response);
  } catch (error) {
    console.error('删除任务失败:', error);
    
    const response: ApiResponse = {
      success: false,
      message: `删除任务失败: ${(error as Error).message}`
    };
    
    res.status(500).json(response);
  }
};

/**
 * 手动触发任务
 * @param req 请求对象
 * @param res 响应对象
 */
export const triggerTask = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    
    // 触发任务
    const result = await taskService.triggerTask(parseInt(taskId, 10));
    
    // 构造响应
    const response: ApiResponse = {
      success: result.success,
      data: result,
      message: result.success ? '任务触发成功' : `任务触发失败: ${result.error}`
    };
    
    res.json(response);
  } catch (error) {
    console.error('触发任务失败:', error);
    
    const response: ApiResponse = {
      success: false,
      message: `触发任务失败: ${(error as Error).message}`
    };
    
    res.status(500).json(response);
  }
};

/**
 * 获取任务执行历史
 * @param req 请求对象
 * @param res 响应对象
 */
export const getTaskHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { taskId } = req.params;
    const { page = '1', limit = '10' } = req.query;
    
    // 分页参数
    const pageNum = parseInt(page as string, 10);
    const pageSize = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * pageSize;
    
    // 获取历史记录
    const histories = await taskService.getTaskExecutionHistory(
      parseInt(taskId, 10),
      pageSize,
      offset
    );
    
    // 获取总数
    const countResult = await db('infini_task_execution_histories')
      .where('task_id', taskId)
      .count('id as count')
      .first();
    
    const total = countResult ? (countResult as any).count : 0;
    
    // 构造响应
    const response: ApiResponse = {
      success: true,
      data: {
        histories,
        pagination: {
          total,
          page: pageNum,
          limit: pageSize,
          pages: Math.ceil(total / pageSize)
        }
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('获取任务执行历史失败:', error);
    
    const response: ApiResponse = {
      success: false,
      message: `获取任务执行历史失败: ${(error as Error).message}`
    };
    
    res.status(500).json(response);
  }
};

// 导入数据库
import db from '../db/db';

export default {
  initializeTaskService,
  registerTaskHandler,
  getTaskList,
  getTaskDetail,
  createTask,
  updateTask,
  deleteTask,
  triggerTask,
  getTaskHistory,
  
  /**
   * 更新任务配置
   * @param req 请求对象
   * @param res 响应对象
   */
  updateTaskConfig: async (req: Request, res: Response): Promise<void> => {
    try {
      const { taskId } = req.params;
      const { handlerParams } = req.body;
      
      // 检查任务是否存在
      const existingTask = await db('infini_scheduled_tasks')
        .where('id', taskId)
        .first();
      
      if (!existingTask) {
        const response: ApiResponse = {
          success: false,
          message: `任务ID ${taskId} 不存在`
        };
        
        res.status(404).json(response);
        return;
      }

      // 解析当前处理器配置
      let handler;
      try {
        handler = JSON.parse(existingTask.handler);
      } catch (error) {
        const response: ApiResponse = {
          success: false,
          message: `解析任务处理器配置失败: ${(error as Error).message}`
        };
        
        res.status(500).json(response);
        return;
      }
      
      // 更新处理器参数
      if (handlerParams) {
        if (handler.type === 'function') {
          // 合并现有参数和新参数
          handler.params = { ...handler.params, ...handlerParams };
        } else if (handler.type === 'http') {
          // 对于HTTP处理器，更新body中的参数
          handler.body = { ...handler.body, ...handlerParams };
        } else if (handler.type === 'service') {
          // 对于服务处理器，更新params中的参数
          handler.params = { ...handler.params, ...handlerParams };
        }
      }
      
      // 更新任务处理器
      const updatedHandler = JSON.stringify(handler);
      
      await db('infini_scheduled_tasks')
        .where('id', taskId)
        .update({
          handler: updatedHandler,
          updated_at: new Date()
        });
      
      // 如果任务启用，则重新调度
      if (existingTask.status === TaskStatus.ENABLED) {
        // 获取更新后的任务
        const updatedTask = await db('infini_scheduled_tasks')
          .where('id', taskId)
          .first();
        
        if (updatedTask) {
          // 重新调度任务
          await taskService.updateTask(parseInt(taskId, 10), {
            handler: handler
          });
        }
      }
      
      // 构造响应
      const response: ApiResponse = {
        success: true,
        message: '任务配置更新成功'
      };
      
      res.json(response);
    } catch (error) {
      console.error('更新任务配置失败:', error);
      
      const response: ApiResponse = {
        success: false,
        message: `更新任务配置失败: ${(error as Error).message}`
      };
      
      res.status(500).json(response);
    }
  }
}