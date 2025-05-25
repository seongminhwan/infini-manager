import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 检查表是否存在
  const tableExists = await knex.schema.hasTable('infini_batch_transfer_relations');
  if (!tableExists) return;

  // 检查字段是否已存在
  const hasMatchedAccountId = await knex.schema.hasColumn('infini_batch_transfer_relations', 'matched_account_id');
  const hasTransactionId = await knex.schema.hasColumn('infini_batch_transfer_relations', 'transaction_id');
  const hasCompletedAt = await knex.schema.hasColumn('infini_batch_transfer_relations', 'completed_at');

  // 添加字段
  return knex.schema.alterTable('infini_batch_transfer_relations', table => {
    if (!hasMatchedAccountId) {
      table.integer('matched_account_id').unsigned().nullable().comment('匹配到的账户ID');
    }
    
    if (!hasTransactionId) {
      table.string('transaction_id', 255).nullable().comment('交易ID');
    }
    
    if (!hasCompletedAt) {
      table.timestamp('completed_at').nullable().comment('完成时间');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('infini_batch_transfer_relations');
  if (!tableExists) return;
  
  return knex.schema.alterTable('infini_batch_transfer_relations', table => {
    table.dropColumn('matched_account_id');
    table.dropColumn('transaction_id');
    table.dropColumn('completed_at');
  });
}