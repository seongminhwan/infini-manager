/**
 * 创建infini_card_statements表
 * 用于存储Infini银行卡的流水明细记录
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 创建infini_card_statements表
  return knex.schema.createTable('infini_card_statements', (table) => {
    table.increments('id').primary();
    table.integer('card_id').unsigned().notNullable().references('id').inTable('infini_cards').onDelete('CASCADE').comment('关联的卡片ID');
    table.string('statement_id').comment('流水记录ID，对应API返回的id');
    table.string('tx_id').comment('交易ID');
    table.string('field').comment('变化字段类型，如RED_PACKET_BALANCE或AVAILABLE_BALANCE');
    table.integer('change_type').comment('变化类型，如8(开卡)、3(接收/发送)、14(红包)等');
    table.decimal('change', 65, 8).comment('变动金额');
    table.integer('status').comment('状态');
    table.decimal('pre_balance', 65, 8).comment('变动前余额');
    table.decimal('balance', 65, 8).comment('变动后余额');
    table.bigint('created_at_timestamp').comment('API返回的创建时间戳');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('记录创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('记录更新时间');
  });
}

export async function down(knex: Knex): Promise<void> {
  // 删除infini_card_statements表
  return knex.schema.dropTableIfExists('infini_card_statements');
}