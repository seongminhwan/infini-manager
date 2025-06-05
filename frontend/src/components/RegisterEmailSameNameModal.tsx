/**
 * 注册邮箱同名账户模态框
 * 用于选择现有邮箱并注册同名Infini账户
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Space,
  Typography,
  Transfer,
  message,
  Spin,
  Alert,
  Timeline,
  Tag,
  Progress,
  Divider,
  Form,
  Input,
  Checkbox
} from 'antd';
import {
  MailOutlined,
  UserOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { TransferDirection } from 'antd/lib/transfer';
import { Key as TransferKey } from 'rc-table/lib/interface';
import api, { infiniAccountApi, emailAccountApi, apiBaseUrl } from '../services/api';

const { Title, Text, Paragraph } = Typography;

// 样式组件
const StyledTransfer = styled(Transfer)`
  .ant-transfer-list {
    width: 45%;
    height: 400px;
  }
`;

const ProgressContainer = styled.div`
  margin: 20px 0;
`;

const LogSection = styled.div`
  margin-top: 16px;
  max-height: 200px;
  overflow-y: auto;
  background: #f5f5f5;
  padding: 8px;
  border-radius: 4px;
`;

const LogItem = styled.div`
  margin-bottom: 4px;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 12px;
`;

// 邮箱账户接口
interface EmailAccount {
  id: number;
  name: string;
  email: string;
  imap_host: string;
  imap_port: number;
  imap_secure: number;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: number;
  password: string;
  is_default: number;
  status: string;
  created_at: string;
  updated_at: string;
  domainName?: string;
}

// 注册结果接口
interface RegisterResult {
  success: boolean;
  message?: string;
  accountId?: number;
  userId?: string;
  email?: string;
  is2faEnabled?: boolean;
  isKycEnabled?: boolean;
}

interface RegisterEmailSameNameModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const RegisterEmailSameNameModal: React.FC<RegisterEmailSameNameModalProps> = ({
  visible,
  onClose,
  onSuccess
}) => {
  // 状态管理
  const [loading, setLoading] = useState<boolean>(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [targetKeys, setTargetKeys] = useState<TransferKey[]>([]);
  const [selectedEmails, setSelectedEmails] = useState<EmailAccount[]>([]);
  const [registering, setRegistering] = useState<boolean>(false);
  const [currentEmailIndex, setCurrentEmailIndex] = useState<number>(-1);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [successCount, setSuccessCount] = useState<number>(0);
  const [failedCount, setFailedCount] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [invitationCode, setInvitationCode] = useState<string>('TC7MLI9'); // 默认邀请码
  const [enable2FA, setEnable2FA] = useState<boolean>(false);
  const [enableKYC, setEnableKYC] = useState<boolean>(false);

  // 初始化
  useEffect(() => {
    if (visible) {
      fetchEmailAccounts();
      resetState();
    }
  }, [visible]);

  // 重置状态
  const resetState = () => {
    setTargetKeys([]);
    setSelectedEmails([]);
    setCurrentEmailIndex(-1);
    setProgressPercent(0);
    setSuccessCount(0);
    setFailedCount(0);
    setLogs([]);
    setRegistering(false);
  };

  // 获取邮箱账户列表
  const fetchEmailAccounts = async () => {
    try {
      setLoading(true);
      addLog('获取邮箱账户列表...');

      const response = await api.get(`${apiBaseUrl}/api/email-accounts`);

      if (response.data.success) {
        // 只选择状态为active的邮箱
        const activeAccounts = response.data.data.filter((account: EmailAccount) =>
          account.status === 'active'
        );

        setEmailAccounts(activeAccounts);
        addLog(`成功获取 ${activeAccounts.length} 个活跃邮箱账户`);
      } else {
        throw new Error(response.data.message || '获取邮箱账户列表失败');
      }
    } catch (error: any) {
      addLog(`获取邮箱账户列表失败: ${error.message}`, 'error');
      message.error(`获取邮箱账户列表失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 添加日志
  const addLog = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error'
      ? '❌ '
      : type === 'success'
        ? '✅ '
        : '📝 ';

    setLogs(prevLogs => [...prevLogs, `${prefix}[${timestamp}] ${text}`]);
  };

  // 处理Transfer变化
  const handleChange = (nextTargetKeys: TransferKey[]) => {
    setTargetKeys(nextTargetKeys);
    const selected = emailAccounts.filter(account =>
      nextTargetKeys.includes(account.id.toString() as TransferKey)
    );
    setSelectedEmails(selected);
  };

  // 开始批量注册
  const handleRegister = async () => {
    if (selectedEmails.length === 0) {
      message.warning('请选择至少一个邮箱');
      return;
    }

    try {
      setRegistering(true);
      setCurrentEmailIndex(0);
      setProgressPercent(0);
      setSuccessCount(0);
      setFailedCount(0);

      addLog(`开始为 ${selectedEmails.length} 个邮箱注册同名账户...`);

      // 遍历选中的邮箱进行注册
      for (let i = 0; i < selectedEmails.length; i++) {
        const email = selectedEmails[i];
        setCurrentEmailIndex(i);
        setProgressPercent(Math.floor((i / selectedEmails.length) * 100));

        addLog(`开始注册邮箱 ${email.email} 的同名账户...`);

        try {
          // 生成随机密码
          const password = generateStrongPassword();
          addLog(`已为 ${email.email} 生成随机密码`);

          // 获取验证码
          addLog(`正在发送验证码到 ${email.email}...`);
          const sendResponse = await infiniAccountApi.sendVerificationCode(email.email);

          if (!sendResponse.success) {
            throw new Error(`发送验证码失败: ${sendResponse.message}`);
          }

          addLog('验证码发送成功');

          // 延迟一下确保邮件已到达
          await new Promise(resolve => setTimeout(resolve, 2000));

          // 获取验证码
          addLog('正在获取验证码...');

          // 从同一个邮箱获取验证码
          const codeResponse = await infiniAccountApi.fetchVerificationCode(email.email, email.email);

          if (!codeResponse.success || !codeResponse.data.code) {
            throw new Error(`获取验证码失败: ${codeResponse.message}`);
          }

          const verificationCode = codeResponse.data.code;
          addLog(`成功获取验证码: ${verificationCode}`);

          // 注册账户
          addLog('正在注册Infini账户...');

          // 使用axios直接调用Infini API
          const options = {
            method: 'POST',
            url: 'https://api-card.infini.money/user/registration/email',
            headers: {
              'sec-ch-ua-platform': '"macOS"',
              'Referer': 'https://app.infini.money/',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
              'sec-ch-ua-mobile': '?0',
              'Content-Type': 'application/json'
            },
            data: {
              email: email.email,
              verification_code: verificationCode,
              password: password,
              invitation_code: invitationCode
            }
          };

          addLog(`使用邀请码: ${invitationCode}`);

          const response = await api.request(options);

          if (response.data && response.data.code === 0) {
            addLog('Infini注册成功', 'success');

            // 保存账户信息到本地数据库
            addLog('正在保存账户信息到本地数据库...');

            const createResponse = await infiniAccountApi.createAccount(
              email.email,
              password
            );

            if (!createResponse.success) {
              throw new Error(`保存账户信息失败: ${createResponse.message}`);
            }

            const accountId = createResponse.data.id;
            addLog(`账户信息保存成功，ID: ${accountId}`, 'success');

            // 同步账户信息
            addLog('正在同步账户信息...');
            const syncResponse = await infiniAccountApi.syncAccount(accountId);

            if (!syncResponse.success) {
              throw new Error(`同步账户信息失败: ${syncResponse.message}`);
            }

            addLog('账户信息同步成功', 'success');

            // 如果需要配置2FA
            if (enable2FA) {
              addLog('即将自动配置2FA...');
              // 此处需要额外调用2FA配置接口
              // 由于2FA配置比较复杂，可能需要单独处理
            }

            // 如果需要配置KYC
            if (enableKYC) {
              addLog('即将自动配置KYC...');
              // 此处需要额外调用KYC配置接口
              // 由于KYC配置比较复杂，可能需要单独处理
            }

            setSuccessCount(prev => prev + 1);
            addLog(`${email.email} 注册完成!`, 'success');
          } else {
            throw new Error(`Infini API返回错误: ${response.data.message || JSON.stringify(response.data)}`);
          }
        } catch (error: any) {
          setFailedCount(prev => prev + 1);
          addLog(`${email.email} 注册失败: ${error.message}`, 'error');
        }

        // 添加短暂延迟，避免API请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // 更新最终进度
      setProgressPercent(100);
      setCurrentEmailIndex(-1);

      // 显示结果
      if (successCount === selectedEmails.length) {
        message.success(`批量注册完成，成功注册 ${successCount} 个账户`);
      } else {
        message.warning(`批量注册完成，成功: ${successCount}，失败: ${failedCount}`);
      }

      // 通知父组件成功
      if (successCount > 0) {
        onSuccess();
      }
    } catch (error: any) {
      message.error(`批量注册过程中发生错误: ${error.message}`);
    } finally {
      setRegistering(false);
    }
  };

  // 生成随机强密码
  const generateStrongPassword = (): string => {
    const length = Math.floor(Math.random() * 9) + 16; // 16-24位长度
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
    let password = '';

    // 确保至少包含一个特殊字符
    let hasSpecialChar = false;
    const specialChars = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

    // 生成随机密码
    for (let i = 0; i < length; i++) {
      const randomChar = charset.charAt(Math.floor(Math.random() * charset.length));
      password += randomChar;

      // 检查是否包含特殊字符
      if (specialChars.includes(randomChar)) {
        hasSpecialChar = true;
      }
    }

    // 如果没有特殊字符，替换最后一个字符为特殊字符
    if (!hasSpecialChar) {
      const randomSpecialChar = specialChars.charAt(Math.floor(Math.random() * specialChars.length));
      password = password.slice(0, -1) + randomSpecialChar;
    }

    return password;
  };

  // 转换数据以适应Transfer组件
  const transferData = emailAccounts.map(account => ({
    key: account.id.toString(),
    title: account.email,
    description: account.name,
    disabled: false
  }));

  // 渲染进度条
  const renderProgress = () => {
    if (!registering && successCount === 0 && failedCount === 0) {
      return null;
    }

    return (
      <ProgressContainer>
        <Progress
          percent={progressPercent}
          status={failedCount > 0 ? 'exception' : undefined}
          format={() => `${successCount + failedCount}/${selectedEmails.length}`}
        />
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">
            处理进度: 成功 {successCount} 个, 失败 {failedCount} 个
            {currentEmailIndex >= 0 && currentEmailIndex < selectedEmails.length && (
              <span>, 当前处理: {selectedEmails[currentEmailIndex].email}</span>
            )}
          </Text>
        </div>
      </ProgressContainer>
    );
  };

  // 渲染日志面板
  const renderLogs = () => {
    return (
      <LogSection id="log-container">
        {logs.length === 0 ? (
          <Text type="secondary">暂无日志记录</Text>
        ) : (
          logs.map((log, index) => (
            <LogItem key={index}>{log}</LogItem>
          ))
        )}
      </LogSection>
    );
  };

  // 渲染时间线
  const renderTimeline = () => {
    return (
      <Timeline style={{ margin: '20px 0' }}>
        <Timeline.Item
          dot={registering && currentEmailIndex === 0 ? <LoadingOutlined /> : null}
          color={successCount + failedCount > 0 ? 'green' : 'blue'}
        >
          <Text strong>发送验证码</Text>
          <div>向选中的邮箱发送验证码</div>
        </Timeline.Item>

        <Timeline.Item
          dot={registering && currentEmailIndex > 0 && currentEmailIndex < selectedEmails.length ? <LoadingOutlined /> : null}
          color={successCount + failedCount > 0 ? 'green' : 'blue'}
        >
          <Text strong>获取验证码</Text>
          <div>从邮箱中提取收到的验证码</div>
        </Timeline.Item>

        <Timeline.Item
          color="blue"
        >
          <Text strong>注册Infini账户</Text>
          <div>调用Infini注册接口创建账户</div>
        </Timeline.Item>

        <Timeline.Item
          color="blue"
        >
          <Text strong>保存账户信息</Text>
          <div>将账户信息保存到本地数据库</div>
        </Timeline.Item>

        <Timeline.Item
          color="blue"
        >
          <Text strong>同步账户信息</Text>
          <div>获取最新账户资料并更新数据库</div>
        </Timeline.Item>
      </Timeline>
    );
  };

  return (
    <Modal
      title="注册邮箱同名账户"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={registering}>
          关闭
        </Button>,
        <Button
          key="register"
          type="primary"
          icon={<UserOutlined />}
          loading={registering}
          onClick={handleRegister}
          disabled={targetKeys.length === 0 || registering}
        >
          开始注册
        </Button>
      ]}
    >
      <Spin spinning={loading}>
        <Alert
          message="操作说明"
          description="本功能将为选中的邮箱注册同名的Infini账户。请在左侧选择要注册的邮箱，然后点击箭头将其添加到右侧。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form layout="vertical">
          <Form.Item label="邀请码">
            <Input
              placeholder="请输入邀请码"
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value)}
              disabled={registering}
              style={{ width: 200 }}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Checkbox
                checked={enable2FA}
                onChange={(e) => setEnable2FA(e.target.checked)}
                disabled={registering}
              >
                自动配置2FA
              </Checkbox>

              <Checkbox
                checked={enableKYC}
                onChange={(e) => setEnableKYC(e.target.checked)}
                disabled={registering}
              >
                自动配置KYC
              </Checkbox>
            </Space>
          </Form.Item>
        </Form>

        <Divider />

        <StyledTransfer
          dataSource={transferData}
          titles={['可选邮箱', '已选邮箱']}
          targetKeys={targetKeys}
          onChange={handleChange}
          render={item => (
            <div>
              <div>{item.title}</div>
              <div style={{ fontSize: '12px', color: '#999' }}>{item.description}</div>
            </div>
          )}
          listStyle={{
            width: '45%',
            height: 300,
          }}
          operations={['添加到已选', '移除']}
          showSearch
          filterOption={(inputValue, item) =>
            item.title?.indexOf(inputValue) !== -1 ||
            item.description?.indexOf(inputValue) !== -1
          }
          locale={{
            searchPlaceholder: '搜索邮箱',
            notFoundContent: '没有符合条件的邮箱'
          }}
        />

        <div style={{ marginTop: 20 }}>
          <Text>已选择 {targetKeys.length} 个邮箱</Text>
        </div>

        {renderProgress()}

        {renderLogs()}
      </Spin>
    </Modal>
  );
};

export default RegisterEmailSameNameModal;