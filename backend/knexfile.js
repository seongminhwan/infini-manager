/**
 * Knex配置文件
 * 配置数据库连接信息
 * 支持动态切换MySQL/SQLite
 */
const path = require('path');
require('dotenv').config();

// 获取数据库类型环境变量，默认为sqlite
const dbType = process.env.DB_TYPE || 'sqlite';
console.log(`当前使用数据库类型: ${dbType}`);

// 数据库配置基础参数
const baseConfig = {
  migrations: {
    directory: path.join(__dirname, 'src', 'db', 'migrations')
  },
  seeds: {
    directory: path.join(__dirname, 'src', 'db', 'seeds')
  }
};

// SQLite配置
const sqliteConfig = {
  ...baseConfig,
  client: 'sqlite3',
  connection: {
    filename: path.join(__dirname, 'db', 'infini.sqlite3')
  },
  useNullAsDefault: true,
  // 启用外键约束
  pool: {
    afterCreate: (conn, cb) => {
      conn.run('PRAGMA foreign_keys = ON', cb);
    }
  }
};

// MySQL配置
const mysqlConfig = {
  ...baseConfig,
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'infini_manager',
    charset: 'utf8mb4'
  },
  pool: {
    min: 2,
    max: 10
  }
};

// 根据数据库类型选择配置
const selectedConfig = dbType === 'mysql' ? mysqlConfig : sqliteConfig;

// 导出配置
module.exports = {
  development: selectedConfig,
  production: selectedConfig
};