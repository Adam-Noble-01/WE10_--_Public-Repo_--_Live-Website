@echo off
REM =============================================================================
REM NOBLE BIM ASSET TOOLS - LOCAL SERVER LAUNCHER
REM =============================================================================
REM
REM FILE      : Na__LocalServer__Main__.bat
REM AUTHOR    : Adam Noble - Noble Architecture
REM PURPOSE   : Start the local development server and open the application
REM CREATED   : 14-Aug-2026
REM
REM =============================================================================

setlocal
cd /d "%~dp0"

echo.
echo  Starting Noble BIM Asset Tools...
echo.

REM --- Locate a Python interpreter -------------------------------------------
REM The py launcher is preferred because it resolves the newest install; plain
REM python is the fallback for environments that only have it on PATH.
where py >nul 2>&1
if %errorlevel%==0 (
    py -3 "Na__LocalServer__Main__.py" %*
    goto :finished
)

where python >nul 2>&1
if %errorlevel%==0 (
    python "Na__LocalServer__Main__.py" %*
    goto :finished
)

echo  ERROR: Python was not found on PATH.
echo  Install Python 3 from https://www.python.org/downloads/ and try again.
echo.
pause
exit /b 1

:finished
endlocal
