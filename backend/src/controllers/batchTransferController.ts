/**
 * 批量转账模块控制器
 * 处理与批量转账相关的所有API请求
 */
import { Response, NextFunction } from 'express';
import { Request } from 'express';
// 导入Express命名空间以便使用类型断言
import { Express } from 'express';
import { ApiResponse, ControllerMethod } from '../types';
import db from '../db/db';

// 导入BatchTransferService
import { BatchTransferService } from '../service/BatchTransferService';

// 创建BatchTransferService实例
const batchTransferService = new BatchTransferService();

/**
 * 创建批量转账任务
 */
export const createBatchTransfer: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      name,                  // 批量转账名称
      type,                  // 转账类型：one_to_many或many_to_one
      sourceAccountId,       // 源账户ID（一对多模式）
      targetAccountId,       // 目标账户ID（多对一模式）
      relations,             // 转账关系数组
      remarks                // 备注信息
    } = req.body;
    
    // 验证请求参数
    if (!name || !type || !relations || !Array.isArray(relations) || relations.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数或参数格式不正确'
      });
    }
    
    // 验证转账类型
    if (!['one_to_many', 'many_to_one'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: '转账类型必须是"one_to_many"或"many_to_one"'
      });
    }
    
    // 验证一对多模式必须提供源账户ID
    if (type === 'one_to_many' && !sourceAccountId) {
      return res.status(400).json({
        success: false,
        message: '一对多模式必须提供源账户ID'
      });
    }
    
    // 验证多对一模式必须提供目标账户ID
    if (type === 'many_to_one' && !targetAccountId) {
      return res.status(400).json({
        success: false,
        message: '多对一模式必须提供目标账户ID'
      });
    }

    // 调用服务创建批量转账
    const response = await batchTransferService.createBatchTransfer({
      name,
      type,
      sourceAccountId,
      targetAccountId,
      relations,
      remarks,
      // 使用完全类型断言绕过TypeScript类型检查
      createdBy: ((req as any).user?.id) || null
    });
    
    if (response.success) {
      res.status(201).json(response);
    } else {
      res.status(400).json(response);
    }
  } catch (error) {
    next(error);
  }
};

/**
 * 获取批量转账列表
 */
export const getBatchTransfers: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      page = '1', 
      pageSize = '20',
      status,
      type
    } = req.query;
    
    // 获取页码和每页条数
    const pageNum = parseInt(page as string, 10) || 1;
    const pageSizeNum = parseInt(pageSize as string, 10) || 20;
    
    // 构建查询
    let query = db('infini_batch_transfers')
      .select('*')
      .orderBy('created_at', 'desc');
    
    // 应用筛选条件
    if (status) {
      query = query.where('status', status);
    }
    
    if (type) {
      query = query.where('type', type);
    }
    
    // 获取总记录数
    const countQuery = query.clone().clearSelect().clearOrder().count('id as total').first();
    const countResult = await countQuery;
    const total = (countResult as any).total;
    
    // 应用分页
    const offset = (pageNum - 1) * pageSizeNum;
    query = query.limit(pageSizeNum).offset(offset);
    
    // 执行查询
    const batchTransfers = await query;
    
    res.json({
      success: true,
      data: {
        batchTransfers,
        pagination: {
          total,
          page: pageNum,
          pageSize: pageSizeNum,
          totalPages: Math.ceil(total / pageSizeNum)
        }
      },
      message: '成功获取批量转账列表'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取批量转账详情
 */
export const getBatchTransferById: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // 查询批量转账记录
    const batchTransfer = await db('infini_batch_transfers')
      .where('id', id)
      .first();
    
    if (!batchTransfer) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的批量转账'
      });
    }
    
    // 查询关联的转账关系
    const relations = await db('infini_batch_transfer_relations')
      .where('batch_id', id)
      .orderBy('id', 'asc');
    
    res.json({
      success: true,
      data: {
        batchTransfer,
        relations
      },
      message: '成功获取批量转账详情'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 执行批量转账
 */
export const executeBatchTransfer: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { auto2FA = false } = req.body;
    
    // 查询批量转账记录
    const batchTransfer = await db('infini_batch_transfers')
      .where('id', id)
      .first();
    
    if (!batchTransfer) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的批量转账'
      });
    }
    
    // 只允许执行pending状态的批量转账
    if (batchTransfer.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `批量转账当前状态为${batchTransfer.status}，只能执行pending状态的批量转账`
      });
    }
    
    // 立即返回响应，后台继续处理
    res.json({
      success: true,
      message: '批量转账已开始',
      data: { batchId: id }
    });
    
    // 后台异步执行批量转账
    batchTransferService.executeBatchTransfer(parseInt(id), auto2FA)
      .catch((error: Error) => {
        console.error('批量转账执行失败:', error);
        // 更新批量转账状态为failed
        db('infini_batch_transfers')
          .where('id', id)
          .update({
            status: 'failed',
            completed_at: new Date(),
            updated_at: new Date()
          })
          .catch(err => console.error('更新批量转账状态失败:', err));
      });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取批量转账历史记录
 */
export const getBatchTransferHistory: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // 查询批量转账记录
    const batchTransfer = await db('infini_batch_transfers')
      .where('id', id)
      .first();
    
    if (!batchTransfer) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的批量转账'
      });
    }
    
    // 查询历史记录
    const histories = await db('infini_batch_transfer_histories')
      .where('batch_id', id)
      .orderBy('created_at', 'desc');
    
    res.json({
      success: true,
      data: {
        batchTransfer,
        histories
      },
      message: '成功获取批量转账历史记录'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取批量转账进度
 */
export const getBatchTransferProgress: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // 查询批量转账记录
    const batchTransfer = await db('infini_batch_transfers')
      .where('id', id)
      .first();
    
    if (!batchTransfer) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的批量转账'
      });
    }
    
    // 查询转账关系统计信息
    const totalCount = await db('infini_batch_transfer_relations')
      .where('batch_id', id)
      .count('id as count')
      .first()
      .then(result => (result as any).count);
    
    const successCount = await db('infini_batch_transfer_relations')
      .where('batch_id', id)
      .where('status', 'completed')
      .count('id as count')
      .first()
      .then(result => (result as any).count);
    
    const failedCount = await db('infini_batch_transfer_relations')
      .where('batch_id', id)
      .where('status', 'failed')
      .count('id as count')
      .first()
      .then(result => (result as any).count);
    
    const pendingCount = await db('infini_batch_transfer_relations')
      .where('batch_id', id)
      .whereIn('status', ['pending', 'processing'])
      .count('id as count')
      .first()
      .then(result => (result as any).count);
    
    // 计算进度百分比
    const progress = totalCount > 0 ? Math.floor((successCount + failedCount) / totalCount * 100) : 0;
    
    // 获取最近处理的转账关系
    const recentTransfers = await db('infini_batch_transfer_relations')
      .where('batch_id', id)
      .whereIn('status', ['completed', 'failed'])
      .orderBy('updated_at', 'desc')
      .limit(10);
    
    res.json({
      success: true,
      data: {
        batchTransfer,
        progress,
        totalCount,
        successCount,
        failedCount,
        pendingCount,
        recentTransfers
      },
      message: '成功获取批量转账进度'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 重试失败的转账关系
 */
export const retryTransferRelation: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batchId, relationId } = req.params;
    const { auto2FA = false } = req.body;
    
    // 查找关系记录
    const relation = await db('infini_batch_transfer_relations')
      .where('id', relationId)
      .where('batch_id', batchId)
      .first();
    
    if (!relation) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的转账关系'
      });
    }
    
    // 只允许重试失败的转账
    if (relation.status !== 'failed') {
      return res.status(400).json({
        success: false,
        message: '只能重试失败的转账'
      });
    }
    
    // 更新状态为pending
    await db('infini_batch_transfer_relations')
      .where('id', relationId)
      .update({
        status: 'pending',
        error_message: null,
        updated_at: new Date()
      });
    
    // 添加历史记录
    await db('infini_batch_transfer_histories').insert({
      batch_id: batchId,
      relation_id: relationId,
      status: 'pending',
      message: '重试转账',
      created_at: new Date()
    });
    
    // 立即返回响应，后台继续处理
    res.json({
      success: true,
      message: '转账重试已开始',
      data: { relationId }
    });
    
    // 异步执行转账
    batchTransferService.processTransferRelation(parseInt(relationId), auto2FA)
      .catch((error: Error) => {
        console.error('重试转账失败:', error);
      });
  } catch (error) {
    next(error);
  }
};

/**
 * 批量重试失败的转账
 */
export const retryFailedTransfers: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { auto2FA = false } = req.body;
    
    // 查找所有失败的转账关系
    const failedRelations = await db('infini_batch_transfer_relations')
      .where('batch_id', id)
      .where('status', 'failed')
      .select('id');
    
    if (failedRelations.length === 0) {
      return res.json({
        success: true,
        message: '没有失败的转账需要重试',
        data: { count: 0 }
      });
    }
    
    // 更新所有失败的转账状态为pending
    await db('infini_batch_transfer_relations')
      .where('batch_id', id)
      .where('status', 'failed')
      .update({
        status: 'pending',
        error_message: null,
        updated_at: new Date()
      });
    
    // 添加历史记录
    await db('infini_batch_transfer_histories').insert({
      batch_id: id,
      status: 'processing',
      message: `重试${failedRelations.length}个失败的转账`,
      created_at: new Date()
    });
    
    // 更新批量转账状态为processing
    await db('infini_batch_transfers')
      .where('id', id)
      .update({
        status: 'processing',
        completed_at: null,
        updated_at: new Date()
      });
    
    // 立即返回响应，后台继续处理
    res.json({
      success: true,
      message: '批量重试已开始',
      data: { count: failedRelations.length }
    });
    
    // 异步执行批量转账
    batchTransferService.resumeBatchTransfer(parseInt(id), auto2FA)
      .catch((error: Error) => {
        console.error('批量重试失败:', error);
      });
  } catch (error) {
    next(error);
  }
};

/**
 * 恢复未完成的批量转账
 */
export const resumeBatchTransfer: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { auto2FA = false } = req.body;
    
    // 查找批量转账记录
    const batch = await db('infini_batch_transfers')
      .where('id', id)
      .first();
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的批量转账'
      });
    }
    
    // 只允许恢复pending或processing状态的批量转账
    if (!['pending', 'processing'].includes(batch.status)) {
      return res.status(400).json({
        success: false,
        message: '只能恢复等待中或处理中的批量转账'
      });
    }
    
    // 查找所有未完成的转账关系
    const pendingRelations = await db('infini_batch_transfer_relations')
      .where('batch_id', id)
      .whereIn('status', ['pending', 'processing'])
      .select('id');
    
    if (pendingRelations.length === 0) {
      return res.json({
        success: true,
        message: '没有未完成的转账需要恢复',
        data: { count: 0 }
      });
    }
    
    // 更新所有processing状态的转账为pending
    await db('infini_batch_transfer_relations')
      .where('batch_id', id)
      .where('status', 'processing')
      .update({
        status: 'pending',
        updated_at: new Date()
      });
    
    // 添加历史记录
    await db('infini_batch_transfer_histories').insert({
      batch_id: id,
      status: 'processing',
      message: `恢复${pendingRelations.length}个未完成的转账`,
      created_at: new Date()
    });
    
    // 更新批量转账状态为processing
    await db('infini_batch_transfers')
      .where('id', id)
      .update({
        status: 'processing',
        completed_at: null,
        updated_at: new Date()
      });
    
    // 立即返回响应，后台继续处理
    res.json({
      success: true,
      message: '批量转账已恢复',
      data: { count: pendingRelations.length }
    });
    
    // 异步执行批量转账
    batchTransferService.resumeBatchTransfer(parseInt(id), auto2FA)
      .catch((error: Error) => {
        console.error('恢复批量转账失败:', error);
      });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取失败的转账关系列表
 */
export const getFailedTransfers: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // 查询失败的转账关系
    const failedTransfers = await db('infini_batch_transfer_relations')
      .where('batch_id', id)
      .where('status', 'failed')
      .orderBy('updated_at', 'desc');
    
    res.json({
      success: true,
      data: failedTransfers,
      message: '成功获取失败的转账关系列表'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取批量转账关系列表（支持分页和筛选）
 */
export const getBatchTransferRelations: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { 
      page = '1', 
      pageSize = '20',
      status,
      keyword
    } = req.query;
    
    // 获取页码和每页条数
    const pageNum = parseInt(page as string, 10) || 1;
    const pageSizeNum = parseInt(pageSize as string, 10) || 20;
    
    // 构建查询
    let query = db('infini_batch_transfer_relations')
      .leftJoin('infini_accounts as source_account', 'infini_batch_transfer_relations.source_account_id', 'source_account.id')
      .leftJoin('infini_accounts as target_account', 'infini_batch_transfer_relations.matched_account_id', 'target_account.id')
      .select(
        'infini_batch_transfer_relations.*',
        'source_account.email as source_account_email',
        'source_account.uid as source_account_uid',
        'target_account.email as target_account_email',
        'target_account.uid as target_account_uid'
      )
      .where('infini_batch_transfer_relations.batch_id', id)
      .orderBy('infini_batch_transfer_relations.id', 'asc');
    
    // 应用筛选条件
    if (status) {
      query = query.where('infini_batch_transfer_relations.status', status);
    }
    
    // 关键词搜索（支持目标标识符、账户邮箱等）
    if (keyword && typeof keyword === 'string' && keyword.trim() !== '') {
      const searchTerm = `%${keyword.trim()}%`;
      query = query.where((builder) => {
        builder
          .where('infini_batch_transfer_relations.target_identifier', 'like', searchTerm)
          .orWhere('source_account.email', 'like', searchTerm)
          .orWhere('target_account.email', 'like', searchTerm)
          .orWhere('source_account.uid', 'like', searchTerm)
          .orWhere('target_account.uid', 'like', searchTerm)
          .orWhere('infini_batch_transfer_relations.error_message', 'like', searchTerm);
      });
    }
    
    // 获取总记录数
    const countQuery = query.clone()
      .clearSelect()
      .clearOrder()
      .count('infini_batch_transfer_relations.id as total')
      .first();
    const countResult = await countQuery;
    const total = (countResult as any).total;
    
    // 应用分页
    const offset = (pageNum - 1) * pageSizeNum;
    query = query.limit(pageSizeNum).offset(offset);
    
    // 执行查询
    const relations = await query;
    
    // 获取批量转账信息
    const batchTransfer = await db('infini_batch_transfers')
      .where('id', id)
      .first();
    
    res.json({
      success: true,
      data: {
        batchTransfer,
        relations,
        pagination: {
          total,
          page: pageNum,
          pageSize: pageSizeNum,
          totalPages: Math.ceil(total / pageSizeNum)
        }
      },
      message: '成功获取批量转账关系列表'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 手动关闭批量转账任务
 */
export const closeBatchTransfer: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    // 查询批量转账记录
    const batchTransfer = await db('infini_batch_transfers')
      .where('id', id)
      .first();
    
    if (!batchTransfer) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的批量转账'
      });
    }
    
    // 只允许关闭pending和processing状态的批量转账
    if (!['pending', 'processing'].includes(batchTransfer.status)) {
      return res.status(400).json({
        success: false,
        message: `批量转账当前状态为${batchTransfer.status}，只能关闭pending或processing状态的批量转账`
      });
    }
    
    // 调用服务关闭批量转账
    const response = await batchTransferService.closeBatchTransfer(parseInt(id), reason);
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(400).json(response);
    }
  } catch (error) {
    next(error);
  }
};