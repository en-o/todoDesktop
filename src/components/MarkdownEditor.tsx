import { useEffect, useRef, useCallback } from 'react';
import Vditor from 'vditor';
import { invoke } from '@tauri-apps/api/tauri';
import { message } from 'antd';
import 'vditor/dist/index.css';
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

// 解析内容为待办和完成两个部分
function parseContent(content: string): { header: string; todos: string[]; completed: string[] } {
  const lines = content.split('\n');
  let header = '';
  const todos: string[] = [];
  const completed: string[] = [];
  let currentSection: 'header' | 'todos' | 'completed' = 'header';

  for (const line of lines) {
    // 检测待办事项标题
    if (line.match(/^##\s*待办事项\s*$/)) {
      currentSection = 'todos';
      continue;
    }
    // 检测完成事项标题
    if (line.match(/^##\s*完成事项\s*$/)) {
      currentSection = 'completed';
      continue;
    }

    if (currentSection === 'header') {
      header += line + '\n';
    } else if (currentSection === 'todos') {
      todos.push(line);
    } else {
      completed.push(line);
    }
  }

  return { header: header.trimEnd(), todos, completed };
}

// 重建内容，确保标题格式正确
function buildContent(dateStr: string, todos: string[], completed: string[]): string {
  let content = `# ${dateStr}\n\n## 待办事项\n\n`;
  content += todos.join('\n');
  content += '\n\n## 完成事项\n\n';
  content += completed.join('\n');
  return content;
}

// 处理复选框状态变化：勾选移到完成，取消勾选移回待办
function processCheckboxChange(content: string, dateStr: string): string {
  const { todos, completed } = parseContent(content);

  const newTodos: string[] = [];
  const newCompleted: string[] = [];

  // 处理待办列表：已勾选的移到完成
  for (const line of todos) {
    if (line.match(/^-\s*\[x\]/i)) {
      // 已勾选，移到完成列表
      newCompleted.push(line);
    } else {
      newTodos.push(line);
    }
  }

  // 处理完成列表：取消勾选的移回待办
  for (const line of completed) {
    if (line.match(/^-\s*\[\s\]/)) {
      // 已取消勾选，移回待办列表
      newTodos.push(line);
    } else {
      newCompleted.push(line);
    }
  }

  return buildContent(dateStr, newTodos, newCompleted);
}

// 验证并修复标题结构
function validateAndFixHeaders(content: string, dateStr: string): string {
  // 检查是否包含正确的标题
  const hasCorrectDateHeader = content.match(new RegExp(`^#\\s+${dateStr.replace(/-/g, '-')}\\s*$`, 'm'));
  const hasTodosHeader = content.includes('## 待办事项');
  const hasCompletedHeader = content.includes('## 完成事项');

  // 如果所有标题都正确，返回原内容
  if (hasCorrectDateHeader && hasTodosHeader && hasCompletedHeader) {
    return content;
  }

  // 否则，解析内容并用正确的标题重建
  const { todos, completed } = parseContent(content);
  return buildContent(dateStr, todos, completed);
}

// 确保内容包含必要的结构
function ensureStructure(content: string, dateStr: string): string {
  if (!dateStr) return content;

  // 检查是否包含待办事项和完成事项标题
  const hasTodos = content.includes('## 待办事项');
  const hasCompleted = content.includes('## 完成事项');

  if (!hasTodos || !hasCompleted) {
    // 创建默认结构
    return `# ${dateStr}

## 待办事项

- [ ]

## 完成事项

`;
  }

  // 验证并修复标题
  return validateAndFixHeaders(content, dateStr);
}

// 将手动输入的 [ ] 或 [] 转换为复选框格式
function convertCheckboxSyntax(content: string): string {
  // 将 "- []" 转换为 "- [ ]"
  let newContent = content.replace(/^(-\s*)\[\](\s*)$/gm, '$1[ ]$2');
  // 将 "- [ ]" 后没有空格的情况补上空格
  newContent = newContent.replace(/^(-\s*\[\s\])([^\s])/gm, '$1 $2');
  return newContent;
}

export default function MarkdownEditor({
  value,
  onChange,
  onSave,
  disabled = false,
  placeholder = '开始编写...',
  year,
  month,
  day,
}: MarkdownEditorProps) {
  const vditorRef = useRef<Vditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialValueRef = useRef(value);
  const lastValueRef = useRef(value);
  const isProcessingRef = useRef(false);

  const dateStr = year && day ? `${year}-${day}` : '';

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave();
    }
  }, [onSave]);

  // 处理内容变化
  const handleContentChange = useCallback((newValue: string) => {
    if (isProcessingRef.current || !dateStr) return;

    // 转换复选框语法
    let processed = convertCheckboxSyntax(newValue);

    // 确保结构完整并验证标题
    processed = ensureStructure(processed, dateStr);

    // 检测复选框状态变化并处理
    const oldTodoCount = (lastValueRef.current.match(/-\s*\[\s\]/g) || []).length;
    const oldCompletedCount = (lastValueRef.current.match(/-\s*\[x\]/gi) || []).length;
    const newTodoCount = (processed.match(/-\s*\[\s\]/g) || []).length;
    const newCompletedCount = (processed.match(/-\s*\[x\]/gi) || []).length;

    // 如果复选框状态变化了，处理移动逻辑
    if (oldTodoCount !== newTodoCount || oldCompletedCount !== newCompletedCount) {
      processed = processCheckboxChange(processed, dateStr);
    }

    lastValueRef.current = processed;

    // 如果处理后的内容与原内容不同，更新编辑器
    if (processed !== newValue && vditorRef.current) {
      isProcessingRef.current = true;
      const cursorPos = vditorRef.current.getSelection();
      vditorRef.current.setValue(processed);
      // 尝试恢复光标位置
      try {
        if (cursorPos) {
          vditorRef.current.focus();
        }
      } catch (e) {
        // 忽略光标恢复错误
      }
      isProcessingRef.current = false;
    }

    onChange(processed);
  }, [onChange, dateStr]);

  // 处理文件上传
  const handleUpload = useCallback(async (files: File[]): Promise<string | null> => {
    if (!year || !month || !day) {
      message.error('无法上传：日期信息缺失');
      return null;
    }

    const results: string[] = [];

    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const data = Array.from(new Uint8Array(arrayBuffer));
        const filename = `${day}-${file.name}`;

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

    return results.join('\n');
  }, [year, month, day]);

  useEffect(() => {
    if (!containerRef.current) return;

    const vd = new Vditor(containerRef.current, {
      mode: 'ir',
      value: ensureStructure(initialValueRef.current, dateStr),
      placeholder,
      cache: { enable: false },
      toolbar: [
        'headings',
        'bold',
        'italic',
        'strike',
        '|',
        'check',
        'list',
        'ordered-list',
        '|',
        'quote',
        'code',
        'inline-code',
        '|',
        'table',
        'link',
        'upload',
        '|',
        'undo',
        'redo',
      ],
      toolbarConfig: {
        pin: true,
      },
      counter: {
        enable: true,
        type: 'text',
      },
      preview: {
        markdown: {
          toc: true,
          mark: true,
        },
      },
      upload: {
        accept: 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z',
        multiple: true,
        handler: async (files: File[]) => {
          const result = await handleUpload(files);
          if (result && vditorRef.current) {
            vditorRef.current.insertValue(result);
          }
          return null;
        },
      },
      hint: {
        emoji: {
          '+1': '👍',
          '-1': '👎',
          'heart': '❤️',
          'star': '⭐',
          'fire': '🔥',
          'check': '✅',
          'x': '❌',
          'warning': '⚠️',
          'info': 'ℹ️',
        },
      },
      after: () => {
        vditorRef.current = vd;
        lastValueRef.current = vd.getValue();
        if (disabled) {
          vd.disabled();
        }
      },
      input: (val) => {
        handleContentChange(val);
      },
      ctrlEnter: () => {
        handleSave();
      },
    });

    return () => {
      vditorRef.current?.destroy();
      vditorRef.current = null;
    };
  }, []);

  // 更新禁用状态
  useEffect(() => {
    if (vditorRef.current) {
      if (disabled) {
        vditorRef.current.disabled();
      } else {
        vditorRef.current.enable();
      }
    }
  }, [disabled]);

  // 外部值变化时更新编辑器
  useEffect(() => {
    if (vditorRef.current && !isProcessingRef.current) {
      const currentValue = vditorRef.current.getValue();
      const structuredValue = ensureStructure(value, dateStr);
      if (structuredValue !== currentValue) {
        isProcessingRef.current = true;
        vditorRef.current.setValue(structuredValue);
        lastValueRef.current = structuredValue;
        isProcessingRef.current = false;
      }
    }
  }, [value, dateStr]);

  return (
    <div className="markdown-editor-container">
      <div ref={containerRef} className="vditor-wrapper" />
    </div>
  );
}
