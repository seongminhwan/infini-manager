/**
 * 添加免责声明同意配置项
 * 用于存储用户是否已确认系统使用声明和免责声明
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 检查免责声明同意配置是否已存在
  const disclaimerConfig = await knex('user_configs')
    .where({ key: 'disclaimer_agreement_confirmed' })
    .first();
  
  if (!disclaimerConfig) {
    // 添加免责声明同意配置，默认为false
    await knex('user_configs').insert({
      key: 'disclaimer_agreement_confirmed',
      value: JSON.stringify(false),
      description: '用户是否已确认系统使用声明和免责声明',
      created_at: new Date(),
      updated_at: new Date()
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // 删除配置项（仅当是通过此迁移文件添加的）
  // 这里为了安全，不删除任何现有数据
  return Promise.resolve();
}