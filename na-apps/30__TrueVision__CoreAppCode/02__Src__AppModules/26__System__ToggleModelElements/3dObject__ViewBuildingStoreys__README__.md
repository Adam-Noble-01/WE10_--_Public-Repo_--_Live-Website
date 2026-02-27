# Building Storey Visibility System - Technical Documentation
# =============================================================================

**Feature:** Per-Storey Visibility Control for TrueVision3D  
**Created:** 15-Feb-2026  
**Author:** Adam Noble - Noble Architecture  

---

## Overview

The Building Storey Visibility System enables per-storey visibility control for multi-storey building models, creating a "dolls house" cut-away view for interior exploration. Users can toggle individual storeys on/off, view specific storey ranges, and control roof visibility independently.

**Key Features:**
- Automatic storey detection from GLB model filenames
- Individual storey visibility toggle
- "Show only below" dolls house mode (interior view)
- Intelligent roof management (solid building vs cut-away view)
- Roof models auto-detected and controlled separately
- Stateful module with clean public API

---

## Quick Start

**1. Model Setup in SketchUp:**
- Tag storey containers with `90__Storey__GroundFloor`, `91__Storey__FirstFloor`, etc.
- Place storey children (walls, floors, roofs, etc.) on element tags (21-25 for Proposed, 11-15 for Existing)
- Export using TrueVision GLB Builder Utility v1.6.0+

**2. Export from SketchUp:**
- Extensions → TrueVision GLB Builder → Export GLBs
- Generates storey-prefixed GLBs: `Storey__GroundFloor__ProposedWalls__MeshModel__.glb`, etc.

**3. TrueVision3D Integration:**
```javascript
import * as Na__StoreySystem from '././3dObject__ViewBuildingStoreys__SystemLogic__.js';

// After models are loaded
const hasStoreys = Na__StoreySystem__DetectStoreys(modelGroupRoot);

if (hasStoreys) {
    // Get state for UI rendering
    const state = Na__StoreySystem__GetState();
    
    // Build your UI using state.order, state.map, etc.
    buildStoreyUI(state);
}
```

---

## Integration Guide

### Module Location
**File:** [`26__System__ToggleModelElements/3dObject__ViewBuildingStoreys__SystemLogic__.js`](./3dObject__ViewBuildingStoreys__SystemLogic__.js)

### Configuration

Optional configuration object passed to `Initialize`:

```javascript
const config = {
    storeyOrder: ['GroundFloor', 'FirstFloor', 'SecondFloor', 'ThirdFloor'],  // Storey order (bottom to top)
    defaultRoofVisible: true                                                    // Default roof state (true = solid building, false = dolls house)
};

Na__StoreySystem__Initialize(modelGroupRoot, config);
```

### Basic Integration Pattern

```javascript
// 1. Import module
import * as Na__StoreySystem from '././3dObject__ViewBuildingStoreys__SystemLogic__.js';

// 2. After GLB models load
Na__StoreySystem__DetectStoreys(sceneModelGroup);

// 3. Get state for UI
const state = Na__StoreySystem__GetState();

if (state.hasStoreys) {
    // 4. Build UI panel
    renderStoreyPanel(state);
    
    // 5. Wire up controls
    storeyButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            Na__StoreySystem__ToggleStorey(btn.dataset.storeyKey);
            updateUI();  // Refresh your UI
        });
    });
}
```

### Test Environment Integration

**File:** [`80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__Main__.js`](../80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__Main__.js)

```javascript
// Import
import * as Na__StoreySystem from './3dObject__ViewBuildingStoreys__SystemLogic__.js';

// After models load
Na__StoreySystem__DetectStoreys(TestEnv__ModelGroup__Root);
const state = Na__StoreySystem__GetState();

if (state.hasStoreys) {
    TestEnv__Storey__BuildStoreyPanel(state);     // Render UI
    TestEnv__Storey__ApplyRoofLogic();            // Apply initial roof visibility
}

// Toggle handlers
function TestEnv__Storey__ToggleStorey(storeyKey) {
    Na__StoreySystem__ToggleStorey(storeyKey);    // Module call
    TestEnv__Storey__UpdatePanelUI();             // Update UI
}
```

---

## Public API Reference

### Detection and Initialization

#### `Na__StoreySystem__Initialize(modelGroupRoot, config = {})`
Initializes the storey system with optional configuration.
- **Params**: 
  - `modelGroupRoot` (THREE.Group): Root group containing loaded GLB models
  - `config` (Object): Optional configuration (storeyOrder, defaultRoofVisible)
- **Returns**: `Boolean` - true if storeys detected

#### `Na__StoreySystem__DetectStoreys(modelGroupRoot)`
Detects storey-based models from GLB filenames and builds internal state.
- **Params**: `modelGroupRoot` (THREE.Group)
- **Returns**: `Boolean` - true if storeys detected

### Visibility Control

#### `Na__StoreySystem__SetStoreyVisibility(storeyKey, visible)`
Sets visibility for a specific storey (all models belonging to that storey).
- **Params**:
  - `storeyKey` (String): e.g., "GroundFloor", "FirstFloor"
  - `visible` (Boolean): true = show, false = hide

#### `Na__StoreySystem__ShowOnlyBelow(storeyKey)`
Dolls house mode: shows selected storey and all below, hides above.
- **Params**: `storeyKey` (String): Target storey level

#### `Na__StoreySystem__ShowAll()`
Shows all storeys (entire building view).

#### `Na__StoreySystem__ToggleStorey(storeyKey)`
Toggles visibility of a specific storey.
- **Params**: `storeyKey` (String)

#### `Na__StoreySystem__ToggleRoof()`
Toggles roof visibility mode:
- `true` = All roofs visible (solid building)
- `false` = Dolls house mode (topmost roof hidden, lower roofs as ceilings)

### State Access

#### `Na__StoreySystem__GetState()`
Returns current storey system state (read-only).
- **Returns**: Object with properties:
  - `map` (Object): `{ "GroundFloor": [models...], ... }`
  - `order` (Array): Ordered storey names (bottom to top)
  - `hasStoreys` (Boolean): True if storeys detected
  - `visibleState` (Object): `{ "GroundFloor": true, ... }`
  - `roofMap` (Object): `{ "GroundFloor": [roofModels...], ... }`
  - `roofVisible` (Boolean): Current roof mode state

#### `Na__StoreySystem__GetStoreyDisplayName(storeyKey)`
Converts storey key to human-readable display name.
- **Params**: `storeyKey` (String): e.g., "GroundFloor"
- **Returns**: `String` - e.g., "Ground Floor"

---

## Naming Convention

### GLB Filename Pattern
**Storey models:** `{Prefix}Storey__{StoreyName}__{ElementType}__{Suffix}.glb`

**Examples:**
- `Rowbotham__Storey__GroundFloor__ProposedWalls__MeshModel__.glb`
- `Rowbotham__Storey__GroundFloor__ProposedFloors__MeshModel__.glb`
- `Rowbotham__Storey__FirstFloor__ProposedRoofs__MeshModel__.glb`

### Roof Detection
Models with **"Roof"** substring in name are automatically classified as roof models:
- `ProposedRoofs` - Proposed building roofs
- `ExistingRoofs` - Existing building roofs

---

## Roof Visibility Logic

### Solid Building Mode (Default)
`roofVisible = true`
- All roofs visible
- Complete exterior building view
- Best for reviewing overall massing and proportions

### Dolls House Mode
`roofVisible = false`
- Topmost visible storey: roof hidden (reveals interior)
- Lower visible storeys: roofs shown (act as ceilings/floor separation)
- Creates architectural section cut-away view
- Perfect for interior exploration and spatial understanding

**Example Flow:**
1. All storeys visible, roofs ON → Complete solid building
2. Click Roof button → Roofs OFF, top storey roof hidden (see inside top floor)
3. Hide First Floor → Ground floor roof hidden (now topmost visible), Second floor roof shown
4. Right-click Ground Floor → Show only Ground Floor, its roof hidden (pure interior view)

---

## Technical Details

### State Management
- Module maintains internal state (not exported directly)
- State changes via public API functions only
- `GetState()` provides read-only snapshot for UI rendering
- Stateful design enables consistent behavior across calls

### Transform Requirements
- Requires storey-based GLBs exported with correct world-space transforms
- SketchUp GLB Builder v1.6.0+ ensures storey container transforms are baked correctly
- Models load at correct vertical positions (Ground Floor at origin, First Floor elevated, etc.)

### Performance
- Detection scans model names once (O(n) where n = loaded models)
- Visibility changes operate on small filtered sets (O(k) where k = models per storey)
- Roof logic scans only detected roof models (O(m) where m = roof models)

### Backward Compatibility
- Non-storey models (flat export) are ignored gracefully
- Module reports "No storey-based models detected" and `hasStoreys = false`
- Caller can check `hasStoreys` flag to conditionally show/hide UI

---

## Example: Full Integration

```javascript
import * as Na__StoreySystem from '././3dObject__ViewBuildingStoreys__SystemLogic__.js';

// After models load
async function onModelsLoaded(modelGroupRoot) {
    // Initialize with config
    const config = {
        storeyOrder: ['GroundFloor', 'FirstFloor', 'SecondFloor'],
        defaultRoofVisible: true  // Start with solid building view
    };
    
    const hasStoreys = Na__StoreySystem__Initialize(modelGroupRoot, config);
    
    if (!hasStoreys) {
        console.log('No storey models detected, skipping storey UI');
        return;
    }
    
    // Get state for UI
    const state = Na__StoreySystem__GetState();
    
    // Build UI
    const panel = document.getElementById('storeyPanel');
    panel.style.display = 'block';
    
    // Create storey buttons
    for (const storeyKey of state.order.reverse()) {  // Display top to bottom
        const btn = document.createElement('button');
        btn.textContent = Na__StoreySystem__GetStoreyDisplayName(storeyKey);
        btn.dataset.storeyKey = storeyKey;
        
        // Toggle on click
        btn.addEventListener('click', () => {
            Na__StoreySystem__ToggleStorey(storeyKey);
            updateButtonStates();
        });
        
        // Dolls house mode on right-click
        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            Na__StoreySystem__ShowOnlyBelow(storeyKey);
            updateButtonStates();
        });
        
        panel.appendChild(btn);
    }
    
    // Roof toggle button
    const roofBtn = document.getElementById('roofToggle');
    roofBtn.addEventListener('click', () => {
        Na__StoreySystem__ToggleRoof();
        updateButtonStates();
    });
    
    // Show all button
    const showAllBtn = document.getElementById('showAll');
    showAllBtn.addEventListener('click', () => {
        Na__StoreySystem__ShowAll();
        updateButtonStates();
    });
}

function updateButtonStates() {
    const state = Na__StoreySystem__GetState();
    
    // Update storey button visual states
    document.querySelectorAll('[data-storey-key]').forEach(btn => {
        const key = btn.dataset.storeyKey;
        const visible = state.visibleState[key];
        btn.classList.toggle('active', visible);
    });
    
    // Update roof button state
    const roofBtn = document.getElementById('roofToggle');
    roofBtn.textContent = state.roofVisible ? '🏠 Roofs On' : '🚫 Dolls House';
}
```

---

## Configuration Options

### Storey Order
Defines the vertical order of storeys (bottom to top).

```javascript
storeyOrder: ['GroundFloor', 'FirstFloor', 'SecondFloor', 'ThirdFloor']
```

Detected storeys not in this list are appended to the end.

### Default Roof Visibility
Controls initial roof visibility mode.

```javascript
defaultRoofVisible: true   // Solid building (all roofs visible)
defaultRoofVisible: false  // Dolls house mode (topmost roof hidden)
```

---

## Filename Pattern Requirements

### Storey Container Pattern
GLB filenames must contain: `Storey__{StoreyName}__`

**Supported storey names:**
- `GroundFloor`
- `FirstFloor`
- `SecondFloor`
- `ThirdFloor`
- Any custom name (auto-detected)

### Element Type Examples
- `Storey__GroundFloor__ProposedWalls__MeshModel__.glb`
- `Storey__GroundFloor__ProposedFloors__MeshModel__.glb`
- `Storey__GroundFloor__ProposedRoofs__MeshModel__.glb` (auto-detected as roof)
- `Storey__FirstFloor__ProposedWindows__MeshModel__.glb`
- `Storey__FirstFloor__ProposedDoors__LineworkModel__.glb`

### Non-Storey Models
Models without `Storey__` pattern are ignored by the system:
- `NaModel__LandscapeEnvironment__MeshModel__.glb`
- `NaModel__MainBuildingModel__Proposed__MeshModel__.glb`
- `01__OrbitHelperCube__MeshModel__.glb`

---

## Architecture

### Separation of Concerns

**Module Responsibilities (Pure Logic):**
- Storey detection from model names
- Roof model detection and filtering
- Internal state management
- Visibility control algorithms
- Intelligent roof visibility logic

**Caller Responsibilities (UI Integration):**
- DOM manipulation (panels, buttons, labels)
- Configuration loading from JSON
- UI event handling
- Visual feedback (icons, colors, animations)

### State Management

The module maintains internal state:
- `map`: Storey to models mapping
- `order`: Ordered storey list (bottom to top)
- `visibleState`: Per-storey visibility flags
- `roofMap`: Storey to roof models mapping
- `roofVisible`: Current roof mode

Callers access state via `GetState()` for UI rendering. State changes via public API functions only.

---

## User Experience Flow

1. **Initial load**: All storeys visible, all roofs visible (solid building)
2. **Click storey button**: Toggle that storey visibility, roof logic auto-applies
3. **Right-click storey button**: Show only that storey and below (dolls house cut at that level)
4. **Click Roof button**: Toggle between solid building (all roofs) and dolls house (topmost hidden)
5. **Click "Show Entire Building"**: Restore all storeys, current roof mode preserved

---

## SketchUp Export Requirements

### Tag Structure

**Storey containers (top-level):**
- `90__Storey__GroundFloor`
- `91__Storey__FirstFloor`
- `92__Storey__SecondFloor`
- `93__Storey__ThirdFloor`

**Element children (inside storey containers):**
- `21__ProposedBuilding__Walls`
- `22__ProposedBuilding__Floors`
- `23__ProposedBuilding__Roofs`
- `24__ProposedBuilding__Windows`
- `25__ProposedBuilding__Doors`

### Export Tool
Requires **TrueVision GLB Builder Utility v1.6.0+**
- Detects storey containers at model root
- Organizes children by element tags
- Exports per-storey per-element GLB files
- Bakes storey container transforms into world space

---

## Troubleshooting

### "No storey-based models detected"
- Check GLB filenames contain `Storey__` pattern
- Verify storey name format: `GroundFloor`, `FirstFloor` (camelCase, no spaces)
- Ensure models exported from SketchUp with GLB Builder v1.6.0+

### Storeys appear at wrong positions
- Verify GLB Builder v1.6.0+ used (earlier versions lacked storey transform baking)
- Check storey containers in SketchUp have correct transformations
- Re-export GLBs from SketchUp

### Roof visibility not working
- Check roof model names contain "Roof" substring
- Verify roof models are children of storey containers (tagged 23 or 13)
- Console should log "[Storey System] {StoreyName}: {N} roof model(s) detected"

---

## Advanced Usage

### Custom Storey Order
Support buildings with non-standard floor naming:

```javascript
const config = {
    storeyOrder: ['Basement', 'GroundFloor', 'FirstFloor', 'Penthouse']
};
Na__StoreySystem__Initialize(modelGroupRoot, config);
```

### Programmatic Control
Hide specific storey ranges:

```javascript
// Hide second floor and above
Na__StoreySystem__ShowOnlyBelow('FirstFloor');

// Show only ground floor (interior view)
Na__StoreySystem__ShowOnlyBelow('GroundFloor');

// Restore entire building
Na__StoreySystem__ShowAll();
```

### UI Synchronization
Use state to drive UI updates:

```javascript
function syncUI() {
    const state = Na__StoreySystem__GetState();
    
    // Update storey buttons
    for (const storeyKey of state.order) {
        const btn = document.querySelector(`[data-storey="${storeyKey}"]`);
        const isVisible = state.visibleState[storeyKey];
        btn.classList.toggle('visible', isVisible);
        btn.querySelector('.icon').textContent = isVisible ? '👁' : '🚫';
    }
    
    // Update roof button
    const roofBtn = document.getElementById('roofBtn');
    roofBtn.textContent = state.roofVisible ? '🏠 Solid' : '🏠 Dolls House';
}
```

---

## Future Enhancements

- **Animation support**: Smooth fade transitions when toggling storeys
- **Keyboard shortcuts**: Q/W/E for quick storey switching
- **Preset views**: Save/restore favorite storey visibility configurations
- **URL state**: Persist storey visibility in URL query parameters
- **Exploded view**: Vertical offset separation mode (storeys spaced apart)

---

## References

- **SketchUp GLB Builder**: [`Na__TrueVision__GlbBuilder__Doc__ReadMe__.md`](../../../../../../Users/Administrator/AppData/Roaming/SketchUp/SketchUp%202026/SketchUp/Plugins/Na__TrueVision__WhitecardModel__GlbBuilderUtility__Modules__/Na__TrueVision__GlbBuilder__Doc__ReadMe__.md)
- **Door Animation System**: [`25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__README__.md`](../25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__README__.md)
- **Test Environment**: [`80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__Main__.js`](../80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__Main__.js)

