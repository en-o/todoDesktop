@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    Todo Desktop 快速发布脚本
echo    (使用当前版本号直接发布)
echo ========================================
echo.

:: 检查是否在 git 仓库中
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo [错误] 当前目录不是 Git 仓库
    pause
    exit /b 1
)

:: 检查是否有未提交的更改
git diff --quiet --cached
git diff --quiet
if errorlevel 1 (
    echo [警告] 检测到未提交的更改：
    git status --short
    echo.
    echo [错误] 请先提交所有更改后再发布
    pause
    exit /b 1
)

:: 读取当前版本
for /f "tokens=2 delims=:, " %%a in ('findstr /C:"\"version\"" src-tauri\tauri.conf.json') do (
    set CURRENT_VERSION=%%~a
    goto :found_version
)
:found_version

:: 去掉引号
set CURRENT_VERSION=%CURRENT_VERSION:"=%

echo 当前版本: %CURRENT_VERSION%
echo.

:: 检查标签是否已存在
git tag -l "v%CURRENT_VERSION%" | findstr "v%CURRENT_VERSION%" >nul
if not errorlevel 1 (
    echo [错误] 标签 v%CURRENT_VERSION% 已存在
    echo 请先更新版本号，或使用 release.bat 脚本
    pause
    exit /b 1
)

echo 即将执行以下操作：
echo   1. 创建 Git 标签 v%CURRENT_VERSION%
echo   2. 推送到远程仓库触发自动构建
echo.
set /p CONFIRM="确认发布 v%CURRENT_VERSION%？(y/n): "
if /i not "%CONFIRM%"=="y" (
    echo 已取消
    pause
    exit /b 0
)

echo.
echo [1/2] 创建 Git 标签 v%CURRENT_VERSION%...
git tag -a "v%CURRENT_VERSION%" -m "Release v%CURRENT_VERSION%"
if errorlevel 1 (
    echo [错误] 创建标签失败
    pause
    exit /b 1
)

echo [2/2] 推送到远程仓库...
git push origin main
git push origin "v%CURRENT_VERSION%"
if errorlevel 1 (
    echo [错误] 推送失败
    pause
    exit /b 1
)

echo.
echo ========================================
echo    发布成功！
echo ========================================
echo.
echo 版本: v%CURRENT_VERSION%
echo.
echo GitHub Actions 将自动开始构建，请访问：
echo https://github.com/你的用户名/todoDesktop/actions
echo.

pause
