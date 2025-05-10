import React, { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { ThemeProvider } from 'styled-components';
import zhCN from 'antd/lib/locale/zh_CN';
import AppRoutes from './routes';
import { lightTheme, darkTheme, GlobalStyle } from './styles/theme';
import './App.css';

const App: React.FC = () => {
  // 主题设置
  const [isDarkMode, setIsDarkMode] = useState(false);
  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  
  // 切换主题（暂未实现UI，可以在后续添加）
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: currentTheme.primaryColor,
          colorSuccess: currentTheme.successColor,
          colorWarning: currentTheme.warningColor,
          colorError: currentTheme.errorColor,
          colorBgContainer: currentTheme.secondaryBackgroundColor,
          borderRadius: 8,
        },
      }}
    >
      <ThemeProvider theme={currentTheme}>
        <GlobalStyle theme={currentTheme} />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ThemeProvider>
    </ConfigProvider>
  );
};

export default App;