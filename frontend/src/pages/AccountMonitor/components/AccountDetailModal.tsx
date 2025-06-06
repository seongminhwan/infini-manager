/**
 * 账户详情/编辑模态框组件
 */
import React, { useState, useEffect } from 'react';
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
  Tooltip,
  Popconfirm,
  Checkbox,
  Radio,
  Empty,
  Row,
  Col,
  Card,
  message
} from 'antd';
import {
  MailOutlined,
  LockOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  IdcardOutlined,
  DollarOutlined,
  CopyOutlined,
  CreditCardOutlined,
  BankOutlined,
  InfoCircleOutlined,
  SyncOutlined
} from '@ant-design/icons';
import api, { apiBaseUrl } from '../../../services/api';
import TwoFactorAuthModal from '../../../components/TwoFactorAuthModal';
import TwoFaViewModal from '../../../components/TwoFaViewModal';
import KycAuthModal from '../../../components/KycAuthModal';
import KycViewModal from '../../../components/KycViewModal';
import CardApplyModal from '../../../components/CardApplyModal';
import CardDetailModal from '../../../components/CardDetailModal';
import { InfiniAccount, RandomUser } from '../types';
import { formatTime, formatTimestamp, formatAmount, copyToClipboard, getActualVerificationLevel } from '../utils';

const { Title, Text } = Typography;

// 组件接口定义
interface AccountDetailModalProps {
  visible: boolean;
  account: InfiniAccount | null;
  onClose: () => void;
  onSuccess: () => void;
}

// 获取API基础URL
const API_BASE_URL = apiBaseUrl;

const AccountDetailModal: React.FC<AccountDetailModalProps> = ({ visible, account, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [mockUser, setMockUser] = useState<RandomUser | null>(null);
  const [loadingMockUser, setLoadingMockUser] = useState(false);
  const [mockUserModalVisible, setMockUserModalVisible] = useState(false);
  const [twoFactorAuthModalVisible, setTwoFactorAuthModalVisible] = useState(false);

  // 2FA详情模态框状态
  const [twoFaModalVisible, setTwoFaModalVisible] = useState(false);

  // 2FA和KYC模态框状态
  const [kycAuthModalVisible, setKycAuthModalVisible] = useState(false);
  const [kycViewModalVisible, setKycViewModalVisible] = useState(false);

  // 处理打开2FA详情模态框
  const handleView2fa = () => {
    setTwoFaModalVisible(true);
  };

  // 关闭2FA模态框
  const handleClose2faModal = () => {
    setTwoFaModalVisible(false);
  };

  // KYC数据状态
  const [kycData, setKycData] = useState<any>(null);
  const [loadingKycData, setLoadingKycData] = useState<boolean>(false);

  // 一键开卡模态框状态
  const [cardApplyModalVisible, setCardApplyModalVisible] = useState(false);

  // 卡片详情模态框状态
  const [cardDetailModalVisible, setCardDetailModalVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState<any>(null);

  // 卡片信息状态
  const [cardList, setCardList] = useState<any[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  // 自定义邮箱配置状态
  const [customEmailConfig, setCustomEmailConfig] = useState<any | null>(null); // 使用 any 避免编译时类型问题，实际应为 InfiniAccountCustomEmailConfig
  const [loadingCustomEmailConfig, setLoadingCustomEmailConfig] = useState(false);
  const [customEmailForm] = Form.useForm(); // 为自定义邮箱配置创建新的表单实例
  const [customEmailEditMode, setCustomEmailEditMode] = useState(false);

  // 获取自定义邮箱配置
  const fetchCustomEmailConfig = async (accountId: number) => {
    if (!accountId) return;
    setLoadingCustomEmailConfig(true);
    try {
      const response = await api.get(`${API_BASE_URL}/api/infini-accounts/${accountId}/custom-email-config`);
      if (response.data.success) {
        setCustomEmailConfig(response.data.data || null);
        if (response.data.data) {
          customEmailForm.setFieldsValue(response.data.data);
        } else {
          customEmailForm.resetFields();
        }
      } else {
        setCustomEmailConfig(null);
        customEmailForm.resetFields();
        // 不主动提示错误，因为可能只是未配置
        console.warn(`获取账户 ${accountId} 自定义邮箱配置失败: ${response.data.message}`);
      }
    } catch (error) {
      console.error('获取自定义邮箱配置错误:', error);
      setCustomEmailConfig(null);
      customEmailForm.resetFields();
    } finally {
      setLoadingCustomEmailConfig(false);
    }
  };

  // 刷新卡片信息
  const syncCardInfo = async () => {
    if (!account || !account.id) {
      message.error('无法刷新卡片信息：缺少账户ID');
      return;
    }

    try {
      setLoadingCards(true);
      message.loading('正在刷新卡片信息...');

      // 调用同步卡片信息接口
      const response = await api.post(`${API_BASE_URL}/api/infini-cards/sync`, {
        accountId: account.id
      });

      if (response.data.success) {
        message.success('卡片信息同步成功');
        // 获取最新的卡片列表
        await getCardList();
      } else {
        message.error(response.data.message || '卡片信息同步失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '卡片信息同步失败');
      console.error('卡片信息同步失败:', error);
    } finally {
      setLoadingCards(false);
    }
  };

  // 获取卡片列表
  const getCardList = async () => {
    if (!account || !account.id) {
      message.error('无法获取卡片信息：缺少账户ID');
      return;
    }

    try {
      setLoadingCards(true);

      // 调用获取卡片列表接口
      const response = await api.get(`${API_BASE_URL}/api/infini-cards/list`, {
        params: { accountId: account.id }
      });

      if (response.data.success) {
        setCardList(response.data.data || []);
      } else {
        message.warning(response.data.message || '未获取到卡片信息');
        setCardList([]);
      }
    } catch (error: any) {
      console.error('获取卡片列表失败:', error);
      message.error(error.response?.data?.message || error.message || '获取卡片列表失败');
      setCardList([]);
    } finally {
      setLoadingCards(false);
    }
  };

  // 查看KYC信息
  const handleViewKyc = async () => {
    if (!account || !account.id) {
      message.error('无法查看KYC信息：缺少账户ID');
      return;
    }

    console.log('开始获取KYC信息，账户ID:', account.id, '验证级别:', account.verification_level);

    // 先打开模态框，显示加载状态
    setKycViewModalVisible(true);
    setLoadingKycData(true);

    try {
      // 使用统一的api实例获取KYC信息
      const response = await api.get(`${API_BASE_URL}/api/infini-accounts/kyc/information/${account.id}`);
      console.log('获取KYC信息完整响应:', response);

      if (response.data.success && response.data.data.kyc_information && response.data.data.kyc_information.length > 0) {
        const kycInfo = response.data.data.kyc_information[0];
        console.log('获取到KYC信息:', kycInfo);
        // 添加状态信息，确保KYC认证中状态正确显示
        if (account.verification_level === 3 && (!kycInfo.status || kycInfo.status === 0)) {
          kycInfo.status = 1; // 设置为验证中状态
        }

        // 转换API返回的snake_case字段为camelCase，以匹配KycViewModal组件的期望
        const transformedKycInfo = {
          id: kycInfo.id,
          // 如果账户已KYC认证(verification_level为2)，强制设置isValid为true
          isValid: account.verification_level === 2 ? true : Boolean(kycInfo.is_valid),
          type: kycInfo.type,
          s3Key: kycInfo.s3_key,
          firstName: kycInfo.first_name,
          lastName: kycInfo.last_name,
          country: kycInfo.country,
          phone: kycInfo.phone,
          phoneCode: kycInfo.phone_code,
          identificationNumber: kycInfo.identification_number,
          // 如果账户已KYC认证(verification_level为2)，强制设置status为2（验证通过）
          status: account.verification_level === 2 ? 2 : kycInfo.status,
          createdAt: kycInfo.created_at,
          // 如果有image_url字段则使用，否则为undefined
          imageUrl: kycInfo.image_url
        };

        console.log('转换后的KYC信息:', transformedKycInfo);
        setKycData(transformedKycInfo);
      } else {
        console.warn('API未返回KYC信息或数据不完整', response.data);
        // 即使API没有返回KYC信息，也根据账户状态创建基本信息对象
        if (account.verification_level === 3) {
          // 如果是KYC认证中状态，创建一个默认的KYC信息对象
          setKycData({
            id: account.userId,
            status: 1, // 设置为验证中状态
            is_valid: false,
            type: 0,
            first_name: '',
            last_name: '',
            country: '',
            phone: '',
            phone_code: '',
            created_at: Math.floor(Date.now() / 1000)
          });
          console.log('根据账户状态创建了默认KYC信息对象');
        } else {
          setKycData({});
          message.warning('未查询到KYC信息或数据不完整');
        }
      }
    } catch (error) {
      console.error('获取KYC信息出错:', error);
      // 即使获取失败，也根据账户状态创建基本信息对象
      if (account.verification_level === 3) {
        setKycData({
          id: account.userId,
          status: 1, // 设置为验证中状态
          is_valid: false,
          type: 0,
          created_at: Math.floor(Date.now() / 1000)
        });
        console.log('发生错误时根据账户状态创建了默认KYC信息对象');
      } else {
        setKycData({});
        message.error('获取KYC信息失败');
      }
    } finally {
      setLoadingKycData(false);
    }
  };

  // 关闭KYC查看模态框
  const handleCloseKycViewModal = () => {
    setKycViewModalVisible(false);
    setKycData(null);
  };

  // 准备KYC认证 - 打开KYC认证模态框
  const prepareKycAuth = () => {
    if (!account || !account.password) {
      message.error('缺少必要信息，无法进行KYC认证');
      return;
    }

    // 显示KYC认证模态框
    setKycAuthModalVisible(true);
  };

  // 关闭KYC认证模态框
  const handleCloseKycAuthModal = () => {
    setKycAuthModalVisible(false);
  };

  // 打开一键开卡模态框
  const handleOpenCardApply = () => {
    setCardApplyModalVisible(true);
  };

  // 关闭一键开卡模态框
  const handleCloseCardApply = () => {
    setCardApplyModalVisible(false);
  };

  // 初始化表单值
  useEffect(() => {
    if (account && visible) {
      form.setFieldsValue({
        email: account.email,
        password: account.password, // 显示当前密码
        status: account.status,
        userType: account.userType,
      });

      // 重置mock user状态
      setMockUser(null);
      setMockUserModalVisible(false);

      // 获取卡片信息
      getCardList();
      // 获取自定义邮箱配置
      fetchCustomEmailConfig(account.id);
      // 重置自定义邮箱编辑模式和表单
      setCustomEmailEditMode(false);
      customEmailForm.resetFields();

    } else if (!visible) {
      // 模态框关闭时，也重置自定义邮箱相关状态
      setCustomEmailConfig(null);
      setCustomEmailEditMode(false);
      customEmailForm.resetFields();
    }
  }, [account, visible, form, customEmailForm]); // 添加 customEmailForm 到依赖项

  // 获取关联的随机用户信息
  const fetchMockUser = async () => {
    if (!account?.mockUserId) {
      message.info('该账户没有关联的随机用户');
      return;
    }

    try {
      setLoadingMockUser(true);
      const response = await api.get(`${API_BASE_URL}/api/random-users/${account.mockUserId}`);

      if (response.data.success && response.data.data) {
        setMockUser(response.data.data);
        setMockUserModalVisible(true);
      } else {
        message.error('获取关联随机用户失败: ' + response.data.message);
      }
    } catch (error: any) {
      message.error('获取关联随机用户失败: ' + error.message);
    } finally {
      setLoadingMockUser(false);
    }
  };

  // 处理关闭
  const handleClose = () => {
    setEditMode(false);
    form.resetFields();
    setTwoFactorAuthModalVisible(false);
    onClose();
  };

  // 切换编辑模式
  const toggleEditMode = () => {
    setEditMode(!editMode);
  };

  // 保存账户信息
  const saveAccountInfo = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      // 只提交有值的字段
      const updateData: Record<string, any> = {};
      if (values.email) updateData.email = values.email;
      if (values.password) updateData.password = values.password;
      if (values.status) updateData.status = values.status;
      if (values.userType !== undefined) updateData.userType = values.userType;

      const response = await api.put(`${API_BASE_URL}/api/infini-accounts/${account?.id}`, updateData);

      if (response.data.success) {
        message.success('账户信息更新成功');
        setEditMode(false);
        onSuccess();
      } else {
        message.error(response.data.message || '更新账户失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '更新账户失败');
      console.error('更新账户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomEmailConfig = async () => {
    if (!account || !customEmailConfig) {
      message.error('无法删除配置：缺少账户或配置信息');
      return;
    }
    setLoading(true); // 或者使用一个独立的 loadingCustomEmailConfig 操作状态
    try {
      // 后端API的deleteCustomEmailConfig需要的是accountId，而不是配置本身的id
      const response = await api.delete(`${API_BASE_URL}/api/infini-accounts/${account.id}/custom-email-config`);
      // DELETE 成功通常返回 204 No Content，或者一个包含 success:true 的JSON对象
      // 需要根据实际API返回情况调整判断条件
      if (response.status === 204 || response.data?.success) {
        message.success('自定义邮箱配置删除成功');
        setCustomEmailConfig(null);
        customEmailForm.resetFields();
        setCustomEmailEditMode(false);
        // 如果需要，可以调用 onSuccess 来刷新外部列表或账户信息
        // onSuccess();
      } else {
        message.error(response.data?.message || '删除自定义邮箱配置失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '删除自定义邮箱配置时发生错误');
      console.error('删除自定义邮箱配置错误:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCustomEmailConfig = async (values: any) => {
    if (!account) {
      message.error('无法保存配置：缺少账户信息');
      return;
    }
    setLoadingCustomEmailConfig(true); // 使用独立的loading状态
    try {
      let response;
      const rawValues = { ...values };

      // 在这里处理端口号的转换
      const imap_port = rawValues.imap_port ? Number(rawValues.imap_port) : undefined;
      const smtp_port = rawValues.smtp_port ? Number(rawValues.smtp_port) : undefined;

      const payload = {
        ...rawValues,
        imap_port,
        smtp_port,
      };

      // 如果是编辑模式且密码字段为空或未更改，则不提交密码字段
      if (customEmailConfig && (payload.password === undefined || payload.password === '')) {
        delete payload.password;
      }

      // 将 extra_config 字符串转换为 JSON 对象
      if (payload.extra_config && typeof payload.extra_config === 'string') {
        try {
          payload.extra_config = JSON.parse(payload.extra_config);
        } catch (e) {
          message.error('额外配置不是有效的JSON格式');
          setLoadingCustomEmailConfig(false);
          return;
        }
      } else if (!payload.extra_config) {
        payload.extra_config = null;
      }

      if (customEmailConfig && customEmailConfig.id) { // 更新
        response = await api.put(`${API_BASE_URL}/api/infini-accounts/${account.id}/custom-email-config`, payload);
      } else { // 创建
        response = await api.post(`${API_BASE_URL}/api/infini-accounts/${account.id}/custom-email-config`, payload);
      }

      if (response.data.success) {
        message.success(customEmailConfig ? '自定义邮箱配置更新成功' : '自定义邮箱配置添加成功');
        setCustomEmailConfig(response.data.data || null);
        if (response.data.data) {
          customEmailForm.setFieldsValue(response.data.data);
        }
        setCustomEmailEditMode(false);
        // onSuccess(); // 可选：如果需要刷新外部列表
      } else {
        message.error(response.data.message || (customEmailConfig ? '更新失败' : '添加失败'));
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || (customEmailConfig ? '更新配置时发生错误' : '添加配置时发生错误'));
      console.error('保存自定义邮箱配置错误:', error);
    } finally {
      setLoadingCustomEmailConfig(false);
    }
  };

  // 准备2FA配置 - 打开2FA配置模态框
  const prepare2faConfig = () => {
    if (!account || !account.password) {
      message.error('缺少必要信息，无法配置2FA');
      return;
    }

    // 显示2FA配置模态框
    setTwoFactorAuthModalVisible(true);
  };

  // 渲染表单
  const renderForm = () => {
    if (!editMode) return null;

    return (
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
      >
        <Form.Item
          name="email"
          label="Infini登录邮箱"
          rules={[
            { type: 'email', message: '请输入有效的邮箱地址' }
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="请输入Infini登录邮箱" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Infini登录密码"
        >
          <Input.Password prefix={<LockOutlined />} placeholder="请输入Infini登录密码" />
        </Form.Item>

        <Form.Item
          name="status"
          label="账户状态"
        >
          <Input placeholder="账户状态" />
        </Form.Item>

        <Form.Item
          name="userType"
          label="用户类型"
        >
          <Input type="number" placeholder="用户类型" />
        </Form.Item>
      </Form>
    );
  };

  // 渲染账户详情
  const renderAccountDetails = () => {
    if (!account) return null;

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              账户详情
              <Tag color={account.status === 'active' ? 'green' : 'orange'} style={{ marginLeft: 8 }}>
                {account.status === 'active' ? '活跃' : account.status}
              </Tag>
              {account.verification_level !== undefined && (
                <Tag color={
                  account.verification_level === 2 ? 'green' :
                    account.verification_level === 3 ? 'gold' :
                      account.verification_level === 1 ? 'blue' : 'orange'
                }>
                  {account.verification_level === 2 ? 'KYC认证' :
                    account.verification_level === 3 ? 'KYC认证中' :
                      account.verification_level === 1 ? '基础认证' : '未认证'}
                </Tag>
              )}
            </Title>
          </div>
          <div>
            {account.mockUserId && (
              <Button
                type="primary"
                ghost
                icon={<UserOutlined />}
                onClick={fetchMockUser}
                loading={loadingMockUser}
                style={{ marginRight: 8 }}
              >
                查看关联用户
              </Button>
            )}
            {/* 显示2FA相关按钮：已启用的显示查看/配置，未启用的显示启用2FA */}
            {account.google2faIsBound ? (
              <Button
                type="primary"
                ghost
                icon={<SafetyCertificateOutlined />}
                onClick={handleView2fa}
                style={{ marginRight: 8 }}
              >
                {account.twoFaInfo ? '查看2FA' : '配置2FA'}
              </Button>
            ) : (
              <Button
                type="primary"
                ghost
                icon={<SafetyCertificateOutlined />}
                onClick={prepare2faConfig}
                style={{ marginRight: 8 }}
              >
                启用2FA
              </Button>
            )}
            {/* 已完成KYC认证(verification_level=2或3)时显示"查看KYC"按钮 */}
            {getActualVerificationLevel(account) >= 2 && (
              <Button
                type="primary"
                ghost
                icon={<IdcardOutlined />}
                onClick={handleViewKyc}
                style={{ marginRight: 8 }}
              >
                查看KYC
              </Button>
            )}
            <Button
              type="primary"
              ghost
              icon={<CreditCardOutlined />}
              onClick={handleOpenCardApply}
            >
              一键开卡
            </Button>
          </div>
        </div>

        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="用户ID">{account.userId}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{account.email}</Descriptions.Item>
          <Descriptions.Item label="登录密码">{account.password}</Descriptions.Item>
          <Descriptions.Item label="UID">{account.uid || '未设置'}</Descriptions.Item>
          <Descriptions.Item label="邀请码">{account.invitationCode || '未设置'}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{formatTimestamp(account.infiniCreatedAt)}</Descriptions.Item>
          <Descriptions.Item label="最后同步时间">{formatTime(account.lastSyncAt)}</Descriptions.Item>
          <Descriptions.Item label="用户类型">{account.userType}</Descriptions.Item>
          {account.mockUserId && (
            <Descriptions.Item label="关联随机用户ID">
              {account.mockUserId}
            </Descriptions.Item>
          )}
        </Descriptions>


        <Divider orientation="left">余额信息</Divider>

        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Statistic
              title="可用余额"
              value={formatAmount(account.availableBalance)}
              prefix={<DollarOutlined />}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="提现中金额"
              value={formatAmount(account.withdrawingAmount)}
              prefix={<DollarOutlined />}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="红包余额"
              value={formatAmount(account.redPacketBalance)}
              prefix={<DollarOutlined />}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="总收益"
              value={formatAmount(account.totalEarnBalance)}
              prefix={<DollarOutlined />}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="总消费"
              value={formatAmount(account.totalConsumptionAmount)}
              prefix={<DollarOutlined />}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="日消费"
              value={formatAmount(account.dailyConsumption)}
              prefix={<DollarOutlined />}
            />
          </Col>
        </Row>


        {/* 卡片信息展示区域 */}
        <Divider orientation="left">卡片信息</Divider>
        <Spin spinning={loadingCards}>
          {cardList.length > 0 ? (
            <div>
              {cardList.map((card, index) => (
                <Card
                  key={index}
                  style={{ marginBottom: 16, cursor: 'pointer' }}
                  hoverable
                  onClick={() => {
                    setSelectedCard(card);
                    setCardDetailModalVisible(true);
                  }}
                  title={
                    <Space>
                      <BankOutlined />
                      <span>{card.label || `Card ${index + 1}`}</span>
                      {card.status && (
                        <Tag color={card.status === 'active' ? 'green' : 'orange'}>
                          {card.status}
                        </Tag>
                      )}
                    </Space>
                  }
                  extra={
                    <Space>
                      <CreditCardOutlined />
                      <span>{card.card_last_four_digits ? `**** **** **** ${card.card_last_four_digits}` : '未获取到卡号'}</span>
                      <Button
                        type="link"
                        onClick={(e) => {
                          e.stopPropagation(); // 阻止事件冒泡
                          setSelectedCard(card);
                          setCardDetailModalVisible(true);
                        }}
                      >
                        查看详情
                      </Button>
                    </Space>
                  }
                >
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="卡种类型">{card.issue_type || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="卡片币种">{card.currency || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="卡片提供商">{card.provider || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="可用余额">{card.available_balance || '0'}</Descriptions.Item>
                    <Descriptions.Item label="消费限额">{card.consumption_limit || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="日消费">{card.daily_consumption || '0'}</Descriptions.Item>
                    <Descriptions.Item label="持卡人姓名">{card.name || '未知'}</Descriptions.Item>
                    <Descriptions.Item label="是否默认">
                      <Tag color={card.is_default ? 'blue' : 'default'}>
                        {card.is_default ? '是' : '否'}
                      </Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              ))}
            </div>
          ) : (
            <Empty
              description="暂无卡片信息"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Spin>

        <Divider orientation="left">账户安全</Divider>

        <div>
          <Tag color={account.google2faIsBound ? 'green' : 'orange'} style={{ marginRight: 8 }}>
            {account.google2faIsBound ? 'Google 2FA 已绑定' : 'Google 2FA 未绑定'}
          </Tag>
          <Tag color={account.googlePasswordIsSet ? 'green' : 'orange'} style={{ marginRight: 8 }}>
            {account.googlePasswordIsSet ? 'Google密码已设置' : 'Google密码未设置'}
          </Tag>
          <Tag color={account.isProtected ? 'green' : 'red'} style={{ marginRight: 8 }}>
            {account.isProtected ? '已受保护' : '未受保护'}
          </Tag>
          <Tag color={account.isKol ? 'blue' : 'default'} style={{ marginRight: 8 }}>
            {account.isKol ? 'KOL' : '普通用户'}
          </Tag>
          {account.verification_level !== undefined && (
            <Tag color={
              account.verification_level === 2 ? 'green' :
                account.verification_level === 3 ? 'gold' :
                  account.verification_level === 1 ? 'blue' : 'orange'
            }>
              {account.verification_level === 2 ? 'KYC已认证' :
                account.verification_level === 3 ? 'KYC认证中' :
                  account.verification_level === 1 ? '基础已认证' : 'KYC未认证'}
            </Tag>
          )}
        </div>

        <Divider orientation="left" style={{ marginTop: 24 }}>自定义邮箱配置</Divider>
        {loadingCustomEmailConfig && <div style={{ textAlign: 'center', padding: 20 }}><Spin tip="加载自定义邮箱配置中..." /></div>}
        {!loadingCustomEmailConfig && customEmailConfig && !customEmailEditMode && (
          <>
            <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="邮箱地址">{customEmailConfig.email}</Descriptions.Item>
              <Descriptions.Item label="IMAP 主机">{customEmailConfig.imap_host}</Descriptions.Item>
              <Descriptions.Item label="IMAP 端口">{customEmailConfig.imap_port}</Descriptions.Item>
              <Descriptions.Item label="IMAP 安全连接(SSL/TLS)">{customEmailConfig.imap_secure ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="SMTP 主机">{customEmailConfig.smtp_host}</Descriptions.Item>
              <Descriptions.Item label="SMTP 端口">{customEmailConfig.smtp_port}</Descriptions.Item>
              <Descriptions.Item label="SMTP 安全连接(SSL/TLS)">{customEmailConfig.smtp_secure ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={customEmailConfig.status === 'active' ? 'green' : 'red'}>
                  {customEmailConfig.status === 'active' ? '已激活' : '已禁用'}
                </Tag>
              </Descriptions.Item>
              {customEmailConfig.extra_config && Object.keys(customEmailConfig.extra_config).length > 0 && (
                <Descriptions.Item label="额外配置">
                  <pre style={{ maxHeight: 100, overflowY: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                    {JSON.stringify(customEmailConfig.extra_config, null, 2)}
                  </pre>
                </Descriptions.Item>
              )}
            </Descriptions>
            <Space>
              <Button onClick={() => {
                customEmailForm.setFieldsValue(customEmailConfig); // 编辑前回填表单
                setCustomEmailEditMode(true);
              }}>编辑配置</Button>
              <Popconfirm
                title="确定要删除此自定义邮箱配置吗？"
                onConfirm={handleDeleteCustomEmailConfig}
                okText="确定"
                cancelText="取消"
                placement="topRight"
              >
                <Button danger>删除配置</Button>
              </Popconfirm>
            </Space>
          </>
        )}
        {!loadingCustomEmailConfig && !customEmailConfig && !customEmailEditMode && (
          <Space direction="vertical" align="start">
            <Text type="secondary">该账户尚无独立的邮箱配置。</Text>
            <Button type="primary" onClick={() => {
              customEmailForm.resetFields(); // 添加前清空表单
              setCustomEmailEditMode(true);
            }}>添加配置</Button>
          </Space>
        )}
        {/* 自定义邮箱配置的编辑表单 */}
        {customEmailEditMode && account && (
          <Card title={customEmailConfig ? "编辑自定义邮箱配置" : "添加自定义邮箱配置"} style={{ marginTop: 20, borderColor: '#1890ff' }}>
            <Form
              form={customEmailForm}
              layout="vertical"
              onFinish={handleSaveCustomEmailConfig}
              initialValues={customEmailConfig || { imap_secure: true, smtp_secure: true, status: 'active' }}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="email"
                    label="邮箱地址"
                    rules={[{ required: true, type: 'email', message: '请输入有效的邮箱地址' }]}
                  >
                    <Input prefix={<MailOutlined />} placeholder="例如: user@example.com" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="password"
                    label="邮箱密码/授权码"
                    rules={[{ required: !customEmailConfig, message: '新增时密码不能为空' }]}
                    extra={customEmailConfig ? "如需修改密码请输入新密码，否则留空" : ""}
                  >
                    <Input.Password prefix={<LockOutlined />} placeholder="输入邮箱密码或应用授权码" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="imap_host"
                    label="IMAP 主机"
                    rules={[{ required: true, message: 'IMAP 主机不能为空' }]}
                  >
                    <Input placeholder="例如: imap.example.com" />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Item
                    name="imap_port"
                    label="IMAP 端口"
                    rules={[{ required: true, message: '请输入有效的IMAP端口号' }]}
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
                    name="smtp_host"
                    label="SMTP 主机"
                    rules={[{ required: true, message: 'SMTP 主机不能为空' }]}
                  >
                    <Input placeholder="例如: smtp.example.com" />
                  </Form.Item>
                </Col>
                <Col xs={12} sm={6}>
                  <Form.Item
                    name="smtp_port"
                    label="SMTP 端口"
                    rules={[{ required: true, message: '请输入有效的SMTP端口号' }]}
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
                name="status"
                label="状态"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Radio.Group>
                  <Radio value="active">激活</Radio>
                  <Radio value="disabled">禁用</Radio>
                </Radio.Group>
              </Form.Item>
              <Form.Item name="extra_config" label="额外配置 (JSON格式)"
                getValueFromEvent={(e) => { // 处理输入，确保是字符串或null
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
                <Input.TextArea rows={3} placeholder='例如: {"key": "value"}' />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" loading={loadingCustomEmailConfig}>
                    {customEmailConfig ? "保存更改" : "添加配置"}
                  </Button>
                  <Button onClick={() => {
                    setCustomEmailEditMode(false);
                    // customEmailForm.resetFields(); // 取消时不重置，以便保留上次的有效值或初始值
                    if (customEmailConfig) {
                      customEmailForm.setFieldsValue(customEmailConfig); // 恢复到编辑前的数据
                    } else {
                      customEmailForm.resetFields(); // 如果是新增模式取消，则清空
                    }
                  }}>取消</Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        )}

      </div>
    );
  };

  // 随机用户详情模态框
  const RandomUserDetailModal = () => {
    return (
      <Modal
        title="关联的随机用户信息"
        open={mockUserModalVisible}
        onCancel={() => setMockUserModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setMockUserModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {mockUser && (
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="用户ID">{mockUser.id}</Descriptions.Item>
            <Descriptions.Item label="姓名">{`${mockUser.last_name}, ${mockUser.first_name}`}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{mockUser.full_email}</Descriptions.Item>
            <Descriptions.Item label="密码">{mockUser.password}</Descriptions.Item>
            <Descriptions.Item label="护照号">{mockUser.passport_no}</Descriptions.Item>
            <Descriptions.Item label="手机号">{mockUser.phone}</Descriptions.Item>
            <Descriptions.Item label="出生日期">{`${mockUser.birth_year}-${mockUser.birth_month}-${mockUser.birth_day}`}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    );
  };

  return (
    <>
      {/* 创建模态框 */}
      <Modal
        title={editMode ? "编辑Infini账户" : "查看Infini账户"}
        open={visible}
        onCancel={handleClose}
        width={800}
        footer={(() => {
          // 使用函数创建按钮数组，避免在数组中生成布尔值
          const footerButtons = [
            <Button key="cancel" onClick={handleClose}>
              取消
            </Button>
          ];

          // 添加刷新卡片信息按钮
          if (!editMode && account) {
            footerButtons.push(
              <Button
                key="syncCard"
                type="primary"
                ghost
                icon={<SyncOutlined spin={loadingCards} />}
                onClick={syncCardInfo}
                loading={loadingCards}
                style={{ marginRight: 8 }}
              >
                刷新卡片信息
              </Button>
            );
          }

          // 条件性添加自动KYC按钮
          if (!editMode && account &&
            getActualVerificationLevel(account) < 2 &&
            getActualVerificationLevel(account) !== 3) {
            footerButtons.push(
              <Button
                key="autoKyc"
                type="primary"
                ghost
                icon={<IdcardOutlined />}
                onClick={prepareKycAuth}
                style={{ marginRight: 8 }}
              >
                自动KYC
              </Button>
            );
          }

          // 条件性添加自动配置2FA按钮
          if (!editMode && account && !account.google2faIsBound) {
            footerButtons.push(
              <Button
                key="auto2fa"
                type="primary"
                ghost
                icon={<SafetyCertificateOutlined />}
                onClick={prepare2faConfig}
              >
                自动配置2FA
              </Button>
            );
          }

          // 添加编辑/保存按钮
          footerButtons.push(
            editMode ? (
              <Button
                key="save"
                type="primary"
                loading={loading}
                onClick={saveAccountInfo}
              >
                保存修改
              </Button>
            ) : (
              <Button
                key="edit"
                type="primary"
                onClick={toggleEditMode}
              >
                编辑账户
              </Button>
            )
          );

          return footerButtons;
        })()}
      >
        <div style={{ minHeight: 320 }}>
          {editMode ? renderForm() : renderAccountDetails()}
        </div>
        <RandomUserDetailModal />
      </Modal>

      {/* 独立的2FA和KYC模态框 */}
      {account && (
        <>
          <TwoFactorAuthModal
            visible={twoFactorAuthModalVisible}
            accountId={account.id}
            email={account.email}
            password={account.password || ''}
            onClose={() => setTwoFactorAuthModalVisible(false)}
            onSuccess={onSuccess}
          />

          {/* 2FA信息查看模态框 */}
          <TwoFaViewModal
            visible={twoFaModalVisible}
            onClose={handleClose2faModal}
            twoFaInfo={account.twoFaInfo}
            twoFaEnabled={!!account.google2faIsBound}
            accountId={account.id.toString()}
            onSuccess={onSuccess}
          />

          {/* KYC认证模态框 */}
          <KycAuthModal
            visible={kycAuthModalVisible}
            onClose={handleCloseKycAuthModal}
            accountId={account.id.toString()}
            email={account.email}
            onComplete={() => {
              // 更新认证状态后立即刷新账户列表，确保状态变更可见
              onSuccess();
              // 显示更新成功提示
              message.success('KYC认证成功，账户状态已更新');
            }}
          />

          {/* KYC信息查看模态框 */}
          <KycViewModal
            visible={kycViewModalVisible}
            onClose={handleCloseKycViewModal}
            accountId={account.id.toString()}
            kycInfo={loadingKycData ? undefined : kycData}
            onStatusChange={(newStatus) => {
              // 状态变更后刷新账户列表
              message.success('KYC状态已更新');
              onSuccess();
            }}
          />

          {/* 一键开卡模态框 */}
          <CardApplyModal
            visible={cardApplyModalVisible}
            onClose={handleCloseCardApply}
            onSuccess={onSuccess}
            account={{
              ...account,
              google2faIsBound: !!account.google2faIsBound
            }}
          />
        </>
      )}

      {/* 卡片详情模态框 */}
      {selectedCard && account && account.id && (
        <CardDetailModal
          visible={cardDetailModalVisible}
          onClose={() => {
            setCardDetailModalVisible(false);
            setSelectedCard(null);
          }}
          cardId={selectedCard.card_id}
          cardInfo={selectedCard}
          accountId={account.id}
          onRefresh={getCardList}
        />
      )}
    </>
  );
};

export default AccountDetailModal;