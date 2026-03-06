# Door Animation System - Technical Documentation
# =============================================================================

**Feature:** Click-to-Open Door Animation for TrueVision3D  
**Created:** 14-Feb-2026  
**Author:** Adam Noble - Noble Architecture  

---

## Quick Start

**1. Model Setup in SketchUp:**
- Name door assemblies with `ADR` prefix (e.g., `ADR002__InternalDoor__GroundFloor__PorchToLounge`)
- Inside each ADR: create `MOD001__ROT__90-Deg__DoorPanel` or `MOD001__ROT__-90-Deg__DoorPanel` (rotating panel) and `ROT001__RotationPoint__DoorHingeCentre` (hinge pivot)
- Use a positive degree value (e.g. `90-Deg`) to open anticlockwise, or a negative value (e.g. `-90-Deg`) to open clockwise when viewed from above
- Place all doors on tag `25__ProposedBuilding__Doors`

**2. Export from SketchUp:**
- Extensions → TrueVision GLB Builder → Export GLBs
- Generates: `*__ProposedDoors__MeshModel__.glb` and `*__ProposedDoors__LineworkModel__.glb`

**3. TrueVision3D loads automatically:**
- Models detected by multi-model loader
- Door animation initializes if config enabled
- Click any door to open/close

---

## Integration (Main Application)

### Module Location
**File:** [`25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js`](./3dObjectIInteraction__Animation__ClickToOpenDoors__.js)

### Configuration
**File:** [`02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`](../02__AppData/Na__AppConfig__Main.json)

```json
{
    "3dObject__InteractionsSystem": {
        "3dObject__Interaction__DoorAnimation": {
            "3dObject__Interaction__DoorAnimation__Description"         : "Interactive door animation settings for click-to-open doors. Doors must be exported from SketchUp with ADR/MOD/ROT naming convention via GLB Builder v1.5.0+",
            "3dObject__Interaction__DoorAnimation__Enabled"             : true,
            "3dObject__Interaction__DoorAnimation__AnimationDurationMs" : 600,
            "3dObject__Interaction__DoorAnimation__DefaultRotationDeg"  : 90,
            "3dObject__Interaction__DoorAnimation__ClickThresholdPx"    : 4
        }
    }
}
```

### Main App Integration
**File:** [`index.html`](../index.html)

```javascript
// Import
import {
    Na__DoorAnimation__Initialize,
    Na__DoorAnimation__Update
} from '././3dObjectIInteraction__Animation__ClickToOpenDoors__.js';

// After models load (find door groups)
let doorMeshGroup = null;
let doorLineworkGroup = null;

Na__LoadedModelGroups.forEach((group, categoryKey) => {
    if (categoryKey.includes('ProposedDoors') && categoryKey.includes('MeshModel')) {
        doorMeshGroup = group;
    }
    if (categoryKey.includes('ProposedDoors') && categoryKey.includes('LineworkModel')) {
        doorLineworkGroup = group;
    }
});

// Initialize (if enabled and models exist)
if (Na__Config__DoorAnimation.DoorAnimation__Enabled !== false) {
    if (doorMeshGroup || doorLineworkGroup) {
        Na__DoorAnimation__Initialize(
            Na__Scene__Main,
            Na__Camera__Main,
            Na__Renderer__Main.domElement,
            doorMeshGroup,
            doorLineworkGroup,
            Na__Config__DoorAnimation
        );
    }
}

// Render loop (with delta time)
let Na__RenderLoop__PrevTimestamp = performance.now();
function Na__RenderLoop__Animate() {
    requestAnimationFrame(Na__RenderLoop__Animate);
    
    const now = performance.now();
    const deltaMs = now - Na__RenderLoop__PrevTimestamp;
    Na__RenderLoop__PrevTimestamp = now;
    
    Na__Navmode__UpdateNavigation();
    Na__DoorAnimation__Update(deltaMs);  // Update door animations
    
    if (Na__RenderComposer__Main && Na__RenderPipeline__State) {
        Na__RenderPipeline__State.renderProfileNormals();
        Na__RenderComposer__Main.render();
    }
}
```

---

## Naming Conventions

### ADR (Door Assembly)
- **Format:** `ADR###__[Description]`
- **Example:** `ADR002__InternalDoor__GroundFloor__PorchToLounge`
- **Purpose:** Top-level container for door assembly
- **3-Digit Code:** Unique identifier (001, 002, 003...)

### MOD (Modifier Object - Door Panel)
- **Format:** `MOD###__ROT__[N]-Deg__[Description]` or `MOD###__ROT__-[N]-Deg__[Description]`
- **Example (opens anticlockwise):** `MOD001__ROT__90-Deg__DoorPanel`
- **Example (opens clockwise):** `MOD001__ROT__-90-Deg__DoorPanel`
- **Purpose:** Contains all rotating geometry (panel, handles, etc.)
- **Required:** `__ROT__` tag and `[N]-Deg` pattern (positive or negative integer)
- **Parsed:** Rotation angle extracted by `/(-?\d+)-Deg/i` regex — negative values reverse the swing direction

### ROT (Rotation/Hinge Point)
- **Format:** `ROT###__[Description]`
- **Example:** `ROT001__RotationPoint__DoorHingeCentre`
- **Purpose:** Defines 3D pivot point for rotation (hinge location)
- **Note:** Can be empty (no geometry) — position vector used as pivot

---

## SketchUp Model Setup

```
SketchUp Model
├─ 25__ProposedBuilding__Doors (tag: 25__)
│  └─ ADR002__InternalDoor__GroundFloor__PorchToLounge ← Door assembly
│     ├─ MOD001__ROT__90-Deg__DoorPanel ← Rotating panel
│     │  ├─ [Door panel geometry]
│     │  ├─ [Door handle 1]
│     │  └─ [Door handle 2]
│     ├─ OuterShell ← Fixed frame (not animated)
│     │  └─ [Frame geometry]
│     └─ ROT001__RotationPoint__DoorHingeCentre ← Hinge pivot
```

**Entity Naming in SketchUp:**
1. Select group/component in Outliner
2. Right-click → Entity Info
3. Set **Instance Name** field to ADR/MOD/ROT format

---

## GLB Export Process

### Door Handler Module
**File:** `Na__TrueVision__GlbBuilder__SpecialObject__DoorObjectHandling__.rb`  
**Location:** SketchUp Plugins folder

**Detection:**
- Inline detection during scene graph traversal
- ADR-prefixed entities diverted from virtual flattening
- Hierarchy preserved: ADR > MOD/ROT/OuterShell node structure

**Transform Conjugation:**
```ruby
# Converts SketchUp Z-up to glTF Y-up for local coordinate spaces
M_gltf = Z_UP_TO_Y_UP * M_sketchup * inv(Z_UP_TO_Y_UP)
# Enables (0, 1, 0) Y-axis rotation in Three.js
```

**Output:**
- Mesh GLB: ADR nodes with TRIANGLES primitives
- Linework GLB: ADR nodes with LINES primitives
- Both have identical hierarchy with matching node names

---

## Animation System

### Click Detection
- Tracks pointer movement to distinguish clicks from orbit drags
- Threshold: 4px movement (configurable)
- Raycasts against door meshes (both mesh and linework)
- Walks up scene graph to find ADR ancestor

### Animation
- Smooth ease-in-out cubic interpolation
- Mid-animation reversal support
- Rotates around ROT pivot point on Y-axis (vertical)
- Animates both mesh and linework MOD objects simultaneously

### States
- `CLOSED` → `OPENING` → `OPEN` → `CLOSING` → `CLOSED`
- Supports clicking during animation to reverse direction
- Duration scales proportionally for partial reversals

---

## Coordinate System

**SketchUp:** Z-up, inches  
**glTF:** Y-up, meters  
**Three.js:** Y-up, meters

**Rotation Axis:**
- Y-axis `(0, 1, 0)` for vertical rotation
- Enabled by transform conjugation in GLB export
- Standard glTF/Three.js convention

---

## Dual Model Animation

TrueVision3D uses separate mesh and linework GLB files:
- **Mesh:** Solid geometry (TRIANGLES primitives)
- **Linework:** Edge geometry (LINES primitives)

Both animate together:
- Door registry links mesh and linework versions
- Single animation state drives both transforms
- Perfect visual synchronization

---

## API Reference

### `Na__DoorAnimation__Initialize(scene, camera, rendererDomElement, modelGroupMesh, modelGroupLinework, config)`

Initializes the door animation system.

**Parameters:**
- `scene` (THREE.Scene) - Three.js scene
- `camera` (THREE.Camera) - Three.js camera
- `rendererDomElement` (HTMLElement) - Canvas for pointer events
- `modelGroupMesh` (THREE.Group | null) - Mesh model group
- `modelGroupLinework` (THREE.Group | null) - Linework model group
- `config` (Object) - Animation configuration

**Config Properties:**
- `3dObject__Interaction__DoorAnimation__AnimationDurationMs` (number) - Animation duration
- `3dObject__Interaction__DoorAnimation__DefaultRotationDeg` (number) - Fallback rotation angle
- `3dObject__Interaction__DoorAnimation__ClickThresholdPx` (number) - Click detection threshold

---

### `Na__DoorAnimation__Update(deltaMs)`

Updates all door animations. Call every frame in render loop.

**Parameters:**
- `deltaMs` (number) - Time elapsed since last frame in milliseconds

---

### `Na__DoorAnimation__ScanForDoors()`

Re-scans scene graph for door assemblies. Useful for dynamically loaded models.

---

## Troubleshooting

### Door doesn't animate when clicked

**1. Verify hierarchy in GLB:**
- Node graph should show `ADR > MOD/ROT` structure
- If flattened: re-export with updated GLB Builder plugin (v1.5.0+)

**2. Check console during export:**
```
[DoorHandler] Detected door assembly: ADR002__...
[DoorHandler] Building door assembly: ADR002__...
```

**3. Check console during Three.js load:**
```
[DoorAnimation] Registered door (mesh): "ADR002__..." (90 deg)
[DoorAnimation] Linked linework for door: "ADR002__..."
[DoorAnimation] Scan complete. 1 door(s) found.
```

**4. Verify model groups passed to initializer:**
- Must pass both mesh and linework groups separately
- Groups must contain the loaded GLB scenes

### Only mesh animates (linework doesn't move)

**Check linework linking:**
- Console should show: `Linked linework for door: "ADR002__..."`
- If missing: linework GLB not loaded or ADR names don't match

**Verify model group names:**
- Both GLB scenes must have names ending in `__MeshModel__` and `__LineworkModel__`
- Model loader sets these automatically from GLB filenames

---

## Related Files

**SketchUp Plugin (Ruby):**
- `Na__TrueVision__GlbBuilder__SpecialObject__DoorObjectHandling__.rb` - Door export handler
- `Na__TrueVision__GlbBuilder__EngineCore__GeometryHandling__.rb` - Mesh traversal with door detection
- `Na__TrueVision__GlbBuilder__EngineCore__LineworkModelHandling__.rb` - Linework traversal with door detection
- `Na__TrueVision__GlbBuilder__Main__.rb` - TAG_RANGES configuration

**TrueVision3D Application (JavaScript):**
- `25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js` - Door animation module
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` - Configuration
- `index.html` - Main application bootstrap

**Test Environment:**
- `80__Testing__PrototypeEnvironment/` - Imports from main app for testing new features

---

## Performance

- **Raycasting:** O(n) where n = door panel meshes (typically 1-10 per door)
- **Animation:** O(m) where m = actively animating doors
- **Memory:** ~200 bytes per door record (~20 KB for 100 doors)

---

## Future Enhancements

- Proximity-based auto-open when camera approaches
- Audio cues (hinge creak, latch click)
- Collision detection (prevent camera passing through closed doors)
- Door state persistence
- Double doors and sliding doors support

---

## Version History

**Version 1.0.0** (14-Feb-2026)
- Initial implementation with single model group support

**Version 1.1.0** (14-Feb-2026)
- Dual model support (mesh + linework)
- Y-axis rotation with proper Y-up coordinate space
- Hierarchy-preserving GLB export integration
- Synchronized mesh and linework animation

**Version 1.2.0** (06-Mar-2026)
- Negative rotation degree support (`-90-Deg`) to reverse door swing direction
- Regex updated from `/(\d+)-Deg/i` to `/(-?\d+)-Deg/i`
- Validation guard updated to allow negative values (`degrees !== 0`)

---

# =============================================================================
# END OF DOCUMENTATION
# =============================================================================

