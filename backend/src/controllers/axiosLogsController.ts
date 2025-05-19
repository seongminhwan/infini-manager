/**
 * Axios请求日志控制器
 * 用于提供API日志查询功能，支持按业务类型筛选
 */
import { Request, Response } from 'express';
import { AxiosLoggingService } from '../service/AxiosLoggingService';
import { ApiResponse } from '../types';

export const axiosLogsController = {
  /**
   * 获取API请求日志
   * 支持按时间、业务模块、业务操作类型等条件筛选，并提供分页功能
   */
  async getLogs(req: Request, res: Response) {
    try {
      const { 
        startDate,
        endDate,
        businessModule,
        businessOperation,
        url,
        method,
        statusCode,
        success,
        page = '1',
        pageSize = '50'
      } = req.query;
      
      // 处理筛选参数
      const options = {
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        businessModule: businessModule as string,
        businessOperation: businessOperation as string,
        url: url as string,
        method: method as string,
        statusCode: statusCode ? parseInt(statusCode as string, 10) : undefined,
        success: success !== undefined ? success === 'true' : undefined,
        page: parseInt(page as string, 10),
        pageSize: parseInt(pageSize as string, 10)
      };
      
      // 获取日志数据
      const result = await AxiosLoggingService.getRequestLogs(options);
      
      // 返回成功响应
      const response: ApiResponse = {
        success: true,
        data: result
      };
      
      res.json(response);
    } catch (error: any) {
      // 处理错误情况
      console.error('获取API日志失败:', error);
      
      const response: ApiResponse = {
        success: false,
        message: `获取API日志失败: ${error.message}`
      };
      
      res.status(500).json(response);
    }
  },
  
  /**
   * 获取所有业务模块列表（去重）
   */
  async getBusinessModules(req: Request, res: Response) {
    try {
      const modules = await AxiosLoggingService.getBusinessModules();
      
      const response: ApiResponse = {
        success: true,
        data: modules
      };
      
      res.json(response);
    } catch (error: any) {
      console.error('获取业务模块列表失败:', error);
      
      const response: ApiResponse = {
        success: false,
        message: `获取业务模块列表失败: ${error.message}`
      };
      
      res.status(500).json(response);
    }
  },
  
  /**
   * 获取业务操作类型列表（去重）
   * 如果指定了业务模块，则只获取该模块下的操作类型
   */
  async getBusinessOperations(req: Request, res: Response) {
    try {
      const { businessModule } = req.query;
      
      const operations = await AxiosLoggingService.getBusinessOperations(
        businessModule as string
      );
      
      const response: ApiResponse = {
        success: true,
        data: operations
      };
      
      res.json(response);
    } catch (error: any) {
      console.error('获取业务操作类型列表失败:', error);
      
      const response: ApiResponse = {
        success: false,
        message: `获取业务操作类型列表失败: ${error.message}`
      };
      
      res.status(500).json(response);
    }
  }
};