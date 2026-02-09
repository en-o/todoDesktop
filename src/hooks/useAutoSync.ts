import { useEffect, useRef, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { message } from 'antd';
import { useConfigStore } from '../store/configStore';

interface UseAutoSyncOptions {
  onSyncStart?: () => void;
  onSyncEnd?: () => void;
  onSyncError?: (error: string) => void;
  onConflict?: (files: string[]) => void;
}

export function useAutoSync(options: UseAutoSyncOptions = {}) {
  const { isConfigured, config, notifySyncComplete } = useConfigStore();
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

  // 手动同步（点击同步按钮时调用）
  const sync = useCallback(async (silent = false) => {
    if (!isConfigured || !config?.remoteUrl || isSyncingRef.current) {
      return;
    }

    isSyncingRef.current = true;
    options.onSyncStart?.();

    try {
      // 1. 先触发保存事件，让 DayView 保存当前内容
      const savePromise = new Promise<void>((resolve) => {
        const handleSaved = () => {
          window.removeEventListener('dayview-saved', handleSaved);
          resolve();
        };
        window.addEventListener('dayview-saved', handleSaved);
        window.dispatchEvent(new CustomEvent('trigger-save'));

        // 超时后继续（防止卡住）
        setTimeout(resolve, 1000);
      });

      await savePromise;

      // 2. 拉取远程更新
      await invoke('git_pull');

      // 3. 检查是否有冲突
      const hasConflict = await checkConflicts();
      if (hasConflict) {
        return;
      }

      // 4. 推送本地更改
      await invoke('git_push');

      // 5. 同步成功，通知重新加载数据
      notifySyncComplete();

      if (!silent) {
        message.success('同步成功');
      }
    } catch (error) {
      const errorMsg = String(error);
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
  }, [isConfigured, config?.remoteUrl, options, checkConflicts, notifySyncComplete]);

  const handleConflictResolved = useCallback(() => {
    setShowConflictResolver(false);
    setConflictFiles([]);
    invoke('git_push')
      .then(() => {
        notifySyncComplete();
        message.success('同步成功');
      })
      .catch((error) => message.error(`推送失败: ${error}`));
  }, [notifySyncComplete]);

  const handleConflictCancel = useCallback(() => {
    setShowConflictResolver(false);
    message.warning('合并已取消，冲突仍未解决');
  }, []);

  // 启动时自动拉取（只拉取不推送）
  useEffect(() => {
    if (isConfigured && config?.remoteUrl) {
      const timer = setTimeout(() => {
        invoke('git_pull')
          .then(() => {
            notifySyncComplete();
            return checkConflicts();
          })
          .catch(() => {});
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isConfigured, config?.remoteUrl, checkConflicts, notifySyncComplete]);

  return {
    sync,
    conflictFiles,
    showConflictResolver,
    handleConflictResolved,
    handleConflictCancel,
  };
}
