/**
 * 定时任务处理器集合
 * 包含各种预定义的任务执行函数
 */
import { InfiniAccountService } from './InfiniAccountService';
import db from '../db/db';

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
                last_sync_at: new Date(),
                updated_at: new Date()
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
              last_sync_at: new Date(),
              updated_at: new Date()
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

// 导出所有处理器
export const taskHandlers = {
  syncAccountsInfo
};

export default taskHandlers; 