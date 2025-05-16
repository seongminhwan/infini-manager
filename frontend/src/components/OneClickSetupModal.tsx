/**
 * 一键式账户设置模态框
 * 用于一键完成随机用户注册、自动2FA、自动KYC和一键开卡的功能
 */
import React, { useState, useEffect } from 'react';
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
  Descriptions,
  Select
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
import api, { infiniAccountApi, randomUserApi, totpToolApi, kycImageApi, apiBaseUrl, configApi, emailAccountApi } from '../services/api';

const { Text } = Typography;

// 接口定义
interface OneClickSetupProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// 表单数据接口
interface OneClickSetupFormData {
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
  const [mainEmail, setMainEmail] = useState<string>(''); // 存储已选择的主邮箱
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]); // 邮箱账户列表
  const [loadingEmails, setLoadingEmails] = useState(false); // 邮箱列表加载状态
  
  // 获取邮箱账户列表
  useEffect(() => {
    const fetchEmailAccounts = async () => {
      try {
        setLoadingEmails(true);
        // 获取所有邮箱账户
        const response = await emailAccountApi.getAllEmailAccounts();
        if (response.success && response.data) {
          console.log('获取到邮箱账户列表:', response.data);
          setEmailAccounts(response.data);
          
          // 如果有默认邮箱账户，自动选中
          const defaultAccount = response.data.find((account: any) => account.isDefault);
          if (defaultAccount) {
            setMainEmail(defaultAccount.email);
            form.setFieldsValue({ mainEmail: defaultAccount.email });
            console.log('自动选择默认邮箱:', defaultAccount.email);
          }
        }
      } catch (error) {
        console.error('获取邮箱账户列表失败:', error);
        message.error('获取邮箱列表失败，请稍后重试');
      } finally {
        setLoadingEmails(false);
      }
    };
    
    if (visible) {
      fetchEmailAccounts();
    }
  }, [visible, form]);
  
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
      
      // 调用后端一键式账户设置API
      message.loading('正在执行一键式账户设置...');
      
      // 准备请求参数
      const setupOptions = {
        enable2fa: values.enable2fa,
        enableKyc: values.enableKyc,
        enableCard: values.enableCard,
        cardType: 3 // 默认使用Card 3
      };
      
      // 提取后缀，并准备数据
      let emailSuffix = '';
      if (mainEmail) {
        // 尝试从主邮箱中提取后缀
        const atIndex = mainEmail.indexOf('@');
        if (atIndex !== -1) {
          emailSuffix = mainEmail.substring(atIndex + 1);
        }
      }
      
      // 如果无法从主邮箱提取后缀，使用默认值
      if (!emailSuffix) {
        emailSuffix = 'protonmail.com';
      }
      
      const userData = {
        email_suffix: emailSuffix, // 为了满足API类型要求
        main_email: mainEmail // 附加主邮箱信息，让后端可以使用
      };
      
      console.log('发送一键式账户设置请求，参数:', { setupOptions, userData });
      
      // 调用后端API
      const response = await infiniAccountApi.oneClickAccountSetup(setupOptions, userData);
      
      console.log('一键式账户设置响应:', response);
      
      if (!response.success) {
        throw new Error(response.message || '一键式账户设置失败');
      }
      
      // 提取响应数据
      const { accountId, randomUser, account, steps } = response.data;
      
      // 确定各步骤执行状态
      const is2faEnabled = steps.twoFa?.success || false;
      const isKycEnabled = steps.kyc?.success || false;
      const isCardEnabled = steps.card?.success || false;
      
      // 显示成功消息
      message.success('一键式账户设置成功');
      
      // 设置操作结果
      setSetupResult({
        success: true,
        accountId: account.id,
        email: randomUser.full_email,
        userId: account.userId,
        is2faEnabled,
        isKycEnabled,
        isCardEnabled,
      });
      
      // 刷新账户列表
      onSuccess();
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
      title="一键注册随机用户"
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