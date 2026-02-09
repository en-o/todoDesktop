import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Modal } from 'antd';
import { SettingOutlined, SyncOutlined, LeftOutlined, RightOutlined, QuestionCircleOutlined, BarChartOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/tauri';
import { getVersion } from '@tauri-apps/api/app';
import { appWindow } from '@tauri-apps/api/window';
import { open } from '@tauri-apps/api/shell';
import dayjs from 'dayjs';
import { useConfigStore } from '../store/configStore';
import { useStatsStore } from '../store/statsStore';
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
  const { isConfigured, syncVersion, config } = useConfigStore();
  const { todayStats, stats, loadStats, recalculateStats, loading: statsLoading } = useStatsStore();
  const [daysWithTodos, setDaysWithTodos] = useState<Set<string>>(new Set());
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(dayjs(selectedDate));
  const [helpVisible, setHelpVisible] = useState(false);
  const [statsVisible, setStatsVisible] = useState(false);
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
      loadStats();
    }
  }, [currentMonth.year(), currentMonth.month(), isConfigured, syncVersion, loadStats]);

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
          {/* 查看统计按钮 */}
          <div
            className="quick-item"
            onClick={() => setStatsVisible(true)}
          >
            <span className="quick-icon">📊</span>
            <span>查看统计</span>
          </div>
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
            <li><code>Enter</code> 在步骤输入框中按回车创建下一个步骤</li>
          </ul>

          <h3>同步</h3>
          <ul>
            <li><strong>手动保存</strong>：按 <code>Ctrl + S</code> 保存并推送到远程</li>
            <li><strong>手动同步</strong>：点击「同步」拉取远程更新并推送本地更改</li>
            <li><strong>自动保存</strong>：3 分钟无操作时自动保存并推送</li>
          </ul>

          <h3>数据存储</h3>
          <ul>
            <li>待办文件：<code>年/月/MM-DD.md</code></li>
            <li>附件目录：<code>年/月/assets/</code></li>
          </ul>
        </div>
      </Modal>

      {/* 统计弹框 */}
      <Modal
        title="任务统计"
        open={statsVisible}
        onCancel={() => setStatsVisible(false)}
        footer={[
          <Button key="refresh" onClick={recalculateStats} loading={statsLoading}>
            重新计算
          </Button>,
          <Button key="close" type="primary" onClick={() => setStatsVisible(false)}>
            关闭
          </Button>
        ]}
        width={480}
        centered
      >
        <div className="stats-content">
          {stats ? (
            <>
              <div className="stats-section">
                <h4>📅 今日统计</h4>
                <div className="stats-grid">
                  <div className="stats-card">
                    <span className="stats-number">{todayStats.total}</span>
                    <span className="stats-label">总任务</span>
                  </div>
                  <div className="stats-card completed">
                    <span className="stats-number">{todayStats.completed}</span>
                    <span className="stats-label">已完成</span>
                  </div>
                  <div className="stats-card uncompleted">
                    <span className="stats-number">{todayStats.uncompleted}</span>
                    <span className="stats-label">未完成</span>
                  </div>
                </div>
              </div>

              <div className="stats-section">
                <h4>📈 历史汇总</h4>
                <div className="stats-grid">
                  <div className="stats-card">
                    <span className="stats-number">{stats.summary.totalTasksCreated}</span>
                    <span className="stats-label">总任务数</span>
                  </div>
                  <div className="stats-card completed">
                    <span className="stats-number">{stats.summary.totalTasksCompleted}</span>
                    <span className="stats-label">已完成</span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-number">{(stats.summary.completionRate * 100).toFixed(1)}%</span>
                    <span className="stats-label">完成率</span>
                  </div>
                </div>
              </div>

              <div className="stats-section">
                <h4>🔥 连续完成</h4>
                <div className="stats-grid">
                  <div className="stats-card streak">
                    <span className="stats-number">{stats.summary.currentStreak}</span>
                    <span className="stats-label">当前连续天数</span>
                  </div>
                  <div className="stats-card streak">
                    <span className="stats-number">{stats.summary.longestStreak}</span>
                    <span className="stats-label">最长连续天数</span>
                  </div>
                </div>
              </div>

              <div className="stats-section">
                <h4>📊 更多数据</h4>
                <div className="stats-list">
                  <div className="stats-row">
                    <span>有任务的天数</span>
                    <span>{stats.summary.daysWithTasks} 天</span>
                  </div>
                  <div className="stats-row">
                    <span>全部完成的天数</span>
                    <span>{stats.summary.perfectDays} 天</span>
                  </div>
                  <div className="stats-row">
                    <span>平均每日任务</span>
                    <span>{stats.summary.averageTasksPerDay.toFixed(1)} 个</span>
                  </div>
                  <div className="stats-row hint">
                    <span>最后更新</span>
                    <span>{stats.lastUpdated || '-'}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="stats-empty">
              <p>暂无统计数据</p>
              <Button onClick={recalculateStats} loading={statsLoading}>
                立即计算
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
