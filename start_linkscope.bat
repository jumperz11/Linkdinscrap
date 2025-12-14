@echo off
title LinkScope Bot Launcher
cls
echo ---------------------------------------
echo   LinkScope Launcher (Debug Mode)
echo ---------------------------------------
echo.

REM Move to the script execution directory
cd /d "%~dp0"
echo Current directory: %CD%
echo.

REM Check Node.js
echo [1/4] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is NOT installed or NOT in your PATH.
    echo Please install it from https://nodejs.org/
    echo.
    pause
    goto :EOF
)
echo Node.js is installed.
echo.

REM Check Dependencies
echo [2/4] Checking dependencies...
if not exist "node_modules" (
    echo Installing npm packages...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed.
        pause
        goto :EOF
    )
) else (
    echo Dependencies found.
)
echo.

REM Launch Browser
echo [3/4] Launching Dashboard...
:: Wait a moment for cleanup
timeout /t 2 >nul
start "" "http://localhost:3000"
echo.

REM Start Server
echo [4/4] Starting Server...
echo ---------------------------------------
echo Server logs will appear below.
echo Press Ctrl+C to stop.
echo ---------------------------------------
echo.

:: Kill any existing process on port 3000 (Clean Start)
echo Cleaning up old processes...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do taskkill /f /pid %%a >nul 2>nul
timeout /t 1 >nul

:: Run the server
call npx ts-node src/server.ts

echo.
echo Server has stopped or crashed.
pause
