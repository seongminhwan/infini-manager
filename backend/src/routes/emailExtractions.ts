/**
 * 邮件取件路由
 * 定义邮件取件相关的API路由
 */
import { Router } from 'express';
import * as emailExtractionController from '../controllers/emailExtractionController';

const router = Router();

// 取件模板管理
router.get('/', emailExtractionController.getExtractionTemplates);
router.get('/:id', emailExtractionController.getExtractionTemplate);
router.post('/', emailExtractionController.createExtractionTemplate);
router.put('/:id', emailExtractionController.updateExtractionTemplate);
router.delete('/:id', emailExtractionController.deleteExtractionTemplate);

// 测试取件模板
router.post('/test', emailExtractionController.testExtractionTemplate);

// 执行邮件取件
router.post('/extract', emailExtractionController.extractEmailsWithTemplate);

export default router;