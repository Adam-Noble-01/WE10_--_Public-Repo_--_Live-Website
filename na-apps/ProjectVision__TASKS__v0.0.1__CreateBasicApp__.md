# NEW APPLICATION: Project Vision
# =========================================================

## BACKGROUND 
- I currently have three separate web applications for my architectural business.
- I need a main application to serve as a landing page for projects with links to the 3 seperate Sub applications used.

## MY PROBLEM
- To Clients my current offering of 3 different applications appears as a disjointed collection of apps

## OBJECTIVE
- I need to build a single landing style app page for each project and I want it to have three simple button cards, one for each of the sub applications.

## NEW FILES 
`\05__ProjectVision__CoreAppCode\index.html`  =  The main landing page for the Project Vision app, will be driven dynamically by the URL Query System.
    - Button behavour based on whether Content exists in the sub applications.
`\05__ProjectVision__CoreAppCode\02__Src__AppModules\Na__AppUtils__UrlQuerySystem.js`  =  The URL Query System for the Project Vision app.
`ProjectVision-WebApp.html` = A simple redirect to Porject Vision (Allows for a nice easy URL rather than having to type in the full URL of the core app)
  - Redirects to `\05__ProjectVision__CoreAppCode\index.html` and must pass URL project code as a query parameter to the core app.


## BUTTON BEHAVIOUR
- The build script detailed later in this document will add additional data attributes to the individual project config files as the buttons should be grayed out if no PlanVision or Truevision files exist during the build script seeking and updating.


## STYLING 
- I will create three topical graphics for each of the buttons just use a placeholder for now and text for each and make these three cards centered creating both a landscape contextual aware version and a portrait contextual aware version. Intuitive quick to comprehend styling and design is crucial to ensure the users can select the correct button and launch the correct sub app.
- Create a styleshets in the style of these files: `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\03__Style__AppStylesheets` and use similar naming conventions and code structure.
- You have freedom to experiment with the styling and design to ensure the users can easily identify and select the correct button and launch the correct sub app.


## SUB APPLICATIONS 
*Project Admin*
- This is a live application that has a password protection as soon as it's loaded and allows clients to log in and view quotations in terms and conditions 
- Sub Directory for this app `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\10__NaProjectAdmin__DocumentSystem__CoreAppCode`
- It already has a URL query system loading projects.

*PlanVision*
- A application specifically for viewing 2D documentation it already has systems set up etc and a URL query system.
- Sub Directory for this app `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\20__PlanVision__CoreAppCode`

*TrueVision 3D*
- A 3D model viewer system allowing flights to see their architectural models of the building and their scheme. 
- Sub Directory for this app  `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode`


# -----------------------------------------------------------------------------
## URL Query System
- URL Query System will be driven by the data in the `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\05__AppData\ProjectVision__MasterProjectIndex__Core__.json` file.
- The URL Query System will be used to load the correct project data files and sub applications.
- The URL Query System will be used to load the correct project name and project code.
- The URL Query System will be used to load the correct project data files and sub applications.
- The URL Query System will be used pass the correct project code to the sub applications in their own URL query systems. 
Here is the placeholder file for the URL Query System:
`05__ProjectVision__CoreAppCode/02__Src__AppModules/Na__AppUtils__UrlQuerySystem.js`

# -----------------------------------------------------------------------------
## NEW ADVANCED MULTI-APPLICATION PYTHON BUILD SCRIPT
- We need to build a comprehensive Project Vision build python script which scans my local system `D:\WE10_--_Public-Repo_--_Live-Website\na-project-portal` for project config data files and updates the Project Vision app with the project data in a manner similar to the Project Admin app where it knows the project name etc.
- We should probably retire the previous build script from the Admin Tool as this new script should be more comprehensive and handle building all three sub apps.
- It should serve as a validation tool to map the project struture on my local system to the Json config data files in the `D:\WE10_--_Public-Repo_--_Live-Website\na-project-portal` directory.

### NEW ADVANCED MULTI-APPLICATION PYTHON BUILD SCRIPT
- Builds a maps of the project structure on my local system to the Json config data files in the `D:\WE10_--_Public-Repo_--_Live-Website\na-project-portal` directory. 
- Has the ability to read and edit the Json config data files per project in the project portal directory.
 - Reading of this data is useful for downstream applications to know the project name, URLs, loading configs etc, so load ahead of time.
    `D:\WE10_--_Public-Repo_--_Live-Website\na-project-portal\26-Projects\AA00__ExampleProjectStructure\10__ProjectAdmin__AppContent\ProjectAdmin__ProjectConfig__.json`
    `D:\WE10_--_Public-Repo_--_Live-Website\na-project-portal\26-Projects\AA00__ExampleProjectStructure\20__PlanVision__AppContent\PlanVision__ProjectData__.json`
    `D:\WE10_--_Public-Repo_--_Live-Website\na-project-portal\26-Projects\AA00__ExampleProjectStructure\30__TrueVision__AppContent\TrueVision__ProjectData__.json`

- Keeps a project Index of all projects in the `D:\WE10_--_Public-Repo_--_Live-Website\na-project-portal` directory.
- Saves them to `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\05__ProjectVision__CoreAppCode\05__AppData\ProjectVision__MasterProjectIndex__Core__.json`
- Refer to `"D:\WE10_--_Public-Repo_--_Live-Website\na-apps\.cursor\rules\07-Project-Code-Format-And-Naming-Conventions.mdc"` for the project code format and naming conventions.
- Project codes are used to identify the project and are used to load the correct project data files and sub applications.
- The web version and the local host version will use URL Query System to load the correct project data files and sub applications.

### Example Of A LocalProject Structure
`D:\WE10_--_Public-Repo_--_Live-Website\na-project-portal\26-Projects\NP03__AshnessClose`
```CurrentStructureOfAProject
NP03__AshnessClose/
├── 01__Archive/
│
├── 10__ProjectAdmin__AppContent/
│   ├──── ProjectAdmin__ProjectConfig__.json
│   ├──── ProjectAdmin__Quotation__.json
│   ├──── ProjectAdmin__SpecialTerms__.json
│   ├──── SpecialTerms__building-regulations__.json
│   └──── SpecialTerms__planning-approval__.json
│
├── 20__PlanVision__AppContent/
|   |
│   ├──── DesignPhase01__ConceptDesign__Content/
│   |      └──── NP03_T01_D01__TestConceptPlan__RevA__.pdf
│   |      └──── NP03_T01_D01__TestConceptPlan__RevA__.png
|   |
│   ├──── DesignPhase02__PlanningApproval__Content
│   |      └──── NP03_T02_D11__TestPlanningApproval__RevA__.pdf
│   |      └──── NP03_T02_D11__TestPlanningApproval__RevA__.png
|   |
│   ├──── DesignPhase03__BuildingRegs__Content/
|   |      └──── NP03_T03_D21__TestBuildingRegs__RevA__.pdf
|   |      └──── NP03_T03_D21__TestBuildingRegs__RevA__.png
|   |
│   └──── PlanVision__ProjectData__.json
│
└── 30__TrueVision__AppContent/
    └──── TrueVisionContent__FilesHere__.txt
    |
    ├──── DesignPhase01__ConceptDesign__ExistingBuilding/
    |      └──── NP03__01__OrbitHelperCube__MeshModel__.glb
    |      └──── NP03__NaModel__LandscapeEnvironment__LineworkModel__.glb
    |      └──── NP03__NaModel__LandscapeEnvironment__MeshModel__.glb
    |      └──── NP03__Storey__FirstFloor__ExistingDoors__LineworkModel__.glb
    |      └──── NP03__Storey__FirstFloor__ExistingDoors__MeshModel__.glb
    |      └──── NP03__Storey__FirstFloor__ExistingFloors__LineworkModel__.glb
    |      └──── NP03__Storey__FirstFloor__ExistingFloors__MeshModel__.glb
    |      └──── NP03__Storey__FirstFloor__ExistingFurniture__LineworkModel__.glb
    |      └──── NP03__Storey__FirstFloor__ExistingFurniture__MeshModel__.glb
    |      └──── NP03__Storey__FirstFloor__ExistingStairs__LineworkModel__.glb
    |      └──── NP03__Storey__FirstFloor__ExistingStairs__MeshModel__.glb
    |      └──── NP03__Storey__FirstFloor__ExistingWalls__LineworkModel__.glb
    |      └──── NP03__Storey__FirstFloor__ExistingWalls__MeshModel__.glb
    |      └──── NP03__Storey__FirstFloor__ExistingWindows__LineworkModel__.glb
    |      └──── NP03__Storey__FirstFloor__ExistingWindows__MeshModel__.glb
    |      └──── NP03__Storey__GroundFloor__ExistingDoors__LineworkModel__.glb
    |      └──── NP03__Storey__GroundFloor__ExistingDoors__MeshModel__.glb
    |      └──── NP03__Storey__GroundFloor__ExistingFloors__LineworkModel__.glb
    |      └──── NP03__Storey__GroundFloor__ExistingFloors__MeshModel__.glb
    |      └──── NP03__Storey__GroundFloor__ExistingFurniture__LineworkModel__.glb
    |      └──── NP03__Storey__GroundFloor__ExistingFurniture__MeshModel__.glb
    |      └──── NP03__Storey__GroundFloor__ExistingRoofs__LineworkModel__.glb
    |      └──── NP03__Storey__GroundFloor__ExistingRoofs__MeshModel__.glb
    |      └──── NP03__Storey__GroundFloor__ExistingWalls__LineworkModel__.glb
    |      └──── NP03__Storey__GroundFloor__ExistingWalls__MeshModel__.glb
    |      └──── NP03__Storey__GroundFloor__ExistingWindows__LineworkModel__.glb
    |      └──── NP03__Storey__GroundFloor__ExistingWindows__MeshModel__.glb
    |      └──── NP03__Storey__SecondFloor__ExistingDoors__LineworkModel__.glb
    |      └──── NP03__Storey__SecondFloor__ExistingDoors__MeshModel__.glb
    |      └──── NP03__Storey__SecondFloor__ExistingFloors__LineworkModel__.glb
    |      └──── NP03__Storey__SecondFloor__ExistingFloors__MeshModel__.glb
    |      └──── NP03__Storey__SecondFloor__ExistingFurniture__LineworkModel__.glb
    |      └──── NP03__Storey__SecondFloor__ExistingFurniture__MeshModel__.glb
    |      └──── NP03__Storey__SecondFloor__ExistingRoofs__LineworkModel__.glb
    |      └──── NP03__Storey__SecondFloor__ExistingRoofs__MeshModel__.glb
    |      └──── NP03__Storey__SecondFloor__ExistingWalls__LineworkModel__.glb
    |      └──── NP03__Storey__SecondFloor__ExistingWalls__MeshModel__.glb
    |      └──── NP03__Storey__SecondFloor__ExistingWindows__LineworkModel__.glb
    |      └──── NP03__Storey__SecondFloor__ExistingWindows__MeshModel__.glb
    |      └──── NP03__Storey__SecondFloor__ExistingWindows__MeshModel__.glb   
    |
    ├──── DesignPhase01__ConceptDesign__Scheme-01
    |      └──── NP03__01__OrbitHelperCube__MeshModel__.glb
    |      └──── NP03__NaModel__LandscapeEnvironment__LineworkModel__.glb
    |      └──── NP03__NaModel__LandscapeEnvironment__MeshModel__.glb
    |      └──── NP03__Storey__FirstFloor__ProposedDoors__LineworkModel__.glb
    |      └──── NP03__Storey__FirstFloor__ProposedDoors__MeshModel__.glb
    |      └──── NP03__Storey__FirstFloor__ProposedFloors__LineworkModel__.glb
    |      └──── NP03__Storey__FirstFloor__ProposedFloors__MeshModel__.glb
    |      └──── NP03__Storey__FirstFloor__ProposedFurniture__LineworkModel__.glb
    |      └──── NP03__Storey__FirstFloor__ProposedFurniture__MeshModel__.glb
    |      └──── NP03__Storey__FirstFloor__ProposedStairs__LineworkModel__.glb
    |      └──── NP03__Storey__FirstFloor__ProposedStairs__MeshModel__.glb
    |      └──── NP03__Storey__FirstFloor__ProposedWalls__LineworkModel__.glb
    |      └──── NP03__Storey__FirstFloor__ProposedWalls__MeshModel__.glb
    |      └──── NP03__Storey__FirstFloor__ProposedWindows__LineworkModel__.glb
    |      └──── NP03__Storey__FirstFloor__ProposedWindows__MeshModel__.glb
    |      └──── NP03__Storey__GroundFloor__ProposedDoors__LineworkModel__.glb
    |      └──── NP03__Storey__GroundFloor__ProposedDoors__MeshModel__.glb
    |      └──── NP03__Storey__GroundFloor__ProposedFloors__LineworkModel__.glb
    |      └──── NP03__Storey__GroundFloor__ProposedFloors__MeshModel__.glb
    |      └──── NP03__Storey__GroundFloor__ProposedFurniture__LineworkModel__.glb
    |      └──── NP03__Storey__GroundFloor__ProposedFurniture__MeshModel__.glb
    |      └──── NP03__Storey__GroundFloor__ProposedRoofs__LineworkModel__.glb
    |      └──── NP03__Storey__GroundFloor__ProposedRoofs__MeshModel__.glb
    |      └──── NP03__Storey__GroundFloor__ProposedWalls__LineworkModel__.glb
    |      └──── NP03__Storey__GroundFloor__ProposedWalls__MeshModel__.glb
    |      └──── NP03__Storey__GroundFloor__ProposedWindows__LineworkModel__.glb
    |      └──── NP03__Storey__GroundFloor__ProposedWindows__MeshModel__.glb
    |      └──── NP03__Storey__SecondFloor__ProposedDoors__LineworkModel__.glb
    |      └──── NP03__Storey__SecondFloor__ProposedDoors__MeshModel__.glb
    |      └──── NP03__Storey__SecondFloor__ProposedFloors__LineworkModel__.glb
    |      └──── NP03__Storey__SecondFloor__ProposedFloors__MeshModel__.glb
    |      └──── NP03__Storey__SecondFloor__ProposedFurniture__LineworkModel__.glb
    |      └──── NP03__Storey__SecondFloor__ProposedFurniture__MeshModel__.glb
    |      └──── NP03__Storey__SecondFloor__ProposedRoofs__LineworkModel__.glb
    |      └──── NP03__Storey__SecondFloor__ProposedRoofs__MeshModel__.glb
    |      └──── NP03__Storey__SecondFloor__ProposedWalls__LineworkModel__.glb
    |      └──── NP03__Storey__SecondFloor__ProposedWalls__MeshModel__.glb
    |      └──── NP03__Storey__SecondFloor__ProposedWindows__LineworkModel__.glb
    |      └──── NP03__Storey__SecondFloor__ProposedWindows__MeshModel__.glb
    |      └──── NP03__Storey__SecondFloor__ProposedWindows__MeshModel__.glb    
    |
    └──── TrueVision__ProjectData__.json

```
# -----------------------------------------------------------------------------