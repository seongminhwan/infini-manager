import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('infini_transfers', table => {
    table.increments('id').primary();
    table.integer('account_id').unsigned().notNullable().index()
      .comment('系统内部的Infini账户ID');
    table.string('contact_type', 20).notNullable().index()
      .comment('联系人类型: uid或email');
    table.string('target_identifier', 255).notNullable().index()
      .comment('目标标识符: UID、Email或内部账户ID');
    table.string('amount', 50).notNullable()
      .comment('转账金额（字符串格式避免精度问题）');
    table.string('source', 50).notNullable().index()
      .comment('来源: direct(直接转账), aff(Aff返利), batch(批量转账), schedule(定时任务)');
    table.boolean('is_forced').defaultTo(false)
      .comment('是否强制转账（忽略风险）');
    table.string('remarks', 500).nullable()
      .comment('备注信息');
    table.string('status', 20).notNullable().index().defaultTo('pending')
      .comment('转账状态: pending(准备中), processing(处理中), completed(已完成), failed(失败)');
    table.text('error_message').nullable()
      .comment('错误信息');
    table.text('request_data').nullable()
      .comment('请求数据JSON');
    table.text('response_data').nullable()
      .comment('响应数据JSON');
    table.string('verification_code', 50).nullable()
      .comment('验证码（如适用）');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('completed_at').nullable()
      .comment('完成时间');
  });

  // 添加索引
  await knex.schema.raw(`
    CREATE INDEX idx_infini_transfers_account_target 
    ON infini_transfers (account_id, contact_type, target_identifier);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_transfers_status_created 
    ON infini_transfers (status, created_at);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('infini_transfers');
}