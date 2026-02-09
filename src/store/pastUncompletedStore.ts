import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';

export interface PastUncompletedTask {
  sourceDate: string;
  text: string;
  id: string;
}

interface PastUncompleted {
  dismissed: string[];
  lastChecked: string;
}

interface PastUncompletedState {
  tasks: PastUncompletedTask[];
  dismissed: string[];
  loading: boolean;
  lastChecked: string;

  // 扫描往期未完成任务
  scanTasks: () => Promise<void>;

  // 忽略任务（不再提示）
  dismissTask: (id: string) => Promise<void>;

  // 删除任务（从源文件删除）
  deleteTask: (task: PastUncompletedTask) => Promise<void>;

  // 加入当日后从列表移除
  removeFromList: (id: string) => void;

  // 清空任务列表
  clearTasks: () => void;
}

export const usePastUncompletedStore = create<PastUncompletedState>((set, get) => ({
  tasks: [],
  dismissed: [],
  loading: false,
  lastChecked: '',

  scanTasks: async () => {
    set({ loading: true });
    try {
      const tasks = await invoke<PastUncompletedTask[]>('scan_past_uncompleted');
      const data = await invoke<PastUncompleted>('load_past_uncompleted');
      set({
        tasks,
        dismissed: data.dismissed || [],
        lastChecked: data.lastChecked || '',
      });
    } catch (error) {
      console.error('扫描往期未完成任务失败:', error);
    } finally {
      set({ loading: false });
    }
  },

  dismissTask: async (id: string) => {
    const { dismissed } = get();
    const newDismissed = [...dismissed, id];
    const today = new Date().toISOString().split('T')[0];

    try {
      await invoke('save_past_uncompleted', {
        data: {
          dismissed: newDismissed,
          lastChecked: today,
        },
      });

      set((state) => ({
        dismissed: newDismissed,
        tasks: state.tasks.filter((t) => t.id !== id),
        lastChecked: today,
      }));
    } catch (error) {
      console.error('忽略任务失败:', error);
    }
  },

  deleteTask: async (task: PastUncompletedTask) => {
    try {
      await invoke('delete_past_task', {
        sourceDate: task.sourceDate,
        text: task.text,
      });

      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== task.id),
      }));
    } catch (error) {
      console.error('删除任务失败:', error);
      throw error;
    }
  },

  removeFromList: (id: string) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));
  },

  clearTasks: () => {
    set({ tasks: [] });
  },
}));
