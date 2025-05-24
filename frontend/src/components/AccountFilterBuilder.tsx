/**
 * 账户筛选配置组件
 * 支持列表筛选和JS脚本筛选两种模式
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Radio,
  Select,
  Table,
  Button,
  Space,
  Typography,
  Input,
  Tag,
  Alert,
  Tooltip,
  Modal,
  message,
  Spin
} from 'antd';
import { 
  InfoCircleOutlined, 
  ReloadOutlined,
  CheckOutlined,
  CodeOutlined,
  FilterOutlined
} from '@ant-design/icons';
import styled from 'styled-components';
import { infiniAccountApi } from '../services/api';

const { Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// 样式组件
const StyledCard = styled(Card)`
  .ant-card-body {
    padding: 16px;
  }
`;

const CodeEditor = styled(TextArea)`
  font-family: 'Courier New', monospace;
  background-color: #f6f8fa;
  border: 1px solid #d0d7de;
  
  &:focus {
    background-color: #ffffff;
    border-color: #0969da;
  }
`;

const PreviewContainer = styled.div`
  background-color: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 12px;
  margin-top: 12px;
  max-height: 200px;
  overflow-y: auto;
`;

// 类型定义
interface InfiniAccount {
  id: string;
  email: string;
  uid?: string;
  status: string;
  availableBalance: string;
  userType: string;
}

interface AccountGroup {
  id: string;
  name: string;
  description?: string;
  accountCount: number;
}

interface AccountFilterBuilderProps {
  value?: {
    type: 'list' | 'script';
    selectedAccountIds?: string[];
    selectedGroupIds?: string[];
    scriptCode?: string;
  };
  onChange?: (value: any) => void;
  disabled?: boolean;
}

const AccountFilterBuilder: React.FC<AccountFilterBuilderProps> = ({
  value = { type: 'list' },
  onChange,
  disabled = false
}) => {
  // 状态管理
  const [filterType, setFilterType] = useState<'list' | 'script'>(value.type || 'list');
  const [accounts, setAccounts] = useState<InfiniAccount[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>(value.selectedAccountIds || []);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(value.selectedGroupIds || []);
  const [scriptCode, setScriptCode] = useState<string>(value.scriptCode || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [testModalVisible, setTestModalVisible] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [testLoading, setTestLoading] = useState<boolean>(false);

  // 默认脚本模板
  const defaultScript = `// 账户筛选脚本
// 参数: account - 账户对象，包含以下字段:
// - id: 账户ID
// - email: 邮箱地址
// - uid: 用户ID
// - status: 账户状态
// - availableBalance: 可用余额
// - userType: 用户类型
// 返回: boolean - true表示符合条件，false表示不符合

function filterAccount(account) {
  // 示例1: 筛选可用余额大于100的账户
  // return parseFloat(account.availableBalance || '0') > 100;
  
  // 示例2: 筛选特定状态的账户
  // return account.status === 'active';
  
  // 示例3: 筛选邮箱包含特定域名的账户
  // return account.email.includes('@example.com');
  
  // 示例4: 组合条件筛选
  // return account.status === 'active' && parseFloat(account.availableBalance || '0') > 50;
  
  // 默认返回true，表示所有账户都符合条件
  return true;
}`;

  // 加载账户列表
  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await infiniAccountApi.getAllInfiniAccounts();
      if (response.success) {
        const accountsData = Array.isArray(response.data) ? response.data : [];
        setAccounts(accountsData);
      } else {
        message.error(response.message || '获取账户列表失败');
        setAccounts([]);
      }
    } catch (error) {
      console.error('加载账户列表失败:', error);
      message.error('加载账户列表失败');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  // 加载分组列表
  const loadGroups = async () => {
    try {
      const response = await infiniAccountApi.getAllAccountGroups();
      if (response.success) {
        const groupsData = Array.isArray(response.data) ? response.data : [];
        setGroups(groupsData);
      } else {
        message.error(response.message || '获取分组列表失败');
        setGroups([]);
      }
    } catch (error) {
      console.error('加载分组列表失败:', error);
      message.error('加载分组列表失败');
      setGroups([]);
    }
  };

  // 初始化数据
  useEffect(() => {
    loadAccounts();
    loadGroups();
  }, []);

  // 处理筛选类型变化
  const handleFilterTypeChange = (type: 'list' | 'script') => {
    setFilterType(type);
    if (onChange) {
      onChange({
        type,
        selectedAccountIds: selectedRowKeys,
        selectedGroupIds: selectedGroupIds,
        scriptCode: scriptCode
      });
    }
  };

  // 处理账户选择变化
  const handleAccountSelectionChange = (selectedRowKeys: React.Key[], selectedRows: InfiniAccount[]) => {
    const stringKeys = selectedRowKeys.map(key => String(key));
    setSelectedRowKeys(stringKeys);
    if (onChange) {
      onChange({
        type: filterType,
        selectedAccountIds: stringKeys,
        selectedGroupIds: selectedGroupIds,
        scriptCode: scriptCode
      });
    }
  };

  // 处理分组选择变化
  const handleGroupSelectionChange = (groupIds: string[]) => {
    setSelectedGroupIds(groupIds);
    if (onChange) {
      onChange({
        type: filterType,
        selectedAccountIds: selectedRowKeys,
        selectedGroupIds: groupIds,
        scriptCode: scriptCode
      });
    }
  };

  // 处理脚本代码变化
  const handleScriptChange = (code: string) => {
    setScriptCode(code);
    if (onChange) {
      onChange({
        type: filterType,
        selectedAccountIds: selectedRowKeys,
        selectedGroupIds: selectedGroupIds,
        scriptCode: code
      });
    }
  };

  // 测试脚本
  const testScript = async () => {
    if (!scriptCode.trim()) {
      message.warning('请输入脚本代码');
      return;
    }

    try {
      setTestLoading(true);
      setTestModalVisible(true);
      
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const account of accounts.slice(0, 10)) {
        try {
          const func = new Function('account', `
            ${scriptCode}
            return filterAccount(account);
          `);
          
          const result = func(account);
          results.push({
            account,
            result: Boolean(result),
            error: null
          });
          
          if (result) successCount++;
        } catch (error: any) {
          results.push({
            account,
            result: false,
            error: error.message
          });
          errorCount++;
        }
      }

      setTestResults(results);
      message.success(`脚本测试完成: ${successCount}个符合条件, ${errorCount}个执行错误`);
    } catch (error: any) {
      message.error(`脚本测试失败: ${error.message}`);
    } finally {
      setTestLoading(false);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '账户ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      ellipsis: true,
    },
    {
      title: 'UID',
      dataIndex: 'uid',
      key: 'uid',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status}
        </Tag>
      ),
    },
    {
      title: '可用余额',
      dataIndex: 'availableBalance',
      key: 'availableBalance',
      width: 100,
      render: (balance: string) => `$${parseFloat(balance || '0').toFixed(2)}`,
    },
  ];

  return (
    <StyledCard title="账户筛选配置" size="small">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ marginBottom: '8px', fontWeight: 500 }}>筛选模式</div>
          <Radio.Group 
            value={filterType} 
            onChange={(e) => handleFilterTypeChange(e.target.value)}
            disabled={disabled}
          >
            <Radio value="list">
              <Space>
                <FilterOutlined />
                列表筛选
              </Space>
            </Radio>
            <Radio value="script">
              <Space>
                <CodeOutlined />
                脚本筛选
              </Space>
            </Radio>
          </Radio.Group>
        </div>

        {filterType === 'list' && (
          <>
            <div>
              <div style={{ marginBottom: '8px', fontWeight: 500 }}>按分组筛选</div>
              <Select
                mode="multiple"
                placeholder="选择账户分组（可选）"
                value={selectedGroupIds}
                onChange={handleGroupSelectionChange}
                disabled={disabled}
                style={{ width: '100%' }}
              >
                {groups.map(group => (
                  <Option key={group.id} value={group.id}>
                    {group.name} ({group.accountCount}个账户)
                  </Option>
                ))}
              </Select>
            </div>

            <div>
              <div style={{ marginBottom: '8px', fontWeight: 500 }}>
                <Space>
                  账户列表
                  <Tooltip title="选择要同步的账户">
                    <InfoCircleOutlined />
                  </Tooltip>
                  <Button 
                    type="link" 
                    size="small" 
                    icon={<ReloadOutlined />}
                    onClick={loadAccounts}
                    disabled={disabled}
                  >
                    刷新
                  </Button>
                </Space>
              </div>
              <Table
                size="small"
                dataSource={Array.isArray(accounts) ? accounts : []}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => 
                    `第 ${range[0]}-${range[1]} 条/共 ${total} 条`
                }}
                scroll={{ y: 300 }}
                rowSelection={{
                  type: 'checkbox',
                  selectedRowKeys,
                  onChange: handleAccountSelectionChange,
                  getCheckboxProps: () => ({
                    disabled: disabled
                  })
                }}
              />
            </div>

            {selectedRowKeys.length > 0 && (
              <PreviewContainer>
                <Text strong>已选择 {selectedRowKeys.length} 个账户:</Text>
                <div style={{ marginTop: 8 }}>
                  {selectedRowKeys.slice(0, 10).map(id => {
                    const account = accounts.find(a => a.id === id);
                    return account ? (
                      <Tag key={id} style={{ margin: 2 }}>
                        {account.email}
                      </Tag>
                    ) : null;
                  })}
                  {selectedRowKeys.length > 10 && (
                    <Tag style={{ margin: 2 }}>
                      ...还有 {selectedRowKeys.length - 10} 个
                    </Tag>
                  )}
                </div>
              </PreviewContainer>
            )}
          </>
        )}

        {filterType === 'script' && (
          <>
            <div>
              <div style={{ marginBottom: '8px', fontWeight: 500 }}>
                <Space>
                  筛选脚本
                  <Tooltip title="编写JavaScript函数来筛选账户">
                    <InfoCircleOutlined />
                  </Tooltip>
                </Space>
              </div>
              <CodeEditor
                value={scriptCode || defaultScript}
                onChange={(e) => handleScriptChange(e.target.value)}
                placeholder="请输入JavaScript筛选脚本..."
                rows={15}
                disabled={disabled}
              />
            </div>

            <div>
              <Space>
                <Button 
                  type="primary" 
                  icon={<CheckOutlined />}
                  onClick={testScript}
                  disabled={disabled || !scriptCode.trim()}
                  loading={testLoading}
                >
                  测试脚本
                </Button>
                <Button 
                  onClick={() => handleScriptChange(defaultScript)}
                  disabled={disabled}
                >
                  重置为默认模板
                </Button>
              </Space>
            </div>

            <Alert
              message="脚本说明"
              description={
                <div>
                  <p>• 脚本必须包含 <code>filterAccount(account)</code> 函数</p>
                  <p>• 函数参数 <code>account</code> 包含账户的所有信息</p>
                  <p>• 函数必须返回 <code>true</code> 或 <code>false</code></p>
                  <p>• 返回 <code>true</code> 表示账户符合筛选条件</p>
                </div>
              }
              type="info"
              showIcon
              style={{ marginTop: 12 }}
            />
          </>
        )}
      </div>

      {/* 脚本测试结果模态框 */}
      <Modal
        title="脚本测试结果"
        open={testModalVisible}
        onCancel={() => setTestModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setTestModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        <Spin spinning={testLoading}>
          {testResults.length > 0 && (
            <Table
              size="small"
              dataSource={Array.isArray(testResults) ? testResults : []}
              rowKey={(record) => record.account.id}
              pagination={false}
              scroll={{ y: 400 }}
              columns={[
                {
                  title: '账户邮箱',
                  dataIndex: ['account', 'email'],
                  key: 'email',
                },
                {
                  title: '测试结果',
                  dataIndex: 'result',
                  key: 'result',
                  width: 100,
                  render: (result: boolean, record: any) => (
                    record.error ? (
                      <Tag color="red">错误</Tag>
                    ) : (
                      <Tag color={result ? 'green' : 'default'}>
                        {result ? '符合' : '不符合'}
                      </Tag>
                    )
                  ),
                },
                {
                  title: '错误信息',
                  dataIndex: 'error',
                  key: 'error',
                  render: (error: string) => error ? (
                    <Text type="danger" style={{ fontSize: '12px' }}>
                      {error}
                    </Text>
                  ) : '-',
                },
              ]}
            />
          )}
        </Spin>
      </Modal>
    </StyledCard>
  );
};

export default AccountFilterBuilder; 