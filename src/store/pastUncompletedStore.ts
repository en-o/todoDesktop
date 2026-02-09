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
  processingIds: Set<string>; // 正在处理的任务ID
  pendingDeletions: PastUncompletedTask[]; // 待删除的任务（等待今日保存后删除）

  // 扫描往期未完成任务
  scanTasks: () => Promise<void>;

  // 忽略任务（不再提示）
  dismissTask: (task: PastUncompletedTask) => Promise<void>;

  // 删除任务（从源文件删除）
  deleteTask: (task: PastUncompletedTask) => Promise<void>;

  // 标记任务待删除（移动到今日后，等保存完成再删除）
  markForDeletion: (task: PastUncompletedTask) => void;

  // 执行待删除的任务删除（今日保存完成后调用）
  executePendingDeletions: () => Promise<void>;

  // 加入当日后从列表移除
  removeFromList: (id: string) => void;

  // 清空任务列表
  clearTasks: () => void;

  // 检查是否正在处理
  isProcessing: (id: string) => boolean;
}

export const usePastUncompletedStore = create<PastUncompletedState>((set, get) => ({
  tasks: [],
  dismissed: [],
  loading: false,
  lastChecked: '',
  processingIds: new Set(),
  pendingDeletions: [] as PastUncompletedTask[], // 待删除的任务

  isProcessing: (id: string) => get().processingIds.has(id),

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

  dismissTask: async (task: PastUncompletedTask) => {
    const { dismissed, processingIds } = get();

    // 添加到处理中
    const newProcessingIds = new Set(processingIds);
    newProcessingIds.add(task.id);
    set({ processingIds: newProcessingIds });

    // 先从列表移除（立即响应）
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== task.id),
    }));

    const newDismissed = [...dismissed, task.id];
    const today = new Date().toISOString().split('T')[0];

    try {
      await invoke('save_past_uncompleted', {
        data: {
          dismissed: newDismissed,
          lastChecked: today,
        },
      });

      set({
        dismissed: newDismissed,
        lastChecked: today,
      });
    } catch (error) {
      console.error('忽略任务失败:', error);
      // 恢复到列表
      set((state) => ({
        tasks: [...state.tasks, task],
      }));
    } finally {
      // 从处理中移除
      set((state) => {
        const updated = new Set(state.processingIds);
        updated.delete(task.id);
        return { processingIds: updated };
      });
    }
  },

  deleteTask: async (task: PastUncompletedTask) => {
    const { processingIds } = get();

    // 添加到处理中
    const newProcessingIds = new Set(processingIds);
    newProcessingIds.add(task.id);
    set({ processingIds: newProcessingIds });

    // 先从列表移除（立即响应）
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== task.id),
    }));

    try {
      await invoke('delete_past_task', {
        sourceDate: task.sourceDate,
        text: task.text,
      });
    } catch (error) {
      console.error('删除任务失败:', error);
      // 恢复到列表
      set((state) => ({
        tasks: [...state.tasks, task],
      }));
      throw error;
    } finally {
      // 从处理中移除
      set((state) => {
        const updated = new Set(state.processingIds);
        updated.delete(task.id);
        return { processingIds: updated };
      });
    }
  },

  // 标记任务待删除（移动到今日后调用，等保存完成再真正删除）
  markForDeletion: (task: PastUncompletedTask) => {
    // 从列表移除
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== task.id),
      pendingDeletions: [...state.pendingDeletions, task],
    }));
  },

  // 执行所有待删除的任务删除（今日保存完成后调用）
  executePendingDeletions: async () => {
    const { pendingDeletions } = get();
    if (pendingDeletions.length === 0) return;

    // 清空待删除列表
    set({ pendingDeletions: [] });

    // 逐个删除
    for (const task of pendingDeletions) {
      try {
        await invoke('delete_past_task', {
          sourceDate: task.sourceDate,
          text: task.text,
        });
      } catch (error) {
        console.error('删除原任务失败:', task.text, error);
      }
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
