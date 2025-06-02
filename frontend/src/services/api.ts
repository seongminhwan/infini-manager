/**
 * API服务配置
 * 配置axios拦截器，处理API请求和响应，统一错误处理
 * 
 * 统一的axios实例，所有API请求都应使用此实例，确保错误处理一致性
 * 拦截所有非200状态码响应，通过message组件显示错误信息
 */
import axios, { AxiosResponse, AxiosError, AxiosRequestConfig, AxiosInstance } from 'axios';
import { message } from 'antd';
import { showGlobalError } from '../context/ErrorContext';
// 从配置文件导入API基础URL
import { API_BASE_URL } from '../config';

// 创建axios实例
const api: AxiosInstance = axios.create({
  timeout: 600000, // 默认60秒超时时间，长时间运行的请求可在调用时覆盖
  headers: {
    'Content-Type': 'application/json',
  },
});

// 使用配置文件中定义的API基础URL
const apiBaseUrl = API_BASE_URL;
console.log(`API路径模式: 使用配置文件设置 - ${apiBaseUrl || '相对路径'}`);

/**
 * 配置API服务
 * 所有API定义都应使用api实例，而非直接使用axios
 */
export const configApi = {
  // 获取所有配置
  getAllConfigs: async () => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/configs`);
      return response.data;
    } catch (error) {
      console.error('获取所有配置失败:', error);
      throw error;
    }
  },
  
  // 获取单个配置
  getConfigByKey: async (key: string) => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/configs/${key}`);
      return response.data;
    } catch (error) {
      console.error(`获取配置[${key}]失败:`, error);
      throw error;
    }
  },
  
  // 创建或更新配置
  upsertConfig: async (key: string, value: any, description?: string) => {
    try {
      const response = await api.post(`${apiBaseUrl}/api/configs`, {
        key,
        value,
        description
      });
      return response.data;
    } catch (error) {
      console.error(`保存配置[${key}]失败:`, error);
      throw error;
    }
  },
  
  // 删除配置
  deleteConfig: async (key: string) => {
    try {
      const response = await api.delete(`${apiBaseUrl}/api/configs/${key}`);
      return response.data;
    } catch (error) {
      console.error(`删除配置[${key}]失败:`, error);
      throw error;
    }
  }
};

/**
 * 转账API
 * 处理所有与转账相关的API请求
 */
export const transferApi = {
  // 执行内部转账 - 支持所有转账场景，包括2FA验证
  executeInternalTransfer: async (
    accountId: string,
    contactType: 'uid' | 'email' | 'inner',
    targetIdentifier: string,
    amount: string,
    source: string,
    isForced: boolean = false,
    remarks?: string,
    auto2FA: boolean = false,
    verificationCode?: string
  ) => {
    try {
      console.log(`执行内部转账，源账户ID: ${accountId}, 目标: ${contactType}:${targetIdentifier}, 金额: ${amount}, 自动2FA: ${auto2FA}, 验证码: ${verificationCode ? '已提供' : '未提供'}`);
      const response = await api.post(`${apiBaseUrl}/api/transfers/internal`, {
        accountId,
        contactType,
        targetIdentifier,
        amount,       // 使用字符串格式传递金额
        source,
        isForced,
        remarks,
        auto2FA,      // 是否自动处理2FA验证
        verificationCode // 手动提供的2FA验证码（如果有）
      });
      return response.data;
    } catch (error) {
      console.error('执行内部转账失败:', error);
      throw error;
    }
  },
  
  // 领取红包
  grabRedPacket: async (accountId: string, code: string) => {
    try {
      console.log(`领取红包，账户ID: ${accountId}, 红包码: ${code}`);
      const response = await api.post(`${apiBaseUrl}/api/transfers/red-packet`, {
        accountId,
        code
      });
      return response.data;
    } catch (error) {
      console.error('领取红包失败:', error);
      throw error;
    }
  },
  
  // 批量领取红包 - 为多个账户领取同一个红包码
  batchGrabRedPacket: async (accountIds: string[], code: string, onProgress?: (current: number, total: number, result: any) => void) => {
    try {
      console.log(`批量领取红包，账户数量: ${accountIds.length}, 红包码: ${code}`);
      const results = [];
      let successCount = 0;
      let failedCount = 0;
      let totalAmount = 0;
      
      // 逐个账户领取红包
      for (let i = 0; i < accountIds.length; i++) {
        const accountId = accountIds[i];
        try {
          const response = await api.post(`${apiBaseUrl}/api/transfers/red-packet`, {
            accountId,
            code
          });
          
          const result = {
            accountId,
            success: response.data.success,
            amount: response.data.data?.amount || '0',
            message: response.data.message
          };
          
          results.push(result);
          
          if (response.data.success) {
            successCount++;
            // 累加领取到的金额
            totalAmount += parseFloat(response.data.data?.amount || '0');
          } else {
            failedCount++;
          }
          
          // 回调进度函数
          if (onProgress) {
            onProgress(i + 1, accountIds.length, result);
          }
        } catch (error: any) {
          const result = {
            accountId,
            success: false,
            amount: '0',
            message: error.message || '领取失败'
          };
          
          results.push(result);
          failedCount++;
          
          // 回调进度函数
          if (onProgress) {
            onProgress(i + 1, accountIds.length, result);
          }
        }
      }
      
      return {
        success: true,
        data: {
          results,
          summary: {
            total: accountIds.length,
            success: successCount,
            failed: failedCount,
            totalAmount: totalAmount.toFixed(6)
          }
        },
        message: `批量领取红包完成: 总计${accountIds.length}个账户, 成功${successCount}个, 失败${failedCount}个, 总金额: ${totalAmount.toFixed(6)}`
      };
    } catch (error) {
      console.error('批量领取红包失败:', error);
      throw error;
    }
  },
  
  // 获取转账记录列表
  getTransfers: async (accountId?: string, status?: string, page: number = 1, pageSize: number = 20) => {
    try {
      console.log(`获取转账记录列表，账户ID: ${accountId || '全部'}, 状态: ${status || '全部'}, 页码: ${page}`);
      const response = await api.get(`${apiBaseUrl}/api/transfers`, {
        params: {
          accountId,
          status,
          page,
          pageSize
        }
      });
      return response.data;
    } catch (error) {
      console.error('获取转账记录列表失败:', error);
      throw error;
    }
  },
  
  // 获取转账记录详情
  getTransferById: async (id: string) => {
    try {
      console.log(`获取转账记录详情，转账ID: ${id}`);
      const response = await api.get(`${apiBaseUrl}/api/transfers/${id}`);
      return response.data;
    } catch (error) {
      console.error('获取转账记录详情失败:', error);
      throw error;
    }
  },
  
  // 获取转账历史记录
  getTransferHistory: async (id: string) => {
    try {
      console.log(`获取转账历史记录，转账ID: ${id}`);
      const response = await api.get(`${apiBaseUrl}/api/transfers/${id}/history`);
      return response.data;
    } catch (error) {
      console.error('获取转账历史记录失败:', error);
      throw error;
    }
  }
};

/**
 * 批量转账API
 * 处理所有与批量转账相关的API请求
 */
export const batchTransferApi = {
  // 创建批量转账任务
  createBatchTransfer: async (data: {
    name: string;
    type: 'one_to_many' | 'many_to_one';
    sourceAccountId?: string | number;
    targetAccountId?: string | number;
    relations: Array<{
      sourceAccountId?: string | number;
      targetAccountId?: string | number;
      contactType?: 'uid' | 'email' | 'inner';
      targetIdentifier?: string;
      amount: string;
    }>;
    remarks?: string;
  }) => {
    try {
      console.log('创建批量转账任务:', data);
      const response = await api.post(`${apiBaseUrl}/api/batch-transfers`, data);
      return response.data;
    } catch (error) {
      console.error('创建批量转账任务失败:', error);
      throw error;
    }
  },
  
  // 获取批量转账列表
  getBatchTransfers: async (params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    type?: string;
  }) => {
    try {
      console.log('获取批量转账列表:', params);
      const response = await api.get(`${apiBaseUrl}/api/batch-transfers`, { params });
      return response.data;
    } catch (error) {
      console.error('获取批量转账列表失败:', error);
      throw error;
    }
  },
  
  // 获取批量转账详情
  getBatchTransferById: async (id: string) => {
    try {
      console.log(`获取批量转账详情, ID: ${id}`);
      const response = await api.get(`${apiBaseUrl}/api/batch-transfers/${id}`);
      return response.data;
    } catch (error) {
      console.error('获取批量转账详情失败:', error);
      throw error;
    }
  },
  
  // 获取批量转账关系列表
  getBatchTransferRelations: async (id: string, params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    keyword?: string;
  }) => {
    try {
      console.log(`获取批量转账关系列表, ID: ${id}`, params);
      const response = await api.get(`${apiBaseUrl}/api/batch-transfers/${id}/relations`, { params });
      return response.data;
    } catch (error) {
      console.error('获取批量转账关系列表失败:', error);
      throw error;
    }
  },
  
  // 执行批量转账
  executeBatchTransfer: async (id: string, auto2FA: boolean = false) => {
    try {
      console.log(`执行批量转账, ID: ${id}, 自动2FA: ${auto2FA}`);
      const response = await api.post(`${apiBaseUrl}/api/batch-transfers/${id}/execute`, { auto2FA });
      return response.data;
    } catch (error) {
      console.error('执行批量转账失败:', error);
      throw error;
    }
  },
  
  // 获取批量转账历史记录
  getBatchTransferHistory: async (id: string) => {
    try {
      console.log(`获取批量转账历史记录, ID: ${id}`);
      const response = await api.get(`${apiBaseUrl}/api/batch-transfers/${id}/history`);
      return response.data;
    } catch (error) {
      console.error('获取批量转账历史记录失败:', error);
      throw error;
    }
  },
  
  // 获取批量转账进度
  getBatchTransferProgress: async (id: string) => {
    try {
      console.log(`获取批量转账进度, ID: ${id}`);
      const response = await api.get(`${apiBaseUrl}/api/batch-transfers/${id}/progress`);
      return response.data;
    } catch (error) {
      console.error('获取批量转账进度失败:', error);
      throw error;
    }
  },
  
  // 获取失败的转账关系列表
  getFailedTransfers: async (id: string) => {
    try {
      console.log(`获取失败的转账关系列表, 批量转账ID: ${id}`);
      const response = await api.get(`${apiBaseUrl}/api/batch-transfers/${id}/failed`);
      return response.data;
    } catch (error) {
      console.error('获取失败的转账关系列表失败:', error);
      throw error;
    }
  },
  
  // 批量重试失败的转账
  retryFailedTransfers: async (id: string, auto2FA: boolean = false) => {
    try {
      console.log(`批量重试失败的转账, 批量转账ID: ${id}, 自动2FA: ${auto2FA}`);
      const response = await api.post(`${apiBaseUrl}/api/batch-transfers/${id}/retry-failed`, { auto2FA });
      return response.data;
    } catch (error) {
      console.error('批量重试失败的转账失败:', error);
      throw error;
    }
  },
  
  // 恢复未完成的批量转账
  resumeBatchTransfer: async (id: string, auto2FA: boolean = false) => {
    try {
      console.log(`恢复未完成的批量转账, ID: ${id}, 自动2FA: ${auto2FA}`);
      const response = await api.post(`${apiBaseUrl}/api/batch-transfers/${id}/resume`, { auto2FA });
      return response.data;
    } catch (error) {
      console.error('恢复未完成的批量转账失败:', error);
      throw error;
    }
  },
  
  // 重试单个失败的转账
  retryTransferRelation: async (batchId: string, relationId: string, auto2FA: boolean = false) => {
    try {
      console.log(`重试单个失败的转账, 批量转账ID: ${batchId}, 关系ID: ${relationId}, 自动2FA: ${auto2FA}`);
      const response = await api.post(`${apiBaseUrl}/api/batch-transfers/${batchId}/relations/${relationId}/retry`, { auto2FA });
      return response.data;
    } catch (error) {
      console.error('重试单个失败的转账失败:', error);
      throw error;
    }
  },
  
  // 手动关闭批量转账任务
  closeBatchTransfer: async (id: string, reason?: string) => {
    try {
      console.log(`手动关闭批量转账任务, ID: ${id}, 原因: ${reason || '无'}`);
      const response = await api.post(`${apiBaseUrl}/api/batch-transfers/${id}/close`, { reason });
      return response.data;
    } catch (error) {
      console.error('手动关闭批量转账任务失败:', error);
      throw error;
    }
  }
};

/**
 * Infini账户API
 * 使用统一的api实例处理所有请求
 */
export const infiniAccountApi = {
  // 发送验证码
  // type=0: 注册验证码(默认), type=6: 2FA验证码
  sendVerificationCode: async (email: string, type: number = 0) => {
    try {
      console.log(`发送验证码，类型: ${type}, 邮箱: ${email}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/verify`, { email, type });
      return response.data;
    } catch (error) {
      console.error('发送验证码失败:', error);
      throw error;
    }
  },
  
  // 获取验证码
  fetchVerificationCode: async (email: string, mainEmail?: string, retryCount: number = 10, intervalSeconds: number = 5) => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/infini-accounts/verify-code`, { 
        params: { 
          email,
          main_email: mainEmail, // 主邮箱参数
          retry_count: retryCount, // 重试次数，默认10次
          interval_seconds: intervalSeconds // 重试间隔时间，默认5秒
        } 
      });
      return response.data;
    } catch (error) {
      console.error('获取验证码失败:', error);
      throw error;
    }
  },
  
  // 创建账户
  createAccount: async (email: string, password: string, mock_user_id?: number) => {
    try {
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts`, { email, password, mock_user_id });
      return response.data;
    } catch (error) {
      console.error('创建账户失败:', error);
      throw error;
    }
  },
  
  // 同步账户信息
  syncAccount: async (id: string) => {
    try {
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/${id}/sync`);
      return response.data;
    } catch (error) {
      console.error('同步账户信息失败:', error);
      throw error;
    }
  },
  
  // 获取2FA QR码
  getGoogle2faQrCode: async (accountId: string) => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/infini-accounts/2fa/qrcode`, { 
        params: { accountId } 
      });
      return response.data;
    } catch (error) {
      console.error('获取2FA QR码失败:', error);
      throw error;
    }
  },
  
  // 重置密码
  resetPassword: async (email: string, verificationCode: string, newPassword?: string) => { // 添加 newPassword 参数
    try {
      console.log(`重置密码，邮箱: ${email}, 新密码: ${newPassword ? '[PROTECTED]' : '[NOT PROVIDED]'}`);
      const requestBody: any = {
        email,
        verificationCode
      };
      if (newPassword) {
        requestBody.newPassword = newPassword; // 如果提供了新密码，则添加到请求体
      }
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/reset-password`, requestBody);
      return response.data;
    } catch (error: any) {
      console.error('重置密码失败:', error);
      
      // 从错误响应中提取有用的信息
      if (error.response && error.response.data) {
        // 返回API错误响应，保持API返回的格式
        return error.response.data;
      }
      
      // 如果没有response或data，则构造一个标准错误响应
      return {
        success: false,
        message: error.message || '重置密码失败，请重试'
      };
    }
  },
  
  // 解绑2FA
  unbindGoogle2fa: async (accountId: string, google2faToken: string, password: string) => {
    try {
      console.log(`解绑2FA，账户ID: ${accountId}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/unbind-2fa`, {
        accountId,
        google2faToken,
        password
      });
      return response.data;
    } catch (error) {
      console.error('解绑2FA失败:', error);
      throw error;
    }
  },
  
  // 恢复账户
  recoverAccount: async (email: string) => {
    try {
      console.log(`恢复账户，邮箱: ${email}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/recover`, {
        email
      });
      return response.data;
    } catch (error) {
      console.error('恢复账户失败:', error);
      throw error;
    }
  },
  
  // 批量恢复账户
  batchRecoverAccounts: async (emails: string[]) => {
    try {
      console.log(`批量恢复账户，数量: ${emails.length}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/batch-recover`, {
        emails
      });
      return response.data;
    } catch (error) {
      console.error('批量恢复账户失败:', error);
      throw error;
    }
  },
  
  // 发送2FA验证邮件
  sendGoogle2faVerificationEmail: async (email: string, accountId: string) => {
    try {
      console.log(`发送2FA验证邮件，邮箱: ${email}, 账户ID: ${accountId}, 类型: 6`);
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/2fa/verify-email`, { 
        email, 
        accountId,
        type: 6 // 明确指定type=6为2FA验证码
      });
      return response.data;
    } catch (error) {
      console.error('发送2FA验证邮件失败:', error);
      throw error;
    }
  },
  
  // 绑定Google 2FA
  bindGoogle2fa: async (verification_code: string, google_2fa_code: string, accountId: string, recoveryCodes?: string[]) => {
    try {
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/2fa/bind`, 
        { verification_code, google_2fa_code, accountId, recoveryCodes }
      );
      return response.data;
    } catch (error) {
      console.error('绑定Google 2FA失败:', error);
      throw error;
    }
  },
  
  // 上传KYC图片到Infini系统
  uploadKycImage: async (accountId: string, file: File) => {
    try {
      console.log(`上传KYC图片，账户ID: ${accountId}, 文件名: ${file.name}`);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('accountId', accountId);
      
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/kyc/upload`, 
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('上传KYC图片失败:', error);
      throw error;
    }
  },
  
  // 提交护照KYC验证
  submitPassportKyc: async (
    accountId: string, 
    data: {
      phoneNumber: string,
      phoneCode: string,
      firstName: string,
      lastName: string,
      country: string,
      passportNumber: string,
      fileName: string
    }
  ) => {
    try {
      console.log(`提交护照KYC验证，账户ID: ${accountId}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/kyc/passport`, {
        accountId,
        ...data
      });
      return response.data;
    } catch (error) {
      console.error('提交护照KYC验证失败:', error);
      throw error;
    }
  },
  
  // 获取KYC信息
  getKycInformation: async (accountId: string) => {
    try {
      console.log(`获取KYC信息，账户ID: ${accountId}`);
      const response = await api.get(`${apiBaseUrl}/api/infini-accounts/kyc/information/${accountId}`);
      return response.data;
    } catch (error) {
      console.error('获取KYC信息失败:', error);
      throw error;
    }
  },
  
  // 获取基本信息
  getBasicInformation: async (accountId: string) => {
    try {
      console.log(`获取基本信息，账户ID: ${accountId}`);
      const response = await api.get(`${apiBaseUrl}/api/infini-accounts/kyc/basic/information/${accountId}`);
      return response.data;
    } catch (error) {
      console.error('获取基本信息失败:', error);
      throw error;
    }
  },
  
  // 更新2FA信息
  update2faInfo: async (accountId: string, data: { qr_code_url?: string, secret_key?: string, recovery_codes?: string[] }) => {
    try {
      console.log(`更新2FA信息，账户ID: ${accountId}`);
      const response = await api.put(`${apiBaseUrl}/api/infini-accounts/2fa/info/${accountId}`, data);
      return response.data;
    } catch (error) {
      console.error('更新2FA信息失败:', error);
      throw error;
    }
  },
  
  // 获取自定义邮箱配置
  getCustomEmailConfig: async (accountId: number | string) => {
    try {
      console.log(`获取自定义邮箱配置，账户ID: ${accountId}`);
      const response = await api.get(`${apiBaseUrl}/api/infini-accounts/${accountId}/custom-email-config`);
      return response.data;
    } catch (error) {
      console.error('获取自定义邮箱配置失败:', error);
      throw error;
    }
  },
  
  // 创建自定义邮箱配置
  createCustomEmailConfig: async (accountId: number | string, data: any) => {
    try {
      console.log(`创建自定义邮箱配置，账户ID: ${accountId}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/${accountId}/custom-email-config`, data);
      return response.data;
    } catch (error) {
      console.error('创建自定义邮箱配置失败:', error);
      throw error;
    }
  },
  
  // 更新自定义邮箱配置
  updateCustomEmailConfig: async (accountId: number | string, data: any) => {
    try {
      console.log(`更新自定义邮箱配置，账户ID: ${accountId}`);
      const response = await api.put(`${apiBaseUrl}/api/infini-accounts/${accountId}/custom-email-config`, data);
      return response.data;
    } catch (error) {
      console.error('更新自定义邮箱配置失败:', error);
      throw error;
    }
  },
  
  // 删除自定义邮箱配置
  deleteCustomEmailConfig: async (accountId: number | string) => {
    try {
      console.log(`删除自定义邮箱配置，账户ID: ${accountId}`);
      const response = await api.delete(`${apiBaseUrl}/api/infini-accounts/${accountId}/custom-email-config`);
      return response.data;
    } catch (error) {
      console.error('删除自定义邮箱配置失败:', error);
      throw error;
    }
  },
  
  // 一键式账户设置
  oneClickAccountSetup: async (setupOptions: {
    enable2fa: boolean;
    enableKyc: boolean;
    enableCard: boolean;
    cardType?: number;
  }, userData: {
    email_suffix: string;
  }) => {
    try {
      console.log(`执行一键式账户设置，配置选项:`, setupOptions, userData);
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/one-click-setup`, {
        setupOptions,
        userData
      });
      return response.data;
    } catch (error) {
      console.error('一键式账户设置失败:', error);
      throw error;
    }
  },
  
  // 获取所有账户分组
  getAllAccountGroups: async () => {
    try {
      console.log('获取所有账户分组');
      const response = await api.get(`${apiBaseUrl}/api/infini-accounts/groups`);
      return response.data;
    } catch (error) {
      console.error('获取账户分组列表失败:', error);
      throw error;
    }
  },
  
  // 获取单个账户分组详情
  getAccountGroupById: async (id: string) => {
    try {
      console.log(`获取账户分组详情，分组ID: ${id}`);
      const response = await api.get(`${apiBaseUrl}/api/infini-accounts/groups/${id}`);
      return response.data;
    } catch (error) {
      console.error('获取账户分组详情失败:', error);
      throw error;
    }
  },
  
  // 创建账户分组
  createAccountGroup: async (data: { name: string, description?: string }) => {
    try {
      console.log(`创建账户分组，名称: ${data.name}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/groups`, data);
      return response.data;
    } catch (error) {
      console.error('创建账户分组失败:', error);
      throw error;
    }
  },
  
  // 更新账户分组
  updateAccountGroup: async (id: string, data: { name?: string, description?: string }) => {
    try {
      console.log(`更新账户分组，分组ID: ${id}`);
      const response = await api.put(`${apiBaseUrl}/api/infini-accounts/groups/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('更新账户分组失败:', error);
      throw error;
    }
  },
  
  // 删除账户分组
  deleteAccountGroup: async (id: string) => {
    try {
      console.log(`删除账户分组，分组ID: ${id}`);
      const response = await api.delete(`${apiBaseUrl}/api/infini-accounts/groups/${id}`);
      return response.data;
    } catch (error) {
      console.error('删除账户分组失败:', error);
      throw error;
    }
  },
  
  // 添加账户到分组
  addAccountToGroup: async (groupId: string, accountId: string) => {
    try {
      console.log(`添加账户到分组，分组ID: ${groupId}, 账户ID: ${accountId}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/groups/account/add`, { 
        groupId, 
        accountId 
      });
      return response.data;
    } catch (error) {
      console.error('添加账户到分组失败:', error);
      throw error;
    }
  },
  
  // 批量添加账户到分组
  addAccountsToGroup: async (groupId: string, accountIds: string[]) => {
    try {
      console.log(`批量添加账户到分组，分组ID: ${groupId}, 账户数量: ${accountIds.length}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/groups/accounts/add`, { 
        groupId, 
        accountIds 
      });
      return response.data;
    } catch (error) {
      console.error('批量添加账户到分组失败:', error);
      throw error;
    }
  },
  
  // 从分组中移除账户
  removeAccountFromGroup: async (groupId: string, accountId: string) => {
    try {
      console.log(`从分组中移除账户，分组ID: ${groupId}, 账户ID: ${accountId}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/groups/account/remove`, { 
        groupId, 
        accountId 
      });
      return response.data;
    } catch (error) {
      console.error('从分组中移除账户失败:', error);
      throw error;
    }
  },
  
  // 批量从分组中移除账户
  removeAccountsFromGroup: async (groupId: string, accountIds: string[]) => {
    try {
      console.log(`批量从分组中移除账户，分组ID: ${groupId}, 账户数量: ${accountIds.length}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/groups/accounts/remove`, { 
        groupId, 
        accountIds 
      });
      return response.data;
    } catch (error) {
      console.error('批量从分组中移除账户失败:', error);
      throw error;
    }
  },
  
  // 获取所有Infini账户
  getAllInfiniAccounts: async () => {
    try {
      console.log('获取所有Infini账户');
      const response = await api.get(`${apiBaseUrl}/api/infini-accounts`);
      return response.data;
    } catch (error) {
      console.error('获取所有Infini账户失败:', error);
      throw error;
    }
  },
  
  // 获取分页的Infini账户列表（支持筛选和排序，包含卡片数量）
  getPaginatedInfiniAccounts: async (
    page: number = 1,
    pageSize: number = 10,
    filters: Record<string, any> = {},
    sortField?: string,
    sortOrder?: 'asc' | 'desc',
    groupId?: string
  ) => {
    try {
      console.log(`获取分页Infini账户，页码: ${page}, 每页记录数: ${pageSize}`);
      
      const params: Record<string, any> = { page, pageSize };
      
      // 添加过滤器参数
      if (Object.keys(filters).length > 0) {
        params.filters = JSON.stringify(filters);
      }
      
      // 添加排序参数
      if (sortField) {
        params.sortField = sortField;
        params.sortOrder = sortOrder || 'asc';
      }
      
      // 添加分组ID参数
      if (groupId) {
        params.groupId = groupId;
      }
      
      const response = await api.get(`${apiBaseUrl}/api/infini-accounts/paginated`, { params });
      return response.data;
    } catch (error) {
      console.error('获取分页Infini账户列表失败:', error);
      throw error;
    }
  },
  
  // 获取账户统计信息
  getAccountStatistics: async () => {
    try {
      console.log('获取账户统计信息');
      const response = await api.get(`${apiBaseUrl}/api/infini-accounts/statistics`);
      return response.data;
    } catch (error) {
      console.error('获取账户统计信息失败:', error);
      throw error;
    }
  }
};

/**
 * 邮箱账户API
 * 处理与邮箱账户相关的API请求
 */
export const emailAccountApi = {
  // 获取所有邮箱账户
  getAllEmailAccounts: async () => {
    try {
      console.log('获取所有邮箱账户');
      const response = await api.get(`${apiBaseUrl}/api/email-accounts`);
      return response.data;
    } catch (error) {
      console.error('获取所有邮箱账户失败:', error);
      throw error;
    }
  },
  
  // 获取单个邮箱账户
  getEmailAccountById: async (id: string) => {
    try {
      console.log(`获取邮箱账户详情，账户ID: ${id}`);
      const response = await api.get(`${apiBaseUrl}/api/email-accounts/${id}`);
      return response.data;
    } catch (error) {
      console.error('获取邮箱账户失败:', error);
      throw error;
    }
  },
  
  // 创建邮箱账户
  createEmailAccount: async (data: any) => {
    try {
      console.log(`创建邮箱账户: ${data.email}`);
      const response = await api.post(`${apiBaseUrl}/api/email-accounts`, data);
      return response.data;
    } catch (error) {
      console.error('创建邮箱账户失败:', error);
      throw error;
    }
  },
  
  // 更新邮箱账户
  updateEmailAccount: async (id: string, data: any) => {
    try {
      console.log(`更新邮箱账户: ${id}`);
      const response = await api.put(`${apiBaseUrl}/api/email-accounts/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('更新邮箱账户失败:', error);
      throw error;
    }
  },
  
  // 删除邮箱账户
  deleteEmailAccount: async (id: string) => {
    try {
      console.log(`删除邮箱账户: ${id}`);
      const response = await api.delete(`${apiBaseUrl}/api/email-accounts/${id}`);
      return response.data;
    } catch (error) {
      console.error('删除邮箱账户失败:', error);
      throw error;
    }
  },
  
  // 测试邮箱账户
  testEmailAccount: async (id: string) => {
    try {
      console.log(`测试邮箱账户: ${id}`);
      const response = await api.post(`${apiBaseUrl}/api/email-accounts/${id}/test`);
      return response.data;
    } catch (error) {
      console.error('测试邮箱账户失败:', error);
      throw error;
    }
  },
  
  // 获取测试结果
  getTestResult: async (testId: string) => {
    try {
      console.log(`获取邮箱测试结果: ${testId}`);
      const response = await api.get(`${apiBaseUrl}/api/email-accounts/test/${testId}`);
      return response.data;
    } catch (error) {
      console.error('获取邮箱测试结果失败:', error);
      throw error;
    }
  }
};

/**
 * 随机用户信息生成API
 */
export const randomUserApi = {
  // 生成随机用户信息
  generateRandomUsers: async (params: { email_suffix?: string, count?: number }) => {
    try {
      const response = await api.post(`${apiBaseUrl}/api/random-users`, params);
      return response.data;
    } catch (error) {
      console.error('生成随机用户信息失败:', error);
      throw error;
    }
  },
  
  // 获取随机用户列表
  getRandomUsers: async () => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/random-users`);
      return response.data;
    } catch (error) {
      console.error('获取随机用户列表失败:', error);
      throw error;
    }
  },
  
  // 获取单个随机用户
  getRandomUserById: async (id: string) => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/random-users/${id}`);
      return response.data;
    } catch (error) {
      console.error('获取随机用户信息失败:', error);
      throw error;
    }
  },
  
  // 删除随机用户
  deleteRandomUser: async (id: string) => {
    try {
      const response = await api.delete(`${apiBaseUrl}/api/random-users/${id}`);
      return response.data;
    } catch (error) {
      console.error('删除随机用户信息失败:', error);
      throw error;
    }
  },
  
  // 获取姓名黑名单列表
  getNameBlacklist: async () => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/random-users/blacklist`);
      return response.data;
    } catch (error) {
      console.error('获取姓名黑名单列表失败:', error);
      throw error;
    }
  },
  
  // 添加姓名到黑名单
  addNameToBlacklist: async (name: string, reason?: string) => {
    try {
      const response = await api.post(`${apiBaseUrl}/api/random-users/blacklist`, { name, reason });
      return response.data;
    } catch (error) {
      console.error('添加姓名到黑名单失败:', error);
      throw error;
    }
  },
  
  // 从黑名单中删除姓名
  removeNameFromBlacklist: async (id: string) => {
    try {
      const response = await api.delete(`${apiBaseUrl}/api/random-users/blacklist/${id}`);
      return response.data;
    } catch (error) {
      console.error('从黑名单中删除姓名失败:', error);
      throw error;
    }
  }
};

/**
 * TOTP工具API
 */
export const totpToolApi = {
  // 生成TOTP验证码
  generateTotpCode: async (input: string) => {
    try {
      const response = await api.post(`${apiBaseUrl}/api/totp-tools/generate`, { input });
      return response.data;
    } catch (error) {
      console.error('生成TOTP验证码失败:', error);
      throw error;
    }
  },
  
  // 生成TOTP二维码（本地生成，不使用外部API，避免密钥泄露）
  generateQrCode: async (input: string, size: number = 200) => {
    try {
      const response = await api.post(`${apiBaseUrl}/api/totp-tools/qrcode`, { 
        input,
        size
      });
      return response.data;
    } catch (error) {
      console.error('生成TOTP二维码失败:', error);
      throw error;
    }
  }
};

/**
 * AFF返现API
 * 处理与AFF返现相关的API请求
 */
export const affApi = {
  // 获取AFF返现批次列表
  getAffCashbacks: async (page: number = 1, pageSize: number = 10) => {
    try {
      console.log(`获取AFF返现批次列表，页码: ${page}, 每页数量: ${pageSize}`);
      const response = await api.get(`${apiBaseUrl}/api/aff/cashbacks`, {
        params: { page, pageSize }
      });
      return response.data;
    } catch (error) {
      console.error('获取AFF返现批次列表失败:', error);
      throw error;
    }
  },
  
  // 获取AFF返现批次详情
  getAffCashbackById: async (id: string) => {
    try {
      console.log(`获取AFF返现批次详情，批次ID: ${id}`);
      const response = await api.get(`${apiBaseUrl}/api/aff/cashbacks/${id}`);
      return response.data;
    } catch (error) {
      console.error('获取AFF返现批次详情失败:', error);
      throw error;
    }
  },
  
  // 创建AFF返现批次
  createAffCashback: async () => {
    try {
      console.log('创建AFF返现批次');
      const response = await api.post(`${apiBaseUrl}/api/aff/cashbacks`);
      return response.data;
    } catch (error) {
      console.error('创建AFF返现批次失败:', error);
      throw error;
    }
  },
  
  // 解析AFF数据
  parseAffData: async (batchId: string, data: string, isFile: boolean = false) => {
    try {
      console.log(`解析AFF数据，批次ID: ${batchId}, 是否文件: ${isFile}`);
      const response = await api.post(`${apiBaseUrl}/api/aff/cashbacks/${batchId}/parse`, {
        data,
        isFile
      });
      return response.data;
    } catch (error) {
      console.error('解析AFF数据失败:', error);
      throw error;
    }
  },
  
  // 更新关联记录状态（合格或忽略）
  updateRelationStatus: async (relationId: string, status: 'qualified' | 'ignored') => {
    try {
      console.log(`更新关联记录状态，关联ID: ${relationId}, 状态: ${status}`);
      const response = await api.put(`${apiBaseUrl}/api/aff/relations/${relationId}/status`, {
        status
      });
      return response.data;
    } catch (error) {
      console.error('更新关联记录状态失败:', error);
      throw error;
    }
  },
  
  // 更新AFF返现金额
  updateAffAmount: async (relationId: string, amount: number) => {
    try {
      console.log(`更新AFF返现金额，关联ID: ${relationId}, 金额: ${amount}`);
      const response = await api.put(`${apiBaseUrl}/api/aff/relations/${relationId}/amount`, {
        amount
      });
      return response.data;
    } catch (error) {
      console.error('更新AFF返现金额失败:', error);
      throw error;
    }
  },
  
  // 更新所有待处理记录的返现金额
  updateAllPendingAmount: async (batchId: string, amount: number) => {
    try {
      console.log(`更新所有待处理记录的返现金额，批次ID: ${batchId}, 金额: ${amount}`);
      const response = await api.put(`${apiBaseUrl}/api/aff/cashbacks/${batchId}/amount`, {
        amount
      });
      return response.data;
    } catch (error) {
      console.error('更新所有待处理记录的返现金额失败:', error);
      throw error;
    }
  },
  
  // 获取AFF返现批次关联的用户列表
  getAffCashbackRelations: async (batchId: string) => {
    try {
      console.log(`获取AFF返现批次关联的用户列表，批次ID: ${batchId}`);
      const response = await api.get(`${apiBaseUrl}/api/aff/cashbacks/${batchId}/relations`);
      return response.data;
    } catch (error) {
      console.error('获取AFF返现批次关联的用户列表失败:', error);
      throw error;
    }
  },
  
  // 开始批量转账
  startBatchTransfer: async (batchId: string) => {
    try {
      console.log(`开始批量转账，批次ID: ${batchId}`);
      const response = await api.post(`${apiBaseUrl}/api/aff/cashbacks/${batchId}/transfer`);
      return response.data;
    } catch (error) {
      console.error('开始批量转账失败:', error);
      throw error;
    }
  },
  
  // 执行单个记录的转账
  executeTransfer: async (relationId: string) => {
    try {
      console.log(`执行单个记录的转账，关联ID: ${relationId}`);
      const response = await api.post(`${apiBaseUrl}/api/aff/relations/${relationId}/transfer`);
      return response.data;
    } catch (error) {
      console.error('执行单个记录的转账失败:', error);
      throw error;
    }
  },
  
  // 获取下一条待处理记录
  getNextPendingRelation: async (batchId: string) => {
    try {
      console.log(`获取下一条待处理记录，批次ID: ${batchId}`);
      const response = await api.get(`${apiBaseUrl}/api/aff/cashbacks/${batchId}/next`);
      return response.data;
    } catch (error) {
      console.error('获取下一条待处理记录失败:', error);
      throw error;
    }
  },
  
  // 关闭AFF返现批次
  closeCashback: async (batchId: string) => {
    try {
      console.log(`关闭AFF返现批次，批次ID: ${batchId}`);
      const response = await api.post(`${apiBaseUrl}/api/aff/cashbacks/${batchId}/close`);
      return response.data;
    } catch (error) {
      console.error('关闭AFF返现批次失败:', error);
      throw error;
    }
  }
};

/**
 * KYC图片管理API
 */
export const kycImageApi = {
  // 获取所有KYC图片
  getAllKycImages: async () => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/kyc-images`);
      return response.data;
    } catch (error) {
      console.error('获取KYC图片列表失败:', error);
      throw error;
    }
  },
  
  // 获取单个KYC图片
  getKycImageById: async (id: string) => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/kyc-images/${id}`);
      return response.data;
    } catch (error) {
      console.error('获取KYC图片失败:', error);
      throw error;
    }
  },
  
  // 按标签搜索KYC图片
  searchKycImagesByTags: async (tags: string) => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/kyc-images/search?tags=${encodeURIComponent(tags)}`);
      return response.data;
    } catch (error) {
      console.error('按标签搜索KYC图片失败:', error);
      throw error;
    }
  },
  
  // 获取随机KYC图片
  getRandomKycImage: async () => {
    try {
      // 获取所有图片然后随机选择一个
      const response = await api.get(`${apiBaseUrl}/api/kyc-images`);
      if (response.data.success && response.data.data && response.data.data.length > 0) {
        const images = response.data.data;
        const randomIndex = Math.floor(Math.random() * images.length);
        return {
          success: true,
          data: images[randomIndex],
          message: '获取随机KYC图片成功'
        };
      } else {
        return {
          success: false,
          message: '没有可用的KYC图片'
        };
      }
    } catch (error) {
      console.error('获取随机KYC图片失败:', error);
      throw error;
    }
  },
  
  // 创建KYC图片
  createKycImage: async (img_base64: string, tags?: string) => {
    try {
      const response = await api.post(`${apiBaseUrl}/api/kyc-images`, { img_base64, tags });
      return response.data;
    } catch (error) {
      console.error('创建KYC图片失败:', error);
      throw error;
    }
  },
  
  // 更新KYC图片
  updateKycImage: async (id: string, data: { img_base64?: string, tags?: string }) => {
    try {
      const response = await api.put(`${apiBaseUrl}/api/kyc-images/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('更新KYC图片失败:', error);
      throw error;
    }
  },
  
  // 删除KYC图片
  deleteKycImage: async (id: string) => {
    try {
      const response = await api.delete(`${apiBaseUrl}/api/kyc-images/${id}`);
      return response.data;
    } catch (error) {
      console.error('删除KYC图片失败:', error);
      throw error;
    }
  }
};

/**
 * 请求拦截器
 * 在请求发送前处理配置，可以添加通用headers等
 */
api.interceptors.request.use(
  (config) => {
    // 这里可以添加请求前的处理，例如添加token等
    return config;
  },
  (error) => {
    // 请求错误处理
    message.error('请求发送失败，请检查网络连接');
    return Promise.reject(error);
  }
);

/**
 * 响应拦截器
 * 拦截所有响应，处理错误情况，展示错误消息
 */
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // 如果响应成功但API返回错误状态(success=false)
    if (response.data && response.data.success === false) {
      // 记录完整响应以便调试
      console.log('API返回success=false的响应:', response.data);
      
      // 显示API返回的错误信息
      let errorMsg = '';
      if (response.data.message) {
        errorMsg = response.data.message;
        console.log('使用message字段显示错误:', errorMsg);
      } else if (response.data.msg) {
        errorMsg = response.data.msg;
        console.log('使用msg字段显示错误:', errorMsg);
      } else if (response.data.error) {
        errorMsg = response.data.error;
        console.log('使用error字段显示错误:', errorMsg);
      } else {
        errorMsg = '请求失败，请检查网络连接或稍后重试';
        console.log('未找到错误信息字段，使用默认错误消息');
      }
      
      // 使用自定义的全局错误处理器显示错误
      if (errorMsg) {
        console.log('调用全局错误处理器显示错误:', errorMsg);
        showGlobalError(errorMsg, 'error');
      }
    }
    return response;
  },
  (error: AxiosError) => {
    console.error('API请求错误:', error);
    
    if (error.response) {
      // 服务器返回错误状态码
      const { status, data } = error.response;
      console.log('错误响应状态码:', status);
      console.log('错误响应数据:', data);
      
      // 尝试从响应体中提取错误信息
      let errorMessage = '请求失败';
      if (typeof data === 'object' && data !== null) {
        // 如果响应中包含消息字段，优先使用该字段
        if ('message' in data && typeof data.message === 'string') {
          errorMessage = data.message;
          console.log('从错误响应中提取message字段:', errorMessage);
        } else if ('msg' in data && typeof data.msg === 'string') {
          errorMessage = data.msg;
          console.log('从错误响应中提取msg字段:', errorMessage);
        } else if ('error' in data && typeof data.error === 'string') {
          errorMessage = data.error;
          console.log('从错误响应中提取error字段:', errorMessage);
        } else {
          console.log('错误响应中没有找到标准错误字段，尝试JSON序列化:', JSON.stringify(data));
        }
      }
      
      // 根据状态码定制不同的错误提示
      let finalErrorMessage = '';
      
      switch (status) {
        case 400:
          finalErrorMessage = `请求参数错误: ${errorMessage}`;
          break;
        case 401:
          finalErrorMessage = `未授权，请登录: ${errorMessage}`;
          break;
        case 403:
          finalErrorMessage = `拒绝访问: ${errorMessage}`;
          break;
        case 404:
          finalErrorMessage = `请求的资源不存在: ${errorMessage}`;
          break;
        case 500:
          finalErrorMessage = `服务器内部错误: ${errorMessage}`;
          break;
        default:
          finalErrorMessage = `请求失败，状态码: ${status}, ${errorMessage}`;
      }
      
      // 使用自定义的全局错误处理器显示错误
      console.log('调用全局错误处理器显示HTTP错误:', finalErrorMessage);
      showGlobalError(finalErrorMessage, 'error');
    } else if (error.request) {
      // 请求已发出但没有收到响应
      console.log('请求已发出但没有收到响应:', error.request);
      showGlobalError('服务器无响应，请检查网络连接或联系管理员', 'error');
    } else {
      // 请求设置时触发的错误
      console.log('请求设置错误:', error.message);
      showGlobalError(`请求错误: ${error.message}`, 'error');
    }
    
    // 将错误对象继续抛出，以便在组件中可以进行更具体的处理
    return Promise.reject(error);
  }
);

/**
 * 便捷的HTTP请求方法，封装了常用的请求方式
 * 所有方法都使用统一的api实例，确保错误处理一致性
 */
export const httpService = {
  /**
   * GET请求
   * @param url 请求地址
   * @param params 请求参数
   * @param config 其他配置
   * @returns Promise
   */
  get: async <T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T> => {
    try {
      const response = await api.get(url, { params, ...config });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  /**
   * POST请求
   * @param url 请求地址
   * @param data 请求体数据
   * @param config 其他配置
   * @returns Promise
   */
  post: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    try {
      const response = await api.post(url, data, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  /**
   * PUT请求
   * @param url 请求地址
   * @param data 请求体数据
   * @param config 其他配置
   * @returns Promise
   */
  put: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> => {
    try {
      const response = await api.put(url, data, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  /**
   * DELETE请求
   * @param url 请求地址
   * @param config 其他配置
   * @returns Promise
   */
  delete: async <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> => {
    try {
      const response = await api.delete(url, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// 导出默认的API客户端
export default api;

// 导出API基础URL，以便在各组件中使用
export { apiBaseUrl };

/**
 * 卡片管理API
 * 处理与卡片相关的API请求
 */
export const infiniCardApi = {
  // 获取卡片价格
  getCardPrice: async (accountId: string, cardType: string | number = 3) => {
    try {
      console.log(`获取卡片价格，账户ID: ${accountId}, 卡片类型: ${cardType}`);
      const response = await api.get(`${apiBaseUrl}/api/infini-cards/price/${cardType}`, {
        params: { accountId }
      });
      return response.data;
    } catch (error) {
      console.error('获取卡片价格失败:', error);
      throw error;
    }
  },
  
  // 获取可用卡类型
  getAvailableCardTypes: async (accountId: string) => {
    try {
      console.log(`获取可用卡类型，账户ID: ${accountId}`);
      const response = await api.get(`${apiBaseUrl}/api/infini-cards/available-types`, {
        params: { accountId }
      });
      return response.data;
    } catch (error) {
      console.error('获取可用卡类型失败:', error);
      throw error;
    }
  },
  
  // 申请新卡
  applyNewCard: async (accountId: string, cardType: number = 3, price?: number, discount?: number) => {
    try {
      console.log(`申请新卡，账户ID: ${accountId}, 卡片类型: ${cardType}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-cards/apply`, {
        accountId,
        cardType,
        price,
        discount
      });
      return response.data;
    } catch (error) {
      console.error('申请新卡失败:', error);
      throw error;
    }
  },
  
  // 获取卡片列表
  getCardList: async (accountId: string) => {
    try {
      console.log(`获取卡片列表，账户ID: ${accountId}`);
      const response = await api.get(`${apiBaseUrl}/api/infini-cards/list`, {
        params: { accountId }
      });
      return response.data;
    } catch (error) {
      console.error('获取卡片列表失败:', error);
      throw error;
    }
  },
  
  // 同步卡片信息
  syncCardInfo: async (accountId: string) => {
    try {
      console.log(`同步卡片信息，账户ID: ${accountId}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-cards/sync`, {
        accountId
      });
      return response.data;
    } catch (error) {
      console.error('同步卡片信息失败:', error);
      throw error;
    }
  },
  
  // 获取卡片详情
  getCardDetail: async (accountId: string, cardId: string) => {
    try {
      console.log(`获取卡片详情，账户ID: ${accountId}, 卡片ID: ${cardId}`);
      const response = await api.get(`${apiBaseUrl}/api/infini-cards/detail`, {
        params: {
          accountId,
          cardId
        }
      });
      return response.data;
    } catch (error) {
      console.error('获取卡片详情失败:', error);
      throw error;
    }
  },
  
  // 获取开卡申请记录
  getCardApplications: async (accountId: string) => {
    try {
      console.log(`获取开卡申请记录，账户ID: ${accountId}`);
      const response = await api.get(`${apiBaseUrl}/api/infini-cards/applications`, {
        params: { accountId }
      });
      return response.data;
    } catch (error) {
      console.error('获取开卡申请记录失败:', error);
      throw error;
    }
  },
  
  // 提交KYC基础信息
  submitKycBasic: async (accountId: string, kycData: {
    first_name: string;
    last_name: string;
    phone_code: string;
    phone_number: string;
    birthday: string;
  }) => {
    try {
      console.log(`提交KYC基础信息，账户ID: ${accountId}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-cards/kyc/basic`, {
        accountId,
        kycData
      });
      return response.data;
    } catch (error) {
      console.error('提交KYC基础信息失败:', error);
      throw error;
    }
  },
  
  // 提交KYC生日信息
  submitKycBirthday: async (accountId: string, birthday: string) => {
    try {
      console.log(`提交KYC生日信息，账户ID: ${accountId}，生日: ${birthday}`);
      const response = await api.post(`${apiBaseUrl}/api/infini-cards/kyc/birthday`, {
        accountId,
        birthday
      });
      return response.data;
    } catch (error) {
      console.error('提交KYC生日信息失败:', error);
      throw error;
    }
  }
};

/**
 * API日志查询接口
 * 用于查询Axios请求日志数据，支持按业务类型筛选
 */
export const axiosLogsApi = {
  // 获取API日志列表
  getLogs: async (params: {
    startDate?: string | Date;
    endDate?: string | Date;
    businessModule?: string;
    businessOperation?: string;
    url?: string;
    method?: string;
    statusCode?: number;
    success?: boolean;
    page?: number;
    pageSize?: number;
  }) => {
    try {
      console.log('获取API日志列表:', params);
      const response = await api.get(`${apiBaseUrl}/api/axios-logs`, { params });
      return response.data;
    } catch (error) {
      console.error('获取API日志列表失败:', error);
      throw error;
    }
  },
  
  // 获取业务模块列表
  getBusinessModules: async () => {
    try {
      console.log('获取业务模块列表');
      const response = await api.get(`${apiBaseUrl}/api/axios-logs/business-modules`);
      return response.data;
    } catch (error) {
      console.error('获取业务模块列表失败:', error);
      throw error;
    }
  },
  
  // 获取业务操作类型列表
  getBusinessOperations: async (businessModule?: string) => {
    try {
      console.log(`获取业务操作类型列表${businessModule ? '，业务模块: ' + businessModule : ''}`);
      const params = businessModule ? { businessModule } : undefined;
      const response = await api.get(`${apiBaseUrl}/api/axios-logs/business-operations`, { params });
      return response.data;
    } catch (error) {
      console.error('获取业务操作类型列表失败:', error);
      throw error;
    }
  }
};

/**
 * 任务管理API
 * 处理定时任务相关的API请求
 */
export const taskApi = {
  // 获取任务列表
  getTasks: async () => {
    try {
      console.log('获取任务列表');
      const response = await api.get(`${apiBaseUrl}/api/tasks`);
      return response.data;
    } catch (error) {
      console.error('获取任务列表失败:', error);
      throw error;
    }
  },
  
  // 创建任务
  createTask: async (taskData: {
    taskName: string;
    taskKey: string;
    description?: string;
    cronExpression: string;
    handler: {
      type: 'function' | 'http' | 'service';
      [key: string]: any;
    };
    status: 'enabled' | 'disabled';
    retryCount?: number;
    retryInterval?: number;
  }) => {
    try {
      console.log('创建任务:', taskData);
      const response = await api.post(`${apiBaseUrl}/api/tasks`, taskData);
      return response.data;
    } catch (error) {
      console.error('创建任务失败:', error);
      throw error;
    }
  },
  
  // 更新任务
  updateTask: async (id: string, taskData: {
    taskName?: string;
    description?: string;
    cronExpression?: string;
    handler?: {
      type: 'function' | 'http' | 'service';
      [key: string]: any;
    };
    status?: 'enabled' | 'disabled';
    retryCount?: number;
    retryInterval?: number;
  }) => {
    try {
      console.log(`更新任务 ID: ${id}`, taskData);
      const response = await api.put(`${apiBaseUrl}/api/tasks/${id}`, taskData);
      return response.data;
    } catch (error) {
      console.error('更新任务失败:', error);
      throw error;
    }
  },
  
  // 删除任务
  deleteTask: async (id: string) => {
    try {
      console.log(`删除任务 ID: ${id}`);
      const response = await api.delete(`${apiBaseUrl}/api/tasks/${id}`);
      return response.data;
    } catch (error) {
      console.error('删除任务失败:', error);
      throw error;
    }
  },
  
  // 启用/禁用任务
  toggleTask: async (id: string, isActive: boolean) => {
    try {
      console.log(`${isActive ? '启用' : '禁用'}任务 ID: ${id}`);
      const response = await api.patch(`${apiBaseUrl}/api/tasks/${id}/toggle`, { isActive });
      return response.data;
    } catch (error) {
      console.error('切换任务状态失败:', error);
      throw error;
    }
  },
  
  // 手动执行任务
  executeTask: async (id: string) => {
    try {
      console.log(`手动执行任务 ID: ${id}`);
      const response = await api.post(`${apiBaseUrl}/api/tasks/${id}/execute`);
      return response.data;
    } catch (error) {
      console.error('手动执行任务失败:', error);
      throw error;
    }
  },
  
  // 获取任务执行历史
  getTaskExecutions: async (id: string) => {
    try {
      console.log(`获取任务执行历史 ID: ${id}`);
      const response = await api.get(`${apiBaseUrl}/api/tasks/${id}/executions`);
      return response.data;
    } catch (error) {
      console.error('获取任务执行历史失败:', error);
      throw error;
    }
  },
  
  // 获取可用的函数处理器列表
  getAvailableHandlers: async () => {
    try {
      console.log('获取可用的函数处理器列表');
      const response = await api.get(`${apiBaseUrl}/api/tasks/handlers`);
      return response.data;
    } catch (error) {
      console.error('获取可用的函数处理器列表失败:', error);
      throw error;
    }
  },
  
  // 更新内置邮件同步任务配置
  updateEmailSyncTaskConfig: async (id: string, accountIds: number[], cronExpression?: string) => {
    try {
      console.log(`更新内置邮件同步任务配置，任务ID: ${id}, 选择账户数量: ${accountIds.length}, cron表达式: ${cronExpression || '未修改'}`);
      
      // 准备请求数据
      const requestData: any = {
        handlerParams: {
          accountIds
        }
      };
      
      // 如果提供了cron表达式，则一并更新
      if (cronExpression) {
        requestData.cronExpression = cronExpression;
      }
      
      // 使用PATCH请求更新配置
      const response = await api.patch(`${apiBaseUrl}/api/tasks/${id}/config`, requestData);
      return response.data;
    } catch (error) {
      console.error('更新内置邮件同步任务配置失败:', error);
      throw error;
    }
  }
};

/**
 * 代理池管理API
 * 处理所有与代理池相关的API请求
 */
export const proxyPoolApi = {
  // 获取所有代理池
  getPools: async () => {
    try {
      console.log('获取代理池列表');
      const response = await api.get(`${apiBaseUrl}/api/proxy-pools`);
      return response.data;
    } catch (error) {
      console.error('获取代理池列表失败:', error);
      throw error;
    }
  },

  // 创建代理池
  createPool: async (poolData: {
    name: string;
    description?: string;
    proxy_mode: 'none' | 'round_robin' | 'random' | 'failover';
    enabled: boolean;
  }) => {
    try {
      console.log('创建代理池:', poolData);
      const response = await api.post(`${apiBaseUrl}/api/proxy-pools`, poolData);
      return response.data;
    } catch (error) {
      console.error('创建代理池失败:', error);
      throw error;
    }
  },

  // 更新代理池
  updatePool: async (poolId: number, poolData: {
    name?: string;
    description?: string;
    proxy_mode?: 'none' | 'round_robin' | 'random' | 'failover';
    enabled?: boolean;
  }) => {
    try {
      console.log(`更新代理池 ${poolId}:`, poolData);
      const response = await api.put(`${apiBaseUrl}/api/proxy-pools/${poolId}`, poolData);
      return response.data;
    } catch (error) {
      console.error('更新代理池失败:', error);
      throw error;
    }
  },

  // 删除代理池
  deletePool: async (poolId: number) => {
    try {
      console.log(`删除代理池 ${poolId}`);
      const response = await api.delete(`${apiBaseUrl}/api/proxy-pools/${poolId}`);
      return response.data;
    } catch (error) {
      console.error('删除代理池失败:', error);
      throw error;
    }
  },

  // 获取代理池中的代理服务器
  getServers: async (poolId: number) => {
    try {
      console.log(`获取代理池 ${poolId} 的服务器列表`);
      const response = await api.get(`${apiBaseUrl}/api/proxy-pools/${poolId}/servers`);
      return response.data;
    } catch (error) {
      console.error('获取代理服务器列表失败:', error);
      throw error;
    }
  },

  // 添加代理服务器
  addServer: async (poolId: number, serverData: {
    name: string;
    proxy_type: 'http' | 'https' | 'socks4' | 'socks5';
    host: string;
    port: number;
    username?: string;
    password?: string;
    enabled?: boolean;
  }) => {
    try {
      console.log(`添加代理服务器到代理池 ${poolId}:`, serverData);
      const response = await api.post(`${apiBaseUrl}/api/proxy-pools/${poolId}/servers`, serverData);
      return response.data;
    } catch (error) {
      console.error('添加代理服务器失败:', error);
      throw error;
    }
  },

  // 批量添加代理服务器
  batchAddServers: async (poolId: number, proxyStrings: string[]) => {
    try {
      console.log(`批量添加代理服务器到代理池 ${poolId}, 数量: ${proxyStrings.length}`);
      const response = await api.post(`${apiBaseUrl}/api/proxy-pools/${poolId}/servers/batch`, {
        proxyStrings
      });
      return response.data;
    } catch (error) {
      console.error('批量添加代理服务器失败:', error);
      throw error;
    }
  },

  // 更新代理服务器
  updateServer: async (serverId: number, serverData: {
    name?: string;
    proxy_type?: 'http' | 'https' | 'socks4' | 'socks5';
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    enabled?: boolean;
  }) => {
    try {
      console.log(`更新代理服务器 ${serverId}:`, serverData);
      const response = await api.put(`${apiBaseUrl}/api/proxy-pools/servers/${serverId}`, serverData);
      return response.data;
    } catch (error) {
      console.error('更新代理服务器失败:', error);
      throw error;
    }
  },

  // 获取所有代理服务器
  getAllServers: async () => {
    try {
      console.log('获取所有代理服务器');
      const response = await api.get(`${apiBaseUrl}/api/proxy-pools/servers`);
      return response.data;
    } catch (error) {
      console.error('获取所有代理服务器失败:', error);
      throw error;
    }
  },

  // 删除代理服务器
  deleteServer: async (serverId: number) => {
    try {
      console.log(`删除代理服务器 ${serverId}`);
      const response = await api.delete(`${apiBaseUrl}/api/proxy-pools/servers/${serverId}`);
      return response.data;
    } catch (error) {
      console.error('删除代理服务器失败:', error);
      throw error;
    }
  },

  // 验证代理服务器
  validateServer: async (serverId: number) => {
    try {
      console.log(`验证代理服务器 ${serverId}`);
      const response = await api.post(`${apiBaseUrl}/api/proxy-pools/servers/${serverId}/validate`);
      return response.data;
    } catch (error) {
      console.error('验证代理服务器失败:', error);
      throw error;
    }
  },

  // 解析代理字符串
  parseProxyString: async (proxyString: string) => {
    try {
      console.log('解析代理字符串:', proxyString);
      const response = await api.post(`${apiBaseUrl}/api/proxy-pools/parse`, {
        proxyString
      });
      return response.data;
    } catch (error) {
      console.error('解析代理字符串失败:', error);
      throw error;
    }
  },

  // 执行健康检查
  healthCheck: async () => {
    try {
      console.log('执行代理健康检查');
      const response = await api.post(`${apiBaseUrl}/api/proxy-pools/health-check`);
      return response.data;
    } catch (error) {
      console.error('代理健康检查失败:', error);
      throw error;
    }
  },

  // ==================== 标签管理 ====================

  // 获取所有标签
  getAllTags: async () => {
    try {
      console.log('获取所有代理标签');
      const response = await api.get(`${apiBaseUrl}/api/proxy-pools/tags`);
      return response.data;
    } catch (error) {
      console.error('获取所有代理标签失败:', error);
      throw error;
    }
  },

  // 创建标签
  createTag: async (tagData: {
    name: string;
    description?: string;
    color?: string;
  }) => {
    try {
      console.log('创建代理标签:', tagData);
      const response = await api.post(`${apiBaseUrl}/api/proxy-pools/tags`, tagData);
      return response.data;
    } catch (error) {
      console.error('创建代理标签失败:', error);
      throw error;
    }
  },

  // 更新标签
  updateTag: async (tagId: number, tagData: {
    name?: string;
    description?: string;
    color?: string;
  }) => {
    try {
      console.log(`更新代理标签 ${tagId}:`, tagData);
      const response = await api.put(`${apiBaseUrl}/api/proxy-pools/tags/${tagId}`, tagData);
      return response.data;
    } catch (error) {
      console.error('更新代理标签失败:', error);
      throw error;
    }
  },

  // 删除标签
  deleteTag: async (tagId: number) => {
    try {
      console.log(`删除代理标签 ${tagId}`);
      const response = await api.delete(`${apiBaseUrl}/api/proxy-pools/tags/${tagId}`);
      return response.data;
    } catch (error) {
      console.error('删除代理标签失败:', error);
      throw error;
    }
  },

  // 获取代理服务器的标签
  getServerTags: async (serverId: number) => {
    try {
      console.log(`获取代理服务器 ${serverId} 的标签`);
      const response = await api.get(`${apiBaseUrl}/api/proxy-pools/servers/${serverId}/tags`);
      return response.data;
    } catch (error) {
      console.error('获取代理服务器标签失败:', error);
      throw error;
    }
  },

  // 为代理服务器添加标签
  addTagToServer: async (serverId: number, tagId: number) => {
    try {
      console.log(`为代理服务器 ${serverId} 添加标签 ${tagId}`);
      const response = await api.post(`${apiBaseUrl}/api/proxy-pools/servers/${serverId}/tags`, {
        tagId
      });
      return response.data;
    } catch (error) {
      console.error('为代理服务器添加标签失败:', error);
      throw error;
    }
  },

  // 为代理服务器批量添加标签
  addTagsToServer: async (serverId: number, tagIds: number[]) => {
    try {
      console.log(`为代理服务器 ${serverId} 批量添加标签, 数量: ${tagIds.length}`);
      const response = await api.post(`${apiBaseUrl}/api/proxy-pools/servers/${serverId}/tags`, {
        tagIds
      });
      return response.data;
    } catch (error) {
      console.error('为代理服务器批量添加标签失败:', error);
      throw error;
    }
  },

  // 从代理服务器移除标签
  removeTagFromServer: async (serverId: number, tagId: number) => {
    try {
      console.log(`从代理服务器 ${serverId} 移除标签 ${tagId}`);
      const response = await api.delete(`${apiBaseUrl}/api/proxy-pools/servers/${serverId}/tags/${tagId}`);
      return response.data;
    } catch (error) {
      console.error('从代理服务器移除标签失败:', error);
      throw error;
    }
  },

  // 通过标签获取代理服务器
  getServersByTag: async (tagId: number) => {
    try {
      console.log(`通过标签 ${tagId} 获取代理服务器`);
      const response = await api.get(`${apiBaseUrl}/api/proxy-pools/tags/${tagId}/servers`);
      return response.data;
    } catch (error) {
      console.error('通过标签获取代理服务器失败:', error);
      throw error;
    }
  },

  // 通过标签名称获取代理服务器
  getServersByTagName: async (tagName: string) => {
    try {
      console.log(`通过标签名称 "${tagName}" 获取代理服务器`);
      const response = await api.get(`${apiBaseUrl}/api/proxy-pools/tags/name/${encodeURIComponent(tagName)}/servers`);
      return response.data;
    } catch (error) {
      console.error('通过标签名称获取代理服务器失败:', error);
      throw error;
    }
  },

  // 随机获取带有指定标签的代理服务器
  getRandomServerWithTags: async (tagNames: string[]) => {
    try {
      console.log(`随机获取带有指定标签的代理服务器, 标签: ${tagNames.join(', ')}`);
      const response = await api.post(`${apiBaseUrl}/api/proxy-pools/random-server-with-tags`, {
        tagNames
      });
      return response.data;
    } catch (error) {
      console.error('随机获取带有指定标签的代理服务器失败:', error);
      throw error;
    }
  },

  // ==================== 批量导入预览 ====================

  // 预览批量导入的代理服务器
  previewBatchServers: async (poolId: number, proxyStrings: string[]) => {
    try {
      console.log(`预览批量导入的代理服务器, 代理池: ${poolId}, 数量: ${proxyStrings.length}`);
      const response = await api.post(`${apiBaseUrl}/api/proxy-pools/${poolId}/servers/preview`, {
        proxyStrings
      });
      return response.data;
    } catch (error) {
      console.error('预览批量导入的代理服务器失败:', error);
      throw error;
    }
  },

  // 批量添加代理服务器（支持标签）
  batchAddServersWithTags: async (poolId: number, proxyStrings: string[], defaultTags: string[] = []) => {
    try {
      console.log(`批量添加代理服务器（支持标签）, 代理池: ${poolId}, 数量: ${proxyStrings.length}, 默认标签: ${defaultTags.join(', ')}`);
      const response = await api.post(`${apiBaseUrl}/api/proxy-pools/${poolId}/servers/batch-with-tags`, {
        proxyStrings,
        defaultTags
      });
      return response.data;
    } catch (error) {
      console.error('批量添加代理服务器（支持标签）失败:', error);
      throw error;
    }
  },
};

/**
 * 使用说明：
 * 
 * 1. 直接使用api实例进行请求：
 *    import api from '../../services/api';
 *    try {
 *      const response = await api.get('/some/endpoint');
 *      // 处理响应
 *    } catch (error) {
 *      // 错误已由拦截器统一处理，这里可以添加额外逻辑
 *    }
 * 
 * 2. 使用封装的API服务：
 *    import { infiniAccountApi } from '../../services/api';
 *    try {
 *      const response = await infiniAccountApi.getAllAccountGroups();
 *      // 处理响应
 *    } catch (error) {
 *      // 错误已由拦截器统一处理，这里可以添加额外逻辑
 *    }
 * 
 * 3. 使用便捷的HTTP方法：
 *    import { httpService } from '../../services/api';
 *    try {
 *      const data = await httpService.get('/some/endpoint');
 *      // 处理数据
 *    } catch (error) {
 *      // 错误已由拦截器统一处理，这里可以添加额外逻辑
 *    }
 */