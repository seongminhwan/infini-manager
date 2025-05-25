import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 检查配置是否已存在
  const exists = await knex('user_configs')
    .where('key', 'disable_register_features')
    .first();
  
  if (!exists) {
    // 添加配置项，默认为true
    await knex('user_configs').insert({
      key: 'disable_register_features',
      value: 'true',
      description: '禁用注册相关功能，包括菜单项（账户批量注册机、批量开卡、模拟用户数据管理、KYC图片管理）和功能点（账户监控页面的注册账户按钮）'
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // 回滚时不删除配置，因为用户可能已经修改了值
  // 如果真的需要删除，取消下面的注释
  // await knex('user_configs')
  //   .where('key', 'disable_register_features')
  //   .delete();
}