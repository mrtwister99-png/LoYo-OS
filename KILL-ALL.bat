@echo off
powershell -ExecutionPolicy Bypass -Command "Get-Process | Where-Object {$_.MainWindowTitle -like '*LoYo OS - *'} | ForEach-Object { $_.Kill() }"
 echo Hotovo
 pause
