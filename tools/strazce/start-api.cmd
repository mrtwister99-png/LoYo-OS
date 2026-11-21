@echo off
rem Strážce: nahodí LoYo API v minimalizovaném okně „LoYo OS - API“ (stejně jako spouštěč)
cd /d "%~dp0..\..\apps\api"
start "LoYo OS - API" /min cmd.exe /k "title LoYo OS - API & pnpm dev"
