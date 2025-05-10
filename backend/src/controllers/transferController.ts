/**
 * 账户转账模块控制器
 * 处理与账户转账相关的所有API请求
 */
import { Request, Response, NextFunction } from 'express';
import { Transfer, TransferStatus, ApiResponse, ControllerMethod } from '../types';

/**
 * 创建新的转账请求
 */
export const createTransfer: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceAccount, targetAccount, amount, memo } = req.body;
    
    // 验证请求参数
    if (!sourceAccount || !targetAccount || !amount) {
      const response: ApiResponse = {
        success: false,
        message: '缺少必要参数'
      };
      return res.status(400).json(response);
    }
    
    // 验证转账金额必须大于0
    if (amount <= 0) {
      const response: ApiResponse = {
        success: false,
        message: '转账金额必须大于0'
      };
      return res.status(400).json(response);
    }
    
    // 验证源账户和目标账户不能相同
    if (sourceAccount === targetAccount) {
      const response: ApiResponse = {
        success: false,
        message: '源账户和目标账户不能相同'
      };
      return res.status(400).json(response);
    }
    
    // 实际业务中需要验证账户是否存在，检查余额等
    // 这里仅做架构设计，返回模拟数据
    const transferRecord: Transfer = {
      id: `TRANSFER_${Date.now()}`,
      sourceAccount,
      targetAccount,
      amount,
      memo: memo || '',
      status: 'completed',
      timestamp: new Date().toLocaleString()
    };
    
    const response: ApiResponse<Transfer> = {
      success: true,
      data: transferRecord
    };
    
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 获取转账记录列表
 */
export const getTransfers: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { accountId, status } = req.query;
    
    // 实际业务中需要从数据库查询转账记录
    // 这里仅做架构设计，返回模拟数据
    const transfers: Transfer[] = [
      {
        id: 'TRANSFER_001',
        sourceAccount: 'ACC_001',
        targetAccount: 'ACC_002',
        amount: 5000.00,
        memo: '资金转移',
        status: 'completed',
        timestamp: '2025-05-06 15:30:22'
      },
      {
        id: 'TRANSFER_002',
        sourceAccount: 'ACC_003',
        targetAccount: 'ACC_001',
        amount: 1500.00,
        memo: '还款',
        status: 'completed',
        timestamp: '2025-05-05 10:15:43'
      },
      {
        id: 'TRANSFER_003',
        sourceAccount: 'ACC_002',
        targetAccount: 'ACC_004',
        amount: 3200.00,
        memo: '运营资金',
        status: 'pending',
        timestamp: '2025-05-06 16:45:12'
      }
    ];
    
    // 根据查询参数进行筛选
    let filteredTransfers = [...transfers];
    
    if (accountId) {
      const accId = accountId as string;
      filteredTransfers = filteredTransfers.filter(transfer => 
        transfer.sourceAccount === accId || transfer.targetAccount === accId
      );
    }
    
    if (status) {
      const statusStr = status as string;
      filteredTransfers = filteredTransfers.filter(transfer => 
        transfer.status === statusStr as TransferStatus
      );
    }
    
    const response: ApiResponse<Transfer[]> = {
      success: true,
      data: filteredTransfers
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 获取指定转账记录详情
 */
export const getTransferById: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // 实际业务中需要从数据库查询特定转账记录
    // 这里仅做架构设计，返回模拟数据
    const transfer: Transfer = {
      id: id,
      sourceAccount: 'ACC_001',
      targetAccount: 'ACC_002',
      amount: 5000.00,
      memo: '资金转移',
      status: 'completed',
      timestamp: '2025-05-06 15:30:22'
    };
    
    if (!transfer) {
      const response: ApiResponse = {
        success: false,
        message: '未找到指定转账记录'
      };
      return res.status(404).json(response);
    }
    
    const response: ApiResponse<Transfer> = {
      success: true,
      data: transfer
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};