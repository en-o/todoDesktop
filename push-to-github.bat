@echo off
chcp 65001 >nul
echo 🚀 开始推送到 GitHub...
echo.

cd /d "%~dp0"

REM 检查是否已初始化
if not exist ".git" (
    echo 📦 初始化 Git 仓库...
    git init
)

echo 📝 添加文件...
git add .

echo 💾 提交更改...
git commit -m "Initial commit: Todo Desktop App with Tauri" -m "" -m "Features:" -m "- 📅 Year/Month/Day calendar navigation" -m "- 📝 Markdown editor with preview" -m "- 🔄 Git version control" -m "- ☁️ Support GitHub/GitLab/Gitee" -m "- ⚙️ Flexible configuration"

REM 检查远程仓库
git remote | findstr "origin" >nul
if errorlevel 1 (
    echo 🔗 添加远程仓库...
    git remote add origin https://github.com/en-o/todoDesktop.git
)

echo 🌿 设置主分支...
git branch -M main

echo 🚀 推送到 GitHub...
git push -u origin main

if errorlevel 1 (
    echo.
    echo ⚠️  推送失败，可能需要先拉取远程更改
    echo 正在尝试拉取并合并...
    git pull origin main --allow-unrelated-histories
    git push -u origin main
)

echo.
echo ✅ 推送完成！
echo 📦 访问仓库: https://github.com/en-o/todoDesktop
echo.
pause
