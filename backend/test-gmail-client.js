/**
 * Gmail客户端测试脚本
 * 用于直接测试邮件读取功能
 */
const GmailClient = require('./dist/utils/gmailClient').default;
require('dotenv').config();

// 测试配置
const config = {
  user: process.env.TEST_EMAIL || process.env.GMAIL_USER,
  password: process.env.TEST_PASSWORD || process.env.GMAIL_PASSWORD,
  imapHost: process.env.TEST_IMAP_HOST || 'imap.gmail.com',
  imapPort: parseInt(process.env.TEST_IMAP_PORT || '993', 10),
  imapSecure: process.env.TEST_IMAP_SECURE !== 'false',
  smtpHost: process.env.TEST_SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.TEST_SMTP_PORT || '465', 10),
  smtpSecure: process.env.TEST_SMTP_SECURE !== 'false'
};

// 检查必要的配置
if (!config.user || !config.password) {
  console.error('错误: 缺少邮箱账户信息，请在.env文件中设置TEST_EMAIL和TEST_PASSWORD');
  process.exit(1);
}

console.log('Gmail客户端测试 - 使用配置:', {
  user: config.user,
  imapHost: config.imapHost,
  imapPort: config.imapPort,
  smtpHost: config.smtpHost,
  smtpPort: config.smtpPort
});

// 创建Gmail客户端实例
const gmailClient = new GmailClient(config);

// 测试发送邮件
async function testSendEmail() {
  console.log('\n=== 测试发送邮件 ===');
  
  try {
    const testId = `test-${Date.now()}`;
    const sendOptions = {
      to: config.user, // 发给自己
      subject: `测试邮件 [${testId}]`,
      html: `
        <div>
          <h2>这是一封测试邮件</h2>
          <p>测试ID: ${testId}</p>
          <p>时间: ${new Date().toLocaleString()}</p>
          <p>这封邮件用于验证邮箱功能是否正常。</p>
        </div>
      `
    };
    
    console.log('正在发送测试邮件...');
    const messageId = await gmailClient.sendMessage(sendOptions);
    console.log('邮件发送成功:', messageId);
    
    // 等待邮件送达
    console.log('等待5秒让邮件送达...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    return testId;
  } catch (error) {
    console.error('发送邮件失败:', error);
    return null;
  }
}

// 测试获取邮件列表
async function testListMessages(testId) {
  console.log('\n=== 测试获取邮件列表 ===');
  
  try {
    const options = {
      mailbox: 'INBOX',
      limit: 10,
      searchFilter: ['ALL']
    };
    
    console.log('正在获取邮件列表...');
    const messages = await gmailClient.listMessages(options);
    console.log(`成功获取${messages.length}封邮件`);
    
    if (testId) {
      // 查找特定测试邮件
      const testEmail = messages.find(msg => 
        msg.subject && msg.subject.includes(testId)
      );
      
      if (testEmail) {
        console.log('找到测试邮件:', {
          uid: testEmail.uid,
          subject: testEmail.subject,
          date: testEmail.date
        });
        
        return testEmail.uid;
      } else {
        console.log('未找到测试邮件');
        return null;
      }
    }
    
    return messages[0]?.uid;
  } catch (error) {
    console.error('获取邮件列表失败:', error);
    return null;
  }
}

// 测试获取邮件详情
async function testGetMessage(uid) {
  console.log('\n=== 测试获取邮件详情 ===');
  
  if (!uid) {
    console.log('没有可用的邮件UID，跳过测试');
    return;
  }
  
  try {
    console.log(`正在获取UID为${uid}的邮件...`);
    const message = await gmailClient.getMessage(uid);
    
    if (message) {
      console.log('成功获取邮件详情:');
      console.log({
        uid: message.uid,
        subject: message.subject,
        from: message.from,
        to: message.to,
        date: message.date,
        hasHtml: !!message.html,
        hasText: !!message.text,
        textSnippet: message.text ? message.text.substring(0, 100) + '...' : null
      });
    } else {
      console.log('未能找到指定UID的邮件');
    }
  } catch (error) {
    console.error('获取邮件详情失败:', error);
  }
}

// 执行测试
async function runTests() {
  try {
    // 1. 发送测试邮件
    const testId = await testSendEmail();
    
    // 2. 获取邮件列表
    const uid = await testListMessages(testId);
    
    // 3. 获取邮件详情
    await testGetMessage(uid);
    
    console.log('\n全部测试完成!');
  } catch (error) {
    console.error('测试过程中发生错误:', error);
  }
}

// 运行测试
runTests();