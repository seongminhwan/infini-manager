import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('infini_transfers', table => {
    table.string('original_contact_type', 20).nullable().after('contact_type')
      .comment('原始联系人类型: uid, email, inner（用于区分是否内部转账）');
    table.string('original_target_identifier', 255).nullable().after('target_identifier')
      .comment('原始目标标识符，保留原始传入的值');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('infini_transfers', table => {
    table.dropColumn('original_contact_type');
    table.dropColumn('original_target_identifier');
  });
}