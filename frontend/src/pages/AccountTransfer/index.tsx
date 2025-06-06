import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Card, Typography, Row, Col, message, Radio, Switch, Modal, Spin, Dropdown, Menu, Tooltip } from 'antd';
import { SwapOutlined, SendOutlined, HistoryOutlined, QuestionCircleOutlined, DownOutlined, CaretDownOutlined } from '@ant-design/icons';
import styled, { keyframes } from 'styled-components';
import { infiniAccountApi, transferApi } from '../../services/api';
import TransferHistoryDetail from '../../components/TransferHistoryDetail';

const { Title, Text } = Typography;
const { Option } = Select;

// 毛玻璃效果卡片
const GlassCard = styled(Card)`
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  margin-bottom: 24px;
`;

const FormSection = styled.div`
  max-width: 800px;
  margin: 0 auto;
`;

const TransferIcon = styled(SwapOutlined)`
  font-size: 32px;
  color: #1890ff;
  margin: 20px 0;
`;

const ButtonGroup = styled.div`
  margin-top: 24px;
  display: flex;
  justify-content: center;
  gap: 16px;
`;

// 页面布局动画
const slideInRight = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideLeft = keyframes`
  from {
    width: 100%;
  }
  to {
    width: 60%;
  }
`;

// 左右分屏布局容器
const SplitLayout = styled.div<{ showTimeline: boolean }>`
  display: flex;
  width: 100%;
  position: relative;
  transition: all 0.3s ease-in-out;
`;

// 左侧转账表单区域
const FormContainer = styled.div<{ showTimeline: boolean }>`
  flex: ${props => props.showTimeline ? '0 0 60%' : '0 0 100%'};
  transition: all 0.5s ease-in-out;
  animation: ${props => props.showTimeline ? slideLeft : 'none'} 0.5s ease-in-out;
`;

// 右侧转账记录时间轴区域
const TimelineContainer = styled.div<{ visible: boolean }>`
  flex: 0 0 40%;
  max-width: 40%;
  padding-left: 24px;
  border-left: 1px solid #f0f0f0;
  overflow: hidden;
  height: calc(100vh - 200px);
  position: relative;
  display: ${props => props.visible ? 'block' : 'none'};
  animation: ${props => props.visible ? slideInRight : 'none'} 0.5s ease-in-out;
`;

// 排序按钮样式
const SortLabel = styled.span`
  margin-left: 16px;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.65);
`;

const SortOption = styled.span`
  cursor: pointer;
  color: #1890ff;
  font-weight: bold;
  margin: 0 4px;
  border-bottom: 1px dashed #1890ff;
  
  &:hover {
    opacity: 0.8;
  }
`;

// 转账来源选项
const transferSources = [
  { value: 'manual', label: '手动转账' },
  { value: 'affiliate', label: 'Affiliate返利' },
  { value: 'batch', label: '批量转账' },
  { value: 'scheduled', label: '定时任务' }
];

/**
 * 账户转账页面
 * 实现账户间转账功能，支持内部账户和外部账户转账
 */
const AccountTransfer: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  
  // 转账类型状态
  const [targetType, setTargetType] = useState<'internal' | 'external'>('internal');
  const [contactType, setContactType] = useState<'uid' | 'email'>('uid');
  
  // 排序状态
  const [sortField, setSortField] = useState<'balance' | 'email' | 'uid'>('balance');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // 2FA验证状态
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyForm] = Form.useForm();
  const [currentTransferId, setCurrentTransferId] = useState<string | null>(null);
  
  // 转账记录面板状态
  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineSourceId, setTimelineSourceId] = useState<string>('');
  const [timelineTargetId, setTimelineTargetId] = useState<string>('');
  const [timelineIsInternal, setTimelineIsInternal] = useState(true);
  const [timelineTransferId, setTimelineTransferId] = useState<string | number | undefined>(undefined);

  // 按指定字段和顺序排序账户
  const sortAccounts = (accounts: any[], field: string, order: 'asc' | 'desc') => {
    return [...accounts].sort((a, b) => {
      let valueA, valueB;
      
      if (field === 'balance') {
        valueA = a.availableBalance || 0;
        valueB = b.availableBalance || 0;
      } else if (field === 'email') {
        valueA = a.email?.toLowerCase() || '';
        valueB = b.email?.toLowerCase() || '';
      } else { // uid
        valueA = a.uid?.toString() || '';
        valueB = b.uid?.toString() || '';
      }
      
      // 升序或降序
      if (order === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });
  };

  // 存储原始账户数据
  const [originalAccounts, setOriginalAccounts] = useState<any[]>([]);
  
  // 加载Infini账户列表 - 只在组件加载时获取一次数据
  useEffect(() => {
    const fetchAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const response = await infiniAccountApi.getAllInfiniAccounts();
        if (response.success && response.data) {
          // 保存原始数据
          setOriginalAccounts(response.data);
          // 初始排序
          const sortedAccounts = sortAccounts(response.data, sortField, sortOrder);
          setAccounts(sortedAccounts);
        } else {
          message.error('获取账户列表失败');
        }
      } catch (error) {
        console.error('获取账户列表失败:', error);
        message.error('获取账户列表失败，请检查网络连接');
      } finally {
        setLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, []); // 不依赖排序字段，只加载一次
  
  // 处理排序字段变化 - 只在本地排序，不重新加载数据
  const handleSortFieldChange = (field: 'balance' | 'email' | 'uid') => {
    // 保存用户当前选择的值
    const currentValues = form.getFieldsValue();
    
    // 更新排序字段
    setSortField(field);
    
    // 本地重新排序
    const sortedAccounts = sortAccounts(originalAccounts, field, sortOrder);
    setAccounts(sortedAccounts);
  };
  
  // 处理排序顺序变化 - 只在本地排序，不重新加载数据
  const handleSortOrderChange = (order: 'asc' | 'desc') => {
    // 保存用户当前选择的值
    const currentValues = form.getFieldsValue();
    
    // 更新排序顺序
    setSortOrder(order);
    
    // 本地重新排序
    const sortedAccounts = sortAccounts(originalAccounts, sortField, order);
    setAccounts(sortedAccounts);
  };

  // 模糊搜索过滤函数
  const filterOption = (input: string, option: any) => {
    // 搜索邮箱和UID
    const emailMatch = option.label.toLowerCase().indexOf(input.toLowerCase()) >= 0;
    const uidMatch = option.value.toString().indexOf(input) >= 0;
    const balanceStr = option.balance?.toString() || '';
    const balanceMatch = balanceStr.indexOf(input) >= 0;
    return emailMatch || uidMatch || balanceMatch;
  };
  
  // 渲染排序字段菜单
  const fieldMenu = (
    <Menu
      onClick={({key}) => handleSortFieldChange(key as 'balance' | 'email' | 'uid')}
      selectedKeys={[sortField]}
    >
      <Menu.Item key="balance">余额</Menu.Item>
      <Menu.Item key="email">邮箱</Menu.Item>
      <Menu.Item key="uid">UID</Menu.Item>
    </Menu>
  );
  
  // 渲染排序顺序菜单
  const orderMenu = (
    <Menu
      onClick={({key}) => handleSortOrderChange(key as 'asc' | 'desc')}
      selectedKeys={[sortOrder]}
    >
      <Menu.Item key="asc">升序</Menu.Item>
      <Menu.Item key="desc">降序</Menu.Item>
    </Menu>
  );
  
  // 渲染排序标签
  const renderSortLabel = () => {
    if (loadingAccounts || accounts.length === 0) return null;
    
    return (
      <SortLabel>
        按 
        <Dropdown overlay={fieldMenu} trigger={['click']}>
          <SortOption>
            {sortField === 'balance' ? '余额' : (sortField === 'email' ? '邮箱' : 'UID')}
            <CaretDownOutlined style={{ fontSize: '12px', marginLeft: '2px' }} />
          </SortOption>
        </Dropdown>
        <Dropdown overlay={orderMenu} trigger={['click']}>
          <SortOption>
            {sortOrder === 'asc' ? '升序' : '降序'}
            <CaretDownOutlined style={{ fontSize: '12px', marginLeft: '2px' }} />
          </SortOption>
        </Dropdown>
        排列
      </SortLabel>
    );
  };
  // 处理转账提交
  const handleSubmit = async (values: any) => {
    // 准备转账参数
    const sourceAccountId = values.sourceAccount;
    
    // 不同转账目标的处理
    let targetIdentifier = '';
    let actualContactType: 'uid' | 'email' | 'inner' = contactType;
    
    if (targetType === 'internal') {
      // 内部账户转账 - 使用inner类型
      targetIdentifier = values.internalTarget;
      actualContactType = 'inner';
    } else {
      // 外部账户转账 - 使用uid或email类型
      targetIdentifier = values.externalTarget;
      actualContactType = contactType;
    }
    
    // 确保金额作为字符串处理
    const amount = values.amount.toString();
    const source = values.source || 'manual';
    const isForced = values.isForced || false;
    const remarks = values.memo || '';
    // 然后发送转账请求
    setLoading(true);
    try {
      
      // 获取自动2FA验证开关值
      const useAuto2FA = values.auto2FA || false;
      
      // 调用内部转账API，传递auto2FA参数
      const response = await transferApi.executeInternalTransfer(
        sourceAccountId,
        actualContactType,
        targetIdentifier,
        amount,
        source,
        isForced,
        remarks,
        useAuto2FA // 传递auto2FA参数
      );
      
      // 处理API响应
      if (response.success) {
        // 使用更明显的成功反馈，延长显示时间并提高优先级
        message.success({
          content: '转账提交成功！金额已从您的账户中扣除',
          duration: 5,
          style: {
            marginTop: '20vh',
          },
        });
        
        // 获取转账ID并显示该笔转账的历史记录
        if (response.data && response.data.transferId) {
          // 显示该笔转账的历史记录
          showTransferTimeline(
            sourceAccountId, 
            targetType === 'internal' ? targetIdentifier : undefined, 
            targetType === 'internal',
            response.data.transferId
          );
        } else {
          // 如果没有返回transferId，回退到显示账户的所有转账记录
          showTransferTimeline(
            sourceAccountId, 
            targetType === 'internal' ? targetIdentifier : undefined, 
            targetType === 'internal'
          );
        }
        
        form.resetFields();
      } else {
        // 检查是否需要2FA验证
        if (response.data && response.data.require2FA) {
          // 保存转账ID
          setCurrentTransferId(response.data.transferId);
          
          // 如果需要2FA验证，也同时显示转账历史记录
          if (response.data.transferId) {
            showTransferTimeline(
              sourceAccountId, 
              targetType === 'internal' ? targetIdentifier : undefined, 
              targetType === 'internal',
              response.data.transferId
            );
          }
          
          // 检查是否启用了自动2FA验证
          const useAuto2FA = values.auto2FA || false;
          
          if (useAuto2FA) {
            // 直接进行自动验证
            await handleAutoVerify();
          } else {
            // 显示验证码输入弹窗
            setShowVerifyModal(true);
          }
          return;
        }
        
        // 检查是否是重复转账风险
        if (response.data && response.data.duplicate) {
          Modal.confirm({
            title: '重复转账风险',
            content: '系统检测到可能的重复转账请求，是否强制继续？',
            okText: '继续转账',
            cancelText: '取消',
            onOk: async () => {
              // 使用相同参数，但设置isForced为true
              setLoading(true);
              try {
                // 获取自动2FA验证开关值
                const useAuto2FA = values.auto2FA || false;
                
                const forceResponse = await transferApi.executeInternalTransfer(
                  sourceAccountId,
                  actualContactType, // 使用更新后的contactType
                  targetIdentifier,
                  amount,
                  source,
                  true, // 强制执行
                  remarks,
                  useAuto2FA // 传递auto2FA参数
                );
                
                if (forceResponse.success) {
                  message.success('转账成功');
                  
                  // 获取转账ID并显示该笔转账的历史记录
                  if (forceResponse.data && forceResponse.data.transferId) {
                    showTransferTimeline(
                      sourceAccountId, 
                      targetType === 'internal' ? targetIdentifier : undefined, 
                      targetType === 'internal',
                      forceResponse.data.transferId
                    );
                  }
                  
                  form.resetFields();
                } else {
                  message.error(`转账失败: ${forceResponse.message || '未知错误'}`);
                }
              } catch (error) {
                console.error('强制转账失败:', error);
                message.error('强制转账失败，请稍后再试');
              } finally {
                setLoading(false);
              }
            }
          });
          return;
        }
        
        // 其他错误情况
        message.error(`转账失败: ${response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('转账失败:', error);
      message.error('转账失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };
  // 处理自动2FA验证 - 现在使用executeInternalTransfer
  const handleAutoVerify = async () => {
    if (!currentTransferId) return;
    
    // 获取当前表单值
    const values = form.getFieldsValue();
    const sourceAccountId = values.sourceAccount;
    const isInternal = targetType === 'internal';
    
    // 获取转账相关参数
    const targetIdentifier = isInternal ? values.internalTarget : values.externalTarget;
    const amount = values.amount.toString();
    const source = values.source || 'manual';
    const isForced = values.isForced || false;
    const remarks = values.memo || '';
    
    // 先显示转账记录时间轴
    showTransferTimeline(
      sourceAccountId, 
      isInternal ? targetIdentifier : undefined, 
      isInternal
    );
    
    setLoading(true);
    try {
      // 计算实际联系人类型
      let actualContactType: 'uid' | 'email' | 'inner' = contactType;
      if (isInternal) {
        actualContactType = 'inner';
      }

      // 使用executeInternalTransfer，设置auto2FA为true
      const response = await transferApi.executeInternalTransfer(
        sourceAccountId,
        actualContactType, // 使用正确的contactType
        targetIdentifier,
        amount,
        source,
        isForced,
        remarks,
        true, // 设置auto2FA为true
        undefined // 不提供验证码
      );
      
      if (response.success) {
        message.success('转账成功（自动验证）');
        
        form.resetFields();
        verifyForm.resetFields();
        setShowVerifyModal(false);
      } else {
        message.error(`自动验证失败: ${response.message || '未知错误'}`);
        // 自动验证失败，提示用户尝试手动输入
        message.info('请尝试手动输入验证码');
      }
    } catch (error) {
      console.error('自动2FA验证失败:', error);
      message.error('自动验证失败，请尝试手动输入验证码');
    } finally {
      setLoading(false);
    }
  };
  
  // 处理2FA验证码提交 - 现在使用executeInternalTransfer
  const handleVerifySubmit = async (values: any) => {
    if (!currentTransferId) return;
    
    // 获取当前表单值
    const formValues = form.getFieldsValue();
    const sourceAccountId = formValues.sourceAccount;
    const isInternal = targetType === 'internal';
    
    // 获取转账相关参数
    const targetIdentifier = isInternal ? formValues.internalTarget : formValues.externalTarget;
    const amount = formValues.amount.toString();
    const source = formValues.source || 'manual';
    const isForced = formValues.isForced || false;
    const remarks = formValues.memo || '';
    
    // 先显示转账记录时间轴
    showTransferTimeline(
      sourceAccountId, 
      isInternal ? targetIdentifier : undefined, 
      isInternal
    );
    
    setLoading(true);
    try {
      // 计算实际联系人类型
      let actualContactType: 'uid' | 'email' | 'inner' = contactType;
      if (isInternal) {
        actualContactType = 'inner';
      }

      // 重新调用executeInternalTransfer，传入验证码
      const response = await transferApi.executeInternalTransfer(
        sourceAccountId,
        actualContactType, // 使用正确的contactType
        targetIdentifier,
        amount,
        source,
        isForced,
        remarks,
        false, // 不自动获取验证码
        values.verificationCode // 传入用户输入的验证码
      );
      
      if (response.success) {
        message.success('转账成功');
        
        form.resetFields();
        verifyForm.resetFields();
        setShowVerifyModal(false);
      } else {
        message.error(`验证失败: ${response.message || '未知错误'}`);
      }
    } catch (error) {
      console.error('2FA验证失败:', error);
      message.error('验证失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  // 切换目标账户类型
  const handleTargetTypeChange = (e: any) => {
    setTargetType(e.target.value);
  };

  // 切换联系人类型
  const handleContactTypeChange = (value: 'uid' | 'email') => {
    setContactType(value);
  };

  // 关闭验证码弹窗
  const handleVerifyCancel = () => {
    setShowVerifyModal(false);
    verifyForm.resetFields();
  };

  // 根据选择的账户获取余额
  const getAccountBalance = (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.availableBalance || 0 : 0;
  };

  // 当源账户改变时
  const handleSourceChange = (value: string) => {
    const balance = getAccountBalance(value);
    form.setFieldsValue({ sourceBalance: balance });
  };
  
  // 关闭转账记录面板
  const handleTimelineClose = () => {
    setShowTimeline(false);
    setTimelineTransferId(undefined);
  };
  
  // 显示转账记录面板
  const showTransferTimeline = (
    sourceId: string, 
    targetId?: string, 
    isInternal: boolean = true,
    transferId?: string | number
  ) => {
    setTimelineSourceId(sourceId);
    setTimelineTargetId(targetId || '');
    setTimelineIsInternal(isInternal);
    setTimelineTransferId(transferId);
    setShowTimeline(true);
  };

  return (
    <div>
      <Title level={3}>账户转账</Title>
      
      <GlassCard>
        <SplitLayout showTimeline={showTimeline}>
          <FormContainer showTimeline={showTimeline}>
            <FormSection>
          
          {loadingAccounts ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <p>加载账户数据...</p>
            </div>
          ) : (
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              initialValues={{
                sourceBalance: 0,
                amount: '',
                targetType: 'internal',
                contactType: 'uid',
                source: 'manual',
                isForced: false
              }}
            >
              <Row gutter={24}>
                <Col span={11}>
                  <Form.Item
                    name="sourceAccount"
                    label={
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span>源账户</span>
                        {renderSortLabel()}
                      </div>
                    }
                    rules={[{ required: true, message: '请选择源账户' }]}
                  >
                    <Select
                      placeholder="选择转出账户"
                      onChange={handleSourceChange}
                      loading={loadingAccounts}
                      optionLabelProp="label"
                      showSearch
                      filterOption={filterOption}
                      optionFilterProp="label"
                      style={{ width: '100%' }}
                    >
                      {accounts.map(account => (
                        <Option 
                          key={account.id} 
                          value={account.id}
                          label={`${account.email} (${account.uid})`}
                          balance={account.availableBalance}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>{account.email} ({account.uid})</span>
                            <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                              ${account.availableBalance?.toFixed(2) || '0.00'}
                            </span>
                          </div>
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                  
                  
                  <Form.Item
                    name="sourceBalance"
                    label="可用余额 (USD)"
                  >
                    <Input 
                      disabled
                      prefix="$"
                      style={{ fontWeight: 'bold' }}
                    />
                  </Form.Item>
                </Col>
                
                <Col span={2} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <TransferIcon />
                </Col>
                
                <Col span={11}>
                  <Form.Item
                    name="targetType"
                    label="目标账户类型"
                  >
                    <Radio.Group onChange={handleTargetTypeChange} defaultValue="internal">
                      <Radio.Button value="internal">内部账户</Radio.Button>
                      <Radio.Button value="external">外部账户</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                  
                  {/* 内部账户选择 */}
                  {targetType === 'internal' && (
                    <Form.Item
                      name="internalTarget"
                      label="目标内部账户"
                      rules={[{ required: targetType === 'internal', message: '请选择目标账户' }]}
                    >
                      <Select
                        placeholder="选择转入账户"
                        loading={loadingAccounts}
                        optionLabelProp="label"
                        showSearch
                        filterOption={filterOption}
                        optionFilterProp="label"
                        style={{ width: '100%' }}
                      >
                        {accounts.map(account => (
                          <Option 
                            key={account.id} 
                            value={account.id}
                            label={`${account.email} (${account.uid})`}
                            balance={account.availableBalance}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>{account.email} ({account.uid})</span>
                              <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                                ${account.availableBalance?.toFixed(2) || '0.00'}
                              </span>
                            </div>
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  )}
                  
                  {/* 外部账户选择 */}
                  {targetType === 'external' && (
                    <>
                      <Form.Item
                        name="contactType"
                        label="联系人类型"
                      >
                        <Select 
                          defaultValue="uid"
                          onChange={handleContactTypeChange}
                        >
                          <Option value="uid">用户ID (UID)</Option>
                          <Option value="email">电子邮箱</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item
                        name="externalTarget"
                        label={contactType === 'uid' ? "目标用户ID" : "目标邮箱"}
                        rules={[{ required: targetType === 'external', message: `请输入目标${contactType === 'uid' ? '用户ID' : '邮箱'}` }]}
                      >
                        <Input placeholder={contactType === 'uid' ? "输入Infini用户ID" : "输入Infini用户邮箱"} />
                      </Form.Item>
                    </>
                  )}
                </Col>
              </Row>
              
              <Form.Item
                name="amount"
                label="转账金额 (USD)"
                rules={[
                  { required: true, message: '请输入转账金额' },
                  { pattern: /^[0-9]*\.?[0-9]+$/, message: '请输入有效的金额' },
                  { validator: (_, value) => {
                      const numValue = parseFloat(value);
                      if (isNaN(numValue) || numValue <= 0) {
                        return Promise.reject('转账金额必须大于0');
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <Input prefix="$" placeholder="输入转账金额" />
              </Form.Item>
              
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="source"
                    label="转账来源"
                    rules={[{ required: true, message: '请选择转账来源' }]}
                  >
                    <Select placeholder="选择转账来源">
                      {transferSources.map(source => (
                        <Option key={source.value} value={source.value}>
                          {source.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="isForced"
                        label={
                          <span>
                            强制执行 
                            <Tooltip title="忽略风险警告">
                              <QuestionCircleOutlined style={{ marginLeft: 4, color: 'rgba(0,0,0,0.45)' }} />
                            </Tooltip>
                          </span>
                        }
                        valuePropName="checked"
                      >
                        <Switch />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="auto2FA"
                        label={
                          <span>
                            自动2FA验证
                            <Tooltip title="自动获取验证码">
                              <QuestionCircleOutlined style={{ marginLeft: 4, color: 'rgba(0,0,0,0.45)' }} />
                            </Tooltip>
                          </span>
                        }
                        valuePropName="checked"
                        initialValue={true}
                      >
                        <Switch defaultChecked />
                      </Form.Item>
                    </Col>
                  </Row>
                </Col>
              </Row>
              
              <Form.Item
                name="memo"
                label="备注 (可选)"
              >
                <Input.TextArea rows={3} placeholder="输入转账说明或备注" />
              </Form.Item>
              
              <ButtonGroup>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={loading}
                  size="large"
                >
                  提交转账
                </Button>
                
                <Button
                  icon={<HistoryOutlined />}
                  size="large"
                  onClick={() => {
                    const sourceId = form.getFieldValue('sourceAccount');
                    if (sourceId) {
                      showTransferTimeline(sourceId, undefined, false);
                    } else {
                      message.warning('请先选择源账户');
                    }
                  }}
                >
                  转账记录
                </Button>
              </ButtonGroup>
            </Form>
          )}
            </FormSection>
          </FormContainer>
          
        {/* 转账记录时间轴面板 */}
        <TimelineContainer visible={showTimeline}>
          <TransferHistoryDetail 
            visible={showTimeline}
            transferId={timelineTransferId} // 优先使用transferId
            sourceAccountId={!timelineTransferId ? timelineSourceId : undefined} // 只有在没有transferId时才使用sourceAccountId
            targetAccountId={timelineIsInternal && !timelineTransferId ? timelineTargetId : undefined}
            isInternal={timelineIsInternal}
            onClose={handleTimelineClose}
          />
        </TimelineContainer>
        </SplitLayout>
      </GlassCard>
      
      {/* 2FA验证码输入弹窗 */}
      <Modal
        title="2FA安全验证"
        open={showVerifyModal}
        onOk={() => verifyForm.submit()}
        onCancel={handleVerifyCancel}
        confirmLoading={loading}
        footer={[
          <Button key="back" onClick={handleVerifyCancel}>
            取消
          </Button>,
          <Button 
            key="auto" 
            type="primary" 
            ghost
            loading={loading}
            onClick={handleAutoVerify}
            style={{ marginRight: 8 }}
          >
            自动验证
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={loading} 
            onClick={() => verifyForm.submit()}
          >
            手动提交
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>您可以选择以下验证方式：</Text>
          <p style={{ margin: '8px 0' }}>
            <Text mark>自动验证</Text>: 系统自动获取并应用2FA验证码，无需手动输入
          </p>
          <p style={{ margin: '8px 0' }}>
            <Text>手动提交</Text>: 手动输入验证码并提交
          </p>
        </div>
        <Form
          form={verifyForm}
          layout="vertical"
          onFinish={handleVerifySubmit}
        >
          <Form.Item
            name="verificationCode"
            label="验证码"
            rules={[
              { required: true, message: '请输入验证码' },
              { pattern: /^\d{6}$/, message: '请输入6位数字验证码' }
            ]}
          >
            <Input placeholder="输入6位数字验证码" maxLength={6} />
          </Form.Item>
          <Text type="secondary">
            请打开Google Authenticator或其他2FA应用获取验证码
          </Text>
        </Form>
      </Modal>
    </div>
  );
};

export default AccountTransfer;