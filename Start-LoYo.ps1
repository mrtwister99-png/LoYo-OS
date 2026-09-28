
# LoYo OS v10 - FINAL FIX - minimalizace pres PID handle + zavre i hlavni
$ROOT = $PSScriptRoot
if (-not $ROOT) { $ROOT = "D:\dev\loyo-os" }
$PID_DIR = "$env:TEMP\loyo_pids"
New-Item -ItemType Directory -Force -Path $PID_DIR | Out-Null
Remove-Item "$PID_DIR\*.pid" -Force -ErrorAction SilentlyContinue

Add-Type -MemberDefinition @"
[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c);
[DllImport("user32.dll")] public static extern bool SetWindowText(IntPtr hWnd, string text);
[DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
"@ -Name WM -Namespace WM -ErrorAction SilentlyContinue

function Read-KeyChoice {
    param([string[]]$ValidKeys)
    while ($true) {
        $k = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        $c = $k.Character.ToString().ToUpper()
        if ($ValidKeys -contains $c) { Write-Host $c -ForegroundColor White; return $c }
    }
}

function Minimize-And-Rename {
    param([int]$ProcId, [string]$NewTitle)
    # cekej na MainWindowHandle
    for ($i=0; $i -lt 20; $i++) {
        try {
            $proc = Get-Process -Id $ProcId -ErrorAction SilentlyContinue
            if ($proc -and $proc.MainWindowHandle -ne 0) {
                [WM.WM]::SetWindowText($proc.MainWindowHandle, $NewTitle) | Out-Null
                [WM.WM]::ShowWindow($proc.MainWindowHandle, 6) | Out-Null
                return $true
            }
        } catch {}
        Start-Sleep -Milliseconds 300
    }
    return $false
}

function Show-ProgressBar {
    Write-Host ""
    Write-Host "  _          __   __         ____  ____" -ForegroundColor Cyan
    Write-Host " | |    ___  \ \ / /__      / __ \/ __/" -ForegroundColor Cyan
    Write-Host " | |   / _ \  \ V / _ \    / / / /\ \ " -ForegroundColor Cyan
    Write-Host " | |__| (_) |  | | (_) |  / /_/ /___\ \" -ForegroundColor Cyan
    Write-Host " |_____\___/   |_|\___/   \____/____/ " -ForegroundColor Cyan
    Write-Host ""
    Write-Host " LOYO OS" -ForegroundColor White
    Write-Host " Nacita..." -ForegroundColor Gray
    Write-Host ""
    for ($i=0; $i -le 10; $i++) {
        $pct = $i*10
        $filled = "■" * $i
        $empty = "□" * (10 - $i)
        Write-Host "`r [$filled$empty] $pct%   " -NoNewline -ForegroundColor Green
        Start-Sleep -Milliseconds 500
    }
    Write-Host ""
    Write-Host " 100% - Hotovo!" -ForegroundColor Green
    Write-Host ""
}

function Start-All-Final {
    Show-ProgressBar

    $API_PATH = Join-Path $ROOT "apps\api"
    if (-not (Test-Path $API_PATH)) { $API_PATH = $ROOT }
    $WEB_PATH = Join-Path $ROOT "apps\web"
    if (-not (Test-Path $WEB_PATH)) { $WEB_PATH = $ROOT }
    $MCP_PATH = Join-Path $ROOT "apps\mcp"
    if (-not (Test-Path $MCP_PATH)) { $MCP_PATH = $API_PATH }

    # Nastav hlavni titulek na LOYO OS - Loading
    $mainH = [WM.WM]::GetConsoleWindow()
    [WM.WM]::SetWindowText($mainH,"LOYO OS - Loading...") | Out-Null

    # 1. API 2s -> minimalizuje
    Write-Host "[1/4] terminal API -> start (2s)..." -ForegroundColor Yellow
    $api = Start-Process -FilePath "cmd.exe" -ArgumentList "/k title API - Loading... && cd /d `"$API_PATH`" && pnpm dev" -PassThru
    $api.Id | Out-File "$PID_DIR\api.pid"
    Start-Sleep -Seconds 2
    $ok = Minimize-And-Rename -ProcId $api.Id -NewTitle "API - OK"
    if ($ok) { Write-Host "  API - OK + minimalizovano" -ForegroundColor Green } else { Write-Host "  API - OK (handle nenalezen, zkusim taskkill)" -ForegroundColor Yellow; taskkill /FI "WINDOWTITLE eq API - Loading..." /FI "WINDOWTITLE eq API - OK*" 2>$null }

    # 2. MCP 2s -> minimalizuje
    Write-Host "[2/4] terminal MCP -> start (2s)..." -ForegroundColor Yellow
    $mcp = Start-Process -FilePath "cmd.exe" -ArgumentList "/k title MCP - Loading... && cd /d `"$MCP_PATH`" && pnpm dev:mcp 2>nul || pnpm mcp 2>nul || pnpm dev" -PassThru
    $mcp.Id | Out-File "$PID_DIR\mcp.pid"
    Start-Sleep -Seconds 2
    $ok = Minimize-And-Rename -ProcId $mcp.Id -NewTitle "MCP - OK"
    if ($ok) { Write-Host "  MCP - OK + minimalizovano" -ForegroundColor Green }

    # 3. WEB 2s -> minimalizuje
    Write-Host "[3/4] terminal TAURI -> start (2s)..." -ForegroundColor Yellow
    $web = Start-Process -FilePath "cmd.exe" -ArgumentList "/k title WEB - Loading... && cd /d `"$WEB_PATH`" && pnpm tauri dev 2>nul || pnpm dev" -PassThru
    $web.Id | Out-File "$PID_DIR\web.pid"
    Start-Sleep -Seconds 2
    $ok = Minimize-And-Rename -ProcId $web.Id -NewTitle "WEB - OK"
    if ($ok) { Write-Host "  WEB - OK + minimalizovano" -ForegroundColor Green }

    # 4. hlavni 2s po tauri -> minimalizuje
    Write-Host "[4/4] hlavni terminal 2s po tauri -> minimalizuje..." -ForegroundColor Yellow
    Start-Sleep -Seconds 2
    $mainH = [WM.WM]::GetConsoleWindow()
    [WM.WM]::SetWindowText($mainH,"LOYO OS - OK") | Out-Null
    [WM.WM]::ShowWindow($mainH,6) | Out-Null
    Write-Host "  LOYO OS - OK + minimalizovano - vse 4 minimalizovano!" -ForegroundColor Green
    Write-Host ""
    Write-Host "V liste mas: API - OK, MCP - OK, WEB - OK, LOYO OS - OK" -ForegroundColor Cyan
    Write-Host "Klikni na LOYO OS - OK v liste pro menu Q/R" -ForegroundColor Gray
}

function Kill-All-Gradual {
    Write-Host "" ; Write-Host "[QUIT] Ukoncuju postupne vsechny 4..." -ForegroundColor Red
    $webPid = $null; $mcpPid = $null; $apiPid = $null
    if (Test-Path "$PID_DIR\web.pid") { $webPid = Get-Content "$PID_DIR\web.pid" }
    if (Test-Path "$PID_DIR\mcp.pid") { $mcpPid = Get-Content "$PID_DIR\mcp.pid" }
    if (Test-Path "$PID_DIR\api.pid") { $apiPid = Get-Content "$PID_DIR\api.pid" }

    Write-Host "  [1/3] WEB - OK PID $webPid..." -ForegroundColor Yellow
    if ($webPid) { taskkill /F /T /PID $webPid 2>$null }
    Start-Sleep -Seconds 2

    Write-Host "  [2/3] MCP - OK PID $mcpPid..." -ForegroundColor Yellow
    if ($mcpPid) { taskkill /F /T /PID $mcpPid 2>$null }
    Start-Sleep -Seconds 1

    Write-Host "  [3/3] API - OK PID $apiPid..." -ForegroundColor Yellow
    if ($apiPid) { taskkill /F /T /PID $apiPid 2>$null }
    Start-Sleep -Seconds 1

    taskkill /F /T /FI "WINDOWTITLE eq API - OK*" 2>$null
    taskkill /F /T /FI "WINDOWTITLE eq MCP - OK*" 2>$null
    taskkill /F /T /FI "WINDOWTITLE eq WEB - OK*" 2>$null
    taskkill /F /T /FI "WINDOWTITLE eq API - Loading...*" 2>$null
    taskkill /F /T /FI "WINDOWTITLE eq MCP - Loading...*" 2>$null
    taskkill /F /T /FI "WINDOWTITLE eq WEB - Loading...*" 2>$null

    Remove-Item "$PID_DIR\*.pid" -Force -ErrorAction SilentlyContinue
    Write-Host "[QUIT] 3 terminaly zavrene, ted zaviram i hlavni..." -ForegroundColor Green
}

# Zastupce
$Desktop = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop "LoYo OS.lnk"
if (-not (Test-Path $ShortcutPath)) {
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-ExecutionPolicy Bypass -NoExit -File `"$ROOT\Start-LoYo.ps1`""
    $Shortcut.WorkingDirectory = $ROOT
    $Shortcut.IconLocation = "shell32.dll,21"
    $Shortcut.Save()
}

Start-All-Final

# Obnov hlavni pro menu - uzivatel klikne na LOYO OS - OK v liste
$mainH = [WM.WM]::GetConsoleWindow()
[WM.WM]::ShowWindow($mainH,9) | Out-Null

while ($true) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host " LOYO OS - OK | Q=Quit R=Restart (bez Enteru)" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Volba Q/R: " -NoNewline -ForegroundColor Yellow
    $volba = Read-KeyChoice -ValidKeys @('Q','R')

    if ($volba -eq 'Q') {
        Write-Host ""
        Write-Host "Opravdu ukoncit vsechny 4? [A] Ano [N] Ne [R] Restart: " -NoNewline -ForegroundColor Yellow
        $p = Read-KeyChoice -ValidKeys @('A','N','R')
        if ($p -eq 'A') {
            Kill-All-Gradual
            Write-Host "Vsechny 4 zavrene - ukoncuju i hlavni..." -ForegroundColor Green
            Start-Sleep -Seconds 1
            exit
        }
        elseif ($p -eq 'R') {
            Kill-All-Gradual
            Start-Sleep 1
            Start-All-Final
            $mainH=[WM.WM]::GetConsoleWindow(); [WM.WM]::ShowWindow($mainH,9)|Out-Null; [WM.WM]::SetWindowText($mainH,"LOYO OS - OK")|Out-Null
        }
        else { Write-Host "Vracim se..." -ForegroundColor Gray; continue }
    }
    elseif ($volba -eq 'R') {
        Write-Host ""
        Write-Host "Restart vsech 4..." -ForegroundColor Cyan
        Kill-All-Gradual
        Start-Sleep 1
        Start-All-Final
        $mainH=[WM.WM]::GetConsoleWindow(); [WM.WM]::ShowWindow($mainH,9)|Out-Null; [WM.WM]::SetWindowText($mainH,"LOYO OS - OK")|Out-Null
    }
}
