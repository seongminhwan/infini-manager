/**
 * 配置路由
 * 处理与系统配置相关的API请求
 */
import express from 'express';
import {
  getAllConfigs,
  getConfigByKey,
  upsertConfig,
  deleteConfig
} from '../controllers/configController';

const router = express.Router();

/**
 * @swagger
 * /api/configs:
 *   get:
 *     summary: 获取所有配置
 *     tags: [Configs]
 *     responses:
 *       200:
 *         description: 成功获取所有配置
 *       500:
 *         description: 服务器错误
 */
router.get('/', getAllConfigs);

/**
 * @swagger
 * /api/configs/{key}:
 *   get:
 *     summary: 获取单个配置
 *     tags: [Configs]
 *     parameters:
 *       - in: path
 *         name: key
 *         schema:
 *           type: string
 *         required: true
 *         description: 配置键名
 *     responses:
 *       200:
 *         description: 成功获取配置
 *       404:
 *         description: 配置不存在
 *       500:
 *         description: 服务器错误
 */
router.get('/:key', getConfigByKey);

/**
 * @swagger
 * /api/configs:
 *   post:
 *     summary: 创建或更新配置
 *     tags: [Configs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *                 example: "table_config"
 *               value:
 *                 type: object
 *                 example: { "columns": [{"key": "id", "width": 100}] }
 *               description:
 *                 type: string
 *                 example: "表格配置信息"
 *             required:
 *               - key
 *               - value
 *     responses:
 *       200:
 *         description: 配置更新成功
 *       201:
 *         description: 配置创建成功
 *       400:
 *         description: 请求参数错误
 *       500:
 *         description: 服务器错误
 */
router.post('/', upsertConfig);

/**
 * @swagger
 * /api/configs/{key}:
 *   delete:
 *     summary: 删除配置
 *     tags: [Configs]
 *     parameters:
 *       - in: path
 *         name: key
 *         schema:
 *           type: string
 *         required: true
 *         description: 配置键名
 *     responses:
 *       200:
 *         description: 配置删除成功
 *       404:
 *         description: 配置不存在
 *       500:
 *         description: 服务器错误
 */
router.delete('/:key', deleteConfig);

export default router;