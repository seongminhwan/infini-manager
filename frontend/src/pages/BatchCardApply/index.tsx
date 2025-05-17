/**
 * 批量开卡页面
 * 用于批量为多个Infini账户申请卡片
 */
import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Space, Table, Tag, Row, Col, Checkbox, message } from 'antd';
import { CreditCardOutlined, ReloadOutlined, FilterOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import BatchCardApplyModal from '../../components/BatchCardApplyModal';
import { infiniAccountApi, infiniCardApi } from '../../services/api';

const { Title, Text } = Typography;

const PageContainer = styled.div`
  padding: 24px;
`;

const StyledCard = styled(Card)`
  margin-bottom: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const ActionBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`;

const FilterContainer = styled.div`
  margin-bottom: 16px;
  padding: 16px;
  background: #f9f9f9;
  border-radius: 8px;
`;

// 账户接口定义
interface InfiniAccount {
  id: number;
  email: string;
  balance: string;
  verification_level?: number;
  verificationLevel?: number;
  google_2fa_is_bound?: number;
  google2faIsBound?: boolean;
  hasCard?: boolean;
  cardCount?: number;
}

const BatchCardApply: React.FC = () => {
  // 状态管理
  const [accounts, setAccounts] = useState<InfiniAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [excludeCardOwners, setExcludeCardOwners] = useState<boolean>(true);
  
  // 获取所有账户
  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await infiniAccountApi.getAllInfiniAccounts();
      
      if (response.success) {
        // 获取每个账户的卡片信息
        const accountsWithCardInfo = await Promise.all(
          response.data.map(async (account: InfiniAccount) => {
            try {
              const cardResponse = await infiniCardApi.getCardList(account.id.toString());
              const hasCard = cardResponse.success && cardResponse.data && cardResponse.data.length > 0;
              const cardCount = hasCard ? cardResponse.data.length : 0;
              return { ...account, hasCard, cardCount };
            } catch (error) {
              return { ...account, hasCard: false, cardCount: 0 };
            }
          })
        );
        
        setAccounts(accountsWithCardInfo);
      } else {
        message.error('获取账户列表失败');
      }
    } catch (error: any) {
      message.error(`获取账户列表失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 初始加载
  useEffect(() => {
    fetchAccounts();
  }, []);
  
  // 刷新账户列表
  const handleRefresh = () => {
    fetchAccounts();
  };
  
  // 过滤账户列表
  const filteredAccounts = excludeCardOwners
    ? accounts.filter(account => !account.hasCard)
    : accounts;
  
  // 打开批量开卡模态框
  const handleBatchApply = () => {
    if (selectedAccountIds.length === 0) {
      message.warning('请至少选择一个账户');
      return;
    }
    setModalVisible(true);
  };
  
  // 表格列定义
  const columns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '账户余额',
      dataIndex: 'balance',
      key: 'balance',
      render: (balance: string) => `$${parseFloat(balance).toFixed(2)}`
    },
    {
      title: '验证级别',
      dataIndex: 'verification_level',
      key: 'verification_level',
      render: (level: number, record: InfiniAccount) => {
        const verificationLevel = level !== undefined ? level : record.verificationLevel;
        
        if (verificationLevel === 2) {
          return <Tag color="green">已完成KYC</Tag>;
        } else if (verificationLevel === 1) {
          return <Tag color="blue">基础认证</Tag>;
        } else if (verificationLevel === 3) {
          return <Tag color="gold">认证中</Tag>;
        } else {
          return <Tag color="red">未认证</Tag>;
        }
      }
    },
    {
      title: '2FA状态',
      dataIndex: 'google_2fa_is_bound',
      key: 'google_2fa_is_bound',
      render: (isBound: number, record: InfiniAccount) => {
        const bound = isBound === 1 || record.google2faIsBound;
        return bound ? 
          <Tag color="green">已绑定</Tag> : 
          <Tag color="red">未绑定</Tag>;
      }
    },
    {
      title: '卡片状态',
      key: 'hasCard',
      render: (record: InfiniAccount) => {
        return record.hasCard ? 
          <Tag color="green">{`已有卡片 (${record.cardCount})`}</Tag> : 
          <Tag color="gray">无卡片</Tag>;
      }
    }
  ];
  
  // 表格行选择配置
  const rowSelection = {
    selectedRowKeys: selectedAccountIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedAccountIds(selectedRowKeys as number[]);
    },
    getCheckboxProps: (record: InfiniAccount) => ({
      disabled: excludeCardOwners && record.hasCard, // 如果排除已有卡片的账户，则禁用它们的选择
    }),
  };
  
  return (
    <PageContainer>
      <StyledCard>
        <Title level={4}>批量开卡</Title>
        <Text type="secondary">为多个账户同时申请Infini卡片</Text>
        
        <ActionBar>
          <Space>
            <Button 
              type="primary" 
              icon={<CreditCardOutlined />} 
              onClick={handleBatchApply}
              disabled={selectedAccountIds.length === 0}
            >
              批量开卡
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={handleRefresh}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
          <Text>已选择: {selectedAccountIds.length} 个账户</Text>
        </ActionBar>
        
        <FilterContainer>
          <Row>
            <Col span={24}>
              <Space align="center">
                <FilterOutlined />
                <Text strong>筛选选项:</Text>
                <Checkbox 
                  checked={excludeCardOwners} 
                  onChange={(e) => setExcludeCardOwners(e.target.checked)}
                >
                  排除已有卡片的账户
                </Checkbox>
              </Space>
            </Col>
          </Row>
        </FilterContainer>
        
        <Table 
          dataSource={filteredAccounts} 
          columns={columns} 
          rowSelection={rowSelection}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </StyledCard>
      
      {/* 批量开卡模态框 */}
      <BatchCardApplyModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={() => {
          setModalVisible(false);
          fetchAccounts(); // 刷新账户列表
        }}
        accounts={accounts.filter(account => selectedAccountIds.includes(account.id))}
      />
    </PageContainer>
  );
};

export default BatchCardApply;