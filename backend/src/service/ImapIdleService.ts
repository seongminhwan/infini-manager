/**
 * IMAP IDLE长连接服务
 * 使用IMAP IDLE命令与邮件服务器建立长连接,实时获取新邮件
 */
// 导入node-imap库
import IMAP from 'node-imap';
import { EventEmitter } from 'events';
import db from '../db/db';
import EmailSyncService from './EmailSyncService';
import { createImapProxyAgent, getProxyById, getRandomProxyByTag } from '../utils/ProxyUtils';

// 动态导入GmailClient类型(避免循环引用)
let GmailClient: any = null;

/**
 * IMAP连接状态
 */
export enum IdleConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting',
  CONNECTING = 'connecting' // 添加连接中状态
}

/**
 * 邮箱IDLE连接信息
 */
interface ImapIdleConnection {
  accountId: number;
  email: string;
  imap: any; // 使用any类型避免类型错误
  status: IdleConnectionStatus;
  lastError?: string;
  reconnectAttempts: number;
  lastMailCount?: number;
  lastActivity: Date;
  idleTimeout?: NodeJS.Timeout;
}

/**
 * 连接详情接口
 */
export interface ConnectionDetail {
  accountId: number;
  email: string;
  status: IdleConnectionStatus;
  lastError?: string;
  reconnectAttempts: number;
  lastActivity: Date;
}

/**
 * 连接状态统计接口
 */
export interface ImapIdleServiceStats {
  totalConnections: number;
  connectedCount: number;
  disconnectedCount: number;
  reconnectingCount: number;
  errorCount: number;
  connections: ConnectionDetail[]; // 连接详情列表
}

/**
 * IMAP IDLE长连接服务类
 * 负责管理所有邮箱的IDLE连接
 */
class ImapIdleService extends EventEmitter {
  private connections: Map<number, ImapIdleConnection> = new Map();
  private reconnectIntervals: number[] = [5, 15, 30, 60, 120, 300]; // 重连间隔(秒)
  private maxReconnectAttempts = 10; // 最大重连次数
  private idleRefreshInterval = 25 * 60 * 1000; // IDLE刷新间隔(25分钟)
  private isInitialized = false;
  private emailSyncService: typeof EmailSyncService;

  /**
   * 构造函数
   */
  constructor() {
    super();
    this.emailSyncService = EmailSyncService;
  }

  /**
   * 初始化服务
   * 连接所有配置了IDLE的活动邮箱账户
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('IMAP IDLE服务已经初始化');
      return;
    }

    try {
      console.log('开始初始化IMAP IDLE服务...');

      // 确保导入GmailClient类型
      if (!GmailClient) {
        try {
          const module = await import('../utils/gmailClient');
          GmailClient = module.default;
        } catch (error) {
          console.error('无法加载GmailClient:', error);
          throw new Error('无法加载GmailClient: ' + (error as Error).message);
        }
      }

      // 获取所有启用了IDLE连接的活动邮箱账户
      const accounts = await db('email_accounts')
        .where({
          status: 'active',
          use_idle_connection: true
        })
        .select('*');

      console.log(`找到 ${accounts.length} 个启用了IDLE连接的活动邮箱账户`);

      // 为每个账户建立连接
      for (const account of accounts) {
        await this.connectAccount(account);
      }

      // 设置定期检查连接状态
      setInterval(() => this.checkConnections(), 5 * 60 * 1000); // 每5分钟检查一次

      this.isInitialized = true;
      console.log('IMAP IDLE服务初始化完成');
    } catch (error) {
      console.error('初始化IMAP IDLE服务失败:', error);
      throw error;
    }
  }

  /**
   * 连接邮箱账户
   * @param account 邮箱账户信息
   */
  async connectAccount(account: any): Promise<void> {
    try {
      console.log(`开始连接邮箱: ${account.email} (ID: ${account.id})`);

      // 检查是否已有连接
      if (this.connections.has(account.id)) {
        // 关闭现有连接
        await this.disconnectAccount(account.id);
      }

      // 创建IMAP配置
      const imapConfig: any = {
        user: account.email,
        password: account.password,
        host: account.imap_host,
        port: account.imap_port,
        tls: account.imap_secure,
        tlsOptions: { rejectUnauthorized: false },
        keepalive: true, // 保持连接
        debug: process.env.NODE_ENV === 'development' ? this.imapDebugLogger : undefined
      };

      // 添加代理配置
      if (account.use_proxy) {
        console.log(`邮箱 ${account.email} 使用代理模式: ${account.proxy_mode}`);
        let proxyConfig = null;

        // 根据代理模式获取代理配置
        if (account.proxy_mode === 'specific' && account.proxy_server_id) {
          proxyConfig = await getProxyById(account.proxy_server_id);
        } else if (account.proxy_mode === 'tag_random' && account.proxy_tag) {
          proxyConfig = await getRandomProxyByTag(account.proxy_tag);
        }

        // 如果有代理配置,添加代理代理
        if (proxyConfig) {
          const proxyUrl = `${proxyConfig.type}://${proxyConfig.host}:${proxyConfig.port}`;
          const authInfo = proxyConfig.auth ? 
            `(用户: ${proxyConfig.auth.username || 'anonymous'})` : '(无认证)';
          
          console.log(`[IMAP-IDLE] 连接使用代理: ${proxyUrl} ${authInfo}`);
          
          // 创建代理代理
          const agent = createImapProxyAgent(proxyConfig);
          if (agent) {
            imapConfig.tlsOptions = {
              ...imapConfig.tlsOptions,
              rejectUnauthorized: false
            };
            
            // 根据IMAP连接是否使用SSL/TLS设置不同的代理
            if (account.imap_secure) {
              imapConfig.tlsOptions.agent = agent;
            } else {
              imapConfig.socketTimeout = 60000; // 增加超时时间
              imapConfig.connTimeout = 60000;
              imapConfig.agent = agent;
            }
          } else {
            console.warn(`[IMAP-IDLE] 创建代理代理失败,将使用直连模式`);
          }
        } else {
          console.log(`[IMAP-IDLE] 未找到有效代理配置,使用直连模式`);
        }
      }

      // 创建IMAP客户端
      const imap = new IMAP(imapConfig);

      // 保存连接信息
      const connection: ImapIdleConnection = {
        accountId: account.id,
        email: account.email,
        imap: imap, // 使用any类型绕过类型检查
        status: IdleConnectionStatus.DISCONNECTED,
        reconnectAttempts: 0,
        lastActivity: new Date()
      };

      this.connections.set(account.id, connection);
      
      // 设置事件处理
      this.setupImapEvents(connection);
      
      // 连接到邮件服务器
      imap.connect();
      
      // 更新数据库状态
      await db('email_accounts')
        .where('id', account.id)
        .update({
          idle_connection_status: IdleConnectionStatus.CONNECTING,
          last_idle_connection_at: new Date(),
          idle_connection_error: null
        });
        
      console.log(`邮箱 ${account.email} IMAP连接已初始化`);
    } catch (error) {
      console.error(`连接邮箱 ${account.email} 失败:`, error);
      
      // 更新数据库错误状态
      await db('email_accounts')
        .where('id', account.id)
        .update({
          idle_connection_status: IdleConnectionStatus.ERROR,
          idle_connection_error: error instanceof Error ? error.message : String(error)
        });
        
      // 尝试稍后重连
      this.scheduleReconnect(account.id);
    }
  }

  /**
   * 断开邮箱连接
   * @param accountId 邮箱ID
   */
  async disconnectAccount(accountId: number): Promise<void> {
    const connection = this.connections.get(accountId);
    if (!connection) {
      return;
    }
    
    try {
      console.log(`断开邮箱 ${connection.email} 的IMAP连接`);
      
      // 清除IDLE超时定时器
      if (connection.idleTimeout) {
        clearTimeout(connection.idleTimeout);
      }
      
      // 结束IMAP连接
      if (connection.imap && connection.imap.state !== 'disconnected') {
        connection.imap.end();
      }
      
      // 更新连接状态
      connection.status = IdleConnectionStatus.DISCONNECTED;
      
      // 更新数据库状态
      await db('email_accounts')
        .where('id', accountId)
        .update({
          idle_connection_status: IdleConnectionStatus.DISCONNECTED
        });
        
      // 移除连接
      this.connections.delete(accountId);
      
      console.log(`邮箱 ${connection.email} 的IMAP连接已断开`);
    } catch (error) {
      console.error(`断开邮箱 ${connection.email} 的IMAP连接失败:`, error);
    }
  }

  /**
   * 设置IMAP事件处理
   * @param connection 连接信息
   */
  private setupImapEvents(connection: ImapIdleConnection): void {
    const imap = connection.imap;
    
    // 连接就绪事件
    imap.once('ready', () => {
      console.log(`邮箱 ${connection.email} IMAP连接就绪`);
      
      // 打开收件箱
      imap.openBox('INBOX', false, (err: any, box: any) => {
        if (err) {
          console.error(`打开邮箱 ${connection.email} 的收件箱失败:`, err);
          this.handleConnectionError(connection, err);
          return;
        }
        
        console.log(`邮箱 ${connection.email} 收件箱已打开,邮件数量: ${box.messages.total}`);
        
        // 保存当前邮件数量
        connection.lastMailCount = box.messages.total;
        
        // 开始IDLE模式
        this.startIdleMode(connection);
        
        // 更新连接状态
        connection.status = IdleConnectionStatus.CONNECTED;
        connection.lastActivity = new Date();
        connection.reconnectAttempts = 0;
        
        // 更新数据库状态
        db('email_accounts')
          .where('id', connection.accountId)
          .update({
            idle_connection_status: IdleConnectionStatus.CONNECTED,
            last_idle_connection_at: new Date(),
            idle_connection_error: null
          })
          .catch(err => {
            console.error(`更新邮箱 ${connection.email} 的连接状态失败:`, err);
          });
      });
    });
    
    // 邮件事件 - 收到新邮件
    imap.on('mail', async (numNewMsgs: number) => {
      const prevCount = connection.lastMailCount || 0;
      console.log(`邮箱 ${connection.email} 收到 ${numNewMsgs} 封新邮件`);
      
      // 更新最后活动时间
      connection.lastActivity = new Date();
      
      try {
        // 暂时退出IDLE模式
        if (typeof imap.idle === 'function') {
          imap.idle();
        }
        
        // 执行增量同步
        await this.processFetchNewEmails(connection);
        
        // 恢复IDLE模式
        this.startIdleMode(connection);
      } catch (error) {
        console.error(`处理邮箱 ${connection.email} 的新邮件失败:`, error);
        
        // 尝试恢复IDLE模式
        try {
          this.startIdleMode(connection);
        } catch (e) {
          this.handleConnectionError(connection, e);
        }
      }
    });
    
    // 错误事件
    imap.on('error', (err: Error) => {
      console.error(`邮箱 ${connection.email} IMAP连接发生错误:`, err);
      this.handleConnectionError(connection, err);
    });
    
    // 关闭事件
    imap.once('close', () => {
      console.log(`邮箱 ${connection.email} IMAP连接已关闭`);
      
      // 如果不是主动断开,尝试重连
      if (connection.status !== IdleConnectionStatus.DISCONNECTED) {
        connection.status = IdleConnectionStatus.DISCONNECTED;
        this.scheduleReconnect(connection.accountId);
      }
    });
    
    // 结束事件
    imap.once('end', () => {
      console.log(`邮箱 ${connection.email} IMAP连接已结束`);
      
      // 如果不是主动断开,尝试重连
      if (connection.status !== IdleConnectionStatus.DISCONNECTED) {
        connection.status = IdleConnectionStatus.DISCONNECTED;
        this.scheduleReconnect(connection.accountId);
      }
    });
  }

  /**
   * 启动IDLE模式
   * @param connection 连接信息
   */
  private startIdleMode(connection: ImapIdleConnection): void {
    try {
      // 先检查连接状态
      if (!connection.imap || 
          connection.imap.state === 'disconnected' || 
          connection.status === IdleConnectionStatus.ERROR) {
        console.log(`邮箱 ${connection.email} 连接状态异常,尝试重连而非启动IDLE`);
        this.scheduleReconnect(connection.accountId);
        return;
      }
      
      console.log(`邮箱 ${connection.email} 启动IDLE模式`);
      
      const imap = connection.imap;
      
      // 清除之前的IDLE超时
      if (connection.idleTimeout) {
        clearTimeout(connection.idleTimeout);
      }
      
      // 设置IDLE超时,IMAP规范建议20-30分钟内刷新IDLE
      // 防止某些服务器超时断开连接 (减少到15分钟,提高可靠性)
      connection.idleTimeout = setTimeout(() => {
        this.refreshIdleConnection(connection);
      }, 15 * 60 * 1000); // 15分钟
      
      // 开启IDLE模式 - 使用try-catch增强稳定性
      try {
        if (typeof imap.idle === 'function') {
          imap.idle();
        }
      } catch (idleError) {
        console.error(`邮箱 ${connection.email} 启动IDLE命令失败:`, idleError);
        // 如果IDLE命令失败,尝试使用NOOP命令保持连接活跃
        if (typeof imap.noop === 'function') {
          imap.noop();
        }
        // 缩短IDLE刷新间隔
        if (connection.idleTimeout) {
          clearTimeout(connection.idleTimeout);
        }
        connection.idleTimeout = setTimeout(() => {
          this.refreshIdleConnection(connection);
        }, 2 * 60 * 1000); // 2分钟
      }
      
      console.log(`邮箱 ${connection.email} IDLE模式已启动`);
    } catch (error) {
      console.error(`启动邮箱 ${connection.email} 的IDLE模式失败:`, error);
      this.handleConnectionError(connection, error);
    }
  }

  /**
   * 刷新IDLE连接
   * @param connection 连接信息
   */
  private refreshIdleConnection(connection: ImapIdleConnection): void {
    try {
      console.log(`刷新邮箱 ${connection.email} 的IDLE连接`);
      
      const imap = connection.imap;
      
      // 进行全面连接状态检查
      if (!imap || 
          imap.state === 'disconnected' || 
          connection.status === IdleConnectionStatus.ERROR) {
        console.log(`邮箱 ${connection.email} 连接状态异常,尝试重连而非刷新`);
        this.scheduleReconnect(connection.accountId);
        return;
      }
      
        // 捕获可能的IDLE退出错误
      try {
        // 退出IDLE模式
        if (typeof imap.idle === 'function') {
          imap.idle();
        }
      } catch (idleError) {
        console.error(`邮箱 ${connection.email} 退出IDLE模式失败:`, idleError);
        // IDLE退出失败通常表明连接已经有问题,尝试重连
        const errorMsg = idleError instanceof Error ? idleError.message : String(idleError);
        if (errorMsg.includes('ended by the other party') ||
            errorMsg.includes('EPIPE') ||
            errorMsg.includes('connection closed') ||
            errorMsg.includes('not connected')) {
          this.scheduleReconnect(connection.accountId);
          return;
        }
      }
      
      // 使用Promise和超时保护NOOP操作
      const noopPromise = new Promise<boolean>((resolve, reject) => {
        try {
          if (typeof imap.noop === 'function') {
            imap.noop((err: Error | null) => {
              if (err) {
                console.error(`邮箱 ${connection.email} NOOP命令执行失败:`, err);
                reject(err);
                return;
              }
              console.log(`邮箱 ${connection.email} NOOP命令执行成功`);
              // 更新最后活动时间
              connection.lastActivity = new Date();
              resolve(true);
            });
          } else {
            // 如果没有noop方法,直接成功
            console.log(`邮箱 ${connection.email} 没有NOOP方法,跳过执行`);
            resolve(false);
          }
        } catch (noopError) {
          reject(noopError);
        }
      });
      
      // 添加超时保护
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`邮箱 ${connection.email} NOOP命令执行超时`));
        }, 10000); // 10秒超时
      });
      
      // 竞争执行
      Promise.race([noopPromise, timeoutPromise])
        .then(() => {
          // 不管NOOP结果如何,尝试重新进入IDLE模式
          this.startIdleMode(connection);
        })
        .catch((error) => {
          console.error(`邮箱 ${connection.email} 刷新连接失败:`, error);
          this.handleConnectionError(connection, error);
        });
    } catch (error) {
      console.error(`刷新邮箱 ${connection.email} 的IDLE连接失败:`, error);
      this.handleConnectionError(connection, error);
    }
  }

  /**
   * 处理连接错误
   * @param connection 连接信息
   * @param error 错误信息
   */
  private async handleConnectionError(connection: ImapIdleConnection, error: any): Promise<void> {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`邮箱 ${connection.email} 连接错误: ${errorMsg}`);
    
    // 安全结束连接
    try {
      if (connection.imap && connection.imap.state !== 'disconnected') {
        connection.imap.end();
      }
    } catch (endError) {
      console.error(`邮箱 ${connection.email} 结束连接失败:`, endError);
      // 忽略结束错误,继续处理
    }
    
    // 更新连接状态
    connection.status = IdleConnectionStatus.ERROR;
    connection.lastError = errorMsg;
    
    // 更新数据库状态
    try {
      await db('email_accounts')
        .where('id', connection.accountId)
        .update({
          idle_connection_status: IdleConnectionStatus.ERROR,
          idle_connection_error: errorMsg
        });
    } catch (dbError) {
      console.error(`更新邮箱 ${connection.email} 的错误状态失败:`, dbError);
    }
    
    // 针对特定错误调整重连策略
    if (errorMsg.includes('ended by the other party') || 
        errorMsg.includes('EPIPE') ||
        errorMsg.includes('connection closed') ||
        errorMsg.includes('timeout')) {
      // 这些错误通常需要更长的冷却期
      console.log(`邮箱 ${connection.email} 发生网络相关错误,设置更长的重连冷却期`);
      // 使用更长的初始延迟进行重连
      this.scheduleReconnect(connection.accountId, true);
    } else {
      // 其他错误使用标准重连
      this.scheduleReconnect(connection.accountId);
    }
  }

  /**
   * 安排重连
   * @param accountId 邮箱ID
   * @param useExtendedDelay 是否使用更长的延迟(针对网络错误)
   */
  private scheduleReconnect(accountId: number, useExtendedDelay: boolean = false): void {
    const connection = this.connections.get(accountId);
    if (!connection) {
      console.warn(`无法重连邮箱ID ${accountId}: 连接不存在`);
      return;
    }
    
    // 如果已经计划重连,不再重复计划
    if (connection.status === IdleConnectionStatus.RECONNECTING) {
      return;
    }
    
    // 超过最大重连次数,停止重连
    if (connection.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`邮箱 ${connection.email} 重连失败次数过多,停止重连`);
      
      // 更新数据库状态
      db('email_accounts')
        .where('id', connection.accountId)
        .update({
          idle_connection_status: IdleConnectionStatus.ERROR,
          idle_connection_error: `重连失败次数过多(${connection.reconnectAttempts}次),停止重连`
        })
        .catch(err => {
          console.error(`更新邮箱 ${connection.email} 的状态失败:`, err);
        });
        
      return;
    }
    
    // 计算重连延迟 - 网络错误使用更长的初始延迟
    let attemptIndex = Math.min(connection.reconnectAttempts, this.reconnectIntervals.length - 1);
    // 网络错误第一次重试使用至少30秒延迟
    if (useExtendedDelay && connection.reconnectAttempts === 0) {
      attemptIndex = Math.min(2, this.reconnectIntervals.length - 1); // 使用第3个延迟值(通常为30秒)
    }
    const delaySeconds = this.reconnectIntervals[attemptIndex];
    
    console.log(`计划在 ${delaySeconds} 秒后重连邮箱 ${connection.email} (尝试 ${connection.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    // 更新状态
    connection.status = IdleConnectionStatus.RECONNECTING;
    
    // 更新数据库状态
    db('email_accounts')
      .where('id', connection.accountId)
      .update({
        idle_connection_status: IdleConnectionStatus.RECONNECTING
      })
      .catch(err => {
        console.error(`更新邮箱 ${connection.email} 的状态失败:`, err);
      });
      
    // 安排重连
    setTimeout(async () => {
      // 清理旧连接
      try {
        if (connection.imap && connection.imap.state !== 'disconnected') {
          connection.imap.end();
        }
      } catch (endError) {
        console.error(`结束邮箱 ${connection.email} 的旧连接失败:`, endError);
        // 忽略结束错误,继续重连
      }
      
      connection.reconnectAttempts++;
      
      try {
        // 获取最新账户信息
        const account = await db('email_accounts')
          .where('id', connection.accountId)
          .first();
          
        if (!account) {
          console.error(`无法重连邮箱ID ${connection.accountId}: 账户不存在`);
          this.connections.delete(connection.accountId);
          return;
        }
        
        // 检查是否仍然启用IDLE连接
        if (!account.use_idle_connection || account.status !== 'active') {
          console.log(`邮箱 ${account.email} 已禁用IDLE连接或账户不活跃,不再重连`);
          this.connections.delete(connection.accountId);
          return;
        }
        
        // 尝试重新连接前加入随机延迟,避免同时连接
        const randomDelay = Math.floor(Math.random() * 3000); // 0-3秒随机延迟
        await new Promise(resolve => setTimeout(resolve, randomDelay));
        
        // 尝试重新连接
        await this.connectAccount(account);
      } catch (error) {
        console.error(`重连邮箱 ${connection.email} 失败:`, error);
        
        // 如果重连失败,继续安排下一次重连
        this.scheduleReconnect(connection.accountId);
      }
    }, delaySeconds * 1000);
  }

  /**
   * 处理获取新邮件
   * @param connection 连接信息
   */
  private async processFetchNewEmails(connection: ImapIdleConnection): Promise<void> {
    try {
      console.log(`处理邮箱 ${connection.email} 的新邮件`);
      
      // 使用EmailSyncService执行增量同步
      await this.emailSyncService.syncEmails(
        connection.accountId,
        'incremental',
        ['INBOX']
      );
      
      console.log(`邮箱 ${connection.email} 的新邮件处理完成`);
    } catch (error) {
      console.error(`处理邮箱 ${connection.email} 的新邮件失败:`, error);
      throw error;
    }
  }

  /**
   * 定期检查所有连接状态
   */
  private async checkConnections(): Promise<void> {
    console.log(`检查 ${this.connections.size} 个IMAP IDLE连接的状态`);
    
    // 获取所有应该启用IDLE连接的账户
    const activeAccounts = await db('email_accounts')
      .where({
        status: 'active',
        use_idle_connection: true
      })
      .select('id', 'email');
      
    const activeAccountIds = new Set(activeAccounts.map(acc => acc.id));
    
    // 检查当前连接是否应该保持
    for (const [accountId, connection] of this.connections.entries()) {
      // 如果账户不再活跃或不再启用IDLE,断开连接
      if (!activeAccountIds.has(accountId)) {
        console.log(`邮箱 ${connection.email} 不再活跃或已禁用IDLE连接,断开连接`);
        await this.disconnectAccount(accountId);
        continue;
      }
      
      // 检查连接状态
      if (connection.imap.state === 'disconnected' && 
          connection.status !== IdleConnectionStatus.RECONNECTING) {
        console.log(`邮箱 ${connection.email} 连接已断开但未计划重连,安排重连`);
        this.scheduleReconnect(accountId);
      }
    }
    
    // 检查是否有需要新建连接的账户
    for (const account of activeAccounts) {
      if (!this.connections.has(account.id)) {
        console.log(`发现新的应启用IDLE连接的邮箱: ${account.email}`);
        
        // 获取完整账户信息
        const fullAccount = await db('email_accounts')
          .where('id', account.id)
          .first();
          
        if (fullAccount) {
          await this.connectAccount(fullAccount);
        }
      }
    }
  }

  /**
   * IMAP调试日志记录器
   */
  private imapDebugLogger(info: string): void {
    // 仅在开发环境输出调试信息
    if (process.env.IMAP_DEBUG === 'true') {
      console.log('[IMAP-DEBUG]', info);
    }
  }

  /**
   * 获取连接统计信息
   */
  getConnectionStats(): ImapIdleServiceStats {
    const stats: ImapIdleServiceStats = {
      totalConnections: this.connections.size,
      connectedCount: 0,
      disconnectedCount: 0,
      reconnectingCount: 0,
      errorCount: 0,
      connections: []
    };
    
    // 统计各状态连接数量
    for (const connection of this.connections.values()) {
      switch (connection.status) {
        case IdleConnectionStatus.CONNECTED:
          stats.connectedCount++;
          break;
        case IdleConnectionStatus.DISCONNECTED:
          stats.disconnectedCount++;
          break;
        case IdleConnectionStatus.RECONNECTING:
          stats.reconnectingCount++;
          break;
        case IdleConnectionStatus.ERROR:
          stats.errorCount++;
          break;
      }
      
      // 添加连接详情
      stats.connections.push({
        accountId: connection.accountId,
        email: connection.email,
        status: connection.status,
        lastError: connection.lastError,
        reconnectAttempts: connection.reconnectAttempts,
        lastActivity: connection.lastActivity
      });
    }
    
    return stats;
  }
  
  /**
   * 停止所有连接
   */
  async stopAllConnections(): Promise<void> {
    console.log(`停止所有IMAP IDLE连接(${this.connections.size}个)`);
    
    // 创建断开连接的Promise数组
    const disconnectPromises = Array.from(this.connections.keys()).map(
      accountId => this.disconnectAccount(accountId)
    );
    
    // 等待所有连接断开
    await Promise.all(disconnectPromises);
    
    console.log('所有IMAP IDLE连接已停止');
  }
  
  /**
   * 添加或更新邮箱连接
   * @param accountId 邮箱ID
   */
  static async addOrUpdateConnection(accountId: number): Promise<void> {
    // 获取服务实例
    const instance = imapIdleServiceInstance;
    
    // 获取账户信息
    const account = await db('email_accounts')
      .where('id', accountId)
      .first();
      
    if (!account) {
      throw new Error(`邮箱账户不存在: ${accountId}`);
    }
    
    // 如果不启用IDLE连接或账户不活跃,断开连接
    if (!account.use_idle_connection || account.status !== 'active') {
      console.log(`邮箱 ${account.email} 不启用IDLE连接或不活跃,断开连接`);
      await instance.disconnectAccount(accountId);
      return;
    }
    
    // 连接或重连
    await instance.connectAccount(account);
  }
  
  /**
   * 移除邮箱连接
   * @param accountId 邮箱ID
   */
  static async removeConnection(accountId: number): Promise<void> {
    const instance = imapIdleServiceInstance;
    await instance.disconnectAccount(accountId);
  }
}

// 创建单例实例
const imapIdleServiceInstance = new ImapIdleService();

// 导出单例实例和类型
export default ImapIdleService;
export { imapIdleServiceInstance };