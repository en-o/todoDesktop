@echo off
chcp 65001 >nul
echo 正在关闭 Todo Desktop...

:: 方法1: 通过运行带 --quit 参数的应用来优雅关闭
start "" "%LOCALAPPDATA%\Todo Desktop\Todo Desktop.exe" --quit 2>nul

:: 等待一秒让应用有时间响应
timeout /t 1 /nobreak >nul

:: 方法2: 如果还在运行，强制结束进程
taskkill /F /IM "Todo Desktop.exe" 2>nul

echo 完成！现在可以运行安装程序了。
pause
