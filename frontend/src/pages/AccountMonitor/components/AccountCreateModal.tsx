/**
 * 账户创建模态窗组件
 */
import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Space,
  Spin,
  Typography,
  Statistic,
  Tag,
  Descriptions,
  Divider,
  Row,
  Col,
  message,
  Checkbox,
  Radio
} from 'antd';
import {
  MailOutlined,
  LockOutlined,
  SyncOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  ExclamationCircleOutlined,
  DollarOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { apiBaseUrl, infiniAccountApi } from '../../../services/api';
import { InfiniAccount, SyncStage } from '../types';
import { formatTimestamp, formatAmount } from '../utils';

const { Title, Text } = Typography;

// 组件接口定义
interface AccountCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// API基础URL
const API_BASE_URL = apiBaseUrl;

// 账户创建模态窗组件
const AccountCreateModal: React.FC<AccountCreateModalProps> = ({ visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accountInfo, setAccountInfo] = useState<InfiniAccount | null>(null);
  const [syncStage, setSyncStage] = useState<SyncStage>('idle');
  const [syncError, setSyncError] = useState<string>('');
  // 自定义邮箱配置状态
  const [useCustomEmailConfig, setUseCustomEmailConfig] = useState(false);
  // 自定义邮箱配置表单
  const [customEmailForm] = Form.useForm();

  // 重置状态
  const resetState = () => {
    setSyncStage('idle');
    setSyncError('');
    setAccountInfo(null);
    form.resetFields();
    setUseCustomEmailConfig(false);
    customEmailForm.resetFields();
  };

  // 处理关闭
  const handleClose = () => {
    resetState();
    onClose();
  };

  // 获取账户信息
  const fetchAccountInfo = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      // 更新同步状态
      setSyncStage('login');

      // 第一步：登录
      const loginResponse = await api.post(`${API_BASE_URL}/api/infini-accounts/login`, {
        email: values.email,
        password: values.password,
      });

      if (!loginResponse.data.success) {
        setSyncStage('error');
        setSyncError(loginResponse.data.message || '登录失败');
        setLoading(false);
        return;
      }

      // 更新同步状态
      setSyncStage('fetch');

      // 等待一小段时间，让用户看到状态变化
      await new Promise(resolve => setTimeout(resolve, 500));

      // 设置账户信息
      setAccountInfo(loginResponse.data.data);
      setSyncStage('complete');

    } catch (error: any) {
      setSyncStage('error');
      setSyncError(error.response?.data?.message || error.message || '获取账户信息失败');
      console.error('获取账户信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 保存账户信息
  const saveAccountInfo = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      const accountPayload: any = {
        email: values.email,
        password: values.password,
      };

      // 如果启用了自定义邮箱配置，则添加相关数据
      if (useCustomEmailConfig) {
        try {
          // 验证自定义邮箱配置表单
          const customEmailValues = await customEmailForm.validateFields();

          // 准备自定义邮箱配置数据
          const customEmailConfig: any = {
            email: customEmailValues.custom_email_address,
            password: customEmailValues.custom_email_password,
            imap_host: customEmailValues.custom_imap_host,
            imap_port: Number(customEmailValues.custom_imap_port),
            imap_secure: customEmailValues.imap_secure,
            smtp_host: customEmailValues.custom_smtp_host,
            smtp_port: Number(customEmailValues.custom_smtp_port),
            smtp_secure: customEmailValues.smtp_secure,
            status: customEmailValues.custom_email_status,
            extra_config: null,
          };

          // 处理额外配置的JSON转换
          if (customEmailValues.custom_extra_config && typeof customEmailValues.custom_extra_config === 'string') {
            try {
              customEmailConfig.extra_config = JSON.parse(customEmailValues.custom_extra_config);
            } catch (e) {
              message.error('额外配置JSON格式无效，请检查');
              setLoading(false);
              return;
            }
          }

          accountPayload.customEmailConfig = customEmailConfig;
        } catch (error: any) {
          message.error('请完成自定义邮箱配置表单');
          setLoading(false);
          return;
        }
      }

      const response = await api.post(`${API_BASE_URL}/api/infini-accounts`, accountPayload);

      if (response.data.success) {
        message.success('成功添加Infini账户');
        resetState();
        onSuccess();
        onClose();
      } else {
        message.error(response.data.message || '添加账户失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '添加账户失败');
      console.error('添加账户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 渲染账户信息
  const renderAccountInfo = () => {
    if (!accountInfo) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column' }}>
          {syncStage === 'idle' && (
            <Text type="secondary">
              <InfoCircleOutlined style={{ marginRight: 8 }} />
              请先填写并提交Infini账户信息
            </Text>
          )}

          {syncStage === 'login' && (
            <>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
              <Text style={{ marginTop: 16 }}>正在登录第三方接口...</Text>
            </>
          )}

          {syncStage === 'fetch' && (
            <>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
              <Text style={{ marginTop: 16 }}>正在调用账户余额接口...</Text>
            </>
          )}

          {syncStage === 'error' && (
            <>
              <ExclamationCircleOutlined style={{ fontSize: 32, color: '#ff4d4f', marginBottom: 16 }} />
              <Text type="danger">{syncError}</Text>
            </>
          )}
        </div>
      );
    }

    return (
      <div>
        <Title level={4}>
          账户信息
          <Tag color={accountInfo.status === 'active' ? 'green' : 'orange'} style={{ marginLeft: 8 }}>
            {accountInfo.status === 'active' ? '活跃' : accountInfo.status}
          </Tag>
        </Title>

        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="用户ID">{accountInfo.userId}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{accountInfo.email}</Descriptions.Item>
          <Descriptions.Item label="UID">{accountInfo.uid || '未设置'}</Descriptions.Item>
          <Descriptions.Item label="邀请码">{accountInfo.invitationCode || '未设置'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatTimestamp(accountInfo.infiniCreatedAt)}</Descriptions.Item>
        </Descriptions>

        <Divider orientation="left">余额信息</Divider>

        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Statistic
              title="可用余额"
              value={formatAmount(accountInfo.availableBalance)}
              prefix={<DollarOutlined />}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="提现中金额"
              value={formatAmount(accountInfo.withdrawingAmount)}
              prefix={<DollarOutlined />}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="红包余额"
              value={formatAmount(accountInfo.redPacketBalance)}
              prefix={<DollarOutlined />}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="总收益"
              value={formatAmount(accountInfo.totalEarnBalance)}
              prefix={<DollarOutlined />}
            />
          </Col>
        </Row>

        <Divider orientation="left">账户安全</Divider>

        <div>
          <Tag color={accountInfo.google2faIsBound ? 'green' : 'orange'} style={{ marginRight: 8 }}>
            {accountInfo.google2faIsBound ? 'Google 2FA 已绑定' : 'Google 2FA 未绑定'}
          </Tag>
          <Tag color={accountInfo.googlePasswordIsSet ? 'green' : 'orange'} style={{ marginRight: 8 }}>
            {accountInfo.googlePasswordIsSet ? 'Google密码已设置' : 'Google密码未设置'}
          </Tag>
          <Tag color={accountInfo.isProtected ? 'green' : 'red'} style={{ marginRight: 8 }}>
            {accountInfo.isProtected ? '已受保护' : '未受保护'}
          </Tag>
          <Tag color={accountInfo.isKol ? 'blue' : 'default'}>
            {accountInfo.isKol ? 'KOL' : '普通用户'}
          </Tag>
        </div>
      </div>
    );
  };

  return (
    <Modal
      title="添加Infini账户"
      open={visible}
      onCancel={handleClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
        <Button
          key="sync"
          type="primary"
          ghost
          icon={<SyncOutlined />}
          loading={loading && syncStage !== 'complete'}
          onClick={fetchAccountInfo}
          disabled={loading && syncStage === 'complete'}
        >
          获取账户信息
        </Button>,
        <Button
          key="save"
          type="primary"
          loading={loading && syncStage === 'complete'}
          onClick={saveAccountInfo}
          disabled={syncStage !== 'complete' || !accountInfo}
        >
          保存账户
        </Button>,
      ]}
    >
      <div style={{ minHeight: 320 }}>
        <Row gutter={24}>
          <Col span={accountInfo ? 12 : 24}>
            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
            >
              <Form.Item
                name="email"
                label="Infini登录邮箱"
                rules={[
                  { required: true, message: '请输入Infini登录邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' }
                ]}
              >
                <Input prefix={<MailOutlined />} placeholder="请输入Infini登录邮箱" />
              </Form.Item>

              <Form.Item
                name="password"
                label="Infini登录密码"
                rules={[{ required: true, message: '请输入Infini登录密码' }]}
              >
                <Input.Password prefix={<LockOutlined />} placeholder="请输入Infini登录密码" />
              </Form.Item>

              <Form.Item>
                <Checkbox
                  checked={useCustomEmailConfig}
                  onChange={(e) => setUseCustomEmailConfig(e.target.checked)}
                >
                  使用自定义邮箱配置（用于接收验证码等）
                </Checkbox>
              </Form.Item>

              {useCustomEmailConfig && (
                <div style={{ border: '1px solid #d9d9d9', borderRadius: 2, padding: 16, marginBottom: 16 }}>
                  <Form
                    form={customEmailForm}
                    layout="vertical"
                    requiredMark={false}
                    initialValues={{
                      imap_secure: true,
                      smtp_secure: true,
                      custom_email_status: 'active'
                    }}
                  >
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="custom_email_address"
                          label="邮箱地址"
                          rules={[
                            { required: true, type: 'email', message: '请输入有效的邮箱地址' }
                          ]}
                        >
                          <Input prefix={<MailOutlined />} placeholder="例如: user@example.com" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="custom_email_password"
                          label="邮箱密码/授权码"
                          rules={[{ required: true, message: '请输入邮箱密码' }]}
                        >
                          <Input.Password prefix={<LockOutlined />} placeholder="输入邮箱密码或应用授权码" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="custom_imap_host"
                          label="IMAP 主机"
                          rules={[{ required: true, message: 'IMAP 主机不能为空' }]}
                        >
                          <Input placeholder="例如: imap.example.com" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item
                          name="custom_imap_port"
                          label="IMAP 端口"
                          rules={[{ required: true, message: '请输入端口号' }]}
                        >
                          <Input type="number" placeholder="例如: 993" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item
                          name="imap_secure"
                          label="IMAP SSL/TLS"
                          valuePropName="checked"
                        >
                          <Checkbox>启用</Checkbox>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} sm={12}>
                        <Form.Item
                          name="custom_smtp_host"
                          label="SMTP 主机"
                          rules={[{ required: true, message: 'SMTP 主机不能为空' }]}
                        >
                          <Input placeholder="例如: smtp.example.com" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item
                          name="custom_smtp_port"
                          label="SMTP 端口"
                          rules={[{ required: true, message: '请输入端口号' }]}
                        >
                          <Input type="number" placeholder="例如: 465 或 587" />
                        </Form.Item>
                      </Col>
                      <Col xs={12} sm={6}>
                        <Form.Item
                          name="smtp_secure"
                          label="SMTP SSL/TLS"
                          valuePropName="checked"
                        >
                          <Checkbox>启用</Checkbox>
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item
                      name="custom_email_status"
                      label="状态"
                      rules={[{ required: true, message: '请选择状态' }]}
                    >
                      <Radio.Group>
                        <Radio value="active">激活</Radio>
                        <Radio value="disabled">禁用</Radio>
                      </Radio.Group>
                    </Form.Item>
                    <Form.Item
                      name="custom_extra_config"
                      label="额外配置 (JSON格式)"
                      getValueFromEvent={(e) => {
                        const value = e.target.value;
                        return value.trim() === '' ? null : value;
                      }}
                      rules={[
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || typeof value !== 'string') {
                              return Promise.resolve();
                            }
                            try {
                              JSON.parse(value);
                              return Promise.resolve();
                            } catch (e) {
                              return Promise.reject(new Error('额外配置必须是有效的JSON格式'));
                            }
                          },
                        }),
                      ]}
                    >
                      <Input.TextArea rows={2} placeholder='例如: {"key": "value"}' />
                    </Form.Item>
                  </Form>
                </div>
              )}

              <Form.Item>
                <Text type="secondary">
                  <InfoCircleOutlined style={{ marginRight: 8 }} />
                  系统将使用这些凭据与Infini平台交互，监控账户余额和状态变化
                </Text>
              </Form.Item>
            </Form>
          </Col>

          {accountInfo && (
            <Col span={12}>
              <div style={{ position: 'relative', height: '100%', padding: 16, borderLeft: '1px solid #f0f0f0' }}>
                {renderAccountInfo()}
              </div>
            </Col>
          )}

          {!accountInfo && (
            <Col span={24} style={{ display: syncStage !== 'idle' ? 'block' : 'none' }}>
              <Divider />
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
                {renderAccountInfo()}
              </div>
            </Col>
          )}
        </Row>
      </div>
    </Modal>
  );
};

export default AccountCreateModal;