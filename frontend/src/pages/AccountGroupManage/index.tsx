import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Popconfirm,
  message,
  Typography,
  Tag,
  Tooltip
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserAddOutlined, TeamOutlined } from '@ant-design/icons';
import { infiniAccountApi } from '../../services/api';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;

// 账户分组类型定义
interface AccountGroup {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
}

// 表格中显示的账户信息
interface Account {
  id: string;
  email: string;
  created_at: string;
  has_2fa: boolean;
  verification_level: number;
}

const AccountGroupManage: React.FC = () => {
  // 状态变量
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  
  // 模态框状态
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  
  // 账户关联模态框状态
  const [accountModalVisible, setAccountModalVisible] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedGroupName, setSelectedGroupName] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [accountsInGroup, setAccountsInGroup] = useState<string[]>([]);
  
  // 获取所有分组
  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await infiniAccountApi.getAllAccountGroups();
      if (response.success) {
        setGroups(response.data);
      } else {
        message.error('获取分组列表失败: ' + response.message);
      }
    } catch (error) {
      console.error('获取分组列表出错:', error);
      message.error('获取分组列表失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    fetchGroups();
    // 暂时没有获取所有账户的API，后续可添加
  }, []);
  
  // 处理创建/编辑分组
  const handleSaveGroup = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingGroupId) {
        // 更新现有分组
        const response = await infiniAccountApi.updateAccountGroup(editingGroupId, values);
        if (response.success) {
          message.success('分组更新成功');
          fetchGroups();
        } else {
          message.error('分组更新失败: ' + response.message);
        }
      } else {
        // 创建新分组
        const response = await infiniAccountApi.createAccountGroup(values);
        if (response.success) {
          message.success('分组创建成功');
          fetchGroups();
        } else {
          message.error('分组创建失败: ' + response.message);
        }
      }
      
      resetModal();
    } catch (error) {
      console.error('保存分组出错:', error);
    }
  };
  
  // 处理删除分组
  const handleDeleteGroup = async (id: string) => {
    try {
      const response = await infiniAccountApi.deleteAccountGroup(id);
      if (response.success) {
        message.success('分组删除成功');
        fetchGroups();
      } else {
        message.error('分组删除失败: ' + response.message);
      }
    } catch (error) {
      console.error('删除分组出错:', error);
      message.error('删除分组失败');
    }
  };
  
  // 打开创建分组模态框
  const showAddModal = () => {
    setModalTitle('创建新分组');
    setEditingGroupId(null);
    form.resetFields();
    setModalVisible(true);
  };
  
  // 打开编辑分组模态框
  const showEditModal = (group: AccountGroup) => {
    setModalTitle('编辑分组');
    setEditingGroupId(group.id);
    form.setFieldsValue({
      name: group.name,
      description: group.description || '',
    });
    setModalVisible(true);
  };
  
  // 重置模态框状态
  const resetModal = () => {
    setModalVisible(false);
    setEditingGroupId(null);
    form.resetFields();
  };
  
  // 打开账户关联模态框
  const showAccountModal = async (group: AccountGroup) => {
    setSelectedGroupId(group.id);
    setSelectedGroupName(group.name);
    // 需要后续实现获取分组内账户的API
    message.info('账户关联功能需要后端API支持，暂未实现');
    // setAccountModalVisible(true);
  };
  
  // 表格列定义
  const columns = [
    {
      title: '分组名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: AccountGroup) => (
        <Space>
          {text}
          {record.is_default && <Tag color="green">默认</Tag>}
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string) => text || '无',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AccountGroup) => (
        <Space size="middle">
          <Button 
            type="primary" 
            icon={<UserAddOutlined />} 
            size="small"
            onClick={() => showAccountModal(record)}
          >
            管理账户
          </Button>
          <Button 
            icon={<EditOutlined />} 
            size="small" 
            onClick={() => showEditModal(record)}
          >
            编辑
          </Button>
          {!record.is_default && (
            <Popconfirm
              title="确定要删除此分组吗？"
              onConfirm={() => handleDeleteGroup(record.id)}
              okText="是"
              cancelText="否"
            >
              <Button 
                danger 
                icon={<DeleteOutlined />} 
                size="small"
              >
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];
  
  return (
    <div style={{ padding: '24px' }}>
      <Card bordered={false}>
        <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={4}>账户分组管理</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={showAddModal}
          >
            创建分组
          </Button>
        </div>
        
        <Paragraph>
          通过分组可以更有效地管理和监控Infini账户。一个账户可以同时属于多个分组，系统内置一个默认分组不可删除。
        </Paragraph>
        
        <Table
          columns={columns}
          dataSource={groups}
          rowKey="id"
          loading={loading}
        />
      </Card>
      
      {/* 创建/编辑分组模态框 */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onOk={handleSaveGroup}
        onCancel={resetModal}
        maskClosable={false}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="分组名称"
            rules={[{ required: true, message: '请输入分组名称' }]}
          >
            <Input placeholder="请输入分组名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="分组描述"
          >
            <TextArea rows={4} placeholder="请输入分组描述（可选）" />
          </Form.Item>
        </Form>
      </Modal>
      
      {/* 管理分组内账户的模态框 - 暂不实现 */}
      <Modal
        title={`管理 "${selectedGroupName}" 分组内的账户`}
        open={accountModalVisible}
        onCancel={() => setAccountModalVisible(false)}
        width={800}
        maskClosable={false}
      >
        <Paragraph>
          该功能需要后端API支持，暂未实现。
        </Paragraph>
      </Modal>
    </div>
  );
};

export default AccountGroupManage;