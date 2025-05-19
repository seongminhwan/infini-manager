import { Knex } from 'knex';

/**
 * 创建任务锁表 - 用于防止分布式环境下任务重复执行
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('infini_task_locks', table => {
    table.increments('id').primary();
    table.string('task_key', 100).notNullable().comment('任务唯一标识');
    table.string('node_id', 100).notNullable().comment('执行节点标识');
    table.enum('lock_status', ['acquired', 'released']).notNullable().defaultTo('acquired')
      .comment('锁状态：已获取/已释放');
    table.timestamp('lock_time').notNullable().comment('锁获取时间');
    table.timestamp('release_time').nullable().comment('锁释放时间');
    table.timestamp('expires_at').notNullable().comment('锁过期时间');
    table.text('context').nullable().comment('锁上下文信息');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // 添加索引
  await knex.schema.raw(`
    CREATE INDEX idx_infini_task_locks_task_key 
    ON infini_task_locks (task_key);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_task_locks_status 
    ON infini_task_locks (lock_status);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_task_locks_expires_at 
    ON infini_task_locks (expires_at);
  `);

  // 创建唯一索引确保同一任务同时只能有一个活动锁
  await knex.schema.raw(`
    CREATE UNIQUE INDEX idx_infini_task_locks_unique_active 
    ON infini_task_locks (task_key) 
    WHERE lock_status = 'acquired';
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('infini_task_locks');
}