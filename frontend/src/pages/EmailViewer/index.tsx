/**
 * 邮件查看页面
 * 用于展示持久化存储的邮件
 * 支持邮件同步、查询和详情查看
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  message,
  Input,
  Select,
  Tabs,
  Tooltip,
  Row,
  Col,
  Divider,
  Alert,
  Typography,
  Badge,
  Spin,
  Tag,
  DatePicker,
  Drawer,
  Progress,
  List,
  Avatar,
  Popconfirm,
  Form,
  Radio,
  Checkbox
} from 'antd';
import type { TableProps, ColumnType } from 'antd/es/table';
import type { SortOrder } from 'antd/es/table/interface';
import {
  SyncOutlined,
  SearchOutlined,
  FilterOutlined,
  EyeOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  MailOutlined,
  ClockCircleOutlined,
  PaperClipOutlined,
  DownloadOutlined,
  InboxOutlined,
  SendOutlined,
  FolderOutlined,
  HistoryOutlined,
  ReloadOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  CloseOutlined,
  CodeOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { AxiosResponse, AxiosError } from 'axios';
import api, { apiBaseUrl } from '../../services/api';
import dayjs from 'dayjs';
import { decode } from 'quoted-printable';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;

// 样式组件
const StyledCard = styled(Card)`
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
  overflow: hidden;
`;

const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
`;

const ToolbarContainer = styled.div`
  margin-bottom: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

const SearchContainer = styled.div`
  display: flex;
  gap: 8px;
  flex: 1;
  min-width: 300px;
`;

const ActionContainer = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
`;

const DetailHeader = styled.div`
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 16px;
`;

const DetailContent = styled.div`
  padding: 16px;
  margin-bottom: 16px;
`;

const AttachmentList = styled.div`
  padding: 16px;
  background: #f9f9f9;
  border-radius: 8px;
  margin-bottom: 16px;
`;

const StatusBadge = styled(Badge)`
  margin-right: 8px;
`;

const EmailListItem = styled(List.Item)`
  padding: 12px;
  cursor: pointer;
  transition: background-color 0.3s;
  
  &:hover {
    background-color: #f0f8ff;
  }
  
  &.selected {
    background-color: #e6f7ff;
  }
`;

const SourceCodeView = styled.div`
  white-space: pre-wrap;
  padding: 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #f5f5f5;
  font-family: monospace;
  font-size: 14px;
  line-height: 1.5;
  max-height: 500px;
  overflow: auto;
`;

// 接口定义
interface EmailAccount {
  id: number;
  name: string;
  email: string;
  status: string;
}

interface EmailMessage {
  id: number;
  accountId: number;
  messageId: string;
  uid: number;
  fromAddress: string;
  fromName: string;
  toAddress: string;
  subject: string;
  date: string;
  status: 'read' | 'unread' | 'deleted';
  hasAttachments: boolean;
  attachmentsCount: number;
  mailbox: string;
  snippet: string;
  createdAt: string;
  updatedAt: string;
}

interface EmailDetail extends EmailMessage {
  ccAddress?: string;
  bccAddress?: string;
  content: {
    text: string;
    html: string;
    headers: any[];
  };
  attachments: EmailAttachment[];
}

interface EmailAttachment {
  id: number;
  filename: string;
  contentType: string;
  contentId?: string;
  contentDisposition?: string;
  size: number;
  isStored: boolean;
  downloadUrl: string;
}

interface SyncLog {
  id: number;
  accountId: number;
  syncType: 'full' | 'incremental';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalMessages: number;
  newMessages: number;
  updatedMessages: number;
  failedMessages: number;
  lastUid?: number;
  errorMessage?: string;
  mailboxes: string[];
  startTime: string;
  endTime?: string;
  metadata?: {
    startDate?: string;
    endDate?: string;
  };
}

interface EmailStats {
  totalCount: number;
  unreadCount: number;
  attachmentCount: number;
  mailboxStats: { mailbox: string; count: number }[];
  lastSyncTime?: string;
}

interface Mailbox {
  name: string;
  displayName: string;
}

interface QueryParams {
  page: number;
  pageSize: number;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  status?: string;
  fromAddress?: string;
  toAddress?: string;
  subject?: string;
  startDate?: string | null;
  endDate?: string | null;
  hasAttachments?: boolean;
  mailbox?: string;
  keyword?: string;
}

// 辅助函数：解码 Quoted-Printable 字符串
const decodeQuotedPrintable = (encodedString: string | null | undefined): string => {
  if (!encodedString) {
    return '';
  }
  try {
    // 移除软换行符（= 后跟换行符）
    const cleanedString = encodedString.replace(/=\r?\n/g, '');
    return decode(cleanedString);
  } catch (e) {
    console.error('Quoted-printable decoding failed:', e);
    return encodedString; // 解码失败则返回原始字符串
  }
};

// 邮件查看页面组件
const EmailViewer: React.FC = () => {
  // 账户相关状态
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  
  // 邮件列表相关状态
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [emailLoading, setEmailLoading] = useState<boolean>(false);
  const [selectedMailbox, setSelectedMailbox] = useState<string>('INBOX');
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  });
  
  // 邮件详情相关状态
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [emailDetail, setEmailDetail] = useState<EmailDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');
  
  // 同步相关状态
  const [syncModalVisible, setSyncModalVisible] = useState<boolean>(false);
  const [syncForm] = Form.useForm();
  const [currentSync, setCurrentSync] = useState<SyncLog | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'completed' | 'failed'>('idle');
  const [syncHistoryDrawerVisible, setSyncHistoryDrawerVisible] = useState<boolean>(false);
  const [syncHistory, setSyncHistory] = useState<SyncLog[]>([]);
  const [syncHistoryLoading, setSyncHistoryLoading] = useState<boolean>(false);
  
  // 搜索相关状态
  const [searchDrawerVisible, setSearchDrawerVisible] = useState<boolean>(false);
  const [searchForm] = Form.useForm();
  const [queryParams, setQueryParams] = useState<QueryParams>({
    page: 1,
    pageSize: 10,
    sortField: 'date',
    sortOrder: 'desc',
    mailbox: 'INBOX'
  });
  
  // 统计信息
  const [emailStats, setEmailStats] = useState<EmailStats | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);
  
  // 错误状态
  const [apiError, setApiError] = useState<string | null>(null);

  // 获取邮箱账户列表
  const fetchEmailAccounts = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await api.get(`${apiBaseUrl}/api/email-accounts`);
      
      if (response.data.success) {
        const accounts = response.data.data;
        setEmailAccounts(accounts);
        
        // 如果有默认邮箱，自动选中
        const defaultAccount = accounts.find((acc: any) => acc.isDefault);
        if (defaultAccount && defaultAccount.id) {
          setSelectedAccountId(defaultAccount.id);
        } else if (accounts.length > 0) {
          // 否则选中第一个激活的邮箱
          const activeAccount = accounts.find((acc: any) => acc.status === 'active');
          if (activeAccount && activeAccount.id) {
            setSelectedAccountId(activeAccount.id);
          }
        }
      } else {
        message.error('获取邮箱账户失败: ' + response.data.message);
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response 
        ? `服务器错误 (${axiosError.response.status}): ${JSON.stringify(axiosError.response.data)}`
        : axiosError.message || '连接服务器失败';
      
      setApiError(errorMessage);
      console.error('获取邮箱账户失败:', error);
      message.error('获取邮箱账户列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取邮箱文件夹列表
  const fetchMailboxes = useCallback(async (accountId?: number) => {
    if (!accountId) {
      // 如果没有提供有效的accountId，则使用默认文件夹列表
      setMailboxes([
        { name: 'INBOX', displayName: '收件箱' },
        { name: 'Sent', displayName: '已发送' },
        { name: 'Drafts', displayName: '草稿箱' },
        { name: 'Trash', displayName: '已删除' }
      ]);
      return;
    }
    
    try {
      const response = await api.get(`${apiBaseUrl}/api/emails/mailboxes`, {
        params: { accountId }
      });
      
      if (response.data.success) {
        setMailboxes(response.data.data);
      } else {
        console.warn('获取邮箱文件夹列表失败:', response.data.message);
        // 出错时使用默认文件夹列表
        setMailboxes([
          { name: 'INBOX', displayName: '收件箱' },
          { name: 'Sent', displayName: '已发送' },
          { name: 'Drafts', displayName: '草稿箱' },
          { name: 'Trash', displayName: '已删除' }
        ]);
      }
    } catch (error) {
      console.error('获取邮箱文件夹列表失败:', error);
      // 设置默认邮箱文件夹
      setMailboxes([
        { name: 'INBOX', displayName: '收件箱' },
        { name: 'Sent', displayName: '已发送' },
        { name: 'Drafts', displayName: '草稿箱' },
        { name: 'Trash', displayName: '已删除' }
      ]);
    }
  }, []);

  // 获取邮件列表
  const fetchEmails = useCallback(async () => {
    if (!selectedAccountId) return;
    
    setEmailLoading(true);
    setApiError(null);
    
    try {
      const response = await api.get(
        `${apiBaseUrl}/api/emails/list`,
        { params: { ...queryParams, accountId: selectedAccountId } }
      );
      
      if (response.data.success) {
        setEmails(response.data.data.emails);
        setPagination({
          current: response.data.data.pagination.page,
          pageSize: response.data.data.pagination.pageSize,
          total: response.data.data.pagination.total,
          totalPages: response.data.data.pagination.totalPages
        });
      } else {
        message.error('获取邮件列表失败: ' + response.data.message);
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response 
        ? `服务器错误 (${axiosError.response.status}): ${JSON.stringify(axiosError.response.data)}`
        : axiosError.message || '连接服务器失败';
      
      setApiError(errorMessage);
      console.error('获取邮件列表失败:', error);
      message.error('获取邮件列表失败');
    } finally {
      setEmailLoading(false);
    }
  }, [selectedAccountId, queryParams]);

  // 获取邮件详情
  const fetchEmailDetail = useCallback(async (emailId: number) => {
    setDetailLoading(true);
    
    try {
      const response = await api.get(`${apiBaseUrl}/api/emails/${emailId}`);
      
      if (response.data.success) {
        setEmailDetail(response.data.data);
        setDetailDrawerVisible(true);
      } else {
        message.error('获取邮件详情失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('获取邮件详情失败:', error);
      message.error('获取邮件详情失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // 获取邮件统计信息
  const fetchEmailStats = useCallback(async () => {
    if (!selectedAccountId) return;
    
    setStatsLoading(true);
    
    try {
      const response = await api.get(`${apiBaseUrl}/api/emails/stats/${selectedAccountId}`);
      
      if (response.data.success) {
        setEmailStats(response.data.data);
      } else {
        message.error('获取邮件统计信息失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('获取邮件统计信息失败:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedAccountId]);

  // 获取同步历史记录
  const fetchSyncHistory = useCallback(async () => {
    if (!selectedAccountId) return;
    
    setSyncHistoryLoading(true);
    
    try {
      const response = await api.get(
        `${apiBaseUrl}/api/emails/sync/history`,
        { params: { accountId: selectedAccountId } }
      );
      
      if (response.data.success) {
        setSyncHistory(response.data.data.syncLogs);
      } else {
        message.error('获取同步历史记录失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('获取同步历史记录失败:', error);
    } finally {
      setSyncHistoryLoading(false);
    }
  }, [selectedAccountId]);

  // 检查同步状态
  const checkSyncStatus = useCallback(async (syncLogId: number) => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/emails/sync/${syncLogId}/status`);
      
      if (response.data.success) {
        const syncLog = response.data.data;
        setCurrentSync(syncLog);
        
        if (syncLog.status === 'completed') {
          setSyncStatus('completed');
          message.success('同步任务已完成');
          fetchEmails();
          fetchEmailStats();
        } else if (syncLog.status === 'failed' || syncLog.status === 'cancelled') {
          setSyncStatus('failed');
          message.error('同步任务失败: ' + syncLog.errorMessage);
        } else if (syncLog.status === 'processing' || syncLog.status === 'pending') {
          setSyncStatus('syncing');
          // 继续轮询
          setTimeout(() => checkSyncStatus(syncLogId), 2000);
        }
      } else {
        setSyncStatus('failed');
        message.error('检查同步状态失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('检查同步状态失败:', error);
      setSyncStatus('failed');
    }
  }, [fetchEmails, fetchEmailStats]);

  // 开始邮件同步
  const startSync = useCallback(async (values: any) => {
    if (!selectedAccountId) {
      message.error('请先选择邮箱账户');
      return;
    }
    
    // 处理日期范围
    let startDate = undefined;
    let endDate = undefined;
    
    if (values.syncType === 'full' && values.dateRange && values.dateRange.length === 2) {
      startDate = values.dateRange[0].format('YYYY-MM-DD');
      endDate = values.dateRange[1].format('YYYY-MM-DD');
    }
    
    try {
      const response = await api.post(`${apiBaseUrl}/api/emails/sync`, {
        accountId: selectedAccountId,
        syncType: values.syncType,
        mailboxes: values.mailboxes,
        startDate,
        endDate
      });
      
      if (response.data.success) {
        const syncLogId = response.data.data.syncLogId;
        const timeRange = response.data.data.timeRange || {};
        
        setCurrentSync({
          id: syncLogId,
          accountId: selectedAccountId,
          syncType: values.syncType,
          status: 'processing',
          totalMessages: 0,
          newMessages: 0,
          updatedMessages: 0,
          failedMessages: 0,
          mailboxes: values.mailboxes,
          startTime: new Date().toISOString(),
          // 保存时间范围信息
          metadata: {
            startDate: timeRange.startDate,
            endDate: timeRange.endDate
          }
        });
        setSyncStatus('syncing');
        message.info('同步任务已启动');
        
        // 开始轮询同步状态
        checkSyncStatus(syncLogId);
      } else {
        message.error('启动同步任务失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('启动同步任务失败:', error);
      message.error('启动同步任务失败');
    }
  }, [selectedAccountId, checkSyncStatus]);

  // 取消同步任务
  const cancelSync = useCallback(async () => {
    if (!currentSync) return;
    
    try {
      const response = await api.post(`${apiBaseUrl}/api/emails/sync/${currentSync.id}/cancel`);
      
      if (response.data.success) {
        message.success('同步任务已取消');
        setSyncStatus('idle');
        setCurrentSync(null);
      } else {
        message.error('取消同步任务失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('取消同步任务失败:', error);
      message.error('取消同步任务失败');
    }
  }, [currentSync]);

  // 更新邮件状态
  const updateEmailStatus = useCallback(async (emailId: number, status: 'read' | 'unread' | 'deleted') => {
    try {
      const response = await api.put(`${apiBaseUrl}/api/emails/${emailId}/status`, { status });
      
      if (response.data.success) {
        message.success(`邮件状态已更新为 ${status}`);
        
        // 如果当前正在查看该邮件的详情，更新详情状态
        if (emailDetail && emailDetail.id === emailId) {
          setEmailDetail({
            ...emailDetail,
            status
          });
        }
        
        // 刷新邮件列表和统计
        fetchEmails();
        fetchEmailStats();
      } else {
        message.error('更新邮件状态失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('更新邮件状态失败:', error);
      message.error('更新邮件状态失败');
    }
  }, [fetchEmails, fetchEmailStats, emailDetail]);

  // 批量更新邮件状态
  const batchUpdateEmailStatus = useCallback(async (emailIds: number[], status: 'read' | 'unread' | 'deleted') => {
    try {
      const response = await api.post(`${apiBaseUrl}/api/emails/batch-status-update`, {
        ids: emailIds,
        status
      });
      
      if (response.data.success) {
        message.success(`已更新 ${emailIds.length} 封邮件的状态为 ${status}`);
        // 刷新邮件列表和统计
        fetchEmails();
        fetchEmailStats();
      } else {
        message.error('批量更新邮件状态失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('批量更新邮件状态失败:', error);
      message.error('批量更新邮件状态失败');
    }
  }, [fetchEmails, fetchEmailStats]);

  // 邮箱账户变更处理
  const handleAccountChange = useCallback((accountId: number) => {
    setSelectedEmailId(null);
    setEmailDetail(null);
    setDetailDrawerVisible(false);
    setSelectedAccountId(accountId);
    setViewMode('rendered'); // 重置为默认渲染模式
    
    // 重置查询参数
    setQueryParams(prev => ({
      ...prev,
      page: 1,
      mailbox: 'INBOX'
    }));
    setSelectedMailbox('INBOX');
  }, []);

  // 邮箱文件夹变更处理
  const handleMailboxChange = useCallback((mailbox: string) => {
    setSelectedMailbox(mailbox);
    setQueryParams(prev => ({
      ...prev,
      page: 1,
      mailbox
    }));
  }, []);

  // 表格分页变更处理
  const handleTableChange = useCallback((pagination: any, filters: any, sorter: any) => {
    setQueryParams(prev => ({
      ...prev,
      page: pagination.current,
      pageSize: pagination.pageSize,
      sortField: sorter.field || 'date',
      sortOrder: sorter.order === 'ascend' ? 'asc' : 'desc'
    }));
  }, []);

  // 搜索表单提交处理
  const handleSearch = useCallback((values: any) => {
    // 处理日期范围
    let startDate: string | null = null;
    let endDate: string | null = null;
    if (values.dateRange && values.dateRange.length === 2) {
      startDate = values.dateRange[0].format('YYYY-MM-DD');
      endDate = values.dateRange[1].format('YYYY-MM-DD');
    }
    
    // 更新查询参数
    setQueryParams(prev => ({
      ...prev,
      page: 1,
      status: values.status,
      fromAddress: values.fromAddress,
      toAddress: values.toAddress,
      subject: values.subject,
      startDate,
      endDate,
      hasAttachments: values.hasAttachments,
      keyword: values.keyword
    }));
    
    // 关闭搜索抽屉
    setSearchDrawerVisible(false);
  }, []);

  // 重置搜索
  const resetSearch = useCallback(() => {
    searchForm.resetFields();
    setQueryParams({
      page: 1,
      pageSize: 10,
      sortField: 'date',
      sortOrder: 'desc',
      mailbox: selectedMailbox
    });
    setSearchDrawerVisible(false);
  }, [searchForm, selectedMailbox]);

  // 同步表单提交处理
  const handleSyncSubmit = useCallback((values: any) => {
    // 如果是全量同步但没有选择日期范围，默认设置为一个月前到今天
    if (values.syncType === 'full' && !values.dateRange) {
      values.dateRange = [
        dayjs().subtract(1, 'month'), // 一个月前
        dayjs() // 今天
      ];
    }
    
    startSync(values);
    setSyncModalVisible(false);
  }, [startSync]);

  // 初始化加载
  useEffect(() => {
    // 清空选中的账户ID，避免使用可能存在的无效ID
    setSelectedAccountId(null);
    fetchEmailAccounts();
    // 不在这里调用fetchMailboxes，等待选择账户后再调用
  }, [fetchEmailAccounts]);

  // 账户变更时加载数据
  useEffect(() => {
    if (selectedAccountId) {
      // 首先尝试验证账户是否有效
      api.get(`${apiBaseUrl}/api/email-accounts/${selectedAccountId}`)
        .then(response => {
          if (response.data.success) {
            // 账户有效，加载相关数据
            fetchEmails();
            fetchEmailStats();
            fetchMailboxes(selectedAccountId);
          } else {
            // 账户无效，清空选中账户
            console.warn('所选邮箱账户无效:', response.data.message);
            setSelectedAccountId(null);
            message.warning('所选邮箱账户无效，请重新选择');
          }
        })
        .catch(error => {
          console.error('验证邮箱账户失败:', error);
          setSelectedAccountId(null);
          message.error('验证邮箱账户失败，请重新选择');
        });
    } else {
      // 没有选中账户时，使用默认文件夹列表
      setMailboxes([
        { name: 'INBOX', displayName: '收件箱' },
        { name: 'Sent', displayName: '已发送' },
        { name: 'Drafts', displayName: '草稿箱' },
        { name: 'Trash', displayName: '已删除' }
      ]);
    }
  }, [selectedAccountId, fetchEmails, fetchEmailStats, fetchMailboxes]);

  // 查询参数变更时重新加载邮件
  useEffect(() => {
    if (selectedAccountId) {
      fetchEmails();
    }
  }, [queryParams, fetchEmails]);

  // 同步模态窗显示时设置默认值
  useEffect(() => {
    if (syncModalVisible) {
      syncForm.setFieldsValue({
        syncType: 'incremental',
        mailboxes: ['INBOX']
      });
    }
  }, [syncModalVisible, syncForm]);

  // 同步历史抽屉显示时加载数据
  useEffect(() => {
    if (syncHistoryDrawerVisible && selectedAccountId) {
      fetchSyncHistory();
    }
  }, [syncHistoryDrawerVisible, selectedAccountId, fetchSyncHistory]);

  // 表格列定义
  const columns: ColumnType<EmailMessage>[] = [
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_: any, record: EmailMessage) => (
        <Space>
          {record.hasAttachments && (
            <Tooltip title="含附件">
              <PaperClipOutlined />
            </Tooltip>
          )}
          {record.status === 'unread' && (
            <Badge status="processing" />
          )}
        </Space>
      )
    },
    {
      title: '发件人',
      key: 'from',
      dataIndex: 'fromAddress',
      render: (fromAddress: string, record: EmailMessage) => (
        <span>
          {record.fromName ? `${record.fromName} <${fromAddress}>` : fromAddress}
        </span>
      ),
      sorter: true,
      sortOrder: queryParams.sortField === 'fromAddress' ? (queryParams.sortOrder === 'asc' ? 'ascend' as SortOrder : 'descend' as SortOrder) : undefined,
    },
    {
      title: '主题',
      dataIndex: 'subject',
      key: 'subject',
      render: (subject: string, record: EmailMessage) => (
        <div>
          <div>{subject || '(无主题)'}</div>
          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
            {record.snippet}
          </div>
        </div>
      ),
      sorter: true,
      sortOrder: queryParams.sortField === 'subject' ? (queryParams.sortOrder === 'asc' ? 'ascend' as SortOrder : 'descend' as SortOrder) : undefined,
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 180,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
      sorter: true,
      sortOrder: queryParams.sortField === 'date' ? (queryParams.sortOrder === 'asc' ? 'ascend' as SortOrder : 'descend' as SortOrder) : undefined,
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_: any, record: EmailMessage) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedEmailId(record.id);
                fetchEmailDetail(record.id);
              }}
            />
          </Tooltip>
          
          {record.status === 'unread' ? (
            <Tooltip title="标记为已读">
              <Button
                type="text"
                icon={<MailOutlined />}
                onClick={() => updateEmailStatus(record.id, 'read')}
              />
            </Tooltip>
          ) : (
            <Tooltip title="标记为未读">
              <Button
                type="text"
                icon={<MailOutlined />}
                style={{ color: '#1890ff' }}
                onClick={() => updateEmailStatus(record.id, 'unread')}
              />
            </Tooltip>
          )}
          
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => updateEmailStatus(record.id, 'deleted')}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div>
      <StyledCard
        title="持久化邮件管理"
        extra={
          <Space>
            <Select
              value={selectedAccountId}
              onChange={handleAccountChange}
              style={{ width: 250 }}
              placeholder="选择邮箱账户"
              loading={loading}
            >
              {emailAccounts.map(account => (
                <Option key={account.id} value={account.id}>
                  {account.name} ({account.email})
                </Option>
              ))}
            </Select>
            
            <Button
              icon={<SyncOutlined />}
              onClick={() => setSyncModalVisible(true)}
              disabled={!selectedAccountId}
            >
              同步邮件
            </Button>
            
            <Button
              icon={<HistoryOutlined />}
              onClick={() => setSyncHistoryDrawerVisible(true)}
              disabled={!selectedAccountId}
            >
              同步历史
            </Button>
            
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                fetchEmails();
                fetchEmailStats();
              }}
              disabled={!selectedAccountId}
            >
              刷新
            </Button>
          </Space>
        }
        bordered={false}
      >
        {apiError && (
          <Alert
            message="连接服务器失败"
            description={apiError}
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        
        {!selectedAccountId && (
          <Alert
            message="请选择邮箱账户"
            description="请在上方选择一个邮箱账户来查看邮件列表。"
            type="info"
            showIcon
          />
        )}
        
        {selectedAccountId && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={16}>
                <ToolbarContainer>
                  <SearchContainer>
                    <Input.Search
                      placeholder="搜索邮件..."
                      allowClear
                      onSearch={(value) => {
                        setQueryParams(prev => ({
                          ...prev,
                          page: 1,
                          keyword: value
                        }));
                      }}
                      style={{ width: 300 }}
                    />
                    
                    <Button
                      icon={<FilterOutlined />}
                      onClick={() => setSearchDrawerVisible(true)}
                    >
                      高级筛选
                    </Button>
                  </SearchContainer>
                  
                  <ActionContainer>
                    <Select
                      value={selectedMailbox}
                      onChange={handleMailboxChange}
                      style={{ width: 120 }}
                    >
                      {mailboxes.map(mailbox => (
                        <Option key={mailbox.name} value={mailbox.name}>
                          {mailbox.displayName}
                        </Option>
                      ))}
                    </Select>
                  </ActionContainer>
                </ToolbarContainer>
              </Col>
              
              <Col span={8}>
                <Spin spinning={statsLoading}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic
                        title="总邮件数"
                        value={emailStats?.totalCount || 0}
                        prefix={<MailOutlined />}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="未读邮件"
                        value={emailStats?.unreadCount || 0}
                        prefix={<Badge status="processing" />}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="带附件"
                        value={emailStats?.attachmentCount || 0}
                        prefix={<PaperClipOutlined />}
                      />
                    </Col>
                  </Row>
                  
                  {emailStats?.lastSyncTime && (
                    <div style={{ marginTop: 8, textAlign: 'right' }}>
                      <Text type="secondary">
                        <ClockCircleOutlined /> 上次同步: {dayjs(emailStats.lastSyncTime).format('YYYY-MM-DD HH:mm')}
                      </Text>
                    </div>
                  )}
                </Spin>
              </Col>
            </Row>
            
            <TableContainer>
              <Table
                columns={columns}
                dataSource={emails}
                rowKey="id"
                loading={emailLoading}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total) => `共 ${total} 条记录`
                }}
                onChange={handleTableChange}
                rowClassName={(record) => 
                  record.status === 'unread' ? 'font-weight-bold' : ''
                }
                locale={{
                  emptyText: emailLoading 
                    ? '加载中...' 
                    : '没有邮件'
                }}
              />
            </TableContainer>
          </>
        )}
      </StyledCard>
      
      {/* 邮件详情抽屉 */}
      <Drawer
        title="邮件详情"
        placement="right"
        width={800}
        onClose={() => setDetailDrawerVisible(false)}
        open={detailDrawerVisible}
        footer={
          <Space>
            <Button
              onClick={() => setDetailDrawerVisible(false)}
            >
              关闭
            </Button>
            
            {emailDetail && (
              <>
                {emailDetail.status === 'unread' ? (
                  <Button
                    icon={<MailOutlined />}
                    onClick={() => updateEmailStatus(emailDetail.id, 'read')}
                  >
                    标记为已读
                  </Button>
                ) : (
                  <Button
                    icon={<MailOutlined />}
                    onClick={() => updateEmailStatus(emailDetail.id, 'unread')}
                  >
                    标记为未读
                  </Button>
                )}
                
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => {
                    updateEmailStatus(emailDetail.id, 'deleted');
                    setDetailDrawerVisible(false);
                  }}
                >
                  删除
                </Button>
              </>
            )}
          </Space>
        }
      >
        <Spin spinning={detailLoading}>
          {emailDetail && (
            <>
              <DetailHeader>
                <Title level={4}>{emailDetail.subject || '(无主题)'}</Title>
                
                <Row>
                  <Col span={4}>
                    <Text strong>发件人:</Text>
                  </Col>
                  <Col span={20}>
                    <Text>
                      {emailDetail.fromName 
                        ? `${emailDetail.fromName} <${emailDetail.fromAddress}>` 
                        : emailDetail.fromAddress}
                    </Text>
                  </Col>
                </Row>
                
                <Row>
                  <Col span={4}>
                    <Text strong>收件人:</Text>
                  </Col>
                  <Col span={20}>
                    <Text>{emailDetail.toAddress}</Text>
                  </Col>
                </Row>
                
                {emailDetail.ccAddress && (
                  <Row>
                    <Col span={4}>
                      <Text strong>抄送:</Text>
                    </Col>
                    <Col span={20}>
                      <Text>{emailDetail.ccAddress}</Text>
                    </Col>
                  </Row>
                )}
                
                <Row>
                  <Col span={4}>
                    <Text strong>日期:</Text>
                  </Col>
                  <Col span={20}>
                    <Text>{dayjs(emailDetail.date).format('YYYY-MM-DD HH:mm:ss')}</Text>
                  </Col>
                </Row>
                
                <Row>
                  <Col span={4}>
                    <Text strong>状态:</Text>
                  </Col>
                  <Col span={20}>
                    <Tag color={emailDetail.status === 'unread' ? 'blue' : 'default'}>
                      {emailDetail.status === 'unread' ? '未读' : '已读'}
                    </Tag>
                  </Col>
                </Row>
              </DetailHeader>
              
              {emailDetail.attachments && emailDetail.attachments.length > 0 && (
                <AttachmentList>
                  <Title level={5}><PaperClipOutlined /> 附件 ({emailDetail.attachments.length})</Title>
                  <List
                    itemLayout="horizontal"
                    dataSource={emailDetail.attachments}
                    renderItem={attachment => (
                      <List.Item
                        actions={[
                          <Button
                            type="link"
                            icon={<DownloadOutlined />}
                            href={attachment.downloadUrl}
                            target="_blank"
                          >
                            下载
                          </Button>
                        ]}
                      >
                        <List.Item.Meta
                          avatar={
                            <Avatar icon={<PaperClipOutlined />} />
                          }
                          title={attachment.filename}
                          description={`${attachment.contentType}, ${(attachment.size / 1024).toFixed(2)} KB`}
                        />
                      </List.Item>
                    )}
                  />
                </AttachmentList>
              )}
              
              {/* 添加显示模式切换 */}
              <div style={{ marginBottom: '16px' }}>
                <Radio.Group 
                  value={viewMode} 
                  onChange={(e) => setViewMode(e.target.value)}
                  optionType="button" 
                  buttonStyle="solid"
                >
                  <Radio.Button value="rendered">
                    <EyeOutlined /> 渲染模式
                  </Radio.Button>
                  <Radio.Button value="source">
                    <CodeOutlined /> 源码模式
                  </Radio.Button>
                </Radio.Group>
              </div>
              
              <DetailContent>
                {viewMode === 'rendered' ? (
                  // 渲染模式：智能识别MIME多部分邮件并提取内容
                  emailDetail.content.html ? (
                    (() => {
                      // 检测是否为MIME多部分邮件
                      const htmlContent = emailDetail.content.html;
                      const isMimeMultipart = htmlContent.includes('Content-Type: ') || 
                                              htmlContent.includes('boundary=') ||
                                              /--[_\w=]+/.test(htmlContent);
                      
                      if (isMimeMultipart) {
                        try {
                          // 优先尝试识别特定分隔符模式（如--_----------=_MCPart_1167236093）
                          const specificBoundaryMatch = htmlContent.match(/--([_\-\w=]+)/);
                          let boundary = '';
                          
                          if (specificBoundaryMatch && specificBoundaryMatch[1]) {
                            boundary = specificBoundaryMatch[0]; // 使用完整的分隔符（包括前导--）
                          } else {
                            // 标准方式查找boundary
                            const boundaryMatch = htmlContent.match(/boundary="?([^"\r\n;]+)"?/i);
                            if (boundaryMatch && boundaryMatch[1]) {
                              boundary = '--' + boundaryMatch[1]; // 添加前导--
                            }
                          }
                          
                          if (boundary) {
                            console.log('找到MIME分隔符:', boundary);
                            
                            // 分割邮件内容（处理可能的结束分隔符：boundary--）
                            const endBoundary = boundary + '--';
                            const parts = htmlContent.split(new RegExp(`${boundary}|${endBoundary}`, 'g'));
                            
                            // 寻找HTML部分
                            let htmlPart = '';
                            for (const part of parts) {
                              if (!part.trim()) continue; // 跳过空部分
                              
                              // 检查是否包含HTML内容类型标记
                              if (part.includes('Content-Type: text/html') || 
                                  part.includes('content-type: text/html')) {
                                // 提取HTML部分内容，去除所有头信息
                                // 查找第一个空行（头信息和内容的分隔）
                                const headerEnd = part.search(/\r?\n\r?\n/);
                                if (headerEnd !== -1) {
                                  const headers = part.substring(0, headerEnd);
                                  htmlPart = part.substring(headerEnd + 2); // +2 跳过空行
                                  
                                  // 检查内容的传输编码
                                  const transferEncodingMatch = 
                                    headers.match(/Content-Transfer-Encoding:\s*([^\r\n;]+)/i);
                                  
                                  if (transferEncodingMatch) {
                                    const encoding = transferEncodingMatch[1].trim().toLowerCase();
                                    console.log('发现内容编码:', encoding);
                                    
                                    // 处理引用印码(quoted-printable)编码
                                    if (encoding === 'quoted-printable') {
                                      htmlPart = decodeQuotedPrintable(htmlPart);
                                    }
                                    // 处理base64编码
                                    else if (encoding === 'base64') {
                                      try {
                                        htmlPart = atob(htmlPart.replace(/\s+/g, ''));
                                      } catch (e) {
                                        console.error('Base64解码失败:', e);
                                      }
                                    }
                                  }
                                  
                                  // 移除尾部可能的分隔符和空白字符
                                  htmlPart = htmlPart.replace(new RegExp(`[\r\n]*${endBoundary}[\r\n]*$`), '');
                                  htmlPart = htmlPart.trim();
                                  
                                  break;
                                }
                              }
                            }
                            
                            if (htmlPart) {
                              console.log('成功提取HTML部分，长度:', htmlPart.length);
                              // 渲染提取的HTML部分
                              return (
                                <iframe
                                  srcDoc={htmlPart}
                                  style={{ width: '100%', height: '500px', border: 'none' }}
                                  title="邮件HTML内容"
                                />
                              );
                            }
                          }
                        } catch (error) {
                          console.error('解析MIME邮件出错:', error);
                        }
                      }
                      
                      // 如果不是多部分邮件或解析失败，使用默认HTML渲染
                      // 确保这里的 htmlContent 也被解码
                      return (
                        <iframe
                          srcDoc={decodeQuotedPrintable(htmlContent)}
                          style={{ width: '100%', height: '500px', border: 'none' }}
                          title="邮件内容"
                        />
                      );
                    })()
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap' }}>
                      {emailDetail.content.text || '(无内容)'}
                    </div>
                  )
                ) : (
                  // 源码模式：显示原始HTML/MIME源码
                  <SourceCodeView>
                    {emailDetail.content.html || emailDetail.content.text || '(无内容)'}
                  </SourceCodeView>
                )}
              </DetailContent>
            </>
          )}
        </Spin>
      </Drawer>
      
      {/* 高级搜索抽屉 */}
      <Drawer
        title="高级搜索"
        placement="right"
        width={500}
        onClose={() => setSearchDrawerVisible(false)}
        open={searchDrawerVisible}
        footer={
          <Space>
            <Button onClick={resetSearch}>重置</Button>
            <Button
              type="primary"
              onClick={() => searchForm.submit()}
            >
              搜索
            </Button>
          </Space>
        }
      >
        <Form
          form={searchForm}
          layout="vertical"
          onFinish={handleSearch}
        >
          <Form.Item name="keyword" label="关键词">
            <Input placeholder="搜索邮件内容..." />
          </Form.Item>
          
          <Form.Item name="subject" label="主题">
            <Input placeholder="邮件主题..." />
          </Form.Item>
          
          <Form.Item name="fromAddress" label="发件人">
            <Input placeholder="发件人邮箱..." />
          </Form.Item>
          
          <Form.Item name="toAddress" label="收件人">
            <Input placeholder="收件人邮箱..." />
          </Form.Item>
          
          <Form.Item name="dateRange" label="日期范围">
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          
          <Form.Item name="status" label="状态">
            <Select placeholder="选择邮件状态">
              <Option value="read">已读</Option>
              <Option value="unread">未读</Option>
              <Option value="deleted">已删除</Option>
            </Select>
          </Form.Item>
          
          <Form.Item name="hasAttachments" valuePropName="checked">
            <Checkbox>只显示带附件的邮件</Checkbox>
          </Form.Item>
        </Form>
      </Drawer>
      
      {/* 同步模态窗 */}
      <Modal
        title="同步邮件"
        open={syncModalVisible}
        onCancel={() => setSyncModalVisible(false)}
        footer={null}
      >
        <Form
          form={syncForm}
          layout="vertical"
          onFinish={handleSyncSubmit}
        >
          <Form.Item
            name="syncType"
            label="同步类型"
            rules={[{ required: true, message: '请选择同步类型' }]}
          >
            <Radio.Group>
              <Radio value="incremental">增量同步 (只同步新邮件)</Radio>
              <Radio value="full">全量同步 (同步所有邮件)</Radio>
            </Radio.Group>
          </Form.Item>
          
          <Form.Item
            name="mailboxes"
            label="邮箱文件夹"
            rules={[{ required: true, message: '请选择邮箱文件夹' }]}
          >
            <Select
              mode="multiple"
              placeholder="选择要同步的文件夹"
            >
              {mailboxes.map(mailbox => (
                <Option key={mailbox.name} value={mailbox.name}>
                  {mailbox.displayName}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          {/* 添加日期范围选择器，仅在选择全量同步时显示 */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.syncType !== currentValues.syncType
            }
          >
            {({ getFieldValue }) => (
              getFieldValue('syncType') === 'full' && (
                <Form.Item
                  name="dateRange"
                  label="时间范围"
                  help="默认同步一个月前至今的邮件。如需同步所有历史邮件，请留空。"
                >
                  <RangePicker 
                    style={{ width: '100%' }}
                    placeholder={['开始日期', '结束日期']}
                    allowClear={true}
                  />
                </Form.Item>
              )
            )}
          </Form.Item>
          
          <Alert
            message="同步说明"
            description={
              <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
                <li>增量同步：仅同步自上次同步以来的新邮件，速度快</li>
                <li>全量同步：默认同步一个月前至今的邮件，可自定义时间范围</li>
                <li>同步过程可能需要几分钟时间，取决于邮件数量</li>
              </ul>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                开始同步
              </Button>
              <Button onClick={() => setSyncModalVisible(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
        
        {syncStatus === 'syncing' && currentSync && (
          <div>
            <Divider />
            <Alert
              message="同步进行中"
              description={
                <div>
                  <Progress percent={50} status="active" />
                  <div style={{ marginTop: 8 }}>
                    <p>账户: {emailAccounts.find(acc => acc.id === currentSync.accountId)?.name}</p>
                    <p>同步类型: {currentSync.syncType === 'full' ? '全量同步' : '增量同步'}</p>
                    <p>文件夹: {currentSync.mailboxes.join(', ')}</p>
                    <p>开始时间: {dayjs(currentSync.startTime).format('YYYY-MM-DD HH:mm:ss')}</p>
                    {currentSync.metadata?.startDate && (
                      <p>同步时间范围: {currentSync.metadata.startDate} 至 {currentSync.metadata.endDate || '现在'}</p>
                    )}
                    <Space>
                      <Button danger onClick={cancelSync}>取消同步</Button>
                    </Space>
                  </div>
                </div>
              }
              type="info"
              showIcon={false}
            />
          </div>
        )}
      </Modal>
      
      {/* 同步历史抽屉 */}
      <Drawer
        title="同步历史记录"
        placement="right"
        width={650}
        onClose={() => setSyncHistoryDrawerVisible(false)}
        open={syncHistoryDrawerVisible}
      >
        <Spin spinning={syncHistoryLoading}>
          <List
            itemLayout="vertical"
            dataSource={syncHistory}
            renderItem={item => (
              <List.Item
                key={item.id}
                extra={
                  <Space>
                    {item.status === 'processing' && (
                      <Button
                        danger
                        size="small"
                        onClick={() => {
                          setCurrentSync(item);
                          cancelSync();
                        }}
                      >
                        取消
                      </Button>
                    )}
                  </Space>
                }
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <span>同步ID: {item.id}</span>
                      <Tag color={
                        item.status === 'completed' ? 'green' :
                        item.status === 'processing' ? 'blue' :
                        item.status === 'failed' ? 'red' : 'orange'
                      }>
                        {
                          item.status === 'completed' ? '完成' :
                          item.status === 'processing' ? '进行中' :
                          item.status === 'failed' ? '失败' :
                          item.status === 'cancelled' ? '已取消' : '等待中'
                        }
                      </Tag>
                    </Space>
                  }
                  description={
                    <div>
                      <p>类型: {item.syncType === 'full' ? '全量同步' : '增量同步'}</p>
                      <p>文件夹: {item.mailboxes.join(', ')}</p>
                      <p>开始时间: {dayjs(item.startTime).format('YYYY-MM-DD HH:mm:ss')}</p>
                      {item.endTime && (
                        <p>结束时间: {dayjs(item.endTime).format('YYYY-MM-DD HH:mm:ss')}</p>
                      )}
                      {item.metadata?.startDate && (
                        <p>同步时间范围: {item.metadata.startDate} 至 {item.metadata.endDate || '现在'}</p>
                      )}
                    </div>
                  }
                />
                <div>
                  <Row gutter={16}>
                    <Col span={6}>
                      <Statistic
                        title="总邮件数"
                        value={item.totalMessages}
                        valueStyle={{ fontSize: '16px' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="新增邮件"
                        value={item.newMessages}
                        valueStyle={{ fontSize: '16px' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="更新邮件"
                        value={item.updatedMessages}
                        valueStyle={{ fontSize: '16px' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="失败邮件"
                        value={item.failedMessages}
                        valueStyle={{ fontSize: '16px', color: item.failedMessages > 0 ? '#ff4d4f' : undefined }}
                      />
                    </Col>
                  </Row>
                  
                  {item.errorMessage && (
                    <Alert
                      message="同步错误"
                      description={item.errorMessage}
                      type="error"
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                </div>
              </List.Item>
            )}
          />
        </Spin>
      </Drawer>
    </div>
  );
};

// 统计卡片组件
const Statistic: React.FC<{
  title: string;
  value: number;
  prefix?: React.ReactNode;
  valueStyle?: React.CSSProperties;
}> = ({ title, value, prefix, valueStyle }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ color: '#999', fontSize: '14px' }}>{title}</div>
    <div style={{ fontSize: '24px', fontWeight: 'bold', ...valueStyle }}>
      {prefix && <span style={{ marginRight: '8px' }}>{prefix}</span>}
      {value}
    </div>
  </div>
);

export default EmailViewer;