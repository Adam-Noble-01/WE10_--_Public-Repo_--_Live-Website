@echo off
REM =============================================================================
REM NOBLE ARCHITECTURE - PROJECT VISION LOCAL DEVELOPMENT SERVER (FLASK)
REM =============================================================================
REM
REM This script starts a Flask HTTP server for local Project Vision development.
REM
REM Usage:
REM   ProjectVision__LocalServer__Main__.bat                - Start and open the project launcher
REM   ProjectVision__LocalServer__Main__.bat --debug        - Start with hot-reloading
REM   ProjectVision__LocalServer__Main__.bat --port 3000    - Use different port
REM   ProjectVision__LocalServer__Main__.bat --project BH03 - Skip the launcher, open one project
REM   ProjectVision__LocalServer__Main__.bat --no-browser   - Don't auto-open browser
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
echo Note:
echo   The local server now canonicalizes mixed-case entrypoints
echo   (e.g. Index.html) to lowercase index.html when available.
echo.
echo ============================================================
echo.

REM Run the Flask server with any passed arguments
python ProjectVision__LocalServer__Main__.py %*

pause
