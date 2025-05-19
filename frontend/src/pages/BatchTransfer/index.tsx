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
  Modal,
  Tooltip,
  Collapse,
  Switch,
  Dropdown
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
  SyncOutlined,
  SearchOutlined,
  SettingOutlined
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
  margin-top: 8px;
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
  redPacketBalance?: string; // 添加红包余额字段
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
  const [balanceMinValue, setBalanceMinValue] = useState<string>('');
  const [balanceMaxValue, setBalanceMaxValue] = useState<string>('');
  const [redPacketMinValue, setRedPacketMinValue] = useState<string>('');
  const [redPacketMaxValue, setRedPacketMaxValue] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState<boolean>(false);
  
  // 排序设置
  const [sortField, setSortField] = useState<'balance' | 'redPacket' | ''>('balance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 显示设置
  const [displaySettings, setDisplaySettings] = useState<{
    email: boolean;
    uid: boolean;
    balance: boolean;
    redPacket: boolean;
  }>({
    email: true,
    uid: false,
    balance: true,
    redPacket: true
  });
  
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
  
  // 转账详情模态框状态
  const [detailModalVisible, setDetailModalVisible] = useState<boolean>(false);
  const [currentTransfer, setCurrentTransfer] = useState<any>(null);
  const [retryLoading, setRetryLoading] = useState<boolean>(false);
  
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
      
      // 添加name字段以满足TypeScript类型要求，但实际值会由后端处理
      const data = {
        name: batchName, // 添加name字段以符合类型定义
        type: transferMode,
        sourceAccountId: transferMode === 'one_to_many' ? sourceAccount?.id : undefined,
        targetAccountId: transferMode === 'many_to_one' ? targetAccount?.id : undefined,
        relations,
        remarks: remarks || batchName // 保留备注字段
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
          <Row align="middle" style={{ marginBottom: 12 }}>
            <Col span={6}>
              <Text strong>转账模式：</Text>
            </Col>
            <Col span={18}>
              <Space align="center">
                <Switch
                  checked={transferMode === 'many_to_one'}
                  onChange={(checked: boolean) => setTransferMode(checked ? 'many_to_one' : 'one_to_many')}
                  checkedChildren="多对一"
                  unCheckedChildren="一对多"
                />
                <Text type="secondary">
                  {transferMode === 'one_to_many' ? '一个账户转账给多个账户' : '多个账户转账给一个账户'}
                </Text>
              </Space>
            </Col>
          </Row>
          
          <Row align="middle" style={{ marginBottom: 12 }}>
            <Col span={6}>
              <Text strong>
                {transferMode === 'one_to_many' ? '源账户：' : '目标账户：'}
              </Text>
            </Col>
            <Col span={18}>
              {transferMode === 'one_to_many' ? (
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择源账户"
                  onChange={handleSourceAccountChange}
                  optionFilterProp="children"
                  showSearch
                >
                  {accounts.map(account => (
                    <Option key={account.id} value={account.id.toString()}>
                      {account.email} - UID: {account.uid} - 余额: {account.availableBalance || '未知'}{account.redPacketBalance ? ` - 红包: ${account.redPacketBalance}` : ''}
                    </Option>
                  ))}
                </Select>
              ) : (
                <Space.Compact style={{ width: '100%' }}>
                  <Select 
                    style={{ width: '25%' }} 
                    value={targetContactType}
                    onChange={(value) => setTargetContactType(value)}
                    options={[
                      { label: '内部账户', value: 'inner' },
                      { label: 'UID', value: 'uid' },
                      { label: 'Email', value: 'email' }
                    ]}
                  />
                  {targetContactType === 'inner' ? (
                    <Select
                      style={{ width: '75%' }}
                      placeholder="选择内部目标账户"
                      onChange={handleTargetAccountChange}
                      optionFilterProp="children"
                      showSearch
                    >
                      {accounts.map(account => (
                        <Option key={account.id} value={account.id.toString()}>
                          {account.email} - UID: {account.uid} - 余额: {account.availableBalance || '未知'}{account.redPacketBalance ? ` - 红包: ${account.redPacketBalance}` : ''}
                        </Option>
                      ))}
                    </Select>
                  ) : (
                    <Input 
                      style={{ width: '75%' }}
                      placeholder={targetContactType === 'uid' ? "输入目标账户UID" : "输入目标账户Email"} 
                      value={externalTargetId}
                      onChange={(e) => setExternalTargetId(e.target.value)}
                    />
                  )}
                </Space.Compact>
              )}
            </Col>
          </Row>
          
          <Divider style={{ margin: '8px 0' }} />
            
          <Row style={{ marginBottom: 8 }}>
            <Col flex="auto">
              <Text strong>
                {transferMode === 'one_to_many' ? '选择目标账户' : '选择源账户'}
              </Text>
              <Tooltip title="从列表中选择账户，点击箭头将其添加到右侧。">
                <QuestionCircleOutlined style={{ color: '#1890ff', marginLeft: 4 }} />
              </Tooltip>
            </Col>
            <Col>
              <Space>
                <Dropdown
                  overlay={
                    <div style={{ background: '#fff', padding: 16, boxShadow: '0 3px 6px rgba(0,0,0,0.16)', borderRadius: 4, width: 250 }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Text strong>显示字段设置</Text>
                        <Checkbox 
                          checked={displaySettings.email} 
                          onChange={(e) => setDisplaySettings({...displaySettings, email: e.target.checked})}
                        >
                          显示邮箱
                        </Checkbox>
                        <Checkbox 
                          checked={displaySettings.uid} 
                          onChange={(e) => setDisplaySettings({...displaySettings, uid: e.target.checked})}
                        >
                          显示UID
                        </Checkbox>
                        <Checkbox 
                          checked={displaySettings.balance} 
                          onChange={(e) => setDisplaySettings({...displaySettings, balance: e.target.checked})}
                        >
                          显示余额
                        </Checkbox>
                        <Checkbox 
                          checked={displaySettings.redPacket} 
                          onChange={(e) => setDisplaySettings({...displaySettings, redPacket: e.target.checked})}
                        >
                          显示红包余额
                        </Checkbox>
                      </Space>
                    </div>
                  }
                  trigger={['click']}
                >
                  <Button 
                    icon={<SettingOutlined />}
                    size="small"
                    style={{ marginRight: 8 }}
                  >
                    显示设置
                  </Button>
                </Dropdown>
                
                <Dropdown 
                  overlay={
                    <div style={{ background: '#fff', padding: 16, boxShadow: '0 3px 6px rgba(0,0,0,0.16)', borderRadius: 4, width: 350 }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Input.Search 
                          placeholder="搜索账户" 
                          allowClear
                          onSearch={(value) => {
                            if (value) {
                              const searchText = value.toLowerCase();
                              const filtered = accounts.filter(account => 
                                account.email.toLowerCase().includes(searchText) || 
                                (account.uid && account.uid.toLowerCase().includes(searchText))
                              );
                              setFilteredAccounts(filtered);
                            } else {
                              setFilteredAccounts(accounts);
                            }
                          }}
                        />
                          
                        <Collapse bordered={false}>
                          <Collapse.Panel header="高级筛选" key="1">
                            <Space direction="vertical" style={{ width: '100%' }}>
                              <div>
                                <Text type="secondary">余额区间：</Text>
                                <Space>
                                  <InputNumber
                                    style={{ width: 120 }}
                                    placeholder="0"
                                    value={balanceMinValue ? parseFloat(balanceMinValue) : undefined}
                                    onChange={(val) => setBalanceMinValue(val?.toString() || '')}
                                    min={0}
                                    precision={2}
                                  />
                                  <Text>至</Text>
                                  <InputNumber
                                    style={{ width: 120 }}
                                    placeholder="不限"
                                    value={balanceMaxValue ? parseFloat(balanceMaxValue) : undefined}
                                    onChange={(val) => setBalanceMaxValue(val?.toString() || '')}
                                    min={0}
                                    precision={2}
                                  />
                                </Space>
                              </div>
                              
                              <div>
                                <Text type="secondary">红包余额区间：</Text>
                                <Space>
                                  <InputNumber
                                    style={{ width: 120 }}
                                    placeholder="0"
                                    value={redPacketMinValue ? parseFloat(redPacketMinValue) : undefined}
                                    onChange={(val) => setRedPacketMinValue(val?.toString() || '')}
                                    min={0}
                                    precision={2}
                                  />
                                  <Text>至</Text>
                                  <InputNumber
                                    style={{ width: 120 }}
                                    placeholder="不限"
                                    value={redPacketMaxValue ? parseFloat(redPacketMaxValue) : undefined}
                                    onChange={(val) => setRedPacketMaxValue(val?.toString() || '')}
                                    min={0}
                                    precision={2}
                                  />
                                </Space>
                              </div>
                              
                              <div>
                                <Text type="secondary">账户状态：</Text>
                                <Select
                                  style={{ width: '100%' }}
                                  placeholder="全部"
                                  onChange={(value) => setStatusFilter(value)}
                                  allowClear
                                >
                                  <Option value="active">活跃账户</Option>
                                  <Option value="inactive">非活跃账户</Option>
                                  <Option value="locked">已锁定账户</Option>
                                </Select>
                              </div>
                            </Space>
                          </Collapse.Panel>
                        </Collapse>
                        
                        <Row gutter={8}>
                          <Col span={12}>
                            <Button 
                              block
                              onClick={() => {
                                // 重置筛选条件
                                setBalanceMinValue('');
                                setBalanceMaxValue('');
                                setRedPacketMinValue('');
                                setRedPacketMaxValue('');
                                setStatusFilter('');
                                setFilteredAccounts(accounts);
                              }}
                            >
                              重置筛选
                            </Button>
                          </Col>
                          <Col span={12}>
                            <Button 
                              type="primary"
                              block
                              onClick={() => {
                                // 根据筛选条件过滤账户
                                let filtered = [...accounts];
                                
                                // 余额区间筛选
                                if (balanceMinValue) {
                                  const minValue = parseFloat(balanceMinValue);
                                  filtered = filtered.filter(a => parseFloat(a.availableBalance || '0') >= minValue);
                                }
                                
                                if (balanceMaxValue) {
                                  const maxValue = parseFloat(balanceMaxValue);
                                  filtered = filtered.filter(a => parseFloat(a.availableBalance || '0') <= maxValue);
                                }
                                
                                // 红包余额区间筛选
                                if (redPacketMinValue) {
                                  const minValue = parseFloat(redPacketMinValue);
                                  filtered = filtered.filter(a => parseFloat(a.redPacketBalance || '0') >= minValue);
                                }
                                
                                if (redPacketMaxValue) {
                                  const maxValue = parseFloat(redPacketMaxValue);
                                  filtered = filtered.filter(a => parseFloat(a.redPacketBalance || '0') <= maxValue);
                                }
                                
                                // 账户状态筛选
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
                            >
                              应用筛选
                            </Button>
                          </Col>
                        </Row>
                      </Space>
                    </div>
                  }
                  trigger={['click']}
                >
                  <Button 
                    icon={<SearchOutlined />}
                    size="small"
                  >
                    搜索/筛选账户
                  </Button>
                </Dropdown>
              </Space>
            </Col>
          </Row>
          
          <TransferContainer>
            <Transfer
              dataSource={filteredAccounts
                .sort((a, b) => {
                  if (!sortField) return 0;
                  
                  // 处理余额排序
                  if (sortField === 'balance') {
                    const aValue = parseFloat(a.availableBalance || '0');
                    const bValue = parseFloat(b.availableBalance || '0');
                    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
                  } 
                  // 处理红包余额排序
                  else if (sortField === 'redPacket') {
                    const aValue = parseFloat(a.redPacketBalance || '0');
                    const bValue = parseFloat(b.redPacketBalance || '0');
                    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
                  }
                  
                  return 0;
                })
                .map(account => ({
                key: account.id.toString(),
                title: account.email,
                description: `UID: ${account.uid} - 余额: ${account.availableBalance || '未知'}${account.redPacketBalance ? ` - 红包: ${account.redPacketBalance}` : ''}`,
                disabled: false
              }))}
              titles={
              [
          <Row style={{display: 'flex',justifyContent: 'flex-end',alignItems: 'center',fontSize: '12px'}}>
            <Col>
                <Text>按</Text>
                <Select
                   size='small'
                  value={sortField}
                  variant='borderless'
                  suffixIcon={null}
                  onChange={(value) => setSortField(value)}
                  style={{ 
                    width: 48, 
                    color: '#1890ff', 
                    textDecoration: 'underline',
                    padding: 0,
                    margin: 0,
                    marginRight: -12,
                    fontSize: '12px',
                    fontWeight: 600
                    
                  }}
                  labelRender={(props) => {
                    return <Text style={{color: '#1890ff'}}>{props.label}</Text>
                  }}
                  dropdownStyle={{ minWidth: 80 }}
                >
                  <Option value="balance" style={{color: '#1890ff'}}>余额</Option>
                  <Option value="redPacket" style={{color: '#1890ff'}}>红包</Option>
                </Select>
                <Select
                  size='small'
                  value={sortOrder}
                  variant='borderless'
                  suffixIcon={null}
                  onChange={(value) => setSortOrder(value)}
                  style={{ 
                    width: 48, 
                    color: '#1890ff', 
                    textDecoration: 'underline',
                    padding: 0,
                    margin: 0,
                    fontSize: '12px',
                    fontWeight: 600
                  }}
                  dropdownStyle={{ minWidth: 80 }}
                  labelRender={(props) => {
                    return <Text style={{color: '#1890ff'}}>{props.label}</Text>
                  }}
                >
                  <Option value="desc" style={{color: '#1890ff'}}>倒序</Option>
                  <Option value="asc" style={{color: '#1890ff'}}>正序</Option>
                </Select>
                <Text>排列</Text>
            </Col>
          </Row>
                ]}
              targetKeys={targetKeys}
              onChange={handleTransferChange}
              render={item => {
                const account = accounts.find(a => a.id.toString() === item.key);
                return (
                  <AccountItem>
                    <div>
                      {displaySettings.email && account?.email}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {displaySettings.uid && account?.uid && (
                        <Tag color="blue">{`UID: ${account.uid}`}</Tag>
                      )}
                      {displaySettings.balance && account?.availableBalance !== undefined && (
                        <Tag color="green" style={{ padding: '2px 8px', fontSize: '14px' }}>
                          <span>余额💰: </span>
                          <span style={{ fontWeight: 'bold', fontSize: '15px' }}>
                            {account.availableBalance}
                          </span>
                        </Tag>
                      )}
                      {displaySettings.redPacket && account?.redPacketBalance !== undefined && (
                        <Tag color="red" style={{ padding: '2px 8px', fontSize: '14px' }}>
                          <span>红包🧧: </span>
                          <span style={{ fontWeight: 'bold', fontSize: '15px' }}>
                            {account.redPacketBalance}
                          </span>
                        </Tag>
                      )}
                    </div>
                  </AccountItem>
                );
              }}
              listStyle={{ width: '100%', height: 400 }}
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
            <div style={{ textAlign: 'center', margin: '24px 0' }}>
              {/* 移除重复的执行批量转账按钮，使用renderStepActions中的按钮 */}
            </div>
          ) : (
            <>
              {renderProgress()}
              
              {processStatus !== 'processing' && renderResultSummary()}
              
              <Title level={4} style={{ marginTop: 24 }}>转账详情列表</Title>
              <Table
                dataSource={recentTransfers}
                rowKey="id"
                size="small"
                scroll={{ x: 1000 }}
                pagination={{ pageSize: 10 }}
                expandable={{
                  expandedRowRender: (record) => (
                    <div style={{ padding: 12, backgroundColor: '#f9f9f9', borderRadius: 4 }}>
                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Card size="small" title="转账信息" bordered={false}>
                            <p><strong>转账ID:</strong> {record.id}</p>
                            <p><strong>创建时间:</strong> {new Date(record.created_at).toLocaleString()}</p>
                            <p><strong>更新时间:</strong> {new Date(record.updated_at).toLocaleString()}</p>
                            <p><strong>金额:</strong> <Text type="success">{record.amount}</Text></p>
                            <p><strong>联系类型:</strong> {record.contact_type}</p>
                          </Card>
                        </Col>
                        <Col span={12}>
                          {record.status === 'failed' && (
                            <Card size="small" title="失败原因" bordered={false} headStyle={{ background: '#fff2f0' }}>
                              <Alert 
                                message="转账失败" 
                                description={record.error_message || "未知错误"} 
                                type="error" 
                                showIcon 
                              />
                              <Button 
                                type="primary" 
                                danger 
                                style={{ marginTop: 16 }}
                                onClick={() => handleRetryTransfer(record.id)}
                              >
                                重试此转账
                              </Button>
                            </Card>
                          )}
                          {record.status === 'completed' && (
                            <Card size="small" title="转账结果" bordered={false} headStyle={{ background: '#f6ffed' }}>
                              <Alert 
                                message="转账成功" 
                                description="转账已成功完成" 
                                type="success" 
                                showIcon 
                              />
                            </Card>
                          )}
                          {(record.status === 'pending' || record.status === 'processing') && (
                            <Card size="small" title="处理状态" bordered={false} headStyle={{ background: '#e6f7ff' }}>
                              <Alert 
                                message={record.status === 'pending' ? "等待处理" : "处理中"} 
                                description={record.status === 'pending' ? "转账等待处理中" : "转账正在处理中"} 
                                type="info" 
                                showIcon 
                              />
                            </Card>
                          )}
                        </Col>
                      </Row>
                    </div>
                  ),
                }}
                columns={[
                  {
                    title: '源账户',
                    key: 'source',
                    render: (_, record) => {
                      // 查找源账户信息
                      const account = accounts.find(a => a.id === record.source_account_id);
                      return (
                        <Space direction="vertical" size={0}>
                          <Text>{account?.email || record.source_account_id}</Text>
                          {account?.uid && <Text type="secondary" style={{ fontSize: '12px' }}>UID: {account.uid}</Text>}
                        </Space>
                      );
                    },
                  },
                  {
                    title: '目标',
                    key: 'target',
                    render: (_, record) => {
                      // 根据联系类型展示目标信息
                      if (record.contact_type === 'inner') {
                        // 内部账户转账，查找目标账户信息
                        const account = accounts.find(a => a.id === (record.matched_account_id || record.target_account_id));
                        return (
                          <Space direction="vertical" size={0}>
                            <Text>{account?.email || record.target_identifier}</Text>
                            {account?.uid && <Text type="secondary" style={{ fontSize: '12px' }}>UID: {account.uid}</Text>}
                          </Space>
                        );
                      } else {
                        // 外部转账，显示联系类型和标识符
                        return (
                          <Space direction="vertical" size={0}>
                            <Text>{record.target_identifier}</Text>
                            <Tag color="blue">{record.contact_type.toUpperCase()}</Tag>
                          </Space>
                        );
                      }
                    },
                  },
                  {
                    title: '金额',
                    dataIndex: 'amount',
                    key: 'amount',
                    render: (amount) => (
                      <Text strong style={{ color: '#389e0d' }}>{amount}</Text>
                    ),
                  },
                  {
                    title: '状态',
                    dataIndex: 'status',
                    key: 'status',
                    render: (status) => {
                      let color = 'default';
                      let text = '未知';
                      let icon = null;
                      
                      switch (status) {
                        case 'completed':
                          color = 'success';
                          text = '成功';
                          icon = <CheckCircleOutlined />;
                          break;
                        case 'failed':
                          color = 'error';
                          text = '失败';
                          icon = <ExclamationCircleOutlined />;
                          break;
                        case 'processing':
                          color = 'processing';
                          text = '处理中';
                          icon = <SyncOutlined spin />;
                          break;
                        case 'pending':
                          color = 'warning';
                          text = '等待中';
                          icon = <QuestionCircleOutlined />;
                          break;
                      }
                      
                      return (
                        <Tag icon={icon} color={color}>
                          {text}
                        </Tag>
                      );
                    },
                  },
                  {
                    title: '操作',
                    key: 'action',
                    width: 120,
                    render: (_, record) => (
                      <Space size="small">
                        <Button 
                          type="text" 
                          size="small"
                          onClick={() => showTransferDetail(record)}
                        >
                          详情
                        </Button>
                        {record.status === 'failed' && (
                          <Button 
                            type="link" 
                            danger 
                            size="small"
                            onClick={() => handleRetryTransfer(record.id)}
                          >
                            重试
                          </Button>
                        )}
                      </Space>
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
  
  // 显示转账详情
  const showTransferDetail = (record: any) => {
    setCurrentTransfer(record);
    setDetailModalVisible(true);
  };
  
  // 重试单个转账
  const handleRetryTransfer = async (relationId: number) => {
    if (!batchId) {
      message.error('批量转账ID不存在');
      return;
    }
    
    try {
      setRetryLoading(true);
      
      const response = await batchTransferApi.retryTransferRelation(
        batchId, 
        relationId.toString(), 
        auto2FA
      );
      
      if (response.success) {
        message.success('转账重试已开始');
        
        // 更新当前转账状态为处理中
        setRecentTransfers(prevTransfers => 
          prevTransfers.map(transfer => 
            transfer.id === relationId 
              ? { ...transfer, status: 'processing' } 
              : transfer
          )
        );
        
        // 如果批量转账状态不是处理中，则设置为处理中
        if (processStatus !== 'processing') {
          setProcessStatus('processing');
        }
        
        // 关闭详情模态框
        if (currentTransfer?.id === relationId) {
          setDetailModalVisible(false);
        }
      } else {
        message.error(`重试失败: ${response.message}`);
      }
    } catch (error: any) {
      console.error('重试单个转账失败:', error);
      message.error(`重试失败: ${error.message}`);
    } finally {
      setRetryLoading(false);
    }
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
    setDetailModalVisible(false);
    setCurrentTransfer(null);
    
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
      
      {/* 转账详情模态框 */}
      <Modal
        title="转账详情"
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          currentTransfer?.status === 'failed' && (
            <Button 
              key="retry" 
              type="primary" 
              danger
              loading={retryLoading}
              onClick={() => handleRetryTransfer(currentTransfer.id)}
            >
              重试此转账
            </Button>
          )
        ].filter(Boolean)}
        width={700}
      >
        {currentTransfer && (
          <div>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small" title="基本信息" bordered={false}>
                  <p><strong>ID:</strong> {currentTransfer.id}</p>
                  <p><strong>批次ID:</strong> {currentTransfer.batch_id}</p>
                  <p><strong>金额:</strong> <Text type="success">{currentTransfer.amount}</Text></p>
                  <p><strong>创建时间:</strong> {new Date(currentTransfer.created_at).toLocaleString()}</p>
                  <p><strong>更新时间:</strong> {new Date(currentTransfer.updated_at).toLocaleString()}</p>
                </Card>
              </Col>
              <Col span={12}>
                <Card 
                  size="small" 
                  title="状态信息" 
                  bordered={false}
                  headStyle={{ 
                    background: currentTransfer.status === 'completed' ? '#f6ffed' : 
                               currentTransfer.status === 'failed' ? '#fff2f0' : 
                               '#e6f7ff' 
                  }}
                >
                  <div style={{ marginBottom: 12 }}>
                    <Tag 
                      icon={
                        currentTransfer.status === 'completed' ? <CheckCircleOutlined /> :
                        currentTransfer.status === 'failed' ? <ExclamationCircleOutlined /> :
                        currentTransfer.status === 'processing' ? <SyncOutlined spin /> :
                        <QuestionCircleOutlined />
                      } 
                      color={
                        currentTransfer.status === 'completed' ? 'success' :
                        currentTransfer.status === 'failed' ? 'error' :
                        currentTransfer.status === 'processing' ? 'processing' :
                        'warning'
                      }
                      style={{ padding: '4px 8px', fontSize: '14px' }}
                    >
                      {
                        currentTransfer.status === 'completed' ? '成功' :
                        currentTransfer.status === 'failed' ? '失败' :
                        currentTransfer.status === 'processing' ? '处理中' :
                        '等待中'
                      }
                    </Tag>
                  </div>
                  
                  {currentTransfer.status === 'failed' && currentTransfer.error_message && (
                    <Alert
                      message="失败原因"
                      description={currentTransfer.error_message}
                      type="error"
                      showIcon
                      style={{ marginBottom: 12 }}
                    />
                  )}
                </Card>
              </Col>
            </Row>
            
            <Divider style={{ margin: '16px 0' }} />
            
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small" title="源账户信息" bordered={false}>
                  {currentTransfer.source_account_id ? (
                    <>
                      {/* 查找源账户信息 */}
                      {(() => {
                        const sourceAccount = accounts.find(a => a.id === currentTransfer.source_account_id);
                        return (
                          <>
                            <p><strong>账户ID:</strong> {currentTransfer.source_account_id}</p>
                            {sourceAccount && (
                              <>
                                <p><strong>邮箱:</strong> {sourceAccount.email}</p>
                                <p><strong>UID:</strong> {sourceAccount.uid}</p>
                                <p><strong>余额:</strong> {sourceAccount.availableBalance}</p>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </>
                  ) : (
                    <Empty description="无源账户信息" />
                  )}
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" title="目标账户信息" bordered={false}>
                  {currentTransfer.contact_type && (
                    <>
                      <p><strong>联系类型:</strong> {currentTransfer.contact_type}</p>
                      <p><strong>目标标识符:</strong> {currentTransfer.target_identifier}</p>
                      
                      {/* 如果是内部账户，显示更多信息 */}
                      {currentTransfer.contact_type === 'inner' && (() => {
                        const targetAccountId = currentTransfer.matched_account_id || 
                                             currentTransfer.target_account_id || 
                                             currentTransfer.target_identifier;
                        const targetAccount = accounts.find(a => a.id === parseInt(targetAccountId));
                        
                        return targetAccount ? (
                          <>
                            <p><strong>邮箱:</strong> {targetAccount.email}</p>
                            <p><strong>UID:</strong> {targetAccount.uid}</p>
                          </>
                        ) : null;
                      })()}
                    </>
                  )}
                </Card>
              </Col>
            </Row>
            
            {/* 转账历史记录或相关信息 */}
            {currentTransfer.transfer_id && (
              <>
                <Divider style={{ margin: '16px 0' }} />
                <Card 
                  size="small" 
                  title="关联转账信息" 
                  bordered={false}
                >
                  <p><strong>关联转账ID:</strong> {currentTransfer.transfer_id}</p>
                  {/* 这里可以添加查看转账详情的按钮 */}
                </Card>
              </>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
};

// 使用命名导出
export { BatchTransfer };
// 同时保留默认导出
export default BatchTransfer;