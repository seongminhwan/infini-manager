import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('infini_transfers', table => {
    table.string('original_contact_type', 20).nullable()
      .comment('原始联系人类型: uid、email或inner');
    table.string('original_target_identifier', 255).nullable()
      .comment('原始目标标识符，用于inner类型记录原始账户ID');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('infini_transfers', table => {
    table.dropColumn('original_contact_type');
    table.dropColumn('original_target_identifier');
  });
}