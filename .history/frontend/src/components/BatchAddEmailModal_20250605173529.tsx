/**
 * 批量添加主邮箱模态窗口
 * 提供用户输入多行邮箱账户信息，解析和批量添加的功能
 */
import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Table,
  message,
  Space,
  Typography,
  Alert,
  Row,
  Col,
  Progress,
  Select
} from 'antd';
import { QuestionCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { emailAccountApi } from '../services/api';

const { TextArea } = Input;
const { Text, Title, Paragraph } = Typography;
const { Option } = Select;

interface BatchAddEmailModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

// 定义邮箱数据接口
interface EmailData {
  key: string;
  email: string;
  password: string;
  type: string;
  domainName: string;
  status: 'pending' | 'success' | 'failed';
  message?: string;
}

const BatchAddEmailModal: React.FC<BatchAddEmailModalProps> = ({ visible, onCancel, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState<boolean>(false);
  const [parsing, setParsing] = useState<boolean>(false);
  const [adding, setAdding] = useState<boolean>(false);
  const [emailList, setEmailList] = useState<EmailData[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [batchResult, setBatchResult] = useState<{
    total: number;
    success: number;
    failed: number;
  } | null>(null);

  // 解析输入的邮箱信息
  const handleParse = () => {
    try {
      setParsing(true);
      const emailText = form.getFieldValue('emailText');
      if (!emailText) {
        message.error('请输入邮箱信息');
        setParsing(false);
        return;
      }

      // 按行分割输入内容
      const lines = emailText.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        message.error('未检测到有效的邮箱信息');
        setParsing(false);
        return;
      }

      const parsedEmails: EmailData[] = [];
      let hasErrors = false;

      lines.forEach((line, index) => {
        // 分割每行内容（格式：邮箱,密码,类型,域名）
        const parts = line.split(',');
        const email = parts[0]?.trim();
        const password = parts[1]?.trim();
        const type = parts[2]?.trim() || 'gmail';
        const domainName = parts[3]?.trim() || '';

        // 简单验证邮箱格式
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        
        if (!isValidEmail || !password) {
          hasErrors = true;
          parsedEmails.push({
            key: `${index}`,
            email: email || '',
            password: password || '',
            type,
            domainName,
            status: 'failed',
            message: !isValidEmail ? '邮箱格式错误' : '密码不能为空'
          });
        } else {
          parsedEmails.push({
            key: `${index}`,
            email,
            password,
            type,
            domainName,
            status: 'pending'
          });
        }
      });

      setEmailList(parsedEmails);
      
      if (hasErrors) {
        message.warning('部分邮箱信息格式有误，请检查');
      } else {
        message.success(`成功解析 ${parsedEmails.length} 个邮箱信息`);
      }
    } catch (error) {
      console.error('解析邮箱信息失败:', error);
      message.error('解析邮箱信息失败');
    } finally {
      setParsing(false);
    }
  };

  // 批量添加邮箱
  const handleAddEmails = async () => {
    try {
      if (emailList.length === 0) {
        message.error('没有要添加的邮箱');
        return;
      }

      const validEmails = emailList.filter(item => item.status !== 'failed');
      if (validEmails.length === 0) {
        message.error('没有有效的邮箱信息');
        return;
      }

      setAdding(true);
      setProgress(0);
      setBatchResult(null);

      // 复制一份邮箱列表用于更新状态
      const updatedEmails = [...emailList];
      let successCount = 0;
      let failedCount = 0;

      // 依次保存每个邮箱
      for (let i = 0; i < validEmails.length; i++) {
        const emailData = validEmails[i];
        
        // 跳过已经处理过的邮箱
        if (emailData.status === 'success') {
          successCount++;
          continue;
        }

        // 更新进度
        const currentProgress = Math.floor((i / validEmails.length) * 100);
        setProgress(currentProgress);

        try {
          // 构建邮箱账户数据
          const accountData = {
            name: `${emailData.email} (批量添加)`,
            email: emailData.email,
            username: emailData.email,
            password: emailData.password,
            domainName: emailData.domainName,
            
            // 配置邮箱类型对应的IMAP和SMTP设置
            ...(emailData.type === 'gmail' ? {
              imapHost: 'imap.gmail.com',
              imapPort: 993,
              imapSecure: 1,
              smtpHost: 'smtp.gmail.com',
              smtpPort: 465,
              smtpSecure: 1
            } : emailData.type === 'outlook' ? {
              imapHost: 'outlook.office365.com',
              imapPort: 993,
              imapSecure: 1,
              smtpHost: 'smtp.office365.com',
              smtpPort: 587,
              smtpSecure: 0
            } : {
              // 默认使用Gmail配置
              imapHost: 'imap.gmail.com',
              imapPort: 993,
              imapSecure: 1,
              smtpHost: 'smtp.gmail.com',
              smtpPort: 465,
              smtpSecure: 1
            }),
            
            isActive: 1,
            isDefault: 0,
            status: 'pending'
          };

          // 调用API创建邮箱账户
          const response = await emailAccountApi.createEmailAccount(accountData);
          
          // 更新邮箱状态
          const index = updatedEmails.findIndex(e => e.key === emailData.key);
          if (index !== -1) {
            if (response.success) {
              updatedEmails[index].status = 'success';
              successCount++;
            } else {
              updatedEmails[index].status = 'failed';
              updatedEmails[index].message = response.message || '添加失败';
              failedCount++;
            }
            setEmailList([...updatedEmails]);
          }
        } catch (error: any) {
          console.error(`添加邮箱 ${emailData.email} 失败:`, error);
          
          // 更新邮箱状态
          const index = updatedEmails.findIndex(e => e.key === emailData.key);
          if (index !== -1) {
            updatedEmails[index].status = 'failed';
            updatedEmails[index].message = error.message || '添加失败';
            failedCount++;
            setEmailList([...updatedEmails]);
          }
        }

        // 添加短暂延迟，避免API请求过于频繁
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // 更新最终进度和结果
      setProgress(100);
      setBatchResult({
        total: validEmails.length,
        success: successCount,
        failed: failedCount
      });

      if (failedCount === 0) {
        message.success(`成功添加 ${successCount} 个邮箱账户`);
        onSuccess();
      } else {
        message.warning(`邮箱添加完成，成功: ${successCount}，失败: ${failedCount}`);
      }
    } catch (error) {
      console.error('批量添加邮箱失败:', error);
      message.error('批量添加邮箱失败');
    } finally {
      setAdding(false);
    }
  };

  // 重置表单和状态
  const handleReset = () => {
    form.resetFields();
    setEmailList([]);
    setProgress(0);
    setBatchResult(null);
  };

  // 取消操作
  const handleCancel = () => {
    handleReset();
    onCancel();
  };

  // 表格列定义
  const columns = [
    {
      title: '邮箱地址',
      dataIndex: 'email',
      key: 'email',
      width: 180,
    },
    {
      title: '密码',
      dataIndex: 'password',
      key: 'password',
      width: 120,
      render: (text: string) => text ? '********' : '',
    },
    {
      title: '邮箱类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
    },
    {
      title: '域名邮箱',
      dataIndex: 'domainName',
      key: 'domainName',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string, record: EmailData) => {
        if (status === 'success') {
          return <Text type="success"><CheckCircleOutlined /> 成功</Text>;
        } else if (status === 'failed') {
          return (
            <Text type="danger" title={record.message}>
              <CloseCircleOutlined /> 失败
            </Text>
          );
        } else {
          return <Text type="warning">待处理</Text>;
        }
      },
    },
    {
      title: '错误信息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
  ];

  return (
    <Modal
      title="批量添加主邮箱"
      open={visible}
      onCancel={handleCancel}
      width={900}
      footer={null}
      destroyOnClose
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Alert
            message="使用说明"
            description={
              <div>
                <Paragraph>
                  请按照以下格式输入邮箱信息，每行一个邮箱，格式为：
                  <Text code>邮箱地址,密码,邮箱类型,域名邮箱</Text>
                </Paragraph>
                <Paragraph>
                  <Text strong>示例：</Text>
                  <br />
                  <Text code>xxx@gmail.com,password,,</Text>
                  <br />
                  <Text code>zzz@gmail.com,pass,gmail,</Text>
                  <br />
                  <Text code>aaa@outlook.com,pass123,outlook,outlook.routerhub.io</Text>
                </Paragraph>
                <Paragraph>
                  <ul>
                    <li>邮箱地址和密码为必填项</li>
                    <li>邮箱类型默认为gmail，可选值：gmail、outlook</li>
                    <li>域名邮箱为可选项</li>
                  </ul>
                </Paragraph>
              </div>
            }
            type="info"
            showIcon
          />
        </Col>

        <Col span={24}>
          <Form form={form} layout="vertical">
            <Form.Item
              name="emailText"
              label="批量邮箱信息"
              rules={[{ required: true, message: '请输入邮箱信息' }]}
            >
              <TextArea
                rows={8}
                placeholder="请输入邮箱信息，每行一个，格式：邮箱地址,密码,邮箱类型,域名邮箱"
                disabled={adding}
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button 
                  type="primary" 
                  onClick={handleParse} 
                  loading={parsing}
                  disabled={adding}
                >
                  一键解析
                </Button>
                <Button onClick={handleReset} disabled={adding}>
                  重置
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Col>

        {emailList.length > 0 && (
          <Col span={24}>
            <Title level={5}>解析结果（{emailList.length}个邮箱）</Title>
            <Table
              columns={columns}
              dataSource={emailList}
              pagination={{ pageSize: 5 }}
              rowKey="key"
              size="small"
              bordered
            />

            <div style={{ marginTop: 16, marginBottom: 16 }}>
              {adding && (
                <div style={{ marginBottom: 16 }}>
                  <Progress percent={progress} status="active" />
                  <Text type="secondary">正在添加邮箱，请稍候...</Text>
                </div>
              )}

              {batchResult && (
                <Alert
                  message="添加结果"
                  description={
                    <div>
                      <Text>总计：{batchResult.total}个邮箱</Text>
                      <br />
                      <Text type="success">成功：{batchResult.success}个</Text>
                      <br />
                      <Text type="danger">失败：{batchResult.failed}个</Text>
                    </div>
                  }
                  type={batchResult.failed === 0 ? 'success' : 'warning'}
                  showIcon
                />
              )}

              <div style={{ marginTop: 16 }}>
                <Space>
                  <Button 
                    type="primary" 
                    onClick={handleAddEmails} 
                    loading={adding}
                    disabled={parsing || emailList.length === 0}
                  >
                    一键添加邮箱
                  </Button>
                  <Button onClick={handleCancel}>
                    关闭
                  </Button>
                </Space>
              </div>
            </div>
          </Col>
        )}
      </Row>
    </Modal>
  );
};

export default BatchAddEmailModal;