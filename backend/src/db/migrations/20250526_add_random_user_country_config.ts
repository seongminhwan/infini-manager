import { Knex } from 'knex';

// 将随机用户国家配置添加到user_configs表
export async function up(knex: Knex): Promise<void> {
  // 检查配置是否存在
  const configExists = await knex('user_configs')
    .where('key', 'random_user_country')
    .first();
  
  // 如果配置不存在，则插入
  if (!configExists) {
    // 插入随机用户国家配置
    await knex('user_configs').insert({
      key: 'random_user_country',
      value: JSON.stringify({
        enabled: true,
        countries: ['US', 'CA', 'GB', 'AU', 'FR', 'DE', 'ES', 'IT']
      }),
      created_at: new Date(),
      updated_at: new Date()
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // 删除配置
  await knex('user_configs')
    .where('key', 'random_user_country')
    .del();
}