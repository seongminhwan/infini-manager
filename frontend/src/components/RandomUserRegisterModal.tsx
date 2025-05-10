/**
 * 随机用户注册模态框
 * 用于生成随机用户信息并注册Infini账户
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import TwoFactorAuthModal from './TwoFactorAuthModal';
import {
  Modal,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Card,
  Row,
  Col,
  message,
  Select,
  Divider,
  Spin,
  Image,
  Timeline,
  Tag,
  Tooltip,
  Alert,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  LockOutlined,
  IdcardOutlined,
  PhoneOutlined,
  CalendarOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
  QuestionCircleOutlined,
  SafetyOutlined,
  QrcodeOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { randomUserApi, kycImageApi, infiniAccountApi, totpToolApi, apiBaseUrl } from '../services/api';
import axios from 'axios';

const { Text, Title } = Typography;
const { Option } = Select;

// 样式组件
const InfoCard = styled(Card)`
  margin-bottom: 16px;
  border-radius: 8px;
`;

const UserInfoItem = styled.div`
  margin-bottom: 12px;
  display: flex;
  align-items: center;
`;

const ItemLabel = styled(Text)`
  font-weight: bold;
  width: 100px;
  margin-right: 12px;
`;

const ItemValue = styled(Text)`
  flex: 1;
`;

const KycImage = styled(Image)`
  width: 100%;
  border-radius: 4px;
  margin-bottom: 8px;
`;

const StepItem = styled(Timeline.Item)`
  padding-bottom: 16px;
`;

// 自定义下拉菜单样式，确保内容完整显示
const StyledSelect = styled(Select<string>)`
  .ant-select-dropdown {
    min-width: 300px !important;
    max-width: 500px !important;
    width: auto !important;
  }
`;

// 邀请码输入框容器
const InvitationCodeWrapper = styled.div`
  display: flex;
  align-items: center;
  margin-right: auto; /* 将元素推到左侧 */
`;

// 模态框内容区域
const ModalContent = styled.div`
  max-height: 65vh; /* 稍微减小高度，为固定底部腾出空间 */
  overflow-y: auto; /* 添加垂直滚动条 */
  padding-right: 5px; /* 为滚动条预留空间 */
`;

const LogSection = styled.div`
  margin-top: 16px;
  max-height: 150px;
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

interface RandomUserRegisterModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (account: any) => void;
}

// 默认邀请码
const DEFAULT_INVITATION_CODE = 'TC7MLI9';

// 随机用户注册模态框组件
const RandomUserRegisterModal: React.FC<RandomUserRegisterModalProps> = ({
  visible,
  onCancel,
  onSuccess,
}) => {
  // 随机用户数据
  const [userData, setUserData] = useState<any>(null);
  const [kycImage, setKycImage] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [emailSuffix, setEmailSuffix] = useState<string>('');
  const [emailAccounts, setEmailAccounts] = useState<any[]>([]);
  const [invitationCode, setInvitationCode] = useState<string>(DEFAULT_INVITATION_CODE);
  
  // 注册状态
  const [registering, setRegistering] = useState<boolean>(false);
  const [registerSuccess, setRegisterSuccess] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  
  // 2FA自动配置状态
  const [createdAccount, setCreatedAccount] = useState<any>(null);
  const [show2faButton, setShow2faButton] = useState<boolean>(false);
  const [twoFactorAuthModalVisible, setTwoFactorAuthModalVisible] = useState<boolean>(false);

  // 使用useRef保持模态框状态，防止在组件重渲染时丢失
  const logSectionRef = useRef<HTMLDivElement>(null);
  const showStartButtonRef = useRef<boolean>(false);
  
  // 清除历史缓存
  const clearHistoryCache = useCallback(() => {
    setLogs([]);
    showStartButtonRef.current = false;
  }, []);

  // 初始加载数据
  useEffect(() => {
    if (visible) {
      fetchEmailAccounts();
      clearHistoryCache(); // 进入页面时清除历史缓存
    } else {
      // 重置状态
      setCurrentStep(0);
      setLogs([]);
      setRegistering(false);
      setRegisterSuccess(false);
    }
  }, [visible, clearHistoryCache]);

  // 获取邮箱账户列表
  const fetchEmailAccounts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${apiBaseUrl}/api/email-accounts`);
      
      if (response.data.success) {
        const accounts = response.data.data || [];
        setEmailAccounts(accounts);
        
        // 定义一个变量保存邮箱后缀，避免异步更新问题
        let suffixToUse = 'gmail.com'; // 默认值
        
        // 提取域名并设置默认邮箱后缀
        if (accounts.length > 0) {
          // 寻找活跃状态且有域名的账户作为首选
          const activeAccountWithDomain = accounts.find((acc: any) => 
            acc.status === 'active' && acc.domainName);
          
          // 次选：任何有域名的账户
          const anyAccountWithDomain = accounts.find((acc: any) => acc.domainName);
          
          // 第三选择：活跃状态的账户，从其邮箱中提取域名
          const activeAccount = accounts.find((acc: any) => acc.status === 'active');
          
          if (activeAccountWithDomain) {
            // 最优选择：活跃状态且有域名的账户
            suffixToUse = activeAccountWithDomain.domainName;
          } else if (anyAccountWithDomain) {
            // 次优选择：任何有域名的账户
            suffixToUse = anyAccountWithDomain.domainName;
          } else if (activeAccount && activeAccount.email) {
            // 第三选择：活跃账户的邮箱域名
            const email = activeAccount.email;
            const domain = email.substring(email.indexOf('@') + 1);
            suffixToUse = domain;
          }
        }
        
        // 更新状态并确保使用最新的后缀值生成随机用户数据
        setEmailSuffix(suffixToUse);
        // 立即使用确定的后缀值调用fetchRandomData，而不是等待状态更新
        fetchRandomData(suffixToUse);
      } else {
        throw new Error('获取邮箱账户失败');
      }
    } catch (error) {
      console.error('获取邮箱账户失败:', error);
      message.warning('无法获取邮箱配置，使用默认邮箱后缀');
      const defaultSuffix = 'gmail.com';
      setEmailSuffix(defaultSuffix);
      fetchRandomData(defaultSuffix);
    } finally {
      setLoading(false);
    }
  };

  // 获取随机用户数据和KYC图片
  const fetchRandomData = async (suffix?: string) => {
    try {
      setLoading(true);
      setRefreshing(true);
      
      // 使用传入的后缀或当前状态中的后缀
      const emailSuffixToUse = suffix || emailSuffix;
      
      // 确保有后缀值再调用API
      if (!emailSuffixToUse) {
        message.error('邮箱后缀未设置，无法生成随机用户');
        return;
      }
      
      // 获取随机用户数据
      const userResponse = await randomUserApi.generateRandomUsers({ 
        email_suffix: emailSuffixToUse, 
        count: 1 
      });
      
      if (userResponse.success && userResponse.data.length > 0) {
        setUserData(userResponse.data[0]);
      } else {
        message.error('获取随机用户数据失败');
        return;
      }
      
      // 获取随机KYC图片
      const imageResponse = await kycImageApi.getRandomKycImage();
      
      if (imageResponse.success) {
        setKycImage(imageResponse.data);
      } else {
        message.warning('无法获取KYC图片，将继续但没有KYC图片');
      }
    } catch (error) {
      message.error('获取随机数据失败: ' + (error as Error).message);
      console.error('获取随机数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 刷新随机数据
  const handleRefresh = () => {
    fetchRandomData();
  };

  // 更改邮箱后缀
  const handleEmailSuffixChange = (value: string) => {
    setEmailSuffix(value);
    // 使用新后缀重新获取随机数据
    fetchRandomData();
  };

  // 更改邀请码
  const handleInvitationCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInvitationCode(e.target.value);
  };

  // 添加日志
  const addLog = useCallback((text: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' 
      ? '❌ ' 
      : type === 'success' 
        ? '✅ ' 
        : '📝 ';
    
    setLogs(prevLogs => [...prevLogs, `${prefix}[${timestamp}] ${text}`]);
    
    // 使用ref安全地滚动到底部
    setTimeout(() => {
      if (logSectionRef.current) {
        logSectionRef.current.scrollTop = logSectionRef.current.scrollHeight;
      }
    }, 10);
  }, []);

  // 执行注册操作
  const handleRegister = async () => {
    if (!userData) {
      message.error('请先生成随机用户数据');
      return;
    }
    
    try {
      // 清空之前的日志记录
      setLogs([]);
      setRegistering(true);
      setCurrentStep(1);
      addLog('开始注册流程...', 'info');
      
      // 步骤1: 发送验证码
      addLog(`步骤1: 正在向 ${userData.full_email} 发送验证码...`, 'info');
      const sendResponse = await infiniAccountApi.sendVerificationCode(userData.full_email);
      
      if (!sendResponse.success) {
        throw new Error(`发送验证码失败: ${sendResponse.message}`);
      }
      
      addLog('验证码发送成功', 'success');
      setCurrentStep(2);
      
      // 步骤2: 获取验证码
      addLog('步骤2: 正在获取验证码...', 'info');
      // 延迟一下确保邮件已到达
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // 获取当前选择的邮箱账户作为主邮箱
      const activeAccount = emailAccounts.find((acc: any) => 
        acc.domainName === emailSuffix || 
        (acc.email && acc.email.includes(`@${emailSuffix}`))
      );
      
      // 确保使用完整的邮箱地址，不仅仅是域名部分
      let mainEmailToUse = activeAccount ? activeAccount.email : undefined;
      
      // 如果找不到完整的邮箱但有域名，构造一个完整的邮箱地址
      if (!mainEmailToUse && emailSuffix) {
        // 在日志中添加详细信息，便于诊断
        addLog(`无法找到匹配的主邮箱账户，将使用通用邮箱名称配合域名 ${emailSuffix}`, 'info');
        
        // 构造一个完整的邮箱地址，使用"admin@域名"格式
        mainEmailToUse = `admin@${emailSuffix}`;
      }
      
      // 使用找到或构造的邮箱
      addLog(`使用主邮箱 ${mainEmailToUse || '默认邮箱'} 获取验证码`, 'info');
      
      // 调用API获取验证码
      const codeResponse = await infiniAccountApi.fetchVerificationCode(userData.full_email, mainEmailToUse);
      
      if (!codeResponse.success || !codeResponse.data.code) {
        throw new Error(`获取验证码失败: ${codeResponse.message}`);
      }
      
      const verificationCode = codeResponse.data.code;
      addLog(`成功获取验证码: ${verificationCode}`, 'success');
      setCurrentStep(3);
      
      // 步骤3: 注册Infini账户
      addLog('步骤3: 正在注册Infini账户...', 'info');

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
          email: userData.full_email,
          verification_code: verificationCode,
          password: userData.password,
          invitation_code: invitationCode || DEFAULT_INVITATION_CODE
        }
      };
      
      addLog(`使用邀请码: ${invitationCode || DEFAULT_INVITATION_CODE}`, 'info');

      try {
        const response = await axios.request(options);
        
        if (response.data && response.data.code === 0) {
          addLog('Infini注册成功', 'success');
          
          // 注册成功
          addLog('Infini注册成功', 'success');
          
          // 步骤4: 保存账户信息到本地数据库
          setCurrentStep(4);
          addLog('步骤4: 正在保存账户信息到本地数据库...', 'info');
          
          // 使用随机用户ID创建账户，建立关联关系
          addLog(`关联随机用户ID: ${userData.id}`, 'info');
          const createResponse = await infiniAccountApi.createAccount(
            userData.full_email, 
            userData.password,
            userData.id // 传递随机用户ID建立关联关系
          );
          
          if (!createResponse.success) {
            throw new Error(`保存账户信息失败: ${createResponse.message}`);
          }
          
          // 保存创建的账户信息，以便后续2FA操作
          setCreatedAccount(createResponse.data);
          
          addLog('账户信息保存成功', 'success');
          setCurrentStep(5);
          
          // 步骤5: 同步账户信息 
          addLog('步骤5: 正在同步账户信息...', 'info');
          const syncResponse = await infiniAccountApi.syncAccount(createResponse.data.id);
          
          if (!syncResponse.success) {
            throw new Error(`同步账户信息失败: ${syncResponse.message}`);
          }
          
          addLog('账户信息同步成功，已获取最新账户资料', 'success');
          setCurrentStep(6);
          addLog('注册流程完成!', 'success');
          
          // 注册成功
          message.success('随机用户注册成功!');
          
          // 检查是否已开启2FA
          if (syncResponse.data && !syncResponse.data.google2faIsBound) {
            addLog('检测到2FA尚未开启，可以进行自动配置', 'info');
            setShow2faButton(true);
          } else {
            addLog('该账户已开启2FA', 'info');
          }
          
          // 设置注册成功状态，但不自动关闭模态框
          setRegisterSuccess(true);
        } else {
          throw new Error(`Infini API返回错误: ${response.data.message || JSON.stringify(response.data)}`);
        }
      } catch (axiosError) {
        console.error('Infini API调用失败:', axiosError);
        throw new Error(`Infini API调用失败: ${(axiosError as Error).message}`);
      }
    } catch (error) {
      // 保留已完成步骤状态，只标记为失败
      // 不将currentStep设为-1，只在时间线最后一项显示失败状态
      const errorMessage = (error as Error).message;
      addLog(`注册失败: ${errorMessage}`, 'error');
      message.error('注册失败: ' + errorMessage);
      console.error('随机用户注册失败:', error);
    } finally {
      setRegistering(false);
    }
  };

  // 准备2FA配置
  const prepare2faConfig = useCallback(() => {
    // 添加调试日志，帮助诊断按钮点击问题
    addLog('触发2FA自动配置按钮点击事件', 'info');
    
    // 检查必要数据是否存在
    if (!createdAccount) {
      addLog('错误: 缺少账户数据，可能未正确创建账户', 'error');
      message.error('缺少账户数据，无法配置2FA');
      return;
    }
    
    if (!userData) {
      addLog('错误: 缺少用户数据，可能未正确生成随机用户', 'error');
      message.error('缺少用户数据，无法配置2FA');
      return;
    }

    // 显示2FA配置模态框
    setTwoFactorAuthModalVisible(true);
    addLog('已打开2FA配置界面', 'info');
  }, [addLog, createdAccount, userData]);
  
  // 处理2FA配置成功
  const handle2FASuccess = () => {
    // 隐藏2FA按钮，刷新账户信息
    setShow2faButton(false);
    addLog('2FA配置成功完成！', 'success');
    
    // 同步账户信息以获取最新状态
    if (createdAccount) {
      infiniAccountApi.syncAccount(createdAccount.id)
        .then(response => {
          if (response.success) {
            setCreatedAccount(response.data);
          }
        })
        .catch(error => {
          console.error('同步账户信息失败:', error);
        });
    }
  };
  // 自定义Modal标题，包含主邮箱选择器
  const modalTitle = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span>注册随机用户</span>
      <Space style={{ marginRight: '20px' }}>
        <Text strong>主邮箱：</Text>
        <StyledSelect 
          value={emailSuffix} 
          onChange={handleEmailSuffixChange}
          style={{ width: 260 }}
          disabled={registering}
          dropdownMatchSelectWidth={false}
          showSearch
          optionFilterProp="children"
          placeholder="选择主邮箱"
        >
          {emailAccounts.length > 0 ? (
            emailAccounts.map((account: any) => {
              // 优先使用设置的域名，如果没有则从邮箱中提取
              const domain = account.domainName || 
                (account.email ? account.email.substring(account.email.indexOf('@') + 1) : '');
              
              if (!domain) return null;
              
              return (
                <Option key={account.id} value={domain}>
                  {account.domainName ? (
                    <span style={{ fontWeight: 'bold' }}>域名邮箱: {domain} ({account.email})</span>
                  ) : (
                    <span>邮箱域名: {domain} (从{account.email}提取)</span>
                  )}
                </Option>
              );
            })
          ) : (
            <Option value="gmail.com">gmail.com</Option>
          )}
        </StyledSelect>
        <Tooltip title="用于生成随机用户的邮箱域名">
          <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
        </Tooltip>
      </Space>
    </div>
  );
  
  // 自定义Modal底部，包含邀请码输入框和按钮
  const modalFooter = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
      <InvitationCodeWrapper>
        <Text strong style={{ marginRight: 8 }}>邀请码：</Text>
        <Input
          value={invitationCode}
          onChange={handleInvitationCodeChange}
          placeholder="请输入邀请码"
          disabled={registering}
          defaultValue={DEFAULT_INVITATION_CODE}
          style={{ width: 180 }}
        />
        <Tooltip title="用于Infini注册的邀请码">
          <QuestionCircleOutlined style={{ color: '#8c8c8c', marginLeft: 8 }} />
        </Tooltip>
      </InvitationCodeWrapper>
      
    <Space>
      <Button onClick={onCancel} disabled={registering}>
        取消
      </Button>
      
      {/* 2FA按钮，在取消和关闭按钮之间 */}
      {registerSuccess && show2faButton && (
        <Button
          type="primary"
          icon={<SafetyOutlined />}
          loading={false}
          onClick={prepare2faConfig}
          style={{ marginRight: 8 }}
        >
          准备2FA配置
        </Button>
      )}
      
      {registerSuccess ? (
        <Button 
          type="primary" 
          onClick={() => onSuccess(userData)}
        >
          关闭
        </Button>
      ) : (
        <Button 
          type="primary" 
          onClick={handleRegister} 
          loading={registering}
          disabled={!userData || registering}
        >
          执行注册
        </Button>
      )}
    </Space>
    </div>
  );

  // 日志面板组件 - 使用React.memo避免重渲染
  const LogPanel = React.memo(() => {
    return (
      <LogSection id="log-container" ref={logSectionRef}>
        {logs.length === 0 ? (
          <Text type="secondary">暂无日志记录</Text>
        ) : (
          logs.map((log, index) => (
            <LogItem key={index}>{log}</LogItem>
          ))
        )}
      </LogSection>
    );
  });

  return (
    <>
      <Modal
        title={modalTitle}
        open={visible}
        onCancel={onCancel}
        width={900}
        footer={modalFooter}
        destroyOnClose={false} // 不在关闭时销毁内容
        maskClosable={false} // 防止误触遮罩关闭
        keyboard={false} // 禁用ESC键关闭
        style={{ top: 20 }} // 固定位置避免闪烁
      >
        <Spin spinning={loading} tip="加载中...">
          <ModalContent>
            <Row gutter={24}>
              <Col span={12}>
                <InfoCard 
                  title={
                    <Space>
                      <UserOutlined />
                      <span>随机用户信息</span>
                      <Button 
                        icon={<ReloadOutlined />} 
                        size="small" 
                        onClick={handleRefresh}
                        loading={refreshing}
                        disabled={registering}
                      >
                        刷新
                      </Button>
                    </Space>
                  }
                >
                {userData ? (
                  <>
                    <UserInfoItem>
                      <ItemLabel><MailOutlined /> 邮箱：</ItemLabel>
                      <ItemValue copyable>{userData.full_email}</ItemValue>
                    </UserInfoItem>
                    
                    <UserInfoItem>
                      <ItemLabel><LockOutlined /> 密码：</ItemLabel>
                      <ItemValue copyable>{userData.password}</ItemValue>
                    </UserInfoItem>
                    
                    <UserInfoItem>
                      <ItemLabel><UserOutlined /> 姓名：</ItemLabel>
                      <ItemValue>{`${userData.last_name}, ${userData.first_name}`}</ItemValue>
                    </UserInfoItem>
                    
                    <UserInfoItem>
                      <ItemLabel><IdcardOutlined /> 护照号：</ItemLabel>
                      <ItemValue copyable>{userData.passport_no}</ItemValue>
                    </UserInfoItem>
                    
                    <UserInfoItem>
                      <ItemLabel><PhoneOutlined /> 手机号：</ItemLabel>
                      <ItemValue copyable>{userData.phone}</ItemValue>
                    </UserInfoItem>
                    
                    <UserInfoItem>
                      <ItemLabel><CalendarOutlined /> 出生日期：</ItemLabel>
                      <ItemValue>{`${userData.birth_year}, ${userData.birth_month}, ${userData.birth_day}`}</ItemValue>
                    </UserInfoItem>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <Text type="secondary">暂无随机用户数据</Text>
                  </div>
                )}
              </InfoCard>
              
              <InfoCard
                title={
                  <Space>
                    <IdcardOutlined />
                    <span>KYC图片</span>
                  </Space>
                }
              >
                {kycImage ? (
                  <>
                    <KycImage
                      src={kycImage.img_base64}
                      alt="KYC图片"
                    />
                    
                    {kycImage.tags && (
                      <div>
                        <Text strong>标签：</Text>
                        {kycImage.tags.split(',').map((tag: string, index: number) => (
                          <Tag key={index} color="blue">{tag.trim()}</Tag>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <Text type="secondary">暂无KYC图片</Text>
                  </div>
                )}
              </InfoCard>
              {/* 2FA按钮已移至底部 */}
            </Col>
            
            <Col span={12}>
                <InfoCard
                  title={
                    <Space>
                      <IdcardOutlined />
                      <span>注册进度</span>
                    </Space>
                  }
                >
                  <Timeline>
                    <StepItem 
                      color={currentStep >= 1 ? "blue" : "gray"} 
                      dot={currentStep === 1 ? <LoadingOutlined /> : undefined}
                    >
                      <Text strong>发送验证码</Text>
                      <div>向随机生成的邮箱发送验证码</div>
                    </StepItem>
                    
                    <StepItem 
                      color={currentStep >= 2 ? "blue" : "gray"} 
                      dot={currentStep === 2 ? <LoadingOutlined /> : undefined}
                    >
                      <Text strong>获取验证码</Text>
                      <div>从邮箱中提取收到的验证码</div>
                    </StepItem>
                    
                    <StepItem 
                      color={currentStep >= 3 ? "blue" : "gray"} 
                      dot={currentStep === 3 ? <LoadingOutlined /> : undefined}
                    >
                      <Text strong>注册Infini账户</Text>
                      <div>调用Infini注册接口创建账户</div>
                    </StepItem>
                    
                    <StepItem 
                      color={currentStep >= 4 ? "blue" : "gray"} 
                      dot={currentStep === 4 ? <LoadingOutlined /> : undefined}
                    >
                      <Text strong>保存账户信息</Text>
                      <div>将账户信息保存到本地数据库</div>
                    </StepItem>
                    
                    <StepItem 
                      color={currentStep >= 5 ? "blue" : "gray"} 
                      dot={currentStep === 5 ? <LoadingOutlined /> : undefined}
                    >
                      <Text strong>同步账户信息</Text>
                      <div>获取最新账户资料并更新数据库</div>
                    </StepItem>
                    
                    <StepItem 
                      color={currentStep >= 6 ? "green" : (registering === false && currentStep < 6 ? "red" : "gray")} 
                      dot={currentStep === 6 
                        ? <CheckCircleOutlined style={{ color: 'green' }} /> 
                        : (registering === false && currentStep < 6 ? <CloseCircleOutlined style={{ color: 'red' }} /> : undefined)
                      }
                    >
                      <Text strong>完成</Text>
                      <div>注册流程完成</div>
                    </StepItem>
                  </Timeline>
                </InfoCard>
              
              <LogPanel />
            </Col>
          </Row>
        </ModalContent>
      </Spin>
      </Modal>
      
      {/* 2FA配置模态框 */}
      {createdAccount && (
        <TwoFactorAuthModal
          visible={twoFactorAuthModalVisible}
          accountId={createdAccount.id}
          email={userData?.full_email || ''}
          password={userData?.password || ''}
          onClose={() => setTwoFactorAuthModalVisible(false)}
          onSuccess={handle2FASuccess}
        />
      )}
    </>
  );
};

export default RandomUserRegisterModal;