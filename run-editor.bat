@echo off
cd /d "%~dp0"

if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

start "battle-editor-dev" cmd /k "npm run dev"

timeout /t 3 /nobreak >nul
start http://localhost:3001
