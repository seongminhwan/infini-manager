/**
 * 创建user_configs表
 * 用于存储通用配置信息的key-value结构
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('user_configs', (table) => {
    // 主键
    table.increments('id').primary().comment('自增主键ID');
    
    // 配置信息
    table.string('key').notNullable().comment('配置键名');
    table.json('value').notNullable().comment('配置值(JSON格式)');
    table.text('description').comment('配置说明');
    
    // 系统字段
    table.timestamps(true, true);
    
    // 索引和约束
    table.unique(['key']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('user_configs');
}