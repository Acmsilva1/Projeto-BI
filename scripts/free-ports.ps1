# Libera portas do Hospital BI (Node/Vite) — encerra processos que estejam usando as portas.
param(
    [int[]]$Ports = @(3000, 5174)
)

try {
    $seen = @{}
    foreach ($port in $Ports) {
        $conns = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
        if ($conns.Count -eq 0) { continue }
        foreach ($c in $conns) {
            $procId = $c.OwningProcess
            if (-not $procId) { continue }
            if ($seen.ContainsKey($procId)) { continue }
            $seen[$procId] = $true
            try {
                $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
                if ($p) {
                    Write-Host "  Porta $port : encerrando PID $procId ($($p.ProcessName))" -ForegroundColor Yellow
                    Stop-Process -Id $procId -Force -ErrorAction Stop
                }
            } catch {
                # sem permissão ou processo já sumiu
            }
        }
    }
} catch {
    Write-Host "  [free-ports] Aviso: $($_.Exception.Message)" -ForegroundColor DarkYellow
}
exit 0
