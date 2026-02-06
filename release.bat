@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ========================================
echo    Todo Desktop Auto Release Script
echo ========================================
echo.

:: Check version parameter
if "%~1"=="" (
    echo [Error] Version number is required!
    echo.
    echo Usage: release.bat ^<version^>
    echo Example: release.bat 0.0.2
    echo.
    pause
    exit /b 1
)

set NEW_VERSION=%~1

:: Check if in git repository
git rev-parse --git-dir >nul 2>&1
if errorlevel 1 (
    echo [Error] Not a Git repository
    pause
    exit /b 1
)

:: Check for uncommitted changes
git diff --quiet 2>nul
if errorlevel 1 (
    echo [Warning] Uncommitted changes detected:
    git status --short
    echo.
    set /p COMMIT_CHANGES="Commit these changes first? (y/n): "
    if /i "!COMMIT_CHANGES!"=="y" (
        set /p COMMIT_MSG="Enter commit message: "
        git add -A
        git commit -m "!COMMIT_MSG!"
        if errorlevel 1 (
            echo [Error] Commit failed
            pause
            exit /b 1
        )
    ) else (
        echo [Error] Please handle uncommitted changes first
        pause
        exit /b 1
    )
)

:: Read current version
for /f "tokens=2 delims=:, " %%a in ('findstr /C:"\"version\"" src-tauri\tauri.conf.json') do (
    set CURRENT_VERSION=%%~a
    goto :found_version
)
:found_version
set CURRENT_VERSION=%CURRENT_VERSION:"=%
echo Current version: %CURRENT_VERSION%
echo New version: %NEW_VERSION%
echo.

echo Actions to perform:
echo   1. Update package.json to %NEW_VERSION%
echo   2. Update package-lock.json to %NEW_VERSION%
echo   3. Update src-tauri/tauri.conf.json to %NEW_VERSION%
echo   4. Update src-tauri/Cargo.toml to %NEW_VERSION%
echo   5. Commit version update
echo   6. Create Git tag v%NEW_VERSION%
echo   7. Push to remote to trigger build
echo.
set /p CONFIRM="Continue? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo Cancelled
    pause
    exit /b 0
)

echo.
echo [1/7] Updating package.json...
powershell -NoProfile -Command "$content = Get-Content package.json -Raw -Encoding UTF8; $content = $content -replace '\"version\": \"[^\"]+\"', '\"version\": \"%NEW_VERSION%\"'; Set-Content package.json -Value $content -Encoding UTF8"
if errorlevel 1 (
    echo [Error] Failed to update package.json
    pause
    exit /b 1
)

echo [2/7] Updating package-lock.json...
powershell -NoProfile -Command "$lines = Get-Content package-lock.json -Encoding UTF8; $updated = $false; for ($i = 0; $i -lt [Math]::Min(10, $lines.Length); $i++) { if (-not $updated -and $lines[$i] -match '\"version\":') { $lines[$i] = $lines[$i] -replace '\"version\": \"[^\"]+\"', '\"version\": \"%NEW_VERSION%\"'; $updated = $true } }; $lines | Set-Content package-lock.json -Encoding UTF8"
if errorlevel 1 (
    echo [Warning] Failed to update package-lock.json, skipping
)

echo [3/7] Updating src-tauri/tauri.conf.json...
powershell -NoProfile -Command "$json = Get-Content src-tauri/tauri.conf.json -Raw -Encoding UTF8 | ConvertFrom-Json; $json.package.version = '%NEW_VERSION%'; $json | ConvertTo-Json -Depth 10 | Set-Content src-tauri/tauri.conf.json -Encoding UTF8"
if errorlevel 1 (
    echo [Error] Failed to update tauri.conf.json
    pause
    exit /b 1
)

echo [4/7] Updating src-tauri/Cargo.toml...
powershell -NoProfile -Command "$content = Get-Content src-tauri/Cargo.toml -Raw -Encoding UTF8; $content = $content -replace '^version = \"[^\"]+\"', 'version = \"%NEW_VERSION%\"'; Set-Content src-tauri/Cargo.toml -Value $content -Encoding UTF8"
if errorlevel 1 (
    echo [Error] Failed to update Cargo.toml
    pause
    exit /b 1
)

echo [5/7] Committing version update...
git add package.json package-lock.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to %NEW_VERSION%"
if errorlevel 1 (
    echo [Error] Commit failed
    pause
    exit /b 1
)

echo [6/7] Creating Git tag v%NEW_VERSION%...
git tag -a "v%NEW_VERSION%" -m "Release v%NEW_VERSION%"
if errorlevel 1 (
    echo [Error] Failed to create tag
    pause
    exit /b 1
)

echo [7/7] Pushing to remote...
git push origin main
git push origin "v%NEW_VERSION%"
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
echo Version: v%NEW_VERSION%
echo Tag: v%NEW_VERSION%
echo.
echo GitHub Actions will start building automatically.
echo Check: https://github.com/YOUR_USERNAME/todoDesktop/actions
echo.
echo Release will be available at:
echo https://github.com/YOUR_USERNAME/todoDesktop/releases
echo.

pause
