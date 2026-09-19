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
# - With -ServerOnly it starts the server and opens nothing. The Windows startup
#   launcher uses that, so both routes share one definition of "already running".
#
# USAGE:
#   powershell -ExecutionPolicy Bypass -File ProjectVision__StudioApp__Launch__.ps1
#   powershell ... -File ProjectVision__StudioApp__Launch__.ps1 -Port 8095
#   powershell ... -File ProjectVision__StudioApp__Launch__.ps1 -ServerOnly
#
# =============================================================================

[CmdletBinding()]
param(
    [int]    $Port        = 8090,
    [string] $ProjectCode = '',
    [switch] $ServerOnly                                        # <-- Start the server, open no window
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

# HELPER | Is OUR server answering on the Studio port
# -----------------------------------------------------------------------------
# Deliberately NOT a port-in-use test. On this machine WsToastNotification.exe
# holds 0.0.0.0:8090 permanently, so "is the port listening" is always true and
# would stop the Flask server from ever starting - it answers HTTP 501 instead.
# Flask still binds 127.0.0.1:8090 alongside it, and the more specific bind wins
# for localhost, so the only reliable question is whether the health endpoint
# answers with our own service name.
function Na__Studio__IsOurServerUp {
    param([int] $TargetPort)

    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$TargetPort/api/health" `
                                      -UseBasicParsing -TimeoutSec 2
        return ($response.Content -match 'na-projectvision-local-dev')
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


# HELPER | Block until our server answers its health check
function Na__Studio__WaitForServer {
    param([int] $TargetPort, [int] $TimeoutSeconds)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        if (Na__Studio__IsOurServerUp -TargetPort $TargetPort) { return $true }
        Start-Sleep -Milliseconds 400
    }

    return $false
}

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Start the Server When It Is Not Already Up
# -----------------------------------------------------------------------------

if (-not (Na__Studio__IsOurServerUp -TargetPort $Port)) {

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

    if (-not (Na__Studio__WaitForServer -TargetPort $Port -TimeoutSeconds $Na__WaitSeconds)) {
        Write-Warning "The server did not answer $Na__HealthUrl within $Na__WaitSeconds seconds."
        Write-Warning "Check the log: $(Join-Path $Na__AppRoot $Na__LogFile)"
    }
}

# SERVER ONLY | The Windows startup launcher stops here - it opens no window
if ($ServerOnly) {
    exit 0
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
