//!! AI AGENT CAREFULLY GO THROUGH SCRIPTS BEFORE EDITING THIS FILE

// TASK 01 - RESEARCH CURRENT CODEBASE
// Methodically check every file in the codebase for any mention on HDRIs or lighting setup.
// Move anything pertaining to enviromental  lighting into this script.



// TASK 02 - RESEARCH CURRENT CODEBASE
// Methodically check every file in the codebase for any mention on HDRIs or lighting setup.
// Move anything pertaining to enviromental  lighting into this script.
// `SceneConfig_HdriLightingLogic.js`


// TASK 03 - ENSURE THE CONFIG FILE DRIVES THE SETTTINGS IN THE NEW SCRIPT
// - Its critical the Json is the single point of truth for specifying the paths to load the HDRI from as this will be updated occasionally 
// - Allows for future GUI swapping without editing code
// Main File
//   `Data_-_MainAppConfig.json`
// 
// ```JSON
// "SceneConfig" :  {
//     "SceneConfig_Description"  :  "This section contains all the configuration options for the scene",
//     "LightingConfig" : {
//         "LightingCfg_HdriLighting_Description"   :  "This section contains all the configuration options for the lighting",
//         "LightingCfg_HdriLighting"               :  true,
//         "LightingCfg_HdrirBrightnessFactor"      :  10.00,
//         "LightingCfg_HdrirRotationAngleDeg"      :  180,
//         "LightingCfg_HdriLightingRelativePath"   :  "./Assets_PluginAssets/LightAssets_HdriSkydomes/True-Vision-3D_-_Test-HDRI_-_Pure_Sky_2k.hdr",
//         "LightingCfg_HdriLightingURL"            :  "https://www.noble-architecture.com/na-apps/NA21_WebApp_-_TrueVision/Assets_PluginAssets/LightAssets_HdriSkydomes/True-Vision-3D_-_Test-HDRI_-_Pure_Sky_2k.hdr",
//         "LightingCfg_HdriLightingLogicFile"      :  "./SceneConfig_HdriLightingLogic.js"
//     }
// }
// ```
//
// Important!! Note the true / false statement this will enable or disable HDRI Lighting
// `LightingCfg_HdrirBrightnessFactor"      :  10.00`  <-- This should acrt as a easy globaly way to increase or decrease the HDRI light levels brightness

// TASK 04 - Build New Logic Script

// TASK 05 - Ensure it loads with the other JS files

// TASK 06 - Update the Rendering Pipeline and check other scripts that might require HDRI Information, also check the AO Effect Script 

// TASK 07 - Update the Documentation

// TASK 08 - Update the Dev Log to Version 1.1.1 - 07-Jun-2025





