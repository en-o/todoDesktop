# Todo Desktop

基于 Tauri + React + Rust 的 Git Todo 管理桌面应用，使用 Git 作为数据存储和版本控制。

## 快速开始

### 1. 下载安装

前往 [Releases](https://github.com/en-o/todoDesktop/releases) 页面下载对应平台的安装包：

- **Windows**: 下载 `.msi` 或 `.exe` 安装包
- **macOS**: 下载 `.dmg` 安装包
- **Linux**: 下载 `.deb` 或 `.AppImage`

### 2. 创建远程仓库

在 [Gitee](https://gitee.com) 或 [GitHub](https://github.com) 上创建一个**私有的空仓库**用于存储你的待办数据：

1. 登录 Gitee/GitHub
2. 点击「新建仓库」
3. 仓库名称建议：`todo-data` 或 `my-todos`
4. **重要**：选择「私有」仓库（保护你的隐私数据）
5. **不要**勾选「初始化仓库」（保持空仓库）
6. 创建完成后，复制仓库地址（HTTPS 格式）

### 3. 配置应用

1. 打开安装好的 Todo Desktop
2. 点击左侧边栏的「设置」按钮
3. 填写配置信息：
   - **本地数据目录**：选择一个本地文件夹用于存储数据（如 `D:\TodoData`）
   - **远程仓库地址**：粘贴刚才创建的仓库地址
   - **Git 平台**：选择 Gitee 或 GitHub
   - **访问令牌**：填写你的个人访问令牌（[Gitee 令牌](https://gitee.com/profile/personal_access_tokens) / [GitHub 令牌](https://github.com/settings/tokens)）
   - **用户名/邮箱**：填写 Git 提交时使用的用户信息
4. 点击「保存配置」

### 4. 开始使用

配置完成后，应用会自动初始化 Git 仓库并同步数据：

- **添加任务**：在底部输入框输入任务，按 Enter 添加
- **完成任务**：点击任务前的圆圈勾选完成
- **编辑详情**：点击任务打开右侧详情面板，可添加步骤和备注
- **保存同步**：按 `Ctrl + S` 保存并同步到远程
- **自动保存**：3 分钟无操作自动保存

### 5. 多设备同步

在其他设备上使用：

1. 安装 Todo Desktop
2. 在设置中填写**相同的远程仓库地址**
3. 选择一个本地目录，应用会自动拉取远程数据

## 功能特性

- 类 Microsoft Todo 风格界面
- 支持任务步骤和 Markdown 备注
- 支持附件上传
- 日历视图快速切换日期
- 任务统计和连续完成天数
- 往期未完成任务提醒
- 系统托盘常驻，关闭窗口自动同步
- 多设备数据同步

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
