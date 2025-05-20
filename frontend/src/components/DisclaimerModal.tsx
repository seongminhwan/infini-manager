import React, { useState } from 'react';
import { Modal, Checkbox, Button, Typography, Divider, Space } from 'antd';
import { configApi } from '../services/api';

const { Title, Paragraph, Text } = Typography;

interface DisclaimerModalProps {
  visible: boolean;
  onConfirm: () => void;
}

/**
 * 免责声明弹窗组件
 * 在用户首次访问系统时显示，要求用户阅读并确认严禁和免责声明
 */
const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ visible, onConfirm }) => {
  // 用户是否同意条款
  const [agreed, setAgreed] = useState(false);

  // 用户勾选确认
  const handleCheckboxChange = (e: any) => {
    setAgreed(e.target.checked);
  };

  // 保存用户确认状态并关闭弹窗
  const handleConfirm = async () => {
    if (agreed) {
      try {
        // 保存到数据库
        await configApi.upsertConfig(
          'disclaimer_agreement_confirmed',
          true,
          '用户已确认免责声明'
        );
        onConfirm();
      } catch (error) {
        console.error('保存确认状态失败:', error);
      }
    }
  };

  return (
    <Modal
      title={<Title level={4}>系统使用声明</Title>}
      open={visible}
      closable={false}
      maskClosable={false}
      width={700}
      centered
      bodyStyle={{ 
        maxHeight: '60vh', 
        overflow: 'auto', 
        padding: '16px 24px' 
      }}
      footer={[
        <Button 
          key="confirm" 
          type="primary" 
          disabled={!agreed}
          onClick={handleConfirm}
        >
          我已了解并同意
        </Button>
      ]}
    >
      <Typography style={{ marginBottom: 0 }}>
        <Title level={4} style={{ marginTop: 0 }}>⚠️ 严禁非法行为声明 | PROHIBITION OF ILLEGAL ACTIVITIES ⚠️</Title>
        <Paragraph style={{ fontWeight: 'bold', marginBottom: 8 }}>
          本系统的目的是便于拥有多个Infini账户的用户管理自己的账户。严厉禁止任何用户通过本系统对Infini系统进行hack行为，一经发现，将会通知官方，并将相关信息移交网络安全部门。
        </Paragraph>
        <Paragraph>
          The purpose of this system is to help users manage their own Infini accounts. Any attempt to hack the Infini system through this tool is strictly prohibited. Violations will be reported to Infini officials and relevant information will be handed over to cybersecurity authorities.
        </Paragraph>

        <Divider style={{ margin: '12px 0' }} />

        <Title level={4} style={{ marginBottom: 8 }}>免责声明 | DISCLAIMER</Title>
        <Title level={5} style={{ marginTop: 0, marginBottom: 8 }}>⚠️ 重要声明：本项目仅供学习和研究使用 ⚠️</Title>
        <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>⚠️ IMPORTANT DISCLAIMER: THIS PROJECT IS FOR EDUCATIONAL AND RESEARCH PURPOSES ONLY ⚠️</Title>

        <Space direction="vertical" size={8}>
          <Paragraph>
            <Text strong>• 本项目仅用于技术学习、研究和个人非商业用途</Text><br />
            <Text>This project is solely for technical learning, research, and personal non-commercial use</Text>
          </Paragraph>
          
          <Paragraph>
            <Text strong>• 严禁将本系统用于任何商业目的</Text><br />
            <Text>Commercial use of this system is strictly prohibited</Text>
          </Paragraph>
          
          <Paragraph>
            <Text strong>• 严禁使用本系统进行任何违反法律法规的活动</Text><br />
            <Text>Any use of this system for illegal activities is strictly prohibited</Text>
          </Paragraph>
          
          <Paragraph>
            <Text strong>• 使用本系统所产生的任何法律责任均由使用者自行承担</Text><br />
            <Text>Users bear all legal responsibilities arising from the use of this system</Text>
          </Paragraph>
          
          <Paragraph>
            <Text strong>• 开发者不对使用本系统所导致的任何直接或间接损失负责</Text><br />
            <Text>Developers are not responsible for any direct or indirect losses caused by using this system</Text>
          </Paragraph>
          
          <Paragraph>
            <Text strong>• 如对系统用途有疑问，请在使用前咨询法律顾问</Text><br />
            <Text>If you have questions about the system's usage, please consult a legal advisor before use</Text>
          </Paragraph>
        </Space>

        <Divider style={{ margin: '12px 0' }} />

        <Checkbox 
          onChange={handleCheckboxChange}
          checked={agreed}
          style={{ marginTop: 8 }}
        >
          <Text strong>我已知晓所有禁止行为，我保证不将其用于非法行为</Text>
        </Checkbox>
      </Typography>
    </Modal>
  );
};

export default DisclaimerModal;