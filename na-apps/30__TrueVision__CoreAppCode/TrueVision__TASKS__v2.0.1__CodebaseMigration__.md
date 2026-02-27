# TrueVision3D v2.0.1 Tasks


## MAIN OBJECTIVE:
Migrate the code base to TrueVision3D v2.0.1 for Noble Architecture, instead of ValeVision3D v1.9.7

### IMPORTANT BACKGROUND
- We previously built ValeVision3D v1.9.7 for a previous project and I'm reusing it for a new project. 
- The application is a 3D architectural model viewer.
- I want to integrate into the Noble Architecture project portal system of tools to manage the projects 3D Models.

### INTRODUCTION 
- This will be a large task as it will be sifting through a huge amount of modules within this application. 

### THE ISSUE
- The codebase is not named for the new project and is not structured in a way that is easy to understand and maintain.


## Codebase Migration Tasks
- Firstly we will focus mainly on code naming and structure and then we will focus on the code itself.
- I want to get all naming conventions aligned and consistent before we start to further personalize the application to the new project.
- All mentions of "Vale" "ValeVision" "ValeVision3D" "Vale Garden Houses" Etc need to be updated to "TrueVision" "TrueVision3D" "Noble Architecture" Etc.
- The previous application was built for Vale Garden Houses, so we need to update all references to Vale Garden Houses to Noble Architecture.
- This will be a large task as it will be sifting through a huge amount of modules within this application. 
- Previously the application was ValeVision, so we need to update all references to ValeVision to TrueVision.
- I want to rebuild it for Noble Architecture, the name spacing I already used Na__ for most things because I knew one day I would be building it for noble architecture as the original ValeVision application was both a proof of concept and for a smaller client. 
- Now I'm completely migrating all of the code but I need you to go through and make sure all of the naming consistently is renamed to TrueVision 3D for the new project.
- Any name spacing or naming of functions files absolutely anything containing "Vale" or "ValeVision" Etc needs to be updated to TrueVision or Noble Architecture (depending on context) 

### TASKS
- Carefully look through the entire code base and flag anything currently misnamed So as we can get it all aligned ahead of time before we start to further personalize the application to the new project, all of the underlying Tech should remain the same because it's literally a architectural model 3D viewer but for a different business so the project is effectively rehashing this application and all of its systems for a different company. 

1. Carefully and methodically go through code base searching for many terms related to what I said above and build up a picture 
2. Build a list of items for me to consider changing 
3. Report these to me in the dedicated section below in the markdown file.

### AIMS OF THE UPDATES
- To align all mentions of "Vale" "ValeVision" "ValeVision3D" "Vale Garden Houses" Etc to "TrueVision" "TrueVision3D" "Noble Architecture" Etc.

### IMPORTANT CODING RULES
- Separate concerns as much as possible within new files. 
- Use the established three-stage name spacing system. 
- Carefully check all of the systems and build out a mental picture of the structures of dependencies between scripts. 
- Strictly use the existing units and Mass helper scripts already set up don't reinvent the wheel. 
- Use the app config file as much as possible for defaults driving downstream variables and constants in the modules. 

### MAP THE PROJECT FIRST BEFORE CODING
- The project is HIGHLY modular thus you need to build a picture of the existing systems to see how to wire up the new system to the existing systems.
- Utilise the tree diagram in the final section below to build a picture of the project and how the stylesheets are loaded and wired up to the correct systems and modules.

# -------------------------------------------------------------
## CONCLUSION
Once completed we should have a robust set of Stylesheets that are properly named and structured and loaded in the correct locations and wired up to the correct systems and modules.

# -------------------------------------------------------------
## PROJECT TREE STRUCTURE
30__TrueVision__CoreAppCode/
├── .cursor/
│   ├── rules/
│   │   ├──── 00-AgentRole-Global-.mdc
│   │   ├──── 01-NamingConvention-Global-.mdc
│   │   ├──── 02-Description-Global-.mdc
│   │   ├──── 03-Dependency-Traversal-Protocol-.mdc
│   │   ├──── 04-AppConfig-Global-Critical-.mdc
│   │   ├──── 05-CodingConventions-Global-.mdc
│   │   ├──── 06-Function-and-Class-Design-Principles-.mdc
│   │   └──── 07-World-Units-And-Conversions-Required-Global-.mdc
│   │
│   └──── debug.log
│
├── 00__Archive/
│   ├──── ValeVision3D__0.1.0__10-Feb-2026__.zip
│   └──── ValeVision3D__0.1.6__16-Feb-2026__.zip
│
├── 10__DistributionEmails/
│   └──── Distro__InviteEmailEmbedCard__ValeVision3d.html
│
├── 80__Testing__PrototypeEnvironment/
│   ├── TestEnv__CompletedFeaturesDocs/
│   │   └──── Test__ModelInteraction__Animation__ClickToOpenDoors__.md
│   │
│   ├── TestEnv__CurrentFeatureTestScripts/
│   │   ├──── Test__TopLevelContainer__BuildingModelsByStorey__.js
│   │   └──── Test__TopLevelContainer__BuildingModelsByStorey__.md
│   │
│   ├── TestEnv__GlbFiles/
│   │   ├──── DoorTesting__WorkingDoorAnimationModels__.zip
│   │   ├──── FirstHouseTest__ShellOnly__.zip
│   │   ├──── Iter__WhitecardModels__.zip
│   │   ├──── Moore__ProjectTestFiles__.zip
│   │   ├──── Na__House.zip
│   │   ├──── Na__LatestWorkingDoors__Test__.zip
│   │   ├──── NP03__01__OrbitHelperCube__MeshModel__.glb
│   │   ├──── NP03__NaModel__LandscapeEnvironment__LineworkModel__.glb
│   │   ├──── NP03__NaModel__LandscapeEnvironment__MeshModel__.glb
│   │   ├──── NP03__Storey__FirstFloor__ProposedDoors__LineworkModel__.glb
│   │   ├──── NP03__Storey__FirstFloor__ProposedDoors__MeshModel__.glb
│   │   ├──── NP03__Storey__FirstFloor__ProposedFloors__LineworkModel__.glb
│   │   ├──── NP03__Storey__FirstFloor__ProposedFloors__MeshModel__.glb
│   │   ├──── NP03__Storey__FirstFloor__ProposedFurniture__LineworkModel__.glb
│   │   ├──── NP03__Storey__FirstFloor__ProposedFurniture__MeshModel__.glb
│   │   ├──── NP03__Storey__FirstFloor__ProposedStairs__LineworkModel__.glb
│   │   ├──── NP03__Storey__FirstFloor__ProposedStairs__MeshModel__.glb
│   │   ├──── NP03__Storey__FirstFloor__ProposedWalls__LineworkModel__.glb
│   │   ├──── NP03__Storey__FirstFloor__ProposedWalls__MeshModel__.glb
│   │   ├──── NP03__Storey__FirstFloor__ProposedWindows__LineworkModel__.glb
│   │   ├──── NP03__Storey__FirstFloor__ProposedWindows__MeshModel__.glb
│   │   ├──── NP03__Storey__GroundFloor__ProposedDoors__LineworkModel__.glb
│   │   ├──── NP03__Storey__GroundFloor__ProposedDoors__MeshModel__.glb
│   │   ├──── NP03__Storey__GroundFloor__ProposedFloors__LineworkModel__.glb
│   │   ├──── NP03__Storey__GroundFloor__ProposedFloors__MeshModel__.glb
│   │   ├──── NP03__Storey__GroundFloor__ProposedFurniture__LineworkModel__.glb
│   │   ├──── NP03__Storey__GroundFloor__ProposedFurniture__MeshModel__.glb
│   │   ├──── NP03__Storey__GroundFloor__ProposedRoofs__LineworkModel__.glb
│   │   ├──── NP03__Storey__GroundFloor__ProposedRoofs__MeshModel__.glb
│   │   ├──── NP03__Storey__GroundFloor__ProposedStairs__LineworkModel__.glb
│   │   ├──── NP03__Storey__GroundFloor__ProposedStairs__MeshModel__.glb
│   │   ├──── NP03__Storey__GroundFloor__ProposedWalls__LineworkModel__.glb
│   │   ├──── NP03__Storey__GroundFloor__ProposedWalls__MeshModel__.glb
│   │   ├──── NP03__Storey__GroundFloor__ProposedWindows__LineworkModel__.glb
│   │   ├──── NP03__Storey__GroundFloor__ProposedWindows__MeshModel__.glb
│   │   ├──── NP03__Storey__SecondFloor__ProposedDoors__LineworkModel__.glb
│   │   ├──── NP03__Storey__SecondFloor__ProposedDoors__MeshModel__.glb
│   │   ├──── NP03__Storey__SecondFloor__ProposedFixtures__LineworkModel__.glb
│   │   ├──── NP03__Storey__SecondFloor__ProposedFixtures__MeshModel__.glb
│   │   ├──── NP03__Storey__SecondFloor__ProposedFloors__LineworkModel__.glb
│   │   ├──── NP03__Storey__SecondFloor__ProposedFloors__MeshModel__.glb
│   │   ├──── NP03__Storey__SecondFloor__ProposedFurniture__LineworkModel__.glb
│   │   ├──── NP03__Storey__SecondFloor__ProposedFurniture__MeshModel__.glb
│   │   ├──── NP03__Storey__SecondFloor__ProposedRoofs__LineworkModel__.glb
│   │   ├──── NP03__Storey__SecondFloor__ProposedRoofs__MeshModel__.glb
│   │   ├──── NP03__Storey__SecondFloor__ProposedWalls__LineworkModel__.glb
│   │   ├──── NP03__Storey__SecondFloor__ProposedWalls__MeshModel__.glb
│   │   ├──── NP03__Storey__SecondFloor__ProposedWindows__LineworkModel__.glb
│   │   ├──── NP03__Storey__SecondFloor__ProposedWindows__MeshModel__.glb
│   │   ├──── NP03__TestWithVeluxes__23-Feb-2026.zip
│   │   └──── Yandell__WhitecardModels__.zip
│   │
│   ├──── Na__TestEnv__Styles__PrototypeSandbox__.css
│   ├──── TestEnv__FlaskLocalServer.bat
│   ├──── TestEnv__FlaskLocalServer.py
│   ├──── TestEnv__PrototypeTestingSandbox__DomAndLayout.html
│   ├──── TestEnv__PrototypeTestingSandbox__Main__.js
│   ├──── TestEnv__README__.md
│   └──── TestEnv__SubAppData__Config.json
│
├── assets__Skydomes/
│   └──── HdriSkydome__RuralLandscape__AutumnField__SunnyDay__4k__.hdr
│
├── rubyScript__SketchUpSisterTools__ToolsAndUtils/
│   ├──── Na__TrueVision__GlbBuilder__Version-1.3.0__10-Feb-2026__.zip
│   ├──── Na__TrueVision__GlbBuilder__Version-1.4.0__10-Feb-2026__.zip
│   ├──── Na__TrueVision__GlbBuilderUtility__Version-1.7.0__23-Feb-2026__.zip
│   ├──── Na__TrueVision__GlbBuilderUtility__Version-1.7.1__23-Feb-2026.zip
│   └──── Na__TrueVision__WhitecardModel__GlbBuilderUtility__Modules__LocalShortcut__.lnk
│
├── 02__Src__AppModules/\1/
│   ├──── 3dObjectIInteraction__Animation__ClickToOpenDoors__.js
│   ├──── 3dObjectIInteraction__Animation__ClickToOpenDoors__README__.md
│   └──── 3dObjectInteraction__Animation__WalkMode__ProximityToOpenDoors__.js
│
├── 02__Src__AppModules/\1/
│   ├──── 3dObject__ViewBuildingStoreys__README__.md
│   └──── 3dObject__ViewBuildingStoreys__SystemLogic__.js
│
├── 02__Src__AppModules/\1/
│   ├──── Na__AppConfig__Loader.js
│   ├──── Na__AppConfig__Main.json
│   └──── Na__AppConfig__MaterialsLibrary.json
│
├── 02__Src__AppModules/\1/
│   └──── Na__AppFlow__LoadingSequence.js
│
├── 02__Src__AppModules/\1/
│   └──── Na__AppUtils__ProjectLoader.js
│
├── 02__Src__AppModules/\1/
│
├── 02__Src__AppModules/\1/
│   ├──── Na__UiFeature__CameraLens__Controls.js
│   ├──── Na__UiFeature__CameraPosition__Controls.js
│   └──── Na__UiFeature__SaveCameraSettings.js
│
├── 02__Src__AppModules/\1/
│   ├──── GenerateObject__AnimatedBallCloud.js
│   ├──── GenerateObject__AnimatedRGBBoxes.js
│   ├──── GenerateObject__AnimatedWhiteStars.js
│   └──── TestEnv__GenerateObjects__Minimal__.html
│
├── 02__Src__AppModules/\1/
│   ├──── Na__ImageExport__PostProcessEffects__HighPassSharpen.js
│   ├──── Na__ImageExport__PostProcessEffects__Levels.js
│   ├──── Na__ImageExport__PostProcessEffects__Pipeline.js
│   ├──── Na__UiFeature__ImageExport__Controls.js
│   └──── Na__UiFeature__ImageExport__ViewportOverlays.js
│
├── 02__Src__AppModules/\1/
│   ├──── Na__MaterialsSystem__LibraryLoader.js
│   └──── Na__MaterialsSystem__MaterialSwap.js
│
├── 02__Src__AppModules/\1/
│   └──── Na__Math__Units.js
│
├── 02__Src__AppModules/\1/
│   └──── Na__ModelLoader__MultiModel.js
│
├── 02__Src__AppModules/\1/
│   └──── Na__UiFeature__ModelToggle__Controls.js
│
├── 02__Src__AppModules/\1/
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
├── 02__Src__AppModules/\1/
│   ├── 01__Dependencies__VersionLocked/
│   │   └──── jspdf.umd.js
│   │
│   ├── 02__VizDpt__TitleBlock__Pdf__/
│   │   ├──── PageLayoutSystem__TitleBlock__A3__.pdf
│   │   └──── PageLayoutSystem__TitleBlock__A3__.png
│   │
│   ├── 03__TitleBlock__LayoutPdfs__RecConcept__Feb-2026__/
│   │   ├──── A1 landscape layout.pdf
│   │   ├──── A1 landscape layout_-_Converted_From_PDF.png
│   │   ├──── A1 portrait layout.pdf
│   │   ├──── A1 portrait layout_-_Converted_From_PDF.png
│   │   ├──── A2 landscape layout.pdf
│   │   ├──── A2 landscape layout_-_Converted_From_PDF.png
│   │   ├──── A2 portrait layout.pdf
│   │   ├──── A2 portrait layout_-_Converted_From_PDF.png
│   │   ├──── A3 landscape layout.pdf
│   │   ├──── A3 landscape layout_-_Converted_From_PDF.png
│   │   ├──── A3 portrait layout.pdf
│   │   └──── A3 portrait layout_-_Converted_From_PDF.png
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
├── 02__Src__AppModules/\1/
│   ├──── Na__RenderEffect__ProfileLines__.js
│   └──── Na__RenderPipeline__PostProcessing__Setup.js
│
├── 02__Src__AppModules/\1/
│   └──── Na__Scene__DefaultFogEffect.js
│
├── 02__Src__AppModules/\1/
│   └──── Na__Scene__DefaultSceneLighting.js
│
├── 03__Style__AppStylesheets/
│   ├──── Na__CoreUi__Styles__BaseLayout__.css
│   ├──── Na__CoreUi__Styles__Fonts__.css
│   ├──── Na__CoreUi__Styles__Index__.css
│   ├──── Na__CoreUi__Styles__RenderCanvas__.css
│   ├──── Na__ImageExport__Styles__ViewportOverlays__.css
│   ├──── Na__UiFeature__Styles__AppHeader__.css
│   ├──── Na__UiFeature__Styles__ControlsHelpPanel__.css
│   ├──── Na__UiFeature__Styles__DropdownAndToast__.css
│   └──── Na__UiFeature__Styles__LoadingOverlays__.css
│
├──── .cursorignore
├──── .cursorrules
├──── .cursorworkspace__TrueVision3D__.code-workspace
├──── 80__Testing__PrototypeEnvironment__CleanBackUp__.zip
├──── DEPENDENCY_CHART.md
├──── index.html
├──── Na__Architecture__ProjectStructure__PipelineMap__.md
├──── TrueVision__TASKS__v2.0.1__CodebaseMigration__.md
├──── ValeVision__DEVLOG__.md
├──── ValeVision__README__.md
├──── ValeVision__REPORT__.md
└──── ValeVision__TASKS__v1.9.7__Stylesheets__.mdh

# -------------------------------------------------------------
# @AGENTS REPORT HERE 

## AGENT SCAN REPORT - Legacy Naming Audit (Vale -> TrueVision/Noble Architecture)

### Scope Used
- Included: code + config + docs + filenames/folders.
- Excluded: `00__Archive/` plus large/binary assets such as `.zip`, `.glb`, image and PDF files.
- Search terms: `Vale`, `ValeVision`, `ValeVision3D`, `Vale Garden Houses`, plus legacy acronym patterns like `VV_`.

### High-Priority Runtime Files (rename text first)
- `index.html`
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js`
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js`
- `02__Src__AppModules/03__AppUtils/Na__AppUtils__ProjectLoader.js`
- `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__WalkMode__SystemLogic.js`
- `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__WalkMode__DesktopControls.js`
- `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__WalkMode__TouchScreenControls.js`
- `02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__WalkModeControls.js`
- `02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__WalkModeEventListeners.js`
- `02__Src__AppModules/30__System__ImageExport/Na__UiFeature__ImageExport__Controls.js`
- `02__Src__AppModules/20__System__MaterialsSystem/Na__MaterialsSystem__LibraryLoader.js`
- `02__Src__AppModules/20__System__MaterialsSystem/Na__MaterialsSystem__MaterialSwap.js`
- `02__Src__AppModules/11__CameraUtils/Na__UiFeature__CameraPosition__Controls.js`
- `02__Src__AppModules/11__CameraUtils/Na__UiFeature__SaveCameraSettings.js`
- `02__Src__AppModules/02__AppData/Na__AppConfig__MaterialsLibrary.json`

### UI/CSS and Page Layout References
- `03__Style__AppStylesheets/Na__CoreUi__Styles__BaseLayout__.css`
- `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css`
- `03__Style__AppStylesheets/Na__ImageExport__Styles__ViewportOverlays__.css`
- `03__Style__AppStylesheets/Na__UiFeature__Styles__AppHeader__.css`
- `03__Style__AppStylesheets/Na__UiFeature__Styles__ControlsHelpPanel__.css`
- `03__Style__AppStylesheets/Na__UiFeature__Styles__LoadingOverlays__.css`
- `02__Src__AppModules/90__System__PageLayoutSystem/Na__PageLayoutSystem__2dNavigationControls__.js`
- `02__Src__AppModules/90__System__PageLayoutSystem/Na__PageLayoutSystem__CanvasRenderPipeline__.js`
- `02__Src__AppModules/90__System__PageLayoutSystem/Na__PageLayoutSystem__Controls__Pc__.js`
- `02__Src__AppModules/90__System__PageLayoutSystem/Na__PageLayoutSystem__Controls__TouchScreen__.js`
- `02__Src__AppModules/90__System__PageLayoutSystem/Na__PageLayoutSystem__Layout__.html`
- `02__Src__AppModules/90__System__PageLayoutSystem/Na__PageLayoutSystem__PdfExport__A3__.js`
- `02__Src__AppModules/90__System__PageLayoutSystem/Na__PageLayoutSystem__Styles__Main__.css`
- `02__Src__AppModules/90__System__PageLayoutSystem/Na__PageLayoutSystem__SystemLogic__Main__.js`

### 3D Feature Modules and Related Docs
- `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js`
- `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__README__.md`
- `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectInteraction__Animation__WalkMode__ProximityToOpenDoors__.js`
- `02__Src__AppModules/26__System__ToggleModelElements/3dObject__ViewBuildingStoreys__README__.md`
- `02__Src__AppModules/26__System__ToggleModelElements/3dObject__ViewBuildingStoreys__SystemLogic__.js`

### Test/Prototype Environment (contains many legacy strings)
- `80__Testing__PrototypeEnvironment/TestEnv__FlaskLocalServer.bat`
- `80__Testing__PrototypeEnvironment/TestEnv__FlaskLocalServer.py`
- `80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__DomAndLayout.html`
- `80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__Main__.js`
- `80__Testing__PrototypeEnvironment/TestEnv__README__.md`
- `80__Testing__PrototypeEnvironment/TestEnv__SubAppData__Config.json`
- `80__Testing__PrototypeEnvironment/Na__TestEnv__Styles__PrototypeSandbox__.css`
- `80__Testing__PrototypeEnvironment/TestEnv__CompletedFeaturesDocs/Test__ModelInteraction__Animation__ClickToOpenDoors__.md`
- `02__Src__AppModules/80__GenerateObjects/TestEnv__GenerateObjects__Minimal__.html`

### Documentation/Meta Files with Legacy Naming
- `DEPENDENCY_CHART.md`
- `Na__Architecture__ProjectStructure__PipelineMap__.md`
- `.cursor/rules/02-Description-Global-.mdc`
- `.cursorworkspace__ValeVision3D__.code-workspace`
- `.cursorworkspace__ValeVision3D__HomePc__.code-workspace`

### File Names Still Using Legacy Branding (rename candidates)
- `10__DistributionEmails/Distro__InviteEmailEmbedCard__ValeVision3d.html`
- `ValeVision__DEVLOG__.md`
- `ValeVision__README__.md`
- `ValeVision__REPORT__.md`
- `ValeVision__TASKS__v1.9.7__Stylesheets__.mdh`
- `.cursorworkspace__ValeVision3D__.code-workspace`
- `.cursorworkspace__ValeVision3D__HomePc__.code-workspace`

### Suggested Rename Mapping (for consistency)
- `ValeVision` / `ValeVision3D` -> `TrueVision` / `TrueVision3D`
- `Vale Garden Houses` -> `Noble Architecture`
- Legacy short prefixes like `VV_` -> `Na__` / `Na_` / `na_` (context dependent)

### Notes
- Legacy naming still appears across both active runtime modules and historical/docs/test areas.
- Runtime-safe sequence recommended: update in-file runtime references first, then CSS/docs, then filenames.
- You confirmed archive/backups will be cleaned separately, so those were not treated as blockers in this report.

# -------------------------------------------------------------
*END OF FILE*