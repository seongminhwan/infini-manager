/**
 * Axios日志服务
 * 用于记录所有axios请求和响应，确保金融交易数据不会丢失
 */
import db from '../db/db';

export interface AxiosRequestLog {
  request_url: string;
  request_method: string;
  duration_ms: number;
  response_status?: number;
  request_body?: string;
  response_data?: string;
  request_headers?: string;
  error_message?: string;
  is_success: boolean;
}

export class AxiosLoggingService {
  /**
   * 记录axios请求日志
   * @param logData 日志数据
   */
  static async logRequest(logData: AxiosRequestLog): Promise<number> {
    try {
      console.log(`记录API请求日志: ${logData.request_method} ${logData.request_url} - 耗时: ${logData.duration_ms}ms - 状态: ${logData.response_status || 'N/A'}`);
      
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
   * 获取指定时间范围内的请求日志
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @param page 页码
   * @param pageSize 每页条数
   */
  static async getRequestLogs(
    startDate?: Date,
    endDate?: Date,
    page: number = 1,
    pageSize: number = 50
  ) {
    try {
      const query = db('axios_request_logs')
        .select('*')
        .orderBy('created_at', 'desc');
      
      // 添加日期过滤
      if (startDate) {
        query.where('created_at', '>=', startDate);
      }
      
      if (endDate) {
        query.where('created_at', '<=', endDate);
      }
      
      // 分页
      const offset = (page - 1) * pageSize;
      query.limit(pageSize).offset(offset);
      
      // 获取总记录数
      const countQuery = db('axios_request_logs').count('id as total');
      
      if (startDate) {
        countQuery.where('created_at', '>=', startDate);
      }
      
      if (endDate) {
        countQuery.where('created_at', '<=', endDate);
      }
      
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
}