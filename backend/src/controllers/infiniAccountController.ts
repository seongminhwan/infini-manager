/**
 * Infini账户控制器
 * 用于管理Infini账户信息、登录和同步余额等功能
 * 业务逻辑已抽离到InfiniAccountService服务类
 */
import { Request, Response } from 'express';
import multer from 'multer';
import { InfiniAccountService } from '../service/InfiniAccountService';
import { RandomUserService } from '../service/RandomUserService';
import { TotpToolService } from '../service/TotpToolService'; 
import { InfiniAccountCreate } from '../types';
import httpClient from '../utils/httpClient';
import db from '../db/db';
import { randomOrderBy } from '../utils/dbHelper';

// 创建InfiniAccountService实例
const infiniAccountService = new InfiniAccountService();
// 配置multer用于处理文件上传
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 限制文件大小为10MB
  },
  fileFilter: (req, file, cb) => {
    // 只接受图片类型
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只支持上传图片文件'));
    }
  },
});

// 导出multer中间件，用于路由中处理文件上传
export const uploadKycImageMiddleware = upload.single('file');

/**
 * 上传KYC图片到Infini系统
 */
export const uploadKycImage = async (req: Request, res: Response): Promise<void> => {
  try {
    // 检查是否有文件上传
    if (!req.file) {
      res.status(400).json({
        success: false,
        message: '未收到文件'
      });
      return;
    }

    // 获取账户ID
    const { accountId } = req.body;
    
    if (!accountId) {
      res.status(400).json({
        success: false,
        message: '账户ID是必填项'
      });
      return;
    }
    
    console.log(`接收到KYC图片上传请求，账户ID: ${accountId}, 文件名: ${req.file.originalname}, 文件大小: ${req.file.size} 字节`);
    
    // 调用服务层方法上传KYC图片
    const response = await infiniAccountService.uploadKycImage(
      accountId,
      req.file.buffer,
      req.file.originalname
    );
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('上传KYC图片失败:', error);
    res.status(500).json({
      success: false,
      message: `上传KYC图片失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取Infini 2FA二维码
 */
export const getGoogle2faQrcode = async (req: Request, res: Response): Promise<void> => {
  try {
    // 从请求体中获取账户ID
    const { accountId } = req.query;
    
    if (!accountId) {
      res.status(400).json({
        success: false,
        message: '账户ID是必填项'
      });
      return;
    }
    
    const response = await infiniAccountService.getGoogle2faQrcode(accountId as string);
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取2FA二维码失败:', error);
    res.status(500).json({
      success: false,
      message: `获取2FA二维码失败: ${(error as Error).message}`
    });
  }
};

/**
 * 发送Infini 2FA验证邮件
 */
export const sendGoogle2faVerificationEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, accountId, type } = req.body;
    
    if (!email) {
      res.status(400).json({
        success: false,
        message: '邮箱地址是必填项'
      });
      return;
    }
    
    if (!accountId) {
      res.status(400).json({
        success: false,
        message: '账户ID是必填项'
      });
      return;
    }
    
    // 获取type参数，默认为6（2FA验证码）
    const codeType = type !== undefined ? parseInt(type.toString(), 10) : 6;
    console.log(`发送2FA验证邮件，类型: ${codeType}, 邮箱: ${email}, 账户ID: ${accountId}`);
    
    const response = await infiniAccountService.sendGoogle2faVerificationEmail(email, accountId, codeType);
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('发送2FA验证邮件失败:', error);
    res.status(500).json({
      success: false,
      message: `发送2FA验证邮件失败: ${(error as Error).message}`
    });
  }
};

/**
 * 绑定Infini 2FA
 */
export const bindGoogle2fa = async (req: Request, res: Response): Promise<void> => {
  try {
    const { verification_code, google_2fa_code, accountId } = req.body;
    
    if (!verification_code || !google_2fa_code) {
      res.status(400).json({
        success: false,
        message: '邮件验证码和2FA验证码均不能为空'
      });
      return;
    }
    
    if (!accountId) {
      res.status(400).json({
        success: false,
        message: '账户ID是必填项'
      });
      return;
    }
    
    const response = await infiniAccountService.bindGoogle2fa(verification_code, google_2fa_code, accountId);
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('绑定2FA失败:', error);
    res.status(500).json({
      success: false,
      message: `绑定2FA失败: ${(error as Error).message}`
    });
  }
};

/** 
 * 发送验证码并等待获取
 */
export const sendAndWaitVerificationCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, type } = req.body;

    if (!email) {
      res.status(400).json({
        success: false,
        message: '邮箱地址是必填项'
      }); 
      return;
    }

    // 获取type参数，默认为0（注册验证码）
    const codeType = type ? parseInt(type as string, 10) : 0;
    console.log(`发送验证码类型: ${codeType}`);

    const response = await infiniAccountService.sendAndWaitVerificationCode(email, codeType); 
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) { 
    console.error('发送验证码并等待获取失败:', error);
    res.status(500).json({
      success: false,
      message: `发送验证码并等待获取失败: ${(error as Error).message}`
    });
  }
};


/**
 * 发送Infini验证码
 * 支持多种验证码类型:
 * - type=0: 注册验证码(默认)
 * - type=6: 2FA验证码
 */
export const sendVerificationCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, type } = req.body;
    
    if (!email) {
      res.status(400).json({
        success: false,
        message: '邮箱地址是必填项'
      });
      return;
    }
    
    // 获取type参数，默认为0（注册验证码）
    const codeType = type ? parseInt(type as string, 10) : 0;
    console.log(`发送验证码类型: ${codeType}`);
    
    const response = await infiniAccountService.sendVerificationCode(email, codeType);
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.status(500).json({
      success: false,
      message: `发送验证码失败: ${(error as Error).message}`
    });
  }
};

/**
 * 从邮件中获取验证码
 */
export const fetchVerificationCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, main_email, retry_count, interval_seconds } = req.query;
    
    if (!email) {
      res.status(400).json({
        success: false,
        message: '邮箱地址是必填项'
      });
      return;
    }
    
    // 转换重试次数和间隔时间为数字，并提供默认值
    const retryCount = retry_count ? parseInt(retry_count as string, 10) : 1;
    const intervalSeconds = interval_seconds ? parseInt(interval_seconds as string, 10) : 5;
    
    const response = await infiniAccountService.fetchVerificationCode(
      email as string, 
      main_email as string,
      retryCount,
      intervalSeconds
    );
    
    if (response.success) {
      res.json(response);
    } else if (response.message && response.message.includes('未找到该邮箱的验证码请求')) {
      res.status(404).json(response);
    } else if (response.message && response.message.includes('未找到验证码邮件')) {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取验证码失败:', error);
    res.status(500).json({
      success: false,
      message: `获取验证码失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取所有Infini账户
 */
export const getAllInfiniAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await infiniAccountService.getAllInfiniAccounts();
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取Infini账户列表失败:', error);
    res.status(500).json({
      success: false,
      message: `获取Infini账户列表失败: ${(error as Error).message}`,
    });
  }
};

/**
 * 获取单个Infini账户
 */
export const getInfiniAccountById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const response = await infiniAccountService.getInfiniAccountById(id);
    
    if (response.success) {
      res.json(response);
    } else if (response.message === '找不到指定的Infini账户') {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取Infini账户失败:', error);
    res.status(500).json({
      success: false,
      message: `获取Infini账户失败: ${(error as Error).message}`,
    });
  }
};

/**
 * 登录Infini并获取账户信息
 * 用于测试登录凭据和获取账户信息，但不保存到数据库
 */
export const loginInfiniAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as InfiniAccountCreate;
    
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: '邮箱和密码是必填项',
      });
      return;
    }
    
    const response = await infiniAccountService.loginInfiniAccount(email, password);
    
    if (response.success) {
      res.json(response);
    } else if (response.message && response.message.includes('Infini登录失败')) {
      res.status(400).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('Infini登录失败:', error);
    res.status(500).json({
      success: false,
      message: `Infini登录失败: ${(error as Error).message}`,
    });
  }
};

/**
 * 创建Infini账户
 * 登录后保存账户信息到数据库
 */
export const createInfiniAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, mock_user_id } = req.body as InfiniAccountCreate;
    
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: '邮箱和密码是必填项',
      });
      return;
    }
    
    const response = await infiniAccountService.createInfiniAccount(email, password, mock_user_id);
    
    if (response.success) {
      res.status(201).json(response);
    } else if (response.message && (response.message.includes('该邮箱已经添加过Infini账户') || response.message.includes('Infini登录失败'))) {
      res.status(400).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('创建Infini账户失败:', error);
    res.status(500).json({
      success: false,
      message: `创建Infini账户失败: ${(error as Error).message}`,
    });
  }
};

/**
 * 同步Infini账户信息
 */
export const syncInfiniAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const response = await infiniAccountService.syncInfiniAccount(id);
    
    if (response.success) {
      res.json(response);
    } else if (response.message === '找不到指定的Infini账户') {
      res.status(404).json(response);
    } else if (response.message && response.message.includes('同步失败，Infini登录失败')) {
      res.status(400).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('同步Infini账户失败:', error);
    res.status(500).json({
      success: false,
      message: `同步Infini账户失败: ${(error as Error).message}`,
    });
  }
};

/**
 * 更新Infini账户信息
 */
export const updateInfiniAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const response = await infiniAccountService.updateInfiniAccount(id, updateData);
    
    if (response.success) {
      res.json(response);
    } else if (response.message === '找不到指定的Infini账户') {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('更新Infini账户失败:', error);
    res.status(500).json({
      success: false,
      message: `更新Infini账户失败: ${(error as Error).message}`,
    });
  }
};

/**
 * 提交护照KYC验证
 */
export const submitPassportKyc = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      accountId,
      phoneNumber,
      phoneCode,
      firstName,
      lastName,
      country,
      passportNumber,
      fileName
    } = req.body;
    
    if (!accountId) {
      res.status(400).json({
        success: false,
        message: '账户ID是必填项'
      });
      return;
    }
    
    // 验证必要的护照数据
    if (!phoneNumber || !phoneCode || !firstName || !lastName || !country || !passportNumber || !fileName) {
      res.status(400).json({
        success: false,
        message: '所有护照KYC信息字段均为必填项'
      });
      return;
    }
    
    console.log(`接收到护照KYC验证请求，账户ID: ${accountId}, 姓名: ${firstName} ${lastName}, 国家: ${country}`);
    
    // 调用服务层方法提交护照KYC数据
    const response = await infiniAccountService.submitPassportKyc(accountId, {
      phoneNumber,
      phoneCode,
      firstName,
      lastName,
      country,
      passportNumber,
      fileName
    });
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('提交护照KYC验证失败:', error);
    res.status(500).json({
      success: false,
      message: `提交护照KYC验证失败: ${(error as Error).message}`
    });
  }
};

/**
 * 删除Infini账户
 */
export const deleteInfiniAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const response = await infiniAccountService.deleteInfiniAccount(id);
    
    if (response.success) {
      res.json(response);
    } else if (response.message === '找不到指定的Infini账户') {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('删除Infini账户失败:', error);
    res.status(500).json({
      success: false,
      message: `删除Infini账户失败: ${(error as Error).message}`,
    });
  }
};

/**
 * 批量同步所有Infini账户信息
 */
export const syncAllInfiniAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await infiniAccountService.syncAllInfiniAccounts();
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('批量同步Infini账户失败:', error);
    res.status(500).json({
      success: false,
      message: `批量同步Infini账户失败: ${(error as Error).message}`,
    });
  }
};

/**
 * 批量同步所有Infini账户KYC信息
 * 已完成KYC状态的账户会被跳过同步
 */
export const syncAllInfiniAccountsKyc = async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await infiniAccountService.syncAllKycInformation();
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('批量同步Infini账户KYC信息失败:', error);
    res.status(500).json({
      success: false,
      message: `批量同步Infini账户KYC信息失败: ${(error as Error).message}`,
    });
  }
};

/**
 * 获取KYC信息
 * 先从数据库查询，如果没有记录再调用API获取并保存
 */
export const getKycInformation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;
    
    if (!accountId) {
      res.status(400).json({
        success: false,
        message: '账户ID是必填项'
      });
      return;
    }
    
    console.log(`接收到获取KYC信息请求，账户ID: ${accountId}`);
    
    // 调用服务层方法获取KYC信息
    const response = await infiniAccountService.getKycInformation(accountId);
    
    if (response.success) {
      res.json(response);
    } else if (response.message && response.message.includes('找不到指定的Infini账户')) {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取KYC信息失败:', error);
    res.status(500).json({
      success: false,
      message: `获取KYC信息失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取用户基本信息
 * 调用Infini API获取用户基本认证信息
 */
export const getBasicInformation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;
    
    if (!accountId) {
      res.status(400).json({
        success: false,
        message: '账户ID是必填项'
      });
      return;
    }
    
    console.log(`接收到获取基本信息请求，账户ID: ${accountId}`);
    
    // 调用服务层方法获取基本信息
    const response = await infiniAccountService.getBasicInformation(accountId);
    
    if (response.success) {
      res.json(response);
    } else if (response.message && response.message.includes('找不到指定的Infini账户')) {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取基本信息失败:', error);
    res.status(500).json({
      success: false,
      message: `获取基本信息失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取开卡金额
 */
export const getCardPrice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;
    const { cardType } = req.query;
    
    if (!accountId) {
      res.status(400).json({
        success: false,
        message: '账户ID是必填项'
      });
      return;
    }
    
    console.log(`接收到获取开卡金额请求，账户ID: ${accountId}, 卡片类型: ${cardType || '3'}`);
    
    // 调用服务层方法获取开卡金额
    const response = await infiniAccountService.getCardPrice(accountId, cardType as string);
    
    if (response.success) {
      res.json(response);
    } else if (response.message && response.message.includes('找不到指定的Infini账户')) {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取开卡金额失败:', error);
    res.status(500).json({
      success: false,
      message: `获取开卡金额失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取可用的卡类型
 */
export const getAvailableCardTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;
    
    if (!accountId) {
      res.status(400).json({
        success: false,
        message: '账户ID是必填项'
      });
      return;
    }
    
    console.log(`接收到获取可用卡类型请求，账户ID: ${accountId}`);
    
    // 调用服务层方法获取可用卡类型
    const response = await infiniAccountService.getAvailableCardTypes(accountId);
    
    if (response.success) {
      res.json(response);
    } else if (response.message && response.message.includes('找不到指定的Infini账户')) {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取可用卡类型失败:', error);
    res.status(500).json({
      success: false,
      message: `获取可用卡类型失败: ${(error as Error).message}`
    });
  }
};

/**
 * 创建卡
 */
export const createCard = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;
    const { cardType } = req.body;
    
    if (!accountId) {
      res.status(400).json({
        success: false,
        message: '账户ID是必填项'
      });
      return;
    }
    
    console.log(`接收到创建卡请求，账户ID: ${accountId}, 卡片类型: ${cardType || 3}`);
    
    // 将cardType转换为数字
    const cardTypeNumber = cardType ? parseInt(cardType.toString(), 10) : 3;
    
    // 调用服务层方法创建卡
    const response = await infiniAccountService.createCard(accountId, cardTypeNumber);
    
    if (response.success) {
      res.json(response);
    } else if (response.message && response.message.includes('找不到指定的Infini账户')) {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('创建卡失败:', error);
    res.status(500).json({
      success: false,
      message: `创建卡失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取卡片列表
 */
export const getCardList = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountId } = req.params;
    
    if (!accountId) {
      res.status(400).json({
        success: false,
        message: '账户ID是必填项'
      });
      return;
    }
    
    console.log(`接收到获取卡片列表请求，账户ID: ${accountId}`);
    
    // 调用服务层方法获取卡片列表
    const response = await infiniAccountService.getCardList(accountId);
    
    if (response.success) {
      res.json(response);
    } else if (response.message && response.message.includes('找不到指定的Infini账户')) {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取卡片列表失败:', error);
    res.status(500).json({
      success: false,
      message: `获取卡片列表失败: ${(error as Error).message}`
    });
  }
};

/**
 * 更新2FA信息
 * @param req 请求对象
 * @param res 响应对象
 */
export const update2faInfo = async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const { qr_code_url, secret_key, recovery_codes } = req.body;

    console.log(`接收到更新2FA信息请求，账户ID: ${accountId}`);

    // 验证参数
    if (!accountId) {
      return res.status(400).json({
        success: false,
        message: '账户ID不能为空'
      });
    }

    // 调用服务方法更新2FA信息
    const result = await infiniAccountService.update2faInfo(accountId, {
      qr_code_url,
      secret_key,
      recovery_codes
    });

    // 返回结果
    if (result.success) {
      return res.json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('更新2FA信息失败:', error);
    return res.status(500).json({
      success: false,
      message: `更新2FA信息失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取所有账户分组
 */
export const getAllAccountGroups = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('接收到获取所有账户分组请求');
    
    const response = await infiniAccountService.getAllAccountGroups();
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取账户分组列表失败:', error);
    res.status(500).json({
      success: false,
      message: `获取账户分组列表失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取单个账户分组
 */
export const getAccountGroupById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    console.log(`接收到获取单个账户分组请求，分组ID: ${id}`);
    
    const response = await infiniAccountService.getAccountGroupById(id);
    
    if (response.success) {
      res.json(response);
    } else if (response.message === '找不到指定的账户分组') {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取账户分组失败:', error);
    res.status(500).json({
      success: false,
      message: `获取账户分组失败: ${(error as Error).message}`
    });
  }
};

/**
 * 创建账户分组
 */
export const createAccountGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = req.body;
    
    if (!name || name.trim() === '') {
      res.status(400).json({
        success: false,
        message: '分组名称不能为空'
      });
      return;
    }
    
    console.log(`接收到创建账户分组请求，名称: ${name}`);
    
    const response = await infiniAccountService.createAccountGroup({ name, description });
    
    if (response.success) {
      res.status(201).json(response);
    } else if (response.message === '分组名称已存在') {
      res.status(400).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('创建账户分组失败:', error);
    res.status(500).json({
      success: false,
      message: `创建账户分组失败: ${(error as Error).message}`
    });
  }
};

/**
 * 更新账户分组
 */
export const updateAccountGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    console.log(`接收到更新账户分组请求，分组ID: ${id}`);
    
    const response = await infiniAccountService.updateAccountGroup(id, { name, description });
    
    if (response.success) {
      res.json(response);
    } else if (response.message === '找不到指定的账户分组') {
      res.status(404).json(response);
    } else if (response.message === '分组名称已存在' || response.message === '不允许修改默认分组的名称') {
      res.status(400).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('更新账户分组失败:', error);
    res.status(500).json({
      success: false,
      message: `更新账户分组失败: ${(error as Error).message}`
    });
  }
};

/**
 * 删除账户分组
 */
export const deleteAccountGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    console.log(`接收到删除账户分组请求，分组ID: ${id}`);
    
    const response = await infiniAccountService.deleteAccountGroup(id);
    
    if (response.success) {
      res.json(response);
    } else if (response.message === '找不到指定的账户分组') {
      res.status(404).json(response);
    } else if (response.message === '不允许删除默认分组' || response.message === '找不到默认分组，无法删除当前分组') {
      res.status(400).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('删除账户分组失败:', error);
    res.status(500).json({
      success: false,
      message: `删除账户分组失败: ${(error as Error).message}`
    });
  }
};

/**
 * 添加账户到分组
 */
export const addAccountToGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { groupId, accountId } = req.body;
    
    if (!groupId || !accountId) {
      res.status(400).json({
        success: false,
        message: '分组ID和账户ID均不能为空'
      });
      return;
    }
    
    console.log(`接收到添加账户到分组请求，分组ID: ${groupId}, 账户ID: ${accountId}`);
    
    const response = await infiniAccountService.addAccountToGroup(groupId, accountId);
    
    if (response.success) {
      res.json(response);
    } else if (response.message === '找不到指定的账户分组' || response.message === '找不到指定的Infini账户') {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('添加账户到分组失败:', error);
    res.status(500).json({
      success: false,
      message: `添加账户到分组失败: ${(error as Error).message}`
    });
  }
};

/**
 * 批量添加账户到分组
 */
export const addAccountsToGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { groupId, accountIds } = req.body;
    
    if (!groupId || !accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      res.status(400).json({
        success: false,
        message: '分组ID和账户ID列表均不能为空'
      });
      return;
    }
    
    console.log(`接收到批量添加账户到分组请求，分组ID: ${groupId}, 账户数量: ${accountIds.length}`);
    
    const response = await infiniAccountService.addAccountsToGroup(groupId, accountIds);
    
    if (response.success) {
      res.json(response);
    } else if (response.message === '找不到指定的账户分组') {
      res.status(404).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('批量添加账户到分组失败:', error);
    res.status(500).json({
      success: false,
      message: `批量添加账户到分组失败: ${(error as Error).message}`
    });
  }
};

/**
 * 从分组中移除账户
 */
export const removeAccountFromGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { groupId, accountId } = req.body;
    
    if (!groupId || !accountId) {
      res.status(400).json({
        success: false,
        message: '分组ID和账户ID均不能为空'
      });
      return;
    }
    
    console.log(`接收到从分组中移除账户请求，分组ID: ${groupId}, 账户ID: ${accountId}`);
    
    const response = await infiniAccountService.removeAccountFromGroup(groupId, accountId);
    
    if (response.success) {
      res.json(response);
    } else if (response.message === '找不到指定的账户分组' || response.message === '找不到指定的Infini账户') {
      res.status(404).json(response);
    } else if (response.message === '不能从默认分组中移除账户，除非该账户同时属于其他分组') {
      res.status(400).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('从分组中移除账户失败:', error);
    res.status(500).json({
      success: false,
      message: `从分组中移除账户失败: ${(error as Error).message}`
    });
  }
};

/**
 * 一键式账户设置
 * 自动执行用户注册、2FA认证、KYC验证和开卡流程
 */
export const oneClickAccountSetup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { setupOptions, userData } = req.body;
    
    // 验证必要的参数
    if (!setupOptions || !userData) {
      res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
      return;
    }
    // 根据main_email查询主邮箱
    const mainEmail = await db('email_accounts')
      .where('id', userData.main_email)
      .first();
    if (!mainEmail) {
      res.status(400).json({
        success: false,
        message: '主邮箱不存在'
      });
      return;
    }
    
    console.log(`接收到一键式账户设置请求，选项:`, setupOptions);
    
    // 创建随机用户
    const randomUserService = new RandomUserService();
    const randomUserResponse = await randomUserService.generateRandomUsers({ 
      email_suffix: mainEmail.domain_name, 
      count: 1 
    });
    
    if (!randomUserResponse.success) {
      res.status(500).json({
        success: false,
        message: `生成随机用户失败: ${randomUserResponse.message}`
      });
      return;
    }
    
    const randomUser = randomUserResponse.data[0];
    console.log(`成功生成随机用户: ${randomUser.email_prefix}@${userData.email_suffix || 'example.com'}`);
    
    // 注册Infini账户
    let email = randomUser.full_email || `${randomUser.email_prefix}@${userData.email_suffix || 'example.com'}`;
    let password = randomUser.password;
    
    // 先发送验证码
    console.log(`发送验证码到邮箱: ${email}`);
    const sendCodeResponse = await infiniAccountService.sendVerificationCode(email, 0); // 0表示注册验证码
    if (!sendCodeResponse.success) {
      res.status(500).json({
        success: false,
        message: `发送验证码失败: ${sendCodeResponse.message}`,
        randomUser
      });
      return;
    }
    
    // 从邮件中获取验证码
    console.log(`尝试从邮件中获取验证码`);
    let verificationCode = '';
    try {
      // 尝试3次，每次间隔5秒，从邮件中获取验证码
      const verifyResponse = await infiniAccountService.fetchVerificationCode(email, mainEmail.email, 20, 5);
      if (verifyResponse.success && verifyResponse.data && verifyResponse.data.code) {
        verificationCode = verifyResponse.data.code;
        console.log(`成功从邮件中获取验证码: ${verificationCode}`);
      }
    } catch (error) {
      console.error('无法从邮件获取验证码，继续尝试使用sendAndWaitVerificationCode:', error);
      
      // 直接等待验证码
      try {
        const waitCodeResponse = await infiniAccountService.sendAndWaitVerificationCode(email, 0);
        if (waitCodeResponse.success && waitCodeResponse.data) {
          verificationCode = waitCodeResponse.data.code;
          console.log(`通过等待方式获取验证码成功: ${verificationCode}`);
        }
      } catch (waitError) {
        console.error('等待验证码也失败:', waitError);
      }
    }
    
    if (!verificationCode) {
      res.status(500).json({
        success: false,
        message: '无法获取验证码，注册失败',
        randomUser
      });
      return;
    }
    
    // 使用验证码注册账户
    console.log(`使用验证码 ${verificationCode} 注册账户: ${email}`);
    
    // 获取邀请码
    const invitationCode = userData.invitation_code || 'TC7MLI9';
    console.log(`使用邀请码 ${invitationCode} 注册账户`);
    
    // 直接调用Infini注册API
    try {
      const registerResponse = await httpClient.post(
        `${process.env.INFINI_API_BASE_URL || 'https://api-card.infini.money'}/user/registration/email`,
        { 
          email, 
          password, 
          verification_code: verificationCode,
          invitation_code: invitationCode // 使用传入的邀请码
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
            'Referer': 'https://app.infini.money/',
            'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"macOS"',
            'accept': 'application/json, text/plain, */*',
            'accept-language': 'zh-CN,zh;q=0.9',
            'origin': 'http://localhost:33202',
            'priority': 'u=1, i'
          }
        }
      );
      
      if (registerResponse.data.code !== 0) {
        res.status(500).json({
          success: false,
          message: `注册Infini账户失败: ${registerResponse.data.message || '未知错误'}`,
          randomUser
        });
        return;
      }
      
      console.log('注册API响应成功:', registerResponse.data);
    } catch (error) {
      console.error('调用注册API失败:', error);
      res.status(500).json({
        success: false,
        message: `调用注册API失败: ${(error as Error).message}`,
        randomUser
      });
      return;
    }
    
    // 注册成功后，创建账户记录
    console.log(`注册成功，创建账户记录`);
    const accountResponse = await infiniAccountService.createInfiniAccount(email, password, randomUser.id);
    
    if (!accountResponse.success) {
      res.status(500).json({
        success: false,
        message: `创建Infini账户失败: ${accountResponse.message}`,
        randomUser
      });
      return;
    }
    
    const accountId = accountResponse.data.id;
    console.log(`成功创建Infini账户, ID: ${accountId}`);
    
    // 如果提供了分组ID，将账户添加到分组
    if (userData.group_id) {
      try {
        console.log(`尝试将账户添加到分组, 账户ID: ${accountId}, 分组ID: ${userData.group_id}`);
        const groupResponse = await infiniAccountService.addAccountToGroup(userData.group_id, accountId);
        
        if (groupResponse.success) {
          console.log(`成功将账户添加到分组, 分组ID: ${userData.group_id}`);
        } else {
          console.error(`将账户添加到分组失败: ${groupResponse.message}`);
        }
      } catch (groupError) {
        console.error('将账户添加到分组时出错:', groupError);
        // 不因分组关联失败而中断整个流程
      }
    }
    
    const results: any = {
      success: true,
      accountId,
      randomUser,
      account: accountResponse.data,
      steps: {
        register: { success: true }
      }
    };
    
    // 根据选项执行后续步骤
    
    // 自动2FA绑定
    if (setupOptions.enable2fa) {
      console.log(`开始执行2FA绑定步骤, 账户ID: ${accountId}`);
      const twoFaResponse = await setupTwoFactorAuth(accountId, email);
      results.steps.twoFa = twoFaResponse;
      
      if (!twoFaResponse.success) {
        // 继续执行后续步骤，但记录失败信息
        console.error(`2FA设置失败: ${twoFaResponse.message}`);
      }
    }
    // 自动开卡
    if (setupOptions.enableCard) {
      console.log(`开始执行开卡步骤, 账户ID: ${accountId}`);
      const cardResponse = await setupCard(accountId, setupOptions.cardType,true);
      results.steps.card = cardResponse;
      
      if (!cardResponse.success) {
        // 记录失败信息
        console.error(`开卡失败: ${cardResponse.message}`);
      }
    }

    // 自动KYC验证
    if (setupOptions.enableKyc) {
      console.log(`开始执行KYC验证步骤, 账户ID: ${accountId}`);
      const kycResponse = await setupKycVerification(accountId, randomUser);
      results.steps.kyc = kycResponse;
      
      if (!kycResponse.success) {
        // 继续执行后续步骤，但记录失败信息
        console.error(`KYC验证失败: ${kycResponse.message}`);
      }
    }
    

    
    // 返回所有步骤的执行结果
    res.status(201).json(results);
    
  } catch (error) {
    console.error('一键式账户设置失败:', error);
    res.status(500).json({
      success: false,
      message: `一键式账户设置失败: ${(error as Error).message}`
    });
  }
};

/**
 * 设置2FA认证
 * @param accountId Infini账户ID
 * @param email 账户邮箱
 */
async function setupTwoFactorAuth(accountId: string, email: string): Promise<any> {
  try {
    // 1. 获取2FA二维码
    const qrcodeResponse = await infiniAccountService.getGoogle2faQrcode(accountId);
    if (!qrcodeResponse.success) {
      return {
        success: false,
        message: `获取2FA二维码失败: ${qrcodeResponse.message}`
      };
    }
    
    const qrCodeData = qrcodeResponse.data;
    
    // 2. 解析二维码URL获取密钥
    const totpUrl = qrCodeData.qr_code;
    const secretKey=qrCodeData.secret_key;
    // 检查totpUrl是否存在
    if (!totpUrl) {
      console.error('2FA二维码URL为空或无效');
      return {
        success: false,
        message: '2FA二维码URL为空或无效'
      };
    }
    
    if(!secretKey){
        return {
          success: false,
          message: '无法从2FA二维码URL中提取密钥'
        };
    }
    console.log(`成功保存2FA信息到数据库`);
    // 4. 发送2FA验证邮件
    const emailResponse = await infiniAccountService.sendGoogle2faVerificationEmail(email, accountId, 6);
    if (!emailResponse.success) {
      return {
        success: false,
        message: `发送2FA验证邮件失败: ${emailResponse.message}`
      };
    }
    console.log(`成功发送2FA验证邮件到: ${email}`);
    
    // 5. 使用TotpToolService生成验证码
    const totpToolService = new TotpToolService();
    const totpResponse = await totpToolService.generateTotpCode(secretKey);
    if (!totpResponse.success) {
      return {
        success: false,
        message: `生成TOTP验证码失败: ${totpResponse.message}`
      };
    }
    
    const totpCode = totpResponse.data.code;
    console.log(`成功生成TOTP验证码: ${totpCode}`);
    
    // 6. 尝试从邮件中获取验证码
    let verificationCode = '';
    try {
      const verifyResponse = await infiniAccountService.fetchVerificationCode(email, '', 3, 5);
      if (verifyResponse.success && verifyResponse.data && verifyResponse.data.code) {
        verificationCode = verifyResponse.data.code;
        console.log(`成功从邮件中获取验证码: ${verificationCode}`);
      }
    } catch (error) {
      console.error('无法从邮件获取验证码，使用默认验证码:', error);
      // 使用默认值，主要是为了演示，实际应该从邮件中获取或用更可靠的方式
      verificationCode = '000000';
    }
    
    if (!verificationCode) {
      return {
        success: false,
        message: '无法获取2FA验证邮件中的验证码'
      };
    }
    
    // 7. 绑定2FA
    const bindResponse = await infiniAccountService.bindGoogle2fa(verificationCode, totpCode, accountId);
    console.log(`2FA绑定结果:`, bindResponse);
    
    return {
      success: bindResponse.success,
      message: bindResponse.message || '2FA绑定完成',
      data: {
        secretKey,
        qrCodeUrl: totpUrl,
        recoveryCode: qrCodeData.recovery_codes || []
      }
    };
  } catch (error) {
    console.error('设置2FA认证失败:', error);
    return {
      success: false,
      message: `设置2FA认证失败: ${(error as Error).message}`
    };
  }
}

/**
 * 设置KYC验证
 * @param accountId Infini账户ID
 * @param randomUser 随机用户数据
 */
async function setupKycVerification(accountId: string, randomUser: any): Promise<any> {
  try {
    // 1. 获取随机KYC图片
    try {
      // 获取随机KYC图片,从数据库获取
      // 使用dbHelper中的兼容函数确保跨MySQL/SQLite兼容
      const kycQuery = db('kyc_images');
      const kycImageData = await randomOrderBy(kycQuery).limit(1).first();
      
      if (!kycImageData) {
        throw new Error('数据库中没有可用的KYC图片');
      }
      
      const kycImage = kycImageData.img_base64;
      console.log(`成功获取随机KYC图片, ID: ${kycImageData.id}`);
      
      // 2. 上传KYC图片
      // 将base64转换为Buffer
      let imageData = kycImage || kycImage.base64;
      if (!kycImage) {
        return {
          success: false,
          message: '无效的KYC图片数据'
        };
      }
      
      // 如果base64字符串包含前缀，需要移除
      if (imageData.includes('base64,')) {
        imageData = imageData.split('base64,')[1];
      }
      
      const imageBuffer = Buffer.from(imageData, 'base64');
      
      // 上传图片
      const uploadResponse = await infiniAccountService.uploadKycImage(
        accountId,
        imageBuffer,
        `kyc_image_${kycImage.id || Date.now()}.jpg`
      );
      
      if (!uploadResponse.success) {
        return {
          success: false,
          message: `上传KYC图片失败: ${uploadResponse.message}`
        };
      }
      
      const fileName = uploadResponse.data.file_name;
      console.log(`成功上传KYC图片, 文件名: ${fileName}`);
      
      // 提取电话号码信息
      let phoneCode = '+1';
      let phoneNumber = '';
      
      if (randomUser.phone) {
        const phoneRegex = /^(\+\d+)\s+(.+)$/;
        const match = randomUser.phone.match(phoneRegex);
        
        if (match) {
          phoneCode = match[1];
          phoneNumber = match[2];
        } else {
          phoneNumber = randomUser.phone;
        }
      }
      
      // 3. 提交护照KYC信息
      const kycData = {
        phoneNumber: phoneNumber,
        phoneCode: phoneCode,
        firstName: randomUser.first_name,
        lastName: randomUser.last_name,
        country: 'CHN', // 默认值
        passportNumber: randomUser.passport_no,
        fileName: fileName
      };
      
      console.log(`提交护照KYC信息:`, kycData);
      const kycResponse = await infiniAccountService.submitPassportKyc(accountId, kycData);
      console.log(`KYC提交结果:`, kycResponse);
      
      return {
        success: kycResponse.success,
        message: kycResponse.message || 'KYC验证完成',
        data: kycResponse.data
      };
      
    } catch (fetchError) {
      console.error('KYC图片获取失败:', fetchError);
      
      // 即使无法获取随机KYC图片，也尝试提交一个默认的KYC信息
      console.log('使用默认KYC信息继续流程');
      
      try {
        // 提取电话号码信息
        let phoneCode = '+1';
        let phoneNumber = '1234567890'; // 默认电话号码
        
        if (randomUser.phone) {
          const phoneRegex = /^(\+\d+)\s+(.+)$/;
          const match = randomUser.phone.match(phoneRegex);
          
          if (match) {
            phoneCode = match[1];
            phoneNumber = match[2];
          } else {
            phoneNumber = randomUser.phone;
          }
        }
        
        // 提交护照KYC信息，不上传图片
        const kycData = {
          phoneNumber: phoneNumber,
          phoneCode: phoneCode,
          firstName: randomUser.first_name || 'Default',
          lastName: randomUser.last_name || 'User',
          country: 'CHN', // 默认值
          passportNumber: randomUser.passport_no || 'P12345678',
          fileName: `default_kyc_${Date.now()}.jpg` // 默认文件名
        };
        
        console.log(`提交默认护照KYC信息:`, kycData);
        const kycResponse = await infiniAccountService.submitPassportKyc(accountId, kycData);
        console.log(`KYC提交结果:`, kycResponse);
        
        return {
          success: kycResponse.success,
          message: kycResponse.message || 'KYC验证完成(使用默认信息)',
          data: kycResponse.data
        };
      } catch (kycError) {
        console.error('使用默认KYC信息也失败:', kycError);
        return {
          success: false,
          message: `设置KYC验证失败: ${(fetchError as Error).message}, 使用默认信息也失败: ${(kycError as Error).message}`
        };
      }
    }
  } catch (error) {
    console.error('设置KYC验证失败:', error);
    return {
      success: false,
      message: `设置KYC验证失败: ${(error as Error).message}`
    };
  }
}

/**
 * 设置开卡
 * @param accountId Infini账户ID
 * @param cardType 卡片类型
 */
async function setupCard(accountId: string, cardType: number = 3,allowFlushMockUser:boolean = false): Promise<any> {
  try {
    // 获取可用卡类型
    const cardTypesResponse = await infiniAccountService.getAvailableCardTypes(accountId);
    if (!cardTypesResponse.success) {
      return {
        success: false,
        message: `获取可用卡类型失败: ${cardTypesResponse.message}`
      };
    }
    
    // 检查请求的卡类型是否可用
    const availableCardTypes = cardTypesResponse.data?.cardTypes || [];
    console.log(`可用卡类型:`, availableCardTypes);
    
    if (!availableCardTypes.includes(cardType)) {
      // 使用第一个可用的卡类型
      if (availableCardTypes.length > 0) {
        cardType = availableCardTypes[0];
        console.log(`请求的卡类型不可用，使用第一个可用的卡类型: ${cardType}`);
      } else {
        return {
          success: false,
          message: '没有可用的卡类型'
        };
      }
    }
    
    // 创建卡片
    console.log(`开始创建卡片，类型: ${cardType}`);
    const cardResponse = await infiniAccountService.createCard(accountId, cardType,true);
    console.log(`卡片创建结果:`, cardResponse);
    
    return {
      success: cardResponse.success,
      message: cardResponse.message || '开卡完成',
      data: cardResponse.data
    };
  } catch (error) {
    console.error('设置开卡失败:', error);
    return {
      success: false,
      message: `设置开卡失败: ${(error as Error).message}`
    };
  }
}

/**
 * 批量从分组中移除账户
 */
export const removeAccountsFromGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { groupId, accountIds } = req.body;
    
    if (!groupId || !accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      res.status(400).json({
        success: false,
        message: '分组ID和账户ID列表均不能为空'
      });
      return;
    }
    
    console.log(`接收到批量从分组中移除账户请求，分组ID: ${groupId}, 账户数量: ${accountIds.length}`);
    
    const response = await infiniAccountService.removeAccountsFromGroup(groupId, accountIds);
    
    if (response.success) {
      res.json(response);
    } else if (response.message === '找不到指定的账户分组') {
      res.status(404).json(response);
    } else if (response.message && response.message.includes('不能从默认分组中移除')) {
      res.status(400).json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('批量从分组中移除账户失败:', error);
    res.status(500).json({
      success: false,
      message: `批量从分组中移除账户失败: ${(error as Error).message}`
    });
  }
};

/**
 * 获取分页的Infini账户列表
 * 支持分页、筛选和排序功能
 */
export const getPaginatedInfiniAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    // 获取查询参数
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 10;
    
    // 处理筛选条件
    let filters = {};
    if (req.query.filters) {
      try {
        filters = JSON.parse(req.query.filters as string);
      } catch (e) {
        console.warn('解析筛选条件失败:', e);
      }
    }
    
    // 处理排序参数
    const sortField = req.query.sortField as string;
    const sortOrder = req.query.sortOrder as 'asc' | 'desc';
    
    // 分组ID参数
    const groupId = req.query.groupId as string;
    
    console.log(`接收到获取分页Infini账户列表请求，页码: ${page}, 每页记录数: ${pageSize}, 排序字段: ${sortField || '无'}, 排序方向: ${sortOrder || '无'}, 分组ID: ${groupId || '无'}`);
    
    // 调用服务层方法
    const service = new InfiniAccountService();
    const response = await service.getInfiniAccountsPaginated(
      page,
      pageSize,
      filters,
      sortField,
      sortOrder,
      groupId
    );
    
    if (response.success) {
      res.json(response);
    } else {
      res.status(500).json(response);
    }
  } catch (error) {
    console.error('获取分页Infini账户列表失败:', error);
    res.status(500).json({
      success: false,
      message: `获取分页Infini账户列表失败: ${(error as Error).message}`
    });
  }
};