/**
 * 邮件同步任务编辑页面
 * 简化版本，专门用于编辑内置邮件同步任务的邮箱选择
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Form, 
  Input, 
  Button, 
  Select, 
  Space, 
  Typography, 
  message, 
  Spin,
  Alert
} from 'antd';
import { ArrowLeftOutlined, SaveOutlined, MailOutlined } from '@ant-design/icons';
import { emailAccountApi, taskApi } from '../../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

// 邮件同步任务编辑页面
const EditEmailSyncTask: React.FC = () => {
  // 获取路由参数
  const { taskId } = useParams<{ taskId?: string }>();
  const navigate = useNavigate();
  
  // 状态
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<number[]>([]);
  const [taskDetail, setTaskDetail] = useState<any>(null);
  
  // 邮箱账户数据加载
  const fetchEmailAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await emailAccountApi.getAllEmailAccounts();
      if (response.success && response.data) {
        // 过滤出激活状态的邮箱账户
        const activeAccounts = response.data.filter(
          (account: any) => account.status === 'active'
        );
        setEmailAccounts(activeAccounts);
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
          ? response.data.find(t => t.id === parseInt(taskId, 10))
          : (response.data?.tasks?.find(t => t.id === parseInt(taskId, 10)) || null);
        
        if (task) {
          setTaskDetail(task);
          
          // 解析handler参数
          try {
            const handler = typeof task.handler === 'string' 
              ? JSON.parse(task.handler) 
              : task.handler;
            
            // 提取accountIds
            const accountIds = handler?.params?.accountIds || [];
            setSelectedAccountIds(accountIds);
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

  // 处理选择全部邮箱
  const handleSelectAllAccounts = useCallback(() => {
    const allAccountIds = emailAccounts.map(account => account.id);
    setSelectedAccountIds(allAccountIds);
  }, [emailAccounts]);

  // 处理清除所有选择
  const handleClearAllAccounts = useCallback(() => {
    setSelectedAccountIds([]);
  }, []);

  // 保存配置
  const handleSubmit = useCallback(async () => {
    if (!taskId) {
      message.error('任务ID不存在');
      return;
    }
    
    try {
      setSaving(true);
      
      // 使用专门的API方法更新邮箱配置
      const response = await taskApi.updateEmailSyncTaskConfig(
        taskId,
        selectedAccountIds
      );
      
      if (response.success) {
        message.success('邮箱配置更新成功');
        // 返回到任务列表页
        navigate('/task-manage');
      } else {
        message.error(response.message || '更新邮箱配置失败');
      }
    } catch (error: any) {
      message.error(error.message || '更新邮箱配置失败');
    } finally {
      setSaving(false);
    }
  }, [taskId, selectedAccountIds, navigate]);

  // 返回任务列表页
  const handleGoBack = useCallback(() => {
    navigate('/task-manage');
  }, [navigate]);

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
                
                <Form.Item label="Cron表达式">
                  <Input value={taskDetail.cron_expression} disabled />
                </Form.Item>
                
                <Form.Item 
                  label={
                    <Space>
                      <Text>选择邮箱账户</Text>
                      <Text type="secondary">（选择需要同步的邮箱账户，不选择则同步所有有效账户）</Text>
                    </Space>
                  }
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <Button onClick={handleSelectAllAccounts}>全选</Button>
                      <Button onClick={handleClearAllAccounts}>清除选择</Button>
                    </Space>
                    <Select
                      mode="multiple"
                      placeholder="请选择需要同步的邮箱账户"
                      style={{ width: '100%' }}
                      value={selectedAccountIds}
                      onChange={setSelectedAccountIds}
                      optionFilterProp="children"
                      loading={loading}
                    >
                      {emailAccounts.map(account => (
                        <Option key={account.id} value={account.id}>
                          {account.name} ({account.email})
                        </Option>
                      ))}
                    </Select>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                      {selectedAccountIds.length > 0 ? 
                        `已选择 ${selectedAccountIds.length} 个邮箱账户` : 
                        '未选择任何邮箱账户，将同步所有有效的邮箱账户'
                      }
                    </div>
                  </Space>
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