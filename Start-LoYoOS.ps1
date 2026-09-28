# LoYo OS Launcher - Root Launcher
# Vytvori tlacitko na plochu a spusti API / MCP / WEB (Tauri) s auto-minimalizaci
param(
    [switch]$InstallOnly
)

$Root = $PSScriptRoot
if (-not $Root -or $Root -eq "") { $Root = Split-Path -Parent $MyInvocation.MyCommand.Path }
Set-Location $Root

# --- Win32 API pro minimalizaci oken ---
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("kernel32.dll")] public static extern IntPtr GetConsoleWindow();
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
}
"@

$SW_MINIMIZE = 6
$SW_RESTORE = 9

function Get-ConsoleHandle {
    return [Win32]::GetConsoleWindow()
}

function Minimize-Window {
    param([IntPtr]$hWnd)
    if ($hWnd -ne [IntPtr]::Zero -and [Win32]::IsWindow($hWnd)) {
        [void][Win32]::ShowWindow($hWnd, $SW_MINIMIZE)
    }
}

function Wait-ForMainWindow {
    param([System.Diagnostics.Process]$Proc, [int]$TimeoutSec = 8)
    $elapsed = 0
    while ($elapsed -lt $TimeoutSec) {
        try {
            $Proc.Refresh()
            if ($Proc.MainWindowHandle -ne [IntPtr]::Zero) { return $Proc.MainWindowHandle }
        } catch {}
        Start-Sleep -Milliseconds 250
        $elapsed += 0.25
    }
    return [IntPtr]::Zero
}

function Start-LoYoService {
    param(
        [string]$Title,
        [string]$Path,
        [string]$Command,
        [int]$MinimizeAfter = 1
    )
    if (-not (Test-Path $Path)) {
        Write-Host "[WARN] Cesta neexistuje: $Path - preskakuju $Title" -ForegroundColor Yellow
        return $null
    }
    Write-Host ">> Spoustim $Title v $Path" -ForegroundColor Green
    $psArgs = "-NoExit -Command `"`$host.UI.RawUI.WindowTitle='$Title'; Set-Location '$Path'; $Command`""
    try {
        $proc = Start-Process -FilePath "powershell.exe" -ArgumentList $psArgs -PassThru -WorkingDirectory $Path
        Start-Sleep -Seconds $MinimizeAfter
        $hWnd = Wait-ForMainWindow -Proc $proc
        if ($hWnd -ne [IntPtr]::Zero) { Minimize-Window -hWnd $hWnd }
        return $proc
    } catch {
        Write-Host "[ERROR] Nepodarilo se spustit $Title : $_" -ForegroundColor Red
        return $null
    }
}

function New-DesktopShortcut {
    try {
        $WshShell = New-Object -ComObject WScript.Shell
        $Desktop = [Environment]::GetFolderPath("Desktop")
        $ShortcutPath = Join-Path $Desktop "LoYo OS.lnk"
        $TargetPs1 = Join-Path $Root "Start-LoYoOS.ps1"
        
        $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
        $Shortcut.TargetPath = "powershell.exe"
        $Shortcut.Arguments = "-ExecutionPolicy Bypass -NoProfile -File `"$TargetPs1`""
        $Shortcut.WorkingDirectory = $Root
        $Shortcut.IconLocation = "powershell.exe,0"
        $Shortcut.Description = "Spustit LoYo OS - API + MCP + WEB Tauri"
        $Shortcut.Save()
        Write-Host "[OK] Zástupce vytvořen: $ShortcutPath" -ForegroundColor Cyan
        return $ShortcutPath
    } catch {
        Write-Host "[ERROR] Nepodarilo se vytvorit zástupce: $_" -ForegroundColor Red
        return $null
    }
}

# --- 0. Vytvor zástupce na plochu vždy při prvním spuštění ---
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "LoYo OS.lnk"
if (-not (Test-Path $desktopShortcut)) {
    New-DesktopShortcut | Out-Null
}

if ($InstallOnly) {
    Write-Host "Instalace hotova. Muzes zavrit." -ForegroundColor Green
    Read-Host "Stiskni Enter"
    exit 0
}

# --- Detekce cest (podle tvého ZIPu) ---
$possibleApiPaths = @(
    (Join-Path $Root "src/apps/api"),
    (Join-Path $Root "apps/api"),
    (Join-Path $Root "loyo-main/src/apps/api")
)
$possibleWebPaths = @(
    (Join-Path $Root "src/apps/web"),
    (Join-Path $Root "apps/web"),
    (Join-Path $Root "loyo-main/src/apps/web")
)
$possibleMcpPaths = @(
    (Join-Path $Root "src/apps/mcp"),
    (Join-Path $Root "src/mcp"),
    (Join-Path $Root "packages/mcp"),
    (Join-Path $Root "src/apps/api") # fallback - MCP je route v API
)

function Resolve-FirstExisting { param([string[]]$Paths) foreach ($p in $Paths) { if (Test-Path $p) { return $p } } return $Paths[0] }

$ApiPath = Resolve-FirstExisting $possibleApiPaths
$WebPath = Resolve-FirstExisting $possibleWebPaths
$McpPath = Resolve-FirstExisting $possibleMcpPaths

# Prikazy - uprav podle potřeby
$ApiCommand = "Write-Host 'LoYo API' -ForegroundColor Magenta; if (Test-Path 'package.json') { pnpm dev } else { npm run dev }"
$McpCommand = "Write-Host 'LoYo MCP' -ForegroundColor Yellow; if (Test-Path 'package.json') { pnpm dev:mcp } else { Write-Host 'MCP jede pres API routes/mcp.ts' -ForegroundColor Gray; pnpm dev }"
$WebCommand = "Write-Host 'LoYo WEB / Tauri' -ForegroundColor Cyan; if (Test-Path 'package.json') { pnpm tauri dev } else { pnpm dev }"

# --- HLAVNI SMYCKA S RESTARTEM ---
$global:AllProcs = @()

:mainLoop while ($true) {
    $global:AllProcs = @()
    Clear-Host
    $host.UI.RawUI.WindowTitle = "LoYo OS - Main 0%"

    Write-Host @"
  _          __   __         ____  ____  
 | |    ___  \ \ / /__      / __ \/ __/  
 | |   / _ \  \ V / _ \    / / / /\ \    
 | |__| (_) |  | | (_) |  / /_/ /___\ \  
 |_____\___/   |_|\___/   \____/____/    
                                         
"@ -ForegroundColor Cyan
    Write-Host " Root: $Root" -ForegroundColor DarkGray
    Write-Host " API : $ApiPath" -ForegroundColor DarkGray
    Write-Host " WEB : $WebPath" -ForegroundColor DarkGray
    Write-Host " MCP : $McpPath" -ForegroundColor DarkGray
    Write-Host ""

    # --- 5s progress bar 0% -> 100% ---
    $durationSec = 5
    $steps = 100
    $sleepMs = [int](($durationSec * 1000) / $steps)

    for ($i = 0; $i -le $steps; $i++) {
        $percent = $i
        $host.UI.RawUI.WindowTitle = "LoYo OS $percent% - Loading..."
        Write-Progress -Activity "LoYo OS" -Status "Inicializace $percent% ..." -PercentComplete $percent
        # ASCII bar
        $barLen = 40
        $filled = [int](($percent / 100) * $barLen)
        $bar = ("#" * $filled) + ("-" * ($barLen - $filled))
        Write-Host "`r [$bar] $percent% " -NoNewline -ForegroundColor Green
        Start-Sleep -Milliseconds $sleepMs
    }
    Write-Progress -Activity "LoYo OS" -Completed
    Write-Host ""
    Write-Host "[OK] LoYo OS 100% - Spoustim sluzby..." -ForegroundColor Green
    $host.UI.RawUI.WindowTitle = "LoYo OS 100% - Running"
    Start-Sleep -Seconds 0.5

    # --- API terminal ---
    Write-Host "`n[1/3] API..." -ForegroundColor White
    $apiProc = Start-LoYoService -Title "LoYo OS - API" -Path $ApiPath -Command $ApiCommand -MinimizeAfter 1
    if ($apiProc) { $global:AllProcs += $apiProc }

    # --- MCP terminal ---
    Write-Host "[2/3] MCP..." -ForegroundColor White
    Start-Sleep -Seconds 0.3
    $mcpProc = Start-LoYoService -Title "LoYo OS - MCP" -Path $McpPath -Command $McpCommand -MinimizeAfter 1
    if ($mcpProc) { $global:AllProcs += $mcpProc }

    # --- WEB Tauri terminal ---
    Write-Host "[3/3] WEB Tauri..." -ForegroundColor White
    Start-Sleep -Seconds 0.3
    $webProc = Start-LoYoService -Title "LoYo OS - WEB Tauri" -Path $WebPath -Command $WebCommand -MinimizeAfter 2
    if ($webProc) { $global:AllProcs += $webProc }

    Write-Host ""
    Write-Host "Vsechny sluzby spusteny a minimalizovany!" -ForegroundColor Green
    Write-Host "Hlavni okno se minimalizuje za 2s..." -ForegroundColor Gray
    Start-Sleep -Seconds 2

    # Minimalizuj hlavni okno
    $mainHandle = Get-ConsoleHandle
    Minimize-Window -hWnd $mainHandle

    Write-Host ""
    Write-Host "Pro ovladani obnov okno LoYo OS - Main" -ForegroundColor Yellow
    Write-Host "  [Q] = ukoncit  [N] = zpet  [R] = restart" -ForegroundColor Cyan

    # --- Input loop - ceka na Q ---
    while ($true) {
        # ReadKey blokuje, ale okno je minimalizovane - uzivatel ho musi obnovit
        try {
            $key = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            $char = $key.Character.ToString().ToLower()
            # ignoruj prazdne
            if ([string]::IsNullOrWhiteSpace($char)) { continue }

            if ($char -eq "q") {
                Write-Host "`n`nOpravdu chces ukoncit LoYo OS?" -ForegroundColor Red
                Write-Host "[Q] Quit (ukoncit vse) / [N] NO (zpet do menu) / [R] Restart" -ForegroundColor Yellow
                $confirm = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                $c = $confirm.Character.ToString().ToLower()

                if ($c -eq "q") {
                    Write-Host "`nUkoncuji vsechny sluzby..." -ForegroundColor Red
                    foreach ($p in $global:AllProcs) {
                        try {
                            if (-not $p.HasExited) {
                                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
                                Write-Host "  - Ukonceno PID $($p.Id)" -ForegroundColor DarkGray
                            }
                        } catch {}
                    }
                    Write-Host "LoYo OS ukoncen. Nashledanou!" -ForegroundColor Green
                    Start-Sleep -Seconds 1
                    exit 0
                }
                elseif ($c -eq "n") {
                    Write-Host "`n[NO] Pokracuju..." -ForegroundColor Green
                    Write-Host "  [Q] = ukoncit  [N] = zpet  [R] = restart" -ForegroundColor Cyan
                    continue
                }
                elseif ($c -eq "r") {
                    Write-Host "`n[RESTART] Restartuji..." -ForegroundColor Yellow
                    foreach ($p in $global:AllProcs) {
                        try { if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } } catch {}
                    }
                    Start-Sleep -Seconds 1
                    break # vyskoci z vnitrniho while -> outer mainLoop restartne
                }
                else {
                    Write-Host "`nNeznama volba, zpet..." -ForegroundColor Gray
                    continue
                }
            }
            elseif ($char -eq "r") {
                Write-Host "`n[RESTART] Potvrzeno R -> restartuji..." -ForegroundColor Yellow
                foreach ($p in $global:AllProcs) {
                    try { if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } } catch {}
                }
                Start-Sleep -Seconds 1
                break
            }
            elseif ($char -eq "n") {
                Write-Host "`n[NO] Jsem zpet v menu, sluzby bezi..." -ForegroundColor Green
                continue
            }
        } catch {
            Start-Sleep -Milliseconds 200
        }
    }
    # pokud jsme breakli kvuli restartu, pokracuje mainLoop
    Write-Host "Restart za 1s..." -ForegroundColor Gray
    Start-Sleep -Seconds 1
}
