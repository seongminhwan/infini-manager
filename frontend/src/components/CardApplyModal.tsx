/**
 * 一键开卡模态框组件
 * 用于显示卡片类型和开卡操作
 * 确保用户已完成KYC认证，并且先调用/card/kyc/basic接口再调用开卡接口
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Radio,
  Button,
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
  Result
} from 'antd';
import { 
  LoadingOutlined, 
  CreditCardOutlined, 
  InfoCircleOutlined, 
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  IdcardOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { apiBaseUrl, infiniAccountApi } from '../services/api';
import styled from 'styled-components';

const { Title, Text } = Typography;

// 样式组件定义
const CardContainer = styled.div`
  position: relative;
  cursor: pointer;
  transition: all 0.3s;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  height: 200px;
  margin-bottom: 16px;
  border: 2px solid transparent;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
  }
  
  &.selected {
    border-color: #1890ff;
  }
  
  &.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

// KYC提示组件
const KycAlertContainer = styled.div`
  margin-bottom: 16px;
`;

const CardImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const DisabledMask = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
  font-size: 16px;
  font-weight: bold;
`;

const PriceTag = styled(Tag)`
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 14px;
  font-weight: bold;
  padding: 4px 8px;
`;

// 定义KYC信息接口
interface KycInformation {
  id: string;
  first_name: string;
  last_name: string;
  phone_code: string;
  phone: string;
  country?: string;
  identification_number?: string;
  status?: number;
  is_valid?: boolean;
  created_at?: number;
  type?: number;
}

// 接口定义
interface CardPrice {
  price: number;
  discount: number;
  cover: string;
  mastercard_cover: string;
  visa_cover: string;
  partner_name: string;
}

interface CardInfo {
  card_id: string;
  status: string;
  currency: string;
  provider: string;
  username: string;
  card_last_four_digits: string;
  issue_type: string;
  card_address: string;
  label: string;
  partner_cover: string;
  consumption_limit: string;
  is_default: boolean;
  available_balance: string;
  budget_card_type: number;
  daily_consumption: string;
  name: string;
}

interface InfiniAccount {
  id: number;
  email: string;
  password?: string;
  google2faIsBound: boolean;
  twoFaInfo?: any;
  // KYC认证级别：0-未认证 1-基础认证 2-KYC认证 3-认证中
  verification_level?: number;
  verificationLevel?: number;
}

interface CardApplyModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  account: InfiniAccount | null;
}

const CardApplyModal: React.FC<CardApplyModalProps> = ({
  visible,
  onClose,
  onSuccess,
  account
}) => {
  const [selectedCardType, setSelectedCardType] = useState<number>(3); // 默认选择card3
  const [loading, setLoading] = useState<boolean>(false);
  const [cardPrices, setCardPrices] = useState<{[key: number]: CardPrice | null}>({
    1: null,
    2: null,
    3: null
  });
  const [applyLoading, setApplyLoading] = useState<boolean>(false);
  const [cardCreateStatus, setCardCreateStatus] = useState<'idle' | 'success' | 'error' | 'kyc-required'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [kycInfo, setKycInfo] = useState<KycInformation | null>(null);
  const [loadingKycInfo, setLoadingKycInfo] = useState<boolean>(false);
  
  // 获取实际KYC认证状态
  const getActualVerificationLevel = (acc: InfiniAccount | null): number => {
    if (!acc) return 0;
    // 优先使用verification_level，如果不存在则使用verificationLevel
    return acc.verification_level !== undefined ? acc.verification_level : (acc.verificationLevel || 0);
  };
  
  // 检查是否已经通过KYC认证
  const isKycVerified = (acc: InfiniAccount | null): boolean => {
    const level = getActualVerificationLevel(acc);
    return level === 2; // 2表示已经完成KYC认证
  };
  
  // 获取KYC信息
  const fetchKycInfo = async () => {
    if (!account || !account.id) {
      message.error('缺少账户信息，无法获取KYC信息');
      return null;
    }
    
    try {
      setLoadingKycInfo(true);
      console.log('获取KYC信息，账户ID:', account.id);
      
      const response = await infiniAccountApi.getKycInformation(account.id.toString());
      
      if (response.success && response.data.kyc_information && response.data.kyc_information.length > 0) {
        const kycData = response.data.kyc_information[0];
        console.log('获取到KYC信息:', kycData);
        setKycInfo(kycData);
        return kycData;
      } else {
        console.warn('未获取到KYC信息');
        setKycInfo(null);
        return null;
      }
    } catch (error: any) {
      console.error('获取KYC信息失败:', error);
      message.error(`获取KYC信息失败: ${error.message}`);
      setKycInfo(null);
      return null;
    } finally {
      setLoadingKycInfo(false);
    }
  };
  
  // 调用/card/kyc/basic接口
  const callCardKycBasic = async (kycData: KycInformation) => {
    if (!account || !account.id) {
      message.error('缺少账户信息，无法调用KYC接口');
      return false;
    }
    
    try {
      // 构建请求数据
      const requestData = {
        first_name: kycData.first_name,
        last_name: kycData.last_name,
        phone_code: kycData.phone_code,
        phone_number: kycData.phone,
        // 如果没有生日信息，使用默认值
        birthday: "1990-01-01" // 通常KYC信息中应该包含出生日期，但当前API可能没有返回
      };
      
      console.log('调用/card/kyc/basic接口，数据:', requestData);
      
      // 调用接口
      const response = await axios.post(
        `${apiBaseUrl}/api/infini-cards/kyc/basic`, 
        {
          accountId: account.id,
          kycData: requestData  // 后端需要将这些数据转发给Infini API
        }
      );
      
      if (response.data.success) {
        console.log('/card/kyc/basic接口调用成功');
        return true;
      } else {
        console.error('/card/kyc/basic接口调用失败:', response.data.message);
        
        // 特殊处理"Kyc already exist"错误，将其视为成功并允许继续开卡
        if (response.data.message && response.data.message.includes('Kyc already exist')) {
          console.log('KYC信息已存在，视为成功继续开卡流程');
          message.info('KYC信息已存在，将继续开卡流程');
          return true;
        }
        
        message.error(`调用KYC接口失败: ${response.data.message}`);
        return false;
      }
    } catch (error: any) {
      console.error('调用/card/kyc/basic接口失败:', error);
      
      // 特殊处理错误响应中包含"Kyc already exist"的情况
      if (error.response && error.response.data && 
          error.response.data.message && error.response.data.message.includes('Kyc already exist')) {
        console.log('KYC信息已存在，视为成功继续开卡流程');
        message.info('KYC信息已存在，将继续开卡流程');
        return true;
      }
      
      message.error(`调用KYC接口失败: ${error.message}`);
      return false;
    }
  };

  // 获取卡片价格信息
  const fetchCardPrice = async (cardType: number) => {
    try {
      setLoading(true);
      
      // 确保有账户信息
      if (!account || !account.id) {
        message.error('缺少账户信息，无法获取卡片价格');
        return;
      }
      
      // 发送请求时传入accountId参数
      const response = await axios.get(`${apiBaseUrl}/api/infini-cards/price/${cardType}`, {
        params: {
          accountId: account.id
        }
      });
      
      if (response.data.success) {
        setCardPrices(prev => ({
          ...prev,
          [cardType]: response.data.data
        }));
      } else {
        message.error(`获取卡片${cardType}价格失败：${response.data.message}`);
      }
    } catch (error: any) {
      message.error(`获取卡片${cardType}价格失败：${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 初始化加载价格信息
  useEffect(() => {
    if (visible) {
      // 清除之前的状态
      setCardCreateStatus('idle');
      setErrorMessage('');
      
      // 检查KYC认证状态
      if (account && !isKycVerified(account)) {
        setCardCreateStatus('kyc-required');
      } else if (account && isKycVerified(account)) {
        // 如果已经通过KYC认证，获取KYC信息
        fetchKycInfo();
      }
      
      // 加载所有卡片类型的价格
      fetchCardPrice(1);
      fetchCardPrice(2);
      fetchCardPrice(3);
    }
  }, [visible, account]);

  // 处理卡片类型选择
  const handleCardTypeChange = (cardType: number) => {
    if (cardType !== 3) {
      message.info('目前仅支持Card 3类型');
      return;
    }
    setSelectedCardType(cardType);
  };

  // 申请新卡
  const applyNewCard = async () => {
    if (!account) {
      message.error('缺少账户信息，无法申请卡片');
      return;
    }

    // 检查是否已完成KYC认证
    if (!isKycVerified(account)) {
      setCardCreateStatus('kyc-required');
      message.error('需要先完成KYC认证才能申请卡片');
      return;
    }

    try {
      setApplyLoading(true);
      setCardCreateStatus('idle');
      setErrorMessage('');
      
      // 步骤1: 获取KYC信息（如果尚未获取）
      let kycData = kycInfo;
      if (!kycData) {
        kycData = await fetchKycInfo();
      }
      
      if (!kycData) {
        setCardCreateStatus('error');
        setErrorMessage('获取KYC信息失败，无法继续申请卡片');
        message.error('获取KYC信息失败，无法继续申请卡片');
        setApplyLoading(false);
        return;
      }
      
      // 步骤2: 调用/card/kyc/basic接口
      const kycBasicSuccess = await callCardKycBasic(kycData);
      if (!kycBasicSuccess) {
        setCardCreateStatus('error');
        setErrorMessage('提交KYC基础信息失败，无法继续申请卡片');
        message.error('提交KYC基础信息失败，无法继续申请卡片');
        setApplyLoading(false);
        return;
      }
      
      // 步骤3: 调用卡片申请接口
      const response = await axios.post(`${apiBaseUrl}/api/infini-cards/apply`, {
        accountId: account.id,
        cardType: selectedCardType
      });

      if (response.data.success) {
        setCardCreateStatus('success');
        message.success('卡片申请成功！');
        
        // 延迟关闭并刷新
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setCardCreateStatus('error');
        setErrorMessage(response.data.message || '卡片申请失败');
        message.error(`卡片申请失败：${response.data.message}`);
      }
    } catch (error: any) {
      setCardCreateStatus('error');
      setErrorMessage(error.message || '卡片申请失败');
      message.error(`卡片申请失败：${error.message}`);
    } finally {
      setApplyLoading(false);
    }
  };

  // 渲染卡片选择
  const renderCardSelector = () => {
    const cardTypes = [1, 2, 3];

    return (
      <Row gutter={16}>
        {cardTypes.map(cardType => {
          const isDisabled = cardType !== 3;
          const price = cardPrices[cardType]?.price || 0;
          const isHighPrice = price > 6.6;
          
          return (
            <Col span={8} key={cardType}>
              <CardContainer 
                className={`${selectedCardType === cardType ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => !isDisabled && handleCardTypeChange(cardType)}
              >
                <CardImage 
                  src={`/card/card_${cardType}.png`} 
                  alt={`Card Type ${cardType}`} 
                />
                
                {isDisabled && (
                  <DisabledMask>
                    即将推出
                  </DisabledMask>
                )}
                
                {!isDisabled && cardPrices[cardType] && (
                  <PriceTag color={isHighPrice ? 'red' : 'blue'}>
                    ${price.toFixed(2)}
                  </PriceTag>
                )}
              </CardContainer>
              <div style={{ textAlign: 'center' }}>
                <Radio 
                  checked={selectedCardType === cardType} 
                  disabled={isDisabled}
                  onChange={() => handleCardTypeChange(cardType)}
                >
                  Card {cardType}
                </Radio>
                {!isDisabled && isHighPrice && (
                  <div>
                    <Tag color="red">金额过高，请检查邀请码</Tag>
                  </div>
                )}
              </div>
            </Col>
          );
        })}
      </Row>
    );
  };

  // 渲染卡片价格信息
  const renderCardPriceInfo = () => {
    const cardPrice = cardPrices[selectedCardType];
    
    if (!cardPrice) {
      return (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <div>正在获取卡片价格信息...</div>
        </div>
      );
    }

    const isHighPrice = cardPrice.price > 6.6;

    return (
      <div>
        <Divider orientation="left">卡片信息</Divider>
        
        <Row gutter={16}>
          <Col span={12}>
            <div className="info-item">
              <Text strong>卡片价格</Text>
              <div>
                <Text style={{ fontSize: 18 }}>${cardPrice.price.toFixed(2)}</Text>
                {isHighPrice && (
                  <Tag color="red" style={{ marginLeft: 8 }}>
                    金额过高，请检查邀请码
                  </Tag>
                )}
              </div>
            </div>
          </Col>
          <Col span={12}>
            <div className="info-item">
              <Text strong>折扣金额</Text>
              <div>
                <Text style={{ fontSize: 18 }}>${cardPrice.discount.toFixed(2)}</Text>
              </div>
            </div>
          </Col>
        </Row>

        <div style={{ marginTop: 16 }}>
          <Text type="secondary">
            <InfoCircleOutlined style={{ marginRight: 8 }} />
            申请卡片后，卡片费用将从您的账户余额中扣除。
          </Text>
        </div>
        
        {/* KYC警告 */}
        {account && !isKycVerified(account) && (
          <KycAlertContainer>
            <Alert
              message="需要先完成KYC认证"
              description="您需要先完成KYC认证才能申请卡片。请在账户详情页面完成KYC认证后再尝试开卡。"
              type="warning"
              showIcon
              icon={<IdcardOutlined />}
            />
          </KycAlertContainer>
        )}
        
        {cardCreateStatus === 'error' && (
          <Alert
            message="卡片申请失败"
            description={errorMessage}
            type="error"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
        
        {cardCreateStatus === 'success' && (
          <Alert
            message="卡片申请成功"
            description="您的卡片申请已成功提交，卡片将在短时间内生效。"
            type="success"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </div>
    );
  };
  
  // 如果需要KYC认证，显示KYC提示
  if (cardCreateStatus === 'kyc-required') {
    return (
      <Modal
        title="一键开卡"
        open={visible}
        onCancel={onClose}
        width={600}
        footer={[
          <Button key="close" onClick={onClose}>
            关闭
          </Button>
        ]}
      >
        <Result
          status="warning"
          title="KYC认证未完成"
          subTitle="您需要先完成KYC认证才能申请卡片"
          icon={<IdcardOutlined style={{ color: '#faad14' }} />}
          extra={
            <div style={{ textAlign: 'center' }}>
              <p style={{ marginBottom: 24 }}>
                请在账户详情页面完成KYC认证后再尝试开卡。KYC认证通常需要1-2个工作日进行审核。
              </p>
              <Button type="primary" onClick={onClose}>
                我知道了
              </Button>
            </div>
          }
        />
      </Modal>
    );
  }

  return (
    <Modal
      title="一键开卡"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="apply"
          type="primary"
          icon={<CreditCardOutlined />}
          loading={applyLoading}
          onClick={applyNewCard}
          disabled={!cardPrices[selectedCardType] || cardCreateStatus === 'success' || !isKycVerified(account)}
        >
          {cardCreateStatus === 'success' ? '已申请成功' : '确认开卡'}
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
        {/* KYC提示 */}
        {account && !isKycVerified(account) && (
          <Alert
            message="KYC认证未完成"
            description="您需要先完成KYC认证才能申请卡片。请在账户详情页面完成KYC认证后再尝试开卡。"
            type="warning"
            showIcon
            icon={<IdcardOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}
        
        <div style={{ marginBottom: 24 }}>
          <Title level={5}>选择卡片类型</Title>
          {renderCardSelector()}
        </div>
        
        {renderCardPriceInfo()}
      </Spin>
    </Modal>
  );
};

export default CardApplyModal;