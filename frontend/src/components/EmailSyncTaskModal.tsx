/**
 * 邮件同步任务编辑模态框
 * 用于编辑内置邮件同步定时任务的专用模态框组件
 * 独立于通用任务表单，避免状态循环更新问题
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  SaveOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { emailAccountApi, taskApi } from '../services/api';
import CronExpressionBuilder from './CronExpressionBuilder';

const { Text } = Typography;
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

// 与TaskManage组件中相同的Task接口定义
interface Task {
  id: number;
  task_name: string;
  task_key: string;
  cron_expression: string;
  handler: string;
  status: 'enabled' | 'disabled' | 'deleted';
  retry_count: number;
  retry_interval: number;
  description: string;
  next_execution_time: string;
  last_execution_time: string;
  created_at: string;
  updated_at: string;
}

interface EmailSyncTaskModalProps {
  visible: boolean;
  task?: Task | null; // 允许传入Task类型或null
  onClose: () => void;
  onSuccess: () => void;
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

// 解析任务处理器
const parseTaskHandler = (task: Task | null | undefined) => {
  if (!task) return null;
  
  try {
    const handlerObj = typeof task.handler === 'string' ? 
      JSON.parse(task.handler) : task.handler;
    
    // 验证处理器结构
    if (typeof handlerObj !== 'object' || !handlerObj) {
      return null;
    }
    
    return handlerObj;
  } catch (error) {
    console.error('解析任务处理器失败:', error);
    return null;
  }
};

/**
 * 邮件同步任务编辑模态框组件
 */
const EmailSyncTaskModal: React.FC<EmailSyncTaskModalProps> = ({
  visible,
  task,
  onClose,
  onSuccess
}) => {
  // 表单实例
  const [form] = Form.useForm();
  
  // 状态
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [cronExpression, setCronExpression] = useState<string>('*/5 * * * *');
  const [syncParams, setSyncParams] = useState<EmailSyncParams>({
    accountIds: [],
    syncType: 'incremental',
    mailboxes: ['INBOX'],
    startDate: undefined,
    endDate: undefined
  });
  
  // 获取默认值
  const defaultValues = useMemo(() => {
    if (!task) {
      return {
        taskName: '内置邮件增量同步',
        description: '定时同步邮箱中的邮件',
        status: 'enabled',
        retryCount: 0,
        retryInterval: 0
      };
    }
    
    return {
      taskName: task.task_name,
      description: task.description,
      status: task.status,
      retryCount: task.retry_count,
      retryInterval: task.retry_interval
    };
  }, [task]);
  
  // 初始化表单和状态 - 使用惰性初始化避免重复设置
  const initFormAndState = useCallback(() => {
    if (!visible) return;
    
    // 重置表单
    form.setFieldsValue(defaultValues);
    
    // 初始化Cron表达式
    if (task) {
      setCronExpression(task.cron_expression);
    } else {
      setCronExpression('*/5 * * * *');
    }
    
    // 解析处理器参数
    if (task) {
      const handler = parseTaskHandler(task);
      if (handler && handler.params) {
        const params = handler.params;
        
        // 使用函数式更新，一次性设置所有参数，避免多次渲染
        setSyncParams({
          accountIds: Array.isArray(params.accountIds) ? params.accountIds : [],
          syncType: params.syncType === 'full' ? 'full' : 'incremental',
          mailboxes: Array.isArray(params.mailboxes) ? params.mailboxes : ['INBOX'],
          startDate: params.startDate,
          endDate: params.endDate
        });
      }
    } else {
      // 新建任务时的默认值
      setSyncParams({
        accountIds: [],
        syncType: 'incremental',
        mailboxes: ['INBOX'],
        startDate: undefined,
        endDate: undefined
      });
    }
  }, [visible, task, form, defaultValues]);
  
  // 加载邮箱账户列表
  const fetchEmailAccounts = useCallback(async () => {
    if (!visible) return;
    
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
  }, [visible]);
  
  // 初始化逻辑 - 使用单一useEffect管理所有初始化操作
  useEffect(() => {
    // 当模态框打开时，执行初始化操作
    if (visible) {
      // 使用setTimeout延迟初始化，避免React状态更新冲突
      const timerId = setTimeout(() => {
        fetchEmailAccounts();
        initFormAndState();
      }, 0);
      
      return () => clearTimeout(timerId);
    }
  }, [visible, fetchEmailAccounts, initFormAndState]);
  
  // 处理选择全部邮箱
  const handleSelectAllAccounts = useCallback(() => {
    setSyncParams(prev => ({
      ...prev,
      accountIds: emailAccounts.map(account => account.id)
    }));
  }, [emailAccounts]);
  
  // 处理清除所有选择
  const handleClearAllAccounts = useCallback(() => {
    setSyncParams(prev => ({
      ...prev,
      accountIds: []
    }));
  }, []);
  
  // 处理账户选择变化
  const handleAccountIdsChange = useCallback((values: number[]) => {
    setSyncParams(prev => ({
      ...prev,
      accountIds: values
    }));
  }, []);
  
  // 处理同步类型变化
  const handleSyncTypeChange = useCallback((e: any) => {
    setSyncParams(prev => ({
      ...prev,
      syncType: e.target.value
    }));
  }, []);
  
  // 处理邮箱文件夹变化
  const handleMailboxesChange = useCallback((values: any) => {
    setSyncParams(prev => ({
      ...prev,
      mailboxes: values
    }));
  }, []);
  
  // 处理日期范围变化
  const handleDateRangeChange = useCallback((dates: any, dateStrings: [string, string]) => {
    setSyncParams(prev => ({
      ...prev,
      startDate: dateStrings[0] || undefined,
      endDate: dateStrings[1] || undefined
    }));
  }, []);
  
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
        status: (formValues.status || 'enabled') as 'enabled' | 'disabled',
        retryCount: Number(formValues.retryCount) || 0,
        retryInterval: Number(formValues.retryInterval) || 0
      };
      
      setSaving(true);
      
      let response;
      if (task && task.id) {
        // 更新任务
        response = await taskApi.updateTask(task.id.toString(), taskData);
      } else {
        // 创建任务
        response = await taskApi.createTask(taskData);
      }
      
      if (response && response.success) {
        message.success(`${task ? '更新' : '创建'}邮件同步任务成功`);
        onSuccess();
      } else {
        message.error(`${task ? '更新' : '创建'}邮件同步任务失败: ${response?.message || '未知错误'}`);
      }
    } catch (error: any) {
      console.error('提交表单失败:', error);
      message.error(`提交表单失败: ${error.message || '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };
  
  // 渲染模态框内容
  const renderModalContent = () => {
    return (
      <Form
        form={form}
        layout="vertical"
        initialValues={defaultValues}
      >
        {/* 基本信息 */}
        <StyledCard>
          <Form.Item
            label="任务名称"
            name="taskName"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="请输入任务名称" />
          </Form.Item>
          
          <Form.Item
            label="任务描述"
            name="description"
          >
            <Input.TextArea
              placeholder="请输入任务描述"
              rows={2}
            />
          </Form.Item>
          
          <Form.Item label="Cron表达式">
            <CronExpressionBuilder
              value={cronExpression}
              onChange={(value) => {
                if (value !== cronExpression) {
                  setCronExpression(value);
                }
              }}
            />
          </Form.Item>
        </StyledCard>
        
        {/* 邮箱账户选择 */}
        <StyledCard
          title={
            <Space>
              <MailOutlined />
              <span>选择邮箱账户</span>
              <Tooltip title="选择需要同步邮件的邮箱账户">
                <QuestionCircleOutlined style={{ color: '#999' }} />
              </Tooltip>
            </Space>
          }
          extra={
            <Space>
              <Button 
                size="small" 
                onClick={handleSelectAllAccounts}
                disabled={loading || emailAccounts.length === 0}
              >
                全选
              </Button>
              <Button 
                size="small" 
                onClick={handleClearAllAccounts}
                disabled={loading || syncParams.accountIds.length === 0}
              >
                清空
              </Button>
              <Button 
                size="small"
                type="primary" 
                icon={<SyncOutlined />} 
                onClick={fetchEmailAccounts}
                loading={loading}
              >
                刷新
              </Button>
            </Space>
          }
        >
          <Spin spinning={loading}>
            {emailAccounts.length === 0 ? (
              <Alert
                message="没有找到可用的邮箱账户"
                description="请先添加并验证邮箱账户，然后再配置邮件同步任务"
                type="warning"
                showIcon
              />
            ) : (
              <>
                <FormLabel>
                  请选择需要同步邮件的邮箱账户（可多选）：
                </FormLabel>
                <Select
                  mode="multiple"
                  placeholder="请选择邮箱账户"
                  value={syncParams.accountIds}
                  onChange={handleAccountIdsChange}
                  style={{ width: '100%' }}
                  optionFilterProp="children"
                  allowClear
                >
                  {emailAccounts.map((account) => (
                    <Option key={account.id} value={account.id}>
                      {account.name} ({account.email})
                      {account.is_default === 1 && " (默认)"}
                    </Option>
                  ))}
                </Select>
                
                <div style={{ marginTop: 8, color: '#999' }}>
                  已选择 {syncParams.accountIds.length} 个邮箱账户
                  {syncParams.accountIds.length === 0 && (
                    <Text type="warning"> (未选择任何账户时，将同步所有激活的邮箱账户)</Text>
                  )}
                </div>
              </>
            )}
          </Spin>
        </StyledCard>

        {/* 同步参数配置 */}
        <StyledCard
          title={
            <Space>
              <SyncOutlined />
              <span>同步参数配置</span>
              <Tooltip title="配置邮件同步的详细参数">
                <QuestionCircleOutlined style={{ color: '#999' }} />
              </Tooltip>
            </Space>
          }
        >
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <FormLabel>同步类型：</FormLabel>
              <Radio.Group
                value={syncParams.syncType}
                onChange={handleSyncTypeChange}
              >
                <Radio value="incremental">
                  <Space>
                    <span>增量同步</span>
                    <Tooltip title="只同步上次同步后的新邮件，更节省资源">
                      <InfoCircleOutlined style={{ color: '#1890ff' }} />
                    </Tooltip>
                  </Space>
                </Radio>
                <Radio value="full">
                  <Space>
                    <span>全量同步</span>
                    <Tooltip title="同步指定日期范围内的所有邮件，较消耗资源">
                      <InfoCircleOutlined style={{ color: '#faad14' }} />
                    </Tooltip>
                  </Space>
                </Radio>
              </Radio.Group>
            </Col>

            <Col span={24}>
              <FormLabel>邮箱文件夹：</FormLabel>
              <Checkbox.Group
                value={syncParams.mailboxes}
                onChange={handleMailboxesChange}
                style={{ width: '100%' }}
              >
                <Row gutter={[16, 8]}>
                  {availableMailboxes.map((mailbox) => (
                    <Col span={8} key={mailbox.value}>
                      <Checkbox value={mailbox.value}>{mailbox.label}</Checkbox>
                    </Col>
                  ))}
                </Row>
              </Checkbox.Group>
              <div style={{ marginTop: 4, color: '#999' }}>
                至少选择一个邮箱文件夹 (默认为"收件箱")
              </div>
            </Col>

            {syncParams.syncType === 'full' && (
              <Col span={24}>
                <FormLabel>
                  <Space>
                    <CalendarOutlined />
                    <span>日期范围：</span>
                    <Tooltip title="仅在全量同步模式下有效，留空表示不限制">
                      <QuestionCircleOutlined style={{ color: '#999' }} />
                    </Tooltip>
                  </Space>
                </FormLabel>
                <RangePicker
                  style={{ width: '100%' }}
                  placeholder={['开始日期', '结束日期']}
                  onChange={handleDateRangeChange}
                />
                <div style={{ color: '#999', marginTop: 4 }}>
                  不设置日期范围则默认同步最近一个月的邮件
                </div>
              </Col>
            )}
          </Row>
        </StyledCard>

        {/* 高级设置 */}
        <StyledCard
          title={
            <Space>
              <InfoCircleOutlined />
              <span>高级设置</span>
            </Space>
          }
        >
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Form.Item
                label="任务状态"
                name="status"
              >
                <Radio.Group>
                  <Radio value="enabled">启用</Radio>
                  <Radio value="disabled">禁用</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item
                label="重试次数"
                name="retryCount"
                extra="任务失败后的重试次数，0表示不重试"
              >
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
            
            <Col span={12}>
              <Form.Item
                label="重试间隔(秒)"
                name="retryInterval"
                extra="任务失败后的重试间隔时间，单位为秒"
              >
                <Input type="number" min={0} />
              </Form.Item>
            </Col>
          </Row>
        </StyledCard>

        {/* 说明信息 */}
        <Alert
          message="邮件同步说明"
          description={
            <div>
              <p>
                <strong>增量同步：</strong> 只同步上次同步以来的新邮件，适合日常使用。
              </p>
              <p>
                <strong>全量同步：</strong> 同步指定日期范围内的所有邮件，会消耗更多资源。
              </p>
              <p>
                定时任务执行时，将按照您的配置对选定的邮箱账户进行邮件同步操作。每个邮箱将按顺序处理，同步结果将记录在系统日志中。
              </p>
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      </Form>
    );
  };
  
  return (
    <Modal
      title={`${task ? '编辑' : '创建'}内置邮件同步任务`}
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<SaveOutlined />}
          loading={saving}
          onClick={handleSubmit}
        >
          保存
        </Button>
      ]}
      maskClosable={false}
      destroyOnClose={true}
    >
      {renderModalContent()}
    </Modal>
  );
};

// 使用React.memo包装组件以避免不必要的重渲染
export default React.memo(EmailSyncTaskModal);