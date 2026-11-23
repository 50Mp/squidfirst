$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskLogs = Join-Path $taskRoot 'data/runtime'
New-Item -ItemType Directory -Path $taskLogs -Force | Out-Null
try { $taskHealth = Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 3 } catch { $taskHealth = $null }
if ($taskHealth.status -eq 'ok') { Write-Output 'Squid first API is already running on port 3000.'; exit 0 }
$taskNode = (Get-Command node).Source
$taskProcess = Start-Process -FilePath $taskNode -ArgumentList @('--env-file-if-exists=.env','dist/server.js') -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogs 'server.stdout.log') -RedirectStandardError (Join-Path $taskLogs 'server.stderr.log')
$taskProcess.Id | Set-Content (Join-Path $taskLogs 'server.pid')
Write-Output ('Started Squid first API PID ' + $taskProcess.Id + '. Check http://127.0.0.1:3000/health.')
