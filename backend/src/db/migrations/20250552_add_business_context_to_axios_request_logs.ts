/**
 * 向axios_request_logs表添加业务上下文字段
 * 用于标识请求所属的业务模块和操作类型
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasModule = await knex.schema.hasColumn('axios_request_logs', 'business_module');
  const hasOperation = await knex.schema.hasColumn('axios_request_logs', 'business_operation');
  const hasContext = await knex.schema.hasColumn('axios_request_logs', 'business_context');

  if (!hasModule || !hasOperation || !hasContext) {
    await knex.schema.alterTable('axios_request_logs', (table) => {
      if (!hasModule) table.string('business_module', 100).nullable().comment('业务模块名称').index();
      if (!hasOperation) table.string('business_operation', 100).nullable().comment('业务操作类型').index();
      if (!hasContext) table.string('business_context', 1000).nullable().comment('业务上下文数据(JSON字符串)');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasModule = await knex.schema.hasColumn('axios_request_logs', 'business_module');
  const hasOperation = await knex.schema.hasColumn('axios_request_logs', 'business_operation');
  const hasContext = await knex.schema.hasColumn('axios_request_logs', 'business_context');

  if (hasModule || hasOperation || hasContext) {
    await knex.schema.alterTable('axios_request_logs', (table) => {
      if (hasModule) table.dropColumn('business_module');
      if (hasOperation) table.dropColumn('business_operation');
      if (hasContext) table.dropColumn('business_context');
    });
  }
}