/**
 * 创建infini_card_details表
 * 用于存储Infini账户的卡片详细信息（敏感数据）
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 创建infini_card_details表
  return knex.schema.createTable('infini_card_details', (table) => {
    table.increments('id').primary();
    table.integer('card_id').unsigned().notNullable().references('id').inTable('infini_cards').onDelete('CASCADE');
    table.string('card_no').comment('完整卡号');
    table.string('expire_year').comment('过期年份');
    table.string('expire_month').comment('过期月份');
    table.string('cvv').comment('安全码');
    table.string('generated_address').comment('生成的地址');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  // 删除infini_card_details表
  return knex.schema.dropTableIfExists('infini_card_details');
}