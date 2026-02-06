# Todo Desktop App - 开发文档

## 项目架构

### 技术选型

**前端**:
- React 18 + TypeScript
- Ant Design (UI 组件库)
- React Router (路由)
- Zustand (状态管理)
- React Markdown (Markdown 渲染)

**后端**:
- Tauri (桌面应用框架)
- Rust (后端语言)
- git2-rs (Git 操作)

### 目录结构

```
todoDesktop/
├── src/                        # React 前端
│   ├── App.tsx                 # 应用主组件
│   ├── main.tsx                # 入口文件
│   ├── components/             # 公共组件
│   │   └── Layout.tsx          # 布局组件
│   ├── pages/                  # 页面组件
│   │   ├── YearView.tsx        # 年视图
│   │   ├── MonthView.tsx       # 月视图
│   │   ├── DayView.tsx         # 日视图（Todo 编辑器）
│   │   └── Settings.tsx        # 设置页面
│   ├── store/                  # Zustand 状态
│   │   └── configStore.ts      # 配置状态
│   └── utils/                  # 工具函数
│
├── src-tauri/                  # Tauri 后端
│   ├── src/
│   │   ├── main.rs             # Rust 主入口
│   │   ├── git_manager.rs      # Git 管理器
│   │   ├── file_manager.rs     # 文件管理器
│   │   └── config.rs           # 配置定义
│   ├── Cargo.toml              # Rust 依赖
│   └── tauri.conf.json         # Tauri 配置
│
├── package.json                # Node.js 依赖
├── vite.config.ts              # Vite 配置
└── tsconfig.json               # TypeScript 配置
```

## 核心功能实现

### 1. Git 管理 (git_manager.rs)

使用 `git2-rs` 库实现 Git 操作:

```rust
pub struct GitManager {
    repo: Repository,
    config: Config,
}

// 主要功能:
- init()              // 初始化仓库
- add_and_commit()    // 添加并提交
- push()              // 推送到远程
- pull()              // 从远程拉取
```

### 2. 文件管理 (file_manager.rs)

处理文件的读写操作:

```rust
pub struct FileManager;

// 主要功能:
- read_file()   // 读取文件
- write_file()  // 写入文件
- list_files()  // 列出文件
- exists()      // 检查文件是否存在
```

### 3. 前后端通信

使用 Tauri 的 IPC 机制:

**后端定义命令** (main.rs):
```rust
#[tauri::command]
async fn read_file(
    state: State<'_, AppState>,
    filepath: String,
) -> Result<String, String> {
    // 实现
}
```

**前端调用** (TypeScript):
```typescript
import { invoke } from '@tauri-apps/api/tauri';

const content = await invoke<string>('read_file', { 
    filepath: '2024/01/01.md' 
});
```

### 4. 状态管理

使用 Zustand 管理全局状态:

```typescript
interface ConfigState {
  config: Config | null;
  isConfigured: boolean;
  loadConfig: () => Promise<void>;
  saveConfig: (config: Config) => Promise<void>;
  initGit: (config: Config) => Promise<void>;
}

const useConfigStore = create<ConfigState>(...);
```

### 5. 路由设计

```
/year              → 年视图 (默认当前年)
/year/:year        → 指定年份的年视图
/month/:year/:month → 月视图
/day/:year/:month/:day → 日视图 (Todo 编辑器)
/settings          → 设置页面
```

## 数据流程

### 保存 Todo

```
用户编辑 
  ↓
点击保存
  ↓
React 调用 write_file()
  ↓
Rust 写入文件到本地
  ↓
Rust 自动 git add & commit
  ↓
完成
```

### 同步到远程

```
用户点击同步
  ↓
React 调用 git_pull()
  ↓
Rust 从远程拉取
  ↓
React 调用 git_push()
  ↓
Rust 推送到远程
  ↓
完成
```

## 开发指南

### 添加新的 Tauri 命令

1. 在 `src-tauri/src/` 创建功能模块
2. 定义命令函数:
```rust
#[tauri::command]
async fn my_command(param: String) -> Result<String, String> {
    // 实现逻辑
    Ok("success".to_string())
}
```

3. 在 `main.rs` 注册:
```rust
.invoke_handler(tauri::generate_handler![
    my_command,  // 添加这里
    init_git,
    // ...
])
```

4. 前端调用:
```typescript
const result = await invoke<string>('my_command', { param: 'value' });
```

### 添加新页面

1. 在 `src/pages/` 创建页面组件
2. 在 `App.tsx` 添加路由:
```typescript
<Route path="my-page" element={<MyPage />} />
```

3. 在导航中添加链接

### 修改 UI 样式

- 使用 Ant Design 组件
- 自定义样式放在对应的 `.css` 文件
- 全局样式在 `index.css`

## 构建和打包

### 开发模式

```bash
npm run tauri:dev
```

### 生产构建

```bash
npm run tauri:build
```

构建产物位于 `src-tauri/target/release/bundle/`

### 平台特定构建

- **Windows**: `.exe` + `.msi`
- **macOS**: `.app` + `.dmg`
- **Linux**: `.AppImage` + `.deb`

## GitHub Pages 集成 (TODO)

计划实现自动生成静态站点:

1. 在提交时触发静态站点生成
2. 将 Markdown 转换为 HTML
3. 推送到 `gh-pages` 分支
4. GitHub Actions 自动部署

## 常见问题

### Q: Git 推送失败?
A: 检查访问令牌是否有效，确保有 repo 权限

### Q: 文件保存失败?
A: 检查本地路径是否有写入权限

### Q: 如何更换远程仓库?
A: 在设置页面修改仓库地址并保存

### Q: 能否支持多个仓库?
A: 当前版本仅支持单个仓库，可以在设置中切换

## 未来计划

- [ ] 附件上传功能
- [ ] Todo 标签和分类
- [ ] 全文搜索
- [ ] 导出为 PDF
- [ ] 多语言支持
- [ ] 主题切换（暗色模式）
- [ ] GitHub Pages 自动部署
- [ ] 移动端适配
- [ ] 离线模式优化

## 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## License

MIT
