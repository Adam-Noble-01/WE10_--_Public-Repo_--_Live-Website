# File restructuring script for PlanVision Web Application

# Documentation files
Copy-Item "NA40_-_PlanVision-Web-Application\PlanVision_-_Design-Manifesto.txt" "PlanVision_NEW\NA40_01_-_DOCS_-_Application-Documentation\"
Copy-Item "NA40_-_PlanVision-Web-Application\PlanVision_-_Revision-Notes.txt" "PlanVision_NEW\NA40_01_-_DOCS_-_Application-Documentation\"
Copy-Item "NA40_-_PlanVision-Web-Application\PlanVision_-_Version-2.0.0._-_Notes.txt" "PlanVision_NEW\NA40_01_-_DOCS_-_Application-Documentation\"
Copy-Item "NA40_-_PlanVision-Web-Application\PlanVision_-_Version-2.0.0_-_Task-Breakdown.txt" "PlanVision_NEW\NA40_01_-_DOCS_-_Application-Documentation\"

# Data files 
Copy-Item "NA40_-_PlanVision-Web-Application\NA20_01_01_-_DATA_-_Asset-Link-Library.json" "PlanVision_NEW\NA40_02_-_DATA_-_App-Files-And-App-Config\"
Copy-Item "NA40_-_PlanVision-Web-Application\NA20_01_02_-_DATA_-_Document-Link-Library.json" "PlanVision_NEW\NA40_02_-_DATA_-_App-Files-And-App-Config\"

# Create new App Config file
$configContent = @'
{
    "File_Metadata": {
        "file-name": "NA40_01_01_-_DATA_-_PlanVision-App-Config.json",
        "file-author": "Adam Noble",
        "file-description": "Configuration file for the PlanVision Web Application",
        "file-created": "11-Apr-2025",
        "file-version": "2.0.0"
    },
    "Core-App_config": {
        "app-style-location": "NA40_03_-_STYL_-_Style-Library/NA02_02_01_-_NA_Plan-Vision-App_-_2.0.0_-_StyleSheet.css",
        "app-fallback-style": "https://www.noble-architecture.com/assets/AD02_-_STYL_-_Common_-_StyleSheets/AD02_10_-_STYL_-_Core-Default-Stylesheet_-_Noble-Architecture.css",
        "app-assets-location": "https://www.noble-architecture.com/assets/AD01_-_DATA_-_Common_-_Global-Data-Library/AD01_10_-_DATA_-_Common_-_Core-Web-Asset-Library.json",
        "app-dev-mode": true
    },
    "Project_Details": {
        "project-name-nickname": "Wollaton Vale",
        "project-name-string": "NA06_--_Wollaton-Vale",
        "project-address--house": "Cloves Wood",
        "project-address--house-no": "123",
        "project-address-street": "Capybara Close",
        "project-address-town": "Capyville",
        "project-address-city": "Capyton",
        "project-address-county": "Capyshire",
        "project-address-postcode": "CY3 B4A"
    },
    "Project_Documents": {
        "project-data-file-location": "NA40_02_-_DATA_-_App-Files-And-App-Config/NA20_01_02_-_DATA_-_Document-Link-Library.json",
        "Revision-tracker": [
            {
                "date": "11-Apr-2025",
                "revision": "2.0.0",
                "changes": [
                    "Restructured application",
                    "Updated file naming conventions",
                    "Created new configuration file structure"
                ]
            }
        ]
    },
    "Button_&_Menu_Config": {
        "buttons": {
            "BTTN__Download-PDF": {
                "function": "downloadPDF",
                "script": "Canvas-Controller.js"
            },
            "BTTN__Reset-View": {
                "function": "resetView",
                "script": "Canvas-Controller.js" 
            },
            "BTTN__Linear-Measure": {
                "function": "activateLinearMeasurementTool",
                "script": "Measurement-Tools.js"
            },
            "BTTN__Rect-Measure": {
                "function": "activateRectangleMeasurementTool",
                "script": "Measurement-Tools.js"
            },
            "BTTN__Area-Measure": {
                "function": "activateAreaMeasurementTool",
                "script": "Measurement-Tools.js"
            },
            "BTTN__Clear-Measurements": {
                "function": "clearAllMeasurements",
                "script": "Measurement-Tools.js"
            },
            "BTTN__Cancel-Tool": {
                "function": "cancelActiveTool",
                "script": "Measurement-Tools.js"
            },
            "BTTN__Fullscreen-Toggle": {
                "function": "toggleFullscreen",
                "script": "UI-Navigation.js"
            }
        }
    }
}
'@
$configContent | Out-File -FilePath "PlanVision_NEW\NA40_02_-_DATA_-_App-Files-And-App-Config\NA40_01_01_-_DATA_-_PlanVision-App-Config.json" -Encoding utf8

# Style files
Copy-Item "NA40_-_PlanVision-Web-Application\NA_Plan-Vision-App_-_2.0.0_-_StyleSheet.css" "PlanVision_NEW\NA40_03_-_STYL_-_Style-Library\NA02_02_01_-_NA_Plan-Vision-App_-_2.0.0_-_StyleSheet.css"

# File Loader Scripts
Copy-Item "NA40_-_PlanVision-Web-Application\NA_Plan-Vision-App_-_2.0.0_-_App-Assets-Loader.js" "PlanVision_NEW\NA40_04_-_SCRP_-_File-Loader-Scripts\NA40_04_01_-_Core-App-Config-And-Assets-Loader.js"
Copy-Item "NA40_-_PlanVision-Web-Application\NA_Plan-Vision-App_-_2.0.0_-_Project-Assets-Loader.js" "PlanVision_NEW\NA40_04_-_SCRP_-_File-Loader-Scripts\NA40_04_02_-_Project-Assets-Loader.js"
Copy-Item "NA40_-_PlanVision-Web-Application\NA_Plan-Vision-App_-_2.0.0_-_Application-Controller.js" "PlanVision_NEW\NA40_04_-_SCRP_-_File-Loader-Scripts\NA40_04_10_-_Application-Controller.js"
Copy-Item "NA40_-_PlanVision-Web-Application\NA_Plan-Vision-App_-_2.0.0_-_Module-Integration.js" "PlanVision_NEW\NA40_04_-_SCRP_-_File-Loader-Scripts\NA40_04_11_-_Module-Integration.js"

# Core Utility Scripts
Copy-Item "NA40_-_PlanVision-Web-Application\NA_Plan-Vision-App_-_2.0.0_-_Font-Asset-Loader.js" "PlanVision_NEW\NA40_05_-_SCRP_-_Core-Utility-Scripts\NA40_04_06_-_Font-Asset-Loader.js"
Copy-Item "NA40_-_PlanVision-Web-Application\NA_Plan-Vision-App_-_2.0.0_-_URL-Parser.js" "PlanVision_NEW\NA40_05_-_SCRP_-_Core-Utility-Scripts\NA40_08_01_-_URL-Parser.js"

# Canvas and Rendering Scripts
Copy-Item "NA40_-_PlanVision-Web-Application\NA_Plan-Vision-App_-_2.0.0_-_Canvas-Controller.js" "PlanVision_NEW\NA40_06_-_SCRP_-_Canvas-And-Main-Rendering-Scripts\NA40_06_03_-_Canvas-Controller.js"
Copy-Item "NA40_-_PlanVision-Web-Application\NA_Plan-Vision-App_-_2.0.0_-_Canvas-Renderer.js" "PlanVision_NEW\NA40_06_-_SCRP_-_Canvas-And-Main-Rendering-Scripts\NA40_06_04_-_Canvas-Renderer.js"

# Measurement and Math Scripts
Copy-Item "NA40_-_PlanVision-Web-Application\NA_Plan-Vision-App_-_2.0.0_-_Measurement-Scaling.js" "PlanVision_NEW\NA40_07_-_SCRP_-_Measurement-And-Math-Scripts\NA40_07_01_-_Measurement-Scaling.js"
Copy-Item "NA40_-_PlanVision-Web-Application\NA_Plan-Vision-App_-_2.0.0_-_Measurement-Tools.js" "PlanVision_NEW\NA40_07_-_SCRP_-_Measurement-And-Math-Scripts\NA40_07_02_-_Measurement-Tools.js"

# UI and Navigation Scripts
Copy-Item "NA40_-_PlanVision-Web-Application\NA_Plan-Vision-App_-_2.0.0_-_UI-Navigation.js" "PlanVision_NEW\NA40_08_-_SCRP_-_User-Interface-And-Navigation\NA40_08_01_-_UI-Navigation.js"

# Development Files
Copy-Item "NA40_-_PlanVision-Web-Application\NA_Plan-Vision-App_-_2.0.0_-_Debug-Panel.js" "PlanVision_NEW\NA40_20_-_DEVP_-_Development-Files\NA40_20_01_-_Debug-Panel.js"

# Main HTML File
Copy-Item "NA40_-_PlanVision-Web-Application\NA_Plan-Vision-App_-_2.0.0.html" "PlanVision_NEW\"
Copy-Item "NA40_-_PlanVision-Web-Application\--REF--NA_Plan-Vision-App_-_1.8.8.html" "PlanVision_NEW\"

Write-Host "File restructuring complete!" 