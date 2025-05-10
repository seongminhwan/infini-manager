import React, { useState } from 'react';
import { Card, Tabs, Form, Input, Button, Switch, Select, Table, Tag, Radio, Typography, Space, Divider } from 'antd';
import {
  BellOutlined,
  MailOutlined,
  SendOutlined,
  SettingOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

// 毛玻璃效果卡片
const GlassCard = styled(Card)`
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  margin-bottom: 24px;
`;

const FormSection = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const NotificationTabs = styled(Tabs)`
  .ant-tabs-nav {
    background: rgba(255, 255, 255, 0.5);
    padding: 8px 8px 0;
    border-radius: 8px 8px 0 0;
  }
`;

const NotificationIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: rgba(var(--primary-rgb, 24, 144, 255), 0.1);
  margin-right: 8px;
  
  .anticon {
    font-size: 20px;
    color: var(--primary-color, #1890ff);
  }
`;

/**
 * 通知管理页面
 * 管理各种通知方式和规则
 */
const NotificationManage: React.FC = () => {
  const [emailForm] = Form.useForm();
  const [telegramForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('settings');
  
  // 通知规则列表
  const notificationRules = [
    {
      key: '1',
      name: '账户余额低于阈值',
      condition: '余额 < $1000',
      channels: ['email', 'telegram'],
      status: 'active',
    },
    {
      key: '2',
      name: '账户状态变更',
      condition: '状态变更为非活跃',
      channels: ['telegram'],
      status: 'active',
    },
    {
      key: '3',
      name: '大额转账通知',
      condition: '转账金额 > $10000',
      channels: ['email', 'telegram'],
      status: 'inactive',
    },
  ];
  
  // 通知历史记录
  const notificationHistory = [
    {
      key: '1',
      type: '警告',
      content: '账户ACC_003余额低于阈值，当前余额：$823.45',
      channel: 'email',
      time: '2025-05-06 15:23:45',
      status: 'sent',
    },
    {
      key: '2',
      type: '提醒',
      content: '账户ACC_005完成大额转账，金额：$15,234.67',
      channel: 'telegram',
      time: '2025-05-06 13:12:37',
      status: 'sent',
    },
    {
      key: '3',
      type: '警告',
      content: '账户ACC_002状态变更为非活跃',
      channel: 'email',
      time: '2025-05-05 09:45:21',
      status: 'failed',
    },
  ];
  
  // 处理Email设置提交
  const handleEmailSubmit = (values: any) => {
    console.log('Email设置:', values);
  };
  
  // 处理Telegram设置提交
  const handleTelegramSubmit = (values: any) => {
    console.log('Telegram设置:', values);
  };
  
  // 通知规则列定义
  const ruleColumns = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '触发条件',
      dataIndex: 'condition',
      key: 'condition',
    },
    {
      title: '通知渠道',
      dataIndex: 'channels',
      key: 'channels',
      render: (channels: string[]) => (
        <>
          {channels.map(channel => {
            let color = channel === 'email' ? 'blue' : 'purple';
            let icon = channel === 'email' ? <MailOutlined /> : <SendOutlined />;
            return (
              <Tag color={color} key={channel} icon={icon}>
                {channel === 'email' ? 'Email' : 'Telegram'}
              </Tag>
            );
          })}
        </>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'orange'} icon={status === 'active' ? <CheckCircleOutlined /> : <PauseCircleOutlined />}>
          {status === 'active' ? '已启用' : '已禁用'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button type="link" size="small" icon={<SettingOutlined />}>编辑</Button>
          <Button type="link" danger size="small" icon={<DeleteOutlined />}>删除</Button>
        </Space>
      ),
    },
  ];
  
  // 通知历史列定义
  const historyColumns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color={type === '警告' ? 'red' : 'blue'} icon={type === '警告' ? <ExclamationCircleOutlined /> : <BellOutlined />}>
          {type}
        </Tag>
      ),
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '发送渠道',
      dataIndex: 'channel',
      key: 'channel',
      render: (channel: string) => {
        let color = channel === 'email' ? 'blue' : 'purple';
        let icon = channel === 'email' ? <MailOutlined /> : <SendOutlined />;
        return (
          <Tag color={color} icon={icon}>
            {channel === 'email' ? 'Email' : 'Telegram'}
          </Tag>
        );
      },
    },
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'sent' ? 'green' : 'red'} icon={status === 'sent' ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}>
          {status === 'sent' ? '已发送' : '发送失败'}
        </Tag>
      ),
    },
  ];
  
  return (
    <div>
      <Title level={3}>通知管理</Title>
      
      <NotificationTabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
      >
        <TabPane 
          tab={
            <span>
              <SettingOutlined />
              通知设置
            </span>
          } 
          key="settings"
        >
          <GlassCard>
            <FormSection>
              <Title level={4}>
                <NotificationIcon>
                  <MailOutlined />
                </NotificationIcon>
                Email 通知设置
              </Title>
              <Form
                form={emailForm}
                layout="vertical"
                onFinish={handleEmailSubmit}
                initialValues={{
                  emailEnabled: true,
                }}
              >
                <Form.Item
                  name="emailEnabled"
                  label="启用Email通知"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                
                <Form.Item
                  name="emailAddress"
                  label="通知接收邮箱"
                  rules={[{ required: true, message: '请输入邮箱地址' }, { type: 'email', message: '请输入有效的邮箱地址' }]}
                >
                  <Input prefix={<MailOutlined />} placeholder="输入接收通知的邮箱地址" />
                </Form.Item>
                
                <Form.Item>
                  <Button type="primary" htmlType="submit">
                    保存Email设置
                  </Button>
                </Form.Item>
              </Form>
              
              <Divider />
              
              <Title level={4}>
                <NotificationIcon>
                  <SendOutlined />
                </NotificationIcon>
                Telegram 通知设置
              </Title>
              <Form
                form={telegramForm}
                layout="vertical"
                onFinish={handleTelegramSubmit}
                initialValues={{
                  telegramEnabled: true,
                }}
              >
                <Form.Item
                  name="telegramEnabled"
                  label="启用Telegram通知"
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                
                <Form.Item
                  name="telegramChatId"
                  label="Telegram Chat ID"
                  rules={[{ required: true, message: '请输入Telegram Chat ID' }]}
                >
                  <Input prefix={<SendOutlined />} placeholder="输入Telegram Chat ID" />
                </Form.Item>
                
                <Form.Item
                  name="telegramBotToken"
                  label="Telegram Bot Token"
                  rules={[{ required: true, message: '请输入Telegram Bot Token' }]}
                >
                  <Input.Password placeholder="输入Telegram Bot Token" />
                </Form.Item>
                
                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">
                      保存Telegram设置
                    </Button>
                    <Button>
                      测试连接
                    </Button>
                  </Space>
                </Form.Item>
              </Form>
            </FormSection>
          </GlassCard>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <SettingOutlined />
              通知规则
            </span>
          } 
          key="rules"
        >
          <GlassCard
            title="通知规则管理"
            extra={<Button type="primary" icon={<BellOutlined />}>添加规则</Button>}
          >
            <Table
              columns={ruleColumns}
              dataSource={notificationRules}
              pagination={false}
            />
          </GlassCard>
          
          <GlassCard title="规则类型">
            <Form layout="vertical">
              <Form.Item label="账户监控通知">
                <Radio.Group defaultValue="all">
                  <Radio value="all">全部通知</Radio>
                  <Radio value="warning">仅警告通知</Radio>
                  <Radio value="custom">自定义</Radio>
                </Radio.Group>
              </Form.Item>
              
              <Form.Item label="低余额阈值 (USD)">
                <Input.Group compact>
                  <Select defaultValue="less" style={{ width: '30%' }}>
                    <Option value="less">低于</Option>
                    <Option value="equal">等于</Option>
                    <Option value="greater">高于</Option>
                  </Select>
                  <Input style={{ width: '70%' }} defaultValue="1000" />
                </Input.Group>
              </Form.Item>
            </Form>
          </GlassCard>
        </TabPane>
        
        <TabPane 
          tab={
            <span>
              <BellOutlined />
              通知历史
            </span>
          } 
          key="history"
        >
          <GlassCard title="通知历史记录">
            <Table
              columns={historyColumns}
              dataSource={notificationHistory}
              pagination={{ pageSize: 10 }}
            />
          </GlassCard>
        </TabPane>
      </NotificationTabs>
    </div>
  );
};

export default NotificationManage;