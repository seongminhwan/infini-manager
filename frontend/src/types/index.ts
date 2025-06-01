/**
 * 账户统计信息接口
 */
export interface IAccountStatistics {
  totalAccounts: number;       // 账户总数
  accountsWithBalance: number; // 有余额账户总数
  accountsWithRedPacket: number; // 有红包余额总数
  totalBalance: number;        // 总余额
  totalCards: number;          // 现有卡片总数
}