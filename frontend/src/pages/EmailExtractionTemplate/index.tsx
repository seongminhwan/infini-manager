/**
 * 邮件取件模板管理页面
 * 用于创建、编辑、删除和测试邮件取件模板
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tabs,
  Divider,
  Typography,
  Popconfirm,
  Radio,
  Badge,
  Row,
  Col,
  Tooltip,
  Spin
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  SaveOutlined,
  CodeOutlined,
  FileSearchOutlined,
  SearchOutlined,
  InfoCircleOutlined,
  EyeOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import api, { apiBaseUrl } from '../../services/api';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;
const { TextArea } = Input;

// 样式组件
const StyledCard = styled(Card)`
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.09);
  overflow: hidden;
`;

const PreviewContainer = styled.div`
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  background-color: #fafafa;
  max-height: 300px;
  overflow: auto;
`;

const ResultContainer = styled.div`
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background-color: #f5f5f5;
  font-family: monospace;
  white-space: pre-wrap;
`;

const TestButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
`;

const TestResultPreview = styled.div`
  display: inline-block;
  margin-right: 8px;
  padding: 4px 8px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background-color: #f5f5f5;
  font-family: monospace;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
`;

// 数据源选项
const dataSourceOptions = [
  { label: '完整邮件对象', value: '*' },
  { label: '主题', value: 'subject' },
  { label: '发件人', value: 'fromAddress' },
  { label: '发件人名称', value: 'fromName' },
  { label: '收件人', value: 'toAddress' },
  { label: '内容摘要', value: 'snippet' },
  { label: '纯文本内容', value: 'content.text' },
  { label: 'HTML内容', value: 'content.html' },
  { label: '原始邮件头', value: 'content.headers' }
];

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
}

// 邮件接口
interface EmailMessage {
  id: number;
  fromAddress: string;
  fromName: string;
  subject: string;
  date: string;
  snippet: string;
}

// 邮件对象模拟数据（用于测试）
const mockEmailData = {
  id: 2253,
  messageId: "",
  uid: 4254,
  fromAddress: "no-reply@infini.money",
  fromName: "Infini Card",
  toAddress: "vivo@routerhub.io",
  subject: "Infini Global Card Service Update",
  date: 1749232193000,
  status: "read",
  hasAttachments: null,
  attachmentsCount: 0,
  snippet: "<!doctype html> <html lang=3D\"en\">  <head>   <meta charset=3D\"UTF-8\" />   <meta name=3D\"viewport\" content=3D\"width=3Ddevice-width, initial-scale=3D= 1.0\" />   <meta http-equiv=3D\"X-UA-Compatibl",
  mailbox: "INBOX",
  createdAt: "2025-06-09 08:53:41",
  updatedAt: "2025-06-09 08:53:41",
  content: {
    text: "这是纯文本内容样例，可以包含订单号：ORD12345678，卡号：6789-XXXX-XXXX-1234等信息",
    html: "<div>这是HTML内容样例，可以包含<b>订单号：ORD12345678</b>，<span style='color:red'>卡号：6789-XXXX-XXXX-1234</span>等信息</div>",
    headers: [
      {"Subject": "Infini Global Card Service Update"},
      {"From": "Infini Card <no-reply@infini.money>"},
      {"To": "vivo@routerhub.io"}
    ]
  }
};

/**
 * 取件模板管理页面组件
 */
const EmailExtractionTemplate: React.FC = () => {
  // 状态定义
  const [templates, setTemplates] = useState<ExtractionTemplate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [modalType, setModalType] = useState<'create' | 'edit' | 'test'>('create');
  const [modalTitle, setModalTitle] = useState<string>('');
  const [currentTemplate, setCurrentTemplate] = useState<ExtractionTemplate | null>(null);
  const [testResult, setTestResult] = useState<string>('');
  const [testLoading, setTestLoading] = useState<boolean>(false);
  const [form] = Form.useForm();
  
  // 邮件来源相关状态
  const [dataSource, setDataSource] = useState<'mock' | 'select' | 'custom'>('mock');
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [emailLoading, setEmailLoading] = useState<boolean>(false);
  const [emailDetail, setEmailDetail] = useState<any>(null);
  const [customEmailData, setCustomEmailData] = useState<string>(JSON.stringify(mockEmailData, null, 2));
  const [configTestResult, setConfigTestResult] = useState<string>('');
  const [resultModalVisible, setResultModalVisible] = useState<boolean>(false);
  
  // 表格列定义
  const columns: ColumnsType<ExtractionTemplate> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong>{text}</strong>,
    },
    {
      title: '类型',
      dataIndex: 'extractionType',
      key: 'extractionType',
      width: 120,
      render: (type: string) => (
        type === 'regex' ? 
          <Badge color="green" text="正则表达式" /> : 
          <Badge color="blue" text="JavaScript脚本" />
      ),
    },
    {
      title: '数据源',
      dataIndex: 'dataSource',
      key: 'dataSource',
      width: 180,
      render: (dataSource: string) => {
        const option = dataSourceOptions.find(opt => opt.value === dataSource);
        return option ? option.label : dataSource;
      },
    },
    {
      title: '配置',
      dataIndex: 'config',
      key: 'config',
      ellipsis: true,
      render: (text: string) => (
        <Text
          style={{ fontFamily: 'monospace' }}
          ellipsis={{ tooltip: text }}
        >
          {text}
        </Text>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      render: (_, record) => (
        <Space size="small">
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            type="primary"
            ghost
          >
            编辑
          </Button>
          <Button
            icon={<ExperimentOutlined />}
            onClick={() => handleTest(record)}
            type="default"
          >
            测试
          </Button>
          <Popconfirm
            title="确定要删除此模板吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              icon={<DeleteOutlined />}
              danger
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 获取模板列表
  const fetchTemplates = async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  // 获取邮箱账户列表
  const fetchEmailAccounts = async () => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/email-accounts`);
      if (response.data.success) {
        setEmailAccounts(response.data.data);
      } else {
        message.error('获取邮箱账户失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('获取邮箱账户失败:', error);
      message.error('获取邮箱账户列表失败');
    }
  };

  // 获取邮件列表
  const fetchEmails = async (accountId: number) => {
    setEmailLoading(true);
    try {
      const response = await api.get(`${apiBaseUrl}/api/emails/list`, {
        params: {
          accountId,
          page: 1,
          pageSize: 20,
          sortField: 'date',
          sortOrder: 'desc',
          mailbox: 'INBOX'
        }
      });
      
      if (response.data.success) {
        setEmails(response.data.data.emails);
      } else {
        message.error('获取邮件列表失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('获取邮件列表失败:', error);
      message.error('获取邮件列表失败');
    } finally {
      setEmailLoading(false);
    }
  };

  // 获取邮件详情
  const fetchEmailDetail = async (emailId: number) => {
    try {
      const response = await api.get(`${apiBaseUrl}/api/emails/${emailId}`);
      
      if (response.data.success) {
        setEmailDetail(response.data.data);
        // 更新自定义邮件数据的文本框
        setCustomEmailData(JSON.stringify(response.data.data, null, 2));
      } else {
        message.error('获取邮件详情失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('获取邮件详情失败:', error);
      message.error('获取邮件详情失败');
    }
  };

  // 初始化加载
  useEffect(() => {
    fetchTemplates();
    fetchEmailAccounts();
  }, []);

  // 账户变更时获取邮件列表
  useEffect(() => {
    if (selectedAccountId && dataSource === 'select') {
      fetchEmails(selectedAccountId);
    }
  }, [selectedAccountId, dataSource]);

  // 邮件变更时获取详情
  useEffect(() => {
    if (selectedEmailId && dataSource === 'select') {
      fetchEmailDetail(selectedEmailId);
    }
  }, [selectedEmailId, dataSource]);

  // 打开创建模态窗
  const handleCreate = () => {
    setModalType('create');
    setModalTitle('创建取件模板');
    setCurrentTemplate(null);
    setDataSource('mock');
    setSelectedAccountId(null);
    setSelectedEmailId(null);
    setEmailDetail(null);
    setTestResult('');
    setConfigTestResult('');
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑模态窗
  const handleEdit = (template: ExtractionTemplate) => {
    setModalType('edit');
    setModalTitle('编辑取件模板');
    setCurrentTemplate(template);
    setDataSource('mock');
    setSelectedAccountId(null);
    setSelectedEmailId(null);
    setEmailDetail(null);
    setTestResult('');
    setConfigTestResult('');
    form.setFieldsValue({
      name: template.name,
      extractionType: template.extractionType,
      dataSource: template.dataSource,
      config: template.config
    });
    setModalVisible(true);
  };

  // 打开测试模态窗
  const handleTest = (template: ExtractionTemplate) => {
    setModalType('test');
    setModalTitle('测试取件模板');
    setCurrentTemplate(template);
    setDataSource('mock');
    setSelectedAccountId(null);
    setSelectedEmailId(null);
    setEmailDetail(null);
    setTestResult('');
    setConfigTestResult('');
    form.setFieldsValue({
      name: template.name,
      extractionType: template.extractionType,
      dataSource: template.dataSource,
      config: template.config,
    });
    setCustomEmailData(JSON.stringify(mockEmailData, null, 2));
    setModalVisible(true);
  };

  // 删除模板
  const handleDelete = async (id: number) => {
    try {
      const response = await api.delete(`${apiBaseUrl}/api/email-extractions/${id}`);
      if (response.data.success) {
        message.success('删除模板成功');
        fetchTemplates();
      } else {
        message.error('删除模板失败: ' + response.data.message);
      }
    } catch (error) {
      console.error('删除模板失败:', error);
      message.error('删除模板失败');
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const templateData = {
        name: values.name,
        extractionType: values.extractionType,
        dataSource: values.dataSource,
        config: values.config
      };

      if (modalType === 'create') {
        // 创建模板
        const response = await api.post(`${apiBaseUrl}/api/email-extractions`, templateData);
        if (response.data.success) {
          message.success('创建模板成功');
          setModalVisible(false);
          fetchTemplates();
        } else {
          message.error('创建模板失败: ' + response.data.message);
        }
      } else if (modalType === 'edit' && currentTemplate) {
        // 更新模板
        const response = await api.put(`${apiBaseUrl}/api/email-extractions/${currentTemplate.id}`, templateData);
        if (response.data.success) {
          message.success('更新模板成功');
          setModalVisible(false);
          fetchTemplates();
        } else {
          message.error('更新模板失败: ' + response.data.message);
        }
      }
    } catch (error) {
      console.error('提交表单失败:', error);
    }
  };

  // 测试配置
  const handleTestConfig = async () => {
    try {
      // 获取表单中的配置
      const values = await form.validateFields(['extractionType', 'dataSource', 'config']);
      let testDataObj;
      
      // 根据不同的数据源获取测试数据
      if (dataSource === 'mock') {
        testDataObj = mockEmailData;
      } else if (dataSource === 'select' && emailDetail) {
        testDataObj = emailDetail;
      } else {
        try {
          testDataObj = JSON.parse(customEmailData);
        } catch (error) {
          message.error('JSON格式错误，请检查');
          return;
        }
      }
      
      setTestLoading(true);
      const response = await api.post(`${apiBaseUrl}/api/email-extractions/test`, {
        template: {
          extractionType: values.extractionType,
          dataSource: values.dataSource,
          config: values.config
        },
        testData: testDataObj
      });
      
      if (response.data.success) {
        setConfigTestResult(response.data.data.result || '');
      } else {
        message.error('测试失败: ' + response.data.message);
      }
    } catch (error: any) {
      console.error('测试配置失败:', error);
      message.error('测试配置失败: ' + error.message);
    } finally {
      setTestLoading(false);
    }
  };

  // 测试模板
  const handleTestTemplate = async () => {
    try {
      const values = await form.validateFields();
      let testDataObj;
      
      // 根据不同的数据源获取测试数据
      if (dataSource === 'mock') {
        testDataObj = mockEmailData;
      } else if (dataSource === 'select' && emailDetail) {
        testDataObj = emailDetail;
      } else {
        try {
          testDataObj = JSON.parse(customEmailData);
        } catch (error) {
          message.error('JSON格式错误，请检查');
          return;
        }
      }
      
      setTestLoading(true);
      const response = await api.post(`${apiBaseUrl}/api/email-extractions/test`, {
        template: {
          extractionType: values.extractionType,
          dataSource: values.dataSource,
          config: values.config
        },
        testData: testDataObj
      });
      
      if (response.data.success) {
        setTestResult(response.data.data.result || '');
        message.success('测试成功');
      } else {
        message.error('测试失败: ' + response.data.message);
      }
    } catch (error: any) {
      console.error('测试模板失败:', error);
      message.error('测试模板失败: ' + error.message);
    } finally {
      setTestLoading(false);
    }
  };

  // 查看完整结果
  const handleViewFullResult = () => {
    setResultModalVisible(true);
  };

  // 获取测试数据源
  const getTestData = () => {
    if (dataSource === 'mock') {
      return mockEmailData;
    } else if (dataSource === 'select' && emailDetail) {
      return emailDetail;
    } else {
      try {
        return JSON.parse(customEmailData);
      } catch (error) {
        return null;
      }
    }
  };

  // 渲染邮件内容预览
  const renderEmailPreview = () => {
    const data = getTestData();
    if (!data) return <div>无邮件数据</div>;
    
    return (
      <Tabs defaultActiveKey="preview">
        <TabPane tab="预览" key="preview">
          {data.content?.html ? (
            <div dangerouslySetInnerHTML={{ __html: data.content.html }} />
          ) : (
            <div>无HTML内容</div>
          )}
        </TabPane>
        <TabPane tab="文本" key="text">
          <pre>{data.content?.text || '无文本内容'}</pre>
        </TabPane>
        <TabPane tab="数据结构" key="structure">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </TabPane>
      </Tabs>
    );
  };

  // 渲染模态窗内容
  const renderModalContent = () => {
    if (modalType === 'test') {
      return (
        <Form form={form} layout="vertical">
          <Radio.Group
            value={dataSource}
            onChange={(e) => setDataSource(e.target.value)}
            style={{ marginBottom: 16 }}
          >
            <Radio.Button value="mock">使用示例数据</Radio.Button>
            <Radio.Button value="select">选择邮件</Radio.Button>
            <Radio.Button value="custom">自定义数据</Radio.Button>
          </Radio.Group>
          
          {dataSource === 'select' && (
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Select
                  placeholder="选择邮箱账户"
                  style={{ width: '100%' }}
                  value={selectedAccountId}
                  onChange={setSelectedAccountId}
                >
                  {emailAccounts.map(account => (
                    <Option key={account.id} value={account.id}>
                      {account.name} ({account.email})
                    </Option>
                  ))}
                </Select>
              </Col>
              <Col span={12}>
                <Select
                  placeholder="选择邮件"
                  style={{ width: '100%' }}
                  value={selectedEmailId}
                  onChange={setSelectedEmailId}
                  loading={emailLoading}
                  disabled={!selectedAccountId}
                >
                  {emails.map(email => (
                    <Option key={email.id} value={email.id}>
                      {email.subject || '(无主题)'} - {email.fromName || email.fromAddress}
                    </Option>
                  ))}
                </Select>
              </Col>
            </Row>
          )}
          
          {dataSource === 'custom' && (
            <Form.Item
              label="自定义邮件数据 (JSON格式)"
              style={{ marginBottom: 16 }}
            >
              <TextArea
                rows={8}
                value={customEmailData}
                onChange={(e) => setCustomEmailData(e.target.value)}
              />
            </Form.Item>
          )}
          
          <Divider orientation="left">邮件内容预览</Divider>
          <PreviewContainer>
            {renderEmailPreview()}
          </PreviewContainer>
          
          <Divider orientation="left">模板配置</Divider>
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input disabled />
          </Form.Item>
          <Form.Item
            name="extractionType"
            label="取件类型"
            rules={[{ required: true, message: '请选择取件类型' }]}
          >
            <Radio.Group disabled>
              <Radio value="regex">正则表达式</Radio>
              <Radio value="javascript">JavaScript脚本</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="dataSource"
            label="数据源"
            rules={[{ required: true, message: '请选择数据源' }]}
          >
            <Select disabled>
              {dataSourceOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="config"
            label="配置"
            rules={[{ required: true, message: '请输入配置' }]}
          >
            <TextArea rows={6} disabled />
          </Form.Item>
          
          <Divider />
          <Title level={5}>测试结果：</Title>
          <ResultContainer>
            {testResult || '尚未执行测试或无匹配结果'}
          </ResultContainer>
        </Form>
      );
    }

    // 创建或编辑模板
    return (
      <Form form={form} layout="vertical">
        <Radio.Group
          value={dataSource}
          onChange={(e) => setDataSource(e.target.value)}
          style={{ marginBottom: 16 }}
        >
          <Radio.Button value="mock">使用示例数据</Radio.Button>
          <Radio.Button value="select">选择邮件</Radio.Button>
          <Radio.Button value="custom">自定义数据</Radio.Button>
        </Radio.Group>
        
        {dataSource === 'select' && (
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <Select
                placeholder="选择邮箱账户"
                style={{ width: '100%' }}
                value={selectedAccountId}
                onChange={setSelectedAccountId}
              >
                {emailAccounts.map(account => (
                  <Option key={account.id} value={account.id}>
                    {account.name} ({account.email})
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={12}>
              <Select
                placeholder="选择邮件"
                style={{ width: '100%' }}
                value={selectedEmailId}
                onChange={setSelectedEmailId}
                loading={emailLoading}
                disabled={!selectedAccountId}
              >
                {emails.map(email => (
                  <Option key={email.id} value={email.id}>
                    {email.subject || '(无主题)'} - {email.fromName || email.fromAddress}
                  </Option>
                ))}
              </Select>
            </Col>
          </Row>
        )}
        
        {dataSource === 'custom' && (
          <Form.Item
            label="自定义邮件数据 (JSON格式)"
            style={{ marginBottom: 16 }}
          >
            <TextArea
              rows={8}
              value={customEmailData}
              onChange={(e) => setCustomEmailData(e.target.value)}
            />
          </Form.Item>
        )}
        
        <Divider orientation="left">邮件内容预览</Divider>
        <PreviewContainer>
          {renderEmailPreview()}
        </PreviewContainer>
        
        <Divider orientation="left">模板配置</Divider>
        <Form.Item
          name="name"
          label="模板名称"
          rules={[{ required: true, message: '请输入模板名称' }]}
        >
          <Input placeholder="请输入模板名称" />
        </Form.Item>
        <Form.Item
          name="extractionType"
          label="取件类型"
          rules={[{ required: true, message: '请选择取件类型' }]}
        >
          <Radio.Group>
            <Radio value="regex">正则表达式</Radio>
            <Radio value="javascript">JavaScript脚本</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          name="dataSource"
          label="数据源"
          rules={[{ required: true, message: '请选择数据源' }]}
        >
          <Select placeholder="请选择数据源">
            {dataSourceOptions.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item
          name="config"
          label={form.getFieldValue('extractionType') === 'regex' ? '正则表达式' : 'JavaScript脚本'}
          rules={[{ required: true, message: '请输入配置' }]}
          extra={
            form.getFieldValue('extractionType') === 'regex'
              ? '建议使用括号()创建捕获组，将提取第一个捕获组的内容。如果没有捕获组，则提取整个匹配内容。'
              : 'JavaScript函数应返回提取的内容。输入参数为所选数据源的内容。例如: return data.match(/订单号：(\\w+)/)?.[1] || "";'
          }
        >
          <div>
            <TextArea 
              rows={6} 
              placeholder={
                form.getFieldValue('extractionType') === 'regex'
                  ? '例如: 订单号：(\\w+)'
                  : '例如: return data.match(/订单号：(\\w+)/)?.[1] || "";'
              }
            />
            <TestButtonContainer>
              {configTestResult && (
                <Tooltip title="点击查看完整结果">
                  <TestResultPreview onClick={handleViewFullResult}>
                    {configTestResult.length > 20 
                      ? configTestResult.substring(0, 20) + '...' 
                      : configTestResult || '无匹配结果'}
                  </TestResultPreview>
                </Tooltip>
              )}
              <Button
                type="default"
                icon={<ExperimentOutlined />}
                onClick={handleTestConfig}
                loading={testLoading}
                size="small"
              >
                测试提取
              </Button>
            </TestButtonContainer>
          </div>
        </Form.Item>
      </Form>
    );
  };

  // 模态窗底部按钮
  const renderModalFooter = () => {
    if (modalType === 'test') {
      return [
        <Button key="cancel" onClick={() => setModalVisible(false)}>
          关闭
        </Button>,
        <Button 
          key="test" 
          type="primary" 
          onClick={handleTestTemplate} 
          loading={testLoading}
          icon={<ExperimentOutlined />}
        >
          测试
        </Button>
      ];
    }

    return [
      <Button key="cancel" onClick={() => setModalVisible(false)}>
        取消
      </Button>,
      <Button 
        key="submit" 
        type="primary" 
        onClick={handleSubmit}
        icon={<SaveOutlined />}
      >
        保存
      </Button>
    ];
  };

  return (
    <div>
      <StyledCard
        title="取件模板管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreate}
          >
            创建取件模板
          </Button>
        }
      >
        <Paragraph>
          取件模板用于从邮件中提取特定的内容，支持正则表达式和JavaScript脚本两种方式。
          创建模板后，可以在邮件取件功能中使用这些模板提取邮件内容。
        </Paragraph>
        <Table
          columns={columns}
          dataSource={templates}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </StyledCard>

      <Modal
        title={modalTitle}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={renderModalFooter()}
        width={800}
        destroyOnClose
      >
        {renderModalContent()}
      </Modal>

      {/* 完整结果查看弹窗 */}
      <Modal
        title="完整提取结果"
        open={resultModalVisible}
        onCancel={() => setResultModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setResultModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <ResultContainer>
          {configTestResult || '无匹配结果'}
        </ResultContainer>
      </Modal>
    </div>
  );
};

export default EmailExtractionTemplate;