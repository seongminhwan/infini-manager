import React, { useState } from 'react';
import { Popover, Tag, Button, Space } from 'antd';
import { DollarOutlined, ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

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
 * 3. 点击按钮后导航到账户转账页面
 */
const TransferActionPopover: React.FC<TransferActionPopoverProps> = ({ account }) => {
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  const handleVisibleChange = (v: boolean) => {
    setVisible(v);
  };

  // 处理点击转入/转出按钮 - 导航到账户转账页面
  const handleAction = (type: 'in' | 'out') => {
    console.log(`点击${type==='in'?'转入':'转出'}按钮`, account);
    
    // 关闭弹窗
    setVisible(false);
    
    // 根据类型构建参数并导航
    if (type === 'in') {
      // 转入：将当前账户作为目标账户
      navigate(`/account-transfer?targetType=internal&internalTarget=${account.id}`);
    } else {
      // 转出：将当前账户作为源账户
      navigate(`/account-transfer?sourceAccount=${account.id}`);
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

  return (
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
  );
};

export default TransferActionPopover;