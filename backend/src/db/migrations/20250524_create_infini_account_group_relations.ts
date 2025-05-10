/**
 * 创建infini_account_group_relations表
 * 用于存储Infini账户和分组的多对多关系
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 创建关联表
  await knex.schema.createTable('infini_account_group_relations', (table) => {
    // 主键
    table.increments('id').primary().comment('自增主键ID');
    
    // 关联字段
    table.integer('infini_account_id').unsigned().notNullable().comment('Infini账户ID');
    table.integer('group_id').unsigned().notNullable().comment('分组ID');
    
    // 系统字段
    table.timestamps(true, true);
    
    // 索引和约束
    table.unique(['infini_account_id', 'group_id']);
    table.foreign('infini_account_id').references('id').inTable('infini_accounts').onDelete('CASCADE');
    table.foreign('group_id').references('id').inTable('infini_account_groups').onDelete('CASCADE');
  });

  // 获取默认分组ID
  const defaultGroup = await knex('infini_account_groups')
    .where('is_default', true)
    .first();
  
  if (!defaultGroup) {
    throw new Error('默认分组不存在，请先运行创建分组的迁移');
  }

  // 获取所有现有的Infini账户
  const accounts = await knex('infini_accounts').select('id');

  // 将所有现有账户关联到默认分组
  if (accounts.length > 0) {
    const relations = accounts.map(account => ({
      infini_account_id: account.id,
      group_id: defaultGroup.id,
      created_at: new Date(),
      updated_at: new Date()
    }));

    await knex('infini_account_group_relations').insert(relations);
  }
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('infini_account_group_relations');
}