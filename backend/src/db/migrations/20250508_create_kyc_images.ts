/**
 * 创建kyc_images表
 * 用于存储KYC图片信息
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('kyc_images', table => {
    table.increments('id').primary();
    table.text('img_base64').notNullable().comment('图片的base64编码内容');
    table.text('tags').notNullable().comment('图片标签，多个标签用逗号分隔');
    
    // 时间戳
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('kyc_images');
}