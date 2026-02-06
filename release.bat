@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

:: Todo Desktop 快速发版脚本 (Windows)
:: 用法: release.bat 0.2.0

if "%~1"=="" (
    echo.
    echo Todo Desktop 快速发版脚本
    echo.
    echo 用法: %~nx0 ^<版本号^>
    echo.
    echo 示例:
    echo   %~nx0 0.0.2
    echo   %~nx0 1.0.0
    echo.
    exit /b 1
)

set VERSION=%~1

:: 验证版本号格式 (简单检查是否包含两个点)
for /f "tokens=1,2,3 delims=." %%a in ("%VERSION%") do (
    if "%%c"=="" (
        echo [ERROR] 版本号格式无效: %VERSION% ^(应为 x.y.z 格式，如 0.0.2^)
        exit /b 1
    )
)

echo [INFO] 目标版本: %VERSION%

:: 检查是否在 git 仓库中
if not exist ".git" (
    echo [ERROR] 当前目录不是 git 仓库
    exit /b 1
)

:: 检查是否有未提交的更改
git diff --quiet 2>nul
if errorlevel 1 (
    echo [WARN] 检测到未提交的更改:
    git status --short
    echo.
    set /p COMMIT_CHANGES="先提交这些更改? (y/n): "
    if /i "!COMMIT_CHANGES!"=="y" (
        set /p COMMIT_MSG="输入提交信息: "
        git add -A
        git commit -m "!COMMIT_MSG!"
        if errorlevel 1 (
            echo [ERROR] 提交失败
            exit /b 1
        )
    ) else (
        echo [ERROR] 请先处理未提交的更改
        exit /b 1
    )
)

:: 检查标签是否已存在
git tag -l "v%VERSION%" | findstr "v%VERSION%" >nul 2>&1
if not errorlevel 1 (
    echo [ERROR] 标签 v%VERSION% 已存在，请使用其他版本号
    exit /b 1
)

echo.
echo [INFO] 开始更新版本号...

:: 1. 更新 package.json
echo [INFO] 更新 package.json...
if not exist "package.json" (
    echo [ERROR] 找不到 package.json
    exit /b 1
)

node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='%VERSION%';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"
if errorlevel 1 (
    echo [ERROR] 更新 package.json 失败
    exit /b 1
)
echo [SUCCESS] package.json -^> %VERSION%

:: 2. 更新 package-lock.json
echo [INFO] 更新 package-lock.json...
if exist "package-lock.json" (
    call npm install --package-lock-only --ignore-scripts --silent 2>nul
    if errorlevel 1 (
        echo [WARN] 更新 package-lock.json 失败，跳过
    ) else (
        echo [SUCCESS] package-lock.json -^> %VERSION%
    )
) else (
    echo [WARN] 找不到 package-lock.json，跳过
)

:: 3. 更新 src-tauri/tauri.conf.json
echo [INFO] 更新 src-tauri/tauri.conf.json...
if not exist "src-tauri\tauri.conf.json" (
    echo [ERROR] 找不到 src-tauri/tauri.conf.json
    exit /b 1
)

node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8'));c.package.version='%VERSION%';fs.writeFileSync('src-tauri/tauri.conf.json',JSON.stringify(c,null,2)+'\n');"
if errorlevel 1 (
    echo [ERROR] 更新 src-tauri/tauri.conf.json 失败
    exit /b 1
)
echo [SUCCESS] src-tauri/tauri.conf.json -^> %VERSION%

:: 4. 更新 src-tauri/Cargo.toml
echo [INFO] 更新 src-tauri/Cargo.toml...
if not exist "src-tauri\Cargo.toml" (
    echo [ERROR] 找不到 src-tauri/Cargo.toml
    exit /b 1
)

node -e "const fs=require('fs');let c=fs.readFileSync('src-tauri/Cargo.toml','utf8');c=c.replace(/^version = \"[0-9]+\.[0-9]+\.[0-9]+\"/m,'version = \"%VERSION%\"');fs.writeFileSync('src-tauri/Cargo.toml',c);"
if errorlevel 1 (
    echo [ERROR] 更新 src-tauri/Cargo.toml 失败
    exit /b 1
)
echo [SUCCESS] src-tauri/Cargo.toml -^> %VERSION%

:: 5. 更新 src-tauri/Cargo.lock
echo [INFO] 更新 src-tauri/Cargo.lock...
if exist "src-tauri\Cargo.lock" (
    pushd src-tauri
    cargo update -p todo-desktop --quiet 2>nul
    popd
    if errorlevel 1 (
        echo [WARN] 更新 src-tauri/Cargo.lock 失败，跳过
    ) else (
        echo [SUCCESS] src-tauri/Cargo.lock -^> %VERSION%
    )
) else (
    echo [WARN] 找不到 src-tauri/Cargo.lock，跳过
)

echo.
echo [INFO] 版本号更新完成，开始 Git 操作...

:: 6. Git add
echo [INFO] 暂存更改...
git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock 2>nul
if errorlevel 1 (
    echo [ERROR] git add 失败
    exit /b 1
)

:: 7. Git commit
echo [INFO] 提交更改...
git commit -m "chore: release v%VERSION%"
if errorlevel 1 (
    echo [ERROR] git commit 失败
    exit /b 1
)
echo [SUCCESS] 提交完成

:: 8. 创建标签
echo [INFO] 创建标签 v%VERSION%...
git tag -a "v%VERSION%" -m "Release v%VERSION%"
if errorlevel 1 (
    echo [ERROR] 创建标签失败
    exit /b 1
)
echo [SUCCESS] 标签创建完成

:: 9. 推送到远程
echo [INFO] 推送到远程...
git push origin main
git push origin "v%VERSION%"
if errorlevel 1 (
    echo [ERROR] 推送失败
    exit /b 1
)
echo [SUCCESS] 推送完成

echo.
echo ========================================
echo   发版成功！
echo ========================================
echo.
echo 版本号: v%VERSION%
echo 标签:   v%VERSION%
echo.
echo GitHub Actions 将自动开始构建。
echo 请查看: https://github.com/YOUR_USERNAME/todoDesktop/actions
echo.
echo 发布页面: https://github.com/YOUR_USERNAME/todoDesktop/releases
echo.

endlocal
