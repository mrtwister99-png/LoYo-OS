# LoYo OS — restart / vypnutí celého systému (tlačítka R a ⏻ vpravo nahoře v UI).
#   -Mode restart : BEZ VÝPADKU — zapíše si PID staré instance (spouštěč LOYO OS, API, MCP, WEB), nahodí nový
#                   Start-LoYo.ps1 -OldPidFile … a ten po otevření nových terminálů starou instanci zavře
#   -Mode off     : vypne všechno (4 terminály + Mary Telegram bot) a Strážce dá do pauzy, ať to znovu nenahodí
# API ho spouští přes WMI (Win32_Process.Create) — mimo strom i job objekt API, takže zabití API tenhle skript neukončí.
param([ValidateSet('restart', 'off')][string]$Mode = 'restart')
$ErrorActionPreference = 'Continue'
$ROOT = Split-Path $PSScriptRoot -Parent
$LOG = Join-Path $ROOT 'data\logs\power.log'
function Log($m) { "[$(Get-Date -Format 'd. M. yyyy HH:mm:ss')] $m" | Out-File -Append -Encoding utf8 $LOG }
$me = $PID
$PID_DIR = "$env:TEMP\loyo_pids"
New-Item -ItemType Directory -Force -Path $PID_DIR | Out-Null
try { Start-Transcript -Path (Join-Path $ROOT 'data\logs\power-last.log') -Force | Out-Null } catch {}

Log "start ($Mode)"
Start-Sleep -Milliseconds 800   # ať API stihne odpovědět do UI

# Strážce: schválné vypnutí/restart → nenahazovat (u restartu pauzu zruší nový spouštěč, až všechno naběhne)
$sd = Join-Path $ROOT 'data\strazce'; New-Item -ItemType Directory -Force -Path $sd | Out-Null
$PAUSE = Join-Path $sd 'pauza'
Set-Content -Path $PAUSE -Value (Get-Date -Format o)

# Všechny procesy běžící instance LoYo OS (kořeny stromů — zabíjí se přes taskkill /T)
function Get-InstancePids {
    $ids = New-Object System.Collections.Generic.HashSet[int]
    # 1) spouštěč „LOYO OS“ (Start-LoYo.ps1 + jeho conhost) — okna API/MCP/WEB jsou jeho děti
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'Start-LoYo\.ps1' } | ForEach-Object { [void]$ids.Add([int]$_.ProcessId) }
    # 2) okna API / MCP / WEB podle titulku (i API nahozené Strážcem) + PID soubory spouštěče
    foreach ($t in 'LoYo OS - WEB', 'LoYo OS - MCP', 'LoYo OS - API') {
        tasklist /FI "WINDOWTITLE eq $t*" /FO CSV /NH 2>$null | ForEach-Object { if ($_ -match '^"[^"]*","(\d+)"') { [void]$ids.Add([int]$Matches[1]) } }
    }
    foreach ($n in 'web', 'mcp', 'api') {
        $f = "$PID_DIR\$n.pid"
        if (Test-Path $f) { $id = (Get-Content $f -ErrorAction SilentlyContinue | Select-Object -First 1); if ($id -match '^\d+$') { [void]$ids.Add([int]$id) } }
    }
    # 3) co drží porty 3000/3001 (ručně spuštěný dev server…)
    foreach ($port in 3000, 3001) {
        Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique |
            ForEach-Object { if ($_) { [void]$ids.Add([int]$_) } }
    }
    [void]$ids.Remove($me); [void]$ids.Remove(0); [void]$ids.Remove(4)
    # jen živé procesy, s časem startu (ať se po případném znovupoužití PID nezabije cizí proces)
    foreach ($id in $ids) { $p = Get-Process -Id $id -ErrorAction SilentlyContinue; if ($p) { "$id;$($p.StartTime.Ticks)" } }
}

if ($Mode -eq 'restart') {
    # 1) zapsat starou instanci DŘÍV, než naběhne nová (nová okna mají stejné titulky i PID soubory)
    $OldFile = "$PID_DIR\old-instance.txt"
    $oldPids = @(Get-InstancePids)
    $oldPids | Set-Content -Path $OldFile -Encoding ascii
    Log "stará instance: $(($oldPids | ForEach-Object { ($_ -split ';')[0] }) -join ', ')"
    # 2) nahodit nový LoYo OS — otevře nové terminály a pak sám zavře ty staré podle $OldFile
    Start-Process -FilePath "$env:WINDIR\System32\conhost.exe" `
        -ArgumentList "powershell.exe -NoLogo -ExecutionPolicy Bypass -File `"$ROOT\Start-LoYo.ps1`" -OldPidFile `"$OldFile`"" `
        -WorkingDirectory $ROOT
    Log 'nový LoYo OS spuštěn — starou instanci zavře on'
    # pojistka: kdyby nový spouštěč do 2 min starou instanci nepřevzal, stará běží dál → zrušit pauzu Strážce
    Start-Sleep -Seconds 120
    if (Test-Path $OldFile) { Remove-Item $OldFile -Force; Remove-Item $PAUSE -Force -ErrorAction SilentlyContinue; Log '⚠ nový spouštěč starou instanci nepřevzal — stará běží dál' }
    exit
}

# off: zavřít všechno
foreach ($line in Get-InstancePids) { $id = ($line -split ';')[0]; taskkill /F /T /PID $id 2>$null | Out-Null }
Remove-Item "$PID_DIR\*.pid" -Force -ErrorAction SilentlyContinue
# Mary Telegram bot běží odpojeně od API → vypnout zvlášť
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'mary-jane\\telegram-bot\.mjs' } |
    ForEach-Object { taskkill /F /T /PID $_.ProcessId 2>$null | Out-Null }
Log 'vypnuto'
