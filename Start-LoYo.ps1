# LoYo OS v11 — spouštěč
# Hlavní okno: logo + progress podle toho, co SKUTEČNĚ naběhlo (API :3001, MCP, WEB :3000, Mary bot).
# API / MCP / WEB se spustí najednou rovnou minimalizované; hlavní okno se 5 s po startu taky schová.
# Q = vypnout vše · R = restart (stačí obnovit 'LOYO OS' z lišty a zmáčknout klávesu).
$ErrorActionPreference = 'Continue'
$ROOT = $PSScriptRoot
if (-not $ROOT) { $ROOT = "D:\dev\loyo-os" }
$PID_DIR = "$env:TEMP\loyo_pids"
New-Item -ItemType Directory -Force -Path $PID_DIR | Out-Null

$API_PATH = Join-Path $ROOT "apps\api"
$MCP_PATH = Join-Path $ROOT "apps\mcp"
$WEB_PATH = Join-Path $ROOT "apps\web"
if (-not (Test-Path $MCP_PATH)) { $MCP_PATH = $null }

Add-Type -ErrorAction SilentlyContinue -Name Win -Namespace LoYo -MemberDefinition @"
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
[DllImport("user32.dll")] public static extern bool SetWindowText(IntPtr h, string t);
[DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
[DllImport("kernel32.dll")] public static extern IntPtr GetStdHandle(int n);
[DllImport("kernel32.dll")] public static extern bool GetConsoleMode(IntPtr h, out int m);
[DllImport("kernel32.dll")] public static extern bool SetConsoleMode(IntPtr h, int m);
"@

# ---------- barvy (ANSI truecolor; v conhost je musíme zapnout) ----------
$h = [LoYo.Win]::GetStdHandle(-11); $mode = 0
if ([LoYo.Win]::GetConsoleMode($h, [ref]$mode)) { [LoYo.Win]::SetConsoleMode($h, $mode -bor 0x0004) | Out-Null }
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$E = [char]27
function C([int]$r, [int]$g, [int]$b) { "$E[38;2;${r};${g};${b}m" }
$RST = "$E[0m"; $BOLD = "$E[1m"; $DIM = "$E[2m"
$CYAN = C 18 164 255; $PINK = C 255 46 151; $LIME = C 57 255 136; $AMBER = C 255 196 0; $RED = C 255 80 80; $GREY = C 120 120 130
function Lerp([int]$a, [int]$b, [double]$t) { [int]($a + ($b - $a) * $t) }
function Grad([double]$t) { C (Lerp 18 255 $t) (Lerp 164 46 $t) (Lerp 255 151 $t) }   # cyan → růžová

function Set-MainTitle($t) { [LoYo.Win]::SetWindowText([LoYo.Win]::GetConsoleWindow(), $t) | Out-Null }
function Hide-Main { [LoYo.Win]::ShowWindow([LoYo.Win]::GetConsoleWindow(), 6) | Out-Null }   # 6 = minimalizovat
function Show-Main { [LoYo.Win]::ShowWindow([LoYo.Win]::GetConsoleWindow(), 9) | Out-Null }   # 9 = obnovit

function Read-KeyChoice([string[]]$ValidKeys) {
    while ($true) {
        $k = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        $c = $k.Character.ToString().ToUpper()
        if ($ValidKeys -contains $c) { Write-Host $c; return $c }
    }
}

function Show-Logo {
    Clear-Host
    try { $Host.UI.RawUI.BackgroundColor = 'Black'; $Host.UI.RawUI.CursorSize = 0 } catch {}
    $logo = @(
        '  ██╗      ██████╗ ██╗   ██╗ ██████╗      ██████╗ ███████╗',
        '  ██║     ██╔═══██╗╚██╗ ██╔╝██╔═══██╗    ██╔═══██╗██╔════╝',
        '  ██║     ██║   ██║ ╚████╔╝ ██║   ██║    ██║   ██║███████╗',
        '  ██║     ██║   ██║  ╚██╔╝  ██║   ██║    ██║   ██║╚════██║',
        '  ███████╗╚██████╔╝   ██║   ╚██████╔╝    ╚██████╔╝███████║',
        '  ╚══════╝ ╚═════╝    ╚═╝    ╚═════╝      ╚═════╝ ╚══════╝'
    )
    Write-Host ""
    for ($i = 0; $i -lt $logo.Count; $i++) { Write-Host "$BOLD$(Grad ($i / ($logo.Count - 1)))$($logo[$i])$RST" }
    Write-Host ""
    Write-Host "  $GREY▸ ${CYAN}Mary Jane$GREY · agenti · MCP · Telegram          $DIM$(Get-Date -Format 'd. M. yyyy HH:mm')$RST"
    Write-Host ""
}

# ---------- progress bar (barevný přechod, plynulý) ----------
$BAR_W = 46
function Draw-Bar([double]$pct, [string]$label) {
    $filled = [int][Math]::Round($BAR_W * $pct / 100)
    $sb = New-Object Text.StringBuilder
    for ($i = 0; $i -lt $BAR_W; $i++) {
        if ($i -lt $filled) { [void]$sb.Append("$(Grad ($i / ($BAR_W - 1)))█") } else { [void]$sb.Append("$GREY░") }
    }
    $p = ('{0,3}' -f [int]$pct)
    $line = "  $($sb.ToString())$RST $BOLD$p%$RST  $GREY$label$RST"
    Write-Host ("`r" + $line + (' ' * 12)) -NoNewline
}

function Test-Port([int]$port) {
    try { $c = New-Object Net.Sockets.TcpClient; $r = $c.BeginConnect('127.0.0.1', $port, $null, $null); $ok = $r.AsyncWaitHandle.WaitOne(250) -and $c.Connected; $c.Close(); return $ok } catch { return $false }
}
function Test-Port6([int]$port) {
    if (Test-Port $port) { return $true }
    try { $c = New-Object Net.Sockets.TcpClient([Net.Sockets.AddressFamily]::InterNetworkV6); $r = $c.BeginConnect('::1', $port, $null, $null); $ok = $r.AsyncWaitHandle.WaitOne(250) -and $c.Connected; $c.Close(); return $ok } catch { return $false }
}

# ---------- spuštění služby: klasický conhost, rovnou minimalizovaný ----------
function Start-Service-Min([string]$name, [string]$dir, [string]$cmd) {
    $title = "LoYo OS - $name"
    $p = Start-Process -FilePath "$env:WINDIR\System32\conhost.exe" `
        -ArgumentList "cmd.exe /k title $title && cd /d `"$dir`" && $cmd" `
        -WindowStyle Minimized -PassThru
    $p.Id | Out-File "$PID_DIR\$($name.ToLower()).pid"
    return $p
}

function Start-All {
    Set-MainTitle "LOYO OS - startuje…"
    Show-Logo

    # 1) všechno najednou, minimalizované
    Write-Host "  $CYAN▸$RST spouštím ${BOLD}API$RST · ${BOLD}MCP$RST · ${BOLD}WEB$RST najednou (minimalizované)…"
    Write-Host ""
    $null = Start-Service-Min 'API' $API_PATH 'pnpm dev'
    if ($MCP_PATH) { $null = Start-Service-Min 'MCP' $MCP_PATH 'pnpm dev' }
    $null = Start-Service-Min 'WEB' $WEB_PATH 'pnpm tauri dev 2>nul || pnpm dev'

    # 2) progress podle skutečného stavu
    $done = @{ API = $false; MCP = (-not $MCP_PATH); WEB = $false; BOT = $false }
    $weights = @{ API = 40; MCP = 10; WEB = 40; BOT = 10 }
    $shown = 0.0
    $start = Get-Date
    $timeout = 150
    while ($true) {
        $sec = ((Get-Date) - $start).TotalSeconds
        if (-not $done.API -and (Test-Port6 3001)) { $done.API = $true }
        if (-not $done.WEB -and (Test-Port6 3000)) { $done.WEB = $true }
        if (-not $done.MCP -and $sec -gt 4 -and (Get-Process -Id (Get-Content "$PID_DIR\mcp.pid" -ErrorAction SilentlyContinue) -ErrorAction SilentlyContinue)) { $done.MCP = $true }
        if ($done.API -and -not $done.BOT) {
            try { $s = Invoke-RestMethod 'http://localhost:3001/api/agents/mary-jane/telegram' -TimeoutSec 2; if ($s.running -or -not $s.configured) { $done.BOT = $true } } catch {}
        }

        $target = 0; foreach ($k in $weights.Keys) { if ($done[$k]) { $target += $weights[$k] } }
        # mezi kroky se bar plíží dopředu, ať je vidět, že se něco děje
        $creep = [Math]::Min(9, $sec * 0.6)
        $goal = [Math]::Min(100, $target + $(if ($target -lt 100) { $creep } else { 0 }))
        if ($shown -lt $goal) { $shown = [Math]::Min($goal, $shown + [Math]::Max(1.2, ($goal - $shown) / 6)) }

        $wait = @(); foreach ($k in 'API', 'MCP', 'WEB', 'BOT') { if (-not $done[$k]) { $wait += $k } }
        $label = if ($wait.Count) { "⏳ čekám: $($wait -join ' · ')  ($([int]$sec) s)" } else { '✓ všechno běží' }
        Draw-Bar $shown $label
        if ((-not $wait.Count -and $shown -ge 99.5) -or $sec -gt $timeout) { break }
        Start-Sleep -Milliseconds 120
    }
    Draw-Bar 100 $(if ($done.API -and $done.WEB) { '✓ všechno běží' } else { '⚠ něco nenaběhlo — mrkni do okna na liště' })
    Write-Host ""; Write-Host ""

    foreach ($k in 'API', 'MCP', 'WEB', 'BOT') {
        $name = @{ API = 'API      :3001'; MCP = 'MCP'; WEB = 'WEB      :3000'; BOT = 'Mary bot (Telegram)' }[$k]
        if ($done[$k]) { Write-Host "    $LIME●$RST $name" } else { Write-Host "    $RED○$RST $name $GREY— zatím ne$RST" }
    }
    Write-Host ""
    Set-MainTitle "LOYO OS"

    # 3) za 5 s schovat i hlavní okno
    for ($i = 5; $i -ge 1; $i--) {
        Write-Host ("`r  $GREY schovám se za $i s … (Q = vypnout, R = restart — obnov si 'LOYO OS' z lišty)$RST   ") -NoNewline
        Start-Sleep -Seconds 1
    }
    Write-Host ""
    Hide-Main
}

function Kill-All {
    Write-Host ""; Write-Host "  $RED▸ vypínám WEB · MCP · API…$RST"
    foreach ($name in 'web', 'mcp', 'api') {
        $f = "$PID_DIR\$name.pid"
        if (Test-Path $f) { $id = Get-Content $f; if ($id) { taskkill /F /T /PID $id 2>$null | Out-Null } }
    }
    foreach ($t in 'LoYo OS - WEB', 'LoYo OS - MCP', 'LoYo OS - API') { taskkill /F /T /FI "WINDOWTITLE eq $t*" 2>$null | Out-Null }
    Remove-Item "$PID_DIR\*.pid" -Force -ErrorAction SilentlyContinue
    Write-Host "  $LIME✓ vypnuto$RST"
}

# ---------- zástupce na ploše (když chybí) ----------
$ShortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) "LoYo OS.lnk"
if (-not (Test-Path $ShortcutPath)) {
    $s = (New-Object -ComObject WScript.Shell).CreateShortcut($ShortcutPath)
    $s.TargetPath = "$env:WINDIR\System32\conhost.exe"
    $s.Arguments = "powershell.exe -NoLogo -ExecutionPolicy Bypass -File `"$ROOT\Start-LoYo.ps1`""
    $s.WorkingDirectory = $ROOT
    $ico = Join-Path $ROOT 'assets\loyo-os.ico'
    $s.IconLocation = $(if (Test-Path $ico) { "$ico,0" } else { 'shell32.dll,21' })
    $s.Save()
}

Start-All

while ($true) {
    Write-Host ""
    Write-Host "  $CYAN━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$RST"
    Write-Host "  $BOLD LOYO OS běží$RST   ${PINK}Q$RST vypnout · ${PINK}R$RST restart"
    Write-Host "  $CYAN━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━$RST"
    $volba = Read-KeyChoice @('Q', 'R')
    if ($volba -eq 'Q') {
        Write-Host "  Opravdu vypnout všechno? ${PINK}A$RST ano · ${PINK}N$RST ne: " -NoNewline
        if ((Read-KeyChoice @('A', 'N')) -eq 'A') { Kill-All; Start-Sleep -Seconds 1; exit }
    }
    else {
        Kill-All; Start-Sleep -Seconds 1; Start-All
    }
}
