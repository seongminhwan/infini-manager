/**
 * 创建infini_cards表
 * 用于存储Infini账户的卡片基本信息
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 创建infini_cards表
  return knex.schema.createTable('infini_cards', (table) => {
    table.increments('id').primary();
    table.integer('infini_account_id').notNullable().references('id').inTable('infini_accounts').onDelete('CASCADE');
    table.string('card_id').comment('从API返回的卡片ID');
    table.string('status').comment('卡片状态');
    table.string('currency').comment('货币类型');
    table.string('provider').comment('提供商');
    table.string('username').comment('用户名');
    table.string('card_last_four_digits').comment('卡号后四位');
    table.string('issue_type').comment('发行类型（visa、mastercard）');
    table.string('card_address').comment('卡片地址');
    table.string('label').comment('标签');
    table.text('partner_cover').comment('合作伙伴封面图片URL');
    table.string('consumption_limit').comment('消费限额');
    table.boolean('is_default').defaultTo(false).comment('是否默认卡片');
    table.string('available_balance').comment('可用余额');
    table.integer('budget_card_type').comment('预算卡类型');
    table.string('daily_consumption').comment('日消费额');
    table.string('name').comment('名称');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  // 删除infini_cards表
  return knex.schema.dropTableIfExists('infini_cards');
}