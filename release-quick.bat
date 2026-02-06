@echo off
setlocal EnableDelayedExpansion

:: Todo Desktop Quick Release Script (uses current version)

echo ========================================
echo   Todo Desktop Quick Release
echo ========================================
echo.

:: Check git repo
if not exist ".git" (
    echo [ERROR] Not a git repository
    pause
    exit /b 1
)

:: Check uncommitted changes
git diff --quiet --cached 2>nul
git diff --quiet 2>nul
if errorlevel 1 (
    echo [WARN] Uncommitted changes detected:
    git status --short
    echo.
    echo [ERROR] Please commit all changes first
    pause
    exit /b 1
)

:: Read current version
if not exist "src-tauri\tauri.conf.json" (
    echo [ERROR] src-tauri/tauri.conf.json not found
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -e "console.log(JSON.parse(require('fs').readFileSync('src-tauri/tauri.conf.json','utf8').replace(/^\uFEFF/,'')).package.version)"') do set VERSION=%%i

if "%VERSION%"=="" (
    echo [ERROR] Could not read version
    pause
    exit /b 1
)

echo [INFO] Current version: %VERSION%
echo.

:: Check if tag exists
git tag -l "v%VERSION%" | findstr "v%VERSION%" >nul 2>&1
if not errorlevel 1 (
    echo [ERROR] Tag v%VERSION% already exists
    echo Please update version first or use release.bat
    pause
    exit /b 1
)

echo Actions:
echo   1. Create Git tag v%VERSION%
echo   2. Push to remote
echo.
set /p CONFIRM="Release v%VERSION%? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo Cancelled
    pause
    exit /b 0
)

echo.
echo [INFO] Creating tag v%VERSION%...
git tag -a "v%VERSION%" -m "Release v%VERSION%"
if errorlevel 1 (
    echo [ERROR] Failed to create tag
    pause
    exit /b 1
)
echo [OK] Tag created

echo [INFO] Pushing to remote...
git push origin main
git push origin "v%VERSION%"
if errorlevel 1 (
    echo [ERROR] Push failed
    pause
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

pause
