/**
 * Gmail工具组件使用示例
 * 演示如何使用GmailClient基于IMAP/SMTP协议读取和发送Gmail邮件
 */
import GmailClient from './gmailClient';
import { GmailQueryOptions, GmailMessageSendOptions } from '../types';

/**
 * 获取邮件列表示例
 * 演示如何获取最近的邮件列表
 */
async function listEmailsExample() {
  try {
    // 创建Gmail客户端实例
    const gmailClient = GmailClient.createClient();

    // 设置查询选项
    const options: GmailQueryOptions = {
      limit: 10, // 获取最近10封邮件
      mailbox: 'INBOX', // 从收件箱获取
      searchFilter: ['UNSEEN'], // 只获取未读邮件
      markSeen: false // 不标记为已读
    };

    // 获取邮件列表
    const messages = await gmailClient.listMessages(options);

    // 输出邮件列表信息
    console.log(`获取到 ${messages.length} 封邮件`);
    messages.forEach((message, index) => {
      // 查找邮件主题和发件人
      const subject = message.subject || '无主题';
      const from = typeof message.from === 'string' 
        ? message.from 
        : (Array.isArray(message.from) && message.from.length > 0)
          ? message.from[0].address
          : '未知发件人';
      
      console.log(`邮件 ${index + 1}:`);
      console.log(`  UID: ${message.uid}`);
      console.log(`  主题: ${subject}`);
      console.log(`  发件人: ${from}`);
      console.log(`  日期: ${message.date?.toLocaleString() || '未知日期'}`);
      console.log(`  正文预览: ${message.text?.substring(0, 100) || '无正文'}`);
      console.log('----------------------------');
    });

    return messages;
  } catch (error) {
    console.error('获取邮件列表示例执行失败:', error);
    throw error;
  }
}

/**
 * 发送邮件示例
 * 演示如何发送一封简单的邮件
 * @param to 收件人邮箱地址
 * @param subject 邮件主题
 * @param content 邮件内容
 */
async function sendEmailExample(to: string, subject: string, content: string) {
  try {
    // 创建Gmail客户端实例
    const gmailClient = GmailClient.createClient();

    // 设置邮件发送选项
    const options: GmailMessageSendOptions = {
      to,
      subject,
      html: content, // 使用HTML格式
      text: content.replace(/<[^>]*>/g, '') // 提供纯文本版本用于不支持HTML的客户端
    };

    // 发送邮件
    const messageId = await gmailClient.sendMessage(options);

    console.log(`邮件发送成功，邮件ID: ${messageId}`);
    return messageId;
  } catch (error) {
    console.error('发送邮件示例执行失败:', error);
    throw error;
  }
}

/**
 * 获取指定邮件示例
 * 演示如何获取指定UID的邮件详情
 * @param uid 邮件UID
 */
async function getEmailExample(uid: number) {
  try {
    // 创建Gmail客户端实例
    const gmailClient = GmailClient.createClient();

    // 获取邮件详情
    const message = await gmailClient.getMessage(uid);

    if (message) {
      // 获取邮件信息
      const subject = message.subject || '无主题';
      const from = typeof message.from === 'string'
        ? message.from
        : (Array.isArray(message.from) && message.from.length > 0)
          ? message.from[0].address
          : '未知发件人';
      
      console.log('邮件详情:');
      console.log(`  UID: ${message.uid}`);
      console.log(`  MessageID: ${message.messageId || '无ID'}`);
      console.log(`  主题: ${subject}`);
      console.log(`  发件人: ${from}`);
      console.log(`  日期: ${message.date?.toLocaleString() || '未知日期'}`);
      console.log(`  HTML内容: ${message.html ? '有' : '无'}`);
      console.log(`  Text内容: ${message.text ? '有' : '无'}`);
      console.log(`  附件数量: ${message.attachments?.length || 0}`);
      
      // 输出部分正文
      if (message.text) {
        console.log('\n正文预览:');
        console.log('----------');
        console.log(message.text.substring(0, 200) + (message.text.length > 200 ? '...' : ''));
        console.log('----------');
      }
    } else {
      console.log(`未找到UID为 ${uid} 的邮件`);
    }

    return message;
  } catch (error) {
    console.error('获取邮件详情示例执行失败:', error);
    throw error;
  }
}

// 导出示例函数，可以在其他地方调用
export {
  listEmailsExample,
  sendEmailExample,
  getEmailExample
};

// 如果直接运行此文件，可以用下面的代码作为示例
if (require.main === module) {
  // 使用异步IIFE运行示例
  (async () => {
    try {
      console.log('====== 获取邮件列表示例 ======');
      const messages = await listEmailsExample();
      
      if (messages.length > 0 && messages[0].uid) {
        const firstUid = messages[0].uid;
        
        console.log('\n====== 获取指定邮件示例 ======');
        await getEmailExample(firstUid);
      }
      
      console.log('\n====== 发送邮件示例 ======');
      // 请替换为实际收件人邮箱
      await sendEmailExample(
        'recipient@example.com',
        '测试邮件 - Infini管理系统',
        '<h1>测试邮件</h1><p>这是一封来自Infini管理系统的测试邮件。</p>'
      );
      
      console.log('\n所有示例执行完毕!');
    } catch (error) {
      console.error('示例执行过程中发生错误:', error);
    }
  })();
}