/**
 * 通知管理模块路由
 */
import express, { Router } from 'express';
import * as notificationController from '../controllers/notificationController';

const router: Router = express.Router();

/**
 * @swagger
 * tags:
 *   name: 通知管理
 *   description: 通知设置和历史相关API
 */

/**
 * @swagger
 * /api/notifications/settings:
 *   get:
 *     summary: 获取通知设置
 *     tags: [通知管理]
 *     responses:
 *       200:
 *         description: 成功获取通知设置
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/settings', notificationController.getNotificationSettings);

/**
 * @swagger
 * /api/notifications/settings:
 *   put:
 *     summary: 更新通知设置
 *     tags: [通知管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emailEnabled:
 *                 type: boolean
 *                 description: 是否启用邮件通知
 *               emailAddress:
 *                 type: string
 *                 description: 邮件地址
 *               telegramEnabled:
 *                 type: boolean
 *                 description: 是否启用Telegram通知
 *               telegramChatId:
 *                 type: string
 *                 description: Telegram聊天ID
 *               telegramBotToken:
 *                 type: string
 *                 description: Telegram机器人Token
 *     responses:
 *       200:
 *         description: 通知设置更新成功
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
router.put('/settings', notificationController.updateNotificationSettings);

/**
 * @swagger
 * /api/notifications/rules:
 *   get:
 *     summary: 获取通知规则列表
 *     tags: [通知管理]
 *     responses:
 *       200:
 *         description: 成功获取通知规则列表
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/rules', notificationController.getNotificationRules);

/**
 * @swagger
 * /api/notifications/rules:
 *   post:
 *     summary: 创建新的通知规则
 *     tags: [通知管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - condition
 *               - channels
 *             properties:
 *               name:
 *                 type: string
 *                 description: 规则名称
 *               condition:
 *                 type: string
 *                 description: 通知条件(如余额低于某值)
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [email, telegram]
 *                 description: 通知渠道
 *     responses:
 *       201:
 *         description: 通知规则创建成功
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
router.post('/rules', notificationController.createNotificationRule);

/**
 * @swagger
 * /api/notifications/rules/{id}:
 *   put:
 *     summary: 更新通知规则
 *     tags: [通知管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 通知规则ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 规则名称
 *               condition:
 *                 type: string
 *                 description: 通知条件
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [email, telegram]
 *                 description: 通知渠道
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 description: 规则状态
 *     responses:
 *       200:
 *         description: 通知规则更新成功
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
 *       404:
 *         description: 找不到指定的通知规则
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.put('/rules/:id', notificationController.updateNotificationRule);

/**
 * @swagger
 * /api/notifications/rules/{id}:
 *   delete:
 *     summary: 删除通知规则
 *     tags: [通知管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 通知规则ID
 *     responses:
 *       200:
 *         description: 通知规则删除成功
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       404:
 *         description: 找不到指定的通知规则
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.delete('/rules/:id', notificationController.deleteNotificationRule);

/**
 * @swagger
 * /api/notifications/history:
 *   get:
 *     summary: 获取通知历史记录
 *     tags: [通知管理]
 *     parameters:
 *       - in: query
 *         name: channel
 *         schema:
 *           type: string
 *           enum: [email, telegram]
 *         description: 通知渠道(可选)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [sent, failed]
 *         description: 通知状态(可选)
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
 *         description: 成功获取通知历史记录
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 */
router.get('/history', notificationController.getNotificationHistory);

/**
 * @swagger
 * /api/notifications/test:
 *   post:
 *     summary: 发送测试通知
 *     tags: [通知管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - channel
 *             properties:
 *               channel:
 *                 type: string
 *                 enum: [email, telegram]
 *                 description: 通知渠道
 *               content:
 *                 type: string
 *                 description: 测试通知内容(可选)
 *     responses:
 *       200:
 *         description: 测试通知发送成功
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
router.post('/test', notificationController.sendTestNotification);

export default router;