# Read-only diagnostics. Run on the Windows HOME computer, not the school device.
$ErrorActionPreference = 'Continue'
Write-Output 'Chrome Remote Desktop readiness (read-only; no configuration changes)'
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version
$remoteServices = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like '*Chrome Remote Desktop*' -or $_.Name -eq 'chromoting' }
if ($remoteServices) { $remoteServices | Select-Object Name, DisplayName, Status, StartType }
else { Write-Output 'Chrome Remote Desktop service was not found. Complete host installation at https://remotedesktop.google.com/access/ on this PC.' }
Write-Output 'Check enrollment in your Google account and keep the PC online and awake.'
Write-Output 'A running service alone does not confirm enrollment or connectivity. This script does not read credentials or test a remote session.'
