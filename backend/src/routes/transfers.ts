/**
 * 账户转账模块路由
 */
import express, { Router } from 'express';
import * as transferController from '../controllers/transferController';

const router: Router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Transfer:
 *       type: object
 *       required:
 *         - sourceAccount
 *         - targetAccount
 *         - amount
 *       properties:
 *         id:
 *           type: string
 *           description: 转账记录唯一ID
 *         sourceAccount:
 *           type: string
 *           description: 源账户ID
 *         targetAccount:
 *           type: string
 *           description: 目标账户ID
 *         amount:
 *           type: number
 *           description: 转账金额
 *         memo:
 *           type: string
 *           description: 转账备注
 *         status:
 *           type: string
 *           description: 转账状态（pending, completed, failed）
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: 转账时间
 *       example:
 *         id: TRANSFER_001
 *         sourceAccount: ACC_001
 *         targetAccount: ACC_002
 *         amount: 5000.00
 *         memo: 资金转移
 *         status: completed
 *         timestamp: 2025-05-06 15:30:22
 * 
 *     InternalTransfer:
 *       type: object
 *       required:
 *         - accountId
 *         - contactType
 *         - targetIdentifier
 *         - amount
 *         - source
 *       properties:
 *         accountId:
 *           type: string
 *           description: 源账户ID
 *         contactType:
 *           type: string
 *           enum: [uid, email]
 *           description: 联系人类型（uid或email）
 *         targetIdentifier:
 *           type: string
 *           description: 目标标识符（UID、Email或内部账户ID）
 *         amount:
 *           type: string
 *           description: 转账金额（字符串格式）
 *         source:
 *           type: string
 *           description: 转账来源
 *         isForced:
 *           type: boolean
 *           description: 是否强制执行（忽略风险）
 *         remarks:
 *           type: string
 *           description: 备注信息
 *       example:
 *         accountId: "1"
 *         contactType: "uid"
 *         targetIdentifier: "49345118"
 *         amount: "1"
 *         source: "manual"
 *         isForced: false
 *         remarks: "测试转账"
 */

/**
 * @swagger
 * tags:
 *   name: Transfers
 *   description: 账户转账API
 */

/**
 * @swagger
 * /api/transfers:
 *   post:
 *     summary: 创建新的转账请求
 *     tags: [Transfers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sourceAccount
 *               - targetAccount
 *               - amount
 *             properties:
 *               sourceAccount:
 *                 type: string
 *               targetAccount:
 *                 type: string
 *               amount:
 *                 type: number
 *               memo:
 *                 type: string
 *     responses:
 *       201:
 *         description: 转账请求已创建
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Transfer'
 *       400:
 *         description: 请求参数无效
 *       404:
 *         description: 账户不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/', transferController.createTransfer);

/**
 * @swagger
 * /api/transfers:
 *   get:
 *     summary: 获取转账记录列表
 *     tags: [Transfers]
 *     parameters:
 *       - in: query
 *         name: accountId
 *         schema:
 *           type: string
 *         description: 筛选特定账户的转账记录（来源或目标）
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 按状态筛选转账记录
 *     responses:
 *       200:
 *         description: 成功获取转账记录
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transfer'
 *       500:
 *         description: 服务器错误
 */
router.get('/', transferController.getTransfers);

/**
 * @swagger
 * /api/transfers/{id}:
 *   get:
 *     summary: 获取指定转账记录详情
 *     tags: [Transfers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 转账记录ID
 *     responses:
 *       200:
 *         description: 成功获取转账记录详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Transfer'
 *       404:
 *         description: 转账记录不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/:id', transferController.getTransferById);

/**
 * @swagger
 * /api/transfers/{id}/history:
 *   get:
 *     summary: 获取指定转账记录的历史记录
 *     tags: [Transfers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 转账记录ID
 *     responses:
 *       200:
 *         description: 成功获取转账历史记录
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     transfer:
 *                       type: object
 *                       description: 转账记录基本信息
 *                     histories:
 *                       type: array
 *                       description: 转账历史记录列表
 *       404:
 *         description: 转账记录不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/:id/history', transferController.getTransferHistory);

/**
 * @swagger
 * /api/transfers/internal:
 *   post:
 *     summary: 执行Infini内部转账
 *     tags: [Transfers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InternalTransfer'
 *     responses:
 *       200:
 *         description: 转账操作处理结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *       400:
 *         description: 请求参数无效
 *       500:
 *         description: 服务器错误
 */
router.post('/internal', transferController.executeInternalTransfer);

/**
 * @swagger
 * /api/transfers/red-packet:
 *   post:
 *     summary: 领取Infini红包
 *     tags: [Transfers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountId
 *               - code
 *             properties:
 *               accountId:
 *                 type: string
 *                 description: Infini账户ID
 *               code:
 *                 type: string
 *                 description: 红包码
 *     responses:
 *       200:
 *         description: 红包领取结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     amount:
 *                       type: string
 *                       description: 领取到的红包金额
 *       400:
 *         description: 请求参数无效
 *       401:
 *         description: 无法获取有效的登录凭证
 *       404:
 *         description: 找不到指定的账户
 *       500:
 *         description: 服务器错误
 */
router.post('/red-packet', transferController.grabRedPacket);

// 移除了自动获取2FA验证码和继续转账的路由
// 现在使用带有auto2FA和verificationCode参数的executeInternalTransfer方法处理所有转账场景
export default router;