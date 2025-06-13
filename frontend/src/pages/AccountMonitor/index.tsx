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
  Form,
  Input,
  Row,
  Col,
  message,
  Typography,
  Tag,
  Dropdown,
  Menu,
  List,
  Checkbox,
  Tabs,
  Popover,
  Popconfirm,
  Empty,
  TableColumnsType,
  Spin,
  Select,
  Collapse,
  Tooltip,
  Modal
} from 'antd';
import {
  PlusOutlined,
  SyncOutlined,
  DeleteOutlined,
  LinkOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  UserAddOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  IdcardOutlined,
  CopyOutlined,
  CreditCardOutlined,
  BankOutlined,
  SettingOutlined,
  DownOutlined,
  UpOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { debounce, DebouncedFunc } from 'lodash';
import { ResizeCallbackData } from 'react-resizable';
import api, { apiBaseUrl, configApi, infiniAccountApi, infiniCardApi, randomUserApi } from '../../services/api';
import RandomUserRegisterModal from '../../components/RandomUserRegisterModal';
import KycInfoPopover from '../../components/KycInfoPopover';
import RedPacketModal from '../../components/RedPacketModal';
import OneClickSetupModal from '../../components/OneClickSetupModal';
import BatchRegisterModal from '../../components/BatchRegisterModal';
import BatchRecoverAccountModal from '../../components/BatchRecoverAccountModal';
import RegisterEmailSameNameModal from '../../components/RegisterEmailSameNameModal';
import TwoFaViewModal from '../../components/TwoFaViewModal';
import styled from 'styled-components';
import TransferActionPopover from '../../components/TransferActionPopover';
import { InfiniAccount, AccountGroup, BatchSyncResult } from './types';
import { formatTime, copyToClipboard, getStyleForBalance, getActualVerificationLevel } from './utils';
import ResizableTitle from './components/ResizableTitle';
import AccountDetailModal from './components/AccountDetailModal';
import BatchSyncResultModal from './components/BatchSyncResultModal';
import AccountCreateModal from './components/AccountCreateModal';
import BatchAddAccountModal from './components/BatchAddAccountModal';
import CardDetailModal from '../../components/CardDetailModal';

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

// API基础URL
const API_BASE_URL = apiBaseUrl;

// 主组件
const AccountMonitor: React.FC = () => {
  const [accounts, setAccounts] = useState<InfiniAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncingAccount, setSyncingAccount] = useState<number | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // 服务器端分页状态
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [sortInfo, setSortInfo] = useState<{ field?: string, order?: 'asc' | 'desc' }>({});
  const [randomUserRegisterModalVisible, setRandomUserRegisterModalVisible] = useState(false);
  const [registerEmailSameNameModalVisible, setRegisterEmailSameNameModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<InfiniAccount | null>(null);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [batchSyncResult, setBatchSyncResult] = useState<BatchSyncResult | null>(null);
  const [batchResultModalVisible, setBatchResultModalVisible] = useState(false);
  const [isBatchRecoverModalVisible, setIsBatchRecoverModalVisible] = useState(false);
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

  // 禁用注册功能配置状态
  const [disableRegisterFeatures, setDisableRegisterFeatures] = useState<boolean>(false);

  // 批量添加账户模态框可见状态
  const [batchAddModalVisible, setBatchAddModalVisible] = useState(false);

  // 红包领取状态
  const [redPacketModalVisible, setRedPacketModalVisible] = useState(false);
  // 一键注册级用户模态框状态
  const [oneClickSetupModalVisible, setOneClickSetupModalVisible] = useState(false);
  const [batchRegisterModalVisible, setBatchRegisterModalVisible] = useState(false);
  const [batchRecoverModalVisible, setBatchRecoverModalVisible] = useState(false);

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

  // 右键菜单状态
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuAccount, setContextMenuAccount] = useState<InfiniAccount | null>(null);
  
  // 2FA查看模态框状态
  const [twoFaViewModalVisible, setTwoFaViewModalVisible] = useState(false);
  const [twoFaInfo, setTwoFaInfo] = useState<any>(null);
  const [loadingTwoFa, setLoadingTwoFa] = useState(false);
  
  // 用于卡片详情的状态
  const [cardDetailModalVisible, setCardDetailModalVisible] = useState(false);
  const [selectedAccountForCard, setSelectedAccountForCard] = useState<InfiniAccount | null>(null);
  const [selectedCardInfo, setSelectedCardInfo] = useState<any>(null);
  const [selectedCardId, setSelectedCardId] = useState<string>('');

  // 右键菜单处理函数
  const handleContextMenu = (e: React.MouseEvent, record: InfiniAccount) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuAccount(record);
    setContextMenuVisible(true);
  };

  // 查看2FA信息
  const view2FAInfo = async (account: InfiniAccount) => {
    setSelectedAccount(account);
    setTwoFaViewModalVisible(true);
    
    try {
      setLoadingTwoFa(true);
      
      // 获取2FA信息
      const response = await api.get(`${API_BASE_URL}/api/infini-accounts/${account.id}/2fa-info`);
      
      if (response.data.success && response.data.data) {
        setTwoFaInfo(response.data.data);
      } else {
        message.warning('获取2FA信息失败: ' + (response.data.message || '未知错误'));
      }
    } catch (error: any) {
      console.error('获取2FA信息失败:', error);
      message.error('获取2FA信息失败: ' + error.message);
    } finally {
      setLoadingTwoFa(false);
    }
  };

  // 点击页面其他地方关闭右键菜单
  useEffect(() => {
    const handleClick = () => {
      setContextMenuVisible(false);
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, []);

  // 处理查看卡片详情
  const viewCardDetail = async (account: InfiniAccount, event?: React.MouseEvent) => {
    // 如果有事件对象，阻止冒泡
    if (event) {
      event.stopPropagation();
    }
    try {
      setLoading(true);
      setSelectedAccountForCard(account);
      console.log('查看卡片详情，账户ID:', account.id);
        setSelectedCardId(firstCard.card_id || firstCard.id || '');
      // 先设置模态框为可见，这样即使在加载数据过程中也能向用户提供反馈
      setCardDetailModalVisible(true);
  // 刷新卡片信息
  const refreshCardInfo = async () => {
    if (selectedAccountForCard) {
      await viewCardDetail(selectedAccountForCard);
    }
  };
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
          <Tag
            color={color}
            style={{ ...style, padding: '4px 8px', fontWeight: 600 }}
          >
            {amount.toFixed(6)}
          </Tag>
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
        <Tag
          color={text > 0 ? 'blue' : 'default'}
          style={{ cursor: text > 0 ? 'pointer' : 'default' }}
          onClick={() => text > 0 && viewCardDetail(record)}
        >
          {text || 0}
        </Tag>
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
                  onClick={(e) => {
                    e.domEvent.stopPropagation();
                    viewAccountDetail(record);
                  }}
                >
                  账户详情
                </Menu.Item>
                <Menu.Item
                  key="cardDetail"
                  icon={<CreditCardOutlined />}
                  onClick={(e) => {
                    e.domEvent.stopPropagation();
                    viewCardDetail(record);
                  }}
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
                  onClick={(e) => {
                    e.domEvent.stopPropagation();
                    syncAccount(record.id);
                  }}
                >
                  同步账户
                </Menu.Item>
                <Menu.Item
                  key="syncKyc"
                  icon={<IdcardOutlined spin={syncingKycAccount === record.id} />}
                  onClick={(e) => {
                    e.domEvent.stopPropagation();
                    syncKycStatus(record.id);
                  }}
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
          <Button 
            danger 
            icon={<DeleteOutlined />} 
            type="text"
            onClick={(e) => e.stopPropagation()}
          >
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
          onResize: handleResize(index)
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
        // 获取禁用注册功能配置
        const disableRegisterResponse = await configApi.getConfigByKey('disable_register_features');
        if (disableRegisterResponse.success && disableRegisterResponse.data) {
          // 将字符串转换为布尔值
          const disabled = disableRegisterResponse.data.value === 'true';
          setDisableRegisterFeatures(disabled);
        }

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

  // 添加账户搜索状态
  const [searchText, setSearchText] = useState<string>('');

  // 全局搜索函数 - 通过后端API实现
  const handleGlobalSearch = (value: string) => {
    setSearchText(value);

    // 构建搜索过滤条件
    const searchFilters = { ...filters };

    if (value.trim()) {
      // 使用搜索文本构建复合搜索条件
      searchFilters._search = value.trim();
    } else if (searchFilters._search) {
      // 清除之前的搜索条件
      delete searchFilters._search;
    }

    // 使用新的过滤条件刷新数据
    fetchPaginatedAccounts({
      ...pagination,
      current: 1  // 重置为第一页
    }, searchFilters, sortInfo);
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

      // 将搜索文本添加到过滤参数中
      const combinedFilters = { ...filtersParams };
      if (searchText && !combinedFilters._search) {
        combinedFilters._search = searchText;
      }

      const response = await infiniAccountApi.getPaginatedInfiniAccounts(
        paginationParams.current,
        paginationParams.pageSize,
        combinedFilters,
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

  // ==== 卡片列表弹窗状态 ====
  const [cardListVisible, setCardListVisible] = useState<boolean>(false);
  const [cardListLoading, setCardListLoading] = useState<boolean>(false);
  const [cardList, setCardList] = useState<any[]>([]);
  const [cardListAccount, setCardListAccount] = useState<InfiniAccount | null>(null);
  const [activePopoverId, setActivePopoverId] = useState<number | null>(null);

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

  const showCardDetail = (card: any) => {
    if (!cardListAccount) return;
    // 先关闭 Popover
    setActivePopoverId(null);
    // 直接设置当前选中的账户和卡片信息，打开卡片详情模态框
    setSelectedAccountForCard(cardListAccount);
    setSelectedCardInfo(card);
    setCardDetailModalVisible(true);
  };

  // 首次加载时使用分页API
  useEffect(() => {
    fetchPaginatedAccounts();
    fetchGroups();
  }, []);

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
            {!disableRegisterFeatures && (
              <Dropdown
                overlay={
                  <Menu>
                    <Menu.Item key="randomRegister" onClick={() => setRandomUserRegisterModalVisible(true)}>
                      注册随机用户
                    </Menu.Item>
                    <Menu.Item key="oneClickSetup" onClick={() => setOneClickSetupModalVisible(true)}>
                      一键注册随机用户
                    </Menu.Item>
                    <Menu.Item key="batchRegister" onClick={() => setBatchRegisterModalVisible(true)}>
                      批量注册随机用户
                    </Menu.Item>
                    <Menu.Item key="registerEmailSameName" onClick={() => setRegisterEmailSameNameModalVisible(true)}>
                      注册邮箱同名账户
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
            )}
            <Dropdown
              overlay={
                <Menu>
                  <Menu.Item key="addAccount" onClick={() => setModalVisible(true)}>
                    添加账户
                  </Menu.Item>
                  <Menu.Item key="batchAddAccount" onClick={() => setBatchAddModalVisible(true)}>
                    批量添加账户
                  </Menu.Item>
                  <Menu.Item key="batchRecoverAccount" onClick={() => setBatchRecoverModalVisible(true)}>
                    批量恢复账户
                  </Menu.Item>
                  <Menu.Item key="emailRecoverAccount" onClick={() => setIsBatchRecoverModalVisible(true)}>
                    根据邮箱恢复账号
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
            dataSource={accounts}
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
            onRow={(record) => ({
              onClick: () => viewAccountDetail(record),
              onContextMenu: (e) => handleContextMenu(e, record),
              style: { cursor: 'pointer' }
            })}
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

      {/* 账户详情模态框 */}
      <AccountDetailModal
        visible={detailModalVisible}
        account={selectedAccount}
        onClose={() => {
          setDetailModalVisible(false);
          setSelectedAccount(null);
        }}
        onSuccess={fetchAccounts}
      />

      {/* 批量恢复账户模态框 */}
      <BatchRecoverAccountModal
        visible={batchRecoverModalVisible}
        onClose={() => setBatchRecoverModalVisible(false)}
        onSuccess={fetchAccounts}
      />

      {/* 批量同步结果模态框 */}
      <BatchSyncResultModal
        visible={batchResultModalVisible}
        result={batchSyncResult}
        onClose={() => setBatchResultModalVisible(false)}
      />

      {/* 账户创建模态框 */}
      <AccountCreateModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={fetchAccounts}
      />

      {/* 随机用户注册模态框 */}
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
        onCancel={() => setCardListVisible(false)}
        footer={null}
        width={800}
      >
        <Table
          dataSource={cardList}
          loading={cardListLoading}
          rowKey={(r: any) => r.card_id || r.id}
          pagination={false}
          onRow={(record: any) => ({
            onClick: () => showCardDetail(record)
          })}
          columns={[
            { title: '卡片ID', dataIndex: 'card_id', key: 'card_id' },
            { title: '卡号后四位', dataIndex: 'card_last_four_digits', key: 'last4' },
            { title: '状态', dataIndex: 'status', key: 'status' },
            { title: '余额', dataIndex: 'available_balance', key: 'balance' },
          ]}
          size="small"
        />
        <p style={{ fontSize: 12, color: '#999' }}>点击行查看卡片详情</p>
      </Modal>


      {/* 注册邮箱同名账户模态框 */}
      <RegisterEmailSameNameModal
        visible={registerEmailSameNameModalVisible}
        onClose={() => setRegisterEmailSameNameModalVisible(false)}
        onSuccess={fetchAccounts}
      />

      {/* 2FA查看模态框 */}
      <TwoFaViewModal
        visible={twoFaViewModalVisible}
        onClose={() => setTwoFaViewModalVisible(false)}
        accountId={selectedAccount?.id.toString()}
        twoFaEnabled={selectedAccount?.google2faIsBound === true || selectedAccount?.google2faIsBound === 1}
        twoFaInfo={twoFaInfo}
      />
      
      {/* 卡片详情模态框 */}
      <CardDetailModal
        visible={cardDetailModalVisible}
        onClose={() => setCardDetailModalVisible(false)}
        accountId={selectedAccountForCard?.id || 0}
        cardId={selectedCardId}
        cardInfo={selectedCardInfo}
        onRefresh={refreshCardInfo}
      />

      {/* 右键菜单 - 使用position:fixed确保相对于视口定位 */}
      {contextMenuVisible && contextMenuAccount && (
        <div
          style={{
            position: 'fixed',
            left: `${contextMenuPosition.x}px`,
            top: `${contextMenuPosition.y}px`,
            zIndex: 1000,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            backgroundColor: '#fff',
            borderRadius: '4px',
          }}
        >
          <Menu>
            <Menu.Item 
              key="detail" 
              icon={<InfoCircleOutlined />} 
              onClick={() => {
                setContextMenuVisible(false);
                viewAccountDetail(contextMenuAccount);
              }}
            >
              查看账户详情
            </Menu.Item>
            <Menu.Item 
              key="2fa" 
              icon={<SafetyCertificateOutlined />} 
              onClick={() => {
                setContextMenuVisible(false);
                view2FAInfo(contextMenuAccount);
              }}
            >
              查看2FA信息
            </Menu.Item>
            <Menu.Item 
              key="card" 
              icon={<CreditCardOutlined />} 
              onClick={() => {
                setContextMenuVisible(false);
                viewCardDetail(contextMenuAccount);
              }}
            >
              查看卡片信息
            </Menu.Item>
          </Menu>
        </div>
      )}
    </div>
  );
};

export default AccountMonitor;