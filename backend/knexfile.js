/**
 * Knex配置文件
 * 配置数据库连接信息
 * 使用CommonJS模块格式以兼容生产环境
 */
const path = require('path');

module.exports = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, 'db', 'infini.sqlite3')
    },
    migrations: {
      directory: path.join(__dirname, 'src', 'db', 'migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src', 'db', 'seeds')
    },
    useNullAsDefault: true,
    // 启用外键约束
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    }
  },
  production: {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, 'db', 'infini.sqlite3')
    },
    migrations: {
      directory: path.join(__dirname, 'src', 'db', 'migrations')
    },
    seeds: {
      directory: path.join(__dirname, 'src', 'db', 'seeds')
    },
    useNullAsDefault: true,
    // 启用外键约束
    pool: {
      afterCreate: (conn, cb) => {
        conn.run('PRAGMA foreign_keys = ON', cb);
      }
    }
  }
};