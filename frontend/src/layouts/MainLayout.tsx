import React, { useState } from 'react';
import { Layout } from 'antd';
import styled from 'styled-components';
import { Outlet } from 'react-router-dom';
import SideMenu from './SideMenu';
import TabsView from './TabsView';

const { Content } = Layout;

// 使用styled-components创建带有毛玻璃效果的布局组件
const StyledLayout = styled(Layout)`
  min-height: 100vh;
  background: var(--background-color, #f0f2f5);
`;

const GlassmorphicContent = styled(Content)`
  margin: 24px 16px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  overflow: auto;
`;

/**
 * 主布局组件
 * 包含侧边菜单和内容区域
 */
const MainLayout: React.FC = () => {
  // 控制菜单折叠状态
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  return (
    <StyledLayout>
      <SideMenu collapsed={collapsed} toggleCollapsed={toggleCollapsed} />
      <Layout>
        <GlassmorphicContent>
          <TabsView />
          <Outlet />
        </GlassmorphicContent>
      </Layout>
    </StyledLayout>
  );
};

export default MainLayout;