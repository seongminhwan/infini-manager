import React from 'react';
import { Layout, Menu, Button, Space } from 'antd';
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
  ScheduleOutlined,
  ApiOutlined,
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

// Beta标志
const BetaBadge = styled.span`
  background-color: #ff4d4f;
  color: white;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 4px;
  margin-left: 8px;
  font-weight: bold;
`;

// 开发中标志
const DevBadge = styled.span`
  background-color: #722ed1;
  color: white;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 4px;
  margin-left: 8px;
  font-weight: bold;
`;

const SideMenu: React.FC<SideMenuProps> = ({ collapsed, toggleCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 菜单项配置 - 重新组织为业务功能、资金操作、系统管理和工具等逻辑分组
  const menuItems = [
    // ------------ 概览和监控 ------------
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
    
    // ------------ 账户管理 ------------
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
    
    // ------------ 卡片管理 ------------
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
    
    // ------------ 资金操作 ------------
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
          key: '/batch-transfer',
          label: (
            <Space>
              批量转账
              <BetaBadge>Beta</BetaBadge>
            </Space>
          ),
        },
        {
          key: '/batch-transfer-details',
          label: '批量转账明细',
        },
        {
          key: '/account-details',
          label: '账户明细',
        }
      ]
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
    
    // ------------ 系统管理 ------------
    {
      key: '/task-manage',
      icon: <ScheduleOutlined />,
      label: (
        <Space>
          定时任务管理
          <DevBadge>开发中</DevBadge>
        </Space>
      ),
    },
    {
      key: '/trigger-manage',
      icon: <ThunderboltOutlined />,
      label: (
        <Space>
          触发器管理
          <DevBadge>开发中</DevBadge>
        </Space>
      ),
    },
    {
      key: '/notification-manage',
      icon: <BellOutlined />,
      label: (
        <Space>
          通知管理
          <DevBadge>开发中</DevBadge>
        </Space>
      ),
    },
    {
      key: '/api-log-monitor',
      icon: <ApiOutlined />,
      label: (
        <Space>
          API日志监控
          <DevBadge>开发中</DevBadge>
        </Space>
      ),
    },
    
    // ------------ 辅助工具 ------------
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