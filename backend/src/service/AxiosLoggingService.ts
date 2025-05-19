/**
 * Axios日志服务
 * 用于记录所有axios请求和响应，确保金融交易数据不会丢失
 */
import db from '../db/db';

export interface AxiosRequestLog {
  url: string;
  method: string;
  duration_ms: number;
  status_code?: number;
  request_body?: string;
  response_body?: string;
  request_headers?: string;
  response_headers?: string;
  error_message?: string;
  success: boolean; // 修改字段名，与数据库列名保持一致
  
  // 业务上下文字段
  business_module?: string;      // 业务模块名称
  business_operation?: string;   // 业务操作类型
  business_context?: string;     // 业务上下文数据(JSON字符串)
}

export interface LogQueryOptions {
  startDate?: Date;
  endDate?: Date;
  businessModule?: string;
  businessOperation?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  success?: boolean;
  page?: number;
  pageSize?: number;
}

export class AxiosLoggingService {
  /**
   * 记录axios请求日志
   * @param logData 日志数据
   */
  static async logRequest(logData: AxiosRequestLog): Promise<number> {
    try {
      console.log(`记录API请求日志: ${logData.method} ${logData.url} - 耗时: ${logData.duration_ms}ms - 状态: ${logData.status_code || 'N/A'}`);
      
      // 创建日志记录
      const [logId] = await db('axios_request_logs').insert(logData);
      
      console.log(`API请求日志记录成功，ID: ${logId}`);
      return logId;
    } catch (error) {
      // 即使日志记录失败，也不应该影响主要业务流程
      console.error('记录API请求日志失败:', error);
      return 0;
    }
  }

  /**
   * 获取请求日志，支持多种筛选条件和分页
   * @param options 查询选项
   */
  static async getRequestLogs(options: LogQueryOptions = {}) {
    try {
      const {
        startDate,
        endDate,
        businessModule,
        businessOperation,
        url,
        method,
        statusCode,
        success,
        page = 1,
        pageSize = 50
      } = options;

      // 构建查询
      const query = db('axios_request_logs')
        .select('*')
        .orderBy('created_at', 'desc');
      
      // 构建计数查询
      const countQuery = db('axios_request_logs').count('id as total');
      
      // 应用所有筛选条件（同时应用到主查询和计数查询）
      
      // 添加日期过滤
      if (startDate) {
        query.where('created_at', '>=', startDate);
        countQuery.where('created_at', '>=', startDate);
      }
      
      if (endDate) {
        query.where('created_at', '<=', endDate);
        countQuery.where('created_at', '<=', endDate);
      }
      
      // 添加业务上下文筛选
      if (businessModule) {
        query.where('business_module', businessModule);
        countQuery.where('business_module', businessModule);
      }
      
      if (businessOperation) {
        query.where('business_operation', businessOperation);
        countQuery.where('business_operation', businessOperation);
      }
      
      // 添加其他筛选条件
      if (url) {
        query.where('url', 'like', `%${url}%`);
        countQuery.where('url', 'like', `%${url}%`);
      }
      
      if (method) {
        query.where('method', method);
        countQuery.where('method', method);
      }
      
      if (statusCode) {
        query.where('status_code', statusCode);
        countQuery.where('status_code', statusCode);
      }
      
      if (success !== undefined) {
        query.where('success', success);
        countQuery.where('success', success);
      }
      
      // 分页
      const offset = (page - 1) * pageSize;
      query.limit(pageSize).offset(offset);
      
      // 执行查询
      const [countResult] = await countQuery;
      const total = (countResult as any).total || 0;
      
      const logs = await query;
      
      return {
        logs,
        pagination: {
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        }
      };
    } catch (error) {
      console.error('获取API请求日志失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有业务模块列表（去重）
   */
  static async getBusinessModules(): Promise<string[]> {
    try {
      const results = await db('axios_request_logs')
        .distinct('business_module')
        .whereNotNull('business_module')
        .orderBy('business_module');
      
      return results.map(item => item.business_module);
    } catch (error) {
      console.error('获取业务模块列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取指定业务模块下的所有操作类型列表（去重）
   * @param businessModule 业务模块名称，如果不指定则获取所有操作类型
   */
  static async getBusinessOperations(businessModule?: string): Promise<string[]> {
    try {
      const query = db('axios_request_logs')
        .distinct('business_operation')
        .whereNotNull('business_operation')
        .orderBy('business_operation');
      
      if (businessModule) {
        query.where('business_module', businessModule);
      }
      
      const results = await query;
      return results.map(item => item.business_operation);
    } catch (error) {
      console.error('获取业务操作类型列表失败:', error);
      throw error;
    }
  }
}