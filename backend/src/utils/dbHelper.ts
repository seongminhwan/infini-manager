/**
 * 数据库兼容性辅助函数
 * 提供跨MySQL/SQLite的兼容性方法
 */
import db from '../db/db';
import { Knex } from 'knex';

/**
 * 获取当前使用的数据库类型
 * @returns 'mysql' 或 'sqlite'
 */
export function getDatabaseType(): 'mysql' | 'sqlite' {
  const client = db.client.config.client;
  return client.includes('mysql') ? 'mysql' : 'sqlite';
}

/**
 * 随机排序，兼容MySQL和SQLite
 * @param queryBuilder Knex查询构建器
 * @returns 添加了随机排序的查询构建器
 */
export function randomOrderBy(queryBuilder: Knex.QueryBuilder): Knex.QueryBuilder {
  const dbType = getDatabaseType();
  return dbType === 'mysql' 
    ? queryBuilder.orderByRaw('RAND()') 
    : queryBuilder.orderByRaw('RANDOM()');
}

/**
 * 提取字符串子串，兼容MySQL和SQLite
 * @param field 字段名
 * @param delimiter 分隔符
 * @param position 提取位置('before'或'after')
 * @returns Knex.Raw查询对象
 */
export function extractSubstring(field: string, delimiter: string, position: 'before' | 'after'): Knex.Raw {
  const dbType = getDatabaseType();
  
  if (dbType === 'mysql') {
    // MySQL语法
    return position === 'before'
      ? db.raw(`SUBSTRING(${field}, 1, LOCATE('${delimiter}', ${field}) - 1)`)
      : db.raw(`SUBSTRING(${field}, LOCATE('${delimiter}', ${field}) + 1)`);
  } else {
    // SQLite语法
    return position === 'before'
      ? db.raw(`SUBSTR(${field}, 1, INSTR(${field}, '${delimiter}') - 1)`)
      : db.raw(`SUBSTR(${field}, INSTR(${field}, '${delimiter}') + 1)`);
  }
}

/**
 * 创建索引的兼容语法
 * @param tableName 表名
 * @param indexName 索引名
 * @param columns 列名（逗号分隔）
 * @returns Knex.Raw查询对象
 */
export function createIndexRaw(tableName: string, indexName: string, columns: string): Knex.Raw {
  return db.raw(`CREATE INDEX ${indexName} ON ${tableName} (${columns})`);
}

/**
 * 获取当前数据库类型相关信息
 * @returns 包含数据库类型和连接信息的对象
 */
export function getDatabaseInfo(): { type: string; connectionInfo: string } {
  const dbType = getDatabaseType();
  let connectionInfo = '';
  
  if (dbType === 'mysql') {
    const conn = db.client.config.connection as any;
    connectionInfo = `${conn.host}:${conn.port}/${conn.database}`;
  } else {
    const conn = db.client.config.connection as any;
    connectionInfo = conn.filename;
  }
  
  return {
    type: dbType,
    connectionInfo
  };
}