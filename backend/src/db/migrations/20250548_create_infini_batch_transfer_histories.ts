import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('infini_batch_transfer_histories');
  if (exists) return;
  await knex.schema.createTable('infini_batch_transfer_histories', table => {
    table.increments('id').primary();
    table.integer('batch_id').unsigned().notNullable().comment('关联的批量转账ID');
    table.integer('relation_id').unsigned().nullable().comment('关联的批量转账关系ID（可选）');
    table.string('status', 20).notNullable().comment('状态: pending(准备中), processing(处理中), completed(已完成), failed(失败)');
    table.string('message', 500).nullable().comment('状态描述或消息');
    table.text('details').nullable().comment('详细信息JSON');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    
    // 外键约束
    table.foreign('batch_id').references('id').inTable('infini_batch_transfers').onDelete('CASCADE');
    table.foreign('relation_id').references('id').inTable('infini_batch_transfer_relations').onDelete('SET NULL');
  });

  // 添加索引
  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfer_histories_batch_id 
    ON infini_batch_transfer_histories (batch_id);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfer_histories_relation_id 
    ON infini_batch_transfer_histories (relation_id);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfer_histories_status 
    ON infini_batch_transfer_histories (status);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfer_histories_created_at 
    ON infini_batch_transfer_histories (created_at);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('infini_batch_transfer_histories');
}