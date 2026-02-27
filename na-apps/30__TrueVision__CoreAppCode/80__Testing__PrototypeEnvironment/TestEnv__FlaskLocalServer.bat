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
REM - Starts the Flask development server on port 5500.
REM - Keeps the console window open if the server exits or errors occur.
REM
REM =============================================================================

echo.
echo =========================================================================
echo  TRUEVISION3D - TEST ENVIRONMENT SERVER LAUNCHER
echo =========================================================================
echo.

REM Change to the directory where this batch file lives
cd /d "%~dp0"

REM Start the Flask server
python TestEnv__FlaskLocalServer.py

REM Keep window open on exit (shows errors if any)
echo.
echo Server stopped. Press any key to close...
pause > nul

