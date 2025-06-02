/**
 * 独立的邮件同步任务编辑页面
 * 完全脱离TaskManage组件，避免状态循环依赖和无限渲染问题
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Radio,
  Checkbox,
  DatePicker,
  Space,
  Alert,
  message,
  Spin,
  Typography,
  Breadcrumb,
  Divider
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  SyncOutlined,
  MailOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import dayjs from 'dayjs';
import { emailAccountApi, taskApi } from '../../services/api';
import CronExpressionBuilder from '../../components/CronExpressionBuilder';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// 样式组件
const PageContainer = styled.div`
  padding: 20px;
`;

const StyledCard = styled(Card)`
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
`;

// 接口定义
interface EmailAccount {
  id: number;
  name: string;
  email: string;
  status: string;
  is_default?: number;
}

interface EmailSyncParams {
  accountIds: number[];
  syncType: 'full' | 'incremental';
  mailboxes: string[];
  startDate?: string;
  endDate?: string;
}

// 可选邮箱文件夹列表
const availableMailboxes = [
  { value: 'INBOX', label: '收件箱' },
  { value: 'Sent', label: '已发送' },
  { value: 'Drafts', label: '草稿箱' },
  { value: 'Trash', label: '垃圾箱' },
  { value: 'Junk', label: '垃圾邮件' },
  { value: 'Archive', label: '存档' }
];

/**
 * 独立的邮件同步任务编辑页面
 */
const EditEmailSyncTask: React.FC = () => {
  // 从URL获取任务ID
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  
  // 表单实例
  const [form] = Form.useForm();
  
  // 状态
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [taskDetail, setTaskDetail] = useState<any>(null);
  const [cronExpression, setCronExpression] = useState<string>('*/5 * * * *');
  const [syncParams, setSyncParams] = useState<EmailSyncParams>({
    accountIds: [],
    syncType: 'incremental',
    mailboxes: ['INBOX'],
    startDate: undefined,
    endDate: undefined
  });
  
  // 加载数据：仅在组件挂载时执行一次
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        // 并行加载邮箱账户列表和任务详情
        const [accountsResponse, tasksResponse] = await Promise.all([
          emailAccountApi.getAllEmailAccounts(),
          taskId ? taskApi.getTasks() : Promise.resolve({ success: true, data: [] })
        ]);
        
        // 处理邮箱账户列表
        if (accountsResponse.success) {
          const activeAccounts = (accountsResponse.data || []).filter(
            (account: EmailAccount) => account.status === 'active'
          );
          setEmailAccounts(activeAccounts);
        }
        
        // 处理任务详情（仅当有taskId时）
        if (taskId && tasksResponse.success) {
          // 查找指定ID的任务
          const tasks = tasksResponse.data?.tasks || tasksResponse.data || [];
          const foundTask = Array.isArray(tasks) ? 
            tasks.find((t: any) => t.id === parseInt(taskId)) : null;
          
          if (foundTask) {
            setTaskDetail(foundTask);
            
            // 延迟初始化表单，避免渲染冲突
            setTimeout(() => initFormData(foundTask), 0);
          } else {
            message.error('未找到指定任务');
            // 跳转回任务管理页面
            setTimeout(() => navigate('/task-manage'), 1500);
          }
        } else if (!taskId) {
          // 创建模式：使用默认值
          form.setFieldsValue({
            taskName: '内置邮件增量同步',
            description: '定时同步邮箱邮件到本地数据库',
            status: 'enabled',
            retryCount: 0,
            retryInterval: 0
          });
        }
      } catch (error: any) {
        console.error('加载数据失败:', error);
        message.error(`加载数据失败: ${error.message || '请稍后重试'}`);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, []);
  
  // 初始化表单数据（仅在获取到任务详情后调用一次）
  const initFormData = (task: any) => {
    try {
      // 解析处理器JSON
      const handlerObj = typeof task.handler === 'string' ? 
        JSON.parse(task.handler) : task.handler;
      
      // 解析处理器参数
      const params = handlerObj.params || {};
      
      // 批量更新多个状态
      const initialParams = {
        accountIds: params.accountIds || [],
        syncType: params.syncType || 'incremental',
        mailboxes: params.mailboxes || ['INBOX'],
        startDate: params.startDate,
        endDate: params.endDate
      };
      
      // 设置表单初始值
      form.setFieldsValue({
        taskName: task.task_name,
        description: task.description,
        status: task.status,
        retryCount: task.retry_count,
        retryInterval: task.retry_interval
      });
      
      // 批量更新状态（一次性设置所有状态，避免多次渲染）
      setCronExpression(task.cron_expression);
      setSyncParams(initialParams);
    } catch (error) {
      console.error('解析任务数据失败:', error);
      message.error('解析任务数据失败，请重试');
    }
  };
  
  // 处理选择全部邮箱
  const handleSelectAllAccounts = () => {
    const allAccountIds = emailAccounts.map((account) => account.id);
    setSyncParams({...syncParams, accountIds: allAccountIds});
  };
  
  // 处理清除所有选择
  const handleClearAllAccounts = () => {
    setSyncParams({...syncParams, accountIds: []});
  };
  
  // 返回任务管理页面
  const handleGoBack = () => {
    navigate('/task-manage');
  };
  
  // 处理表单提交
  const handleSubmit = async () => {
    try {
      // 验证表单
      await form.validateFields();
      
      // 获取表单值
      const formValues = form.getFieldsValue();
      
      // 如果没有选择邮箱账户，提示用户
      if (syncParams.accountIds.length === 0) {
        if (!window.confirm('您没有选择任何邮箱账户，系统将同步所有有效的邮箱账户。是否继续？')) {
          return;
        }
      }
      
      // 构建任务数据
      const taskData = {
        taskName: formValues.taskName,
        taskKey: 'BUILTIN_INCREMENTAL_EMAIL_SYNC',
        description: formValues.description || '内置邮件增量同步任务',
        cronExpression: cronExpression,
        handler: {
          type: 'function' as const,
          functionName: 'syncEmails',
          params: syncParams
        },
        status: formValues.status || 'enabled',
        retryCount: formValues.retryCount || 0,
        retryInterval: formValues.retryInterval || 0
      };
      
      setSaving(true);
      
      let response;
      if (taskId) {
        // 更新任务
        response = await taskApi.updateTask(taskId, taskData);
      } else {
        // 创建任务
        response = await taskApi.createTask(taskData);
      }
      
      if (response && response.success) {
        message.success(`${taskId ? '更新' : '创建'}邮件同步任务成功`);
        // 保存成功后返回任务管理页面
        setTimeout(() => navigate('/task-manage'), 1000);
      } else {
        message.error(`${taskId ? '更新' : '创建'}邮件同步任务失败: ${response?.message || '未知错误'}`);
      }
    } catch (error: any) {
      console.error('提交任务失败:', error);
      message.error(`提交任务失败: ${error.message || '网络错误，请稍后重试'}`);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <PageContainer>
      <Breadcrumb
        items={[
          { title: '首页' },
          { title: '任务管理', href: '/task-manage' },
          { title: taskId ? '编辑邮件同步任务' : '创建邮件同步任务' }
        ]}
        style={{ marginBottom: 16 }}
      />
      
      <Title level={4}>
        <MailOutlined style={{ marginRight: 8 }} />
        {taskId ? '编辑邮件同步任务' : '创建邮件同步任务'}
      </Title>
      
      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            status: 'enabled',
            retryCount: 0,
            retryInterval: 0
          }}
        >
          <StyledCard title="基本设置">
            <Form.Item
              label="任务名称"
              name="taskName"
              rules={[{ required: true, message: '请输入任务名称' }]}
            >
              <Input placeholder="请输入任务名称" />
            </Form.Item>
            
            <Form.Item
              label="Cron表达式"
              tooltip="定时任务的执行周期，使用Cron表达式格式"
            >
              <CronExpressionBuilder
                value={cronExpression}
                onChange={(value) => setCronExpression(value)}
              />
            </Form.Item>
            
            <Form.Item
              label="任务状态"
              name="status"
            >
              <Radio.Group>
                <Radio value="enabled">启用</Radio>
                <Radio value="disabled">禁用</Radio>
              </Radio.Group>
            </Form.Item>
          </StyledCard>
          
          <StyledCard title="同步设置">
            <Form.Item label="同步类型">
              <Radio.Group 
                value={syncParams.syncType}
                onChange={(e) => setSyncParams({...syncParams, syncType: e.target.value})}
              >
                <Radio value="incremental">增量同步</Radio>
                <Radio value="full">全量同步</Radio>
              </Radio.Group>
              <div style={{ marginTop: 8, color: '#666' }}>
                {syncParams.syncType === 'incremental' ? 
                  '增量同步：仅同步上次同步后的新邮件' : 
                  '全量同步：同步指定日期范围内的所有邮件'
                }
              </div>
            </Form.Item>
            
            <Form.Item label="选择邮箱账户">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <Button onClick={handleSelectAllAccounts}>全选</Button>
                  <Button onClick={handleClearAllAccounts}>清除选择</Button>
                </Space>
                <Select
                  mode="multiple"
                  placeholder="请选择需要同步的邮箱账户"
                  style={{ width: '100%' }}
                  value={syncParams.accountIds}
                  onChange={(values) => setSyncParams({...syncParams, accountIds: values})}
                  loading={loading}
                >
                  {emailAccounts.map((account) => (
                    <Option key={account.id} value={account.id}>
                      {account.name} ({account.email})
                    </Option>
                  ))}
                </Select>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {syncParams.accountIds.length > 0 ? 
                    `已选择 ${syncParams.accountIds.length} 个邮箱账户` : 
                    '未选择任何邮箱账户，将同步所有有效的邮箱账户'
                  }
                </div>
              </Space>
            </Form.Item>
            
            <Form.Item label="邮箱文件夹">
              <Checkbox.Group
                options={availableMailboxes}
                value={syncParams.mailboxes}
                onChange={(values) => setSyncParams({...syncParams, mailboxes: values as string[]})}
              />
            </Form.Item>
            
            {syncParams.syncType === 'full' && (
              <Form.Item label="日期范围">
                <RangePicker
                  value={
                    syncParams.startDate && syncParams.endDate ?
                    [dayjs(syncParams.startDate), dayjs(syncParams.endDate)] :
                    null
                  }
                  onChange={(dates) => {
                    if (dates && dates[0] && dates[1]) {
                      setSyncParams({
                        ...syncParams,
                        startDate: dates[0].format('YYYY-MM-DD'),
                        endDate: dates[1].format('YYYY-MM-DD')
                      });
                    } else {
                      setSyncParams({
                        ...syncParams,
                        startDate: undefined,
                        endDate: undefined
                      });
                    }
                  }}
                />
              </Form.Item>
            )}
          </StyledCard>
          
          <StyledCard title="高级设置">
            <Form.Item
              label="重试次数"
              name="retryCount"
              tooltip="任务失败后的重试次数，0表示不重试"
            >
              <Input type="number" min={0} />
            </Form.Item>
            
            <Form.Item
              label="重试间隔(秒)"
              name="retryInterval"
              tooltip="任务失败后的重试间隔时间，单位为秒"
            >
              <Input type="number" min={0} />
            </Form.Item>
            
            <Form.Item
              label="任务描述"
              name="description"
            >
              <Input.TextArea rows={3} placeholder="请输入任务描述" />
            </Form.Item>
          </StyledCard>
          
          <ButtonContainer>
            <Space>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={handleGoBack}
              >
                返回
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSubmit}
              >
                保存
              </Button>
            </Space>
          </ButtonContainer>
        </Form>
      </Spin>
    </PageContainer>
  );
};

export default EditEmailSyncTask;