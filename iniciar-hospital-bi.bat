@echo off
chcp 65001 >nul
setlocal

rem Único ponto de entrada: API (3020) + Vite (5180)
set "ROOT=%~dp0"
set "FRONT=%ROOT%web"
set "FREE_PORTS=%ROOT%scripts\free-ports.ps1"
set "API_PORT=3020"
set "VITE_PORT=5180"

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
echo   API ^(Express^) :  http://127.0.0.1:%API_PORT%
echo   App ^(Vite^)    :  http://127.0.0.1:%VITE_PORT%
echo ============================================
echo.
echo Abra o Vite no Chrome ou Edge ^(nao use o Simple Browser do Cursor^).
echo.
echo [1/3] Liberando portas %API_PORT% e %VITE_PORT%...
powershell -NoProfile -ExecutionPolicy Bypass -File "%FREE_PORTS%" -Ports %API_PORT%,%VITE_PORT%

cd /d "%FRONT%"
echo.
echo [2/3] Iniciando stack ^(Ctrl+C para encerrar^).
echo.
set "PORT=%API_PORT%"
set "VITE_PORT=%VITE_PORT%"
echo Abrindo o navegador padrao em 5s em http://127.0.0.1:%VITE_PORT% ^(evita o Simple Browser do Cursor^).
start "" cmd /c "timeout /t 5 /nobreak >nul && start http://127.0.0.1:%VITE_PORT%/"
npm run dev

echo.
echo [3/3] Encerrado — liberando portas...
powershell -NoProfile -ExecutionPolicy Bypass -File "%FREE_PORTS%" -Ports %API_PORT%,%VITE_PORT%
echo Pronto.
pause
exit /b 0
