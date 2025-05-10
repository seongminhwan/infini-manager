/**
 * 账户监控模块路由
 */
import express, { Router } from 'express';
import * as accountController from '../controllers/accountController';

const router: Router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Account:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - balance
 *         - status
 *       properties:
 *         id:
 *           type: string
 *           description: 账户唯一ID
 *         name:
 *           type: string
 *           description: 账户名称
 *         balance:
 *           type: number
 *           description: 账户余额
 *         status:
 *           type: string
 *           description: 账户状态（active, inactive, warning）
 *         lastUpdate:
 *           type: string
 *           format: date-time
 *           description: 最后更新时间
 *       example:
 *         id: ACC_001
 *         name: 主要账户A
 *         balance: 53689.42
 *         status: active
 *         lastUpdate: 2025-05-06 14:23:10
 */

/**
 * @swagger
 * tags:
 *   name: Accounts
 *   description: 账户监控和管理API
 */

/**
 * @swagger
 * /api/accounts:
 *   get:
 *     summary: 获取所有账户列表
 *     tags: [Accounts]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 按状态筛选账户（active, inactive, warning）
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜索账户ID或名称
 *     responses:
 *       200:
 *         description: 成功获取账户列表
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
 *                     $ref: '#/components/schemas/Account'
 *       500:
 *         description: 服务器错误
 */
router.get('/', accountController.getAllAccounts);

/**
 * @swagger
 * /api/accounts/{id}:
 *   get:
 *     summary: 获取指定账户详情
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 账户ID
 *     responses:
 *       200:
 *         description: 成功获取账户详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Account'
 *       404:
 *         description: 账户不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/:id', accountController.getAccountById);

/**
 * @swagger
 * /api/accounts/{id}/balance:
 *   get:
 *     summary: 获取指定账户余额
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 账户ID
 *     responses:
 *       200:
 *         description: 成功获取账户余额
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
 *                     id:
 *                       type: string
 *                     balance:
 *                       type: number
 *       404:
 *         description: 账户不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/:id/balance', accountController.getAccountBalance);

/**
 * @swagger
 * /api/accounts/{id}/status:
 *   get:
 *     summary: 获取指定账户状态
 *     tags: [Accounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 账户ID
 *     responses:
 *       200:
 *         description: 成功获取账户状态
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
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *       404:
 *         description: 账户不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/:id/status', accountController.getAccountStatus);

export default router;