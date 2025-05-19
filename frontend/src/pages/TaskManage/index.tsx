/**
 * 定时任务管理页面
 * 用于查看、创建、编辑和管理定时任务
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Table,
  Tag,
  Modal,
  message,
  Tabs,
  Form,
  Input,
  Select,
  InputNumber,
  Radio,
  Switch,
  Tooltip,
  Popconfirm,
  Badge,
  Drawer,
  Timeline,
  Divider,
  Empty,
  Spin,
  Row,
  Col,
  List
} from 'antd';
import {
  PlusOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  HistoryOutlined,
  CodeOutlined,
  ApiOutlined,
  RobotOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import axios from 'axios';
import api from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

// 接口定义
interface TaskDTO {
  taskName: string;
  taskKey: string;
  cronExpression: string;
  handler: {
    type: 'function' | 'http' | 'service';
    [key: string]: any;
  };
  status: 'enabled' | 'disabled' | 'deleted';
  retryCount?: number;
  retryInterval?: number;
  description?: string;
}

// 处理器类型
type HandlerType = 'function' | 'http' | 'service';

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

interface TaskExecution {
  id: number;
  task_id: number;
  task_key: string;
  status: 'running' | 'success' | 'failed' | 'canceled';
  start_time: string;
  end_time: string;
  execution_time_ms: number;
  trigger_type: 'scheduled' | 'manual';
  node_id: string;
  attempt: number;
  error_message: string;
  execution_log: string;
  created_at: string;
  updated_at: string;
}

// 样式组件
const PageContainer = styled.div`
  padding: 12px;
`;

const StyledCard = styled(Card)`
  margin-bottom: 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const ActionButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
`;

const StyledFormItem = styled(Form.Item)`
  margin-bottom: 16px;
`;

const LogContainer = styled.div`
  background-color: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  max-height: 300px;
  overflow-y: auto;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
`;

// 常量定义
const STATUS_COLORS: Record<string, string> = {
  enabled: 'success',
  disabled: 'default',
  deleted: 'error',
  running: 'processing',
  success: 'success',
  failed: 'error',
  canceled: 'warning'
};

const HANDLER_TYPE_ICONS: Record<HandlerType, React.ReactNode> = {
  function: <CodeOutlined />,
  http: <ApiOutlined />,
  service: <RobotOutlined />
};

// 主组件
const TaskManage: React.FC = () => {
  // 状态
  const [loading, setLoading] = useState<boolean>(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskExecutions, setTaskExecutions] = useState<TaskExecution[]>([]);
  const [executionHistoryLoading, setExecutionHistoryLoading] = useState<boolean>(false);
  
  // 模态框状态
  const [taskModalVisible, setTaskModalVisible] = useState<boolean>(false);
  const [taskModalMode, setTaskModalMode] = useState<'create' | 'edit'>('create');
  const [taskForm] = Form.useForm();
  
  // 执行详情抽屉状态
  const [executionDrawerVisible, setExecutionDrawerVisible] = useState<boolean>(false);
  const [selectedExecution, setSelectedExecution] = useState<TaskExecution | null>(null);
  
  // 处理器配置状态
  const [handlerType, setHandlerType] = useState<'function' | 'http' | 'service'>('function');
  
  // 初始数据加载
  useEffect(() => {
    fetchTasks();
  }, []);
  
  // 获取任务列表
  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/tasks');
      
      if (response.data.success) {
        setTasks(response.data.data || []);
      } else {
        message.error(`获取任务列表失败: ${response.data.message}`);
      }
    } catch (error: any) {
      console.error('获取任务列表失败:', error);
      message.error(`获取任务列表失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 获取任务执行历史
  const fetchTaskExecutionHistory = async (taskId: number) => {
    try {
      setExecutionHistoryLoading(true);
      const response = await axios.get(`/api/tasks/${taskId}/history`);
      
      if (response.data.success) {
        setTaskExecutions(response.data.data || []);
      } else {
        message.error(`获取任务执行历史失败: ${response.data.message}`);
      }
    } catch (error: any) {
      console.error('获取任务执行历史失败:', error);
      message.error(`获取任务执行历史失败: ${error.message}`);
    } finally {
      setExecutionHistoryLoading(false);
    }
  };
  
  // 打开任务模态框 - 创建模式
  const handleOpenCreateTaskModal = () => {
    setTaskModalMode('create');
    setTaskModalVisible(true);
    
    // 重置表单
    taskForm.resetFields();
    setHandlerType('function');
  };
  
  // 打开任务模态框 - 编辑模式
  const handleOpenEditTaskModal = (task: Task) => {
    setTaskModalMode('edit');
    setSelectedTask(task);
    setTaskModalVisible(true);
    
    // 解析处理器JSON
    const handler = JSON.parse(task.handler);
    setHandlerType(handler.type);
    
    // 设置表单初始值
    taskForm.setFieldsValue({
      taskName: task.task_name,
      taskKey: task.task_key,
      cronExpression: task.cron_expression,
      handlerType: handler.type,
      ...getHandlerFormValues(handler),
      status: task.status,
      retryCount: task.retry_count,
      retryInterval: task.retry_interval,
      description: task.description
    });
  };
  
  // 根据处理器类型获取表单值
  const getHandlerFormValues = (handler: any) => {
    switch (handler.type) {
      case 'function':
        return {
          functionName: handler.functionName,
          params: JSON.stringify(handler.params || {}, null, 2)
        };
        
      case 'http':
        return {
          httpMethod: handler.method,
          httpUrl: handler.url,
          httpHeaders: JSON.stringify(handler.headers || {}, null, 2),
          httpBody: JSON.stringify(handler.body || {}, null, 2),
          httpTimeout: handler.timeout
        };
        
      case 'service':
        return {
          serviceName: handler.serviceName,
          methodName: handler.methodName,
          serviceParams: JSON.stringify(handler.params || {}, null, 2)
        };
        
      default:
        return {};
    }
  };
  
  // 查看任务详情
  const handleViewTaskDetail = (task: Task) => {
    setSelectedTask(task);
    fetchTaskExecutionHistory(task.id);
  };
  
  // 提交任务表单
  const handleSubmitTaskForm = async (values: any) => {
    try {
      setLoading(true);
      
      // 构建处理器配置
      const handler = buildHandlerConfig(values);
      
      // 构建任务数据
      const taskData: TaskDTO = {
        taskName: values.taskName,
        taskKey: values.taskKey,
        cronExpression: values.cronExpression,
        handler,
        status: values.status,
        retryCount: values.retryCount,
        retryInterval: values.retryInterval,
        description: values.description
      };
      
      let response;
      
      if (taskModalMode === 'create') {
        response = await axios.post('/api/tasks', taskData);
      } else if (taskModalMode === 'edit' && selectedTask) {
        response = await axios.put(`/api/tasks/${selectedTask.id}`, taskData);
      }
      
      if (response && response.data.success) {
        message.success(`${taskModalMode === 'create' ? '创建' : '更新'}任务成功`);
        setTaskModalVisible(false);
        fetchTasks();
      } else {
        message.error(`${taskModalMode === 'create' ? '创建' : '更新'}任务失败: ${response?.data.message}`);
      }
    } catch (error: any) {
      console.error(`${taskModalMode === 'create' ? '创建' : '更新'}任务失败:`, error);
      message.error(`${taskModalMode === 'create' ? '创建' : '更新'}任务失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 构建处理器配置
  const buildHandlerConfig = (values: any): { type: HandlerType; [key: string]: any } => {
    switch (values.handlerType as HandlerType) {
      case 'function': {
        let params = {};
        try {
          params = JSON.parse(values.params || '{}');
        } catch (error) {
          console.error('解析参数JSON失败:', error);
        }
        
        return {
          type: 'function' as HandlerType,
          functionName: values.functionName,
          params
        };
      }
      
      case 'http': {
        let headers = {};
        try {
          headers = JSON.parse(values.httpHeaders || '{}');
        } catch (error) {
          console.error('解析请求头JSON失败:', error);
        }
        
        let body = {};
        try {
          body = JSON.parse(values.httpBody || '{}');
        } catch (error) {
          console.error('解析请求体JSON失败:', error);
        }
        
        return {
          type: 'http' as HandlerType,
          method: values.httpMethod,
          url: values.httpUrl,
          headers,
          body,
          timeout: values.httpTimeout
        };
      }
      
      case 'service': {
        let params = {};
        try {
          params = JSON.parse(values.serviceParams || '{}');
        } catch (error) {
          console.error('解析服务参数JSON失败:', error);
        }
        
        return {
          type: 'service' as HandlerType,
          serviceName: values.serviceName,
          methodName: values.methodName,
          params
        };
      }
      
      default:
        return { type: 'function' as HandlerType, functionName: '', params: {} };
    }
  };
  
  // 删除任务
  const handleDeleteTask = async (taskId: number) => {
    try {
      setLoading(true);
      
      const response = await axios.delete(`/api/tasks/${taskId}`);
      
      if (response.data.success) {
        message.success('删除任务成功');
        fetchTasks();
      } else {
        message.error(`删除任务失败: ${response.data.message}`);
      }
    } catch (error: any) {
      console.error('删除任务失败:', error);
      message.error(`删除任务失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 手动触发任务
  const handleTriggerTask = async (taskId: number) => {
    try {
      setLoading(true);
      
      const response = await axios.post(`/api/tasks/${taskId}/trigger`);
      
      if (response.data.success) {
        message.success('触发任务成功');
        
        // 如果当前正在查看该任务的执行历史，则刷新
        if (selectedTask && selectedTask.id === taskId) {
          setTimeout(() => {
            fetchTaskExecutionHistory(taskId);
          }, 1000); // 延迟1秒刷新，确保有新的执行记录
        }
      } else {
        message.error(`触发任务失败: ${response.data.message}`);
      }
    } catch (error: any) {
      console.error('触发任务失败:', error);
      message.error(`触发任务失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 查看执行详情
  const handleViewExecutionDetail = (execution: TaskExecution) => {
    setSelectedExecution(execution);
    setExecutionDrawerVisible(true);
  };
  
  // 渲染任务表格
  const renderTaskTable = () => {
    const columns = [
      {
        title: '任务名称',
        dataIndex: 'task_name',
        key: 'task_name',
        render: (text: string, record: Task) => (
          <Space>
            <a onClick={() => handleViewTaskDetail(record)}>{text}</a>
            <Tag color={STATUS_COLORS[record.status]}>
              {record.status === 'enabled' ? '已启用' : record.status === 'disabled' ? '已禁用' : '已删除'}
            </Tag>
          </Space>
        )
      },
      {
        title: '任务键',
        dataIndex: 'task_key',
        key: 'task_key'
      },
      {
        title: 'Cron表达式',
        dataIndex: 'cron_expression',
        key: 'cron_expression',
        render: (text: string) => (
          <Tag icon={<ClockCircleOutlined />} color="processing">{text}</Tag>
        )
      },
      {
        title: '处理器类型',
        key: 'handler_type',
        render: (text: string, record: Task) => {
          const handler = JSON.parse(record.handler);
          const handlerType = handler.type as HandlerType;
          return (
            <Tag icon={HANDLER_TYPE_ICONS[handlerType]} color="blue">
              {handlerType === 'function' ? '函数' : handlerType === 'http' ? 'HTTP请求' : '服务'}
            </Tag>
          );
        }
      },
      {
        title: '下次执行时间',
        dataIndex: 'next_execution_time',
        key: 'next_execution_time',
        render: (text: string) => text ? new Date(text).toLocaleString() : '-'
      },
      {
        title: '最后执行时间',
        dataIndex: 'last_execution_time',
        key: 'last_execution_time',
        render: (text: string) => text ? new Date(text).toLocaleString() : '-'
      },
      {
        title: '操作',
        key: 'action',
        render: (text: string, record: Task) => (
          <Space size="small">
            <Tooltip title="编辑">
              <Button 
                type="text" 
                icon={<EditOutlined />} 
                onClick={() => handleOpenEditTaskModal(record)} 
              />
            </Tooltip>
            
            <Tooltip title="手动触发">
              <Button 
                type="text" 
                icon={<PlayCircleOutlined />} 
                onClick={() => handleTriggerTask(record.id)}
                disabled={record.status !== 'enabled'}
              />
            </Tooltip>
            
            <Tooltip title="删除">
              <Popconfirm
                title="确定要删除该任务吗？"
                onConfirm={() => handleDeleteTask(record.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          </Space>
        )
      }
    ];
    
    return (
      <Table
        columns={columns}
        dataSource={tasks}
        rowKey="id"
        loading={loading}
        pagination={{ 
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`
        }}
      />
    );
  };
  
  // 渲染执行历史表格
  const renderExecutionHistoryTable = () => {
    const columns = [
      {
        title: '执行状态',
        dataIndex: 'status',
        key: 'status',
        render: (status: string) => {
          let icon;
          switch (status) {
            case 'running':
              icon = <SyncOutlined spin />;
              break;
            case 'success':
              icon = <CheckCircleOutlined />;
              break;
            case 'failed':
              icon = <CloseCircleOutlined />;
              break;
            case 'canceled':
              icon = <ExclamationCircleOutlined />;
              break;
            default:
              icon = <InfoCircleOutlined />;
          }
          
          return (
            <Tag icon={icon} color={STATUS_COLORS[status]}>
              {status === 'running' ? '执行中' : 
               status === 'success' ? '成功' : 
               status === 'failed' ? '失败' : 
               status === 'canceled' ? '已取消' : status}
            </Tag>
          );
        }
      },
      {
        title: '触发类型',
        dataIndex: 'trigger_type',
        key: 'trigger_type',
        render: (type: string) => (
          <Tag color={type === 'manual' ? 'purple' : 'cyan'}>
            {type === 'manual' ? '手动触发' : '定时触发'}
          </Tag>
        )
      },
      {
        title: '开始时间',
        dataIndex: 'start_time',
        key: 'start_time',
        render: (time: string) => time ? new Date(time).toLocaleString() : '-'
      },
      {
        title: '结束时间',
        dataIndex: 'end_time',
        key: 'end_time',
        render: (time: string) => time ? new Date(time).toLocaleString() : '-'
      },
      {
        title: '执行时间',
        dataIndex: 'execution_time_ms',
        key: 'execution_time_ms',
        render: (time: number) => time ? `${time} 毫秒` : '-'
      },
      {
        title: '重试次数',
        dataIndex: 'attempt',
        key: 'attempt',
        render: (attempt: number) => (
          attempt > 1 ? (
            <Badge count={attempt} style={{ backgroundColor: '#faad14' }}>
              <span>重试 {attempt - 1} 次</span>
            </Badge>
          ) : '首次执行'
        )
      },
      {
        title: '操作',
        key: 'action',
        render: (text: string, record: TaskExecution) => (
          <Space size="small">
            <Button 
              type="text" 
              icon={<InfoCircleOutlined />} 
              onClick={() => handleViewExecutionDetail(record)}
            >
              详情
            </Button>
          </Space>
        )
      }
    ];
    
    return (
      <Table
        columns={columns}
        dataSource={taskExecutions}
        rowKey="id"
        loading={executionHistoryLoading}
        pagination={{ 
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`
        }}
      />
    );
  };
  
  // 渲染任务表单
  const renderTaskForm = () => {
    return (
      <Form
        form={taskForm}
        layout="vertical"
        onFinish={handleSubmitTaskForm}
        initialValues={{
          handlerType: 'function',
          httpMethod: 'GET',
          status: 'enabled',
          retryCount: 0,
          retryInterval: 0
        }}
      >
        <StyledFormItem
          label="任务名称"
          name="taskName"
          rules={[{ required: true, message: '请输入任务名称' }]}
        >
          <Input placeholder="请输入任务名称" />
        </StyledFormItem>
        
        <StyledFormItem
          label="任务键"
          name="taskKey"
          rules={[{ required: true, message: '请输入任务键' }]}
          extra="任务键必须是唯一的，用于在系统中标识该任务"
        >
          <Input placeholder="请输入任务键" disabled={taskModalMode === 'edit'} />
        </StyledFormItem>
        
        <StyledFormItem
          label="Cron表达式"
          name="cronExpression"
          rules={[{ required: true, message: '请输入Cron表达式' }]}
          extra="例如：0 * * * * * (每分钟执行一次)"
        >
          <Input placeholder="请输入Cron表达式" />
        </StyledFormItem>
        
        <Divider orientation="left">处理器配置</Divider>
        
        <StyledFormItem
          label="处理器类型"
          name="handlerType"
          rules={[{ required: true, message: '请选择处理器类型' }]}
        >
          <Radio.Group onChange={(e) => setHandlerType(e.target.value)}>
            <Radio value="function">函数</Radio>
            <Radio value="http">HTTP请求</Radio>
            <Radio value="service">服务</Radio>
          </Radio.Group>
        </StyledFormItem>
        
        {handlerType === 'function' && (
          <>
            <StyledFormItem
              label="函数名称"
              name="functionName"
              rules={[{ required: true, message: '请输入函数名称' }]}
              extra="该函数必须通过TaskService的registerFunctionHandler方法注册"
            >
              <Input placeholder="请输入函数名称" />
            </StyledFormItem>
            
            <StyledFormItem
              label="函数参数"
              name="params"
              extra="JSON格式的函数参数"
            >
              <Input.TextArea 
                placeholder='例如：{ "key": "value" }' 
                rows={4} 
              />
            </StyledFormItem>
          </>
        )}
        
        {handlerType === 'http' && (
          <>
            <StyledFormItem
              label="请求方法"
              name="httpMethod"
              rules={[{ required: true, message: '请选择请求方法' }]}
            >
              <Select>
                <Option value="GET">GET</Option>
                <Option value="POST">POST</Option>
                <Option value="PUT">PUT</Option>
                <Option value="DELETE">DELETE</Option>
                <Option value="PATCH">PATCH</Option>
              </Select>
            </StyledFormItem>
            
            <StyledFormItem
              label="请求URL"
              name="httpUrl"
              rules={[{ required: true, message: '请输入请求URL' }]}
            >
              <Input placeholder="请输入请求URL" />
            </StyledFormItem>
            
            <StyledFormItem
              label="请求头"
              name="httpHeaders"
              extra="JSON格式的请求头"
            >
              <Input.TextArea 
                placeholder='例如：{ "Content-Type": "application/json" }'
                rows={3} 
              />
            </StyledFormItem>
            
            <StyledFormItem
              label="请求体"
              name="httpBody"
              extra="JSON格式的请求体"
            >
              <Input.TextArea 
                placeholder='例如：{ "key": "value" }'
                rows={4} 
              />
            </StyledFormItem>
            
            <StyledFormItem
              label="超时时间(毫秒)"
              name="httpTimeout"
            >
              <InputNumber min={0} placeholder="请输入超时时间" style={{ width: '100%' }} />
            </StyledFormItem>
          </>
        )}
        
        {handlerType === 'service' && (
          <>
            <StyledFormItem
              label="服务名称"
              name="serviceName"
              rules={[{ required: true, message: '请输入服务名称' }]}
            >
              <Input placeholder="请输入服务名称" />
            </StyledFormItem>
            
            <StyledFormItem
              label="方法名称"
              name="methodName"
              rules={[{ required: true, message: '请输入方法名称' }]}
            >
              <Input placeholder="请输入方法名称" />
            </StyledFormItem>
            
            <StyledFormItem
              label="方法参数"
              name="serviceParams"
              extra="JSON格式的方法参数"
            >
              <Input.TextArea 
                placeholder='例如：{ "key": "value" }'
                rows={4} 
              />
            </StyledFormItem>
          </>
        )}
        
        <Divider orientation="left">高级设置</Divider>
        
        <StyledFormItem
          label="任务状态"
          name="status"
        >
          <Radio.Group>
            <Radio value="enabled">启用</Radio>
            <Radio value="disabled">禁用</Radio>
          </Radio.Group>
        </StyledFormItem>
        
        <StyledFormItem
          label="重试次数"
          name="retryCount"
          extra="任务失败后的重试次数，0表示不重试"
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </StyledFormItem>
        
        <StyledFormItem
          label="重试间隔(秒)"
          name="retryInterval"
          extra="任务失败后的重试间隔时间，单位为秒"
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </StyledFormItem>
        
        <StyledFormItem
          label="任务描述"
          name="description"
        >
          <Input.TextArea placeholder="请输入任务描述" rows={3} />
        </StyledFormItem>
      </Form>
    );
  };
  
  // 渲染任务详情视图
  const renderTaskDetailView = () => {
    if (!selectedTask) {
      return (
        <Empty description="请选择一个任务查看详情" />
      );
    }
    
    // 解析处理器配置
    const handler = JSON.parse(selectedTask.handler);
    
    return (
      <Spin spinning={executionHistoryLoading}>
        <Tabs>
          <TabPane tab="基本信息" key="basic">
            <StyledCard>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Title level={4}>{selectedTask.task_name}</Title>
                  <Tag color={STATUS_COLORS[selectedTask.status]}>
                    {selectedTask.status === 'enabled' ? '已启用' : selectedTask.status === 'disabled' ? '已禁用' : '已删除'}
                  </Tag>
                </Col>
                
                <Col span={12}>
                  <Text strong>任务键：</Text> {selectedTask.task_key}
                </Col>
                <Col span={12}>
                  <Text strong>Cron表达式：</Text> <Tag color="processing">{selectedTask.cron_expression}</Tag>
                </Col>
                
                <Col span={12}>
                  <Text strong>创建时间：</Text> {new Date(selectedTask.created_at).toLocaleString()}
                </Col>
                <Col span={12}>
                  <Text strong>最后更新：</Text> {new Date(selectedTask.updated_at).toLocaleString()}
                </Col>
                
                <Col span={12}>
                  <Text strong>下次执行时间：</Text> {selectedTask.next_execution_time ? new Date(selectedTask.next_execution_time).toLocaleString() : '未知'}
                </Col>
                <Col span={12}>
                  <Text strong>最后执行时间：</Text> {selectedTask.last_execution_time ? new Date(selectedTask.last_execution_time).toLocaleString() : '未执行'}
                </Col>
                
                <Col span={12}>
                  <Text strong>失败重试次数：</Text> {selectedTask.retry_count}
                </Col>
                <Col span={12}>
                  <Text strong>重试间隔时间：</Text> {selectedTask.retry_interval} 秒
                </Col>
                
                <Col span={24}>
                  <Text strong>描述：</Text> {selectedTask.description || '无'}
                </Col>
              </Row>
            </StyledCard>
            
            <StyledCard title="处理器配置">
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <Tag icon={HANDLER_TYPE_ICONS[handler.type as HandlerType]} color="blue">
                    {handler.type === 'function' ? '函数处理器' : handler.type === 'http' ? 'HTTP请求处理器' : '服务处理器'}
                  </Tag>
                </Col>
                
                {handler.type === 'function' && (
                  <>
                    <Col span={24}>
                      <Text strong>函数名称：</Text> {handler.functionName}
                    </Col>
                    <Col span={24}>
                      <Text strong>函数参数：</Text>
                      <pre>{JSON.stringify(handler.params || {}, null, 2)}</pre>
                    </Col>
                  </>
                )}
                
                {handler.type === 'http' && (
                  <>
                    <Col span={12}>
                      <Text strong>请求方法：</Text> {handler.method}
                    </Col>
                    <Col span={12}>
                      <Text strong>超时时间：</Text> {handler.timeout || '默认'} 毫秒
                    </Col>
                    <Col span={24}>
                      <Text strong>请求URL：</Text> {handler.url}
                    </Col>
                    <Col span={24}>
                      <Text strong>请求头：</Text>
                      <pre>{JSON.stringify(handler.headers || {}, null, 2)}</pre>
                    </Col>
                    <Col span={24}>
                      <Text strong>请求体：</Text>
                      <pre>{JSON.stringify(handler.body || {}, null, 2)}</pre>
                    </Col>
                  </>
                )}
                
                {handler.type === 'service' && (
                  <>
                    <Col span={12}>
                      <Text strong>服务名称：</Text> {handler.serviceName}
                    </Col>
                    <Col span={12}>
                      <Text strong>方法名称：</Text> {handler.methodName}
                    </Col>
                    <Col span={24}>
                      <Text strong>方法参数：</Text>
                      <pre>{JSON.stringify(handler.params || {}, null, 2)}</pre>
                    </Col>
                  </>
                )}
              </Row>
            </StyledCard>
            
            <Space style={{ marginTop: 16 }}>
              <Button 
                type="primary" 
                icon={<EditOutlined />} 
                onClick={() => handleOpenEditTaskModal(selectedTask)}
              >
                编辑任务
              </Button>
              
              <Button 
                icon={<PlayCircleOutlined />} 
                onClick={() => handleTriggerTask(selectedTask.id)}
                disabled={selectedTask.status !== 'enabled'}
              >
                手动触发
              </Button>
              
              <Popconfirm
                title="确定要删除该任务吗？"
                onConfirm={() => handleDeleteTask(selectedTask.id)}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<DeleteOutlined />}>
                  删除任务
                </Button>
              </Popconfirm>
            </Space>
          </TabPane>
          
          <TabPane tab="执行历史" key="history">
            {renderExecutionHistoryTable()}
          </TabPane>
        </Tabs>
      </Spin>
    );
  };
  
  return (
    <PageContainer>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <StyledCard>
            <Title level={4}>定时任务管理</Title>
            <Paragraph>
              管理系统中的定时任务，您可以创建、编辑和删除任务，查看任务执行历史，以及手动触发任务执行。
            </Paragraph>
            
            <ActionButtonGroup>
              <Button 
                type="primary" 
                icon={<PlusOutlined />} 
                onClick={handleOpenCreateTaskModal}
              >
                创建任务
              </Button>
            </ActionButtonGroup>
            
            {renderTaskTable()}
          </StyledCard>
        </Col>
        
        <Col span={24}>
          <StyledCard>
            <Title level={4}>任务详情</Title>
            
            {renderTaskDetailView()}
          </StyledCard>
        </Col>
      </Row>
      
      {/* 任务表单模态框 */}
      <Modal
        title={`${taskModalMode === 'create' ? '创建' : '编辑'}任务`}
        visible={taskModalVisible}
        onCancel={() => setTaskModalVisible(false)}
        onOk={() => taskForm.submit()}
        width={700}
        confirmLoading={loading}
      >
        {renderTaskForm()}
      </Modal>
      
      {/* 执行详情抽屉 */}
      <Drawer
        title="执行详情"
        placement="right"
        width={600}
        onClose={() => setExecutionDrawerVisible(false)}
        visible={executionDrawerVisible}
      >
        {selectedExecution && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text strong>执行ID：</Text> {selectedExecution.id}
              </Col>
              <Col span={12}>
                <Text strong>执行状态：</Text> 
                <Tag color={STATUS_COLORS[selectedExecution.status]}>
                  {selectedExecution.status === 'running' ? '执行中' : 
                   selectedExecution.status === 'success' ? '成功' : 
                   selectedExecution.status === 'failed' ? '失败' : 
                   selectedExecution.status === 'canceled' ? '已取消' : selectedExecution.status}
                </Tag>
              </Col>
              
              <Col span={12}>
                <Text strong>触发类型：</Text> 
                <Tag color={selectedExecution.trigger_type === 'manual' ? 'purple' : 'cyan'}>
                  {selectedExecution.trigger_type === 'manual' ? '手动触发' : '定时触发'}
                </Tag>
              </Col>
              <Col span={12}>
                <Text strong>尝试次数：</Text> {selectedExecution.attempt}
              </Col>
              
              <Col span={12}>
                <Text strong>开始时间：</Text> {new Date(selectedExecution.start_time).toLocaleString()}
              </Col>
              <Col span={12}>
                <Text strong>结束时间：</Text> {selectedExecution.end_time ? new Date(selectedExecution.end_time).toLocaleString() : '-'}
              </Col>
              
              <Col span={12}>
                <Text strong>执行时间：</Text> {selectedExecution.execution_time_ms ? `${selectedExecution.execution_time_ms} 毫秒` : '-'}
              </Col>
              <Col span={12}>
                <Text strong>节点ID：</Text> {selectedExecution.node_id}
              </Col>
              
              {selectedExecution.error_message && (
                <Col span={24}>
                  <Text strong style={{ color: '#f5222d' }}>错误信息：</Text>
                  <div style={{ color: '#f5222d', marginTop: 8 }}>
                    {selectedExecution.error_message}
                  </div>
                </Col>
              )}
              
              <Col span={24}>
                <Divider orientation="left">执行日志</Divider>
                {selectedExecution.execution_log ? (
                  <LogContainer>
                    {selectedExecution.execution_log.split('\n').map((line, index) => (
                      <div key={index}>{line}</div>
                    ))}
                  </LogContainer>
                ) : (
                  <Empty description="无执行日志" />
                )}
              </Col>
            </Row>
          </div>
        )}
      </Drawer>
    </PageContainer>
  );
};

export default TaskManage;