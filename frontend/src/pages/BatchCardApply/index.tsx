/**
 * 批量开卡页面
 * 用于批量为多个Infini账户申请卡片
 * 实现三步流程：1.选择账户 2.配置参数 3.执行开卡
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
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
  Spin,
  message,
  Row,
  Col,
  Input,
  InputNumber,
  DatePicker,
  Select
} from 'antd';
import { 
  CreditCardOutlined, 
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  SettingOutlined,
  UserOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { TransferDirection } from 'antd/lib/transfer';
import { Key as TransferKey } from 'rc-table/lib/interface';
import { infiniAccountApi, randomUserApi, infiniCardApi } from '../../services/api';

const { Title, Text } = Typography;
const { Step } = Steps;

// 样式组件
const PageContainer = styled.div`
  padding: 24px;
`;

const StyledCard = styled(Card)`
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

const BatchCardApply: React.FC = () => {
  // 当前步骤
  const [currentStep, setCurrentStep] = useState<number>(0);
  
  // 状态管理
  const [loading, setLoading] = useState<boolean>(false);
  const [applyLoading, setApplyLoading] = useState<boolean>(false);
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [targetKeys, setTargetKeys] = useState<TransferKey[]>([]);
  const [accounts, setAccounts] = useState<InfiniAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<InfiniAccount[]>([]);
  const [excludeCardOwners, setExcludeCardOwners] = useState<boolean>(true);
  const [selectedAccounts, setSelectedAccounts] = useState<InfiniAccount[]>([]);
  
  // 配置选项
  const [kycType, setKycType] = useState<'basic'>('basic'); // 目前只允许基础KYC
  const [cardType, setCardType] = useState<number>(3); // 默认Card 3
  const [autoRefreshInvalidKyc, setAutoRefreshInvalidKyc] = useState<boolean>(true);
  const [autoRetryWithNewRandomUser, setAutoRetryWithNewRandomUser] = useState<boolean>(true);
  
  // 筛选条件状态
  const [filters, setFilters] = useState<{
    minBalance?: number;
    maxBalance?: number;
    username?: string;
    usernameRegex?: string;
    registerDate?: any; // DatePicker.RangePicker的返回值
    minRedPacket?: number;
    maxRedPacket?: number;
    verificationLevels?: number[];
  }>({});
  
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
  
  // 初始加载
  useEffect(() => {
    fetchAccounts();
  }, []);
  
  // 当筛选条件变化时，重新筛选账户
  useEffect(() => {
    filterAccounts();
  }, [excludeCardOwners, accounts, filters]);
  
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
  
  // 筛选账户
  const filterAccounts = () => {
    if (!accounts) return;
    
    let filtered = [...accounts];
    
    // 基础筛选 - 排除已有卡片的账户
    if (excludeCardOwners) {
      filtered = filtered.filter(account => !account.hasCard);
    }
    
    // 高级筛选条件 - 支持单边区间值
    if (filters.minBalance !== undefined && filters.minBalance !== null) {
      filtered = filtered.filter(account => 
        account.balance && parseFloat(account.balance) >= filters.minBalance!
      );
    }
    
    if (filters.maxBalance !== undefined && filters.maxBalance !== null) {
      filtered = filtered.filter(account => 
        account.balance && parseFloat(account.balance) <= filters.maxBalance!
      );
    }
    
    if (filters.username) {
      filtered = filtered.filter(account => 
        account.email.toLowerCase().includes(filters.username?.toLowerCase() || '')
      );
    }
    
    if (filters.usernameRegex) {
      try {
        const regex = new RegExp(filters.usernameRegex);
        filtered = filtered.filter(account => regex.test(account.email));
      } catch (error) {
        // 忽略无效的正则表达式
        console.error('无效的正则表达式:', filters.usernameRegex);
      }
    }
    
    if (filters.verificationLevels && filters.verificationLevels.length > 0) {
      filtered = filtered.filter(account => {
        const level = account.verification_level !== undefined 
          ? account.verification_level 
          : account.verificationLevel;
        return filters.verificationLevels?.includes(level || 0);
      });
    }
    
    // 注意：红包余额和注册时间筛选仅作为UI展示
    // 实际筛选需要后端支持或在InfiniAccount接口中添加相应属性
    
    setFilteredAccounts(filtered);
  };
  
  // 处理筛选条件变更
  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // 应用筛选条件
  const applyFilters = () => {
    filterAccounts();
    // 清空已选账户，确保筛选后不保留不符合条件的账户
    setTargetKeys([]);
    message.success('筛选条件已应用');
  };
  
  // 重置筛选条件
  const resetFilters = () => {
    setFilters({});
    setExcludeCardOwners(true);
    filterAccounts();
    message.success('筛选条件已重置');
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
  
  // 提交KYC生日信息
  const submitKycBirthday = async (accountId: string, birthday: string): Promise<boolean> => {
    try {
      console.log(`提交KYC生日信息, 账户ID: ${accountId}, 生日: ${birthday}`);
      const response = await infiniCardApi.submitKycBirthday(accountId, birthday);
      
      return response.success;
    } catch (error) {
      console.error(`提交KYC生日信息失败, 账户ID: ${accountId}:`, error);
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
        
        // 获取验证级别
        const verificationLevel = account.verification_level !== undefined 
          ? account.verification_level 
          : account.verificationLevel;
        
        // 检查账户是否已完成KYC或基础KYC
        if (verificationLevel === 1 || verificationLevel === 2) {
          // 账户已完成KYC或基础KYC，直接跳过KYC提交步骤
          console.log(`账户 ${accountId} 已完成KYC验证(级别${verificationLevel})，跳过KYC提交步骤`);
          updateAccountStatus(i, 'kyc-success', '已完成KYC验证');
          
          // 提交KYC生日信息
          try {
            console.log(`账户 ${accountId} 已完成KYC验证(级别${verificationLevel})，提交KYC生日信息`);
            // 使用默认生日或从mockUser获取
            const birthday = account.mock_user_id 
              ? (await getRandomUserInfo(account.mock_user_id))?.birth_date || "1990-01-01"
              : "1990-01-01";
            await submitKycBirthday(accountId, birthday);
            // 即使提交生日信息失败也继续执行开卡
          } catch (error) {
            console.error(`提交KYC生日信息时发生异常, 账户ID: ${accountId}:`, error);
            // 记录错误但不中断流程
          }
          
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
          // 账户未完成KYC，需要提交KYC信息
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
          
          // 提交KYC基础信息，并捕获异常
          let kycSuccess = false;
          try {
            kycSuccess = await submitKycBasic(accountId, kycData);
          } catch (error) {
            console.error(`提交KYC信息时发生异常, 账户ID: ${accountId}:`, error);
            // 记录KYC提交失败，但不中断流程
            updateAccountStatus(i, 'kyc-failed', '提交KYC信息失败，仍继续开卡');
          }
          
          if (kycSuccess) {
            updateAccountStatus(i, 'kyc-success');
          } else {
            updateAccountStatus(i, 'kyc-failed', '提交KYC信息失败，仍继续开卡');
          }
          
          // 提交KYC生日信息，并捕获异常
          try {
            const birthday = kycData.birthday || "1990-01-01";
            await submitKycBirthday(accountId, birthday);
            // 即使提交生日信息失败也继续执行开卡
          } catch (error) {
            console.error(`提交KYC生日信息时发生异常, 账户ID: ${accountId}:`, error);
            // 记录错误但不中断流程
          }
          
          // 无论KYC成功与否，都继续申请新卡
          updateAccountStatus(i, 'card-applying');
          
          let cardSuccess = false;
          try {
            cardSuccess = await applyNewCard(accountId);
            
            if (cardSuccess) {
              updateAccountStatus(i, 'card-success', '开卡成功');
              setSuccessCount(prev => prev + 1);
            } else {
              updateAccountStatus(i, 'card-failed', '申请卡片失败');
              setFailedCount(prev => prev + 1);
            }
          } catch (error) {
            console.error(`申请卡片时发生异常, 账户ID: ${accountId}:`, error);
            updateAccountStatus(i, 'card-failed', '申请卡片失败');
            setFailedCount(prev => prev + 1);
          }
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
  
  // 刷新账户列表
  const handleRefresh = () => {
    fetchAccounts();
    setTargetKeys([]);
    setProcessStatus('idle');
    setSuccessCount(0);
    setFailedCount(0);
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Title level={5}>账户筛选</Title>
              <Button 
                onClick={handleRefresh}
                loading={loading}
                size="small"
              >
                刷新账户列表
              </Button>
            </div>
            
            <Checkbox 
              checked={excludeCardOwners} 
              onChange={(e) => setExcludeCardOwners(e.target.checked)}
              style={{ marginBottom: 8 }}
            >
              排除已有卡片的账户
            </Checkbox>
            
            <Divider orientation="left" style={{ margin: '8px 0' }}>高级筛选</Divider>
            
            <Row gutter={[6, 6]}>
              {/* 余额筛选 */}
              <Col span={8}>
                <Title level={5} style={{ fontSize: 13, marginBottom: 2 }}>余额</Title>
                <Space>
                  <InputNumber 
                    placeholder="最小余额" 
                    min={0} 
                    style={{ width: 120 }} 
                    onChange={(value) => handleFilterChange('minBalance', value)}
                  />
                  <span>至</span>
                  <InputNumber 
                    placeholder="最大余额" 
                    min={0} 
                    style={{ width: 120 }} 
                    onChange={(value) => handleFilterChange('maxBalance', value)}
                  />
                </Space>
              </Col>
              
              {/* 用户名筛选 */}
              <Col span={8}>
                <Title level={5} style={{ fontSize: 13, marginBottom: 2 }}>用户名</Title>
                <Input 
                  placeholder="输入关键字搜索用户名" 
                  allowClear 
                  style={{ width: 240 }} 
                  onChange={(e) => handleFilterChange('username', e.target.value)}
                />
              </Col>
              
              {/* 用户名正则筛选 */}
              <Col span={8}>
                <Title level={5} style={{ fontSize: 13, marginBottom: 2 }}>用户名正则</Title>
                <Input 
                  placeholder="输入正则表达式" 
                  allowClear 
                  style={{ width: 240 }} 
                  onChange={(e) => handleFilterChange('usernameRegex', e.target.value)}
                />
              </Col>
              
              {/* 注册时间筛选 */}
              <Col span={8}>
                <Title level={5} style={{ fontSize: 13, marginBottom: 2 }}>注册时间</Title>
                <DatePicker.RangePicker 
                  style={{ width: 240 }} 
                  onChange={(dates) => handleFilterChange('registerDate', dates)}
                />
              </Col>
              
              {/* 红包余额筛选 */}
              <Col span={8}>
                <Title level={5} style={{ fontSize: 13, marginBottom: 2 }}>红包余额</Title>
                <Space>
                  <InputNumber 
                    placeholder="最小红包" 
                    min={0} 
                    style={{ width: 120 }} 
                    onChange={(value) => handleFilterChange('minRedPacket', value)}
                  />
                  <span>至</span>
                  <InputNumber 
                    placeholder="最大红包" 
                    min={0} 
                    style={{ width: 120 }} 
                    onChange={(value) => handleFilterChange('maxRedPacket', value)}
                  />
                </Space>
              </Col>
              
              {/* 认证状态筛选 */}
              <Col span={8}>
                <Title level={5} style={{ fontSize: 13, marginBottom: 2 }}>认证状态</Title>
                <Select
                  mode="multiple"
                  placeholder="选择认证状态"
                  style={{ width: 240 }}
                  onChange={(values) => handleFilterChange('verificationLevels', values)}
                  options={[
                    { value: 0, label: '未认证' },
                    { value: 1, label: '基础认证' },
                    { value: 2, label: '已完成KYC' },
                    { value: 3, label: '认证中' },
                  ]}
                />
              </Col>
            </Row>
            
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button type="primary" onClick={applyFilters} style={{ marginRight: 8 }}>应用筛选</Button>
              <Button onClick={resetFilters}>重置筛选</Button>
            </div>
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
              style={{ maxHeight: '500px', overflow: 'auto' }}
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
    return (
      <div style={{ marginTop: 24, textAlign: 'right' }}>
        {currentStep > 0 && (
          <Button 
            style={{ marginRight: 8 }} 
            onClick={goToPrevStep}
            disabled={processStatus === 'processing'}
          >
            <LeftOutlined /> 上一步
          </Button>
        )}
        
        {currentStep < 2 && (
          <Button 
            type="primary" 
            onClick={goToNextStep}
            disabled={currentStep === 0 && targetKeys.length === 0}
          >
            下一步 <RightOutlined />
          </Button>
        )}
        
        {currentStep === 2 && (
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
        )}
      </div>
    );
  };
  
  return (
    <PageContainer>
      <StyledCard>
        <Title level={4}>批量开卡</Title>
        <Text type="secondary">为多个账户同时申请Infini卡片</Text>
        
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
        
        <Spin spinning={loading}>
          {renderStepContent()}
          {renderStepActions()}
        </Spin>
      </StyledCard>
    </PageContainer>
  );
};

export default BatchCardApply;