/**
 * 批量恢复账户模态框组件
 * 用于批量恢复Infini账户
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  Button,
  Input,
  Space,
  Typography,
  message,
  Table,
  Tag,
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Divider,
  Empty,
  Spin,
  List
} from 'antd';
import {
  SyncOutlined,
  MailOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  InfoCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';
import api from '../services/api';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

// 账户状态类型
type AccountStatus = 'pending' | 'processing' | 'success' | 'failed';

// 处理阶段类型
type ProcessStage = 'verificationCode' | 'resetPassword' | 'getQrcode' | 'unbind2fa' | 'setup2fa' | 'completed';

// 账户信息接口
interface AccountInfo {
  email: string;
  key: string;
  status: AccountStatus;
  errorMsg?: string;
  logs: string[];
  currentStage?: ProcessStage;
  progress: number; // 进度百分比(0-100)
}

// 处理结果统计接口
interface ProcessStats {
  total: number;
  processing: number;
  success: number;
  failed: number;
  currentEmail: string;
  currentStage: string;
  currentProgress: number;
}

// 模态框属性接口
interface BatchRecoverAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// 批量恢复账户模态框组件
const BatchRecoverAccountModal: React.FC<BatchRecoverAccountModalProps> = ({
  visible,
  onClose,
  onSuccess
}) => {
  // 账户状态
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [batchText, setBatchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStats, setProcessStats] = useState<ProcessStats>({
    total: 0,
    processing: 0,
    success: 0,
    failed: 0,
    currentEmail: '',
    currentStage: '',
    currentProgress: 0
  });
  
  // 日志和自动滚动
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  // 当前处理的账户索引
  const currentIndexRef = useRef<number>(0);
  
  // 判断是否所有账户都已处理完成
  const isAllCompleted = () => {
    return accounts.every(account => account.status === 'success' || account.status === 'failed');
  };
  
  // 重置状态
  const resetState = () => {
    setAccounts([]);
    setBatchText('');
    setLogs([]);
    setIsProcessing(false);
    setProcessStats({
      total: 0,
      processing: 0,
      success: 0,
      failed: 0,
      currentEmail: '',
      currentStage: '',
      currentProgress: 0
    });
    currentIndexRef.current = 0;
  };
  
  // 处理关闭
  const handleClose = () => {
    if (isProcessing) {
      Modal.confirm({
        title: '确认取消',
        content: '恢复账户处理正在进行中，确定要取消吗？',
        okText: '确定',
        cancelText: '继续处理',
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
  
  // 处理成功完成
  const handleSuccess = () => {
    if (processStats.success > 0) {
      message.success(`成功恢复 ${processStats.success} 个账户`);
      onSuccess();
    }
    resetState();
    onClose();
  };
  
  // 处理文本输入变化
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBatchText(e.target.value);
  };
  
  // 解析文本，提取邮箱
  const parseEmails = (text: string): string[] => {
    if (!text.trim()) return [];
    
    const lines = text.split('\n');
    const emails = lines
      .map(line => line.trim())
      .filter(line => line && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(line));
    
    return emails;
  };
  
  // 解析文本并生成账户列表
  const parseTextToAccounts = () => {
    if (!batchText.trim()) {
      message.warning('请先输入账户邮箱');
      return;
    }
    
    const emails = parseEmails(batchText);
    
    if (emails.length === 0) {
      message.warning('未找到有效的邮箱地址');
      return;
    }
    
    // 处理去重和覆盖逻辑
    const uniqueEmails = new Set<string>();
    const newAccounts: AccountInfo[] = [];
    
    // 添加新解析的邮箱
    emails.forEach(email => {
      const lowerEmail = email.toLowerCase();
      if (!uniqueEmails.has(lowerEmail)) {
        uniqueEmails.add(lowerEmail);
        newAccounts.push({
          email,
          key: `${lowerEmail}_${Date.now()}`,
          status: 'pending',
          logs: [],
          progress: 0
        });
      }
    });
    
    // 检查是否与现有账户有重复
    if (accounts.length > 0) {
      const mergedAccounts = [...accounts];
      const existingEmails = new Set(accounts.map(acc => acc.email.toLowerCase()));
      
      // 合并新账户
      newAccounts.forEach(newAcc => {
        const lowerEmail = newAcc.email.toLowerCase();
        if (!existingEmails.has(lowerEmail)) {
          mergedAccounts.push(newAcc);
        }
      });
      
      setAccounts(mergedAccounts);
      message.success(`解析成功：新增 ${newAccounts.length} 个账户`);
    } else {
      setAccounts(newAccounts);
      message.success(`解析成功：${newAccounts.length} 个账户`);
    }
  };
  
  // 手动添加账户
  const addAccount = () => {
    const newEmail = prompt('请输入账户邮箱');
    if (!newEmail) return;
    
    const email = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      message.error('请输入有效的邮箱地址');
      return;
    }
    
    const lowerEmail = email.toLowerCase();
    
    // 检查是否已存在
    if (accounts.some(acc => acc.email.toLowerCase() === lowerEmail)) {
      message.warning('该邮箱已在列表中');
      return;
    }
    
    // 添加新账户
    const newAccount: AccountInfo = {
      email,
      key: `${lowerEmail}_${Date.now()}`,
      status: 'pending',
      logs: [],
      progress: 0
    };
    
    setAccounts([...accounts, newAccount]);
    message.success(`已添加账户: ${email}`);
  };
  
  // 移除账户
  const removeAccount = (key: string) => {
    const newAccounts = accounts.filter(acc => acc.key !== key);
    setAccounts(newAccounts);
  };
  
  // 添加日志
  const addLog = (text: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${text}`;
    setLogs(prevLogs => [...prevLogs, logEntry]);
  };
  
  // 更新账户日志
  const updateAccountLog = (index: number, text: string) => {
    setAccounts(prevAccounts => {
      const newAccounts = [...prevAccounts];
      if (newAccounts[index]) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${text}`;
        newAccounts[index] = {
          ...newAccounts[index],
          logs: [...newAccounts[index].logs, logEntry]
        };
      }
      return newAccounts;
    });
    
    // 全局日志
    addLog(`[${accounts[index]?.email}] ${text}`);
  };
  
  // 更新账户状态
  const updateAccountStatus = (index: number, status: AccountStatus, errorMsg?: string) => {
    setAccounts(prevAccounts => {
      const newAccounts = [...prevAccounts];
      if (newAccounts[index]) {
        newAccounts[index] = {
          ...newAccounts[index],
          status,
          errorMsg
        };
      }
      return newAccounts;
    });
    
    // 更新统计信息
    if (status === 'success') {
      setProcessStats(prev => ({
        ...prev,
        success: prev.success + 1,
        processing: prev.processing - 1
      }));
    } else if (status === 'failed') {
      setProcessStats(prev => ({
        ...prev,
        failed: prev.failed + 1,
        processing: prev.processing - 1
      }));
    } else if (status === 'processing') {
      setProcessStats(prev => ({
        ...prev,
        processing: prev.processing + 1,
        currentEmail: accounts[index]?.email || '',
      }));
    }
  };
  
  // 更新账户进度和阶段
  const updateAccountProgress = (index: number, stage: ProcessStage, progress: number) => {
    setAccounts(prevAccounts => {
      const newAccounts = [...prevAccounts];
      if (newAccounts[index]) {
        newAccounts[index] = {
          ...newAccounts[index],
          currentStage: stage,
          progress
        };
      }
      return newAccounts;
    });
    
    // 更新统计信息
    setProcessStats(prev => ({
      ...prev,
      currentStage: getStageDisplayName(stage),
      currentProgress: progress
    }));
  };
  
  // 获取阶段显示名称
  const getStageDisplayName = (stage: ProcessStage): string => {
    switch (stage) {
      case 'verificationCode': return '获取验证码';
      case 'resetPassword': return '重置密码';
      case 'getQrcode': return '获取2FA信息';
      case 'unbind2fa': return '解绑2FA';
      case 'setup2fa': return '重新绑定2FA';
      case 'completed': return '完成';
      default: return '';
    }
  };
  
  // 处理单个账户恢复
  const processAccount = async (index: number) => {
    const account = accounts[index];
    if (!account) return false;
    
    // 更新账户状态为处理中
    updateAccountStatus(index, 'processing');
    
    try {
      // 1. 获取验证码
      updateAccountProgress(index, 'verificationCode', 20);
      updateAccountLog(index, '开始获取验证码...');
      
      const verifyCodeResponse = await infiniAccountApi.sendVerificationCode(account.email, 1);
      if (!verifyCodeResponse.success) {
        throw new Error(`获取验证码失败: ${verifyCodeResponse.message}`);
      }
      
      updateAccountLog(index, '验证码发送成功，等待获取验证码...');
      
      // 等待一段时间，确保验证码已发送到邮箱
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 获取验证码
      const codeResponse = await infiniAccountApi.fetchVerificationCode(account.email);
      if (!codeResponse.success || !codeResponse.data) {
        throw new Error('无法获取验证码，请手动检查邮箱');
      }
      
      const verificationCode = codeResponse.data;
      updateAccountLog(index, `获取到验证码: ${verificationCode}`);
      
      // 2. 重置密码
      updateAccountProgress(index, 'resetPassword', 40);
      updateAccountLog(index, '开始重置密码...');
      
      const resetResponse = await api.post(`/api/infini-accounts/reset-password`, {
        email: account.email,
        verificationCode
      });
      if (!resetResponse.data.success) {
        throw new Error(`重置密码失败: ${resetResponse.data.message}`);
      }
      
      updateAccountLog(index, '密码重置成功');
      
      // 3. 获取2FA信息
      updateAccountProgress(index, 'getQrcode', 60);
      updateAccountLog(index, '获取2FA信息...');
      
      const qrcodeResponse = await api.get(`/api/infini-accounts/2fa/qrcode?email=${account.email}`);
      if (!qrcodeResponse.data.success) {
        throw new Error(`获取2FA信息失败: ${qrcodeResponse.data.message}`);
      }
      
      updateAccountLog(index, '获取2FA信息成功');
      
      // 4. 解绑2FA
      updateAccountProgress(index, 'unbind2fa', 80);
      updateAccountLog(index, '开始解绑2FA...');
      
      // 获取账户信息，获取密码和2FA相关信息
      const accountResponse = await api.get(`/api/infini-accounts/by-email?email=${account.email}`);
      if (!accountResponse.data.success || !accountResponse.data.data) {
        throw new Error(`获取账户信息失败: ${accountResponse.data.message}`);
      }
      
      const accountData = accountResponse.data.data;
      
      if (!accountData.password) {
        throw new Error('账户密码未找到');
      }
      
      // 获取2FA验证码
      const totpResponse = await totpToolApi.generateTotpCode(accountData.id.toString());
      if (!totpResponse.success || !totpResponse.data) {
        throw new Error(`生成TOTP验证码失败: ${totpResponse.message}`);
      }
      
      const google2faToken = totpResponse.data;
      
      // 解绑2FA
      const unbindResponse = await api.post(`/api/infini-accounts/unbind-2fa`, {
        accountId: accountData.id.toString(),
        google2faToken,
        password: accountData.password
      });
      
      if (!unbindResponse.data.success) {
        throw new Error(`解绑2FA失败: ${unbindResponse.data.message}`);
      }
      
      updateAccountLog(index, '解绑2FA成功');
      
      // 5. 重新绑定2FA
      updateAccountProgress(index, 'setup2fa', 90);
      updateAccountLog(index, '开始重新绑定2FA...');
      
      // 发送2FA验证邮件
      const verify2faResponse = await infiniAccountApi.sendGoogle2faVerificationEmail(account.email, accountData.id.toString());
      if (!verify2faResponse.success) {
        throw new Error(`发送2FA验证邮件失败: ${verify2faResponse.message}`);
      }
      
      updateAccountLog(index, '2FA验证邮件发送成功，等待获取验证码...');
      
      // 等待一段时间，确保验证码已发送到邮箱
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 获取2FA验证码
      const code2faResponse = await infiniAccountApi.fetchVerificationCode(account.email);
      if (!code2faResponse.success || !code2faResponse.data) {
        throw new Error('无法获取2FA验证码，请手动检查邮箱');
      }
      
      const verification2faCode = code2faResponse.data;
      updateAccountLog(index, `获取到2FA验证码: ${verification2faCode}`);
      
      // 生成新的TOTP验证码
      const newTotpResponse = await totpToolApi.generateTotpCode(accountData.id.toString());
      if (!newTotpResponse.success || !newTotpResponse.data) {
        throw new Error(`生成新TOTP验证码失败: ${newTotpResponse.message}`);
      }
      
      const newGoogle2faToken = newTotpResponse.data;
      
      // 绑定2FA
      const bindResponse = await infiniAccountApi.bindGoogle2fa(
        accountData.id.toString(),
        verification2faCode,
        newGoogle2faToken
      );
      
      if (!bindResponse.success) {
        throw new Error(`绑定2FA失败: ${bindResponse.message}`);
      }
      
      updateAccountLog(index, '重新绑定2FA成功');
      
      // 6. 完成恢复
      updateAccountProgress(index, 'completed', 100);
      updateAccountLog(index, '账户恢复完成');
      updateAccountStatus(index, 'success');
      
      return true;
    } catch (error: any) {
      const errorMessage = error.message || '账户恢复失败';
      updateAccountLog(index, `错误: ${errorMessage}`);
      updateAccountStatus(index, 'failed', errorMessage);
      return false;
    }
  };
  
  // 批量处理账户
  const startProcessing = async () => {
    if (accounts.length === 0) {
      message.warning('请先添加要恢复的账户');
      return;
    }
    
    // 已处理过的账户，可以继续处理未完成的账户
    const pendingAccounts = accounts.filter(acc => acc.status === 'pending');
    
    if (pendingAccounts.length === 0) {
      message.warning('没有需要处理的账户');
      return;
    }
    
    try {
      setLoading(true);
      setIsProcessing(true);
      
      // 初始化统计信息
      setProcessStats({
        total: accounts.length,
        processing: 0,
        success: processStats.success,
        failed: processStats.failed,
        currentEmail: '',
        currentStage: '',
        currentProgress: 0
      });
      
      // 记录当前处理索引
      currentIndexRef.current = accounts.findIndex(acc => acc.status === 'pending');
      
      // 循环处理账户
      while (currentIndexRef.current >= 0 && currentIndexRef.current < accounts.length) {
        const account = accounts[currentIndexRef.current];
        
        if (account.status === 'pending') {
          await processAccount(currentIndexRef.current);
        }
        
        // 找到下一个待处理的账户
        currentIndexRef.current = accounts.findIndex(
          (acc, idx) => idx > currentIndexRef.current && acc.status === 'pending'
        );
      }
      
      // 处理完成
      if (isAllCompleted()) {
        message.success(`批量恢复完成：成功 ${processStats.success} 个，失败 ${processStats.failed} 个`);
      } else {
        message.info('批量恢复已暂停');
      }
    } catch (error: any) {
      message.error(`批量恢复出错: ${error.message}`);
      console.error('批量恢复出错:', error);
    } finally {
      setLoading(false);
      setIsProcessing(false);
    }
  };
  
  // 自动滚动日志到底部
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);
  
  // 渲染账户状态图标
  const renderStatusIcon = (status: AccountStatus) => {
    switch (status) {
      case 'pending':
        return <Tag color="default">待处理</Tag>;
      case 'processing':
        return <Tag color="processing" icon={<SyncOutlined spin />}>处理中</Tag>;
      case 'success':
        return <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>;
      case 'failed':
        return <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>;
      default:
        return null;
    }
  };
  
  // 表格列定义
  const columns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      render: (text: string) => (
        <div>
          <MailOutlined style={{ marginRight: 8 }} />
          {text}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: AccountStatus) => renderStatusIcon(status)
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress: number, record: AccountInfo) => (
        <Progress 
          percent={progress} 
          size="small" 
          status={
            record.status === 'processing' ? 'active' : 
            record.status === 'success' ? 'success' : 
            record.status === 'failed' ? 'exception' : 'normal'
          }
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: AccountInfo) => (
        <Button 
          danger 
          size="small" 
          disabled={record.status === 'processing' || isProcessing}
          onClick={() => removeAccount(record.key)}
        >
          删除
        </Button>
      )
    }
  ];
  
  return (
    <Modal
      title="批量恢复账户"
      open={visible}
      onCancel={handleClose}
      width={1000}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={isProcessing}>
          取消
        </Button>,
        <Button
          key="success"
          type="primary"
          onClick={handleSuccess}
          disabled={!isAllCompleted() || (processStats.success === 0 && processStats.failed === 0)}
        >
          完成
        </Button>,
        <Button
          key="start"
          type="primary"
          loading={loading}
          onClick={startProcessing}
          disabled={accounts.length === 0 || isProcessing || isAllCompleted()}
        >
          {isProcessing ? '处理中...' : '批量恢复'}
        </Button>
      ]}
    >
      <div>
        <div style={{ marginBottom: 16 }}>
          <Text>请输入账户邮箱，每行一个邮箱</Text>
          <div style={{ position: 'relative' }}>
            <TextArea
              rows={5}
              value={batchText}
              onChange={handleTextChange}
              placeholder="example@email.com
another@email.com"
              disabled={isProcessing}
            />
            <Space style={{ position: 'absolute', bottom: 8, right: 8 }}>
              <Button 
                icon={<SyncOutlined />}
                onClick={parseTextToAccounts}
                disabled={!batchText.trim() || isProcessing}
              >
                解析文本
              </Button>
            </Space>
          </div>
        </div>
        
        {/* 统计信息卡片 */}
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic 
                title="总账户数" 
                value={processStats.total} 
                suffix={`个`}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="成功" 
                value={processStats.success} 
                suffix={`个`}
                valueStyle={{ color: '#3f8600' }}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="失败" 
                value={processStats.failed} 
                suffix={`个`}
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>
            <Col span={6}>
              <Statistic 
                title="成功率" 
                value={processStats.total > 0 ? Math.round(processStats.success / processStats.total * 100) : 0} 
                suffix={`%`}
                precision={0}
              />
            </Col>
          </Row>
          
          {isProcessing && (
            <div style={{ marginTop: 16 }}>
              <Text strong>正在处理账户: </Text>
              <Text>{processStats.currentEmail}</Text>
              <br />
              <Text strong>当前阶段: </Text>
              <Text>{processStats.currentStage} ({Math.round(processStats.currentProgress)}%)</Text>
              <Progress 
                percent={processStats.currentProgress} 
                status="active"
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
            </div>
          )}
        </Card>
        
        <Row gutter={16}>
          <Col span={12}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={5}>账户列表</Title>
              <Button 
                type="primary" 
                size="small"
                icon={<PlusOutlined />} 
                onClick={addAccount}
                disabled={isProcessing}
              >
                添加账户
              </Button>
            </div>
            
            <Table
              dataSource={accounts}
              columns={columns}
              rowKey="key"
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
              loading={loading && !isProcessing}
            />
          </Col>
          
          <Col span={12}>
            <div style={{ marginBottom: 16 }}>
              <Title level={5}>处理日志</Title>
            </div>
            
            <div 
              style={{ 
                height: 350, 
                overflowY: 'auto',
                padding: 8,
                border: '1px solid #d9d9d9',
                borderRadius: 2,
                backgroundColor: '#f5f5f5'
              }}
            >
              {logs.length > 0 ? (
                <List
                  size="small"
                  dataSource={logs}
                  renderItem={log => (
                    <List.Item style={{ padding: '4px 0' }}>
                      <Text code style={{ fontSize: 12 }}>{log}</Text>
                    </List.Item>
                  )}
                />
              ) : (
                <Empty description="暂无日志" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}
              <div ref={logsEndRef} />
            </div>
          </Col>
        </Row>
        
        <Divider />
        
        <Paragraph type="secondary">
          <InfoCircleOutlined style={{ marginRight: 8 }} />
          恢复流程: 获取验证码 → 重置密码 → 获取2FA信息 → 解绑2FA → 重新绑定2FA
        </Paragraph>
      </div>
    </Modal>
  );
};

export default BatchRecoverAccountModal;