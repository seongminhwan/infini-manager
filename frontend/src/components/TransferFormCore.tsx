import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Row, Col, message, Radio, Switch, Tooltip } from 'antd';
import { SendOutlined, QuestionCircleOutlined, SwapOutlined } from '@ant-design/icons';
import { infiniAccountApi, transferApi } from '../services/api';
import styled from 'styled-components';

const { Option } = Select;

// 转账图标样式
const TransferIcon = styled(SwapOutlined)`
  font-size: 24px;
  color: #1890ff;
  margin: 8px 0;
`;

// 转账来源选项
const transferSources = [
  { value: 'manual', label: '手动转账' },
  { value: 'affiliate', label: 'Affiliate返利' },
  { value: 'batch', label: '批量转账' },
  { value: 'scheduled', label: '定时任务' }
];

interface TransferFormCoreProps {
  // 预设的源账户ID（如果传入，则设置为默认值并禁用选择）
  defaultSourceAccountId?: number | string;
  // 预设的目标账户ID（如果传入，则设置为默认值）
  defaultTargetAccountId?: number | string;
  // 转账模式：in - 转入到指定账户，out - 从指定账户转出
  mode?: 'in' | 'out';
  // 是否使用紧凑布局，适合弹窗展示
  compact?: boolean;
  // 是否显示高级选项（转账来源、强制执行等）
  showAdvancedOptions?: boolean;
  // 转账完成或取消回调
  onFinished?: (success: boolean, transferId?: string | number) => void;
  // 是否显示取消按钮
  showCancelButton?: boolean;
}

/**
 * 核心转账表单组件
 * 从AccountTransfer页面提取的核心转账功能，可复用于多个场景
 */
const TransferFormCore: React.FC<TransferFormCoreProps> = ({
  defaultSourceAccountId,
  defaultTargetAccountId,
  mode = 'out',
  compact = false,
  showAdvancedOptions = true,
  onFinished,
  showCancelButton = true
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  
  // 转账类型状态
  const [targetType, setTargetType] = useState<'internal' | 'external'>('internal');
  const [contactType, setContactType] = useState<'uid' | 'email'>('uid');
  
  // 加载Infini账户列表
  useEffect(() => {
    const fetchAccounts = async () => {
      setLoadingAccounts(true);
      try {
        const response = await infiniAccountApi.getAllInfiniAccounts();
        if (response.success && response.data) {
          setAccounts(response.data);
          
        // 如果是转入模式，且有默认目标账户，设置源账户列表排除目标账户
        if (mode === 'in' && defaultTargetAccountId) {
          const targetAccount = response.data.find((acc: any) => acc.id == defaultTargetAccountId);
          if (targetAccount) {
            form.setFieldsValue({ targetAccount: targetAccount.email });
          }
        }
        
        // 如果有默认源账户ID，设置可用余额
        if (defaultSourceAccountId) {
          const sourceAccount = response.data.find((acc: any) => acc.id == defaultSourceAccountId);
          if (sourceAccount) {
            form.setFieldsValue({ 
              sourceAccount: sourceAccount.id,
              sourceBalance: sourceAccount.availableBalance || 0
            });
          }
          }
          
          // 如果有默认目标账户ID且为内部转账，设置目标账户
          if (defaultTargetAccountId && targetType === 'internal') {
            form.setFieldsValue({ internalTarget: defaultTargetAccountId });
          }
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
  }, [form, defaultSourceAccountId, defaultTargetAccountId, mode, targetType]);

  // 模糊搜索过滤函数
  const filterOption = (input: string, option: any) => {
    // 搜索邮箱和UID
    const emailMatch = option.label?.toLowerCase().indexOf(input.toLowerCase()) >= 0;
    const uidMatch = option.value?.toString().indexOf(input) >= 0;
    const balanceStr = option.balance?.toString() || '';
    const balanceMatch = balanceStr.indexOf(input) >= 0;
    return emailMatch || uidMatch || balanceMatch;
  };

  // 根据选择的账户获取余额
  const getAccountBalance = (accountId: string) => {
    const account = accounts.find(acc => acc.id == accountId);
    return account ? account.availableBalance || 0 : 0;
  };

  // 当源账户改变时
  const handleSourceChange = (value: string) => {
    const balance = getAccountBalance(value);
    form.setFieldsValue({ sourceBalance: balance });
  };

  // 切换目标账户类型
  const handleTargetTypeChange = (e: any) => {
    setTargetType(e.target.value);
  };

  // 切换联系人类型
  const handleContactTypeChange = (value: 'uid' | 'email') => {
    setContactType(value);
  };

  // 处理转账提交
  const handleSubmit = async (values: any) => {
    // 根据转账模式调整源账户和目标账户
    let sourceAccountId: string | number;
    let targetIdentifier: string;
    let actualContactType: 'uid' | 'email' | 'inner';
    
    if (mode === 'in' && defaultTargetAccountId) {
      // 转入模式：源=选择的账户，目标=预设账户
      sourceAccountId = values.sourceAccount;
      targetIdentifier = defaultTargetAccountId.toString();
      actualContactType = 'inner'; // 内部转账
    } else {
      // 转出模式或普通模式
      sourceAccountId = defaultSourceAccountId || values.sourceAccount;
      
      if (targetType === 'internal') {
        // 内部账户转账
        targetIdentifier = values.internalTarget;
        actualContactType = 'inner';
      } else {
        // 外部账户转账
        targetIdentifier = values.externalTarget;
        actualContactType = contactType;
      }
    }
    
    // 确保金额作为字符串处理
    const amount = values.amount.toString();
    const source = values.source || 'manual';
    const isForced = values.isForced || false;
    const remarks = values.memo || '';
    const useAuto2FA = values.auto2FA !== undefined ? values.auto2FA : true;
    
    setLoading(true);
    try {
      // 调用转账API
      const response = await transferApi.executeInternalTransfer(
        sourceAccountId.toString(),
        actualContactType,
        targetIdentifier,
        amount,
        source,
        isForced,
        remarks,
        useAuto2FA
      );
      
      if (response.success) {
        message.success('转账提交成功！');
        
        // 重置表单
        form.resetFields();
        
        // 调用完成回调
        if (onFinished) {
          onFinished(true, response.data?.transferId);
        }
      } else {
        // 处理需要2FA验证的情况
        if (response.data && response.data.require2FA) {
          // 这里简化处理，实际应显示2FA验证弹窗
          message.warning('需要2FA验证，请在主页面操作');
          if (onFinished) {
            onFinished(false);
          }
          return;
        }
        
        // 处理重复转账风险
        if (response.data && response.data.duplicate) {
          message.warning('检测到重复转账风险，请在主页面确认');
          if (onFinished) {
            onFinished(false);
          }
          return;
        }
        
        // 其他错误
        message.error(`转账失败: ${response.message || '未知错误'}`);
        if (onFinished) {
          onFinished(false);
        }
      }
    } catch (error: any) {
      console.error('转账失败:', error);
      message.error(`转账失败: ${error.message || '请稍后再试'}`);
      if (onFinished) {
        onFinished(false);
      }
    } finally {
      setLoading(false);
    }
  };

  // 处理取消
  const handleCancel = () => {
    if (onFinished) {
      onFinished(false);
    }
  };

  // 根据模式确定布局和表单结构
  const getFormLayout = () => {
    if (compact) {
      // 紧凑布局，适合弹窗
      if (mode === 'in' && defaultTargetAccountId) {
        // 转入模式（选择源账户，目标账户固定）
        return (
          <>
            <Form.Item
              name="sourceAccount"
              label="源账户"
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
                {accounts
                  .filter(account => account.id != defaultTargetAccountId) // 排除目标账户
                  .map(account => (
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
              name="targetAccount"
              label="目标账户"
            >
              <Input disabled />
            </Form.Item>
          </>
        );
      } else if (mode === 'out' && defaultSourceAccountId) {
        // 转出模式（源账户固定，选择目标账户）
        return (
          <>
            <Form.Item
              name="sourceAccount"
              label="源账户"
            >
              <Input disabled />
            </Form.Item>
            
            <Form.Item
              name="targetType"
              label="目标账户类型"
            >
              <Radio.Group onChange={handleTargetTypeChange} defaultValue="internal">
                <Radio.Button value="internal">内部账户</Radio.Button>
                <Radio.Button value="external">外部账户</Radio.Button>
              </Radio.Group>
            </Form.Item>
            
            {targetType === 'internal' ? (
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
                  {accounts
                    .filter(account => account.id != defaultSourceAccountId) // 排除源账户
                    .map(account => (
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
            ) : (
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
          </>
        );
      } else {
        // 常规模式（源账户和目标账户都需选择）
        return (
          <>
            <Form.Item
              name="sourceAccount"
              label="源账户"
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
                disabled={!!defaultSourceAccountId}
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
            
            <div style={{ textAlign: 'center', margin: '8px 0' }}>
              <TransferIcon />
            </div>
            
            <Form.Item
              name="targetType"
              label="目标账户类型"
            >
              <Radio.Group onChange={handleTargetTypeChange} defaultValue="internal">
                <Radio.Button value="internal">内部账户</Radio.Button>
                <Radio.Button value="external">外部账户</Radio.Button>
              </Radio.Group>
            </Form.Item>
            
            {targetType === 'internal' ? (
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
                  {accounts
                    .filter(account => account.id != form.getFieldValue('sourceAccount')) // 排除已选源账户
                    .map(account => (
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
            ) : (
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
          </>
        );
      }
    } else {
      // 常规布局，适合页面
      return (
        <>
          <Row gutter={24}>
            <Col span={11}>
              <Form.Item
                name="sourceAccount"
                label="源账户"
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
                  disabled={!!defaultSourceAccountId}
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
              
              {targetType === 'internal' ? (
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
                    {accounts
                      .filter(account => account.id != form.getFieldValue('sourceAccount')) // 排除已选源账户
                      .map(account => (
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
              ) : (
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
        </>
      );
    }
  };

  return (
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
        isForced: false,
        auto2FA: true
      }}
    >
      {getFormLayout()}
      
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
      
      {showAdvancedOptions && (
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
      )}
      
      <Form.Item
        name="memo"
        label="备注 (可选)"
      >
        <Input.TextArea rows={2} placeholder="输入转账说明或备注" />
      </Form.Item>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
        <Button
          type="primary"
          htmlType="submit"
          icon={<SendOutlined />}
          loading={loading}
        >
          提交转账
        </Button>
        
        {showCancelButton && (
          <Button onClick={handleCancel}>
            取消
          </Button>
        )}
      </div>
    </Form>
  );
};

export default TransferFormCore;