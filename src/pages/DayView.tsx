import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, message } from 'antd';
import { invoke } from '@tauri-apps/api/tauri';
import dayjs from 'dayjs';
import { useConfigStore } from '../store/configStore';
import { usePastUncompletedStore } from '../store/pastUncompletedStore';
import MarkdownEditor from '../components/MarkdownEditor';
import './DayView.css';

const { Title, Text } = Typography;

// 无操作自动保存时间（3分钟）
const IDLE_SAVE_TIMEOUT = 3 * 60 * 1000;

export default function DayView() {
  const { date } = useParams<{ date: string }>();
  const { isConfigured, syncVersion, config } = useConfigStore();
  const { executePendingDeletions } = usePastUncompletedStore();
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const parsedDate = dayjs(date);
  const year = parsedDate.format('YYYY');
  const month = parsedDate.format('MM');
  const day = parsedDate.format('MM-DD');

  // refs
  const lastLoadedRef = useRef({ date: '', syncVersion: 0 });
  const isDirtyRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contentRef = useRef(content);

  // 同步 refs
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // 日期变化时立即清空内容，避免显示旧数据
  const lastDateRef = useRef(date);
  useEffect(() => {
    if (date !== lastDateRef.current) {
      setContent('');
      setIsDirty(false);
      lastDateRef.current = date;
    }
  }, [date]);

  // 文件路径
  const getFilePath = useCallback(() => {
    return `${year}/${month}/${day}.md`;
  }, [year, month, day]);

  // 同步到远程（git push）
  const syncToRemote = useCallback(async () => {
    if (!config?.remoteUrl) return;

    try {
      await invoke('git_push');
    } catch (error) {
      console.error('同步失败:', error);
    }
  }, [config?.remoteUrl]);

  // 保存并同步（主动保存时使用）
  const handleSave = useCallback(async (silent = false) => {
    if (!isConfigured) {
      if (!silent) {
        message.warning('请先在设置中配置本地数据目录');
      }
      return;
    }

    if (!isDirtyRef.current) {
      if (!silent) {
        message.info('没有需要保存的改动');
      }
      return;
    }

    setSaving(true);
    try {
      const filepath = getFilePath();
      await invoke('write_file', { filepath, content: contentRef.current });
      setIsDirty(false);

      // 触发统计更新
      window.dispatchEvent(new CustomEvent('save-stats'));

      // 执行待删除的往期任务（移动到今日后删除原任务）
      executePendingDeletions();

      // 同步到远程
      await syncToRemote();

      if (!silent) {
        message.success('保存成功');
      }
    } catch (error) {
      if (!silent) {
        message.error(`保存失败: ${error}`);
      }
    } finally {
      setSaving(false);
    }
  }, [isConfigured, getFilePath, syncToRemote, executePendingDeletions]);

  // 记录用户活动
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // 内容变化处理
  const handleContentChange = useCallback((value: string) => {
    setContent(value);
    setIsDirty(true);
    recordActivity();
  }, [recordActivity]);

  // 加载数据
  useEffect(() => {
    let cancelled = false;

    const doLoad = async () => {
      if (!isConfigured || !date) {
        setContent(getDefaultContent());
        return;
      }

      const dateChanged = lastLoadedRef.current.date !== date;
      const syncChanged = syncVersion > 0 && lastLoadedRef.current.syncVersion !== syncVersion;

      if (!dateChanged && !syncChanged) {
        return;
      }

      if (isDirtyRef.current && !dateChanged) {
        lastLoadedRef.current.syncVersion = syncVersion;
        return;
      }

      try {
        const filepath = getFilePath();
        const data = await invoke<string>('read_file', { filepath });
        if (!cancelled) {
          setContent(data || getDefaultContent());
          setIsDirty(false);
          lastLoadedRef.current = { date, syncVersion };
        }
      } catch (error) {
        if (!cancelled) {
          setContent(getDefaultContent());
          lastLoadedRef.current = { date, syncVersion };
        }
      }
    };

    doLoad();

    return () => {
      cancelled = true;
    };
  }, [date, isConfigured, syncVersion, getFilePath]);

  // 快捷键 Ctrl+S 保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // 监听外部触发的保存事件（同步按钮点击时）
  useEffect(() => {
    const handleTriggerSave = async () => {
      if (isDirtyRef.current && isConfigured) {
        try {
          const filepath = getFilePath();
          await invoke('write_file', { filepath, content: contentRef.current });
          setIsDirty(false);
          // 执行待删除的往期任务
          executePendingDeletions();
        } catch (error) {
          console.error('保存失败:', error);
        }
      }
      // 通知保存完成
      window.dispatchEvent(new CustomEvent('dayview-saved'));
    };

    window.addEventListener('trigger-save', handleTriggerSave);
    return () => window.removeEventListener('trigger-save', handleTriggerSave);
  }, [isConfigured, getFilePath, executePendingDeletions]);

  // 3分钟无操作自动保存
  useEffect(() => {
    if (!isConfigured) return;

    const checkIdle = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;

      if (timeSinceLastActivity >= IDLE_SAVE_TIMEOUT && isDirtyRef.current) {
        // 3分钟无操作且有未保存的更改，自动保存
        handleSave(true);
      }
    };

    // 每30秒检查一次
    idleTimerRef.current = setInterval(checkIdle, 30000);

    return () => {
      if (idleTimerRef.current) {
        clearInterval(idleTimerRef.current);
      }
    };
  }, [isConfigured, handleSave]);

  // 页面卸载前保存
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirtyRef.current && isConfigured) {
        // 尝试同步保存（可能不会完成，但尝试一下）
        const filepath = getFilePath();
        invoke('write_file', { filepath, content: contentRef.current }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isConfigured, getFilePath]);

  const getDefaultContent = () => {
    return `# ${parsedDate.format('YYYY-MM-DD')}

## 待办事项

- [ ]

## 完成事项


## 笔记

`;
  };

  const weekday = ['日', '一', '二', '三', '四', '五', '六'][parsedDate.day()];

  return (
    <div className="day-view">
      <div className="day-header">
        <div className="day-title">
          <Title level={4} style={{ margin: 0 }}>
            {parsedDate.format('M月D日')}
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 14 }}>
              星期{weekday}
            </Text>
          </Title>
        </div>
        <div className="day-status">
          {saving && <Text type="secondary">保存中...</Text>}
          {isDirty && !saving && <Text type="warning">未保存</Text>}
          {!isDirty && !saving && isConfigured && <Text type="success">已保存</Text>}
        </div>
      </div>

      <div className="editor-container">
        <MarkdownEditor
          value={content}
          onChange={handleContentChange}
          onSave={() => handleSave(false)}
          disabled={!isConfigured}
          placeholder="开始编写今天的待办事项..."
          year={year}
          month={month}
          day={day}
        />
      </div>
    </div>
  );
}
