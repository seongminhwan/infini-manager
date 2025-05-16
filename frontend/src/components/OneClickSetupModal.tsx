/**
 * 一键式账户设置模态框
 * 用于一键完成随机用户注册、自动2FA、自动KYC和一键开卡的功能
 */
import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  message,
  Checkbox,
  Space,
  Spin,
  Typography,
  Result,
  Divider,
  Descriptions
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  IdcardOutlined,
  CreditCardOutlined
} from '@ant-design/icons';
import { infiniAccountApi } from '../services/api';

const { Text } = Typography;

// 接口定义
interface OneClickSetupProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// 表单数据接口
interface OneClickSetupFormData {
  email: string;
  password: string;
  enable2fa: boolean;
  enableKyc: boolean;
  enableCard: boolean;
}

// 响应结果接口
interface SetupResult {
  success: boolean;
  accountId?: number;
  email?: string;
  userId?: string;
  is2faEnabled?: boolean;
  isKycEnabled?: boolean;
  isCardEnabled?: boolean;
  message?: string;
}

// 生成随机强密码
const generateStrongPassword = (): string => {
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

// 随机生成邮箱地址
const generateRandomEmail = (): string => {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'protonmail.com'];
  const adjectives = ['happy', 'clever', 'smart', 'bright', 'sharp', 'wise', 'cool', 'amazing', 'awesome', 'brilliant'];
  const nouns = ['user', 'person', 'player', 'student', 'teacher', 'developer', 'coder', 'gamer', 'master', 'ninja'];
  
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomNum = Math.floor(Math.random() * 10000);
  const domain = domains[Math.floor(Math.random() * domains.length)];
  
  return `${adjective}.${noun}${randomNum}@${domain}`;
};

// 一键式账户设置模态框组件
const OneClickSetupModal: React.FC<OneClickSetupProps> = ({ visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  
  // 重置状态
  const resetState = () => {
    form.resetFields();
    setSetupResult(null);
  };
  
  // 处理关闭
  const handleClose = () => {
    resetState();
    onClose();
  };
  
  // 生成随机信息
  const generateRandomInfo = () => {
    form.setFieldsValue({
      email: generateRandomEmail(),
      password: generateStrongPassword()
    });
    message.success('已生成随机账户信息');
  };
  
  // 提交表单
  const handleSubmit = async (values: OneClickSetupFormData) => {
    try {
      setLoading(true);
      
      // 从邮箱中提取后缀
      const emailParts = values.email.split('@');
      const emailSuffix = emailParts.length > 1 ? emailParts[1] : '';
      
      // 调用一键式账户设置API，传递两个所需参数
      const response = await infiniAccountApi.oneClickAccountSetup(
        {
          email: values.email,
          password: values.password,
          enable2fa: values.enable2fa,
          enableKyc: values.enableKyc,
          enableCard: values.enableCard
        },
        {
          email_suffix: emailSuffix
        }
      );
      
      if (response.success) {
        message.success('一键式账户设置成功');
        // 设置结果
        setSetupResult({
          success: true,
          accountId: response.data.accountId,
          email: response.data.email,
          userId: response.data.userId,
          is2faEnabled: response.data.is2faEnabled,
          isKycEnabled: response.data.isKycEnabled,
          isCardEnabled: response.data.isCardEnabled,
        });
        
        // 刷新账户列表
        onSuccess();
      } else {
        message.error(response.message || '一键式账户设置失败');
        setSetupResult({
          success: false,
          message: response.message || '一键式账户设置失败，请重试'
        });
      }
    } catch (error: any) {
      console.error('一键式账户设置出错:', error);
      message.error('一键式账户设置失败: ' + error.message);
      setSetupResult({
        success: false,
        message: error.message || '一键式账户设置失败，请重试'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // 渲染表单
  const renderForm = () => (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        enable2fa: true,
        enableKyc: true,
        enableCard: true
      }}
    >
      <Form.Item
        name="email"
        label="邮箱"
        rules={[
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '请输入有效的邮箱地址' }
        ]}
      >
        <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
      </Form.Item>
      
      <Form.Item
        name="password"
        label="密码"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password 
          prefix={<LockOutlined />} 
          placeholder="请输入密码" 
          addonAfter={
            <Button 
              type="text" 
              icon={<ReloadOutlined />} 
              onClick={(e) => {
                e.preventDefault();
                form.setFieldsValue({ password: generateStrongPassword() });
              }}
              style={{ border: 'none', padding: 0 }}
            />
          }
        />
      </Form.Item>
      
      <Divider orientation="left">自动化步骤选择</Divider>
      
      <Form.Item name="enable2fa" valuePropName="checked">
        <Checkbox>
          <Space>
            <SafetyCertificateOutlined />
            自动开启2FA
          </Space>
        </Checkbox>
      </Form.Item>
      
      <Form.Item name="enableKyc" valuePropName="checked">
        <Checkbox>
          <Space>
            <IdcardOutlined />
            自动进行KYC认证
          </Space>
        </Checkbox>
      </Form.Item>
      
      <Form.Item name="enableCard" valuePropName="checked">
        <Checkbox>
          <Space>
            <CreditCardOutlined />
            自动开通卡片
          </Space>
        </Checkbox>
      </Form.Item>
      
      <Form.Item>
        <Button block type="dashed" icon={<ReloadOutlined />} onClick={generateRandomInfo}>
          生成随机账户信息
        </Button>
      </Form.Item>
      
      <Form.Item>
        <Text type="secondary">
          <InfoCircleOutlined style={{ marginRight: 8 }} />
          一键式账户设置将自动完成选定的所有步骤，无需额外操作
        </Text>
      </Form.Item>
    </Form>
  );
  
  // 渲染结果页面
  const renderResult = () => {
    if (!setupResult) return null;
    
    if (setupResult.success) {
      return (
        <Result
          status="success"
          title="一键式账户设置成功"
          subTitle="账户已创建并完成选定的所有步骤"
          extra={[
            <Button type="primary" key="back" onClick={handleClose}>
              完成
            </Button>
          ]}
        >
          <Descriptions column={1} bordered>
            <Descriptions.Item label="账户ID">{setupResult.accountId}</Descriptions.Item>
            <Descriptions.Item label="用户ID">{setupResult.userId}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{setupResult.email}</Descriptions.Item>
            <Descriptions.Item label="2FA状态">
              {setupResult.is2faEnabled ? '已开启' : '未开启'}
            </Descriptions.Item>
            <Descriptions.Item label="KYC状态">
              {setupResult.isKycEnabled ? '已认证' : '未认证'}
            </Descriptions.Item>
            <Descriptions.Item label="卡片状态">
              {setupResult.isCardEnabled ? '已开通' : '未开通'}
            </Descriptions.Item>
          </Descriptions>
        </Result>
      );
    } else {
      return (
        <Result
          status="error"
          title="一键式账户设置失败"
          subTitle={setupResult.message || '请重试或联系管理员'}
          extra={[
            <Button type="primary" key="retry" onClick={() => setSetupResult(null)}>
              重试
            </Button>,
            <Button key="back" onClick={handleClose}>
              关闭
            </Button>
          ]}
        />
      );
    }
  };
  
  return (
    <Modal
      title="一键注册级用户"
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={600}
    >
      <Spin spinning={loading}>
        {setupResult ? renderResult() : (
          <div>
            {renderForm()}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button onClick={handleClose}>
                取消
              </Button>
              <Button 
                type="primary" 
                onClick={() => form.submit()}
                loading={loading}
              >
                开始设置
              </Button>
            </div>
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default OneClickSetupModal;