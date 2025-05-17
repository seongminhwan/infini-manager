-- 禁用外键检查以便于删除表
SET FOREIGN_KEY_CHECKS = 0;

-- 获取所有表名
SELECT concat('DROP TABLE IF EXISTS `', table_name, '`;')
FROM information_schema.tables
WHERE table_schema = 'infini_manager';

-- 删除所有表（请在MySQL客户端执行输出的命令）
DROP TABLE IF EXISTS `infini_2fa_info`;
DROP TABLE IF EXISTS `infini_accounts`;
DROP TABLE IF EXISTS `email_accounts`;
DROP TABLE IF EXISTS `kyc_images`;
DROP TABLE IF EXISTS `name_blacklist`;
DROP TABLE IF EXISTS `random_users`;
DROP TABLE IF EXISTS `infini_2fa_history`;
DROP TABLE IF EXISTS `axios_request_logs`;
DROP TABLE IF EXISTS `infini_kyc_information`;
DROP TABLE IF EXISTS `infini_cards`;
DROP TABLE IF EXISTS `infini_card_details`;
DROP TABLE IF EXISTS `infini_card_applications`;
DROP TABLE IF EXISTS `infini_account_groups`;
DROP TABLE IF EXISTS `infini_account_group_relations`;
DROP TABLE IF EXISTS `user_configs`;
DROP TABLE IF EXISTS `infini_transfers`;
DROP TABLE IF EXISTS `infini_transfer_histories`;
DROP TABLE IF EXISTS `infini_aff_cashbacks`;
DROP TABLE IF EXISTS `infini_aff_cashback_relations`;
DROP TABLE IF EXISTS `infini_aff_transfer_relations`;
DROP TABLE IF EXISTS `knex_migrations`;
DROP TABLE IF EXISTS `knex_migrations_lock`;

-- 重新启用外键检查
SET FOREIGN_KEY_CHECKS = 1;