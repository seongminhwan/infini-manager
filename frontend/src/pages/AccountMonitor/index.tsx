/**
 * 账户监控页面
 * 用于添加和管理Infini账户
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Row,
  Col,
  message,
  Spin,
  Typography,
  Statistic,
  Tag,
  Descriptions,
  Divider,
  Tooltip,
  Popconfirm,
  Checkbox,
  Select,
  Collapse,
  Dropdown,
  Menu,
  List,
  Radio,
  Empty,
  TableColumnsType,
  Tabs, // 添加Tabs组件导入
  Popover, // 添加Popover组件导入
} from 'antd';
import {
  PlusOutlined,
  SyncOutlined,
  DeleteOutlined,
  LockOutlined,
  MailOutlined,
  LinkOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  DollarOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  UserAddOutlined,
  GlobalOutlined,
  MobileOutlined,
  IdcardOutlined,
  NumberOutlined,
  PictureOutlined,
  SafetyOutlined,
  DownOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  CopyOutlined,
  CreditCardOutlined,
  SearchOutlined,
  BankOutlined,
  SettingOutlined,
  UpOutlined, // 添加上箭头图标
} from '@ant-design/icons';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { debounce, DebouncedFunc } from 'lodash';
import { ResizeCallbackData } from 'react-resizable';
import api, { apiBaseUrl, configApi, infiniAccountApi, randomUserApi, totpToolApi, httpService, transferApi, batchTransferApi } from '../../services/api';
import RandomUserRegisterModal from '../../components/RandomUserRegisterModal';
import KycInfoPopover from '../../components/KycInfoPopover';
import TwoFactorAuthModal from '../../components/TwoFactorAuthModal';
import TwoFaViewModal from '../../components/TwoFaViewModal';
import KycAuthModal from '../../components/KycAuthModal';
import KycViewModal from '../../components/KycViewModal';
import CardApplyModal from '../../components/CardApplyModal';
import CardDetailModal from '../../components/CardDetailModal';
import RedPacketModal from '../../components/RedPacketModal';
import OneClickSetupModal from '../../components/OneClickSetupModal';
import BatchRegisterModal from '../../components/BatchRegisterModal';
import styled from 'styled-components';
import dayjs from 'dayjs';
import { infiniCardApi } from '../../services/api';
import TransferActionPopover from '../../components/TransferActionPopover';

const { Title, Text } = Typography;
const { Option } = Select;
const { Panel } = Collapse;

// 样式组件定义
const StyledCard = styled(Card)`
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
`;

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
`;

const ModalBodyContainer = styled.div`
  min-height: 320px;
`;

const AccountInfoContainer = styled.div`
  position: relative;
  height: 100%;
  padding: 16px;
  border-left: 1px solid #f0f0f0;
`;

const BalanceTag = styled(Tag)`
  padding: 4px 8px;
  font-weight: 600;
`;

const StatusTag = styled(Tag)`
  margin-left: 8px;
`;

const SyncButton = styled(Button)`
  margin-right: 8px;
`;

// 接口和类型定义
// 账户分组接口
interface AccountGroup {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  accountCount?: number;
}

// 分组详情接口
interface GroupDetail extends AccountGroup {
  accounts: { id: string; email: string; }[];
}

// 2FA信息接口
interface TwoFaInfo {
  qrCodeUrl?: string;
  secretKey?: string;
  recoveryCodes?: string[];
}

interface InfiniAccount {
  id: number;
  userId: string;
  email: string;
  password?: string; // 添加密码字段
  uid?: string;
  invitationCode?: string;
  availableBalance: number;
  withdrawingAmount: number;
  redPacketBalance: number;
  totalConsumptionAmount: number;
  totalEarnBalance: number;
  dailyConsumption: number;
  status?: string;
  userType?: number;
  google2faIsBound: boolean | number; // 兼容数值类型（0/1）和布尔类型
  googlePasswordIsSet: boolean | number; // 兼容数值类型（0/1）和布尔类型
  isKol: boolean | number;
  isProtected: boolean | number;
  cookieExpiresAt?: string;
  infiniCreatedAt?: number;
  lastSyncAt: string;
  createdAt?: string;
  updatedAt?: string;
  mockUserId?: number; // 关联的随机用户ID
  twoFaInfo?: TwoFaInfo; // 2FA信息
  verificationLevel?: number; // KYC认证级别：0-未认证 1-基础认证 2-KYC认证
  verification_level?: number; // 兼容旧版API
  groups?: AccountGroup[]; // 所属分组
}

// 随机用户信息接口
interface RandomUser {
  id: number;
  first_name: string;
  last_name: string;
  email_prefix: string;
  full_email: string;
  password: string;
  phone: string;
  passport_no: string;
  birth_year: number;
  birth_month: number;
  birth_day: number;
  created_at?: string;
  updated_at?: string;
}

// 批量同步结果类型
interface BatchSyncResult {
  total: number;
  success: number;
  failed: number;
  accounts: Array<{
    id: number;
    email: string;
    success: boolean;
    message?: string;
  }>;
}

interface LoginFormData {
  email: string;
  password: string;
}

// 同步状态类型
type SyncStage = 'idle' | 'login' | 'fetch' | 'complete' | 'error';

// API基础URL
const API_BASE_URL = apiBaseUrl;

// 格式化时间
const formatTime = (time?: string) => {
  if (!time) return '--';
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss');
};

// 账户详情/编辑模态框组件
const AccountDetailModal: React.FC<{
  visible: boolean;
  account: InfiniAccount | null;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ visible, account, onClose, onSuccess }) => {
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
  
  // 获取实际验证级别的函数
  const getActualVerificationLevel = (acc: InfiniAccount): number => {
    // 优先使用verification_level，如果不存在则使用verificationLevel
    return acc.verification_level !== undefined ? acc.verification_level : (acc.verificationLevel || 0);
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
  
  // 复制文本到剪贴板
  const copyToClipboard = (text: string, messageText: string = '已复制到剪贴板') => {
    navigator.clipboard.writeText(text)
      .then(() => {
        message.success({
          content: messageText,
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          duration: 2
        });
      })
      .catch(err => {
        console.error('复制失败:', err);
        message.error('复制失败，请手动复制');
      });
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
    }
  }, [account, visible, form]);

  // 获取关联的随机用户信息
  const fetchMockUser = async () => {
    if (!account?.mockUserId) {
      message.info('该账户没有关联的随机用户');
      return;
    }
    
    try {
      setLoadingMockUser(true);
      const response = await randomUserApi.getRandomUserById(account.mockUserId.toString());
      
      if (response.success && response.data) {
        setMockUser(response.data);
        setMockUserModalVisible(true);
      } else {
        message.error('获取关联随机用户失败: ' + response.message);
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

  // 格式化时间戳
  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return '未知';
    return dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss');
  };

  // 格式化金额
  const formatAmount = (amount: number) => {
    return amount.toFixed(6);
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
    
    // 添加调试输出，查看账户数据中的verification_level
    console.log('当前账户信息:', account);
    console.log('verification_level:', account.verification_level);

  return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              账户详情
              <StatusTag color={account.status === 'active' ? 'green' : 'orange'}>
                {account.status === 'active' ? '活跃' : account.status}
              </StatusTag>
              {account.verification_level !== undefined && (
                <StatusTag color={
                  account.verification_level === 2 ? 'green' : 
                  account.verification_level === 3 ? 'gold' : 
                  account.verification_level === 1 ? 'blue' : 'orange'
                }>
                  {account.verification_level === 2 ? 'KYC认证' : 
                  account.verification_level === 3 ? 'KYC认证中' :
                  account.verification_level === 1 ? '基础认证' : '未认证'}
                </StatusTag>
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
          <BalanceTag color={account.google2faIsBound ? 'green' : 'orange'}>
            {account.google2faIsBound ? 'Google 2FA 已绑定' : 'Google 2FA 未绑定'}
          </BalanceTag>
          <BalanceTag color={account.googlePasswordIsSet ? 'green' : 'orange'}>
            {account.googlePasswordIsSet ? 'Google密码已设置' : 'Google密码未设置'}
          </BalanceTag>
          <BalanceTag color={account.isProtected ? 'green' : 'red'}>
            {account.isProtected ? '已受保护' : '未受保护'}
          </BalanceTag>
          <BalanceTag color={account.isKol ? 'blue' : 'default'}>
            {account.isKol ? 'KOL' : '普通用户'}
          </BalanceTag>
          {account.verification_level !== undefined && (
            <BalanceTag color={
              account.verification_level === 2 ? 'green' : 
              account.verification_level === 3 ? 'gold' : 
              account.verification_level === 1 ? 'blue' : 'orange'
            }>
              {account.verification_level === 2 ? 'KYC已认证' : 
               account.verification_level === 3 ? 'KYC认证中' :
               account.verification_level === 1 ? '基础已认证' : 'KYC未认证'}
            </BalanceTag>
          )}
        </div>
        
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
        <ModalBodyContainer>
          {editMode ? renderForm() : renderAccountDetails()}
        </ModalBodyContainer>
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

// 批量同步结果模态框组件
const BatchSyncResultModal: React.FC<{
  visible: boolean;
  result: BatchSyncResult | null;
  onClose: () => void;
}> = ({ visible, result, onClose }) => {
  if (!result) return null;
  
  // 表格列定义
  const columns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '结果',
      dataIndex: 'success',
      key: 'success',
      render: (success: boolean) => (
        <Tag color={success ? 'green' : 'red'}>
          {success ? '成功' : '失败'}
        </Tag>
      ),
    },
    {
      title: '详情',
      dataIndex: 'message',
      key: 'message',
      render: (message?: string) => message || '-',
    },
  ];
  
  return (
    <Modal
      title="批量同步结果"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>
      ]}
    >
      <Descriptions title="同步统计" bordered>
        <Descriptions.Item label="总账户数">{result.total}</Descriptions.Item>
        <Descriptions.Item label="同步成功">{result.success}</Descriptions.Item>
        <Descriptions.Item label="同步失败">{result.failed}</Descriptions.Item>
      </Descriptions>
      
      <Divider>详细结果</Divider>
      
      <Table
        columns={columns}
        dataSource={result.accounts}
        rowKey="id"
        pagination={false}
      />
    </Modal>
  );
};

// 账户创建模态窗组件
const AccountCreateModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accountInfo, setAccountInfo] = useState<InfiniAccount | null>(null);
  const [syncStage, setSyncStage] = useState<SyncStage>('idle');
  const [syncError, setSyncError] = useState<string>('');

  // 重置状态
  const resetState = () => {
    setSyncStage('idle');
    setSyncError('');
    setAccountInfo(null);
    form.resetFields();
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
      
      const response = await api.post(`${API_BASE_URL}/api/infini-accounts`, {
        email: values.email,
        password: values.password,
      });

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

    // 格式化时间戳
    const formatTimestamp = (timestamp?: number) => {
      if (!timestamp) return '未知';
      return dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss');
    };

    // 格式化金额
    const formatAmount = (amount: number) => {
      return amount.toFixed(6);
    };

    return (
      <div>
        <Title level={4}>
          账户信息
          <StatusTag color={accountInfo.status === 'active' ? 'green' : 'orange'}>
            {accountInfo.status === 'active' ? '活跃' : accountInfo.status}
          </StatusTag>
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
          <BalanceTag color={accountInfo.google2faIsBound ? 'green' : 'orange'}>
            {accountInfo.google2faIsBound ? 'Google 2FA 已绑定' : 'Google 2FA 未绑定'}
          </BalanceTag>
          <BalanceTag color={accountInfo.googlePasswordIsSet ? 'green' : 'orange'}>
            {accountInfo.googlePasswordIsSet ? 'Google密码已设置' : 'Google密码未设置'}
          </BalanceTag>
          <BalanceTag color={accountInfo.isProtected ? 'green' : 'red'}>
            {accountInfo.isProtected ? '已受保护' : '未受保护'}
          </BalanceTag>
          <BalanceTag color={accountInfo.isKol ? 'blue' : 'default'}>
            {accountInfo.isKol ? 'KOL' : '普通用户'}
          </BalanceTag>
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
      <ModalBodyContainer>
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
                <Text type="secondary">
                  <InfoCircleOutlined style={{ marginRight: 8 }} />
                  系统将使用这些凭据与Infini平台交互，监控账户余额和状态变化
                </Text>
              </Form.Item>
            </Form>
          </Col>
          
          {accountInfo && (
            <Col span={12}>
              <AccountInfoContainer>
                {renderAccountInfo()}
              </AccountInfoContainer>
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
      </ModalBodyContainer>
    </Modal>
  );
};

// 根据金额和颜色区间配置获取样式的辅助函数
const getStyleForBalance = (amount: number, colorRanges: any[]) => {
  const result = {
    color: "default", // 默认标签颜色
    style: {} as React.CSSProperties // 默认样式为空
  };
  
  // 从大到小遍历阈值，找到第一个符合条件的区间
  for (const range of colorRanges) {
    if (amount >= range.threshold) {
      result.color = range.color;
      // 如果有背景色和文字颜色，添加到样式中
      if (range.backgroundColor && range.textColor) {
        result.style = {
          backgroundColor: range.backgroundColor,
          color: range.textColor
        };
      }
      break;
    }
  }
  
  return result;
};

// KYC图片类型接口
interface KycImage {
  id: number;
  img_base64: string;
  tags: string;
  created_at: string;
  updated_at: string;
}

// 注册表单数据接口
interface RegisterFormData {
  email: string;
  password: string;
  verificationCode: string;
  needKyc: boolean;
  country?: string;
  phone?: string;
  idType?: string;
  idNumber?: string;
  kycImageId?: number;
  enable2fa: boolean;
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

// 注册模态框组件
const AccountRegisterModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [kycEnabled, setKycEnabled] = useState(false);
  const [kycImages, setKycImages] = useState<KycImage[]>([]);
  const [loadingKycImages, setLoadingKycImages] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  
  // 发送验证码
  const sendVerificationCode = async () => {
    try {
      const email = form.getFieldValue('email');
      
      // 验证邮箱格式
      if (!email || !/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
        message.error('请输入有效的邮箱地址');
        return;
      }
      
      setSendingCode(true);
      const response = await infiniAccountApi.sendVerificationCode(email);
      
      if (response.success) {
        message.success('验证码已发送，请检查邮箱');
        // 开始倒计时
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        message.error('发送验证码失败: ' + response.message);
      }
    } catch (error: any) {
      message.error('发送验证码失败: ' + error.message);
    } finally {
      setSendingCode(false);
    }
  };
  
  // 获取验证码（仅用于测试）
  const fetchCode = async () => {
    try {
      const email = form.getFieldValue('email');
      
      if (!email) {
        message.error('请先输入邮箱地址');
        return;
      }
      
      const response = await infiniAccountApi.fetchVerificationCode(email);
      
      if (response.success && response.data) {
        setVerificationCode(response.data.code);
        form.setFieldsValue({ verificationCode: response.data });
        message.success('获取验证码成功: ' + response.data);
      } else {
        message.error('获取验证码失败: ' + response.message);
      }
    } catch (error: any) {
      message.error('获取验证码失败: ' + error.message);
    }
  };
  
  // 重置状态
  const resetState = () => {
    form.resetFields();
    setKycEnabled(false);
    setVerificationCode('');
    setCountdown(0);
  };
  
  // 获取KYC图片列表
  const fetchKycImages = async () => {
    try {
      setLoadingKycImages(true);
      const response = await api.get(`${apiBaseUrl}/api/kyc-images`);
      
      if (response.data.success) {
        setKycImages(response.data.data || []);
      } else {
        message.error('获取KYC图片列表失败: ' + response.data.message);
      }
    } catch (error: any) {
      message.error('获取KYC图片列表失败: ' + error.message);
    } finally {
      setLoadingKycImages(false);
    }
  };
  
  // KYC选项变更时
  const handleKycChange = (e: any) => {
    const checked = e.target.checked;
    setKycEnabled(checked);
    
    if (checked) {
      fetchKycImages();
    }
  };
  
  // 生成随机密码
  const generatePassword = () => {
    const password = generateStrongPassword();
    form.setFieldsValue({ password });
    message.success('已生成随机强密码');
  };
  
  // 生成随机KYC信息
  const generateRandomKyc = () => {
    // 随机国家列表
    const countries = ['中国', '美国', '英国', '日本', '加拿大', '澳大利亚', '德国', '法国'];
    // 随机证件类型
    const idTypes = ['身份证', '护照', '驾照'];
    
    // 随机生成手机号
    const generateRandomPhone = () => {
      return `1${Math.floor(Math.random() * 9 + 1)}${Array(9).fill(0).map(() => Math.floor(Math.random() * 10)).join('')}`;
    };
    
    // 随机生成证件号
    const generateRandomIdNumber = () => {
      return Array(18).fill(0).map(() => Math.floor(Math.random() * 10)).join('');
    };
    
    // 设置随机值
    form.setFieldsValue({
      country: countries[Math.floor(Math.random() * countries.length)],
      phone: generateRandomPhone(),
      idType: idTypes[Math.floor(Math.random() * idTypes.length)],
      idNumber: generateRandomIdNumber(),
    });
    
    message.success('已生成随机KYC信息');
  };
  
  // 处理关闭
  const handleClose = () => {
    resetState();
    onClose();
  };
  
  // 提交表单
  const handleSubmit = async (values: RegisterFormData) => {
    try {
      setLoading(true);
      
      // 提取表单数据
      const { email, password, needKyc, country, phone, idType, idNumber, kycImageId, enable2fa } = values;
      
      // 这里只实现UI，不需要实际调用后端API
      console.log('注册账户数据:', {
        email,
        password,
        needKyc,
        country,
        phone,
        idType,
        idNumber,
        kycImageId,
        enable2fa
      });
      
      // 模拟注册成功
      message.success('账户注册成功');
      resetState();
      onSuccess();
      onClose();
    } catch (error: any) {
      message.error('注册失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Modal
      title="注册Infini账户"
      open={visible}
      onCancel={handleClose}
      width={700}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={() => form.submit()}
        >
          注册账户
        </Button>,
      ]}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          needKyc: false,
          enable2fa: false,
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
          name="verificationCode"
          label="验证码"
          rules={[{ required: true, message: '请输入验证码' }]}
        >
          <div style={{ display: 'flex' }}>
            <Input 
              placeholder="请输入验证码" 
              style={{ flex: 1 }}
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
            />
            <Button 
              type="primary"
              loading={sendingCode}
              disabled={countdown > 0}
              onClick={sendVerificationCode}
              style={{ marginLeft: 8, width: 120 }}
            >
              {countdown > 0 ? `${countdown}秒后重试` : '发送验证码'}
            </Button>
            <Button 
              type="link"
              onClick={fetchCode}
              style={{ marginLeft: 8 }}
            >
              提取验证码
            </Button>
          </div>
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
                onClick={generatePassword}
                style={{ border: 'none', padding: 0 }}
              />
            }
          />
        </Form.Item>
        
        <Form.Item 
          name="needKyc" 
          valuePropName="checked"
        >
          <Checkbox onChange={handleKycChange}>进行KYC认证</Checkbox>
        </Form.Item>
        
        {kycEnabled && (
          <Collapse defaultActiveKey={['1']} style={{ marginBottom: 16 }}>
            <Panel header="KYC信息" key="1" extra={
              <Button 
                type="text" 
                icon={<ReloadOutlined />} 
                onClick={(e) => {
                  e.stopPropagation();
                  generateRandomKyc();
                }}
                style={{ padding: '4px 8px' }}
              >
                随机生成
              </Button>
            }>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="country"
                    label="国家"
                    rules={[{ required: kycEnabled, message: '请选择国家' }]}
                  >
                    <Input 
                      prefix={<GlobalOutlined />} 
                      placeholder="请输入国家" 
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="phone"
                    label="手机号"
                    rules={[{ required: kycEnabled, message: '请输入手机号' }]}
                  >
                    <Input 
                      prefix={<MobileOutlined />} 
                      placeholder="请输入手机号" 
                    />
                  </Form.Item>
                </Col>
              </Row>
              
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="idType"
                    label="证件类型"
                    rules={[{ required: kycEnabled, message: '请选择证件类型' }]}
                  >
                    <Select placeholder="请选择证件类型" prefix={<IdcardOutlined />}>
                      <Option value="身份证">身份证</Option>
                      <Option value="护照">护照</Option>
                      <Option value="驾照">驾照</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="idNumber"
                    label="证件编号"
                    rules={[{ required: kycEnabled, message: '请输入证件编号' }]}
                  >
                    <Input 
                      prefix={<NumberOutlined />} 
                      placeholder="请输入证件编号" 
                    />
                  </Form.Item>
                </Col>
              </Row>
              
              <Form.Item
                name="kycImageId"
                label="KYC图片"
                rules={[{ required: kycEnabled, message: '请选择KYC图片' }]}
              >
                <Select 
                  placeholder="请选择KYC图片" 
                  loading={loadingKycImages}
                  optionLabelProp="label"
                >
                  {kycImages.map(image => (
                    <Option 
                      key={image.id} 
                      value={image.id}
                      label={`图片ID: ${image.id} - 标签: ${image.tags}`}
                    >
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <img 
                          src={image.img_base64} 
                          alt="KYC图片" 
                          style={{ width: 40, height: 40, marginRight: 8, objectFit: 'cover' }}
                        />
                        <span>{`图片ID: ${image.id} - 标签: ${image.tags}`}</span>
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Panel>
          </Collapse>
        )}
        
        <Form.Item 
          name="enable2fa" 
          valuePropName="checked"
        >
          <Checkbox>自动开启2FA</Checkbox>
        </Form.Item>
        
        <Form.Item>
          <Text type="secondary">
            <InfoCircleOutlined style={{ marginRight: 8 }} />
            注册后系统将自动创建Infini账户并同步账户信息
          </Text>
        </Form.Item>
      </Form>
    </Modal>
  );
};

// 可调整列宽的表头组件
const ResizableTitle: React.FC<{
  onResize: (e: React.SyntheticEvent<Element>, data: ResizeCallbackData) => void;
  width?: number;
  [x: string]: any;
}> = ({ onResize, width, ...restProps }) => {
  // 使用useRef避免不必要的重渲染
  const resizingRef = useRef(false);
  const handleRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<number | null>(null);

  // 使用有效的宽度值，确保resize功能始终可用
  const actualWidth = width || 100;
  
  // 使用useCallback优化事件处理函数，减少重渲染
  const handleResize = useCallback(
    (e: React.SyntheticEvent<Element>, data: ResizeCallbackData) => {
      e.preventDefault();
      
      // 使用节流减少resize回调频率
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
      
      // 直接操作DOM更新视觉指示器
      if (handleRef.current) {
        handleRef.current.style.opacity = '1';
        handleRef.current.style.backgroundColor = '#1890ff';
      }
      
      // 节流处理resize回调，降低状态更新频率
      resizeTimeoutRef.current = window.setTimeout(() => {
        onResize(e, data);
        resizeTimeoutRef.current = null;
      }, 10);
    },
    [onResize]
  );
  
  // 使用useCallback优化事件处理函数，使用useRef而不是useState跟踪状态
  const handleResizeStart = useCallback(() => {
    resizingRef.current = true;
    if (handleRef.current) {
      handleRef.current.style.opacity = '1';
      handleRef.current.style.backgroundColor = '#1890ff';
    }
    // 添加辅助类到body来改变全局鼠标样式，提升用户体验
    document.body.classList.add('resizing-columns');
  }, []);
  
  const handleResizeStop = useCallback(() => {
    resizingRef.current = false;
    if (handleRef.current) {
      handleRef.current.style.opacity = '0';
    }
    // 移除辅助类
    document.body.classList.remove('resizing-columns');
    
    // 清除可能存在的超时计时器
    if (resizeTimeoutRef.current !== null) {
      window.clearTimeout(resizeTimeoutRef.current);
      resizeTimeoutRef.current = null;
    }
  }, []);

  // 鼠标进入和离开事件处理函数，直接操作DOM避免状态更新
  const handleMouseEnter = useCallback(() => {
    if (!resizingRef.current && handleRef.current) {
      handleRef.current.style.opacity = '0.6';
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!resizingRef.current && handleRef.current) {
      handleRef.current.style.opacity = '0';
    }
  }, []);

  // 组件卸载时清理超时计时器
  useEffect(() => {
    return () => {
      if (resizeTimeoutRef.current !== null) {
        window.clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Resizable
      width={actualWidth}
      height={0}
      handle={
        <div
          className="react-resizable-handle"
          onClick={e => e.stopPropagation()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'absolute',
            right: -15, // 扩大偏移值，确保触发区域跨越表头单元格边界
            top: 0,
            bottom: 0, 
            width: 30, // 增加宽度到30px，进一步扩大可触发区域
            zIndex: 100, // 提高z-index确保可点击
            cursor: 'col-resize',
          }}
        >
          {/* 视觉指示器，使用ref直接操作而不是依赖重渲染 */}
          <div
            ref={handleRef}
            style={{
              position: 'absolute',
              right: 15, // 居中显示在拖拽把手中
              top: 0,
              bottom: 0,
              width: 3, // 增加线宽到3px，增强视觉反馈
              backgroundColor: 'rgba(24, 144, 255, 0.6)', // 初始颜色
              opacity: 0, // 默认隐藏
              transition: 'opacity 0.15s, background-color 0.15s', // 加快过渡速度
              borderRadius: 1.5, // 圆角边缘
            }}
          />
        </div>
      }
      onResize={handleResize}
      onResizeStart={handleResizeStart}
      onResizeStop={handleResizeStop}
      draggableOpts={{ 
        enableUserSelectHack: false,
        // 更大的网格值减少状态更新频率，提高性能
        grid: [10, 0], // 水平方向每次移动10px，进一步减少计算次数
        // 优化Draggable选项
        offsetParent: document.body, // 使用body作为偏移父元素，提高性能
        scale: 1, // 固定缩放比例
      }}
    >
      <th 
        {...restProps} 
        style={{ 
          ...restProps.style, 
          position: 'relative',
          userSelect: 'none', // 防止文本选择干扰拖拽
          cursor: 'default', // 确保基本光标正确
          transition: 'width 0.05s ease-out', // 添加宽度变化的平滑过渡
        }} 
      />
    </Resizable>
  );
};

// 主组件
const AccountMonitor: React.FC = () => {
  const [accounts, setAccounts] = useState<InfiniAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingAccount, setSyncingAccount] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // 服务器端分页状态
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [sortInfo, setSortInfo] = useState<{field?: string, order?: 'asc' | 'desc'}>({});
  const [registerModalVisible, setRegisterModalVisible] = useState(false);
  const [randomUserRegisterModalVisible, setRandomUserRegisterModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<InfiniAccount | null>(null);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [batchSyncResult, setBatchSyncResult] = useState<BatchSyncResult | null>(null);
  const [batchResultModalVisible, setBatchResultModalVisible] = useState(false);
  
  // 分组相关状态
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [accountGroupsMap, setAccountGroupsMap] = useState<Map<number, AccountGroup[]>>(new Map());
  
  // 表格列控制状态和表格列宽、顺序状态
  const [columnsToShow, setColumnsToShow] = useState<string[]>([
    'index', 'email', 'userId', 'groups', 'verification_level', 'availableBalance', 
    'redPacketBalance', 'status', 'security', 'lastSyncAt', 'action'
  ]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  
  // 余额颜色区间配置
  const [redPacketBalanceColorRanges, setRedPacketBalanceColorRanges] = useState<any[]>([
    { threshold: 1.4, color: 'green', backgroundColor: '#52c41a', textColor: 'white' },
    { threshold: 1, color: 'blue', backgroundColor: '#1890ff', textColor: 'white' },
    { threshold: 0.5, color: 'orange', backgroundColor: '#fa8c16', textColor: 'white' },
    { threshold: 0, color: 'brown', backgroundColor: '#8B4513', textColor: 'white' },
    { threshold: -Infinity, color: 'default', backgroundColor: '', textColor: '' }
  ]);
  const [availableBalanceColorRanges, setAvailableBalanceColorRanges] = useState<any[]>([
    { threshold: 10, color: 'green', backgroundColor: '#52c41a', textColor: 'white' },
    { threshold: 5, color: 'blue', backgroundColor: '#1890ff', textColor: 'white' },
    { threshold: 1, color: 'orange', backgroundColor: '#fa8c16', textColor: 'white' },
    { threshold: 0, color: 'default', backgroundColor: '', textColor: '' }
  ]);
  
  // 为保存配置创建防抖函数
  const debouncedSaveColumnWidths = useRef<DebouncedFunc<(widths: Record<string, number>) => void>>(
    debounce((widths: Record<string, number>) => {
      // 将列宽配置保存到数据库
      configApi.upsertConfig('account_monitor_column_widths', JSON.stringify(widths))
        .then((response: { success: boolean; message?: string }) => {
          if (response.success) {
            console.log('列宽配置已保存');
          } else {
            console.error('保存列宽配置失败:', response.message);
          }
        })
        .catch((error: Error) => {
          console.error('保存列宽配置失败:', error);
        });
    }, 500) // 用户停止操作500ms后再保存
  ).current;
  
  const debouncedSaveColumnOrder = useRef<DebouncedFunc<(order: string[]) => void>>(
    debounce((order: string[]) => {
      // 将列顺序配置保存到数据库
      configApi.upsertConfig('account_monitor_column_order', JSON.stringify(order))
        .then((response: { success: boolean; message?: string }) => {
          if (response.success) {
            console.log('列顺序配置已保存');
          } else {
            console.error('保存列顺序配置失败:', response.message);
          }
        })
        .catch((error: Error) => {
          console.error('保存列顺序配置失败:', error);
        });
    }, 500) // 用户停止操作500ms后再保存
  ).current;
  
  const debouncedSaveColumnsToShow = useRef<DebouncedFunc<(columns: string[]) => void>>(
    debounce((columns: string[]) => {
      // 将显示列配置保存到数据库
      configApi.upsertConfig('account_monitor_columns_to_show', JSON.stringify(columns))
        .then((response: { success: boolean; message?: string }) => {
          if (response.success) {
            console.log('显示列配置已保存');
          } else {
            console.error('保存显示列配置失败:', response.message);
          }
        })
        .catch((error: Error) => {
          console.error('保存显示列配置失败:', error);
        });
    }, 500) // 用户停止操作500ms后再保存
  ).current;
  // 查看账户详情
  const viewAccountDetail = (account: InfiniAccount) => {
    setSelectedAccount(account);
    setDetailModalVisible(true);
  };

  // 批量添加账户模态框可见状态
  const [batchAddModalVisible, setBatchAddModalVisible] = useState(false);

  // 批量同步所有账户
  const syncAllAccounts = async () => {
    try {
      setBatchSyncing(true);
      
      const response = await api.post(`${API_BASE_URL}/api/infini-accounts/sync-all`);
      
      if (response.data.success) {
        const result = response.data.data as BatchSyncResult;
        setBatchSyncResult(result);
        setBatchResultModalVisible(true);
        message.success(`批量同步完成: 总计${result.total}个账户, 成功${result.success}个, 失败${result.failed}个`);
        fetchPaginatedAccounts(); // 使用分页API刷新账户列表
      } else {
        message.error(response.data.message || '批量同步失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '批量同步失败');
      console.error('批量同步失败:', error);
    } finally {
      setBatchSyncing(false);
    }
  };
  
  // 批量同步所有账户KYC信息
  const batchSyncAllKyc = async () => {
    try {
      setBatchSyncing(true);
      message.info('开始批量同步KYC信息...');
      
      // 调用批量同步KYC信息的API
      const response = await api.post(`${API_BASE_URL}/api/infini-accounts/sync-all-kyc`);
      
      if (response.data.success) {
        message.success('批量同步KYC信息成功');
        fetchPaginatedAccounts(); // 使用分页API刷新账户列表
      } else {
        message.error(response.data.message || '批量同步KYC信息失败');
        fetchPaginatedAccounts(); // 即使失败也刷新列表，以确保数据一致性
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '批量同步KYC信息失败');
      console.error('批量同步KYC信息失败:', error);
      fetchPaginatedAccounts(); // 错误情况下也刷新列表，确保UI与服务器数据同步
    } finally {
      setBatchSyncing(false);
    }
  };
  
  // 批量同步所有账户卡片信息
  const batchSyncAllCards = async () => {
    try {
      setBatchSyncing(true);
      message.info('开始批量同步卡片信息...');
      
      // 获取所有账户
      const accountsResponse = await api.get(`${API_BASE_URL}/api/infini-accounts`);
      
      if (!accountsResponse.data.success) {
        message.error(accountsResponse.data.message || '获取账户列表失败');
        setBatchSyncing(false);
        return;
      }
      
      const allAccounts = accountsResponse.data.data || [];
      const total = allAccounts.length;
      let success = 0;
      let failed = 0;
      const results: Array<{
        id: number;
        email: string;
        success: boolean;
        message?: string;
      }> = [];
      
      // 遍历所有账户，逐个同步卡片信息
      for (const account of allAccounts) {
        try {
          const syncResponse = await api.post(`${API_BASE_URL}/api/infini-cards/sync`, {
            accountId: account.id
          });
          
          if (syncResponse.data.success) {
            success++;
            results.push({
              id: account.id,
              email: account.email,
              success: true
            });
          } else {
            failed++;
            results.push({
              id: account.id,
              email: account.email,
              success: false,
              message: syncResponse.data.message
            });
          }
        } catch (error: any) {
          failed++;
          results.push({
            id: account.id,
            email: account.email,
            success: false,
            message: error.response?.data?.message || error.message || '同步失败'
          });
        }
      }
      
      const result: BatchSyncResult = {
        total,
        success,
        failed,
        accounts: results
      };
      
      setBatchSyncResult(result);
      setBatchResultModalVisible(true);
      message.success(`批量同步卡片信息完成: 总计${total}个账户, 成功${success}个, 失败${failed}个`);
      fetchPaginatedAccounts(); // 使用分页API刷新账户列表
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '批量同步卡片信息失败');
      console.error('批量同步卡片信息失败:', error);
    } finally {
      setBatchSyncing(false);
    }
  };

  // 红包领取状态
  const [redPacketModalVisible, setRedPacketModalVisible] = useState(false);
  // 一键注册级用户模态框状态
  const [oneClickSetupModalVisible, setOneClickSetupModalVisible] = useState(false);
  const [batchRegisterModalVisible, setBatchRegisterModalVisible] = useState(false);

  // 打开红包领取模态框
  const openRedPacketModal = () => {
    setRedPacketModalVisible(true);
  };
  // 获取所有账户分组并构建账户-分组的映射关系
  const fetchGroups = async () => {
    try {
      setLoadingGroups(true);
      console.log('获取所有账户分组');
      const response = await infiniAccountApi.getAllAccountGroups();
      
      if (response.success && response.data) {
        setGroups(response.data);
        
        // 构建分组详情并建立账户-分组映射
        const groupAccountsMap = new Map<number, AccountGroup[]>();
        for (const group of response.data) {
          try {
            console.log(`获取账户分组详情，分组ID: ${group.id}`);
            const groupDetailResponse = await infiniAccountApi.getAccountGroupById(group.id);
            
            if (groupDetailResponse.success && groupDetailResponse.data && groupDetailResponse.data.accounts) {
              const groupDetail = groupDetailResponse.data;
              
              // 为每个账户添加此分组
              groupDetail.accounts.forEach((account: { id: string; email: string }) => {
                const accountId = parseInt(account.id);
                if (!isNaN(accountId)) {
                  const accountGroups = groupAccountsMap.get(accountId) || [];
                  accountGroups.push(group);
                  groupAccountsMap.set(accountId, accountGroups);
                }
              });
            }
          } catch (error) {
            console.error(`获取分组 ${group.id} 详情失败:`, error);
          }
        }
        
        setAccountGroupsMap(groupAccountsMap);
        
        // 当前accounts状态检查
        console.log(`当前accounts状态长度: ${accounts.length}`);
        
        // 只有当accounts不为空时才更新分组信息
        if (accounts && accounts.length > 0) {
          // 深拷贝当前账户数组，避免直接修改状态
          const currentAccounts = [...accounts];
          updateAccountsWithGroups(currentAccounts, groupAccountsMap);
        } else {
          console.log('当前accounts为空，稍后将在fetchAccounts完成后更新分组信息');
        }
      } else {
        message.error(response.message || '获取分组列表失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '获取分组列表失败');
      console.error('获取分组列表失败:', error);
    } finally {
      setLoadingGroups(false);
    }
  };
  
  // 更新账户对象，添加分组信息
  const updateAccountsWithGroups = (accountsList: InfiniAccount[], groupsMap: Map<number, AccountGroup[]>) => {
    console.log(`更新账户分组信息，账户数量: ${accountsList.length}, 分组映射大小: ${groupsMap.size}`);
    
    // 安全检查，确保accountsList不为空
    if (!accountsList || accountsList.length === 0) {
      console.warn('更新账户分组信息时发现账户列表为空');
      return; // 如果accountsList为空，直接返回，避免更新空数据
    }
    
    const updatedAccounts = accountsList.map(account => {
      const accountGroups = groupsMap.get(account.id) || [];
      return {
        ...account,
        groups: accountGroups
      };
    });
    
    console.log(`账户数据更新完成，新accounts长度: ${updatedAccounts.length}`);
    setAccounts(updatedAccounts); // 更新账户状态
    
    // 如果存在搜索文本，同时更新过滤后的账户列表
    if (searchText) {
      const lowerCaseValue = searchText.toLowerCase();
      const filtered = updatedAccounts.filter(account => 
        account.email.toLowerCase().includes(lowerCaseValue) || 
        account.userId.toLowerCase().includes(lowerCaseValue) ||
        (account.status && account.status.toLowerCase().includes(lowerCaseValue))
      );
      setFilteredAccounts(filtered);
    }
  };

  // 获取所有账户
  const fetchAccounts = async () => {
    try {
      setLoading(true);
      console.log('开始获取账户列表数据...');
      
      // 使用统一的api实例获取所有账户
      const response = await api.get(`${API_BASE_URL}/api/infini-accounts`);
      
      if (response.data.success) {
        const accountsData = response.data.data || [];
        console.log('获取到的账户数据总数:', accountsData.length);
        
        if (accountsData.length === 0) {
          console.warn('API返回的账户数据为空');
          setAccounts([]);
          return;
        }
        
        // 详细输出每个账户的验证级别，同时打印verification_level和verificationLevel两个字段
        accountsData.forEach((account: InfiniAccount) => {
          console.log(`账户ID: ${account.id}, 邮箱: ${account.email}, 验证级别:`, 
                     `verification_level=${account.verification_level}, verificationLevel=${account.verificationLevel}`, 
                     `2FA状态: ${account.google2faIsBound ? '已绑定' : '未绑定'}`);
          
          // 特别关注ID为7和9的账户，详细输出账户信息
          if (account.id === 7 || account.id === 9) {
            console.log(`特别关注账户 ID=${account.id}:`, JSON.stringify(account, null, 2));
            
            // 如果后端返回的是verificationLevel而不是verification_level，手动设置兼容字段
            if (account.verificationLevel !== undefined && account.verification_level === undefined) {
              account.verification_level = account.verificationLevel;
              console.log(`为账户ID=${account.id}的verification_level字段赋值:`, account.verification_level);
            }
            // 反之亦然，确保两个字段都有值
            else if (account.verification_level !== undefined && account.verificationLevel === undefined) {
              account.verificationLevel = account.verification_level;
              console.log(`为账户ID=${account.id}的verificationLevel字段赋值:`, account.verificationLevel);
            }
          }
        });
        
        // 更新账户列表前，先深度复制数据以避免引用问题
        const processedAccounts = JSON.parse(JSON.stringify(accountsData));
        
        // 直接更新账户状态，不使用setTimeout
        setAccounts(processedAccounts);
        console.log(`设置账户数据，长度: ${processedAccounts.length}`);
        
        // 如果已经获取了分组信息，直接添加分组信息
        if (accountGroupsMap.size > 0) {
          console.log('已有分组映射，直接更新账户分组信息');
          updateAccountsWithGroups(processedAccounts, accountGroupsMap);
        }
      } else {
        message.error(response.data.message || '获取账户列表失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '获取账户列表失败');
      console.error('获取账户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 首次加载
  useEffect(() => {
    // 先加载账户数据，再加载分组信息
    const loadData = async () => {
      await fetchAccounts();
      await fetchGroups();
    };
    
    loadData();
  }, []);

  // 同步账户信息
  const syncAccount = async (id: number) => {
    try {
      setSyncingAccount(id);
      
      const response = await api.post(`${API_BASE_URL}/api/infini-accounts/${id}/sync`);
      
      if (response.data.success) {
        message.success('账户信息同步成功');
        fetchPaginatedAccounts(); // 使用分页API刷新账户列表
      } else {
        message.error(response.data.message || '账户信息同步失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '账户信息同步失败');
      console.error('账户信息同步失败:', error);
    } finally {
      setSyncingAccount(null);
    }
  };

  // 同步KYC状态（从第三方同步）
  const [syncingKycAccount, setSyncingKycAccount] = useState<number | null>(null);
  const syncKycStatus = async (id: number) => {
    try {
      setSyncingKycAccount(id);
      
      // 调用同步KYC信息接口
      const response = await infiniAccountApi.getKycInformation(id.toString());
      
      if (response.success) {
        message.success('KYC状态同步成功');
        // 刷新账户列表，确保状态更新
        await fetchPaginatedAccounts();
      } else {
        message.error(response.message || 'KYC状态同步失败');
      }
    } catch (error: any) {
      message.error(error.message || 'KYC状态同步失败');
      console.error('KYC状态同步失败:', error);
    } finally {
      setSyncingKycAccount(null);
    }
  };

  // 删除账户
  const deleteAccount = async (id: number) => {
    try {
      setLoading(true);
      
      const response = await api.delete(`${API_BASE_URL}/api/infini-accounts/${id}`);
      
      if (response.data.success) {
        message.success('账户删除成功');
        fetchPaginatedAccounts(); // 使用分页API刷新账户列表
      } else {
        message.error(response.data.message || '账户删除失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '账户删除失败');
      console.error('账户删除失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 格式化时间
  const formatTime = (time?: string) => {
    if (!time) return '--';
    return dayjs(time).format('YYYY-MM-DD HH:mm:ss');
  };

  // 用于卡片详情的状态
  const [cardDetailModalVisible, setCardDetailModalVisible] = useState(false);
  const [selectedAccountForCard, setSelectedAccountForCard] = useState<InfiniAccount | null>(null);
  const [selectedCardInfo, setSelectedCardInfo] = useState<any>(null);

  // 处理查看卡片详情
  const viewCardDetail = async (account: InfiniAccount) => {
    try {
      setLoading(true);
      setSelectedAccountForCard(account);
      console.log('查看卡片详情，账户ID:', account.id);
      
      // 先设置模态框为可见，这样即使在加载数据过程中也能向用户提供反馈
      setCardDetailModalVisible(true);
      
      // 获取卡片列表
      const response = await api.get(`${API_BASE_URL}/api/infini-cards/list`, {
        params: { accountId: account.id }
      });
      
      console.log('获取到卡片列表响应:', response.data);
      
      if (response.data.success && response.data.data && response.data.data.length > 0) {
        // 选择第一张卡片作为默认展示
        const firstCard = response.data.data[0];
        console.log('选择展示的卡片信息:', firstCard);
        setSelectedCardInfo(firstCard);
      } else {
        // 即使没有卡片信息，也保持模态框可见，但显示提示信息
        setSelectedCardInfo(null);
        message.info('该账户暂无卡片信息');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '获取卡片信息失败');
      console.error('获取卡片信息失败:', error);
      // 出错时关闭模态框
      setCardDetailModalVisible(false);
    } finally {
      setLoading(false);
    }
  };
  
  // 添加调试函数，用于显示当前accounts状态
  const showAccountsStatus = () => {
    console.log(`当前accounts状态长度: ${accounts.length}`);
    if (accounts.length > 0) {
      console.log('第一个账户示例:', accounts[0]);
    }
  };

  // 表格列定义
  const allColumns: TableColumnsType<InfiniAccount> = [
    {
      title: '编号',
      dataIndex: 'index',
      key: 'index',
      width: 80,
      render: (_: any, __: any, index: number) => index + 1,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 160,
      ellipsis: true,
      sorter: (a: InfiniAccount, b: InfiniAccount) => a.email.localeCompare(b.email),
      filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: any) => (
        <div style={{ padding: 8 }}>
          <Input
            placeholder="搜索邮箱"
            value={selectedKeys[0]}
            onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
            onPressEnter={() => confirm()}
            style={{ width: 188, marginBottom: 8, display: 'block' }}
          />
          <Space>
            <Button
              type="primary"
              onClick={() => confirm()}
              size="small"
              style={{ width: 90 }}
            >
              筛选
            </Button>
            <Button onClick={() => clearFilters && clearFilters()} size="small" style={{ width: 90 }}>
              重置
            </Button>
          </Space>
        </div>
      ),
      onFilter: (value: any, record: InfiniAccount) => 
        record.email.toLowerCase().includes(value.toString().toLowerCase()),
      filterIcon: (filtered: boolean) => (
        <SearchOutlined style={{ color: filtered ? '#1890ff' : undefined }} />
      ),
      render: (text: string) => (
        <Tooltip title="点击复制邮箱">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <strong style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{text}</strong>
            <Button 
              type="primary" 
              ghost
              size="small" 
              icon={<CopyOutlined />} 
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(text, `邮箱 ${text} 已复制到剪贴板`);
              }} 
              style={{ marginLeft: 4 }}
            />
          </div>
        </Tooltip>
      )
    },
    {
      title: '用户ID',
      dataIndex: 'uid',
      key: 'userId',
      width: 240,
      ellipsis: true,
      render: (text: string) => (
        <Tooltip title="点击复制用户ID">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <strong style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{text || '未设置'}</strong>
            <Button 
              type="primary" 
              ghost
              size="small" 
              icon={<CopyOutlined />} 
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(text || '', `用户ID ${text || '未设置'} 已复制到剪贴板`);
              }} 
              style={{ marginLeft: 4 }}
              disabled={!text}
            />
          </div>
        </Tooltip>
      )
    },
    {
      title: 'KYC状态',
      dataIndex: 'verification_level',
      key: 'verification_level',
      width: 120,
      filters: [
        { text: '未认证', value: '0' },
        { text: '基础认证', value: '1' },
        { text: 'KYC认证', value: '2' },
        { text: 'KYC认证中', value: '3' },
      ],
      onFilter: (value: any, record: InfiniAccount) => {
        const actualLevel = record.verification_level !== undefined 
          ? record.verification_level 
          : record.verificationLevel;
        return actualLevel !== undefined && actualLevel.toString() === value.toString();
      },
      sorter: (a: InfiniAccount, b: InfiniAccount) => {
        const levelA = a.verification_level !== undefined ? a.verification_level : (a.verificationLevel || 0);
        const levelB = b.verification_level !== undefined ? b.verification_level : (b.verificationLevel || 0);
        return levelA - levelB;
      },
      render: (level: number | undefined, record: InfiniAccount) => {
        // 优先使用verification_level，如果为undefined则使用verificationLevel
        const actualLevel = level !== undefined ? level : record.verificationLevel;
        
        // 使用KycInfoPopover组件显示KYC状态和信息
        return (
          <KycInfoPopover accountId={record.id} verificationLevel={actualLevel} />
        );
      }
    },
    {
      title: '可用余额',
      dataIndex: 'availableBalance',
      key: 'availableBalance',
      width: 160,
      sorter: (a: InfiniAccount, b: InfiniAccount) => a.availableBalance - b.availableBalance,
      render: (_: number, record: InfiniAccount) => (
        <TransferActionPopover account={{ id: record.id, email: record.email, availableBalance: record.availableBalance }} />
      )
    },
    {
      title: '红包余额',
      dataIndex: 'redPacketBalance',
      key: 'redPacketBalance',
      width: 140,
      sorter: (a: InfiniAccount, b: InfiniAccount) => a.redPacketBalance - b.redPacketBalance,
      render: (amount: number) => {
        const { color, style } = getStyleForBalance(amount, redPacketBalanceColorRanges);
        return (
          <BalanceTag 
            color={color}
            style={style}
          >
            {amount.toFixed(6)}
          </BalanceTag>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: '活跃', value: 'active' },
        { text: '冻结', value: 'suspended' },
        { text: '其它', value: 'other' },
      ],
      onFilter: (value: any, record: InfiniAccount) => {
        const strValue = value.toString();
        if (strValue === 'other') {
          return record.status !== 'active' && record.status !== 'suspended';
        }
        return record.status === strValue;
      },
      sorter: (a: InfiniAccount, b: InfiniAccount) => {
        if (!a.status && !b.status) return 0;
        if (!a.status) return 1;
        if (!b.status) return -1;
        return a.status.localeCompare(b.status);
      },
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'orange'}>
          {status === 'active' ? '活跃' : status}
        </Tag>
      ),
    },
    {
      title: '已开卡数量',
      dataIndex: 'cardCount',
      key: 'cardCount',
      width: 120,
      sorter: true, // 支持服务器端排序
      filters: [
        { text: '无卡片', value: '=0' },
        { text: '1-3张', value: '>=1,<=3' },
        { text: '4-10张', value: '>3,<=10' },
        { text: '10张以上', value: '>10' }
      ],
      render: (text: number, record: InfiniAccount) => (
        <Popover
          title={`${record.email} 的卡片列表`}
          placement="rightBottom"
          visible={activePopoverId===record.id}
          onVisibleChange={(v)=>{if(!v){setActivePopoverId(null);}}}
          content={
            <div style={{ width: 500 }}>
              {cardListLoading ? (
                <div style={{textAlign:'center',padding:24}}><Spin /></div>
              ) : (
                text > 0 ? (
                  <div>
                    <Table
                      dataSource={cardList}
                      rowKey={(r:any)=>r.card_id||r.id}
                      pagination={false}
                      onRow={(record:any)=>({
                        onClick: ()=> showCardDetail(record),
                        style: { cursor: 'pointer' }
                      })}
                      columns={[
                        { title:'卡片ID', dataIndex:'card_id', key:'card_id'},
                        { title:'卡号后四位', dataIndex:'card_last_four_digits', key:'last4'},
                        { title:'状态', dataIndex:'status', key:'status'},
                        { title:'余额', dataIndex:'available_balance', key:'balance'},
                      ]}
                      size="small"
                      rowClassName={() => 'card-list-row'}
                    />
                    <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>
                      提示：点击行查看卡片详情
                    </div>
                    <style>{`
                      .card-list-row:hover {
                        background-color: #f5f5f5;
                      }
                    `}</style>
                  </div>
                ) : (
                  <Empty description="暂无卡片信息" />
                )
              )}
            </div>
          }
          destroyTooltipOnHide
        >
          <Tag
            color={text > 0 ? 'blue' : 'default'}
            style={{ cursor: text > 0 ? 'pointer' : 'default' }}
            onClick={()=> text>0 && handleTagClick(record)}
          >
            {text || 0}
          </Tag>
        </Popover>
      )
    },
  {
    title: '2FA',
    key: 'security',
    width: 180,
    filters: [
      { text: '2FA已绑定', value: '2fa_bound' },
      { text: '2FA未绑定', value: '2fa_unbound' },
    ],
    filterMultiple: false,
    onFilter: (value: any, record: InfiniAccount) => {
      const strValue = value.toString();
      switch (strValue) {
        case '2fa_bound': return record.google2faIsBound === true || record.google2faIsBound === 1;
        case '2fa_unbound': return record.google2faIsBound === false || record.google2faIsBound === 0;
        default: return true;
      }
    },
    render: (record: InfiniAccount) => {
      // 判断2FA是否已绑定（兼容数值和布尔值类型）
      const is2faBound = record.google2faIsBound === true || record.google2faIsBound === 1;
      return (
        <Tooltip title={is2faBound ? "Google 2FA 已绑定" : "Google 2FA 未绑定"}>
          <Tag color={is2faBound ? "green" : "orange"}>
            {is2faBound ? "已绑定" : "未绑定"}
          </Tag>
        </Tooltip>
      );
    },
  },
  {
    title: '所属分组',
    dataIndex: 'groups',
    key: 'groups',
    width: 180,
    ellipsis: true,
  filters: groups.map(group => ({ text: group.name, value: group.id })),
  onFilter: (value: any, record: InfiniAccount) => {
    // 如果没有选择任何分组过滤条件，返回true显示所有数据
    if (value === undefined || value === null) return true;
    
    // 如果账户没有groups属性或长度为0
    if (!record.groups || record.groups.length === 0) {
      // 如果选择的是默认分组，则显示没有明确分组的账户
      const defaultGroup = groups.find(g => g.isDefault);
      return Boolean(defaultGroup && String(defaultGroup.id) === String(value));
    }
    
    // 使用字符串比较确保类型一致
    return record.groups.some(group => String(group.id) === String(value));
  },
    render: (_, record: InfiniAccount) => (
      <Space size={[0, 4]} wrap>
        {record.groups && record.groups.length > 0 ? (
          record.groups.map(group => (
            <Tag 
              color={group.isDefault ? 'default' : 'blue'} 
              key={group.id}
              style={{ marginRight: 4, marginBottom: 4 }}
            >
              {group.name}
            </Tag>
          ))
        ) : (
          <Tag color="default">默认分组</Tag>
        )}
      </Space>
    )
  },
    {
      title: '最后同步时间',
      dataIndex: 'lastSyncAt',
      key: 'lastSyncAt',
      width: 180,
      sorter: (a: InfiniAccount, b: InfiniAccount) => {
        if (!a.lastSyncAt && !b.lastSyncAt) return 0;
        if (!a.lastSyncAt) return 1;
        if (!b.lastSyncAt) return -1;
        return new Date(a.lastSyncAt).getTime() - new Date(b.lastSyncAt).getTime();
      },
      render: (time: string) => formatTime(time),
    },
    {
      title: '操作',
      key: 'action',
      width: 420,
      render: (record: InfiniAccount) => (
        <Space>
          {/* 查看下拉按钮 - 包含详情和卡片详情选项 */}
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item 
                  key="detail" 
                  icon={<InfoCircleOutlined />}
                  onClick={() => viewAccountDetail(record)}
                >
                  账户详情
                </Menu.Item>
                <Menu.Item 
                  key="cardDetail" 
                  icon={<CreditCardOutlined />}
                  onClick={() => viewCardDetail(record)}
                >
                  卡片详情
                </Menu.Item>
              </Menu>
            }
            trigger={['click']}
          >
            <Button type="primary" size="small">
              查看 <DownOutlined />
            </Button>
          </Dropdown>
          
          {/* 同步下拉按钮 - 包含同步和同步KYC选项 */}
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item 
                  key="sync" 
                  icon={<SyncOutlined spin={syncingAccount === record.id} />}
                  onClick={() => syncAccount(record.id)}
                >
                  同步账户
                </Menu.Item>
                <Menu.Item 
                  key="syncKyc" 
                  icon={<IdcardOutlined spin={syncingKycAccount === record.id} />}
                  onClick={() => syncKycStatus(record.id)}
                >
                  同步KYC
                </Menu.Item>
              </Menu>
            }
            trigger={['click']}
          >
            <Button type="primary" ghost>
              同步 <DownOutlined />
            </Button>
          </Dropdown>
          
          <Popconfirm
            title="确定要删除此账户吗?"
            onConfirm={() => deleteAccount(record.id)}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <Button danger icon={<DeleteOutlined />} type="text">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  
  // 处理列宽调整
  const handleResize = useCallback(
    (index: number) => (e: React.SyntheticEvent<Element>, { size }: ResizeCallbackData) => {
      e.preventDefault();
      const newColumnWidths = { ...columnWidths };
      const key = getVisibleColumns()[index].key as string;
      newColumnWidths[key] = size.width;
      setColumnWidths(newColumnWidths);
      debouncedSaveColumnWidths(newColumnWidths);
    },
    [columnWidths, debouncedSaveColumnWidths]
  );

  // 拖拽开始事件
  const onDragStart = (e: React.DragEvent<HTMLElement>, index: number) => {
    e.dataTransfer.setData('colIndex', index.toString());
  };

  // 拖拽经过事件
  const onDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
  };

  // 拖拽放置事件
  const onDrop = (e: React.DragEvent<HTMLElement>, dropIndex: number) => {
    const dragIndex = parseInt(e.dataTransfer.getData('colIndex'));
    if (dragIndex === dropIndex) return;
    
    const newOrder = [...columnOrder];
    const keys = getVisibleColumns().map(col => col.key as string);
    
    if (newOrder.length === 0) {
      // 如果是第一次拖拽，初始化列顺序
      newOrder.push(...keys);
    }
    
    // 移动列顺序
    const dragKey = newOrder[dragIndex];
    newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, dragKey);
    
    setColumnOrder(newOrder);
    debouncedSaveColumnOrder(newOrder);
  };

  // 根据columnsToShow筛选要显示的列，并应用列顺序和列宽
  const getVisibleColumns = () => {
    // 筛选显示的列
    let visibleCols = allColumns.filter(col => columnsToShow.includes(col.key as string));
    
    // 如果有列顺序配置，按照列顺序排序
    if (columnOrder.length > 0) {
      const orderMap = new Map<string, number>();
      columnOrder.forEach((key, index) => {
        orderMap.set(key, index);
      });
      
      visibleCols = [...visibleCols].sort((a, b) => {
        const aIndex = orderMap.get(a.key as string) ?? 999;
        const bIndex = orderMap.get(b.key as string) ?? 999;
        return aIndex - bIndex;
      });
    }
    
    // 应用列宽，只保留列宽调整功能，完全移除拖拽相关属性
    return visibleCols.map((col, index) => {
      const key = col.key as string;
      const width = columnWidths[key] || col.width;
      
      return {
        ...col,
        width,
        onHeaderCell: (column: any) => ({
          width: column.width,
          onResize: handleResize(index),
          // 不再添加任何拖拽相关属性，确保不会与列宽调整功能冲突
        }),
      };
    });
  };
  
  // 处理列显示切换
  const handleColumnVisibilityChange = (checkedValues: string[]) => {
    // 确保"操作"列始终显示
    if (!checkedValues.includes('action')) {
      checkedValues.push('action');
    }
    setColumnsToShow(checkedValues);
    // 保存显示列配置
    debouncedSaveColumnsToShow(checkedValues);
  };

  // 在组件挂载时加载配置
  useEffect(() => {
    const loadConfigs = async () => {
      try {
        // 加载列宽配置
        const widthsResponse = await configApi.getConfigByKey('account_monitor_column_widths');
        if (widthsResponse.success && widthsResponse.data && widthsResponse.data.value) {
          try {
            const widths = JSON.parse(widthsResponse.data.value);
            setColumnWidths(widths);
          } catch (e) {
            console.error('解析列宽配置失败:', e);
          }
        }

        // 加载列顺序配置
        const orderResponse = await configApi.getConfigByKey('account_monitor_column_order');
        if (orderResponse.success && orderResponse.data && orderResponse.data.value) {
          try {
            const order = JSON.parse(orderResponse.data.value);
            setColumnOrder(order);
          } catch (e) {
            console.error('解析列顺序配置失败:', e);
          }
        }

        // 加载显示列配置
        const columnsResponse = await configApi.getConfigByKey('account_monitor_columns_to_show');
        if (columnsResponse.success && columnsResponse.data && columnsResponse.data.value) {
          try {
            const columns = JSON.parse(columnsResponse.data.value);
            // 确保操作列始终显示
            if (!columns.includes('action')) {
              columns.push('action');
            }
            setColumnsToShow(columns);
          } catch (e) {
            console.error('解析显示列配置失败:', e);
          }
        }
        
        // 加载红包余额颜色区间配置
        const redPacketColorResponse = await configApi.getConfigByKey('red_packet_balance_color_ranges');
        if (redPacketColorResponse.success && redPacketColorResponse.data && redPacketColorResponse.data.value) {
          try {
            const colorRanges = JSON.parse(redPacketColorResponse.data.value);
            setRedPacketBalanceColorRanges(colorRanges);
          } catch (e) {
            console.error('解析红包余额颜色区间配置失败:', e);
          }
        }
        
        // 加载用户余额颜色区间配置
        const availableColorResponse = await configApi.getConfigByKey('available_balance_color_ranges');
        if (availableColorResponse.success && availableColorResponse.data && availableColorResponse.data.value) {
          try {
            const colorRanges = JSON.parse(availableColorResponse.data.value);
            setAvailableBalanceColorRanges(colorRanges);
          } catch (e) {
            console.error('解析用户余额颜色区间配置失败:', e);
          }
        }
      } catch (error) {
        console.error('加载配置失败:', error);
      }
    };

    loadConfigs();
  }, []);
  
  // 根据columnOrder获取排序后的列
  const getOrderedColumns = () => {
    // 获取所有可见列
    const visibleCols = allColumns.filter(col => columnsToShow.includes(col.key as string));
    const visibleColumns = visibleCols.map(col => ({
      key: col.key as string,
      title: col.title as string
    }));
    
    // 如果还没有顺序配置，返回默认可见列
    if (columnOrder.length === 0) {
      return visibleColumns;
    }
    
    // 创建key到索引的映射
    const orderMap = new Map<string, number>();
    columnOrder.forEach((key, index) => {
      orderMap.set(key, index);
    });
    
    // 按照columnOrder排序
    return [...visibleColumns].sort((a, b) => {
      const aIndex = orderMap.get(a.key) ?? 999;
      const bIndex = orderMap.get(b.key) ?? 999;
      return aIndex - bIndex;
    });
  };
  
  // 初始化列顺序
  const initColumnOrder = () => {
    const visibleKeys = getVisibleColumns().map(col => col.key as string);
    setColumnOrder(visibleKeys);
    return visibleKeys;
  };
  
  // 列设置下拉菜单
  const columnsMenu = (
    <div style={{ padding: 12, minWidth: 300, backgroundColor: '#fff', border: '1px solid #f0f0f0', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)' }}>
      <Tabs defaultActiveKey="1">
        <Tabs.TabPane tab="显示列" key="1">
          <Checkbox.Group
            options={allColumns.map(col => ({
              label: col.title as string,
              value: col.key as string,
              disabled: col.key === 'action' // 操作列不可取消显示
            }))}
            value={columnsToShow}
            onChange={handleColumnVisibilityChange}
          />
        </Tabs.TabPane>
        <Tabs.TabPane tab="列顺序" key="2">
          <List
            size="small"
            bordered
            dataSource={getOrderedColumns()}
            renderItem={(item, index) => (
              <List.Item
                key={item.key}
                actions={[
                  <Button 
                    type="primary"
                    size="small"
                    shape="circle"
                    icon={<UpOutlined />}
                    style={{ marginRight: 8 }}
                    disabled={index === 0}
                    onClick={() => {
                      // 获取当前排序后的列
                      const orderedColumns = getOrderedColumns();
                      
                      // 复制列顺序数组或初始化
                      let newOrder = [...columnOrder];
                      if (newOrder.length === 0) {
                        newOrder = orderedColumns.map(col => col.key);
                      }
                      
                      // 获取当前项和上一项的key
                      const currentKey = item.key;
                      const prevKey = orderedColumns[index - 1].key;
                      
                      // 找到这两个key在顺序数组中的位置
                      const currentIndex = newOrder.indexOf(currentKey);
                      const prevIndex = newOrder.indexOf(prevKey);
                      
                      // 交换位置
                      if (currentIndex !== -1 && prevIndex !== -1) {
                        const temp = newOrder[currentIndex];
                        newOrder[currentIndex] = newOrder[prevIndex];
                        newOrder[prevIndex] = temp;
                        
                        // 更新状态并保存
                        setColumnOrder([...newOrder]);
                        debouncedSaveColumnOrder(newOrder);
                      }
                    }}
                  />,
                  <Button 
                    type="primary"
                    size="small"
                    shape="circle"
                    icon={<DownOutlined />}
                    style={{ marginLeft: 8 }}
                    disabled={index >= getOrderedColumns().length - 1}
                    onClick={() => {
                      // 获取当前排序后的列
                      const orderedColumns = getOrderedColumns();
                      
                      // 复制列顺序数组或初始化
                      let newOrder = [...columnOrder];
                      if (newOrder.length === 0) {
                        newOrder = orderedColumns.map(col => col.key);
                      }
                      
                      // 获取当前项和下一项的key
                      const currentKey = item.key;
                      const nextKey = orderedColumns[index + 1].key;
                      
                      // 找到这两个key在顺序数组中的位置
                      const currentIndex = newOrder.indexOf(currentKey);
                      const nextIndex = newOrder.indexOf(nextKey);
                      
                      // 交换位置
                      if (currentIndex !== -1 && nextIndex !== -1) {
                        const temp = newOrder[currentIndex];
                        newOrder[currentIndex] = newOrder[nextIndex];
                        newOrder[nextIndex] = temp;
                        
                        // 更新状态并保存
                        setColumnOrder([...newOrder]);
                        debouncedSaveColumnOrder(newOrder);
                      }
                    }}
                  />
                ]}
              >
                <Space>
                  <span style={{ color: '#999' }}>{index + 1}.</span>
                  {item.title}
                </Space>
              </List.Item>
            )}
          />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
  // 复制文本到剪贴板
  const copyToClipboard = (text: string, messageText: string = '已复制到剪贴板') => {
    navigator.clipboard.writeText(text)
      .then(() => {
        message.success({
          content: messageText,
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          duration: 2
        });
      })
      .catch(err => {
        console.error('复制失败:', err);
        message.error('复制失败，请手动复制');
      });
  };

  // 添加账户筛选和搜索状态
  const [searchText, setSearchText] = useState<string>('');
  const [filteredAccounts, setFilteredAccounts] = useState<InfiniAccount[]>([]);

  // 全局搜索函数
  const handleGlobalSearch = (value: string) => {
    setSearchText(value);
    
    if (!value.trim()) {
      setFilteredAccounts([]);
      return;
    }
    
    const lowerCaseValue = value.toLowerCase();
    const filtered = accounts.filter(account => 
      account.email.toLowerCase().includes(lowerCaseValue) || 
      account.userId.toLowerCase().includes(lowerCaseValue) ||
      (account.status && account.status.toLowerCase().includes(lowerCaseValue))
    );
    
    setFilteredAccounts(filtered);
  };

  // 服务器端分页数据获取
  const fetchPaginatedAccounts = async (
    paginationParams = pagination,
    filtersParams = filters, 
    sorterParams = sortInfo
  ) => {
    try {
      setLoading(true);
      console.log('获取分页数据，参数:', {
        page: paginationParams.current,
        pageSize: paginationParams.pageSize,
        filters: filtersParams,
        sortField: sorterParams.field,
        sortOrder: sorterParams.order
      });

      const response = await infiniAccountApi.getPaginatedInfiniAccounts(
        paginationParams.current,
        paginationParams.pageSize,
        filtersParams,
        sorterParams.field,
        sorterParams.order
      );

      if (response.success) {
        setAccounts(response.data.accounts);
        setPagination({
          ...paginationParams,
          total: response.data.pagination.total
        });
      } else {
        message.error(response.message || '获取账户列表失败');
      }
    } catch (error: any) {
      message.error(error.message || '获取账户列表失败');
      console.error('获取分页账户列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 驼峰式字段名到下划线分隔字段名的映射
  const fieldNameMapping: Record<string, string> = {
    'availableBalance': 'available_balance',
    'redPacketBalance': 'red_packet_balance',
    'totalConsumptionAmount': 'total_consumption_amount',
    'totalEarnBalance': 'total_earn_balance',
    'dailyConsumption': 'daily_consumption',
    'lastSyncAt': 'last_sync_at',
    'verificationLevel': 'verification_level',
    'userId': 'user_id',
    'cookieExpiresAt': 'cookie_expires_at',
    'infiniCreatedAt': 'infini_created_at',
    'googlePasswordIsSet': 'google_password_is_set',
    'google2faIsBound': 'google_2fa_is_bound',
    'mockUserId': 'mock_user_id',
    'invitationCode': 'invitation_code'
  };
  
  // 特殊字段映射，这些字段不需要表名前缀
  const directFieldMapping: Record<string, string> = {
    'cardCount': 'cardCount', // 直接使用别名排序
  };
  
  // 将驼峰字段名转换为下划线分隔字段名
  const convertFieldName = (field?: string): string | undefined => {
    if (!field) return undefined;
    
    // 检查是否是特殊字段（不需要表名前缀的字段）
    if (directFieldMapping[field]) {
      return directFieldMapping[field];
    }
    
    // 常规字段映射
    return fieldNameMapping[field] || field;
  };

  // 表格变化处理 - 处理分页、筛选和排序
  const handleTableChange = (newPagination: any, newFilters: any, sorter: any) => {
    console.log('表格变化:', { newPagination, newFilters, sorter });
    
    // 处理筛选条件
    const formattedFilters: Record<string, any> = {};
    Object.entries(newFilters).forEach(([key, values]: [string, any]) => {
      if (values && values.length > 0) {
        // 处理卡片数量的特殊筛选格式
        if (key === 'cardCount' && values[0]) {
          formattedFilters.cardCount = values[0];
        } else {
          formattedFilters[key] = values[0];
        }
      }
    });
    
    // 处理排序
    const newSortInfo = {
      field: undefined as string | undefined,
      order: undefined as 'asc' | 'desc' | undefined
    };
    
    if (sorter && sorter.field) {
      // 将驼峰字段名转换为下划线分隔的字段名供后端使用
      newSortInfo.field = convertFieldName(sorter.field);
      newSortInfo.order = sorter.order === 'ascend' ? 'asc' : 
                          sorter.order === 'descend' ? 'desc' : 
                          undefined;
      
      console.log(`字段名映射: ${sorter.field} -> ${newSortInfo.field}`);
    }
    
    // 更新状态
    setFilters(formattedFilters);
    setSortInfo(newSortInfo);
    setPagination({
      ...pagination,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    });
    
    // 获取新数据
    fetchPaginatedAccounts(
      {
        current: newPagination.current,
        pageSize: newPagination.pageSize,
        total: pagination.total
      },
      formattedFilters,
      newSortInfo
    );
  };

  // KYC信息弹窗状态
  const [kycModalVisible, setKycModalVisible] = useState<boolean>(false);
  const [kycInfo, setKycInfo] = useState<any>(null);
  const [loadingKycInfo, setLoadingKycInfo] = useState<boolean>(false);
  const [selectedKycAccountId, setSelectedKycAccountId] = useState<string>('');
  
  // 查看KYC信息
  const handleViewKycInfo = async (accountId: number, verificationLevel: number) => {
    // 显示加载状态
    setLoadingKycInfo(true);
    setKycModalVisible(true);
    setSelectedKycAccountId(accountId.toString());
    
    try {
      // 获取KYC信息
      const response = await api.get(`${API_BASE_URL}/api/infini-accounts/kyc/information/${accountId}`);
      console.log('获取KYC信息响应:', response);
      
      if (response.data.success && response.data.data.kyc_information && response.data.data.kyc_information.length > 0) {
        const kycInfoData = response.data.data.kyc_information[0];
        
        // 处理KYC认证中的状态
        if (verificationLevel === 3 && (!kycInfoData.status || kycInfoData.status === 0)) {
          kycInfoData.status = 1; // 验证中状态
        }
        
        // 转换为前端组件需要的格式
        const transformedInfo = {
          id: kycInfoData.id,
          isValid: verificationLevel === 2 ? true : Boolean(kycInfoData.is_valid),
          type: kycInfoData.type,
          s3Key: kycInfoData.s3_key,
          firstName: kycInfoData.first_name,
          lastName: kycInfoData.last_name,
          country: kycInfoData.country,
          phone: kycInfoData.phone,
          phoneCode: kycInfoData.phone_code,
          identificationNumber: kycInfoData.identification_number,
          status: verificationLevel === 2 ? 2 : kycInfoData.status,
          createdAt: kycInfoData.created_at,
          imageUrl: kycInfoData.image_url
        };
        
        setKycInfo(transformedInfo);
      } else {
        // 处理无KYC信息的情况
        if (verificationLevel === 3) {
          // KYC认证中状态，创建默认信息
          setKycInfo({
            id: accountId,
            status: 1, // 验证中状态
            isValid: false,
            type: 0,
            createdAt: Math.floor(Date.now() / 1000)
          });
        } else {
          setKycInfo({});
          message.warning('未查询到KYC信息');
        }
      }
    } catch (error) {
      console.error('获取KYC信息出错:', error);
      message.error('获取KYC信息失败');
      // 错误时也创建基本信息对象
      if (verificationLevel === 3) {
        setKycInfo({
          id: accountId,
          status: 1, // 验证中状态
          isValid: false,
          type: 0,
          createdAt: Math.floor(Date.now() / 1000)
        });
      } else {
        setKycInfo({});
      }
    } finally {
      setLoadingKycInfo(false);
    }
  };
  
  // 关闭KYC信息弹窗
  const handleCloseKycModal = () => {
    setKycModalVisible(false);
    setKycInfo(null);
    setSelectedKycAccountId('');
  };

  // 首次加载时使用分页API
  useEffect(() => {
    fetchPaginatedAccounts();
    fetchGroups();
  }, []);

  // ==== 卡片列表弹窗状态 ====
  const [cardListVisible, setCardListVisible] = useState<boolean>(false);
  const [cardListLoading, setCardListLoading] = useState<boolean>(false);
  const [cardList, setCardList] = useState<any[]>([]);
  const [cardListAccount, setCardListAccount] = useState<InfiniAccount | null>(null);
  const [activePopoverId, setActivePopoverId] = useState<number | null>(null);

  const openCardListModal = async (account: InfiniAccount) => {
    setCardListAccount(account);
    setCardListVisible(true);
    setCardListLoading(true);
    try {
      const res = await infiniCardApi.getCardList(account.id.toString());
      if (res.success) {
        setCardList(res.data.items || res.data || []);
      } else {
        message.error(res.message || '获取卡片列表失败');
      }
    } catch (e) {
      console.error('获取卡片列表失败:', e);
      message.error('获取卡片列表失败');
    } finally {
      setCardListLoading(false);
    }
  };

  const closeCardListModal = () => {
    setCardListVisible(false);
    setCardList([]);
    setCardListAccount(null);
  };

  const showCardDetail = (card: any) => {
    if (!cardListAccount) return;
    // 先关闭 Popover
    setActivePopoverId(null);
    // 直接设置当前选中的账户和卡片信息，打开卡片详情模态框
    setSelectedAccountForCard(cardListAccount);
    setSelectedCardInfo(card);
    setCardDetailModalVisible(true);
  };

  // 独立函数：仅拉取并缓存卡片列表数据，不打开旧弹窗
  const fetchCardListForAccount = async (account: InfiniAccount) => {
    setCardListAccount(account);
    setCardListLoading(true);
    try {
      const res = await infiniCardApi.getCardList(account.id.toString());
      if (res.success) {
        const cards = res.data?.items ?? res.data?.data ?? res.data ?? [];
        setCardList(Array.isArray(cards) ? cards : []);
      } else {
        message.error(res.message || '获取卡片列表失败');
        setCardList([]);
      }
    } catch (e) {
      console.error('获取卡片列表失败:', e);
      message.error('获取卡片列表失败');
      setCardList([]);
    } finally {
      setCardListLoading(false);
    }
  };

  const handleTagClick = (record: InfiniAccount) => {
    if (activePopoverId === record.id) {
      setActivePopoverId(null);
    } else {
      setActivePopoverId(record.id);
      fetchCardListForAccount(record);
    }
  };

  return (
    <div>
      <StyledCard
        title={
          <Space>
            <LinkOutlined />
            <span>Infini账户监控</span>
          </Space>
        }
        extra={
          <Space>
            <Input.Search
              placeholder="搜索账户"
              allowClear
              onSearch={handleGlobalSearch}
              onChange={(e) => handleGlobalSearch(e.target.value)}
              style={{ width: 200 }}
            />
            <Button
              type="default"
              icon={<SyncOutlined spin={loading || loadingGroups} />}
              onClick={() => {
                fetchPaginatedAccounts();
                fetchGroups();
              }}
              loading={loading || loadingGroups}
            >
              刷新列表
            </Button>
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item key="syncAll" onClick={syncAllAccounts}>
                    批量同步
                  </Menu.Item>
                  <Menu.Item key="syncAllKyc" onClick={batchSyncAllKyc}>
                    批量同步KYC信息
                  </Menu.Item>
                  <Menu.Item key="syncAllCards" onClick={batchSyncAllCards}>
                    批量同步卡片信息
                  </Menu.Item>
                  <Menu.Item key="redPacket" onClick={openRedPacketModal}>
                    批量领取红包
                  </Menu.Item>
                </Menu>
              }
              trigger={['click']}
            >
              <Button
                type="primary"
                icon={<SyncOutlined spin={batchSyncing} />}
                loading={batchSyncing}
                disabled={accounts.length === 0}
              >
                批量同步 <DownOutlined />
              </Button>
            </Dropdown>
              <Dropdown
                overlay={
                  <Menu>
                    <Menu.Item key="register" onClick={() => setRegisterModalVisible(true)}>
                      注册账户
                    </Menu.Item>
                    <Menu.Item key="randomRegister" onClick={() => setRandomUserRegisterModalVisible(true)}>
                      注册随机用户
                    </Menu.Item>
                    <Menu.Item key="oneClickSetup" onClick={() => setOneClickSetupModalVisible(true)}>
                      一键注册随机用户
                    </Menu.Item>
                    <Menu.Item key="batchRegister" onClick={() => setBatchRegisterModalVisible(true)}>
                      批量注册随机用户
                    </Menu.Item>
                  </Menu>
                }
                trigger={['click']}
              >
                <Button 
                  type="primary" 
                  icon={<UserAddOutlined />}
                  style={{ marginRight: 8 }}
                >
                  注册账户 <DownOutlined />
                </Button>
              </Dropdown>
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item key="addAccount" onClick={() => setModalVisible(true)}>
                    添加账户
                  </Menu.Item>
                  <Menu.Item key="batchAddAccount" onClick={() => setBatchAddModalVisible(true)}>
                    批量添加账户
                  </Menu.Item>
                </Menu>
              }
              trigger={['click']}
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
              >
                添加账户 <DownOutlined />
              </Button>
            </Dropdown>
            <Dropdown
              overlay={columnsMenu}
              trigger={['click']}
            >
              <Button type="primary" ghost icon={<SettingOutlined />}>
                列设置
              </Button>
            </Dropdown>
          </Space>
        }
      >
        <TableContainer>
          <Table
            columns={getVisibleColumns()}
            dataSource={searchText ? filteredAccounts : accounts}
            rowKey="id"
            loading={loading || loadingGroups}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条数据`
            }}
            scroll={{ x: 1400 }}
            onChange={handleTableChange}
            components={{
              header: {
                cell: ResizableTitle,
              },
              body: {
                row: (props) => <tr {...props} className="hover:bg-gray-50 dark:hover:bg-gray-800" />,
              }
            }}
          />
        </TableContainer>
      </StyledCard>
      
      <AccountDetailModal
        visible={detailModalVisible}
        account={selectedAccount}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedAccount(null);
        }}
        onSuccess={fetchAccounts}
      />
      
      <BatchSyncResultModal
        visible={batchResultModalVisible}
        result={batchSyncResult}
        onClose={() => setBatchResultModalVisible(false)}
      />
      <AccountCreateModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={fetchAccounts}
      />
      
      <AccountRegisterModal
        visible={registerModalVisible}
        onClose={() => setRegisterModalVisible(false)}
        onSuccess={fetchAccounts}
      />
      
      <RandomUserRegisterModal
        visible={randomUserRegisterModalVisible}
        onCancel={() => setRandomUserRegisterModalVisible(false)}
        onSuccess={(newAccount) => {
          fetchAccounts();
          setRandomUserRegisterModalVisible(false);
          message.success('随机用户注册成功');
        }}
      />
      
      {/* 批量添加账户模态框 */}
      <BatchAddAccountModal
        visible={batchAddModalVisible}
        onClose={() => setBatchAddModalVisible(false)}
        onSuccess={fetchAccounts}
      />
      
      {/* 卡片详情模态框 */}
      {cardDetailModalVisible && selectedAccountForCard && (
        <CardDetailModal
          visible={cardDetailModalVisible}
          onClose={() => {
            setCardDetailModalVisible(false);
            setSelectedCardInfo(null);
          }}
          cardId={selectedCardInfo?.card_id}
          cardInfo={selectedCardInfo || {}}
          accountId={selectedAccountForCard.id} 
          onRefresh={() => fetchAccounts()}
        />
      )}
      
      {/* 红包领取模态框 */}
      <RedPacketModal
        visible={redPacketModalVisible}
        onClose={() => setRedPacketModalVisible(false)}
        accountIds={accounts.map(account => account.id.toString())}
        onSuccess={fetchAccounts}
      />
      
      {/* 一键注册级用户模态框 */}
      <OneClickSetupModal
        visible={oneClickSetupModalVisible}
        onClose={() => setOneClickSetupModalVisible(false)}
        onSuccess={fetchAccounts}
      />
      
      {/* 批量注册随机用户模态框 */}
      <BatchRegisterModal
        visible={batchRegisterModalVisible}
        onClose={() => setBatchRegisterModalVisible(false)}
        onSuccess={fetchAccounts}
        onRegisterSuccess={(newAccount) => {
          // 每注册成功一个新账户，就更新账户列表
          setAccounts(prevAccounts => {
            // 创建一个新账户对象，确保它有基本的字段结构
            const account = {
              id: newAccount.accountId,
              userId: newAccount.userId,
              email: newAccount.email,
              availableBalance: 0,
              withdrawingAmount: 0,
              redPacketBalance: 0,
              totalConsumptionAmount: 0,
              totalEarnBalance: 0,
              dailyConsumption: 0,
              google2faIsBound: newAccount.is2faEnabled || false,
              googlePasswordIsSet: false,
              isKol: false,
              isProtected: false,
              lastSyncAt: new Date().toISOString(),
              verification_level: newAccount.isKycEnabled ? 2 : 0
            };
            
            // 返回包含新账户的列表
            return [account, ...prevAccounts];
          });
        }}
      />
      {/* 卡片列表弹窗 */}
      <Modal
        visible={cardListVisible}
        title={cardListAccount ? `${cardListAccount.email} 的卡片列表` : '卡片列表'}
        onCancel={closeCardListModal}
        footer={null}
        width={800}
      >
        <Table
          dataSource={cardList}
          loading={cardListLoading}
          rowKey={(r:any)=>r.card_id||r.id}
          pagination={false}
          onRow={(record:any)=>({
            onClick: ()=> showCardDetail(record)
          })}
          columns={[
            { title:'卡片ID', dataIndex:'card_id', key:'card_id'},
            { title:'卡号后四位', dataIndex:'card_last_four_digits', key:'last4'},
            { title:'状态', dataIndex:'status', key:'status'},
            { title:'余额', dataIndex:'available_balance', key:'balance'},
          ]}
          size="small"
        />
        <p style={{fontSize:12,color:'#999'}}>点击行查看卡片详情</p>
      </Modal>
    </div>
  );
};

// 批量添加账户模态框组件
const BatchAddAccountModal: React.FC<{
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ visible, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<Array<{
    email: string; 
    password: string; 
    key?: string;
    status?: 'success' | 'fail' | 'warning';
    errorMsg?: string;
  }>>([]);
  const [batchText, setBatchText] = useState('');
  // 添加成功和失败统计
  const [successCount, setSuccessCount] = useState<number>(0);
  const [lastFailedCount, setLastFailedCount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // 表单编辑状态
  const [editingKey, setEditingKey] = useState('');
  
  // 重置状态
  const resetState = () => {
    form.resetFields();
    setAccounts([]);
    setBatchText('');
    setEditingKey('');
    setIsSubmitting(false);
  };
  
  // 处理关闭
  const handleClose = () => {
    resetState();
    onClose();
  };
  
  // 解析文本，提取邮箱和密码
  const parseText = (text: string): Array<{email: string; password: string; key: string}> => {
    if (!text.trim()) return [];
    
    const lines = text.split('\n');
    const parsedAccounts = lines.map((line, index) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        return {
          key: `text_${index}_${Date.now()}`,
          email: parts[0],
          password: parts[1]
        };
      }
      return null;
    }).filter(account => account !== null) as Array<{email: string; password: string; key: string}>;
    
    return parsedAccounts;
  };
  
  // 处理文本输入变化
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setBatchText(text);
  };
  
  // 解析文本并生成表单
  const parseTextToForm = () => {
    if (!batchText.trim()) {
      message.warning('请先输入账户信息');
      return;
    }
    
    const parsedAccounts = parseText(batchText);
    
    // 处理去重和覆盖逻辑
    if (accounts.length > 0) {
      // 创建邮箱到账户的映射，用于快速查找
      const emailMap = new Map<string, {
        email: string; 
        password: string; 
        key: string;
        status?: 'success' | 'fail' | 'warning';
        errorMsg?: string;
      }>();
      
      // 先将现有账户放入映射
      accounts.forEach(account => {
        emailMap.set(account.email.toLowerCase(), {
          ...account, 
          key: account.key || `key_${Date.now()}_${Math.random()}`
        });
      });
      
      // 处理新解析的账户
      parsedAccounts.forEach(newAccount => {
        const lowerEmail = newAccount.email.toLowerCase();
        // 如果邮箱已存在，更新密码
        if (emailMap.has(lowerEmail)) {
          const existingAccount = emailMap.get(lowerEmail)!;
          existingAccount.password = newAccount.password;
          // 清除之前的状态
          delete existingAccount.status;
          delete existingAccount.errorMsg;
        } else {
          // 如果邮箱不存在，添加新账户
          emailMap.set(lowerEmail, newAccount);
        }
      });
      
      // 将映射转换回数组
      const mergedAccounts = Array.from(emailMap.values());
      setAccounts(mergedAccounts);
      
      message.success(`解析成功：${parsedAccounts.length}个账户已更新到表单`);
    } else {
      // 如果还没有表单数据，直接设置
      setAccounts(parsedAccounts);
      message.success(`解析成功：${parsedAccounts.length}个账户`);
    }
  };
  
  // 提交表单
  const handleSubmit = async () => {
    // 确保账户数据完整
      // 如果有正在编辑的行，提示先保存
      if (editingKey) {
        message.warning('请先保存正在编辑的账户信息');
        return;
      }
      
      // 检查账户数据完整性
      const invalidAccounts = accounts.filter(acc => !acc.email || !acc.password);
      if (invalidAccounts.length > 0) {
        message.error('存在邮箱或密码为空的账户，请检查');
        return;
      }
    
    if (accounts.length === 0) {
      message.error('请输入有效的账户信息');
      return;
    }
    
    try {
      setLoading(true);
      setIsSubmitting(true);
      
      // 筛选出尚未成功添加的账户（状态不为'success'或'warning'的账户）
      const accountsToProcess = isSubmitting 
        ? accounts.filter(acc => acc.status !== 'success' && acc.status !== 'warning')
        : accounts;
      
      if (accountsToProcess.length === 0) {
        message.info('没有需要添加的账户，所有账户都已成功添加或已存在');
        setLoading(false);
        return;
      }
      
      // 移除key字段，只发送email和password
      const accountsToSubmit = accountsToProcess.map(({ email, password }) => ({ email, password }));
      
      // 循环调用单个账户创建API
      const results = { success: 0, failed: 0, warnings: 0, messages: [] as string[] };
      const newAccountsList = [...accounts]; // 创建一个新数组，用于更新状态

      for (let i = 0; i < accountsToProcess.length; i++) {
        const account = accountsToProcess[i];
        const accountIndex = accounts.findIndex(a => a.email === account.email);
        
        if (accountIndex === -1) continue; // 安全检查
        
        try {
          const response = await api.post(`${API_BASE_URL}/api/infini-accounts`, {
            email: account.email,
            password: account.password
          });
          
          if (response.data.success) {
            results.success++;
            // 标记该账户为成功
            newAccountsList[accountIndex].status = 'success';
          } else {
            // 检查是否是"邮箱已添加过"的特殊情况
            if (response.data.message && response.data.message.includes('该邮箱已经添加过')) {
              results.warnings++;
              // 标记为警告状态（已存在）
              newAccountsList[accountIndex].status = 'warning';
              newAccountsList[accountIndex].errorMsg = response.data.message;
              // 不将这种情况添加到错误消息列表
            } else {
              results.failed++;
              // 其他失败情况，标记为失败
              newAccountsList[accountIndex].status = 'fail';
              newAccountsList[accountIndex].errorMsg = response.data.message;
              results.messages.push(`账户 ${account.email} 添加失败: ${response.data.message}`);
            }
          }
        } catch (err: any) {
          const errorMsg = err.response?.data?.message || err.message;
          
          // 检查异常中是否包含"邮箱已添加过"
          if (errorMsg && errorMsg.includes('该邮箱已经添加过')) {
            results.warnings++;
            // 标记为警告状态（已存在）
            newAccountsList[accountIndex].status = 'warning';
            newAccountsList[accountIndex].errorMsg = errorMsg;
            // 不将这种情况添加到错误消息列表
          } else {
            results.failed++;
            // 其他失败情况，标记为失败
            newAccountsList[accountIndex].status = 'fail';
            newAccountsList[accountIndex].errorMsg = errorMsg;
            results.messages.push(`账户 ${account.email} 添加失败: ${errorMsg}`);
          }
        }
      }
      
      // 更新账户列表，包含成功/警告/失败状态
      setAccounts(newAccountsList);
      
      // 更新统计信息（成功和警告都算作添加成功）
      setSuccessCount(prev => prev + results.success);
      setLastFailedCount(results.failed);
      
      if (results.failed === 0) {
        // 全部成功或警告
        if (results.warnings > 0) {
          message.success(`共处理 ${accountsToProcess.length} 个账户：成功添加 ${results.success} 个，${results.warnings} 个已存在`);
        } else {
          message.success(`成功批量添加 ${results.success} 个账户`);
        }
        
        // 如果全部成功或警告，延迟关闭模态框
        setTimeout(() => {
          resetState();
          onSuccess();
          onClose();
        }, 1500);
      } else {
        // 部分失败，显示详细信息
        Modal.error({
          title: `批量添加结果：成功 ${results.success} 个，已存在 ${results.warnings} 个，失败 ${results.failed} 个`,
          content: (
            <div>
              <p>失败详情：</p>
              <ul>
                {results.messages.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>
          ),
        });
        
        // 如果有成功的，刷新列表
        if (results.success > 0) {
          onSuccess();
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '批量添加账户失败');
      console.error('批量添加账户失败:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 表单列定义
  const columns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      editable: true,
      width: '30%',
      render: (text: string) => (
        <div>
          <MailOutlined style={{ marginRight: 8 }} />
          {text}
        </div>
      )
    },
    {
      title: '密码',
      dataIndex: 'password',
      editable: true,
      width: '30%',
      render: (text: string) => (
        <div>
          <LockOutlined style={{ marginRight: 8 }} />
          {text}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: '20%',
      render: (status: 'success' | 'fail' | 'warning' | undefined, record: any) => {
        if (!status) return null;
        
        if (status === 'success') {
          return (
            <Tag color="green">添加成功</Tag>
          );
        } else if (status === 'warning') {
          // 警告状态（邮箱已存在）
          return (
            <Tag color="orange">
              邮箱已存在
              {record.errorMsg && (
                <Tooltip title={record.errorMsg}>
                  <InfoCircleOutlined style={{ marginLeft: 4 }} />
                </Tooltip>
              )}
            </Tag>
          );
        } else {
          // 失败状态
          return (
            <Tag color="red">
              添加失败
              {record.errorMsg && (
                <Tooltip title={record.errorMsg}>
                  <InfoCircleOutlined style={{ marginLeft: 4 }} />
                </Tooltip>
              )}
            </Tag>
          );
        }
      }
    },
    {
      title: '操作',
      dataIndex: 'operation',
      render: (_: any, record: any) => {
        const editable = isEditing(record);
        return editable ? (
          <span>
            <Typography.Link
              onClick={() => save(record.key)}
              style={{ marginRight: 8 }}
            >
              保存
            </Typography.Link>
            <Popconfirm 
              title="确定取消编辑?" 
              onConfirm={cancel}
              okText="确定"
              cancelText="取消"
            >
              <a>取消</a>
            </Popconfirm>
          </span>
        ) : (
          <span>
            <Typography.Link 
              disabled={editingKey !== ''} 
              onClick={() => edit(record)}
              style={{ marginRight: 8 }}
            >
              编辑
            </Typography.Link>
            <Popconfirm 
              title="确定删除此行?" 
              onConfirm={() => deleteRow(record.key)}
              okText="确定"
              cancelText="取消"
            >
              <a>删除</a>
            </Popconfirm>
          </span>
        );
      },
    },
  ];

  // 表单行是否处于编辑状态
  const isEditing = (record: {key: string}) => record.key === editingKey;
  
  // 开始编辑行
  const edit = (record: {key: string}) => {
    form.setFieldsValue({
      email: '',
      password: '',
      ...record,
    });
    setEditingKey(record.key);
  };
  
  // 取消编辑
  const cancel = () => {
    setEditingKey('');
  };
  
  // 保存编辑
  const save = async (key: string) => {
    try {
      const row = await form.validateFields();
      const newData = [...accounts];
      const index = newData.findIndex(item => key === item.key);
      
      if (index > -1) {
        const item = newData[index];
        newData.splice(index, 1, {
          ...item,
          ...row,
        });
        setAccounts(newData);
        setEditingKey('');
      } else {
        newData.push(row);
        setAccounts(newData);
        setEditingKey('');
      }
    } catch (errInfo) {
      console.log('验证表单失败:', errInfo);
    }
  };
  
  // 删除行
  const deleteRow = (key: string) => {
    const newData = accounts.filter(item => item.key !== key);
    setAccounts(newData);
  };
  
  // 添加新行
  const addRow = () => {
    const newKey = `new_${Date.now()}`;
    const newAccount = {
      key: newKey,
      email: '',
      password: ''
    };
    setAccounts([...accounts, newAccount]);
    edit(newAccount);
  };
  
  // 处理可编辑列
  const mergedColumns = columns.map(col => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: (record: any) => ({
        record,
        inputType: col.dataIndex === 'email' ? 'email' : 'text',
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditing(record),
      }),
    };
  });
  
  // 编辑单元格组件
  const EditableCell = ({
    editing,
    dataIndex,
    title,
    inputType,
    record,
    index,
    children,
    ...restProps
  }: any) => {
    const inputNode = inputType === 'email' ? (
      <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
    ) : (
      <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
    );
    
    return (
      <td {...restProps}>
        {editing ? (
          <Form.Item
            name={dataIndex}
            style={{ margin: 0 }}
            rules={[
              {
                required: true,
                message: `请输入${title}!`,
              },
            ]}
          >
            {inputNode}
          </Form.Item>
        ) : (
          children
        )}
      </td>
    );
  };
  
  return (
    <Modal
      title="批量添加Infini账户"
      open={visible}
      onCancel={handleClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
        <Tooltip 
          title={successCount > 0 || lastFailedCount > 0 ? 
            `累计成功添加: ${successCount} 个账户, 上次失败: ${lastFailedCount} 个账户` : 
            ''}
        >
          <Button
            key="submit"
            type="primary"
            loading={loading}
            onClick={handleSubmit}
            disabled={accounts.length === 0}
          >
            {isSubmitting ? 
              `继续添加 (${accounts.filter(acc => acc.status !== 'success' && acc.status !== 'warning').length} 个账户)` : 
              `批量添加 (${accounts.length} 个账户)`}
          </Button>
        </Tooltip>,
      ]}
    >
      <div>
        <div style={{ marginBottom: 16 }}>
          <Text>请输入账户信息，每行一个账户，格式为"邮箱 密码"（以空格分隔）</Text>
          <div style={{ position: 'relative' }}>
            <Input.TextArea
              rows={5}
              value={batchText}
              onChange={handleTextChange}
              placeholder="example@email.com password123
another@email.com anotherpass
..."
            />
            <Button 
              icon={<SyncOutlined />}
              onClick={parseTextToForm}
              disabled={!batchText.trim()}
              style={{ position: 'absolute', bottom: 8, right: 8 }}
            >
              从文本解析
            </Button>
          </div>
        </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text>表单模式：可以直接编辑账户信息</Text>
            <Space>
              <Button 
                type="primary" 
                icon={<PlusOutlined />}
                onClick={addRow}
              >
                添加行
              </Button>
            </Space>
          </div>
          
          <Form form={form} component={false}>
            <Table
              components={{
                body: {
                  cell: EditableCell,
                },
              }}
              bordered
              dataSource={accounts}
              columns={mergedColumns}
              rowClassName="editable-row"
              pagination={{
                pageSize: 10,
                onChange: cancel,
              }}
              rowKey="key"
              size="small"
            />
          </Form>
        </div>
      
      <div style={{ marginTop: 16 }}>
        <Text type="secondary">
          <InfoCircleOutlined style={{ marginRight: 8 }} />
          系统将批量添加这些账户，并自动同步账户信息，相同邮箱的账户将覆盖密码
        </Text>
      </div>
    </Modal>
  );
};

export default AccountMonitor;