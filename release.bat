@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo    Todo Desktop 自动发布脚本
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
git diff --quiet
if errorlevel 1 (
    echo [警告] 检测到未提交的更改：
    git status --short
    echo.
    set /p COMMIT_CHANGES="是否先提交这些更改？(y/n): "
    if /i "!COMMIT_CHANGES!"=="y" (
        set /p COMMIT_MSG="请输入提交信息: "
        git add -A
        git commit -m "!COMMIT_MSG!"
        if errorlevel 1 (
            echo [错误] 提交失败
            pause
            exit /b 1
        )
    ) else (
        echo [错误] 请先处理未提交的更改
        pause
        exit /b 1
    )
)

:: 读取当前版本
for /f "tokens=2 delims=:, " %%a in ('findstr /C:"\"version\"" src-tauri\tauri.conf.json') do (
    set CURRENT_VERSION=%%~a
    goto :found_version
)
:found_version
echo 当前版本: %CURRENT_VERSION%
echo.

:: 输入新版本号
set /p NEW_VERSION="请输入新版本号 (如 1.0.1): "
if "%NEW_VERSION%"=="" (
    echo [错误] 版本号不能为空
    pause
    exit /b 1
)

echo.
echo 即将执行以下操作：
echo   1. 更新 package.json 版本为 %NEW_VERSION%
echo   2. 更新 src-tauri/tauri.conf.json 版本为 %NEW_VERSION%
echo   3. 更新 src-tauri/Cargo.toml 版本为 %NEW_VERSION%
echo   4. 提交版本更新
echo   5. 创建 Git 标签 v%NEW_VERSION%
echo   6. 推送到远程仓库触发自动构建
echo.
set /p CONFIRM="确认继续？(y/n): "
if /i not "%CONFIRM%"=="y" (
    echo 已取消
    pause
    exit /b 0
)

echo.
echo [1/6] 更新 package.json...
powershell -Command "(Get-Content package.json) -replace '\"version\": \"[^\"]+\"', '\"version\": \"%NEW_VERSION%\"' | Set-Content package.json"
if errorlevel 1 (
    echo [错误] 更新 package.json 失败
    pause
    exit /b 1
)

echo [2/6] 更新 src-tauri/tauri.conf.json...
powershell -Command "$json = Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json; $json.package.version = '%NEW_VERSION%'; $json | ConvertTo-Json -Depth 10 | Set-Content src-tauri/tauri.conf.json"
if errorlevel 1 (
    echo [错误] 更新 tauri.conf.json 失败
    pause
    exit /b 1
)

echo [3/6] 更新 src-tauri/Cargo.toml...
powershell -Command "(Get-Content src-tauri/Cargo.toml) -replace '^version = \"[^\"]+\"', 'version = \"%NEW_VERSION%\"' | Set-Content src-tauri/Cargo.toml"
if errorlevel 1 (
    echo [错误] 更新 Cargo.toml 失败
    pause
    exit /b 1
)

echo [4/6] 提交版本更新...
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to %NEW_VERSION%"
if errorlevel 1 (
    echo [错误] 提交失败
    pause
    exit /b 1
)

echo [5/6] 创建 Git 标签 v%NEW_VERSION%...
git tag -a "v%NEW_VERSION%" -m "Release v%NEW_VERSION%"
if errorlevel 1 (
    echo [错误] 创建标签失败
    pause
    exit /b 1
)

echo [6/6] 推送到远程仓库...
git push origin main
git push origin "v%NEW_VERSION%"
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
echo 版本: v%NEW_VERSION%
echo 标签: v%NEW_VERSION%
echo.
echo GitHub Actions 将自动开始构建，请访问：
echo https://github.com/你的用户名/todoDesktop/actions
echo.
echo 构建完成后，Release 将出现在：
echo https://github.com/你的用户名/todoDesktop/releases
echo.

pause
