import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('infini_transfer_histories', table => {
    table.increments('id').primary();
    table.integer('transfer_id').unsigned().notNullable().index()
      .comment('关联的转账记录ID')
      .references('id').inTable('infini_transfers')
      .onDelete('CASCADE');
    table.string('status', 20).notNullable().index()
      .comment('转账状态: pending(准备中), processing(处理中), completed(已完成), failed(失败)');
    table.string('message', 500).nullable()
      .comment('状态描述或消息');
    table.text('details').nullable()
      .comment('详细信息JSON');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // 添加索引
  await knex.schema.raw(`
    CREATE INDEX idx_infini_transfer_histories_transfer_status 
    ON infini_transfer_histories (transfer_id, status);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_transfer_histories_created 
    ON infini_transfer_histories (created_at);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('infini_transfer_histories');
}