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

// 扩展接口定义，添加账户ID参数
interface TwoFaViewModalProps {
  visible: boolean;
  onClose: () => void;
  twoFaInfo?: {
    qrCodeUrl?: string;
    secretKey?: string;
    recoveryCodes?: string[];
  };
  accountId?: string; // 账户ID，用于保存数据
}

/**
 * 2FA信息查看模态框组件
 */
const TwoFaViewModal: React.FC<TwoFaViewModalProps> = ({
  visible,
  onClose,
  twoFaInfo,
  accountId
}) => {
  // 状态管理
  const [currentTotpCode, setCurrentTotpCode] = useState<string>('');
  const [progressValue, setProgressValue] = useState<number>(100);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  
  // 编辑模式状态
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  // 编辑数据状态
  const [editData, setEditData] = useState<{
    qrCodeUrl: string;
    secretKey: string;
    recoveryCodes: string[];
  }>({
    qrCodeUrl: '',
    secretKey: '',
    recoveryCodes: []
  });

  // 恢复码输入状态
  const [recoveryCodeInput, setRecoveryCodeInput] = useState<string>('');
  
  // 初始化编辑数据
  useEffect(() => {
    if (twoFaInfo) {
      setEditData({
        qrCodeUrl: twoFaInfo.qrCodeUrl || '',
        secretKey: twoFaInfo.secretKey || '',
        recoveryCodes: twoFaInfo.recoveryCodes || []
      });
    }
  }, [twoFaInfo]);
  
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
  
  // 切换编辑模式
  const toggleEditMode = () => {
    if (isEditMode) {
      // 退出编辑模式，恢复原始数据
      if (twoFaInfo) {
        setEditData({
          qrCodeUrl: twoFaInfo.qrCodeUrl || '',
          secretKey: twoFaInfo.secretKey || '',
          recoveryCodes: twoFaInfo.recoveryCodes || []
        });
      }
    }
    setIsEditMode(!isEditMode);
  };
  
  // 从secretKey生成qr_code_url
  const generateQrCodeFromSecret = () => {
    if (!editData.secretKey) {
      message.error('请先输入密钥');
      return;
    }
    
    // 生成标准TOTP URI
    const email = twoFaInfo?.qrCodeUrl?.match(/:[^?]+\?/)?.[0]?.replace(/[?:]/g, '') || 'Unknown';
    const issuer = 'Infini';
    const qrCodeUrl = `otpauth://totp/${issuer}:${email}?secret=${editData.secretKey}&issuer=${issuer}`;
    
    setEditData(prev => ({ ...prev, qrCodeUrl }));
    message.success('已根据密钥生成二维码链接');
  };
  
  // 从qr_code_url提取secretKey
  const extractSecretFromQrCode = () => {
    if (!editData.qrCodeUrl) {
      message.error('请先输入二维码链接');
      return;
    }
    
    // 从URL中提取secret参数
    const secretMatch = editData.qrCodeUrl.match(/[?&]secret=([^&]+)/i);
    if (secretMatch && secretMatch[1]) {
      setEditData(prev => ({ ...prev, secretKey: secretMatch[1] }));
      message.success('已从二维码链接提取密钥');
    } else {
      message.error('无法从二维码链接中提取密钥，请检查链接格式');
    }
  };
  
  // 添加恢复码
  const addRecoveryCode = () => {
    if (!recoveryCodeInput.trim()) {
      message.error('请输入恢复码');
      return;
    }
    
    // 添加新的恢复码
    setEditData(prev => ({
      ...prev,
      recoveryCodes: [...prev.recoveryCodes, recoveryCodeInput.trim()]
    }));
    
    // 清空输入框
    setRecoveryCodeInput('');
    message.success('恢复码添加成功');
  };
  
  // 删除恢复码
  const removeRecoveryCode = (index: number) => {
    setEditData(prev => ({
      ...prev,
      recoveryCodes: prev.recoveryCodes.filter((_, i) => i !== index)
    }));
    message.success('恢复码移除成功');
  };
  
  // 保存2FA信息
  const saveChanges = async () => {
    if (!accountId) {
      message.error('无法保存：缺少账户ID');
      return;
    }
    
    // 验证数据
    if (!editData.qrCodeUrl && !editData.secretKey) {
      message.error('请至少提供二维码链接或密钥');
      return;
    }
    
    // 开始保存
    setSaving(true);
    
    try {
      // 准备请求数据
      const updateData = {
        qr_code_url: editData.qrCodeUrl,
        secret_key: editData.secretKey,
        recovery_codes: editData.recoveryCodes
      };
      
      // 调用API更新2FA信息
      const response = await infiniAccountApi.update2faInfo(accountId, updateData);
      
      if (response.success) {
        message.success('2FA信息更新成功');
        setIsEditMode(false);
        // 回调通知父组件数据已更新，可能需要刷新
        if (onClose) {
          onClose();
        }
      } else {
        message.error(`保存失败：${response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('保存2FA信息失败:', error);
      message.error('保存2FA信息失败，请重试');
    } finally {
      setSaving(false);
    }
  };
  
  // 模态框关闭时的处理
  const handleClose = () => {
    // 如果处于编辑模式，提示用户是否放弃更改
    if (isEditMode) {
      // 简单实现，直接放弃更改并关闭
      setIsEditMode(false);
    }
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
          <span>2FA信息{isEditMode ? '维护' : '查看'}</span>
          {accountId && (
            <Switch
              checkedChildren="编辑模式"
              unCheckedChildren="查看模式"
              checked={isEditMode}
              onChange={toggleEditMode}
              style={{ marginLeft: 8 }}
            />
          )}
        </Space>
      }
      open={visible}
      onCancel={handleClose}
      width={800}
      footer={[
        isEditMode && (
          <Button key="save" type="primary" onClick={saveChanges} loading={saving} icon={<SaveOutlined />}>
            保存更改
          </Button>
        ),
        <Button key="close" onClick={handleClose}>
          {isEditMode ? '取消' : '关闭'}
        </Button>
      ]}
    >
      <Container>
        <Row gutter={24}>
          {/* 左侧：2FA链接、密钥、恢复码 */}
          <Col span={12}>
            <Title level={5}>2FA详细信息</Title>
            
            {/* 2FA密钥 */}
            <div style={{ marginBottom: 16 }}>
              <Title level={5} style={{ display: 'flex', alignItems: 'center' }}>
                <KeyOutlined style={{ marginRight: 8 }} />
                2FA密钥
                {isEditMode && (
                  <Tooltip title="从二维码链接提取密钥">
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<ImportOutlined />} 
                      onClick={extractSecretFromQrCode}
                      style={{ marginLeft: 8 }}
                    />
                  </Tooltip>
                )}
              </Title>
              
              {isEditMode ? (
                <Input 
                  value={editData.secretKey} 
                  onChange={e => setEditData(prev => ({ ...prev, secretKey: e.target.value }))}
                  placeholder="输入2FA密钥"
                  style={{ marginBottom: 8 }}
                />
              ) : (
                <Descriptions column={1} size="small" bordered style={{ marginBottom: 8 }}>
                  <Descriptions.Item>
                    <Space>
                      <Text>{twoFaInfo?.secretKey || '未设置'}</Text>
                      {twoFaInfo?.secretKey && (
                        <Tooltip title="复制密钥">
                          <Button 
                            type="text" 
                            size="small" 
                            icon={<CopyOutlined />} 
                            onClick={() => copyToClipboard(twoFaInfo.secretKey || '')}
                          />
                        </Tooltip>
                      )}
                    </Space>
                  </Descriptions.Item>
                </Descriptions>
              )}
            </div>
            
            {/* 二维码链接 */}
            <div style={{ marginBottom: 16 }}>
              <Title level={5} style={{ display: 'flex', alignItems: 'center' }}>
                <QrcodeOutlined style={{ marginRight: 8 }} />
                二维码链接
                {isEditMode && (
                  <Tooltip title="根据密钥生成二维码链接">
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<ExportOutlined />} 
                      onClick={generateQrCodeFromSecret}
                      style={{ marginLeft: 8 }}
                    />
                  </Tooltip>
                )}
              </Title>
              
              {isEditMode ? (
                <Input.TextArea 
                  value={editData.qrCodeUrl} 
                  onChange={e => setEditData(prev => ({ ...prev, qrCodeUrl: e.target.value }))}
                  placeholder="输入或通过密钥生成二维码链接"
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  style={{ marginBottom: 8 }}
                />
              ) : (
                <>
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
                </>
              )}
            </div>
            
            {/* 恢复码列表 */}
            <div>
              <Title level={5}>
                恢复码
                {isEditMode && <Text type="secondary" style={{ fontSize: 14, marginLeft: 8 }}>(可选)</Text>}
              </Title>
              
              {/* 编辑模式下的恢复码管理 */}
              {isEditMode ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Input.Group compact>
                      <Input
                        style={{ width: 'calc(100% - 100px)' }}
                        value={recoveryCodeInput}
                        onChange={e => setRecoveryCodeInput(e.target.value)}
                        placeholder="输入恢复码"
                        onPressEnter={addRecoveryCode}
                      />
                      <Button type="primary" onClick={addRecoveryCode}>添加</Button>
                    </Input.Group>
                  </div>
                  
                  {editData.recoveryCodes.length > 0 ? (
                    <List
                      grid={{ gutter: 16, column: 3 }}
                      dataSource={editData.recoveryCodes}
                      renderItem={(code, index) => (
                        <List.Item>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Tag style={{ padding: '4px 8px', fontFamily: 'monospace' }}>
                              {code}
                            </Tag>
                            <Button 
                              type="text" 
                              size="small"
                              danger 
                              onClick={() => removeRecoveryCode(index)}
                            >
                              删除
                            </Button>
                          </Space>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: '#999' }}>
                      暂无恢复码，可以添加用于账户恢复
                    </div>
                  )}
                </>
              ) : (
                // 查看模式下的恢复码显示
                <>
                  <div style={{ marginBottom: 8 }}>
                    <Text type="secondary">请安全保存这些恢复码，一旦丢失2FA设备，可用于恢复账户访问权限</Text>
                  </div>
                  
                  {twoFaInfo.recoveryCodes && twoFaInfo.recoveryCodes.length > 0 ? (
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
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: '#999' }}>
                      无恢复码
                    </div>
                  )}
                </>
              )}
            </div>
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