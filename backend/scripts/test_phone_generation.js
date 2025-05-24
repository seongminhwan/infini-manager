/**
 * 测试美国手机号生成格式的脚本
 */

// 配置knex连接
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig.development);

// 导入RandomUserService
const { RandomUserService } = require('../dist/service/RandomUserService');

async function testPhoneGeneration() {
  try {
    console.log('📱 开始测试美国手机号生成格式...\n');
    
    const randomUserService = new RandomUserService();
    
    // 生成5个随机用户并显示手机号格式
    for (let i = 1; i <= 5; i++) {
      console.log(`--- 测试 ${i} ---`);
      
      const result = await randomUserService.generateRandomUsers({ count: 1 });
      
      if (result.success && result.data && result.data.length > 0) {
        const user = result.data[0];
        console.log(`✅ 生成成功:`);
        console.log(`   📱 手机号: ${user.phone}`);
        console.log(`   👤 姓名: ${user.last_name}, ${user.first_name}`);
        console.log(`   📧 邮箱前缀: ${user.email_prefix}`);
        console.log(`   🆔 护照号: ${user.passport_no}`);
        
        // 验证手机号格式
        const phoneRegex = /^\+1 \d{10}$/;
        if (phoneRegex.test(user.phone)) {
          console.log(`   ✅ 手机号格式正确 (${user.phone.length} 字符)`);
        } else {
          console.log(`   ❌ 手机号格式错误: ${user.phone}`);
        }
        
        // 检查是否包含555
        if (user.phone.includes('555')) {
          console.log(`   ✅ 包含测试号段555`);
        } else {
          console.log(`   ⚠️ 未包含测试号段555`);
        }
      } else {
        console.log(`❌ 生成失败: ${result.message}`);
      }
      
      console.log('');
    }
    
    console.log('📱 手机号格式测试完成!\n');
    
    // 显示期望的格式示例
    console.log('🎯 期望格式示例:');
    console.log('   +1 8055550156');
    console.log('   +1 3475550116');
    console.log('   +1 2015550123\n');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  } finally {
    // 关闭数据库连接
    await knex.destroy();
    console.log('🔚 数据库连接已关闭');
  }
}

// 执行测试
testPhoneGeneration(); 