# =============================================================================
# Simple Server - Local Host Launcher (Consolidated)
# =============================================================================
#
# Run this script to start a local HTTP server and open the entry file in browser.
# Double-click or run: powershell -ExecutionPolicy Bypass -File "thisfile.ps1"
#
# =============================================================================

param(
    [switch]$ServerOnly,
    [string]$ServeDir = $PSScriptRoot,
    [int]$Port = 8080,
    [int]$PauseSeconds = 3
)

# -----------------------------------------------------------------------------
# REGION | Server Mode - Run HTTP server in this window
# -----------------------------------------------------------------------------
if ($ServerOnly) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Simple Server - Local Host Launcher" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Serving directory :" -NoNewline
    Write-Host " $ServeDir" -ForegroundColor Yellow
    Write-Host "  Port              :" -NoNewline
    Write-Host " $Port" -ForegroundColor Yellow
    Write-Host "  URL               :" -NoNewline
    Write-Host " http://localhost:$Port/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Server starting... (Ctrl+C to stop)" -ForegroundColor Green
    Write-Host ""

    Set-Location $ServeDir
    python -m http.server $Port
    exit
}

# -----------------------------------------------------------------------------
# REGION | Launcher Mode - Start server in new window, then open browser
# -----------------------------------------------------------------------------

$scriptPath = $PSCommandPath
$dir = if ($ServeDir) { $ServeDir.TrimEnd('\') } else { (Split-Path $scriptPath) }

# Start server in new window
Start-Process powershell -ArgumentList @(
    '-ExecutionPolicy', 'Bypass',
    '-NoExit',
    '-File', $scriptPath,
    '-ServerOnly',
    '-ServeDir', $dir,
    '-Port', $Port
)

# Wait for server to start
Start-Sleep -Seconds 2

# Launch Helper - locate entry file and open in browser
$patterns = @(
    '*__Main__.html',
    '*__Index__.html',
    'index.html'
)

Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host "  Launch Helper - Locating entry file" -ForegroundColor DarkGray
Write-Host "----------------------------------------" -ForegroundColor DarkGray

$found = $null
foreach ($p in $patterns) {
    $match = Get-ChildItem -Path $dir -Filter $p -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($match) {
        $found = $match.Name
        break
    }
}

if ($found) {
    Write-Host "  Found  :" -NoNewline
    Write-Host " $found" -ForegroundColor Green

    $url = "http://localhost:$Port/" + [uri]::EscapeDataString($found)
    Write-Host "  Opening:" -NoNewline
    Write-Host " $url" -ForegroundColor Cyan

    Start-Process $url
    Write-Host "  Done." -ForegroundColor Green
} else {
    Write-Host "  No entry file found." -ForegroundColor Yellow
    Write-Host "  Tried: __Main__.html, __Index__.html, index.html" -ForegroundColor DarkGray
}

Write-Host ""
Start-Sleep -Seconds $PauseSeconds
