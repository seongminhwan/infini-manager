/**
 * 创建random_users表
 * 用于存储随机生成的用户信息
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('random_users', table => {
    // 主键
    table.increments('id').primary().comment('自增主键ID');
    
    // 邮箱信息
    table.string('email_prefix').notNullable().comment('邮箱前缀');
    table.string('full_email').comment('完整邮箱（可选）');
    
    // 用户信息
    table.string('password').notNullable().comment('随机密码');
    table.string('last_name').notNullable().comment('姓');
    table.string('first_name').notNullable().comment('名');
    table.string('passport_no').notNullable().comment('护照号（9位数字）');
    table.string('phone').notNullable().comment('美国格式手机号');
    
    // 出生日期信息
    table.integer('birth_year').notNullable().comment('出生年（1988-1997）');
    table.integer('birth_month').notNullable().comment('出生月（1-12）');
    table.integer('birth_day').notNullable().comment('出生日（1-31）');
    
    // 索引，确保唯一性
    table.unique(['email_prefix']);
    table.unique(['full_email']);
    table.unique(['passport_no']);
    table.unique(['phone']);
    table.index(['last_name', 'first_name']);
    
    // 时间戳
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('random_users');
}