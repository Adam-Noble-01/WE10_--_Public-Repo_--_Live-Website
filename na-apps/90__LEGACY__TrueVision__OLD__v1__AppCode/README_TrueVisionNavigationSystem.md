# TrueVision 3D Navigation System Documentation

## Overview

TrueVision 3D is a web-based architectural visualization application built with Babylon.js that provides multiple navigation modes for viewing 3D models. The application features a modular navigation architecture that allows different navigation experiences to be enabled or disabled based on client needs.

## Navigation Modes

### 1. Waypoint Navigation Mode
- **Purpose**: Provides curated architectural tours with predefined viewpoints
- **Target Users**: Less tech-savvy clients who struggle with traditional 3D navigation
- **Features**:
  - Fixed waypoint positions loaded from `Data_-_CameraAgentData.json`
  - Next/Previous waypoint navigation buttons
  - 360-degree photo sphere viewing at each waypoint
  - Mouse/touch drag controls for looking around
  - Optional gyroscope/accelerometer controls for mobile devices
  - Smooth animated transitions between waypoints

### 2. Walk Navigation Mode
- **Purpose**: First-person ground-level navigation simulating walking through spaces
- **Target Users**: Clients who want to experience spaces at human scale
- **Features**:
  - WASD keyboard controls for movement
  - Mouse look for camera rotation
  - Gravity simulation and collision detection
  - Jump functionality (spacebar)
  - Run mode (shift key)
  - Configurable eye height and walk speed

### 3. Orbit Navigation Mode
- **Purpose**: Traditional 3D model examination with rotation around a central point
- **Target Users**: Clients familiar with 3D software or CAD viewers
- **Features**:
  - Mouse drag to rotate around model
  - Mouse wheel zoom in/out
  - Touch pinch-to-zoom support
  - Configurable zoom limits
  - Reset view functionality

### 4. Fly Navigation Mode
- **Purpose**: Free camera movement in 3D space for unrestricted exploration
- **Target Users**: Advanced users and developers
- **Features**:
  - WASD keyboard controls for movement
  - Mouse look for camera rotation
  - No gravity or collision constraints
  - Configurable movement speed and sensitivity
  - Full 3D freedom of movement

## Configuration System

### Main Application Configuration (`Data_-_MainAppConfig.json`)

The application uses a JSON configuration file to control which navigation modes are available:

```json
{
    "appName": "TrueVision",
    "appVersion": "1.0.5",
    "AppConfig": {
        "devMode_Enabled": true,
        "AppConfig_NavMode": {
            "AppNavMode_Waypoint": {
                "NavMode_WaypointState": true,
                "NavMode_WaypointFile": "NavMode_WaypointNavigationSystemLogic.js",
                "NavMode_WaypointDataFile": "Data_-_CameraAgentData.json"
            },
            "AppNavMode_Walk": {
                "NavMode_WalkState": false,
                "NavMode_WalkFile": "NavMode_WalkNavigationSystemLogic.js"
            },
            "AppNavMode_Orbit": {
                "NavMode_OrbitState": false,
                "NavMode_OrbitFile": "NavMode_OrbitNavigationSystemLogic.js"
            },
            "AppNavMode_Fly": {
                "NavMode_FlyState": false,
                "NavMode_FlyFile": "NavMode_FlyNavigationSystemLogic.js"
            }
        }
    }
}
```

### Camera Agent Data (`Data_-_CameraAgentData.json`)

Waypoint navigation uses camera position data exported from SketchUp:

```json
{
    "exportInfo": {
        "exportDate": "2025-06-07 13:34:39",
        "exportedBy": "ValeDesignSuite Camera Agent Tool",
        "version": "1.0.0"
    },
    "cameraAgents": [
        {
            "agentId": "CAM001",
            "agentName": "Camera Agent CAM001",
            "waypointNumber": 1,
            "position": { "x": 4510.15, "y": 905.17, "z": 1700.0 },
            "direction": { "x": -0.235, "y": 0.972, "z": 0.0 },
            "camera": {
                "aspectRatio": "4:3",
                "lensMm": 28,
                "fovDegrees": 60
            }
        }
    ]
}
```

## File Structure

```
Root_TrueVisionApp/
├── Index.html                                    # Main application file
├── StyleSheet_TrueVisionCoreAppStyles.css        # Application styles
├── Data_-_MainAppConfig.json                    # App configuration
├── Data_-_CameraAgentData.json                  # Waypoint positions
├── NavMode_WaypointNavigationSystemLogic.js     # Waypoint navigation module
├── NavMode_WalkNavigationSystemLogic.js         # Walk navigation module
├── NavMode_OrbitNavigationSystemLogic.js        # Orbit navigation module
├── NavMode_FlyNavigationSystemLogic.js          # Fly navigation module
├── RenderEffect_SsaoAmbientOcclusionEffect.js   # SSAO rendering effect
└── README_TrueVisionNavigationSystem.md         # This documentation
```

## Usage Examples

### Example 1: Simple Waypoint-Only Configuration
For elderly clients or those unfamiliar with 3D navigation:
```json
{
    "AppNavMode_Waypoint": { "NavMode_WaypointState": true },
    "AppNavMode_Walk": { "NavMode_WalkState": false },
    "AppNavMode_Orbit": { "NavMode_OrbitState": false },
    "AppNavMode_Fly": { "NavMode_FlyState": false }
}
```

### Example 2: Traditional 3D Viewing
For clients familiar with 3D software:
```json
{
    "AppNavMode_Waypoint": { "NavMode_WaypointState": false },
    "AppNavMode_Walk": { "NavMode_WalkState": false },
    "AppNavMode_Orbit": { "NavMode_OrbitState": true },
    "AppNavMode_Fly": { "NavMode_FlyState": true }
}
```

### Example 3: Full Navigation Suite
For tech-savvy clients or demonstrations:
```json
{
    "AppNavMode_Waypoint": { "NavMode_WaypointState": true },
    "AppNavMode_Walk": { "NavMode_WalkState": true },
    "AppNavMode_Orbit": { "NavMode_OrbitState": true },
    "AppNavMode_Fly": { "NavMode_FlyState": true }
}
```

## Technical Architecture

### Module Structure
Each navigation mode is implemented as a self-contained module with:
- Namespace: `window.TrueVision3D.NavigationModes.[ModuleName]`
- Public API methods:
  - `initialize(scene, canvas)` - Set up the navigation mode
  - `enable()` - Activate this navigation mode
  - `disable()` - Deactivate this navigation mode
  - `getCamera()` - Get the Babylon.js camera instance
  - `reset()` - Reset camera to default position
  - `dispose()` - Clean up resources
  - `isEnabled()` - Check if mode is currently active

### Loading Sequence
1. Load application configuration (`Data_-_MainAppConfig.json`)
2. Load navigation module scripts based on configuration
3. Initialize Babylon.js scene and environment
4. Initialize enabled navigation modes
5. Activate first available navigation mode
6. Show/hide UI buttons based on available modes

### Integration with SketchUp
The waypoint data is generated by a SketchUp Ruby plugin that:
- Places camera agents in the 3D model
- Exports camera positions, rotations, and metadata
- Generates JSON file compatible with the web viewer
- Allows architects to define curated viewing paths

## Benefits

1. **Accessibility**: Waypoint mode makes 3D models accessible to users who struggle with traditional navigation
2. **Flexibility**: Enable/disable modes based on client capabilities
3. **Curation**: Architects can guide clients through key spaces
4. **Performance**: Fixed waypoints allow optimization of detail levels
5. **Consistency**: Standardized viewing experience across projects

