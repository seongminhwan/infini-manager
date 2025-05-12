/**
 * AFF返现相关路由配置
 */
import express from 'express';
import * as affController from '../controllers/affController';

const router = express.Router();

/**
 * AFF返现批次管理
 */
// 创建AFF返现批次
router.post('/cashbacks', affController.createAffCashback);

// 获取AFF返现批次列表
router.get('/cashbacks', affController.getAffCashbacks);

// 获取AFF返现批次最大ID
router.get('/cashbacks/max-id', affController.getMaxBatchId);

// 获取AFF返现批次详情
router.get('/cashbacks/:id', affController.getAffCashbackById);

// 获取AFF返现批次关联的用户列表
router.get('/cashbacks/:batchId/relations', affController.getAffCashbackRelations);

// 解析AFF文本数据
router.post('/cashbacks/:batchId/parse', affController.parseAffData);

// 更新所有待处理记录的返现金额
router.put('/cashbacks/:batchId/amount', affController.updateAllPendingAmount);

/**
 * AFF返现记录管理
 */
// 更新用户关联状态（合格或忽略）
router.put('/relations/:relationId/status', affController.updateRelationStatus);

// 更新AFF返现金额
router.put('/relations/:relationId/amount', affController.updateAffAmount);

/**
 * AFF返现转账操作
 */
// 关闭AFF返现批次
router.post('/cashbacks/:batchId/close', affController.closeCashback);

// 标记AFF返现批次为已完成
router.post('/cashbacks/:batchId/mark-completed', affController.markCashbackAsCompleted);

// 开始批量转账
router.post('/cashbacks/:batchId/transfer', affController.startBatchTransfer);

// 执行单个记录的转账
router.post('/relations/:relationId/transfer', affController.executeTransfer);

// 获取下一条待处理记录
router.get('/cashbacks/:batchId/next', affController.getNextPendingRelation);

export default router;