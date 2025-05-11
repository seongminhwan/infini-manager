import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('infini_aff_transfer_relations', table => {
    table.increments('id').primary();
    table.integer('aff_cashback_id').unsigned().notNullable().index()
      .comment('关联的AFF批次ID')
      .references('id').inTable('infini_aff_cashbacks')
      .onDelete('CASCADE');
    table.integer('aff_relation_id').unsigned().notNullable().index()
      .comment('关联的AFF用户关系ID')
      .references('id').inTable('infini_aff_cashback_relations')
      .onDelete('CASCADE');
    table.integer('transfer_id').unsigned().notNullable().index()
      .comment('关联的转账记录ID')
      .references('id').inTable('infini_transfers')
      .onDelete('CASCADE');
    table.integer('transfer_history_id').unsigned().nullable().index()
      .comment('关联的转账历史记录ID（最新状态）');
    table.string('status', 20).notNullable().index()
      .comment('转账状态: pending(待处理), processing(处理中), completed(已完成), failed(失败)');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    
    // 创建唯一索引，确保AFF用户关系和转账记录的唯一对应关系
    table.unique(['aff_relation_id', 'transfer_id']);
  });

  // 添加额外索引
  await knex.schema.raw(`
    CREATE INDEX idx_infini_aff_transfer_relations_aff_transfer
    ON infini_aff_transfer_relations (aff_cashback_id, transfer_id);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_aff_transfer_relations_relation_status
    ON infini_aff_transfer_relations (aff_relation_id, status);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('infini_aff_transfer_relations');
}