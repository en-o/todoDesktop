@echo off
setlocal EnableDelayedExpansion

:: Todo Desktop Release Script
:: Usage: release.bat 0.2.0

if "%~1"=="" (
    echo.
    echo Todo Desktop Release Script
    echo.
    echo Usage: %~nx0 ^<version^>
    echo Example: %~nx0 0.0.2
    echo.
    exit /b 1
)

set VERSION=%~1

:: Validate version format
for /f "tokens=1,2,3 delims=." %%a in ("%VERSION%") do (
    if "%%c"=="" (
        echo [ERROR] Invalid version format: %VERSION% - should be x.y.z
        exit /b 1
    )
)

echo [INFO] Target version: %VERSION%

:: Check git repo
if not exist ".git" (
    echo [ERROR] Not a git repository
    exit /b 1
)

:: Check uncommitted changes
git diff --quiet 2>nul
if errorlevel 1 (
    echo [WARN] Uncommitted changes detected:
    git status --short
    echo.
    set /p COMMIT_CHANGES="Commit these changes first? (y/n): "
    if /i "!COMMIT_CHANGES!"=="y" (
        set /p COMMIT_MSG="Enter commit message: "
        git add -A
        git commit -m "!COMMIT_MSG!"
        if errorlevel 1 (
            echo [ERROR] Commit failed
            exit /b 1
        )
    ) else (
        echo [ERROR] Please handle uncommitted changes first
        exit /b 1
    )
)

:: Check if tag exists
git tag -l "v%VERSION%" | findstr "v%VERSION%" >nul 2>&1
if not errorlevel 1 (
    echo [ERROR] Tag v%VERSION% already exists
    exit /b 1
)

echo.
echo [INFO] Updating version numbers...

:: 1. Update package.json
echo [INFO] Updating package.json...
if not exist "package.json" (
    echo [ERROR] package.json not found
    exit /b 1
)

node -e "const fs=require('fs');let s=fs.readFileSync('package.json','utf8').replace(/^\uFEFF/,'');const p=JSON.parse(s);p.version='%VERSION%';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');"
if errorlevel 1 (
    echo [ERROR] Failed to update package.json
    exit /b 1
)
echo [OK] package.json

:: 2. Update package-lock.json
echo [INFO] Updating package-lock.json...
if exist "package-lock.json" (
    call npm install --package-lock-only --ignore-scripts --silent 2>nul
    echo [OK] package-lock.json
) else (
    echo [SKIP] package-lock.json not found
)

:: 3. Update tauri.conf.json
echo [INFO] Updating src-tauri/tauri.conf.json...
if not exist "src-tauri\tauri.conf.json" (
    echo [ERROR] src-tauri/tauri.conf.json not found
    exit /b 1
)

node -e "const fs=require('fs');let s=fs.readFileSync('src-tauri/tauri.conf.json','utf8').replace(/^\uFEFF/,'');const c=JSON.parse(s);c.package.version='%VERSION%';fs.writeFileSync('src-tauri/tauri.conf.json',JSON.stringify(c,null,2)+'\n');"
if errorlevel 1 (
    echo [ERROR] Failed to update tauri.conf.json
    exit /b 1
)
echo [OK] tauri.conf.json

:: 4. Update Cargo.toml
echo [INFO] Updating src-tauri/Cargo.toml...
if not exist "src-tauri\Cargo.toml" (
    echo [ERROR] src-tauri/Cargo.toml not found
    exit /b 1
)

node -e "const fs=require('fs');let c=fs.readFileSync('src-tauri/Cargo.toml','utf8').replace(/^\uFEFF/,'');c=c.replace(/^version = \"[0-9]+\.[0-9]+\.[0-9]+\"/m,'version = \"%VERSION%\"');fs.writeFileSync('src-tauri/Cargo.toml',c);"
if errorlevel 1 (
    echo [ERROR] Failed to update Cargo.toml
    exit /b 1
)
echo [OK] Cargo.toml

echo.
echo [INFO] Git operations...

:: 5. Git add
git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml 2>nul

:: 6. Git commit
git commit -m "chore: release v%VERSION%"
if errorlevel 1 (
    echo [ERROR] Commit failed
    exit /b 1
)
echo [OK] Committed

:: 7. Create tag
git tag -a "v%VERSION%" -m "Release v%VERSION%"
if errorlevel 1 (
    echo [ERROR] Failed to create tag
    exit /b 1
)
echo [OK] Tag created

:: 8. Push
git push origin main
git push origin "v%VERSION%"
if errorlevel 1 (
    echo [ERROR] Push failed
    exit /b 1
)
echo [OK] Pushed

echo.
echo ========================================
echo   Release Successful!
echo ========================================
echo.
echo Version: v%VERSION%
echo.
echo GitHub Actions will start building.
echo.

endlocal
