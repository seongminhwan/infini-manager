/**
 * 邮件同步服务
 * 负责将邮件从邮箱服务器同步到本地数据库
 */
import db from '../db/db';
import { GmailMessage, GmailQueryOptions } from '../types';
import addressparser from 'addressparser';

/**
 * 定义邮件地址对象接口
 */
interface AddressObject {
  address: string;
  name?: string;
  group?: string[];
}

// 动态导入GmailClient以避免在不需要时加载node-imap
let GmailClient: any = null;

/**
 * 邮件同步服务类
 */
export class EmailSyncService {
  /**
   * 执行邮件同步操作
   * @param accountId 邮箱账户ID
   * @param syncType 同步类型: 'full'全量同步 或 'incremental'增量同步
   * @param mailboxes 要同步的邮箱文件夹，默认为['INBOX']
   * @param startDate 同步起始日期，默认为一个月前，格式为YYYY-MM-DD
   * @param endDate 同步截止日期，不填则不限制，格式为YYYY-MM-DD
   * @returns 同步日志ID
   */
  public async syncEmails(
    accountId: number,
    syncType: 'full' | 'incremental' = 'incremental',
    mailboxes: string[] = ['INBOX'],
    startDate?: string,
    endDate?: string
  ): Promise<number> {
    // 获取邮箱账户信息
    const account = await db('email_accounts').where({ id: accountId }).first();
    if (!account) {
      throw new Error(`邮箱账户不存在: ${accountId}`);
    }

    if (account.status !== 'active') {
      throw new Error(`邮箱账户未激活，无法同步邮件: ${accountId}`);
    }

    // 如果是全量同步且没有指定起始日期，则默认为一个月前
    if (syncType === 'full' && !startDate) {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      startDate = oneMonthAgo.toISOString().split('T')[0]; // 格式化为YYYY-MM-DD
    }

    // 创建同步日志记录
    const [syncLogId] = await db('email_sync_logs').insert({
      account_id: accountId,
      sync_type: syncType,
      status: 'processing',
      mailboxes: JSON.stringify(mailboxes),
      start_time: db.fn.now(),
      metadata: JSON.stringify({ startDate, endDate }) // 存储时间区间信息
    });

    // 启动异步同步任务
    this.performSyncTask(accountId, syncLogId, syncType, mailboxes, startDate, endDate).catch(error => {
      console.error(`邮件同步任务(ID: ${syncLogId})执行失败:`, error);
      // 更新同步日志状态为失败
      db('email_sync_logs')
        .where({ id: syncLogId })
        .update({
          status: 'failed',
          error_message: error.message || String(error),
          end_time: db.fn.now(),
          updated_at: db.fn.now()
        })
        .catch(updateError => {
          console.error(`更新同步日志状态失败:`, updateError);
        });
    });

    return syncLogId;
  }

  /**
   * 执行邮件同步任务
   * @param accountId 邮箱账户ID
   * @param syncLogId 同步日志ID
   * @param syncType 同步类型
   * @param mailboxes 邮箱文件夹列表
   * @param startDate 同步起始日期，格式为YYYY-MM-DD
   * @param endDate 同步截止日期，格式为YYYY-MM-DD
   */
  private async performSyncTask(
    accountId: number,
    syncLogId: number,
    syncType: 'full' | 'incremental',
    mailboxes: string[],
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    // 获取邮箱账户信息
    const account = await db('email_accounts').where({ id: accountId }).first();
    if (!account) {
      throw new Error(`邮箱账户不存在: ${accountId}`);
    }

    // 初始化计数器
    let totalMessages = 0;
    let newMessages = 0;
    let updatedMessages = 0;
    let failedMessages = 0;
    let lastUid = 0;

    try {
      // 动态加载GmailClient
      if (!GmailClient) {
        try {
          const module = await import('../utils/gmailClient');
          GmailClient = module.default;
        } catch (error) {
          throw new Error('无法加载邮件客户端: ' + (error as Error).message);
        }
      }

      // 创建邮件客户端
      const config: any = {
        user: account.email,
        password: account.password,
        imapHost: account.imap_host,
        imapPort: account.imap_port,
        imapSecure: account.imap_secure,
        smtpHost: account.smtp_host,
        smtpPort: account.smtp_port,
        smtpSecure: account.smtp_secure
      };
      
      // 添加代理配置
      if (account.use_proxy) {
        console.log(`使用代理配置同步邮箱 ${account.email}, 代理模式: ${account.proxy_mode}`);
        config.useProxy = true;
        config.proxyMode = account.proxy_mode;
        
        if (account.proxy_mode === 'specific' && account.proxy_server_id) {
          config.proxyServerId = account.proxy_server_id;
        } else if (account.proxy_mode === 'tag_random' && account.proxy_tag) {
          config.proxyTag = account.proxy_tag;
        }
      } else {
        console.log(`直接连接同步邮箱 ${account.email} (不使用代理)`);
      }

      const gmailClient = new GmailClient(config);

      // 对每个邮箱文件夹执行同步
      for (const mailbox of mailboxes) {
        console.log(`开始同步邮箱 ${account.email} 的 ${mailbox} 文件夹`);

        // 构建查询选项
        const queryOptions: GmailQueryOptions = {
          mailbox,
          limit: syncType === 'full' ? 1000 : 100, // 全量同步一次最多1000封，增量同步每次100封
          searchFilter: ['ALL'],
          fetchOptions: {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
            struct: true,
            markSeen: false // 不标记为已读
          }
        };

        // 添加日期范围条件
        if (startDate) {
          const startDateObj = new Date(startDate);
          queryOptions.since = startDateObj; // 使用Date对象
          console.log(`设置同步起始日期: ${startDateObj.toDateString()}`);
        }

        if (endDate) {
          const endDateObj = new Date(endDate);
          queryOptions.before = endDateObj; // 使用Date对象
          console.log(`设置同步截止日期: ${endDateObj.toDateString()}`);
        }

        // 如果是增量同步，查找上次同步记录
        if (syncType === 'incremental') {
          const lastSync = await db('email_sync_logs')
            .where({
              account_id: accountId,
              status: 'completed'
            })
            .orderBy('end_time', 'desc')
            .first();

          if (lastSync && lastSync.last_uid) {
            // 设置增量同步的起始点（上次同步的最后一封邮件之后的邮件）
            // node-imap 期望的 UID 搜索格式是 ['UID', 'START:END']
            queryOptions.searchFilter = [['UID', `${lastSync.last_uid + 1}:*`]];
          } else {
            // 如果没有上次同步记录，限制只获取最近100封邮件
            queryOptions.limit = 100;
          }
        }

        // 获取邮件列表
        const messages = await gmailClient.listMessages(queryOptions);
        console.log(`从邮箱 ${mailbox} 获取了 ${messages.length} 封邮件`);

        // 处理每封邮件
        for (const message of messages) {
          try {
            // 更新最后处理的UID
            if (message.uid && message.uid > lastUid) {
              lastUid = message.uid;
            }

            // 处理邮件
            const isNewMessage = await this.processEmail(accountId, mailbox, message);
            if (isNewMessage) {
              newMessages++;
            } else {
              updatedMessages++;
            }

            totalMessages++;
          } catch (error) {
            console.error(`处理邮件失败(UID: ${message.uid}):`, error);
            failedMessages++;
          }
        }
      }

      // 更新同步日志为成功状态
      await db('email_sync_logs')
        .where({ id: syncLogId })
        .update({
          status: 'completed',
          total_messages: totalMessages,
          new_messages: newMessages,
          updated_messages: updatedMessages,
          failed_messages: failedMessages,
          last_uid: lastUid > 0 ? lastUid : null,
          end_time: db.fn.now(),
          updated_at: db.fn.now()
        });

      console.log(`邮件同步完成: 总数 ${totalMessages}, 新增 ${newMessages}, 更新 ${updatedMessages}, 失败 ${failedMessages}`);
    } catch (error) {
      // 更新同步日志为失败状态
      await db('email_sync_logs')
        .where({ id: syncLogId })
        .update({
          status: 'failed',
          total_messages: totalMessages,
          new_messages: newMessages,
          updated_messages: updatedMessages,
          failed_messages: failedMessages,
          last_uid: lastUid > 0 ? lastUid : null,
          error_message: (error as Error).message || String(error),
          end_time: db.fn.now(),
          updated_at: db.fn.now()
        });

      // 重新抛出错误，以便调用者可以处理
      throw error;
    }
  }

  /**
   * 处理单封邮件，将其保存到数据库
   * @param accountId 邮箱账户ID
   * @param mailbox 邮箱文件夹
   * @param message 邮件信息
   * @returns 是否为新邮件
   */
  private async processEmail(
    accountId: number,
    mailbox: string,
    message: GmailMessage
  ): Promise<boolean> {
    // 判断邮件状态
    const status = message.flags && message.flags.includes('\\Seen') ? 'read' : 'unread';

    // 检查邮件是否已存在
    const existingMessage = await db('email_messages')
      .where({
        account_id: accountId,
        uid: message.uid,
        mailbox
      })
      .first();

    // 转换附件信息
    const hasAttachments = message.attachments && message.attachments.length > 0;
    const attachmentsCount = message.attachments ? message.attachments.length : 0;

    /**
     * 使用addressparser库解析邮件地址
     * @param addressField 邮件地址字段（可能是字符串、数组或对象）
     * @returns 处理后的地址数组和名称数组
     */
    const processAddressField = (addressField: string | string[] | Record<string, any> | null | undefined): { addresses: string[], names: string[] } => {
      const result = { addresses: [] as string[], names: [] as string[] };
      
      if (!addressField) {
        return result;
      }
      
      try {
        // 处理字符串格式
        if (typeof addressField === 'string') {
          const parsed: AddressObject[] = addressparser(addressField);
          parsed.forEach((addr: AddressObject) => {
            if (addr.address) result.addresses.push(addr.address);
            if (addr.name) result.names.push(addr.name);
          });
        }
        // 处理数组格式
        else if (Array.isArray(addressField)) {
          addressField.forEach((item: string | any) => {
            if (typeof item === 'string') {
              const parsed: AddressObject[] = addressparser(item);
              parsed.forEach((addr: AddressObject) => {
                if (addr.address) result.addresses.push(addr.address);
                if (addr.name) result.names.push(addr.name);
              });
            } else if (item && typeof item === 'object' && item.address) {
              result.addresses.push(item.address as string);
              if (item.name) result.names.push(item.name as string);
            }
          });
        }
        // 处理对象格式
        else if (addressField && typeof addressField === 'object' && addressField.address) {
          result.addresses.push(addressField.address as string);
          if (addressField.name) result.names.push(addressField.name as string);
        }
      } catch (error) {
        console.error('解析邮件地址失败:', error);
        // 失败时尝试使用原始值
        if (typeof addressField === 'string') {
          result.addresses.push(addressField);
        }
      }
      
      return result;
    };
    
    // 处理发件人信息
    const fromParsed = processAddressField(message.from);
    const fromAddress = fromParsed.addresses.length > 0 ? fromParsed.addresses[0] : '';
    const fromName = fromParsed.names.length > 0 ? fromParsed.names[0] : '';
    
    // 处理收件人信息
    const toParsed = processAddressField(message.to);
    const toAddress = toParsed.addresses.join(', ');

    // 提取邮件摘要
    const snippet = message.text 
      ? message.text.substring(0, 200).replace(/\r?\n/g, ' ') 
      : '';

    // 准备邮件基本信息
    const emailData = {
      account_id: accountId,
      message_id: message.messageId || '',
      uid: message.uid || 0,
      from_address: fromAddress,
      from_name: fromName,
      to_address: toAddress,
      cc_address: processAddressField(message.cc).addresses.join(', '),
      bcc_address: processAddressField(message.bcc).addresses.join(', '),
      subject: message.subject || '(无主题)',
      date: message.date || new Date(),
      flags: message.flags ? JSON.stringify(message.flags) : null,
      has_attachments: hasAttachments,
      attachments_count: attachmentsCount,
      status,
      snippet,
      mailbox
    };

    // 使用事务处理，确保数据一致性
    return db.transaction(async trx => {
      let messageId: number;
      let isNewMessage = false;

      if (existingMessage) {
        // 更新现有邮件
        await trx('email_messages')
          .where({ id: existingMessage.id })
          .update({
            ...emailData,
            updated_at: trx.fn.now()
          });
        messageId = existingMessage.id;
      } else {
        // 插入新邮件
        const [id] = await trx('email_messages').insert(emailData);
        messageId = id;
        isNewMessage = true;
      }

      // 处理邮件内容
      const contentData = {
        email_id: messageId,
        text_content: message.text || null,
        html_content: message.html || null,
        raw_headers: message.headers ? JSON.stringify(message.headers) : null
      };

      if (existingMessage) {
        // 更新现有内容
        await trx('email_message_contents')
          .where({ email_id: messageId })
          .delete();
      }
      
      // 插入新内容
      await trx('email_message_contents').insert(contentData);

      // 处理附件
      if (hasAttachments && message.attachments) {
        // 删除现有附件
        if (existingMessage) {
          await trx('email_message_attachments')
            .where({ email_id: messageId })
            .delete();
        }

        // 插入新附件
        for (const attachment of message.attachments) {
          await trx('email_message_attachments').insert({
            email_id: messageId,
            filename: attachment.filename || '未命名附件',
            content_type: attachment.contentType || 'application/octet-stream',
            content_id: attachment.contentId || null,
            content_disposition: attachment.contentDisposition || 'attachment',
            size: attachment.size || attachment.content.length,
            content: attachment.content,
            is_stored: true
          });
        }
      }

      return isNewMessage;
    });
  }

  /**
   * 获取同步状态
   * @param syncLogId 同步日志ID
   * @returns 同步状态信息
   */
  public async getSyncStatus(syncLogId: number): Promise<any> {
    const syncLog = await db('email_sync_logs')
      .where({ id: syncLogId })
      .first();

    if (!syncLog) {
      throw new Error(`同步日志不存在: ${syncLogId}`);
    }

    return syncLog;
  }

  /**
   * 取消正在进行的同步任务
   * @param syncLogId 同步日志ID
   * @returns 是否取消成功
   */
  public async cancelSync(syncLogId: number): Promise<boolean> {
    const syncLog = await db('email_sync_logs')
      .where({ id: syncLogId })
      .first();

    if (!syncLog) {
      throw new Error(`同步日志不存在: ${syncLogId}`);
    }

    if (syncLog.status !== 'processing') {
      throw new Error(`同步任务不在进行中，无法取消: ${syncLogId}`);
    }

    // 更新同步日志状态为取消
    await db('email_sync_logs')
      .where({ id: syncLogId })
      .update({
        status: 'cancelled',
        end_time: db.fn.now(),
        updated_at: db.fn.now()
      });

    return true;
  }
}

// 导出服务单例
export default new EmailSyncService();