@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title LoYo OS - Main 0%%

:: LoYo OS Launcher v3 - FIX 'et' 'f' error - pres temp ps1
set "ROOT=%~dp0"
set "BAT_FILE=%~f0"

:: --- ZASTUPCE NA PLOCHU - pres temp ps1 soubor aby nebyl problem s mezerou ---
if not exist "%USERPROFILE%\Desktop\LoYo OS.lnk" (
    echo [INFO] Vytvarim zastupce na plochu...
    set "PSFILE=%TEMP%\create_loyo_shortcut.ps1"
    >"%PSFILE%" echo $WshShell = New-Object -ComObject WScript.Shell
    >>"%PSFILE%" echo $Desktop = [Environment]::GetFolderPath('Desktop')
    >>"%PSFILE%" echo $ShortcutPath = Join-Path $Desktop 'LoYo OS.lnk'
    >>"%PSFILE%" echo $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    >>"%PSFILE%" echo $Shortcut.TargetPath = '%~f0'
    >>"%PSFILE%" echo $Shortcut.WorkingDirectory = '%~dp0'
    >>"%PSFILE%" echo $Shortcut.IconLocation = 'shell32.dll,21'
    >>"%PSFILE%" echo $Shortcut.Save()
    powershell -ExecutionPolicy Bypass -File "%PSFILE%" >nul 2>&1
    del /q "%PSFILE%" 2>nul
    echo [OK] Zastupce vytvoren
    timeout /t 1 >nul
)

:: --- Detekce cest ---
set "API_PATH=%ROOT%src\apps\api"
if not exist "%API_PATH%" set "API_PATH=%ROOT%apps\api"
if not exist "%API_PATH%" set "API_PATH=%ROOT%"

set "WEB_PATH=%ROOT%src\apps\web"
if not exist "%WEB_PATH%" set "WEB_PATH=%ROOT%apps\web"
if not exist "%WEB_PATH%" set "WEB_PATH=%ROOT%"

set "MCP_PATH=%ROOT%src\apps\mcp"
if not exist "%MCP_PATH%" set "MCP_PATH=%ROOT%packages\mcp"
if not exist "%MCP_PATH%" set "MCP_PATH=%API_PATH%"

:START_OS
cls
echo.
echo   _          __   __         ____  ____  
echo  ^| ^|    ___  \ \ / /__      / __ \/ __/  
echo  ^| ^|   / _ \  \ V / _ \    / / / /\ \    
echo  ^| ^|__^| (_) ^|  ^| ^| (_) ^|  / /_/ /___\ \  
echo  ^|_____\___/   ^|_^\___/   \____/____/    
echo.
echo  Root: %ROOT%
echo.

:: Progress
echo  LoYo OS se spousti...
for /l %%i in (0,1,100) do (
    title LoYo OS %%i%% - Loading...
    set /a filled=%%i*30/100
    set "bar="
    for /l %%b in (1,1,30) do (
        if %%b leq !filled! (set "bar=!bar!#") else (set "bar=!bar!-")
    )
    <nul set /p =^r [!bar!] %%i%%%%   
    ping 127.0.0.1 -n 1 -w 50 >nul
)
echo.
echo [OK] 100%% - Spoustim sluzby...
timeout /t 1 >nul

:: --- API ---
echo [1/3] Spoustim API...
start "LoYo OS - API" cmd /k "cd /d "%API_PATH%" && echo [LoYo API] && if exist package.json (pnpm dev) else (echo API path nenalezen)"
timeout /t 1 >nul
powershell -ExecutionPolicy Bypass -Command "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr h,int c); [DllImport(\"user32.dll\")] public static extern IntPtr FindWindow(string a,string b);' -Name W1 -Namespace W1; $h=[W1.W1]::FindWindow($null,'LoYo OS - API'); if($h -ne 0){[W1.W1]::ShowWindow($h,6)|Out-Null}" >nul 2>&1

:: --- MCP ---
echo [2/3] Spoustim MCP...
start "LoYo OS - MCP" cmd /k "cd /d "%MCP_PATH%" && echo [LoYo MCP] && if exist package.json (pnpm dev:mcp 2>nul || pnpm mcp 2>nul || pnpm dev) else (cd /d "%API_PATH%" & pnpm dev)"
timeout /t 1 >nul
powershell -ExecutionPolicy Bypass -Command "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr h,int c); [DllImport(\"user32.dll\")] public static extern IntPtr FindWindow(string a,string b);' -Name W2 -Namespace W2; $h=[W2.W2]::FindWindow($null,'LoYo OS - MCP'); if($h -ne 0){[W2.W2]::ShowWindow($h,6)|Out-Null}" >nul 2>&1

:: --- WEB ---
echo [3/3] Spoustim WEB Tauri...
start "LoYo OS - WEB Tauri" cmd /k "cd /d "%WEB_PATH%" && echo [LoYo WEB Tauri] && if exist package.json (pnpm tauri dev 2>nul || pnpm dev) else (echo WEB nenalezen)"
timeout /t 2 >nul
powershell -ExecutionPolicy Bypass -Command "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr h,int c); [DllImport(\"user32.dll\")] public static extern IntPtr FindWindow(string a,string b);' -Name W3 -Namespace W3; $h=[W3.W3]::FindWindow($null,'LoYo OS - WEB Tauri'); if($h -ne 0){[W3.W3]::ShowWindow($h,6)|Out-Null}" >nul 2>&1

echo Vsechny sluzby spusteny a minimalizovany!
timeout /t 2 >nul
powershell -ExecutionPolicy Bypass -Command "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr h,int c); [DllImport(\"kernel32.dll\")] public static extern IntPtr GetConsoleWindow();' -Name WM -Namespace WM; $h=[WM.WM]::GetConsoleWindow(); [WM.WM]::ShowWindow($h,6)|Out-Null" >nul 2>&1

:MENU
title LoYo OS - Main - Q=Quit G=Git R=Restart
echo.
echo ========================================
echo  LoYo OS bezi - obnov okno pro ovladani
echo  [Q] Quit (zavre VSE)  [G] Git push  [R] Restart
echo ========================================
choice /c QGRN /n /m "Volba Q/G/R/N: "
if %errorlevel%==4 goto MENU
if %errorlevel%==3 goto RESTART_CONFIRM
if %errorlevel%==2 goto GIT_PUSH
if %errorlevel%==1 goto QUIT_CONFIRM

:QUIT_CONFIRM
echo.
echo Opravdu ukoncit? (TAURI->MCP->API)
choice /c QN /n /m "[Q] Ano / [N] Ne: "
if %errorlevel%==2 goto MENU
goto DO_QUIT

:RESTART_CONFIRM
echo Restartovat?
choice /c ANQ /n /m "[A] Ano / [N] Ne / [Q] Quit: "
if %errorlevel%==3 goto QUIT_CONFIRM
if %errorlevel%==2 goto MENU
goto RESTART

:RESTART
call :KILL_ALL
goto START_OS

:GIT_PUSH
call :KILL_ALL
cd /d "%ROOT%"
git add data\capabilities\agents\*\manifest.json data\capabilities\teams\ data\teams\index.json 2>nul
git add -A
git status
set /p MSG="Commit message (Enter=auto): "
if "%MSG%"=="" set "MSG=chore: update iiaa-team"
git commit -m "%MSG%"
git pull --rebase origin main
git push origin main
pause
goto MENU

:DO_QUIT
call :KILL_ALL
echo LoYo OS ukoncen. Vsechny terminaly zavreny.
timeout /t 2 >nul
exit /b 0

:KILL_ALL
echo [QUIT] Ukoncuju...
echo  [1/3] WEB Tauri...
powershell -ExecutionPolicy Bypass -Command "Get-Process | Where-Object { $_.MainWindowTitle -like '*LoYo OS - WEB Tauri*' } | ForEach-Object { try { $_.CloseMainWindow() | Out-Null; Start-Sleep -m 500; if (!$_.HasExited) { $_.Kill() } } catch {} }" >nul 2>&1
taskkill /FI "WINDOWTITLE eq LoYo OS - WEB Tauri" /T /F >nul 2>&1
timeout /t 2 >nul
echo  [2/3] MCP...
powershell -ExecutionPolicy Bypass -Command "Get-Process | Where-Object { $_.MainWindowTitle -like '*LoYo OS - MCP*' } | ForEach-Object { try { $_.CloseMainWindow() | Out-Null; Start-Sleep -m 500; if (!$_.HasExited) { $_.Kill() } } catch {} }" >nul 2>&1
taskkill /FI "WINDOWTITLE eq LoYo OS - MCP" /T /F >nul 2>&1
timeout /t 1 >nul
echo  [3/3] API...
powershell -ExecutionPolicy Bypass -Command "Get-Process | Where-Object { $_.MainWindowTitle -like '*LoYo OS - API*' } | ForEach-Object { try { $_.CloseMainWindow() | Out-Null; Start-Sleep -m 500; if (!$_.HasExited) { $_.Kill() } } catch {} }" >nul 2>&1
taskkill /FI "WINDOWTITLE eq LoYo OS - API" /T /F >nul 2>&1
timeout /t 1 >nul
echo [QUIT] Hotovo.
exit /b
