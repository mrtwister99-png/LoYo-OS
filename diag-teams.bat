@echo off
echo === DIAGNOSTIKA TYMU ===
echo.
echo [1] data\capabilities\teams\index.json:
if exist "data\capabilities\teams\index.json" (
  type "data\capabilities\teams\index.json"
) else (
  echo NEEXISTUJE!
)
echo.
echo [2] data\teams\index.json:
if exist "data\teams\index.json" (
  type "data\teams\index.json"
) else (
  echo NEEXISTUJE!
)
echo.
echo [3] API /api/teams:
curl -s http://localhost:3001/api/teams
echo.
echo.
echo [4] Smazani index.db a restart API:
del /q data\index.db 2>nul
echo Hotovo - restartuj API pres LoYoOS.bat
pause
