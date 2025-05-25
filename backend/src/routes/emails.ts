/**
 * 邮件路由
 * 定义邮件相关的API路由
 */
import { Router } from 'express';
import * as emailController from '../controllers/emailController';

const router = Router();

// 邮件列表和检索
router.get('/list', emailController.getEmailList);
router.get('/attachments/:id/download', emailController.downloadAttachment);
router.get('/:id', emailController.getEmailDetail);

// 邮件状态管理
router.put('/:id/status', emailController.updateEmailStatus);
router.post('/batch-status-update', emailController.batchUpdateEmailStatus);

// 邮件同步相关
router.post('/sync', emailController.syncEmails);
router.get('/sync/:id/status', emailController.getSyncStatus);
router.get('/sync/history', emailController.getSyncHistory);
router.post('/sync/:id/cancel', emailController.cancelSync);

// 邮箱文件夹和统计信息
router.get('/mailboxes', emailController.getMailboxList);
router.get('/stats/:accountId', emailController.getEmailStats);

export default router;