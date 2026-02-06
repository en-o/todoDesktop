import { useState } from 'react';
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import { message, Alert } from 'antd';
import { invoke } from '@tauri-apps/api/tauri';
import dayjs from 'dayjs';
import { useConfigStore } from '../store/configStore';
import Sidebar from './Sidebar';
import './Layout.css';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [syncing, setSyncing] = useState(false);
  const { isConfigured } = useConfigStore();

  // 从 URL 获取当前日期，默认今天
  const getSelectedDate = () => {
    const match = location.pathname.match(/\/day\/(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : dayjs().format('YYYY-MM-DD');
  };

  const selectedDate = getSelectedDate();

  const handleDateSelect = (date: string) => {
    navigate(`/day/${date}`);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await invoke('git_pull');
      message.success('拉取成功');
      await invoke('git_push');
      message.success('同步成功');
    } catch (error) {
      message.error(`同步失败: ${error}`);
    } finally {
      setSyncing(false);
    }
  };

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
    </div>
  );
}
