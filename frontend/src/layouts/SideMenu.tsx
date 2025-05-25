import React, { useState, useEffect, ReactNode } from 'react';
import { Layout, Menu, Button, Space } from 'antd';
import styled from 'styled-components';
import { configApi, emailAccountApi } from '../services/api';
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
  SettingOutlined,
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

// 定义菜单项接口
interface MenuItem {
  key: string;
  icon?: ReactNode;
  label: ReactNode | string;
  children?: MenuItem[];
  showWhenDisabled?: boolean;
  requiresEmailAccount?: boolean;
}

const SideMenu: React.FC<SideMenuProps> = ({ collapsed, toggleCollapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [disableRegisterFeatures, setDisableRegisterFeatures] = useState<boolean>(false);
  const [hasEmailAccounts, setHasEmailAccounts] = useState<boolean>(false);
  
  // 获取配置
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await configApi.getConfigByKey('disable_register_features');
        if (response.success && response.data) {
          // 将字符串转换为布尔值
          const disabled = response.data.value === 'true';
          setDisableRegisterFeatures(disabled);
        }
      } catch (error) {
        console.error('获取配置失败:', error);
      }
    };
    
    fetchConfig();
    
    // 检查是否有邮箱账户配置
    const checkEmailAccounts = async () => {
      try {
        const response = await emailAccountApi.getAllEmailAccounts();
        if (response.success && response.data && response.data.length > 0) {
          setHasEmailAccounts(true);
        } else {
          setHasEmailAccounts(false);
        }
      } catch (error) {
        console.error('获取邮箱账户列表失败:', error);
        setHasEmailAccounts(false);
      }
    };
    
    checkEmailAccounts();
  }, []);
  
  // 菜单项配置 - 按功能模块重新组织
  const allMenuItems: MenuItem[] = [
    // ------------ 总览监控 ------------
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
      showWhenDisabled: false, // 当禁用注册功能时不显示
    },
    {
      key: '/random-user-manage',
      icon: <IdcardOutlined />,
      label: '模拟用户数据管理',
      showWhenDisabled: false, // 当禁用注册功能时不显示
    },
    {
      key: '/account-group-manage',
      icon: <TeamOutlined />,
      label: '账户分组管理',
      showWhenDisabled: true, // 当禁用注册功能时仍然显示
    },
    
    // ------------ 资金管理 ------------
    {
      key: 'fund-ops',
      icon: <SwapOutlined />,
      label: '资金管理',
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
    
    // ------------ 卡片服务 ------------
    {
      key: '/batch-card-apply',
      icon: <CreditCardOutlined />,
      label: '批量开卡',
      showWhenDisabled: false, // 当禁用注册功能时不显示
    },
    
    // ------------ 推广返现 ------------
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
    
    // ------------ 支持工具 ------------
    {
      key: 'email-ops',
      icon: <MailOutlined />,
      label: '邮箱管理',
      children: [
        {
          key: '/email-manage',
          label: '邮箱账户管理',
        },
        {
          key: '/email-viewer',
          label: (
            <Space>
              邮件持久化系统
              <BetaBadge>Beta</BetaBadge>
            </Space>
          ),
          requiresEmailAccount: true, // 标记需要邮箱账户的菜单项
        }
      ]
    },
    {
      key: '/kyc-image-manage',
      icon: <FileImageOutlined />,
      label: 'KYC图片管理',
      showWhenDisabled: false, // 当禁用注册功能时不显示
    },
    {
      key: '/proxy-pool-manage',
      icon: <ApiOutlined />,
      label: (
        <Space>
          代理管理
          <BetaBadge>Beta</BetaBadge>
        </Space>
      ),
    },
    
    // ------------ 系统管理 ------------
    {
      key: '/system-settings',
      icon: <SettingOutlined />,
      label: (
        <Space>
          系统设置
          <BetaBadge>Beta</BetaBadge>
        </Space>
      ),
      showWhenDisabled: false, // 当禁用注册功能时不显示
    },
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
  ];
  
  // 根据配置筛选菜单项
  const menuItems = allMenuItems.filter((item: MenuItem) => {
    // 检查是否需要邮箱账户但尚未配置
    if (item.requiresEmailAccount && !hasEmailAccounts) {
      return false;
    }
    
    // 检查注册功能是否被禁用
    if (item.showWhenDisabled === undefined || !disableRegisterFeatures) {
      return true;
    }
    // 如果是被禁用的功能，但设置了showWhenDisabled为true，则显示
    return item.showWhenDisabled;
  });

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