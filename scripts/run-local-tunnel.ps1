$ErrorActionPreference = 'Stop'

$taskRoot = Split-Path -Parent $PSScriptRoot
$taskRuntime = Join-Path $taskRoot 'data/runtime'
$taskCloudflare = Join-Path $taskRoot 'data/cloudflare'
$taskToken = Join-Path $taskCloudflare 'tunnel.token'
$taskLocalBinary = Join-Path $taskCloudflare 'cloudflared.exe'

New-Item -ItemType Directory -Path $taskRuntime -Force | Out-Null
New-Item -ItemType Directory -Path $taskCloudflare -Force | Out-Null

function Get-RunningProcessFromPidFile([string]$taskPidFile, [string]$taskExpectedName) {
  if (!(Test-Path -LiteralPath $taskPidFile)) { return $null }
  $taskPidValue = Get-Content -LiteralPath $taskPidFile -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($taskPidValue -notmatch '^\d+$') { return $null }
  $taskSavedProcess = Get-Process -Id ([int]$taskPidValue) -ErrorAction SilentlyContinue
  if (!$taskSavedProcess -or $taskSavedProcess.ProcessName -ne $taskExpectedName) { return $null }
  return $taskSavedProcess
}

$taskNode = Get-Command node -ErrorAction SilentlyContinue
if (!$taskNode) { throw 'Node.js 22 or newer is required. Install Node.js, then run this command again.' }
$taskNodeMajor = [int]((& $taskNode.Source --version).TrimStart('v').Split('.')[0])
if ($taskNodeMajor -lt 22) { throw 'Node.js 22 or newer is required.' }

$taskCloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($taskCloudflared) { $taskCloudflaredPath = $taskCloudflared.Source }
elseif (Test-Path -LiteralPath $taskLocalBinary) { $taskCloudflaredPath = $taskLocalBinary }
else { throw 'Install cloudflared or place cloudflared.exe in data/cloudflare/. No source-code edit is required.' }

if (!(Test-Path -LiteralPath $taskToken)) {
  throw 'Place the authorized token in data/cloudflare/tunnel.token. This ignored secret is required once per machine.'
}

$taskTokenValue = (Get-Content -Raw -LiteralPath $taskToken).Trim()
if ([string]::IsNullOrWhiteSpace($taskTokenValue)) { throw 'data/cloudflare/tunnel.token is empty.' }

$taskServerPidFile = Join-Path $taskRuntime 'server.pid'
$taskTunnelPidFile = Join-Path $taskRuntime 'tunnel.pid'
$taskTunnelProcess = Get-RunningProcessFromPidFile $taskTunnelPidFile 'cloudflared'
if ($taskTunnelProcess) {
  Write-Output ('Squid first local runtime is already running (Tunnel PID ' + $taskTunnelProcess.Id + ').')
  exit 0
}

Push-Location $taskRoot
try {
  if (!(Test-Path -LiteralPath (Join-Path $taskRoot 'node_modules'))) {
    Write-Output 'Installing locked Node.js dependencies...'
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
  }

  Write-Output 'Building the API and Admin UI...'
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'npm run build failed.' }

  try { $taskHealth = Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 2 } catch { $taskHealth = $null }
  if ($taskHealth.status -ne 'ok') {
    $taskServerProcess = Start-Process -FilePath $taskNode.Source -ArgumentList @('--env-file-if-exists=.env','dist/server.js') -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRuntime 'server.stdout.log') -RedirectStandardError (Join-Path $taskRuntime 'server.stderr.log')
    $taskServerProcess.Id | Set-Content -LiteralPath $taskServerPidFile

    $taskReady = $false
    for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
      Start-Sleep -Milliseconds 500
      if ($taskServerProcess.HasExited) { break }
      try { $taskHealth = Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 2 } catch { $taskHealth = $null }
      if ($taskHealth.status -eq 'ok') { $taskReady = $true; break }
    }
    if (!$taskReady) {
      $taskErrorLog = Join-Path $taskRuntime 'server.stderr.log'
      throw ('API did not become healthy. Check ' + $taskErrorLog)
    }
  }

  $taskTunnelArguments = @('tunnel','--no-autoupdate','--loglevel','warn','run','--token-file',('"' + $taskToken + '"'))
  $taskTunnelProcess = Start-Process -FilePath $taskCloudflaredPath -ArgumentList $taskTunnelArguments -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRuntime 'tunnel.stdout.log') -RedirectStandardError (Join-Path $taskRuntime 'tunnel.stderr.log')
  $taskTunnelProcess.Id | Set-Content -LiteralPath $taskTunnelPidFile
  Start-Sleep -Seconds 2
  if ($taskTunnelProcess.HasExited) { throw ('Cloudflare Tunnel stopped during startup. Check ' + (Join-Path $taskRuntime 'tunnel.stderr.log')) }

  Write-Output ('Ready: local API PID is recorded in data/runtime/server.pid; Tunnel PID ' + $taskTunnelProcess.Id + '.')
  Write-Output 'Admin URL: https://admin.cffirst.com/admin-app/'
}
finally {
  Pop-Location
}
