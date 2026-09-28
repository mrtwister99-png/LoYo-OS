@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title LoYo OS - Main 0%%

:: ============================================================
:: LoYo OS - BAT Launcher - das do ROOTu projektu
:: 1x spustis -> vytvori se ti LoYo OS.lnk na plose
:: Pak uz spoustis pres plochu
:: ============================================================

set "ROOT=%~dp0"
set "BAT_FILE=%~f0"

:: --- 1. VYTVOR ZASTUPCE NA PLOCHU (pokud neni) ---
if not exist "%USERPROFILE%\Desktop\LoYo OS.lnk" (
    echo [INFO] Vytvarim zastupce na plochu...
    powershell -ExecutionPolicy Bypass -NoProfile -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\LoYo OS.lnk'); $Shortcut.TargetPath = '%BAT_FILE%'; $Shortcut.WorkingDirectory = '%ROOT%'; $Shortcut.IconLocation = 'shell32.dll,21'; $Shortcut.Description = 'Spustit LoYo OS - API + MCP + WEB'; $Shortcut.Save()"
    if exist "%USERPROFILE%\Desktop\LoYo OS.lnk" (
        echo [OK] Zastupce vytvoren: Plocha\LoYo OS.lnk
    ) else (
        echo [WARN] Nepodarilo se vytvorit zastupce, pokracuju...
    )
    timeout /t 1 >nul
)

:: --- Detekce cest ---
set "API_PATH=%ROOT%src\apps\api"
if not exist "%API_PATH%" set "API_PATH=%ROOT%apps\api"
if not exist "%API_PATH%" set "API_PATH=%ROOT%loyo-main\src\apps\api"
if not exist "%API_PATH%" set "API_PATH=%ROOT%"

set "WEB_PATH=%ROOT%src\apps\web"
if not exist "%WEB_PATH%" set "WEB_PATH=%ROOT%apps\web"
if not exist "%WEB_PATH%" set "WEB_PATH=%ROOT%loyo-main\src\apps\web"
if not exist "%WEB_PATH%" set "WEB_PATH=%ROOT%"

set "MCP_PATH=%ROOT%src\apps\mcp"
if not exist "%MCP_PATH%" set "MCP_PATH=%ROOT%src\mcp"
if not exist "%MCP_PATH%" set "MCP_PATH=%ROOT%packages\mcp"
if not exist "%MCP_PATH%" set "MCP_PATH=%API_PATH%"

:: ============================================================
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
echo  API : %API_PATH%
echo  WEB : %WEB_PATH%
echo  MCP : %MCP_PATH%
echo.

:: --- 5s PROGRESS BAR 0%% - 100%% ---
echo  LoYo OS se spousti...
for /l %%i in (0,1,100) do (
    title LoYo OS %%i%% - Loading...
    
    set /a filled=%%i*30/100
    set "bar="
    for /l %%b in (1,1,30) do (
        if %%b leq !filled! (
            set "bar=!bar!#"
        ) else (
            set "bar=!bar!-"
        )
    )
    <nul set /p =^r [!bar!] %%i%%%%   
    ping 127.0.0.1 -n 1 -w 50 >nul
)
echo.
echo [OK] 100%% - Spoustim sluzby...
title LoYo OS 100%% - Running
timeout /t 1 >nul

:: --- 2. API TERMINAL ---
echo.
echo [1/3] Spoustim API...
start "LoYo OS - API" cmd /k "cd /d "%API_PATH%" && echo [LoYo API] && if exist package.json (pnpm dev) else (echo API path nenalezen - %API_PATH% & pause)"
timeout /t 1 >nul
powershell -ExecutionPolicy Bypass -NoProfile -Command "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr h,int c); [DllImport(\"user32.dll\")] public static extern IntPtr FindWindow(string a,string b);' -Name Win1 -Namespace W1; $h=[W1.Win1]::FindWindow($null,'LoYo OS - API'); if($h -ne 0){[W1.Win1]::ShowWindow($h,6)|Out-Null}" >nul 2>&1

:: --- 3. MCP TERMINAL ---
echo [2/3] Spoustim MCP...
start "LoYo OS - MCP" cmd /k "cd /d "%MCP_PATH%" && echo [LoYo MCP] && if exist package.json (pnpm dev:mcp 2>nul || pnpm mcp 2>nul || pnpm dev) else (echo MCP jede pres API routes/mcp.ts & cd /d "%API_PATH%" & pnpm dev)"
timeout /t 1 >nul
powershell -ExecutionPolicy Bypass -NoProfile -Command "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr h,int c); [DllImport(\"user32.dll\")] public static extern IntPtr FindWindow(string a,string b);' -Name Win2 -Namespace W2; $h=[W2.Win2]::FindWindow($null,'LoYo OS - MCP'); if($h -ne 0){[W2.Win2]::ShowWindow($h,6)|Out-Null}" >nul 2>&1

:: --- 4. WEB TAURI TERMINAL ---
echo [3/3] Spoustim WEB Tauri...
start "LoYo OS - WEB Tauri" cmd /k "cd /d "%WEB_PATH%" && echo [LoYo WEB Tauri] && if exist package.json (pnpm tauri dev 2>nul || pnpm dev) else (echo WEB path nenalezen - %WEB_PATH% & pause)"
timeout /t 2 >nul
powershell -ExecutionPolicy Bypass -NoProfile -Command "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr h,int c); [DllImport(\"user32.dll\")] public static extern IntPtr FindWindow(string a,string b);' -Name Win3 -Namespace W3; $h=[W3.Win3]::FindWindow($null,'LoYo OS - WEB Tauri'); if($h -ne 0){[W3.Win3]::ShowWindow($h,6)|Out-Null}" >nul 2>&1

echo.
echo Vsechny sluzby spusteny a minimalizovany!
echo Hlavni okno se minimalizuje za 2s... (obnov ho pro ovladani)
timeout /t 2 >nul

:: Minimalizuj hlavni okno
powershell -ExecutionPolicy Bypass -NoProfile -Command "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool ShowWindow(IntPtr h,int c); [DllImport(\"kernel32.dll\")] public static extern IntPtr GetConsoleWindow();' -Name WinMain -Namespace WMain; $h=[WMain.WinMain]::GetConsoleWindow(); [WMain.WinMain]::ShowWindow($h,6)|Out-Null" >nul 2>&1

:: ============================================================
:MENU
title LoYo OS - Main - Q=Quit N=Zpet R=Restart
echo.
echo ========================================
echo  LoYo OS bezi - obnov okno pro ovladani
echo  [Q] Quit   [N] NO/zpet   [R] Restart
echo ========================================
choice /c QNR /n /m "Volba Q/N/R: "
if %errorlevel%==3 goto RESTART_CONFIRM
if %errorlevel%==2 goto MENU
if %errorlevel%==1 goto QUIT_CONFIRM

:QUIT_CONFIRM
echo.
echo Opravdu chces ukoncit LoYo OS?
choice /c QNR /n /m "[Q] Quit (ukoncit vse) / [N] NO zpet / [R] Restart: "
if %errorlevel%==3 goto RESTART
if %errorlevel%==2 goto MENU
if %errorlevel%==1 goto DO_QUIT
goto MENU

:RESTART_CONFIRM
echo.
echo Restartovat LoYo OS?
choice /c ANR /n /m "[A] Ano restart / [N] Ne zpet / [Q] Quit: "
if %errorlevel%==3 goto QUIT_CONFIRM
if %errorlevel%==2 goto MENU
if %errorlevel%==1 goto RESTART

:RESTART
echo [RESTART] Ukoncuju sluzby a restartuju...
call :KILL_ALL
timeout /t 1 >nul
goto START_OS

:DO_QUIT
call :KILL_ALL
echo LoYo OS ukoncen. Nashledanou!
timeout /t 1 >nul
exit /b 0

:KILL_ALL
echo Ukoncuju: API, MCP, WEB...
taskkill /FI "WINDOWTITLE eq LoYo OS - API*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq LoYo OS - MCP*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq LoYo OS - WEB Tauri*" /T /F >nul 2>&1
exit /b
