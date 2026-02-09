import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/tauri';
import { message, Modal } from 'antd';
import { useConfigStore } from '../store/configStore';
import { useStatsStore } from '../store/statsStore';
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
  ExpandOutlined,
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
  // 1. 移除 BOM 字符（UTF-8 文件开头可能有）
  let normalizedContent = content.replace(/^\uFEFF/, '');
  // 2. 统一换行符：CRLF -> LF, CR -> LF
  normalizedContent = normalizedContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // 3. 将 Tab 转换为 2 个空格（统一缩进）
  normalizedContent = normalizedContent.replace(/\t/g, '  ');

  const lines = normalizedContent.split('\n');
  const todos: TodoItem[] = [];
  const completed: TodoItem[] = [];
  let notes = '';

  let currentSection: 'header' | 'todos' | 'completed' | 'notes' = 'header';
  let currentParent: TodoItem | null = null;
  let currentChild: TodoItem | null = null;
  let inCodeBlock = false;
  let collectingSubContent: 'parent' | 'child' | null = null;

  // Section 标题的正则（更宽容的匹配）
  const todoSectionRegex = /^##\s*待办事项\s*$/;
  const completedSectionRegex = /^##\s*完成事项\s*$/;
  const notesSectionRegex = /^##\s*笔记\s*$/;
  const dateHeaderRegex = /^#\s+\d{4}-\d{2}-\d{2}/;

  // Todo 项的正则（只允许行首 0-1 个空格，作为父项）
  const parentTodoRegex = /^(\s?)-\s*\[([x\s])\]\s*(.*)$/i;
  // 子项正则（2+ 个空格缩进）
  const childTodoRegex = /^(\s{2,})-\s*\[([x\s])\]\s*(.*)$/i;
  // 缩进内容正则
  const indentRegex = /^\s{2,}/;
  // 代码块开始/结束正则（行首可有缩进，然后是 ```）
  const codeBlockRegex = /^\s*```/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测 section 标题（不受代码块影响，因为 ## 开头的行不可能在代码块内有效）
    if (todoSectionRegex.test(line)) {
      saveCurrentItems();
      currentSection = 'todos';
      inCodeBlock = false;
      continue;
    }
    if (completedSectionRegex.test(line)) {
      saveCurrentItems();
      currentSection = 'completed';
      inCodeBlock = false;
      continue;
    }
    if (notesSectionRegex.test(line)) {
      saveCurrentItems();
      currentSection = 'notes';
      inCodeBlock = false;
      continue;
    }
    // 跳过日期标题
    if (dateHeaderRegex.test(line)) {
      continue;
    }

    if (currentSection === 'header') continue;

    if (currentSection === 'notes') {
      notes += line + '\n';
      continue;
    }

    if (currentSection === 'todos' || currentSection === 'completed') {
      // 父级任务检测：始终检测，不受代码块状态影响
      // 这样即使前一个任务的备注中有未闭合的代码块，也不会影响后续任务
      const parentMatch = line.match(parentTodoRegex);

      if (parentMatch) {
        saveCurrentItems();
        inCodeBlock = false; // 重置代码块状态
        const checkChar = parentMatch[2].toLowerCase();
        currentParent = {
          id: generateId(),
          checked: checkChar === 'x',
          text: parentMatch[3].trim(),
          subContent: '',
          children: [],
          collapsed: false,
        };
        collectingSubContent = 'parent';
        currentChild = null;
        continue;
      }

      // 子任务和内容收集：需要考虑代码块状态
      // 检测代码块（只在缩进内容中检测）
      if (codeBlockRegex.test(line)) {
        inCodeBlock = !inCodeBlock;
      }

      // 子任务检测（需要在代码块外）
      const childMatch = !inCodeBlock && currentParent && line.match(childTodoRegex);

      if (childMatch && currentParent) {
        // 遇到新子任务，先保存之前的子任务
        if (currentChild) {
          currentChild.subContent = currentChild.subContent.trimEnd();
          currentParent.children.push(currentChild);
        }
        const checkChar = childMatch[2].toLowerCase();
        currentChild = {
          id: generateId(),
          checked: checkChar === 'x',
          text: childMatch[3].trim(),
          subContent: '',
          children: [],
          collapsed: false,
        };
        collectingSubContent = 'child';
      } else if (currentParent) {
        // 收集子内容（备注）
        const isIndentedLine = indentRegex.test(line);

        if (isIndentedLine) {
          const trimmedLine = line.replace(/^\s{2,}/, '');
          // 如果已经有子任务，缩进行作为父任务的备注
          if (currentParent.children.length > 0 || currentChild) {
            // 先保存当前子任务
            if (currentChild) {
              currentChild.subContent = currentChild.subContent.trimEnd();
              currentParent.children.push(currentChild);
              currentChild = null;
            }
            currentParent.subContent += trimmedLine + '\n';
            collectingSubContent = 'parent';
          } else if (collectingSubContent === 'parent') {
            // 没有子任务，缩进行作为父任务的备注
            currentParent.subContent += trimmedLine + '\n';
          }
        } else if (line.trim() === '') {
          // 空行
          if (collectingSubContent === 'parent' && currentParent.subContent) {
            currentParent.subContent += '\n';
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

  // 先写步骤（children）
  for (const child of item.children) {
    result += '\n' + itemToMarkdown(child, indent + '  ');
  }

  // 再写备注（subContent）- 放在步骤之后
  if (item.subContent.trim()) {
    const subLines = item.subContent.split('\n');
    for (const line of subLines) {
      result += '\n' + indent + '  ' + line;
    }
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
  const { setTodayStats, updateDailyStats } = useStatsStore();
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [completed, setCompleted] = useState<TodoItem[]>([]);
  const [notes, setNotes] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTodoText, setNewTodoText] = useState('');
  const [activeTab, setActiveTab] = useState<'todos' | 'completed' | 'notes'>('todos');
  const [isDragging, setIsDragging] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [detailPreviewMode, setDetailPreviewMode] = useState(true);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [notesModalContent, setNotesModalContent] = useState('');
  const [notesModalPreview, setNotesModalPreview] = useState(false);

  const dateStr = year && day ? `${year}-${day}` : '';
  const fullDateStr = year && month && day ? `${year}-${day}` : '';
  const isEditingRef = useRef(false);
  const lastParsedRef = useRef({ dateStr: '', valueHash: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepInputRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [focusStepId, setFocusStepId] = useState<string | null>(null);

  // 用于事件处理的 refs（确保获取最新值）
  const todosRef = useRef(todos);
  const completedRef = useRef(completed);
  const notesRef = useRef(notes);

  // 同步 refs
  useEffect(() => {
    todosRef.current = todos;
  }, [todos]);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // 计算任务总数（包括子任务）
  const countTasks = useCallback((items: TodoItem[]) => {
    let total = 0;
    let completedCount = 0;
    for (const item of items) {
      total += 1 + item.children.length;
      if (item.checked) completedCount += 1;
      completedCount += item.children.filter(c => c.checked).length;
    }
    return { total, completed: completedCount };
  }, []);

  // 实时更新今日统计（仅更新内存中的显示数据，不写入文件）
  useEffect(() => {
    const todoCounts = countTasks(todos);
    const completedCounts = countTasks(completed);

    const total = todoCounts.total + completedCounts.total;
    const completedTotal = todoCounts.completed + completedCounts.completed;
    const uncompleted = total - completedTotal;

    // 只更新内存中的实时统计（用于侧边栏显示）
    setTodayStats({ total, completed: completedTotal, uncompleted });
  }, [todos, completed, countTasks, setTodayStats]);

  // 保存时更新持久化统计（由 onSave 调用时触发）
  const savePersistentStats = useCallback(() => {
    const todoCounts = countTasks(todos);
    const completedCounts = countTasks(completed);

    const total = todoCounts.total + completedCounts.total;
    const completedTotal = todoCounts.completed + completedCounts.completed;
    const uncompleted = total - completedTotal;

    if (fullDateStr) {
      updateDailyStats(fullDateStr, total, completedTotal, uncompleted);
    }
  }, [todos, completed, fullDateStr, countTasks, updateDailyStats]);

  // 监听保存事件，保存时同步统计
  useEffect(() => {
    const handleSaveStats = () => {
      savePersistentStats();
    };

    window.addEventListener('save-stats', handleSaveStats);
    return () => window.removeEventListener('save-stats', handleSaveStats);
  }, [savePersistentStats]);

  // 计算简单的内容哈希（用于判断内容是否真的变化）
  const getValueHash = (v: string) => v ? `${v.length}-${v.substring(0, 50)}` : '';

  // 日期变化时立即清空状态，避免显示旧数据
  useEffect(() => {
    const lastDate = lastParsedRef.current.dateStr;
    if (dateStr && dateStr !== lastDate) {
      // 日期变化，清空状态等待新内容
      setTodos([]);
      setCompleted([]);
      setNotes('');
      setSelectedId(null);
      setDetailPreviewMode(true);
      lastParsedRef.current = { dateStr, valueHash: '' };
    }
  }, [dateStr]);

  // 内容变化时解析（但编辑时不重新解析）
  useEffect(() => {
    if (!dateStr) return;
    if (!value || !value.trim()) return;

    // 检查内容是否属于当前日期（通过检查内容开头的日期标记）
    const contentDateMatch = value.match(/^#\s+(\d{4}-\d{2}-\d{2})/);
    if (contentDateMatch) {
      const contentDate = contentDateMatch[1];
      if (contentDate !== dateStr) {
        // 内容不属于当前日期，不解析（等待正确的内容）
        return;
      }
    }

    // 用户正在编辑时，不重新解析
    if (isEditingRef.current) {
      return;
    }

    const currentHash = getValueHash(value);
    const lastHash = lastParsedRef.current.valueHash;

    // 内容没变化，不重新解析
    if (currentHash === lastHash) {
      return;
    }

    lastParsedRef.current = { dateStr, valueHash: currentHash };

    const parsed = parseContent(value);
    setTodos(parsed.todos);
    setCompleted(parsed.completed);
    setNotes(parsed.notes);
  }, [dateStr, value]);

  // 聚焦到新创建的步骤
  useEffect(() => {
    if (focusStepId) {
      setTimeout(() => {
        const input = stepInputRefs.current.get(focusStepId);
        if (input) {
          input.focus();
        }
        setFocusStepId(null);
      }, 50);
    }
  }, [focusStepId]);

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
    // 更新哈希值，防止 useEffect 重新解析
    lastParsedRef.current = { dateStr, valueHash: getValueHash(markdown) };
    onChange(markdown);
    setTimeout(() => {
      isEditingRef.current = false;
    }, 500);
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

  // 添加指定文本的 todo（用于往期未完成加入当日）
  const addTodoWithText = useCallback((text: string) => {
    if (!text.trim() || !dateStr) return;

    const newItem: TodoItem = {
      id: generateId(),
      text: text.trim(),
      checked: false,
      subContent: '',
      children: [],
      collapsed: false,
    };

    // 使用 refs 获取最新值
    const currentTodos = todosRef.current;
    const currentCompleted = completedRef.current;
    const currentNotes = notesRef.current;

    const newTodos = [...currentTodos, newItem];
    setTodos(newTodos);

    // 同步到父组件
    isEditingRef.current = true;
    const markdown = buildMarkdown(dateStr, newTodos, currentCompleted, currentNotes);
    lastParsedRef.current = { dateStr, valueHash: getValueHash(markdown) };
    onChange(markdown);
    setTimeout(() => {
      isEditingRef.current = false;
    }, 500);
  }, [dateStr, onChange]);

  // 监听从往期未完成添加任务的事件
  useEffect(() => {
    const handleAddFromPast = (e: CustomEvent<{ text: string }>) => {
      addTodoWithText(e.detail.text);
    };

    window.addEventListener('add-task-from-past', handleAddFromPast as EventListener);
    return () => window.removeEventListener('add-task-from-past', handleAddFromPast as EventListener);
  }, [addTodoWithText]);

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

    // 聚焦到新步骤
    setFocusStepId(newChild.id);
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

  // 从内容中提取附件路径
  const extractAttachmentPaths = useCallback((content: string): string[] => {
    const paths: string[] = [];
    // 匹配 ![...](assets/...) 和 [...](assets/...)
    const regex = /\[.*?\]\((assets\/[^)]+)\)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      paths.push(match[1]);
    }
    return paths;
  }, []);

  // 删除附件文件
  const deleteAttachmentFiles = useCallback(async (paths: string[]) => {
    if (paths.length === 0 || !year || !month) return;

    try {
      await invoke('delete_attachments', {
        year,
        month,
        paths,
      });
    } catch (error) {
      console.error('删除附件失败:', error);
    }
  }, [year, month]);

  // 删除任务
  const deleteTodo = useCallback(async (id: string, isCompleted: boolean, parentId?: string) => {
    // 找到要删除的任务，提取其附件
    let taskToDelete: TodoItem | undefined;

    if (isCompleted) {
      if (parentId) {
        const parent = completed.find(t => t.id === parentId);
        taskToDelete = parent?.children.find(c => c.id === id);
      } else {
        taskToDelete = completed.find(t => t.id === id);
      }
    } else {
      if (parentId) {
        const parent = todos.find(t => t.id === parentId);
        taskToDelete = parent?.children.find(c => c.id === id);
      } else {
        taskToDelete = todos.find(t => t.id === id);
      }
    }

    // 收集要删除的附件（包括子任务的附件）
    const attachmentPaths: string[] = [];
    if (taskToDelete) {
      attachmentPaths.push(...extractAttachmentPaths(taskToDelete.subContent));
      // 如果是父任务，也收集子任务的附件
      if (!parentId && taskToDelete.children) {
        for (const child of taskToDelete.children) {
          attachmentPaths.push(...extractAttachmentPaths(child.subContent));
        }
      }
    }

    // 删除附件文件
    if (attachmentPaths.length > 0) {
      await deleteAttachmentFiles(attachmentPaths);
    }

    // 删除任务
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
  }, [todos, completed, notes, selectedId, syncToParent, extractAttachmentPaths, deleteAttachmentFiles]);

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

        {/* 可滚动内容区域 */}
        <div className="detail-content">
          {/* 子步骤 - 只有父级任务才显示 */}
          {!selectedParentId && (
            <div className="detail-section steps-section">
              <div className="section-label">
                <UnorderedListOutlined /> 步骤
                {selectedTodo.children.length > 0 && (
                  <span className="steps-progress">
                    {selectedTodo.children.filter(c => c.checked).length}/{selectedTodo.children.length}
                  </span>
                )}
              </div>
              <div className={`steps-list ${selectedTodo.children.length > 6 ? 'scrollable' : ''}`}>
                {selectedTodo.children.map(child => (
                  <div key={child.id} className="step-item">
                    <div
                      className="step-checkbox"
                      onClick={() => toggleTodo(child.id, isSelectedCompleted, selectedTodo.id)}
                    >
                      {child.checked ? <CheckOutlined /> : <div className="checkbox-empty" />}
                    </div>
                    <textarea
                      ref={(el) => {
                        if (el) {
                          stepInputRefs.current.set(child.id, el);
                        } else {
                          stepInputRefs.current.delete(child.id);
                        }
                      }}
                      className={`step-text ${child.checked ? 'checked' : ''}`}
                      value={child.text}
                      onChange={(e) => updateTodoText(child.id, e.target.value, isSelectedCompleted, selectedTodo.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          addStep(selectedTodo.id);
                        }
                      }}
                      onBlur={() => {
                        // 如果步骤内容为空，删除这个步骤
                        if (!child.text.trim()) {
                          deleteTodo(child.id, isSelectedCompleted, selectedTodo.id);
                        }
                      }}
                      placeholder="步骤内容"
                      disabled={disabled}
                      rows={1}
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
                  className="preview-toggle"
                  onClick={() => {
                    setNotesModalContent(selectedTodo.subContent);
                    setNotesModalPreview(false);
                    setNotesModalOpen(true);
                  }}
                  title="放大编辑"
                  disabled={disabled}
                >
                  <ExpandOutlined />
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
              <div
                className="detail-notes-preview markdown-preview"
                onClick={() => {
                  if (!disabled) {
                    setDetailPreviewMode(false);
                    // 延迟聚焦，等待 textarea 渲染
                    setTimeout(() => {
                      notesTextareaRef.current?.focus();
                    }, 50);
                  }
                }}
                style={{ cursor: disabled ? 'default' : 'pointer' }}
              >
                {selectedTodo.subContent ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {selectedTodo.subContent}
                  </ReactMarkdown>
                ) : (
                  <div className="preview-empty">点击编辑备注内容</div>
                )}
              </div>
            ) : (
              <textarea
                ref={notesTextareaRef}
                className="detail-notes"
                value={selectedTodo.subContent}
                onChange={(e) => updateTodoSubContent(selectedTodo.id, e.target.value, isSelectedCompleted, selectedParentId)}
                onBlur={() => setDetailPreviewMode(true)}
                placeholder="添加备注...（支持 Markdown，可拖拽文件上传）"
                disabled={disabled}
              />
            )}
          </div>
        </div>

        {/* 删除按钮 - 固定在底部 */}
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

      {/* 备注编辑弹窗 */}
      <Modal
        title={
          <div className="notes-modal-header">
            <span>编辑备注 & 附件</span>
            <button
              className={`preview-toggle ${notesModalPreview ? 'active' : ''}`}
              onClick={() => setNotesModalPreview(!notesModalPreview)}
            >
              {notesModalPreview ? <><EditOutlined /> 编辑</> : <><EyeOutlined /> 预览</>}
            </button>
          </div>
        }
        open={notesModalOpen}
        onCancel={() => setNotesModalOpen(false)}
        onOk={() => {
          if (selectedTodo) {
            updateTodoSubContent(selectedTodo.id, notesModalContent, isSelectedCompleted, selectedParentId);
          }
          setNotesModalOpen(false);
        }}
        okText="保存"
        cancelText="取消"
        width={800}
        styles={{ body: { height: '60vh', padding: '16px' } }}
        destroyOnClose
      >
        <div className="notes-modal-content">
          <div className="notes-modal-hint">
            <span className="hint-icon">⚠️</span>
            支持 Markdown 格式，但不允许使用标题（#）语法
          </div>
          {notesModalPreview ? (
            <div className="notes-modal-preview markdown-preview">
              {notesModalContent ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {notesModalContent}
                </ReactMarkdown>
              ) : (
                <div className="preview-empty">暂无内容</div>
              )}
            </div>
          ) : (
            <textarea
              className="notes-modal-textarea"
              value={notesModalContent}
              onChange={(e) => setNotesModalContent(e.target.value)}
              placeholder="添加备注...（支持 Markdown 格式）"
              autoFocus
            />
          )}
        </div>
      </Modal>
    </div>
  );
}
