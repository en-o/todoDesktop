# 🚀 推送到 GitHub 速查表

## 📋 三种推送方式

### 方式一：自动脚本（最简单）⭐

**Windows 用户**:
```bash
# 双击运行
push-to-github.bat
```

**Mac/Linux 用户**:
```bash
# 在终端运行
./push-to-github.sh
```

---

### 方式二：命令行（推荐）

#### 步骤 1: 打开终端/命令提示符

**Windows**: 在项目文件夹按 `Shift + 右键` → 选择 "在此处打开 PowerShell 窗口"

**Mac**: 应用程序 → 实用工具 → 终端

**Linux**: `Ctrl + Alt + T`

#### 步骤 2: 执行命令

```bash
# 初始化 Git（首次）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: Todo Desktop App"

# 添加远程仓库
git remote add origin https://github.com/en-o/todoDesktop.git

# 设置主分支
git branch -M main

# 推送
git push -u origin main
```

#### 如果推送失败（远程仓库已有内容）

```bash
# 先拉取远程内容
git pull origin main --allow-unrelated-histories

# 再推送
git push -u origin main
```

---

### 方式三：GitHub CLI（最优雅）

#### 安装 GitHub CLI

**Windows**:
```bash
winget install --id GitHub.cli
```

**Mac**:
```bash
brew install gh
```

**Linux**:
```bash
sudo apt install gh  # Ubuntu/Debian
sudo dnf install gh  # Fedora
```

#### 使用 GitHub CLI

```bash
# 登录
gh auth login

# 推送项目（如果仓库已存在）
git init
git add .
git commit -m "Initial commit"
gh repo create en-o/todoDesktop --public --source=. --push
```

---

## 🔐 配置 Git 凭据

### 使用 Personal Access Token

1. **生成 Token**:
   - 访问: https://github.com/settings/tokens
   - 点击 "Generate new token (classic)"
   - 权限选择: `repo` (完整仓库权限)
   - 生成并**复制** token

2. **使用 Token**:
   ```bash
   # 推送时，用户名输入你的 GitHub 用户名
   # 密码输入刚才复制的 token
   git push -u origin main
   ```

### 保存凭据（避免每次输入）

```bash
# 保存凭据到本地
git config --global credential.helper store

# 下次 push 输入一次后就会记住
git push -u origin main
```

---

## ✅ 推送前检查

```bash
# 查看将要提交的文件
git status

# 查看文件变更
git diff

# 查看提交历史
git log --oneline
```

---

## 🔧 常见问题解决

### 问题 1: fatal: remote origin already exists

```bash
# 删除已存在的 origin
git remote remove origin

# 重新添加
git remote add origin https://github.com/en-o/todoDesktop.git
```

### 问题 2: Updates were rejected

```bash
# 强制推送（谨慎使用）
git push -u origin main --force

# 或者先拉取再推送
git pull origin main --allow-unrelated-histories
git push -u origin main
```

### 问题 3: 文件太大

```bash
# 查看大文件
find . -type f -size +10M

# 如果是 node_modules 或 target，确保 .gitignore 正确
cat .gitignore
```

### 问题 4: 推送速度慢

```bash
# 使用 SSH 而不是 HTTPS
git remote set-url origin git@github.com:en-o/todoDesktop.git
```

---

## 📦 推送成功后的操作

### 1. 验证推送

访问: https://github.com/en-o/todoDesktop

检查：
- [ ] 文件已上传
- [ ] README 正常显示
- [ ] 代码高亮正常

### 2. 设置仓库

在 GitHub 仓库页面：

**添加描述**:
- 点击 "About" 旁的齿轮
- 描述: "基于 Tauri + React 的 Git Todo 桌面应用"
- Topics: `tauri`, `react`, `rust`, `todo-app`, `desktop-app`, `git`

**保护主分支**:
- Settings → Branches → Add rule
- Branch name: `main`
- ✅ Require pull request reviews

### 3. 启用 GitHub Actions

- 访问 Actions 标签
- 点击 "I understand my workflows, go ahead and enable them"

---

## 🎯 下次更新代码

```bash
# 拉取最新代码
git pull

# 修改代码...

# 添加更改
git add .

# 提交
git commit -m "fix: 修复某个问题"

# 推送
git push
```

---

## 📞 需要帮助？

- **GitHub 文档**: https://docs.github.com/cn
- **Git 教程**: https://git-scm.com/book/zh/v2
- **提问**: 在仓库创建 Issue

---

## 🎉 成功推送后

恭喜！你的项目已经在 GitHub 上了！

下一步：
1. ⭐ Star 你自己的项目
2. 📢 分享给朋友
3. 💻 继续开发新功能
4. 📝 完善文档

**仓库地址**: https://github.com/en-o/todoDesktop
