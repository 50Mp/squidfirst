$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskRuntime = Join-Path $taskRoot 'data/runtime'

foreach ($taskDefinition in @(@{ Name = 'tunnel'; Process = 'cloudflared' }, @{ Name = 'server'; Process = 'node' })) {
  $taskName = $taskDefinition.Name
  $taskPidFile = Join-Path $taskRuntime ($taskName + '.pid')
  if (!(Test-Path -LiteralPath $taskPidFile)) { continue }
  $taskPidValue = Get-Content -LiteralPath $taskPidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($taskPidValue -match '^\d+$') {
    $taskProcess = Get-Process -Id ([int]$taskPidValue) -ErrorAction SilentlyContinue
    if ($taskProcess -and $taskProcess.ProcessName -eq $taskDefinition.Process) {
      Stop-Process -Id $taskProcess.Id
      $taskProcess.WaitForExit(5000)
      Write-Output ('Stopped ' + $taskName + ' PID ' + $taskProcess.Id + '.')
    }
  }
  Remove-Item -LiteralPath $taskPidFile -Force -ErrorAction SilentlyContinue
}
