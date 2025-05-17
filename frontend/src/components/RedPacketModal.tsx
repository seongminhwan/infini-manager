/**
 * 红包领取模态框组件
 * 用于批量领取红包并显示进度和结果
 */
import React, { useState } from 'react';
import {
  Modal,
  Button,
  Input,
  Form,
  Alert,
  Progress,
  Descriptions,
  Divider,
  List,
  Space,
  Tag,
  Typography,
  message
} from 'antd';
import { 
  RedEnvelopeOutlined, 
  InfoCircleOutlined, 
  CheckCircleOutlined
} from '@ant-design/icons';
import { transferApi } from '../services/api';

const { Text } = Typography;

interface RedPacketModalProps {
  visible: boolean;
  onClose: () => void;
  accountIds: string[];
  onSuccess?: () => void;
}

// 红包领取结果接口
interface RedPacketProgressType {
  current: number;
  total: number;
  success: number;
  failed: number;
  totalAmount: string;
  results: Array<{
    accountId: string;
    success: boolean;
    amount: string;
    message?: string;
  }>;
}

const RedPacketModal: React.FC<RedPacketModalProps> = ({
  visible,
  onClose,
  accountIds,
  onSuccess
}) => {
  const [redPacketCode, setRedPacketCode] = useState('7aEh9cfqfWxmaJmEWTSCWe'); // 默认红包码
  const [loading, setLoading] = useState(false);
  
  // 进度状态
  const [progress, setProgress] = useState<RedPacketProgressType>({
    current: 0,
    total: 0,
    success: 0,
    failed: 0,
    totalAmount: '0',
    results: []
  });

  // 重置状态
  const resetState = () => {
    setProgress({
      current: 0,
      total: 0,
      success: 0,
      failed: 0,
      totalAmount: '0',
      results: []
    });
  };

  // 当模态框显示时重置状态
  React.useEffect(() => {
    if (visible) {
      resetState();
    }
  }, [visible]);

  // 开始批量领取红包
  const startGrabRedPacket = async () => {
    if (!redPacketCode) {
      message.error('请输入红包码');
      return;
    }

    if (accountIds.length === 0) {
      message.error('没有可用的账户');
      return;
    }

    try {
      setLoading(true);
      message.loading('正在批量领取红包...');

      // 重置进度状态
      setProgress({
        current: 0,
        total: accountIds.length,
        success: 0,
        failed: 0,
        totalAmount: '0',
        results: []
      });
      
      // 定义进度回调函数
      const onProgress = (current: number, total: number, result: any) => {
        // 更新进度状态
        setProgress(prev => ({
          current,
          total,
          success: result.success ? prev.success + 1 : prev.success,
          failed: !result.success ? prev.failed + 1 : prev.failed,
          totalAmount: result.success ? 
            (parseFloat(prev.totalAmount) + parseFloat(result.amount)).toFixed(6) : 
            prev.totalAmount,
          results: [...prev.results, result]
        }));
      };

      // 调用批量领取红包API
      const response = await transferApi.batchGrabRedPacket(accountIds, redPacketCode, onProgress);
      
      if (response.success) {
        message.success(response.message || '批量领取红包完成');
        // 如果提供了成功回调函数，则调用
        if (onSuccess) {
          onSuccess();
        }
      } else {
        message.error(response.message || '批量领取红包失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || error.message || '批量领取红包失败');
      console.error('批量领取红包失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="批量领取红包"
      open={visible}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="cancel" onClick={onClose}>
          关闭
        </Button>,
        <Button
          key="start"
          type="primary"
          icon={<RedEnvelopeOutlined />}
          loading={loading}
          onClick={startGrabRedPacket}
          disabled={loading || accountIds.length === 0}
        >
          开始领取
        </Button>
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Form.Item label="红包码">
          <Input 
            value={redPacketCode}
            onChange={(e) => setRedPacketCode(e.target.value)}
            placeholder="请输入红包码"
            disabled={loading}
            style={{ width: '100%' }}
            prefix={<RedEnvelopeOutlined />}
          />
        </Form.Item>
        
        <Alert
          message="提示"
          description="系统将使用所有账户依次领取红包，请确保账户已经登录并且红包码有效。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      </div>
      
      {/* 进度显示 */}
      {loading && (
        <>
          <div style={{ marginBottom: 16 }}>
            <Progress 
              percent={progress.total ? Math.round((progress.current / progress.total) * 100) : 0} 
              status="active"
            />
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              {progress.current} / {progress.total}
            </div>
          </div>
          
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="已完成">
              {progress.current} / {progress.total}
            </Descriptions.Item>
            <Descriptions.Item label="成功领取">
              <Tag color="green">{progress.success}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="领取失败">
              <Tag color="red">{progress.failed}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="累计金额">
              <Tag color="blue">{progress.totalAmount}</Tag>
            </Descriptions.Item>
          </Descriptions>
        </>
      )}
      
      {/* 结果列表 */}
      {progress.results.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Divider>领取结果</Divider>
          <List
            size="small"
            bordered
            dataSource={progress.results}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta
                  title={
                    <Space>
                      <span>账户ID: {item.accountId}</span>
                      <Tag color={item.success ? 'green' : 'red'}>
                        {item.success ? '成功' : '失败'}
                      </Tag>
                    </Space>
                  }
                  description={
                    item.success ? 
                    `领取金额: ${item.amount}` : 
                    `失败原因: ${item.message || '未知错误'}`
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )}
    </Modal>
  );
};

export default RedPacketModal;