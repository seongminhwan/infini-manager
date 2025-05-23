import React, { useState, useEffect } from 'react';
import './styles.css';  // 导入样式文件
import { 
  Card, 
  Table, 
  Form, 
  Select, 
  DatePicker, 
  Button, 
  Input, 
  Space, 
  Typography, 
  Tag, 
  message, 
  Modal, 
  Row, 
  Col, 
  Descriptions, 
  Progress,
  Tabs,
  Divider,
  Popconfirm,
  Tooltip
} from 'antd';
import { 
  SearchOutlined, 
  ReloadOutlined, 
  EyeOutlined, 
  PlayCircleOutlined,
  RedoOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  CloseOutlined,
  StopOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { batchTransferApi } from '../../services/api';
import TransferHistoryDetail from '../../components/TransferHistoryDetail';
import type { TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { TabPane } = Tabs;

// 样式组件
const PageContainer = styled.div.attrs({ className: 'batch-transfer-details' })`
  padding: 24px;
`;

const StyledCard = styled(Card)`
  margin-bottom: 24px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  border-radius: 8px;
`;

const TableCard = styled(Card)`
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  
  .ant-table-thead > tr > th {
    background-color: #f7f7f7;
  }
`;

// 接口定义
interface BatchTransfer {
  id: string;
  name: string;
  type: 'one_to_many' | 'many_to_one';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  source: string;
  total_amount: string;
  success_count: number;
  failed_count: number;
  remarks?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  batch_number?: string;
}

interface BatchTransferRelation {
  id: string;
  batch_id: string;
  source_account_id?: string;
  matched_account_id?: string;
  contact_type?: string;
  target_identifier?: string;
  amount: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  transfer_id?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  source_account_email?: string;
  source_account_uid?: string;
  target_account_email?: string;
  target_account_uid?: string;
}

interface TableParams {
  pagination: TablePaginationConfig;
  sortField?: string;
  sortOrder?: string;
  filters?: Record<string, FilterValue | null>;
}

/**
 * 批量转账明细页面
 * 展示所有批量转账列表，支持查看任务信息、参数和子任务明细
 */
const BatchTransferDetails: React.FC = () => {
  const [form] = Form.useForm();
  const [relationsForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [data, setData] = useState<BatchTransfer[]>([]);
  const [relations, setRelations] = useState<BatchTransferRelation[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchTransfer | null>(null);
  const [activeTab, setActiveTab] = useState('1');
  
  // 转账详情弹窗状态
  const [transferDetailVisible, setTransferDetailVisible] = useState(false);
  const [selectedTransferId, setSelectedTransferId] = useState<string | null>(null);

  // 关闭批量转账弹窗状态
  const [closeModalVisible, setCloseModalVisible] = useState(false);
  const [selectedCloseRecord, setSelectedCloseRecord] = useState<BatchTransfer | null>(null);
  const [closeReason, setCloseReason] = useState('');

  const [tableParams, setTableParams] = useState<TableParams>({
    pagination: {
      current: 1,
      pageSize: 10,
      showSizeChanger: true,
      pageSizeOptions: ['10', '20', '50', '100'],
    },
  });

  const [relationsTableParams, setRelationsTableParams] = useState<TableParams>({
    pagination: {
      current: 1,
      pageSize: 20,
      showSizeChanger: true,
      pageSizeOptions: ['10', '20', '50', '100'],
    },
  });

  // 获取批量转账列表
  const fetchData = async (params: any = {}) => {
    setLoading(true);
    try {
      const { status, type, keyword, dateRange } = params;
      
      // 构建API请求参数
      const queryParams: any = {
        page: tableParams.pagination.current,
        pageSize: tableParams.pagination.pageSize,
        // 添加时间戳参数防止缓存
        _t: Date.now(),
      };
      
      // 添加筛选条件
      if (status) {
        queryParams.status = status;
      }
      
      if (type) {
        queryParams.type = type;
      }
      
      // 日期范围筛选
      if (dateRange && dateRange[0] && dateRange[1]) {
        queryParams.startDate = dateRange[0].format('YYYY-MM-DD');
        queryParams.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      
      // 关键词搜索
      if (keyword && keyword.trim() !== '') {
        queryParams.keyword = keyword.trim();
      }
      
      const response = await batchTransferApi.getBatchTransfers(queryParams);
      
      if (response.success && response.data) {
        setData(response.data.batchTransfers || []);
        setTableParams({
          ...tableParams,
          pagination: {
            ...tableParams.pagination,
            total: response.data.pagination?.total || 0,
          },
        });
      } else {
        message.error('获取批量转账列表失败');
      }
    } catch (error) {
      console.error('获取批量转账列表失败:', error);
      message.error('获取批量转账列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取批量转账关系列表
  const fetchRelations = async (batchId: string, params: any = {}) => {
    setRelationsLoading(true);
    try {
      const { status, keyword } = params;
      
      const queryParams: any = {
        page: relationsTableParams.pagination.current,
        pageSize: relationsTableParams.pagination.pageSize,
        // 添加时间戳参数防止缓存
        _t: Date.now(),
      };
      
      if (status) {
        queryParams.status = status;
      }
      
      if (keyword && keyword.trim() !== '') {
        queryParams.keyword = keyword.trim();
      }
      
      const response = await batchTransferApi.getBatchTransferRelations(batchId, queryParams);
      
      if (response.success && response.data) {
        setRelations(response.data.relations || []);
        setRelationsTableParams({
          ...relationsTableParams,
          pagination: {
            ...relationsTableParams.pagination,
            total: response.data.pagination?.total || 0,
          },
        });
      } else {
        message.error('获取转账关系列表失败');
      }
    } catch (error) {
      console.error('获取转账关系列表失败:', error);
      message.error('获取转账关系列表失败');
    } finally {
      setRelationsLoading(false);
    }
  };

  // 首次加载和分页/筛选变化时获取数据
  useEffect(() => {
    fetchData(form.getFieldsValue());
  }, [JSON.stringify(tableParams.pagination)]);

  // 获取转账关系数据
  useEffect(() => {
    if (selectedBatch && detailVisible) {
      fetchRelations(selectedBatch.id, relationsForm.getFieldsValue());
    }
  }, [JSON.stringify(relationsTableParams.pagination), selectedBatch]);

  // 定时自动刷新数据（每30秒）
  useEffect(() => {
    const interval = setInterval(() => {
      // 只有在没有加载状态时才自动刷新
      if (!loading) {
        fetchData(form.getFieldsValue());
      }
    }, 30000); // 30秒刷新一次

    return () => clearInterval(interval);
  }, [loading, form]);

  // 手动刷新数据
  const handleRefresh = async () => {
    setLoading(true);
    try {
      // 强制刷新，清除所有可能的缓存
      await fetchData(form.getFieldsValue());
      message.success('数据已刷新');
    } catch (error) {
      console.error('刷新数据失败:', error);
      message.error('刷新数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理表格变化
  const handleTableChange = (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<BatchTransfer> | SorterResult<BatchTransfer>[],
    extra: any
  ) => {
    setTableParams({
      pagination,
      filters,
      sortField: Array.isArray(sorter) ? undefined : sorter.field as string,
      sortOrder: Array.isArray(sorter) ? undefined : sorter.order as string,
    });
  };

  // 处理关系表格变化
  const handleRelationsTableChange = (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<BatchTransferRelation> | SorterResult<BatchTransferRelation>[],
    extra: any
  ) => {
    setRelationsTableParams({
      pagination,
      filters,
      sortField: Array.isArray(sorter) ? undefined : sorter.field as string,
      sortOrder: Array.isArray(sorter) ? undefined : sorter.order as string,
    });
  };

  // 处理搜索表单提交
  const handleSearch = (values: any) => {
    setTableParams({
      ...tableParams,
      pagination: {
        ...tableParams.pagination,
        current: 1,
      },
    });
    fetchData(values);
  };

  // 处理关系搜索
  const handleRelationsSearch = (values: any) => {
    setRelationsTableParams({
      ...relationsTableParams,
      pagination: {
        ...relationsTableParams.pagination,
        current: 1,
      },
    });
    if (selectedBatch) {
      fetchRelations(selectedBatch.id, values);
    }
  };

  // 重置筛选条件
  const handleReset = () => {
    form.resetFields();
    setTableParams({
      ...tableParams,
      pagination: {
        ...tableParams.pagination,
        current: 1,
      },
    });
    fetchData({});
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

  // 获取状态标签文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成';
      case 'pending':
        return '待处理';
      case 'processing':
        return '处理中';
      case 'failed':
        return '失败';
      default:
        return status;
    }
  };

  // 获取转账类型标签
  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'one_to_many':
        return '一对多';
      case 'many_to_one':
        return '多对一';
      default:
        return type;
    }
  };

  // 格式化日期时间
  const formatDateTime = (dateValue: string | undefined): string => {
    if (!dateValue) return '-';
    
    try {
      return dayjs(dateValue).format('YYYY-MM-DD HH:mm:ss');
    } catch (error) {
      console.error('日期格式化错误:', error, dateValue);
      return String(dateValue);
    }
  };

  // 打开批量转账详情弹窗
  const handleViewDetail = (record: BatchTransfer) => {
    setSelectedBatch(record);
    setDetailVisible(true);
    setActiveTab('1');
    // 重置关系表格分页
    setRelationsTableParams({
      ...relationsTableParams,
      pagination: {
        ...relationsTableParams.pagination,
        current: 1,
      },
    });
  };

  // 关闭详情弹窗
  const handleCloseDetail = () => {
    setDetailVisible(false);
    setSelectedBatch(null);
    setRelations([]);
  };

  // 执行批量转账
  const handleExecuteBatch = async (batchId: string) => {
    try {
      // 这里可以调用执行API
      message.success('批量转账已开始执行');
      fetchData(form.getFieldsValue());
    } catch (error) {
      console.error('执行批量转账失败:', error);
      message.error('执行批量转账失败');
    }
  };

  // 计算进度百分比
  const getProgress = (batch: BatchTransfer) => {
    const total = batch.success_count + batch.failed_count;
    const totalRelations = total; // 这里可能需要从详情接口获取总数
    return totalRelations > 0 ? Math.floor((total / totalRelations) * 100) : 0;
  };

  // 批量转账列表表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (text: string) => <span>{text}</span>,
    },
    {
      title: '批次号',
      dataIndex: 'batch_number',
      key: 'batch_number',
      render: (text: string) => <span>{text || '-'}</span>,
    },
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: BatchTransfer) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '12px', color: '#888' }}>
            {record.remarks || '无备注'}
          </div>
        </div>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (text: string) => (
        <Tag color="blue">{getTypeLabel(text)}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (text: string, record: BatchTransfer) => (
        <div>
          <Tag color={getStatusColor(text)} icon={
            text === 'completed' ? <CheckCircleOutlined /> :
            text === 'pending' ? <ClockCircleOutlined /> :
            text === 'processing' ? <PlayCircleOutlined /> :
            text === 'failed' ? <CloseCircleOutlined /> : null
          }>
            {getStatusText(text)}
          </Tag>
          {text === 'processing' && (
            <Progress 
              percent={getProgress(record)} 
              size="small" 
              style={{ marginTop: 4 }}
            />
          )}
        </div>
      ),
    },
    {
      title: '总金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      width: 120,
      render: (text: string) => (
        <span style={{ color: '#52c41a', fontWeight: 'bold' }}>${text}</span>
      ),
    },
    {
      title: '执行情况',
      key: 'progress',
      width: 150,
      render: (text: string, record: BatchTransfer) => (
        <div>
          <div style={{ fontSize: '12px' }}>
            成功: <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{record.success_count}</span>
          </div>
          <div style={{ fontSize: '12px' }}>
            失败: <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{record.failed_count}</span>
          </div>
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => (
        <span>{formatDateTime(text)}</span>
      ),
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      key: 'completed_at',
      width: 180,
      render: (text: string) => (
        <span>{formatDateTime(text)}</span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (text: string, record: BatchTransfer) => (
        <Space>
          <Tooltip title="查看详情">
            <Button 
              type="link" 
              icon={<EyeOutlined />} 
              onClick={() => handleViewDetail(record)}
            >
              详情
            </Button>
          </Tooltip>
          {record.status === 'pending' && (
            <Popconfirm
              title="确定要执行这个批量转账吗？"
              onConfirm={() => handleExecuteBatch(record.id)}
            >
              <Tooltip title="执行转账">
                <Button 
                  type="link" 
                  icon={<PlayCircleOutlined />}
                  style={{ color: '#52c41a' }}
                >
                  执行
                </Button>
              </Tooltip>
            </Popconfirm>
          )}
          {(['pending', 'processing'].includes(record.status)) && (
            <Tooltip title="关闭转账">
              <Button 
                type="link" 
                icon={<StopOutlined />}
                onClick={() => handleOpenCloseModal(record)}
                style={{ color: '#ff4d4f' }}
              >
                关闭
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  // 转账关系表格列定义
  const relationsColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: '源账户',
      key: 'source_account',
      render: (text: string, record: BatchTransferRelation) => (
        <div>
          {record.source_account_email && (
            <div style={{ fontWeight: 'bold' }}>{record.source_account_email}</div>
          )}
          {record.source_account_uid && (
            <div style={{ fontSize: '12px', color: '#888' }}>UID: {record.source_account_uid}</div>
          )}
          {!record.source_account_email && !record.source_account_uid && (
            <span>ID: {record.source_account_id}</span>
          )}
        </div>
      ),
    },
    {
      title: '目标类型',
      dataIndex: 'contact_type',
      key: 'contact_type',
      width: 100,
      render: (text: string) => (
        <Tag color="blue">{text === 'email' ? '邮箱' : text === 'uid' ? 'UID' : text === 'inner' ? '内部' : text}</Tag>
      ),
    },
    {
      title: '目标标识',
      dataIndex: 'target_identifier',
      key: 'target_identifier',
      render: (text: string, record: BatchTransferRelation) => (
        <div>
          <div>{text}</div>
          {record.target_account_email && (
            <div style={{ fontSize: '12px', color: '#888' }}>{record.target_account_email}</div>
          )}
        </div>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (text: string) => (
        <span style={{ color: '#52c41a', fontWeight: 'bold' }}>${text}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (text: string) => (
        <Tag color={getStatusColor(text)} icon={
          text === 'completed' ? <CheckCircleOutlined /> :
          text === 'pending' ? <ClockCircleOutlined /> :
          text === 'processing' ? <PlayCircleOutlined /> :
          text === 'failed' ? <CloseCircleOutlined /> : null
        }>
          {getStatusText(text)}
        </Tag>
      ),
    },
    {
      title: '转账ID',
      dataIndex: 'transfer_id',
      key: 'transfer_id',
      width: 120,
      render: (text: string) => (
        text ? (
          <Tooltip title="点击查看转账详情">
            <Button 
              type="link" 
              onClick={() => handleViewTransferDetail(text)}
              icon={<HistoryOutlined />}
              style={{ 
                padding: 0, 
                height: 'auto',
                color: '#1890ff',
                fontWeight: 'bold'
              }}
            >
              {text}
            </Button>
          </Tooltip>
        ) : (
          <span>-</span>
        )
      ),
    },
    {
      title: '错误信息',
      dataIndex: 'error_message',
      key: 'error_message',
      render: (text: string) => (
        text ? (
          <Tooltip title={text}>
            <span style={{ color: '#ff4d4f', fontSize: '12px' }}>
              {text.length > 20 ? `${text.substring(0, 20)}...` : text}
            </span>
          </Tooltip>
        ) : (
          <span>-</span>
        )
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 150,
      render: (text: string) => (
        <span style={{ fontSize: '12px' }}>{formatDateTime(text)}</span>
      ),
    },
  ];

  // 打开转账详情弹窗
  const handleViewTransferDetail = (transferId: string) => {
    setSelectedTransferId(transferId);
    setTransferDetailVisible(true);
  };

  // 关闭转账详情弹窗
  const handleCloseTransferDetail = () => {
    setTransferDetailVisible(false);
    setSelectedTransferId(null);
  };

  // 打开关闭批量转账弹窗
  const handleOpenCloseModal = (record: BatchTransfer) => {
    setSelectedCloseRecord(record);
    setCloseModalVisible(true);
    setCloseReason('');
  };

  // 关闭关闭批量转账弹窗
  const handleCloseCloseModal = () => {
    setCloseModalVisible(false);
    setSelectedCloseRecord(null);
    setCloseReason('');
  };

  // 确认关闭批量转账
  const handleConfirmClose = async () => {
    if (!selectedCloseRecord) return;
    
    try {
      const response = await batchTransferApi.closeBatchTransfer(
        selectedCloseRecord.id,
        closeReason.trim() || undefined
      );
      
      if (response.success) {
        message.success(response.message || '批量转账已关闭');
        handleCloseCloseModal();
        
        // 立即刷新列表数据
        await fetchData(form.getFieldsValue());
        
        // 延迟1秒后再次刷新，确保数据库操作完全完成
        setTimeout(async () => {
          await fetchData(form.getFieldsValue());
        }, 1000);
        
        // 如果当前有打开的详情弹窗，也需要刷新详情数据
        if (selectedBatch && detailVisible) {
          setTimeout(async () => {
            await fetchRelations(selectedBatch.id, relationsForm.getFieldsValue());
          }, 1000);
        }
      } else {
        message.error(response.message || '关闭批量转账失败');
      }
    } catch (error) {
      console.error('关闭批量转账失败:', error);
      message.error('关闭批量转账失败');
    }
  };

  return (
    <PageContainer>
      <Title level={4}>批量转账明细</Title>
      
      {/* 筛选条件 */}
      <StyledCard>
        <Form 
          form={form}
          layout="vertical"
          onFinish={handleSearch}
          initialValues={{ status: '', type: '' }}
        >
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="keyword" label="关键词搜索">
                <Input
                  placeholder="任务名称、批次号、备注..."
                  allowClear
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="status" label="状态筛选">
                <Select placeholder="选择状态" allowClear>
                  <Option value="pending">待处理</Option>
                  <Option value="processing">处理中</Option>
                  <Option value="completed">已完成</Option>
                  <Option value="failed">失败</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item name="type" label="类型筛选">
                <Select placeholder="选择类型" allowClear>
                  <Option value="one_to_many">一对多</Option>
                  <Option value="many_to_one">多对一</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="dateRange" label="创建时间">
                <RangePicker 
                  style={{ width: '100%' }}
                  placeholder={['开始日期', '结束日期']}
                />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label=" " style={{ marginBottom: 0 }}>
                <Space>
                  <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                    搜索
                  </Button>
                  <Button onClick={handleReset} icon={<ReloadOutlined />}>
                    重置
                  </Button>
                  <Button onClick={handleRefresh} icon={<ReloadOutlined />} loading={loading}>
                    刷新
                  </Button>
                </Space>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </StyledCard>

      {/* 批量转账列表 */}
      <TableCard>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={tableParams.pagination}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
        />
      </TableCard>

      {/* 详情弹窗 */}
      <Modal
        title={`批量转账详情 - ${selectedBatch?.name || ''}`}
        open={detailVisible}
        onCancel={handleCloseDetail}
        footer={null}
        width={1200}
        style={{ top: 20 }}
      >
        {selectedBatch && (
          <Tabs activeKey={activeTab} onChange={setActiveTab}>
            <TabPane tab="基本信息" key="1">
              <Descriptions bordered column={2}>
                <Descriptions.Item label="任务ID">{selectedBatch.id}</Descriptions.Item>
                <Descriptions.Item label="批次号">{selectedBatch.batch_number || '-'}</Descriptions.Item>
                <Descriptions.Item label="任务名称">{selectedBatch.name}</Descriptions.Item>
                <Descriptions.Item label="转账类型">
                  <Tag color="blue">{getTypeLabel(selectedBatch.type)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={getStatusColor(selectedBatch.status)}>
                    {getStatusText(selectedBatch.status)}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="总金额">
                  <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                    ${selectedBatch.total_amount}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="成功数量">
                  <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                    {selectedBatch.success_count}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="失败数量">
                  <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
                    {selectedBatch.failed_count}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {formatDateTime(selectedBatch.created_at)}
                </Descriptions.Item>
                <Descriptions.Item label="完成时间">
                  {formatDateTime(selectedBatch.completed_at)}
                </Descriptions.Item>
                <Descriptions.Item label="备注" span={2}>
                  {selectedBatch.remarks || '无备注'}
                </Descriptions.Item>
              </Descriptions>
            </TabPane>
            
            <TabPane tab="转账明细" key="2">
              {/* 转账关系筛选 */}
              <Form 
                form={relationsForm}
                layout="inline"
                onFinish={handleRelationsSearch}
                style={{ marginBottom: 16 }}
              >
                <Form.Item name="keyword">
                  <Input
                    placeholder="搜索账户、标识符..."
                    allowClear
                    style={{ width: 200 }}
                  />
                </Form.Item>
                <Form.Item name="status">
                  <Select placeholder="状态筛选" allowClear style={{ width: 120 }}>
                    <Option value="pending">待处理</Option>
                    <Option value="processing">处理中</Option>
                    <Option value="completed">已完成</Option>
                    <Option value="failed">失败</Option>
                  </Select>
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
                      搜索
                    </Button>
                    <Button 
                      onClick={() => {
                        relationsForm.resetFields();
                        if (selectedBatch) {
                          fetchRelations(selectedBatch.id, {});
                        }
                      }}
                      icon={<ReloadOutlined />}
                    >
                      重置
                    </Button>
                  </Space>
                </Form.Item>
              </Form>

              {/* 转账关系表格 */}
              <Table
                columns={relationsColumns}
                dataSource={relations}
                rowKey="id"
                loading={relationsLoading}
                pagination={relationsTableParams.pagination}
                onChange={handleRelationsTableChange}
                scroll={{ x: 1000 }}
                size="small"
                className="relations-table"
              />
            </TabPane>
          </Tabs>
        )}
      </Modal>
      
      {/* 转账详情弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <HistoryOutlined style={{ marginRight: '8px', color: '#1890ff' }} />
            <span>转账详情</span>
            {selectedTransferId && (
              <Tag color="blue" style={{ marginLeft: '8px' }}>ID: {selectedTransferId}</Tag>
            )}
          </div>
        }
        open={transferDetailVisible}
        onCancel={handleCloseTransferDetail}
        footer={[
          <Button key="close" onClick={handleCloseTransferDetail}>
            关闭
          </Button>
        ]}
        width={1200}
        style={{ top: 20 }}
        destroyOnClose={true}
        className="transfer-detail-modal"
      >
        {selectedTransferId && (
          <TransferHistoryDetail 
            transferId={selectedTransferId}
            onClose={handleCloseTransferDetail}
          />
        )}
      </Modal>
      
      {/* 关闭批量转账确认弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <StopOutlined style={{ marginRight: '8px', color: '#ff4d4f' }} />
            <span>关闭批量转账</span>
          </div>
        }
        open={closeModalVisible}
        onOk={handleConfirmClose}
        onCancel={handleCloseCloseModal}
        okType="danger"
        okText="确认关闭"
        cancelText="取消"
        width={500}
      >
        {selectedCloseRecord && (
          <div>
            <p>您即将关闭以下批量转账任务：</p>
            <div style={{ 
              background: '#f5f5f5', 
              padding: '12px', 
              borderRadius: '6px', 
              margin: '12px 0' 
            }}>
              <div><strong>任务名称：</strong>{selectedCloseRecord.name}</div>
              <div><strong>当前状态：</strong>
                <Tag color={getStatusColor(selectedCloseRecord.status)} style={{ marginLeft: '8px' }}>
                  {getStatusText(selectedCloseRecord.status)}
                </Tag>
              </div>
              <div><strong>转账类型：</strong>{getTypeLabel(selectedCloseRecord.type)}</div>
              <div><strong>总金额：</strong>${selectedCloseRecord.total_amount}</div>
            </div>
            <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
              警告：关闭后，所有未处理的转账将被标记为失败，此操作不可撤销！
            </p>
            <div style={{ marginTop: '16px' }}>
              <Text strong>关闭原因（可选）：</Text>
              <Input.TextArea
                rows={3}
                placeholder="请输入关闭原因（可选）"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                style={{ marginTop: '8px' }}
                maxLength={200}
                showCount
              />
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};

export default BatchTransferDetails; 