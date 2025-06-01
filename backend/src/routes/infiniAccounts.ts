/**
 * Infini账户路由
 * 处理与Infini账户相关的API请求
 */
import express from 'express';
import { createBusinessContextMiddleware } from '../utils/BusinessContextExample';
import {
  uploadKycImage,
  uploadKycImageMiddleware,
  getAllInfiniAccounts,
  getInfiniAccountById,
  loginInfiniAccount,
  createInfiniAccount,
  syncInfiniAccount,
  syncAllInfiniAccounts,
  syncAllInfiniAccountsKyc,
  updateInfiniAccount,
  deleteInfiniAccount,
  sendVerificationCode,
  fetchVerificationCode,
  sendAndWaitVerificationCode,
  getGoogle2faQrcode,
  sendGoogle2faVerificationEmail,
  bindGoogle2fa,
  submitPassportKyc,
  getKycInformation,
  getBasicInformation,
  getCardPrice,
  getAvailableCardTypes,
  createCard,
  getCardList,
  update2faInfo,
  oneClickAccountSetup,
  // 分页获取Infini账户
  getPaginatedInfiniAccounts,
  // 恢复账户相关控制器
  resetPassword,
  unbindGoogle2fa,
  recoverAccount,
  batchRecoverAccounts,
  // 账户分组相关控制器
  getAllAccountGroups,
  getAccountGroupById,
  createAccountGroup,
  updateAccountGroup,
  deleteAccountGroup,
  addAccountToGroup,
  addAccountsToGroup,
  removeAccountFromGroup,
  removeAccountsFromGroup,
  // 账户统计信息
  getAccountStatistics
} from '../controllers/infiniAccountController';
const router = express.Router();

// 为所有账户相关路由设置业务上下文
router.use(createBusinessContextMiddleware('account', 'general'));

/**
 * @swagger
 * /api/infini-accounts/statistics:
 *   get:
 *     summary: 获取账户统计信息
 *     description: 获取系统中所有账户的统计信息，包括账户总数、有余额账户总数、有红包余额账户总数、总余额和现有卡片总数
 *     tags: [InfiniAccounts]
 *     responses:
 *       200:
 *         description: 成功获取账户统计信息
 *       500:
 *         description: 服务器错误
 */
router.get('/statistics', getAccountStatistics);
/**
 * @swagger
 * /api/infini-accounts/2fa/qrcode:
 *   get:
 *     summary: 获取Infini 2FA二维码
 *     tags: [InfiniAccounts]
 *     responses:
 *       200:
 *         description: 成功获取2FA二维码
 *       400:
 *         description: 请求参数错误或未提供Cookie
 *       500:
 *         description: 服务器错误
 */
router.get('/2fa/qrcode', 
  createBusinessContextMiddleware('account', '2fa_qrcode'),
  getGoogle2faQrcode
);
/**
 * @swagger
 * /api/infini-accounts/2fa/verify-email:
 *   post:
 *     summary: 发送Infini 2FA验证邮件
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *             required:
 *               - email
 *     responses:
 *       200:
 *         description: 2FA验证邮件发送成功
 *       400:
 *         description: 请求参数错误或未提供Cookie
 *       500:
 *         description: 服务器错误
 */
router.post('/2fa/verify-email', sendGoogle2faVerificationEmail);
/**
 * @swagger
 * /api/infini-accounts/2fa/bind:
 *   post:
 *     summary: 绑定Infini 2FA
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               verification_code:
 *                 type: string
 *                 example: "123456"
 *               google_2fa_code:
 *                 type: string
 *                 example: "123456"
 *             required:
 *               - verification_code
 *               - google_2fa_code
 *     responses:
 *       200:
 *         description: 2FA绑定成功
 *       400:
 *         description: 请求参数错误或未提供Cookie
 *       500:
 *         description: 服务器错误
 */
router.post('/2fa/bind', bindGoogle2fa);
/**
 * @swagger
 * /api/infini-accounts/verify:
 *   post:
 *     summary: 发送Infini账户注册验证码
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *             required:
 *               - email
 *     responses:
 *       200:
 *         description: 验证码发送成功
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
router.post('/verify', sendVerificationCode);

/**
 * @swagger
 * /api/infini-accounts/kyc/upload:
 *   post:
 *     summary: 上传KYC图片到Infini系统
 *     tags: [InfiniAccounts]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *         required: true
 *         description: 要上传的KYC图片文件
 *       - in: formData
 *         name: accountId
 *         type: string
 *         required: true
 *         description: Infini账户ID
 *     responses:
 *       200:
 *         description: 图片上传成功，返回文件名
 *       400:
 *         description: 请求参数错误或未提供文件
 *       500:
 *         description: 服务器错误
 */
router.post('/kyc/upload', uploadKycImageMiddleware, uploadKycImage);

/**
 * @swagger
 * /api/infini-accounts/kyc/passport:
 *   post:
 *     summary: 提交护照KYC验证
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accountId:
 *                 type: string
 *                 description: Infini账户ID
 *                 example: "1"
 *               phoneNumber:
 *                 type: string
 *                 description: 电话号码
 *                 example: "7012555332"
 *               phoneCode:
 *                 type: string
 *                 description: 国际电话区号
 *                 example: "+1"
 *               firstName:
 *                 type: string
 *                 description: 名字
 *                 example: "Zhao"
 *               lastName:
 *                 type: string
 *                 description: 姓氏
 *                 example: "LinLong"
 *               country:
 *                 type: string
 *                 description: 国家代码
 *                 example: "CHN"
 *               passportNumber:
 *                 type: string
 *                 description: 护照号码
 *                 example: "1244511441"
 *               fileName:
 *                 type: string
 *                 description: 已上传的KYC图片文件名
 *                 example: "fd6b435f-2b64-4a0c-ab3d-793e6dea6e03.png"
 *             required:
 *               - accountId
 *               - phoneNumber
 *               - phoneCode
 *               - firstName
 *               - lastName
 *               - country
 *               - passportNumber
 *               - fileName
 *     responses:
 *       200:
 *         description: 护照KYC验证提交成功
 *       400:
 *         description: 请求参数错误或缺少必要字段
 *       500:
 *         description: 服务器错误
 */
router.post('/kyc/passport', submitPassportKyc);

/**
 * @swagger
 * /api/infini-accounts/kyc/information/{accountId}:
 *   get:
 *     summary: 获取KYC信息
 *     description: 获取指定账户的KYC信息，先从数据库查询，如果没有记录则调用API获取并保存到数据库
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         schema:
 *           type: string
 *         required: true
 *         description: Infini账户ID
 *     responses:
 *       200:
 *         description: 成功获取KYC信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     kyc_information:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "19432f66-4112-426c-afde-2e8208c8ab16"
 *                           is_valid:
 *                             type: boolean
 *                             example: false
 *                           type:
 *                             type: integer
 *                             example: 0
 *                           s3_key:
 *                             type: string
 *                             example: "fd6b435f-2b64-4a0c-ab3d-793e6dea6e03.png"
 *                           first_name:
 *                             type: string
 *                             example: "Zhao"
 *                           last_name:
 *                             type: string
 *                             example: "LinLong"
 *                           country:
 *                             type: string
 *                             example: "CHN"
 *                           phone:
 *                             type: string
 *                             example: "7012555332"
 *                           phone_code:
 *                             type: string
 *                             example: "+1"
 *                           identification_number:
 *                             type: string
 *                             example: "1244511441"
 *                           status:
 *                             type: integer
 *                             example: 0
 *                           created_at:
 *                             type: integer
 *                             example: 1746791056
 *       404:
 *         description: 账户不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/kyc/information/:accountId', getKycInformation);

/**
 * @swagger
 * /api/infini-accounts/kyc/basic/information/{accountId}:
 *   get:
 *     summary: 获取用户基本信息
 *     description: 获取指定账户的基本信息，成功获取后会将账户验证级别更新为基础认证(1)
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         schema:
 *           type: string
 *         required: true
 *         description: Infini账户ID
 *     responses:
 *       200:
 *         description: 成功获取用户基本信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     basic_information:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "19432f66-4112-426c-afde-2e8208c8ab16"
 *                         first_name:
 *                           type: string
 *                           example: "Zhao"
 *                         last_name:
 *                           type: string
 *                           example: "LinLong"
 *                         country:
 *                           type: string
 *                           example: "CHN"
 *                         phone:
 *                           type: string
 *                           example: "7012555332"
 *                         phone_code:
 *                           type: string
 *                           example: "+1"
 *                         birthday:
 *                           type: string
 *                           example: ""
 *                         created_at:
 *                           type: integer
 *                           example: 1746791056
 *       404:
 *         description: 账户不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/kyc/basic/information/:accountId', getBasicInformation);

/**
 * @swagger
 * /api/infini-accounts/verify-and-wait:
 *   post:
 *     summary: 发送Infini账户注册验证码并等待获取
 *     tags: [InfiniAccounts] 
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:  
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *             required:
 *               - email
 *     responses:
 *       200:
 *         description: 验证码发送成功
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
router.post('/verify-and-wait', sendAndWaitVerificationCode);


/**
 * @swagger
 * /api/infini-accounts/verify-code:
 *   get:
 *     summary: 获取Infini账户注册验证码
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         required: true
 *         description: 注册邮箱
 *     responses:
 *       200:
 *         description: 成功获取验证码
 *       404:
 *         description: 未找到验证码
 *       500:
 *         description: 服务器错误
 */
router.get('/verify-code', fetchVerificationCode);

/**
 * @swagger
 * /api/infini-accounts/sync-all:
 *   post:
 *     summary: 批量同步所有Infini账户信息
 *     tags: [InfiniAccounts]
 *     responses:
 *       200:
 *         description: 批量同步完成，返回同步结果
 *       500:
 *         description: 服务器错误
 */
router.post('/sync-all', syncAllInfiniAccounts);

/**
 * @swagger
 * /api/infini-accounts/sync-all-kyc:
 *   post:
 *     summary: 批量同步所有Infini账户KYC信息
 *     description: 批量同步所有账户的KYC信息，已完成KYC状态的账户会被跳过再次同步
 *     tags: [InfiniAccounts]
 *     responses:
 *       200:
 *         description: 批量同步KYC信息完成，返回同步结果
 *       500:
 *         description: 服务器错误
 */
router.post('/sync-all-kyc', syncAllInfiniAccountsKyc);

/**
 * @swagger
 * /api/infini-accounts:
 *   get:
 *     summary: 获取所有Infini账户
 *     tags: [InfiniAccounts]
 *     responses:
 *       200:
 *         description: 成功获取所有Infini账户
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InfiniAccount'
 *       500:
 *         description: 服务器错误
 */
router.get('/', getAllInfiniAccounts);

/**
 * @swagger
 * /api/infini-accounts/paginated:
 *   get:
 *     summary: 获取分页的Infini账户列表
 *     description: 支持分页、筛选和排序功能，并关联查询卡片数量
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: 页码，默认为1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *         description: 每页记录数，默认为10
 *       - in: query
 *         name: filters
 *         schema:
 *           type: string
 *         description: JSON格式的筛选条件
 *       - in: query
 *         name: sortField
 *         schema:
 *           type: string
 *         description: 排序字段
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: 排序方向
 *       - in: query
 *         name: groupId
 *         schema:
 *           type: string
 *         description: 账户分组ID，用于筛选特定分组的账户
 *     responses:
 *       200:
 *         description: 成功获取分页的Infini账户列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     accounts:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         current:
 *                           type: integer
 *                           example: 1
 *                         pageSize:
 *                           type: integer
 *                           example: 10
 *                         total:
 *                           type: integer
 *                           example: 100
 *                         totalPages:
 *                           type: integer
 *                           example: 10
 *       500:
 *         description: 服务器错误
 */
router.get('/paginated', getPaginatedInfiniAccounts);

/**
 * @swagger
 * /api/infini-accounts/login:
 *   post:
 *     summary: 测试Infini账户登录
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *             required:
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: 登录成功，返回账户信息
 *       400:
 *         description: 请求参数错误或登录失败
 *       500:
 *         description: 服务器错误
 */
router.post('/login', 
  createBusinessContextMiddleware('account', 'login', (req) => ({
    email: req.body.email
  })),
  loginInfiniAccount
);

/**
 * @swagger
 * /api/infini-accounts:
 *   post:
 *     summary: 创建Infini账户
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: "user@example.com"
 *               password:
 *                 type: string
 *                 example: "password123"
 *             required:
 *               - email
 *               - password
 *     responses:
 *       201:
 *         description: 成功创建Infini账户
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
router.post('/', 
  createBusinessContextMiddleware('account', 'create', (req) => ({
    email: req.body.email
  })), 
  createInfiniAccount
);

/**
 * @swagger
 * /api/infini-accounts/groups:
 *   get:
 *     summary: 获取所有账户分组
 *     description: 获取系统中的所有账户分组，包含每个分组关联的账户数量
 *     tags: [InfiniAccounts]
 *     responses:
 *       200:
 *         description: 成功获取所有账户分组
 *       500:
 *         description: 服务器错误
 */
router.get('/groups', getAllAccountGroups);

/**
 * @swagger
 * /api/infini-accounts/groups/{id}:
 *   get:
 *     summary: 获取单个账户分组
 *     description: 获取指定ID的账户分组详情，包含分组关联的账户列表
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 分组ID
 *     responses:
 *       200:
 *         description: 成功获取账户分组详情
 *       404:
 *         description: 分组不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/groups/:id', getAccountGroupById);

/**
 * @swagger
 * /api/infini-accounts/groups:
 *   post:
 *     summary: 创建账户分组
 *     description: 创建新的账户分组
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 分组名称
 *                 example: "VIP账户"
 *               description:
 *                 type: string
 *                 description: 分组描述
 *                 example: "VIP客户的账户分组"
 *             required:
 *               - name
 *     responses:
 *       201:
 *         description: 成功创建账户分组
 *       400:
 *         description: 请求参数错误或分组名称已存在
 *       500:
 *         description: 服务器错误
 */
router.post('/groups', createAccountGroup);

/**
 * @swagger
 * /api/infini-accounts/groups/{id}:
 *   put:
 *     summary: 更新账户分组
 *     description: 更新指定ID的账户分组信息
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 分组ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 分组名称
 *                 example: "新VIP账户"
 *               description:
 *                 type: string
 *                 description: 分组描述
 *                 example: "更新后的VIP客户账户分组描述"
 *     responses:
 *       200:
 *         description: 成功更新账户分组
 *       400:
 *         description: 请求参数错误、分组名称已存在或尝试修改默认分组名称
 *       404:
 *         description: 分组不存在
 *       500:
 *         description: 服务器错误
 */
router.put('/groups/:id', updateAccountGroup);

/**
 * @swagger
 * /api/infini-accounts/groups/{id}:
 *   delete:
 *     summary: 删除账户分组
 *     description: 删除指定ID的账户分组（默认分组不可删除）
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 分组ID
 *     responses:
 *       200:
 *         description: 成功删除账户分组
 *       400:
 *         description: 请求参数错误或尝试删除默认分组
 *       404:
 *         description: 分组不存在
 *       500:
 *         description: 服务器错误
 */
router.delete('/groups/:id', deleteAccountGroup);

/**
 * @swagger
 * /api/infini-accounts/groups/account/add:
 *   post:
 *     summary: 添加账户到分组
 *     description: 将指定账户添加到指定分组
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupId:
 *                 type: string
 *                 description: 分组ID
 *                 example: "1"
 *               accountId:
 *                 type: string
 *                 description: 账户ID
 *                 example: "2"
 *             required:
 *               - groupId
 *               - accountId
 *     responses:
 *       200:
 *         description: 成功添加账户到分组
 *       400:
 *         description: 请求参数错误
 *       404:
 *         description: 分组或账户不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/groups/account/add', addAccountToGroup);

/**
 * @swagger
 * /api/infini-accounts/groups/accounts/add:
 *   post:
 *     summary: 批量添加账户到分组
 *     description: 将多个账户批量添加到指定分组
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupId:
 *                 type: string
 *                 description: 分组ID
 *                 example: "1"
 *               accountIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 账户ID数组
 *                 example: ["2", "3", "4"]
 *             required:
 *               - groupId
 *               - accountIds
 *     responses:
 *       200:
 *         description: 成功批量添加账户到分组
 *       400:
 *         description: 请求参数错误
 *       404:
 *         description: 分组不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/groups/accounts/add', addAccountsToGroup);

/**
 * @swagger
 * /api/infini-accounts/groups/account/remove:
 *   post:
 *     summary: 从分组中移除账户
 *     description: 将指定账户从指定分组中移除（不能从默认分组中移除账户，除非账户同时属于其他分组）
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupId:
 *                 type: string
 *                 description: 分组ID
 *                 example: "1"
 *               accountId:
 *                 type: string
 *                 description: 账户ID
 *                 example: "2"
 *             required:
 *               - groupId
 *               - accountId
 *     responses:
 *       200:
 *         description: 成功从分组中移除账户
 *       400:
 *         description: 请求参数错误或尝试从默认分组中移除唯一分组的账户
 *       404:
 *         description: 分组或账户不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/groups/account/remove', removeAccountFromGroup);

/**
 * @swagger
 * /api/infini-accounts/groups/accounts/remove:
 *   post:
 *     summary: 批量从分组中移除账户
 *     description: 将多个账户批量从指定分组中移除（不能从默认分组中移除账户，除非账户同时属于其他分组）
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupId:
 *                 type: string
 *                 description: 分组ID
 *                 example: "1"
 *               accountIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 账户ID数组
 *                 example: ["2", "3", "4"]
 *             required:
 *               - groupId
 *               - accountIds
 *     responses:
 *       200:
 *         description: 成功从分组中批量移除账户
 *       400:
 *         description: 请求参数错误或尝试从默认分组中移除唯一分组的账户
 *       404:
 *         description: 分组不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/groups/accounts/remove', removeAccountsFromGroup);

/**
 * @swagger
 * /api/infini-accounts/reset-password:
 *   post:
 *     summary: 重置账户密码
 *     description: 重置Infini账户的密码
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: 账户邮箱
 *                 example: "user@example.com"
 *               verificationCode:
 *                 type: string
 *                 description: 验证码
 *                 example: "123456"
 *             required:
 *               - email
 *               - verificationCode
 *     responses:
 *       200:
 *         description: 重置密码成功
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
router.post('/reset-password', resetPassword);

/**
 * @swagger
 * /api/infini-accounts/unbind-2fa:
 *   post:
 *     summary: 解绑2FA
 *     description: 解绑Infini账户的2FA
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accountId:
 *                 type: string
 *                 description: 账户ID
 *                 example: "1"
 *               google2faToken:
 *                 type: string
 *                 description: 2FA验证码
 *                 example: "123456"
 *               password:
 *                 type: string
 *                 description: 账户密码
 *                 example: "password123"
 *             required:
 *               - accountId
 *               - google2faToken
 *     responses:
 *       200:
 *         description: 解绑2FA成功
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
router.post('/unbind-2fa', unbindGoogle2fa);

/**
 * @swagger
 * /api/infini-accounts/recover:
 *   post:
 *     summary: 恢复账户
 *     description: 恢复Infini账户
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: 账户邮箱
 *                 example: "user@example.com"
 *             required:
 *               - email
 *     responses:
 *       200:
 *         description: 恢复账户成功
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
router.post('/recover', recoverAccount);

/**
 * @swagger
 * /api/infini-accounts/batch-recover:
 *   post:
 *     summary: 批量恢复账户
 *     description: 批量恢复Infini账户
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               emails:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 账户邮箱列表
 *                 example: ["user1@example.com", "user2@example.com"]
 *             required:
 *               - emails
 *     responses:
 *       200:
 *         description: 批量恢复账户成功
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
router.post('/batch-recover', batchRecoverAccounts);

/**
 * @swagger
 * /api/infini-accounts/{id}:
 *   get:
 *     summary: 获取单个Infini账户
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Infini账户ID
 *     responses:
 *       200:
 *         description: 成功获取Infini账户
 *       404:
 *         description: 账户不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/:id', getInfiniAccountById);

/**
 * @swagger
 * /api/infini-accounts/{id}/sync:
 *   post:
 *     summary: 同步Infini账户信息
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Infini账户ID
 *     responses:
 *       200:
 *         description: 账户信息同步成功
 *       404:
 *         description: 账户不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/:id/sync', syncInfiniAccount);

/**
 * @swagger
 * /api/infini-accounts/{id}:
 *   put:
 *     summary: 更新Infini账户信息
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Infini账户ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               password:
 *                 type: string
 *                 example: "newpassword123"
 *     responses:
 *       200:
 *         description: 账户信息更新成功
 *       404:
 *         description: 账户不存在
 *       500:
 *         description: 服务器错误
 */
router.put('/:id', updateInfiniAccount);

/**
 * @swagger
 * /api/infini-accounts/{id}:
 *   delete:
 *     summary: 删除Infini账户
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Infini账户ID
 *     responses:
 *       200:
 *         description: 账户删除成功
 *       404:
 *         description: 账户不存在
 *       500:
 *         description: 服务器错误
 */
router.delete('/:id', deleteInfiniAccount);

/**
 * @swagger
 * /api/infini-accounts/card/price/{accountId}:
 *   get:
 *     summary: 获取开卡金额
 *     description: 获取指定账户的开卡金额信息
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         schema:
 *           type: string
 *         required: true
 *         description: Infini账户ID
 *       - in: query
 *         name: cardType
 *         schema:
 *           type: string
 *         required: false
 *         description: 卡片类型，默认为3
 *     responses:
 *       200:
 *         description: 成功获取开卡金额
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     price:
 *                       type: number
 *                       example: 6.6
 *                     discount:
 *                       type: number
 *                       example: 3.3
 *                     cover:
 *                       type: string
 *                       example: ""
 *                     mastercard_cover:
 *                       type: string
 *                       example: ""
 *                     visa_cover:
 *                       type: string
 *                       example: ""
 *                     partner_name:
 *                       type: string
 *                       example: ""
 *       404:
 *         description: 账户不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/card/price/:accountId', getCardPrice);

/**
 * @swagger
 * /api/infini-accounts/card/available/{accountId}:
 *   get:
 *     summary: 获取可用的卡类型
 *     description: 获取指定账户可用的卡类型
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         schema:
 *           type: string
 *         required: true
 *         description: Infini账户ID
 *     responses:
 *       200:
 *         description: 成功获取可用卡类型
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     card_status:
 *                       type: object
 *                       example: {"0": 3, "3": 2}
 *       404:
 *         description: 账户不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/card/available/:accountId', getAvailableCardTypes);

/**
 * @swagger
 * /api/infini-accounts/card/create/{accountId}:
 *   post:
 *     summary: 创建卡
 *     description: 为指定账户创建新卡
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         schema:
 *           type: string
 *         required: true
 *         description: Infini账户ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cardType:
 *                 type: integer
 *                 example: 3
 *                 description: 卡片类型，默认为3
 *     responses:
 *       200:
 *         description: 成功创建卡
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 18060
 *       404:
 *         description: 账户不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/card/create/:accountId', createCard);

/**
 * @swagger
 * /api/infini-accounts/card/list/{accountId}:
 *   get:
 *     summary: 获取卡片列表
 *     description: 获取指定账户的卡片列表
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         schema:
 *           type: string
 *         required: true
 *         description: Infini账户ID
 *     responses:
 *       200:
 *         description: 成功获取卡片列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           card_id:
 *                             type: string
 *                             example: ""
 *                           status:
 *                             type: string
 *                             example: ""
 *                           currency:
 *                             type: string
 *                             example: ""
 *                           provider:
 *                             type: string
 *                             example: "BudgetCard_454924"
 *                           username:
 *                             type: string
 *                             example: ""
 *                           card_last_four_digits:
 *                             type: string
 *                             example: ""
 *                           issue_type:
 *                             type: string
 *                             example: "visa"
 *                           card_address:
 *                             type: string
 *                             example: ""
 *                           label:
 *                             type: string
 *                             example: ""
 *                           partner_cover:
 *                             type: string
 *                             example: ""
 *                           consumption_limit:
 *                             type: string
 *                             example: ""
 *                           is_default:
 *                             type: boolean
 *                             example: false
 *                           available_balance:
 *                             type: string
 *                             example: "0"
 *                           budget_card_type:
 *                             type: integer
 *                             example: 3
 *                           daily_consumption:
 *                             type: string
 *                             example: "0"
 *                           name:
 *                             type: string
 *                             example: ""
 *       404:
 *         description: 账户不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/card/list/:accountId', getCardList);

/**
 * @swagger
 * /api/infini-accounts/2fa/info/{accountId}:
 *   put:
 *     summary: 更新账户2FA信息
 *     description: 更新指定账户的2FA信息，包括二维码URL、密钥和恢复码
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: accountId
 *         schema:
 *           type: string
 *         required: true
 *         description: Infini账户ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               qr_code_url:
 *                 type: string
 *                 description: 2FA二维码URL
 *                 example: "otpauth://totp/Infini:user@example.com?secret=ABCDEFGHIJKLMNOP&issuer=Infini"
 *               secret_key:
 *                 type: string
 *                 description: 2FA密钥
 *                 example: "ABCDEFGHIJKLMNOP"
 *               recovery_codes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 恢复码数组
 *                 example: ["12345678", "87654321"]
 *     responses:
 *       200:
 *         description: 2FA信息更新成功
 *       400:
 *         description: 请求参数错误或账户不存在
 *       500:
 *         description: 服务器错误
 */
router.put('/2fa/info/:accountId', update2faInfo);

/**
 * @swagger
 * /api/infini-accounts/groups:
 *   get:
 *     summary: 获取所有账户分组
 *     description: 获取系统中的所有账户分组，包含每个分组关联的账户数量
 *     tags: [InfiniAccounts]
 *     responses:
 *       200:
 *         description: 成功获取所有账户分组
 *       500:
 *         description: 服务器错误
 */
router.get('/groups', getAllAccountGroups);

/**
 * @swagger
 * /api/infini-accounts/groups/{id}:
 *   get:
 *     summary: 获取单个账户分组
 *     description: 获取指定ID的账户分组详情，包含分组关联的账户列表
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 分组ID
 *     responses:
 *       200:
 *         description: 成功获取账户分组详情
 *       404:
 *         description: 分组不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/groups/:id', getAccountGroupById);

/**
 * @swagger
 * /api/infini-accounts/groups:
 *   post:
 *     summary: 创建账户分组
 *     description: 创建新的账户分组
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 分组名称
 *                 example: "VIP账户"
 *               description:
 *                 type: string
 *                 description: 分组描述
 *                 example: "VIP客户的账户分组"
 *             required:
 *               - name
 *     responses:
 *       201:
 *         description: 成功创建账户分组
 *       400:
 *         description: 请求参数错误或分组名称已存在
 *       500:
 *         description: 服务器错误
 */
router.post('/groups', createAccountGroup);

/**
 * @swagger
 * /api/infini-accounts/groups/{id}:
 *   put:
 *     summary: 更新账户分组
 *     description: 更新指定ID的账户分组信息
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 分组ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 分组名称
 *                 example: "新VIP账户"
 *               description:
 *                 type: string
 *                 description: 分组描述
 *                 example: "更新后的VIP客户账户分组描述"
 *     responses:
 *       200:
 *         description: 成功更新账户分组
 *       400:
 *         description: 请求参数错误、分组名称已存在或尝试修改默认分组名称
 *       404:
 *         description: 分组不存在
 *       500:
 *         description: 服务器错误
 */
router.put('/groups/:id', updateAccountGroup);

/**
 * @swagger
 * /api/infini-accounts/groups/{id}:
 *   delete:
 *     summary: 删除账户分组
 *     description: 删除指定ID的账户分组（默认分组不可删除）
 *     tags: [InfiniAccounts]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 分组ID
 *     responses:
 *       200:
 *         description: 成功删除账户分组
 *       400:
 *         description: 请求参数错误或尝试删除默认分组
 *       404:
 *         description: 分组不存在
 *       500:
 *         description: 服务器错误
 */
router.delete('/groups/:id', deleteAccountGroup);

/**
 * @swagger
 * /api/infini-accounts/groups/account/add:
 *   post:
 *     summary: 添加账户到分组
 *     description: 将指定账户添加到指定分组
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupId:
 *                 type: string
 *                 description: 分组ID
 *                 example: "1"
 *               accountId:
 *                 type: string
 *                 description: 账户ID
 *                 example: "2"
 *             required:
 *               - groupId
 *               - accountId
 *     responses:
 *       200:
 *         description: 成功添加账户到分组
 *       400:
 *         description: 请求参数错误
 *       404:
 *         description: 分组或账户不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/groups/account/add', addAccountToGroup);

/**
 * @swagger
 * /api/infini-accounts/groups/accounts/add:
 *   post:
 *     summary: 批量添加账户到分组
 *     description: 将多个账户批量添加到指定分组
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupId:
 *                 type: string
 *                 description: 分组ID
 *                 example: "1"
 *               accountIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 账户ID数组
 *                 example: ["2", "3", "4"]
 *             required:
 *               - groupId
 *               - accountIds
 *     responses:
 *       200:
 *         description: 成功批量添加账户到分组
 *       400:
 *         description: 请求参数错误
 *       404:
 *         description: 分组不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/groups/accounts/add', addAccountsToGroup);

/**
 * @swagger
 * /api/infini-accounts/groups/account/remove:
 *   post:
 *     summary: 从分组中移除账户
 *     description: 将指定账户从指定分组中移除（不能从默认分组中移除账户，除非账户同时属于其他分组）
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupId:
 *                 type: string
 *                 description: 分组ID
 *                 example: "1"
 *               accountId:
 *                 type: string
 *                 description: 账户ID
 *                 example: "2"
 *             required:
 *               - groupId
 *               - accountId
 *     responses:
 *       200:
 *         description: 成功从分组中移除账户
 *       400:
 *         description: 请求参数错误或尝试从默认分组中移除唯一分组的账户
 *       404:
 *         description: 分组或账户不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/groups/account/remove', removeAccountFromGroup);

/**
 * @swagger
 * /api/infini-accounts/groups/accounts/remove:
 *   post:
 *     summary: 批量从分组中移除账户
 *     description: 将多个账户批量从指定分组中移除（不能从默认分组中移除账户，除非账户同时属于其他分组）
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               groupId:
 *                 type: string
 *                 description: 分组ID
 *                 example: "1"
 *               accountIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 账户ID数组
 *                 example: ["2", "3", "4"]
 *             required:
 *               - groupId
 *               - accountIds
 *     responses:
 *       200:
 *         description: 成功从分组中批量移除账户
 *       400:
 *         description: 请求参数错误或尝试从默认分组中移除唯一分组的账户
 *       404:
 *         description: 分组不存在
 *       500:
 *         description: 服务器错误
 */
router.post('/groups/accounts/remove', removeAccountsFromGroup);

/**
 * @swagger
 * /api/infini-accounts/one-click-setup:
 *   post:
 *     summary: 一键式账户设置
 *     description: 自动执行随机用户注册、2FA认证、KYC验证和开卡流程，其中注册用户是必须的，其他三个过程互相独立
 *     tags: [InfiniAccounts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               setupOptions:
 *                 type: object
 *                 properties:
 *                   enable2fa:
 *                     type: boolean
 *                     description: 是否启用2FA认证
 *                     example: true
 *                   enableKyc:
 *                     type: boolean
 *                     description: 是否启用KYC验证
 *                     example: true
 *                   enableCard:
 *                     type: boolean
 *                     description: 是否启用开卡
 *                     example: true
 *                   cardType:
 *                     type: integer
 *                     description: 卡片类型，默认为3
 *                     example: 3
 *                 required:
 *                   - enable2fa
 *                   - enableKyc
 *                   - enableCard
 *               userData:
 *                 type: object
 *                 properties:
 *                   email_suffix:
 *                     type: string
 *                     description: 邮箱后缀
 *                     example: "example.com"
 *                 required:
 *                   - email_suffix
 *             required:
 *               - setupOptions
 *               - userData
 *     responses:
 *       201:
 *         description: 一键式账户设置成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 accountId:
 *                   type: string
 *                   example: "123"
 *                 randomUser:
 *                   type: object
 *                   description: 生成的随机用户信息
 *                 account:
 *                   type: object
 *                   description: 创建的Infini账户信息
 *                 steps:
 *                   type: object
 *                   properties:
 *                     register:
 *                       type: object
 *                       properties:
 *                         success:
 *                           type: boolean
 *                           example: true
 *                     twoFa:
 *                       type: object
 *                       description: 2FA设置结果
 *                     kyc:
 *                       type: object
 *                       description: KYC验证结果
 *                     card:
 *                       type: object
 *                       description: 开卡结果
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
router.post('/one-click-setup', oneClickAccountSetup);

/**
 * @swagger
 * /api/infini-accounts/statistics:
 *   get:
 *     summary: 获取账户统计信息
 *     description: 获取系统中账户的统计信息，包括总数、有余额账户数、有红包余额账户数等
 *     tags: [InfiniAccounts]
 *     responses:
 *       200:
 *         description: 成功获取统计信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalAccounts:
 *                       type: number
 *                       example: 100
 *                     accountsWithBalance:
 *                       type: number
 *                       example: 75
 *                     accountsWithRedPacket:
 *                       type: number
 *                       example: 50
 *                     totalBalance:
 *                       type: number
 *                       example: 15000.50
 *                     totalCards:
 *                       type: number
 *                       example: 120
 *       500:
 *         description: 服务器错误
 */
router.get('/statistics', getAccountStatistics);

export default router;