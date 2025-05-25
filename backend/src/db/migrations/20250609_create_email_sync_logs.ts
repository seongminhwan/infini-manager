import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 检查表是否已存在
  const exists = await knex.schema.hasTable('email_sync_logs');
  if (exists) {
    console.log('email_sync_logs表已存在，跳过创建');
    return;
  }

  // 创建邮件同步日志表
  return knex.schema.createTable('email_sync_logs', (table) => {
    table.increments('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('email_accounts').onDelete('CASCADE');
    table.string('sync_type', 50).defaultTo('incremental'); // 同步类型: full, incremental
    table.string('status', 50).defaultTo('pending').index(); // 同步状态: pending, processing, completed, failed
    table.integer('total_messages').defaultTo(0); // 处理的邮件总数
    table.integer('new_messages').defaultTo(0); // 新增的邮件数
    table.integer('updated_messages').defaultTo(0); // 更新的邮件数
    table.integer('failed_messages').defaultTo(0); // 处理失败的邮件数
    table.integer('last_uid').nullable(); // 最后同步的邮件UID，用于增量同步
    table.text('error_message').nullable(); // 错误信息
    table.text('mailboxes').nullable(); // 同步的邮箱文件夹，JSON格式
    table.timestamp('start_time').defaultTo(knex.fn.now()); // 同步开始时间
    table.timestamp('end_time').nullable(); // 同步结束时间
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 索引
    table.index('account_id');
    table.index(['account_id', 'start_time']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('email_sync_logs');
}