/**
 * 数据库连接初始化模块
 */
import knex, { Knex } from 'knex';
import path from 'path';
import fs from 'fs';

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

// 初始化数据库
export async function initializeDatabase(): Promise<void> {
  try {
    // 运行所有待执行的迁移
    await db.migrate.latest();
    console.log('数据库迁移完成');
    
    // 判断是否需要运行种子数据
    const needSeeds = process.env.RUN_SEEDS === 'true';
    if (needSeeds) {
      await db.seed.run();
      console.log('数据库种子数据已植入');
    }
    
    console.log('数据库初始化成功');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

export default db;