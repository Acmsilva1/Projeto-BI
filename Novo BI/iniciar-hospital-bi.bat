@echo off
chcp 65001 >nul
setlocal

rem Único ponto de entrada: API (3001) + Vite (5173)
set "ROOT=%~dp0"
set "FRONT=%ROOT%frontend"
set "FREE_PORTS=%ROOT%scripts\free-ports.ps1"

if not exist "%FRONT%\package.json" (
  echo [ERRO] Frontend não encontrado: "%FRONT%"
  pause
  exit /b 1
)

if not exist "%FREE_PORTS%" (
  echo [ERRO] Não encontrei: "%FREE_PORTS%"
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERRO] npm não está no PATH.
  pause
  exit /b 1
)

where powershell >nul 2>&1
if errorlevel 1 (
  echo [ERRO] PowerShell não encontrado no PATH.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   Hospital BI — desenvolvimento local
echo ============================================
echo   API ^(Express^) :  http://127.0.0.1:3001
echo   App ^(Vite^)    :  http://127.0.0.1:5173
echo ============================================
echo.
echo [1/3] Liberando portas 3001 e 5173...
powershell -NoProfile -ExecutionPolicy Bypass -File "%FREE_PORTS%"

cd /d "%FRONT%"
echo.
echo [2/3] Iniciando stack ^(Ctrl+C para encerrar^).
echo.
npm run dev

echo.
echo [3/3] Encerrado — liberando portas...
powershell -NoProfile -ExecutionPolicy Bypass -File "%FREE_PORTS%"
echo Pronto.
pause
exit /b 0
