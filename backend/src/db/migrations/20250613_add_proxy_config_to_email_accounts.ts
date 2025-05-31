/**
 * 为email_accounts表添加代理配置字段
 * 支持为邮箱账户配置代理服务器
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('email_accounts', table => {
    // 代理配置
    table.boolean('use_proxy').defaultTo(false).comment('是否使用代理');
    table.enum('proxy_mode', ['direct', 'specific', 'tag_random']).defaultTo('direct').comment('代理模式：直连/指定代理/标签随机');
    table.integer('proxy_server_id').nullable().comment('指定代理服务器ID');
    table.string('proxy_tag').nullable().comment('代理标签');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('email_accounts', table => {
    table.dropColumn('use_proxy');
    table.dropColumn('proxy_mode');
    table.dropColumn('proxy_server_id');
    table.dropColumn('proxy_tag');
  });
}