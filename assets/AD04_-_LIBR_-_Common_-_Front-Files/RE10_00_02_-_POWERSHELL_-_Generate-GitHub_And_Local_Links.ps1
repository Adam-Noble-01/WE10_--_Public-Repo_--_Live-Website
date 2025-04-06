<# 
=======================================================================================================================
FILE NAME    :    RE10_00_02-_POWERSHELL_-_Generate-GitHub_And_Local_Links.ps1
FILE Type    :    Windows PowerShell Script
AUTHOR       :    Studio NoodlFjord
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
DESCRIPTION
    - This script generates GitHub raw URLs and local file paths based on a predefined structure.
    - Users provide a relative file path, and the script automatically constructs:
        - A full local file path for the files location the Studio PC
            - Usefull for quickly locating asset locally if needed.
        - A GitHub raw content URL
            - Usefull for quickly locating asset locally if needed.

PURPOSE SERVED
    - Ensures consistent use of links.
    - Most of my apps are designed to pull info from stictly defined locations in order to function.
    - Ensures a single source of truth is maintained.

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
LAUCH COMMAND
./RE10_00_02_-_POWERSHELL_-_Generate-GitHub_And_Local_Links.ps1.ps1
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
USAGE | LAUNCH & INITIAL USER INPUT
    - Run the script in PowerShell from within the desired local root folder.
    - Enter either of these two options as the script accepts file name using the root or absolute full paths
        - - INPUT TYPE 01 |  FILE NAME - - - 
            - Example Input : "Cat-Picture.png"
        - - INPUT TYPE 02 |  ABSOLUTE PATH INPUT EXAMPLE - - - 
            - Example Input : "D:\RE10_--_Active-Live_--_Private-Master-Repo\Cat-Picture.png"
            - Note, absolute paths bound in quotation marks are also handled 
            - This is helpfull if location dir is copied using windows, (Shift + Right Click) Copy Path 

    - If you receive a permission error, use:
        Set-ExecutionPolicy RemoteSigned -Scope Process


- - - - - - - - - - - - - - - - - - - - 
USAGE | REPO SELECTION FEATURE
    - CLI prompts user to selecting desired Repo.
    - Two Repo Options Are Availible.
    - Both Repo options have an associated local and remote directory / link

    REPO OPTION 01 | MASTER PUBLIC FILES SERVING CDN
        - Accepted Prompts :  "Public" , "Public Repo" , "Pub" , "P" , "1" , "01" <--- Note These are NOT Case senstive
        LOCAL WINDOWS DIRECTORY
            Repo Name      :  RE20_--_Core_Repo_--_Public
            Description    :  The Local location, Files saved here and pushed to Github from here.
            Github Repo    :  D:\RE20_--_Core_Repo_--_Public\
            Permission     :  Login required onto Studio PC, Files manually pushed as needed using GitHub Desktop. 
        GITHUB PUBLIC REPO
            Repo Name      :  RE10_I_GitHub_I_Public_Repo
            Description    :  CDN Used for Noble Architecture Project for project specific app source code & hosting client files
            Github Repo    :  https://github.com/Adam-Noble-01/RE20_--_Core_Repo_--_Public
            Permission     :  Public Repo; NO KEYS REQUIRED for fetch requests served from this location 

    REPO OPTION 02 | MASTER PRIVATE APPLICATION SOURCE REPO
        - Accepted Prompts :  "Private" , "Private Repo" , "Priv" , "App" , "Personal" , "Dev" , "D" , "2" , "02"   <--- Note These are NOT Case senstive
        LOCAL WINDOWS DIRECTORY
            Repo Name      :  RE10_--_Active-Live_--_Private-Master-Repo
            Description    :  The Local location, Files saves core application files with access restricts to the public.
            Github Repo    :  D:\RE10_--_Active-Live_--_Private-Master-Repo\
            Permission     :  Login required onto Studio PC, Files manually pushed as needed using GitHub Desktop. 
        GITHUB PUBLIC REPO
            Repo Name      :  RE10_--_Active-Live_--_Private-Master-Repo
            Description    :  CDN Used for Noble Architecture Project for project specific app source code & hosting client files
            Github Repo    :  https://github.com/Adam-Noble-01/RE10_--_Active-Live_--_Private-Master-Repo
            Permission     :  Private Repo; AUTH KEY REQUIRED for fetch requests, personal apps will have token access for reading files.
            Token Notes    :  Key stored at the directory listed above as plaintext in a text file on Studio Windows PC.
            Read Acces Key :  C:\01_Script_Dependencies\00-keys\github_token_-_read-only-permission.txt

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
VERSION CONTROL LOG

TYPE     -  Major Release 
VERSION  -  1.0.0
DATE     -  14-Mar-2025
    - First Major Stable Release
    - Basic Implementation Working Well

- - - - - - - - - - - - - - - - - - - -
TYPE     -  Minor Update
VERSION  -  1.0.1
DATE     -  14-Mar-2025
    - CLI UI Improvements 
    - Better CLI Menu Instructions Added

- - - - - - - - - - - - - - - - - - - -
TYPE     -  Major Update
VERSION  -  1.1.0
DATE     -  15-Mar-2025
    INPUT LOGIC OVERHAULED
    - Logic completely overhauled to match the input handling listed in the latest usage instructions.
        - Two inputs now accepted improving flexibility, Absolute paths and file names are now accepted.
    - CLI Instructions uptated to suit.
    - - - - - - - - - - - - - - - - - - - - 
    REPO SELECTION ADDED
    - CLI Prompt Added For Selecting Repo Location
        - User input options are listed in the new repo selection feature above
    - Two Repo Options Availible
        - Public GitGub / Local Dir Pair acting as a CDN with no access restrictions.
        - Private GitGub / Local Dir Pair acting as a Source Repo with gated access.
    - Both Repo options have an associated local and remote directory / link
    - After users desired repo is selected the logic should handle . . . 
        Local Directory Handling
        - Ensures users input file / absolute path matches either of the two local directories listed above.
        - Creates a windows directory link striped of "" if the input had them contained
        - Reports windows path of the desired file in the final output delivered and copies to clipboard
        GitHub Web Link Handling
        - Use the reference above listed in the repo selection feacture to select the desired prefix
        - Buildes the rest of the URL, this is possible by using the local directory path and adapting it to suit
        - Reports GitHub Repo path of the desired file in the final output delivered and copies to clipboard 
    - - - - - - - - - - - - - - - - - - - - 
    JSON FRIENDLY LINKS ADDED
    - Added two additional links to the output
    - These are the same links generated before for the Local and Github locations
    - But are adapted to suit Json file (Escape characters etc as required for Json)



=======================================================================================================================
#>

# ----------------------------------------------------------------
# CONFIGURE REPOSITORY PATH PREFIXES
# ----------------------------------------------------------------

# Define repository local path prefixes and GitHub raw URL prefixes
$privateLocalPathPrefix = "D:\RE10_--_Active-Live_--_Private-Master-Repo\"
$privateGithubRawPrefix = "https://raw.githubusercontent.com/Adam-Noble-01/RE10_--_Active-Live_--_Private-Master-Repo/main/"

$publicLocalPathPrefix = "D:\RE20_--_Core_Repo_--_Public\"
$publicGithubRawPrefix = "https://raw.githubusercontent.com/Adam-Noble-01/RE20_--_Core_Repo_--_Public/main/"

# Initialise variables
[string]$localPathPrefix = ""
[string]$githubRawPrefix = ""
[string]$githubRawSuffix = ""

# ----------------------------------------------------------------
# DEFINE TOKEN FOR PRIVATE REPO
# ----------------------------------------------------------------

$tokenPath = "C:\01_Script_Dependencies\00-keys\github_token_-_read-only-permission.txt"
if (Test-Path $tokenPath) {
    $githubToken = (Get-Content -Path $tokenPath -ErrorAction Stop).Trim()
} else {
    Write-Host "⚠️  GitHub token file not found at $tokenPath. Exiting." -ForegroundColor Red
    exit
}

# ----------------------------------------------------------------
# DEFINE UNICODE EMOJIS
# ----------------------------------------------------------------

$folderEmoji = [System.Text.Encoding]::UTF8.GetString([byte[]](0xF0,0x9F,0x93,0x82))  # 📂
$globeEmoji = [System.Text.Encoding]::UTF8.GetString([byte[]](0xF0,0x9F,0x8C,0x90))  # 🌐
$checkEmoji = [System.Text.Encoding]::UTF8.GetString([byte[]](0xE2,0x9C,0x85))       # ✅

# ----------------------------------------------------------------
# DISPLAY WELCOME MESSAGE & REPOSITORY SELECTION
# ----------------------------------------------------------------

Clear-Host
Write-Host "=======================================================================================" -ForegroundColor Cyan
Write-Host "  Studio NoodlFjord | GitHub Path Generator Utility" -ForegroundColor Green
Write-Host "=======================================================================================" -ForegroundColor Cyan
Write-Host "  Select Repository Option:" -ForegroundColor Yellow
Write-Host "    - Public Repo Options: [Public, Public Repo, Pub, P, 1, 01]" -ForegroundColor Yellow
Write-Host "    - Private Repo Options: [Private, Private Repo, Priv, App, Personal, Dev, D, 2, 02]" -ForegroundColor Yellow
Write-Host "=======================================================================================" -ForegroundColor Cyan


# ----------------------------------------------------------------
# PROMPT FOR REPOSITORY SELECTION
# ----------------------------------------------------------------

$repoSelection = Read-Host "Enter repository option"
$repoSelectionTrimmed = $repoSelection.Trim().ToLower()

switch ($repoSelectionTrimmed) {
    "public" { 
        $localPathPrefix = $publicLocalPathPrefix
        $githubRawPrefix = $publicGithubRawPrefix
        $githubRawSuffix = "" 
    }
    "public repo" { 
        $localPathPrefix = $publicLocalPathPrefix
        $githubRawPrefix = $publicGithubRawPrefix
        $githubRawSuffix = "" 
    }
    "pub" { 
        $localPathPrefix = $publicLocalPathPrefix
        $githubRawPrefix = $publicGithubRawPrefix
        $githubRawSuffix = ""
    }
    "p" { $localPathPrefix = $publicLocalPathPrefix; $githubRawPrefix = $publicGithubRawPrefix; $githubRawSuffix = "" }
    "1" { $localPathPrefix = $publicLocalPathPrefix; $githubRawPrefix = $publicGithubRawPrefix; $githubRawSuffix = "" }
    "01" { $localPathPrefix = $publicLocalPathPrefix; $githubRawPrefix = $publicGithubRawPrefix; $githubRawSuffix = "" }

    # Private Repo with Token
    "private" { 
        $localPathPrefix = $privateLocalPathPrefix
        $githubRawPrefix = $privateGithubRawPrefix
        $githubRawSuffix = "?token=$githubToken"
    }
    "private repo" { $localPathPrefix = $privateLocalPathPrefix; $githubRawPrefix = $privateGithubRawPrefix; $githubRawSuffix = "?token=$githubToken" }
    "priv" { $localPathPrefix = $privateLocalPathPrefix; $githubRawPrefix = $privateGithubRawPrefix; $githubRawSuffix = "?token=$githubToken" }
    "app" { $localPathPrefix = $privateLocalPathPrefix; $githubRawPrefix = $privateGithubRawPrefix; $githubRawSuffix = "?token=$githubToken" }
    "personal" { $localPathPrefix = $privateLocalPathPrefix; $githubRawPrefix = $privateGithubRawPrefix; $githubRawSuffix = "?token=$githubToken" }
    "dev" { $localPathPrefix = $privateLocalPathPrefix; $githubRawPrefix = $privateGithubRawPrefix; $githubRawSuffix = "?token=$githubToken" }
    "d" { $localPathPrefix = $privateLocalPathPrefix; $githubRawPrefix = $privateGithubRawPrefix; $githubRawSuffix = "?token=$githubToken" }
    "2" { $localPathPrefix = $privateLocalPathPrefix; $githubRawPrefix = $privateGithubRawPrefix; $githubRawSuffix = "?token=$githubToken" }
    "02" { $localPathPrefix = $privateLocalPathPrefix; $githubRawPrefix = $privateGithubRawPrefix; $githubRawSuffix = "?token=$githubToken" }

    default {
        Write-Host "⚠️  Invalid repository selection. Exiting script." -ForegroundColor Red
        exit
    }
}

Write-Host "`n$checkEmoji  Repository selected. Local Path Prefix set to:" -ForegroundColor Green
Write-Host "    $localPathPrefix"
Write-Host "$checkEmoji  GitHub Raw URL Prefix set to:" -ForegroundColor Green
Write-Host "    $githubRawPrefix"
Write-Host "=======================================================================================" -ForegroundColor Cyan

# ----------------------------------------------------------------
# PRINT INSTRUCTIONS FOR FILE INPUT
# ----------------------------------------------------------------

Write-Host "`nEnter a relative file path or an absolute path to generate:" -ForegroundColor Yellow
Write-Host "  - For relative paths, e.g., 'Cat-Picture.png'"
Write-Host "  - For absolute paths, e.g., 'D:\RE10_--_Active-Live_--_Private-Master-Repo\Cat-Picture.png'" -ForegroundColor Yellow
Write-Host "=======================================================================================" -ForegroundColor Cyan

# ----------------------------------------------------------------
# PROMPT FOR FILE INPUT
# ----------------------------------------------------------------

$inputPath = Read-Host "Enter file path"
Write-Host ""  # Break for readability

if ([string]::IsNullOrWhiteSpace($inputPath)) {
    Write-Host "`n⚠️  No input provided. Exiting script." -ForegroundColor Red
    exit
}

# Remove any enclosing quotes
$inputPath = $inputPath.Trim('"')

# Determine if the input is an absolute path
if ($inputPath -match "^[A-Za-z]:\\") {
    # Check if the absolute path starts with the selected repository's local path prefix
    if ($inputPath.StartsWith($localPathPrefix)) {
        # Remove the local path prefix to obtain the relative path
        $relativePath = $inputPath.Substring($localPathPrefix.Length)
    } elseif ($inputPath.StartsWith($publicLocalPathPrefix)) {
        Write-Host "⚠️  The absolute path provided matches the Public repository directory, which does not match the selected repository option. Exiting script." -ForegroundColor Red
        exit
    } elseif ($inputPath.StartsWith($privateLocalPathPrefix)) {
        Write-Host "⚠️  The absolute path provided matches the Private repository directory, which does not match the selected repository option. Exiting script." -ForegroundColor Red
        exit
    } else {
        Write-Host "⚠️  The absolute path provided does not match any recognised repository directories. Exiting script." -ForegroundColor Red
        exit
    }
} else {
    # Assume input is a relative path
    $relativePath = $inputPath
}

# Ensure no leading slashes in the relative path
$relativePath = $relativePath -replace "^[\\/]+", ""

# ----------------------------------------------------------------
# FUNCTION TO GENERATE PATHS
# ----------------------------------------------------------------

function Generate-Paths {
    param ([string]$relativePath)

    return @{  
        "local_path"       = "$localPathPrefix$relativePath"  
        "raw_url"          = (($githubRawPrefix + $relativePath) -replace '\\', '/')
        "json_local_path"  = ($localPathPrefix + $relativePath) -replace '\\', '\\'
        "json_raw_url"     = (($githubRawPrefix + $relativePath) -replace '\\', '/')
    }
}

# ----------------------------------------------------------------
# GENERATE PATHS BASED ON INPUT
# ----------------------------------------------------------------

$result = Generate-Paths -relativePath $relativePath

# ----------------------------------------------------------------
# DISPLAY RESULTS
# ----------------------------------------------------------------

Write-Host "`n=====================================================================================" -ForegroundColor Red
Write-Host "`n$folderEmoji  Local Path:" -ForegroundColor Green
Write-Host "    $($result.local_path)`n"
Write-Host "$globeEmoji  GitHub Raw URL:" -ForegroundColor Blue
Write-Host "    $($result.raw_url)`n"
Write-Host "JSON Friendly Local Path:" -ForegroundColor Magenta
Write-Host "    $($result.json_local_path)`n"
Write-Host "JSON Friendly GitHub Raw URL:" -ForegroundColor Magenta
Write-Host "    $($result.json_raw_url)"
Write-Host "`n=====================================================================================" -ForegroundColor Red

# Optionally, copy results to clipboard (requires Set-Clipboard, available in newer PowerShell versions)
try {
    $outputText = "Local Path: $($result.local_path)`nGitHub Raw URL: $($result.raw_url)"
    $outputText | Set-Clipboard
    Write-Host "`n$checkEmoji  Links copied to clipboard." -ForegroundColor Green
} catch {
    Write-Host "`n⚠️  Unable to copy to clipboard. Please copy manually." -ForegroundColor Red
}
