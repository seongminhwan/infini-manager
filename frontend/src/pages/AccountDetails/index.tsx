import React, { useState, useEffect } from 'react';
import { Card, Table, Form, Select, DatePicker, Button, Input, Space, Typography, Tag, message } from 'antd';
import { SearchOutlined, ReloadOutlined, ExportOutlined } from '@ant-design/icons';
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
      const { accountId, status, dateRange, amountMin, amountMax, keyword } = params;
      
      // 构建API请求参数
      const queryParams: any = {
        page: tableParams.pagination.current,
        pageSize: tableParams.pagination.pageSize,
      };
      
      // 添加筛选条件
      if (accountId) {
        queryParams.accountId = accountId;
      }
      
      if (status) {
        queryParams.status = status;
      }
      
      // 日期范围筛选 - 在实际API中可能需要特定格式
      if (dateRange && dateRange[0] && dateRange[1]) {
        queryParams.startDate = dateRange[0].format('YYYY-MM-DD');
        queryParams.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      
      // 金额范围筛选
      if (amountMin) {
        queryParams.amountMin = amountMin;
      }
      
      if (amountMax) {
        queryParams.amountMax = amountMax;
      }
      
      // 关键词搜索
      if (keyword) {
        queryParams.keyword = keyword;
      }
      
      // 创建完整URL查询参数字符串
      let url = `/api/transfers?page=${queryParams.page}&pageSize=${queryParams.pageSize}`;
      
      if (queryParams.accountId) {
        url += `&accountId=${queryParams.accountId}`;
      }
      
      if (queryParams.status) {
        url += `&status=${queryParams.status}`;
      }
      
      if (queryParams.startDate && queryParams.endDate) {
        url += `&startDate=${queryParams.startDate}&endDate=${queryParams.endDate}`;
      }
      
      if (queryParams.amountMin) {
        url += `&amountMin=${queryParams.amountMin}`;
      }
      
      if (queryParams.amountMax) {
        url += `&amountMax=${queryParams.amountMax}`;
      }
      
      if (queryParams.keyword) {
        url += `&keyword=${encodeURIComponent(queryParams.keyword)}`;
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
            
            <Form.Item name="keyword" label="关键字搜索">
              <Input 
                style={{ width: 200 }}
                placeholder="ID/邮箱/UID..."
                allowClear
              />
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
              <Button 
                type="primary" 
                ghost
                icon={<ExportOutlined />}
                disabled={data.length === 0}
              >
                导出数据
              </Button>
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
        />
      </TableCard>
    </PageContainer>
  );
};

export default AccountDetails;