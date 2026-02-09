import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, message } from 'antd';
import { invoke } from '@tauri-apps/api/tauri';
import dayjs from 'dayjs';
import { useConfigStore } from '../store/configStore';
import MarkdownEditor from '../components/MarkdownEditor';
import './DayView.css';

const { Title, Text } = Typography;

export default function DayView() {
  const { date } = useParams<{ date: string }>();
  const { isConfigured, syncVersion, config } = useConfigStore();
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const parsedDate = dayjs(date);
  const year = parsedDate.format('YYYY');
  const month = parsedDate.format('MM');
  const day = parsedDate.format('MM-DD'); // 新格式: mm-dd

  // 文件路径: 年/月/mm-dd.md
  const getFilePath = useCallback(() => {
    return `${year}/${month}/${day}.md`;
  }, [year, month, day]);

  // 同步到远程
  const syncToRemote = useCallback(async () => {
    if (!config?.remoteUrl) return;

    try {
      await invoke('git_push');
    } catch (error) {
      // 静默失败，不影响用户体验
      console.error('同步失败:', error);
    }
  }, [config?.remoteUrl]);

  const handleSave = useCallback(async (silent = false) => {
    if (!isConfigured) {
      if (!silent) {
        message.warning('请先在设置中配置本地数据目录');
      }
      return;
    }

    // 如果没有改动，不需要保存和同步
    if (!isDirty) {
      if (!silent) {
        message.info('没有需要保存的改动');
      }
      return;
    }

    setSaving(true);
    try {
      const filepath = getFilePath();
      await invoke('write_file', { filepath, content });
      setIsDirty(false);

      // 有改动才同步到远程
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
  }, [content, isConfigured, isDirty, getFilePath, syncToRemote]);

  const handleContentChange = useCallback((value: string) => {
    setContent(value);
    setIsDirty(true);
  }, []);

  // 记录上次加载的日期和同步版本，避免重复加载
  const lastLoadedRef = useRef({ date: '', syncVersion: 0 });
  const isDirtyRef = useRef(false);

  // 同步 isDirty 到 ref
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    let cancelled = false;

    const doLoad = async () => {
      if (!isConfigured || !date) {
        setContent(getDefaultContent());
        return;
      }

      const dateChanged = lastLoadedRef.current.date !== date;
      const syncChanged = syncVersion > 0 && lastLoadedRef.current.syncVersion !== syncVersion;

      // 只有日期变化或手动同步完成时才重新加载
      if (!dateChanged && !syncChanged) {
        return;
      }

      if (isDirtyRef.current && !dateChanged) {
        // 有未保存的更改，只更新 syncVersion 记录，不重新加载
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

  // 自动保存: 输入停止 2 秒后自动保存（静默模式）
  useEffect(() => {
    if (!isDirty || !isConfigured) return;

    const timer = setTimeout(() => {
      handleSave(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [content, isDirty, isConfigured, handleSave]);

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
          onSave={handleSave}
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
