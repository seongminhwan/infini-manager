/**
 * Infini账户控制器
 * 用于管理Infini账户信息、登录和同步余额等功能
 * 业务逻辑已抽离到InfiniAccountService服务类
 */
import { Request, Response } from 'express';
import multer from 'multer';
import { InfiniAccountService } from '../service/InfiniAccountService';
import { InfiniAccountCreate } from '../types';

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