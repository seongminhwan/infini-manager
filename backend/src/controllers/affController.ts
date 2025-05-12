/**
 * AFF返现控制器
 * 处理与AFF批量返现相关的所有API请求
 */
import { Request, Response, NextFunction } from 'express';
import { ControllerMethod, ApiResponse } from '../types';
import { InfiniAccountService } from '../service/InfiniAccountService';
import db from '../db/db';
import fs from 'fs';
// 使用any类型导入csv-parser，避免类型冲突
import * as csv from 'csv-parser';
import { Readable } from 'stream';
import path from 'path';

// 创建InfiniAccountService实例
const infiniAccountService = new InfiniAccountService();

/**
 * 创建新的AFF返现批次
 */
export const createAffCashback: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      accountId, 
      batchName, 
      defaultAmount = 5.6, 
      isAuto2FA = true
    } = req.body;
    
    // 验证请求参数
    if (!accountId || !batchName) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 检查是否存在进行中的AFF返现批次
    const existingBatch = await db('infini_aff_cashbacks')
      .where('account_id', accountId)
      .whereIn('status', ['pending', 'processing'])
      .first();
    
    if (existingBatch) {
      return res.status(400).json({
        success: false,
        message: '存在进行中的AFF返现批次，请先完成或取消该批次',
        data: {
          existingBatch: {
            id: existingBatch.id,
            batchName: existingBatch.batch_name,
            status: existingBatch.status,
            totalCount: existingBatch.total_count,
            successCount: existingBatch.success_count,
            failedCount: existingBatch.failed_count,
            riskyCount: existingBatch.risky_count,
            createdAt: existingBatch.created_at
          }
        }
      });
    }
    
    // 创建新的AFF返现批次
    const [batchId] = await db('infini_aff_cashbacks').insert({
      account_id: accountId,
      batch_name: batchName,
      default_amount: defaultAmount,
      is_auto_2fa: isAuto2FA,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    });
    
    return res.status(201).json({
      success: true,
      message: 'AFF返现批次创建成功',
      data: {
        id: batchId,
        accountId,
        batchName,
        defaultAmount,
        isAuto2FA
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 解析AFF文本数据
 */
export const parseAffData: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batchId } = req.params; // 从URL路径获取batchId
    const { dataType, data } = req.body;
    
    // 验证请求参数
    if (!batchId || !dataType || !data) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 检查批次是否存在
    const batch = await db('infini_aff_cashbacks')
      .where('id', batchId)
      .first();
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的AFF返现批次'
      });
    }
    
    // 检查批次状态
    if (batch.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `当前批次状态为${batch.status}，无法添加数据`
      });
    }
    
    // 检查是否已有数据
    const existingDataCount = await db('infini_aff_cashback_relations')
      .where('aff_cashback_id', batchId)
      .count('* as count')
      .first();
    
    if (existingDataCount && (existingDataCount as any).count > 0) {
      return res.status(400).json({
        success: false,
        message: '该批次已有数据，请清空后再添加'
      });
    }
    
    // 根据数据类型解析
    let parsedData: any[] = [];
    
    if (dataType === 'csv') {
      // 将CSV字符串解析为数组
      parsedData = await parseCSVString(data);
    } else if (dataType === 'text') {
      // 解析空格分隔文本
      parsedData = parseSpaceSeparatedText(data);
    } else {
      return res.status(400).json({
        success: false,
        message: '不支持的数据类型'
      });
    }
    
    // 验证解析结果
    if (!parsedData || parsedData.length === 0) {
      return res.status(400).json({
        success: false,
        message: '数据解析失败或数据为空'
      });
    }
    
    // 更新批次信息
    await db('infini_aff_cashbacks')
      .where('id', batchId)
      .update({
        original_data: data,
        file_type: dataType,
        total_count: parsedData.length,
        updated_at: new Date()
      });
    
    // 检查所有用户是否已存在返现记录
    const uidList = parsedData.map(item => item.infiniUid);
    const existingRecords = await db('infini_aff_cashback_relations')
      .whereIn('infini_uid', uidList)
      .select('infini_uid');
    
    const existingUids = new Set(existingRecords.map(record => record.infini_uid));
    
    // 准备插入数据
    const relationRecords = [];
    const riskyUids = [];
    
    for (const item of parsedData) {
      // 检查是否为风险用户
      const isRisky = existingUids.has(item.infiniUid);
      
      // 如果是风险用户，添加到列表
      if (isRisky) {
        riskyUids.push(item.infiniUid);
      }
      
      // 准备插入数据
      relationRecords.push({
        aff_cashback_id: batchId,
        infini_uid: item.infiniUid,
        register_date: item.registerDate ? new Date(item.registerDate) : null,
        card_count: item.cardCount || 0,
        card_date: item.cardDate ? new Date(item.cardDate) : null,
        sequence_number: item.sequenceNumber,
        amount: batch.default_amount, // 使用批次默认金额
        is_risky: isRisky,
        status: 'pending',
        raw_data: JSON.stringify(item),
        created_at: new Date(),
        updated_at: new Date()
      });
    }
    
    // 插入关联记录
    await db('infini_aff_cashback_relations').insert(relationRecords);
    
    // 更新批次风险用户数量
    await db('infini_aff_cashbacks')
      .where('id', batchId)
      .update({
        risky_count: riskyUids.length,
        updated_at: new Date()
      });
    
    // 返回解析结果
    return res.json({
      success: true,
      message: 'AFF数据解析成功',
      data: {
        totalCount: parsedData.length,
        riskyCount: riskyUids.length,
        riskyUids,
        previewData: parsedData.slice(0, 5) // 返回前5条数据作为预览
      }
    });
  } catch (error) {
    console.error('解析AFF数据失败:', error);
    next(error);
  }
};

/**
 * 查询AFF返现批次关联的用户列表
 */
export const getAffCashbackRelations: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batchId } = req.params;
    
    // 验证请求参数
    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: '缺少批次ID'
      });
    }
    
    // 检查批次是否存在
    const batch = await db('infini_aff_cashbacks')
      .where('id', batchId)
      .first();
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的AFF返现批次'
      });
    }
    
    // 查询关联用户列表，风险用户排在前面
    const relations = await db('infini_aff_cashback_relations')
      .where('aff_cashback_id', batchId)
      .orderBy([
        { column: 'is_risky', order: 'desc' }, // 风险用户排在前面
        { column: 'id', order: 'asc' }
      ])
      .select('*');
    
    // 格式化返回数据
    const formattedRelations = relations.map(relation => ({
      id: relation.id,
      batchId: relation.aff_cashback_id,
      uid: relation.infini_uid,
      email: relation.infini_email,
      registerDate: relation.register_date,
      cardCount: relation.card_count,
      cardDate: relation.card_date,
      sequenceNumber: relation.sequence_number,
      amount: relation.amount,
      isRisky: relation.is_risky,
      isIgnored: relation.is_ignored,
      isApproved: relation.is_approved,
      status: relation.status,
      transferId: relation.transfer_id,
      errorMessage: relation.error_message,
      createdAt: relation.created_at,
      completedAt: relation.completed_at
    }));
    
    return res.json({
      success: true,
      data: {
        batch: {
          id: batch.id,
          accountId: batch.account_id,
          batchName: batch.batch_name,
          status: batch.status,
          totalCount: batch.total_count,
          successCount: batch.success_count,
          failedCount: batch.failed_count,
          riskyCount: batch.risky_count,
          defaultAmount: batch.default_amount,
          isAuto2FA: batch.is_auto_2fa,
          createdAt: batch.created_at,
          updatedAt: batch.updated_at,
          completedAt: batch.completed_at
        },
        relations: formattedRelations
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新用户关联状态（合格或忽略）
 */
export const updateRelationStatus: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { relationId } = req.params;
    const { isApproved, isIgnored } = req.body;
    
    // 验证请求参数
    if (!relationId || (isApproved === undefined && isIgnored === undefined)) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 检查关联记录是否存在
    const relation = await db('infini_aff_cashback_relations')
      .where('id', relationId)
      .first();
    
    if (!relation) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的关联记录'
      });
    }
    
    // 检查批次状态
    const batch = await db('infini_aff_cashbacks')
      .where('id', relation.aff_cashback_id)
      .first();
    
    if (!batch || !['pending', 'processing'].includes(batch.status)) {
      return res.status(400).json({
        success: false,
        message: '当前批次状态不允许更新关联记录'
      });
    }
    
    // 准备更新数据
    const updateData: Record<string, any> = {
      updated_at: new Date()
    };
    
    if (isApproved !== undefined) {
      updateData.is_approved = isApproved;
    }
    
    if (isIgnored !== undefined) {
      updateData.is_ignored = isIgnored;
      
      // 如果标记为忽略，更新状态为ignored
      if (isIgnored) {
        updateData.status = 'ignored';
      } else if (relation.status === 'ignored') {
        // 如果取消忽略，恢复状态为pending
        updateData.status = 'pending';
      }
    }
    
    // 更新关联记录
    await db('infini_aff_cashback_relations')
      .where('id', relationId)
      .update(updateData);
    
    // 返回更新后的记录
    const updatedRelation = await db('infini_aff_cashback_relations')
      .where('id', relationId)
      .first();
    
    return res.json({
      success: true,
      message: '关联记录状态更新成功',
      data: updatedRelation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新AFF返现金额
 */
export const updateAffAmount: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { relationId } = req.params;
    const { amount } = req.body;
    
    // 验证请求参数
    if (!relationId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 验证金额
    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: '返现金额必须大于0'
      });
    }
    
    // 检查关联记录是否存在
    const relation = await db('infini_aff_cashback_relations')
      .where('id', relationId)
      .first();
    
    if (!relation) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的关联记录'
      });
    }
    
    // 检查批次状态
    const batch = await db('infini_aff_cashbacks')
      .where('id', relation.aff_cashback_id)
      .first();
    
    if (!batch || !['pending', 'processing'].includes(batch.status)) {
      return res.status(400).json({
        success: false,
        message: '当前批次状态不允许更新关联记录'
      });
    }
    
    // 更新关联记录
    await db('infini_aff_cashback_relations')
      .where('id', relationId)
      .update({
        amount: parseFloat(amount),
        updated_at: new Date()
      });
    
    // 返回更新后的记录
    const updatedRelation = await db('infini_aff_cashback_relations')
      .where('id', relationId)
      .first();
    
    return res.json({
      success: true,
      message: '返现金额更新成功',
      data: updatedRelation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 更新所有待处理记录的返现金额
 */
export const updateAllPendingAmount: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batchId } = req.params;
    const { amount } = req.body;
    
    // 验证请求参数
    if (!batchId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
    }
    
    // 验证金额
    if (isNaN(amount) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: '返现金额必须大于0'
      });
    }
    
    // 检查批次是否存在
    const batch = await db('infini_aff_cashbacks')
      .where('id', batchId)
      .first();
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的AFF返现批次'
      });
    }
    
    // 检查批次状态
    if (!['pending', 'processing'].includes(batch.status)) {
      return res.status(400).json({
        success: false,
        message: '当前批次状态不允许更新关联记录'
      });
    }
    
    // 更新待处理的关联记录
    const updateResult = await db('infini_aff_cashback_relations')
      .where('aff_cashback_id', batchId)
      .where('status', 'pending')
      .update({
        amount: parseFloat(amount),
        updated_at: new Date()
      });
    
    // 更新批次默认金额
    await db('infini_aff_cashbacks')
      .where('id', batchId)
      .update({
        default_amount: parseFloat(amount),
        updated_at: new Date()
      });
    
    return res.json({
      success: true,
      message: '批量更新返现金额成功',
      data: {
        updatedCount: updateResult,
        amount: parseFloat(amount)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 执行单个记录的转账
 */
export const executeTransfer: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { relationId } = req.params;
    
    // 验证请求参数
    if (!relationId) {
      return res.status(400).json({
        success: false,
        message: '缺少关联记录ID'
      });
    }
    
    // 查询关联记录
    const relation = await db('infini_aff_cashback_relations')
      .where('id', relationId)
      .first();
    
    if (!relation) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的关联记录'
      });
    }
    
    // 查询批次信息
    const batch = await db('infini_aff_cashbacks')
      .where('id', relation.aff_cashback_id)
      .first();
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的AFF返现批次'
      });
    }
    
    // 检查状态
    if (relation.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `当前记录状态为${relation.status}，无法执行转账`
      });
    }
    
    // 如果是风险用户且没有被批准，检查是否强制执行
    const isForced = relation.is_risky && relation.is_approved;
    
    // 更新状态为处理中
    await db('infini_aff_cashback_relations')
      .where('id', relationId)
      .update({
        status: 'processing',
        updated_at: new Date()
      });
    
    // 调用转账服务
    const transferResponse = await infiniAccountService.internalTransfer(
      batch.account_id.toString(),
      'uid',
      relation.infini_uid,
      relation.amount.toString(),
      'aff', // 来源标记为aff
      isForced,
      `AFF返现-${batch.batch_name}`, // 添加批次名称作为备注
      batch.is_auto_2fa // 使用批次设置的自动2FA选项
    );
    
    // 处理转账结果
    if (transferResponse.success) {
      // 获取转账ID
      const transferId = transferResponse.data?.transferId;
      
      // 更新关联记录
      await db('infini_aff_cashback_relations')
        .where('id', relationId)
        .update({
          status: 'completed',
          transfer_id: transferId,
          completed_at: new Date(),
          updated_at: new Date()
        });
      
      // 创建转账关联记录
      await db('infini_aff_transfer_relations').insert({
        aff_cashback_id: relation.aff_cashback_id,
        aff_relation_id: relation.id,
        transfer_id: transferId,
        status: 'completed',
        created_at: new Date(),
        updated_at: new Date()
      });
      
      // 更新批次成功数量
      await db('infini_aff_cashbacks')
        .where('id', relation.aff_cashback_id)
        .increment('success_count', 1)
        .update({
          updated_at: new Date()
        });
      
      return res.json({
        success: true,
        message: '转账执行成功',
        data: {
          relationId: relation.id,
          transferId,
          status: 'completed'
        }
      });
    } else {
      // 转账失败
      await db('infini_aff_cashback_relations')
        .where('id', relationId)
        .update({
          status: 'failed',
          error_message: transferResponse.message,
          updated_at: new Date()
        });
      
      // 更新批次失败数量
      await db('infini_aff_cashbacks')
        .where('id', relation.aff_cashback_id)
        .increment('failed_count', 1)
        .update({
          updated_at: new Date()
        });
      
      return res.status(400).json({
        success: false,
        message: `转账失败: ${transferResponse.message}`,
        data: {
          relationId: relation.id,
          status: 'failed',
          errorMessage: transferResponse.message
        }
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * 开始批量转账
 */
export const startBatchTransfer: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batchId } = req.params;
    
    // 验证请求参数
    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: '缺少批次ID'
      });
    }
    
    // 查询批次信息
    const batch = await db('infini_aff_cashbacks')
      .where('id', batchId)
      .first();
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的AFF返现批次'
      });
    }
    
    // 检查批次状态
    if (!['pending', 'processing'].includes(batch.status)) {
      return res.status(400).json({
        success: false,
        message: `当前批次状态为${batch.status}，无法开始转账`
      });
    }
    
    // 更新批次状态为处理中
    await db('infini_aff_cashbacks')
      .where('id', batchId)
      .update({
        status: 'processing',
        updated_at: new Date()
      });
    
    // 查询下一条待处理记录
    const nextRelation = await db('infini_aff_cashback_relations')
      .where('aff_cashback_id', batchId)
      .where('status', 'pending')
      .where('is_ignored', false)
      .orderBy('id', 'asc')
      .first();
    
    if (!nextRelation) {
      // 没有待处理记录，检查是否已全部处理完毕
      const remainingCount = await db('infini_aff_cashback_relations')
        .where('aff_cashback_id', batchId)
        .whereNotIn('status', ['completed', 'ignored'])
        .count('* as count')
        .first();
      
      const count = parseInt((remainingCount as any).count);
      
      if (count === 0) {
        // 全部处理完毕，更新批次状态为已完成
        await db('infini_aff_cashbacks')
          .where('id', batchId)
          .update({
            status: 'completed',
            completed_at: new Date(),
            updated_at: new Date()
          });
        
        return res.json({
          success: true,
          message: '所有转账已完成',
          data: {
            batchId,
            status: 'completed',
            nextRelation: null
          }
        });
      } else {
        return res.json({
          success: true,
          message: '没有待处理记录，但仍有未完成的记录',
          data: {
            batchId,
            status: 'processing',
            nextRelation: null,
            remainingCount: count
          }
        });
      }
    }
    
    // 返回下一条待处理记录
    return res.json({
      success: true,
      message: '批量转账已开始',
      data: {
        batchId,
        status: 'processing',
        nextRelation: {
          id: nextRelation.id,
          uid: nextRelation.infini_uid,
          amount: nextRelation.amount,
          isRisky: nextRelation.is_risky,
          isApproved: nextRelation.is_approved
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取下一条待处理记录
 */
export const getNextPendingRelation: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batchId } = req.params;
    
    // 验证请求参数
    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: '缺少批次ID'
      });
    }
    
    // 查询批次信息
    const batch = await db('infini_aff_cashbacks')
      .where('id', batchId)
      .first();
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的AFF返现批次'
      });
    }
    
    // 检查批次状态
    if (batch.status !== 'processing') {
      return res.status(400).json({
        success: false,
        message: `当前批次状态为${batch.status}，无法获取待处理记录`
      });
    }
    
    // 查询下一条待处理记录
    const nextRelation = await db('infini_aff_cashback_relations')
      .where('aff_cashback_id', batchId)
      .where('status', 'pending')
      .where('is_ignored', false)
      .orderBy('id', 'asc')
      .first();
    
    if (!nextRelation) {
      // 没有待处理记录，检查是否已全部处理完毕
      const remainingCount = await db('infini_aff_cashback_relations')
        .where('aff_cashback_id', batchId)
        .whereNotIn('status', ['completed', 'ignored'])
        .count('* as count')
        .first();
      
      const count = parseInt((remainingCount as any).count);
      
      if (count === 0) {
        // 全部处理完毕，更新批次状态为已完成
        await db('infini_aff_cashbacks')
          .where('id', batchId)
          .update({
            status: 'completed',
            completed_at: new Date(),
            updated_at: new Date()
          });
        
        return res.json({
          success: true,
          message: '所有转账已完成',
          data: {
            batchId,
            status: 'completed',
            nextRelation: null
          }
        });
      } else {
        return res.json({
          success: true,
          message: '没有待处理记录，但仍有未完成的记录',
          data: {
            batchId,
            status: 'processing',
            nextRelation: null,
            remainingCount: count
          }
        });
      }
    }
    
    // 返回下一条待处理记录
    return res.json({
      success: true,
      data: {
        batchId,
        status: 'processing',
        nextRelation: {
          id: nextRelation.id,
          uid: nextRelation.infini_uid,
          email: nextRelation.infini_email,
          amount: nextRelation.amount,
          isRisky: nextRelation.is_risky,
          isApproved: nextRelation.is_approved
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取AFF返现批次列表
 */
export const getAffCashbacks: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = '1', pageSize = '20' } = req.query;
    
    // 获取页码和每页条数
    const pageNum = parseInt(page as string, 10) || 1;
    const pageSizeNum = parseInt(pageSize as string, 10) || 20;
    
    // 构建查询
    let query = db('infini_aff_cashbacks')
      .select([
        'infini_aff_cashbacks.*',
        'infini_accounts.email as account_email'
      ])
      .leftJoin('infini_accounts', 'infini_aff_cashbacks.account_id', 'infini_accounts.id')
      .orderBy('infini_aff_cashbacks.created_at', 'desc');
    
    // 获取总记录数
    const countResult = await query.clone().clearSelect().clearOrder().count('infini_aff_cashbacks.id as total').first();
    const total = (countResult as any).total;
    
    // 应用分页
    const offset = (pageNum - 1) * pageSizeNum;
    query = query.limit(pageSizeNum).offset(offset);
    
    // 执行查询
    const cashbacks = await query;
    
    // 格式化返回数据
    const formattedCashbacks = cashbacks.map(cashback => ({
      id: cashback.id,
      accountId: cashback.account_id,
      accountEmail: cashback.account_email,
      batchName: cashback.batch_name,
      status: cashback.status,
      totalCount: cashback.total_count,
      successCount: cashback.success_count,
      failedCount: cashback.failed_count,
      riskyCount: cashback.risky_count,
      totalAmount: cashback.total_amount,
      defaultAmount: cashback.default_amount,
      isAuto2FA: cashback.is_auto_2fa,
      createdAt: cashback.created_at,
      completedAt: cashback.completed_at
    }));
    
    return res.json({
      success: true,
      data: {
        cashbacks: formattedCashbacks,
        pagination: {
          total,
          page: pageNum,
          pageSize: pageSizeNum,
          totalPages: Math.ceil(total / pageSizeNum)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 获取AFF返现批次详情
 */
/**
 * 关闭AFF返现批次
 * 将批次状态从pending或processing改为closed，防止继续进行未完成的转账
 */
export const closeCashback: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batchId } = req.params;
    
    // 验证请求参数
    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: '缺少批次ID'
      });
    }
    
    // 查询批次信息
    const batch = await db('infini_aff_cashbacks')
      .where('id', batchId)
      .first();
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的AFF返现批次'
      });
    }
    
    // 检查批次状态
    if (!['pending', 'processing'].includes(batch.status)) {
      return res.status(400).json({
        success: false,
        message: `当前批次状态为${batch.status}，无法关闭`
      });
    }
    
    // 统计当前批次未完成的关联记录数
    const pendingCount = await db('infini_aff_cashback_relations')
      .where('aff_cashback_id', batchId)
      .whereIn('status', ['pending', 'processing'])
      .count('* as count')
      .first();
    
    // 更新批次状态为已关闭
    await db('infini_aff_cashbacks')
      .where('id', batchId)
      .update({
        status: 'closed',
        completed_at: new Date(),
        updated_at: new Date()
      });
    
    // 更新所有待处理和处理中的关联记录状态为已关闭
    await db('infini_aff_cashback_relations')
      .where('aff_cashback_id', batchId)
      .whereIn('status', ['pending', 'processing'])
      .update({
        status: 'closed',
        updated_at: new Date()
      });
    
    return res.json({
      success: true,
      message: 'AFF返现批次已关闭',
      data: {
        batchId,
        pendingCount: (pendingCount as any).count
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 标记AFF返现批次为已完成
 * 手动将批次状态更新为已完成
 */
export const markCashbackAsCompleted: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { batchId } = req.params;
    
    // 验证请求参数
    if (!batchId) {
      return res.status(400).json({
        success: false,
        message: '缺少批次ID'
      });
    }
    
    // 查询批次信息
    const batch = await db('infini_aff_cashbacks')
      .where('id', batchId)
      .first();
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的AFF返现批次'
      });
    }
    
    // 更新批次状态为已完成
    await db('infini_aff_cashbacks')
      .where('id', batchId)
      .update({
        status: 'completed',
        completed_at: new Date(),
        updated_at: new Date()
      });
    
    return res.json({
      success: true,
      message: 'AFF返现批次已标记为已完成',
      data: {
        batchId,
        status: 'completed'
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getAffCashbackById: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // 验证请求参数
    if (!id) {
      return res.status(400).json({
        success: false,
        message: '缺少批次ID'
      });
    }
    
    // 查询批次信息
    const cashback = await db('infini_aff_cashbacks')
      .select([
        'infini_aff_cashbacks.*',
        'infini_accounts.email as account_email'
      ])
      .leftJoin('infini_accounts', 'infini_aff_cashbacks.account_id', 'infini_accounts.id')
      .where('infini_aff_cashbacks.id', id)
      .first();
    
    if (!cashback) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的AFF返现批次'
      });
    }
    
    // 统计关联记录状态
    const statusCounts = await db('infini_aff_cashback_relations')
      .where('aff_cashback_id', id)
      .select('status')
      .count('* as count')
      .groupBy('status');
    
    // 构建状态计数对象
    const statusCountObj: Record<string, number> = {};
    statusCounts.forEach(item => {
      statusCountObj[item.status] = parseInt(item.count as any);
    });
    
    // 格式化批次信息
    const formattedCashback = {
      id: cashback.id,
      accountId: cashback.account_id,
      accountEmail: cashback.account_email,
      batchName: cashback.batch_name,
      status: cashback.status,
      totalCount: cashback.total_count,
      successCount: cashback.success_count,
      failedCount: cashback.failed_count,
      riskyCount: cashback.risky_count,
      totalAmount: cashback.total_amount,
      defaultAmount: cashback.default_amount,
      isAuto2FA: cashback.is_auto_2fa,
      createdAt: cashback.created_at,
      updatedAt: cashback.updated_at,
      completedAt: cashback.completed_at,
      fileName: cashback.file_name,
      fileType: cashback.file_type,
      statusCounts: statusCountObj
    };
    
    return res.json({
      success: true,
      data: formattedCashback
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 将CSV字符串解析为数组
 */
async function parseCSVString(csvString: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    const stream = Readable.from(csvString);
    
    stream
      .pipe(csv.default())
      .on('data', (data: Record<string, any>) => {
        // 处理CSV数据行
        // 期望的CSV格式: 序列号,infini uid,注册日期,开卡数量,开卡日期
        const sequenceNumber = data['序列号'] || data['sequence'] || data['序号'] || '';
        const infiniUid = data['infini uid'] || data['uid'] || data['用户ID'] || '';
        const registerDate = data['注册日期'] || data['register_date'] || data['registerDate'] || '';
        const cardCount = data['开卡数量'] || data['card_count'] || data['cardCount'] || 0;
        const cardDate = data['开卡日期'] || data['card_date'] || data['cardDate'] || '';
        
        // 验证必要字段
        if (infiniUid) {
          results.push({
            sequenceNumber,
            infiniUid,
            registerDate,
            cardCount: parseInt(cardCount) || 0,
            cardDate
          });
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error: Error) => {
        reject(error);
      });
  });
}

/**
 * 解析空格分隔文本
 */
function parseSpaceSeparatedText(text: string, delimiter: string = ' ', fieldIndices?: any): any[] {
  const results: any[] = [];
  
  // 按行分割
  const lines = text.split('\n');
  
  // 设置默认字段索引
  const indices = fieldIndices || {
    uidIndex: 0,
    registerDateIndex: 1,
    cardCountIndex: 2,
    cardDateIndex: 3
  };
  
  // 处理每一行
  lines.forEach((line, index) => {
    // 跳过空行
    if (!line.trim()) {
      return;
    }
    
    // 按指定分隔符分割字段
    const fields = line.trim().split(delimiter);
    
    // 检查字段数量
    if (fields.length >= 1) {
      // 从指定索引提取字段
      const infiniUid = fields[indices.uidIndex] || '';
      
      // 只有UID非空时才添加记录
      if (infiniUid) {
        const sequenceNumber = (index + 1).toString();
        const registerDate = fields[indices.registerDateIndex] || '';
        const cardCount = fields[indices.cardCountIndex] ? parseInt(fields[indices.cardCountIndex]) : 0;
        const cardDate = fields[indices.cardDateIndex] || '';
        
        results.push({
          sequenceNumber,
          infiniUid,
          registerDate,
          cardCount,
          cardDate
        });
      }
    }
  });
  
  return results;
}

/**
 * 获取AFF返现批次的最大ID
 */
export const getMaxBatchId: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 查询当前最大ID
    const result = await db('infini_aff_cashbacks')
      .max('id as maxId')
      .first();
    
    const maxId = result ? (result.maxId || 0) : 0;
    
    return res.json({
      success: true,
      data: maxId
    });
  } catch (error) {
    next(error);
  }
};