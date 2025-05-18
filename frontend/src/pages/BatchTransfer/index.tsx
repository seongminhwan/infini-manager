/**
 * 批量转账页面
 * 用于批量执行一对多或多对一转账操作
 * 实现三步流程：1.选择转账模式和账户 2.配置转账参数 3.执行转账
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Divider,
  Alert,
  Tag,
  Checkbox,
  Progress,
  Result,
  Empty,
  Steps,
  Radio,
  Transfer,
  List,
  Avatar,
  Spin,
  message,
  Row,
  Col,
  Input,
  InputNumber,
  Select,
  Table,
  Modal
} from 'antd';
import { 
  SwapOutlined, 
  SendOutlined, 
  HistoryOutlined, 
  QuestionCircleOutlined, 
  LeftOutlined, 
  RightOutlined,
  UserOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { TransferDirection } from 'antd/lib/transfer';
import { Key as TransferKey } from 'rc-table/lib/interface';
import { infiniAccountApi, batchTransferApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Option } = Select;

// 样式组件
const PageContainer = styled.div`
  padding: 12px;
`;

const StyledCard = styled(Card)`
  margin-bottom: 8px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const ProgressContainer = styled.div`
  margin: 12px 0;
`;

const StepContainer = styled.div`
  margin: 12px 0;
`;

const TransferContainer = styled.div`
  margin-top: 12px;
`;

const AccountItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
`;

const StatusTag = styled(Tag)`
  margin-left: 8px;
`;

const ButtonGroup = styled.div`
  margin-top: 24px;
  display: flex;
  justify-content: center;
  gap: 16px;
`;

// 接口定义
interface InfiniAccount {
  id: number;
  email: string;
  uid?: string;
  availableBalance?: string;
  status?: string;
}

interface BatchTransferRelation {
  sourceAccountId?: number;
  targetAccountId?: number;
  contactType?: 'uid' | 'email' | 'inner';
  targetIdentifier?: string;
  amount: string;
}

const BatchTransfer = () => {
  // 当前步骤
  const [currentStep, setCurrentStep] = useState<number>(0);
  
  // 状态管理
  const [loading, setLoading] = useState<boolean>(false);
  const [accounts, setAccounts] = useState<InfiniAccount[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<InfiniAccount[]>([]);
  const [targetKeys, setTargetKeys] = useState<TransferKey[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<InfiniAccount[]>([]);
  
  // 转账模式
  const [transferMode, setTransferMode] = useState<'one_to_many' | 'many_to_one'>('one_to_many');
  
  // 源账户和目标账户
  const [sourceAccount, setSourceAccount] = useState<InfiniAccount | null>(null);
  const [targetAccount, setTargetAccount] = useState<InfiniAccount | null>(null);
  const [targetContactType, setTargetContactType] = useState<'inner' | 'uid' | 'email'>('inner');
  const [externalTargetId, setExternalTargetId] = useState<string>('');
  
  // 筛选条件
  const [balanceFilterType, setBalanceFilterType] = useState<'gt' | 'lt' | 'eq'>('gt');
  const [balanceFilterValue, setBalanceFilterValue] = useState<string>('');
  const [redPacketFilterType, setRedPacketFilterType] = useState<'has' | 'no' | 'gt' | 'lt' | 'eq'>('has');
  const [redPacketFilterValue, setRedPacketFilterValue] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // 金额配置
  const [amountType, setAmountType] = useState<'equal' | 'fixed' | 'custom'>('equal');
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [fixedAmount, setFixedAmount] = useState<string>('');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  
  // 其他配置
  const [remarks, setRemarks] = useState<string>('');
  const [auto2FA, setAuto2FA] = useState<boolean>(false);
  
  // 执行状态
  const [batchId, setBatchId] = useState<string | null>(null);
  const [processStatus, setProcessStatus] = useState<'idle' | 'processing' | 'completed' | 'error'>('idle');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [recentTransfers, setRecentTransfers] = useState<any[]>([]);
  
  // 轮询进度的定时器
  const [progressTimer, setProgressTimer] = useState<NodeJS.Timeout | null>(null);
  
  // 步骤定义
  const steps = [
    {
      title: '选择转账模式和账户',
      description: '选择一对多或多对一转账模式',
      icon: <UserOutlined />
    },
    {
      title: '配置转账参数',
      description: '设置转账金额和备注',
      icon: <SwapOutlined />
    },
    {
      title: '执行转账',
      description: '批量执行转账操作',
      icon: <SendOutlined />
    }
  ];
  
  // 初始加载
  useEffect(() => {
    fetchAccounts();
  }, []);
  
  // 当targetKeys变化时，更新selectedAccounts
  useEffect(() => {
    if (transferMode === 'one_to_many') {
      // 一对多模式：选择的是目标账户
      const selected = accounts.filter(account => 
        targetKeys.includes(account.id.toString() as TransferKey)
      );
      setSelectedAccounts(selected);
    } else {
      // 多对一模式：选择的是源账户
      const selected = accounts.filter(account => 
        targetKeys.includes(account.id.toString() as TransferKey)
      );
      setSelectedAccounts(selected);
    }
  }, [targetKeys, accounts, transferMode]);
  
  // 当进入第二步时，初始化金额配置
  useEffect(() => {
    if (currentStep === 1) {
      // 重置金额配置
      setAmountType('equal');
      setTotalAmount('');
      setFixedAmount('');
      setCustomAmounts({});
    }
  }, [currentStep]);
  
  // 轮询进度
  useEffect(() => {
    // 清除之前的定时器
    if (progressTimer) {
      clearInterval(progressTimer);
    }
    
    // 如果有批量转账ID且状态为处理中，开始轮询进度
    if (batchId && processStatus === 'processing') {
      const timer = setInterval(async () => {
        try {
          const response = await batchTransferApi.getBatchTransferProgress(batchId);
          if (response.success) {
            const { progress, successCount, failedCount, recentTransfers, batchTransfer } = response.data;
            
            setProgressPercent(progress);
            setSuccessCount(successCount);
            setFailedCount(failedCount);
            setRecentTransfers(recentTransfers || []);
            
            // 如果批量转账已完成，停止轮询
            if (['completed', 'failed'].includes(batchTransfer.status)) {
              setProcessStatus(batchTransfer.status === 'completed' ? 'completed' : 'error');
              clearInterval(timer);
            }
          }
        } catch (error) {
          console.error('获取批量转账进度失败:', error);
        }
      }, 2000); // 每2秒轮询一次
      
      setProgressTimer(timer);
      
      // 组件卸载时清除定时器
      return () => clearInterval(timer);
    }
  }, [batchId, processStatus]);
  
  // 获取Infini账户列表
  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await infiniAccountApi.getAllInfiniAccounts();
      
      if (response.success && response.data) {
        setAccounts(response.data);
        setFilteredAccounts(response.data);
      } else {
        message.error('获取账户列表失败');
      }
    } catch (error) {
      console.error('获取账户列表失败:', error);
      message.error('获取账户列表失败，请检查网络连接');
    } finally {
      setLoading(false);
    }
  };
  
  // 处理转账模式变更
  const handleModeChange = (e: any) => {
    const mode = e.target.value;
    setTransferMode(mode);
    
    // 重置选择的账户
    setTargetKeys([]);
    setSourceAccount(null);
    setTargetAccount(null);
  };
  
  // 处理Transfer组件的变更
  const handleTransferChange = (nextTargetKeys: TransferKey[]) => {
    setTargetKeys(nextTargetKeys);
  };
  
  // 处理源账户选择
  const handleSourceAccountChange = (value: string) => {
    const account = accounts.find(a => a.id.toString() === value);
    if (account) {
      setSourceAccount(account);
    }
  };
  
  // 处理目标账户选择
  const handleTargetAccountChange = (value: string) => {
    const account = accounts.find(a => a.id.toString() === value);
    if (account) {
      setTargetAccount(account);
    }
  };
  
  // 处理金额类型变更
  const handleAmountTypeChange = (e: any) => {
    setAmountType(e.target.value);
  };
  
  // 处理总金额变更
  const handleTotalAmountChange = (value: string | number | null) => {
    setTotalAmount(value?.toString() || '');
  };
  
  // 处理固定金额变更
  const handleFixedAmountChange = (value: string | number | null) => {
    setFixedAmount(value?.toString() || '');
  };
  
  // 处理自定义金额变更
  const handleCustomAmountChange = (index: number, value: string | number | null) => {
    const accountId = selectedAccounts[index]?.id.toString();
    if (accountId) {
      setCustomAmounts({
        ...customAmounts,
        [accountId]: value?.toString() || ''
      });
    }
  };
  
  // 验证表单
  const validateForm = () => {
    // 第一步验证
    if (currentStep === 0) {
      if (transferMode === 'one_to_many') {
        if (!sourceAccount) {
          message.error('请选择源账户');
          return false;
        }
        if (targetKeys.length === 0) {
          message.error('请选择至少一个目标账户');
          return false;
        }
      } else {
        // 多对一模式的验证
        if (targetContactType === 'inner') {
          if (!targetAccount) {
            message.error('请选择内部目标账户');
            return false;
          }
        } else {
          if (!externalTargetId) {
            message.error(`请输入目标账户${targetContactType === 'uid' ? 'UID' : 'Email'}`);
            return false;
          }
        }
        
        if (targetKeys.length === 0) {
          message.error('请选择至少一个源账户');
          return false;
        }
      }
      return true;
    }
    
    // 第二步验证
    if (currentStep === 1) {
      if (amountType === 'equal' && !totalAmount) {
        message.error('请输入总金额');
        return false;
      }
      if (amountType === 'fixed' && !fixedAmount) {
        message.error('请输入每账户固定金额');
        return false;
      }
      if (amountType === 'custom') {
        const hasEmptyAmount = selectedAccounts.some((account, index) => {
          const accountId = account.id.toString();
          return !customAmounts[accountId];
        });
        if (hasEmptyAmount) {
          message.error('请为每个账户输入金额');
          return false;
        }
      }
      return true;
    }
    
    return true;
  };
  
  // 准备转账关系数据
  const prepareRelations = (): BatchTransferRelation[] => {
    if (transferMode === 'one_to_many') {
      // 一对多模式
      return selectedAccounts.map(account => {
        let amount = '';
        if (amountType === 'equal') {
          // 均分总金额
          amount = (parseFloat(totalAmount) / selectedAccounts.length).toFixed(6);
        } else if (amountType === 'fixed') {
          // 固定金额
          amount = fixedAmount;
        } else {
          // 自定义金额
          amount = customAmounts[account.id.toString()] || '0';
        }
        
        return {
          targetAccountId: account.id,
          contactType: 'inner',
          targetIdentifier: account.id.toString(),
          amount
        };
      });
    } else {
      // 多对一模式
      return selectedAccounts.map(account => {
        let amount = '';
        if (amountType === 'equal') {
          // 均分总金额
          amount = (parseFloat(totalAmount) / selectedAccounts.length).toFixed(6);
        } else if (amountType === 'fixed') {
          // 固定金额
          amount = fixedAmount;
        } else {
          // 自定义金额
          amount = customAmounts[account.id.toString()] || '0';
        }
        
        // 根据目标账户类型设置目标标识符
        let targetId = '';
        if (targetContactType === 'inner' && targetAccount) {
          targetId = targetAccount.id.toString();
        } else {
          targetId = externalTargetId;
        }
        
        return {
          sourceAccountId: account.id,
          contactType: targetContactType, // 使用选择的联系方式类型
          targetIdentifier: targetId,     // 使用对应的目标标识符
          amount
        };
      });
    }
  };
  
  // 执行批量转账
  const handleExecuteTransfer = async () => {
    try {
      setLoading(true);
      
      // 准备批量转账数据
      const relations = prepareRelations();
      const batchName = `批量转账_${new Date().toLocaleString()}`;
      
      const data = {
        name: batchName,
        type: transferMode,
        sourceAccountId: transferMode === 'one_to_many' ? sourceAccount?.id : undefined,
        targetAccountId: transferMode === 'many_to_one' ? targetAccount?.id : undefined,
        relations,
        remarks
      };
      
      // 创建批量转账任务
      const createResponse = await batchTransferApi.createBatchTransfer(data);
      
      if (createResponse.success) {
        const { batchId } = createResponse.data;
        setBatchId(batchId);
        
        // 执行批量转账
        const executeResponse = await batchTransferApi.executeBatchTransfer(batchId, auto2FA);
        
        if (executeResponse.success) {
          message.success('批量转账已开始执行');
          setProcessStatus('processing');
        } else {
          message.error(`执行批量转账失败: ${executeResponse.message}`);
          setProcessStatus('error');
        }
      } else {
        message.error(`创建批量转账任务失败: ${createResponse.message}`);
      }
    } catch (error: any) {
      console.error('执行批量转账失败:', error);
      message.error(`执行批量转账失败: ${error.message}`);
      setProcessStatus('error');
    } finally {
      setLoading(false);
    }
  };
  
  // 重试失败的转账
  const handleRetryFailed = async () => {
    if (!batchId) return;
    
    try {
      setLoading(true);
      
      const response = await batchTransferApi.retryFailedTransfers(batchId, auto2FA);
      
      if (response.success) {
        message.success('批量重试已开始');
        setProcessStatus('processing');
      } else {
        message.error(`批量重试失败: ${response.message}`);
      }
    } catch (error: any) {
      console.error('批量重试失败:', error);
      message.error(`批量重试失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // 重置状态 - 由于在下方已有完整实现，此处移除重复定义
// 渲染进度
  const renderProgress = () => {
    return (
      <ProgressContainer>
        <Progress 
          percent={progressPercent} 
          status={processStatus === 'error' ? 'exception' : undefined}
        />
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">
            总计: {selectedAccounts.length} | 成功: {successCount} | 失败: {failedCount}
          </Text>
        </div>
      </ProgressContainer>
    );
  };
  
  // 渲染结果摘要
  const renderResultSummary = () => {
    return (
      <StyledCard>
        <Result
          status={processStatus === 'completed' ? 'success' : processStatus === 'error' ? 'error' : 'info'}
          title={
            processStatus === 'completed' ? '批量转账已完成' : 
            processStatus === 'error' ? '批量转账部分失败' : 
            '批量转账进行中'
          }
          subTitle={`成功: ${successCount} | 失败: ${failedCount} | 总计: ${selectedAccounts.length}`}
          extra={[
            <Button key="reset" onClick={handleReset}>
              新建批量转账
            </Button>,
            failedCount > 0 && (
              <Button key="retry" type="primary" onClick={handleRetryFailed}>
                重试失败的转账
              </Button>
            )
          ].filter(Boolean)}
        />
      </StyledCard>
    );
  };
  
  // 渲染第一步：选择转账模式和账户
  const renderStep1 = () => {
    return (
      <StyledCard>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Title level={4}>选择转账模式</Title>
          <Radio.Group onChange={handleModeChange} value={transferMode}>
            <Radio value="one_to_many">一对多转账（一个账户转账给多个账户）</Radio>
            <Radio value="many_to_one">多对一转账（多个账户转账给一个账户）</Radio>
          </Radio.Group>
          
          <Divider />
          
          {transferMode === 'one_to_many' ? (
            <>
              <Title level={4}>选择源账户</Title>
              <Select
                style={{ width: '100%' }}
                placeholder="选择源账户"
                onChange={handleSourceAccountChange}
                optionFilterProp="children"
                showSearch
              >
                {accounts.map(account => (
                  <Option key={account.id} value={account.id.toString()}>
                    {account.email} - UID: {account.uid} - 余额: {account.availableBalance || '未知'}
                  </Option>
                ))}
              </Select>
              
              <Divider />
              
              <Title level={4}>选择目标账户</Title>
              <Alert
                message="请选择要转账的目标账户"
                description="从左侧列表中选择账户，点击箭头将其添加到右侧列表中。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            </>
          ) : (
            <>
              <Title level={4}>选择目标账户</Title>
              <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
                <Radio.Group 
                  value={targetContactType}
                  onChange={(e) => setTargetContactType(e.target.value)}
                  style={{ marginBottom: 16 }}
                >
                  <Radio value="inner">内部账户</Radio>
                  <Radio value="uid">UID</Radio>
                  <Radio value="email">Email</Radio>
                </Radio.Group>
                
                {targetContactType === 'inner' ? (
                  <Select
                    style={{ width: '100%' }}
                    placeholder="选择内部目标账户"
                    onChange={handleTargetAccountChange}
                    optionFilterProp="children"
                    showSearch
                  >
                    {accounts.map(account => (
                      <Option key={account.id} value={account.id.toString()}>
                        {account.email} - UID: {account.uid} - 余额: {account.availableBalance || '未知'}
                      </Option>
                    ))}
                  </Select>
                ) : (
                  <Input 
                    placeholder={targetContactType === 'uid' ? "输入目标账户UID" : "输入目标账户Email"} 
                    value={externalTargetId}
                    onChange={(e) => setExternalTargetId(e.target.value)}
                    style={{ width: '100%' }}
                  />
                )}
              </Space>
              
              <Divider />
              
              <Title level={4}>选择源账户</Title>
              <Alert
                message="请选择要从中转出资金的源账户"
                description="从左侧列表中选择账户，点击箭头将其添加到右侧列表中。"
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            </>
          )}
          
          {/* 账户筛选条件 */}
          <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
            <Title level={5}>筛选条件</Title>
            <Row gutter={16}>
              <Col span={8}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="按余额筛选"
                  onChange={(value) => setBalanceFilter(value)}
                  allowClear
                >
                  <Option value="gt_100">余额 {'>'} 100</Option>
                  <Option value="gt_1000">余额 {'>'} 1000</Option>
                  <Option value="gt_10000">余额 {'>'} 10000</Option>
                  <Option value="lt_100">余额 {'<'} 100</Option>
                  <Option value="lt_10">余额 {'<'} 10</Option>
                </Select>
              </Col>
              <Col span={8}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="按红包余额筛选"
                  onChange={(value) => setRedPacketFilter(value)}
                  allowClear
                >
                  <Option value="has_redpacket">有红包余额</Option>
                  <Option value="no_redpacket">无红包余额</Option>
                  <Option value="gt_100">红包余额 {'>'} 100</Option>
                </Select>
              </Col>
              <Col span={8}>
                <Select
                  style={{ width: '100%' }}
                  placeholder="按账户状态筛选"
                  onChange={(value) => setStatusFilter(value)}
                  allowClear
                >
                  <Option value="active">活跃账户</Option>
                  <Option value="inactive">非活跃账户</Option>
                  <Option value="locked">已锁定账户</Option>
                </Select>
              </Col>
            </Row>
            <Button 
              type="primary"
              onClick={() => {
                // 根据筛选条件过滤账户
                let filtered = [...accounts];
                
                if (balanceFilter) {
                  switch (balanceFilter) {
                    case 'gt_100':
                      filtered = filtered.filter(a => parseFloat(a.availableBalance || '0') > 100);
                      break;
                    case 'gt_1000':
                      filtered = filtered.filter(a => parseFloat(a.availableBalance || '0') > 1000);
                      break;
                    case 'gt_10000':
                      filtered = filtered.filter(a => parseFloat(a.availableBalance || '0') > 10000);
                      break;
                    case 'lt_100':
                      filtered = filtered.filter(a => parseFloat(a.availableBalance || '0') < 100);
                      break;
                    case 'lt_10':
                      filtered = filtered.filter(a => parseFloat(a.availableBalance || '0') < 10);
                      break;
                  }
                }
                
                if (statusFilter) {
                  switch (statusFilter) {
                    case 'active':
                      filtered = filtered.filter(a => a.status === 'active');
                      break;
                    case 'inactive':
                      filtered = filtered.filter(a => a.status === 'inactive');
                      break;
                    case 'locked':
                      filtered = filtered.filter(a => a.status === 'locked');
                      break;
                  }
                }
                
                setFilteredAccounts(filtered);
              }}
              style={{ marginTop: 8 }}
            >
              应用筛选
            </Button>
          </Space>
          
          <TransferContainer>
            <Transfer
              dataSource={filteredAccounts.map(account => ({
                key: account.id.toString(),
                title: account.email,
                description: `UID: ${account.uid} - 余额: ${account.availableBalance || '未知'}`,
                disabled: false
              }))}
              titles={transferMode === 'one_to_many' ? ['可选目标账户', '已选目标账户'] : ['可选源账户', '已选源账户']}
              targetKeys={targetKeys}
              onChange={handleTransferChange}
              render={item => (
                <AccountItem>
                  <div>{item.title}</div>
                  <div>{item.description}</div>
                </AccountItem>
              )}
              listStyle={{ width: 450, height: 400 }}
              showSearch
            />
          </TransferContainer>
        </Space>
      </StyledCard>
    );
  };
  
  // 渲染第二步：配置转账参数
  const renderStep2 = () => {
    return (
      <StyledCard>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Title level={4}>配置转账金额</Title>
          
          <Radio.Group onChange={handleAmountTypeChange} value={amountType}>
            <Space direction="vertical">
              <Radio value="equal">均分总金额</Radio>
              <Radio value="fixed">每账户固定金额</Radio>
              <Radio value="custom">自定义每账户金额</Radio>
            </Space>
          </Radio.Group>
          
          <Divider />
          
          {amountType === 'equal' && (
            <div>
              <Title level={5}>总金额</Title>
              <InputNumber
                style={{ width: 200 }}
                placeholder="输入总金额"
                value={totalAmount ? parseFloat(totalAmount) : undefined}
                onChange={handleTotalAmountChange}
                min={0}
                precision={6}
              />
              <Paragraph type="secondary" style={{ marginTop: 8 }}>
                每个账户将收到: {totalAmount && selectedAccounts.length > 0 
                  ? (parseFloat(totalAmount) / selectedAccounts.length).toFixed(6) 
                  : '0'
                }
              </Paragraph>
            </div>
          )}
          
          {amountType === 'fixed' && (
            <div>
              <Title level={5}>每账户金额</Title>
              <InputNumber
                style={{ width: 200 }}
                placeholder="输入每账户金额"
                value={fixedAmount ? parseFloat(fixedAmount) : undefined}
                onChange={handleFixedAmountChange}
                min={0}
                precision={6}
              />
              <Paragraph type="secondary" style={{ marginTop: 8 }}>
                总金额: {fixedAmount && selectedAccounts.length > 0 
                  ? (parseFloat(fixedAmount) * selectedAccounts.length).toFixed(6) 
                  : '0'
                }
              </Paragraph>
            </div>
          )}
          
          {amountType === 'custom' && (
            <div>
              <Title level={5}>自定义金额</Title>
              <List
                dataSource={selectedAccounts}
                renderItem={(account, index) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar icon={<UserOutlined />} />}
                      title={account.email}
                      description={`UID: ${account.uid}`}
                    />
                    <InputNumber
                      placeholder="输入金额"
                      value={customAmounts[account.id.toString()] 
                        ? parseFloat(customAmounts[account.id.toString()]) 
                        : undefined
                      }
                      onChange={(value) => handleCustomAmountChange(index, value)}
                      min={0}
                      precision={6}
                    />
                  </List.Item>
                )}
              />
              <Paragraph type="secondary" style={{ marginTop: 8 }}>
                总金额: {Object.values(customAmounts).reduce((sum, amount) => 
                  sum + (parseFloat(amount) || 0), 0
                ).toFixed(6)}
              </Paragraph>
            </div>
          )}
          
          <Divider />
          
          <Title level={4}>其他设置</Title>
          
          <div>
            <Title level={5}>备注</Title>
            <Input.TextArea
              placeholder="输入转账备注"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={4}
            />
          </div>
          
          <div style={{ marginTop: 16 }}>
            <Checkbox checked={auto2FA} onChange={(e) => setAuto2FA(e.target.checked)}>
              使用自动2FA验证（需要先配置2FA）
            </Checkbox>
          </div>
        </Space>
      </StyledCard>
    );
  };
  
  // 渲染第三步：执行转账
  const renderStep3 = () => {
    return (
      <StyledCard>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Title level={4}>转账预览</Title>
          
          <Alert
            message="转账信息确认"
            description={
              <div>
                <p>转账模式: {transferMode === 'one_to_many' ? '一对多转账' : '多对一转账'}</p>
                {transferMode === 'one_to_many' && sourceAccount && (
                  <p>源账户: {sourceAccount.email} (UID: {sourceAccount.uid})</p>
                )}
                {transferMode === 'many_to_one' && targetAccount && (
                  <p>目标账户: {targetAccount.email} (UID: {targetAccount.uid})</p>
                )}
                <p>账户数量: {selectedAccounts.length}</p>
                <p>金额类型: {
                  amountType === 'equal' ? '均分总金额' : 
                  amountType === 'fixed' ? '每账户固定金额' : 
                  '自定义每账户金额'
                }</p>
                <p>总金额: {
                  amountType === 'equal' ? totalAmount : 
                  amountType === 'fixed' ? (parseFloat(fixedAmount) * selectedAccounts.length).toFixed(6) : 
                  Object.values(customAmounts).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0).toFixed(6)
                }</p>
                {remarks && <p>备注: {remarks}</p>}
                <p>自动2FA验证: {auto2FA ? '是' : '否'}</p>
              </div>
            }
            type="info"
            showIcon
          />
          
          {processStatus === 'idle' ? (
            <ButtonGroup>
              <Button 
                type="primary" 
                size="large" 
                icon={<SendOutlined />} 
                onClick={handleExecuteTransfer}
                loading={loading}
              >
                执行批量转账
              </Button>
            </ButtonGroup>
          ) : (
            <>
              {renderProgress()}
              
              {processStatus !== 'processing' && renderResultSummary()}
              
              <Title level={4} style={{ marginTop: 24 }}>最近处理的转账</Title>
              <Table
                dataSource={recentTransfers}
                rowKey="id"
                columns={[
                  {
                    title: '源账户',
                    dataIndex: 'source_account_id',
                    key: 'source_account_id',
                  },
                  {
                    title: '目标账户',
                    dataIndex: 'target_account_id',
                    key: 'target_account_id',
                  },
                  {
                    title: '金额',
                    dataIndex: 'amount',
                    key: 'amount',
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status) => (
                      <Tag color={status === 'completed' ? 'green' : 'red'}>
                        {status === 'completed' ? '成功' : '失败'}
                      </Tag>
                    ),
                  },
                ]}
              />
            </>
          )}
        </Space>
      </StyledCard>
    );
  };
  
  // 渲染步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderStep1();
      case 1:
        return renderStep2();
      case 2:
        return renderStep3();
      default:
        return null;
    }
  };
  
  // 渲染步骤操作按钮
  const renderStepActions = () => {
    return (
      <ButtonGroup>
        {currentStep > 0 && (
          <Button 
            icon={<LeftOutlined />} 
            onClick={goToPrevStep}
          >
            上一步
          </Button>
        )}
        
        {currentStep < 2 && (
          <Button 
            type="primary" 
            icon={<RightOutlined />} 
            onClick={goToNextStep}
          >
            下一步
          </Button>
        )}
        
        {currentStep === 2 && processStatus === 'idle' && (
          <Button 
            type="primary" 
            icon={<SendOutlined />} 
            onClick={handleExecuteTransfer}
            loading={loading}
          >
            执行批量转账
          </Button>
        )}
      </ButtonGroup>
    );
  };
  
  // 重置状态
  const handleReset = () => {
    // 重置所有状态
    setCurrentStep(0);
    setTargetKeys([]);
    setSourceAccount(null);
    setTargetAccount(null);
    setAmountType('equal');
    setTotalAmount('');
    setFixedAmount('');
    setCustomAmounts({});
    setRemarks('');
    setBatchId(null);
    setProcessStatus('idle');
    setProgressPercent(0);
    setSuccessCount(0);
    setFailedCount(0);
    setRecentTransfers([]);
    
    // 清除定时器
    if (progressTimer) {
      clearInterval(progressTimer);
      setProgressTimer(null);
    }
  };
  
  // 下一步
  const goToNextStep = () => {
    if (validateForm()) {
      setCurrentStep(currentStep + 1);
    }
  };
  
  // 上一步
  const goToPrevStep = () => {
    setCurrentStep(currentStep - 1);
  };
  
  return (
    <PageContainer>
      <StyledCard>
        <Title level={3}>批量转账</Title>
        
        <StepContainer>
          <Steps current={currentStep}>
            {steps.map(item => (
              <Step
                key={item.title}
                title={item.title}
                description={item.description}
                icon={item.icon}
              />
            ))}
          </Steps>
        </StepContainer>
        
        <Spin spinning={loading}>
          {renderStepContent()}
        </Spin>
        
        {processStatus === 'idle' && renderStepActions()}
      </StyledCard>
    </PageContainer>
  );
};

// 使用命名导出
export { BatchTransfer };
// 同时保留默认导出
export default BatchTransfer;