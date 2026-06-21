@echo off
REM =============================================================================
REM NOBLE ARCHITECTURE - TRUEVISION3D WORKER DEPLOY SCRIPT
REM =============================================================================
REM Deploys the na-truevision-api Worker to Cloudflare.
REM Run from this folder. Requires `wrangler login` to have been completed once.
REM =============================================================================

echo Deploying na-truevision-api Worker...
call wrangler deploy
echo.
echo Done. Worker URL: https://na-truevision-api.adam-fb3.workers.dev
pause
