/**
 * 创建infini_accounts表
 * 用于存储Infini账户信息
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('infini_accounts', (table) => {
    // 主键
    table.increments('id').primary().comment('自增主键ID');
    
    // 账户基本信息
    table.string('user_id').notNullable().comment('Infini用户ID');
    table.string('email').notNullable().comment('Infini登录邮箱');
    table.string('password').notNullable().comment('Infini登录密码（加密存储）');
    table.string('uid').comment('Infini用户UID');
    table.string('invitation_code').comment('邀请码');
    
    // 账户余额信息
    table.decimal('available_balance', 20, 6).defaultTo(0).comment('可用余额');
    table.decimal('withdrawing_amount', 20, 6).defaultTo(0).comment('提现中金额');
    table.decimal('red_packet_balance', 20, 6).defaultTo(0).comment('红包余额');
    table.decimal('total_consumption_amount', 20, 6).defaultTo(0).comment('总消费金额');
    table.decimal('total_earn_balance', 20, 6).defaultTo(0).comment('总收益');
    table.decimal('daily_consumption', 20, 6).defaultTo(0).comment('日消费');
    
    // 账户状态信息
    table.string('status').comment('账户状态');
    table.integer('user_type').comment('用户类型');
    table.boolean('google_2fa_is_bound').defaultTo(false).comment('是否绑定Google 2FA');
    table.boolean('google_password_is_set').defaultTo(false).comment('是否设置Google密码');
    table.boolean('is_kol').defaultTo(false).comment('是否是KOL');
    table.boolean('is_protected').defaultTo(false).comment('是否受保护');
    
    // 认证信息
    table.text('cookie').comment('认证Cookie');
    table.timestamp('cookie_expires_at').comment('Cookie过期时间');
    
    // 其他信息
    table.integer('infini_created_at').comment('Infini账户创建时间（时间戳）');
    
    // 系统字段
    table.timestamp('last_sync_at').defaultTo(knex.fn.now()).comment('最后同步时间');
    table.timestamps(true, true);
    
    // 索引
    table.unique(['user_id']);
    table.index(['email']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('infini_accounts');
}