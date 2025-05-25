import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('infini_batch_transfer_relations_history');
  if (exists) return;

  await knex.schema.createTable('infini_batch_transfer_relations_history', table => {
    table.increments('id').primary();
    table.integer('batch_id').unsigned().notNullable().comment('关联的批量转账ID');
    table.integer('relation_id').unsigned().nullable().comment('关联的转账关系ID');
    table.string('status', 20).notNullable().comment('状态');
    table.string('message', 500).nullable().comment('消息内容');
    table.text('details').nullable().comment('详细信息（JSON格式）');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
  });

  // 添加索引
  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfer_relations_history_batch_id 
    ON infini_batch_transfer_relations_history (batch_id);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfer_relations_history_relation_id 
    ON infini_batch_transfer_relations_history (relation_id);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfer_relations_history_status 
    ON infini_batch_transfer_relations_history (status);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfer_relations_history_created_at 
    ON infini_batch_transfer_relations_history (created_at);
  `);
}

export async function down(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('infini_batch_transfer_relations_history');
  if (exists) {
    await knex.schema.dropTable('infini_batch_transfer_relations_history');
  }
}