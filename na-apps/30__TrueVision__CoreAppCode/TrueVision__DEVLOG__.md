# TrueVision3D Development Log
# =========================================================

# ---------------------------------------------------------
## TrueVision3D v2.82.0  -  20-Sep-2026
### Every Plan and Elevation Has a Plane You Can See, Grab and Snap - and the Landscape Stopped Deciding How Big It Was

**Overview**
- Adam, 20-Sep, with a marked-up screenshot of PS01: "there's no visual way to see what planes
  correspond to what plans and elevations. In a 3D model, if you could switch on one of them, or
  quite helpfully all of them at once, it would be useful for showing you where that plane is."
- What there was: one green gizmo that followed the elevation row being edited and went when the
  panel closed; nothing at all for floor plans; a face pick and a gizmo grip ported from ValeVision,
  initialised in Index.html and never armed; and a gizmo sized from the WHOLE model. On PS01 that is
  an 80 m landscape slab five metres deep under an 11 m house, so the plane was 86 m wide and began
  five metres underground.
- What there is now: a new system, `47__System__DrawingPlanes`, shared by both drawing panels. Every
  plan and every elevation has a plane in the 3D view that can be switched on alone or with all the
  others, carries the drawing's name in its own colour, can be dragged along its normal on a snap
  grid, and can be sent to a picked building face. Nothing new is stored: a drag or a pick writes
  the same fields the sliders write, so the numbers remain the definition.

**His screenshot, read literally** (the audit table is in `TrueVision__PLAN__DrawingPlanes__.md`)
- A rectangle standing through the house: the plane - a translucent face, a solid outline, and the
  same outline again faintly with no depth test, so a plane can be followed where the building
  hides it.
- A boxed NORTH ELEVATION inside the top-left corner: the drawing's name as a boxed tab, in
  capitals. It is two quads back to back, the rear one mirrored, so it never reads in mirror
  writing and needs no per-frame camera test.
- A boxed plus inside each of the other three corners: taken as the GRAB HANDLES, because the brief
  asks for "plane overshoot sizes with enough space to grab". That reading is mine - Adam to confirm.
- An arrow leaving every corner, square to the plane: the direction of view; down, for a plan.
- One colour for all of it. The colour comes from the number in the record's own id, not its place
  in the list, so deleting a drawing never recolours the rest. The swatch beside each row's name is
  the same colour, and the row of the selected plane wears it down its left edge - that is what
  ties a row to a plane.

**The panels**
- THE SAME BAR heads the Floor Plans and the Elevations panels, because the state behind it is
  shared: All plans, All elevations, Snap, and a stepper through 10, 25, 50, 100, 250 and 500 mm
  (50 by default; the choice is kept in the browser).
- UNDER EACH DRAWING'S NAME: Show plane, Move to face and - for an elevation - Aim at face.
- THE PLANE OF THE ROW BEING TOUCHED IS ALWAYS UP, as the old gizmo was. Closing a panel takes that
  one down and leaves the planes that were SWITCHED ON, which is the point of switching them on.
  Visibility is per session: a reload starts clean.
- REFRESHED IN PLACE, NEVER BY REBUILDING. Touching a slider selects its plane; had that rebuilt
  the panel, the slider would have been replaced under the author's hand. Proved: the slider is
  still in the DOM after the selection it caused.

**Grabbing and snapping**
- THE SNAP IS ABSOLUTE. "It should always stay snapped to an increment of that in 3D space": a
  plane's position is one number - how far along its normal it stands from the world origin - and
  THAT is snapped, never the distance dragged. A plane that started at 15 013 landed on 15 350,
  15 700, 16 100... every step a multiple of 50, and only Plane X moved. For the four compass
  elevations the normal is a world axis, so the grid is the world's.
- ALONG THE NORMAL ONLY: the closest point on the normal to the pointer ray, as the old grip solved
  it. A plane facing the camera cannot be solved well - a pixel becomes metres - so inside 6
  degrees it holds still and the readout says to orbit round.
- NUMBERS WHILE DRAGGING, which ValeVision's drag never had: a readout follows the pointer with the
  name, "Plane X 15 350 mm", how far it has come, and the grid. Escape puts the plane back.
- ORBIT SURVIVES "ALL ON". The three grips and the name of ANY plane are always live; the FACE is a
  handle only on the selected plane, and only where the building is not in front of it. With six
  translucent planes up a press meant as an orbit would otherwise move a drawing. Pressing a grip
  selects; Escape or a click on nothing deselects. A press on nothing is never taken.
- A FLOOR PLAN'S PLANE IS ITS CUT. Dragging it changes "Cut above floor" and leaves the floor level
  alone - which is how PS01's two plans were authored (floor level 0, cuts of 1 600 and 6 000).
  Under the minimum cut the floor level is carried down with it, so the plane always follows.

**Move to face, Aim at face**
- MOVE TO FACE keeps the drawing's direction and puts the plane through the picked point, on the
  grid: PS01's west wall at x = 9 775 put the plane at 9 750. With snap off it lands on the face.
- AIM AT FACE is ValeVision's pick: the elevation turns to face the wall square on, then moves to
  it. A south-facing wall gave bearing 180 and Plane Z -11 700. A floor or a roof has no bearing to
  give, so it is refused in words and the pick stays armed.
- ON A PLAN, A FLOOR IS A FLOOR LEVEL. Click the floor a plan is of and that becomes its floor
  level, the cut keeping its distance above - cutting AT a floor draws nothing. Any other face puts
  the cut through the point. That rule is mine; the brief only described elevations.
- A press that travels is an orbit, so the view can be turned between arming and clicking.

**The landscape is a cutting plane and nothing else**
- "When using the bounding box calculations, ignore the landscape." A plane is sized from the
  categories whose key holds `MainBuildingModel` or `Storey__` (config tokens), plus an overshoot -
  the larger of 1 500 mm and 8 % of the building's longer side - which is what puts the grips clear
  of the building's outline. PS01's planes went from 86 m wide to 13.7 and 21.6 m.
- "Detect where its intersection with the landscape plane is, and create 100 mm above that line."
  The plane CUTS the landscape's own triangles and the bottom edge sits 100 mm above the highest
  crossing inside the building's span. Exact, not sampled: a level slab and a sloping site are the
  same code. Only flat-ish faces count, so a fence panel cannot lift the edge; either winding is
  accepted, or a reversed face would swap a slab's top for its underside. PS01: slab at +50, edge
  at +150.
- IT EXPOSED A FAULT NOBODY COULD SEE. "Centre on model" and Seed N / E / S / W centred on the
  whole model's bounds - the LANDSCAPE'S centre. PS01's three elevations all sit at (20 000,
  -20 000), off the corner of a house standing around (15 000, -15 400). Both now use the
  building's centre, on the grid. Existing records are untouched.

**Never in a drawing, never in an export**
- The old gizmo was hidden by hand wherever a drawing opened. Planes left switched on cannot be
  policed that way: a sheet's 3D viewport, a thumbnail, a still and a video all render the same
  scene. So the rule is turned round (`05__RenderPipeline/Na__RenderLoop__InteractiveOverlays__`):
  the overlay is INVISIBLE BY DEFAULT, and the render loop switches it on for the length of one
  interactive 3D frame - past the hold and past the 2D drawing - and off in the tick's finally. A
  render path nobody has written yet cannot print a plane.
- PROVED through a hook on the scene: 51 renders inside the loop all saw the overlay visible; a
  real carousel-thumbnail render, through the composer with the helper layer enabled, saw it
  invisible while it was still switched on.
- Hit testing therefore never reads `object.visible`. What the pointer is over is worked out from
  each plane's own 2D frame, and every overlay object has its raycast switched off, so no other
  system's pick can land on one.
- The live app carries none of it: no scene object and no listener until a Dev panel shows a plane.

**Proved, not eyeballed**
- `Na__Test__DrawingPlanes__.test.mjs`, 47 checks on the import-free maths: the snap, the drag
  solve, the plane frame, the ground under PS01's slab, a slope and a 45 degree plane, and both
  record solves.
- In the app on PS01, behind a fetch guard that logged NO write attempt: bounds and ground as
  above; drag at 50, 500, 10 and free; Escape; the plan's cut; the four picks; both panels in step.
  After a reload the project's records were exactly as they had been.
- NOT DONE: a real mouse. Every pointer event was synthetic, and the pane's screenshots timed out
  after the first three, so the look of a SELECTED plane has been seen in one cropped frame only.

**Files**
- New: `47__System__DrawingPlanes/` (AppConfig, ConfigState, Maths, Bounds, PlaneMesh, Overlay,
  Grip, DevMenu Controls, styles); `05__RenderPipeline/Na__RenderLoop__InteractiveOverlays__`; the
  test; `TrueVision__PLAN__DrawingPlanes__.md`.
- Changed: `Na__Elevation__DevMenu__Editor__` 1.1.0 and `Na__FloorPlan__DevMenu__Editor__` 1.1.0
  (each registers a SOURCE with the overlay); `Na__AppFlow__LoadingSequence` (one import, Begin on
  the 3D path of the frame, End in the tick's finally); `Index.html` (three imports, three init
  lines); the stylesheet index (one import).
- `Na__Elevation__PlaneGizmo__`, `GizmoGrip__` and `FacePick__` are no longer used by anything but
  are still on disk and initialised, so this change stays additive; removing them is a follow-up.
- THE SERVICE WORKER TOKEN is not bumped again. This adds modules that import only exports a warm
  cache already holds, the tools are localhost-only where the worker is network-first, and a
  half-new graph merely lacks the feature. `2026-09-20-1`, undeployed, covers it.
- Not yet signed off by Adam. Not in ValeVision, whose category keys are shorter, so the two token
  lists in the config are the part of the port that changes.

# ---------------------------------------------------------
## TrueVision3D v2.81.0  -  20-Sep-2026
### A Drawing Can Be Scanned Into Its Own Model - Once Its Address Was Short Enough for the Title Block to Stay Thin

**Overview**
- Adam, 19-Sep: a new system folder that makes a QR code per project from its live address, and in
  the bottom right-hand corner of the drawing title block "a QR code exactly like how the Lantern
  Designer did", with a note - "anybody with a phone should be able to scan into the TrueVision
  model automatically". The Drawing Register and the Specification are to carry the same code next.
- WHAT I BUILT FIRST WAS WRONG, and he said so. The code carried the project's full address -
  .../30__TrueVision__CoreAppCode/Index.html?project=PS01&project-folder=PS01__MustersRoad&year=26,
  135 bytes. How many modules a symbol has is decided by how long its address is: that is version 8,
  49 modules, and to print a module a phone can read it took a TWENTY millimetre title block. He had
  said it could be taller; he had not said it could be that. "Too tall, too portrait-feeling, and
  stretched... could we have a top-level, root-level index to handle diverting these?"
- THE ADDRESS GOT SHORT INSTEAD OF THE STRIP GETTING TALL. A drawing now carries
  https://www.noble-architecture.com/q/?PS01 - 42 bytes, which is EXACTLY what a version 3 symbol
  holds, 29 modules - and a page at the website root sends the phone on to the long address. The
  strip is back at 10 mm. The code is 8.79 mm with 0.61 mm round it: Lantern Designer's 8.8 and 0.6,
  arrived at by rule rather than typed in, with a LARGER module than Lantern's (0.303 mm for 0.267).
- We had both misremembered Lantern. He thought its code was "like 15 mm"; I had not checked. Its
  strip is 10 mm and its code 8.8. The config was one grep away the whole time.

**The Project QR Code system - 02__Src__AppModules/53__System__ProjectQrCode**
- `Na__ProjectQr__Symbol__` is the one door in: the config, the symbol of the project on screen
  (encoded once, cached against its address), the words that go beside it, and two guards below. No
  project on the address bar, or the system switched off, and it answers null - a document then
  draws neither the code nor the note telling people to scan it.
- `Na__ProjectQr__Encoder__` is first-party, ported from Lantern Designer: byte mode, level M,
  versions 1 to 10, no dependency, because the app is an offline PWA with a version-locked vendor
  set. `Na__ProjectQr__Painter__` draws a symbol as ONE vector path - an SVG group, a whole SVG
  document for an HTML page, or straight into jsPDF - because abutting rectangles are anti-aliased
  one at a time and a viewer leaves hairlines between them. `Na__ProjectQr__ProjectLink__` builds
  the address from the config's pattern and NEVER from the address bar: drawings are made on
  localhost, which is exactly the address a printed code must not carry.
- GUARD ONE, the print size. A document reports the square it drew and the clear paper round it;
  under MinModuleMm (0.28) or QuietZoneModules (2) the console says so once, with the size it would
  need. A title block made lower or a project code given a fifth character shrinks the module
  silently; the first anyone would otherwise hear of it is a client on site.
- GUARD TWO, the index. On the authoring machine the resolver's index is read once per project, and
  a project missing from it - or listed under another folder or year - is reported, because a
  drawing exported then would carry a code that opens nothing.

**The resolver - q/ at the website root, outside this app**
- `q/index.html` is a flat page: no framework, no assets, no app boot. It reads the code off the
  address (`?PS01`, and also `?p=`, `?project=` and `#`, first token only, because apps that open
  links hang tracking keys on the end), looks it up in `q/index.json`, falls back to the
  ProjectVision master index, and `location.replace`s to the long address - RELATIVE, so it
  resolves on localhost and on any future host unedited. What it shows is built from text nodes,
  never markup: the code comes off an address a stranger can write.
- THE TRUEVISION ADDRESS NOW LIVES IN ONE PLACE. If the app ever moves, changing two constants in
  that page re-points every code ever printed. That is worth more than the millimetres.
- `q/index.json` is written by `ProjectVision__BuildScript__.py` on every build
  (`build_qr_link_index`), always for EVERY valid project even on a targeted run, with or without
  TrueVision content - a printed code must never die because a content check changed its mind.
  `--qr-index-only` rewrites it and nothing else; that is how today's 12 entries were made, without
  running a build over anybody's project data.
- THE PROJECT MANAGER WOULD HAVE LEFT IT STALE. It rewrites the master index itself on a rename or
  a delete, and a STALE entry here is worse than a missing one - the page only falls back to the
  master index when a code is not listed at all - so a project renamed there would have sent every
  drawing already printed for it to a folder that no longer exists. `_update_master_index` now
  carries the change on (`_update_qr_index`); it never fails the edit that caused it. Proved against
  copies of both indexes. The 8090 server needs a restart to pick it up (ProjectVision 0.4.1).
- THREE THINGS MUST NEVER BREAK, and the README in the folder says so: the `q` folder is never
  moved or renamed; the index is never hand-edited; and if the printed pattern changes, the page
  goes on answering the old one. There is NO HEADROOM - one more character is a version 4 symbol.

**The title block cell - Na__LayoutEditor__TitleBlock__QrCell__**
- The right-hand end of the modern strip, mirroring the logo at the left: an absolute width off the
  end, the fields solved across what is left between. So Status - which the title block session was
  asked the same day to put "at the very end on the right" - is the last FIELD, and the code stands
  beyond it in the corner. It is solved before the fields and simply hands the cell solver a narrower
  strip; with no code there is no cell and nothing moves.
- THE CODE NEEDS NO DIMENSION. N modules and q of quiet zone either side share the strip's height:
  module = H / (N + 2q). Make the strip taller and the code follows it.
- NAVIGATE THIS BUILDING IN 3D (Adam's word, for "View") over his sentence, as one block centred on
  the code. MEASURED, NOT GUESSED: every cell width from 42 to 58 mm was wrapped at three body sizes,
  and 56 mm at 1.5 mm sets the sentence in two lines of almost exactly equal length, flush with
  0.004 mm of letter spacing. Justification is all lines or none - one flush line over one ragged
  one reads as a fault.
- ON NARROW PAPER THE NOTE GOES BEFORE ANY FIELD IS CUT. Where the whole cell would leave the fields
  under 250 mm - A4, A3 portrait - it is drawn compact: the code at full size with "3D MODEL" turned
  up its side, 12.4 mm in place of 56. The test is the paper's width and nothing on the sheet, so
  every sheet of one size in a pack is drawn the same. My first cell cut EVERY field on A4, the date
  and the revision included; that is also how v2.79.1's solver fault came to light.
- `Na__LayoutEditor__SheetChrome__` 1.9.0 has a 'qr' primitive that hands the symbol to the painter
  the way a gradient goes to the gradient tool. Not an 'image' on purpose: the exporter sends a
  classic sheet's images UNDER the viewports.

**Proved, not eyeballed**
- A DECODER WRITTEN SEPARATELY FROM THE ENCODER (`Na__Test__ProjectQr__.test.mjs`, 44 checks): BCH
  codewords, every Reed-Solomon syndrome zero, the exact string back, versions 1 to 10 at their
  longest and shortest payloads. Lantern's original was never exercised above version 4.
- OPENCV, which nobody here wrote (`Na__Test__ProjectQr__Decode__.py`): every case reads; in every
  run there has never been a wrong read.
- REAL EXPORTED PDFs on A1, A2, A3 and A4, through the app's own chrome and jsPDF options,
  rasterised by PyMuPDF at 200 to 600 dpi: every clean render decoded to the exact address; each
  code is one filled path of 217 rectangles; 80 renderings, no wrong read. A 3 module quiet zone was
  tried against the shipped 2 under identical noise and read LESS often (155 of 384 against 172), so
  the tight margin Adam asked for is also what the evidence supports.
- THE REAL EDITOR, on PS01 behind a fetch guard that logged no write attempt: all four sheets carry
  the code, no viewport runs into the strip, nothing in the chrome is truncated.
- NOT DONE: a phone pointed at a sheet of paper. Print one drawing and scan it before a pack goes out.

**What the tests caught in my own work**
- Two numbers I had documented from arithmetic in my head were wrong under the sizing rule - a five
  character code prints 0.270 mm, not 0.267, and the long address 0.189, not 0.18. The test computes
  them from the shipped config and the notes now say what it says.
- I carried a PNG to disk by copying 8 kB of base64 through the conversation. Its CRC failed. The
  proof PDFs went through a loopback save route on a no-cache server instead.
- The scrapbook session found `Na__Verify__ModuleGraph__` failing on a warning string of mine that
  put a quote after the word "from". Reworded; both verifiers pass, over 370 files.

**Files**
- New: `53__System__ProjectQrCode/` (Symbol, Encoder, Painter, ProjectLink, Config, README);
  `Na__LayoutEditor__TitleBlock__QrCell__` 1.0.0; the two tests; `q/index.html` and `q/index.json`.
- Changed: `SheetChrome__` 1.9.0 ('qr' primitive); `TitleBlock__Modern__` 1.3.0 (three lines and an
  import, under v2.79.1's 1.4.0); `ConfigState__SheetSetup__` 1.6.0 (the QrCell fallbacks; HeightMm
  went 10 to 20 to 10 and ships as 10); the AppConfig TitleBlock block (QrCell keys, and a HeightMm
  note that keeps the history so nobody tries 20 again); `ProjectVision__BuildScript__.py` and
  `ProjectVision__ProjectManager__Api__.py` (ProjectVision 0.4.1).
- THE SERVICE WORKER TOKEN is not bumped again: this adds modules and a cross-module export, which
  is the case that needs one, and `2026-09-20-1` - undeployed, like everything since v2.75.0 -
  covers it PROVIDED the worker file ships in the same commit.

**To go live, and what is next**
- THE `q` FOLDER HAS TO BE PUBLISHED with the site before a drawing carrying the code is issued.
- Next: the same code on the Drawing Register PDF (raw jsPDF: `Na__QrPaint__DrawPdf`) and the
  Specification (a chrome primitive in its PDF, `Na__QrPaint__SvgDocument` in its reading view);
  the README has the three call shapes. The classic (scanned) title block carries no code.
- The one lever left on module size is the host: a short domain of its own would be version 2.
- Not yet signed off by Adam. Not in ValeVision, which has no 53__ folder.

# ---------------------------------------------------------
## TrueVision3D v2.80.0  -  20-Sep-2026
### The App Had Been Calling the Green Axis North, and Adam Had Been Correcting It by Hand

**Overview**
- Adam: elevation viewports "should derive their names from a new direction tool added to the dev
  menu that allows you to draw a compass in 3D space and point to north", the title should know
  Existing from Proposed "by using which model it's pulling from", and "the text should show as a
  placeholder within double curly braces until you set up the north arrow". Titling six elevations
  a sheet by hand is, in his words, a real pain.
- Mapped before building, and the map found the fault under the chore. The elevation system stores
  an azimuth clockwise from the model's -Z axis and CALLS -Z north: "0 draws the north elevation".
  -Z is SketchUp's green axis, which is north only on a model drawn north-up. PS01 and PS02 were
  not. Their "North Elevation" is stored at azimuth 90, "East" at 180, "South" at 270 - seeded one
  preset out and renamed by hand, every time. One number puts it right: where true north lies, in
  the measure the azimuths are already in. For PS02 it is 90, and all six of its hand-lettered
  titles then fall out of the data exactly as he wrote them.

**The north direction tool** (`46__System__NorthDirection`, Dev Tools > North Direction)
- DRAW COMPASS: one click where it sits, a second towards north. Between them the needle follows
  the pointer. A click lands on the model, so north can be traced along anything known to run north
  by clicking its two ends; a click that misses lands on level ground. A press that travels is an
  orbit, not a click, so the view can be turned between the two. It works from a plan view too,
  through the drawing broker's camera - up the plan reads 0, across it 90. Escape cancels; Shift
  snaps. Or type the bearing: a north-up model is set to 0 in one keystroke.
- WHAT THE ELEVATIONS WILL BE CALLED is listed under it, live while the compass is aimed: each
  elevation, its stored bearing and the word north now gives it. A compass pointed the wrong way
  round shows at once as "South" against the wall everybody knows faces north.
- THE COMPASS is the Scrapbook's north point - ring, red north half, N - lying flat, drawn over the
  model rather than hidden by it, and removed the moment the panel closes. A compass left in the
  scene would print on the next elevation rendered for a sheet.
- STORED INSIDE THE DRAWINGS BLOCK (`LayoutEditor__DrawingsData__North`), for the reason the
  elevations went there: a dev-owned top-level key must be listed in three places or the next sync
  wipes it from R2. Absent means NOT SET, never zero. Set is not saved - every open sheet follows
  at once, Save North keeps it, and the status line says when the two differ.
- THE COMPASS WORD: four cardinals, and intercardinals as wide as the config says. At the house
  default of 15 degrees a wall 30 off north is still the North Elevation and one 40 off is the North
  East; 22.5 is the ordinary eight-point compass, 0 the four-point.

**What a viewport is a drawing OF** (`20__System__Viewports`)
- `Na__LayoutEditor__ViewportIdentity__` reaches in once, for everything that wants it: the phase
  from the viewport's Model Source (a group whose label says "existing" - the app's own startup
  test - else proposed), the facing from the elevation's azimuth against north, the drawing's name,
  and a viewport name only when somebody TYPED it. A paste's "East Elevation copy" is not a name:
  PS02's three proposed elevations are copies still carrying one, and nobody wants it in capitals.
- `Na__LayoutEditor__ViewportTitleText__` writes the sentence, and imports nothing. QUALIFIER then
  SUBJECT, as he letters them. A missing fact is shown as `{{Direction}}` - never guessed.
- UNNAMED ELEVATION VIEWPORTS ARE NOW NAMED from it - "Existing North Elevation" in the panels, the
  link menus, the toasts and the frame caption - through one additive hook on the sheet model,
  `RegisterViewportNamer`. Derived on the spot and never stored, so it cannot go stale. A typed
  name still wins, and with north unset everything reads exactly as it did.

**The parametric Drawing Title** (Scrapbook tab, two tiles)
- His title, measured off PS02 D22 to the thousandth: capitals, 3.5 mm at weight 600, an underline
  0.4 pt thick and exactly 60 mm long standing 1.631 mm under the baseline, and the scale bar
  6.318 mm under that, sharing its left end. He groups the three as one object. The element draws
  that object, and the test holds it against his.
- Drop it under a drawing and it reads EXISTING {{DIRECTION}} ELEVATION. Draw the compass and it
  becomes EXISTING EAST ELEVATION where it stands. Point the viewport at Scheme-02 and it says
  PROPOSED, inside the same undo step. Drag its noodle onto another drawing and it retitles. Untie
  it and it keeps what it says, as a bar keeps its scale.
- THE WORDS ARE PARAMETERS. The link module lays the facts into the element (`definition.facts`),
  so the type never sees a viewport and rebuilds from its own parameters alone. An element is now
  a PRESET of a type - two tiles, with a bar and without - and its tile shows a worked example
  where a real drop reads its own viewport.
- The underline is at least its set length and GROWS TO FIT a longer title. A type is pure, so the
  engine hands it the chrome's text measure as a tool; under Node, with none, it is its set length.
- The settings say what it reads and, while it holds a placeholder, WHY, naming the menu to go to.

**Facts that change with no sheet changing**
- North is set in the 3D view; the design phases register after a load. Nothing is announced on a
  sheet for either, so there is nothing to run ahead of. The link module refreshes the ACTIVE sheet
  and announces once, booked by a timeout and never nested in the event that asked - and again
  whenever a sheet comes up, which is how one that was away catches up. It does nothing, and marks
  nothing dirty, when no element changed.

**Tested**
- Node: the compass 23 checks (PS02's three names from one bearing), the title text 27, the element
  39 against his own title.
- In the app, real modules on scratch copies of PS02 D22, D21 and D24, every write refused: all
  twelve 2D viewports' facts before and after north; the element 68 checks, each follow inside one
  undo step with undo AND redo byte for byte; the 3D tool 22, including a save the guard refused,
  which it reported as a failure and did not call saved. Real sheets byte-identical afterwards.
- NOT YET DONE: Adam's own test in his browser.

**Open, on purpose**
- The Elevations dev menu still calls -Z north: its presets and Seed N / E / S / W name by the
  model's axes. Titles and viewport names no longer care, but the records' own names stay as typed.
- The site plan's north point still points up the paper. It wants the same bearing.
- A sheet that is away catches up when next opened, not before.

**Files**
- New: `46__System__NorthDirection/` (eight files); `20__System__Viewports/` ViewportIdentity,
  its config and ViewportTitleText; `57__Feature__ScrapbookParametric/` DrawingTitle; three tests.
- Shared, additive: `Index.html` (one dev menu item, three imports, three init lines); the
  stylesheet index; `SheetModel__Viewports__` 1.1.0 and `SheetModel__` 1.27.0 (RegisterViewportNamer);
  `ModeController__` 1.19.0 (starts the identity module); the service worker 1.9.0 - TOKEN BUMPED to
  2026-09-20-1, because new modules import new exports from modules a warm cache already holds.
- Mine: the parametric engine 1.2.0 (tools, presets, a patch on a reset), `ViewportLink__` 1.2.0
  (facts, Refresh), the panel 1.2.0, the noodle 1.1.0, the config, the stylesheet, the plan
  (section 11, with an audit of this brief).

# ---------------------------------------------------------
## TrueVision3D v2.79.1  -  20-Sep-2026
### When the Paper Runs Out, the Title Gives Way Before the Date Does

**Overview**
- Found by the QR cell's session, not by me. Its cell narrowed an A4 landscape strip to 192 mm, and
  on PS01's sheet the Date and the Rev were cut along with the Drawing Title. I had told that
  session "the title truncates hard and the rest survive". The code did not do that.
- What v2.79.0's solver did on a strip too narrow even for its cells' TEXT: take the room no cell
  was using, and then scale EVERY cell to fit. So every value lost its end together - "19 Sep 2...",
  "PS01_T01_D...". A title cut short still says what the drawing is. A date, a scale or a drawing
  number cut short says something false, which is the house rule the viewport caption fix of
  v2.61.1 was made under (the config's own words: "a scale chopped to '1:12...' is worse than
  none").
- THE CELL THAT TAKES THE SPARE ROOM IS NOW THE ONE THAT GIVES IT BACK. Between taking the slack
  and scaling, the `Flex` cells are cut first, down to a floor - the width of the cell's own label
  with its padding, so a cell is never cut past saying what it is. Only if that is not enough is
  the lot scaled. `Na__LeTitleCells__Cell` takes the floor as a third argument, and the Modern
  builder hands in each cell's measured label.

**What it changes, measured on PS01's values**
- 192 mm strip (A4 landscape less a 55 mm end cell): only the title is cut, to 23.9 mm against a
  15.25 mm floor; every other cell keeps its whole text. Before: all nine cut by 16 percent.
- A4 portrait (160 mm): the title goes to its label and the rest lose 12.7 percent of their cells,
  where they lost 29.9.
- A1, A2, A3 and an ordinary A4 landscape are untouched: the step is only reached with every cell
  already down to its text and the strip still overfull.

**Files**
- `Na__LayoutEditor__TitleBlock__Cells__` 1.1.0, `TitleBlock__Modern__` 1.4.0 (two lines inside
  this release's own hunks of a file the QR session is also in), and six more checks in
  `Na__Test__TitleBlockCells__.test.mjs` - 37 now, all passing. `Na__Verify__Exports__` passes
  over 367 files.

**ValeVision has v2.79.0 now, with this fix in it** - ported the same morning as VV v2.66.0, its
widths re-measured in Helvetica, which sets wider than Open Sans; they all still hold. Its solver
is byte for byte this one, so it never shipped the older behaviour. Not ported, deliberately: the
40 mm logo cell (the Vale mark already has 4.6 mm either side in 34) and the register's Status
column (it has no register). v2.79.0's closing line below, "Not yet in ValeVision", is history.

**The service worker token, which v2.79.0 should have bumped and did not**
- v2.79.0 added a cross-module export (`Na__LeCfg__StatusToStore`, imported by `Panel__Sheet__` and
  `Register__Transactions__` from a `ConfigState__` every warm cache already holds) and a new module.
  App modules are stale-while-revalidate, so that is exactly the case the worker's own log says
  needs a bump: a warm client links new importers against old exporters and the editor does not
  load until the second visit. I judged it "a feature release, no bump" on 19-Sep. That was wrong.
- IT IS COVERED, by someone else's bump: the scrapbook session took the token to `2026-09-20-1`
  (worker 1.9.0) for its own new exports, and the last DEPLOYED token is v2.75.0's `2026-09-19-1`.
  Both releases here ride on it PROVIDED the worker file ships in the same commit as they do - it is
  an uncommitted working-tree change on 20-Sep-2026, like everything since v2.75.0.
- ValeVision is NOT covered. It runs under a different worker (the shared
  `WebApps/Na__Pwa__ServiceWorker__.js`, token `2026-09-18-1` in Whitecardopedia's logic file), and
  its port of this release adds the same export. Bumping that one evicts every Vale app's caches,
  models included, so it is Adam's call; the ValeVision parity ledger has the detail.

# ---------------------------------------------------------
## TrueVision3D v2.79.0  -  19-Sep-2026
### A Title Block Cell Is a Width in Millimetres, Not a Share of the Paper - and a Drawing Now Says What It Is Issued For

**Overview**
- Adam, on PS01 D02 at A2: "Can you see how oddly proportioned it is? The client name section can be
  significantly smaller. Same with the drawing number... The one thing that does need the space is
  the drawing name. Can you see here? It's completely cut off."
- The cause was one line of arithmetic. The strip's rows were RELATIVE SHARES of the width left
  beside the logo, so every cell grew with the paper. On A2 that made Client 76 mm for
  "Mr P. Samra", Document ID 71 mm for twelve characters and Scale 82 mm - while Drawing Title, the
  one value that is ever long, got 93 mm and was cut off at "Elevatio...".
- A row's `WidthMm` is now what its name always said: paper millimetres, the same on every paper
  size, the way the logo already was. On the same A2 sheet: Client 36, Site Address 70,
  **Drawing Title 272**, Document ID 24, then Rev, Scale, Date and Drawn By as one 28 mm module
  ("Revision, scale, date, and drawn by can all be the same size"), then the new Status at 30.
- The logo has air: its cell went 34 to 40 mm and its side padding 1.4 to 4, so the mark sits about
  4.4 mm clear of the frame and of the Client rule. The mark itself is the size it was (31.1 x 7.6).

**Grow if absolutely required**
- His words for Site Address and the title, and the rule for every cell: NO VALUE IS CUT OFF WHILE
  ANOTHER CELL HAS ROOM TO SPARE. A cell whose text overruns its width is made whole out of the
  paper's spare room first - which costs no other cell anything, because that room was going to
  the title - and only then out of the room other cells are not using, in proportion to how much
  each has.
- So a pack whose values fit has its dividers in the same place on every sheet, whatever each
  sheet's title says, and they only move on the sheet that needs them to. A three-scale label
  ("1:20 & 1:50 & 1:100 @ ISO A3") grows its Scale cell to 32.5 rather than printing "1:20 & 1:5...".
- On paper narrower than the strip (A4) the cells give up the room their own text is not using
  BEFORE anything is cut. A4 landscape now loses the end of the title and nothing else, with the
  title at 79 mm; the old shares cut the site address as well (50 mm for a 67 mm address) and gave
  the title 43.
- The arithmetic is a new module that imports nothing, `Na__LayoutEditor__TitleBlock__Cells__`.
  The Modern builder measures each cell's label and value and hands the numbers in. A config with
  no `Flex` row shares the spare room in proportion to `WidthMm`, which is exactly the old
  behaviour - a stale cached config still draws the old strip rather than a broken one.
- A value that fits is printed as it is, never sent back through `FitText`: the cell was sized FROM
  that measurement, and asking about `cell - padding * 2` can land femtometres under it and eat the
  end off a value the cell was built to hold (the caption bug of SheetChrome v1.8.0).

**Status: what the drawing is issued for**
- The last cell on the right. Twelve statuses in the order a job moves through them: PRELIMINARY,
  FOR INFORMATION, FOR COMMENT, FOR COORDINATION, FOR APPROVAL, FOR PLANNING, FOR BUILDING CONTROL,
  FOR PRICING, FOR TENDER, FOR CONSTRUCTION, AS BUILT, SUPERSEDED. The list is
  `LayoutEditor__TitleBlock__Statuses`; both boxes below follow it.
- IN THE SHEET PANEL it is a box, the one title block field that is picked rather than typed - a
  status typed by hand is how a pack ends up saying "For Planning", "FOR PLANNING" and "Planning".
  It writes `Sheet__Fields__Status` like Date or Drawn By: one undo step, kept by the draft.
- IN THE DRAWING REGISTER'S EDIT TABLE it is a STATUS column with the same box on every row, saved
  through the register's confirmed R2-and-local transaction like the phase. It is the one key
  that may be cleared, and clearing it is asked about in its own words.
- NOTHING PRINTS UNTIL ONE IS CHOSEN. `StatusDefault` ships empty: every drawing made before the
  field existed would otherwise start claiming a status nobody gave it, and a wrong status on an
  issued drawing is worse than none. Where a default IS configured, "Not set" is stored as an
  empty string, or choosing it would quietly print the default (`Na__LeCfg__StatusToStore`, asked
  by both boxes so they cannot come to store differently).
- HELD PER SHEET, not per pack: one sheet is superseded while the rest go to tender.
- A status that has since left the config stays on the sheet that carries it and still shows in
  both boxes, the way a retired phase does.

**The undo that would have quietly reverted a saved status**
- The register saves to R2 there and then, so the history rewrites the register's own fields into
  every kept undo step - otherwise an undo of ANY older step restores a whole-sheet snapshot and
  carries the old value back over what R2 now holds. `Status` was not on that list (it did not
  exist). Added, and proved: after a register save of FOR TENDER, three undos of older steps that
  each held a different status all left it at FOR TENDER.

**Also fixed, found on the way**
- The text drawn while the logo loads, or if it cannot be fetched, read VALE GARDEN HOUSES - left
  behind by the port. A drawing exported with the logo missing would have printed another firm's
  name. It reads NOBLE ARCHITECTURE.
- The register's expanded row spanned a bare 8 columns against a table of nine, so the panel of
  row tools and revision notes stopped one column short of the right edge. It now counts the
  headings, which are one constant.
- `GetTitleBlockSetup`'s logo fallbacks (cell width, maximum height, both paddings) still described
  the Vale strip it was ported from. They mirror the shipped JSON now, as the row fallbacks do.

**Not done, deliberately: STATUS is not a column of the PRINTED register**
- Measured with the real fonts on PS01's four rows: with STATUS added the columns ask for 200 mm of
  a 182 mm page, the shortfall rule takes room off every column, and STATUS is left 21 mm where
  "FOR CONSTRUCTION" needs 31 - it breaks onto two lines and SCALE's "1:500 & 1:1250" with it. The
  same wall TYPE hit. Every row carries `status`, so printing it is one config line
  (`StatusColumnNote` has it), but the page has to go landscape, or lose a column, first. Adam's call.

**Files**
- New: `10__Core__SheetSurface/Na__LayoutEditor__TitleBlock__Cells__.js`,
  `80__Testing__PrototypeEnvironment/Na__Test__TitleBlockCells__.test.mjs` and `.html`.
- `TitleBlock__Modern__` 1.2.0, `ConfigState__SheetSetup__` 1.4.0 (statuses, StatusToStore, the
  fallbacks), `ConfigState__` 1.26.0 (re-export), `SheetRecords__` 1.22.0 (BuildFields answers
  Status), `History__` 1.6.0, `Panel__Sheet__` 1.4.0, `Register__Editor__` 1.1.0,
  `Register__Transactions__` 1.2.0, `Register__Pdf__` (rows carry status),
  `Styles__DrawingRegister__.css` (a ninth column), `AppConfig__.json` (TitleBlock Rows, logo cell,
  Statuses, StatusDefault, two labels, the register's StatusColumnNote).
- The classic (scanned) title block is untouched: its scan has no status box to write into.

**Tested**
- Cell widths chosen from measurement, not by eye: every realistic value was measured with the
  vendored jsPDF and the real Open Sans cut at 2.2 mm before a width was picked (Document ID 24
  holds WW88_T04_D100 at 20.4; the 28 mm module holds the site plan's "1:500 & 1:1250 @ ISO A1" at
  27.9; Status 30 holds FOR BUILDING CONTROL at 28.6).
- `Na__Test__TitleBlockCells__.test.mjs`: 31 checks of the solver against PS01's measured values on
  A1 to A4 portrait - fixed cells stay fixed, identical dividers for a short and a long title,
  the title fits A3, a 120 mm title borrows in proportion to slack, an old no-Flex config draws the
  old shares. `Na__Verify__Exports__` passes over 353 files.
- `Na__Test__TitleBlockCells__.html` builds eight sheets through the REAL chrome builder with Open
  Sans loaded and reads the cell widths back off the drawn rules: nothing cut on A1, A2 or A3,
  only the title on A4 landscape.
- In the app, real modules, on PS01 D02 with every write refused or faked (the one R2 write was
  answered 200 and never sent; its payload carried the status). The strip drew 40 / 36 / 70 / 272 /
  24 / 28 / 28 / 28 / 28 / 30 with the 84 character title whole. The panel box: pick, undo, redo,
  the longest status, and "Not set" leaving no key behind. The register box: declined at the
  confirmation (box goes back, nothing written) and confirmed. Browser drafts cleared afterwards.
- NOT tested: a real download of a sheet PDF. The PDF is painted from the same primitive list as
  the screen and no painter was touched, so it is expected to match, not proved to.

**Not yet in ValeVision.** Its Modern title block is still the verbatim twin this one was until today.

# ---------------------------------------------------------
## TrueVision3D v2.78.1  -  19-Sep-2026
### jsPDF's align Does Not Know About Letter-Spacing, So the Letterhead Hung Off the Page

**Overview**
- Adam, on the register: "use narrower margins on the left and right sides of the page, and
  better align the text with the margin. Can you see the text is too far to the right of it?"
  He was pointing at two different faults that looked like one.
- The margins were wide: 18mm on A4. Now 14mm, and the Project Specification's page came in
  with them (18mm sides to 14mm) because "the margins could do with being a bit tighter again".
  The two documents of a pack now hold the same text block.
- The alignment was a real bug. **jsPDF's `align: 'right'` ignores `setCharSpace`**: it measures
  the string untracked, so tracked text overhangs its anchor by the whole of the tracking.
  Measured before the fix: the running head ended at 561.8pt with the right margin at 544.3pt -
  **17.5pt (6.2mm) off the end of its own margin**. The footer's page count did the same, and
  every centred table heading was out by half the tracking for the same reason.

**One door for placing a line**
- `Na__LeRegPdf__Draw` measures the string itself, tracking counted in, and positions it
  left-aligned. Nothing in this module calls jsPDF's `align` any more, and `setCharSpace` is set
  and cleared in that one function so no later draw can inherit it.
- Verified by measurement, not by eye: across all five fixtures and every page, **zero words
  cross either margin**, worst overshoot 0.0pt. The running head and the footer both end at
  555.5pt against a 555.6pt margin edge.

**The browns are gone**
- Adam: "get rid of all of the brown colours in the style and make them the more consistent blue,
  like with the spec document and the rest. The brown colours are a hangover from porting it from
  another app."
- He was right, and it was measurable: **25 of the 26 colours** in
  `Na__LayoutEditor__Styles__DrawingRegister__.css` had a red channel above their blue. Ink
  `#5c594f`, muted `#8d8063`, rules `#e1ded8`, fills `#eeece9` / `#f8f6f3`, focus `#8b8068`,
  drop `#ad9972` - a whole warm palette carried over from the app it was ported from.
- They are now the Project Specification's: `#172b3a` ink, `#6c757d` muted, `#d9dfe4` rules,
  `#eef1f4` head fill, `#f6f8fa` stripe, `#ccd3d8` borders, `#1a7fc4` focus and drop. The shared
  ones read `--Na_Le_Ink` and `--Na_Le_InkMuted` from `Styles__Surfaces__`.
- **The printed register moved with the page that edits it.** `InkColour`, `MutedColour`,
  `HeaderColour`, `StripeColour` and `RuleColour` in the config - and their fallbacks in
  `GetDrawingRegisterSetup`, which would otherwise have reintroduced the browns the moment the
  block went silent - are the same blue-greys. Edit and Read still agree.
- Two inline colours in the delete dialog that named their own reds now read tokens.

**What stayed warm, deliberately**
- The caution amber and the stop red. A warning is a meaning, not a brand, and those two are now
  the specification's exact warning and error colours (`#fff6e3` / `#f0d9a8` / `#8a5a00` and
  `#fdf0f0` / `#9b3b3b`) rather than the register's own, so both documents raise a flag the same
  way. Say if they should go cool too.

**Verification**
- Five fixtures, every page: zero words over a margin, Open Sans embedded throughout.
- A warmth audit of the register stylesheet: no colour has a red channel above its blue except
  the six semantic warning and error values listed above.
- Named export resolution passes on all 340 files; both edited modules syntax-check clean.
- NOT verified in the running app: the recoloured Edit view and the tightened specification page.
  Both need the real app, and entering the Layout Editor writes to R2.

# ---------------------------------------------------------
## TrueVision3D v2.78.0  -  19-Sep-2026
### Selecting Something Is the First Half of Moving It, So Select Now Picks Move Up

**Overview**
- Adam: "Everything apart from viewports, dimensions, and the endpoint of leaders, when selected,
  automatically changes to the move tool because it is the most logical tool to use... unless
  double-clicking. If you double-click on a leader really fast, it should enter. If you double-click
  on a group, it should enter. If you double-click on a vector, it should enter it, and then it's the
  same."
- The 17-Sep Move tool (v2.59.0) was a safety catch: with Select up a drag moves nothing, so a
  drawing is never shifted by a stray drag. It worked, and it made every ordinary move three steps -
  click, M, drag - for the things that are moved all day. The catch is kept exactly where it matters
  and taken off everywhere else.

**What picks Move up, and what does not**
- A Select press on TEXT, a VECTOR, a LEADER by its bubble, its note or its curve, or a GROUP
  (a parametric one is a group) picks the Move tool up, and THE SAME PRESS CARRIES ON INTO THE DRAG.
  Select-and-move is one gesture again. A box that leaves only those kinds selected picks it up too.
- A VIEWPORT, a DIMENSION and a LEADER'S ENDPOINT do not. The first two still wait for M, which is
  what the catch was for; the endpoint re-points the leader and was always a grip, not a move. Nor
  does a text item's rotate grip, the vector that is open for editing, or anything on a locked layer.
- Several selected items pick Move up only when EVERY one is a listed kind. A set moves as one, so
  one viewport or one dimension among them and the lot waits for M.
- The kinds are config: `EditScope AutoMoveKinds`, with `AutoMoveOnSelect` to turn it all off.

**A Move that came up by itself goes back down by itself**
- This is the part that makes it safe. `PickUpMove` / `PutDownMove` / `IsMoveAuto` in the tool state:
  the tool remembers whether Move was ASKED for. One that was not goes back to Select on a press on
  anything that would not have picked it up, when the selection empties (Delete, a cut, an undo -
  the sheet tools listen to the model and the container events and run `SettleAutoMove`), and when a
  double click steps inside. So a viewport can never travel on a Move nobody asked for: by the time
  the press asks "is Move up?", it is not.
- M, or the Move button, is still a Move that STAYS - over bare paper, over viewports, until another
  tool is picked. `SetTool` is the deliberate path and always clears the flag.
- It only ever comes UP on a press or a box. Undo bringing a deleted note back does not flip the
  tool under a hand that is nowhere near the sheet.
- One function answers "would a press here pick Move up" (`PicksUpMove`), read by the press AND the
  hover cursor, the way `CanMoveWhole` already was - so the cursor cannot promise a move the press
  will not make. Under Select the four-way arrow now shows over exactly the things a press would
  move, and an automatic Move shows it in those places ONLY; a deliberate Move still wears it
  everywhere. A leader's bubble wears the tool's own arrow, not the system one.
- `DragFor` did not change by a line. It still only asks whether Move is up; it just finds it up
  more often.

**The double click, which is where this could have gone wrong**
- DragThresholdMm is 0.5 mm of paper, which is under TWO PIXELS on screen at any zoom. Harmless while
  Select could not move anything - and the moment it can, the second press of a fast double click
  nudges the note on its way in. It already did for a leader's bubble, which Select has always
  dragged: that is the "really fast" in Adam's message.
- A PRESS THAT PICKS IS A PICK FIRST. The press that selects something, and the second press of a
  double click, must travel `PickDragPx` (8) on screen before it moves anything - wherever a double
  click means something: a whole-object move, a viewport's frame or content, a leader by any part,
  a dimension's value. A press on something already selected moves at the ordinary threshold, and
  vertices, measured points, crop handles and the rotate grip keep it always: nothing opens there,
  and precise work wants no dead zone.
- A pointerdown carries NO CLICK COUNT (only the click after it does), so the second press is known
  the way the browser knows it: same item, within `DoubleClickSlopPx` and `DoubleClickMs` of the
  last press.
- AND THE OTHER WAY ROUND. The browser counts clicks when the button goes DOWN and never looks at how
  far the pointer went before it came up, so "click to pick, then at once drag it across the sheet"
  ends in a `dblclick` - which would have opened the text that had just been moved. That sequence is
  now an everyday one, so a double click whose second press travelled is ignored.
- A double click puts an automatic Move down before it opens anything: a group (nothing selected
  inside yet), a vector (a press in there is about its points - the body of the open vector shows
  the plain arrow and moves nothing), a dimension, a text, a leader's text, a viewport's content.
- "And then it's the same": inside a group a press on a member picks Move up and drags that member
  alone; double click the member and you are inside the vector, back under Select.

**Small things that would have been papercuts**
- The notes margin's drag handle hid itself under any tool but Select, so picking a note would have
  taken it away. It stays up under an automatic Move (`IsMoveAuto` is exported for it).
- The Select and Move tooltips and the M key's note say what now happens.

**Files**
- `30__System__SheetTools/`: `SheetTools__State__` (LastPress, PressTravelled), `__ToolState__`
  (ApplyTool, PickUpMove, PutDownMove, IsMoveAuto; the tool event's detail carries `auto`),
  `__HitResolution__` (PicksUpMove, SelectionPicksUpMove, HoverCursor), `__PointerPress__` (the
  tool follows the press, IsRepeatPress, SettleAutoMove, the double click), `__PointerDrag__`
  (DragStartMm, PressTravelled, the box), `SheetTools__` (the two listeners, the export).
- `ConfigState__ToolSetup__`, `AppConfig__.json` (Selection and EditScope blocks, two labels),
  `KeyMappings__.json` (the M key's note), `Toolbar__` (the two fallback tooltips), `MarginGrip__`.

**Tested**
- `Na__Verify__Exports__` and `Na__Verify__ModuleGraph__` pass over 352 files.
- In the app, real modules, on a scratch copy of PS01 D01 with every write refused (the guard logged
  none) and the real sheets byte-identical afterwards. 64 checks with synthetic pointer events, each
  one undone: the pick, the put-down on bare paper, press-and-drag in one gesture, 5 px of wobble
  moving nothing, a fast wobbly double click opening text, a leader's bubble and a group with nothing
  moved, click-then-drag's trailing double click ignored, the endpoint putting Move down while its
  grip drag still starts, a dimension and an unlocked viewport refusing to move from an automatic
  Move, M moving that viewport and staying up, Delete settling back to Select, Shift-adding a vector
  (stays) and a dimension (goes down), a box of listed kinds and a box with a dimension in it, Enter
  stepping into a vector, a vertex still dragging inside it, and the margin handle. (The two-item
  drag landed 12.4 mm for a 10 mm pull: a set move snaps to the linework, as it always has.)
- NOT tested with a real mouse: the pane has no input, so the double click timing is proved against
  the rule, not against a hand. `DoubleClickMs` 500 matches Windows' default; if Adam's is longer,
  that is the number to raise.

**Not yet in ValeVision.**

# ---------------------------------------------------------
## TrueVision3D v2.77.0  -  19-Sep-2026
### The Tab and the Noodle Were Both in the Pictures, and I Read Them as Decoration

**Overview**
- Adam, on v2.76.0: "You still need to build out the extra tab I mentioned... Also, there needs to be
  the linking noodle that you can see when the dynamic object is selected, so you can see what it is
  tied to." He had mentioned both - in his images, not his words. The green box at the top of the
  right column in image 4 I had taken for "put the settings here". The blue curve from the scale bar
  to the drawing in image 3, labelled LINK, I had taken for a sketch of the IDEA of a link. It was a
  drawing of the thing.
- So the brief was gone through again, line by line and image by image, against what exists. The
  table is section 10 of `TrueVision__PLAN__ScrapbookSystem__.md`. Two things were missing, both
  below; one reading is still mine and marked for Adam to confirm.

**The Scrapbook tab**
- The right column has two tabs, **Properties** and **Scrapbook**. All three libraries - Standard,
  Parametric, Custom - are on Scrapbook; every section that was in the right column is on
  Properties. The left column is back to the sheet and its layers, where the libraries had been
  queueing behind Sheet and above Margin Notes.
- `Na__LePanels__RegisterTab`, `SetActiveTab`, `GetActiveTab`, and `spec.tab` on a section. A section
  that names no tab belongs to the column's first, so Properties is registered first and not one of
  the five property panels had to be told. A column nobody gives tabs is exactly what it was: the
  strip only shows at two.
- The strip is the first thing in the column's scroller and sticks to its top, which leaves the
  column's own layout - scroller beside width grip - untouched.
- BOTH TABS ARE STYLED ALIKE, the sheet tab strip's look a size down. Which is up is said by weight
  and by the join to the column below, never by a mark one has and the other lacks. Checked, not
  assumed: each tab's computed style when up is exactly the other's when up.
- A section off its tab is put away by `is-off-tab`, never by the `hidden` attribute - that one is
  `SetSectionVisible`'s, and the Standard library is both on its tab and hidden on an architectural
  sheet. `Refresh` passes an off-tab section by, so the Custom library's files are not read until the
  tab is first opened.
- A drop does NOT switch tabs. Items are usually placed several in a row, and what was dropped
  already has its grips on the sheet; its settings are one click away.

**The link noodle**
- Select a parametric element and a noodle runs from a round socket on it to what it reads its scale
  from - a cap on the nearest edge of the viewport, whose frame is outlined. An element tied to
  nothing shows a HOLLOW socket and no noodle, so "is this bar following anything?" is answered by
  looking at it.
- DRAG THE SOCKET TO RE-TIE IT, as in any node editor. A dashed live noodle follows the pointer and
  whatever it is over that it could be tied to lights up. Let go on a 2D viewport: tied to that
  drawing, at its scale. On the title block: tied to the sheet's own scale. On bare paper: untied,
  keeping the scale it has. Escape puts it back. One undo step each, and a toast - "Tied to Existing
  Floor Plan (1:100).", "Untied. It keeps 1:20." - because an untie is otherwise invisible.
- It is SVG in the handles layer, drawn in millimetres on a viewBox the size of the page with every
  width divided by the zoom, under a white casing so it reads over black linework and white paper
  alike. It keeps the `na-le-grip` class, so whatever clears the grips clears it.
- `...ScrapbookParametric__LinkNoodle__.js` draws what the link module describes and asks it to
  change it. What a link IS stays in `ViewportLink__`, the one module that knows what a viewport is.

**A second kind of link: the sheet's own scale**
- The red DRAG arrow in image 3 runs from the bar down to the title block's Scale cell. My reading:
  a bar can be tied to the scale the title block quotes. `{ Link__SheetId, Link__Kind : 'sheet' }`
  follows `Na__LeDrawScale__SheetDenominator`, inside the same undo step as the viewport change that
  moved it, by the same before-announce hook. An element dropped out of reach of any drawing is now
  tied to that instead of to nothing. ADAM TO CONFIRM this is what the arrow meant.
- THE SCALE CELL IS FOUND, NOT WORKED OUT. The title block lays its cells out privately. Rather than
  copy its arithmetic, the noodle reads the cell off the Scale label the chrome SVG already holds at
  the cell's left padding, with the next label along the baseline as its far edge. That was the
  right call within the hour: another session re-laid-out the Modern strip the same evening - fixed
  and flex cells, a wider logo, a new Status field - and nothing here had to change.

**Tested**
- Real modules on scratch copies of PS02 D21 and D24, every write refused but `/r2/read` and the
  scrapbook route, on `Na__Test__ScrapbookServer__.py`. The tab: 11 checks. The noodle: 19 - drawn to
  the right edge, target outlined, socket filled or hollow, dragged to another drawing, to the title
  block, to bare paper, Escape byte for byte, undo AND redo for each, and a sheet-tied bar following
  the sheet's scale in one step. The Standard library from its new home, and a bar on a site plan
  reading 1:500 or 1:1250: 9. Afterwards the real sheets were byte-identical and nothing had been
  written.
- The harness asserted the scratch sheet's id before every mutation this time (v2.76.0's lesson).
- NOT YET DONE: Adam's own test in his browser, through the restarted 8090 server.

**Files**
- New: `57__Feature__ScrapbookParametric/Na__LayoutEditor__ScrapbookParametric__LinkNoodle__.js`.
- Shared, additive: `40__Ui__Panels/Na__LayoutEditor__PanelHost__.js` 1.4.0 and a new region at the
  foot of `Na__LayoutEditor__Styles__Panels__.css`; `05__Core__ModeController/...ModeController__.js`
  1.18.0 (the two tabs, and the three libraries moved across).
- Mine: the three scrapbook panels, `ViewportLink__` 1.1.0, the engine (every grip point a type
  gives goes through `HandlesOf`), `ScaleBar__` (the link point), `Grips__` 1.1.0, both configs, the
  parametric stylesheet, the plan.

# ---------------------------------------------------------
## TrueVision3D v2.76.1  -  19-Sep-2026
### DWG No.

**Overview**
- Adam, on the printed register: "this first column is too big. Just have the column name DWG no."
  He was pointing at a heading setting its own column - "D01" is a third the width of
  "DRAWING No.", so the heading, not the content, was deciding how much of the page it took.
- `DRAWING No.` to `DWG No.`, and its `MinMm` floor 20 to 15 so the shorter heading is what
  actually governs rather than the floor taking its place. Measured from the built PDF: the
  column went 28.7mm to 22.3mm, and the width went to DOCUMENT NAME.
- The Edit table's heading array says the same thing, so the two views of one document agree.

**Also fixed, found on the way**
- `Na__LeCfg__REGISTER_COLUMNS`, the fallback used when the config block is silent, still
  described the OLD six-column register: a `code` column, no PHASE, no DOCUMENT CODE, and the
  TYPE column that v2.71.0 dropped. A fallback that does not match the shipped config is a trap -
  it would have produced a different register the moment the block was missing or malformed - so
  it has been brought into line as well as renamed.

**Verification**
- Built from the real module and read back by word position, not eyeballed: the heading row is
  `DWG No. | PHASE | DOCUMENT CODE | DOCUMENT NAME | SCALE | SIZE | REV`, with column one
  63.1pt wide where it was 81.5pt.
- All five fixtures still build with Open Sans embedded; named export resolution passes on 340
  files.

# ---------------------------------------------------------
## TrueVision3D v2.76.0  -  19-Sep-2026
### Two More Scrapbooks, a Scale Bar That Reads the Drawing Above It, and the Redo That Proved a Listener Cannot Go First

**Overview**
- Adam: "I need a way to be able to save and insert common elements, but we need two versions in the
  main drawings: a custom scrapbook, and a parametric element scrapbook. Set both up as different
  subsystem folders... because both will function very differently." The first parametric element is
  the scale bar he draws by hand under every drawing title: "Think dynamic blocks in AutoCAD."
- Three libraries now, one way of dropping. The v2.53.0 Scrapbook is the Standard one and the host;
  `56__Feature__ScrapbookCustom` and `57__Feature__ScrapbookParametric` are new. All three go through
  the item clipboard's `InsertSet`, so whatever lands is ordinary vectors and text: it moves, copies,
  prints, exports, ungroups and undoes like anything drawn by hand. NO NEW RECORD KIND - a
  `Sheet__Parametrics` collection would have needed a hand in the markup bridge, hit resolution,
  selection, the move tool, the clipboard, draw order, the eyedropper, snapping, the PDF exporter
  and the web viewer, and then all of it again in ValeVision.
- The plan, the map of what it plugs into, the traps and the ledger: `TrueVision__PLAN__ScrapbookSystem__.md`.

**A parametric element is a group with one extra block**
- `Group__Parametric : { Parametric__Type, Parametric__Version, Parametric__Params, Parametric__Link }`.
  `NormaliseGroup` rewrites `Group__Members` and nothing else, the clipboard clones the whole record
  and `InsertGroup` is handed `{ ...record }`, so the block already survives a load, a save, a draft,
  an undo, a copy and a paste. Nothing had to be taught that it exists.
- Its place on the paper is NEVER stored. The Move tool and a paste shift a group's members and know
  nothing of the block, so a stored origin is stale after the first move. Every type writes its
  origin as the first point of its first vector, and the engine reads it back from there.
- Regeneration edits IN PLACE: members updated slot for slot, extras inserted, left-overs deleted.
  Ids stay put, so an undo snapshot barely changes, the element keeps its place in the draw order
  and it stays on whatever layer it was moved to. The member list is rewritten BEFORE the
  left-overs go - the model prunes a group of fewer than two live members, block and all.
- Ungroup is explode, as in AutoCAD: the vectors and numerals stay, the parameters go.

**The scale bar is Adam's bar, measured**
- Read off the twelve bars he drew by hand on PS02 D21 and D22 (A2, 1:50), which all agree: five
  cells of 20 mm in two rows of 1 mm, the top row filled on odd cells and the bottom on even ones,
  `#666666` on `#172b3a` at 0.2 pt, an empty cell with no fill at all; numerals centred on each
  division 5.314 mm under the bar, 2.5 mm at the two ends and 2 mm between. The generated 1:50 bar
  matches his point for point and fill for fill (`Na__Test__ScrapbookScaleBar__.test.mjs`).
- A scale has a STANDARD, and changing the scale puts the bar back to it - his ask, so a 5 m bar is
  never left 50 mm long. Fourteen scales are tabled; every one is a 100 mm bar and all but four are
  the same 5 x 20 mm, so the bar looks the same under every drawing and only its numerals change:
  1:50 reads 0 1 2 3 4 5, 1:100 reads 0 2 4 6 8 10, 1:1250 reads 0 25 50 75 100 125. A scale with no
  row is solved towards the same 20 mm and 100 mm.
- Split first division cuts the first division into sub-cells (200 mm at 1:50) in the same checker.
  The checker counts every cell drawn, so it never stutters at the first numeral whether the split
  is five or four.
- The module imports nothing: parameters in, records out. It runs in Node exactly as the app runs it.

**Two grips, as on a dynamic block**
- An arrow off the far end STRETCHES, live, in whole divisions: nothing is announced during the drag
  and one undo step is taken on release. Escape puts the sheet back byte for byte.
- A triangle off the zero end opens a LOOKUP menu: From viewport, the scales, Split first division,
  Show units, Reset length. The same choices sit at the top of the right column while an element is
  selected, laid out to be read.
- The grips own their press. They are elements in the handles layer that take pointer events and stop
  them there; the stage listens in the bubble phase, so not a line of the pointer pipeline changed.
  The grip is destroyed by its own drag - every step repaints the selection - so the drag listens on
  the window and holds ids, never the element.
- A selected element's box reads "Scale Bar", above the box. "Group" inside the corner covered the
  first cell of a bar 2 mm tall.

**The link to the viewport system has a module of its own**
- `Na__LayoutEditor__ScrapbookParametric__ViewportLink__` is the only parametric module that knows what
  a viewport is. A dropped bar links to the nearest 2D viewport and takes its scale.
- A link names a sheet AND a viewport. `Viewport_001` exists on nearly every sheet, so a link whose
  sheet is not the one the element is on - a paste elsewhere, a custom item dropped in another
  project - is broken, and a broken link reads as no link. It is never re-pointed by accident.

**The bug a test of REDO found, and why it cannot be fixed with a listener**
- The first build followed a viewport's scale from a CAPTURE-phase listener on the model's change
  event, "so it runs before the history". Change the scale: the bar followed, one undo step, and one
  Ctrl+Z put both back. It passed. Then REDO brought back a viewport at 1:100 beside a bar at 1:50.
- The model dispatches that event ON window. For an event whose TARGET is window the listeners fire
  in the order they were added; the capture flag does not reorder them (proved in the pane, Chrome
  152 - capture only comes first for an event travelling THROUGH window from beneath it). The
  history is added first. It had snapshotted the old bar before the bar was rebuilt, so the step's
  "before" was whole and its "after" was not. An undo-only test passes both designs.
- `Na__LeModel__RegisterBeforeAnnounce`: `Touch` now runs registered hooks just before it dispatches,
  never for a restore. Derived data is brought up to date before anyone hears of the change, by
  construction rather than by order. Follow, viewport deletion and a custom drop were all re-tested
  with undo AND redo, byte for byte.

**The Custom Scrapbook is files**
- Select anything, name it, Save: one JSON file in a category folder of
  `51__LayoutEditor__UserScrapbookContent` beside Index.html, plus `UserScrapbook__Index__.json`, which
  is what lets the live website list a library it has no directory listing for.
- Made portable on the way out: layer ids, a dimension's viewport, a bubble's specification note
  link and a scale bar's viewport link are all facts about where it came from, and are left behind.
  Viewports are refused. A scale bar inside an item stays a scale bar, and re-links to the drawing it
  lands beside - inside the drop's own undo step.
- Saving goes through a new Flask blueprint, `na-apps/ProjectVision__TrueVisionScrapbook__Api__.py`.
  It names every file itself, saves only into category folders that already exist, rebuilds the
  index FROM THE FOLDERS so a file added by hand is picked up, and a delete MOVES the file to
  `00__Deleted__Quarantine` - the Project Manager's rule. Nothing in a request is ever a path.
- THE 8090 SERVER MUST BE RESTARTED to load the routes: it never reloads them. Until then the section
  says so in words, rather than failing.

**Shared code touched, all additive**
- `SheetModel__State__` (`RegisterBeforeAnnounce`, hooks in `Touch`), `SheetModel__` (the re-export),
  `SheetModel__Groups__` (`DeleteItems` silent flag), `15__Core__Markup/Groups__` (`RegisterLabeller`,
  answered inside `Render` because the box has two painters), `Grips__` (`RegisterGroupProvider`),
  `ModeController__` (two imports, three registrations), `Scrapbook__` (the preview draws leaders and
  dimensions), `Panel__Scrapbook__` (its tile drag moved out to `Scrapbook__TileDrag__`, shared by
  all three libraries), `ProjectVision__LocalServer__Main__.py` (one import, one registration).

**Tested**
- `Na__Test__ScrapbookScaleBar__.test.mjs` and `Na__Test__ScrapbookApi__.test.py` (26 checks, on a
  temporary folder). `Na__Verify__Exports__` and `Na__Verify__ModuleGraph__` pass over 351 files.
- In the app, real modules on a scratch copy of PS02 D21 with every write refused but `/r2/read` and
  the scrapbook route, served by `Na__Test__ScrapbookServer__.py` (launch entry `tv-scrapbook`): the
  REAL save blueprint pointed at a temporary folder, so a save, the index and the item file all
  round-tripped for real and the real scrapbook folder was never written.
- A FAULT IN MY OWN HARNESS, recorded because it will happen again: the first editor entry of a page
  session re-announces the drawings data, which replaces the sheet list and silently drops a scratch
  sheet made before it. The editor falls back to the first REAL sheet - which has the same viewport
  ids, so every check still passed, on D21's in-memory copy. Two runs went that way before a link
  naming `Sheet_002` gave it away. Nothing was saved: the guard logged no write attempt at all, and
  the model was restored byte-identical. The harness now enters once, waits for `loaded` to go
  quiet, makes the scratch sheet, and asserts `Sheet__Id` before every mutation.
- NOT YET DONE: Adam's own test in his browser, through the restarted 8090 server.

**Files**
- New: `55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__TileDrag__.js`; the five files of
  `56__Feature__ScrapbookCustom/`; the seven of `57__Feature__ScrapbookParametric/`;
  `na-apps/ProjectVision__TrueVisionScrapbook__Api__.py`; three tests in
  `80__Testing__PrototypeEnvironment/`; `TrueVision__PLAN__ScrapbookSystem__.md`.
- ValeVision: not ported. It needs ItemClipboard 1.1.0, SheetModel Groups 1.1.0, SheetModel State
  1.1.0, Groups 1.2.0 and Grips 1.8.0 first.

# ---------------------------------------------------------
## TrueVision3D v2.75.0  -  19-Sep-2026
### Safari Reads the First Manifest and Never Looks Again, and the First One Was the Wrong One

**Overview**
- Adam, on the iPad: follow the Share > Add to Home Screen card, tap the new icon, and "it loads up
  like a blank version of the app with none of the content, modal, or anything."
- The icon was opening `Index.html` with no `?project=` on it. Every Home Screen icon made from
  Safari since the install feature shipped (v2.9.0, 27-Aug-2026) has done the same, on iPhone, iPad
  and Mac. Chromium installs were never affected, which is why it went three weeks unseen.
- There was no iPad launch resolver to find, and never had been. The iOS side of the module was an
  instruction card and one belief, written down in three places: "Safari bookmarks the page the
  client is standing on." That is only true when the page has no manifest.

**The cause**
- `Index.html` carried a static `<link rel="manifest">` to the fallback file, and three lines below
  it the builder swapped that link's `href` for the per-project `data:` manifest. In Chrome DevTools
  that looks perfect: one link, a `data:` URL, the right `start_url`.
- Safari never sees the swap. Since 15.4 WebKit fetches the manifest the moment the FIRST
  `<link rel="manifest">` with a valid href is parsed (bug 229059, "Always fetch the first manifest
  if provided") and `DocumentLoader::loadApplicationManifest` returns early for the rest of the
  page's life once a loader exists. `HTMLLinkElement::process()` does call it again on an href
  change - into that early return.
- So the only manifest an Apple device ever held was the fallback, whose `start_url` was
  `../../Index.html`. When a manifest is present, Add to Home Screen launches its `start_url`, not
  the page. Bare URL, no project, empty scene.
- The per-project label survived, because `apple-mobile-web-app-title` is a meta tag and is read at
  share time. That is what made it so misleading: an icon correctly named after the project, that
  opened on nothing.

**The fix**
- `Index.html` has no static manifest link, and says why in capitals. The builder creates the link
  and gives it its `href` BEFORE it joins the document, so there is exactly one manifest for WebKit
  to find and it is the right one. If a static link ever comes back the builder warns in the
  console, because on Safari it has already won by then.
- The fallback manifest lost its `start_url`. A manifest without one launches the page it was
  installed from, query and all (`parseStartURL` returns the document URL), so the degrade path can
  no longer produce an empty app on any engine. Chromium will not raise its own prompt without a
  `start_url`, so on that path install is by the browser menu - a rare missing prompt beats an icon
  that opens on nothing.
- `refresh()` - the rebuild when the project data brings a nicer name - now documents that it
  reaches Chromium only. The launch URL is the same in both builds, which is the part that matters.

**A second fault on the same road: every first launch reloaded itself**
- `clients.claim()` raises `controllerchange` on a page nothing was controlling, and the registrar
  treated that as an update: load the model, then reload and load it again. A Home Screen icon gets
  storage of its own, empty, so for an installed iPad app that was EVERY first launch. It is also
  the "a new origin reloads once" that the local testing notes have been working round.
- The bridge now samples `navigator.serviceWorker.controller` before registering. The first claim
  passes without a reload; any change after it is a real update and reloads as before, still held
  while a model is loading or the Layout Editor has unsaved work.

**Icons that are already out there**
- They cannot be repaired from here: the bare URL is stored inside the icon, and the icon's own
  storage has never seen a project to fall back on. So the installed-standalone handler now spots
  that launch - installed, Safari family, no project in the URL - and shows a card saying what
  happened and how to replace the icon (remove it, open the project link in Safari, add it again),
  worded for iPhone, iPad or Mac. It is the one card allowed to render inside an installed app
  (`allowWhenInstalled`), and it sits above the boot loading overlay.
- `PWA_SW_VERSION_TOKEN` bumped to `2026-09-19-1` so a broken icon's own copy of the shell reaches
  that handler on its next launch rather than the one after.

**Tested**
- Safari cannot run on the studio PC, so the rule was replayed instead: the real `<head>` of the
  LIVE `Index.html` and of the fixed one, written into a sandboxed frame at the true PS01 URL, with
  WebKit's rule applied synchronously (first valid link wins, at insertion). Live: latched by the
  parser on the static file, icon launches `/Index.html`. Fixed: latched at `appendChild` on the
  `data:` manifest, icon launches `/Index.html?project=PS01&project-folder=PS01__MustersRoad&year=26`.
  Static link put back with the new fallback: still launches the project. Repeated with the scripts
  cached, because an asynchronous first attempt gave a timing-dependent answer and was thrown away.
- The bare live URL opened in a browser is the screen Adam described: header, Tools & Settings,
  toolbar, empty scene.
- Registrar on a fresh origin: first install logged "no reload needed", the page marker survived,
  the model finished loading. A second `controllerchange` on a page controlled at boot reloaded it.
  On PS01 it was correctly held by the unsaved-work probe.
- Repair card: shown for an iPad Safari descriptor on the bare URL; not shown on a project URL, and
  not shown for a Chromium install. The standalone rule reads
  `.na-pwa-install:not(.na-pwa-install--notice)`.
- NOT tested: a real iPad. The WebKit behaviour is read from its source and release notes, not
  observed. The check is: delete the old icon, open a project link in Safari, add it, launch it.

**Files**
- `Index.html` (static manifest link removed), `62__Feature__AppInstallability/`:
  `TrueVision__Pwa__Manifest__Builder__.js` 1.1.0, `TrueVision__Pwa__Manifest__Fallback__.webmanifest`
  (no `start_url`), `TrueVision__Pwa__ServiceWorker__Registrar__.js` 1.2.0,
  `TrueVision__Pwa__Handler__InstalledStandalone__.js` 1.1.0, `TrueVision__Pwa__PromptUi__.js` 1.1.0,
  `TrueVision__Pwa__Handler__IosSafari__.js` 1.0.1 (header only), `TrueVision__Pwa__ServiceWorker__Logic__.js`
  1.8.0 (token), `README__PwaInstallability__.md`,
  `03__Style__AppStylesheets/Na__UiFeature__Styles__PwaInstallability__.css` 1.1.0.

# ---------------------------------------------------------
## TrueVision3D v2.74.0  -  19-Sep-2026
### One Client, One Site, One Place to Type Them

**Overview**
- Adam: "it's very rare that you, on a project like this, use a different client or address. In
  fact, I've never really actually done it in my career... otherwise, every time you edit a
  different drawing or create a new drawing, it then means you have to laboriously refetch and
  retype all this."
- He was right, and PS01 was already showing the damage. Three of its four sheets ended the site
  address `NG2 7DD ` with a trailing space and one did not, and all four said *Nottinghamshire*
  where the project's own quotation said *Nottingham*. Four copies of one fact, disagreeing.

**The pack owns the two fields, and each sheet carries a switch**
- `LayoutEditor__DrawingsData__CommonClient` and `...__CommonSiteAddress` hold them ONCE, beside
  `ClientDimensionsEnabled`, because they are the same kind of thing: a fact about the project,
  not about any one sheet.
- The Sheet panel gains one row above Client, reading **Common**, ticked. On, the Client and Site
  Address boxes show the pack's values and typing into either retypes the whole pack. Off, this
  one sheet keeps its own.
- One switch covers both fields, not two. A sheet that needs its own address almost always needs
  its own client with it, and a row of half-linked fields is harder to read than it is useful.
- Turning it off writes BOTH current values onto the sheet first, so the override opens with the
  right address already in it and a word gets edited rather than a postcode retyped. Turning it
  back on drops the sheet's copies, which is what makes the pack agree with itself again.
- `Sheet__CommonFields` is written only when `false`. Absent reads as on, so every sheet ever
  drawn joins the pack by default and only a deliberate opt-out is recorded.
- `BuildFields` resolves the two keys from the pack when a sheet is on Common, ahead of anything
  stored on the sheet. Everything downstream - the screen, the PDF export, the register PDF, the
  exported file name - reads `Na__LeModel__GetFields`, so the one change covers all of them.

**Where the two facts come from: the Project Admin record**
- `Na__LayoutEditor__ProjectRecord__.js` reads the site address from the project's own
  `ProjectAdmin__Quotation(s)__.json` (`projectAddress`) and the client from
  `ProjectAdmin__ProjectConfig__.json` (`clientDrawingName`). A new project fills its title
  blocks in by itself.
- **These files are not on R2.** The model sync carries only the TrueVision and PlanVision
  content folders, so `cdn.noble-architecture.com/.../10__ProjectAdmin__AppContent/...` answers
  404. They are served by the website itself, beside every other repository file, which is one
  path that works on the live build and on a local static server alike - verified 200 on
  `www.noble-architecture.com` before any of this was built on.
- Read only, and by name. The admin system owns those documents; a drawing app that could
  rewrite a quotation is a drawing app that will one day rewrite a quotation.

**The client's name on a drawing is not the client's record**
- The full record - given name, email, telephone, correspondence address - is PII and stays
  exactly where Adam put it: AES-256-GCM encrypted in R2, decryptable only by the admin Worker
  holding `CLIENT_DATA_KEY`. TrueVision does not ask for it and cannot read it.
- `clientDrawingName` is a deliberately smaller thing - `{ salutation, initial, surname }`,
  composing to "Mr P. Samra". Adam: "their name on the drawing of their address is public domain
  anyway... less about putting their actual first and second name on and less about making it
  easier for the data online, if it's stored anywhere unencrypted, to be easily searched."
- So the salutation is stored, because a title block prints one and a title block has always
  printed one; and the given name is not, because nothing on the drawing needs it. A plain
  string is accepted too, for a company or a joint surname the parts do not fit.
- `_apply_admin_config_fields` in the ProjectVision Project Manager writes the three parts, so
  the field is maintained where every other project fact is maintained.

**Migration adopts the sheets, never the record**
- A pack that has never had common values takes them from its own sheets: the value most of the
  pack already agrees on, trimmed, wins; sheets that match lose their copies and stay on Common;
  a sheet that genuinely differs is switched off Common and keeps exactly what it was printing.
- It does NOT take them from the admin record. An issued drawing must not quietly change its
  printed address because a quotation spells the county differently. The record is *offered*
  instead - one line under the fields, with a **Use it** button, shown only when there is a real
  difference and only on a sheet that is on Common, because a loose sheet would not show the
  change the button makes.
- Only a project with nothing typed anywhere - a new one - seeds straight from the record.
- The seed marks the model dirty and rides out with the next save; it never writes to R2 on its
  own, the same way the v2.21.0 drawings migration lands.

**Undo had to be taught where the two values live**
- Caught late, from the Scrapbook session's note that the model's change event fires listeners
  in registration order. Chasing whether that bit this feature turned up something worse:
  `Na__LeHist__OnChanged` snapshots `JSON.stringify(sheet)`, and the pack's two values are on
  the drawings block, not on a sheet.
- So retyping the client on a sheet that is on Common - the single most common edit this
  feature exists for - changed not one byte of the sheet record. The step test read that as
  "an announce that changed nothing", recorded no step, and left Ctrl+Z to reach past it to an
  older, unrelated step. Worse than no undo: a surprising one.
- A history step now carries `common` beside `json`, the changed-nothing test reads both
  halves, and `Apply` takes the step rather than its json so it can put the pack's values back
  before the announcement. `register-updated` rewrites `step.json` only and is unaffected.
- Verified in the app: retype the client, Undo enables, Ctrl+Z restores it on the panel AND the
  printed title block, Redo replays it, and D02 follows both ways because the pack really moved.

**Checked**
- 31 assertions against the real modules and PS01's real sheet records, including the one that
  matters: what each title block prints is unchanged by the migration apart from that invisible
  trailing space.
- In the app on PS01: Common ticked on all four sheets, one client and one address on the pack,
  the offer showing *Nottingham* against the drawings' *Nottinghamshire* without touching them.
  Untick D01, give it its own address, and D02 and D04 do not move; retype the client on D02 and
  D04 follows while D01 does not; Ctrl+Z puts the override back. No `/r2/write` was attempted at
  any point, and PS01's project data on disk is byte-for-byte what it was.
- A missing repaint after **Use it** turned out to be the hidden Browser pane's dead
  `requestAnimationFrame`, not the code: shimmed onto a timer, the title block repaints at once.

# ---------------------------------------------------------
## TrueVision3D v2.73.0  -  19-Sep-2026
### Ctrl+S Had to Blur Before It Could Save, Because the Button Was Getting That for Free

**Overview**
- Adam, after the close guard landed in v2.67.0: "Yes, add Ctrl+S." The guard makes losing work
  harder; a save key makes it rarer, which is the better half of the same problem.
- It is not where the other Edit chords are, and it does one thing before saving that the Save
  Sheets button never had to do for itself. Both are the entry.

**Why it is not with Ctrl+Z and Ctrl+C**
- Those are answered by the sheet's own keyboard, which is attached only while a drawing tab is up.
  Open the specification or the register and it has stood down - correctly, because its keys mean
  nothing there.
- Saving means something on all three. So `Edit__Save` is answered once by the mode controller, on
  `document` in the capture phase, for as long as the editor is open, and the sheet's keyboard is
  left exactly as it was. Capture also means the key is taken before the browser is told, which is
  the point: Ctrl+S would otherwise offer to save the page as a file over the top of a drawing.
- The key is taken whenever an editable editor is open, even when the save is a no-op. A read-only
  web viewer keeps its own Ctrl+S - there is nothing there to save.

**The blur, which is the whole trick**
- Panel fields report on `'change'`, which fires on blur or Enter and NOT on every keystroke. The
  Save button never had to think about this: clicking anything blurs the focused field, so the
  value being typed committed on the way to the button.
- A keyboard shortcut blurs nothing. Without help, Ctrl+S pressed while typing a dimension offset,
  a margin heading or a lineweight would have saved the OLD value and left the new one sitting in a
  box - the exact failure the shortcut exists to prevent, delivered with a confirmation toast.
- So the handler commits the paper's text tool the way the specification and register tabs already
  do, then blurs the focused field if it is inside the editor host. Focus is not restored: that is
  what the button does too, and a field rebuilt by its own change event is a different node by then.
- Proven in the running app: the model read `PROBE TWO` before the key and `PROBE THREE DISTINCT`
  immediately after, with the typed value never having fired a change of its own.

**A false negative worth recording, because it will happen again**
- The first two attempts showed the blur firing and the value NOT committing, which read exactly
  like a broken handler. It was the test: `execCommand('insertText')` had re-typed a string the
  field already held, and a browser fires `change` only when the value at blur differs from the
  value at focus. Re-typing the same text is not a change.
- Worth knowing before believing a commit test in this harness: the pane's document does not have
  focus (`document.hasFocus()` is false), though `document.activeElement` still tracks `focus()`
  correctly, and a `blur` LISTENER never fires while `change` does.

**Tested**
- Real modules on PS01 with every non-GET refused (`/r2/read` let through, or the project loads with
  no sheets). Ctrl+S from the stage: taken, and one `POST /r2/write` attempted - the save genuinely
  ran, and the 503 the guard answered with produced the failure toast that proves the path end to
  end. Ctrl+S from the specification tab: the same. Bare S: untouched. Ctrl+Shift+S: no match, so
  `ModifierMatch: Exact` is doing its job.
- Afterwards: margin heading restored to its original, dirty flag cleared, draft key removed, and
  every write attempt in the session accounted for as blocked. Nothing reached R2.

**Files**
- `03__Core__Config/Na__LayoutEditor__KeyMappings__.json` (`Edit__Save`),
  `05__Core__ModeController/Na__LayoutEditor__ModeController__.js` (`Na__LeMode__OnSaveKey`, the
  capture listener), `40__Ui__Panels/Na__LayoutEditor__Toolbar__.js` (`Na__LeToolbar__Save`
  exported, so the key and the button are one action rather than two that drift).

# ---------------------------------------------------------
## TrueVision3D v2.72.0  -  19-Sep-2026
### Three Greys, Three Shadows and Three Letterheads for One Pack of Documents

**Overview**
- Adam, on the register beside the specification: "the drawing register just looks like an
  absolutely completely different document. The whole thing's meant to look like one cohesive
  pack... this is like three completely different developers built it. The drawing editor UI is
  kind of the gold standard that needs to be the same everywhere else."
- He was right, and it was measurable. Each editor declared its own ground and its own paper
  shadow, by hand, in its own file: the drawing editor `#d8dcdf` with `0 6px 26px .22`, the
  specification `#eef1f4` on a `#d7dde3` desk with `0 1px 3px .16, 0 8px 24px .1`, the register
  `#eef1f4` on `#d7dde3` with `0 3px 9px #0002`. Three answers to "what does paper look like".
- Worse, v2.70.0 had just "fixed" the register by copying the specification's two greys into it -
  which matched two of the three and left both differing from the drawing editor. A divergence
  fixed by duplication is two divergences.

**One place that says what a surface is**
- `10__Core__SheetSurface/Na__LayoutEditor__Styles__Surfaces__.css` is new, loaded immediately
  before `Styles__Main__`, and holds every ground, paper, shadow, edge and chrome token the
  Layout Editor has. Its header says outright: never write a ground colour or a paper shadow
  into a feature stylesheet again, add a token here and use it from both places.
- `--Na_Le_Stage` is `#d8dcdf`, the drawing editor's, exactly as Adam specified. The drawing
  editor's own `--Vale_LayoutGreyStage` is now an alias of it, so every existing use keeps
  working and there is still only one value.
- `--Na_Le_PaperShadow` is the drawing sheet's `0 6px 26px rgba(0, 0, 0, 0.22)` - the deepest of
  the three, and the one that actually reads as a sheet lying on a desk.
- The specification's page and reader desk, and the register's page and Read desk, all resolve to
  the one stage. The specification's pages, the register's rasterised pages and the register's
  Edit card all wear the one paper shadow, square-cornered (the register card's 10px radius is
  gone: paper does not have rounded corners).
- Audited after the change: no editor ground and no paper shadow is hard-coded anywhere in the
  Layout Editor's stylesheets. Two hard-coded values survive on purpose and are neither - a
  segmented-control pill on the specification's white bar, and a floating menu's own shadow.

**The register wears the pack's letterhead**
- The register PDF now opens the way the Project Specification does: the office mark left, the
  running head and the issue right in tracked small caps, a hairline under, then the document's
  own name, the project, and a ruled strip of PROJECT / DOCUMENT No. / DATE / CONTENTS. Drawn at
  the specification's own measurements (6.2mm mark in an 11mm band, 6.8pt running head), because
  the point is that they match.
- The letterhead repeats on every page, so a loose sheet out of a printed set still says which
  document and which project it came from. The foot follows too: the company left, the page count
  right, both in the same small caps.
- The document number is `PS01_REGISTER`, sitting beside the specification's `PS01_SPEC`.
- The mark is fetched once per session and embedded as a **PNG data URL**, not pixels: jsPDF's
  `RGBA` path drops the alpha and would print the logo on an opaque block. A failed fetch is not
  an error - the band simply carries no mark.
- The section heading no longer prints on page one. The title says "Drawing Register" directly
  above it; the heading now earns its place only where the table runs on and the reader needs
  telling what they are looking at.

**The Edit table's columns**
- Adam: "Adjust the column spacing. It's too wide now." The cause: two bare `nth-child` rules
  pinned to the old eight-cell row. Inserting DRAWING No. and PHASE in front of DOCUMENT NAME
  handed PHASE the `width: 48%; min-width: 240px` that belonged to the name, which is why the
  table read as one enormous gap.
- Replaced with a documented set covering all nine cells, counted from the row as it is actually
  built. Only the name flexes; everything else takes what its content needs, which is the same
  rule the printed register's columns already follow.
- Two traps worth recording. A `width` on a cell is only a hint once another column asks for
  `100%` - the browser squeezed the phase box back to 58px - so the floors are `min-width`, which
  holds. And a `<select>` is as wide as its widest option, so the phase box was setting its own
  column: the config's phase names are now Adam's own words for them ("Building Regs", not
  "Building Regulations"), which costs 60px and is what he calls them anyway.
- Measured in a browser against the real stylesheet at his window width: handle 31, DRAWING No.
  101, PHASE 156, DOCUMENT CODE 124, DOCUMENT NAME 763, SCALE 136, SIZE 66, REVISION 75,
  expand 28. No runaway column.

**Verification**
- The register's Edit view was built cell for cell against the REAL stylesheets in a real browser
  on an isolated static server - not the live app, so nothing could reach R2. Computed values:
  ground `rgb(216, 220, 223)` = `#d8dcdf`, card background white, border radius `0px`, box shadow
  `rgba(0, 0, 0, 0.22) 0px 6px 26px 0px` - identical to `.na-le-paper`'s.
- Named export resolution passes on all 340 files.
- The register PDF built across five fixtures: Open Sans embedded on every page of every one, and
  the letterhead mark present on every page (3 on the three-page pack, 2 on the detailed).
- NOT verified in the running app: how the letterhead sits once the logo is fetched over HTTP
  rather than from disk, and the Specification and drawing editor tabs against the new ground.
  Both need the real app, and entering the Layout Editor on a real project writes to R2.

# ---------------------------------------------------------
## TrueVision3D v2.71.0  -  19-Sep-2026
### A Drawing Number Was Three Facts in a Trench Coat, and Renumbering Shot Two of Them

**Overview**
- Adam: "by dumbing it down as much as we have now, just for the sake of those tabs, it's now made
  the drawing numbers lose all of their meaning and become stupidly short, which is incorrect."
  The title block was printing `D03` where it used to print `PS01_T02_D03`.
- This was NOT v2.70.0's tab work, which is what it looked like. `Na__LeRegNum__Plan` writes
  `prefix + String(next++).padStart(digits, '0')` - bare `"D01"` - straight into
  `Sheet__Fields__DrawingNumber`, and that file is untouched in this working tree. It has always
  done that. The full codes were legacy stored values and the first renumber overwrote them.
- Confirmed against the saved data rather than inferred: PS01's `TrueVision__ProjectData__.json`
  stores `"D01".."D04"` on its four sheets. The `PS01_T02_` is gone from disk, and Site Plan's
  `D10` is now `D04`, so the numbering jump went with it. Nothing failed and nothing warned.
- A drawing is three facts - which job, which stage of it, which sheet of that stage - and they
  were being kept in one string that one writer owned and three readers needed. That is the bug.
  Splitting them and composing the identifier is the fix, and it makes the failure impossible
  rather than unlikely.

**The three parts**
- `Sheet__Fields__DrawingNumber` keeps the sequence alone, `D01`, which is what the register
  already wrote and what v2.70.0's tabs already read. No migration needed: the field now holds
  what it was in fact holding.
- `Sheet__Fields__Phase` is new and per sheet: T01 Concept Design, T02 Planning Approval,
  T03 Building Regulations, T04 Site & Remedial. Per sheet, not per project, because a live job
  runs stages concurrently - a planning set stays issued while building regs drawings are drawn
  against it - and one project-wide phase would force a re-label on drawings already lodged with
  an authority. Adam chose T01 as the default for a sheet that has never been set.
- The project code is not stored on the sheet at all. It comes from the project data, so every
  drawing in a pack carries the same one and none can drift.

**Composed, never stored**
- `Na__LeRec__ComposeDocumentId` joins the three through `DocumentCodeFormat`
  (`{project}_{phase}_{drawing}`). An empty part takes its separator with it, so a project with no
  phase reads `PS01_D01` not `PS01__D01`, and a literal in front of the first part is kept.
- A renumber now changes the sequence and the title block follows; a phase change changes the
  phase and the file name follows. Nothing can write two thirds of an identifier by writing one
  third, which is exactly what happened before.
- `Sheet__Fields__DocumentId` is the escape hatch, honoured over the composition for that sheet
  alone - a drawing inherited from another practice, or one whose code was fixed on an issued
  document. Nothing in the app writes it.

**Title block: Document ID, not Drawing No.**
- Adam's reasoning, and it is the right one: "it's more than a number; it's a code with multiple
  levels of meaning." Calling it a number is what invites one process to rewrite it whole.
- The row key changed `DrawingNumber` -> `DocumentId` in `TitleBlock__Rows`, the classic scan
  anchors and the `ConfigState__SheetSetup__` fallback, so the old key keeps holding what it
  actually holds. Its share went 18 -> 26, taken off Drawing Title and Site Address, so the strip
  still totals 202; the classic anchor drops 2.4mm -> 2.2mm for the longer string.
- `Na__LePdf__Filename` names exports after `fields.DocumentId`, which restores the
  `PS01_T02_D01__FloorPlans__A2__RevB__` filenames that the flattening had quietly shortened.
- The Sheet panel filters `DocumentId` out of its editable rows, where it filtered
  `DrawingNumber` - the register owns the identifier, and now there is an identifier to own.
- `History__` tracks `Phase` and `DocumentId` alongside `Title`, `DrawingNumber` and `Revision`,
  so an undo cannot restore a drawing to a phase it was moved out of.

**The register shows the construction**
- First three columns are the three parts in the order they compose, in both the Edit table and
  the PDF: `DRAWING No. | PHASE | DOCUMENT CODE`. Read left to right they are how the identifier
  is built.
- Only PHASE is editable, as a select of the configured phases - it is the one part that is a
  choice. A phase retired from the config still shows on a sheet that carries it. Its confirmation
  names the outcome outright ("Its document code becomes PS01_T02_D01.") rather than a code the
  reader has to assemble. The document code cell is set quieter than the two that make it and
  carries a hover saying where it comes from.
- TYPE was dropped. It printed the constant `"Drawing"` on every row - the register builds it in
  code and no sheet can say otherwise - and eight columns do not fit A4 portrait. Measured, not
  assumed: adding it back breaks `Drawing` across two lines and takes `ISO A2` and `Rev B` with
  it. The row still carries `type`, so restoring it is one config line once the page goes
  landscape. Recorded in `LayoutEditor__DrawingRegister__TypeColumnNote`.

**An unnumbered sheet answers in the register's own series**
- `Na__LeRec__DrawingNumber`'s unset default was `projectCode + '-' + order`, i.e. `"PS01-04"`.
  That composed to `PS01_T01_PS01-04`, the project code twice, and its bare-digit tail gave
  v2.70.0's tabs no short code at all. It is now `prefix + padded order` from the register's own
  numbering series, `"D04"`, so a never-numbered pack composes `PS01_T01_D04` and its tabs read
  `D04 - Site Plan`. That resolves v2.70.0's `''` case rather than reopening it.

**Notes**
- `TrueVision__NOTES__DrawingNumberingSchema__.md` is new and is the document to read before
  touching anything that writes a number, a phase or an identifier. It carries what each part
  means, why the phase is per sheet, why the code is composed and never stored, what the
  flattening cost, and how to recover a project whose codes were flattened.

**Verification**
- Named export resolution passes on all 340 files with every change on disk.
- `Na__LeRec__ComposeDocumentId` was lifted out of the repo and exercised directly, not
  reimplemented: all three parts present, each one missing in turn, all three missing, untrimmed
  input, and four alternative formats including a leading literal and a trailing one.
- The register PDF built against the real module and the real config across five fixtures -
  PS01 as Adam has it, 26 drawings, empty, never-numbered, and the detailed mode - Open Sans
  embedded on every page of every one, nothing wrapping.
- The never-numbered pack now composes `PS01_T01_D01` where the old default would have given
  `PS01_T01_PS01-01`.
- Every touched module syntax-checks clean as `.mjs`, and `AppConfig` parses.
- NOT verified in the running app: the title block strip at its new 26 share, and the Edit view's
  phase select. Both need a real sheet with viewports, which the offline harness cannot build,
  and entering the Layout Editor on a real project writes to R2.

# ---------------------------------------------------------
## TrueVision3D v2.70.0  -  19-Sep-2026
### The Number Was Typed Twice and Shown Twice: a Tab Reads "D03 - 3D Images" and Nobody Types the D03

**Overview**
- Adam: "currently these strings applied to the tabs are gigantic and really cumbersome, and I keep
  having to update numbers in multiple places... we've got a really robust indexing system for
  giving, assigning, and renumbering drawings. This should reference what is set in those."
- A sheet tab read `PS01_T02_D03 · D03 - 3D Images`. The first half was the Drawing Register's whole
  number, put on the tab that morning. The second half was the sheet's name with the same number
  typed into it by hand, because until that morning typing it was the only way to see a number on a
  tab at all. Two copies of one fact, and only one of them followed a renumber.
- The proof that it had already gone wrong was in the repo: PS02's fourth sheet was NAMED
  `D24 - Site Plan` and NUMBERED `PS01_T02_D10`. Nobody had done anything careless. The name simply
  had no way of knowing.
- A tab now reads `D03 - 3D Images`: the short code CUT FROM the register's number, then a short name
  that holds words and nothing else. Measured on PS01's four sheets, a tab went from about 226px to
  about 123px, and the four together from 904px to 493px. On a 375px phone that is one tab in view
  becoming two and most of a third.

**One reading of the number, one cut of it**
- `Na__LeRec__DrawingNumber(sheet)` is the single reading: the number the register wrote onto the
  sheet, else the project default. `Na__LeRec__BuildFields` now takes its default from it, so the
  number a tab is cut from and the number the title block prints cannot come apart. It also means
  the tab strip's change signature - run on every nudge of every item - no longer solves the scale
  label, the paper and the date of every sheet to read one string, which it had done since the
  register put `GetFields` there.
- `Na__LeRec__ShortCode(number)` cuts it down: the last run of letters and the digits after them, one
  separator allowed between. `PS01_T02_D03` and the hand-typed `PS01_T02_D01 ` (trailing space and
  all) give `D03` and `D01`; `D1000` stays whole; a series numbered `A-101` reads `A-101`.
- CUT FROM THE NUMBER rather than rebuilt from the numbering series, deliberately. A number typed by
  hand before the register existed answers exactly as one the register wrote, and there is no second
  derivation to drift.
- NO LETTER-LED CODE, NO SHORT CODE. The project default for a pack the register has never numbered
  is `PS01-04`, whose tail is bare digits - a place in the order, not a drawing code. The first cut
  of this gave such a sheet the tab `01 - D01 - Plans`. It now answers `''` and the tab shows the
  name alone, exactly as every tab did before the register; the first renumber gives it a code.
- The whole drawing number moved to the tab's hover (`PS01_T02_D03. Double-click to rename, drag to
  reorder`), in line with the 2.49.1 rule that a tab says what kind it is by position and hover
  text, not by something extra printed on it.

**The name holds words**
- `Na__LeRec__StripSheetCode(name, number)` takes a code typed in front of a name back off:
  `D03 - 3D Images` gives `3D Images`. `NormaliseSheet` runs it, so `Sheet__Name` is the short name
  for every reader at once - tab, toolbar, register, PDF file name, specification chips - with no
  migration step and no list of call sites to keep in step. Stored data converges on the next save
  of any kind; a web viewer reading an unmigrated project sees the short name regardless.
- ONLY A CODE OF THE PACK'S OWN SERIES COMES OFF: the letters of the sheet's own short code, its
  digits, then a dash, a colon, a middle dot or a bar. So the stale `D24` comes off a sheet numbered
  D10, which is the whole point, while `L2 - Second Floor` on a D series keeps every word and
  `3D Images`, `1:50 Details` and `D1.5 Details` are never touched. No period in the separator list,
  because `D1.5` is a real thing to call a detail. A name that is nothing but a code is left alone.
- 37 cases run against the functions lifted out of the real module source, all passing, including
  the one-pass and the idempotent second pass.
- `Na__LeModel__CleanSheetName` runs the same strip BEFORE a rename is saved, so a code typed out of
  habit is kept as `3D Views`, not written to R2 whole and stripped on the next read.

**The trap this would have walked Adam straight into**
- Renaming a sheet wrote the new name over `Sheet__Fields__Title` - in the register's name
  transaction, in `UpdateSheet` and in `DuplicateSheet`, all three added with the register. On PS01
  that field is not the name. It is `Permitted Development Compliance  -  Existing Conditions &
  Design Proposal Floor Plans`: the long title the title block prints. The same commit had also
  removed the Drawing Title row from the Sheet panel, so there was nowhere to type it back.
- Shortening four tabs is exactly what this release invites. It would have cost four typed titles.
- `Na__LeModel__ApplySheetName` is now the one rename. A stored title that DIFFERS from the name is
  somebody's typing and survives. One that MATCHES the name was only following it, and still does.
  One never stored follows by itself through the `BuildFields` default and is left unstored. All
  three cases checked on scratch records in the running app.
- The normaliser applies the same rule when it strips: a title equal to the old name goes with it
  (`D07 - Sections` and `D07 - Sections` both become `Sections`); a typed title is never touched.
  PS01's four long titles came through a full load byte for byte.
- `SetField` no longer renames the sheet when the Drawing Title is typed. That line was unreachable
  while the row was gone, and with the row back it would have renamed the tab to the long title.
- The Drawing Title row is back among the title block fields. It is the long title; Name is the
  short one; left blank, the title reads as the name. Drawing No. still has no row - the register
  owns it, and it shows in front of the Name instead. NOT ASKED FOR, and the one judgement call in
  this release: flagged to Adam as such.

**Where the code shows, and that nobody types it**
- Sheet panel, Name row: the code stands in front of the box as fixed text (`D03 -`), joined to it,
  so the row reads the way the tab does while only the words can be typed. It is
  `GetTabLabel(sheet, '')` - the tab's own label with no name in it - so the separator is configured
  once (`TabLabelFormat`, `{code} - {name}`). Read on every refresh, and a renumber refreshes the
  panel, so it follows the register by itself. Its hover carries the whole number.
- Tab rename: the same fixed code in front of the field, inside a tab-shaped frame.
- Toolbar, Dev menu sheet list and delete prompt, and the specification's go-to chips all name a
  sheet through `Na__LeModel__GetTabLabel`, so a drawing is called the same thing wherever it is met.
- Simulated renumber in the running app: writing `PS01_T02_D117` onto the open sheet and announcing
  `register-updated` moved the tab to `D117 - Floor Plans`, the hover to the whole number, and the
  panel's code and the toolbar with it. Put back exactly; dirty flag unchanged; no write attempted.
- A new sheet is called `New Drawing`, not `Drawing {index}`. `D11 - Drawing 5` is two numbers on one
  tab that need not agree, which is the fault this release exists to remove. `{index}` still answers.

**The register's ground matches the specification's**
- Adam, mid-task: "Update the background as well to match the specification. There's too much of a
  divergence between the specification and the drawing register."
- The register page was a warm paper (`#f8f7f5`) in both views. Its neighbour tab is a cool grey with
  a darker desk under the pages in Read. Side by side they read as two different apps.
- `--Na_Register_Page` `#eef1f4`, `--Na_Register_Desk` `#d7dde3` and `--Na_Register_BarRule` replace
  `--Na_Register_Paper`. `Na__LeRegEd__Render` marks the content `na-le-register__content--read`
  while Read is showing. Computed colours in the running app are now identical pair for pair: page,
  Read desk and the rule under the bar.
- The card keeps its own paper palette. That is the document, and it matches what it prints.

**Worked alongside v2.69.0**
- The register PDF was being rewritten in another session at the same time, in the same folder. The
  two agreed a file split by message before either wrote, and that exchange caught a real
  regression: the register's DOCUMENT NAME read raw `Sheet__Name`, so it would have lost every
  D-number the moment the strip landed. It now composes through `Na__LeModel__GetTabLabel`.

**Worth knowing, and not changed here**
- A NEW SHEET RENUMBERS THE WHOLE PACK from the register's series, and a project that has never saved
  a series gets the config default, `D`. PS01 had no `LayoutEditor__DrawingRegister` block. At 17:04
  today a fifth sheet was created in the live app and PS01's hand-typed `PS01_T02_D01`…`D10` became
  `D01`…`D05` on R2 and in the local mirror - the Site Plan went from D10 to D04. Not from this
  session: the test page ran behind a guard that refuses every write, and its log is empty. If the
  long form is wanted on the title blocks, set the register's prefix to `PS01_T02_D` and give the
  Site Plan a number jump of 10. The tabs read `D01`, `D10` either way.

**Verification**
- `Na__Verify__Exports__.mjs`: 339 files, every named import resolves and every `Na__` identifier is
  imported or declared. `Na__Verify__ModuleGraph__.mjs`: pass. All twelve changed modules
  syntax-checked as `.mjs` copies. The config JSON parses with no duplicate keys.
- Live on PS01, on a no-cache server and a fresh origin, behind a fetch and XHR guard installed
  before the editor was entered and re-installed after the service worker's one reload. Tabs, hover,
  panel code, toolbar, rename frame, the Drawing Title row, the register rows and both backgrounds
  read back from the DOM. Zero console errors, zero writes attempted, no browser draft left behind.
- ONE THING THE PANE COULD NOT SHOW: the hidden pane's document never has focus, so `input.blur()`
  fires no event and the rename field does not close on Escape there. Dispatching the blur by hand
  ran the commit path and the tab came back. That mechanism is unchanged from before this release.

# ---------------------------------------------------------
## TrueVision3D v2.69.0  -  19-Sep-2026
### The Register Was Never Given Its Font, So Every Reader Invented One

**Overview**
- Adam: "It seems like it's rendering it to an image, but then downloading a PDF with a completely
  different format." The preview and the download were in fact the exact same bytes - the Read view
  rasterises `built.doc.output('arraybuffer')`, it does not re-draw anything. What diverged was the
  typeface, because the file carried no font at all and every reader substituted a different one.
- `Na__LeRegPdf__BuildDocument` called `Na__LePdfFonts__Install(doc)` but never awaited
  `Na__LePdfFonts__EnsureLoaded()`. `Install` returns `false` on the spot when the cuts are not yet
  in memory, so it failed silently on every call, `SetFont` fell through to `helvetica`, and the
  whole register printed in a non-embedded standard-14 face.
- Measured on the real module offline: **10 failed installs, 9 failed font selections, 0 succeeded**,
  and the finished file declared `Helvetica` and `Helvetica-Bold`, both NOT-EMBEDDED. PDF.js drew
  one substitute in the pane, Adam's reader drew another, MuPDF drew a third. Same file, three faces.
- The register also printed clumped: a fixed `[0.13, 0.43, 0.11, 0.12, 0.11, 0.10]` column split gave
  CODE 19.4mm of text width for a 24mm drawing number, so `PS01_T02_D01` broke mid-token onto two
  lines while DOCUMENT NAME sat on 77mm and used 27mm of it.

**The font fix**
- `BuildDocument` now awaits `Na__LePdfFonts__EnsureLoaded()` before anything is measured or drawn,
  which is what `Na__LayoutEditor__SpecPdf__.js` has always done at its line 383. The register was
  the odd one out, not the pattern.
- The file now declares `OpenSans` as an embedded Type0 / Identity-H subset. 2,244 bytes to 31,118.
  Text still extracts as clean Unicode, so the register stays searchable and copy-pasteable.
- Because the face is in the file, the Read view and the downloaded PDF are now the same document in
  the same type on every machine. That was the whole of the reported divergence.

**The table**
- Columns are measured from the embedded font: each takes the width of its widest cell, floored at
  its own heading so a heading never wraps, capped at `ColumnMaxMm`. Surplus width is then shared out
  in proportion, so the table breathes evenly instead of parking all its slack in one column. A
  shortfall comes off the roomiest columns first, and the one `Flex` column is what is left to wrap.
- Rows are measured whole and drawn whole. A row that will not fit starts the next page instead of
  being sliced across the break, which the old `take = floor((bottom - y - 4) / 4.5)` loop did.
- Cells are vertically centred on a configured rhythm (`RowPadMm`, `LineMm`, `CellPadMm`), not pinned
  to a `y + 5.5` baseline in a 9mm box. SIZE and REV centre; the rest read left.
- A scale of `1:50 @ ISO A2` prints as `1:50` when the SIZE column already says ISO A2 - the same
  fact twice was the single biggest cause of the wrapping. A genuine mismatch (`@ ISO A1` on an A2
  sheet) is left alone, because that one is worth seeing. `CollapseScaleSuffix: false` turns it off.
  The sheet's stored Scale field is never touched either way.
- DOCUMENT NAME now composes through `Na__LeModel__GetTabLabel(sheet)`, so the register row reads
  exactly what the tab reads and the two cannot drift. This matters as of v2.70.0's rename work,
  which strips a hand-typed `D01 - ` from `Sheet__Name`; without this the register would have lost
  its D-numbers.
- `Na__LeRegPdf__Rows()` still returns raw field values. The Edit view puts `name` and `revision`
  straight into editable inputs and writes back what it reads, so prettifying them there would have
  saved the decoration into the project. Presentation happens in `Na__LeRegPdf__PrintRows` instead.
- An empty cell prints an em dash in the muted ink rather than nothing at all, so a never-numbered
  sheet or an unrevised drawing reads as a stated blank rather than as a hole. `EmptyCellText: ""`
  turns it off. A sheet with no revision now prints that mark instead of a bare `Rev ` with nothing
  after it, which the first cut of this work produced and which reads as a fault.
- `Na__LeModel__GetTabLabel` answers the sheet's name alone when `Na__LeRec__ShortCode` finds no
  letter-led code - a never-numbered pack numbered `PS01-04` has a bare-digit tail. Checked, not
  assumed: DOCUMENT NAME then degrades to the plain name rather than inventing a code, and an empty
  name, an empty drawing number and an empty scale all print the absent-value mark.

**The page**
- Title band: project name (shrink-to-fit down to 12pt rather than wrapped or cut), project code
  right, long-form date, then a 0.6mm rule in `#172b3a` - the drawings' own ink, so the register
  reads as part of the pack it lists. Margin 15mm to 18mm.
- Revision history flows instead of forcing one page per drawing: PS01's four drawings went from
  five pages to two. Each entry is set against a 22mm revision rail carrying its Rev code and date,
  with warning panels attached to the entry they belong to.
- Footer is a hairline, `NOBLE ARCHITECTURE`, and `Page n of m`.

**Preview resolution**
- The canvas was built at a fixed 1.25 scale - 744px for an A4 page - and then stretched by CSS into
  a `max-width: 794px` box. The Read view was an *enlargement* of the document on every display, and
  badly soft on a HiDPI one. Scale is now `previewWidthPx * devicePixelRatio / unscaledWidth`,
  clamped by `PreviewMaxPixelRatio`. The canvas is also opaque and pre-filled white.
- `PreviewScale` is gone from the config, replaced by `PreviewPageWidthPx` and
  `PreviewMaxPixelRatio`. `previewWidthPx` must stay in step with the `max-width` on
  `.na-le-register__pdf-page`; both files now say so.

**Configuration**
- `LayoutEditor__DrawingRegister__Config` gains typography (`TitlePt`, `HeadingPt`, `MetaPt`,
  `TableHeadPt`, `NotePt`), rhythm (`RowPadMm`, `LineMm`, `CellPadMm`, `HeadRowMm`, `ColumnMaxMm`),
  a `Columns` array carrying order, heading, alignment, flex and floor, `CollapseScaleSuffix`,
  `AccentColour` and the four warning colours that were hard-coded in the module.

**Verification**
- Built offline against the real module with the real `AppConfig` JSON, the real
  `Na__LeCfg__GetDrawingRegisterSetup`, the real vendored jsPDF and the real Open Sans TTFs; only
  the sheet model, register store and project context are fixtures. Output inspected with PyMuPDF.
- Font embedding proven both ways: before, `Helvetica` / `Helvetica-Bold` NOT-EMBEDDED with
  `{ensureCalls: 0, installOk: 0, installFail: 10, setFontFail: 9}`; after, `OpenSans` Type0
  Identity-H EMBEDDED with `{ensureCalls: 1, installOk: 1, installFail: 0, setFontFail: 0}`.
- Four fixtures: PS01 as Adam has it (1 page, 2 with history), 26 drawings with long names and
  multi-scale strings (3 pages - repeated table head, `continued` marker, no sliced rows, scale
  collapsing correctly firing on matching paper and correctly NOT firing on mismatched paper), and
  an empty register, and a never-numbered pack carrying an empty name, code, scale and revision.
- The preview module itself was run in a real browser against the real vendored PDF.js on an
  isolated static server, not the live app, so nothing could reach R2. At dpr 1.5 it rendered
  1191x1685 backing into a 794x1123 CSS box (ratio 1.5, never upscaled); at a forced dpr 4 the
  canvas came back 2382px, so `PreviewMaxPixelRatio: 3` clamps as intended. Canvas confirmed opaque.
- Pane trap worth recording: the Browser pane runs hidden, a hidden pane never fires rAF, and PDF.js
  render tasks therefore hang forever. The canvas is sized correctly regardless - shim rAF to see
  the task finish.
- All three edited modules syntax-checked clean as `.mjs`, and `AppConfig` parsed clean.

# ---------------------------------------------------------
## TrueVision3D v2.68.2  -  19-Sep-2026
### Two Modules Describing a Menu That No Longer Exists: a Port That Never Landed, Deleted

**Overview**
- `Na__PresentationMode__DevMenu__SceneRowBuilders__.js` (545 lines) and
  `...__SceneReorder__.js` (298 lines) are gone. Both came over from ValeVision at v2.21.x as part
  of the drawing-systems re-alignment, and neither was ever imported by anything.
- The live scene editor kept its own copies of the same logic under a different prefix, so the
  port landed as a second, parallel set of the same functions that nothing called.

**How it was confirmed dead before deleting**
- All nine exported symbols (`BuildSceneRow`, `FovToFocalMm`, `FocalMmToFov`,
  `TRANSITION_DEFAULT_MS`, `GetGroupSliceBounds`, `AreScenesInSameGroup`, `MoveSceneToIndex`,
  `ResolveDropIndex`, `AttachSceneRowDragHandlers`) appear repo-wide only inside their own
  defining file. Nothing imports either module by name or by path.
- `Index.html` imports exactly one module from the DevMenu family, `...__SceneEditor.js`. The
  folder's other entry point in `Index.html` is a `@delegate:` comment naming the directory, not
  the files.
- No dynamic `import()` reaches them. The `80__Testing__PrototypeEnvironment` harnesses and the
  `79__Testing__GenerateObjects` sandbox do not reference them.
- The PWA service worker does not name them: `PWA_SW_SHELL_PRECACHE_RELATIVE` is five entries
  (Index, one stylesheet, two configs, the fallback manifest) and the vendor list is the two Three
  builds. Nothing in `21/` is precached, so no install path can 404 on the deletion.

**Why the live editor did not use them**
- `...__SceneEditor.js` defines its own `Na__PmDev__BuildSceneRow`,
  `Na__PmDev__AttachSceneRowDragHandlers`, `Na__PmDev__MoveSceneToIndex`,
  `Na__PmDev__GetGroupSliceBounds`, `Na__PmDev__AreScenesInSameGroup`, `Na__PmDev__FovToFocalMm`
  and `Na__PmDev__TRANSITION_DEFAULT`. Same behaviour, `Na__PmDev__` prefix, no import.
- Those copies have since moved a long way. The live row folds, carries a thumbnail, puts FOV and
  move speed on one line, has a layout-editor-only flag and a Preview button. The deleted module
  had none of that. Keeping it meant keeping a 545-line description of a dev menu that has not
  looked like that for weeks - the kind of file that reads as current until someone edits it and
  wonders why nothing changes.

**ValeVision still uses both - this is now a deliberate divergence**
- Checked directly, not assumed: `ValeCodebase/WebApps/ValeVision3D/02__Src__AppModules/
  21__System__PresentationMode/Na__PresentationMode__DevMenu__SceneEditor.js` imports three
  symbols from `SceneRowBuilders__` and five from `SceneReorder__`, at its lines 150 and 184.
- It is right to. ValeVision's scene editor is 1,023 lines against TrueVision's 2,365; over there
  the split is load-bearing, and its row builder still matches its own simpler menu.
- So the two apps have genuinely parted company at this file, and a future re-alignment pass must
  not read ValeVision's split as a gap on the TrueVision side and "restore" it. Re-porting would
  drop in a row builder for a menu TrueVision no longer has. If the live editor ever needs
  splitting, split the live editor - do not take ValeVision's copies.
- Both re-alignment plan rows have been marked so the trap is not re-armed:
  `TrueVision__PLAN__ValeVisionRealign__DrawingSystems__.md` section 8's Phase C table and the
  section 12 ledger row `C | Scene editor splits (RowBuilders, Reorder)`, which until now read
  "Not yet ported" and would have invited exactly that mistake. Both now read WITHDRAWN.
- Not changed, and the loose end to know about: ValeVision's own parity ledger,
  `WebApps/ValeVision3D/ValeVision__PARITY__TrueVisionLedger__.md`, is the upstream seed for that
  table and lives in the other repo, so it was left alone. It still carries the trap from the far
  side, in four places - its line 29 and line 34 record the splits as landed and closed, its
  file rows at 667 and 671 list both modules as ported into TrueVision, and line 909 still asks
  for the split outright on the grounds that "The TrueVision editor is 1622 lines, over the house
  budget". That last one is stale twice over: the editor is 2,365 lines now, and the fix is to
  split the live file, not to import ValeVision's. A re-alignment pass driven from the ValeVision
  side rather than from this plan doc would walk straight back into it. Adam's call whether to
  annotate the other repo.

**Also**
- `40__System__DrawingViewCore/Na__DrawView__RenameDrawing__.js` had an INTEGRATION note saying
  `...__SceneRowBuilders__` routes a drawing card's name field into it. That was true of the
  ValeVision file it was ported from and never true here. It now names the scene editor, with a
  line recording where the old name went, so the next reader does not go looking for a file that
  has been deleted.

**Verification**
- Booted after the deletion on a no-cache static server. The full static module graph resolved -
  283 requests, none failed, `...__SceneEditor.js` among them at 200. Zero console errors, canvas
  up, DOM built.
- The decisive measurement: filtering the network log for `SceneRowBuilders` and for `SceneReorder`
  returns no requests at all. The browser never asked for either file, before or after, which is
  what "nothing imports them" looks like from the outside.
- `Na__DrawView__RenameDrawing__.js` syntax-checked clean (as `.mjs`; Node reads the apps' `.js`
  modules as CommonJS and false-fails every one).

# ---------------------------------------------------------
## TrueVision3D v2.68.1  -  19-Sep-2026
### The Floor Was Shading Itself: a Grazing View Reads the Ground as Its Own Occluder

**Overview**
- Adam, with three screenshots: "It's rendering a random band line in front here... just a random
  smudged black element", and mid-move the whole forecourt grained. "Look for errors in the SSAO
  method and how it works in the pipeline. Take a real holistic look at everything."
- The grain was the tell. A flat surface has ZERO true occlusion, so anything the shader reports on
  open ground is false, and the band is simply what that noise averages to once the burst settles.

**What it was not, and how each was ruled out**
- Not the depth source: the profile-lines normal pass hands SSAO a full-resolution FloatType depth
  at the renderer's pixel ratio, meshes only, linework hidden.
- Not a rendered ground plane: `Scene__GroundPlane__Enabled` is false. The ground is
  `RB05__TrueVision__LandscapeEnvironment__MeshModel__.glb`, a 12-triangle slab 90m x 85m, so not
  two coplanar surfaces fighting either - and a second plane 0.5mm above the first changed nothing in
  the probe.
- Not the reconstructed normal: on a clean plane the dFdx/dFdy normal is within 0.23 degrees of
  true across the ground and 1.4 degrees at the horizon. A true normal buffer was prototyped and
  measured, and it bought nothing. (An earlier read of 46 degrees was sky: every debug mode returns
  the scene colour where there is no geometry, and white decodes as "fully occluded". Mask the sky
  or the horizon band reads as 1.000 in every test, which it did.)
- Not the bias: 0.005 to 0.020 barely moved it.

**What it was**
- At a grazing view one screen pixel spans a long stretch of ground. A hemisphere sample hovering
  100mm above the floor projects to a pixel whose read-back surface point can be metres along the
  floor from the pixel being shaded - and slightly nearer the camera than the sample, which the
  depth test alone calls occluded. Measured on a clean plane at 12 degrees, mean occlusion per band
  near to far: 0.02 / 0.05 / 0.15 / 0.28, where the truth is zero. Steeper views collapse it (25
  degrees: 0.02 / 0.04 / 0.13; 45 degrees: nothing), which is why it reads as a band at the
  mid-distance and why the near forecourt stays clean.
- It surfaced now because two deliberate changes exposed it: the radius doubled to 100mm, and the
  cull distance went from 8m to 50m. The mid-ground used to be culled outright; the far half of the
  slab had never been shaded before.

**The fix: an occluder has to rise out of the surface**
- The point read back at a sample's screen position is now also measured against the tangent plane
  of the pixel being shaded, and only its elevation above that plane counts, faded in from one bias
  to four so the gate has no hard edge of its own. A floor point is in the plane and contributes
  nothing however coarse the depth; a wall point stands above it and counts as before.
- After: 12 degrees 0 / 0 / 0 / 0.013, 25 degrees all zero. A real corner (3m box on the plane, 6m
  away) reads 0.112 at the contact row before and after, and the false darkening it used to cast on
  the floor in front of itself (0.015 / 0.024) is gone. Confirmed on RB05 in the raw-AO view: walls
  and near ground clean, the mid-ground grained exactly where the screenshots circled.
- Ten lines in the fragment shader, no new uniforms, no pipeline change.

**Also in this release (asked for during the same session)**
- `RadiusMm` 50 to 100. Adam asked for twice as big and twice as dark. Doubling the radius alone
  measured x1.95 darker (a bigger hemisphere catches more), so `Intensity` stays at 1.2: doubling it
  as well measured x3.44.
- `finalAo` is now clamped 0..1. Written to a HalfFloat target, a negative term is STORED and the
  blur smears it into neighbours; above intensity 1 that is a halo darker than the maths intends.
  A no-op wherever the term never went negative.
- `CullDistanceMm` 8000 to 50000. It measures distance from the CAMERA, so every pixel crossed it
  together and the whole image lost its shading as one when the camera pulled back past 8m - inside
  a 45m orbit range. Cost measured on an RTX 3080 at 2560x1440: under 0.15ms per frame. A
  `CullDistanceNote` in the config records the constraint so it is not lowered blind again.

**Found, not changed**
- `uResolution` is fed CSS pixels (`window.innerWidth`) while the fragment grid is CSS x pixel
  ratio. The noise hash does not care; the AO blur does, because its texel size is 1/uResolution,
  so on a 150% display the 5x5 blur spans 7.5 real texels. Harmless, but it means the blur is wider
  on Adam's monitors than the config implies. Left as it is because changing it visibly narrows the
  blur he has been tuning against; his call.

**Tested**
- Offline A/B against the real module on an RTX 3080: identical kernel in both rigs so the two
  differ only by the shader change; sky masked out of every measurement.
- RB05 WestFarm loaded on the static server in the raw-AO debug view (config flag flipped and
  reverted in the same session) to confirm the signature on the actual scene.
- NOT re-checked: the finished look in the running app after the gate; and whether 0.09-0.19 of
  residual at the 40m band is visible under the cull fade that begins there.

**Files**
- `07__Scene__EnvironmentEffects/Na__RenderEffect__AmbientOcclusion__Shader.js` (tangent-plane
  gate, clamp), `...AmbientOcclusion__.js` (intensity docstring).
- `02__AppData/Na__AppConfig__Main.json` (`RadiusMm` 100, `CullDistanceMm` 50000, `CullDistanceNote`).

# ---------------------------------------------------------
## TrueVision3D v2.68.0  -  19-Sep-2026
### Twelve Rows of Buttons, and Only One of Them Belonged to the Scene You Were Looking At

**Overview**
- Adam: "I keep accidentally editing and breaking the wrong scenes." Then a list: fold the rows,
  follow the carousel, show me a thumbnail, get rid of the second slider, ask before Update Scene,
  make Clear All hard, tidy the buttons, and give me two batch operations.
- The complaint and the feature list are the same problem seen from both ends. A panel that puts
  twenty scenes' worth of controls on screen at once is a panel where the Update Scene button under
  your cursor belongs to whichever scene happens to be under your cursor, and that is not
  information you have.

**One scene open at a time, and the carousel picks which**
- Every scene row folds to a header strip. Opening one closes the rest - a single focused id, not a
  set, because two open rows is already two sets of Update Scene and Delete on screen.
- `SetActiveScene` now announces `na-presentation-mode-scene-activated`, and the Dev menu answers by
  folding down to that scene: its group opens, every other group closes, the row opens and scrolls
  into view. Pick a card, press a chevron, hit a number key - the row in front of you is the view in
  front of you.
- The fold is a PURE DOM PASS. It never rebuilds the panel, because it fires twice on a card click
  (on the press, and again when the flight lands) and a rebuild there would throw away a half-typed
  name and re-fetch twenty-one thumbnails for the privilege of changing which rows are visible. Every
  group's rows are in the document the whole time; a folded group is a hidden container, not an
  absent one, which is exactly what makes the class toggle sufficient.
- Adding a scene focuses the new row the same way, set before the commit so the rebuild the commit
  triggers reads it.

**Layout-editor-only scenes**
- New per-scene flag, `PresentationMode__Scene__LayoutEditorOnly`, off by default and absent when
  off. The scene stays in this menu, stays in the Layout Editor's viewport picker and stays
  reachable through Preview; it leaves the viewer carousel.
- Drawing sheets want framings a viewer should never be flown to - a facade square-on at a focal
  length that makes a building read as an elevation, a corner cropped tight enough to show a cill.
  Before this the only way to have them was to let them sit in the strip looking like mistakes.
- ONE FILTER, in `GetSortedScenes`, is what hides them. That accessor is the viewer's entire scene
  set, so the strip, the chevrons, the number hotkeys and the group counts all narrowed together and
  the carousel module needed no flag check at all. `GetDefaultScene` filters too, so a hidden scene
  is never the opening view, and `HasValidSavedScenes` filters, so a project whose every scene is
  hidden gets no carousel rather than an empty one. Authoring surfaces read the raw config array and
  keep seeing everything; `GetAllAuthoredScenes` is there for the ones that want that explicitly.
- Toggling it saves immediately, unlike its neighbours in Advanced. Those change how a scene behaves
  when you arrive; this one changes whether the scene is in the strip at all, and a flag whose whole
  effect is "the strip looks different now" has to make the strip look different now.

**A thumbnail per open row**
- The scene's own saved thumbnail, at card size, beside Name and Group; clicking it previews. It
  confirms the row is the view you think it is without flying anywhere - and for a
  layout-editor-only scene it is the ONLY picture of that scene anywhere in the app, which would
  otherwise have meant authoring a view you could not see.

**Move speed lost its slider**
- It is a transition duration that is set once a project, if ever, and it was carrying a full-width
  slider on every row. Now a value box in seconds sitting on the FOV row, clamped to the bounds the
  slider enforced. FOV keeps its slider, because framing is the thing you drag and watch.
- The whole row is sized to a ~280px panel inside a dropdown: the slider is the only element allowed
  to take slack, the readout lost `deg /` for a degree glyph, and nothing else carries a min-width.
  First cut overflowed the panel by 16px with the seconds box hanging off the right edge.

**Asking before the two irreversible presses**
- Update Scene confirms. It overwrites a saved pose, its FOV, its layers, its navigation mode and its
  thumbnail in one press, writes that to R2, and there is no undo. Folding the rows made the
  wrong-row version of that mistake much harder; the confirmation is for the right row at the wrong
  moment, which folding cannot help with - the camera is simply not where you thought it was.
- Clear All Scenes now requires the word CLEAR typed in capitals, exactly. "clear" does not open the
  gate, nor does "Clear". Nothing is emptied, nothing is committed and nothing reaches R2 until the
  dialog returns true - verified by instrumenting every R2 write and watching the count stay at zero
  through "clear", "CLEA" and "Clear" with all twenty-one rows still standing.
- Delete confirms through the same dialog rather than `window.confirm`.
- The dialogs are a small Dev-menu modal module: confirm, type-to-confirm, and a progress dialog with
  a Stop for the batches. The shared `Na__AppUtils__ConfirmDialog` was deliberately left alone - it
  has no static markup in this app, so every one of its callers is really calling `window.confirm`,
  and changing that under the Layout Editor was not this feature's business.

**The buttons are a grid now, and Clear All is on the far side of a rule**
- Six buttons of six widths wrapped into a block where the pairing was accidental: which button sat
  next to Clear All Scenes depended on the panel's width that day. Now a two-column grid - make and
  save, the two batch walks, export - with Clear All alone under a horizontal rule. The section is
  deliberately unlabelled; a DANGER heading over one button is noise when the isolation and the typed
  word already say it.
- A square + sits at the top of the panel beside Scene Groups, doing the same job as Add Scene From
  Camera at the foot. On a twenty-scene project the button that makes the twenty-first was three
  screens away from the view you had just framed.
- Per-row, Delete is given its own grid cell on the second line, so it is never the button beside the
  one that was aimed at whatever the labels happen to measure.

**Two batch walks**
- Update All Thumbnails visits every 3D scene, re-renders its thumbnail, uploads each WebP, and saves
  the project JSON ONCE at the end - twenty scenes cost twenty small image writes and one document
  write, not twenty of each. A run that stops early still saves what it finished, because the
  uploaded images are real and the records pointing at them are in memory only until that save.
- Download All Images walks the same list through the Image Export panel's own render path. That
  panel now publishes its live settings behind getters, so "at the current export settings" means the
  same thing there as at the Export Now button, including an untouched panel sitting on its
  configured defaults. Re-deriving the target size in the batch would have been a second copy of
  those defaults, and the copy is the one that goes stale.
- Both snapshot the camera, the orbit target, the layer visibility and the navigation mode before the
  first scene and put all four back in a `finally` - after a stop, after a throw. A batch that left
  the author parked inside scene nineteen with half the model switched off would be worse than no
  batch.
- Drawing scenes are skipped and counted, and the confirmation says so before the run rather than the
  summary after it: "Re-render 18 thumbnails? ... 3 drawing scene(s) are skipped." A floor plan's
  camera is derived by its own drawing and drawn flat with two overlays that only exist while that
  drawing owns the viewport; snapping the perspective camera to one produces a picture of the 3D
  model with a drawing's name on it. Layout-editor-only scenes ARE included - being hidden from the
  carousel is no reason to miss a thumbnail refresh, and those are the scenes whose thumbnail is the
  only place you ever see them.

**The walk is pose-only, which it was not at first**
- The first version applied each scene through the ordinary instant camera apply, which also enters
  the scene's navigation mode. On a project with interior scenes that is a pointer-lock request per
  scene, and worse: walk and fly hand the camera to a controller that keeps stepping it under gravity
  and collision, so the frame that gets captured is no longer the pose that was just set. A run of
  thumbnails each slightly adrift of its own saved view.
- `ApplySceneCameraState` gained `options.skipNavigationMode`. The free-look branch still runs, because
  that is what puts the orbit target along the camera's own look axis so `controls.update()` preserves
  a walk scene's rotation instead of swinging the camera round to face a stale orbit point - that
  branch is about keeping the POSE right, which is exactly what a render needs. The mode is restored
  once, at the end, with the rest of the restore point.

**A collapsed window is not a slow render**
- Both batches refuse to start when the renderer's canvas has no pixels, and check again before every
  scene, treating a mid-run collapse as a stop. A minimised window takes the canvas to zero by zero
  with it, and every render after that is a render with nothing to render into; without the check the
  run reports a wall of failures rather than the one fact that explains them.
- The guard is still right, but the reason it got written was not. See below.

**`close` is a property of window, and that cost most of an afternoon**
- Adam: "I pressed Re-render All and it just hangs for ages. Five minutes. Then I clicked outside and
  it disappeared and nothing had updated." Nothing WAS happening. The dialog's Confirm and Cancel
  handlers were built above the `new Promise` and called a `close()` that only existed inside its
  executor. That is not a ReferenceError - `close` is on `window` - so every press of either button
  silently called `window.close()`. The dialog stayed up, the promise never settled, and the caller
  sat at its `await` for as long as Adam was willing to wait. Escape and the backdrop worked, because
  those two handlers happened to be written inside the executor, which is exactly why clicking
  outside dismissed it.
- The whole dialog is now built inside the executor and the closer is named
  `Na__PmDevModal__SettleDialog`. Nothing in this module may be called `close` again, nor `open`,
  `name`, `status`, `focus`, `top` or `length` - every one of them is on window, so putting one out
  of scope fails quietly instead of loudly.
- IT ALSO EXPLAINS THE SIX "PANE CRASHES" during the first session's testing. `window.close()` closed
  the preview tab, every tool call after a modal button returned "Preview not found", and that was
  read as the capture path taking the renderer down. It was not: with the scoping fixed, the batch
  walked all eighteen scenes in about three seconds with no crash, 18 thumbnail uploads and exactly
  one project save. A tool harness dying right after your own click is a reason to read your own
  click first.

**The progress dialog now says which scene**
- Adam: "if it's doing something, then it needs to have a loading screen with this circular thing and
  report which one it's currently rendering." It has the app's own `.loading-spinner`, scaled to
  dialog size, beside the name of the scene being rendered, with the bar and "9 of 18" beneath it.
  The spinner is the point: a batch spends its time inside a render, where the bar moves once a
  scene, and between two of those a still dialog is indistinguishable from a hung one.

**Finishing had to LOOK different from working, not just read differently**
- Adam again, on the fixed version: "it stepped through, I could see the camera moving and the
  thumbnails updating, but then it got stuck at the end." It was not stuck. It had finished, said
  "7 updated.", filled its bar and put up a Close button - and still read as a hang.
- Three reasons, all fixed. The spinner stopped animating but stayed a ring with a coloured arc,
  which looks like working whether or not it is turning; it is now a green tick, or an amber "!"
  when there is something to read. A finished run with nothing to report now takes itself away
  after 2.2s rather than waiting to be dismissed, the same hold the image export overlay uses; a run
  that failed or was stopped stays up, because a summary nobody can read is not a summary. And the
  toast carries the same line afterwards either way, so the record outlives the dialog.
- The summary was also lying by omission. It said "7 updated." on a project with five floor plan and
  elevation scenes, leaving those five unexplained. The caller hands the batch a list already
  filtered down to walkable scenes, so the batch re-partitioned a list with nothing left to skip and
  faithfully reported zero. The skipped count now comes from the caller's own partition, and the run
  reads "7 updated, 5 drawing scene(s) skipped."

**Schema**
- The saved-scenes block's own `Description` is now a constant in the data layer that owns the shape,
  and every save stamps it. It had been describing a schema the code stopped writing two features
  ago, which matters because that string is the first thing anyone opening
  `TrueVision__ProjectData__.json` reads. It now documents the layout-editor-only key and the fact
  that it is omitted when false.

**Verified**
- Fold, single-open, refold, cross-group focus, focus-follows-card and focus-follows-chevron: all
  driven in the running app against RB05 WestFarm's twenty-one scenes.
- The layout-only flag end to end: ticked, the card left the strip, the row kept its place with a
  LAYOUT chip, the chevrons stepped past it, Preview still reached it; unticked, the card came back.
- Both modals, including every rejected spelling of CLEAR, with R2 writes intercepted and counted.
  Confirm and Cancel both settle their promise now, which is the thing the first pass never actually
  checked - it read a dead button as a working one because the tab died on the click.
- Update All Thumbnails, run end to end against all eighteen 3D scenes: the dialog named each scene
  as it went, finished at "18 updated", and made exactly 19 write attempts - eighteen thumbnails and
  one project save, which is the whole point of batching them.
- Stop, pressed mid-run: "1 updated, stopped early", the finished thumbnail saved rather than
  stranded, and the carousel back on the scene it started from.

# ---------------------------------------------------------
## TrueVision3D v2.67.0  -  19-Sep-2026
### An Hour of Drawing Sat Behind One Button, and Ctrl+W Never Asked

**Overview**
- Adam: "I've just accidentally closed it and lost a bunch of work." Closing the PWA window while
  laying out a sheet took the session with it, without a word.
- The editor had a browser draft and an auto save already. Neither was the thing standing between
  an edit and the floor, and finding out why is most of this entry.

**Why the two safety nets that already existed did not catch it**
- The auto save is deliberately narrow. Structural changes - a sheet created, renamed, reordered,
  deleted, its paper or its title block - schedule a project save. Content edits do not, and content
  edits are the work: viewports, text, dimensions, vectors, every drag and nudge. That is the right
  design, because a drag session that wrote the project between moves would be unusable. The cost
  is an editor that can hold a whole afternoon behind the Save Sheets button.
- The browser draft is written 600ms after the editing pauses, and flushed on `pagehide`. That is
  crash insurance, and `pagehide` is a promise rather than a guarantee - it is skipped on an
  abnormal close. It was also the ONLY thing on that path, which is a lot of weight for a courtesy
  write into localStorage that is allowed to fail silently in private mode or a full store.
- So the honest summary: on a close, the work was as safe as one unguaranteed event and one
  best-effort write. Closing had no question attached to it at all.

**The guard**
- A `beforeunload` handler in the auto save - the module whose stated purpose is already "keep
  sheets from being lost". It raises the browser's own leave-site question while anything is unsaved,
  and does nothing at all when nothing is. Closing a clean editor is still instant.
- Unsaved means both halves of the editor: sheets the project has not been told about, and a
  specification that has not been synced. The sheet flag is tested first because it is a flag; the
  specification's answer stringifies its whole document, and the PWA registrar polls this.
- Editable sessions only. A read-only web viewer is never asked, and the check is on editability
  rather than on the dirty flag, because "nothing to save" is the reason not to ask and the flag is
  only its symptom.
- **The draft is flushed as the question goes up, not on the `pagehide` after it.** This is the half
  that actually rescues work: by the time `pagehide` would fire the decision is already made. Proven
  in the running app - the draft key was absent when the close began inside the 600ms debounce, and
  four sheets were on disk the instant the handler ran. The answer to the dialog now decides when
  the work is picked up again, never whether it survives.
- The wording belongs to the browser. Chrome, Edge, Firefox and Safari all replaced the custom
  message years ago. `returnValue` is still set, because the browsers that did read it treat an
  empty one as "no question", and a guard that silently does nothing somewhere is worse than none.

**The trap: the PWA reloads itself, and asks nothing**
- The service worker registrar calls `location.reload()` by itself when a new worker activates. It
  already held that back while a model load was in flight - yanking the page from under a client
  watching a 200MB download would be brutal - but not for unsaved drawing work, which it would have
  taken with it.
- Worse, with the guard in place it would have raised an unexplained leave-site dialog in the middle
  of a drawing session, from a reload the user never asked for. So the registrar now reads
  `TrueVision__Pwa__HasUnsavedWork` as a third hold-off signal beside the two it had. Its poll still
  gives up after 45s; the update lands on the next fresh load.

**Tested**
- In the running app on PS01, real modules, with `/r2/write` shimmed to block and confirmed never
  called. Clean: probe false, `beforeunload` not prevented. Dirty: probe true, prevented. The dirty
  flag was set through a separate dynamic import of the sheet model and read back through the auto
  save's own closure, which proves the module singleton as well as the guard.
- Draft flush proven as described above. Config key proven in both directions:
  `CloseGuardEnabled` false sends the close straight through, true arms it again.
- NOT tested: the specification-dirty branch on its own. The specification only loads when the
  editor first opens, so with it unloaded `Na__LeSpec__IsDirty()` correctly returns false and there
  was nothing to make dirty without entering the editor and risking a write. It is one arm of an
  OR whose function was confirmed to resolve and return a boolean.

**Files**
- `51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__AutoSave__.js` (v1.3.0 - close
  guard region, `Na__LeAuto__HasUnsavedWork`, `beforeunload`), `03__Core__Config/...ConfigState__EditorSetup__.js`
  and `...AppConfig__.json` (`CloseGuardEnabled`), `62__Feature__AppInstallability/TrueVision__Pwa__ServiceWorker__Registrar__.js`
  (v1.1.0 - unsaved work holds the update reload).

# ---------------------------------------------------------
## TrueVision3D v2.66.0  -  19-Sep-2026
### The Settle Was Buying Sixteen Copies of the Same Noise, and the Monitor Was Timing the Silence

**Overview**
- Adam: "I keep getting the effect dropping out on certain devices", and a proposal with it - render
  a basic SSAO in transit and the real one for the still, "before the supersampling starts".
- The drop-out turned out to have nothing to do with heaviness, and the proposal turned out to be
  aimed at a moment that does not exist. Both are better for having been looked at properly.

**The drop-out was a broken measurement, not a slow device**
- The AO performance monitor timed 120 sampled frames end to end with wall clock and divided. That
  is only a frame rate if frames arrive back to back, and in this app they never do: the render
  loop is invalidation based, so it draws while something moves and then STOPS, and the render
  loop deliberately withholds refinement chunks from the monitor because one chunk is several
  frames of work in one. Both the idle and the bursts landed in the elapsed time while contributing
  no counted frames.
- Simulated against a machine holding a genuine locked 60fps: continuous orbiting measured 60.4fps
  and kept AO; 1s drags with 5s of looking measured 16.5fps; 2s drags with 10s of looking measured
  9.8fps; short nudges with 4s of looking measured 8.1fps. Every one of those below the 24fps
  threshold, so AO was switched off with a toast telling the user to get a better device.
- It was never about the device. It was about how long its user spent LOOKING at the scene - which
  is to say, the more someone used the app as intended, the more certainly it took the shading away.
- The monitor now averages the DURATION of ordinary frames that arrive back to back, rejecting any
  delta that measures a gap rather than a frame. Re-simulated: 60fps reads 60fps, 33fps reads
  33fps, and a real 18fps still reads 18fps and still disables AO, which is the case the monitor
  exists for.
- The progressive renderer did not cause this. It made a latent bug fire almost every session,
  which is why it surfaced when it did.

**There is no moment "before the supersampling starts"**
- The refinement burst runs the whole effect chain per sample, SSAO included - `drawChain` is
  `composer.render()` and nothing stood the AO passes down. So every settle was already paying for
  sixteen SSAO passes and sixteen AO blurs. The progressive renderer had not relieved the heaviest
  effect in the app; it had multiplied it by sixteen.
- Worse, it was buying nothing with them. The kernel rotation is hashed from `vUv` - the fullscreen
  quad's UV, which the jitter does not move, because the jitter moves the scene under the fragment
  grid and not the grid. Every one of the sixteen passes handed a given fragment the identical
  rotation, and sixteen copies of one noise pattern average to that same pattern.
- Measured against a 256-rotation ground truth, on an RTX 3080: a single 8-sample frame sat at RMS
  2.060, and the full sixteen-sample burst at 1.809. Sixteen renders to move the error by an eighth.

**So the AO is progressive now, and the still is better than it was**
- `uAoNoiseOffset` advances by the golden ratio per supersample, so the burst averages sixteen
  INDEPENDENT estimates instead of sixteen copies of one. Same sixteen renders, same cost. The
  settle error fell from 1.809 to 0.226 - 87.5% closer to the truth - and converges on roughly
  Samples x 16 effective directions rather than Samples.
- The offset is added after the hash is folded into 0..1, never inside it: 43758.5453 already
  spends most of a highp mantissa, and adding a fraction to that product would quantise the offset
  to a handful of values with half the samples sharing a rotation. The caller pre-folds it too.
- `uAoActiveSamples` lets an ordinary moving frame walk fewer kernel samples - `SamplesWhileMoving`,
  4 against a ceiling of 8 - with an early `break` inside a loop whose bound stays constant so the
  unroll is unaffected. The shader already divides by `validCount`, so a shorter walk is an
  unbiased, noisier estimate rather than a different effect.

**The trap that would have made it pop, and did not**
- The cosine weighting was baked into the kernel vectors at generation time, so a reduced budget
  would have inherited a PREFIX of it: at 4 of 8 the samples reach 0.23 of the radius instead of
  0.79, every one bunched against the surface. That is a hard contact line with no falloff - a
  visibly different effect while moving, popping into the real one at every settle.
- The kernel now holds unit directions and the weighting is applied in the shader against the
  ACTIVE count, so 4 samples span the radius properly (0.10, 0.16, 0.33, 0.61). Verified
  bit-identical to the old expression at the full count, so nothing hand-tuned moves unless
  something explicitly asks for a reduction. Measured brightness change at the settle: 0.096 luma
  out of 224.

**Borrowed for a draw, never held across one**
- The still exporter, the video exporter and the Layout Editor all borrow this composer between
  frames and render through it without saying anything about quality. Full quality is therefore the
  resting state, and the reduced budget is set immediately before an ordinary frame and restored in
  a `finally` immediately after - the same discipline the refiner already uses for FXAA and
  `renderToScreen`, for exactly the same reason. A budget left lowered would have quietly shipped
  half-sampled exports.

**Supersampling starts sooner**
- `SettleDebounceMs` 150 to 90. Worth knowing that the debounce is only half the felt delay: the
  rest is the first chunk, about 85ms at 60fps, so this is roughly 235ms to 175ms. Below about 80ms
  a run of small nudges starts and abandons bursts, which costs more than it buys.

**Tested**
- Shader compiled and linked through three.js r184 on an RTX 3080 (ANGLE / D3D11), with both new
  uniforms confirmed live rather than optimised away - the runtime `break` is real.
- Kernel scale proven bit-identical at the full count, and proven to span the radius at reduced
  counts, against the naive prefix it replaces.
- NOT tested: a real project in the running app. The probe drove the real AO module through a real
  composer on a synthetic corner scene, which proves the shader, the maths and the API, but not the
  wiring under the model loader, walk/fly or section cuts.

**Files**
- `07__Scene__EnvironmentEffects/Na__RenderEffect__AmbientOcclusion__.js` (monitor measurement,
  unit-direction kernel, quality API), `...__Shader.js` (`uAoActiveSamples`, `uAoNoiseOffset`,
  scale against the active count).
- `05__RenderPipeline/Na__RenderPipeline__PostProcessing__Setup.js` (exposes the three quality
  calls), `Na__RenderEffect__ProgressiveRefine__.js` (optional `onSample` hook).
- `01__AppCore/Na__AppFlow__LoadingSequence.js` (borrow and restore around the ordinary frame; feed
  `onSample` into the burst).
- `02__AppData/Na__AppConfig__Main.json` (`SamplesWhileMoving` 4, `SettleDebounceMs` 90, and a note
  explaining which of the two sample numbers costs what).

# ---------------------------------------------------------
## TrueVision3D v2.65.2  -  18-Sep-2026
### The Drawing Keeps the Finger: an iPad Was Turning the Page Every Time It Was Panned

**Overview**
- Adam, reading a drawing on an iPad: "zoom and pan on ipad feel weird and kind of sticky feeling",
  and then the cause of half of it: "it tries to change to next tab as i try to pan on the main
  canvas not just the top bar".
- Three separate faults, and the first one is the one that was really being felt.

**A fitted sheet had no panning to spend, so every drag was a page turn**
- The page turn was built out of travel the surface could not use: pan to the edge of the paper,
  and the drag that carries past it turns the page. On a sheet FITTED to the screen there is no
  panning to do at all, so every sideways pixel was spare and the document changed 70px into any
  horizontal drag. Every document arrives fitted, so this was most drags.
- A page turn is now the surface's to ask for, and the drawing surface does not: one finger pans
  it, full stop. The specification's pages still ask for one, because nothing there uses the
  sideways direction. Changing document is the tab strip's job and the dock's.

**Applied once per painted frame, not once per touch move**
- A pan and a pinch both end in a scroll position and a zoom, and working either out means
  measuring the stage and the paper immediately after writing new sizes to them. A tablet reports
  touch far faster than it paints, so that was forcing several full layouts per painted frame and
  the drawing lagged behind the finger. Moves are now gathered as they arrive and applied in one
  `requestAnimationFrame`.
- The pan also read `scrollLeft` back after writing it, purely to find out how much landed - a
  forced layout in the middle of a live gesture, for a number that can be worked out. The clamp is
  strictly inside the stage's own scroll range, so the position asked for is the position given.
  It measures the stage and the paper once for both axes instead of once per axis.

**Safari was zooming the page as well as the sheet**
- iOS pinches the visual viewport whatever the element underneath declares, and `touch-action:
  none` does not stop it. A reader pinching a drawing was zooming the sheet AND stretching the
  browser around it at the same time, which is most of what "weird" was. WebKit fires its own
  `gesturestart` / `gesturechange` / `gestureend` for that zoom and they can be refused.
- Bound only where this module does the pinching itself, so the specification's pages - which hand
  over no `onPinch` - can still be pinched to read finer print.

**One more, found while testing**
- A flick that begins and ends inside a single painted frame had everything it asked for still
  sitting in the pending gesture when the finger lifted, and the gesture-end flush ran after the
  drag state had been cleared - so the page turn was thrown away with it. The flush now runs first.

**Tested in the browser (375x812, synthetic touch)**
- A long horizontal flick across a fitted drawing: document unchanged, both directions.
- Zoomed in: one finger still pans (scrollLeft 472 to 567) and two fingers still zoom (paper 567px
  to 1247px), with the document unchanged throughout.
- A flick across the specification's pages still turns to the previous document.
- NOT tested: an actual iPad. The gestures were driven as synthetic pointer events, so the fixes
  for what a real device does differently - the frame pacing and the WebKit page pinch - are
  reasoned rather than observed.

**Files**
- `51__System__LayoutEditor/80__Feature__WebViewer/Na__LayoutEditor__WebViewer__TouchControls__.js`
  1.1.0, `...__Drawings__.js` 1.1.0, `...__WebViewer__.js` (Attach takes no swipe handler).

# ---------------------------------------------------------
## TrueVision3D v2.65.1  -  18-Sep-2026
### The Viewer Keeps the Tabs, and the Page Is Where the Drawing Ends

**Overview**
- Adam, on v2.65.0: "The tab system is too different, use regular tabs but add an additional side
  scroll on portrait and a next arrow at the end of the visible list"; and "on the online version
  ensure no objects outside the bounds of the paper render... I sometimes leave objects to match
  properties to outside the drawing, so ensure on live version the objects truncate to the page."
- Then, seeing it: "the nav menu needs to nudge down IF there is a tab menu", and "the buttons at
  the bottom are too large on the drawings, they look good on spec though".

**Regular tabs, made to fit a phone**
- v2.65.0 gave a web viewer two tabs - 3D Model and Drawings - and put the document's name in a bar
  of its own. Reverted. The strip is the same one the editor has, every sheet and the
  specification, and a viewer simply has no plus, no rename and no drag, which it never had.
- The tabs now live in `.na-le-tabs__scroller` with an arrow OUTSIDE it at each end, so the arrows
  stay put at the ends of the visible run however far the tabs are pushed along. Seven tabs need
  about 700px and a phone in portrait has 375, so the strip scrolls under a finger; on a desktop
  that fits them all no arrow is shown and the strip is exactly what it always was.
- An arrow opens the tab before or after the open one by CLICKING it, so there is still one way
  into each document rather than a second copy of the navigation. The plus is skipped: it makes a
  sheet rather than opening one. A rebuild scrolls the open tab back into view.
- The viewer's own bar and its document list went with the change - the active tab names the
  document and a scrollable strip reaches every other one. What is left is the dock, which the
  strip cannot replace because it is at the bottom of the screen, where the thumb holding a phone
  actually is. The count moved into it: "4 / 11" beside the arrows says there is more to come
  without looking up at the strip.

**The page is where the drawing ends**
- `.na-le-host--viewer .na-le-paper { overflow: hidden }`. The editor sets overflow visible on the
  paper and on each of its layers on purpose - an author parks an item off the page, or leaves a
  swatch out on the grey to match properties from, and has to see and grab it there. A reader is
  being shown an issued drawing, and on a phone that working material arrives as unexplained marks
  floating beside the page. Clipping the paper clips every layer inside it, because an ancestor
  that hides its overflow clips its descendants whatever they set themselves.
- Verified on all four PS02 sheets: D21 had seven such objects and D22 one, and none of them paint
  any more. With authoring on, all 23 are still drawn and still grabbable.

**Two things that were simply wrong**
- THE NAV TOOLBAR SAT ON THE TABS. In presentation mode it is positioned at
  `header + 14px`, and it never added the tab strip's published height - so on a phone, where the
  header is 48px, it landed at 62px on a strip whose bottom is 84px. The same omission was in the
  controls help panel and the Tools & Settings dropdown; the Dev Tools menu had it right all along.
  All four now add `var(--Vale_LayoutTabStripHeight, 0px)`, which is 0px wherever the strip is not
  shown.
- Reveal measured with `offsetLeft`, which is counted from the nearest POSITIONED ancestor - not
  the scroller - so comparing it with the scroller's own scrollLeft compared two different origins.
  The sums came out plausible and the open tab still sat half off the edge. Rects instead.

**The dock, lighter**
- 44px squares in a 56px row read as a keypad under a drawing, and a drawing shows six of them
  across a 375px phone. Now 36px tall in a 52px row, with the step arrows at 46px and 1.15rem
  instead of 56px and 1.5rem. The tap target has not shrunk with them: the dock's own padding is
  dead space around each control that a thumb still lands on.

**Tested in the browser (PS02, localhost, 375x812 and desktop)**
- Tabs in one row at 375px, scrolling, with both arrows; stepping either way never leaves the open
  tab clipped; the plus is skipped; the arrows disable at the ends.
- Nav toolbar at 98px with the strip shown (48 + 36 + 14), clear of it.
- With authoring on: the same strip plus the plus tab, no arrows at 754px, paper overflow visible,
  two panel columns, the whole toolbar, no dock.
- NOT tested: a real finger on a real phone, and the installed PWA.

**A note on verifying this locally**
- The service worker kept serving a stale shell on an origin it had already cached, through
  unregister, cache-clear and reload - the CSS edits simply did not arrive. Verifying on a fresh
  port (a new origin has no cache of either kind) is the reliable way to see a stylesheet change.
  `tv-webviewer-b` on 8622 is in `.claude/launch.json` for that.

**Files**
- `05__Core__ModeController/Na__LayoutEditor__TabStrip__.js` 1.5.0,
  `10__Core__SheetSurface/Na__LayoutEditor__Styles__Main__.css` (scroller and arrows).
- `80__Feature__WebViewer/Na__LayoutEditor__WebViewer__.js` 1.1.0,
  `Na__LayoutEditor__Styles__WebViewer__.css` (dock sizing, page clipping; bar and list removed),
  `05__Core__ModeController/Na__LayoutEditor__ModeController__.js`.
- `03__Style__AppStylesheets/Na__PresentationMode__Styles__SceneCarousel__.css`,
  `...__ControlsHelpPanel__.css`, `...__DropdownAndToast__.css` (clear the tab strip).
- `51__System__LayoutEditor/03__Core__Config/Na__LayoutEditor__AppConfig__.json` (the bar and list
  labels replaced by the two tab arrow titles).

# ---------------------------------------------------------
## TrueVision3D v2.65.1  -  18-Sep-2026
### Walk Mode Stops Colliding With a Line Nothing Draws

**Why**
- Found while porting v2.63.1 and v2.63.2 to ValeVision3D. `LineSegments2` extends `Mesh`, so
  `isMesh` is true on every fat line, so `Na__WalkMode__SetCollisionMeshes` has always taken the
  whole linework layer as collision geometry.
- That was harmless while linework sat on the faces it came from - you collided with the wall
  either way. It stopped being harmless in v2.63.2, which made the linetype categories invisible:
  a dashed overhead-extent line drawn at ceiling height is now something you can walk into and
  cannot see.

**Changed:** `Na__Navmode__WalkMode__SystemLogic.js`
- `Linetype__` joins `Na__WalkMode__CollisionExemptKeywords`. The exemption test already walks the
  whole ancestor chain, so it matches on the category group name and covers every fat line under it.
- The same one-line change is in ValeVision3D v2.56.1, so the two stay level.

**Not changed.** Every other category's linework is still collision geometry, as it has always
been. This is the narrow case: geometry that no longer renders.

**Not tested in the browser.** Node syntax check passes.

# ---------------------------------------------------------
## TrueVision3D v2.65.0  -  18-Sep-2026
### The Public Web Is a Viewer, Not a Disabled Editor

**Overview**
- Adam: "The public web version of the layout editor should not show, it should instead be a view
  only mode... dont show the main editor side panels, most people will be viewing on a phone in
  portrait so they are useless, on the web version make it a viewer so you can cycle the documents
  and see the spec in view mode and drawings."
- The web build was already read-only. What it was not was USABLE: read-only meant the whole
  editor with its buttons greyed - 550px of panel columns, a toolbar of drawing tools, a strip of
  small tabs - which on a 375px phone in portrait leaves the drawing a sliver and every control on
  screen is one the reader has to work out is not for them.

**Where the line is, and why the display mode is not part of it**
- The gate is the one that already exists: `Na__DevGate__IsAuthoringEnabled()`. Localhost in a
  browser and localhost installed as a PWA both author; the live site in a browser and the live
  site installed as a PWA are both the viewer. The four cases Adam listed collapse to two, and the
  display mode is never asked, because it was never the question.

**Three modules, and the one thing they have in common**
- `80__Feature__WebViewer/Na__LayoutEditor__WebViewer__TouchControls__.js` (`Na__LeVwTouch`): a
  gesture recogniser that knows nothing about sheets or specifications. Drag to pan, pinch to zoom,
  double tap to fit, swipe sideways for the next document. The EDITOR'S touch module reserves the
  second finger for navigation so the first can drag sheet items; a viewer edits nothing, so the
  first finger is free and the gestures people already know from every photo app are available.
- `...__Drawings__.js` (`Na__LeVwDraw`): the read-only drawing surface. It attaches the PC
  navigation controls and the recogniser and NOTHING ELSE - no sheet tools, no margin grip, no
  context menu, no measurements box.
- `...__Spec__.js` (`Na__LeVwSpec`): the specification as the A4 pages it prints as. The Read view
  is SET on every show rather than defaulted, so a stored Edit view from a once-unlocked device
  cannot bring the authoring surface back, and the viewer class takes the Edit/Read tabs, the
  filter, the issue fields and the alerts off the bar. Title, page count, Download, Print, status.
- `...__WebViewer__.js` (`Na__LeVw`) holds them together: the sheets and the specification as one
  ordered list of documents, a bar at the top naming the document and its place in the set, and a
  dock at the BOTTOM, where the thumb of the hand holding the phone actually is.

**Not disabled: not built**
- `Na__LeMode__Build` gives a viewer a different shell - `<shell><centre><stage>` and no columns,
  no toolbar row - and `AttachSheetInput` returns early. Every read-only leak this codebase has had
  came from attaching the editing tools and then disabling each thing they can do; one new tool,
  one forgotten guard, and a web reader can drag a viewport. A tool that was never attached cannot
  leak. Verified in the browser: 0 panel columns, 0 panels, 0 toolbars, 0 measurement boxes.
- The tab strip stands down while a viewer has a document open (its published height goes to zero
  with it) and on the 3D model shows two tabs - 3D Model and Drawings - because it is still the
  only door in.

**The swipe is earned, and that took a second look**
- The rule is that only the travel the page COULD NOT use builds the page-turn budget, so a
  magnified drawing pans to its edge and the drag that carries past it turns the page. The catch:
  the stage is much larger than the sheet on purpose - the roaming room is where an author drags an
  item off the paper - so a fitted A3 sheet sits in 311px of paper inside 1,061px of scrollable
  room, and a finger travelled 343px of empty grey before it had spent anything. The reader's edge
  is now the PAPER'S edge. (And the first version of that clamp had its bounds the wrong way round,
  which does not merely fail to clamp: it pins the sheet to one edge and every drag reads as spare.)

**Two fixes underneath it**
- `Na__AppUtils__DevGate__` 1.1.0: the stored flag is tri-state - unlocked, LOCKED, or nothing
  said - and an explicit lock now closes authoring on localhost too. Before this, `Lock()` and
  `?authoring=off` cleared the key and localhost carried on authoring, so the read-only web build
  could not be seen without deploying it. `?authoring=off` is now how this viewer is developed.
- `Na__LeVwDraw__Fit` fits immediately when the stage already has a size and only defers a frame
  when it does not. `requestAnimationFrame` does not run while a page is not being painted, so a
  Fit pressed in a backgrounded tab would otherwise never happen at all.

**Tested in the browser (PS02, localhost, 375x812 and 1024x768)**
- Five documents (four sheets + the specification) cycle by dock arrow, arrow key, document list
  and swipe; the ends stop rather than wrap. Each new document arrives fitted.
- Zoomed to 765px of paper in a 375px stage: the first flick pans to the edge, the second turns the
  page. Vertical drags never turn a page, on the sheet or on the specification's pages.
- The specification shows 5 A4 pages, `touch-action: pan-y` so the browser keeps its own momentum
  scrolling, and a bar of Title / 5 pages / Download / Print / Read-only.
- With `?authoring=on` the editor is untouched: full tab strip with the + tab, two panel columns,
  eleven sections, the whole toolbar through to Save Sheets, and the specification's full bar.
- NOT tested: a real finger on a real phone (gestures were driven as synthetic pointer events), and
  the installed PWA against the new service worker token.

**One thing to do**
- The service worker token is bumped to `2026-09-18-1`. An installed copy holding the old shell
  would keep showing the editor's panel columns on a phone; this is the bump that reaches it.

**Files**
- `51__System__LayoutEditor/80__Feature__WebViewer/` (new): `Na__LayoutEditor__WebViewer__.js`
  1.0.0, `...__Drawings__.js` 1.0.0, `...__Spec__.js` 1.0.0, `...__TouchControls__.js` 1.0.0,
  `Na__LayoutEditor__Styles__WebViewer__.css`.
- `05__Core__ModeController/Na__LayoutEditor__ModeController__.js` 1.16.0, `...__TabStrip__.js` 1.4.0.
- `03__Core__Config/Na__LayoutEditor__ConfigState__EditorSetup__.js` (GetWebViewerSetup),
  `...__ConfigState__.js`, `Na__LayoutEditor__AppConfig__.json` (LayoutEditor__WebViewer__Config
  and the viewer labels).
- `03__AppUtils/Na__AppUtils__DevGate__.js` 1.1.0,
  `62__Feature__AppInstallability/TrueVision__Pwa__ServiceWorker__Logic__.js` 1.7.0,
  `02__AppData/Na__AppConfig__Main.json`, `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css`.

# ---------------------------------------------------------
## TrueVision3D v2.64.1  -  18-Sep-2026
### A Moved Hopper Is a New Model: Content Stamps, and a Force Render That Repaints

**Overview**
- Adam, with the South Elevation's hopper drawn twice - the base image where the model has it, the
  projected linework where it used to be: "its the projected linework layer thats the issue, it
  needs a trigger, ANY NEW MODEL UPDATES or any other changes must force re render... none of the
  re render buttons or methods are working."
- Two separate faults, and neither was the v2.64.0 viewport cache. One made the linework stale;
  the other made every button that should have fixed it do nothing visible.

**Why it was stale: the fingerprint counted, it did not look**
- Every cache downstream of the model is keyed by `Na__PlStage__Describe(...).Fingerprint`: the
  pipeline's results, the collected model, the IndexedDB store, the baked R2 asset, the Layout
  Editor's base image. That fingerprint was each category's name, triangle count and visibility.
- Move a hopper along a wall and re-export: same names, same counts. Same fingerprint, same keys,
  and the browser store hands back last week's projection as a perfect match. The base image only
  looked right because it is re-rendered on a fresh page load anyway.
- `Na__ModelLoader__ContentStamp__.js` (new): each GLB's scene is hashed the moment it is parsed -
  every node's own position, rotation and scale, every geometry attribute and index, material
  names and colours - and the hash rides on the mesh or linework root's userData. Describe adds the
  stamps under each category to the fingerprint; the Layout Editor's 3D snapshot fingerprint takes
  them too (`Na__LeSnap__ModelHash`).
- Taken once, at load, before the loader touches the scene. The fat line upgrade, instance
  consolidation, a door opened in the 3D view and a drawing posing the doors for one render are not
  model updates and cannot re-key anything. It also makes the stamp the same in every session and
  on every host for the same file, which the baked assets need.
- So the trigger is the model itself: any re-export that changes anything re-keys everything
  drawn from it, and nothing has to be pressed.

**Why no button fixed it: the forced render cleared a key nothing is filed under**
- `EnsureLinework(force)` did re-project. It then cleared `PathCache` under the bare linework key,
  while `BandPaths` files its SVG path strings under `key@hidden@styleToken`. The delete never
  matched. PaintLinework found the OLD strings under the unchanged key and painted those. Every
  re-render re-projected faithfully and drew the stale drawing.
- `Na__LeVp2d__ForgetPaths` clears every entry built from the result. A forced run also calls the
  new `Na__PlPipe__ForgetCollections` once at its start, so the model is read again rather than
  projected from the copy collected earlier in the session.

**One-off cost, and one thing to do**
- Every fingerprint changes once. Every stored projection and baked asset reads as stale once and
  is made again: the first visit to each sheet after this re-projects and re-renders it.
- **Re-bake and Save Sheets on each live project before deploying this**, or the web build will
  find no baked asset under the new keys until you do - the same thing that already happens when a
  re-export changes a triangle count.

**Tested in the browser (PS02, localhost)**
- All 13 categories stamped, mesh and linework separately. Pipeline and model fingerprints
  identical across two page loads (`04a42c04-428`, `16db58a9-37d`).
- PathCache poisoned with dummy strings, then Force Render on one viewport: the frame came back
  with its real 9,968 characters of path data. Before the fix it would have painted the dummies.
- NOT tested: an actual SketchUp re-export changing the stamp (the hash covers the buffers the
  move lives in, but it has not been watched happening), and the web build against re-baked assets.

**Files**
- `15__ModelLoader/Na__ModelLoader__ContentStamp__.js` 1.0.0 (new), `...MultiModel.js` 1.4.0.
- `50__System__ProjectedLinework/...ModelStage__.js` 1.2.0, `...Pipeline__.js` - ForgetCollections.
- `51__System__LayoutEditor/20__System__Viewports/...Viewport2d__Linework__.js` - ForgetPaths;
  `...ForceRender__.js`; `25__System__RenderStyles/...SnapshotRenderer__.js` 1.10.0.

**ValeVision3D:** ported 18-Sep-2026 as ValeVision3D v2.57.0, with v2.64.0.

# ---------------------------------------------------------
## TrueVision3D v2.64.0  -  18-Sep-2026
### Drawing Tabs Stay Rendered: the Viewport Cache

**Overview**
- Adam: "flipping between tabs in the layout editor forces a redraw of all viewports which seems
  crazy, once they are rendered once they should be cached and only regenerate if changes are made
  to their parameters such as resizing a viewport or adjusting viewport layers... the renderer
  should ALWAYS run at export time at max quality."
- The cause was one line. `Na__LeSurface__SetSheet` called `ReleaseFrames` whenever the sheet
  changed, which emptied the frames container and dropped every viewport's state: the base image,
  the painted linework SVG, the 3D snapshot and - the part that mattered - the keys they had been
  rendered under. Fill has always compared keys before asking for a render, so the editor already
  knew how not to re-render. It was simply handed nothing to compare with each time a tab changed.

**What changed**
- Each sheet now owns its frames container. Leaving a sheet PARKS it: the container is lifted off
  the paper whole and the viewport modules hand their states over to wait beside it
  (`Na__LeVp2d__Park`, `Na__LeVp3d__Park`). Showing the sheet again puts both back before
  `RefreshFrames` runs, Fill finds every key unchanged, and nothing is rendered. A tab change is a
  DOM swap.
- Leaving the editor parks too, so 3D Model and back is free as well.
- Nothing new decides when a picture is stale. The existing keys cover the frame, the window, the
  scale, the styles, the composite weights, the model layers, the raster level, the scene and the
  model, and they are compared when a sheet is shown again. A change made while a sheet was parked
  re-renders exactly the viewports it touches, when that sheet is next shown. Force Render is
  untouched and still gets past everything.
- A render still QUEUED for a sheet that has been left is skipped (`stillWanted` on Render2d and
  Render3d), so the sheet arrived at is not held up behind the one abandoned. A render already
  UNDER WAY lands in the parked frame, so the work is kept - as is linework that finishes
  projecting while its sheet is parked.
- `LayoutEditor__ViewportCache__MaxParkedSheets` (24): least recently shown dropped first, 0 is
  off. Pictures are held in memory, a few megabytes a viewport.

**Why the states move instead of staying put**
- The viewport modules key their state maps by viewport id, and every sheet numbers its viewports
  from one: PS01 has a `Viewport_001` on all four sheets. Two sheets cannot share that map, so a
  parked state is never in it, and `Release` now names the frame body it is letting go.
- The same collision was a live bug in three places. `Bake`, `RenderForExport` and
  `RestampForScene` walk the whole set and looked a state up by id alone, so baking sheet B with
  sheet A on screen could paint B's picture into A's frame of the same id. `Na__LeVp3d__LiveState`
  checks the sheet as well.

**The PDF always renders**
- 2D underlays already did: `Na__LeVp2d__RenderForExport` is a fresh render at the export level,
  and is unchanged.
- 3D did not. `Na__LeVp3d__RenderForExport` handed back the on-screen or stored picture when it was
  wide enough and sampled enough under the same fingerprint - and that fingerprint is a short hash
  over category names and triangle counts. Good enough to save the screen a render; not good enough
  to vouch for a printed page. Whenever the renderer is present the PDF now renders every 3D
  viewport afresh at ExportLevel, and a failed render prints nothing rather than the screen's
  working picture. The web build has no renderer and still places the stored picture.
- Cost: a PDF with 3D viewports takes as long as its renders, every time. That is the trade asked for.

**Tested in the browser (PS01, localhost)**
- First visit renders as before (D02: six renders). Back and forth D01 / D02 / D03 / D10 and through
  the 3D Model tab: 40-130 ms per tab change, the same image elements back on the paper, and ZERO
  new renders over the following seconds.
- A viewport still waiting on its design phase when its tab was left finished into the parked frame
  and was there on return.
- Raster level changed while D02 and D03 were parked: D02 re-rendered its six viewports when next
  shown, then nothing on the visit after.
- No project data was written by any of it.
- NOT tested: a PDF export end to end, and the Dev bake across sheets.

**Files**
- `10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js` 1.6.0 - the cache.
- `20__System__Viewports/Na__LayoutEditor__Viewport2d__Frame__.js` 1.1.0, `...Viewport2d__.js` 1.11.0,
  `...Viewport3d__.js` 1.7.0 - Park, Restore, Release by body, LiveState, the PDF render.
- `25__System__RenderStyles/Na__LayoutEditor__SnapshotRenderer__.js` 1.9.0 - stillWanted.
- `03__Core__Config/` - `GetViewportCacheSetup` and the `ViewportCache` block.

**ValeVision3D:** ported 18-Sep-2026 as ValeVision3D v2.57.0, with v2.64.1.

# ---------------------------------------------------------
## TrueVision3D v2.63.2  -  18-Sep-2026
### Linetype Linework Is a Drawing Layer, So the 3D Render Stops Drawing It

**Overview**
- v2.63.1 landed and worked: a line tagged `02__Linetype__DashedLines` in SketchUp came through
  dashed on the sheet. Adam, with a screenshot of the same line drawn twice: "only render these
  linetypes on the linework projection layer only, not on the whitecard / base layers etc. the
  dotted and specialist linetypes are projection types only."
- He is right, and the screenshot says why better than an argument does: the crisp black dash is
  the projection doing its job, and the pale solid line a few pixels below it is the same line
  rendered into the raster underneath. A drawing showing its own annotation twice, once wrong.
- The same lines also floated in mid air in the 3D view, which is what an overhead-extent line
  drawn at ceiling height looks like when nothing is cutting it.

**material.visible, not object.visible, and the distinction is the whole fix**
- `Na__ModelLoader__HideLineworkFromRender` sets `material.visible = false` on every fat line of a
  projection-only category. THREE skips an object whose material is invisible, so NO 3D render
  draws it - the viewer, the image export and the Layout Editor's raster underlay alike.
- The OBJECTS stay visible, and that is the point. The projected linework pipeline reads the scene
  graph by walking it and skips anything whose `.visible` is false, so setting the root invisible
  would have taken these lines off the drawings as well - the exact opposite of what they are for.
- Each fat line carries its own `LineMaterial`, built per node in the linework upgrade, so this can
  never reach another category's lines.
- Which categories: `RenderConfig__Linework__ProjectionOnlyCategoryTokens` in the app config,
  `["Linetype__"]`, matched case-insensitively as substrings of the category name. Empty the list
  to draw them in 3D again.

**No 3D toggle for something 3D never draws**
- The eight Linetype buttons added to the model toggle panel yesterday are gone. A toggle that
  looks inert while quietly taking lines off every drawing is worse than no toggle.
- They stay REGISTERED in the category map, so the Layout Editor's Model Layers panel still lists
  and controls them - which is where a drawing layer belongs. Switching one off there still removes
  it from that viewport, through the same exclude token every other category uses.
- The display names are kept: the console, the Other group and anything else resolving a key still
  reads "Lines - Door Swings" rather than the raw key.

**Unchanged**
- Everything about how the lines are exported, loaded, owned, styled and drawn on a sheet. This
  version only stops three renderers drawing them.

**Not tested in the browser.** Node syntax checks pass on both modules changed and the app config
parses. Reload and look at a plan with a rendered underlay - the pale duplicate should be gone and
the dash should remain.

**ValeVision3D:** PENDING with v2.63.1, as one change.

# ---------------------------------------------------------
## TrueVision3D v2.63.1  -  18-Sep-2026
### A Line Tagged Dashed in SketchUp Arrives Dashed on the Sheet

**Overview**
- Adam: "the aim is to allow the authored SketchUp file to have different linetypes which the user sets
  using SketchUp tags... and further downstream in the drawing editors they will have mapped linestyles
  ensuring setting the correct tag in SketchUp results in predictable drawings."
- The drawing editor could already draw a category dashed - the ModelLayers config has carried
  `Layer__EdgeLineType` since v2.5x. What it could not do was tell a dashed line from a solid one,
  because the exporter threw those tags away and nothing distinct ever arrived.
- GLB Builder 2.7.3 now writes one linework-only GLB per SketchUp LINETYPE tag. This side names them,
  draws them, and gets out of their way.

**What arrives**
- Eight new model categories, each a linework GLB with no mesh beside it, discovered by the existing
  filename contract (`{prefix}TrueVision__Linetype__Name__LineworkModel__.glb`) with no loader change
  beyond a place in the load order:
      Dashed Lines · Centre Lines · Dotted Lines · Door Swings · Clearance Lines
      Overhead Objects · Building Joins · Elements For Removal
- A category with no lines behind it never appears. Nothing is added to a project that has not tagged
  anything - this is entirely opt-in from the SketchUp end.

**Mapped, not guessed** - `Na__LayoutEditor__ModelLayers__Config__.json` (1.1.1)
- A new **Annotation Linework** group, one row per linetype tag, each naming its label, colour, weight
  factor and line type from the existing EdgeStyles vocabulary: dashed, centre, dotted, dashed-fine,
  phantom, solid.
- The line types mirror `Glb__LineworkLineType` in the Tags SSOT, the same way `Layer__SketchUpTags`
  mirrors the tag names: the SSOT records what the tag MEANS, this file decides how a drawing DRAWS it.
  Change one, change the other.
- The rows appear in the Model Layers panel like any other category, so a viewport can switch off the
  clearances and keep the door swings, and a viewport that has restyled one stores only that one.

**Drawn as authored, not as geometry** - `Na__ProjectedLinework__CpuBackend__.js`
- Annotation linework reaches a drawing through the AUTHORED class, like all SketchUp linework. Two
  things are now done differently for it, and only for it:
  - **It is not divided at the drawing's cut plane.** A line tagged as an overhead extent is drawn at
    the height of the thing it describes, above a plan's cut. Cutting it away would delete the only
    reason it was drawn.
  - **It is not occlusion-clipped.** A clearance zone drawn flat on a floor slab is coplanar with the
    slab, and the clip would take it for a hidden line and remove it. A line a person tagged is a line
    they want to see.
- `Na__PlCpu__SplitAnnotation` divides the authored buffer once, by owner id, testing the owner KEY
  TABLE rather than the edges - a handful of categories, so the per-edge decision is an array lookup.
  Without an owner table there is nothing to divide by and the whole buffer stays on the old path, which
  is exactly what every earlier version did.
- Everything else authored - the creases SketchUp drew inside a wall - is cut and clipped as before.

**Config, and the one switch** - `Na__ProjectedLinework__AppConfig__.json`
- `ProjectedLinework__Annotation__Config` holds the category tokens (`Linetype__`) and an Enabled flag.
  Turning it off drops annotation back to being cut and clipped like any other authored edge; it never
  hides it.
- `BuildToken` moves to `2026-09-18-linetype-annotation`, so every cached and baked drawing re-projects
  rather than showing the old answer under a key that would not know.

**In the 3D viewer too**
- The toggle panel names them "Lines - Dashed", "Lines - Door Swings" and so on rather than generating a
  label from the key, so a person can see at a glance whether the lines they tagged actually landed. That
  is the first thing to check after an export.
- Switching a category off in the 3D viewer also takes it out of the drawings, exactly as it does for
  every other category - the per-viewport control is the Model Layers panel.

**Known, and left for the test**
- A viewport showing a RENDERED underlay will show these lines twice: solid in the raster, dashed in the
  vector overlay. A linework-only viewport is unaffected. Whether that wants fixing is a question for
  after Adam has seen it.

**Not tested in the browser.** Node syntax checks pass on every module changed and the two JSON configs
parse. This wants a real export from GLB Builder 2.7.3 and a look at a plan.

**ValeVision3D:** PENDING, on Adam's sign-off, once the lines are confirmed loading and drawing here.

# ---------------------------------------------------------
## TrueVision3D v2.63.0  -  17-Sep-2026
### The Specification Is a Document Now: It Has a Revision, a Number, and a Download

**Overview**
- Adam: "in the Project Specification tab, there's no way to version this. I need this to
  be a revision B, so I need a way of being able to assign revisions to the specification
  and also keep the same kind of naming when it downloads. Add an actual download button
  rather than just a print button."
- Three things, and they are the same thing: the specification is issued to people, and an
  issued document has a revision, a number, and a file you can hand over.

**A revision and a number, the way a sheet has them**
- `ProjectSpecification__Revision` and `ProjectSpecification__DocumentNumber` on the
  specification document, typed into two fields on the Project Specification bar - in BOTH
  views, because they belong to the document rather than to how it is being looked at.
- They take the ordinary edit route (`CanEdit`, then `Changed`), so they undo, they write
  the browser draft and they announce themselves like any other edit. Critically they are
  also counted by `ContentJson`: **changing the revision marks the specification unsynced
  and lights Sync.** Left out of that hash, a revision would be typed, look right, and
  never reach the cloud copy the next person opens.
- The number defaults to the project code plus `DocumentNumberSuffix` - PS01 gives
  `PS01_SPEC` - and clearing the field goes back to following the code rather than to
  nothing. Type `PS01_T02_SPEC` over it to sit with the sheets.
- `Rev B` typed into the revision field in full is stored as `B`, so the printed document
  never reads "Rev Rev B".
- A specification written before these fields existed opens at the configured
  `DefaultRevision` rather than at nothing: a document that gets issued has a revision even
  if nobody has typed one yet.

**Where it shows**
- On the reading page's title block, as Document No. and Revision beside the date, and in
  the running head of EVERY page - a loose page out of a printed set still says which
  document and which revision it came from.

**Download, and why it sets type rather than photographing the screen**
- The obvious way to turn the reading view into a PDF is to rasterise its pages, which is
  what jsPDF's `html()` does - and it needs html2canvas, which is not vendored and cannot
  be fetched under the app's CSP. It would also be the wrong answer: a specification is
  text a reader searches, copies and hands to a contractor, and a picture of text is none
  of those.
- So `Na__LayoutEditor__SpecPdf__` sets the pages from the same chrome primitives the
  sheets are drawn with, through the same embedded Open Sans, using the sheet margin's own
  `Na__LeMargin__Wrap` to break the lines. The words in the file are words.
- Pagination measures each block before placing it: a note is never split from its own
  code, a note too long for a column splits between its body lines, and a group heading
  that would end a page moves to the next one with its first note.

**Named like everything else**
- `Na__LayoutEditor__PdfFilename__` is new: the naming that v2.62.0 put in the sheet
  exporter now lives in a leaf both callers share, so a sheet and the specification come
  out of the app named the same way. The sheet exporter is unchanged in behaviour - it
  hands over its title block fields instead of formatting them itself.
      PS01_T02_D01__FloorPlans__A2__RevB__17-Sep-2026__.pdf
      PS01_SPEC__ProjectSpecification__A4__RevB__17-Sep-2026__.pdf

**Proved against PS01's real specification**
- Its 31 notes in 9 groups, loaded from the real file with the transport bypassed, so no
  R2 read and no R2 write: fresh revision A; `SetRevision("B")` gives
  `PS01_SPEC__ProjectSpecification__A4__RevB__17-Sep-2026__.pdf` and `IsDirty` true;
  `"Rev C"` stored as `C`; a typed number giving `PS01_T02_SPEC__...`; cleared, back to
  `PS01_SPEC`.
- The built document: 4 pages, 45,881 bytes, `%PDF-1.3`, Open Sans embedded. Read back
  with the vendored pdf.js, the text extracts as text - every page carries `Rev B` and
  `Page N of 4`, and the group headings, codes, titles and bodies all come through.
- Download is allowed in a read-only session: it reads a document rather than changing one.
- Not yet ported to ValeVision3D.

# ---------------------------------------------------------
## TrueVision3D v2.62.0  -  17-Sep-2026
### A Downloaded Sheet Is Named After the Drawing, Not After the App

**Overview**
- Adam: `PS01_T02_D01__FloorPlans__A2__RevA__14-Sep-2026__.pdf`, with the shape
  `{{DrawingCode}}__{{DrawingName}}__{{DrawingScale}}__{{TodaysDate}}__.pdf`.
- Sheets downloaded as `Na__PS01__D01_-_Floor_Plans__A2.pdf` - the app's name first, the
  drawing's number nowhere, and no revision or date at all, so two issues of the same
  sheet landed in a folder as the same file name.

**Where each part comes from**
- `PS01_T02_D01` is not assembled here. It is the sheet's own **Drawing No. field**, the
  one Adam types in the Sheet panel and the one the title block prints. Every token but
  the date is read through `Na__LeModel__GetFields`, so the file name and the drawing
  inside it cannot disagree about the number, the revision or the paper - which is the
  entire point of putting them in the name.
- `FloorPlans` comes from the sheet's tab name, `D01 - Floor Plans`. The leading sheet
  number comes off - it is already in the code, so keeping it would give
  `D01__D01FloorPlans` - and the words run together in PascalCase, each keeping its first
  character with the rest lower-cased. That last rule is what makes `3D Images` read
  `3dImages` rather than `3DImages`, and a sheet shouted as `SITE PLAN` read `SitePlan`.
  The number only comes off when it looks like one (a short run CONTAINING A DIGIT, then
  a dash or colon), so `Section A-A` keeps every word.
- The example wrote the third token as `DrawingScale` but gave `A2`, which is the paper,
  not the scale, and the paper is what it is - the scale is in the title block, and on a
  mixed sheet there is more than one of it.
- `RevA` is the Revision field, prefixed. `Rev` or `Rev.` already typed into the field is
  not doubled up.
- The date is TODAY, the day the file was issued - which is what the title block prints
  unless that field has been typed over. One line in `Na__LePdf__Filename` switches it to
  follow an overridden title block date instead.

**Proved against the real project**
- Run over PS01's four sheets straight out of `TrueVision__ProjectData__.json`:
      PS01_T02_D01__FloorPlans__A2__RevB__17-Sep-2026__.pdf
      PS01_T02_D02__Elevations__A2__RevB__17-Sep-2026__.pdf
      PS01_T02_D03__3dImages__A3__RevA__17-Sep-2026__.pdf
      PS01_T02_D10__SitePlan__A2__RevA__17-Sep-2026__.pdf
  `RevB` on D01 and D02 because those sheets ARE revision B; the example said RevA.
  `3dImages` because the sheet is named `D03 - 3D Images`; renaming that tab
  `D03 - 3D Visuals` gives `3dVisuals` exactly.
- Sixteen tab names and eight awkward field sets: a code with slashes, a trailing space,
  a revision already reading `Rev C`, and every field blank at once. Every result is a
  legal file name on Windows, macOS and Linux - nothing outside `A-Z a-z 0-9 _ -` survives.
- Accents are folded rather than dropped: the splitter breaks on anything that is not a
  letter or a digit, so `Détails` would otherwise have come back `DTails`.

**Compatible**
- `{projectCode}` and `{sheetName}` still answer, so a pattern configured before these
  tokens existed keeps working rather than emitting its braces into the file name.

# ---------------------------------------------------------
## TrueVision3D v2.61.1  -  17-Sep-2026
### Viewport Captions Stop Eating Their Own Scale

**Overview**
- Adam, on PS01 D10: `LOCATION PLAN   1:12...`, with a clear centimetre of white paper
  after the ellipsis. "ensure these cant clip like this."
- It was not a layout problem. The caption box is built to hold that exact caption and
  was the right size; the text was truncated inside a box that fitted it.

**The bug: a measurement round-trip losing four femtometres**
- `Na__LeChrome__BuildFrame` measured the caption, sized the box as `textMm + pad * 2`,
  and then asked `FitText` whether the caption fitted `boxW - (pad * 2)`.
- In binary floating point `(textMm + 3.8) - 3.8` does not always give `textMm` back. For
  `LOCATION PLAN   1:1250` it lands `3.553e-15` mm UNDER it - about four femtometres, or
  a hundred-millionth of a human hair. `FitText`'s `<=` failed by that hair, chopped
  characters off the end and painted an ellipsis.
- So whether a caption clipped had nothing to do with how long it was or how wide the
  frame was. It was the last bits of a double. Sweeping the 420 captions the app can
  build for a plan, elevation, section or detail at every scale, **22 clipped** under the
  browser's own measurer - `LOCATION PLAN 1:20`, `SIDE ELEVATION 1:50`,
  `EAST ELEVATION 1:100` - and every one of them lost the SCALE, because the scale is at
  the end of the string. A drawing quoting `1:...` is worse than one quoting nothing: it
  still reads as a number.
- The fix is to stop rebuilding the width. The box was sized FOR this text, so the text is
  handed `textMm` itself, making the test `textMm <= textMm`, which is exact. 22 -> 0.

**And a frame genuinely too narrow now sets smaller rather than truncating**
- The caption is an INSET label - it sits inside the frame's bottom-left corner, over the
  drawing - so it cannot be let grow past the frame the way a caption hung underneath one
  could, and a tall thin elevation or a cropped detail really can be narrower than its
  caption. That case used to truncate too, for a real reason rather than a rounding one.
- `Na__LeChrome__FitCaptionFont` now sets the type smaller instead, down to
  `Style FrameLabelMinFontMm` (1.6 mm). A 45 mm frame that printed
  `PROPOSED FRONT ELEVATION...` prints the whole caption at about 2 mm. Only a caption
  that will not fit even at the floor is truncated.
- The size solves in one step rather than by search: jsPDF's width is linear in font size
  and the tracking is a fixed millimetre per character whatever the size, so
  `f = f0 x (room - track) / glyphs`. The answer is then verified by measurement and
  stepped down in tenths if the arithmetic lands a hair over - the same hair that caused
  the original bug, treated properly this time.

**Proved**
- 420 captions swept twice: in Node against the embedded Open Sans, and in the browser
  against the app's own measurer. Old path 28 and 22 clips respectively; new path 0 and 0.
- Frames from 500 mm down to 4 mm: the box never spills the frame and the text never
  spills the box, at every width.
- `Na__Test__TitleBlockScaleCell__.html` now renders viewport captions as well as the
  title block strip, so both are read from the real chrome builder.

**Noticed, not changed**
- On screen the measuring document falls back to Helvetica until a PDF has been exported,
  because only the exporter calls `Na__LePdfFonts__EnsureLoaded`. Screen and paper
  therefore measure slightly differently until then - which is why the sweep found 28
  clips against Open Sans and 22 against Helvetica. The fix holds under both, so this is
  an observation about an existing seam, not part of it.

# ---------------------------------------------------------
## TrueVision3D v2.61.0  -  17-Sep-2026
### The Title Block Says What Paper It Is, and Names Every Scale On the Sheet

**Overview**
- Adam: "there should be an awareness in the title block of the current page size, and this
  should say the scale at the page size" - `1:50 {{& other scales if numerous viewport
  scales used on a page}} @ISO A2`.
- Both halves of that were missing. The cell said `1:50` and nothing about the paper, and
  where the viewports on a sheet disagreed it said `As shown`, which names none of them.

**Why the paper size belongs in that cell**
- A scale is a statement about paper. `1:50` on A2 and `1:50` on A4 are different drawings,
  and the number alone is only true of the sheet it was plotted on - print an A2 sheet onto
  A4 and the scale bar lies while the cell still reads `1:50`. Naming both means the cell
  can be checked against the paper in the reader's hand.
- The cell now reads `1:50 @ ISO A2`. The paper comes from the sheet's RESOLVED size
  (`Na__LeLayout__PaperSizeMm`), not the raw field, so a sheet with no size set or an
  unknown one names the default paper it will actually print on rather than nothing.

**A mix lists itself instead of hiding**
- `As shown` told a reader only that the sheet was mixed. `1:50 & 1:100 @ ISO A2` tells them
  which two to look for, and that anything else on the sheet is not to scale. Listed finest
  first, the order the scale list is held in.
- `As shown` is kept for the case it was actually right about: past
  `Scales SheetLabelMaxScales` (3) the list is longer than the cell, so the sheet says it is
  mixed rather than showing a truncated list with an ellipsis through it.
- A sheet of 3D viewports and no 2D ones still reads `NTS @ ISO A3` - it has a paper size
  even with no scale on it.

**The cell was measured, not guessed**
- The Scale cell's share of the strip went 20 -> 30, taken off Site Address (50 -> 44),
  Drawing Title (40 -> 38) and Client (30 -> 28). Every width in `TitleBlock Rows` is a
  relative share of the strip beside the logo, so this is the same trade at every paper size.
- The widths were chosen by measuring with the app's own jsPDF and Open Sans, not by eye.
  At the shipped 20 share the longest label fitted A3 and up but overran A4 by 0.4 mm; at 30
  the longest label the app can produce (`1:20 & 1:50 & 1:100 @ ISO A4`, 29.7 mm) fits the
  A4 cell's 34.8 mm with room to spare, and no other cell was pushed to where a realistic
  value truncates - "Noble Architecture" keeps 2.9 mm of clearance on A4, the tightest.
- Client gave up the last 2 mm rather than Drawn By, which had only 0.4 mm spare once Scale
  had taken its share.

**Everything the cell reads is configurable**
- `Scales SheetLabelShowPaperSize`, `SheetLabelScaleSeparator` (" & "), `SheetLabelPaperJoiner`
  (" @ "), `SheetLabelPaperPrefix` ("ISO "), `SheetLabelMaxScales` and `SheetLabelMixedLabel`.
  Setting the prefix to an empty string gives a bare `1:50 @ A2`; a paper Label configured as
  "ISO A2" is not prefixed twice.

**What did not change**
- A Scale typed into the Sheet panel still wins over the computed label, the way every other
  title block field works - the computed text shows as the input's placeholder.
- `Na__LeScale__SheetLabel`'s paper argument is optional and last, so the PDF metadata
  caller, which names the paper in a field of its own, is byte-identical.
- The classic (scanned) title block takes the same field, and its A3 anchors leave 38 mm
  between Scale and Date, so the longest label clears it.

**Proved**
- `Na__Verify__ModuleGraph__` and `Na__Verify__Exports__` both pass; the new
  SheetRecords -> SheetLayout import reaches only the six config modules, so it cannot join
  the Layout Editor's long-standing record/model/panel cycles.
- 23 label cases run against the real module and the real shipped JSON, and a new page,
  `80__Testing__PrototypeEnvironment/Na__Test__TitleBlockScaleCell__.html`, renders the real
  chrome for PS01's sheet shapes at A4, A3, A2 and A1. Every cell paints in full, with no
  ellipsis anywhere.
- Not yet ported to ValeVision3D.

# ---------------------------------------------------------
## TrueVision3D v2.60.0  -  17-Sep-2026 - ValeVision3D v2.53.0 - 17-Sep-2026
### Dimensions You Can Grab, Constrain, Type Into and Slide

**Overview**
- Adam, on the vertex work that landed in v2.58.0: "add the same behaviour to dragging a
  dimension end so you can constrain it" - then, on trying it: "clicking here to try and
  move the dimension points just doesn't work."
- He was right twice over. The grips were drawn and `DimensionGrabFor` answered `'end'`
  correctly for a press on one - but `Na__LeTools__Resolve` never got that far.

**Why a dimension's points could not be grabbed**
- `Resolve` asks the markup hit test what is under the pointer, and for a dimension that
  means its LINE and its VALUE. The measured points are at the far end of the extension
  lines - on PS01's D01, some 45 mm of paper away, because putting the line clear of what
  it measures is the entire purpose of an offset. So a press on a measured point found
  nothing at all, and with a container open, finding nothing means "the press landed
  outside, step back out". Clicking a grip closed the dimension instead of taking hold.
- `Na__LeTools__OpenDimensionGripAt` now looks for the open dimension's grips first, the
  way the rotate grip above it already did: both stand off the object they belong to, and
  neither can be found by asking what lies under the pointer. Only while that dimension is
  open, and never for `'whole'`, so a press on the line itself still resolves as before.

**A measured point constrains like a vertex**
- The arrow keys hold a dimension end to an axis, Shift holds it to the nearer one, and a
  snap supplies the coordinate ALONG the held axis rather than cancelling it. The band
  takes the locked axis's colour. Nothing new was invented: `Na__LayoutEditor__AxisLock__`
  has done this for the placing tools since v2.21.0 and now reaches three more drags.
- The same rule fixed Shift for a run of vertices. It was not that several points broke the
  constraint - it was that the snapped point used to win outright, and a run of vertices is
  dragged across far more geometry than one, so something was nearly always snapping and
  the axis was nearly always lost. `Na__LeAxis__Hold` is what that rule is called.

**Typing what the dimension should READ**
- Adam chose this over "how far the end moves", and the geometry rewards it: a horizontal
  dimension measures the x between its points and a vertical one the y, so a typed value
  sets that coordinate alone and leaves the other where the drag put it. Locking X on a
  horizontal dimension therefore holds the very coordinate the value sets, instead of
  fighting it. An aligned dimension runs its end along the line between the two points.
- Type 2500, see it should have been 2000, type that: every value is measured from the
  fixed end rather than from the last answer, and the run lasts until the tool changes.
  The measured points and the line stay exactly where they are.

**The line has a grip at each end now, and slides**
- Adam: "users will expect points here on the dimensions as well... this stretches the
  dimension line and the dimension text and slides it to a new position."
- All three grips on the line - both ends and the middle - change the OFFSET, carrying the
  line and the value across while the two measured points stay put. Reaching for the end of
  a dimension line to push it clear of something is the natural gesture, and the middle grip
  alone is often buried under the value.
- The Measurements box reads `Offset` while one is dragged and a typed distance sets it, at
  the scale the dimension reads at, keeping whichever side the drag chose. It retypes like
  everything else.

**Selection points you can actually see**
- Adam: "when you zoom in, the red vertices that show the selection are too small... they
  just disappear." They did, and the arithmetic says so exactly.
- Everything in the handles layer sits inside the paper's `scale(zoom)`, so one screen pixel
  is `1 / zoom`. The edge width read `Math.max(1, 1 / zoom)`, which put the floor in the
  WRONG UNITS: zoomed in, the clamp pinned the edge at one PAPER pixel, which is `zoom`
  pixels on screen. At 4x a 9 px grip carried a 4 px border on each side and a picked vertex
  was a white ring with no red left in it; at 8x the measured red width was **minus seven
  pixels**. The clamp only ever bit while zoomed in, which is exactly where grips are needed.
- `Na__LeGrips__EdgePx` replaces it, and the same mistake is fixed in the stem, the rubber
  box, the insert diamond, the viewport handles and the selection box. A picked grip is now
  drawn larger than a plain one as well (`GripSizePickedPx`, 13 against 9), since it marks
  the points the next drag will carry.
- Proved at five zooms: a picked grip is a constant 13 px box with a 1 px edge and 11 px of
  red, from 0.5x to 8x.

**Less white while a container is open**
- `EditScope FadeOpacity` 0.25 -> 0.45. Adam: "make the fade of everything else less
  extreme... it goes a bit too white currently."

**Fixed on the way past**
- `GetDimEndRetype` returned an OFFSET record to the span path, so the second value typed
  after sliding a line moved the dimension's end instead. Caught by a retype landing 1.8 mm
  off; it now ignores a record that is not a moved end.
- The dimension branch of `ApplyDrag` never called `Na__LeMeasure__Refresh`, so the box
  stayed asleep through a dimension drag however well the rest of it worked.

**Files**
- `Na__LayoutEditor__SheetTools__HitResolution__.js` - `OpenDimensionGripAt`, and `Resolve`
  asks it before the markup hit test.
- `Na__LayoutEditor__SheetTools__PointerDrag__.js` - the constraint on both dimension
  drags, `DimEndAtSpan`, `TypeDimensionSpan`, `TypeDimensionOffset`, their readings and
  retype records, `RerunDimEndDrag`.
- `Na__LayoutEditor__Grips__.js` - `EdgePx`, larger picked grips, a grip at each end of the
  dimension line and the grab to match.
- `Na__LayoutEditor__Measurements__.js` - `Length` for a dimension end, `Offset` for a line
  being slid, both retypable.
- `Na__LayoutEditor__SheetTools__State__.js`, `__ToolState__.js`, `__Keyboard__.js`,
  `__.js` - the shared retype records, the keys and the wiring.
- `Na__LayoutEditor__ViewportHandles__.js`, `Na__LayoutEditor__SelectionBox__.js` - the same
  edge-width mistake.
- `Na__LayoutEditor__AppConfig__.json` - `GripSizePickedPx`, `FadeOpacity`, the new labels.

**Verified** on PS01 D01 through the real pointer and key path, with every R2 write
blocked and nothing attempted: the grab, both axis locks, typed spans of 2500 / 1200 / 3000
landing exactly and the line staying put, typed offsets of 1500 / 800 / 2200 / 1250 with the
measured points never moving, Shift holding a two-vertex run to one axis, and the grip
arithmetic at five zooms. Every record restored to its original coordinates afterwards.

# ---------------------------------------------------------
## TrueVision3D v2.59.0  -  17-Sep-2026 - ValeVision3D v2.52.0 - 17-Sep-2026
### Container Editing, the Move Tool, and Dimensions You Can Actually Edit

**Overview**
- Adam: editing a vector was "painful and too dangerous", because the vertex dots sat
  on every selected vector and a drag meant for a point moved the drawing behind it.
  And dimensions were "completely uneditable - if something needs to change size you
  can't just edit the individual dimensions, you have to create brand new ones".
- Both come from the same missing idea: the editor had no notion of being INSIDE
  something. SketchUp has one, and once the Layout Editor has one too, the dots, the
  grips, the point tools and the safety all follow from it.

**The container (Na__LayoutEditor__EditScope__, new)**
- A context stack: `[{ kind : 'group' | 'shape' | 'dimension', id }]`, outermost first,
  empty being the sheet itself. Double-click - or press Enter - to step into a group,
  and again to step into a vector or a dimension inside it. Groups nest, so the stack
  can read group, group, vector.
- While a container is open, **only what is inside it answers a press.** Hit resolution
  goes through the scope: a hit inside is remapped to the item selectable at that
  level, everything outside comes back null, and viewports are not even looked for.
- **Everything else fades.** One class on the paper drops the viewport pictures, the
  border and title block and all the markup to 25 percent, and the contents of the
  open container are drawn AGAIN at full strength in a new focus layer above them. The
  faded copy underneath is the same markup in the same place, so nothing shifts as a
  container opens or closes. `EditScope FadeOpacity` sets the amount.
- **Click anywhere outside to close it.** A press outside starts a box; if it never
  stretches it was a click, and the click steps back out one level - to the group that
  holds the vector, or to the sheet. Escape closes the lot.

**The dots belong to the container**
- A selected vector shows its highlight box and NO dots. The dots are what says "you
  are inside this one, and the points are what a press will take hold of".
- Same for a dimension: its four grips - the two measured points, the line's offset and
  a moved value - appear when you step inside it and not before. Outside, a dimension
  is one object that selects, moves and deletes whole. **That is the fix for
  "uneditable": inside its container the grips read at twice the tolerance, because
  nothing else on the sheet is competing for the press.** Missing a corner by a pixel
  and dragging the whole dimension instead was the entire failure.
- A dimension's VALUE keeps its double click (the override box). The line, the ticks and
  the extension lines step inside to the grips. Both readings are true; that is which.
- Inserting a point (Shift over an edge) and deleting one are inside-only as well.

**Several points at once**
- A box drawn inside a vector takes VERTICES, not sheet items - which was Adam's
  complaint that box-selecting points "ends up selecting a load of other things".
- A picked point is drawn **solid red** against the blue of the rest: blue is a point
  you could take hold of, red is one you have. A dimension's held grip reads red too.
- Dragging one picked point carries every picked point: the one under the pointer snaps
  and reads the axis lock, the rest move by exactly however far it went, so a boxed run
  of corners keeps its shape. Delete takes the picked points out, never cutting a vector
  below the two that still draw.

**The Move tool (M)**
- **Select no longer moves anything.** A press picks; a drag does nothing at all. Press
  M and the cursor becomes a four-way arrow: now a drag moves whatever is under it.
- What Select keeps is everything that EDITS an object rather than relocating it: the
  crop handles, a dimension's grips, a leader's tip and head, the text rotate grip, the
  drawing inside a viewport being repositioned, and the points of an open container.
  Those are small, deliberate targets - they are not what gets nudged by accident.
- `EditScope MoveToolRequired` turns the catch off and puts the old behaviour back.

**Escape, and Select as the one resting state**
- Escape was a ladder - a press to abandon the placement, another to clear the
  selection, another to put the tool down - so how many presses you needed depended on
  state nobody was tracking. **One press now stops everything**: abandon what is half
  done, close every container, drop the selection, and **come back to Select**.
- A tool-less state was built first and taken out the same day, on Adam's word: with
  nothing armed a press on the sheet did nothing, so the browser took the click and
  offered its own copy and search menus over the paper. **Select is the resting state
  and there is no other** - every other tool is picked up from it and Escape returns to
  it. `TOOL_NONE` is gone rather than hidden, so nothing can reach that state again.
- **The space bar picks Select, beside V**, as most CAD packages bind it. It arms
  Select; it does not toggle it off. Both keys are always taken from the browser, which
  would otherwise scroll the sheet out from under the cursor.
- **Every press the select path handles is taken from the browser**, whether it moves
  anything or not. A plain pick used to fall through without `preventDefault`, which is
  the other half of why the page's own menus appeared over the sheet.

**The menu belongs to the container**
- Inside a vector the right-click menu is about its points: insert one where you
  clicked, delete the picked ones, close the shape, step back out. Inside a dimension:
  its value, where that value sits, and the way out. **This is where cut, extend, trim
  and join will sit** - they belong to that container and to no other, which is the
  whole reason for having one.
- Outside, a vector, a dimension and a group each offer the way in.

**Built alongside v2.58.0, in the same files.** Another session was adding the
arrow-key axis lock and the retypable typed length to the vertex drag while this was
being written, so both landed in `SheetTools__PointerDrag__` and `SheetTools__State__`.
They compose: a boxed run of points drags with the axis lock and the Measurements box
reading, because the multi-vertex carry is applied AFTER the snap and the lock have
decided where the grabbed point goes. The space bar is that release's
`Tool__SelectToggle`, which is the better half of this one's "space picks Select": one
press arms Select, a second leaves `TOOL_NONE` - the same resting state Escape now
leaves. `TOOL_NONE` came from here; the toggle that reaches it came from there.

**What Adam caught straight away, fixed in the same release**
- **The arrow keys nudged the open object.** Inside a vector or a dimension the arrows
  are the axis lock and nothing else, but with no drag in flight they fell through to
  the nudge - which moved the whole open vector. So an arrow pressed between drags
  walked the very thing being edited, and the lock then read as broken because the
  shape had already shifted. In a container the key is now swallowed: the lock still
  takes it mid-drag, nothing moves otherwise, and the page cannot scroll.
- **A typed length landed one point of a picked run.** `WriteVertexAlong` took only the
  grabbed index, so typing a value over a boxed run of corners moved that corner and
  wrote every other picked corner BACK to where it started - they previewed moving
  together and landed one. It now carries the whole picked set the same distance, and
  the retype record keeps the ORIGINAL run of points beside the run it just wrote, so
  correcting 20 to 5 puts them 5 from where they began rather than 25. Proved on PS01:
  type 20, both corners +20.000; retype 5, both +5.000; the other corners untouched;
  two undos put the shape back exactly.
- The plain drag and release was already right, and was checked rather than assumed:
  both picked corners land, by the same delta, with the rest of the shape untouched.
- **A press near a corner drew a box instead of grabbing it.** The worst of the four,
  and the one that made the container "horrible to use": Resolve asked the markup hit
  test first, and that answers for the LINE. A press two pixels off the line but dead on
  a corner therefore found nothing, was read as "outside the container", and started a
  selection box exactly where the hand was trying to grab. `ScopeGrabAt` now answers
  before the line test, measured against the GRIPS at `EditScope GrabRadiusPx` (14) - a
  fixed reach ON SCREEN at any zoom, because the grip is what the hand is aiming at, and
  a grip looks the same size however far in the sheet is zoomed. Proved at 5x zoom: a
  press 0, 4 and 8 px off the corner grabs the vertex; 6 px off and dragged moves the
  corner and starts no box at all.
- **The top level lost its move constraints.** Whole-object moves had no axis lock and no
  typed distance, so a vector could no longer be walked an exact 50 mm along X the way a
  viewport frame could. `IsMoveDrag`, `GetMoveDrag`, `TypeMoveLength` and `RerunMoveDrag`
  give a whole-object move - one item by its body, or a whole multi-item selection - the
  same pair a viewport frame has had since v2.24.0: the arrow keys lock it to X or Y
  (`ApplyDrag` honours the lock over Shift's guess and draws the band in the axis's
  colour), and the Measurements box reads how far it has travelled and lands it a typed
  distance exactly, clear of the snap. Proved on PS01: 50 mm typed along a diagonal drag
  landed (43.074, 25.389) - 50.000 - with every corner carried the same and the shape
  unchanged in size.

**Ported to ValeVision3D as v2.52.0, the same session.** Same module set, same
behaviour; the only divergence is that ValeVision's dimensions have no fixed-length
extension lines, so the extracted `PushDimension` keeps ValeVision's own shape.

**Not yet proved in the app**
- Every module parses and every named import resolves in both apps, and the container
  opens, fades the sheet and puts four vertex grips on screen through the real
  `EnterScope` path on PS01's D01. The pointer paths - drag a boxed run of points, drag
  a dimension's end grip onto the linework, click outside to leave - were not driven
  synthetically; Adam was testing the live build as it went.

# ---------------------------------------------------------
## TrueVision3D v2.58.2  -  17-Sep-2026
### The Progressive Renderer Was Rebuilding Its Buffer on Every Chunk

**Overview**
- Adam: "it's getting stuck at 6 out of 16, and I've got a pretty high-end PC...
  I'm thinking it's just got some kind of extra timeout thing in TrueVision that
  doesn't exist in ValeVision."
- There is no such timeout, and there is no divergence. The refinement module
  here and ValeVision's are the SAME FILE, the supersampler is the same file,
  the AppConfig numbers are the same numbers, orbit damping is off for the
  mouse in both, and both set the renderer's pixel ratio with the same line.
  ValeVision carries exactly this bug; whether it bites depends on the window.

**The fault**
- `EffectComposer` sizes its buffers as `cssSize x pixelRatio` and stores the
  product unrounded. Both apps set `setPixelRatio(Math.min(devicePixelRatio,
  1.5))`, so on a display at 125% or 150% scaling - the normal case on a good
  monitor - the buffer comes out at a size like 2498.75 x 1406.25 whenever the
  viewport's dimensions are not multiples of four (or two).
- The supersampler ROUNDS the size it is given and reports the rounded size.
  `EnsureBuffer` compared that against the raw buffer size, so on a fractional
  buffer the two never matched: on EVERY chunk the accumulation buffer was
  torn down, rebuilt, and the running total discarded with it - which is the
  one discard in the module that does not restart the debounce - and the chunk
  drew again from zero. It landed on the first chunk size every frame, for
  ever: 8 cold (no frame-time average yet, so `maxChunkSamples`), 6 warm
  (`floor(100 / 16.6)`). A full chunk of GPU work per frame, presenting the
  same part-finished picture each time, while the refiner kept answering
  "wanted, come straight back". The frame rate readout froze on its last value
  because a chunk frame is not an ordinary frame and never feeds it.
- It never reproduced in the harness because the harness ran at an integer
  buffer size. It reproduced immediately once the buffer was set fractional:
  87 chunks in 3.5 seconds, stuck at the first chunk size, `wanted: true,
  delayMs: 0` - the exact numbers the stall diagnostic reported from Adam's
  machine.

### Fixed
- **`EnsureBuffer` floors the buffer size before comparing and before
  creating.** Floor, not round: WebGL takes texture sizes as integers and
  truncates, so floor is the buffer that actually exists on the GPU, and the
  accumulation target now matches it pixel for pixel. The equality test is
  exact, so a buffer is rebuilt only when the window really changes size.
- **Every tick ends by arming what comes next**, on every path, in one
  function a `finally` guarantees is reached. Found on the way and real: a
  burst could be abandoned by any early return, and a thrown frame stopped the
  loop outright.
- **A thrown frame no longer stops the render loop.** Reported, and on it goes.
- **A refinement that stops getting anywhere restarts itself** after 2.5
  seconds and logs the state it found - count, what the refiner was asking
  for, frame rate, active reasons, hold, visibility, the composer's buffer size
  and the pixel ratios. This is what turned "it's stuck" into numbers, and it
  stays in: the next stall of any shape names itself.

### Changed
- **One clock.** `planFrame` reads `performance.now()` itself; the loop passes
  no timestamp. It used to be handed the animation frame's start time while
  everything else in the module used wall clock, and a 260ms chunk is enough
  for the two to disagree at the moment of the decision. Not the stall - it
  slows a run, it does not freeze one - but a real defect, so fixed.
- **The engine hold stands the refiner down properly** - the third of
  ValeVision v2.48.1's three stand-down points, and the one this port was
  missing. The hold was only fed into `sceneBusy`, which stopped the
  refinement and not the painting; a sheet that owned the screen was still
  being drawn over every frame.
- **The PDF can no longer print an under-sampled 3D viewport.** The export
  profile is High - 20 px/mm and SIXTEEN samples - and does not scale with the
  device pixel ratio; the working profile does, so Medium on a 2x screen is
  24 px/mm at FOUR samples and passed the width-only reuse test. Snapshot
  assets now record `Asset__Samples`, and a cached render is reused only when
  it is both wide enough AND sampled enough. Older records read as unknown and
  re-render once. 2D underlays were never affected.

### Notes
- Nothing about the sample count, chunk sizing, milestones or the cost while
  the camera moves has changed.
- Verified on PS01 Musters Road with the fix in: an integer buffer converging
  16/16 in two chunks; the fractional buffer that had spun 87 chunks converging
  16/16 in two; a viewport-shaped 1600 x 843.2 buffer converging in two; the
  watchdog silent throughout; and earlier, five orbit-and-release cycles, a
  deliberately jammed run caught and restarted, three thrown frames survived,
  and an engine hold standing down and coming back.

### Files
- `05__RenderPipeline/Na__RenderEffect__ProgressiveRefine__.js` 1.0.3: the
  floored buffer comparison; 1.0.2: `planFrame` reads its own clock.
- `01__AppCore/Na__AppFlow__LoadingSequence.js`: `Na__RenderLoop__ArmNextFrame`,
  `Na__RenderLoop__WatchRefineProgress` and its diagnostic, the `try`/`finally`
  around the frame, the engine hold gate, no timestamp passed to `planFrame`,
  a dead `navigationChanged` local removed.
- `51__System__LayoutEditor/20__System__Viewports/Na__LayoutEditor__Viewport3d__.js`:
  `Na__LeVp3d__SampledEnough`, `Asset__Samples` written and read.
- `51__System__LayoutEditor/07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js`:
  `Asset__Samples` normalised (null when unknown).

**To port to ValeVision**
- All of it, and the buffer fix first: ValeVision has the identical
  `EnsureBuffer`, the identical pixel-ratio line, the same single
  ask-for-the-next-chunk site, no thrown-frame guard, and the identical
  width-only export reuse rule. It has not shown the stall only because
  Adam's ValeVision window happens to give an integer buffer.

# ---------------------------------------------------------
## TrueVision3D v2.58.0  -  17-Sep-2026
### Arrow Keys Constrain a Vertex Drag, a Typed Length Can Be Retyped, and the Space Bar Toggles Select

**Overview**
- Adam: "holding Shift works, but when you try and type a value in and take your
  finger off Shift, it very unhelpfully locks it to a random value."
- He is right, and the reason is structural rather than a bug. Shift is a HELD
  constraint, and the hand holding it is the hand that has to reach the number
  keys. Let go to type 2500 and the constraint goes with it, so the length lands
  along whatever direction the raw cursor happened to be pointing when Enter was
  pressed - which is the "random value".
- The arrow-key axis lock already existed for the tools that PLACE points
  (`Na__LayoutEditor__AxisLock__`, v2.21.0): left and right hold the X axis, up
  and down the Y, the same key again releases it, and nothing is held down. That
  is exactly the constraint a vertex drag needed, and it is the one this release
  gives it - the answer was to reach the feature across, not to write a new one.

**An arrow key holds a vertex drag to an axis**
- Grab a vertex, press Up or Down and the vertex only moves in Y; Left or Right
  and only in X. The same key again releases it, and the lock ends with the drag.
- The lock BEATS A SNAP rather than cancelling it: a snapped point still supplies
  the coordinate along the axis, so hovering a vertex across the drawing lines the
  two up without pulling the dragged vertex off its axis. That is the rule the
  placing tools already follow, and vertices now follow it too.
- The rubber band takes the locked axis's colour, so the constraint is visible
  with nothing held down - which matters precisely because the hand has left the
  mouse to type.
- Shift is untouched. With no lock on it still holds the drag to whichever axis
  the cursor is nearer, exactly as before.

**A typed length stays live, the way SketchUp's does**
- Type 2500, Enter - then 2000, Enter, then 1800. Each value moves the same vertex
  the same way, MEASURED FROM WHERE IT STARTED rather than from where the last
  value put it, so a figure that came out wrong is corrected by typing the right
  one instead of being undone first. The run lasts until the tool changes.
- The Measurements box no longer goes grey the moment Enter is pressed: it keeps
  reading the vertex move, keeps its scale chip, and keeps taking keys. The first
  value says "Type another length to move it again" above the box, because nothing
  else on screen would say that it is allowed.
- Each correction is an undo step of its own, and the run ends quietly the moment
  anything else touches the shape - a nudge, a drag, an undo, a new selection.
- This follows the pattern the Rectangle tool already had for a rectangle that has
  just landed (`Na__LeRect__Retypable`), so there is one idea in the editor rather
  than two: a typed size stays on offer until the work moves on.

**The space bar stops scrolling the page**
- Adam: "hitting the spacebar is making the page scroll down or zoom out."
- Space was already bound to the Select tool (`Tool__SelectSpace`), and picking the
  tool worked - but the `Tool__Select` case never called `preventDefault`, so the
  browser got the key as well and scrolled the sheet out from under the cursor.
  `Pan__SpaceLeftDrag` is switched off, so the PC controls module did not take the
  key either. Nobody did, and the page moved.
- Space now runs `Tool__SelectToggle`, which is ALWAYS taken from the browser, even
  when it changes nothing. One press puts whatever tool is up down and picks Select
  up; the next press puts Select down too, leaving nothing armed - the same resting
  state Escape leaves (`TOOL_NONE`). A held space repeats, and only the first press
  counts, so re-enabling `Pan__SpaceLeftDrag` will not flip the tool while panning.
- A value being typed into the Measurements box still keeps the space bar: a space
  is in `TypingCharacters` but not in `StartCharacters`, so `3000 x 2000` types as
  it always did while a bare space reaches the toggle.

**Files**
- `Na__LayoutEditor__KeyMappings__.json` - `Tool__SelectSpace` now runs
  `Tool__SelectToggle`, which joins the action catalogue.
- `Na__LayoutEditor__SheetTools__State__.js` v1.1.0 - `VertexRetype` and `SAME_MM`.
- `Na__LayoutEditor__SheetTools__PointerDrag__.js` v1.1.0 - the lock in the vertex
  drag, the band, `VertexRetypable`, `GetVertexRetype`, `WriteVertexAlong`,
  `IsVertexDrag`, `RerunVertexDrag`; `TypeVertexLength` now serves both.
- `Na__LayoutEditor__SheetTools__Keyboard__.js` v1.2.0 - `AxisKey` takes a vertex
  drag; `Tool__SelectToggle` for the space bar.
- `Na__LayoutEditor__Measurements__.js` v1.3.0 - the box stays awake for a
  retypable vertex; `MeasureVertexAgain`.
- `Na__LayoutEditor__SheetTools__ToolState__.js` - `CancelPlacement` ends the run.

# ---------------------------------------------------------
## TrueVision3D v2.57.0  -  17-Sep-2026
### Match Properties to a Whole Selection, and One Markup Panel Open at a Time

**Overview**
- Adam: "there is currently no way to match properties of leaders", and bubble text
  that would not take a size from another bubble.
- **Leader matching was already there and already worked.** Proved end to end on
  PS01's own D01 sheet, through the real pointer path: arm the eyedropper, click a
  3.5mm green bubble, click a 2.5mm navy one, and the text size, colour, bubble size
  and line weight all travel. Note-to-bubble travels too. Nothing in this release
  fixes the eyedropper, because nothing in it was broken.
- **What was broken was knowing which panel you were typing into.** On entering a
  sheet, Text, Leaders, Dimensions and Vectors all sat open at once, each with its
  own size box, colour picker and weight. Four "Text mm"-shaped fields in one
  column, and only one of them belonging to the bubble that was selected - the
  other three quietly setting the defaults for new objects. Typing 3 into the wrong
  one does nothing to the bubble, which reads exactly like match properties not
  working on leaders.

**One markup panel at a time**
- Selecting anything on the sheet now opens that kind's section and folds the other
  three. Picking a style with the eyedropper does the same, so what is on show is
  always what is being matched. A mixed selection opens nothing, because there is no
  single answer to what would be edited; groups are opened up first, so windowing a
  grouped block of notes still lands on the right panel.
- Several can still be opened by hand - to read one kind's text size against
  another's - and the next selection tidies them away again.
- `LayoutEditor__Panels__AccordionSections` names the group and
  `LayoutEditor__Panels__FocusSectionOnSelect` turns the behaviour off.
  `CollapseOthersOnOpen`, declared back in the first panel host and never wired to
  anything, now does what it says: folds the others the moment one is opened by hand.

**Match properties over a whole selection**
- `Na__LeDrop__ApplyMany` writes one style bag onto many items, one undo step per
  kind, skipping locked items rather than refusing the lot - the rule a group move
  already follows.
- **Paste properties to N selected** on the context menu of a multi-selection and of
  a group. The count is what will actually change: the items are expanded past any
  group, then the source itself, the other kinds and the locked drop out, and the
  item does not appear when the answer is none. A group whose members are all one
  kind hands out a style as well, so a row of bubbles can be copied from without
  being opened.
- Tested on D01: four bubbles restyled in one click, one Ctrl+Z put all four back.

**The panels write the whole selection**
- Select nine dimensions, change the text size, and all nine change. Every one of the
  four markup panels now reads the FIRST selected item of its kind and writes ALL of
  them, in one undo step, where before it showed the settings for new objects and
  wrote nothing.
- It goes through the eyedropper's trait table, so a panel field travels by exactly
  the declaration the eyedropper copies by - and **content cannot travel with style**:
  `StyleOnly` cuts a patch down to the kind's style traits, so a text item's words, a
  dimension's override and a bubble's specification link stay where they are. A
  leader's type is a palette-only trait, so nine selected leaders take a size and a
  colour without a note turning into a bubble.
- The note under each panel says which case it is in: editing one, editing N, or
  setting the defaults.

**Files**
- Layout Editor: `Eyedropper__` 1.8.0 (ApplyMany, PaintMany, PaintableIn, StyleKeys,
  StyleOnly), `SheetTools__ContextMenu__` 1.1.0, `PanelHost__` 1.3.0 (SetFolded,
  FocusSection, SelectedOfKind, ApplyToSelection), `ModeController__`
  (SectionForKind, FocusPanelForSelection), `Panel__Text__`, `Panel__Dimensions__`,
  `Panel__Shapes__`, `Panel__Leaders__`, `ConfigState__EditorSetup__`,
  `AppConfig__.json`.

**Still open**
- Selecting a viewport leaves the four markup folds as they are, rather than folding
  them all. Deliberate for now: it would mean unfolding by hand to set the defaults
  for new text afterwards.
- Not yet ported to ValeVision3D.

# ---------------------------------------------------------
## TrueVision3D v2.56.2  -  16-Sep-2026
### Carousel Holds Opaque Longer on First Reveal; Mobile Swap Breakpoint Tightened

**Overview**
- Two small follow-ups from Adam, ported in step with ValeVision3D.

**Carousel first-reveal hold**
- The carousel's first reveal after the loading screen now holds fully opaque
  for 4 seconds (`InitialRevealHoldMs`) instead of the usual 2.6s wake hold
  used for ordinary interactions, so a user arriving straight off the loading
  screen gets a clear look at it before it settles into its 50% idle
  translucency. `FlashCarouselWake` and `SetCarouselVisible` now take an
  optional hold override; every other wake (clicks, taps, scrolling, the
  scene camera flight) still uses the shorter 2.6s hold.

**Mobile swap breakpoint**
- Tightened the `max-aspect-ratio` leg of the mobile menu swap from ~1.03:1 to
  19/20 (0.95:1), matching ValeVision3D now that its Views button removal
  brought its toolbar pill to the same width as this app's.

# ---------------------------------------------------------
## TrueVision3D v2.56.1  -  16-Sep-2026
### Mobile Menu Swap: Also Trigger on Near-Square/Portrait Windows

**Overview**
- The v2.9.0 toolbar/Tools-menu swap only fired under 768px wide, but the same
  collision shows up on windows well over that width once they get short or
  square - e.g. a resized desktop browser at ~1345x1309 (~1.03:1). The centred
  nav pill can reach far enough across at that width to run into the top-right
  Tools & Settings dropdown, which max-width alone never catches.

**The fix**
- The swap in both `Na__UiFeature__Styles__NavigationToolbar__.css` and
  `Na__UiFeature__Styles__DropdownAndToast__.css` now triggers on
  `(max-width: 768px), (max-aspect-ratio: 103/100)` - an OR of the original
  width rule and a new aspect-ratio rule (~1.03:1, rounded from the
  1345x1309 reference case). Either condition is enough on its own.
- Ported the identical breakpoint change to ValeVision3D, which shares this
  exact swap mechanism (originally ported from here in v2.9.0).

# ---------------------------------------------------------
## TrueVision3D v2.56.0  -  16-Sep-2026
### The Progressive Renderer, and the Tools Menu Brought Into Line With ValeVision

**Overview**
- Two things from Adam, in one pass: port ValeVision3D v2.48.1's progressive renderer, and make this menu look and
  behave like that one.
- **The viewport sharpens itself to a full 16-sample supersampled image once the camera stops.** While the camera moves
  nothing changes at all: the render loop draws exactly the frame it drew before, FXAA included, at the same frame
  rate. Once the camera has held still for 150ms the loop keeps going instead of idling and redraws the same frame with
  sub-pixel jitter, averaging the results. The same maths the image exporter already uses, spent in the time the
  viewport was previously doing nothing.
- **What it fixes.** A glazing bar thinner than a pixel is a coin toss between full black and full white, so it draws
  as a dashed line rather than a thin one, and the dentils under a cornice read as speckle. That is not stair-stepping,
  it is the pixel having no way to say "a third covered". Sixteen samples give it one. The lower the screen resolution
  the worse the breakup, so a 1080p machine gains far more from this than a 4K one.

**The port**
- `Na__RenderEffect__ProgressiveRefine__.js` 1.0.1 (new) is ValeVision's file **verbatim** apart from the app name in
  its header and in one console warning. The settle test, the chunk planner and the whole API are identical and are
  meant to stay that way: a second copy that drifts is worse than no second copy.
- What differs is the CALLER, and only in ways this app already differed: one engine rather than two, no video studio
  to report as busy, and a 2D drawing path that bypasses the composer instead of running a preset through it. A render
  hold counts as busy here, so a Layout Editor sheet or an offscreen snapshot never has a refinement woken underneath
  it.
- `Na__RenderEffect__Supersampler__.js`: `present()` takes an optional scale, so a part-finished total can be shown
  correctly exposed rather than as a dim frame filling up. Defaults to 1, so the image exporter is untouched. This is
  ValeVision's v1.1.0 change arriving here, and the two files match again.
- `Na__RenderPipeline__PostProcessing__Setup.js` exposes `aoPassRef` so a readout can show whether SSAO is actually on.
  The performance monitor disables it without telling anyone.
- The render loop's per-frame work is now two named functions rather than one inline block: the effect chain (AO
  uniforms, depth pre-pass, profile normals, composer) and the section cut overlay. A refinement sample runs the first
  through a nudged projection and the second through the settled one.

**The menu**
- **Icons, from ValeVision.** The eight `UiIcons__MenuIcons__ToolsMenu` files are copied into
  `01__AppAssets__TrueVision`, and the CSS that draws them (`__btn-icon`, `__btn-label`, the toggle rows, the panel
  divider and the danger action) is ported with them: none of it existed here.

| Row | Icon |
|---|---|
| Tools & Settings (the menu itself) | MainMenuIcon |
| Export Image | ExportImage |
| Storey Toggle | ViewModelLayers |
| Floor Isolate | GridSystem |
| Design Phase | CameraSettings |
| User Guide | the navigation set's OpenNavHelpPanel, which TrueVision already shipped and actually means help |
| Full Screen | FullScreen |
| App Settings | MainMenuIcon |

- **App Settings is new**, matching ValeVision: a folded section holding Visual Effects and Purge App Cache. The purge
  calls the registrar's existing `purgeApp()`, which was already written and reachable only from the console.
- **Shadows and Profile Lines leave the top level** for Visual Effects, alongside the Progressive Renderer, with a
  frame rate and a refinement readout under them. Shadows is relabelled Ambient Occlusion (SSAO) to match ValeVision
  word for word.
- **The rows read the passes rather than remembering clicks.** Each used to carry its own inline handler tracking its
  own state; the AO performance monitor can switch SSAO off on its own, and a badge tracking only its own clicks would
  confidently show ON over a picture that has none. A pass the pipeline does not have reads as a dimmed N/A row.
- **Profile Lines stays one switch for two renderers.** The 3D viewport's Sobel lives in the composer; a drawing
  bypasses the composer and inks its own outline. The new module takes `Na__DrawProfile__SetEnabled` from the caller so
  OFF still means OFF on an open plan, without depending on the drawing view core.
- **Install App is removed.** The install prompt has its own notification, nothing referenced the row's ids, and it was
  the one entry with no icon in a menu that now has them throughout.
- **Full Screen's inline bracket SVGs are removed.** The row carries the same PNG icon as every other one now, so the
  brackets were a second symbol saying the same thing, and the ON/OFF badge already reports the state they swapped to
  show. Their stylesheet region went with them rather than being left behind for an element that no longer exists.

**Notes**
- Samples are spread over frames in chunks sized from the measured frame time against a 100ms budget, always stopping
  on a milestone (8, then 16). Sixteen renders inside one frame would block the main thread for a third of a second and
  swallow the first click after the camera stops.
- Every frame that runs must draw. `preserveDrawingBuffer` is off, so a frame that draws nothing composites an empty
  buffer and the viewport flashes. A chunk therefore always ends with a present, and a converged frame in walk or fly
  (where the loop is held open to poll the keyboard) re-presents the finished average: one full screen quad in place of
  the whole effect chain, so standing still in walk mode is now cheaper than it was, not dearer.
- Stillness is measured, not announced, because walk and fly never let the loop stop. What is remembered is when the
  camera last MOVED, not how long it has been still - a timestamp survives the silence after a single invalidation
  frame, which is what a wheel zoom or a jump to a saved view actually is.
- The composer is borrowed one frame at a time: `renderToScreen` and FXAA are set at the top of a chunk and put back at
  the bottom of the same frame, so an image export starting between frames always finds the pipeline as it left it.
- Memory: one half-float RGBA buffer at the composer's size, about 66MB at 3840x2160 and 17MB at 1920x1080. Allocated
  the first time the camera sits still, rebuilt automatically when the size stops matching, handed back if the feature
  is switched off.
- Scope: the 3D viewport only. The 2D drawing views are excluded. Image export is untouched.

**Files**
- `05__RenderPipeline/Na__RenderEffect__ProgressiveRefine__.js` 1.0.1 (new).
- `05__RenderPipeline/Na__UiFeature__VisualEffects__Controls.js` 1.0.0 (new).
- `70__System__DevTools/Na__UiFeature__PurgeAppCache__Button.js` 1.0.0 (new).
- `05__RenderPipeline/Na__RenderEffect__Supersampler__.js`: the present scale.
- `05__RenderPipeline/Na__RenderPipeline__PostProcessing__Setup.js`: `aoPassRef`.
- `01__AppCore/Na__AppFlow__LoadingSequence.js`: the render loop branch, the two extracted per-frame functions, the
  settle wake-up and the reset hooks.
- `02__AppData/Na__AppConfig__Main.json`: `RenderEffect__ProgressiveRefine`.
- `Index.html`: the icons, the App Settings section, the two moved toggles, Install App removed, and the two inline
  handler blocks replaced by the new module.
- `03__Style__AppStylesheets/Na__UiFeature__Styles__DropdownAndToast__.css`: icons, toggle rows, readouts, divider,
  danger action.
- `76__System__FullscreenMode/Na__UiFeature__Styles__FullscreenMode__.css`: the Tools Menu Toggle Row region, now that
  nothing carries those classes.
- `01__AppAssets__TrueVision/UiIcons__MenuIcons__ToolsMenu/`: 16 files copied from ValeVision.
- `TrueVision__Pwa__ServiceWorker__Logic__.js`: token bumped (2026-09-16-1).

# ---------------------------------------------------------
## TrueVision3D v2.55.0  -  15-Sep-2026
### Layout Editor Sorted Into Numbered Subfolders, the Same as ValeVision

**Overview**
- From Adam (Task 04): the Layout Editor folder gets the structure ValeVision3D's got in its v2.47.0 the same day, so
  a feature ported either way lands at the same path in both apps.
- **Folder 51 is sorted into numbered subfolders.** Its files (90 before the splits below, 131 after) moved out of one
  folder into fourteen, numbered the way `02__Src__AppModules` is: what the editor cannot start without first, then
  its systems, then the panels, the features and the Dev tools, with gaps left between the numbers.

| Folder | Holds |
|---|---|
| `03__Core__Config` | ConfigState and its units, the AppConfig and KeyMappings JSON |
| `05__Core__ModeController` | ModeController, TabStrip |
| `07__Core__SheetData` | SheetModel and its units, SheetRecords, SheetLayout, ScaleManager, DrawingScale, History, AutoSave, Assets |
| `10__Core__SheetSurface` | SheetSurface, SheetChrome, TitleBlock__Classic, TitleBlock__Modern, Navigation, Controls__Pc, Controls__TouchScreen, Styles__Main and its Paper part |
| `15__Core__Markup` | MarkupBridge, DimensionGeometry, LeaderGeometry, ShapeGeometry, Groups, MeasureParse |
| `20__System__Viewports` | Viewport2d and its units, Viewport3d, Viewport3dZoom, ViewportHandles, ViewportClipboard, ViewportSnapMove, ForceRender, RasterQuality, ModelSource, PlanDoors |
| `25__System__RenderStyles` | SnapshotRenderer, Enhance, EdgeStyles, RenderComposites, ModelLayers, and their config JSON |
| `30__System__SheetTools` | SheetTools and its units, SelectionBox, SelectionSet, Grips, Snapping, AxisLock, ContextMenu, ItemClipboard, Eyedropper, Measurements |
| `35__System__DrawingTools` | TextTool, DimensionTool, LeaderTool, ShapeTool, RectangleTool, GradientTool, LineStyleTool, and their config JSON |
| `40__Ui__Panels` | PanelHost, Toolbar, the nine Panel__ modules, Styles__Panels |
| `50__Feature__Specification` | SpecData and SpecEditor and their units, SpecDocument, SpecLinks, SpecMargin, MarginGrip, Panel__MarginNotes, Styles__Specification and its two parts |
| `55__Feature__Scrapbook` | Scrapbook, its config JSON, Panel__Scrapbook |
| `60__Feature__PdfExport` | PdfExporter, PdfFonts |
| `70__DevTools__DevMenu` | DevMenu__Controls |

- ValeVision numbers its Layout Editor loader `01__Core__Loader`. TrueVision has no loader yet, so that folder does not
  exist here; it is where the loader goes if it is back-ported.
- **Nothing is renamed.** Every file keeps its name, namespace and exports. 522 relative paths inside the folder moved
  with the files, and three files outside it: Index.html, the CSS index and `Na__DrawView__RenameDrawing__`.
- **Eight files over 1000 lines are split into units:** ValeVision's units, with the same functions in each, so a unit
  ports file for file. Each original keeps its name and every export and re-exports its units, so no caller changed.

| Original, lines before | Now | Units, lines | TrueVision's own code |
|---|---|---|---|
| `SheetTools` 1.29.0 (2138) | 586 | State 153, ToolState 352, HitResolution 372, ContentEditing 129, PointerPress 420, PointerDrag 568, Keyboard 381, ContextMenu 298 | DoorAt and CarryTarget in HitResolution |
| `SheetModel` 1.25.0 (1801) | 700 | State 197, Sheets 347, Layers 196, DrawOrder 153, Viewports 327, TextAndDimensions 277, Shapes 192, Leaders 168, Groups 228 | Drawing type constants in State; IsSitePlanSheet, TabGroup, NextOrder and RenumberSheets in Sheets; IsSitePlanViewport in Viewports; AnnounceRestore stays in the original |
| `ConfigState` 1.24.0 (1348) | 414 | Readers 143, KeyMap 416, SheetSetup 404, ToolSetup 317, EditorSetup 201 | GetPlanDoorsSetup, GetModelSourceSetup and PdfFontCuts in SheetSetup |
| `SpecData` 1.2.0 (1318) | 290 | State 287, Document 398, Editing 395, Draft 196, Transport 509 | FetchJson and UsesWorker in Transport |
| `SpecEditor` 1.2.0 (1230) | 322 | State 170, Builders 183, Bar 253, Notes 253, Render 256, NoteDrag 210, Actions 358 | none |
| `Viewport2d` 1.10.0 (1141) | 499 | Window 143, Frame 273, Linework 395, SitePlan 319 | The eight site plan functions, in SitePlan: a unit ValeVision does not have |
| `Styles__Specification.css` (1023) | 425 | Notes 352, Read 270 | none |
| `Styles__Main.css` (1116) | 463 | Paper 667 | The tab strip and the Dev section stay in Main |

**HOW**
- **The splits.** Each module's code moved as whole titled blocks, copied by line number from the file as it was. The
  only code lines that changed are writes to shared state from another file, which an imported binding cannot make;
  they became accessor calls with ValeVision's names: SheetTools 17 (one more than ValeVision, for the doors drag,
  through the existing WriteDrag), SheetModel 27, SpecData 48, SpecEditor 29, ConfigState and Viewport2d none.
- **Where TrueVision differs.** SheetModel's original stays at 700 lines, over the 600 aim: its header alone is 322
  lines, and AnnounceRestore needs SheetRecords, which the State unit does not import. Viewport2d's Linework also
  exports BandPaths, for SitePlan. ConfigState's INTEGRATION note said Index.html calls SetAppConfig and Ready; the mode
  controller's Initialize does, and the note now says so.
- **The stylesheets,** region by region, text for text. Main keeps Published Heights, Tab Strip, Host Shell and Stage,
  Measurements Box, Toolbar and Dev Menu Section; Paper takes the paper, frames, selection, snapping, context menu and
  grips regions, as in ValeVision. The Dev section's rules now come before three paper regions, and share no class or
  id with them, so no rule computes differently. The CSS index imports each part straight after the sheet it came
  from.
- **The move.** Plain file moves, not git mv, and nothing is staged: git shows the 90 files that were tracked in the
  folder as deleted and all 131 in the subfolders as untracked. `git add` the folder before committing.

**Also**
- **Index.html asks for `PCFShadowMap`.** It asked for `PCFSoftShadowMap`, which three r184 deprecates: it drew
  `PCFShadowMap` in its place and warned in the console on every load. Shadows are unchanged. Seen in ValeVision's
  console; ValeVision3D v2.47.1 makes the same change.

**Verified**
- Every split: each declaration found exactly once across its files, its text unchanged apart from the accessor writes
  above, and every export kept.
- Lint (no-undef, no-import-assign, no-unused-vars) over the 117 modules: 0 errors and the one warning the folder
  already had; identical before and after the move.
- Named exports pass (319 files). Module graph: 407 modules, 0 failures, the one known vendor issue unchanged.
- Every `new URL` config target, every CSS index import (in the original cascade order) and RenameDrawing's dynamic
  import resolve. The import cycle groups are the two there were before: SheetChrome with the title blocks, and Grips
  with SheetSurface.
- **Not run in a browser.** Adam tests.

**Files**
- `02__Src__AppModules/51__System__LayoutEditor/`: all 131 files in 14 subfolders, 41 of them new (the units above and
  the three stylesheet parts); new log entries in SheetTools 1.29.0, SheetModel 1.25.0, ConfigState 1.24.0, SpecData
  1.2.0, SpecEditor 1.2.0 and Viewport2d 1.10.0.
- Paths: `Index.html` (and the shadow map line), `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css` (and the
  three new imports), `40__System__DrawingViewCore/Na__DrawView__RenameDrawing__.js`.
- Service worker: token `2026-09-15-1`.
- Plans: `TrueVision__PLAN__ValeVisionRealign__DrawingSystems__.md` ledger AN and AO.

# ---------------------------------------------------------
## TrueVision3D v2.54.0  -  14-Sep-2026
### Margin Notes Spread Out When the Column Has Room

**Overview**
- From Adam, with D03 - 3D Images and D02 - Elevations side by side: the space between margin notes gets a least and a
  most. The least is the spacing the notes had; on a sheet with room to spare, like D03, the notes spread out a little,
  with more space above and below each rule. A full column, like D02, stays as it is.
- **What fits is decided first.** Every note is laid out at the least gap, exactly as before, so a note that fitted
  still fits and one that did not still does not.
- **Then the gaps open.** When every note fits and room is left at the foot of the column, each gap opens by the same
  amount, up to the most, and each rule stays centred in its gap.
  - The least is 2.5 mm, which is 1.25 mm clear above and below a rule. The most is 5 mm, which is 2.5 mm each side.
  - With less room than the most needs, the gaps share what there is, so the last note ends on the column's foot
    padding.
  - A column with notes that did not fit keeps the least gap, so it never looks finished while notes are missing.
- The screen and the PDF draw the margin from the same primitives, so both spread alike.

**HOW**
- **`SpecMargin__` 1.3.0.** `Plan` lays the column out at `NoteGapMm` and keeps each note that fits: its runs, and
  the rule above it. It then places them all at once.
  - The extra gap is the smaller of `NoteGapMaxMm - NoteGapMm` and the room at the foot divided by the number of
    gaps. It is 0 when a note overflowed or only one note shows.
  - Note n moves down n x extra; the rule above it moves n x extra - extra / 2, which keeps it centred.
  - The plan carries `noteGapMm`, the gap it laid the notes at. A config without `NoteGapMaxMm` keeps the least.
- **`ConfigState__` 1.22.0:** `GetMarginNotesSetup().noteGapMaxMm` (5).
- Nothing new is written to project data: the spacing is worked out each time the margin is drawn.

**Config**
- MarginNotes `NoteGapMaxMm` (5). `NoteGapMm` (2.5) is now the least. Setting the most to the least turns the
  spreading off.

**Verified**
- In the app on PS01 (localhost:8563, every write refused), the served module against itself with the most pinned to
  the least:
  - D03 - 3D Images: 15 notes, 39.05 mm to spare at 2.5 mm. The gaps open to the full 5 mm, leaving about 4 mm.
  - D02 - Elevations: 20 notes, 4.13 mm to spare. The gaps open to 2.72 mm, 0.22 mm more each, and the last note ends
    on the foot padding.
  - D01 - Floor Plans: 15 notes, 162 mm to spare. The gaps open to 5 mm.
  - On all three: the same notes, text, left edges and rule count as before, and nothing overflowing. The first note
    did not move, every rule is centred in its gap to 0 mm, and the last note moved exactly (notes - 1) x the extra.
- D03 on screen draws its 14 rules at the new positions, 14 of 14.
- Entering the editor on D03 sent six `r2/write` POSTs and the drawing notes' local save, all refused, before anything
  was tested. Nothing tried to write after that.
- Both modules parse and the AppConfig JSON parses.
- **Not checked:** a PDF export.

**Files**
- Layout Editor: `SpecMargin__` 1.3.0, `ConfigState__` 1.22.0, `AppConfig__.json` (MarginNotes `NoteGapMaxMm` and its
  description).
- Service worker: token `2026-09-14-23`.
- Plans: `TrueVision__PLAN__ValeVisionRealign__DrawingSystems__.md` ledger AM.

# ---------------------------------------------------------
## TrueVision3D v2.53.0  -  14-Sep-2026
### Scrapbook - Drag the Mapping Data Credentials and the North Point onto a Site Plan

**Overview**
- From Adam: a Scrapbook on site plan sheets, to drag his Mapping Data Credentials block and north point in from, the
  way SketchUp LayOut's scrapbooks work.
- **The panel.** Scrapbook sits in the left column after Sheet, and shows only on a sheet that has items: today, a Site
  Plan Drawing. Each tile shows its item and its name, and every tile is styled alike.
- **Dragging.** Press a tile and drag.
  - The item follows the pointer at the size it will land at, the sheet's own zoom: faint over the panels, clear over
    the sheet.
  - Let go over the sheet and it lands centred under the pointer, grouped and selected, with the Select tool up, so
    it can be moved straight away.
  - Escape, or letting go anywhere off the sheet, drops nothing.
  - Double-click a tile, or press Enter on it, to place it in the middle of the view instead.
- **Three items:** Mapping Data Credentials and North Point together, as in Adam's image, and each on its own, since
  every plan on a sheet takes a north point.
- **What lands is ordinary sheet content:** three text items and five vectors, in a group of two groups. It moves,
  copies, ungroups, prints and undoes like anything drawn by hand, and one drop is one undo step.
- **The house sizes,** measured from Adam's image and from his A2 Location and Block Plans (BH03 D04, NP03 D09):
  - the north point is 18 mm across;
  - the text is Open Sans at 9 pt semibold, 8 pt and 6 pt, in the image's warm grey.
- **The year keeps itself.** The copyright line takes the current year when the item is dropped. The OS licence
  number is written once, in the Scrapbook config.
- **Not yet.** The north point points up the paper; it is not linked to a viewport's north angle (PS01's is 0).

**HOW**
- **New `Na__LayoutEditor__Scrapbook__.js` (`Na__LeScrap__`)** owns `Na__LayoutEditor__Scrapbook__Config__.json`.
  - Pieces are lists of sheet records (`Annotation__...`, `Shape__...`) in paper millimetres, without ids or layers. A
    `Scrapbook__Circle` is written out as a closed polygon.
  - Items are pieces with offsets and the drawing types they are offered on. Tokens fill `{OsLicenceNumber}` and
    `{Year}`.
  - `BuildSet` turns an item into the item clipboard's set shape. `PreviewSvg` draws it through
    `Na__LeMarkup__BuildSheetPrimitives`, so a tile shows exactly what lands.
- **New `Na__LayoutEditor__Panel__Scrapbook__.js` (`Na__LePanelScrap__`):** the tiles, the pointer drag and its ghost,
  and the section's visibility, which follows every change of sheet or drawing type, folded or not.
- **`ItemClipboard__` 1.1.0:** `Na__LeClip__InsertSet(sheet, set, atMm)` pastes a set that did not come from the
  clipboard. `PasteSet` is now `InsertSet` with the held set, so a paste behaves exactly as before.
- **`ModeController__` 1.14.0** registers the section after Sheet.
- Nothing new is written to project data: a dropped item saves with its sheet like any other text and vectors.

**Verified**
- In the app on PS01 (127.0.0.1:8523, every write refused, none attempted by the Scrapbook), on scratch sheets held in
  memory. Adam's D10 was never touched, and the sheets were restored byte for byte afterwards.
- A drop lands centred on the pointer: 71.33 x 18 mm, text on the text layer, vectors on the vector layer, a group of
  two groups. One undo step; undo and redo round-trip.
- The ghost matches the sheet's zoom to the pixel. Escape and a release off the sheet drop nothing, a single click
  does nothing, and double-click and Enter place in view.
- The section hides on an architectural sheet and comes back on a site plan sheet.
- The three lines' Open Sans widths are within 0.5% of Adam's image (39.7, 41.9 and 41.4 mm).
- An uncompressed PDF of the sheet carries the three lines and the north point's fills.

**Files**
- Layout Editor:
  - new `Scrapbook__` 1.0.0, `Panel__Scrapbook__` 1.0.0 and `Scrapbook__Config__.json`
  - `ItemClipboard__` 1.1.0, `ModeController__` 1.14.0
  - `Styles__Panels__.css` (Scrapbook region)
- Service worker: token `2026-09-14-22`.
- Plans: `TrueVision__PLAN__SitePlanDrawings__.md` 8.6 and Phase 6; `TrueVision__PLAN__ValeVisionRealign__DrawingSystems__.md`
  ledger AL.

# ---------------------------------------------------------
## TrueVision3D v2.52.0  -  14-Sep-2026
### Rotate Text - a Round Grip Turns a Text Box

**Overview**
- From Adam: text boxes in the Layout Editor can be rotated, with rotation handles.
- **The grip.** A selected text item shows a round grip on a short stem off the top of its outline. Over it, the
  pointer becomes a curved arrow.
  - Drag it and the text turns about the middle of its box, so it spins in place.
  - **Shift** holds the angle to 15 degree steps. Without Shift a drag settles on a right angle once within 2 degrees
    of one, so level and plumb text are found by feel.
- **The Text panel** has a Rotation row, in degrees clockwise.
  - With a text item selected, it turns that item about its middle.
  - With nothing selected, it sets the angle new text is placed at.
- **Right-click** a turned text item for **Reset rotation**, which levels it about its middle.
- **Everything follows the turn:**
  - every line of multi-line text, and the leader, which meets the turned box;
  - the dashed selection outline, and the inline editor on a double-click;
  - hit testing: a click lands on the turned box itself, not on the empty corners of the square round it;
  - box select: a crossing has to touch the turned box, and a window has to hold it;
  - copy, paste, duplicate, undo and redo;
  - the PDF.
- **Fix: turned text in the PDF.**
  - jsPDF shifts a centred or right-aligned run along the page, and then turns it about that shifted start. A turned
    centred run printed half its width away from where the screen draws it.
  - The value of a vertical or aligned dimension printed off the same way.
  - Such a run is now placed by its own left end, so both print where the screen draws them. Level text is unchanged.

**HOW**
- **Record key** `Annotation__RotationDeg`: degrees clockwise about the anchor (`PosXMm`, `PosYMm`, the first line's
  baseline at its alignment point).
  - Wrapped into (-180, 180] and kept to a thousandth of a degree.
  - Written only while the text is turned, so level text, and every record from before, draws and saves exactly as
    it did.
- **`MarkupBridge__`** lays a turned item out in its own frame:
  - `AnnotationBox` is the unturned box, and `AnnotationBounds` is the turned box's extent (what groups and the
    eyedropper frame);
  - `AnnotationCorners`, `AnnotationCentre`, `AnnotationToLocal`, `AnnotationFromLocal`, `AnnotationHit` and
    `AnnotationRotateGrip` read the rest;
  - for an unturned item they hand every point straight back.
- **Turning about the middle.** The record turns about its anchor, so `Na__LeText__RotationPatch` moves the anchor to
  keep the middle still. The drag (`RotateStart`, `RotateTo`) is worked from where it began, never from the last move.
- **The grip.** `SheetTools__` `Resolve` looks for the one selected text item's grip before anything else, because the
  grip stands off the text where no hit test would find it.
  - It sits Text `RotateGripOffsetPx` screen pixels off the outline, at any zoom.
  - Its stem is a grip element too, so clearing the grips clears it.
- **The PDF.** In `SheetChrome__` `ToPdf`, a turned centre- or right-aligned run is walked back along its turned
  baseline by the width jsPDF itself aligns by, then drawn left-aligned.

**Config**
- Text `RotateStepDeg` (15), `RotateDetentDeg` (2) and `RotateGripOffsetPx` (22).
- Labels `TextRotation` and `MenuResetTextRotation`; `TextSelectedNote` mentions the grip.

**Files**
- Layout Editor:
  - `MarkupBridge__` 1.12.0, `Grips__` 1.6.0, `TextTool__` 1.3.0, `Panel__Text__` 1.3.0, `SelectionBox__` 1.3.0
  - `SheetTools__` 1.28.0, `SheetModel__` 1.24.0, `ConfigState__` 1.21.0, `SheetChrome__` 1.6.0
  - `AppConfig__.json`; `Styles__Main__.css` (`.na-le-grip--rotate`, `.na-le-grip--stem`)
- Service worker: token `2026-09-14-21`.

**Verification** - PS01 at localhost:8553 with every write refused, on scratch text items on D01 that were then
deleted. One POST was refused, and nothing reached R2: the drawing notes save the editor makes on entry, not part of
this change.
- **The grip** drew where its geometry puts it (within 0.05 px), with the rotate cursor over it.
- **Dragging it:**
  - a drag of 90.86 degrees landed on 90, and the middle moved 0 mm;
  - with Shift, a further 40 degrees gave 135 (105 part way through);
  - 33.3 degrees back gave 101.7.
- **Hit test at 135:** a point inside the square extent but off the turned box found nothing; a point along the text
  found it.
- **Box select at 45:** a crossing in the empty corner of the square extent took nothing; one across the text took it.
- **The panel** turned the text to 45 about its middle. **Reset rotation** was on the menu, removed the key and kept
  the middle. Undo and redo stepped 45, level, 45.
- **The inline editor** opened turned 45 degrees about the anchor.
- **Two-line text at -90:** the second line sits one line height (4.8 mm) along the turned block, and the leader ends
  0.6 mm off the turned box.
- **New text** with the panel at 90 put the top of its first line exactly on the press.
- **PDF:**
  - In the app, the turned run's anchor at 45 degrees landed on the SVG's anchor (0 mm).
  - In Node against the vendored jsPDF 4.1.0, centre and right runs at 0, 90, -90, 30 and -135 degrees all landed
    within 0.0001 mm.
  - Before the fix, a centred run 22.3 mm wide at 90 degrees landed 15.7 mm off.
- **Parsing.** Every touched module parses, the module graph passes, named exports pass (280 files), and the AppConfig
  JSON parses.
- **Not checked:** touch on the grip, and a real printed or exported PDF.

# ---------------------------------------------------------
## TrueVision3D v2.51.0  -  14-Sep-2026
### Project Specification, Read - the Notes as A4 Pages, to Print or Read Aloud

**Overview**
- From Adam: the Project Specification tab has two tabs inside it now. **Edit** is the page of fields it always was.
  **Read** renders the specification as an A4 document: the preview of the PDF it prints as.
- **The pages.** A4 portrait at full size on a grey desk, the way a PDF viewer shows them.
  - Along every page's head, the logo and "Project Specification · PS01 Musters Road"; along its foot, the company
    and "Page 1 of 4".
  - The first page opens with the title: Project Specification and the project's name, then its code, the date and
    what it holds ("29 notes in 9 groups") between two rules.
  - The groups follow in order: prefix and title over a rule (a general group adds "These notes apply to every
    drawing."), then each note - its code in a hanging column, its title beside it, its text beneath.
  - In the drawings' font and ink (Style FontFamily and InkColour).
- **Real pages, nothing cut off.** Each block is measured where it lands, and the one that crosses the foot starts the
  next page.
  - A group's heading stays with its first note, and a note's heading with its first paragraph.
  - A note that does not fit moves to the next page whole, unless it is taller than a third of a page. That one breaks
    where it starts, between words, never leaving a single line alone on either side.
  - Each line typed into a note is its own paragraph; a blank line gives the next one more room.
- **Print.** Print in the bar - or Ctrl+P while the tab is showing - prints exactly these pages, one to a sheet of A4
  with no margins added. Nothing else in the app reaches the paper. Save as PDF in the print dialog makes the PDF.
- **Read aloud.** The pages are real headings and paragraphs, so Edge's Read aloud (right-click, or Ctrl+Shift+U) reads
  the specification, and a selection can be read from anywhere.
  - What repeats on every page - the running head, the company, the page number - prints, but is not read out.
  - While the tab is up, the sheet and panels beneath it are hidden as well as covered, so neither Read aloud nor Find
    reaches them.
- **The bar.** In Read: the sync state, Sync, the page count and Print. The filter, Headings only, Link matching
  bubbles, Add group, Undo and Redo belong to Edit, and Ctrl+Z and Ctrl+Y do nothing in Read.
- **Remembered.** The view is remembered in this browser, and each view keeps its scroll, even across a visit to a
  sheet. Open in specification on a bubble always opens Edit on its note. A read-only session starts in Read.
- **Narrow windows.** The pages shrink to fit a window narrower than A4. They are never enlarged.

**Files**
- Layout Editor: new `SpecDocument__` 1.0.0 (`Na__LeSpecDoc__`: the pages, the page breaks and printing);
  `SpecEditor__` 1.1.0 (the Edit and Read tabs); `Styles__Specification__.css` (Edit and Read, the desk, the document
  and print); `AppConfig__.json` (17 labels: SpecView*, SpecReaderLabel, SpecPages*, SpecPrint*, SpecDoc*).
- Service worker: token `2026-09-14-20`.

# ---------------------------------------------------------
## TrueVision3D v2.50.0  -  14-Sep-2026
### Zoom Inside a 3D Viewport - Frame the Picture, Enter to Keep It

**Overview**
- From Adam: a 3D viewport on a sheet could be moved, cropped and scaled, but never zoomed. Now it can.
- **The wheel.** Double-click a 3D viewport (or Edit viewport content on its right-click menu) and scroll over it:
  the picture zooms about the cursor, and Shift+scroll zooms in fine steps. Dragging still slides the picture.
  Enter finishes (so do Esc and a click elsewhere), and the picture keeps the zoom it was left at.
  - The note over the frame reads the zoom as it changes: "Zoom 150%: scroll to zoom (Shift for fine steps), drag to
    reposition, Enter to finish".
  - A run of notches is one undo step. A key or a click straight after scrolling commits it first, so Ctrl+Z undoes
    the zoom and nothing before it.
  - Off the frame, the wheel still zooms the sheet.
- **The Zoom % box.** On 3D viewports only, in the Viewport panel under Window mm.
  - Type any percentage, to a decimal place; it zooms about the middle of the frame. Reset gives 100 percent, centred.
  - The limits are 25 and 1000 percent.
  - Greyed out while the viewport or its layer is locked, and hidden on 2D and site plan viewports.
- **Zoomed out, the frame fills with scene.** The frame is now rendered as a window onto the scene camera's picture,
  at the frame's own resolution.
  - Zoomed in, it stays sharp at any zoom.
  - Zoomed out or slid, the scene carries on past the camera's framing instead of leaving a picture floating in white.
  - The camera never moves, so the perspective is the scene's own.
- **Copy, paste, then change what it shows.** Ctrl+C and Ctrl+V (or Duplicate) carry the zoom with everything else,
  so a framed view can be pasted and pointed at another design phase (Model Source) or another scene, as a 2D
  viewport can.
- **Also.** Enter now finishes a 2D viewport's content editing too, and Recentre content centres a 3D picture at its zoom.
- **Existing sheets.**
  - A 3D viewport whose picture exactly fills its frame renders and keys exactly as before, so its stored snapshot
    still loads.
  - One whose picture was slid or cropped now renders its frame as a window: its white strips fill with scene, and it
    renders once more, uploading on localhost, under a new key. PS01's D03 "3D Images" viewport is one: its picture
    sits 11.5 mm left and 7.3 mm down.

**HOW**
- `Viewport__ImageZoom` on the viewport record: a multiple of `Viewport__ImageMm`, stored only when it is not 1 and
  clamped to `ImageZoomMin` and `ImageZoomMax`.
- `Na__LayoutEditor__Viewport3dZoom__` (new) holds the wheel handler and the one-step commit, plus:
  - `PatchAbout` zooms about a point: the offset scales by the zoom factor, so the anchor stays put.
  - `PatchReset` and `CentredOffset`.
- `Viewport3d__` 1.6.0: when the picture rectangle differs from the frame, three things change.
  - Render3d gets a view window `{ u0, v0, u1, v1 }`: the frame as fractions of the picture, allowed past 0..1.
  - The pixel size is the frame's, and the window joins the fingerprint.
  - The image element is placed by the window it was rendered for, so a zoom shows at once and the sharp render
    replaces it. `ExportRectMm` tells the PDF where the picture goes.
- `TiledRenderer` 2.1.0: `viewWindow` does three things, and without it every call is unchanged.
  - It sizes the full frame so the window is exactly the output.
  - It sets the full frame's aspect.
  - It offsets every tile's `setViewOffset` into the window.
- `Controls__Pc__` offers the wheel to the zoom module first. In `SheetTools__`, Enter (`Edit__Finish`) ends content
  editing.

**Config**
- Viewport block: `LayoutEditor__Viewport__ImageZoomMin` 0.25, `ImageZoomMax` 10, `ImageZoomFineFactor` 0.2 (a Shift
  notch against a plain one) and `ImageZoomCommitMs` 350, with `ImageZoomNote`.
- Labels: `EditingView3dNote`, `ZoomLabel`, `ZoomTitle`, `ZoomReset` and `ZoomResetTitle`; `EditingViewNote` now
  mentions Enter.
- Key map: the Enter binding's label says it also finishes a viewport's content editing.

**Files**
- New: `Na__LayoutEditor__Viewport3dZoom__.js` 1.0.0.
- Layout Editor:
  - `Viewport3d__` 1.6.0, `SnapshotRenderer__` 1.8.0, `PdfExporter__` 1.3.0
  - `Panel__ViewportSettings__` 1.7.0, `SheetTools__` 1.27.0, `Controls__Pc__` 1.1.0, `ViewportHandles__` 1.4.0
  - `SheetRecords__` 1.19.0, `SheetModel__` 1.23.0, `ConfigState__` 1.20.0
  - `AppConfig__.json`, `KeyMappings__.json`
- Image export: `Na__ImageExport__StaticExport__TiledRenderer.js` 2.1.0.
- Service worker: token `2026-09-14-19`.

**Verification** - PS01 at localhost:8541, every write refused (uploads included), on two temporary 3D viewports on
D03 that were deleted afterwards:
- **Keys.**
  - An untouched viewport keeps its old key.
  - D03's own viewport re-hashes to its stored `18yw6cy` by the old formula, and its new key differs only by the window.
- **Wheel.**
  - Five notches gave exactly e^0.8 (222.6 percent), with the point under the cursor fixed to 1e-16.
  - Nothing was announced during the run, and one change after it.
  - Shift+wheel, sent sideways as Chrome sends it, stepped exactly e^0.032.
  - A key mid-run committed at once, and Enter ended the editing with the zoom kept.
  - The wheel after that zoomed the sheet.
- **Pictures.**
  - A window render matched the same crop of a whole render: mean difference 0.004 (zoom in, centred), 0.008 (off
    centre) and 0.001 (zoom out, centre), against 12.6 to 18.1 for a crop shifted 5 percent.
  - Zoomed out, the bands beyond the picture carry the scene's ground and sky rather than paper white.
- **Panel.**
  - 150 zoomed about the frame's middle (centre fixed to 1e-9); 5000 was held at 1000; one undo stepped back.
  - Reset restored 100 percent, an offset of 0, 0 and the old key.
  - The row greys out when locked and hides on a 2D viewport.
- **Copy and design phase.**
  - Ctrl+C and Ctrl+V pasted "Exterior 02 copy" at the same zoom, in one step.
  - Model Source to Existing Building rendered in 4.2 s. Its picture is nearer a direct Existing Building render
    (8.9) than a Scheme-02 one (12.5).
- **PDF.** A real build of D03 placed all three 3D pictures at their frames (180 x 120 mm).
- **Checks.** Every touched module parses as an ES module. The module graph has 365 modules and 0 failures, named
  exports pass (278 files), and both JSON files parse.

# ---------------------------------------------------------
## TrueVision3D v2.49.1  -  14-Sep-2026
### Site Plan Tabs Look Like Every Other Tab

**Overview**
- **The green mark is gone.** The small green mark before a site plan tab's name has been removed (Adam, 14-Sep-2026).
  Beside tabs without one, it read as more important rather than as a kind of drawing.
- **Unchanged.** Site plan tabs still sit after the + tab, and still say "Site plan drawing" on hover.

**Files**
- Layout Editor: `Styles__Main__.css` (the `.na-le-tabs__tab--siteplan::before` rule is removed) and `TabStrip__` 1.3.1
  (log only; the modifier class stays, unstyled).
- Service worker: token `2026-09-14-18`.

# ---------------------------------------------------------
## TrueVision3D v2.49.0  -  14-Sep-2026
### Site Plan Drawings, Part 2 - Site Plan Viewports at 1:500 and 1:1250

**Overview**
- **Adding one.** On a Site Plan Drawing, the Viewport panel's Add block offers the site plan scales - 1:500 Block
  Plan or 1:1250 Location Plan - and a note of the project's site plan data.
  - Add Site Plan Viewport places the viewport centred on the red line.
  - Every layer whose export does not list that scale starts switched off.
- **What it draws.** A site plan viewport draws the SketchUp site plan export directly: no raster and no
  projection.
  - The lines come from `52__System__SitePlanData` in drawing millimetres, tagged by layer.
  - Each layer paints in its SSOT style: colour, line type, and weight in millimetres. A 0.50 mm red line prints
    0.50 mm at the 0.30 pt sheet master.
  - Model Layers lists the layers under their own groups, with the usual per-viewport colour, type and weight
    overrides.
  - Fills paint under the lines where a layer has a fill colour.
- **Everything else on a 2D viewport works here too:** snapping to site plan vertices, dimensions at the
  viewport's scale, text, leaders, vectors, the caption ("BLOCK PLAN 1:500") and the title block scale.
- **PDF.** The vector PDF prints the same lines, and the fills (outer rings only, for now).
- **Scales.** Site plan scales no longer collapse to 1:50.
  - A site plan viewport has its own scale list (Scales SitePlanScaleDenominators).
  - Captions and the title block quote 1:500 and 1:1250 as they are.
- **Palette.** The edge palette gains red, green and blue (the SSOT's MTE201, MTE202 and MTE205), and the weight
  ceiling rises to 6.00.
- **A fresh export.** Force Render on a site plan viewport re-reads the site plan data, so a new export draws
  without a reload.
- **Fix (store 1.0.1): opening a site plan sheet overflowed the stack.**
  - Cause: the store announced 'loading' before recording its promise, and the Viewport panel's refresh started
    another resolve, without end.
  - Found in Adam's browser minutes after landing.
  - Now the promise is recorded first, and every store announcement goes out on a microtask.

**Files**
- Layout Editor:
  - `Viewport2d__` 1.9.0, `PdfExporter__` 1.2.0, `Panel__ViewportSettings__` 1.6.0
  - `SheetRecords__` 1.16.0, `SheetModel__` 1.21.0, `ScaleManager__` 1.1.0
  - `EdgeStyles__` 1.1.0 and its config
  - `ModelLayers__` 1.3.0, `ModelSource__` 1.1.0, `Panel__ModelLayers__` 1.3.0
  - `ConfigState__` 1.16.0, `AppConfig__.json` (Scales and Labels)
- Site plan data: `Na__SitePlan__Store__.js` 1.0.1.
- Service worker: token `2026-09-14-17`.
- Plan: `TrueVision__PLAN__SitePlanDrawings__.md`, Phase 5.

**Verification** - PS01 at localhost, every write blocked, on scratch site plan sheets that were then deleted:
- **Add panel.** On a site plan sheet the site plan block shows and the scene block is hidden, with the data note
  and both scales.
- **Viewports.** The 1:500 and 1:1250 viewports are named Block Plan and Location Plan and centred on the red
  line.
  - All 784 segments are painted and offered to snapping.
  - Five bands paint at the export's colours and widths: 0.13 mm grey, 0.25 mm soft black, and 0.25, 0.35 and
    0.50 mm red.
- **Layers.** OS Mapping off leaves 420 segments; back on, 784.
- **Scales.** 1:1250 holds, and 1:50 on a site plan viewport coerces to 1:500.
- **Caption and title block.** The caption reads "BLOCK PLAN 1:500" and the title block Scale reads "1:500".
- **PDF, built uncompressed.** It carries the caption and the site plan stroke widths of 0.369, 0.708, 0.993 and
  1.416 pt (0.13 to 0.50 mm).
- **Parsing.** Every touched module parses, and the module graph is unchanged.
- **Not yet:**
  - the Styles panel still shows raster-only rows on a site plan viewport;
  - a face's holes are not cut out in the PDF;
  - there are no per-viewport fill overrides.

# ---------------------------------------------------------
## TrueVision3D v2.48.1  -  14-Sep-2026
### Doors Stay Shut on Elevations and Sections

**Overview**
- From Adam: doors open on 2D plans only, never on elevations. A Layout Editor elevation or section
  viewport now draws every door SHUT - in its linework, its base image and the PDF - whatever the 3D view
  shows. Only a plan draws a door open. 3D viewports still draw the doors as the model holds them.
- Before this release an elevation drew each door wherever the 3D view had last left it, so a door clicked
  open in 3D stood open on every elevation that could see it. On PS01, holding the doors open changed
  1,246 line segments of the South Elevation.
- A second route to an open door is closed too. A plan's base image holds the doors open across the paints
  its tiles yield to, and a linework read runs on its own queue, so it could land in one of those gaps:
  - an elevation read there saw the plan's doors open, and cached them under the elevation's own key;
  - a plan read there put the doors back to the 3D view's pose, so the rest of that picture drew them shut.
- An elevation's doors are not there to be clicked: a click, the right-click menu and the hit test answer
  nothing. The Viewport panel's Doors row stays on plans.

**HOW**
- Viewport2d `Describe` passes an elevation or section the shut pose, `Na__LeDoors__ShutPoseFor`:
  `DoorPose { Shut : true }`, through a new fourth argument to `Na__PlView__FromElevation`, like `FromPlan`.
- The pose is folded into the record hash and the collection key, as a plan's is. Every Layout Editor
  elevation viewport projects once more on each device, and never paints linework read while a door stood
  open. A plan's pose, and every drawing outside the Layout Editor, hash exactly as before.
- `Na__PlDoors__IsClosed` answers true for every panel under the shut pose; `SwingEdges` traces nothing and
  `HitTest` answers null. `Na__LeDoors__At` answers only on a plan.
- `Na__PlDoors__PutBack`: `Apply` notes where each moving panel stood, and the projector's read puts the
  panels back exactly there instead of restoring the 3D view's pose. A read that lands inside an underlay
  render leaves that render's pose standing; the render still restores by the door's own progress when it
  finishes.

**Config**
- `LayoutEditor__PlanDoors__ShutOnElevations` (true). Off, elevations and sections draw the doors as the
  model holds them, keyed exactly as before this release. The block's description covers both rules.

**Files**
- Projected linework: `DoorPose__` 1.1.0 (`PutBack`, the shut pose), `ViewDefinition__` 1.2.0,
  `Projector__` 1.4.0.
- Layout Editor: `PlanDoors__` 1.1.0 (`ShutPoseFor`), `Viewport2d__` 1.8.0, `ConfigState__` 1.15.0,
  `SnapshotRenderer__` 1.7.1 (comments only); `AppConfig__.json`.
- Service worker: token `2026-09-14-15`.

**Verification**
- The seven modules parse as ES modules, the AppConfig JSON parses, line endings are unchanged, and all 218
  named imports of the changed modules resolve.
- In the app on PS01 (localhost:8531), every non-read request refused and none attempted, on D01's two plans
  and D02's six elevation viewports (three on the existing building phase, three on the live model):
  - Every elevation carries `{ Shut : true }` and a new record hash. Both plans keep byte-identical pose
    JSON and record hashes.
  - On each elevation, 121 points across the frame, at a tolerance wider than the drawing, found no door
    and no menu rows. The hit test answers null, and the same definition with an open pose finds a door.
  - Linework, with every door held open in the 3D view: the shut pose matched the doors-at-rest projection
    segment for segment on all six. The old unposed definition did not on three - South 1,246 unmatched
    segments, East 271, East copy 45.
  - Base images, with the doors held open: South Elevation and East Elevation copy rendered byte-identical
    to their at-rest pictures; the old definition differed by 8,918 and 3,481 pixels.
  - The race, forced: an elevation read ran inside a plan underlay render, just after the render stood the
    doors open. The read kept all 6 leaf meshes of the exterior double door shut, the render's doors were
    still open after it, and the plan picture was byte-identical to an undisturbed render.
  - PutBack returns panels exactly; Restore, and the shut pose from rest, land exactly on the rest pose.
  - The Existing Floor Plan projection still draws its 72 swing segments.
  - Afterwards all 6 doors stood exactly where they started, progress unchanged. No sheet was edited.

**ValeVision**
- Not yet ported: rides with the pending plan doors port (ledger AA), on Adam's sign-off.

# ---------------------------------------------------------
## TrueVision3D v2.48.0  -  14-Sep-2026
### Site Plan Drawings, Part 1 - Drawing Type, Tab Order and the Site Plan Store

**Overview**
- **Drawing Type row.** The Sheet panel now opens with a Drawing Type row: Architectural Drawing or Site Plan
  Drawing.
  - A site plan sheet's tab moves into its own group after the + tab, so the strip reads
    3D Model | architectural sheets | + | site plan sheets | Project Specification.
  - Changing the type is one undo step, and never converts or deletes a viewport.
  - A site plan tab carries a small green mark, and a drag reorders only within its own group.
- **Existing sheets unchanged.** `Sheet__DrawingType` is stored only as 'siteplan', so no existing sheet
  changes.
- **Fix: deleting a sheet undid tab drags.** Delete renumbered the other sheets by their position in the
  saved array, which undid any tab dragged since the project loaded. Sheets are now numbered down the tab
  order.
- **New folder `52__System__SitePlanData`**, holding the site plan store and a GLB parser.
  - The store finds the project's site plan data: the GLB Builder's Site Plan Export, one linework GLB
    per tag 71-75, in `30__TrueVision__AppContent/SitePlan__DrawingData`.
  - It loads each layer on demand, as 2D segments and fill rings in drawing millimetres.
  - On localhost it reads the repository copy first, so a fresh export draws without a build or a sync.
  - The web build reads `SitePlan__DataStore` from the project data, then the manifest on the CDN.
  - GLB URLs carry the export time as `?v=`, so a re-export is never served stale.
- **Nothing draws site plans yet.** The site plan viewport is part 2.

**Files**
- Layout Editor: `SheetRecords__` 1.15.0, `SheetModel__` 1.20.0, `TabStrip__` 1.3.0,
  `Panel__Sheet__` 1.2.0, `Styles__Main__.css` and `AppConfig__.json` (four labels).
- New: `52__System__SitePlanData/Na__SitePlan__Store__.js` 1.0.0 and `Na__SitePlan__GlbParse__.js` 1.0.0.
- Service worker: token `2026-09-14-14`.
- Plan: `TrueVision__PLAN__SitePlanDrawings__.md`, Phase 4.

**Verification**
- **Node harness on the parser, against the real PS01 export: 37 checks.**
  - Every layer's segment count, ring count and bounds match the manifest.
  - The (X, +Z) mapping is not mirrored.
  - Damaged files are refused.
- **In the app on PS01 at localhost, with every non-GET request blocked:**
  - The three existing sheets load with the same orders and no new key.
  - Drawing Type round trip, with undo and redo.
  - Tab order is right after +, after drags inside and across the groups, after a delete and after a
    type change.
  - A delete after a drag keeps the drag.
  - The store loaded all five layers from the local manifest, with `?v=` URLs.
  - The guard blocked the auto saves to R2, and the test draft was cleared from the browser.
- Syntax checks of every touched module pass.

# ---------------------------------------------------------
## TrueVision3D v2.47.0  -  14-Sep-2026
### Type a Length While Dragging a Viewport

**Overview**
- While a viewport's frame is being dragged (the move cursor, not a crop
  handle and not a pan of the drawing inside), the Measurements box wakes and
  reads the drag's length. Type a value and press Enter: the frame moves that
  far along the inferred direction. A minus sign runs the other way. The
  landing is exact - no snap - and the drag finishes so the still-down pointer
  cannot pull the frame back to the cursor. One undo step.
- The length is a real size at the viewport's scale, or the sheet's scale for
  a 3D viewport, so 1000 or 1m at 1:50 is 20 mm on the paper.

**Files**
- Layout Editor: `SheetTools__` 1.24.0 (`GetViewportDrag`, `TypeViewportLength`),
  `Measurements__` 1.2.0; `AppConfig__.json` and `KeyMappings__.json`.
- Service worker: token `2026-09-14-13`.

**Verification**
- Named exports pass (73 Layout Editor files). Module graph 361, 0 failures.
  AppConfig and KeyMappings JSON parse. Not exercised in the running app in
  this session.

# ---------------------------------------------------------
## TrueVision3D v2.46.0  -  14-Sep-2026
### Type a Length While Dragging a Vertex

**Overview**
- While a vertex of a finished vector is being dragged, the Measurements box
  wakes and reads the drag's length. Type a value and press Enter: the vertex
  moves that far along the inferred direction (from where it started toward
  where it is being dragged). A minus sign runs the other way. The landing is
  exact - no snap - and the drag finishes so the still-down pointer cannot
  pull the vertex back to the cursor. One undo step.
- Draw at scale applies the same way it does while drawing: the length is a
  real size at the drawing under the vertex, or paper millimetres when the
  tick is off.

**Files**
- Layout Editor: `SheetTools__` 1.21.0 (`GetVertexDrag`, `TypeVertexLength`),
  `Measurements__` 1.1.0; `AppConfig__.json` and `KeyMappings__.json`
  (vertex-drag wording).
- Service worker: token `2026-09-14-12`.

**Verification**
- Named exports pass on the Layout Editor folder. Module graph and AppConfig
  JSON parse. Not exercised in the running app in this session.

# ---------------------------------------------------------
## TrueVision3D v2.45.0  -  14-Sep-2026
### Vector Moves Snap to the Linework; Shift-Click Inserts a Vertex

**Overview**
- Dragging a finished vector now snaps to the same linework endpoints and
  midpoints dimensions use. The grab point (the nearest vertex or a point on
  an edge) and every vertex are offered; the nearest snap wins, and the whole
  shape translates so that point lands on it. Vertex grips already snapped;
  moving the body did not.
- Hold Shift over an edge of the selected vector: a diamond marks where a
  click will insert a vertex. The insert snaps to the linework when one is
  near. Drag the new vertex in the same press; one undo step either way.
  Shift-click on a vertex or the fill still toggles the selection.

**Files**
- Layout Editor: `SheetTools__` 1.20.0, `ShapeGeometry__` 1.4.0
  (`ClosestOnEdge`, `InsertPoint`), `Grips__` 1.5.0 (`ShowInsert`),
  `Styles__Main__.css` (insert diamond); `AppConfig__.json` (snapping
  description, selected-shape note).
- Service worker: token `2026-09-14-11`.

**Verification**
- Named exports pass on the Layout Editor folder (71 files). Module graph: 359
  reachable modules, 0 failures (the one known vendor issue unchanged).
- AppConfig JSON parses. Not exercised in the running app in this session.

# ---------------------------------------------------------
## TrueVision3D v2.44.0  -  14-Sep-2026
### Vector Undo, Redo, Copy, Paste and Duplicate

**Overview**
- Vectors now use the same clipboard and history chords as viewports. Select a
  vector: Ctrl+C copies it, Ctrl+V pastes it, Ctrl+D duplicates it. The
  right-click menu on a vector offers Copy vector, Duplicate vector and Paste;
  bare paper pastes a held vector with its bounding-box top-left at the click.
- A paste is the whole record with a fresh id (`Na__LeModel__InsertShape`):
  vertices, closed, edges, fill, gradient and opacities. On the same sheet it
  steps `PasteOffsetMm` down and right of the original, and again past any
  copy already sitting in the run; on another sheet it lands in the same place.
  One paste is one undo step.
- While the Draw tool is placing points, Ctrl+Z takes the last vertex off (the
  first vertex abandons the draft) and Ctrl+Y puts a taken-off vertex back. A
  new click or a typed length clears that redo stack. Those keys no longer step
  the last finished sheet edit mid-draw. An in-progress rectangle (not yet a
  record) is abandoned by Ctrl+Z the way Escape already did.
- Number fields (Edge pt, Size mm) hand Ctrl+Z / Y / C / V / D to the sheet,
  the way a select or a checkbox already did, instead of swallowing them once
  the value has been applied.

**Files**
- Layout Editor: `ViewportClipboard__` 1.1.0, `SheetModel__` 1.16.0
  (`GetShapeById`, `InsertShape`), `ShapeTool__` 1.5.0 (`UndoVertex`,
  `RedoVertex`), `SheetTools__` 1.18.0; `AppConfig__.json` (clipboard
  description, Copy / Paste / Duplicate vector labels, Draw-tool note).
- Service worker: token `2026-09-14-10`.

**Verification**
- Named exports pass on the Layout Editor folder (71 files). Module graph: 359
  reachable modules, 0 failures (the one known vendor issue unchanged).
- AppConfig JSON parses. Not exercised in the running app in this session.

# ---------------------------------------------------------
## TrueVision3D v2.43.0  -  14-Sep-2026
### Dimension End Size - Resize Ticks, Arrows and Dots Per Dimension

**Overview**
- The Dimensions panel, under Ends, has a Size mm field: how large the ticks, arrows
  or dots at each end are, in paper millimetres. With a dimension selected it edits
  that one; with nothing selected it sets what the Dimension tool places next.
- The record keeps it as `Dimension__TickLengthMm`. A record from before it has no
  key and draws at the config `TickLengthMm` (1.5 mm), so every existing dimension
  is unchanged until Size mm is used. New dimensions take the panel setting. The
  eyedropper and Shift+B copy it.
- Bounds: `MinTickLengthMm` 0.5, `MaxTickLengthMm` 12. The geometry already sizes
  ticks, arrows and dots from one length, so the field covers all three Ends styles.

**THE RECORD**
- `Dimension__TickLengthMm`: a number above zero, clamped to the config min and max.
  Stored only when set; the normaliser removes anything else and never adds the key.

**Config**
- `LayoutEditor__Dimensions__MinTickLengthMm`, `MaxTickLengthMm`. Labels: `DimEndSize`,
  `DimEndSizeTitle`.

**Files**
- Layout Editor: `Panel__Dimensions__` 1.4.0, `SheetModel__` 1.15.0, `SheetRecords__` 1.11.0,
  `ConfigState__` 1.11.0, `SheetTools__` 1.17.0, `DimensionTool__` 1.5.0,
  `MarkupBridge__` 1.9.0 (`DimensionTickMm`), `Eyedropper__` 1.5.0, `SelectionBox__` 1.1.0;
  `AppConfig__.json`.
- Service worker: token `2026-09-14-9`.

**Verification**
- Named exports pass on the Layout Editor folder (71 files). Module graph: 359
  reachable modules, 0 failures (the one known vendor issue unchanged).
- AppConfig JSON parses. Not exercised in the running app in this session.

# ---------------------------------------------------------
## TrueVision3D v2.42.0  -  14-Sep-2026
### Doors Stand Open on Plans - Click One to Close It

**Overview**
- A Layout Editor plan viewport draws every door OPEN, whatever the 3D view shows: in its
  projected linework, in its base image and in the PDF. Each door opens exactly as a click in
  the 3D view opens it - the same ADR / MOD / ROT naming contract and the same panel transform -
  so hinged leaves swing, bifolds fold, sliders slide, and mirrored and inverted doors land
  the right way round.
- Each open hinged leaf gets its swing: the arc its far edge sweeps from shut to open, at the
  leaf's floor level, drawn with the Doors layer's line style. Bifolds and sliders draw none.
- With the plan viewport selected, a click on a door closes it and another click opens it
  again. The cursor turns to a pointer over a door. A press that moves still moves the
  viewport, and each click waits out the double click window, so double-clicking into the
  content leaves the door alone. The right-click menu leads with Close door or Open door for
  the door under the click, and Open all doors while any is shut; the Viewport panel's Doors
  row says how many are shut and has Open all. Every change is one undo step: a content edit,
  kept by the browser draft and by Save Sheets, never an auto save.
- A lock holds a viewport's frame, not what it draws: the doors of a locked plan still close
  and open, by click, menu or panel, as its layers and styles still change. On a locked plan a
  press on a door is a door press - the click toggles, a drag does nothing - instead of the
  start of a selection box.
- The model's doors are never left moved. They are stood open for the one synchronous model
  read a projection makes, and for the length of one base-image render, and put straight back
  where the 3D view holds them - by the door's own progress, so a door open in the 3D view
  stays open there.
- Elevations, sections, 3D viewports and the drawing views outside the Layout Editor draw the
  doors as the model holds them, with exactly the keys and cached linework they had.

**THE RECORD**
- `Viewport__ClosedDoors`: the door keys a plan viewport draws shut - the ADR name, or
  `ADR::MOD` for one leaf of an exterior double door, whose leaves open one at a time. Stored
  only when it lists a door, sorted and without repeats, so every existing record is
  byte-identical after a load. `UpdateViewport` takes the `closedDoors` patch key.

**HOW IT KEYS**
- The pose rides on the view definition as `DoorPose { Closed, Swings, SwingStepDegrees }` and
  is folded into its record hash, so the linework cache, the browser store, the base image
  key and the PDF all follow it. A definition without a pose hashes exactly as before.
- The projection's collection key carries the pose too. The first view of each plan viewport
  after this release projects once on the device (its doors are a new drawing); a reload then
  paints from the browser store as before.

**Config**
- `LayoutEditor__PlanDoors__Config`: `OpenOnPlans`, `DrawSwings`, `SwingStepDegrees` (5),
  `ClickToToggle`, `ClickDelayMs` (300). Labels: `MenuCloseDoor`, `MenuOpenDoor`,
  `MenuOpenAllDoors`, `DoorsLabel`, `DoorsOpenAll`, `DoorsAllOpen`, `DoorsSomeClosed`.

**Files**
- New: `50__System__ProjectedLinework/Na__ProjectedLinework__DoorPose__.js` 1.0.0 (`Na__PlDoors__`):
  pose, restore, swing tracing, swing placement and the hit test.
- New: `51__System__LayoutEditor/Na__LayoutEditor__PlanDoors__.js` 1.0.0 (`Na__LeDoors__`): the
  pose a viewport draws with, the door under a click, toggling, Open all and the menu rows.
- Door animation `3dObjectIInteraction__Animation__ClickToOpenDoors__.js` 1.9.0 (README too):
  `DescribeDoors`, `ComputePanelLocalPose`, exported `ApplyPanelTransform`, `GetLiveProgress`,
  the MOD type constants; `ScanForDoors` scans through `ScanGroupsInto`, unchanged in behaviour.
- Projected linework: `ViewDefinition__` 1.1.0, `StageSampler__` 1.1.0 (posed panels keep copied
  matrices), `Projector__` 1.3.0 (pose, read and restore around Collect), `Pipeline__` 1.4.0
  (collection key, swings).
- Layout Editor: `SnapshotRenderer__` 1.7.0, `Viewport2d__` 1.7.0, `SheetTools__` 1.16.0,
  `SheetModel__` 1.14.0, `SheetRecords__` 1.10.0, `ConfigState__` 1.10.0,
  `Panel__ViewportSettings__` 1.5.0; `AppConfig__.json`.
- Service worker: token `2026-09-14-8`.

**Verification**
- Every changed module parses as an ES module; named exports (271 files) and the module graph pass.
- Node, on a built model of five doors (a single hinged door, an exterior double door, a sliding
  door, an upstairs door and a mirrored door), 36 checks:
  - every swing arc ends exactly on the posed leaf's far corner, the mirrored door included;
  - the sampler keeps copies of posed matrices, which stay open after the doors are put back;
  - the upstairs door's swing is dropped by the ground floor cut;
  - owner tags still match the visible class;
  - the hit test finds a leaf, its swing and its doorway, and a double door leaf by its own key;
  - a door opened in the 3D view is posed shut for a plan and comes back open.
- In the app on PS01 (localhost:8511, every non-read request blocked and none attempted):
  - The 3 doors (2 hinged, 1 sliding) come back as the registry's own records. Posing and
    restoring them left every panel exactly where it was. Swing radii are 766 and 826 mm, at
    floor level.
  - D01 - Floor Plans: both plan viewports carry the open pose and a record hash of their own.
    The Existing Floor Plan's projection gains its 18 swing segments per hinged door (visible
    1120 to 1169), with the leaf drawn open.
  - On that viewport, which is locked:
    - the cursor is a pointer over the door;
    - a click shuts it after the double click window (key recorded, panel note "1 closed");
    - a drag on the door, and a double click, change nothing;
    - from the doorway the menu offers Open door and Open all doors, and a click reopens it;
    - two undo steps go back through reopen and shut.
  - The 3D view's door panels were unchanged throughout, and the browser draft was cleared.

**ValeVision**
- Not yet ported: waits for Adam's sign-off.

# ---------------------------------------------------------
## TrueVision3D v2.41.0  -  14-Sep-2026
### Fixed Length Extension Lines - Dimensions Stand Clear of the Drawing

**Overview**
- From Adam's report on PS01's D01 - Floor Plans: a run of 800 / 890 / 3,740 mm dimensions set below
  the plan dragged its extension lines all the way back to the vertices they measure - long red lines
  across the drawing, where a drawing office wants short ones that stop just past the run.
- A dimension's extension lines can now stop short. The Dimensions panel has an Ext. lines row under
  Offset mm: a Start and an End length in paper millimetres, measured from the dimension line back
  towards the point, with a padlock between them.
  - Padlock shut (the default): typing either length sets both.
  - Open: each keeps its own. Shutting it again gives End the Start length.
  - Empty is the full line, exactly as before. Zero leaves only the overshoot past the dimension line.
- The measured points never move. A shortened dimension still measures from them, its square grips
  still sit on them and they are still snap points; the part of a line that is not drawn is simply not
  there to click or to print.
- The length runs back from the dimension line, so a run whose points sit at different depths ends all
  its extension lines on one level line.
- While a shortened dimension is selected, a thin dashed line in the selection blue shows the part not
  drawn, down to the point it measures. The PDF never has it.
- The eyedropper carries both lengths and the padlock: pick the dimension that looks right and click
  the rest of the run (B), or Shift+B it so new dimensions start with the same lengths.

**RECORD**
- `Dimension__StartExtensionMm`, `Dimension__EndExtensionMm`: a length of zero or more, present only
  while that line is cut short.
- `Dimension__ExtensionsLinked`: present only as `false`, while the padlock is open.
- The normaliser removes any other value and never adds a key. Every record written before this release,
  and every browser draft of one, stays byte-identical and draws its full lines - a filled-in key would
  have made each old draft differ from its loaded sheets and restore itself, toast and all, on every load.
- Model patch and settings keys: `startExtensionMm`, `endExtensionMm` (null for the full line) and
  `extensionsLinked`. `LayoutEditor__Dimensions__DefaultExtensionMm` (null) is what new dimensions start with.

**HOW**
- `DimensionGeometry__` 1.2.0: `Skeleton` takes an optional `{ startMm, endMm }`. Each extension line
  starts `max(gap, reach - length)` from its point, reach being the point's distance to the dimension
  line, so a length longer than the line changes nothing. `G1` and `G2` are where the full lines start.
  `Push` passes `spec.extension`; scene dimensions never pass one.
- `MarkupBridge__` 1.8.0: the sheet skeleton reads the record (`DimensionExtension`), so the drawing, the
  hit test and the selection box all follow the shortened lines; the dashed ghost of a selected one.
- `Eyedropper__` 1.4.0: three dimension traits, and a new trait flag, `absent` - the value a record means
  by leaving its field out - so a source with full lines still paints a shortened target back to full.
- `PanelHost__` 1.2.0: `LinkedPairRow` and `ShowLink`, two values with a padlock between them, for any
  panel. `Styles__Panels__.css`: the Linked Pair region.

**Files**
- Layout Editor: `DimensionGeometry__` 1.2.0, `MarkupBridge__` 1.8.0, `Eyedropper__` 1.4.0, `PanelHost__`
  1.2.0, `Panel__Dimensions__` 1.3.0, `SheetModel__` 1.13.0, `SheetRecords__` 1.9.0, `ConfigState__` 1.9.0,
  `SheetTools__` 1.15.0, `DimensionTool__` 1.4.0, `Styles__Panels__.css`; `AppConfig__.json`:
  `DefaultExtensionMm` and `ExtensionNote` in the Dimensions block.
- Service worker: token `2026-09-14-7`.
- Built in the same files as v2.40.0's Measurements box and a plan doors session, at the same time:
  footprints swapped by message first, each shared file landed as one anchored all-or-nothing patch after
  the other session's done.

**Verification**
- Node harness on the real modules, 333,633 checks, none failed:
  - Without a length, about 18,000 skeletons in every orientation, and every primitive `Push` emits, are
    bit-identical to the module before the change (rebuilt by reversing the patch).
  - With random lengths each line starts exactly that far back from the dimension line, stays on its own
    extension line, is never lengthened and never cut into the gap; worked examples include an ortho
    dimension with a point either side of its line.
  - The eyedropper reads, paints and palettes the three traits; every other trait of every kind reads as before.
- Every changed module parses; the module graph and named exports (271 files) pass.
- In the app on PS01's D01 - Floor Plans (localhost:8517), every non-read request refused and none
  attempted, on Adam's own run of dimensions:
  - Start 20 with the padlock shut set both. The 800 mm dimension's points are 70 mm apart in depth, and
    both its lines now start 20 mm above the dimension line, at the same height.
  - The hidden part of a line hit-tested as nothing, the visible part as the dimension; a snap beside the
    measured point landed exactly on it.
  - Two dashed ghosts while selected; none in the primitives the PDF draws.
  - The eyedropper painted 20 mm onto the 890 and 3,740 mm dimensions, whose lines then started on the
    same level.
  - Padlock open stored `false`; End 35 and then Start 12 changed separately; shutting it gave End 12 and
    removed the key; undo and redo stepped through one change at a time.
  - Clearing Start returned the full lines with no keys left; -4 was taken as 0.
  - With nothing selected the row set new dimensions' lengths. Shift+B on a 20 / 30 unlocked dimension put
    those into the settings and switched to the Dimension tool, and a dimension placed with it carried
    20 / 30 unlocked from its second click.
  - The test changes were undone by restoring the loaded sheets, and the browser draft was cleared.
- Not exercised: a full PDF export (its primitives were checked), a selection box over a shortened line,
  touch input.

**ValeVision**
- Not yet ported: waits for Adam's sign-off.

# ---------------------------------------------------------
## TrueVision3D v2.40.0  -  14-Sep-2026
### The Measurements Box and Drawing at Scale - Type the Size, Draw It True

**Overview**
- The Layout Editor has SketchUp's VCB: a Measurements box at the bottom right of the sheet, just
  inside the stage's scrollbars. While the Draw (L), Rectangle (R) or Dimension (D) tool is up it
  reads out what is being drawn - a line's length, a rectangle's width x height, a dimension's span
  and then its line's offset - with the scale on a chip beside it. With any other tool it rests,
  greyed.
- Type a value while drawing - no click into the box - and Enter uses it:
  - Draw: the next point goes exactly that far along the rubber band. The band's direction is used,
    so a snap, Shift or an arrow key axis lock aims it first. A typed point that lands on the first
    one closes the polygon.
  - Rectangle: `3000 x 2000` (or `3000,2000`) lands the opposite corner, towards the side the cursor
    is on. One figure is a square; `3000,` or `,2000` keeps the cursor's other side. Typed straight
    after a rectangle lands, it resizes that rectangle, as in SketchUp.
  - Dimension: after the first click a length picks the end; while the line follows the cursor a
    distance puts the line that far off, on the cursor's side, and finishes.
- A number with no unit is millimetres. `m`, `cm` and `mm` work in either case (`2.5M`), commas
  group thousands (`2,000`, `3,555`) and a minus sign draws the other way. The line above the box
  shows how a value is being read as it is typed (`= 2,500 mm`), and why it cannot be used.
- Escape or Delete drops a typed value and Backspace takes a character back, each only while
  something is typed, so Enter still finishes a shape and Escape still backs out. Letters stay tool
  keys until a value is begun, and a click on the sheet drops a half-typed value. Clicking the box
  types into it directly, which is also how a touch screen reaches it.

**AT SCALE**
- Two new switches, both on by default, each the first control of its panel:
  - Vectors panel, Draw at scale (1:50): the Draw and Rectangle tools take typed sizes as real sizes
    at the drawing's scale - 2500 at 1:50 draws 50 mm of paper. Off, they are paper millimetres and
    the chip says Paper. A setting of the drawing tools, never of a shape.
  - Dimensions panel, Measure at scale (1:50): the dimension reads the drawing's real size. With a
    dimension selected it switches that dimension; with nothing selected, the ones placed next.
- Which scale (`Na__LayoutEditor__DrawingScale__.js`): on a 2D viewport, that viewport's - the one
  the Dimension tool attaches a dimension to; anywhere else, the sheet's: the scale its 2D viewports
  share, the biggest drawing's when they differ, the Scales default (1:50) when it has none. A
  vector drawn at scale over bare paper and a dimension measuring it therefore agree, where a
  dimension off every viewport used to read paper millimetres.
- The record: `Dimension__AtScale`, stored only as true or false. A dimension from before it has no
  key and reads exactly as it did - its viewport's scale on a 2D viewport, the paper elsewhere - so
  every existing record and browser draft is byte-identical after a load.

**Files**
- New in the Layout Editor: `Na__LayoutEditor__Measurements__.js` 1.0.0 (`Na__LeMeasure__`),
  `Na__LayoutEditor__MeasureParse__.js` 1.0.0 (`Na__LeMParse__`, pure) and
  `Na__LayoutEditor__DrawingScale__.js` 1.0.0 (`Na__LeDrawScale__`).
- `ShapeTool__` 1.4.0 (Measure, TypeLength), `RectangleTool__` 1.1.0 (Measure, TypeSize and the
  retype), `DimensionTool__` 1.3.0 (Measure, TypeSpan, TypeOffset; atScale on new dimensions),
  `SheetTools__` 1.14.0 (attach, refreshes, Rerun, the atScale defaults), `MarkupBridge__` 1.7.0
  (DimensionValueMm through DrawingScale), `Panel__Shapes__` 1.6.0, `Panel__Dimensions__` 1.2.0,
  `SheetModel__` 1.12.0, `SheetRecords__` 1.8.0, `ConfigState__` 1.8.0 (GetMeasureSetup,
  GetMeasureKeys, defaultAtScale) and `ModeController__` 1.11.0 (mounts the box).
- `AppConfig__.json`: `Dimensions__DefaultAtScale`, `Shapes__DefaultAtScale` and `AtScaleNote`, a
  `Measurements` block (precision, units, pair separator, message time, scrollbar gap) and the
  Measure and at-scale labels. `KeyMappings__.json`: a `MeasurementsBox` block (the characters that
  start and continue a value; the commit, clear and erase keys). `Styles__Main__.css`: the box.
- Service worker: token `2026-09-14-6`.

**Verification**
- Parser: 77 Node checks - units, thousands commas, pairs, squares, one-sided pairs, refusals and
  the reading format. The changed modules parse as ES modules; the module graph (356 modules) and
  named exports (269 files) pass; both JSON files parse.
- In the app on PS01's D01 - Floor Plans (A2, two 1:50 viewports) on localhost:8503, every non-read
  request refused and none attempted, driven by pointer and key events:
  - Draw: 30 mm of band read 1,500 mm; `2500` Enter put the vertex 50 mm along; an ArrowDown lock
    and `1.2m` put the next one 24 mm straight down; `2,5` was refused with its message and kept;
    Escape dropped the value and kept the line; Enter with nothing typed finished it.
  - Rectangle: `3000,2000` landed 60 x 40 mm; `4000x1000` straight after resized it to 80 x 20 mm,
    and Ctrl+Z and Ctrl+Y stepped the resize on its own.
  - Dimension on bare paper: `2500` picked an end 50 mm away and `500` put the line 10 mm off on the
    cursor's side; it read 2,500 mm at the sheet's scale. Measure at scale off: 50 mm, the paper;
    on again: 2,500 mm. Over the Proposed Floor Plan, `1800` then `300` gave a 36 mm span and a
    6 mm offset, attached to that viewport, reading 1,800.
  - Draw at scale off: the chip read Paper and `25` drew 25 mm.
  - Keys: v, r and m with nothing typed stayed tool keys; `12` then l switched tool and dropped the
    value; Delete with a value cleared it and left the selection alone; a value typed into the
    focused box drew on Enter.
  - The four dimensions already on the sheet carry no key and read what the old rule gives (52.037
    on paper; 800, 890 and 3,740 at 1:50).
  - The scale rules on a copy of the sheet: one scale gives 50; two scales of equal area tie to the
    finer and the bigger drawing wins; a point inside a 1:100 viewport gives 100; no viewports, 50.
- The test shapes and dimensions were deleted and the browser draft removed.

**ValeVision**
- Not yet ported: waits for Adam's sign-off.

# ---------------------------------------------------------
## TrueVision3D v2.39.0  -  14-Sep-2026
### Save Sheets Says Where the Sheets Went - R2 and a Local Copy

**Overview**
- Pressing Save Sheets in the Layout Editor wrote the drawings to R2 and then said nothing: the
  button's amber attention state cleared, and that was the only sign. The "Sheets saved to R2."
  label had sat in the config since the port with nothing to show it. Nothing was written
  locally either - the repository's `TrueVision__ProjectData__.json` never held a sheet.
- A save that reaches R2 now writes the same blocks into the repository copy as well, through the
  ProjectVision local server that serves the app, and says where they went:
  - "Sheets saved to R2 and locally." - both copies written.
  - "Sheets saved to R2, but the local copy was not written: {cause}." - red; R2 has the save.
  - "Sheets saved to R2." - the web build, which has no local copy.
- The Dev menu's Save Sheets button says the same. The structural auto save stays quiet when it
  works and shows the red message when the local copy fails. A rename writes the local copy too
  and keeps its own confirmation.
- When the project specification syncs with the sheets, one toast carries both messages. The
  specification's toast used to replace whatever was showing within a second.

**THE LOCAL COPY**
- `03__AppUtils/Na__AppUtils__LocalProjectMirror__.js` (new) reads the repository file fresh from
  disk, puts the saved top-level keys over their old values, and POSTs the whole document to the
  local server's existing `/api/projects/<code>?project-folder=&year=` route, which writes it in
  the same 4-space JSON the build sync writes. Every other key keeps what the file has, so model
  groups a build regenerated while the app was open are never put back to the loaded copy.
- The saved blocks are copied before the R2 write, so both copies get the same content even when
  the sheet is edited while the save is in flight.
- Localhost only. A plain `python -m http.server` answers the POST with 501: the save still lands
  on R2 and the toast names the cause. Serve the app with `ProjectVision__LocalServer__Main__.py`
  (localhost:8090) to get the local copy.

**BUILD AND SYNC KEEP THE DRAWINGS**
- `LayoutEditor__DrawingsData` has been a dev-owned key since v2.21.0 (`Na__DevSavedKeys`), but it
  never joined the two ProjectVision lists that are meant to match it.
- `CloudflareR2__ModelSync__Main__.py` uploads the local project data merged with only the
  `DEV_OWNED_PROJECT_DATA_KEYS` it reads from R2. Without the key, syncing a project whose local
  file had no drawings block uploaded a document without one, and R2 lost every sheet, plan and
  elevation until the app next saved. PS01's R2 copy was seen without its drawings block for a
  while on 14-Sep-2026, and its local file had been re-mirrored that afternoon without one.
- `ProjectVision__BuildScript__.py` rebuilds the local file keeping only `TRUEVISION_DEV_OWNED_KEYS`,
  so a build would also have dropped the local copy this release writes.
- Both lists now carry `LayoutEditor__DrawingsData`: R2's copy wins in a sync, and the local file
  keeps its copy through a build.
- Still in none of the three lists: `CrossSection__SceneData`, the section bindings the same save
  writes. Left for its own change.

**Files**
- New: `03__AppUtils/Na__AppUtils__LocalProjectMirror__.js` 1.0.0 (`Na__LocalMirror__`).
- `40__System__DrawingViewCore/Na__DrawView__ProjectData__.js` 1.1.0: Save writes the local copy and
  takes an optional report.
- Layout Editor: `SheetModel__` 1.11.0 (the confirmation), `Toolbar__` 1.10.0 (one toast at the
  end); `AppConfig__.json`: the `SavedLocalMessage` and `SavedLocalFailedMessage` labels.
- ProjectVision: `CloudflareR2__ModelSync__Main__.py`, `ProjectVision__BuildScript__.py`.
- Service worker: token `2026-09-14-5`.

**Verification**
- The changed modules parse as ES modules; the module graph and named exports pass; both Python
  files parse.
- In the app on PS01's D01 - Floor Plans, served by the ProjectVision local server
  (localhost:8095). A test guard answered the R2 write without sending it. The local write was
  real, and PS01's file was restored from a backup afterwards.
  - Save Sheets: the R2 write of `TrueVision__ProjectData__.json`, then `POST /api/projects/PS01`
    200. A green "Sheets saved to R2 and locally." showed 0.36 s after the click and cleared at 3.9 s.
  - The file on disk: every key it held before unchanged except the scenes, which took R2's newer
    copy; `LayoutEditor__DrawingsData` added, with the same SHA-256 as the block in the app; LF,
    4-space indent, trailing newline.
  - Local write refused: a red "Sheets saved to R2, but the local copy was not written: no local
    save server at http://localhost:8095 (503) ...", the same line in the console, and the button
    free again.
- Not exercised in the app: the Dev menu's Save Sheets button, a rename, the auto save, the
  combined toast with a specification sync, and the web build's "Sheets saved to R2."

**ValeVision**
- Not yet ported: waits for Adam's sign-off. ValeVision's save already mirrors to disk through its
  Flask server.

# ---------------------------------------------------------
## TrueVision3D v2.38.1  -  14-Sep-2026
### Base Images Stop Showing Lines Through Faces - The Line Bias Was 75 mm in Plans and Elevations

**Overview**
- Adam found lines showing through the front face of a fascia in an elevation's base image, where
  30 mm setbacks sit behind it. The projected linework layer was already exact; only the raster
  base image drew them.
- The SketchUp lines are fat lines with a depth bias, so that a line wins against the face it lies
  on: `gl_FragDepth -= 0.00015`. That constant was tuned for the perspective 3D view, where the
  logarithmic depth buffer writes log depth. Through an orthographic camera three writes
  `gl_FragCoord.z` instead - linear from near to far - and the drawing cameras run from 10 mm to
  500 m, so the bias was 0.00015 x 500 m = 75 mm. Every line up to 75 mm behind a face drew
  through it in Layout Editor base images and the PDFs made from them; the live plan and
  elevation views use the same cameras and take the same fix.
- An orthographic camera now takes the bias as a distance, `RenderConfig__Linework__OrthoDepthBiasMm`
  (2 mm), turned into depth by the camera's own range. Perspective renders are unchanged.

**HOW**
- The fat line material's `onBeforeCompile` (`Na__ModelLoader__MultiModel.js`) passes
  `abs(projectionMatrix[2][2]) / 2` - exactly `1 / (far - near)` of window depth per scene unit for
  an orthographic projection - from the vertex shader, and subtracts the distance times that when
  `vIsPerspective == 0.0`, the constant otherwise.
- The block sits inside `#ifdef USE_LOGARITHMIC_DEPTH_BUFFER`, so a renderer without log depth
  leaves the depth alone. Both values are written as GLSL float literals; a whole-number config
  value pasted in as-is was a compile error.

**Files**
- `15__ModelLoader/Na__ModelLoader__MultiModel.js` 1.3.0.
- `02__AppData/Na__AppConfig__Main.json`: `RenderConfig__Linework__OrthoDepthBiasMm` 2.
- `TrueVision__Pwa__ServiceWorker__Logic__.js` - token `2026-09-14-4`.

**Verification**
- In the app on PS01 (localhost:8479), every non-read request blocked (none attempted). The North,
  East and South elevations were rendered through `Na__LeSnap__Render2d` (a 24 x 9 m window at
  5 mm a pixel, one sample) with the old shader and the new, and compared pixel by pixel:
  - North 2,788 line pixels gone, East 2,261, South 1,671 - clustered in the fascia and parapet
    bands (2.3 to 2.9 m up) and one full-height strip on the North elevation.
  - Nothing added on North or South. East gained 16 pixels, all on the dark outline of garden
    furniture at ground level (checked by eye).
- Perspective control: the Exterior 01 scene rendered through `Na__LeSnap__Render3d` with the old
  shader and the new - 0 differing pixels (and 0 between two renders with the new one).
- The shipped module after a reload (new service worker token): all 42 fat line materials carry
  the new shader, and the three elevations render byte-identical to the runtime-patched test.
  No shader errors.

**ValeVision**
- Not yet ported: waits for Adam's sign-off.

# ---------------------------------------------------------
## TrueVision3D v2.38.0  -  14-Sep-2026
### Viewport Frames Switch Off - Set Out With Them, Then Title the Drawing Yourself

**Overview**
- Every Layout Editor viewport draws a thin frame round its edge and a boxed caption in its
  bottom-left corner: the view's name and scale. They help while a sheet is set out, and now
  they switch off - a Frame checkbox in the Viewport panel, just above Caption.
- Unticked, the viewport loses its frame and its caption together, on the sheet and in the
  PDF, so the view can be titled by hand with the Text tool. The drawing, its crop and every
  other setting of the viewport are unchanged; while it is selected the selection outline and
  handles still show where it is.
- Caption greys out while the frame is hidden - the caption box hangs off the frame's corner
  and is drawn in its lines - and keeps its own setting for when the frame comes back.
- One undo step. A content edit, like the Caption switch beside it: kept by the browser draft
  and by Save Sheets, never an auto save.

**THE RECORD**
- `Viewport__ShowFrame`, stored only as `false`. The normaliser removes any other value, so a
  viewport from before the switch - and a browser draft of one - is byte-identical after a
  load and draws its frame as it always did. A new viewport starts framed; a pasted or
  duplicated one keeps its source's setting, as it keeps the rest of the record.
- `UpdateViewport` takes the `showFrame` patch key.

**Files**
- Layout Editor: `SheetChrome__` 1.4.0 (`BuildFrame` builds nothing for a hidden frame, and the
  screen and the PDF both draw from that list), `Panel__ViewportSettings__` 1.4.0 (the Frame
  row; Caption greyed while it is off), `SheetModel__` 1.10.0 (the patch key), `SheetRecords__`
  1.7.0 (the normaliser); `AppConfig__.json`: the `ShowFrameLabel`, `ShowFrameTitle` and
  `CaptionNeedsFrame` labels.
- Service worker: token `2026-09-14-3`, shared with v2.37.0 by agreement between the two sessions.

**Verification**
- The four modules parse as ES modules; the module graph and named exports (265 files) pass.
- In the app on PS01's D01 - Floor Plans (localhost:8491), every non-read request blocked and
  none attempted, on the Ground Floor Plan copy viewport:
  - Before: the frame rectangle and the caption "GROUND FLOOR PLAN COPY   1:50" in the sheet's
    SVG, in the chrome primitive list, and in a jsPDF document drawn from that list; no
    `Viewport__ShowFrame` key on the record; the Frame row between Markup and Caption.
  - Frame unticked: the key false; frame and caption gone from all three (the PDF's rectangle
    operators 6 to 4); the other viewport's frame untouched; Caption still ticked, greyed, with
    its tooltip; one undo step.
  - Undo: the key gone, frame and caption back, Caption live again. Redo: hidden again.
  - Ticked again: the key gone, frame and caption back. The browser draft was cleared.

**ValeVision**
- Not yet ported: waits for Adam's sign-off.

# ---------------------------------------------------------
## TrueVision3D v2.37.0  -  14-Sep-2026
### Projected Linework Matches the 3D View - Joins Between Wall Pieces Stop Drawing

**Overview**
- Layout Editor 2D viewports drew lines the live 3D view does not: where two pieces of one
  wall face meet flush - the head-height line across a render wall, a sill line across a
  window pier, the line under a fascia, the join between the old wall and the new.
- The two read different geometry. The live 3D view draws the SketchUp linework GLB, which
  the GLB Builder writes without hidden, soft or smooth edges, over the mesh GLB, which
  carries no edges at all; its profile lines come from the normal buffer, so a flush join
  never shows. The 2D projection finds edges in the mesh itself - creases of 50 degrees or
  more, open boundaries, silhouettes and intersections - so a join SketchUp hid came back as
  the crease or intersection of the two pieces.
- Three rules on the Projection block, each folded into the model fingerprint, so nothing
  cached or baked before is reused:
  - Hide flush joins (on): an edge is cut wherever the faces either side of it are coplanar
    and continuous in the view - one smooth face in the 3D view.
  - Seams occlude (on): an edge running exactly behind the join between two faces in front
    is hidden. The clip kernel skipped a triangle side lying along the edge, so neither face
    was found to cover it and the edge leaked through the join.
  - Linework first (off): strict SketchUp mode. A category that ships linework draws its
    authored lines and its silhouettes only - no mesh creases or boundaries, and no
    intersections between linework categories. Off by default because SketchUp also hides
    outlines a drawing needs: the top edge of the ground box is the elevation's ground line.

**HOW A FLUSH JOIN IS FOUND**
- `Na__ProjectedLinework__FlushJoins__.js` runs on the CPU backend once the edges are in view
  space, before the clip. For each edge it walks the occluder tree along the edge's page
  footprint and depth.
- A triangle takes part when both edge ends lie in its plane and one of its sides lies on the
  edge's line; its third corner says which side of the edge it covers.
- Where the covered stretches on the two sides overlap, the edge is flush there and that
  stretch is cut; what is left keeps its owner tags. An edge with nothing flush passes
  through untouched.

**THE GPU BACKEND**
- No change, on purpose. Every kept render has used the CPU backend since 2.27.0; WebGPU and
  legacy run only for the Dev menu's Run Diff, which names its backend. `BuildOptions` turns
  all three rules off for a named backend, so Run Diff still compares like with like and the
  vendored GPU generator is untouched.

**Files**
- New in `50__System__ProjectedLinework`: `Na__ProjectedLinework__FlushJoins__.js` 1.0.0
  (`Na__PlFlush__`).
- `ClipKernel__` 1.2.0 (the seam rule), `CpuBackend__` 1.3.0, `EdgeExtractor__` 1.3.0,
  `AuthoredEdges__` 1.2.0 (which categories ship linework), `Projector__` 1.2.0, `Pipeline__`
  1.3.0 (collection key, report), `ConfigAccess__` 1.1.0, `ModelStage__` 1.1.0 (the rules in
  the fingerprint), `DevMenu__Controls__` 1.1.0 (timings rows; Run Diff without the rules);
  `AppConfig__.json`: `HideFlushJoins`, `SeamsOcclude`, `LineworkFirst`, and `BuildToken`
  `2026-09-14-flush-joins`.
- `TrueVision__Pwa__ServiceWorker__Logic__.js` - token `2026-09-14-3`.

**Verification**
- A Node harness on the real folder 50 modules, fed PS01's archived Scheme-01 models and the
  project's elevations:
  - All three rules off: byte-identical to the modules before the change.
  - Defaults: the east head-height line 3,840 mm to 0, the pier sill line 610 mm to 0, the
    side elevation's fascia line 3,430 mm to 0; the ground line keeps all 20,000 mm; nothing
    added; section lines untouched. With Hidden Lines on, the seam leak is drawn dashed.
  - Linework first alone leaves the authored, section and hidden classes untouched; in strict
    mode the ground line goes (the documented cost).
  - Each rule changes the fingerprint; the new build token retires every older one.
- In the app on PS01's D02 - Elevations (localhost:8479), every non-read request blocked (none
  attempted): the viewports projected on the CPU backend with the rules on. The two Project
  Default elevations were projected again with both rules off and the pipeline's two results
  compared line by line:
  - East elevation: 4,573 mm removed - the 3,840 mm head-height line across the render wall,
    a 495 mm head-level stub, the 30 mm sill pieces across the two window piers, short ends
    at the eaves and chimney-pot facets. Nothing added; the ground line whole.
  - Elevation 2: 5,841 mm removed - the 3,430 mm line under the fascia, the 2,300 mm join
    between the old wall and the new, a 20 mm sill piece and chimney-pot facets. Nothing
    added; the ground line whole.

**Found while testing (not part of this release)**
- Force Render can paint the previous projection. `EnsureLinework` clears the path cache by
  the linework key while `BandPaths` stores under the key, Hidden Lines and the style token,
  so a forced re-projection that keeps its key paints the old paths; and the Layout Editor
  memoises its pipeline fingerprint, so a projection setting changed for the session does
  not change the key. Unseen before because a new projection normally arrives under a new
  key. Spun off as its own task.

**ValeVision**
- Not yet ported: waits for Adam's sign-off.

# ---------------------------------------------------------
## TrueVision3D v2.36.0  -  14-Sep-2026
### Project Specification & Margin Notes - Notes Numbered by Their Place, Bubbles That Follow Them

**Overview**
- A Project Specification tab sits at the end of the tab strip whenever a drawing tab is
  open. It holds every drawing note of the project in groups: a group is a prefix (GN, SN,
  EE) and a title; a note is a heading - its code, split into its group and its number,
  then its title - with its specification text underneath.
- Codes are never typed. A note's code is its group's prefix and its place in the group
  (GN01, GN02). Drag a note by its grip, or press Alt+Up and Alt+Down, and the group is
  renumbered; choose another prefix on a note's code and it moves to the end of that group;
  change a group's prefix and every note in it takes the new one.
- Specification bubbles link to notes by id. Type a note's code into a bubble ("gn2" finds
  GN02) and it links; renumber, re-prefix or move the note and every linked bubble on every
  sheet reads the new code. The Leaders panel shows the link and changes it.
- Every sheet can carry a notes margin down its right-hand side (the Notes button, or the
  new Margin Notes panel). It lists the notes that sheet's bubbles link to, in
  specification order, then the general notes; its left edge drags wider or narrower.
- The specification is its own file, TrueVision__ProjectSpecification__.json, beside
  TrueVision__ProjectData__.json. It is read only when the drawing editor first opens,
  kept in the browser at every edit, and written to R2 by Sync (or with Save Sheets).

**THE PROJECT SPECIFICATION TAB**
- The page lies over the editor: the sheet underneath keeps its zoom and scroll, and its
  pointer, keys and margin grip stand down until a sheet tab is chosen again.
- Groups: prefix (letters only, up to 4; refused beside the group, with the reason, when it
  is another group's, too long or not letters), title, a General notes switch, move up and
  down, and delete (asking first when the group holds notes).
- Notes: a grip, the code (group choice and number), the title, where it is used, delete
  (asking first when bubbles show it or it holds text - the question says the notes after it
  are renumbered), and the text, which grows as it is typed.
- Where a note is used: a chip per sheet whose bubbles link to it (a click opens that sheet
  with the bubble selected), and any unlinked bubbles that already read its code, with Link.
  Above the groups: bubbles linked to deleted notes, and codes that bubbles read but no note has.
- The bar: a filter; Headings only (folds every note to its heading, for reordering a long
  specification); Link matching bubbles (n); Add group; Undo and Redo; the sync state; Sync.
  An empty specification offers Add standard groups (GN General Notes, SN Structural Notes,
  FN Finishes, from the config).
- Typing is live and a field's commit is one undo step; Ctrl+Z and Ctrl+Y undo the tab's own
  steps outside a text field. The tab carries an amber dot while there are unsynced changes.
  Read-only sessions see the same page with nothing editable.

**LINKS AND PROPAGATION**
- A link is `Leader__SpecNoteId`. The code is resolved as the bubble is drawn - a resolver
  registered with LeaderGeometry - and also stamped into `Leader__Text`, silently and with no
  undo step, whenever a code moves, the sheets load, or an undo or redo restores a sheet. Once
  the sheets are next saved, they read correctly to anything that opens them without the
  specification.
- A bubble linked to a deleted note keeps its last code and says so (the Leaders panel, the
  tab's alert). Undoing the delete relinks it: note ids are never reused.
- Nothing links behind anyone's back. A renumber never captures an unlinked bubble that
  happens to read the new code; Link matching bubbles does that when asked.
- A new bubble whose suggested code a note already has starts linked.

**THE NOTES MARGIN**
- Down the right of the drawing area, from its top to the title block, at the sheet's own
  width (default 90 mm, never under 40 mm or over 60% of the content width). Painted
  paper with a divider down its left, so a viewport pushed beneath it never prints through
  the notes.
- A NOTES heading, then each note: its code in bold in a column as wide as the widest code,
  its title in bold beside it, and its text under the title, wrapped to the column at word
  boundaries with the typed line breaks kept. Optional group headings.
- Order: the notes linked by bubbles on visible layers, in specification order; then the
  general notes (a general note a bubble links to is listed either way). A first band is
  reserved for when notes can be marked as priority.
- A note that would cross the foot of the column is left out, with every note after it, so
  the order never breaks. The panel, a red badge on screen and the PDF toast say how many.
- The grip on the divider (Select tool) re-wraps the notes as it moves: one undo step, and
  Escape puts the width back.
- The Margin Notes panel (left column, after Sheet): Show notes margin, width, heading, text
  size, List general notes, group headings, a line saying what it lists, and a button that
  opens the Project Specification.
- The margin is pushed first among the sheet's markup primitives, so the PDF prints it with
  no code of its own. The PDF library now loads when the editor first opens, so the margin
  and the title block measure text with the metrics the PDF prints with.

**LOADING, THE DRAFT AND SYNC**
- Read on the first entry into the editor. Localhost and authoring sessions read R2 through
  the Worker (the repository copy only when R2 has none); the web build reads the CDN copy.
- A copy that could not be read is 'failed', never 'new': edits stay in the browser and Sync
  refuses until Retry reads the cloud copy. Edits made meanwhile are kept, and Sync asks
  before they replace what the cloud holds.
- Every change writes a browser draft (`Na__LayoutEditor__SpecDraft__<code>`) 600 ms after the
  typing pauses and when the tab is hidden. A load puts a draft that differs back, and says so.
- Sync reads the cloud copy first and asks before replacing one that is not the copy these
  edits started from. It writes the whole file, stamped, and clears the draft.
- Save Sheets syncs the specification too when it has changes.

**THE FILE - TrueVision__ProjectSpecification__.json**
- `ProjectSpecification__Description`, `__Version` (1), `__ProjectCode`, `__UpdatedIso`,
  `__NumberDigits` (2), `__LastIdNumber` (only ever goes up) and `__Groups`, each with
  `Group__Id`, `Group__Prefix`, `Group__Title`, `Group__IsGeneral` and `Group__Notes`, each
  note `Note__Id`, `Note__Code`, `Note__Title`, `Note__Body`, `Note__UpdatedIso`.
- `Note__Code` is written for readers (a design and access statement, say) and recomputed
  from the order on every load. Unknown keys are carried, so a field a later tool writes
  survives a round trip.

**THE RECORDS**
- Leaders gain `Leader__SpecNoteId`, present only on a linked bubble. Sheets gain
  `Sheet__MarginNotes` (`Enabled`, `WidthMm`, `Heading`, `TextSizeMm`, `IncludeGeneral`,
  `GroupHeadings`), present only on a sheet that has had a margin. Every other record is
  exactly what it was.
- A margin change is announced as 'margin': a content edit kept by the draft and Save
  Sheets, one undo step, never an auto save.

**Files**
- New in `51__System__LayoutEditor` (all 1.0.0): `Na__LayoutEditor__SpecData__.js`,
  `Na__LayoutEditor__SpecLinks__.js`, `Na__LayoutEditor__SpecMargin__.js`,
  `Na__LayoutEditor__MarginGrip__.js`, `Na__LayoutEditor__SpecEditor__.js`,
  `Na__LayoutEditor__Panel__MarginNotes__.js`, `Na__LayoutEditor__Styles__Specification__.css`.
- Layout Editor: `ModeController__` 1.10.0, `TabStrip__` 1.2.0, `SheetModel__` 1.9.0,
  `SheetRecords__` 1.6.0, `SheetLayout__` 1.2.0, `MarkupBridge__` 1.6.0, `LeaderGeometry__`
  1.1.0, `LeaderTool__` 1.1.0, `Panel__Leaders__` 1.1.0, `History__` 1.4.0, `Toolbar__` 1.9.0,
  `PdfExporter__` 1.1.0, `ConfigState__` 1.7.0; `AppConfig__.json` (the
  Specification and MarginNotes blocks, labels).
- `80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js` 1.1.0: whole-file read
  and write for files beside the project data, allowed by name.
- `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css` imports the new stylesheet.
- `TrueVision__Pwa__ServiceWorker__Logic__.js` - token `2026-09-14-2`.

**Verification**
- A Node harness on the real modules against stubs: 128 checks.
  - Codes: renumbering within and across groups, re-prefixing, prefix refusals, forgiving
    code parsing, and ids never reused after a delete or an undo.
  - Undo: typing as one step, stepping back past an added note, and an undo right after a
    sync; normalising a hand-edited file.
  - Links: the silent stamp on every sheet, broken links, Link matching (one announcement per
    sheet), and LeaderGeometry's Lines unchanged with no resolver; the record normalisers.
  - Margin: the layout rectangle and its clamps, the listing order, wrapping, overflow and
    primitives.
  - Sync: the key; the overwrite question (No keeps, Yes replaces, and the copy this browser
    wrote never asks); an unreadable cloud refused; the draft back on reload; a failed read;
    Retry keeping blind edits but asking before they replace the cloud.
  - It found two faults, fixed before the app test: an undo could stick after undoing an
    added note (the id counter lived in the restored snapshot), and Retry could let edits made
    on an unreadable specification replace the cloud copy without asking.
- Module graph 351 modules and named exports 264 files: both pass.
- In the app on PS01 (localhost:8481), with every non-read request blocked: the only one
  attempted was the specification write, which the guard answered without sending. PS01's R2
  copy held no sheets (below), so the test used a scratch sheet held in memory only.
  - The tab: the spec idle until the editor opened, then read ('new'); the tab at the end of
    the strip; standard groups; notes; Alt+Down renumbering; a re-prefix; a refused clash; the
    unsynced state, the tab dot and the draft; Undo, Redo, the filter and Headings only.
  - Links: back on the sheet with its keys working; a bubble typed "gn2" linked and reading
    GN02; the link on the Leaders panel; a renumber restamping the bubble; a delete (asked)
    leaving a broken link that an undo relinked.
  - Margin and output: the Notes button and the margin text; the grip dragging 90 mm to
    141.9 mm as one undo step; the PDF operators holding NOTES, the titles and the bubble code;
    Sync handing the guard the file, with its groups, codes and stamp, and coming back clean.
  - Rendered in headless Chrome from the captured markup. Test state removed, drafts cleared.

**Found while testing (not part of this release)**
- During the test, PS01's live R2 project data held no `LayoutEditor__DrawingsData` - only the
  eight keys of the repository base file, which had just been rewritten - so no sheets. By
  14:31 the block was back, with D01 - Floor Plans and D02 - Elevations. Nothing in this
  release wrote to R2; what dropped the block is spun off as its own task.
- TrueVision's Index.html has no confirm-dialog markup, so every confirmation falls back to
  the browser's native dialog.

**ValeVision**
- Not yet ported: waits for Adam's sign-off.

# ---------------------------------------------------------
## TrueVision3D v2.35.0  -  14-Sep-2026
### Leaders & Annotation Bubbles - a Note or a Specification Code on a Sweeping Leader

**Overview**
- A new kind of sheet object: a leader from a point on the drawing to its head, which is
  either a multi-line Note or a Specification bubble - a code centred in a circle (EE02,
  DV01), the key the drawing-specific notes will later be pulled in by. The Leader tool is
  E, beside Text on the toolbar; the Leaders panel sits under Text in the right column.
- Click the point the leader marks, then where the head goes - or press on the point and
  drag to the head. While the head follows the cursor the leader is drawn exactly as it will
  land.
- The text opens at once: a one-line field for a bubble's code, a multi-line field for a
  note (Enter for a new line, Ctrl+Enter or a click away to finish). A new bubble's field
  offers the code after the newest bubble on the sheet, so EE07 is followed by EE08.
- Fill transparency, and an optional edge transparency, came with it for vectors too.

**HOW A LEADER IS DRAWN**
- Never a straight rule. The line leaves the endpoint circle level, runs a short straight
  stub (3 mm, or a quarter of the run if that is less), sweeps through a cubic S whose
  tangents are level at both ends, and runs a second stub into the head.
- The head always extends away from the point, so the side of the point it is placed on
  decides the handing. Head to the right: a note is left-justified and the leader lands on
  the bubble's left side. Head to the left: the note is right-justified and the leader lands
  on the bubble's right side. Nobody picks an alignment.
- A note's leader lands level with the middle of its first line's capitals (TextAttach
  'first-line'; 'middle' is the alternative). A bubble's code is centred, and a code too
  wide for the diameter grows the bubble rather than spilling out of it.
- Paint order: fill, line, endpoint, bubble edge, text. The fill is behind the text and the
  line, so a leader laid over a drawing masks what is beneath it.
- Circles are faceted so no flat strays 0.01 mm from the true circle, and the curve is
  sampled every 0.4 mm; one polyline primitive draws all of it on screen and in the PDF.

**THE LEADERS PANEL (the selected leader, or the next one)**
- Type (Note / Specification bubble); text size, weight and colour.
- Line: dashed or solid, its weight in points and its colour; the endpoint and the bubble
  edge share the colour.
- Bubble: its diameter and its edge weight (0 leaves the fill on its own).
- Fill on or off, its colour and a Fill opacity slider.
- Transparent lines, off by default: tick it and the line, the endpoint and the bubble edge
  take the Line opacity slider, starting at 50%.
- Endpoint, a fold of its own: Filled (a solid dot) or a ring at its own weight, and its size.
- The sliders redraw while they move and announce once on release: one undo step per drag.

**EDITING A LEADER**
- Select tool: the square tip grip re-points the leader, snapping; the bubble, the note or
  the round anchor grip moves the head while the tip stays on what it points at; the curve
  moves the whole leader. The arrows nudge the whole leader.
- Double-click, Edit text on the panel or on the right-click menu reopens the text. Emptying
  it deletes the leader, as it does a text item.
- Escape, Space, a right click or another tool abandons a leader being placed. Nothing
  reaches the undo history until its head lands; the landing is one step and the text
  typed into it another, as with a text item.
- The eyedropper matches leaders: every style trait travels between two of them. The type
  goes to the palette only, through a new trait flag (paletteOnly): Shift+B on a bubble
  sets the Leader tool to draw bubbles, but a paint never turns a note into a bubble.

**VECTOR TRANSPARENCY**
- The Vectors panel gains Fill opacity (under Fill colour, while there is a fill) and
  Transparent edges - off by default - with an Edge opacity slider. New shapes and
  rectangles take both from the panel, and the eyedropper carries them. A gradient keeps
  its own alpha.

**THE RECORD**
- New sheet array `Sheet__Leaders`; a leader lands on the sheet's text layer.
  `Leader__Id`, `LayerId`, `Type` ('text' | 'bubble'), `TipXMm`, `TipYMm`, `AnchorXMm`,
  `AnchorYMm`, `Text` (lines separated by newlines; a bubble shows its first line),
  `TextSizeMm`, `FontWeight`, `TextColour`, `LineColour`, `LinePt`, `LineStyle`
  ('solid' | 'dashed'), `LineOpacity`, `EndpointFilled`, `EndpointPt`, `EndpointSizeMm`,
  `BubbleSizeMm`, `BubbleEdgePt`, `FillColour` (null for no fill), `FillOpacity`.
- Shape records gain `Shape__FillOpacity` and `Shape__StrokeOpacity` (0 to 1). Every
  existing shape reads 1 and draws exactly as it did.
- Leader changes are announced as 'leader' and 'leaders': content edits, kept by the browser
  draft and Save Sheets, never an auto save.

**PAINTING**
- The SheetChrome polyline primitive carries `DashMm`, `FillOpacity` and `StrokeOpacity`
  through an optional last argument. The SVG writes stroke-dasharray (with butt caps, so the
  dashes break where the PDF breaks them), fill-opacity and stroke-opacity; the PDF sets the
  dash pattern and draws inside a saved graphics state carrying jsPDF GState opacities. A
  primitive without them paints exactly as before.

**Files**
- New: `51__System__LayoutEditor/Na__LayoutEditor__LeaderGeometry__.js`,
  `Na__LayoutEditor__LeaderTool__.js`, `Na__LayoutEditor__Panel__Leaders__.js` (all 1.0.0).
- Layout Editor: `SheetModel__` 1.7.0, `SheetRecords__` 1.5.0, `SheetChrome__` 1.3.0,
  `MarkupBridge__` 1.4.0, `Grips__` 1.3.0, `TextTool__` 1.1.0, `SheetTools__` 1.12.0,
  `Eyedropper__` 1.3.0, `History__` 1.2.0, `ModeController__` 1.9.0, `Toolbar__` 1.8.0,
  `PanelHost__` 1.1.0, `ConfigState__` 1.5.0, `ShapeGeometry__` 1.3.0, `Panel__Shapes__`
  1.4.0, `ShapeTool__` 1.3.2, `RectangleTool__` 1.0.2; `AppConfig__.json` (the Leader block,
  the Shapes opacity keys, labels), `KeyMappings__.json` (Tool__Leader on E),
  `Styles__Main__.css` (the multi-line field, the anchor grip), `Styles__Panels__.css` (the
  sub-fold).
- `TrueVision__Pwa__ServiceWorker__Logic__.js` - token bumped: the new modules import new
  exports from modules a live client may still hold stale.

**Verification**
- A Node harness loads the real modules against stubs: 83 checks. Handing; the stubs level
  and straight; the sweep never doubling back; bubble growth; note justification, landing
  and line spacing; circle facets within 0.01 mm; bounds and hit parts; the normalisers; the
  next code; the eyedropper's palette-only type; and old-style primitives painting
  byte-identically to HEAD in SVG and making identical jsPDF calls.
- Module graph: 345 modules resolve (the 1 known issue, unchanged). Named exports: 258
  files, none missing.
- In the app on PS01's PD Drawing sheet, every non-read request blocked and none attempted:
  E and the toolbar button; a bubble by two clicks, its live leader making no history step
  until it landed; EE08 offered next; a note dragged out to the left, right-justified, with
  its multi-line field; a press while a field is open starting nothing; Escape, a right
  click and an emptied text; select, head drag (anchor only), tip drag (tip only), curve
  drag (both), nudge, Delete and Ctrl+Z, double-click and the menu; every panel control, the
  fill slider silent while moving and one announcement on release; the eyedropper onto a
  note; Shift+B; a rectangle at 40% fill with transparent edges; a jsPDF render with the
  dash operators, `/ca 0.4`, `/CA 0.5` and every leader's text.
- Test objects removed, snapping restored, browser draft cleared, nothing written to R2.

**Built beside Box Select**
- Box Select (v2.34.0) was built in another session in the same files at the same time. The
  split was agreed file by file and each side re-read before every edit; its selection sets,
  its box and its group move include leaders.

**ValeVision**
- Ported the same day, after Adam's sign-off, as ValeVision v2.32.0.
  - The three new modules came across verbatim below the header.
  - 123 hunks were replayed across 21 files, from a snapshot of the signed-off state rather
    than these working copies, which already carry the Project Specification work.
- One gap is deliberate: ValeVision's History selection test takes the leader row but not
  the shape row. The shape row waits with ValeVision's pending undo-writes return trip.
- See ValeVision's DEVLOG v2.32.0 and its parity ledger.

# ---------------------------------------------------------
## TrueVision3D v2.34.0  -  14-Sep-2026
### Box Select - A Window to the Right, a Crossing to the Left

**Overview**
- The Layout Editor selects several things at once. A drag with the Select tool that
  starts on bare paper draws a selection box, the way AutoCAD and SketchUp draw one:
  - Dragged to the RIGHT it is a WINDOW: transparent blue with a solid edge. It takes
    only what lies wholly inside it.
  - Dragged to the LEFT it is a CROSSING: transparent green with a dashed edge. It takes
    anything it touches as well.
  Only the horizontal direction decides, as in AutoCAD. While the box is dragged,
  everything it would take is outlined in the box's colour, so the two rules can be
  told apart before the button comes up.
- Before this every item had to be clicked on its own, and nothing could be moved
  with anything else.
- Built in the same files at the same time as Leaders & Annotation Bubbles (v2.35.0),
  by agreement between the two sessions; each release covers its own hunks.

**WHAT A BOX TAKES**
- A viewport by its frame edge. A crossing drawn inside a viewport does not pick the
  viewport up, so the notes and dimensions laid over a drawing can be boxed on their own.
- A vector by its edges, the closing edge of a fill included. A box inside a filled
  shape does not take it, so a background panel is not grabbed with what sits on it.
- Text by its text box or its leader; a dimension by its extension lines, dimension
  line, terminators or value; a leader by its line, its endpoint, or its bubble or note.
- A window takes an item only when every one of those parts is inside it.
- Hidden layers, locked layers and locked viewports are never taken.

**WHERE A BOX CAN START**
- On bare paper or the grey stage.
- On a locked viewport: lock the drawing, then box the markup laid over it.
- Anywhere at all with Alt held, for a sheet with no bare paper left to start from.
- A press on anything that can move still moves it, exactly as before.

**MODIFIERS, AS SKETCHUP HOLDS THEM**
- Ctrl adds, Shift toggles (in if it was out, out if it was in), Ctrl+Shift removes -
  for a box and for a click alike. They live in `Na__LayoutEditor__KeyMappings__.json`
  (the new SelectionBindings block, with Alt as the box-anywhere modifier), like every
  other binding.

**WORKING WITH SEVERAL**
- Drag any one of them and they all move - one undo step, however many items.
- A click on one of them that does not move narrows the selection to it, so its grips
  come back and its panel edits it.
- The arrow keys nudge them all (Shift for ten millimetres). Delete removes them all,
  asking once if a viewport is among them, and the right-click menu on one of them
  offers Delete N selected items. Each is one undo step.
- A locked item may be part of a selection but is left out of every move, nudge and
  delete.
- A LEADER TIP FOLLOWS A VIEWPORT, NOT ITS TEXT. Moving notes on their own leaves every
  leader pointing where it points, as a single text drag always has; a tip inside a
  viewport frame that is moving with the group goes with the drawing it points at. The
  same holds for a leader's own tip.
- With several selected, the Text, Dimensions and Vectors panels say how many, and that
  they show the settings for new objects until one item is selected on its own.

**THE RECORD**
- Nothing new is saved: the selection is session state.
- `Na__LeModel__GetSelection` keeps its meaning - `{ kind, id }` for exactly one item,
  null for none or several - so every single-item reader is unchanged. New:
  `GetSelectionItems`, `SetSelectionItems`, `IsSelected` and `DeleteItems` (a batch
  delete, one undo step).

**Files**
- New `51__System__LayoutEditor/Na__LayoutEditor__SelectionBox__.js` 1.0.0 - the window
  and crossing rules for each kind, the box and its preview, and the Add / Toggle /
  Remove combine.
- New `51__System__LayoutEditor/Na__LayoutEditor__SelectionSet__.js` 1.0.0 - group
  capture, move and commit, nudge and delete, with the leader tip rule.
- `Na__LayoutEditor__SheetModel__.js` 1.8.0 - the selection set and DeleteItems.
- `Na__LayoutEditor__SheetTools__.js` 1.13.0 - the press decides box or drag
  (StartsBox, PressSelection), BoxUp, group drags, multi nudge, delete and menu.
- `Na__LayoutEditor__SheetSurface__.js` 1.4.0, `Na__LayoutEditor__ViewportHandles__.js`
  1.3.0 (RenderOutlines), `Na__LayoutEditor__MarkupBridge__.js` 1.5.0 (a highlight
  round every selected item), `Na__LayoutEditor__History__.js` 1.3.0 (a restore prunes
  the set), `Na__LayoutEditor__ConfigState__.js` 1.6.0 (box setup,
  MatchSelectionModifier).
- `Na__LayoutEditor__Panel__Text__.js` 1.1.0, `Panel__Dimensions__` 1.1.0,
  `Panel__Shapes__` 1.5.0 - the several-selected note.
- `Na__LayoutEditor__KeyMappings__.json` (SelectionBindings, three Select actions),
  `Na__LayoutEditor__AppConfig__.json` (BoxStartPx, BoxBorderPx, BoxPreview,
  BoxPreviewPadMm; six labels), `Na__LayoutEditor__Styles__Main__.css` (the box and
  preview colours).

**Verification**
- A Node harness loads the real SelectionBox, SelectionSet, SheetModel and History, with
  the dimension, shape and leader geometry, against stubbed imports: 87 checks, all
  passing. The window and crossing rule for every kind; hidden, locked and
  locked-viewport items; the four combines; press, move and release; one undo step for a
  group move, a nudge and a delete (a viewport-attached dimension let go, and restored);
  the leader tip rule; the selection pruned by a delete and by a redo; the modifiers
  from the built-in and the shipped key map.
- Module graph: 345 modules, every specifier resolves (the 1 known issue, unchanged).
  Named exports: 258 files, none missing. Every changed module parses.
- In the app on PS01's PD Drawing sheet (localhost:8471), every non-read request
  blocked and none attempted, on six test items: a window round them took all six and
  nothing else (six highlights, no grips, the several-selected note in all three
  panels); a crossing from bare paper took exactly the two items it clipped, and the
  same rectangle dragged as a window took nothing; Alt boxed inside an unlocked viewport
  without taking it; a press on the locked viewport drew a box and a click selected it;
  Shift, Ctrl and Ctrl+Shift clicks; a click narrowing to one dimension with its three
  grips; a group drag moving every item by the same distance with both leader tips
  staying, one undo step; nudges one step each; Escape mid-box; the Delete N selected
  items menu. Nothing of the sheet's own moved. The test tab closed before the in-app
  Delete step, which the harness covers.
- Adam tested it on 14-Sep-2026: working.

**ValeVision**
- Ported the same day, after Adam's sign-off, as ValeVision v2.33.0, on top of the
  Leaders port (v2.32.0).
  - The two new modules came across verbatim below the header, leader rows included.
  - Box Select's own 79 hunks were replayed across 13 shared files, every anchor unique
    before anything was written. 10 were development-log heads rewritten to ValeVision's
    module versions. 6 were re-anchored where ValeVision lacks the viewport snap-move and
    clipboard, or words its History header differently. CarryTarget's guard was left out,
    as there is no viewport carry there.
- One gap stays open: ValeVision's History selection test still has no shape row, so a
  restore there drops selected vectors from the set. It waits with ValeVision's pending
  undo-writes return trip.
- Verified there: the 12 edited and new modules parse, both JSON files parse, the module
  graph and named exports (317 files) pass, and this release's harness passes 86 of 87 on
  ValeVision's real modules - the one failure is that shape row. See ValeVision's DEVLOG
  v2.33.0 and its parity ledger.

**ValeVision**
- Not yet ported: authored in TrueVision first. The leader rows in both new modules need
  Leaders & Annotation Bubbles (v2.35.0), so the two cross together.

# ---------------------------------------------------------
## TrueVision3D v2.32.1  -  13-Sep-2026
### A Refused Snapshot Upload No Longer Claims a Picture R2 Never Received

**Overview**
- A Layout Editor 3D viewport whose snapshot upload was refused still recorded the
  snapshot as stored. `Viewport__SnapshotAsset` took a path R2 had never been sent.
  Once the sheets were saved, the web build would ask R2 for a file that was not there
  and draw an empty frame, and the Dev bake would call the viewport up to date and never
  send it again.
- On localhost the fault hid itself: the Assets cache keeps the picture under its path
  even when the upload fails, so the frame looked right for the rest of the session.
- Found while verifying v2.32.0 on PS01 with every R2 write blocked: `POST /r2/write`
  was refused, and the viewport still took
  `LayoutEditor/Snapshots/Sheet_001__Viewport_004__qw9nnm.webp`.

**WHY**
- `Na__LeAssets__Upload` hands back whatever `Na__AppUtils__R2AssetUpload` returns. In
  ValeVision that utility throws on a failed write and the Assets module turns the throw
  into null, so "a result came back" meant "R2 has it". TrueVision's utility never
  throws: every failure is a result object with `r2Success : false`, and an object is
  truthy. `Na__LeVp3d__RenderNow` only asked whether a result came back.
- The utility's PORT NOTE said shared callers "need no branch". That was true of
  `localSuccess` and never of failure. The projected linework bake already tested
  `r2Success`; the snapshot stamp did not.

**THE FIX**
- RenderNow stamps the record only when the upload came back with
  `r2Success === true`, and returns whether the picture was stored and referenced.
  Every render that uploads goes through it: the frame's own refresh, Force Render, the
  PDF export's export-size render and the Dev bake.
- `Na__LeVp3d__Bake` counts that return instead of reading the record afterwards. The
  record cannot tell a stamp just made from one already there, so a forced bake - or a
  record of the same view too narrow for export, which every record written before
  `Asset__PixelWidth` is - read as baked after a refused upload.
- A refusal withholds only the claim. The frame still shows the picture, the PDF still
  prints it, and the next render tries the upload again.

**Files**
- `51__System__LayoutEditor/Na__LayoutEditor__Viewport3d__.js` 1.5.1 - the stamp, the
  return and the bake count. The PORT NOTE now lists Model Source (1.5.0) as the
  divergence from ValeVision.
- `03__AppUtils/Na__AppUtils__R2AssetUpload__.js` 1.0.1 - comments only: the PORT NOTE
  and the return note say a failure is `r2Success : false` here and a throw in
  ValeVision.

**Verification**
- A Node harness loads the real module of each app against stubbed imports and drives
  10 cases: an upload refused as a result object, refused as null, and accepted, through
  Bake, Force Render and the PDF render. Before the fix TrueVision failed 5 - a refused
  upload stamped the record through all three paths, and two same-key bakes read as
  baked. After it, all 10 pass.
- Both edited modules parse. Module graph: every specifier resolves (the 1 known issue,
  unchanged). Named exports: 253 files, none missing.
- In the app on PS01 (`127.0.0.1:8442`), every non-read request refused by a guard, and
  the running `Bake` proven to be the new one by its own source:
  - A 3D viewport added to Sheet_001 on Exterior 01 rendered through the frame's own
    refresh (4885 px wide). Its snapshot write was refused and the record stayed null.
  - Force Render, a forced bake and the PDF render, each with the write refused: record
    null, the bake `failed`, the PDF picture returned.
  - Positive control, the guard answering that one snapshot write 200 without sending
    it: Force Render stamped `LayoutEditor/Snapshots/Sheet_001__Viewport_003__1clp678.webp`,
    fingerprint `1clp678`, 4885 px.
  - Over that same-key record, a forced and an unforced bake with the write refused:
    both `failed`, the record untouched. The old code says `baked` for both.
  - No other write was attempted. The test viewport was deleted (the sheet is back to its
    two viewports), the browser draft cleared, and nothing reached R2.
- PS01's sheet holds no 3D viewport of its own, so no stored record there names a
  missing snapshot.

**ValeVision**
- Ported the same day at Adam's request as ValeVision3D v2.31.1
  (`Na__LayoutEditor__Viewport3d__` 1.4.1), both hunks line for line. ValeVision never
  stamped a refused upload - its utility throws - but its bake miscounted the same way.
  Before the port its copy failed the same 5 harness cases; after it, all 10 pass, and
  its module graph and named exports (312 files) pass. In its running app on Doous the
  ported module renders, and its bakes report `failed` with nothing stored and no write
  attempted. That host cannot upload, so the upload branch there rests on the harness.
  See its DEVLOG and parity ledger.

# ---------------------------------------------------------
## TrueVision3D v2.32.0  -  13-Sep-2026
### Model Source - Existing and Proposed on One Sheet, the Same View of Two Models

**Overview**
- A Layout Editor viewport now chooses which design phase it draws. On a project
  with more than one model group - PS01's existing building and Scheme-01 - the
  Viewport panel has a Model Source row, the Add Viewport block has one too, and
  a viewport's right-click menu lists the phases as Model items, the current one
  ticked.
- Everything else stays the viewport's own: scene, cut, window, scale, render
  composites, model layers, edge styles. Copy an elevation viewport, switch the
  copy to the existing building, and the two are the before and after of one
  drawing, lined up exactly - every phase comes from the one SketchUp model, so
  the phases share one origin.
- A viewport that names no phase draws the Project Default: the phase the 3D view
  opens with, the newest group whose label does not say "existing". Every sheet
  that exists today draws exactly what it drew before.

**WHAT A VIEWPORT USED TO DRAW**
- Whatever the 3D view held. The 2D underlay, the 3D snapshot and the projected
  linework all read the one live model root, which the Design Phase menu clears
  and reloads.
- And the keys did not follow a switch. The Layout Editor holds its model
  fingerprints for the session and nothing reset them on a Design Phase switch,
  so after looking at the existing building in the 3D view a sheet redrew the
  existing model under keys made from the scheme: stored snapshots and baked
  linework of one phase could paint over pictures of the other.

**HOW ANOTHER PHASE IS DRAWN**
- New `26__System__ToggleModelElements/Na__ModelGroup__PhaseLibrary__.js`: the
  register of every phase (groups, default, live) and a cache of the others,
  each loaded into a detached root of its own with the same loader, configs and
  materials pass as the 3D view - one load at a time, and only once the live
  model is in. Beyond `MaxCachedPhases` (3) the least recently used is disposed;
  a phase a render has pinned never is.
- The snapshot renderer puts a phase in the scene for one render only. The live
  root LEAVES the scene rather than being hidden - a hidden root is still walked
  by both profile line caches - and the phase root takes its slot. The section
  engine, the material preset, the category registry
  (`Na__ModelToggle__BorrowRegistry`) and both profile line caches are pointed at
  the phase, and all of it is handed back at the end of the render. The render
  loop is held throughout, so no live frame can ever draw the phase.
- The projected linework reads the phase root where it lies:
  `Na__PlPipe__RenderDefinition` takes an optional model root and `GetCached` an
  optional fingerprint. The live root's children are never moved, so a
  projection of the live model running meanwhile still reads the live model.
- A phase's two fingerprints are read the moment it loads, formed exactly as the
  live pair. The existing building's off-scene fingerprint (`1eb39916-149`) is the
  very string the live fingerprint became when the 3D view switched to it, so a
  phase keeps its cached pictures and linework whichever way it is drawn.
- New `51__System__LayoutEditor/Na__LayoutEditor__ModelSource__.js` resolves a
  viewport. Its `renderId` is null for the live phase, so a viewport drawing the
  phase the 3D view holds takes exactly the path every viewport always took.
- While a phase loads, the frame shows a badge ("Loading design phase: ...") and
  nothing of the model it drew before. Switching phase never slides one phase's
  picture or lines under the other.

**THE RECORD**
- New viewport key `Viewport__ModelSourceId`: the model group's `groupId` (its
  folder name), or null for the Project Default. Every existing record reads
  null. An id the project no longer has is kept as written; the viewport draws
  the Project Default and the panel says why.
- A change is one undo step and a browser draft, never an auto save.

**FIXED ON THE WAY**
- A Design Phase switch now resets the Layout Editor's live fingerprints - the
  stale keys described above.
- The Design Phase menu gives the phase it loads the materials library pass the
  startup load always applied; it used to keep the loader's plain materials. The
  pass is one helper, `Na__ApplyLibraryMaterials`, shared by the startup load,
  the menu and the phase library.
- The menu's active button is the phase the 3D view holds. It was always the
  newest group, which is wrong whenever the newest is an existing one.

**LIMITS**
- R2 linework assets stay one per drawing, of the live phase, so the Dev bake
  names a drawing only for viewports that draw the live phase. Another phase's
  linework is computed on the device and kept in the browser store, per phase.
- A viewport of another phase renders every category, less its own Model Layers
  and Context Layer hides: category toggles made in the 3D view only ever touch
  the phase they were made on. Camera-follow billboards and storey isolation
  belong to the 3D view and are not rebuilt for an off-scene phase.
- A cached phase holds its GPU memory until it is let go.

**Files**
- New: `26__System__ToggleModelElements/Na__ModelGroup__PhaseLibrary__.js`,
  `51__System__LayoutEditor/Na__LayoutEditor__ModelSource__.js`.
- `Na__AppFlow__LoadingSequence.js` - library initialised and told the groups and
  the live phase; the materials pass is a shared helper; the preferred-group rule
  moved into the library unchanged.
- `Na__UiFeature__ModelGroupSelector.js` - reports switches, materials pass,
  active button.
- `Na__UiFeature__ModelToggle__Controls.js` - BorrowRegistry and RestoreRegistry.
- `Na__ProjectedLinework__Pipeline__.js` - optional model root and fingerprint.
- Layout Editor: `SnapshotRenderer__`, `Viewport2d__`, `Viewport3d__`,
  `SheetModel__`, `SheetRecords__`, `Panel__ViewportSettings__`,
  `Panel__ModelLayers__`, `ModelLayers__`, `ModeController__`, `SheetTools__`,
  `PdfExporter__`, `DevMenu__Controls__`, `ConfigState__`, and `AppConfig__.json`
  (ModelSource block and labels).
- `TrueVision__Pwa__ServiceWorker__Logic__.js` - token bumped: signatures that
  cross module boundaries changed.

**Verification**
- 19 changed modules parse. Module graph: 340 modules resolve. Named exports: 253
  files resolve, no undeclared names.
- In the app on PS01's PD Drawing sheet, every non-read request blocked:
  - The two elevations render unchanged on the live path (3 s).
  - A duplicate of one elevation, switched to the existing building from the
    panel: badge at once, the phase loaded off-scene, underlay and linework in
    4 s. The live model root, its scene slot and the category registry are
    unchanged; the phase root is out of the scene with no pins.
  - The right-click Model items, a switch to Scheme-01 and its undo: no stale
    picture either way.
  - Model Layers lists the existing building's 5 categories for that viewport;
    hiding its landscape renders, and both models are at rest afterwards.
  - The PDF linework path: 2,666 visible and 1,493 authored segments for the
    existing building against 2,338 and 1,646 for the proposal, same elevation.
  - A 3D viewport of the existing building renders.
  - The 3D view switched to the existing building: the Project Default elevations
    loaded Scheme-01 off-scene and drew it unchanged in 5 s, and the existing
    viewports drew from the live model. Switched back: no copies left over, the
    render loop free.
- Found on the way, not changed: a failed 3D snapshot upload still stamps
  `Viewport__SnapshotAsset`, because `Na__LeAssets__Upload` returns the upload's
  result object, which is truthy on failure. Flagged as its own task.
- Test viewports removed, browser draft cleared, nothing written to R2.

**ValeVision**
- Not ported. ValeVision has no model groups; the record key and the Model Source
  module carry over unchanged if it ever gains them.

# ---------------------------------------------------------
## TrueVision3D v2.31.0  -  13-Sep-2026
### Ortho Dimensions - Hold Shift for Horizontal or Vertical - and Snaps Coloured by Tool

**Overview**
- The Dimension tool only drew ALIGNED dimensions: the line always ran parallel
  to the two points it measured. Two points at different heights - the eaves of
  one wall and the foot of the next - could only be given a sloping dimension
  that measured the diagonal, when the drawing needed the horizontal distance.
- Hold Shift while the dimension's line follows the cursor (after the second
  click) and the dimension runs ORTHO, whatever the two points are. Drag the
  line above or below them and it runs horizontal and measures the x distance;
  drag it beside them and it runs vertical and measures the y. Let go of Shift
  and it is aligned again. Pressing or releasing Shift redraws at once - no need
  to nudge the mouse.
- Snap markers are coloured by the tool that is snapping: BLUE for vertices (the
  Draw and Rectangle tools and vertex grips), ORANGE for dimensions (the tool, its
  grips, its line inference), PURPLE for viewports (hovering and carrying one by
  a point - the carried point's ring, the tracking crosses and the carried
  frame's outline go purple too). The glyph still says what was found.

**HOW THE ORTHO CHOICE IS MADE**
- The CAD linear-dimension rule: take the box the two points span. A cursor above
  or below it gives horizontal, one to either side vertical, and off a corner the
  side it is further out on wins. Inside the box the choice holds; with Shift
  first pressed inside it, the wider extent picks.
- Never a dimension of nothing: two level points can only take a horizontal
  dimension, two plumb ones only a vertical.
- Each measured point runs its own extension line to the dimension line, so the
  two differ in length. A vertical value always reads up the sheet.
- Inference carries over: an ortho line snaps onto any parallel dimension's line
  nearby, aligned or ortho, so a run of dimensions still lines up.

**THE RECORD**
- New field `Dimension__Orientation`: `'aligned'`, `'horizontal'` or
  `'vertical'`. Every record written before today normalises to aligned and draws
  exactly as it did - the aligned skeleton is unchanged to the bit.
- The offset is still measured from the start point. On an ortho dimension, a
  grip that re-picks a point measures the offset again so the LINE STAYS WHERE IT
  WAS PUT - including when the end is dragged past the start.
- The same field goes into ValeVision with the port, so either app reads the
  other's dimensions.

**ONE BEHAVIOUR CHANGE**
- Shift used to bend the span to the nearer axis while the end point was picked.
  It no longer does: the end lands on the point that was picked, because Shift now
  makes the finished dimension ortho, and an ortho dimension measures one axis
  whatever the span. The arrow keys still lock the span to an axis.

**Modules**
- `Na__LayoutEditor__DimensionGeometry__` 1.1.0 - `Frame`, an orientation-aware
  `Skeleton` and `TextPlacement`, `SpanMm`, `OrthoToward`, `OffsetKeepingLine`.
- `Na__LayoutEditor__DimensionTool__` 1.2.0 - Shift ortho while the line is placed,
  `IsPlacingLine`, orange markers.
- `Na__LayoutEditor__SheetTools__` 1.11.0 - Shift down and up redraw a line being
  placed; dimension grips hold an ortho line still and snap in orange.
- `Na__LayoutEditor__Snapping__` 1.3.0 - marker tones.
- `Na__LayoutEditor__ViewportSnapMove__` 1.1.0 - purple on hover and carry.
- `Na__LayoutEditor__MarkupBridge__` 1.3.0, `SheetModel__` 1.5.0, `SheetRecords__`
  1.3.0, `Toolbar__` 1.7.0 - the field through the drawing, the value, create,
  update and the normaliser; the Dimension tooltip.
- `Styles__Main__.css` - one RGB custom property per tone; `AppConfig__.json` -
  the descriptions and the `ToolDimensionTitle` label.

**Verification**
- Geometry harness against HEAD's module, 30 checks: the aligned skeleton, text
  placement and span bit-identical across 80,000 cases; `Push` with no
  orientation emits HEAD's primitives for 3,000 specs; horizontal and vertical
  skeletons across 5,000 cases each; the box rule; regrips holding the line
  across 4,000 random cases.
- All 9 changed modules parse, all 877 named imports in the Layout Editor
  resolve, and every `Na__` name in the changed files is declared or imported.
- In the app on PS01's PD Drawing sheet, with pointer and key events and every
  non-read request blocked (none was attempted): 38 checks - the full Shift
  placement; live Shift release and press; the 40 / 45 / 60.208 values; the
  per-point extension lines; inference onto a parallel ortho line; both grips,
  with the line held; two undos; an aligned placement with no Shift; an unsnapped
  span not bent; and all three tones, on the same vertex and on a viewport
  hovered and carried (which ended exactly where it began). The test line and
  dimensions were removed and the browser draft cleared.
- Signed off by Adam 13-Sep-2026 ("works great"), with the ValeVision port.

# ---------------------------------------------------------
## TrueVision3D v2.30.2  -  13-Sep-2026
### The Drawing View Reads Its Own Config

**Overview**
- `Na__DrawView__AppConfig__.json` had never been read in TrueVision. Neither
  `Na__DrawCfg__SetAppConfig` nor `Na__DrawCfg__Load` was ever called: ValeVision's
  index.html makes both calls (lines 2119-2120), and the port brought the module
  across without them.
- Both are now called in index.html, before the loading sequence. Wiring them changed
  nothing on screen, proved by a diff of every getter and a before and after in the
  app.
- Found while tracing it: Layout Editor underlays had always been baked with a 1.0 px
  profile outline, not the 0.55 the main config appeared to set, and v2.27.0 (Edge
  Styles) had quietly made them thinner. The default is back to 1.0.

**WHAT WAS DEAD**
- The config module's precedence chain - main config, then this JSON, then built-in
  fallbacks - had collapsed to the fallbacks alone. The main config's Drawing2d keys
  never reached the render setup, and nothing in the JSON was ever used.
- Nobody saw it, because the live floor plan and elevation views do not read this
  module at all. Their profile pass takes its width and colour straight from the main
  config at start-up, and the section cut keeps the Cross Sections tool's own look.
  The only readers are the two drawing presets, and the only caller of either preset
  is the Layout Editor's viewport bake.

**THE DIFF BEFORE WIRING**
- A Node harness ran every getter four ways - neither call, Load alone, SetAppConfig
  alone, both - against the shipped module and JSON:
  - Load alone changes no setup value. The JSON and the fallbacks agree on every key
    (profile width since the 0.55 alignment). Only the four label strings differ, and
    nothing in TrueVision reads a label.
  - SetAppConfig adds two: the 2D edge colour (null to 3355443) and threshold (null to
    0.2). No preset reads either. The render preset reads background, profile enabled
    and edge width; the material preset reads six material values; all nine are
    identical in every scenario.
- So no value in the JSON had to change to keep the picture the same.

**WHERE IT IS WIRED**
- index.html, beside the drawings-data listener and before the loading sequence, so the
  fetch starts before anything could want it. NOT awaited: an await in that block opens
  exactly the window its own comment warns about, where a dispatch lands before its
  listener.
- The Layout Editor's ready chain waits for the same promise, because its bakes are the
  one thing that renders through the presets. Nothing else needs to wait.

**THE BAKE WIDTH, CORRECTED**
- Before v2.27.0 (Edge Styles) every underlay bake drew its profile outline at 1.0 px:
  the render preset applied the fallback, and the main config's Drawing2dEdgeWidth 0.55
  never reached it. A bake also left the global at 1.0, so after visiting the Layout
  Editor the live views drew a thicker outline until the page reloaded.
- That version moved the bake width into the Profile Linework composite at 0.55,
  believing that was the number in use, and first described it as "the same number".
  It was not: new underlays would have come out with a lighter outline than every
  existing sheet. Its entry is corrected in place.
- The composite default is now 1.0, which is what every existing sheet has and what
  ValeVision bakes at. The drawing view's own fallback and JSON stay 0.55 - the live
  views' width - which the preset re-applies around a bake, so a bake no longer leaks
  into the live views.

**Files**
- `Index.html` - imports and calls SetAppConfig and Load.
- `Na__LayoutEditor__ModeController__.js` - the ready chain waits for Load.
- `Na__DrawView__ConfigState__.js` - header, divergence, dev log, fallback comment.
- `Na__DrawView__AppConfig__.json` - the profile width note says the file is loaded.
- `Na__LayoutEditor__RenderComposites__Config__.json` and `..RenderComposites__.js` -
  Profile Linework default 1.0; the history in both corrected.
- `Na__AppConfig__Main.json` - the note where Drawing2dEdgeWidth was, corrected.

**Verification**
- Node harness over every getter (neither call, Load, SetAppConfig, both): the only
  changes are the four unread labels and the unread 2D edge colour and threshold.
  Every value a preset reads is identical.
- In the app on PS01, before and after wiring, each build proven by its own source:
  - After: the JSON label reads back ("No project loaded.") and the main-config edge
    colour arrives (3355443), with every other setup value unchanged.
  - Live floor plan and elevation, entered and exited: profile width 0.55 and enabled,
    section `#f0f0f0` / `#323232` / 2 px - idle, in each mode and after - identical
    before and after.
  - Layout Editor bakes: at the new 1.0 default both underlays re-bake heavier.
    Overridden to 0.55 they reproduce the pre-wiring pictures byte for byte
    (`416374:-1871657127`, `273702:664064456`). The global width is 0.55 after every
    bake.
- Link check: 1,005 named imports across the 78 modules in 50 and 51, none missing.
- Two browser cache traps during the check, neither in the app: a module another
  session had changed on disk was still cached (fixed by refreshing every module
  folder), and refreshing `Index.html` does not refresh `Index.html?project=...`
  (fixed by refreshing that exact URL).

**ValeVision**
- Nothing to port for the loader: ValeVision already makes both calls. Recorded as a
  divergence: the fallback profile width is 0.55 in TrueVision (its live views' width)
  and 1.0 in ValeVision.

# ---------------------------------------------------------
## TrueVision3D v2.30.1  -  13-Sep-2026
### Undo Stops Saving the Project Behind Your Back

**Overview**
- In the Layout Editor every Ctrl+Z and Ctrl+Y, of anything, wrote the whole
  project to R2 about a second and a half later. Undo a vector delete and the
  sheet was saved, though nobody had pressed Save Sheets. Found by a fetch guard
  during the rectangle tool test on PS01, which caught the `POST .../r2/write`.
- Undo and redo are now saved the way the step they reverse was saved when it
  was made. Content edits - vectors, text, dimensions, viewports, layers, title
  block fields - never wrote the project, so neither does undoing or redoing
  them: they stay with the browser draft and Save Sheets. Sheet settings - the
  name, paper size, orientation, title block style and lineweights - auto-save
  when changed, so undoing or redoing one auto-saves too, and R2 keeps up with
  what is on screen.

**WHY IT HAPPENED**
- The history put a snapshot back and then announced it through
  `UpdateSheet(sheet, {})` - a convenient way to normalise, mark dirty and
  redraw. But that announcement's reason is `sheet-updated`, and the auto save
  reads `sheet-updated` as "the sheet's settings changed" and schedules a
  project save. Every restore looked like a rename.

**THE FIX, AT THE ROOT**
- Each history step now keeps the reason its change was announced with.
- A restore goes out through the new `Na__LeModel__AnnounceRestore`. It is
  still `sheet-updated` - for drawing purposes a restore IS a sheet update, since
  anything may have changed - so every listener (the mode controller's full
  refresh, the tab strip, the toolbar, the dev menu, the tools) behaves exactly
  as before and none of them had to learn a new reason, which is how the vector
  redraw gap of 2.26.1 happened. It carries one extra field in the event detail:
  `restore : { direction, stepReason }`.
- The auto save judges a restore by `stepReason`, not by `sheet-updated`. The
  structural list is unchanged and still lives only in the auto save.
- The history ignores any announcement that carries a restore, on top of its
  existing guard during Apply, so it cannot record its own undo as a new step.

**ALSO FIXED**
- A selected vector no longer drops out of the selection on every undo. The
  history's "does the selection still exist" test had cases for viewports, text
  and dimensions but none for shapes, so for a vector it always answered no.

**Verification**
- In the app on PS01's PD Drawing sheet, fresh modules confirmed, every request
  but reads blocked and recorded: 11 checks. Adding a vector, undoing it and
  redoing it: no write. A selected vector survives an undo that keeps it, and
  undoing it away clears the selection; still no write. Renaming the sheet
  auto-saves as before, and undoing the rename, redoing it and undoing it again
  each auto-save - four blocked writes, one per structural step, which also
  proves the guard would have seen a stray save. Every restore's detail was
  recorded (`undo / shapes` ... `undo / sheet-updated`). The sheet ended
  identical to its loaded state and its draft was removed.
- ValeVision has the same fault in the same three modules. Not ported: waiting
  for Adam's sign-off.

# ---------------------------------------------------------
## TrueVision3D v2.30.0  -  13-Sep-2026
### The Palette - Shift+B Sets What You Draw Next

**Overview**
- The eyedropper gains a second mode. B still paints one object's style onto
  others. Shift+B loads the PALETTE: click an object and its style becomes the
  setting that new objects of its kind are created with - the same Text,
  Dimensions and Vectors settings the panels show when nothing is selected.
- The problem it answers: moving on to a different kind of dimension or line
  meant resetting a panel's worth of fields by hand, every time.
- The workflow it enables is a SCRAPBOOK. Keep one of each house style on the
  sheet - a red dimension, a grey dashed line, a bold label - beside the paper,
  where it shows on screen and never prints. Shift+B, click the one you want,
  draw.

**HOW IT BEHAVES**
- Shift+B arms the palette. Click an object: its style loads, the selection
  clears so the panel visibly changes to match, the item pulses, and the
  drawing tool for that kind takes over - Text, Dimension, or whichever of Draw
  and Rectangle drew last. Setting the palette and drawing with it is Shift+B
  and one click.
- Shift+B with something already selected loads it at once, with no click.
- Also on Shift+click of the Eyedropper button, and as Use for new dimensions /
  text / vectors on the right-click menu.
- `PaletteSwitchesTool` turns the hand-over off, for setting several palettes in
  a row.

**THE SAME TRAITS TRAVEL**
- The palette reads the eyedropper's trait table, so what B copies is exactly
  what Shift+B loads: size, weight, colour and alignment for text; text size,
  colour, terminator, precision and units for dimensions; edges, weight, fill
  and gradient for vectors. Content, geometry and the layer never travel, and
  the dimension offset stays out unless `CopyDimensionOffset` is on.
- ONE TRANSLATION. A vector record stores "no fill" as a null. The settings for
  new objects store an on/off switch beside the last fill colour instead, so
  turning fill back on in the panel still has a colour to restore. The trait
  table now says so on the two traits concerned - `palette : 'filled'` and
  `palette : 'gradientOn'` - so no field name leaked out of the one place field
  names live. A gradient is copied, never shared with the item it came from.
- The sheet tools own those settings and hand the eyedropper a writer. The
  eyedropper reads, translates and reports; it never reaches into them.

**LOCKED LAYERS ARE NOW READABLE**
- The eyedropper's header said a locked item was a valid source. It was not
  reachable: the hit test skipped locked layers, so a click on one found nothing
  - or the viewport underneath. `Na__LeMarkup__HitTest` takes `includeLocked`
  and only the eyedropper passes it. A locked scrapbook now hands out its style,
  and a locked TARGET is refused with "That layer is locked" rather than missed.
  Selecting, dragging and every other tool still leave locked items alone.

**Verification**
- Palette harness against stubbed dependencies: 53 checks - both switch
  translations, gradient copy isolation, locked sources, refusals, the pulse,
  modes that do not mix, the labels. Eyedropper harness re-run: 52 checks.
- Every Layout Editor module parses, every named import resolves, and every
  `Na__` name the changed files use is declared or imported.
- In the running app, read-only: every changed module loads; the live key map
  resolves Shift+B to the palette and plain B - Caps Lock too - to the
  eyedropper; the live config supplies the menu wording and both settings.
- Not exercised by pointer in the app: the arm, click and draw flow itself.

# ---------------------------------------------------------
## TrueVision3D v2.29.0  -  13-Sep-2026
### Gradient Fills - Fade a Drawing Out Into the Page

**Overview**
- The Vectors panel has a Gradient toggle, last in its list after Fill and
  Closed. Switch it on and the shape is filled with a linear gradient: a start
  colour, an end colour, a Blend slider and a Direction from 0 to 360 degrees.
  Either end can be Alpha.
- The case it was built for: draw a closed polygon on a vector layer over a
  drawing, switch the edges off and run alpha to white, and the drawing fades
  out into the page. Colour to colour works the same way.
- Alpha to white is the default. Authored in TrueVision first; ValeVision gets
  it once this is signed off.

**HOW THE CONTROLS READ**
- DIRECTION is the way the gradient travels from start to end, anticlockwise like
  a protractor and like Adobe's gradient tools: 0 left to right, 90 bottom to
  top, 180 right to left, 270 top to bottom. A slider and a number box kept in
  step, and a preview swatch over a checkerboard so the alpha end reads as
  see-through rather than as white.
- BLEND is where the two ends meet half and half along the direction - the
  midpoint diamond on an Illustrator gradient. 50% is an even fade; lower brings
  the end colour in sooner, higher holds the start colour longer.
- ALPHA is a tick on each end. Only one end can be alpha: ticking one gives the
  other its colour back, because alpha to alpha would paint nothing.
- The gradient is FITTED TO THE SHAPE. The start colour lands on the outline's
  furthest point back along the direction and the end colour on its furthest
  point forward, so the fade spans the whole polygon at any angle.

**HOW IT SITS BESIDE FILL AND EDGES**
- A gradient IS the fill. Switching it on switches the solid fill off, and the
  other way round.
- It counts as the fill for the either-or rule. Edges off with a gradient on
  leaves the gradient alone - that is the fade - instead of bringing a grey
  solid fill back; gradient off with nothing else left brings the edges back.
- The settings outlive the toggle, so a gradient switched off and on again comes
  back as it was rather than starting over.
- A two-point line hides the toggle, exactly as it hides Fill.
- A gradient hits for selection across its whole area, alpha end included. Lock
  its layer to click through a fade to the viewport underneath.

**WHY AN ALPHA END DOES NOT FADE THROUGH GREY**
- The ends are mixed with premultiplied alpha. A transparent end contributes no
  colour, which comes to the same thing as borrowing the solid end's, so alpha to
  white is white at a falling opacity all the way along. Mixing a stored colour
  straight through transparency puts a grey band through the middle of a fade -
  the classic halo - and the tests pin that it does not happen.

**THE PDF, AND THE TRAP IN THIS JSPDF BUILD**
- A PDF shading cannot carry transparency, so the PDF gets the gradient as a thin
  strip image with an alpha soft mask, turned to the direction by jsPDF's own
  image rotation and clipped to the shape's outline. The outline stays a true
  vector edge. It paints in three passes: any solid fill, the gradient, then the
  edges on top.
- IT HAS TO BE A PNG. jsPDF 4.1.0's raw RGBA image path returns the alpha under a
  key its image writer never reads, so the soft mask is dropped without a word and
  every fade would print as a solid white block. The strip is encoded as a PNG,
  whose path builds the soft mask properly.
- Screen and paper come from one colour function. SVG has no midpoint hint, so an
  uneven blend is written out as 32 stops spaced in equal steps of colour rather
  than equal steps of distance.

**ONE DRAG IS ONE UNDO STEP**
- The Blend and Direction sliders redraw the shape silently on every input event
  and announce once on release, so a drag from one end to the other is a single
  history step rather than one per pixel.

**VERIFIED**
- 19 checks on the maths in Node: the defaults, the borrowed colour, the blend
  midpoint landing exactly, stop ordering, the both-alpha refusal, angle
  wrapping, the direction at 0, 45, 90 and 270 degrees, unique SVG ids and
  degenerate shapes painting nothing.
- In the app on PS01's PD Drawing sheet: the toggle, the either-or rules, alpha
  exclusivity, live slider redraws with no history step until release and exactly
  one after, and the record, the panel and the SVG agreeing.
- A test PDF through the exporter's own draw path, rendered back with pdf.js
  beside the screen SVG over a checkerboard: eleven sampled pixels match within 2
  levels in 255, the soft masks and clips are present, a solid fill shows through
  an alpha end and the edges sit on top. The sheet was restored to its loaded
  state and its browser draft cleared.

**WIRING**
- New: `Na__LayoutEditor__GradientTool__.js` (`Na__LeGrad__`) and
  `Na__LayoutEditor__GradientTool__Config__.json` - the record, the colour curve,
  both painters, the panel preview and the Vectors panel rows.
- New record key `Shape__Gradient` on a shape: null for none, otherwise
  `Gradient__StartColour`, `Gradient__StartOpacity`, `Gradient__EndColour`,
  `Gradient__EndOpacity`, `Gradient__BlendPct` and `Gradient__AngleDeg`. It lives
  inside `Sheet__Shapes`, so no new top-level key; older records read as none.
- Touched: the Vectors panel, sheet chrome (both painters), shape geometry (push
  and hit test), sheet records, sheet model, sheet tools (defaults), shape tool,
  eyedropper (the gradient travels, null included), mode controller (config
  ready) and the panel stylesheet. Nothing outside `51__System__LayoutEditor`.

**AFTER SIGN-OFF (13-Sep-2026)**
- The gradient rows moved last in the Vectors panel, after the fills and Closed,
  so opening the block moves no other control.
- A rectangle (R) takes the gradient default as well as the fill. It built its
  shape from the Vectors panel defaults but never passed the gradient, so one
  drawn with Gradient on came out with no fill. The ValeVision port found it, and
  both apps carry the fix (`Na__LayoutEditor__RectangleTool__.js` 1.0.1).
- Ported to ValeVision3D v2.26.0 by replaying this commit's edits there.

# ---------------------------------------------------------
## TrueVision3D v2.28.0  -  13-Sep-2026
### Viewports Copy, Paste and Snap Into Line - Set One Up Once, Line Them Up by Their Corners

**Overview**
- Two changes to how viewports are handled in the Layout Editor, both authored in
  TrueVision first. ValeVision gets them once they are signed off.
- COPY AND PASTE. Ctrl+C copies the selected viewport, Ctrl+V pastes it as a new
  one and Ctrl+D duplicates it in one step. The right-click menu offers all three.
  The paste has a fresh id and a new name, and every other setting of the one it
  came from: scene, scale, crop, window, render composites, model layers, edge
  styles.
- MOVE BY A POINT. With the Select tool, hover a 2D viewport's linework and the
  snap marker shows the corner a press would carry it by. Drag, and that corner
  snaps onto the corners of the other drawings on the sheet - or, having rested
  on one of them first, locks level with it or plumb below it along a dashed guide.

**WHY A PASTE CHANGES ONLY THREE THINGS**
- Setting a viewport up is the slow part of a sheet. A copy that dropped half its
  settings would only move the work somewhere else, so the record is copied whole
  and only the id, the name and the position are new.
- WHERE IT LANDS. On the sheet it was copied from, 10 mm down and right of the
  original, and again past every copy already there, so repeated pastes fan out
  instead of stacking invisibly. On another sheet, in the same place, so a viewport
  set up once sits in the same spot on every sheet of a set. From the menu on bare
  paper, with its corner where the click was. Always kept on the paper.
- THE NAME. "Elevation 2" pastes as "Elevation 2 copy", then "Elevation 2 copy 2",
  unique on the sheet. A copy of a copy does not become "copy 2 copy".
- THE NAME IS A PLACEHOLDER. Choose a different scene for the copy in the Viewport
  panel and the copy name is cleared, so the caption follows the new scene instead
  of reading "Elevation 2 copy" over the east elevation. A name typed by hand is
  never touched.
- A COPY ARRIVES UNLOCKED, because the next thing done to it is always moving it.
- The 3D snapshot reference travels with the copy. The stored picture is keyed on
  what the camera saw, not on the viewport, so a 3D copy shows at once instead of
  rendering again.
- ONE PASTE IS ONE UNDO STEP. Ctrl+Z takes it off the sheet, Ctrl+Y puts it back.

**MOVING BY A POINT, THE CAD WAY**
- Grabbing the frame and nudging by eye is how two drawings end up almost, but not
  quite, in line. A viewport now moves the way a block does in CAD: by a base point
  on its own drawing, dropped exactly on a point of another.
- Nothing that already owned a press gave anything up. A handle still crops,
  content editing still pans, a lock still refuses, and a press that is not on a
  linework point still moves the frame the old way.
- THE CARRIED FRAME GOES TO MULTIPLY while it moves, so the drawing underneath
  shows through it and its corners can be aimed at.
- TRACKING. Laying one elevation over another is rarely the goal; lining them up
  side by side is. Rest the cursor on a corner of the other drawing for a moment -
  a small cross marks it - then carry: whenever the carried corner comes level with
  it the move locks onto that line and a red dashed guide shows it, and plumb below
  it, a green one. This is AutoCAD's object snap tracking. Resting is what acquires
  a point; merely crossing one does not, so the pointer's route to the grab never
  litters the sheet with references. The points are used up by the move they were
  acquired for, and Escape clears them.
- SHIFT holds the carry to the nearer axis. Snapping off (F3) turns all of it off.
- The corners come from the projected linework, so a viewport needs Projected
  Linework on to be carried by a point.

**CTRL+Z NO LONGER GOES MISSING AFTER USING THE PANEL**
- Choosing a scene in the Viewport panel left the focus on the select, and every
  shortcut was ignored while a form control had the focus - so Ctrl+Z straight
  afterwards did nothing. A text field still keeps every key. A select or a
  checkbox now passes Ctrl+Z, Ctrl+Y, Ctrl+C, Ctrl+V and Ctrl+D through to the
  sheet, and keeps its own arrows and letters.

**VERIFIED**
- In the app on PS01's PD Drawing sheet with pointer and key events, R2 writes
  blocked for the run: a paste matches its original field for field apart from id,
  name and position; undo and redo; a duplicate of a copy is named "copy 2"; the
  menu paste lands at the click; the scene change hands the name back; Ctrl+Z works
  from the focused select while a bare letter is still left to it; a carried corner
  lands on Elevation 1's corner to the full floating-point value; tracking holds the
  carried corner exactly level with an acquired one; Shift holds the axis exactly;
  snapping off gives back the plain move; Escape clears tracking points. The sheet
  was put back to its loaded state afterwards.

**WIRING**
- New: `Na__LayoutEditor__ViewportClipboard__.js` (`Na__LeClip__`) and
  `Na__LayoutEditor__ViewportSnapMove__.js` (`Na__LeVpMove__`).
- Touched: the sheet model (`InsertViewport`), snapping (`FindOnViewport`, a viewport
  exclusion in `Find`, one shared per-viewport search), the sheet tools (hover,
  press, drag, release, keys, menu, the focus rule), the Viewport panel (the name
  hand-back), the key map and its fallback (`Edit__Copy`, `Edit__Paste`,
  `Edit__Duplicate`), the config (a Clipboard block, five Snapping keys, six labels)
  and the stylesheet. No record field was added: a paste is an ordinary viewport.

# ---------------------------------------------------------
## TrueVision3D v2.27.0  -  13-Sep-2026
### The Rectangle Tool - Corner to Corner, Then It Is Just a Polygon

**Overview**
- A new Layout Editor tool on the R key, beside Draw on the toolbar. Two
  corners instead of four sides: click one corner and then the opposite one,
  or press on one corner and drag to the other. Shift keeps it square.
- What it draws is an ordinary vector. The moment the second corner lands the
  rectangle is a closed four-point shape like any the Draw tool makes: the
  Select tool drags its corners one at a time by their grips, the Vectors panel
  restyles it, the eyedropper matches it and the PDF prints it.
- Authored in TrueVision first; signed off and ported to ValeVision the same day
  (ValeVision v2.25.0).

**NO NEW KIND OF RECORD**
- The rectangle is written through the same `CreateShape` call the Draw tool
  uses, with the same Vectors panel defaults - edge colour, edge weight, edges
  on or off, fill. There is no rectangle flag on the record, so nothing that
  reads `Sheet__Shapes` had to learn one, and ValeVision will read these
  records unchanged.
- Once drawn it is deliberately NOT kept rectangular: drag a corner and it
  becomes a quadrilateral, exactly as a polygon would.

**NOTHING IS WRITTEN UNTIL THE SECOND CORNER LANDS**
- The Draw tool creates its shape silently on the first click, because a
  polyline is built one vertex at a time. A rectangle is known whole the moment
  its second corner is, so this tool previews with a dashed rubber box on the
  handles layer and creates the shape in one announced call.
- That buys three things. An abandoned rectangle leaves nothing to delete or
  undo. The browser draft never catches a half-drawn one. And the preview can
  never snap to its own corners now that the sheet's vectors are snap
  candidates - a record-based preview would have had three corners chasing
  the cursor.
- One call is one undo step per rectangle, and the new rectangle is selected as
  it lands, so its grips show and the Vectors panel edits it at once. The tool
  stays up for the next one.

**BOTH WAYS OF DRAWING**
- Click-and-click is how the Draw tool already works; press-and-drag is what a
  hand does by instinct with a rectangle. Both work, which makes this the one
  placing tool that is handed the pointer RELEASE as well as the press and the
  move. The stage captures the pointer for it, so a drag that leaves the stage
  still lands its corner.
- A second corner with no width or no height is not a corner: the tool keeps
  waiting instead of writing a flat shape, so a double click cannot leave a
  sliver. The minimum is the select tool's drag threshold at the current zoom.
- Both corners snap, to the linework and to the sheet's own vectors. With Shift
  the square is sized on the longer side, and the snap marker is taken away if
  squaring pulls the corner off the snapped point rather than marking a point
  the corner is not on. The box goes solid while Shift holds it square, the way
  the rubber band goes solid under an axis lock.

**GETTING OUT**
- Escape, Space, a right click, a second finger or picking another tool
  abandons a half-drawn rectangle.
- The arrow keys are swallowed while one is being drawn: there is no axis to
  lock, and nudging whatever was selected before it would be a surprise edit.

**WIRING**
- New: `Na__LayoutEditor__RectangleTool__.js` (`Na__LeRect__`).
- Touched: the sheet tools (tool slot, press, move, release, cancel, arrows, the
  R case), the toolbar button, `Na__LeGrips__ShowBox` / `HideBox`, the rubber
  box rule in the main stylesheet, the key map and its built-in fallback, and
  the labels (`ToolRectangle`, `ToolRectangleTitle`, `ShapeRectangleNote`).
  Nothing outside `51__System__LayoutEditor`.
- The R binding lives in `Na__LayoutEditor__KeyMappings__.json` with every other
  binding. Its modifiers match exactly, so Ctrl+R still reloads the page.

**Verification**
- Rectangle tool harness against stubbed dependencies: 41 checks - both drawing
  modes, flat and too-small corners, Shift in all four quarters, snapping of
  both corners, the marker hidden when squaring leaves the snap, cancel, a lost
  release, another pointer's release, the zoom-scaled minimum, live defaults.
- In the app on PS01's A2 sheet, with real pointer and key events on the stage:
  20 checks - R picks the tool, the box stretches and nothing is written
  mid-draw, both modes land the right corners with the panel defaults, the new
  shape is selected with four grips, Shift lands an exact square, Escape and a
  right click abandon, the arrows do not nudge mid-draw, Ctrl+Z removes exactly
  one rectangle, and the Select tool drags one corner while the other three stay
  put. R2 writes were blocked for the run and the sheet was undone back to where
  it started.
- Every edited module parses and both edited JSON files are valid.

# ---------------------------------------------------------
## TrueVision3D v2.26.1  -  13-Sep-2026
### Vectors Redraw, the Click Stops Waiting on the Disk, and Vectors Snap to Vectors

**Overview**
- First test of the eyedropper on two vectors: several clicks, no visible
  change, and deleting a vector took seconds to show. Snapping also had
  nothing to offer a line drawn on open paper. Three separate faults, fixed at
  the root rather than worked around in the eyedropper.

**THE REAL BUG: VECTORS WERE NEVER ROUTED TO A REDRAW**
- The model announces each change with a reason - `annotation`, `dimension`,
  `shape` and their plurals. The mode controller turned text and dimension
  reasons into a markup redraw. It had no line for `shape` or `shapes`.
- So a vector edit did everything except appear: the record changed, the undo
  stack took a step, the sheet was marked dirty - and the paper kept showing
  the old picture until some unrelated edit happened to repaint it.
- That one gap was the whole of the complaint. The eyedropper painted the
  vector on the first click; it only LOOKED like it needed several. A deleted
  vector was gone at once; it only LOOKED like the delete took seconds.
- The markup reasons are now one named list, with a note that every markup kind
  must be in it, because this failure mode reads as "slow" rather than "wrong"
  and is easy to reintroduce with the next kind.
- Direction checked while in there, and it was always right: B, click the object
  that looks right, click the object that should match - the second takes the
  style of the first.

**EVERY CLICK WAS WAITING ON THE DISK**
- The browser draft (crash insurance for unsaved sheets) was written INSIDE
  every change: every sheet in the project stringified and handed to
  localStorage, which is a synchronous disk write on the main thread. Each
  delete, nudge and style paint queued behind it before the browser could paint
  the result.
- It is now written 600 ms after the editing pauses, and flushed when the tab is
  hidden or closed, so it protects exactly as much work without sitting in the
  click. A write still queued when another project loads is dropped rather than
  written over that project's own draft. `DraftDebounceMs` in the config.

**ONE REBUILD PER FRAME, NOT PER POINTER EVENT**
- A markup redraw rebuilds the whole SVG layer as a string and swaps it in.
  Dragging a shape asked for one on every pointer move - several hundred a
  second on a high-rate mouse, for a screen that shows sixty - and several
  listeners reacting to the same change each asked again.
- Surface refreshes are now booked onto the next animation frame and merged, so
  any number of requests in a frame cost one rebuild. `RefreshNow` remains for
  anything that needs the DOM correct before its next statement; nothing does
  today. Leaving the editor or changing sheet cancels a booked frame.
- The drawing tabs were also rebuilt on every change. They now rebuild only
  when a tab would look different, which also stops a model change from wiping
  out a half-typed sheet rename.
- A text, dimension or vector change refreshes only its own panel instead of
  all eight. Viewport changes still refresh everything, because three panels
  describe the selected viewport.
- Undo is untouched: still one step per announced change, so painting five
  vectors is still five undos.

**VECTORS SNAP TO VECTORS**
- Snapping only knew the projected linework inside 2D viewports. A line drawn on
  open paper had nothing to hold, and closing a polygon exactly was luck.
- The sheet's own vectors now offer every vertex and every edge midpoint (a
  closed shape includes its closing edge), and dimensions offer the two points
  they measure, so dimensions chain. Hidden layers offer nothing; locked layers
  still do, because locked means "don't change me", not "don't line up with me".
- Endpoints beat midpoints on a near tie as before. Between the two sources the
  closer point wins; on an exact tie the sheet's markup wins, because it is
  drawn on top.
- THE THING BEING MOVED NEVER SNAPS TO ITSELF. A dragged vertex skips itself and
  the midpoints of the two edges it drags; a dragged dimension end skips that
  end. Without this the point snaps to where it already is and chases the cursor.
- The shape being drawn skips only the vertex just placed. Its first vertex is
  now a real snap target, so a polygon closes exactly on it and a rectangle's
  last corner can borrow the first corner's coordinate on bare paper.
- A linear scan of the live records rather than an index, deliberately. The draw
  tool adds each vertex silently, so an index would be stale at exactly the
  moment it matters. Measured: 0.09 ms per pointer move with 500 vectors
  (4,000 vertices) and 200 dimensions. `SheetObjects` in the snapping config.

**Verification**
- Snapping harness against stubbed dependencies: 29 checks, including exclusion,
  layers, zoom-scaled radius, source priority and the cost figure above.
- Eyedropper harness re-run: 52 checks.
- Every module in the Layout Editor folder parses and every JSON file is valid.

# ---------------------------------------------------------
## TrueVision3D v2.27.0  -  13-Sep-2026
### Edge Styles - Walls Black, Windows Grey, Furniture Faint

**Overview**
- Projected linework in a 2D Layout Editor viewport now draws each SketchUp
  category in its own colour, line type and weight. Walls and roofs are black at
  full weight, openings and fixtures step back to dark grey, furniture and
  planting sit at mid and light grey - a depth cue the drawing gets for free.
- Every new viewport starts from config defaults, so nobody has to set this up.
  Someone curating a sheet can override any category in any one viewport.
- The Render Composites layers gained line weights, and the 2D profile outline
  width moved out of the main app config into them.
- The controls sit behind a small Advanced fold under each section title.
  Folded, both panels look exactly as they did.
- Authored in TrueVision. Signed off by Adam on 13-Sep-2026 and ported to
  ValeVision the same day: the Render Composites weights as ValeVision v2.28.0,
  the edge styles and owner tags as ValeVision v2.30.0.

**THE PROJECTION USED TO FORGET**
- An edge was found on a wall, clipped for occlusion, and landed in one merged
  `visible` buffer with every other visible edge in the model. By the time
  anything drew, the wall and the sofa were the same array.
- New `Na__ProjectedLinework__Owners__.js` gives every category a small integer,
  and every stage now carries one per EDGE, then one per SEGMENT: the sampler's
  section crossings, the authored-linework walk, the edge extractor, the cut
  split, the view transform, the clip kernel, the worker protocol and the pool
  merge. A clipped edge that becomes three visible pieces stamps all three.
- The tags ride on the classes object as NON-ENUMERABLE properties, so every
  existing consumer sees exactly the four arrays it saw before. The segment count
  uses `Object.keys`; an enumerable fifth key would have reported NaN segments.
- One owner table per COLLECTION, built from the instance list in order. Stage
  edges are extracted per view but intersection lines are cached per collection;
  separate tables would have drawn walls in the roof style.
- A junction line where a wall passes through a roof is tagged as instance A, the
  same frame its coordinates are pushed in.

**THREE CONFIG FILES, ONE SMALL ALPHABET**
- `Na__LayoutEditor__EdgeStyles__Config__.json` (new) - the vocabulary only. Six
  greys from the SSOT edge materials (`Na__DataLib__CoreIndex__EdgeMaterials__.json`,
  its own AssemblyStudioEdgeColourSwatchKeys set), each an alias carrying its MTE
  key for traceability. Seven line types as paper-millimetre dash patterns: solid,
  dashed, dashed fine, centre (long-short-long, for steelwork), centre fine,
  phantom, dotted. Weight bounds 0.10 to 3.00.
- `Na__LayoutEditor__ModelLayers__Config__.json` (1.0.0 -> 1.1.0) - every row gained
  `Layer__EdgeWeightFactor`, `Layer__EdgeColour` and `Layer__EdgeLineType`. Walls,
  floors, roofs 1.00 black; windows and doors 0.80 dark grey; stairs 0.90 soft black;
  fixtures 0.75 dark grey; furniture 0.50 mid grey; decor 0.50 light grey; site
  boundaries 0.75 soft black DASHED. Existing carries the same values as Proposed,
  as agreed - lighter retained work is a drawing decision, one row each.
- `Na__LayoutEditor__RenderComposites__Config__.json` (new) - one row per layer in a
  viewport's picture. The Render Composites panel is now built from it.

**THE RECORD: CURATION ONLY, WRITTEN OUT IN FULL**
- `Viewport__ProjectedEdges` stores ONLY the categories someone restyled, each in
  full: human label, weight, colour, line type. A project file can be audited
  without cross-referencing two configs. Visibility is NOT in it; that stays in
  `Viewport__ModelLayers`, so each fact has one home.
- The normaliser coerces every value into something the palette contains and
  DELETES an entry that has come back round to the config default, so the file only
  holds real decisions. It waits for both configs before pruning; pruning against
  the built-in fallback would delete a deliberate "draw windows black".
- `Viewport__CompositeWeights` is a flat key-to-number map under the same rule.
- An uncurated viewport carries neither field, so an ordinary project file is the
  size it was.

**WHERE A LINE'S WIDTH COMES FROM**
- paper width = sheet master (`Sheet__Lineweights.ViewportPt`) x class ratio
  (unchanged) x Projected Linework composite weight x Hidden Lines composite weight
  (hidden class only) x category weight factor.
- Raising the master still thickens the whole drawing, and the hierarchy survives.
- Category styles apply to visible, hidden and authored lines. The section outline
  keeps its class colour and weight, because a cut reads as cut material whatever
  was cut. `Classes__AppliesToClasses` changes that without code.
- `solid` on a hidden line means "keep the class dash".

**PAINTING IN BANDS**
- A tagged class is bucketed by RESOLVED STYLE, not by category: thirty categories
  that land on black-solid-1.0 are one path. One lookup per owner id, not per
  segment. The heaviest band draws last, so corners read right.
- The PDF exporter draws the same bands, so paper matches screen.
- Restyling changes the paint, never the projection. The style token is in the path
  cache and the repaint guard, and deliberately not in the linework cache key.

**THE FIRST CUT WORKED ON ONE MACHINE AND NOT THE OTHER**
- Adam tested it and every edge style control did nothing. The owner tags were only
  threaded through the CPU backend, and `auto` sends a plain elevation to WebGPU
  wherever the hardware probe grants an adapter - which his workstation (NVIDIA
  Ampere) does. The vendored GPU generator returns one merged buffer with no
  provenance, so the painter had nothing to style. The verification browser has no
  GPU, so it ran the CPU path and passed. The render log's `edges: 0` was the tell.
- THE FIX IS A SECOND CORRECTNESS RULE in `Na__PlProjector__ResolveBackend`, beside
  the cut rule: every render the pipeline KEEPS runs on the CPU. Kept means the
  drawing on screen, every Layout Editor viewport, the browser cache and the R2
  bake, and they share one cache, so one untagged result poisons all of them. Only
  an explicit backend override - how Run Diff asks, and Run Diff keeps nothing -
  still gets the GPU.
- The bake had been rendering with `auto` too, despite the WebGPU module's note that
  bakes stay on the CPU. On that workstation, Save Elevations would have put
  untagged linework on R2. It cannot now.
- UNTAGGED IS STALE. Persistence refuses a block without owner runs (the GPU renders
  from that first test were already in the browser cache) and never writes or bakes
  one, and the Layout Editor treats an untagged in-memory result as a miss. A reload
  heals it; no cache clear is needed.
- The cost is the GPU speed-up for plain elevations drawn on screen. On PS01 the GPU
  took 2.6 s for Elevation_001, and the CPU pool is in the same range at that size.
  The GPU path's own notes (single precision, a 128 MB buffer per call, stalls in a
  background tab) already made it the less dependable of the two. The Dev menu says
  "cpu - tags every line" and labels the other backends "Run Diff only".

**THE 2D OUTLINE WIDTH MOVED**
- `RenderEffect__ProfileLines__Drawing2dEdgeWidth` (0.55) is gone from
  `Na__AppConfig__Main.json`, with a note where it was. For viewports the bake width
  is the profileLinework row's weight (1.0 px - see the correction below),
  overridable per viewport. The Section Outline weight (2 px) is applied per viewport
  bake as well. Both are screen-space widths, set for one render and put back
  afterwards, the same way the profile pass's enabled flag already was.
- Only the PIXEL weights enter the underlay cache key. A factor weight thickens the
  vector drawing and changes no pixel of the render behind it.
- CORRECTED IN v2.30.2: this entry first set the weight to 0.55 and called it "the
  same number" as the main-config key. It was not. That key only ever reached the
  live floor plan and elevation views; TrueVision never registered the main config
  with the drawing view, so every bake before this version drew at 1.0, and 0.55
  would have thinned every new underlay. The composite default is now 1.0. The
  drawing view's own fallback is 0.55, which is the live views' width, and v2.30.2
  wires that config in.

**THE ADVANCED FOLD**
- A small toggle under the section title. Folded, both panels are unchanged.
- Model Layers: colour (with a swatch), line type and weight inline in every row
  between the name and the checkbox, column headings once above the list, a reset
  per row, and Reset Styles for the whole viewport. Hidden for a 3D viewport, which
  has no projected linework to style.
- Render Composites: a weight beside every composite that draws a line, with its
  unit (x for a factor of the master, px for a buffer width). Section Outline
  appears only inside the fold, because a weight is all it has.
- A restyled row is marked in blue with its reset button showing.
- Each label now names its checkbox explicitly. With three controls between the
  name and the checkbox, an implicit label adopted the first of them, so clicking
  "Walls" opened the colour dropdown.
- Panel max width 520 -> 680 px, for room while curating.

**BAKED LINEWORK RE-RENDERS ONCE**
- Asset schema 1 -> 2: owners stored as [ id, count ] runs per class, with the key
  table in Meta.OwnerKeys - a few hundred runs rather than one integer per segment.
- A v1 asset is refused and re-rendered. It cannot say which category any line
  belongs to, and restoring it would quietly ignore every edge style.

**Files**
- New: `50/Na__ProjectedLinework__Owners__.js`, `51/Na__LayoutEditor__EdgeStyles__.js`
  and its config, `51/Na__LayoutEditor__RenderComposites__.js` and its config.
- Projection: StageSampler, AuthoredEdges, EdgeExtractor, ClipKernel, ClipWorker,
  WorkerPool, CpuBackend, Projector, Persistence, DevMenu Controls, AppConfig.
- Layout Editor: ModelLayers and its config, SheetRecords, SheetModel, Viewport2d,
  PdfExporter, SnapshotRenderer, PanelHost, Panel Styles, Panel ModelLayers,
  ModeController (waits for both new configs), Styles Panels css, AppConfig.
- Drawing core: `Na__DrawView__ConfigState__.js` (fallback), `Na__DrawView__AppConfig__.json`.
- Main config: `Na__AppConfig__Main.json`.
- `PWA_SW_VERSION_TOKEN` was already bumped to `2026-09-13-1` in the working tree
  alongside v2.26.0, which covers this change too.

**Verification**
- Node, on the shipped kernel and owners modules: 9 tests pass. One tag per emitted
  segment in edge order; shards tag only their own range; tags survive sink growth
  past 70,000 segments; the min-length filter drops a segment and its tag together;
  tags are invisible to Object.keys and JSON; a mismatched buffer is refused.
- Static linkage check: 994 named imports across the 78 modules in 50 and 51, none
  missing. It was added after `node --check` passed a PanelHost that did not export
  the Advanced fold, which broke the whole editor on load.
- In the app on PS01, CPU path, read-only load, nothing saved: both elevation
  viewports projected tagged, with every segment owned (Viewport 1: 3,984 segments
  across 10 categories, none unknown). Eight bands per viewport where there had been
  one path per class, and widths exact against the maths: a 0.30 pt master at 1:50
  gives walls 5.29, windows and doors 4.23 (0.80), fixtures 3.97 (0.75), landscape
  3.17 (0.60), with authored lines keeping their 0.8 class ratio inside every band.
- Per-viewport overrides: fixtures set to centre line painted `400 100 100 100`
  (8,2,2,2 x 50), walls at 1.40 painted 7.41, existing windows went light grey, and
  the other viewport stayed untouched. A Projected Linework weight of 1.5 on the
  second viewport scaled every band there and nothing in the first. The record held
  exactly the three categories, in full. Reset pruned both viewports back to no
  field and the SVG came back byte-identical, and restating a default pruned itself.
  The PDF exporter's band list matched the screen band for band.
- Panel: six SSOT colours, seven line types, weights inline; restyled rows marked with
  reset showing; the label still toggles its checkbox; folded, no advanced control
  visible. Render Composites shows x and px weights, with Section Outline only
  inside the fold.
- GPU fix: kept elevation and plan renders resolve to cpu, and Run Diff's overrides
  are honoured. A poisoned cache (an untagged copy of real linework planted in the
  pipeline) was refused by persistence and healed to a tagged result on the next
  repaint, with the category bands back. The GPU route itself needs Adam's machine.
- Backing layer: a Profile Linework px change re-rendered that viewport's underlay
  and not the other's; a factor weight did not re-render it; the global section width
  was restored after the bake.

**ValeVision**
- Not ported. Awaiting Adam's re-test and sign-off on TrueVision first. ValeVision's
  `auto` backend has the same GPU route and needs the kept-render rule as well as
  the owner tags.

# ---------------------------------------------------------
## TrueVision3D v2.26.0  -  12-Sep-2026
### The Eyedropper - Make That One Look Like This One

**Overview**
- A new Layout Editor tool on the B key. Click the object that already looks
  right, then click every object that should match it. The picked style stays
  on the dropper, so the second, third and fourth target each cost one click.
- Text, dimensions and vector shapes. Viewports are deliberately left out while
  the new viewport system is being built; the hook for them is cut and
  documented in the module header.
- Authored in TrueVision first. ValeVision gets it once this is signed off.

**WHAT TRAVELS, AND WHY THE LIST IS SHORT**
- The whole tool turns on one split: STYLE travels, CONTENT AND GEOMETRY DO NOT.
  A text's words, a dimension's span and a vector's points belong to that object.
  Copy those and you have not restyled anything, you have overwritten it.
- Text carries size, weight, colour and alignment. A dimension carries text size,
  colour, terminator, precision and unit suffix. A vector carries edge colour,
  edge weight, edges on/off and fill - where a null fill is a real value that
  clears the target's fill rather than being skipped as missing.
- THE DIMENSION OFFSET IS NOT A STYLE. It is where the dimension line sits, so
  copying it moves the target instead of restyling it. There is a config flag for
  offices that want it; it ships off.
- THE LAYER NEVER TRAVELS, in any kind. A layer is where a thing lives, not how
  it looks, and shuffling objects between layers behind a style click would be
  the most surprising thing this tool could do.
- All of that lives in ONE trait table at the top of the module. The extractor
  and the applier are generic and know no field names, so a new trait is one
  line and the viewport expansion is an entry, not a rewrite.

**KINDS DO NOT MIX**
- A dimension style cannot land on a text. The two share almost no traits, so a
  cross-kind paste would be a silent partial one - a few fields landing, most
  not - and a refusal that says why is worth more than that.
- The refusal is visible before the click, not after: the box under the pointer
  goes red and the cursor turns, so a wrong target announces itself on hover.

**THE THINGS THAT MAKE IT FAST**
- B with something already selected arms the dropper ALREADY LOADED from that
  selection, so the common path - spot the good one, click it, press B, click
  the rest - costs one key and no extra click.
- The tool never selects and never drags. A run of style clicks would otherwise
  keep swapping the right-hand properties panel out from under the user.
- A click on bare paper is ignored rather than treated as "unload". Missing a
  small dimension by two millimetres is common, and losing the picked style to
  that miss would be infuriating. Escape is the way out, one stage at a time:
  it empties the dropper before it clears the selection.
- Alt+click re-picks the source without putting the tool down.
- Copy and Paste properties on the right-click menu drive the same dropper, so
  the tool is reachable without the hotkey and the two paths cannot disagree.

**ONE PAINT IS ONE UNDO STEP**
- Every write goes through the model's own `Update` call, non-silent, exactly as
  a panel edit does. Painting five items is therefore five undos rather than one
  lump - which is what you want when the fourth one was a mistake.
- The held style is a snapshot taken at pick time, not a live reference. Undo the
  source away and the dropper still holds what it lifted.

**WIRING**
- New: `Na__LayoutEditor__Eyedropper__.js` (`Na__LeDrop__`).
- Touched: the key map and its built-in fallback, the config block and its
  getter, the labels, the sheet tools, the toolbar, the stylesheet. Nothing
  outside `51__System__LayoutEditor`.
- The B binding lives in `Na__LayoutEditor__KeyMappings__.json` with every other
  binding, so it is rebindable without touching code. The action catalogue in
  that file also picked up the six actions that were bindable but unlisted.

# ---------------------------------------------------------
## TrueVision3D v2.25.0  -  12-Sep-2026
### Supersampling - The Pixel Stops Guessing

**Overview**
- Every picture the app produces that is not the live viewport is now rendered
  several times with sub-pixel camera jitter and averaged: the still image
  export, the Layout Editor's 2D drawing underlays, and the 3D snapshot that
  sits under every sheet viewport.
- The static exporter has been rebuilt on ValeVision's design at the same time -
  shared tile plan, gutter overscan, canvas probe, context-loss guard - because
  the tile is the unit supersampling is cheap in.

**WHY RESOLUTION WAS NEVER GOING TO FIX THIS**
- A pixel is not a small square of colour. It is ONE measurement taken at one
  infinitely small point and painted as a square afterwards. The renderer asks
  one yes-or-no question per pixel: wall, or glazing bar.
- A line two degrees off horizontal answers "row 100" for thirty pixels and then
  jumps to "row 101". The shallower the line the longer the step - and buildings
  are made of shallow lines: eaves, ridges, cills, transoms, string courses.
  Whitecard is the worst case there is, because aliasing severity scales with
  the contrast across the edge and a black line on a white field with nothing
  else in frame is the maximum.
- Exporting bigger only makes the steps smaller. It never makes them fewer.
- FXAA, which is all the pipeline had, cannot reach it either. FXAA is handed
  the already-broken image and walks along an edge looking for where the step
  ends, giving up after about twenty pixels. A thirty-pixel step outruns the
  search, so the staircase survives and everything is smeared in the attempt.
  Blur without accuracy, which is exactly what the exports looked like.
- Now each pixel is sampled sixteen times from sixteen slightly different camera
  positions and averaged, so a bar covering a third of a pixel lands on five of
  the sixteen and the pixel records a third-of-the-way-to-black grey. The pixel
  has stopped being a yes or no and become a measurement of coverage, and the
  staircase dissolves on its own.
- Measured on a two-degree line: one sample gives 2 grey levels and zero partial
  pixels. Four gives 5. Sixteen gives 17. The count is exact, which is what says
  the jitter pattern is right.

**THE JITTER GOES INTO THE PROJECTION, NOT THE SCENE PASS**
- This is the decision the whole thing turns on. TrueVision's picture is not
  made of geometry, it is made of LINE WORK: the profile-line Sobel, the section
  cut outlines, fog, SSAO. Jittering only the scene render - which is what
  three's own SSAARenderPass does - would have smoothed the walls beautifully
  and left every line as stepped as before. Since the lines are the drawing,
  that would have been close to useless.
- Shifting the projection at the root means every downstream pass inherits it.
- FXAA is switched off while supersampling. It would soften each sample before
  the average, so the result would be sixteen blurred pictures averaged into one
  blurred picture. Removing it is why the output is sharper AND smoother at
  once - those only feel like opposites when blur is the only tool available.

**THE THREE FAULTS FOUND ON THE WAY, EACH WORSE THAN THE ALIASING**
- THE SILHOUETTE SOBEL RAN AT VIEWPORT RESOLUTION AND WAS STRETCHED. The tiled
  renderer resized the renderer for a tile and never resized the profile-line
  buffers, so a drawing baked at 4000 px had its outline computed at 1920 and
  scaled up. That, not the aliasing, was most of the blur people were seeing on
  drawing underlays. Both buffer owners are now resized per tile and restored.
- THE 3D SNAPSHOT NEVER WENT THROUGH THE COMPOSER AT ALL. The tiled renderer
  accepted a pipeline getter for ValeVision signature parity and ignored it,
  falling through to a bare renderer.render. So the base image under every sheet
  viewport had no profile lines, no ambient occlusion, no fog, and a different
  colour transfer from the live view - while the snapshot code carefully toggled
  a profile-lines pass that was never running. It takes the live loop's own
  per-frame sequence now, so a baked viewport matches the screen it came from.
- THERE WAS NO GUTTER. Tiles were rendered edge to edge, so every screen-space
  effect sampled a clamped buffer boundary at the joins. Tiles now carry 32 px
  of overscan that is cropped on composite. Verified: on a 4800 px output the
  worst column-to-column jump does not fall on a tile boundary.

**THE STILL EXPORTER, REBUILT**
- It used to resize the live renderer AND composer to the full requested size
  and render once. At 4096 that is 25 megapixels of half-float ping-pong buffers
  plus a depth pre-pass and two profile-line targets - gigabytes - and when the
  context died the download was a blank PNG with no error at all.
- It now tiles like everything else, never allocating more than about one
  viewport of framebuffer whatever the output size, and it fails LOUDLY: an
  unbackable canvas or a lost context throws a message the overlay shows.
- The supersampling makes the existing high-pass sharpen honest, which is a
  quieter win worth naming. Sharpening exaggerates places where brightness
  changes quickly over a short distance - and a stair step IS one. The filter
  was spending part of its effort making the artefacts more prominent. Given a
  clean source, all of it goes into the drawing.

**COLOUR SPACE, WHICH IS WHERE THIS COULD HAVE GONE WRONG QUIETLY**
- Three applies the sRGB output transfer only when rendering to the canvas,
  never to a render target. A drawing frame diverted into an offscreen buffer to
  be averaged therefore comes out linear, and a straight copy back would have
  washed out every export in the app.
- The present pass applies the transfer for that route only. At one sample the
  result is byte-identical to what the canvas would have received - verified
  swatch by swatch, #404040 to 64,64,64 and #2e6f9e to 46,111,158 - and above
  one sample the average is taken in linear light, which is where averaging
  belongs.
- The composer route needs none of this and gets none: its samples are averaged
  and copied out raw, exactly as the FXAA pass they replace would have done.

**WHAT IT COSTS**
- Linear in the sample count: sixteen samples is sixteen renders. A still is one
  frame, so a 3072 x 2048 export lands in about three seconds.
- Layout Editor viewports take their count from the working quality level, so
  Low stays at one sample for fast drafting, Medium averages four, and High -
  which is also the level the PDF and the Dev bakes always use - averages
  sixteen. Both numbers are config, per level.
- Shadow maps are drawn once per tile and reused by the remaining samples. The
  lights and geometry are frozen and only the view camera moves, so every later
  shadow pass would redraw identical maps.

**NOT DONE, DELIBERATELY**
- The live viewport is untouched. Rendering sixteen times per frame would take
  60 fps to under 4 and there is no version of that trade worth making. The
  progressive refinement version - accumulating samples in the idle time after
  the camera stops, free while interacting - is a real opportunity and a
  separate piece of work.

# ---------------------------------------------------------
## TrueVision3D v2.24.0  -  11-Sep-2026
### The Drawing Editor Arrives - Tabs, Sheets, Viewports at Scale

**Overview**
- TrueVision now has ValeVision's drawing system. Drawing tabs under the header,
  paper sheets from A4 to A1, viewports onto plans and elevations at 1:20, 1:50
  and 1:100, a Photoshop-style layer stack, text, dimensions, vector shapes,
  title blocks, undo, autosave and a true-size PDF.
- Underneath it: the projected linework engine, section cuts that are finally
  RECORDED rather than lost on reload, and a drawing core that matches
  ValeVision file for file.
- Four releases' worth of work in one entry, because they landed together:
  2.21.0 drawing core, 2.22.0 projected linework, 2.23.0 Layout Editor,
  2.24.0 authoring gate. Full detail in the commits and in
  `TrueVision__PLAN__ValeVisionRealign__DrawingSystems__.md`.

**WHERE DRAWINGS LIVE NOW, AND THE MIGRATION THAT MOVED THEM**
- Floor plans and elevations used to be nested inside
  `PresentationMode__SavedCameraScenes`. They are now in a top-level
  `LayoutEditor__DrawingsData` block, because Layout Editor sheets have nowhere
  sensible to live under the presentation block and the two are written by
  different panels.
- The migration is non-destructive: a project's legacy keys are left exactly
  where they are until a save has actually landed the new block, and that one
  write does both. A failed save leaves R2 as it was.
- THREE keys migrate, not two. `__FloorPlans` and `__Elevations` are the obvious
  pair; `__ClientDimensionsEnabled` is a scalar sitting between them and is the
  easy one to miss. Moving two of three would have silently switched client
  measuring off on every project that had it on.
- Run for real on PS01 Musters Road: one plan, one elevation and the flag, with
  the legacy keys cleared in the same write. Nothing lost.

**SECTION CUTS ARE RECORDED, IN VALEVISION'S SCHEMA EXACTLY**
- The section engine had no serialization and no persistence of any kind. A cut
  existed only while the page was open. Survivable for a live 3D toggle and
  fatal for drawings: a section drawing could not reopen with its own cut, a
  sheet viewport had nothing to restore, and the PDF printed an uncut model.
- TrueVision now writes `CrossSection__SceneData` byte-compatible with
  ValeVision's, so a project document from either app is readable by the other.
- Slice depth flattens to ValeVision's single global field. No additive key, no
  superset: two schemas that are ninety-five percent alike are worse than one,
  and the differences are where the bugs live.
- A ROUND-TRIP TEST CAUGHT A SIGN ERROR nothing else would have. positionMm was
  being negated, mirroring ValeVision's line, but the two engines store
  plane.constant with opposite signs for the same normal. Every cut was written
  at minus its own position - a plan at 1200 stored as -1200. It looked entirely
  plausible in isolation.

**THREE THINGS ONLY RUNNING IT FOUND**
- THE CSS VARIABLE RENAME. The port harness rewrote `--Vale_*` to `--Na_*`, and
  TrueVision's own stylesheets use `--Vale_*` - 35 occurrences, a legacy of the
  original port. The sheet detached from `--Vale_HeaderHeight` and rendered
  2649 px tall. Both harnesses passed throughout.
- THE DATA MODULES STILL READ THE OLD PLACE. The migration moved the records and
  the floor plan and elevation modules kept reading the emptied presentation
  key, so a project with two drawings reported none. Their
  `if (!sceneConfig) return []` guards were stale for the same reason - callers
  legitimately pass null now.
- THE RENDER PRESET WAS NEVER INITIALISED. RenderFrame returned false in silence
  and every offscreen bake came back as an untouched BLACK buffer, which reads
  as "the drawing is broken" rather than "nothing was drawn".

**Two new verification harnesses, and why there are two**
- `Na__Verify__ModuleGraph__` proves every FILE resolves, walking the graph the
  way a browser does. `Na__Verify__Exports__` proves every NAME does. Different
  faults, same symptom - a blank page - and the second is the one this port
  throws constantly, because a module asking for a name the other tree renamed
  parses fine, resolves fine, and throws at runtime.
- Both prove themselves by being deliberately broken. The graph walker also
  walks every import map target on its own, because a vendor entry point nothing
  imports YET is invisible to a live-graph walk until the phase that first
  imports it - which is exactly how the clipper2-js fault took ValeVision down.

**Authoring is no longer tied to localhost**
- One gate, `Na__DevGate__IsAuthoringEnabled`, replaces eleven files each testing
  the hostname. It opens on localhost or on a persisted unlock
  (`?authoring=on`, or `Na__DevGate__Unlock()`), because an installable drawing
  app that can only be edited while a Python server happens to be running is not
  a tool.
- It deliberately does NOT decide where project data comes from. The loader
  keeps the raw hostname test: unlocking authoring on the live site must not
  make it start hunting for a repository path that is not there.

**Verified**
- PS01 loads all twelve model categories on r184 and renders. The Layout Editor
  opens with "3D Model | Drawing 1 | +", the viewport scene list is populated
  from the project's own scenes grouped by scene group - including both migrated
  drawings - and adding a plan viewport bakes a 3240 x 2160 underlay through the
  drawing render route with the plan's room labels drawn on the sheet at scale.
- 240 files pass both harnesses; the live module graph is 322 modules.

**NOT verified**
- The PDF has not been exported and measured. A 1:50 viewport printed at 100
  percent measuring true with a ruler is the acceptance test and it has not been
  run.
- Image export, Video Studio, and the section cut tool's drag and flip.
- Offline boot from the service worker cache, and a Windows PWA install.
- Plan viewport framing wants an eye that knows what the drawing should look
  like. The pipeline demonstrably renders; whether the camera frames the plan
  the way a drawing should is a judgement this cannot make for itself.
- Phase C is part done. Ground Floor Plan quick action, Pick Face, the gizmo
  grip, the scene editor splits and sections-filed-by-type are still to come.

# ---------------------------------------------------------
## TrueVision3D v2.20.0  -  10-Sep-2026
### The Renderer Comes In-House - three r184, Vendored

**Overview**
- three.js is no longer fetched from esm.sh. The app now runs a version-locked
  vendor set held in the repository: three r184, three-mesh-bvh 0.9.9,
  clipper2-js 0.9.0 and three-edge-projection 0.0.10, in a new app-root folder
  `04__Lib__ThirdParty__VersionLocked/`.
- This is Phase A of the ValeVision re-alignment
  (`TrueVision__PLAN__ValeVisionRealign__DrawingSystems__.md`). The four vendors
  are copied byte-for-byte from ValeVision, which copied them from the Lantern
  Designer, so all three apps run identical geometry code. That is the thing
  that will let the projected linework and Layout Editor modules port across
  without edits.

**WHY MOVE OFF A CDN THAT WAS WORKING**
- It was not reproducible. esm.sh can change what it serves for a tag, and an
  outage takes the app down with it.
- It could not go offline, which is fatal for an installable PWA. The whole
  point of the install is an app that opens.
- It could not carry the projection stack. three-mesh-bvh and
  three-edge-projection are pinned to a three revision; the exact hidden-line
  work the drawings need does not exist on r160 at all.

**THE TRAP IN THE REPOSITORY THAT ALMOST ATE THE RENDERER**
- `.gitignore` ignores `build/`. The vendored renderer ships as
  `01__Vendor__ThreeJs__v0.184.0/build/three.module.js`.
- Left alone, `git add` stages 575 of 598 files, the push succeeds, nothing
  looks wrong locally, and the LIVE site 404s on the import map. There is no
  local symptom whatsoever, because locally the files are on disk.
- It is worse than one folder: `build/` matches THREE directories in the vendor
  tree, and the third is `three-mesh-bvh/src/core/build/`, holding eight SOURCE
  files that `src/index.js` imports at module load. PlanVision hit this same rule
  once and solved it the same way.
- Negations added, then verified the only way worth trusting: `git add --dry-run`
  stages 598 of 598.

**Verification, and what it caught**
- New harness `80__Testing__PrototypeEnvironment/Na__Verify__ModuleGraph__.mjs`
  reads the import map out of `Index.html` and walks the module graph the way a
  browser resolves it. `node --check` cannot see this class of fault: every file
  parses while the graph as a whole is broken.
- It walks in two passes. The first follows the live app graph. The second walks
  EVERY import map target on its own, because the first pass has a blind spot
  that is precisely the one that took ValeVision down: a vendor entry point
  nothing imports yet is never reached, so its broken specifier stays invisible
  until the phase that first imports it - at which point it breaks every module
  on the page rather than just the new one.
- Proven by breaking it on purpose: deleting the `clipper2-js` map entry is
  caught by pass two and missed entirely by pass one.
- It found one REAL defect and one bug in itself. The bug: three-mesh-bvh heads
  its generated files with `/* This file is generated from "raycast.template.js". */`,
  which reads as an import unless comments are stripped first. A harness that
  cries wolf twice gets ignored the third time, when it is right.

**The real defect, left in place deliberately**
- `three-edge-projection/src/worker/SilhouetteGeneratorWorker.js` imports
  `'../SilhouetteGenerator'` with no file extension, which no browser can
  resolve. It is upstream's bug, and ValeVision has the identical file.
- It is reachable ONLY through the `three-edge-projection/worker` map entry.
  Neither app imports that entry - both use the main entry plus a dynamic
  `three-edge-projection/webgpu`, and the projection system brings its own
  worker pool. Traced rather than assumed.
- Left unpatched to keep the vendor folders byte-identical across the three
  apps, and recorded as a named known issue in the harness so it prints on every
  run and never fails the build. If Phase D ever imports that entry, it breaks
  the page, and the harness says so in as many words.

**Service worker**
- The vendor cache bucket survives, but it is selected by a PATH test now rather
  than by remote origin, and that test runs FIRST in the classifier. Vendor files
  are `.js`, so the shell-asset pattern would otherwise sweep them into the shell
  bucket - which is stale-while-revalidate on the live site, and a half-updated
  three.js is not a thing that can be reasoned about.
- The renderer is precached into the vendor bucket at install. Without it, a user
  who installs and goes offline before ever loading a project gets a dead icon.
  `three.core.js` is listed alongside `three.module.js` because the latter
  imports the former with a RELATIVE specifier; caching only the entry point
  produces an app that boots online and fails offline.
- Token bumped to `2026-09-10-1`.

**One deprecation the upgrade surfaced**
- `RGBELoader` was renamed `HDRLoader` upstream at r180 and now warns on every
  boot. In r184 `RGBELoader extends HDRLoader` and does nothing else, so the swap
  is a rename and no more. Done, and the warning is gone.

**Verified**
- App boots with zero console errors. `THREE.REVISION` reads `184` at runtime,
  from the vendored file, and the vendor path serves 200.
- All ten `three/addons/` paths the app imports exist in r184. The renamed FXAA
  shader still exposes `tDiffuse` and `resolution`. `OrbitControls` extends the
  new `Controls` base and all three construction sites already pass
  `(camera, domElement)`.
- The fat-line depth-bias patch still lands: r184's LineMaterial still contains
  `#include <logdepthbuf_fragment>`, and the chunk still writes `gl_FragDepth`.
  Checked the chunk body, not just the include, because a chunk that survives by
  name and stops writing the variable would make the patch a silent no-op.
- Drawing profile lines harness passes on r184 in full: both cameras, both the
  own-buffer and borrowed-buffer paths, `WebGL error code after all passes: 0`,
  and every piece of renderer state the section overlay depends on handed back
  untouched - background, override material, autoClear, shadowMap.autoUpdate and
  the active render target.
- Confirmed by pixel count rather than by eye, because the off-screen tile reads
  as blank in a screen capture while having rendered perfectly: the flat tiles
  carry 0 dark pixels and the profile-line tiles carry 924 (plan) and 914
  (elevation). Rounded forms gain outlines in both drawing cameras; the box
  control does not change.

**Verified against a real project**
- PS01 Musters Road loads all twelve model categories from the CDN, mesh and
  linework both, and renders correctly on r184: whitecard materials, glazing,
  furniture, ground plane, scene carousel, the Exterior 3D Views group.
- The fat-line linework draws over the mesh without z-fighting, which is the
  depth-bias patch doing its job on r184 rather than merely still compiling.

**Two things that made this look broken when it was not, both worth knowing**
- The project path is gated on BOTH url parameters:
  `?project=PS01&project-folder=PS01__MustersRoad&year=26`. With only
  `project-folder` the app falls through to a default document pointing at
  ValeVision's Clough GLBs, loads zero categories, and reads exactly like a dead
  build. An earlier draft of this entry blamed a missing `/api` endpoint; that is
  the legacy Whitecardopedia path and TrueVision does not use it. Localhost reads
  the repository copy and overlays the dev keys from R2, and both halves work.
- Sampling the WebGL canvas with `drawImage` to check whether a frame rendered
  reports a perfectly good scene as one flat colour, because the renderer runs
  without `preserveDrawingBuffer` and a read outside the render call gets a
  cleared buffer. The screenshot was right and the measurement was wrong. The
  pixel counts quoted above for the profile-lines harness are trustworthy for the
  opposite reason: that harness reads inside its own render.

**NOT verified**
- Image export (viewport and tiled), Video Studio, and the section cut tool's
  add / drag / flip / per-scene restore. All low risk - none of them touch the
  shader surface the upgrade moved - but none has been run.
- Offline boot from the service worker cache. That is the acceptance test for the
  installable PWA and belongs with Phase F, once the authoring gate lands.

# ---------------------------------------------------------
## TrueVision3D v2.19.0  -  07-Sep-2026
### Profile Lines on the Drawings - Round Things Stop Disappearing

**Overview**
- Floor plans and elevations now carry the same SketchUp-style silhouette
  edges the 3D views have had all along. Curved walls, cylinders, bay windows,
  downpipes and every other rounded form were reading as blank patches on the
  sheet; they now have an outline.
- New module `Na__DrawView__ProfileLines__` in `40__System__DrawingViewCore`,
  serving BOTH drawing kinds from one place because both are the same problem.

**WHY A DRAWING LOST THEM IN THE FIRST PLACE**
- The 2D render path deliberately bypasses the EffectComposer. That was the
  right call and stands: fog, SSAO and tone mapping shade a parallel drawing
  like a surface, which is exactly wrong. But the Sobel edge pass lives in that
  same composer, so bypassing the one threw out the other with it.
- Flat shading is what makes a plan read as a drawing, and it is also what
  erases every rounded form on it. A curved wall and the floor behind it
  resolve to the same colour, and the linework GLB has nothing to offer
  because the silhouette of a curve is a TANGENT, not a crease - SketchUp
  never exported an edge there because there is no edge there.

**WHAT VALEVISION DOES, AND WHERE THIS DIFFERS**
- ValeVision keeps its composer running in elevation mode and swaps the
  RenderPass camera to ortho. Because its Sobel pass reads a normal buffer
  captured through the PERSPECTIVE camera, it needed an ortho-aware twin of
  the pre-pass writing into the same shared buffers - that is the whole of its
  `Na__RenderEffect__2dProfileLines__`, and the whole reason it exists.
- TrueVision cannot copy that, because routing a drawing back through the
  composer would drag fog and SSAO onto it. So the edge is composited as a
  TRANSPARENT OVERLAY instead: the pre-passes go to their buffers, and a single
  full-screen quad is drawn over the finished drawing with the Sobel coverage
  as its ALPHA. Source-over blending then performs the identical sum the 3D
  shader does with `mix()`:
      out = profileColour * blend + canvas * (1 - blend)
- One quad, no colour capture, no copy, no blit. The beauty pixels are never
  round-tripped through a render target, so no colour space question arises.

**Switching between drawings and 3D scenes**
- No new state machine. `Na__DrawView__ActiveView__` already knows which
  drawing owns the viewport, so flicking through the carousel from an exterior
  render to a plan to an elevation and back needs nothing added: the loop asks
  the broker for a camera, and the branch it takes decides which edge pass runs
  - the ortho overlay, or the perspective one inside the composer.
- The thumbnail renderer takes the same branch in the same order, so a saved
  drawing thumbnail is a picture of the drawing people actually see.

**Buffers are borrowed, not duplicated**
- The pipeline now exposes `profileNormalTarget`, `profileColorTarget` and
  `profileLinesPassRef`. A drawing and a 3D scene can never be on screen at
  the same moment, so the 2D pass writes into the 3D effect's own two buffers
  rather than holding a second full-res pair of them. Own buffers are
  allocated only when profile lines are switched off entirely.

**Three things it does that the 3D pass does not**
- SECTION CLIPPING IS RE-APPLIED BY HAND. Both pre-passes replace materials
  wholesale, and the cut engine assigns its planes per MATERIAL. Without this
  the pre-passes would see a whole building where the drawing sees a slice, and
  ink a first floor's outline over a ground floor plan. A plan is always cut,
  so this is load-bearing rather than defensive.
- THE SCENE BACKGROUND IS SUPPRESSED. A project may back its scene with a flat
  colour or with the HDR environment itself, and either gets painted over the
  clear colour in both pre-passes - a sky texture in a normal buffer reads as
  thousands of edges that are not there.
- SHADOW MAPS ARE NOT RE-RENDERED. Three.js redraws every shadow map on each
  `render()` call and this pass makes two; both draw the scene under an UNLIT
  material, so not one shadow texel can reach either buffer.

**Line width is fixed, and that is the point**
- The 3D effect thins its edges with camera distance to imitate aerial
  perspective. There is no such thing under a parallel projection, and a
  drawing wants a constant line weight on the sheet at any zoom - which is
  what a drawn line has. Set by `RenderEffect__ProfileLines__Drawing2dEdgeWidth`.

**Config**
- Four new keys in the existing `RenderEffect__ProfileLines` block:
  `Drawing2dEnabled`, `Drawing2dEdgeColor`, `Drawing2dEdgeThresholdNormal`,
  `Drawing2dEdgeWidth`. Colour and threshold fall back to the 3D values when
  omitted, so a hand-tuned edge colour is not typed twice and left to drift.
- The existing Dev menu Profile Lines toggle now governs both. Switching it OFF
  while a drawing is open and watching nothing happen would read as a bug, so
  it is one switch rather than two.

**Known limit, by design**
- A face pointing straight at the camera encodes to the same normal as the
  cleared background, so a flat-topped object seen from directly above gains
  no outline from this pass. That is inherent to normal-discontinuity edge
  detection and is exactly how ValeVision behaves; in a plan those outlines
  come from the section cut engine's profile outlines instead. Worth revisiting
  only if plans want every object outlined, which is a different decision.

**Verified**
- New harness `Na__Test__DrawingProfileLines__.html` in the testing folder,
  against a synthetic model of the shapes a flat view actually loses - sphere,
  cylinder, torus, curved wall - with a box as a control, under a live section
  cut. Both drawing cameras, effect off and on, and the borrowed-buffer path
  the real app takes.
- Confirmed: shader compiles, no GL error after any pass, and every piece of
  renderer state the section overlay depends on is handed back untouched -
  scene background, override material, autoClear, shadowMap.autoUpdate and the
  active render target.
- Confirmed by eye: rounded forms gain outlines in both plan and elevation,
  the box control is unchanged in plan, and the cut is respected.
- NOT verified against a real model: local testing has no project API, so no
  GLB loads. Line weight and colour against real linework on a live project
  still want a pass.

# ---------------------------------------------------------
## TrueVision3D v2.18.0  -  07-Sep-2026
### Elevation Drawings - The Same Sheet, Turned on Its Side

**Overview**
- Elevations and vertical sections now exist alongside the floor plans, built
  on the same section cut engine, the same annotation layer, the same
  dimensioning engine and the same flat parallel render.
- An elevation is authored from the Dev menu **Elevations** panel: pick which
  side you are standing on, slide the drawing plane through the model, choose
  Elevation or Section, preview, annotate, dimension, save.
- Floor plan and elevation thumbnails now capture the DRAWING rather than the
  3D model, and both panels gained a **Save Thumbnail** button.

**AN ELEVATION IS TWO NUMBERS AND A MODE, NOT A PICKED FACE**
- This is the whole difference from the ValeVision elevation tool, and it was
  the point of rebuilding rather than porting. That tool made you click a
  building face and then drag a translucent plane along its normal. Three
  things were wrong with it: picking depends on there being a suitable face to
  hit, dragging gives no numeric feedback at all, and neither survives the
  model being re-exported with different geometry.
- Here the inputs are:
      AZIMUTH  - the compass bearing of the side the viewer stands on
      ORIGIN   - a world X/Z point the vertical drawing plane passes through
      MODE     - elevation (nothing is cut) or section (the plane bites)
  Everything else - the clip plane, the camera pose, the framing, the drawing
  axes - is derived from those in ONE place, Na__ElevData__GetAxes and its
  neighbours. An elevation is therefore reproducible, type-able and diffable,
  and re-exporting the model cannot silently move it.
- The plane gizmo survives from the old tool but its role is inverted: it is a
  READOUT, not a handle. It appears when you touch a row, follows the sliders
  live, and is removed entirely the moment the drawing opens.

**Why the two sliders have a third number under them**
- Moving the plane along X and along Z do not contribute equally: for a north
  elevation only the Z slider changes where the cut lands, and for an east
  elevation only the X one does. A slider that visibly does nothing is worse
  than no slider, so the derived depth - the plane's distance along the view
  axis - is shown live beneath them.

**ONE DRAWING SUBSTRATE, TWO DRAWING TYPES**
- The markup systems were bound to the floor plan camera specifically: both
  overlays imported Na__FpCam__ directly and projected a stored X/Z pair as
  world X and world Z at the cut height. That is correct for a plan and
  meaningless for an elevation.
- New module set 40__System__DrawingViewCore holds the seam:
    Na__DrawView__ActiveView__   - which drawing owns the viewport, and how its
                                   plane maps to the world and to the screen
    Na__DrawView__Navigation__   - pan and zoom for any 2D drawing (moved out
                                   of the floor plan folder and generalised)
    Na__DrawView__MarkupMount__  - the eleven-module mount and unmount sequence
- Each drawing system registers an ADAPTER when it takes the viewport. The
  markup layers, the navigation and the render loop all go through the broker
  and no longer know which kind of drawing they are on.

**The stored field names still say X and Z**
- A markup record stores two millimetre values. On a plan they are literally
  world X and world Z; on an elevation they are horizontal run and height.
  Renaming the keys would mean migrating every project's saved markup for no
  behavioural gain, so they were deliberately left alone and the meaning is
  documented at the broker. Read "...XMm" as drawing axis 1 and "...ZMm" as
  drawing axis 2.

**The drawing's run is anchored at the world origin, not at the plane**
- The horizontal position of a point on an elevation is measured along the
  right axis from the WORLD ORIGIN. Measuring from the movable plane origin
  would have looked tidier and would have dragged every stored annotation and
  dimension sideways the moment the author nudged a slider - which is the one
  edit made constantly. Same reasoning as the dimension snap grid, and there
  is a harness check that pins it.

**Elevation and section are one drawing with the cut on or off**
- Nothing else differs: not the camera, not the framing, not the markup. So
  the switch is one call to the section engine rather than a second code path.
  An elevation whose plane has been pushed clear of the building is visually
  identical either way, which is exactly right.
- The section cut engine gained UpsertVerticalPlane. The cap geometry already
  solved in a basis built from whatever normal it was handed - it was ported
  from the ValeVision cross section tool, which cut vertically - so the fills,
  the profile outlines and the view depth back plane needed no change at all.
  SetPlaneHeightMm became SetPlaneDistanceMm with the old name kept as a
  wrapper, because "height" is only half the story now.

**Only one drawing can be up at a time, and the broker enforces it**
- Every markup module is a singleton bound to whatever mounted it last. A plan
  and an elevation both mounted would have meant the second silently
  inheriting the first's undo stack and hotkeys while the first was never torn
  down. The incoming controller calls ReleaseOtherKind and the outgoing one is
  told to stand down - so neither controller imports the other.
- The carousel's single navigation override became a ROUTER LIST for the same
  reason: with two systems registering, a setter would have let whichever
  initialised last unhook the other. Each router declines a scene that is not
  its own, so registration order does not matter.

**Fix - floor plan thumbnails captured the 3D model**
- The capture always rendered through the composer, whose RenderPass still
  held the perspective camera, so a plan's thumbnail was a picture of a view
  nobody was looking at. It now takes the same branch the render loop takes: a
  flat render through the active drawing camera plus the section overlay.
- Capture and R2 upload moved into one function so the scene editor, the floor
  plan editor and the elevation editor cannot drift. Both drawing panels
  gained a Save Thumbnail button, disabled unless the drawing is previewing -
  the capture is of the viewport, so from 3D it would file the wrong image.
- The markup layers are DOM overlays, not WebGL, so a thumbnail carries the
  linework and poche but not the text. Deliberate: at 480px a room label is an
  illegible smudge.

**Client measuring covers elevations too**
- The existing per-project grant now governs both kinds of drawing. A project
  that lets a client measure a plan lets them measure an elevation of it; two
  separate switches for one capability would be a trap rather than a feature.
  Still off unless switched on, still ephemeral, still unsaveable.

**Scene groups**
- A fifth default group, Elevations, ships disabled. Older projects saved
  before elevations existed have four groups and will never grow a fifth on
  their own, so the elevation scene link CREATES the group when neither the
  name nor the id is found rather than falling back to the first enabled one.
  Filing an elevation into Exterior 3D Views would be silently wrong.

**Fix - the PWA cache token, and why the whole feature looked dead**
- Renaming a cross-module export without bumping PWA_SW_VERSION_TOKEN meant
  live clients served a module graph that never existed as a set: the OLD
  scene carousel, which still had the single SetSceneNavigationOverride slot,
  alongside the NEW controllers calling AddSceneNavigationRouter. App modules
  are stale-while-revalidate on the live site, so a warm cache does exactly
  this.
- Nothing threw. The routers simply never registered, so clicking a floor plan
  or elevation thumbnail fell through to the ordinary camera flight with no cut
  applied - which reads precisely like the feature was never wired up, on a
  build where it was. Both plans AND elevations were affected, because both
  register through the same renamed function.
- Token bumped to 2026-09-07-1. The rule is now written into that file: moving
  or renaming ANY export that crosses a module boundary needs the token bumped
  in the same commit. Adding a new export does not.

**Fix - Update Scene overwrote a drawing scene's derived camera**
- A floor plan or elevation scene holds the pose its own definition produces,
  rewritten by its own editor whenever the datum, direction or plane moves.
  The Presentation Scenes panel offered Update Scene on those rows like any
  other, which recaptured the live perspective camera over it - breaking the
  approach flight, and replacing the drawing's thumbnail with a picture of the
  3D model.
- Update Scene is now disabled on drawing scenes and says where the camera
  actually comes from, rather than being a button that quietly does damage. The
  two link keys are imported from the drawing systems' own data modules, so
  renaming one cannot leave the check silently matching nothing.
- STILL A HAZARD, not yet addressed: deleting a drawing scene from the
  Presentation Scenes panel leaves its plan or elevation record pointing at a
  scene id that no longer exists. The drawing still previews from its own panel
  but loses its carousel card. Deleting from the Floor Plans / Elevations panel
  removes both correctly.

**Fix - a drawing's carousel card was created, then stayed invisible**
- Adding a floor plan or an elevation created its scene and filed it in the
  right group, and then told nobody. The carousel keeps showing the strip it
  built on load, so the new card did not appear for the rest of the session.
  From the author's seat that reads as "adding a plan does not make a scene" -
  and the natural workaround, pressing + Add Scene From Camera while previewing
  the drawing, captures the PERSPECTIVE camera and produces an ordinary 3D
  scene sitting in the Floor Plans group. A card that looks like the drawing
  and flies you to a 3D view is worse than no card at all.
- Na__PresentationMode__ProjectJson__BroadcastScenesChanged now exists for
  anything that changes the scene set from OUTSIDE the Presentation Scenes
  editor. Both drawing panels call it on add, delete and rename.

**The card is now stated, and recoverable**
- Every plan and elevation row carries its card status: the scene's name and id
  when linked, or "Not in the carousel" and an ADD TO SCENES button when not.
  That button is the same create-and-file call the Add path makes, so a drawing
  that predates the link, or whose scene was deleted from the Presentation
  Scenes panel, is recovered in one press rather than being unreachable.
- Shared between both panels rather than written twice, because the wording,
  the states and the failure it prevents are identical.

**+ Add Scene From Camera refuses while a drawing is on screen**
- It captures the perspective camera, which during a preview is parked wherever
  the approach flight left it. It now declines and points at the drawing's own
  panel instead of silently producing the junk scene described above.

**Fix - the 2D framing was captured too rarely to survive a save**
- A drawing stores how it was framed - the parallel zoom and the pan target -
  and reopens at it. That part worked. What did not was WHEN the framing got
  written: only on flipping to another drawing and on leaving one. Frame a plan
  nicely, press Save Floor Plans, and the record kept whatever framing was
  captured the last time it happened to close.
- With no stored framing at all, opening falls back to fitting the whole MODEL
  BOUNDS at zoom 1. On a project with any site or landscape around the
  building that is an enormous extent, so the drawing opens as a speck in the
  middle of nothing - "the camera is miles away", which is exactly the report.
- The shared 2D navigation now takes an onSettled callback and fires it at the
  end of every pan and after every zoom step, including a zoom clamped at its
  limit. Both controllers record their framing there, so the record always
  holds the view on screen rather than the last one that happened to be saved.
- Save and Save Thumbnail additionally call StoreActiveFraming outright. The
  thumbnail IS the framing, so capturing one without recording the other would
  leave a card whose picture and whose opening view disagree.

**Fix - drawing scenes had no thumbnail path**
- An ordinary scene gets PresentationMode/Thumbnails/<id>.webp assigned when it
  is created. Plan and elevation scenes were given a camera, a group and a name
  but no thumbnail url, so their cards had nothing to resolve and showed a
  placeholder - and only ever gained an image if someone thought to press Save
  Thumbnail. Both scene links now set the conventional path at creation.

**Fix - the navigation toolbar stayed up over an elevation**
- The toolbar already withdrew for the whole of floor plan mode: presentation
  scenes move it from the bottom of the canvas to the top, landing it directly
  over the annotation and measuring bar and above it in the stacking order.
  Elevations are presentation scenes too and were never wired to it, so the
  toolbar sat on top of the measuring tools with Orbit / Walk / Fly offering
  nothing an orthographic drawing can use.
- It now listens to the elevation broadcast as well, hiding from the START of
  the transition rather than on arrival, exactly as plans do.

**The two sources are tracked separately, and a show is deferred one microtask**
- Handing over from one drawing to another is a single synchronous stack: the
  outgoing drawing broadcasts idle, and only THEN does the incoming one
  broadcast entering. A shared flag would have ended the handover in the wrong
  state; separate flags fix that, but the idle still asks for a show before the
  entering asks for a hide.
- So hiding is immediate and showing is deferred to a microtask that re-reads
  both flags. By the time it runs the incoming drawing has claimed the view and
  the show never happens. Measured with a MutationObserver rather than a poll,
  because the window it closes is shorter than a frame: a plan-to-elevation
  handover now produces NO class change at all.

**What was verified**
- A geometry harness at 80__Testing__PrototypeEnvironment/
  Na__Test__ElevationGeometry__.html drives the real modules against a
  synthetic model: 45 checks covering the azimuth convention, orthonormal
  axes, plane distance responding only to movement along the view axis, run
  anchoring, run round-tripping at six bearings, framing span across the
  elevation, camera orientation, pan staying in plane, and the vertical clip
  plane keeping the far side. All pass.
- In the browser: entering an elevation, the screen-to-plane mapping round
  tripping to zero pixel error, placing a label, flipping between two
  elevations without markup bleed, handing over to a floor plan, exiting to
  3D, and capturing a thumbnail in all three states.
- NOT verified against a real model: local testing has no project API, so no
  GLB loads. The cut appearance, the framing on real geometry and the look of
  a finished elevation still want a pass on a live project.

# ---------------------------------------------------------
## TrueVision3D v2.17.0  -  31-Aug-2026
### Client Measuring - The Same Dimension Engine, Gated for the Live App

**Overview**
- Clients can now measure the model themselves in the live app, using the tool
  built for the Dev menu rather than a copy of it. Their measurements are red,
  ephemeral, and cannot touch the dimensions we issue.
- Access is granted per project from a **Let clients measure** toggle in the Dev
  menu Floor Plans panel. Off unless switched on, so a project nobody has
  considered never exposes the tool.

**ONE ENGINE, THREE GATED DIFFERENCES**
- This was the design constraint and it drove everything else. There is no
  second dimensioning implementation: snapping, axis constraints, ortho mode,
  the crosshair, vertex editing and undo are the same code on both sides, so a
  change to how dimensions behave reaches the live app for free.
- Exactly three things differ, and each is enforced in ONE place:
    1. THE DISCLAIMER, enforced by a placement gate in the editor.
    2. THE COLOUR, forced in Na__PlanDim__Create rather than defaulted.
    3. THE STORAGE, an ephemeral session array that no plan record points at.

**The disclaimer is a gate, not a notice**
- Placement can be armed from the toolbar, the client bar or the D hotkey.
  Rather than checking in three places, Na__PlanDimEdit__BeginPlacement now
  consults a registered gate and the private ArmPlacement is the only thing
  that actually arms. Client mode registers the gate; the gate shows the modal
  and arms only from its accept callback.
- That means a NEW entry point added later cannot bypass the notice by
  forgetting a check - arming is not reachable any other way.
- Wording lives entirely in AppConfig as an array of paragraphs and is set with
  textContent, never innerHTML, so it can be revised without touching code and
  cannot inject markup. Escape and the backdrop both DECLINE; neither is ever a
  silent accept. Focus is trapped while open and returned on close.

**Client measurements cannot be saved, structurally**
- They live in a module-level session array that is never attached to a floor
  plan record. The save path writes the PresentationMode block; the session
  array is not in it, so there is nothing to write. Verified by tracing every
  use of GetSessionDimensions: the overlay renders it, the editor and history
  bind to it, and one label counts it. Nothing else sees it.
- Na__PlanDim__SetPlanDimensions - the only function that could attach an array
  to a plan record - has no callers at all.
- The session is cleared on unmount, so one visitor never inherits another's.

**Issued dimensions are read-only to a client**
- Enforced by NOT WIRING interaction onto a record the current author may not
  edit, rather than by checking inside each handler. There is no handler that a
  future path could reach without the check, because there is no handler.
- Deliberately not dimmed in the styling: these are the authoritative figures
  and must never read as secondary to a visitor's own scratch measurements.

**Two id spaces**
- Ids are integers allocated per array, and client measurements live in a
  different array from the issued ones - so both would have started at 1 and
  collided the moment the overlay drew them together. Client ids start above
  CLIENT_ID_BASE, which keeps the spaces disjoint without either array needing
  to know about the other. This was caught while wiring, not in testing.

**Where the toggle is stored**
- Nested inside PresentationMode__SavedCameraScenes as
  ...__ClientDimensionsEnabled, so it rides the existing R2 dev-key path and
  needs no change to the three dev-owned key lists. Absent reads as OFF.
- Saved by the existing Save Floor Plans button; there is no second save.

**Client bar placement**
- Top centre, in the same place as the developer annotation toolbar and
  measured from the same header variable. It was first pinned to the bottom,
  where it landed straight on top of the scene carousel and its group pill.
- The two bars never coexist - the client bar mounts only in the non-developer
  branch and the annotation toolbar only in the developer one - so sharing one
  position is safe rather than a collision waiting to happen.

**Fix - the tool button stayed on Cancel after a dimension completed**
- Na__PlanDimEdit__CancelPlacement changed the state without announcing it. The
  second click notified BEFORE standing the tool down, so the only refresh the
  toolbars received still read as mid-placement: Measure stayed on Cancel and
  the hint still said "click the start point" over a finished dimension.
- CancelPlacement now notifies, which covers finishing a dimension, Escape and
  the Cancel button alike, and fixes the developer + Add Dimension button too -
  it had the same stale active state for the same reason.
- The client branch also passed an onChanged that only synced the layer and
  never refreshed its own bar. Both now go through one refresh.

**Verification**
- 21 modules parse, 142-file import graph resolves, zero cycles, no undefined
  calls, config JSON valid, history 20/20 and focus arbiter 12/12 still green.
- The isolation invariant is proven STATICALLY by tracing, not by running.
  Nothing here has been exercised in a browser: the modal has not been seen,
  no client measurement has been taken, and the read-only rule has not been
  tested against a real pointer.

# ---------------------------------------------------------

# ---------------------------------------------------------
## TrueVision3D v2.16.2  -  31-Aug-2026
### Fixes - Preview Matches the Result, Plus a Placement Crosshair

**1 | Previewed text was tiny, then leapt to full size on the second click**
- The preview text carried a fixed `font-size: 12px` in CSS while the
  committed dimension sized itself in real millimetres through the camera
  scale. At plan zoom that is a large jump, and the author had no way to judge
  the result from the preview.
- Both now run through one mm-to-pixel conversion. The preview also takes its
  colour, weight and line stroke from the same values the dimension will be
  created with, so the preview is an honest picture of the result rather than a
  differently-styled placeholder.

**2 | Dimension style is now pre-configurable**
- New live NEW-dimension defaults, seeded from AppConfig and editable from the
  toolbar: a text size field in millimetres and a colour swatch. They apply to
  the next dimension drawn AND to the selected one, so the control never
  appears to do nothing.
- `Na__PlanDim__Create` reads these rather than raw config, which is what makes
  what-you-preview-is-what-you-get true rather than approximately true.

**3 | Placement crosshair**
- Full-width and full-height dotted lines tracking the cursor while a dimension
  is being placed, at half opacity and hairline width, so a corner can be lined
  up by eye instead of judged against a bare cursor tip.
- Deliberately faint and neutral: the axis lock guide is the stronger coloured
  line and has to stay the thing that draws the eye. A crosshair competing with
  it would make the constraint harder to see, not easier.
- It tracks the RAW pointer rather than the snapped point. The snap is 5 mm, so
  at any usable zoom the two are within a pixel, and following the pointer keeps
  the crosshair smooth instead of stepping across grid boundaries.
- Drawn first among the layer children, so dimensions, the axis guide and the
  vertex handles all paint over it.

# ---------------------------------------------------------

# ---------------------------------------------------------
## TrueVision3D v2.16.1  -  31-Aug-2026
### Fixes - Dimension Undo, and the Preview Now Obeys the Constraint

**Two bugs from v2.16.0, both reported from live use.**

**1 | Dimension undo and redo did nothing**
- The markup focus arbiter granted EXCLUSIVE ownership of Ctrl+Z, Ctrl+Y and
  Delete to whichever layer was touched last. That was wrong. If focus was
  stale - sitting on annotations from an earlier click - or had never been
  claimed at all, NEITHER layer would handle the key and undo silently did
  nothing.
- The rule is now FIRST REFUSAL. The focused layer is offered the keystroke
  first; if it cannot act (nothing selected, nothing left on its stack) the key
  falls through to whichever layer can. The intuition is unchanged - the thing
  you were just working on is the thing Ctrl+Z undoes - but the key can no
  longer fall into a gap between the two layers.
- Layers now register capability probes (canUndo / canRedo / canDelete) rather
  than the arbiter reaching into them, so it stays dependency-free.
- The annotation hotkeys were never wired to the arbiter at all, only the
  dimension ones. Both are wired now. Before this, `stopPropagation` did not
  stop the sibling listener on the same node - that needs
  `stopImmediatePropagation` - so both handlers fired and a single Ctrl+Z
  stepped BOTH undo stacks.
- The toolbar Delete button now makes the same arbiter call the Delete key
  makes, so the button and the key cannot diverge.
- Proven by a Node test of the arbiter: 12 cases including stale focus, tie
  breaking, exactly-one-handler, detach, and a probe that throws.

**2 | The placement preview ignored the axis constraint**
- The rubber band was drawn from the raw pointer position while the committed
  span was already constrained. So with an axis locked, the guide line showed
  one thing, the preview showed another, and only on the second click did the
  dimension snap square. The preview was actively contradicting the guide.
- It now draws to `span.start` and `span.end` - the RESOLVED world points, with
  the off-axis component already collapsed - projected back to screen through a
  new `Na__PlanDimLayer__WorldToScreenMm`.
- The committed dimension was always constrained correctly; only the preview
  was wrong. That matches the report exactly: the line was visible and helpful,
  but the dimension being dragged out did not follow it.

**A near miss worth recording**
- The first version of that fix called `Na__PlanDimLayer__GetSize()`, which does
  not exist - the helper is `GetViewportSize`. Syntax checks and the import
  graph both passed it happily, because it is a runtime failure, not a parse
  error.
- Added a sweep that flags any `Na__*` call in these systems that is neither
  defined locally nor imported. It catches exactly this class of slip, and it
  now runs clean across all four markup systems.

**Verification**
- 20/20 on the snapshot history unit test, 12/12 on the focus arbiter test,
  139-file import graph resolves, zero cycles, no unused imports, no undefined
  calls. Still not run against a live model.

# ---------------------------------------------------------

# ---------------------------------------------------------
## TrueVision3D v2.16.0  -  31-Aug-2026
### Dimension Constraints - Ortho Mode, Axis Locks, Vertex Editing, Undo

> Extends the dimension tool shipped in v2.15.0. Authored in a parallel session
> to that work, so some of the files below are edits to it rather than new ones.

**Overview**
- The dimension tool measured accurately but every pick was free to wander a few
  degrees off square. This is the taming: a persistent ortho mode, Shift to
  constrain while held, SketchUp Layout style arrow key axis locks with a
  visible guide, full select / delete / undo / redo, and double-click editing of
  a placed dimension's two end points.
- New modules: `Na__PlanDimensions__AxisLock__`, `__VertexEditor__`,
  `__Hotkeys__`, `__History__`, plus a shared
  `Na__AppUtils__SnapshotHistory` and a `Na__FloorPlan__MarkupFocus__` arbiter.

**The constraint priority order is the whole design**
- From strongest to weakest: an ARROW KEY lock, then SHIFT, then ORTHO MODE,
  then the ALT override, then the automatic near-square tolerance the tool
  already had. A weaker rule can never overturn a stronger one, which is what
  stops two active constraints fighting each other.
- Left / Right lock the X axis, Up / Down lock the sheet Y axis - world Z on a
  plan. Pressing the same direction again releases it, as SketchUp does, so one
  key both applies and cancels the lock.
- A locked axis draws a faint dotted guide through the anchor point across the
  whole sheet: red for X, green for sheet Y, matching SketchUp's axis colours.
  Both colours are config values. The guide is deliberately tied to the ARROW
  KEY lock only - during Shift or ortho the axis flips as the drag crosses the
  diagonal, and a guide flickering between horizontal and vertical would be
  noise rather than information.

**SHIFT NOW CONSTRAINS RATHER THAN RELEASES - a behaviour change**
- Shift previously overrode the automatic axis lock to allow a diagonal. It now
  constrains to whichever direction the drag is dominated by. The override moved
  to Alt, and `Interaction__AxisLockOverrideKey` was changed from "Shift" to
  "Alt" to match.
- This inverts what the tool did yesterday. It was requested, and Shift-to-
  constrain is what a SketchUp user's hands already expect, but anyone who
  learned the old behaviour will find Shift doing the opposite.
- The toolbar hint said "hold Shift for an aligned dimension" and would have
  taught the wrong habit, so it now reports whichever constraint is actually
  holding the pick.

**Vertex editing**
- Double-clicking a placed dimension puts an X marker on each end. Either can be
  dragged; the endpoint setter rounds through the same 5 mm grid the original
  placement used, so a corrected vertex lands on exactly the coordinates a fresh
  one would rather than drifting half a step off the wall.
- THE CONSTRAINTS ARE THE SAME ONES, ANCHORED DIFFERENTLY. Dragging the start
  vertex constrains against the END vertex and vice versa, so "grab the start and
  pull it square with the other end" works: the fixed end is the origin the axis
  lock, Shift and ortho all measure from, exactly as the first click is during
  placement.
- The visible X is two thin strokes but the pointer target is a much larger
  invisible circle, because an X drawn at handle size is close to impossible to
  grab reliably.

**Two undo stacks, one implementation, and an arbiter between them**
- The annotation history mechanics moved to `Na__AppUtils__SnapshotHistory`, a
  factory returning independent instances. Annotations and dimensions each hold
  one, so undo behaves identically in both because there is only one
  implementation of it, while a Ctrl+Z in one can never step the other's stack.
- The annotation module keeps its public API unchanged; it is now a thin wrapper.
- THE ARRAY IS STILL MUTATED IN PLACE, NEVER REPLACED - the overlay and the plan
  record that saves to R2 both hold live references, and assigning a fresh array
  on undo would leave them pointing at a stale copy while the next save quietly
  wrote the pre-undo state.
- `Na__FloorPlan__MarkupFocus__` decides which layer owns a shared keystroke.
  Both markup systems bind Ctrl+Z, Ctrl+Y and Delete; without arbitration one
  Delete would remove a room name AND a dimension, which destroys work silently
  and is near impossible to diagnose afterwards. The rule is last touched wins.
  Keys belonging to only one layer - the arrow locks, the ortho toggle, copy and
  paste - are not arbitrated at all and stay live regardless.
- The toolbar Delete button now routes through the same arbiter as the Delete
  key, so the button and the key can never disagree about what they act on.

**Interactions collapse to one undo step**
- Placing, deleting, an offset drag and a vertex drag are each exactly one
  undoable step. Drags take a baseline on pointer down and commit it only if
  something actually moved, so a click that never dragged leaves no entry.
- The first click of a double click arms an offset drag; opening vertex editing
  discards that pending baseline, so entering the editor never leaves a phantom
  step behind.

**Escape unwinds one layer at a time**
- Vertex editing, then an axis lock, then a placement, then the selection - one
  press each, rather than throwing away all four states at once. The editor's own
  Escape handler was removed because this supersedes it and two handlers would
  double-fire.
- Arrow keys are always claimed while dimensioning even when they change nothing,
  because letting them through would scroll the page out from under the drawing.

**Not verified against a running model**
- Syntax, the full 139-file import graph, cycle checks and dead-code sweeps all
  pass. Nothing here has been run: no dimension has been drawn, no vertex
  dragged, and the axis guide has never been seen on screen.

# ---------------------------------------------------------

# ---------------------------------------------------------
## TrueVision3D v2.15.0  -  31-Aug-2026
### Plan Dimensioning - Measured Dimensions on a 5 mm Snap Grid

**Overview**
- Floor plans can now be dimensioned. In a plan's Annotate mode a new
  **+ Add Dimension** button arms a two-click placement: click the start, click
  the end, and a proper dimension line is drawn with extension lines,
  terminators and the measured figure. A live preview between the two clicks
  shows the span already snapped and already squared, so the author commits to
  a number they have read rather than to a cursor position.
- New module set in `44__System__PlanDimensions`: the snap grid and working
  plane, the data model, the SVG overlay, the placement editor, its AppConfig
  and its own stylesheet.

**The snap grid is anchored at the WORLD ORIGIN, not the model bounds**
- This is the decision the whole system rests on. Anchoring the grid to the
  model's bounding box looks tidier and is wrong: the box moves the moment a
  model is re-exported with a different amount of site or planting around it,
  and every stored dimension would then silently land half a step off the wall
  it was measured against. A world-origin grid reproduces across re-exports,
  across model groups and across projects.
- The model IS measured, but for EXTENT rather than origin. `EstablishPlane`
  runs `Box3.setFromObject` over the model root, pads the footprint by the
  configured margin and keeps that as the region a pick may land in, so a
  stray click out in empty space is rejected instead of being stored as a
  400 m dimension. With no model loaded it stays permissive rather than
  refusing every pick.
- "Plane" is meant literally as well as descriptively: the descriptor carries
  a real `THREE.Plane` at the dimension height, so a future raycast picker or
  an image exporter has the actual surface rather than loose numbers.

**Length is derived, never stored**
- A record holds two endpoints, an axis lock and an offset. It does NOT hold
  its length - that is recomputed from the endpoints on every read and every
  frame. Storing a measured figure next to the geometry that produces it is
  how drawings end up lying: the two drift apart the moment anything is
  edited, and the number is the half everyone trusts. Derived-on-read cannot
  drift, and a dragged endpoint updates its own figure with no refresh call.
- Endpoints are re-snapped on normalise, so a hand-edited JSON figure is
  pulled back onto the current grid rather than rendering out of step with
  every other dimension on the same sheet.

**Where the data lives**
- Dimensions ride inside each plan record as `FloorPlan__Dimensions`, exactly
  as that plan's annotations ride in `FloorPlan__Annotations`. Plans already
  nest inside `PresentationMode__SavedCameraScenes`, which is on all three
  dev-owned key lists, so dimensions inherit the existing R2 overlay /
  build-preserve / sync-preserve path. No new top-level key, and none of the
  three lists needed touching - the v2.11.0 lesson applied rather than
  relearned.
- The per-plan array is accessed from the dimensioning module's own data
  layer rather than through `Na__FloorPlan__ProjectJson__Data__`, so the
  feature adds nothing to that module's surface.

**Geometry is built in world millimetres, then projected**
- Extension lines, the offset dimension line and the terminators are all
  computed as world points on the plan plane and only then pushed through the
  plan camera. Building them in screen space would be less code and would put
  the offset at a fixed pixel distance, so the whole dimension would slide
  across the wall it belongs to the moment the plan was zoomed.
- Terminators are the deliberate exception and ARE sized in screen space: an
  arrowhead is a drafting glyph of fixed drawn size, like one on a printed
  sheet, not a world-space object.
- SVG rather than Three.js geometry, for the same reason the annotation text
  is DOM: strokes stay hairline-crisp at every zoom, the value renders in real
  Open Sans, and hit-testing comes free. Scene geometry would alias against
  the linework it is measuring and would have to fight the section cut for
  depth.

**Axis lock**
- Decided in SCREEN space. A pick within the pixel tolerance of horizontal or
  vertical is straightened onto that axis, because a plan dimension three
  pixels off square is virtually always meant to be square. Holding Shift
  places a true aligned dimension. Aligned lengths are irrational, so the
  reported figure is rounded onto the same 5 mm grid - otherwise one dimension
  on the sheet would carry a precision none of the others do.

**What was and was not verified**
- Verified against the live app: snapping lands ON the grid with a worst-case
  error of 2.4996 mm across 4000 samples, which is the stated "within 5 mm".
  Axis lock collapses a 37 mm drift to a clean 3000. A 3-4-5 pick reports
  exactly 5000; a 1414.214 diagonal reports 1415. Same-cell and 900 m picks
  are both refused. Moving an endpoint to 5003 stores 5005 and the figure
  follows it.
- Drawn geometry was measured back out of the DOM and is dimensionally exact:
  a 10 m span, a 750 mm offset, an 800 mm extension, a 15 mm stroke and 220 mm
  text all render at precisely those sizes, and world/screen round-trips to
  the same point. Span and offset still read true from zoom 0.1 through 4.
- Known and deliberate: below roughly 0.5x zoom the stroke stops being scale-
  true because it hits a 0.6 px hairline floor. Without that floor the
  linework would vanish when zoomed out. Standard CAD behaviour, but it does
  mean stroke width is not measurable at low zoom.
- NOT verified: placement against a real project's plan. The two-click flow,
  offset dragging and the toolbar button were exercised through their module
  APIs, not by clicking a loaded model, because localhost has no worker and
  the project GLBs are CDN-hosted. That needs a run against a live project.

# ---------------------------------------------------------

# ---------------------------------------------------------
## TrueVision3D v2.14.0  -  31-Aug-2026
### Floor Plan Annotations - Copy, Paste, Undo, Redo and Delete

> Builds directly on v2.12.0 (Floor Plan Builder), not on v2.13.0. The two were
> authored in parallel sessions; this one landed last, hence the version.

**Overview**
- Marking up a floor plan gains keyboard shortcuts: Ctrl+C copies the selected
  label, Ctrl+V pastes it, Ctrl+Z undoes, Ctrl+Y redoes, and Delete or
  Backspace removes the selection.
- Two new modules in `43__System__PlanAnnotations`:
  `Na__PlanAnnotations__History__.js` (the undo stack) and
  `Na__PlanAnnotations__Hotkeys__.js` (key binding and the clipboard).
- Every shortcut is bound only while annotation editing is on and unbound the
  moment it is switched off. None of it is ever live in the ordinary 3D app.

**Why these are NOT in Na__Hotkeys__Manager**
- That module owns unmodified global view-switching keys and returns early
  whenever Ctrl, Meta or Alt is held. Every shortcut here is Ctrl-modified and
  scoped to one editing context, so registering them there would have meant
  widening a global module to answer for a local concern and changing the guard
  that keeps it predictable. A scoped attach/detach handler was the honest fit,
  matching how Na__FloorPlan__PlanNavigation__ binds and unbinds.

**Undo is snapshot based, and the array is mutated in place**
- A plan carries a handful of small text records, so deep-copying the whole
  array per edit costs nothing and removes an entire class of bug: there is no
  inverse operation to get wrong.
- THE ARRAY IS MUTATED IN PLACE, NEVER REPLACED. The overlay holds a live
  reference to it and so does the floor plan record that gets saved to R2.
  Assigning a fresh array on undo would have left both pointing at a stale copy
  and the next save would have quietly written the pre-undo state - the kind of
  failure that looks like it worked until someone reopens the project.
- Restores push new object instances, which is safe because nothing holds a
  reference to an individual annotation: the overlay keys its nodes by id, and
  selection and editing both track ids rather than objects.

**Edits that span time do not each become an undo step**
- A drag, a text edit and dragging the size field all take a baseline when the
  interaction starts and commit it only if something actually changed. Opening
  a label and pressing Escape leaves no history entry, a click that never moved
  leaves none, and a size adjustment collapses into ONE undo step instead of one
  per input event - which is what makes undo usable rather than a slow rewind.
- The toolbar size field keeps live feedback on every keystroke but commits on
  change and blur; the weight selector is atomic and commits immediately.

**The clipboard is internal, not the OS clipboard**
- Reading the system clipboard needs async permission prompts and would fight
  with text the author copied from somewhere else. An in-app buffer makes
  "copy this label, paste it" behave exactly as expected.
- Repeated pastes cascade by the configured offset rather than stacking on one
  spot, so pasting four room names gives four visible labels instead of one
  apparent label with three hidden underneath it.
- The clipboard deliberately survives leaving a plan, so a label copied on the
  ground floor can be pasted onto the first floor. History does not - it is
  bound per plan and cleared on mount, because one plan undo stack has no
  meaning over another plan markup.

**Which keystrokes get swallowed, and which do not**
- Undo, redo, paste and Delete are claimed whether or not they did anything.
  Letting Ctrl+Z through once the stack is empty would rip the browser own edit
  history, and Backspace would navigate the page back and lose unsaved markup.
- Ctrl+C is deliberately NOT claimed when no label is selected, so a copy the
  author intended for text elsewhere on the page still works.
- Every shortcut stands down while the in-situ label editor is open or focus is
  in the toolbar or Dev menu fields, so Ctrl+C and Ctrl+V while typing a room
  name are the browser own text copy and paste, which is what is meant then.

**Also in this pass**
- Removed `Na__FpCam__UnprojectScreenToPlane` from the plan camera. It was
  written in the first pass for annotation dragging and then superseded by the
  simpler centre-offset conversion the overlay actually uses - under a parallel
  projection one screen pixel is a constant number of scene units, so no
  unproject is needed at all. Dead on arrival; now gone.

**Still not verified against a running model**
- As with v2.12.0, none of this has been run. Syntax, the full module import
  graph and cycle checks all pass, but no keystroke has been pressed in anger.

# ---------------------------------------------------------

# ---------------------------------------------------------
## TrueVision3D v2.13.0  -  31-Aug-2026
### Asset Cull Distance - Per-Model Control Over Furniture Draw Distance

**Overview**
- The furniture / interior-decor distance culling that has been running since
  v1.0.0 of the effect was tuned once, globally, in AppConfig. Every project
  got 25 m whether it was a two-room flat or a farmhouse. There was no way to
  see what the distance was without reading the console, and no way to change
  it for one model without changing it for all of them.
- Dev Tools now carries an **Asset Cull Distance** section: current distance,
  where that distance came from, a live count of registered and currently
  culled items, and Apply Live / Save / Clear against the project.
- It sits under a divider inside the existing **Orbit Max Zoom Radius** panel
  rather than as its own menu item. Both settings answer the same question -
  how far out does this model still read - and they get tuned together.

**Where the data lives (the trap this had to avoid)**
- The override is a new TOP-LEVEL key, `RenderEffect__AssetCullDistanceMm`, in
  the project's `TrueVision__ProjectData__.json`. Millimetres, integer.
- v2.11.0 nested Presentation Mode groups inside an existing key specifically
  to dodge the three-list problem. This feature could not: a scalar distance
  has no existing key to hide inside. So all three dev-owned key lists were
  edited in lockstep, which is the whole reason that warning was written down:
  - `Na__DevSavedKeys` in `Na__AppFlow__LoadingSequence.js` (R2 overlay on localhost)
  - `DEV_OWNED_PROJECT_DATA_KEYS` in `CloudflareR2__ModelSync__Main__.py` (sync preserve)
  - `TRUEVISION_DEV_OWNED_KEYS` in `ProjectVision__BuildScript__.py` (build preserve)
- Miss any one of those and a ProjectVision build or a model sync silently
  resets the project's cull distance back to the AppConfig default. All three
  were verified to carry the key before this was called done.
- Saving is the same path every other dev-menu setting uses: one
  `Na__CfApi__MergeAndSaveKeys` call writing the whole merged document back.

**Engine change - the distance is now retunable in place**
- `Na__RenderEffect__DistanceCulling__.js` goes to 1.2.0. The cull distance
  used to be baked into each registry entry's `thresholdSq` at registration
  time, so changing it meant re-registering every item and re-measuring every
  bounding box.
- Each entry now caches the bounding radius it was measured with, so
  `SetCullDistanceMm` walks the registry and recomputes thresholds only. No
  geometry is touched, which is what makes Apply Live feel instant on a model
  with thousands of registered items.
- `GetStats` reports enable state, distance and live registered / culled counts
  and backs the readout. Its `culledCount` counts entries currently flagged
  not-visible, so an item hidden by the context menu or an isolate counts too -
  it reads as "hidden right now", not strictly "hidden by distance".

**Ordering**
- The loading sequence applies the project override AFTER project data lands
  and BEFORE the models load, so `RegisterModelGroups` builds the registry
  against the project distance from the very first frame rather than building
  at the AppConfig default and being corrected afterwards.
- `Initialize` (AppConfig) runs earlier still and is never re-called, so the
  override survives a model-group switch: the switch rebuilds the registry
  using the distance already in module state.
- Apply Live drives `Update(camera.position)` directly before requesting a
  render, because the cull pass is camera-move-gated. Without that, a change
  made while the camera sat still would not show until the user orbited.

**What was and was not verified**
- Verified on localhost: the section renders under the divider, the readout
  populates, Apply Live retunes a live registry, and invalid input (zero,
  negative, NaN) is refused with the distance left untouched. The threshold
  recomputation was checked against a synthetic furniture group at known
  distances - items flip visible/culled at exactly the expected thresholds as
  the distance is moved up and down and back.
- NOT verified: the R2 save / clear round-trip, and the behaviour against a
  real project's furniture. Localhost has no worker and the project GLBs are
  CDN-hosted, so the save path only got as far as confirming its no-project
  guards fire cleanly. Both need a run against a live project.

# ---------------------------------------------------------

# ---------------------------------------------------------
## TrueVision3D v2.12.0  -  31-Aug-2026
### Floor Plan Builder - Live Section Cuts, 2D Plan Mode, Room Annotations

**Overview**
- Developer mode gains a Floor Plans section. Add a plan, name it, set its
  floor level, and the app cuts the model live and shows it as a true 2D
  parallel projection looking straight down. Each plan becomes a scene card in
  the Floor Plans group, so a viewer cycles ground / first / second floor from
  the carousel exactly like any other saved view.
- Each plan carries its own text annotations - room names - pinned to world
  positions so they stay planted over the right room as the drawing is panned.
- Three new systems, none of them folded into existing files:
  `41__System__SectionCutEngine`, `42__System__FloorPlanViews`,
  `43__System__PlanAnnotations`, each with its own AppConfig JSON.

**The cut engine is ported, not reinvented**
- `Na__SectionCut__CapGeometry__.js` is a verbatim port of the ValeVision3D
  cross section cap engine (14-Jul-2026 v1.0.0). The algorithm is untouched -
  only the header, the helper userData flag and the console prefix changed.
  That is the piece that makes a sliced wall read as solid poche instead of a
  hollow shell, and it had no business being rewritten.
- What was NOT ported: face-click placement, the draggable plane gizmo, flip,
  placement modes and the multi-plane Tools-menu UX. A floor plan shows one
  storey, so the engine cuts with exactly ONE plane at a time and the
  cross-clipping ValeVision needs is absent by design.
- `Na__RenderEffect__SectionClipping__State.js` came across to
  `05__RenderPipeline` because the profile-line pass renders with override
  materials, which bypass per-mesh `clippingPlanes`. Without it the linework
  keeps drawing the roof the cut has already removed.
- The clip array instance is MUTATED, never replaced. Model materials hold a
  reference to it, so dragging the floor-level slider only changes
  `plane.constant` - no scene re-traversal, which is what keeps it smooth.

**Floor level and cut height are two different numbers**
- The slider sets the FLOOR DATUM (0 = model ground floor, -5m to +20m). The
  cut is taken CutOffsetAboveDatumMm above it, default 1200mm - the standard
  architectural cut height. A plan left at datum 0 therefore slices the walls
  rather than skimming the slab, which is what makes it a plan at all.
- Both numbers show in the Dev row readout together, because confusing them is
  the fastest way to author a plan that cuts the wrong part of the building.
- Seed From Model Storeys reads the storeys `Na__StoreySystem__` already detects
  from GLB names and measures each floor level from that storey's own geometry,
  so a two-storey house is two correct plans in one click.

**Where the data lives (the part that could have gone badly)**
- Floor plans are nested INSIDE the existing
  `PresentationMode__SavedCameraScenes` block, under `...__FloorPlans`, with a
  per-scene `...__Scene__FloorPlanId`, and annotations nested inside each plan.
- Same constraint as the scene groups work. The dev-owned top-level key list is
  duplicated in THREE files that must agree - `Na__DevSavedKeys` in
  `Na__AppFlow__LoadingSequence.js`, `DEV_OWNED_PROJECT_DATA_KEYS` in
  `CloudflareR2__ModelSync__Main__.py`, and `TRUEVISION_DEV_OWNED_KEYS` in
  `ProjectVision__BuildScript__.py`. Nesting inside a key already on all three
  means floor plans ride the existing R2 overlay, build-preserve and merge-save
  path with NONE of those lists touched. A new top-level key would have needed
  all three edited in lockstep, and missing one would have let a ProjectVision
  build silently wipe every floor plan and every room name with it.
- Saving is one `Na__CfApi__MergeAndSaveKeys` call writing the whole block, the
  same path every other dev-menu save uses.

**Every plan scene carries a real camera block**
- `Na__PresentationMode__ProjectJson__IsValidScene` rejects a scene without
  finite camera coordinates. A plan scene without one would have been silently
  filtered out of the carousel and simply never appeared. Each plan scene
  therefore stores its genuine top-down pose, built by
  `Na__FloorPlan__Framing__`, which is also the single place the model centre
  and approach height are worked out for the flight and the preview.

**Scene group placement**
- A group named "Floor Plans" wins; failing that the configured id (Group_004);
  failing that the first enabled group, which on a default project is
  Exterior 3D Views. A matched group that is switched OFF is switched ON,
  because a plan filed into a hidden group would never reach the carousel.
- A project with no groups at all gets the default set seeded first. Creating a
  floor plan is precisely the moment grouping starts to matter - the project now
  has two kinds of scene - so it is the one place seeding is right rather than
  a surprise.

**Transitions**
- Into plan mode: the cut is applied FIRST, so the cap geometry is built while
  the viewer is stationary rather than hitching at the end, and the building is
  already sliced as the camera rises over it. The perspective camera then eases
  up to a top-down pose framed to roughly match what the ortho view will show -
  that match is what stops the projection swap from jumping - and only then does
  the projection change. The easing is the carousel's own transition, driven
  with a synthesised pose, so plan flights feel identical to scene flights.
- Between two plans: an instant flip, shipped at 0ms. They are drawing pages;
  animating between two top-down parallel views reads as jarring. Raising
  Transition__BetweenPlansMs above 0 is available if buffering ever needs
  softening, and the annotation layer already carries the fade path for it.
- Out of plan mode: annotations are removed outright BEFORE the camera moves,
  so no label ever slides across the screen with the view.

**Render loop: plan mode is checked first, not last**
- `Na__RenderLoop__RenderFrame` asks `Na__FloorPlanMode__GetActiveCamera()`
  before anything else. A non-null answer short-circuits the entire 3D frame:
  walk/fly physics, orbit updates, door proximity, billboard facing, fog
  uniforms and distance culling are all meaningless on a drawing.
- Distance culling in particular MUST NOT run - it hides furniture beyond a
  radius of the 3D camera, and a floor plan has to show everything on the
  storey. It is switched off on entry (which restores anything already culled)
  and put back exactly as it was on exit.
- Orbit controls are disabled while a plan is displayed. They listen on the
  same canvas as the plan pan handler; left enabled they would rotate the
  perspective camera underneath the drawing on every drag, so leaving plan mode
  would land somewhere the viewer never chose. The two cannot share a pointer.
- The composer is bypassed entirely in plan mode. Fog, SSAO and the Sobel pass
  all shade a plan like a surface, which is exactly wrong for a drawing.

**Annotations are DOM, not Three.js**
- The layer is an HTML overlay above the canvas. Real DOM text gives true
  Open Sans rendering at every zoom, an in-situ editor that is just a
  contenteditable, and drag handling for free - none of which a canvas-textured
  plane in the scene could match.
- Positions and text sizes are stored in real millimetres, so labels scale with
  the drawing the way CAD text does and stay planted when the plan is reopened.
  Weights are restricted to the three Open Sans faces the app already loads
  (300 / 400 / 600); anything else is snapped to the nearest, because a
  browser-synthesised weight reads as a different typeface.
- The canvas is NOT flush with the viewport - it starts below the app header -
  so the layer is positioned from the canvas's own offset box and every pointer
  coordinate is converted out of viewport space before use. Skipping either
  would displace every label by the header height.
- Double-click edits in place, Enter commits, Escape reverts, and a label
  emptied on commit is deleted rather than left invisible.

**Carousel routing without a dependency cycle**
- The carousel gained `Na__PresentationMode__UI__SetSceneNavigationOverride`.
  The floor plan controller registers a router with it, so a plan scene card
  switches into 2D and an ordinary scene chosen while in plan mode leaves plan
  mode and flies down to it. The import points one way only - the carousel
  never imports the floor plan system - so no cycle is introduced. Card click
  and the prev/next stepper now share one navigation path and cannot diverge.

**Not in this version**
- Dimensions. Text annotations only, as scoped.
- The 2D render styling pass. Plan mode currently renders flat and unshaded via
  the direct path; tuning line weights and hatching for a drawing look is the
  next piece of work, and the engine's appearance API is already config-backed
  and live-settable for it.
- Nothing here has been run against a model yet. The whole feature was written
  to be verified on a real project, and the Boolean cut in particular has not
  been seen rendering.

# ---------------------------------------------------------

# ---------------------------------------------------------
## TrueVision3D v2.11.0  -  31-Aug-2026
### Presentation Mode Scene Groups - Named Sets Above The Carousel

**Overview**
- Saved scenes can now be split into named groups (Exterior 3D Views, Interior
  3D Views, Dollhouse View, Floor Plans, or whatever a job needs). The carousel
  shows one group at a time and a small pill above its top-left corner names the
  group, counts them, and opens the list. On West Farm this takes the strip from
  eight cramped cards to three, and stops the run from exterior views straight
  into dolls-house plans that made the old strip so hard to read.
- Group names are per-project and renameable, so an interiors job renames
  "Exterior 3D Views" rather than needing a new group invented for it.
- New modules in `21__System__PresentationMode`: a data layer
  (`SceneGroups__Data__`), the selector bar (`UI__SceneGroupSelector__`), the
  Dev group editor (`DevMenu__GroupEditor__`), its own AppConfig JSON and its
  own stylesheet. The feature is not folded into the existing carousel or dev
  UI files.

**Where the data lives (the part that could have gone badly)**
- Groups are nested INSIDE the existing `PresentationMode__SavedCameraScenes`
  block, under `...__Groups`, with a per-scene `...__Scene__GroupId`.
- That was the whole design constraint. The dev-owned top-level key list is
  duplicated in THREE files that must agree - `Na__DevSavedKeys` in
  `Na__AppFlow__LoadingSequence.js`, `DEV_OWNED_PROJECT_DATA_KEYS` in
  `CloudflareR2__ModelSync__Main__.py`, and `TRUEVISION_DEV_OWNED_KEYS` in
  `ProjectVision__BuildScript__.py`. Nesting inside a key already on all three
  lists means groups ride the existing R2 overlay, build-preserve and
  merge-save path with none of those lists touched. A new top-level key would
  have needed all three edited in lockstep, and missing one would have let a
  ProjectVision build silently wipe every group.
- Saving is unchanged: one `Na__CfApi__MergeAndSaveKeys` call writing the whole
  block. Groups ride along inside the same config object the scenes do.

**Scene Order is now per-group**
- `PresentationMode__Scene__Order` restarts at 1 inside each group, so playback
  order is `(Group__Order, Scene__Order)` and never `Scene__Order` alone.
- Existing projects need no migration. A project with no `__Groups` array reads
  as ungrouped: the bar never mounts, every scene shows, and the order is the
  plain `Scene__Order` sort it always was. Verified live against RB05 before
  any group was defined - eight cards, no bar, byte-identical behaviour.
- Orders are only rewritten when the author actually assigns scenes to groups
  and saves. Opening the Dev menu seeds the default four groups IN MEMORY only,
  so merely looking at a project is never an edit.

**Nothing can vanish from the carousel**
- A scene naming a missing or switched-off group falls back to the first
  enabled group rather than disappearing.
- Because Order restarts per group, two scenes from different groups can both
  hold Order 1 - so fallback arrivals would interleave with the scenes already
  there and produce an unpredictable sequence. `GetScenesInGroup` sorts on a
  membership rank first (natives, then arrivals clustered by origin group) and
  only then on Order. The Dev menu reassigns and renumbers before it lets a
  group be switched off, so this only bites hand-edited JSON, but it makes that
  case deterministic rather than merely non-destructive.
- At least one group must always stay enabled; the last one cannot be switched
  off or deleted.

**Cycling rolls into the next group**
- Running off the end of a group with the next chevron continues into the first
  scene of the next group and relabels the bar mid-flight; the very end wraps
  back to the very start. The changing group name is the nudge that tells a
  viewer there is more here than the set they started in.
- Picking a group from the dropdown re-aims the strip WITHOUT moving the
  camera - browsing is not travelling, and an unrequested camera flight on
  every group change would be disorienting mid-presentation. The next chevron
  then enters that group at its first scene rather than resuming an off-screen
  position the viewer can no longer see.

**The fade is coupled structurally, not by timers**
- The bar is a DOM child of `.na-pm-carousel`, so it inherits that element's
  single opacity transition: the 50% idle rest, the hover wake, the 2.6s
  post-transition wake hold and the keyboard-focus wake all apply to it with no
  duplicated timers and no way for the two to drift apart. The bar sets no
  opacity of its own. The existing pointerdown and capture-phase scroll wake
  listeners are on the container, so touching the bar wakes the assembly free.
- Because of that, the carousel render clears only its OWN children and leaves
  the bar standing, so neither module depends on whose event listener runs
  first. The selector also catches up if scenes somehow arrive before its
  config loads.
- `#naPmSceneGroupBar` added to the PWA install bar's bottom-UI clearance list:
  the pill overhangs the carousel's top edge so it reaches higher than the
  carousel rect the bar was measuring.

**Navigation mode on arrival - an undeclared scene now means ORBIT**
- Separate bug, older than this work, but grouping made it obvious: cycling out
  of a fly-mode kitchen interior into the dolls-house views left you stuck in
  fly, in a camera view pointing at nothing.
- `PresentationMode__Scene__NavigationMode` being absent used to mean "keep the
  viewer's mode". It now means orbit, and the camera is released from walk/fly
  on EVERY transition rather than only when a mode was declared. Skipping that
  release was the real damage: walk/fly kept ownership of the camera for the
  whole flight, rewriting `camera.position` from its own state every frame
  (walk rebuilds it from a capsule that never moved) and discarding the
  transition's writes - so the view stayed put while the UI reported arrival.
- The Dev toggle drops its fourth `Keep` option; Orbit is now the absent-key
  default and stores nothing. `Update Camera` and new scenes only record a mode
  when it is walk or fly. Legacy scenes holding the literal `'keep'` fail the
  availability check and resolve to orbit, so no project data needs migrating.
- Verified on RB05: orbit across the exteriors, fly honoured at both kitchen
  interiors, orbit restored at Ground Floor where it previously stayed in fly.

**Dev menu**
- Collapsible `Scene Groups` section at the top of the Presentation Scenes
  panel: enable toggle, editable name, scene count, reorder arrows and delete
  per group, plus Add Group. Group order is the order the carousel cycles
  through them, so those arrows are a playback control.
- The scene list below is clustered under group headings, and the `#N` on each
  row is the scene's position within ITS group. Each row gains a `Group`
  dropdown listing only ENABLED groups - which is what makes "a scene assigned
  to a switched-off group" impossible to author rather than something the
  viewer has to be defended against.
- Each group's scene rows FOLD, closed by default, so the panel opens as a
  short list of group names instead of every scene on the project expanded at
  once. Open state is remembered across panel rebuilds - a reorder rebuilds the
  panel, and collapsing the group being worked in would make the arrows
  unusable.
- Scene counts read "4 Views" / "1 View" / "No views" rather than a bare
  number, in the carousel dropdown, the group rows and the list headings. A
  lone digit beside a group name read as a position in an ordered list.

**Reorder bug caught in review**
- `NormaliseOrderWithinGroups` sorted by the existing Order before renumbering.
  Every reorder works by splicing the working array and then calling that to
  write the new positions out - so it read back the pre-move sequence and
  silently undid the move, while the save still fired and reported success to
  R2. Array position is the intent; it now walks the array exactly as given.
  Callers that want a sorted starting point sort first, which the panel render
  already did.
- Regression test added and confirmed to fail against the old code.
- Reordering (arrows, drag, Position field) is confined to a scene's own group;
  the dropdown is the only way to move between groups. A cross-group drag is
  refused outright rather than silently pinned to the group edge, which would
  have read as a broken drag.
- The group editor never saves for itself. It mutates the shared live config
  and raises `na-presentation-groups-changed`; the scene editor owns the single
  normalise -> commit -> write-to-R2 path and answers that event. Groups and
  scenes live in the same JSON block, so one writer is the only way the two can
  never disagree about what was written.

**Verified**
- 31 data-layer assertions against the real RB05 project JSON: legacy
  passthrough, seeding, per-group renumbering, groups-first playback order,
  cross-group cycling in both directions including both wraps, the
  fallback-safety cases, and reorder survival through a full render cycle.
- Live in the browser on RB05: ungrouped passthrough, filtering 8 cards to 3,
  the bar relabelling as cycling crossed each boundary, dropdown selection
  leaving the camera parked, dismissal by outside press and Escape (with the
  containment bail-out from the v2.10.0 context menu trap), the Dev panel's
  group section and per-scene dropdowns, and the mobile scale-down at 375px.
  No group data was written to R2 or to the repo during testing.

# ---------------------------------------------------------
## TrueVision3D v2.10.0  -  30-Aug-2026
### Right-Click Context Menu System - Isolate Floor, Isolate Element, Hide Element

**Overview**
- New `27__System__ContextMenuSystem` module. Right-click any part of the
  building on a PC and get a contextual menu that knows what was clicked:
  isolate the floor it sits on, isolate or hide that element type on that floor
  or across the whole building, and open or close a door. Menu styling follows
  the Tools & Settings dropdown so the two read as one family - a title, a
  horizontal rule, then the rows.
- Deliberately built as a general context menu rather than a floor-isolate
  shortcut. Sections are contributed by registered provider modules, so future
  interactive assets add a menu presence by writing one file and registering it;
  the menu itself never changes. Doors are the reference implementation.

**The pan guard (the whole point of the exercise)**
- The right mouse button is the Orbit pan gesture, and it stays untouched. The
  guard is a pure observer: it never calls preventDefault or stopPropagation on
  any pointer event and never touches OrbitControls, so the event stream
  OrbitControls receives is byte-for-byte what it received before. The only
  preventDefault in the system is on `contextmenu`, and only while a menu is
  actually opening.
- It is a LATCH, not a comparison. Once pointer travel passes
  `MaxTravelPx` (default 3, configurable) the press is disqualified for good -
  returning the pointer to its exact origin cannot re-arm it, so a pan that ends
  where it started still suppresses the menu. Only a fresh right-button
  pointerdown arms a new press.
- Anything ambiguous disarms it too: a second mouse button, a wheel tick, window
  blur, a tab switch, a key press, a pointer cancel, or the wrong nav mode.
- Verified against West Farm (RB05): stationary click and 2px tremor open;
  4px, 5px, 10px, 60px, 120px and an 80px-out-and-back round trip all suppress;
  a real right-drag pans the camera normally with no menu; touch and pen
  pointers are rejected; Walk and Fly are rejected.

**Menu behaviour**
- Orbit mode only, desktop mouse only. Right-clicking empty space (sky, ground,
  a gap) opens nothing at all - identical to the previous behaviour.
- The whole-storey row is deliberately the odd one out: named after the floor
  itself (`View Ground Floor`, no scope tag) and sitting alone between two
  rules, because it switches an entire floor level on rather than acting on the
  element that was right-clicked. Every row below it acts on the element.
- One isolation at a time, replaced when a new one is chosen, plus an
  independent hidden set that survives isolating and un-isolating. Restore rows
  (`Show Entire Building`, `Show All Hidden Elements`) sit at the TOP of the
  menu and appear only when they would do something, so the user can never get
  stuck. A row representing the current state renders with the green state dot
  and toggles itself off when clicked - a second way out.
- The `All Floors` rows appear only when the element type actually exists on
  more than one storey, otherwise they would duplicate the floor row.

**Owns no visibility logic**
- Orchestrates the three existing systems in the same two-pass order
  `Na__PresentationMode__Visibility__StateCapture.js` uses: coarse storey
  baseline via `Na__StoreySystem__` / `Na__StoreyIsolate__`, then the
  authoritative per-category pass via `Na__ModelToggle__ApplyVisibilityState()`.
  Routing the fine pass through the model-toggle registry (rather than poking
  `group.visible`) keeps its cached flags, its Dev-menu buttons and the
  Presentation Mode scene capture correct for free - saved scenes pick up
  context-menu changes with no extra work.
- `Isolate Floor` delegates to the existing `Na__StoreyIsolate__` call, so it is
  identical to the Tools menu Floor Isolate button. The two entry points must
  not diverge.
- Actions broadcast `na-context-menu-visibility-changed`; the Tools menu Floor
  Isolate and Storey Toggle panels now listen for it, so the two UIs cannot
  disagree about which floor is isolated.

**Door animation system - v1.8.0 (`ClickToOpenDoors`)**
- Click detection is now LEFT BUTTON ONLY. The handlers previously bound
  pointerdown/pointerup with no button check, so a stationary right-click
  toggled a door as well - a latent bug that would have made the new menu open a
  door and then offer a row labelled for the opposite state. Left-click
  behaviour is unchanged.
- Exported `Na__DoorAnim__FindAdrAncestor` and `Na__DoorAnim__ResolveHitPanel`
  so the context menu can resolve a hit to a door without duplicating the
  ancestor walk, plus a new read-only `Na__DoorAnim__IsDoorOpen()` used to label
  the row Open or Close. No behavioural change to the animation itself.

**Menu dismissal (a trap worth recording)**
- The "click outside closes the menu" listener is bound on `window` in the
  CAPTURE phase so the menu closes before anything downstream reacts. That
  ordering means a press on the menu itself reaches the dismissal handler
  first, tearing the menu down on `pointerdown` so no row's `click` ever fires -
  every row silently did nothing. A bubble-phase `stopPropagation` on the menu
  root cannot fix it; it runs too late. The handler now tests whether the event
  target sits inside the menu and bails out. Any future global dismissal
  listener needs the same test.

**Picking correctness**
- Linework roots are excluded from the ray. Fat lines are `LineSegments2`, which
  extends `THREE.Mesh`, so an edge would otherwise beat the solid face behind it
  and every hit would resolve to the outline rather than the wall.
- Invisible geometry is filtered manually. `THREE.Raycaster` does not test
  `object.visible`, so a hidden storey would otherwise stay pickable straight
  through the model in front of it. Every candidate hit has its full ancestor
  chain checked before it is accepted.

**Config**
- Own config file in the new system folder, matching the `22__InvoiceSystem`
  pattern: `Na__ContextMenuSystem__AppConfig__.json`, loaded relative to the
  module's own URL so the system is self-contained. Covers gesture thresholds,
  picking rules, section enable flags and order, element display names and all
  row wording.

# ---------------------------------------------------------
## TrueVision3D v2.9.0  -  29-Aug-2026
### Mobile UI Overhaul - Menu Transparency, Portrait Menu Swap, Views Button Retired

**Overview**
- Streamlined the mobile / portrait experience: the two top-row menus no
  longer overlap, the header no longer dominates a phone screen, and the
  menus adopt the ValeVision3D idle-fade so more of the model shows through
  around the edges. The confusing carousel toggle ("Views" button, which
  shared the Reset View icon) is gone entirely.

**Menu Transparency (ValeVision3D recipe, ported verbatim)**
- Tools & Settings menu, Dev Tools menu and the navigation toolbar now idle
  at 50% opacity with their drop shadows hidden, waking to full opacity +
  shadow over `0.3s ease` on hover, keyboard focus, or while open/in use.
- The scene carousel gets the same idle fade with a sensible fade-out: any
  tap, swipe or click flashes `na-pm-carousel--wake`, holding it opaque for
  2.6s (covering the 1.8s scene camera flight) before fading back; each
  interaction restarts the hold, so it only fades out once left alone.
  Keyboard focus wakes it via `:has(:focus-visible)` rather than
  `:focus-within`, so an ordinary tap never pins it opaque on touch screens;
  the `:has()` selector sits in its own rule so browsers without support
  drop only the keyboard wake, never the hover/tap wake. On reveal the
  carousel arrives opaque, holds, then fades to idle - announcing itself
  without staying in the way of the model.
- Replaced the dead `na-nav-toolbar--inactive` hook (CSS existed but no JS
  ever applied it) with the proven ValeVision recipe in
  `Na__PresentationMode__Styles__SceneCarousel__.css`.
- Ported the 1s `na-nav-toolbar--wake` flash to
  `Na__UiFeature__NavigationToolbar__Controls.js`: hotkey-driven mode changes
  (which CSS hover cannot see) hold the toolbar opaque for a moment so the
  moved highlight registers, then let it fade back. Boot never flashes.

**Mobile Header (<=600px)**
- Header scales down 20% (60px -> 48px via `--Vale_HeaderHeight`, cascading
  to canvas, overlays and menu offsets automatically), logo 42px -> 33.6px,
  and the "TrueVision 3D" title reduces 24px -> 18px (it stays visible,
  unlike ValeVision which hides its title).

**Portrait / Narrow-Screen Menu Swap (<=768px)**
- The standalone Tools & Settings trigger is hidden; the navigation toolbar
  gains a vertical divider + hamburger button on its far right instead.
- Pressing the hamburger hides the toolbar and drops the regular Tools &
  Settings menu into the same top row (`body.na-mobile-tools-open`); folding
  the menu back up restores the toolbar. Both share one space, so the old
  toolbar/menu overlap in portrait presentation layouts cannot occur.
- The boot "teaser" auto-open of the Tools menu is skipped while the menu is
  swapped out behind the hamburger.
- Open menu gains a scale-aware viewport height clamp so it scrolls rather
  than running off short phone screens.

**Views Button Retired (carousel now always shows)**
- The saved-scene carousel is everyone's primary quick-transition tool, so it
  now always shows whenever the loaded project has valid saved scenes, and
  hides only when the scenes are cleared. The toolbar toggle button, its "4"
  hotkey, the `na-presentation-carousel-toggle` /
  `na-presentation-views-btn-state` events, and the
  `PresentationMode__SavedCameraScenes__ShowCarouselByDefault` flag are all
  removed (the flag remains harmlessly ignored in older project JSONs).
- Cleaned every reference: `Index.html` button + wiring + help row, hotkeys
  manager maps, hotkeys config JSON, user instructions overlay row, PWA
  install-bar reposition hooks, and the dev scene editor default config.

**Touch Zoom Allowance (ported from ValeVision3D)**
- New `Navmode__IpadControls__OrbitMaxDistanceMultiplier : 2.5` in
  `Na__AppConfig__Main.json`, applied in `Na__DefaultNavmode__IpadControls.js`:
  touch devices get 50,000mm x 2.5 = 125,000mm orbit zoom-out so portrait
  screens can pull back far enough to frame the whole model. Desktop is
  unchanged; a per-project `Navmode__OrbitMaxDistanceMm` override still
  applies equally to both and does not stack with the bonus (ValeVision
  behaviour).
- The Dev menu "Orbit Max Zoom Radius" default now reports the multiplied
  effective cap on touch devices.

**Fixes**
- `body.na-presentation-mode-active .na-nav-toolbar` referenced the
  undefined `--Na_HeaderHeight` token (silent 54px fallback); now uses
  `--Vale_HeaderHeight`, so the top toolbar sits correctly below the header.

# ---------------------------------------------------------
## TrueVision3D v2.8.1  -  27-Aug-2026
### Dev Menu - Cache & Storage Reset Panel

New localhost-only `Cache & Storage` panel at the bottom of the Dev Tools menu,
so busting the PWA cache no longer needs the DevTools Application tab or a
console one-liner.

**Two actions, separated by how much they destroy:**
- `Bust Caches` - drops the service worker caches and registrations, then
  reloads. The everyday "am I actually running my latest edit" button.
  Cookies and saved app state are left alone. Delegates to the PWA registrar's
  `clearCache()` so that teardown has one implementation.
- `Full Reset` - the above plus cookies, localStorage, sessionStorage and
  IndexedDB, for testing as a brand new visitor. Two-step confirm (the button
  re-labels to `Click again to confirm` and disarms itself after 4s).

**Live readout:**
- One line showing caches, workers, cookies, local keys, session keys and
  IndexedDB databases, refreshed when the panel opens and on demand, so it is
  obvious whether a reset actually changed anything.
- A note explains that caches reappearing after a reset is expected - the
  worker re-registers on the reload and re-fetches them from the network.

**Cookie clearing:**
- A cookie is only deleted by re-setting it with an EXACTLY matching path and
  domain, so the sweep covers every ancestor path both with and without its
  trailing slash, against the host with and without a leading dot. A cookie on
  `/na-apps/30__TrueVision__CoreAppCode/` is not cleared by expiring the same
  path without the slash - that case was found in testing and fixed.
- HttpOnly cookies are invisible to script and cannot be cleared here.

**Robustness:**
- Every storage API is independently guarded; one blocked or unsupported API
  never prevents the rest of the reset from running.
- IndexedDB enumeration is feature-detected (`indexedDB.databases` is absent
  in Firefox); deletion resolves on error and on blocked so an open connection
  elsewhere cannot hang the reset.
- The panel is inert if its markup is absent, and the markup sits inside the
  Dev Tools menu that `Na__UiFeature__DevMenu__LocalhostOnly.js` hides off
  localhost - so it can never reach a client.

**Changed Files**
- NEW `02__Src__AppModules/70__System__DevTools/Na__UiFeature__DevMenu__CacheAndStorage__Controls.js`
- NEW `03__Style__AppStylesheets/Na__UiFeature__Styles__DevMenu__CacheAndStorage__.css`
- MOD `Index.html` - Cache & Storage dev panel markup, import, initialisation
- MOD `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css` - stylesheet import

# ---------------------------------------------------------
## TrueVision3D v2.9.0  -  27-Aug-2026
### PWA Installability - One Installable App Per Project

TrueVision is now installable as a proper app on phones, tablets and desktops.
The install is unique PER PROJECT: each client installs their own scheme, with
its own icon, its own name and a launch URL that opens straight into their own
model. A device can hold several of them side by side without collision.

Ported from the ValeVision3D / Whitecardopedia install stack, with the manifest
made dynamic and the prompt restyled to the Noble Architecture house style.

**Per-project identity - the part that is genuinely new:**
- TrueVision serves every client from one codebase and selects the project from
  the URL query, so a single static `.webmanifest` would have installed one
  generic app for everybody, launching at a project-less URL.
- `TrueVision__Pwa__Manifest__Builder__.js` therefore builds the manifest in
  memory at boot and injects it as a `data:application/manifest+json` link,
  stamped with the project from the URL:
  ```
  id / start_url  ->  .../Index.html?project=RB05&project-folder=RB05__WestFarm&year=26
  name            ->  "West Farm - TrueVision 3D"
  short_name      ->  "West Farm"          (the home-screen label)
  ```
- Because `id` differs per project, the browser treats each project as a
  separate app. Two projects installed on one iPad do not overwrite each other.
- The readable name is derived synchronously from the project folder
  (`RB05__WestFarm` -> `West Farm`) so it is in place before the browser
  evaluates installability; `TrueVision__ProjectData__.json` refines it later if
  it carries a better one.
- Every URL inside the manifest is absolute, because a `data:` URL has no base
  to resolve relative paths against. `TrueVision__Pwa__Url__Constructor__.js` is
  the single place those are built.
- `TrueVision__Pwa__Manifest__Fallback__.webmanifest` is the static safety net,
  used if scripting is unavailable or a CSP `manifest-src` rule blocks the
  inline form. It installs, it just loses the per-project identity.

**Platform coverage:**
- Chromium (Chrome / Edge / Opera / Samsung Internet, desktop and Android) gets
  a compact bottom bar and the real `beforeinstallprompt` flow - one tap.
- iOS and iPadOS Safari get an instruction card, with the Share button
  described in the right place for the device (bottom on iPhone, top on iPad).
  Getting that wrong is the usual reason a client gives up.
- macOS Safari gets File > Add to Dock.
- iOS Chrome / Edge / Firefox are told plainly that only Safari can install, and
  offered a Copy Link button carrying the canonical project URL.
- Firefox Android is pointed at its own menu; Firefox desktop is told it cannot
  install rather than being sent hunting for a menu entry that does not exist.

**Prompt behaviour:**
- Styled to match the `Better in Full Screen` card: white panel, dark blue
  header bar, soft backdrop blur, Open Sans.
- Sequenced to stay out of the way. It waits for `na-app-scene-ready`, then a
  6 s settle, then refuses to render while the full screen card or the User
  Guide is open, polling until they close. Waiting on another modal does not
  eat the retry budget, so a client reading the full screen card slowly does
  not lose the install offer.
- The bar MEASURES the bottom of the viewport and sits clear of the Presentation
  Mode scene carousel and the navigation toolbar, re-measuring when the carousel
  is toggled or the window resizes.
- Dismissal policy differs by environment on purpose:
  - LIVE - the offer returns on every fresh visit. Clients rarely install the
    first time they are asked; the second visit is when it lands. `Not Now`
    only silences it for that page load.
  - LOCALHOST - dismissing stores a one week suppression, so development
    reloads are not interrupted, but the prompt still resurfaces on its own
    often enough to confirm it works. Clear it early from the console with
    `TrueVision__Pwa__ResetInstallPrompt()`.
- An actual install always wins: once installed for a project, that project
  never offers again.
- `Tools & Settings > Install App` is the deliberate route back to the prompt,
  and always shows it whatever the suppression state says. Hidden inside an
  already installed app.

**Service worker:**
- `Na__Pwa__ServiceWorker__.js` sits at the app root because GitHub Pages
  cannot send `Service-Worker-Allowed`, so the script's location IS its scope.
  DO NOT MOVE IT - moving it silently breaks install on every Chromium browser.
- Four buckets: shell (stale-while-revalidate), project data (network-first,
  `cache: 'no-store'` so a stale disk-cached copy can never be written back as
  fresh), models (network-first with a 4 s slow-network grace, LRU capped at
  80), and version-pinned vendor modules from esm.sh (cache-first).
- Deliberately NOT precaching the full module graph. TrueVision has around a
  hundred modules that move constantly and a hand-maintained precache list
  would be wrong within a week. Only the boot-critical handful is precached;
  the rest populates on first visit, which is what makes the second visit fast.
- Bump `PWA_SW_VERSION_TOKEN` in the SW logic to force-evict every bucket.
- Console recovery: `TrueVision__Pwa__ClearCache()` and
  `TrueVision__Pwa__PurgeApp()`.

**Changed Files**
- NEW `Na__Pwa__ServiceWorker__.js` - SW stub at app root for maximum scope
- NEW `02__Src__AppModules/62__Feature__AppInstallability/` - 15 modules:
  URL constructor, project context, manifest builder, fallback manifest,
  platform detector, session state, prompt UI, five platform handlers,
  install controller, service worker registrar and logic
- NEW `03__Style__AppStylesheets/Na__UiFeature__Styles__PwaInstallability__.css`
- MOD `Index.html` - manifest link, Apple meta tags, PWA script loading,
  `Install App` menu row and its wiring
- MOD `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css` - stylesheet import
- MOD `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` -
  refines the installable app name from the loaded project data

# ---------------------------------------------------------
## TrueVision3D v2.8.0  -  27-Aug-2026
### Full Screen Mode - Menu Toggle and Startup Invitation

Full screen is now a first-class viewing mode. A toggle sits at the bottom of
the Tools & Settings menu, and a single invitation card recommends full screen
once the model has finished loading.

**Tools & Settings toggle:**
- New `Full Screen` row below `Profile Lines`, following the same
  `na-walk-mode__toggle` pattern as `Shadows` and `Profile Lines`.
- The ON/OFF badge, the active highlight, `aria-pressed` and the tooltip are
  all driven from the browser `fullscreenchange` event rather than from the
  click, so the row stays correct however the user leaves full screen -
  including the Escape key, which is never intercepted.
- The expand/collapse arrow icon swaps with the state, so the row reads
  correctly in both directions.
- This row is the route out of full screen for touch-screen devices, which
  have no Escape key.

**Startup invitation:**
- `Better in Full Screen` card fades in 700 ms after `na-app-scene-ready`,
  explaining the benefit and - before the user commits - how to leave again:
  Escape on desktop, the Tools & Settings row on tablets and phones.
- The Fullscreen API only accepts a real user gesture, so the card carries the
  click the browser requires; the app can never switch itself over.
- Dismissed via `Go Full Screen`, `Not Now`, the backdrop, or Escape. The
  dismissal applies to that page load only - the card is offered on every app
  open, a reload included. Remembering a dismissal was tried and reverted: a
  stray Escape press silenced the invitation for the whole tab session with no
  way to bring it back.
- Card height is capped against the dynamic viewport with the body scrolling,
  so the action buttons stay reachable on landscape phones.

**Compatibility and rendering:**
- Feature-detected. Where element full screen is unavailable - notably Safari
  on iPhone, which only supports it for video - the menu row is hidden and the
  card is never built, rather than offering a dead control.
- Every state change forces a `resize` after the viewport settles, so the
  renderer, composer, depth pre-pass, AO, profile lines and FXAA render targets
  all pick up the new dimensions. Browsers fire `resize` themselves on a full
  screen transition but the timing is inconsistent.
- `na-fullscreen-state-changed` is dispatched for any module that needs it.

**Changed Files**
- NEW `02__Src__AppModules/76__System__FullscreenMode/Na__UiFeature__FullscreenMode__SystemLogic.js`
- NEW `02__Src__AppModules/76__System__FullscreenMode/Na__UiFeature__FullscreenMode__Prompt.js`
- NEW `02__Src__AppModules/76__System__FullscreenMode/Na__UiFeature__Styles__FullscreenMode__.css`
- MOD `Index.html` - Full Screen menu row, module imports, initialisation
- MOD `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css` - stylesheet import
- MOD `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` - dispatches `na-app-scene-ready`
- MOD `02__Src__AppModules/02__AppData/Na__AppConfig__Hotkeys.json` - documents Escape as the full screen exit
- MOD `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__Content__.html` - Full Screen User Guide section

# ---------------------------------------------------------
## TrueVision3D v2.7.8  -  10-Jul-2026
### Exterior Double Doors — Independent Leaf Animation

Added explicit independent animation for exterior double-door ADRs while
preserving the established lockstep behavior for every existing product.

**Classification and compatibility:**
- `ADR` names containing `ExteriorDoubleDoor` are independently coupled when
  `IndependentPanelsEnabled` is true.
- Bifold `ROT_MVE` structures, `InteriorDoor`, `BifoldDoor`, `SlidingDoor`, and
  unknown legacy ADRs remain lockstep. Two `ROT_ONLY` panels alone never opt in.
- ADR-level state/progress/timing fields remain compatibility aliases of the
  primary panel. External whole-door callers retain `Na__DoorAnim__ToggleDoor`.

**Interaction and proximity:**
- Raycast hits resolve through the nearest MOD ancestor, pairing mesh and
  linework branches to one panel descriptor.
- Each independent panel owns state, progress, timing, easing, and
  mid-animation reversal.
- Walk/Fly proximity measures paired ROT world positions and applies one
  near/far state to both leaves of an unfixed pair. Orbit clicks remain
  independent; assemblies containing a FIXED leaf retain nearest-leaf behavior.

**Configuration and testing:**
- Added `IndependentPanelsEnabled` and
  `IndependentPanelAdrNameTokens: ["ExteriorDoubleDoor"]` to production and
  prototype-sandbox config.
- Updated door-animation technical documentation and the sandbox test matrix.

**Changed Files**
- MOD `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js`
- MOD `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectInteraction__Animation__WalkMode__ProximityToOpenDoors__.js`
- MOD `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__README__.md`
- MOD `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`
- MOD `80__Testing__PrototypeEnvironment/TestEnv__SubAppData__Config.json`
- MOD `80__Testing__PrototypeEnvironment/TestEnv__README__.md`

# ---------------------------------------------------------
## TrueVision3D v2.7.7  -  22-Jun-2026
### DataLib v1.4.0 — Discussion Marker Materials (MAT012–014)

Three new `MAT010__ModelingUtilitySeries__` materials added to the DataLib SSOT (`Na__DataLib__CoreIndex__Materials__.json`) for flagging conceptual elements during client presentations.

**New materials:**
- `MAT012__DiscussionMarker__Red` — vivid red semi-transparent overlay (`rgb(220, 55, 55)`)
- `MAT013__DiscussionMarker__Green` — vivid green semi-transparent overlay (`rgb(55, 200, 75)`)
- `MAT014__DiscussionMarker__Yellow` — vivid amber-yellow semi-transparent overlay (`rgb(230, 200, 30)`)

**Material properties (all three):**
- `Opacity: 0.35`, `Transparent: true` — clearly visible but geometry beneath reads through
- `IsDoubleSided: true` — correct for painted box volumes (no inverted-face issues)
- `DepthWrite: false` — correct transparency sorting against other scene geometry
- `PbrRoughness: 1.0`, `PbrMetallic: 0.0`, `EnvMapIntensity: 0.0` — fully matte, no reflections
- `AoExclude: true` — placed on Three.js layer 1; SSAO depth pre-pass and profile lines normals pass both skip layer 1, so these volumes generate no AO halos and no profile line edges

**No TrueVision code changes required.** All properties (`Transparent`, `IsDoubleSided`, `DepthWrite`, `AoExclude`) are already fully wired in `Na__MaterialsSystem__MaterialSwap.js`. The layer 1 exclusion mechanism in `Na__RenderPipeline__PostProcessing__Setup.js` covers both AO and profile lines simultaneously.

**Usage workflow:**
1. In SketchUp, paint any box/volume with `MAT012__DiscussionMarker__Red`, `__Green`, or `__Yellow`
2. Export GLB via the GLB Builder — material name is preserved exactly
3. Load in TrueVision — material swap pass matches the name, applies the transparent PBR material automatically

**Changed Files**
- UPDATED `Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Materials__.json` — bumped to v1.4.0, added MAT012–014

---

# ---------------------------------------------------------
## TrueVision3D v2.7.6  -  22-Jun-2026
### Hotkeys System — Central Config-Driven View Mode Shortcuts

Introduced a complete hotkeys system replacing the previously scattered and hardcoded `Alt+Shift+W` / `Alt+Shift+F` keyboard shortcuts. All key bindings are now defined in a single JSON config file and propagate automatically to every user-facing surface.

**New keys:**
- `1` — Switch to Orbit mode
- `2` — Switch to Walk mode (gated by per-model enabled flag)
- `3` — Switch to Fly mode (gated by per-model enabled flag)
- `4` — Toggle Animation Views (saved scene carousel)
- `0` — Reset View to project start position

**Architecture:**
- NEW `02__Src__AppModules/02__AppData/Na__AppConfig__Hotkeys.json` — single source of truth for all hotkey bindings, display labels, and reference documentation for movement/UI keys.
- NEW `02__Src__AppModules/10__NavigationAndCameras/Na__Hotkeys__Manager.js` — single `window` keydown listener; reads keys from config; routes to action callbacks; exports `Na__Hotkeys__ApplyUiLabels` which propagates key labels to toolbar tooltips, navigation help panel rows (`data-na-hotkey-row`), and user instructions items (`data-na-hotkey-item`).
- `Na__AppConfig__Loader.js` — added `Na__AppConfig__LoadHotkeysConfig()` to fetch the new config file.
- `Na__UiFeature__WalkModeEventListeners.js` — `Na__UiFeature__InitializeWalkModeHotkey` deprecated (no-op). Button wiring function retained.
- `Na__UiFeature__FlyModeEventListeners.js` — `Na__UiFeature__InitializeFlyModeHotkey` deprecated (no-op). Button wiring function retained.
- `Na__AppConfig__Main.json` — `Global__Hotkeys` block removed; superseded by `Na__AppConfig__Hotkeys.json`.
- `Na__UserInstructions__SystemLogic.js` — `Na__UserInstructions__Initialize` now accepts an optional `onContentLoaded(modal)` callback invoked after HTML content injection, enabling hotkey labels to be applied to the dynamically loaded overlay.
- `Na__UserInstructions__Content__.html` — Global Hotkeys section renamed "View Mode Shortcuts"; all five actions listed with `data-na-hotkey-item` attributes populated at runtime. Walk/Fly intro text updated.
- `Index.html` — hotkey wiring block replaced with `Na__Hotkeys__Initialize(actionMap, config)`; `Na__Hotkeys__ApplyUiLabels` called once at startup and again via `Na__UserInstructions__Initialize` callback. Navigation toolbar buttons gain hotkey-suffixed tooltips (e.g. `Orbit mode (1)`). Navigation help panel rows updated with `data-na-hotkey-row` attributes for all five actions.

**Changed Files**
- NEW `02__Src__AppModules/02__AppData/Na__AppConfig__Hotkeys.json`
- NEW `02__Src__AppModules/10__NavigationAndCameras/Na__Hotkeys__Manager.js`
- MOD `02__Src__AppModules/01__AppCore/Na__AppConfig__Loader.js`
- MOD `02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__WalkModeEventListeners.js`
- MOD `02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__FlyModeEventListeners.js`
- MOD `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`
- MOD `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__SystemLogic.js`
- MOD `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__Content__.html`
- MOD `Index.html`


# ---------------------------------------------------------
## TrueVision3D v2.7.5b  -  22-Jun-2026
### Dev Menu — Per-Scene Layer Switch Timing Toggle

Per-scene control over when saved model visibility is applied during animated transitions.

- New dev-menu checkbox on each Presentation Mode scene: **Switch layers before camera move**.
- Default (unchecked): layers switch **after** the camera arrives at the scene position (current behaviour).
- When enabled: layers switch **before** the camera move begins (useful for dolls-house / isolate views).
- Persisted per scene as `PresentationMode__Scene__ApplyVisibilityBeforeCamera` in `TrueVision__ProjectData__.json` (R2). Key omitted when false to keep JSON lean.

**Changed Files**
- MOD `02__Src__AppModules/21__System__PresentationMode/Na__PresentationMode__DevMenu__SceneEditor.js` (checkbox row + save).
- MOD `02__Src__AppModules/21__System__PresentationMode/Na__PresentationMode__Camera__SceneTransition.js` (respect per-scene flag).
- MOD `03__Style__AppStylesheets/Na__PresentationMode__Styles__SceneCarousel__.css` (checkbox row styling).


# ---------------------------------------------------------
## TrueVision3D v2.7.5a  -  22-Jun-2026
### Fix — Scene Visibility Restore + Natural Transition Timing

Follow-up fixes to the v2.8.0 scene visibility capture, addressing two issues reported in testing.

**Fix 1 — Hidden layers never restored when returning to a "show all" scene.**
- Root cause: scene apply only re-applied the categories/storeys present in a snapshot, so any element hidden by a previous scene (or a scene with a missing/partial block) lingered as hidden.
- `Na__PmVisibility__ApplyState` now resets to a **fully-visible baseline first** (entire building + all category groups), then applies the scene's saved state. Each scene is now authoritative and idempotent — exactly like SketchUp scene tags. A scene with no block now shows the whole model.
- New baseline helper `Na__ModelToggle__SetAllCategoriesVisible` (exported) plus reuse of `Na__StoreySystem__ResetEntireBuilding`.

**Fix 2 — Layers switched immediately on scene click (jarring).**
- Animated transitions now apply the saved visibility **after** the camera has finished moving to the new scene position, rather than at the start. The instant (default-scene) path is unchanged.

**Changed Files**
- MOD `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js` (`SetAllCategoriesVisible` baseline helper + export).
- MOD `02__Src__AppModules/21__System__PresentationMode/Na__PresentationMode__Visibility__StateCapture.js` (reset-to-full baseline before apply).
- MOD `02__Src__AppModules/21__System__PresentationMode/Na__PresentationMode__Camera__SceneTransition.js` (apply visibility on transition complete, not start).


# ---------------------------------------------------------
## TrueVision3D v2.7.4  -  21-Jun-2026
### Dev Menu — Per-Project View-Mode FOV Overrides + Scene Visibility Capture

Two new Presentation/Dev-mode capabilities, both persisted per-project to R2 and preserved by the build pipeline.

**Feature 1 — Default View-Mode FOV Overrides.**
- New localhost Dev Tools panel "Default View FOVs" with Orbit / Walk / Fly degree inputs and Apply Live / Save / Clear actions.
- Save writes a new `Navmode__FovOverrides` block to `TrueVision__ProjectData__.json` (R2), overriding the master FOV defaults in `Na__AppConfig__Main.json` on a per-project basis.
- Apply Live: Orbit sets the main camera FOV instantly; Walk/Fly stage the override and live-update if that mode is currently active.
- On load, `Na__AppFlow__LoadingSequence` applies the Orbit FOV to the live camera **before** the canonical Reset View capture, and stages Walk/Fly overrides for their next activation.
- New FOV setters `Na__WalkMode__SetFovOverride` / `Na__FlyMode__SetFovOverride` added to the respective navigation system modules.

**Feature 2 — Scene Model-Element Visibility Capture (SketchUp-style scene tags).**
- Capturing / updating a Presentation Mode scene now records the on/off state of every model element (category toggles) plus storey + roof dolls-house bookkeeping into a new `PresentationMode__Scene__Visibility` block.
- On scene apply/transition the saved visibility is restored: coarse storey/roof state first, then fine per-category visibility last (authoritative), so different scenes can show e.g. a ground-floor-only "dolls house" view.
- Drives the EXISTING visibility systems only — no new core visibility logic. `Na__UiFeature__ModelToggle__Controls` gained `GetVisibilityState` / `ApplyVisibilityState`; storey state read via `Na__StoreySystem__GetState`.
- Older scenes without the block remain fully backwards-compatible (apply is a no-op).

**New / Changed Files**
- NEW `02__Src__AppModules/21__System__PresentationMode/Na__PresentationMode__Visibility__StateCapture.js` (capture + apply orchestrator).
- NEW `02__Src__AppModules/11__CameraUtils/Na__UiFeature__ViewModeFov__DevControls.js` (FOV dev panel).
- MOD `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js` (visibility get/apply API).
- MOD `02__Src__AppModules/21__System__PresentationMode/Na__PresentationMode__DevMenu__SceneEditor.js` (capture on Add/Update).
- MOD `02__Src__AppModules/21__System__PresentationMode/Na__PresentationMode__Camera__SceneTransition.js` (apply on instant + animated transition).
- MOD `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__WalkMode__SystemLogic.js` + `…__FlyMode__SystemLogic.js` (FOV override setters).
- MOD `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` (`Navmode__FovOverrides` dev key + load-time apply).
- MOD `Index.html` (FOV dev menu item + init wiring).
- MOD `na-apps/05__ProjectVision__CoreAppCode/CloudflareR2__ModelSync__Main__.py` + `ProjectVision__BuildScript__.py` (added `Navmode__FovOverrides` to dev-owned keys).

# ---------------------------------------------------------
## TrueVision3D v2.7.3  -  21-Jun-2026
### Build Pipeline — Mirror Live R2 Dev Config Back to Local Project Data

**Problem.**
- After running `ProjectVision__BuildScript__.bat`, the local `TrueVision__ProjectData__.json` still showed only build-generated "standard" data (model groups, camera default). Dev-menu config saved live in-app to R2 (presentation scenes, nav modes, orbit max, orbit target) was never pulled back down to the local file, so the local copy could not be read as an accurate mirror of R2.
- Root cause: the R2 sync (`CloudflareR2__ModelSync__Main__.py`) merged R2's dev-owned keys into the document it **uploaded to R2**, but never wrote that merged document back to the **local** file.

**Fix — R2 → local write-back.**
- `build_project_data_operation` now flags `local_out_of_sync` whenever the merged document (local build + R2 dev keys) differs from the on-disk local file, and carries the dev keys it pulled (`dev_preserved`) for logging.
- New `sync_project_data_to_local()` writes the merged bytes back to each stale local `TrueVision__ProjectData__.json`.
- `run_r2_sync` calls it as STEP 5b — after the `--dry-run-only` guard (so pure previews never touch disk) but **before** the upload prompt and the "all up to date" early-return, so the local mirror happens even when R2 needs no upload.
- This is a read-from-R2 convenience mirror only; saving locally still pushes nothing. The result is local and R2 staying in sync after every build.

**Changed Files**
- `na-apps/05__ProjectVision__CoreAppCode/CloudflareR2__ModelSync__Main__.py` — `local_out_of_sync`/`dev_preserved` flags, `sync_project_data_to_local()`, STEP 5b wiring.

# ---------------------------------------------------------
## TrueVision3D v2.7.2  -  21-Jun-2026
### Design Phase Model Group Transition Overlay

**Summary.**
- Added a dedicated loading overlay shown while switching between design phase model groups. Large GLB model sets can take a while to swap, so the user now gets clear visual feedback (Vale branded spinner + phase label + live progress status) during the transition rather than a frozen-looking canvas.

**Behaviour.**
- New semi-transparent overlay (`#naModelGroupTransitionOverlay`) modelled on the existing layout-export overlay pattern: `--visible` / `--fade-out` class modifiers with a `transitionend` (plus 400ms fallback) teardown.
- Reuses the shared `.loading-spinner` styling from the initial loader for visual consistency.
- Shows on phase-switch start, mirrors each loader status message into the overlay, and fades out on both success and error.

**Changed / New Files**
- NEW `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelGroupTransitionOverlay__.js` (Show / UpdateStatus / Hide control).
- MOD `Index.html` (added `#naModelGroupTransitionOverlay` element).
- MOD `03__Style__AppStylesheets/Na__UiFeature__Styles__LoadingOverlays__.css` (new transition overlay CSS region).
- MOD `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelGroupSelector.js` (wired overlay into `Na__GroupSelector__LoadGroup`).

# ---------------------------------------------------------
## TrueVision3D v2.7.1  -  21-Jun-2026
### Fix — Dev-Menu R2 Saves Now Persist and Read Back

**Problem.**
- Dev-menu saves reported success (toast + no console errors) but nothing persisted on reload. Root cause was a read/write split: saves wrote to **R2**, but on localhost the app read the **local static file** (`/na-project-portal/.../TrueVision__ProjectData__.json`), never R2 — so a refresh re-loaded the untouched local file. A latent data-loss bug also existed: when R2 had no copy yet, a save wrote a document containing only the changed keys (dropping `modelGroups`, camera, etc.).

**Fix — full-document merge base.**
- `Na__CloudflareIntegration__ApiClient__.js` now holds the full loaded project data in memory (`Na__CfApi__SetLoadedProjectData` / `GetLoadedProjectData`). `Na__CfApi__MergeAndSaveKeys` / `DeleteProjectKeys` merge changes into that complete document and write the **whole** document back to R2 (then refresh the cache). Model groups / camera / everything are preserved — no more partial writes.

**Fix — localhost reads the R2 source of truth (overlay).**
- `Na__AppFlow__LoadingSequence.js` registers the loaded full data as the save merge base, and on localhost overlays only the Dev-menu-saved keys (`Na__DevSavedKeys`: `PresentationMode__SavedCameraScenes`, `Navmode__EnabledModes`, `Navmode__OrbitMaxDistanceMm`, `Camera__DefaultPosition`, `OrbitHelperCube__Position`) from the live R2 copy (worker `/r2/read`, bypasses CDN cache) onto the full base file.
- Overlaying (not replacing) guarantees model-defining keys always come from the complete base file, so a partial R2 file from a pre-fix save can never break model loading — and the next save re-seeds R2 with a complete merged document (self-healing). Production is unchanged (reads the full file from CDN).

**Result.**
- Confirmed working end to end: Dev-menu edits (camera, navigation modes, orbit max, presentation scenes + thumbnails) persist to R2 and are read back on reload without a GitHub push.

**Changed Files**
- `02__Src__AppModules/80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js` — in-memory full-document merge base + cache refresh on write.
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` — `Na__DevSavedKeys` constant, register loaded data, localhost R2 overlay.

# ---------------------------------------------------------
## TrueVision3D v2.7.0  -  21-Jun-2026
### Navigation Toolbar + Presentation Mode + Realtime R2 Dev Saves (ValeVision Parity)

**Summary.**
- Transplanted ValeVision3D's floating navigation toolbar, Presentation Mode scene-animation system, and full Dev-menu tooling into TrueVision3D. Dev-menu actions now persist straight to Cloudflare R2 (read back from R2 — no GitHub push required), via a new dedicated Worker.

**Navigation toolbar (moved out of Tools & Settings).**
- Orbit / Walk / Fly / Views / Reset View / Help now live in a floating bottom-centre pill toolbar (`#naNavToolbar`). The Walk/Fly/Orbit buttons were removed from the `#naToolsMenu` dropdown.
- Contextually dynamic position: bottom-centre by default; when a project has valid `PresentationMode__SavedCameraScenes`, `body.na-presentation-mode-active` moves the toolbar to the top and the scene carousel takes the bottom slot.
- Walk/Fly buttons reveal only when `Navmode__EnabledModes` enables them for the model (via the `na-navigation-modes-loaded` event). Reset View restores the captured project start state.

**Presentation Mode (scene animation).**
- Per-project saved camera scenes under `PresentationMode__SavedCameraScenes` in `TrueVision__ProjectData__.json`. Discrete camera snapshots with interpolated transitions (lerp position/target/FOV + quaternion slerp), a bottom thumbnail carousel, and a Views toggle button.

**Realtime R2 persistence (NEW Worker).**
- New `na-truevision-api` Worker (`80__CloudflareIntegration/CloudflareWorker/`) modelled on `na-projectadmin-api`; binds the shared `noble-architecture-cdn` bucket under the `NaProjectPortal/` prefix, exposes `/r2/read|write|list|delete` + `/health`.
- New `Na__CloudflareIntegration__ApiClient__.js` (read-merge-write to `TrueVision__ProjectData__.json` + base64 WebP thumbnail upload).
- Dev-menu saves (camera, navigation modes, orbit max distance, presentation scenes + thumbnails) now write to R2 via the Worker instead of localhost Flask. (Note: ValeVision itself uses Flask + GitHub static reads; the R2-write path is net-new per the brief.)

**Dev menu (full parity, localhost-only).**
- Re-pointed Save Camera Settings to R2.
- Added Navigation Modes (Walk/Fly enable) and Orbit Max Zoom Radius (apply live / save / clear) controls.
- Added the Presentation Scenes editor (add-from-camera, FOV/transition/easing, regenerate thumbnail, save/delete, export JSON, clear all).
- Render-engine switch intentionally skipped (TrueVision is single-pipeline). Camera-path visualizer omitted (unwired debug overlay in ValeVision).

**Assets.**
- Copied the ValeVision navigation icon set into `01__AppAssets__TrueVision/UiIcons__MenuIcons__NavigationMenu/`.

**Config.**
- Added `CloudflareConfig.CloudflareConfig__WorkerBaseUrl` to `Na__AppConfig__Main.json` (Dev-menu Worker base URL).

**Changed / New Files**
- NEW `80__CloudflareIntegration/CloudflareWorker/` (wrangler.toml, package.json, deploy.bat, `src/CloudflareWorker__Main__.js`, `src/handlers/CloudflareHandler__R2__.js`).
- NEW `02__Src__AppModules/80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js`.
- NEW `02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__NavigationToolbar__Controls.js`, `Na__UiFeature__NavigationHelpPanel__Controls.js`, `Na__Camera__ProjectStartState.js`, `Na__NavigationModes__State.js`.
- NEW `02__Src__AppModules/21__System__PresentationMode/` (`*__ProjectJson__SceneData.js`, `*__Camera__SceneTransition.js`, `*__UI__SceneCarousel.js`, `*__Thumbnail__Renderer.js`, `*__DevMenu__SceneEditor.js`).
- NEW `03__Style__AppStylesheets/Na__UiFeature__Styles__NavigationToolbar__.css`, `Na__PresentationMode__Styles__SceneCarousel__.css`.
- NEW `02__Src__AppModules/70__System__DevTools/Na__UiFeature__NavigationModes__DevControls.js`, `02__Src__AppModules/11__CameraUtils/Na__UiFeature__OrbitMaxDistance__DevControls.js`.
- CHANGED `Index.html` (toolbar/help/carousel markup, dev-menu sections, orchestrator wiring, removed Tools-menu nav buttons).
- CHANGED `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` (dispatch `na-navigation-modes-loaded` + `na-presentation-mode-scenes-loaded`, capture camera start state, apply orbit-max override).
- CHANGED `02__Src__AppModules/11__CameraUtils/Na__UiFeature__SaveCameraSettings.js` (Flask → R2).
- CHANGED `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` (CloudflareConfig).
- CHANGED `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css` (new stylesheet imports).

**Deployment note.** Deploy the Worker once with `wrangler deploy` from `80__CloudflareIntegration/CloudflareWorker/` (requires `wrangler login`). Update `CloudflareConfig__WorkerBaseUrl` if the deployed `workers.dev` subdomain differs from `na-truevision-api.adam-fb3.workers.dev`.

# ---------------------------------------------------------
## TrueVision3D v2.6.1  -  16-Jun-2026
### Camera-Follow Billboards — 2D Site Vegetation Ported from ValeVision3D

**Feature.**
- 2D billboard vegetation (`09__Site__Vegetation__2D` tag, GLB stem `TrueVision__SiteVegetation2D`) now yaw-rotates to always face the camera, mimicking SketchUp's "Always Face Camera". Mesh and linework twins rotate together around the baked `00__OriginPoint` pivot. Behaviour is driven entirely by glTF node `extras` baked by the shared SketchUp GLB Builder (`type: CameraFollowBillboard`, `pivotLocal`, `shadeFlatness`) — no Ruby changes were needed for this port.

**Flat shading.**
- Billboards opt into directional-light flattening via a per-component `shadeFlatness` (0=full directional, 1=fully flat) sourced from the Components DataLib and baked into each node's extras. An `onBeforeCompile` patch mixes the lit colour toward albedo. Models exported before the field fall back to the config `DefaultShadeFlatness` (0.85), so existing GLBs flatten without a re-export.

**Detection is category-agnostic.**
- Every loaded category is scanned for the baked billboard flag (not a name/category token), so the system is robust to which category GLB the exporter bundled the trees into.

**Rebind-aware.**
- `Na__CameraFollow__Initialize` re-scans on every call, so it rebuilds correctly through `Na__ReinitializeModelBoundSystems` model-group / design-phase switches.

**Storey + consolidation integration.**
- Floor isolation now hides/restores SiteVegetation2D alongside Landscape (`/Landscape|SiteVegetation/i`).
- Client-side instance consolidation now guards billboards (`userData.type === 'CameraFollowBillboard'`) so repeated trees are never merged into an `InstancedMesh` (which would break per-instance rotation).
- AO exclusion needs no code change: the shared `__SiteVegetation__` token is already in the DataLib AmbientOcclusion exclusion list consumed by the material swap.

**Changed Files**
- `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectInteraction__Animation__CameraFollowBillboards__.js` — new module (ported, rebind-aware).
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` — import, collect-all-categories helper, init in reinit, per-frame update.
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` — `3dObject__Interaction__CameraFollowComponents` block.
- `Index.html` — extract `Na__Config__CameraFollow`, pass `cameraFollow` in configs.
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js` — `TrueVision__SiteVegetation2D` load-order slot.
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__InstanceConsolidation__.js` — billboard guard.
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js` — display name.
- `02__Src__AppModules/26__System__ToggleModelElements/3dObject__IsolateBuildingStoreys__SystemLogic__.js` + `3dObject__ViewBuildingStoreys__SystemLogic__.js` — hide with landscape on floor isolate.

# ---------------------------------------------------------
## TrueVision3D v2.6.0  -  07-Jun-2026
### Plant Performance — Name-Based Pipeline Exclusions + Leaf Instance Consolidation

**Problem.**
- Adding a potted olive-tree (`29_4001__PottedPlant__Exterior__OliveTree__Dia450mm__`) seized the renderer. The cause was a draw-call explosion, not triangle count: the tree's `29_4001_10__Plant__SubComp__Leaf__Individual` component is placed **2,557 times**. Three.js GLTFLoader renders each instanced glTF node as its own draw call, and the linework upgrade created **2,557 separate `LineSegments2` fat-line objects** — all multiplied across the profile-normal and AO depth pre-passes (~7,000–10,000 draw calls/frame for one plant).

**Fix — three coordinated changes (leaves + stems + branches; pot untouched).**
1. **Linework omitted at export** (GLB Builder) for the excluded names, so no fat lines for the plant reach the renderer (biggest single win). See GLB Builder dev log.
2. **Leaf instance consolidation** — new `Na__ModelLoader__InstanceConsolidation__.js` collapses repeated same-geometry+material mesh nodes into a single `THREE.InstancedMesh` at load (2,557 draws → 1). Generic geometry+material bucketing with a door/interactive guard (`ADR`/`MOD`/`ROT`/`Door`) so animated assemblies are never merged. Config-flagged.
3. **AO exclusion by name** — `Na__MaterialsSystem__MaterialSwap.js` now assigns Three.js layer 1 (the existing SSAO/profile pre-pass exclusion layer) to meshes whose node or ancestor name matches the Ambient Occlusion token list, in addition to the existing material-level `AoExclude` flag.

**SSOT.**
- New `Na__DataLib__PipelineExclusions` section in the Components DataLib (`Na__DataLib__CoreIndex__Components__.json`, bumped to v1.1.0) holds two contains-matched token lists: `Na__DataLib__PipelineExclusions__AmbientOcclusion` and `Na__DataLib__PipelineExclusions__ProfileLines`. Tokens (`__Plant__SubComp__Stem`, `__Plant__SubComp__Branches`, `__Plant__SubGroup__LeavesContainer`, `__Plant__SubComp__Leaf__Individual`) generalise to any plant following the naming convention and never match `__PlantPot`.

**Config.**
- `models.RenderConfig__InstanceConsolidation` added to `Na__AppConfig__Main.json` (`Enabled`, `MinInstanceCount: 16`, `FoliageCastShadow: false`).

**Changed Files**
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__InstanceConsolidation__.js` — new module.
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js` — import + invoke consolidation per category mesh root.
- `02__Src__AppModules/20__System__MaterialsSystem/Na__MaterialsSystem__MaterialSwap.js` — name-based AO exclusion (layer 1) + helpers.
- `02__Src__AppModules/01__AppCore/AppCore__DataLib__Loader.js` — `Na__DataLib__GetPipelineExclusions()` getter.
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` — `RenderConfig__InstanceConsolidation` block.
- `Na__DataLib__CoreIndex__Components__.json` (DataLib repo) — new exclusion section + version bump.

**Note.** Linework omission requires a re-export of the model. Name-based AO covers instanced/named geometry (leaves) directly; flattened stems/branches rely on their foliage/stem material's `AoExclude` flag.

# ---------------------------------------------------------
## TrueVision3D v2.5.3  -  07-Jun-2026
### Distance Culling — Correct Bounds for Nested + Instanced Geometry (Leaf Pop-In Fix)

**Symptom.** Plant leaves popped in/out at seemingly random camera positions — their cull distance was being measured against a wrong cached centre.

**Root cause.** The bounds computation transformed each node's local `boundingBox` by its `matrixWorld`. That is correct for ordinary nesting, but **wrong for `InstancedMesh`**: GLTF foliage is frequently instanced, and the per-instance `instanceMatrix` offsets are not captured by the node's single `matrixWorld`. The leaf cluster's cached centre therefore collapsed onto the base/origin instance, so the leaves appeared/disappeared relative to that wrong point.

**Fix.** `Na__RenderEffect__DistanceCulling__.js` now computes item world bounds with `THREE.Box3.setFromObject(itemNode)`, which walks arbitrarily deep group/component nesting and expands `InstancedMesh` by every instance matrix. Fat-line `LineSegments2` endpoints (which `setFromObject` does not bound) are still unioned in explicitly via their `instanceStart` / `instanceEnd` attributes, so linework remains bounded too. Removed the now-unused per-child scratch box.

**Changed Files**
- `02__Src__AppModules/05__RenderPipeline/Na__RenderEffect__DistanceCulling__.js` — `ComputeWorldBounds` rewritten (setFromObject + fat-line union); module v1.1.0.

# ---------------------------------------------------------
## TrueVision3D v2.5.2  -  07-Jun-2026
### Distance Culling — Linework Now Hides (Profile-Lines Pass Was Overriding It)

**Root cause (the real one).**
- Every object is rendered twice: a Mesh model and a completely separate fat-line (`LineSegments2`) linework model. The **profile-lines render pass** (`renderProfileNormals`, run every frame inside the composer block) collects *all* `LineSegments2` in the scene, hides them for its normal pre-pass, then **restored them to a hardcoded `visible = true`**. This ran *after* `Na__DistanceCulling__Update`, so it silently un-hid every linework item the culler had just hidden — every frame. That is why only the mesh disappeared while the linework stayed.

**Fix.**
- `Na__RenderEffect__ProfileLines__.js` now **saves each line object's prior visibility** before the normal pre-pass and **restores to that saved state** (instead of forcing `true`). External per-object visibility — distance culling today, anything similar in future — is now preserved across the profile-lines pass. Mesh material swap/restore logic is unchanged.
- Added a pre-allocated `cachedLineVisibility` backup array (sized in `rebuildSceneCache`) so the save/restore is allocation-free per frame.

**Also (carried from the same investigation).**
- `Na__RenderEffect__DistanceCulling__.js` bounds fat-line items by reading their interleaved `instanceStart` / `instanceEnd` endpoint attributes directly (these are not bounded reliably by `Box3.setFromObject` / `geometry.boundingBox`), so linework items register with correct world bounds and cull in lockstep with their mesh twins.

**Changed Files**
- `02__Src__AppModules/05__RenderPipeline/Na__RenderEffect__ProfileLines__.js` — save/restore prior line visibility instead of forcing `true`; added `cachedLineVisibility` backup array.

# ---------------------------------------------------------
## TrueVision3D v2.5.1  -  07-Jun-2026
### Distance Culling — Linework + Foreground-Clipping Fixes

**Bug 1 — Linework was never culled (only the mesh model hid).**
- Every item is rendered twice (a Mesh model + a paired fat-line `LineSegments2` linework model). Fat lines store their segment endpoints in interleaved `instanceStart` / `instanceEnd` attributes; neither `Box3.setFromObject()` nor `geometry.boundingBox` bounds these reliably, so linework items returned empty bounds and were silently skipped from the cull registry.
- Fix: `Na__DistanceCulling__ComputeWorldBounds` now reads the fat-line `instanceStart` / `instanceEnd` attributes directly (via `getX/getY/getZ`, transformed by `matrixWorld`) to build the world AABB, and uses the cached local `boundingBox` only for standard mesh geometry. Linework items are now bounded and cull in lockstep with their mesh counterparts. Registration logging reports mesh vs linework item counts for verification.

**Bug 2 — Items near the camera were wrongly clipped.**
- Furniture/decor categories contain large merged-by-material meshes (e.g. `28__ProposedBuilding__FurnitureDefault`, merged `Linework`) that span an entire storey. Culling by their single centroid hid the whole merged blob — including parts right in front of the camera — until the camera neared the centroid (hence "move forward and they pop back").
- Fix: switched from centroid culling to **nearest-point (radius-aware) culling**. Each item caches a bounding-sphere radius and a threshold of `(cullDistance + radius)^2`; an item hides only when its nearest point is beyond the cull distance. Large merged meshes stay visible while any part is near; compact distant items still cull normally.

**Changed Files**
- `02__Src__AppModules/05__RenderPipeline/Na__RenderEffect__DistanceCulling__.js` — robust world-bounds computation, per-item radius-aware squared threshold, `Update` now compares against per-item `thresholdSq`.

# ---------------------------------------------------------
## TrueVision3D v2.5.0  -  07-Jun-2026
### Furniture / Interior-Decor Distance Culling

**Overview**
- Interior furniture and decor (pillows, chairs, beds, etc.) add a large per-frame render cost while contributing little when viewed from a distance.
- Added a config-driven per-item distance-culling system that hides furniture and interior-decor items beyond a configurable radius from the active camera. Default ON at 15 m.

**Behaviour**
- Per individual item: each item node under a matching category's `__MeshRoot` and `__LineworkRoot` is toggled independently by radial distance from the active camera (works in orbit, walk, and fly modes).
- Squared-distance comparison (no `sqrt`); each item's world-space centre is cached once at registry build, so the per-frame cost is a single distance check per item.
- Runs only inside the invalidation-based render loop (camera-move frames), so idle cost is zero.
- Sets `.visible` on individual item nodes only — never on category groups — so it composes safely with the model-toggle and storey visibility systems via the THREE.js visibility hierarchy.
- The cull registry is rebuilt in `Na__ReinitializeModelBoundSystems`, so it stays correct after model-group switches.

**New Module: `Na__RenderEffect__DistanceCulling__.js`** (`02__Src__AppModules/05__RenderPipeline/`)
- `Na__DistanceCulling__Initialize(config)` — reads enable flag, converts `CullDistanceMm` to units, stores category tokens.
- `Na__DistanceCulling__RegisterModelGroups(loadedGroups)` — builds the per-item registry from categories whose key matches a configured token.
- `Na__DistanceCulling__Update(cameraWorldPos)` — toggles item visibility against the cull distance; returns whether anything changed.
- `Na__DistanceCulling__SetEnabled(bool)` / `Na__DistanceCulling__IsEnabled()` — runtime toggle (disable restores all items to visible).

**Changed Files**
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` — new `RenderEffect__DistanceCulling` block (`Enabled`, `CullDistanceMm: 15000`, `CategoryNameTokens: ["Furniture", "InteriorDecor", "Decor"]`).
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` — imports the module; initialises it from config; registers groups in `Na__ReinitializeModelBoundSystems`; calls `Na__DistanceCulling__Update` in `Na__RenderLoop__RenderFrame` before the composer render.
- `index.html` — extracts `Na__Config__DistanceCulling` and passes it through the `configs` object to `Na__AppFlow__StartLoadingSequence`.

# ---------------------------------------------------------
## TrueVision3D v2.4.1  -  07-Jun-2026
### Edge Colour Lightness Calibration

**Overview**
- SketchUp MTE edge colours are calibrated for the SketchUp viewport and render slightly too bright in TrueVision's lit white-card environment.
- Added a configurable HSL lightness reduction applied at load time to all vertex colours extracted from linework GLBs. The source data files (SketchUp DataLib) are not modified.

**Rule**
- Lightness values from the MTE greyscale series are reduced by 10 units (0-100 scale) in TrueVision: L20→L10, L40→L30, L45→L35, etc. Accent colours darkened equivalently in HSL space. Absolute black (L0) clamped at 0 and unchanged.

**Changed Files**
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__LineworkColours__.js` — new `Na__ModelLoader__DarkenExtractedColors(colorArray, lightnessReductionAmount)` function added and exported.
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js` — imports and calls `Na__ModelLoader__DarkenExtractedColors` in `Na__ModelLoader__UpgradeLineworkRoot` immediately after colour extraction.
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` — `RenderConfig__Linework__EdgeColorLightnessReduction: 10` added to `RenderConfig__Linework` (adjust to tune).

# ---------------------------------------------------------
## TrueVision3D v2.4.0  -  06-Jun-2026
### Edge Colour System — Full Parity with ValeVision3D

**Overview**
- Fixed a critical bug where SketchUp MTE edge colours exported as glTF `COLOR_0` vertex colours were being silently annihilated by an incorrect `LineMaterial.color` multiplier. All coloured linework was rendering as near-black regardless of the actual vertex colour data.
- Ported ValeVision3D's complete linework colour infrastructure to TrueVision, including dominant colour votes, name-based colour matching, and per-mesh profile colour propagation.
- Split colour logic out of `Na__ModelLoader__MultiModel.js` into `Na__ModelLoader__LineworkColours__.js`.

**Root Cause Fixed**
- `LineMaterial.color` was set to the config fallback colour (`0x141414`, near-black) even when `vertexColors: true`. In Three.js, `LineMaterial` multiplies `material.color × vertexColor`, so a near-black multiplier collapsed every vertex colour to near-black. Fix: set `color = 0xffffff` (white, multiplicative identity) when vertex colours are present.

**New Module: `Na__ModelLoader__LineworkColours__.js`**
- `Na__ModelLoader__ExtractLineColors` — safe `fromBufferAttribute` extraction.
- `Na__ModelLoader__BuildColorKey` / `Na__ModelLoader__RegisterColorVote` / `Na__ModelLoader__ResolveDominantColor` / `Na__ModelLoader__ResolveDominantImportedLineColor` — weighted colour vote map.
- `Na__ModelLoader__FindColorByName` + `Na__ModelLoader__ResolveProfileColorForObject` — exact and longest-prefix name matching.
- `Na__ModelLoader__ApplyProfileLineColoursToMeshRoot` — propagates `Na__ProfileLineColor` userData to paired mesh nodes for profile-line depth cue effects.

**Updated: `Na__ModelLoader__MultiModel.js`**
- Imports colour utilities with `@delegate:` pointer.
- `Na__ModelLoader__UpgradeLineworkRoot` extracted from inline `LoadSingleLinework`.
- Node `name`, `visible`, and `userData` preserved during fat-line upgrade.
- `Na__ModelLoader__ApplyProfileLineColoursToMeshRoot` called in both loops of `Na__ModelLoader__LoadAllModels`.
- Exports updated to include `Na__ModelLoader__UpgradeLineworkRoot` and `Na__ModelLoader__ApplyProfileLineColoursToMeshRoot`.

**Updated: `Na__AppConfig__Main.json`**
- `RenderEffect__ProfileLines__ColorPassIncludesLinework: true` added — was already read by ProfileLines module, now declared in SSOT config.

# ---------------------------------------------------------
## TrueVision3D v2.3.9  -  06-Jun-2026
### Door Animation — Interior Doors: Sign-Convention Inversion vs Bifold

**Root cause (confirmed by scene-graph diagnostics + cross-system comparison)**

Per-door diagnostics proved the loaded GLB is clean: every door has `det=1`, `scale=(1,1,1)`, and TrueVision faithfully applies the signed angle baked into each MOD name. So there is no mirror and no math error in the animation engine. Bifold doors swing correctly; interior doors swing 180° inverted.

The discriminator is the **sign convention used by the two SketchUp builders**:
- The **bifold (ExtFold) system** computes its MOD rotation degrees via `na_compute_panel_rot_degrees`, and its sign was **calibrated empirically against TrueVision's actual rendered swing** — see the ExtFold AllOneWay devlog v1.7.2: *"Right-cascade master now swings OUTWARD (+90 deg) instead of into the room (-90 deg)."* They flipped the sign because they watched it open the wrong way in TV.
- The **interior door system** (older Element Assembly Studio code) derives its MOD sign from pure SketchUp geometric logic (`na_resolve_mod_panel_name`) and was never validated against TV. It is internally self-consistent with the SketchUp swing arc, but renders inverted in TV.

Same animation code, opposite real-world result — because the bifold convention already bakes in a TV compensation the interior convention lacks.

**Fix: `3dObjectIInteraction__Animation__ClickToOpenDoors__.js` (v1.6.0)**
- Added `Na__DoorAnim__ResolveInteriorInversionSign(adrObject)`: when AppConfig `3dObject__Interaction__DoorAnimation__InteriorRotationInverted` is `true` (default), doors whose ADR name contains `InteriorDoor` receive a `-1` rotation sign, landing them on the same TV-correct convention bifold uses.
- Folded into `panel.rotationSign` alongside the existing mirror-determinant sign, applied in `ApplyPanelTransform`.
- Bifold, sliding, and exterior doors are unaffected (name token gate).
- **Reversible via AppConfig, no GLB re-export required** — hard-reload to test.

**Config: `Na__AppConfig__Main.json`**
- Added `3dObject__Interaction__DoorAnimation__InteriorRotationInverted: true`.

**If this over-corrects** (i.e. an interior door that was previously correct now swings wrong), that proves the inversion is per-door (mismatched SwingSide/SwingDirection config in SketchUp) rather than global, and we narrow to those specific doors.

---

# ---------------------------------------------------------
## TrueVision3D v2.3.8  -  06-Jun-2026
### Door Animation — TRUE Root Cause: Mirrored Door Instances Swing Reversed

**This is the actual fix for the "interior doors open 180 degrees the wrong way" bug.**

The previous version notes (v2.3.6 / v2.3.7) chased the SketchUp side (MOD name angle, instancing, open-state leakage). A scene-graph log proved the exported GLB was correct: exactly one MOD per door, correct signed angle in the name (`MOD001__ROT__-90-Deg__DoorPanel`), no open-state copy. The bug was purely in TrueVision's animation.

**Root Cause**
`Na__DoorAnim__ApplyPanelTransform` rotates each MOD about the door's LOCAL `+Y` axis `(0,1,0)`. That local rotation only maps to the intended WORLD swing when the door's accumulated world transform is a proper rotation (determinant > 0).

Interior doors are routinely **mirror-copied** between rooms (and/or sit under a mirrored storey container). A mirrored instance carries a **negative-determinant** world transform. A mirror converts a right-handed rotation into a left-handed one — `M · R(θ) · M⁻¹ = R(−θ)` when the mirror plane contains the vertical axis — so the fixed local `+Y` swing appears reversed in world space and the door opens 180° the wrong way.

This precisely matches the observed behaviour:
- Top-level (non-mirrored) interior doors → correct.
- Nested / mirrored interior doors → flipped.
- Bifold doors on the same storey (not mirrored) → correct.

**Fix: `3dObjectIInteraction__Animation__ClickToOpenDoors__.js` (v1.5.0)**
- Added `Na__DoorAnim__ResolveMirrorSign(adrObject)` — calls `updateWorldMatrix` then reads `adrObject.matrixWorld.determinant()`, returning `-1` for mirrored doors and `+1` otherwise.
- `Na__DoorAnim__BuildPanelDescriptor` stores the result in `panel.rotationSign` (resolved once at scan time; the determinant sign is static for the door's lifetime).
- `Na__DoorAnim__ApplyPanelTransform` multiplies the swing angle by `panel.rotationSign`, so mirrored doors swing in the intended world direction. Non-mirrored doors are unchanged.
- MVE translation is intentionally **not** sign-corrected: a mirrored sliding/bifold panel and its track are mirrored together, so the local-space translation already lands on the correct side.

**No re-export required** — this is a runtime animation fix. Hard-reload the app to pick up the new module.

---

# ---------------------------------------------------------
## TrueVision3D v2.3.7  -  06-Jun-2026
### Door Animation — Root Cause Fix: Open-State MOD Leaking Into GLB

**Root Cause of "180° Flip" Bug (was misdiagnosed in v2.3.6)**

The doors appeared to open 180° wrong because the GLB contained **two** MOD panels per door: the closed-state panel (correct) and the open-state authoring copy (already pre-rotated in SketchUp by the composer). TrueVision registered both as animatable panels and applied the rotation angle to both — but the open-state copy started at its pre-rotated position, so the same rotation pushed it to −180° from the correct open position, which dominated the visual result.

This happened because `Na__Door__Open` was not in the DataLib's `FullyExcludedTagNames`. Our earlier hardcoded-fallback fix (v2.3.6 Bug 3) only applied when DataLib load *fails*; when DataLib loads successfully the hardcoded list is ignored entirely.

**Fix: `Na__TrueVision__GlbBuilder__SpecialObject__DoorObjectHandling__.rb`**
- Added `DOOR_OPEN_LAYER_NAME = "Na__Door__Open".freeze` constant.
- Added an unconditional guard at the top of `Na__DoorHandler__ChildExportDecision` that immediately returns `[false, "open_state_preview_always_excluded"]` for any entity tagged `Na__Door__Open`, **before** the DataLib exclusion check and **before** the tag-visibility check. This makes the guard impossible to bypass by exporting in open-state preview mode or by DataLib configuration drift.

**Cleanup: `Na__AssemblyStudio__InteriorDoorSystem__DoorAssemblyComposer__.rb`**
- Removed the four redundant intermediate constants (`NA_GROUP_NAME_MOD_PANEL_RIGHT_OUTWARD`, `_RIGHT_INWARD`, and the over-commented aliases) introduced in v2.3.6. Restored to the original two reference constants plus the legacy alias — the dynamic `na_resolve_mod_panel_name` function already generates the correct name and the extra constants added noise.

**Action required**
Re-export the affected storey GLBs. The open-state MOD will now be silently excluded regardless of the `Na__Door__Open` tag visibility in SketchUp at export time.

---

## TrueVision3D v2.3.6  -  06-Jun-2026
### Door Animation — Six-Bug Fix (Rotation Direction, Instancing, Leakage, Duplicate Code)

**Overview**
Six related bugs in the door animation pipeline have been fixed. The primary symptom was interior doors nested inside storey groups (`90__Storey__*`) opening 180° in the wrong direction. Secondary issues caused identical repeated door instances to become permanently static, open-state panel geometry to pollute GLBs, and the test-sandbox door finder to silently return empty results for storey-mode scenes.

---

**Bug 1 — CRITICAL (SketchUp): MOD degree ignored hinge side → left-handed doors always opened 180° wrong**
- File: `Na__AssemblyStudio__InteriorDoorSystem__DoorAssemblyComposer__.rb`
- `na_resolve_mod_panel_name` used two fixed constants (`-90-Deg` for outward, `+90-Deg` for inward) regardless of hinge side. These are correct only for right-handed doors; left-handed doors need opposite signs.
- Fix: `na_resolve_mod_panel_name` now mirrors the same `base_angle × sign` formula as `na_compute_open_rotation_transform` (accounting for both `Na__DoorConfig__SwingSide` and `Na__DoorConfig__SwingDirection`). This produces the correct signed degree token for all four hinge+swing combinations.
- Truth table:  Left+Inward→`-90`, Right+Inward→`+90`, Left+Outward→`+90`, Right+Outward→`-90`.
- Old fixed constants renamed to `NA_GROUP_NAME_MOD_PANEL_RIGHT_OUTWARD` / `_RIGHT_INWARD` for clarity; old aliases retained.

**Bug 2 — HIGH (GLB Exporter): Instancing skip-set fired before ADR check → repeat-definition doors lost animation hierarchy**
- Files: `Na__TrueVision__GlbBuilder__EngineCore__.rb` (top-level entity loop), `Na__TrueVision__GlbBuilder__EngineCore__GeometryHandling__.rb` (`TraverseEntities`)
- `next if instanced_skip_set.key?(entity.object_id)` was evaluated before `Na__DoorHandler__IsDoorAssembly?`. If a door ComponentDefinition appeared more than once, the second (and any subsequent) instance was silently consumed by the instancing path, which flattens geometry into a static mesh without preserving the ADR/MOD/ROT hierarchy. Those doors became permanently static in TrueVision.
- Fix: moved the `IsDoorAssembly?` check to before the instancing skip in both locations. Door assemblies now always bypass the instancing skip-set so every instance gets its own hierarchy node in the GLB.

**Bug 3 — MEDIUM (GLB Exporter): `Na__Door__Open` missing from hardcoded exclusion fallback → open-state MODs leaked into GLB**
- File: `Na__TrueVision__GlbBuilder__Main__.rb`
- `ALWAYS_EXCLUDED_LAYER_NAMES` did not include `Na__Door__Open`. If the DataLib load failed at export time, or if the SketchUp model was in open-state preview mode during export, the open-state MOD (already rotated 90° by `na_compose_open_state_copy`) was written into the GLB alongside the closed-state MOD. TrueVision then found two MOD siblings with the same name, registered both as panels, and animated the already-open one past its correct open position.
- Fix: added `"Na__Door__Open"` to `ALWAYS_EXCLUDED_LAYER_NAMES`.

**Bug 4 — MEDIUM (TrueVision): `Na__DoorAnimation__FindDoorGroups.js` used wrong traversal level and never worked for storey-mode**
- File: `Na__DoorAnimation__FindDoorGroups.js`
- The original single-level loop checked direct children of `rootGroup` for names containing both a door token AND 'Mesh'/'Linework'. Category group names (e.g. `Storey__GroundFloor__ProposedDoors`) never contain 'Mesh'/'Linework', so both output arrays were always empty for any scene. The production app was not affected (it uses `Na__CollectDoorModelGroups` inline), but the test sandbox was silently broken.
- Fix: rewritten as a two-level traversal: outer loop finds category groups containing a door token; inner loop reads `child.userData.Na__ModelType` to split mesh/linework roots — identical to the production `Na__CollectDoorModelGroups` logic and robust for flat and storey GLBs alike.

**Bug 5 — LOW (TrueVision): Fragile index-order fallback in `Na__CollectDoorModelGroups`**
- File: `Na__AppFlow__LoadingSequence.js`
- `Na__CollectDoorModelGroups` fell back to `children[0]`/`children[1]` when neither child had `userData.Na__ModelType`. The tag is set on every real load path, so the fallback was unreachable dead code — but it was a correctness landmine for any future async load-order change.
- Fix: replaced fallback with a `console.warn` that identifies the category key and skips it cleanly.

**Bug 6 — LOW (TrueVision): Dead legacy exports in `ClickToOpenDoors__.js`**
- File: `3dObjectIInteraction__Animation__ClickToOpenDoors__.js`
- `Na__DoorAnim__FindModRotChild` and `Na__DoorAnim__ApplyPivotRotation` were exported as "backward compat" but had no known callers anywhere in the codebase. Keeping them in the export surface created confusion about whether they were part of the public API.
- Fix: both functions removed; exports block updated with removal comments.

---

# ---------------------------------------------------------
## TrueVision3D v2.3.5  -  06-Jun-2026
### Edge Colour System — Full Parity with ValeVision3D

**Overview**
- Fixed a critical bug where SketchUp MTE edge colours exported as glTF `COLOR_0` vertex colours were being silently annihilated by an incorrect `LineMaterial.color` multiplier. All coloured linework was rendering as near-black regardless of the actual vertex colour data.
- Ported ValeVision3D's complete linework colour infrastructure to TrueVision, including dominant colour votes, name-based colour matching, and per-mesh profile colour propagation.
- Split colour logic out of `Na__ModelLoader__MultiModel.js` into a dedicated `Na__ModelLoader__LineworkColours__.js` module, keeping the loader file focused on loading and geometry.

**Root Cause Fixed**
- `LineMaterial.color` was set to the config fallback colour (`0x141414`, near-black) even when `vertexColors: true`. In Three.js, `LineMaterial` multiplies `material.color × vertexColor`, so a near-black multiplier collapsed every vertex colour to near-black. Fix: set `color = 0xffffff` (white, multiplicative identity) when vertex colours are present.

**New Module: `Na__ModelLoader__LineworkColours__.js`**
- `Na__ModelLoader__ExtractLineColors(geometry)` — safe `fromBufferAttribute` extraction with normalisation.
- `Na__ModelLoader__BuildColorKey()` / `Na__ModelLoader__RegisterColorVote()` / `Na__ModelLoader__ResolveDominantColor()` — weighted vote map for dominant colour resolution.
- `Na__ModelLoader__ResolveDominantImportedLineColor(importedColors)` — dominant colour from a flat colour array.
- `Na__ModelLoader__FindColorByName()` + `Na__ModelLoader__ResolveProfileColorForObject()` — exact and longest-prefix name matching up the ancestor chain.
- `Na__ModelLoader__ApplyProfileLineColoursToMeshRoot()` — propagates `Na__ProfileLineColor` userData from linework root to every paired mesh node for profile-line depth cue effects.

**Updated: `Na__ModelLoader__MultiModel.js`**
- Imports colour utilities from `Na__ModelLoader__LineworkColours__.js` with `@delegate:` pointer.
- Extracted inline upgrade logic into `Na__ModelLoader__UpgradeLineworkRoot()`.
- `Na__ModelLoader__LoadSingleLinework()` is now a thin loader that calls `UpgradeLineworkRoot`.
- Node `name`, `visible`, and `userData` are now correctly preserved during fat-line upgrade.
- `Na__ModelLoader__ApplyProfileLineColoursToMeshRoot()` called in both loops of `Na__ModelLoader__LoadAllModels()`.
- Exports updated to include `Na__ModelLoader__UpgradeLineworkRoot` and `Na__ModelLoader__ApplyProfileLineColoursToMeshRoot`.

**Updated: `Na__AppConfig__Main.json`**
- Added `RenderEffect__ProfileLines__ColorPassIncludesLinework: true` to the `RenderEffect__ProfileLines` block. The ProfileLines module already reads this key — it was missing from the config (SSOT).

**What This Enables**
- Coloured linework from SketchUp MTE edge materials (e.g. depth cue grey series, accent colours) now displays correctly in TrueVision.
- Auto-detected silhouette edges (Sobel profile-lines pass) now inherit the linework vertex colour at that pixel rather than collapsing to the grey fallback.
- Per-mesh `Na__ProfileLineColor` metadata is available for future per-mesh profile colour overrides.

# ---------------------------------------------------------
## TrueVision3D v2.3.4  -  06-Jun-2026
### DataLib Single Source of Truth — Local Materials Library Removed

**Overview**
- Eliminated the duplicate `Na__AppConfig__MaterialsLibrary.json` that lived inside the TrueVision source tree. The SketchUp plugins repo (`Na__Common__DataLib__CoreSuEntityStandards`) is now the single source of truth for all indexed material definitions.
- New `AppCore__DataLib__Loader.js` module fetches all four DataLib index files in parallel from their GitHub raw URLs at startup and caches them for the session.
- Network log confirmed all four GitHub raw URLs resolved on first load (06-Jun-2026).

**New Module: `AppCore__DataLib__Loader.js`**
- `Na__DataLib__LoadAll()` — parallel fetch of all 4 DataLib files, call once at startup.
- `Na__DataLib__GetMaterials()` / `Na__DataLib__GetTags()` / `Na__DataLib__GetComponents()` / `Na__DataLib__GetEdgeMaterials()` — cached getters for each index.
- `Na__DataLib__IsReady()` — boolean guard.
- Error handling: `na-show-toast` event dispatched + rethrow on any URL failure.

**DataLib URLs (hardcoded in loader):**
- Materials: `https://raw.githubusercontent.com/Adam-Noble-01/Plugins/main/Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Materials__.json`
- Tags, Components, EdgeMaterials — same repo prefix.

**Changed Files**
- `02__Src__AppModules/01__AppCore/AppCore__DataLib__Loader.js` — new module (see above).
- `02__Src__AppModules/20__System__MaterialsSystem/Na__MaterialsSystem__LibraryLoader.js` — v2.0.0: removed `LoadLibrary()` fetch; `BuildLookup()` updated to use `Na__DataLib__CoreIndex__Materials` root key.
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` — calls `Na__DataLib__LoadAll()` at sequence start; uses `Na__DataLib__GetMaterials()` instead of local fetch.
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` — `MaterialsSystem__Config__LibraryUrl` removed.
- `80__Testing__PrototypeEnvironment/TestEnv__SubAppData__Config.json` — `MaterialsSystem__Config__LibraryUrl` removed.
- `80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__Main__.js` — both `Na__MaterialsSystem__LoadLibrary` call sites replaced with `Na__DataLib__GetMaterials()`.
- `02__Src__AppModules/02__AppData/Na__AppConfig__MaterialsLibrary.json` — **DELETED**.
- `Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Materials__.json` — MAT161 `BaseColor` corrected to `rgb(207, 213, 207)`.
- `.cursor/rules/30-materials-library-single-source-of-truth.mdc` — updated to reference the DataLib GitHub URL as the sole authority.

# ---------------------------------------------------------
## TrueVision3D v2.3.3  -  06-Jun-2026
### Scene Inspector — Instance Aggregation + Download .txt

**Scene Inspector — Instance Aggregation**
- Sibling nodes in the scene tree that share the same base name (after stripping TrueVision `_IDxxxxxxx` instancing suffixes) are now collapsed into a single aggregated row in the DOM tree.
- The row shows the base name, a green `×N` instance count badge, and a tooltip with total triangle count. A single visibility dot toggles all instances together.
- All underlying `nodeRef` objects are still registered in the NodeRegistry so Hide All / Restore All operate correctly on every individual node.
- Applies to both the interactive DOM tree and the exported text log (both concise and full reports). Aggregated text lines are formatted as `Mesh 29_4004__Plant__SubComp__Leaf_1 [×2557]`.
- Threshold is 2+ siblings with matching base name. Catches: instanced plant leaves (`_IDxxxxxxx`), chimney pots, window groups, anonymous `[unnamed]` linework segments.

**Scene Inspector — Download .txt**
- New "Download .txt" toolbar button exports the same concise + full report as a timestamped `TrueVision_SceneLog_YYYY-MM-DD_HH-MM-SS.txt` file.
- Shares the `Na__SceneInspector__BuildReportText` helper with the existing Copy Tree button to avoid duplication.
- Button shows "Downloaded!" feedback text for 1.5 s after triggering.

**Changed Files**
- `02__Src__AppModules/70__System__DevTools/Na__UiFeature__SceneInspector__Controls.js` — v1.1.0: aggregation region, `BuildAggregatedGroupNode`, `BuildAggregatedTextLine`, `GroupSiblingsByBaseName`, `ExtractBaseName`, `BuildReportText`, `DownloadTree`, updated `BuildDomTree`, `WalkTreeToText`, `GetDomElements`, `InitializeSceneInspector`.
- `index.html` — Download .txt button added to scene inspector toolbar.
- `03__Style__AppStylesheets/Na__UiFeature__Styles__SceneInspector__.css` — `na-scene-inspector__count--instances` modifier for the green ×N badge.

# ---------------------------------------------------------
## TrueVision3D v2.3.2  -  06-Jun-2026
### AO Exclusion System — Plant Foliage Excluded from SSAO

**Overview**
- Added a material-level `AoExclude` flag to the materials library. Any material with `AoExclude: true` is excluded from both depth pre-pass render paths so the SSAO shader never accumulates occlusion on those meshes.
- `MAT160__Generic__PlantFoliage` is the first material to use this flag.

**Mechanism (Three.js Layers)**
- During material swap (`Na__MaterialsSystem__MaterialSwap.js`), meshes whose library config has `AoExclude: true` are moved to Three.js **layer 1** (`node.layers.set(1)`) and tagged `node.userData.na_aoExclude = true`.
- In `Na__RenderPipeline__PostProcessing__Setup.js`, `camera.layers.enable(1)` is called once at setup so layer 1 objects remain visible in the main `RenderPass`.
- Both depth render calls (`renderDepthPrePass` and the profile-lines `renderProfileNormals` wrapper) temporarily call `camera.layers.disable(1)` before the render and `camera.layers.enable(1)` after. This is an O(1) bitmask operation — zero per-frame traversal cost.
- Since neither depth path writes depth data for foliage pixels, the SSAO shader sees `centerDepth = 1.0` (far-plane / no geometry) for those pixels and exits the AO loop at the existing `centerDepth >= 1.0` early-return branch.

**Side Effect (Bonus)**
- Foliage is also excluded from the profile lines normal pass, so the edge-detection shader will not attempt to draw hard outlines on organic leaf geometry.

**Changed Files**
- `02__Src__AppModules/02__AppData/Na__AppConfig__MaterialsLibrary.json` — v2.3.2: `AoExclude: false` added to MAT001 default template; `AoExclude: true` on MAT160 and MAT161.
- `Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Materials__.json` — v1.2.0: same additions synced to SketchUp DataLib (MAT161 added directly by user).
- `02__Src__AppModules/20__System__MaterialsSystem/Na__MaterialsSystem__MaterialSwap.js` — AO-exclusion block added to traverse; `AoExcluded` counter in log output.
- `02__Src__AppModules/05__RenderPipeline/Na__RenderPipeline__PostProcessing__Setup.js` — `camera.layers.enable(1)` at init; `disable(1)` / `enable(1)` wrapping both depth render paths.

# ---------------------------------------------------------
## TrueVision3D v2.3.1  -  06-Jun-2026
### Materials Library — MAT160__Generic__PlantFoliage Added

**Overview**
- Added `MAT160__Generic__PlantFoliage` to the MAT100 BasicSeries in the materials library.
- Material is double-sided and semi-transparent to support single-plane leaf geometry without backface culling artefacts.
- No renderer or exporter code changes were required — `IsDoubleSided` and `Transparent` flags are already handled by the existing `Na__MaterialsSystem__CreatePbrMaterial` pipeline.

**Material Settings**
- `SketchUpName` : `MAT160__Generic__PlantFoliage` (paint this name onto faces in SketchUp)
- `BaseColor`    : `rgb(140, 150, 125)` — muted sage green
- `Opacity`      : `0.9` — slight leaf translucency
- `Transparent`  : `true` — enables THREE.js alpha blending
- `IsDoubleSided`: `true` — both faces rendered; prevents invisible backsides on single-plane leaves
- `PbrRoughness` : `0.85` — matte leaf surface

**Changed Files**
- `02__Src__AppModules/02__AppData/Na__AppConfig__MaterialsLibrary.json` — v2.2.1 → v2.3.0, MAT160 entry added to MAT100__BasicSeries__.
- `Na__Common__DataLib__CoreSuEntityStandards/Na__DataLib__CoreIndex__Materials__.json` — v1.0.0 → v1.1.0, same entry synced to SketchUp DataLib so GLB exporter embeds `doubleSided: true` and `alphaMode: BLEND` into exported files automatically.

# ---------------------------------------------------------
## TrueVision3D v2.3.0  -  25-May-2026
### User Guide — Accordion Sections, Fly Mode Docs, Whitecard Restyle

**Overview**
- Restyled the User Guide modal from the Vale dark blue panel to a clean light whitecard panel, matching TrueVision's scene aesthetic.
- Each section (Orbit, Walk, Fly, Hotkeys, Isolation Tools) is now a collapsible accordion with a chevron arrow toggle. All sections start expanded.
- Added a Fly Mode section covering WASD + Q/E ascend/descend, pointer-lock mouse look, Alt precision, Shift boost, and touch controls.
- Added the `Alt+Shift+F` hotkey entry to the Global Hotkeys section.
- Added a small SVG mode icon beside each section title (orbit, walk, fly, keyboard, layers).

**Changed Files**
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__Content__.html` — Accordion structure, mode icons, Fly Mode section, Alt+Shift+F hotkey.
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UiFeature__Styles__UserInstructions__.css` — Light whitecard modal, accordion toggle/body/chevron styles, CSS variables for colours.
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__SystemLogic.js` — Added `Na__UserInstructions__InitAccordions` function; called after content injection in `Na__UserInstructions__Initialize`.

# ---------------------------------------------------------
## TrueVision3D v2.2.9  -  25-May-2026
### Fly Mode — Free-Flight Navigation With WASD / Arrows / Mouse / Door Proximity

**Overview**
- Added a third navigation mode alongside Orbit and Walk: a free-flying camera designed for users familiar with first-person shooter / SketchUp-style fly controls.
- Mirrors the existing Walk Mode module layout exactly so the codebase stays consistent and developers can navigate either system using the same mental model.
- Reuses the existing door proximity system so doors open and close as the camera flies near them, matching Walk Mode behaviour.

**Controls (Desktop)**
- `W` / `ArrowUp`        → Forward
- `S` / `ArrowDown`      → Backward
- `A` / `ArrowLeft`      → Strafe Left
- `D` / `ArrowRight`     → Strafe Right
- `E` / `PageUp` / `Space` → Ascend (world Y+)
- `Q` / `PageDown` / `C`  → Descend (world Y−)
- `Shift`                → Boost speed multiplier
- `Alt`                  → Slow / precision multiplier
- `Mouse` (pointer-lock) → Yaw + pitch look (FPS-style; click canvas to lock)

**Controls (Touch / Tablet)**
- Single-finger drag → horizontal motion (forward + strafe), matching Walk Mode UX.
- Two-finger drag    → camera rotation (yaw + pitch).
- Two-finger pinch   → vertical motion (spread to ascend, pinch to descend).

**Hotkey**
- `Alt+Shift+F` toggles Fly Mode globally.

**New Files**
- `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__FlyMode__SystemLogic.js` — core state, no gravity, no collision, smoothed velocity integration for drone-like glide.
- `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__FlyMode__DesktopControls.js` — WASD + Arrows + Q/E + Space/Ctrl + pointer-lock mouse look.
- `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__FlyMode__TouchScreenControls.js` — one-finger drag + two-finger rotate + pinch-to-elevate.
- `02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__FlyModeControls.js` — orchestrator (mirror of `WalkModeControls`).
- `02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__FlyModeEventListeners.js` — hotkey + button binding (mirror of `WalkModeEventListeners`).

**Changed Files**
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json` — added `Navmode__Settings.Navmode__FlyMode` config block and `Global__Hotkeys__ToggleFlyMode`.
- `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__ModeTransition.js` — added `Na__ModeTransition__OrbitToFly` and `Na__ModeTransition__FlyToOrbit` (matches the existing repositioned-orbit-camera logic used for walk-to-orbit).
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` — render loop now branches on `Na__FlyMode__IsActive()` and feeds the camera position to `Na__DoorProximity__Update`; keep-rendering predicate also includes fly mode.
- `index.html` — Fly Mode menu button added between Walk and Orbit, tri-state mode-status repaint, mutual-exclusion handoff so toggling Fly auto-deactivates Walk (and vice versa).

**Config Authority**
- All Fly Mode behaviour is sourced from `Na__AppConfig__Main.json → Navmode__Settings.Navmode__FlyMode` (movement and vertical speeds in mm/sec, boost/slow scalars, damping factor, mouse sensitivity, keyboard rotate rate, door proximity threshold, touch sensitivities). Nothing is hardcoded outside the JSON.

**Door Animation Parity**
- Fly Mode reuses `Na__DoorProximity__Initialize` / `SetEnabled` / `Update` exactly like Walk Mode. Camera position is passed in directly (no capsule), so proximity triggers fire whenever the user flies within the configured threshold.

**Verification Notes**
- No linter errors across all new + modified files.
- Modes are mutually exclusive: switching between Walk ⇄ Fly ⇄ Orbit always cleans up the outgoing mode before starting the incoming one so the saved orbit snapshot remains valid.
- Render loop only spins continuously while a navigation mode that needs it (`walk-mode`, `fly-mode`, or orbit interaction) is active — the existing invalidation contract is preserved.

# ---------------------------------------------------------
## TrueVision3D v2.2.8  -  25-May-2026
### Scene Inspector — ValeVision Dev Tools Tree Explorer Ported to TrueVision

**Overview**
- Ported the ValeVision3D nested Scene Inspector from `70__System__DevTools` into TrueVision as a localhost-only Dev Tools utility.
- Gives developers an on-demand collapsible Three.js scene graph tree with per-node visibility control, mesh stats, filtering, bulk hide/restore, mesh/linework pair isolation, and clipboard export — without waiting for the async model loading sequence to finish.
- No `Na__AppConfig__Main.json` changes required; behaviour is driven by module-local constants and existing render invalidation.

**New Dev Tools System Folder — `70__System__DevTools`**
- Introduced `02__Src__AppModules/70__System__DevTools/` to mirror ValeVision3D's dev-tools module layout and separate localhost developer utilities from production toggle UI in `26__System__ToggleModelElements`.
- `Na__UiFeature__SceneInspector__Controls.js` — full Scene Inspector logic; exports `Na__UiFeature__InitializeSceneInspector(scene)`.
- `Na__UiFeature__DevMenu__LocalhostOnly.js` — moved Dev Tools menu reveal logic here from `26__System__ToggleModelElements`; adds drag-resize handle support aligned with ValeVision.

**Scene Inspector — TrueVision Adaptations**
- Category group pattern adapted from ValeVision's `^ValeVision__\w+__\w+` to TrueVision's loader naming: `^(?:TrueVision|Storey)__\w+` so **Isolate Pair** mode correctly toggles mesh ↔ linework siblings under both standard category groups and storey-based groups from `Na__ModelLoader__MultiModel.js`.
- Scans the live `Na__Scene__Main` on demand (Scan Scene / Rescan); default expand depth remains 3 levels.
- Visibility dot clicks call `Na__RenderLoop__RequestRender()` after mutating `node.visible`.
- **Hide All** / **Restore All** bulk controls snapshot visibility at scan time and restore to that state.
- **Filter nodes…** input narrows the displayed tree by name fragment while auto-revealing ancestor groups.
- **Copy Tree** writes concise and full plain-text reports to the clipboard.

**UI Wiring — Dev Tools Menu**
- Added Scene Inspector submenu block to `#naDevToolsMenu` in `index.html`, positioned after **Toggle Model Layers** and before **Save Camera Settings**.
- Added `#naDevMenuResizeHandle` to the Dev Tools container for runtime panel width adjustment.
- `index.html` import path for localhost Dev Menu updated to `70__System__DevTools/Na__UiFeature__DevMenu__LocalhostOnly.js`.
- Scene Inspector initialised after scene creation: `Na__UiFeature__InitializeSceneInspector(Na__Scene__Main)`.

**Styles**
- New dedicated stylesheet `03__Style__AppStylesheets/Na__UiFeature__Styles__SceneInspector__.css` (`.na-scene-inspector__*` rules, wider dev panel min-width, resize handle).
- Imported from `Na__CoreUi__Styles__Index__.css` after the dropdown/toast stylesheet.

**Relationship to Existing Model Toggle**
- **Toggle Model Layers** (flat category list) and **Scene Inspector** (full nested scene graph) are complementary — category toggles remain in `26__System__ToggleModelElements`; per-node exploration lives in the new Dev Tools module.

**Verification Notes**
- Dev Tools menu remains localhost-only via `Na__AppUtils__IsRunningOnLocalhost()`.
- Smoke test: Dev Tools visible on localhost, Scene Inspector opens, Scan Scene renders tree + stats, existing Toggle Model Layers and Save Camera Settings entries unchanged.

**Files Changed**
- `02__Src__AppModules/70__System__DevTools/Na__UiFeature__SceneInspector__Controls.js` — new
- `02__Src__AppModules/70__System__DevTools/Na__UiFeature__DevMenu__LocalhostOnly.js` — new
- `03__Style__AppStylesheets/Na__UiFeature__Styles__SceneInspector__.css` — new
- `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css` — import added
- `index.html` — Dev Tools markup, imports, Scene Inspector init
- `TrueVision__DEVLOG__.md`

# ---------------------------------------------------------
## TrueVision3D v2.2.7  -  24-May-2026
### Walk Mode Performance Overhaul — Collision Filtering, Stationary Fast-Path, Allocation Elimination

**Overview**
- After the v2.2.6 profile-lines fix made orbit mode rapid, walk mode remained sluggish (sustained ~15 fps in a 33-category project, with 220+ `requestAnimationFrame` violation warnings and AO auto-disabling from the perf monitor).
- Root cause was the exact same `obj.isMesh === true` trap that hit the profile-lines effect: `Na__WalkMode__SetCollisionMeshes` was traversing the model graph with a bare `isMesh` filter, so every `LineSegments2` fat-line object was being added to the per-frame raycast set. The collision diagnostic now reports the rejected counts: `Collision meshes set: <N> meshes (rejected: <X> fat-lines, <Y> linework-grouped, <Z> exempt)`.
- Compounded by the fact that ground detection re-ran 5 raycasts against the entire collision set **every single frame**, even when the player was standing perfectly still — meaning just looking around in walk mode was firing ~5,500 ray–mesh intersection tests per frame for zero gameplay value.
- Compounded further by per-frame `new THREE.Vector3()` / `new THREE.Euler()` allocations across the ground/horizontal/movement/camera-update paths.

**Walk Mode Collision Filtering — LineSegments2 + Linework Groups Excluded**
- Added `Na__WalkMode__IsInsideLineworkGroup` helper. Walks the object's `parent` chain looking for `userData.Na__ModelType === 'linework'` (set by `Na__ModelLoader__MultiModel.js` when the linework root is attached to its category group).
- `Na__WalkMode__SetCollisionMeshes` now rejects:
  1. Any `Line2 / LineSegments2` (their template quad has no physical collision meaning).
  2. Any mesh nested inside a tagged linework group (defensive — catches a stray real `Mesh` shipped inside a linework GLB).
  3. The pre-existing exempt keyword list (Dev cube, OrbitHelperCube).
- Each reject path is counted and reported in the diagnostic log so future regressions are visible at a glance.

**Stationary Fast-Path for Ground Detection**
- `Na__WalkMode__ApplyGravity` now bails out before raycasting whenever `IsGrounded && VelocityY === 0 && InputForward === 0 && InputStrafe === 0`.
- Ground state cannot change without vertical velocity (jumping/falling) or horizontal input (walking off a ledge), so re-confirming the floor underneath a stationary player is pure wasted work.
- Idle walk-mode ground-check cost drops from ~5,500 ray–mesh tests per frame to **zero**.
- Looking around in walk mode is now as cheap as orbit mode at rest.

**Movement Processing Fast-Path**
- `Na__WalkMode__ProcessMovement` now early-returns when both `InputForward` and `InputStrafe` are zero — no need to compute forward/right vectors, build a zero move vector, or call `ResolveHorizontalCollisions` if the player isn't pressing any keys.

**Per-Frame Allocation Elimination**
- Promoted 13 reusable scratch objects to module scope (`Vector3`s for ray origin, move delta/direction, hit normal, slide velocity, resolved position, forward, right, move vector, previous/proposed positions; an immutable `UpAxis`; a single `Euler` for camera quaternion construction; plus the existing raycaster + down-direction).
- `Na__WalkMode__RaycastGround` no longer allocates `new THREE.Vector3` per call — uses `Scratch__RayOrigin` (Three.js's `Raycaster.set()` internally copies origin/direction so reuse is safe).
- `Na__WalkMode__DetectGroundHeight` no longer allocates a 5-element array of object literals per call — replaced with two lazily-populated module-scope `Float64Array`-style number arrays (`GroundProbeOffsetsX`, `GroundProbeOffsetsZ`).
- `Na__WalkMode__ResolveHorizontalCollisions` no longer allocates per ray height, per slide computation, or per return path — all transient vectors reuse the module-scope scratches.
- `Na__WalkMode__UpdateCameraFromCapsule` no longer allocates a fresh `Euler` per frame.
- `Na__WalkMode__ProcessMovement` no longer allocates forward / right / up-axis / move / previous / proposed vectors per frame.
- Net effect: the walk-mode hot path now does **zero `new THREE.*` allocations per frame**, eliminating the GC pressure that was contributing to the violation warnings.

**Ambient Occlusion — Still Untouched**
- AO was already auto-disabling at 15 fps via its existing perf monitor. With walk mode now running fast, AO should no longer trip the threshold. No changes were made to AO code or config, per the standing constraint.

**Verification Notes**
- After load, the collision diagnostic should now read substantially lower than before. For a 33-category project that previously reported 1117 collision meshes, the figure should drop by roughly the linework count (e.g. ~613 with ~504 fat-lines rejected). Confirm visually that the rejected counts in the log are non-zero.
- Walk mode should now feel as smooth as orbit mode. Standing still in walk mode should not cost more frame budget than standing still in orbit mode.
- The 220+ `requestAnimationFrame` violation warnings should disappear.

**Files Changed**
- `02__Src__AppModules/10__NavigationAndCameras/Na__Navmode__WalkMode__SystemLogic.js`
- `TrueVision__DEVLOG__.md`

# ---------------------------------------------------------
## TrueVision3D v2.2.6  -  24-May-2026
### Profile Lines GPU Drain — Final Fat-Line Material Swap Fix

**Overview**
- TrueVision was still maxing out the GPU after the v2.2.4 overhaul. After a full side-by-side comparison with ValeVision3D (which is now fast), the residual cause was localised to a single bug in `collectMeshObjects` inside the profile lines effect.
- Three.js sets `isMesh = true` on every `LineSegments2` (the fat lines exported from the SketchUp linework GLBs) because they render internally as instanced quads. The previous `collectMeshObjects` filter (`if (obj.isMesh)`) was therefore pushing every fat-line object into the per-frame material-swap array.
- In PASS 2 (profile colour buffer), each fat line's `LineMaterial` was being temporarily replaced with the flat `MeshBasicMaterial` fallback. The instanced draw still fired, but the bound shader did not understand the per-instance line-segment attributes (`instanceStart`/`instanceEnd`/colour twins). The GPU spent most of its budget every frame chewing through corrupt instanced geometry from the template quad. This is what made disabling Profile Lines feel "vastly" faster.

**collectMeshObjects — Fat-Line Exclusion**
- Added explicit early-return for any `obj.isLine2 || obj.isLineSegments2` in `Na__RenderEffect__ProfileLines__.js`. LineMaterial is now never swapped under any circumstance.
- This matches the ValeVision3D filter exactly and is the primary fix.

**Na__IsInsideLineworkGroup — Defensive Parent-Chain Guard**
- New helper walks an object's `parent` chain looking for `userData.Na__ModelType === 'linework'`. Any mesh nested inside a linework GLB root is now skipped by the profile-colour swap regardless of its `isMesh` value.
- Uses the existing tag set in `Na__ModelLoader__MultiModel.js` (lines 473/491/515/527) at load time.
- This guarantees the mesh model and the linework model are never "counted twice" by the profile lines passes — exactly the architectural separation the user requested.

**Diagnostic — One-Shot Cache Rebuild Log**
- `rebuildSceneCache()` now emits one console line per rebuild reporting `meshes(swap)` and `lines(hide)` counts.
- Fires only when the scene actually changes (model load, model toggle, storey isolate) — not per frame — so it is effectively free.
- Future regressions of the mesh/linework split are now visible in DevTools without a debugger.

**Optional Mesh-Only Fast Path — `ColorPassIncludesLinework` Flag**
- Added `RenderEffect__ProfileLines__ColorPassIncludesLinework` config flag, **default `true`** (no visual change vs current behaviour).
- When set to `false` in `Na__AppConfig__Main.json`, the profile colour pass skips rendering linework entirely (lines stay hidden from PASS 1 right through PASS 2 and are only restored before the main `RenderPass`). Auto-detected profile lines then take the uniform fallback colour instead of the local SketchUp linework hue.
- Available as an opt-in for very heavy linework scenes if further perf is ever needed. Not enabled by default.

**Ambient Occlusion — Intentionally Untouched**
- AO is hand-tuned and brittle. No edits were made to `Na__RenderEffect__AmbientOcclusion__.js` or its config block, even though AO uniforms are still updated every frame. AO depth still comes for free from the shared normal-pass depth texture introduced in v2.2.4.

**Files Changed**
- `02__Src__AppModules/05__RenderPipeline/Na__RenderEffect__ProfileLines__.js`
- `TrueVision__DEVLOG__.md`

# ---------------------------------------------------------
## TrueVision3D v2.2.5  -  21-May-2026
### Site Boundaries Toggle — Conditional Layer Support

**Overview**
- Added `Site Boundaries` as a first-class toggleable model layer to match the new `08__Site__Boundaries` SketchUp tag. When a project includes `TrueVision__SiteBoundaries__*` GLBs, a "Site Boundaries" toggle button appears automatically in the Model Parts List panel between "Proposed Interior Decor" and "Landscape". Projects without boundary geometry are unaffected.

**Model Loader — Load Order**
- `"TrueVision__SiteBoundaries"` inserted into `Na__ModelCategories__LoadOrder` in `Na__ModelLoader__MultiModel.js` between `ProposedInteriorDecor` (tag 29) and `LandscapeEnvironment` (tags 07, 09), matching the tag-08 numeric position in the SSOT.
- The existing URL parse regex `/(?:.*?__)?(TrueVision)__(.+?)__(MeshModel|LineworkModel)__\.glb/i` already captures `TrueVision__SiteBoundaries` filenames; no parser changes required.

**Toggle UI — Display Name**
- `"TrueVision__SiteBoundaries": "Site Boundaries"` added to `Na__ModelToggle__DisplayNames` in `Na__UiFeature__ModelToggle__Controls.js` at the correct position between ProposedInteriorDecor and LandscapeEnvironment.
- Button is fully conditional — only created when boundary GLBs are present in the project's model URL list.

**Files Changed**
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js` — added `TrueVision__SiteBoundaries` to load order
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js` — added display name

# ---------------------------------------------------------
## TrueVision3D v2.2.4  -  10-Mar-2026
### GPU Performance Overhaul — Profile Lines Pipeline Optimisation

**Overview**
- Diagnosed and resolved sustained 100% GPU usage introduced by the v2.2.3 profile lines system.
- Root cause: the profile lines effect added two extra full-scene `renderer.render()` calls per frame (normal pass + profile colour pass), doubling the per-frame GPU workload from 2 to 4 scene renders.
- Implemented five targeted optimisations that reduce per-frame scene renders from 4 to 3, cut profile colour pass cost by ~75%, eliminate per-frame allocations, fix a render loop spin issue, and add a user-facing toggle.

**Depth Pre-Pass Elimination**
- Attached a `DepthTexture` to the normal render target so the normal pass writes depth as a side-effect.
- Fog and SSAO now read depth from the normal pass instead of a dedicated depth pre-pass render.
- `renderDepthPrePass()` becomes a no-op when profile lines are active, eliminating one full scene render per frame.
- Falls back to the original dedicated depth pre-pass when profile lines are disabled.

**Half-Resolution Profile Colour Buffer**
- Profile colour render target now created at 50% viewport dimensions (quarter the pixel count).
- The profile colour buffer only carries edge tint information; full resolution is unnecessary.
- `setSize()` updated to maintain half-res on window resize.

**Pre-Allocated Material Swap Cache**
- `cachedOriginalMaterials` is now a pre-allocated `Array` sized during `rebuildSceneCache()`.
- Per-frame material swap uses index-based `for` loops writing into fixed array slots instead of creating `{ object, material }` pairs every frame.
- Eliminates all per-frame heap allocations in the profile lines hot path.

**Orbit Controls Render Loop Fix**
- Added a 3-frame trailing budget after the orbit `end` event.
- Previously, `controls.update()` could return `true` after the user stopped interacting, keeping the render loop spinning indefinitely.
- The loop now renders the trailing frames then stops, dropping GPU usage to near-zero when idle.

**Profile Lines Toggle**
- Added "Profile Lines" ON/OFF button to the Tools & Settings dropdown menu (alongside existing "Shadows" toggle).
- `toggleProfileLines()` disables both the shader pass and the pre-pass renders.
- Users can instantly halve per-frame GPU load by toggling profile lines off.

**Invalidation-Based Render Loop** (carried forward from v2.2.3 session)
- Replaced the unconditional `requestAnimationFrame` loop with an invalidation-based system.
- Frames are only scheduled when user interaction, animations, or explicit invalidation events require a redraw.
- Added `Na__RenderLoop__Invalidation.js` as a centralised event dispatcher for render requests.
- All UI controls (model toggles, storey toggles, group selector, door animations, walk mode) now dispatch render requests through the invalidation system.

**Config Adjustments**
- `RenderEffect__AmbientOcclusion__Samples` reduced from 16 to 8.
- `RenderEffect__AmbientOcclusion__CullDistanceMm` reduced from 12000 to 8000.
- `RenderEffect__AmbientOcclusion__BlurRadius` reduced from 1.2 to 1.0.
- Directional light shadow map resolution reduced from 2048 to 1024.
- Renderer pixel ratio cap reduced from 2.0 to 1.5.
- Fat line segments re-enabled frustum culling with computed bounding geometry.

**Files Added**
- `02__Src__AppModules/05__RenderPipeline/Na__RenderLoop__Invalidation.js`

**Files Changed**
- `Index.html`
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js`
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`
- `02__Src__AppModules/05__RenderPipeline/Na__RenderEffect__ProfileLines__.js`
- `02__Src__AppModules/05__RenderPipeline/Na__RenderPipeline__PostProcessing__Setup.js`
- `02__Src__AppModules/06__Scene__LightingEffects/Na__Scene__DefaultSceneLighting.js`
- `02__Src__AppModules/10__NavigationAndCameras/Na__DefaultNavmode__MouseControls.js`
- `02__Src__AppModules/10__NavigationAndCameras/Na__DefaultNavmode__IpadControls.js`
- `02__Src__AppModules/10__NavigationAndCameras/Na__UiFeature__WalkModeControls.js`
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js`
- `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__StoreyView__Controls.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__StoreyIsolate__Controls.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelGroupSelector.js`
- `02__Src__AppModules/30__System__ImageExport/Na__UiFeature__ImageExport__Controls.js`

# ---------------------------------------------------------
## TrueVision3D v2.2.3  -  10-Mar-2026
### Profile Lines + Colour System — Aligned With ValeVision3D

**Overview**
- Ported ValeVision3D's profile line system and authored edge colour support into TrueVision so both apps render profile lines identically.
- Profile lines now use a profile colour buffer (meshes + linework in one pass), dynamic camera-distance edge width, and smoothstep blending.
- Linework model loader preserves glTF `COLOR_0` (SketchUp edge paint) into fat-line geometry with `vertexColors`.

**Profile Lines Module**
- Replaced `Na__RenderEffect__ProfileLines__.js` with ValeVision's current version.
- Adds `tProfileColor` buffer: meshes render with fallback colour, linework with vertex colours, in a single depth pass.
- Adds `collectMeshObjects` helper for mesh material swap during profile colour pass.
- Shader uses `smoothstep` for gradual edge transitions instead of hard threshold.
- `orbitTarget` parameter enables per-frame dynamic `u_edgeWidth` (thick when close, thin when far).

**Pipeline Setup**
- `Na__RenderPipeline__SetupComposer` now accepts `orbitTarget` as 7th parameter and forwards it to `ProfileLines__Create`.

**Model Loader — Authored Edge Colours**
- `Na__ModelLoader__LoadSingleLinework` extracts `node.geometry.attributes.color` (glTF `COLOR_0`) when present.
- Calls `fatLineGeometry.setColors(importedColors)` to carry vertex colours into fat-line geometry.
- Sets `vertexColors: !!importedColors` on `LineMaterial` so SketchUp edge paint is preserved.

**Config**
- Added `EdgeWidthMin`, `EdgeWidthMax`, `EdgeWidthDistanceNear`, `EdgeWidthDistanceFar` to `RenderEffect__ProfileLines`.
- Updated `EdgeWidth` to 0.25; values aligned with ValeVision tuned settings.

**Key Files**
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`
- `02__Src__AppModules/05__RenderPipeline/Na__RenderEffect__ProfileLines__.js`
- `02__Src__AppModules/05__RenderPipeline/Na__RenderPipeline__PostProcessing__Setup.js`
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js`
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js`

# ---------------------------------------------------------
## TrueVision3D v2.2.2  -  28-Feb-2026
### Selective HDR Reflections (Mirror + Glass) with Per-Material Tuning

**Overview**
- Implemented HDR environment reflections using `HdriSkydome__RuralLandscape__AutumnField__SunnyDay__4k__.hdr` without tinting the whole model.
- Fixed black mirror behavior by preserving indexed material PBR during mesh prep and applying reflection overrides after material swap.
- Added selective reflection controls so mirrors are strong/bright (and optionally blurred) while window glass remains subtle.

**Root Cause**
- A global scene environment assignment (`scene.environment`) pushed HDR colour influence across all PBR materials, causing an unwanted blue cast on non-reflective building surfaces.
- Mirror material intent could also be degraded during first-pass loader prep if indexed materials were flattened to whitecard roughness/metalness values before swap.

**Selective Reflection Solution**
- Added HDR load + PMREM pipeline in `Na__Scene__DefaultSceneLighting.js` that returns an environment texture and only applies globally when explicitly configured.
- Introduced mirror-only material override pass in `Na__MaterialsSystem__MaterialSwap.js`:
  - target by material name (`MAT140__Mirror__ClearDefault`),
  - apply env map + env intensity,
  - apply brightness boost,
  - apply optional roughness override for blurred reflections.
- Introduced glass override pass for subtle reflections:
  - target by material name (`MAT101__Glass__ClearDefault`),
  - apply low env intensity,
  - apply brightness multiplier to keep glass less bright.
- Updated loading flow in `Na__AppFlow__LoadingSequence.js` to run selective overrides immediately after library material swap.

**Config Additions (`Na__AppConfig__Main.json`)**
- `Scene__Environment__ApplyToScene` (bool) — keep false for selective-only mode.
- `Scene__Environment__MirrorOnly` (bool) — enables selective mirror pass.
- `Scene__Environment__MirrorMaterialName`
- `Scene__Environment__MirrorEnvMapIntensity`
- `Scene__Environment__MirrorBrightnessBoost`
- `Scene__Environment__MirrorRoughnessOverride` (blur control)
- `Scene__Environment__GlassEnabled`
- `Scene__Environment__GlassMaterialName`
- `Scene__Environment__GlassEnvMapIntensity`
- `Scene__Environment__GlassBrightnessMultiplier`

**Result**
- Mirrors now render reflective and controllable (brightness + blur), instead of dark/black.
- Window glass now reflects environment slightly while staying visually softer/dimmer.
- Non-mirror/non-glass materials remain neutral with no global HDR blue tint.

**Files Changed**
- `index.html`
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js`
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`
- `02__Src__AppModules/06__Scene__LightingEffects/Na__Scene__DefaultSceneLighting.js`
- `02__Src__AppModules/15__ModelLoader/Na__ModelLoader__MultiModel.js`
- `02__Src__AppModules/20__System__MaterialsSystem/Na__MaterialsSystem__MaterialSwap.js`

# ---------------------------------------------------------
## TrueVision3D v2.2.1  -  28-Feb-2026
### Model Group Switch State Rebind + Full Building Reset Consistency

**Overview**
- Fixed a state lifecycle regression where switching Design Phases replaced scene objects but left runtime systems bound to stale references.
- Resolved failures in storey toggles, floor isolate controls, and door interactions after model-group switching.
- Standardized `Show Entire Building` in both Storey Toggle and Floor Isolate as a true reset for the active model set.

**Root Cause**
- Group switching only reinitialized category model toggles.
- Storey visibility, floor isolate, door registry bindings, and walk collision meshes were initialized at startup only and not rebound to newly loaded model roots.

**Runtime Rebind Fix**
- Added a unified post-switch rebind path in `Na__AppFlow__LoadingSequence.js` (`Na__ReinitializeModelBoundSystems`).
- Model-group switches now reinitialize:
  - model category toggles,
  - storey view controls,
  - storey isolate controls,
  - door animation model bindings/registry,
  - walk mode collision meshes.
- Added `Na__DoorAnimation__RebindModelGroups()` in `3dObjectIInteraction__Animation__ClickToOpenDoors__.js` so door registry can refresh safely on group switch without duplicating pointer listeners.

**Show Entire Building Reset Behavior**
- Added `Na__StoreySystem__ResetEntireBuilding()` in `3dObject__ViewBuildingStoreys__SystemLogic__.js`.
- Reset now guarantees:
  - all storeys visible,
  - roofs forced on,
  - all landscape groups visible.
- Updated both UI flows to use the same reset:
  - `Na__UiFeature__StoreyView__Controls.js` ("Show Entire Building")
  - `3dObject__IsolateBuildingStoreys__SystemLogic__.js` (`Na__StoreyIsolate__ShowEntireBuilding`)

**Stability Hardening**
- Added listener guards in reinitialized UI modules to prevent duplicate submenu handlers on repeated group switches:
  - `Na__UiFeature__ModelToggle__Controls.js`
  - `Na__UiFeature__StoreyView__Controls.js`
  - `Na__UiFeature__StoreyIsolate__Controls.js`

**Files Changed**
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js`
- `02__Src__AppModules/25__System__3dObject__InteractionSystem/3dObjectIInteraction__Animation__ClickToOpenDoors__.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__ModelToggle__Controls.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__StoreyView__Controls.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__StoreyIsolate__Controls.js`
- `02__Src__AppModules/26__System__ToggleModelElements/3dObject__ViewBuildingStoreys__SystemLogic__.js`
- `02__Src__AppModules/26__System__ToggleModelElements/3dObject__IsolateBuildingStoreys__SystemLogic__.js`

# ---------------------------------------------------------
## GLB Builder Utility v1.9.0  -  28-Feb-2026
### Component Instancing — 449 MB → 1 MB GLB Export Optimisation

**This entry documents an upstream SketchUp plugin change that directly benefits TrueVision3D load times and runtime performance. No TrueVision app code changes were required.**

**Result: >99% reduction in exported GLB file size on production architectural model.**

The GLB Builder Utility plugin (`Na__TrueVision__GlbBuilder__EngineCore__ComponentInstancing__.rb`) was extended with a full Component Instancing system. SketchUp "Components" (as distinct from "Groups") are shared-definition objects — editing one updates all. The exporter now respects this: instead of flattening every component instance into duplicated vertex data, each unique `ComponentDefinition` is written to the GLB binary buffer exactly once, and multiple glTF nodes reference it with per-instance transform matrices.

**Why TrueVision benefits automatically (zero code changes):**
- Three.js `GLTFLoader` automatically shares a single `BufferGeometry` instance in GPU memory when multiple nodes reference the same mesh index (confirmed Three.js issue #29768). No `InstancedMesh` required for the GPU memory savings.
- Material traversal in `Na__ModelLoader__MultiModel.js` operates per-node (`node.material.name`), not per-geometry, so all existing material cloning, PBR swap, and shadow setup work identically for instanced nodes.
- Walk mode collision, door animation (ADR entities excluded from instancing), storey visibility toggles — all operate by scene traversal and are unaffected by the new node structure.

**Future opportunity:** Converting shared-mesh node groups into `THREE.InstancedMesh` on load would reduce these to a single draw call per definition, delivering a further GPU render performance improvement on top of the memory savings already achieved.

# ---------------------------------------------------------
## TrueVision3D v2.2.0  -  27-Feb-2026
### Real-Time Screen-Space Ambient Occlusion (SSAO) System

**Overview**
- Implemented a fully custom real-time SSAO post-processing system for TrueVision3D that adds contact shadow detail at geometry junctions (wall-floor intersections, window reveals, ceiling corners).
- The effect is dynamic and view-dependent; not baked. It recalculates every frame using a hemisphere-sampled screen-space technique with noise rotation to break banding.
- Required a custom shader because Three.js built-in SAOPass/SSAOPass do not support `logarithmicDepthBuffer: true`, which TrueVision requires for its large architectural scenes.
- All config values use integer millimeters per project convention, converted at runtime via `Na__Math__ConvertMmToUnits`.
- User-facing language uses "Shadows" throughout since end users are architects, not graphics programmers.

**Architecture — Pipeline Integration**
- Two sequential ShaderPass instances are inserted into the EffectComposer:
  - `[RenderPass] → [ProfileLines] → [Fog] → [SSAO] → [AO Blur] → [FXAA]`
- **SSAO pass** reads the scene colour from `tDiffuse` and a separate depth texture from `tDepth`. Outputs sharp scene RGB with the AO factor stored in the alpha channel.
- **AO Blur pass** reads the SSAO output, blurs ONLY the alpha channel (5x5 gaussian), then composites: `sharpRgb * blurredAo`. This keeps geometry edges razor-sharp while smoothing noisy AO boundaries.

**Critical Technical Challenge — WebGL Feedback Loop**
- Initial implementation attached a `DepthTexture` to the EffectComposer's own `WebGLRenderTarget`. This caused `GL_INVALID_OPERATION: Feedback loop formed between Framebuffer and active Texture` because the ping-ponged RT was being read and written simultaneously.
- **Solution**: A dedicated depth pre-pass renders the scene into a separate `WebGLRenderTarget` with a `FloatType DepthTexture` before the EffectComposer runs. Both the fog and SSAO passes sample from this independent texture, eliminating the feedback loop entirely.

**Logarithmic Depth Buffer Inversion**
- Three.js writes `gl_FragDepth = log2(1.0 + w) / log2(far + 1.0)`.
- Custom inversion: `clipW = pow(cameraFar + 1.0, storedDepth) - 1.0`.
- View-space position reconstructed by building a ray through the pixel via the inverse projection matrix, scaled by the recovered clip-space W.

**Performance Optimisation**
- AO culling distance (`CullDistanceMm`) skips the expensive kernel loop for pixels beyond a configurable range, with a smooth fade-out over the last 20%.
- FPS-based auto-disable monitor samples frame rate after a warmup period. If below threshold, disables both passes and shows a user toast: "Shadows have been switched off to improve performance."
- `depthWrite=false` and `depthTest=false` on all ShaderPass materials to prevent depth buffer interference between passes.

**UI — Shadows Toggle**
- Added a "Shadows" ON/OFF toggle to the "Tools & Settings" dropdown menu.
- Toggle calls `pipeline.toggleAo()` which enables/disables both SSAO and blur passes in real time.
- A `na-ao-disabled` custom event keeps the toggle UI synchronised when the performance monitor auto-disables AO.

**Config (`Na__AppConfig__Main.json` → `RenderEffect__AmbientOcclusion`)**
- `Enabled` (bool), `RadiusMm` (50), `Intensity` (1.2), `Bias` (0.005), `Samples` (16)
- `CullDistanceMm` (10000), `BlurRadius` (1.2)
- `FpsThreshold` (24), `FpsSampleFrames` (120), `PerformanceMonitorStartupDelayMs` (3000)
- `DebugMode` — 0=off, 1=raw depth, 2=linear Z, 3=normals, 4=raw AO

**Files Added**
- `02__Src__AppModules/07__Scene__EnvironmentEffects/Na__RenderEffect__AmbientOcclusion__.js`
- `02__Src__AppModules/07__Scene__EnvironmentEffects/Na__RenderEffect__AmbientOcclusion__Shader.js`

**Files Changed**
- `02__Src__AppModules/05__RenderPipeline/Na__RenderPipeline__PostProcessing__Setup.js`
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js`
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`
- `Index.html`
- `03__Style__AppStylesheets/Na__UiFeature__Styles__DropdownAndToast__.css`

# ---------------------------------------------------------
## TrueVision3D v2.1.1  -  27-Feb-2026
### Floor Isolate — Landscape Off + User Guide Isolation Notes

**Overview**
- Extended the new `Floor Isolate` workflow so it now disables landscape as well as roofs when isolating a storey.
- Added client-friendly documentation to the User Guide explaining the difference between `Storey Toggle` and `Floor Isolate`, including when each is useful.
- Preserved coexistence: both systems remain available for flexible model view control.

**Floor Isolate Logic Update**
- Updated `3dObject__IsolateBuildingStoreys__SystemLogic__.js` to:
  - Detect landscape groups from the same loaded model root used by storey models.
  - Cache current landscape visibility before isolate actions.
  - Force landscape visibility off during `Na__StoreyIsolate__IsolateSingleStorey(...)`.
  - Restore cached landscape visibility when `Na__StoreyIsolate__ShowEntireBuilding()` is used.
- Roof behavior remains unchanged from previous release: isolate mode forces roofs off.

**UI/UX Copy Update**
- Updated floor isolate button tooltip text in `Na__UiFeature__StoreyIsolate__Controls.js` to communicate that isolate mode now switches both roofs and landscape off.

**User Guide Content Update**
- Added a new section after the existing divider structure in `Na__UserInstructions__Content__.html`:
  - `Model Isolation Tools`
  - Plain-language explanations for:
    - `Storey Toggle` (custom multi-floor combinations)
    - `Floor Isolate` (single floor focus with roofs + landscape off)
    - `Show Entire Building` (quick reset)
- Reassigned `na-instructions-section--last` so the new isolation section is now the final section in the modal.

**Files Changed**
- `02__Src__AppModules/26__System__ToggleModelElements/3dObject__IsolateBuildingStoreys__SystemLogic__.js`
- `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__StoreyIsolate__Controls.js`
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__Content__.html`

# ---------------------------------------------------------
## TrueVision3D v2.1.0  -  27-Feb-2026
### User Instructions System — User Guide Modal Overlay

**Overview**
- Built a new User Guide system accessible from the Tools dropdown menu.
- Clicking "User Guide" (last item in the menu) opens a full-screen modal overlay listing all navigation controls for both PC and touchscreen users.
- The overlay covers Orbit Mode, Walk Mode, and Global Hotkeys with clear, explicit descriptions of each control gesture and mouse button action.
- System is fully self-contained in a new module folder with clean separation between menu hookup, logic, content, and styles.

**New Module: `02__Src__AppModules/75__System__UserInstructionsSystem/`**
- `Na__UiFeature__UserInstructions__MenuItem.js` — resolves `#naUserInstructionsToggle` from the DOM, collapses the Tools dropdown on click, and delegates to the open function. No cross-system imports.
- `Na__UserInstructions__SystemLogic.js` — builds the overlay/modal DOM structure at initialisation, fetches `Na__UserInstructions__Content__.html` via `fetch()` using `import.meta.url` for correct path resolution, and injects it into the modal. Handles all three close triggers: close button click, backdrop click, and `Escape` key. On touch devices, smooth-scrolls to the touchscreen section on open.
- `Na__UserInstructions__Content__.html` — standalone HTML fragment (no `<html>`/`<body>`) containing the full controls guide: Orbit Mode (PC mouse with explicit button + drag labels, touchscreen), Walk Mode (PC keyboard, PC mouse with pointer lock explanation, touchscreen), and Global Hotkeys.
- `Na__UiFeature__Styles__UserInstructions__.css` — full styles for the overlay backdrop (fixed, full-screen, fade transition), modal card (centred, max-width 680px, brand blue, scrollable), header with close button, section separators, group sub-labels ("PC — Keyboard", "Touchscreen", etc.), control key badge pills, and responsive stacking for narrow viewports.

**`index.html` changes**
- Added "User Guide" `<li>` as the last item in the Tools dropdown (after Design Phase).
- Imported `Na__UiFeature__InitializeUserInstructionsMenuItem` and `Na__UserInstructions__Initialize` / `Na__UserInstructions__Open`.
- Added `await Na__UserInstructions__Initialize(Na__Device__UseTouchControls)` and `Na__UiFeature__InitializeUserInstructionsMenuItem(Na__UserInstructions__Open)` in the Engine Entry Points region.
- Renamed "Storey View" menu label to "Storey Toggle".

**`03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css` changes**
- Added `@import` for `Na__UiFeature__Styles__UserInstructions__.css` from the new module folder.

**Files Added**
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UiFeature__UserInstructions__MenuItem.js`
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__SystemLogic.js`
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UserInstructions__Content__.html`
- `02__Src__AppModules/75__System__UserInstructionsSystem/Na__UiFeature__Styles__UserInstructions__.css`

**Files Changed**
- `index.html`
- `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css`

# ---------------------------------------------------------
## TrueVision3D v2.0.9  -  27-Feb-2026
### Orbit Mode — Landscape Floor Collision Guard

**Overview**
- Diagnosed and fixed the ability to orbit the camera below the landscape plane in orbit mode.
- The camera could be dragged in a full 180° arc around the orbit target, passing through the ground and emerging underground looking up at the building underside.
- Implemented a world-space camera Y floor guard that runs every frame in the navigation update loop, preventing the camera from descending below a configurable minimum world height regardless of input source.

**Root Cause Analysis**
- Three.js `OrbitControls` defaults `maxPolarAngle` to `Math.PI` (180°), allowing the camera to orbit from directly above the target all the way to directly below it.
- No polar angle or world-height constraint was set anywhere in the orbit control setup.
- All orbit input paths (mouse drag, pinch-to-zoom pan, WASD Q-key) were unrestricted.
- A `maxPolarAngle` approach was evaluated but discarded — it constrains angle relative to the orbit target position, not the world floor, so it conflicts with OrbitHelperCube placement at varying heights and breaks saved camera restoration.

**Fix — World-Space Camera Y Floor Guard**
- Added `Navmode__MouseControls__OrbitMinCameraYMm: 0` and `Navmode__IpadControls__OrbitMinCameraYMm: 0` to both `Na__AppConfig__Main.json` and `TestEnv__SubAppData__Config.json`.
- In `Na__DefaultNavmode__MouseControls.js` and `Na__DefaultNavmode__IpadControls.js`, the `updateNavigation` function now clamps `camera.position.y` to `minCameraYUnits` after every `controls.update()` call, followed by a second `controls.update()` to re-sync internal state.
- The guard is world-space (absolute Y ≥ configured floor), independent of orbit target position and OrbitHelperCube placement.
- Setting `OrbitMinCameraYMm` to `null` or omitting it disables the guard entirely.
- `index.html` passes `minCameraYMm` through in both the mouse and iPad nav config payloads.

**Files Changed**
- `02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`
- `80__Testing__PrototypeEnvironment/TestEnv__SubAppData__Config.json`
- `02__Src__AppModules/10__NavigationAndCameras/Na__DefaultNavmode__MouseControls.js`
- `02__Src__AppModules/10__NavigationAndCameras/Na__DefaultNavmode__IpadControls.js`
- `index.html`

# ---------------------------------------------------------
## TrueVision3D v2.0.8  -  27-Feb-2026
### Camera Mode Transition — Spatial Continuity Fix

**Overview**
- Diagnosed and fixed the position discontinuity when switching between orbit and walk modes.
- Orbit-to-walk spawned the user far from where they were looking due to ground-snap dropping the camera from elevation, and the inherited orbit pitch pointing at the floor.
- Walk-to-orbit discarded the walk exploration and teleported back to the pre-walk orbit snapshot.
- Created a dedicated transition module (`Na__Navmode__ModeTransition.js`) to own all switching logic, keeping it cleanly separated from the two mode systems.

**Root Cause Analysis**
- Orbit-to-walk: capsule X/Z was placed at the orbit camera position (correct), but ground-snap caused a large Y drop, and the full orbit pitch was inherited rather than clamped — resulting in the user staring at the floor.
- Walk-to-orbit: `Na__WalkMode__Deactivate` unconditionally restored a stale pre-walk snapshot, discarding everything the user had explored.
- The OrbitHelperCube target must never be modified during any transition — it is the authoritative architectural pivot set at load time.

**New Module: `Na__Navmode__ModeTransition.js`**
- `Na__ModeTransition__OrbitToWalk(orbitControls, maxEntryPitchDeg, entryForwardNudgeMm)`:
  - Delegates to `Na__WalkMode__Activate` (saves orbit state, ground-snaps capsule, extracts yaw/pitch).
  - Clamps the inherited pitch to `MaxEntryPitchDeg` (default 30°) so the user enters looking level rather than at the floor.
  - Nudges the capsule forward by `EntryForwardNudgeMm` along the camera yaw direction to compensate for the orbit camera being pulled back from the scene at orbit distance.
- `Na__ModeTransition__WalkToOrbit(camera, orbitControls)`:
  - Reads the saved orbit state from `Na__WalkMode__GetSavedOrbitState()`.
  - Computes a new orbit camera position at the same distance and elevation from the OrbitHelperCube target, but rotated so the camera faces the target from the direction of the user's current walk position.
  - Passes this as `overrideCameraPosition` to `Na__WalkMode__Deactivate` — orbit target and FOV are always restored from saved state and never modified.

**`Na__Navmode__WalkMode__SystemLogic.js` additions**
- `Na__WalkMode__ClampEntryPitch(maxRad)`: clamps `Na__WalkMode__CameraPitch` to ±maxRad and immediately updates the camera quaternion.
- `Na__WalkMode__NudgeCapsuleForward(distanceUnits)`: moves capsule forward along the current yaw direction, re-detects ground at new position, updates camera.
- `Na__WalkMode__GetSavedOrbitState()`: returns a read-only copy of the pre-walk orbit snapshot for use by the transition module.
- `Na__WalkMode__Deactivate` updated to accept an optional `overrideCameraPosition` (Vector3) — when provided the orbit camera is placed there; orbit target and FOV always restore from saved state.
- All new functions added to module exports.

**`Na__UiFeature__WalkModeControls.js` updates**
- Imports `Na__ModeTransition__OrbitToWalk` and `Na__ModeTransition__WalkToOrbit` from new module.
- Direct `Na__WalkMode__Activate` / `Na__WalkMode__Deactivate` calls replaced with transition module calls.
- Stores camera ref, `MaxEntryPitchDeg`, and `EntryForwardNudgeMm` from config at init time.

**`Na__AppConfig__Main.json` additions (`Navmode__WalkMode` section)**
- `Navmode__WalkMode__MaxEntryPitchDeg`: 30 — maximum inherited orbit pitch (degrees) when entering walk mode.
- `Navmode__WalkMode__EntryForwardNudgeMm`: 5000 — forward nudge applied on walk mode entry to bring spawn point closer to the viewed scene (mm, converted to 3JS units via `Na__Math__ConvertMmToUnits`).

**Notes**
- The OrbitHelperCube system is completely unaffected — `controls.target` is always restored from the saved OrbitHelperCube value, never derived from walk position.
- Forward nudge direction uses the same `(0,0,-1)` + yaw rotation convention as `Na__WalkMode__ProcessMovement` (W key forward).
- All new values in AppConfig are integer millimeters per project convention, converted at runtime.

# ---------------------------------------------------------
## TrueVision3D v2.0.7  -  27-Feb-2026
### Export Image — Loading Spinner + Readback Performance Fix

**Overview**
- Added a loading spinner overlay to the "Download Image" export button, matching the existing UX pattern used by the "Send to Drawing Document" (layout view) button.
- Fixed a browser performance warning caused by calling `getImageData` on canvas contexts that were not created with `willReadFrequently: true`.

**Loading Spinner (`Na__UiFeature__ImageExport__Controls.js`)**
- Export button click handler rewritten to match the layout view overlay pattern exactly.
- Added `exportInProgress` guard to prevent double-click during render.
- Added `is-loading` class to dim the button during export.
- Reuses the existing shared `#naLayoutLoadingOverlay` / `#naLayoutLoadingStatus` DOM elements and `na-layout-loading-overlay` CSS modifier classes — no new HTML or CSS required.
- Double-`requestAnimationFrame` defer ensures the overlay paints before the blocking render call executes.
- On completion: status updates to `"Image Downloaded!"` (green success state), overlay fades out after 2 seconds, button and guard reset.

**Canvas Readback Fix (`Na__ImageExport__PostProcessEffects__HighPassSharpen.js`)**
- Both `getContext('2d')` calls in `Na__PostProcess__ApplyHighPassSharpen` now pass `{ willReadFrequently: true }` to match the browser's recommended hint for canvases that call `getImageData` multiple times.
- Resolves the `Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true` console warning.

# ---------------------------------------------------------
## TrueVision3D v2.0.6  -  27-Feb-2026
### Save Camera Persistence + Targeted CDN Sync (Localhost)

**Overview**
- Fixed the localhost `Save Camera Settings` flow so camera coordinates now persist into the active project's `TrueVision__ProjectData__.json`.
- Added confirm-driven targeted CDN upload for the same project via ProjectVision's existing R2 sync tooling.
- Follow-up refactor applied to keep the save module closer to Noble modular style with purer helper functions and clearer region grouping.

**Root Cause**
- The button flow called `GET/POST /api/projects/<projectCode>`, but the local ProjectVision server did not expose that API route initially.
- CORS on local server only allowed `GET/OPTIONS`, so save requests could not complete as intended.
- During validation, duplicate local Flask instances on the same port caused stale 404 behavior until processes were deduplicated.

**Local Server API Fixes (`na-apps/ProjectVision__LocalServer__Main__.py`)**
- Added CORS `POST` support.
- Added `GET/POST /api/projects/<project_code>` for project JSON read/write.
- Added robust project-path resolution using:
  - URL/body context (`project-folder`, `year`)
  - fallback scan by project code under `na-project-portal/*-Projects/*/30__TrueVision__AppContent/TrueVision__ProjectData__.json`
- Added `POST /api/projects/<project_code>/sync-cdn` endpoint for one-project CDN upload.

**CDN Sync Integration (`na-apps/05__ProjectVision__CoreAppCode/CloudflareR2__ModelSync__Main__.py`)**
- Extended `run_r2_sync(...)` with optional `auto_confirm_upload` parameter.
- Preserved default CLI behavior (interactive confirmation) while enabling non-interactive server-triggered sync after browser-side confirmation.

**Save Module Updates (`Na__UiFeature__SaveCameraSettings.js`)**
- Save flow now passes `project-folder` and `year` to local API.
- Added confirm prompt before CDN upload after local save success.
- Refactored to smaller helpers for readability and purity:
  - context/query/url builders
  - pure project-data merge transform
  - isolated fetch/save/sync API wrappers
  - thin orchestration in main save function

**Validation Notes**
- Local API probe confirmed `GET /api/projects/NP03?project-folder=NP03__AshnessClose&year=26` resolves and returns project data.
- Save button now updates local `TrueVision__ProjectData__.json` and can trigger targeted CDN sync for the same project.
- No linter errors introduced in touched JS/Python files.

# ---------------------------------------------------------
## TrueVision3D v2.0.5  -  27-Feb-2026
### Main-App Material Preservation + Transparency Parity Fix

**Overview**
- Fixed main-app material pipeline so indexed GLB materials survive initial mesh loading and can be swapped by the Materials System.
- Resolved mismatch where test environment rendered transparent materials (e.g. windows) correctly, but main app could lose material identity before swap.
- Added focused diagnostics to confirm indexed material detection and swap coverage during runtime.

**Root Cause**
- In `Na__ModelLoader__MultiModel.js`, mesh materials were being replaced too aggressively during first-pass loading, which could remove indexed `MAT###__...` names needed by the second-pass material swap.
- `Na__MaterialsSystem__MaterialSwap.js` depends on indexed material names to look up PBR configs from `Na__AppConfig__MaterialsLibrary.json`; once names were lost, transparent glass configs could not be applied.

**Main Loader Fix (`Na__ModelLoader__MultiModel.js`)**
- Refactored `Na__ModelLoader__LoadSingleMesh` to preserve and clone existing GLB materials by default.
- Tightened white fallback behavior: fallback now applies only to missing/invalid material slots (instead of broad non-textured replacement).
- Preserved array material handling (`Array.isArray(node.material)`) so all material slots are processed consistently.
- Kept base mesh prep behavior (double-sided + polygon offset + textured emissive/roughness tuning) without discarding material identity.

**Diagnostics Added**
- Loader summary per mesh GLB:
  - `materials=<count>, indexed=<count>, whiteFallback=<count>`
- Material swap summary per processed group:
  - `IndexedSeen=<count>, Swapped=<count>, IndexedMissing=<count>, UniqueSwapped=<count>`

**Validation Notes**
- Main app runtime now reports non-zero indexed detection and non-zero swaps for relevant model groups, including window groups.
- `IndexedMissing=0` observed for swapped indexed groups during validation run.
- No lint errors introduced in modified JS modules.

# ---------------------------------------------------------
## TrueVision3D v2.0.4  -  27-Feb-2026
### Localhost Dev Menu Split + Navigation Mode Status UX

**Overview**
- Split tools into client-facing and localhost-only menu scopes so live builds remain client-safe while local builds expose developer controls.
- Added explicit dual-mode status UX (`Walk Mode` / `Orbit Mode`) with mutually exclusive Active states.
- Moved camera lens/FOV control into the Export tools section.
- Updated local server behavior to canonicalize mixed-case entrypoints (`Index.html` -> `index.html`) to prevent stale/incorrect page variants during local testing.

**Main UI Menu Changes (`index.html`)**
- Client-facing `Tools` order now follows:
  - `Walk Mode`
  - `Orbit Mode`
  - `Export Image` (includes Lens Width/FOV slider)
  - `Storey View`
  - `Design Phase`
- Added left-side `Dev Tools` menu container (hidden by default) containing:
  - `Toggle Model Layers`
  - `Save Camera Settings`

**Localhost-Only Dev Menu**
- Added `02__Src__AppModules/26__System__ToggleModelElements/Na__UiFeature__DevMenu__LocalhostOnly.js`.
- Dev menu visibility is gated by `Na__AppUtils__IsRunningOnLocalhost()`.
- Main runtime now initializes dev menu visibility via `Na__UiFeature__InitializeLocalhostDevMenu()`.

**Navigation Mode Status UX**
- Added Orbit mode button/status in main menu.
- Implemented shared mode-status updater so exactly one mode is Active at a time:
  - Startup defaults to Orbit Active.
  - Enabling Walk sets Walk Active / Orbit Off.
  - Disabling Walk sets Walk Off / Orbit Active.

**Lens/FOV in Export**
- Lens slider/value UI moved from top-level menu item into the Export panel.
- `Na__UiFeature__CameraLens__Controls.js` updated so lens initialization no longer requires a dedicated top-level lens toggle button.

**Server Routing Reliability (Local Dev)**
- Updated `na-apps/ProjectVision__LocalServer__Main__.py`:
  - Added case-insensitive path resolution helper.
  - Canonicalized requests for `.../Index.html` to `.../index.html` when available.
  - Updated printed TrueVision test URL to lowercase `index.html`.
- Updated `na-apps/ProjectVision__LocalServer__Main__.bat` startup notes to reflect new canonicalization behavior.

**Notes**
- Follow-up cleanup pass performed to trim non-essential inline logic additions in `index.html` while preserving behavior.

# ---------------------------------------------------------
## TrueVision3D v2.0.3  -  27-Feb-2026
### Feature Integration Sprint: Storey, Walk Mode, Doors, Materials

**Overview**
- Integrated prototype features from the test environment into the main TrueVision3D app: building storey visibility, Walk Mode navigation, door click-to-open and proximity-to-open, and auto materials swap.
- Resolved structural mismatches between the test env (separate mesh/linework groups per GLB) and the main app (combined category groups with mesh + linework children).
- Simplified the test environment by replacing duplicated logic with calls to shared main-app modules.

**Building Storey System**
- Moved storey visibility from prototype to main app; added dropdown menu section for storey toggles.
- Fixed `Na__ModelLoader__MultiModel.js` regex to correctly parse `Storey__` prefixed model URLs into categories (e.g. `Storey__GroundFloor__ProposedDoors`).
- Test env now calls shared `Na__UiFeature__InitializeStoreyViewControls` instead of duplicating UI code.

**Walk Mode Navigation**
- Integrated Walk Mode into main app with dropdown toggle, status badge, and hotkey.
- Fixed `Na__Navmode__WalkMode__SystemLogic.js`: set `Raycaster.camera` during init so `LineSegments2` objects (linework) can be raycast for collision without crashing.

**Door Animation (Click-to-Open + Proximity)**
- Door systems require **separate** mesh and linework groups: Phase 1 scans mesh groups for ADR assemblies; Phase 2 scans linework groups and links them to existing records. Passing the same combined group as both corrupted the registry.
- Main app fix: tag mesh/linework scene roots with `userData.Na__ModelType` in `Na__ModelLoader__MultiModel.js` (both priority-order and **unordered** load paths; Storey models use the unordered path).
- Loading sequence: extract tagged children from each `ProposedDoors` category group; fallback to child index (mesh=0, linework=1) when tags are absent (e.g. cached loader).
- Added shared `Na__DoorAnimation__FindDoorGroups.js` for test env reuse.

**Test Environment Simplification**
- Replaced duplicated lighting setup with `Na__Scene__SetupDefaultSceneLighting()`.
- Replaced duplicated door-finding logic with `Na__DoorAnimation__FindDoorGroups()`.

**Takeaways**
- Main app multi-model loader has two paths: priority order (Landscape, etc.) and unordered (Storey categories). Both must tag scene roots for downstream consumers.
- Fallback strategies (e.g. child index when tags missing) improve resilience against caching and deployment lag.

# ---------------------------------------------------------
## TrueVision3D v2.0.2  -  27-Feb-2026
### Core Codebase Modularization (PlanVision-Aligned Structure)

**Overview**
- Reorganized the TrueVision runtime modules to align with PlanVision-style modular architecture and numbered folder ordering.
- Completed a full source path migration and reference rewrite across runtime code, test environment, config files, and key technical docs.
- Performed final path-integrity validation to confirm module imports and stylesheet links resolve correctly after the restructure.

**Folder Structure Migration**
- Moved all legacy `src__*` module folders into `02__Src__AppModules` and removed `src__` folder prefixes.
- Moved stylesheets from `src__Styles` to `03__Style__AppStylesheets`.
- Introduced numeric folder ordering for module priority and readability:
  - `01__AppCore`, `02__AppData`, `03__AppUtils`, `04__MathUtils`, `05__RenderPipeline`, `06__Scene__LightingEffects`, `07__Scene__EnvironmentEffects`, `10__NavigationAndCameras`, `11__CameraUtils`, `15__ModelLoader`, `20__System__MaterialsSystem`, `26__System__ToggleModelElements`, `30__System__ImageExport`, `90__System__PageLayoutSystem`, `25__System__3dObject__InteractionSystem`, `26__System__ToggleModelElements`.

**AppCore / AppData Separation**
- Consolidated core orchestration scripts under `02__Src__AppModules/01__AppCore`:
  - `Na__AppFlow__LoadingSequence.js`
  - `Na__AppConfig__Loader.js`
- Moved app configuration data into `02__Src__AppModules/02__AppData`:
  - `Na__AppConfig__Main.json`
  - `Na__AppConfig__MaterialsLibrary.json` (+ related data JSON assets)
- Updated config loader fetch path to load from `02__AppData`.

**Reference Rewiring**
- Updated module imports in `index.html` to point to the new numbered module locations.
- Updated internal JS relative imports between moved modules.
- Updated test sandbox imports and config references in:
  - `80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__Main__.js`
  - `80__Testing__PrototypeEnvironment/TestEnv__SubAppData__Config.json`
- Updated relevant `.cursor` rule path references to new AppData location.

**Validation and Fixes**
- Resolved one malformed stylesheet import in `02__Src__AppModules/90__System__PageLayoutSystem/Na__PageLayoutSystem__Styles__Main__.css`.
- Final validation checks completed:
  - JS relative import resolution: **PASS** (`MISSING_JS_IMPORTS=0`)
  - `index.html` local `src`/`href` references: **PASS** (`MISSING_INDEX_LINKS=0`)
  - CSS `@import` local path resolution: **PASS** (`MISSING_CSS_IMPORTS=0`)

# ---------------------------------------------------------
## TrueVision3D v2.0.1  -  27-Feb-2026
### Branding Migration Baseline (ValeVision -> TrueVision)

**Overview**
- Began the formal migration baseline from legacy ValeVision naming to TrueVision naming across runtime modules and core project documents.
- Updated primary app and layout branding assets to use Noble Architecture common-assets web URLs.
- Replaced major legacy branding strings in active code paths and prepared compatibility bridges where legacy project data keys may still exist.

**Branding and Logo Updates**
- Updated main app branding in `index.html`:
  - Noble Architecture logo URL in header.
  - Noble Architecture favicon URL(s).
  - Runtime UI text moved to TrueVision naming.
- Updated `02__Src__AppModules/90__System__PageLayoutSystem/Na__PageLayoutSystem__Layout__.html`:
  - Noble Architecture logo URL in layout header.
  - Noble Architecture favicon URL(s).

**Codebase Naming Updates**
- Performed broad naming migration across active project files:
  - `ValeVision3D` -> `TrueVision3D`
  - `ValeVision` -> `TrueVision`
  - `Vale Garden Houses` -> `Noble Architecture`
- Renamed key legacy-named documentation files to TrueVision equivalents.

**Compatibility Safeguards**
- `02__Src__AppModules/03__AppUtils/Na__AppUtils__ProjectLoader.js` now supports both new `trueVision_*` keys and legacy `valeVision_*` keys when extracting model URLs.
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` now accepts `trueVision_Camera__DefaultPosition` with fallback to legacy `valeVision_Camera__DefaultPosition`.
- `02__Src__AppModules/11__CameraUtils/Na__UiFeature__SaveCameraSettings.js` now removes both `trueVision_*` and `valeVision_*` legacy camera blocks before saving canonical camera payload.

**Supporting Updates**
- Cleaned internal legacy naming in `80__Testing__PrototypeEnvironment/TestEnv__FlaskLocalServer.py` (`VALEVISION_ROOT` -> `TRUEVISION_ROOT`).
- Fixed malformed logo URL in `10__DistributionEmails/Distro__InviteEmailEmbedCard__TrueVision3D.html`.

# ---------------------------------------------------------
## LEGACY ValeVision v1.9.7  -  27-Feb-2026
### Stylesheet Naming Standardization 

**Overview**
- Standardized stylesheet naming to the project namespace pattern (`Na__<DomainOrModule>__Styles__<FeatureOrScope>__.css`) for improved maintainability and clearer ownership by module.
- Updated stylesheet link/import wiring across main app, Page Layout System, and Test Environment to match renamed files.
- Removed all remaining Babylon/BABYLON engine references from TrueVision3D runtime/docs.
- Ported legacy `src__GenerateObjects` helper modules from Babylon APIs to Three.js-compatible utility modules.

**Stylesheet Refactor**
- Renamed `src__Styles` files to namespaced equivalents (Core UI, UiFeature, ImageExport scopes).
- Renamed Page Layout stylesheet to `Na__PageLayoutSystem__Styles__Main__.css`.
- Renamed Test Environment stylesheet to `Na__TestEnv__Styles__PrototypeSandbox__.css`.
- Updated `index.html`, Page Layout HTML, and TestEnv HTML to point at new stylesheet names.
- Updated `Na__CoreUi__Styles__Index__.css` import list to new filenames while preserving import order.


