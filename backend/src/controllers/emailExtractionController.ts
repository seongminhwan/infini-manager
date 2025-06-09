/**
 * 邮件取件模板控制器
 * 处理邮件取件模板的增删改查和取件操作
 */
import { Request, Response } from 'express';
import db from '../db/db';
import { ApiResponse } from '../types';

/**
 * 邮件取件服务
 * 执行实际的取件操作
 */
class EmailExtractionService {
  /**
   * 使用正则表达式提取内容
   * @param dataSource 源数据
   * @param regex 正则表达式
   */
  static extractWithRegex(dataSource: any, regexStr: string): string {
    try {
      // 如果数据源不是字符串类型，则转换为JSON字符串
      const sourceStr = typeof dataSource === 'string' 
        ? dataSource 
        : JSON.stringify(dataSource);
      
      // 创建正则表达式对象，支持全局和多行匹配
      const regex = new RegExp(regexStr, 'gm');
      
      // 执行匹配
      const matches = sourceStr.match(regex);
      
      // 如果有匹配结果，返回第一个捕获组（如果有）或完整匹配
      if (matches && matches.length > 0) {
        // 尝试获取捕获组
        const regexWithGroups = new RegExp(regexStr);
        const matchWithGroups = regexWithGroups.exec(sourceStr);
        
        // 如果有捕获组，返回第一个捕获组
        if (matchWithGroups && matchWithGroups.length > 1) {
          return matchWithGroups[1];
        }
        
        // 否则返回完整匹配
        return matches[0];
      }
      
      // 无匹配时返回空字符串
      return '';
    } catch (error) {
      console.error('正则提取失败:', error);
      return '';
    }
  }
  
  /**
   * 使用JavaScript脚本提取内容
   * @param dataSource 源数据
   * @param jsScript JavaScript脚本
   */
  static extractWithJavaScript(dataSource: any, jsScript: string): string {
    try {
      // 将脚本包装为匿名函数
      const wrappedScript = `
        (function(data) {
          try {
            ${jsScript}
          } catch (error) {
            console.error('脚本执行错误:', error);
            return '';
          }
        })
      `;
      
      // 执行脚本（使用eval，但在生产环境中应考虑更安全的方式）
      // eslint-disable-next-line no-eval
      const extractFn = eval(wrappedScript);
      
      // 调用提取函数
      return extractFn(dataSource) || '';
    } catch (error) {
      console.error('JavaScript提取失败:', error);
      return '';
    }
  }
  
  /**
   * 使用模板提取邮件内容
   * @param email 邮件对象
   * @param template 取件模板
   */
  static async extractFromEmail(email: any, template: any): Promise<string> {
    try {
      // 根据数据源获取相应的邮件字段
      let dataSource: any;
      
      if (template.data_source === '*') {
        // 使用完整邮件对象
        dataSource = email;
      } else {
        // 使用指定的字段
        const fieldPath = template.data_source.split('.');
        dataSource = email;
        
        for (const field of fieldPath) {
          if (dataSource && dataSource[field] !== undefined) {
            dataSource = dataSource[field];
          } else {
            // 字段不存在
            return '';
          }
        }
      }
      
      // 根据取件类型执行相应的提取方法
      if (template.extraction_type === 'regex') {
        return this.extractWithRegex(dataSource, template.config);
      } else if (template.extraction_type === 'javascript') {
        return this.extractWithJavaScript(dataSource, template.config);
      }
      
      return '';
    } catch (error) {
      console.error('提取邮件内容失败:', error);
      return '';
    }
  }
}

/**
 * 获取取件模板列表
 */
export async function getExtractionTemplates(req: Request, res: Response): Promise<void> {
  try {
    const {
      page = 1,
      pageSize = 20,
      name,
      extractionType
    } = req.query;

    // 构建查询
    let query = db('email_extraction_templates')
      .select('*');

    // 应用筛选条件
    if (name) {
      query = query.where('name', 'like', `%${name}%`);
    }

    if (extractionType) {
      query = query.where('extraction_type', extractionType);
    }

    // 计算总记录数
    const totalCountResult = await query.clone().count('id as count').first();
    const totalCount = totalCountResult ? (totalCountResult.count as number) : 0;

    // 应用分页
    const parsedPage = parseInt(page as string) || 1;
    const parsedPageSize = parseInt(pageSize as string) || 20;
    const offset = (parsedPage - 1) * parsedPageSize;

    query = query
      .orderBy('created_at', 'desc')
      .limit(parsedPageSize)
      .offset(offset);

    // 执行查询
    const templates = await query;

    // 格式化响应
    const formattedTemplates = templates.map(template => ({
      id: template.id,
      name: template.name,
      extractionType: template.extraction_type,
      dataSource: template.data_source,
      config: template.config,
      createdAt: template.created_at,
      updatedAt: template.updated_at
    }));

    // 计算分页信息
    const totalPages = Math.ceil(totalCount / parsedPageSize);

    const response: ApiResponse = {
      success: true,
      message: '获取取件模板列表成功',
      data: {
        templates: formattedTemplates,
        pagination: {
          page: parsedPage,
          pageSize: parsedPageSize,
          total: totalCount,
          totalPages
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('获取取件模板列表失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取取件模板列表失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 获取取件模板详情
 */
export async function getExtractionTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      res.status(400).json({
        success: false,
        message: '无效的模板ID'
      });
      return;
    }

    // 获取模板
    const template = await db('email_extraction_templates')
      .where({ id: parsedId })
      .first();

    if (!template) {
      res.status(404).json({
        success: false,
        message: '模板不存在'
      });
      return;
    }

    // 格式化响应
    const formattedTemplate = {
      id: template.id,
      name: template.name,
      extractionType: template.extraction_type,
      dataSource: template.data_source,
      config: template.config,
      createdAt: template.created_at,
      updatedAt: template.updated_at
    };

    const response: ApiResponse = {
      success: true,
      message: '获取取件模板详情成功',
      data: formattedTemplate
    };

    res.json(response);
  } catch (error) {
    console.error('获取取件模板详情失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '获取取件模板详情失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 创建取件模板
 */
export async function createExtractionTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { name, extractionType, dataSource, config } = req.body;

    // 参数验证
    if (!name || !extractionType || !dataSource || !config) {
      res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
      return;
    }

    // 验证取件类型
    if (!['regex', 'javascript'].includes(extractionType)) {
      res.status(400).json({
        success: false,
        message: '无效的取件类型，只能为 regex 或 javascript'
      });
      return;
    }

    // 创建模板
    const [id] = await db('email_extraction_templates').insert({
      name,
      extraction_type: extractionType,
      data_source: dataSource,
      config,
      created_at: db.fn.now(),
      updated_at: db.fn.now()
    });

    const response: ApiResponse = {
      success: true,
      message: '创建取件模板成功',
      data: { id }
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('创建取件模板失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '创建取件模板失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 更新取件模板
 */
export async function updateExtractionTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, extractionType, dataSource, config } = req.body;

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      res.status(400).json({
        success: false,
        message: '无效的模板ID'
      });
      return;
    }

    // 参数验证
    if (!name && !extractionType && !dataSource && !config) {
      res.status(400).json({
        success: false,
        message: '至少需要一个更新字段'
      });
      return;
    }

    // 验证取件类型
    if (extractionType && !['regex', 'javascript'].includes(extractionType)) {
      res.status(400).json({
        success: false,
        message: '无效的取件类型，只能为 regex 或 javascript'
      });
      return;
    }

    // 检查模板是否存在
    const template = await db('email_extraction_templates')
      .where({ id: parsedId })
      .first();

    if (!template) {
      res.status(404).json({
        success: false,
        message: '模板不存在'
      });
      return;
    }

    // 构建更新对象
    const updateData: any = {
      updated_at: db.fn.now()
    };

    if (name) updateData.name = name;
    if (extractionType) updateData.extraction_type = extractionType;
    if (dataSource) updateData.data_source = dataSource;
    if (config) updateData.config = config;

    // 更新模板
    await db('email_extraction_templates')
      .where({ id: parsedId })
      .update(updateData);

    const response: ApiResponse = {
      success: true,
      message: '更新取件模板成功'
    };

    res.json(response);
  } catch (error) {
    console.error('更新取件模板失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '更新取件模板失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 删除取件模板
 */
export async function deleteExtractionTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const parsedId = parseInt(id);
    if (isNaN(parsedId)) {
      res.status(400).json({
        success: false,
        message: '无效的模板ID'
      });
      return;
    }

    // 检查模板是否存在
    const template = await db('email_extraction_templates')
      .where({ id: parsedId })
      .first();

    if (!template) {
      res.status(404).json({
        success: false,
        message: '模板不存在'
      });
      return;
    }

    // 删除模板
    await db('email_extraction_templates')
      .where({ id: parsedId })
      .delete();

    const response: ApiResponse = {
      success: true,
      message: '删除取件模板成功'
    };

    res.json(response);
  } catch (error) {
    console.error('删除取件模板失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '删除取件模板失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 测试取件模板
 */
export async function testExtractionTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { template, testData } = req.body;

    // 参数验证
    if (!template || !testData) {
      res.status(400).json({
        success: false,
        message: '缺少必要参数'
      });
      return;
    }

    // 验证模板格式
    if (!template.extractionType || !template.dataSource || !template.config) {
      res.status(400).json({
        success: false,
        message: '无效的模板格式'
      });
      return;
    }

    // 构造标准格式的模板对象
    const standardTemplate = {
      extraction_type: template.extractionType,
      data_source: template.dataSource,
      config: template.config
    };

    // 使用服务执行提取
    const result = await EmailExtractionService.extractFromEmail(testData, standardTemplate);

    const response: ApiResponse = {
      success: true,
      message: '测试取件模板成功',
      data: { result }
    };

    res.json(response);
  } catch (error) {
    console.error('测试取件模板失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '测试取件模板失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

/**
 * 使用模板进行邮件取件
 */
export async function extractEmailsWithTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { 
      templateId, 
      accountId,
      mailbox = 'INBOX',
      keyword,
      subject,
      fromAddress,
      startDate,
      endDate,
      page = 1,
      pageSize = 20
    } = req.body;

    // 参数验证
    if (!templateId) {
      res.status(400).json({
        success: false,
        message: '缺少模板ID'
      });
      return;
    }

    const parsedTemplateId = parseInt(templateId);
    if (isNaN(parsedTemplateId)) {
      res.status(400).json({
        success: false,
        message: '无效的模板ID'
      });
      return;
    }

    // 获取模板
    const template = await db('email_extraction_templates')
      .where({ id: parsedTemplateId })
      .first();

    if (!template) {
      res.status(404).json({
        success: false,
        message: '模板不存在'
      });
      return;
    }

    // 构建邮件查询
    let query = db('email_messages')
      .where({ mailbox });

    // 应用筛选条件
    if (accountId) {
      const parsedAccountId = parseInt(accountId as string);
      if (!isNaN(parsedAccountId)) {
        query = query.where({ account_id: parsedAccountId });
      }
    }

    if (keyword) {
      query = query.where(function() {
        this.where('subject', 'like', `%${keyword}%`)
          .orWhere('from_address', 'like', `%${keyword}%`)
          .orWhere('from_name', 'like', `%${keyword}%`)
          .orWhere('to_address', 'like', `%${keyword}%`)
          .orWhere('snippet', 'like', `%${keyword}%`);
      });
    }

    if (subject) {
      query = query.where('subject', 'like', `%${subject}%`);
    }

    if (fromAddress) {
      query = query.where('from_address', 'like', `%${fromAddress}%`);
    }

    if (startDate) {
      query = query.where('date', '>=', new Date(startDate));
    }

    if (endDate) {
      query = query.where('date', '<=', new Date(endDate));
    }

    // 计算总记录数
    const totalCountResult = await query.clone().count('id as count').first();
    const totalCount = totalCountResult ? (totalCountResult.count as number) : 0;

    // 应用分页
    const parsedPage = parseInt(page as string) || 1;
    const parsedPageSize = parseInt(pageSize as string) || 20;
    const offset = (parsedPage - 1) * parsedPageSize;

    query = query
      .orderBy('date', 'desc')
      .limit(parsedPageSize)
      .offset(offset);

    // 执行查询
    const emails = await query;

    // 获取邮件内容
    const emailIds = emails.map(email => email.id);
    const contents = await db('email_message_contents')
      .whereIn('email_id', emailIds);

    // 合并邮件内容
    const emailsWithContent = emails.map(email => {
      const content = contents.find(c => c.email_id === email.id);
      return {
        ...email,
        content: {
          text: content?.text_content || '',
          html: content?.html_content || '',
          headers: content?.raw_headers ? JSON.parse(content.raw_headers) : []
        }
      };
    });

    // 对每封邮件执行取件操作
    const extractionResults: Array<any> = [];
    const codes: string[] = [];

    for (const email of emailsWithContent) {
      // 格式化邮件对象
      const formattedEmail = {
        id: email.id,
        messageId: email.message_id,
        uid: email.uid,
        fromAddress: email.from_address,
        fromName: email.from_name,
        toAddress: email.to_address,
        subject: email.subject,
        date: email.date,
        status: email.status,
        hasAttachments: email.has_attachments,
        attachmentsCount: email.attachments_count,
        snippet: email.snippet,
        mailbox: email.mailbox,
        content: email.content,
        createdAt: email.created_at,
        updatedAt: email.updated_at
      };

      // 执行取件
      const code = await EmailExtractionService.extractFromEmail(formattedEmail, template);
      
      // 将提取的代码添加到邮件对象
      extractionResults.push({
        ...formattedEmail,
        code
      });
      
      // 收集唯一的代码
      if (code && !codes.includes(code)) {
        codes.push(code);
      }
    }

    // 计算分页信息
    const totalPages = Math.ceil(totalCount / parsedPageSize);

    const response: ApiResponse = {
      success: true,
      message: '邮件取件成功',
      data: {
        emails: extractionResults,
        codes,
        pagination: {
          page: parsedPage,
          pageSize: parsedPageSize,
          total: totalCount,
          totalPages
        }
      }
    };

    res.json(response);
  } catch (error) {
    console.error('邮件取件失败:', error);
    const response: ApiResponse = {
      success: false,
      message: '邮件取件失败: ' + (error as Error).message
    };

    res.status(500).json(response);
  }
}

// 导出邮件取件服务供其他模块使用
export { EmailExtractionService };