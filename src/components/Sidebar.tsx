import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Button, Space, Typography } from 'antd';
import { SettingOutlined, SyncOutlined, CalendarOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/tauri';
import dayjs, { Dayjs } from 'dayjs';
import { useConfigStore } from '../store/configStore';
import './Sidebar.css';

const { Text } = Typography;

interface SidebarProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onSync: () => void;
  syncing: boolean;
}

export default function Sidebar({ selectedDate, onDateSelect, onSync, syncing }: SidebarProps) {
  const navigate = useNavigate();
  const { isConfigured, config } = useConfigStore();
  const [daysWithTodos, setDaysWithTodos] = useState<Set<string>>(new Set());
  const currentDate = dayjs(selectedDate);

  useEffect(() => {
    if (isConfigured) {
      loadDaysWithTodos(currentDate.year(), currentDate.month() + 1);
    }
  }, [currentDate.year(), currentDate.month(), isConfigured]);

  const loadDaysWithTodos = async (year: number, month: number) => {
    try {
      const monthStr = String(month).padStart(2, '0');
      const dirpath = `${year}/${monthStr}`;
      const files = await invoke<string[]>('list_files', { dirpath });
      const days = new Set(
        files
          .map(f => {
            const match = f.match(/^(\d{2})\.md$/);
            if (match) {
              return `${year}-${monthStr}-${match[1]}`;
            }
            return null;
          })
          .filter(d => d !== null) as string[]
      );
      setDaysWithTodos(days);
    } catch (error) {
      // 目录不存在时忽略错误
    }
  };

  const handleDateSelect = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    onDateSelect(dateStr);
  };

  const handlePanelChange = (date: Dayjs) => {
    loadDaysWithTodos(date.year(), date.month() + 1);
  };

  const handleTodayClick = () => {
    const today = dayjs().format('YYYY-MM-DD');
    onDateSelect(today);
  };

  const dateCellRender = (date: Dayjs) => {
    const dateStr = date.format('YYYY-MM-DD');
    if (daysWithTodos.has(dateStr)) {
      return <div className="todo-dot" />;
    }
    return null;
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <Text strong className="app-title">Todo Desktop</Text>
      </div>

      <div className="sidebar-actions">
        <Button
          type="primary"
          icon={<CalendarOutlined />}
          onClick={handleTodayClick}
          block
        >
          今天
        </Button>
      </div>

      <div className="sidebar-calendar">
        <Calendar
          fullscreen={false}
          value={currentDate}
          onSelect={handleDateSelect}
          onPanelChange={handlePanelChange}
          dateCellRender={dateCellRender}
        />
      </div>

      <div className="sidebar-footer">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            icon={<SyncOutlined spin={syncing} />}
            onClick={onSync}
            loading={syncing}
            disabled={!isConfigured || !config?.remoteUrl}
            block
          >
            同步
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={() => navigate('/settings')}
            block
          >
            设置
          </Button>
        </Space>
      </div>
    </div>
  );
}
