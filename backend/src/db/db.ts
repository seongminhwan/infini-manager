/**
 * 数据库连接初始化模块
 * 支持MySQL/SQLite动态切换
 */
import knex, { Knex } from 'knex';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import dbBackup from '../utils/dbBackup';

// 确保环境变量已加载
dotenv.config();

// 获取数据库类型环境变量
const dbType = process.env.DB_TYPE || 'sqlite';

// 使用最简单直接的方式加载配置文件
// 直接查找当前目录中的knexfile.js
// 这是最可靠的方法，不依赖复杂的路径解析逻辑
let knexConfig;
try {
  // 日志显示当前工作目录已经是backend目录
  // 直接加载当前目录中的knexfile.js
  const configPath = path.join(process.cwd(), 'knexfile.js');
  
  console.log('当前工作目录:', process.cwd());
  console.log('尝试加载配置文件:', configPath);
  
  // 直接加载JavaScript格式的配置文件
  knexConfig = require(configPath);
  console.log('配置文件加载成功');
  
  // 输出数据库类型信息
  const clientType = knexConfig.development.client;
  console.log(`当前数据库类型: ${dbType} (客户端: ${clientType})`);
} catch (error) {
  console.error('无法加载knexfile配置:', error);
  console.error('当前工作目录:', process.cwd());
  console.error('当前__dirname:', __dirname);
  throw new Error('无法找到knexfile配置文件，请确保文件存在且路径正确');
}

// 创建数据库目录（如果不存在）
const dbDir = path.join(__dirname, '..', '..', 'db');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 根据环境变量选择配置
const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

// 创建数据库连接实例
const db: Knex = knex(config);

// 打印数据库连接信息
const connectionInfo = db.client.config.connection as any;
if (typeof connectionInfo === 'string') {
  console.log(`数据库连接: ${connectionInfo}`);
} else if (connectionInfo.filename) {
  console.log(`SQLite数据库文件: ${connectionInfo.filename}`);
} else {
  console.log(`MySQL数据库连接: ${connectionInfo.host}:${connectionInfo.port}/${connectionInfo.database}`);
}

// 初始化数据库
export async function initializeDatabase(): Promise<void> {
  // SQLite数据库备份
  try {
    if (db.client.config.client === 'sqlite3' && connectionInfo.filename) {
      const dbFileName = path.basename(connectionInfo.filename);
      if (fs.existsSync(connectionInfo.filename)) {
        console.log('[数据库] 在初始化前创建数据库备份...');
        const backupPath = dbBackup.backupSqliteDatabase(dbFileName);
        if (backupPath) {
          console.log(`[数据库] 成功创建备份: ${backupPath}`);
        }
      }
    }
  } catch (backupError) {
    console.error('[数据库] 备份数据库时出错:', backupError);
    // 备份失败不阻止后续操作，只记录错误
  }
  try {
    // 检查是否存在proxy相关表，如果不存在则创建
    await initProxyTables();
    
    // 在执行迁移前强制备份
    let backupPath: string | undefined = undefined;
    try {
      if (db.client.config.client === 'sqlite3' && connectionInfo.filename) {
        console.log('[数据库] 在执行迁移前创建数据库备份...');
        const dbFileName = path.basename(connectionInfo.filename);
        // 确保返回值不为null
        const result = dbBackup.backupSqliteDatabase(dbFileName);
        backupPath = result === null ? undefined : result;
        
        // 验证备份路径是否有效
        if (backupPath) {
          console.log(`[数据库] 迁移前数据库已备份至: ${backupPath}`);
          // 将备份路径保存到环境中，以便可能的恢复
          process.env.LAST_DB_BACKUP_PATH = backupPath;
        } else {
          throw new Error('创建备份失败：未能获取有效的备份路径');
        }
      }
    } catch (migrationBackupError) {
      console.error('[数据库] 迁移前备份数据库时出错:', migrationBackupError);
      
      // 备份失败时是否继续取决于环境配置
      const allowContinueWithoutBackup = process.env.ALLOW_MIGRATION_WITHOUT_BACKUP === 'true';
      if (!allowContinueWithoutBackup) {
        throw new Error('数据库备份失败，为了数据安全，迁移已中止。设置ALLOW_MIGRATION_WITHOUT_BACKUP=true可以跳过此检查');
      }
      console.warn('[数据库] 警告：未能创建备份，但继续执行迁移');
    }
    
    // 扫描迁移文件，检测危险操作
    try {
      const migrationsDir = path.join(__dirname, 'migrations');
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.ts') || f.endsWith('.js'));
      
      const dangerousMigrations = [];
      
      // 扫描所有迁移文件，检查危险操作（例如DELETE、DROP TABLE等）
      for (const file of migrationFiles) {
        const filePath = path.join(migrationsDir, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          
          // 检查是否包含危险操作
          if (
            (content.includes('delete') || content.includes('DELETE')) ||
            (content.includes('drop') || content.includes('DROP')) ||
            (content.includes('truncate') || content.includes('TRUNCATE'))
          ) {
            dangerousMigrations.push(file);
          }
        }
      }
      
      // 如果有危险迁移，记录警告
      if (dangerousMigrations.length > 0) {
        console.warn('[数据库] 注意：以下迁移文件包含可能导致数据丢失的操作:');
        dangerousMigrations.forEach(file => console.warn(`  - ${file}`));
        console.warn('[数据库] 已创建备份，将继续执行迁移');
        // 不再阻止应用启动，只记录警告
      }
    } catch (scanError: unknown) {
      // 处理扫描错误但不中断流程
      const errorObj = scanError as Error;
      if (errorObj && typeof errorObj === 'object' && 'message' in errorObj) {
        console.error('[数据库] 扫描迁移文件时出错:', errorObj.message);
      }
      console.error('[数据库] 扫描迁移文件失败:', scanError);
      // 扫描失败不中断流程
    }
    
    // 首先检查迁移文件完整性，避免意外跳过迁移
    // 预先检查所有迁移文件是否存在，并拒绝不完整的迁移
    try {
      console.log('[数据库] 验证迁移文件完整性...');
      // 获取已执行的迁移记录
      const completedMigrations = await db('knex_migrations').select('name');
      const completedNames = completedMigrations.map(m => m.name);
      
      // 检查迁移目录中所有迁移文件
      const migrationsDir = path.join(__dirname, 'migrations');
      const migrationFiles = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.ts') || f.endsWith('.js'));
        
      // 验证所有记录在数据库中的迁移文件是否都存在
      const missingFiles = completedNames.filter(name => 
        !migrationFiles.includes(name) && !name.endsWith('.sql'));
      
      if (missingFiles.length > 0) {
        throw new Error(`迁移文件不完整，以下文件缺失: ${missingFiles.join(', ')}`);
      }
      
      console.log('[数据库] 迁移文件完整性验证通过');
    } catch (error: any) {
      // 类型断言以解决TS错误
      const validationError = error as Error;
      if (validationError.message && validationError.message.includes('迁移文件不完整')) {
        console.error('[数据库] 迁移文件验证失败:', validationError.message);
        throw validationError; // 中断迁移过程
      }
      // 如果是其他错误（如新数据库还没有knex_migrations表），则继续执行
      console.log('[数据库] 迁移文件验证跳过:', error.message || String(error));
    }
    
    // 运行所有待执行的迁移，默认启用迁移文件列表验证
    console.log('[数据库] 开始执行迁移...');
    await db.migrate.latest({
      // 禁用自动事务，确保每个迁移在自己的事务中执行
      // 这样单个迁移失败不会回滚所有迁移
      disableTransactions: true,
      // 强制验证迁移文件列表
      disableMigrationsListValidation: false
    });
    console.log('[数据库] 迁移完成');
    
    // 判断是否需要运行种子数据
    const needSeeds = process.env.RUN_SEEDS === 'true';
    if (needSeeds) {
      await db.seed.run();
      console.log('数据库种子数据已植入');
    }
    
    // 输出详细的数据库初始化信息
    const dbTypeInfo = db.client.config.client.includes('mysql') ? 'MySQL' : 'SQLite';
    console.log(`数据库初始化成功 (类型: ${dbTypeInfo})`);
  } catch (error) {
    // 检查错误是否与迁移文件缺失有关
    const errorMessage = String(error);
    if (errorMessage.includes('migration directory is corrupt') || 
        errorMessage.includes('files are missing')) {
      console.error('数据库迁移文件缺失错误:', error);
      console.error('请检查迁移文件是否完整，或删除数据库重新初始化');
      console.error('你可以删除以下文件重新初始化数据库:');
      console.error('SQLite: 删除 backend/db/infini.sqlite3');
      console.error('MySQL: 执行 backend/reset-mysql.sql');
      // 抛出错误中断应用启动，确保问题被解决
      throw new Error('数据库迁移文件缺失，应用无法启动');
    } else {
      console.error('数据库初始化失败:', error);
      throw error;
    }
  }
}

// 初始化代理池相关表
async function initProxyTables(): Promise<void> {
  try {
    // 检查代理池表是否存在
    const proxyPoolTableExists = await db.schema.hasTable('proxy_pools');
    
    // 如果表不存在，则创建相关表
    if (!proxyPoolTableExists) {
      console.log('代理池表不存在，正在创建...');
      
      // 创建proxy_pools表
      await db.schema.createTable('proxy_pools', table => {
        table.increments('id').primary();
        table.string('name', 255).notNullable().unique();
        table.text('description');
        table.string('proxy_mode', 50).notNullable().defaultTo('none');
        table.boolean('enabled').defaultTo(true);
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
      });
      
      // 创建proxy_servers表
      await db.schema.createTable('proxy_servers', table => {
        table.increments('id').primary();
        table.integer('pool_id').notNullable();
        table.string('name', 255).notNullable();
        table.string('proxy_type', 20).notNullable();
        table.string('host', 255).notNullable();
        table.integer('port').notNullable();
        table.string('username', 255);
        table.string('password', 255);
        table.boolean('enabled').defaultTo(true);
        table.boolean('is_healthy').defaultTo(true);
        table.timestamp('last_check_at');
        table.integer('response_time');
        table.integer('success_count').defaultTo(0);
        table.integer('failure_count').defaultTo(0);
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
        table.foreign('pool_id').references('id').inTable('proxy_pools').onDelete('CASCADE');
      });
      
      // 创建proxy_usage_stats表
      await db.schema.createTable('proxy_usage_stats', table => {
        table.increments('id').primary();
        table.integer('proxy_id').notNullable();
        table.date('date').notNullable();
        table.integer('request_count').defaultTo(0);
        table.integer('success_count').defaultTo(0);
        table.integer('failure_count').defaultTo(0);
        table.integer('avg_response_time').defaultTo(0);
        table.timestamp('created_at').defaultTo(db.fn.now());
        table.timestamp('updated_at').defaultTo(db.fn.now());
        table.foreign('proxy_id').references('id').inTable('proxy_servers').onDelete('CASCADE');
        table.unique(['proxy_id', 'date']);
      });
      
      // 创建索引
      await db.raw('CREATE INDEX idx_proxy_servers_pool_id ON proxy_servers(pool_id)');
      await db.raw('CREATE INDEX idx_proxy_servers_enabled ON proxy_servers(enabled)');
      await db.raw('CREATE INDEX idx_proxy_servers_healthy ON proxy_servers(is_healthy)');
      await db.raw('CREATE INDEX idx_proxy_usage_stats_date ON proxy_usage_stats(date)');
      
      // 插入默认代理池
      await db('proxy_pools').insert({
        id: 1,
        name: 'default',
        description: '默认代理池',
        proxy_mode: 'none',
        enabled: true,
        created_at: new Date(),
        updated_at: new Date()
      });
      
      console.log('代理池相关表已成功创建');
    }
  } catch (error) {
    console.error('初始化代理池表失败:', error);
    throw error;
  }
}

export default db;