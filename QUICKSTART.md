# 快速开始指南

## 前置要求

### 1. 安装 Node.js
- 版本要求: 16.x 或更高
- 下载地址: https://nodejs.org/

### 2. 安装 Rust
```bash
# Linux / macOS
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Windows
# 下载并运行: https://rustup.rs/
```

### 3. 安装系统依赖

**Windows**:
- Visual Studio C++ Build Tools
- 下载: https://visualstudio.microsoft.com/visual-cpp-build-tools/

**macOS**:
```bash
xcode-select --install
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt update
sudo apt install -y \
    libgtk-3-dev \
    libwebkit2gtk-4.0-dev \
    libappindicator3-dev \
    librsvg2-dev \
    patchelf
```

**Linux (Fedora)**:
```bash
sudo dnf install -y \
    gtk3-devel \
    webkit2gtk4.0-devel \
    libappindicator-gtk3-devel \
    librsvg2-devel
```

## 安装步骤

### 1. 克隆仓库 (或创建新项目)

```bash
# 如果从仓库克隆
git clone https://github.com/yourusername/todoDesktop.git
cd todoDesktop

# 或者使用已创建的项目
cd todoDesktop
```

### 2. 安装依赖

```bash
npm install
```

### 3. 运行开发服务器

```bash
npm run tauri:dev
```

首次运行会编译 Rust 代码，可能需要几分钟时间。

## 首次使用配置

### 1. 打开设置

应用启动后，点击右上角的 "设置" 按钮。

### 2. 基本配置

填写以下信息：

- **本地数据目录**: 点击 "选择" 按钮，选择一个文件夹存储 Todo 数据
- **Git 用户名**: 你的 Git 用户名（例如: zhangsan）
- **Git 邮箱**: 你的 Git 邮箱（例如: zhangsan@example.com）

### 3. 远程仓库配置（可选）

如果你想同步到远程仓库：

#### GitHub 配置

1. **创建仓库**:
   - 访问 https://github.com/new
   - 创建一个新仓库（例如: `todo-data`）
   - 可以设置为私有仓库

2. **生成访问令牌**:
   - 访问 https://github.com/settings/tokens
   - 点击 "Generate new token" → "Generate new token (classic)"
   - 名称: `todoDesktop`
   - 勾选权限: `repo` (完整仓库权限)
   - 点击 "Generate token"
   - **复制令牌** (只显示一次!)

3. **填写设置**:
   - Git 托管平台: 选择 `GitHub`
   - 远程仓库地址: `https://github.com/你的用户名/todo-data.git`
   - 访问令牌: 粘贴刚才复制的令牌

#### GitLab 配置

1. 创建项目: https://gitlab.com/projects/new
2. 生成令牌: Settings → Access Tokens
3. 权限: `write_repository`

#### Gitee 配置

1. 创建仓库: https://gitee.com/projects/new
2. 生成令牌: 设置 → 私人令牌
3. 权限: `projects`

### 4. GitHub Pages（可选）

如果想在线查看 Todo:

1. 在 GitHub 仓库设置中启用 Pages
2. 在应用设置中开启 "启用 GitHub Pages"

## 日常使用

### 查看和编辑 Todo

1. **年视图**: 
   - 启动应用后默认显示当前年份
   - 点击月份进入月视图

2. **月视图**:
   - 显示日历
   - 有 Todo 的日期会显示绿点
   - 点击日期进入日视图

3. **日视图**:
   - 编辑 Markdown 格式的 Todo
   - 切换 "预览" 标签查看渲染效果
   - 点击 "保存" 按钮保存更改

### 同步数据

点击右上角的 "同步" 按钮：
- 先从远程拉取最新更改
- 再将本地更改推送到远程

## 快捷键

- `Ctrl/Cmd + S`: 保存当前 Todo
- `Ctrl/Cmd + ,`: 打开设置

## Markdown 语法示例

```markdown
# 2024-01-15

## 待办事项

- [ ] 完成项目文档
- [x] 参加团队会议
- [ ] 代码审查

## 会议笔记

今天讨论了新功能的设计方案...

## 链接

- [项目地址](https://github.com/user/repo)
```

## 数据备份

你的数据存储在本地目录，建议：

1. **使用 Git 远程仓库**: 自动同步和版本控制
2. **定期备份**: 复制本地数据目录到其他位置
3. **云存储**: 将数据目录放在 Dropbox/OneDrive 等

## 故障排除

### 应用无法启动

```bash
# 清理并重新构建
npm run tauri build
```

### Git 推送失败

1. 检查网络连接
2. 验证访问令牌是否有效
3. 确认仓库地址正确

### 文件保存失败

1. 检查目录权限
2. 确保磁盘空间充足

## 构建生产版本

```bash
# 构建应用
npm run tauri:build

# 产物位置:
# Windows: src-tauri/target/release/bundle/msi/
# macOS: src-tauri/target/release/bundle/dmg/
# Linux: src-tauri/target/release/bundle/appimage/
```

## 获取帮助

- 提交 Issue: https://github.com/yourusername/todoDesktop/issues
- 查看文档: DEVELOPMENT.md
- Tauri 官方文档: https://tauri.app/

## 下一步

- 探索 Markdown 语法
- 设置自动同步
- 自定义主题（计划中）
