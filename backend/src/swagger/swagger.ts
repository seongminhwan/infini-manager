/**
 * Swagger文档配置文件
 * 包含API通用信息、标准响应模型、安全方案等
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ApiResponse:
 *       type: object
 *       required:
 *         - success
 *       properties:
 *         success:
 *           type: boolean
 *           description: 请求是否成功
 *         message:
 *           type: string
 *           description: 响应消息
 *         data:
 *           type: object
 *           description: 响应数据
 *       example:
 *         success: true
 *         message: "操作成功"
 *         data: { id: "12345" }
 *     
 *     Account:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - balance
 *         - status
 *         - lastUpdate
 *       properties:
 *         id:
 *           type: string
 *           description: 账户ID
 *         name:
 *           type: string
 *           description: 账户名称
 *         balance:
 *           type: number
 *           description: 账户余额
 *         status:
 *           type: string
 *           enum: [active, inactive, warning]
 *           description: 账户状态
 *         lastUpdate:
 *           type: string
 *           format: date-time
 *           description: 最后更新时间
 *       example:
 *         id: "ACC_001"
 *         name: "运营账户A"
 *         balance: 10000
 *         status: "active"
 *         lastUpdate: "2025-05-06 10:15:22"
 *     
 *     Transfer:
 *       type: object
 *       required:
 *         - id
 *         - sourceAccount
 *         - targetAccount
 *         - amount
 *         - status
 *         - timestamp
 *       properties:
 *         id:
 *           type: string
 *           description: 转账ID
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
 *           enum: [pending, completed, failed]
 *           description: 转账状态
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: 转账时间
 *       example:
 *         id: "TRANSFER_001"
 *         sourceAccount: "ACC_001"
 *         targetAccount: "ACC_002"
 *         amount: 5000
 *         memo: "资金转移"
 *         status: "completed"
 *         timestamp: "2025-05-06 15:30:22"
 *     
 *     RegisteredAccount:
 *       type: object
 *       required:
 *         - id
 *         - accountName
 *         - initialBalance
 *         - status
 *         - createdAt
 *       properties:
 *         id:
 *           type: string
 *           description: 注册账户ID
 *         accountName:
 *           type: string
 *           description: 账户名称
 *         initialBalance:
 *           type: number
 *           description: 初始余额
 *         description:
 *           type: string
 *           description: 账户描述
 *         status:
 *           type: string
 *           enum: [pending, success, failed]
 *           description: 注册状态
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 创建时间
 *       example:
 *         id: "ACC_001"
 *         accountName: "运营账户A"
 *         initialBalance: 10000
 *         status: "success"
 *         createdAt: "2025-05-01 09:15:22"
 *     
 *     BatchRegistration:
 *       type: object
 *       required:
 *         - batchId
 *         - status
 *         - totalAccounts
 *         - processedAccounts
 *         - successCount
 *         - failedCount
 *       properties:
 *         batchId:
 *           type: string
 *           description: 批量注册任务ID
 *         status:
 *           type: string
 *           enum: [processing, completed, failed]
 *           description: 任务状态
 *         totalAccounts:
 *           type: integer
 *           description: 总账户数
 *         processedAccounts:
 *           type: integer
 *           description: 已处理账户数
 *         successCount:
 *           type: integer
 *           description: 成功数量
 *         failedCount:
 *           type: integer
 *           description: 失败数量
 *       example:
 *         batchId: "BATCH_001"
 *         status: "processing"
 *         totalAccounts: 100
 *         processedAccounts: 65
 *         successCount: 60
 *         failedCount: 5
 *     
 *     NotificationSetting:
 *       type: object
 *       required:
 *         - emailEnabled
 *         - telegramEnabled
 *       properties:
 *         emailEnabled:
 *           type: boolean
 *           description: 是否启用邮件通知
 *         emailAddress:
 *           type: string
 *           description: 邮件地址
 *         telegramEnabled:
 *           type: boolean
 *           description: 是否启用Telegram通知
 *         telegramChatId:
 *           type: string
 *           description: Telegram聊天ID
 *         telegramBotToken:
 *           type: string
 *           description: Telegram机器人Token
 *       example:
 *         emailEnabled: true
 *         emailAddress: "admin@example.com"
 *         telegramEnabled: false
 *         telegramChatId: ""
 *         telegramBotToken: ""
 *     
 *     NotificationRule:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - condition
 *         - channels
 *         - status
 *       properties:
 *         id:
 *           type: string
 *           description: 规则ID
 *         name:
 *           type: string
 *           description: 规则名称
 *         condition:
 *           type: string
 *           description: 通知条件
 *         channels:
 *           type: array
 *           items:
 *             type: string
 *             enum: [email, telegram]
 *           description: 通知渠道
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: 规则状态
 *       example:
 *         id: "RULE_001"
 *         name: "余额警告"
 *         condition: "balance < 1000"
 *         channels: ["email"]
 *         status: "active"
 *     
 *     NotificationHistory:
 *       type: object
 *       required:
 *         - id
 *         - type
 *         - content
 *         - channel
 *         - time
 *         - status
 *       properties:
 *         id:
 *           type: string
 *           description: 通知ID
 *         type:
 *           type: string
 *           description: 通知类型
 *         content:
 *           type: string
 *           description: 通知内容
 *         channel:
 *           type: string
 *           enum: [email, telegram]
 *           description: 通知渠道
 *         time:
 *           type: string
 *           format: date-time
 *           description: 通知时间
 *         status:
 *           type: string
 *           enum: [sent, failed]
 *           description: 通知状态
 *       example:
 *         id: "NOTIFY_001"
 *         type: "余额警告"
 *         content: "账户[ACC_001]余额低于1000"
 *         channel: "email"
 *         time: "2025-05-06 10:15:22"
 *         status: "sent"
 * 
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 * 
 * security:
 *   - BearerAuth: []
 */

/**
 * @swagger
 * tags:
 *   - name: 账户监控
 *     description: 账户状态监控相关API
 *   - name: 账户转账
 *     description: 账户转账相关API
 *   - name: 账户注册
 *     description: 账户注册相关API
 *   - name: 通知管理
 *     description: 通知管理相关API
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: 健康检查
 *     description: 用于检查API服务是否正常运行
 *     tags: [系统状态]
 *     responses:
 *       200:
 *         description: 服务运行正常
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "ok"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: "2025-05-07T04:30:00.000Z"
 */