import { Knex } from 'knex';

/**
 * 备份并清理不完整的卡片信息 (card_id 为空)
 */
export async function up(knex: Knex): Promise<void> {
  // 1. 创建备份表（若不存在）
  const hasBackup = await knex.schema.hasTable('infini_cards_incomplete_backup');
  if (!hasBackup) {
    await knex.schema.createTable('infini_cards_incomplete_backup', (table) => {
      table.increments('id').primary();
      table.integer('orig_id').notNullable().comment('原 infini_cards 表中的主键');
      table.json('raw_data').notNullable().comment('原行数据 JSON');
      table.timestamp('backup_at').defaultTo(knex.fn.now()).notNullable();
    });
  }

  // 2. 将 card_id 为空的记录备份到新表
  const incompleteRows = await knex('infini_cards').whereNull('card_id').orWhere('card_id', '');
  if (incompleteRows.length > 0) {
    const backupRows = incompleteRows.map((row: any) => ({
      orig_id: row.id,
      raw_data: JSON.stringify(row),
    }));
    await knex('infini_cards_incomplete_backup').insert(backupRows);

    // 3. 从原表删除这些记录
    const ids = incompleteRows.map((r: any) => r.id);
    await knex('infini_cards').whereIn('id', ids).delete();
  }
}

export async function down(knex: Knex): Promise<void> {
  // 将备份表中的数据恢复到 infini_cards（仅当原表不存在相同 id 时）
  const hasBackup = await knex.schema.hasTable('infini_cards_incomplete_backup');
  if (hasBackup) {
    const backups = await knex('infini_cards_incomplete_backup');
    for (const b of backups) {
      const exists = await knex('infini_cards').where('id', b.orig_id).first();
      if (!exists) {
        const data = JSON.parse(b.raw_data);
        await knex('infini_cards').insert(data);
      }
    }
    // 可选择删除备份表
    await knex.schema.dropTable('infini_cards_incomplete_backup');
  }
} 