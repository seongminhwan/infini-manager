import { Knex } from 'knex';

/**
 * 修复批量转账表的字段问题
 * 1. 确保completed_at字段存在
 * 2. 修正字段名称一致性问题（type字段而非batch_type）
 * 3. 添加batch_number字段
 */
export async function up(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('infini_batch_transfers');
  if (!hasTable) {
    console.log('表infini_batch_transfers不存在，跳过迁移');
    return;
  }

  // 检查并添加completed_at字段
  const hasCompletedAt = await knex.schema.hasColumn('infini_batch_transfers', 'completed_at');
  if (!hasCompletedAt) {
    await knex.schema.alterTable('infini_batch_transfers', table => {
      table.timestamp('completed_at').nullable().comment('完成时间');
    });
    console.log('成功添加completed_at字段');
  }

  // 检查并添加batch_number字段
  const hasBatchNumber = await knex.schema.hasColumn('infini_batch_transfers', 'batch_number');
  if (!hasBatchNumber) {
    await knex.schema.alterTable('infini_batch_transfers', table => {
      table.string('batch_number', 255).nullable().comment('批次号');
    });
    console.log('成功添加batch_number字段');
  }

  // 检查是否存在batch_type字段，如果存在则重命名为type
  const hasBatchType = await knex.schema.hasColumn('infini_batch_transfers', 'batch_type');
  const hasType = await knex.schema.hasColumn('infini_batch_transfers', 'type');
  
  if (hasBatchType && !hasType) {
    // 先添加type字段
    await knex.schema.alterTable('infini_batch_transfers', table => {
      table.enum('type', ['one_to_many', 'many_to_one']).notNullable().defaultTo('one_to_many').comment('转账类型：一对多或多对一');
    });
    
    // 迁移数据
    await knex('infini_batch_transfers').update({
      type: knex.raw('batch_type')
    });
    
    // 删除旧字段
    await knex.schema.alterTable('infini_batch_transfers', table => {
      table.dropColumn('batch_type');
    });
    
    console.log('成功将batch_type字段重命名为type');
  } else if (!hasType) {
    // 如果type字段不存在，直接添加
    await knex.schema.alterTable('infini_batch_transfers', table => {
      table.enum('type', ['one_to_many', 'many_to_one']).notNullable().defaultTo('one_to_many').comment('转账类型：一对多或多对一');
    });
    console.log('成功添加type字段');
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasTable = await knex.schema.hasTable('infini_batch_transfers');
  if (!hasTable) {
    return;
  }

  // 回滚时删除添加的字段
  const hasCompletedAt = await knex.schema.hasColumn('infini_batch_transfers', 'completed_at');
  if (hasCompletedAt) {
    await knex.schema.alterTable('infini_batch_transfers', table => {
      table.dropColumn('completed_at');
    });
  }

  const hasBatchNumber = await knex.schema.hasColumn('infini_batch_transfers', 'batch_number');
  if (hasBatchNumber) {
    await knex.schema.alterTable('infini_batch_transfers', table => {
      table.dropColumn('batch_number');
    });
  }

  // 如果需要恢复batch_type字段
  const hasType = await knex.schema.hasColumn('infini_batch_transfers', 'type');
  const hasBatchType = await knex.schema.hasColumn('infini_batch_transfers', 'batch_type');
  
  if (hasType && !hasBatchType) {
    await knex.schema.alterTable('infini_batch_transfers', table => {
      table.enum('batch_type', ['one_to_many', 'many_to_one']).notNullable().defaultTo('one_to_many');
    });
    
    await knex('infini_batch_transfers').update({
      batch_type: knex.raw('type')
    });
    
    await knex.schema.alterTable('infini_batch_transfers', table => {
      table.dropColumn('type');
    });
  }
} 