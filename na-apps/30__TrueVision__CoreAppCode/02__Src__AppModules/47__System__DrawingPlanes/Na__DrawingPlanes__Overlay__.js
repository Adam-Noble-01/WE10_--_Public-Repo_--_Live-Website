// =============================================================================
// TRUEVISION3D - DRAWING PLANES - OVERLAY
// =============================================================================
//
// FILE       : Na__DrawingPlanes__Overlay__.js
// NAMESPACE  : Na__PlaneOverlay
// MODULE     : Drawing Planes - Overlay
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Decide which drawing planes are up in the 3D view, where each one stands and what colour it is
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - THE PROBLEM THIS ANSWERS (Adam, 20-Sep-2026): "there's no visual way to see
//   what planes correspond to what plans and elevations... if you could switch
//   on one of them, or quite helpfully all of them at once, it would be useful
//   for showing you where that plane is."
//
// - ONE SYSTEM, TWO KINDS OF DRAWING. A floor plan's plane is horizontal and an
//   elevation's is vertical, and that is the only difference this module knows.
//   Each Dev menu editor registers a SOURCE - how to list its records, name
//   them, read and write a plane's position - and everything else is shared:
//   the shown set, the selection, the colours, the snap grid, the layout.
//
// - A PLANE IS UP WHEN IT IS SHOWN OR SELECTED. Shown is the eye toggle on its
//   row, and stays until it is switched off. Selected is the one row being
//   worked on - touching a row's controls selects its plane, so the numbers
//   always have something visible attached, exactly as the old gizmo followed
//   the row. Selecting never adds to the shown set, so a plane that was only up
//   because its row was touched goes again when something else is.
//
// - COLOUR COMES FROM THE RECORD'S OWN ID NUMBER, not from its place in the
//   list, so deleting a drawing never recolours the ones after it and the
//   same drawing is the same colour every session. The row's swatch asks
//   here, so the panel and the 3D view cannot disagree.
//
// - THE NUMBERS STAY THE DEFINITION. Nothing here stores anything in a record.
//   A drag or a pick goes through the source's setPositionMm, which writes the
//   same fields the panel's sliders write.
//
// - NEVER IN A DRAWING, NEVER IN AN EXPORT. The root group is registered with
//   Na__InteractiveOverlays, which keeps it invisible except inside an
//   interactive 3D frame. This module only ever says whether it WANTS to be
//   shown.
//
// - THE SHOWN SET IS KEPT BETWEEN VISITS, PER PROJECT. Switching a plane on is
//   a persistent toggle: it outlives the panel closing, as it always did, and
//   now outlives a reload too. A plane key is a drawing id, which means
//   nothing outside the project that issued it, so the store is keyed by
//   project code and a project switch empties the set and refills it from what
//   THAT project last had up. Restored keys name records no source has
//   registered for yet, so a key is only ever dropped as unknown once its own
//   TYPE's records have been seen - Na__PlaneOverlay__Live. The snap settings
//   are kept the same way.
//
// SOURCE ADAPTER (what an editor registers):
//   {
//     kind           'vertical' | 'horizontal'
//     paletteOffset  places along the palette this type starts (optional)
//     list()         -> the live records
//     getId(r)       -> string, unique within the type
//     getName(r)     -> the drawing's name
//     isSection(r)   -> boolean (optional)
//     getAxes(r)     -> { normalX, normalZ, rightX, rightZ }   vertical only
//     getPositionMm(r)      -> distance along the normal, or the cut's height
//     setPositionMm(r, mm)  -> write it back through the record's own fields
//     describe(r)    -> short text for the drag readout (optional)
//     onLive(r)      -> while dragging, throttled (optional)
//     onCommit(r)    -> once, on release or after a pick (optional)
//     applyFacePick(r, hit, snap, mode) -> message, or null to refuse
//   }
//
// INTEGRATION:
// - Initialised from Index.html with the scene and the model root.
// - Na__DrawingPlanes__Grip__ reads GetPlanes and drives Select / SetHover.
// - Na__DrawingPlanes__DevMenu__Controls__ drives the shown set and the snap.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.1.0
// - The shown set is kept in the browser, per project, so switching a plane on
//   is a persistent toggle rather than a session one.
//
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation for the Drawing Planes build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core, Render Loop and Units
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    import {
        Na__InteractiveOverlays__Register,
        Na__InteractiveOverlays__SetWanted
    } from '../05__RenderPipeline/Na__RenderLoop__InteractiveOverlays__.js';
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    import { Na__DrawData__CHANGED_EVENT, Na__DrawData__GetProjectCode } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Planes Config, Maths, Bounds and Mesh
    // ------------------------------------------------------------
    // @delegate: ./Na__DrawingPlanes__ConfigState__.js
    // @delegate: ./Na__DrawingPlanes__Maths__.js
    // @delegate: ./Na__DrawingPlanes__Bounds__.js
    // @delegate: ./Na__DrawingPlanes__PlaneMesh__.js
    // ------------------------------------------------------------
    import {
        Na__PlaneCfg__Load,
        Na__PlaneCfg__IsEnabled,
        Na__PlaneCfg__GetSnapSetup,
        Na__PlaneCfg__GetAppearanceSetup
    } from './Na__DrawingPlanes__ConfigState__.js';
    import {
        Na__PlaneMath__NearestInList,
        Na__PlaneMath__StepInList
    } from './Na__DrawingPlanes__Maths__.js';
    import {
        Na__PlaneBounds__Measure,
        Na__PlaneBounds__FrameVertical,
        Na__PlaneBounds__FrameHorizontal
    } from './Na__DrawingPlanes__Bounds__.js';
    import {
        Na__PlaneMesh__Create,
        Na__PlaneMesh__Update,
        Na__PlaneMesh__GetRegions,
        Na__PlaneMesh__Dispose
    } from './Na__DrawingPlanes__PlaneMesh__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Naming, Events and Storage
    // ------------------------------------------------------------
    const Na__PlaneOverlay__GROUP_NAME      = 'Na__DrawingPlanes__Overlay';
    const Na__PlaneOverlay__CHANGED_EVENT   = 'na-drawing-planes-changed';       // <-- detail.reason: shown | selection | snap | pick | sources
    const Na__PlaneOverlay__SNAP_STORE_KEY  = 'Na__DrawingPlanes__Snap';
    const Na__PlaneOverlay__SHOWN_STORE_KEY = 'Na__DrawingPlanes__Shown';        // <-- Which planes are switched on, per project
    const Na__PlaneOverlay__SHOWN_MAX_KEPT  = 12;                                // <-- Projects remembered; the oldest is dropped past this
    const Na__PlaneOverlay__KIND_VERTICAL   = 'vertical';
    const Na__PlaneOverlay__KIND_HORIZONTAL = 'horizontal';
    const Na__PlaneOverlay__KEY_JOIN        = ':';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Host References
    // ------------------------------------------------------------
    let Na__PlaneOverlay__Scene     = null;   // <-- Scene the overlay root is added to
    let Na__PlaneOverlay__ModelRoot = null;   // <-- What the planes are sized from
    let Na__PlaneOverlay__Root      = null;   // <-- Root group, built on first use
    // ------------------------------------------------------------

    // MODULE VARIABLES | Sources, the Shown Set, Selection and Hover
    // ------------------------------------------------------------
    const Na__PlaneOverlay__Sources = new Map();   // <-- type -> source adapter
    const Na__PlaneOverlay__Shown   = new Set();   // <-- plane keys whose eye toggle is on
    const Na__PlaneOverlay__Live    = new Set();   // <-- types whose records have been seen at least once: only these may be pruned from the shown set
    let   Na__PlaneOverlay__ShownProject = null;   // <-- Project code the shown set belongs to
    const Na__PlaneOverlay__Planes  = new Map();   // <-- plane key -> { key, type, id, record, source, handle, frame, colour }
    let   Na__PlaneOverlay__SelectedKey = null;
    let   Na__PlaneOverlay__HoverKey    = null;
    let   Na__PlaneOverlay__HoverRegion = null;
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Snap State
    // ------------------------------------------------------------
    let Na__PlaneOverlay__Snap = null;             // <-- { enabled, incrementMm }, read lazily so the config has had its chance to load
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keys, Colours and Events
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Key of One Plane
    // ------------------------------------------------------------
    function Na__PlaneOverlay__KeyOf(type, id) {
        return String(type) + Na__PlaneOverlay__KEY_JOIN + String(id);
    }
    function Na__PlaneOverlay__TypeOf(key) {
        const at = String(key).indexOf(Na__PlaneOverlay__KEY_JOIN);
        return (at === -1) ? '' : String(key).slice(0, at);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tell Whoever Is Listening That Something Changed
    // ------------------------------------------------------------
    // The Dev menu controls refresh themselves IN PLACE on this. They must
    // never answer it by rebuilding a panel: touching a slider selects its
    // plane, and a rebuild would replace that slider under the author's hand.
    // ------------------------------------------------------------
    function Na__PlaneOverlay__Announce(reason) {
        window.dispatchEvent(new CustomEvent(Na__PlaneOverlay__CHANGED_EVENT, { detail : { reason : reason } }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What Is Switched On, Kept Between Visits
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read the Whole Store: Project Code -> Plane Keys
    // ------------------------------------------------------------
    function Na__PlaneOverlay__ReadStore() {
        try {
            const stored = JSON.parse(window.localStorage.getItem(Na__PlaneOverlay__SHOWN_STORE_KEY) || 'null');
            return (stored && typeof stored === 'object' && !Array.isArray(stored)) ? stored : {};
        } catch (error) { return {}; }                                           // <-- A browser that refuses storage simply starts clean
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep What Is Switched On, Under the Project It Belongs To
    // ------------------------------------------------------------
    // Per project, because a plane key is a drawing id and a drawing id means
    // nothing outside the project that issued it. Re-inserted each time, so
    // the object's own key order is least-recently-used and the oldest
    // projects fall off the end rather than growing without limit.
    // ------------------------------------------------------------
    function Na__PlaneOverlay__StoreShown() {
        if (!Na__PlaneOverlay__ShownProject) return false;
        const store = Na__PlaneOverlay__ReadStore();
        delete store[Na__PlaneOverlay__ShownProject];
        if (Na__PlaneOverlay__Shown.size > 0) store[Na__PlaneOverlay__ShownProject] = Array.from(Na__PlaneOverlay__Shown);

        const codes = Object.keys(store);
        for (let i = 0; i < codes.length - Na__PlaneOverlay__SHOWN_MAX_KEPT; i++) delete store[codes[i]];

        try { window.localStorage.setItem(Na__PlaneOverlay__SHOWN_STORE_KEY, JSON.stringify(store)); } catch (error) { /* Session only */ }
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take Up the Project Now Loaded, and What It Had Switched On
    // ------------------------------------------------------------
    // Called at startup and again whenever the project changes. A project
    // switch replaces every record, and the ids belong to the project that
    // has gone, so the shown set is emptied and refilled from what THIS
    // project last had up. Does nothing at all while the project is the same
    // one - the scenes-loaded event also fires for a reload of the same data.
    // ------------------------------------------------------------
    function Na__PlaneOverlay__AdoptProject() {
        const code = Na__DrawData__GetProjectCode() || null;
        if (code === Na__PlaneOverlay__ShownProject) return false;
        Na__PlaneOverlay__ShownProject = code;
        Na__PlaneOverlay__Live.clear();                                          // <-- The new project's records have not been seen yet: nothing may be pruned

        const restored = code ? Na__PlaneOverlay__ReadStore()[code] : null;
        Na__PlaneOverlay__Shown.clear();
        if (Array.isArray(restored)) restored.forEach((key) => { if (typeof key === 'string') Na__PlaneOverlay__Shown.add(key); });
        Na__PlaneOverlay__SelectedKey = null;

        Na__PlaneOverlay__Refresh();
        Na__PlaneOverlay__Announce('shown');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Colour of One Plane
    // ------------------------------------------------------------
    // The number at the end of the record's id picks the palette entry, so
    // Elevation_003 is the same colour whatever is deleted around it.
    // ------------------------------------------------------------
    function Na__PlaneOverlay__GetColour(type, id) {
        const look    = Na__PlaneCfg__GetAppearanceSetup();
        const palette = look.palette;
        const source  = Na__PlaneOverlay__Sources.get(type);

        const match   = /(\d+)\s*$/.exec(String(id || ''));
        const ordinal = match ? parseInt(match[1], 10) : 1;
        const offset  = (source && Number.isFinite(source.paletteOffset)) ? source.paletteOffset : 0;

        const index = (((Math.max(1, ordinal) - 1) + offset) % palette.length + palette.length) % palette.length;
        return palette[index];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Layout
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Root Group on First Use
    // ------------------------------------------------------------
    function Na__PlaneOverlay__EnsureRoot() {
        if (Na__PlaneOverlay__Root || !Na__PlaneOverlay__Scene) return Na__PlaneOverlay__Root;
        Na__PlaneOverlay__Root = new THREE.Group();
        Na__PlaneOverlay__Root.name = Na__PlaneOverlay__GROUP_NAME;
        Na__PlaneOverlay__Root.userData.naSectionCutHelper = true;
        Na__PlaneOverlay__Scene.add(Na__PlaneOverlay__Root);                     // <-- In the scene, outside the model root: never measured, toggled, walked on or phase-swapped
        Na__InteractiveOverlays__Register(Na__PlaneOverlay__Root);               // <-- Invisible from here on, except inside an interactive 3D frame
        return Na__PlaneOverlay__Root;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where One Record's Plane Stands
    // ------------------------------------------------------------
    function Na__PlaneOverlay__FrameFor(source, record) {
        const positionUnits = Na__Math__ConvertMmToUnits(source.getPositionMm(record));
        if (source.kind === Na__PlaneOverlay__KIND_HORIZONTAL) {
            return Na__PlaneBounds__FrameHorizontal(Na__PlaneOverlay__ModelRoot, positionUnits);
        }
        return Na__PlaneBounds__FrameVertical(Na__PlaneOverlay__ModelRoot, source.getAxes(record), positionUnits);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Lay Out and Dress One Plane
    // ------------------------------------------------------------
    function Na__PlaneOverlay__UpdatePlane(plane) {
        plane.frame = Na__PlaneOverlay__FrameFor(plane.source, plane.record);
        Na__PlaneMesh__Update(plane.handle, {
            frame       : plane.frame,
            colour      : plane.colour,
            name        : plane.source.getName(plane.record),
            isSection   : (typeof plane.source.isSection === 'function') && plane.source.isSection(plane.record) === true,
            selected    : (plane.key === Na__PlaneOverlay__SelectedKey),
            hoverRegion : (plane.key === Na__PlaneOverlay__HoverKey) ? Na__PlaneOverlay__HoverRegion : null
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Every Record of Every Source, by Plane Key
    // ------------------------------------------------------------
    function Na__PlaneOverlay__ListAll() {
        const found = new Map();
        Na__PlaneOverlay__Sources.forEach((source, type) => {
            const records = source.list() || [];
            if (records.length > 0) Na__PlaneOverlay__Live.add(type);            // <-- This type's records have arrived: its keys may now be pruned
            for (let i = 0; i < records.length; i++) {
                const id = source.getId(records[i]);
                if (!id) continue;
                found.set(Na__PlaneOverlay__KeyOf(type, id), { type : type, id : id, record : records[i], source : source });
            }
        });
        return found;
    }
    // ------------------------------------------------------------


    // FUNCTION | Bring the Scene Into Step With the Shown Set and the Selection
    // ------------------------------------------------------------
    // Re-reads the records every time. They are a handful, and a panel can
    // add, delete, rename or re-aim one between any two calls.
    // ------------------------------------------------------------
    function Na__PlaneOverlay__Refresh() {
        if (!Na__PlaneOverlay__Scene) return false;

        const all    = Na__PlaneOverlay__ListAll();
        const wanted = new Set();

        // A key that names no record is dropped - its drawing was deleted -
        // but ONLY once that TYPE's records have been seen. At startup a key
        // restored from the last visit names a record the panels have not
        // registered a source for yet, and dropping it there would forget
        // every plane the author left switched on.
        Na__PlaneOverlay__Shown.forEach((key) => {
            if (all.has(key)) wanted.add(key);
            else if (Na__PlaneOverlay__Live.has(Na__PlaneOverlay__TypeOf(key))) Na__PlaneOverlay__Shown.delete(key);
        });
        if (Na__PlaneOverlay__SelectedKey) {
            if (all.has(Na__PlaneOverlay__SelectedKey)) wanted.add(Na__PlaneOverlay__SelectedKey);
            else Na__PlaneOverlay__SelectedKey = null;                           // <-- Its drawing was deleted
        }
        if (!Na__PlaneCfg__IsEnabled()) wanted.clear();

        // TAKE DOWN what is no longer wanted
        Na__PlaneOverlay__Planes.forEach((plane, key) => {
            if (wanted.has(key)) return;
            Na__PlaneMesh__Dispose(plane.handle);
            Na__PlaneOverlay__Planes.delete(key);
        });
        if (Na__PlaneOverlay__HoverKey && !wanted.has(Na__PlaneOverlay__HoverKey)) {
            Na__PlaneOverlay__HoverKey    = null;
            Na__PlaneOverlay__HoverRegion = null;
        }

        // PUT UP, or move, what is
        if (wanted.size > 0) Na__PlaneOverlay__EnsureRoot();
        wanted.forEach((key) => {
            const entry = all.get(key);
            let plane   = Na__PlaneOverlay__Planes.get(key);
            if (!plane) {
                plane = { key : key, type : entry.type, id : entry.id, source : entry.source, handle : Na__PlaneMesh__Create(), frame : null, colour : null, record : null };
                Na__PlaneOverlay__Root.add(plane.handle.group);
                Na__PlaneOverlay__Planes.set(key, plane);
            }
            plane.record = entry.record;                                         // <-- A reload of the project data replaces the record objects
            plane.source = entry.source;
            plane.colour = Na__PlaneOverlay__GetColour(entry.type, entry.id);
            Na__PlaneOverlay__UpdatePlane(plane);
        });

        if (Na__PlaneOverlay__Root) Na__InteractiveOverlays__SetWanted(Na__PlaneOverlay__Root, Na__PlaneOverlay__Planes.size > 0);
        Na__RenderLoop__RequestRender();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Plane Moved - Re-Lay It Out and Nothing Else
    // ------------------------------------------------------------
    // What a slider input and a drag step call. Falls back to a full refresh
    // when the plane is not up yet.
    // ------------------------------------------------------------
    function Na__PlaneOverlay__RefreshOne(type, id) {
        const plane = Na__PlaneOverlay__Planes.get(Na__PlaneOverlay__KeyOf(type, id));
        if (!plane) return Na__PlaneOverlay__Refresh();
        Na__PlaneOverlay__UpdatePlane(plane);
        Na__RenderLoop__RequestRender();
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Sources
// -----------------------------------------------------------------------------

    // FUNCTION | Register a Drawing Type
    // ------------------------------------------------------------
    function Na__PlaneOverlay__RegisterSource(type, source) {
        if (!type || !source || typeof source.list !== 'function') return false;
        Na__PlaneOverlay__Sources.set(type, source);
        if (Na__PlaneOverlay__Shown.size > 0) Na__PlaneOverlay__Refresh();       // <-- Planes left switched on last visit can go up now that their records can be read
        Na__PlaneOverlay__Announce('sources');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Source Registered for a Type, or Null
    // ------------------------------------------------------------
    function Na__PlaneOverlay__GetSource(type) {
        return Na__PlaneOverlay__Sources.get(type) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Types Have Registered
    // ------------------------------------------------------------
    function Na__PlaneOverlay__GetTypes() {
        return Array.from(Na__PlaneOverlay__Sources.keys());
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - The Shown Set
// -----------------------------------------------------------------------------

    // FUNCTION | Is There a Model to Size a Plane From?
    // ------------------------------------------------------------
    function Na__PlaneOverlay__HasModel() {
        return Na__PlaneBounds__Measure(Na__PlaneOverlay__ModelRoot) !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is One Plane's Eye Toggle On?
    // ------------------------------------------------------------
    function Na__PlaneOverlay__IsShown(type, id) {
        return Na__PlaneOverlay__Shown.has(Na__PlaneOverlay__KeyOf(type, id));
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch One Plane On or Off
    // ------------------------------------------------------------
    function Na__PlaneOverlay__SetShown(type, id, shown) {
        const key = Na__PlaneOverlay__KeyOf(type, id);
        if (shown === true) Na__PlaneOverlay__Shown.add(key); else Na__PlaneOverlay__Shown.delete(key);
        Na__PlaneOverlay__Refresh();
        Na__PlaneOverlay__StoreShown();
        Na__PlaneOverlay__Announce('shown');
        return shown === true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Are All of a Type's Planes On? (false when it has none)
    // ------------------------------------------------------------
    function Na__PlaneOverlay__AreAllShown(type) {
        const source = Na__PlaneOverlay__Sources.get(type);
        if (!source) return false;
        const records = source.list() || [];
        if (records.length === 0) return false;
        for (let i = 0; i < records.length; i++) {
            if (!Na__PlaneOverlay__Shown.has(Na__PlaneOverlay__KeyOf(type, source.getId(records[i])))) return false;
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch All of a Type's Planes On or Off
    // ------------------------------------------------------------
    function Na__PlaneOverlay__SetAllShown(type, shown) {
        const source = Na__PlaneOverlay__Sources.get(type);
        if (!source) return 0;
        const records = source.list() || [];
        for (let i = 0; i < records.length; i++) {
            const key = Na__PlaneOverlay__KeyOf(type, source.getId(records[i]));
            if (shown === true) Na__PlaneOverlay__Shown.add(key); else Na__PlaneOverlay__Shown.delete(key);
        }
        Na__PlaneOverlay__Refresh();
        Na__PlaneOverlay__StoreShown();
        Na__PlaneOverlay__Announce('shown');
        return records.length;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Drawing Was Deleted - Drop Every Trace of Its Plane
    // ------------------------------------------------------------
    function Na__PlaneOverlay__Forget(type, id) {
        const key = Na__PlaneOverlay__KeyOf(type, id);
        Na__PlaneOverlay__Shown.delete(key);
        if (Na__PlaneOverlay__SelectedKey === key) Na__PlaneOverlay__SelectedKey = null;
        Na__PlaneOverlay__Refresh();
        Na__PlaneOverlay__StoreShown();
        Na__PlaneOverlay__Announce('shown');
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Selection and Hover
// -----------------------------------------------------------------------------

    // FUNCTION | Select One Plane, or None
    // ------------------------------------------------------------
    // type null deselects. A selected plane is up whether or not its eye
    // toggle is on, and its face becomes a handle.
    // ------------------------------------------------------------
    function Na__PlaneOverlay__Select(type, id) {
        const next = (type && id) ? Na__PlaneOverlay__KeyOf(type, id) : null;
        if (next === Na__PlaneOverlay__SelectedKey) return false;
        Na__PlaneOverlay__SelectedKey = next;
        Na__PlaneOverlay__Refresh();
        Na__PlaneOverlay__Announce('selection');
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Deselect, but Only If the Selection Is of This Type
    // ------------------------------------------------------------
    // What a panel calls as it closes: closing Elevations must not take down a
    // floor plan plane the author selected from the other panel.
    // ------------------------------------------------------------
    function Na__PlaneOverlay__DeselectType(type) {
        if (!Na__PlaneOverlay__SelectedKey) return false;
        if (Na__PlaneOverlay__SelectedKey.indexOf(String(type) + Na__PlaneOverlay__KEY_JOIN) !== 0) return false;
        return Na__PlaneOverlay__Select(null, null);
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Plane Is Selected
    // ------------------------------------------------------------
    function Na__PlaneOverlay__GetSelected() {
        if (!Na__PlaneOverlay__SelectedKey) return null;
        const at = Na__PlaneOverlay__SelectedKey.indexOf(Na__PlaneOverlay__KEY_JOIN);
        return { type : Na__PlaneOverlay__SelectedKey.slice(0, at), id : Na__PlaneOverlay__SelectedKey.slice(at + 1) };
    }
    function Na__PlaneOverlay__IsSelected(type, id) {
        return Na__PlaneOverlay__SelectedKey === Na__PlaneOverlay__KeyOf(type, id);
    }
    // ------------------------------------------------------------


    // FUNCTION | Say What the Pointer Is Over
    // ------------------------------------------------------------
    // key and region null clears it. Returns true when anything changed, so
    // the grip only asks for a frame when there is something new to draw.
    // ------------------------------------------------------------
    function Na__PlaneOverlay__SetHover(key, region) {
        const nextKey    = key || null;
        const nextRegion = key ? (region || null) : null;
        if (nextKey === Na__PlaneOverlay__HoverKey && nextRegion === Na__PlaneOverlay__HoverRegion) return false;

        const before = Na__PlaneOverlay__HoverKey;
        Na__PlaneOverlay__HoverKey    = nextKey;
        Na__PlaneOverlay__HoverRegion = nextRegion;

        [ before, nextKey ].forEach((touched) => {
            const plane = touched ? Na__PlaneOverlay__Planes.get(touched) : null;
            if (plane) Na__PlaneOverlay__UpdatePlane(plane);
        });
        Na__RenderLoop__RequestRender();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Plane That Is Up, for Hit Testing
    // ------------------------------------------------------------
    // Each: { key, type, id, record, source, frame, regions, selected }
    // ------------------------------------------------------------
    function Na__PlaneOverlay__GetPlanes() {
        const planes = [];
        Na__PlaneOverlay__Planes.forEach((plane) => {
            if (!plane.frame) return;
            planes.push({
                key      : plane.key,
                type     : plane.type,
                id       : plane.id,
                record   : plane.record,
                source   : plane.source,
                frame    : plane.frame,
                colour   : plane.colour,
                regions  : Na__PlaneMesh__GetRegions(plane.handle),
                selected : (plane.key === Na__PlaneOverlay__SelectedKey)
            });
        });
        return planes;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Anything Up at All?
    // ------------------------------------------------------------
    function Na__PlaneOverlay__HasPlanes() {
        return Na__PlaneOverlay__Planes.size > 0;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - The Snap State
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read the Snap State, From the Browser or the Config
    // ------------------------------------------------------------
    function Na__PlaneOverlay__EnsureSnap() {
        if (Na__PlaneOverlay__Snap) return Na__PlaneOverlay__Snap;
        const setup = Na__PlaneCfg__GetSnapSetup();
        let enabled = setup.enabledByDefault, incrementMm = setup.defaultIncrementMm;

        try {
            const stored = JSON.parse(window.localStorage.getItem(Na__PlaneOverlay__SNAP_STORE_KEY) || 'null');
            if (stored && typeof stored === 'object') {
                if (typeof stored.enabled === 'boolean') enabled = stored.enabled;
                if (Number.isFinite(stored.incrementMm) && stored.incrementMm > 0) incrementMm = stored.incrementMm;
            }
        } catch (error) { /* A browser that refuses storage still snaps, to the config's defaults */ }

        Na__PlaneOverlay__Snap = { enabled : enabled, incrementMm : Na__PlaneMath__NearestInList(setup.incrementsMm, incrementMm) };
        return Na__PlaneOverlay__Snap;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Keep the Snap State and Announce It
    // ------------------------------------------------------------
    function Na__PlaneOverlay__StoreSnap() {
        try { window.localStorage.setItem(Na__PlaneOverlay__SNAP_STORE_KEY, JSON.stringify(Na__PlaneOverlay__Snap)); } catch (error) { /* Session only */ }
        Na__PlaneOverlay__Announce('snap');
    }
    // ------------------------------------------------------------


    // FUNCTION | Read, Toggle and Step the Snap
    // ------------------------------------------------------------
    function Na__PlaneOverlay__GetSnap() {
        const snap = Na__PlaneOverlay__EnsureSnap();
        return { enabled : snap.enabled, incrementMm : snap.incrementMm };
    }
    function Na__PlaneOverlay__SetSnapEnabled(enabled) {
        Na__PlaneOverlay__EnsureSnap().enabled = (enabled === true);
        Na__PlaneOverlay__StoreSnap();
        return Na__PlaneOverlay__GetSnap();
    }
    function Na__PlaneOverlay__StepSnapIncrement(direction) {
        const snap = Na__PlaneOverlay__EnsureSnap();
        snap.incrementMm = Na__PlaneMath__StepInList(Na__PlaneCfg__GetSnapSetup().incrementsMm, snap.incrementMm, direction);
        Na__PlaneOverlay__StoreSnap();
        return Na__PlaneOverlay__GetSnap();
    }
    function Na__PlaneOverlay__CanStepSnapIncrement(direction) {
        const list = Na__PlaneCfg__GetSnapSetup().incrementsMm;
        const snap = Na__PlaneOverlay__EnsureSnap();
        return Na__PlaneMath__StepInList(list, snap.incrementMm, direction) !== snap.incrementMm;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Point the Overlay at a Different Model Root
    // ------------------------------------------------------------
    function Na__PlaneOverlay__SetModelRoot(modelRoot) {
        Na__PlaneOverlay__ModelRoot = modelRoot || null;
        if (Na__PlaneOverlay__Planes.size > 0) Na__PlaneOverlay__Refresh();
    }
    // ------------------------------------------------------------


    // FUNCTION | Initialize the Overlay
    // ------------------------------------------------------------
    // context: { scene, modelRoot }
    // Nothing is added to the scene here. The root group is built the first
    // time a plane goes up, so the live app - where no Dev menu ever registers
    // a source - carries nothing at all.
    // ------------------------------------------------------------
    function Na__PlaneOverlay__Initialize(context) {
        if (!context || !context.scene) {
            console.warn('[TrueVision3D] Drawing planes overlay init skipped - missing scene.');
            return false;
        }
        Na__PlaneOverlay__Scene     = context.scene;
        Na__PlaneOverlay__ModelRoot = context.modelRoot || null;
        Na__PlaneCfg__Load();                                                    // <-- Fallbacks mirror the JSON, so nothing waits on this

        // A project switch replaces every record, and the ids belong to the
        // project that has gone. Adopting the new project empties the shown
        // set and refills it from what THAT project last had switched on.
        window.addEventListener('na-presentation-mode-scenes-loaded', Na__PlaneOverlay__AdoptProject);

        // THE DRAWINGS BLOCK ARRIVING is when a restored key first names a
        // record that can be read. A source registers at Dev menu init, before
        // the project data has landed, so its list is empty and nothing goes
        // up; without this a plane left switched on last visit would sit in
        // the shown set with the panel saying it is on and nothing in the 3D
        // view. The same event lands a save from another panel.
        window.addEventListener(Na__DrawData__CHANGED_EVENT, () => {
            if (Na__PlaneOverlay__AdoptProject()) return;                        // <-- A different project: adopting refreshed and announced already
            if (Na__PlaneOverlay__Shown.size === 0) return;
            Na__PlaneOverlay__Refresh();
            Na__PlaneOverlay__Announce('shown');
        });

        Na__PlaneOverlay__AdoptProject();                                        // <-- The project code is on the URL from the first moment
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Planes Overlay API
    // ------------------------------------------------------------
    export {
        Na__PlaneOverlay__CHANGED_EVENT,
        Na__PlaneOverlay__KIND_VERTICAL,
        Na__PlaneOverlay__KIND_HORIZONTAL,
        Na__PlaneOverlay__Initialize,
        Na__PlaneOverlay__SetModelRoot,
        Na__PlaneOverlay__RegisterSource,
        Na__PlaneOverlay__GetSource,
        Na__PlaneOverlay__GetTypes,
        Na__PlaneOverlay__KeyOf,
        Na__PlaneOverlay__GetColour,
        Na__PlaneOverlay__HasModel,
        Na__PlaneOverlay__IsShown,
        Na__PlaneOverlay__SetShown,
        Na__PlaneOverlay__AreAllShown,
        Na__PlaneOverlay__SetAllShown,
        Na__PlaneOverlay__Forget,
        Na__PlaneOverlay__Select,
        Na__PlaneOverlay__DeselectType,
        Na__PlaneOverlay__GetSelected,
        Na__PlaneOverlay__IsSelected,
        Na__PlaneOverlay__SetHover,
        Na__PlaneOverlay__GetPlanes,
        Na__PlaneOverlay__HasPlanes,
        Na__PlaneOverlay__Refresh,
        Na__PlaneOverlay__RefreshOne,
        Na__PlaneOverlay__Announce,
        Na__PlaneOverlay__GetSnap,
        Na__PlaneOverlay__SetSnapEnabled,
        Na__PlaneOverlay__StepSnapIncrement,
        Na__PlaneOverlay__CanStepSnapIncrement
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
