/**
 * 批量注册随机用户模态框
 * 用于批量完成随机用户注册、自动2FA、自动KYC和一键开卡的功能
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  message,
  Checkbox,
  Space,
  Spin,
  Typography,
  Result,
  Divider,
  Descriptions,
  Select,
  Tooltip,
  InputNumber,
  Progress,
  List,
  Card,
  Tag
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  SafetyCertificateOutlined,
  IdcardOutlined,
  CreditCardOutlined,
  TeamOutlined,
  PlusOutlined,
  NumberOutlined
} from '@ant-design/icons';
import api, { infiniAccountApi, randomUserApi, totpToolApi, kycImageApi, apiBaseUrl, configApi, emailAccountApi } from '../services/api';

const { Text } = Typography;

// 接口定义
interface BatchRegisterProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onRegisterSuccess: (account: any) => void; // 每注册成功一个账户就回调一次
}

// 表单数据接口
interface BatchRegisterFormData {
  enable2fa: boolean;
  enableKyc: boolean;
  enableCard: boolean;
  mainEmail: string;
  groupId: string;
  invitationCode: string;
  batchCount: number;
}

// 注册结果接口
interface RegisterResult {
  success: boolean;
  accountId?: number;
  email?: string;
  userId?: string;
  is2faEnabled?: boolean;
  isKycEnabled?: boolean;
  isCardEnabled?: boolean;
  message?: string;
}

// 批量注册随机用户模态框组件
const BatchRegisterModal: React.FC<BatchRegisterProps> = ({ visible, onClose, onSuccess, onRegisterSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [registerResults, setRegisterResults] = useState<RegisterResult[]>([]);
  const [mainEmail, setMainEmail] = useState<string>(''); // 存储已选择的主邮箱（显示用）
  const [selectedEmailId, setSelectedEmailId] = useState<string>(''); // 存储选中主邮箱的ID
  const [invitationCode, setInvitationCode] = useState<string>('TC7MLI9'); // 邀请码，默认值TC7MLI9
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]); // 邮箱账户列表
  const [loadingEmails, setLoadingEmails] = useState(false); // 邮箱列表加载状态
  const [accountGroups, setAccountGroups] = useState<any[]>([]); // 账户分组列表
  const [loadingGroups, setLoadingGroups] = useState(false); // 分组列表加载状态
  const [selectedGroupId, setSelectedGroupId] = useState<string>(''); // 存储选中分组的ID
  const [newGroupName, setNewGroupName] = useState<string>(''); // 新建分组名称
  const [creatingGroup, setCreatingGroup] = useState(false); // 创建分组状态

  // 批量注册相关状态
  const [currentCount, setCurrentCount] = useState(0); // 当前已注册数量
  const [totalCount, setTotalCount] = useState(0); // 计划注册总数
  const [batchRunning, setBatchRunning] = useState(false); // 批量注册是否正在进行
  const [batchProgress, setBatchProgress] = useState(0); // 批量注册进度

  // 获取邮箱账户列表和账户分组列表
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingEmails(true);
        setLoadingGroups(true);
        
        // 获取所有邮箱账户
        const emailResponse = await emailAccountApi.getAllEmailAccounts();
        if (emailResponse.success && emailResponse.data) {
          console.log('获取到邮箱账户列表:', emailResponse.data);
          setEmailAccounts(emailResponse.data);
          
          // 如果有默认邮箱账户，自动选中
          const defaultAccount = emailResponse.data.find((account: any) => account.isDefault);
          if (defaultAccount) {
            setMainEmail(defaultAccount.email);
            setSelectedEmailId(defaultAccount.id);
            form.setFieldsValue({ mainEmail: defaultAccount.id });
            console.log('自动选择默认邮箱:', defaultAccount.email, '邮箱ID:', defaultAccount.id);
          }
        }
        
        // 获取所有账户分组
        const groupResponse = await infiniAccountApi.getAllAccountGroups();
        if (groupResponse.success && groupResponse.data) {
          console.log('获取到账户分组列表:', groupResponse.data);
          setAccountGroups(groupResponse.data);
          
          // 如果有默认分组，自动选中
          const defaultGroup = groupResponse.data.find((group: any) => group.name === '默认分组');
          if (defaultGroup) {
            setSelectedGroupId(defaultGroup.id);
            form.setFieldsValue({ groupId: defaultGroup.id });
            console.log('自动选择默认分组:', defaultGroup.name, '分组ID:', defaultGroup.id);
          }
        }
      } catch (error) {
        console.error('获取初始数据失败:', error);
        message.error('获取初始数据失败，请稍后重试');
      } finally {
        setLoadingEmails(false);
        setLoadingGroups(false);
      }
    };
    
    if (visible) {
      fetchData();
    }
  }, [visible, form]);
  
  // 重置状态
  const resetState = () => {
    form.resetFields();
    setRegisterResults([]);
    setCurrentCount(0);
    setTotalCount(0);
    setBatchRunning(false);
    setBatchProgress(0);
  };
  
  // 处理关闭
  const handleClose = () => {
    // 如果批量注册正在进行，提示用户确认
    if (batchRunning) {
      Modal.confirm({
        title: '批量注册正在进行中',
        content: '确定要取消当前的批量注册操作吗？',
        okText: '确定',
        cancelText: '取消',
        onOk: () => {
          resetState();
          onClose();
        }
      });
      return;
    }
    
    resetState();
    onClose();
  };
  
  // 处理主邮箱改变事件
  const handleMainEmailChange = (value: string) => {
    // 根据选中的ID找到对应的邮箱对象
    const selectedEmail = emailAccounts.find(account => account.id === value);
    if (selectedEmail) {
      setMainEmail(selectedEmail.email); // 保存邮箱地址用于显示
      setSelectedEmailId(value); // 保存邮箱ID用于API调用
      console.log('已选择主邮箱:', selectedEmail.email, '邮箱ID:', value);
    }
  };
  
  // 处理分组改变事件
  const handleGroupChange = (value: string) => {
    setSelectedGroupId(value);
    console.log('已选择分组ID:', value);
  };
  
  // 创建新分组
  const handleCreateGroup = async () => {
    if (!newGroupName || newGroupName.trim() === '') {
      message.error('分组名称不能为空');
      return;
    }
    
    try {
      setCreatingGroup(true);
      const response = await infiniAccountApi.createAccountGroup({
        name: newGroupName.trim()
      });
      
      if (response.success && response.data) {
        message.success('创建分组成功');
        console.log('创建分组成功:', response.data);
        
        // 添加新分组到列表
        setAccountGroups([...accountGroups, response.data]);
        
        // 自动选中新创建的分组
        setSelectedGroupId(response.data.id);
        form.setFieldsValue({ groupId: response.data.id });
        
        // 清空输入框
        setNewGroupName('');
      } else {
        message.error(response.message || '创建分组失败');
      }
    } catch (error) {
      console.error('创建分组失败:', error);
      message.error('创建分组失败，请稍后重试');
    } finally {
      setCreatingGroup(false);
    }
  };

  // 执行单次注册
  const executeSingleRegister = async (values: any, index: number): Promise<RegisterResult> => {
    try {
      // 准备请求参数
      const setupOptions = {
        enable2fa: values.enable2fa,
        enableKyc: values.enableKyc,
        enableCard: values.enableCard,
        cardType: 3 // 默认使用Card 3
      };
      
      // 提取后缀，并准备数据
      let emailSuffix = '';
      if (mainEmail) { // 使用mainEmail变量(存储了邮箱地址)来提取后缀
        // 尝试从主邮箱中提取后缀
        const atIndex = mainEmail.indexOf('@');
        if (atIndex !== -1) {
          emailSuffix = mainEmail.substring(atIndex + 1);
        }
      }
      
      // 如果无法从主邮箱提取后缀，使用默认值
      if (!emailSuffix) {
        emailSuffix = 'protonmail.com';
      }
      
      const userData = {
        email_suffix: emailSuffix, // 为了满足API类型要求
        main_email: selectedEmailId, // 使用邮箱ID作为主邮箱标识
        invitation_code: values.invitationCode || invitationCode, // 使用表单中的邀请码，如果没有则使用默认值
        group_id: values.groupId || selectedGroupId // 使用选中的分组ID
      };
      
      console.log(`执行第 ${index+1} 次注册，参数:`, { setupOptions, userData });
      
      // 直接使用axios发送请求，避免可能的API封装问题
      const requestData = {
        setupOptions,
        userData
      };
      
      console.log(`直接发送API请求，数据:`, JSON.stringify(requestData, null, 2));
      
      // 调用后端API
      const response = await api.post(`${apiBaseUrl}/api/infini-accounts/one-click-setup`, requestData);
      
      console.log(`第 ${index+1} 次注册原始响应:`, response);
      
      // 解构响应数据
      const responseData = response.data;
      
      console.log(`第 ${index+1} 次注册响应数据:`, responseData);
      
      if (!responseData.success) {
        throw new Error(responseData.message || '注册失败');
      }
      
      // 提取响应数据
      const { accountId, randomUser, account, steps } = responseData;
      
      // 确定各步骤执行状态
      const is2faEnabled = steps && steps.twoFa && steps.twoFa.success || false;
      const isKycEnabled = steps && steps.kyc && steps.kyc.success || false;
      const isCardEnabled = steps && steps.card && steps.card.success || false;
      
      // 返回注册结果
      return {
        success: true,
        accountId: account.id,
        email: randomUser.full_email,
        userId: account.userId,
        is2faEnabled,
        isKycEnabled,
        isCardEnabled,
      };
    } catch (error: any) {
      console.error(`第 ${index+1} 次注册出错:`, error);
      return {
        success: false,
        message: error.message || '注册失败，请重试'
      };
    }
  };
  
  // 提交表单开始批量注册
  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      
      // 设置批量注册状态
      const batchCount = values.batchCount || 1;
      setTotalCount(batchCount);
      setCurrentCount(0);
      setBatchProgress(0);
      setBatchRunning(true);
      setRegisterResults([]);
      
      console.log('开始批量注册，计划注册数量:', batchCount);
      
      // 循环执行注册
      for (let i = 0; i < batchCount; i++) {
        if (!batchRunning) {
          console.log('批量注册被用户取消');
          break;
        }
        
        // 执行单次注册
        const result = await executeSingleRegister(values, i);
        
        // 更新进度
        setCurrentCount(i + 1);
        setBatchProgress(Math.floor(((i + 1) / batchCount) * 100));
        
        // 更新结果列表
        setRegisterResults(prevResults => [...prevResults, result]);
        
        // 如果注册成功，调用回调通知父组件更新列表
        if (result.success && result.accountId) {
          onRegisterSuccess(result);
        }
        
        // 如果不是最后一次，添加一些延迟避免API限流
        if (i < batchCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // 完成批量注册
      setBatchRunning(false);
      message.success(`批量注册完成，成功: ${registerResults.filter(r => r.success).length}，失败: ${registerResults.filter(r => !r.success).length}`);
      
      // 刷新账户列表
      onSuccess();
    } catch (error: any) {
      console.error('批量注册出错:', error);
      message.error('批量注册失败: ' + error.message);
      setBatchRunning(false);
    } finally {
      setLoading(false);
    }
  };
  
  // 渲染表单
  const renderForm = () => (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        enable2fa: true,
        enableKyc: true,
        enableCard: true,
        mainEmail: selectedEmailId,
        invitationCode: invitationCode,
        batchCount: 5 // 默认批量注册5个
      }}
    >
      <Form.Item
        name="batchCount"
        label={
          <Space>
            <NumberOutlined />
            <span>批量注册数量</span>
            <Tooltip title="设置要一次性批量注册的账户数量">
              <InfoCircleOutlined style={{ color: '#1890ff' }} />
            </Tooltip>
          </Space>
        }
        rules={[
          { required: true, message: '请输入批量注册数量' },
          { type: 'number', min: 1, max: 50, message: '批量注册数量必须在1-50之间' }
        ]}
      >
        <InputNumber min={1} max={50} style={{ width: '100%' }} placeholder="请输入批量注册数量" />
      </Form.Item>
      
      <Divider orientation="left">主邮箱选择</Divider>
      
      <Form.Item 
        name="mainEmail" 
        label="选择主邮箱 (用于接收验证码)" 
        rules={[{ required: true, message: '请选择一个主邮箱' }]}
      >
        <Select
          placeholder="请选择主邮箱"
          loading={loadingEmails}
          onChange={handleMainEmailChange}
          showSearch
          optionFilterProp="children"
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={emailAccounts.map(account => ({
            value: account.id,
            label: `${account.email}${account.isDefault ? ' (默认)' : ''}`,
          }))}
        />
      </Form.Item>
      
      <Form.Item 
        name="groupId" 
        label={
          <Space>
            <TeamOutlined />
            <span>账户分组</span>
            <Tooltip title="选择要将新账户添加到的分组，可以创建新分组">
              <InfoCircleOutlined style={{ color: '#1890ff' }} />
            </Tooltip>
          </Space>
        }
        rules={[{ required: true, message: '请选择一个账户分组' }]}
      >
        <Select
          placeholder="请选择账户分组"
          loading={loadingGroups}
          onChange={handleGroupChange}
          showSearch
          optionFilterProp="children"
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          dropdownRender={(menu) => (
            <>
              {menu}
              <Divider style={{ margin: '8px 0' }} />
              <Space style={{ padding: '0 8px 4px' }}>
                <Input
                  placeholder="输入新分组名称"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                />
                <Button
                  type="text"
                  icon={<PlusOutlined />}
                  loading={creatingGroup}
                  onClick={handleCreateGroup}
                >
                  创建分组
                </Button>
              </Space>
            </>
          )}
          options={accountGroups.map(group => ({
            value: group.id,
            label: group.name,
          }))}
        />
      </Form.Item>
      
      <Form.Item
        name="invitationCode"
        label="邀请码"
        rules={[{ required: true, message: '请输入邀请码' }]}
      >
        <Input placeholder="请输入邀请码" />
      </Form.Item>
      
      <Divider orientation="left">自动化步骤选择</Divider>
      
      <Form.Item name="enable2fa" valuePropName="checked">
        <Checkbox>
          <Space>
            <SafetyCertificateOutlined />
            自动开启2FA
          </Space>
        </Checkbox>
      </Form.Item>
      
      <Form.Item name="enableKyc" valuePropName="checked">
        <Checkbox>
          <Space>
            <IdcardOutlined />
            自动进行KYC认证
          </Space>
        </Checkbox>
      </Form.Item>
      
      <Form.Item name="enableCard" valuePropName="checked">
        <Checkbox>
          <Space>
            <CreditCardOutlined />
            自动开通卡片
          </Space>
        </Checkbox>
      </Form.Item>
      
      <Form.Item>
        <Text type="secondary">
          <InfoCircleOutlined style={{ marginRight: 8 }} />
          批量注册将自动完成选定的所有步骤，为每个账户执行相同的操作
        </Text>
      </Form.Item>
    </Form>
  );
  
  // 渲染批量注册进度
  const renderBatchProgress = () => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text strong>批量注册进度：{currentCount}/{totalCount}</Text>
        <Text>{batchProgress}%</Text>
      </div>
      <Progress percent={batchProgress} status={batchRunning ? "active" : "normal"} />
    </div>
  );
  
  // 渲染注册结果列表
  const renderResultList = () => (
    <List
      dataSource={registerResults}
      renderItem={(result, index) => (
        <List.Item>
          <Card 
            size="small" 
            title={`账户 #${index + 1}`}
            extra={
              <Tag color={result.success ? "green" : "red"}>
                {result.success ? "注册成功" : "注册失败"}
              </Tag>
            }
            style={{ width: '100%' }}
          >
            {result.success ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="账户ID">{result.accountId}</Descriptions.Item>
                <Descriptions.Item label="邮箱">{result.email}</Descriptions.Item>
                <Descriptions.Item label="用户ID">{result.userId}</Descriptions.Item>
                <Descriptions.Item label="2FA状态">
                  {result.is2faEnabled ? '已开启' : '未开启'}
                </Descriptions.Item>
                <Descriptions.Item label="KYC状态">
                  {result.isKycEnabled ? '已认证' : '未认证'}
                </Descriptions.Item>
                <Descriptions.Item label="卡片状态">
                  {result.isCardEnabled ? '已开通' : '未开通'}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <div>
                <Text type="danger">{result.message}</Text>
              </div>
            )}
          </Card>
        </List.Item>
      )}
    />
  );
  
  return (
    <Modal
      title="批量注册随机用户"
      open={visible}
      onCancel={handleClose}
      footer={
        batchRunning ? (
          // 正在进行批量注册时显示取消按钮
          <Button onClick={handleClose}>取消批量注册</Button>
        ) : registerResults.length > 0 ? (
          // 批量注册完成后显示关闭按钮
          <Button type="primary" onClick={handleClose}>关闭</Button>
        ) : (
          // 初始状态显示取消和开始按钮
          <>
            <Button onClick={handleClose}>取消</Button>
            <Button 
              type="primary" 
              onClick={() => form.submit()}
              loading={loading}
            >
              开始批量注册
            </Button>
          </>
        )
      }
      width={700}
    >
      <Spin spinning={loading && !batchRunning}>
        {registerResults.length === 0 ? (
          // 如果还没有开始注册，显示表单
          renderForm()
        ) : (
          // 如果已经开始注册，显示进度和结果
          <div>
            {renderBatchProgress()}
            <Divider>注册结果</Divider>
            {renderResultList()}
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default BatchRegisterModal;