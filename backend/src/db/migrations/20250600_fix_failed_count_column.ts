import { Knex } from 'knex';

// 为已经创建的 infini_batch_transfers 表补齐/修正 failed_count 字段
export async function up(knex: Knex): Promise<void> {
  const hasFailed = await knex.schema.hasColumn('infini_batch_transfers', 'failed_count');
  if (!hasFailed) {
    await knex.schema.table('infini_batch_transfers', table => {
      table.integer('failed_count').defaultTo(0).comment('失败转账数量');
    });
  }

  const hasFail = await knex.schema.hasColumn('infini_batch_transfers', 'fail_count');
  if (hasFail) {
    // 把旧列数据迁移到新的 failed_count
    await knex('infini_batch_transfers').update({
      failed_count: knex.raw('COALESCE(fail_count, 0)')
    });

    // 删除旧列
    await knex.schema.table('infini_batch_transfers', table => {
      table.dropColumn('fail_count');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // 回滚时仅在不存在 fail_count 时恢复，避免覆盖已有历史结构
  const hasFail = await knex.schema.hasColumn('infini_batch_transfers', 'fail_count');
  if (!hasFail) {
    await knex.schema.table('infini_batch_transfers', table => {
      table.integer('fail_count').defaultTo(0);
    });
  }

  const hasFailed = await knex.schema.hasColumn('infini_batch_transfers', 'failed_count');
  if (hasFailed) {
    await knex('infini_batch_transfers').update({
      fail_count: knex.raw('COALESCE(failed_count, 0)')
    });
    await knex.schema.table('infini_batch_transfers', table => {
      table.dropColumn('failed_count');
    });
  }
} 