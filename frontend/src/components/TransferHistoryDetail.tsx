import React, { useState, useEffect } from 'react';
import { Card, Typography, Spin, Timeline, Empty, Tag, Space, Tooltip } from 'antd';
import { transferApi } from '../services/api';
import styled from 'styled-components';

const { Text } = Typography;

// 样式组件
const HistoryContainer = styled.div`
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const HistoryHeader = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  background-color: #fafafa;
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const HistoryContent = styled.div`
  flex-grow: 1;
  height: 680px;
  overflow-y: auto;
  padding: 16px;
  background-color: #fff;
  background-image: linear-gradient(to bottom, rgba(240, 249, 255, 0.2), transparent);
`;

const TimeLabel = styled.span`
  font-weight: bold;
  color: #1890ff;
  font-size: 14px;
  background-color: #f0f8ff;
  padding: 4px 8px;
  border-radius: 4px;
  display: inline-block;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
`;

// 接口定义
interface TransferHistoryDetailProps {
  transferId: string | number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 转账历史记录详情组件
 * 用于显示单笔转账的历史记录时间轴
 */
const TransferHistoryDetail: React.FC<TransferHistoryDetailProps> = ({ 
  transferId, 
  className,
  style 
}) => {
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 获取转账历史记录
  useEffect(() => {
    if (!transferId) return;
    
    const fetchTransferHistory = async () => {
      setLoading(true);
      try {
        const response = await transferApi.getTransferHistory(transferId.toString());
        if (response.success && response.data && response.data.histories) {
          setTransferHistory(response.data.histories);
        } else {
          setTransferHistory([]);
        }
      } catch (error) {
        console.error('获取转账历史记录失败:', error);
        setTransferHistory([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTransferHistory();
  }, [transferId]);

  // 格式化日期时间
  const formatDateTime = (dateValue: string | number | undefined): string => {
    if (!dateValue) return '-';
    
    try {
      // 处理毫秒级时间戳
      if (typeof dateValue === 'number') {
        // 确保是合理的时间戳 (判断长度为13位的毫秒时间戳)
        if (String(dateValue).length >= 13) {
          const date = new Date(dateValue);
          return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          });
        } else if (String(dateValue).length === 10) {
          // 处理10位的秒级时间戳
          const date = new Date(dateValue * 1000);
          return date.toLocaleString('zh-CN');
        }
        return new Date(dateValue).toLocaleString('zh-CN');
      }
      
      // 处理字符串日期
      return new Date(dateValue).toLocaleString('zh-CN');
    } catch (error) {
      console.error('日期格式化错误:', error, dateValue);
      return String(dateValue);
    }
  };
  
  // 获取状态标签颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'processing':
        return 'processing';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  // 获取转账来源标签文本
  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'manual':
        return '手动转账';
      case 'affiliate':
        return 'Affiliate返利';
      case 'batch':
        return '批量转账';
      case 'scheduled':
        return '定时任务';
      default:
        return source;
    }
  };

  return (
    <Card 
      style={{ 
        borderRadius: '8px', 
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        height: '100%',
        ...style
      }}
      bodyStyle={{ 
        padding: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
      className={className}
    >
      <HistoryContainer>
        <HistoryHeader>
          <span>转账历史记录</span>
          {transferId && (
            <Tooltip title="转账ID">
              <Tag color="blue">ID: {transferId}</Tag>
            </Tooltip>
          )}
        </HistoryHeader>
        <HistoryContent>
          {/* 加载状态 */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <p>加载转账历史记录...</p>
            </div>
          ) : transferHistory && transferHistory.length > 0 ? (
            // 显示历史记录时间轴
            <Timeline
              mode="left"
              style={{ fontSize: '14px' }}
            >
              {transferHistory.map((history, index) => (
                <Timeline.Item
                  key={`history-${transferId}-${index}`}
                  color={getStatusColor(history.status || 'processing')}
                  label={
                    <TimeLabel>
                      {history.createdAt ? formatDateTime(history.createdAt) : '-'}
                    </TimeLabel>
                  }
                >
                  <Card 
                    size="small"
                    style={{
                      borderRadius: '8px',
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                      marginBottom: '12px'
                    }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {/* 历史记录标题和状态 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                          <Tag color={getStatusColor(history.status || 'processing')}>
                            {history.status === 'completed' ? '完成' : 
                             history.status === 'pending' ? '待处理' : 
                             history.status === 'processing' ? '处理中' : 
                             history.status === 'failed' ? '失败' : history.status}
                          </Tag>
                          <Text style={{ marginLeft: 8, fontWeight: 'bold' }}>
                            {history.message}
                          </Text>
                        </div>
                        <Text type="secondary">
                          {formatDateTime(history.createdAt)}
                        </Text>
                      </div>
                      
                      {/* 根据状态渲染不同的详情内容 */}
                      {history.details && (
                        <div style={{ marginTop: 12, background: '#fafafa', padding: 12, borderRadius: 4 }}>
                          {/* pending状态：显示账户和转账基本信息 */}
                          {history.status === 'pending' && history.details.accountId && (
                            <div>
                              {history.details.matchedInternalAccount && (
                                <div style={{ marginBottom: 8 }}>
                                  <Text strong>匹配账户: </Text>
                                  <Text>{history.details.matchedInternalAccount.email} (UID: {history.details.matchedInternalAccount.uid})</Text>
                                </div>
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                <Tag color="blue">金额: ${history.details.amount}</Tag>
                                <Tag color="purple">来源: {getSourceLabel(history.details.source || 'manual')}</Tag>
                                {history.details.originalContactType && (
                                  <Tag color="orange">
                                    原始类型: {history.details.originalContactType}
                                  </Tag>
                                )}
                                {history.details.remarks && (
                                  <Tag>备注: {history.details.remarks}</Tag>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* processing状态：显示请求数据 */}
                          {history.status === 'processing' && history.details.requestData && (
                            <div>
                              <Text strong>请求数据: </Text>
                              <div style={{ marginTop: 4 }}>
                                {history.details.requestData.contactType && (
                                  <Tag color="cyan">类型: {history.details.requestData.contactType}</Tag>
                                )}
                                {history.details.requestData.user_id && (
                                  <Tag color="blue">用户ID: {history.details.requestData.user_id}</Tag>
                                )}
                                {history.details.requestData.amount && (
                                  <Tag color="green">金额: ${history.details.requestData.amount}</Tag>
                                )}
                                {history.details.requestData.email_verify_code && (
                                  <Tag color="purple">验证码: {history.details.requestData.email_verify_code}</Tag>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* processing状态(API响应)：显示API响应数据 */}
                          {history.status === 'processing' && history.details.apiResponse && (
                            <div>
                              <Text strong>API响应: </Text>
                              <div style={{ marginTop: 4 }}>
                                <Tag color={history.details.apiResponse.code === 0 ? 'success' : 'error'}>
                                  Code: {history.details.apiResponse.code}
                                </Tag>
                                {history.details.apiResponse.message && (
                                  <Tag>{history.details.apiResponse.message || '成功'}</Tag>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* completed状态：显示结果信息 */}
                          {history.status === 'completed' && (
                            <div>
                              <Text strong>转账完成</Text>
                              {Object.keys(history.details.result || {}).length > 0 && (
                                <div style={{ marginTop: 4 }}>
                                  <Text type="secondary">{JSON.stringify(history.details.result)}</Text>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* failed状态：显示错误信息 */}
                          {history.status === 'failed' && (
                            <div>
                              <Text type="danger" strong>失败原因: </Text>
                              <Text type="danger">{history.message}</Text>
                            </div>
                          )}
                          
                          {/* 其他未知状态：保留原始结构但更优雅地显示 */}
                          {!(['pending', 'processing', 'completed', 'failed'].includes(history.status)) && (
                            <div>
                              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                                {JSON.stringify(history.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* 备注信息 */}
                      {history.memo && (
                        <div style={{ marginTop: 8 }}>
                          <Text type="secondary">备注: {history.memo}</Text>
                        </div>
                      )}
                    </Space>
                  </Card>
                </Timeline.Item>
              ))}
            </Timeline>
          ) : (
            // 无历史记录时显示空状态
            <Empty description="暂无转账历史记录" />
          )}
        </HistoryContent>
      </HistoryContainer>
    </Card>
  );
};

export default TransferHistoryDetail;