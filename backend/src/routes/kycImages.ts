/**
 * KYC图片路由
 * 处理与KYC图片相关的请求
 */
import express from 'express';
import {
  getAllKycImages,
  getKycImageById,
  getKycImagesByTags,
  createKycImage,
  updateKycImage,
  deleteKycImage
} from '../controllers/kycImageController';

const router = express.Router();

/**
 * @swagger
 * /api/kyc-images:
 *   get:
 *     summary: 获取所有KYC图片
 *     tags: [KYC管理]
 *     responses:
 *       200:
 *         description: 成功获取KYC图片列表
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
 *                   example: 获取KYC图片列表成功
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/KycImage'
 */
router.get('/', getAllKycImages);

/**
 * @swagger
 * /api/kyc-images/search:
 *   get:
 *     summary: 根据标签查询KYC图片
 *     tags: [KYC管理]
 *     parameters:
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         required: true
 *         description: 标签列表，以逗号分隔
 *     responses:
 *       200:
 *         description: 成功根据标签查询KYC图片
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
 *                   example: 根据标签查询KYC图片成功
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/KycImage'
 */
router.get('/search', getKycImagesByTags);

/**
 * @swagger
 * /api/kyc-images/{id}:
 *   get:
 *     summary: 获取单个KYC图片
 *     tags: [KYC管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: KYC图片ID
 *     responses:
 *       200:
 *         description: 成功获取KYC图片
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
 *                   example: 获取KYC图片成功
 *                 data:
 *                   $ref: '#/components/schemas/KycImage'
 *       404:
 *         description: KYC图片不存在
 */
router.get('/:id', getKycImageById);

/**
 * @swagger
 * /api/kyc-images:
 *   post:
 *     summary: 创建新KYC图片
 *     tags: [KYC管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - img_base64
 *               - tags
 *             properties:
 *               img_base64:
 *                 type: string
 *                 description: 图片的base64编码内容
 *               tags:
 *                 type: string
 *                 description: 图片标签，多个标签用逗号分隔
 *     responses:
 *       201:
 *         description: 成功创建KYC图片
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
 *                   example: 创建KYC图片成功
 *                 data:
 *                   $ref: '#/components/schemas/KycImage'
 *       400:
 *         description: 缺少必要信息
 */
router.post('/', createKycImage);

/**
 * @swagger
 * /api/kyc-images/{id}:
 *   put:
 *     summary: 更新KYC图片
 *     tags: [KYC管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: KYC图片ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               img_base64:
 *                 type: string
 *                 description: 图片的base64编码内容
 *               tags:
 *                 type: string
 *                 description: 图片标签，多个标签用逗号分隔
 *     responses:
 *       200:
 *         description: 成功更新KYC图片
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
 *                   example: 更新KYC图片成功
 *                 data:
 *                   $ref: '#/components/schemas/KycImage'
 *       400:
 *         description: 无效的请求
 *       404:
 *         description: KYC图片不存在
 */
router.put('/:id', updateKycImage);

/**
 * @swagger
 * /api/kyc-images/{id}:
 *   delete:
 *     summary: 删除KYC图片
 *     tags: [KYC管理]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: KYC图片ID
 *     responses:
 *       200:
 *         description: 成功删除KYC图片
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
 *                   example: 删除KYC图片成功
 *       404:
 *         description: KYC图片不存在
 */
router.delete('/:id', deleteKycImage);

export default router;