/**
 * 随机用户信息生成路由
 * 处理与随机用户信息生成相关的API请求
 */
import express from 'express';
import {
  generateRandomUsers,
  getRandomUsers,
  getRandomUserById,
  deleteRandomUser,
  getNameBlacklist,
  addNameToBlacklist,
  removeNameFromBlacklist
} from '../controllers/randomUserController';

const router = express.Router();

/**
 * @swagger
 * /api/random-users:
 *   post:
 *     summary: 生成随机用户信息
 *     tags: [RandomUsers]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email_suffix:
 *                 type: string
 *                 example: "example.com"
 *                 description: 邮箱后缀，可选
 *               count:
 *                 type: integer
 *                 example: 1
 *                 description: 生成数量，默认为1
 *     responses:
 *       201:
 *         description: 成功生成随机用户信息
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
router.post('/', generateRandomUsers);

/**
 * @swagger
 * /api/random-users:
 *   get:
 *     summary: 获取已生成的随机用户信息列表
 *     tags: [RandomUsers]
 *     responses:
 *       200:
 *         description: 成功获取随机用户信息列表
 *       500:
 *         description: 服务器错误
 */
router.get('/', getRandomUsers);

/**
 * @swagger
 * /api/random-users/blacklist:
 *   get:
 *     summary: 获取姓名黑名单列表
 *     tags: [RandomUsers]
 *     responses:
 *       200:
 *         description: 成功获取姓名黑名单列表
 *       500:
 *         description: 服务器错误
 */
router.get('/blacklist', getNameBlacklist);

/**
 * @swagger
 * /api/random-users/{id}:
 *   get:
 *     summary: 获取单个随机用户信息
 *     tags: [RandomUsers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: 随机用户信息ID
 *     responses:
 *       200:
 *         description: 成功获取随机用户信息
 *       404:
 *         description: 找不到指定的随机用户信息
 *       500:
 *         description: 服务器错误
 */
router.get('/:id', getRandomUserById);

/**
 * @swagger
 * /api/random-users/blacklist/{id}:
 *   delete:
 *     summary: 从黑名单中删除姓名
 *     tags: [RandomUsers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: 黑名单记录ID
 *     responses:
 *       200:
 *         description: 成功从黑名单中删除姓名
 *       404:
 *         description: 找不到指定的黑名单记录
 *       500:
 *         description: 服务器错误
 */
router.delete('/blacklist/:id', removeNameFromBlacklist);

/**
 * @swagger
 * /api/random-users/{id}:
 *   delete:
 *     summary: 删除随机用户信息
 *     tags: [RandomUsers]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: 随机用户信息ID
 *     responses:
 *       200:
 *         description: 成功删除随机用户信息
 *       404:
 *         description: 找不到指定的随机用户信息
 *       500:
 *         description: 服务器错误
 */
router.delete('/:id', deleteRandomUser);

/**
 * @swagger
 * /api/random-users/blacklist:
 *   post:
 *     summary: 添加姓名到黑名单
 *     tags: [RandomUsers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Zhang, Yutong"
 *                 description: 不允许使用的姓名
 *               reason:
 *                 type: string
 *                 example: "政治敏感人物"
 *                 description: 禁用原因，可选
 *             required:
 *               - name
 *     responses:
 *       201:
 *         description: 成功添加姓名到黑名单
 *       400:
 *         description: 请求参数错误或该姓名已经在黑名单中
 *       500:
 *         description: 服务器错误
 */
router.post('/blacklist', addNameToBlacklist);

export default router;