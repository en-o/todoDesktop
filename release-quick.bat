@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: Todo Desktop 快速发版脚本 (使用当前版本号)

echo ========================================
echo    Todo Desktop 快速发版脚本
echo    (使用当前版本号)
echo ========================================
echo.

:: 检查是否在 git 仓库中
if not exist ".git" (
    echo [ERROR] 当前目录不是 git 仓库
    pause
    exit /b 1
)

:: 检查是否有未提交的更改
git diff --quiet --cached 2>nul
git diff --quiet 2>nul
if errorlevel 1 (
    echo [WARN] 检测到未提交的更改:
    git status --short
    echo.
    echo [ERROR] 请先提交所有更改再发版
    pause
    exit /b 1
)

:: 读取当前版本号
if not exist "src-tauri\tauri.conf.json" (
    echo [ERROR] 找不到 src-tauri/tauri.conf.json
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -e "console.log(JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8')).package.version)"') do set VERSION=%%i

if "%VERSION%"=="" (
    echo [ERROR] 无法读取版本号
    pause
    exit /b 1
)

echo [INFO] 当前版本: %VERSION%
echo.

:: 检查标签是否已存在
git tag -l "v%VERSION%" | findstr "v%VERSION%" >nul 2>&1
if not errorlevel 1 (
    echo [ERROR] 标签 v%VERSION% 已存在
    echo 请先更新版本号，或使用 release.bat 指定新版本
    pause
    exit /b 1
)

echo 将要执行的操作:
echo   1. 创建 Git 标签 v%VERSION%
echo   2. 推送到远程触发构建
echo.
set /p CONFIRM="发布 v%VERSION%? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo 已取消
    pause
    exit /b 0
)

echo.
echo [INFO] 创建标签 v%VERSION%...
git tag -a "v%VERSION%" -m "Release v%VERSION%"
if errorlevel 1 (
    echo [ERROR] 创建标签失败
    pause
    exit /b 1
)
echo [SUCCESS] 标签创建完成

echo [INFO] 推送到远程...
git push origin main
git push origin "v%VERSION%"
if errorlevel 1 (
    echo [ERROR] 推送失败
    pause
    exit /b 1
)
echo [SUCCESS] 推送完成

echo.
echo ========================================
echo   发版成功！
echo ========================================
echo.
echo 版本号: v%VERSION%
echo.
echo GitHub Actions 将自动开始构建。
echo 请查看: https://github.com/YOUR_USERNAME/todoDesktop/actions
echo.

pause
