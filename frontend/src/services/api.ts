/**
 * API服务配置
 * 配置axios拦截器，处理API请求和响应，统一错误处理
 * 
 * 统一的axios实例，所有API请求都应使用此实例，确保错误处理一致性
 * 拦截所有非200状态码响应，通过message组件显示错误信息
 */
import axios, { AxiosResponse, AxiosError, AxiosRequestConfig, AxiosInstance } from 'axios';
import { message } from 'antd';

// 创建axios实例
const api: AxiosInstance = axios.create({
  timeout: 60000, // 默认60秒超时时间，长时间运行的请求可在调用时覆盖
  headers: {
    'Content-Type': 'application/json',
  },
});

// API基础URL
const apiBaseUrl = 'http://localhost:33201';

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
      // 显示API返回的错误信息
      if (response.data.message) {
        // 显示错误信息，确保即使是复杂的错误消息也能正确显示
        message.error(response.data.message);
      } else if (response.data.msg) {
        // 兼容msg字段
        message.error(response.data.msg);
      } else if (response.data.error) {
        // 兼容error字段
        message.error(response.data.error);
      } else {
        // 如果没有明确的错误信息字段，显示通用错误
        message.error('请求失败，请检查网络连接或稍后重试');
      }
    }
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      // 服务器返回错误状态码
      const { status, data } = error.response;
      
      // 尝试从响应体中提取错误信息
      let errorMessage = '请求失败';
      if (typeof data === 'object' && data !== null) {
        // 如果响应中包含消息字段，优先使用该字段
        if ('message' in data && typeof data.message === 'string') {
          errorMessage = data.message;
        } else if ('msg' in data && typeof data.msg === 'string') {
          errorMessage = data.msg;
        } else if ('error' in data && typeof data.error === 'string') {
          errorMessage = data.error;
        }
      }
      
      // 根据状态码定制不同的错误提示
      switch (status) {
        case 400:
          message.error(errorMessage || '请求参数错误');
          break;
        case 401:
          message.error(errorMessage || '未授权，请登录');
          break;
        case 403:
          message.error(errorMessage || '拒绝访问');
          break;
        case 404:
          message.error(errorMessage || '请求的资源不存在');
          break;
        case 500:
          message.error(errorMessage || '服务器内部错误');
          break;
        default:
          message.error(errorMessage || `请求失败，状态码: ${status}`);
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      message.error('服务器无响应，请检查网络连接或联系管理员');
    } else {
      // 请求设置时触发的错误
      message.error(`请求错误: ${error.message}`);
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