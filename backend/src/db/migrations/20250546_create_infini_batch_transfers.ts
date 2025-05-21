import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('infini_batch_transfers');
  if (exists) return;

  await knex.schema.createTable('infini_batch_transfers', table => {
    table.increments('id').primary();
    table.string('name', 255).notNullable().comment('批量转账名称');
    table.enum('type', ['one_to_many', 'many_to_one']).notNullable().comment('转账类型：一对多或多对一');
    table.enum('status', ['pending', 'processing', 'completed', 'failed']).notNullable().defaultTo('pending').comment('批量转账状态');
    table.string('source', 50).notNullable().comment('来源: batch(批量转账)');
    table.string('total_amount', 50).nullable().comment('总转账金额（字符串格式避免精度问题）');
    table.integer('success_count').defaultTo(0).comment('成功转账数量');
    table.integer('failed_count').defaultTo(0).comment('失败转账数量');
    table.string('remarks', 500).nullable().comment('备注信息');
    table.string('created_by', 255).nullable().comment('创建人');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('completed_at').nullable().comment('完成时间');
  });

  // 添加索引
  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfers_status 
    ON infini_batch_transfers (status);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfers_type 
    ON infini_batch_transfers (type);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfers_created_at 
    ON infini_batch_transfers (created_at);
  `);
}

export async function down(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('infini_batch_transfers');
  if (exists) {
    await knex.schema.dropTable('infini_batch_transfers');
  }
}