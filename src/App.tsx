import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Layout from './components/Layout';
import YearView from './pages/YearView';
import MonthView from './pages/MonthView';
import DayView from './pages/DayView';
import Settings from './pages/Settings';
import { useConfigStore } from './store/configStore';

function AppContent() {
  const navigate = useNavigate();
  const { loadConfig } = useConfigStore();

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 全局快捷键 Ctrl+, 打开设置
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        navigate('/settings');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/year" replace />} />
        <Route path="year" element={<YearView />} />
        <Route path="year/:year" element={<YearView />} />
        <Route path="month/:year/:month" element={<MonthView />} />
        <Route path="day/:year/:month/:day" element={<DayView />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
        },
      }}
    >
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
