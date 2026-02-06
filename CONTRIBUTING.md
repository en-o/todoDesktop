# 贡献指南

感谢你对 Todo Desktop App 的关注！我们欢迎所有形式的贡献。

## 如何贡献

### 报告 Bug

如果你发现了 bug，请：

1. 检查 [Issues](https://github.com/en-o/todoDesktop/issues) 中是否已有相关报告
2. 如果没有，创建新 Issue，包含以下信息：
   - 清晰的标题
   - 详细的问题描述
   - 复现步骤
   - 期望行为
   - 实际行为
   - 截图（如果适用）
   - 系统信息（操作系统、版本等）

### 提出新功能

1. 先在 [Issues](https://github.com/en-o/todoDesktop/issues) 中讨论
2. 说明功能的用途和价值
3. 等待维护者反馈

### 提交代码

#### 1. Fork 项目

点击右上角的 Fork 按钮，将项目复制到你的账号下。

#### 2. 克隆到本地

```bash
git clone https://github.com/你的用户名/todoDesktop.git
cd todoDesktop
```

#### 3. 创建分支

```bash
git checkout -b feature/amazing-feature
```

分支命名规范：
- `feature/` - 新功能
- `fix/` - Bug 修复
- `docs/` - 文档更新
- `refactor/` - 代码重构
- `test/` - 测试相关

#### 4. 开发

- 遵循代码风格
- 添加必要的注释
- 编写或更新测试
- 更新相关文档

#### 5. 提交更改

```bash
git add .
git commit -m "feat: 添加了某某功能"
```

提交信息格式：
- `feat:` - 新功能
- `fix:` - Bug 修复
- `docs:` - 文档更新
- `style:` - 代码格式（不影响功能）
- `refactor:` - 重构
- `test:` - 测试
- `chore:` - 构建/工具更改

#### 6. 推送到 GitHub

```bash
git push origin feature/amazing-feature
```

#### 7. 创建 Pull Request

1. 访问你 fork 的仓库页面
2. 点击 "Pull Request"
3. 填写 PR 描述：
   - 改动内容
   - 相关 Issue
   - 测试情况
   - 截图（如果适用）

### Pull Request 检查清单

提交 PR 前请确保：

- [ ] 代码已通过本地测试
- [ ] 遵循项目代码风格
- [ ] 添加了必要的注释
- [ ] 更新了相关文档
- [ ] 提交信息清晰明确
- [ ] 没有无关的代码更改

## 代码规范

### TypeScript/React

- 使用 TypeScript 严格模式
- 遵循 ESLint 配置
- 组件使用函数式组件 + Hooks
- 使用有意义的变量名
- 添加适当的类型定义

### Rust

- 遵循 Rust 官方风格指南
- 使用 `cargo fmt` 格式化代码
- 使用 `cargo clippy` 检查
- 添加适当的错误处理
- 编写文档注释

### 提交信息

```
<type>: <subject>

<body>

<footer>
```

示例：
```
feat: 添加附件上传功能

- 支持图片上传
- 自动压缩
- 保存到 attachments 目录

Closes #123
```

## 开发环境设置

### 前置要求

- Node.js 16+
- Rust 1.70+
- 系统依赖（见 QUICKSTART.md）

### 安装

```bash
npm install
```

### 开发

```bash
npm run tauri:dev
```

### 构建

```bash
npm run tauri:build
```

### 测试

```bash
# 前端测试
npm test

# Rust 测试
cd src-tauri
cargo test
```

## 项目结构

```
todo-desktop-app/
├── src/                # React 前端
│   ├── components/     # 组件
│   ├── pages/          # 页面
│   └── store/          # 状态管理
├── src-tauri/          # Rust 后端
│   └── src/            # Rust 源码
└── docs/               # 文档
```

## 需要帮助？

- 📖 阅读 [开发文档](DEVELOPMENT.md)
- 💬 在 [Discussions](https://github.com/en-o/todoDesktop/discussions) 提问
- 🐛 在 [Issues](https://github.com/en-o/todoDesktop/issues) 报告问题

## 行为准则

- 尊重他人
- 接受建设性批评
- 专注于对社区最有利的事情
- 对其他社区成员表示同理心

## 许可证

贡献的代码将使用与项目相同的 MIT 许可证。

---

再次感谢你的贡献！🎉
