/**
 * 定时任务控制器
 */
import { Request, Response } from 'express';
import TaskService from '../service/TaskService';
import { TaskStatus, TaskDTO } from '../types/scheduledTask';
import { ApiResponse } from '../types';

// 创建任务服务实例
const taskService = new TaskService();

/**
 * 初始化任务服务
 */
export const initializeTaskService = async (): Promise<void> => {
  try {
    await taskService.initialize();
    console.log('任务服务初始化成功');
  } catch (error) {
    console.error('任务服务初始化失败:', error);
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
  getTaskHistory
};