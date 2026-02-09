import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/tauri';
import { message } from 'antd';
import { useConfigStore } from '../store/configStore';
import {
  PlusOutlined,
  DeleteOutlined,
  CloseOutlined,
  PaperClipOutlined,
  CheckOutlined,
  UnorderedListOutlined,
  EyeOutlined,
  EditOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  // 统一处理换行符，移除 \r
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedContent.split('\n');
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
      // 允许行首有少量空格（但不是缩进的子项）
      const parentMatch = !inCodeBlock && line.match(/^\s{0,1}-\s*\[([\sx])\]\s*(.*)$/i);
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

// 处理笔记内容：将 ## 标题转为 ### 标题（确保最多三级标题）
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
    // 将 # 或 ## 转换为 ###
    if (line.match(/^#{1,2}\s+/)) {
      result.push(line.replace(/^#{1,2}/, '###'));
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

// 过滤备注中的标题（不允许任何标题）
function filterSubContent(content: string): string {
  const lines = content.split('\n');
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
    // 移除标题语法，保留内容
    if (line.match(/^#{1,6}\s+/)) {
      result.push(line.replace(/^#{1,6}\s+/, ''));
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

// 可排序的任务项组件
function SortableTaskItem({
  item,
  isCompleted,
  isSelected,
  onSelect,
  onToggle,
}: {
  item: TodoItem;
  isCompleted: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const completedChildren = item.children.filter(c => c.checked).length;
  const totalChildren = item.children.length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-item ${isSelected ? 'selected' : ''} ${isCompleted ? 'completed' : ''}`}
      onClick={onSelect}
    >
      <div className="drag-handle" {...attributes} {...listeners}>
        <HolderOutlined />
      </div>
      <div
        className="task-checkbox"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
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
  const { config } = useConfigStore();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [completed, setCompleted] = useState<TodoItem[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTodoText, setNewTodoText] = useState('');
  const [activeTab, setActiveTab] = useState<'todos' | 'completed' | 'notes'>('todos');
  const [isDragging, setIsDragging] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [detailPreviewMode, setDetailPreviewMode] = useState(false);

  const dateStr = year && day ? `${year}-${day}` : '';
  const isEditingRef = useRef(false);
  const lastParsedRef = useRef({ dateStr: '', valueHash: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 计算简单的内容哈希（用于判断内容是否真的变化）
  const getValueHash = (v: string) => v ? `${v.length}-${v.substring(0, 50)}` : '';

  // 只在日期变化或内容首次加载时解析
  useEffect(() => {
    if (!dateStr) return;

    const currentHash = getValueHash(value);
    const lastHash = lastParsedRef.current.valueHash;
    const lastDate = lastParsedRef.current.dateStr;

    // 日期变化时总是重新解析
    const dateChanged = dateStr !== lastDate;
    // 内容从空变为非空时（首次加载）需要解析
    const contentLoaded = lastHash === '' && currentHash !== '';

    if (!dateChanged && !contentLoaded) {
      return;
    }

    lastParsedRef.current = { dateStr, valueHash: currentHash };

    if (value && value.trim()) {
      const parsed = parseContent(value);
      setTodos(parsed.todos);
      setCompleted(parsed.completed);
      setNotes(parsed.notes);
    } else {
      setTodos([]);
      setCompleted([]);
      setNotes('');
    }

    if (dateChanged) {
      setSelectedId(null);
    }
  }, [dateStr, value]);

  // 自定义 Markdown 组件，处理本地图片路径
  const markdownComponents = useMemo(() => ({
    img: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
      let imageSrc = src || '';

      // 如果是相对路径（assets/xxx 或 ./assets/xxx），转换为 Tauri 文件 URL
      if (config?.localPath && src && !src.startsWith('http') && !src.startsWith('data:')) {
        // 移除开头的 ./ 如果存在
        const cleanPath = src.replace(/^\.\//, '');
        // 构建完整的本地文件路径
        const fullPath = `${config.localPath}/${year}/${month}/${cleanPath}`;
        imageSrc = convertFileSrc(fullPath);
      }

      return <img src={imageSrc} alt={alt || ''} {...props} />;
    },
  }), [config?.localPath, year, month]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 获取选中的任务
  const selectedTodo = todos.find(t => t.id === selectedId) ||
                       completed.find(t => t.id === selectedId) ||
                       todos.flatMap(t => t.children).find(t => t.id === selectedId) ||
                       completed.flatMap(t => t.children).find(t => t.id === selectedId);

  const isSelectedCompleted = completed.some(t => t.id === selectedId) ||
                              completed.some(t => t.children.some(c => c.id === selectedId));

  const findParentId = (id: string): string | undefined => {
    for (const todo of [...todos, ...completed]) {
      if (todo.children.some(c => c.id === id)) {
        return todo.id;
      }
    }
    return undefined;
  };

  const selectedParentId = selectedId ? findParentId(selectedId) : undefined;

  const syncToParent = useCallback((newTodos: TodoItem[], newCompleted: TodoItem[], newNotes: string) => {
    if (!dateStr) return;
    isEditingRef.current = true;
    const markdown = buildMarkdown(dateStr, newTodos, newCompleted, newNotes);
    onChange(markdown);
    setTimeout(() => {
      isEditingRef.current = false;
    }, 300);
  }, [dateStr, onChange]);

  // 处理拖拽排序结束
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      if (activeTab === 'todos') {
        const oldIndex = todos.findIndex(t => t.id === active.id);
        const newIndex = todos.findIndex(t => t.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          const newTodos = arrayMove(todos, oldIndex, newIndex);
          setTodos(newTodos);
          syncToParent(newTodos, completed, notes);
        }
      } else if (activeTab === 'completed') {
        const oldIndex = completed.findIndex(t => t.id === active.id);
        const newIndex = completed.findIndex(t => t.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1) {
          const newCompleted = arrayMove(completed, oldIndex, newIndex);
          setCompleted(newCompleted);
          syncToParent(todos, newCompleted, notes);
        }
      }
    }
  }, [activeTab, todos, completed, notes, syncToParent]);

  // 切换任务完成状态（重要：处理步骤逻辑）
  const toggleTodo = useCallback((id: string, isCompleted: boolean, parentId?: string) => {
    if (isCompleted) {
      // 从完成区切换
      if (parentId) {
        // 完成区的步骤切换 - 如果取消勾选步骤，整个任务应该移回待办区
        const parent = completed.find(t => t.id === parentId);
        if (parent) {
          const child = parent.children.find(c => c.id === id);
          if (child && child.checked) {
            // 取消勾选步骤 -> 将整个任务移回待办区
            const newItem = {
              ...parent,
              checked: false,
              children: parent.children.map(c =>
                c.id === id ? { ...c, checked: false } : c
              ),
            };
            const newCompleted = completed.filter(t => t.id !== parentId);
            const newTodos = [...todos, newItem];
            setCompleted(newCompleted);
            setTodos(newTodos);
            syncToParent(newTodos, newCompleted, notes);
            message.info('步骤未完成，任务已移回待办事项');
            return;
          } else {
            // 勾选步骤
            const newCompleted = completed.map(p => {
              if (p.id === parentId) {
                return {
                  ...p,
                  children: p.children.map(c =>
                    c.id === id ? { ...c, checked: true } : c
                  ),
                };
              }
              return p;
            });
            setCompleted(newCompleted);
            syncToParent(todos, newCompleted, notes);
          }
        }
      } else {
        // 取消完成父任务 - 移回待办区，同时取消所有步骤的完成状态
        const item = completed.find(t => t.id === id);
        if (item) {
          const newItem = {
            ...item,
            checked: false,
            children: item.children.map(c => ({ ...c, checked: false })),
          };
          const newCompleted = completed.filter(t => t.id !== id);
          const newTodos = [...todos, newItem];
          setCompleted(newCompleted);
          setTodos(newTodos);
          syncToParent(newTodos, newCompleted, notes);
        }
      }
    } else {
      // 从待办区切换
      if (parentId) {
        // 切换步骤状态
        let shouldMoveParent = false;
        const newTodos = todos.map(parent => {
          if (parent.id === parentId) {
            const newChildren = parent.children.map(child =>
              child.id === id ? { ...child, checked: !child.checked } : child
            );
            // 检查是否所有步骤都完成了
            const allChildrenCompleted = newChildren.every(c => c.checked);
            if (allChildrenCompleted && newChildren.length > 0) {
              shouldMoveParent = true;
            }
            return { ...parent, children: newChildren };
          }
          return parent;
        });

        if (shouldMoveParent) {
          // 所有步骤完成，自动将父任务移到完成区
          const parentItem = newTodos.find(t => t.id === parentId);
          if (parentItem) {
            const completedItem = { ...parentItem, checked: true };
            const filteredTodos = newTodos.filter(t => t.id !== parentId);
            const newCompleted = [...completed, completedItem];
            setTodos(filteredTodos);
            setCompleted(newCompleted);
            if (selectedId === parentId) setSelectedId(null);
            syncToParent(filteredTodos, newCompleted, notes);
            message.success('所有步骤已完成，任务已移至已完成');
            return;
          }
        }

        setTodos(newTodos);
        syncToParent(newTodos, completed, notes);
      } else {
        // 完成父任务 - 同时完成所有步骤
        const item = todos.find(t => t.id === id);
        if (item) {
          const newItem = {
            ...item,
            checked: true,
            children: item.children.map(c => ({ ...c, checked: true })),
          };
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

  // 更新备注（过滤标题）
  const updateTodoSubContent = useCallback((id: string, subContent: string, isCompleted: boolean, parentId?: string) => {
    // 过滤掉标题语法
    const filteredContent = filterSubContent(subContent);

    if (isCompleted) {
      if (parentId) {
        const newCompleted = completed.map(parent => {
          if (parent.id === parentId) {
            return {
              ...parent,
              children: parent.children.map(child =>
                child.id === id ? { ...child, subContent: filteredContent } : child
              ),
            };
          }
          return parent;
        });
        setCompleted(newCompleted);
        syncToParent(todos, newCompleted, notes);
      } else {
        const newCompleted = completed.map(t => t.id === id ? { ...t, subContent: filteredContent } : t);
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
                child.id === id ? { ...child, subContent: filteredContent } : child
              ),
            };
          }
          return parent;
        });
        setTodos(newTodos);
        syncToParent(newTodos, completed, notes);
      } else {
        const newTodos = todos.map(t => t.id === id ? { ...t, subContent: filteredContent } : t);
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

  // 文件上传处理（上传后同步到 git）
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

      // 上传后触发保存，确保同步到 git
      setTimeout(() => {
        onSave?.();
      }, 500);
    }
  }, [year, month, day, selectedTodo, isSelectedCompleted, selectedParentId, updateTodoSubContent, onSave]);

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

  // 渲染详情面板
  const renderDetailPanel = () => {
    if (!selectedTodo) return null;

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
              {selectedTodo.children.length > 0 && (
                <span className="steps-progress">
                  {selectedTodo.children.filter(c => c.checked).length}/{selectedTodo.children.length}
                </span>
              )}
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
        <div className="detail-section notes-section">
          <div className="section-label">
            <PaperClipOutlined /> 备注 & 附件
            <div className="section-actions">
              <button
                className={`preview-toggle ${detailPreviewMode ? 'active' : ''}`}
                onClick={() => setDetailPreviewMode(!detailPreviewMode)}
                title={detailPreviewMode ? '编辑' : '预览'}
              >
                {detailPreviewMode ? <EditOutlined /> : <EyeOutlined />}
              </button>
              <button
                className="upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                上传文件
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
            />
          </div>
          <div className="notes-hint">支持 Markdown 格式，但不允许使用标题（#）语法</div>
          {detailPreviewMode ? (
            <div className="detail-notes-preview markdown-preview">
              {selectedTodo.subContent ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {selectedTodo.subContent}
                </ReactMarkdown>
              ) : (
                <div className="preview-empty">暂无备注内容</div>
              )}
            </div>
          ) : (
            <textarea
              className="detail-notes"
              value={selectedTodo.subContent}
              onChange={(e) => updateTodoSubContent(selectedTodo.id, e.target.value, isSelectedCompleted, selectedParentId)}
              placeholder="添加备注...（支持 Markdown，可拖拽文件上传）"
              disabled={disabled}
            />
          )}
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
        {/* 标签栏 */}
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
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={todos.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {todos.map(item => (
                      <SortableTaskItem
                        key={item.id}
                        item={item}
                        isCompleted={false}
                        isSelected={selectedId === item.id}
                        onSelect={() => setSelectedId(item.id)}
                        onToggle={() => toggleTodo(item.id, false)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
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
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={completed.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {completed.map(item => (
                      <SortableTaskItem
                        key={item.id}
                        item={item}
                        isCompleted={true}
                        isSelected={selectedId === item.id}
                        onSelect={() => setSelectedId(item.id)}
                        onToggle={() => toggleTodo(item.id, true)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </>
          )}

          {activeTab === 'notes' && (
            <div className="notes-editor">
              <div className="notes-toolbar">
                <span className="notes-hint-text">
                  支持 Markdown 格式，标题请使用 ### 三级标题
                </span>
                <button
                  className={`preview-toggle ${previewMode ? 'active' : ''}`}
                  onClick={() => setPreviewMode(!previewMode)}
                >
                  {previewMode ? <><EditOutlined /> 编辑</> : <><EyeOutlined /> 预览</>}
                </button>
              </div>
              {previewMode ? (
                <div className="notes-preview markdown-preview">
                  {notes ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {notes}
                    </ReactMarkdown>
                  ) : (
                    <div className="preview-empty">暂无笔记内容</div>
                  )}
                </div>
              ) : (
                <textarea
                  value={notes}
                  onChange={(e) => updateNotes(e.target.value)}
                  placeholder="在这里记录笔记...&#10;支持 Markdown 格式，标题请使用 ### 三级标题"
                  disabled={disabled}
                  onKeyDown={(e) => {
                    if (e.key === 's' && e.ctrlKey) {
                      e.preventDefault();
                      onSave?.();
                    }
                  }}
                />
              )}
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
