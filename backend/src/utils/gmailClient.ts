/**
 * Gmail工具组件
 * 基于IMAP/SMTP协议读取和发送Gmail邮件
 */
import IMAP = require('node-imap');
import * as nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import { 
  GmailConfig, 
  GmailMessage, 
  GmailMessageSendOptions, 
  GmailQueryOptions,
  GmailAttachment 
} from '../types';

/**
 * Gmail客户端类
 * 提供Gmail相关功能，包括读取邮件和发送邮件
 */
class GmailClient {
  private imapClient: IMAP;
  private smtpTransporter: nodemailer.Transporter;
  private config: GmailConfig;

  /**
   * 构造函数，初始化Gmail客户端
   * @param config Gmail配置
   */
  constructor(config: GmailConfig) {
    this.config = config;

    // 初始化IMAP客户端
    this.imapClient = new IMAP({
      user: config.user,
      password: config.password,
      host: config.imapHost,
      port: config.imapPort,
      tls: config.imapSecure,
      tlsOptions: { rejectUnauthorized: false }
    });

    // 初始化SMTP邮件发送器 - 使用标准nodemailer配置
    this.smtpTransporter = nodemailer.createTransport({
      service: 'gmail', // 使用预定义的Gmail服务
      auth: {
        user: config.user,
        pass: config.password
      },
      // 安全选项
      tls: {
        rejectUnauthorized: false // 允许自签名证书
      },
      debug: true // 启用调试模式
    });
  }

  /**
   * 连接到IMAP服务器
   * @returns 返回Promise<void>
   */
  private connectImap(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.imapClient.once('ready', () => {
        resolve();
      });

      this.imapClient.once('error', (err) => {
        reject(err);
      });

      this.imapClient.connect();
    });
  }

  /**
   * 关闭IMAP连接
   */
  private disconnectImap(): void {
    if (this.imapClient && this.imapClient.state !== 'disconnected') {
      this.imapClient.end();
    }
  }

  /**
   * 选择邮箱
   * @param mailbox 邮箱名称，默认为'INBOX'
   * @returns 返回Promise<Box>
   */
  private openMailbox(mailbox: string = 'INBOX'): Promise<IMAP.Box> {
    return new Promise((resolve, reject) => {
      this.imapClient.openBox(mailbox, false, (err, box) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(box);
      });
    });
  }

  /**
   * 获取邮件列表
   * @param options 查询选项
   * @returns 返回Promise<GmailMessage[]>
   */
  async listMessages(options: GmailQueryOptions = {}): Promise<GmailMessage[]> {
    try {
      // 连接到IMAP服务器
      await this.connectImap();

      // 打开邮箱
      const mailbox = options.mailbox || 'INBOX';
      await this.openMailbox(mailbox);

      // 构建搜索条件
      const searchCriteria: any[] = options.searchFilter || ['ALL'];
      
      // 添加日期筛选
      if (options.since) {
        searchCriteria.push(['SINCE', options.since]);
      }
      
      if (options.before) {
        searchCriteria.push(['BEFORE', options.before]);
      }

      // 获取邮件列表
      const messages = await this.searchMessages(searchCriteria, options);

      // 关闭连接
      this.disconnectImap();

      return messages;
    } catch (error) {
      this.disconnectImap();
      console.error('获取邮件列表失败:', error);
      throw new Error(`获取邮件列表失败: ${error}`);
    }
  }

  /**
   * 搜索邮件
   * @param criteria 搜索条件
   * @param options 查询选项
   * @returns 返回Promise<GmailMessage[]>
   */
  private searchMessages(criteria: any[], options: GmailQueryOptions): Promise<GmailMessage[]> {
    return new Promise((resolve, reject) => {
      const fetchOptions = options.fetchOptions || {
        bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
        struct: true,
        markSeen: options.markSeen || false
      };
      
      const messages: GmailMessage[] = [];
      let messageCount = 0;
      
      // 限制邮件数量
      const limit = options.limit || 10;

      this.imapClient.search(criteria, (err, uids) => {
        if (err) {
          reject(err);
          return;
        }

        if (!uids || uids.length === 0) {
          resolve([]);
          return;
        }

        // 对UID进行排序（最新的邮件在前）
        uids.sort((a, b) => b - a);

        // 限制数量
        if (limit > 0 && uids.length > limit) {
          uids = uids.slice(0, limit);
        }

        const fetch = this.imapClient.fetch(uids, fetchOptions);

        fetch.on('message', (msg, seqno) => {
          const message: GmailMessage = {
            uid: 0,
            seqno,
            headers: []
          };

          msg.on('body', (stream, info) => {
            let buffer = '';

            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });

            stream.once('end', () => {
              if (info.which.indexOf('HEADER') === 0) {
                const headers = IMAP.parseHeader(buffer);
                
                // 转换标准邮件头
                message.subject = headers.subject?.[0] || '';
                message.from = headers.from?.[0] || '';
                message.to = headers.to?.[0] || '';
                message.date = headers.date ? new Date(headers.date[0]) : undefined;
                
                // 保存所有头信息
                Object.keys(headers).forEach(key => {
                  if (headers[key]?.[0]) {
                    message.headers?.push({
                      name: key,
                      value: headers[key][0]
                    });
                  }
                });
              } else {
                // 解析邮件正文
                simpleParser(buffer)
                  .then(parsed => {
                    message.text = parsed.text || '';
                    message.html = parsed.html || '';
                    message.attachments = parsed.attachments as GmailAttachment[];
                  })
                  .catch(e => console.error('解析邮件内容失败:', e));
              }
            });
          });

          msg.once('attributes', (attrs) => {
            message.uid = attrs.uid;
            message.flags = attrs.flags;
            message.attributes = attrs;
            message.messageId = attrs.envelope?.messageId;
          });

          msg.once('end', () => {
            messages.push(message);
            messageCount++;
            
            if (messageCount === uids.length) {
              // 所有邮件都已处理完毕
              resolve(messages);
            }
          });
        });

        fetch.once('error', (err) => {
          reject(err);
        });

        fetch.once('end', () => {
          // 可能没有任何邮件处理
          if (messageCount === 0) {
            resolve([]);
          }
        });
      });
    });
  }

  /**
   * 获取指定UID的邮件
   * 这是一个简化版本，避免node-imap的搜索复杂性
   * @param uid 邮件UID
   * @param mailbox 邮箱名称，默认为'INBOX'
   * @returns 返回Promise<GmailMessage | null>
   */
  async getMessage(uid: number, mailbox: string = 'INBOX'): Promise<GmailMessage | null> {
    // 不使用search功能，而是采用更可靠的方式
    // 首先获取邮件列表，然后在应用层面过滤UID    
    try {
      console.log(`尝试获取邮件详情，UID: ${uid}, 邮箱: ${mailbox}`);
      
      // 使用listMessages，避免直接使用UID搜索
      const messages = await this.listMessages({
        mailbox: mailbox,
        limit: 100, // 增大获取数量，以提高找到目标邮件的可能性
        searchFilter: ['ALL']
      });
      
      // 在应用层面根据UID查找邮件
      const targetMessage = messages.find(msg => msg.uid === uid);
      
      if (targetMessage) {
        console.log(`在邮箱列表中找到目标邮件 UID: ${uid}`);
        return targetMessage;
      } else {
        console.log(`未在邮箱列表中找到目标邮件 UID: ${uid}`);
        return null;
      }
    } catch (error) {
      console.error(`获取邮件详情(UID: ${uid})失败:`, error);
      return null;
    }
  }

  /**
   * 发送邮件
   * @param options 邮件发送选项
   * @returns 返回Promise<string> 成功时返回消息ID
   */
  async sendMessage(options: GmailMessageSendOptions): Promise<string> {
    try {
      // 构造邮件选项
      const mailOptions: nodemailer.SendMailOptions = {
        from: options.from || this.config.user,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        attachments: options.attachments,
        headers: options.headers
      };

      // 添加抄送和密送
      if (options.cc) {
        mailOptions.cc = options.cc;
      }

      if (options.bcc) {
        mailOptions.bcc = options.bcc;
      }

      // 发送邮件
      const info = await this.smtpTransporter.sendMail(mailOptions);
      
      // 发送邮件后稍等片刻，让服务器有时间处理
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return info.messageId || '';
    } catch (error) {
      console.error('发送邮件失败:', error);
      throw new Error(`发送邮件失败: ${error}`);
    }
  }

  /**
   * 搜索邮件列表中是否包含指定主题的邮件
   * @param subject 邮件主题关键词
   * @param mailbox 邮箱名称
   * @returns Promise<GmailMessage | null>
   */
  async findEmailBySubject(subject: string, mailbox: string = 'INBOX'): Promise<GmailMessage | null> {
    try {
      console.log(`尝试在邮箱 ${mailbox} 中查找包含主题 "${subject}" 的邮件`);
      
      // 获取最近的邮件列表
      const messages = await this.listMessages({
        mailbox: mailbox,
        limit: 50, // 扩大搜索范围
        searchFilter: ['ALL']
      });
      
      // 查找包含指定主题的邮件
      const targetMessage = messages.find(msg => 
        msg.subject && msg.subject.includes(subject)
      );
      
      if (targetMessage) {
        console.log(`找到包含主题 "${subject}" 的邮件，UID: ${targetMessage.uid}`);
        return targetMessage;
      } else {
        console.log(`未找到包含主题 "${subject}" 的邮件`);
        return null;
      }
    } catch (error) {
      console.error(`查找包含主题 "${subject}" 的邮件失败:`, error);
      return null;
    }
  }

  /**
   * 从工厂函数创建GmailClient实例
   * @returns GmailClient实例
   */
  static createClient(): GmailClient {
    // 从环境变量获取Gmail配置
    const config: GmailConfig = {
      user: process.env.GMAIL_USER || '',
      password: process.env.GMAIL_PASSWORD || '',
      imapHost: process.env.GMAIL_IMAP_HOST || 'imap.gmail.com',
      imapPort: parseInt(process.env.GMAIL_IMAP_PORT || '993', 10),
      imapSecure: process.env.GMAIL_IMAP_SECURE === 'true',
      // 标准配置 - 使用service参数时这些参数实际上不会被使用
      smtpHost: process.env.GMAIL_SMTP_HOST || 'smtp.gmail.com',
      smtpPort: parseInt(process.env.GMAIL_SMTP_PORT || '465', 10),
      smtpSecure: process.env.GMAIL_SMTP_SECURE !== 'false'
    };

    // 验证配置
    if (!config.user || !config.password) {
      throw new Error('Gmail配置缺失，请确保环境变量已正确设置 (GMAIL_USER, GMAIL_PASSWORD)');
    }

    console.log('创建Gmail客户端，配置:', {
      user: config.user,
      imapHost: config.imapHost,
      imapPort: config.imapPort,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpSecure: config.smtpSecure
    });

    return new GmailClient(config);
  }
}

export default GmailClient;