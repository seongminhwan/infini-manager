import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Typography, Spin, Alert } from 'antd';
import {
  UserOutlined,
  WalletOutlined,
  CheckCircleOutlined,
  CreditCardOutlined,
  RedEnvelopeOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { infiniAccountApi } from '../../services/api';
import { IAccountStatistics } from '../../types';

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
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<IAccountStatistics>({
    totalAccounts: 0,
    accountsWithBalance: 0,
    accountsWithRedPacket: 0,
    totalBalance: 0,
    totalCards: 0,
  });

  useEffect(() => {
    const fetchStatistics = async () => {
      try {
        setLoading(true);
        const response = await infiniAccountApi.getAccountStatistics();
        setStats(response.data);
        setError(null);
      } catch (err) {
        console.error('获取账户统计数据失败:', err);
        setError('获取账户统计数据失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchStatistics();
  }, []);

  return (
    <div>
      <Title level={3}>系统概览</Title>
      
      {error && (
        <Alert
          message="错误"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" tip="加载数据中..." />
        </div>
      ) : (
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
          
          {/* 有余额账户 */}
          <Col xs={24} sm={12} md={8}>
            <GlassCard>
              <StatisticContainer>
                <Statistic
                  title="有余额账户"
                  value={stats.accountsWithBalance}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                  suffix={`/ ${stats.totalAccounts}`}
                />
              </StatisticContainer>
            </GlassCard>
          </Col>
          
          {/* 有红包账户 */}
          <Col xs={24} sm={12} md={8}>
            <GlassCard>
              <StatisticContainer>
                <Statistic
                  title="有红包账户"
                  value={stats.accountsWithRedPacket}
                  prefix={<RedEnvelopeOutlined />}
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
          
          {/* 现有卡片总数 */}
          <Col xs={24} sm={12} md={12}>
            <GlassCard>
              <StatisticContainer>
                <Statistic
                  title="现有卡片总数"
                  value={stats.totalCards}
                  prefix={<CreditCardOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              </StatisticContainer>
            </GlassCard>
          </Col>
        </Row>
      )}

      {/* 更多可视化图表和数据可以在这里添加 */}
    </div>
  );
};

export default Overview;