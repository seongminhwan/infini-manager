import React, { useState } from 'react';
import { Popover, Tag, Button, Space, Modal } from 'antd';
import { DollarOutlined, ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import TransferFormCore from './TransferFormCore';

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
 * 2. Popover 展示"转入 / 转出"按钮
 * 3. 点击按钮后显示转账表单弹窗
 */
const TransferActionPopover: React.FC<TransferActionPopoverProps> = ({ account }) => {
  const [visible, setVisible] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'in' | 'out'>('in');

  const handleVisibleChange = (v: boolean) => {
    setVisible(v);
  };

  // 处理点击转入/转出按钮 - 显示转账表单弹窗
  const handleAction = (type: 'in' | 'out') => {
    console.log(`点击${type==='in'?'转入':'转出'}按钮`, account);
    
    // 设置操作类型
    setActionType(type);
    
    // 关闭Popover，显示Modal
    setVisible(false);
    setModalVisible(true);
  };

  // 处理转账完成
  const handleTransferFinished = (success: boolean) => {
    // 关闭转账弹窗
    setModalVisible(false);
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

  return (
    <>
      <Popover
        open={visible}
        onOpenChange={handleVisibleChange}
        trigger="click"
        placement="rightBottom"
        getPopupContainer={() => document.body}
        destroyTooltipOnHide
        content={renderButtonsView()}
      >
        <Tag
          color={account.availableBalance > 0 ? 'green' : 'default'}
          style={{ cursor: 'pointer' }}
        >
          <DollarOutlined style={{ marginRight: 4 }} />
          {account.availableBalance.toFixed(6)}
        </Tag>
      </Popover>
      
      {/* 转账表单弹窗 */}
      <Modal
        title={`${actionType === 'in' ? '转入' : '转出'}资金`}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        destroyOnClose
        width={700}
      >
        <TransferFormCore
          defaultSourceAccountId={actionType === 'out' ? account.id : undefined}
          defaultTargetAccountId={actionType === 'in' ? account.id : undefined}
          mode={actionType}
          compact={true}
          showAdvancedOptions={true}
          onFinished={handleTransferFinished}
        />
      </Modal>
    </>
  );
};

export default TransferActionPopover;