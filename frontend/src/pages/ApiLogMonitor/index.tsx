/**
 * API日志监控页面
 * 用于查看和筛选系统中的API请求日志，支持按业务类型筛选
 */
import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Form, Row, Col, Button, DatePicker, 
  Input, Select, Space, Tag, Badge, Drawer, Typography, Divider, message
} from 'antd';
import { 
  ReloadOutlined, SearchOutlined, 
  ClearOutlined, DownloadOutlined, 
  ApiOutlined, CodeOutlined, EyeOutlined 
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { axiosLogsApi } from '../../services/api';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

// 日志状态标签颜色映射
const statusColors: Record<number, string> = {
  200: 'success',
  201: 'success',
  204: 'success',
  400: 'warning',
  401: 'error',
  403: 'error',
  404: 'warning',
  500: 'error'
};

// 请求方法标签颜色映射
const methodColors: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'orange',
  DELETE: 'red',
  PATCH: 'purple'
};

// JSON格式化展示组件
const JsonDisplay: React.FC<{ data: any }> = ({ data }) => {
  return (
    <pre style={{ 
      background: '#f5f5f5', 
      padding: '8px', 
      borderRadius: '4px',
      maxHeight: '300px',
      overflow: 'auto'
    }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
};

const ApiLogMonitor: React.FC = () => {
  // 状态定义
  const [loading, setLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50', '100']
  });
  const [filters, setFilters] = useState<any>({});
  const [businessModules, setBusinessModules] = useState<string[]>([]);
  const [businessOperations, setBusinessOperations] = useState<string[]>([]);
  const [selectedBusinessModule, setSelectedBusinessModule] = useState<string>('');
  const [detailVisible, setDetailVisible] = useState<boolean>(false);
  const [currentLog, setCurrentLog] = useState<any>(null);
  
  const [form] = Form.useForm();
  
  // 页面加载时获取数据
  useEffect(() => {
    fetchLogs();
    fetchBusinessModules();
  }, []);
  
  // 业务模块变化时，获取对应的操作类型
  useEffect(() => {
    if (selectedBusinessModule) {
      fetchBusinessOperations(selectedBusinessModule);
    } else {
      setBusinessOperations([]);
    }
  }, [selectedBusinessModule]);
  
  // 获取日志数据
  const fetchLogs = async (page = pagination.current, pageSize = pagination.pageSize) => {
    try {
      setLoading(true);
      
      // 构建查询参数
      const params = {
        ...filters,
        page,
        pageSize
      };
      
      // 调用API
      const response = await axiosLogsApi.getLogs(params);
      
      if (response.success) {
        setLogs(response.data.logs);
        setPagination({
          ...pagination,
          current: page,
          pageSize: pageSize,
          total: response.data.pagination.total
        });
      } else {
        message.error(response.message || '获取API日志失败');
      }
    } catch (error) {
      console.error('获取API日志失败:', error);
      message.error('获取API日志失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 获取业务模块列表
  const fetchBusinessModules = async () => {
    try {
      const response = await axiosLogsApi.getBusinessModules();
      if (response.success) {
        setBusinessModules(response.data || []);
      }
    } catch (error) {
      console.error('获取业务模块列表失败:', error);
    }
  };
  
  // 获取业务操作类型列表
  const fetchBusinessOperations = async (businessModule: string) => {
    try {
      const response = await axiosLogsApi.getBusinessOperations(businessModule);
      if (response.success) {
        setBusinessOperations(response.data || []);
      }
    } catch (error) {
      console.error('获取业务操作类型列表失败:', error);
    }
  };
  
  // 处理表单提交
  const handleSearch = () => {
    const values = form.getFieldsValue();
    
    // 处理日期范围
    let startDate, endDate;
    if (values.dateRange && values.dateRange.length === 2) {
      startDate = values.dateRange[0].startOf('day').toISOString();
      endDate = values.dateRange[1].endOf('day').toISOString();
    }
    
    // 构建筛选条件
    const newFilters = {
      startDate,
      endDate,
      businessModule: values.businessModule,
      businessOperation: values.businessOperation,
      url: values.url,
      method: values.method,
      statusCode: values.statusCode ? parseInt(values.statusCode, 10) : undefined,
      success: values.success === 'all' ? undefined : values.success === 'true'
    };
    
    // 更新筛选条件并重新获取数据
    setFilters(newFilters);
    setPagination({...pagination, current: 1});
    fetchLogs(1, pagination.pageSize);
  };
  
  // 重置表单
  const handleReset = () => {
    form.resetFields();
    setFilters({});
    setSelectedBusinessModule('');
    fetchLogs(1, pagination.pageSize);
  };
  
  // 查看日志详情
  const viewLogDetail = (record: any) => {
    setCurrentLog(record);
    setDetailVisible(true);
  };
  
  // 处理表格分页、筛选、排序变化
  const handleTableChange = (pagination: any) => {
    fetchLogs(pagination.current, pagination.pageSize);
  };
  
  // 处理业务模块选择变化
  const handleBusinessModuleChange = (value: string) => {
    setSelectedBusinessModule(value);
    form.setFieldsValue({businessOperation: undefined}); // 清空操作类型
  };
  
  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 100,
      render: (text: string) => (
        <Tag color={methodColors[text] || 'default'} key={text}>
          {text}
        </Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status_code',
      key: 'status_code',
      width: 100,
      render: (status: number, record: any) => (
        <Space>
          <Badge 
            status={record.success ? 'success' : 'error'} 
            text={status || '失败'} 
          />
        </Space>
      )
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (text: string) => (
        <Typography.Text 
          ellipsis={{ tooltip: text }}
          style={{ maxWidth: 300 }}
        >
          {text}
        </Typography.Text>
      )
    },
    {
      title: '业务模块',
      dataIndex: 'business_module',
      key: 'business_module',
      width: 120,
      render: (text: string) => text || '-'
    },
    {
      title: '业务操作',
      dataIndex: 'business_operation',
      key: 'business_operation',
      width: 120,
      render: (text: string) => text || '-'
    },
    {
      title: '响应时间',
      dataIndex: 'duration_ms',
      key: 'duration_ms',
      width: 120,
      render: (ms: number) => `${ms}ms`
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: any) => (
        <Button 
          type="link" 
          icon={<EyeOutlined />} 
          onClick={() => viewLogDetail(record)}
        >
          详情
        </Button>
      )
    }
  ];
  
  return (
    <div className="api-log-monitor">
      <Card title={<><ApiOutlined /> API日志监控</>} bordered={false}>
        {/* 筛选表单 */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSearch}
          initialValues={{
            success: 'all'
          }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={24} md={8} lg={6}>
              <Form.Item label="日期范围" name="dateRange">
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Form.Item label="业务模块" name="businessModule">
                <Select 
                  placeholder="选择业务模块"
                  allowClear
                  onChange={handleBusinessModuleChange}
                >
                  {businessModules.map(module => (
                    <Option key={module} value={module}>{module}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Form.Item label="业务操作" name="businessOperation">
                <Select 
                  placeholder="选择业务操作"
                  allowClear
                  disabled={businessOperations.length === 0}
                >
                  {businessOperations.map(operation => (
                    <Option key={operation} value={operation}>{operation}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Form.Item label="HTTP方法" name="method">
                <Select placeholder="选择方法" allowClear>
                  <Option value="GET">GET</Option>
                  <Option value="POST">POST</Option>
                  <Option value="PUT">PUT</Option>
                  <Option value="DELETE">DELETE</Option>
                  <Option value="PATCH">PATCH</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={3}>
              <Form.Item label="状态码" name="statusCode">
                <Input placeholder="如: 200" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={3}>
              <Form.Item label="状态" name="success">
                <Select>
                  <Option value="all">全部</Option>
                  <Option value="true">成功</Option>
                  <Option value="false">失败</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={24} lg={24}>
              <Form.Item label="URL包含" name="url">
                <Input placeholder="输入URL关键词" />
              </Form.Item>
            </Col>
          </Row>
          <Row justify="end">
            <Col>
              <Space>
                <Button 
                  icon={<SearchOutlined />} 
                  type="primary" 
                  onClick={handleSearch}
                >
                  查询
                </Button>
                <Button 
                  icon={<ClearOutlined />} 
                  onClick={handleReset}
                >
                  重置
                </Button>
                <Button 
                  icon={<ReloadOutlined />} 
                  onClick={() => fetchLogs()}
                >
                  刷新
                </Button>
              </Space>
            </Col>
          </Row>
        </Form>
        
        {/* 数据表格 */}
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={pagination}
          onChange={handleTableChange}
          scroll={{ x: 'max-content' }}
        />
      </Card>
      
      {/* 日志详情抽屉 */}
      <Drawer
        title={<Space><CodeOutlined /> API日志详情</Space>}
        width={720}
        placement="right"
        onClose={() => setDetailVisible(false)}
        visible={detailVisible}
        extra={
          <Button 
            type="primary" 
            onClick={() => setDetailVisible(false)}
          >
            关闭
          </Button>
        }
      >
        {currentLog && (
          <>
            <Row>
              <Col span={24}>
                <Title level={5}>基本信息</Title>
                <Row gutter={16}>
                  <Col span={12}>
                    <Text strong>请求时间：</Text>
                    <Text>{dayjs(currentLog.created_at).format('YYYY-MM-DD HH:mm:ss')}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>响应时间：</Text>
                    <Text>{currentLog.duration_ms}ms</Text>
                  </Col>
                </Row>
                <Row gutter={16} style={{marginTop: 8}}>
                  <Col span={12}>
                    <Text strong>HTTP方法：</Text>
                    <Tag color={methodColors[currentLog.method] || 'default'}>
                      {currentLog.method}
                    </Tag>
                  </Col>
                  <Col span={12}>
                    <Text strong>状态码：</Text>
                    <Tag color={statusColors[currentLog.status_code] || 'default'}>
                      {currentLog.status_code || '无响应'}
                    </Tag>
                  </Col>
                </Row>
                
                <Divider />
                
                <Title level={5}>业务上下文</Title>
                <Row gutter={16}>
                  <Col span={12}>
                    <Text strong>业务模块：</Text>
                    <Text>{currentLog.business_module || '未指定'}</Text>
                  </Col>
                  <Col span={12}>
                    <Text strong>业务操作：</Text>
                    <Text>{currentLog.business_operation || '未指定'}</Text>
                  </Col>
                </Row>
                
                {currentLog.business_context && (
                  <Row style={{marginTop: 8}}>
                    <Col span={24}>
                      <Text strong>上下文数据：</Text>
                      <div style={{marginTop: 8}}>
                        {(() => {
                          try {
                            const jsonData = JSON.parse(currentLog.business_context);
                            return <JsonDisplay data={jsonData} />;
                          } catch {
                            return <pre>{currentLog.business_context}</pre>;
                          }
                        })()}
                      </div>
                    </Col>
                  </Row>
                )}
                
                <Divider />
                
                <Title level={5}>请求信息</Title>
                <Row>
                  <Col span={24}>
                    <Text strong>URL：</Text>
                    <Paragraph copyable>{currentLog.url}</Paragraph>
                  </Col>
                </Row>
                
                {currentLog.request_headers && (
                  <Row style={{marginTop: 8}}>
                    <Col span={24}>
                      <Text strong>请求头：</Text>
                      <div style={{marginTop: 8}}>
                        {(() => {
                          try {
                            const jsonData = JSON.parse(currentLog.request_headers);
                            return <JsonDisplay data={jsonData} />;
                          } catch {
                            return <pre>{currentLog.request_headers}</pre>;
                          }
                        })()}
                      </div>
                    </Col>
                  </Row>
                )}
                
                {currentLog.request_body && (
                  <Row style={{marginTop: 16}}>
                    <Col span={24}>
                      <Text strong>请求体：</Text>
                      <div style={{marginTop: 8}}>
                        {(() => {
                          try {
                            const jsonData = JSON.parse(currentLog.request_body);
                            return <JsonDisplay data={jsonData} />;
                          } catch {
                            return <pre>{currentLog.request_body}</pre>;
                          }
                        })()}
                      </div>
                    </Col>
                  </Row>
                )}
                
                <Divider />
                
                <Title level={5}>响应信息</Title>
                {currentLog.error_message && (
                  <Row>
                    <Col span={24}>
                      <Text strong>错误信息：</Text>
                      <Paragraph>
                        <Text type="danger">{currentLog.error_message}</Text>
                      </Paragraph>
                    </Col>
                  </Row>
                )}
                
                {currentLog.response_headers && (
                  <Row style={{marginTop: 8}}>
                    <Col span={24}>
                      <Text strong>响应头：</Text>
                      <div style={{marginTop: 8}}>
                        {(() => {
                          try {
                            const jsonData = JSON.parse(currentLog.response_headers);
                            return <JsonDisplay data={jsonData} />;
                          } catch {
                            return <pre>{currentLog.response_headers}</pre>;
                          }
                        })()}
                      </div>
                    </Col>
                  </Row>
                )}
                
                {currentLog.response_body && (
                  <Row style={{marginTop: 16}}>
                    <Col span={24}>
                      <Text strong>响应体：</Text>
                      <div style={{marginTop: 8}}>
                        {(() => {
                          try {
                            const jsonData = JSON.parse(currentLog.response_body);
                            return <JsonDisplay data={jsonData} />;
                          } catch {
                            return <pre>{currentLog.response_body}</pre>;
                          }
                        })()}
                      </div>
                    </Col>
                  </Row>
                )}
              </Col>
            </Row>
          </>
        )}
      </Drawer>
    </div>
  );
};

export default ApiLogMonitor;