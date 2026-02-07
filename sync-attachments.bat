@echo off
chcp 65001 >nul
echo ========================================
echo 同步历史附件到 Git 远程仓库
echo ========================================
echo.

:: 读取配置文件获取数据目录
set CONFIG_FILE=%APPDATA%\com.todo.desktop\config.json

if not exist "%CONFIG_FILE%" (
    echo 错误: 未找到配置文件
    echo 路径: %CONFIG_FILE%
    echo 请先在应用中配置本地数据目录
    pause
    exit /b 1
)

echo 读取配置文件: %CONFIG_FILE%

:: 使用 PowerShell 解析 JSON 获取配置
for /f "usebackq delims=" %%i in (`powershell -Command "(Get-Content '%CONFIG_FILE%' | ConvertFrom-Json).localPath"`) do set DATA_DIR=%%i
for /f "usebackq delims=" %%i in (`powershell -Command "(Get-Content '%CONFIG_FILE%' | ConvertFrom-Json).remoteUrl"`) do set REMOTE_URL=%%i

if "%DATA_DIR%"=="" (
    echo 错误: 无法读取本地数据目录配置
    pause
    exit /b 1
)

echo 数据目录: %DATA_DIR%
echo 远程仓库: %REMOTE_URL%
echo.

:: 切换到数据目录
cd /d "%DATA_DIR%"
if errorlevel 1 (
    echo 错误: 无法切换到数据目录
    pause
    exit /b 1
)

:: 检查是否在 git 仓库中
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo 错误: 数据目录不是 Git 仓库
    pause
    exit /b 1
)

:: 获取当前分支
for /f "delims=" %%i in ('git rev-parse --abbrev-ref HEAD') do set CURRENT_BRANCH=%%i

echo 当前目录: %CD%
echo 当前分支: %CURRENT_BRANCH%
echo.

:: 确保远程仓库配置正确
if not "%REMOTE_URL%"=="" (
    echo 检查远程仓库配置...
    git remote set-url origin "%REMOTE_URL%" 2>nul || git remote add origin "%REMOTE_URL%" 2>nul
)

:: 查看当前状态
echo 检查 Git 状态...
git status --short

echo.
echo 正在添加所有 assets 目录下的文件...

:: 添加所有 assets 目录
git add */*/assets/* 2>nul
git add */assets/* 2>nul

:: 显示将要提交的内容
echo.
echo 待提交的文件:
git diff --cached --name-only

:: 检查是否有变化
git diff --cached --quiet
if errorlevel 1 (
    echo.
    echo 正在提交附件...
    git commit -m "chore: 同步历史附件"

    echo.
    echo 正在推送到远程仓库 [%REMOTE_URL%] 分支 [%CURRENT_BRANCH%]...
    git push origin %CURRENT_BRANCH%

    echo.
    echo ========================================
    echo 完成! 所有历史附件已同步到远程仓库
    echo ========================================
) else (
    echo.
    echo 没有发现需要同步的新附件
    echo.
    echo 检查是否有未推送的提交...
    git log origin/%CURRENT_BRANCH%..HEAD --oneline 2>nul

    :: 检查是否有未推送的提交
    for /f %%i in ('git rev-list origin/%CURRENT_BRANCH%..HEAD --count 2^>nul') do set UNPUSHED=%%i
    if not "%UNPUSHED%"=="0" if not "%UNPUSHED%"=="" (
        echo.
        echo 发现 %UNPUSHED% 个未推送的提交，正在推送...
        git push origin %CURRENT_BRANCH%
        echo 推送完成!
    )
)

echo.
pause
