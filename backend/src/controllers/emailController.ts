/**
 * 邮件控制器
 * 处理邮件查询、获取详情、更新状态和同步
 */
import { Request, Response } from 'express';
import db from '../db/db';
import EmailSyncService from '../service/EmailSyncService';
import { ApiResponse } from '../types';

/**
 * 获取邮件列表
 * 支持分页、排序和多条件筛选
 */
export async function getEmailList(req: Request, res: Response): Promise<void> {
  try {
    const {
      accountId,
      page = 1,
      pageSize = 20,
      sortField = 'date',
      sortOrder = 'desc',
      status,
      fromAddress,
      toAddress,
      subject,
      startDate,
      endDate,
      hasAttachments,
      mailbox = 'INBOX',
      keyword
    } = req.query;

    // 参数验证
    const parsedAccountId = parseInt(accountId as string);
    if (isNaN(parsedAccountId)) {
      res.status(400).json({
        success: false,
        message: '无效的邮箱账户ID'
      });
      return;
    }

    // 检查账户是否存在
    const account = await db('email_accounts').where({ id: parsedAccountId }).first();
    if (!account) {
      res.status(404).json({
        success: false,
        message: '邮箱账户不存在'
      });
      return;
    }

    // 构建查询
    let query = db('email_messages')
      .where({ account_id: parsedAccountId, mailbox: mailbox as string })
      .select([
        'id',
        'message_id',
        'uid',
        'from_address',
        'from_name',
        'to_address',
        'subject',
        'date',
        'status',
        'has_attachments',
        'attachments_count',
        'snippet',
        'mailbox',
        'created_at',
        'updated_at'
      ]);

    // 应用筛选条件
    if (status) {
      query = query.where({ status: status as string });
    }

    if (fromAddress) {
      query = query.where('from_address', 'like', `%${fromAddress}%`);
    }

    if (toAddress) {
      query = query.where('to_address', 'like', `%${toAddress}%`);
    }

    if (subject) {
      query = query.where('subject', 'like', `%${subject}%`);
    }

    if (startDate) {
      query = query.where('date', '>=', new Date(startDate as string));
    }

    if (endDate) {
      query = query.where('date', '<=', new Date(endDate as string));
    }

    if (hasAttachments !== undefined) {
      query = query.where('has_attachments', hasAttachments === 'true');
    }

    // 关键词搜索（多字段匹配）
    if (keyword) {
      query = query.where(function() {
        this.where('subject', 'like', `%${keyword}%`)
          .orWhere('from_address', 'like', `%${keyword}%`)
          .orWhere('from_name', 'like', `%${keyword}%`)
          .orWhere('to_address', 'like', `%${keyword}%`)
          .orWhere('snippet', 'like', `%${keyword}%`);
      });
    }

    // 计算总记录数
    const totalCountQuery = query.clone();
    const totalCountResult = await totalCountQuery.count('id as count').first();
    const totalCount = totalCountResult ? (totalCountResult.count as number) : 0;

    // 应用排序和分页
    const parsedPage = parseInt(page as string) || 1;
    const parsedPageSize = parseInt(pageSize as string) || 20;
    const offset = (parsedPage - 1) * parsedPageSize;

    query = query
      .orderBy(sortField as string, sortOrder as 'asc' | 'desc')
      .limit(parsedPageSize)
      .offset(offset);

    // 执行查询
    const emails = await query;

    // 格式化响应
    const formattedEmails = emails.map(email => ({
      id: email.id,
      messageId: email.message_id,
      uid: email.uid,
      fromAddress: email.from_address,
      fromName: email.from_name,
      toAddress: email.to_address,
      subject: email.subject,
      date: email.date,
      status: email.status,
      hasAttachments: email.has_attachments,
      attachmentsCount: email.attachments_count,
      snippet: email.snippet,
      mailbox: email.mailbox,
      createdAt: email.created_at,
      updatedAt: email.updated_at
    }));

    // 计算分页信息
    const totalPages = Math.ceil(totalCount / parsedPageSize);

    const response: ApiResponse = {
      success: true,
      message: '获取邮件列表成功',
      data: {
        emails: formattedEmails,
        pagination: {
          page: parsedPage,
          pageSize: parsedPageSize,
          total: totalCount,
          totalPages
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('获取邮件列表失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取邮件列表失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 获取邮件详情
 * 包括邮件正文和附件信息
 */
export async function getEmailDetail(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      res.status(400).json({
        success: false,
        message: '无效的邮件ID'
      });
      return;
    }

    // 获取邮件基本信息
    const email = await db('email_messages')
      .where({ id: parsedId })
      .first();

    if (!email) {
      res.status(404).json({
        success: false,
        message: '邮件不存在'
      });
      return;
    }

    // 获取邮件内容
    const content = await db('email_message_contents')
      .where({ email_id: parsedId })
      .first();

    // 获取附件信息（不包含二进制内容）
    const attachments = await db('email_message_attachments')
      .where({ email_id: parsedId })
      .select([
        'id',
        'filename',
        'content_type',
        'content_id',
        'content_disposition',
        'size',
        'is_stored',
        'storage_path'
      ]);

    // 格式化响应
    const formattedEmail = {
      id: email.id,
      accountId: email.account_id,
      messageId: email.message_id,
      uid: email.uid,
      fromAddress: email.from_address,
      fromName: email.from_name,
      toAddress: email.to_address,
      ccAddress: email.cc_address,
      bccAddress: email.bcc_address,
      subject: email.subject,
      date: email.date,
      flags: email.flags ? JSON.parse(email.flags) : [],
      hasAttachments: email.has_attachments,
      attachmentsCount: email.attachments_count,
      status: email.status,
      mailbox: email.mailbox,
      content: {
        text: content?.text_content || '',
        html: content?.html_content || '',
        headers: content?.raw_headers ? JSON.parse(content.raw_headers) : []
      },
      attachments: attachments.map(attachment => ({
        id: attachment.id,
        filename: attachment.filename,
        contentType: attachment.content_type,
        contentId: attachment.content_id,
        contentDisposition: attachment.content_disposition,
        size: attachment.size,
        isStored: attachment.is_stored,
        storagePath: attachment.storage_path,
        downloadUrl: `/api/emails/attachments/${attachment.id}/download`
      })),
      createdAt: email.created_at,
      updatedAt: email.updated_at
    };

    // 自动标记为已读（如果之前未读）
    if (email.status === 'unread') {
      await db('email_messages')
        .where({ id: parsedId })
        .update({
          status: 'read',
          updated_at: db.fn.now()
        });
    }

    const response: ApiResponse = {
      success: true,
      message: '获取邮件详情成功',
      data: formattedEmail
    };

    res.json(response);
  } catch (error) {
    console.error('获取邮件详情失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取邮件详情失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 下载附件
 */
export async function downloadAttachment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      res.status(400).json({
        success: false,
        message: '无效的附件ID'
      });
      return;
    }

    // 获取附件信息
    const attachment = await db('email_message_attachments')
      .where({ id: parsedId })
      .first();

    if (!attachment) {
      res.status(404).json({
        success: false,
        message: '附件不存在'
      });
      return;
    }

    // 检查附件内容是否已存储
    if (!attachment.is_stored) {
      res.status(404).json({
        success: false,
        message: '附件内容不可用'
      });
      return;
    }

    // 设置响应头
    res.setHeader('Content-Type', attachment.content_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
    if (attachment.size) {
      res.setHeader('Content-Length', attachment.size);
    }

    // 发送附件内容
    res.send(attachment.content);
  } catch (error) {
    console.error('下载附件失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '下载附件失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 更新邮件状态
 * 可设置为已读/未读/删除
 */
export async function updateEmailStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      res.status(400).json({
        success: false,
        message: '无效的邮件ID'
      });
      return;
    }

    if (!status || !['read', 'unread', 'deleted'].includes(status)) {
      res.status(400).json({
        success: false,
        message: '无效的状态值，只能设置为 read, unread 或 deleted'
      });
      return;
    }

    // 检查邮件是否存在
    const email = await db('email_messages')
      .where({ id: parsedId })
      .first();

    if (!email) {
      res.status(404).json({
        success: false,
        message: '邮件不存在'
      });
      return;
    }

    // 更新状态
    await db('email_messages')
      .where({ id: parsedId })
      .update({
        status,
        updated_at: db.fn.now()
      });

    const response: ApiResponse = {
      success: true,
      message: `邮件状态已更新为 ${status}`
    };

    res.json(response);
  } catch (error) {
    console.error('更新邮件状态失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '更新邮件状态失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 批量更新邮件状态
 */
export async function batchUpdateEmailStatus(req: Request, res: Response): Promise<void> {
  try {
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({
        success: false,
        message: '无效的邮件ID列表'
      });
      return;
    }

    if (!status || !['read', 'unread', 'deleted'].includes(status)) {
      res.status(400).json({
        success: false,
        message: '无效的状态值，只能设置为 read, unread 或 deleted'
      });
      return;
    }

    // 更新状态
    const updateCount = await db('email_messages')
      .whereIn('id', ids)
      .update({
        status,
        updated_at: db.fn.now()
      });

    const response: ApiResponse = {
      success: true,
      message: `已更新 ${updateCount} 封邮件的状态为 ${status}`
    };

    res.json(response);
  } catch (error) {
    console.error('批量更新邮件状态失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '批量更新邮件状态失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 手动触发邮件同步
 */
export async function syncEmails(req: Request, res: Response): Promise<void> {
  try {
    const { 
      accountId, 
      syncType = 'incremental', 
      mailboxes = ['INBOX'],
      startDate,  // 新增：同步起始日期
      endDate     // 新增：同步截止日期
    } = req.body;

    const parsedAccountId = parseInt(accountId);
    if (isNaN(parsedAccountId)) {
      res.status(400).json({
        success: false,
        message: '无效的邮箱账户ID'
      });
      return;
    }

    // 检查同步类型
    if (!['full', 'incremental'].includes(syncType)) {
      res.status(400).json({
        success: false,
        message: '无效的同步类型，只能为 full 或 incremental'
      });
      return;
    }

    // 检查邮箱列表
    if (!Array.isArray(mailboxes) || mailboxes.length === 0) {
      res.status(400).json({
        success: false,
        message: '无效的邮箱文件夹列表'
      });
      return;
    }

    // 验证日期格式（如果提供）
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      res.status(400).json({
        success: false,
        message: '无效的起始日期格式，请使用YYYY-MM-DD格式'
      });
      return;
    }

    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      res.status(400).json({
        success: false,
        message: '无效的截止日期格式，请使用YYYY-MM-DD格式'
      });
      return;
    }

    // 启动同步任务，传递时间区间参数
    const syncLogId = await EmailSyncService.syncEmails(
      parsedAccountId,
      syncType as 'full' | 'incremental',
      mailboxes,
      startDate,
      endDate
    );

    const response: ApiResponse = {
      success: true,
      message: '邮件同步任务已启动',
      data: {
        syncLogId,
        accountId: parsedAccountId,
        syncType,
        mailboxes,
        timeRange: {
          startDate: startDate || (syncType === 'full' ? '一个月前（默认）' : undefined),
          endDate: endDate || '无限制'
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('启动邮件同步任务失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '启动邮件同步任务失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 获取同步状态
 */
export async function getSyncStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      res.status(400).json({
        success: false,
        message: '无效的同步日志ID'
      });
      return;
    }

    // 获取同步状态
    const syncStatus = await EmailSyncService.getSyncStatus(parsedId);

    // 格式化响应
    const formattedStatus = {
      id: syncStatus.id,
      accountId: syncStatus.account_id,
      syncType: syncStatus.sync_type,
      status: syncStatus.status,
      totalMessages: syncStatus.total_messages,
      newMessages: syncStatus.new_messages,
      updatedMessages: syncStatus.updated_messages,
      failedMessages: syncStatus.failed_messages,
      lastUid: syncStatus.last_uid,
      errorMessage: syncStatus.error_message,
      mailboxes: syncStatus.mailboxes ? JSON.parse(syncStatus.mailboxes) : [],
      startTime: syncStatus.start_time,
      endTime: syncStatus.end_time,
      createdAt: syncStatus.created_at,
      updatedAt: syncStatus.updated_at
    };

    const response: ApiResponse = {
      success: true,
      message: '获取同步状态成功',
      data: formattedStatus
    };

    res.json(response);
  } catch (error) {
    console.error('获取同步状态失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取同步状态失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 获取同步历史记录
 */
export async function getSyncHistory(req: Request, res: Response): Promise<void> {
  try {
    const { accountId, page = 1, pageSize = 20 } = req.query;

    const parsedAccountId = parseInt(accountId as string);
    if (isNaN(parsedAccountId)) {
      res.status(400).json({
        success: false,
        message: '无效的邮箱账户ID'
      });
      return;
    }

    // 应用分页
    const parsedPage = parseInt(page as string) || 1;
    const parsedPageSize = parseInt(pageSize as string) || 20;
    const offset = (parsedPage - 1) * parsedPageSize;

    // 获取同步历史记录
    const syncLogs = await db('email_sync_logs')
      .where({ account_id: parsedAccountId })
      .orderBy('start_time', 'desc')
      .limit(parsedPageSize)
      .offset(offset);

    // 计算总记录数
    const totalCountResult = await db('email_sync_logs')
      .where({ account_id: parsedAccountId })
      .count('id as count')
      .first();
    
    const totalCount = totalCountResult ? (totalCountResult.count as number) : 0;
    const totalPages = Math.ceil(totalCount / parsedPageSize);

    // 格式化响应
    const formattedLogs = syncLogs.map(log => ({
      id: log.id,
      accountId: log.account_id,
      syncType: log.sync_type,
      status: log.status,
      totalMessages: log.total_messages,
      newMessages: log.new_messages,
      updatedMessages: log.updated_messages,
      failedMessages: log.failed_messages,
      lastUid: log.last_uid,
      errorMessage: log.error_message,
      mailboxes: log.mailboxes ? JSON.parse(log.mailboxes) : [],
      startTime: log.start_time,
      endTime: log.end_time,
      createdAt: log.created_at,
      updatedAt: log.updated_at
    }));

    const response: ApiResponse = {
      success: true,
      message: '获取同步历史记录成功',
      data: {
        syncLogs: formattedLogs,
        pagination: {
          page: parsedPage,
          pageSize: parsedPageSize,
          total: totalCount,
          totalPages
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('获取同步历史记录失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取同步历史记录失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 取消正在进行的同步任务
 */
export async function cancelSync(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      res.status(400).json({
        success: false,
        message: '无效的同步日志ID'
      });
      return;
    }

    // 取消同步任务
    const cancelled = await EmailSyncService.cancelSync(parsedId);

    const response: ApiResponse = {
      success: true,
      message: cancelled ? '同步任务已取消' : '同步任务不在进行中，无法取消'
    };

    res.json(response);
  } catch (error) {
    console.error('取消同步任务失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '取消同步任务失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 获取邮箱文件夹列表
 * 目前返回固定的常用文件夹列表
 */
export async function getMailboxList(req: Request, res: Response): Promise<void> {
  try {
    // 从查询参数中获取账户ID（如果提供）
    const { accountId } = req.query;
    
    // 如果提供了accountId，验证其格式和有效性
    if (accountId !== undefined) {
      const parsedAccountId = parseInt(accountId as string);
      if (isNaN(parsedAccountId)) {
        res.status(400).json({
          success: false,
          message: '无效的邮件ID'
        });
        return;
      }
      
      // 验证账户是否存在
      const account = await db('email_accounts').where({ id: parsedAccountId }).first();
      if (!account) {
        res.status(404).json({
          success: false,
          message: '邮箱账户不存在'
        });
        return;
      }
    }
    
    // 常用的邮箱文件夹列表
    const mailboxes = [
      { name: 'INBOX', displayName: '收件箱' },
      { name: 'Sent', displayName: '已发送' },
      { name: 'Drafts', displayName: '草稿箱' },
      { name: 'Trash', displayName: '已删除' },
      { name: 'Junk', displayName: '垃圾邮件' },
      { name: 'Archive', displayName: '归档' }
    ];

    const response: ApiResponse = {
      success: true,
      message: '获取邮箱文件夹列表成功',
      data: mailboxes
    };

    res.json(response);
  } catch (error) {
    console.error('获取邮箱文件夹列表失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取邮箱文件夹列表失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 获取邮件统计信息
 */
export async function getEmailStats(req: Request, res: Response): Promise<void> {
  try {
    const { accountId } = req.params;

    const parsedAccountId = parseInt(accountId);
    if (isNaN(parsedAccountId)) {
      res.status(400).json({
        success: false,
        message: '无效的邮箱账户ID'
      });
      return;
    }

    // 获取邮件总数
    const totalCountResult = await db('email_messages')
      .where({ account_id: parsedAccountId })
      .count('id as count')
      .first();
    
    const totalCount = totalCountResult ? (totalCountResult.count as number) : 0;

    // 获取未读邮件数
    const unreadCountResult = await db('email_messages')
      .where({ account_id: parsedAccountId, status: 'unread' })
      .count('id as count')
      .first();
    
    const unreadCount = unreadCountResult ? (unreadCountResult.count as number) : 0;

    // 获取带附件的邮件数
    const attachmentCountResult = await db('email_messages')
      .where({ account_id: parsedAccountId, has_attachments: true })
      .count('id as count')
      .first();
    
    const attachmentCount = attachmentCountResult ? (attachmentCountResult.count as number) : 0;

    // 按文件夹统计
    const mailboxStats = await db('email_messages')
      .where({ account_id: parsedAccountId })
      .select('mailbox')
      .count('id as count')
      .groupBy('mailbox');

    // 格式化邮箱统计信息
    const formattedMailboxStats = mailboxStats.map(stat => ({
      mailbox: stat.mailbox,
      count: stat.count
    }));

    // 获取最后同步时间
    const lastSync = await db('email_sync_logs')
      .where({ account_id: parsedAccountId, status: 'completed' })
      .orderBy('end_time', 'desc')
      .first();

    const lastSyncTime = lastSync ? lastSync.end_time : null;

    const response: ApiResponse = {
      success: true,
      message: '获取邮件统计信息成功',
      data: {
        totalCount,
        unreadCount,
        attachmentCount,
        mailboxStats: formattedMailboxStats,
        lastSyncTime
      }
    };

    res.json(response);
  } catch (error) {
    console.error('获取邮件统计信息失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取邮件统计信息失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}