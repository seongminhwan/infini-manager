import React, { useState, useEffect } from 'react';
import { Popover, Tag, Spin, Descriptions, Empty, message } from 'antd';
import { IdcardOutlined, SafetyCertificateOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { apiBaseUrl } from '../services/api';
import api from '../services/api';

interface KycInfoPopoverProps {
  accountId: number;
  verificationLevel: number | undefined;
}

/**
 * KYC信息 Tag + Popover 组件
 * 1. 显示KYC状态标签，点击后弹出 Popover
 * 2. Popover 展示KYC详细信息
 */
const KycInfoPopover: React.FC<KycInfoPopoverProps> = ({ accountId, verificationLevel }) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [kycInfo, setKycInfo] = useState<any>(null);

  // 获取实际的验证级别
  const actualLevel = verificationLevel !== undefined ? verificationLevel : 0;

  // 根据验证级别设置Tag颜色和文本
  const getTagInfo = () => {
    let color = 'orange';
    let text = '未认证';
    
    if (actualLevel === 1) {
      color = 'blue';
      text = '基础认证';
    } else if (actualLevel === 2) {
      color = 'green';
      text = 'KYC认证';
    } else if (actualLevel === 3) {
      color = 'gold';
      text = 'KYC认证中';
    }
    
    return { color, text };
  };

  // 处理Popover可见性变化
  const handleVisibleChange = (newVisible: boolean) => {
    setVisible(newVisible);
    if (newVisible && !kycInfo) {
      fetchKycInfo();
    }
  };

  // 获取KYC信息
  const fetchKycInfo = async () => {
    if (!accountId) {
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`${apiBaseUrl}/api/infini-accounts/kyc/information/${accountId}`);
      
      if (response.data.success && response.data.data.kyc_information && response.data.data.kyc_information.length > 0) {
        const kycData = response.data.data.kyc_information[0];
        
        // 处理KYC认证中的状态
        if (actualLevel === 3 && (!kycData.status || kycData.status === 0)) {
          kycData.status = 1; // 验证中状态
        }
        
        // 转换为前端需要的格式
        const transformedInfo = {
          id: kycData.id,
          isValid: actualLevel === 2 ? true : Boolean(kycData.is_valid),
          type: kycData.type,
          firstName: kycData.first_name,
          lastName: kycData.last_name,
          country: kycData.country,
          phone: kycData.phone,
          phoneCode: kycData.phone_code,
          identificationNumber: kycData.identification_number,
          status: actualLevel === 2 ? 2 : kycData.status,
          createdAt: kycData.created_at,
          imageUrl: kycData.image_url
        };
        
        setKycInfo(transformedInfo);
      } else {
        // 处理无KYC信息的情况
        if (actualLevel === 3) {
          // KYC认证中状态，创建默认信息
          setKycInfo({
            id: accountId,
            status: 1, // 验证中状态
            isValid: false,
            type: 0,
            createdAt: Math.floor(Date.now() / 1000)
          });
        } else {
          setKycInfo({});
        }
      }
    } catch (error) {
      console.error('获取KYC信息失败:', error);
      message.error('获取KYC信息失败');
    } finally {
      setLoading(false);
    }
  };

  // 格式化状态
  const formatStatus = (status: number) => {
    switch (status) {
      case 0: return '未验证';
      case 1: return '验证中';
      case 2: return '已验证';
      case 3: return '验证失败';
      default: return '未知状态';
    }
  };

  // 渲染KYC信息内容
  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Spin />
          <div style={{ marginTop: 8 }}>加载KYC信息...</div>
        </div>
      );
    }

    if (!kycInfo || Object.keys(kycInfo).length === 0) {
      return (
        <Empty description="暂无KYC信息" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      );
    }

    return (
      <Descriptions column={1} size="small" bordered>
        {kycInfo.firstName && kycInfo.lastName && (
          <Descriptions.Item label="姓名">{`${kycInfo.lastName} ${kycInfo.firstName}`}</Descriptions.Item>
        )}
        {kycInfo.country && (
          <Descriptions.Item label="国家">{kycInfo.country}</Descriptions.Item>
        )}
        {kycInfo.phone && (
          <Descriptions.Item label="电话">
            {kycInfo.phoneCode 
              ? (kycInfo.phoneCode.startsWith('+') ? kycInfo.phoneCode : `+${kycInfo.phoneCode}`) + ' ' 
              : ''
            }
            {kycInfo.phone}
          </Descriptions.Item>
        )}
        {kycInfo.identificationNumber && (
          <Descriptions.Item label="证件号码">{kycInfo.identificationNumber}</Descriptions.Item>
        )}
        <Descriptions.Item label="KYC状态">
          <Tag color={kycInfo.status === 2 ? 'green' : kycInfo.status === 1 ? 'gold' : 'red'}>
            {formatStatus(kycInfo.status)}
          </Tag>
        </Descriptions.Item>
        {kycInfo.createdAt && (
          <Descriptions.Item label="创建时间">
            {new Date(kycInfo.createdAt * 1000).toLocaleString()}
          </Descriptions.Item>
        )}
      </Descriptions>
    );
  };

  const { color, text } = getTagInfo();

  return (
    <Popover
      open={visible}
      onOpenChange={handleVisibleChange}
      trigger="click"
      placement="rightBottom"
      title={<div><IdcardOutlined /> KYC信息</div>}
      content={<div style={{ width: 300 }}>{renderContent()}</div>}
      getPopupContainer={() => document.body}
      destroyTooltipOnHide
    >
      <Tag 
        color={color} 
        style={{ cursor: 'pointer' }}
      >
        {text}
      </Tag>
    </Popover>
  );
};

export default KycInfoPopover;