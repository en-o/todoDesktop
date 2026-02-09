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

## 发布

### 使用脚本发布（推荐）

```bash
# 完整发布：指定版本号
release.bat 0.0.7

# 快速发布：使用当前版本号
release-quick.bat
```

`release.bat` 会自动：
1. 检查未提交的更改
2. 更新 `package.json`、`tauri.conf.json`、`Cargo.toml`、`package-lock.json` 版本号
3. 提交更改并创建 Git 标签
4. 推送到 GitHub 触发 CI 自动构建

### 手动发布

```bash
# 1. 更新版本号（三个文件）
#    - package.json
#    - package-lock.json （这个如果build会自己变但是最好自己也改改）
#    - src-tauri/tauri.conf.json
#    - src-tauri/Cargo.toml

# 2. 提交并创建标签
git add -A
git commit -m "chore: release v0.0.7"
git tag -a v0.0.7 -m "Release v0.0.7"

# 3. 推送
git push origin main
git push origin v0.0.7
```

### 构建产物

| 平台 | 文件 |
|------|------|
| Windows | `.msi`、`.exe`、便携版 `.zip` |
| macOS | `.dmg` |
| Linux | `.deb`、`.AppImage` |

## 脚本说明

| 脚本 | 说明 |
|------|------|
| `release.bat` | 完整发布（见上方发布流程） |
| `release-quick.bat` | 快速发布：使用当前版本号 |
| `sync-attachments.bat` | 同步历史附件到远程仓库 |
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

所有数据都存储在用户设置的**本地数据目录**中，并通过 Git 同步到远程仓库。

```
本地数据目录/
├── .desktop_data/          # 应用数据目录（随 Git 同步）
│   └── config.json         # 应用配置
├── 2026/
│   ├── 01/
│   │   ├── 01-01.md        # 待办文件
│   │   └── assets/         # 附件目录
│   └── 02/
│       ├── 02-07.md
│       └── assets/
├── .git/
└── README.md
```

### 数据存储说明

- **无本地缓存**：应用不在系统目录创建额外缓存，所有数据都在本地数据目录中
- **配置同步**：应用配置存储在 `.desktop_data/config.json`，会随 Git 同步到远程
- **多设备同步**：在新设备上克隆仓库后，配置会自动恢复
- **指针文件**：系统只保存一个指向本地数据目录的指针文件

### 指针文件位置

应用仅在系统目录保存一个指针文件，指向本地数据目录：

- **Windows**: `%APPDATA%\com.todo.desktop\pointer.json`
- **macOS**: `~/Library/Application Support/com.todo.desktop/pointer.json`
- **Linux**: `~/.config/com.todo.desktop/pointer.json`

指针文件内容示例：
```json
{
  "dataPath": "C:\\Users\\用户名\\Documents\\TodoData"
}
```

## 更新说明

更新安装时，如果提示程序正在运行：
1. 右键点击系统托盘中的 Todo Desktop 图标，选择「退出程序」
2. 或在命令行运行：`taskkill /F /IM "Todo Desktop.exe"`

## License

[Apache 2.0](LICENSE)
