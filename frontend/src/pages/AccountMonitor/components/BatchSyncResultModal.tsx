/**
 * 批量同步结果模态框组件
 */
import React from 'react';
import { Modal, Button, Table, Descriptions, Divider, Tag } from 'antd';
import { BatchSyncResult } from '../types';

interface BatchSyncResultModalProps {
  visible: boolean;
  result: BatchSyncResult | null;
  onClose: () => void;
}

const BatchSyncResultModal: React.FC<BatchSyncResultModalProps> = ({ 
  visible, 
  result, 
  onClose 
}) => {
  if (!result) return null;

  // 表格列定义
  const columns = [
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '结果',
      dataIndex: 'success',
      key: 'success',
      render: (success: boolean) => (
        <Tag color={success ? 'green' : 'red'}>
          {success ? '成功' : '失败'}
        </Tag>
      ),
    },
    {
      title: '详情',
      dataIndex: 'message',
      key: 'message',
      render: (message?: string) => message || '-',
    },
  ];

  return (
    <Modal
      title="批量同步结果"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>
      ]}
    >
      <Descriptions title="同步统计" bordered>
        <Descriptions.Item label="总账户数">{result.total}</Descriptions.Item>
        <Descriptions.Item label="同步成功">{result.success}</Descriptions.Item>
        <Descriptions.Item label="同步失败">{result.failed}</Descriptions.Item>
      </Descriptions>

      <Divider>详细结果</Divider>

      <Table
        columns={columns}
        dataSource={result.accounts}
        rowKey="id"
        pagination={false}
      />
    </Modal>
  );
};

export default BatchSyncResultModal;