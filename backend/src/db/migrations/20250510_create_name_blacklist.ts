/**
 * 创建name_blacklist表
 * 用于存储不允许使用的姓名数据
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('name_blacklist', table => {
    // 主键
    table.increments('id').primary().comment('自增主键ID');
    
    // 黑名单信息
    table.string('name').notNullable().comment('不允许使用的姓名');
    table.string('reason').comment('禁用原因');
    
    // 索引
    table.unique(['name']);
    
    // 时间戳
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('name_blacklist');
}