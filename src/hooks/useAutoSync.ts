import { useEffect, useRef, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { message } from 'antd';
import { useConfigStore } from '../store/configStore';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 分钟

interface UseAutoSyncOptions {
  onSyncStart?: () => void;
  onSyncEnd?: () => void;
  onSyncError?: (error: string) => void;
  onConflict?: (files: string[]) => void;
}

export function useAutoSync(options: UseAutoSyncOptions = {}) {
  const { isConfigured, config } = useConfigStore();
  const syncIntervalRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);
  const [conflictFiles, setConflictFiles] = useState<string[]>([]);
  const [showConflictResolver, setShowConflictResolver] = useState(false);

  const checkConflicts = useCallback(async (): Promise<boolean> => {
    try {
      const hasConflicts = await invoke<boolean>('has_conflicts');
      if (hasConflicts) {
        const files = await invoke<string[]>('get_conflict_files');
        if (files.length > 0) {
          setConflictFiles(files);
          setShowConflictResolver(true);
          options.onConflict?.(files);
          return true;
        }
      }
    } catch (error) {
      // 忽略检查冲突时的错误
    }
    return false;
  }, [options]);

  const sync = useCallback(async (silent = false) => {
    if (!isConfigured || !config?.remoteUrl || isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;
    options.onSyncStart?.();

    try {
      // 先拉取
      await invoke('git_pull');

      // 检查是否有冲突
      const hasConflict = await checkConflicts();
      if (hasConflict) {
        // 有冲突时不继续推送，等待用户解决
        return;
      }

      // 没有冲突时推送
      await invoke('git_push');

      if (!silent) {
        message.success('同步成功');
      }
    } catch (error) {
      const errorMsg = String(error);
      // 检查是否因为冲突导致的错误
      if (errorMsg.includes('conflict') || errorMsg.includes('冲突')) {
        await checkConflicts();
      } else if (!silent) {
        message.error(`同步失败: ${errorMsg}`);
      }
      options.onSyncError?.(errorMsg);
    } finally {
      isSyncingRef.current = false;
      options.onSyncEnd?.();
    }
  }, [isConfigured, config?.remoteUrl, options, checkConflicts]);

  const handleConflictResolved = useCallback(() => {
    setShowConflictResolver(false);
    setConflictFiles([]);
    // 冲突解决后继续推送
    invoke('git_push')
      .then(() => message.success('同步成功'))
      .catch((error) => message.error(`推送失败: ${error}`));
  }, []);

  const handleConflictCancel = useCallback(() => {
    setShowConflictResolver(false);
    message.warning('合并已取消，冲突仍未解决');
  }, []);

  // 启动时自动拉取
  useEffect(() => {
    if (isConfigured && config?.remoteUrl) {
      // 延迟 2 秒后拉取，避免影响初始加载
      const timer = setTimeout(() => {
        invoke('git_pull')
          .then(() => checkConflicts())
          .catch(() => {
            // 静默失败
          });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isConfigured, config?.remoteUrl, checkConflicts]);

  // 定时同步
  useEffect(() => {
    if (!isConfigured || !config?.remoteUrl) {
      return;
    }

    syncIntervalRef.current = window.setInterval(() => {
      sync(true); // 静默同步
    }, SYNC_INTERVAL);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [isConfigured, config?.remoteUrl, sync]);

  return {
    sync,
    conflictFiles,
    showConflictResolver,
    handleConflictResolved,
    handleConflictCancel,
  };
}
