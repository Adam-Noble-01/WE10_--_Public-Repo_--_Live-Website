# TrueVision3D - PLAN - Drawing Planes (Plan and Elevation Planes in the 3D View)
# =========================================================

Started 20-Sep-2026. Authored in TrueVision first; ValeVision receives the port after sign-off.
Section 6 is the live progress ledger - read it first when picking this up in a new session.


## 1. The problem, in Adam's words

- "There's no visual way to see what planes correspond to what plans and elevations."
- "If you could switch on one of them, or quite helpfully all of them at once, it would be useful
  for showing you where that plane is."
- ValeVision's pick-a-face and drag-a-plane tool is "quite rudimentary but along the right lines".

What TrueVision had before this: one green gizmo that followed the elevation row being edited and
vanished with the panel; floor plans had no gizmo at all; the ported face pick and gizmo grip
modules were initialised in Index.html and never armed; and the gizmo sized itself from the WHOLE
model - on PS01 that is an 80 m landscape slab, so the plane was 86 m wide for an 11 m house.


## 2. Requirement audit (brief and screenshot marks -> where each lives)

Every line of the brief and every mark on the annotated screenshot, read LITERALLY.

| # | Source | Requirement | Where it lives |
|---|--------|-------------|----------------|
| B1 | brief | Toggles for visible planes, switched on in the scene | Eye toggle on every plan and elevation row (`Na__PlaneUi__BuildRowControls`) |
| B2 | brief | One of them, or all of them at once | "All plans" / "All elevations" toggles in the Drawing Planes bar at the head of both panels |
| B3 | brief | The scene name mapped to each plane | Label on the plane = the drawing's name (the same string its carousel card carries) |
| B4 | brief | Different colours per plane | Palette in config, indexed by the record's own id number so deleting one never recolours the rest; the row's swatch is the same colour |
| B5 | brief | Both the elevation AND the plan systems | One shared system, `47__System__DrawingPlanes`, with a source adapter per drawing type (vertical planes, horizontal planes) |
| B6 | brief | Snapping toggle for elevation and plan planes | Snap on/off in the Drawing Planes bar (kept in localStorage) |
| B7 | brief | Freely grab a plane and move it along an axis | `Na__DrawingPlanes__Grip__`: corner grips and label of any shown plane, plus the unhidden face of the SELECTED plane; movement is solved along the plane's own normal only |
| B8 | brief | 50 mm by default, up to 500, down to 10 | Increment stepper: 10, 25, 50, 100, 250, 500 (config list) |
| B9 | brief | "Always stay snapped to an increment of that in 3D space" | The ABSOLUTE world coordinate along the normal is snapped, never the drag delta - a plane that starts at 20 013 lands on 20 000 / 20 050, not 20 063 |
| B10 | brief | Select the plane, then select a building face; the plane snaps to the nearest grid coordinate to that face | "Move to face" on every row: the plane keeps its bearing and moves to the picked point, snapped |
| B11 | brief | "A bit like ValeVision but more advanced" | "Aim at face" on elevation rows is ValeVision's pick (bearing AND position from the wall); plans read a floor as the floor level |
| B12 | brief | Bottom edge: find the intersection with the landscape, sit 100 mm above it | `Na__PlaneMath__GroundLevel`: the plane CUTS the landscape's flat-ish triangles inside the building's span; bottom = highest crossing + 100 mm |
| B13 | brief | Otherwise ignore the landscape in the bounding box | `Na__PlaneBounds__Measure`: building categories only (`MainBuildingModel`, `Storey__`) |
| B14 | brief | Sensible overshoot, enough space to grab | Overshoot = max(1500 mm, 8 % of the building's span); the grips sit in it, outside the building's outline |
| S1 | screenshot | Green rectangle standing through the house | The plane: translucent face, solid outline, and a faint outline that shows through the building |
| S2 | screenshot | Boxed "NORTH ELLEVATION" in the top-left corner, inside the rectangle | Name label: a boxed tab inside the top-left corner, capitals, readable from both sides |
| S3 | screenshot | Boxed "+" in the top-right, bottom-left and bottom-right corners | Corner grips - a boxed plus in each of the other three corners. READING IS MINE: taken as the grab handles, because the brief asks for "enough space to grab". **Adam to confirm.** |
| S4 | screenshot | An arrow leaving every corner, all pointing the same way, square to the plane | Four corner arrows along the direction of view (down, for a plan) |
| S5 | screenshot | One colour for the whole plane | Face, outline, grips, label and arrows all take the plane's one colour |


## 3. Decisions

- D1 **Never in a drawing, never in an export.** The old gizmo was hidden by hand at each place a
  drawing opened. Planes that stay switched on cannot be policed that way - a sheet's 3D viewport,
  a thumbnail, a still export and a video all render the same scene. So the overlay is invisible
  BY DEFAULT and the render loop switches it on for the length of one interactive 3D frame
  (`Na__RenderLoop__InteractiveOverlays__`). A render path nobody has written yet is safe too.
- D2 **Numbers stay the definition.** A drag or a pick only ever writes the same fields the sliders
  write (`Elevation__PlaneOriginMm`, `FloorPlan__CutOffsetMm`, `FloorPlan__FloorDatumMm`). No new
  record keys, so nothing changes for ValeVision's readers or for R2.
- D3 **A plan plane is its CUT.** Dragging it changes "Cut above floor" and leaves the floor level
  alone, which is how PS01's two plans were authored (floor level 0, cut 1600 and 6000). Below
  floor level + the minimum cut the floor level is carried down with it, so the plane always
  follows the pointer.
- D4 **A picked FLOOR is a floor level.** Move to face on a plan: an upward face sets the floor
  level and the cut stays its distance above; any other face puts the cut through the point.
- D5 **Orbit must survive "all on".** Six translucent planes cover most of the screen, so a plane's
  FACE is only a handle while that plane is selected, and only where the building is not in front
  of it. Grips and labels are always live. Escape, or a click on nothing, deselects.
- D6 **Visibility is per session.** A reload starts with no planes up. Snap settings are a
  preference and are kept.
- D7 The old `Na__Elevation__PlaneGizmo__`, `GizmoGrip__` and `FacePick__` stay on disk and
  initialised, unused, until sign-off; removing them is a follow-up so this change stays additive.


## 4. Module map (`02__Src__AppModules/47__System__DrawingPlanes/`)

| File | Namespace | Job |
|------|-----------|-----|
| `Na__DrawingPlanes__AppConfig__.json` | - | Increments, palette, overshoot, ground lift, category tokens, sizes, wording |
| `Na__DrawingPlanes__ConfigState__.js` | `Na__PlaneCfg` | Loads it once; getters with fallbacks that mirror the JSON |
| `Na__DrawingPlanes__Maths__.js` | `Na__PlaneMath` | The snap grid, the drag solve, the plane's 2D frame, the ground cut and the two record solves. Imports nothing, so Node tests it as the app runs it |
| `Na__DrawingPlanes__Bounds__.js` | `Na__PlaneBounds` | Building bounds without the landscape; lifts the ground's triangles into world space; returns each plane's frame |
| `Na__DrawingPlanes__PlaneMesh__.js` | `Na__PlaneMesh` | One plane's scene objects, built in the plane's own 2D frame |
| `Na__DrawingPlanes__Overlay__.js` | `Na__PlaneOverlay` | Sources, shown set, selection, colours, layout |
| `Na__DrawingPlanes__Grip__.js` | `Na__PlaneGrip` | Hover, drag along the normal with snapping, face pick, the drag readout |
| `Na__DrawingPlanes__DevMenu__Controls__.js` | `Na__PlaneUi` | The Drawing Planes bar and the per-row controls, used by both panels |
| `Na__DrawingPlanes__Styles__DevMenu__.css` | - | Their styles |

Also: `05__RenderPipeline/Na__RenderLoop__InteractiveOverlays__.js` (D1), two lines in the render
loop, the two Dev menu editors, Index.html, the stylesheet index.


## 5. Testing

- `80__Testing__PrototypeEnvironment/Na__Test__DrawingPlanes__.test.mjs` - snap and axis maths.
- In the app on PS01 (static server, fetch guard in place, nothing saved): bounds, ground level,
  toggles, drag with snapping, move to face, and proof that a sheet/thumbnail render holds no plane.


## 6. Progress ledger

| Date | State |
|------|-------|
| 20-Sep-2026 | Plan written. Build started. |
| 20-Sep-2026 | **Built and tested - TrueVision3D v2.82.0. Awaiting Adam's test.** All of section 2 is in. 47 Node checks pass; both verifiers pass. In the app on PS01 behind a fetch guard (no write attempted): bounds 13.7 / 21.6 m not 86 m, ground +50 so bottom edge +150, five planes in five colours, drag at 50 / 500 / 10 / free all on the absolute grid, Escape restores, plan drag changes the cut and not the floor level, Move to face and Aim at face on a wall, a floor refused for Aim and read as a floor level for a plan, both panels refresh in place, and a real thumbnail render saw the overlay invisible while it was switched on. |

### Open after the build

- **S3, the boxed pluses - Adam to confirm** they are grab handles. If they were meant as something
  else (an "add" control, a resize grip) the grips stay and the other thing is added.
- **D4, a picked floor sets a plan's FLOOR LEVEL** - my rule, the brief only described elevations.
- **Extra, from what the planes exposed:** "Centre on model" and Seed N / E / S / W now centre on the
  BUILDING (they centred on the landscape slab: PS01's three planes all sit at 20 000, -20 000).
  Existing records were not touched; pressing Centre on model on each is what moves them.
- **Not tested with a real mouse.** Every pointer event was synthetic, and the pane's screenshots
  timed out after three, so the look of a selected plane was seen in one cropped frame.
- **Not tested on a sloping site** in the app - only in Node. PS01's landscape is a level slab.
- **Follow-up once signed off:** delete `Na__Elevation__PlaneGizmo__`, `GizmoGrip__` and
  `FacePick__` and their three imports and init lines in Index.html. Nothing uses them now.
- **The elevation CAMERA still frames on the whole model** (`Na__ElevFrame__MeasureModel`). Left
  alone on purpose: changing it would move every saved drawing's framing.
- **ValeVision:** not ported. Its category keys are shorter ("Landscape", "Walls"), so
  `BuildingCategoryTokens` and `GroundCategoryTokens` are the part that changes; the rest is verbatim.
