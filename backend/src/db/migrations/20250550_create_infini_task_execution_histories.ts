import { Knex } from 'knex';

/**
 * 创建任务执行历史表
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('infini_task_execution_histories', table => {
    table.increments('id').primary();
    table.integer('task_id').unsigned().notNullable().comment('关联的任务ID');
    table.string('task_key', 100).notNullable().comment('任务唯一标识');
    table.enum('status', ['success', 'failed', 'running', 'canceled']).notNullable().defaultTo('running')
      .comment('执行状态：成功/失败/运行中/已取消');
    table.timestamp('start_time').notNullable().comment('开始执行时间');
    table.timestamp('end_time').nullable().comment('结束执行时间');
    table.integer('execution_time_ms').unsigned().nullable().comment('执行耗时(毫秒)');
    table.string('trigger_type', 50).defaultTo('scheduled').comment('触发类型：scheduled(定时)/manual(手动)');
    table.string('node_id', 100).nullable().comment('执行节点标识');
    table.text('error_message').nullable().comment('错误信息');
    table.text('execution_log').nullable().comment('执行日志');
    table.integer('attempt').unsigned().defaultTo(1).comment('执行尝试次数');
    table.timestamp('created_at').defaultTo(knex.fn.now()).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now()).notNullable();

    // 添加外键约束
    table.foreign('task_id').references('id').inTable('infini_scheduled_tasks').onDelete('CASCADE');
  });

  // 添加索引
  await knex.schema.raw(`
    CREATE INDEX idx_infini_task_execution_histories_task_id 
    ON infini_task_execution_histories (task_id);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_task_execution_histories_task_key 
    ON infini_task_execution_histories (task_key);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_task_execution_histories_status 
    ON infini_task_execution_histories (status);
  `);

  await knex.schema.raw(`
    CREATE INDEX idx_infini_task_execution_histories_start_time 
    ON infini_task_execution_histories (start_time);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('infini_task_execution_histories');
}