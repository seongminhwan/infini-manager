/**
 * TOTP工具路由
 * 处理与TOTP验证码生成相关的API请求
 * 包含二维码生成功能，避免使用第三方API导致TOTP密钥泄露
 */
import express from 'express';
import { generateTotpCode, generateQrCodeImage } from '../controllers/totpToolController';

const router = express.Router();

/**
 * @swagger
 * /api/totp-tools/generate:
 *   post:
 *     summary: 生成TOTP验证码
 *     tags: [TotpTools]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input:
 *                 type: string
 *                 example: "otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example"
 *                 description: TOTP URL或者密钥字符串
 *             required:
 *               - input
 *     responses:
 *       200:
 *         description: 成功生成TOTP验证码
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
 *                     code:
 *                       type: string
 *                       example: "123456"
 *                       description: 生成的验证码
 *                     remainingSeconds:
 *                       type: number
 *                       example: 15
 *                       description: 验证码剩余有效时间(秒)
 *                     type:
 *                       type: string
 *                       example: "totp"
 *                     issuer:
 *                       type: string
 *                       example: "Example"
 *                       description: 颁发者
 *                     account:
 *                       type: string
 *                       example: "alice@example.com"
 *                       description: 账户名
 *                     period:
 *                       type: number
 *                       example: 30
 *                       description: 验证码更新周期(秒)
 *                     digits:
 *                       type: number
 *                       example: 6
 *                       description: 验证码位数
 *       400:
 *         description: 请求参数错误或TOTP解析失败
 *       500:
 *         description: 服务器错误
 */
router.post('/generate', generateTotpCode);

/**
 * @swagger
 * /api/totp-tools/qrcode:
 *   post:
 *     summary: 生成TOTP二维码图像
 *     tags: [TotpTools]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               input:
 *                 type: string
 *                 example: "otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example"
 *                 description: TOTP URL或者密钥字符串
 *               size:
 *                 type: number
 *                 example: 200
 *                 description: 二维码尺寸（像素），可选参数，默认200
 *             required:
 *               - input
 *     responses:
 *       200:
 *         description: 成功生成TOTP二维码
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
 *                     qrCode:
 *                       type: string
 *                       description: Base64格式的二维码图像数据
 *                     url:
 *                       type: string
 *                       description: 生成二维码使用的TOTP URL
 *       400:
 *         description: 请求参数错误或二维码生成失败
 *       500:
 *         description: 服务器错误
 */
router.post('/qrcode', generateQrCodeImage);

export default router;