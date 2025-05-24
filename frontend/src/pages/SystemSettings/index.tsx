/**
 * 系统高级设置页面
 * 提供系统级配置管理，包括随机用户生成的国家配置等
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Radio,
  Button,
  Space,
  message,
  Typography,
  Divider,
  Alert,
  Spin,
  Row,
  Col,
  Tag,
} from 'antd';
import {
  SettingOutlined,
  GlobalOutlined,
  UserOutlined,
  PhoneOutlined,
  SaveOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import { configApi } from '../../services/api';

const { Title, Text, Paragraph } = Typography;

// 样式组件
const StyledCard = styled(Card)`
  margin-bottom: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  
  .ant-card-head {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px 12px 0 0;
    
    .ant-card-head-title {
      color: white;
      font-weight: 600;
    }
  }
`;

const FormContainer = styled.div`
  padding: 24px;
`;

const CountryOption = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  margin-bottom: 12px;
  background: #fafafa;
  
  &:hover {
    background: #f5f5f5;
    border-color: #1890ff;
  }
`;

const CountryFlag = styled.span`
  font-size: 24px;
`;

const CountryInfo = styled.div`
  flex: 1;
`;

const CountryName = styled.div`
  font-weight: 600;
  color: #262626;
`;

const CountryDescription = styled.div`
  color: #8c8c8c;
  font-size: 12px;
  margin-top: 4px;
`;

// 国家配置选项
const COUNTRY_OPTIONS = [
  {
    value: 'china',
    label: '中国',
    flag: '🇨🇳',
    description: '使用中国身份信息，手机号格式：+86 1xx xxxx xxxx',
    phoneFormat: '+86 1xx xxxx xxxx',
  },
  {
    value: 'japan',
    label: '日本',
    flag: '🇯🇵',
    description: '使用日本身份信息，手机号格式：+81 xx xxxx xxxx',
    phoneFormat: '+81 xx xxxx xxxx',
  },
  {
    value: 'korea',
    label: '韩国',
    flag: '🇰🇷',
    description: '使用韩国身份信息，手机号格式：+82 xx xxxx xxxx',
    phoneFormat: '+82 xx xxxx xxxx',
  },
  {
    value: 'usa',
    label: '美国',
    flag: '🇺🇸',
    description: '使用美国身份信息，手机号格式：+1 xxx xxx xxxx',
    phoneFormat: '+1 xxx xxx xxxx',
  },
  {
    value: 'random',
    label: '随机选择',
    flag: '🌍',
    description: '每次生成时随机选择一个国家的身份信息',
    phoneFormat: '根据选择的国家而变化',
  },
];

// 配置键名
const CONFIG_KEYS = {
  RANDOM_USER_COUNTRY: 'random_user_generation_country',
};

const SystemSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<any>({});

  // 获取当前配置
  const fetchCurrentConfig = async () => {
    try {
      setLoading(true);
      
      // 获取随机用户生成国家配置
      const countryResponse = await configApi.getConfigByKey(CONFIG_KEYS.RANDOM_USER_COUNTRY);
      
      let countryConfig = 'china'; // 默认使用中国
      if (countryResponse.success && countryResponse.data) {
        try {
          countryConfig = JSON.parse(countryResponse.data.value);
        } catch (e) {
          countryConfig = countryResponse.data.value;
        }
      }
      
      const config = {
        country: countryConfig,
      };
      
      setCurrentConfig(config);
      form.setFieldsValue(config);
      
    } catch (error) {
      console.error('获取系统配置失败:', error);
      // 如果获取失败，使用默认配置
      const defaultConfig = {
        country: 'china',
      };
      setCurrentConfig(defaultConfig);
      form.setFieldsValue(defaultConfig);
    } finally {
      setLoading(false);
    }
  };

  // 保存配置
  const handleSave = async (values: any) => {
    try {
      setSaving(true);
      
      // 保存随机用户生成国家配置
      await configApi.upsertConfig(
        CONFIG_KEYS.RANDOM_USER_COUNTRY,
        values.country,
        '随机用户生成时使用的国家配置'
      );
      
      setCurrentConfig(values);
      message.success('系统配置保存成功');
      
    } catch (error) {
      console.error('保存系统配置失败:', error);
      message.error('保存系统配置失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 重置配置
  const handleReset = () => {
    form.setFieldsValue(currentConfig);
    message.info('已重置为当前保存的配置');
  };

  // 组件加载时获取配置
  useEffect(() => {
    fetchCurrentConfig();
  }, []);

  return (
    <div>
      <Title level={2}>
        <SettingOutlined /> 系统高级设置
      </Title>
      
      <Paragraph type="secondary">
        配置系统的高级功能和行为，这些设置将影响整个系统的运行方式。
      </Paragraph>

      <StyledCard
        title={
          <Space>
            <GlobalOutlined />
            随机用户生成配置
          </Space>
        }
      >
        <Spin spinning={loading}>
          <FormContainer>
            <Alert
              message="重要提示"
              description="手机号格式说明：无论选择哪个国家，系统都会使用中国格式的手机号（+86 1xx xxxx xxxx），以确保与现有业务逻辑的兼容性。国家配置主要影响姓名、护照号等其他身份信息的生成规则。"
              type="warning"
              showIcon
              style={{ marginBottom: 24 }}
            />
            
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSave}
              initialValues={{ country: 'china' }}
            >
              <Form.Item
                name="country"
                label={
                  <Space>
                    <UserOutlined />
                    生成用户时使用的国家信息
                  </Space>
                }
                rules={[{ required: true, message: '请选择国家配置' }]}
              >
                <Radio.Group style={{ width: '100%' }}>
                  <Row gutter={[16, 16]}>
                    {COUNTRY_OPTIONS.map((country) => (
                      <Col span={24} key={country.value}>
                        <Radio value={country.value} style={{ width: '100%' }}>
                          <CountryOption>
                            <CountryFlag>{country.flag}</CountryFlag>
                            <CountryInfo>
                              <CountryName>{country.label}</CountryName>
                              <CountryDescription>
                                {country.description}
                              </CountryDescription>
                              <div style={{ marginTop: 8 }}>
                                <Tag icon={<PhoneOutlined />} color="blue">
                                  {country.value === 'china' || country.value === 'random' 
                                    ? '+86 1xx xxxx xxxx (统一使用中国手机号)'
                                    : `${country.phoneFormat} (实际使用+86格式)`
                                  }
                                </Tag>
                              </div>
                            </CountryInfo>
                          </CountryOption>
                        </Radio>
                      </Col>
                    ))}
                  </Row>
                </Radio.Group>
              </Form.Item>

              <Divider />

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={saving}
                  >
                    保存配置
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={handleReset}
                    disabled={saving}
                  >
                    重置
                  </Button>
                  <Button
                    onClick={fetchCurrentConfig}
                    disabled={saving}
                  >
                    刷新
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </FormContainer>
        </Spin>
      </StyledCard>

      <Alert
        message="配置说明"
        description={
          <div>
            <Paragraph>
              <strong>默认配置：</strong>中国 - 系统会生成中国身份信息，包括中文姓名的拼音形式和中国护照号格式。
            </Paragraph>
            <Paragraph>
              <strong>随机选择：</strong>每次生成用户时会随机选择一个国家的身份信息模板。
            </Paragraph>
            <Paragraph>
              <strong>手机号统一：</strong>为了保持与现有业务逻辑的兼容性，所有国家配置都使用中国格式的手机号。
            </Paragraph>
          </div>
        }
        type="info"
        showIcon
      />
    </div>
  );
};

export default SystemSettings; 