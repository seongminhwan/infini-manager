import React, { useState, useEffect, useRef } from 'react';
import { Timeline, Card, Typography, Empty, Spin, Badge, Tag, Input, Tooltip, Button, Space } from 'antd';
import { ClockCircleOutlined, ArrowRightOutlined, ReloadOutlined, CloseOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { transferApi } from '../services/api';

const { Title, Text } = Typography;
const { Search } = Input;

// 样式组件
const TimelineContainer = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 16px;
`;

const TimelineCard = styled(Card)`
  margin-bottom: 8px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
`;

const TimelineHeader = styled.div`
  display: flex;
  justify-content: flex-start;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 16px;
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
  background: #f5f5f5;
  border-radius: 4px;
  padding: 8px;
  flex: 1;
  margin-right: 16px;
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
  targetIdentifier?: string;
  contactType: string;
  amount: string;
  status: string;
  createdAt: string;
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
      
      if (response.success && response.data) {
        setRecords(response.data);
      }
    } catch (error) {
      console.error('获取转账记录失败:', error);
    } finally {
      setLoading(false);
    }
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
      >
        {records.map(record => (
          <Timeline.Item
            key={record.id}
            color={getStatusColor(record.status)}
            label={new Date(record.createdAt).toLocaleString('zh-CN')}
          >
            <TimelineCard size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Tag color="blue">{getSourceLabel(record.source)}</Tag>
                  <Tag color={getStatusColor(record.status)}>
                    {record.status === 'completed' ? '完成' : 
                     record.status === 'pending' ? '待处理' : 
                     record.status === 'processing' ? '处理中' : 
                     record.status === 'failed' ? '失败' : record.status}
                  </Tag>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Text ellipsis style={{ maxWidth: '100%' }}>
                    <Text strong>源账户:</Text> {record.sourceAccount.email} ({record.sourceAccount.uid})
                  </Text>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <Text style={{ marginRight: 8 }} type="secondary">转账</Text>
                  <Text style={{ color: '#52c41a', fontWeight: 'bold' }}>${record.amount}</Text>
                  <ArrowRightOutlined style={{ margin: '0 8px' }} />
                </div>
                <div>
                  <Text ellipsis style={{ maxWidth: '100%' }}>
                    <Text strong>目标:</Text> 
                    {record.targetAccount ? 
                      `${record.targetAccount.email} (${record.targetAccount.uid})` : 
                      `${record.contactType === 'email' ? '邮箱' : 'UID'}: ${record.targetIdentifier}`
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
        <Title level={4} style={{ margin: 0, minWidth: '120px' }}>转账记录</Title>
        
        <HeaderControls>
          <div style={{ marginRight: 16 }}>
            <Badge 
              status={isPolling ? "processing" : "default"} 
              text={isPolling ? "实时更新中" : "更新已暂停"} 
            />
            <Button
              type="link"
              size="small"
              onClick={togglePolling}
            >
              {isPolling ? "暂停" : "恢复"}
            </Button>
          </div>
          
          <Tooltip title="设置自动刷新间隔 (毫秒)">
            <Search
              placeholder="轮询间隔 (毫秒)"
              defaultValue={pollingInterval.toString()}
              style={{ width: 200 }}
              onSearch={handleIntervalChange}
              enterButton="设置"
            />
          </Tooltip>
        </HeaderControls>
        
        <Button
          type="primary"
          ghost
          icon={<ReloadOutlined />}
          onClick={handleManualRefresh}
          loading={loading}
          style={{ marginRight: '40px' }}
        >
          刷新
        </Button>
      </TimelineHeader>
      
      <ScrollContainer>
        {renderTimeline()}
      </ScrollContainer>
    </TimelineContainer>
  );
};

export default TransferTimeline;