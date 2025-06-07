# ValeDesignSuite - Camera Agent Tool

## Overview
The Camera Agent Tool is a SketchUp plugin that allows users to place camera agents (waypoint markers) in their 3D models. These agents store camera configuration data and serve as waypoints for creating virtual tours in Babylon JS-based GLB viewers.

## Purpose
This tool is the first step in a processing pipeline where:
1. Users place camera agents in their SketchUp model
2. Agents store position, orientation, and camera settings
3. Data is exported as JSON for use in web-based virtual tour applications
4. The GLB viewer reads these agents to create navigable virtual tours

## Features
- **Interactive Placement**: Click to place camera agents at any location
- **Visual Representation**: Agents show as semi-transparent red triangular figures with view cones
- **Dynamic Configuration**: Adjust camera settings like aspect ratio, lens mm, and field of view
- **Automatic Selection**: Click any agent to load its data into the configuration dialog
- **JSON Export**: Export all agents as a structured JSON file for downstream processing
- **Global Coordinates**: All positions use global SketchUp coordinates for consistency

## Agent Components
Each camera agent includes:
- **Person Triangle**: 650mm wide x 1800mm tall triangular representation
- **View Cone**: Shows camera direction and field of view
- **Camera Height**: Default 1700mm (eye level)
- **Semi-transparent Red**: 50% opacity for visibility without obstruction

## Usage

### Accessing the Tool
1. Go to **Extensions > Vale Design Suite > Vale Camera Agent Tool**
2. Or use the Camera Agent Tool toolbar button (if enabled)

### Placing Agents
1. Click "Place New Camera Agent" button
2. Move mouse to desired location
3. Click to place agent (direction faces away from current camera)
4. Agent is automatically selected after placement

### Configuring Agents
1. Select any camera agent in the model
2. The dialog automatically loads its configuration
3. Modify:
   - Agent Name
   - Waypoint Number (for tour sequencing)
   - Aspect Ratio (16:9, 4:3, 1:1, 21:9)
   - Camera Lens (14mm to 135mm)
   - Field of View (10° to 170°)
4. Click "Save Agent Data" to update

### Position Information
- Position displays in millimeters (X, Y, Z)
- Heading shows direction in degrees
- These values reflect global coordinates
- Position updates automatically if agent is moved

### Exporting Data
1. Click "Export All Agents to JSON"
2. Choose save location
3. JSON file includes:
   - Export metadata
   - All camera agents with full configuration
   - Ready for use in Babylon JS viewers

## JSON Structure
```json
{
  "exportInfo": {
    "exportDate": "2025-01-01 12:00:00",
    "modelName": "MyModel.skp",
    "exportedBy": "ValeDesignSuite Camera Agent Tool",
    "version": "1.0.0"
  },
  "cameraAgents": [
    {
      "agentId": "CAM001",
      "agentName": "Camera Agent CAM001",
      "waypointNumber": 1,
      "position": {
        "x": 1000,
        "y": 2000,
        "z": 1700
      },
      "direction": {
        "x": 1.0,
        "y": 0.0,
        "z": 0.0
      },
      "rotation": {
        "heading": 0.0,
        "pitch": 0.0,
        "roll": 0.0
      },
      "camera": {
        "aspectRatio": "16:9",
        "lensMm": 35,
        "fovDegrees": 60
      },
      "metadata": {
        "createdDate": "2025-01-01 12:00:00",
        "lastModified": "2025-01-01 12:00:00"
      }
    }
  ]
}
```

## Data Storage
- Agent data is stored in the model's dictionary (not individual components)
- Dictionary name: `ValeDesignSuite_CameraAgentData`
- Persists with the model file
- Survives component editing and transformations

## Integration with ValeDesignSuite
This tool integrates with the ValeDesignSuite serialization framework for reliable data persistence. It follows the same patterns as other ValeDesignSuite tools for consistency.

## Technical Notes
- Uses SketchUp's global coordinate system
- Avoids component local coordinates for accuracy
- HTML dialog uses ValeDesignSuite styling standards
- Implements selection observer for dynamic updates
- All dimensions internally converted between mm and inches

## Version
Current Version: 1.0.0

## Author
Adam Noble - Noble Architecture 