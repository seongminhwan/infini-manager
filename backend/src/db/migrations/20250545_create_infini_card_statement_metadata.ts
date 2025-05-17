/**
 * 创建infini_card_statement_metadata表
 * 用于存储Infini银行卡流水明细的元数据信息
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 创建infini_card_statement_metadata表
  return knex.schema.createTable('infini_card_statement_metadata', (table) => {
    table.increments('id').primary();
    table.integer('statement_id').unsigned().notNullable().references('id').inTable('infini_card_statements').onDelete('CASCADE').comment('关联的流水明细ID');
    table.string('meta_key').notNullable().comment('元数据键名，如from、card_last_four_digits等');
    table.text('meta_value').comment('元数据值');
    table.timestamp('created_at').defaultTo(knex.fn.now()).comment('记录创建时间');
    table.timestamp('updated_at').defaultTo(knex.fn.now()).comment('记录更新时间');
    
    // 创建复合索引提高查询效率
    table.index(['statement_id', 'meta_key']);
  });
}

export async function down(knex: Knex): Promise<void> {
  // 删除infini_card_statement_metadata表
  return knex.schema.dropTableIfExists('infini_card_statement_metadata');
}