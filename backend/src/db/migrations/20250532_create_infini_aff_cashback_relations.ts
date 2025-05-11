import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('infini_aff_cashback_relations', table => {
    table.increments('id').primary();
    table.integer('aff_cashback_id').unsigned().notNullable().index()
      .comment('关联的AFF批次ID')
      .references('id').inTable('infini_aff_cashbacks')
      .onDelete('CASCADE');
    table.string('infini_uid', 100).notNullable().index()
      .comment('Infini用户UID');
    table.string('infini_email', 255).nullable().index()
      .comment('Infini用户邮箱（如果能匹配到）');
    table.dateTime('register_date').nullable()
      .comment('注册日期');
    table.integer('card_count').defaultTo(0)
      .comment('开卡数量');
    table.dateTime('card_date').nullable()
      .comment('开卡日期');
    table.string('sequence_number', 50).nullable()
      .comment('序列号/行号');
    table.decimal('amount', 15, 2).notNullable()
      .comment('返现金额');
    table.boolean('is_risky').defaultTo(false).index()
      .comment('是否为风险用户（之前已有返现记录）');
    table.boolean('is_ignored').defaultTo(false).index()
      .comment('是否忽略此用户');
    table.boolean('is_approved').defaultTo(false).index()
      .comment('是否强制批准（对风险用户）');
    table.string('status', 20).notNullable().index().defaultTo('pending')
      .comment('处理状态: pending(待处理), processing(处理中), completed(已完成), failed(失败), ignored(已忽略)');
    table.integer('transfer_id').unsigned().nullable().index()
      .comment('关联的转账记录ID');
    table.text('error_message').nullable()
      .comment('错误信息');
    table.text('raw_data').nullable()
      .comment('原始数据行');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('completed_at').nullable()
      .comment('完成时间');
    
    // 创建唯一索引，确保一个批次中不会有重复的UID
    table.unique(['aff_cashback_id', 'infini_uid']);
  });

  // 添加额外索引
  await knex.schema.raw(`
    CREATE INDEX idx_infini_aff_cashback_relations_aff_status 
    ON infini_aff_cashback_relations (aff_cashback_id, status);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_aff_cashback_relations_uid_status 
    ON infini_aff_cashback_relations (infini_uid, status);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('infini_aff_cashback_relations');
}