/**
 * 批量添加账户模态框组件
 */
import React, { useState, useRef } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Table,
  message,
  Space,
  Typography,
  Popconfirm,
  Checkbox,
  Tooltip,
  Tag
} from 'antd';
import {
  MailOutlined,
  LockOutlined,
  SyncOutlined,
  InfoCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import api, { apiBaseUrl } from '../../../services/api';
import { BatchAddAccountItem } from '../types';

const { Text } = Typography;
const API_BASE_URL = apiBaseUrl;

// 组件接口定义
interface BatchAddAccountModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// 批量添加账户模态框组件
const BatchAddAccountModal: React.FC<BatchAddAccountModalProps> = ({ 
  visible, 
  onClose, 
  onSuccess 
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<BatchAddAccountItem[]>([]);
  const [batchText, setBatchText] = useState('');
  // 添加成功和失败统计
  const [successCount, setSuccessCount] = useState<number>(0);
  const [lastFailedCount, setLastFailedCount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // 表单编辑状态
  const [editingKey, setEditingKey] = useState('');

  // 重置状态
  const resetState = () => {
    form.resetFields();
    setAccounts([]);
    setBatchText('');
    setEditingKey('');
    setIsSubmitting(false);
  };

  // 处理关闭
  const handleClose = () => {
    resetState();
    onClose();
  };

  // 解析文本，提取邮箱和密码以及自定义邮箱配置
  const parseText = (text: string): Array<BatchAddAccountItem> => {
    if (!text.trim()) return [];

    const lines = text.split('\n');
    const parsedAccounts = lines.map((line, index) => {
      // 支持两种格式：
      // 1. 基础格式：email password
      // 2. 扩展格式：email password customEmail customPassword customImapHost customImapPort customSmtpHost customSmtpPort
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2) {
        const account = {
          key: `text_${index}_${Date.now()}`,
          email: parts[0],
          password: parts[1]
        } as BatchAddAccountItem;

        // 检查是否包含自定义邮箱配置信息
        if (parts.length >= 4) { // 至少包含自定义邮箱和密码
          return {
            ...account,
            useCustomEmail: true,
            customEmailAddress: parts[2],
            customEmailPassword: parts[3],
            customImapHost: parts.length > 4 ? parts[4] : '',
            customImapPort: parts.length > 5 ? Number(parts[5]) : 993,
            customSmtpHost: parts.length > 6 ? parts[6] : '',
            customSmtpPort: parts.length > 7 ? Number(parts[7]) : 465,
            customImapSecure: true,
            customSmtpSecure: true,
            customEmailStatus: 'active' as 'active' | 'disabled'
          };
        }

        return account;
      }
      return null;
    }).filter(account => account !== null) as Array<BatchAddAccountItem>;

    return parsedAccounts;
  };

  // 处理文本输入变化
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setBatchText(text);
  };

  // 解析文本并生成表单
  const parseTextToForm = () => {
    if (!batchText.trim()) {
      message.warning('请先输入账户信息');
      return;
    }

    const parsedAccounts = parseText(batchText);

    // 处理去重和覆盖逻辑
    if (accounts.length > 0) {
      // 创建邮箱到账户的映射，用于快速查找
      const emailMap = new Map<string, BatchAddAccountItem>();

      // 先将现有账户放入映射
      accounts.forEach(account => {
        emailMap.set(account.email.toLowerCase(), account);
      });

      // 处理新解析的账户
      parsedAccounts.forEach(newAccount => {
        const lowerEmail = newAccount.email.toLowerCase();
        const existingAccount = emailMap.get(lowerEmail);
        if (existingAccount) {
          // 如果邮箱已存在，更新所有信息
          Object.assign(existingAccount, newAccount);
          // 清除之前的状态
          delete existingAccount.status;
          delete existingAccount.errorMsg;
        } else {
          // 如果邮箱不存在，添加新账户
          emailMap.set(lowerEmail, newAccount);
        }
      });

      // 将映射转换回数组
      const mergedAccounts = Array.from(emailMap.values());
      setAccounts(mergedAccounts);

      message.success(`解析成功：${parsedAccounts.length}个账户已更新到表单`);
    } else {
      // 如果还没有表单数据，直接设置
      setAccounts(parsedAccounts);
      message.success(`解析成功：${parsedAccounts.length}个账户`);
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    // 确保账户数据完整
    // 如果有正在编辑的行，提示先保存
    if (editingKey) {
      message.warning('请先保存正在编辑的账户信息');
      return;
    }

    // 检查账户数据完整性
    const invalidAccounts = accounts.filter(acc => !acc.email || !acc.password);
    if (invalidAccounts.length > 0) {
      message.error('存在邮箱或密码为空的账户，请检查');
      return;
    }

    if (accounts.length === 0) {
      message.error('请输入有效的账户信息');
      return;
    }

    try {
      setLoading(true);
      setIsSubmitting(true);

      // 筛选出尚未成功添加的账户（状态不为'success'或'warning'的账户）
      const accountsToProcess = isSubmitting
        ? accounts.filter(acc => acc.status !== 'success' && acc.status !== 'warning')
        : accounts;

      if (accountsToProcess.length === 0) {
        message.info('没有需要添加的账户，所有账户都已成功添加或已存在');
        setLoading(false);
        return;
      }

      // 为每个账户准备提交数据，包括自定义邮箱配置
      const accountsToSubmit = accountsToProcess.map(({ email, password }) => ({ email, password }));

      // 循环调用单个账户创建API
      const results = { success: 0, failed: 0, warnings: 0, messages: [] as string[] };
      const newAccountsList = [...accounts]; // 创建一个新数组，用于更新状态

      for (let i = 0; i < accountsToProcess.length; i++) {
        const account = accountsToProcess[i];
        const accountIndex = accounts.findIndex(a => a.email === account.email);

        if (accountIndex === -1) continue; // 安全检查

        try {
          const accountPayload: any = {
            email: account.email,
            password: account.password,
            // mock_user_id: account.mockUserId, // 如果批量添加也支持关联随机用户
          };

          // 只保留一个自定义邮箱配置逻辑，避免重复代码
          if (account.useCustomEmail && account.customEmailAddress && account.customEmailPassword) {
            const customEmailConfig: any = {
              email: account.customEmailAddress,
              password: account.customEmailPassword,
              imap_host: account.customImapHost || '',
              imap_port: (account.customImapPort !== undefined && !isNaN(Number(account.customImapPort))) ? Number(account.customImapPort) : 993,
              imap_secure: account.customImapSecure !== undefined ? account.customImapSecure : true,
              smtp_host: account.customSmtpHost || '',
              smtp_port: (account.customSmtpPort !== undefined && !isNaN(Number(account.customSmtpPort))) ? Number(account.customSmtpPort) : 465,
              smtp_secure: account.customSmtpSecure !== undefined ? account.customSmtpSecure : true,
              status: account.customEmailStatus || 'active',
              extra_config: null,
            };
            if (account.customExtraConfig && typeof account.customExtraConfig === 'string') {
              try {
                customEmailConfig.extra_config = JSON.parse(account.customExtraConfig);
              } catch (e) {
                console.warn(`账户 ${account.email} 的自定义邮箱额外配置JSON解析失败: ${account.customExtraConfig}`);
              }
            } else if (account.customExtraConfig && typeof account.customExtraConfig === 'object') {
              customEmailConfig.extra_config = account.customExtraConfig;
            }
            accountPayload.customEmailConfig = customEmailConfig;
          }

          const response = await api.post(`${API_BASE_URL}/api/infini-accounts`, accountPayload);

          if (response.data.success) { // 后端现在应该在 data 中返回创建的账户信息，包括其ID
            results.success++;
            newAccountsList[accountIndex].status = 'success';
            // 如果后端返回了包含自定义邮箱配置的结果，可以在这里更新 newAccountsList[accountIndex]
          } else {
            const messageContent = response.data.message || '未知错误';
            if (messageContent.includes('该邮箱已经添加过')) {
              results.warnings++;
              newAccountsList[accountIndex].status = 'warning';
              newAccountsList[accountIndex].errorMsg = messageContent;
            } else {
              results.failed++;
              newAccountsList[accountIndex].status = 'fail';
              newAccountsList[accountIndex].errorMsg = messageContent;
              results.messages.push(`账户 ${account.email} 添加失败: ${messageContent}`);
            }
          }
        } catch (err: any) {
          const errorMsg = err.response?.data?.message || err.message || '网络错误或未知错误';
          if (errorMsg.includes('该邮箱已经添加过')) {
            results.warnings++;
            newAccountsList[accountIndex].status = 'warning';
            newAccountsList[accountIndex].errorMsg = errorMsg;
          } else {
            results.failed++;
            newAccountsList[accountIndex].status = 'fail';
            newAccountsList[accountIndex].errorMsg = errorMsg;
            results.messages.push(`账户 ${account.email} 添加失败: ${errorMsg}`);
          }
        }
      }

      // 更新账户列表，包含成功/警告/失败状态
      setAccounts(newAccountsList);

      // 更新统计信息（成功和警告都算作添加成功）
      setSuccessCount(prev => prev + results.success);
      setLastFailedCount(results.failed);

      if (results.failed === 0) {
        // 全部成功或警告
        if (results.warnings > 0) {
          message.success(`共处理 ${accountsToProcess.length} 个账户：成功添加 ${results.success} 个，${results.warnings} 个已存在`);
        } else {
          message.success(`成功批量添加 ${results.success} 个账户`);
        }

        // 如果全部成功或警告，延迟关闭模态框
        setTimeout(() => {
          resetState();
          onSuccess();
          onClose();
        }, 1500);
      } else {
        // 部分失败，显示详细信息
        Modal.error({
          title: `批量添加结果：成功 ${results.success} 个，已存在 ${results.warnings} 个，失败 ${results.failed} 个`,
          content: (
            <div>
              <p>失败详情：</p>
              <ul>
                {results.messages.map((msg, idx) => (
                  <li key={idx}>{msg}</li>
                ))}
              </ul>
            </div>
          ),
        });

        // 如果有成功的，刷新列表
        if (results.success > 0) {
          onSuccess();
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '批量添加账户失败');
      console.error('批量添加账户失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 表单列定义
  const columns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      editable: true,
      width: '30%',
      render: (text: string) => (
        <div>
          <MailOutlined style={{ marginRight: 8 }} />
          {text}
        </div>
      )
    },
    {
      title: '密码',
      dataIndex: 'password',
      editable: true,
      width: '30%',
      render: (text: string) => (
        <div>
          <LockOutlined style={{ marginRight: 8 }} />
          {text}
        </div>
      )
    },
    {
      title: '使用自定义邮箱',
      dataIndex: 'useCustomEmail',
      key: 'useCustomEmail',
      width: '15%',
      editable: true,
      render: (useCustom: boolean, record: BatchAddAccountItem) => (
        <Checkbox
          checked={useCustom}
          onChange={(e) => {
            // 更新 dataSource 中的数据，以便在保存时能够获取到最新值
            const newData = [...accounts];
            const index = newData.findIndex(item => record.key === item.key);
            if (index > -1) {
              const item = newData[index];
              newData.splice(index, 1, {
                ...item,
                useCustomEmail: e.target.checked,
              });
              setAccounts(newData);
              // 如果取消勾选，可能需要清空相关的自定义邮箱字段
              if (!e.target.checked) {
                const updatedItem = {
                  ...newData[index],
                  customEmailAddress: '',
                  customEmailPassword: '',
                  customImapHost: '',
                  customImapPort: 993,
                  customImapSecure: true,
                  customSmtpHost: '',
                  customSmtpPort: 465,
                  customSmtpSecure: true,
                  customEmailStatus: 'active' as 'active' | 'disabled',
                  customExtraConfig: ''
                };
                newData.splice(index, 1, updatedItem);
                setAccounts(newData);
                if (isEditing(record)) { // 如果在编辑模式下取消勾选，也更新form
                  form.setFieldsValue({
                    customEmailAddress: '',
                    customEmailPassword: '',
                    customImapHost: '',
                    customImapPort: 993,
                    customImapSecure: true,
                    customSmtpHost: '',
                    customSmtpPort: 465,
                    customSmtpSecure: true,
                    customEmailStatus: 'active',
                    customExtraConfig: ''
                  });
                }
              }
            }
          }}
        />
      ),
    },
    {
      title: '自定义邮箱',
      dataIndex: 'customEmailAddress',
      key: 'customEmailAddress',
      editable: true,
      width: '25%',
      render: (text: string, record: BatchAddAccountItem) => (
        record.useCustomEmail ? text : <Text type="secondary">-</Text>
      )
    },
    {
      title: '自定义邮箱密码',
      dataIndex: 'customEmailPassword',
      key: 'customEmailPassword',
      editable: true,
      width: '25%',
      render: (text: string, record: BatchAddAccountItem) => (
        record.useCustomEmail ? (text ? '********' : <Text type="secondary">未设置</Text>) : <Text type="secondary">-</Text>
      )
    },
    {
      title: 'IMAP主机',
      dataIndex: 'customImapHost',
      key: 'customImapHost',
      editable: true,
      width: '25%',
      render: (text: string, record: BatchAddAccountItem) => (
        record.useCustomEmail ? (text || <Text type="secondary">未设置</Text>) : <Text type="secondary">-</Text>
      )
    },
    {
      title: 'IMAP端口',
      dataIndex: 'customImapPort',
      key: 'customImapPort',
      editable: true,
      width: '15%',
      render: (text: number, record: BatchAddAccountItem) => (
        record.useCustomEmail ? (text || 993) : <Text type="secondary">-</Text>
      )
    },
    {
      title: 'SMTP主机',
      dataIndex: 'customSmtpHost',
      key: 'customSmtpHost',
      editable: true,
      width: '25%',
      render: (text: string, record: BatchAddAccountItem) => (
        record.useCustomEmail ? (text || <Text type="secondary">未设置</Text>) : <Text type="secondary">-</Text>
      )
    },
    {
      title: 'SMTP端口',
      dataIndex: 'customSmtpPort',
      key: 'customSmtpPort',
      editable: true,
      width: '15%',
      render: (text: number, record: BatchAddAccountItem) => (
        record.useCustomEmail ? (text || 465) : <Text type="secondary">-</Text>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: '20%',
      render: (status: 'success' | 'fail' | 'warning' | undefined, record: any) => {
        if (!status) return null;

        if (status === 'success') {
          return (
            <Tag color="green">添加成功</Tag>
          );
        } else if (status === 'warning') {
          // 警告状态（邮箱已存在）
          return (
            <Tag color="orange">
              邮箱已存在
              {record.errorMsg && (
                <Tooltip title={record.errorMsg}>
                  <InfoCircleOutlined style={{ marginLeft: 4 }} />
                </Tooltip>
              )}
            </Tag>
          );
        } else {
          // 失败状态
          return (
            <Tag color="red">
              添加失败
              {record.errorMsg && (
                <Tooltip title={record.errorMsg}>
                  <InfoCircleOutlined style={{ marginLeft: 4 }} />
                </Tooltip>
              )}
            </Tag>
          );
        }
      }
    },
    {
      title: '操作',
      dataIndex: 'operation',
      render: (_: any, record: any) => {
        const editable = isEditing(record);
        return editable ? (
          <span>
            <Typography.Link
              onClick={() => save(record.key)}
              style={{ marginRight: 8 }}
            >
              保存
            </Typography.Link>
            <Popconfirm
              title="确定取消编辑?"
              onConfirm={cancel}
              okText="确定"
              cancelText="取消"
            >
              <a>取消</a>
            </Popconfirm>
          </span>
        ) : (
          <span>
            <Typography.Link
              disabled={editingKey !== ''}
              onClick={() => edit(record)}
              style={{ marginRight: 8 }}
            >
              编辑
            </Typography.Link>
            <Popconfirm
              title="确定删除此行?"
              onConfirm={() => deleteRow(record.key)}
              okText="确定"
              cancelText="取消"
            >
              <a>删除</a>
            </Popconfirm>
          </span>
        );
      },
    },
  ];

  // 表单行是否处于编辑状态
  const isEditing = (record: { key: string }) => record.key === editingKey;

  // 开始编辑行
  const edit = (record: BatchAddAccountItem) => {
    form.setFieldsValue({ ...record }); // 直接使用 record 的值填充表单
    setEditingKey(record.key);
  };

  // 取消编辑
  const cancel = () => {
    setEditingKey('');
  };

  // 保存编辑
  const save = async (key: string) => {
    try {
      const row = await form.validateFields();
      const newData = [...accounts];
      const index = newData.findIndex(item => key === item.key);

      if (index > -1) {
        const item = newData[index];
        newData.splice(index, 1, {
          ...item,
          ...row,
        });
        setAccounts(newData);
        setEditingKey('');
      } else {
        newData.push(row);
        setAccounts(newData);
        setEditingKey('');
      }
    } catch (errInfo) {
      console.log('验证表单失败:', errInfo);
    }
  };

  // 删除行
  const deleteRow = (key: string) => {
    const newData = accounts.filter(item => item.key !== key);
    setAccounts(newData);
  };

  // 添加新行
  const addRow = () => {
    const newKey = `new_${Date.now()}`;
    const newAccount = {
      key: newKey,
      email: '',
      password: ''
    };
    setAccounts([...accounts, newAccount]);
    edit(newAccount);
  };

  // 处理可编辑列
  const mergedColumns = columns.map(col => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: (record: any) => ({
        record,
        inputType: col.dataIndex === 'email' ? 'email' : 'text',
        dataIndex: col.dataIndex,
        title: col.title,
        editing: isEditing(record),
      }),
    };
  });

  // 编辑单元格组件
  const EditableCell = ({
    editing,
    dataIndex,
    title,
    inputType,
    record,
    index,
    children,
    ...restProps
  }: any) => {
    const inputNode = inputType === 'email' ? (
      <Input prefix={<MailOutlined />} placeholder="请输入邮箱" />
    ) : (
      <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
    );

    return (
      <td {...restProps}>
        {editing ? (
          <Form.Item
            name={dataIndex}
            style={{ margin: 0 }}
            rules={[
              {
                required: true,
                message: `请输入${title}!`,
              },
            ]}
          >
            {inputNode}
          </Form.Item>
        ) : (
          children
        )}
      </td>
    );
  };

  return (
    <Modal
      title="批量添加Infini账户"
      open={visible}
      onCancel={handleClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={handleClose}>
          取消
        </Button>,
        <Tooltip
          title={successCount > 0 || lastFailedCount > 0 ?
            `累计成功添加: ${successCount} 个账户, 上次失败: ${lastFailedCount} 个账户` :
            ''}
        >
          <Button
            key="submit"
            type="primary"
            loading={loading}
            onClick={handleSubmit}
            disabled={accounts.length === 0}
          >
            {isSubmitting ?
              `继续添加 (${accounts.filter(acc => acc.status !== 'success' && acc.status !== 'warning').length} 个账户)` :
              `批量添加 (${accounts.length} 个账户)`}
          </Button>
        </Tooltip>,
      ]}
    >
      <div>
        <div style={{ marginBottom: 16 }}>
          <Text>请输入账户信息，每行一个账户，格式为"邮箱 密码"（以空格分隔）</Text>
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              扩展格式：邮箱 密码 自定义邮箱 自定义邮箱密码 [IMAP主机 IMAP端口 SMTP主机 SMTP端口]
            </Text>
          </div>
          <div style={{ position: 'relative' }}>
            <Input.TextArea
              rows={5}
              value={batchText}
              onChange={handleTextChange}
              placeholder="example@email.com password123
another@email.com anotherpass
..."
            />
            <Button
              icon={<SyncOutlined />}
              onClick={parseTextToForm}
              disabled={!batchText.trim()}
              style={{ position: 'absolute', bottom: 8, right: 8 }}
            >
              从文本解析
            </Button>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text>表单模式：可以直接编辑账户信息</Text>
          <Space>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={addRow}
            >
              添加行
            </Button>
          </Space>
        </div>

        <Form form={form} component={false}>
          <Table
            components={{
              body: {
                cell: EditableCell,
              },
            }}
            bordered
            dataSource={accounts}
            columns={mergedColumns}
            rowClassName="editable-row"
            pagination={{
              pageSize: 10,
              onChange: cancel,
            }}
            rowKey="key"
            size="small"
          />
        </Form>
      </div>

      <div style={{ marginTop: 16 }}>
        <Text type="secondary">
          <InfoCircleOutlined style={{ marginRight: 8 }} />
          系统将批量添加这些账户，并自动同步账户信息，相同邮箱的账户将覆盖密码
        </Text>
      </div>
    </Modal>
  );
};

export default BatchAddAccountModal;