# TrueVision3D - Prototype Testing Environment
# ---------------------------------------------------------

## Purpose
- This subproject provides a sandboxed, self-contained environment for quickly developing and experimenting with new TrueVision3D features before integrating them into the main codebase. 
- The goal is to speed up isolated feature development, test interactions, and debug with greater agility.


## Folder Structure
- This is a base structure for the prototype testing environment.
- New scripts may be added for testing specific features or interactions.
```
TrueVision3D/  # Main project folder (1 LEVEL UP FROM THIS FOLDER)
â”‚
â”œâ”€â”€ 80__Testing__PrototypeEnvironment/                      # Sandbox folder in the main TrueVision3D project
   â””â”€â”€ TestEnv__GlbFiles/                                   # Local storage for .glb files 
   â”œâ”€â”€ TestEnv__PrototypeTestingSandbox__DomAndLayout.html  # HTML for the prototype sandbox UI/layout
   â”œâ”€â”€ TestEnv__PrototypeTestingSandbox__Main__.js          # Main JS logic for prototype sandbox
   â”œâ”€â”€ TestEnv__PrototypeTestingSandbox__Stylesheet.css     # CSS styling for prototype sandbox
   â”œâ”€â”€ TestEnv__SubAppData__Config.json                     # Configuration file for the prototype sandbox for enabling/disabling features / settings / etc
   â””â”€â”€ TestEnv__FlaskLocalServer.py                         # Flask server hosting the test environment
   â””â”€â”€ TestEnv__FlaskLocalServer.bat                        # Batch file to start the Flask server
   â””â”€â”€ TestEnv__CurrentFeatureTestScripts/                  # Folder for the current feature test scripts, keeps a clean separation of not yet validated features.
```

## `TestEnv__GlbFiles` Folder:
- Store local .glb models here for loading within the test environment.
- Loads any .glb files placed in this folder into the test environment.

# ---------------------------------------------------------
## How This Environment Works
- The testing environment runs separately from the main TrueVision3D application using its own local Flask server and port.
- Existing core engine scripts and controls from the parent TrueVision3D project are reused.
- GLB files are loaded from the local `glb-assets` folder (for easy offline testing and asset management).
- UI elements clearly indicate TESTING MODE at the top of the application.
- Keeps the "TEST ENVIRONMENT" banner active in the top left corner of the application to avoid confusing this workspace with production.


# ---------------------------------------------------------
## Key Features

### GLB Model Loader:
- LoadS ANY `.glb` models locally from the `TestEnv__GlbFiles` folder for experimentation and easy hot-reloading.

### Statistics Debug Overlay:
- Live performance and scene stats display panel in the top left corner of the application.
  - Reports the current frame rate, the number of meshes, and the number of vertices in the scene.

### Node Graph Explorer:
- On the right screen is a entire panel that is exposed by default but can be folded back against the right margin to maximise the viewport area.
- This panel contains a tree view to inspect the full scene node hierarchy of the loaded .glb.
- Toggle visibility of any node/mesh for model isolation and debugging.
- Default is all children of the root node are visible, the tree graph can be collapsed at each level to hide the children if needed.
- Toggle visibility of any node/mesh for model isolation and debugging.
- Shows the entire node hierarchy of the loaded .glb clearly to help diagnose problematic model hierarchies or meshes.

### Refresh Models Button:
- Located in the Node Graph Explorer panel header (orange button with circular arrow icon).
- Click to reload all GLB models from the `TestEnv__GlbFiles` folder without resetting the camera position.
- Useful during development when updating model files - no need to refresh the entire browser.
- Preserves your current camera position and orbit target for seamless iteration.
- Automatically cleans up old model data and rebuilds the node tree.

### Single source of engine code:
- All modules related to the base render engine PC controls are passed through from the established TrueVision3D engine scripts.

# ---------------------------------------------------------

## Development Workflow
- Rapidly prototype and test new features in isolation without affecting the main TrueVision3D application.
- Once satisfied, migrate stable functions and features back into the main TrueVision3D codebase (one directory up).
- Use the node explorer and toggle tools to diagnose problematic model hierarchies or meshes.
- Always preserve the use of existing engine code from the main TrueVision3D project to ensure rendering/controls remain consistent.





