import { Knex } from 'knex';

/**
 * 添加内置的邮件增量同步定时任务
 */
export async function up(knex: Knex): Promise<void> {
  const taskKey = 'BUILTIN_INCREMENTAL_EMAIL_SYNC';

  // 检查任务是否已存在，避免重复插入
  const existingTask = await knex('infini_scheduled_tasks').where({ task_key: taskKey }).first();

  if (!existingTask) {
    await knex('infini_scheduled_tasks').insert({
      task_name: '内置邮件增量同步',
      task_key: taskKey,
      cron_expression: '*/5 * * * * *', // 每5秒执行一次
      // 使用正确的 HandlerType.FUNCTION 结构
      // 注意：在此迁移脚本中直接使用 HandlerType.FUNCTION 可能不可行，因为它是一个ts枚举
      // 我们需要使用其字符串值 'function'
      handler: JSON.stringify({
        type: 'function', // HandlerType.FUNCTION 的字符串值
        functionName: 'syncAllEmailsIncrementally',
        params: {}
      }),
      status: 'enabled',
      retry_count: 3, // 默认重试3次
      retry_interval: 60, // 默认重试间隔60秒
      description: '内置定时任务，每5秒调用一次增量同步接口，同步所有邮箱中的邮件内容。此任务不可删除。',
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    });
    console.log(`内置邮件增量同步任务 (${taskKey}) 已成功添加。`);
  } else {
    console.log(`内置邮件增量同步任务 (${taskKey}) 已存在，跳过添加。`);
  }
}

export async function down(knex: Knex): Promise<void> {
  const taskKey = 'BUILTIN_INCREMENTAL_EMAIL_SYNC';
  await knex('infini_scheduled_tasks').where({ task_key: taskKey }).del();
  console.log(`内置邮件增量同步任务 (${taskKey}) 已成功删除。`);
}