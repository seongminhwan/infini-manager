import { Knex } from 'knex';

/**
 * 为email_sync_logs表添加metadata列，用于存储同步任务的元数据信息
 * 如时间范围、筛选条件等
 * 该迁移脚本具有幂等性，可以多次执行而不会出错
 */
export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('email_sync_logs', 'metadata');
  
  if (!hasColumn) {
    return knex.schema.table('email_sync_logs', (table) => {
      // 添加metadata列，使用text类型存储JSON数据
      table.text('metadata').nullable().comment('同步任务的元数据信息，如时间范围等，JSON格式');
    });
  }
  
  // 列已存在，不做任何操作
  return Promise.resolve();
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('email_sync_logs', 'metadata');
  
  if (hasColumn) {
    return knex.schema.table('email_sync_logs', (table) => {
      table.dropColumn('metadata');
    });
  }
  
  // 列不存在，不做任何操作
  return Promise.resolve();
}