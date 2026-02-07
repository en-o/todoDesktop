@echo off
chcp 65001 >nul
echo ========================================
echo 同步历史附件到 Git 远程仓库
echo ========================================
echo.

:: 检查是否在 git 仓库中
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo 错误: 当前目录不是 Git 仓库
    echo 请在你的 Todo 数据目录中运行此脚本
    pause
    exit /b 1
)

echo 当前目录: %CD%
echo.

:: 查找所有 assets 目录下的文件
echo 正在查找未提交的附件...
for /r %%i in (assets\*) do (
    echo 发现: %%i
)
echo.

:: 添加所有 assets 目录
echo 正在添加所有附件到 Git...
git add **/assets/* 2>nul
git add */*/assets/* 2>nul

:: 检查是否有变化
git diff --cached --quiet
if errorlevel 1 (
    echo 正在提交附件...
    git commit -m "chore: 同步历史附件"

    echo.
    echo 正在推送到远程仓库...
    git push

    echo.
    echo ========================================
    echo 完成! 所有历史附件已同步到远程仓库
    echo ========================================
) else (
    echo 没有发现需要同步的附件
)

echo.
pause
