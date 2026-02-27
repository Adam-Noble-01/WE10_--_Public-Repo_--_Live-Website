@echo off
:: =============================================================================
:: NOBLE ARCHITECTURE - PROJECT VISION BUILD SCRIPT LAUNCHER
:: =============================================================================
::
:: FILE    : ProjectVision__BuildScript__.bat
:: PURPOSE : Run the ProjectVision__BuildScript__.py Python build script
::
:: USAGE:
::   Double-click this file, or run from command prompt:
::   ProjectVision__BuildScript__.bat
::
::   To specify a custom portal root path:
::   ProjectVision__BuildScript__.bat --portal-root "D:\path\to\na-project-portal"
::
:: =============================================================================

setlocal

:: Change to the directory containing this batch file
cd /d "%~dp0"

echo.
echo ============================================================
echo  Noble Architecture - Project Vision Build Script
echo ============================================================
echo.

:: Run the Python build script, forwarding any arguments passed to this bat file
python ProjectVision__BuildScript__.py %*

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Build script exited with error code %ERRORLEVEL%
) else (
    echo.
    echo [DONE] Build script completed successfully.
)

echo.
pause
endlocal
