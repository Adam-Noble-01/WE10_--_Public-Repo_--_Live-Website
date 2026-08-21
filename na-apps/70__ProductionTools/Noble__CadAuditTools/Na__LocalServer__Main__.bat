@echo off
REM =============================================================================
REM NOBLE ARCHITECTURE - CAD AUDIT TOOLS LOCAL DEVELOPMENT SERVER
REM =============================================================================
REM
REM FILE    : Na__LocalServer__Main__.bat
REM PURPOSE : Launch the Noble CAD Audit Tools Flask local development server
REM CREATED : 07-Jul-2026
REM
REM  Entry Point:
REM    - http://127.0.0.1:8007/  (Noble CAD Audit Tools)
REM
REM  RESET BY DEFAULT: this launcher always passes -r, so double-clicking it
REM  kills whatever holds port 8007 (e.g. the silent login instance or an
REM  earlier session) and starts fresh on current code. This is THE way to
REM  restart the server after a code change.
REM
REM  Extra arguments are still forwarded (e.g. Na__LocalServer__Main__.bat --silent).
REM  Only a bare "python Na__LocalServer__Main__.py" (no -r) refuses when the
REM  port is held - that protective default is for scripted launches.
REM
REM  Requirements: Python 3.x with Flask, flask-cors, and ezdxf installed.
REM  This script auto-installs missing dependencies from requirements.txt.
REM
REM =============================================================================

title Noble CAD Audit Tools - Local Server Port 8007

echo.
echo ============================================================================
echo   NOBLE ARCHITECTURE - Noble CAD Audit Tools
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

REM --- Check Flask is installed, install from requirements if not --------------
echo [INFO] Checking Python dependencies...

python -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Flask not found - installing from requirements.txt...
    pip install -r requirements.txt
    goto :deps_done
)

python -c "import flask_cors" >nul 2>&1
if errorlevel 1 (
    echo [INFO] flask-cors not found - installing...
    pip install flask-cors
)

python -c "import ezdxf" >nul 2>&1
if errorlevel 1 (
    echo [INFO] ezdxf not found - installing...
    pip install ezdxf
)

:deps_done
echo [INFO] Dependencies OK.
echo.
echo [INFO] Starting Noble CAD Audit Tools server on http://127.0.0.1:8007
echo [INFO] Reset mode: any instance already holding port 8007 will be replaced.
echo.

REM --- Change to the directory containing this script --------------------------
cd /d "%~dp0"

REM --- Start the Flask server (reset by default - takes over port 8007) --------
python Na__LocalServer__Main__.py -r %*

REM --- If server stops, pause so user can see any errors -----------------------
pause
