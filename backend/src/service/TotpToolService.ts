/**
 * TOTP工具服务
 * 用于处理2FA验证码的生成，支持otpauth://totp/格式URL和纯密钥
 * 包含二维码生成功能，避免使用第三方API导致TOTP密钥泄露
 */
import { authenticator } from 'otplib';
import { ApiResponse } from '../types';
import * as qrcode from 'qrcode';

interface TotpDetails {
  code: string;
  remainingSeconds: number;
  type: string;
  issuer: string;
  account: string;
  period: number;
  digits: number;
}

export class TotpToolService {
  constructor() {
    // 设置默认配置
    authenticator.options = {
      digits: 6,
      step: 30,
      window: 1 // 允许±1步的时间窗口偏差，减少时间同步问题
    };
  }

  /**
   * 通过TOTP URL或密钥生成当前有效的验证码
   * @param input OTP URL(otpauth://totp/...)或密钥
   */
  async generateTotpCode(input: string): Promise<ApiResponse> {
    try {
      if (!input) {
        return {
          success: false,
          message: '输入不能为空，请提供有效的TOTP URL或密钥'
        };
      }

      // 检查输入是否为TOTP URL格式
      if (input.startsWith('otpauth://totp/')) {
        return this.generateFromTotpUrl(input);
      } else {
        // 假设输入是纯密钥
        return this.generateFromSecret(input);
      }
    } catch (error) {
      console.error('生成TOTP验证码失败:', error);
      return {
        success: false,
        message: `生成TOTP验证码失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 从TOTP URL生成验证码，支持标准的otpauth://totp/格式
   * 格式示例: otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example
   */
  private generateFromTotpUrl(totpUrl: string): ApiResponse {
    try {
      console.log(`开始解析TOTP URL: ${totpUrl}`);
      
      // 移除协议前缀获取剩余部分
      const withoutProtocol = totpUrl.substring('otpauth://totp/'.length);
      console.log(`移除协议前缀后: ${withoutProtocol}`);
      
      // 分离标签和参数
      const questionMarkIndex = withoutProtocol.indexOf('?');
      let label = '';
      let queryString = '';
      
      if (questionMarkIndex >= 0) {
        label = withoutProtocol.substring(0, questionMarkIndex);
        queryString = withoutProtocol.substring(questionMarkIndex + 1);
      } else {
        label = withoutProtocol;
      }
      
      console.log(`提取的标签部分: ${label}`);
      console.log(`提取的查询参数部分: ${queryString}`);
      
      // 解析查询参数
      const params: Record<string, string> = {};
      if (queryString) {
        const pairs = queryString.split('&');
        for (const pair of pairs) {
          const [key, value] = pair.split('=');
          if (key && value) {
            params[key] = decodeURIComponent(value);
          }
        }
      }
      
      console.log(`解析的参数:`, params);
      
      // 获取密钥
      const secret = params['secret'];
      if (!secret) {
        return {
          success: false,
          message: 'TOTP URL中未找到密钥(secret)参数'
        };
      }
      
      // 获取参数
      const digits = params['digits'] ? parseInt(params['digits'], 10) : 6;
      const period = params['period'] ? parseInt(params['period'], 10) : 30;
      
      // 解析标签
      label = decodeURIComponent(label);
      let issuer = params['issuer'] || '';
      let account = '';
      
      if (label.includes(':')) {
        const parts = label.split(':');
        if (!issuer) issuer = parts[0] || '';
        account = parts[1] || '';
      } else {
        account = label;
      }
      
      // 配置authenticator
      authenticator.options = {
        digits: digits,
        step: period,
        window: 1
      };
      
      console.log(`正在配置TOTP参数: 位数=${digits}, 周期=${period}, 算法=SHA1`);
      console.log(`TOTP配置完成:`, JSON.stringify(authenticator.options));
      
      // 生成验证码
      const code = authenticator.generate(secret);
      
      // 计算剩余时间
      const now = Math.floor(Date.now() / 1000);
      const remainingSeconds = period - (now % period);
      
      return {
        success: true,
        data: {
          code,
          remainingSeconds,
          type: 'totp',
          issuer: issuer || '未知服务',
          account: account || '未知账户',
          period,
          digits
        } as TotpDetails
      };
    } catch (error) {
      console.error('解析TOTP URL失败:', error);
      return {
        success: false,
        message: `解析TOTP URL失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 从密钥直接生成验证码（使用默认参数）
   */
  private generateFromSecret(secret: string): ApiResponse {
    try {
      // 清理密钥（移除空格和特殊字符）
      const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
      
      // 验证密钥是否有效
      if (!this.isValidSecret(cleanSecret)) {
        return {
          success: false,
          message: '无效的TOTP密钥，请提供有效的Base32编码字符串'
        };
      }

      // 使用标准参数配置
      authenticator.options = { 
        digits: 6,
        step: 30,
        window: 1
      };

      // 生成当前验证码
      const code = authenticator.generate(cleanSecret);
      
      // 计算剩余有效时间
      const now = Math.floor(Date.now() / 1000);
      const remainingSeconds = 30 - (now % 30);

      return {
        success: true,
        data: {
          code,
          remainingSeconds,
          type: 'totp',
          issuer: '未知服务',
          account: '未知账户',
          period: 30,
          digits: 6
        } as TotpDetails
      };
    } catch (error) {
      console.error('基于密钥生成TOTP验证码失败:', error);
      return {
        success: false,
        message: `基于密钥生成TOTP验证码失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 检查密钥是否是有效的Base32字符串并且能用于生成TOTP
   */
  private isValidSecret(secret: string): boolean {
    if (!secret) return false;
    
    // 尝试生成验证码，如果失败则认为密钥无效
    try {
      authenticator.generate(secret);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 生成TOTP二维码图像
   * @param data TOTP URL或密钥
   * @param options 二维码生成选项，可选
   * @returns 包含Base64编码的二维码图像或错误信息的响应
   */
  async generateQrCode(data: string, options: { size?: number } = {}): Promise<ApiResponse> {
    try {
      if (!data) {
        return {
          success: false,
          message: '输入不能为空，请提供有效的TOTP URL或密钥'
        };
      }

      // 默认二维码大小为200x200
      const size = options.size || 200;

      // 如果输入是密钥而非URL，则生成标准TOTP URL
      if (!data.startsWith('otpauth://totp/')) {
        // 清理密钥（移除空格和特殊字符）
        const cleanSecret = data.replace(/\s+/g, '').toUpperCase();
        
        // 验证密钥是否有效
        if (!this.isValidSecret(cleanSecret)) {
          return {
            success: false,
            message: '无效的TOTP密钥，请提供有效的Base32编码字符串'
          };
        }

        // 使用密钥生成标准TOTP URL
        data = `otpauth://totp/Infini:Unknown?secret=${cleanSecret}&issuer=Infini&algorithm=SHA1&digits=6&period=30`;
      }

      // 使用qrcode库生成二维码（Base64格式）
      const qrCodeDataUrl = await qrcode.toDataURL(data, {
        width: size,
        margin: 1,
        errorCorrectionLevel: 'M'
      });

      return {
        success: true,
        data: {
          qrCode: qrCodeDataUrl,
          url: data
        }
      };
    } catch (error) {
      console.error('生成二维码失败:', error);
      return {
        success: false,
        message: `生成二维码失败: ${(error as Error).message}`
      };
    }
  }
}