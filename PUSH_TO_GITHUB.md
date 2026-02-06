# 推送项目到 GitHub 指南

## 方法一：通过命令行推送（推荐）

### 1. 初始化本地 Git 仓库

```bash
cd /path/to/todo-desktop-app

# 初始化 Git 仓库
git init

# 添加所有文件
git add .

# 首次提交
git commit -m "Initial commit: Todo Desktop App with Tauri"
```

### 2. 连接到远程仓库

```bash
# 添加远程仓库
git remote add origin https://github.com/en-o/todoDesktop.git

# 或者使用 SSH（如果已配置 SSH key）
# git remote add origin git@github.com:en-o/todoDesktop.git
```

### 3. 推送到 GitHub

```bash
# 推送到 main 分支
git branch -M main
git push -u origin main
```

### 如果仓库已存在内容

如果远程仓库已有内容（如 README），需要先拉取：

```bash
# 拉取远程内容并合并
git pull origin main --allow-unrelated-histories

# 解决可能的冲突后，再推送
git push -u origin main
```

## 方法二：使用 GitHub CLI（更简单）

### 1. 安装 GitHub CLI

**Windows**:
```bash
winget install --id GitHub.cli
```

**macOS**:
```bash
brew install gh
```

**Linux**:
```bash
# Debian/Ubuntu
sudo apt install gh

# Fedora
sudo dnf install gh
```

### 2. 登录 GitHub

```bash
gh auth login
```

按照提示选择：
- GitHub.com
- HTTPS
- 使用浏览器登录

### 3. 推送项目

```bash
cd /path/to/todo-desktop-app

# 初始化并推送到新仓库
gh repo create en-o/todoDesktop --public --source=. --push

# 或者如果仓库已存在
git init
git add .
git commit -m "Initial commit: Todo Desktop App with Tauri"
git remote add origin https://github.com/en-o/todoDesktop.git
git branch -M main
git push -u origin main
```

## 方法三：通过 GitHub Desktop

### 1. 下载并安装 GitHub Desktop
- 访问: https://desktop.github.com/

### 2. 登录 GitHub 账户

### 3. 添加本地仓库
- File → Add Local Repository
- 选择 `todo-desktop-app` 目录
- 点击 "create a repository"

### 4. 发布到 GitHub
- 点击 "Publish repository"
- 仓库名: `todoDesktop`
- 确认并发布

## 推送前检查清单

✅ **确保以下文件已创建**:
- [ ] README.md
- [ ] .gitignore
- [ ] package.json
- [ ] 所有源代码文件

✅ **检查 .gitignore 是否正确**:
```bash
# 确认这些目录不会被提交
node_modules/
src-tauri/target/
dist/
```

✅ **验证文件**:
```bash
# 查看将要提交的文件
git status

# 查看文件数量
git ls-files | wc -l
```

## 推送后的操作

### 1. 设置仓库描述

在 GitHub 仓库页面：
- 点击 "About" 右侧的齿轮图标
- 添加描述: "基于 Tauri + React 的 Git Todo 桌面应用"
- 添加主题: `tauri`, `react`, `todo-app`, `git`, `desktop-app`

### 2. 添加 README Badge

在 README.md 顶部添加：

```markdown
# Todo Desktop App

![GitHub](https://img.shields.io/github/license/en-o/todoDesktop)
![GitHub stars](https://img.shields.io/github/stars/en-o/todoDesktop)
![GitHub issues](https://img.shields.io/github/issues/en-o/todoDesktop)
```

### 3. 设置 GitHub Pages（可选）

Settings → Pages → Source:
- 选择 `gh-pages` 分支（未来功能）

### 4. 保护主分支

Settings → Branches → Add rule:
- Branch name pattern: `main`
- Require pull request reviews before merging

## 常见问题

### Q: 推送时要求输入用户名密码？

A: GitHub 已不支持密码认证，需要使用 Personal Access Token:

1. 生成 Token: https://github.com/settings/tokens
2. 权限选择: `repo` (完整仓库权限)
3. 推送时使用 token 代替密码

### Q: 文件太大无法推送？

A: 检查是否误提交了大文件：
```bash
# 查找大文件
find . -type f -size +10M

# 如果在 node_modules 或 target，确保 .gitignore 正确
```

### Q: 推送失败：remote contains work that you do not have locally

A: 先拉取远程更改：
```bash
git pull origin main --rebase
git push origin main
```

## 快速脚本

创建文件 `push-to-github.sh`:

```bash
#!/bin/bash

echo "🚀 开始推送到 GitHub..."

# 初始化 Git
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: Todo Desktop App with Tauri

Features:
- 📅 Year/Month/Day calendar navigation
- 📝 Markdown editor with preview
- 🔄 Git version control
- ☁️ Support GitHub/GitLab/Gitee
- ⚙️ Flexible configuration"

# 添加远程仓库
git remote add origin https://github.com/en-o/todoDesktop.git

# 设置分支
git branch -M main

# 推送
git push -u origin main

echo "✅ 推送完成！"
echo "📦 访问仓库: https://github.com/en-o/todoDesktop"
```

运行：
```bash
chmod +x push-to-github.sh
./push-to-github.sh
```

## 推送成功后

访问你的仓库：
👉 **https://github.com/en-o/todoDesktop**

检查：
- [ ] 所有文件已上传
- [ ] README 正常显示
- [ ] 代码高亮正常
- [ ] 无敏感信息泄露

## 下一步

1. **Star 你的项目** ⭐
2. **分享给朋友**
3. **开始开发新功能**
4. **处理 Issues 和 PR**

---

需要帮助？查看 GitHub 官方文档：
https://docs.github.com/cn/get-started/importing-your-projects-to-github/importing-source-code-to-github/adding-locally-hosted-code-to-github
