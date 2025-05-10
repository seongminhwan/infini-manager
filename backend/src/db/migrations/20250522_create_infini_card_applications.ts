/**
 * 创建infini_card_applications表
 * 用于记录Infini账户的开卡申请记录
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 创建infini_card_applications表
  return knex.schema.createTable('infini_card_applications', (table) => {
    table.increments('id').primary();
    table.integer('infini_account_id').notNullable().references('id').inTable('infini_accounts').onDelete('CASCADE');
    table.integer('card_id').references('id').inTable('infini_cards').onDelete('SET NULL').comment('关联的卡片ID');
    table.integer('application_id').comment('申请ID，从API返回');
    table.integer('card_type').notNullable().comment('卡片类型');
    table.decimal('price', 10, 6).comment('开卡费用');
    table.decimal('discount', 10, 6).comment('优惠金额');
    table.enum('status', ['pending', 'created', 'failed']).defaultTo('pending').comment('申请状态');
    table.string('error_message').comment('失败原因');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  // 删除infini_card_applications表
  return knex.schema.dropTableIfExists('infini_card_applications');
}