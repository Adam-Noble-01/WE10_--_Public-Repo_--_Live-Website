' =============================================================================
' NOBLE ARCHITECTURE - CAD AUDIT TOOLS OPEN-WITH LAUNCHER
' =============================================================================
'
' FILE    : Na__WinIntegration__OpenWith__.vbs
' PURPOSE : Windows right-click "Open With" target for .dwg / .dxf files
' CREATED : 07-Jul-2026
'
' FLOW:
'   1. Receives the clicked file path as the first argument ("%1").
'   2. Health-checks the local server on port 8007.
'   3. If the server is down, launches Na__LocalServer__Silent__.vbs and
'      polls the health endpoint until it responds (max ~15 seconds).
'   4. Opens the default browser (or installed PWA window) at:
'        http://127.0.0.1:8007/?openFile=<encoded path>
'      The frontend then loads the file straight from disk via /api/open-local.
'
' REGISTRATION:
'   Run Na__WinIntegration__InstallOpenWith__.ps1 once to register this
'   launcher for .dwg and .dxf files (HKCU — no admin rights needed).
'
' =============================================================================

Option Explicit

Dim shell, fso, scriptDir, filePath, appUrl, healthUrl, attempts

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
healthUrl = "http://127.0.0.1:8007/api/health"

' --- Require a file argument -------------------------------------------------
If WScript.Arguments.Count = 0 Then
    MsgBox "Noble CAD Audit Tools:" & vbCrLf & _
           "No file path received. Use right-click > Open With on a DWG or DXF file.", _
           vbExclamation, "Noble CAD Audit Tools"
    WScript.Quit 1
End If

filePath = WScript.Arguments(0)

' --- Ensure the local server is running ---------------------------------------
If Not Na__IsServerUp(healthUrl) Then
    shell.CurrentDirectory = scriptDir
    shell.Run "wscript.exe """ & scriptDir & "\Na__LocalServer__Silent__.vbs""", 0, False

    ' Poll until the server responds (30 x 500ms = 15s ceiling)
    For attempts = 1 To 30
        WScript.Sleep 500
        If Na__IsServerUp(healthUrl) Then Exit For
    Next

    If Not Na__IsServerUp(healthUrl) Then
        MsgBox "Noble CAD Audit Tools:" & vbCrLf & _
               "The local server did not start. Check Python is installed and run:" & vbCrLf & _
               scriptDir & "\Na__LocalServer__Main__.bat", _
               vbCritical, "Noble CAD Audit Tools"
        WScript.Quit 1
    End If
End If

' --- Open the app with the file parameter -------------------------------------
appUrl = "http://127.0.0.1:8007/?openFile=" & Na__UrlEncode(filePath)
shell.Run appUrl                                                    ' <-- Default browser / installed PWA

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

Function Na__UrlEncode(text)
    Dim i, ch, code, result
    result = ""
    For i = 1 To Len(text)
        ch   = Mid(text, i, 1)
        code = AscW(ch)
        If (code >= 48 And code <= 57) Or (code >= 65 And code <= 90) Or (code >= 97 And code <= 122) _
           Or ch = "-" Or ch = "_" Or ch = "." Or ch = "~" Then
            result = result & ch                                     ' <-- Unreserved characters pass through
        ElseIf code < 256 Then
            result = result & "%" & Right("0" & Hex(code), 2)       ' <-- Percent-encode single byte
        Else
            result = result & ch                                     ' <-- Non-ANSI: pass through (rare in paths)
        End If
    Next
    Na__UrlEncode = result
End Function
