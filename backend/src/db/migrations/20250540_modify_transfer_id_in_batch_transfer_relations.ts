import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema.hasTable('infini_batch_transfer_relations');
  if (!tableExists) return;

  // 检查transfer_id字段的当前类型
  const columnInfo = await knex('infini_batch_transfer_relations').columnInfo('transfer_id');
  
  if (columnInfo && columnInfo.type !== 'varchar') {
    // 创建临时表保存数据
    await knex.schema.createTable('temp_infini_batch_transfer_relations', table => {
      table.increments('id').primary();
      table.integer('batch_id').unsigned().notNullable().comment('批量转账ID');
      table.string('transfer_id', 255).nullable().comment('转账ID');
      table.integer('account_id').unsigned().notNullable().comment('账户ID');
      table.integer('infini_account_id').unsigned().notNullable().comment('Infini账户ID');
      table.string('contact_name', 255).nullable().comment('联系人姓名');
      table.string('contact_account', 255).nullable().comment('联系人账号');
      table.string('amount', 20).nullable().comment('金额');
      table.string('status', 50).nullable().comment('状态');
      table.string('error_message', 255).nullable().comment('错误信息');
      table.integer('matched_account_id').unsigned().nullable().comment('匹配到的账户ID');
      table.string('transaction_id', 255).nullable().comment('交易ID');
      table.timestamp('completed_at').nullable().comment('完成时间');
      table.timestamps(true, true);
    });

    // 复制数据到临时表
    const relations = await knex('infini_batch_transfer_relations').select('*');
    for (const relation of relations) {
      await knex('temp_infini_batch_transfer_relations').insert({
        ...relation,
        transfer_id: relation.transfer_id ? relation.transfer_id.toString() : null
      });
    }

    // 删除原表并重命名临时表
    await knex.schema.dropTable('infini_batch_transfer_relations');
    await knex.schema.renameTable('temp_infini_batch_transfer_relations', 'infini_batch_transfer_relations');
  }
}

export async function down(knex: Knex): Promise<void> {
  // 不需要回滚操作，因为这是数据类型修正
  return Promise.resolve();
}