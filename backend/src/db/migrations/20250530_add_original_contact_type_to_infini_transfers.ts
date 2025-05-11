import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 验证列是否存在
  const hasOriginalContactType = await knex.schema.hasColumn('infini_transfers', 'original_contact_type');
  const hasOriginalTargetIdentifier = await knex.schema.hasColumn('infini_transfers', 'original_target_identifier');
  
  // 只有在列不存在时才添加
  if (!hasOriginalContactType && !hasOriginalTargetIdentifier) {
    await knex.schema.alterTable('infini_transfers', table => {
      table.string('original_contact_type', 20).nullable()
        .comment('原始联系人类型: uid、email或inner');
      table.string('original_target_identifier', 255).nullable()
        .comment('原始目标标识符，用于inner类型记录原始账户ID');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // 验证列是否存在
  const hasOriginalContactType = await knex.schema.hasColumn('infini_transfers', 'original_contact_type');
  const hasOriginalTargetIdentifier = await knex.schema.hasColumn('infini_transfers', 'original_target_identifier');
  
  // 只有在列存在时才删除
  if (hasOriginalContactType && hasOriginalTargetIdentifier) {
    await knex.schema.alterTable('infini_transfers', table => {
      table.dropColumn('original_contact_type');
      table.dropColumn('original_target_identifier');
    });
  }
}