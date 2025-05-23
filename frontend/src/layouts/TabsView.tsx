import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import {
  DashboardOutlined,
  MonitorOutlined,
  SwapOutlined,
  UserAddOutlined,
  BellOutlined,
  ThunderboltOutlined,
  CloseOutlined,
} from '@ant-design/icons';

type TabItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  closable: boolean;
};

const StyledTabs = styled(Tabs)`
  .ant-tabs-nav {
    margin-bottom: 16px;
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(5px);
    border-radius: 8px;
    padding: 8px;
    box-shadow: 0 4px 16px 0 rgba(31, 38, 135, 0.05);

    .ant-tabs-tab {
      border-radius: 6px;
      padding: 8px 16px;
      transition: all 0.3s;
      background: rgba(255, 255, 255, 0.3);
      margin: 0 4px;

      &:hover {
        background: rgba(255, 255, 255, 0.5);
      }

      .anticon {
        margin-right: 8px;
      }

      .ant-tabs-tab-remove {
        margin-left: 8px;
      }
    }

    .ant-tabs-tab-active {
      background: rgba(var(--primary-rgb, 24, 144, 255), 0.1);
      
      .ant-tabs-tab-btn {
        color: var(--primary-color, #1890ff) !important;
      }
    }
  }
`;

// 路由与图标的映射
const routeIconMap = {
  '/overview': <DashboardOutlined />,
  '/account-monitor': <MonitorOutlined />,
  '/account-transfer': <SwapOutlined />,
  '/batch-transfer-details': <SwapOutlined />,
  '/account-register': <UserAddOutlined />,
  '/notification-manage': <BellOutlined />,
  '/trigger-manage': <ThunderboltOutlined />,
};

// 路由与标签标题的映射
const routeTitleMap = {
  '/overview': '概览',
  '/account-monitor': '账户监控',
  '/account-transfer': '账户转账',
  '/batch-transfer-details': '批量转账明细',
  '/account-register': '账户批量注册机',
  '/notification-manage': '通知管理',
  '/trigger-manage': '触发器管理',
};

const TabsView: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeKey, setActiveKey] = useState(location.pathname);
  const [tabs, setTabs] = useState<TabItem[]>([
    {
      key: '/overview',
      label: '概览',
      icon: routeIconMap['/overview' as keyof typeof routeIconMap],
      closable: false,
    },
  ]);

  // 监听路由变化，添加新标签页
  useEffect(() => {
    const { pathname } = location;
    
    // 如果当前路径不在标签页中，添加新标签页
    if (!tabs.find(tab => tab.key === pathname) && routeTitleMap[pathname as keyof typeof routeTitleMap]) {
      const newTab: TabItem = {
        key: pathname,
        label: routeTitleMap[pathname as keyof typeof routeTitleMap] || '未知页面',
        icon: routeIconMap[pathname as keyof typeof routeIconMap] || null,
        closable: pathname !== '/overview', // 概览页不可关闭
      };
      
      setTabs([...tabs, newTab]);
    }
    
    // 更新激活的标签页
    setActiveKey(pathname);
  }, [location.pathname]);

  // 切换标签页
  const handleTabChange = (key: string) => {
    navigate(key);
  };

  // 关闭标签页
  const handleTabClose = (targetKey: React.MouseEvent | React.KeyboardEvent | string) => {
    const key = targetKey as string;
    // 过滤掉要关闭的标签页
    const newTabs = tabs.filter(tab => tab.key !== key);
    setTabs(newTabs);

    // 如果关闭的是当前激活的标签页，则跳转到最后一个标签页
    if (key === activeKey) {
      const lastTab = newTabs[newTabs.length - 1];
      navigate(lastTab.key);
    }
  };

  return (
    <StyledTabs
      type="editable-card"
      activeKey={activeKey}
      onChange={handleTabChange}
      onEdit={handleTabClose}
      hideAdd
      items={tabs.map(tab => ({
        key: tab.key,
        label: (
          <span>
            {tab.icon} {tab.label}
          </span>
        ),
        closable: tab.closable,
      }))}
    />
  );
};

export default TabsView;