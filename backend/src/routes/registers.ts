/**
 * 账户注册模块路由
 */
import express, { Router } from 'express';
import * as registerController from '../controllers/registerController';

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: 账户注册
 *   description: 账户注册相关API
 */

/**
 * @swagger
 * /api/registers:
 *   post:
 *     summary: 注册新账户
 *     tags: [账户注册]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accountName
 *               - initialBalance
 *             properties:
 *               accountName:
 *                 type: string
 *                 description: 账户名称
 *               initialBalance:
 *                 type: number
 *                 description: 初始余额
 *               description:
 *                 type: string
 *                 description: 账户描述(可选)
 *     responses:
 *       201:
 *         description: 账户创建成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/', registerController.registerAccount);

/**
 * @swagger
 * /api/registers/batch:
 *   post:
 *     summary: 批量注册账户
 *     tags: [账户注册]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV或Excel文件，包含账户信息
 *     responses:
 *       202:
 *         description: 批量注册任务已接受
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       400:
 *         description: 请求参数错误
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.post('/batch', registerController.registerBatchAccounts);

/**
 * @swagger
 * /api/registers/batch/{batchId}:
 *   get:
 *     summary: 获取批量注册任务状态
 *     tags: [账户注册]
 *     parameters:
 *       - in: path
 *         name: batchId
 *         schema:
 *           type: string
 *         required: true
 *         description: 批量注册任务ID
 *     responses:
 *       200:
 *         description: 成功获取批量注册任务状态
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 找不到指定的批量注册任务
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/batch/:batchId', registerController.getBatchStatus);

/**
 * @swagger
 * /api/registers:
 *   get:
 *     summary: 获取注册记录列表
 *     tags: [账户注册]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, success, failed]
 *         description: 按状态筛选(可选)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: 页码(可选)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: 每页条数(可选)
 *     responses:
 *       200:
 *         description: 成功获取注册记录列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/', registerController.getRegisteredAccounts);

/**
 * @swagger
 * /api/registers/template:
 *   get:
 *     summary: 下载批量注册模板
 *     tags: [账户注册]
 *     responses:
 *       200:
 *         description: 成功获取模板文件
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/template', registerController.getRegisterTemplate);

export default router;