import React, { useState, useEffect } from 'react';
import './styles.css';  // 导入样式文件
import { Card, Table, Form, Select, DatePicker, Button, Input, Space, Typography, Tag, message, Modal, Row, Col, Descriptions } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import TransferTimeline from '../../components/TransferTimeline';
import styled from 'styled-components';
import { infiniAccountApi, transferApi } from '../../services/api';
import type { TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import dayjs from 'dayjs';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// 样式组件
const PageContainer = styled.div`
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
interface TransferRecord {
  id: string;
  account_id: string;
  account_email?: string;
  contact_type: string;
  target_identifier: string;
  amount: string;
  source: string;
  status: string;
  remarks?: string;
  created_at: string;
  completed_at?: string;
  matched_account_email?: string;
  matched_account_uid?: string;
  original_contact_type?: string;
}

interface TableParams {
  pagination: TablePaginationConfig;
  sortField?: string;
  sortOrder?: string;
  filters?: Record<string, FilterValue | null>;
}

/**
 * 账户明细页面
 * 展示所有账户的转账记录，支持多维度筛选
 */
const AccountDetails: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<TransferRecord[]>([]);
  const [accounts, setAccounts] = useState<{ id: string, email: string }[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<TransferRecord | null>(null);
  const [tableParams, setTableParams] = useState<TableParams>({
    pagination: {
      current: 1,
      pageSize: 10,
      showSizeChanger: true,
      pageSizeOptions: ['10', '20', '50', '100'],
    },
  });

  // 获取账户列表
  const fetchAccounts = async () => {
    try {
      const response = await infiniAccountApi.getAllInfiniAccounts();
      if (response.success && response.data) {
        setAccounts(response.data.map((account: any) => ({
          id: account.id,
          email: account.email
        })));
      }
    } catch (error) {
      console.error('获取账户列表失败:', error);
      message.error('获取账户列表失败');
    }
  };

  // 获取转账记录
  const fetchData = async (params: any = {}) => {
    setLoading(true);
    try {
      const { searchType, status, dateRange, amountMin, amountMax, keyword, source } = params;
      
      // 构建API请求参数
      const queryParams: any = {
        page: tableParams.pagination.current,
        pageSize: tableParams.pagination.pageSize,
      };
      
      // 添加筛选条件
      if (status) {
        queryParams.status = status;
      }
      
      // 添加来源筛选
      if (source) {
        queryParams.source = source;
      }
      
      // 日期范围筛选
      if (dateRange && dateRange[0] && dateRange[1]) {
        queryParams.startDate = dateRange[0].format('YYYY-MM-DD');
        queryParams.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      
      // 金额范围筛选
      if (amountMin !== undefined && amountMin !== '') {
        queryParams.amountMin = amountMin;
      }
      
      if (amountMax !== undefined && amountMax !== '') {
        queryParams.amountMax = amountMax;
      }
      
      // 关键词搜索 - 根据searchType设置不同的搜索类型
      if (keyword && keyword.trim() !== '') {
        queryParams.keyword = keyword.trim();
        
        // 传递搜索类型，用于后端区分搜索范围
        if (searchType) {
          queryParams.searchType = searchType;
        }
      }
      
      // 创建完整URL查询参数字符串
      let url = `/api/transfers?page=${queryParams.page}&pageSize=${queryParams.pageSize}`;
      
      if (queryParams.status) {
        url += `&status=${queryParams.status}`;
      }
      
      if (queryParams.source) {
        url += `&source=${queryParams.source}`;
      }
      
      if (queryParams.startDate && queryParams.endDate) {
        url += `&startDate=${queryParams.startDate}&endDate=${queryParams.endDate}`;
      }
      
      if (queryParams.amountMin !== undefined) {
        url += `&amountMin=${queryParams.amountMin}`;
      }
      
      if (queryParams.amountMax !== undefined) {
        url += `&amountMax=${queryParams.amountMax}`;
      }
      
      if (queryParams.keyword) {
        url += `&keyword=${encodeURIComponent(queryParams.keyword)}`;
        
        if (queryParams.searchType) {
          url += `&searchType=${queryParams.searchType}`;
        }
      }
      
      // 使用fetch API直接请求，确保所有参数都被传递
      const response = await fetch(`http://localhost:33201${url}`);
      const result = await response.json();
      
      if (result.success && result.data) {
        setData(result.data.transfers || []);
        setTableParams({
          ...tableParams,
          pagination: {
            ...tableParams.pagination,
            total: result.data.pagination?.total || 0,
          },
        });
      } else {
        message.error('获取转账记录失败');
      }
    } catch (error) {
      console.error('获取转账记录失败:', error);
      message.error('获取转账记录失败');
    } finally {
      setLoading(false);
    }
  };

  // 首次加载和分页/筛选变化时获取数据
  useEffect(() => {
    fetchAccounts();
    fetchData(form.getFieldsValue());
  }, [JSON.stringify(tableParams.pagination)]);

  // 处理表格变化
  const handleTableChange = (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<TransferRecord> | SorterResult<TransferRecord>[],
    extra: any
  ) => {
    // 处理单个排序或多个排序的情况
    let sortField: string | undefined;
    let sortOrder: string | undefined;
    
    if (Array.isArray(sorter)) {
      // 多列排序，取第一个
      if (sorter.length > 0) {
        sortField = sorter[0].field as string;
        sortOrder = sorter[0].order as string;
      }
    } else {
      // 单列排序
      sortField = sorter.field as string;
      sortOrder = sorter.order as string;
    }
    
    setTableParams({
      pagination,
      filters,
      sortField,
      sortOrder,
    });
  };

  // 处理搜索表单提交
  const handleSearch = (values: any) => {
    setTableParams({
      ...tableParams,
      pagination: {
        ...tableParams.pagination,
        current: 1, // 重置到第一页
      },
    });
    fetchData(values);
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

  // 打开转账详情弹窗
  const handleRowClick = (record: TransferRecord) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };

  // 关闭转账详情弹窗
  const handleCloseDetail = () => {
    setDetailVisible(false);
    setSelectedRecord(null);
  };

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (text: string) => <span>{text}</span>,
    },
    {
      title: '转出账户',
      dataIndex: 'account_email',
      key: 'account_email',
      render: (text: string, record: TransferRecord) => (
        <span>{text || record.account_id}</span>
      ),
    },
    {
      title: '目标类型',
      dataIndex: 'contact_type',
      key: 'contact_type',
      width: 100,
      render: (text: string) => (
        <Tag color="blue">{text === 'email' ? '邮箱' : text === 'uid' ? 'UID' : text}</Tag>
      ),
    },
    {
      title: '目标标识',
      dataIndex: 'target_identifier',
      key: 'target_identifier',
      render: (text: string, record: TransferRecord) => (
        <span>
          {text}
          {record.matched_account_email && (
            <div style={{ fontSize: '12px', color: '#888' }}>
              {record.matched_account_email}
            </div>
          )}
        </span>
      ),
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (text: string) => (
        <span style={{ color: '#52c41a', fontWeight: 'bold' }}>${text}</span>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 120,
      render: (text: string) => (
        <Tag color="purple">{getSourceLabel(text)}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (text: string) => (
        <Tag color={getStatusColor(text)}>
          {text === 'completed' ? '完成' : 
           text === 'pending' ? '待处理' : 
           text === 'processing' ? '处理中' : 
           text === 'failed' ? '失败' : text}
        </Tag>
      ),
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      key: 'remarks',
      render: (text: string) => <span>{text || '-'}</span>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => (
        <span>{text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'}</span>
      ),
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      key: 'completed_at',
      width: 180,
      render: (text: string) => (
        <span>{text ? dayjs(text).format('YYYY-MM-DD HH:mm:ss') : '-'}</span>
      ),
    },
  ];

  return (
    <PageContainer>
      <Title level={4}>账户明细</Title>
      
      <StyledCard>
        <Form 
          form={form}
          layout="vertical"
          onFinish={handleSearch}
          initialValues={{ status: '' }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            <Form.Item label="账户筛选" style={{ marginBottom: 0 }}>
              <Space>
                <Form.Item name="searchType" noStyle>
                  <Select style={{ width: 120 }} defaultValue="account">
                    <Option value="account">转出/转入</Option>
                    <Option value="source">转出账户</Option>
                    <Option value="target">转入账户</Option>
                    <Option value="remarks">备注</Option>
                  </Select>
                </Form.Item>
                <Form.Item name="keyword" noStyle>
                  <Input
                    style={{ width: 240 }}
                    placeholder="输入账户ID/邮箱/UID..."
                    allowClear
                    list="accounts-list"
                  />
                </Form.Item>
                <datalist id="accounts-list">
                  {accounts.map(account => (
                    <option key={account.id} value={account.email} />
                  ))}
                </datalist>
              </Space>
            </Form.Item>
            
            <Form.Item name="source" label="来源">
              <Select 
                style={{ width: 150 }}
                placeholder="转账来源" 
                allowClear
              >
                <Option value="manual">手动转账</Option>
                <Option value="affiliate">Affiliate返利</Option>
                <Option value="batch">批量转账</Option>
                <Option value="scheduled">定时任务</Option>
              </Select>
            </Form.Item>
            
            <Form.Item name="status" label="状态">
              <Select 
                style={{ width: 150 }}
                placeholder="转账状态" 
                allowClear
              >
                <Option value="completed">已完成</Option>
                <Option value="pending">待处理</Option>
                <Option value="processing">处理中</Option>
                <Option value="failed">失败</Option>
              </Select>
            </Form.Item>
            
            <Form.Item name="dateRange" label="日期范围">
              <RangePicker style={{ width: 250 }} />
            </Form.Item>
            
            <Form.Item label="金额范围" style={{ marginBottom: 0 }}>
              <Space>
                <Form.Item name="amountMin" noStyle>
                  <Input 
                    style={{ width: 100 }} 
                    placeholder="最小值" 
                    prefix="$"
                  />
                </Form.Item>
                <span>-</span>
                <Form.Item name="amountMax" noStyle>
                  <Input 
                    style={{ width: 100 }} 
                    placeholder="最大值" 
                    prefix="$"
                  />
                </Form.Item>
              </Space>
            </Form.Item>
          </div>
          
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button 
                onClick={handleReset}
                icon={<ReloadOutlined />}
              >
                重置
              </Button>
              <Button 
                type="primary" 
                htmlType="submit"
                icon={<SearchOutlined />}
                loading={loading}
              >
                搜索
              </Button>
              {/* 隐藏导出按钮
              <Button 
                type="primary" 
                ghost
                icon={<ExportOutlined />}
                disabled={data.length === 0}
              >
                导出数据
              </Button>
              */}
            </Space>
          </div>
        </Form>
      </StyledCard>
      
      <TableCard>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={tableParams.pagination}
          onChange={handleTableChange}
          scroll={{ x: 1500 }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { 
              cursor: 'pointer', 
              transition: 'all 0.3s ease'
            },
            className: 'custom-table-row'
          })}
          rowClassName={(record) => 'transfer-row'}
        className="account-details-table transfer-table"
        />
      </TableCard>
      
      {/* 转账详情弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ fontSize: '18px', fontWeight: 'bold', marginRight: '8px' }}>转账详情</span>
            {selectedRecord && (
              <Tag color="blue">ID: {selectedRecord.id}</Tag>
            )}
          </div>
        }
        open={detailVisible}
        onCancel={handleCloseDetail}
        width={1200}
        style={{ top: 20 }}
        bodyStyle={{ padding: '24px', backgroundColor: '#f9f9f9' }}
        footer={[
          <Button key="close" onClick={handleCloseDetail} size="large">
            关闭
          </Button>
        ]}
        className="transfer-detail-modal"
      >
        {selectedRecord && (
          <Row gutter={24}>
            {/* 左侧：转账详细信息 */}
            <Col span={12}>
              <Card 
                style={{ 
                  borderRadius: '8px', 
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                }}
                bodyStyle={{ padding: 0 }}
              >
                <Descriptions 
                  title={
                    <div style={{ 
                      padding: '12px 16px', 
                      borderBottom: '1px solid #f0f0f0',
                      backgroundColor: '#fafafa',
                      fontWeight: 'bold'
                    }}>
                      转账信息
                    </div>
                  } 
                  bordered 
                  column={1} 
                  size="small"
                  labelStyle={{ 
                    fontWeight: 500, 
                    backgroundColor: '#f5f5f5', 
                    width: '120px',
                    padding: '12px 16px'
                  }}
                  contentStyle={{ 
                    padding: '12px 16px' 
                  }}
                >
                <Descriptions.Item label="转账ID">{selectedRecord.id}</Descriptions.Item>
                <Descriptions.Item label="转出账户">
                  {selectedRecord.account_email || selectedRecord.account_id}
                </Descriptions.Item>
                <Descriptions.Item label="目标类型">
                  <Tag color="blue">
                    {selectedRecord.contact_type === 'email' ? '邮箱' : 
                     selectedRecord.contact_type === 'uid' ? 'UID' : 
                     selectedRecord.contact_type}
                  </Tag>
                  {selectedRecord.original_contact_type && selectedRecord.original_contact_type !== selectedRecord.contact_type && (
                    <Tag color="orange" style={{ marginLeft: 8 }}>
                      原始类型: {selectedRecord.original_contact_type}
                    </Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="目标标识">{selectedRecord.target_identifier}</Descriptions.Item>
                
                {selectedRecord.matched_account_email && (
                  <Descriptions.Item label="匹配账户">
                    {selectedRecord.matched_account_email}
                  </Descriptions.Item>
                )}
                
                <Descriptions.Item label="金额">
                  <span style={{ color: '#52c41a', fontWeight: 'bold' }}>${selectedRecord.amount}</span>
                </Descriptions.Item>
                
                <Descriptions.Item label="来源">
                  <Tag color="purple">
                    {selectedRecord.source === 'manual' ? '手动转账' : 
                     selectedRecord.source === 'affiliate' ? 'Affiliate返利' : 
                     selectedRecord.source === 'batch' ? '批量转账' : 
                     selectedRecord.source === 'scheduled' ? '定时任务' : 
                     selectedRecord.source}
                  </Tag>
                </Descriptions.Item>
                
                <Descriptions.Item label="状态">
                  <Tag color={
                    selectedRecord.status === 'completed' ? 'success' : 
                    selectedRecord.status === 'pending' ? 'warning' : 
                    selectedRecord.status === 'processing' ? 'processing' : 
                    selectedRecord.status === 'failed' ? 'error' : 'default'
                  }>
                    {selectedRecord.status === 'completed' ? '完成' : 
                     selectedRecord.status === 'pending' ? '待处理' : 
                     selectedRecord.status === 'processing' ? '处理中' : 
                     selectedRecord.status === 'failed' ? '失败' : 
                     selectedRecord.status}
                  </Tag>
                </Descriptions.Item>
                
                <Descriptions.Item label="备注">{selectedRecord.remarks || '-'}</Descriptions.Item>
                
                <Descriptions.Item label="创建时间">
                  {selectedRecord.created_at ? dayjs(selectedRecord.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
                
                <Descriptions.Item label="完成时间">
                  {selectedRecord.completed_at ? dayjs(selectedRecord.completed_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Descriptions.Item>
              </Descriptions>
              </Card>
            </Col>
            
            {/* 右侧：转账时间轴 */}
            <Col span={12}>
              <Card 
                style={{ 
                  borderRadius: '8px', 
                  overflow: 'hidden',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                  height: '100%'
                }}
                bodyStyle={{ 
                  padding: 0,
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div style={{ 
                  padding: '12px 16px', 
                  borderBottom: '1px solid #f0f0f0',
                  backgroundColor: '#fafafa',
                  fontWeight: 'bold'
                }}>
                  转账进度时间轴
                </div>
                <div style={{ 
                  flexGrow: 1, 
                  height: 580, 
                  overflowY: 'auto', 
                  padding: '16px', 
                  backgroundColor: '#fff',
                  backgroundImage: 'linear-gradient(to bottom, rgba(240, 249, 255, 0.2), transparent)'
                }}>
                  <TransferTimeline 
                    visible={true}
                    sourceAccountId={selectedRecord.account_id}
                    isInternal={true}
                    onClose={() => {}}
                    key={`transfer-${selectedRecord.id}`} // 添加key确保组件刷新
                  />
                </div>
              </Card>
            </Col>
          </Row>
        )}
      </Modal>
    </PageContainer>
  );
};

export default AccountDetails;