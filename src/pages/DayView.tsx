import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Typography, Input, message, Tabs, Spin } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/tauri';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import dayjs from 'dayjs';
import { useConfigStore } from '../store/configStore';
import './DayView.css';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function DayView() {
  const { date } = useParams<{ date: string }>();
  const { isConfigured } = useConfigStore();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const parsedDate = dayjs(date);
  const year = parsedDate.format('YYYY');
  const month = parsedDate.format('MM');
  const day = parsedDate.format('DD');

  const handleSave = useCallback(async () => {
    if (!isConfigured) {
      message.warning('请先在设置中配置本地数据目录');
      return;
    }

    setSaving(true);
    try {
      const filepath = `${year}/${month}/${day}.md`;
      await invoke('write_file', { filepath, content });
      message.success('保存成功');
    } catch (error) {
      message.error(`保存失败: ${error}`);
    } finally {
      setSaving(false);
    }
  }, [year, month, day, content, isConfigured]);

  useEffect(() => {
    if (isConfigured && date) {
      loadContent();
    } else {
      setContent(getDefaultContent());
    }
  }, [date, isConfigured]);

  // 快捷键 Ctrl+S 保存
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const filepath = `${year}/${month}/${day}.md`;
      const data = await invoke<string>('read_file', { filepath });
      setContent(data || getDefaultContent());
    } catch (error) {
      setContent(getDefaultContent());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultContent = () => {
    return `# ${year}-${month}-${day}

## 待办事项

- [ ]

## 笔记



`;
  };

  const items = [
    {
      key: 'edit',
      label: '编辑',
      children: (
        <TextArea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="使用 Markdown 格式编写..."
          className="markdown-editor"
          disabled={!isConfigured}
        />
      ),
    },
    {
      key: 'preview',
      label: '预览',
      children: (
        <div className="markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content}
          </ReactMarkdown>
        </div>
      ),
    },
  ];

  const weekday = ['日', '一', '二', '三', '四', '五', '六'][parsedDate.day()];

  return (
    <div className="day-view">
      <div className="day-header">
        <div className="day-title">
          <Title level={3} style={{ margin: 0 }}>
            {parsedDate.format('YYYY年M月D日')}
          </Title>
          <Text type="secondary">星期{weekday}</Text>
        </div>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
          disabled={!isConfigured}
        >
          保存
        </Button>
      </div>

      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
        <Tabs defaultActiveKey="edit" items={items} className="editor-tabs" />
      )}
    </div>
  );
}
