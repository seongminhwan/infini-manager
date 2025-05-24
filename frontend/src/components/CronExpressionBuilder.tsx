/**
 * Cron表达式可视化配置组件
 * 提供友好的界面让用户配置定时任务，无需了解cron语法
 */
import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Radio,
  Select,
  InputNumber,
  Checkbox,
  Space,
  Typography,
  Row,
  Col,
  Tag,
  Alert,
  Tooltip
} from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import styled from 'styled-components';

const { Title, Text } = Typography;
const { Option } = Select;
const { Group: CheckboxGroup } = Checkbox;

// 样式组件
const StyledCard = styled(Card)`
  .ant-card-body {
    padding: 16px;
  }
`;

const PreviewContainer = styled.div`
  background-color: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 12px;
  margin-top: 12px;
`;

const CronDisplay = styled.div`
  background-color: #001529;
  color: #52c41a;
  padding: 8px 12px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  margin-top: 8px;
`;

// 接口定义
interface CronExpressionBuilderProps {
  value?: string;
  onChange?: (cronExpression: string) => void;
  disabled?: boolean;
}

interface CronConfig {
  type: 'simple' | 'advanced';
  
  // 简单模式配置
  simpleType: 'minutes' | 'hours' | 'daily' | 'weekly' | 'monthly';
  interval: number;
  
  // 每日配置
  dailyHour: number;
  dailyMinute: number;
  
  // 每周配置
  weeklyDays: number[];
  weeklyHour: number;
  weeklyMinute: number;
  
  // 每月配置
  monthlyDay: number;
  monthlyHour: number;
  monthlyMinute: number;
  
  // 高级模式 - 详细配置
  second: string;
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

const CronExpressionBuilder: React.FC<CronExpressionBuilderProps> = ({
  value = '',
  onChange,
  disabled = false
}) => {
  const [config, setConfig] = useState<CronConfig>({
    type: 'simple',
    simpleType: 'daily',
    interval: 1,
    dailyHour: 9,
    dailyMinute: 0,
    weeklyDays: [1], // 周一
    weeklyHour: 9,
    weeklyMinute: 0,
    monthlyDay: 1,
    monthlyHour: 9,
    monthlyMinute: 0,
    second: '0',
    minute: '0',
    hour: '9',
    dayOfMonth: '*',
    month: '*',
    dayOfWeek: '*'
  });

  const [cronExpression, setCronExpression] = useState<string>('0 0 9 * * *');

  // 周几选项
  const weekDayOptions = [
    { label: '周一', value: 1 },
    { label: '周二', value: 2 },
    { label: '周三', value: 3 },
    { label: '周四', value: 4 },
    { label: '周五', value: 5 },
    { label: '周六', value: 6 },
    { label: '周日', value: 0 }
  ];

  // 生成cron表达式
  const generateCronExpression = (newConfig: CronConfig): string => {
    if (newConfig.type === 'simple') {
      switch (newConfig.simpleType) {
        case 'minutes':
          return `0 */${newConfig.interval} * * * *`;
        
        case 'hours':
          return `0 0 */${newConfig.interval} * * *`;
        
        case 'daily':
          return `0 ${newConfig.dailyMinute} ${newConfig.dailyHour} * * *`;
        
        case 'weekly':
          const days = newConfig.weeklyDays.join(',');
          return `0 ${newConfig.weeklyMinute} ${newConfig.weeklyHour} * * ${days}`;
        
        case 'monthly':
          return `0 ${newConfig.monthlyMinute} ${newConfig.monthlyHour} ${newConfig.monthlyDay} * *`;
        
        default:
          return '0 0 9 * * *';
      }
    } else {
      // 高级模式
      return `${newConfig.second} ${newConfig.minute} ${newConfig.hour} ${newConfig.dayOfMonth} ${newConfig.month} ${newConfig.dayOfWeek}`;
    }
  };

  // 解析现有的cron表达式
  const parseCronExpression = (cron: string): Partial<CronConfig> => {
    if (!cron) return {};

    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 6) return {};

    const [second, minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // 尝试识别简单模式
    if (second === '0' && minute.startsWith('*/') && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      // 每N分钟
      const interval = parseInt(minute.replace('*/', ''), 10);
      if (!isNaN(interval)) {
        return {
          type: 'simple',
          simpleType: 'minutes',
          interval
        };
      }
    } else if (second === '0' && minute === '0' && hour.startsWith('*/') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      // 每N小时
      const interval = parseInt(hour.replace('*/', ''), 10);
      if (!isNaN(interval)) {
        return {
          type: 'simple',
          simpleType: 'hours',
          interval
        };
      }
    } else if (second === '0' && !minute.includes('*') && !hour.includes('*') && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
      // 每日执行
      const dailyHour = parseInt(hour, 10);
      const dailyMinute = parseInt(minute, 10);
      if (!isNaN(dailyHour) && !isNaN(dailyMinute)) {
        return {
          type: 'simple',
          simpleType: 'daily',
          dailyHour,
          dailyMinute
        };
      }
    } else if (second === '0' && !minute.includes('*') && !hour.includes('*') && dayOfMonth === '*' && month === '*' && !dayOfWeek.includes('*')) {
      // 每周执行
      const weeklyHour = parseInt(hour, 10);
      const weeklyMinute = parseInt(minute, 10);
      const weeklyDays = dayOfWeek.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
      if (!isNaN(weeklyHour) && !isNaN(weeklyMinute) && weeklyDays.length > 0) {
        return {
          type: 'simple',
          simpleType: 'weekly',
          weeklyHour,
          weeklyMinute,
          weeklyDays
        };
      }
    } else if (second === '0' && !minute.includes('*') && !hour.includes('*') && !dayOfMonth.includes('*') && month === '*' && dayOfWeek === '*') {
      // 每月执行
      const monthlyHour = parseInt(hour, 10);
      const monthlyMinute = parseInt(minute, 10);
      const monthlyDay = parseInt(dayOfMonth, 10);
      if (!isNaN(monthlyHour) && !isNaN(monthlyMinute) && !isNaN(monthlyDay)) {
        return {
          type: 'simple',
          simpleType: 'monthly',
          monthlyHour,
          monthlyMinute,
          monthlyDay
        };
      }
    }

    // 如果无法识别为简单模式，则使用高级模式
    return {
      type: 'advanced',
      second,
      minute,
      hour,
      dayOfMonth,
      month,
      dayOfWeek
    };
  };

  // 初始化时解析现有值
  useEffect(() => {
    if (value) {
      const parsed = parseCronExpression(value);
      setConfig(prev => ({ ...prev, ...parsed }));
      setCronExpression(value);
    }
  }, [value]);

  // 配置变化时更新cron表达式
  useEffect(() => {
    const newCron = generateCronExpression(config);
    setCronExpression(newCron);
    onChange?.(newCron);
  }, [config, onChange]);

  // 更新配置
  const updateConfig = (updates: Partial<CronConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  // 获取执行时间描述
  const getExecutionDescription = (): string => {
    if (config.type === 'simple') {
      switch (config.simpleType) {
        case 'minutes':
          return `每 ${config.interval} 分钟执行一次`;
        
        case 'hours':
          return `每 ${config.interval} 小时执行一次`;
        
        case 'daily':
          return `每天 ${String(config.dailyHour).padStart(2, '0')}:${String(config.dailyMinute).padStart(2, '0')} 执行`;
        
        case 'weekly':
          const dayNames = config.weeklyDays.map(day => {
            const dayOption = weekDayOptions.find(opt => opt.value === day);
            return dayOption ? dayOption.label : `周${day}`;
          }).join('、');
          return `每周 ${dayNames} ${String(config.weeklyHour).padStart(2, '0')}:${String(config.weeklyMinute).padStart(2, '0')} 执行`;
        
        case 'monthly':
          return `每月 ${config.monthlyDay} 日 ${String(config.monthlyHour).padStart(2, '0')}:${String(config.monthlyMinute).padStart(2, '0')} 执行`;
        
        default:
          return '配置有误';
      }
    } else {
      return '自定义cron表达式';
    }
  };

  return (
    <StyledCard>
      <Title level={5}>
        定时执行配置
        <Tooltip title="选择任务的执行频率和时间">
          <InfoCircleOutlined style={{ marginLeft: 8, color: '#1890ff' }} />
        </Tooltip>
      </Title>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <div style={{ marginBottom: '8px', fontWeight: 500 }}>配置模式</div>
          <Radio.Group
            value={config.type}
            onChange={(e) => updateConfig({ type: e.target.value })}
            disabled={disabled}
          >
            <Radio value="simple">简单模式</Radio>
            <Radio value="advanced">高级模式</Radio>
          </Radio.Group>
        </div>

        {config.type === 'simple' && (
          <>
            <div>
              <div style={{ marginBottom: '8px', fontWeight: 500 }}>执行频率</div>
              <Radio.Group
                value={config.simpleType}
                onChange={(e) => updateConfig({ simpleType: e.target.value })}
                disabled={disabled}
              >
                <Space direction="vertical">
                  <Radio value="minutes">每隔几分钟</Radio>
                  <Radio value="hours">每隔几小时</Radio>
                  <Radio value="daily">每天</Radio>
                  <Radio value="weekly">每周</Radio>
                  <Radio value="monthly">每月</Radio>
                </Space>
              </Radio.Group>
            </div>

            {(config.simpleType === 'minutes' || config.simpleType === 'hours') && (
              <div>
                <div style={{ marginBottom: '8px', fontWeight: 500 }}>
                  间隔{config.simpleType === 'minutes' ? '分钟' : '小时'}数
                </div>
                <InputNumber
                  min={1}
                  max={config.simpleType === 'minutes' ? 59 : 23}
                  value={config.interval}
                  onChange={(value) => updateConfig({ interval: value || 1 })}
                  disabled={disabled}
                />
              </div>
            )}

            {config.simpleType === 'daily' && (
              <Row gutter={16}>
                <Col span={12}>
                  <div>
                    <div style={{ marginBottom: '8px', fontWeight: 500 }}>小时</div>
                    <Select
                      style={{ width: '100%' }}
                      value={config.dailyHour}
                      onChange={(value) => updateConfig({ dailyHour: value })}
                      disabled={disabled}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <Option key={i} value={i}>
                          {String(i).padStart(2, '0')}
                        </Option>
                      ))}
                    </Select>
                  </div>
                </Col>
                <Col span={12}>
                  <div>
                    <div style={{ marginBottom: '8px', fontWeight: 500 }}>分钟</div>
                    <Select
                      style={{ width: '100%' }}
                      value={config.dailyMinute}
                      onChange={(value) => updateConfig({ dailyMinute: value })}
                      disabled={disabled}
                    >
                      {Array.from({ length: 60 }, (_, i) => (
                        <Option key={i} value={i}>
                          {String(i).padStart(2, '0')}
                        </Option>
                      ))}
                    </Select>
                  </div>
                </Col>
              </Row>
            )}

            {config.simpleType === 'weekly' && (
              <>
                <div>
                  <div style={{ marginBottom: '8px', fontWeight: 500 }}>星期</div>
                  <CheckboxGroup
                    options={weekDayOptions}
                    value={config.weeklyDays}
                    onChange={(values) => updateConfig({ weeklyDays: values as number[] })}
                    disabled={disabled}
                  />
                </div>
                <Row gutter={16}>
                  <Col span={12}>
                    <div>
                      <div style={{ marginBottom: '8px', fontWeight: 500 }}>小时</div>
                      <Select
                        style={{ width: '100%' }}
                        value={config.weeklyHour}
                        onChange={(value) => updateConfig({ weeklyHour: value })}
                        disabled={disabled}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <Option key={i} value={i}>
                            {String(i).padStart(2, '0')}
                          </Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div>
                      <div style={{ marginBottom: '8px', fontWeight: 500 }}>分钟</div>
                      <Select
                        style={{ width: '100%' }}
                        value={config.weeklyMinute}
                        onChange={(value) => updateConfig({ weeklyMinute: value })}
                        disabled={disabled}
                      >
                        {Array.from({ length: 60 }, (_, i) => (
                          <Option key={i} value={i}>
                            {String(i).padStart(2, '0')}
                          </Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                </Row>
              </>
            )}

            {config.simpleType === 'monthly' && (
              <>
                <div>
                  <div style={{ marginBottom: '8px', fontWeight: 500 }}>日期</div>
                  <Select
                    style={{ width: '100%' }}
                    value={config.monthlyDay}
                    onChange={(value) => updateConfig({ monthlyDay: value })}
                    disabled={disabled}
                  >
                    {Array.from({ length: 31 }, (_, i) => (
                      <Option key={i + 1} value={i + 1}>
                        {i + 1} 日
                      </Option>
                    ))}
                  </Select>
                </div>
                <Row gutter={16}>
                  <Col span={12}>
                    <div>
                      <div style={{ marginBottom: '8px', fontWeight: 500 }}>小时</div>
                      <Select
                        style={{ width: '100%' }}
                        value={config.monthlyHour}
                        onChange={(value) => updateConfig({ monthlyHour: value })}
                        disabled={disabled}
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <Option key={i} value={i}>
                            {String(i).padStart(2, '0')}
                          </Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div>
                      <div style={{ marginBottom: '8px', fontWeight: 500 }}>分钟</div>
                      <Select
                        style={{ width: '100%' }}
                        value={config.monthlyMinute}
                        onChange={(value) => updateConfig({ monthlyMinute: value })}
                        disabled={disabled}
                      >
                        {Array.from({ length: 60 }, (_, i) => (
                          <Option key={i} value={i}>
                            {String(i).padStart(2, '0')}
                          </Option>
                        ))}
                      </Select>
                    </div>
                  </Col>
                </Row>
              </>
            )}
          </>
        )}

        {config.type === 'advanced' && (
          <>
            <Alert
              message="高级模式"
              description="直接配置cron表达式的各个字段。格式：秒 分 时 日 月 周"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Row gutter={8}>
              <Col span={4}>
                <div>
                  <div style={{ marginBottom: '8px', fontWeight: 500 }}>秒</div>
                  <input
                    className="ant-input"
                    value={config.second}
                    onChange={(e) => updateConfig({ second: e.target.value })}
                    placeholder="0-59"
                    disabled={disabled}
                  />
                </div>
              </Col>
              <Col span={4}>
                <div>
                  <div style={{ marginBottom: '8px', fontWeight: 500 }}>分</div>
                  <input
                    className="ant-input"
                    value={config.minute}
                    onChange={(e) => updateConfig({ minute: e.target.value })}
                    placeholder="0-59"
                    disabled={disabled}
                  />
                </div>
              </Col>
              <Col span={4}>
                <div>
                  <div style={{ marginBottom: '8px', fontWeight: 500 }}>时</div>
                  <input
                    className="ant-input"
                    value={config.hour}
                    onChange={(e) => updateConfig({ hour: e.target.value })}
                    placeholder="0-23"
                    disabled={disabled}
                  />
                </div>
              </Col>
              <Col span={4}>
                <div>
                  <div style={{ marginBottom: '8px', fontWeight: 500 }}>日</div>
                  <input
                    className="ant-input"
                    value={config.dayOfMonth}
                    onChange={(e) => updateConfig({ dayOfMonth: e.target.value })}
                    placeholder="1-31"
                    disabled={disabled}
                  />
                </div>
              </Col>
              <Col span={4}>
                <div>
                  <div style={{ marginBottom: '8px', fontWeight: 500 }}>月</div>
                  <input
                    className="ant-input"
                    value={config.month}
                    onChange={(e) => updateConfig({ month: e.target.value })}
                    placeholder="1-12"
                    disabled={disabled}
                  />
                </div>
              </Col>
              <Col span={4}>
                <div>
                  <div style={{ marginBottom: '8px', fontWeight: 500 }}>周</div>
                  <input
                    className="ant-input"
                    value={config.dayOfWeek}
                    onChange={(e) => updateConfig({ dayOfWeek: e.target.value })}
                    placeholder="0-6"
                    disabled={disabled}
                  />
                </div>
              </Col>
            </Row>
          </>
        )}

        <PreviewContainer>
          <Text strong>执行说明：</Text>
          <div style={{ marginTop: 4 }}>
            <Tag color="blue">{getExecutionDescription()}</Tag>
          </div>
          
          <Text strong style={{ display: 'block', marginTop: 12 }}>Cron表达式：</Text>
          <CronDisplay>{cronExpression}</CronDisplay>
        </PreviewContainer>
      </div>
    </StyledCard>
  );
};

export default CronExpressionBuilder; 