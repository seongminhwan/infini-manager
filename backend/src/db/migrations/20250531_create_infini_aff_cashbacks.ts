import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('infini_aff_cashbacks', table => {
    table.increments('id').primary();
    table.integer('account_id').unsigned().notNullable().index()
      .comment('执行转账操作的Infini账户ID');
    table.string('batch_name', 100).notNullable()
      .comment('批次名称');
    table.text('original_data').nullable()
      .comment('原始数据内容（CSV或空格分隔文本）');
    table.string('file_name', 255).nullable()
      .comment('上传的文件名（如果是通过文件上传）');
    table.string('file_type', 20).nullable()
      .comment('文件类型（csv或text）');
    table.string('status', 20).notNullable().index().defaultTo('pending')
      .comment('批次状态: pending(准备中), processing(处理中), completed(已完成), failed(失败), paused(已暂停)');
    table.integer('total_count').defaultTo(0)
      .comment('总记录数量');
    table.integer('success_count').defaultTo(0)
      .comment('成功处理的记录数量');
    table.integer('failed_count').defaultTo(0)
      .comment('失败的记录数量');
    table.integer('risky_count').defaultTo(0)
      .comment('风险记录数量');
    table.text('error_message').nullable()
      .comment('错误信息');
    table.decimal('total_amount', 15, 2).defaultTo(0)
      .comment('总转账金额');
    table.decimal('default_amount', 15, 2).defaultTo(5.6)
      .comment('默认单笔返现金额');
    table.boolean('is_auto_2fa').defaultTo(true)
      .comment('是否自动进行2FA验证');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('completed_at').nullable()
      .comment('完成时间');
  });

  // 添加索引
  await knex.schema.raw(`
    CREATE INDEX idx_infini_aff_cashbacks_account_status 
    ON infini_aff_cashbacks (account_id, status);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_aff_cashbacks_status_created 
    ON infini_aff_cashbacks (status, created_at);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('infini_aff_cashbacks');
}