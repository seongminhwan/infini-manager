import React, { useState } from 'react';
import { Popover, Tag, Button, Space, message } from 'antd';
import { DollarOutlined, ArrowDownOutlined, ArrowUpOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import TransferForm from './TransferForm';

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
  // 添加视图状态，用于控制显示按钮还是表单
  const [currentView, setCurrentView] = useState<'buttons' | 'transferForm'>('buttons');
  // 添加当前操作类型状态
  const [actionType, setActionType] = useState<'in' | 'out'>('in');

  const handleVisibleChange = (v: boolean) => {
    setVisible(v);
    // 当关闭弹窗时，重置状态
    if (!v) {
      setCurrentView('buttons');
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
  };

  // 处理转账完成或取消
  const handleTransferFinished = (success: boolean) => {
    if (success) {
      message.success(`${actionType === 'in' ? '转入' : '转出'}操作已完成`);
    }
    // 重置状态并关闭弹窗
    setVisible(false);
    setCurrentView('buttons');
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
    <div style={{ width: 300 }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={handleBack}
          type="link"
          style={{ padding: 0, marginRight: 8 }}
        />
        <h4 style={{ margin: 0 }}>
          {actionType === 'in' ? '转入' : '转出'}
        </h4>
      </div>
      
      {/* 使用现有的TransferForm组件 */}
      <TransferForm 
        sourceAccountId={account.id} 
        mode={actionType} 
        onFinished={handleTransferFinished}
      />
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