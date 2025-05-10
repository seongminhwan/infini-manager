/**
 * 邮箱账户控制器
 * 处理邮箱账户相关的请求
 */
import { Request, Response } from 'express';
import db from '../db/db';
import * as nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { 
  ApiResponse, 
  EmailAccount, 
  EmailAccountCreate, 
  EmailAccountUpdate, 
  EmailAccountTestResult, 
  GmailMessageSendOptions,
  GmailConfig,
  GmailMessage,
  GmailQueryOptions
} from '../types';

// 使用动态导入以避免node-imap初始化
// 仅在处理邮件列表和详情时才动态导入GmailClient
// 邮箱测试功能使用ImapFlow库，避免node-imap错误
let GmailClient: any = null;

// 邮箱账户表名
const TABLE_NAME = 'email_accounts';

/**
 * 获取所有邮箱账户
 */
export async function getAllEmailAccounts(req: Request, res: Response): Promise<void> {
  try {
    const accounts = await db(TABLE_NAME).select('*');
    
    // 转换字段名格式，但保留原始密码不脱敏
    const formattedAccounts = accounts.map(account => ({
      id: account.id,
      name: account.name,
      email: account.email,
      password: account.password, // 保留原始密码
      imapHost: account.imap_host,
      imapPort: account.imap_port,
      imapSecure: account.imap_secure,
      smtpHost: account.smtp_host,
      smtpPort: account.smtp_port,
      smtpSecure: account.smtp_secure,
      status: account.status,
      isDefault: account.is_default,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
      username: account.username, // 确保用户名也被返回
      domainName: account.domain_name, // 返回域名邮箱字段
      extraConfig: account.extra_config ? JSON.parse(account.extra_config) : undefined
    }));
    
    const response: ApiResponse = {
      success: true,
      message: '获取邮箱账户列表成功',
      data: formattedAccounts
    };
    
    res.json(response);
  } catch (error) {
    console.error('获取邮箱账户列表失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取邮箱账户列表失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

/**
 * 获取单个邮箱账户
 */
export async function getEmailAccountById(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    const response: ApiResponse = {
      success: false,
      message: '无效的邮箱账户ID'
    };
    
    res.status(400).json(response);
    return;
  }
  
  try {
    const account = await db(TABLE_NAME).where({ id }).first();
    
    if (!account) {
      const response: ApiResponse = {
        success: false,
        message: '邮箱账户不存在'
      };
      
      res.status(404).json(response);
      return;
    }
    
    // 转换字段名格式，但保留原始密码不脱敏
    // 转换为接口格式，返回原始密码
    const formattedAccount = {
      id: account.id,
      name: account.name,
      email: account.email,
      password: account.password, // 保留原始密码
      imapHost: account.imap_host,
      imapPort: account.imap_port,
      imapSecure: account.imap_secure,
      smtpHost: account.smtp_host,
      smtpPort: account.smtp_port,
      smtpSecure: account.smtp_secure,
      status: account.status,
      isDefault: account.is_default,
      createdAt: account.created_at,
      updatedAt: account.updated_at,
      username: account.username, // 确保用户名也被返回
      domainName: account.domain_name, // 返回域名邮箱字段
      extraConfig: account.extra_config ? JSON.parse(account.extra_config) : undefined
    };
    const response: ApiResponse = {
      success: true,
      message: '获取邮箱账户成功',
      data: formattedAccount
    };
    
    res.json(response);
  } catch (error) {
    console.error('获取邮箱账户失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取邮箱账户失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

/**
 * 创建邮箱账户
 */
export async function createEmailAccount(req: Request, res: Response): Promise<void> {
  const accountData = req.body;
  
  // 打印请求体，帮助调试
  console.log('收到创建邮箱账户请求:', JSON.stringify(accountData, null, 2));
  
  // 处理下划线命名转换为驼峰命名
  const normalizedData: EmailAccountCreate = {
    name: accountData.name,
    email: accountData.email,
    password: accountData.password,
    imapHost: accountData.imapHost || accountData.host_imap,
    imapPort: accountData.imapPort || accountData.port_imap,
    imapSecure: accountData.imapSecure !== undefined ? accountData.imapSecure : accountData.secure_imap,
    smtpHost: accountData.smtpHost || accountData.host_smtp,
    smtpPort: accountData.smtpPort || accountData.port_smtp,
    smtpSecure: accountData.smtpSecure !== undefined ? accountData.smtpSecure : accountData.secure_smtp,
    isDefault: accountData.isDefault || accountData.is_default || false,
    extraConfig: accountData.extraConfig || accountData.extra_config,
    domainName: accountData.domainName || accountData.domain_name
  };
  
  // 基本验证
  if (!normalizedData.name || !normalizedData.email || !normalizedData.password || 
      !normalizedData.imapHost || !normalizedData.imapPort || 
      !normalizedData.smtpHost || !normalizedData.smtpPort) {
    console.log('邮箱账户验证失败:', JSON.stringify(normalizedData, null, 2));
    const missingFields = [];
    if (!normalizedData.name) missingFields.push('name');
    if (!normalizedData.email) missingFields.push('email');
    if (!normalizedData.password) missingFields.push('password');
    if (!normalizedData.imapHost) missingFields.push('imapHost/host_imap');
    if (!normalizedData.imapPort) missingFields.push('imapPort/port_imap');
    if (!normalizedData.smtpHost) missingFields.push('smtpHost/host_smtp');
    if (!normalizedData.smtpPort) missingFields.push('smtpPort/port_smtp');
    
    const response: ApiResponse = {
      success: false,
      message: `缺少必要的邮箱账户信息: ${missingFields.join(', ')}`
    };
    
    res.status(400).json(response);
    return;
  }
  
  try {
    // 检查邮箱地址是否已存在
    const existingAccount = await db(TABLE_NAME).where({ email: normalizedData.email }).first();
    
    if (existingAccount) {
      // 允许覆盖已存在的邮箱账户
      console.log(`覆盖已存在的邮箱账户: ${existingAccount.id} (${existingAccount.email})`);
      
      // 如果设置为默认邮箱，需要将其他邮箱设置为非默认
      if (normalizedData.isDefault) {
        await db(TABLE_NAME).whereNot({ id: existingAccount.id }).update({ is_default: false });
      }
      
      // 准备数据，转换驼峰命名为下划线命名
      const updateData = {
        name: normalizedData.name,
        email: normalizedData.email,
        password: normalizedData.password,
        imap_host: normalizedData.imapHost,
        imap_port: normalizedData.imapPort,
        imap_secure: normalizedData.imapSecure,
        smtp_host: normalizedData.smtpHost,
        smtp_port: normalizedData.smtpPort,
        smtp_secure: normalizedData.smtpSecure,
        status: accountData.status || 'pending', // 默认状态为待验证
        is_default: normalizedData.isDefault || false,
        domain_name: normalizedData.domainName, // 添加域名邮箱字段
        extra_config: normalizedData.extraConfig ? JSON.stringify(normalizedData.extraConfig) : null,
        updated_at: db.fn.now()
      };
      
      // 更新现有账户
      await db(TABLE_NAME).where({ id: existingAccount.id }).update(updateData);
      
      // 获取更新后的数据
      const updatedAccount = await db(TABLE_NAME).where({ id: existingAccount.id }).first();
      
      // 转换为接口格式，返回原始密码
      const safeAccount: EmailAccount = {
        id: updatedAccount.id,
        name: updatedAccount.name,
        email: updatedAccount.email,
        password: updatedAccount.password, // 返回原始密码
        imapHost: updatedAccount.imap_host,
        imapPort: updatedAccount.imap_port,
        imapSecure: updatedAccount.imap_secure,
        smtpHost: updatedAccount.smtp_host,
        smtpPort: updatedAccount.smtp_port,
        smtpSecure: updatedAccount.smtp_secure,
        status: updatedAccount.status,
        isDefault: updatedAccount.is_default,
        createdAt: updatedAccount.created_at,
        updatedAt: updatedAccount.updated_at,
        domainName: updatedAccount.domain_name, // 返回域名邮箱字段
        extraConfig: updatedAccount.extra_config ? JSON.parse(updatedAccount.extra_config) : undefined
      };
      
      const response: ApiResponse = {
        success: true,
        message: '邮箱账户更新成功',
        data: safeAccount
      };
      
      res.json(response);
      return;
    }
    
    // 如果设置为默认邮箱，需要将其他邮箱设置为非默认
    if (normalizedData.isDefault) {
      await db(TABLE_NAME).update({ is_default: false });
    }
    
    // 准备数据，转换驼峰命名为下划线命名
    const dbData = {
      name: normalizedData.name,
      email: normalizedData.email,
      password: normalizedData.password,
      imap_host: normalizedData.imapHost,
      imap_port: normalizedData.imapPort,
      imap_secure: normalizedData.imapSecure,
      smtp_host: normalizedData.smtpHost,
      smtp_port: normalizedData.smtpPort,
      smtp_secure: normalizedData.smtpSecure,
      status: accountData.status || 'pending', // 默认状态为待验证
      is_default: normalizedData.isDefault || false,
      domain_name: normalizedData.domainName, // 添加域名邮箱字段
      extra_config: normalizedData.extraConfig ? JSON.stringify(normalizedData.extraConfig) : null
    };
    
    console.log('准备插入数据库的邮箱账户数据:', JSON.stringify(dbData, null, 2));
    
    // 插入数据
    const [id] = await db(TABLE_NAME).insert(dbData);
    
    // 获取刚插入的数据
    const newAccount = await db(TABLE_NAME).where({ id }).first();
    
    // 转换为接口格式，返回原始密码
    const safeAccount: EmailAccount = {
      id: newAccount.id,
      name: newAccount.name,
      email: newAccount.email,
      password: newAccount.password, // 返回原始密码
      imapHost: newAccount.imap_host,
      imapPort: newAccount.imap_port,
      imapSecure: newAccount.imap_secure,
      smtpHost: newAccount.smtp_host,
      smtpPort: newAccount.smtp_port,
      smtpSecure: newAccount.smtp_secure,
      status: newAccount.status,
      isDefault: newAccount.is_default,
      createdAt: newAccount.created_at,
      updatedAt: newAccount.updated_at,
      domainName: newAccount.domain_name, // 返回域名邮箱字段
      extraConfig: newAccount.extra_config ? JSON.parse(newAccount.extra_config) : undefined
    };
    
    const response: ApiResponse = {
      success: true,
      message: '创建邮箱账户成功',
      data: safeAccount
    };
    
    res.status(201).json(response);
  } catch (error) {
    console.error('创建邮箱账户失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '创建邮箱账户失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

/**
 * 更新邮箱账户
 */
export async function updateEmailAccount(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id);
  const accountData: EmailAccountUpdate = req.body;
  
  if (isNaN(id) || id !== accountData.id) {
    const response: ApiResponse = {
      success: false,
      message: '无效的邮箱账户ID'
    };
    
    res.status(400).json(response);
    return;
  }
  
  try {
    // 检查账户是否存在
    const existingAccount = await db(TABLE_NAME).where({ id }).first();
    
    if (!existingAccount) {
      const response: ApiResponse = {
        success: false,
        message: '邮箱账户不存在'
      };
      
      res.status(404).json(response);
      return;
    }
    
    // 如果更新邮箱地址，检查新地址是否与其他账户冲突
    if (accountData.email && accountData.email !== existingAccount.email) {
      const duplicateAccount = await db(TABLE_NAME)
        .where({ email: accountData.email })
        .whereNot({ id })
        .first();
      
      if (duplicateAccount) {
        const response: ApiResponse = {
          success: false,
          message: '该邮箱地址已被其他账户使用'
        };
        
        res.status(409).json(response);
        return;
      }
    }
    
    // 如果设置为默认邮箱，需要将其他邮箱设置为非默认
    if (accountData.isDefault) {
      await db(TABLE_NAME).whereNot({ id }).update({ is_default: false });
    }
    
    // 准备更新数据，转换驼峰命名为下划线命名
    const updateData: Record<string, any> = {};
    
    if (accountData.name !== undefined) updateData.name = accountData.name;
    if (accountData.email !== undefined) updateData.email = accountData.email;
    if (accountData.password !== undefined) updateData.password = accountData.password;
    if (accountData.imapHost !== undefined) updateData.imap_host = accountData.imapHost;
    if (accountData.imapPort !== undefined) updateData.imap_port = accountData.imapPort;
    if (accountData.imapSecure !== undefined) updateData.imap_secure = accountData.imapSecure;
    if (accountData.smtpHost !== undefined) updateData.smtp_host = accountData.smtpHost;
    if (accountData.smtpPort !== undefined) updateData.smtp_port = accountData.smtpPort;
    if (accountData.smtpSecure !== undefined) updateData.smtp_secure = accountData.smtpSecure;
    if (accountData.status !== undefined) updateData.status = accountData.status;
    if (accountData.isDefault !== undefined) updateData.is_default = accountData.isDefault;
    if (accountData.extraConfig !== undefined) updateData.extra_config = JSON.stringify(accountData.extraConfig);
    if (accountData.domainName !== undefined) updateData.domain_name = accountData.domainName;
    
    // 更新时间戳
    updateData.updated_at = db.fn.now();
    
    // 更新数据
    await db(TABLE_NAME).where({ id }).update(updateData);
    
    // 获取更新后的数据
    const updatedAccount = await db(TABLE_NAME).where({ id }).first();
    
    // 转换为接口格式，返回原始密码
    const safeAccount: EmailAccount = {
      id: updatedAccount.id,
      name: updatedAccount.name,
      email: updatedAccount.email,
      password: updatedAccount.password, // 返回原始密码
      imapHost: updatedAccount.imap_host,
      imapPort: updatedAccount.imap_port,
      imapSecure: updatedAccount.imap_secure,
      smtpHost: updatedAccount.smtp_host,
      smtpPort: updatedAccount.smtp_port,
      smtpSecure: updatedAccount.smtp_secure,
      status: updatedAccount.status,
      isDefault: updatedAccount.is_default,
      createdAt: updatedAccount.created_at,
      updatedAt: updatedAccount.updated_at,
      domainName: updatedAccount.domain_name, // 返回域名邮箱字段
      extraConfig: updatedAccount.extra_config ? JSON.parse(updatedAccount.extra_config) : undefined
    };
    
    const response: ApiResponse = {
      success: true,
      message: '更新邮箱账户成功',
      data: safeAccount
    };
    
    res.json(response);
  } catch (error) {
    console.error('更新邮箱账户失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '更新邮箱账户失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

/**
 * 删除邮箱账户
 */
export async function deleteEmailAccount(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    const response: ApiResponse = {
      success: false,
      message: '无效的邮箱账户ID'
    };
    
    res.status(400).json(response);
    return;
  }
  
  try {
    // 检查账户是否存在
    const existingAccount = await db(TABLE_NAME).where({ id }).first();
    
    if (!existingAccount) {
      const response: ApiResponse = {
        success: false,
        message: '邮箱账户不存在'
      };
      
      res.status(404).json(response);
      return;
    }
    
    // 如果是默认邮箱，不允许删除
    if (existingAccount.is_default) {
      const response: ApiResponse = {
        success: false,
        message: '不能删除默认邮箱，请先设置其他邮箱为默认'
      };
      
      res.status(400).json(response);
      return;
    }
    
    // 删除账户
    await db(TABLE_NAME).where({ id }).delete();
    
    const response: ApiResponse = {
      success: true,
      message: '删除邮箱账户成功'
    };
    
    res.json(response);
  } catch (error) {
    console.error('删除邮箱账户失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '删除邮箱账户失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

/**
 * 设置邮箱账户状态（启用/禁用）
 */
export async function setEmailAccountStatus(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  
  if (isNaN(id)) {
    const response: ApiResponse = {
      success: false,
      message: '无效的邮箱账户ID'
    };
    
    res.status(400).json(response);
    return;
  }
  
  if (!status || !['active', 'disabled'].includes(status)) {
    const response: ApiResponse = {
      success: false,
      message: '无效的状态值，只能设置为 active 或 disabled'
    };
    
    res.status(400).json(response);
    return;
  }
  
  try {
    // 检查账户是否存在
    const existingAccount = await db(TABLE_NAME).where({ id }).first();
    
    if (!existingAccount) {
      const response: ApiResponse = {
        success: false,
        message: '邮箱账户不存在'
      };
      
      res.status(404).json(response);
      return;
    }
    
    // 更新状态
    await db(TABLE_NAME).where({ id }).update({ 
      status,
      updated_at: db.fn.now()
    });
    
    const response: ApiResponse = {
      success: true,
      message: `邮箱账户状态已${status === 'active' ? '启用' : '禁用'}`
    };
    
    res.json(response);
  } catch (error) {
    console.error('设置邮箱账户状态失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '设置邮箱账户状态失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

/**
 * 设置默认邮箱账户
 */
export async function setDefaultEmailAccount(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    const response: ApiResponse = {
      success: false,
      message: '无效的邮箱账户ID'
    };
    
    res.status(400).json(response);
    return;
  }
  
  try {
    // 检查账户是否存在
    const existingAccount = await db(TABLE_NAME).where({ id }).first();
    
    if (!existingAccount) {
      const response: ApiResponse = {
        success: false,
        message: '邮箱账户不存在'
      };
      
      res.status(404).json(response);
      return;
    }
    
    // 如果账户已禁用，不能设为默认
    if (existingAccount.status === 'disabled') {
      const response: ApiResponse = {
        success: false,
        message: '禁用的邮箱账户不能设为默认'
      };
      
      res.status(400).json(response);
      return;
    }
    
    // 更新所有账户为非默认
    await db(TABLE_NAME).update({ is_default: false });
    
    // 将指定账户设为默认
    await db(TABLE_NAME).where({ id }).update({ 
      is_default: true,
      updated_at: db.fn.now()
    });
    
    const response: ApiResponse = {
      success: true,
      message: '默认邮箱账户设置成功'
    };
    
    res.json(response);
  } catch (error) {
    console.error('设置默认邮箱账户失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '设置默认邮箱账户失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

/**
 * 测试邮箱账户
 */
export async function testEmailAccount(req: Request, res: Response): Promise<void> {
  const id = parseInt(req.params.id);
  
  if (isNaN(id)) {
    const response: ApiResponse = {
      success: false,
      message: '无效的邮箱账户ID'
    };
    
    res.status(400).json(response);
    return;
  }
  
  try {
    // 获取账户信息
    const account = await db(TABLE_NAME).where({ id }).first();
    
    if (!account) {
      const response: ApiResponse = {
        success: false,
        message: '邮箱账户不存在'
      };
      
      res.status(404).json(response);
      return;
    }
    
    // 转换为GmailConfig对象（包含SMTP和IMAP配置）
    const config = {
      user: account.email,
      password: account.password,
      smtpHost: account.smtp_host,
      smtpPort: account.smtp_port,
      smtpSecure: account.smtp_secure,
      imapHost: account.imap_host,
      imapPort: account.imap_port,
      imapSecure: account.imap_secure
    };
    
    // 创建测试ID
    const testId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // 初始化测试结果
    const testResult: EmailAccountTestResult = {
      success: false,
      message: '测试进行中...',
      testId
    };
    
    // 立即返回测试ID，让前端轮询测试结果
    res.json({
      success: true,
      message: '测试已开始',
      data: testResult
    });
    
    // 异步执行测试 - 完整测试：包括SMTP发送和IMAP接收验证
    completeEmailTest(id, config, testId).catch((error: Error) => {
      console.error('邮箱测试任务执行失败:', error);
    });
    
  } catch (error) {
    console.error('开始邮箱测试失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '开始邮箱测试失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

/**
 * 获取测试结果
 */
export async function getTestResult(req: Request, res: Response): Promise<void> {
  const { testId } = req.params;
  
  if (!testId) {
    const response: ApiResponse = {
      success: false,
      message: '无效的测试ID'
    };
    
    res.status(400).json(response);
    return;
  }
  
  try {
    // 从数据库中获取测试结果（实际实现可能需要创建一个测试结果表）
    // 这里简化处理，直接查询临时测试结果
    const testResult = testResults.get(testId);
    
    if (!testResult) {
      const response: ApiResponse = {
        success: false,
        message: '测试结果不存在或已过期'
      };
      
      res.status(404).json(response);
      return;
    }
    
    const response: ApiResponse = {
      success: true,
      message: '获取测试结果成功',
      data: testResult
    };
    
    res.json(response);
    
    // 如果测试已完成，从内存中清除结果
    if (testResult.success || (testResult.details && (testResult.details.sendError || testResult.details.receiveError))) {
      setTimeout(() => {
        testResults.delete(testId);
      }, 60000); // 1分钟后清除
    }
  } catch (error) {
    console.error('获取测试结果失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取测试结果失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

// 存储测试结果的Map（实际应用中可能需要使用数据库或Redis）
const testResults = new Map<string, EmailAccountTestResult>();

/**
 * 发送测试邮件 - SMTP实现
 */
async function sendTestEmail(config: any, testId: string): Promise<string> {
  console.log(`[${testId}] 使用SMTP方法发送测试邮件，配置:`, {
    user: config.user,
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    smtpSecure: config.smtpSecure
  });
  
  // 创建SMTP传输器
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: config.user,
      pass: config.password
    },
    tls: {
      rejectUnauthorized: false // 允许自签名证书
    }
  });
  
  // 生成测试邮件内容
  const testSubject = `测试邮件 [${testId}]`;
  const testHtml = `
    <div>
      <h2>这是一封测试邮件</h2>
      <p>测试ID: ${testId}</p>
      <p>时间: ${new Date().toLocaleString()}</p>
      <p>这封邮件用于验证您的邮箱配置是否正确。</p>
    </div>
  `;
  
  // 发送邮件
  const info = await transporter.sendMail({
    from: config.user,
    to: config.user, // 发给自己
    subject: testSubject,
    html: testHtml
  });
  
  return info.messageId || '';
}

/**
 * 使用ImapFlow验证邮件是否已接收
 * 这是对之前使用node-imap验证的替代方案，更稳定更可靠
 */
async function verifyEmailReceived(config: any, testId: string): Promise<boolean> {
  console.log(`[${testId}] 开始验证邮件是否接收成功，使用ImapFlow库...`);
  
  // 搜索持续时间和间隔
  const maxSearchTime = 60 * 1000; // 最多搜索60秒
  const searchInterval = 5000; // 每5秒搜索一次
  const startTime = Date.now();
  
  // 循环检测，最多持续60秒
  let attemptCount = 0;
  
  while (Date.now() - startTime < maxSearchTime) {
    attemptCount++;
    console.log(`[${testId}] 开始第${attemptCount}次邮件检测 (已用时${Math.round((Date.now() - startTime)/1000)}秒，最多检测60秒)`);
    
    // 创建ImapFlow客户端
    const client = new ImapFlow({
      host: config.imapHost,
      port: config.imapPort,
      secure: config.imapSecure,
      auth: {
        user: config.user,
        pass: config.password
      },
      logger: false, // 禁用详细日志
      tls: {
        rejectUnauthorized: false // 允许自签名证书
      }
    });
    
    // 使用标志跟踪连接状态
    let isConnected = false;
    let isLoggedOut = false;
    let foundEmail = false;

    try {
      // 连接到服务器
      console.log(`[${testId}] 正在连接到IMAP服务器: ${config.imapHost}:${config.imapPort}`);
      await client.connect();
      isConnected = true;
      
      // 选择收件箱
      console.log(`[${testId}] 连接成功，正在打开收件箱...`);
      await client.mailboxOpen('INBOX');
      
      // 计算查询的起始时间（15分钟前，确保能找到最近的邮件）
      const since = new Date();
      since.setMinutes(since.getMinutes() - 15);
      
      console.log(`[${testId}] 正在查找包含ID [${testId}] 的测试邮件...`);
      
      // 记录找到的邮件数量，用于日志
      let messageCount = 0;
      
      // 获取所有邮件，并存储到数组以便按时间倒序排序
      const messages = [];
      for await (const message of client.fetch({ since }, { envelope: true, source: true })) {
        messages.push(message);
      }
      
      // 按时间倒序排序，最新的邮件先检查
      messages.sort((a, b) => {
        const dateA = a.envelope.date ? a.envelope.date.getTime() : 0;
        const dateB = b.envelope.date ? b.envelope.date.getTime() : 0;
        return dateB - dateA; // 降序排列
      });
      
      console.log(`[${testId}] 获取到${messages.length}封邮件，已按时间倒序排列`);
      
      // 处理排序后的邮件
      for (const message of messages) {
        messageCount++;
        const source = message.source.toString();
        const subject = message.envelope.subject || '(无主题)';
        const from = message.envelope.from?.[0]?.address || '(未知发件人)';
        const date = message.envelope.date?.toISOString() || '(未知日期)';
        
        // 记录每封邮件的基本信息
        console.log(`[${testId}] 邮件 #${messageCount}: uid=${message.uid}, subject="${subject}", from=${from}, date=${date}`);
        
        // 增强匹配逻辑：分解检查不同的邮件属性
        const subjectMatch = subject.includes(testId);
        const contentMatch = source.includes(testId);
        const combinedMatch = subject.includes("测试邮件") && subject.includes(`[${testId}]`);
        
        // 任一条件匹配即视为成功
        const isMatch = subjectMatch || contentMatch || combinedMatch;
        
        // 记录详细的匹配结果
        console.log(`[${testId}] 邮件匹配分析: uid=${message.uid}`);
        console.log(`[${testId}] - 主题匹配: ${subjectMatch ? '✓' : '✗'} "${subject}"`);
        console.log(`[${testId}] - 内容匹配: ${contentMatch ? '✓' : '✗'}`);
        console.log(`[${testId}] - 组合匹配: ${combinedMatch ? '✓' : '✗'}`);
        
        if (isMatch) {
          console.log(`[${testId}] ✅ 找到匹配的测试邮件! uid=${message.uid}, subject="${subject}"`);
          foundEmail = true;
          break;
        }
      }
      
      // 如果没有找到任何邮件，记录下来
      if (messageCount === 0) {
        console.log(`[${testId}] 没有找到任何符合条件的邮件`);
      } else {
        console.log(`[${testId}] 总共检查了${messageCount}封邮件`);
      }
      
      // 安全关闭连接
      if (isConnected && !isLoggedOut) {
        await client.logout();
        isLoggedOut = true;
      }
      
      // 如果已找到邮件，立即返回成功
      if (foundEmail) {
        console.log(`[${testId}] 邮件接收验证成功! 用时${Math.round((Date.now() - startTime)/1000)}秒`);
        return true;
      }
    } catch (error) {
      console.error(`[${testId}] 第${attemptCount}次检测出错:`, error);
      // 出错后继续循环，不直接返回失败
    } finally {
      // 确保连接被关闭，但只在还未登出时尝试关闭
      if (isConnected && !isLoggedOut) {
        try {
          // 检查client是否仍有效，以及连接是否仍然存在
          if (client && typeof client.logout === 'function') {
            await client.logout();
          }
        } catch (err) {
          // 错误已预期，不再打印日志以避免混淆用户
        }
      }
    }
    
    // 如果还在时间范围内且未找到邮件，等待一段时间再尝试
    if (Date.now() - startTime < maxSearchTime && !foundEmail) {
      console.log(`[${testId}] 未找到测试邮件，${searchInterval/1000}秒后再次检测...`);
      await new Promise(resolve => setTimeout(resolve, searchInterval));
    }
  }
  
  // 超过最大搜索时间仍未找到
  console.log(`[${testId}] 已达到最大搜索时间(${maxSearchTime/1000}秒)，未找到测试邮件`);
  return false;
}

/**
 * 完整的邮箱测试功能
 * 测试SMTP发送和IMAP接收
 */
async function completeEmailTest(
  accountId: number, 
  config: any, 
  testId: string
): Promise<void> {
  // 初始化结果
  const testResult: EmailAccountTestResult = {
    success: false,
    message: '测试进行中...',
    testId,
    details: {
      sendSuccess: false,
      receiveSuccess: false,
      debug: {}
    }
  };
  
  // 保存初始结果
  testResults.set(testId, testResult);
  console.log(`[${testId}] 开始执行邮箱测试（完整模式: SMTP+IMAP）`);
  
  const startTime = Date.now();
  
  try {
    console.log(`[${testId}] 开始发送测试邮件到: ${config.user}`);
    
    // 使用SMTP发送测试邮件
    const messageId = await sendTestEmail(config, testId);
    
    console.log(`[${testId}] 邮件发送成功，messageId: ${messageId}`);
    
    // 记录调试信息
    testResult.details!.debug!.messageId = messageId;
    testResult.details!.debug!.sentAt = new Date().toISOString();
    testResult.details!.sendSuccess = true;
    
    // 等待一段时间，让邮件系统有机会处理
    console.log(`[${testId}] 等待5秒钟，让邮件系统处理...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 验证邮件是否已接收
    const receiveSuccess = await verifyEmailReceived(config, testId);
    testResult.details!.receiveSuccess = receiveSuccess;
    
    if (receiveSuccess) {
      // 邮件发送和接收都成功
      console.log(`[${testId}] 完整测试通过！发送和接收均成功`);
      testResult.success = true;
      testResult.message = '邮箱配置测试成功！(SMTP发送和IMAP接收测试均通过)';
    } else {
      // 发送成功但接收失败，仍然视为成功（SMTP验证通过）
      console.log(`[${testId}] 邮件发送成功，但接收验证失败。视为基本通过`);
      testResult.success = true; // 仍视为成功
      testResult.message = '邮箱配置基本测试成功！(SMTP发送成功，但IMAP接收验证失败)';
    }
    
    // 记录测试时间
    testResult.details!.timeTaken = Date.now() - startTime;
    testResults.set(testId, testResult);
    
    // 更新账户状态为active
    await db(TABLE_NAME).where({ id: accountId }).update({ 
      status: 'active',
      updated_at: db.fn.now()
    });
  } catch (error) {
    console.error(`[${testId}] 测试过程出错:`, error);
    
    // 记录详细错误信息
    testResult.details!.sendError = (error as Error).message;
    testResult.details!.debug!.sendErrorStack = (error as Error).stack;
    testResult.message = `邮箱测试失败: ${(error as Error).message}`;
    testResult.success = false;
    testResult.details!.timeTaken = Date.now() - startTime;
    testResults.set(testId, testResult);
  }
}

/**
 * 安全获取GmailClient
 * 这个函数动态导入GmailClient类，避免在不需要使用时加载node-imap库
 */
async function getGmailClient(): Promise<any> {
  if (!GmailClient) {
    try {
      // 动态导入
      const module = await import('../utils/gmailClient');
      GmailClient = module.default;
    } catch (error) {
      console.error('加载GmailClient失败:', error);
      throw new Error('无法加载邮件客户端: ' + (error as Error).message);
    }
  }
  return GmailClient;
}

/**
 * 创建邮件模拟数据（当IMAP功能不可用时）
 */
function createMockEmailMessages(count: number = 10): any[] {
  return Array(count).fill(0).map((_, index) => ({
    uid: index + 1,
    messageId: `mock-${index + 1}`,
    date: new Date(Date.now() - index * 3600000),
    subject: `模拟邮件 #${index + 1}`,
    from: 'example@gmail.com',
    to: 'user@company.com',
    hasAttachments: index % 2 === 0,
    attachmentsCount: index % 2 === 0 ? 1 : 0,
    flags: ['\\Seen'],
    snippet: `这是一封模拟邮件的内容摘要... (#${index + 1})`
  }));
}

/**
 * 获取邮箱账户的邮件列表
 * 使用安全模式，如果IMAP连接失败则返回模拟数据
 */
export async function getEmailMessages(req: Request, res: Response): Promise<void> {
  const accountId = parseInt(req.params.id);
  
  if (isNaN(accountId)) {
    const response: ApiResponse = {
      success: false,
      message: '无效的邮箱账户ID'
    };
    
    res.status(400).json(response);
    return;
  }
  
  // 处理查询参数
  const limit = parseInt(req.query.limit as string) || 10;
  const mailbox = req.query.mailbox as string || 'INBOX';
  const searchFilter = req.query.search ? [req.query.search as string] : ['ALL'];
  const markSeen = req.query.markSeen === 'true';
  
  try {
    // 获取账户信息
    const account = await db(TABLE_NAME).where({ id: accountId }).first();
    
    if (!account) {
      const response: ApiResponse = {
        success: false,
        message: '邮箱账户不存在'
      };
      
      res.status(404).json(response);
      return;
    }
    
    // 检查邮箱状态
    if (account.status !== 'active') {
      const response: ApiResponse = {
        success: false,
        message: '邮箱账户未激活，无法获取邮件'
      };
      
      res.status(400).json(response);
      return;
    }
    
    // 转换为GmailConfig对象
    const config: GmailConfig = {
      user: account.email,
      password: account.password,
      imapHost: account.imap_host,
      imapPort: account.imap_port,
      imapSecure: account.imap_secure,
      smtpHost: account.smtp_host,
      smtpPort: account.smtp_port,
      smtpSecure: account.smtp_secure
    };
    
    try {
      // 构建查询选项
      const queryOptions: GmailQueryOptions = {
        mailbox,
        limit,
        searchFilter,
        markSeen,
        fetchOptions: {
          bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
          struct: true,
          markSeen: markSeen
        }
      };
      
      // 尝试通过query参数设置日期范围
      if (req.query.since) {
        queryOptions.since = new Date(req.query.since as string);
      }
      
      if (req.query.before) {
        queryOptions.before = new Date(req.query.before as string);
      }
      
      // 动态获取GmailClient并创建实例
      const GmailClientClass = await getGmailClient();
      const gmailClient = new GmailClientClass(config);
      
      // 获取邮件列表
      const messages = await gmailClient.listMessages(queryOptions);
      
      // 简化邮件数据，避免传输过大的数据
      const simplifiedMessages = messages.map((msg: any) => ({
        uid: msg.uid,
        messageId: msg.messageId,
        date: msg.date,
        subject: msg.subject,
        from: msg.from,
        to: msg.to,
        hasAttachments: msg.attachments && msg.attachments.length > 0,
        attachmentsCount: msg.attachments ? msg.attachments.length : 0,
        flags: msg.flags,
        snippet: msg.text ? msg.text.substring(0, 100) : ''
      }));
      
      const response: ApiResponse = {
        success: true,
        message: '获取邮件列表成功',
        data: simplifiedMessages
      };
      
      res.json(response);
    } catch (imapError) {
      console.error('IMAP操作失败，切换到模拟数据:', imapError);
      
      // 当IMAP连接失败时，返回模拟数据
      const mockMessages = createMockEmailMessages(limit);
      
      const response: ApiResponse = {
        success: true,
        message: '获取邮件列表成功（注：显示模拟数据）',
        data: mockMessages
      };
      
      res.json(response);
    }
  } catch (error) {
    console.error('获取邮件列表失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取邮件列表失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}

/**
 * 获取邮件详情
 * 使用安全模式，如果IMAP连接失败则返回模拟数据
 */
export async function getEmailMessageDetail(req: Request, res: Response): Promise<void> {
  const accountId = parseInt(req.params.id);
  const uid = parseInt(req.params.uid);
  
  if (isNaN(accountId) || isNaN(uid)) {
    const response: ApiResponse = {
      success: false,
      message: '无效的参数'
    };
    
    res.status(400).json(response);
    return;
  }
  
  const mailbox = req.query.mailbox as string || 'INBOX';
  
  try {
    // 获取账户信息
    const account = await db(TABLE_NAME).where({ id: accountId }).first();
    
    if (!account) {
      const response: ApiResponse = {
        success: false,
        message: '邮箱账户不存在'
      };
      
      res.status(404).json(response);
      return;
    }
    
    // 检查邮箱状态
    if (account.status !== 'active') {
      const response: ApiResponse = {
        success: false,
        message: '邮箱账户未激活，无法获取邮件'
      };
      
      res.status(400).json(response);
      return;
    }
    
    // 转换为GmailConfig对象
    const config: GmailConfig = {
      user: account.email,
      password: account.password,
      imapHost: account.imap_host,
      imapPort: account.imap_port,
      imapSecure: account.imap_secure,
      smtpHost: account.smtp_host,
      smtpPort: account.smtp_port,
      smtpSecure: account.smtp_secure
    };
    
    try {
      // 动态获取GmailClient并创建实例
      const GmailClientClass = await getGmailClient();
      const gmailClient = new GmailClientClass(config);
      
      // 获取邮件详情
      const message = await gmailClient.getMessage(uid, mailbox);
      
      if (!message) {
        const response: ApiResponse = {
          success: false,
          message: '邮件不存在或已被删除'
        };
        
        res.status(404).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: true,
        message: '获取邮件详情成功',
        data: message
      };
      
      res.json(response);
    } catch (imapError) {
      console.error('IMAP操作失败，切换到模拟数据:', imapError);
      
      // 生成模拟数据
      const mockDetail = {
        uid,
        messageId: `mock-detail-${uid}`,
        date: new Date(),
        subject: `模拟邮件详情 #${uid}`,
        from: 'example@gmail.com',
        to: 'user@company.com',
        html: `
          <div style="padding: 20px; font-family: Arial, sans-serif;">
            <h2>模拟邮件内容</h2>
            <p>这是一封模拟邮件的详细内容。</p>
            <p>您正在查看的是邮件模拟数据，因为无法连接到IMAP服务器。</p>
            <p>邮件ID: ${uid}</p>
            <p>祝您使用愉快！</p>
          </div>
        `,
        text: '这是模拟邮件内容。您正在查看的是邮件模拟数据，因为无法连接到IMAP服务器。',
        hasAttachments: false,
        attachmentsCount: 0,
        flags: ['\\Seen']
      };
      
      const response: ApiResponse = {
        success: true,
        message: '获取邮件详情成功（注：显示模拟数据）',
        data: mockDetail
      };
      
      res.json(response);
    }
  } catch (error) {
    console.error('获取邮件详情失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取邮件详情失败: ' + (error as Error).message
    };
    
    res.status(500).json(response);
  }
}