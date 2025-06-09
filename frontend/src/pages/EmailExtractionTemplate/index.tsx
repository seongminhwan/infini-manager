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
  Badge
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  SaveOutlined,
  CodeOutlined,
  FileSearchOutlined
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
  const [testData, setTestData] = useState<any>(mockEmailData);
  const [form] = Form.useForm();
  const [configStep, setConfigStep] = useState<number>(0);
  
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

  // 初始化加载
  useEffect(() => {
    fetchTemplates();
  }, []);

  // 打开创建模态窗
  const handleCreate = () => {
    setModalType('create');
    setModalTitle('创建取件模板');
    setCurrentTemplate(null);
    setConfigStep(0);
    form.resetFields();
    setModalVisible(true);
  };

  // 打开编辑模态窗
  const handleEdit = (template: ExtractionTemplate) => {
    setModalType('edit');
    setModalTitle('编辑取件模板');
    setCurrentTemplate(template);
    setConfigStep(0);
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
    setTestResult('');
    form.setFieldsValue({
      name: template.name,
      extractionType: template.extractionType,
      dataSource: template.dataSource,
      config: template.config,
      testData: JSON.stringify(testData, null, 2)
    });
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

  // 测试模板
  const handleTestTemplate = async () => {
    try {
      const values = await form.validateFields();
      const testDataObj = values.testData ? JSON.parse(values.testData) : testData;
      
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
      if (error.message.includes('JSON')) {
        message.error('测试数据格式错误，请检查JSON格式是否正确');
      } else {
        message.error('测试模板失败: ' + error.message);
      }
    } finally {
      setTestLoading(false);
    }
  };

  // 下一步
  const handleNextStep = async () => {
    try {
      await form.validateFields(['name', 'extractionType']);
      setConfigStep(1);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 上一步
  const handlePrevStep = () => {
    setConfigStep(0);
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

    if (configStep === 0) {
      return [
        <Button key="cancel" onClick={() => setModalVisible(false)}>
          取消
        </Button>,
        <Button 
          key="next" 
          type="primary" 
          onClick={handleNextStep}
        >
          下一步
        </Button>
      ];
    }

    return [
      <Button key="back" onClick={handlePrevStep}>
        上一步
      </Button>,
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

  // 模态窗内容
  const renderModalContent = () => {
    if (modalType === 'test') {
      return (
        <Form form={form} layout="vertical">
          <Tabs defaultActiveKey="template">
            <TabPane tab="模板配置" key="template">
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
            </TabPane>
            <TabPane tab="测试数据" key="testData">
              <Form.Item
                name="testData"
                label="测试数据 (JSON格式)"
                rules={[
                  { required: true, message: '请输入测试数据' },
                  {
                    validator: (_, value) => {
                      try {
                        if (value) JSON.parse(value);
                        return Promise.resolve();
                      } catch (error) {
                        return Promise.reject('JSON格式错误');
                      }
                    }
                  }
                ]}
              >
                <TextArea rows={10} />
              </Form.Item>
              <Button 
                type="default" 
                onClick={() => form.setFieldsValue({ testData: JSON.stringify(mockEmailData, null, 2) })}
              >
                使用示例数据
              </Button>
            </TabPane>
          </Tabs>
          <Divider />
          <Title level={5}>测试结果：</Title>
          <ResultContainer>
            {testResult || '尚未执行测试或无匹配结果'}
          </ResultContainer>
        </Form>
      );
    }

    if (configStep === 0) {
      return (
        <Form form={form} layout="vertical">
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
        </Form>
      );
    }

    // 第二步
    return (
      <Form form={form} layout="vertical">
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
          <TextArea 
            rows={8} 
            placeholder={
              form.getFieldValue('extractionType') === 'regex'
                ? '例如: 订单号：(\\w+)'
                : '例如: return data.match(/订单号：(\\w+)/)?.[1] || "";'
            }
          />
        </Form.Item>
        <Divider />
        <PreviewContainer>
          <Title level={5}>
            <FileSearchOutlined /> 数据源参考示例
          </Title>
          <Tabs defaultActiveKey="preview">
            <TabPane tab="预览" key="preview">
              <div dangerouslySetInnerHTML={{ __html: mockEmailData.content.html }} />
            </TabPane>
            <TabPane tab="文本" key="text">
              <pre>{mockEmailData.content.text}</pre>
            </TabPane>
            <TabPane tab="数据结构" key="structure">
              <pre>{JSON.stringify(mockEmailData, null, 2)}</pre>
            </TabPane>
          </Tabs>
        </PreviewContainer>
      </Form>
    );
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
    </div>
  );
};

export default EmailExtractionTemplate;