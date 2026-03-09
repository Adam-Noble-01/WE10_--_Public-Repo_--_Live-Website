@echo off
REM =============================================================================
REM TRUEVISION3D - TEST ENVIRONMENT SERVER LAUNCHER
REM =============================================================================
REM
REM FILE       : TestEnv__FlaskLocalServer.bat
REM PURPOSE    : Launch the TrueVision3D test environment Flask server
REM CREATED    : 14-Feb-2026
REM
REM DESCRIPTION:
REM - Changes to the script directory so relative paths resolve correctly.
REM - Checks for Flask; auto-installs flask and flask-cors if missing.
REM - Starts the Flask development server on port 5500.
REM - Keeps the console window open if the server exits or errors occur.
REM
REM REQUIREMENTS:
REM   - Python 3.x with pip
REM   - Flask and flask-cors (auto-installed if missing)
REM
REM =============================================================================

echo.
echo =========================================================================
echo  TRUEVISION3D - TEST ENVIRONMENT SERVER LAUNCHER
echo =========================================================================
echo.

REM Change to the directory where this batch file lives
cd /d "%~dp0"

REM Check if Flask is installed
python -c "import flask" 2>nul
if %ERRORLEVEL% neq 0 (
    echo [NOTICE] Flask not installed. Installing dependencies...
    echo.
    pip install flask flask-cors
    echo.
)

echo Starting Flask server on http://127.0.0.1:5500
echo.

REM Start the Flask server
python TestEnv__FlaskLocalServer.py

REM Keep window open on exit (shows errors if any)
echo.
echo Server stopped. Press any key to close...
pause > nul

