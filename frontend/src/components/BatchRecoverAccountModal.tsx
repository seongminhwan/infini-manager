/**
 * 批量恢复账户模态框组件
 * 用于批量恢复Infini账户，包含批量输入账户邮箱并逐个进行恢复操作
 */
import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Input,
  message,
  Row,
  Col,
  Typography,
  List,
  Card,
  Statistic,
  Divider,
  Progress,
  Tag,
  Space,
  Alert
} from 'antd';
import {
  MailOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  LoadingOutlined,
  UnlockOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { infiniAccountApi } from '../services/api';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// 账户恢复状态
type RecoveryStatus = 'pending' | 'processing' | 'success' | 'failed';

// 恢复阶段
type RecoveryStage = 'sendVerificationCode' | 'resetPassword' | 'getGoogle2faQrcode' | 'unbindGoogle2fa' | 'bindGoogle2fa' | 'complete';

// 恢复阶段中文描述
const stageNames: Record<RecoveryStage, string> = {
  sendVerificationCode: '发送验证码',
  resetPassword: '重置密码',
  getGoogle2faQrcode: '获取2FA信息',
  unbindGoogle2fa: '解绑2FA',
  bindGoogle2fa: '绑定2FA',
  complete: '完成恢复'
};

// 账户恢复信息接口
interface AccountRecoveryInfo {
  email: string;
  status: RecoveryStatus;
  stage?: RecoveryStage;
  message?: string;
  logs: string[];
}

interface BatchRecoverAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const BatchRecoverAccountModal: React.FC<BatchRecoverAccountModalProps> = ({
  visible,
  onClose,
  onSuccess
}) => {
  // 文本输入
  const [inputText, setInputText] = useState<string>('');
  // 解析后的邮箱列表
  const [emailList, setEmailList] = useState<string[]>([]);
  // 账户恢复信息
  const [recoveryInfos, setRecoveryInfos] = useState<AccountRecoveryInfo[]>([]);
  // 当前处理的账户索引
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  // 恢复中标志
  const [recovering, setRecovering] = useState<boolean>(false);
  // 统计信息
  const [stats, setStats] = useState<{
    total: number;
    success: number;
    failed: number;
    processing: number;
  }>({
    total: 0,
    success: 0,
    failed: 0,
    processing: 0
  });

  // 解析文本，提取邮箱
  const parseEmails = () => {
    if (!inputText.trim()) {
      message.warning('请输入邮箱列表');
      return;
    }

    const lines = inputText.trim().split('\n');
    const emails: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine) {
        // 简单的邮箱格式验证
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(trimmedLine)) {
          emails.push(trimmedLine);
        } else {
          message.warning(`忽略无效的邮箱格式: ${trimmedLine}`);
        }
      }
    }

    if (emails.length === 0) {
      message.warning('未解析到有效的邮箱地址');
      return;
    }

    // 去重
    const uniqueEmails = Array.from(new Set(emails));
    setEmailList(uniqueEmails);
    
    // 初始化恢复信息
    const initialInfos: AccountRecoveryInfo[] = uniqueEmails.map(email => ({
      email,
      status: 'pending',
      logs: []
    }));
    setRecoveryInfos(initialInfos);
    
    // 更新统计信息
    setStats({
      total: uniqueEmails.length,
      success: 0,
      failed: 0,
      processing: 0
    });

    message.success(`成功解析 ${uniqueEmails.length} 个邮箱地址`);
  };

  // 添加邮箱
  const addEmail = (email: string) => {
    if (!email.trim()) {
      message.warning('请输入有效的邮箱地址');
      return;
    }

    // 简单的邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      message.warning(`无效的邮箱格式: ${email}`);
      return;
    }

    // 检查是否已存在
    if (emailList.includes(email.trim())) {
      message.warning(`邮箱 ${email} 已在列表中`);
      return;
    }

    const newEmailList = [...emailList, email.trim()];
    setEmailList(newEmailList);

    // 更新恢复信息
    const newRecoveryInfos = [
      ...recoveryInfos,
      {
        email: email.trim(),
        status: 'pending',
        logs: []
      }
    ];
    setRecoveryInfos(newRecoveryInfos);
    
    // 更新统计信息
    setStats(prev => ({
      ...prev,
      total: prev.total + 1
    }));

    message.success(`成功添加邮箱: ${email}`);
  };

  // 删除邮箱
  const removeEmail = (email: string) => {
    const newEmailList = emailList.filter(e => e !== email);
    setEmailList(newEmailList);

    // 更新恢复信息
    const newRecoveryInfos = recoveryInfos.filter(info => info.email !== email);
    setRecoveryInfos(newRecoveryInfos);
    
    // 更新统计信息
    setStats({
      total: newRecoveryInfos.length,
      success: newRecoveryInfos.filter(info => info.status === 'success').length,
      failed: newRecoveryInfos.filter(info => info.status === 'failed').length,
      processing: newRecoveryInfos.filter(info => info.status === 'processing').length
    });

    message.success(`已移除邮箱: ${email}`);
  };

  // 更新账户恢复日志
  const updateAccountLog = (email: string, log: string) => {
    setRecoveryInfos(prevInfos => {
      return prevInfos.map(info => {
        if (info.email === email) {
          return {
            ...info,
            logs: [...info.logs, log]
          };
        }
        return info;
      });
    });
  };

  // 更新账户恢复状态
  const updateAccountStatus = (email: string, status: RecoveryStatus, stage?: RecoveryStage, message?: string) => {
    setRecoveryInfos(prevInfos => {
      return prevInfos.map(info => {
        if (info.email === email) {
          return {
            ...info,
            status,
            stage,
            message
          };
        }
        return info;
      });
    });

    // 更新统计信息
    setStats(prev => {
      let success = prev.success;
      let failed = prev.failed;
      let processing = prev.processing;

      // 根据状态变化更新计数
      if (status === 'success') {
        success += 1;
        if (prevState === 'processing') processing -= 1;
      } else if (status === 'failed') {
        failed += 1;
        if (prevState === 'processing') processing -= 1;
      } else if (status === 'processing') {
        processing += 1;
      }

      return {
        total: prev.total,
        success,
        failed,
        processing
      };
    });

    // 获取当前状态用于比较
    const prevState = recoveryInfos.find(info => info.email === email)?.status;
  };

  // 重置状态
  const resetState = () => {
    setInputText('');
    setEmailList([]);
    setRecoveryInfos([]);
    setCurrentIndex(-1);
    setRecovering(false);
    setStats({
      total: 0,
      success: 0,
      failed: 0,
      processing: 0
    });
  };

  // 开始批量恢复账户
  const startBatchRecover = async () => {
    if (emailList.length === 0) {
      message.warning('请先解析邮箱列表');
      return;
    }

    if (recovering) {
      message.warning('正在恢复账户，请稍后再试');
      return;
    }

    setRecovering(true);
    setCurrentIndex(0);

    try {
      // 逐个恢复账户
      for (let i = 0; i < emailList.length; i++) {
        setCurrentIndex(i);
        const email = emailList[i];
        
        // 更新状态为处理中
        updateAccountStatus(email, 'processing', 'sendVerificationCode');
        updateAccountLog(email, `开始恢复账户: ${email}`);
        
        try {
          // 调用单个账户恢复接口
          await recoverAccount(email);
          
          // 更新状态为成功
          updateAccountStatus(email, 'success', 'complete');
          updateAccountLog(email, '账户恢复成功');
        } catch (error: any) {
          // 更新状态为失败
          updateAccountStatus(email, 'failed', undefined, error.message || '恢复失败');
          updateAccountLog(email, `恢复失败: ${error.message || '未知错误'}`);
        }
      }

      message.success(`批量恢复完成: 成功 ${stats.success} 个，失败 ${stats.failed} 个`);
      if (stats.success > 0) {
        onSuccess(); // 调用成功回调函数更新账户列表
      }
    } catch (error: any) {
      message.error(`批量恢复失败: ${error.message || '未知错误'}`);
    } finally {
      setRecovering(false);
      setCurrentIndex(-1);
    }
  };

  // 单个账户恢复流程
  const recoverAccount = async (email: string) => {
    // 阶段1: 发送验证码
    updateAccountStatus(email, 'processing', 'sendVerificationCode');
    updateAccountLog(email, '开始获取恢复邮箱验证码...');
    
    try {
      // 发送验证码，类型为1（恢复账户）
      const sendCodeResult = await infiniAccountApi.sendVerificationCode(email, 1);
      if (!sendCodeResult.success) {
        throw new Error(`发送验证码失败: ${sendCodeResult.message}`);
      }
      updateAccountLog(email, '验证码发送成功');
      
      // 等待获取验证码
      updateAccountLog(email, '等待获取验证码...');
      // 这里模拟等待，实际应该采用轮询或推送方式获取验证码
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 获取验证码
      const codeResult = await infiniAccountApi.fetchVerificationCode(email);
      if (!codeResult.success || !codeResult.data) {
        throw new Error('获取验证码失败');
      }
      const verificationCode = codeResult.data;
      updateAccountLog(email, '获取到验证码');
      
      // 阶段2: 重置密码
      updateAccountStatus(email, 'processing', 'resetPassword');
      updateAccountLog(email, '开始重置密码...');
      
      const resetResult = await infiniAccountApi.resetPassword(email, verificationCode);
      if (!resetResult.success) {
        throw new Error(`重置密码失败: ${resetResult.message}`);
      }
      updateAccountLog(email, '重置密码成功');
      
      // 阶段3: 获取2FA信息
      updateAccountStatus(email, 'processing', 'getGoogle2faQrcode');
      updateAccountLog(email, '开始获取2FA信息...');
      
      const accountId = resetResult.data?.id;
      if (!accountId) {
        throw new Error('获取账户ID失败');
      }
      
      const qrcodeResult = await infiniAccountApi.getGoogle2faQrcode(accountId.toString());
      if (!qrcodeResult.success) {
        throw new Error(`获取2FA信息失败: ${qrcodeResult.message}`);
      }
      updateAccountLog(email, '获取2FA信息成功');
      
      // 阶段4: 解绑2FA
      updateAccountStatus(email, 'processing', 'unbindGoogle2fa');
      updateAccountLog(email, '开始解绑2FA...');
      
      const unbindResult = await infiniAccountApi.unbindGoogle2fa(accountId.toString());
      if (!unbindResult.success) {
        throw new Error(`解绑2FA失败: ${unbindResult.message}`);
      }
      updateAccountLog(email, '解绑2FA成功');
      
      // 阶段5: 重新绑定2FA
      updateAccountStatus(email, 'processing', 'bindGoogle2fa');
      updateAccountLog(email, '开始重新绑定2FA...');
      
      const bindResult = await infiniAccountApi.autoBindGoogle2fa(accountId.toString());
      if (!bindResult.success) {
        throw new Error(`绑定2FA失败: ${bindResult.message}`);
      }
      updateAccountLog(email, '绑定2FA成功');
      
      return true;
    } catch (error: any) {
      updateAccountLog(email, `恢复过程出错: ${error.message}`);
      throw error;
    }
  };

  // 渲染账户状态标签
  const renderStatusTag = (status: RecoveryStatus) => {
    switch (status) {
      case 'pending':
        return <Tag>待处理</Tag>;
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

  // 渲染处理进度
  const renderProgress = (info: AccountRecoveryInfo) => {
    if (info.status !== 'processing' || !info.stage) return null;
    
    // 根据当前阶段计算进度
    const stages: RecoveryStage[] = [
      'sendVerificationCode',
      'resetPassword',
      'getGoogle2faQrcode',
      'unbindGoogle2fa',
      'bindGoogle2fa',
      'complete'
    ];
    
    const currentStageIndex = stages.indexOf(info.stage);
    const totalStages = stages.length - 1; // 减去complete阶段
    const percent = Math.round((currentStageIndex / totalStages) * 100);
    
    return (
      <div style={{ marginTop: 8 }}>
        <Text>正在{stageNames[info.stage]}...</Text>
        <Progress percent={percent} size="small" status="active" />
      </div>
    );
  };

  // 处理关闭模态框
  const handleClose = () => {
    if (recovering) {
      Modal.confirm({
        title: '确认关闭',
        content: '正在恢复账户中，关闭将中断恢复过程。确定要关闭吗？',
        onOk: () => {
          resetState();
          onClose();
        }
      });
    } else {
      resetState();
      onClose();
    }
  };

  return (
    <Modal
      title="批量恢复Infini账户"
      open={visible}
      onCancel={handleClose}
      width={900}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
        <Button
          key="recover"
          type="primary"
          loading={recovering}
          onClick={startBatchRecover}
          disabled={emailList.length === 0 || recovering}
        >
          {recovering ? '正在恢复' : '开始批量恢复'}
        </Button>
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Alert
          message="请输入需要恢复的Infini账户邮箱列表，每行一个邮箱"
          description="系统将依次恢复这些账户，包括重置密码、解绑并重新绑定2FA等操作。"
          type="info"
          showIcon
        />
      </div>

      {/* 文本输入区域 */}
      <div style={{ marginBottom: 16 }}>
        <TextArea
          rows={5}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="请输入需要恢复的账户邮箱，每行一个邮箱
example@email.com
another@email.com
..."
          disabled={recovering}
        />
        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
          <Space>
            <Button
              onClick={parseEmails}
              icon={<SyncOutlined />}
              disabled={!inputText.trim() || recovering}
            >
              解析文本
            </Button>
          </Space>
        </div>
      </div>

      {/* 恢复进度统计 */}
      {emailList.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic
                title="总账户数"
                value={stats.total}
                suffix={`个`}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="成功数量"
                value={stats.success}
                valueStyle={{ color: '#3f8600' }}
                suffix={`个`}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="失败数量"
                value={stats.failed}
                valueStyle={{ color: '#cf1322' }}
                suffix={`个`}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="成功率"
                value={stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0}
                suffix={`%`}
                precision={0}
              />
            </Col>
          </Row>
          {recovering && currentIndex >= 0 && currentIndex < emailList.length && (
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Text>
                正在处理: <strong>{emailList[currentIndex]}</strong> ({currentIndex + 1}/{emailList.length})
              </Text>
            </div>
          )}
        </Card>
      )}

      {/* 恢复列表和详情 */}
      {emailList.length > 0 && (
        <Row gutter={16}>
          {/* 左侧：账户列表 */}
          <Col span={12}>
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 4, height: 400, overflow: 'auto' }}>
              <List
                size="small"
                header={<div style={{ fontWeight: 'bold' }}>恢复账户列表</div>}
                bordered={false}
                dataSource={recoveryInfos}
                renderItem={info => (
                  <List.Item
                    actions={[
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<CloseCircleOutlined />}
                        onClick={() => removeEmail(info.email)}
                        disabled={recovering}
                      />
                    ]}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                      <MailOutlined style={{ marginRight: 8 }} />
                      <Text style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }} ellipsis>
                        {info.email}
                      </Text>
                      <div style={{ marginLeft: 8 }}>
                        {renderStatusTag(info.status)}
                      </div>
                    </div>
                    {renderProgress(info)}
                  </List.Item>
                )}
              />
            </div>
          </Col>

          {/* 右侧：当前恢复详情 */}
          <Col span={12}>
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 4, height: 400, overflow: 'auto', padding: 16 }}>
              {currentIndex >= 0 && currentIndex < emailList.length ? (
                <>
                  <Title level={5}>
                    <Space>
                      <span>正在处理账户</span>
                      <MailOutlined />
                      <span>{emailList[currentIndex]}</span>
                    </Space>
                  </Title>

                  <div style={{ marginBottom: 8 }}>
                    {recoveryInfos[currentIndex]?.stage && (
                      <div>
                        <Text>当前进度: </Text>
                        <Text strong>{stageNames[recoveryInfos[currentIndex].stage!]}</Text>
                        <Text> ({stages.indexOf(recoveryInfos[currentIndex].stage!) + 1}/5)</Text>
                      </div>
                    )}
                  </div>

                  <Divider orientation="left">操作日志</Divider>
                  <div style={{ maxHeight: 240, overflow: 'auto', padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
                    {recoveryInfos[currentIndex]?.logs.map((log, index) => (
                      <div key={index} style={{ marginBottom: 4 }}>
                        <Text code>{log}</Text>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Text type="secondary">
                    {recovering ? '正在准备恢复...' : '请点击"开始批量恢复"按钮开始恢复账户'}
                  </Text>
                </div>
              )}
            </div>
          </Col>
        </Row>
      )}
    </Modal>
  );
};

export default BatchRecoverAccountModal;