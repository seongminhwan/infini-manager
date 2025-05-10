/**
 * 账户注册模块控制器
 * 处理与账户注册相关的所有API请求
 */
import { Request, Response, NextFunction } from 'express';
import { RegisteredAccount, RegisterStatus, BatchRegistration, ApiResponse, ControllerMethod } from '../types';

/**
 * 注册新账户
 */
export const registerAccount: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountName, initialBalance, description } = req.body;
    
    // 验证请求参数
    if (!accountName || initialBalance === undefined) {
      const response: ApiResponse = {
        success: false,
        message: '缺少必要参数'
      };
      return res.status(400).json(response);
    }
    
    // 验证初始余额必须大于0
    if (initialBalance < 0) {
      const response: ApiResponse = {
        success: false,
        message: '初始余额不能为负数'
      };
      return res.status(400).json(response);
    }
    
    // 实际业务中需要调用数据库等创建账户
    // 这里仅做架构设计，返回模拟数据
    const registeredAccount: RegisteredAccount = {
      id: `ACC_${Date.now()}`,
      accountName,
      initialBalance,
      description: description || '',
      status: 'success',
      createdAt: new Date().toLocaleString()
    };
    
    const response: ApiResponse<RegisteredAccount> = {
      success: true,
      message: '账户注册成功',
      data: registeredAccount
    };
    
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 批量注册账户
 */
export const registerBatchAccounts: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 实际业务中需要处理上传的文件(CSV/Excel)
    // 这里仅做架构设计，返回模拟数据
    const batchRegistration: BatchRegistration = {
      batchId: `BATCH_${Date.now()}`,
      status: 'processing',
      totalAccounts: 100,
      processedAccounts: 0,
      successCount: 0,
      failedCount: 0
    };
    
    const response: ApiResponse<BatchRegistration> = {
      success: true,
      message: '批量注册任务已提交，正在处理中',
      data: batchRegistration
    };
    
    res.status(202).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 获取批量注册任务状态
 */
export const getBatchStatus: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batchId } = req.params;
    
    // 实际业务中需要从数据库查询批量注册任务状态
    // 这里仅做架构设计，返回模拟数据
    
    // 模拟任务未找到的情况
    if (batchId === 'not_exist') {
      const response: ApiResponse = {
        success: false,
        message: '找不到指定的批量注册任务'
      };
      return res.status(404).json(response);
    }
    
    const batchRegistration: BatchRegistration = {
      batchId,
      status: 'processing',
      totalAccounts: 100,
      processedAccounts: 65,
      successCount: 60,
      failedCount: 5
    };
    
    const response: ApiResponse<BatchRegistration> = {
      success: true,
      data: batchRegistration
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 获取注册记录列表
 */
export const getRegisteredAccounts: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, page = '1', limit = '10' } = req.query;
    
    // 转换分页参数
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    
    // 实际业务中需要从数据库查询注册记录
    // 这里仅做架构设计，返回模拟数据
    const registeredAccounts: RegisteredAccount[] = [
      {
        id: 'ACC_001',
        accountName: '运营账户A',
        initialBalance: 10000.00,
        status: 'success',
        createdAt: '2025-05-01 09:15:22'
      },
      {
        id: 'ACC_002',
        accountName: '测试账户B',
        initialBalance: 5000.00,
        description: '用于功能测试',
        status: 'success',
        createdAt: '2025-05-02 14:30:45'
      },
      {
        id: 'ACC_003',
        accountName: '预留账户C',
        initialBalance: 2000.00,
        status: 'pending',
        createdAt: '2025-05-06 16:20:10'
      }
    ];
    
    // 根据查询参数筛选
    let filteredAccounts = [...registeredAccounts];
    
    if (status) {
      filteredAccounts = filteredAccounts.filter(account => 
        account.status === status as RegisterStatus
      );
    }
    
    // 分页信息
    const pagination = {
      total: filteredAccounts.length,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(filteredAccounts.length / limitNum)
    };
    
    const response: ApiResponse<{accounts: RegisteredAccount[], pagination: any}> = {
      success: true,
      data: {
        accounts: filteredAccounts,
        pagination
      }
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 下载批量注册模板
 */
export const getRegisterTemplate: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 实际业务中应该生成Excel模板并返回
    // 这里仅做架构设计，模拟文件下载操作
    
    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=account_register_template.xlsx');
    
    // 发送示例响应(实际应该是Excel文件内容)
    res.send('This is a placeholder for the Excel template file content');
  } catch (error) {
    next(error);
  }
};