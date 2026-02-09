import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Modal } from 'antd';
import { SettingOutlined, SyncOutlined, LeftOutlined, RightOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/tauri';
import { getVersion } from '@tauri-apps/api/app';
import { appWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/api/shell';
import dayjs from 'dayjs';
import { useConfigStore } from '../store/configStore';
import './Sidebar.css';

const { Text } = Typography;

interface SidebarProps {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  onSync: () => void;
  syncing: boolean;
}

interface TodoStats {
  total: number;
  completed: number;
  uncompleted: number;
}

export default function Sidebar({ selectedDate, onDateSelect, onSync, syncing }: SidebarProps) {
  const navigate = useNavigate();
  const { isConfigured, gitReady, syncVersion, config } = useConfigStore();
  const [daysWithTodos, setDaysWithTodos] = useState<Set<string>>(new Set());
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(dayjs(selectedDate));
  const [todayStats, setTodayStats] = useState<TodoStats>({ total: 0, completed: 0, uncompleted: 0 });
  const [helpVisible, setHelpVisible] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  const today = dayjs();

  // 加载应用版本并设置窗口标题
  useEffect(() => {
    getVersion().then((version) => {
      setAppVersion(version);
      appWindow.setTitle(`Todo Desktop v${version}`);
    }).catch(() => {});
  }, []);

  // 打开更新页面
  const openReleasePage = () => {
    open('https://github.com/en-o/todoDesktop/releases');
  };

  useEffect(() => {
    if (isConfigured) {
      loadDaysWithTodos(currentMonth.year(), currentMonth.month() + 1);
      loadRecentFiles();
      loadTodayStats();
    }
  }, [currentMonth.year(), currentMonth.month(), isConfigured, gitReady, syncVersion]);

  // 当选中日期是今天时，定期刷新统计
  useEffect(() => {
    if (!isConfigured) return;

    const todayStr = today.format('YYYY-MM-DD');
    if (selectedDate !== todayStr) return;

    // 选中今天时每5秒刷新一次统计
    const timer = setInterval(() => {
      loadTodayStats();
    }, 5000);

    return () => clearInterval(timer);
  }, [selectedDate, isConfigured]);

  const loadDaysWithTodos = async (year: number, month: number) => {
    try {
      const monthStr = String(month).padStart(2, '0');
      const dirpath = `${year}/${monthStr}`;
      const files = await invoke<string[]>('list_files', { dirpath });
      const days = new Set(
        files
          .map(f => {
            // 新格式: mm-dd.md
            const match = f.match(/^(\d{2}-\d{2})\.md$/);
            if (match) {
              return `${year}-${match[1]}`;
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

  const loadRecentFiles = async () => {
    try {
      // 获取最近编辑的文件
      const year = today.format('YYYY');
      const month = today.format('MM');
      const dirpath = `${year}/${month}`;
      const files = await invoke<string[]>('list_files', { dirpath });
      const recent = files
        .filter(f => f.endsWith('.md') && !f.startsWith('assets'))
        .sort()
        .reverse()
        .slice(0, 5)
        .map(f => f.replace('.md', ''));
      setRecentFiles(recent);
    } catch (error) {
      // 忽略错误
    }
  };

  const loadTodayStats = async () => {
    try {
      const year = today.format('YYYY');
      const month = today.format('MM');
      const day = today.format('MM-DD');
      const filepath = `${year}/${month}/${day}.md`;
      const content = await invoke<string>('read_file', { filepath });

      // 解析待办统计
      const completedMatches = content.match(/- \[x\]/gi) || [];
      const uncompletedMatches = content.match(/- \[ \]/g) || [];

      setTodayStats({
        total: completedMatches.length + uncompletedMatches.length,
        completed: completedMatches.length,
        uncompleted: uncompletedMatches.length,
      });
    } catch (error) {
      // 文件不存在时重置统计
      setTodayStats({ total: 0, completed: 0, uncompleted: 0 });
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(currentMonth.subtract(1, 'month'));
  };

  const handleNextMonth = () => {
    setCurrentMonth(currentMonth.add(1, 'month'));
  };

  const handleTodayClick = () => {
    const todayStr = today.format('YYYY-MM-DD');
    setCurrentMonth(today);
    onDateSelect(todayStr);
  };

  const handleDateClick = (date: dayjs.Dayjs) => {
    onDateSelect(date.format('YYYY-MM-DD'));
  };

  const handleRecentClick = (mmdd: string) => {
    const year = today.format('YYYY');
    onDateSelect(`${year}-${mmdd}`);
  };

  // 生成日历网格
  const calendarDays = useMemo(() => {
    const startOfMonth = currentMonth.startOf('month');
    const endOfMonth = currentMonth.endOf('month');
    const startDay = startOfMonth.day(); // 0-6
    const daysInMonth = endOfMonth.date();

    const days: (dayjs.Dayjs | null)[] = [];

    // 填充月初空白
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // 填充日期
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(currentMonth.date(i));
    }

    return days;
  }, [currentMonth]);

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <Text strong className="app-title">Todo</Text>
        {appVersion && (
          <span className="header-version">
            <span className="version-text">v{appVersion}</span>
            <span className="version-update" onClick={openReleasePage}>更新</span>
          </span>
        )}
      </div>

      {/* 月份导航 */}
      <div className="month-nav">
        <Button type="text" icon={<LeftOutlined />} onClick={handlePrevMonth} size="small" />
        <Text className="month-label">{currentMonth.format('YYYY年M月')}</Text>
        <Button type="text" icon={<RightOutlined />} onClick={handleNextMonth} size="small" />
      </div>

      {/* 紧凑日历 */}
      <div className="compact-calendar">
        <div className="weekday-row">
          {weekDays.map(d => (
            <div key={d} className="weekday-cell">{d}</div>
          ))}
        </div>
        <div className="days-grid">
          {calendarDays.map((day, index) => {
            if (!day) {
              return <div key={`empty-${index}`} className="day-cell empty" />;
            }

            const dateStr = day.format('YYYY-MM-DD');
            const isToday = day.isSame(today, 'day');
            const isSelected = dateStr === selectedDate;
            const hasTodo = daysWithTodos.has(dateStr);

            return (
              <div
                key={dateStr}
                className={`day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasTodo ? 'has-todo' : ''}`}
                onClick={() => handleDateClick(day)}
              >
                {day.date()}
                {hasTodo && <span className="todo-indicator" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* 可滚动内容区 */}
      <div className="sidebar-scrollable">
        {/* 快速访问 */}
        <div className="quick-access">
          <div className="section-title">快速访问</div>
          <div
            className={`quick-item ${selectedDate === today.format('YYYY-MM-DD') ? 'active' : ''}`}
            onClick={handleTodayClick}
          >
            <span className="quick-icon">📍</span>
            <span>今天</span>
          </div>
          {todayStats.total > 0 && (
            <div className="today-stats">
              <div className="stat-item">
                <span className="stat-label">待办</span>
                <span className="stat-value">{todayStats.total}</span>
              </div>
              <div className="stat-item completed">
                <span className="stat-label">已完成</span>
                <span className="stat-value">{todayStats.completed}</span>
              </div>
              <div className="stat-item uncompleted">
                <span className="stat-label">未完成</span>
                <span className="stat-value">{todayStats.uncompleted}</span>
              </div>
            </div>
          )}
        </div>

        {/* 最近编辑 */}
        <div className="recent-files">
          {recentFiles.length > 0 && (
            <>
              <div className="section-title">最近编辑</div>
              {recentFiles.map(mmdd => (
                <div
                  key={mmdd}
                  className={`recent-item ${selectedDate.endsWith(mmdd) ? 'active' : ''}`}
                  onClick={() => handleRecentClick(mmdd)}
                >
                  <span>{mmdd}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* 底部操作 */}
      <div className="sidebar-footer">
        <div className="footer-buttons">
          <Button
            icon={<SyncOutlined spin={syncing} />}
            onClick={onSync}
            loading={syncing}
            disabled={!isConfigured || !config?.remoteUrl}
            size="small"
          >
            同步
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={() => navigate('/settings')}
            size="small"
          >
            设置
          </Button>
          <Button
            icon={<QuestionCircleOutlined />}
            onClick={() => setHelpVisible(true)}
            size="small"
          >
            帮助
          </Button>
        </div>
      </div>

      {/* 帮助弹框 */}
      <Modal
        title="使用说明"
        open={helpVisible}
        onCancel={() => setHelpVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setHelpVisible(false)}>
            我知道了
          </Button>
        ]}
        width={520}
        centered
        styles={{
          body: {
            maxHeight: 'calc(80vh - 110px)',
            overflowY: 'auto',
          }
        }}
      >
        <div className="help-content">
          <h3>任务管理</h3>
          <ul>
            <li>在底部输入框添加新任务，按 <code>Enter</code> 确认</li>
            <li>点击任务打开右侧详情面板</li>
            <li>勾选任务完成后自动移至「已完成」</li>
            <li>拖拽任务可调整顺序</li>
          </ul>

          <h3>步骤与备注</h3>
          <ul>
            <li><strong>步骤</strong>：为任务添加子步骤，全部完成后任务自动完成</li>
            <li><strong>备注</strong>：支持 Markdown 格式，可上传附件</li>
            <li><strong>预览</strong>：点击眼睛图标切换 Markdown 预览</li>
          </ul>

          <h3>笔记</h3>
          <ul>
            <li>切换到「笔记」标签记录当日笔记</li>
            <li>支持 Markdown，标题请使用 <code>###</code> 三级标题</li>
          </ul>

          <h3>快捷键</h3>
          <ul>
            <li><code>Ctrl + S</code> 保存并同步</li>
          </ul>

          <h3>同步</h3>
          <ul>
            <li><strong>自动保存</strong>：停止输入 2 秒后自动保存</li>
            <li><strong>手动同步</strong>：点击「同步」推送到远程仓库</li>
          </ul>

          <h3>数据存储</h3>
          <ul>
            <li>待办文件：<code>年/月/MM-DD.md</code></li>
            <li>附件目录：<code>年/月/assets/</code></li>
          </ul>
        </div>
      </Modal>
    </div>
  );
}
