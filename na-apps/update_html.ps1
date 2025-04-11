# Script to update the main HTML file with new file paths

$htmlFile = "PlanVision_NEW\NA_Plan-Vision-App_-_2.0.0.html"
$htmlContent = Get-Content $htmlFile -Raw

# Update CSS path
$htmlContent = $htmlContent -replace 'href="NA_Plan-Vision-App_-_2.0.0_-_StyleSheet.css"', 'href="NA40_03_-_STYL_-_Style-Library/NA02_02_01_-_NA_Plan-Vision-App_-_2.0.0_-_StyleSheet.css"'

# Update Font Loader path
$htmlContent = $htmlContent -replace 'src="NA_Plan-Vision-App_-_2.0.0_-_Font-Asset-Loader.js"', 'src="NA40_05_-_SCRP_-_Core-Utility-Scripts/NA40_04_06_-_Font-Asset-Loader.js"'

# Update script paths at the bottom
$scriptUpdates = @{
    'src="NA_Plan-Vision-App_-_2.0.0_-_URL-Parser.js"' = 'src="NA40_05_-_SCRP_-_Core-Utility-Scripts/NA40_08_01_-_URL-Parser.js"'
    'src="NA_Plan-Vision-App_-_2.0.0_-_Module-Integration.js"' = 'src="NA40_04_-_SCRP_-_File-Loader-Scripts/NA40_04_11_-_Module-Integration.js"'
    'src="NA_Plan-Vision-App_-_2.0.0_-_Application-Controller.js"' = 'src="NA40_04_-_SCRP_-_File-Loader-Scripts/NA40_04_10_-_Application-Controller.js"'
    'src="NA_Plan-Vision-App_-_2.0.0_-_App-Assets-Loader.js"' = 'src="NA40_04_-_SCRP_-_File-Loader-Scripts/NA40_04_01_-_Core-App-Config-And-Assets-Loader.js"'
    'src="NA_Plan-Vision-App_-_2.0.0_-_Project-Assets-Loader.js"' = 'src="NA40_04_-_SCRP_-_File-Loader-Scripts/NA40_04_02_-_Project-Assets-Loader.js"'
    'src="NA_Plan-Vision-App_-_2.0.0_-_Canvas-Renderer.js"' = 'src="NA40_06_-_SCRP_-_Canvas-And-Main-Rendering-Scripts/NA40_06_04_-_Canvas-Renderer.js"'
    'src="NA_Plan-Vision-App_-_2.0.0_-_Canvas-Controller.js"' = 'src="NA40_06_-_SCRP_-_Canvas-And-Main-Rendering-Scripts/NA40_06_03_-_Canvas-Controller.js"'
    'src="NA_Plan-Vision-App_-_2.0.0_-_Measurement-Scaling.js"' = 'src="NA40_07_-_SCRP_-_Measurement-And-Math-Scripts/NA40_07_01_-_Measurement-Scaling.js"'
    'src="NA_Plan-Vision-App_-_2.0.0_-_Measurement-Tools.js"' = 'src="NA40_07_-_SCRP_-_Measurement-And-Math-Scripts/NA40_07_02_-_Measurement-Tools.js"'
    'src="NA_Plan-Vision-App_-_2.0.0_-_UI-Navigation.js"' = 'src="NA40_08_-_SCRP_-_User-Interface-And-Navigation/NA40_08_01_-_UI-Navigation.js"'
    'src="NA_Plan-Vision-App_-_2.0.0_-_Debug-Panel.js"' = 'src="NA40_20_-_DEVP_-_Development-Files/NA40_20_01_-_Debug-Panel.js"'
}

foreach ($oldPath in $scriptUpdates.Keys) {
    $htmlContent = $htmlContent -replace $oldPath, $scriptUpdates[$oldPath]
}

# Update documentation URLs in the file header comments
$htmlContent = $htmlContent -replace 'PlanVision_-_Design-Manifesto.md', 'NA40_01_-_DOCS_-_Application-Documentation/PlanVision_-_Design-Manifesto.txt'
$htmlContent = $htmlContent -replace 'PlanVision_-_Revision-Notes.md', 'NA40_01_-_DOCS_-_Application-Documentation/PlanVision_-_Revision-Notes.txt'

# Save the updated content back to the file
$htmlContent | Out-File -FilePath $htmlFile -Encoding utf8

# Also create a copy of the updated file with the proper naming convention for the root directory
$htmlContent | Out-File -FilePath "PlanVision_NEW\NA_Plan-Vision-App_-_2.0.0.html" -Encoding utf8

Write-Host "HTML file updated with new paths." 