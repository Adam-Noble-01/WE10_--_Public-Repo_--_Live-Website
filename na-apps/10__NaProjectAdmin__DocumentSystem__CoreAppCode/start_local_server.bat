@echo off
REM =============================================================================
REM NOBLE ARCHITECTURE - LOCAL DEVELOPMENT SERVER (FLASK)
REM =============================================================================
REM
REM This script starts a Flask HTTP server for local development.
REM 
REM Usage:
REM   start_local_server.bat                - Start and open the project launcher
REM   start_local_server.bat --debug        - Start with hot-reloading
REM   start_local_server.bat --port 3000    - Use different port
REM   start_local_server.bat --project JS01 - Skip the launcher, open one project
REM   start_local_server.bat --no-browser   - Don't auto-open browser
REM
REM Requirements:
REM   - Python 3.x with pip
REM   - Flask and flask-cors (run: pip install -r requirements.txt)
REM
REM =============================================================================

echo.
echo ============================================================
echo   Noble Architecture - Project Admin Development Server
echo ============================================================
echo.

REM Check if Flask is installed
python -c "import flask" 2>nul
if %ERRORLEVEL% neq 0 (
    echo [NOTICE] Flask not installed. Installing dependencies...
    echo.
    pip install -r requirements.txt
    echo.
)

echo Starting Flask server on http://localhost:8081
echo Opens the Project Launcher - a card view of every project in the
echo ProjectVision system, with one-click access to Project Admin,
echo PlanVision and TrueVision.
echo.
echo Command line options:
echo   --debug         Enable hot-reloading
echo   --port XXXX     Use different port
echo   --project XX00  Skip the launcher and open one project directly
echo   --no-browser    Don't auto-open browser
echo.
echo ============================================================
echo.

REM Run the Flask server with any passed arguments
python start_local_server.py %*

pause
