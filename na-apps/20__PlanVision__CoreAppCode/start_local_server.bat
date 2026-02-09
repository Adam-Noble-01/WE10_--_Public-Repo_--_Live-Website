@echo off
REM =============================================================================
REM  NOBLE ARCHITECTURE | PlanVision Local Development Server
REM =============================================================================
REM  Starts the Flask development server for local testing
REM  
REM  Requirements: Python 3.x with Flask and flask-cors installed
REM  Install with: pip install flask flask-cors
REM =============================================================================

title PlanVision Local Server

echo.
echo ============================================================================
echo   NOBLE ARCHITECTURE - PlanVision Local Development Server
echo ============================================================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH
    echo Please install Python from https://www.python.org/
    pause
    exit /b 1
)

REM Check if Flask is installed, install if not
echo [INFO] Checking dependencies...
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing Flask...
    pip install flask flask-cors
)

python -c "import flask_cors" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing flask-cors...
    pip install flask-cors
)

echo [INFO] Starting local server...
echo.

REM Change to the script's directory
cd /d "%~dp0"

REM Start the Flask server
python local_server.py

REM If the server stops, pause so user can see any errors
pause

