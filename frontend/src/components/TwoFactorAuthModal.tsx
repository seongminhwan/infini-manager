/**
 * 2FA配置模态框
 * 用于自动配置Infini账户的2FA验证
 * 采用左右两列布局，左侧为时间线，右侧为日志
 * 避免每次步骤更新时导致模态框闪烁问题
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Timeline,
  Typography,
  message,
  Row,
  Col
} from 'antd';
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { infiniAccountApi, totpToolApi } from '../services/api';

const { Text, Title } = Typography;

// Timeline.Item样式组件
const StepItem = styled(Timeline.Item)`
  padding-bottom: 16px;
`;

// 日志容器样式
const LogContainer = styled.div`
  max-height: 400px;
  overflow-y: auto;
  background-color: #f5f5f5;
  padding: 12px;
  border-radius: 4px;
  margin-top: 8px;
`;

// 日志项样式
const LogItem = styled.div`
  font-family: monospace;
  margin-bottom: 4px;
  white-space: pre-wrap;
  word-break: break-all;
`;

// 容器样式
const Container = styled.div`
  min-height: 400px;
  max-height: 600px;
`;

// 列样式
const Column = styled.div`
  height: 100%;
  padding: 0 8px;
`;

// 接口定义
interface TwoFactorAuthModalProps {
  visible: boolean;
  accountId: number;
  email: string;
  password: string;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * 2FA配置模态框组件
 */
const TwoFactorAuthModal: React.FC<TwoFactorAuthModalProps> = ({
  visible,
  accountId,
  email,
  password,
  onClose,
  onSuccess
}) => {
  // 状态管理
  const [configuring2fa, setConfiguring2fa] = useState<boolean>(false);
  const [auto2faStep, setAuto2faStep] = useState<number>(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [showStartButton, setShowStartButton] = useState<boolean>(true);

  // 清除历史缓存
  const clearHistoryCache = useCallback(() => {
    setLogs([]);
    setAuto2faStep(0);
    setShowStartButton(true);
  }, []);

  // 当模态框打开时，重置状态
  useEffect(() => {
    if (visible) {
      clearHistoryCache();
    }
  }, [visible, clearHistoryCache]);

  // 添加日志
  const addLog = useCallback((text: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = type === 'error' 
      ? '❌ ' 
      : type === 'success' 
        ? '✅ ' 
        : '📝 ';
    
    setLogs(prevLogs => [...prevLogs, `${prefix}[${timestamp}] ${text}`]);
  }, []);

  // 自动配置2FA功能
  const handleAuto2faConfig = async () => {
    if (!accountId || !email || !password) {
      message.error('缺少必要信息，无法配置2FA');
      return;
    }
    
    try {
      setConfiguring2fa(true);
      setShowStartButton(false);
      setAuto2faStep(1);
      addLog('开始自动配置2FA...', 'info');
      
      // 步骤1: 获取2FA信息
      addLog('步骤1: 获取2FA二维码信息...', 'info');
      const qrCodeResponse = await infiniAccountApi.getGoogle2faQrCode(accountId.toString());
      
      if (!qrCodeResponse.success || !qrCodeResponse.data || !qrCodeResponse.data.qr_code) {
        throw new Error('获取2FA二维码失败');
      }
      
      const qrCodeUrl = qrCodeResponse.data.qr_code;
      addLog(`成功获取2FA二维码: ${qrCodeUrl}`, 'success');
      
      // 保存完整的二维码URL，确保包含所有参数（算法、位数等）
      // 同时提取密钥用于日志展示
      const secretMatch = qrCodeUrl.match(/secret=([A-Z0-9]+)/i);
      if (!secretMatch || !secretMatch[1]) {
        throw new Error('无法从二维码中提取密钥');
      }
      
      const secret = secretMatch[1];
      addLog(`提取2FA密钥: ${secret}`, 'success');
      
      // 检查是否包含算法参数
      const algorithmMatch = qrCodeUrl.match(/algorithm=([A-Za-z0-9-]+)/i);
      if (algorithmMatch && algorithmMatch[1]) {
        addLog(`使用算法: ${algorithmMatch[1]}`, 'info');
      }
      
      // 确保2FA信息已正确持久化到数据库
      addLog('确保2FA信息正确持久化到数据库...', 'info');
      
      // 添加一个短暂延迟，确保数据库操作有足够时间完成
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 通过调用同步API来确认数据保存成功
      const checkSyncResponse = await infiniAccountApi.syncAccount(accountId.toString());
      if (!checkSyncResponse.success) {
        addLog('同步账户信息失败，但将继续2FA配置流程', 'error');
      } else {
        // 检查同步返回的数据中是否包含2FA信息
        if (checkSyncResponse.data.twoFaInfo && 
            checkSyncResponse.data.twoFaInfo.qrCodeUrl && 
            checkSyncResponse.data.twoFaInfo.secretKey) {
          addLog('2FA信息已成功持久化到数据库', 'success');
        } else {
          addLog('警告: 2FA信息可能未正确保存到数据库，但将继续配置流程', 'error');
        }
      }
      
      // 步骤2: 发送验证邮件 - 使用通用验证码接口而非专用2FA接口
      addLog('步骤2: 发送2FA验证邮件...', 'info');
      setAuto2faStep(2);
      const emailResponse = await infiniAccountApi.sendVerificationCode(email,6);
      
      if (!emailResponse.success) {
        throw new Error(`发送2FA验证邮件失败: ${emailResponse.message || '未知错误'}`);
      }
      
      addLog('2FA验证邮件发送成功', 'success');
      
      // 步骤3: 获取邮箱验证码 - 使用支持重试和延迟的接口
      addLog('步骤3: 获取邮箱验证码...', 'info');
      setAuto2faStep(3);
      
      // 使用支持重试和延迟的接口
      const emailVerificationResponse = await infiniAccountApi.fetchVerificationCode(
        email,
        undefined, // 主邮箱参数
        10,        // 重试10次
        5          // 每5秒重试一次
      );
      
      if (!emailVerificationResponse.success || !emailVerificationResponse.data.code) {
        throw new Error(`获取邮箱验证码失败: ${emailVerificationResponse.message}`);
      }
      
      const emailVerificationCode = emailVerificationResponse.data.code;
      addLog(`成功获取邮箱验证码: ${emailVerificationCode}`, 'success');
      
      // 步骤4: 使用TOTP工具生成2FA验证码
      addLog('步骤4: 生成2FA验证码...', 'info');
      setAuto2faStep(4);
      
      // 使用完整的二维码URL而非仅提取的密钥，确保使用正确的算法和参数
      const totpResponse = await totpToolApi.generateTotpCode(qrCodeUrl);
      
      if (!totpResponse.success || !totpResponse.data.code) {
        throw new Error(`生成2FA验证码失败: ${totpResponse.message}`);
      }
      
      const totpCode = totpResponse.data.code;
      addLog(`成功生成2FA验证码: ${totpCode}`, 'success');
      
      // 步骤5: 绑定2FA
      addLog('步骤5: 绑定2FA...', 'info');
      setAuto2faStep(5);
      
      // 注意：此处API会返回恢复码，但我们也需要将其传递给后端保存
      let bindResponse;
      try {
        bindResponse = await infiniAccountApi.bindGoogle2fa(
          emailVerificationCode,
          totpCode,
          accountId.toString()
        );
        
        if (!bindResponse.success) {
          throw new Error(`绑定2FA失败: ${bindResponse.message || JSON.stringify(bindResponse)}`);
        }
        
            // 提取恢复码并显示（恢复码已在后端自动保存到数据库）
            const recoveryCodes = bindResponse.data.recovery_code;
            if (recoveryCodes && recoveryCodes.length > 0) {
              addLog('2FA绑定成功，已获取恢复码:', 'success');
              recoveryCodes.forEach((code: string) => {
                addLog(`恢复码: ${code}`, 'info');
              });
              
              // 不再需要二次调用API，后端已自动保存恢复码
              addLog('恢复码已自动保存到数据库', 'success');
        } else {
          addLog('2FA绑定成功', 'success');
        }
      } catch (bindError) {
        addLog(`绑定2FA过程中发生错误: ${(bindError as Error).message}`, 'error');
        throw bindError;
      }
      
      // 步骤6: 同步账户信息，更新2FA状态
      addLog('步骤6: 更新数据库中的2FA状态...', 'info');
      setAuto2faStep(6);
      const syncResponse = await infiniAccountApi.syncAccount(accountId.toString());
      
      if (!syncResponse.success) {
        throw new Error(`同步账户信息失败: ${syncResponse.message}`);
      }
      
      addLog('成功更新2FA状态并同步到数据库', 'success');
      setAuto2faStep(7);
      
      // 配置完成
      addLog('2FA自动配置完成!', 'success');
      message.success('2FA自动配置成功!');
      
      // 调用父组件的成功回调，刷新账户列表
      onSuccess();
    } catch (error) {
      const errorMessage = (error as Error).message;
      addLog(`2FA配置失败: ${errorMessage}`, 'error');
      message.error('2FA配置失败: ' + errorMessage);
      setShowStartButton(true);
    } finally {
      setConfiguring2fa(false);
    }
  };

  // 处理关闭
  const handleCancel = useCallback(() => {
    // 只在用户点击关闭按钮时触发回传
    onClose();
    // 不立即清除状态，等待下次打开时清除
  }, [onClose]);

  // 渲染2FA配置进度时间线
  const renderAuto2faTimeline = useCallback(() => {
    return (
      <Timeline>
        <StepItem 
          color={auto2faStep >= 1 ? "blue" : "gray"} 
          dot={auto2faStep === 1 ? <LoadingOutlined /> : undefined}
        >
          <Text strong>获取2FA信息</Text>
          <div>获取2FA二维码和密钥</div>
        </StepItem>
        
        <StepItem 
          color={auto2faStep >= 2 ? "blue" : "gray"} 
          dot={auto2faStep === 2 ? <LoadingOutlined /> : undefined}
        >
          <Text strong>发送验证邮件</Text>
          <div>发送2FA绑定验证邮件</div>
        </StepItem>
        
        <StepItem 
          color={auto2faStep >= 3 ? "blue" : "gray"} 
          dot={auto2faStep === 3 ? <LoadingOutlined /> : undefined}
        >
          <Text strong>获取邮箱验证码</Text>
          <div>从邮箱中提取验证码</div>
        </StepItem>
        
        <StepItem 
          color={auto2faStep >= 4 ? "blue" : "gray"} 
          dot={auto2faStep === 4 ? <LoadingOutlined /> : undefined}
        >
          <Text strong>生成2FA验证码</Text>
          <div>使用密钥生成TOTP验证码</div>
        </StepItem>
        
        <StepItem 
          color={auto2faStep >= 5 ? "blue" : "gray"} 
          dot={auto2faStep === 5 ? <LoadingOutlined /> : undefined}
        >
          <Text strong>绑定2FA</Text>
          <div>提交验证码绑定2FA</div>
        </StepItem>
        
        <StepItem 
          color={auto2faStep >= 6 ? "blue" : "gray"} 
          dot={auto2faStep === 6 ? <LoadingOutlined /> : undefined}
        >
          <Text strong>更新2FA状态</Text>
          <div>持久化2FA数据到数据库</div>
        </StepItem>
        
        <StepItem 
          color={auto2faStep >= 7 ? "green" : (configuring2fa === false && auto2faStep > 0 && auto2faStep < 7 ? "red" : "gray")} 
          dot={auto2faStep === 7 
            ? <CheckCircleOutlined style={{ color: 'green' }} /> 
            : (configuring2fa === false && auto2faStep > 0 && auto2faStep < 7 ? <CloseCircleOutlined style={{ color: 'red' }} /> : undefined)
          }
        >
          <Text strong>完成</Text>
          <div>2FA自动配置完成</div>
        </StepItem>
      </Timeline>
    );
  }, [auto2faStep, configuring2fa]);

  // 渲染日志列表
  const renderLogs = useCallback(() => {
    return (
      <LogContainer>
        {logs.length > 0 ? logs.map((log, index) => (
          <LogItem key={index}>{log}</LogItem>
        )) : (
          <Text type="secondary">暂无日志记录</Text>
        )}
      </LogContainer>
    );
  }, [logs]);

  return (
    <Modal
      title="2FA配置"
      open={visible}
      onCancel={handleCancel}
      maskClosable={false}
      destroyOnClose={false}
      width={800}
      footer={[
        <Button 
          key="close" 
          onClick={handleCancel}
          disabled={configuring2fa}
        >
          关闭
        </Button>,
        showStartButton && (
          <Button 
            key="start" 
            type="primary" 
            onClick={handleAuto2faConfig}
            loading={configuring2fa}
            disabled={configuring2fa}
          >
            开始配置
          </Button>
        )
      ]}
    >
      <Container>
        <Row gutter={16}>
          {/* 左侧时间线 */}
          <Col span={10}>
            <Column>
              <Title level={5}>配置进度</Title>
              {renderAuto2faTimeline()}
            </Column>
          </Col>
          
          {/* 右侧日志 */}
          <Col span={14}>
            <Column>
              <Title level={5}>日志记录</Title>
              {renderLogs()}
            </Column>
          </Col>
        </Row>
      </Container>
    </Modal>
  );
};

export default TwoFactorAuthModal;