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
  Tooltip,
  Tabs,
  Spin
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UserAddOutlined, UserDeleteOutlined, TeamOutlined } from '@ant-design/icons';
import { infiniAccountApi } from '../../services/api';

const { Title, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;

// 账户分组类型定义
interface AccountGroup {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  accountCount?: number;
}

// 表格中显示的账户信息
interface Account {
  id: string;
  email: string;
  status?: string;
  availableBalance?: number;
}

// 分组详情信息（包含账户列表）
interface GroupDetail extends AccountGroup {
  accounts: Account[];
}

const AccountGroupManage: React.FC = () => {
  // 状态变量
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
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
  const [activeTab, setActiveTab] = useState<string>('1');
  
  // 搜索相关状态
  const [groupAccountSearchText, setGroupAccountSearchText] = useState('');
  const [allAccountSearchText, setAllAccountSearchText] = useState('');
  
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
  
  // 获取所有Infini账户
  const fetchAllAccounts = async () => {
    try {
      const response = await infiniAccountApi.getAllInfiniAccounts();
      if (response.success) {
        setAllAccounts(response.data);
      } else {
        message.error('获取账户列表失败: ' + response.message);
      }
    } catch (error) {
      console.error('获取账户列表出错:', error);
      message.error('获取账户列表失败');
    }
  };
  
  // 获取分组详情（包含账户列表）
  const fetchGroupDetail = async (groupId: string) => {
    setLoadingAccounts(true);
    try {
      const response = await infiniAccountApi.getAccountGroupById(groupId);
      if (response.success) {
        setGroupDetail(response.data);
      } else {
        message.error('获取分组详情失败: ' + response.message);
      }
    } catch (error) {
      console.error('获取分组详情出错:', error);
      message.error('获取分组详情失败');
    } finally {
      setLoadingAccounts(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    fetchGroups();
    fetchAllAccounts();
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
    setAccountModalVisible(true);
    setActiveTab('1');
    setSelectedRowKeys([]);
    setGroupAccountSearchText('');
    setAllAccountSearchText('');
    // 获取分组详情
    await fetchGroupDetail(group.id);
  };
  
  // 过滤分组内账户
  const getFilteredGroupAccounts = () => {
    if (!groupDetail?.accounts) return [];
    
    if (!groupAccountSearchText) return groupDetail.accounts;
    
    return groupDetail.accounts.filter(account => 
      account.email.toLowerCase().includes(groupAccountSearchText.toLowerCase())
    );
  };
  
  // 过滤所有账户
  const getFilteredAllAccounts = () => {
    if (!allAccounts) return [];
    
    if (!allAccountSearchText) return allAccounts;
    
    return allAccounts.filter(account => 
      account.email.toLowerCase().includes(allAccountSearchText.toLowerCase())
    );
  };
  
  // 处理添加账户到分组
  const handleAddAccountsToGroup = async () => {
    if (!selectedGroupId || selectedRowKeys.length === 0) {
      message.info('请选择要添加的账户');
      return;
    }
    
    try {
      const response = await infiniAccountApi.addAccountsToGroup(selectedGroupId, selectedRowKeys as string[]);
      if (response.success) {
        message.success(`成功添加${response.data?.addedCount || 0}个账户到分组`);
        // 刷新分组详情
        await fetchGroupDetail(selectedGroupId);
        // 刷新分组列表
        fetchGroups();
        // 清空选择
        setSelectedRowKeys([]);
      } else {
        message.error('添加账户到分组失败: ' + response.message);
      }
    } catch (error) {
      console.error('添加账户到分组出错:', error);
      message.error('添加账户到分组失败');
    }
  };
  
  // 处理从分组中移除账户
  const handleRemoveAccountsFromGroup = async () => {
    if (!selectedGroupId || selectedRowKeys.length === 0) {
      message.info('请选择要移除的账户');
      return;
    }
    
    try {
      const response = await infiniAccountApi.removeAccountsFromGroup(selectedGroupId, selectedRowKeys as string[]);
      if (response.success) {
        message.success(`成功从分组中移除${response.data?.removedCount || 0}个账户`);
        // 刷新分组详情
        await fetchGroupDetail(selectedGroupId);
        // 刷新分组列表
        fetchGroups();
        // 清空选择
        setSelectedRowKeys([]);
      } else {
        message.error('从分组中移除账户失败: ' + response.message);
      }
    } catch (error) {
      console.error('从分组中移除账户出错:', error);
      message.error('从分组中移除账户失败');
    }
  };
  
  // 处理表格选择变化
  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
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
          {record.isDefault && <Tag color="green">默认</Tag>}
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
      title: '账户数量',
      dataIndex: 'accountCount',
      key: 'accountCount',
      render: (count: number) => count || 0,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AccountGroup) => (
        <Space size="middle">
          <Button 
            type="primary" 
            icon={<TeamOutlined />} 
            size="small"
            onClick={() => showAccountModal(record)}
          >
            管理账户
          </Button>
          <Button 
            icon={<EditOutlined />} 
            size="small" 
            onClick={() => showEditModal(record)}
            disabled={record.isDefault}
          >
            编辑
          </Button>
          {!record.isDefault && (
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
  
  // 账户表格列定义
  const accountColumns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => status || '-',
    },
    {
      title: '可用余额',
      dataIndex: 'availableBalance',
      key: 'availableBalance',
      render: (balance: number) => (balance !== undefined ? `$${balance.toFixed(2)}` : '-'),
    },
  ];
  
  // 表格行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };
  
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
      
      {/* 管理分组内账户的模态框 */}
      <Modal
        title={`管理 "${selectedGroupName}" 分组内的账户`}
        open={accountModalVisible}
        onCancel={() => setAccountModalVisible(false)}
        footer={null}
        width={800}
        maskClosable={false}
      >
        <Tabs activeKey={activeTab} onChange={key => {
          setActiveTab(key);
          setSelectedRowKeys([]);
        }}>
          <TabPane tab="分组内账户" key="1">
            {loadingAccounts ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin tip="加载中..." />
              </div>
            ) : (
              <>
                <Paragraph>
                  这里显示当前分组内的所有账户，可以选择要移除的账户。
                  {groupDetail?.isDefault && (
                    <Tag color="orange" style={{ marginLeft: 8 }}>
                      注意：从默认分组移除账户时，该账户必须同时属于其他分组
                    </Tag>
                  )}
                </Paragraph>
                <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
                  <Button
                    onClick={handleRemoveAccountsFromGroup}
                    disabled={selectedRowKeys.length === 0}
                    danger
                    icon={<UserDeleteOutlined />}
                  >
                    移除所选账户
                  </Button>
                  <Input.Search
                    placeholder="搜索账户邮箱"
                    value={groupAccountSearchText}
                    onChange={e => setGroupAccountSearchText(e.target.value)}
                    style={{ width: 300 }}
                    allowClear
                  />
                </div>
                <Table
                  rowSelection={rowSelection}
                  columns={accountColumns}
                  dataSource={getFilteredGroupAccounts()}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                />
              </>
            )}
          </TabPane>
          <TabPane tab="添加账户" key="2">
            <Paragraph>
              从所有可用的Infini账户中选择要添加到当前分组的账户。
            </Paragraph>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Button
                type="primary"
                onClick={handleAddAccountsToGroup}
                disabled={selectedRowKeys.length === 0}
                icon={<UserAddOutlined />}
              >
                添加所选账户
              </Button>
              <Input.Search
                placeholder="搜索账户邮箱"
                value={allAccountSearchText}
                onChange={e => setAllAccountSearchText(e.target.value)}
                style={{ width: 300 }}
                allowClear
              />
            </div>
            <Table
              rowSelection={rowSelection}
              columns={accountColumns}
              dataSource={getFilteredAllAccounts()}
              rowKey="id"
              pagination={{ pageSize: 5 }}
            />
          </TabPane>
        </Tabs>
      </Modal>
    </div>
  );
};

export default AccountGroupManage;