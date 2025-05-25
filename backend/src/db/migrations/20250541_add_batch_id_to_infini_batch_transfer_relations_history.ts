import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('infini_batch_transfer_relations_history');
  if (!tableExists) return;

  // 检查字段是否已存在
  const hasBatchId = await knex.schema.hasColumn('infini_batch_transfer_relations_history', 'batch_id');
  
  if (!hasBatchId) {
    return knex.schema.alterTable('infini_batch_transfer_relations_history', table => {
      table.integer('batch_id').unsigned().nullable().comment('批量转账ID');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('infini_batch_transfer_relations_history');
  if (!tableExists) return;
  
  const hasBatchId = await knex.schema.hasColumn('infini_batch_transfer_relations_history', 'batch_id');
  
  if (hasBatchId) {
    return knex.schema.alterTable('infini_batch_transfer_relations_history', table => {
      table.dropColumn('batch_id');
    });
  }
}