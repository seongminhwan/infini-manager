import React, { useState } from 'react';
import { Form, Input, Button, Select, InputNumber, Card, Typography, Row, Col, message } from 'antd';
import { SwapOutlined, SendOutlined, HistoryOutlined } from '@ant-design/icons';
import styled from 'styled-components';

const { Title } = Typography;
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

const TransferIcon = styled(SwapOutlined)`
  font-size: 32px;
  color: #1890ff;
  margin: 20px 0;
`;

const ButtonGroup = styled.div`
  margin-top: 24px;
  display: flex;
  justify-content: center;
  gap: 16px;
`;

/**
 * 账户转账页面
 * 实现账户间转账功能
 */
const AccountTransfer: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  
  // 模拟账户列表
  const accounts = [
    { id: 'ACC_001', name: '主要账户A', balance: 53689.42 },
    { id: 'ACC_002', name: '备用账户B', balance: 28734.15 },
    { id: 'ACC_003', name: '测试账户C', balance: 5423.89 },
    { id: 'ACC_004', name: '国际账户D', balance: 127850.36 },
    { id: 'ACC_005', name: '储备账户E', balance: 327405.78 },
  ];

  // 处理转账提交
  const handleSubmit = (values: any) => {
    setLoading(true);
    console.log('转账信息:', values);
    
    // 模拟API请求
    setTimeout(() => {
      setLoading(false);
      message.success('转账请求已提交，等待处理');
      form.resetFields();
    }, 1500);
  };

  // 根据选择的账户获取余额
  const getAccountBalance = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.balance : 0;
  };

  // 当源账户改变时
  const handleSourceChange = (value: string) => {
    const balance = getAccountBalance(value);
    form.setFieldsValue({ sourceBalance: balance });
  };

  // 当目标账户改变时
  const handleTargetChange = (value: string) => {
    const balance = getAccountBalance(value);
    form.setFieldsValue({ targetBalance: balance });
  };

  return (
    <div>
      <Title level={3}>账户转账</Title>
      
      <GlassCard>
        <FormSection>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{
              sourceBalance: 0,
              targetBalance: 0,
              amount: 0,
            }}
          >
            <Row gutter={24}>
              <Col span={11}>
                <Form.Item
                  name="sourceAccount"
                  label="源账户"
                  rules={[{ required: true, message: '请选择源账户' }]}
                >
                  <Select
                    placeholder="选择转出账户"
                    onChange={handleSourceChange}
                  >
                    {accounts.map(account => (
                      <Option key={account.id} value={account.id}>
                        {account.name} ({account.id})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item
                  name="sourceBalance"
                  label="可用余额 (USD)"
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    disabled
                    formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                </Form.Item>
              </Col>
              
              <Col span={2} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <TransferIcon />
              </Col>
              
              <Col span={11}>
                <Form.Item
                  name="targetAccount"
                  label="目标账户"
                  rules={[{ required: true, message: '请选择目标账户' }]}
                >
                  <Select
                    placeholder="选择转入账户"
                    onChange={handleTargetChange}
                  >
                    {accounts.map(account => (
                      <Option key={account.id} value={account.id}>
                        {account.name} ({account.id})
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item
                  name="targetBalance"
                  label="当前余额 (USD)"
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    disabled
                    formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  />
                </Form.Item>
              </Col>
            </Row>
            
            <Form.Item
              name="amount"
              label="转账金额 (USD)"
              rules={[
                { required: true, message: '请输入转账金额' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || value <= 0) {
                      return Promise.reject(new Error('转账金额必须大于0'));
                    }
                    if (value > getFieldValue('sourceBalance')) {
                      return Promise.reject(new Error('转账金额不能超过可用余额'));
                    }
                    if (getFieldValue('sourceAccount') === getFieldValue('targetAccount')) {
                      return Promise.reject(new Error('不能向同一账户转账'));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                step={0.01}
                formatter={value => `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(value) => {
                  const parsed = parseFloat(value!.replace(/\$\s?|(,*)/g, ''));
                  return parsed as unknown as 0;
                }}
              />
            </Form.Item>
            
            <Form.Item
              name="memo"
              label="备注 (可选)"
            >
              <Input.TextArea rows={3} placeholder="输入转账说明或备注" />
            </Form.Item>
            
            <ButtonGroup>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SendOutlined />}
                loading={loading}
                size="large"
              >
                提交转账
              </Button>
              
              <Button
                icon={<HistoryOutlined />}
                size="large"
              >
                转账记录
              </Button>
            </ButtonGroup>
          </Form>
        </FormSection>
      </GlassCard>
    </div>
  );
};

export default AccountTransfer;