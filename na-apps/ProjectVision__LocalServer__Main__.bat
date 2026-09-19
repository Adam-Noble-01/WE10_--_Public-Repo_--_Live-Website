@echo off
REM =============================================================================
REM NOBLE ARCHITECTURE - PROJECT VISION LOCAL DEVELOPMENT SERVER (FLASK)
REM =============================================================================
REM
REM This script starts a Flask HTTP server for local Project Vision development
REM and opens the Noble Architecture Studio window on top of it.
REM
REM For everyday use prefer:
REM   Launch__ProjectVision__StudioApp__.bat   - opens the Studio window, starting
REM                                              the server only when it is down
REM   Start__ProjectVision__WindowsStartUp__Silent__8090__.bat
REM                                            - background server, added to the
REM                                              Windows Startup folder
REM
REM This file is the development console: it keeps the server in the foreground
REM so the request log and any traceback are visible.
REM
REM Usage:
REM   ProjectVision__LocalServer__Main__.bat                  - Start and open the Studio
REM   ProjectVision__LocalServer__Main__.bat --debug          - Start with hot-reloading
REM   ProjectVision__LocalServer__Main__.bat --port 3000      - Use different port
REM   ProjectVision__LocalServer__Main__.bat --project BH03   - Open straight into one project
REM   ProjectVision__LocalServer__Main__.bat --no-app-window  - Ordinary browser tab, not an app window
REM   ProjectVision__LocalServer__Main__.bat --no-browser     - Do not open anything
REM
REM Requirements:
REM   - Python 3.x with pip
REM   - Flask and flask-cors
REM
REM =============================================================================

echo.
echo ============================================================
echo   Noble Architecture - Project Vision Development Server
echo ============================================================
echo.

REM Check if Flask is installed
python -c "import flask" 2>nul
if %ERRORLEVEL% neq 0 (
    echo [NOTICE] Flask not installed. Installing dependencies...
    echo.
    pip install flask flask-cors
    echo.
)

echo Starting Flask server on http://localhost:8090
echo.
echo Opens the Noble Architecture Studio - one window over the whole
echo ecosystem. The project gallery lists every project newest first;
echo opening one keeps you in the same window, with Back, Forward and
echo a project switcher in the bar above.
echo.
echo Command line options:
echo   --debug          Enable hot-reloading
echo   --port XXXX      Use different port
echo   --project XX00   Open straight into one project
echo   --no-app-window  Use an ordinary browser tab instead of an app window
echo   --no-browser     Do not open anything
echo   --silent         Console-less run, output to the startup log
echo.
echo Note:
echo   The local server now canonicalizes mixed-case entrypoints
echo   (e.g. Index.html) to lowercase index.html when available.
echo.
echo   Routes added to this file do not exist in a server that is
echo   already running. Restart it after editing the .py.
echo.
echo ============================================================
echo.

REM Run the Flask server with any passed arguments
python ProjectVision__LocalServer__Main__.py %*

pause
