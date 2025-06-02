/**
 * 邮件同步任务编辑模态框
 * 采用基于ID的数据获取模式，避免循环渲染问题
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  Radio,
  Checkbox,
  DatePicker,
  Input,
  Row,
  Col,
  Card,
  Typography,
  Divider,
  Button,
  Space,
  Alert,
  Tooltip,
  message,
  Spin
} from 'antd';
import {
  MailOutlined,
  SyncOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  FilterOutlined,
  QuestionCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { emailAccountApi, taskApi } from '../services/api';
import CronExpressionBuilder from './CronExpressionBuilder';
import moment from 'moment';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// 样式组件
const StyledCard = styled(Card)`
  margin-bottom: 16px;
  border-radius: 6px;
`;

const FormLabel = styled(Text)`
  display: inline-block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
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
 * 邮件同步任务编辑模态框组件
 * 采用基于ID的数据获取模式，避免循环渲染
 */
interface EmailSyncTaskModalProps {
  visible: boolean;
  taskId?: number | null; // 仅传递任务ID，其他数据通过API获取
  onClose: () => void;
  onSuccess: () => void;
}

const EmailSyncTaskModal: React.FC<EmailSyncTaskModalProps> = ({
  visible,
  taskId,
  onClose,
  onSuccess
}) => {
  // 表单实例
  const [form] = Form.useForm();
  
  // 状态
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [taskLoading, setTaskLoading] = useState<boolean>(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [cronExpression, setCronExpression] = useState<string>('*/5 * * * *');
  const [syncParams, setSyncParams] = useState<EmailSyncParams>({
    accountIds: [],
    syncType: 'incremental',
    mailboxes: ['INBOX'],
    startDate: undefined,
    endDate: undefined
  });
  
  // 任务详情状态 - 从API获取，而不是通过props传递
  const [taskDetail, setTaskDetail] = useState<any>(null);
  
  // 加载邮箱账户列表
  const fetchEmailAccounts = async () => {
    try {
      setLoading(true);
      const response = await emailAccountApi.getAllEmailAccounts();
      
      if (response.success) {
        // 过滤出激活状态的邮箱账户
        const activeAccounts = (response.data || []).filter(
          (account: EmailAccount) => account.status === 'active'
        );
        setEmailAccounts(activeAccounts);
      } else {
        message.error(response.message || '获取邮箱账户失败');
      }
    } catch (error: any) {
      console.error('获取邮箱账户失败:', error);
      message.error(error.message || '获取邮箱账户失败');
    } finally {
      setLoading(false);
    }
  };
  
  // 加载任务详情 - 根据ID从API获取
  const fetchTaskDetail = async (id: number) => {
    try {
      setTaskLoading(true);
      const response = await taskApi.getTask(id.toString());
      
      if (response.success) {
        setTaskDetail(response.data);
        initFormData(response.data);
      } else {
        message.error(response.message || '获取任务详情失败');
      }
    } catch (error: any) {
      console.error('获取任务详情失败:', error);
      message.error(error.message || '获取任务详情失败');
    } finally {
      setTaskLoading(false);
    }
  };
  
  // 解析任务数据，初始化表单
  const initFormData = (task: any) => {
    if (!task) return;
    
    try {
      // 重置表单
      form.resetFields();
      
      // 解析处理器JSON
      const handlerObj = typeof task.handler === 'string' ? 
        JSON.parse(task.handler) : task.handler;
      
      // 解析处理器参数
      const params = handlerObj.params || {};
      
      // 设置同步参数
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
      
      // 设置Cron表达式
      setCronExpression(task.cron_expression);
      
      // 设置同步参数
      setSyncParams(initialParams);
    } catch (error) {
      console.error('解析任务数据失败:', error);
      message.error('解析任务数据失败，请重试');
    }
  };
  
  // 当模态框显示且有任务ID时，加载任务详情
  useEffect(() => {
    if (visible) {
      // 无论是否有任务ID，都加载邮箱账户列表
      fetchEmailAccounts();
      
      if (taskId) {
        // 如果有任务ID，加载任务详情
        fetchTaskDetail(taskId);
      } else {
        // 如果没有任务ID，重置表单和状态（创建模式）
        setTaskDetail(null);
        form.resetFields();
        setCronExpression('*/5 * * * *');
        setSyncParams({
          accountIds: [],
          syncType: 'incremental',
          mailboxes: ['INBOX'],
          startDate: undefined,
          endDate: undefined
        });
      }
    }
  }, [visible, taskId]);
  
  // 处理选择全部邮箱
  const handleSelectAllAccounts = () => {
    const allAccountIds = emailAccounts.map((account) => account.id);
    setSyncParams({...syncParams, accountIds: allAccountIds});
  };
  
  // 处理清除所有选择
  const handleClearAllAccounts = () => {
    setSyncParams({...syncParams, accountIds: []});
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
          type: 'function',
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
        response = await taskApi.updateTask(taskId.toString(), taskData);
      } else {
        // 创建任务
        response = await taskApi.createTask(taskData);
      }
      
      if (response && response.success) {
        message.success(`${taskId ? '更新' : '创建'}邮件同步任务成功`);
        onSuccess();
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
  
  // 渲染表单
  const renderForm = () => {
    const isIncrementalSync = syncParams.syncType === 'incremental';
    
    return (
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
              {isIncrementalSync ? 
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
          
          {!isIncrementalSync && (
            <Form.Item label="日期范围">
              <RangePicker
                value={
                  syncParams.startDate && syncParams.endDate ?
                  [moment(syncParams.startDate), moment(syncParams.endDate)] :
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
      </Form>
    );
  };
  
  return (
    <Modal
      title={`${taskId ? '编辑' : '创建'}邮件同步任务`}
      open={visible}
      width={700}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          loading={saving}
          onClick={handleSubmit}
        >
          保存
        </Button>
      ]}
      destroyOnClose={true}
    >
      <Spin spinning={taskLoading}>
        {renderForm()}
      </Spin>
    </Modal>
  );
};

export default EmailSyncTaskModal;