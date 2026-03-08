# =============================================================================
# NOBLE ARCHITECTURE - PROJECT VISION BUILD PIPELINE (PowerShell)
# =============================================================================
#
# Called by ProjectVision__BuildScript__.bat
#
# MODES:
#   --All                          Scan all projects (25+), sync TV + PV
#   --Project--{CODE}              Sync all files for a specific project
#   --Project--{CODE}--TV          Sync only TrueVision for a project
#   --Project--{CODE}--PV          Sync only PlanVision for a project
#   --purge {CODE}                 Purge GLB files for a project
#   --Help / --Instructions        Show usage guide
#
# When launched with no arguments, shows an interactive menu.
#
# =============================================================================

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ExtraArgs
)

$Host.UI.RawUI.WindowTitle = 'Noble Architecture - Project Vision Build'
$env:PYTHONIOENCODING = 'utf-8'

Set-Location $PSScriptRoot

# =============================================================================
# CONSTANTS
# =============================================================================

$MasterIndexPath = Join-Path $PSScriptRoot '05__AppData\ProjectVision__MasterProjectIndex__Core__.json'

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

function Show-Banner {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '  Noble Architecture - Project Vision Build Pipeline' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
}

function Show-Help {
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host '  Build Pipeline - Usage Guide' -ForegroundColor Cyan
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host '  COMMAND LINE FLAGS:' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  --All                          Scan all projects (2025+), sync TV + PV' -ForegroundColor Green
    Write-Host '  --Project--{CODE}              Sync all files for a specific project' -ForegroundColor Green
    Write-Host '  --Project--{CODE}--TV          Sync only TrueVision for a project' -ForegroundColor Green
    Write-Host '  --Project--{CODE}--PV          Sync only PlanVision for a project' -ForegroundColor Green
    Write-Host '  --purge {CODE}                 Purge GLB files from R2 for a project' -ForegroundColor Green
    Write-Host '  --Help / --Instructions        Show this usage guide' -ForegroundColor Green
    Write-Host ''
    Write-Host '  ALIASES:' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  --project {CODE}               Same as --Project--{CODE}' -ForegroundColor Gray
    Write-Host '  --project {CODE} --tv          Same as --Project--{CODE}--TV' -ForegroundColor Gray
    Write-Host '  --project {CODE} --pv          Same as --Project--{CODE}--PV' -ForegroundColor Gray
    Write-Host '  --TrueVision / --truevision    Same as --tv' -ForegroundColor Gray
    Write-Host '  --PlanVision / --planvision    Same as --pv' -ForegroundColor Gray
    Write-Host ''
    Write-Host '  EXAMPLES:' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  ProjectVision__BuildScript__.bat --All' -ForegroundColor DarkGray
    Write-Host '  ProjectVision__BuildScript__.bat --Project--RB05' -ForegroundColor DarkGray
    Write-Host '  ProjectVision__BuildScript__.bat --Project--RB05--PV' -ForegroundColor DarkGray
    Write-Host '  ProjectVision__BuildScript__.bat --project NP03 --tv' -ForegroundColor DarkGray
    Write-Host '  ProjectVision__BuildScript__.bat --purge RB05' -ForegroundColor DarkGray
    Write-Host ''
    Write-Host '  PROJECT CODE FORMAT:' -ForegroundColor Yellow
    Write-Host '  Two uppercase letters + two digits: AA00, RB05, NP03' -ForegroundColor Gray
    Write-Host ''
    Write-Host '============================================================' -ForegroundColor Cyan
    Write-Host ''
}

function Resolve-ProjectFromIndex {
    param([string]$ProjectCode)

    if (-not (Test-Path $MasterIndexPath)) {
        return $null
    }

    try {
        $index = Get-Content -Path $MasterIndexPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $code = $ProjectCode.ToUpper()
        $proj = $index.projects.$code
        if ($proj) {
            return @{
                Code   = $proj.projectCode
                Name   = $proj.projectName
                Folder = $proj.projectFolder
                Year   = $proj.projectYear
            }
        }
    } catch {
        Write-Host "  [WARNING] Failed to read master index: $_" -ForegroundColor Yellow
    }

    return $null
}

function Confirm-Action {
    param([string]$Prompt)

    $response = Read-Host "  $Prompt (y/n)"
    return ($response.Trim().ToLower() -in @('y', 'yes'))
}

# =============================================================================
# INTERACTIVE MENU (when no arguments provided)
# =============================================================================

function Show-InteractiveMenu {
    Write-Host '  What would you like to do?' -ForegroundColor Yellow
    Write-Host ''
    Write-Host '  [1]  Sync ALL projects          (TrueVision + PlanVision)' -ForegroundColor Green
    Write-Host '  [2]  Sync a SPECIFIC project     (TrueVision + PlanVision)' -ForegroundColor Green
    Write-Host '  [3]  Sync a SPECIFIC project     (TrueVision only)' -ForegroundColor Green
    Write-Host '  [4]  Sync a SPECIFIC project     (PlanVision only)' -ForegroundColor Green
    Write-Host '  [5]  Purge GLB files for a project' -ForegroundColor Yellow
    Write-Host '  [6]  Show help / instructions' -ForegroundColor Gray
    Write-Host '  [0]  Exit' -ForegroundColor Gray
    Write-Host ''

    $choice = Read-Host '  Enter choice (0-6)'
    return $choice.Trim()
}

function Prompt-ProjectCode {
    Write-Host ''
    $code = Read-Host '  Enter project code (e.g. RB05, NP03)'
    $code = $code.Trim().ToUpper()

    if ($code -notmatch '^[A-Z]{2}\d{2}$') {
        Write-Host "  [ERROR] Invalid project code format: '$code'" -ForegroundColor Red
        Write-Host '  Expected: two letters + two digits (e.g. RB05, NP03)' -ForegroundColor Yellow
        return $null
    }

    $projInfo = Resolve-ProjectFromIndex -ProjectCode $code
    if ($projInfo) {
        Write-Host ''
        Write-Host "  [PROJECT] $($projInfo.Code) - $($projInfo.Name)" -ForegroundColor Cyan
        Write-Host "  [FOLDER]  $($projInfo.Folder)" -ForegroundColor Gray
        Write-Host "  [YEAR]    $($projInfo.Year)-Projects" -ForegroundColor Gray
        Write-Host ''

        if (-not (Confirm-Action -Prompt 'Is this the correct project?')) {
            return $null
        }
    } else {
        Write-Host "  [WARNING] Project $code not found in master index." -ForegroundColor Yellow
        Write-Host '  The build step will run first to update the index.' -ForegroundColor Yellow
        Write-Host ''
        if (-not (Confirm-Action -Prompt 'Continue anyway?')) {
            return $null
        }
    }

    return $code
}

# =============================================================================
# FLAG PARSING
# =============================================================================

$mode         = ''
$projectCode  = ''
$syncFilter   = ''
$isPurge      = $false
$purgeCode    = ''
$showHelp     = $false
$interactive  = $false

if (-not $ExtraArgs -or $ExtraArgs.Count -eq 0) {
    $interactive = $true
}

for ($i = 0; $i -lt $ExtraArgs.Count; $i++) {
    $arg = $ExtraArgs[$i]

    if ($arg -in '--Help', '--help', '--Instructions', '--instructions') {
        $showHelp = $true
        break
    }

    if ($arg -in '--purge', '--Purge', '--purgeGlb', '--PurgeGlb') {
        $isPurge = $true
        if ($i + 1 -lt $ExtraArgs.Count) {
            $purgeCode = $ExtraArgs[$i + 1]
            $i++
        }
        continue
    }

    if ($arg -in '--All', '--all') {
        $mode = 'all'
        continue
    }

    if ($arg -in '--project', '--Project') {
        if ($i + 1 -lt $ExtraArgs.Count) {
            $projectCode = $ExtraArgs[$i + 1].ToUpper()
            $i++
        }
        $mode = 'project'
        continue
    }

    if ($arg -in '--tv', '--TV', '--TrueVision', '--truevision', '--truevision-only', '--tv-only') {
        $syncFilter = 'tv'
        continue
    }
    if ($arg -in '--pv', '--PV', '--PlanVision', '--planvision', '--planvision-only', '--pv-only') {
        $syncFilter = 'pv'
        continue
    }

    if ($arg -match '^--[Pp]roject--([A-Za-z]{2}\d{2})--(TV|tv|TrueVision|truevision)$') {
        $projectCode = $Matches[1].ToUpper()
        $mode = 'project'
        $syncFilter = 'tv'
        continue
    }
    if ($arg -match '^--[Pp]roject--([A-Za-z]{2}\d{2})--(PV|pv|PlanVision|planvision)$') {
        $projectCode = $Matches[1].ToUpper()
        $mode = 'project'
        $syncFilter = 'pv'
        continue
    }
    if ($arg -match '^--[Pp]roject--([A-Za-z]{2}\d{2})$') {
        $projectCode = $Matches[1].ToUpper()
        $mode = 'project'
        continue
    }

    if ($arg -eq '--dry-run-only') {
        continue
    }
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

Show-Banner

# INTERACTIVE MODE: show menu when no args given
if ($interactive) {
    $menuChoice = Show-InteractiveMenu

    switch ($menuChoice) {
        '1' {
            $mode = 'all'
        }
        '2' {
            $projectCode = Prompt-ProjectCode
            if (-not $projectCode) {
                Write-Host '  [CANCEL] Operation cancelled.' -ForegroundColor Red
                Write-Host ''
                Read-Host 'Press Enter to close this window'
                exit 0
            }
            $mode = 'project'
        }
        '3' {
            $projectCode = Prompt-ProjectCode
            if (-not $projectCode) {
                Write-Host '  [CANCEL] Operation cancelled.' -ForegroundColor Red
                Write-Host ''
                Read-Host 'Press Enter to close this window'
                exit 0
            }
            $mode = 'project'
            $syncFilter = 'tv'
        }
        '4' {
            $projectCode = Prompt-ProjectCode
            if (-not $projectCode) {
                Write-Host '  [CANCEL] Operation cancelled.' -ForegroundColor Red
                Write-Host ''
                Read-Host 'Press Enter to close this window'
                exit 0
            }
            $mode = 'project'
            $syncFilter = 'pv'
        }
        '5' {
            $purgeCode = Prompt-ProjectCode
            if (-not $purgeCode) {
                Write-Host '  [CANCEL] Operation cancelled.' -ForegroundColor Red
                Write-Host ''
                Read-Host 'Press Enter to close this window'
                exit 0
            }
            $isPurge = $true
        }
        '6' {
            Show-Help
            Read-Host 'Press Enter to close this window'
            exit 0
        }
        '0' {
            Write-Host '  Exiting.' -ForegroundColor Gray
            exit 0
        }
        default {
            Write-Host "  [ERROR] Invalid choice: '$menuChoice'" -ForegroundColor Red
            Write-Host ''
            Read-Host 'Press Enter to close this window'
            exit 0
        }
    }

    Write-Host ''
}

# Show help if --Help flag was passed
if ($showHelp) {
    Show-Help
    Read-Host 'Press Enter to close this window'
    exit 0
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

# PURGE MODE
if ($isPurge) {
    Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
    Write-Host '  MODE: GLB PURGE (skipping build step)' -ForegroundColor Yellow
    Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
    Write-Host ''

    $purgeTarget = $purgeCode
    if (-not $purgeTarget) { $purgeTarget = $projectCode }

    python CloudflareR2__ModelSync__Main__.py --purge $purgeTarget

    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host "[ERROR] R2 purge failed with exit code $LASTEXITCODE" -ForegroundColor Red
    } else {
        Write-Host '[DONE] R2 purge completed successfully' -ForegroundColor Green
    }

    Write-Host ''
    Read-Host 'Press Enter to close this window'
    exit $LASTEXITCODE
}

# PROJECT-SPECIFIC MODE (from CLI flags): Confirm project before proceeding
if (-not $interactive -and $mode -eq 'project' -and $projectCode) {
    $projInfo = Resolve-ProjectFromIndex -ProjectCode $projectCode

    if ($projInfo) {
        Write-Host "  [PROJECT] $($projInfo.Code) - $($projInfo.Name)" -ForegroundColor Cyan
        Write-Host "  [FOLDER]  $($projInfo.Folder)" -ForegroundColor Gray
        Write-Host "  [YEAR]    $($projInfo.Year)-Projects" -ForegroundColor Gray

        $filterLabel = switch ($syncFilter) {
            'tv'    { 'TrueVision only' }
            'pv'    { 'PlanVision only' }
            default { 'TrueVision + PlanVision' }
        }
        Write-Host "  [SYNC]    $filterLabel" -ForegroundColor Gray
        Write-Host ''

        if (-not (Confirm-Action -Prompt 'Is this the correct project?')) {
            Write-Host '  [CANCEL] Operation cancelled.' -ForegroundColor Red
            Write-Host ''
            Read-Host 'Press Enter to close this window'
            exit 0
        }
        Write-Host ''
    } else {
        Write-Host "  [WARNING] Project $projectCode not found in master index." -ForegroundColor Yellow
        Write-Host '  The build step will run first to update the index.' -ForegroundColor Yellow
        Write-Host ''
    }
}

# Display mode summary
$modeSummary = switch ($mode) {
    'all'     { 'ALL PROJECTS' }
    'project' { "PROJECT: $projectCode" }
    default   { 'ALL PROJECTS' }
}
$filterSummary = switch ($syncFilter) {
    'tv'    { ' (TrueVision only)' }
    'pv'    { ' (PlanVision only)' }
    default { ' (TrueVision + PlanVision)' }
}
Write-Host "  MODE: $modeSummary$filterSummary" -ForegroundColor Cyan
Write-Host ''

# STEP 1 | Run Project Vision Build Script
Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
Write-Host '  STEP 1: Project Index + Data Generation' -ForegroundColor Cyan
Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
Write-Host ''

python ProjectVision__BuildScript__.py

if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host "[ERROR] Build script failed with exit code $LASTEXITCODE" -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit $LASTEXITCODE
}

Write-Host '[DONE] Build script completed successfully' -ForegroundColor Green
Write-Host ''

# STEP 2 | Run Cloudflare R2 Sync
Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
Write-Host '  STEP 2: Cloudflare R2 Sync' -ForegroundColor Cyan
Write-Host '------------------------------------------------------------' -ForegroundColor DarkGray
Write-Host ''

# Build Python args for the R2 sync script
$r2Args = @()

if ($mode -eq 'project' -and $projectCode) {
    $projInfo = Resolve-ProjectFromIndex -ProjectCode $projectCode
    if ($projInfo) {
        $r2Args += '--project'
        $r2Args += $projInfo.Folder
    }
}

if ($syncFilter -eq 'tv') {
    $r2Args += '--tv-only'
} elseif ($syncFilter -eq 'pv') {
    $r2Args += '--pv-only'
}

# Pass through --dry-run-only if present in original args
if ($ExtraArgs -contains '--dry-run-only') {
    $r2Args += '--dry-run-only'
}

if ($r2Args.Count -gt 0) {
    python CloudflareR2__ModelSync__Main__.py @r2Args
} else {
    python CloudflareR2__ModelSync__Main__.py
}

if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host "[ERROR] R2 sync failed with exit code $LASTEXITCODE" -ForegroundColor Red
} else {
    Write-Host '[DONE] R2 sync completed successfully' -ForegroundColor Green
}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host '  Build Pipeline Complete' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ''
Read-Host 'Press Enter to close this window'
