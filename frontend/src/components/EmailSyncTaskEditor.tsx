/**
 * 邮件同步任务编辑器组件
 * 用于内置邮件同步定时任务的专用编辑界面
 * 支持选择邮箱账户、同步类型、邮箱文件夹等配置
 */
import React, { useState, useEffect } from 'react';
import {
  Form,
  Select,
  Radio,
  Checkbox,
  DatePicker,
  Input,
  Row,
  Col,
  Card,
  Typography,
  Divider,
  Button,
  Space,
  Alert,
  Tooltip,
  message,
  Spin
} from 'antd';
import {
  MailOutlined,
  SyncOutlined,
  CalendarOutlined,
  InfoCircleOutlined,
  FilterOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { emailAccountApi } from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

// 样式组件
const StyledCard = styled(Card)`
  margin-bottom: 16px;
  border-radius: 6px;
`;

const EmailSyncParamLabel = styled(Text)`
  display: inline-block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
`;

// 接口定义
interface EmailAccount {
  id: number;
  name: string;
  email: string;
  status: string;
  is_default?: number;
}

interface EmailSyncParams {
  accountIds: number[];
  syncType: 'full' | 'incremental';
  mailboxes: string[];
  startDate?: string;
  endDate?: string;
}

interface EmailSyncTaskEditorProps {
  value?: EmailSyncParams;
  onChange?: (params: EmailSyncParams) => void;
  disabled?: boolean;
}

// 默认参数
const defaultParams: EmailSyncParams = {
  accountIds: [],
  syncType: 'incremental',
  mailboxes: ['INBOX'],
  startDate: undefined,
  endDate: undefined
};

// 可选邮箱文件夹列表
const availableMailboxes = [
  { value: 'INBOX', label: '收件箱' },
  { value: 'Sent', label: '已发送' },
  { value: 'Drafts', label: '草稿箱' },
  { value: 'Trash', label: '垃圾箱' },
  { value: 'Junk', label: '垃圾邮件' },
  { value: 'Archive', label: '存档' }
];

/**
 * 邮件同步任务编辑器组件
 */
const EmailSyncTaskEditor: React.FC<EmailSyncTaskEditorProps> = ({
  value = defaultParams,
  onChange,
  disabled = false
}) => {
  // 状态
  const [loading, setLoading] = useState<boolean>(false);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [params, setParams] = useState<EmailSyncParams>(value || defaultParams);
  const [error, setError] = useState<string | null>(null);

  // 加载邮箱账户列表
  const fetchEmailAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await emailAccountApi.getAllEmailAccounts();
      if (response.success) {
        // 过滤出激活状态的邮箱账户
        const activeAccounts = (response.data || []).filter(
          (account: EmailAccount) => account.status === 'active'
        );
        setEmailAccounts(activeAccounts);

        // 如果没有选择任何账户，且有默认账户，则自动选择默认账户
        if (params.accountIds.length === 0) {
          const defaultAccount = activeAccounts.find((acc: EmailAccount) => acc.is_default === 1);
          if (defaultAccount) {
            updateParams('accountIds', [defaultAccount.id]);
          }
        }
      } else {
        setError(response.message || '获取邮箱账户失败');
      }
    } catch (error: any) {
      console.error('获取邮箱账户失败:', error);
      setError(error.message || '获取邮箱账户失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchEmailAccounts();
  }, []);

  // 当外部value改变时，更新内部状态
  useEffect(() => {
    if (value) {
      setParams(value);
    }
  }, [value]);

  // 更新参数并触发onChange
  const updateParams = (key: keyof EmailSyncParams, newValue: any) => {
    const updatedParams = { ...params, [key]: newValue };
    setParams(updatedParams);
    if (onChange) {
      onChange(updatedParams);
    }
  };

  // 处理选择全部邮箱
  const handleSelectAllAccounts = () => {
    const allAccountIds = emailAccounts.map((account) => account.id);
    updateParams('accountIds', allAccountIds);
  };

  // 处理清除所有选择
  const handleClearAllAccounts = () => {
    updateParams('accountIds', []);
  };

  return (
    <div>
      {/* 错误提示 */}
      {error && (
        <Alert
          message="加载邮箱账户失败"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 邮箱账户选择 */}
      <StyledCard
        title={
          <Space>
            <MailOutlined />
            <span>选择邮箱账户</span>
            <Tooltip title="选择需要同步邮件的邮箱账户">
              <QuestionCircleOutlined style={{ color: '#999' }} />
            </Tooltip>
          </Space>
        }
        extra={
          <Space>
            <Button 
              size="small" 
              onClick={handleSelectAllAccounts}
              disabled={loading || disabled || emailAccounts.length === 0}
            >
              全选
            </Button>
            <Button 
              size="small" 
              onClick={handleClearAllAccounts}
              disabled={loading || disabled || params.accountIds.length === 0}
            >
              清空
            </Button>
            <Button 
              size="small"
              type="primary" 
              icon={<SyncOutlined />} 
              onClick={fetchEmailAccounts}
              loading={loading}
              disabled={disabled}
            >
              刷新
            </Button>
          </Space>
        }
      >
        <Spin spinning={loading}>
          {emailAccounts.length === 0 ? (
            <Alert
              message="没有找到可用的邮箱账户"
              description="请先添加并验证邮箱账户，然后再配置邮件同步任务"
              type="warning"
              showIcon
            />
          ) : (
            <>
              <EmailSyncParamLabel>
                请选择需要同步邮件的邮箱账户（可多选）：
              </EmailSyncParamLabel>
              <Form.Item style={{ marginBottom: 0 }}>
                <Select
                  mode="multiple"
                  placeholder="请选择邮箱账户"
                  value={params.accountIds}
                  onChange={(value) => updateParams('accountIds', value)}
                  style={{ width: '100%' }}
                  optionFilterProp="children"
                  disabled={disabled}
                  allowClear
                >
                  {emailAccounts.map((account) => (
                    <Option key={account.id} value={account.id}>
                      {account.name} ({account.email})
                      {account.is_default === 1 && " (默认)"}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              
              <div style={{ marginTop: 8, color: '#999' }}>
                已选择 {params.accountIds.length} 个邮箱账户
                {params.accountIds.length === 0 && (
                  <Text type="warning"> (未选择任何账户时，将同步所有激活的邮箱账户)</Text>
                )}
              </div>
            </>
          )}
        </Spin>
      </StyledCard>

      {/* 同步参数配置 */}
      <StyledCard
        title={
          <Space>
            <SyncOutlined />
            <span>同步参数配置</span>
            <Tooltip title="配置邮件同步的详细参数">
              <QuestionCircleOutlined style={{ color: '#999' }} />
            </Tooltip>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <EmailSyncParamLabel>同步类型：</EmailSyncParamLabel>
            <Form.Item style={{ marginBottom: 8 }}>
              <Radio.Group
                value={params.syncType}
                onChange={(e) => updateParams('syncType', e.target.value)}
                disabled={disabled}
              >
                <Radio value="incremental">
                  <Space>
                    <span>增量同步</span>
                    <Tooltip title="只同步上次同步后的新邮件，更节省资源">
                      <InfoCircleOutlined style={{ color: '#1890ff' }} />
                    </Tooltip>
                  </Space>
                </Radio>
                <Radio value="full">
                  <Space>
                    <span>全量同步</span>
                    <Tooltip title="同步指定日期范围内的所有邮件，较消耗资源">
                      <InfoCircleOutlined style={{ color: '#faad14' }} />
                    </Tooltip>
                  </Space>
                </Radio>
              </Radio.Group>
            </Form.Item>
          </Col>

          <Col span={24}>
            <EmailSyncParamLabel>邮箱文件夹：</EmailSyncParamLabel>
            <Form.Item style={{ marginBottom: 8 }}>
              <Checkbox.Group
                value={params.mailboxes}
                onChange={(values) => updateParams('mailboxes', values)}
                disabled={disabled}
                style={{ width: '100%' }}
              >
                <Row gutter={[16, 8]}>
                  {availableMailboxes.map((mailbox) => (
                    <Col span={8} key={mailbox.value}>
                      <Checkbox value={mailbox.value}>{mailbox.label}</Checkbox>
                    </Col>
                  ))}
                </Row>
              </Checkbox.Group>
            </Form.Item>
            <div style={{ marginTop: 4, color: '#999' }}>
              至少选择一个邮箱文件夹 (默认为"收件箱")
            </div>
          </Col>

          {params.syncType === 'full' && (
            <Col span={24}>
              <EmailSyncParamLabel>
                <Space>
                  <CalendarOutlined />
                  <span>日期范围：</span>
                  <Tooltip title="仅在全量同步模式下有效，留空表示不限制">
                    <QuestionCircleOutlined style={{ color: '#999' }} />
                  </Tooltip>
                </Space>
              </EmailSyncParamLabel>
              <Form.Item style={{ marginBottom: 8 }}>
                <RangePicker
                  style={{ width: '100%' }}
                  placeholder={['开始日期', '结束日期']}
                  disabled={disabled}
                  onChange={(dates, dateStrings) => {
                    updateParams('startDate', dateStrings[0]);
                    updateParams('endDate', dateStrings[1]);
                  }}
                />
              </Form.Item>
              <div style={{ color: '#999' }}>
                不设置日期范围则默认同步最近一个月的邮件
              </div>
            </Col>
          )}
        </Row>
      </StyledCard>

      {/* 说明信息 */}
      <Alert
        message="邮件同步说明"
        description={
          <div>
            <p>
              <strong>增量同步：</strong> 只同步上次同步以来的新邮件，适合日常使用。
            </p>
            <p>
              <strong>全量同步：</strong> 同步指定日期范围内的所有邮件，会消耗更多资源。
            </p>
            <p>
              定时任务执行时，将按照您的配置对选定的邮箱账户进行邮件同步操作。每个邮箱将按顺序处理，同步结果将记录在系统日志中。
            </p>
          </div>
        }
        type="info"
        showIcon
      />
    </div>
  );
};

export default EmailSyncTaskEditor;