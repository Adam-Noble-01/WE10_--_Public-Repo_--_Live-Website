// =============================================================================
// TRUEVISION3D - PWA SERVICE WORKER LOGIC
// =============================================================================
//
// FILE       : TrueVision__Pwa__ServiceWorker__Logic__.js
// NAMESPACE  : TrueVision3D
// MODULE     : TrueVision__Pwa__ServiceWorker__Logic
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The caching brain behind the installed TrueVision app
// CREATED    : 27-Aug-2026
//
// DESCRIPTION:
// - Pulled in with importScripts() from the tiny stub that sits at the app
//   root, so the real logic can live alongside the rest of the install module
//   set without giving up the broad scope the stub's location buys.
// - Cache buckets:
//     tv-shell-vN   : HTML, CSS, JS, manifest, icons, fonts, HDRI environments
//     tv-data-vN    : project data and app config JSON (network-first)
//     tv-models-vN  : GLB / GLTF models from the R2 CDN (network-first with a
//                     slow-network grace window, LRU capped)
//     tv-vendor-vN  : version-locked third-party ES modules (three r184,
//                     three-mesh-bvh, clipper2-js, three-edge-projection) served
//                     same-origin from 04__Lib__ThirdParty__VersionLocked/,
//                     cache-first because a locked set never changes in place
// - Deliberately NOT precaching the full module graph. TrueVision has around a
//   hundred modules that move constantly, and a hand-maintained precache list
//   would be wrong within a week. Only the boot-critical handful is precached;
//   everything else populates naturally on the first visit through
//   stale-while-revalidate, which is what makes the second visit fast.
// - Bump PWA_SW_VERSION_TOKEN whenever shell JS or CSS changes in a way that
//   must reach clients immediately. The activate step then evicts every older
//   bucket.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.9.46
// - Token bumped (2026-09-23-07) for the flush-join tolerance (v2.159.0) and
//   the site plan holes (v2.160.0): FlushJoins 1.1.0 and the projected
//   linework config's build token change together, and the PDF exporter,
//   the publisher and ShapeRings gain the face grouping - a warm cache
//   serving the old FlushJoins under the new token, or the old PDF exporter
//   without the new ShapeRings export, would draw the seam or throw.
//
// 23-Sep-2026 - Version 1.9.45
// - Token bumped (2026-09-23-06) for the compact tab strip (v2.158.0): the
//   strip module (TabStrip 2.0.0) and the shell stylesheet change together -
//   a menu the old stylesheet has no rules for - the mode controller gains
//   the quiet entry under a document tab, and the layout config gains the
//   tab labels, so a warm cache must not serve the old half of any of them.
//
// 23-Sep-2026 - Version 1.9.44
// - Token bumped (2026-09-23-05) for the Statement Writer's lockstep
//   (v2.157.0): the statement data module and page import the new
//   52__Feature__StatementWriter/01__Core__Data/Na__LayoutEditor__Statement__Lockstep__,
//   the transport gains ReadStatementLocal and the page new data exports, and
//   the lazily linked statement stylesheet gains the question's styles - so a
//   warm cache must not serve the old half of any of them.
//
// 23-Sep-2026 - Version 1.9.43
// - Token bumped (2026-09-23-04) for the published drawings' loading screen
//   (v2.156.0): the web viewer imports the new
//   52__System__Layout__PublishedDocuments/Na__PubDoc__LoadingScreen__ and
//   passes Na__PubDoc__Build a progress listener, so the first reload after
//   the deploy shows the new release whole rather than half of it.
//
// 23-Sep-2026 - Version 1.9.42
// - Token bumped (2026-09-23-03) for publishing (v2.155.0), and a new bucket,
//   tv-published-<token>: content-hashed published pictures and linework
//   cache-first (capped at PWA_SW_PUBLISHED_MAX_ENTRIES), the index, manifests,
//   sheets and element files network-first, PDFs not cached. Added to the
//   activate keep-list and the owned prefixes. (Logged late, with -04.)
//
// 23-Sep-2026 - Version 1.9.41
// - Token bumped (2026-09-23-02) for dimension line weight and line style
//   (v2.152.0): the Dimensions panel imports new MarkupBridge exports
//   (SheetDimensionPt) and the line style module's rows, which a warm copy
//   does not have. (2026-09-23-01 was another session's bump, not logged here.)
//
// 22-Sep-2026 - Version 1.9.40
// - Token bumped (2026-09-22-14) for the Boolean keys (v2.151.0): the sheet
//   keyboard imports four new adapter exports (CommandForAction, RunCommand,
//   BooleanSelection, OuterShellSelection) that a warm copy of the vector tools
//   does not have, and the key file and the vector tools config gain rows and
//   labels the new code reads.
//
// 22-Sep-2026 - Version 1.9.39
// - Token bumped (2026-09-22-13) for the Boolean tools and holed vectors (v2.150.0):
//   the vector tools import the new BooleanTool and Boolean units (the latter
//   importing the vendored clipper2-js by its own path), and the records, shape
//   geometry, sheet chrome, gradient tool, snaps, selection box, sheet tools and
//   floor areas read the new 15__Core__Markup/Na__LayoutEditor__ShapeRings__ leaf
//   and new exports none of which a warm copy has. The Vector Tools stylesheet
//   (in the shell precache list) gains the rule over the Boolean section.
//
// 22-Sep-2026 - Version 1.9.38
// - Token bumped (2026-09-22-12) for the move anchor (v2.149.0): the pointer press,
//   pointer drag, hit resolution, tool state and sheet tools import the new
//   28__System__ObjectSnap/Na__LayoutEditor__MoveAnchor__ module, the keyboard
//   imports IsAnchorDrag and RerunAnchorDrag from the pointer drag unit - none of
//   which a warm copy has - and the ObjectSnap stylesheet gains the cross.
//
// 22-Sep-2026 - Version 1.9.37
// - Token bumped (2026-09-22-11) for Project Floor Areas (v2.148.0): the floor
//   area schedules module imports Na__LeParamArea__FORM_PROJECT and
//   Na__LeParamArea__FORMS, and the parametric panel FORM_PROJECT, from the
//   Area Schedule element - none of which a warm copy of it exports. Both
//   configs gain the new tile, keys and labels.
//
// 22-Sep-2026 - Version 1.9.36
// - Token bumped (2026-09-22-10) for Leaderless Notes (v2.147.0): the sheet
//   records, the Sheets unit and the margin (SpecMargin) import the new
//   SheetRecords__LeaderlessNotes__ leaf, and the Margin Notes panel imports
//   its new Leaderless unit - none of which a warm copy has. The notes
//   stylesheet gains the stack's rules and the app config its labels.
//
// 22-Sep-2026 - Version 1.9.35
// - Token bumped (2026-09-22-9) for the drawings save guard (v2.146.0): the auto
//   save now imports Na__DrawData__GetBlock, GetBase, WhenBaseKnown and
//   SAVED_ISO_KEY from the drawings data and the Dev menu modal's Confirm, and
//   the drawings data imports Na__LocalMirror__DrawingsFingerprint - none of
//   which a warm copy of those modules exports. The app config gains the draft
//   question's toast labels.
//
// 22-Sep-2026 - Version 1.9.34
// - Token bumped (2026-09-22-8) for the browser draft restored on a late start
//   (v2.145.0): the sheet model and the auto save now import
//   Na__DrawData__IsLoaded, which no warm copy of the drawings data exports, and
//   the sheet model no longer imports its LOADED_EVENT.
//
// 22-Sep-2026 - Version 1.9.33
// - Token bumped (2026-09-22-7) for editing a specification note in the drawing's
//   Specification tab, the bubble note tooltip and Show in Specification (v2.144.0):
//   the Specification tab's panel, SpecLinks, the sheet tools' context menu, pointer
//   drag and attach now import names no warm copy exports (Na__LeSpec__LOCATE_EVENT,
//   Na__LeSpec__WriteLocalCopy, Na__LeLeadGeo__SetNoteResolver, Na__LeLeadGeo__NoteFor)
//   and three new modules (55__Feature__SpellCheck, the row editor, the note tooltip).
// - The Specification tab's stylesheet (Na__LayoutEditor__Styles__ScrapbookSpecification__.css)
//   joins the shell precache list: its panel links it on first use, and it now carries
//   the row editor and the located row's halo - a lazily linked sheet the token does not
//   govern would paint the previous release (the Vector Tools sheet's reason).
// - 7, not the next number: a session branched from main now bumps -4 to -5, and
//   two releases carrying one token merge without a conflict and evict nothing.
//
// 22-Sep-2026 - Version 1.9.32
// - Token bumped (2026-09-22-4) for overspill note regions (v2.143.0): the
//   margin (SpecMargin) now imports its new Column and NoteRegions units and the
//   new SheetRecords__NoteRegions__ leaf, which the sheet records and the Sheets
//   unit import too; the model re-exports AddNoteRegion, UpdateNoteRegion and
//   DeleteNoteRegion; the sheet tools' state exports TOOL_REGION, which the press,
//   drag and keyboard units import, and they and the measurement unit import the
//   new region tool; the mode controller imports the new region grips; the
//   Margin Notes panel imports its new Regions unit. None of these exists in a
//   warm copy. The notes stylesheet gains the region panel and grip rules.
//
// 22-Sep-2026 - Version 1.9.31
// - Token bumped (2026-09-22-3) for viewports in groups and placing inside an
//   open group (v2.142.0): the sheet tools' tool state, the item clipboard,
//   Sheet Images' Insert and the Viewport panel import the edit scope's new
//   AdoptIntoOpenGroup, BeginAdopting, EndAdopting and WithAdoption, which no
//   warm copy of EditScope exports; the paper stylesheet moves the open-group
//   fade from the stack onto each slot and frame.
//
// 22-Sep-2026 - Version 1.9.30
// - Token bumped (2026-09-22-2) for leaders in set moves and in groups (v2.141.0):
//   Groups now imports Na__LeMarkup__DimensionBounds, which no warm copy of the
//   markup bridge exports, and the selection set imports Na__LeVpRot__Bounds,
//   Na__LeShapeGeo__Bounds and Hit and the model's GetGroups and IsLayerVisible
//   for the first time. A new importer beside an old exporter is a named import
//   that is not there, and the editor would not load until the next visit.
//
// 22-Sep-2026 - Version 1.9.29
// - Token bumped (2026-09-22-1) for Hide swings and the 1:200 scale (v2.140.0): the
//   viewport window, Viewport2d, its Frame unit and the Viewport panel now import
//   Na__LeDoors__SwingExcludeTokens, RasterLayers, SwingsHidden, SetSwingsHidden and
//   SWINGS_FIELD, which no warm copy of PlanDoors exports, and PlanDoors itself newly
//   imports the floor plan data module. The panel stylesheet (imported by the core
//   index sheet) gains the Hide swings and tight scale button rules, and the config's
//   scale list and fallback both carry 1:200.
//
// 21-Sep-2026 - Version 1.9.28
// - Token bumped (2026-09-21-20) for rotatable viewports (v2.138.0): the sheet tools'
//   press, drag and hit resolution units now import Na__LeHandles__RotateStart,
//   RotateTo and OnRotateGrip, which no warm copy of ViewportHandles exports, and a
//   dozen modules import the new Na__LayoutEditor__ViewportRotation__ leaf. A new
//   importer beside an old exporter is a named import that is not there, and the
//   editor would not load until the next visit. One bump past the uncommitted -19,
//   so this release evicts on its own whichever way the two are deployed.
//
// 21-Sep-2026 - Version 1.9.27
// - Token bumped (2026-09-21-19) for the Layout Editor's pointer-move and repaint fixes
//   (v2.136.0): the sheet model's Sheets unit now imports a name its State unit did not
//   export before (Na__LeModel__Revision). Both files sit in every warm cache, and the
//   new Sheets beside the old State is a named import that is not there - the whole
//   editor refuses to load. The same release adds the toolbar's Vector control:
//   the toolbar and the sheet surface import Na__LayoutEditor__VectorQuality__, a
//   file no warm cache holds, and the paper stylesheet carries its one rule.
//
// 21-Sep-2026 - Version 1.9.26
// - Token bumped (2026-09-21-18) for the vector tools (v2.130.0): the editor's sheet tools, its mode
//   controller, its toolbar and the Draw tool now import 51__System__LayoutEditor/37__System__VectorTools,
//   a folder no warm cache holds, and the key map's MatchKeyBinding gained an argument the
//   keyboard now passes. A stale module beside a fresh one would stop the editor loading.
// - Na__LayoutEditor__Styles__VectorTools__.css joins the shell precache list: the Vector Tools
//   panel injects it on first use, and a lazily injected sheet the token does not govern can
//   paint the previous release (the Statement stylesheets' lesson).
//
// 21-Sep-2026 - Version 1.9.25
// - Token bumped (2026-09-21-17) for the Object Snap folder (v2.129.0): the editor's snapping
//   moved to 51__System__LayoutEditor/28__System__ObjectSnap, so fourteen modules a warm
//   cache already holds now import files it does not (Na__LayoutEditor__ObjectSnap__Search__,
//   __Moves__, __GridMoves__, the controller, the menu), and
//   Na__LayoutEditor__SheetTools__GridDrag__ and the old ViewportSnapMove path are gone. A
//   stale module beside a fresh one would stop the editor loading.
//
// 21-Sep-2026 - Version 1.9.24
// - Token bumped (2026-09-21-16) for a paste across sheets bringing its layer
//   (v2.127.0): the item clipboard imports new names from the sheet
//   model (Na__LeModel__GetLayerByName, Na__LeModel__LayerIndexLike,
//   Na__LeModel__IsItemPickable). 2026-09-21-15 may ship in a different push,
//   so this takes one of its own.
//
// 21-Sep-2026 - Version 1.9.23
// - Token bumped (2026-09-21-15) for the Colour Palette and the hatch line
//   controls (v2.126.0): the panel host and the Plan Annotations toolbar import
//   a new module (54__Feature__ColourPalette/Na__ColourPalette__), and the
//   Vectors and Patterns panels import new names from the hatch module
//   (Na__LeHatch__ClampStrokePt, Na__LeHatch__CleanColour,
//   Na__LeHatch__StandardStrokePt, Na__LeHatch__StandardColour). 2026-09-21-14
//   may ship in a different push, so this takes one of its own.
//
// 21-Sep-2026 - Version 1.9.22
// - Token bumped (2026-09-21-14) for the floor area label (v2.125.0): the Floor
//   Areas module imports new names from its Geometry module
//   (Na__LeAreaGeo__LabelHome, Na__LeAreaGeo__PLACE_BOX), and the Floor Areas
//   panel imports a new module (Na__LayoutEditor__FloorAreas__LabelGrip__).
//   2026-09-21-13 is already deployed, so this takes one of its own.
//
// 21-Sep-2026 - Version 1.9.21
// - Token bumped (2026-09-21-13) for the Layer flyout and reference layers
//   (v2.123.0): a new module, Na__LayoutEditor__LayerMenu__, is imported
//   by an existing one (the sheet tools' context menu), and the sheet model
//   exports new names (Na__LeModel__IsLayerSelectable, Na__LeModel__ItemLayerId,
//   Na__LeModel__MoveToLayer) that other existing modules now import. 2026-09-21-12
//   may ship in a different push, so this takes one of its own.
//
// 21-Sep-2026 - Version 1.9.20
// - Token bumped (2026-09-21-12) for the drawing title's five millimetres (v2.122.0):
//   existing modules export new names (Na__LeParam__Refit,
//   Na__LeParamLink__BookRefresh) that other existing modules now import. 2026-09-21-11
//   may ship in a different push, so this takes one of its own.
//
// 21-Sep-2026 - Version 1.9.19
// - Token bumped (2026-09-21-11) for Sheet Images print-size storage
//   (v2.121.0): existing modules export new names (Na__LeImgGeo__StoreSize,
//   Na__LeImgGeo__NeedsRecut, Na__LeImgEnc__Recut, Na__LeImgPub__HasSource)
//   that other existing modules now import, and Na__LeImgPub__NoteOnDisk,
//   which the old Insert module imports, is gone. -10 is copy arrays' and may
//   ship in a different push, so this takes one of its own.
//
// 21-Sep-2026 - Version 1.9.18
// - Token bumped (2026-09-21-10) for copy arrays (v2.119.0): existing modules
//   export new names (Na__LeTools__BuildCopyArray, Na__LeTools__FollowCopyArray,
//   Na__LeTools__CopyArraySelection, Na__LeTools__CanMoveArray,
//   Na__LeTools__TypeMoveArray, Na__LeMParse__Array, Na__LeMParse__ARRAY_DIVIDE,
//   Na__LeMParse__REASON_COUNT) that other existing modules now import. -09 is
//   Ctrl-drag copy's (v2.117.0, v2.118.0 riding on it) and may ship in a
//   different push, so this takes one of its own.
//
// 21-Sep-2026 - Version 1.9.17
// - Token bumped (2026-09-21-09) for Ctrl-drag copy (v2.117.0). A new module,
//   Na__LayoutEditor__SheetTools__CopyDrag__, is imported by existing ones (the
//   pointer drag and keyboard units), and existing modules export new names
//   (Na__LeClip__CloneInPlace, Na__LeVpMove__Retarget,
//   Na__LeCfg__GetCopyDragModifier, Na__LeCfg__IsCopyDragKey,
//   Na__LeTools__CopyKey) that other existing modules now import - a warm cache
//   holding the old ones would fail to link. -08 is Sheet Images' (v2.116.0) and
//   may ship in a different push, so this takes one of its own.
//
// 21-Sep-2026 - Version 1.9.16
// - The Move tool fix and the three hotkey files (v2.115.0) ride on -08, the
//   token above: -07 was claimed for them and never written, because Sheet
//   Images bumped first and a push carrying both needs only the newer token.
//   v2.115.0 adds no module; existing modules export new names
//   (Na__LePc__TakeKeyboard, Na__LeCfg__ReloadKeyMap,
//   Na__KeyScope__ControlKeepsKey) that other existing modules now import. If
//   v2.115.0 ever ships in a push without v2.116.0, bump again for it then.
// - The precache list names the 3D Model tab's hotkey file by its new name,
//   Na__Hotkeys__3dModelTab__.json (it was Na__AppConfig__Hotkeys.json).
//
// 21-Sep-2026 - Version 1.9.15
// - Token bumped (2026-09-21-08) for Sheet Images (v2.116.0): a new feature
//   folder, 54__Feature__SheetImages, is imported by existing modules (the
//   sheet records, the shape model, the shape painter, the sheet chrome, the
//   grips, the pointer press, the context menu, the PDF exporter, the toolbar
//   and the mode controller), and existing modules export new names
//   (Na__LeGrips__RegisterShapeProvider, Na__DrawData__RegisterSaveStep, the
//   Na__CfApi__ sheet image helpers, Na__LeRec__NormaliseShapeImage). -07 is
//   the Move tool fix's (v2.115.0); this takes one of its own.
// - A fifth bucket, tv-images-vN, for the pictures placed on sheets
//   (…/05__Layout__DrawingDocs__Images/<document id>/<file>), cache-first and
//   LRU capped at 160. A stored picture's name ends in its content hash, so a
//   cached copy can never be stale - unlike Scene_00N.webp, which is why
//   those are data. Tested before the shell-asset pattern, whose bucket has
//   no cap and would otherwise have taken every CGI a viewer ever opened.
//
// 21-Sep-2026 - Version 1.9.14
// - Token bumped (2026-09-21-06) for the drawing grid (v2.114.0). New modules -
//   27__System__DrawingGrid (state, controller, panel) and
//   Na__LayoutEditor__SheetTools__GridDrag__ - are imported by existing ones (the
//   snapping module, the pointer drag and hit resolution units, the Text,
//   Dimension and Leader tools, the viewport snap move, the keyboard, the
//   toolbar and the mode controller), and the sheet surface exports a new name,
//   Na__LeSurface__GetSheetChrome. -05 is v2.113.0's own uncommitted bump and may
//   ship in a different push, so this takes one of its own.
//
// 21-Sep-2026 - Version 1.9.13
// - Token bumped (2026-09-21-05) for Ortho mode on F8 (v2.113.0). A new module,
//   32__System__OrthoMode/Na__LayoutEditor__OrthoMode__, imports a new name -
//   Na__LeMeasure__Say - from the Measurements box, an existing module. Checked
//   against HEAD: origin/main and HEAD both carry 2026-09-21-03, and -04 is
//   v2.112.0's own uncommitted bump; this work may ship in a different push, so
//   it takes a bump of its own (the 1.9.10 precedent). One push carrying both
//   needs only this token.
//
// 21-Sep-2026 - Version 1.9.12
// - Token bumped (2026-09-21-04) for Page Up / Page Down on drawings, the
//   Register's Ctrl+S and the Walk exit (v2.112.0). The PC controls export a
//   new name - Na__LePc__STEP_SHEET_EVENT - and the mode controller, an
//   existing module, now imports it. Checked against HEAD: origin/main and
//   HEAD both carry 2026-09-21-03, i.e. -03 is DEPLOYED, so a warm cache holds
//   the old PC controls and the new mode controller would fail to link - a
//   blank editor - until the second visit.
//
// 21-Sep-2026 - Version 1.9.11
// - Token bumped (2026-09-21-03) for the zoom settle (Layout Editor: zoom now,
//   redraw when it rests). The sheet surface exports two new names -
//   Na__LeSurface__ZOOM_SETTLED_EVENT and Na__LeSurface__NoteZoomGesture - and
//   five existing modules now import them (Navigation, SheetTools,
//   Measurements, MarginGrip and DraftMode). Checked against HEAD: origin/main and HEAD both
//   carry 2026-09-21-02, i.e. -02 is DEPLOYED, so a warm cache holds the old
//   sheet surface and a new importer would fail to link until the second visit.
//
// 21-Sep-2026 - Version 1.9.10
// - Token bumped (2026-09-21-02) for the storey band on plans (v2.105.0).
//   A new module, 50__System__ProjectedLinework/Na__ProjectedLinework__Storeys__,
//   and new exports that existing modules now import across files:
//   Na__PlCfg__GetStoreySetup (ConfigAccess, imported by DoorPose and the
//   Projector) and Na__PlDoors__Storeys (DoorPose, imported by the Projector).
//   HEAD's 2026-09-21-01 is not pushed yet, but this work is not committed
//   with it and may ship in a later push, so it takes a bump of its own
//   (agreed with the Floor Areas session, which stays at v2.106.0 and checks
//   the token against HEAD again at its own commit).
//
// 21-Sep-2026 - Version 1.9.9
// - The token already reads 2026-09-21-01, bumped earlier today for the
//   Project Portal block; the deployed one is still 2026-09-20-14 (HEAD), so
//   ONE eviction covers both that release and Floor Areas, and no second bump
//   was made. Floor Areas needs it: new modules
//   (51__System__LayoutEditor/59__Feature__FloorAreas) import new exports from
//   Na__LayoutEditor__SheetModel__ - the area groups and their announcement -
//   and a warm cache holds the OLD copy of that module, so a new importer
//   would link against exports it does not have and the editor would not load
//   at all until the second visit. Checked against HEAD before deciding, the
//   way the note under Traps says to.
//
// 20-Sep-2026 - Version 1.9.8
// - Token bumped (2026-09-20-14, over another session's -13) for the third and
//   last half of the LineworkModifier work plus two fixes found beside it: the
//   Base Image now honours the detail tags (SnapshotRenderer, Viewport2d Frame
//   and Viewport2d), storey categories finally resolve their configured edge
//   style (ModelLayers), and the model loader warns on duplicate category URLs
//   (MultiModel). All shell JS, all cache-first, and the storey style fix in
//   particular changes how EVERY existing drawing inks itself - a warm cache
//   would keep inking them flat black at 1.00 and the fix would look like it
//   had not shipped.
//
// 20-Sep-2026 - Version 1.9.7
// - Token bumped (2026-09-20-12) for the second half of the LineworkModifier
//   work: the authored-edge collector now tags per linework NODE rather than
//   per category root, which is shell JS and so cache-first. -11 never reached
//   a client, but it is bumped rather than carried because a client warmed on
//   -11 would hold the sampler fix without the authored-edge fix, which is the
//   half that actually draws the stonework.
//
// 20-Sep-2026 - Version 1.9.6
// - Token bumped (2026-09-20-11) for the LineworkModifier nested detail tags
//   (SSOT 76-79): Na__ProjectedLinework__StageSampler__.js now resolves a
//   nested tag's own owner key instead of its parent category's, and
//   Na__LayoutEditor__Viewport2d__Linework__.js now enforces that owner key's
//   Model Layers checkbox at paint time. Both are shell JS, cache-first, so a
//   client warmed on -10 or earlier kept running the old sampling and paint
//   logic under the new panel rows and JSON style config (tv-data is
//   network-first, so THAT half updated immediately) - the checkbox toggling
//   nothing and the weight field doing nothing were both this, not a second
//   bug: the config had changed but the code reading it had not yet reached
//   the client.
//
// 20-Sep-2026 - Version 1.9.5
// - Token bumped (2026-09-20-10) for the parametric scale bar stood to the
//   right of its title. Bumped rather than carried by -9 for the same reason
//   -9 was not carried by -8: the releases may not ship together, and HEAD
//   still holds -4, so a client can warm at -9 before this goes out. That
//   bucket would hold a Drawing Title module with no PLACE_BELOW or
//   PLACE_RIGHT export and a Grips module that never imported the snapping
//   module, beside a new panel and a new grips module that name both. The
//   editor would fail at import and stay failed until the second visit.
//
// 20-Sep-2026 - Version 1.9.4
// - Token bumped (2026-09-20-9) for the Statement Writer, and this one is
//   bumped rather than carried by -8 because the two releases may not ship
//   together. -8 is still undeployed (HEAD holds -4), so if both go out at
//   once either token would do; if the fog ships first, a client would then be
//   warm at -8 - a bucket holding a mode controller and a tab strip WITHOUT
//   the Statements tab, and a PDF exporter without Na__LePdf__LoadLibrary,
//   which the new statement exporter imports by name. That pairing fails at
//   import and takes the whole editor with it until the second visit. A
//   needless bump costs one shell download; a missed one costs the editor.
// - Seventeen new modules under 52__Feature__StatementWriter join the graph,
//   and the mode controller and tab strip gained new imports and exports
//   (Na__LeMode__OpenStatements, Na__LeMode__VIEW_STATEMENT).
//
// 20-Sep-2026 - Version 1.9.3
// - NO FURTHER BUMP for the Elevation Depth Fog, and it needs one: 2026-09-20-8
//   is still undeployed (HEAD holds -4), so it covers this release with the ones
//   below. For whoever next asks why: the fog adds exports that ALREADY-CACHED
//   modules now name - the elevation data module's GetDepthFog / SetDepthFog /
//   GetDepthFogPlane (the row builders, the editor and the mode controller),
//   the section engine's RenderDepthInto, the Viewport 2D frame unit's four fog
//   functions and Viewport2d's RenderFogForExport (the PDF exporter). A warm
//   cache pairing any of those new importers with yesterday's exporter fails
//   its import. If -8 has been deployed by the time this ships, bump again.
// - Token bumped (2026-09-20-8): hatches on vector shapes. The sheet chrome now IMPORTS
//   the hatch module, which is a new edge in the graph of cached importers, and
//   the hatch module gained two more exports that the chrome and the PDF
//   exporter both name. A warm cache pairing the new chrome with yesterday's
//   hatch module fails its import and takes the whole editor down until the
//   second visit.
// - Token bumped (2026-09-20-7): the site plan subtype and the Site Plan Render
//   Composites panel. Two new modules again - the composites rule module and
//   its panel - plus a NEW EXPORT, the hatch token, that the site plan painter
//   now imports. A warm cache holding yesterday's hatch module would serve a
//   file without it and the painter's import would fail, which takes the whole
//   editor down until the second visit. Also the fix for the Patterns panel
//   not repainting: without a new token a warm client keeps the old painter
//   and Adam sees the same bug he reported.
// - Token bumped (2026-09-20-6): the hatch pattern system. Two new modules
//   (36__System__HatchPatternTools) are now imported by the mode controller, the
//   site plan painter, SheetRecords and SheetModel__Viewports - all modules a warm
//   cache already holds, so a cached copy of any of them would link against a
//   graph with no such files. (2026-09-20-5 was another session's, same afternoon.)
//
// 20-Sep-2026 - Version 1.9.2
// - Token bumped (2026-09-20-4): two site plan stores per project, Existing and
//   Proposed. The site plan store gains QualifyKey, SplitKey, StoreIdForKey,
//   ResolveAll, GetStores and DefaultStoreId, and the site plan viewport module
//   gains SitePlanStoreId - all named by new imports in modules a warm cache
//   already holds (ModelSource, Viewport2d, the Viewport Settings panel), so a
//   cache at -3 would link against exports that are not in its copy.
//
// 20-Sep-2026 - Version 1.9.1
// - Token bumped (2026-09-20-3): the Floor Plans and Elevations menu rebuild
//   (v2.86.0) and the floor plan storey levels. Both add exports to modules a
//   warm cache already holds - RegisterPayloadGuard on the drawings block,
//   RequestOpenId on the row accordion, the Stage functions on the rename
//   module, the storey getters on the floor plan data, the title text's source
//   names - and cached importers link against them. (-2, earlier the same day,
//   was another session's and carries no note of its own here.)
//
// 20-Sep-2026 - Version 1.9.0
// - Token bumped (2026-09-20-1): the North Direction tool and the parametric
//   Drawing Title. New modules import NEW exports from modules a warm cache
//   already holds - RegisterViewportNamer on the sheet model, SetTools and the
//   element presets on the parametric engine - and app modules are
//   stale-while-revalidate, so without this the first visit after the deploy
//   would link new importers against old exporters and the editor would not
//   load at all until the second.
//
// 19-Sep-2026 - Version 1.8.0
// - Token bumped (2026-09-19-1): the Safari install fix. Index.html is
//   network-first and carries the fix that matters (no static manifest link),
//   so new icons are right from the first load. The bump is for the icons
//   already out there: an icon made while the fault was live holds its own
//   copy of the old shell, and without this it would take two launches to
//   reach the handler that tells its owner how to replace it. It also carries
//   the registrar that no longer reloads on a first install.
//
// 18-Sep-2026 - Version 1.7.2
// - Token bumped (2026-09-18-3): the iPad round of the web viewer - the touch
//   recogniser and the drawing surface - is shell JS again, and an installed
//   copy would otherwise keep turning the page every time it was panned.
//
// 18-Sep-2026 - Version 1.7.1
// - Token bumped (2026-09-18-2): the web viewer's second round - the tab strip
//   scroller, the page clipping and the chrome that now clears the tab strip -
//   is more shell CSS again.
//
// 18-Sep-2026 - Version 1.7.0
// - Token bumped (2026-09-18-1): the Layout Editor's read-only web viewer is
//   new shell JS and CSS, and an installed copy holding the old shell would
//   keep showing the editor's panel columns on a phone. This is the bump that
//   reaches it.
//
// 16-Sep-2026 - Version 1.6.0
// - Token bumped (2026-09-16-6): the container-level z-index bump wasn't
//   enough - the active card's blue ring was still rendering behind the
//   prev/next chevron buttons (same stacking context, sibling elements).
//   Gave .na-pm-carousel__nav and .na-pm-carousel__cards their own
//   position:relative + z-index so the cards wrapper unconditionally paints
//   above the nav buttons.
//
// 16-Sep-2026 - Version 1.5.0
// - Token bumped (2026-09-16-5): scene carousel z-index raised from 1000 to
//   1004 so the active card's blue ring never renders behind the nav toolbar,
//   header, or help panel.
//
// 16-Sep-2026 - Version 1.4.0
// - Token bumped (2026-09-16-4): card pop animation toned down from
//   scale(1.12) to scale(1.06) - the original was too strong.
//
// 16-Sep-2026 - Version 1.3.0
// - Token bumped (2026-09-16-3): scene carousel now flashes its wake/opaque
//   state on PageUp/PageDown and the number-key scene-jump hotkeys (not just
//   clicks), and the newly active card plays a scale-up "pop" animation on
//   click, touch, or hotkey. Changes the scene carousel module and its
//   stylesheet.
//
// 16-Sep-2026 - Version 1.2.0
// - Token bumped (2026-09-16-2): hotkey remap changed Na__Hotkeys__Manager.js's
//   config schema (Na__AppConfig__Hotkeys.json's Na__Hotkeys__ViewModes object
//   became the array-based Na__TrueVision__HotkeysDictionary) and the action-map
//   keys Index.html passes to Na__Hotkeys__Initialize (short ids like
//   switchToOrbit became full action strings like TrueVision__NavMode__SetOrbitMode).
//   A stale-while-revalidate client pairing the old Index.html with the new
//   manager (or vice versa) would have every hotkey silently do nothing - exactly
//   the mismatched-pairing risk this token exists for. Also changed: the scene
//   carousel's new exports (GoToNextScene / GoToPreviousScene / IsCarouselVisible /
//   GoToSceneAtIndex) and the User Instructions content fragment's hotkeys list
//   markup.
//
// 10-Sep-2026 - Version 1.1.0
// - three.js moved off esm.sh and into the same-origin version-locked vendor
//   folder (v2.20.0). The vendor bucket survives, but it is now selected by a
//   PATH test rather than a remote origin, and that test runs FIRST in the
//   classifier because vendor files are .js and would otherwise be swept into
//   the shell bucket by PWA_SW_PATTERN_SHELL_ASSET. Shell is
//   stale-while-revalidate on the live site, which is the wrong strategy for a
//   renderer: a half-updated three.js is not a thing that can be reasoned about.
// - esm.sh is no longer a trusted remote origin, so PWA_SW_REMOTE_ORIGINS_OWNED
//   holds the R2 CDN alone.
// - NOTE for offline: three.module.js imports ./three.core.js RELATIVELY. Both
//   files must be reachable or the app boots online and dies offline.
//
// 27-Aug-2026 - Version 1.0.0
// - Initial release, ported from the ValeVision3D / Whitecardopedia PWA stack
//   and retuned for TrueVision's asset mix.
//
// 07-Sep-2026 - Version 1.0.2
// - Bumped the version token for the Elevation Drawings build, which RENAMED a
//   cross-module export: the scene carousel's SetSceneNavigationOverride became
//   AddSceneNavigationRouter, and the floor plan navigation module moved into
//   the drawing view core.
// - This is the case the token exists for and it is worth spelling out. Live
//   app modules are stale-while-revalidate, so a warm client serves the OLD
//   carousel alongside the NEW controllers - a module graph that never existed
//   as a set. Nothing throws; the routers simply never register, and clicking a
//   floor plan or elevation thumbnail falls through to the ordinary camera
//   flight with no cut applied. It reads exactly like the feature was never
//   wired up, on a build where it was.
// - RULE OF THUMB: renaming or moving ANY export that crosses a module boundary
//   needs this token bumped in the same commit. Adding a new export does not -
//   UNLESS something in the same release imports it by name, which is the
//   ordinary reason to add one. A warm client can serve the new importer beside
//   the cached old exporter, and a named import that is not there is a hard
//   SyntaxError: the whole module graph refuses to load, and the editor is
//   broken until a second visit. Treat "new export plus new import of it" as a
//   rename for the purposes of this token.
//
// 27-Aug-2026 - Version 1.0.1
// - Fixed regenerated Presentation Mode scene thumbnails appearing stale on the
//   live site. Scene_00N.webp is overwritten in place by "Regen Thumb", but the
//   generic .webp shell-asset pattern routed it to stale-while-revalidate, so
//   the previous image was served and the new one only appeared on a second
//   reload. Scene thumbnails are now classified as data (network-first).
//
// =============================================================================

(function () {

// -----------------------------------------------------------------------------
// REGION | Cache Configuration
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Cache Identifiers and Limits
    // ------------------------------------------------------------
    const PWA_SW_VERSION_TOKEN              = '2026-09-23-07';                                                            // <-- BUMP THIS to force-evict every cache bucket
    const PWA_SW_CACHE_NAME_SHELL           = `tv-shell-${PWA_SW_VERSION_TOKEN}`;                                                    // <-- App shell cache id
    const PWA_SW_CACHE_NAME_DATA            = `tv-data-${PWA_SW_VERSION_TOKEN}`;                                                     // <-- Project / config JSON cache id
    const PWA_SW_CACHE_NAME_MODELS          = `tv-models-${PWA_SW_VERSION_TOKEN}`;                                                   // <-- Model GLB cache id
    const PWA_SW_CACHE_NAME_VENDOR          = `tv-vendor-${PWA_SW_VERSION_TOKEN}`;                                                   // <-- Third-party ES module cache id
    const PWA_SW_CACHE_NAME_IMAGES          = `tv-images-${PWA_SW_VERSION_TOKEN}`;                                                   // <-- Layout Editor sheet pictures cache id
    const PWA_SW_CACHE_NAME_PUBLISHED       = `tv-published-${PWA_SW_VERSION_TOKEN}`;                                                // <-- Published drawings: baked pictures, linework and fog masks
    const PWA_SW_CACHE_PREFIXES_OWNED       = ['tv-shell-', 'tv-data-', 'tv-models-', 'tv-vendor-', 'tv-images-', 'tv-published-'];  // <-- Owned prefixes, used for cleanup
    const PWA_SW_MODELS_MAX_ENTRIES         = 80;                                                                                    // <-- LRU cap on the model bucket
    const PWA_SW_IMAGES_MAX_ENTRIES         = 160;                                                                                   // <-- LRU cap on the sheet pictures bucket
    const PWA_SW_PUBLISHED_MAX_ENTRIES      = 240;                                                                                   // <-- LRU cap on the published drawings bucket
    const PWA_SW_MODELS_NETWORK_TIMEOUT_MS  = 4000;                                                                                  // <-- Slow-network grace before serving cache
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Path Recognition Patterns
    // ------------------------------------------------------------
    const PWA_SW_PATTERN_MODEL_GLB          = /\.(glb|gltf)(\?.*)?$/i;                                                              // <-- 3D model files
    const PWA_SW_PATTERN_HDRI               = /\.hdr(\?.*)?$/i;                                                                     // <-- HDR environment maps (immutable filenames)
    const PWA_SW_PATTERN_DATA_JSON          = /\.json(\?.*)?$/i;                                                                    // <-- Project data and app config
    const PWA_SW_PATTERN_HTML               = /\.html?(\?.*)?$/i;                                                                   // <-- HTML documents
    const PWA_SW_PATTERN_SHELL_ASSET        = /\.(css|js|mjs|webmanifest|ico|png|jpe?g|svg|webp|woff2?)(\?.*)?$/i;                   // <-- App shell assets
    const PWA_SW_PATTERN_SCENE_THUMBNAIL    = /\/PresentationMode\/Thumbnails\/[^/]+\.webp(\?.*)?$/i;                                // <-- Per-project scene thumbnails (mutable, fixed filenames)
    const PWA_SW_PATTERN_SHEET_IMAGE        = /\/05__Layout__DrawingDocs__Images\/[^/]+\/[^/]+\.(webp|jpe?g|png)(\?.*)?$/i;          // <-- Pictures placed on sheets (immutable: the name carries the content hash)
    const PWA_SW_PATTERN_PUBLISHED_ASSET    = /\/06__Layout__PublishedDocuments\/.+__[0-9a-f]{10}\.(svg|webp|png)(\?.*)?$/i;       // <-- Baked viewport files and shared images (immutable: the name carries the content hash)
    const PWA_SW_PATTERN_PUBLISHED_DATA     = /\/06__Layout__PublishedDocuments\/.+\.json(\?.*)?$/i;                               // <-- The index, manifests, sheets and element files (fixed names, changed by a re-publish)
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Ownership Rules
    // ------------------------------------------------------------
    const PWA_SW_SAME_ORIGIN_FOLDER_TOKENS  = [                                                                                     // <-- Same-origin folders this worker manages
        '/na-apps/30__TrueVision__CoreAppCode/',                                                                                    // <-- The TrueVision app itself
        '/na-apps/01__Assets__NaApps__CommonAssets/'                                                                                // <-- Shared Noble Architecture assets
    ];
    const PWA_SW_REMOTE_ORIGIN_CDN          = 'https://cdn.noble-architecture.com';                                                  // <-- R2 CDN: models and project data
    const PWA_SW_REMOTE_ORIGINS_OWNED       = [PWA_SW_REMOTE_ORIGIN_CDN];                                                            // <-- Trusted CORS-enabled remote hosts

    // The version-locked vendor libraries (three r184, three-mesh-bvh,
    // clipper2-js, three-edge-projection) moved from esm.sh to this same-origin
    // folder on 10-Sep-2026 (v2.20.0). They are immutable for the life of a
    // version-locked set, so they keep the cache-first vendor bucket - but the
    // classifier now recognises them by PATH rather than by remote origin, and
    // that test must run BEFORE the shell-asset pattern, which also matches .js.
    const PWA_SW_VENDOR_PATH_TOKEN          = '/04__Lib__ThirdParty__VersionLocked/';                                                // <-- Same-origin version-locked vendor folder
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Development Environment Detection
    // ------------------------------------------------------------
    // On localhost the shell strategy switches from stale-while-revalidate to
    // network-first. Stale-while-revalidate is exactly right in production -
    // instant load, refresh in the background - but during development it
    // serves the PREVIOUS save of every edited module and only picks the new
    // one up on a second reload. That wastes far more time than the cache
    // saves, and quietly makes you debug code you already fixed.
    // ------------------------------------------------------------
    const PWA_SW_IS_DEV_ENVIRONMENT         = ['localhost', '127.0.0.1', '0.0.0.0'].indexOf(self.location.hostname) !== -1;         // <-- True on the local dev server
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Boot-Critical Precache List (relative to scope)
    // ------------------------------------------------------------
    const PWA_SW_SHELL_PRECACHE_RELATIVE    = [                                                                                     // <-- Best-effort; a miss never fails install
        'Index.html',
        '03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css',
        '02__Src__AppModules/02__AppData/Na__AppConfig__Main.json',
        '02__Src__AppModules/02__AppData/Na__Hotkeys__3dModelTab__.json',
        '02__Src__AppModules/62__Feature__AppInstallability/TrueVision__Pwa__Manifest__Fallback__.webmanifest',

        // THE TWO STATEMENT STYLESHEETS ARE HERE FOR A REASON, and it is not
        // that they are boot-critical - they are not. They are injected as
        // link tags the first time the Statements tab is mounted, which kept
        // them off the download for anyone who never writes a statement. That
        // saving cost 54 KB and bought a bug: off this list they are ordinary
        // shell requests, and away from localhost the shell is served
        // stale-while-revalidate, so the FIRST load after either file changed
        // painted the statement with the previous release's styling - wrong
        // face, wrong heading sizes, a rule drawn as an empty box - and only
        // a second reload put it right. Precached, the version token governs
        // them like everything else, and a bump evicts them outright.
        '02__Src__AppModules/51__System__LayoutEditor/52__Feature__StatementWriter/08__Style__Stylesheets/Na__LayoutEditor__Styles__Statement__.css',
        '02__Src__AppModules/51__System__LayoutEditor/52__Feature__StatementWriter/08__Style__Stylesheets/Na__LayoutEditor__Styles__Statement__Document__.css',
        // The Vector Tools panel injects its own sheet on first use, for the same
        // reason: precached, the token governs it.
        '02__Src__AppModules/51__System__LayoutEditor/37__System__VectorTools/Na__LayoutEditor__Styles__VectorTools__.css',
        // So does the drawing's Specification tab - and its sheet now draws the
        // row editor and the located row's halo.
        '02__Src__AppModules/51__System__LayoutEditor/58__Feature__ScrapbookSpecification/Na__LayoutEditor__Styles__ScrapbookSpecification__.css'
    ];
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Boot-Critical Vendor Precache List (relative to scope)
    // ------------------------------------------------------------
    // These go into the VENDOR bucket, not the shell bucket, because that is
    // where the fetch classifier looks for them. Precaching them into shell
    // would look right and do nothing.
    //
    // Only the renderer is listed. Without it, a user who installs the app and
    // goes offline before ever loading a project gets a dead icon: every module
    // on the page imports 'three', and the import map now points at a file that
    // was never fetched. Everything else populates naturally on first use.
    //
    // three.core.js is NOT optional padding - three.module.js imports it with a
    // relative specifier, so caching only the entry point produces an app that
    // boots online and fails offline, which is the worst of both.
    const PWA_SW_VENDOR_PRECACHE_RELATIVE   = [                                                                                     // <-- Best-effort; a miss never fails install
        '04__Lib__ThirdParty__VersionLocked/01__Vendor__ThreeJs__v0.184.0/build/three.module.js',
        '04__Lib__ThirdParty__VersionLocked/01__Vendor__ThreeJs__v0.184.0/build/three.core.js'
    ];
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helper Utilities
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve the Scope Path Prefix
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ServiceWorker__Logic__GetScopePathPrefix() {
        const scopeUrl      = new URL(self.registration && self.registration.scope ? self.registration.scope : self.location.href); // <-- Parse the scope URL
        return scopeUrl.pathname.endsWith('/') ? scopeUrl.pathname : `${scopeUrl.pathname}/`;                                       // <-- Ensure a trailing slash
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Determine Whether a Request Belongs to This Worker
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ServiceWorker__Logic__IsOwnedRequest(requestUrl) {
        try {
            const targetUrl = new URL(requestUrl);                                                                                  // <-- Parse the target URL

            if (PWA_SW_REMOTE_ORIGINS_OWNED.indexOf(targetUrl.origin) !== -1) return true;                                          // <-- Trusted remote hosts
            if (targetUrl.origin !== self.location.origin) return false;                                                            // <-- Skip all other cross-origin

            return PWA_SW_SAME_ORIGIN_FOLDER_TOKENS.some(token => targetUrl.pathname.indexOf(token) !== -1);                        // <-- Same-origin folders we manage
        } catch (error) {
            return false;                                                                                                           // <-- Treat parse failures as not-owned
        }
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Classify a Request for Cache Routing
    // ---------------------------------------------------------------
    function TrueVision__Pwa__ServiceWorker__Logic__ClassifyRequest(request) {
        const requestUrl    = request.url || '';                                                                                    // <-- Snapshot the URL

        if (requestUrl.indexOf(PWA_SW_VENDOR_PATH_TOKEN) !== -1) return 'vendor';                                                   // <-- Version-locked vendor library (path test, before the .js shell pattern)
        if (PWA_SW_PATTERN_MODEL_GLB.test(requestUrl)) return 'model';                                                              // <-- 3D model GLB / GLTF
        if (PWA_SW_PATTERN_HDRI.test(requestUrl)) return 'hdri';                                                                    // <-- HDR environment map

        // Scene thumbnails must be tested BEFORE the shell-asset pattern, which
        // also matches .webp. They are mutable content under a fixed filename -
        // "Regen Thumb" overwrites Scene_00N.webp in place - so the shell's
        // stale-while-revalidate strategy would serve the previous image and
        // only pick the new one up on a second reload. Treat them as data.
        if (PWA_SW_PATTERN_SCENE_THUMBNAIL.test(requestUrl)) return 'data';                                                         // <-- Regenerated thumbnails must never go stale

        // Sheet pictures are also tested BEFORE the shell-asset pattern, for
        // the opposite reason: a stored picture's name ends in its content
        // hash, so a name never means two pictures and a cached copy can never
        // be stale. They get a capped bucket of their own - a CGI is a few MB,
        // and the shell bucket has no cap.
        if (PWA_SW_PATTERN_SHEET_IMAGE.test(requestUrl)) return 'sheet-image';                                                      // <-- Content-hashed: download once

        // Published drawings, tested BEFORE the shell pattern for the same
        // reasons. A baked file's name carries its content hash, so it is kept
        // for ever in a capped bucket of its own. The index, the manifests and
        // the element files keep their names across a re-publish, so they are
        // asked of the network first - a reader must see a new publish - and
        // only fall back to the cache when offline. A baked PDF is neither: it
        // is left to the browser, because a phone's cache quota is not the place
        // for a document it downloads once.
        if (PWA_SW_PATTERN_PUBLISHED_ASSET.test(requestUrl)) return 'published-asset';                                              // <-- Content-hashed: download once
        if (PWA_SW_PATTERN_PUBLISHED_DATA.test(requestUrl))  return 'published-data';                                               // <-- Fixed names: network first

        if (PWA_SW_PATTERN_DATA_JSON.test(requestUrl)) return 'data';                                                               // <-- Project data or app config
        if (PWA_SW_PATTERN_HTML.test(requestUrl)) return 'html';                                                                    // <-- HTML document
        if (PWA_SW_PATTERN_SHELL_ASSET.test(requestUrl)) return 'shell';                                                            // <-- App shell asset

        return 'other';                                                                                                             // <-- Fall through, leave to the network
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Trim a Cache Down to a Maximum Entry Count
    // ---------------------------------------------------------------
    async function TrueVision__Pwa__ServiceWorker__Logic__TrimCacheLru(cacheName, maxEntries) {
        try {
            const cacheInstance = await caches.open(cacheName);                                                                     // <-- Open the cache
            const allRequests   = await cacheInstance.keys();                                                                       // <-- List the entries
            const overflowCount = allRequests.length - maxEntries;                                                                  // <-- Compute the overflow
            if (overflowCount <= 0) return;                                                                                         // <-- Nothing to trim

            for (let entryIndex = 0; entryIndex < overflowCount; entryIndex += 1) {
                await cacheInstance.delete(allRequests[entryIndex]);                                                                // <-- Drop the oldest entries first
            }
        } catch (error) {
            console.warn('[TrueVision3D PWA SW] LRU trim failed:', error);                                                          // <-- Non-blocking log
        }
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Cache Strategies
// -----------------------------------------------------------------------------

    // FUNCTION | Cache First
    // ------------------------------------------------------------
    async function TrueVision__Pwa__ServiceWorker__Logic__CacheFirst(request, cacheName) {
        const cacheInstance     = await caches.open(cacheName);                                                                     // <-- Open the named cache
        const cachedResponse    = await cacheInstance.match(request);                                                               // <-- Look up the cached entry
        if (cachedResponse) return cachedResponse;                                                                                  // <-- Cache hit, return immediately

        try {
            const networkResponse = await fetch(request);                                                                           // <-- Network fetch
            if (networkResponse && networkResponse.ok) {
                cacheInstance.put(request, networkResponse.clone()).catch(() => {});                                                // <-- Persist a clone, best-effort
            }
            return networkResponse;                                                                                                 // <-- Return the live response
        } catch (error) {
            return Response.error();                                                                                                // <-- Fail closed when offline and uncached
        }
    }
    // ---------------------------------------------------------------


    // FUNCTION | Cache First, Capped
    // ------------------------------------------------------------
    // Cache first for content that can never change under its name, with the
    // bucket trimmed back to its cap after each new entry lands.
    // ------------------------------------------------------------
    async function TrueVision__Pwa__ServiceWorker__Logic__CacheFirstCapped(request, cacheName, maxEntries) {
        const cacheInstance     = await caches.open(cacheName);                                                                     // <-- Open the named cache
        const cachedResponse    = await cacheInstance.match(request);                                                               // <-- Look up the cached entry
        if (cachedResponse) return cachedResponse;                                                                                  // <-- Cache hit, return immediately

        try {
            const networkResponse = await fetch(request);                                                                           // <-- Network fetch
            if (networkResponse && networkResponse.ok) {
                cacheInstance.put(request, networkResponse.clone())
                    .then(() => TrueVision__Pwa__ServiceWorker__Logic__TrimCacheLru(cacheName, maxEntries))                         // <-- Keep the bucket under its cap
                    .catch(() => {});                                                                                               // <-- Best-effort
            }
            return networkResponse;                                                                                                 // <-- Return the live response
        } catch (error) {
            return Response.error();                                                                                                // <-- Fail closed when offline and uncached
        }
    }
    // ---------------------------------------------------------------


    // FUNCTION | Stale While Revalidate
    // ------------------------------------------------------------
    async function TrueVision__Pwa__ServiceWorker__Logic__StaleWhileRevalidate(request, cacheName) {
        const cacheInstance     = await caches.open(cacheName);                                                                     // <-- Open the named cache
        const cachedResponse    = await cacheInstance.match(request);                                                               // <-- Cached entry, may be undefined

        const networkPromise    = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
                cacheInstance.put(request, networkResponse.clone()).catch(() => {});                                                // <-- Refresh the cache in the background
            }
            return networkResponse;                                                                                                 // <-- Return the live response
        }).catch(() => null);                                                                                                       // <-- Swallow network errors

        return cachedResponse || (await networkPromise) || Response.error();                                                        // <-- Cache, then network, then error
    }
    // ---------------------------------------------------------------


    // FUNCTION | Network First
    // ------------------------------------------------------------
    async function TrueVision__Pwa__ServiceWorker__Logic__NetworkFirst(request, cacheName) {
        const cacheInstance     = await caches.open(cacheName);                                                                     // <-- Open the named cache

        try {
            // cache:'no-store' overrides the captured Request's own cache mode so a
            // "network-first" strategy can never be quietly satisfied by the browser's
            // own HTTP disk cache. Without it, a stale TrueVision__ProjectData__.json
            // could sit in the disk cache and keep being written back into tv-data-*
            // as though it were fresh, which no cache-clear action could ever reach.
            const networkResponse = await fetch(request, { cache: 'no-store' });                                                    // <-- Genuinely hit the network
            if (networkResponse && networkResponse.ok) {
                cacheInstance.put(request, networkResponse.clone()).catch(() => {});                                                // <-- Refresh the cache
            }
            return networkResponse;                                                                                                 // <-- Return the live response
        } catch (error) {
            const cachedResponse = await cacheInstance.match(request);                                                              // <-- Look up the offline fallback
            if (cachedResponse) return cachedResponse;                                                                              // <-- Serve stale data when offline
            return Response.error();                                                                                                // <-- Fail closed when uncached
        }
    }
    // ---------------------------------------------------------------


    // FUNCTION | Network First With a Slow-Network Grace Window (models)
    // ------------------------------------------------------------
    // Behaviour contract:
    //   Good connection : the fresh network copy always wins; cache refreshed.
    //   Slow connection : if the network exceeds the grace window AND a cached
    //                     copy exists, the cached model is served immediately.
    //                     The in-flight fetch still completes and refreshes the
    //                     cache, so the NEXT load gets the fresh copy.
    //   Offline         : the cached copy is served; an error only when uncached.
    // ------------------------------------------------------------
    async function TrueVision__Pwa__ServiceWorker__Logic__NetworkFirstWithGrace(request, cacheName, graceTimeoutMs, maxEntries) {
        const cacheInstance     = await caches.open(cacheName);                                                                     // <-- Open the named cache
        const cachedResponse    = await cacheInstance.match(request);                                                               // <-- Existing cached copy, may be undefined

        const networkPromise    = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
                cacheInstance.put(request, networkResponse.clone()).then(() => {
                    TrueVision__Pwa__ServiceWorker__Logic__TrimCacheLru(cacheName, maxEntries);                                     // <-- Trim only after a successful put
                }).catch(() => {});                                                                                                 // <-- Quota failures must not break the response
            }
            return networkResponse;                                                                                                 // <-- Live response
        });

        if (!cachedResponse) {
            return networkPromise.catch(() => Response.error());                                                                    // <-- No fallback; the network is the only source
        }

        const graceTimer        = new Promise((resolve) => setTimeout(() => resolve('grace-expired'), graceTimeoutMs));             // <-- Slow-network grace window
        const raceWinner        = await Promise.race([networkPromise.catch(() => 'network-failed'), graceTimer]);                   // <-- First settled outcome wins

        if (raceWinner === 'grace-expired' || raceWinner === 'network-failed') {
            return cachedResponse;                                                                                                  // <-- Serve the cache; the fetch still refreshes
        }

        return raceWinner;                                                                                                          // <-- Fresh network response
    }
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Lifecycle Event Handlers
// -----------------------------------------------------------------------------

    // EVENT HANDLER | Service Worker Install
    // ------------------------------------------------------------
    self.addEventListener('install', (installEvent) => {
        installEvent.waitUntil((async () => {
            try {
                const shellCache    = await caches.open(PWA_SW_CACHE_NAME_SHELL);                                                   // <-- Open the shell cache
                const vendorCache   = await caches.open(PWA_SW_CACHE_NAME_VENDOR);                                                  // <-- Open the vendor cache
                const scopePrefix   = TrueVision__Pwa__ServiceWorker__Logic__GetScopePathPrefix();                                  // <-- Resolve the scope prefix

                const precacheJobs  = [                                                                                             // <-- Pair each list with its destination bucket
                    ...PWA_SW_SHELL_PRECACHE_RELATIVE.map(relative  => ({ url: `${scopePrefix}${relative}`, cache: shellCache })),
                    ...PWA_SW_VENDOR_PRECACHE_RELATIVE.map(relative => ({ url: `${scopePrefix}${relative}`, cache: vendorCache }))
                ];

                await Promise.all(precacheJobs.map(async (job) => {
                    try {
                        const response = await fetch(job.url, { cache: 'reload' });                                                 // <-- Force a fresh fetch
                        if (response && response.ok) {
                            await job.cache.put(job.url, response.clone());                                                         // <-- Best-effort precache
                        }
                    } catch (resourceError) {
                        // Silent: a missing precache entry must never fail the install
                    }
                }));
            } catch (error) {
                console.warn('[TrueVision3D PWA SW] Install precache failed:', error);                                              // <-- Non-blocking log
            }

            await self.skipWaiting();                                                                                               // <-- Activate immediately
        })());
    });
    // ---------------------------------------------------------------


    // EVENT HANDLER | Service Worker Activate
    // ------------------------------------------------------------
    self.addEventListener('activate', (activateEvent) => {
        activateEvent.waitUntil((async () => {
            try {
                const keepList      = [                                                                                             // <-- Buckets belonging to this version
                    PWA_SW_CACHE_NAME_SHELL,
                    PWA_SW_CACHE_NAME_DATA,
                    PWA_SW_CACHE_NAME_MODELS,
                    PWA_SW_CACHE_NAME_VENDOR,
                    PWA_SW_CACHE_NAME_IMAGES,
                    PWA_SW_CACHE_NAME_PUBLISHED                                                                                     // <-- Without this, every activation would delete the published bucket
                ];

                const allCacheNames = await caches.keys();                                                                          // <-- Enumerate every cache

                await Promise.all(allCacheNames.map(async (cacheName) => {
                    const isOwnedCache = PWA_SW_CACHE_PREFIXES_OWNED.some(prefix => cacheName.startsWith(prefix));                  // <-- Only touch our own buckets
                    if (!isOwnedCache) return;                                                                                      // <-- Leave foreign caches alone
                    if (keepList.indexOf(cacheName) !== -1) return;                                                                 // <-- Keep the current version
                    await caches.delete(cacheName);                                                                                 // <-- Delete a superseded version
                }));
            } catch (error) {
                console.warn('[TrueVision3D PWA SW] Activate cleanup failed:', error);                                              // <-- Non-blocking log
            }

            await self.clients.claim();                                                                                             // <-- Take control of open clients
        })());
    });
    // ---------------------------------------------------------------


    // EVENT HANDLER | Fetch Routing
    // ------------------------------------------------------------
    self.addEventListener('fetch', (fetchEvent) => {
        const request       = fetchEvent.request;                                                                                   // <-- Snapshot the request
        if (request.method !== 'GET') return;                                                                                       // <-- Only handle GET
        if (!TrueVision__Pwa__ServiceWorker__Logic__IsOwnedRequest(request.url)) return;                                            // <-- Skip requests we do not own

        const classification = TrueVision__Pwa__ServiceWorker__Logic__ClassifyRequest(request);                                     // <-- Route by classification

        if (classification === 'model') {
            fetchEvent.respondWith(TrueVision__Pwa__ServiceWorker__Logic__NetworkFirstWithGrace(                                    // <-- Fresh when fast, cached when slow
                request, PWA_SW_CACHE_NAME_MODELS, PWA_SW_MODELS_NETWORK_TIMEOUT_MS, PWA_SW_MODELS_MAX_ENTRIES
            ));
            return;
        }

        if (classification === 'sheet-image') {
            fetchEvent.respondWith(TrueVision__Pwa__ServiceWorker__Logic__CacheFirstCapped(                                         // <-- Content-hashed: download once, keep the bucket capped
                request, PWA_SW_CACHE_NAME_IMAGES, PWA_SW_IMAGES_MAX_ENTRIES
            ));
            return;
        }

        if (classification === 'published-asset') {
            fetchEvent.respondWith(TrueVision__Pwa__ServiceWorker__Logic__CacheFirstCapped(                                         // <-- Content-hashed: download once, keep the bucket capped
                request, PWA_SW_CACHE_NAME_PUBLISHED, PWA_SW_PUBLISHED_MAX_ENTRIES
            ));
            return;
        }

        if (classification === 'published-data') {
            fetchEvent.respondWith(TrueVision__Pwa__ServiceWorker__Logic__NetworkFirst(request, PWA_SW_CACHE_NAME_PUBLISHED));      // <-- A re-publish must be seen; the last copy serves offline
            return;
        }

        if (classification === 'hdri') {
            fetchEvent.respondWith(TrueVision__Pwa__ServiceWorker__Logic__CacheFirst(request, PWA_SW_CACHE_NAME_SHELL));            // <-- Immutable filename, download once
            return;
        }

        if (classification === 'vendor') {
            fetchEvent.respondWith(TrueVision__Pwa__ServiceWorker__Logic__CacheFirst(request, PWA_SW_CACHE_NAME_VENDOR));           // <-- Version-pinned, safe to pin forever
            return;
        }

        if (classification === 'data') {
            fetchEvent.respondWith(TrueVision__Pwa__ServiceWorker__Logic__NetworkFirst(request, PWA_SW_CACHE_NAME_DATA));           // <-- Always prefer fresh project data
            return;
        }

        if (classification === 'html') {
            fetchEvent.respondWith(TrueVision__Pwa__ServiceWorker__Logic__NetworkFirst(request, PWA_SW_CACHE_NAME_SHELL));          // <-- Avoid a stale shell / module mismatch
            return;
        }

        if (classification === 'shell') {
            fetchEvent.respondWith(PWA_SW_IS_DEV_ENVIRONMENT
                ? TrueVision__Pwa__ServiceWorker__Logic__NetworkFirst(request, PWA_SW_CACHE_NAME_SHELL)                             // <-- Dev: edits show on the first reload
                : TrueVision__Pwa__ServiceWorker__Logic__StaleWhileRevalidate(request, PWA_SW_CACHE_NAME_SHELL));                   // <-- Live: fast, with a background refresh
            return;
        }
    });
    // ---------------------------------------------------------------


    // EVENT HANDLER | Message-Based Cache Reset (Diagnostic)
    // ------------------------------------------------------------
    self.addEventListener('message', (messageEvent) => {
        if (!messageEvent.data || messageEvent.data.type !== 'truevision-clear-caches') return;                                     // <-- Ignore unrelated messages

        messageEvent.waitUntil((async () => {
            try {
                const ownedCaches = (await caches.keys())
                    .filter(cacheName => PWA_SW_CACHE_PREFIXES_OWNED.some(prefix => cacheName.startsWith(prefix)));                 // <-- Owned caches only

                await Promise.all(ownedCaches.map(cacheName => caches.delete(cacheName)));                                          // <-- Drop them all

                if (messageEvent.source && messageEvent.source.postMessage) {
                    messageEvent.source.postMessage({ type: 'truevision-cleared', success: true });                                 // <-- Acknowledge
                }
            } catch (error) {
                if (messageEvent.source && messageEvent.source.postMessage) {
                    messageEvent.source.postMessage({ type: 'truevision-cleared', success: false, error: String(error) });          // <-- Report the failure
                }
            }
        })());
    });
    // ---------------------------------------------------------------

// endregion -------------------------------------------------------------------

})();
