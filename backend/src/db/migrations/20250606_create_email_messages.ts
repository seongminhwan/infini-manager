import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 检查表是否已存在
  const exists = await knex.schema.hasTable('email_messages');
  if (exists) {
    console.log('email_messages表已存在，跳过创建');
    return;
  }

  // 创建邮件基本信息表
  return knex.schema.createTable('email_messages', (table) => {
    table.increments('id').primary();
    table.integer('account_id').notNullable().references('id').inTable('email_accounts').onDelete('CASCADE');
    table.string('message_id', 255).index(); // 邮件系统分配的唯一ID
    table.integer('uid').notNullable(); // 邮件在邮箱中的唯一ID
    table.string('from_address', 255); // 发件人邮箱
    table.string('from_name', 255); // 发件人名称
    table.text('to_address'); // 收件人邮箱，可能有多个
    table.text('cc_address').nullable(); // 抄送地址，可能有多个
    table.text('bcc_address').nullable(); // 密送地址，可能有多个
    table.string('subject', 1000); // 邮件主题
    table.datetime('date').index(); // 邮件日期
    table.text('flags').nullable(); // 邮件标志，如已读、已回复等，存储为JSON字符串
    table.boolean('has_attachments').defaultTo(false); // 是否有附件
    table.integer('attachments_count').defaultTo(0); // 附件数量
    table.string('status', 50).defaultTo('unread').index(); // 邮件状态：unread, read, deleted
    table.text('snippet').nullable(); // 邮件内容摘要
    table.string('mailbox', 100).defaultTo('INBOX').index(); // 邮箱文件夹：INBOX, Sent, Drafts等
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 索引
    table.index(['account_id', 'uid']); // 复合索引，加速查询
    table.index(['account_id', 'date']); // 复合索引，用于按日期查询
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('email_messages');
}