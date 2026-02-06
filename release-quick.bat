@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ========================================
echo    Todo Desktop Quick Release Script
echo    (Use current version number)
echo ========================================
echo.

:: Check if in git repository
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo [Error] Not a Git repository
    pause
    exit /b 1
)

:: Check for uncommitted changes
git diff --quiet --cached 2>nul
git diff --quiet 2>nul
if errorlevel 1 (
    echo [Warning] Uncommitted changes detected:
    git status --short
    echo.
    echo [Error] Please commit all changes before release
    pause
    exit /b 1
)

:: Read current version
for /f "tokens=2 delims=:, " %%a in ('findstr /C:"\"version\"" src-tauri\tauri.conf.json') do (
    set CURRENT_VERSION=%%~a
    goto :found_version
)
:found_version

:: Remove quotes
set CURRENT_VERSION=%CURRENT_VERSION:"=%

echo Current version: %CURRENT_VERSION%
echo.

:: Check if tag already exists
git tag -l "v%CURRENT_VERSION%" | findstr "v%CURRENT_VERSION%" >nul 2>&1
if not errorlevel 1 (
    echo [Error] Tag v%CURRENT_VERSION% already exists
    echo Please update version number first, or use release.bat
    pause
    exit /b 1
)

echo Actions to perform:
echo   1. Create Git tag v%CURRENT_VERSION%
echo   2. Push to remote to trigger build
echo.
set /p CONFIRM="Release v%CURRENT_VERSION%? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo Cancelled
    pause
    exit /b 0
)

echo.
echo [1/2] Creating Git tag v%CURRENT_VERSION%...
git tag -a "v%CURRENT_VERSION%" -m "Release v%CURRENT_VERSION%"
if errorlevel 1 (
    echo [Error] Failed to create tag
    pause
    exit /b 1
)

echo [2/2] Pushing to remote...
git push origin main
git push origin "v%CURRENT_VERSION%"
if errorlevel 1 (
    echo [Error] Push failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo    Release Successful!
echo ========================================
echo.
echo Version: v%CURRENT_VERSION%
echo.
echo GitHub Actions will start building automatically.
echo Check: https://github.com/YOUR_USERNAME/todoDesktop/actions
echo.

pause
