/**
 * 向infini_accounts表添加验证级别字段
 * 支持三种认证状态：未认证(0)、基础认证(1)、KYC认证(2)
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('infini_accounts', (table) => {
    // 添加验证级别字段，默认为0（未认证）
    table.integer('verification_level').notNullable().defaultTo(0).comment('验证级别: 0=未认证, 1=基础认证, 2=KYC认证');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('infini_accounts', (table) => {
    table.dropColumn('verification_level');
  });
}