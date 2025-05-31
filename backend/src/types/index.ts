/**
 * 核心类型定义
 */

import { Request, Response, NextFunction } from 'express';

// 扩展Express请求，可以添加自定义属性
export interface ExtendedRequest extends Request {
  // 可以扩展添加认证相关的属性
  user?: any;
}

// 通用控制器方法接口
export type ControllerMethod = (
  req: ExtendedRequest | Request,
  res: Response,
  next: NextFunction
) => Promise<void | Response<any, Record<string, any>>> | void | Response<any, Record<string, any>>;

// 标准API响应接口
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

// 账户相关接口
export interface Account {
  id: string;
  name: string;
  balance: number;
  status: AccountStatus;
  lastUpdate: string;
}

export type AccountStatus = 'active' | 'inactive' | 'warning';

// 转账相关接口
export interface Transfer {
  id: string;
  sourceAccount: string;
  targetAccount: string;
  amount: number;
  memo?: string;
  status: TransferStatus;
  timestamp: string;
}

export type TransferStatus = 'pending' | 'completed' | 'failed';

// 账户注册相关接口
export interface RegisteredAccount {
  id: string;
  accountName: string;
  initialBalance: number;
  description?: string;
  status: RegisterStatus;
  createdAt: string;
}

export type RegisterStatus = 'pending' | 'success' | 'failed';

export interface BatchRegistration {
  batchId: string;
  status: BatchStatus;
  totalAccounts: number;
  processedAccounts: number;
  successCount: number;
  failedCount: number;
}

export type BatchStatus = 'processing' | 'completed' | 'failed';

// 通知相关接口
export interface NotificationSetting {
  emailEnabled: boolean;
  emailAddress?: string;
  telegramEnabled: boolean;
  telegramChatId?: string;
  telegramBotToken?: string;
}

export interface NotificationRule {
  id: string;
  name: string;
  condition: string;
  channels: NotificationChannel[];
  status: NotificationRuleStatus;
}

export type NotificationChannel = 'email' | 'telegram';
export type NotificationRuleStatus = 'active' | 'inactive';

export interface NotificationHistory {
  id: string;
  type: string;
  content: string;
  channel: NotificationChannel;
  time: string;
  status: NotificationHistoryStatus;
}

export type NotificationHistoryStatus = 'sent' | 'failed';

// 邮箱账户相关接口
export interface EmailAccount {
  id?: number;
  name: string;
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  status: EmailAccountStatus;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
  extraConfig?: Record<string, any>;
  domainName?: string; // 邮箱域名，用于随机用户生成
}

export type EmailAccountStatus = 'active' | 'pending' | 'disabled';

export interface EmailAccountCreate extends Omit<EmailAccount, 'id' | 'status' | 'isDefault' | 'createdAt' | 'updatedAt'> {
  isDefault?: boolean;
}

export interface EmailAccountUpdate extends Partial<Omit<EmailAccount, 'id' | 'createdAt' | 'updatedAt'>> {
  id: number;
}

export interface EmailAccountTestResult {
  success: boolean;
  message: string;
  testId?: string;
  details?: {
    sendSuccess?: boolean;
    receiveSuccess?: boolean;
    sendError?: string;
    receiveError?: string;
    timeTaken?: number;
    debug?: Record<string, any>; // 添加调试信息字段，用于记录邮件发送/接收过程中的详细信息
  };
}

// Gmail工具相关接口 (基于IMAP/SMTP协议)
export interface GmailConfig {
  user: string;
  password: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;

  // 代理配置
  useProxy?: boolean;
  proxyMode?: 'direct' | 'specific' | 'tag_random'; // 代理模式：直连/指定代理/标签随机
  proxyServerId?: number; // 指定代理服务器ID
  proxyTag?: string; // 代理标签
  proxyConfig?: {
    host?: string;
    port?: number;
    type?: 'http' | 'https' | 'socks4' | 'socks5';
    auth?: {
      username?: string;
      password?: string;
    };
  };
}

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
  contentDisposition?: string;
  contentId?: string;
  size?: number;
}

export interface GmailMessage {
  messageId?: string;
  uid?: number;
  seqno?: number;
  date?: Date;
  subject?: string;
  from?: string | Array<{name?: string; address: string}>;
  to?: string | Array<{name?: string; address: string}>;
  cc?: string | Array<{name?: string; address: string}>;
  bcc?: string | Array<{name?: string; address: string}>;
  headers?: GmailHeader[];
  text?: string;
  html?: string;
  attachments?: GmailAttachment[];
  flags?: string[];
  size?: number;
  attributes?: any;
}

export interface GmailMessageSendOptions {
  from?: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
    cid?: string;
  }>;
  headers?: {[key: string]: string};
}

export interface GmailQueryOptions {
  mailbox?: string;
  limit?: number;
  since?: Date;
  before?: Date;
  searchFilter?: any[]; // 改为 any[] 以支持更复杂的 IMAP 搜索条件，如 [['UID', '1:*']]
  markSeen?: boolean;
  fetchOptions?: {
    bodies?: string | string[];
    struct?: boolean;
    envelope?: boolean;
    markSeen?: boolean;
    size?: boolean;
  };
}

// KYC图片相关接口
export interface KycImage {
  id: number;
  img_base64: string; // 图片的base64编码内容
  tags: string; // 图片标签，多个标签用逗号分隔
  created_at: string;
  updated_at: string;
}

export interface KycImageCreate {
  img_base64: string;
  tags: string;
}

export interface KycImageUpdate {
  img_base64?: string;
  tags?: string;
}

// Infini账户相关接口
export interface InfiniAccount {
  id: number;
  userId: string;      // Infini用户ID
  email: string;       // 登录邮箱
  password: string;    // 登录密码
  uid?: string;        // Infini用户UID
  invitationCode?: string;  // 邀请码
  mock_user_id?: number;  // 关联的随机用户ID
  
  // 余额信息
  availableBalance: number;
  withdrawingAmount: number;
  redPacketBalance: number;
  totalConsumptionAmount: number;
  totalEarnBalance: number;
  dailyConsumption: number;
  
  // 状态信息
  status?: string;
  userType?: number;
  google2faIsBound: boolean;
  googlePasswordIsSet: boolean;
  isKol: boolean;
  isProtected: boolean;
  
  // 认证信息
  cookie?: string;
  cookieExpiresAt?: Date;
  
  // 时间信息
  infiniCreatedAt?: number;  // Infini平台上的创建时间戳
  lastSyncAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface InfiniAccountCreate {
  email: string;
  password: string;
  mock_user_id?: number; // 关联的随机用户ID（可选）
}

export interface InfiniAccountUpdate extends Partial<Omit<InfiniAccount, 'id' | 'createdAt' | 'updatedAt'>> {
  id: number;
}

// Infini API响应接口
export interface InfiniLoginResponse {
  code: number;
  message: string;
  data: Record<string, any>;
}

export interface InfiniProfileResponse {
  code: number;
  message: string;
  data: {
    user_id: string;
    email: string;
    uid: string;
    invitation_code: string;
    available_balance: string;
    withdrawing_amount: string;
    red_packet_balance: string;
    total_consumption_amount: string;
    total_earn_balance: string;
    daily_consumption: string;
    status: string;
    user_type: number;
    google_2fa_is_bound: boolean;
    google_password_is_set: boolean;
    is_kol: boolean;
    is_protected: boolean;
    created_at: number;
    addresses?: Array<{address: string; chain: string}>;
  };
}

// 同步动作的状态
export type SyncStatus = 'pending' | 'processing' | 'success' | 'failed';

// 同步历史记录
export interface SyncHistory {
  id: number;
  accountId: number;
  status: SyncStatus;
  startTime: Date;
  endTime?: Date;
  details?: string;
  errorMessage?: string;
}

// 姓名黑名单接口
export interface NameBlacklist {
  id: number;
  name: string;  // 不允许使用的姓名
  reason?: string;  // 禁用原因
  created_at?: string;
  updated_at?: string;
}

// 随机用户信息接口
export interface RandomUser {
  id?: number;  // 可选，允许数据库自动分配
  email_prefix: string;  // 邮箱前缀
  full_email?: string;  // 完整邮箱（可选）
  password: string;  // 随机密码
  last_name: string;  // 姓
  first_name: string;  // 名
  passport_no: string;  // 护照号
  phone: string;  // 美国格式手机号
  birth_year: number;  // 出生年
  birth_month: number;  // 出生月
  birth_day: number;  // 出生日
  created_at?: string;
  updated_at?: string;
}

// 随机用户生成请求接口
export interface RandomUserGenerateRequest {
  email_suffix?: string;  // 邮箱后缀（可选）
  count?: number;  // 生成数量，默认为1
}