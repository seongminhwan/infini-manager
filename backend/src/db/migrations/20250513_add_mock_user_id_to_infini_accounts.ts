/**
 * Migration: 添加mock_user_id字段到infini_accounts表
 * 用于关联创建该账户的模拟用户数据
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('infini_accounts', table => {
    // 添加mock_user_id字段，可以为null
    table.integer('mock_user_id').unsigned().nullable();
    // 添加外键约束，引用random_users表的id字段
    table.foreign('mock_user_id').references('id').inTable('random_users').onDelete('SET NULL');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('infini_accounts', table => {
    // 删除外键约束
    table.dropForeign(['mock_user_id']);
    // 删除字段
    table.dropColumn('mock_user_id');
  });
}