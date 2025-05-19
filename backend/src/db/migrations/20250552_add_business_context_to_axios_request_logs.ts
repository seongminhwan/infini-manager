/**
 * 向axios_request_logs表添加业务上下文字段
 * 用于标识请求所属的业务模块和操作类型
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('axios_request_logs', (table) => {
    table.string('business_module', 100).nullable().comment('业务模块名称');
    table.string('business_operation', 100).nullable().comment('业务操作类型');
    table.string('business_context', 1000).nullable().comment('业务上下文数据(JSON字符串)');
    
    // 添加索引
    table.index('business_module');
    table.index('business_operation');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('axios_request_logs', (table) => {
    table.dropColumn('business_module');
    table.dropColumn('business_operation');
    table.dropColumn('business_context');
  });
}