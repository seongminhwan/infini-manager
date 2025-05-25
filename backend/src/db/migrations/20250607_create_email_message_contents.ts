import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 检查表是否已存在
  const exists = await knex.schema.hasTable('email_message_contents');
  if (exists) {
    console.log('email_message_contents表已存在，跳过创建');
    return;
  }

  // 创建邮件内容表
  return knex.schema.createTable('email_message_contents', (table) => {
    table.increments('id').primary();
    table.integer('email_id').notNullable().references('id').inTable('email_messages').onDelete('CASCADE');
    table.text('text_content').nullable(); // 纯文本内容
    table.text('html_content').nullable(); // HTML内容
    table.text('raw_headers').nullable(); // 原始邮件头
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 索引
    table.index('email_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('email_message_contents');
}