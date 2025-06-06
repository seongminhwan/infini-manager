/**
 * 更新user_configs表现有配置的脚本，添加redPacketBalance列的配置
 * 并添加余额颜色区间配置
 */

// 配置knex连接
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig.development);

// 需要更新的配置键
const configKeys = [
  'account_monitor_column_order',
  'account_monitor_column_widths',
  'account_monitor_columns_to_show'
];

// 余额颜色配置键
const colorConfigKeys = [
  'red_packet_balance_color_ranges',
  'available_balance_color_ranges'
];

// 更新配置
async function updateConfigs() {
  try {
    console.log('开始更新配置...');
    
    // 获取现有配置
    for (const key of configKeys) {
      try {
        // 检查配置是否存在
        const existingConfig = await knex('user_configs')
          .where({ key })
          .first();
        
        if (!existingConfig) {
          console.log(`配置 "${key}" 不存在，跳过`);
          continue;
        }
        
        // 解析现有配置值
        let configValue;
        try {
          configValue = JSON.parse(existingConfig.value);
        } catch (error) {
          console.error(`配置 "${key}" 的值解析失败:`, error.message);
          continue;
        }
        
        console.log(`正在更新配置 "${key}"...`);

        // 根据配置键执行不同的更新逻辑
        if (key === 'account_monitor_column_order') {
          // 如果redPacketBalance不在列顺序中，添加到availableBalance后面
          if (!configValue.includes('redPacketBalance')) {
            const availableBalanceIndex = configValue.indexOf('availableBalance');
            if (availableBalanceIndex !== -1) {
              configValue.splice(availableBalanceIndex + 1, 0, 'redPacketBalance');
              console.log('已将redPacketBalance添加到列顺序配置中');
            } else {
              // 如果找不到availableBalance，添加到末尾
              configValue.push('redPacketBalance');
              console.log('已将redPacketBalance添加到列顺序配置末尾');
            }
          } else {
            console.log('列顺序配置中已存在redPacketBalance，无需更新');
          }
        } else if (key === 'account_monitor_column_widths') {
          // 更新列宽配置
          if (!configValue.redPacketBalance) {
            configValue.redPacketBalance = 140;
            console.log('已将redPacketBalance添加到列宽配置中');
          } else {
            console.log('列宽配置中已存在redPacketBalance，无需更新');
          }
        } else if (key === 'account_monitor_columns_to_show') {
          // 如果redPacketBalance不在显示列中，添加到availableBalance后面
          if (!configValue.includes('redPacketBalance')) {
            const availableBalanceIndex = configValue.indexOf('availableBalance');
            if (availableBalanceIndex !== -1) {
              configValue.splice(availableBalanceIndex + 1, 0, 'redPacketBalance');
              console.log('已将redPacketBalance添加到显示列配置中');
            } else {
              // 如果找不到availableBalance，添加到末尾
              configValue.push('redPacketBalance');
              console.log('已将redPacketBalance添加到显示列配置末尾');
            }
          } else {
            console.log('显示列配置中已存在redPacketBalance，无需更新');
          }
        }
        
        // 更新配置到数据库
        await knex('user_configs')
          .where({ key })
          .update({
            value: JSON.stringify(configValue),
            updated_at: new Date()
          });
        
        console.log(`配置 "${key}" 更新成功`);
      } catch (error) {
        console.error(`配置 "${key}" 更新失败:`, error.message);
      }
    }
    
    // 更新红包余额颜色区间配置
    await updateRedPacketBalanceColorConfig();
    
    // 更新用户余额颜色区间配置
    await updateAvailableBalanceColorConfig();
    
    console.log('配置更新完成');
  } catch (error) {
    console.error('更新配置失败:', error);
  } finally {
    // 关闭数据库连接
    knex.destroy();
  }
}

// 更新红包余额颜色区间配置
async function updateRedPacketBalanceColorConfig() {
  const key = 'red_packet_balance_color_ranges';
  console.log(`正在更新配置 "${key}"...`);
  
  // 默认配置：包含阈值和对应的颜色
  const defaultConfig = [
    { threshold: 1.4, color: 'green', backgroundColor: '#52c41a', textColor: 'white' },
    { threshold: 1, color: 'blue', backgroundColor: '#1890ff', textColor: 'white' },
    { threshold: 0.5, color: 'orange', backgroundColor: '#fa8c16', textColor: 'white' },
    { threshold: 0, color: 'brown', backgroundColor: '#8B4513', textColor: 'white' },
    { threshold: -Infinity, color: 'default', backgroundColor: '', textColor: '' }
  ];
  
  try {
    // 检查配置是否已存在
    const existingConfig = await knex('user_configs').where({ key }).first();
    
    if (existingConfig) {
      // 更新现有配置
      await knex('user_configs')
        .where({ key })
        .update({
          value: JSON.stringify(defaultConfig),
          updated_at: new Date()
        });
      console.log(`配置 "${key}" 更新成功`);
    } else {
      // 创建新配置
      await knex('user_configs').insert({
        key,
        value: JSON.stringify(defaultConfig),
        description: '红包余额颜色区间配置',
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log(`配置 "${key}" 创建成功`);
    }
  } catch (error) {
    console.error(`更新配置 "${key}" 失败:`, error.message);
  }
}

// 更新用户余额颜色区间配置
async function updateAvailableBalanceColorConfig() {
  const key = 'available_balance_color_ranges';
  console.log(`正在更新配置 "${key}"...`);
  
  // 默认配置：包含阈值和对应的颜色
  const defaultConfig = [
    { threshold: 10, color: 'green', backgroundColor: '#52c41a', textColor: 'white' },
    { threshold: 5, color: 'blue', backgroundColor: '#1890ff', textColor: 'white' },
    { threshold: 1, color: 'orange', backgroundColor: '#fa8c16', textColor: 'white' },
    { threshold: 0, color: 'default', backgroundColor: '', textColor: '' }
  ];
  
  try {
    // 检查配置是否已存在
    const existingConfig = await knex('user_configs').where({ key }).first();
    
    if (existingConfig) {
      // 更新现有配置
      await knex('user_configs')
        .where({ key })
        .update({
          value: JSON.stringify(defaultConfig),
          updated_at: new Date()
        });
      console.log(`配置 "${key}" 更新成功`);
    } else {
      // 创建新配置
      await knex('user_configs').insert({
        key,
        value: JSON.stringify(defaultConfig),
        description: '用户余额颜色区间配置',
        created_at: new Date(),
        updated_at: new Date()
      });
      console.log(`配置 "${key}" 创建成功`);
    }
  } catch (error) {
    console.error(`更新配置 "${key}" 失败:`, error.message);
  }
}

// 执行更新配置
updateConfigs();