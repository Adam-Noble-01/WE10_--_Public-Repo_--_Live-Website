' =============================================================================
' NOBLE ARCHITECTURE - CAD AUDIT TOOLS SILENT SERVER LAUNCHER
' =============================================================================
'
' FILE    : Na__LocalServer__Silent__.vbs
' PURPOSE : Start the Flask local server with NO visible console window
' CREATED : 07-Jul-2026
'
' USAGE:
'   - Double-click to start the server silently (no browser tab opened).
'   - Link this file in shell:startup so the server is always running at
'     login — the Windows right-click "Open With" flow then has zero friction.
'   - The installer (Na__WinIntegration__InstallOpenWith__.ps1) creates the
'     startup shortcut automatically.
'
' BEHAVIOUR:
'   - Skips launching if the server is already responding on port 8007.
'   - Runs: python Na__LocalServer__Main__.py --silent   (hidden window)
'
' =============================================================================

Option Explicit

Dim shell, fso, scriptDir, healthUrl

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
healthUrl = "http://127.0.0.1:8007/api/health"

' --- Skip launch if the server is already up --------------------------------
If Na__IsServerUp(healthUrl) Then
    WScript.Quit 0
End If

' --- Launch the Flask server hidden (window style 0 = no window) ------------
shell.CurrentDirectory = scriptDir
shell.Run "cmd /c python """ & scriptDir & "\Na__LocalServer__Main__.py"" --silent", 0, False

WScript.Quit 0


' =============================================================================
' REGION | Helper Functions
' =============================================================================

Function Na__IsServerUp(url)
    On Error Resume Next
    Dim http
    Set http = CreateObject("MSXML2.XMLHTTP")
    http.Open "GET", url, False
    http.Send
    Na__IsServerUp = (Err.Number = 0 And http.Status = 200)
    On Error GoTo 0
End Function
