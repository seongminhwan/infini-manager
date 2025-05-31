/**
 * 代理管理页面
 * 提供全局代理策略配置和代理服务器管理功能
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
  Descriptions,
  Empty,
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
  TagOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { proxyPoolApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// 接口定义
interface ProxyTag {
  id: number;
  name: string;
  description?: string;
  color?: string;
  created_at?: string;
  updated_at?: string;
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
  tags?: ProxyTag[]; // 标签列表
}

interface GlobalProxyConfig {
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
}

const ProxyManage: React.FC = () => {
  // 状态管理
  const [globalConfig, setGlobalConfig] = useState<GlobalProxyConfig | null>(null);
  const [servers, setServers] = useState<ProxyServer[]>([]);
  const [loading, setLoading] = useState(false);
  const [serversLoading, setServersLoading] = useState(false);
  
  // 弹窗状态
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [serverModalVisible, setServerModalVisible] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);
  const [editingServer, setEditingServer] = useState<ProxyServer | null>(null);
  
  // 标签管理相关状态
  const [tags, setTags] = useState<ProxyTag[]>([]);
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [editingTag, setEditingTag] = useState<ProxyTag | null>(null);
  const [serverTagModalVisible, setServerTagModalVisible] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [serverTags, setServerTags] = useState<ProxyTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  
  // 批量导入预览相关状态
  const [previewMode, setPreviewMode] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [defaultTags, setDefaultTags] = useState<string[]>([]);
  
  // 表单
  const [configForm] = Form.useForm();
  const [serverForm] = Form.useForm();
  const [batchForm] = Form.useForm();
  const [tagForm] = Form.useForm();

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
    fetchGlobalConfig();
    fetchTags();
  }, []);

  // 全局配置发生变化时获取服务器列表
  useEffect(() => {
    if (globalConfig) {
      fetchServers(globalConfig.id);
    }
  }, [globalConfig]);

  // 获取全局代理配置
  const fetchGlobalConfig = async () => {
    setLoading(true);
    try {
      const response = await proxyPoolApi.getPools();
      if (response.success && response.data && response.data.length > 0) {
        // 默认使用第一个配置作为全局配置
        setGlobalConfig(response.data[0]);
      } else {
        message.error(response.message || '获取全局代理配置失败');
      }
    } catch (error) {
      console.error('获取全局代理配置失败:', error);
      message.error('获取全局代理配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取代理服务器列表
  const fetchServers = async (configId: number) => {
    setServersLoading(true);
    try {
      const response = await proxyPoolApi.getServers(configId);
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

  // 获取所有标签
  const fetchTags = async () => {
    try {
      const response = await proxyPoolApi.getAllTags();
      if (response.success) {
        setTags(response.data || []);
      } else {
        message.error(response.message || '获取标签列表失败');
      }
    } catch (error) {
      console.error('获取标签列表失败:', error);
      message.error('获取标签列表失败');
    }
  };

  // 更新全局代理配置
  const handleConfigSubmit = async (values: any) => {
    if (!globalConfig) return;
    
    try {
      const response = await proxyPoolApi.updatePool(globalConfig.id, values);
      
      if (response.success) {
        message.success('全局代理配置更新成功');
        setConfigModalVisible(false);
        fetchGlobalConfig(); // 重新获取全局配置
      } else {
        message.error(response.message || '更新失败');
      }
    } catch (error) {
      console.error('更新全局代理配置失败:', error);
      message.error('更新失败');
    }
  };

  // 创建/编辑代理服务器
  const handleServerSubmit = async (values: any) => {
    if (!globalConfig) return;
    
    try {
      const response = editingServer
        ? await proxyPoolApi.updateServer(editingServer.id, values)
        : await proxyPoolApi.addServer(globalConfig.id, values);
      
      if (response.success) {
        message.success(editingServer ? '代理服务器更新成功' : '代理服务器添加成功');
        setServerModalVisible(false);
        setEditingServer(null);
        serverForm.resetFields();
        fetchServers(globalConfig.id);
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('代理服务器操作失败:', error);
      message.error('操作失败');
    }
  };

  // 创建/编辑标签
  const handleTagSubmit = async (values: any) => {
    try {
      const response = editingTag
        ? await proxyPoolApi.updateTag(editingTag.id, values)
        : await proxyPoolApi.createTag(values);
      
      if (response.success) {
        message.success(editingTag ? '标签更新成功' : '标签创建成功');
        setTagModalVisible(false);
        setEditingTag(null);
        tagForm.resetFields();
        fetchTags();
      } else {
        message.error(response.message || '操作失败');
      }
    } catch (error) {
      console.error('标签操作失败:', error);
      message.error('操作失败');
    }
  };

  // 删除标签
  const handleDeleteTag = async (tagId: number) => {
    try {
      const response = await proxyPoolApi.deleteTag(tagId);
      if (response.success) {
        message.success('标签删除成功');
        fetchTags();
      } else {
        message.error(response.message || '删除失败');
      }
    } catch (error) {
      console.error('删除标签失败:', error);
      message.error('删除失败');
    }
  };

  // 获取代理服务器的标签
  const fetchServerTags = async (serverId: number) => {
    try {
      const response = await proxyPoolApi.getServerTags(serverId);
      if (response.success) {
        setServerTags(response.data || []);
        setSelectedTags(response.data?.map((tag: ProxyTag) => tag.id) || []);
      } else {
        message.error(response.message || '获取代理服务器标签失败');
      }
    } catch (error) {
      console.error('获取代理服务器标签失败:', error);
      message.error('获取代理服务器标签失败');
    }
  };

  // 更新代理服务器标签
  const handleUpdateServerTags = async () => {
    if (!selectedServerId) return;
    
    try {
      const response = await proxyPoolApi.addTagsToServer(selectedServerId, selectedTags);
      if (response.success) {
        message.success('代理服务器标签更新成功');
        setServerTagModalVisible(false);
        if (globalConfig) {
          fetchServers(globalConfig.id);
        }
      } else {
        message.error(response.message || '更新标签失败');
      }
    } catch (error) {
      console.error('更新代理服务器标签失败:', error);
      message.error('更新标签失败');
    }
  };

  // 解析并预览代理列表
  const handlePreviewProxies = async () => {
    if (!globalConfig) return;
    
    try {
      const values = await batchForm.validateFields();
      const proxyStrings = values.proxyList
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line);
      
      if (proxyStrings.length === 0) {
        message.warning('请输入有效的代理地址');
        return;
      }
      
      setImportLoading(true);
      
      const response = await proxyPoolApi.previewBatchServers(globalConfig.id, proxyStrings);
      
      if (response.success) {
        setPreviewData(response.data || []);
        setPreviewMode(true);
      } else {
        message.error(response.message || '解析代理失败');
      }
    } catch (error) {
      console.error('解析代理失败:', error);
      message.error('解析代理失败');
    } finally {
      setImportLoading(false);
    }
  };

  // 批量导入预览后的代理
  const handleImportPreviewedProxies = async () => {
    if (!globalConfig) return;
    
    try {
      const values = await batchForm.validateFields();
      const proxyStrings = values.proxyList
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line);
      
      setImportLoading(true);
      
      const response = await proxyPoolApi.batchAddServersWithTags(globalConfig.id, proxyStrings, defaultTags);
      
      if (response.success) {
        message.success(`成功导入 ${response.data.added} 个代理服务器`);
        setBatchModalVisible(false);
        batchForm.resetFields();
        setPreviewMode(false);
        setPreviewData([]);
        setDefaultTags([]);
        fetchServers(globalConfig.id);
      } else {
        message.error(response.message || '批量导入失败');
      }
    } catch (error) {
      console.error('批量导入失败:', error);
      message.error('批量导入失败');
    } finally {
      setImportLoading(false);
    }
  };

  // 取消预览模式
  const handleCancelPreview = () => {
    setPreviewMode(false);
    setPreviewData([]);
  };

  // 删除代理服务器
  const handleDeleteServer = async (serverId: number) => {
    try {
      const response = await proxyPoolApi.deleteServer(serverId);
      if (response.success) {
        message.success('代理服务器删除成功');
        if (globalConfig) {
          fetchServers(globalConfig.id);
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
        if (globalConfig) {
          fetchServers(globalConfig.id);
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
          if (globalConfig) {
            fetchServers(globalConfig.id);
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
  const renderProxyStats = () => {
    if (!globalConfig?.proxy_stats) return null;
    
    const { total, enabled, healthy } = globalConfig.proxy_stats;
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
      title: '标签',
      key: 'tags',
      render: (record: ProxyServer) => (
        <>
          {record.tags && record.tags.length > 0 ? (
            <Space size={[0, 4]} wrap>
              {record.tags.map(tag => (
                <Tag
                  key={tag.id}
                  color={tag.color || '#108ee9'}
                  style={{ margin: '2px' }}
                >
                  {tag.name}
                </Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">无标签</Text>
          )}
        </>
      ),
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
      width: 220,
      render: (record: ProxyServer) => (
        <Space size="small">
          <Tooltip title="验证代理">
            <Button
              size="small"
              icon={<BugOutlined />}
              onClick={() => handleValidateProxy(record.id)}
            />
          </Tooltip>
          <Tooltip title="管理标签">
            <Button
              size="small"
              icon={<TagOutlined />}
              onClick={() => {
                setSelectedServerId(record.id);
                fetchServerTags(record.id);
                setServerTagModalVisible(true);
              }}
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
          配置全局代理策略和代理服务器，支持HTTP、HTTPS、SOCKS4、SOCKS5代理，提供代理健康检查功能。
        </Paragraph>
      </div>

      {/* 全局代理配置 */}
      {globalConfig && (
        <Card
          title={
            <Space>
              <SettingOutlined />
              全局代理配置
            </Space>
          }
          extra={
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                setConfigModalVisible(true);
                configForm.setFieldsValue(globalConfig);
              }}
            >
              修改配置
            </Button>
          }
          style={{ marginBottom: 24 }}
        >
          <Descriptions column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}>
            <Descriptions.Item label="代理策略">
              <Space>
                {proxyModeOptions.find(opt => opt.value === globalConfig.proxy_mode)?.icon}
                <span>{proxyModeOptions.find(opt => opt.value === globalConfig.proxy_mode)?.label}</span>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {globalConfig.enabled ? (
                <Tag color="success">已启用</Tag>
              ) : (
                <Tag color="warning">已禁用</Tag>
              )}
            </Descriptions.Item>
            {globalConfig.description && (
              <Descriptions.Item label="描述" span={2}>
                {globalConfig.description}
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}

      {/* 标签管理 */}
      <Card
        title={
          <Space>
            <TagOutlined />
            代理标签管理
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingTag(null);
              setTagModalVisible(true);
              tagForm.resetFields();
            }}
          >
            添加标签
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        {tags.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {tags.map(tag => (
              <Tag
                key={tag.id}
                color={tag.color || '#108ee9'}
                style={{ padding: '4px 8px', margin: '4px' }}
                closable
                onClose={() => handleDeleteTag(tag.id)}
              >
                <Space>
                  {tag.name}
                  <EditOutlined
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTag(tag);
                      tagForm.setFieldsValue(tag);
                      setTagModalVisible(true);
                    }}
                    style={{ cursor: 'pointer' }}
                  />
                </Space>
              </Tag>
            ))}
          </div>
        ) : (
          <Empty description="暂无标签" />
        )}
      </Card>

      {/* 代理服务器管理 */}
      {globalConfig && (
        <Card
          title={
            <Space>
              <ApiOutlined />
              代理服务器管理
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
          {renderProxyStats()}
          
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

      {/* 编辑全局代理配置弹窗 */}
      <Modal
        title="编辑全局代理配置"
        open={configModalVisible}
        onCancel={() => {
          setConfigModalVisible(false);
          configForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={configForm}
          layout="vertical"
          onFinish={handleConfigSubmit}
        >
          <Form.Item
            name="proxy_mode"
            label="代理策略"
            rules={[{ required: true, message: '请选择代理策略' }]}
          >
            <Select 
              placeholder="选择代理策略"
              dropdownMatchSelectWidth={false}
              dropdownStyle={{ minWidth: 300 }}
              optionLabelProp="label"
            >
              {proxyModeOptions.map(option => (
                <Option key={option.value} value={option.value} label={option.label}>
                  <Space>
                    {option.icon}
                    <div style={{ maxWidth: '100%' }}>
                      <div>{option.label}</div>
                      <Text type="secondary" style={{ fontSize: '12px', display: 'block', whiteSpace: 'normal' }}>
                        {option.description}
                      </Text>
                    </div>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea placeholder="代理配置描述信息" rows={3} />
          </Form.Item>

          <Form.Item
            name="enabled"
            valuePropName="checked"
          >
            <Space>
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
              <Text type="secondary">启用全局代理</Text>
            </Space>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                更新
              </Button>
              <Button
                onClick={() => {
                  setConfigModalVisible(false);
                  configForm.resetFields();
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

      {/* 创建/编辑标签弹窗 */}
      <Modal
        title={editingTag ? '编辑标签' : '添加标签'}
        open={tagModalVisible}
        onCancel={() => {
          setTagModalVisible(false);
          setEditingTag(null);
          tagForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={tagForm}
          layout="vertical"
          onFinish={handleTagSubmit}
        >
          <Form.Item
            name="name"
            label="标签名称"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="例如：高速代理" />
          </Form.Item>
          
          <Form.Item
            name="description"
            label="描述"
          >
            <Input placeholder="标签描述" />
          </Form.Item>
          
          <Form.Item
            name="color"
            label="颜色"
            initialValue="#108ee9"
          >
            <Input
              type="color"
              style={{ width: '50px', padding: '0', height: '32px' }}
            />
          </Form.Item>
          
          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingTag ? '更新' : '创建'}
              </Button>
              <Button
                onClick={() => {
                  setTagModalVisible(false);
                  setEditingTag(null);
                  tagForm.resetFields();
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* 管理代理服务器标签弹窗 */}
      <Modal
        title="管理代理服务器标签"
        open={serverTagModalVisible}
        onCancel={() => {
          setServerTagModalVisible(false);
          setSelectedServerId(null);
          setServerTags([]);
          setSelectedTags([]);
        }}
        onOk={handleUpdateServerTags}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>选择要应用的标签：</Text>
        </div>
        
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="选择标签"
          value={selectedTags}
          onChange={setSelectedTags}
          optionLabelProp="label"
        >
          {tags.map(tag => (
            <Option key={tag.id} value={tag.id} label={tag.name}>
              <Tag color={tag.color || '#108ee9'}>{tag.name}</Tag>
              {tag.description && (
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  {tag.description}
                </Text>
              )}
            </Option>
          ))}
        </Select>
      </Modal>

      {/* 批量导入弹窗 */}
      <Modal
        title="批量导入代理"
        open={batchModalVisible}
        onCancel={() => {
          setBatchModalVisible(false);
          batchForm.resetFields();
          setPreviewMode(false);
          setPreviewData([]);
          setDefaultTags([]);
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
              disabled={previewMode}
            />
          </Form.Item>

          {previewMode && (
            <>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Text strong>预览结果</Text>
                  <Text type="secondary">共 {previewData.length} 条记录</Text>
                </Space>
              </div>
              
              <Table
                dataSource={previewData}
                rowKey={(record, index) => index?.toString() || '0'}
                size="small"
                pagination={false}
                scroll={{ y: 300 }}
                columns={[
                  {
                    title: '代理类型',
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
                    render: (record: any) => (
                      <Text code>{record.host}:{record.port}</Text>
                    ),
                  },
                  {
                    title: '认证',
                    key: 'auth',
                    render: (record: any) => 
                      record.username ? <Tag color="blue">已配置</Tag> : <Tag>无</Tag>,
                  },
                  {
                    title: '备注',
                    dataIndex: 'name',
                    key: 'name',
                  },
                ]}
              />
              
              <div style={{ marginTop: 16, marginBottom: 16 }}>
                <Form.Item
                  label="默认标签"
                  name="defaultTags"
                >
                  <Select
                    mode="multiple"
                    style={{ width: '100%' }}
                    placeholder="选择要添加的默认标签"
                    value={defaultTags}
                    onChange={setDefaultTags}
                    optionLabelProp="label"
                  >
                    {tags.map(tag => (
                      <Option key={tag.name} value={tag.name} label={tag.name}>
                        <Tag color={tag.color || '#108ee9'}>{tag.name}</Tag>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </div>
            </>
          )}

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              {!previewMode ? (
                <Button
                  type="primary"
                  onClick={handlePreviewProxies}
                  loading={importLoading}
                >
                  解析预览
                </Button>
              ) : (
                <>
                  <Button
                    type="primary"
                    onClick={handleImportPreviewedProxies}
                    loading={importLoading}
                  >
                    确认导入
                  </Button>
                  <Button onClick={handleCancelPreview}></Button>