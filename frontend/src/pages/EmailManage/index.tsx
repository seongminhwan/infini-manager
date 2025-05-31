/**
 * 主邮箱管理页面
 * 提供邮箱配置的管理功能
 * 以及邮件列表的查看功能
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  message,
  Form,
  Input,
  Switch,
  Select,
  Tabs,
  Tooltip,
  Popconfirm,
  Row,
  Col,
  Divider,
  Alert,
  Typography,
  Badge,
  Spin,
  Tag
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SendOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  MailOutlined,
  ClockCircleOutlined,
  PaperClipOutlined,
  CloseOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { AxiosResponse, AxiosError } from 'axios';
import api, { apiBaseUrl } from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

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

const FormContainer = styled.div`
  padding: 20px;
  border-radius: 8px;
  background: #fff;
`;

const HelpPanel = styled.div`
  padding: 20px;
  background: #f9f9f9;
  border-radius: 8px;
  height: 100%;
  overflow-y: auto;
  max-height: 700px;
`;

const StatusBadge = styled(Badge)`
  margin-right: 8px;
`;

const TestButton = styled(Button)`
  margin-left: 8px;
`;

const HelpTitle = styled(Title)`
  font-size: 18px !important;
  margin-bottom: 16px !important;
`;

const HelpSection = styled.div`
  margin-bottom: 24px;
`;

// 邮箱账户接口
interface EmailAccount {
  id: number;
  name: string;
  email: string;
  imap_host: string;
  imap_port: number;
  imap_secure: number; // 后端使用0/1表示布尔值
  smtp_host: string;
  smtp_port: number;
  smtp_secure: number; // 后端使用0/1表示布尔值
  password: string;
  is_default: number; // 后端使用0/1表示布尔值
  status: string; // 后端使用'active'等状态
  created_at: string;
  updated_at: string;
  extra_config: any | null;
  
  // 前端表单使用的字段，可选
  username?: string;
  secure_imap?: boolean | number;
  host_smtp?: string;
  port_smtp?: number;
  secure_smtp?: boolean | number;
  is_active?: boolean | number;
}

// 邮件列表项接口
interface EmailMessage {
  uid: number;
  messageId?: string;
  date?: Date;
  subject?: string;
  from?: string;
  to?: string;
  hasAttachments?: boolean;
  attachmentsCount?: number;
  flags?: string[];
  snippet?: string;
}

// 邮件详情接口
interface EmailMessageDetail extends EmailMessage {
  html?: string;
  text?: string;
  cc?: string;
  bcc?: string;
  attachments?: any[];
}

// 主邮箱管理组件
const EmailManage: React.FC = () => {
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [currentAccount, setCurrentAccount] = useState<EmailAccount | null>(null);
  const [form] = Form.useForm();
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testProgress, setTestProgress] = useState<number>(0);
  const testTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 邮件列表相关状态
  const [activeTab, setActiveTab] = useState<string>('accounts');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [emailLoading, setEmailLoading] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessageDetail | null>(null);
  const [emailDetailLoading, setEmailDetailLoading] = useState<boolean>(false);
  const [mailbox, setMailbox] = useState<string>('INBOX');
  const [emailPagination, setEmailPagination] = useState({ current: 1, pageSize: 10 });

  // 使用导入的邮箱管理API基础URL

  // 模拟邮箱账户数据（用于API不可用时）
  const mockEmailAccounts: EmailAccount[] = [
    {
      id: 1,
      name: "公司主邮箱（示例）",
      email: "example@company.com",
      imap_host: "imap.gmail.com",
      imap_port: 993,
      imap_secure: 1,
      smtp_host: "smtp.gmail.com",
      smtp_port: 465,
      smtp_secure: 1,
      password: "********",
      is_default: 1,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      extra_config: null
    },
    {
      id: 2,
      name: "备用邮箱（示例）",
      email: "backup@company.com",
      imap_host: "imap.gmail.com",
      imap_port: 993,
      imap_secure: 1,
      smtp_host: "smtp.gmail.com",
      smtp_port: 465,
      smtp_secure: 1,
      password: "********",
      is_default: 0,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      extra_config: null
    }
  ];

  // 错误状态
  const [apiError, setApiError] = useState<string | null>(null);

  // 加载邮箱账户数据
  /**
   * 刷新数据
   */
  const handleRefresh = () => {
    fetchEmailAccounts();
  };

  /**
   * 获取邮箱账户
   */
  const fetchEmailAccounts = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await api.get(`${apiBaseUrl}/api/email-accounts`);
      
    // 将驼峰式命名字段映射为下划线命名字段，确保表格正确显示数据
    const convertedAccounts = response.data.data.map((account: any) => {
      return {
        id: account.id,
        name: account.name,
        email: account.email,
        imap_host: account.imapHost, // 驼峰转下划线
        imap_port: account.imapPort,
        imap_secure: account.imapSecure,
        smtp_host: account.smtpHost, // 驼峰转下划线
        smtp_port: account.smtpPort,
        smtp_secure: account.smtpSecure,
        password: account.password, // 密码不进行任何处理
        is_default: account.isDefault,
        status: account.status,
        created_at: account.createdAt,
        updated_at: account.updatedAt,
        extra_config: account.extraConfig,
        
        // 前端使用的额外字段
        host_imap: account.imapHost,
        port_imap: account.imapPort,
        secure_imap: !!account.imapSecure,
        host_smtp: account.smtpHost,
        port_smtp: account.smtpPort,
        secure_smtp: !!account.smtpSecure,
        username: account.email,
        is_active: account.status === 'active',
        domain_name: account.domainName
      };
    });
      
      setEmailAccounts(convertedAccounts);
      
      // 如果有默认邮箱，自动选中
      const defaultAccount = convertedAccounts.find((acc: EmailAccount) => acc.is_default === 1);
      if (defaultAccount && defaultAccount.id) {
        setSelectedAccountId(defaultAccount.id);
      } else if (convertedAccounts.length > 0) {
        // 否则选中第一个激活的邮箱
        const activeAccount = convertedAccounts.find((acc: EmailAccount) => acc.status === 'active');
        if (activeAccount && activeAccount.id) {
          setSelectedAccountId(activeAccount.id);
        }
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response 
        ? `服务器错误 (${axiosError.response.status}): ${JSON.stringify(axiosError.response.data)}`
        : axiosError.message || '连接服务器失败';
      
      setApiError(errorMessage);
      console.error('Failed to fetch email accounts:', error);
      
      // 当API不可用时使用模拟数据
      message.warning('无法连接到服务器，显示示例数据');
      setEmailAccounts(mockEmailAccounts);
      
      // 自动选中模拟数据中的第一个邮箱
      if (mockEmailAccounts.length > 0) {
        setSelectedAccountId(mockEmailAccounts[0].id);
      }
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * 获取邮件列表
   */
  const fetchEmails = async (accountId: number) => {
    if (!accountId) return;
    
    setEmailLoading(true);
    setEmailError(null);
    setEmails([]);
    
    try {
      const response = await api.get(
        `${apiBaseUrl}/api/email-accounts/${accountId}/messages`, {
          params: {
            mailbox,
            limit: emailPagination.pageSize,
            markSeen: false
          }
        }
      );
      
      if (response.data.success) {
        setEmails(response.data.data || []);
      } else {
        setEmailError(response.data.message || '获取邮件列表失败');
        message.error('获取邮件列表失败: ' + response.data.message);
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response 
        ? `服务器错误 (${axiosError.response.status}): ${JSON.stringify(axiosError.response.data)}`
        : axiosError.message || '连接服务器失败';
      
      setEmailError(errorMessage);
      console.error('获取邮件列表失败:', error);
      message.error('获取邮件列表失败: ' + errorMessage);
      
      // 生成模拟数据进行展示
      const mockEmails: EmailMessage[] = Array(5).fill(0).map((_, index) => ({
        uid: index + 1,
        messageId: `mock-${index + 1}`,
        date: new Date(Date.now() - index * 3600000),
        subject: `示例邮件 #${index + 1}`,
        from: 'example@gmail.com',
        to: 'user@company.com',
        hasAttachments: index % 2 === 0,
        attachmentsCount: index % 2 === 0 ? 1 : 0,
        flags: ['\\Seen'],
        snippet: `这是一封示例邮件的内容摘要... (#${index + 1})`
      }));
      
      setEmails(mockEmails);
      message.warning('显示示例邮件数据');
    } finally {
      setEmailLoading(false);
    }
  };
  
  /**
   * 获取邮件详情
   */
  const fetchEmailDetail = async (accountId: number, uid: number) => {
    if (!accountId || !uid) return;
    
    setEmailDetailLoading(true);
    
    try {
      const response = await api.get(
        `${apiBaseUrl}/api/email-accounts/${accountId}/messages/${uid}`, {
          params: { mailbox }
        }
      );
      
      if (response.data.success) {
        setSelectedEmail(response.data.data);
      } else {
        message.error('获取邮件详情失败: ' + response.data.message);
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('获取邮件详情失败:', error);
      message.error('获取邮件详情失败');
      
      // 生成模拟数据
      const mockDetail: EmailMessageDetail = {
        uid,
        messageId: `mock-detail-${uid}`,
        date: new Date(),
        subject: `示例邮件详情 #${uid}`,
        from: 'example@gmail.com',
        to: 'user@company.com',
        html: `
          <div style="padding: 20px; font-family: Arial, sans-serif;">
            <h2>示例邮件内容</h2>
            <p>这是一封示例邮件的详细内容。</p>
            <p>您正在查看的是邮件模拟数据，因为无法连接到服务器。</p>
            <p>邮件ID: ${uid}</p>
            <p>祝您使用愉快！</p>
          </div>
        `,
        text: '这是示例邮件内容。您正在查看的是邮件模拟数据，因为无法连接到服务器。',
        hasAttachments: false,
        attachmentsCount: 0,
        flags: ['\\Seen']
      };
      
      setSelectedEmail(mockDetail);
      message.warning('显示示例邮件详情');
    } finally {
      setEmailDetailLoading(false);
    }
  };
  
  /**
   * 邮箱账户变更处理
   */
  const handleAccountChange = (accountId: number) => {
    setSelectedAccountId(accountId);
    setSelectedEmail(null);
    
    if (accountId) {
      fetchEmails(accountId);
    } else {
      setEmails([]);
    }
  };
  
  /**
   * Tab切换处理
   */
  const handleTabChange = (key: string) => {
    setActiveTab(key);
    
    if (key === 'emails' && selectedAccountId) {
      fetchEmails(selectedAccountId);
    }
  };

  // 首次加载数据
  useEffect(() => {
    fetchEmailAccounts();
    return () => {
      // 清理测试计时器
      if (testTimerRef.current) {
        clearInterval(testTimerRef.current);
      }
    };
  }, []);

  // 表单提交处理
  const handleSubmit = async (values: any) => {
    if (testStatus === 'testing') {
      message.warning('请等待测试完成');
      return;
    }

    try {
      // 确保IMAP和SMTP配置都已填写
      if (!values.host_imap || !values.port_imap || !values.host_smtp || !values.port_smtp) {
        message.error('请完整填写IMAP和SMTP服务器配置');
        return;
      }

      // 转换前端表单数据到后端需要的格式
      // 1. 将snake_case转为camelCase
      // 2. 将布尔值转为数字(0/1)
      // 3. 映射状态值
      const statusMap: {[key: string]: string} = {
        'verified': 'active',
        'pending': 'pending', 
        'failed': 'disabled'
      };
      
      const camelCaseData: any = {
        name: values.name,
        email: values.email,
        username: values.username,
        password: values.password,
        imapHost: values.host_imap,
        imapPort: parseInt(values.port_imap), // 确保是数字
        imapSecure: values.secure_imap ? 1 : 0, // 布尔值转为0/1
        smtpHost: values.host_smtp,
        smtpPort: parseInt(values.port_smtp), // 确保是数字
        smtpSecure: values.secure_smtp ? 1 : 0, // 布尔值转为0/1
        isActive: values.is_active ? 1 : 0, // 布尔值转为0/1
        isDefault: values.is_default ? 1 : 0, // 布尔值转为0/1
        status: statusMap[values.status] || 'pending', // 映射状态值
        domainName: values.domain_name // 添加域名邮箱字段
      };
      
      // 如果是编辑现有邮箱，确保包含ID
      if (currentAccount && currentAccount.id) {
        camelCaseData.id = currentAccount.id;
      }
    
      console.log("提交的数据 (camelCase格式):", camelCaseData);

      if (currentAccount && currentAccount.id) {
        // 更新现有邮箱
        await api.put(`${apiBaseUrl}/api/email-accounts/${currentAccount.id}`, camelCaseData);
        message.success('邮箱账户更新成功');
        setModalVisible(false);
        fetchEmailAccounts();
      } else {
        // 创建新邮箱
        await api.post(`${apiBaseUrl}/api/email-accounts`, camelCaseData);
        message.success('邮箱账户创建成功');
        setModalVisible(false);
        fetchEmailAccounts();
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response) {
        console.error("提交错误:", axiosError.response.data);
        message.error(`提交失败: ${axiosError.response.status} - ${JSON.stringify(axiosError.response.data)}`);
      } else {
        message.error('提交失败: ' + axiosError.message);
      }
      console.error('提交失败:', error);
    }
  };

  // 测试邮箱配置
  const handleTestEmailConfig = async () => {
    try {
      setTestStatus('testing');
      setTestProgress(0);
      
      // 先验证表单并保存邮箱配置
      const values = await form.validateFields();
      console.log("测试邮箱配置, 表单数据:", values);
      
      // 确保IMAP和SMTP配置都已填写
      if (!values.host_imap || !values.port_imap || !values.host_smtp || !values.port_smtp) {
        message.error('请完整填写IMAP和SMTP服务器配置');
        setTestStatus('idle');
        return;
      }
      
      // 转换表单数据为驼峰命名 (snake_case -> camelCase)
      // 同时将布尔值转换为数字(0/1)
      const statusMap: {[key: string]: string} = {
        'verified': 'active',
        'pending': 'pending', 
        'failed': 'disabled'
      };

      const camelCaseValues = {
        name: values.name,
        email: values.email,
        username: values.username,
        password: values.password,
        imapHost: values.host_imap,
        imapPort: parseInt(values.port_imap), // 确保是数字
        imapSecure: values.secure_imap ? 1 : 0, // 布尔值转为0/1
        smtpHost: values.host_smtp,
        smtpPort: parseInt(values.port_smtp), // 确保是数字
        smtpSecure: values.secure_smtp ? 1 : 0, // 布尔值转为0/1
        isActive: 1, // 确保验证成功后账户处于激活状态 (1表示激活)
        isDefault: values.is_default ? 1 : 0, // 布尔值转为0/1
        status: 'pending', // 初始状态为pending
        domainName: values.domain_name // 添加域名邮箱字段
      };
      
      // 重要：记录发送给后端的确切数据
      console.log("发送给后端的数据:", JSON.stringify(camelCaseValues, null, 2));
      
      let accountId: number;
      
      // 对于新邮箱，必须先创建
      if (!currentAccount || !currentAccount.id) {
        message.loading("正在创建邮箱账户...");
        console.log("步骤1: 创建新邮箱账户");
        
        try {
          const createResponse = await api.post(
            `${apiBaseUrl}/api/email-accounts`,
            camelCaseValues,
            {
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );
          
          console.log("创建邮箱响应:", JSON.stringify(createResponse.data, null, 2));
          
          if (createResponse.data.success && createResponse.data.data && createResponse.data.data.id) {
            accountId = createResponse.data.data.id;
            message.success(`成功创建邮箱账户，ID: ${accountId}`);
            
            // 更新当前邮箱 - 确保映射正确的字段并包含所有必需字段
            const newAccount: EmailAccount = {
              id: accountId,
              name: values.name,
              email: values.email,
              password: values.password,
              imap_host: values.host_imap,
              imap_port: parseInt(values.port_imap),
              imap_secure: values.secure_imap ? 1 : 0,
              smtp_host: values.host_smtp,
              smtp_port: parseInt(values.port_smtp),
              smtp_secure: values.secure_smtp ? 1 : 0,
              is_default: values.is_default ? 1 : 0,
              status: 'pending',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              extra_config: null,
              // 前端专用字段
              username: values.username,
              secure_imap: values.secure_imap,
              host_smtp: values.host_smtp,
              port_smtp: values.port_smtp,
              secure_smtp: values.secure_smtp,
              is_active: values.is_active
            };
            
            setCurrentAccount(newAccount);
            
            // 立即刷新邮箱列表
            fetchEmailAccounts();
          } else {
            throw new Error("创建邮箱失败: " + JSON.stringify(createResponse.data));
          }
        } catch (err) {
          console.error("创建邮箱错误:", err);
          const axiosError = err as AxiosError;
          if (axiosError.response) {
            console.error("错误状态:", axiosError.response.status);
            console.error("错误数据:", JSON.stringify(axiosError.response.data, null, 2));
          }
          setTestStatus('failed');
          message.error("创建邮箱失败，无法进行测试");
          return; // 退出函数，不继续测试
        }
      } else {
        // 使用现有邮箱ID
        accountId = currentAccount.id;
        console.log(`使用现有邮箱ID: ${accountId}`);
      }
      
      // 确保有有效的accountId
      if (!accountId) {
        setTestStatus('failed');
        message.error("无法获取有效的邮箱ID");
        return;
      }
      
      // 步骤2: 使用正确的邮箱ID发送测试请求
      console.log(`步骤2: 发送测试请求 - /api/email-accounts/${accountId}/test`);
      message.loading("开始测试邮箱配置...");
      
      try {
        const testResponse = await api.post(`${apiBaseUrl}/api/email-accounts/${accountId}/test`);
        console.log("测试请求响应:", JSON.stringify(testResponse.data, null, 2));
        
        // 获取testId
        const testId = testResponse.data.data?.testId;
        if (!testId) {
          throw new Error("测试响应中缺少testId");
        }
        
        console.log(`获取到测试ID: ${testId}`);
        message.info("测试已开始，正在等待结果...");
        
        // 步骤3: 轮询测试结果
        console.log("步骤3: 开始轮询测试结果");
        let progress = 0;
        
        // 清除之前的计时器
        if (testTimerRef.current) {
          clearInterval(testTimerRef.current);
        }
        
        testTimerRef.current = setInterval(() => {
          // 进度条增长速度放缓，更加匹配后端的实际测试进度
          // 每次只增长1.67%，确保60秒才会到达100%
          progress += 1.67;
          setTestProgress(Math.min(Math.round(progress), 100));
          
          // 查询测试结果
          console.log(`轮询测试结果: ${apiBaseUrl}/api/email-accounts/test/${testId}`);
          
          api.get(`${apiBaseUrl}/api/email-accounts/test/${testId}`)
            .then((response: AxiosResponse) => {
              console.log("测试结果响应:", JSON.stringify(response.data, null, 2));
              
              const resultData = response.data.data;
              
              console.log("收到测试结果:", resultData);
              
              // 首先检查是否有结果数据
              if (resultData) {
                // 关键判断: 测试是否真正完成 (不是进行中状态)
                const isTestInProgress = resultData.message && 
                  (resultData.message.includes('测试进行中') || 
                   resultData.message.includes('开始测试') ||
                   resultData.message.includes('正在测试'));
                
                console.log("测试状态:", isTestInProgress ? "进行中" : (resultData.success ? "成功" : "失败"));
                
                if (resultData.success === true) {
                  // 测试成功 - 立即更新UI，停止轮询
                  clearInterval(testTimerRef.current as NodeJS.Timeout);
                  testTimerRef.current = null;
                  
                  // 强制设置进度为100%，表示测试已完成
                  setTestProgress(100);
                  setTestStatus('success');
                  
                  // 测试成功后，更新表单字段状态并保存更新
                  form.setFieldsValue({ 
                    status: 'verified',
                    is_active: true  // 确保账户处于激活状态
                  });
                  
                  // 如果是现有账户，将更改保存到服务器
                  if (currentAccount && currentAccount.id) {
                    // 构建更新数据 - 确保数据类型正确
                    const statusMap: {[key: string]: string} = {
                      'verified': 'active',
                      'pending': 'pending',
                      'failed': 'disabled'
                    };
                    
                    const updateValues = {
                      status: statusMap['verified'], // 'verified' -> 'active'
                      isActive: 1 // 布尔值转为数字(1)
                    };
                    
                    // 更新账户状态
                    api.put(`${apiBaseUrl}/api/email-accounts/${currentAccount.id}`, updateValues)
                      .then((response) => {
                        if (response.data.success) {
                          console.log("账户状态已更新为验证成功");
                        } else {
                          console.error("更新账户状态失败:", response.data.message);
                          message.error(`更新账户状态失败: ${response.data.message || '未知错误'}`);
                        }
                      })
                      .catch((e) => {
                        const axiosError = e as AxiosError;
                        let errorMsg = '更新账户状态失败';
                        
                        if (axiosError.response?.data) {
                          errorMsg += `: ${JSON.stringify(axiosError.response.data)}`;
                        } else if (axiosError.message) {
                          errorMsg += `: ${axiosError.message}`;
                        }
                        
                        console.error("更新账户状态失败:", errorMsg);
                        message.error(errorMsg);
                      });
                  }
                  
                  // 使用 Modal.success 替代普通消息，确保用户能看到结果
                  Modal.success({
                    title: '邮箱配置测试成功！',
                    content: '已成功发送和接收测试邮件，邮箱配置有效。',
                    okText: '关闭窗口',
                    cancelText: '继续编辑',
                    okCancel: true,
                    onOk: () => {
                      setModalVisible(false);
                      // 刷新邮箱列表
                      fetchEmailAccounts();
                    },
                    onCancel: () => {
                      // 刷新邮箱列表但保持模态框打开
                      fetchEmailAccounts();
                    }
                  });
                } else if (resultData.success === false && !isTestInProgress) {
                  // 测试确实失败 (不是进行中) - 停止轮询
                  clearInterval(testTimerRef.current as NodeJS.Timeout);
                  testTimerRef.current = null;
                  
                  setTestProgress(100);
                  setTestStatus('failed');
                  
                  const errorMessage = resultData.message || resultData.details?.sendError || 
                    resultData.details?.receiveError || '未知错误';
                  
                  // 使用 Modal.error 替代普通消息，确保用户能看到结果
                  Modal.error({
                    title: '邮箱配置测试失败',
                    content: '未能成功完成测试: ' + errorMessage
                  });
                  form.setFieldsValue({ status: 'failed' });
                } else {
                  // 测试进行中，继续轮询，更新状态信息
                  const statusMsg = resultData.message || "测试进行中...";
                  console.log("测试状态更新:", statusMsg);
                  
                  // 避免频繁弹出消息，大约每10%显示一次
                  if (progress % 10 < 1.67) { 
                    message.info(statusMsg, 1);
                  }
                }
              } else {
                // 没有结果数据，可能是API返回格式异常
                console.log("API返回格式异常，缺少data字段");
                // 不中断轮询，继续等待有效结果
              }
            })
            .catch((error: AxiosError) => {
              console.error('测试状态检查失败:', error);
              // 非致命错误，记录但不中断轮询
              // 避免因单次请求失败而影响整个测试过程
            });
            
          // 90秒超时 (比后端的60秒长，确保能收到后端的结果)
          if (progress >= 150) {
            if (testTimerRef.current) {
              clearInterval(testTimerRef.current);
              testTimerRef.current = null;
            }
            setTestStatus('failed');
            Modal.warning({
              title: '测试超时',
              content: '邮箱测试超时，请检查您的邮箱配置或网络连接。'
            });
            form.setFieldsValue({ status: 'failed' });
          }
        }, 2000);
      } catch (error) {
        console.error('发送测试请求失败:', error);
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          console.error("错误状态:", axiosError.response.status);
          console.error("错误数据:", JSON.stringify(axiosError.response.data, null, 2));
        }
        setTestStatus('failed');
        message.error('发送测试请求失败: ' + (axiosError.message || '未知错误'));
      }
    } catch (error) {
      console.error('测试邮箱配置失败:', error);
      setTestStatus('failed');
      message.error('邮箱测试失败: ' + (error instanceof Error ? error.message : '未知错误'));
      console.error('邮箱测试详细错误:', error);
    }
  };

  // 切换邮箱激活状态
  const toggleEmailActive = async (id: number, isActive: boolean) => {
    try {
      // 修改请求格式以符合后端API预期
      // API端点需要status字段，值为"active"或"disabled"
      await api.patch(`${apiBaseUrl}/api/email-accounts/${id}/status`, {
        status: isActive ? 'disabled' : 'active' 
      });
      message.success(isActive ? '邮箱已禁用' : '邮箱已启用');
      fetchEmailAccounts();
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorMessage = axiosError.response?.status === 400 ? 
        '操作失败: 请求格式错误' : '操作失败';
      message.error(errorMessage);
      console.error('切换邮箱状态失败:', error);
    }
  };

  // 设为默认邮箱
  const setAsDefault = async (id: number) => {
    try {
      await api.patch(`${apiBaseUrl}/api/email-accounts/${id}/default`);
      message.success('已设为默认邮箱');
      fetchEmailAccounts();
    } catch (error) {
      const axiosError = error as AxiosError;
      let errorMessage = '设置默认邮箱失败';
      
      if (axiosError.response) {
        if (axiosError.response.status === 404) {
          errorMessage = '邮箱账户不存在';
        } else if (axiosError.response.status === 400) {
          errorMessage = '禁用的邮箱不能设为默认';
        }
      }
      
      message.error(errorMessage);
      console.error('设置默认邮箱失败:', error);
    }
  };

  // 删除邮箱账户
  const deleteEmailAccount = async (id: number) => {
    // 添加调试日志，帮助排查问题
    console.log(`开始删除邮箱账户，ID: ${id}`);
    
    try {
      // 检查是否为默认邮箱，使用数字比较
      const account = emailAccounts.find(acc => acc.id === id);
      if (!account) {
        message.error('找不到该邮箱账户');
        console.error(`无法找到ID为${id}的邮箱账户`);
        return;
      }
      
      if (account.is_default === 1) {
        message.error('默认邮箱不能删除，请先设置其他邮箱为默认');
        console.log(`尝试删除默认邮箱被阻止，ID: ${id}`);
        return;
      }
      
      // 显示加载提示
      message.loading('正在删除邮箱账户...', 0.5);
      
      console.log(`发送删除请求，URL: ${apiBaseUrl}/api/email-accounts/${id}`);
      const response = await api.delete(`${apiBaseUrl}/api/email-accounts/${id}`);
      
      console.log('删除响应:', response.data);
      
      if (response.data && response.data.success) {
        message.success('邮箱账户已成功删除');
      } else {
        // API可能返回成功但实际操作失败
        const msg = response.data?.message || '删除操作未完成';
        message.warning(`删除结果: ${msg}`);
      }
      
      // 刷新列表
      fetchEmailAccounts();
    } catch (error) {
      const axiosError = error as AxiosError;
      let errorMessage = '删除邮箱账户失败';
      
      console.error('删除邮箱时发生错误:', error);
      
      // 处理特定错误情况
      if (axiosError.response) {
        console.error('错误响应状态:', axiosError.response.status);
        console.error('错误响应数据:', axiosError.response.data);
        
        if (axiosError.response.status === 400) {
          // 可能是尝试删除默认邮箱
          const responseData = axiosError.response.data as any;
          errorMessage = responseData.message || '删除邮箱账户失败，可能是默认邮箱';
        } else if (axiosError.response.status === 404) {
          errorMessage = '邮箱账户不存在或已被删除';
        } else if (axiosError.response.status === 403) {
          errorMessage = '没有权限删除此邮箱账户';
        } else {
          // 其他HTTP错误
          errorMessage = `服务器错误 (${axiosError.response.status}): ${JSON.stringify(axiosError.response.data)}`;
        }
      } else if (axiosError.request) {
        // 请求发送但未收到响应
        errorMessage = '服务器无响应，请检查网络连接';
      }
      
      message.error(errorMessage);
    }
  };

  // 打开编辑模态窗
  const openEditModal = (record?: EmailAccount) => {
    setTestStatus('idle');
    setTestProgress(0);
    
    if (record) {
      // 编辑现有邮箱
      setCurrentAccount(record);
      form.setFieldsValue(record);
    } else {
      // 新建邮箱
      setCurrentAccount(null);
      form.resetFields();
      // 设置默认值
      form.setFieldsValue({
        is_active: true,
        status: 'pending',
        host_imap: 'imap.gmail.com',
        port_imap: 993,
        secure_imap: true,
        host_smtp: 'smtp.gmail.com',
        port_smtp: 465,
        secure_smtp: true
      });
    }
    
    setModalVisible(true);
  };

  // 前端和后端状态值的映射
  const getStatusDisplay = (status: string) => {
    switch(status) {
      case 'active':
        return { color: 'green', text: '验证成功' };
      case 'pending':
        return { color: 'orange', text: '待验证' };
      case 'disabled':
      case 'failed':
        return { color: 'red', text: '验证失败' };
      default:
        return { color: 'default', text: '未知状态' };
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: true,
      render: (text: string, record: EmailAccount) => (
        <Space>
          {record.is_default === 1 && (
            <Tag color="blue">默认</Tag>
          )}
          {text}
        </Space>
      ),
    },
    {
      title: '邮箱地址',
      dataIndex: 'email',
      key: 'email',
      width: 180,
      ellipsis: true,
    },
    {
      title: '密码',
      dataIndex: 'password',
      key: 'password',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'IMAP服务器',
      dataIndex: 'imap_host',
      key: 'imap_host',
      width: 150,
      ellipsis: true,
      render: (host: string, record: EmailAccount) => {
        if (!host || !record.imap_port) return '未配置';
        return `${host}:${record.imap_port}`;
      },
    },
    {
      title: 'SMTP服务器',
      dataIndex: 'smtp_host',
      key: 'smtp_host',
      width: 150,
      ellipsis: true,
      render: (host: string, record: EmailAccount) => {
        if (!host || !record.smtp_port) return '未配置';
        return `${host}:${record.smtp_port}`;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const { color, text } = getStatusDisplay(status);
        return <Tag color={color}>{text}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right' as const,
      render: (_: any, record: EmailAccount) => (
        <Space size="small">
          <Button 
            type="text" 
            icon={<EditOutlined />} 
            onClick={() => openEditModal(record)}
          />
          
          {record.is_default !== 1 && (
            <Tooltip title="设为默认">
              <Button 
                type="text" 
                icon={<CheckCircleOutlined />} 
                style={{ color: '#1890ff' }}
                onClick={() => setAsDefault(record.id)}
              />
            </Tooltip>
          )}
          
          <Tooltip title={record.status === 'active' ? "禁用" : "启用"}>
            <Button 
              type="text" 
              icon={record.status === 'active' ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />} 
              style={{ 
                color: record.status === 'active' ? '#faad14' : '#52c41a'
              }}
              onClick={() => toggleEmailActive(record.id, record.status === 'active')}
            />
          </Tooltip>
          
          {/* 删除按钮 - 对所有账户显示，但默认账户会有提示 */}
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />}
            onClick={() => {
              console.log(`准备删除邮箱账户，ID: ${record.id}, 是否默认: ${record.is_default === 1 ? '是' : '否'}`);
              
              // 对于默认邮箱，显示错误提示而不是确认对话框
              if (record.is_default === 1) {
                message.error('默认邮箱不能删除，请先设置其他邮箱为默认');
                return;
              }
              
              Modal.confirm({
                title: '确认删除',
                icon: <ExclamationCircleOutlined />,
                content: '确定要删除这个邮箱账户吗?',
                okText: '确定',
                cancelText: '取消',
                onOk: () => {
                  console.log(`用户确认删除，准备调用删除函数`);
                  // 直接调用函数，不使用async/await，避免Promise处理错误
                  deleteEmailAccount(record.id);
                }
              });
            }}
          />
        </Space>
      ),
    },
  ];

  // 帮助内容组件
  const HelpContent = () => (
    <HelpPanel>
      <HelpTitle level={4}>Gmail邮箱配置帮助</HelpTitle>
      
      <Alert
        message="配置前准备"
        description="使用Gmail邮箱需要开启IMAP访问并创建应用专用密码"
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
      />
      
      <HelpSection>
        <Title level={5}>步骤1: 开启IMAP访问</Title>
        <Paragraph>
          1. 登录您的Gmail账户<br/>
          2. 点击右上角的设置图标，选择"查看所有设置"<br/>
          3. 切换到"转发和POP/IMAP"选项卡<br/>
          4. 在"IMAP访问"部分，选择"启用IMAP"<br/>
          5. 点击页面底部的"保存更改"按钮
        </Paragraph>
      </HelpSection>
      
      <HelpSection>
        <Title level={5}>步骤2: 创建应用专用密码</Title>
        <Paragraph>
          1. 访问您的Google账户安全设置: <a href="https://myaccount.google.com/security" target="_blank">https://myaccount.google.com/security</a><br/>
          2. 在"登录Google"部分，确认您已启用两步验证<br/>
          3. 点击"应用专用密码"<br/>
          4. 选择应用名称如"InfiniManager"并点击"创建"<br/>
          5. 复制生成的16位密码，这将用作您的邮箱密码
        </Paragraph>
      </HelpSection>
      
      <HelpSection>
        <Title level={5}>Gmail服务器信息</Title>
        <Paragraph>
          <strong>IMAP服务器:</strong> imap.gmail.com<br/>
          <strong>IMAP端口:</strong> 993<br/>
          <strong>IMAP安全连接:</strong> 是 (SSL/TLS)<br/>
          <br/>
          <strong>SMTP服务器:</strong> smtp.gmail.com<br/>
          <strong>SMTP端口:</strong> 465<br/>
          <strong>SMTP安全连接:</strong> 是 (SSL/TLS)
        </Paragraph>
      </HelpSection>
      
      <Divider />
      
      <HelpSection>
        <Title level={5}>测试过程说明</Title>
        <Paragraph>
          点击"测试"按钮后，系统将：<br/>
          1. 使用您提供的配置发送一封测试邮件到您自己的邮箱<br/>
          2. 尝试通过IMAP连接查找并接收这封测试邮件<br/>
          3. 如果60秒内成功接收到测试邮件，则验证成功<br/>
          4. 如未成功，请检查您的配置和网络连接
        </Paragraph>
      </HelpSection>
    </HelpPanel>
  );

  return (
    <div>
      <Tabs 
        activeKey={activeTab} 
        onChange={handleTabChange}
        tabBarExtraContent={
          <Space>
            <Button
              onClick={handleRefresh}
              icon={<InfoCircleOutlined />}
            >
              刷新
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={() => openEditModal()}
            >
              新增主邮箱
            </Button>
          </Space>
        }
      >
        <TabPane tab="邮箱账户" key="accounts">
          <StyledCard
            title="邮箱账户列表"
            bordered={false}
          >
            {apiError && (
              <Alert
                message="连接服务器失败"
                description={
                  <div>
                    <p>{apiError}</p>
                    <p>显示的是模拟数据，仅用于演示界面。实际操作将在服务器可用时生效。</p>
                    <Button type="primary" size="small" onClick={handleRefresh}>重试连接</Button>
                  </div>
                }
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            
            <TableContainer>
              <Table
                columns={columns}
                dataSource={emailAccounts}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
                scroll={{ x: 1200 }}
                locale={{
                  emptyText: apiError ? (
                    <div>
                      <p>无法连接到服务器，显示的是模拟数据</p>
                      <Button type="primary" size="small" onClick={handleRefresh}>重试连接</Button>
                    </div>
                  ) : '暂无数据'
                }}
              />
            </TableContainer>
          </StyledCard>
        </TabPane>
        
        <TabPane tab="邮件列表" key="emails">
          <Row gutter={16}>
            <Col span={24}>
              <StyledCard
                title="邮件列表"
                extra={
                  <Space>
                    <Select
                      value={selectedAccountId}
                      onChange={handleAccountChange}
                      style={{ width: 250 }}
                      placeholder="选择邮箱账户"
                      disabled={emailLoading}
                    >
                      {emailAccounts
                        .filter(account => account.status === 'active')
                        .map(account => (
                          <Option key={account.id} value={account.id}>
                            {account.name} ({account.email})
                            {account.is_default === 1 && " (默认)"}
                          </Option>
                        ))
                      }
                    </Select>
                    
                    <Select
                      value={mailbox}
                      onChange={(value) => {
                        setMailbox(value);
                        if (selectedAccountId) fetchEmails(selectedAccountId);
                      }}
                      style={{ width: 150 }}
                      disabled={emailLoading || !selectedAccountId}
                    >
                      <Option value="INBOX">收件箱</Option>
                      <Option value="Sent">已发送</Option>
                      <Option value="Drafts">草稿箱</Option>
                      <Option value="Trash">垃圾箱</Option>
                    </Select>
                    
                    <Button
                      icon={<InfoCircleOutlined />}
                      onClick={() => selectedAccountId && fetchEmails(selectedAccountId)}
                      disabled={emailLoading || !selectedAccountId}
                    >
                      刷新
                    </Button>
                  </Space>
                }
              >
                {emailError && (
                  <Alert
                    message="获取邮件列表失败"
                    description={
                      <div>
                        <p>{emailError}</p>
                        <p>显示的是模拟数据，仅用于演示界面。</p>
                        <Button 
                          type="primary" 
                          size="small" 
                          onClick={() => selectedAccountId && fetchEmails(selectedAccountId)}
                        >
                          重试
                        </Button>
                      </div>
                    }
                    type="warning"
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                )}
                
                {!selectedAccountId && (
                  <Alert
                    message="请选择邮箱账户"
                    description="请在上方选择一个已激活的邮箱账户来查看邮件列表。"
                    type="info"
                    showIcon
                  />
                )}
                
                <Table
                  dataSource={emails}
                  rowKey="uid"
                  loading={emailLoading}
                  pagination={emailPagination}
                  onChange={(pagination) => {
                    setEmailPagination({
                      current: pagination.current || 1,
                      pageSize: pagination.pageSize || 10
                    });
                  }}
                  onRow={(record) => ({
                    onClick: () => {
                      if (selectedAccountId) {
                        fetchEmailDetail(selectedAccountId, record.uid);
                      }
                    },
                    style: { cursor: 'pointer' }
                  })}
                  columns={[
                    {
                      title: '状态',
                      key: 'status',
                      width: 80,
                      render: (_, record) => (
                        <Space>
                          {record.hasAttachments && (
                            <Tooltip title="含附件">
                              <PaperClipOutlined />
                            </Tooltip>
                          )}
                          {record.flags && !record.flags.includes('\\Seen') && (
                            <Badge status="processing" />
                          )}
                        </Space>
                      )
                    },
                    {
                      title: '发件人',
                      dataIndex: 'from',
                      key: 'from',
                      width: 200,
                      ellipsis: true,
                    },
                    {
                      title: '主题',
                      dataIndex: 'subject',
                      key: 'subject',
                      ellipsis: true,
                      render: (text, record) => (
                        <div>
                          <div>{text || '(无主题)'}</div>
                          <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                            {record.snippet}
                          </div>
                        </div>
                      )
                    },
                    {
                      title: '日期',
                      dataIndex: 'date',
                      key: 'date',
                      width: 150,
                      render: (date) => date ? new Date(date).toLocaleString() : '-'
                    }
                  ]}
                  locale={{
                    emptyText: emailLoading 
                      ? '加载中...' 
                      : selectedAccountId 
                        ? '没有邮件' 
                        : '请选择邮箱账户'
                  }}
                />
              </StyledCard>
            </Col>
          </Row>
          
          {selectedEmail && (
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={24}>
                <StyledCard
                  title={
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '16px' }}>
                        {selectedEmail.subject || '(无主题)'}
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '14px' }}>
                        <Space>
                          <span>发件人: {selectedEmail.from}</span>
                          <span>收件人: {selectedEmail.to}</span>
                          {selectedEmail.date && (
                            <span>日期: {new Date(selectedEmail.date).toLocaleString()}</span>
                          )}
                        </Space>
                      </div>
                    </div>
                  }
                  extra={
                    <Button
                      icon={<CloseOutlined />}
                      onClick={() => setSelectedEmail(null)}
                    >
                      关闭
                    </Button>
                  }
                >
                  <Spin spinning={emailDetailLoading}>
                    {selectedEmail.hasAttachments && selectedEmail.attachmentsCount && selectedEmail.attachmentsCount > 0 && (
                      <div style={{ marginBottom: '16px', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                        <PaperClipOutlined /> 包含 {selectedEmail.attachmentsCount} 个附件
                      </div>
                    )}
                    
                    <div style={{ padding: '16px', background: '#fff', border: '1px solid #f0f0f0', borderRadius: '4px' }}>
                      {selectedEmail.html ? (
                        <iframe 
                          srcDoc={selectedEmail.html} 
                          style={{ width: '100%', height: '500px', border: 'none' }}
                          title="邮件内容"
                        />
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>
                          {selectedEmail.text || '(无内容)'}
                        </div>
                      )}
                    </div>
                  </Spin>
                </StyledCard>
              </Col>
            </Row>
          )}
        </TabPane>
      </Tabs>

      {/* 邮箱编辑模态窗 */}
      <Modal
        title={currentAccount ? '编辑邮箱账户' : '新增主邮箱'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={1000}
        destroyOnClose
      >
        <Row gutter={24}>
          {/* 左侧表单 */}
          <Col span={14}>
            <FormContainer>
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                initialValues={{
                  is_active: true,
                  status: 'pending'
                }}
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="name"
                      label="邮箱名称"
                      rules={[{ required: true, message: '请输入邮箱名称' }]}
                    >
                      <Input placeholder="例如: 公司主邮箱" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="email"
                      label="邮箱地址"
                      rules={[
                        { required: true, message: '请输入邮箱地址' },
                        { type: 'email', message: '请输入有效的邮箱地址' }
                      ]}
                    >
                      <Input placeholder="例如: example@gmail.com" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="username"
                      label="用户名"
                      rules={[{ required: true, message: '请输入用户名' }]}
                    >
                      <Input placeholder="通常与邮箱地址相同" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      name="password"
                      label="密码/应用专用密码"
                      rules={[{ required: true, message: '请输入密码' }]}
                      tooltip="对于Gmail，请使用应用专用密码"
                    >
                      <Input.Password placeholder="输入邮箱密码或应用专用密码" />
                    </Form.Item>
                  </Col>
                </Row>
                
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item
                      name="domain_name"
                      label="域名邮箱"
                      tooltip="域名邮箱是指用你自己的域名作后缀的邮箱（如 admin@nncuu.com），通常会借助于类似于Cloudflare、Google Workspace等邮箱服务提供商。
                      这里特指将特定域名下的所有邮箱都绑定到同一个邮箱,通过一个邮箱来管理所有邮箱。"
                    >
                      <Input placeholder="例如: gmail.com, outlook.com（不填则自动从邮箱提取）" />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider orientation="left">代理配置 (网络连接)</Divider>
                
                <Row gutter={16}>
                  <Col span={6}>
                    <Form.Item
                      name="useProxy"
                      label="使用代理"
                      valuePropName="checked"
                    >
                      <Switch checkedChildren="是" unCheckedChildren="否" />
                    </Form.Item>
                  </Col>
                  <Col span={18}>
                    <Form.Item
                      name="proxyMode"
                      label="代理模式"
                      dependencies={['useProxy']}
                    >
                      <Select placeholder="选择代理模式" disabled={!form.getFieldValue('useProxy')}>
                        <Option value="direct">直接连接</Option>
                        <Option value="specified">指定代理</Option>
                        <Option value="random">标签随机</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
                
                <Form.Item
                  noStyle
                  shouldUpdate={(prevValues, currentValues) => 
                    prevValues.useProxy !== currentValues.useProxy || 
                    prevValues.proxyMode !== currentValues.proxyMode
                  }
                >
                  {({ getFieldValue }) => {
                    const useProxy = getFieldValue('useProxy');
                    const proxyMode = getFieldValue('proxyMode');
                    
                    if (!useProxy) return null;
                    
                    if (proxyMode === 'specified') {
                      return (
                        <Row gutter={16}>
                          <Col span={24}>
                            <Form.Item
                              name="proxyServerId"
                              label="选择代理服务器"
                            >
                              <Select 
                                placeholder="选择代理服务器"
                                loading={loading}
                                showSearch
                                filterOption={(input, option) => {
                                  const childText = option?.children ? String(option.children) : '';
                                  return childText.toLowerCase().indexOf(input.toLowerCase()) >= 0;
                                }}
                              >
                                {/* 这里需要获取代理服务器列表 */}
                                {proxyServers.length === 0 ? (
                                  <Option value={0} disabled>暂无可用代理服务器</Option>
                                ) : (
                                  proxyServers.map(server => (
                                    <Option key={server.id} value={server.id}>
                                      {server.host}:{server.port} - {server.description || '无描述'}
                                    </Option>
                                  ))
                                )}
                              </Select>
                            </Form.Item>
                          </Col>
                        </Row>
                      );
                    } else if (proxyMode === 'random') {
                      return (
                        <Row gutter={16}>
                          <Col span={24}>
                            <Form.Item
                              name="proxyTag"
                              label="选择代理标签"
                            >
                              <Select 
                                placeholder="选择代理标签"
                                loading={loading}
                                showSearch
                                filterOption={(input, option) =>
                                  option?.children?.toLowerCase().indexOf(input.toLowerCase()) >= 0
                                }
                              >
                                {/* 这里需要获取代理标签列表，暂时留空 */}
                                <Option value={0}>加载中...</Option>
                              </Select>
                            </Form.Item>
                          </Col>
                        </Row>
                      );
                    } else if (proxyMode === 'direct') {
                      return (
                        <Alert
                          message="直接连接模式"
                          description="邮箱将直接连接到邮件服务器，不使用代理。"
                          type="info"
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                      );
                    }
                    
                    return null;
                  }}
                </Form.Item>
                
                <Divider orientation="left">IMAP配置 (接收邮件)</Divider>
                
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="host_imap"
                      label="IMAP服务器"
                      rules={[{ required: true, message: '请输入IMAP服务器地址' }]}
                    >
                      <Input placeholder="例如: imap.gmail.com" />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name="port_imap"
                      label="IMAP端口"
                      rules={[{ required: true, message: '请输入IMAP端口' }]}
                    >
                      <Input type="number" placeholder="例如: 993" />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name="secure_imap"
                      label="安全连接"
                      valuePropName="checked"
                    >
                      <Switch checkedChildren="是" unCheckedChildren="否" />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider orientation="left">SMTP配置 (发送邮件)</Divider>
                
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="host_smtp"
                      label="SMTP服务器"
                      rules={[{ required: true, message: '请输入SMTP服务器地址' }]}
                    >
                      <Input placeholder="例如: smtp.gmail.com" />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name="port_smtp"
                      label="SMTP端口"
                      rules={[{ required: true, message: '请输入SMTP端口' }]}
                    >
                      <Input type="number" placeholder="例如: 465" />
                    </Form.Item>
                  </Col>
                  <Col span={6}>
                    <Form.Item
                      name="secure_smtp"
                      label="安全连接"
                      valuePropName="checked"
                    >
                      <Switch checkedChildren="是" unCheckedChildren="否" />
                    </Form.Item>
                  </Col>
                </Row>

                <Divider />

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      name="is_active"
                      label="启用状态"
                      valuePropName="checked"
                    >
                      <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="is_default"
                      label="设为默认"
                      valuePropName="checked"
                    >
                      <Switch checkedChildren="是" unCheckedChildren="否" />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="status"
                      label="验证状态"
                      hidden
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit">
                      仅保存
                    </Button>
                    
                    <TestButton 
                      type={testStatus === 'success' ? "primary" : "default"}
                      icon={testStatus === 'failed' ? <SendOutlined /> : (testStatus === 'success' ? <CheckCircleOutlined /> : <SendOutlined />)} 
                      onClick={
                        testStatus === 'success' 
                          ? () => setModalVisible(false) 
                          : handleTestEmailConfig
                      }
                      loading={testStatus === 'testing'}
                      disabled={testStatus === 'testing'}
                    >
                      {testStatus === 'success' 
                        ? '关闭' 
                        : (testStatus === 'failed' 
                            ? '重新测试' 
                            : '保存并测试'
                          )
                      }
                    </TestButton>
                    
                    <Button onClick={() => setModalVisible(false)}>
                      取消
                    </Button>
                  </Space>
                </Form.Item>
                
                {testStatus === 'testing' && (
                  <Alert
                    message={
                      <Space>
                        <Spin />
                        <span>正在测试邮箱配置... {testProgress}%</span>
                        <Text type="secondary">
                          <ClockCircleOutlined /> 最多需要60秒
                        </Text>
                      </Space>
                    }
                    type="warning"
                    showIcon={false}
                  />
                )}
                
                {testStatus === 'success' && (
                  <Alert
                    message="邮箱配置测试成功!"
                    description="已成功发送和接收测试邮件，邮箱配置有效。"
                    type="success"
                    showIcon
                  />
                )}
                
                {testStatus === 'failed' && (
                  <Alert
                    message="邮箱配置测试失败"
                    description="未能成功完成测试，请检查您的邮箱配置和网络连接。"
                    type="error"
                    showIcon
                  />
                )}
              </Form>
            </FormContainer>
          </Col>
          
          {/* 右侧帮助说明 */}
          <Col span={10}>
            <HelpContent />
          </Col>
        </Row>
      </Modal>
    </div>
  );
};

export default EmailManage;