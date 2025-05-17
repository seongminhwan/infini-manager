/**
 * 直接使用knex添加user_configs表默认配置的脚本
 */

// 配置knex连接
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig.development);

// 默认配置
const defaultConfigs = [
  {
    key: 'account_monitor_column_order',
    value: JSON.stringify([
      "index", "email", "userId", "groups", "verification_level", 
      "availableBalance", "redPacketBalance", "status", "security", "lastSyncAt", "action"
    ]),
    description: '账户监控列表的列顺序配置'
  },
  {
    key: 'account_monitor_column_widths',
    value: JSON.stringify({
      "email": 160, 
      "verification_level": 120, 
      "availableBalance": 140, 
      "redPacketBalance": 140,
      "userId": 240, 
      "groups": 180, 
      "action": 420, 
      "lastSyncAt": 180, 
      "security": 180,
      "status": 100,
      "index": 80
    }),
    description: '账户监控列表的列宽配置'
  },
  {
    key: 'account_monitor_columns_to_show',
    value: JSON.stringify([
      "index", "email", "userId", "groups", "verification_level", 
      "availableBalance", "redPacketBalance", "status", "security", "lastSyncAt", "action"
    ]),
    description: '账户监控列表的显示列配置'
  }
];

// 添加默认配置
async function addDefaultConfigs() {
  try {
    console.log('开始添加默认配置...');
    
    for (const config of defaultConfigs) {
      try {
        // 检查配置是否已存在
        const existingConfig = await knex('user_configs')
          .where({ key: config.key })
          .first();
        
        if (existingConfig) {
          console.log(`配置 "${config.key}" 已存在，跳过`);
          continue;
        }
        
        // 配置不存在，添加新配置
        await knex('user_configs').insert({
          key: config.key,
          value: config.value,
          description: config.description,
          created_at: new Date(),
          updated_at: new Date()
        });
        
        console.log(`配置 "${config.key}" 添加成功`);
      } catch (error) {
        console.error(`配置 "${config.key}" 添加失败:`, error.message);
      }
    }
    
    console.log('默认配置添加完成');
  } catch (error) {
    console.error('添加默认配置失败:', error);
  } finally {
    // 关闭数据库连接
    knex.destroy();
  }
}

// 执行添加默认配置
addDefaultConfigs();