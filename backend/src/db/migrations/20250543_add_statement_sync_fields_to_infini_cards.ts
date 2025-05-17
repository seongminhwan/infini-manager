/**
 * 向infini_cards表添加流水同步相关字段
 * 用于记录银行卡流水同步的时间信息
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('infini_cards', (table) => {
    table.timestamp('last_statement_sync_at').nullable().comment('最后一次流水同步时间');
    table.bigint('statement_first_sync_start_time').nullable().comment('流水分页的第一次开始时间（毫秒时间戳）');
    table.bigint('statement_last_sync_end_time').nullable().comment('流水分页查询的最后一次结束时间（毫秒时间戳）');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('infini_cards', (table) => {
    table.dropColumn('last_statement_sync_at');
    table.dropColumn('statement_first_sync_start_time');
    table.dropColumn('statement_last_sync_end_time');
  });
}