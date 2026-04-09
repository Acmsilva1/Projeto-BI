@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

rem Raiz = pasta Novo BI (onde está este .bat)
set "ROOT=%~dp0"
set "FRONT=%ROOT%frontend"
set "FREE_PORTS=%ROOT%scripts\free-ports.ps1"

if not exist "%FRONT%\package.json" (
  echo.
  echo [ERRO] Não encontrei o frontend em:
  echo        "%FRONT%"
  echo.
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
  echo [ERRO] npm não está no PATH. Instale o Node.js e reabra o terminal.
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
echo Limpando portas 3001 e 5173 antes de iniciar...
powershell -NoProfile -ExecutionPolicy Bypass -File "%FREE_PORTS%"
echo.
echo Abrindo janela de desenvolvimento ^(Ctrl+C para encerrar^).
echo.

start "Hospital BI — API 3001 ^| Vite 5173" cmd /k ""%FRONT%\run-dev.bat""

exit /b 0
