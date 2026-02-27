#  Task: Update Subdirectories 

## The Problem
- I need to update the subdirectories to a more logical structure.
# -------------------------------------------------------------
## CURRENT STRUCTURE
02__Src__AppModules/
├── 01__AppCore/
│   ├──── Na__AppConfig__Loader.js
│   └──── Na__AppFlow__LoadingSequence.js
│
├── 02__AppData/
│   ├──── Na__AppConfig__Main.json
│   └──── Na__AppConfig__MaterialsLibrary.json
│
├── 03__AppUtils/
│   └──── Na__AppUtils__ProjectLoader.js
│
├── 04__MathUtils/
│   └──── Na__Math__Units.js
│
├── 05__RenderPipeline/
│   ├──── Na__RenderEffect__ProfileLines__.js
│   └──── Na__RenderPipeline__PostProcessing__Setup.js
│
├── 06__Scene__LightingEffects/
│   └──── Na__Scene__DefaultSceneLighting.js
│
├── 07__Scene__EnvironmentEffects/
│   └──── Na__Scene__DefaultFogEffect.js
│
├── 08__NavigationAndCameras/
│   ├──── Na__DefaultNavmode__IpadControls.js
│   ├──── Na__DefaultNavmode__MouseControls.js
│   ├──── Na__Navmode__OrbitControls__Damping.js
│   ├──── Na__Navmode__OrbitMode__SystemLogic.js
│   ├──── Na__Navmode__WalkMode__DesktopControls.js
│   ├──── Na__Navmode__WalkMode__SystemLogic.js
│   ├──── Na__Navmode__WalkMode__TouchScreenControls.js
│   ├──── Na__UiFeature__WalkModeControls.js
│   └──── Na__UiFeature__WalkModeEventListeners.js
│
├── 09__CameraUtils/
│   ├──── Na__UiFeature__CameraLens__Controls.js
│   ├──── Na__UiFeature__CameraPosition__Controls.js
│   └──── Na__UiFeature__SaveCameraSettings.js
│
├── 10__ModelLoader/
│   └──── Na__ModelLoader__MultiModel.js
│
├── 11__MaterialsSystem/
│   ├──── Na__MaterialsSystem__LibraryLoader.js
│   └──── Na__MaterialsSystem__MaterialSwap.js
│
├── 12__ModelToggle/
│   └──── Na__UiFeature__ModelToggle__Controls.js
│
├── 13__ImageExport/
│   ├──── Na__ImageExport__PostProcessEffects__HighPassSharpen.js
│   ├──── Na__ImageExport__PostProcessEffects__Levels.js
│   ├──── Na__ImageExport__PostProcessEffects__Pipeline.js
│   ├──── Na__UiFeature__ImageExport__Controls.js
│   └──── Na__UiFeature__ImageExport__ViewportOverlays.js
│
├── 14__PageLayoutSystem/
│   ├── 01__Dependencies__VersionLocked/
│   │   └──── jspdf.umd.js
│   │
│   ├──── Na__PageLayoutSystem__2dNavigationControls__.js
│   ├──── Na__PageLayoutSystem__CanvasRenderPipeline__.js
│   ├──── Na__PageLayoutSystem__Controls__Pc__.js
│   ├──── Na__PageLayoutSystem__Controls__TouchScreen__.js
│   ├──── Na__PageLayoutSystem__Layout__.html
│   ├──── Na__PageLayoutSystem__PdfExport__A3__.js
│   ├──── Na__PageLayoutSystem__Styles__Main__.css
│   ├──── Na__PageLayoutSystem__SystemLogic__Main__.js
│   └──── PageLayoutSystem__TitleBlock__A3__.png
│
├── 20__SystemModules__3dObject__InteractionsSystem/
│   ├──── 3dObjectIInteraction__Animation__ClickToOpenDoors__.js
│   ├──── 3dObjectIInteraction__Animation__ClickToOpenDoors__README__.md
│   └──── 3dObjectInteraction__Animation__WalkMode__ProximityToOpenDoors__.js
│
├── 21__SystemModules__3dObject__ViewBuildingStoreysSystem/
│   ├──── 3dObject__ViewBuildingStoreys__README__.md
│   └──── 3dObject__ViewBuildingStoreys__SystemLogic__.js
│
└── 80__CloudflareIntegration/
    └──── FutureCfHelpersEtc__ForServerlessFeaturesSuchAsClientComments__.note

# -------------------------------------------------------------
## DESIRED STRUCTURE

02__Src__AppModules/
├── 01__AppCore/
│   ├──── Na__AppConfig__Loader.js
│   └──── Na__AppFlow__LoadingSequence.js
│   └──── Na__AppLoader__ProjectDataLoader__.js
│
├── 02__AppData/
│   ├──── Na__AppConfig__Main.json
│   └──── Na__AppConfig__MaterialsLibrary.json
│
├── 03__AppUtils/
│   └──── Na__AppUtils__ProjectLoader.js
│
├── 04__MathUtils/
│   └──── Na__Math__Units.js
│
├── 05__RenderPipeline/
│   ├──── Na__RenderEffect__ProfileLines__.js
│   └──── Na__RenderPipeline__PostProcessing__Setup.js
│
├── 06__Scene__LightingEffects/
│   └──── Na__Scene__DefaultSceneLighting.js
│
├── 07__Scene__EnvironmentEffects/
│   └──── Na__Scene__DefaultFogEffect.js
│
├── 10__NavigationAndCameras/
│   ├──── Na__DefaultNavmode__IpadControls.js
│   ├──── Na__DefaultNavmode__MouseControls.js
│   ├──── Na__Navmode__OrbitControls__Damping.js
│   ├──── Na__Navmode__OrbitMode__SystemLogic.js
│   ├──── Na__Navmode__WalkMode__DesktopControls.js
│   ├──── Na__Navmode__WalkMode__SystemLogic.js
│   ├──── Na__Navmode__WalkMode__TouchScreenControls.js
│   ├──── Na__UiFeature__WalkModeControls.js
│   └──── Na__UiFeature__WalkModeEventListeners.js
│
├── 11__CameraUtils/
│   ├──── Na__UiFeature__CameraLens__Controls.js
│   ├──── Na__UiFeature__CameraPosition__Controls.js
│   └──── Na__UiFeature__SaveCameraSettings.js
│
├── 15__ModelLoader/
│   └──── Na__ModelLoader__MultiModel.js
│
├── 20__System__MaterialsSystem/
│   ├──── Na__MaterialsSystem__LibraryLoader.js
│   └──── Na__MaterialsSystem__MaterialSwap.js
|
├── 25__System__3dObject__InteractionSystem/
│   ├──── 3dObjectIInteraction__Animation__ClickToOpenDoors__.js
│   ├──── 3dObjectIInteraction__Animation__ClickToOpenDoors__README__.md
│   └──── 3dObjectInteraction__Animation__WalkMode__ProximityToOpenDoors__.js
│
├── 26__System__ToggleModelElements/
│   └──── Na__UiFeature__ModelToggle__Controls.js
│   ├──── 3dObject__ViewBuildingStoreys__README__.md
│   └──── 3dObject__ViewBuildingStoreys__SystemLogic__.js
│
├── 30__System__ImageExport/
│   ├──── Na__ImageExport__PostProcessEffects__HighPassSharpen.js
│   ├──── Na__ImageExport__PostProcessEffects__Levels.js
│   ├──── Na__ImageExport__PostProcessEffects__Pipeline.js
│   ├──── Na__UiFeature__ImageExport__Controls.js
│   └──── Na__UiFeature__ImageExport__ViewportOverlays.js
│
├── 90__System__PageLayoutSystem/
│   ├── 01__Dependencies__VersionLocked/
│   │   └──── jspdf.umd.js
│   │
│   ├──── Na__PageLayoutSystem__2dNavigationControls__.js
│   ├──── Na__PageLayoutSystem__CanvasRenderPipeline__.js
│   ├──── Na__PageLayoutSystem__Controls__Pc__.js
│   ├──── Na__PageLayoutSystem__Controls__TouchScreen__.js
│   ├──── Na__PageLayoutSystem__Layout__.html
│   ├──── Na__PageLayoutSystem__PdfExport__A3__.js
│   ├──── Na__PageLayoutSystem__Styles__Main__.css
│   ├──── Na__PageLayoutSystem__SystemLogic__Main__.js
│   └──── PageLayoutSystem__TitleBlock__A3__.png
│
└── 80__CloudflareIntegration/
    └──── FutureCfHelpersEtc__ForServerlessFeaturesSuchAsClientComments__.note


# -------------------------------------------------------------
# IMPORTANT INSTRUCTIONS
- Map out the project and build a picture of the existing structure and how the files are loaded and wired up to the correct systems and modules.
- Ensure all files requiring these scripts are updated to reference the new subdirectories and naming.