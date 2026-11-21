# LoYo OS — restart / vypnutí celého systému (tlačítka R a ⏻ vpravo nahoře v UI).
#   -Mode restart : vypne 4 aktuální terminály (LOYO OS spouštěč, API, MCP, WEB) a hned nahodí nový LoYo OS
#   -Mode off     : vypne všechno (4 terminály + Mary Telegram bot) a Strážce dá do pauzy, ať to znovu nenahodí
# API ho spouští přes WMI (Win32_Process.Create) — mimo strom i job objekt API, takže zabití API tenhle skript neukončí.
param([ValidateSet('restart', 'off')][string]$Mode = 'restart')
$ErrorActionPreference = 'Continue'
$ROOT = Split-Path $PSScriptRoot -Parent
$LOG = Join-Path $ROOT 'data\logs\power.log'
function Log($m) { "[$(Get-Date -Format 'd. M. yyyy HH:mm:ss')] $m" | Out-File -Append -Encoding utf8 $LOG }
$me = $PID
try { Start-Transcript -Path (Join-Path $ROOT 'data\logs\power-last.log') -Force | Out-Null } catch {}

Log "start ($Mode)"
Start-Sleep -Milliseconds 800   # ať API stihne odpovědět do UI

# Strážce: schválné vypnutí → nenahazovat (u restartu pauzu zruší nový spouštěč)
$sd = Join-Path $ROOT 'data\strazce'; New-Item -ItemType Directory -Force -Path $sd | Out-Null
Set-Content -Path (Join-Path $sd 'pauza') -Value (Get-Date -Format o)

# 1) spouštěč „LOYO OS“ (Start-LoYo.ps1 + jeho conhost)
Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $me -and $_.CommandLine -match 'Start-LoYo\.ps1' } |
    ForEach-Object { taskkill /F /T /PID $_.ProcessId 2>$null | Out-Null }

# 2) okna API / MCP / WEB podle titulku + podle PID souborů spouštěče
foreach ($t in 'LoYo OS - WEB', 'LoYo OS - MCP', 'LoYo OS - API') { taskkill /F /T /FI "WINDOWTITLE eq $t*" 2>$null | Out-Null }
$PID_DIR = "$env:TEMP\loyo_pids"
foreach ($n in 'web', 'mcp', 'api') {
    $f = "$PID_DIR\$n.pid"
    if (Test-Path $f) { $id = Get-Content $f; if ($id) { taskkill /F /T /PID $id 2>$null | Out-Null }; Remove-Item $f -Force }
}

# 3) co by ještě drželo porty 3000/3001 (API nahozené Strážcem, ručně spuštěný dev server…)
foreach ($port in 3000, 3001) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique |
        Where-Object { $_ -and $_ -ne $me } | ForEach-Object { taskkill /F /T /PID $_ 2>$null | Out-Null }
}

if ($Mode -eq 'off') {
    # Mary Telegram bot běží odpojeně od API → vypnout zvlášť
    Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'mary-jane\\telegram-bot\.mjs' } |
        ForEach-Object { taskkill /F /T /PID $_.ProcessId 2>$null | Out-Null }
    Log 'vypnuto'
    exit
}

# restart: počkat, až se porty uvolní, a nahodit nový LoYo OS (4 terminály)
for ($i = 0; $i -lt 20; $i++) {
    if (-not (Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue) -and -not (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 500
}
Start-Process -FilePath "$env:WINDIR\System32\conhost.exe" `
    -ArgumentList "powershell.exe -NoLogo -ExecutionPolicy Bypass -File `"$ROOT\Start-LoYo.ps1`"" `
    -WorkingDirectory $ROOT
Log 'nový LoYo OS spuštěn'
