/**
 * 账户注册模态框组件
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Select,
  message,
  Alert,
  Space,
  Divider,
  Typography,
  Checkbox,
  Row,
  Col,
  Tooltip
} from 'antd';
import { QuestionCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { infiniAccountApi, randomUserApi } from '../../../services/api';

const { Option } = Select;
const { Text } = Typography;

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
  const [randomUsers, setRandomUsers] = useState<any[]>([]);
  const [loadingRandomUsers, setLoadingRandomUsers] = useState(false);
  const [selectedRandomUserId, setSelectedRandomUserId] = useState<number | null>(null);

  // 获取随机用户列表
  const fetchRandomUsers = async () => {
    try {
      setLoadingRandomUsers(true);
      const response = await randomUserApi.getAvailableRandomUsers();
      
      if (response.success && response.data) {
        setRandomUsers(response.data);
      } else {
        message.error(response.message || '获取随机用户列表失败');
      }
    } catch (error: any) {
      console.error('获取随机用户列表失败:', error);
      message.error(error.message || '获取随机用户列表失败');
    } finally {
      setLoadingRandomUsers(false);
    }
  };

  // 当模态框打开时，获取随机用户列表
  useEffect(() => {
    if (visible) {
      fetchRandomUsers();
      form.resetFields();
    }
  }, [visible, form]);

  // 处理随机用户选择
  const handleRandomUserSelect = (value: number) => {
    setSelectedRandomUserId(value);
    
    // 找到选中的随机用户
    const selectedUser = randomUsers.find(user => user.id === value);
    
    if (selectedUser) {
      // 自动填充表单
      form.setFieldsValue({
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        email: selectedUser.email,
        password: selectedUser.password || 'Abc123456', // 使用默认密码或随机用户的密码
        mockUserId: selectedUser.id
      });
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      await form.validateFields();
      const values = form.getFieldsValue();
      
      setLoading(true);
      
      // 调用注册API
      const response = await infiniAccountApi.registerAccount({
        ...values,
        emailVerified: 1 // 默认将邮箱验证设为已验证
      });
      
      if (response.success) {
        message.success('账户注册成功');
        form.resetFields();
        onSuccess();
        onClose();
      } else {
        message.error(response.message || '账户注册失败');
      }
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请检查表单填写是否正确');
      } else {
        console.error('账户注册失败:', error);
        message.error(error.message || '账户注册失败');
      }
    } finally {
      setLoading(false);
    }
  };

  // 生成随机密码
  const generateRandomPassword = () => {
    const length = 10;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    
    // 确保密码至少包含一个大写字母、一个小写字母、一个数字和一个特殊字符
    password += "A"; // 大写字母
    password += "a"; // 小写字母
    password += "1"; // 数字
    password += "!"; // 特殊字符
    
    // 填充剩余长度
    for (let i = 4; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }
    
    // 打乱密码顺序
    password = password.split('').sort(() => 0.5 - Math.random()).join('');
    
    form.setFieldsValue({ password });
  };

  return (
    <Modal
      title="注册Infini账户"
      open={visible}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSubmit}>
          注册
        </Button>
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          emailVerified: 1,
          password: 'Abc123456' // 默认密码
        }}
      >
        <Alert
          message="注册说明"
          description="注册Infini账户会创建一个新的Infini账户，并将其添加到本系统中进行管理。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Divider orientation="left">使用随机用户数据(可选)</Divider>
        
        <Form.Item label="选择随机用户">
          <Select
            placeholder="选择一个随机用户以自动填充信息"
            allowClear
            loading={loadingRandomUsers}
            onChange={handleRandomUserSelect}
            style={{ width: '100%' }}
          >
            {randomUsers.map(user => (
              <Option key={user.id} value={user.id}>
                {user.firstName} {user.lastName} ({user.email})
              </Option>
            ))}
          </Select>
          <Text type="secondary" style={{ fontSize: 12 }}>
            选择随机用户后将自动填充表单信息
          </Text>
        </Form.Item>
        
        <Divider orientation="left">账户基本信息</Divider>
        
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="名"
              name="firstName"
              rules={[{ required: true, message: '请输入名' }]}
            >
              <Input placeholder="例如: John" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="姓"
              name="lastName"
              rules={[{ required: true, message: '请输入姓' }]}
            >
              <Input placeholder="例如: Doe" />
            </Form.Item>
          </Col>
        </Row>
        
        <Form.Item
          label="邮箱"
          name="email"
          rules={[
            { required: true, message: '请输入邮箱地址' },
            { type: 'email', message: '请输入有效的邮箱地址' }
          ]}
        >
          <Input placeholder="例如: example@gmail.com" />
        </Form.Item>
        
        <Form.Item
          label={
            <Space>
              <span>密码</span>
              <Tooltip title="密码必须包含至少一个大写字母、一个小写字母和一个数字，长度至少为8位">
                <QuestionCircleOutlined />
              </Tooltip>
            </Space>
          }
          name="password"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 8, message: '密码长度不能少于8位' },
            {
              pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
              message: '密码必须包含大小写字母和数字'
            }
          ]}
          extra={
            <Button type="link" size="small" onClick={generateRandomPassword} style={{ paddingLeft: 0 }}>
              生成随机密码
            </Button>
          }
        >
          <Input.Password placeholder="输入至少8位包含大小写字母和数字的密码" />
        </Form.Item>
        
        <Form.Item
          label="邮箱验证状态"
          name="emailVerified"
          initialValue={1}
        >
          <Select>
            <Option value={1}>已验证</Option>
            <Option value={0}>未验证</Option>
          </Select>
        </Form.Item>
        
        <Form.Item name="mockUserId" hidden>
          <Input />
        </Form.Item>
        
        <Divider orientation="left">高级选项</Divider>
        
        <Form.Item
          name="enableKyc"
          valuePropName="checked"
        >
          <Checkbox>
            <Space>
              <span>自动完成KYC认证</span>
              <Tooltip title="开启此选项将自动为该账户完成KYC认证流程">
                <InfoCircleOutlined />
              </Tooltip>
            </Space>
          </Checkbox>
        </Form.Item>
        
        <Form.Item
          name="enable2fa"
          valuePropName="checked"
        >
          <Checkbox>
            <Space>
              <span>自动绑定2FA</span>
              <Tooltip title="开启此选项将自动为该账户绑定2FA验证">
                <InfoCircleOutlined />
              </Tooltip>
            </Space>
          </Checkbox>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AccountRegisterModal;