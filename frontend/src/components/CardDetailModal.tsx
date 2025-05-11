/**
 * 卡片详情模态框组件
 * 用于展示卡片的完整信息，包括卡号、有效期和CVV
 * 提供详细视图模式、刷新和复制功能
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Card,
  Descriptions,
  Spin,
  Typography,
  Divider,
  Tag,
  message,
  Space,
  Tooltip,
  Switch,
  Row,
  Col,
  Progress
} from 'antd';
import { 
  SyncOutlined, 
  CreditCardOutlined, 
  InfoCircleOutlined, 
  CopyOutlined,
  BankOutlined,
  CalendarOutlined,
  SafetyOutlined,
  LoadingOutlined,
  SafetyCertificateOutlined,
  KeyOutlined,
  QrcodeOutlined,
  FieldTimeOutlined
} from '@ant-design/icons';
import api, { apiBaseUrl, totpToolApi } from '../services/api';
import styled from 'styled-components';

const { Title, Text } = Typography;

// 2FA信息接口
interface TwoFaInfo {
  qrCodeUrl?: string;
  secretKey?: string;
  recoveryCodes?: string[];
}

// 进度条样式
const ProgressBar = styled.div`
  height: 6px;
  background-color: #f0f0f0;
  border-radius: 3px;
  margin-top: 8px;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ width: number }>`
  height: 100%;
  width: ${props => props.width}%;
  background-color: #1890ff;
  transition: width 1s linear;
`;

// 样式组件定义
const ModeSwitch = styled.div`
  display: flex;
  align-items: center;
  margin-left: 16px;
`;

const CardContainer = styled.div`
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  background-color: #fafafa;
`;

const DetailContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const CardInfo = styled(Card)`
  margin-bottom: 16px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const CardNumber = styled.div`
  font-size: 18px;
  font-weight: bold;
  letter-spacing: 2px;
  margin: 16px 0;
  padding: 8px;
  background-color: #f9f9f9;
  border-radius: 4px;
  text-align: center;
  font-family: monospace;
`;

const SecurityInfo = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 16px;
`;

const CopyButton = styled(Button)`
  margin-left: 8px;
`;

// 从TwoFaViewModal.tsx复制的组件样式
const QrCodeContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 16px 0;
`;

const TotpCodeCard = styled(Card)`
  margin-top: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s;
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
`;

const TotpCodeText = styled(Text)`
  font-size: 28px;
  font-weight: bold;
  font-family: monospace;
  letter-spacing: 4px;
`;

interface CardDetails {
  card_no: string;
  expire_month: string;
  expire_year: string;
  cvv: string;
  generated_address?: string;
}

interface CardDetailModalProps {
  visible: boolean;
  onClose: () => void;
  accountId: number;
  cardId: string;
  cardInfo: any;
  onRefresh?: () => void;
}

const CardDetailModal: React.FC<CardDetailModalProps> = ({
  visible,
  onClose,
  accountId,
  cardId,
  cardInfo,
  onRefresh
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [cardDetails, setCardDetails] = useState<CardDetails | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // 详细视图模式状态（默认为详细模式）
  const [detailMode, setDetailMode] = useState<boolean>(true);
  
  // 2FA相关状态
  const [twoFaInfo, setTwoFaInfo] = useState<TwoFaInfo | null>(null);
  const [loadingTwoFa, setLoadingTwoFa] = useState<boolean>(false);
  const [hasTwoFa, setHasTwoFa] = useState<boolean>(false);
  const [currentTotpCode, setCurrentTotpCode] = useState<string>('');
  const [progressValue, setProgressValue] = useState<number>(100);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  // 是否已尝试加载2FA信息
  const [twoFaFetchAttempted, setTwoFaFetchAttempted] = useState<boolean>(false);
  // 本地生成的二维码数据URL
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  // 是否正在加载二维码
  const [loadingQrCode, setLoadingQrCode] = useState<boolean>(false);
  
  // 切换详细视图模式
  const toggleDetailMode = () => {
    setDetailMode(!detailMode);
    
    // 如果切换到详细视图模式，并且还没有加载过2FA信息，则尝试加载
    if (!detailMode && !twoFaInfo && !loadingTwoFa) {
      fetchTwoFaInfo();
    }
  };
  
  // 从账户详情获取2FA信息
  const fetchTwoFaInfo = async () => {
    if (!accountId) return;
    
    try {
      setLoadingTwoFa(true);
      // 标记已尝试获取2FA信息，避免重复调用
      setTwoFaFetchAttempted(true);
      
      // 从账户详情API获取2FA信息
      const response = await api.get(`${apiBaseUrl}/api/infini-accounts/${accountId}`);
      
      if (response.data.success && response.data.data) {
        const accountData = response.data.data;
        
        if (accountData.twoFaInfo) {
          // 账户包含2FA信息
          setTwoFaInfo({
            qrCodeUrl: accountData.twoFaInfo.qrCodeUrl,
            secretKey: accountData.twoFaInfo.secretKey,
            recoveryCodes: accountData.twoFaInfo.recoveryCodes || []
          });
          setHasTwoFa(accountData.google2faIsBound);
          
          // 如果有密钥，开始生成验证码
          if (accountData.twoFaInfo.secretKey) {
            generateTotpCode(accountData.twoFaInfo.secretKey);
            // 生成二维码
            const inputData = accountData.twoFaInfo.qrCodeUrl || 
              (accountData.twoFaInfo.secretKey ? generateTotpUri(accountData.twoFaInfo.secretKey) : '');
            if (inputData) {
              generateQrCode(inputData);
            }
          }
        } else {
          // 账户没有2FA信息或未绑定2FA
          setHasTwoFa(accountData.google2faIsBound || false);
          // 创建一个空的2FA信息，而不是设置为null，避免触发无限循环
          setTwoFaInfo({ qrCodeUrl: '', secretKey: '', recoveryCodes: [] });
        }
      } else {
        message.warning('获取账户信息失败: ' + (response.data.message || '未知错误'));
        // 设置为空对象而不是null，避免触发useEffect的无限循环
        setTwoFaInfo({ qrCodeUrl: '', secretKey: '', recoveryCodes: [] });
      }
    } catch (error: any) {
      console.error('获取账户信息失败:', error);
      message.error('获取账户信息失败: ' + error.message);
      // 设置为空对象而不是null，避免触发useEffect的无限循环
      setTwoFaInfo({ qrCodeUrl: '', secretKey: '', recoveryCodes: [] });
    } finally {
      setLoadingTwoFa(false);
    }
  };
  
  // 生成二维码
  const generateQrCode = useCallback(async (input: string) => {
    try {
      if (!input) {
        console.warn('无法生成二维码: 输入为空');
        return;
      }
      
      setLoadingQrCode(true);
      const response = await totpToolApi.generateQrCode(input);
      if (response.success && response.data) {
        setQrCodeDataUrl(response.data.qrCode);
      }
    } catch (error) {
      console.error('生成二维码失败:', error);
    } finally {
      setLoadingQrCode(false);
    }
  }, []);

  // 生成TOTP验证码
  const generateTotpCode = useCallback(async (input: string) => {
    try {
      if (!input) {
        console.warn('无法生成验证码: 输入为空');
        return;
      }
      
      const response = await totpToolApi.generateTotpCode(input);
      if (response.success && response.data) {
        setCurrentTotpCode(response.data.code);
      }
    } catch (error) {
      console.error('生成TOTP验证码失败:', error);
    }
  }, []);
  
  // 验证码定时器
  useEffect(() => {
    if (visible && detailMode && twoFaInfo?.secretKey) {
      // 立即生成一次验证码
      generateTotpCode(twoFaInfo.secretKey);
      
      // 如果还没有生成二维码，生成一次
      if (!qrCodeDataUrl) {
        const inputData = twoFaInfo.qrCodeUrl || generateTotpUri(twoFaInfo.secretKey);
        generateQrCode(inputData);
      }
      
      // 计算当前时间的秒数取余30，得出剩余秒数
      const now = new Date();
      const currentSeconds = now.getSeconds();
      const secondsInPeriod = currentSeconds % 30;
      const secondsRemaining = 30 - secondsInPeriod;
      
      setRemainingSeconds(secondsRemaining);
      setProgressValue((secondsRemaining / 30) * 100);
      
      // 每秒更新进度条和剩余时间
      const intervalId = setInterval(() => {
        setRemainingSeconds(prev => {
          // 如果剩余时间为1，意味着即将重置为30
          if (prev === 1) {
            // 重新生成验证码
            if (twoFaInfo?.secretKey) {
              generateTotpCode(twoFaInfo.secretKey);
            }
            setProgressValue(100);
            return 30;
          }
          // 否则减少1秒
          const newValue = prev - 1;
          setProgressValue((newValue / 30) * 100);
          return newValue;
        });
      }, 1000);
      
      // 清除定时器
      return () => clearInterval(intervalId);
    }
  }, [visible, detailMode, twoFaInfo?.secretKey, qrCodeDataUrl, generateTotpCode, generateQrCode]);
  
  // 点击验证码复制
  const handleCopyCode = () => {
    if (currentTotpCode) {
      copyToClipboard(currentTotpCode, '验证码已复制到剪贴板', true);
    }
  };
  
  // 从qr_code_url提取secretKey
  const extractSecretFromQrCode = (qrCodeUrl: string): string | null => {
    if (!qrCodeUrl) return null;
    
    // 从URL中提取secret参数
    const secretMatch = qrCodeUrl.match(/[?&]secret=([^&]+)/i);
    if (secretMatch && secretMatch[1]) {
      return secretMatch[1];
    }
    return null;
  };
  
  // 从secretKey生成标准TOTP URI
  const generateTotpUri = (secret: string, email: string = 'Unknown'): string => {
    // 默认issuer为Infini
    const issuer = 'Infini';
    return `otpauth://totp/${issuer}:${email}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  };
  
  // 获取卡片详情
  const fetchCardDetails = async () => {
    try {
      setLoading(true);
      
      // 只有当cardId存在时才调用API
      if (!cardId) {
        message.info('没有可用的卡片信息');
        setLoading(false);
        return;
      }
      
      const response = await api.get(`${apiBaseUrl}/api/infini-cards/detail`, {
        params: {
          accountId,
          cardId
        }
      });
      
      if (response.data.success) {
        setCardDetails(response.data.data);
        message.success('获取卡片详情成功');
      } else {
        message.error(`获取卡片详情失败: ${response.data.message}`);
      }
    } catch (error: any) {
      message.error(`获取卡片详情失败: ${error.message}`);
      console.error('获取卡片详情失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 刷新卡片信息
  const refreshCardInfo = async () => {
    try {
      setRefreshing(true);
      message.loading('正在刷新卡片信息...');
      
      // 调用同步卡片信息接口
      const response = await api.post(`${apiBaseUrl}/api/infini-cards/sync`, {
        accountId
      });
      
      if (response.data.success) {
        message.success('卡片信息同步成功');
        
        // 获取最新的卡片详情
        await fetchCardDetails();
        
        // 如果有onRefresh回调，调用它刷新父组件的卡片列表
        if (onRefresh) {
          onRefresh();
        }
      } else {
        message.error(response.data.message || '卡片信息同步失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '卡片信息同步失败');
      console.error('卡片信息同步失败:', error);
    } finally {
      setRefreshing(false);
    }
  };
  
  // 复制文本到剪贴板
  const copyToClipboard = (text: string, messageText: string = '已复制到剪贴板', setCopiedState: boolean = false) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        message.success(messageText);
        // 如果需要设置复制状态
        if (setCopiedState) {
          setIsCopied(true);
          // 2秒后自动重置复制状态
          setTimeout(() => {
            setIsCopied(false);
          }, 2000);
        }
      })
      .catch(err => {
        console.error('复制失败:', err);
        message.error('复制失败，请手动复制');
      });
  };
  
  // 格式化卡号
  const formatCardNumber = (cardNo?: string) => {
    if (!cardNo) return '•••• •••• •••• ••••';
    // 每4位添加一个空格
    return cardNo.replace(/(\d{4})/g, '$1 ').trim();
  };
  
  // 格式化有效期
  const formatExpireDate = (month?: string, year?: string) => {
    if (!month || !year) return 'MM/YY';
    // 确保月份是两位数
    const formattedMonth = month.padStart(2, '0');
    // 年份取后两位
    const formattedYear = year.slice(-2);
    return `${formattedMonth}/${formattedYear}`;
  };
  
  // 当模态框打开时加载卡片详情
  useEffect(() => {
    if (visible) {
      fetchCardDetails();
    }
  }, [visible, cardId]);
  
  // 当模态框打开且详细视图模式时加载2FA信息
  useEffect(() => {
    // 仅当模态框可见、处于详细视图模式、未尝试获取2FA信息且当前不在加载过程中时，才尝试获取2FA信息
    if (visible && detailMode && !twoFaFetchAttempted && !loadingTwoFa) {
      fetchTwoFaInfo();
    }
  }, [visible, detailMode, twoFaFetchAttempted, loadingTwoFa, accountId]);
  
  // 当模态框关闭时重置2FA获取状态，以便下次打开时可以重新获取
  useEffect(() => {
    if (!visible) {
      setTwoFaFetchAttempted(false);
    }
  }, [visible]);
  
  return (
    <Modal
      title={
        <Space>
          <CreditCardOutlined />
          <span>卡片详情</span>
          {cardInfo && cardInfo.status && (
            <Tag color={cardInfo.status === 'active' ? 'green' : 'orange'}>
              {cardInfo.status}
            </Tag>
          )}
          <ModeSwitch>
            <Switch
              checked={detailMode}
              onChange={toggleDetailMode}
              checkedChildren="详细"
              unCheckedChildren="简洁"
            />
          </ModeSwitch>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={detailMode ? 800 : 600}
      footer={[
        <Button 
          key="refresh" 
          type="primary"
          ghost
          icon={<SyncOutlined spin={refreshing} />}
          onClick={refreshCardInfo}
          loading={refreshing}
        >
          刷新卡片信息
        </Button>,
        <Button key="close" onClick={onClose}>
          关闭
        </Button>
      ]}
    >
      <Spin spinning={loading} indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />}>
        {cardInfo && (
          <DetailContainer>
            {/* 简洁模式与详细模式的内容布局不同 */}
            {!detailMode ? (
              // 简洁模式 - 原有布局
              <div>
                {/* 卡片基本信息 */}
                <CardInfo>
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <BankOutlined />
                        <Text strong>{cardInfo.label || `${cardInfo.provider} 卡片`}</Text>
                      </Space>
                      <div>
                        <Text type="secondary">{cardInfo.provider}</Text>
                        <Text type="secondary" style={{ marginLeft: 8 }}>{cardInfo.currency}</Text>
                      </div>
                    </div>
                    
                    {/* 卡号显示与复制 */}
                    <CardNumber>
                      {cardDetails ? formatCardNumber(cardDetails.card_no) : formatCardNumber(cardInfo.card_last_four_digits ? `**** **** **** ${cardInfo.card_last_four_digits}` : undefined)}
                      <CopyButton 
                        type="text" 
                        icon={<CopyOutlined />}
                        onClick={() => cardDetails && copyToClipboard(cardDetails.card_no, '卡号已复制到剪贴板')}
                        disabled={!cardDetails}
                      />
                    </CardNumber>
                    
                    {/* 有效期和CVV */}
                    <SecurityInfo>
                      <div>
                        <Text type="secondary">有效期</Text>
                        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center' }}>
                          <CalendarOutlined style={{ marginRight: 4 }} />
                          <Text strong>{cardDetails ? formatExpireDate(cardDetails.expire_month, cardDetails.expire_year) : 'MM/YY'}</Text>
                          {cardDetails && (
                            <CopyButton 
                              type="text" 
                              size="small"
                              icon={<CopyOutlined />}
                              onClick={() => copyToClipboard(formatExpireDate(cardDetails.expire_month, cardDetails.expire_year), '有效期已复制到剪贴板')}
                            />
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <Text type="secondary">安全码 (CVV)</Text>
                        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center' }}>
                          <SafetyOutlined style={{ marginRight: 4 }} />
                          <Text strong>{cardDetails ? cardDetails.cvv : '***'}</Text>
                          {cardDetails && (
                            <CopyButton 
                              type="text" 
                              size="small"
                              icon={<CopyOutlined />}
                              onClick={() => copyToClipboard(cardDetails.cvv, 'CVV已复制到剪贴板')}
                            />
                          )}
                        </div>
                      </div>
                    </SecurityInfo>
                  </div>
                </CardInfo>
                
                <Divider orientation="left">卡片信息</Divider>
                
                <Descriptions column={2} bordered size="small">
                  <Descriptions.Item label="卡种类型">{cardInfo.issue_type || '未知'}</Descriptions.Item>
                  <Descriptions.Item label="卡片币种">{cardInfo.currency || '未知'}</Descriptions.Item>
                  <Descriptions.Item label="卡片提供商">{cardInfo.provider || '未知'}</Descriptions.Item>
                  <Descriptions.Item label="持卡人姓名">{cardInfo.name || '未知'}</Descriptions.Item>
                  <Descriptions.Item label="可用余额">{cardInfo.available_balance || '0'}</Descriptions.Item>
                  <Descriptions.Item label="消费限额">{cardInfo.consumption_limit || '未知'}</Descriptions.Item>
                  <Descriptions.Item label="日消费">{cardInfo.daily_consumption || '0'}</Descriptions.Item>
                  <Descriptions.Item label="是否默认">
                    <Tag color={cardInfo.is_default ? 'blue' : 'default'}>
                      {cardInfo.is_default ? '是' : '否'}
                    </Tag>
                  </Descriptions.Item>
                  {cardDetails && cardDetails.generated_address && (
                    <Descriptions.Item label="账单地址" span={2}>
                      {cardDetails.generated_address}
                      <CopyButton 
                        type="text" 
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => copyToClipboard(cardDetails.generated_address || '', '账单地址已复制到剪贴板')}
                      />
                    </Descriptions.Item>
                  )}
                </Descriptions>
                
                <div style={{ marginTop: 16 }}>
                  <Text type="secondary">
                    <InfoCircleOutlined style={{ marginRight: 8 }} />
                    请勿将卡片信息透露给任何人，包括Infini的工作人员。
                  </Text>
                </div>
              </div>
            ) : (
              // 详细模式 - 左右两栏布局
              <Row gutter={24}>
                {/* 左侧：卡片详情 */}
                <Col span={12}>
                  {/* 卡片基本信息 */}
                  <CardInfo>
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Space>
                          <BankOutlined />
                          <Text strong>{cardInfo.label || `${cardInfo.provider} 卡片`}</Text>
                        </Space>
                        <div>
                          <Text type="secondary">{cardInfo.provider}</Text>
                          <Text type="secondary" style={{ marginLeft: 8 }}>{cardInfo.currency}</Text>
                        </div>
                      </div>
                      
                      {/* 卡号显示与复制 */}
                      <CardNumber>
                        {cardDetails ? formatCardNumber(cardDetails.card_no) : formatCardNumber(cardInfo.card_last_four_digits ? `**** **** **** ${cardInfo.card_last_four_digits}` : undefined)}
                        <CopyButton 
                          type="text" 
                          icon={<CopyOutlined />}
                          onClick={() => cardDetails && copyToClipboard(cardDetails.card_no, '卡号已复制到剪贴板')}
                          disabled={!cardDetails}
                        />
                      </CardNumber>
                      
                      {/* 有效期和CVV */}
                      <SecurityInfo>
                        <div>
                          <Text type="secondary">有效期</Text>
                          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center' }}>
                            <CalendarOutlined style={{ marginRight: 4 }} />
                            <Text strong>{cardDetails ? formatExpireDate(cardDetails.expire_month, cardDetails.expire_year) : 'MM/YY'}</Text>
                            {cardDetails && (
                              <CopyButton 
                                type="text" 
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() => copyToClipboard(formatExpireDate(cardDetails.expire_month, cardDetails.expire_year), '有效期已复制到剪贴板')}
                              />
                            )}
                          </div>
                        </div>
                        
                        <div>
                          <Text type="secondary">安全码 (CVV)</Text>
                          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center' }}>
                            <SafetyOutlined style={{ marginRight: 4 }} />
                            <Text strong>{cardDetails ? cardDetails.cvv : '***'}</Text>
                            {cardDetails && (
                              <CopyButton 
                                type="text" 
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() => copyToClipboard(cardDetails.cvv, 'CVV已复制到剪贴板')}
                              />
                            )}
                          </div>
                        </div>
                      </SecurityInfo>
                    </div>
                  </CardInfo>
                  
                  <Divider orientation="left">卡片信息</Divider>
                  
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="卡种类型">{cardInfo.issue_type || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="卡片币种">{cardInfo.currency || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="卡片提供商">{cardInfo.provider || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="持卡人姓名">{cardInfo.name || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="可用余额">{cardInfo.available_balance || '0'}</Descriptions.Item>
                    <Descriptions.Item label="消费限额">{cardInfo.consumption_limit || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="日消费">{cardInfo.daily_consumption || '0'}</Descriptions.Item>
                    <Descriptions.Item label="是否默认">
                      <Tag color={cardInfo.is_default ? 'blue' : 'default'}>
                        {cardInfo.is_default ? '是' : '否'}
                      </Tag>
                    </Descriptions.Item>
                    {cardDetails && cardDetails.generated_address && (
                      <Descriptions.Item label="账单地址">
                        {cardDetails.generated_address}
                        <CopyButton 
                          type="text" 
                          size="small"
                          icon={<CopyOutlined />}
                          onClick={() => copyToClipboard(cardDetails.generated_address || '', '账单地址已复制到剪贴板')}
                        />
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Col>
                
                {/* 右侧：2FA信息 */}
                <Col span={12}>
                  <Spin spinning={loadingTwoFa}>
                    <div>
                      <Title level={5} style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                        <SafetyCertificateOutlined style={{ marginRight: 8 }} />
                        2FA详情信息
                      </Title>
                      
                      {!hasTwoFa ? (
                        // 无2FA信息时的提示
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                          <SafetyCertificateOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                          <Title level={4} style={{ marginTop: 16 }}>该账户未启用2FA或无2FA信息</Title>
                          <Text type="secondary">请先配置并绑定2FA后再查看</Text>
                        </div>
                      ) : twoFaInfo ? (
                        // 有2FA信息时的展示
                        <div>
                          {/* 2FA密钥 */}
                          <div style={{ marginBottom: 16 }}>
                            <Title level={5} style={{ display: 'flex', alignItems: 'center' }}>
                              <KeyOutlined style={{ marginRight: 8 }} />
                              2FA密钥
                            </Title>
                            <Descriptions column={1} size="small" bordered style={{ marginBottom: 8 }}>
                              <Descriptions.Item>
                                <Space>
                                  <Text>{twoFaInfo.secretKey || '未设置'}</Text>
                                  {twoFaInfo.secretKey && (
                                    <Tooltip title="复制密钥">
                                      <Button 
                                        type="text" 
                                        size="small" 
                                        icon={<CopyOutlined />} 
                                        onClick={() => copyToClipboard(twoFaInfo.secretKey || '', '密钥已复制到剪贴板')}
                                      />
                                    </Tooltip>
                                  )}
                                </Space>
                              </Descriptions.Item>
                            </Descriptions>
                          </div>
                          
                          {/* 二维码区域 */}
                          <div>
                            <Title level={5} style={{ textAlign: 'center' }}>2FA二维码</Title>
                          <QrCodeContainer>
                              {loadingQrCode ? (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 200, height: 200 }}>
                                  <Spin tip="生成二维码中..." />
                                </div>
                              ) : qrCodeDataUrl ? (
                                <img 
                                  src={qrCodeDataUrl}
                                  alt="2FA二维码"
                                  style={{ maxWidth: '100%', height: 'auto' }}
                                />
                              ) : twoFaInfo.qrCodeUrl || twoFaInfo.secretKey ? (
                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: 200, height: 200 }}>
                                  <Button 
                                    type="primary" 
                                    onClick={() => {
                                      const inputData = twoFaInfo.qrCodeUrl || 
                                        (twoFaInfo.secretKey ? generateTotpUri(twoFaInfo.secretKey) : '');
                                      if (inputData) {
                                        generateQrCode(inputData);
                                      }
                                    }}
                                    icon={<QrcodeOutlined />}
                                  >
                                    生成二维码
                                  </Button>
                                </div>
                              ) : (
                                <div style={{ 
                                  width: 200, 
                                  height: 200, 
                                  background: '#f5f5f5', 
                                  display: 'flex', 
                                  justifyContent: 'center', 
                                  alignItems: 'center',
                                  flexDirection: 'column' 
                                }}>
                                  <QrcodeOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                                  <Text type="secondary" style={{ marginTop: 8 }}>
                                    无二维码信息
                                  </Text>
                                </div>
                              )}
                            </QrCodeContainer>
                          </div>
                          
                          <Divider />
                          
                          {/* 实时验证码 */}
                          <Title level={5} style={{ textAlign: 'center' }}>
                            <Space>
                              <FieldTimeOutlined />
                              <span>实时验证码</span>
                            </Space>
                          </Title>
                          
                          <TotpCodeCard 
                            onClick={twoFaInfo.secretKey ? handleCopyCode : undefined}
                            style={{ 
                              position: 'relative',
                              backgroundColor: isCopied ? '#f6ffed' : undefined,
                              borderColor: isCopied ? '#b7eb8f' : undefined,
                              cursor: twoFaInfo.secretKey ? 'pointer' : 'default',
                              transition: 'all 0.3s'
                            }}
                          >
                            {isCopied && (
                              <div 
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  right: 0,
                                  bottom: 0,
                                  display: 'flex',
                                  justifyContent: 'center',
                                  alignItems: 'center',
                                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                  zIndex: 1,
                                  animation: 'fadeIn 0.3s, fadeOut 0.3s 1.7s',
                                  borderRadius: '8px'
                                }}
                              >
                                <Text style={{ fontSize: '24px', color: '#52c41a' }}>
                                  <CopyOutlined /> 已复制!
                                </Text>
                              </div>
                            )}
                            <TotpCodeText>{currentTotpCode || '------'}</TotpCodeText>
                            <div style={{ marginTop: 8 }}>
                              {twoFaInfo.secretKey ? (
                                <>
                                  <Space>
                                    <SyncOutlined spin />
                                    <Text type="secondary">{remainingSeconds}秒后刷新</Text>
                                  </Space>
                                  <ProgressBar>
                                    <ProgressFill width={progressValue} />
                                  </ProgressBar>
                                </>
                              ) : (
                                <Text type="secondary">无法生成验证码</Text>
                              )}
                            </div>
                            {twoFaInfo.secretKey && (
                              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                                点击可复制验证码
                              </Text>
                            )}
                          </TotpCodeCard>
                        </div>
                      ) : (
                        // 加载中
                        <div style={{ textAlign: 'center', padding: 20 }}>
                          <Spin />
                          <div style={{ marginTop: 16 }}>
                            <Text type="secondary">正在加载2FA信息...</Text>
                          </div>
                        </div>
                      )}
                    </div>
                  </Spin>
                </Col>
              </Row>
            )}
            
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                <InfoCircleOutlined style={{ marginRight: 8 }} />
                请勿将卡片信息透露给任何人，包括Infini的工作人员。
              </Text>
            </div>
          </DetailContainer>
        )}
      </Spin>
    </Modal>
  );
};

export default CardDetailModal;