import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Card, Typography, Row, Col, message, Radio, Switch, Modal, Spin, Collapse } from 'antd';
import { SwapOutlined, SendOutlined, HistoryOutlined, QuestionCircleOutlined, FilterOutlined, SettingOutlined } from '@ant-design/icons';
import styled from 'styled-components';
import { infiniAccountApi, transferApi } from '../../services/api';

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

// 高级搜索面板样式
const FilterPanel = styled.div`
  margin-top: 10px;
  margin-bottom: 15px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
  background: #fafafa;
`;

const SortButton = styled(Button)`
  margin: 0 5px;
  min-width: 80px;
`;

// 搜索按钮样式
const AdvancedSearchButton = styled(Button)`
  margin-left: 8px;
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

  // 加载Infini账户列表
  useEffect(() => {
    const fetchAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const response = await infiniAccountApi.getAllInfiniAccounts();
        if (response.success && response.data) {
          // 使用当前排序字段和顺序排序
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
  }, [sortField, sortOrder]);
  
  // 当排序条件改变时重新排序账户列表
  useEffect(() => {
    if (accounts.length > 0) {
      const sortedAccounts = sortAccounts(accounts, sortField, sortOrder);
      setAccounts(sortedAccounts);
    }
  }, [sortField, sortOrder]);
  
  // 处理排序字段变化
  const handleSortFieldChange = (field: 'balance' | 'email' | 'uid') => {
    setSortField(field);
  };
  
  // 处理排序顺序变化
  const handleSortOrderChange = (order: 'asc' | 'desc') => {
    setSortOrder(order);
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
  
  // 高级搜索和排序状态
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  
  // 切换高级搜索面板显示状态
  const toggleFilterPanel = () => {
    setShowFilterPanel(!showFilterPanel);
  };
  
  // 渲染高级搜索面板
  const renderFilterPanel = () => {
    if (!showFilterPanel) return null;
    
    return (
      <FilterPanel>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={5} style={{ margin: 0 }}><FilterOutlined /> 账户高级筛选</Title>
              <Text type="secondary">
                当前: 按
                <Text strong style={{ color: '#1890ff', margin: '0 4px' }}>
                  {sortField === 'balance' ? '余额' : (sortField === 'email' ? '邮箱' : 'UID')}
                </Text>
                <Text strong style={{ color: '#1890ff', margin: '0 4px' }}>
                  {sortOrder === 'asc' ? '升序' : '降序'}
                </Text>
                排列
              </Text>
            </div>
          </Col>
          
          <Col span={12}>
            <div>
              <Text strong>排序字段：</Text>
              <div style={{ marginTop: 8 }}>
                <SortButton 
                  type={sortField === 'balance' ? 'primary' : 'default'}
                  onClick={() => handleSortFieldChange('balance')}
                >
                  余额
                </SortButton>
                <SortButton 
                  type={sortField === 'email' ? 'primary' : 'default'}
                  onClick={() => handleSortFieldChange('email')}
                >
                  邮箱
                </SortButton>
                <SortButton 
                  type={sortField === 'uid' ? 'primary' : 'default'}
                  onClick={() => handleSortFieldChange('uid')}
                >
                  UID
                </SortButton>
              </div>
            </div>
          </Col>
          
          <Col span={12}>
            <div>
              <Text strong>排序方式：</Text>
              <div style={{ marginTop: 8 }}>
                <SortButton 
                  type={sortOrder === 'asc' ? 'primary' : 'default'}
                  onClick={() => handleSortOrderChange('asc')}
                  icon={<SwapOutlined style={{ transform: 'rotate(90deg)' }} />}
                >
                  升序
                </SortButton>
                <SortButton 
                  type={sortOrder === 'desc' ? 'primary' : 'default'}
                  onClick={() => handleSortOrderChange('desc')}
                  icon={<SwapOutlined style={{ transform: 'rotate(-90deg)' }} />}
                >
                  降序
                </SortButton>
              </div>
            </div>
          </Col>
        </Row>
      </FilterPanel>
    );
  };
  // 处理转账提交
  const handleSubmit = async (values: any) => {
    setLoading(true);
    try {
      // 准备转账参数
      const sourceAccountId = values.sourceAccount;
      
      // 不同转账目标的处理
      let targetIdentifier = '';
      
      if (targetType === 'internal') {
        // 内部账户转账
        targetIdentifier = values.internalTarget;
      } else {
        // 外部账户转账
        targetIdentifier = values.externalTarget;
      }
      
      // 确保金额作为字符串处理
      const amount = values.amount.toString();
      const source = values.source || 'manual';
      const isForced = values.isForced || false;
      const remarks = values.memo || '';
      
      // 调用内部转账API
      const response = await transferApi.executeInternalTransfer(
        sourceAccountId,
        contactType,
        targetIdentifier,
        amount,
        source,
        isForced,
        remarks
      );
      
      // 处理API响应
      if (response.success) {
        message.success('转账成功');
        form.resetFields();
      } else {
        // 检查是否需要2FA验证
        if (response.data && response.data.require2FA) {
          // 保存转账ID，显示验证码输入弹窗
          setCurrentTransferId(response.data.transferId);
          setShowVerifyModal(true);
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
                const forceResponse = await transferApi.executeInternalTransfer(
                  sourceAccountId,
                  contactType,
                  targetIdentifier,
                  amount,
                  source,
                  true, // 强制执行
                  remarks
                );
                
                if (forceResponse.success) {
                  message.success('转账成功');
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
  // 处理2FA验证码提交
  const handleVerifySubmit = async (values: any) => {
    if (!currentTransferId) return;
    
    setLoading(true);
    try {
      const response = await transferApi.continueTransferWith2FA(
        currentTransferId,
        values.verificationCode
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

  return (
    <div>
      <Title level={3}>账户转账</Title>
      
      <GlassCard>
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
                        {!loadingAccounts && accounts.length > 0 && (
                          <AdvancedSearchButton 
                            type="link" 
                            icon={<SettingOutlined />} 
                            onClick={toggleFilterPanel}
                            size="small"
                          >
                            高级搜索
                          </AdvancedSearchButton>
                        )}
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
                  
                  {/* 高级搜索面板 */}
                  {!loadingAccounts && accounts.length > 0 && renderFilterPanel()}
                  
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
                  <Form.Item
                    name="isForced"
                    label={
                      <span>
                        强制执行 
                        <Text type="secondary" style={{ marginLeft: 8 }}>
                          <QuestionCircleOutlined /> 忽略风险警告
                        </Text>
                      </span>
                    }
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
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
                  onClick={() => message.info('转账记录功能待实现')}
                >
                  转账记录
                </Button>
              </ButtonGroup>
            </Form>
          )}
        </FormSection>
      </GlassCard>
      
      {/* 2FA验证码输入弹窗 */}
      <Modal
        title="输入2FA验证码"
        open={showVerifyModal}
        onOk={() => verifyForm.submit()}
        onCancel={handleVerifyCancel}
        confirmLoading={loading}
      >
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