/**
 * 一键注册级用户模态框组件
 * 用于实现一键式账户设置功能，包括随机用户注册、自动2FA、自动KYC和一键开卡
 */
import React, { useState } from 'react';
import {
  Modal,
  Form,
  Button,
  Checkbox,
  message,
  Input,
  Space,
  Spin,
  Typography,
  Alert,
  Divider,
  Row,
  Col,
  Card,
} from 'antd';
import {
  UserAddOutlined,
  SafetyCertificateOutlined,
  IdcardOutlined,
  CreditCardOutlined,
  LoadingOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { infiniAccountApi } from '../services/api';

const { Text, Title } = Typography;

interface OneClickSetupModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const OneClickSetupModal: React.FC<OneClickSetupModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [setupResult, setSetupResult] = useState<any>(null);
  const [setupSuccess, setSetupSuccess] = useState(false);
  
  // 重置状态
  const resetState = () => {
    form.resetFields();
    setSetupResult(null);
    setSetupSuccess(false);
    form.setFieldsValue({
      enable2FA: true,
      enableKYC: true,
      enableCard: true,
      password: generateRandomPassword(),
    });
  };

  // 生成随机强密码
  const generateRandomPassword = (): string => {
    const length = Math.floor(Math.random() * 9) + 16; // 16-24位长度
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
    let password = '';
    
    // 确保至少包含一个特殊字符
    let hasSpecialChar = false;
    const specialChars = '!@#$%^&*()_+~`|}{[]:;?><,./-=';
    
    // 生成随机密码
    for (let i = 0; i < length; i++) {
      const randomChar = charset.charAt(Math.floor(Math.random() * charset.length));
      password += randomChar;
      
      // 检查是否包含特殊字符
      if (specialChars.includes(randomChar)) {
        hasSpecialChar = true;
      }
    }
    
    // 如果没有特殊字符，替换最后一个字符为特殊字符
    if (!hasSpecialChar) {
      const randomSpecialChar = specialChars.charAt(Math.floor(Math.random() * specialChars.length));
      password = password.slice(0, -1) + randomSpecialChar;
    }
    
    return password;
  };
  
  // 表单提交时自动生成一个随机邮箱前缀
  const generateRandomEmailPrefix = (): string => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let prefix = '';
    for (let i = 0; i < 10; i++) {
      prefix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix;
  };

  // 组件挂载时设置默认值
  React.useEffect(() => {
    if (visible) {
      resetState();
    }
  }, [visible]);

  // 处理关闭
  const handleClose = () => {
    resetState();
    onClose();
  };

  // 处理重置
  const handleReset = () => {
    resetState();
  };

  // 处理提交
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      const { emailPrefix, domain, password, enable2FA, enableKYC, enableCard } = values;
      const email = `${emailPrefix}@${domain}`;
      
      const params = {
        email,
        password,
        enable2FA,
        enableKYC,
        enableCard,
      };
      
      const response = await infiniAccountApi.oneClickAccountSetup(params);
      
      if (response.success) {
        setSetupResult(response.data);
        setSetupSuccess(true);
        message.success('一键式账户设置成功');
        onSuccess(); // 刷新账户列表
      } else {
        setSetupResult({ error: response.message });
        message.error(`一键式账户设置失败: ${response.message}`);
      }
    } catch (error: any) {
      setSetupResult({ error: error.message });
      message.error(`一键式账户设置失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 生成随机密码
  const generatePassword = () => {
    const password = generateRandomPassword();
    form.setFieldsValue({ password });
    message.success('已生成随机强密码');
  };

  // 生成随机邮箱
  const generateRandomEmail = () => {
    const emailPrefix = generateRandomEmailPrefix();
    form.setFieldsValue({ emailPrefix });
    message.success('已生成随机邮箱前缀');
  };

  // 渲染设置结果
  const renderSetupResult = () => {
    if (!setupResult) return null;
    
    if (setupResult.error) {
      return (
        <Alert
          message="设置失败"
          description={setupResult.error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      );
    }
    
    return (
      <div>
        <Alert
          message="设置成功"
          description="账户已成功创建并完成设置"
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Card title="账户信息" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text strong>账户ID: </Text>
              <Text>{setupResult.accountId}</Text>
            </Col>
            <Col span={12}>
              <Text strong>邮箱: </Text>
              <Text>{setupResult.email}</Text>
            </Col>
            <Col span={24}>
              <Text strong>状态: </Text>
              <Text>{setupResult.status || '已创建'}</Text>
            </Col>
          </Row>
        </Card>
        
        {setupResult.twoFaResult && (
          <Card title="2FA 设置结果" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Text strong>状态: </Text>
                <Text>{setupResult.twoFaResult.success ? '成功' : '失败'}</Text>
              </Col>
              {setupResult.twoFaResult.secretKey && (
                <Col span={24}>
                  <Text strong>密钥: </Text>
                  <Text>{setupResult.twoFaResult.secretKey}</Text>
                </Col>
              )}
            </Row>
          </Card>
        )}
        
        {setupResult.kycResult && (
          <Card title="KYC 设置结果" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Text strong>状态: </Text>
                <Text>{setupResult.kycResult.success ? '成功' : '失败'}</Text>
              </Col>
              {setupResult.kycResult.message && (
                <Col span={24}>
                  <Text strong>详情: </Text>
                  <Text>{setupResult.kycResult.message}</Text>
                </Col>
              )}
            </Row>
          </Card>
        )}
        
        {setupResult.cardResult && (
          <Card title="开卡结果" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Text strong>状态: </Text>
                <Text>{setupResult.cardResult.success ? '成功' : '失败'}</Text>
              </Col>
              {setupResult.cardResult.cardId && (
                <Col span={24}>
                  <Text strong>卡片ID: </Text>
                  <Text>{setupResult.cardResult.cardId}</Text>
                </Col>
              )}
            </Row>
          </Card>
        )}
      </div>
    );
  };

  return (
    <Modal
      title="一键注册级用户"
      open={visible}
      onCancel={handleClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          关闭
        </Button>,
        <Button
          key="reset"
          onClick={handleReset}
          disabled={loading}
          style={{ display: setupSuccess ? 'none' : 'inline-block' }}
        >
          重置
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={() => form.submit()}
          loading={loading}
          style={{ display: setupSuccess ? 'none' : 'inline-block' }}
        >
          一键设置
        </Button>,
      ]}
    >
      {setupSuccess ? (
        renderSetupResult()
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            emailPrefix: generateRandomEmailPrefix(),
            domain: 'gmail.com',
            password: generateRandomPassword(),
            enable2FA: true,
            enableKYC: true,
            enableCard: true,
          }}
        >
          <Title level={5}>账户信息</Title>
          <Row gutter={16}>
            <Col span={14}>
              <Form.Item
                name="emailPrefix"
                label="邮箱前缀"
                rules={[{ required: true, message: '请输入邮箱前缀' }]}
              >
                <Input 
                  addonAfter={
                    <Button 
                      type="text" 
                      icon={<ReloadOutlined />} 
                      onClick={generateRandomEmail}
                      style={{ border: 'none', padding: 0 }}
                    />
                  }
                  placeholder="输入邮箱前缀"
                />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="domain"
                label="域名"
                rules={[{ required: true, message: '请选择域名' }]}
              >
                <Input placeholder="gmail.com" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password 
              placeholder="输入密码" 
              addonAfter={
                <Button 
                  type="text" 
                  icon={<ReloadOutlined />} 
                  onClick={generatePassword}
                  style={{ border: 'none', padding: 0 }}
                />
              }
            />
          </Form.Item>
          
          <Divider orientation="left">功能选择</Divider>
          
          <Form.Item name="enable2FA" valuePropName="checked">
            <Checkbox>
              <Space>
                <SafetyCertificateOutlined />
                <span>启用自动2FA</span>
              </Space>
            </Checkbox>
          </Form.Item>
          
          <Form.Item name="enableKYC" valuePropName="checked">
            <Checkbox>
              <Space>
                <IdcardOutlined />
                <span>启用自动KYC认证</span>
              </Space>
            </Checkbox>
          </Form.Item>
          
          <Form.Item name="enableCard" valuePropName="checked">
            <Checkbox>
              <Space>
                <CreditCardOutlined />
                <span>启用一键开卡</span>
              </Space>
            </Checkbox>
          </Form.Item>
          
          <Alert
            message="提示"
            description="一键注册级用户将自动完成随机用户注册、账户创建、2FA验证、KYC认证和一键开卡流程，您可以选择需要开启的功能。"
            type="info"
            showIcon
          />
        </Form>
      )}
      
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin 
            indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} 
            tip="正在进行一键式账户设置..."
          />
        </div>
      )}
      
      {setupResult && !setupSuccess && (
        <Alert
          message="设置失败"
          description={setupResult.error}
          type="error"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </Modal>
  );
};

export default OneClickSetupModal;