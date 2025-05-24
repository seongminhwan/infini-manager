/**
 * 添加随机用户生成国家配置的脚本
 */

// 配置knex连接
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig.development);

// 添加国家配置
async function addCountryConfig() {
  try {
    console.log('开始添加随机用户生成国家配置...');
    
    // 检查配置是否已存在
    const existingConfig = await knex('user_configs')
      .where({ key: 'random_user_generation_country' })
      .first();
    
    if (existingConfig) {
      console.log('配置 "random_user_generation_country" 已存在，当前值:', existingConfig.value);
      return;
    }
    
    // 配置不存在，添加新配置
    await knex('user_configs').insert({
      key: 'random_user_generation_country',
      value: JSON.stringify('china'),
      description: '随机用户生成时使用的国家配置，支持china、japan、korea、usa或random',
      created_at: new Date(),
      updated_at: new Date()
    });
    
    console.log('配置 "random_user_generation_country" 添加成功，默认值: china');
    
  } catch (error) {
    console.error('添加配置失败:', error);
  } finally {
    // 关闭数据库连接
    knex.destroy();
  }
}

// 运行脚本
addCountryConfig(); 