/**
 * 定时任务处理器集合
 * 包含各种预定义的任务执行函数
 */
import { InfiniAccountService } from './InfiniAccountService';
import db from '../db/db';
import EmailSyncService from './EmailSyncService'; // 导入 EmailSyncService

/**
 * 同步账户信息处理器
 * @param params 任务参数，包含账户筛选配置
 */
export const syncAccountsInfo = async (params: any): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    console.log('开始执行账户同步任务，参数:', JSON.stringify(params, null, 2));
    
    const infiniAccountService = new InfiniAccountService();
    const results = {
      totalAccounts: 0,
      successCount: 0,
      errorCount: 0,
      errors: [] as string[]
    };

    // 解析筛选配置
    const filterConfig = params || {};
    let targetAccountIds: string[] = [];

    if (filterConfig.type === 'list' && filterConfig.selectedAccountIds) {
      // 列表筛选模式
      targetAccountIds = filterConfig.selectedAccountIds;
      console.log(`使用列表筛选模式，选中账户数量: ${targetAccountIds.length}`);
    } else if (filterConfig.type === 'script' && filterConfig.selectedAccountIds) {
      // 脚本筛选模式（前端已经执行筛选，这里直接使用结果）
      targetAccountIds = filterConfig.selectedAccountIds;
      console.log(`使用脚本筛选模式，匹配账户数量: ${targetAccountIds.length}`);
    } else {
      // 如果没有指定筛选条件，同步所有活跃账户
      console.log('未指定筛选条件，将同步所有活跃账户');
      const allAccountsResponse = await infiniAccountService.getAllInfiniAccounts();
      if (allAccountsResponse.success && allAccountsResponse.data) {
        targetAccountIds = allAccountsResponse.data
          .filter((account: any) => account.status === 'active')
          .map((account: any) => account.id.toString());
      }
    }

    if (targetAccountIds.length === 0) {
      return {
        success: true,
        message: '没有找到需要同步的账户',
        data: results
      };
    }

    results.totalAccounts = targetAccountIds.length;
    console.log(`开始同步 ${results.totalAccounts} 个账户`);

    // 批量同步账户信息
    for (let i = 0; i < targetAccountIds.length; i++) {
      const accountId = targetAccountIds[i];
      
      try {
        console.log(`正在同步账户 ${i + 1}/${results.totalAccounts}: ${accountId}`);
        
        // 获取账户信息
        const accountResponse = await infiniAccountService.getInfiniAccountById(accountId);
        if (!accountResponse.success || !accountResponse.data) {
          throw new Error(`获取账户信息失败: ${accountResponse.message}`);
        }

        const account = accountResponse.data;
        
        // 如果账户有有效的cookie，尝试同步最新信息
        if (account.cookie && account.cookieExpiresAt && new Date(account.cookieExpiresAt) > new Date()) {
          console.log(`账户 ${accountId} 有有效cookie，尝试同步最新信息`);
          
          // 调用同步方法（这里可以根据需要调用不同的同步方法）
          const syncResponse = await infiniAccountService.syncInfiniAccount(accountId);
          
          if (syncResponse.success) {
            console.log(`账户 ${accountId} 同步成功`);
            results.successCount++;
            
            // 更新最后同步时间
            await db('infini_accounts')
              .where('id', accountId)
              .update({
                last_sync_at: Date.now(), // 使用毫秒级时间戳替代Date对象
                updated_at: Date.now() // 使用毫秒级时间戳替代Date对象
              });
          } else {
            throw new Error(syncResponse.message || '同步失败');
          }
        } else {
          console.log(`账户 ${accountId} 没有有效cookie，跳过同步但更新同步时间`);
          
          // 更新最后同步尝试时间
          await db('infini_accounts')
            .where('id', accountId)
            .update({
              last_sync_at: Date.now(), // 使用毫秒级时间戳替代Date对象
              updated_at: Date.now() // 使用毫秒级时间戳替代Date对象
            });
          
          results.successCount++;
        }

        // 添加延迟以避免频率限制
        if (i < targetAccountIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒延迟
        }
        
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`同步账户 ${accountId} 失败:`, errMsg);
        
        results.errorCount++;
        results.errors.push(`账户 ${accountId}: ${errMsg}`);
        
        // 记录错误，但继续处理其他账户
        continue;
      }
    }

    const message = `账户同步完成。总数: ${results.totalAccounts}, 成功: ${results.successCount}, 失败: ${results.errorCount}`;
    console.log(message);

    return {
      success: true,
      message,
      data: results
    };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('账户同步任务执行失败:', errMsg);
    
    return {
      success: false,
      message: `账户同步任务执行失败: ${errMsg}`
    };
  }
};

/**
 * 其他任务处理器可以在这里添加
 */

/**
 * 增量同步所有活动邮箱的邮件
 * @param params 任务参数 (当前未使用)
 */
export const syncAllEmailsIncrementally = async (params: any): Promise<{ success: boolean; message: string; data?: any }> => {
  try {
    console.log('开始执行增量邮件同步任务，参数:', JSON.stringify(params, null, 2));
    const emailSyncService = EmailSyncService; // 使用导入的单例

    const results = {
      totalAccounts: 0,
      syncedAccounts: 0,
      failedAccounts: 0,
      errors: [] as { accountId: number; error: string }[]
    };

    let accountsToSync = [];

    // 检查是否有指定的账户ID列表
    if (params && params.accountIds && Array.isArray(params.accountIds) && params.accountIds.length > 0) {
      // 使用配置中指定的账户ID
      console.log(`使用配置中指定的账户列表进行同步，账户数量: ${params.accountIds.length}`);
      
      // 获取这些ID对应的活动账户
      accountsToSync = await db('email_accounts')
        .whereIn('id', params.accountIds)
        .where({ status: 'active' })
        .select('id');
      
      console.log(`在指定的账户中找到 ${accountsToSync.length} 个活动账户`);
    } else {
      // 没有指定账户ID，获取所有活动账户,但跳过启用了IDLE连接的账户
      console.log('未指定账户列表，将同步所有活动且未启用IDLE连接的邮箱账户');
      accountsToSync = await db('email_accounts')
        .where({ status: 'active' })
        .where(function() {
          this.where('use_idle_connection', false)
            .orWhereNull('use_idle_connection');
        })
        .select('id');
      
      console.log(`找到 ${accountsToSync.length} 个需要同步的活动邮箱账户(已排除使用IDLE连接的账户)`);
    }

    results.totalAccounts = accountsToSync.length;

    if (results.totalAccounts === 0) {
      return {
        success: true,
        message: '没有找到需要同步的活动邮箱账户',
        data: results
      };
    }

    console.log(`开始同步 ${results.totalAccounts} 个邮箱账户...`);

      // 遍历这些账户，并为每个账户调用增量同步
      for (const account of accountsToSync) {
        const accountId = account.id;
        try {
          // 再次检查账户是否启用了IDLE连接(以防在此期间被修改)
          const accountDetail = await db('email_accounts')
            .where({ id: accountId })
            .first('use_idle_connection');
            
          if (accountDetail && accountDetail.use_idle_connection === true) {
            console.log(`账户 ID: ${accountId} 已启用IDLE连接,跳过定时同步`);
            continue;
          }
          
          console.log(`开始为账户 ID: ${accountId} 执行增量邮件同步`);
          // 默认同步 INBOX，不指定日期范围，由 EmailSyncService 内部逻辑处理增量
          const syncLogId = await emailSyncService.syncEmails(accountId, 'incremental');
          console.log(`账户 ID: ${accountId} 的增量同步任务已启动，同步日志 ID: ${syncLogId}`);
          results.syncedAccounts++;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`为账户 ID: ${accountId} 执行增量邮件同步失败:`, errMsg);
        results.failedAccounts++;
        results.errors.push({ accountId, error: errMsg });
      }
    }

    const message = `增量邮件同步任务完成。总账户数: ${results.totalAccounts}, 成功启动同步: ${results.syncedAccounts}, 启动失败: ${results.failedAccounts}`;
    console.log(message);

    return {
      success: true,
      message,
      data: results
    };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('增量邮件同步任务执行失败:', errMsg);
    return {
      success: false,
      message: `增量邮件同步任务执行失败: ${errMsg}`
    };
  }
};


// 导出所有处理器
export const taskHandlers = {
  syncAccountsInfo,
  syncAllEmailsIncrementally // 添加新的处理器
};

export default taskHandlers;