import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Typography, Space, Modal } from 'antd';
import { SettingOutlined, SyncOutlined, LeftOutlined, RightOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/tauri';
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
  const { isConfigured, config } = useConfigStore();
  const [daysWithTodos, setDaysWithTodos] = useState<Set<string>>(new Set());
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(dayjs(selectedDate));
  const [todayStats, setTodayStats] = useState<TodoStats>({ total: 0, completed: 0, uncompleted: 0 });
  const [helpVisible, setHelpVisible] = useState(false);

  const today = dayjs();

  useEffect(() => {
    if (isConfigured) {
      loadDaysWithTodos(currentMonth.year(), currentMonth.month() + 1);
      loadRecentFiles();
      loadTodayStats();
    }
  }, [currentMonth.year(), currentMonth.month(), isConfigured]);

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

      {/* 底部操作 */}
      <div className="sidebar-footer">
        <Space style={{ width: '100%' }} size={8}>
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
        </Space>
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
        width={600}
        centered
        styles={{
          body: {
            maxHeight: 'calc(80vh - 110px)',
            overflowY: 'auto',
          }
        }}
      >
        <div className="help-content">
          <h3>基本使用</h3>
          <ul>
            <li><strong>选择日期</strong>：点击日历中的日期查看或编辑当天的待办事项</li>
            <li><strong>添加待办</strong>：在「待办事项」区域输入内容，使用工具栏的复选框按钮或输入 <code>- [ ]</code> 创建待办项</li>
            <li><strong>完成待办</strong>：勾选待办项前的复选框，该项会自动移动到「完成事项」区域</li>
            <li><strong>取消完成</strong>：在「完成事项」中取消勾选，该项会自动回到「待办事项」</li>
          </ul>

          <h3>快捷键</h3>
          <ul>
            <li><strong>Ctrl + S</strong>：保存当前内容</li>
            <li><strong>Ctrl + Enter</strong>：保存当前内容</li>
          </ul>

          <h3>同步机制</h3>
          <ol>
            <li><strong>自动保存</strong>：停止输入 2 秒后自动保存到本地并提交 Git</li>
            <li><strong>定时同步</strong>：每 5 分钟自动与远程仓库同步（需配置远程仓库）</li>
            <li><strong>手动同步</strong>：点击「同步」按钮立即执行同步</li>
          </ol>
          <p style={{ marginTop: 8, color: '#666' }}>
            <strong>同步流程</strong>：拉取远程更新 → 检测冲突 → 自动合并或弹出冲突解决窗口 → 推送本地更改
          </p>

          <h3>文件存储</h3>
          <ul>
            <li><strong>文件路径</strong>：年/月/MM-DD.md（如 2026/02/02-06.md）</li>
            <li><strong>附件存储</strong>：年/月/assets/ 目录</li>
            <li><strong>上传附件</strong>：使用工具栏上传按钮或直接粘贴图片</li>
          </ul>

          <h3>注意事项</h3>
          <ul>
            <li>「待办事项」和「完成事项」是固定区域标题，请勿删除</li>
            <li>已完成的待办会自动移动到「完成事项」区域，并显示删除线效果</li>
            <li>如需修改已完成的内容，请先取消勾选使其回到「待办事项」</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
}
