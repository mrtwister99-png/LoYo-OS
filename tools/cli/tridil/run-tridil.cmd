@echo off
rem LOYO OS // TRIDIL - spoustec pro Windows Task Scheduler (uloha "LoYo OS\Tridil", denne 00:05)
rem Zaloha k API scheduleru (00:00): kdyz API nebezelo, tohle trideni dozene.
rem Kdyz uz API roztridilo, beh nic nenajde (hranice = lastRun ze state.json).
cd /d "%~dp0..\..\.."
if not exist "data\logs" mkdir "data\logs"
echo ==== %date% %time% >> "data\logs\tridil-task.log"
call "%APPDATA%\npm\pnpm.cmd" cli:tridil %* >> "data\logs\tridil-task.log" 2>&1
