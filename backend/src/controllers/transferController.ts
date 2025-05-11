/**
 * 账户转账模块控制器
 * 处理与账户转账相关的所有API请求
 */
import { Request, Response, NextFunction } from 'express';
import { Transfer, TransferStatus, ApiResponse, ControllerMethod } from '../types';
import { InfiniAccountService } from '../service/InfiniAccountService';

// 创建InfiniAccountService实例
const infiniAccountService = new InfiniAccountService();

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
 * 执行Infini内部转账
 * 支持内部账户ID或外部用户UID/Email作为目标
 */
export const executeInternalTransfer: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      accountId,        // 源账户ID（必填）
      contactType,      // 联系人类型：uid或email（必填）
      targetIdentifier, // 目标标识符：UID、Email或内部账户ID（必填）
      amount,           // 转账金额，字符串格式（必填）
      source,           // 来源（必填）
      isForced,         // 是否强制执行（可选，默认false）
      remarks,          // 备注信息（可选）
      auto2FA,          // 是否自动处理2FA验证（可选，默认false）
      verificationCode  // 2FA验证码（可选）
    } = req.body;

    // 验证必填参数
    if (!accountId || !contactType || !targetIdentifier || !amount || !source) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }

    // 验证contactType必须是uid或email
    if (contactType !== 'uid' && contactType !== 'email') {
      return res.status(400).json({
        success: false,
        message: 'contactType参数必须是"uid"或"email"'
      });
    }

    // 调用服务执行内部转账
    const response = await infiniAccountService.internalTransfer(
      accountId,
      contactType as 'uid' | 'email',
      targetIdentifier,
      amount.toString(), // 确保金额是字符串格式
      source,
      !!isForced,        // 转换为布尔值
      remarks,
      !!auto2FA,          // 转换为布尔值，添加auto2FA参数
      verificationCode
    );

    res.json(response);
  } catch (error) {
    next(error);
  }
};

// 移除了autoGet2FAAndCompleteTransfer和continueTransferWith2FA方法
// 现在只使用executeInternalTransfer方法处理所有转账场景，包括2FA验证

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

/**
 * 获取转账历史记录
 * 返回指定转账ID的完整历史记录，包括状态变化和详细信息
 */
export const getTransferHistory: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: '缺少转账ID参数'
      });
    }
    
    // 调用服务获取转账历史记录
    const response = await infiniAccountService.getTransferHistory(id);
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};