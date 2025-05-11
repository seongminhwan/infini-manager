import React, { useState, useEffect, useRef } from 'react';
import { Card, Typography, Spin, Timeline, Empty, Tag, Space, Tooltip, Button } from 'antd';
import { CloseOutlined, ReloadOutlined } from '@ant-design/icons';
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
  // 兼容原TransferTimeline组件接口
  visible?: boolean;
  sourceAccountId?: string | number;
  targetAccountId?: string | number;
  isInternal?: boolean;
  onClose?: () => void;
  
  // TransferHistoryDetail原接口
  transferId?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 转账历史记录详情组件
 * 用于显示转账历史记录时间轴，兼容TransferTimeline接口
 */
const TransferHistoryDetail: React.FC<TransferHistoryDetailProps> = ({ 
  // 兼容TransferTimeline接口的属性
  visible = true,
  sourceAccountId,
  targetAccountId,
  isInternal = true,
  onClose,
  
  // 原TransferHistoryDetail属性
  transferId, 
  className,
  style 
}) => {
  const [transferHistory, setTransferHistory] = useState<any[]>([]);
  const [transferRecords, setTransferRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);
  
  const actualTransferId = useRef<string | number | undefined>(transferId);
  
  // 停止轮询
  const stopPolling = () => {
    console.log('停止轮询...');
    if (pollingInterval) {
      clearInterval(pollingInterval);
      setPollingInterval(null);
    }
  };
  
  // 开始轮询转账历史记录（每秒刷新一次）
  const startPolling = (id?: string | number) => {
    // 先停止现有的轮询
    stopPolling();
    
    if (!id) return;
    
    // 先检查转账历史记录中是否已有最终态，如果有则不启动轮询
    const hasCompletedHistory = transferHistory.some(
      history => history.status === 'completed' || history.status === 'failed'
    );
    
    if (hasCompletedHistory) {
      console.log(`转账ID ${id} 已有最终态记录，不启动轮询`);
      return;
    }
    
    console.log(`开始轮询转账ID ${id} 的历史记录`);
    // 设置1秒的轮询间隔
    const interval = setInterval(() => {
      fetchTransferHistory(id);
    }, 1000);
    
    setPollingInterval(interval);
  };
  
  // 组件卸载时停止轮询
  useEffect(() => {
    return () => stopPolling();
  }, []);
  
  // 获取单笔转账历史记录
  const fetchTransferHistory = async (id?: string | number) => {
    if (!id) return;
    
    setLoading(true);
    try {
      const response = await transferApi.getTransferHistory(id.toString());
      if (response.success && response.data && response.data.histories) {
        setTransferHistory(response.data.histories);
        
        // 检查是否有最终状态的记录（已完成或失败）
        const completedHistories = response.data.histories.filter(
          (history: any) => history.status === 'completed' || history.status === 'failed'
        );
        
        // 如果转账已达到最终状态，打印日志并立即停止轮询
        if (completedHistories.length > 0) {
          console.log(`检测到转账ID ${id} 的最终态: ${completedHistories.map((h: any) => h.status).join(', ')}`);
          console.log('停止历史记录轮询');
          
          // 确保轮询被停止
          if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
          }
        } else {
          console.log(`转账ID ${id} 尚未达到最终态，继续轮询`);
        }
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
  
  // 获取指定账户的转账记录
  const fetchAccountTransfers = async (accountId: string | number) => {
    setLoading(true);
    try {
      const response = await transferApi.getTransfers(
        accountId.toString(),  // accountId
        undefined,             // status (不筛选)
        1,                     // page
        10                     // pageSize
      );
      if (response.success && response.data && response.data.transfers) {
        setTransferRecords(response.data.transfers);
        
        // 获取第一条记录的历史
        if (response.data.transfers.length > 0) {
          const firstTransfer = response.data.transfers[0];
          actualTransferId.current = firstTransfer.id;
          await fetchTransferHistory(firstTransfer.id);
        }
      } else {
        setTransferRecords([]);
      }
    } catch (error) {
      console.error('获取账户转账记录失败:', error);
      setTransferRecords([]);
    } finally {
      setLoading(false);
    }
  };
  
  // 刷新数据
  const refreshData = () => {
    if (transferId) {
      fetchTransferHistory(transferId);
    } else if (sourceAccountId) {
      fetchAccountTransfers(sourceAccountId);
    }
  };
  
  // 加载转账历史记录
  useEffect(() => {
    // 单笔转账记录详情
    if (transferId) {
      actualTransferId.current = transferId;
      fetchTransferHistory(transferId);
      // 开始轮询该transferId的历史记录
      startPolling(transferId);
    } 
    // 账户转账记录列表
    else if (sourceAccountId) {
      fetchAccountTransfers(sourceAccountId);
    }
    
    // 返回清理函数
    return () => {
      stopPolling();
    };
  }, [transferId, sourceAccountId]);

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

  // 如果不可见，不渲染组件
  if (!visible) return null;

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
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '10px' }}>转账历史记录</span>
            {actualTransferId.current && (
              <Tooltip title="转账ID">
                <Tag color="blue">ID: {actualTransferId.current}</Tag>
              </Tooltip>
            )}
          </div>
          <div>
            <Button 
              type="text" 
              icon={<ReloadOutlined />} 
              onClick={refreshData}
              style={{ marginRight: '8px' }}
            />
            {onClose && (
              <Button 
                type="text" 
                icon={<CloseOutlined />} 
                onClick={onClose}
              />
            )}
          </div>
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
                  key={`history-${actualTransferId.current}-${index}`}
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
                              {history.details.result && Object.keys(history.details.result).length > 0 && (
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