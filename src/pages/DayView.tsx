import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Space, Typography, Input, message, Tabs } from 'antd';
import { LeftOutlined, SaveOutlined } from '@ant-design/icons';
import { invoke } from '@tauri-apps/api/tauri';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './DayView.css';

const { Title } = Typography;
const { TextArea } = Input;

export default function DayView() {
  const navigate = useNavigate();
  const { year, month, day } = useParams();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
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
  }, [year, month, day, content]);

  useEffect(() => {
    loadContent();
  }, [year, month, day]);

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
      message.error('加载失败');
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


## 附件

`;
  };

  const handleBackToMonth = () => {
    navigate(`/month/${year}/${month}`);
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
          style={{ minHeight: 'calc(100vh - 300px)' }}
          className="markdown-editor"
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

  return (
    <div className="day-view">
      <div className="day-header">
        <Space>
          <Button onClick={handleBackToMonth} icon={<LeftOutlined />}>
            返回月视图
          </Button>
          <Title level={2} style={{ margin: 0 }}>
            {year} 年 {month} 月 {day} 日
          </Title>
        </Space>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
        >
          保存
        </Button>
      </div>

      <Tabs defaultActiveKey="edit" items={items} />
    </div>
  );
}
