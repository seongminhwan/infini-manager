import React, { useState } from 'react';
import { Popover, Tag, Button, Space, message, Input, Form, Typography, Divider } from 'antd';
import { DollarOutlined, ArrowDownOutlined, ArrowUpOutlined, ArrowLeftOutlined, SendOutlined } from '@ant-design/icons';

interface TransferActionPopoverProps {
  account: {
    id: number;
    email: string;
    availableBalance: number;
  };
}

/**
 * 可用余额 Tag + Popover 组件
 * 1. 显示余额标签，点击后弹出 Popover
 * 2. Popover 首屏展示"转入 / 转出"按钮
 * 3. 点击按钮后切换到转账表单
 */
const TransferActionPopover: React.FC<TransferActionPopoverProps> = ({ account }) => {
  const [visible, setVisible] = useState(false);
  const [form] = Form.useForm();
  // 添加视图状态，用于控制显示按钮还是表单
  const [currentView, setCurrentView] = useState<'buttons' | 'transferForm'>('buttons');
  // 添加当前操作类型状态
  const [actionType, setActionType] = useState<'in' | 'out'>('in');
  // 添加加载状态
  const [loading, setLoading] = useState(false);

  const { Text } = Typography;

  const handleVisibleChange = (v: boolean) => {
    setVisible(v);
    // 当关闭弹窗时，重置状态
    if (!v) {
      setCurrentView('buttons');
      form.resetFields();
    }
  };

  // 处理点击转入/转出按钮
  const handleAction = (type: 'in' | 'out') => {
    console.log(`点击${type==='in'?'转入':'转出'}按钮`, account);
    // 设置当前操作类型
    setActionType(type);
    // 切换到表单视图
    setCurrentView('transferForm');
  };

  // 处理返回按钮点击
  const handleBack = () => {
    setCurrentView('buttons');
    form.resetFields();
  };

  // 处理提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      // 模拟API调用
      console.log('提交表单', {
        accountId: account.id,
        email: account.email,
        type: actionType,
        amount: values.amount,
        remark: values.remark
      });
      
      // 延迟模拟API请求
      setTimeout(() => {
        setLoading(false);
        message.success(`${actionType === 'in' ? '转入' : '转出'}操作已提交`);
        // 关闭弹窗并重置状态
        setVisible(false);
        setCurrentView('buttons');
        form.resetFields();
      }, 1000);
    } catch (error) {
      console.error('表单验证失败', error);
    }
  };

  // 渲染按钮视图
  const renderButtonsView = () => (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Button 
        icon={<ArrowDownOutlined />} 
        onClick={() => handleAction('in')}
        type="primary"
        block
        style={{ marginBottom: 8 }}
      >
        转入
      </Button>
      <Button
        icon={<ArrowUpOutlined />}
        disabled={account.availableBalance <= 0}
        onClick={() => handleAction('out')}
        type="primary"
        danger
        block
      >
        转出
      </Button>
    </Space>
  );

  // 渲染表单视图
  const renderTransferFormView = () => (
    <div style={{ width: 280 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={handleBack}
          type="link"
          style={{ padding: 0, marginRight: 8 }}
        />
        <Typography.Title level={5} style={{ margin: 0 }}>
          {actionType === 'in' ? '转入' : '转出'}
        </Typography.Title>
      </div>

      <Divider style={{ margin: '8px 0 16px' }} />

      <Form 
        form={form}
        layout="vertical"
      >
        <Form.Item
          name="amount"
          label="金额"
          rules={[
            { required: true, message: '请输入金额' },
            { 
              validator: (_, value) => {
                if (isNaN(value) || parseFloat(value) <= 0) {
                  return Promise.reject('金额必须大于0');
                }
                if (actionType === 'out' && parseFloat(value) > account.availableBalance) {
                  return Promise.reject('余额不足');
                }
                return Promise.resolve();
              }
            }
          ]}
        >
          <Input 
            placeholder="请输入金额" 
            type="number"
            min={0}
            step={0.000001}
            addonAfter="USDT"
          />
        </Form.Item>

        <Form.Item
          name="remark"
          label="备注"
        >
          <Input.TextArea 
            placeholder="选填" 
            maxLength={200}
            showCount
            rows={2}
          />
        </Form.Item>

        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            当前可用余额: {account.availableBalance.toFixed(6)} USDT
          </Text>
        </div>

        <Form.Item style={{ marginTop: 16, marginBottom: 0 }}>
          <Button 
            type="primary" 
            onClick={handleSubmit}
            loading={loading}
            icon={<SendOutlined />}
            block
          >
            确认{actionType === 'in' ? '转入' : '转出'}
          </Button>
        </Form.Item>
      </Form>
    </div>
  );

  // 根据当前视图状态渲染不同的内容
  const renderContent = () => {
    if (currentView === 'buttons') {
      return renderButtonsView();
    } else {
      return renderTransferFormView();
    }
  };

  return (
    <Popover
      open={visible}
      onOpenChange={handleVisibleChange}
      trigger="click"
      placement="rightBottom"
      getPopupContainer={() => document.body}
      destroyTooltipOnHide
      content={renderContent()}
    >
      <Tag
        color={account.availableBalance > 0 ? 'green' : 'default'}
        style={{ cursor: 'pointer' }}
      >
        <DollarOutlined style={{ marginRight: 4 }} />
        {account.availableBalance.toFixed(6)}
      </Tag>
    </Popover>
  );
};

export default TransferActionPopover; 