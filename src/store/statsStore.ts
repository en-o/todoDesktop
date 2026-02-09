import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';

export interface DailyStats {
  total: number;
  completed: number;
  uncompleted: number;
}

export interface StatsSummary {
  totalTasksCreated: number;
  totalTasksCompleted: number;
  completionRate: number;
  currentStreak: number;
  longestStreak: number;
  averageTasksPerDay: number;
  totalDays: number;
  daysWithTasks: number;
  perfectDays: number;
}

export interface Statistics {
  lastUpdated: string;
  daily: Record<string, DailyStats>;
  summary: StatsSummary;
}

interface StatsState {
  // 持久化统计
  stats: Statistics | null;
  // 今日实时统计（从编辑器实时更新）
  todayStats: DailyStats;
  // 加载状态
  loading: boolean;

  // 加载统计
  loadStats: () => Promise<void>;
  // 重新计算所有统计
  recalculateStats: () => Promise<void>;
  // 更新某天的统计
  updateDailyStats: (date: string, total: number, completed: number, uncompleted: number) => Promise<void>;
  // 设置今日实时统计（由编辑器调用）
  setTodayStats: (stats: DailyStats) => void;
}

export const useStatsStore = create<StatsState>((set, get) => ({
  stats: null,
  todayStats: { total: 0, completed: 0, uncompleted: 0 },
  loading: false,

  loadStats: async () => {
    set({ loading: true });
    try {
      const stats = await invoke<Statistics>('load_stats');
      set({ stats, loading: false });
    } catch (error) {
      console.error('加载统计失败:', error);
      set({ loading: false });
    }
  },

  recalculateStats: async () => {
    set({ loading: true });
    try {
      const stats = await invoke<Statistics>('recalculate_stats');
      set({ stats, loading: false });
    } catch (error) {
      console.error('重新计算统计失败:', error);
      set({ loading: false });
    }
  },

  updateDailyStats: async (date: string, total: number, completed: number, uncompleted: number) => {
    try {
      const stats = await invoke<Statistics>('update_daily_stats', {
        date,
        total,
        completed,
        uncompleted,
      });
      set({ stats });
    } catch (error) {
      // 忽略未来日期的错误
      if (!String(error).includes('不统计未来日期')) {
        console.error('更新统计失败:', error);
      }
    }
  },

  setTodayStats: (todayStats: DailyStats) => {
    set({ todayStats });
  },
}));
