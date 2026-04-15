# Arranque local: API + Vite com portas fixas para o proxy coincidir.
$ErrorActionPreference = 'Stop'
$env:HOSPITAL_BI_API_PORT = '3020'
$env:VITE_PORT = '5180'
Set-Location $PSScriptRoot
npm run dev
