/**
 * TOTP工具控制器
 * 用于处理TOTP验证码生成相关的API请求
 * 包含二维码生成功能，避免使用第三方API导致TOTP密钥泄露
 */
import { Request, Response } from 'express';
import { TotpToolService } from '../service/TotpToolService';

// 创建TotpToolService实例
const totpToolService = new TotpToolService();

/**
 * 生成TOTP验证码
 * 支持两种输入格式：
 * 1. otpauth://totp/ URL格式
 * 2. 纯密钥字符串
 */
export const generateTotpCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { input } = req.body;
    
    if (!input) {
      res.status(400).json({
        success: false,
        message: '缺少必要参数：input(TOTP URL或密钥)'
      });
      return;
    }
    
    const response = await totpToolService.generateTotpCode(input);
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(400).json(response);
    }
  } catch (error) {
    console.error('生成TOTP验证码失败:', error);
    res.status(500).json({
      success: false,
      message: `生成TOTP验证码失败: ${(error as Error).message}`
    });
  }
};

/**
 * 生成TOTP二维码图像
 * 支持两种输入格式：
 * 1. otpauth://totp/ URL格式
 * 2. 纯密钥字符串
 */
export const generateQrCodeImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { input, size } = req.body;
    
    if (!input) {
      res.status(400).json({
        success: false,
        message: '缺少必要参数：input(TOTP URL或密钥)'
      });
      return;
    }
    
    // 调用服务方法生成二维码
    const response = await totpToolService.generateQrCode(input, { size });
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(400).json(response);
    }
  } catch (error) {
    console.error('生成TOTP二维码失败:', error);
    res.status(500).json({
      success: false,
      message: `生成TOTP二维码失败: ${(error as Error).message}`
    });
  }
};