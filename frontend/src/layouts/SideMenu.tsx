import React from 'react';
import { Layout, Menu, Button } from 'antd';
import styled from 'styled-components';
import {
  DashboardOutlined,
  MonitorOutlined,
  SwapOutlined,
  UserAddOutlined,
  BellOutlined,
  ThunderboltOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MailOutlined,
  FileImageOutlined,
  IdcardOutlined,
  TeamOutlined,
  DollarOutlined,
  CreditCardOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Sider } = Layout;

interface SideMenuProps {
  collapsed: boolean;
  toggleCollapsed: () => void;
}

// 毛玻璃效果的Sider
const GlassmorphicSider = styled(Sider)`
  position: relative;
  background: rgba(255, 255, 255, 0.4) !important;
  backdrop-filter: blur(10px);
  border-right: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
  z-index: 10;

  .ant-layout-sider-children {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .logo {
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--primary-color, #1890ff);
    font-size: 20px;
    font-weight: bold;
    margin-bottom: 16px;
    overflow: hidden;
  }

  .anticon {
    font-size: 18px;
  }
`;

const CollapseTrigger = styled(Button)`
  margin: 16px;
  border: none;
  background: rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(5px);
  
  &:hover {
    background: rgba(255, 255, 255, 0.5);
  }
`;

const StyledMenu = styled(Menu)`
  background: transparent !important;
  
  .ant-menu-item {
    margin: 8px 0;
    border-radius: 8px;
    
    &:hover {
      background: rgba(255, 255, 255, 0.3) !important;
    }
  }
  
  .ant-menu-item-selected {
    background: rgba(var(--primary-rgb, 24, 144, 255), 0.2) !important;
    color: var(--primary-color, #1890ff);
  }
`;

const SideMenu: React.FC<SideMenuProps> = ({ collapsed, toggleCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 菜单项配置
  const menuItems = [
    {
      key: '/overview',
      icon: <DashboardOutlined />,
      label: '概览',
    },
    {
      key: '/account-monitor',
      icon: <MonitorOutlined />,
      label: '账户监控',
    },
    {
      key: 'account-ops',
      icon: <SwapOutlined />,
      label: '账户资金',
      children: [
        {
          key: '/account-transfer',
          label: '账户转账',
        },
        {
          key: '/account-details',
          label: '账户明细',
        }
      ]
    },
    {
      key: '/account-register',
      icon: <UserAddOutlined />,
      label: '账户批量注册机',
    },
    {
      key: '/account-group-manage',
      icon: <TeamOutlined />,
      label: '账户分组管理',
    },
    {
      key: 'aff-ops',
      icon: <DollarOutlined />,
      label: 'AFF返现',
      children: [
        {
          key: '/aff-cashback',
          label: 'AFF批量返现',
        },
        {
          key: '/aff-history',
          label: 'AFF历史记录',
        }
      ]
    },
    {
      key: '/notification-manage',
      icon: <BellOutlined />,
      label: '通知管理',
    },
    {
      key: '/trigger-manage',
      icon: <ThunderboltOutlined />,
      label: '触发器管理',
    },
    {
      key: '/email-manage',
      icon: <MailOutlined />,
      label: '主邮箱管理',
    },
    {
      key: '/kyc-image-manage',
      icon: <FileImageOutlined />,
      label: 'KYC图片管理',
    },
    {
      key: 'card-ops',
      icon: <CreditCardOutlined />,
      label: '卡片管理',
      children: [
        {
          key: '/batch-card-apply',
          label: '批量开卡',
        }
      ]
    },
    {
      key: '/random-user-manage',
      icon: <IdcardOutlined />,
      label: '模拟用户数据管理',
    },
  ];

  const handleMenuClick = (key: string) => {
    navigate(key);
  };

  return (
    <GlassmorphicSider
      width={220}
      collapsible
      collapsed={collapsed}
      trigger={null}
    >
      <div className="logo">
        {collapsed ? 'IM' : 'Infini Manager'}
      </div>
      
      <CollapseTrigger
        type="text"
        onClick={toggleCollapsed}
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
      />
      
      <StyledMenu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => handleMenuClick(key as string)}
      />
    </GlassmorphicSider>
  );
};

export default SideMenu;