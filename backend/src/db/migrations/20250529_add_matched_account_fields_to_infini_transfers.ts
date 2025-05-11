import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('infini_transfers', table => {
    table.integer('matched_account_id').unsigned().nullable()
      .comment('匹配到的内部Infini账户ID（如适用）');
    table.string('matched_account_email', 255).nullable()
      .comment('匹配到的内部账户邮箱（如适用）');
    table.string('matched_account_uid', 255).nullable()
      .comment('匹配到的内部账户UID（如适用）');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('infini_transfers', table => {
    table.dropColumn('matched_account_id');
    table.dropColumn('matched_account_email');
    table.dropColumn('matched_account_uid');
  });
}