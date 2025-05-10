import { createGlobalStyle } from 'styled-components';

// 主题颜色变量
export const lightTheme = {
  primaryColor: '#1890ff',
  primaryRgb: '24, 144, 255',
  successColor: '#52c41a',
  warningColor: '#faad14',
  errorColor: '#ff4d4f',
  backgroundColor: '#f0f2f5',
  secondaryBackgroundColor: '#fff',
  textColor: '#000000d9',
  secondaryTextColor: '#00000073',
  borderColor: '#d9d9d9',
  shadowColor: 'rgba(0, 0, 0, 0.1)',
  glassOpacity: '0.7',
};

export const darkTheme = {
  primaryColor: '#177ddc',
  primaryRgb: '23, 125, 220',
  successColor: '#49aa19',
  warningColor: '#d89614',
  errorColor: '#d32029',
  backgroundColor: '#141414',
  secondaryBackgroundColor: '#1f1f1f',
  textColor: 'rgba(255, 255, 255, 0.85)',
  secondaryTextColor: 'rgba(255, 255, 255, 0.45)',
  borderColor: '#434343',
  shadowColor: 'rgba(0, 0, 0, 0.45)',
  glassOpacity: '0.2',
};

// 创建全局样式
export const GlobalStyle = createGlobalStyle<{ theme: typeof lightTheme }>`
  :root {
    --primary-color: ${props => props.theme.primaryColor};
    --primary-rgb: ${props => props.theme.primaryRgb};
    --success-color: ${props => props.theme.successColor};
    --warning-color: ${props => props.theme.warningColor};
    --error-color: ${props => props.theme.errorColor};
    --background-color: ${props => props.theme.backgroundColor};
    --secondary-background-color: ${props => props.theme.secondaryBackgroundColor};
    --text-color: ${props => props.theme.textColor};
    --secondary-text-color: ${props => props.theme.secondaryTextColor};
    --border-color: ${props => props.theme.borderColor};
    --shadow-color: ${props => props.theme.shadowColor};
    --glass-opacity: ${props => props.theme.glassOpacity};
  }
  
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: var(--background-color);
    color: var(--text-color);
    transition: all 0.3s;
  }
  
  .ant-layout {
    background: var(--background-color);
  }
  
  /* 定制化滚动条 */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: transparent;
  }
  
  ::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.3);
  }
`;

export default { lightTheme, darkTheme, GlobalStyle };