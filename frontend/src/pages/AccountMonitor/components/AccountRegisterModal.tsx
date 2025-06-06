/**
 * 账户注册模态框组件
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
  Row,
  Col,
  Divider,
  Alert
} from 'antd';
import { LockOutlined, UserOutlined, MailOutlined } from '@ant-design/icons';
import { infiniAccountApi } from '../../../services/api';

interface AccountRegisterModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AccountRegisterModal: React.FC<AccountRegisterModalProps> = ({
  visible,
  onClose,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [autoKYC, setAutoKYC] = useState<boolean>(false);
  const [auto2FA, setAuto2FA] = useState<boolean>(false);
  const [customPassword, setCustomPassword] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [useMockUserId, setUseMockUserId] = useState<boolean>(false);
  const [mockUserId, setMockUserId] = useState<string>('');

  // 生成随机密码
  const generateRandomPassword = (): string => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+';
    let password = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    return password;
  };

  // 重置表单
  const resetForm = () => {
    form.resetFields();
    setAutoKYC(false);
    setAuto2FA(false);
    setCustomPassword(false);
    setPassword('');
    setUseMockUserId(false);
    setMockUserId('');
  };

  // 关闭模态框
  const handleCancel = () => {
    resetForm();
    onClose();
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 构建注册数据
      const registerData = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: customPassword ? password : generateRandomPassword(),
        autoKYC,
        auto2FA
      };

      // 如果使用模拟用户ID
      if (useMockUserId && mockUserId) {
        // 使用类型断言来添加可选属性
        (registerData as any).mockUserId = mockUserId;
      }

      // 调用注册API - 使用正确的参数格式
      const mockUserIdNum = useMockUserId && mockUserId ? parseInt(mockUserId) : undefined;
      const response = await infiniAccountApi.createAccount(
        values.email,
        customPassword ? password : generateRandomPassword(),
        mockUserIdNum
      );

      if (response.success) {
        message.success('账户注册成功');
        resetForm();
        onSuccess();
        onClose();
      } else {
        message.error(response.message || '账户注册失败');
      }
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请检查表单填写是否正确');
      } else {
        message.error(error.message || '账户注册失败');
        console.error('账户注册失败:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="注册Infini账户"
      visible={visible}
      onCancel={handleCancel}
      footer={null}
      width={700}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="名"
              name="firstName"
              rules={[{ required: true, message: '请输入名' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="请输入名" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="姓"
              name="lastName"
              rules={[{ required: true, message: '请输入姓' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="请输入姓" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="邮箱"
          name="email"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效的邮箱地址' }
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
        </Form.Item>

        <Form.Item label="密码设置">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Checkbox
              checked={customPassword}
              onChange={(e) => setCustomPassword(e.target.checked)}
            >
              自定义密码
            </Checkbox>
            
            {customPassword ? (
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            ) : (
              <Alert
                message="将使用系统生成的随机密码"
                type="info"
                showIcon
              />
            )}
          </Space>
        </Form.Item>

        <Divider />

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="KYC认证">
              <Checkbox
                checked={autoKYC}
                onChange={(e) => setAutoKYC(e.target.checked)}
              >
                自动完成KYC认证
              </Checkbox>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="2FA认证">
              <Checkbox
                checked={auto2FA}
                onChange={(e) => setAuto2FA(e.target.checked)}
              >
                自动完成2FA绑定
              </Checkbox>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="模拟用户ID">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Checkbox
              checked={useMockUserId}
              onChange={(e) => setUseMockUserId(e.target.checked)}
            >
              使用模拟用户ID
            </Checkbox>
            
            {useMockUserId && (
              <Input
                placeholder="请输入模拟用户ID"
                value={mockUserId}
                onChange={(e) => setMockUserId(e.target.value)}
              />
            )}
          </Space>
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" onClick={handleSubmit} loading={loading}>
              注册账户
            </Button>
            <Button onClick={handleCancel}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AccountRegisterModal;