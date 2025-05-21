import { Knex } from 'knex';

/**
 * 为infini_batch_transfers表添加source字段
 */
export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('infini_batch_transfers');
  if (!hasTable) {
    console.log('表infini_batch_transfers不存在，跳过迁移');
    return;
  }
  
  const hasColumn = await knex.schema.hasColumn('infini_batch_transfers', 'source');
  if (hasColumn) {
    console.log('字段source已存在，跳过迁移');
    return;
  }
  
  await knex.schema.alterTable('infini_batch_transfers', table => {
    table.string('source', 50).notNullable().defaultTo('batch').comment('来源: batch(批量转账)');
  });
  
  console.log('成功添加source字段到infini_batch_transfers表');
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('infini_batch_transfers');
  if (!hasTable) {
    return;
  }
  
  const hasColumn = await knex.schema.hasColumn('infini_batch_transfers', 'source');
  if (!hasColumn) {
    return;
  }
  
  await knex.schema.alterTable('infini_batch_transfers', table => {
    table.dropColumn('source');
  });
}