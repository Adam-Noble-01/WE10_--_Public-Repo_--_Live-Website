# =============================================================================
# NOBLE ARCHITECTURE - CAD AUDIT TOOLS WINDOWS INTEGRATION INSTALLER
# =============================================================================
#
# FILE    : Na__WinIntegration__InstallOpenWith__.ps1
# PURPOSE : One-shot installer — right-click Open-With for .dwg/.dxf + silent
#           server autostart at Windows login
# CREATED : 07-Jul-2026
#
# WHAT IT INSTALLS (all HKCU — no admin rights required):
#   1. ProgID "NobleCadAuditTools.CadFile" whose open command runs
#      Na__WinIntegration__OpenWith__.vbs "%1" (starts server if needed,
#      then opens the app with the file).
#   2. OpenWithProgids entries for .dwg and .dxf — the app appears in the
#      right-click "Open with" list WITHOUT changing the default handler.
#   3. A direct right-click verb "Open with Noble CAD Audit Tools" on both
#      extensions (SystemFileAssociations shell verb).
#   4. A shell:startup shortcut to Na__LocalServer__Silent__.vbs so the
#      server is silently running from login (zero-friction Open-With).
#
# USAGE:
#   powershell -ExecutionPolicy Bypass -File .\Na__WinIntegration__InstallOpenWith__.ps1
#   powershell -ExecutionPolicy Bypass -File .\Na__WinIntegration__InstallOpenWith__.ps1 -Uninstall
#
# =============================================================================

param(
    [switch]$Uninstall                                              # <-- Remove all installed integration
)

$ErrorActionPreference = 'Stop'

# #region ---------------------------------------------------------------------
# REGION | Resolve Paths
# -----------------------------------------------------------------------------

$AppDir        = Split-Path -Parent $MyInvocation.MyCommand.Path
$OpenWithVbs   = Join-Path $AppDir 'Na__WinIntegration__OpenWith__.vbs'
$SilentVbs     = Join-Path $AppDir 'Na__LocalServer__Silent__.vbs'
$IconIco       = Join-Path $AppDir '01__AppAssets__CadAuditTools\Na__CadAuditToolsApp__Icon__.ico'  # <-- Shell verbs need .ico, not .png

$ProgId        = 'NobleCadAuditTools.CadFile'
$VerbName      = 'NobleCadAuditTools'
$VerbLabel     = 'Open with Noble CAD Audit Tools'
$OpenCommand   = "wscript.exe `"$OpenWithVbs`" `"%1`""
$Extensions    = @('.dwg', '.dxf')

$StartupDir    = [Environment]::GetFolderPath('Startup')
$StartupLink   = Join-Path $StartupDir 'Noble CAD Audit Tools Server (Silent).lnk'

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Uninstall Path
# -----------------------------------------------------------------------------

if ($Uninstall) {
    Write-Host ''
    Write-Host '  Removing Noble CAD Audit Tools Windows integration...' -ForegroundColor Yellow

    foreach ($ext in $Extensions) {
        $openWithKey = "HKCU:\Software\Classes\$ext\OpenWithProgids"
        if (Test-Path $openWithKey) {
            Remove-ItemProperty -Path $openWithKey -Name $ProgId -ErrorAction SilentlyContinue
        }
        $verbKey = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\$VerbName"
        if (Test-Path $verbKey) {
            Remove-Item -Path $verbKey -Recurse -Force
        }
    }

    $progIdKey = "HKCU:\Software\Classes\$ProgId"
    if (Test-Path $progIdKey) {
        Remove-Item -Path $progIdKey -Recurse -Force
    }

    if (Test-Path $StartupLink) {
        Remove-Item -Path $StartupLink -Force
    }

    Write-Host '  Integration removed.' -ForegroundColor Green
    Write-Host ''
    exit 0
}

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Preflight Checks
# -----------------------------------------------------------------------------

Write-Host ''
Write-Host '  =========================================================' -ForegroundColor DarkGray
Write-Host '   NOBLE CAD AUDIT TOOLS - Windows Integration Installer'   -ForegroundColor Cyan
Write-Host '  =========================================================' -ForegroundColor DarkGray
Write-Host ''

if (-not (Test-Path $OpenWithVbs)) { throw "Launcher not found: $OpenWithVbs" }
if (-not (Test-Path $SilentVbs))   { throw "Silent launcher not found: $SilentVbs" }

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | 1. ProgID Registration (Open-With Application Entry)
# -----------------------------------------------------------------------------

$progIdKey = "HKCU:\Software\Classes\$ProgId"

New-Item -Path "$progIdKey\shell\open\command" -Force | Out-Null
Set-ItemProperty -Path $progIdKey -Name '(Default)'         -Value 'Noble CAD Audit Tools Drawing'
Set-ItemProperty -Path $progIdKey -Name 'FriendlyTypeName'  -Value 'Noble CAD Audit Tools Drawing'
Set-ItemProperty -Path "$progIdKey\shell\open\command" -Name '(Default)' -Value $OpenCommand

if (Test-Path $IconIco) {
    New-Item -Path "$progIdKey\DefaultIcon" -Force | Out-Null
    Set-ItemProperty -Path "$progIdKey\DefaultIcon" -Name '(Default)' -Value $IconIco
}

Write-Host "  [1/3] ProgID registered            : $ProgId" -ForegroundColor Green

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | 2. Extension Bindings (.dwg / .dxf)
# -----------------------------------------------------------------------------

foreach ($ext in $Extensions) {

    # "Open with" list entry — additive, does NOT change the default app
    $openWithKey = "HKCU:\Software\Classes\$ext\OpenWithProgids"
    New-Item -Path $openWithKey -Force | Out-Null
    New-ItemProperty -Path $openWithKey -Name $ProgId -Value ([byte[]]@()) -PropertyType None -Force | Out-Null

    # Direct right-click verb — one click, no submenu digging
    $verbKey = "HKCU:\Software\Classes\SystemFileAssociations\$ext\shell\$VerbName"
    New-Item -Path "$verbKey\command" -Force | Out-Null
    Set-ItemProperty -Path $verbKey -Name '(Default)' -Value $VerbLabel
    if (Test-Path $IconIco) {
        Set-ItemProperty -Path $verbKey -Name 'Icon' -Value $IconIco
    }
    Set-ItemProperty -Path "$verbKey\command" -Name '(Default)' -Value $OpenCommand

    Write-Host "  [2/3] Extension integrated         : $ext" -ForegroundColor Green
}

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | 3. Silent Server Autostart (shell:startup Shortcut)
# -----------------------------------------------------------------------------

$wsh      = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($StartupLink)
$shortcut.TargetPath       = 'wscript.exe'
$shortcut.Arguments        = "`"$SilentVbs`""
$shortcut.WorkingDirectory = $AppDir
$shortcut.Description      = 'Starts the Noble CAD Audit Tools local server silently at login (port 8007)'
$shortcut.Save()

Write-Host "  [3/3] Startup shortcut installed   : $StartupLink" -ForegroundColor Green

# endregion -------------------------------------------------------------------


# #region ---------------------------------------------------------------------
# REGION | Summary
# -----------------------------------------------------------------------------

Write-Host ''
Write-Host '  Done. Right-click any .dwg or .dxf file and choose' -ForegroundColor Cyan
Write-Host "  '$VerbLabel' — the labelled entry with the Noble icon." -ForegroundColor Cyan
Write-Host ''
Write-Host '  (The row inside the "Open with" submenu may show no label — that is a' -ForegroundColor DarkGray
Write-Host '   Windows quirk for script-host ProgIDs. Use the direct verb above.)'   -ForegroundColor DarkGray
Write-Host ''
Write-Host '  The server will start silently at your next login. To start it' -ForegroundColor DarkGray
Write-Host '  silently right now, double-click: Na__LocalServer__Silent__.vbs' -ForegroundColor DarkGray
Write-Host ''
Write-Host '  To remove everything: run this script again with -Uninstall' -ForegroundColor DarkGray
Write-Host ''

# endregion -------------------------------------------------------------------
