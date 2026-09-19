# =============================================================================
# NOBLE ARCHITECTURE - PROJECT VISION STUDIO APP LAUNCHER
# =============================================================================
#
# FILE       : ProjectVision__StudioApp__Launch__.ps1
# AUTHOR     : Adam Noble - Noble Architecture
# PURPOSE    : Open the Noble Architecture Studio window, starting the local
#              server first when it is not already running
# CREATED    : 19-Sep-2026
#
# DESCRIPTION:
# - This is the single entry point for the whole local app ecosystem. Pin the
#   accompanying .bat (or the installed PWA) to the Start Menu and use it for
#   everything: project gallery, Project Admin, PlanVision and TrueVision 3D.
# - When the silent startup server is already running this only opens the
#   window, so there is never a second server on the same port.
# - The window is a chromeless Edge application window pointed at the Studio
#   shell, which is the same thing the installed PWA opens.
#
# USAGE:
#   powershell -ExecutionPolicy Bypass -File ProjectVision__StudioApp__Launch__.ps1
#   powershell ... -File ProjectVision__StudioApp__Launch__.ps1 -Port 8095
#
# =============================================================================

[CmdletBinding()]
param(
    [int]    $Port        = 8090,
    [string] $ProjectCode = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'


# #region ---------------------------------------------------------------------
# REGION | Configuration
# -----------------------------------------------------------------------------

$Na__AppRoot     = $PSScriptRoot
$Na__ServerFile  = Join-Path $Na__AppRoot 'ProjectVision__LocalServer__Main__.py'
$Na__LogFile     = 'ProjectVision__LocalServer__Startup__.log'
$Na__StudioUrl   = "http://localhost:$Port/"
$Na__HealthUrl   = "http://localhost:$Port/api/health"
$Na__WaitSeconds = 20

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Helper Functions
# -----------------------------------------------------------------------------

# HELPER | Is something already listening on the Studio port
function Na__Studio__IsServerListening {
    param([int] $TargetPort)

    try {
        $connection = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
        return [bool] $connection
    } catch {
        return $false
    }
}


# HELPER | Locate the quietest Python available (pythonw runs with no console)
function Na__Studio__ResolvePython {
    $pythonw = Get-Command pythonw.exe -ErrorAction SilentlyContinue
    if ($pythonw) { return $pythonw.Source }

    $python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($python) { return $python.Source }

    return $null
}


# HELPER | Locate a Chromium browser that understands --app=
function Na__Studio__ResolveBrowser {
    $candidates = @(
        'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
        'C:\Program Files\Google\Chrome\Application\chrome.exe',
        'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) { return $candidate }
    }

    $edge = Get-Command msedge.exe -ErrorAction SilentlyContinue
    if ($edge) { return $edge.Source }

    return $null
}


# HELPER | Block until the server answers its health check
function Na__Studio__WaitForServer {
    param([string] $HealthUrl, [int] $TimeoutSeconds)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) { return $true }
        } catch {
            Start-Sleep -Milliseconds 400
        }
    }

    return $false
}

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Start the Server When It Is Not Already Up
# -----------------------------------------------------------------------------

if (-not (Na__Studio__IsServerListening -TargetPort $Port)) {

    $pythonPath = Na__Studio__ResolvePython

    if (-not $pythonPath) {
        # A hidden launcher has no console, so say it in a dialog box
        try {
            Add-Type -AssemblyName PresentationFramework
            [System.Windows.MessageBox]::Show(
                'Python was not found on PATH, so the Noble Architecture Studio server could not start.',
                'Noble Architecture Studio') | Out-Null
        } catch {
            Write-Error 'Python was not found on PATH.'
        }
        exit 1
    }

    Start-Process -FilePath $pythonPath `
                  -ArgumentList @(
                      $Na__ServerFile,
                      '--port',     $Port,
                      '--silent',
                      '--log-file', $Na__LogFile,
                      '--no-browser'
                  ) `
                  -WorkingDirectory $Na__AppRoot `
                  -WindowStyle Hidden

    if (-not (Na__Studio__WaitForServer -HealthUrl $Na__HealthUrl -TimeoutSeconds $Na__WaitSeconds)) {
        Write-Warning "The server did not answer $Na__HealthUrl within $Na__WaitSeconds seconds."
        Write-Warning "Check the log: $(Join-Path $Na__AppRoot $Na__LogFile)"
    }
}

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Open the Studio Window
# -----------------------------------------------------------------------------

# DEEP LINK | A project code opens straight into that project hub
$targetUrl = $Na__StudioUrl

if ($ProjectCode) {
    $innerPath = "/na-apps/05__ProjectVision__CoreAppCode/index.html?project=$($ProjectCode.ToUpper())"
    $targetUrl = $Na__StudioUrl + '#' + [System.Uri]::EscapeDataString($innerPath)
}

$browserPath = Na__Studio__ResolveBrowser

if ($browserPath) {
    Start-Process -FilePath $browserPath -ArgumentList @("--app=$targetUrl", '--window-size=1680,1000')
} else {
    Start-Process $targetUrl                                    # <-- No Chromium browser: ordinary tab
}

# endregion -------------------------------------------------------------------
