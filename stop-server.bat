@echo off
chcp 65001 >nul
title AgentHQ - Stopping Server...
echo ==========================================
echo Stopping AgentHQ Server...
echo ==========================================
echo.

REM Kill processes on port 3000 (Next.js dev server)
echo Killing Next.js dev server (port 3000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
 echo Killing PID %%a...
 taskkill /F /PID %%a >nul 2>&1
)

REM Kill node server processes (server/index.js, worker.ts)
echo Killing API server and worker processes...
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH ^| findstr /I "node"') do (
 echo Killing PID %%a...
 taskkill /F /PID %%a >nul 2>&1
)

echo.
echo All AgentHQ processes stopped.
timeout /t 2 /nobreak >nul
