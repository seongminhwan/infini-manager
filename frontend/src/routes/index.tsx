import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import Overview from '../pages/Overview';
import AccountMonitor from '../pages/AccountMonitor';
import AccountTransfer from '../pages/AccountTransfer';
import AccountDetails from '../pages/AccountDetails';
import AccountRegister from '../pages/AccountRegister';
import NotificationManage from '../pages/NotificationManage';
import TriggerManage from '../pages/TriggerManage';
import EmailManage from '../pages/EmailManage';
import KycImageManage from '../pages/KycImageManage';
import RandomUserManage from '../pages/RandomUserManage';
import AccountGroupManage from '../pages/AccountGroupManage';
import AffCashback from '../pages/AffCashback';
import AffHistory from '../pages/AffHistory';
import BatchCardApply from '../pages/BatchCardApply';
import BatchTransfer from '../pages/BatchTransfer';
import BatchTransferDetails from '../pages/BatchTransferDetails';
import TaskManage from '../pages/TaskManage';
import ApiLogMonitor from '../pages/ApiLogMonitor';

/**
 * 应用路由配置
 * 定义了所有页面的路由结构
 */
const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        {/* 默认重定向到概览页 */}
        <Route index element={<Navigate to="/overview" replace />} />
        {/* 各功能页面路由 */}
        <Route path="/overview" element={<Overview />} />
        <Route path="/account-monitor" element={<AccountMonitor />} />
        <Route path="/account-transfer" element={<AccountTransfer />} />
        <Route path="/account-details" element={<AccountDetails />} />
        <Route path="/account-register" element={<AccountRegister />} />
        <Route path="/account-group-manage" element={<AccountGroupManage />} />
        <Route path="/notification-manage" element={<NotificationManage />} />
        <Route path="/trigger-manage" element={<TriggerManage />} />
        <Route path="/email-manage" element={<EmailManage />} />
        <Route path="/kyc-image-manage" element={<KycImageManage />} />
        <Route path="/random-user-manage" element={<RandomUserManage />} />
        {/* AFF返现相关路由 */}
        <Route path="/aff-cashback" element={<AffCashback />} />
        <Route path="/aff-history" element={<AffHistory />} />
        {/* 卡片管理相关路由 */}
        <Route path="/batch-card-apply" element={<BatchCardApply />} />
        {/* 批量转账相关路由 */}
        <Route path="/batch-transfer" element={<BatchTransfer />} />
        <Route path="/batch-transfer-details" element={<BatchTransferDetails />} />
        {/* 定时任务管理路由 */}
        <Route path="/task-manage" element={<TaskManage />} />
        {/* API日志监控路由 */}
        <Route path="/api-log-monitor" element={<ApiLogMonitor />} />
      </Route>
    </Routes>
  );
};

export default AppRoutes;