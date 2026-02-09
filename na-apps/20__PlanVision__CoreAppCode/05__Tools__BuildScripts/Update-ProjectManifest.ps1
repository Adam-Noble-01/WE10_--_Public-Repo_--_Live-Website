# =============================================================================
# NOBLE ARCHITECTURE - PROJECT MANIFEST UPDATER
# =============================================================================
#
# FILE       : Update-ProjectManifest.ps1
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Auto-discover files in project folders and update JSON manifests
# CREATED    : 09-Feb-2026
#
# DESCRIPTION:
# - Scans project content folders for drawing/specification files
# - Updates the files arrays in JH03__PlanVision__ProjectData__.json
# - Skips 00__Archive folders and .note files
# - Preserves all manual metadata (labels, types, scales)
# - Reports changes (new files found, removed files)
#
# USAGE:
#   .\Update-ProjectManifest.ps1 -ProjectFolder "JH03__RomerCottage"
#   .\Update-ProjectManifest.ps1 -ProjectFolder "JH03__RomerCottage" -DryRun
#
# =============================================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectFolder,

    [Parameter(Mandatory = $false)]
    [string]$PortalBasePath = "",

    [Parameter(Mandatory = $false)]
    [switch]$DryRun
)

# =============================================================================
# CONFIGURATION
# =============================================================================

# Auto-detect the portal base path relative to this script
if (-not $PortalBasePath) {
    # Script is at: [repoRoot]/na-apps/20__PlanVision__CoreAppCode/05__Tools__BuildScripts/
    # Portal is at: [repoRoot]/na-project-portal/25-Projects/
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $repoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $scriptDir))
    $PortalBasePath = Join-Path $repoRoot "na-project-portal\25-Projects"
}

$projectPath = Join-Path $PortalBasePath $ProjectFolder
$jsonFileName = "${ProjectFolder}" -replace '__.*$', ''
# Extract the project code (e.g., JH03 from JH03__RomerCottage)
$projectCode = ($ProjectFolder -split '__')[0]
$jsonFilePath = Join-Path $projectPath "${projectCode}__PlanVision__ProjectData__.json"

# File extensions to discover (prioritize PNG, fall back to PDF)
$drawingExtensions = @('.png', '.pdf')
# Extensions and patterns to skip
$skipExtensions = @('.note', '.html')
$skipFolderPatterns = @('00__Archive*')

# =============================================================================
# FUNCTIONS
# =============================================================================

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
}

function Write-Info {
    param([string]$Text)
    Write-Host "  [INFO] $Text" -ForegroundColor Gray
}

function Write-Change {
    param([string]$Text)
    Write-Host "  [NEW]  $Text" -ForegroundColor Green
}

function Write-Removed {
    param([string]$Text)
    Write-Host "  [DEL]  $Text" -ForegroundColor Yellow
}

function Write-Skip {
    param([string]$Text)
    Write-Host "  [SKIP] $Text" -ForegroundColor DarkGray
}

function Test-ShouldSkipFolder {
    param([string]$FolderName)
    foreach ($pattern in $skipFolderPatterns) {
        if ($FolderName -like $pattern) {
            return $true
        }
    }
    return $false
}

function Get-DrawingFiles {
    <#
    .SYNOPSIS
    Discovers drawing files in a directory, returning base filenames (no extension).
    Prioritizes PNG files; includes PDF-only files as fallback.
    #>
    param(
        [string]$DirectoryPath
    )

    if (-not (Test-Path $DirectoryPath)) {
        return @()
    }

    $allFiles = Get-ChildItem -Path $DirectoryPath -File | Where-Object {
        $_.Extension -notin $skipExtensions
    }

    # Collect base names: prefer PNG, include PDF-only
    $pngBases = @()
    $pdfBases = @()

    foreach ($file in $allFiles) {
        $baseName = $file.BaseName
        $ext = $file.Extension.ToLower()

        if ($ext -eq '.png') {
            if ($pngBases -notcontains $baseName) {
                $pngBases += $baseName
            }
        }
        elseif ($ext -eq '.pdf') {
            if ($pdfBases -notcontains $baseName) {
                $pdfBases += $baseName
            }
        }
    }

    # Start with all PNG bases
    $result = [System.Collections.ArrayList]::new()
    foreach ($base in $pngBases) {
        [void]$result.Add($base)
    }

    # Add PDF-only bases (files that have PDF but no PNG)
    foreach ($base in $pdfBases) {
        if ($pngBases -notcontains $base) {
            [void]$result.Add($base)
        }
    }

    # Sort alphabetically for consistent ordering
    return ($result | Sort-Object)
}

function Update-FolderFiles {
    <#
    .SYNOPSIS
    Recursively updates the files arrays in a folder-structure entry.
    Returns a summary of changes.
    #>
    param(
        [PSCustomObject]$FolderEntry,
        [string]$BaseDiskPath,
        [string]$RelativePath
    )

    $changes = @{
        Added   = @()
        Removed = @()
    }

    $folderName = $FolderEntry.folder
    if (-not $folderName) { $folderName = "." }

    # Build disk path for this folder
    if ($folderName -eq ".") {
        $diskPath = $BaseDiskPath
    }
    else {
        $diskPath = Join-Path $BaseDiskPath $folderName
    }

    $displayPath = if ($RelativePath -and $folderName -ne ".") {
        "$RelativePath/$folderName"
    }
    elseif ($folderName -ne ".") {
        $folderName
    }
    else {
        "(root)"
    }

    # Discover files on disk
    $discoveredFiles = Get-DrawingFiles -DirectoryPath $diskPath

    # Get current files from JSON (handle null)
    $currentFiles = @()
    if ($null -ne $FolderEntry.files) {
        $currentFiles = @($FolderEntry.files)
    }

    # Calculate differences
    $newFiles = $discoveredFiles | Where-Object { $currentFiles -notcontains $_ }
    $removedFiles = $currentFiles | Where-Object { $discoveredFiles -notcontains $_ }

    if ($newFiles) {
        foreach ($f in $newFiles) {
            Write-Change "$displayPath  -->  $f"
            $changes.Added += $f
        }
    }
    if ($removedFiles) {
        foreach ($f in $removedFiles) {
            Write-Removed "$displayPath  -->  $f"
            $changes.Removed += $f
        }
    }

    if (-not $newFiles -and -not $removedFiles) {
        Write-Info "$displayPath  -->  No changes ($($discoveredFiles.Count) files)"
    }

    # Update the files array on the entry
    # Convert to a simple array for JSON serialization
    $FolderEntry | Add-Member -MemberType NoteProperty -Name 'files' -Value @($discoveredFiles) -Force

    # Process subfolders recursively
    if ($null -ne $FolderEntry.subfolders) {
        foreach ($subfolder in $FolderEntry.subfolders) {
            $subChanges = Update-FolderFiles -FolderEntry $subfolder -BaseDiskPath $diskPath -RelativePath $displayPath
            $changes.Added += $subChanges.Added
            $changes.Removed += $subChanges.Removed
        }

        # Also check for new subfolders on disk that aren't in the JSON
        if (Test-Path $diskPath) {
            $diskSubfolders = Get-ChildItem -Path $diskPath -Directory | Where-Object {
                -not (Test-ShouldSkipFolder $_.Name)
            }

            $existingSubfolderNames = @()
            foreach ($sf in $FolderEntry.subfolders) {
                $existingSubfolderNames += $sf.folder
            }

            foreach ($diskSf in $diskSubfolders) {
                if ($existingSubfolderNames -notcontains $diskSf.Name) {
                    # New subfolder found on disk - add it with auto-discovered files
                    $newSubFiles = Get-DrawingFiles -DirectoryPath $diskSf.FullName

                    if ($newSubFiles.Count -gt 0) {
                        # Generate a label from the folder name
                        $labelParts = ($diskSf.Name -replace '^\d+__', '') -split '__'
                        $label = ($labelParts | ForEach-Object {
                            ($_ -creplace '([a-z])([A-Z])', '$1 $2')
                        }) -join ' '

                        $newSubEntry = [PSCustomObject]@{
                            folder = $diskSf.Name
                            label  = $label
                            files  = @($newSubFiles)
                        }

                        $subArray = [System.Collections.ArrayList]@($FolderEntry.subfolders)
                        [void]$subArray.Add($newSubEntry)
                        $FolderEntry | Add-Member -MemberType NoteProperty -Name 'subfolders' -Value @($subArray) -Force

                        Write-Change "NEW SUBFOLDER: $displayPath/$($diskSf.Name) ($($newSubFiles.Count) files)"
                        $changes.Added += $newSubFiles
                    }
                }
            }
        }
    }

    return $changes
}

# =============================================================================
# MAIN EXECUTION
# =============================================================================

Write-Header "Noble Architecture - Project Manifest Updater"
Write-Info "Project: $ProjectFolder"
Write-Info "JSON:    $jsonFilePath"
Write-Info "Mode:    $(if ($DryRun) { 'DRY RUN (no changes written)' } else { 'UPDATE' })"

# Validate paths
if (-not (Test-Path $projectPath)) {
    Write-Host ""
    Write-Host "  [ERROR] Project folder not found: $projectPath" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $jsonFilePath)) {
    Write-Host ""
    Write-Host "  [ERROR] JSON file not found: $jsonFilePath" -ForegroundColor Red
    exit 1
}

# Read the JSON file
Write-Host ""
Write-Info "Reading JSON configuration..."
$jsonContent = Get-Content -Path $jsonFilePath -Raw -Encoding UTF8
$jsonData = $jsonContent | ConvertFrom-Json

# Navigate to phase-content
$phaseContent = $jsonData.'na-project-data-library'.'project-documentation'.'phase-content'

if (-not $phaseContent) {
    Write-Host ""
    Write-Host "  [ERROR] No 'phase-content' found in JSON. Is this the new format?" -ForegroundColor Red
    exit 1
}

# Process each phase
$totalAdded = 0
$totalRemoved = 0

$phases = $phaseContent | Get-Member -MemberType NoteProperty | Select-Object -ExpandProperty Name

foreach ($phaseName in $phases) {
    $phase = $phaseContent.$phaseName
    $phaseFolder = $phase.'phase-folder'

    Write-Header "Processing: $phaseName ($phaseFolder)"

    if (-not $phaseFolder) {
        Write-Skip "No phase-folder defined - skipping"
        continue
    }

    $phaseDiskPath = Join-Path $projectPath $phaseFolder

    if (-not (Test-Path $phaseDiskPath)) {
        Write-Skip "Phase folder not found on disk: $phaseDiskPath"
        continue
    }

    $folderStructure = $phase.'folder-structure'
    if (-not $folderStructure) {
        Write-Skip "No folder-structure defined - skipping"
        continue
    }

    foreach ($folderEntry in $folderStructure) {
        $changes = Update-FolderFiles -FolderEntry $folderEntry -BaseDiskPath $phaseDiskPath -RelativePath ""
        $totalAdded += $changes.Added.Count
        $totalRemoved += $changes.Removed.Count
    }
}

# Summary
Write-Header "Summary"
Write-Info "Files added:   $totalAdded"
Write-Info "Files removed: $totalRemoved"

if ($totalAdded -eq 0 -and $totalRemoved -eq 0) {
    Write-Host ""
    Write-Host "  No changes detected. JSON is up to date." -ForegroundColor Green
    Write-Host ""
    exit 0
}

# Write updated JSON
if (-not $DryRun) {
    Write-Host ""
    Write-Info "Writing updated JSON..."

    $updatedJson = $jsonData | ConvertTo-Json -Depth 20
    # Ensure proper UTF-8 without BOM
    [System.IO.File]::WriteAllText($jsonFilePath, $updatedJson, [System.Text.UTF8Encoding]::new($false))

    Write-Host ""
    Write-Host "  JSON updated successfully!" -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "  DRY RUN - No changes written to disk." -ForegroundColor Yellow
    Write-Host "  Remove -DryRun flag to apply changes." -ForegroundColor Yellow
}

Write-Host ""
