/**
 * 代理管理页面
 * 提供全局代理策略配置、代理服务器管理和验证等功能
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  Tooltip,
  Row,
  Col,
  Progress,
  Alert,
  Badge,
  Popconfirm,
  InputNumber,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  UploadOutlined,
  SettingOutlined,
  ApiOutlined,
  GlobalOutlined,
  SecurityScanOutlined,
  ThunderboltOutlined,
  BugOutlined,
  RocketOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { proxyPoolApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// 接口定义
interface ProxyPool {
  id: number;
  name: string;
  description?: string;
  proxy_mode: 'none' | 'round_robin' | 'random' | 'failover';
  enabled: boolean;
  proxy_stats?: {
    total: number;
    enabled: number;
    healthy: number;
  };
  created_at: string;
  updated_at: string;
}

interface ProxyServer {
  id: number;
  pool_id: number;
  name: string;
  proxy_type: 'http' | 'https' | 'socks4' | 'socks5';
  host: string;
  port: number;
  username?: string;
  password?: string;
  enabled: boolean;
  is_healthy: boolean;
  response_time?: number;
  success_count: number;
  failure_count: number;
  last_check_at?: string;
  created_at: string;
  updated_at: string;
}

const ProxyManage: React.FC = () => {
  // 状态管理
  const [pools, setPools] = useState<ProxyPool[]>([]);
  const [servers, setServers] = useState<ProxyServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [serversLoading, setServersLoading] = useState(false);
  const [selectedPool, setSelectedPool] = useState<ProxyPool | null>(null);
  
  // 弹窗状态
  const [poolModalVisible, setPoolModalVisible] = useState(false);
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [editingPool, setEditingPool] = useState<ProxyPool | null>(null);
  const [editingServer, setEditingServer] = useState<ProxyServer | null>(null);
  
  // 表单
  const [poolForm] = Form.useForm();
  const [serverForm] = Form.useForm();
  const [batchForm] = Form.useForm();

  // 代理策略选项
  const proxyModeOptions = [
    { value: 'none', label: '无代理', icon: <CloseCircleOutlined />, description: '不使用代理，直连访问' },
    { value: 'round_robin', label: '轮询模式', icon: <SyncOutlined />, description: '按顺序轮流使用代理' },
    { value: 'random', label: '随机模式', icon: <ThunderboltOutlined />, description: '随机选择代理' },
    { value: 'failover', label: '故障转移', icon: <SecurityScanOutlined />, description: '优先使用成功率高的代理' },
  ];

  // 代理类型选项
  const proxyTypeOptions = [
    { value: 'http', label: 'HTTP', color: '#52c41a' },
    { value: 'https', label: 'HTTPS', color: '#1890ff' },
    { value: 'socks4', label: 'SOCKS4', color: '#722ed1' },
    { value: 'socks5', label: 'SOCKS5', color: '#eb2f96' },
  ];

  // 页面加载时获取数据
  useEffect(() => {
    fetchPools();
  }, []);

  // 选择代理策略组时获取服务器列表
  useEffect(() => {
    if (selectedPool) {
      fetchServers(selectedPool.id);
    }
  }, [selectedPool]);

  // 获取代理策略组列表
  const fetchPools = async () => {
    setLoading(true);
    try {
      const response = await proxyPoolApi.getPools();
      if (response.success) {
        setPools(response.data || []);
        // 默认选择第一个代理策略组
        if (response.data && response.data.length > 0 && !selectedPool) {
          setSelectedPool(response.data[0]);
        }
      } else {
        message.error(response.message || '获取代理策略列表失败');
      }
    } catch (error) {
      console.error('获取代理策略列表失败:', error);
      message.error('获取代理策略列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取代理服务器列表
  const fetchServers = async (poolId: number) => {
    setServersLoading(true);
    try {
      const response = await proxyPoolApi.getServers(poolId);
      if (response.success) {
        setServers(response.data || []);
      } else {
        message.error(response.message || '获取代理服务器列表失败');
      }
    } catch (error) {
      console.error('获取代理服务器列表失败:', error);
      message.error('获取代理服务器列表失败');
    } finally {
      setServersLoading(false);
    }
  };

  // 创建/编辑代理策略组
  const handlePoolSubmit = async (values: any) => {
    try {
      const response = editingPool
        ? await proxyPoolApi.updatePool(editingPool.id, values)
        : await proxyPoolApi.createPool(values);
      
      if (response.success) {
        message.success(editingPool ? '代理策略更新成功' : '代理策略创建成功');
        setPoolModalVisible(false);
        setEditingPool(null);
        poolForm.resetFields();
        fetchPools();
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('代理策略操作失败:', error);
      message.error('操作失败');
    }
  };

  // 创建/编辑代理服务器
  const handleServerSubmit = async (values: any) => {
    if (!selectedPool) return;
    
    try {
      const response = editingServer
        ? await proxyPoolApi.updateServer(editingServer.id, values)
        : await proxyPoolApi.addServer(selectedPool.id, values);
      
      if (response.success) {
        message.success(editingServer ? '代理服务器更新成功' : '代理服务器添加成功');
        setServerModalVisible(false);
        setEditingServer(null);
        serverForm.resetFields();
        fetchServers(selectedPool.id);
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('代理服务器操作失败:', error);
      message.error('操作失败');
    }
  };

  // 批量导入代理
  const handleBatchImport = async (values: any) => {
    if (!selectedPool) return;
    
    try {
      const proxyStrings = values.proxyList
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line);
      
      if (proxyStrings.length === 0) {
        message.warning('请输入有效的代理地址');
        return;
      }
      
      const response = await proxyPoolApi.batchAddServers(selectedPool.id, proxyStrings);
      
      if (response.success) {
        message.success(`成功导入 ${response.data.added} 个代理服务器`);
        setBatchModalVisible(false);
        batchForm.resetFields();
        fetchServers(selectedPool.id);
      } else {
        message.error(response.message || '批量导入失败');
      }
    } catch (error) {
      console.error('批量导入失败:', error);
      message.error('批量导入失败');
    }
  };

  // 删除代理服务器
  const handleDeleteServer = async (serverId: number) => {
    try {
      const response = await proxyPoolApi.deleteServer(serverId);
      if (response.success) {
        message.success('代理服务器删除成功');
        if (selectedPool) {
          fetchServers(selectedPool.id);
        }
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      console.error('删除代理服务器失败:', error);
      message.error('删除失败');
    }
  };

  // 验证代理
  const handleValidateProxy = async (serverId: number) => {
    try {
      const response = await proxyPoolApi.validateServer(serverId);
      if (response.success) {
        message.success('代理验证完成');
        if (selectedPool) {
          fetchServers(selectedPool.id);
        }
      } else {
        message.error(response.message || '验证失败');
      }
    } catch (error) {
      console.error('代理验证失败:', error);
      message.error('验证失败');
    }
  };

  // 健康检查
  const handleHealthCheck = async () => {
    try {
      const response = await proxyPoolApi.healthCheck();
      if (response.success) {
        message.success('健康检查已开始，请稍后查看结果');
        // 延迟刷新数据
        setTimeout(() => {
          if (selectedPool) {
            fetchServers(selectedPool.id);
          }
        }, 3000);
      } else {
        message.error(response.message || '健康检查启动失败');
      }
    } catch (error) {
      console.error('健康检查失败:', error);
      message.error('健康检查失败');
    }
  };

  // 渲染代理统计
  const renderPoolStats = () => {
    if (!selectedPool?.proxy_stats) return null;
    
    const { total, enabled, healthy } = selectedPool.proxy_stats;
    const healthyRate = total > 0 ? Math.round((healthy / total) * 100) : 0;
    
    return (
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="总代理数"
              value={total}
              prefix={<ApiOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="已启用"
              value={enabled}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="健康代理"
              value={healthy}
              prefix={<SecurityScanOutlined />}
              valueStyle={{ color: healthy > 0 ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="健康率"
              value={healthyRate}
              suffix="%"
              prefix={<RocketOutlined />}
              valueStyle={{ 
                color: healthyRate >= 80 ? '#52c41a' : healthyRate >= 50 ? '#faad14' : '#ff4d4f' 
              }}
            />
          </Card>
        </Col>
      </Row>
    );
  };

  // 代理策略表格列
  const poolColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ProxyPool) => (
        <Space>
          <GlobalOutlined style={{ color: '#1890ff' }} />
          <Text strong>{text}</Text>
          {!record.enabled && <Tag color="warning">已禁用</Tag>}
        </Space>
      ),
    },
    {
      title: '代理策略',
      dataIndex: 'proxy_mode',
      key: 'proxy_mode',
      render: (mode: string) => {
        const option = proxyModeOptions.find(opt => opt.value === mode);
        return (
          <Space>
            {option?.icon}
            <span>{option?.label}</span>
          </Space>
        );
      },
    },
    {
      title: '代理统计',
      key: 'stats',
      render: (record: ProxyPool) => {
        const stats = record.proxy_stats;
        if (!stats) return '-';
        
        return (
          <Space>
            <Badge count={stats.total} showZero style={{ backgroundColor: '#1890ff' }} />
            <Badge count={stats.healthy} showZero style={{ backgroundColor: '#52c41a' }} />
            <Badge count={stats.total - stats.healthy} showZero style={{ backgroundColor: '#ff4d4f' }} />
          </Space>
        );
      },
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (record: ProxyPool) => (
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={() => setSelectedPool(record)}
          >
            管理
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingPool(record);
              setPoolModalVisible(true);
              poolForm.setFieldsValue(record);
            }}
          />
        </Space>
      ),
    },
  ];

  // 代理服务器表格列
  const serverColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ProxyServer) => (
        <Space direction="vertical" size={4}>
          <Space>
            <Text strong>{text}</Text>
            {!record.enabled && <Tag color="warning">已禁用</Tag>}
          </Space>
          {record.is_healthy ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>健康</Tag>
          ) : (
            <Tag color="error" icon={<CloseCircleOutlined />}>异常</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'proxy_type',
      key: 'proxy_type',
      render: (type: string) => {
        const option = proxyTypeOptions.find(opt => opt.value === type);
        return <Tag color={option?.color}>{option?.label}</Tag>;
      },
    },
    {
      title: '地址',
      key: 'address',
      render: (record: ProxyServer) => (
        <Text code>{record.host}:{record.port}</Text>
      ),
    },
    {
      title: '认证',
      key: 'auth',
      render: (record: ProxyServer) => 
        record.username ? <Tag color="blue">已配置</Tag> : <Tag>无</Tag>,
    },
    {
      title: '响应时间',
      dataIndex: 'response_time',
      key: 'response_time',
      render: (time: number) => time ? (
        <Text style={{ color: time < 1000 ? '#52c41a' : time < 3000 ? '#faad14' : '#ff4d4f' }}>
          {time}ms
        </Text>
      ) : '-',
    },
    {
      title: '成功率',
      key: 'success_rate',
      render: (record: ProxyServer) => {
        const total = record.success_count + record.failure_count;
        if (total === 0) return '-';
        
        const rate = Math.round((record.success_count / total) * 100);
        return (
          <Progress
            percent={rate}
            size="small"
            status={rate >= 80 ? 'success' : rate >= 50 ? 'normal' : 'exception'}
            strokeColor={rate >= 80 ? '#52c41a' : rate >= 50 ? '#faad14' : '#ff4d4f'}
          />
        );
      },
    },
    {
      title: '最后检查',
      dataIndex: 'last_check_at',
      key: 'last_check_at',
      render: (time: string) => {
        if (!time) return '-';
        return (
          <Tooltip title={new Date(time).toLocaleString()}>
            <Space>
              <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
              <Text type="secondary">{new Date(time).toLocaleTimeString()}</Text>
            </Space>
          </Tooltip>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (record: ProxyServer) => (
        <Space size="small">
          <Tooltip title="验证代理">
            <Button
              size="small"
              icon={<BugOutlined />}
              onClick={() => handleValidateProxy(record.id)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingServer(record);
                setServerModalVisible(true);
                serverForm.setFieldsValue(record);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个代理服务器吗？"
            onConfirm={() => handleDeleteServer(record.id)}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <GlobalOutlined /> 代理管理
        </Title>
        <Paragraph>
          配置全局代理策略和代理服务器，支持HTTP、HTTPS、SOCKS4、SOCKS5代理，提供多种代理策略和健康检查功能。
        </Paragraph>
      </div>

      {/* 代理策略列表 */}
      <Card
        title={
          <Space>
            <SettingOutlined />
            代理策略配置
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingPool(null);
              setPoolModalVisible(true);
              poolForm.resetFields();
            }}
          >
            新建代理策略
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        <Table
          dataSource={pools}
          columns={poolColumns}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个代理策略`,
            pageSize: 10,
          }}
        />
      </Card>

      {/* 代理服务器管理 */}
      {selectedPool && (
        <Card
          title={
            <Space>
              <ApiOutlined />
              {selectedPool.name} - 代理服务器
              <Tag color="blue" style={{ marginLeft: 8 }}>
                {proxyModeOptions.find(opt => opt.value === selectedPool.proxy_mode)?.label}
              </Tag>
            </Space>
          }
          extra={
            <Space>
              <Button
                icon={<SecurityScanOutlined />}
                onClick={handleHealthCheck}
              >
                健康检查
              </Button>
              <Button
                icon={<UploadOutlined />}
                onClick={() => setBatchModalVisible(true)}
              >
                批量导入
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingServer(null);
                  setServerModalVisible(true);
                  serverForm.resetFields();
                }}
              >
                添加代理
              </Button>
            </Space>
          }
        >
          {renderPoolStats()}
          
          <Table
            dataSource={servers}
            columns={serverColumns}
            rowKey="id"
            loading={serversLoading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 个代理服务器`,
              pageSize: 10,
            }}
          />
        </Card>
      )}

      {/* 创建/编辑代理策略弹窗 */}
      <Modal
        title={editingPool ? '编辑代理策略' : '创建代理策略'}
        open={poolModalVisible}
        onCancel={() => {
          setPoolModalVisible(false);
          setEditingPool(null);
          poolForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={poolForm}
          layout="vertical"
          onFinish={handlePoolSubmit}
        >
          <Form.Item
            name="name"
            label="策略名称"
            rules={[{ required: true, message: '请输入策略名称' }]}
          >
            <Input placeholder="例如：主要代理策略" />
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea placeholder="代理策略描述信息" rows={3} />
          </Form.Item>

          <Form.Item
            name="proxy_mode"
            label="代理策略"
            rules={[{ required: true, message: '请选择代理策略' }]}
            initialValue="round_robin"
          >
            <Select placeholder="选择代理策略">
              {proxyModeOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  <Space>
                    {option.icon}
                    <div>
                      <div>{option.label}</div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {option.description}
                      </Text>
                    </div>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="enabled"
            valuePropName="checked"
            initialValue={true}
          >
            <Space>
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              <Text type="secondary">启用此代理策略</Text>
            </Space>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingPool ? '更新' : '创建'}
              </Button>
              <Button
                onClick={() => {
                  setPoolModalVisible(false);
                  setEditingPool(null);
                  poolForm.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 创建/编辑代理服务器弹窗 */}
      <Modal
        title={editingServer ? '编辑代理服务器' : '添加代理服务器'}
        open={serverModalVisible}
        onCancel={() => {
          setServerModalVisible(false);
          setEditingServer(null);
          serverForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={serverForm}
          layout="vertical"
          onFinish={handleServerSubmit}
        >
          <Form.Item
            name="name"
            label="代理名称"
            rules={[{ required: true, message: '请输入代理名称' }]}
          >
            <Input placeholder="例如：代理服务器-1" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="proxy_type"
                label="代理类型"
                rules={[{ required: true, message: '请选择代理类型' }]}
                initialValue="http"
              >
                <Select>
                  {proxyTypeOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                      <Tag color={option.color}>{option.label}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="host"
                label="主机地址"
                rules={[{ required: true, message: '请输入主机地址' }]}
              >
                <Input placeholder="127.0.0.1" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item
                name="port"
                label="端口"
                rules={[{ required: true, message: '请输入端口' }]}
              >
                <InputNumber
                  placeholder="8080"
                  min={1}
                  max={65535}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="用户名（可选）"
              >
                <Input placeholder="代理认证用户名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="password"
                label="密码（可选）"
              >
                <Input.Password placeholder="代理认证密码" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="enabled"
            valuePropName="checked"
            initialValue={true}
          >
            <Space>
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              <Text type="secondary">启用此代理服务器</Text>
            </Space>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingServer ? '更新' : '添加'}
              </Button>
              <Button
                onClick={() => {
                  setServerModalVisible(false);
                  setEditingServer(null);
                  serverForm.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量导入弹窗 */}
      <Modal
        title="批量导入代理"
        open={batchModalVisible}
        onCancel={() => {
          setBatchModalVisible(false);
          batchForm.resetFields();
        }}
        footer={null}
        width={700}
      >
        <Alert
          message="支持的代理格式"
          description={
            <div style={{ lineHeight: '1.8' }}>
              <p>• <Text code>192.168.0.1:8080</Text> (默认HTTP)</p>
              <p>• <Text code>192.168.0.1:8080{'备注'}</Text></p>
              <p>• <Text code>192.168.0.1:8000:代理账号:代理密码{'备注'}</Text></p>
              <p>• <Text code>socks5://192.168.0.1:8000[刷新URL]{'备注'}</Text></p>
              <p>• <Text code>http://[2001:db8:2de:0:0:0:0:e13]:8000[刷新URL]{'备注'}</Text></p>
              <p>• <Text code>socks5://代理账号:代理密码@192.168.0.1:8000[刷新URL]{'备注'}</Text></p>
              <p>• <Text code>代理账号:代理密码@192.168.0.1:8000</Text></p>
              <p>• <Text code>http://127.0.0.1:8080</Text></p>
              <p>• <Text code>socks5://127.0.0.1:1080</Text></p>
              <p>• <Text code>http://user:pass@127.0.0.1:8080</Text></p>
              <p style={{ marginBottom: 0 }}>每行一个代理地址，系统会自动解析格式</p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
        />

        <Form
          form={batchForm}
          layout="vertical"
          onFinish={handleBatchImport}
        >
          <Form.Item
            name="proxyList"
            label="代理列表"
            rules={[{ required: true, message: '请输入代理地址列表' }]}
          >
            <TextArea
              placeholder={`192.168.0.1:8080{示例备注}\n192.168.0.1:8000:账号:密码\nsocks5://192.168.0.1:8000[刷新URL]{示例备注}\nhttp://[IPv6]:8080\n代理账号:代理密码@192.168.0.1:8000`}
              rows={10}
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                导入代理
              </Button>
              <Button
                onClick={() => {
                  setBatchModalVisible(false);
                  batchForm.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProxyManage;