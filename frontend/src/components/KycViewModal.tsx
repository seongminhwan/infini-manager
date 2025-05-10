/**
 * KYC信息查看模态框
 * 用于展示Infini账户的KYC详细信息
 * 采用左右两栏布局展示KYC图片和验证信息
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Typography,
  Row,
  Col,
  Descriptions,
  Tag,
  Tooltip,
  Divider,
  Space,
  Card,
  Image,
  message,
  Spin
} from 'antd';
import {
  CopyOutlined,
  IdcardOutlined,
  GlobalOutlined,
  PhoneOutlined,
  SafetyOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { infiniAccountApi } from '../services/api';

const { Text, Title } = Typography;

// 样式组件
const Container = styled.div`
  padding: 0;
`;

const ImageContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 16px 0;
  border: 1px solid #f0f0f0;
  padding: 8px;
  border-radius: 4px;
`;

const StatusCard = styled(Card)`
  margin-top: 24px;
  text-align: center;
  transition: all 0.3s;
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
`;

// 接口定义
interface KycViewModalProps {
  visible: boolean;
  onClose: () => void;
  accountId?: string; // 账户ID，用于刷新KYC状态
  kycInfo?: {
    id?: string;
    isValid?: boolean;
    type?: number;
    s3Key?: string;
    firstName?: string;
    lastName?: string;
    country?: string;
    phone?: string;
    phoneCode?: string;
    identificationNumber?: string;
    status?: number;
    createdAt?: number;
    imageUrl?: string; // 图片URL，可以是base64编码或路径
  };
  onStatusChange?: (newStatus: any) => void; // KYC状态变更回调
}

/**
 * KYC信息查看模态框组件
 */
const KycViewModal: React.FC<KycViewModalProps> = ({
  visible,
  onClose,
  kycInfo,
  accountId,
  onStatusChange
}) => {
  // 状态管理
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [localKycInfo, setLocalKycInfo] = useState(kycInfo);
  
  // 当kycInfo变化时，更新localKycInfo
  useEffect(() => {
    if (kycInfo) {
      setLocalKycInfo(kycInfo);
    }
  }, [kycInfo]);
  
  // 刷新KYC状态
  const refreshKycStatus = async () => {
    if (!accountId) {
      message.error('无法刷新KYC状态：缺少账户ID');
      return;
    }
    
    setRefreshing(true);
    try {
      const response = await infiniAccountApi.getKycInformation(accountId);
      if (response.success && response.data.kyc_information && response.data.kyc_information.length > 0) {
        const newKycInfo = response.data.kyc_information[0];
        
        // 转换为本地格式
        const updatedKycInfo = {
          id: newKycInfo.id,
          isValid: newKycInfo.is_valid,
          type: newKycInfo.type,
          s3Key: newKycInfo.s3_key,
          firstName: newKycInfo.first_name,
          lastName: newKycInfo.last_name,
          country: newKycInfo.country,
          phone: newKycInfo.phone,
          phoneCode: newKycInfo.phone_code,
          identificationNumber: newKycInfo.identification_number,
          status: newKycInfo.status,
          createdAt: newKycInfo.created_at,
          imageUrl: newKycInfo.image_url || undefined
        };
        
        setLocalKycInfo(updatedKycInfo);
        message.success('KYC状态刷新成功');
        
        // 通知父组件状态变更
        if (onStatusChange) {
          onStatusChange(newKycInfo);
        }
      } else {
        message.warning('无法获取最新KYC状态');
      }
    } catch (error) {
      console.error('刷新KYC状态出错:', error);
      message.error('刷新KYC状态失败');
    } finally {
      setRefreshing(false);
    }
  };
  
  // 判断是否有任何KYC相关信息或账户状态为"KYC认证中"
  const hasKycData = localKycInfo && (
    localKycInfo.firstName || 
    localKycInfo.lastName || 
    localKycInfo.identificationNumber ||
    // 如果状态是KYC认证中(3)，也应该显示KYC信息
    localKycInfo.status === 3
  );
  
  // 复制文本到剪贴板
  const copyToClipboard = (text: string, messageText: string = '已复制到剪贴板', setCopiedState: boolean = false) => {
    navigator.clipboard.writeText(text)
      .then(() => {
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
      });
  };
  
  // 格式化时间戳
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '未知';
    return new Date(timestamp * 1000).toLocaleString();
  };
  
  // 获取KYC状态文本和颜色
  const getStatusText = () => {
    if (!localKycInfo) return { text: '未知', color: 'default' };
    
    if (localKycInfo.isValid) {
      return { text: 'KYC验证通过', color: 'success' };
    } else {
      switch (localKycInfo.status) {
        case 0:
          return { text: '等待验证', color: 'warning' };
        case 1:
          return { text: '验证中', color: 'processing' };
        case 2:
          return { text: '验证失败', color: 'error' };
        case 3:
          return { text: 'KYC认证中', color: 'processing' };
        default:
          return { text: '未知状态', color: 'default' };
      }
    }
  };
  
  // 模态框关闭时的处理
  const handleClose = () => {
    onClose();
  };
  
  // 检查是否只因为status=3而hasKycData为true，但实际没有KYC详细信息
  const isOnlyStatusKyc = localKycInfo?.status === 3 && !(
    localKycInfo.firstName || 
    localKycInfo.lastName || 
    localKycInfo.identificationNumber ||
    localKycInfo.country ||
    localKycInfo.phone
  );
  
  // 如果完全没有KYC信息或仅有status=3但无其他详细信息，显示特殊界面
  if (!hasKycData || isOnlyStatusKyc) {
    return (
      <Modal
        title={
          <Space>
            <IdcardOutlined />
            <span>KYC信息查看</span>
          </Space>
        }
        open={visible}
        onCancel={handleClose}
        footer={[
          accountId && localKycInfo?.status === 3 && (
            <Button 
              key="refresh" 
              type="primary" 
              icon={refreshing ? <LoadingOutlined /> : <SyncOutlined />}
              loading={refreshing} 
              onClick={refreshKycStatus}
              style={{ marginRight: 8 }}
              disabled={refreshing}
            >
              {refreshing ? '刷新中...' : '刷新KYC状态'}
            </Button>
          ),
          <Button key="close" onClick={handleClose}>
            关闭
          </Button>
        ]}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          {localKycInfo?.status === 3 ? (
            <>
              <div style={{ marginBottom: 24 }}>
                <img src="/card/card_2.png" alt="KYC认证中" width={80} height={80} />
              </div>
              <Title level={3} style={{ marginTop: 16, color: '#faad14' }}>该账户正在进行KYC认证</Title>
              <Tag color="gold" style={{ margin: '16px 0', padding: '5px 15px', fontSize: '16px' }}>KYC认证中</Tag>
              <div style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ fontSize: '16px' }}>认证正在处理中，请稍后再查看详细信息</Text>
              </div>
            </>
          ) : (
            <>
              <IdcardOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <Title level={4} style={{ marginTop: 16 }}>该账户未完成KYC认证或无KYC信息</Title>
              <Text type="secondary">请先完成KYC认证后再查看</Text>
            </>
          )}
        </div>
      </Modal>
    );
  }
  
  // 获取状态标签
  const status = getStatusText();
  
  return (
    <Modal
      title={
        <Space>
          <IdcardOutlined />
          <span>KYC信息查看</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={800}
      footer={[
        // 刷新按钮，只在"等待验证"、"验证中"或"KYC认证中"时显示
        (status.color === 'warning' || status.color === 'processing') && accountId && (
          <Button 
            key="refresh" 
            type="primary" 
            icon={refreshing ? <LoadingOutlined /> : <SyncOutlined />}
            loading={refreshing} 
            onClick={refreshKycStatus}
            style={{ marginRight: 8 }}
            disabled={refreshing}
          >
            {refreshing ? '刷新中...' : '刷新KYC状态'}
          </Button>
        ),
        <Button key="close" onClick={handleClose}>
          关闭
        </Button>
      ]}
    >
      <Container>
        <Row gutter={24}>
          {/* 左侧：KYC详细信息 */}
          <Col span={12}>
            <Title level={5}>KYC验证信息</Title>
            
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="认证ID">{localKycInfo?.id || '未知'}</Descriptions.Item>
              <Descriptions.Item label="姓名">
                {`${localKycInfo?.lastName || ''} ${localKycInfo?.firstName || ''}`}
              </Descriptions.Item>
              <Descriptions.Item 
                label={
                  <Space>
                    <GlobalOutlined />
                    <span>国家/地区</span>
                  </Space>
                }
              >
                {localKycInfo?.country || '未知'}
              </Descriptions.Item>
              <Descriptions.Item 
                label={
                  <Space>
                    <PhoneOutlined />
                    <span>电话号码</span>
                  </Space>
                }
              >
                {`${localKycInfo?.phoneCode || ''} ${localKycInfo?.phone || ''}`}
              </Descriptions.Item>
              <Descriptions.Item 
                label={
                  <Space>
                    <IdcardOutlined />
                    <span>证件号码</span>
                  </Space>
                }
              >
                <Space>
                  <Text>{localKycInfo?.identificationNumber}</Text>
                  {localKycInfo?.identificationNumber && (
                    <Tooltip title="复制证件号码">
                      <Button 
                        type="text" 
                        size="small" 
                        icon={<CopyOutlined />} 
                        onClick={() => copyToClipboard(localKycInfo.identificationNumber || '')}
                      />
                    </Tooltip>
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {formatTimestamp(localKycInfo?.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item 
                label={
                  <Space>
                    <SafetyOutlined />
                    <span>认证状态</span>
                  </Space>
                }
              >
                <Tag color={status.color}>{status.text}</Tag>
              </Descriptions.Item>
            </Descriptions>
            
            <StatusCard>
              {localKycInfo?.isValid ? (
                <div style={{ color: '#52c41a' }}>
                  <CheckCircleOutlined style={{ fontSize: 32 }} />
                  <div style={{ marginTop: 8 }}>
                    <Title level={5} style={{ color: '#52c41a', margin: 0 }}>认证已通过</Title>
                    <Text type="secondary">您的KYC验证已成功通过</Text>
                  </div>
                </div>
              ) : (
                <div style={{ color: status.color === 'warning' || status.color === 'processing' ? '#faad14' : '#ff4d4f' }}>
                  <ExclamationCircleOutlined style={{ fontSize: 32 }} />
                  <div style={{ marginTop: 8 }}>
                    <Title level={5} style={{ margin: 0, color: status.color === 'warning' || status.color === 'processing' ? '#faad14' : '#ff4d4f' }}>
                      {status.text}
                    </Title>
                    <Text type="secondary">
                      {status.color === 'warning' || status.color === 'processing' ? 
                        '您的KYC验证正在处理中，请耐心等待或点击刷新状态按钮' : 
                        '您的KYC验证未通过，请重新提交'}
                    </Text>
                  </div>
                </div>
              )}
            </StatusCard>
          </Col>
          
          {/* 右侧：KYC图片 */}
          <Col span={12}>
            <Title level={5} style={{ textAlign: 'center' }}>KYC证件图片</Title>
            
            <ImageContainer>
              {localKycInfo?.imageUrl ? (
                <Image 
                  src={localKycInfo.imageUrl}
                  alt="KYC证件图片"
                  style={{ maxWidth: '100%', maxHeight: '300px' }}
                />
              ) : (
                <div style={{ 
                  padding: '40px 20px', 
                  background: '#f5f5f5', 
                  color: '#999',
                  textAlign: 'center',
                  width: '100%'
                }}>
                  <IdcardOutlined style={{ fontSize: 32, color: '#d9d9d9' }} />
                  <p>无法显示KYC图片或图片未上传</p>
                </div>
              )}
            </ImageContainer>
            
            <Divider />
            
            <Card style={{ marginTop: 16 }}>
              <Title level={5}>证件信息</Title>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="证件类型">
                  {localKycInfo?.type === 0 ? '护照' : 
                   localKycInfo?.type === 1 ? '身份证' : 
                   localKycInfo?.type === 2 ? '驾照' : '其他证件'}
                </Descriptions.Item>
                <Descriptions.Item label="文件名称">
                  {localKycInfo?.s3Key || '未知'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>
      </Container>
    </Modal>
  );
};

export default KycViewModal;