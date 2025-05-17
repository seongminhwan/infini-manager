/**
 * 批量开卡模态框组件
 * 用于批量为多个账户申请卡片
 * 支持筛选账户、排除已开卡账户、自动基础KYC和刷新不合法KYC信息
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  Button,
  Table,
  Card,
  Space,
  message,
  Row,
  Col,
  Spin,
  Typography,
  Divider,
  Alert,
  Tag,
  Switch,
  Checkbox,
  Progress,
  Result,
  Empty
} from 'antd';
import { 
  LoadingOutlined, 
  CreditCardOutlined, 
  InfoCircleOutlined, 
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  IdcardOutlined,
  SyncOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { infiniAccountApi, randomUserApi, infiniCardApi } from '../services/api';
import styled from 'styled-components';

const { Title, Text, Paragraph } = Typography;

// 样式组件
const StyledCard = styled(Card)`
  margin-bottom: 16px;
`;

// 使用TableProps定义类型
import { TableProps } from 'antd/lib/table';

// 定义样式表格组件，使用TableProps指定泛型
const StyledCardTable = styled(Table)<TableProps<InfiniAccount>>`
  .ant-table-row-selected {
    background-color: #e6f7ff;
  }
`;

const ProgressContainer = styled.div`
  margin: 20px 0;
`;

const StepDescription = styled.div`
  margin-bottom: 16px;
`;

// 接口定义
interface InfiniAccount {
  id: number;
  email: string;
  mock_user_id?: number;
  google_2fa_is_bound?: number;
  google2faIsBound?: boolean;
  verification_level?: number;
  verificationLevel?: number;
  randomUser?: any;
  // 新增字段，用于记录开卡操作结果
  cardApplyStatus?: 'pending' | 'kyc-submitting' | 'kyc-success' | 'kyc-failed' | 'card-applying' | 'card-success' | 'card-failed';
  cardApplyMessage?: string;
  hasCard?: boolean;
}

interface CardInfo {
  card_id: string;
  status: string;
  currency: string;
  card_last_four_digits: string;
}

interface KycInformation {
  id: string;
  first_name: string;
  last_name: string;
  phone_code: string;
  phone: string;
  birthday?: string;
  status?: number;
  is_valid?: boolean;
  type?: number;
}

interface RandomUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  phone_code: string;
  gender: string;
  country: string;
  city: string;
  street: string;
  postal_code: string;
  birth_date: string;
}

interface BatchCardApplyModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BatchCardApplyModal: React.FC<BatchCardApplyModalProps> = ({
  visible,
  onClose,
  onSuccess
}) => {
  // 状态管理
  const [accounts, setAccounts] = useState<InfiniAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [applyLoading, setApplyLoading] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [excludeCardOwners, setExcludeCardOwners] = useState<boolean>(true);
  const [autoRefreshInvalidKyc, setAutoRefreshInvalidKyc] = useState<boolean>(true);
  const [kycType, setKycType] = useState<'basic'>('basic'); // 目前只允许基础KYC
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [cardPrice, setCardPrice] = useState<{price: number, discount: number} | null>(null);
  
  // 获取所有账户
  const fetchAllAccounts = async () => {
    try {
      setLoading(true);
      const response = await infiniAccountApi.getAllInfiniAccounts();
      
      if (response.success) {
        const accountsWithCards = await markAccountsWithCards(response.data);
        setAccounts(accountsWithCards);
        
        // 默认选中所有不拥有卡片的账户
        if (excludeCardOwners) {
          const nonCardOwnerIds = accountsWithCards
            .filter(account => !account.hasCard)
            .map(account => account.id);
          setSelectedAccountIds(nonCardOwnerIds);
        } else {
          setSelectedAccountIds(accountsWithCards.map(account => account.id));
        }
      } else {
        message.error('获取账户列表失败');
      }
    } catch (error: any) {
      message.error(`获取账户列表失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 标记已有卡片的账户
  const markAccountsWithCards = async (accounts: InfiniAccount[]): Promise<InfiniAccount[]> => {
    const accountsWithCardInfo = [...accounts];
    
    await Promise.all(accountsWithCardInfo.map(async (account, index) => {
      try {
        const response = await infiniCardApi.getCardList(account.id.toString());
        accountsWithCardInfo[index].hasCard = response.success && response.data && response.data.length > 0;
      } catch (error) {
        accountsWithCardInfo[index].hasCard = false;
      }
    }));
    
    return accountsWithCardInfo;
  };
  
  // 获取卡片价格
  const fetchCardPrice = async () => {
    try {
      if (accounts.length === 0) return;
      
      // 使用第一个账户ID获取价格，价格应该对所有账户都一样
      const response = await infiniCardApi.getCardPrice(accounts[0].id.toString(), 3);
      
      if (response.success && response.data) {
        setCardPrice({
          price: response.data.price,
          discount: response.data.discount
        });
      }
    } catch (error: any) {
      console.error('获取卡片价格失败:', error);
    }
  };
  
  // 初始化
  useEffect(() => {
    if (visible) {
      fetchAllAccounts();
      setProcessStatus('idle');
      setCurrentProcessingIndex(-1);
      setProgressPercent(0);
      setSuccessCount(0);
      setFailedCount(0);
    }
  }, [visible, excludeCardOwners]);
  
  // 获取卡片价格
  useEffect(() => {
    if (accounts.length > 0) {
      fetchCardPrice();
    }
  }, [accounts]);
  
  // 筛选账户
  const filteredAccounts = useMemo(() => {
    if (!excludeCardOwners) return accounts;
    return accounts.filter(account => !account.hasCard);
  }, [accounts, excludeCardOwners]);
  
  // 获取KYC信息
  const getKycInformation = async (accountId: string): Promise<KycInformation | null> => {
    try {
      console.log(`获取账户 ${accountId} 的KYC信息`);
      const response = await infiniAccountApi.getKycInformation(accountId);
      
      if (response.success && response.data.kyc_information && response.data.kyc_information.length > 0) {
        return response.data.kyc_information[0];
      }
      return null;
    } catch (error) {
      console.error(`获取账户 ${accountId} 的KYC信息失败:`, error);
      return null;
    }
  };
  
  // 获取随机用户信息
  const getRandomUserInfo = async (mockUserId: number): Promise<RandomUser | null> => {
    try {
      if (!mockUserId) return null;
      
      console.log(`获取随机用户信息, ID: ${mockUserId}`);
      const response = await randomUserApi.getRandomUserById(mockUserId.toString());
      
      if (response.success) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error(`获取随机用户信息失败, ID: ${mockUserId}:`, error);
      return null;
    }
  };
  
  // 检查手机号格式是否合法（只包含+1或+86这样的区号和数字）
  const isPhoneNumberValid = (phoneCode: string, phoneNumber: string): boolean => {
    // 手机号应该只包含数字
    const phoneNumberPattern = /^\d+$/;
    // 区号应该是+开头加数字
    const phoneCodePattern = /^\+\d+$/;
    
    return phoneCodePattern.test(phoneCode) && phoneNumberPattern.test(phoneNumber);
  };
  
  // 生成新的随机用户
  const generateNewRandomUser = async (emailSuffix: string): Promise<RandomUser | null> => {
    try {
      console.log(`生成新的随机用户, 邮箱后缀: ${emailSuffix}`);
      const response = await randomUserApi.generateRandomUsers({
        email_suffix: emailSuffix,
        count: 1
      });
      
      if (response.success && response.data && response.data.length > 0) {
        return response.data[0];
      }
      return null;
    } catch (error) {
      console.error(`生成新的随机用户失败:`, error);
      return null;
    }
  };
  
  // 提交KYC基础信息
  const submitKycBasic = async (accountId: string, kycData: any): Promise<boolean> => {
    try {
      console.log(`提交KYC基础信息, 账户ID: ${accountId}`);
      const response = await infiniCardApi.submitKycBasic(accountId, kycData);
      
      return response.success;
    } catch (error) {
      console.error(`提交KYC基础信息失败, 账户ID: ${accountId}:`, error);
      return false;
    }
  };
  
  // 申请新卡
  const applyNewCard = async (accountId: string): Promise<boolean> => {
    try {
      console.log(`申请新卡, 账户ID: ${accountId}`);
      const response = await infiniCardApi.applyNewCard(accountId, 3, 6.6, 3.3);
      
      return response.success;
    } catch (error) {
      console.error(`申请新卡失败, 账户ID: ${accountId}:`, error);
      return false;
    }
  };
  
  // 批量开卡处理
  const handleBatchCardApply = async () => {
    if (selectedAccountIds.length === 0) {
      message.warning('请选择至少一个账户');
      return;
    }
    
    try {
      setApplyLoading(true);
      setProcessStatus('processing');
      setCurrentProcessingIndex(0);
      setProgressPercent(0);
      setSuccessCount(0);
      setFailedCount(0);
      
      // 克隆账户列表，用于更新状态
      const updatedAccounts = [...accounts];
      
      // 获取所选账户
      const selectedAccounts = accounts.filter(account => selectedAccountIds.includes(account.id));
      
      // 处理每个账户
      for (let i = 0; i < selectedAccounts.length; i++) {
        const account = selectedAccounts[i];
        const accountId = account.id.toString();
        const accountIndex = accounts.findIndex(a => a.id === account.id);
        
        // 更新进度
        setCurrentProcessingIndex(i);
        setProgressPercent(Math.floor((i / selectedAccounts.length) * 100));
        
        // 处理KYC信息
        updatedAccounts[accountIndex].cardApplyStatus = 'kyc-submitting';
        setAccounts([...updatedAccounts]);
        
        let kycInfo = await getKycInformation(accountId);
        let mockUser = account.mock_user_id ? await getRandomUserInfo(account.mock_user_id) : null;
        
        // 如果需要刷新无效的KYC信息
        if (autoRefreshInvalidKyc && kycInfo && (!isPhoneNumberValid(kycInfo.phone_code, kycInfo.phone))) {
          console.log(`账户 ${accountId} 的KYC信息无效，尝试刷新`);
          
          // 如果有mock_user_id但获取失败，或者手机号格式不正确，生成新的随机用户
          if (!mockUser || !isPhoneNumberValid(mockUser.phone_code, mockUser.phone)) {
            const emailParts = account.email.split('@');
            const emailSuffix = emailParts.length > 1 ? `@${emailParts[1]}` : '@example.com';
            mockUser = await generateNewRandomUser(emailSuffix);
          }
        }
        
        // 准备KYC数据
        let kycData;
        if (mockUser) {
          kycData = {
            first_name: mockUser.first_name,
            last_name: mockUser.last_name,
            phone_code: mockUser.phone_code,
            phone_number: mockUser.phone,
            birthday: mockUser.birth_date || "1990-01-01"
          };
        } else if (kycInfo) {
          kycData = {
            first_name: kycInfo.first_name,
            last_name: kycInfo.last_name,
            phone_code: kycInfo.phone_code,
            phone_number: kycInfo.phone,
            birthday: kycInfo.birthday || "1990-01-01"
          };
        } else {
          // 如果没有KYC信息和随机用户信息，标记为失败
          updatedAccounts[accountIndex].cardApplyStatus = 'kyc-failed';
          updatedAccounts[accountIndex].cardApplyMessage = '无法获取KYC信息和随机用户信息';
          setFailedCount(prev => prev + 1);
          setAccounts([...updatedAccounts]);
          continue;
        }
        
        // 提交KYC基础信息
        const kycSuccess = await submitKycBasic(accountId, kycData);
        
        if (kycSuccess) {
          updatedAccounts[accountIndex].cardApplyStatus = 'kyc-success';
          setAccounts([...updatedAccounts]);
          
          // 申请新卡
          updatedAccounts[accountIndex].cardApplyStatus = 'card-applying';
          setAccounts([...updatedAccounts]);
          
          const cardSuccess = await applyNewCard(accountId);
          
          if (cardSuccess) {
            updatedAccounts[accountIndex].cardApplyStatus = 'card-success';
            updatedAccounts[accountIndex].cardApplyMessage = '开卡成功';
            updatedAccounts[accountIndex].hasCard = true;
            setSuccessCount(prev => prev + 1);
          } else {
            updatedAccounts[accountIndex].cardApplyStatus = 'card-failed';
            updatedAccounts[accountIndex].cardApplyMessage = '申请卡片失败';
            setFailedCount(prev => prev + 1);
          }
        } else {
          updatedAccounts[accountIndex].cardApplyStatus = 'kyc-failed';
          updatedAccounts[accountIndex].cardApplyMessage = '提交KYC信息失败';
          setFailedCount(prev => prev + 1);
        }
        
        setAccounts([...updatedAccounts]);
      }
      
      // 更新最终进度
      setProgressPercent(100);
      setProcessStatus('completed');
      
      // 显示结果
      if (successCount === selectedAccounts.length) {
        message.success(`批量开卡完成，成功为${successCount}个账户开通了卡片`);
      } else {
        message.warning(`批量开卡完成，成功: ${successCount}，失败: ${failedCount}`);
      }
      
      // 通知父组件成功
      if (successCount > 0) {
        onSuccess();
      }
    } catch (error: any) {
      setProcessStatus('error');
      message.error(`批量开卡过程中发生错误: ${error.message}`);
    } finally {
      setApplyLoading(false);
    }
  };
  
  // 表格列定义
  const columns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
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
          <Tag color="green">已有卡片</Tag> : 
          <Tag color="gray">无卡片</Tag>;
      }
    },
    {
      title: '开卡进度',
      key: 'cardApplyStatus',
      render: (record: InfiniAccount) => {
        switch (record.cardApplyStatus) {
          case 'kyc-submitting':
            return <><SyncOutlined spin /> 提交KYC信息中...</>;
          case 'kyc-success':
            return <><CheckCircleOutlined style={{ color: 'green' }} /> KYC信息已提交</>;
          case 'kyc-failed':
            return <><ExclamationCircleOutlined style={{ color: 'red' }} /> KYC信息提交失败</>;
          case 'card-applying':
            return <><SyncOutlined spin /> 申请卡片中...</>;
          case 'card-success':
            return <><CheckCircleOutlined style={{ color: 'green' }} /> 开卡成功</>;
          case 'card-failed':
            return <><ExclamationCircleOutlined style={{ color: 'red' }} /> 开卡失败</>;
          default:
            return '-';
        }
      }
    },
    {
      title: '状态消息',
      dataIndex: 'cardApplyMessage',
      key: 'cardApplyMessage',
      render: (message: string) => message || '-'
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
  
  // 渲染进度条
  const renderProgress = () => {
    const selectedAccounts = accounts.filter(account => selectedAccountIds.includes(account.id));
    
    if (processStatus === 'idle') {
      return null;
    }
    
    return (
      <ProgressContainer>
        <Progress 
          percent={progressPercent} 
          status={processStatus === 'error' ? 'exception' : undefined} 
          format={() => `${successCount + failedCount}/${selectedAccounts.length}`} 
        />
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">
            处理进度: 成功 {successCount} 个, 失败 {failedCount} 个
            {currentProcessingIndex >= 0 && currentProcessingIndex < selectedAccounts.length && (
              <span>, 当前处理: {selectedAccounts[currentProcessingIndex].email}</span>
            )}
          </Text>
        </div>
      </ProgressContainer>
    );
  };
  
  // 渲染结果摘要
  const renderResultSummary = () => {
    if (processStatus !== 'completed' && processStatus !== 'error') {
      return null;
    }
    
    return (
      <StyledCard>
        <Result
          status={processStatus === 'error' ? 'error' : (successCount > 0 ? 'success' : 'warning')}
          title={
            processStatus === 'error' 
              ? "批量开卡过程中发生错误" 
              : `批量开卡完成，成功: ${successCount}，失败: ${failedCount}`
          }
          subTitle="详细结果请查看下方表格"
        />
      </StyledCard>
    );
  };
  
  return (
    <Modal
      title="批量开卡"
      open={visible}
      onCancel={onClose}
      width={1000}
      footer={[
        <Button key="cancel" onClick={onClose}>
          关闭
        </Button>,
        <Button
          key="apply"
          type="primary"
          icon={<CreditCardOutlined />}
          loading={applyLoading}
          onClick={handleBatchCardApply}
          disabled={selectedAccountIds.length === 0 || processStatus === 'processing' || processStatus === 'completed'}
        >
          {processStatus === 'completed' ? '已完成' : '确认批量开卡'}
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
        <StyledCard>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={5}>批量开卡设置</Title>
            
            <Row gutter={16}>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>筛选选项:</Text>
                  <div style={{ marginTop: 8 }}>
                    <Checkbox 
                      checked={excludeCardOwners} 
                      onChange={(e) => setExcludeCardOwners(e.target.checked)}
                    >
                      排除已有卡片的账户
                    </Checkbox>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ marginBottom: 16 }}>
                  <Text strong>KYC选项:</Text>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ marginBottom: 8 }}>
                      <Text>KYC类型: </Text>
                      <Tag color="blue">基础KYC</Tag>
                      <Text type="secondary">(当前仅支持基础KYC)</Text>
                    </div>
                    <div>
                      <Checkbox 
                        checked={autoRefreshInvalidKyc} 
                        onChange={(e) => setAutoRefreshInvalidKyc(e.target.checked)}
                        disabled={true} // 不允许取消选中
                      >
                        自动刷新不合法的KYC信息
                      </Checkbox>
                    </div>
                  </div>
                </div>
              </Col>
            </Row>
            
            {cardPrice && (
              <Alert
                message="卡片信息"
                description={
                  <div>
                    <p>卡片类型: Card 3</p>
                    <p>卡片价格: ${cardPrice.price.toFixed(2)}</p>
                    <p>折扣金额: ${cardPrice.discount.toFixed(2)}</p>
                  </div>
                }
                type="info"
                showIcon
              />
            )}
          </Space>
        </StyledCard>
        
        {renderResultSummary()}
        
        {renderProgress()}
        
        <StyledCard>
          <Title level={5}>账户列表</Title>
          {filteredAccounts.length > 0 ? (
            <StyledCardTable
              rowSelection={{
                selectedRowKeys: selectedAccountIds,
                onChange: (selectedRowKeys: React.Key[]) => {
                  setSelectedAccountIds(selectedRowKeys as number[]);
                },
                getCheckboxProps: (record: InfiniAccount) => ({
                  disabled: excludeCardOwners && record.hasCard, // 如果排除已有卡片的账户，则禁用它们的选择
                }),
              }}
              columns={columns as any}
              dataSource={filteredAccounts}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              size="middle"
            />
          ) : (
            <Empty description="没有符合条件的账户" />
          )}
        </StyledCard>
      </Spin>
    </Modal>
  );
};

export default BatchCardApplyModal;