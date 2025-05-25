import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * 数据库备份工具
 * 用于在数据库操作前自动备份数据库文件
 */

// 获取工作目录
const workDir = process.cwd();
// 数据库目录
const dbDir = path.join(workDir, 'db');
// 备份目录
const backupDir = path.join(dbDir, 'backups');

/**
 * 确保备份目录存在
 */
export function ensureBackupDirExists(): void {
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`[备份] 创建备份目录: ${backupDir}`);
  }
}

/**
 * 备份SQLite数据库文件
 * @param dbName 数据库文件名，默认为infini.sqlite3
 * @returns 备份文件路径
 */
export function backupSqliteDatabase(dbName: string = 'infini.sqlite3'): string | null {
  try {
    // 确保备份目录存在
    ensureBackupDirExists();

    // 数据库文件路径
    const dbFilePath = path.join(dbDir, dbName);
    
    // 检查数据库文件是否存在
    if (!fs.existsSync(dbFilePath)) {
      console.log(`[备份] 数据库文件不存在: ${dbFilePath}`);
      return null;
    }

    // 生成带时间戳的备份文件名
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const backupFileName = `${dbName}.backup.${timestamp}`;
    const backupFilePath = path.join(backupDir, backupFileName);

    // 复制数据库文件
    fs.copyFileSync(dbFilePath, backupFilePath);
    console.log(`[备份] 数据库已备份到: ${backupFilePath}`);

    // 清理旧备份文件 (保留最近7天的备份)
    cleanOldBackups();

    return backupFilePath;
  } catch (error) {
    console.error('[备份] 备份数据库时出错:', error);
    return null;
  }
}

/**
 * 清理旧备份文件，默认保留最近7天的备份
 * @param daysToKeep 要保留的天数
 */
export function cleanOldBackups(daysToKeep: number = 7): void {
  try {
    // 确保备份目录存在
    if (!fs.existsSync(backupDir)) {
      return;
    }

    // 获取当前时间
    const now = new Date().getTime();
    // 计算要保留的最早时间点
    const earliestTimeToKeep = now - (daysToKeep * 24 * 60 * 60 * 1000);

    // 读取备份目录中的文件
    const files = fs.readdirSync(backupDir);
    let deletedCount = 0;

    // 遍历文件
    for (const file of files) {
      if (file.startsWith('infini.sqlite3.backup.')) {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        
        // 如果文件修改时间早于earliestTimeToKeep，则删除
        if (stats.mtimeMs < earliestTimeToKeep) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
    }

    if (deletedCount > 0) {
      console.log(`[备份] 已清理 ${deletedCount} 个过期备份文件`);
    }
  } catch (error) {
    console.error('[备份] 清理旧备份文件时出错:', error);
  }
}

/**
 * 恢复数据库备份
 * @param backupFilePath 备份文件路径
 * @param dbName 数据库文件名，默认为infini.sqlite3
 * @returns 是否恢复成功
 */
export function restoreFromBackup(backupFilePath: string, dbName: string = 'infini.sqlite3'): boolean {
  try {
    // 数据库文件路径
    const dbFilePath = path.join(dbDir, dbName);
    
    // 检查备份文件是否存在
    if (!fs.existsSync(backupFilePath)) {
      console.error(`[恢复] 备份文件不存在: ${backupFilePath}`);
      return false;
    }

    // 如果当前数据库文件存在，先创建一个临时备份
    if (fs.existsSync(dbFilePath)) {
      const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
      const tempBackupPath = path.join(dbDir, `${dbName}.before_restore.${timestamp}`);
      fs.copyFileSync(dbFilePath, tempBackupPath);
      console.log(`[恢复] 当前数据库已备份到: ${tempBackupPath}`);
    }

    // 复制备份文件到数据库文件
    fs.copyFileSync(backupFilePath, dbFilePath);
    console.log(`[恢复] 已从备份恢复数据库: ${backupFilePath}`);

    return true;
  } catch (error) {
    console.error('[恢复] 恢复数据库时出错:', error);
    return false;
  }
}

/**
 * 列出所有可用的备份
 * @returns 备份文件列表
 */
export function listBackups(): string[] {
  try {
    // 确保备份目录存在
    if (!fs.existsSync(backupDir)) {
      return [];
    }

    // 读取备份目录中的文件
    const files = fs.readdirSync(backupDir);
    
    // 过滤出备份文件
    const backups = files.filter(file => file.startsWith('infini.sqlite3.backup.'));
    
    // 按时间排序（最新的在前）
    backups.sort((a, b) => {
      const statsA = fs.statSync(path.join(backupDir, a));
      const statsB = fs.statSync(path.join(backupDir, b));
      return statsB.mtimeMs - statsA.mtimeMs;
    });

    return backups;
  } catch (error) {
    console.error('[备份] 列出备份文件时出错:', error);
    return [];
  }
}

export default {
  backupSqliteDatabase,
  restoreFromBackup,
  listBackups,
  cleanOldBackups,
};