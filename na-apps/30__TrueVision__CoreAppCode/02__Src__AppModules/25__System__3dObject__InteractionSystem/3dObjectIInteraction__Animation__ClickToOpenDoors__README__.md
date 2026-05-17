# Door Animation System - Technical Documentation
# =============================================================================

**Feature:** Click-to-Open Door Animation for TrueVision3D  
**Created:** 14-Feb-2026  
**Author:** Adam Noble - Noble Architecture  
**Module Version:** 1.3.0 (17-May-2026 — accordion phasing contract + bifold duration multiplier)

---

## Recent Changes

**V1.3.0 — 17-May-2026**
- Bifold doors animate ~3× slower than single/sliding doors via the new
  `BifoldDurationMultiplier` config (default `3.0`). Applied per-door at scan
  time by detecting any `ROT_MVE` panel - sliding and single doors are
  untouched.
- The SketchUp ExtFold layout modules (`Layout__EqualEqual`,
  `Layout__AllOneWay`, `Layout__MasterSlaves`) now emit the V1.7.2 accordion
  phasing contract: slaves rotate ~ ±90° (matching the master's outward swing
  sign) with an alternating ±2° termination tilt, and translate by
  `k * (panel_width - panel_thickness - gap)` toward the cascade jamb. This
  gives the open state a true zig-zag concertina silhouette rather than the
  previous flat-deck-of-cards stack.
- Right-jamb masters now also swing **outward** correctly (positive sign in
  TrueVision's anticlockwise convention) - prior to V1.7.2 the right side
  could swing inward into the room.

---

## Quick Start

**1. Model Setup in SketchUp:**
- Name door assemblies with `ADR` prefix (e.g., `ADR002__InternalDoor__GroundFloor__PorchToLounge`)
- Inside each ADR you can mix any of the following MOD types as flat siblings:
  - `MOD001__ROT__90-Deg__DoorPanel` or `MOD001__ROT__-90-Deg__DoorPanel`     — single hinged panel (interior + bifold master)
  - `MOD003__ROT__-92-Deg__MVE__X-1140-mm__BifoldPanel`                       — bifold slave: rotates ~ ±90° AND slides toward the cascade jamb
  - `MOD002__MVE__X+1200-mm__SlidingPanel`                                     — sliding moving leaf (translation only)
  - `MOD003__FIXED__SlidingPanel`                                              — sliding fixed leaf (never animated)
- Add one `ROT###__RotationPoint__<system>` marker per ROT/ROT_MVE panel (paired by sibling index).
- Use a positive degree value (e.g. `90-Deg`) to open anticlockwise, or a negative value (e.g. `-90-Deg`) to open clockwise when viewed from above
- Place all doors on tag `25__ProposedBuilding__Doors` (or `15__ExistingBuilding__Doors`).

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
            "3dObject__Interaction__DoorAnimation__Description"               : "Interactive door animation settings for click-to-open doors. Single, bifold, and sliding doors are all supported via the unified ADR/MOD/ROT/MVE/FIXED naming contract emitted by the SketchUp Element Assembly Studio Pro plugin and exported through GLB Builder v1.5.0+. Animation progress drives every panel of a multi-panel ADR in lockstep.",
            "3dObject__Interaction__DoorAnimation__Enabled"                   : true,
            "3dObject__Interaction__DoorAnimation__AnimationDurationMs"       : 600,
            "3dObject__Interaction__DoorAnimation__BifoldDurationMultiplier"  : 3.0,
            "3dObject__Interaction__DoorAnimation__DefaultRotationDeg"        : 90,
            "3dObject__Interaction__DoorAnimation__ClickThresholdPx"          : 4,
            "3dObject__Interaction__DoorAnimation__MultiPanelEnabled"         : true,
            "3dObject__Interaction__DoorAnimation__CategoryNameTokens"        : [
                "ProposedDoors",
                "ExistingDoors"
            ]
        }
    }
}
```

`MultiPanelEnabled` is a kill-switch. When set to `false`, the scanner ignores every MOD type except the legacy `ROT_ONLY` pattern, reverting bifold and sliding doors to a static (non-animated) state. Useful for emergency rollback if a multi-panel cascade misbehaves on a specific deployment; in normal operation, leave it `true`.

`BifoldDurationMultiplier` (V1.3.0+) scales the animation duration **only** for bifold doors so the accordion fold reads as a deliberate concertina rather than a snap. Detected at scan time by the presence of any `ROT_MVE` panel - sliding doors (`MVE_ONLY` + `FIXED`) and single hinged doors (`ROT_ONLY`) are unaffected. Default `3.0` (i.e. `600ms * 3 = 1800ms`).

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
- **Example:** `ADR002__InternalDoor`, `ADR007__BifoldDoor`, `ADR009__SlidingDoor`
- **Purpose:** Top-level container for the door assembly. Every MOD/ROT/MVE marker
  lives as a flat sibling under the ADR component definition.
- **3-Digit Code:** Globally unique identifier (001-099); allocator scans every
  door-system attribute dictionary so interior, bifold, and sliding doors share
  one id pool and never collide.

### MOD (Modifier Object - Animated Panel)

The MOD name encodes everything the engine needs to animate the panel. Four
patterns exist; the parser classifies on the substrings present in the name in
priority order (`__ROT__` + `__MVE__` is checked before plain `__ROT__`).

| Pattern                                                                   | Type      | Used by                              |
|---------------------------------------------------------------------------|-----------|--------------------------------------|
| `MOD###__ROT__<deg>-Deg__<tag>`                                           | ROT_ONLY  | Interior door, bifold master/hinged  |
| `MOD###__ROT__<deg>-Deg__MVE__<axis><signed-mm>-mm__<tag>`                | ROT_MVE   | Bifold slave (rotates + slides)      |
| `MOD###__MVE__<axis><signed-mm>-mm__<tag>`                                | MVE_ONLY  | Sliding moving leaf                  |
| `MOD###__FIXED__<tag>`                                                    | FIXED     | Sliding fixed leaf (no animation)    |

- `<deg>` may be positive or negative (`90-Deg`, `-90-Deg`, `180-Deg`).
  Negative values reverse the swing direction; parsed by `/(-?\d+)-Deg/i`.
- `<axis>` is one of `X`, `Y`, `Z`. Resolves to the **MOD's parent (ADR) local**
  axis vector at runtime, so an `X+1200-mm` slide moves the panel along the door
  head regardless of the building wall's world orientation.
- `<signed-mm>` is the magnitude with explicit sign (e.g. `+1200`, `-600`),
  parsed by `__MVE__([XYZ])([+\-]\d+)-mm/i`. The signed mm value is funneled
  through `Na__Math__ConvertMmToUnits` for engine-unit conversion.
- `<tag>` is a free-form descriptor (`DoorPanel`, `BifoldPanel`, `SlidingPanel`...).

### ROT (Rotation/Hinge Point Marker)
- **Format:** `ROT###__RotationPoint__[System]HingeCentre`
- **Examples:** `ROT001__RotationPoint__DoorHingeCentre` (interior),
  `ROT001..ROT005__RotationPoint__BifoldHingeCentre` (one per bifold rotating panel).
- **Purpose:** Defines the local pivot point for a rotating MOD. The marker's
  group geometry lives on the helper-only `02__DoorHelpers__RotationPivots`
  layer so it is excluded from the rendered GLB but the empty named group
  survives so its position vector remains addressable as the pivot.
- **Pairing rule:** Within an ADR, the Nth ROT### sibling pairs with the Nth
  rotating MOD sibling. Sliding doors include a placeholder ROT001 so the
  Walk-Mode proximity module always has a world-position anchor.

### MVE (Movement Track Marker - Informational)
- **Format:** `MVE###__MovementPoint__[System]PanelTrack`
- **Examples:** `MVE001__MovementPoint__BifoldPanelTrack`,
  `MVE001..MVE002__MovementPoint__SlidingPanelTrack`.
- **Purpose:** Visual aid in SketchUp + GLB scene graph; the canonical animation
  axis + magnitude is parsed from the MOD name itself, so the MVE marker is
  not actually read by the runtime animation.

---

## SketchUp Model Setup

### Single Hinged (interior) door

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

### Bifold door (3-panel cascade, MasterSlaves layout)

V1.7.2 of the SketchUp ExtFold layout modules emits an "accordion phasing"
contract: every panel rotates to roughly **perpendicular** to the wall (with a
small alternating termination tilt of ±2°) and the slaves translate toward the
cascade jamb by `k * (panel_width - panel_thickness - gap)` so they stack at
`panel_thickness + gap` from the previous panel - a true accordion fold rather
than a flat deck-of-cards collapse. Slaves use ~±90° (matching the master's
outward sign), NOT 180°.

```
SketchUp Model
├─ 25__ProposedBuilding__Doors
│  └─ ADR007__BifoldDoor                                              ← Door assembly
│     ├─ MOD001__ROT__-88-Deg__BifoldPanel                            ← Master (left-jamb, hinged only, swings outward)
│     ├─ MOD002__ROT__-92-Deg__MVE__X-1140-mm__BifoldPanel            ← Slave 1 (rotates ~ -90°, slides toward LEFT jamb)
│     ├─ MOD003__ROT__-88-Deg__MVE__X-2280-mm__BifoldPanel            ← Slave 2 (rotates ~ -90°, slides further toward LEFT jamb)
│     ├─ ROT001__RotationPoint__BifoldHingeCentre                     ← Pairs with MOD001
│     ├─ ROT002__RotationPoint__BifoldHingeCentre                     ← Pairs with MOD002
│     ├─ ROT003__RotationPoint__BifoldHingeCentre                     ← Pairs with MOD003
│     ├─ MVE001__MovementPoint__BifoldPanelTrack                      ← Informational only
│     └─ MVE002__MovementPoint__BifoldPanelTrack                      ← Informational only
```

**Sign conventions (V1.7.2 contract):**

- Left-jamb master / left-cascade slave: `rot_degrees ≈ -90` (-88 or -92)
- Right-jamb master / right-cascade slave: `rot_degrees ≈ +90` (+88 or +92)
- Slaves alternate the ±2° tilt by their position from the cascade master,
  giving the open state a zig-zag concertina silhouette
- Slave `mve_distance_mm` for the k-th slave from the cascade master is
  `k * (panel_width - panel_thickness - gap)` with a NEGATIVE sign for left
  cascades and a POSITIVE sign for right cascades. The default visible gap
  between adjacent open panels is 10 mm.

### Sliding door (one moving + one fixed leaf)

```
SketchUp Model
├─ 25__ProposedBuilding__Doors
│  └─ ADR009__SlidingDoor                                         ← Door assembly
│     ├─ MOD001__MVE__X+1200-mm__SlidingPanel                     ← Moving leaf
│     ├─ MOD002__FIXED__SlidingPanel                              ← Fixed leaf
│     ├─ ROT001__RotationPoint__SlidingDoorPlaceholder            ← Walk-Mode anchor (no rotation)
│     └─ MVE001__MovementPoint__SlidingPanelTrack                 ← Informational only
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
- Raycasts against every panel's mesh + linework (FIXED leaves are still
  click-targets so the user can tap them to toggle the rest of the door)
- Walks up scene graph to find ADR ancestor

### Animation
- Smooth ease-in-out cubic interpolation driven by a unified `[0..1]` progress
  value, so a multi-panel bifold cascade with mixed ROT-only + ROT+MVE panels
  always finishes its travel at exactly the same instant
- Per-panel transformation is applied via `Na__DoorAnim__ApplyPanelTransform`:
    1. Restore the MOD's initial transform (position + quaternion)
    2. For ROT_* panels, rotate by `progress * targetAngleRad` around the
       per-panel hinge pivot (Y-axis local rotation, post-multiplied)
    3. For MVE_* panels, translate along the resolved local axis by
       `progress * mveDistanceUnits`
- Mid-animation reversal scales duration proportional to the remaining progress
- Animates both mesh and linework MOD objects simultaneously

### Effective Animation Duration (V1.3.0+)
Bifold doors animate slower than single hinged or sliding doors so the
accordion fold reads as deliberate, mechanical motion rather than a snap.

- Detection: any door with at least one `ROT_MVE` panel is classified as a
  bifold during `Na__DoorAnimation__ScanForDoors`. Single (`ROT_ONLY`) and
  sliding (`MVE_ONLY` + `FIXED`) doors keep the base duration.
- Per-door `effectiveDurationMs` is cached on the `doorRecord` at scan time:
  `bifold ? AnimationDurationMs * BifoldDurationMultiplier : AnimationDurationMs`
- `Na__DoorAnim__ToggleDoor` reads `doorRecord.effectiveDurationMs` for both
  the open and close phases, and the completion handler resets
  `doorRecord.animDurationMs` back to the same effective duration so partial
  reversals scale against the door's own native speed.

### States
- `CLOSED` → `OPENING` → `OPEN` → `CLOSING` → `CLOSED`
- Supports clicking during animation to reverse direction
- Duration scales proportionally for partial reversals
- Walk-Mode proximity reuses the same `state` machine - the proximity module
  calls `Na__DoorAnim__ToggleDoor` and the multi-panel applier cascades
  automatically across every panel of the ADR

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
- `3dObject__Interaction__DoorAnimation__AnimationDurationMs` (number) - Base animation duration in ms (single hinged + sliding)
- `3dObject__Interaction__DoorAnimation__BifoldDurationMultiplier` (number, default 3.0) - Multiplier applied to base duration for any door with a `ROT_MVE` panel (V1.3.0+)
- `3dObject__Interaction__DoorAnimation__DefaultRotationDeg` (number) - Fallback rotation angle
- `3dObject__Interaction__DoorAnimation__ClickThresholdPx` (number) - Click detection threshold
- `3dObject__Interaction__DoorAnimation__MultiPanelEnabled` (boolean) - Kill-switch for ROT_MVE/MVE_ONLY/FIXED panel parsing

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

- Audio cues (hinge creak, latch click)
- Collision detection (prevent camera passing through closed doors)
- Door state persistence across sessions
- Per-panel handle hover highlights

---

## Version History

**Version 1.4.0** (17-May-2026)
- Multi-panel door pipeline: bifold (multi-MOD with rotation+translation
  cascades) and sliding (MVE-only moving leaves + FIXED leaves) now animate
  alongside the legacy single ROT-only interior door behaviour.
- Replaced angle-based animation state with a unified `[0..1]` progress so
  mixed ROT/MVE cascades stay synchronised across every panel of an ADR.
- New AppConfig kill-switch `MultiPanelEnabled` (default true) for emergency
  rollback to single-MOD behaviour.
- Walk-Mode proximity now activates correctly for bifold + sliding ADRs (no
  proximity-side change required).

**Version 1.3.0** (28-Feb-2026)
- Added `Na__DoorAnimation__RebindModelGroups` for safe model-group switching;
  door registry refreshes against newly loaded model roots without duplicating
  pointer listeners.

**Version 1.2.0** (06-Mar-2026)
- Negative rotation degree support (`-90-Deg`) to reverse door swing direction
- Regex updated from `/(\d+)-Deg/i` to `/(-?\d+)-Deg/i`
- Validation guard updated to allow negative values (`degrees !== 0`)

**Version 1.1.0** (14-Feb-2026)
- Dual model support (mesh + linework)
- Y-axis rotation with proper Y-up coordinate space
- Hierarchy-preserving GLB export integration
- Synchronized mesh and linework animation

**Version 1.0.0** (14-Feb-2026)
- Initial implementation with single model group support

---

# =============================================================================
# END OF DOCUMENTATION
# =============================================================================

