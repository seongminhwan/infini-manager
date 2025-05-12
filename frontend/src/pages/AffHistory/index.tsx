/**
 * AFF返现记录表页面
 * 显示所有AFF返现批次及其关联的转账记录
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Typography,
  Descriptions,
  Modal,
  Tabs,
  Spin,
  Empty,
  Statistic,
  Row,
  Col,
  Divider,
  Drawer,
  message
} from 'antd';
import { SearchOutlined, FileSearchOutlined, HistoryOutlined } from '@ant-design/icons';
import TransferHistoryDetail from '../../components/TransferHistoryDetail';
import TransferTimeline from '../../components/TransferTimeline';
import api, { apiBaseUrl, affApi, transferApi } from '../../services/api';

const { Title, Text } = Typography;
const { confirm } = Modal;
const { TabPane } = Tabs;

// 接口类型定义
interface AffCashback {
  id: number;
  accountId: number;
  accountEmail: string;
  batchName: string;
  status: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  riskyCount: number;
  totalAmount: number;
  defaultAmount: number;
  isAuto2FA: boolean;
  createdAt: string;
  completedAt: string;
  fileType: string;
  statusCounts: Record<string, number>;
}

interface AffRelation {
  id: number;
  batchId: number;
  uid: string;
  email: string;
  registerDate: string;
  cardCount: number;
  cardDate: string;
  sequenceNumber: string;
  amount: number;
  isRisky: boolean;
  isIgnored: boolean;
  isApproved: boolean;
  status: string;
  transferId: number;
  errorMessage: string;
  createdAt: string;
  completedAt: string;
}

interface Transfer {
  id: number;
  amount: number;
  status: string;
  source: string;
  sourceAccount: {
    id: number;
    email: string;
  };
  targetAccount: {
    id: number;
    uid: string;
    email: string;
  };
  failReason: string;
  createdAt: string;
  completedAt: string;
}

const AffHistory: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [cashbacks, setCashbacks] = useState<AffCashback[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [currentCashback, setCurrentCashback] = useState<AffCashback | null>(null);
  const [relations, setRelations] = useState<AffRelation[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [transferDetailVisible, setTransferDetailVisible] = useState<boolean>(false);
  const [currentTransferId, setCurrentTransferId] = useState<number | null>(null);
  const [currentTransfer, setCurrentTransfer] = useState<Transfer | null>(null);
  const [historyVisible, setHistoryVisible] = useState<boolean>(false);
  
  // 加载AFF返现批次列表
  useEffect(() => {
    fetchCashbacks();
  }, [pagination.current, pagination.pageSize]);

  // 获取AFF返现批次列表
  const fetchCashbacks = async () => {
    setLoading(true);
    try {
      const res = await api.get(`${apiBaseUrl}/api/aff/cashbacks`, {
        params: {
          page: pagination.current,
          pageSize: pagination.pageSize
        }
      });
      
      if (res.data.success) {
        setCashbacks(res.data.data.cashbacks);
        setPagination({
          ...pagination,
          total: res.data.data.pagination.total
        });
      }
    } catch (error) {
      console.error('获取AFF返现批次列表失败', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取AFF返现批次详情
  const fetchCashbackDetail = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.get(`${apiBaseUrl}/api/aff/cashbacks/${id}`);
      
      if (res.data.success) {
        setCurrentCashback(res.data.data);
      }
    } catch (error) {
      console.error('获取AFF返现批次详情失败', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取AFF返现批次关联的用户列表
  const fetchRelations = async (batchId: number) => {
    setLoading(true);
    try {
      const res = await api.get(`${apiBaseUrl}/api/aff/cashbacks/${batchId}/relations`);
      
      if (res.data.success) {
        setRelations(res.data.data.relations);
        setCurrentCashback(res.data.data.batch);
      }
    } catch (error) {
      console.error('获取关联用户列表失败', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取转账详情
  const fetchTransferDetail = async (transferId: number) => {
    setLoading(true);
    try {
      const res = await api.get(`${apiBaseUrl}/api/transfers/${transferId}`);
      
      if (res.data.success) {
        setCurrentTransfer(res.data.data);
      }
    } catch (error) {
      console.error('获取转账详情失败', error);
    } finally {
      setLoading(false);
    }
  };

  // 显示批次详情
  const showBatchDetail = (batchId: number) => {
    fetchCashbackDetail(batchId);
    fetchRelations(batchId);
    setDetailModalVisible(true);
  };

  // 显示转账详情
  const showTransferDetail = (transferId: number) => {
    setCurrentTransferId(transferId);
    if (transferId) {
      fetchTransferDetail(transferId);
      setTransferDetailVisible(true);
    }
  };

  // 显示转账历史
  const showTransferHistory = (transferId: number) => {
    setCurrentTransferId(transferId);
    setHistoryVisible(true);
  };

  // AFF返现批次表格列定义
  const cashbackColumns = [
    {
      title: '批次ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '批次名称',
      dataIndex: 'batchName',
      key: 'batchName',
      width: 200
    },
    {
      title: '转账账户',
      dataIndex: 'accountEmail',
      key: 'accountEmail',
      width: 200
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        switch (status) {
          case 'pending':
            return <Tag color="blue">待处理</Tag>;
          case 'processing':
            return <Tag color="orange">处理中</Tag>;
          case 'completed':
            return <Tag color="green">已完成</Tag>;
          case 'failed':
            return <Tag color="red">失败</Tag>;
          default:
            return <Tag>{status}</Tag>;
        }
      }
    },
    {
      title: '总记录数',
      dataIndex: 'totalCount',
      key: 'totalCount',
      width: 100
    },
    {
      title: '已完成',
      dataIndex: 'successCount',
      key: 'successCount',
      width: 80
    },
    {
      title: '失败',
      dataIndex: 'failedCount',
      key: 'failedCount',
      width: 80
    },
    {
      title: '风险用户',
      dataIndex: 'riskyCount',
      key: 'riskyCount',
      width: 80
    },
    {
      title: '总金额',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 100,
      render: (amount: number) => amount?.toFixed(2) || '0.00'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 170,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-'
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 120,
      render: (_: any, record: AffCashback) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<SearchOutlined />}
            onClick={() => showBatchDetail(record.id)}
          >
            详情
          </Button>
        </Space>
      )
    }
  ];

  // 关联记录表格列定义
  const relationColumns = [
    {
      title: '序号',
      dataIndex: 'sequenceNumber',
      key: 'sequenceNumber',
      width: 80
    },
    {
      title: 'UID',
      dataIndex: 'uid',
      key: 'uid',
      width: 120
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string, record: AffRelation) => {
        if (record.isIgnored) {
          return <Tag color="default">已忽略</Tag>;
        }
        
        switch (status) {
          case 'pending':
            return <Tag color="blue">待处理</Tag>;
          case 'processing':
            return <Tag color="orange">处理中</Tag>;
          case 'completed':
            return <Tag color="green">已完成</Tag>;
          case 'failed':
            return <Tag color="red">失败</Tag>;
          default:
            return <Tag>{status}</Tag>;
        }
      }
    },
    {
      title: '风险',
      dataIndex: 'isRisky',
      key: 'isRisky',
      width: 100,
      render: (isRisky: boolean, record: AffRelation) => {
        if (isRisky) {
          return record.isApproved 
            ? <Tag color="green">已批准</Tag>
            : <Tag color="red">风险</Tag>;
        }
        return <Tag color="default">正常</Tag>;
      }
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (amount: number) => amount.toFixed(2)
    },
    {
      title: '注册日期',
      dataIndex: 'registerDate',
      key: 'registerDate',
      width: 120,
      render: (date: string) => date ? new Date(date).toLocaleDateString() : '-'
    },
    {
      title: '开卡数量',
      dataIndex: 'cardCount',
      key: 'cardCount',
      width: 80
    },
    {
      title: '转账ID',
      dataIndex: 'transferId',
      key: 'transferId',
      width: 100
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 170,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-'
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 100,
      render: (_: any, record: AffRelation) => (
        <Space>
          {record.transferId && (
            <Button
              type="link"
              size="small"
              icon={<FileSearchOutlined />}
              onClick={() => showTransferDetail(record.transferId)}
            >
              流水
            </Button>
          )}
        </Space>
      )
    }
  ];

  // 渲染批次详情
  const renderCashbackDetail = () => {
    if (!currentCashback) return null;
    
    const { 
      batchName, 
      accountEmail, 
      status, 
      totalCount, 
      successCount, 
      failedCount, 
      riskyCount,
      totalAmount,
      defaultAmount,
      isAuto2FA,
      createdAt,
      completedAt,
      fileType,
      statusCounts
    } = currentCashback;
    
    return (
      <>
        <Descriptions title="批次详情" bordered>
          <Descriptions.Item label="批次名称" span={3}>{batchName}</Descriptions.Item>
          <Descriptions.Item label="转账账户" span={3}>{accountEmail}</Descriptions.Item>
          <Descriptions.Item label="状态">{
            (() => {
              switch (status) {
                case 'pending': return <Tag color="blue">待处理</Tag>;
                case 'processing': return <Tag color="orange">处理中</Tag>;
                case 'completed': return <Tag color="green">已完成</Tag>;
                case 'failed': return <Tag color="red">失败</Tag>;
                default: return <Tag>{status}</Tag>;
              }
            })()
          }</Descriptions.Item>
          <Descriptions.Item label="默认金额">{defaultAmount}</Descriptions.Item>
          <Descriptions.Item label="自动2FA">{isAuto2FA ? '是' : '否'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{new Date(createdAt).toLocaleString()}</Descriptions.Item>
          <Descriptions.Item label="完成时间">{completedAt ? new Date(completedAt).toLocaleString() : '-'}</Descriptions.Item>
        </Descriptions>
        
        <Divider />
        
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Statistic title="总记录数" value={totalCount} />
          </Col>
          <Col span={6}>
            <Statistic title="已完成" value={successCount} />
          </Col>
          <Col span={6}>
            <Statistic title="失败" value={failedCount} />
          </Col>
          <Col span={6}>
            <Statistic title="风险用户" value={riskyCount} />
          </Col>
        </Row>
        
        <Tabs defaultActiveKey="relations">
          <TabPane tab="关联用户" key="relations">
            <Table
              columns={relationColumns}
              dataSource={relations}
              rowKey="id"
              size="small"
              scroll={{ x: 1200, y: 400 }}
              pagination={false}
              loading={loading}
              locale={{
                emptyText: <Empty description="暂无数据" />
              }}
            />
          </TabPane>
          <TabPane tab="统计信息" key="stats">
            <Card>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic title="待处理" value={statusCounts?.pending || 0} />
                </Col>
                <Col span={8}>
                  <Statistic title="处理中" value={statusCounts?.processing || 0} />
                </Col>
                <Col span={8}>
                  <Statistic title="已忽略" value={statusCounts?.ignored || 0} />
                </Col>
              </Row>
              <Divider />
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic title="已完成" value={statusCounts?.completed || 0} />
                </Col>
                <Col span={8}>
                  <Statistic title="失败" value={statusCounts?.failed || 0} />
                </Col>
                <Col span={8}>
                  <Statistic 
                    title="总金额" 
                    value={totalAmount || 0} 
                    precision={2}
                    valueStyle={{ color: '#3f8600', fontWeight: 'bold' }}
                    prefix="$" 
                  />
                </Col>
              </Row>
            </Card>
          </TabPane>
        </Tabs>
      </>
    );
  };

  // 关闭AFF返现批次
  const handleCloseCashback = async () => {
    if (!currentCashback) return;
    
    setLoading(true);
    try {
      const res = await api.post(`${apiBaseUrl}/api/aff/cashbacks/${currentCashback.id}/close`);
      
      if (res.data.success) {
        message.success('AFF返现批次已成功关闭');
        // 刷新批次详情和批次列表
        fetchCashbackDetail(currentCashback.id);
        fetchCashbacks();
      } else {
        message.error(`关闭批次失败: ${res.data.message}`);
      }
    } catch (error) {
      console.error('关闭AFF返现批次失败', error);
      message.error('操作失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 标记AFF返现批次为已完成
  const handleMarkAsCompleted = () => {
    if (!currentCashback) return;
    
    Modal.confirm({
      title: '确认标记为已完成',
      content: `确定要将批次"${currentCashback.batchName}"标记为已完成状态吗？`,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        return new Promise<void>((resolve, reject) => {
          setLoading(true);
          api.post(`${apiBaseUrl}/api/aff/cashbacks/${currentCashback.id}/mark-completed`)
            .then(res => {
              if (res.data.success) {
                message.success('AFF返现批次已成功标记为已完成');
                // 刷新批次详情和批次列表
                fetchCashbackDetail(currentCashback.id);
                fetchCashbacks();
                resolve();
              } else {
                message.error(`操作失败: ${res.data.message}`);
                reject(new Error(res.data.message));
              }
            })
            .catch(error => {
              console.error('标记AFF返现批次为已完成失败', error);
              message.error('操作失败，请稍后重试');
              reject(error);
            })
            .finally(() => {
              setLoading(false);
            });
        });
      }
    });
  };

  return (
    <div>
      <Title level={3}>AFF历史记录</Title>
      
      <Card>
        <Table
          columns={cashbackColumns}
          dataSource={cashbacks}
          rowKey="id"
          size="small"
          scroll={{ x: 1500 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            onChange: (page, pageSize) => {
              setPagination({
                ...pagination,
                current: page,
                pageSize: pageSize || 10
              });
            }
          }}
          loading={loading}
          locale={{
            emptyText: <Empty description="暂无数据" />
          }}
        />
      </Card>
      
      {/* 批次详情对话框 */}
      <Modal
        title={`AFF返现批次详情 #${currentCashback?.id}`}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={1000}
        footer={[
          ...(currentCashback && ['pending', 'processing'].includes(currentCashback.status) ? [
            <Button key="close_batch" type="primary" danger onClick={handleCloseCashback} loading={loading}>
              关闭批次
            </Button>
          ] : []),
          ...(currentCashback && currentCashback.status !== 'completed' ? [
            <Button key="mark_completed" type="primary" onClick={handleMarkAsCompleted} loading={loading}>
              标记为已完成
            </Button>
          ] : []),
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <Spin spinning={loading}>
          {renderCashbackDetail()}
        </Spin>
      </Modal>
      
      {/* 转账流水详情对话框 */}
      <Modal
        title="转账流水详情"
        open={transferDetailVisible}
        onCancel={() => setTransferDetailVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setTransferDetailVisible(false)}>
            关闭
          </Button>
        ]}
        bodyStyle={{ padding: 0 }}
      >
        {currentTransferId && (
          <TransferHistoryDetail transferId={currentTransferId} />
        )}
      </Modal>
      
      {/* 转账历史抽屉 */}
      <Drawer
        title="转账历史记录"
        placement="right"
        width={800}
        onClose={() => setHistoryVisible(false)}
        open={historyVisible}
        bodyStyle={{ padding: 0 }}
      >
        {currentTransferId && <TransferHistoryDetail transferId={currentTransferId} />}
      </Drawer>
    </div>
  );
};

// 懒加载时需要定义组件显示名称
AffHistory.displayName = 'AffHistory';

export default AffHistory;