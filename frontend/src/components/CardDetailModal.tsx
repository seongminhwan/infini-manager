/**
 * 卡片详情模态框组件
 * 用于展示卡片的完整信息，包括卡号、有效期和CVV
 * 提供刷新和复制功能
 */
import React, { useState, useEffect } from 'react';
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
  Tooltip
} from 'antd';
import { 
  SyncOutlined, 
  CreditCardOutlined, 
  InfoCircleOutlined, 
  CopyOutlined,
  BankOutlined,
  CalendarOutlined,
  SafetyOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import axios from 'axios';
import { apiBaseUrl } from '../services/api';
import styled from 'styled-components';

const { Title, Text } = Typography;

// 样式组件定义
const CardContainer = styled.div`
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  background-color: #fafafa;
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

  // 获取卡片详情
  const fetchCardDetails = async () => {
    try {
      setLoading(true);
      
      const response = await axios.get(`${apiBaseUrl}/api/infini-cards/detail`, {
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
      const response = await axios.post(`${apiBaseUrl}/api/infini-cards/sync`, {
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
  const copyToClipboard = (text: string, messageText: string = '已复制到剪贴板') => {
    navigator.clipboard.writeText(text)
      .then(() => {
        message.success(messageText);
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
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={600}
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
        )}
      </Spin>
    </Modal>
  );
};

export default CardDetailModal;