@echo off
chcp 65001 >nul
title AgentHQ - Starting Server...
echo ==========================================
echo AgentHQ Dev Server Launcher
echo ==========================================
echo.
echo Starting Next.js + API Server + Worker...
echo.
cd /d "%~dp0"
start "AgentHQ - Next.js" cmd /c "npm run dev"
echo Server started!
echo.
echo Access the app at: http://localhost:3000
echo.
echo To STOP the server, run: stop-server.bat
echo.
pause
