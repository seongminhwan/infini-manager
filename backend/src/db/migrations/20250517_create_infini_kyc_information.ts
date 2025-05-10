/**
 * 创建infini_kyc_information表
 * 用于存储Infini账户的KYC验证信息
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('infini_kyc_information', (table) => {
    // 主键
    table.increments('id').primary().comment('自增主键ID');
    
    // 外键，关联到infini_accounts表
    table.integer('infini_account_id')
      .notNullable()
      .comment('关联的Infini账户ID')
      .references('id')
      .inTable('infini_accounts')
      .onDelete('CASCADE');
    
    // KYC信息字段，与API返回的字段对应
    table.uuid('kyc_id').comment('API返回的KYC记录唯一ID');
    table.boolean('is_valid').defaultTo(false).comment('KYC信息是否有效');
    table.integer('type').defaultTo(0).comment('KYC类型，0表示护照');
    table.string('s3_key').comment('KYC图片在S3存储的键名');
    table.string('first_name').comment('名字');
    table.string('last_name').comment('姓氏');
    table.string('country').comment('国家代码');
    table.string('phone').comment('电话号码');
    table.string('phone_code').comment('国际电话区号');
    table.string('identification_number').comment('证件号码');
    table.integer('status').defaultTo(0).comment('KYC状态');
    table.string('applicant_id').comment('申请者ID');
    table.json('sumsub_raw').comment('第三方KYC验证原始数据');
    table.integer('api_created_at').comment('API返回的创建时间');
    
    // 系统字段
    table.timestamps(true, true);
    
    // 索引
    table.index(['infini_account_id']);
    table.index(['kyc_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('infini_kyc_information');
}