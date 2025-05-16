import React, { useState } from 'react';
import { Card, Button, Form, Input, InputNumber, Upload, Table, Typography, message, Space, Modal, Dropdown, Menu } from 'antd';
import {
  UserAddOutlined,
  UploadOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DownOutlined,
  IdcardOutlined,
} from '@ant-design/icons';
import RandomUserRegisterModal from '../../components/RandomUserRegisterModal';
import BatchRegisterModal from '../../components/BatchRegisterModal';
import styled from 'styled-components';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Item: MenuItem } = Menu;

// 毛玻璃效果卡片
const GlassCard = styled(Card)`
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  margin-bottom: 24px;
`;

const RegisterFormContainer = styled.div`
  max-width: 900px;
  margin: 0 auto;
`;

const ButtonGroup = styled.div`
  margin-top: 16px;
  display: flex;
  justify-content: center;
  gap: 16px;
`;

const BatchUploadInfo = styled.div`
  margin-top: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 8px;
  border: 1px dashed #d9d9d9;
`;

/**
 * 账户批量注册页面
 * 支持表单注册、批量导入和随机用户注册三种方式
 */
const AccountRegister: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isRandomUserModalVisible, setIsRandomUserModalVisible] = useState(false);
  const [registeredAccounts, setRegisteredAccounts] = useState<any[]>([]);
  const [batchRegisterModalVisible, setBatchRegisterModalVisible] = useState(false);
  
  // 提交单个账户注册
  const handleSubmit = (values: any) => {
    setLoading(true);
    console.log('注册信息:', values);
    
    // 模拟API请求
    setTimeout(() => {
      setLoading(false);
      message.success('账户注册请求已提交，等待处理');
      
      // 模拟新注册的账户
      const newAccount = {
        key: String(Date.now()),
        accountName: values.accountName,
        initialBalance: values.initialBalance,
        status: 'pending',
        createdAt: new Date().toLocaleString(),
      };
      
      setRegisteredAccounts([newAccount, ...registeredAccounts]);
      form.resetFields();
    }, 1000);
  };
  
  // 显示批量上传模态框
  const showBatchModal = () => {
    setIsModalVisible(true);
  };
  
  // 显示随机用户注册模态框
  const showRandomUserModal = () => {
    setIsRandomUserModalVisible(true);
  };
  
  // 显示批量注册随机用户模态框
  const showBatchRegisterModal = () => {
    setBatchRegisterModalVisible(true);
  };
  
  // 处理随机用户注册成功
  const handleRandomUserSuccess = (account: any) => {
    setIsRandomUserModalVisible(false);
    
    // 创建新注册记录
    const newAccount = {
      key: String(Date.now()),
      accountName: account.email,
      initialBalance: 0, // 新注册的Infini账户初始余额为0
      status: 'success',
      createdAt: new Date().toLocaleString(),
      infiniAccount: account, // 保存完整的Infini账户信息
    };
    
    // 添加到注册记录
    setRegisteredAccounts([newAccount, ...registeredAccounts]);
    message.success(`成功注册Infini账户: ${account.email}`);
  };
  
  // 处理批量上传
  const handleBatchUpload = () => {
    message.info('批量上传功能正在开发中');
    setIsModalVisible(false);
  };
  
  // 定义注册菜单
  const registerMenu = (
    <Menu>
      <MenuItem key="normal" onClick={() => form.submit()}>
        <UserAddOutlined /> 注册账户
      </MenuItem>
      <MenuItem key="random" onClick={showRandomUserModal}>
        <IdcardOutlined /> 注册随机用户
      </MenuItem>
      <MenuItem key="batchRegister" onClick={showBatchRegisterModal}>
        <UserAddOutlined /> 批量注册随机用户
      </MenuItem>
    </Menu>
  );
  
  // 表格列定义
  const columns = [
    {
      title: '账户名',
      dataIndex: 'accountName',
      key: 'accountName',
    },
    {
      title: '初始余额 (USD)',
      dataIndex: 'initialBalance',
      key: 'initialBalance',
      render: (balance: number) => `$${balance.toFixed(2)}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        if (status === 'success') {
          return <Text type="success" strong><CheckCircleOutlined /> 成功</Text>;
        } else if (status === 'pending') {
          return <Text type="warning"><ExclamationCircleOutlined /> 处理中</Text>;
        } else {
          return <Text type="danger"><DeleteOutlined /> 失败</Text>;
        }
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button type="link" size="small">查看详情</Button>
          <Button type="link" danger size="small">删除</Button>
        </Space>
      ),
    },
  ];
  
  return (
    <div>
      <Title level={3}>账户批量注册</Title>
      
      <GlassCard>
        <RegisterFormContainer>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              initialBalance: 0,
            }}
          >
            <Form.Item
              name="accountName"
              label="账户名称"
              rules={[{ required: true, message: '请输入账户名称' }]}
            >
              <Input prefix={<UserAddOutlined />} placeholder="输入新账户名称" />
            </Form.Item>
            
            <Form.Item
              name="initialBalance"
              label="初始余额 (USD)"
              rules={[{ required: true, message: '请输入初始余额' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={0.01}
                formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              />
            </Form.Item>
            
            <Form.Item
              name="description"
              label="账户说明 (可选)"
            >
              <TextArea rows={3} placeholder="输入账户的用途或其他说明" />
            </Form.Item>
            
            <ButtonGroup>
              <Dropdown overlay={registerMenu} placement="bottomCenter">
                <Button
                  type="primary"
                  size="large"
                  loading={loading}
                  icon={<UserAddOutlined />}
                >
                  注册账户 <DownOutlined />
                </Button>
              </Dropdown>
              
              <Button
                type="primary"
                size="large"
                icon={<UserAddOutlined />}
                onClick={showBatchRegisterModal}
              >
                批量注册随机用户
              </Button>
              
              <Button
                icon={<UploadOutlined />}
                size="large"
                onClick={showBatchModal}
              >
                批量导入
              </Button>
            </ButtonGroup>
          </Form>
          
          <BatchUploadInfo>
            <Text type="secondary">
              批量导入说明：支持Excel文件(.xlsx)或CSV文件(.csv)，文件中需包含账户名称、初始余额等必要信息，
              可以<a href="#">下载模板</a>查看格式要求。
            </Text>
          </BatchUploadInfo>
        </RegisterFormContainer>
      </GlassCard>
      
      {/* 注册记录 */}
      <GlassCard title="最近注册记录">
        <Table
          columns={columns}
          dataSource={registeredAccounts}
          pagination={{ pageSize: 5 }}
          locale={{ emptyText: '暂无注册记录' }}
        />
      </GlassCard>
      
      {/* 批量导入模态框 */}
      <Modal
        title="批量导入账户"
        open={isModalVisible}
        onOk={handleBatchUpload}
        onCancel={() => setIsModalVisible(false)}
        okText="上传并导入"
        cancelText="取消"
      >
        <Upload.Dragger
          name="file"
          action="#"
          accept=".xlsx,.csv"
          beforeUpload={() => false}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持Excel文件(.xlsx)或CSV文件(.csv)
          </p>
        </Upload.Dragger>
      </Modal>
      
      {/* 随机用户注册模态框 */}
      <RandomUserRegisterModal
        visible={isRandomUserModalVisible}
        onCancel={() => setIsRandomUserModalVisible(false)}
        onSuccess={handleRandomUserSuccess}
      />
      
      {/* 批量注册随机用户模态框 */}
      <BatchRegisterModal
        visible={batchRegisterModalVisible}
        onClose={() => setBatchRegisterModalVisible(false)}
        onSuccess={() => {
          // 批量注册完成后刷新数据
          message.success('批量注册完成');
        }}
        onRegisterSuccess={(newAccount) => {
          // 每注册成功一个账户就添加到列表
          const newAccountRecord = {
            key: String(Date.now()) + Math.random(),
            accountName: newAccount.email,
            initialBalance: 0,
            status: 'success',
            createdAt: new Date().toLocaleString(),
            infiniAccount: newAccount
          };
          
          setRegisteredAccounts(prevAccounts => [newAccountRecord, ...prevAccounts]);
        }}
      />
    </div>
  );
};

export default AccountRegister;