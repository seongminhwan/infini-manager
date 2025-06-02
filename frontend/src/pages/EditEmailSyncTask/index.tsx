/**
 * 极简版邮件同步任务编辑页面
 * 采用极简设计，避免无限循环渲染问题
 */
import React, { useState, useEffect, useReducer } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Radio,
  message,
  Spin,
  Typography,
  Space,
  Divider,
  Alert
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  MailOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { emailAccountApi, taskApi } from '../../services/api';

const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

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
}

// 任务表单数据
interface TaskFormState {
  taskName: string;
  cronExpression: string;
  status: 'enabled' | 'disabled';
  accountIds: number[];
  syncType: 'incremental' | 'full';
  retryCount: number;
  retryInterval: number;
  description: string;
}

// 任务表单动作类型
type TaskFormAction = 
  | { type: 'INIT_FORM', payload: any }
  | { type: 'UPDATE_FIELD', field: keyof TaskFormState, value: any }
  | { type: 'SELECT_ALL_ACCOUNTS', accounts: EmailAccount[] }
  | { type: 'CLEAR_ACCOUNTS' };

// 任务表单Reducer函数
function taskFormReducer(state: TaskFormState, action: TaskFormAction): TaskFormState {
  switch (action.type) {
    case 'INIT_FORM':
      // 初始化表单数据
      const task = action.payload;
      
      // 解析处理器
      let accountIds: number[] = [];
      let syncType: 'incremental' | 'full' = 'incremental';
      
      try {
        if (task && task.handler) {
          const handlerObj = typeof task.handler === 'string' ? 
            JSON.parse(task.handler) : task.handler;
          
          const params = handlerObj.params || {};
          accountIds = params.accountIds || [];
          syncType = params.syncType || 'incremental';
        }
      } catch (e) {
        console.error('解析处理器失败:', e);
      }
      
      return {
        taskName: task?.task_name || '内置邮件增量同步',
        cronExpression: task?.cron_expression || '*/5 * * * *',
        status: task?.status || 'enabled',
        accountIds,
        syncType,
        retryCount: task?.retry_count || 0,
        retryInterval: task?.retry_interval || 0,
        description: task?.description || '定时同步邮箱邮件到本地数据库'
      };
      
    case 'UPDATE_FIELD':
      return {
        ...state,
        [action.field]: action.value
      };
      
    case 'SELECT_ALL_ACCOUNTS':
      return {
        ...state,
        accountIds: action.accounts.map(account => account.id)
      };
      
    case 'CLEAR_ACCOUNTS':
      return {
        ...state,
        accountIds: []
      };
      
    default:
      return state;
  }
}

/**
 * 极简版邮件同步任务编辑页面
 */
const EditEmailSyncTask: React.FC = () => {
  // 从URL获取任务ID
  const { taskId } = useParams<{ taskId?: string }>();
  const navigate = useNavigate();
  
  // 状态
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  
  // 使用useReducer管理表单状态
  const [formState, dispatch] = useReducer(taskFormReducer, {
    taskName: '内置邮件增量同步',
    cronExpression: '*/5 * * * *',
    status: 'enabled',
    accountIds: [],
    syncType: 'incremental',
    retryCount: 0,
    retryInterval: 0,
    description: '定时同步邮箱邮件到本地数据库'
  });
  
  // 加载数据
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      
      try {
        // 加载邮箱账户列表
        const accountsResponse = await emailAccountApi.getAllEmailAccounts();
        if (accountsResponse.success) {
          const activeAccounts = (accountsResponse.data || []).filter(
            (account: EmailAccount) => account.status === 'active'
          );
          setEmailAccounts(activeAccounts);
        }
        
        // 如果有任务ID，加载任务详情
        if (taskId) {
          const tasksResponse = await taskApi.getTasks();
          
          if (tasksResponse.success) {
            const tasks = tasksResponse.data?.tasks || tasksResponse.data || [];
            const taskData = Array.isArray(tasks) ? 
              tasks.find((t: any) => t.id === parseInt(taskId)) : null;
            
            if (taskData) {
              // 初始化表单
              dispatch({ type: 'INIT_FORM', payload: taskData });
            } else {
              message.error('未找到指定任务');
              // 返回任务列表页面
              navigate('/task-manage');
            }
          }
        }
      } catch (error: any) {
        console.error('加载数据失败:', error);
        message.error(`加载数据失败: ${error.message || '未知错误'}`);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [taskId, navigate]);
  
  // 处理表单字段更新
  const handleFieldChange = (field: keyof TaskFormState, value: any) => {
    dispatch({ type: 'UPDATE_FIELD', field, value });
  };
  
  // 处理选择全部邮箱
  const handleSelectAllAccounts = () => {
    dispatch({ type: 'SELECT_ALL_ACCOUNTS', accounts: emailAccounts });
  };
  
  // 处理清除所有选择
  const handleClearAllAccounts = () => {
    dispatch({ type: 'CLEAR_ACCOUNTS' });
  };
  
  // 返回任务管理页面
  const handleGoBack = () => {
    navigate('/task-manage');
  };
  
  // 处理表单提交
  const handleSubmit = async () => {
    try {
      setSaving(true);
      
      let response;
      if (taskId) {
        // 更新任务 - 只包含允许修改的字段
        const updateData = {
          taskName: formState.taskName,
          description: formState.description,
          cronExpression: formState.cronExpression,
          status: formState.status,
          retryCount: formState.retryCount,
          retryInterval: formState.retryInterval
          // 不包含handler字段，因为内置任务不允许修改handler
        };
        
        // 更新任务 - 只发送允许修改的字段
        response = await taskApi.updateTask(taskId, updateData);
      } else {
        // 创建任务 - 需要包含所有必要字段
        const createData = {
          taskName: formState.taskName,
          taskKey: 'BUILTIN_INCREMENTAL_EMAIL_SYNC', // 必须提供taskKey
          description: formState.description,
          cronExpression: formState.cronExpression,
          handler: {
            type: 'function' as const,
            functionName: 'syncEmails',
            params: {
              accountIds: formState.accountIds,
              syncType: formState.syncType,
              mailboxes: ['INBOX'] // 简化：默认只同步收件箱
            }
          },
          status: formState.status,
          retryCount: formState.retryCount,
          retryInterval: formState.retryInterval
        };
        
        // 创建任务
        response = await taskApi.createTask(createData);
      }
      
      if (response && response.success) {
        message.success(`${taskId ? '更新' : '创建'}邮件同步任务成功`);
        // 返回任务管理页面
        navigate('/task-manage');
      } else {
        message.error(`${taskId ? '更新' : '创建'}邮件同步任务失败: ${response?.message || '未知错误'}`);
      }
    } catch (error: any) {
      console.error('提交任务失败:', error);
      message.error(`提交任务失败: ${error.message || '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <PageContainer>
      <Title level={4}>
        <MailOutlined style={{ marginRight: 8 }} />
        {taskId ? '编辑邮件同步任务' : '创建邮件同步任务'}
      </Title>
      
      <Divider />
      
      <Spin spinning={loading}>
        <StyledCard title="基本设置">
          <Form layout="vertical">
            <Form.Item
              label="任务名称"
              required
            >
              <Input
                value={formState.taskName}
                onChange={(e) => handleFieldChange('taskName', e.target.value)}
                placeholder="请输入任务名称"
              />
            </Form.Item>
            
            <Form.Item
              label="Cron表达式"
              tooltip="定时任务的执行周期，使用Cron表达式格式"
              required
            >
              <Input
                value={formState.cronExpression}
                onChange={(e) => handleFieldChange('cronExpression', e.target.value)}
                placeholder="例如: */5 * * * * (每5分钟执行一次)"
              />
            </Form.Item>
            
            <Form.Item label="任务状态">
              <Radio.Group
                value={formState.status}
                onChange={(e) => handleFieldChange('status', e.target.value)}
              >
                <Radio value="enabled">启用</Radio>
                <Radio value="disabled">禁用</Radio>
              </Radio.Group>
            </Form.Item>
          </Form>
        </StyledCard>
        
        <StyledCard title="同步设置">
          <Form layout="vertical">
            <Alert
              type="warning"
              message="系统限制"
              description="由于系统限制，内置邮件同步任务的同步设置（包括邮箱选择和同步类型）暂不支持修改。"
              showIcon
              style={{ marginBottom: 16 }}
            />
            
            <Form.Item label="同步类型">
              <Radio.Group 
                value={formState.syncType}
                onChange={(e) => handleFieldChange('syncType', e.target.value)}
                disabled={true}
              >
                <Radio value="incremental">增量同步</Radio>
                <Radio value="full">全量同步</Radio>
              </Radio.Group>
              <div style={{ marginTop: 8, color: '#999' }}>
                当前使用增量同步模式，只同步上次同步后的新邮件
              </div>
            </Form.Item>
            
            <Form.Item label="选择邮箱账户">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <Button onClick={handleSelectAllAccounts} disabled={true}>全选</Button>
                  <Button onClick={handleClearAllAccounts} disabled={true}>清除选择</Button>
                </Space>
                <Select
                  mode="multiple"
                  placeholder="请选择需要同步的邮箱账户"
                  style={{ width: '100%' }}
                  value={formState.accountIds}
                  onChange={(values) => handleFieldChange('accountIds', values)}
                  disabled={true}
                >
                  {emailAccounts.map((account) => (
                    <Option key={account.id} value={account.id}>
                      {account.name} ({account.email})
                    </Option>
                  ))}
                </Select>
                <div style={{ fontSize: '12px', color: '#ff4d4f' }}>
                  注意：由于系统限制，暂不支持修改邮箱选择。请联系系统管理员修改配置。
                </div>
              </Space>
            </Form.Item>
          </Form>
        </StyledCard>
        
        <StyledCard title="高级设置">
          <Form layout="vertical">
            <Form.Item
              label="重试次数"
              tooltip="任务失败后的重试次数，0表示不重试"
            >
              <Input
                type="number"
                min={0}
                value={formState.retryCount}
                onChange={(e) => handleFieldChange('retryCount', parseInt(e.target.value) || 0)}
              />
            </Form.Item>
            
            <Form.Item
              label="重试间隔(秒)"
              tooltip="任务失败后的重试间隔时间，单位为秒"
            >
              <Input
                type="number"
                min={0}
                value={formState.retryInterval}
                onChange={(e) => handleFieldChange('retryInterval', parseInt(e.target.value) || 0)}
              />
            </Form.Item>
            
            <Form.Item label="任务描述">
              <TextArea
                rows={3}
                value={formState.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                placeholder="请输入任务描述"
              />
            </Form.Item>
          </Form>
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
      </Spin>
    </PageContainer>
  );
};

export default EditEmailSyncTask;