/**
 * 创建 infini_account_custom_email_configs 表
 * 用于存储 Infini 账户独立的邮箱配置信息
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const tableName = 'infini_account_custom_email_configs';
  const tableExists = await knex.schema.hasTable(tableName);

  if (!tableExists) {
    return knex.schema.createTable(tableName, (table) => {
      table.increments('id').primary().comment('自增主键ID');

      table
        .integer('infini_account_id')
        .unsigned()
        .notNullable()
        .unique()
        .references('id')
        .inTable('infini_accounts')
        .onDelete('CASCADE')
        .comment('关联的Infini账户ID');

      table.string('email').notNullable().comment('邮箱地址');
      table.string('password').notNullable().comment('邮箱密码/授权码');

      // IMAP配置
      table.string('imap_host').notNullable().comment('IMAP服务器地址');
      table.integer('imap_port').notNullable().comment('IMAP服务器端口');
      table.boolean('imap_secure').defaultTo(true).comment('IMAP是否使用SSL/TLS');

      // SMTP配置
      table.string('smtp_host').notNullable().comment('SMTP服务器地址');
      table.integer('smtp_port').notNullable().comment('SMTP服务器端口');
      table.boolean('smtp_secure').defaultTo(true).comment('SMTP是否使用SSL/TLS');

      table.enum('status', ['active', 'disabled']).defaultTo('active').comment('配置状态');
      table.json('extra_config').nullable().comment('额外配置，JSON格式');

      // 时间戳
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index(['infini_account_id']);
    });
  } else {
    console.log(`表 ${tableName} 已存在，跳过创建。`);
    return Promise.resolve();
  }
}

export async function down(knex: Knex): Promise<void> {
  const tableName = 'infini_account_custom_email_configs';
  const tableExists = await knex.schema.hasTable(tableName);

  if (tableExists) {
    return knex.schema.dropTable(tableName);
  } else {
    console.log(`表 ${tableName} 不存在，跳过删除。`);
    return Promise.resolve();
  }
}