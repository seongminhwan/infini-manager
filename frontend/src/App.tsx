import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { ThemeProvider } from 'styled-components';
import zhCN from 'antd/lib/locale/zh_CN';
import AppRoutes from './routes';
import WarningPage from './pages/WarningPage';
import { lightTheme, darkTheme, GlobalStyle } from './styles/theme';
import './App.css';

const App: React.FC = () => {
  // 主题设置
  const [isDarkMode, setIsDarkMode] = useState(false);
  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  
  // 安全检查：判断当前域名是否为localhost或127.0.0.1
  const [isLocalhost, setIsLocalhost] = useState(true);
  
  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      setIsLocalhost(false);
    }
  }, []);
  
  // 切换主题（暂未实现UI，可以在后续添加）
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  // 如果不是本地访问，显示警告页面
  if (!isLocalhost) {
    return <WarningPage />;
  }

  // 本地访问正常显示应用
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