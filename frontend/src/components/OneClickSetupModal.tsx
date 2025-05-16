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
import api, { infiniAccountApi, randomUserApi, totpToolApi, kycImageApi, apiBaseUrl } from '../services/api';

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
      
      // 步骤1: 生成随机用户信息
      message.loading('正在生成随机用户...');
      const randomUserResponse = await randomUserApi.generateRandomUsers({
        email_suffix: "protonmail.com", // 默认使用protonmail作为随机邮箱后缀
        count: 1 // 只生成1个随机用户
      });
      
      if (!randomUserResponse.success || !randomUserResponse.data || randomUserResponse.data.length === 0) {
        throw new Error(randomUserResponse.message || '生成随机用户失败');
      }
      
      const randomUser = randomUserResponse.data[0];
      message.success(`已生成随机用户: ${randomUser.full_email}`);
      
      // 步骤2: 创建Infini账户
      message.loading('正在创建账户...');
      const accountResponse = await infiniAccountApi.createAccount(
        randomUser.full_email, 
        randomUser.password,
        randomUser.id // 关联随机用户ID
      );
      
      if (!accountResponse.success || !accountResponse.data) {
        throw new Error(accountResponse.message || '创建账户失败');
      }
      
      const account = accountResponse.data;
      const accountId = account.id.toString();
      message.success('账户创建成功');
      
      let is2faEnabled = false;
      let isKycEnabled = false;
      let isCardEnabled = false;
      
      // 步骤3: 如果选择了自动2FA，执行2FA配置
      if (values.enable2fa) {
        message.loading('正在配置2FA...');
        try {
          // 步骤3.1: 获取2FA二维码
          const qrCodeResponse = await infiniAccountApi.getGoogle2faQrCode(accountId);
          
          if (!qrCodeResponse.success || !qrCodeResponse.data || !qrCodeResponse.data.qr_code) {
            throw new Error('获取2FA二维码失败');
          }
          
          const qrCodeUrl = qrCodeResponse.data.qr_code;
          
          // 步骤3.2: 发送2FA验证邮件
          const emailResponse = await infiniAccountApi.sendVerificationCode(randomUser.full_email, 6);
          
          if (!emailResponse.success) {
            throw new Error('发送2FA验证邮件失败');
          }
          
          // 步骤3.3: 获取邮箱验证码
          const emailVerificationResponse = await infiniAccountApi.fetchVerificationCode(
            randomUser.full_email,
            undefined,
            10,
            5
          );
          
          if (!emailVerificationResponse.success || !emailVerificationResponse.data.code) {
            throw new Error('获取邮箱验证码失败');
          }
          
          const emailVerificationCode = emailVerificationResponse.data.code;
          
          // 步骤3.4: 使用TOTP工具生成2FA验证码
          const totpResponse = await totpToolApi.generateTotpCode(qrCodeUrl);
          
          if (!totpResponse.success || !totpResponse.data.code) {
            throw new Error('生成2FA验证码失败');
          }
          
          const totpCode = totpResponse.data.code;
          
          // 步骤3.5: 绑定2FA
          const bindResponse = await infiniAccountApi.bindGoogle2fa(
            emailVerificationCode,
            totpCode,
            accountId
          );
          
          if (!bindResponse.success) {
            throw new Error('绑定2FA失败');
          }
          
          // 步骤3.6: 同步账户信息
          await infiniAccountApi.syncAccount(accountId);
          
          is2faEnabled = true;
          message.success('2FA配置成功');
        } catch (error: any) {
          message.warning(`2FA配置失败: ${error.message}`);
          console.error('2FA配置失败:', error);
        }
      }
      
      // 步骤4: 如果选择了自动KYC，执行KYC验证
      if (values.enableKyc) {
        message.loading('正在进行KYC认证...');
        try {
          // 步骤4.1: 获取随机KYC图片
          const kycImageResponse = await kycImageApi.getRandomKycImage();
          
          if (!kycImageResponse.success || !kycImageResponse.data) {
            throw new Error('获取KYC图片失败');
          }
          
          // 步骤4.2: 上传KYC图片
          const imageData = kycImageResponse.data.img_base64 || kycImageResponse.data.base64;
          
          if (!imageData) {
            throw new Error('KYC图片数据无效');
          }
          
          // 处理base64数据
          let cleanImageData = imageData;
          if (cleanImageData.includes('base64,')) {
            cleanImageData = cleanImageData.split('base64,')[1];
          }
          
          // 将base64转换为二进制数据
          const byteCharacters = atob(cleanImageData);
          const byteArrays = [];
          
          for (let offset = 0; offset < byteCharacters.length; offset += 512) {
            const slice = byteCharacters.slice(offset, offset + 512);
            
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
              byteNumbers[i] = slice.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
          }
          
          // 创建图片Blob
          const blob = new Blob(byteArrays, { type: 'image/jpeg' });
          const imageFile = new File([blob], `kyc_image_${kycImageResponse.data.id}.jpg`, { type: 'image/jpeg' });
          
          // 上传KYC图片
          const uploadResponse = await infiniAccountApi.uploadKycImage(accountId, imageFile);
          
          if (!uploadResponse.success) {
            throw new Error('上传KYC图片失败');
          }
          
          const fileName = uploadResponse.data.file_name;
          
          // 步骤4.3: 提交护照信息
          const kycData = {
            phoneNumber: randomUser.phone.replace(/^\+\d+\s+/, ''), // 移除前缀如 "+86 "
            phoneCode: randomUser.phone.match(/^\+(\d+)/)?.[0] || '+86',
            firstName: randomUser.first_name,
            lastName: randomUser.last_name,
            country: 'CHN', // 默认使用中国
            passportNumber: randomUser.passport_no,
            fileName
          };
          
          // 提交KYC信息
          try {
            const kycResponse = await api.post(
              `${apiBaseUrl}/api/infini-accounts/kyc/passport`,
              {
                accountId,
                ...kycData
              }
            );
            
            if (kycResponse.data.success || kycResponse.data.message?.includes("Kyc already exist")) {
              isKycEnabled = true;
              message.success('KYC认证成功');
            } else {
              throw new Error(kycResponse.data.message || '提交KYC信息失败');
            }
          } catch (kycError: any) {
            // 特殊处理"Kyc already exist"错误
            if (kycError.response?.data?.message?.includes("Kyc already exist") || 
                kycError.message?.includes("Kyc already exist")) {
              isKycEnabled = true;
              message.success('KYC已存在，认证成功');
            } else {
              throw kycError;
            }
          }
        } catch (error: any) {
          message.warning(`KYC认证失败: ${error.message}`);
          console.error('KYC认证失败:', error);
        }
      }
      
      // 步骤5: 如果选择了自动开卡，执行卡片申请
      if (values.enableCard) {
        message.loading('正在申请卡片...');
        try {
          // 步骤5.1: 获取KYC信息
          const kycInfoResponse = await infiniAccountApi.getKycInformation(accountId);
          
          if (!kycInfoResponse.success || !kycInfoResponse.data.kyc_information || 
              kycInfoResponse.data.kyc_information.length === 0) {
            throw new Error('获取KYC信息失败');
          }
          
          const kycInfo = kycInfoResponse.data.kyc_information[0];
          
          // 步骤5.2: 调用/card/kyc/basic接口
          const cardKycBasicData = {
            first_name: kycInfo.first_name,
            last_name: kycInfo.last_name,
            phone_code: kycInfo.phone_code,
            phone_number: kycInfo.phone,
            birthday: "1990-01-01" // 默认生日
          };
          
          const cardKycResponse = await api.post(
            `${apiBaseUrl}/api/infini-cards/kyc/basic`,
            {
              accountId,
              kycData: cardKycBasicData
            }
          );
          
          if (!cardKycResponse.data.success && 
              !cardKycResponse.data.message?.includes('Kyc already exist')) {
            throw new Error('提交卡片KYC信息失败');
          }
          
          // 步骤5.3: 申请卡片
          const cardType = 3; // 默认使用Card 3
          const cardApplyResponse = await api.post(
            `${apiBaseUrl}/api/infini-cards/apply`,
            {
              accountId,
              cardType
            }
          );
          
          if (!cardApplyResponse.data.success) {
            throw new Error('申请卡片失败');
          }
          
          isCardEnabled = true;
          message.success('卡片申请成功');
        } catch (error: any) {
          message.warning(`卡片申请失败: ${error.message}`);
          console.error('卡片申请失败:', error);
        }
      }
      
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