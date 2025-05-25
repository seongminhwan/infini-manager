import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 检查表是否已存在
  const exists = await knex.schema.hasTable('email_message_attachments');
  if (exists) {
    console.log('email_message_attachments表已存在，跳过创建');
    return;
  }

  // 创建邮件附件表
  return knex.schema.createTable('email_message_attachments', (table) => {
    table.increments('id').primary();
    table.integer('email_id').notNullable().references('id').inTable('email_messages').onDelete('CASCADE');
    table.string('filename', 255).notNullable(); // 文件名
    table.string('content_type', 100).nullable(); // 内容类型 (MIME类型)
    table.string('content_id', 255).nullable(); // 内容ID，用于在HTML中引用
    table.string('content_disposition', 100).nullable(); // 内容处置方式 (inline或attachment)
    table.integer('size').unsigned().defaultTo(0); // 文件大小（字节）
    table.binary('content').nullable(); // 附件内容，使用二进制类型存储数据
    table.boolean('is_stored').defaultTo(false); // 内容是否已存储
    table.string('storage_path', 255).nullable(); // 如果内容存储在文件系统中，这里存储路径
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 索引
    table.index('email_id');
    table.index(['email_id', 'filename']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('email_message_attachments');
}