import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema.hasTable('infini_batch_transfer_relations');
  if (exists) return;
  await knex.schema.createTable('infini_batch_transfer_relations', table => {
    table.increments('id').primary();
    table.integer('batch_id').unsigned().notNullable().comment('关联的批量转账ID');
    table.integer('source_account_id').unsigned().nullable().comment('源账户ID（多对一时为多个源账户，一对多时为单一源账户）');
    table.integer('target_account_id').unsigned().nullable().comment('目标账户ID（一对多时为多个目标账户，多对一时为单一目标账户）');
    table.string('contact_type', 20).nullable().comment('联系人类型: uid、email或inner');
    table.string('target_identifier', 255).nullable().comment('目标标识符（UID、Email或内部账户ID）');
    table.string('amount', 50).notNullable().comment('转账金额（字符串格式避免精度问题）');
    table.enum('status', ['pending', 'processing', 'completed', 'failed']).notNullable().defaultTo('pending').comment('转账状态');
    table.integer('transfer_id').unsigned().nullable().comment('关联的单笔转账ID');
    table.text('error_message').nullable().comment('错误信息');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    
    // 外键约束
    table.foreign('batch_id').references('id').inTable('infini_batch_transfers').onDelete('CASCADE');
  });

  // 添加索引
  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfer_relations_batch_id 
    ON infini_batch_transfer_relations (batch_id);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfer_relations_status 
    ON infini_batch_transfer_relations (status);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfer_relations_source_account 
    ON infini_batch_transfer_relations (source_account_id);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_batch_transfer_relations_target_account 
    ON infini_batch_transfer_relations (target_account_id);
  `);

  // 添加唯一约束，防止在同一批次中对同一账户多次转账
  await knex.schema.raw(`
    CREATE UNIQUE INDEX unique_batch_source_target 
    ON infini_batch_transfer_relations (batch_id, source_account_id, target_account_id)
    WHERE source_account_id IS NOT NULL AND target_account_id IS NOT NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('infini_batch_transfer_relations');
}