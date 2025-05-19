import { Knex } from 'knex';

/**
 * 创建定时任务表
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('infini_scheduled_tasks', table => {
    table.increments('id').primary();
    table.string('task_name', 255).notNullable().comment('任务名称');
    table.string('task_key', 100).notNullable().unique().comment('任务唯一标识');
    table.string('cron_expression', 100).notNullable().comment('Cron表达式');
    table.text('handler').notNullable().comment('任务处理程序(JSON字符串，包含处理器类型和参数)');
    table.enum('status', ['enabled', 'disabled', 'deleted']).notNullable().defaultTo('enabled')
      .comment('任务状态：启用/禁用/删除');
    table.integer('retry_count').unsigned().defaultTo(0).comment('失败重试次数');
    table.integer('retry_interval').unsigned().defaultTo(0).comment('重试间隔(秒)');
    table.text('description').nullable().comment('任务描述');
    table.timestamp('last_execution_time').nullable().comment('上次执行时间');
    table.timestamp('next_execution_time').nullable().comment('下次执行时间');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();
  });

  // 添加索引
  await knex.schema.raw(`
    CREATE INDEX idx_infini_scheduled_tasks_status 
    ON infini_scheduled_tasks (status);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_scheduled_tasks_next_execution 
    ON infini_scheduled_tasks (next_execution_time);
  `);

  await knex.schema.raw(`
    CREATE UNIQUE INDEX idx_infini_scheduled_tasks_key 
    ON infini_scheduled_tasks (task_key);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('infini_scheduled_tasks');
}