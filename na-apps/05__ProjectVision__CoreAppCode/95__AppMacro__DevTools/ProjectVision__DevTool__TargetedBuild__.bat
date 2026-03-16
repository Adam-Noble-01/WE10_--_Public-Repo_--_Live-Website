@echo off
setlocal

REM ============================================================
REM PROJECT VISION - TARGETED BUILD DEV TOOL (WRAPPER)
REM ============================================================
REM Usage:
REM   ProjectVision__DevTool__TargetedBuild__.bat
REM   ProjectVision__DevTool__TargetedBuild__.bat --project JH03__RomerCottage --dry-run-check
REM   ProjectVision__DevTool__TargetedBuild__.bat --project JH03__RomerCottage
REM ============================================================

set SCRIPT_DIR=%~dp0
title Noble Architecture - Project Vision Targeted Build Dev Tool
python "%SCRIPT_DIR%ProjectVision__DevTool__TargetedBuild__.py" %*

endlocal
