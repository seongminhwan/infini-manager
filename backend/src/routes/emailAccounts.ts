/**
 * 邮箱账户路由
 * 处理与邮箱账户相关的请求
 */
import express from 'express';
import { 
  getAllEmailAccounts, 
  getEmailAccountById, 
  createEmailAccount, 
  updateEmailAccount, 
  deleteEmailAccount, 
  setEmailAccountStatus, 
  setDefaultEmailAccount, 
  testEmailAccount,
  getTestResult,
  getEmailMessages,
  getEmailMessageDetail
} from '../controllers/emailAccountController';

const router = express.Router();

/**
 * @swagger
 * /api/email-accounts:
 *   get:
 *     summary: 获取所有邮箱账户
 *     tags: [邮箱管理]
 *     responses:
 *       200:
 *         description: 成功获取邮箱账户列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 获取邮箱账户列表成功
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EmailAccount'
 */
router.get('/', getAllEmailAccounts);

/**
 * @swagger
 * /api/email-accounts/{id}:
 *   get:
 *     summary: 获取单个邮箱账户
 *     tags: [邮箱管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: 邮箱账户ID
 *     responses:
 *       200:
 *         description: 成功获取邮箱账户
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 获取邮箱账户成功
 *                 data:
 *                   $ref: '#/components/schemas/EmailAccount'
 *       404:
 *         description: 邮箱账户不存在
 */
router.get('/:id', getEmailAccountById);

/**
 * @swagger
 * /api/email-accounts:
 *   post:
 *     summary: 创建新邮箱账户
 *     tags: [邮箱管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailAccountCreate'
 *     responses:
 *       201:
 *         description: 成功创建邮箱账户
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 创建邮箱账户成功
 *                 data:
 *                   $ref: '#/components/schemas/EmailAccount'
 *       400:
 *         description: 缺少必要信息
 *       409:
 *         description: 邮箱地址已存在
 */
router.post('/', createEmailAccount);

/**
 * @swagger
 * /api/email-accounts/{id}:
 *   put:
 *     summary: 更新邮箱账户
 *     tags: [邮箱管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: 邮箱账户ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EmailAccountUpdate'
 *     responses:
 *       200:
 *         description: 成功更新邮箱账户
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 更新邮箱账户成功
 *                 data:
 *                   $ref: '#/components/schemas/EmailAccount'
 *       400:
 *         description: 无效的请求
 *       404:
 *         description: 邮箱账户不存在
 *       409:
 *         description: 邮箱地址已被其他账户使用
 */
router.put('/:id', updateEmailAccount);

/**
 * @swagger
 * /api/email-accounts/{id}:
 *   delete:
 *     summary: 删除邮箱账户
 *     tags: [邮箱管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: 邮箱账户ID
 *     responses:
 *       200:
 *         description: 成功删除邮箱账户
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 删除邮箱账户成功
 *       400:
 *         description: 默认邮箱不能删除
 *       404:
 *         description: 邮箱账户不存在
 */
router.delete('/:id', deleteEmailAccount);

/**
 * @swagger
 * /api/email-accounts/{id}/status:
 *   patch:
 *     summary: 设置邮箱账户状态（启用/禁用）
 *     tags: [邮箱管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: 邮箱账户ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, disabled]
 *                 example: active
 *     responses:
 *       200:
 *         description: 成功设置邮箱状态
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 邮箱账户状态已启用
 *       400:
 *         description: 无效的状态值
 *       404:
 *         description: 邮箱账户不存在
 */
router.patch('/:id/status', setEmailAccountStatus);

/**
 * @swagger
 * /api/email-accounts/{id}/default:
 *   patch:
 *     summary: 设置默认邮箱账户
 *     tags: [邮箱管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: 邮箱账户ID
 *     responses:
 *       200:
 *         description: 成功设置默认邮箱账户
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 默认邮箱账户设置成功
 *       400:
 *         description: 禁用的邮箱账户不能设为默认
 *       404:
 *         description: 邮箱账户不存在
 */
router.patch('/:id/default', setDefaultEmailAccount);

/**
 * @swagger
 * /api/email-accounts/{id}/test:
 *   post:
 *     summary: 测试邮箱账户配置
 *     tags: [邮箱管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: 邮箱账户ID
 *     responses:
 *       200:
 *         description: 已开始测试
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 测试已开始
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                       example: false
 *                     message:
 *                       type: string
 *                       example: 测试进行中...
 *                     testId:
 *                       type: string
 *                       example: test-1620000000000-123
 *       404:
 *         description: 邮箱账户不存在
 */
router.post('/:id/test', testEmailAccount);

/**
 * @swagger
 * /api/email-accounts/test/{testId}:
 *   get:
 *     summary: 获取测试结果
 *     tags: [邮箱管理]
 *     parameters:
 *       - in: path
 *         name: testId
 *         schema:
 *           type: string
 *         required: true
 *         description: 测试ID
 *     responses:
 *       200:
 *         description: 成功获取测试结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 获取测试结果成功
 *                 data:
 *                   $ref: '#/components/schemas/EmailAccountTestResult'
 *       404:
 *         description: 测试结果不存在或已过期
 */
router.get('/test/:testId', getTestResult);

/**
 * @swagger
 * /api/email-accounts/{id}/messages:
 *   get:
 *     summary: 获取邮箱账户的邮件列表
 *     tags: [邮箱管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: 邮箱账户ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: 限制返回的邮件数量
 *       - in: query
 *         name: mailbox
 *         schema:
 *           type: string
 *         description: 邮箱文件夹，默认为INBOX
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜索过滤条件
 *       - in: query
 *         name: markSeen
 *         schema:
 *           type: boolean
 *         description: 是否标记为已读
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 开始日期
 *       - in: query
 *         name: before
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 结束日期
 *     responses:
 *       200:
 *         description: 成功获取邮件列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 获取邮件列表成功
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GmailMessageSummary'
 *       400:
 *         description: 邮箱账户未激活或参数无效
 *       404:
 *         description: 邮箱账户不存在
 */
router.get('/:id/messages', getEmailMessages);

/**
 * @swagger
 * /api/email-accounts/{id}/messages/{uid}:
 *   get:
 *     summary: 获取邮件详情
 *     tags: [邮箱管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: 邮箱账户ID
 *       - in: path
 *         name: uid
 *         schema:
 *           type: integer
 *         required: true
 *         description: 邮件UID
 *       - in: query
 *         name: mailbox
 *         schema:
 *           type: string
 *         description: 邮箱文件夹，默认为INBOX
 *     responses:
 *       200:
 *         description: 成功获取邮件详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: 获取邮件详情成功
 *                 data:
 *                   $ref: '#/components/schemas/GmailMessage'
 *       400:
 *         description: 邮箱账户未激活或参数无效
 *       404:
 *         description: 邮箱账户不存在或邮件不存在
 */
router.get('/:id/messages/:uid', getEmailMessageDetail);

export default router;