import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';

export interface Config {
  localPath: string;
  userName: string;
  userEmail: string;
  remoteUrl?: string;
  token?: string;
  gitProvider: 'github' | 'gitlab' | 'gitee';
  enableGithubPages: boolean;
}

interface ConfigState {
  config: Config | null;
  isConfigured: boolean;
  gitReady: boolean;
  syncVersion: number;
  loadConfig: () => Promise<void>;
  saveConfig: (config: Config) => Promise<void>;
  initGit: (config: Config) => Promise<void>;
  notifySyncComplete: () => void;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  isConfigured: false,
  gitReady: false,
  syncVersion: 0,

  loadConfig: async () => {
    try {
      const config = await invoke<Config | null>('load_config');
      if (config) {
        // 立即设置配置，让 UI 可以加载本地数据
        set({ config, isConfigured: true, gitReady: false });

        // 后台初始化 Git，完成后设置 gitReady
        invoke('init_git', { config })
          .then(() => {
            set({ gitReady: true });
          })
          .catch((error) => {
            console.error('初始化 Git 失败:', error);
            // 即使 Git 初始化失败，也设置 gitReady，让用户可以使用本地数据
            set({ gitReady: true });
          });
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  },

  saveConfig: async (config: Config) => {
    try {
      await invoke('save_config', { config });
      set({ config, isConfigured: true });
    } catch (error) {
      console.error('保存配置失败:', error);
      throw error;
    }
  },

  initGit: async (config: Config) => {
    try {
      set({ gitReady: false });
      await invoke('init_git', { config });
      set({ config, isConfigured: true, gitReady: true });
    } catch (error) {
      console.error('初始化 Git 失败:', error);
      set({ gitReady: true }); // 即使失败也设置为 ready
      throw error;
    }
  },

  notifySyncComplete: () => {
    set((state) => ({ syncVersion: state.syncVersion + 1 }));
  },
}));
