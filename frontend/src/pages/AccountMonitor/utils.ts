/**
 * AccountMonitor组件相关工具函数
 */
import { message } from 'antd';
import dayjs from 'dayjs';
import { InfiniAccount } from './types';

/**
 * 格式化时间
 * @param time 时间字符串
 * @returns 格式化后的时间字符串
 */
export const formatTime = (time?: string) => {
  if (!time) return '--';
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss');
};

/**
 * 格式化时间戳
 * @param timestamp 时间戳（秒）
 * @returns 格式化后的时间字符串
 */
export const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return '未知';
  return dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss');
};

/**
 * 格式化金额
 * @param amount 金额数值
 * @returns 格式化后的金额字符串
 */
export const formatAmount = (amount: number) => {
  return amount.toFixed(6);
};

/**
 * 生成随机强密码
 * @returns 随机生成的强密码
 */
export const generateStrongPassword = (): string => {
  const length = Math.floor(Math.random() * 9) + 16; // 16-24位长度
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~`|}{[]:;?><,./-=';
  let password = '';

  // 确保至少包含一个特殊字符
  let hasSpecialChar = false;
  const specialChars = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

  // 生成随机密码
  for (let i = 0; i < length; i++) {
    const randomChar = charset.charAt(Math.floor(Math.random() * charset.length));
    password += randomChar;

    // 检查是否包含特殊字符
    if (specialChars.includes(randomChar)) {
      hasSpecialChar = true;
    }
  }

  // 如果没有特殊字符，替换最后一个字符为特殊字符
  if (!hasSpecialChar) {
    const randomSpecialChar = specialChars.charAt(Math.floor(Math.random() * specialChars.length));
    password = password.slice(0, -1) + randomSpecialChar;
  }

  return password;
};

/**
 * 根据金额和颜色区间配置获取样式
 * @param amount 金额
 * @param colorRanges 颜色区间配置
 * @returns 样式对象
 */
export const getStyleForBalance = (amount: number, colorRanges: any[]) => {
  const result = {
    color: "default", // 默认标签颜色
    style: {} as React.CSSProperties // 默认样式为空
  };

  // 从大到小遍历阈值，找到第一个符合条件的区间
  for (const range of colorRanges) {
    if (amount >= range.threshold) {
      result.color = range.color;
      // 如果有背景色和文字颜色，添加到样式中
      if (range.backgroundColor && range.textColor) {
        result.style = {
          backgroundColor: range.backgroundColor,
          color: range.textColor
        };
      }
      break;
    }
  }

  return result;
};

/**
 * 复制文本到剪贴板
 * @param text 要复制的文本
 * @param messageText 提示消息文本
 */
export const copyToClipboard = (text: string, messageText: string = '已复制到剪贴板') => {
  navigator.clipboard.writeText(text)
    .then(() => {
      message.success(messageText);
    })
    .catch((err: any) => {
      console.error('复制失败:', err);
      message.error('复制失败，请手动复制');
    });
};

/**
 * 获取账户实际验证级别
 * @param account 账户对象
 * @returns 验证级别数值
 */
export const getActualVerificationLevel = (account: InfiniAccount): number => {
  // 优先使用verification_level，如果不存在则使用verificationLevel
  return account.verification_level !== undefined ? account.verification_level : (account.verificationLevel || 0);
};