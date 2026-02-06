# Todo Desktop App

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Tauri](https://img.shields.io/badge/Tauri-1.5-blue.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)
![Rust](https://img.shields.io/badge/Rust-1.70+-orange.svg)

**基于 Tauri + React + Rust 的 Git Todo 管理桌面应用**

[功能特性](#功能特性) • [快速开始](#快速开始) • [使用说明](#使用说明) • [开发文档](DEVELOPMENT.md)

</div>

---

## 简介

一个轻量级、跨平台的 Todo 管理桌面应用，使用 Git 作为存储和版本控制系统。支持 Markdown 编辑，支持多个 Git 托管平台（GitHub/GitLab/Gitee）。

## 功能特性

- 📅 **年/月/日三级日历导航**
  - 首页显示年度日历
  - 点击月份查看月度视图
  - 选择日期管理每日 Todo

- 📝 **Markdown 格式存储**
  - 所有 Todo 以 Markdown 格式保存
  - 支持附件管理
  - 文件结构：`年/月/日期.md`

- 🔄 **Git 版本控制**
  - 支持 GitHub / GitLab / Gitee
  - 自动同步到远程仓库
  - 完整的版本历史记录

- 🌐 **GitHub Pages 支持**
  - 可选启用 GitHub Pages
  - 自动生成静态网页
  - 在线查看你的 Todo

## 技术栈

- **前端框架**: React 18 + TypeScript
- **UI 组件**: Ant Design
- **桌面框架**: Tauri 1.5
- **后端语言**: Rust
- **Git 操作**: git2-rs (Rust)
- **Markdown**: react-markdown
- **状态管理**: Zustand
- **构建工具**: Vite

## 项目结构

```
todoDesktop/
├── src/                    # React 前端代码
│   ├── App.tsx
│   ├── components/         # 组件
│   ├── pages/              # 页面
│   │   ├── YearView.tsx    # 年视图
│   │   ├── MonthView.tsx   # 月视图
│   │   ├── DayView.tsx     # 日视图
│   │   └── Settings.tsx    # 设置页面
│   ├── store/              # Zustand 状态
│   └── utils/              # 工具函数
├── src-tauri/              # Tauri 后端 (Rust)
│   ├── src/
│   │   ├── main.rs         # 主入口
│   │   ├── git_manager.rs  # Git 操作模块
│   │   ├── file_manager.rs # 文件操作模块
│   │   └── config.rs       # 配置管理
│   ├── Cargo.toml          # Rust 依赖
│   └── tauri.conf.json     # Tauri 配置
├── package.json
└── README.md
```

## 快速开始

### 前置要求

- Node.js 16+
- Rust 1.70+
- 系统依赖（根据平台）:
  - **Windows**: Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev`

### 安装依赖

```bash
# 安装前端依赖
npm install

# 安装 Tauri CLI
npm install -D @tauri-apps/cli
```

### 开发模式

```bash
npm run tauri dev
```

### 打包应用

```bash
npm run tauri build
```

## 使用说明

### 首次设置

1. 启动应用后，点击右上角设置图标
2. 配置 Git 用户信息（用户名、邮箱）
3. 选择本地数据目录
4. 选择远程仓库类型（GitHub/GitLab/Gitee）
5. 输入仓库地址和访问令牌
6. （可选）启用 GitHub Pages

### 日常使用

1. **年视图**：查看全年概览，已有 Todo 的日期会高亮显示
2. **月视图**：点击月份，查看当月日历
3. **日视图**：
   - 点击日期，新增或编辑 Todo
   - 使用 Markdown 编辑器
   - 添加附件（图片、文件）
   - 标记完成状态
4. **同步**：
   - 自动提交：编辑后自动提交到本地 Git
   - 手动同步：点击同步按钮推送到远程仓库
   - 定时同步：可设置自动同步间隔

## 数据存储结构

```
todo-data/
├── 2024/
│   ├── 01/
│   │   ├── 01.md
│   │   ├── 02.md
│   │   └── ...
│   ├── 02/
│   └── ...
├── 2025/
│   └── ...
├── attachments/
│   └── [hash-based-filenames]
└── .git/
```

## Git 工作流

1. **本地编辑** → 自动保存到文件
2. **自动提交** → 每次保存自动 git commit
3. **手动同步** → 用户点击同步按钮
4. **推送到远程** → git push origin main
5. **GitHub Pages** → 自动触发静态站点生成

## 配置文件

配置保存在系统的用户数据目录：
- **Windows**: `%APPDATA%/com.todo.desktop/config.json`
- **macOS**: `~/Library/Application Support/com.todo.desktop/config.json`
- **Linux**: `~/.config/com.todo.desktop/config.json`

## 开发说明

### 添加 Tauri 命令

1. 在 `src-tauri/src/` 中创建新的 Rust 模块
2. 使用 `#[tauri::command]` 宏导出函数
3. 在 `main.rs` 中注册命令
4. 在前端使用 `invoke()` 调用

示例：

```rust
// Rust
#[tauri::command]
fn read_todo(date: String) -> Result<String, String> {
    // 实现逻辑
}
```

```typescript
// TypeScript
import { invoke } from '@tauri-apps/api/tauri';

const content = await invoke<string>('read_todo', { date: '2024-01-01' });
```

## License

MIT
