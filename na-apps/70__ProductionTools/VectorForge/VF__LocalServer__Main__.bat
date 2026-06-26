@echo off
REM =============================================================================
REM NOBLE ARCHITECTURE - VECTORFORGE LOCAL DEVELOPMENT SERVER
REM =============================================================================
REM
REM FILE    : VF__LocalServer__Main__.bat
REM PURPOSE : Launch the VectorForge Flask local development server
REM CREATED : 26-Jun-2026
REM
REM  Entry Point:
REM    - http://127.0.0.1:8006/  (VectorForge SVG Editor)
REM
REM  Requirements: Python 3.x with Flask and flask-cors installed
REM  Install with: pip install flask flask-cors
REM
REM =============================================================================

title VectorForge Local Server - Port 8006

echo.
echo ============================================================================
echo   NOBLE ARCHITECTURE - VectorForge Local Development Server
echo ============================================================================
echo.

REM --- Check Python is installed -----------------------------------------------
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo         Please install Python from https://www.python.org/
    pause
    exit /b 1
)

REM --- Check Flask is installed, install if not --------------------------------
echo [INFO] Checking dependencies...
python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Flask not found - installing...
    pip install flask flask-cors
)

python -c "import flask_cors" >nul 2>&1
if errorlevel 1 (
    echo [INFO] flask-cors not found - installing...
    pip install flask-cors
)

echo [INFO] Starting VectorForge server on http://127.0.0.1:8006
echo.

REM --- Change to the directory containing this script --------------------------
cd /d "%~dp0"

REM --- Start the Flask server --------------------------------------------------
python VF__LocalServer__Main__.py %*

REM --- If server stops, pause so user can see any errors -----------------------
pause
