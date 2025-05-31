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

// ==================== 标签管理 ====================

/**
 * @swagger
 * /api/proxy-pools/tags:
 *   get:
 *     summary: 获取所有标签
 *     tags: [代理标签管理]
 *     responses:
 *       200:
 *         description: 成功获取标签列表
 */
router.get('/tags', async (req: Request, res: Response) => {
  try {
    console.log('接收到获取所有标签请求');
    const result = await proxyPoolService.getAllTags();
    console.log(`获取到 ${result.data?.length || 0} 个标签`);
    res.json(result);
  } catch (error) {
    console.error('获取标签列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取标签列表失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/tags:
 *   post:
 *     summary: 创建标签
 *     tags: [代理标签管理]
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
 *               color:
 *                 type: string
 *     responses:
 *       201:
 *         description: 标签创建成功
 */
router.post('/tags', async (req: Request, res: Response) => {
  try {
    console.log('接收到创建标签请求:', req.body);
    const result = await proxyPoolService.createTag(req.body);
    
    if (result.success) {
      console.log('标签创建成功:', result.data);
      res.status(201).json(result);
    } else {
      console.log('标签创建失败:', result.message);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('创建标签失败:', error);
    res.status(500).json({
      success: false,
      message: '创建标签失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/tags/{tagId}:
 *   put:
 *     summary: 更新标签
 *     tags: [代理标签管理]
 *     parameters:
 *       - in: path
 *         name: tagId
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
 *               color:
 *                 type: string
 *     responses:
 *       200:
 *         description: 标签更新成功
 */
router.put('/tags/:tagId', async (req: Request, res: Response) => {
  try {
    const tagId = parseInt(req.params.tagId);
    console.log(`接收到更新标签请求，标签ID: ${tagId}`, req.body);
    
    const result = await proxyPoolService.updateTag(tagId, req.body);
    
    if (result.success) {
      console.log('标签更新成功:', result.data);
      res.json(result);
    } else {
      console.log('标签更新失败:', result.message);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('更新标签失败:', error);
    res.status(500).json({
      success: false,
      message: '更新标签失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/tags/{tagId}:
 *   delete:
 *     summary: 删除标签
 *     tags: [代理标签管理]
 *     parameters:
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 标签删除成功
 */
router.delete('/tags/:tagId', async (req: Request, res: Response) => {
  try {
    const tagId = parseInt(req.params.tagId);
    console.log(`接收到删除标签请求，标签ID: ${tagId}`);
    
    const result = await proxyPoolService.deleteTag(tagId);
    
    if (result.success) {
      console.log('标签删除成功');
      res.json(result);
    } else {
      console.log('标签删除失败:', result.message);
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('删除标签失败:', error);
    res.status(500).json({
      success: false,
      message: '删除标签失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/servers/{serverId}/tags:
 *   get:
 *     summary: 获取代理服务器的所有标签
 *     tags: [代理标签管理]
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功获取代理服务器标签
 */
router.get('/servers/:serverId/tags', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.params.serverId);
    console.log(`接收到获取代理服务器标签请求，服务器ID: ${serverId}`);
    
    const result = await proxyPoolService.getServerTags(serverId);
    
    if (result.success) {
      console.log(`获取到 ${result.data?.length || 0} 个标签`);
      res.json(result);
    } else {
      console.log('获取代理服务器标签失败:', result.message);
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('获取代理服务器标签失败:', error);
    res.status(500).json({
      success: false,
      message: '获取代理服务器标签失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/servers/{serverId}/tags:
 *   post:
 *     summary: 为代理服务器添加标签
 *     tags: [代理标签管理]
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
 *               tagId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: 标签添加成功
 */
router.post('/servers/:serverId/tags', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const { tagId, tagIds } = req.body;
    console.log(`接收到为代理服务器添加标签请求，服务器ID: ${serverId}`);
    
    let result;
    if (tagIds && Array.isArray(tagIds)) {
      console.log(`批量添加标签，标签ID列表: ${tagIds.join(', ')}`);
      result = await proxyPoolService.addTagsToServer(serverId, tagIds);
    } else if (tagId) {
      console.log(`添加单个标签，标签ID: ${tagId}`);
      result = await proxyPoolService.addTagToServer(serverId, tagId);
    } else {
      return res.status(400).json({
        success: false,
        message: '必须提供tagId或tagIds参数'
      });
    }
    
    if (result.success) {
      console.log('标签添加成功:', result.data);
      res.status(201).json(result);
    } else {
      console.log('标签添加失败:', result.message);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('为代理服务器添加标签失败:', error);
    res.status(500).json({
      success: false,
      message: '为代理服务器添加标签失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/servers/{serverId}/tags/{tagId}:
 *   delete:
 *     summary: 从代理服务器移除标签
 *     tags: [代理标签管理]
 *     parameters:
 *       - in: path
 *         name: serverId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 标签移除成功
 */
router.delete('/servers/:serverId/tags/:tagId', async (req: Request, res: Response) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const tagId = parseInt(req.params.tagId);
    console.log(`接收到从代理服务器移除标签请求，服务器ID: ${serverId}，标签ID: ${tagId}`);
    
    const result = await proxyPoolService.removeTagFromServer(serverId, tagId);
    
    if (result.success) {
      console.log('标签移除成功');
      res.json(result);
    } else {
      console.log('标签移除失败:', result.message);
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('从代理服务器移除标签失败:', error);
    res.status(500).json({
      success: false,
      message: '从代理服务器移除标签失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/tags/{tagId}/servers:
 *   get:
 *     summary: 通过标签获取代理服务器
 *     tags: [代理标签管理]
 *     parameters:
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: 成功获取代理服务器列表
 */
router.get('/tags/:tagId/servers', async (req: Request, res: Response) => {
  try {
    const tagId = parseInt(req.params.tagId);
    console.log(`接收到通过标签获取代理服务器请求，标签ID: ${tagId}`);
    
    const result = await proxyPoolService.getServersByTag(tagId);
    
    if (result.success) {
      console.log(`获取到 ${result.data?.length || 0} 个代理服务器`);
      res.json(result);
    } else {
      console.log('通过标签获取代理服务器失败:', result.message);
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('通过标签获取代理服务器失败:', error);
    res.status(500).json({
      success: false,
      message: '通过标签获取代理服务器失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/tags/name/{tagName}/servers:
 *   get:
 *     summary: 通过标签名称获取代理服务器
 *     tags: [代理标签管理]
 *     parameters:
 *       - in: path
 *         name: tagName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 成功获取代理服务器列表
 */
router.get('/tags/name/:tagName/servers', async (req: Request, res: Response) => {
  try {
    const tagName = req.params.tagName;
    console.log(`接收到通过标签名称获取代理服务器请求，标签名称: ${tagName}`);
    
    const result = await proxyPoolService.getServersByTagName(tagName);
    
    if (result.success) {
      console.log(`获取到 ${result.data?.length || 0} 个代理服务器`);
      res.json(result);
    } else {
      console.log('通过标签名称获取代理服务器失败:', result.message);
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('通过标签名称获取代理服务器失败:', error);
    res.status(500).json({
      success: false,
      message: '通过标签名称获取代理服务器失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/random-server-with-tags:
 *   post:
 *     summary: 随机获取带有指定标签的代理服务器
 *     tags: [代理标签管理]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tagNames:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: 成功获取代理服务器
 */
router.post('/random-server-with-tags', async (req: Request, res: Response) => {
  try {
    const { tagNames } = req.body;
    console.log(`接收到随机获取带有指定标签的代理服务器请求，标签: ${tagNames?.join(', ')}`);
    
    if (!Array.isArray(tagNames) || tagNames.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'tagNames必须是非空数组'
      });
    }
    
    const result = await proxyPoolService.getRandomServerWithTags(tagNames);
    
    if (result.success) {
      console.log('随机获取代理服务器成功:', result.data?.id);
      res.json(result);
    } else {
      console.log('随机获取代理服务器失败:', result.message);
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('随机获取带有指定标签的代理服务器失败:', error);
    res.status(500).json({
      success: false,
      message: '随机获取带有指定标签的代理服务器失败'
    });
  }
});

// ==================== 批量导入预览 ====================

/**
 * @swagger
 * /api/proxy-pools/{poolId}/servers/preview:
 *   post:
 *     summary: 批量预览代理服务器（不添加到数据库）
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
 *       200:
 *         description: 成功预览代理服务器
 */
router.post('/:poolId/servers/preview', async (req: Request, res: Response) => {
  try {
    const poolId = parseInt(req.params.poolId);
    const { proxyStrings } = req.body;
    
    console.log(`接收到批量预览代理服务器请求，代理池ID: ${poolId}，数量: ${proxyStrings?.length || 0}`);
    
    if (!Array.isArray(proxyStrings)) {
      return res.status(400).json({
        success: false,
        message: 'proxyStrings 必须是字符串数组'
      });
    }
    
    const result = proxyPoolService.previewProxyBatch(proxyStrings);
    
    if (result.success) {
      console.log('批量预览代理服务器成功:', result.data?.summary);
      res.json(result);
    } else {
      console.log('批量预览代理服务器失败:', result.message);
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('批量预览代理服务器失败:', error);
    res.status(500).json({
      success: false,
      message: '批量预览代理服务器失败'
    });
  }
});

/**
 * @swagger
 * /api/proxy-pools/{poolId}/servers/batch-with-tags:
 *   post:
 *     summary: 批量添加代理服务器（支持标签）
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
 *               defaultTags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 默认添加的标签名称列表
 *     responses:
 *       201:
 *         description: 批量添加成功
 */
router.post('/:poolId/servers/batch-with-tags', async (req: Request, res: Response) => {
  try {
    const poolId = parseInt(req.params.poolId);
    const { proxyStrings, defaultTags = [] } = req.body;
    
    console.log(`接收到批量添加代理服务器请求（带标签），代理池ID: ${poolId}，数量: ${proxyStrings?.length || 0}，默认标签: ${defaultTags?.join(', ')}`);
    
    if (!Array.isArray(proxyStrings)) {
      return res.status(400).json({
        success: false,
        message: 'proxyStrings 必须是字符串数组'
      });
    }
    
    const result = await proxyPoolService.addProxyServersBatchWithTags(poolId, proxyStrings, defaultTags);
    
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

export default router;