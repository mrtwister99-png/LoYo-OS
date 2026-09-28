
$ROOT = "D:\dev\loyo-os"
$Desktop = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path $Desktop "LoYo OS.lnk"
Remove-Item $ShortcutPath -Force -ErrorAction SilentlyContinue
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-ExecutionPolicy Bypass -NoExit -File `"$ROOT\Start-LoYo.ps1`""
$Shortcut.WorkingDirectory = $ROOT
$Shortcut.IconLocation = "shell32.dll,21"
$Shortcut.Description = "LoYo OS - PS1 PID"
$Shortcut.Save()
Write-Host "Zastupce 'LoYo OS' vytvoren na plose!" -ForegroundColor Green
Pause
