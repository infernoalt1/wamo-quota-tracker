# Read-only diagnostic for the HOME Windows PC.
$ErrorActionPreference = 'Continue'
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version
Get-Service -Name tvnserver -ErrorAction SilentlyContinue | Select-Object Name, Status, StartType
$remoteClient = [Net.Sockets.TcpClient]::new()
try {
    $remoteConnect = $remoteClient.ConnectAsync('127.0.0.1', 5900)
    if ($remoteConnect.Wait(3000) -and $remoteClient.Connected) { Write-Output 'Local VNC TCP port is reachable. Authentication has not been tested.' }
    else { Write-Output 'Local VNC TCP port 5900 is not reachable.' }
} catch { Write-Output 'Local VNC TCP port 5900 is not reachable.' }
finally { $remoteClient.Dispose() }
Write-Output 'Check loopback-only VNC with a password, the visible home connector terminal, and awake/online power settings.'
Write-Output 'This script does not install anything, change settings, or read credentials.'
