import React from 'react';
import { Result, Typography, Card } from 'antd';
import styled from 'styled-components';

const { Paragraph, Text } = Typography;

const StyledWarningPage = styled.div`
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
`;

const WarningCard = styled(Card)`
  width: 80%;
  max-width: 600px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
`;

/**
 * 安全警告页面
 * 当用户尝试从非本地地址访问系统时显示
 */
const WarningPage: React.FC = () => {
  return (
    <StyledWarningPage>
      <WarningCard>
        <Result
          status="error"
          title="安全警告"
          subTitle="严禁将服务部署到局域网或公网！"
        >
          <div style={{ textAlign: 'left' }}>
            <Paragraph>
              <Text strong style={{ fontSize: '16px', color: '#ff4d4f' }}>
                本系统仅设计为在本地使用！
              </Text>
            </Paragraph>
            <Paragraph>
              将此系统部署到局域网或公网可能会导致：
            </Paragraph>
            <Paragraph>
              <ul>
                <li>个人敏感信息泄露</li>
                <li>账户被未授权访问</li>
                <li>资金损失或被盗用</li>
                <li>严重的财产损失</li>
              </ul>
            </Paragraph>
            <Paragraph>
              <Text strong>
                请立即关闭此页面，并确保系统仅通过localhost或127.0.0.1本地地址访问。
              </Text>
            </Paragraph>
          </div>
        </Result>
      </WarningCard>
    </StyledWarningPage>
  );
};

export default WarningPage;