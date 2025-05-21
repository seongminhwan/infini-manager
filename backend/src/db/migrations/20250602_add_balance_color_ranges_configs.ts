/**
 * 添加余额颜色区间配置
 * 用于设置账户监控页面中红包余额和可用余额的颜色显示规则
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 检查red_packet_balance_color_ranges配置是否已存在
  const redPacketConfig = await knex('user_configs')
    .where({ key: 'red_packet_balance_color_ranges' })
    .first();
  
  if (!redPacketConfig) {
    // 添加红包余额颜色区间配置
    await knex('user_configs').insert({
      key: 'red_packet_balance_color_ranges',
      value: JSON.stringify([
        { threshold: 1.4, color: 'green', backgroundColor: '#52c41a', textColor: 'white' },
        { threshold: 1, color: 'blue', backgroundColor: '#1890ff', textColor: 'white' },
        { threshold: 0.5, color: 'orange', backgroundColor: '#fa8c16', textColor: 'white' },
        { threshold: 0, color: 'brown', backgroundColor: '#8B4513', textColor: 'white' },
        { threshold: -Infinity, color: 'default', backgroundColor: '', textColor: '' }
      ]),
      description: '红包余额颜色区间配置，用于账户监控页面显示不同余额范围的颜色',
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  // 检查available_balance_color_ranges配置是否已存在
  const availableBalanceConfig = await knex('user_configs')
    .where({ key: 'available_balance_color_ranges' })
    .first();
  
  if (!availableBalanceConfig) {
    // 添加可用余额颜色区间配置
    await knex('user_configs').insert({
      key: 'available_balance_color_ranges',
      value: JSON.stringify([
        { threshold: 10, color: 'green', backgroundColor: '#52c41a', textColor: 'white' },
        { threshold: 5, color: 'blue', backgroundColor: '#1890ff', textColor: 'white' },
        { threshold: 1, color: 'orange', backgroundColor: '#fa8c16', textColor: 'white' },
        { threshold: 0, color: 'default', backgroundColor: '', textColor: '' }
      ]),
      description: '可用余额颜色区间配置，用于账户监控页面显示不同余额范围的颜色',
      created_at: new Date(),
      updated_at: new Date()
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // 删除配置（仅当是通过此迁移文件添加的）
  // 这里为了安全，我们不删除任何现有数据
  // 如果确实需要回滚，可以手动删除这些配置项
  return Promise.resolve();
}