/**
 * 账户监控模块控制器
 * 处理与账户监控相关的所有API请求
 */
import { Request, Response, NextFunction } from 'express';
import { Account, AccountStatus, ApiResponse, ControllerMethod } from '../types';

/**
 * 获取所有账户列表
 */
export const getAllAccounts: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 获取查询参数
    const { status, search } = req.query;
    
    // 实际业务中需要从数据库查询账户数据
    // 这里仅做架构设计，返回模拟数据
    const accounts: Account[] = [
      {
        id: 'ACC_001',
        name: '主要账户A',
        balance: 53689.42,
        status: 'active',
        lastUpdate: '2025-05-06 14:23:10',
      },
      {
        id: 'ACC_002',
        name: '备用账户B',
        balance: 28734.15,
        status: 'active',
        lastUpdate: '2025-05-06 12:45:22',
      },
      {
        id: 'ACC_003',
        name: '测试账户C',
        balance: 5423.89,
        status: 'inactive',
        lastUpdate: '2025-05-05 08:12:45',
      },
    ];
    
    // 根据查询参数进行筛选
    let filteredAccounts = [...accounts];
    
    if (status) {
      const statusStr = status as string;
      filteredAccounts = filteredAccounts.filter(account => account.status === statusStr as AccountStatus);
    }
    
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredAccounts = filteredAccounts.filter(account => 
        account.id.toLowerCase().includes(searchLower) || 
        account.name.toLowerCase().includes(searchLower)
      );
    }
    
    const response: ApiResponse<Account[]> = {
      success: true,
      data: filteredAccounts,
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 获取指定账户详情
 */
export const getAccountById: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // 实际业务中需要从数据库查询特定账户
    // 这里仅做架构设计，返回模拟数据
    const account: Account = {
      id: id,
      name: '主要账户A',
      balance: 53689.42,
      status: 'active',
      lastUpdate: '2025-05-06 14:23:10',
    };
    
    if (!account) {
      const response: ApiResponse = {
        success: false,
        message: '未找到指定账户',
      };
      return res.status(404).json(response);
    }
    
    const response: ApiResponse<Account> = {
      success: true,
      data: account,
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 获取指定账户余额
 */
export const getAccountBalance: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // 实际业务中需要从数据库查询特定账户余额
    // 这里仅做架构设计，返回模拟数据
    const balance = 53689.42;
    
    const response: ApiResponse<{ id: string; balance: number }> = {
      success: true,
      data: {
        id: id,
        balance: balance,
      },
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 获取指定账户状态
 */
export const getAccountStatus: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // 实际业务中需要从数据库查询特定账户状态
    // 这里仅做架构设计，返回模拟数据
    const status: AccountStatus = 'active';
    
    const response: ApiResponse<{ id: string; status: AccountStatus }> = {
      success: true,
      data: {
        id: id,
        status: status,
      },
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};