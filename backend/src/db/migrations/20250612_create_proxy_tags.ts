/**
 * 代理标签相关数据表迁移文件
 * 添加支持为代理服务器添加标签的功能
 */
import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 创建代理标签表
  if (!(await knex.schema.hasTable('proxy_tags'))) {
    await knex.schema.createTable('proxy_tags', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable().unique().comment('标签名称');
      table.string('description').comment('标签描述');
      table.string('color').defaultTo('#1890ff').comment('标签颜色');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    console.log('创建 proxy_tags 表');
  }

  // 创建代理服务器与标签的多对多关系表
  if (!(await knex.schema.hasTable('proxy_server_tags'))) {
    await knex.schema.createTable('proxy_server_tags', (table) => {
      table.increments('id').primary();
      table.integer('proxy_server_id').notNullable().comment('代理服务器ID');
      table.integer('tag_id').notNullable().comment('标签ID');
      table.timestamp('created_at').defaultTo(knex.fn.now());

      // 外键约束
      table.foreign('proxy_server_id').references('id').inTable('proxy_servers').onDelete('CASCADE');
      table.foreign('tag_id').references('id').inTable('proxy_tags').onDelete('CASCADE');

      // 唯一索引，确保一个代理服务器不会重复添加同一个标签
      table.unique(['proxy_server_id', 'tag_id']);
    });

    console.log('创建 proxy_server_tags 表');
  }

  // 创建索引
  await knex.schema.table('proxy_server_tags', (table) => {
    table.index('proxy_server_id');
    table.index('tag_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  // 删除代理服务器标签关系表
  if (await knex.schema.hasTable('proxy_server_tags')) {
    await knex.schema.dropTable('proxy_server_tags');
    console.log('删除 proxy_server_tags 表');
  }

  // 删除代理标签表
  if (await knex.schema.hasTable('proxy_tags')) {
    await knex.schema.dropTable('proxy_tags');
    console.log('删除 proxy_tags 表');
  }
}