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
REM - Does nothing when the server is already answering, so running it twice
REM   never produces a second server.
REM - All output goes to ProjectVision__LocalServer__Startup__.log beside this
REM   file, which is where to look when the Studio window will not connect.
REM
REM WHY THIS DEFERS TO THE SHARED SCRIPT:
REM - "Is the port in use" is the wrong question on this machine.
REM   WsToastNotification.exe holds 0.0.0.0:8090 permanently and answers HTTP 501,
REM   so a port check would report the server as running and never start Flask.
REM   ProjectVision__StudioApp__Launch__.ps1 asks the health endpoint for our own
REM   service name instead, and both launchers share that one definition.
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

powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass ^
    -File "%~dp0ProjectVision__StudioApp__Launch__.ps1" -Port 8090 -ServerOnly

endlocal
exit /b 0
