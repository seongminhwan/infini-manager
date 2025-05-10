/**
 * 2FA信息查看模态框
 * 用于展示Infini账户的2FA详细信息
 * 采用左右两栏布局展示2FA相关信息和实时验证码
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Typography,
  Row,
  Col,
  Descriptions,
  Tag,
  Input,
  List,
  message,
  Tooltip,
  Divider,
  Space,
  Card,
  Switch
} from 'antd';
import {
  CopyOutlined,
  SafetyCertificateOutlined,
  QrcodeOutlined,
  KeyOutlined,
  FieldTimeOutlined,
  SyncOutlined,
  EditOutlined,
  SaveOutlined,
  ImportOutlined,
  ExportOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { totpToolApi, infiniAccountApi } from '../services/api';

const { Text, Title } = Typography;

// 样式组件
const Container = styled.div`
  padding: 0;
`;

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

// 接口定义
interface TwoFaViewModalProps {
  visible: boolean;
  onClose: () => void;
  twoFaInfo?: {
    qrCodeUrl?: string;
    secretKey?: string;
    recoveryCodes?: string[];
  };
}

/**
 * 2FA信息查看模态框组件
 */
const TwoFaViewModal: React.FC<TwoFaViewModalProps> = ({
  visible,
  onClose,
  twoFaInfo
}) => {
  // 状态管理
  const [currentTotpCode, setCurrentTotpCode] = useState<string>('');
  const [progressValue, setProgressValue] = useState<number>(100);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  
  // 判断是否有任何2FA相关信息
  const has2FaData = twoFaInfo && (
    twoFaInfo.secretKey || 
    twoFaInfo.qrCodeUrl || 
    (twoFaInfo.recoveryCodes && twoFaInfo.recoveryCodes.length > 0)
  );
  
  // 用于生成验证码的密钥（优先使用secretKey，其次使用qrCodeUrl）
  const secretKeyToUse = twoFaInfo?.secretKey || twoFaInfo?.qrCodeUrl || '';
  
  // 从secretKey生成标准TOTP URI (如果没有qrCodeUrl)
  const generateTotpUri = (secret: string): string => {
    // 默认issuer为Infini，账户为Unknown如果没有更具体的信息
    const issuer = 'Infini';
    const account = 'Unknown';
    return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
  };
  
  // 确保有一个可用的二维码URL
  const qrCodeUrlToUse = twoFaInfo?.qrCodeUrl || 
    (twoFaInfo?.secretKey ? generateTotpUri(twoFaInfo.secretKey) : '');
  
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
  
  // 初始化TOTP验证码并设置定时器
  useEffect(() => {
    if (visible && secretKeyToUse) {
      // 立即生成一次验证码
      generateTotpCode(secretKeyToUse);
      
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
            generateTotpCode(secretKeyToUse);
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
  }, [visible, secretKeyToUse, generateTotpCode]);
  
  // 点击验证码复制
  const handleCopyCode = () => {
    if (currentTotpCode) {
      copyToClipboard(currentTotpCode, '验证码已复制到剪贴板', true);
    }
  };
  
  // 模态框关闭时的处理
  const handleClose = () => {
    onClose();
  };
  
  // 如果完全没有2FA信息，显示相应提示
  if (!has2FaData) {
    return (
      <Modal
        title="2FA信息查看"
        open={visible}
        onCancel={handleClose}
        footer={[
          <Button key="close" onClick={handleClose}>
            关闭
          </Button>
        ]}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <SafetyCertificateOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <Title level={4} style={{ marginTop: 16 }}>该账户未启用2FA或无2FA信息</Title>
          <Text type="secondary">请先配置并绑定2FA后再查看</Text>
        </div>
      </Modal>
    );
  }
  
  return (
    <Modal
      title={
        <Space>
          <SafetyCertificateOutlined />
          <span>2FA信息查看</span>
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={800}
      footer={[
        <Button key="close" onClick={handleClose}>
          关闭
        </Button>
      ]}
    >
      <Container>
        <Row gutter={24}>
          {/* 左侧：2FA链接、密钥、恢复码 */}
          <Col span={12}>
            <Title level={5}>2FA详细信息</Title>
            
            {/* 2FA密钥 - 始终显示如果存在 */}
            {twoFaInfo.secretKey && (
              <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
                <Descriptions.Item 
                  label={
                    <Space>
                      <KeyOutlined />
                      <span>2FA密钥</span>
                    </Space>
                  }
                >
                  <Space>
                    <Text>{twoFaInfo.secretKey}</Text>
                    <Tooltip title="复制密钥">
                      <Button 
                        type="text" 
                        size="small" 
                        icon={<CopyOutlined />} 
                        onClick={() => copyToClipboard(twoFaInfo.secretKey || '')}
                      />
                    </Tooltip>
                  </Space>
                </Descriptions.Item>
              </Descriptions>
            )}
            
            {/* 二维码链接 - 使用实际链接或生成的链接 */}
            <div style={{ marginBottom: 16 }}>
              <Title level={5} style={{ display: 'flex', alignItems: 'center' }}>
                <QrcodeOutlined style={{ marginRight: 8 }} />
                二维码链接
              </Title>
              <Input.TextArea 
                value={qrCodeUrlToUse} 
                autoSize={{ minRows: 2, maxRows: 4 }}
                readOnly
              />
              <Button 
                type="text" 
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(qrCodeUrlToUse)}
                style={{ marginTop: 8 }}
              >
                复制链接
              </Button>
            </div>
            
                {/* 恢复码列表 */}
                {twoFaInfo.recoveryCodes && twoFaInfo.recoveryCodes.length > 0 && (
                  <div>
                    <Title level={5}>恢复码</Title>
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary">请安全保存这些恢复码，一旦丢失2FA设备，可用于恢复账户访问权限</Text>
                    </div>
                    <List
                      grid={{ gutter: 16, column: 3 }}
                      dataSource={twoFaInfo.recoveryCodes}
                      renderItem={code => (
                        <List.Item>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Tag style={{ padding: '4px 8px', fontFamily: 'monospace' }}>
                              {code}
                            </Tag>
                            <Button 
                              type="text" 
                              size="small" 
                              icon={<CopyOutlined />} 
                              onClick={() => copyToClipboard(code)}
                            />
                          </Space>
                        </List.Item>
                      )}
                    />
                  </div>
                )}
          </Col>
          
          {/* 右侧：二维码图片、实时更新的验证码预览 */}
          <Col span={12}>
            {/* 二维码图片 - 使用实际链接或生成的链接 */}
            <div>
              <Title level={5} style={{ textAlign: 'center' }}>2FA二维码</Title>
              <QrCodeContainer>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrlToUse)}`}
                  alt="2FA二维码"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
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
              onClick={handleCopyCode}
              style={{ 
                position: 'relative',
                backgroundColor: isCopied ? '#f6ffed' : undefined,
                borderColor: isCopied ? '#b7eb8f' : undefined,
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
                <Space>
                  <SyncOutlined spin />
                  <Text type="secondary">{remainingSeconds}秒后刷新</Text>
                </Space>
                <ProgressBar>
                  <ProgressFill width={progressValue} />
                </ProgressBar>
              </div>
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                点击可复制验证码
              </Text>
            </TotpCodeCard>
          </Col>
        </Row>
      </Container>
    </Modal>
  );
};

export default TwoFaViewModal;