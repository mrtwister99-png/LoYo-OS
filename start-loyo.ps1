# ============================================
#  LoYo OS v.3.0 - Boot Script
# ============================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ESC = [char]27

# --- HEX to ANSI True Color ---
function C($text, $hex) {
    $r = [convert]::ToInt32($hex.Substring(0,2), 16)
    $g = [convert]::ToInt32($hex.Substring(2,2), 16)
    $b = [convert]::ToInt32($hex.Substring(4,2), 16)
    Write-Host -NoNewline "$ESC[38;2;$r;$g;${b}m$text$ESC[0m"
}

function StatusLine($label, $state, $labelColor) {
    C "  $label" $labelColor
    Write-Host -NoNewline "  ->  "
    C "$state" "00D084"
    Write-Host ""
}

# === CESTY ===
$ROOT  = "D:\dev\loyo-os"
$TAURI = "$ROOT\apps\web"
$API   = "$ROOT\apps\api"
$MCP   = "$ROOT\apps\mcp"

# === CLEAR ===
[Console]::BackgroundColor = 'Black'
[Console]::ForegroundColor = 'White'
Clear-Host
Write-Host ""

# === HEADER ===
Write-Host -NoNewline "  "
C "Zapina se"  "FFFFFF"

Write-Host -NoNewline "  "
C "L" "1000A1"
C "o" "7A7A7A"
C "Y" "AE1710"
C "o" "7A7A7A"

Write-Host -NoNewline " "
C "OS" "7A7A7A"

Write-Host -NoNewline " "
C "v.3.0" "7A7A7A"

Write-Host -NoNewline "  "
C "system" "7A7A7A"
Write-Host ""

# USMEV pod oYo - cervene
Write-Host -NoNewline "              "
C "-_-" "FF3B30"
Write-Host ""
Write-Host ""

# === ODPOCET ===
$onlyTauri = $false

for ($i = 3; $i -ge 1; $i--) {
    Write-Host -NoNewline "`r  "
    C "Start za $i ... (T = pouze TAURI)" "FFD60A"
    Write-Host -NoNewline "   "
    
    # Cekani 1 sekundu s moznosti preruseni
    $startTime = Get-Date
    while ((New-TimeSpan -Start $startTime -End (Get-Date)).TotalSeconds -lt 1) {
        if ($Host.UI.RawUI.KeyAvailable) {
            $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            if ($key.Character -eq 'T' -or $key.Character -eq 't') {
                $onlyTauri = $true
                break
            }
        }
        Start-Sleep -Milliseconds 50
    }
    
    if ($onlyTauri) { break }
}

if ($onlyTauri) {
    Write-Host -NoNewline "`r  "
    C "Spoustim pouze TAURI..." "FFD60A"
} else {
    Write-Host -NoNewline "`r  "
    C "Start za 0 - jedeme!" "FFD60A"
}
Write-Host ""
Write-Host ""

# === SPUSTENI SLUZEB ===
$processIds = @()

# 1) TAURI - modrou
$cmd1 = "`$Host.UI.RawUI.WindowTitle = 'TAURI'; Set-Location -Path '$TAURI'; pnpm tauri dev"
$proc1 = Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd1 -WindowStyle Minimized -PassThru
$processIds += $proc1.Id
Start-Sleep -Seconds 2
StatusLine "TAURI" "READY" "1000A1"

# 2) API - cervenou (jen pokud neni onlyTauri)
if (-not $onlyTauri) {
    $cmd2 = "`$Host.UI.RawUI.WindowTitle = 'API'; Set-Location -Path '$API'; pnpm dev"
    $proc2 = Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd2 -WindowStyle Minimized -PassThru
    $processIds += $proc2.Id
    Start-Sleep -Seconds 2
    StatusLine "API  " "READY" "AE1710"

    # 3) MCP - sedou
    $cmd3 = "`$Host.UI.RawUI.WindowTitle = 'MCP'; Set-Location -Path '$MCP'; pnpm dev"
    $proc3 = Start-Process powershell -ArgumentList "-NoExit", "-Command", $cmd3 -WindowStyle Minimized -PassThru
    $processIds += $proc3.Id
    Start-Sleep -Seconds 2
    StatusLine "MCP  " "READY" "7A7A7A"
}

Write-Host ""
C "  Vse bezi. LoYo OS je pripraven." "00D084"
Write-Host ""

# === CEKACI SMYCKA ===
while ($true) {
    C "  Pro ukonceni stiskni [Q]" "7A7A7A"
    Write-Host ""

    $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

    if ($key.Character -eq 'Q' -or $key.Character -eq 'q') {
        Write-Host ""
        C "  Opravdu chces ukoncit LoYo OS?" "FFD60A"
        C " [A]no / [N]e" "7A7A7A"
        Write-Host ""

        $confirm = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

        if ($confirm.Character -eq 'A' -or $confirm.Character -eq 'a') {
            Write-Host ""
            C "  Ukoncuji sluzby..." "AE1710"
            Write-Host ""

            # Zavreni TAURI
            C "  Zaviram TAURI..." "1000A1"
            taskkill /F /T /PID $processIds[0] 2>&1 | Out-Null
            Start-Sleep -Milliseconds 500
            C " OK" "00D084"
            Write-Host ""

            # Zavreni API a MCP jen pokud bezely
            if (-not $onlyTauri) {
                C "  Zaviram API..." "AE1710"
                taskkill /F /T /PID $processIds[1] 2>&1 | Out-Null
                Start-Sleep -Milliseconds 500
                C " OK" "00D084"
                Write-Host ""

                C "  Zaviram MCP..." "7A7A7A"
                taskkill /F /T /PID $processIds[2] 2>&1 | Out-Null
                Start-Sleep -Milliseconds 500
                C " OK" "00D084"
                Write-Host ""
            }

            C "  LoYo OS ukoncen." "AE1710"
            Write-Host ""
            Start-Sleep -Milliseconds 800
            
            # Zavre samotne okno terminalu
            Stop-Process -Id $PID -Force
        }
        else {
            Write-Host ""
            C "  Pokracuji..." "00D084"
            Write-Host ""
            Write-Host ""
        }
    }
}