@echo off
:: Vytvori jen zastupce na plose pro LoYoOS.bat
set "BAT_FILE=%~dp0LoYoOS.bat"
if not exist "%BAT_FILE%" set "BAT_FILE=%~dp0Start-LoYoOS.ps1"

echo Vytvarim zastupce pro: %BAT_FILE%
powershell -ExecutionPolicy Bypass -NoProfile -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\LoYo OS.lnk'); $Shortcut.TargetPath = '%BAT_FILE%'; $Shortcut.WorkingDirectory = '%~dp0'; $Shortcut.IconLocation = 'shell32.dll,21'; $Shortcut.Description = 'Spustit LoYo OS'; $Shortcut.Save(); Write-Host 'Hotovo!' -ForegroundColor Green"
pause
