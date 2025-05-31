/**
 * Gmail工具组件
 * 基于IMAP/SMTP协议读取和发送Gmail邮件
 * 支持HTTP/SOCKS5代理配置
 */
import IMAP = require('node-imap');
import * as nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';
import * as iconv from 'iconv-lite';
import * as quotedPrintable from 'quoted-printable';
import { 
  GmailConfig, 
  GmailMessage, 
  GmailMessageSendOptions, 
  GmailQueryOptions,
  GmailAttachment 
} from '../types';
import { 
  SimpleProxyConfig, 
  getProxyById, 
  getRandomProxyByTag, 
  createImapProxyAgent,
  createSmtpProxyConfig
} from './ProxyUtils';

/**
 * Gmail客户端类
 * 提供Gmail相关功能，包括读取邮件和发送邮件
 */
class GmailClient {
  private imapClient: IMAP;
  private smtpTransporter: nodemailer.Transporter;
  private config: GmailConfig;
  private proxyConfig: SimpleProxyConfig | null = null;

  /**
   * 构造函数，初始化Gmail客户端
   * @param config Gmail配置
   */
  constructor(config: GmailConfig) {
    this.config = config;

    // 先初始化空的客户端，实际连接时会重新创建
    this.imapClient = new IMAP({
      user: config.user,
      password: config.password,
      host: config.imapHost,
      port: config.imapPort,
      tls: config.imapSecure,
      tlsOptions: { rejectUnauthorized: false }
    });

    // 初始化空的SMTP发送器，实际发送时会重新创建
    this.smtpTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.user,
        pass: config.password
      },
      tls: { rejectUnauthorized: false }
    });
  }

  /**
   * 设置代理配置
   * 根据GmailConfig中的代理设置获取实际的代理配置
   * @returns 返回Promise<SimpleProxyConfig | null>
   */
  private async setupProxy(): Promise<SimpleProxyConfig | null> {
    // 如果代理配置已缓存且不使用随机标签模式，直接返回
    if (this.proxyConfig && this.config.proxyMode !== 'tag_random') {
      return this.proxyConfig;
    }

    // 检查是否需要使用代理
    if (!this.config.useProxy) {
      this.proxyConfig = null;
      return null;
    }

    // 如果已经有现成的代理配置，直接使用
    if (this.config.proxyConfig) {
      this.proxyConfig = this.config.proxyConfig;
      return this.proxyConfig;
    }

    try {
      // 根据代理模式获取代理配置
      switch (this.config.proxyMode) {
        case 'specific':
          // 使用指定的代理服务器
          if (this.config.proxyServerId) {
            this.proxyConfig = await getProxyById(this.config.proxyServerId);
          }
          break;
        
        case 'tag_random':
          // 根据标签随机选择代理服务器
          if (this.config.proxyTag) {
            this.proxyConfig = await getRandomProxyByTag(this.config.proxyTag);
          }
          break;
        
        default:
          // 直连模式，不使用代理
          this.proxyConfig = null;
      }

      return this.proxyConfig;
    } catch (error) {
      console.error('设置代理配置失败:', error);
      return null;
    }
  }

  /**
   * 连接到IMAP服务器
   * @returns 返回Promise<void>
   */
  private connectImap(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // 获取代理配置
        const proxyConfig = await this.setupProxy();
        
        // 创建IMAP配置选项
        const imapOptions: any = {
          user: this.config.user,
          password: this.config.password,
          host: this.config.imapHost,
          port: this.config.imapPort,
          tls: this.config.imapSecure,
          tlsOptions: { rejectUnauthorized: false }
        };

        // 如果有代理配置，添加代理代理
        if (proxyConfig) {
          console.log(`IMAP连接使用代理: ${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`);
          
          // 创建代理代理
          const agent = createImapProxyAgent(proxyConfig);
          if (agent) {
            imapOptions.tlsOptions = {
              ...imapOptions.tlsOptions,
              rejectUnauthorized: false
            };
            
            // 根据IMAP连接是否使用SSL/TLS设置不同的代理
            if (this.config.imapSecure) {
              imapOptions.tlsOptions.agent = agent;
            } else {
              imapOptions.socketTimeout = 60000; // 增加超时时间
              imapOptions.connTimeout = 60000;
              imapOptions.agent = agent;
            }
          } else {
            console.warn('创建IMAP代理代理失败，将使用直连模式');
          }
        }

        // 创建新的IMAP客户端
        this.imapClient = new IMAP(imapOptions);

        // 设置事件处理
        this.imapClient.once('ready', () => {
          resolve();
        });

        this.imapClient.once('error', (err) => {
          reject(err);
        });

        // 连接到IMAP服务器
        this.imapClient.connect();
      } catch (error) {
        reject(error);
      }
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
        // 请求完整的邮件头和正文，确保获取所有内容
        bodies: ['HEADER', 'TEXT', ''],  // 空字符串''表示完整邮件体(RFC822)
        struct: true, 
        markSeen: options.markSeen || false
      };
      
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

        // 为每个邮件创建一个Promise
        const messagePromises: Promise<GmailMessage>[] = [];
        const fetch = this.imapClient.fetch(uids, fetchOptions);

        fetch.on('message', (msg, seqno) => {
          // 为每个邮件创建一个Promise
          const messagePromise = new Promise<GmailMessage>((resolveMessage, rejectMessage) => {
            const message: GmailMessage = {
              uid: 0,
              seqno,
              headers: []
            };

            // 用于跟踪各个部分的处理状态
            const partsStatus = {
              headerDone: false,
              bodyDone: false,
              attributesDone: false
            };

            // 当所有部分处理完毕时解析Promise
            const checkAllPartsDone = () => {
              if (partsStatus.headerDone && partsStatus.bodyDone && partsStatus.attributesDone) {
                resolveMessage(message);
              }
            };

            // 处理邮件各个部分
            msg.on('body', (stream, info) => {
              // 如果是 HEADER 部分
              if (info.which.toUpperCase().startsWith('HEADER')) {
                let headerBuffer = '';
                stream.on('data', (chunk) => {
                  headerBuffer += chunk.toString('utf8');
                });
                stream.once('end', () => {
                  const headers = IMAP.parseHeader(headerBuffer);
                  message.subject = headers.subject?.[0] || '';
                  message.from = headers.from?.[0] || '';
                  message.to = headers.to?.[0] || '';
                  message.date = headers.date ? new Date(headers.date[0]) : undefined;
                  message.headers = [];
                  Object.keys(headers).forEach(key => {
                    if (headers[key]?.[0]) {
                      message.headers?.push({ name: key, value: headers[key][0] });
                    }
                  });
                  
                  partsStatus.headerDone = true;
                  checkAllPartsDone();
                });
              } else if (info.which === 'TEXT') {
                // 处理邮件正文内容部分 - 根据实际测试，TEXT部分包含文本内容
                const chunks: Buffer[] = [];
                stream.on('data', (chunk) => {
                  chunks.push(chunk as Buffer);
                });
                stream.once('end', () => {
                  const rawEmail = Buffer.concat(chunks);
                  
                  // 尝试检测编码并转换内容
                  try {
                    // 先尝试检查是否是quoted-printable编码
                    const rawString = rawEmail.toString();
                    let decodedText = '';
                    
                    // 检查是否包含quoted-printable编码的特征
                    if (rawString.includes('=?') && rawString.includes('?=')) {
                      try {
                        // 解码quoted-printable内容
                        decodedText = quotedPrintable.decode(rawString);
                      } catch (qpError) {
                        console.warn(`Quoted-printable解码失败:`, qpError);
                        decodedText = rawString;
                      }
                    } else {
                      decodedText = rawString;
                    }
                    
                    // 检测并转换字符编码
                    // 常见的非UTF-8编码，特别是中文邮件可能使用的编码
                    const encodings = ['utf-8', 'gb2312', 'gbk', 'big5', 'iso-8859-1'];
                    
                    // 尝试不同编码进行转换
                    let convertedText = decodedText;
                    for (const encoding of encodings) {
                      try {
                        // 先转为Buffer，然后使用指定编码解码
                        const tempBuffer = iconv.encode(decodedText, 'utf-8');
                        const tempText = iconv.decode(tempBuffer, encoding);
                        
                        // 如果转换后的文本不包含乱码特征，则使用该编码
                        if (!tempText.includes('�') && tempText.length > 0) {
                          convertedText = tempText;
                          console.log(`成功使用${encoding}编码转换邮件内容`);
                          break;
                        }
                      } catch (encError) {
                        console.warn(`使用${encoding}编码转换失败:`, encError);
                      }
                    }
                    
                    // 设置转换后的文本内容
                    message.text = convertedText;
                    message.html = convertedText;
                  } catch (error) {
                    console.error(`邮件内容编码转换失败:`, error);
                    // 回退到原始内容
                    message.text = rawEmail.toString();
                    message.html = rawEmail.toString();
                  }
                  
                  // 使用Promise处理异步解析
                  simpleParser(rawEmail)
                    .then(parsed => {
                      // 根据截图中实际解析对象的结构进行赋值
                      // message.text = parsed.text || '';
                      
                      // // 特别处理html内容，优先使用parsed.html，如果不存在则使用textAsHtml
                      // if (parsed.html) {
                      //   message.html = parsed.html;
                      // } else if (parsed.textAsHtml) {
                      //   message.html = parsed.textAsHtml;
                      // } else {
                      //   message.html = '';
                      // }
                      
                      // 优先使用parsed的头信息
                      message.subject = parsed.subject || message.subject;
                      message.date = parsed.date || message.date;
                      
                      // 处理发件人信息
                      if (parsed.from) {
                        message.from = parsed.from.text || message.from;
                      }

                      // 处理收件人信息
                      if (parsed.to) {
                        message.to = Array.isArray(parsed.to)
                                     ? parsed.to.map(addrObj => addrObj.text).join(', ')
                                     : parsed.to.text;
                      } else if (message.to === undefined) {
                         message.to = '';
                      }

                      // 处理抄送人信息
                      if (parsed.cc) {
                        message.cc = Array.isArray(parsed.cc)
                                     ? parsed.cc.map(addrObj => addrObj.text).join(', ')
                                     : parsed.cc.text;
                      } else {
                        message.cc = undefined;
                      }

                      // 处理密送人信息
                      if (parsed.bcc) {
                        message.bcc = Array.isArray(parsed.bcc)
                                     ? parsed.bcc.map(addrObj => addrObj.text).join(', ')
                                     : parsed.bcc.text;
                      } else {
                        message.bcc = undefined;
                      }
                      
                      message.messageId = parsed.messageId || message.messageId;

                      // 处理附件信息
                      if (parsed.attachments && parsed.attachments.length > 0) {
                        message.attachments = parsed.attachments.map(att => ({
                          filename: att.filename || 'untitled',
                          contentType: att.contentType || 'application/octet-stream',
                          content: att.content,
                          contentDisposition: att.contentDisposition,
                          contentId: att.cid,
                          size: att.size
                        } as GmailAttachment));
                      }
                    })
                    .catch(parseError => {
                      console.error(`mailparser 解析邮件内容失败 (UID: ${message.uid}, SeqNo: ${seqno}):`, parseError);
                      // 回退处理
                      const fallbackText = rawEmail.toString('utf8');
                      message.text = fallbackText;
                      message.html = fallbackText;
                    })
                    .finally(() => {
                      partsStatus.bodyDone = true;
                      checkAllPartsDone();
                    });
                });
              } else {
                // 其他特定部分
                stream.on('data', () => {});
                stream.once('end', () => {});
              }
            });

            msg.once('attributes', (attrs) => {
              message.uid = attrs.uid;
              message.flags = attrs.flags;
              message.attributes = attrs;
              message.messageId = attrs.envelope?.messageId;
              
              partsStatus.attributesDone = true;
              checkAllPartsDone();
            });

            // 处理邮件结束事件
            msg.once('end', () => {
              // 确保即使某些部分没有触发也能正常处理
              setTimeout(() => {
                if (!partsStatus.headerDone) {
                  console.warn(`邮件(UID: ${message.uid}, SeqNo: ${seqno})的头部信息未完成处理`);
                  partsStatus.headerDone = true;
                }
                if (!partsStatus.bodyDone) {
                  console.warn(`邮件(UID: ${message.uid}, SeqNo: ${seqno})的内容未完成处理`);
                  partsStatus.bodyDone = true;
                }
                if (!partsStatus.attributesDone) {
                  console.warn(`邮件(UID: ${message.uid}, SeqNo: ${seqno})的属性未完成处理`);
                  partsStatus.attributesDone = true;
                }
                checkAllPartsDone();
              }, 1000); // 等待1秒，确保其他事件有机会触发
            });
          });

          messagePromises.push(messagePromise);
        });

        fetch.once('error', (err) => {
          reject(err);
        });

        fetch.once('end', () => {
          if (messagePromises.length === 0) {
            resolve([]);
            return;
          }
          
          // 等待所有邮件处理完成后返回结果
          Promise.all(messagePromises)
            .then(messages => {
              resolve(messages);
            })
            .catch(error => {
              reject(error);
            });
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
      // 获取代理配置
      const proxyConfig = await this.setupProxy();
      
      // 创建SMTP传输器配置
      const transportConfig: any = {
        host: this.config.smtpHost,
        port: this.config.smtpPort,
        secure: this.config.smtpSecure,
        auth: {
          user: this.config.user,
          pass: this.config.password
        },
        tls: {
          rejectUnauthorized: false // 允许自签名证书
        },
        debug: true // 启用调试模式
      };
      
      // 如果有代理配置，添加代理
      if (proxyConfig) {
        console.log(`SMTP连接使用代理: ${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`);
        
        try {
          // 添加代理配置
          const proxySettings = createSmtpProxyConfig(proxyConfig);
          if (proxySettings) {
            transportConfig.proxy = proxySettings.url;
          } else {
            console.warn('创建SMTP代理配置失败，将使用直连模式');
          }
        } catch (proxyError) {
          console.error('设置SMTP代理失败:', proxyError);
        }
      }
      
      // 重新创建SMTP传输器
      this.smtpTransporter = nodemailer.createTransport(transportConfig);
      
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