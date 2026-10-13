@echo off
cd /d "%~dp0"
echo Installing dependencies. This may take a few minutes...
call npm install
if errorlevel 1 (
  echo.
  echo Installation failed. Please take a screenshot of this window and send it to ChatGPT.
  pause
  exit /b 1
)
if not exist .env copy .env.example .env
call npm start
pause
