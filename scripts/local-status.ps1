$taskRoot = Split-Path -Parent $PSScriptRoot
$taskRuntime = Join-Path $taskRoot 'data/runtime'

foreach ($taskDefinition in @(@{ Name = 'server'; Process = 'node' }, @{ Name = 'tunnel'; Process = 'cloudflared' })) {
  $taskName = $taskDefinition.Name
  $taskPidFile = Join-Path $taskRuntime ($taskName + '.pid')
  $taskPidValue = if (Test-Path -LiteralPath $taskPidFile) { Get-Content -LiteralPath $taskPidFile -ErrorAction SilentlyContinue | Select-Object -First 1 } else { $null }
  $taskProcess = if ($taskPidValue -match '^\d+$') { Get-Process -Id ([int]$taskPidValue) -ErrorAction SilentlyContinue } else { $null }
  if ($taskProcess -and $taskProcess.ProcessName -eq $taskDefinition.Process) { Write-Output ($taskName + ': running (PID ' + $taskProcess.Id + ')') }
  else { Write-Output ($taskName + ': stopped') }
}

try {
  $taskHealth = Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 2
  Write-Output ('health: ' + $taskHealth.status)
} catch {
  Write-Output 'health: unavailable'
}
