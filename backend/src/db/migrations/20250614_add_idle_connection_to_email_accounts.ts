/**
 * 添加邮箱实时连接配置选项
 * 允许邮箱账户通过IMAP IDLE命令与服务器建立长连接,实时获取最新邮件
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.table('email_accounts', (table) => {
    // 添加是否使用IDLE长连接选项,默认为false(关闭)
    table.boolean('use_idle_connection').defaultTo(false).comment('是否使用IMAP IDLE长连接实时获取邮件');
    // 添加服务器是否支持IDLE命令字段
    table.boolean('supports_idle').nullable().comment('邮件服务器是否支持IDLE命令');
    // 添加IDLE连接状态字段
    table.string('idle_connection_status', 20).defaultTo('disconnected').comment('IDLE连接状态: connected, disconnected, error');
    // 添加IDLE连接错误信息
    table.text('idle_connection_error').nullable().comment('IDLE连接错误信息');
    // 添加最后IDLE连接时间
    table.timestamp('last_idle_connection_at').nullable().comment('最后IDLE连接时间');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.table('email_accounts', (table) => {
    table.dropColumn('use_idle_connection');
    table.dropColumn('supports_idle');
    table.dropColumn('idle_connection_status');
    table.dropColumn('idle_connection_error');
    table.dropColumn('last_idle_connection_at');
  });
}