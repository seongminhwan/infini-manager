import React from 'react';
import { Card, Row, Col, Statistic, Typography } from 'antd';
import {
  UserOutlined,
  WalletOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';

const { Title } = Typography;

// 毛玻璃效果卡片
const GlassCard = styled(Card)`
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  transition: all 0.3s ease;
  margin-bottom: 24px;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 12px 40px 0 rgba(31, 38, 135, 0.15);
  }
`;

const StatisticContainer = styled.div`
  padding: 16px;
  text-align: center;
`;

/**
 * 概览页面
 * 展示账户总览和关键指标
 */
const Overview: React.FC = () => {
  // 模拟数据
  const stats = {
    totalAccounts: 128,
    activeAccounts: 98,
    inactiveAccounts: 30,
    totalBalance: 1250847.58,
    pendingTransactions: 15,
  };

  return (
    <div>
      <Title level={3}>系统概览</Title>
      <Row gutter={[24, 24]}>
        {/* 账户总数 */}
        <Col xs={24} sm={12} md={8}>
          <GlassCard>
            <StatisticContainer>
              <Statistic
                title="账户总数"
                value={stats.totalAccounts}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </StatisticContainer>
          </GlassCard>
        </Col>
        
        {/* 活跃账户 */}
        <Col xs={24} sm={12} md={8}>
          <GlassCard>
            <StatisticContainer>
              <Statistic
                title="活跃账户"
                value={stats.activeAccounts}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
                suffix={`/ ${stats.totalAccounts}`}
              />
            </StatisticContainer>
          </GlassCard>
        </Col>
        
        {/* 非活跃账户 */}
        <Col xs={24} sm={12} md={8}>
          <GlassCard>
            <StatisticContainer>
              <Statistic
                title="非活跃账户"
                value={stats.inactiveAccounts}
                prefix={<CloseCircleOutlined />}
                valueStyle={{ color: '#ff4d4f' }}
                suffix={`/ ${stats.totalAccounts}`}
              />
            </StatisticContainer>
          </GlassCard>
        </Col>
        
        {/* 总余额 */}
        <Col xs={24} sm={12} md={12}>
          <GlassCard>
            <StatisticContainer>
              <Statistic
                title="总余额 (USD)"
                value={stats.totalBalance}
                precision={2}
                prefix={<WalletOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </StatisticContainer>
          </GlassCard>
        </Col>
        
        {/* 待处理交易 */}
        <Col xs={24} sm={12} md={12}>
          <GlassCard>
            <StatisticContainer>
              <Statistic
                title="待处理交易"
                value={stats.pendingTransactions}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </StatisticContainer>
          </GlassCard>
        </Col>
      </Row>

      {/* 更多可视化图表和数据可以在这里添加 */}
    </div>
  );
};

export default Overview;