/**
 * 添加user_configs表默认配置
 * 用于为用户配置项设置默认值，避免页面首次加载报错
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 检查account_monitor_column_order配置是否已存在
  const columnOrderConfig = await knex('user_configs')
    .where({ key: 'account_monitor_column_order' })
    .first();
  
  if (!columnOrderConfig) {
    // 添加列顺序默认配置
    await knex('user_configs').insert({
      key: 'account_monitor_column_order',
      value: JSON.stringify([
        "index", "email", "userId", "groups", "verification_level", 
        "availableBalance", "redPacketBalance", "status", "security", "lastSyncAt", "action"
      ]),
      description: '账户监控列表的列顺序配置',
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  // 检查account_monitor_column_widths配置是否已存在
  const columnWidthsConfig = await knex('user_configs')
    .where({ key: 'account_monitor_column_widths' })
    .first();
  
  if (!columnWidthsConfig) {
    // 添加列宽默认配置
    await knex('user_configs').insert({
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
      description: '账户监控列表的列宽配置',
      created_at: new Date(),
      updated_at: new Date()
    });
  }

  // 检查account_monitor_columns_to_show配置是否已存在
  const columnsToShowConfig = await knex('user_configs')
    .where({ key: 'account_monitor_columns_to_show' })
    .first();
  
  if (!columnsToShowConfig) {
    // 添加显示列默认配置
    await knex('user_configs').insert({
      key: 'account_monitor_columns_to_show',
      value: JSON.stringify([
        "index", "email", "userId", "groups", "verification_level", 
        "availableBalance", "redPacketBalance", "status", "security", "lastSyncAt", "action"
      ]),
      description: '账户监控列表的显示列配置',
      created_at: new Date(),
      updated_at: new Date()
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // 删除默认配置（仅当是通过此迁移文件添加的）
  // 这里为了安全，我们不删除任何现有数据
  // 如果确实需要回滚，可以手动删除这些配置项
  return Promise.resolve();
}