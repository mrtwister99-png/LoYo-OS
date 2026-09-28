# Vytvori tlacitko LoYo OS na plochu
$Root = $PSScriptRoot
if (-not $Root) { $Root = Split-Path -Parent $MyInvocation.MyCommand.Path }

$Target = Join-Path $Root "Start-LoYoOS.ps1"
if (-not (Test-Path $Target)) {
    Write-Host "Nenalezen Start-LoYoOS.ps1 v $Root" -ForegroundColor Red
    Read-Host "Enter"
    exit 1
}

$WshShell = New-Object -ComObject WScript.Shell
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "LoYo OS.lnk"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-ExecutionPolicy Bypass -NoProfile -File `"$Target`""
$Shortcut.WorkingDirectory = $Root
$Shortcut.IconLocation = "powershell.exe,0"
$Shortcut.Description = "Spustit LoYo OS - API + MCP + WEB Tauri"
$Shortcut.Save()

Write-Host "Hotovo! Zástupce: $ShortcutPath" -ForegroundColor Green
Write-Host "Dvojklik na LoYo OS na plose = start" -ForegroundColor Cyan
Start-Sleep -Seconds 2
