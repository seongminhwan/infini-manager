import React, { useState } from 'react';
import { Card, Button, Typography, Row, Col, Modal, Form, InputNumber, Select, Switch, Input, Space, Divider, Tooltip } from 'antd';
import {
  EditOutlined,
  EyeOutlined,
  DollarOutlined,
  FieldTimeOutlined,
  ApiOutlined,
  MessageOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// 毛玻璃效果卡片
const GlassCard = styled(Card)`
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  margin-bottom: 24px;
  height: 100%;
`;

const TriggerCard = styled(GlassCard)`
  position: relative;
  overflow: hidden;

  .ant-card-head {
    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  }

  .trigger-icon {
    font-size: 22px;
    color: var(--primary-color, #1890ff);
    margin-right: 8px;
  }
  
  .trigger-actions {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
`;

const AddTriggerCard = styled(GlassCard)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  height: 100%;
  
  &:hover {
    background: rgba(255, 255, 255, 0.9);
    transform: translateY(-5px);
  }
  
  .add-icon {
    font-size: 48px;
    margin-bottom: 16px;
    color: var(--primary-color, #1890ff);
  }
`;

const FormSection = styled.div`
  margin-bottom: 24px;
`;

const SectionTitle = styled.div`
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  
  .icon {
    margin-right: 8px;
    color: var(--primary-color, #1890ff);
  }
`;

/**
 * 触发器管理页面
 * 管理基于账户余额的自动触发器
 */
const TriggerManage: React.FC = () => {
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [monitorModalVisible, setMonitorModalVisible] = useState(false);
  const [currentTrigger, setCurrentTrigger] = useState<any>(null);
  const [form] = Form.useForm();
  
  // 模拟触发器数据
  const [triggers, setTriggers] = useState([
    {
      id: '1',
      name: '主要账户余额监控',
      type: 'balance',
      accounts: ['ACC_001', 'ACC_003'],
      threshold: 10000,
      interval: 30,
      targetAccount: 'ACC_005',
      webhookEnabled: true,
      webhookUrl: 'https://api.example.com/webhook/balance',
      messageTemplate: '账户${sourceAccount}余额超过阈值，已自动转移${amount}到账户${targetAccount}',
      active: true,
    },
    {
      id: '2',
      name: '备用账户余额监控',
      type: 'balance',
      accounts: ['ACC_002', 'ACC_004'],
      threshold: 5000,
      interval: 60,
      targetAccount: 'ACC_005',
      webhookEnabled: false,
      webhookUrl: '',
      messageTemplate: '',
      active: false,
    },
  ]);
  
  // 模拟账户数据
  const accounts = [
    { id: 'ACC_001', name: '主要账户A' },
    { id: 'ACC_002', name: '备用账户B' },
    { id: 'ACC_003', name: '测试账户C' },
    { id: 'ACC_004', name: '国际账户D' },
    { id: 'ACC_005', name: '储备账户E' },
  ];
  
  // 打开编辑模态框
  const handleEdit = (trigger: any) => {
    setCurrentTrigger(trigger);
    form.setFieldsValue({
      name: trigger.name,
      accounts: trigger.accounts,
      threshold: trigger.threshold,
      interval: trigger.interval,
      targetAccount: trigger.targetAccount,
      webhookEnabled: trigger.webhookEnabled,
      webhookUrl: trigger.webhookUrl,
      messageTemplate: trigger.messageTemplate,
      active: trigger.active,
    });
    setEditModalVisible(true);
  };
  
  // 打开创建触发器模态框
  const handleAddTrigger = () => {
    setCurrentTrigger(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'balance',
      threshold: 5000,
      interval: 30,
      webhookEnabled: false,
      active: true,
    });
    setEditModalVisible(true);
  };
  
  // 打开监控详情模态框
  const handleMonitor = (trigger: any) => {
    setCurrentTrigger(trigger);
    setMonitorModalVisible(true);
  };
  
  // 保存触发器
  const handleSave = () => {
    form.validateFields().then(values => {
      if (currentTrigger) {
        // 更新现有触发器
        const updatedTriggers = triggers.map(t => 
          t.id === currentTrigger.id ? { ...t, ...values } : t
        );
        setTriggers(updatedTriggers);
      } else {
        // 创建新触发器
        const newTrigger = {
          id: `${Date.now()}`,
          type: 'balance',
          ...values,
        };
        setTriggers([...triggers, newTrigger]);
      }
      setEditModalVisible(false);
    });
  };
  
  // 删除触发器
  const handleDelete = (triggerId: string) => {
    const updatedTriggers = triggers.filter(t => t.id !== triggerId);
    setTriggers(updatedTriggers);
  };
  
  // 渲染触发器卡片
  const renderTriggerCard = (trigger: any) => {
    const selectedAccounts = trigger.accounts.map((accountId: string) => {
      const account = accounts.find(a => a.id === accountId);
      return account ? account.name : accountId;
    }).join(', ');
    
    const targetAccount = accounts.find(a => a.id === trigger.targetAccount);
    const targetAccountName = targetAccount ? targetAccount.name : trigger.targetAccount;
    
    return (
      <TriggerCard 
        title={
          <span>
            <DollarOutlined className="trigger-icon" />
            {trigger.name}
          </span>
        }
        extra={
          <Switch 
            checked={trigger.active} 
            size="small" 
            onChange={(checked) => {
              const updatedTriggers = triggers.map(t => 
                t.id === trigger.id ? { ...t, active: checked } : t
              );
              setTriggers(updatedTriggers);
            }} 
          />
        }
      >
        <div>
          <p><strong>监控账户:</strong> {selectedAccounts}</p>
          <p><strong>余额阈值:</strong> ${trigger.threshold.toLocaleString()}</p>
          <p><strong>监控间隔:</strong> {trigger.interval}分钟</p>
          <p><strong>目标账户:</strong> {targetAccountName}</p>
          {trigger.webhookEnabled && (
            <p><strong>Webhook通知:</strong> 已启用</p>
          )}
        </div>
        
        <div className="trigger-actions">
          <Space>
            <Tooltip title="查看监控">
              <Button 
                type="primary" 
                shape="circle" 
                icon={<EyeOutlined />} 
                onClick={() => handleMonitor(trigger)}
                ghost
              />
            </Tooltip>
            <Tooltip title="编辑触发器">
              <Button 
                type="primary" 
                shape="circle" 
                icon={<EditOutlined />} 
                onClick={() => handleEdit(trigger)}
              />
            </Tooltip>
          </Space>
        </div>
      </TriggerCard>
    );
  };
  
  return (
    <div>
      <Title level={3}>触发器管理</Title>
      
      <Row gutter={[24, 24]}>
        {/* 现有触发器卡片 */}
        {triggers.map(trigger => (
          <Col xs={24} sm={12} lg={8} xl={6} key={trigger.id}>
            {renderTriggerCard(trigger)}
          </Col>
        ))}
        
        {/* 添加新触发器卡片 */}
        <Col xs={24} sm={12} lg={8} xl={6}>
          <AddTriggerCard onClick={handleAddTrigger}>
            <PlusOutlined className="add-icon" />
            <Text>添加新触发器</Text>
          </AddTriggerCard>
        </Col>
      </Row>
      
      {/* 编辑/创建触发器模态框 */}
      <Modal
        title={currentTrigger ? "编辑触发器" : "创建新触发器"}
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => setEditModalVisible(false)}
        width={700}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <FormSection>
            <SectionTitle>基本信息</SectionTitle>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="name"
                  label="触发器名称"
                  rules={[{ required: true, message: '请输入触发器名称' }]}
                >
                  <Input placeholder="输入触发器名称" />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item
                  name="active"
                  valuePropName="checked"
                  label="启用状态"
                >
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
          </FormSection>
          
          <FormSection>
            <SectionTitle>
              <DollarOutlined className="icon" />
              余额监控设置
            </SectionTitle>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="accounts"
                  label="监控账户"
                  rules={[{ required: true, message: '请选择至少一个监控账户' }]}
                >
                  <Select
                    mode="multiple"
                    placeholder="选择需要监控的账户"
                    optionFilterProp="children"
                  >
                    {accounts.map(account => (
                      <Option key={account.id} value={account.id}>
                        {account.name} ({account.id})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="threshold"
                  label="余额阈值 (USD)"
                  rules={[{ required: true, message: '请输入余额阈值' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={0}
                    formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => Number(value!.replace(/\$\s?|(,*)/g, '')) as any}
                    placeholder="输入余额阈值"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="interval"
                  label="检测时间间隔 (分钟)"
                  rules={[{ required: true, message: '请输入检测间隔时间' }]}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={1}
                    placeholder="输入检测时间间隔"
                  />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item
                  name="targetAccount"
                  label="目标账户"
                  rules={[{ required: true, message: '请选择目标账户' }]}
                >
                  <Select placeholder="选择余额转移的目标账户">
                    {accounts.map(account => (
                      <Option key={account.id} value={account.id}>
                        {account.name} ({account.id})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </Col>
            </Row>
          </FormSection>
          
          <FormSection>
            <SectionTitle>
              <ApiOutlined className="icon" />
              Webhook设置
            </SectionTitle>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="webhookEnabled"
                  valuePropName="checked"
                  label="启用Webhook通知"
                >
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item
                  name="webhookUrl"
                  label="Webhook URL"
                  rules={[
                    { 
                      required: Form.useWatch('webhookEnabled', form), 
                      message: '启用Webhook时必须提供URL' 
                    }
                  ]}
                >
                  <Input placeholder="输入Webhook回调地址" disabled={!Form.useWatch('webhookEnabled', form)} />
                </Form.Item>
              </Col>
            </Row>
          </FormSection>
          
          <FormSection>
            <SectionTitle>
              <MessageOutlined className="icon" />
              消息模板
            </SectionTitle>
            <Row gutter={16}>
              <Col span={24}>
                <Form.Item
                  name="messageTemplate"
                  label={
                    <span>
                      消息内容模板
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        (可使用变量: ${'{sourceAccount}'}, ${'{targetAccount}'}, ${'{amount}'})
                      </Text>
                    </span>
                  }
                  rules={[
                    { 
                      required: Form.useWatch('webhookEnabled', form), 
                      message: '启用Webhook时必须提供消息模板' 
                    }
                  ]}
                >
                  <TextArea
                    rows={4}
                    placeholder="输入消息模板，可使用变量 ${sourceAccount}, ${targetAccount}, ${amount}"
                    disabled={!Form.useWatch('webhookEnabled', form)}
                  />
                </Form.Item>
              </Col>
            </Row>
          </FormSection>
          
          {currentTrigger && (
            <Divider />
          )}
          
          {currentTrigger && (
            <Form.Item>
              <Button 
                danger 
                icon={<DeleteOutlined />} 
                onClick={() => {
                  handleDelete(currentTrigger.id);
                  setEditModalVisible(false);
                }}
              >
                删除此触发器
              </Button>
            </Form.Item>
          )}
        </Form>
      </Modal>
      
      {/* 监控详情模态框 */}
      <Modal
        title="触发器监控详情"
        open={monitorModalVisible}
        onCancel={() => setMonitorModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setMonitorModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {currentTrigger && (
          <div>
            <Title level={4}>{currentTrigger.name}</Title>
            <Divider />
            
            <FormSection>
              <SectionTitle>
                <DollarOutlined className="icon" />
                余额监控情况
              </SectionTitle>
              
              <GlassCard>
                <p><strong>触发器状态:</strong> {currentTrigger.active ? '已启用' : '已禁用'}</p>
                <p><strong>余额阈值:</strong> ${currentTrigger.threshold.toLocaleString()}</p>
                <p><strong>自动检测间隔:</strong> {currentTrigger.interval}分钟</p>
                <p>
                  <strong>最后检测时间:</strong> 
                  {' '}2025-05-06 15:30:22
                </p>
                <p>
                  <strong>最后一次转账:</strong> 
                  {' '}2025-05-06 12:45:10 (金额: $12,500)
                </p>
              </GlassCard>
              
              <div style={{ marginTop: 16 }}>
                <Title level={5}>监控账户状态</Title>
                {currentTrigger.accounts.map((accountId: string) => {
                  const account = accounts.find(a => a.id === accountId);
                  const accountName = account ? account.name : accountId;
                  
                  // 模拟数据
                  const randomBalance = Math.floor(Math.random() * 20000) + 1000;
                  const overThreshold = randomBalance > currentTrigger.threshold;
                  
                  return (
                    <GlassCard key={accountId} style={{ marginBottom: 8 }}>
                      <Row align="middle" justify="space-between">
                        <Col>
                          <Text strong>{accountName}</Text>
                          <br />
                          <Text type="secondary">{accountId}</Text>
                        </Col>
                        <Col>
                          <Text strong style={{ fontSize: 16 }}>
                            ${randomBalance.toLocaleString()}
                          </Text>
                          <br />
                          {overThreshold ? (
                            <Text type="danger">超过阈值</Text>
                          ) : (
                            <Text type="success">低于阈值</Text>
                          )}
                        </Col>
                      </Row>
                    </GlassCard>
                  );
                })}
              </div>
            </FormSection>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default TriggerManage;