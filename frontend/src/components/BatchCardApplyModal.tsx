/**
 * 批量开卡模态框组件
 * 用于批量为多个账户申请卡片
 * 支持分步骤操作：1.选择账户 2.配置参数 3.执行开卡
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
  Checkbox,
  Progress,
  Result,
  Empty,
  Steps,
  Radio,
  Transfer,
  List,
  Avatar,
  Tooltip
} from 'antd';
import { TableProps } from 'antd/lib/table';
import { 
  LoadingOutlined, 
  CreditCardOutlined, 
  InfoCircleOutlined, 
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  IdcardOutlined,
  SyncOutlined,
  FilterOutlined,
  ArrowRightOutlined,
  SettingOutlined,
  UserOutlined,
  CheckOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';
import { TransferDirection } from 'antd/lib/transfer';
import { Key as TransferKey } from 'rc-table/lib/interface';
import { infiniAccountApi, randomUserApi, infiniCardApi } from '../services/api';
import styled from 'styled-components';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

// 样式组件
const StyledCard = styled(Card)`
  margin-bottom: 16px;
`;

const ProgressContainer = styled.div`
  margin: 20px 0;
`;

const StepContainer = styled.div`
  margin: 20px 0;
`;

const TransferContainer = styled.div`
  margin-top: 20px;
`;

const AccountItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const StatusTag = styled(Tag)`
  margin-left: 8px;
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
  balance?: string;
  // 新增字段，用于记录开卡操作结果
  cardApplyStatus?: 'pending' | 'kyc-submitting' | 'kyc-success' | 'kyc-failed' | 'card-applying' | 'card-success' | 'card-failed';
  cardApplyMessage?: string;
  hasCard?: boolean;
  cardCount?: number;
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

interface CardPrice {
  price: number;
  discount: number;
}

interface BatchCardApplyModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  accounts: InfiniAccount[];
}

const BatchCardApplyModal: React.FC<BatchCardApplyModalProps> = ({
  visible,
  onClose,
  onSuccess,
  accounts
}) => {
  // 当前步骤
  const [currentStep, setCurrentStep] = useState<number>(0);
  
  // 状态管理
  const [loading, setLoading] = useState<boolean>(false);
  const [applyLoading, setApplyLoading] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [targetKeys, setTargetKeys] = useState<TransferKey[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<InfiniAccount[]>([]);
  const [excludeCardOwners, setExcludeCardOwners] = useState<boolean>(true);
  const [selectedAccounts, setSelectedAccounts] = useState<InfiniAccount[]>([]);
  
  // 配置选项
  const [kycType, setKycType] = useState<'basic'>('basic'); // 目前只允许基础KYC
  const [cardType, setCardType] = useState<number>(3); // 默认Card 3
  const [autoRefreshInvalidKyc, setAutoRefreshInvalidKyc] = useState<boolean>(true);
  const [autoRetryWithNewRandomUser, setAutoRetryWithNewRandomUser] = useState<boolean>(true);
  
  // 执行状态
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [cardPrice, setCardPrice] = useState<CardPrice | null>(null);
  const [updatedAccounts, setUpdatedAccounts] = useState<InfiniAccount[]>([]);
  
  // 步骤定义
  const steps = [
    {
      title: '选择账户',
      description: '选择需要批量开卡的账户',
      icon: <UserOutlined />
    },
    {
      title: '配置参数',
      description: '设置KYC类型和开卡选项',
      icon: <SettingOutlined />
    },
    {
      title: '执行开卡',
      description: '批量执行开卡操作',
      icon: <CreditCardOutlined />
    }
  ];
  
  // 初始化
  useEffect(() => {
    if (visible) {
      loadInitialData();
    }
  }, [visible]);
  
  // 当excludeCardOwners变化时，重新筛选账户
  useEffect(() => {
    filterAccounts();
  }, [excludeCardOwners, accounts]);
  
  // 获取卡片价格
  useEffect(() => {
    if (accounts.length > 0) {
      fetchCardPrice();
    }
  }, [accounts]);
  
  // 当targetKeys变化时，更新selectedAccounts
  useEffect(() => {
    const selected = accounts.filter(account => 
      targetKeys.includes(account.id.toString() as TransferKey)
    );
    setSelectedAccounts(selected);
    
    // 如果进入第三步，预设更新数组
    if (currentStep === 2) {
      setUpdatedAccounts([...selected]);
    }
  }, [targetKeys, accounts, currentStep]);
  
  // 初始化加载数据
  const loadInitialData = () => {
    setCurrentStep(0);
    setTargetKeys([]);
    setProcessStatus('idle');
    setSuccessCount(0);
    setFailedCount(0);
    setCurrentProcessingIndex(-1);
    setProgressPercent(0);
    filterAccounts();
  };
  
  // 筛选账户
  const filterAccounts = () => {
    if (!accounts) return;
    
    let filtered = [...accounts];
    if (excludeCardOwners) {
      filtered = filtered.filter(account => !account.hasCard);
    }
    
    setFilteredAccounts(filtered);
  };
  
  // 获取卡片价格
  const fetchCardPrice = async () => {
    try {
      if (accounts.length === 0) return;
      
      setLoading(true);
      // 使用第一个账户ID获取价格，价格应该对所有账户都一样
      const response = await infiniCardApi.getCardPrice(accounts[0].id.toString(), cardType);
      
      if (response.success && response.data) {
        setCardPrice({
          price: response.data.price,
          discount: response.data.discount
        });
      }
    } catch (error: any) {
      console.error('获取卡片价格失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 获取验证级别文本
  const getVerificationLevelText = (account: InfiniAccount): string => {
    const level = account.verification_level !== undefined 
      ? account.verification_level 
      : account.verificationLevel;
    
    if (level === 2) return '已完成KYC';
    if (level === 1) return '基础认证';
    if (level === 3) return '认证中';
    return '未认证';
  };
  
  // 转换数据以适应Transfer组件
  const transferData = filteredAccounts.map(account => ({
    key: account.id.toString(),
    title: account.email,
    description: `${account.balance ? '$' + parseFloat(account.balance).toFixed(2) : '余额未知'} | ${getVerificationLevelText(account)}`,
    disabled: excludeCardOwners && account.hasCard
  }));
  
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
  
  // 检查手机号格式是否合法
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
      const response = await infiniCardApi.applyNewCard(
        accountId, 
        cardType, 
        cardPrice?.price || 6.6, 
        cardPrice?.discount || 3.3
      );
      
      return response.success;
    } catch (error) {
      console.error(`申请新卡失败, 账户ID: ${accountId}:`, error);
      return false;
    }
  };
  
  // 更新账户状态
  const updateAccountStatus = (index: number, status: InfiniAccount['cardApplyStatus'], message?: string) => {
    const newAccounts = [...updatedAccounts];
    newAccounts[index].cardApplyStatus = status;
    if (message) {
      newAccounts[index].cardApplyMessage = message;
    }
    setUpdatedAccounts(newAccounts);
  };
  
  // 批量开卡处理
  const handleBatchCardApply = async () => {
    if (selectedAccounts.length === 0) {
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
      
      // 处理每个账户
      for (let i = 0; i < selectedAccounts.length; i++) {
        const account = selectedAccounts[i];
        const accountId = account.id.toString();
        
        // 更新进度
        setCurrentProcessingIndex(i);
        setProgressPercent(Math.floor((i / selectedAccounts.length) * 100));
        
        // 处理KYC信息
        updateAccountStatus(i, 'kyc-submitting');
        
        let kycInfo = await getKycInformation(accountId);
        let mockUser = account.mock_user_id ? await getRandomUserInfo(account.mock_user_id) : null;
        let needRefreshRandomUser = false;
        
        // 检查是否需要刷新随机用户信息
        if (autoRefreshInvalidKyc && kycInfo && (!isPhoneNumberValid(kycInfo.phone_code, kycInfo.phone))) {
          console.log(`账户 ${accountId} 的KYC信息无效，需要刷新`);
          needRefreshRandomUser = true;
        }
        
        // 如果有mock_user_id但获取失败，或者手机号格式不正确，生成新的随机用户
        if (needRefreshRandomUser || !mockUser || (mockUser && !isPhoneNumberValid(mockUser.phone_code, mockUser.phone))) {
          if (autoRetryWithNewRandomUser) {
            const emailParts = account.email.split('@');
            const emailSuffix = emailParts.length > 1 ? `@${emailParts[1]}` : '@example.com';
            mockUser = await generateNewRandomUser(emailSuffix);
          } else if (!mockUser) {
            // 如果不允许自动生成新随机用户，且现有随机用户无效，则标记失败
            updateAccountStatus(i, 'kyc-failed', '无法获取有效的用户信息且未启用自动生成');
            setFailedCount(prev => prev + 1);
            continue;
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
          updateAccountStatus(i, 'kyc-failed', '无法获取KYC信息和随机用户信息');
          setFailedCount(prev => prev + 1);
          continue;
        }
        
        // 提交KYC基础信息
        const kycSuccess = await submitKycBasic(accountId, kycData);
        
        if (kycSuccess) {
          updateAccountStatus(i, 'kyc-success');
          
          // 申请新卡
          updateAccountStatus(i, 'card-applying');
          
          const cardSuccess = await applyNewCard(accountId);
          
          if (cardSuccess) {
            updateAccountStatus(i, 'card-success', '开卡成功');
            setSuccessCount(prev => prev + 1);
          } else {
            updateAccountStatus(i, 'card-failed', '申请卡片失败');
            setFailedCount(prev => prev + 1);
          }
        } else {
          updateAccountStatus(i, 'kyc-failed', '提交KYC信息失败');
          setFailedCount(prev => prev + 1);
        }
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
  
  // 处理 Transfer 变化
  const handleChange = (nextTargetKeys: TransferKey[], direction: TransferDirection, moveKeys: TransferKey[]) => {
    setTargetKeys(nextTargetKeys);
  };
  
  // 步骤切换
  const goToNextStep = () => {
    if (currentStep === 0 && targetKeys.length === 0) {
      message.warning('请至少选择一个账户');
      return;
    }
    
    const nextStep = currentStep + 1;
    if (nextStep <= 2) {
      setCurrentStep(nextStep);
    }
  };
  
  const goToPrevStep = () => {
    const prevStep = currentStep - 1;
    if (prevStep >= 0) {
      setCurrentStep(prevStep);
      if (prevStep < 2) {
        setProcessStatus('idle');
      }
    }
  };
  
  // 渲染进度条
  const renderProgress = () => {
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
          subTitle="详细结果请查看下方列表"
        />
      </StyledCard>
    );
  };
  
  // 渲染账户列表（步骤1）
  const renderAccountSelection = () => {
    return (
      <>
        <StyledCard>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Title level={5}>账户筛选</Title>
            <Checkbox 
              checked={excludeCardOwners} 
              onChange={(e) => setExcludeCardOwners(e.target.checked)}
            >
              排除已有卡片的账户
            </Checkbox>
          </Space>
        </StyledCard>
        
        <TransferContainer>
          <Transfer
            dataSource={transferData}
            titles={['可选账户', '已选账户']}
            targetKeys={targetKeys}
            onChange={handleChange}
            render={item => (
              <AccountItem>
                <div>{item.title}</div>
                <div>{item.description}</div>
              </AccountItem>
            )}
            listStyle={{
              width: '100%',
              height: 400,
            }}
            operations={['添加到已选', '移除']}
            showSearch
            filterOption={(inputValue, item) => 
              item.title.indexOf(inputValue) !== -1 || 
              item.description.indexOf(inputValue) !== -1
            }
            locale={{
              searchPlaceholder: '搜索账户',
              notFoundContent: '没有符合条件的账户'
            }}
          />
        </TransferContainer>
        
        <div style={{ marginTop: 20 }}>
          <Text>已选择 {targetKeys.length} 个账户</Text>
        </div>
      </>
    );
  };
  
  // 渲染设置配置（步骤2）
  const renderSettings = () => {
    return (
      <StyledCard>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Title level={5}>开卡配置</Title>
          
          <div style={{ marginBottom: 20 }}>
            <Title level={5}>KYC选项</Title>
            <Radio.Group 
              value={kycType}
              onChange={(e) => setKycType(e.target.value)}
              disabled={true} // 目前只支持基础KYC
            >
              <Space direction="vertical">
                <Radio value="basic">
                  基础KYC <Tag color="blue">推荐</Tag>
                  <div><Text type="secondary">（当前仅支持基础KYC）</Text></div>
                </Radio>
              </Space>
            </Radio.Group>
          </div>
          
          <div style={{ marginBottom: 20 }}>
            <Title level={5}>卡片类型</Title>
            <Radio.Group 
              value={cardType}
              onChange={(e) => {
                setCardType(e.target.value);
                fetchCardPrice();
              }}
              disabled={true} // 目前固定为Card 3
            >
              <Space direction="vertical">
                <Radio value={3}>
                  Card 3 <Tag color="blue">推荐</Tag>
                  <div><Text type="secondary">（当前固定为Card 3）</Text></div>
                </Radio>
              </Space>
            </Radio.Group>
          </div>
          
          {cardPrice && (
            <Alert
              message="卡片信息"
              description={
                <div>
                  <p>卡片类型: Card {cardType}</p>
                  <p>卡片价格: ${cardPrice.price.toFixed(2)}</p>
                  <p>折扣金额: ${cardPrice.discount.toFixed(2)}</p>
                </div>
              }
              type="info"
              showIcon
            />
          )}
          
          <Divider />
          
          <div style={{ marginBottom: 20 }}>
            <Title level={5}>高级选项</Title>
            <div style={{ marginBottom: 10 }}>
              <Checkbox 
                checked={autoRefreshInvalidKyc} 
                onChange={(e) => setAutoRefreshInvalidKyc(e.target.checked)}
                disabled={true} // 不允许取消选中
              >
                自动刷新不合法的KYC信息 <Tag color="red">必选</Tag>
              </Checkbox>
              <div><Text type="secondary">（检测到不合法的KYC信息时会尝试修复）</Text></div>
            </div>
            
            <div>
              <Checkbox 
                checked={autoRetryWithNewRandomUser} 
                onChange={(e) => setAutoRetryWithNewRandomUser(e.target.checked)}
              >
                失败时自动生成新的随机用户
              </Checkbox>
              <div><Text type="secondary">（如果KYC信息无效且无法修复，自动生成新的随机用户数据）</Text></div>
            </div>
          </div>
          
          <Divider />
          
          <Alert
            message="批量开卡信息确认"
            description={
              <div>
                <p>将为 <b>{targetKeys.length}</b> 个账户批量开卡</p>
                <p>开卡类型: Card {cardType}</p>
                <p>KYC类型: 基础KYC</p>
                <p>自动刷新不合法KYC: {autoRefreshInvalidKyc ? '是' : '否'}</p>
                <p>失败时自动生成随机用户: {autoRetryWithNewRandomUser ? '是' : '否'}</p>
              </div>
            }
            type="warning"
            showIcon
          />
        </Space>
      </StyledCard>
    );
  };
  
  // 渲染执行结果（步骤3）
  const renderExecution = () => {
    return (
      <>
        {renderResultSummary()}
        
        {renderProgress()}
        
        <StyledCard>
          <Title level={5}>开卡结果</Title>
          {updatedAccounts.length > 0 ? (
            <List
              itemLayout="horizontal"
              dataSource={updatedAccounts}
              renderItem={(account, index) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<Avatar icon={<UserOutlined />} />}
                    title={account.email}
                    description={
                      <Space>
                        {renderAccountStatus(account)}
                        {account.cardApplyMessage && <Text type="secondary">{account.cardApplyMessage}</Text>}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          ) : (
            <Empty description="没有处理记录" />
          )}
        </StyledCard>
      </>
    );
  };
  
  // 渲染账户状态标签
  const renderAccountStatus = (account: InfiniAccount) => {
    switch (account.cardApplyStatus) {
      case 'kyc-submitting':
        return <StatusTag icon={<SyncOutlined spin />} color="processing">提交KYC信息中</StatusTag>;
      case 'kyc-success':
        return <StatusTag icon={<CheckCircleOutlined />} color="success">KYC信息已提交</StatusTag>;
      case 'kyc-failed':
        return <StatusTag icon={<ExclamationCircleOutlined />} color="error">KYC信息提交失败</StatusTag>;
      case 'card-applying':
        return <StatusTag icon={<SyncOutlined spin />} color="processing">申请卡片中</StatusTag>;
      case 'card-success':
        return <StatusTag icon={<CheckCircleOutlined />} color="success">开卡成功</StatusTag>;
      case 'card-failed':
        return <StatusTag icon={<ExclamationCircleOutlined />} color="error">开卡失败</StatusTag>;
      default:
        return <StatusTag color="default">等待处理</StatusTag>;
    }
  };
  
  // 根据当前步骤渲染内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderAccountSelection();
      case 1:
        return renderSettings();
      case 2:
        return renderExecution();
      default:
        return null;
    }
  };
  
  // 渲染步骤按钮
  const renderStepActions = () => {
    if (currentStep === 0) {
      return (
        <Button type="primary" onClick={goToNextStep} disabled={targetKeys.length === 0}>
          下一步 <RightOutlined />
        </Button>
      );
    } else if (currentStep === 1) {
      return (
        <>
          <Button style={{ marginRight: 8 }} onClick={goToPrevStep}>
            <LeftOutlined /> 上一步
          </Button>
          <Button type="primary" onClick={goToNextStep}>
            下一步 <RightOutlined />
          </Button>
        </>
      );
    } else if (currentStep === 2) {
      return (
        <>
          <Button 
            style={{ marginRight: 8 }} 
            onClick={goToPrevStep}
            disabled={processStatus === 'processing'}
          >
            <LeftOutlined /> 上一步
          </Button>
          <Button
            type="primary"
            icon={<CreditCardOutlined />}
            loading={applyLoading}
            onClick={handleBatchCardApply}
            disabled={
              targetKeys.length === 0 || 
              processStatus === 'processing' || 
              processStatus === 'completed'
            }
          >
            {processStatus === 'completed' ? '已完成' : '开始批量开卡'}
          </Button>
        </>
      );
    }
    return null;
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
        <span key="actions">{renderStepActions()}</span>
      ]}
    >
      <Spin spinning={loading}>
        <StepContainer>
          <Steps current={currentStep}>
            {steps.map(item => (
              <Step 
                key={item.title} 
                title={item.title} 
                description={item.description} 
                icon={item.icon}
              />
            ))}
          </Steps>
        </StepContainer>
        
        {renderStepContent()}
      </Spin>
    </Modal>
  );
};

export default BatchCardApplyModal;