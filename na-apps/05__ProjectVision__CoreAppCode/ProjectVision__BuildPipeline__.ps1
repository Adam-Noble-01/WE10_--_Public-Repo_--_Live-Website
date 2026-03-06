# =============================================================================
# NOBLE ARCHITECTURE - PROJECT VISION BUILD PIPELINE (PowerShell)
# =============================================================================
#
# Called by ProjectVision__BuildScript__.bat
# 1. Runs ProjectVision__BuildScript__.py (project index + TrueVision data)
# 2. Runs CloudflareR2__ModelSync__Main__.py (R2 upload with dry-run)
#
# PURGE MODE:
#   When --purge / --Purge / --purgeGlb / --PurgeGlb is passed, the pipeline
#   skips the build step and runs only the R2 sync script with the purge flag.
#   Example:  ProjectVision__BuildScript__.bat --purge RB05
#
# =============================================================================

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExtraArgs
)

$Host.UI.RawUI.WindowTitle = 'Noble Architecture - Project Vision Build'

# Ensure Python output encoding matches console
$env:PYTHONIOENCODING = 'utf-8'

# ANSI / Virtual Terminal processing is enabled by each Python script via
# ctypes (see _enable_windows_ansi in CloudflareR2__ModelSync__Main__.py).
# No PowerShell-side P/Invoke is needed.

Set-Location $PSScriptRoot

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '  Noble Architecture - Project Vision Build Pipeline' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''

# Detect purge flags among the arguments
$isPurge = $false
if ($ExtraArgs) {
    foreach ($arg in $ExtraArgs) {
        if ($arg -in '--purge','--Purge','--purgeGlb','--PurgeGlb') {
            $isPurge = $true
            break
        }
    }
}

# CHECK PYTHON
Write-Host '[CHECK] Verifying Python installation...' -ForegroundColor Blue
try {
    $pyVer = python --version 2>&1
    Write-Host "[OK] $pyVer" -ForegroundColor Green
} catch {
    Write-Host '[ERROR] Python not found. Please install Python 3.x' -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
}

# CHECK DEPENDENCIES
Write-Host '[CHECK] Verifying Python dependencies...' -ForegroundColor Blue
$missing = @()

python -c 'import boto3' 2>$null
if ($LASTEXITCODE -ne 0) { $missing += 'boto3' }

python -c 'import dotenv' 2>$null
if ($LASTEXITCODE -ne 0) { $missing += 'python-dotenv' }

if ($missing.Count -gt 0) {
    Write-Host "[INSTALL] Installing missing packages: $($missing -join ', ')" -ForegroundColor Yellow
    python -m pip install $missing --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[ERROR] Failed to install dependencies' -ForegroundColor Red
        Read-Host 'Press Enter to exit'
        exit 1
    }
    Write-Host '[OK] Dependencies installed' -ForegroundColor Green
} else {
    Write-Host '[OK] All dependencies present (boto3, python-dotenv)' -ForegroundColor Green
}

Write-Host ''

if ($isPurge) {
    # PURGE MODE | Skip build, run R2 sync with purge flag only
    Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
    Write-Host '  MODE: GLB PURGE (skipping build step)' -ForegroundColor Yellow
    Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
    Write-Host ''

    python CloudflareR2__ModelSync__Main__.py @ExtraArgs

    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host "[ERROR] R2 purge failed with exit code $LASTEXITCODE" -ForegroundColor Red
    } else {
        Write-Host '[DONE] R2 purge completed successfully' -ForegroundColor Green
    }
} else {
    # STEP 1 | Run Project Vision Build Script
    Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
    Write-Host '  STEP 1: Project Index + TrueVision Data Generation' -ForegroundColor Cyan
    Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
    Write-Host ''

    if ($ExtraArgs) {
        python ProjectVision__BuildScript__.py @ExtraArgs
    } else {
        python ProjectVision__BuildScript__.py
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host "[ERROR] Build script failed with exit code $LASTEXITCODE" -ForegroundColor Red
        Read-Host 'Press Enter to exit'
        exit $LASTEXITCODE
    }

    Write-Host '[DONE] Build script completed successfully' -ForegroundColor Green
    Write-Host ''

    # STEP 2 | Run Cloudflare R2 Model Sync
    Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
    Write-Host '  STEP 2: Cloudflare R2 Model Sync' -ForegroundColor Cyan
    Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
    Write-Host ''

    if ($ExtraArgs) {
        python CloudflareR2__ModelSync__Main__.py @ExtraArgs
    } else {
        python CloudflareR2__ModelSync__Main__.py
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host "[ERROR] R2 sync failed with exit code $LASTEXITCODE" -ForegroundColor Red
    } else {
        Write-Host '[DONE] R2 sync completed successfully' -ForegroundColor Green
    }
}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '  Build Pipeline Complete' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''
Read-Host 'Press Enter to close this window'
