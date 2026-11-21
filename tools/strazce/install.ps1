# tools/strazce/install.ps1 — Strážce se spustí sám při přihlášení do Windows (neviditelně) a hned teď.
# Odinstalace: tools/strazce/install.ps1 -Remove
param([switch]$Remove)
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$dir = Join-Path $root 'tools\strazce'
$vbs = Join-Path $dir 'strazce.vbs'
$task = 'LoYo OS - Strazce'

if ($Remove) {
    Unregister-ScheduledTask -TaskName $task -Confirm:$false -ErrorAction SilentlyContinue
    $pidFile = Join-Path $root 'data\strazce\strazce.pid'
    if (Test-Path $pidFile) { Stop-Process -Id (Get-Content $pidFile) -Force -ErrorAction SilentlyContinue }
    Write-Host "Strážce odinstalován."
    return
}

# VBS spouštěč = node bez okna
$node = (Get-Command node -ErrorAction Stop).Source
@"
' Strážce LoYo OS — spustí node bez okna
CreateObject("WScript.Shell").Run """$node"" ""$dir\strazce.mjs""", 0, False
"@ | Set-Content -Path $vbs -Encoding ASCII

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$vbs`"" -WorkingDirectory $root
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $task -Action $action -Trigger $trigger -Settings $settings -Description 'Hlídá LoYo OS (API + Mary bot) a když spadne, nahodí ho.' -Force | Out-Null
Start-ScheduledTask -TaskName $task
Write-Host "Strážce nainstalován (úloha '$task', spouští se při přihlášení) a běží."
