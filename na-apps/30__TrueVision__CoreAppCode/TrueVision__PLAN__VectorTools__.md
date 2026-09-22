# TrueVision3D - PLAN - Vector Tools
# =========================================================
#
# FILE     : TrueVision__PLAN__VectorTools__.md
# PURPOSE  : The map, the decisions, the keys, the traps and the ledger for the Layout Editor's
#            vector editing overhaul: Trim, Extend, Join, Split, Offset, Fillet, Chamfer, Circle and Arc -
#            and (22-Sep-2026) the Boolean section and vectors with holes (section 10)
# CREATED  : 21-Sep-2026
# AUTHOR   : Adam Noble - Noble Architecture (brief) / built with Claude
#
# ---------------------------------------------------------


---------------------------------------------------------
## 1. The brief (Adam, 21-Sep-2026)
---------------------------------------------------------

> We need to give the vector editor a big upgrade. It's very basic at the moment. When going inside the
> vector group, when you double-click and go into it, currently it fades everything else to show you that
> you're editing. This is good, but now we need to add some more tools that are available when you're in
> this mode. We need to add: Trim, Extend, Join.
>
> Trim should be T. Extend should be Shift-T. Join should be J. Check the hotkey for the 2D layout mappings
> already, and let me know if there are any conflicts. If not, use those mappings.
>
> 1. Research online how SketchUp's Layout Software trim, extend, and join work ... Their vector drawing
>    tool is especially good, so I want to copy all of the features of it.
> 2. Add in any other useful tools that a high-end vector illustration editor would have as well that I
>    might not have thought of, but the more CAD-adjacent tools, and effectively give this an overhaul.
> 3. Task 02 - add a circle drawing tool. And an arc drawing tool.
>
> Take your time and map everything out first. The project is highly modular.

With it, a screenshot of the right-hand Properties column: an orange box drawn round the space UNDER the
Vectors settings (from below Pattern deg to the foot of the column) and an arrow curling into it.


---------------------------------------------------------
## 2. The key conflict Adam asked about
---------------------------------------------------------

| Asked for | In `Na__Hotkeys__DrawingTabs__.json` already? | What was done |
|---|---|---|
| Trim = **T** | **YES - T is the Text tool** (`Tool__Text`), as it is in LayOut and in Adam's own LayOut keymap | T is Trim **while a container is open** (a group or a vector being edited); out on the sheet T is still Text. See below |
| Extend = **Shift+T** | free | bound |
| Join = **J** | free (and J is Adam's own LayOut key for Join) | bound |

**How one key means two things.** A keyboard binding may now carry `"When": "InContainer"`. The sheet's
keyboard tells the key map the situation with every key (`{ InContainer : Na__LeScope__IsActive() }`), and a
binding with a `When` only matches in that situation. `Tool__Trim` sits ABOVE `Tool__Text` in the list with
`When: InContainer`, so inside a group or a vector T trims; with nothing open it falls through to Text. It
costs the Text tool nothing: a placing tool closes the container, so Text could never be used in there.

**Out on the sheet** Trim is reached from the Vector Tools panel, from a vector's right-click menu
(Vector tools > Trim), or by holding **Shift** with Extend (Shift+T) up - AutoCAD's swap, which trims for as
long as Shift is held.

**To make T trim everywhere instead:** take the `When` line off the `Tool__Trim` row and give `Tool__Text`
another key - a two-line edit of the JSON (and the same two lines in the fallback in
`ConfigState__KeyMap__.js`, which `Na__Test__DrawingTabKeys__` holds in step).

**The other keys**, chosen from Adam's own LayOut 2026 keymap (`layout.private.json`) and LayOut's defaults:

| Tool | Key | Where it came from | Clash checked |
|---|---|---|---|
| Circle | C | LayOut's and SketchUp's default; Adam's | Ctrl+C is Copy - Exact modifiers keep them apart |
| Arc | Shift+A | LayOut's is A - **A is the Floor Area tool here** | free |
| Split | U | Adam's own LayOut key (LayOut ships none) | free |
| Offset | F | Adam's own LayOut key | `Nav__ZoomFit` also names F but ships OFF; if it is ever switched on it is tested first and takes the key - noted on the row |
| Fillet | Shift+F | LayOut 2026 default | free |
| Chamfer | Shift+C | LayOut 2026 default | free |


---------------------------------------------------------
## 3. What LayOut actually does (researched 21-Sep-2026)
---------------------------------------------------------

LayOut 2026 added **Trim, Extend, Fillet and Chamfer** (they are in Adam's 2026 keymap: Shift+T, Shift+E,
Shift+F, Shift+C). Join, Split and Offset are older. Sources are listed in the config's `Meta__Research`.

- **Trim / Extend** work as AutoCAD's QUICK mode: no "pick the cutting edge first". Hover the piece, see what
  will happen, click. A **fence** - click bare paper, draw a line across several lines, click again - does
  them all. Every vector is a cutting edge.
- **Join**: click one piece, then the next; the result takes the FIRST piece's style. Since LayOut 2025, Join
  run on a selection joins everything in it at once. Ends must MEET - there is no bridging.
- **Split**: cuts where the line is clicked; at a crossing of two lines one click gives both a shared vertex.
  Split + Erase + Join is LayOut's way of building a compound shape out of overlapping ones.
- **Fillet / Chamfer**: click a line, type the radius (or the distance), click the other. Chamfer takes ONE
  distance - an equal cut.
- **Offset**: click, preview follows the pointer, click; or type the distance.
- **Circle**: centre, radius; type a radius, `d` for a diameter. **Polygon** is the same gesture with `6s`.
- **Arc**: four tools - Arc (centre, start, end), 2 Point (start, end, bulge; Adam's A key), 3 Point, Pie.
- **Groups**: double-click to enter; **the drawing tools work inside the open group and draw into it.**

**Copied from AutoCAD:** Shift swaps Trim and Extend while held; the span to go is shown before the click.
**Not copied, deliberately:** AutoCAD's quick trim DELETES a line that nothing crosses - here nothing
happens and a line of words says why. **Beyond both:** Trim and Extend can stop at the DRAWING'S OWN
LINEWORK under the sheet (an option, off by default); a fillet of 0 makes two lines simply meet; Join can
bridge a gap (an option, off by default).


---------------------------------------------------------
## 4. The decisions everything else follows from
---------------------------------------------------------

**A. EVERYTHING THE TOOLS MAKE IS AN ORDINARY VECTOR.** The Rectangle tool set the rule - "what it makes is
not a new kind of thing" - and the Floor Areas deep dive found that not one of the sixteen files in the
select / drag / snap / grip pipeline tells one kind of shape from another. So a circle is a closed run of
`Shape__Points` and an arc an open one, as SketchUp's are, and a trimmed line is two ordinary lines. Select,
move, copy, fill, hatch, dash, the eyedropper, a floor area drawn from one, the PDF, the web viewer and
ValeVision's reader all work on the result with nothing to learn.

**B. A CURVE LOOKS LIKE A CURVE BECAUSE OF HOW MANY EDGES IT GETS.** `SegmentsFor` counts them from the
radius ON PAPER so the flat of an edge stands no more than 0.01 mm off the true curve (a 15 mm circle gets
88, a 100 mm one 224), and the painters already round every joint (`stroke-linejoin: round`, PDF round
joins). A count typed by hand (`6s`) is used as typed - that is the polygon tool.

**C. ONE WORD ON THE RECORD, AND NOTHING THAT CAN GO STALE.** `Shape__Curve : { Curve__Kind : 'circle' |
'arc' }`. No centre, no radius: a move, a nudge, a paste or a Ctrl-drag copy changes the points and would
leave a stored centre behind. `Na__LeVecCurve__Describe(points, closed)` works them out again FROM THE
POINTS and answers null the moment they stop lying on one circle at even steps. An arc's two END steps may
be short and its end points may stand a chord's sagitta inside the circle - which is exactly what a trim or
an extend leaves - so a trimmed arc is still an arc. The Object Snap session's Sources unit reads the same
function for its Centre snap (see 9).

**D. ONE ADAPTER, SIX DISPATCH SITES** - the Floor Area tool's lesson. Press, move, release, right click,
keys and typed values live in six sheet tools files. Nine tools routed from each would be fifty-four
branches. Every site asks `Na__LayoutEditor__VectorTools__.js` with the name of the tool that is up; a tenth
tool is a new unit and a row in that module's switches, and no sheet tools file changes. The adapter never
imports the sheet tools back: the tool, the Vectors panel's defaults and Shift all arrive as arguments.

**E. THE TOOLS WORK INSIDE THE CONTAINER, AND A GROUP IS DRAWN INTO.** Until now every tool but Select and
Move CLOSED an open container. `Na__LeVec__KeepsContainer` is the new rule: the seven EDIT tools never close
it; a tool that draws a plain vector (Draw, Rectangle, Circle, Arc) keeps a GROUP open and what it draws
joins that group, as in LayOut (`Behaviour__DrawInsideOpenGroup`, true); every other placing tool closes it
as before. Membership is added just BEFORE the change is announced (`RegisterBeforeAnnounce`), so the
history's one snapshot holds the shape AND its place in the group - one Ctrl+Z takes both.

**F. WHAT MAY BE EDITED FOLLOWS THE CONTAINER; WHAT CUTS IS EVERYTHING THAT CAN BE SEEN.** On the sheet: the
loose vectors (a grouped one answers as its group - step inside first). Inside a group: its own vectors.
Inside a vector: that vector. Cutting edges are every vector on a visible, snappable layer - grouped or not,
locked or not ("a lock stops an edit, not an alignment"). Pictures, QR boxes and measured rooms are never
edited, and are refused with a reason rather than ignored.

**G. ONE GESTURE, ONE UNDO STEP.** Every write is silent and ONE `Na__LeModel__AnnounceShapes` follows. A
trim that leaves two pieces, a join that swallows a line, a fence that trims six, a split of two crossing
lines: each is one Ctrl+Z. The first piece keeps the record - id, style, group, place in the paint order -
and every other piece is a copy put straight after it (`InsertShape`'s new `afterId`).


---------------------------------------------------------
## 5. The map
---------------------------------------------------------

**New folder `51__System__LayoutEditor/37__System__VectorTools/`**

| File | What it is |
|---|---|
| `...VectorTools__.js` | The adapter: one door for all nine tools; the container rule; adopting into an open group; typed values; the menu row |
| `...VectorTools__State__.js` | LEAF. Tool names, which draw and which edit, the settings (remembered in this browser), the speaker and the hint |
| `...VectorTools__Setup__.js` + `...Config__.json` | Behaviour, preview colours, every label, and the research notes |
| `...VectorTools__Geometry__.js` | PURE. Stations, crossings, Trim, Extend, SplitAt / SplitAll, Join, CloseEnds, JoinMany |
| `...VectorTools__Curves__.js` | PURE. SegmentsFor, CirclePoints, ArcPoints, the four ways to solve an arc, Describe. **The Object Snap folder imports this file - its name and exports are frozen** |
| `...VectorTools__Offset__.js` | PURE. Offset (mitres, a mitre limit, swallowed edges and slots), SideOf, corner fillet and chamfer, a vertex, the corner two lines make |
| `...VectorTools__Targets__.js` | What may be edited from here, what cuts it (vectors, and the viewports' linework when asked), writing back as one step |
| `...VectorTools__Preview__.js` | One SVG in the handles layer, in paper mm, screen-pixel weights: red goes, blue arrives, heavy blue is held, purple is a fence |
| `...CircleTool__.js` | Centre, radius; drag; typed radius / `d` / `s`; retype the one that just landed |
| `...ArcTool__.js` | LayOut's four arcs; half-circle snap; axis hold; typed chord, radius, bulge (`r`), angle; Ctrl+Z steps back |
| `...TrimTool__.js` | Trim AND Extend: hover preview, click, the fence (click-click or press-drag), Shift's swap |
| `...JoinTool__.js` | Join (click chain, weld a selection, bridge) AND Split (the crossing wins, both lines cut) |
| `...OffsetTool__.js` | Offset, Fillet and Chamfer - the three that work to a size kept AS TYPED |
| `...Panel__VectorTools__.js` + `...Styles__VectorTools__.css` | The Vector Tools section |

**Shared files touched (all additive, anchored patches):** `SheetModel__Shapes__` (afterId, curve,
AnnounceShapes), `SheetModel__Groups__` (AddGroupMember), `SheetModel__` (re-exports), `SheetRecords__`
(NormaliseShapeCurve), `Na__Hotkeys__DrawingTabs__.json` + `ConfigState__KeyMap__` (rows, `When`, context),
`SheetTools__State__` (TOOLS), `__ToolState__` (Cancel, container rule, Arm), `__PointerPress__`,
`__PointerDrag__`, `__Keyboard__`, `__ContextMenu__`, `SheetTools__` (Measurements context, speaker),
`Measurements__` (one generic vector branch), `ShapeTool__` (draws into an open group from its first
point), `ModeController__` (panel + Initialize), `Toolbar__` (Circle, Arc).

**Tests:** `80__Testing__PrototypeEnvironment/Na__Test__VectorTools__.test.mjs` - 138 checks: the three
pure modules as shipped, and the keys through the shipped file AND the fallback, with and without a
container open.


---------------------------------------------------------
## 6. Audit: the brief and the marks -> where each lives
---------------------------------------------------------

| Brief or mark | Literal reading | Where it lives | Status |
|---|---|---|---|
| "tools that are available when you're in this mode" | Tools that work INSIDE the faded container | `KeepsContainer`; `Targets__` InScope | built, proved in the app |
| Trim | - | `TrimTool__`, T in a container, panel, menu | built |
| Extend | - | `TrimTool__`, Shift+T | built |
| Join | - | `JoinTool__`, J | built |
| "Check the hotkey ... let me know if there are any conflicts" | Report, do not silently rebind | Section 2 above; DEVLOG | **T clashes with Text - Adam to confirm the `When` answer** |
| "Research online how LayOut's trim, extend and join work" | - | Section 3; config `Meta__Research` | done |
| "copy all of the features of it" | LayOut's whole vector kit | Split, Offset, Fillet, Chamfer, Polygon (6s), four arcs, draw inside a group | built; NOT built: Bezier handles, Freehand, Eraser, Ellipse (section 8) |
| "any other useful ... CAD-adjacent tools" | - | Fence, Shift swap, cut to the drawing's linework, fillet 0, bridge, typed sizes at the drawing's scale, tangent circle via Perpendicular | built |
| "add a circle drawing tool. And an arc drawing tool" | - | `CircleTool__`, `ArcTool__`, toolbar + panel + C / Shift+A | built |
| ORANGE BOX round the space under the Vectors settings | New UI goes HERE | The **Vector Tools** section, registered straight after Vectors | built - **Adam to confirm it should be its own section rather than rows at the foot of Vectors** (it is its own because Vectors folds away whenever text or a dimension is selected) |
| ARROW curling into that box from the right | "this space" - names the box | same | as above |
| The attached `Na__DataLib__CoreIndex__EdgeMaterials__.json` | Not mentioned in the words | It is the Colour Palette session's source file (that session confirmed Adam named it in ITS brief) | not mine; nothing built from it here |


---------------------------------------------------------
## 7. How it was proved
---------------------------------------------------------

- `Na__Test__VectorTools__.test.mjs`: 138 of 138. `Na__Verify__Exports__.mjs`: every import resolves. The
  whole suite (35 files) passes; `Na__Test__CrossSheetClipboard__` needed two stubs for my two new reads
  (`Na__LeVec__TOOLS`, `Na__LeScope__IsActive`) and has them.
- **In the app**, PS01 D01 Floor Plans, fresh modules, a fetch guard refusing every write (its log stayed
  EMPTY - nothing tried to write), test shapes off the paper, all deleted afterwards, the browser draft and
  the settings key removed. Driven with pointer and key events on the stage, then again with real mouse
  clicks and trusted keys:
  - Circle: C, centre, radius -> 100 sides at 20 mm, hint `circle`, reads 1,000 mm at 1:50; `1500` typed
    straight after resizes it (124 sides); `6s` makes it a hexagon. Real clicks on the toolbar's Circle
    button and the paper drew one; `750` + Enter from real keys resized it.
  - Arc: all four ways; ends EXACTLY on the clicked points; half-circle snap; `1250r`; a radius too small
    is refused and the typed value kept; typed radius then typed `90` from a centre; Ctrl+Z gives a point back.
  - Trim: T on the sheet is still Text; Shift+T is Extend and Shift held previews a trim; the red span and
    its X marks; two pieces, same colour, the second straight after the first; ONE Ctrl+Z, one Ctrl+Y.
  - Extend to the next line; a click-click fence trimmed three lines as ONE undo step; a dragged fence
    extended two.
  - Join: a rectangle joined by clicking round it closes and keeps the FIRST line's red; ends apart are
    refused with words, bridged when the option is on; J over a selection of three joined "3 vectors into 2".
  - Split at a crossing cut BOTH lines, one undo. Offset out by click and in by typed `250`; a circle
    offsets to a circle. Fillet a corner (typed 500), two separate lines (joined, first one's colour);
    chamfer 0 makes two lines meet; a size too big is refused. A right click lets go of a held line.
  - Inside a group: T is Trim and the group STAYS open; a grouped line is not a target from the sheet and a
    loose one is not from inside; the cut-off piece is a member of the same group; L and C draw INTO the
    group (the line from its first point); one Ctrl+Z takes a circle and its membership; the Text button
    still closes the container. Inside a vector only that vector answers.
  - The panel sits straight under Vectors, lights the tool that is up, shows its hint and only its
    settings; the right-click menu's Vector tools flyout picks a tool up.
- NOT tried by Adam; NOT in ValeVision.


---------------------------------------------------------
## 8. Not built, and why (candidates for the next pass)
---------------------------------------------------------

| Not built | Why | Size |
|---|---|---|
| Grips for a curve (a centre and four quadrant grips rather than 100 vertex dots when a circle is opened) | The panel's Radius / Sides boxes resize a selected curve now; grips need the press pipeline to learn a new grab, as pictures' corner grips did | medium |
| Extending an ARC along its own curve | Extend carries the END EDGE on in a straight line, right for lines and wrong for an arc's last chord | small |
| Offset's full self-intersection clean-up | Mitres, the mitre limit, swallowed edges and closed-up slots are handled; a path that folds right over itself needs a polygon clipper. clipper2 is vendored, but in its 0.9.0 port `InflatePaths` runs through the PolyTree build, which throws - so a cleaned offset would offset here and union through the flat `execute` the Boolean module uses (section 10) | medium |
| Bezier curves with handles, Freehand, Ellipse, Eraser | LayOut has them; they are a new kind of record (curves) or a new gesture, not part of this overhaul | large / small |
| Rotate, Scale, Mirror / Flip, Align and Distribute | The CAD-adjacent transforms; vectors, text and groups all want them, so they are a sheet tools job rather than a vector tools one | medium each |
| Tangent inference while drawing an arc (LayOut's turquoise) | Wants the snap system's help; Perpendicular from the centre already lands a TANGENT circle | small |
| Both-sides Offset (LayOut's Alt), several at once (`2x`) | easy once asked for | small |


---------------------------------------------------------
## 9. Traps, for whoever touches this next
---------------------------------------------------------

- **`28__System__ObjectSnap` statically imports `37__System__VectorTools/...Curves__.js`.** Rename that
  file or either export (`Na__LeVecCurve__KIND_CIRCLE`, `Na__LeVecCurve__Describe`) and the whole editor
  stops loading. **The two folders must go into the same commit.**
- A test that runs `SheetTools__State__.js` with its imports stripped needs `Na__LeVec__TOOLS : []` in its
  context, and anything calling the real `Na__LeTools__OnKey` needs a `Na__LeScope__IsActive` stub.
- A key binding goes in the JSON AND the fallback (`Na__Test__DrawingTabKeys__` enforces it). A `When` row
  must sit ABOVE the plain row for the same key.
- Sizes (offset, fillet, chamfer) are kept AS TYPED and turned into paper mm where they are used. The
  Measurements box reads its scale at `reading.anchor`; give it the same point the tool used or the figure
  shown and the figure applied will be at different scales (found in test: 5,000 mm shown for 100).
- The preview SVG lives in the handles layer. `Na__LeHandles__Clear` leaves it alone; the tools clear it.
- In a hidden Browser pane a synthetic RIGHT-button press with no release leaves the stage `panning`, and
  every hover after it is ignored - it looks exactly like "the preview is broken".


---------------------------------------------------------
## 10. The Boolean section and vectors with holes (22-Sep-2026)
---------------------------------------------------------

**The brief.** Adam: "In vector Tools add booleans, union, subtract, trim etc and a new section after a hr in the
menu" - a screenshot of three wall rectangles snapped round a stair, and one marking the space under the Edit row.
And: "look at the vector drawing system we already have, can it support islands etc?"

**The answer on islands was no.** A vector was one run of points and a Closed flag; every painter, the hit test, the
snaps, the marquee and every tool walked one ring. So holes were built first, then the tools.

| Decision | Why |
|---|---|
| The six are SketchUp's Solid Tools: Union, Subtract, Trim, Intersect, Split, Outer Shell, in Adam's order | "union, subtract, trim" are SketchUp's names; he lives in SketchUp |
| By clicking, SketchUp's order: the FIRST shape is Subtract's cutter, and Trim's (which stays, held) | His muscle memory |
| On a selection, the paint order decides (Illustrator's Pathfinder): the back shape is the one kept and cut | A box selection has no order of its own |
| Union, Intersect and Outer Shell keep the result held; Trim keeps the cutter held | Gathering walls by clicking round them; one cutter, many shapes |
| A result that comes apart is several vectors; the donor keeps its record | The line tools' rule (section 4, G) |
| Holes live in the SAME run of points: `Shape__Holes` lists where each begins | Every move, copy, paste and nudge maps the run whole, so they carry holes with nothing to learn |
| Painted even-odd, SVG and PDF, hatch and gradient clips too | Direction never matters; screen and paper agree |
| Only closed shapes take part; the line tools refuse a holed shape with a reason | A Boolean is an area; a trim is a run |
| Keys (v2.151.0; v2.150.0 bound none): Shift+U Union, Shift+S Subtract, Shift+T Trim while two or more closed shapes are selected (When BooleanSelection), Shift+O Outer Shell on that or one holed shape (When OuterShellSelection). Intersect and Split have none | Adam asked for those four. They are COMMANDS on the selection, not tool pick-ups. Shift+T was Extend on the sheet and in containers: the Boolean row sits above Extend, so Extend still wins at any other time |
| The Boolean rows sit after a rule, under their own subhead | Where Adam drew it; they work on areas, not lines |

**The map.** New: `15__Core__Markup/Na__LayoutEditor__ShapeRings__.js` (the rings leaf, no imports),
`37__System__VectorTools/...VectorTools__Boolean__.js` (the maths, Clipper2 by its own path) and
`...VectorTools__BooleanTool__.js` (the six tools). Taught rings: the records' normaliser, the shape model, the shape
geometry, the sheet chrome (SVG and PDF), the gradient and hatch PDF clips, the object snap sources, the selection box,
the keyboard's Delete, the context menu's Insert point and Open shape, the Shift-click insert, the insert hit, the
targets. Floor areas refuse a holed vector. Tests: `Na__Test__VectorBooleans__.test.mjs` (105 checks; 148 with the
keys). The keys: four rows in `Na__Hotkeys__DrawingTabs__.json` and the fallback in `ConfigState__KeyMap__`, the
situation getters in `SheetTools__Keyboard__`, the commands in the adapter (`VectorTools__`, CommandForAction and
RunCommand), SelectionTakesBoolean and SelectionTakesOuterShell in the Boolean tools.

**Traps, for whoever touches this next.**
- The vendored clipper2-js 0.9.0: never call `executePolyTree`, `Clipper.InflatePaths` or anything that reaches
  `Clipper.InvalidRect64` (a shared object its bounds helpers mutate). Use flat `execute`, and CLEAN every run before
  feeding it back: with its repeated points in, shapes that share an edge stop merging.
- A module that tests load with their imports stripped must not reach the rings leaf for a plain shape: read
  `shape.Shape__Holes` first (the normaliser keeps the key only while it holds a hole). A test that extracts single
  functions from the shape geometry needs `Na__LeShapeGeo__Holes` with them (`Na__Test__SetMoveLeaderTips__` does).
- Anything that ADDS or TAKES AWAY a point must send the hole starts with the points: `Na__LeShapeGeo__HolesAfterInsert`
  and `Na__LeShapeGeo__RemoveVertices`. A count change without them misaligns every later hole.
- `Na__LeVecAim__Replace`, `AddBeside` and `Absorb` write a piece's own holes or none - a copy never inherits its
  source's.
- A group left with one member is pruned (the editor's rule), so a Union of a group's only two members dissolves it.
- Key rows are tried in list order and the first match wins: `Edit__BooleanTrim` (Shift+T, When BooleanSelection)
  must stay ABOVE `Tool__Extend` in the JSON and in the fallback, or Extend always wins. The test checks the order.

**Next pass candidates.** The line tools on a holed shape per ring (Fillet and Chamfer a hole's corner, Offset the
whole region); a holed floor area (a room less a void: its area and label round the rings); a Divide by an open line
(Illustrator's knife); keys for Intersect and Split, if Adam wants them.


---------------------------------------------------------
## 11. Ledger
---------------------------------------------------------

| Date | What | Version |
|---|---|---|
| 21-Sep-2026 | Built, tested in the app, documented. Sessions live in the same files that day: Colour Palette (v2.126.0), Drawing Layer Context Menu (v2.127.0), Object Snap (v2.129.0), Floor Area Labels (v2.125.0), Drawing Axes | see the DEVLOG entry |
| - | Adam tries it; confirms T / `When`, the panel's place, and what comes next from section 8 | - |
| - | ValeVision port (offer once Adam confirms) | - |
| 22-Sep-2026 | The Boolean section (Union, Subtract, Trim, Intersect, Split, Outer Shell) and vectors with holes: built, tested in the app, documented (section 10). The move anchor session (v2.149.0) was live in the same sheet tools files that day | v2.150.0 |
| 22-Sep-2026 | The Boolean keys: Shift+U, Shift+S and Shift+T on two or more closed shapes selected, Shift+O on that or one holed shape; Trim on a selection says how many it cut back. Tested in the app | v2.151.0 |
