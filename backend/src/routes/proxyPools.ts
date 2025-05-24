/**
 * 代理池管理路由
 */
import { Router, Request, Response } from 'express';
import { ProxyPoolService } from '../service/ProxyPoolService';

const router = Router();
const proxyPoolService = new ProxyPoolService();

/**
 * @swagger
 * components:
 *   schemas:
 *     ProxyPool:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         proxy_mode:
 *           type: string
 *           enum: [none, round_robin, random, failover]
 *         enabled:
 *           type: boolean
 *     ProxyServer:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         pool_id:
 *           type: integer
 *         name:
 *           type: string
 *         proxy_type:
 *           type: string
 *           enum: [http, https, socks4, socks5]
 *         host:
 *           type: string
 *         port:
 *           type: integer
 *         username:
 *           type: string
 *         password:
 *           type: string
 *         enabled:
 *           type: boolean
 *         is_healthy:
 *           type: boolean
 */

/**
 * @swagger
 * /api/proxy-pools:
 *   get:
 *     summary: 获取所有代理池
 *     tags: [代理池管理]
 *     responses:
 *       200:
 *         description: 成功获取代理池列表
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('接收到获取代理池列表请求');
    const result = await proxyPoolService.getProxyPools();
    console.log(`获取到 ${result.data?.length || 0} 个代理池`);
    res.json(result);
  } catch (error) {
    console.error('获取代理池列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取代理池列表失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools:
 *   post:
 *     summary: 创建代理池
 *     tags: [代理池管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               proxy_mode:
 *                 type: string
 *                 enum: [none, round_robin, random, failover]
 *               enabled:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: 代理池创建成功
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    console.log('接收到创建代理池请求:', req.body);
    const result = await proxyPoolService.createProxyPool(req.body);
    
    if (result.success) {
      console.log('代理池创建成功:', result.data);
      res.status(201).json(result);
    } else {
      console.log('代理池创建失败:', result.message);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('创建代理池失败:', error);
    res.status(500).json({
      success: false,
      message: '创建代理池失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/{poolId}/servers:
 *   get:
 *     summary: 获取代理池中的代理服务器
 *     tags: [代理池管理]
 *     parameters:
 *       - in: path
 *         name: poolId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功获取代理服务器列表
 */
router.get('/:poolId/servers', async (req: Request, res: Response) => {
  try {
    const poolId = parseInt(req.params.poolId);
    console.log(`接收到获取代理池 ${poolId} 的服务器列表请求`);
    
    const result = await proxyPoolService.getProxyServers(poolId);
    console.log(`获取到 ${result.data?.length || 0} 个代理服务器`);
    res.json(result);
  } catch (error) {
    console.error('获取代理服务器列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取代理服务器列表失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/{poolId}/servers:
 *   post:
 *     summary: 添加代理服务器
 *     tags: [代理池管理]
 *     parameters:
 *       - in: path
 *         name: poolId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               proxy_type:
 *                 type: string
 *                 enum: [http, https, socks4, socks5]
 *               host:
 *                 type: string
 *               port:
 *                 type: integer
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: 代理服务器添加成功
 */
router.post('/:poolId/servers', async (req: Request, res: Response) => {
  try {
    const poolId = parseInt(req.params.poolId);
    console.log(`接收到添加代理服务器请求，代理池ID: ${poolId}`, req.body);
    
    const serverData = {
      ...req.body,
      pool_id: poolId,
      success_count: 0,
      failure_count: 0,
      is_healthy: true,
      enabled: req.body.enabled !== false
    };
    
    const result = await proxyPoolService.addProxyServer(serverData);
    
    if (result.success) {
      console.log('代理服务器添加成功:', result.data);
      res.status(201).json(result);
    } else {
      console.log('代理服务器添加失败:', result.message);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('添加代理服务器失败:', error);
    res.status(500).json({
      success: false,
      message: '添加代理服务器失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/{poolId}/servers/batch:
 *   post:
 *     summary: 批量添加代理服务器
 *     tags: [代理池管理]
 *     parameters:
 *       - in: path
 *         name: poolId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               proxyStrings:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 代理字符串列表，支持多种格式
 *     responses:
 *       201:
 *         description: 批量添加成功
 */
router.post('/:poolId/servers/batch', async (req: Request, res: Response) => {
  try {
    const poolId = parseInt(req.params.poolId);
    const { proxyStrings } = req.body;
    
    console.log(`接收到批量添加代理服务器请求，代理池ID: ${poolId}，数量: ${proxyStrings?.length || 0}`);
    
    if (!Array.isArray(proxyStrings)) {
      return res.status(400).json({
        success: false,
        message: 'proxyStrings 必须是字符串数组'
      });
    }
    
    const result = await proxyPoolService.addProxyServersBatch(poolId, proxyStrings);
    
    if (result.success) {
      console.log('批量添加代理服务器成功:', result.data);
      res.status(201).json(result);
    } else {
      console.log('批量添加代理服务器失败:', result.message);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('批量添加代理服务器失败:', error);
    res.status(500).json({
      success: false,
      message: '批量添加代理服务器失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/servers/{serverId}:
 *   delete:
 *     summary: 删除代理服务器
 *     tags: [代理池管理]
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 代理服务器删除成功
 */
router.delete('/servers/:serverId', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.params.serverId);
    console.log(`接收到删除代理服务器请求，服务器ID: ${serverId}`);
    
    const result = await proxyPoolService.deleteProxyServer(serverId);
    
    if (result.success) {
      console.log('代理服务器删除成功');
      res.json(result);
    } else {
      console.log('代理服务器删除失败:', result.message);
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('删除代理服务器失败:', error);
    res.status(500).json({
      success: false,
      message: '删除代理服务器失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/{poolId}:
 *   put:
 *     summary: 更新代理池配置
 *     tags: [代理池管理]
 *     parameters:
 *       - in: path
 *         name: poolId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               proxy_mode:
 *                 type: string
 *                 enum: [none, round_robin, random, failover]
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 代理池更新成功
 */
router.put('/:poolId', async (req: Request, res: Response) => {
  try {
    const poolId = parseInt(req.params.poolId);
    console.log(`接收到更新代理池请求，代理池ID: ${poolId}`, req.body);
    
    const result = await proxyPoolService.updateProxyPool(poolId, req.body);
    
    if (result.success) {
      console.log('代理池更新成功:', result.data);
      res.json(result);
    } else {
      console.log('代理池更新失败:', result.message);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('更新代理池失败:', error);
    res.status(500).json({
      success: false,
      message: '更新代理池失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/{poolId}:
 *   delete:
 *     summary: 删除代理池
 *     tags: [代理池管理]
 *     parameters:
 *       - in: path
 *         name: poolId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 代理池删除成功
 */
router.delete('/:poolId', async (req: Request, res: Response) => {
  try {
    const poolId = parseInt(req.params.poolId);
    console.log(`接收到删除代理池请求，代理池ID: ${poolId}`);
    
    const result = await proxyPoolService.deleteProxyPool(poolId);
    
    if (result.success) {
      console.log('代理池删除成功');
      res.json(result);
    } else {
      console.log('代理池删除失败:', result.message);
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('删除代理池失败:', error);
    res.status(500).json({
      success: false,
      message: '删除代理池失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/servers/{serverId}:
 *   get:
 *     summary: 获取单个代理服务器
 *     tags: [代理池管理]
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功获取代理服务器信息
 */
router.get('/servers/:serverId', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.params.serverId);
    console.log(`接收到获取代理服务器请求，服务器ID: ${serverId}`);
    
    const result = await proxyPoolService.getProxyServer(serverId);
    
    if (result.success) {
      console.log('代理服务器获取成功:', result.data);
      res.json(result);
    } else {
      console.log('代理服务器获取失败:', result.message);
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('获取代理服务器失败:', error);
    res.status(500).json({
      success: false,
      message: '获取代理服务器失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/servers/{serverId}:
 *   put:
 *     summary: 更新代理服务器
 *     tags: [代理池管理]
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               proxy_type:
 *                 type: string
 *                 enum: [http, https, socks4, socks5]
 *               host:
 *                 type: string
 *               port:
 *                 type: integer
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: 代理服务器更新成功
 */
router.put('/servers/:serverId', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.params.serverId);
    console.log(`接收到更新代理服务器请求，服务器ID: ${serverId}`, req.body);
    
    const result = await proxyPoolService.updateProxyServer(serverId, req.body);
    
    if (result.success) {
      console.log('代理服务器更新成功:', result.data);
      res.json(result);
    } else {
      console.log('代理服务器更新失败:', result.message);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('更新代理服务器失败:', error);
    res.status(500).json({
      success: false,
      message: '更新代理服务器失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/servers/{serverId}/stats:
 *   get:
 *     summary: 获取代理服务器使用统计
 *     tags: [代理池管理]
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: 成功获取代理服务器使用统计
 */
router.get('/servers/:serverId/stats', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const { startDate, endDate } = req.query;
    console.log(`接收到获取代理服务器使用统计请求，服务器ID: ${serverId}`);
    
    let dateRange;
    if (startDate && endDate) {
      dateRange = {
        startDate: startDate as string,
        endDate: endDate as string
      };
    }
    
    const result = await proxyPoolService.getProxyUsageStats(serverId, dateRange);
    
    if (result.success) {
      console.log('代理服务器使用统计获取成功');
      res.json(result);
    } else {
      console.log('代理服务器使用统计获取失败:', result.message);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('获取代理服务器使用统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取代理服务器使用统计失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/servers/{serverId}/refresh:
 *   post:
 *     summary: 刷新代理服务器
 *     tags: [代理池管理]
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 代理服务器刷新成功
 */
router.post('/servers/:serverId/refresh', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.params.serverId);
    console.log(`接收到刷新代理服务器请求，服务器ID: ${serverId}`);
    
    const result = await proxyPoolService.refreshProxy(serverId);
    
    if (result.success) {
      console.log('代理服务器刷新成功');
      res.json(result);
    } else {
      console.log('代理服务器刷新失败:', result.message);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('刷新代理服务器失败:', error);
    res.status(500).json({
      success: false,
      message: '刷新代理服务器失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/servers/{serverId}/validate:
 *   post:
 *     summary: 验证代理服务器有效性
 *     tags: [代理池管理]
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 验证完成
 */
router.post('/servers/:serverId/validate', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.params.serverId);
    console.log(`接收到验证代理服务器请求，服务器ID: ${serverId}`);
    
    const result = await proxyPoolService.validateServer(serverId);
    
    if (result.success) {
      console.log('代理服务器验证完成:', result.data);
      res.json(result);
    } else {
      console.log('代理服务器验证失败:', result.message);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('验证代理服务器失败:', error);
    res.status(500).json({
      success: false,
      message: '验证代理服务器失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/parse:
 *   post:
 *     summary: 解析代理字符串
 *     tags: [代理池管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               proxyString:
 *                 type: string
 *                 description: 代理字符串
 *     responses:
 *       200:
 *         description: 解析成功
 */
router.post('/parse', async (req: Request, res: Response) => {
  try {
    const { proxyString } = req.body;
    console.log('接收到解析代理字符串请求:', proxyString);
    
    if (!proxyString) {
      return res.status(400).json({
        success: false,
        message: '代理字符串不能为空'
      });
    }
    
    const parsed = proxyPoolService.parseProxyString(proxyString);
    
    if (parsed) {
      console.log('代理字符串解析成功:', parsed);
      res.json({
        success: true,
        data: parsed
      });
    } else {
      console.log('代理字符串解析失败');
      res.status(400).json({
        success: false,
        message: '代理字符串格式无效'
      });
    }
  } catch (error) {
    console.error('解析代理字符串失败:', error);
    res.status(500).json({
      success: false,
      message: '解析代理字符串失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/health-check:
 *   post:
 *     summary: 执行所有代理的健康检查
 *     tags: [代理池管理]
 *     responses:
 *       200:
 *         description: 健康检查已开始
 */
router.post('/health-check', async (req: Request, res: Response) => {
  try {
    console.log('接收到代理健康检查请求');
    
    // 异步执行健康检查，不等待完成
    proxyPoolService.healthCheckAll().catch(error => {
      console.error('代理健康检查失败:', error);
    });
    
    res.json({
      success: true,
      message: '健康检查已开始，请稍后查看结果'
    });
  } catch (error) {
    console.error('启动代理健康检查失败:', error);
    res.status(500).json({
      success: false,
      message: '启动代理健康检查失败'
    });
  }
});

export default router; 