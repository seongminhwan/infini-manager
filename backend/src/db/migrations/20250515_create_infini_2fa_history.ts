/**
 * 创建infini_2fa_history表
 * 用于保存2FA历史记录，避免用户误操作导致2FA被错误覆盖
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('infini_2fa_history', (table) => {
    table.increments('id').primary();
    table.integer('infini_account_id').notNullable().references('id').inTable('infini_accounts').onDelete('CASCADE');
    table.text('qr_code_url').nullable();
    table.string('secret_key', 255).nullable();
    table.text('recovery_codes').nullable(); // 恢复码存储为JSON字符串
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('archived_at').defaultTo(knex.fn.now()); // 归档时间
    table.string('archived_reason', 255).nullable(); // 归档原因
    
    // 索引
    table.index('infini_account_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('infini_2fa_history');
}