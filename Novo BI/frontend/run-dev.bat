@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "FREE_PORTS=%~dp0..\scripts\free-ports.ps1"
if not exist "%FREE_PORTS%" (
  echo [ERRO] Não encontrei: "%FREE_PORTS%"
  pause
  exit /b 1
)

echo.
echo [1/3] Liberando portas 3001 e 5173 ^(se estiverem em uso^)...
powershell -NoProfile -ExecutionPolicy Bypass -File "%FREE_PORTS%"

echo.
echo [2/3] Iniciando API ^(3001^) + Vite ^(5173^) — Ctrl+C para encerrar com limpeza automática.
echo.
npm run dev

echo.
echo [3/3] Servidor encerrado — liberando portas novamente...
powershell -NoProfile -ExecutionPolicy Bypass -File "%FREE_PORTS%"
echo Pronto.
pause
