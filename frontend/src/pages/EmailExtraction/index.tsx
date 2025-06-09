/**
 * 邮件取件页面
 * 用于使用取件模板从邮件中提取内容
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Form,
  Input,
  Select,
  message,
  Typography,
  Badge,
  Drawer,
  Spin,
  Tag,
  DatePicker,
  Divider,
  Empty,
  Alert,
  Tabs,
  List,
  Tooltip,
  Collapse,
  Dropdown,
  Modal
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  ExperimentOutlined,
  MailOutlined,
  PlusOutlined,
  CodeOutlined,
  CopyOutlined,
  EyeOutlined,
  DownloadOutlined,
  MoreOutlined,
  DownOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import api, { apiBaseUrl } from '../../services/api';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { RangePickerProps } from 'antd/es/date-picker';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { RangePicker } = DatePicker;
const { Panel } = Collapse;

// 样式组件
const StyledCard = styled(Card)`
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
  overflow: hidden;
`;

const SearchContainer = styled.div`
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
`;

const ActionContainer = styled.div`
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 16px;
`;

const ExtractionResult = styled.div`
  margin-top: 16px;
  padding: 16px;
  background-color: #f9f9f9;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
`;

const CodeItem = styled.div`
  padding: 12px;
  background-color: #f5f5f5;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  font-family: monospace;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CodeValue = styled.span`
  flex: 1;
  word-break: break-all;
`;

const CopyButton = styled(Button)`
  margin-left: 8px;
`;

const SearchForm = styled(Form)`
  padding: 16px;
`;

const MailContent = styled.div`
  max-height: 400px;
  overflow: auto;
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background-color: #ffffff;
  margin-top: 16px;
`;

// 取件模板接口
interface ExtractionTemplate {
  id: number;
  name: string;
  extractionType: 'regex' | 'javascript';
  dataSource: string;
  config: string;
  createdAt: string;
  updatedAt: string;
}

// 邮箱账户接口
interface EmailAccount {
  id: number;
  name: string;
  email: string;
  status: string;
}

// 邮件接口
interface EmailMessage {
  id: number;
  messageId: string;
  uid: number;
  fromAddress: string;
  fromName: string;
  toAddress: string;
  subject: string;
  date: string;
  status: string;
  hasAttachments: boolean;
  attachmentsCount: number;
  snippet: string;
  mailbox: string;
  code?: string; // 取件结果
  createdAt: string;
  updatedAt: string;
  content?: {
    text: string;
    html: string;
    headers: any[];
  };
}

// 邮箱文件夹接口
interface Mailbox {
  name: string;
  displayName: string;
}

/**
 * 邮件取件页面组件
 */
const EmailExtraction: React.FC = () => {
  const navigate = useNavigate();
  
  // 状态定义
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<ExtractionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [extractionLoading, setExtractionLoading] = useState<boolean>(false);
  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [selectedMailbox, setSelectedMailbox] = useState<string>('INBOX');
  const [searchDrawerVisible, setSearchDrawerVisible] = useState<boolean>(false);
  const [searchForm] = Form.useForm();
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [codes, setCodes] = useState<string[]>([]);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState<boolean>(false);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [viewMode, setViewMode] = useState<'rendered' | 'text' | 'raw'>('rendered');
  const [extractionAmount, setExtractionAmount] = useState<number>(20); // 默认提取20封邮件
  
  // 自定义分隔符相关状态
  const [customDelimiterModalVisible, setCustomDelimiterModalVisible] = useState<boolean>(false);
  const [customDelimiter, setCustomDelimiter] = useState<string>('|'); // 默认分隔符为|
  const [customDelimiterForm] = Form.useForm();
  
  // 获取邮箱账户列表
  const fetchEmailAccounts = useCallback(async () => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/email-accounts`);
      if (response.data.success) {
        setEmailAccounts(response.data.data);
        
        // 如果有默认邮箱，自动选中
        const defaultAccount = response.data.data.find((acc: any) => acc.isDefault);
        if (defaultAccount && defaultAccount.id) {
          setSelectedAccountId(defaultAccount.id);
        } else if (response.data.data.length > 0) {
          setSelectedAccountId(response.data.data[0].id);
        }
      } else {
        message.error('获取邮箱账户失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('获取邮箱账户失败:', error);
      message.error('获取邮箱账户列表失败');
    }
  }, []);
  
  // 获取取件模板列表
  const fetchTemplates = useCallback(async () => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/email-extractions`);
      if (response.data.success) {
        setTemplates(response.data.data.templates);
      } else {
        message.error('获取取件模板列表失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('获取取件模板列表失败:', error);
      message.error('获取取件模板列表失败');
    }
  }, []);
  
  // 获取邮箱文件夹列表
  const fetchMailboxes = useCallback(async (accountId: number) => {
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
  
  // 初始化加载
  useEffect(() => {
    fetchEmailAccounts();
    fetchTemplates();
  }, [fetchEmailAccounts, fetchTemplates]);
  
  // 账户变更时加载文件夹
  useEffect(() => {
    if (selectedAccountId) {
      fetchMailboxes(selectedAccountId);
    }
  }, [selectedAccountId, fetchMailboxes]);
  
  // 获取邮件详情
  const fetchEmailDetail = useCallback(async (emailId: number) => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/emails/${emailId}`);
      
      if (response.data.success) {
        setSelectedEmail(response.data.data);
        setDetailDrawerVisible(true);
      } else {
        message.error('获取邮件详情失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('获取邮件详情失败:', error);
      message.error('获取邮件详情失败');
    }
  }, []);
  
  // 执行邮件取件
  const handleExtraction = useCallback(async () => {
    if (!selectedAccountId) {
      message.warning('请选择邮箱账户');
      return;
    }
    
    if (!selectedTemplateId) {
      message.warning('请选择取件模板');
      return;
    }
    
    setExtractionLoading(true);
    
    try {
      // 获取搜索条件
      const searchParams = searchForm.getFieldsValue();
      
      // 处理日期范围
      let startDate: string | null = null;
      let endDate: string | null = null;
      if (searchParams.dateRange && searchParams.dateRange.length === 2) {
        startDate = searchParams.dateRange[0].format('YYYY-MM-DD');
        endDate = searchParams.dateRange[1].format('YYYY-MM-DD');
      }
      
      const requestData = {
        templateId: selectedTemplateId,
        accountId: selectedAccountId,
        mailbox: selectedMailbox,
        keyword: searchParams.keyword,
        subject: searchParams.subject,
        fromAddress: searchParams.fromAddress,
        startDate,
        endDate,
        pageSize: extractionAmount // 添加提取数量参数
      };
      
      const response = await api.post(`${apiBaseUrl}/api/email-extractions/extract`, requestData);
      
      if (response.data.success) {
        setEmails(response.data.data.emails);
        setCodes(response.data.data.codes);
        message.success('邮件取件成功');
      } else {
        message.error('邮件取件失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('邮件取件失败:', error);
      message.error('邮件取件失败');
    } finally {
      setExtractionLoading(false);
    }
  }, [selectedAccountId, selectedTemplateId, selectedMailbox, searchForm, extractionAmount]);
  
  // 复制内容到剪贴板
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        message.success('已复制到剪贴板');
      },
      () => {
        message.error('复制失败');
      }
    );
  };
  
  // 复制CSV格式的取件码
  const copyAsCSV = () => {
    if (codes.length === 0) return;
    
    // 生成CSV格式（简单处理，没有处理特殊字符）
    const csvContent = codes.join('\n');
    copyToClipboard(csvContent);
    message.success('已复制CSV格式的取件码');
  };
  
  // 打开自定义分隔符对话框
  const openCustomDelimiterModal = () => {
    setCustomDelimiterModalVisible(true);
    customDelimiterForm.setFieldsValue({ delimiter: customDelimiter });
  };
  
  // 使用自定义分隔符复制取件码
  const copyWithCustomDelimiter = () => {
    if (codes.length === 0) return;
    
    customDelimiterForm.validateFields().then(values => {
      const delimiter = values.delimiter || '|';
      setCustomDelimiter(delimiter);
      
      const content = codes.join(delimiter);
      copyToClipboard(content);
      message.success(`已使用 "${delimiter}" 分隔符复制取件码`);
      setCustomDelimiterModalVisible(false);
    });
  };
  
  // 复制JSON数组格式的取件码
  const copyAsJSON = () => {
    if (codes.length === 0) return;
    
    const jsonContent = JSON.stringify(codes, null, 2);
    copyToClipboard(jsonContent);
    message.success('已复制JSON数组格式的取件码');
  };
  
  // 创建新模板
  const handleCreateTemplate = () => {
    navigate('/email-extraction-template');
  };
  
  // 表格列定义
  const columns: ColumnsType<EmailMessage> = [
    {
      title: '状态',
      key: 'status',
      width: 80,
      render: (_: any, record: EmailMessage) => (
        <Space>
          {record.hasAttachments && (
            <Tooltip title="含附件">
              <Badge status="processing" />
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
    },
    {
      title: '取件结果',
      key: 'code',
      dataIndex: 'code',
      render: (code: string) => (
        <div style={{ fontFamily: 'monospace', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {code || <Text type="secondary">(无匹配)</Text>}
        </div>
      ),
    },
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 170,
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: EmailMessage) => (
        <Space size="small">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => fetchEmailDetail(record.id)}
          />
          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={() => record.code && copyToClipboard(record.code)}
            disabled={!record.code}
          />
        </Space>
      )
    }
  ];
  
  return (
    <div>
      <StyledCard
        title="邮件取件"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateTemplate}
          >
            创建取件模板
          </Button>
        }
      >
        <Paragraph>
          邮件取件功能允许您使用预定义的模板从邮件内容中提取特定信息。
          选择邮箱账户和取件模板，然后点击"执行取件"按钮开始提取。
        </Paragraph>
        
        <SearchContainer>
          <Select
            placeholder="选择邮箱账户"
            style={{ width: 240 }}
            value={selectedAccountId}
            onChange={setSelectedAccountId}
          >
            {emailAccounts.map(account => (
              <Option key={account.id} value={account.id}>
                {account.name} ({account.email})
              </Option>
            ))}
          </Select>
          
          <Select
            placeholder="选择邮箱文件夹"
            style={{ width: 140 }}
            value={selectedMailbox}
            onChange={setSelectedMailbox}
          >
            {mailboxes.map(mailbox => (
              <Option key={mailbox.name} value={mailbox.name}>
                {mailbox.displayName}
              </Option>
            ))}
          </Select>
          
          <Select
            placeholder="选择取件模板"
            style={{ width: 240 }}
            value={selectedTemplateId}
            onChange={setSelectedTemplateId}
          >
            {templates.map(template => (
              <Option key={template.id} value={template.id}>
                {template.name} ({template.extractionType === 'regex' ? '正则' : 'JS'})
              </Option>
            ))}
          </Select>
          
          <Select
            placeholder="提取数量"
            style={{ width: 140 }}
            value={extractionAmount}
            onChange={setExtractionAmount}
          >
            <Option value={20}>提取20封</Option>
            <Option value={50}>提取50封</Option>
            <Option value={100}>提取100封</Option>
            <Option value={-1}>提取全部</Option>
          </Select>
          
          <Button
            icon={<FilterOutlined />}
            onClick={() => setSearchDrawerVisible(true)}
          >
            高级筛选
          </Button>
        </SearchContainer>
        
        <ActionContainer>
          <Button
            type="primary"
            icon={<ExperimentOutlined />}
            onClick={handleExtraction}
            loading={extractionLoading}
            disabled={!selectedAccountId || !selectedTemplateId}
          >
            执行取件
          </Button>
        </ActionContainer>
        
        {codes.length > 0 && (
          <ExtractionResult>
            <Title level={4}>取件结果</Title>
            <Paragraph>
              已从{emails.length}封邮件中提取到{codes.length}个唯一结果:
            </Paragraph>
            <List
              bordered
              dataSource={codes}
              renderItem={code => (
                <List.Item>
                  <CodeItem>
                    <CodeValue>{code}</CodeValue>
                    <CopyButton
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(code)}
                      size="small"
                    />
                  </CodeItem>
                </List.Item>
              )}
            />
            <Divider />
          </ExtractionResult>
        )}
        
        <Spin spinning={loading || extractionLoading}>
          {emails.length > 0 ? (
            <Table
              columns={columns}
              dataSource={emails}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          ) : (
            <Empty
              description={
                extractionLoading ? "正在执行取件..." : "尚未执行取件或无匹配结果"
              }
            />
          )}
        </Spin>
      </StyledCard>
      
      {/* 高级搜索抽屉 */}
      <Drawer
        title="高级搜索"
        placement="right"
        width={400}
        onClose={() => setSearchDrawerVisible(false)}
        open={searchDrawerVisible}
        footer={
          <Space>
            <Button onClick={() => searchForm.resetFields()}>重置</Button>
            <Button
              type="primary"
              onClick={() => setSearchDrawerVisible(false)}
            >
              确定
            </Button>
          </Space>
        }
      >
        <SearchForm form={searchForm} layout="vertical">
          <Form.Item name="keyword" label="关键词">
            <Input placeholder="搜索邮件内容..." />
          </Form.Item>
          
          <Form.Item name="subject" label="主题">
            <Input placeholder="邮件主题..." />
          </Form.Item>
          
          <Form.Item name="fromAddress" label="发件人">
            <Input placeholder="发件人邮箱..." />
          </Form.Item>
          
          <Form.Item name="dateRange" label="日期范围">
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
        </SearchForm>
      </Drawer>
      
      {/* 邮件详情抽屉 */}
      <Drawer
        title="邮件详情"
        placement="right"
        width={800}
        onClose={() => setDetailDrawerVisible(false)}
        open={detailDrawerVisible}
      >
        <Spin spinning={!selectedEmail}>
          {selectedEmail && (
            <>
              <Divider orientation="left">邮件信息</Divider>
              <Collapse defaultActiveKey={['1']}>
                <Panel header="基本信息" key="1">
                  <p><strong>主题:</strong> {selectedEmail.subject}</p>
                  <p><strong>发件人:</strong> {selectedEmail.fromName ? `${selectedEmail.fromName} <${selectedEmail.fromAddress}>` : selectedEmail.fromAddress}</p>
                  <p><strong>收件人:</strong> {selectedEmail.toAddress}</p>
                  <p><strong>日期:</strong> {dayjs(selectedEmail.date).format('YYYY-MM-DD HH:mm:ss')}</p>
                  {selectedEmail.code && (
                    <p>
                      <strong>取件结果:</strong> 
                      <CodeItem style={{ display: 'inline-flex', padding: '2px 8px', margin: '0 8px' }}>
                        <CodeValue>{selectedEmail.code}</CodeValue>
                        <CopyButton
                          icon={<CopyOutlined />}
                          onClick={() => copyToClipboard(selectedEmail.code || '')}
                          size="small"
                        />
                      </CodeItem>
                    </p>
                  )}
                </Panel>
              </Collapse>
              
              <Divider orientation="left">邮件内容</Divider>
              <Tabs 
                activeKey={viewMode} 
                onChange={(key) => setViewMode(key as 'rendered' | 'text' | 'raw')}
              >
                <TabPane tab="渲染视图" key="rendered">
                  {selectedEmail.content?.html ? (
                    <MailContent>
                      <div dangerouslySetInnerHTML={{ __html: selectedEmail.content.html }} />
                    </MailContent>
                  ) : (
                    <Alert message="无HTML内容" type="info" />
                  )}
                </TabPane>
                <TabPane tab="纯文本" key="text">
                  <MailContent>
                    <pre>{selectedEmail.content?.text || '(无纯文本内容)'}</pre>
                  </MailContent>
                </TabPane>
                <TabPane tab="原始数据" key="raw">
                  <MailContent>
                    <pre>{JSON.stringify(selectedEmail, null, 2)}</pre>
                  </MailContent>
                </TabPane>
              </Tabs>
            </>
          )}
        </Spin>
      </Drawer>
    </div>
  );
};

export default EmailExtraction;