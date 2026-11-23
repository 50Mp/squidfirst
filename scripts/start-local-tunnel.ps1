$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskBinary = Join-Path $taskRoot 'data/cloudflare/cloudflared.exe'
$taskToken = Join-Path $taskRoot 'data/cloudflare/tunnel.token'
$taskLogs = Join-Path $taskRoot 'data/cloudflare'
if (!(Test-Path -LiteralPath $taskBinary) -or !(Test-Path -LiteralPath $taskToken)) { throw 'Prepare official cloudflared.exe and the authorized tunnel.token under data/cloudflare first.' }
if (!(Invoke-RestMethod 'http://127.0.0.1:3000/health' -TimeoutSec 5).status) { throw 'Start Squid first API before starting the tunnel.' }
$taskArguments = @('tunnel', '--no-autoupdate', '--loglevel', 'warn', 'run', '--token-file', ('"' + $taskToken + '"'))
$taskProcess = Start-Process -FilePath $taskBinary -ArgumentList $taskArguments -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskLogs 'tunnel.stdout.log') -RedirectStandardError (Join-Path $taskLogs 'tunnel.stderr.log')
$taskProcess.Id | Set-Content (Join-Path $taskLogs 'tunnel.pid')
Write-Output ('Started local tunnel connector PID ' + $taskProcess.Id + '. Keep this PC and Docker running.')
