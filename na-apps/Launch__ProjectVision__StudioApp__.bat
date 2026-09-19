@echo off
REM =============================================================================
REM NOBLE ARCHITECTURE - STUDIO APP LAUNCHER
REM =============================================================================
REM
REM FILE       : Launch__ProjectVision__StudioApp__.bat
REM AUTHOR     : Adam Noble - Noble Architecture
REM PURPOSE    : One click into the whole local Noble Architecture ecosystem
REM CREATED    : 19-Sep-2026
REM
REM DESCRIPTION:
REM - Opens the Noble Architecture Studio window: the project gallery, then
REM   Project Admin, PlanVision and TrueVision 3D, all in a single window with
REM   Back, Forward and a project switcher in the bar.
REM - Starts the local server first when nothing is listening on port 8090, so
REM   this works whether or not the silent startup server is already running.
REM
REM INSTALLATION (Start Menu):
REM - Right-click this file, Send to, Desktop (create shortcut)
REM - Move the shortcut into:  %AppData%\Microsoft\Windows\Start Menu\Programs
REM - Rename it to "Noble Architecture Studio"
REM
REM OPTIONAL:
REM - Launch__ProjectVision__StudioApp__.bat PS01   opens straight into PS01
REM
REM =============================================================================

setlocal

if "%~1"=="" (
    powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass ^
        -File "%~dp0ProjectVision__StudioApp__Launch__.ps1"
) else (
    powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass ^
        -File "%~dp0ProjectVision__StudioApp__Launch__.ps1" -ProjectCode "%~1"
)

endlocal
exit /b 0
