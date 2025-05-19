/**
 * 定时任务路由
 */
import express from 'express';
import taskController from '../controllers/taskController';

const router = express.Router();

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: 获取任务列表
 *     tags: [任务]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 任务状态过滤
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 每页数量
 *     responses:
 *       200:
 *         description: 成功获取任务列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 */
router.get('/', taskController.getTaskList);

/**
 * @swagger
 * /api/tasks/{taskId}:
 *   get:
 *     summary: 获取任务详情
 *     tags: [任务]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 任务ID
 *     responses:
 *       200:
 *         description: 成功获取任务详情
 */
router.get('/:taskId', taskController.getTaskDetail);

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: 创建任务
 *     tags: [任务]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - taskName
 *               - taskKey
 *               - cronExpression
 *               - handler
 *             properties:
 *               taskName:
 *                 type: string
 *               taskKey:
 *                 type: string
 *               cronExpression:
 *                 type: string
 *               handler:
 *                 type: object
 *               status:
 *                 type: string
 *                 enum: [enabled, disabled]
 *                 default: enabled
 *               retryCount:
 *                 type: integer
 *                 default: 0
 *               retryInterval:
 *                 type: integer
 *                 default: 0
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: 成功创建任务
 */
router.post('/', taskController.createTask);

/**
 * @swagger
 * /api/tasks/{taskId}:
 *   put:
 *     summary: 更新任务
 *     tags: [任务]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 任务ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: 成功更新任务
 */
router.put('/:taskId', taskController.updateTask);

/**
 * @swagger
 * /api/tasks/{taskId}:
 *   delete:
 *     summary: 删除任务
 *     tags: [任务]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 任务ID
 *     responses:
 *       200:
 *         description: 成功删除任务
 */
router.delete('/:taskId', taskController.deleteTask);

/**
 * @swagger
 * /api/tasks/{taskId}/trigger:
 *   post:
 *     summary: 手动触发任务
 *     tags: [任务]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 任务ID
 *     responses:
 *       200:
 *         description: 成功触发任务
 */
router.post('/:taskId/trigger', taskController.triggerTask);

/**
 * @swagger
 * /api/tasks/{taskId}/history:
 *   get:
 *     summary: 获取任务执行历史
 *     tags: [任务]
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *         description: 任务ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: 每页数量
 *     responses:
 *       200:
 *         description: 成功获取任务执行历史
 */
router.get('/:taskId/history', taskController.getTaskHistory);

export default router;