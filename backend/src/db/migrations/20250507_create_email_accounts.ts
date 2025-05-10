/**
 * 创建email_accounts表
 * 用于存储主邮箱配置信息
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('email_accounts', table => {
    table.increments('id').primary();
    table.string('name').notNullable().comment('邮箱名称');
    table.string('email').notNullable().unique().comment('邮箱地址');
    table.string('password').notNullable().comment('邮箱密码/授权码');
    
    // IMAP配置
    table.string('imap_host').notNullable().comment('IMAP服务器地址');
    table.integer('imap_port').notNullable().comment('IMAP服务器端口');
    table.boolean('imap_secure').defaultTo(true).comment('是否使用SSL/TLS');
    
    // SMTP配置
    table.string('smtp_host').notNullable().comment('SMTP服务器地址');
    table.integer('smtp_port').notNullable().comment('SMTP服务器端口');
    table.boolean('smtp_secure').defaultTo(true).comment('是否使用SSL/TLS');
    
    // 状态
    table.enum('status', ['active', 'pending', 'disabled']).defaultTo('pending').comment('账户状态');
    table.boolean('is_default').defaultTo(false).comment('是否为默认邮箱');
    
    // 时间戳
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // 额外配置，以JSON格式存储
    table.json('extra_config').nullable().comment('额外配置，JSON格式');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('email_accounts');
}