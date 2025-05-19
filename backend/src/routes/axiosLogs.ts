/**
 * Axios请求日志路由
 * 提供API日志查询和业务上下文相关的API
 */
import { Router } from 'express';
import { axiosLogsController } from '../controllers/axiosLogsController';

const router = Router();

/**
 * @swagger
 * /api/axios-logs:
 *   get:
 *     summary: 获取API请求日志
 *     description: 支持按时间、业务模块、业务操作类型等条件筛选，并提供分页功能
 *     parameters:
 *       - name: startDate
 *         in: query
 *         description: 开始日期
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: endDate
 *         in: query
 *         description: 结束日期
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: businessModule
 *         in: query
 *         description: 业务模块名称
 *         schema:
 *           type: string
 *       - name: businessOperation
 *         in: query
 *         description: 业务操作类型
 *         schema:
 *           type: string
 *       - name: url
 *         in: query
 *         description: URL模糊匹配
 *         schema:
 *           type: string
 *       - name: method
 *         in: query
 *         description: 请求方法 (GET, POST等)
 *         schema:
 *           type: string
 *       - name: statusCode
 *         in: query
 *         description: HTTP状态码
 *         schema:
 *           type: integer
 *       - name: success
 *         in: query
 *         description: 请求是否成功
 *         schema:
 *           type: boolean
 *       - name: page
 *         in: query
 *         description: 页码，默认为1
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: pageSize
 *         in: query
 *         description: 每页记录数，默认为50
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: 成功获取日志数据
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
 *                     logs:
 *                       type: array
 *                     pagination:
 *                       type: object
 *       500:
 *         description: 服务器错误
 */
router.get('/', axiosLogsController.getLogs);

/**
 * @swagger
 * /api/axios-logs/business-modules:
 *   get:
 *     summary: 获取所有业务模块列表
 *     description: 返回所有记录过的业务模块列表（去重）
 *     responses:
 *       200:
 *         description: 成功获取业务模块列表
 *       500:
 *         description: 服务器错误
 */
router.get('/business-modules', axiosLogsController.getBusinessModules);

/**
 * @swagger
 * /api/axios-logs/business-operations:
 *   get:
 *     summary: 获取业务操作类型列表
 *     description: 返回业务操作类型列表，可选择特定模块下的操作
 *     parameters:
 *       - name: businessModule
 *         in: query
 *         description: 业务模块名称（可选）
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功获取业务操作类型列表
 *       500:
 *         description: 服务器错误
 */
router.get('/business-operations', axiosLogsController.getBusinessOperations);

export default router;