@echo off
REM =============================================================================
REM PROJECT VISION - WINDOWS STARTUP SILENT SERVER LAUNCHER (PORT 8090)
REM =============================================================================
REM
REM FILE       : Start__ProjectVision__WindowsStartUp__Silent__8090__.bat
REM AUTHOR     : Adam Noble - Noble Architecture
REM PURPOSE    : Launch the Project Vision server at login with no visible console
REM CREATED    : 19-Sep-2026
REM
REM DESCRIPTION:
REM - Runs the Flask server under pythonw.exe so nothing appears on screen.
REM - Opens no browser window: use Launch__ProjectVision__StudioApp__.bat, or
REM   the installed Noble Architecture Studio PWA, to open the app itself.
REM - Does nothing when port 8090 is already listening, so running it twice
REM   never produces a second server.
REM - All output goes to ProjectVision__LocalServer__Startup__.log beside this
REM   file, which is where to look when the Studio window will not connect.
REM
REM INSTALLATION:
REM - Press Win+R and run: shell:startup
REM - Create a shortcut to this file in the Startup folder
REM
REM TO STOP THE SERVER:
REM - Task Manager, end the pythonw.exe process
REM
REM =============================================================================

setlocal
cd /d "%~dp0"

powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command ^
    "$existingConnection = Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue; " ^
    "if ($existingConnection) { exit 0 }; " ^
    "$pythonw = Get-Command pythonw.exe -ErrorAction SilentlyContinue; " ^
    "if ($pythonw) { $pythonExePath = $pythonw.Source } else { $pythonExePath = (Get-Command python.exe -ErrorAction Stop).Source }; " ^
    "$serverScriptPath = Join-Path $pwd.Path 'ProjectVision__LocalServer__Main__.py'; " ^
    "Start-Process -FilePath $pythonExePath -ArgumentList @($serverScriptPath, '--port', '8090', '--silent', '--no-browser', '--log-file', 'ProjectVision__LocalServer__Startup__.log') -WorkingDirectory $pwd.Path -WindowStyle Hidden"

exit /b 0
