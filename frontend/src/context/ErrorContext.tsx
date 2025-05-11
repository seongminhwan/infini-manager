import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { Alert, Space } from 'antd';
import styled from 'styled-components';

// 错误消息接口
interface ErrorMessage {
  id: number;
  message: string;
  type: 'error' | 'warning' | 'info' | 'success';
  timestamp: number;
}

// 错误上下文接口
interface ErrorContextType {
  errors: ErrorMessage[];
  addError: (message: string, type?: 'error' | 'warning' | 'info' | 'success') => void;
  removeError: (id: number) => void;
  clearErrors: () => void;
}

// 创建错误上下文
const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

// 样式化组件
const ErrorContainer = styled.div`
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999; /* 增加z-index确保显示在最顶层 */
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 400px;
  pointer-events: auto; /* 确保可以点击关闭按钮 */
`;

const StyledAlert = styled(Alert)`
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  opacity: 0.98;
  border-radius: 4px;
  overflow: hidden;
`;

// 错误提供者组件
export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [errors, setErrors] = useState<ErrorMessage[]>([]);
  
  // 添加错误
  const addError = (message: string, type: 'error' | 'warning' | 'info' | 'success' = 'error') => {
    console.log('添加错误消息:', message, type);
    const newError: ErrorMessage = {
      id: Date.now(),
      message,
      type,
      timestamp: Date.now(),
    };
    setErrors(prev => [...prev, newError]);
  };
  
  // 移除错误
  const removeError = (id: number) => {
    setErrors(prev => prev.filter(error => error.id !== id));
  };
  
  // 清除所有错误
  const clearErrors = () => {
    setErrors([]);
  };
  
  // 自动移除旧的错误消息
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setErrors(prev => prev.filter(error => now - error.timestamp < 5000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <ErrorContext.Provider value={{ errors, addError, removeError, clearErrors }}>
      {children}
      <ErrorContainer>
        <Space direction="vertical" style={{ width: '100%' }}>
          {errors.map(error => (
            <StyledAlert
              key={error.id}
              message={error.message}
              type={error.type}
              showIcon
              closable
              onClose={() => removeError(error.id)}
            />
          ))}
        </Space>
      </ErrorContainer>
    </ErrorContext.Provider>
  );
};

// 自定义钩子，用于在组件中使用错误上下文
export const useError = () => {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
};

// 导出一个全局函数，用于在非React组件中添加错误
let globalAddError: ((message: string, type?: 'error' | 'warning' | 'info' | 'success') => void) | null = null;

export const setGlobalErrorHandler = (
  handler: (message: string, type?: 'error' | 'warning' | 'info' | 'success') => void
) => {
  globalAddError = handler;
};

export const showGlobalError = (
  message: string,
  type: 'error' | 'warning' | 'info' | 'success' = 'error'
) => {
  console.log('尝试显示全局错误:', message);
  if (globalAddError) {
    globalAddError(message, type);
  } else {
    console.error('全局错误处理器未初始化，无法显示错误:', message);
  }
};

export default ErrorContext;