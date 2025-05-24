/**
 * 初始化代理池相关数据库表的脚本
 */

// 配置knex连接
const knexConfig = require('../knexfile');
const knex = require('knex')(knexConfig.development);
const fs = require('fs');
const path = require('path');

async function initProxyTables() {
  try {
    console.log('🚀 开始初始化代理池数据库表...\n');
    
    // 读取SQL文件
    const sqlPath = path.join(__dirname, '../src/db/migrations/create_proxy_tables.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // 分割SQL语句
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    // 执行每个SQL语句
    for (const statement of statements) {
      if (statement.toLowerCase().includes('create table') || 
          statement.toLowerCase().includes('create index') ||
          statement.toLowerCase().includes('insert')) {
        console.log(`📝 执行SQL: ${statement.substring(0, 50)}...`);
        await knex.raw(statement);
      }
    }
    
    console.log('\n✅ 代理池数据库表初始化完成!');
    
    // 检查表是否创建成功
    const tables = await knex.raw("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'proxy_%'");
    console.log('\n📊 已创建的代理相关表:');
    tables.forEach(table => {
      console.log(`   - ${table.name}`);
    });
    
  } catch (error) {
    console.error('❌ 初始化代理池数据库表失败:', error);
  } finally {
    // 关闭数据库连接
    await knex.destroy();
    console.log('\n🔚 数据库连接已关闭');
  }
}

// 执行初始化
initProxyTables(); 