/**
 * 模拟用户数据管理页面
 * 提供随机用户信息的生成、查看、管理和删除功能
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  message,
  Form,
  Input,
  Tag,
  Row,
  Col,
  Typography,
  Tabs,
  Tooltip,
  Popconfirm,
  Select,
  InputNumber,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  MailOutlined,
  FileProtectOutlined,
  PhoneOutlined,
  CalendarOutlined,
  LockOutlined,
  StopOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { randomUserApi } from '../../services/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

// 样式组件
const StyledCard = styled(Card)`
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
  overflow: hidden;
`;

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
`;

const FormContainer = styled.div`
  padding: 20px;
  border-radius: 8px;
  background: #fff;
`;

const StyledTag = styled(Tag)`
  margin: 2px;
`;

const InfoItem = styled.div`
  margin-bottom: 8px;
`;

// 随机用户接口类型
interface RandomUser {
  id: number;
  email_prefix: string;
  full_email?: string;
  password: string;
  last_name: string;
  first_name: string;
  passport_no: string;
  phone: string;
  birth_year: number;
  birth_month: number;
  birth_day: number;
  created_at: string;
  updated_at: string;
}

// 黑名单接口类型
interface NameBlacklist {
  id: number;
  name: string;
  reason?: string;
  created_at: string;
  updated_at: string;
}

// 主组件
const RandomUserManage: React.FC = () => {
  // 用户数据状态
  const [users, setUsers] = useState<RandomUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [userModalVisible, setUserModalVisible] = useState<boolean>(false);
  const [generateForm] = Form.useForm();
  
  // 黑名单状态
  const [blacklist, setBlacklist] = useState<NameBlacklist[]>([]);
  const [blacklistLoading, setBlacklistLoading] = useState<boolean>(false);
  const [blacklistModalVisible, setBlacklistModalVisible] = useState<boolean>(false);
  const [blacklistForm] = Form.useForm();
  
  // 详情模态框状态
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<RandomUser | null>(null);
  
  // 激活的标签页
  const [activeTab, setActiveTab] = useState<string>('1');

  // 加载随机用户列表
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await randomUserApi.getRandomUsers();
      if (response.success) {
        setUsers(response.data || []);
      } else {
        message.error('获取随机用户列表失败: ' + response.message);
      }
    } catch (error) {
      message.error('获取随机用户列表失败: ' + (error as Error).message);
      console.error('获取随机用户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载黑名单列表
  const fetchBlacklist = async () => {
    setBlacklistLoading(true);
    try {
      const response = await randomUserApi.getNameBlacklist();
      if (response.success) {
        setBlacklist(response.data || []);
      } else {
        message.error('获取姓名黑名单失败: ' + response.message);
      }
    } catch (error) {
      message.error('获取姓名黑名单失败: ' + (error as Error).message);
      console.error('获取姓名黑名单失败:', error);
    } finally {
      setBlacklistLoading(false);
    }
  };

  // 首次加载数据
  useEffect(() => {
    fetchUsers();
    fetchBlacklist();
  }, []);

  // 标签页切换处理
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === '1') {
      fetchUsers();
    } else if (key === '2') {
      fetchBlacklist();
    }
  };

  // 打开生成用户模态窗
  const openGenerateModal = () => {
    generateForm.resetFields();
    setUserModalVisible(true);
  };

  // 打开添加黑名单模态窗
  const openBlacklistModal = () => {
    blacklistForm.resetFields();
    setBlacklistModalVisible(true);
  };

  // 显示用户详情
  const showUserDetail = (user: RandomUser) => {
    setCurrentUser(user);
    setDetailModalVisible(true);
  };

  // 生成随机用户
  const handleGenerateUser = async (values: any) => {
    try {
      const params = {
        email_suffix: values.email_suffix,
        count: values.count || 1
      };
      
      const response = await randomUserApi.generateRandomUsers(params);
      
      if (response.success) {
        message.success(`成功生成${params.count}条随机用户信息`);
        setUserModalVisible(false);
        fetchUsers();
      } else {
        message.error('生成随机用户信息失败: ' + response.message);
      }
    } catch (error) {
      message.error('生成随机用户信息失败: ' + (error as Error).message);
      console.error('生成随机用户信息失败:', error);
    }
  };

  // 添加姓名到黑名单
  const handleAddToBlacklist = async (values: any) => {
    try {
      const response = await randomUserApi.addNameToBlacklist(values.name, values.reason);
      
      if (response.success) {
        message.success('成功添加姓名到黑名单');
        setBlacklistModalVisible(false);
        fetchBlacklist();
      } else {
        message.error('添加姓名到黑名单失败: ' + response.message);
      }
    } catch (error) {
      message.error('添加姓名到黑名单失败: ' + (error as Error).message);
      console.error('添加姓名到黑名单失败:', error);
    }
  };

  // 从黑名单中删除姓名
  const handleRemoveFromBlacklist = async (id: number) => {
    try {
      const response = await randomUserApi.removeNameFromBlacklist(id.toString());
      
      if (response.success) {
        message.success('成功从黑名单中删除姓名');
        fetchBlacklist();
      } else {
        message.error('从黑名单中删除姓名失败: ' + response.message);
      }
    } catch (error) {
      message.error('从黑名单中删除姓名失败: ' + (error as Error).message);
      console.error('从黑名单中删除姓名失败:', error);
    }
  };

  // 删除随机用户
  const handleDeleteUser = async (id: number) => {
    try {
      const response = await randomUserApi.deleteRandomUser(id.toString());
      
      if (response.success) {
        message.success('成功删除随机用户信息');
        fetchUsers();
      } else {
        message.error('删除随机用户信息失败: ' + response.message);
      }
    } catch (error) {
      message.error('删除随机用户信息失败: ' + (error as Error).message);
      console.error('删除随机用户信息失败:', error);
    }
  };

  // 用户列表表格列定义
  const userColumns = [
    {
      title: '邮箱',
      key: 'email',
      render: (record: RandomUser) => (
        <span>
          {record.full_email || `${record.email_prefix}@...`}
        </span>
      ),
    },
    {
      title: '姓名',
      key: 'name',
      render: (record: RandomUser) => (
        <span>
          {`${record.last_name}, ${record.first_name}`}
        </span>
      ),
    },
    {
      title: '护照号',
      dataIndex: 'passport_no',
      key: 'passport_no',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '出生日期',
      key: 'birth_date',
      render: (record: RandomUser) => (
        <span>
          {`${record.birth_year}, ${record.birth_month}, ${record.birth_day}`}
        </span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: RandomUser) => (
        <Space size="small">
          <Button 
            type="text" 
            icon={<InfoCircleOutlined />} 
            onClick={() => showUserDetail(record)}
            title="查看详情"
          />
          
          <Popconfirm
            title="确定要删除这个随机用户信息吗?"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <Button 
              type="text" 
              danger 
              icon={<DeleteOutlined />}
              title="删除"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 黑名单表格列定义
  const blacklistColumns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '禁用原因',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => reason || '-',
    },
    {
      title: '添加时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: NameBlacklist) => (
        <Popconfirm
          title="确定要从黑名单中删除这个姓名吗?"
          onConfirm={() => handleRemoveFromBlacklist(record.id)}
          okText="确定"
          cancelText="取消"
          icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
        >
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />}
            title="从黑名单中删除"
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <StyledCard
      title={
        <Space>
          <UserOutlined />
          <span>模拟用户数据管理</span>
        </Space>
      }
      bordered={false}
    >
      <Tabs activeKey={activeTab} onChange={handleTabChange}>
        <TabPane 
          tab={
            <span>
              <UserOutlined />
              随机用户数据
            </span>
          } 
          key="1"
        >
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Space>
              <Button
                onClick={() => fetchUsers()}
                icon={<ReloadOutlined />}
              >
                刷新
              </Button>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={openGenerateModal}
              >
                生成随机用户
              </Button>
            </Space>
          </div>
          
          <TableContainer>
            <Table
              columns={userColumns}
              dataSource={users}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1000 }}
            />
          </TableContainer>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <StopOutlined />
              姓名黑名单
            </span>
          } 
          key="2"
        >
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <Space>
              <Button
                onClick={() => fetchBlacklist()}
                icon={<ReloadOutlined />}
              >
                刷新
              </Button>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={openBlacklistModal}
              >
                添加黑名单
              </Button>
            </Space>
          </div>
          
          <TableContainer>
            <Table
              columns={blacklistColumns}
              dataSource={blacklist}
              rowKey="id"
              loading={blacklistLoading}
              pagination={{ pageSize: 10 }}
            />
          </TableContainer>
        </TabPane>
      </Tabs>

      {/* 生成随机用户模态窗 */}
      <Modal
        title="生成随机用户信息"
        open={userModalVisible}
        onCancel={() => setUserModalVisible(false)}
        footer={null}
        width={500}
        destroyOnClose
      >
        <FormContainer>
          <Form
            form={generateForm}
            layout="vertical"
            onFinish={handleGenerateUser}
            initialValues={{ count: 1 }}
          >
            <Form.Item
              name="email_suffix"
              label="邮箱后缀（可选）"
              tooltip="如果提供则返回完整邮箱，不提供则只生成邮箱前缀"
            >
              <Input placeholder="例如：example.com" />
            </Form.Item>
            
            <Form.Item
              name="count"
              label="生成数量"
              tooltip="一次最多生成100条数据"
              rules={[
                { required: true, message: '请输入生成数量' },
                { type: 'number', min: 1, max: 100, message: '数量必须在1-100之间' }
              ]}
            >
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  生成
                </Button>
                <Button onClick={() => setUserModalVisible(false)}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </FormContainer>
      </Modal>

      {/* 添加黑名单模态窗 */}
      <Modal
        title="添加姓名到黑名单"
        open={blacklistModalVisible}
        onCancel={() => setBlacklistModalVisible(false)}
        footer={null}
        width={500}
        destroyOnClose
      >
        <FormContainer>
          <Form
            form={blacklistForm}
            layout="vertical"
            onFinish={handleAddToBlacklist}
          >
            <Form.Item
              name="name"
              label="姓名"
              tooltip="请使用拼音形式，格式为：姓, 名，例如：Zhang, Yutong"
              rules={[{ required: true, message: '请输入姓名' }]}
            >
              <Input placeholder="例如：Zhang, Yutong" />
            </Form.Item>
            
            <Form.Item
              name="reason"
              label="禁用原因（可选）"
            >
              <Input.TextArea placeholder="请输入禁用该姓名的原因" rows={3} />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  添加到黑名单
                </Button>
                <Button onClick={() => setBlacklistModalVisible(false)}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </FormContainer>
      </Modal>

      {/* 用户详情模态窗 */}
      <Modal
        title="随机用户信息详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {currentUser && (
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card title="基本信息" bordered={false}>
                <InfoItem>
                  <Space>
                    <MailOutlined />
                    <Text strong>邮箱：</Text>
                    <Text>{currentUser.full_email || `${currentUser.email_prefix}@...`}</Text>
                  </Space>
                </InfoItem>
                
                <InfoItem>
                  <Space>
                    <LockOutlined />
                    <Text strong>密码：</Text>
                    <Text copyable>{currentUser.password}</Text>
                  </Space>
                </InfoItem>
                
                <InfoItem>
                  <Space>
                    <UserOutlined />
                    <Text strong>姓名：</Text>
                    <Text>{`${currentUser.last_name}, ${currentUser.first_name}`}</Text>
                  </Space>
                </InfoItem>
                
                <InfoItem>
                  <Space>
                    <FileProtectOutlined />
                    <Text strong>护照号：</Text>
                    <Text copyable>{currentUser.passport_no}</Text>
                  </Space>
                </InfoItem>
                
                <InfoItem>
                  <Space>
                    <PhoneOutlined />
                    <Text strong>手机号：</Text>
                    <Text copyable>{currentUser.phone}</Text>
                  </Space>
                </InfoItem>
                
                <InfoItem>
                  <Space>
                    <CalendarOutlined />
                    <Text strong>出生日期：</Text>
                    <Text>{`${currentUser.birth_year}, ${currentUser.birth_month}, ${currentUser.birth_day}`}</Text>
                  </Space>
                </InfoItem>
              </Card>
            </Col>
          </Row>
        )}
      </Modal>
    </StyledCard>
  );
};

export default RandomUserManage;