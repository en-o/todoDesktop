import { useEffect, useRef, useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { message } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CloseOutlined,
  PaperClipOutlined,
  CheckOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import './MarkdownEditor.css';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave?: () => void;
  disabled?: boolean;
  placeholder?: string;
  year?: string;
  month?: string;
  day?: string;
}

interface TodoItem {
  id: string;
  text: string;
  checked: boolean;
  subContent: string;
  children: TodoItem[];
  collapsed: boolean;
}

interface ParsedContent {
  todos: TodoItem[];
  completed: TodoItem[];
  notes: string;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// 解析 Markdown 内容
function parseContent(content: string): ParsedContent {
  const lines = content.split('\n');
  const todos: TodoItem[] = [];
  const completed: TodoItem[] = [];
  let notes = '';

  let currentSection: 'header' | 'todos' | 'completed' | 'notes' = 'header';
  let currentParent: TodoItem | null = null;
  let currentChild: TodoItem | null = null;
  let inCodeBlock = false;
  let collectingSubContent: 'parent' | 'child' | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
    }

    if (!inCodeBlock) {
      if (line.match(/^##\s*待办事项\s*$/)) {
        saveCurrentItems();
        currentSection = 'todos';
        continue;
      }
      if (line.match(/^##\s*完成事项\s*$/)) {
        saveCurrentItems();
        currentSection = 'completed';
        continue;
      }
      if (line.match(/^##\s*笔记\s*$/)) {
        saveCurrentItems();
        currentSection = 'notes';
        continue;
      }
      if (line.match(/^#\s+\d{4}-\d{2}-\d{2}/)) {
        continue;
      }
    }

    if (currentSection === 'header') continue;

    if (currentSection === 'notes') {
      notes += line + '\n';
      continue;
    }

    if (currentSection === 'todos' || currentSection === 'completed') {
      const parentMatch = !inCodeBlock && line.match(/^-\s*\[([\sx])\]\s*(.*)$/i);
      const childMatch = !inCodeBlock && line.match(/^(\s{2,4})-\s*\[([\sx])\]\s*(.*)$/i);

      if (parentMatch) {
        saveCurrentItems();
        currentParent = {
          id: generateId(),
          checked: parentMatch[1].toLowerCase() === 'x',
          text: parentMatch[2],
          subContent: '',
          children: [],
          collapsed: false,
        };
        collectingSubContent = 'parent';
        currentChild = null;
      } else if (childMatch && currentParent) {
        if (currentChild) {
          currentChild.subContent = currentChild.subContent.trimEnd();
          currentParent.children.push(currentChild);
        }
        currentChild = {
          id: generateId(),
          checked: childMatch[2].toLowerCase() === 'x',
          text: childMatch[3],
          subContent: '',
          children: [],
          collapsed: false,
        };
        collectingSubContent = 'child';
      } else if (currentParent) {
        if (collectingSubContent === 'child' && currentChild) {
          const trimmedLine = line.replace(/^\s{2,4}/, '');
          currentChild.subContent += trimmedLine + '\n';
        } else if (collectingSubContent === 'parent') {
          if (line.match(/^\s{2,4}/) && !childMatch) {
            if (currentParent.children.length === 0 && !currentChild) {
              currentParent.subContent += line.replace(/^\s{2,4}/, '') + '\n';
            }
          } else if (!line.match(/^\s/)) {
            currentParent.subContent += line + '\n';
          }
        }
      }
    }
  }

  function saveCurrentItems() {
    if (currentChild && currentParent) {
      currentChild.subContent = currentChild.subContent.trimEnd();
      currentParent.children.push(currentChild);
      currentChild = null;
    }
    if (currentParent) {
      currentParent.subContent = currentParent.subContent.trimEnd();
      if (currentSection === 'todos') {
        todos.push(currentParent);
      } else if (currentSection === 'completed') {
        completed.push(currentParent);
      }
      currentParent = null;
    }
    collectingSubContent = null;
  }

  saveCurrentItems();
  return { todos, completed, notes: notes.trimEnd() };
}

function itemToMarkdown(item: TodoItem, indent: string = ''): string {
  const checkbox = item.checked ? '- [x]' : '- [ ]';
  let result = `${indent}${checkbox} ${item.text}`;

  if (item.subContent.trim()) {
    const subLines = item.subContent.split('\n');
    for (const line of subLines) {
      result += '\n' + indent + (indent ? '' : '  ') + line;
    }
  }

  for (const child of item.children) {
    result += '\n' + itemToMarkdown(child, indent + '  ');
  }

  return result;
}

function processNotesContent(notes: string): string {
  const lines = notes.split('\n');
  const result: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      result.push(line);
      continue;
    }
    if (inCodeBlock) {
      result.push(line);
      continue;
    }
    if (line.match(/^##\s+/)) {
      result.push('#' + line);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

function buildMarkdown(dateStr: string, todos: TodoItem[], completed: TodoItem[], notes: string): string {
  let content = `# ${dateStr}\n\n## 待办事项\n`;

  if (todos.length > 0) {
    content += todos.map(item => itemToMarkdown(item)).join('\n') + '\n';
  } else {
    content += '\n';
  }

  content += '\n## 完成事项\n';

  if (completed.length > 0) {
    content += completed.map(item => itemToMarkdown(item)).join('\n') + '\n';
  } else {
    content += '\n';
  }

  content += '\n## 笔记\n';

  if (notes.trim()) {
    const processedNotes = processNotesContent(notes.trim());
    content += processedNotes + '\n';
  } else {
    content += '\n';
  }

  return content;
}

export default function MarkdownEditor({
  value,
  onChange,
  onSave,
  disabled = false,
  year,
  month,
  day,
}: MarkdownEditorProps) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [completed, setCompleted] = useState<TodoItem[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTodoText, setNewTodoText] = useState('');
  const [activeTab, setActiveTab] = useState<'todos' | 'completed' | 'notes'>('todos');
  const [isDragging, setIsDragging] = useState(false);

  const dateStr = year && day ? `${year}-${day}` : '';
  const isEditingRef = useRef(false);
  const lastDateRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取选中的任务
  const selectedTodo = todos.find(t => t.id === selectedId) ||
                       completed.find(t => t.id === selectedId) ||
                       todos.flatMap(t => t.children).find(t => t.id === selectedId) ||
                       completed.flatMap(t => t.children).find(t => t.id === selectedId);

  const isSelectedCompleted = completed.some(t => t.id === selectedId) ||
                              completed.some(t => t.children.some(c => c.id === selectedId));

  // 找到选中项的父级 ID
  const findParentId = (id: string): string | undefined => {
    for (const todo of [...todos, ...completed]) {
      if (todo.children.some(c => c.id === id)) {
        return todo.id;
      }
    }
    return undefined;
  };

  const selectedParentId = selectedId ? findParentId(selectedId) : undefined;

  useEffect(() => {
    if (!dateStr) return;
    if (isEditingRef.current && lastDateRef.current === dateStr) return;

    lastDateRef.current = dateStr;

    if (value) {
      const parsed = parseContent(value);
      setTodos(parsed.todos);
      setCompleted(parsed.completed);
      setNotes(parsed.notes);
    } else {
      setTodos([]);
      setCompleted([]);
      setNotes('');
    }
    setSelectedId(null);
  }, [dateStr, value]);

  const syncToParent = useCallback((newTodos: TodoItem[], newCompleted: TodoItem[], newNotes: string) => {
    if (!dateStr) return;
    isEditingRef.current = true;
    const markdown = buildMarkdown(dateStr, newTodos, newCompleted, newNotes);
    onChange(markdown);
    setTimeout(() => {
      isEditingRef.current = false;
    }, 100);
  }, [dateStr, onChange]);

  // 切换 checkbox 状态
  const toggleTodo = useCallback((id: string, isCompleted: boolean, parentId?: string) => {
    if (isCompleted) {
      if (parentId) {
        const newCompleted = completed.map(parent => {
          if (parent.id === parentId) {
            return {
              ...parent,
              children: parent.children.map(child =>
                child.id === id ? { ...child, checked: !child.checked } : child
              ),
            };
          }
          return parent;
        });
        setCompleted(newCompleted);
        syncToParent(todos, newCompleted, notes);
      } else {
        const item = completed.find(t => t.id === id);
        if (item) {
          const newItem = { ...item, checked: false };
          const newCompleted = completed.filter(t => t.id !== id);
          const newTodos = [...todos, newItem];
          setCompleted(newCompleted);
          setTodos(newTodos);
          syncToParent(newTodos, newCompleted, notes);
        }
      }
    } else {
      if (parentId) {
        const newTodos = todos.map(parent => {
          if (parent.id === parentId) {
            return {
              ...parent,
              children: parent.children.map(child =>
                child.id === id ? { ...child, checked: !child.checked } : child
              ),
            };
          }
          return parent;
        });
        setTodos(newTodos);
        syncToParent(newTodos, completed, notes);
      } else {
        const item = todos.find(t => t.id === id);
        if (item) {
          const newItem = { ...item, checked: true };
          const newTodos = todos.filter(t => t.id !== id);
          const newCompleted = [...completed, newItem];
          setTodos(newTodos);
          setCompleted(newCompleted);
          if (selectedId === id) setSelectedId(null);
          syncToParent(newTodos, newCompleted, notes);
        }
      }
    }
  }, [todos, completed, notes, selectedId, syncToParent]);

  // 添加新 todo
  const addTodo = useCallback(() => {
    if (!newTodoText.trim()) return;

    const newItem: TodoItem = {
      id: generateId(),
      text: newTodoText.trim(),
      checked: false,
      subContent: '',
      children: [],
      collapsed: false,
    };

    const newTodos = [...todos, newItem];
    setTodos(newTodos);
    setNewTodoText('');
    syncToParent(newTodos, completed, notes);
  }, [newTodoText, todos, completed, notes, syncToParent]);

  // 添加子步骤
  const addStep = useCallback((parentId: string) => {
    const newChild: TodoItem = {
      id: generateId(),
      text: '',
      checked: false,
      subContent: '',
      children: [],
      collapsed: false,
    };

    const isInCompleted = completed.some(t => t.id === parentId);

    if (isInCompleted) {
      const newCompleted = completed.map(parent => {
        if (parent.id === parentId) {
          return { ...parent, children: [...parent.children, newChild] };
        }
        return parent;
      });
      setCompleted(newCompleted);
      syncToParent(todos, newCompleted, notes);
    } else {
      const newTodos = todos.map(parent => {
        if (parent.id === parentId) {
          return { ...parent, children: [...parent.children, newChild] };
        }
        return parent;
      });
      setTodos(newTodos);
      syncToParent(newTodos, completed, notes);
    }
  }, [todos, completed, notes, syncToParent]);

  // 更新任务文本
  const updateTodoText = useCallback((id: string, text: string, isCompleted: boolean, parentId?: string) => {
    if (isCompleted) {
      if (parentId) {
        const newCompleted = completed.map(parent => {
          if (parent.id === parentId) {
            return {
              ...parent,
              children: parent.children.map(child =>
                child.id === id ? { ...child, text } : child
              ),
            };
          }
          return parent;
        });
        setCompleted(newCompleted);
        syncToParent(todos, newCompleted, notes);
      } else {
        const newCompleted = completed.map(t => t.id === id ? { ...t, text } : t);
        setCompleted(newCompleted);
        syncToParent(todos, newCompleted, notes);
      }
    } else {
      if (parentId) {
        const newTodos = todos.map(parent => {
          if (parent.id === parentId) {
            return {
              ...parent,
              children: parent.children.map(child =>
                child.id === id ? { ...child, text } : child
              ),
            };
          }
          return parent;
        });
        setTodos(newTodos);
        syncToParent(newTodos, completed, notes);
      } else {
        const newTodos = todos.map(t => t.id === id ? { ...t, text } : t);
        setTodos(newTodos);
        syncToParent(newTodos, completed, notes);
      }
    }
  }, [todos, completed, notes, syncToParent]);

  // 更新备注
  const updateTodoSubContent = useCallback((id: string, subContent: string, isCompleted: boolean, parentId?: string) => {
    if (isCompleted) {
      if (parentId) {
        const newCompleted = completed.map(parent => {
          if (parent.id === parentId) {
            return {
              ...parent,
              children: parent.children.map(child =>
                child.id === id ? { ...child, subContent } : child
              ),
            };
          }
          return parent;
        });
        setCompleted(newCompleted);
        syncToParent(todos, newCompleted, notes);
      } else {
        const newCompleted = completed.map(t => t.id === id ? { ...t, subContent } : t);
        setCompleted(newCompleted);
        syncToParent(todos, newCompleted, notes);
      }
    } else {
      if (parentId) {
        const newTodos = todos.map(parent => {
          if (parent.id === parentId) {
            return {
              ...parent,
              children: parent.children.map(child =>
                child.id === id ? { ...child, subContent } : child
              ),
            };
          }
          return parent;
        });
        setTodos(newTodos);
        syncToParent(newTodos, completed, notes);
      } else {
        const newTodos = todos.map(t => t.id === id ? { ...t, subContent } : t);
        setTodos(newTodos);
        syncToParent(newTodos, completed, notes);
      }
    }
  }, [todos, completed, notes, syncToParent]);

  // 删除任务
  const deleteTodo = useCallback((id: string, isCompleted: boolean, parentId?: string) => {
    if (isCompleted) {
      if (parentId) {
        const newCompleted = completed.map(parent => {
          if (parent.id === parentId) {
            return { ...parent, children: parent.children.filter(child => child.id !== id) };
          }
          return parent;
        });
        setCompleted(newCompleted);
        syncToParent(todos, newCompleted, notes);
      } else {
        const newCompleted = completed.filter(t => t.id !== id);
        setCompleted(newCompleted);
        syncToParent(todos, newCompleted, notes);
      }
    } else {
      if (parentId) {
        const newTodos = todos.map(parent => {
          if (parent.id === parentId) {
            return { ...parent, children: parent.children.filter(child => child.id !== id) };
          }
          return parent;
        });
        setTodos(newTodos);
        syncToParent(newTodos, completed, notes);
      } else {
        const newTodos = todos.filter(t => t.id !== id);
        setTodos(newTodos);
        syncToParent(newTodos, completed, notes);
      }
    }
    if (selectedId === id) setSelectedId(null);
  }, [todos, completed, notes, selectedId, syncToParent]);

  // 更新笔记
  const updateNotes = useCallback((newNotes: string) => {
    setNotes(newNotes);
    syncToParent(todos, completed, newNotes);
  }, [todos, completed, syncToParent]);

  // 文件上传处理
  const handleFileUpload = useCallback(async (files: FileList | File[]) => {
    if (!year || !month || !day || !selectedTodo) {
      message.error('请先选择一个任务');
      return;
    }

    const fileArray = Array.from(files);
    const results: string[] = [];

    for (const file of fileArray) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const data = Array.from(new Uint8Array(arrayBuffer));
        const filename = `${day}-${Date.now()}-${file.name}`;

        const relativePath = await invoke<string>('upload_attachment', {
          year,
          month,
          filename,
          data,
        });

        if (file.type.startsWith('image/')) {
          results.push(`![${file.name}](${relativePath})`);
        } else {
          results.push(`[${file.name}](${relativePath})`);
        }
      } catch (error) {
        message.error(`上传 ${file.name} 失败: ${error}`);
      }
    }

    if (results.length > 0) {
      const insertText = results.join('\n');
      const currentContent = selectedTodo.subContent || '';
      const newContent = currentContent + (currentContent ? '\n' : '') + insertText;
      updateTodoSubContent(selectedTodo.id, newContent, isSelectedCompleted, selectedParentId);
      message.success(`已上传 ${results.length} 个文件`);
    }
  }, [year, month, day, selectedTodo, isSelectedCompleted, selectedParentId, updateTodoSubContent]);

  // 拖拽事件处理
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files);
    }
  }, [handleFileUpload]);

  // 渲染任务列表项
  const renderTaskItem = (item: TodoItem, isCompleted: boolean, parentId?: string) => {
    const isSelected = selectedId === item.id;
    const completedChildren = item.children.filter(c => c.checked).length;
    const totalChildren = item.children.length;

    return (
      <div
        key={item.id}
        className={`task-item ${isSelected ? 'selected' : ''} ${isCompleted ? 'completed' : ''}`}
        onClick={() => setSelectedId(item.id)}
      >
        <div
          className="task-checkbox"
          onClick={(e) => {
            e.stopPropagation();
            toggleTodo(item.id, isCompleted, parentId);
          }}
        >
          {item.checked ? <CheckOutlined /> : <div className="checkbox-empty" />}
        </div>
        <div className="task-content">
          <span className={`task-text ${item.checked ? 'checked' : ''}`}>
            {item.text || '无标题'}
          </span>
          {totalChildren > 0 && (
            <span className="task-steps-count">
              {completedChildren}/{totalChildren} 步骤
            </span>
          )}
          {item.subContent && (
            <span className="task-has-note">
              <PaperClipOutlined />
            </span>
          )}
        </div>
      </div>
    );
  };

  // 渲染详情面板
  const renderDetailPanel = () => {
    if (!selectedTodo) return null;

    const parentTodo = selectedParentId
      ? [...todos, ...completed].find(t => t.id === selectedParentId)
      : null;

    return (
      <div
        className={`detail-panel ${isDragging ? 'dragging' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="detail-header">
          <div
            className="detail-checkbox"
            onClick={() => toggleTodo(selectedTodo.id, isSelectedCompleted, selectedParentId)}
          >
            {selectedTodo.checked ? <CheckOutlined /> : <div className="checkbox-empty" />}
          </div>
          <input
            type="text"
            className={`detail-title ${selectedTodo.checked ? 'checked' : ''}`}
            value={selectedTodo.text}
            onChange={(e) => updateTodoText(selectedTodo.id, e.target.value, isSelectedCompleted, selectedParentId)}
            placeholder="任务标题"
            disabled={disabled}
          />
          <button className="close-btn" onClick={() => setSelectedId(null)}>
            <CloseOutlined />
          </button>
        </div>

        {/* 子步骤 - 只有父级任务才显示 */}
        {!selectedParentId && (
          <div className="detail-section">
            <div className="section-label">
              <UnorderedListOutlined /> 步骤
            </div>
            <div className="steps-list">
              {selectedTodo.children.map(child => (
                <div key={child.id} className="step-item">
                  <div
                    className="step-checkbox"
                    onClick={() => toggleTodo(child.id, isSelectedCompleted, selectedTodo.id)}
                  >
                    {child.checked ? <CheckOutlined /> : <div className="checkbox-empty" />}
                  </div>
                  <input
                    type="text"
                    className={`step-text ${child.checked ? 'checked' : ''}`}
                    value={child.text}
                    onChange={(e) => updateTodoText(child.id, e.target.value, isSelectedCompleted, selectedTodo.id)}
                    placeholder="步骤内容"
                    disabled={disabled}
                  />
                  <button
                    className="step-delete"
                    onClick={() => deleteTodo(child.id, isSelectedCompleted, selectedTodo.id)}
                  >
                    <DeleteOutlined />
                  </button>
                </div>
              ))}
              <button
                className="add-step-btn"
                onClick={() => addStep(selectedTodo.id)}
                disabled={disabled}
              >
                <PlusOutlined /> 添加步骤
              </button>
            </div>
          </div>
        )}

        {/* 备注/附件 */}
        <div className="detail-section">
          <div className="section-label">
            <PaperClipOutlined /> 备注 & 附件
            <button
              className="upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              上传文件
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
          </div>
          <textarea
            className="detail-notes"
            value={selectedTodo.subContent}
            onChange={(e) => updateTodoSubContent(selectedTodo.id, e.target.value, isSelectedCompleted, selectedParentId)}
            placeholder="添加备注...&#10;支持 Markdown 格式，可拖拽文件到此处上传"
            disabled={disabled}
          />
        </div>

        {/* 删除按钮 */}
        <div className="detail-footer">
          <button
            className="delete-task-btn"
            onClick={() => deleteTodo(selectedTodo.id, isSelectedCompleted, selectedParentId)}
            disabled={disabled}
          >
            <DeleteOutlined /> 删除任务
          </button>
        </div>

        {isDragging && (
          <div className="drop-overlay">
            <PaperClipOutlined />
            <span>放开以上传文件</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="todo-editor">
      {/* 左侧主面板 */}
      <div className="main-panel">
        {/* 标签切换 */}
        <div className="tab-bar">
          <button
            className={`tab-btn ${activeTab === 'todos' ? 'active' : ''}`}
            onClick={() => setActiveTab('todos')}
          >
            待办事项
            {todos.length > 0 && <span className="tab-count">{todos.length}</span>}
          </button>
          <button
            className={`tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
            onClick={() => setActiveTab('completed')}
          >
            已完成
            {completed.length > 0 && <span className="tab-count completed">{completed.length}</span>}
          </button>
          <button
            className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => { setActiveTab('notes'); setSelectedId(null); }}
          >
            笔记
          </button>
        </div>

        {/* 任务列表 */}
        <div className="task-list">
          {activeTab === 'todos' && (
            <>
              {todos.length === 0 ? (
                <div className="empty-list">
                  <CheckOutlined />
                  <p>暂无待办事项</p>
                  <span>在下方添加新任务</span>
                </div>
              ) : (
                todos.map(item => renderTaskItem(item, false))
              )}
            </>
          )}

          {activeTab === 'completed' && (
            <>
              {completed.length === 0 ? (
                <div className="empty-list">
                  <CheckOutlined />
                  <p>暂无已完成事项</p>
                </div>
              ) : (
                completed.map(item => renderTaskItem(item, true))
              )}
            </>
          )}

          {activeTab === 'notes' && (
            <div className="notes-editor">
              <textarea
                value={notes}
                onChange={(e) => updateNotes(e.target.value)}
                placeholder="在这里记录笔记...&#10;支持 Markdown 格式"
                disabled={disabled}
                onKeyDown={(e) => {
                  if (e.key === 's' && e.ctrlKey) {
                    e.preventDefault();
                    onSave?.();
                  }
                }}
              />
            </div>
          )}
        </div>

        {/* 底部添加任务 */}
        {activeTab === 'todos' && (
          <div className="add-task-bar">
            <PlusOutlined />
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTodoText.trim()) {
                  addTodo();
                }
              }}
              placeholder="添加任务"
              disabled={disabled}
            />
            {newTodoText.trim() && (
              <button className="add-btn" onClick={addTodo} disabled={disabled}>
                添加
              </button>
            )}
          </div>
        )}
      </div>

      {/* 右侧详情面板 */}
      {selectedId && activeTab !== 'notes' && renderDetailPanel()}
    </div>
  );
}
