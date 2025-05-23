/**
 * 批量转账模块路由
 */
import express, { Router } from 'express';
import { createBusinessContextMiddleware } from '../utils/BusinessContextExample';
import * as batchTransferController from '../controllers/batchTransferController';

const router: Router = express.Router();

// 为所有批量转账路由设置默认业务上下文
router.use(createBusinessContextMiddleware('batch_transfer', 'general'));

/**
 * @swagger
 * components:
 *   schemas:
 *     BatchTransfer:
 *       type: object
 *       required:
 *         - name
 *         - type
 *         - relations
 *       properties:
 *         id:
 *           type: integer
 *           description: 批量转账ID
 *         name:
 *           type: string
 *           description: 批量转账名称
 *         type:
 *           type: string
 *           enum: [one_to_many, many_to_one]
 *           description: 转账类型：一对多或多对一
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *           description: 批量转账状态
 *         source:
 *           type: string
 *           description: 来源
 *         total_amount:
 *           type: string
 *           description: 总转账金额
 *         success_count:
 *           type: integer
 *           description: 成功转账数量
 *         failed_count:
 *           type: integer
 *           description: 失败转账数量
 *         remarks:
 *           type: string
 *           description: 备注信息
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: 更新时间
 *         completed_at:
 *           type: string
 *           format: date-time
 *           description: 完成时间
 *       example:
 *         id: 1
 *         name: "五一节日红包"
 *         type: "one_to_many"
 *         status: "completed"
 *         source: "batch"
 *         total_amount: "1000.00"
 *         success_count: 10
 *         failed_count: 0
 *         remarks: "五一节日红包发放"
 *         created_at: "2025-05-01T08:00:00Z"
 *         updated_at: "2025-05-01T08:05:00Z"
 *         completed_at: "2025-05-01T08:05:00Z"
 * 
 *     BatchTransferRelation:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: 转账关系ID
 *         batch_id:
 *           type: integer
 *           description: 关联的批量转账ID
 *         source_account_id:
 *           type: integer
 *           description: 源账户ID
 *         target_account_id:
 *           type: integer
 *           description: 目标账户ID
 *         contact_type:
 *           type: string
 *           description: 联系人类型
 *         target_identifier:
 *           type: string
 *           description: 目标标识符
 *         amount:
 *           type: string
 *           description: 转账金额
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed]
 *           description: 转账状态
 *         error_message:
 *           type: string
 *           description: 错误信息
 *       example:
 *         id: 1
 *         batch_id: 1
 *         source_account_id: 100
 *         target_account_id: 200
 *         contact_type: "inner"
 *         target_identifier: "200"
 *         amount: "100.00"
 *         status: "completed"
 *         error_message: null
 */

/**
 * @swagger
 * tags:
 *   name: BatchTransfers
 *   description: 批量转账API
 */

/**
 * @swagger
 * /api/batch-transfers:
 *   post:
 *     summary: 创建批量转账任务
 *     tags: [BatchTransfers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *               - relations
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [one_to_many, many_to_one]
 *               sourceAccountId:
 *                 type: integer
 *               targetAccountId:
 *                 type: integer
 *               relations:
 *                 type: array
 *                 items:
 *                   type: object
 *               remarks:
 *                 type: string
 *     responses:
 *       201:
 *         description: 批量转账任务已创建
 *       400:
 *         description: 请求参数无效
 *       500:
 *         description: 服务器错误
 */
router.post('/', 
  createBusinessContextMiddleware('batch_transfer', 'create', (req) => ({
    transferType: req.body.type,
    sourceAccount: req.body.sourceAccountId,
    targetAccount: req.body.targetAccountId,
    relationsCount: req.body.relations?.length || 0,
    totalAmount: req.body.relations?.reduce((sum: number, rel: {amount?: string}) => 
      sum + parseFloat(rel.amount || '0'), 0) || 0
  })),
  batchTransferController.createBatchTransfer
);

/**
 * @swagger
 * /api/batch-transfers:
 *   get:
 *     summary: 获取批量转账列表
 *     tags: [BatchTransfers]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         description: 每页条数
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 状态筛选
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: 类型筛选
 *     responses:
 *       200:
 *         description: 成功获取批量转账列表
 *       500:
 *         description: 服务器错误
 */
router.get('/', 
  createBusinessContextMiddleware('batch_transfer', 'list', (req) => ({
    page: req.query.page,
    pageSize: req.query.pageSize,
    status: req.query.status,
    type: req.query.type
  })),
  batchTransferController.getBatchTransfers
);

/**
 * @swagger
 * /api/batch-transfers/{id}:
 *   get:
 *     summary: 获取批量转账详情
 *     tags: [BatchTransfers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 批量转账ID
 *     responses:
 *       200:
 *         description: 成功获取批量转账详情
 *       404:
 *         description: 批量转账不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/:id', 
  createBusinessContextMiddleware('batch_transfer', 'detail', (req) => ({
    batchId: req.params.id
  })),
  batchTransferController.getBatchTransferById
);

/**
 * @swagger
 * /api/batch-transfers/{id}/execute:
 *   post:
 *     summary: 执行批量转账
 *     tags: [BatchTransfers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 批量转账ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               auto2FA:
 *                 type: boolean
 *                 description: 是否自动处理2FA验证
 *     responses:
 *       200:
 *         description: 批量转账已开始执行
 *       404:
 *         description: 批量转账不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/:id/execute', 
  createBusinessContextMiddleware('batch_transfer', 'execute', (req) => ({
    batchId: req.params.id,
    auto2FA: req.body.auto2FA
  })),
  batchTransferController.executeBatchTransfer
);

/**
 * @swagger
 * /api/batch-transfers/{id}/history:
 *   get:
 *     summary: 获取批量转账历史记录
 *     tags: [BatchTransfers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 批量转账ID
 *     responses:
 *       200:
 *         description: 成功获取批量转账历史记录
 *       404:
 *         description: 批量转账不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/:id/history', 
  createBusinessContextMiddleware('batch_transfer', 'history', (req) => ({
    batchId: req.params.id
  })),
  batchTransferController.getBatchTransferHistory
);

/**
 * @swagger
 * /api/batch-transfers/{id}/progress:
 *   get:
 *     summary: 获取批量转账进度
 *     tags: [BatchTransfers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 批量转账ID
 *     responses:
 *       200:
 *         description: 成功获取批量转账进度
 *       404:
 *         description: 批量转账不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/:id/progress', 
  createBusinessContextMiddleware('batch_transfer', 'progress', (req) => ({
    batchId: req.params.id
  })),
  batchTransferController.getBatchTransferProgress
);

/**
 * @swagger
 * /api/batch-transfers/{id}/failed:
 *   get:
 *     summary: 获取失败的转账关系列表
 *     tags: [BatchTransfers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 批量转账ID
 *     responses:
 *       200:
 *         description: 成功获取失败的转账关系列表
 *       500:
 *         description: 服务器错误
 */
router.get('/:id/failed', 
  createBusinessContextMiddleware('batch_transfer', 'failed_list', (req) => ({
    batchId: req.params.id
  })),
  batchTransferController.getFailedTransfers
);

/**
 * @swagger
 * /api/batch-transfers/{id}/retry-failed:
 *   post:
 *     summary: 批量重试失败的转账
 *     tags: [BatchTransfers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 批量转账ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               auto2FA:
 *                 type: boolean
 *                 description: 是否自动处理2FA验证
 *     responses:
 *       200:
 *         description: 批量重试已开始
 *       500:
 *         description: 服务器错误
 */
router.post('/:id/retry-failed', 
  createBusinessContextMiddleware('batch_transfer', 'retry_failed', (req) => ({
    batchId: req.params.id,
    auto2FA: req.body.auto2FA
  })),
  batchTransferController.retryFailedTransfers
);

/**
 * @swagger
 * /api/batch-transfers/{id}/resume:
 *   post:
 *     summary: 恢复未完成的批量转账
 *     tags: [BatchTransfers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 批量转账ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               auto2FA:
 *                 type: boolean
 *                 description: 是否自动处理2FA验证
 *     responses:
 *       200:
 *         description: 批量转账已恢复
 *       404:
 *         description: 批量转账不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/:id/resume', 
  createBusinessContextMiddleware('batch_transfer', 'resume', (req) => ({
    batchId: req.params.id,
    auto2FA: req.body.auto2FA
  })),
  batchTransferController.resumeBatchTransfer
);

/**
 * @swagger
 * /api/batch-transfers/{batchId}/relations/{relationId}/retry:
 *   post:
 *     summary: 重试单个失败的转账
 *     tags: [BatchTransfers]
 *     parameters:
 *       - in: path
 *         name: batchId
 *         schema:
 *           type: string
 *         required: true
 *         description: 批量转账ID
 *       - in: path
 *         name: relationId
 *         schema:
 *           type: string
 *         required: true
 *         description: 转账关系ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               auto2FA:
 *                 type: boolean
 *                 description: 是否自动处理2FA验证
 *     responses:
 *       200:
 *         description: 转账重试已开始
 *       404:
 *         description: 转账关系不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/:batchId/relations/:relationId/retry', 
  createBusinessContextMiddleware('batch_transfer', 'retry_single', (req) => ({
    batchId: req.params.batchId,
    relationId: req.params.relationId,
    auto2FA: req.body.auto2FA
  })),
  batchTransferController.retryTransferRelation
);

/**
 * @swagger
 * /api/batch-transfers/{id}/relations:
 *   get:
 *     summary: 获取批量转账关系列表
 *     tags: [BatchTransfers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 批量转账ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: 页码
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         description: 每页条数
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 状态筛选
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 关键词搜索
 *     responses:
 *       200:
 *         description: 成功获取批量转账关系列表
 *       404:
 *         description: 批量转账不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/:id/relations', 
  createBusinessContextMiddleware('batch_transfer', 'relations', (req) => ({
    batchId: req.params.id,
    page: req.query.page,
    pageSize: req.query.pageSize,
    status: req.query.status,
    keyword: req.query.keyword
  })),
  batchTransferController.getBatchTransferRelations
);

/**
 * @swagger
 * /api/batch-transfers/{id}/close:
 *   post:
 *     summary: 手动关闭批量转账任务
 *     tags: [BatchTransfers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 批量转账ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: 关闭原因
 *     responses:
 *       200:
 *         description: 批量转账已关闭
 *       400:
 *         description: 无法关闭（状态不正确或其他错误）
 *       404:
 *         description: 批量转账不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/:id/close', 
  createBusinessContextMiddleware('batch_transfer', 'close', (req) => ({
    batchId: req.params.id,
    reason: req.body.reason
  })),
  batchTransferController.closeBatchTransfer
);

export default router;