/**
 * 创建infini_account_groups表
 * 用于存储Infini账户分组信息
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('infini_account_groups', (table) => {
    // 主键
    table.increments('id').primary().comment('自增主键ID');
    
    // 分组信息
    table.string('name').notNullable().comment('分组名称');
    table.text('description').comment('分组描述');
    table.boolean('is_default').defaultTo(false).comment('是否为默认分组');
    
    // 系统字段
    table.timestamps(true, true);
    
    // 索引和约束
    table.unique(['name']);
  });

  // 创建默认分组
  await knex('infini_account_groups').insert({
    name: '默认分组',
    description: '系统默认分组，包含所有未分类的账户',
    is_default: true,
    created_at: new Date(),
    updated_at: new Date()
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('infini_account_groups');
}