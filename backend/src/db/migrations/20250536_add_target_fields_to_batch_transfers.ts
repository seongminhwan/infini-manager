import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 检查表是否存在
  const tableExists = await knex.schema.hasTable('batch_transfers');
  if (!tableExists) return;

  // 检查字段是否已存在
  const hasTargetAccountId = await knex.schema.hasColumn('batch_transfers', 'target_account_id');
  const hasTargetAccountUid = await knex.schema.hasColumn('batch_transfers', 'target_account_uid');
  const hasSourceAccountId = await knex.schema.hasColumn('batch_transfers', 'source_account_id');
  const hasSourceAccountUid = await knex.schema.hasColumn('batch_transfers', 'source_account_uid');

  // 添加字段
  return knex.schema.alterTable('batch_transfers', table => {
    if (!hasTargetAccountId) {
      table.string('target_account_id', 255).nullable().comment('目标账户ID（多对一模式）');
    }
    if (!hasTargetAccountUid) {
      table.string('target_account_uid', 255).nullable().comment('目标账户UID（多对一模式）');
    }
    if (!hasSourceAccountId) {
      table.string('source_account_id', 255).nullable().comment('源账户ID（一对多模式）');
    }
    if (!hasSourceAccountUid) {
      table.string('source_account_uid', 255).nullable().comment('源账户UID（一对多模式）');
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('batch_transfers');
  if (!tableExists) return;
  
  return knex.schema.alterTable('batch_transfers', table => {
    table.dropColumn('target_account_id');
    table.dropColumn('target_account_uid');
    table.dropColumn('source_account_id');
    table.dropColumn('source_account_uid');
  });
}