/**
 * AFF批量返现页面
 * 支持上传CSV文件或输入空格分隔文本进行批量返现
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Form,
  Input,
  Upload,
  message,
  Select,
  Divider,
  Table,
  Space,
  Spin,
  Typography,
  Modal,
  Alert,
  Descriptions,
  Tag,
  Checkbox,
  InputNumber,
  Empty,
  Steps
} from 'antd';
import { InboxOutlined, UploadOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api, { apiBaseUrl, affApi, infiniAccountApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Dragger } = Upload;

// 接口类型定义
interface Account {
  id: number;
  email: string;
  availableBalance: number;
}

interface BatchData {
  id: number;
  accountId: number;
  accountEmail: string;
  batchName: string;
  status: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
  riskyCount: number;
  defaultAmount: number;
  isAuto2FA: boolean;
  createdAt: string;
}

interface RelationData {
  id: number;
  batchId: number;
  uid: string;
  email: string;
  registerDate: string;
  cardCount: number;
  cardDate: string;
  sequenceNumber: string;
  amount: number;
  isRisky: boolean;
  isIgnored: boolean;
  isApproved: boolean;
  status: string;
  transferId: number;
  errorMessage: string;
  createdAt: string;
  completedAt: string;
}

const AffCashback: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [batchIdLoading, setBatchIdLoading] = useState<boolean>(false);
  const [maxBatchId, setMaxBatchId] = useState<number>(0);
  const [fileList, setFileList] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [currentBatch, setCurrentBatch] = useState<BatchData | null>(null);
  const [relations, setRelations] = useState<RelationData[]>([]);
  const [transferLoading, setTransferLoading] = useState<boolean>(false);
  const [transferModalVisible, setTransferModalVisible] = useState<boolean>(false);
  const [currentRelation, setCurrentRelation] = useState<RelationData | null>(null);
  const [batchAmountModalVisible, setBatchAmountModalVisible] = useState<boolean>(false);
  const [batchAmount, setBatchAmount] = useState<number>(5.6);
  const [delimiter, setDelimiter] = useState<string>(' '); // 默认分隔符为空格
  const [delimiterType, setDelimiterType] = useState<string>('space'); // 分隔符类型：space, comma, custom
  const [previewData, setPreviewData] = useState<string[]>([]); // 预览数据
  const [showAdvancedConfig, setShowAdvancedConfig] = useState<boolean>(false);
  const [fieldIndices, setFieldIndices] = useState<any>({
    uidIndex: 0,
    registerDateIndex: 1,
    cardCountIndex: 2,
    cardDateIndex: 3
  });
  
  // 获取最大批次ID
  const fetchMaxBatchId = async () => {
    if (batchIdLoading) return;
    
    setBatchIdLoading(true);
    try {
      const res = await api.get(`${apiBaseUrl}/api/aff/cashbacks/max-id`);
      if (res.data.success) {
        setMaxBatchId(res.data.data || 0);
      }
    } catch (error) {
      console.error('获取最大批次ID出错:', error);
    } finally {
      setBatchIdLoading(false);
    }
  };
  
  // 生成批次名称
  const generateBatchName = () => {
    // 格式化当前日期时间: yyyy-mm-dd-HH:mm:ss
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    // 生成批次名称
    const dateStr = `${year}-${month}-${day}-${hours}:${minutes}:${seconds}`;
    const batchName = `${dateStr}-${maxBatchId + 1}`;
    
    // 自动填入表单
    form.setFieldsValue({ batchName });
  };
  
  // 加载账户列表和最大批次ID
  useEffect(() => {
    fetchMaxBatchId();
    
    const fetchAccounts = async () => {
    try {
      const res = await api.get(`${apiBaseUrl}/api/infini-accounts`);
      if (res.data.success) {
        // 按余额降序排序账户列表
        const sortedAccounts = [...res.data.data].sort((a, b) => b.availableBalance - a.availableBalance);
        setAccounts(sortedAccounts);
        console.log('加载账户列表成功', sortedAccounts); // 调试日志
      } else {
        message.error('获取账户列表失败');
      }
    } catch (error) {
      console.error('获取账户列表出错:', error);
      message.error('获取账户列表失败');
    }
  };
    
    fetchAccounts();
  }, []);

  // 创建新批次
  const handleCreateBatch = async (values: any) => {
    setLoading(true);
    try {
      const res = await api.post(`${apiBaseUrl}/api/aff/cashbacks`, {
        accountId: values.accountId,
        batchName: values.batchName,
        defaultAmount: values.defaultAmount || 5.6,
        isAuto2FA: values.isAuto2FA !== false
      });
      
      if (res.data.success) {
        message.success('AFF返现批次创建成功');
        setCurrentBatch({
          ...res.data.data,
          status: 'pending',
          totalCount: 0,
          successCount: 0,
          failedCount: 0,
          riskyCount: 0
        });
        setCurrentStep(2);
      } else {
        message.error(res.data.message || '创建失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建批次失败');
    } finally {
      setLoading(false);
    }
  };

  // 解析CSV文件
  const parseFile = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      
      if (!content) {
        message.error('文件读取失败');
        return;
      }
      
      if (!currentBatch) {
        message.error('批次不存在，请重新创建批次');
        setCurrentStep(1);
        return;
      }
      
      setLoading(true);
      
      try {
        const res = await api.post(`${apiBaseUrl}/api/aff/cashbacks/${currentBatch.id}/parse`, {
          dataType: 'csv',
          data: content
        });
        
        if (res.data.success) {
          message.success('AFF数据解析成功');
          await fetchRelations();
          setCurrentStep(3);
        } else {
          message.error(res.data.message || '解析失败');
        }
      } catch (error: any) {
        message.error(error.response?.data?.message || '解析数据失败');
      } finally {
        setLoading(false);
      }
    };
    
    reader.readAsText(file);
  };

  // 更新预览数据
  const updatePreviewData = useCallback((text: string, delimiter: string) => {
    if (!text.trim()) {
      setPreviewData([]);
      return;
    }
    
    // 获取第一行文本
    const firstLine = text.split('\n')[0].trim();
    if (!firstLine) {
      setPreviewData([]);
      return;
    }
    
    // 使用分隔符分割
    const items = firstLine.split(delimiter);
    setPreviewData(items);
  }, []);
  
  // 处理分隔符变更
  const handleDelimiterChange = useCallback((type: string, customValue?: string) => {
    setDelimiterType(type);
    let newDelimiter = ' ';
    
    switch (type) {
      case 'space':
        newDelimiter = ' ';
        break;
      case 'comma':
        newDelimiter = ',';
        break;
      case 'custom':
        newDelimiter = customValue || '';
        break;
    }
    
    setDelimiter(newDelimiter);
    
    // 更新预览
    const text = localStorage.getItem('aff_text_data') || '';
    updatePreviewData(text, newDelimiter);
  }, [updatePreviewData]);
  
  // 解析文本
  const parseText = async (text: string, delimiter: string, fieldIndices: any) => {
    if (!text.trim()) {
      message.error('请输入有效的文本');
      return;
    }
    
    if (!currentBatch) {
      message.error('批次不存在，请重新创建批次');
      setCurrentStep(1);
      return;
    }
    
    setLoading(true);
    
    try {
      const res = await api.post(`${apiBaseUrl}/api/aff/cashbacks/${currentBatch.id}/parse`, {
        dataType: 'text',
        data: text,
        delimiter,
        fieldIndices
      });
      
      if (res.data.success) {
        message.success('AFF数据解析成功');
        await fetchRelations();
        setCurrentStep(3);
      } else {
        message.error(res.data.message || '解析失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '解析数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取关联用户列表
  const fetchRelations = async () => {
    if (!currentBatch) return;
    
    setLoading(true);
    
    try {
      const res = await api.get(`${apiBaseUrl}/api/aff/cashbacks/${currentBatch.id}/relations`);
      
      if (res.data.success) {
        setCurrentBatch(res.data.data.batch);
        setRelations(res.data.data.relations);
      } else {
        message.error(res.data.message || '获取数据失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 更新用户状态
  const updateRelationStatus = async (relationId: number, isApproved?: boolean, isIgnored?: boolean) => {
    try {
      const res = await api.put(`${apiBaseUrl}/api/aff/relations/${relationId}/status`, {
        isApproved,
        isIgnored
      });
      
      if (res.data.success) {
        message.success('状态更新成功');
        await fetchRelations();
      } else {
        message.error(res.data.message || '更新失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '更新状态失败');
    }
  };

  // 更新返现金额
  const updateAmount = async (relationId: number, amount: number) => {
    try {
      const res = await api.put(`${apiBaseUrl}/api/aff/relations/${relationId}/amount`, {
        amount
      });
      
      if (res.data.success) {
        message.success('金额更新成功');
        await fetchRelations();
      } else {
        message.error(res.data.message || '更新失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '更新金额失败');
    }
  };

  // 批量更新所有待处理记录的返现金额
  const updateAllPendingAmount = async () => {
    if (!currentBatch) return;
    
    try {
      const res = await api.put(`${apiBaseUrl}/api/aff/cashbacks/${currentBatch.id}/amount`, {
        amount: batchAmount
      });
      
      if (res.data.success) {
        message.success('批量更新金额成功');
        setBatchAmountModalVisible(false);
        await fetchRelations();
      } else {
        message.error(res.data.message || '批量更新失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '批量更新金额失败');
    }
  };

  // 开始批量转账
  const startBatchTransfer = async () => {
    if (!currentBatch) return;
    
    setTransferLoading(true);
    
    try {
      const res = await api.post(`${apiBaseUrl}/api/aff/cashbacks/${currentBatch.id}/transfer`);
      
      if (res.data.success) {
        message.success('批量转账已开始');
        await fetchRelations();
        
        // 如果有待处理记录，轮询执行转账
        if (res.data.data.nextRelation) {
          pollNextTransfer();
        } else {
          message.info(res.data.message || '没有待处理记录');
          setTransferLoading(false);
        }
      } else {
        message.error(res.data.message || '开始转账失败');
        setTransferLoading(false);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '开始转账失败');
      setTransferLoading(false);
    }
  };

  // 轮询获取下一条待处理记录并执行转账
  const pollNextTransfer = useCallback(async () => {
    if (!currentBatch) return;
    
    try {
      // 获取下一条待处理记录
      const nextRes = await api.get(`${apiBaseUrl}/api/aff/cashbacks/${currentBatch.id}/next`);
      
      if (nextRes.data.success) {
        if (nextRes.data.data.nextRelation) {
          // 执行转账
          const relationId = nextRes.data.data.nextRelation.id;
          
          try {
            await api.post(`${apiBaseUrl}/api/aff/relations/${relationId}/transfer`);
            // 短暂延迟，避免频繁请求
            setTimeout(() => {
              pollNextTransfer();
            }, 500);
          } catch (error: any) {
            // 转账失败，显示错误信息并暂停
            setTransferLoading(false);
            await fetchRelations();
            
            Modal.confirm({
              title: '转账失败',
              content: `转账过程中出现错误: ${error.response?.data?.message || '未知错误'}。是否继续处理后续记录？`,
              okText: '继续',
              cancelText: '停止',
              onOk: () => {
                setTransferLoading(true);
                pollNextTransfer();
              }
            });
          }
        } else {
          // 没有更多待处理记录
          message.success('转账处理完成');
          setTransferLoading(false);
          await fetchRelations();
        }
      } else {
        message.error(nextRes.data.message || '获取待处理记录失败');
        setTransferLoading(false);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '轮询处理失败');
      setTransferLoading(false);
    }
  }, [currentBatch]);

  // 执行单个记录的转账
  const executeTransfer = async (relationId: number) => {
    try {
      setTransferModalVisible(false);
      
      const res = await api.post(`${apiBaseUrl}/api/aff/relations/${relationId}/transfer`);
      
      if (res.data.success) {
        message.success('转账执行成功');
        await fetchRelations();
      } else {
        message.error(res.data.message || '转账失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '执行转账失败');
    }
  };

  // 文件上传配置
  const uploadProps = {
    name: 'file',
    fileList,
    accept: '.csv,.txt',
    beforeUpload: (file: File) => {
      setFileList([file]);
      parseFile(file);
      return false;
    },
    onRemove: () => {
      setFileList([]);
    }
  };

  // 用户列表表格列定义
  const columns = [
    {
      title: '序号',
      dataIndex: 'sequenceNumber',
      key: 'sequenceNumber',
      width: 80
    },
    {
      title: 'UID',
      dataIndex: 'uid',
      key: 'uid',
      width: 120
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string, record: RelationData) => {
        if (record.isIgnored) {
          return <Tag color="default">已忽略</Tag>;
        }
        
        switch (status) {
          case 'pending':
            return <Tag color="blue">待处理</Tag>;
          case 'processing':
            return <Tag color="orange">处理中</Tag>;
          case 'completed':
            return <Tag color="green">已完成</Tag>;
          case 'failed':
            return <Tag color="red">失败</Tag>;
          default:
            return <Tag>{status}</Tag>;
        }
      }
    },
    {
      title: '风险',
      dataIndex: 'isRisky',
      key: 'isRisky',
      width: 80,
      render: (isRisky: boolean, record: RelationData) => {
        if (isRisky) {
          return record.isApproved 
            ? <Tag color="green"><CheckCircleOutlined /> 已批准</Tag>
            : <Tag color="red"><WarningOutlined /> 风险</Tag>;
        }
        return <Tag color="default">正常</Tag>;
      }
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (amount: number, record: RelationData) => {
        if (record.status === 'pending' && !record.isIgnored) {
          return (
            <InputNumber
              size="small"
              min={0.01}
              step={0.1}
              precision={2}
              value={amount}
              onChange={(value) => {
                if (value !== null) {
                  updateAmount(record.id, value);
                }
              }}
            />
          );
        }
        return amount.toFixed(2);
      }
    },
    {
      title: '注册日期',
      dataIndex: 'registerDate',
      key: 'registerDate',
      width: 100,
      render: (date: string) => date ? new Date(date).toLocaleDateString() : '-'
    },
    {
      title: '开卡数量',
      dataIndex: 'cardCount',
      key: 'cardCount',
      width: 80
    },
    {
      title: '开卡日期',
      dataIndex: 'cardDate',
      key: 'cardDate',
      width: 100,
      render: (date: string) => date ? new Date(date).toLocaleDateString() : '-'
    },
    {
      title: '转账ID',
      dataIndex: 'transferId',
      key: 'transferId',
      width: 80
    },
    {
      title: '完成时间',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 160,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-'
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right' as const,
      width: 200,
      render: (text: string, record: RelationData) => {
        // 仅显示适用于当前状态的操作
        if (record.isIgnored) {
          return (
            <Button 
              type="link" 
              size="small"
              onClick={() => updateRelationStatus(record.id, undefined, false)}
            >
              取消忽略
            </Button>
          );
        }
        
        if (record.status === 'pending') {
          return (
            <Space>
              {record.isRisky && !record.isApproved && (
                <Button 
                  type="link" 
                  size="small"
                  onClick={() => updateRelationStatus(record.id, true)}
                >
                  批准
                </Button>
              )}
              <Button 
                type="link" 
                size="small"
                onClick={() => updateRelationStatus(record.id, undefined, true)}
              >
                忽略
              </Button>
              <Button 
                type="link" 
                size="small"
                onClick={() => {
                  setCurrentRelation(record);
                  setTransferModalVisible(true);
                }}
              >
                转账
              </Button>
            </Space>
          );
        }
        
        if (record.status === 'failed') {
          return (
            <Button 
              type="link" 
              size="small"
              onClick={() => {
                setCurrentRelation(record);
                setTransferModalVisible(true);
              }}
            >
              重试
            </Button>
          );
        }
        
        return null;
      }
    }
  ];

  // 渲染步骤1：创建批次
  const renderStep1 = () => {
    return (
      <Card>
        <Title level={4}>创建AFF返现批次</Title>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreateBatch}
          initialValues={{
            defaultAmount: 5.6,
            isAuto2FA: true
          }}
        >
          <Form.Item
            name="accountId"
            label="用于返现的转账账户"
            rules={[{ required: true, message: '请选择用于返现的转账账户' }]}
            extra="账户已按余额从高到低排序，可通过邮箱或余额搜索"
          >
            <Select 
              placeholder="选择转账账户" 
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => {
                const childrenText = option?.children ? option.children.toString().toLowerCase() : '';
                return childrenText.includes(input.toLowerCase());
              }}
              style={{ width: '100%' }}
            >
              {accounts.map(account => (
                <Option key={account.id} value={account.id}>
                  <strong>{account.email}</strong> - 余额: <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{account.availableBalance}</span>
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item
            name="batchName"
            label="批次名称"
            rules={[{ required: true, message: '请输入批次名称' }]}
          >
            <Input.Group compact>
              <Input 
                placeholder="例如：2025年5月AFF返现" 
                style={{ width: 'calc(100% - 120px)' }}
              />
              <Button 
                type="primary"
                loading={batchIdLoading}
                onClick={generateBatchName}
                style={{ width: 120 }}
              >
                生成批次名称
              </Button>
            </Input.Group>
          </Form.Item>
          
          <Form.Item
            name="defaultAmount"
            label="默认返现金额"
            rules={[{ required: true, message: '请输入默认返现金额' }]}
          >
            <InputNumber
              min={0.01}
              step={0.1}
              precision={2}
              style={{ width: '100%' }}
            />
          </Form.Item>
          
          <Form.Item
            name="isAuto2FA"
            valuePropName="checked"
          >
            <Checkbox>启用自动2FA验证</Checkbox>
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              创建批次
            </Button>
          </Form.Item>
        </Form>
      </Card>
    );
  };

  // 渲染步骤2：导入数据
  const renderStep2 = () => {
    return (
      <Card>
        <Title level={4}>导入AFF数据</Title>
        
        <Paragraph>
          当前批次：{currentBatch?.batchName} (默认金额: {currentBatch?.defaultAmount})
        </Paragraph>
        
        <Divider />
        
        <Title level={5}>方式一：上传CSV文件</Title>
        <Paragraph>
          请上传CSV文件，格式要求：序列号,infini uid,注册日期,开卡数量,开卡日期
        </Paragraph>
        
        <Dragger {...uploadProps}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">支持CSV格式文件</p>
        </Dragger>
        
        <Divider />
        
        <Title level={5}>方式二：输入分隔文本</Title>
        <Paragraph>
          请输入分隔的文本，每行一条记录，默认使用空格分隔，格式：uid 注册日期 开卡数量 开卡日期
        </Paragraph>
        
        <Form layout="vertical">
          <Form.Item label="分隔符">
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ marginRight: 8 }}>使用</span>
                <Select 
                  value={delimiterType}
                  style={{ width: 120 }}
                  onChange={(value) => handleDelimiterChange(value)}
                >
                  <Option value="space">空格</Option>
                  <Option value="comma">英文逗号</Option>
                  <Option value="custom">自定义</Option>
                </Select>
                
                {delimiterType === 'custom' && (
                  <Input 
                    placeholder="输入自定义分隔符" 
                    value={delimiter} 
                    onChange={(e) => handleDelimiterChange('custom', e.target.value)}
                    style={{ width: 150, marginLeft: 8 }}
                  />
                )}
                <span style={{ margin: '0 8px' }}>作为分隔符</span>
              </div>
              
              {previewData.length > 0 && (
                <div style={{ marginLeft: 16, flex: 1 }}>
                  <span>第一行预览: </span>
                  {previewData.map((item, index) => (
                    <Tag key={index} color="blue" style={{ margin: '0 4px' }}>
                      {item || '<空>'}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          </Form.Item>
          
          <Button 
            type="link" 
            onClick={() => setShowAdvancedConfig(!showAdvancedConfig)}
            style={{ padding: '0 0 16px 0' }}
          >
            {showAdvancedConfig ? '隐藏高级配置' : '显示高级配置'}
          </Button>
          
          {showAdvancedConfig && (
            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 4, marginBottom: 16 }}>
              <Paragraph>
                <strong>高级配置：</strong>指定字段在分隔后的位置索引（从0开始计数）
              </Paragraph>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <Form.Item label="UID索引" style={{ marginBottom: 8, minWidth: 150 }}>
                  <InputNumber 
                    min={0} 
                    value={fieldIndices.uidIndex} 
                    onChange={val => setFieldIndices({...fieldIndices, uidIndex: val !== null ? val : 0})}
                  />
                </Form.Item>
                <Form.Item label="注册日期索引" style={{ marginBottom: 8, minWidth: 150 }}>
                  <InputNumber 
                    min={0} 
                    value={fieldIndices.registerDateIndex} 
                    onChange={val => setFieldIndices({...fieldIndices, registerDateIndex: val !== null ? val : 1})}
                  />
                </Form.Item>
                <Form.Item label="开卡数量索引" style={{ marginBottom: 8, minWidth: 150 }}>
                  <InputNumber 
                    min={0} 
                    value={fieldIndices.cardCountIndex} 
                    onChange={val => setFieldIndices({...fieldIndices, cardCountIndex: val !== null ? val : 2})}
                  />
                </Form.Item>
                <Form.Item label="开卡日期索引" style={{ marginBottom: 8, minWidth: 150 }}>
                  <InputNumber 
                    min={0} 
                    value={fieldIndices.cardDateIndex} 
                    onChange={val => setFieldIndices({...fieldIndices, cardDateIndex: val !== null ? val : 3})}
                  />
                </Form.Item>
              </div>
            </div>
          )}
          
          <Form.Item>
            <TextArea
              rows={6}
              placeholder={`输入格式示例（使用${delimiter || '空格'}分隔）：
123456${delimiter}2023-01-01${delimiter}1${delimiter}2023-02-01
789012${delimiter}2023-02-15${delimiter}0
345678${delimiter}2023-03-10${delimiter}2${delimiter}2023-04-01`}
              onChange={(e) => {
                // 实时保存到本地，避免丢失
                const text = e.target.value;
                localStorage.setItem('aff_text_data', text);
                // 更新预览
                updatePreviewData(text, delimiter);
              }}
              defaultValue={localStorage.getItem('aff_text_data') || ''}
            />
          </Form.Item>
          
          <Form.Item>
            <Button
              type="primary"
              loading={loading}
              onClick={() => {
                const text = localStorage.getItem('aff_text_data') || '';
                parseText(text, delimiter, fieldIndices);
                // 成功后清除本地存储
                if (!loading) {
                  localStorage.removeItem('aff_text_data');
                }
              }}
            >
              解析文本
            </Button>
          </Form.Item>
        </Form>
      </Card>
    );
  };

  // 渲染步骤3：处理数据
  const renderStep3 = () => {
    // 计算各状态的记录数量
    const pendingCount = relations.filter(r => r.status === 'pending' && !r.isIgnored).length;
    const riskyPendingCount = relations.filter(r => r.isRisky && r.status === 'pending' && !r.isIgnored).length;
    const approvedRiskyCount = relations.filter(r => r.isRisky && r.isApproved && r.status === 'pending' && !r.isIgnored).length;
    
    return (
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4}>AFF返现处理</Title>
          <Space>
            <Button
              type="primary"
              disabled={!pendingCount || transferLoading}
              loading={transferLoading}
              onClick={startBatchTransfer}
            >
              {transferLoading ? '处理中...' : '开始批量转账'}
            </Button>
            <Button
              onClick={() => {
                setBatchAmount(currentBatch?.defaultAmount || 5.6);
                setBatchAmountModalVisible(true);
              }}
              disabled={!pendingCount || transferLoading}
            >
              批量修改金额
            </Button>
            <Button onClick={fetchRelations}>刷新</Button>
          </Space>
        </div>
        
        {currentBatch && (
          <Descriptions bordered size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="批次名称">{currentBatch.batchName}</Descriptions.Item>
            <Descriptions.Item label="转账账户">{currentBatch.accountEmail}</Descriptions.Item>
            <Descriptions.Item label="默认金额">{currentBatch.defaultAmount}</Descriptions.Item>
            <Descriptions.Item label="总记录数">{currentBatch.totalCount}</Descriptions.Item>
            <Descriptions.Item label="已完成">{currentBatch.successCount}</Descriptions.Item>
            <Descriptions.Item label="失败">{currentBatch.failedCount}</Descriptions.Item>
            <Descriptions.Item label="风险用户">{currentBatch.riskyCount}</Descriptions.Item>
            <Descriptions.Item label="待处理">{pendingCount}</Descriptions.Item>
            <Descriptions.Item label="自动2FA">{currentBatch.isAuto2FA ? '是' : '否'}</Descriptions.Item>
          </Descriptions>
        )}
        
        {riskyPendingCount > 0 && (
          <Alert
            message="存在风险用户"
            description={`当前有 ${riskyPendingCount} 个风险用户待处理，已批准 ${approvedRiskyCount} 个。风险用户需要手动批准或忽略。`}
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            action={
              riskyPendingCount > 0 && (
                <Button
                  size="small"
                  onClick={() => {
                    Modal.confirm({
                      title: '批准所有风险用户',
                      content: '确定批准所有风险用户吗？这将允许向所有风险用户进行转账。',
                      onOk: async () => {
                        setLoading(true);
                        try {
                          // 批量批准所有风险用户
                          const riskyRelations = relations.filter(r => r.isRisky && !r.isApproved && r.status === 'pending' && !r.isIgnored);
                          for (const relation of riskyRelations) {
                            await updateRelationStatus(relation.id, true);
                          }
                          message.success('批量批准成功');
                          await fetchRelations();
                        } catch (error) {
                          message.error('批量操作失败');
                        } finally {
                          setLoading(false);
                        }
                      }
                    });
                  }}
                >
                  批量批准
                </Button>
              )
            }
          />
        )}
        
        <Table
          columns={columns}
          dataSource={relations}
          rowKey="id"
          size="small"
          scroll={{ x: 1500, y: 500 }}
          pagination={false}
          loading={loading}
          locale={{
            emptyText: <Empty description="暂无数据" />
          }}
        />
        
        {/* 单个转账确认对话框 */}
        <Modal
          title="确认转账"
          open={transferModalVisible}
          onOk={() => executeTransfer(currentRelation?.id || 0)}
          onCancel={() => setTransferModalVisible(false)}
          okText="确认"
          cancelText="取消"
        >
          <p>确定向以下用户执行转账操作？</p>
          {currentRelation && (
            <Descriptions bordered size="small">
              <Descriptions.Item label="UID" span={3}>
                {currentRelation.uid}
              </Descriptions.Item>
              <Descriptions.Item label="金额" span={3}>
                {currentRelation.amount}
              </Descriptions.Item>
              <Descriptions.Item label="状态" span={3}>
                {currentRelation.status === 'failed' ? '之前失败，原因：' + currentRelation.errorMessage : '待处理'}
              </Descriptions.Item>
            </Descriptions>
          )}
        </Modal>
        
        {/* 批量修改金额对话框 */}
        <Modal
          title="批量修改金额"
          open={batchAmountModalVisible}
          onOk={updateAllPendingAmount}
          onCancel={() => setBatchAmountModalVisible(false)}
          okText="确认"
          cancelText="取消"
        >
          <Form layout="vertical">
            <Form.Item label="批量设置所有待处理记录的返现金额">
              <InputNumber
                min={0.01}
                step={0.1}
                precision={2}
                style={{ width: '100%' }}
                value={batchAmount}
                onChange={(value) => setBatchAmount(value || 5.6)}
              />
            </Form.Item>
            <Alert
              message="注意"
              description={`此操作将修改所有${pendingCount}条待处理记录的返现金额，请确认金额正确。`}
              type="info"
              showIcon
            />
          </Form>
        </Modal>
      </Card>
    );
  };

  return (
    <div>
      <Title level={3}>AFF批量返现</Title>
      
      <div style={{ marginBottom: 16 }}>
        <Steps
          current={currentStep - 1}
          items={[
            { title: '创建批次' },
            { title: '导入数据' },
            { title: '处理数据' }
          ]}
        />
      </div>
      
      <Spin spinning={loading}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </Spin>
    </div>
  );
};

// 懒加载时需要定义组件显示名称
AffCashback.displayName = 'AffCashback';

export default AffCashback;