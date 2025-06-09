import { Knex } from 'knex';

/**
 * 创建邮件取件模板表
 * 用于存储邮件内容提取的模板配置
 */
export async function up(knex: Knex): Promise<void> {
  // 检查表是否已存在
  const exists = await knex.schema.hasTable('email_extraction_templates');
  if (exists) {
    console.log('email_extraction_templates表已存在，跳过创建');
    return;
  }

  // 创建邮件取件模板表
  return knex.schema.createTable('email_extraction_templates', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable().comment('模板名称');
    table.enum('extraction_type', ['regex', 'javascript']).notNullable().comment('取件类型：正则表达式或JavaScript脚本');
    table.string('data_source', 255).notNullable().comment('数据源字段路径，完整对象为"*"');
    table.text('config').notNullable().comment('取件配置：正则表达式或JavaScript脚本');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // 索引
    table.index('name');
    table.index('extraction_type');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('email_extraction_templates');
}