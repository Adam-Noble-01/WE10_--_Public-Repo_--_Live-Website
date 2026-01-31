@echo off
REM =============================================================================
REM NOBLE ARCHITECTURE - LOCAL DEVELOPMENT SERVER
REM =============================================================================
REM
REM This script starts a simple Python HTTP server for local development.
REM 
REM Usage:
REM   1. Double-click this file to start the server
REM   2. Open http://localhost:8080 in your browser
REM   3. Add ?project=AA00&year=26 to test with the example project
REM
REM Requirements:
REM   - Python 3.x must be installed and in your PATH
REM
REM =============================================================================

echo.
echo ============================================================
echo   Noble Architecture - Project Admin Development Server
echo ============================================================
echo.
echo Starting local server on http://localhost:8080
echo Your default browser will open automatically...
echo.
echo Test URLs:
echo   - Main app: http://localhost:8080/na-apps/10__NaProjectAdmin__DocumentSystem__CoreAppCode/
echo   - Example project: http://localhost:8080/na-apps/10__NaProjectAdmin__DocumentSystem__CoreAppCode/?project=AA00^&year=26
echo.
echo Editor Tools:
echo   - Project Index Builder: http://localhost:8080/na-apps/10__NaProjectAdmin__DocumentSystem__CoreAppCode/04__EditorTools/Editor__ProjectIndexBuilder__.html
echo   - Project Config: http://localhost:8080/na-apps/10__NaProjectAdmin__DocumentSystem__CoreAppCode/04__EditorTools/Editor__ProjectConfig__.html
echo   - Quotation Builder: http://localhost:8080/na-apps/10__NaProjectAdmin__DocumentSystem__CoreAppCode/04__EditorTools/Editor__QuotationBuilder__.html
echo   - Terms Editor: http://localhost:8080/na-apps/10__NaProjectAdmin__DocumentSystem__CoreAppCode/04__EditorTools/Editor__TermsEditor__.html
echo.
echo Press Ctrl+C to stop the server
echo ============================================================
echo.

REM Navigate to repository root (3 levels up)
cd ..\..\..\

REM Start Python HTTP server from repository root
python -m http.server 8080

pause

