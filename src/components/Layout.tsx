import { useState, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Alert } from 'antd';
import dayjs from 'dayjs';
import { useConfigStore } from '../store/configStore';
import { useAutoSync } from '../hooks/useAutoSync';
import Sidebar from './Sidebar';
import ConflictResolver from './ConflictResolver';
import './Layout.css';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [syncing, setSyncing] = useState(false);
  const { isConfigured } = useConfigStore();

  // 自动同步
  const {
    sync,
    conflictFiles,
    showConflictResolver,
    handleConflictResolved,
    handleConflictCancel,
  } = useAutoSync({
    onSyncStart: () => setSyncing(true),
    onSyncEnd: () => setSyncing(false),
  });

  // 从 URL 获取当前日期，默认今天
  const getSelectedDate = () => {
    const match = location.pathname.match(/\/day\/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : dayjs().format('YYYY-MM-DD');
  };

  const selectedDate = getSelectedDate();

  const handleDateSelect = useCallback((date: string) => {
    navigate(`/day/${date}`);
  }, [navigate]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    await sync(false);
    setSyncing(false);
  }, [sync]);

  // 添加任务（从往期未完成加入当日）
  const handleAddTask = useCallback((text: string) => {
    window.dispatchEvent(new CustomEvent('add-task-from-past', { detail: { text } }));
  }, []);

  const isSettingsPage = location.pathname === '/settings';
  const showConfigAlert = !isConfigured && !isSettingsPage;

  // 设置页面使用全屏布局
  if (isSettingsPage) {
    return (
      <div className="settings-layout">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
        onSync={handleSync}
        syncing={syncing}
        onAddTask={handleAddTask}
      />
      <div className="main-content">
        {showConfigAlert && (
          <Alert
            message="首次使用提示"
            description={
              <span>
                请先前往 <a onClick={() => navigate('/settings')}>设置页面</a> 配置本地数据目录和 Git 信息
              </span>
            }
            type="info"
            showIcon
            closable
            style={{ margin: 16 }}
          />
        )}
        <Outlet context={{ selectedDate }} />
      </div>

      {/* 冲突解决器 */}
      <ConflictResolver
        visible={showConflictResolver}
        conflictFiles={conflictFiles}
        onResolved={handleConflictResolved}
        onCancel={handleConflictCancel}
      />
    </div>
  );
}
