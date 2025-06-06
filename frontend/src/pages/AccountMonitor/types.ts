/**
 * AccountMonitor组件相关类型定义
 */

// 账户分组接口
export interface AccountGroup {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  accountCount?: number;
}

// 分组详情接口
export interface GroupDetail extends AccountGroup {
  accounts: { id: string; email: string; }[];
}

// 2FA信息接口
export interface TwoFaInfo {
  qrCodeUrl?: string;
  secretKey?: string;
  recoveryCodes?: string[];
}

// Infini账户接口
export interface InfiniAccount {
  id: number;
  userId: string;
  email: string;
  password?: string;
  uid?: string;
  invitationCode?: string;
  availableBalance: number;
  withdrawingAmount: number;
  redPacketBalance: number;
  totalConsumptionAmount: number;
  totalEarnBalance: number;
  dailyConsumption: number;
  status?: string;
  userType?: number;
  google2faIsBound: boolean | number; // 兼容数值类型（0/1）和布尔类型
  googlePasswordIsSet: boolean | number; // 兼容数值类型（0/1）和布尔类型
  isKol: boolean | number;
  isProtected: boolean | number;
  cookieExpiresAt?: string;
  infiniCreatedAt?: number;
  lastSyncAt: string;
  createdAt?: string;
  updatedAt?: string;
  mockUserId?: number; // 关联的随机用户ID
  twoFaInfo?: TwoFaInfo; // 2FA信息
  verificationLevel?: number; // KYC认证级别：0-未认证 1-基础认证 2-KYC认证
  verification_level?: number; // 兼容旧版API
  groups?: AccountGroup[]; // 所属分组
}

// 随机用户信息接口
export interface RandomUser {
  id: number;
  first_name: string;
  last_name: string;
  email_prefix: string;
  full_email: string;
  password: string;
  phone: string;
  passport_no: string;
  birth_year: number;
  birth_month: number;
  birth_day: number;
  created_at?: string;
  updated_at?: string;
}

// 批量同步结果类型
export interface BatchSyncResult {
  total: number;
  success: number;
  failed: number;
  accounts: Array<{
    id: number;
    email: string;
    success: boolean;
    message?: string;
  }>;
}

// 登录表单数据类型
export interface LoginFormData {
  email: string;
  password: string;
}

// 同步状态类型
export type SyncStage = 'idle' | 'login' | 'fetch' | 'complete' | 'error';

// KYC图片类型接口
export interface KycImage {
  id: number;
  img_base64: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

// 注册表单数据接口
export interface RegisterFormData {
  email: string;
  password: string;
  verificationCode: string;
  needKyc: boolean;
  country?: string;
  phone?: string;
  idType?: string;
  idNumber?: string;
  kycImageId?: number;
  enable2fa: boolean;
}

// 批量添加账户项
export interface BatchAddAccountItem {
  key: string;
  email: string;
  password: string;
  status?: 'success' | 'fail' | 'warning';
  errorMsg?: string;
  useCustomEmail?: boolean;
  customEmailAddress?: string;
  customEmailPassword?: string;
  customImapHost?: string;
  customImapPort?: number;
  customImapSecure?: boolean;
  customSmtpHost?: string;
  customSmtpPort?: number;
  customSmtpSecure?: boolean;
  customEmailStatus?: 'active' | 'disabled';
  customExtraConfig?: string;
}