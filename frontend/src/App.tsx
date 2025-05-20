import React, { useState, useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme, message } from 'antd';
import { ThemeProvider } from 'styled-components';
import zhCN from 'antd/lib/locale/zh_CN';
import AppRoutes from './routes';
import DisclaimerModal from './components/DisclaimerModal';
import { configApi } from './services/api';
import WarningPage from './pages/WarningPage';
import { lightTheme, darkTheme, GlobalStyle } from './styles/theme';
import { ErrorProvider, setGlobalErrorHandler, useError } from './context/ErrorContext';
import './App.css';

// 配置全局message组件
message.config({
  duration: 3, // 显示时间，单位秒
  maxCount: 3, // 最大显示数量
  top: 60, // 距离顶部的位置
  getContainer: () => document.body // 指定挂载的DOM节点
});

const App: React.FC = () => {
  // 主题设置
  const [isDarkMode, setIsDarkMode] = useState(false);
  const currentTheme = isDarkMode ? darkTheme : lightTheme;
  
  // 免责声明弹窗状态
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [disclaimerLoading, setDisclaimerLoading] = useState(true);
  
  // 安全检查：判断当前域名是否为localhost或127.0.0.1
  const [isLocalhost, setIsLocalhost] = useState(true);
  
  // 加载免责声明确认状态
  useEffect(() => {
    const loadDisclaimerStatus = async () => {
      try {
        setDisclaimerLoading(true);
        const result = await configApi.getConfigByKey('disclaimer_agreement_confirmed');
        if (result.success && result.data) {
          const isConfirmed = JSON.parse(result.data.value);
          if (!isConfirmed) {
            setShowDisclaimerModal(true);
          }
        } else {
          // 如果配置不存在或配置API调用失败，默认显示弹窗
          setShowDisclaimerModal(true);
        }
      } catch (error) {
        console.error('获取免责声明确认状态失败:', error);
        // 出错时默认显示弹窗
        setShowDisclaimerModal(true);
      } finally {
        setDisclaimerLoading(false);
      }
    };
    
    loadDisclaimerStatus();
  }, []);
  
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

  // 用户确认免责声明的回调
  const handleDisclaimerConfirm = () => {
    setShowDisclaimerModal(false);
  };

  // 本地访问正常显示应用
  return (
    <ErrorProvider>
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
            <AppErrorHandler>
              <AppRoutes />
              {/* 首次访问时显示的免责声明弹窗 */}
              <DisclaimerModal 
                visible={showDisclaimerModal} 
                onConfirm={handleDisclaimerConfirm} 
              />
            </AppErrorHandler>
          </BrowserRouter>
        </ThemeProvider>
      </ConfigProvider>
    </ErrorProvider>
  );
};

// 初始化全局错误处理器的组件
const AppErrorHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { addError } = useError();
  
  useEffect(() => {
    // 设置全局错误处理器，使非React组件可以显示错误
    setGlobalErrorHandler(addError);
    console.log('全局错误处理器已初始化');
  }, [addError]);
  
  return <>{children}</>;
};

export default App;