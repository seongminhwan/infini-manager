-- 初始化MySQL数据库基本表结构
-- 用于验证MySQL兼容性

-- 设置UTF8字符集和外键检查
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 创建邮箱账户表
CREATE TABLE IF NOT EXISTS `email_accounts` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键ID',
  `email` varchar(255) NOT NULL COMMENT '邮箱地址',
  `domain_name` varchar(255) DEFAULT NULL COMMENT '邮箱域名',
  `password` varchar(255) NOT NULL COMMENT '邮箱密码',
  `description` text COMMENT '备注说明',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_accounts_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮箱账户表';

-- 创建KYC图片表
CREATE TABLE IF NOT EXISTS `kyc_images` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键ID',
  `image_type` varchar(50) NOT NULL COMMENT '图片类型（证件类型）',
  `image_url` text NOT NULL COMMENT '图片URL',
  `status` varchar(50) DEFAULT 'unused' COMMENT '使用状态',
  `description` text COMMENT '备注说明',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `kyc_images_status_index` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='KYC图片表';

-- 创建Infini账户表
CREATE TABLE IF NOT EXISTS `infini_accounts` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键ID',
  `user_id` varchar(255) NOT NULL COMMENT 'Infini用户ID',
  `email` varchar(255) NOT NULL COMMENT 'Infini登录邮箱',
  `password` varchar(255) NOT NULL COMMENT 'Infini登录密码',
  `uid` varchar(255) DEFAULT NULL COMMENT 'Infini用户UID',
  `invitation_code` varchar(255) DEFAULT NULL COMMENT '邀请码',
  `available_balance` decimal(20,6) DEFAULT '0.000000' COMMENT '可用余额',
  `withdrawing_amount` decimal(20,6) DEFAULT '0.000000' COMMENT '提现中金额',
  `red_packet_balance` decimal(20,6) DEFAULT '0.000000' COMMENT '红包余额',
  `total_consumption_amount` decimal(20,6) DEFAULT '0.000000' COMMENT '总消费金额',
  `total_earn_balance` decimal(20,6) DEFAULT '0.000000' COMMENT '总收益',
  `daily_consumption` decimal(20,6) DEFAULT '0.000000' COMMENT '日消费',
  `status` varchar(50) DEFAULT NULL COMMENT '账户状态',
  `user_type` int(11) DEFAULT NULL COMMENT '用户类型',
  `google_2fa_is_bound` tinyint(1) DEFAULT '0' COMMENT '是否绑定Google 2FA',
  `google_password_is_set` tinyint(1) DEFAULT '0' COMMENT '是否设置Google密码',
  `is_kol` tinyint(1) DEFAULT '0' COMMENT '是否是KOL',
  `is_protected` tinyint(1) DEFAULT '0' COMMENT '是否受保护',
  `cookie` text COMMENT '认证Cookie',
  `cookie_expires_at` timestamp NULL DEFAULT NULL COMMENT 'Cookie过期时间',
  `infini_created_at` int(11) DEFAULT NULL COMMENT 'Infini账户创建时间',
  `mock_user_id` varchar(255) DEFAULT NULL COMMENT '模拟用户ID',
  `verification_level` varchar(50) DEFAULT NULL COMMENT '验证级别',
  `last_sync_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '最后同步时间',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `infini_accounts_user_id_unique` (`user_id`),
  KEY `infini_accounts_email_index` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Infini账户表';

-- 创建2FA信息表
CREATE TABLE IF NOT EXISTS `infini_2fa_info` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '自增主键ID',
  `infini_account_id` int(11) unsigned NOT NULL COMMENT '关联的Infini账户ID',
  `qr_code_url` text COMMENT '2FA二维码URL',
  `secret_key` varchar(255) DEFAULT NULL COMMENT '2FA密钥',
  `recovery_codes` text COMMENT '2FA恢复码',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `infini_2fa_info_infini_account_id_unique` (`infini_account_id`),
  CONSTRAINT `infini_2fa_info_infini_account_id_foreign` FOREIGN KEY (`infini_account_id`) REFERENCES `infini_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Infini 2FA详细信息表';

-- 创建knex迁移表，记录迁移状态
CREATE TABLE IF NOT EXISTS `knex_migrations` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `batch` int(11) DEFAULT NULL,
  `migration_time` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `knex_migrations_lock` (
  `index` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `is_locked` int(11) DEFAULT NULL,
  PRIMARY KEY (`index`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 重新启用外键检查
SET FOREIGN_KEY_CHECKS = 1;