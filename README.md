# Todo Desktop

基于 Tauri + React + Rust 的 Git Todo 管理桌面应用，使用 Git 作为数据存储和版本控制。

## 技术栈

- **前端**: React 18 + TypeScript + Ant Design + Zustand
- **桌面**: Tauri 1.5 + Rust
- **编辑器**: Microsoft Todo 风格，支持 Markdown 预览

## 开发

### 环境要求

- Node.js 18+
- Rust 1.70+
- 平台依赖:
  - **Windows**: Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf libssl-dev`

### 启动开发

```bash
npm install
npm run tauri dev
```

### 构建

```bash
npm run tauri build
```

## 脚本说明

| 脚本 | 说明 |
|------|------|
| `release.bat` | 完整发布：更新版本号 → 创建标签 → 推送触发 CI 构建 |
| `release-quick.bat` | 快速发布：使用当前版本号直接发布 |
| `sync-attachments.bat` | 同步历史附件到远程仓库（见下方说明） |
| `push-to-github.bat` | 推送代码到 GitHub |

### sync-attachments.bat

自动同步历史附件到 Git 远程仓库：

```bash
# 直接双击运行，无需切换目录
sync-attachments.bat
```

脚本会自动：
1. 读取配置 `%APPDATA%\com.todo.desktop\config.json`
2. 获取本地数据目录和远程仓库地址
3. 扫描所有 `assets/` 目录下的附件
4. 提交并推送到配置的远程仓库

## 数据结构

```
数据目录/
├── 2026/
│   ├── 01/
│   │   ├── 01-01.md        # 待办文件
│   │   └── assets/         # 附件目录
│   └── 02/
│       ├── 02-07.md
│       └── assets/
└── .git/
```

## 配置文件位置

- **Windows**: `%APPDATA%\com.todo.desktop\config.json`
- **macOS**: `~/Library/Application Support/com.todo.desktop/config.json`
- **Linux**: `~/.config/com.todo.desktop/config.json`

## License

[Apache 2.0](LICENSE)
