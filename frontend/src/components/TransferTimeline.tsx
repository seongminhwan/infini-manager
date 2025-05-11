import React, { useState, useEffect, useRef } from 'react';
import { Timeline, Card, Typography, Empty, Spin, Badge, Tag, Input, Tooltip, Button, Space, Modal } from 'antd';
import { ClockCircleOutlined, ArrowRightOutlined, ReloadOutlined, CloseOutlined, HistoryOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { transferApi } from '../services/api';

const { Title, Text } = Typography;
const { Search } = Input;

// 转账历史记录接口
interface TransferHistory {
  id: string;
  transfer_id: string;
  status: string;
  details: string | object;
  memo: string;
  created_at: string | number;
}

// 转账历史记录响应接口
interface TransferHistoryResponse {
  transfer: TransferRecord;
  histories: TransferHistory[];
}

// 样式组件
const TimelineContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 16px;
  background-color: #fafafa;
  border-radius: 8px;
`;

const TimelineCard = styled(Card)`
  cursor: pointer;
  margin-bottom: 12px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  border: 1px solid #f0f0f0;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    border-color: #e6f7ff;
  }
`;

const HistoryModalContent = styled.div`
  max-height: 60vh;
  overflow-y: auto;
  padding: 0 16px;
`;

const TimelineHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const ScrollContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
`;

const HeaderControls = styled.div`
  display: flex;
  align-items: center;
  margin-right: 10px;
`;

const PollingControls = styled.div`
  display: flex;
  align-items: center;
  background: #f8f8f8;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 4px 8px;
  margin-right: 12px;
`;

const IntervalControls = styled.div`
  display: flex;
  align-items: center;
  margin-right: 12px;
`;

const CloseButton = styled(Button)`
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
`;

// 转账记录项接口
interface TransferRecord {
  id: string;
  sourceAccount: {
    id: string;
    email: string;
    uid: string;
  };
  targetAccount?: {
    id?: string;
    email?: string;
    uid?: string;
  };
  targetIdentifier?: string | object;
  contactType: string;
  amount: string | object;
  status: string;
  createdAt: string | number;
  created_at?: string | number;
  source: string;
  remarks?: string;
}

// 组件属性接口
interface TransferTimelineProps {
  visible: boolean;
  sourceAccountId?: string;
  targetAccountId?: string;
  isInternal: boolean;
  onClose: () => void;
}

/**
 * 转账记录时间轴组件
 * 展示指定账户的转账记录，支持自定义轮询间隔
 */
const TransferTimeline: React.FC<TransferTimelineProps> = ({
  visible,
  sourceAccountId,
  targetAccountId,
  isInternal,
  onClose
}) => {
  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(1000); // 默认1秒
  const [isPolling, setIsPolling] = useState(true);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyData, setHistoryData] = useState<TransferHistoryResponse | null>(null);
  
  // 轮询定时器
  const pollingTimerRef = useRef<any>(null);
  
  // 获取转账记录函数
  const fetchTransferRecords = async () => {
    if (!sourceAccountId) return;
    
    try {
      setLoading(true);
      
      const response = await transferApi.getTransfers(
        sourceAccountId,
        undefined, // 状态参数设为undefined，获取所有状态
        1, // 页码
        50 // 获取较多记录
      );
      
      // 判断response.data的类型并正确处理
      if (response.success && response.data) {
        // 如果data是对象且包含transfers字段（嵌套结构）
        if (response.data.transfers && Array.isArray(response.data.transfers)) {
          console.log('获取到transfers数组数据:', response.data.transfers.length);
          setRecords(response.data.transfers);
        } 
        // 如果data本身是数组
        else if (Array.isArray(response.data)) {
          console.log('获取到数组数据:', response.data.length);
          setRecords(response.data);
        }
        // 如果data是其他格式，记录日志并设置为空数组避免报错
        else {
          console.error('获取到的数据格式不是预期的数组:', response.data);
          setRecords([]);
        }
      }
    } catch (error) {
      console.error('获取转账记录失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 获取转账历史记录
  const fetchTransferHistory = async (transferId: string) => {
    try {
      setHistoryLoading(true);
      const response = await transferApi.getTransferHistory(transferId);
      
      if (response.success && response.data) {
        setHistoryData(response.data);
      } else {
        setHistoryData(null);
      }
    } catch (error) {
      console.error('获取转账历史记录失败:', error);
      setHistoryData(null);
    } finally {
      setHistoryLoading(false);
    }
  };
  
  // 显示历史记录Modal
  const handleShowHistory = (transferId: string) => {
    setSelectedTransfer(transferId);
    setHistoryModalVisible(true);
    fetchTransferHistory(transferId);
  };
  
  // 关闭历史记录Modal
  const handleCloseHistoryModal = () => {
    setHistoryModalVisible(false);
    setSelectedTransfer(null);
    setHistoryData(null);
  };
  
  // 格式化日期时间
  const formatDateTime = (dateValue: string | number | undefined): string => {
    if (!dateValue) return '-';
    
    try {
      if (typeof dateValue === 'number') {
        return new Date(dateValue).toLocaleString('zh-CN');
      }
      return new Date(dateValue).toLocaleString('zh-CN');
    } catch (error) {
      console.error('日期格式化错误:', error);
      return String(dateValue);
    }
  };
  
  // 安全显示可能是对象的数据
  const safeRender = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  
  // 渲染历史记录时间轴
  const renderHistoryTimeline = () => {
    if (!historyData) return null;
    
    return (
      <Timeline mode="left">
        {historyData.histories.map((history) => (
          <Timeline.Item
            key={history.id}
            color={getStatusColor(history.status)}
            label={formatDateTime(history.created_at)}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Tag color={getStatusColor(history.status)}>
                  {history.status === 'completed' ? '完成' : 
                   history.status === 'pending' ? '待处理' : 
                   history.status === 'processing' ? '处理中' : 
                   history.status === 'failed' ? '失败' : history.status}
                </Tag>
              </div>
              {history.details && (
                <div>
                  <Text>{safeRender(history.details)}</Text>
                </div>
              )}
              {history.memo && (
                <div>
                  <Text type="secondary">备注: {history.memo}</Text>
                </div>
              )}
            </Space>
          </Timeline.Item>
        ))}
      </Timeline>
    );
  };
  
  // 启动/停止轮询
  useEffect(() => {
    if (visible && isPolling && sourceAccountId) {
      // 首次加载
      fetchTransferRecords();
      
      // 设置轮询定时器
      pollingTimerRef.current = setInterval(() => {
        fetchTransferRecords();
      }, pollingInterval);
    }
    
    // 清理定时器
    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [visible, isPolling, pollingInterval, sourceAccountId, targetAccountId]);
  
  // 切换轮询状态
  const togglePolling = () => {
    if (isPolling) {
      // 停止轮询
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    } else {
      // 重新开始轮询
      fetchTransferRecords();
      pollingTimerRef.current = setInterval(() => {
        fetchTransferRecords();
      }, pollingInterval);
    }
    
    setIsPolling(!isPolling);
  };
  
  // 手动刷新
  const handleManualRefresh = () => {
    fetchTransferRecords();
  };
  
  // 修改轮询间隔
  const handleIntervalChange = (value: string) => {
    const interval = parseInt(value);
    if (!isNaN(interval) && interval >= 500) {
      // 停止现有轮询
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
      
      // 设置新间隔
      setPollingInterval(interval);
      
      // 如果正在轮询，使用新间隔重启
      if (isPolling) {
        pollingTimerRef.current = setInterval(() => {
          fetchTransferRecords();
        }, interval);
      }
    }
  };
  
  // 获取状态标签颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return 'success';
      case 'pending':
      case 'processing':
        return 'processing';
      case 'failed':
        return 'error';
      case 'cancelled':
        return 'default';
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
  
  // 渲染转账记录时间轴
  const renderTimeline = () => {
    if (loading && records.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <p>加载转账记录...</p>
        </div>
      );
    }
    
    if (records.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无转账记录"
        />
      );
    }
    
      return (
      <Timeline
        mode="left"
        pending={loading ? "加载更多..." : false}
        pendingDot={loading ? <Spin size="small" /> : <ClockCircleOutlined />}
        style={{ fontSize: '14px' }}
      >
        {records.map(record => (
          <Timeline.Item
            key={record.id}
            color={getStatusColor(record.status)}
            label={
              <span style={{ 
                fontWeight: 'bold', 
                color: '#1890ff', 
                fontSize: '14px',
                backgroundColor: '#f0f8ff',
                padding: '2px 6px',
                borderRadius: '4px',
                display: 'inline-block'
              }}>
                {formatDateTime(record.createdAt)}
              </span>
            }
          >
            <TimelineCard 
              size="small"
              hoverable
              onClick={() => handleShowHistory(record.id)}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Tag color="blue">{getSourceLabel(record.source)}</Tag>
                  <Tag color={getStatusColor(record.status)}>
                    {record.status === 'completed' ? '完成' : 
                     record.status === 'pending' ? '待处理' : 
                     record.status === 'processing' ? '处理中' : 
                     record.status === 'failed' ? '失败' : record.status}
                  </Tag>
                  <Tooltip title="点击查看历史记录">
                    <Button 
                      type="link" 
                      size="small" 
                      icon={<HistoryOutlined />} 
                      style={{ float: 'right', padding: 0 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShowHistory(record.id);
                      }}
                    />
                  </Tooltip>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Text ellipsis style={{ maxWidth: '100%' }}>
                    <Text strong>源账户:</Text> {record.sourceAccount ? 
                      `${record.sourceAccount.email || 'N/A'} (${record.sourceAccount.uid || 'N/A'})` : 
                      '未知账户'}
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Text style={{ marginRight: 8 }} type="secondary">转账</Text>
                  <Text style={{ color: '#52c41a', fontWeight: 'bold' }}>${safeRender(record.amount)}</Text>
                  <ArrowRightOutlined style={{ margin: '0 8px' }} />
                </div>
                <div>
                  <Text ellipsis style={{ maxWidth: '100%' }}>
                    <Text strong>目标:</Text> 
                    {record.targetAccount ? 
                      `${record.targetAccount.email || 'N/A'} (${record.targetAccount.uid || 'N/A'})` : 
                      `${record.contactType === 'email' ? '邮箱' : 'UID'}: ${safeRender(record.targetIdentifier)}`
                    }
                  </Text>
                </div>
                {record.remarks && (
                  <div>
                    <Text type="secondary" ellipsis style={{ maxWidth: '100%' }}>
                      备注: {record.remarks}
                    </Text>
                  </div>
                )}
              </Space>
            </TimelineCard>
          </Timeline.Item>
        ))}
      </Timeline>
    );
  };
  
  if (!visible) return null;
  
  return (
    <TimelineContainer>
      <CloseButton 
        type="text" 
        icon={<CloseOutlined />} 
        onClick={onClose}
        aria-label="关闭转账记录"
      />
      
      <TimelineHeader>
        <Title level={4} style={{ margin: 0 }}>转账记录</Title>
        
        <HeaderControls>
          <PollingControls>
            <Badge 
              status={isPolling ? "processing" : "default"} 
              text={isPolling ? "实时更新中" : "更新已暂停"} 
              style={{ marginRight: 8 }}
            />
            <Button
              type="link"
              size="small"
              onClick={togglePolling}
              style={{ padding: '0 4px', height: 'auto', minWidth: 'auto' }}
            >
              {isPolling ? "暂停" : "恢复"}
            </Button>
          </PollingControls>
          
          <IntervalControls>
            <Input 
              placeholder="轮询间隔(毫秒)" 
              defaultValue={pollingInterval.toString()} 
              style={{ width: 100, marginRight: 4 }} 
              onChange={(e) => {
                if (e.target.value && !isNaN(Number(e.target.value))) {
                  handleIntervalChange(e.target.value);
                }
              }}
            />
            <Button 
              type="primary"
              size="small"
              onClick={() => handleIntervalChange(pollingInterval.toString())}
            >
              设置
            </Button>
          </IntervalControls>
          
          <Button
            type="primary"
            ghost
            icon={<ReloadOutlined />}
            onClick={handleManualRefresh}
            loading={loading}
            style={{ marginRight: 10 }}
          >
            刷新
          </Button>
        </HeaderControls>
      </TimelineHeader>
      
      <ScrollContainer>
        {renderTimeline()}
      </ScrollContainer>

      {/* 转账历史记录Modal */}
      <Modal
        title="转账详情"
        open={historyModalVisible}
        onCancel={handleCloseHistoryModal}
        footer={[
          <Button key="close" onClick={handleCloseHistoryModal}>
            关闭
          </Button>
        ]}
        width={900}
        style={{ top: 20 }}
      >
        {historyLoading ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Spin size="large" />
            <p>加载历史记录...</p>
          </div>
        ) : historyData ? (
          <HistoryModalContent>
            <div style={{ marginBottom: 16 }}>
              <Card size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Tag color="blue">{getSourceLabel(historyData.transfer.source)}</Tag>
                    <Tag color={getStatusColor(historyData.transfer.status)}>
                      {historyData.transfer.status === 'completed' ? '完成' : 
                       historyData.transfer.status === 'pending' ? '待处理' : 
                       historyData.transfer.status === 'processing' ? '处理中' : 
                       historyData.transfer.status === 'failed' ? '失败' : historyData.transfer.status}
                    </Tag>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Text>
                      <Text strong>源账户:</Text> {historyData.transfer.sourceAccount ? 
                        `${historyData.transfer.sourceAccount.email || 'N/A'} (${historyData.transfer.sourceAccount.uid || 'N/A'})` : 
                        '未知账户'}
                    </Text>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <Text style={{ marginRight: 8 }} type="secondary">转账金额:</Text>
                    <Text style={{ color: '#52c41a', fontWeight: 'bold' }}>${safeRender(historyData.transfer.amount)}</Text>
                  </div>
                  <div>
                    <Text>
                      <Text strong>目标:</Text> 
                      {historyData.transfer.targetAccount ? 
                        `${historyData.transfer.targetAccount.email || 'N/A'} (${historyData.transfer.targetAccount.uid || 'N/A'})` : 
                        `${historyData.transfer.contactType === 'email' ? '邮箱' : 'UID'}: ${safeRender(historyData.transfer.targetIdentifier)}`
                      }
                    </Text>
                  </div>
                  <div>
                    <Text>
                      <Text strong>创建时间:</Text> {
                        formatDateTime(historyData.transfer.createdAt || historyData.transfer.created_at)
                      }
                    </Text>
                  </div>
                  {historyData.transfer.remarks && (
                    <div>
                      <Text type="secondary">
                        备注: {historyData.transfer.remarks}
                      </Text>
                    </div>
                  )}
                </Space>
              </Card>
            </div>
            
            <Title level={5}>状态变更历史</Title>
            {historyData.histories.length > 0 ? (
              renderHistoryTimeline()
            ) : (
              <Empty description="暂无历史记录" />
            )}
          </HistoryModalContent>
        ) : (
          <Empty description="无法加载历史记录" />
        )}
      </Modal>
    </TimelineContainer>
  );
};

export default TransferTimeline;