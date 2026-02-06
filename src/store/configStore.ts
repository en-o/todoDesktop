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
  loadConfig: () => Promise<void>;
  saveConfig: (config: Config) => Promise<void>;
  initGit: (config: Config) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  isConfigured: false,

  loadConfig: async () => {
    try {
      const config = await invoke<Config | null>('load_config');
      if (config) {
        set({ config, isConfigured: true });
        // 如果已配置，初始化 Git
        await invoke('init_git', { config });
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
      await invoke('init_git', { config });
      set({ config, isConfigured: true });
    } catch (error) {
      console.error('初始化 Git 失败:', error);
      throw error;
    }
  },
}));
