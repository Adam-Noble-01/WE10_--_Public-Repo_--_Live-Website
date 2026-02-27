# NEW TEST FEATURE | Top Level Container Building Models By Storey
# =============================================================================

## Introduction
- Buildings are usually logically grouped by storey (Ground Floor, First Floor, Second Floor, etc.).
- This feature allows the user to toggle the visibility of all building models by storey.

### OBJECTIVE
 - Implement the ability to build the models by storey.
 - Update the SketchUp TrueVision GLB Plugin to support the new feature.
 - Add a new menu in the testing environment to allow the user to toggle the visibility of all building models by storey.
 - Build a robust prototype of this feature allowing the user to be able to switch off the visibility of certain floors to focus on a specific storey.
  - Think of it like a Dolls House view where the user can switch off the visibility of certain floors to focus on a specific storey.

## Key Downstream Features That Require Top Level Container Building Models By Storey
- The ability to toggle the visibility of all building models by storey.
  - Allows the user to be able to switch off the visibility of certain floors to focus on a specific storey.
    - *Example-01* "First Floor View" - Only the first floor models and ground floor models are visible, the roof in this case is hidden.
    - *Example-02* "Ground Floor View" - Only the ground floor models are visible, the first floor and roof in this case are hidden.

## Children Within This Container.
- Children within can include walls, floors, windows, doors, fixtures, furniture, roofs, etc.

## Implement Checks
- Right at the start of the loading process, check if the top level container by storey exists
  - If not run everything else as normal, sometimes exterior massing models have no interior models to group, so the top level container by storey is not needed.
- If the top level container by storey exists, then check if it has any children within it and build the model like so
So 

**IF**
    - The SketchUp Model has . . . 
      - Parent Group / Component Container At The Root Level Named (Example: `90__Storey__GroundFloor`)
      - or Parent Group / Component Container At The Root Level TAGGED (Layers In API) Like This (Example SketchUp Layer Name: `90__Storey__GroundFloor`)
**THEN**
    In SketchUp ModelLook for Tags (Layers) named like this:
    `21__ProposedBuilding__Walls`
    `22__ProposedBuilding__Floors`
    `23__ProposedBuilding__Roofs`
    `24__ProposedBuilding__Windows`
    `25__ProposedBuilding__Doors`
    `26__ProposedBuilding__Staircase`
    `07__Landscape`
**IF DETECTED THEN**
    - Build the file strings like so for the GLB Giles:
    - When building storeys are involved instead of `MainBuildingModel__` use `Storey__GroundFloor__` etc.
        `Na__NaModel__Storey__GroundFloor__ProposedWalls__MeshModel__.glb`
        `Na__NaModel__Storey__GroundFloor__ProposedWalls__LineworkModel__.glb`
        `Na__NaModel__Storey__GroundFloor__ProposedFloors__MeshModel__.glb`
        `Na__NaModel__Storey__GroundFloor__ProposedFloors__LineworkModel__.glb`
        `Na__NaModel__Storey__GroundFloor__ProposedRoofs__MeshModel__.glb`
        `Na__NaModel__Storey__GroundFloor__ProposedRoofs__LineworkModel__.glb`
        `Na__NaModel__Storey__GroundFloor__ProposedWindows__MeshModel__.glb`
        `Na__NaModel__Storey__GroundFloor__ProposedWindows__LineworkModel__.glb`
        `Na__NaModel__Storey__GroundFloor__ProposedDoors__MeshModel__.glb`
        `Na__NaModel__Storey__GroundFloor__ProposedDoors__LineworkModel__.glb`
        `Na__NaModel__Storey__GroundFloor__ProposedStairs__MeshModel__.glb`
        `Na__NaModel__Storey__GroundFloor__ProposedStairs__LineworkModel__.glb`
        `Na__NaModel__Storey__GroundFloor__LandscapeEnvironment__MeshModel__.glb`
        `Na__NaModel__Storey__GroundFloor__LandscapeEnvironment__LineworkModel__.glb`
**ELSE**
    - Build the models like so:
    - When building storeys are not used this usually means a simpler type of model is used such as a simple massing model or a simplified massing model,  So `MainBuildingModel__` is used instead of `Storey__GroundFloor__` etc.
        `Na__NaModel__MainBuildingModel__ProposedWalls__MeshModel__.glb`
        `Na__NaModel__MainBuildingModel__ProposedWalls__LineworkModel__.glb`
        `Na__NaModel__MainBuildingModel__ProposedFloors__MeshModel__.glb`
        `Na__NaModel__MainBuildingModel__ProposedFloors__LineworkModel__.glb`
        `Na__NaModel__MainBuildingModel__ProposedRoofs__MeshModel__.glb`
        `Na__NaModel__MainBuildingModel__ProposedRoofs__LineworkModel__.glb`

### Example Of A Simple Massing Model With No Storeys - IMPORTANT TO KEEP THIS FUNCTIONALITY IN PLACE
- In this example the SketchUp Model did not have any objects grouped within a parent group / component container tagged with a name like `90__Storey__GroundFloor` etc.
- So the SketchUp TrueVision GLB Plugin will not build the storeys and will instead build the models like so:
- Its important to keep this functionality in place for when the user wants to build a simple massing model with no storeys.
  - Secondarily changing this logic will break many old models that were built before Storeys (Top Level Container By Storey) feature was implemented.
`Na__NaModel__01__OrbitHelperCube__MeshModel__.glb`
`Na__NaModel__LandscapeEnvironment__LineworkModel__.glb`
`Na__NaModel__LandscapeEnvironment__MeshModel__.glb`
`Na__NaModel__MainBuildingModel__Existing__LineworkModel__.glb`
`Na__NaModel__MainBuildingModel__Existing__MeshModel__.glb`
`Na__NaModel__MainBuildingModel__Proposed__LineworkModel__.glb`
`Na__NaModel___MainBuildingModel__Proposed__MeshModel__.glb`


```ruby
# MODULE CONSTANTS | Tag Range Definitions for Segmentation
# ------------------------------------------------------------
# NOTE: 01__OrbitHelperCube Tag Purpose
# The SketchUp tag "01__OrbitHelperCube" is used by the Camera Orbit tool
# as the centre pivot point in the downstream Web 3D Model Viewer App.
# This allows precise control of the camera rotation center for better UX.
# ------------------------------------------------------------
TAG_RANGES = {
    "01__OrbitHelperCube"                         => [1],             # <-- Camera orbit pivot for Web 3D Viewer App
    "NaModel__LandscapeEnvironment"               => (7..9),          # <-- Landscape & Environment
    "NaModel__MainBuildingModel__Existing"        => (10),            # <-- Existing Main Building Flag (Used for a whole building in simplified Massing Models)
    "NaModel__MainBuildingModel__ExistingWalls"   => [11],            # <-- Existing Building Walls
    "NaModel__MainBuildingModel__ExistingFloors"  => [12],            # <-- Existing Building Floors 
    "NaModel__MainBuildingModel__ExistingRoofs"   => [13],            # <-- Existing Building Roofs (`These are used downstream for view by Storey Logic`)
    "NaModel__MainBuildingModel__ExistingWindows" => [14],            # <-- Existing Building Windows 
    "NaModel__MainBuildingModel__ExistingDoors"   => [15],            # <-- Existing Building Doors (Objects Also Use `ADR` Codes such as `ADR002__InternalDoor`)
    "NaModel__MainBuildingModel__ExistingStairs"  => [16],            # <-- Existing Building Staircases
    "NaModel__MainBuildingModel__ExistingOther"   => (17..19),        # <-- Existing Other Elements
    "NaModel__MainBuildingModel__Proposed"        => (20),            # <-- Proposed Main Building Flag (Used for a whole building in simplified Massing Models)
    "NaModel__MainBuildingModel__ProposedWalls"   => [21],            # <-- Proposed Building Walls
    "NaModel__MainBuildingModel__ProposedFloors"  => [22],            # <-- Proposed Building Floors 
    "NaModel__MainBuildingModel__ProposedRoofs"   => [23],            # <-- Proposed Building Roofs (`These are used downstream for view by Storey Logic`)
    "NaModel__MainBuildingModel__ProposedWindows" => [24],            # <-- Proposed Building Windows 
    "NaModel__MainBuildingModel__ProposedDoors"   => [25],            # <-- Proposed Building Doors (Objects Also Use `ADR` Codes such as `ADR002__InternalDoor`)
    "NaModel__MainBuildingModel__ProposedStairs"  => [26],            # <-- Proposed Building Staircases
    "NaModel__MainBuildingModel__ProposedOther"   => (27..29),        # <-- Proposed Other Elements
    "NaModel__GroundFloorFurniture"               => (30..38),        # <-- Ground Floor Furniture
    "NaModel__GroundFloorDecor"                   => [39],            # <-- Ground Floor High Detail
    "NaModel__FirstFloorFurniture"                => (40..48),        # <-- First Floor Furniture
    "NaModel__FirstFloorDecor"                    => [49],            # <-- First Floor High Detail
    "NaModel__Vegetation"                         => (50..59),        # <-- Vegetation
    "NaModel__SceneContextual"                    => (60..70)         # <-- Scene Context (people, vehicles)
    "NaModel__Storey__GroundFloor"                => (90)             # <-- Ground Floor Top Grouping Level
    "NaModel__Storey__FirstFloor"                 => (91)             # <-- First Floor Top Grouping Level
    "NaModel__Storey__SecondFloor"                => (92)             # <-- Second Floor Top Grouping Level
    "NaModel__Storey__ThirdFloor"                 => (93)             # <-- Third Floor Top Grouping Level

SKIP_RANGES             =   [0, 2, 3, 4, 5, 6]                        # <-- Ignored tags - DO NOT EXPORT (tag 01 is now exported as OrbitHelperCube)
MAX_NESTING_DEPTH       =   3                                         # <-- Maximum nesting depth for validation

# ------------------------------------------------------------
```

## SketchUp Tags For The Top Level Container By Storey Are Named Like This:
- *Note: The 90, 91, 92, etc. are the tags that are used to identify the storey.*
```SketchUpLayerNames
90__Storey__GroundFloor
91__Storey__FirstFloor
92__Storey__SecondFloor
```

# ----------------------------------------------------------
## Considerations 
- Perhaps update the search depth? i.e `MAX_NESTING_DEPTH       =   3 ` --> `MAX_NESTING_DEPTH       =   4 ` ??