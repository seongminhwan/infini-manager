/**
 * 创建infini_2fa_info表
 * 用于存储Infini账户的2FA详细信息
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('infini_2fa_info', (table) => {
    // 主键
    table.increments('id').primary().comment('自增主键ID');
    
    // 外键，关联到infini_accounts表
    table.integer('infini_account_id')
      .unsigned() // 添加unsigned属性以匹配主表的id类型
      .notNullable()
      .comment('关联的Infini账户ID')
      .references('id')
      .inTable('infini_accounts')
      .onDelete('CASCADE');
    
    // 2FA详细信息
    table.text('qr_code_url').comment('2FA二维码URL');
    table.string('secret_key').comment('2FA密钥');
    table.text('recovery_codes').comment('2FA恢复码（JSON格式）');
    
    // 系统字段
    table.timestamps(true, true);
    
    // 索引
    table.unique(['infini_account_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('infini_2fa_info');
}