param(
    [int]$IntervalSeconds = 240
)

$agents = @(
    @{ Name = "GigAgent";     Dir = "$PSScriptRoot\gigagent"     },
    @{ Name = "PaySlip";      Dir = "$PSScriptRoot\payslip"      },
    @{ Name = "Agent Broker"; Dir = "$PSScriptRoot\agent-broker" }
)

Write-Host "=== OKX.AI Agent Heartbeat Keeper ===" -ForegroundColor Cyan
Write-Host "Sending heartbeats every $IntervalSeconds seconds..."

while ($true) {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] Sending heartbeats..." -ForegroundColor Yellow

    foreach ($agent in $agents) {
        try {
            $result = & onchainos agent heartbeat --chain-index 196 2>&1
            $parsed = $result | ConvertFrom-Json -ErrorAction SilentlyContinue
            if ($parsed -and $parsed.ok) {
                Write-Host "  ✅ $($agent.Name) — online" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  $($agent.Name) — heartbeat returned unexpected response" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  ❌ $($agent.Name) — error: $_" -ForegroundColor Red
        }
    }

    Write-Host "Next heartbeat in $IntervalSeconds seconds..."
    Start-Sleep -Seconds $IntervalSeconds
}
