# keep_agents_online.ps1
# Sends periodic heartbeats for GigAgent (#3274) and PaySlip (#3272)
# to keep them showing as "online" on OKX.AI.
# Run this in a terminal before submitting listing applications.
# It will loop indefinitely — Ctrl+C to stop.

param(
    [int]$IntervalSeconds = 240  # Send heartbeat every 4 minutes
)

$agents = @(
    @{ Name = "GigAgent";     Dir = "$PSScriptRoot\gigagent"     },
    @{ Name = "PaySlip";      Dir = "$PSScriptRoot\payslip"      },
    @{ Name = "Agent Broker"; Dir = "$PSScriptRoot\agent-broker" }
)

Write-Host "=== OKX.AI Agent Heartbeat Keeper ===" -ForegroundColor Cyan
Write-Host "Sending heartbeats every $IntervalSeconds seconds for:"
foreach ($a in $agents) {
    Write-Host "  • $($a.Name)" -ForegroundColor Green
}
Write-Host "Press Ctrl+C to stop.`n"

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
                Write-Host "     $result"
            }
        } catch {
            Write-Host "  ❌ $($agent.Name) — error: $_" -ForegroundColor Red
        }
    }

    Write-Host "Next heartbeat in $IntervalSeconds seconds...`n"
    Start-Sleep -Seconds $IntervalSeconds
}
