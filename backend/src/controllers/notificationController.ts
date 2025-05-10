/**
 * 通知管理模块控制器
 * 处理与通知相关的所有API请求
 */
import { Request, Response, NextFunction } from 'express';
import { 
  NotificationSetting, 
  NotificationRule, 
  NotificationHistory, 
  NotificationChannel, 
  ApiResponse, 
  ControllerMethod 
} from '../types';

/**
 * 获取通知设置
 */
export const getNotificationSettings: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 实际业务中需要从数据库获取通知设置
    // 这里仅做架构设计，返回模拟数据
    const settings: NotificationSetting = {
      emailEnabled: true,
      emailAddress: 'admin@example.com',
      telegramEnabled: false,
      telegramChatId: '',
      telegramBotToken: ''
    };
    
    const response: ApiResponse<NotificationSetting> = {
      success: true,
      data: settings
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 更新通知设置
 */
export const updateNotificationSettings: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      emailEnabled, 
      emailAddress, 
      telegramEnabled, 
      telegramChatId, 
      telegramBotToken 
    } = req.body;
    
    // 验证请求参数
    if (emailEnabled && !emailAddress) {
      const response: ApiResponse = {
        success: false,
        message: '启用邮件通知时，邮件地址不能为空'
      };
      return res.status(400).json(response);
    }
    
    if (telegramEnabled && (!telegramChatId || !telegramBotToken)) {
      const response: ApiResponse = {
        success: false,
        message: '启用Telegram通知时，聊天ID和机器人Token不能为空'
      };
      return res.status(400).json(response);
    }
    
    // 实际业务中需要更新数据库中的通知设置
    // 这里仅做架构设计，返回模拟数据
    const updatedSettings: NotificationSetting = {
      emailEnabled: emailEnabled || false,
      emailAddress: emailAddress || '',
      telegramEnabled: telegramEnabled || false,
      telegramChatId: telegramChatId || '',
      telegramBotToken: telegramBotToken || ''
    };
    
    const response: ApiResponse<NotificationSetting> = {
      success: true,
      message: '通知设置更新成功',
      data: updatedSettings
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 获取通知规则列表
 */
export const getNotificationRules: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 实际业务中需要从数据库查询通知规则
    // 这里仅做架构设计，返回模拟数据
    const rules: NotificationRule[] = [
      {
        id: 'RULE_001',
        name: '余额警告',
        condition: 'balance < 1000',
        channels: ['email'],
        status: 'active'
      },
      {
        id: 'RULE_002',
        name: '转账完成',
        condition: 'transfer.status == "completed"',
        channels: ['email', 'telegram'],
        status: 'active'
      },
      {
        id: 'RULE_003',
        name: '批量注册完成',
        condition: 'batchRegistration.status == "completed"',
        channels: ['telegram'],
        status: 'inactive'
      }
    ];
    
    const response: ApiResponse<NotificationRule[]> = {
      success: true,
      data: rules
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 创建新的通知规则
 */
export const createNotificationRule: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, condition, channels } = req.body;
    
    // 验证请求参数
    if (!name || !condition || !channels || !Array.isArray(channels) || channels.length === 0) {
      const response: ApiResponse = {
        success: false,
        message: '缺少必要参数或参数格式不正确'
      };
      return res.status(400).json(response);
    }
    
    // 验证通知渠道
    const invalidChannels = channels.filter(channel => 
      !['email', 'telegram'].includes(channel)
    );
    
    if (invalidChannels.length > 0) {
      const response: ApiResponse = {
        success: false,
        message: `无效的通知渠道: ${invalidChannels.join(', ')}`
      };
      return res.status(400).json(response);
    }
    
    // 实际业务中需要将规则保存到数据库
    // 这里仅做架构设计，返回模拟数据
    const newRule: NotificationRule = {
      id: `RULE_${Date.now()}`,
      name,
      condition,
      channels: channels as NotificationChannel[],
      status: 'active'
    };
    
    const response: ApiResponse<NotificationRule> = {
      success: true,
      message: '通知规则创建成功',
      data: newRule
    };
    
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 更新通知规则
 */
export const updateNotificationRule: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, condition, channels, status } = req.body;
    
    // 模拟规则未找到的情况
    if (id === 'not_exist') {
      const response: ApiResponse = {
        success: false,
        message: '找不到指定的通知规则'
      };
      return res.status(404).json(response);
    }
    
    // 验证参数
    if (channels) {
      const invalidChannels = channels.filter((channel: string) => 
        !['email', 'telegram'].includes(channel)
      );
      
      if (invalidChannels.length > 0) {
        const response: ApiResponse = {
          success: false,
          message: `无效的通知渠道: ${invalidChannels.join(', ')}`
        };
        return res.status(400).json(response);
      }
    }
    
    if (status && !['active', 'inactive'].includes(status)) {
      const response: ApiResponse = {
        success: false,
        message: '无效的规则状态'
      };
      return res.status(400).json(response);
    }
    
    // 实际业务中需要从数据库更新通知规则
    // 这里仅做架构设计，返回模拟数据
    const updatedRule: NotificationRule = {
      id,
      name: name || '余额警告',
      condition: condition || 'balance < 1000',
      channels: channels as NotificationChannel[] || ['email'],
      status: status as 'active' | 'inactive' || 'active'
    };
    
    const response: ApiResponse<NotificationRule> = {
      success: true,
      message: '通知规则更新成功',
      data: updatedRule
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 删除通知规则
 */
export const deleteNotificationRule: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // 模拟规则未找到的情况
    if (id === 'not_exist') {
      const response: ApiResponse = {
        success: false,
        message: '找不到指定的通知规则'
      };
      return res.status(404).json(response);
    }
    
    // 实际业务中需要从数据库删除通知规则
    // 这里仅做架构设计，返回成功响应
    
    const response: ApiResponse = {
      success: true,
      message: '通知规则删除成功'
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 获取通知历史记录
 */
export const getNotificationHistory: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel, status, page = '1', limit = '10' } = req.query;
    
    // 转换分页参数
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    
    // 实际业务中需要从数据库查询通知历史
    // 这里仅做架构设计，返回模拟数据
    const history: NotificationHistory[] = [
      {
        id: 'NOTIFY_001',
        type: '余额警告',
        content: '账户[ACC_001]余额低于1000',
        channel: 'email',
        time: '2025-05-06 10:15:22',
        status: 'sent'
      },
      {
        id: 'NOTIFY_002',
        type: '转账完成',
        content: '转账[TRANSFER_123]已完成',
        channel: 'telegram',
        time: '2025-05-05 16:30:45',
        status: 'sent'
      },
      {
        id: 'NOTIFY_003',
        type: '批量注册完成',
        content: '批量注册任务[BATCH_456]已完成',
        channel: 'email',
        time: '2025-05-04 09:25:18',
        status: 'failed'
      }
    ];
    
    // 根据查询参数筛选
    let filteredHistory = [...history];
    
    if (channel) {
      filteredHistory = filteredHistory.filter(item => 
        item.channel === channel
      );
    }
    
    if (status) {
      filteredHistory = filteredHistory.filter(item => 
        item.status === status
      );
    }
    
    // 分页信息
    const pagination = {
      total: filteredHistory.length,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(filteredHistory.length / limitNum)
    };
    
    const response: ApiResponse<{history: NotificationHistory[], pagination: any}> = {
      success: true,
      data: {
        history: filteredHistory,
        pagination
      }
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};

/**
 * 发送测试通知
 */
export const sendTestNotification: ControllerMethod = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { channel, content } = req.body;
    
    // 验证请求参数
    if (!channel || !['email', 'telegram'].includes(channel)) {
      const response: ApiResponse = {
        success: false,
        message: '无效的通知渠道'
      };
      return res.status(400).json(response);
    }
    
    // 实际业务中需要调用通知服务发送测试消息
    // 这里仅做架构设计，返回模拟结果
    
    const testContent = content || '这是一条测试通知';
    
    const response: ApiResponse = {
      success: true,
      message: `测试通知已通过${channel}渠道发送: ${testContent}`
    };
    
    res.json(response);
  } catch (error) {
    next(error);
  }
};