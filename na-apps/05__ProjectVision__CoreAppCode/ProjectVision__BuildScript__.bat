@echo off
:: =============================================================================
:: NOBLE ARCHITECTURE - PROJECT VISION BUILD SCRIPT LAUNCHER
:: =============================================================================
::
:: FILE    : ProjectVision__BuildScript__.bat
:: PURPOSE : Run the Project Vision build pipeline in PowerShell
::           1. ProjectVision__BuildScript__.py  (project index + TrueVision data)
::           2. CloudflareR2__ModelSync__Main__.py (R2 upload with dry-run)
::
:: USAGE:
::   Double-click this file, or run from command prompt:
::   ProjectVision__BuildScript__.bat
::   ProjectVision__BuildScript__.bat --portal-root "D:\path\to\na-project-portal"
::
:: =============================================================================

start "Noble Architecture - Build Pipeline" powershell -NoExit -ExecutionPolicy Bypass -File "%~dp0ProjectVision__BuildPipeline__.ps1" %*
