# TrueVision3D - NOTES - Standard Drawing Groups (Floor Plans, Elevations, Sections)
# =========================================================

**Status:** a note, not a plan. Dictated by Adam on 20-Sep-2026 in the middle of the Elevation Depth
Fog build ("after you finish the fog effect, make a note that we need to..."). NOTHING HERE IS BUILT.
**Written by:** the depth fog session, with what it found on RB05 while answering his question.

---

## 1. What he asked for, in his words

> It didn't add them into the elevations group I've made or the floor plans group. It's adding them
> into whatever the last presentation scenes group I made always uses. [...] We need to make it so
> that, in groups, you can show or hide different groups. There should always be a floor plans group
> and an elevations group, but by default, they are switched off. The same goes for sections.
> Sections, plans, and elevations always have a standardised group that is switched off by default
> and can't be deleted. If you switch it on, it means it's visible, and the user can see that group.
> That just gives a place for them to always live that's always there, and it means when they're
> created, they're always put there. If you want, you can switch or move them to other groups, but
> it puts them in a consistent place always.

Read literally, six requirements:

| # | Requirement |
|---|---|
| G1 | Every project ALWAYS has three standard groups: Floor Plans, Elevations, Sections |
| G2 | They are switched OFF by default |
| G3 | They cannot be deleted |
| G4 | Switched on = visible: the viewer sees that group in the carousel |
| G5 | A new plan, elevation or section is ALWAYS filed into its standard group |
| G6 | The author may still move a drawing's scene to any other group afterwards |

---

## 2. What actually happened on RB05 (found 20-Sep-2026)

His question was "the elevations built in the new system don't appear in any of the other systems -
has it been linked up?". It HAS been linked: RB05's four elevations each have a scene, linked both
ways (`Elevation__SceneId` <-> `PresentationMode__Scene__ElevationId`):

| Elevation | Scene | Filed in |
|---|---|---|
| Elevation_001 North West | Scene_031 | **Group_005 "Interior 3D - First Floor"**, order 7 |
| Elevation_002 North East | Scene_032 | Group_005, order 8 |
| Elevation_003 South East | Scene_033 | Group_005, order 9 |
| Elevation_004 South West | Scene_034 | Group_005, order 10 |

while `Group_007 "Elevations"` exists, enabled, and EMPTY ("No scenes in this group yet").

**It is not "the last group made". It is a hard-coded group ID.**
`45__System__ElevationViews/Na__Elevation__SceneLink__.js`, `Na__ElevLink__ResolveTargetGroupId`:

1. a group NAMED `Elevations` wins (`ElevationViews__SceneGroup__TargetGroupName`);
2. else the group whose ID is `Group_005` (`ElevationViews__SceneGroup__TargetGroupId`);
3. else the group is created.

Step 2 is the fault. Group IDs are issued per project in the order groups were made, so `Group_005`
means "Elevations" only on a project seeded from the default set. On RB05 the fifth group made was
"Interior 3D - First Floor". The elevations were created BEFORE a group named Elevations existed, so
step 1 missed, step 2 matched the wrong group by its number, and step 3 - which would have done the
right thing - was never reached. The module's own header warns against exactly this ("Filing an
elevation into Exterior 3D Views would be silently wrong in a way the author would only notice much
later") and then does it.

Floor plans carry the same trap with a different tail: `42/Na__FloorPlan__SceneLink__.js` tries the
name `Floor Plans`, then the ID `Group_004`, then FALLS BACK TO THE FIRST ENABLED GROUP rather than
creating one. RB05's plans landed correctly only because its fourth group happens to be "Floor Plans".

---

## 3. What the code already has, and the one rule that fights the brief

- **A per-group switch exists**: `PresentationMode__Group__Enabled`, edited in
  `21/Na__PresentationMode__DevMenu__GroupEditor__.js`. "Show or hide a group" is there today.
- **Delete exists** with no protected groups: `Na__PmGroupDev__DeleteGroup` (GroupEditor ~line 280).
  G3 needs a guard there, and the button hidden or disabled on a standard group.
- **THE CONFLICT - a switched-off group does not hide its scenes, it EVICTS them.**
  `21/Na__PresentationMode__SceneGroups__Data__.js`, `ResolveSceneGroupId`: a scene whose group is
  missing OR switched off "falls back to the first enabled group so it can never disappear from the
  carousel". Under G2 every drawing scene would therefore surface in the FIRST enabled group -
  "Exterior 3D Views" on RB05 - which is today's fault again by another road. For a standard group,
  off must mean HIDDEN FROM THE VIEWER, not re-homed. That fallback has to learn the difference, and
  the viewer-side accessors (`FilterViewerScenes` in `...ProjectJson__SceneData.js` is where the
  viewer's set already narrows for layout-editor-only scenes) are the natural place.
- **The Layout Editor's Scene picker must still list them.**
  `51/40/Na__LayoutEditor__Panel__ViewportSettings__.js`, `Na__LePanelViewport__SceneOptions`, walks
  ENABLED groups and then appends every scene not yet listed, without a group name. With the standard
  groups off the drawings would still be offered, but as bare names at the bottom. They should be
  listed under their own group whether it is on or off - an authoring tool reads the raw set.
- **Both auto-enable flags contradict G2**: `...SceneGroup__AutoEnableTargetGroup: true` in both
  configs switches a matched group ON when a drawing is filed into it ("a hidden group would swallow
  the plan"). Under the new rule a hidden standard group is the intended resting state.
- **Cross sections have no records yet** (`48__System__CrossSectionViews/` is a placeholder; a section
  today is an elevation whose type is Section). G1 asks for the Sections group now, as a place that
  is "always there"; what files into it waits for that system - or Section-type elevations go there.

---

## 4. A shape for it (suggestion only)

- Identify a standard group by a KIND, not by its name or its number:
  `PresentationMode__Group__StandardKind: 'plans' | 'elevations' | 'sections'`. A name can be retyped
  and an ID is an accident of creation order; a kind is neither. Both SceneLink modules then resolve
  "the group of my kind" and the two ID keys leave the configs.
- An `EnsureStandardGroups(config)` run on load and before any drawing is filed: adds whichever of
  the three are missing, switched off, ordered last. Adopt an existing group by name where one
  matches exactly ("Floor Plans", "Elevations") rather than making a second - RB05 and PS01 both have
  hand-made ones already.
- MIGRATION, asked before done: drawing scenes sitting in a non-standard group (RB05's four) could be
  offered a move to their standard group. He said moving them elsewhere is allowed (G6), so a scene
  somebody placed on purpose must not be dragged back; only ones the ID fallback misfiled are
  candidates, and the app cannot tell those apart - so it offers, once, and does not decide.
- The draft rule from the Drawing Menus rebuild still holds: nothing of an open draft is written to
  the presentation block early (`TrueVision__PLAN__DrawingMenus__.md`, section 3).

---

## 5. Smallest fix available now, if the full feature waits

Delete step 2 from `Na__ElevLink__ResolveTargetGroupId` (and its twin in the floor plan link): name
match, else create. That alone stops a new elevation being filed by another project's group number.
It does not move RB05's four; those can be re-homed today from the Presentation Scenes editor's Group
dropdown, one at a time, which is what his screenshot of scene #7 shows.
