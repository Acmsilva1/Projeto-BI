# Hospital BI — FastAPI. PYTHONPATH = raiz do repositório (bi_core, bi_gerencia, bi_api).
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Error "Python não está no PATH."
}

python -m pip install -r (Join-Path $repoRoot "requirements.txt")

if (-not $env:HOSPITAL_BI_API_PORT) {
    $env:HOSPITAL_BI_API_PORT = "3020"
}

$env:PYTHONPATH = $repoRoot
Write-Host "[bi_api] PYTHONPATH=$repoRoot HOSPITAL_BI_API_PORT=$env:HOSPITAL_BI_API_PORT"
python -m uvicorn bi_api.main:app --host 127.0.0.1 --port $env:HOSPITAL_BI_API_PORT
