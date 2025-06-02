/**
 * 邮件同步任务编辑页面
 * 专门用于编辑内置邮件同步任务的邮箱选择和cron表达式
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Space, 
  Typography, 
  message, 
  Spin,
  Alert,
  Divider,
  Transfer,
  Tag
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, MailOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { emailAccountApi, taskApi } from '../../services/api';
// 暂时注释，避免渲染循环
// import CronExpressionBuilder from '../../components/CronExpressionBuilder';

const { Title, Text } = Typography;

// 定义任务类型接口
interface Task {
  id: number;
  task_name: string;
  task_key: string;
  cron_expression: string;
  description: string;
  handler: any;
  status: 'enabled' | 'disabled';
  retry_count: number;
  retry_interval: number;
}

// 定义邮箱账户接口
interface EmailAccount {
  id: number;
  name: string;
  email: string;
  status: string;
}

// 为Transfer组件定义邮箱账户项接口
interface EmailAccountItem {
  key: string;
  title: string;
  description: string;
  disabled: boolean;
}

// 邮件同步任务编辑页面
const EditEmailSyncTask: React.FC = () => {
  // 获取路由参数
  const { taskId } = useParams<{ taskId?: string }>();
  const navigate = useNavigate();
  
  // 状态
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [taskDetail, setTaskDetail] = useState<Task | null>(null);
  const [cronExpression, setCronExpression] = useState<string>('');
  
  // 为Transfer组件准备数据源
  const emailAccountItems = useMemo(() => {
    return emailAccounts.map(account => ({
      key: account.id.toString(),
      title: account.name,
      description: account.email,
      disabled: account.status !== 'active'
    }));
  }, [emailAccounts]);
  
  // 邮箱账户数据加载
  const fetchEmailAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await emailAccountApi.getAllEmailAccounts();
      if (response.success && response.data) {
        setEmailAccounts(response.data);
      } else {
        message.error(response.message || '获取邮箱账户失败');
      }
    } catch (error: any) {
      message.error(error.message || '获取邮箱账户失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 任务数据加载
  const fetchTaskDetail = useCallback(async () => {
    if (!taskId) return;
    
    try {
      setLoading(true);
      const response = await taskApi.getTasks();
      
      if (response.success) {
        // 查找指定ID的任务
        const task = Array.isArray(response.data) 
          ? response.data.find((t: Task) => t.id === parseInt(taskId, 10))
          : (response.data?.tasks?.find((t: Task) => t.id === parseInt(taskId, 10)) || null);
        
        if (task) {
          setTaskDetail(task);
          
          // 解析handler参数
          try {
            const handler = typeof task.handler === 'string' 
              ? JSON.parse(task.handler) 
              : task.handler;
            
            // 提取accountIds并转换为字符串数组
            const accountIds = handler?.params?.accountIds || [];
            setSelectedAccountIds(accountIds.map((id: number) => id.toString()));
            
            // 设置cron表达式
            setCronExpression(task.cron_expression);
          } catch (e) {
            console.error('解析任务handler失败:', e);
            message.error('解析任务配置失败');
          }
        } else {
          message.error('未找到指定任务');
        }
      }
    } catch (error: any) {
      message.error(error.message || '获取任务详情失败');
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // 初始数据加载
  useEffect(() => {
    // 单独处理每个API调用，避免依赖关系导致的渲染循环
    fetchEmailAccounts();
    fetchTaskDetail();
  }, [fetchEmailAccounts, fetchTaskDetail]);

  // 处理Transfer组件的变化
  const handleTransferChange = useCallback((targetKeys: any[], direction: string, moveKeys: any[]) => {
    // 只关注targetKeys参数，忽略direction和moveKeys
    setSelectedAccountIds(targetKeys as string[]);
  }, []);

  // 保存配置
  const handleSubmit = useCallback(async () => {
    if (!taskId) {
      message.error('任务ID不存在');
      return;
    }
    
    try {
      setSaving(true);
      
      // 将字符串ID转换为数字ID
      const numericIds = selectedAccountIds.map(id => parseInt(id, 10));
      
      // 使用API方法更新邮箱配置和cron表达式
      const response = await taskApi.updateEmailSyncTaskConfig(
        taskId,
        numericIds,
        cronExpression
      );
      
      if (response.success) {
        message.success('任务配置更新成功');
        // 返回到任务列表页
        navigate('/task-manage');
      } else {
        message.error(response.message || '更新任务配置失败');
      }
    } catch (error: any) {
      message.error(error.message || '更新任务配置失败');
    } finally {
      setSaving(false);
    }
  }, [taskId, selectedAccountIds, cronExpression, navigate]);

  // 返回任务列表页
  const handleGoBack = useCallback(() => {
    navigate('/task-manage');
  }, [navigate]);

  // 自定义渲染Transfer中的列表项
  const renderItem = useCallback((item: EmailAccountItem) => {
    return {
      label: (
        <span>
          <Tag color="blue">{item.title}</Tag> {item.description}
        </span>
      ),
      value: item.key,
    };
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <Card 
        title={
          <Space>
            <Button 
              icon={<ArrowLeftOutlined />} 
              onClick={handleGoBack}
              type="text"
            />
            <Title level={4} style={{ margin: 0 }}>
              <MailOutlined /> 编辑邮件同步任务
            </Title>
          </Space>
        }
        extra={
          <Button 
            type="primary" 
            icon={<SaveOutlined />} 
            onClick={handleSubmit}
            loading={saving}
          >
            保存配置
          </Button>
        }
        style={{ marginBottom: '20px' }}
      >
        <Spin spinning={loading}>
          {taskDetail ? (
            <div>
              <Form layout="vertical">
                <Form.Item label="任务名称">
                  <Input value={taskDetail.task_name} disabled />
                </Form.Item>
                
                <Form.Item label="任务键">
                  <Input value={taskDetail.task_key} disabled />
                </Form.Item>
                
                <Form.Item 
                  label={
                    <Space>
                      <ClockCircleOutlined />
                      <Text>Cron表达式</Text>
                      <Text type="secondary">（定时任务的执行周期）</Text>
                    </Space>
                  }
                >
                  {/* 临时使用Input代替CronExpressionBuilder，避免渲染循环问题 */}
                  {/* 后续可以全面重构解决此问题 */}
                  <Input
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    placeholder="请输入Cron表达式，例如: 0 0 * * *"
                  />
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    示例: 0 0 * * * (每天午夜执行), */10 * * * * (每10分钟执行一次)
                  </div>
                </Form.Item>
                
                <Divider />
                
                <Form.Item 
                  label={
                    <Space>
                      <Text>选择邮箱账户</Text>
                      <Text type="secondary">（选择需要同步的邮箱账户，不选择则同步所有有效账户）</Text>
                    </Space>
                  }
                >
                  <div style={{ marginBottom: '16px' }}>
                    {/* 使用穿梭框组件，以列表形式展示邮箱账户 */}
                    <Transfer
                      dataSource={emailAccountItems}
                      titles={['可选邮箱账户', '已选邮箱账户']}
                      targetKeys={selectedAccountIds}
                      onChange={handleTransferChange}
                      render={item => `${item.title} (${item.description})`}
                      listStyle={{
                        width: '45%',
                        height: 300,
                      }}
                      operations={['选择', '移除']}
                      showSearch
                      filterOption={(inputValue, item) => 
                        item.title.indexOf(inputValue) > -1 || 
                        item.description.indexOf(inputValue) > -1
                      }
                      showSelectAll
                    />
                  </div>
                  
                  <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                    {selectedAccountIds.length > 0 ? 
                      `已选择 ${selectedAccountIds.length} 个邮箱账户` : 
                      '未选择任何邮箱账户，将同步所有有效的邮箱账户'
                    }
                  </div>
                </Form.Item>
                
                <Form.Item label="描述">
                  <Input.TextArea 
                    value={taskDetail.description} 
                    rows={2}
                    disabled
                  />
                </Form.Item>
              </Form>
            </div>
          ) : (
            <Alert
              message="加载中..."
              description="正在获取任务详情"
              type="info"
            />
          )}
        </Spin>
      </Card>
    </div>
  );
};

export default EditEmailSyncTask;