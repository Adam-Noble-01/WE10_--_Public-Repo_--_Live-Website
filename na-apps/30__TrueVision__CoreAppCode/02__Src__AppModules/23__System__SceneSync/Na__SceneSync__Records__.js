// =============================================================================
// TRUEVISION3D - SCENE SYNC - RECORDS
// =============================================================================
//
// FILE       : Na__SceneSync__Records__.js
// NAMESPACE  : Na__SceneSync
// MODULE     : Scene Sync - Records (a leaf: imports nothing)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn SketchUp's synced scenes into TrueVision's own plan,
//              elevation and scene records, and keep those out of every save
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - TrueVision Sync (the GLB Builder, 2.12) writes the SketchUp scenes Adam
//   switches on in its Scene Sync tab to ONE file per project:
//     30__TrueVision__AppContent/SceneSync__SketchUpSceneData/
//       TrueVision__SceneSyncData__Manifest__.json
//   Each row is one SketchUp scene: its camera (SketchUp inches and three.js
//   metres), its active section plane, the drawing it implies in TrueVision's
//   own terms (a plan's cut height; an elevation's exact bearing, plane and
//   mode) and the model layers it hides.
// - SKETCHUP OWNS THEM. Every load builds the records afresh from the file:
//   a FloorPlan or Elevation record for a 2D scene, and a presentation scene
//   for every row (linked to its drawing, as TrueVision's own drawing scenes
//   are). They carry Sync__Source 'sketchup' and are NEVER SAVED:
//   Na__SceneSync__StripDoc takes them out of any document about to be
//   written, at the three places a project document is written (the drawings
//   save, the R2 write, the local copy).
// - THE SAME ID EVERYWHERE. A row's Scene__Id (sus_ + hex, given once by the
//   GLB Builder and kept for the scene's life) is the drawing's id AND the
//   scene's id, so a Layout Editor viewport bound to a synced scene keeps its
//   binding across every sync, a rename in SketchUp, a switch off, and a
//   Detach (which turns the records into ordinary saved ones, same ids).
// - REAL WINS. A saved record with a synced id (a scene detached in
//   TrueVision) hides the synced one of that id, so a detach needs nothing
//   from SketchUp to stick.
// - DETERMINISTIC. The same row always builds byte-identical records (key
//   order, rounding), because the Layout Editor fingerprints a 3D viewport's
//   scene to decide whether its stored picture is still current.
// - LAYOUT EDITOR ONLY. Every synced scene is marked
//   PresentationMode__Scene__LayoutEditorOnly, so the viewer's carousel, its
//   opening scene and its counts never change because of a sync.
// - SKETCHUP'S NAME IS AN IDENTIFIER, NOT A TITLE. "Elevation__North__Front"
//   is what the scene is called in SketchUp and in the panels; a drawing
//   title is written from the facts, as for TrueVision's own elevations:
//   Existing or Proposed from the model, and the compass word from the
//   bearing against the project's north (EXISTING NORTH ELEVATION). So a
//   synced elevation carries NO Elevation__NameIsAuto. false says somebody
//   typed the name in Dev Tools for the sheets to use (that is what lettered
//   JW02's titles ELEVATION__NORTH__FRONT); true says the name follows the
//   compass, which SketchUp's does not. Absent promotes no name to a title,
//   and the auto namer renames nothing it is not told is automatic.
//
// CAMERA, SKETCHUP TO TRUEVISION:
// - Positions are integer millimetres, rotations radians to 4 dp (Euler XYZ),
//   field of view vertical degrees to 4 dp: TrueVision's own capture format.
// - OrbitControls keeps the camera between its minimum and maximum distance
//   of the orbit target and re-aims it at the target, so the target is put on
//   the view line within that range: the eye and the view direction are
//   exactly SketchUp's.
// - A parallel projection (TrueVision draws 3D scenes in perspective only) is
//   drawn in perspective at a narrow angle, pulled back so the height
//   SketchUp shows at its target is the height TrueVision shows there.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.2
// - FIXED: a synced elevation's drawing title read the SketchUp scene name
//   (JW02 D01: EXISTING ELEVATION__NORTH__FRONT) where it should read
//   EXISTING NORTH ELEVATION. The record said Elevation__NameIsAuto false,
//   which the Layout Editor's viewport identity reads as "a name typed in Dev
//   Tools > Elevations", and a chosen name beats the compass word. The flag
//   is now left off: titles, viewport names and frame captions follow the
//   compass, Elevation__Name stays SketchUp's for the panels, and a detached
//   copy is titled the same way until a name is typed for it in Dev Tools.
//
// 19-Oct-2026 - Version 1.0.1
// - FIXED: a project's presentation scenes stayed off at load (JW02: no
//   carousel until Update was pressed in the Dev menu). A project with synced
//   scenes and no presentation block got a placeholder block marked
//   Sync__Container and switched OFF (so the carousel ignored it). The first
//   scene authored in the Dev menu went into that placeholder, and the save
//   dropped the mark but kept Enabled false, which the carousel reads as
//   "explicitly disabled". StripDoc now writes a container that holds a real
//   scene as an ordinary, enabled block; the live module promotes it the
//   moment the scene is added, and repairs a block saved this way.
//
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (Scene Sync, TrueVision v2.174.0). Reads manifest
//   schema 1 (GLB Builder 2.12.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Marks a Synced Record Carries
    // ------------------------------------------------------------
    const Na__SceneSync__SOURCE_KEY      = 'Sync__Source';
    const Na__SceneSync__SOURCE_SKETCHUP = 'sketchup';
    const Na__SceneSync__CONTAINER_KEY   = 'Sync__Container';                    // <-- On a presentation block made only to hold synced scenes
    const Na__SceneSync__DETACHED_KEY    = 'Sync__DetachedFrom';                 // <-- On a record detached in TrueVision: saved, editable, still remembers where it came from
    const Na__SceneSync__GROUP_ID        = 'Sync__SketchUpScenes';               // <-- Not a real group: the Layout Editor lists synced scenes on their own
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Manifest (mirrors Na__TrueVision__GlbBuilder__SceneSync__.rb)
    // ------------------------------------------------------------
    const Na__SceneSync__MANIFEST_SCHEMA  = 'TrueVision__SceneSyncData__Manifest';
    const Na__SceneSync__MANIFEST_VERSION = 1;
    const Na__SceneSync__ID_RE            = /^sus_[0-9a-f]{8,32}$/;
    const Na__SceneSync__STATES           = [ 'synced', 'off', 'missing', 'detached' ];
    const Na__SceneSync__TYPES            = [ 'plan', 'elevation', 'section', 'view3d' ];
    const Na__SceneSync__CATEGORY_RE      = /^TrueVision__[A-Za-z0-9_]{1,96}$/;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Project Document Keys
    // ------------------------------------------------------------
    const Na__SceneSync__DRAWINGS_KEY      = 'LayoutEditor__DrawingsData';
    const Na__SceneSync__PLANS_KEY         = 'LayoutEditor__DrawingsData__FloorPlans';
    const Na__SceneSync__ELEVATIONS_KEY    = 'LayoutEditor__DrawingsData__Elevations';
    const Na__SceneSync__PRESENTATION_KEY  = 'PresentationMode__SavedCameraScenes';
    const Na__SceneSync__SCENES_KEY        = 'PresentationMode__SavedCameraScenes__Scenes';
    const Na__SceneSync__DEFAULT_SCENE_KEY = 'PresentationMode__SavedCameraScenes__DefaultSceneId';
    const Na__SceneSync__ENABLED_KEY       = 'PresentationMode__SavedCameraScenes__Enabled';
    const Na__SceneSync__LEGACY_KEYS       = [ 'PresentationMode__SavedCameraScenes__FloorPlans', 'PresentationMode__SavedCameraScenes__Elevations' ];
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Defaults (each overridable through the options)
    // ------------------------------------------------------------
    const Na__SceneSync__DEFAULTS = Object.freeze({
        orbitMinMm           : 200,                                              // <-- Na__AppConfig__Main.json: the orbit's own limits
        orbitMaxMm           : 45000,
        parallelFovDeg       : 20,                                               // <-- A parallel view drawn in perspective: narrow, so it reads nearly parallel
        cutOffsetMm          : 1200,                                             // <-- A plan's cut sits this far above its floor datum, as TrueVision's own plans
        noCutHeightMm        : 100000,                                           // <-- A plan with no horizontal section plane: cut above everything
        orderBase            : 1000,                                             // <-- After every authored drawing and scene
        defaultExcludeTokens : []
    });
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Scene Ids the Rest of the App Must Treat as Synthetic
    // ------------------------------------------------------------
    // Filled by the live module each time it builds the records. A leaf can be
    // imported from anywhere (the R2 client, the linework bake) without an
    // import cycle, which is why the set lives here.
    // ------------------------------------------------------------
    const Na__SceneSync__SyntheticIds = new Set();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Small Helpers
// -----------------------------------------------------------------------------

    function Na__SceneSync__Finite(value) { return typeof value === 'number' && Number.isFinite(value); }
    function Na__SceneSync__Round(value, places) { const f = Math.pow(10, places); const r = Math.round(value * f) / f; return r === 0 ? 0 : r; }   // <-- Never -0 in a record
    function Na__SceneSync__Vec3(value) { return (Array.isArray(value) && value.length === 3 && value.every(Na__SceneSync__Finite)) ? value.slice() : null; }
    function Na__SceneSync__Text(value) { return (typeof value === 'string' && value.trim() !== '') ? value.trim() : null; }
    function Na__SceneSync__Sub(a, b) { return [ a[0] - b[0], a[1] - b[1], a[2] - b[2] ]; }
    function Na__SceneSync__Add(a, b) { return [ a[0] + b[0], a[1] + b[1], a[2] + b[2] ]; }
    function Na__SceneSync__Scale(a, s) { return [ a[0] * s, a[1] * s, a[2] * s ]; }
    function Na__SceneSync__Len(a) { return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]); }
    function Na__SceneSync__Cross(a, b) { return [ a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0] ]; }
    function Na__SceneSync__Norm(a) { const l = Na__SceneSync__Len(a); return l > 0 ? Na__SceneSync__Scale(a, 1 / l) : [ 0, 0, 0 ]; }
    function Na__SceneSync__Clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
    function Na__SceneSync__WrapDeg(value) { const w = value % 360; return w < 0 ? w + 360 : w; }
    // ------------------------------------------------------------


    // FUNCTION | Is This Record Built From a SketchUp Scene (and So Never Saved)?
    // ------------------------------------------------------------
    function Na__SceneSync__IsSynced(record) {
        return Boolean(record) && typeof record === 'object' && record[Na__SceneSync__SOURCE_KEY] === Na__SceneSync__SOURCE_SKETCHUP;
    }
    // ------------------------------------------------------------


    // FUNCTION | Was This Saved Record Detached From a SketchUp Scene?
    // ------------------------------------------------------------
    function Na__SceneSync__IsDetached(record) {
        return Boolean(record) && typeof record === 'object' && record[Na__SceneSync__DETACHED_KEY] === Na__SceneSync__SOURCE_SKETCHUP;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Id One of the Synced Records Built This Session?
    // ------------------------------------------------------------
    function Na__SceneSync__IsSyntheticId(id) { return typeof id === 'string' && Na__SceneSync__SyntheticIds.has(id); }
    function Na__SceneSync__SetSyntheticIds(ids) {
        Na__SceneSync__SyntheticIds.clear();
        (ids || []).forEach((id) => { if (typeof id === 'string') Na__SceneSync__SyntheticIds.add(id); });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keeping Synced Records Out of a Saved Document
// -----------------------------------------------------------------------------

    // FUNCTION | Strip Every Synced Record From a Project Document, In Place
    // ------------------------------------------------------------
    // Give it a COPY about to be written (the R2 merge, a save payload, the
    // local file's merge): it edits arrays and keys of what it is given.
    // Removes synced plans, elevations and scenes (the legacy presentation
    // arrays too), drops a default scene id that named a synced scene, and a
    // presentation block that exists only to hold synced scenes goes
    // altogether, so a project without presentation scenes never gains the key.
    // Returns how many records it removed.
    // ------------------------------------------------------------
    function Na__SceneSync__StripDoc(doc) {
        if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return 0;
        let removed = 0;
        const keep = (list) => {
            const kept = list.filter((record) => !Na__SceneSync__IsSynced(record));
            removed += list.length - kept.length;
            return kept;
        };

        const block = doc[Na__SceneSync__DRAWINGS_KEY];
        if (block && typeof block === 'object' && !Array.isArray(block)) {
            [ Na__SceneSync__PLANS_KEY, Na__SceneSync__ELEVATIONS_KEY ].forEach((key) => {
                if (Array.isArray(block[key])) block[key] = keep(block[key]);
            });
        }

        const config = doc[Na__SceneSync__PRESENTATION_KEY];
        if (config && typeof config === 'object' && !Array.isArray(config)) {
            const scenes = config[Na__SceneSync__SCENES_KEY];
            if (Array.isArray(scenes)) {
                const gone = new Set(scenes.filter(Na__SceneSync__IsSynced).map((scene) => scene.PresentationMode__Scene__Id));
                config[Na__SceneSync__SCENES_KEY] = keep(scenes);
                if (gone.has(config[Na__SceneSync__DEFAULT_SCENE_KEY])) delete config[Na__SceneSync__DEFAULT_SCENE_KEY];
            }
            Na__SceneSync__LEGACY_KEYS.forEach((key) => { if (Array.isArray(config[key])) config[key] = keep(config[key]); });
            if (config[Na__SceneSync__CONTAINER_KEY] === true) {
                const real = Array.isArray(config[Na__SceneSync__SCENES_KEY]) ? config[Na__SceneSync__SCENES_KEY].length : 0;
                if (real === 0) delete doc[Na__SceneSync__PRESENTATION_KEY];     // <-- Made only to hold synced scenes: never written
                else {                                                           // <-- It holds real scenes now: an ordinary block from here, and an ENABLED one
                    delete config[Na__SceneSync__CONTAINER_KEY];
                    config[Na__SceneSync__ENABLED_KEY] = true;                   // <-- The container's false was only ever a placeholder; the carousel reads false as "switched off"
                }
            }
        }
        return removed;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Same Document Without Its Synced Records (the given one is not touched)
    // ------------------------------------------------------------
    // For the two places every project document passes on its way out (the
    // R2 write and the local copy's merge), whoever handed it over: only the
    // containers that change are copied, shallowly, so this costs nothing
    // like a deep clone and never edits what the app is holding.
    // ------------------------------------------------------------
    function Na__SceneSync__StrippedCopy(doc) {
        if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return doc;
        const copy = Object.assign({}, doc);
        [ Na__SceneSync__DRAWINGS_KEY, Na__SceneSync__PRESENTATION_KEY ].forEach((key) => {
            const value = copy[key];
            if (value && typeof value === 'object' && !Array.isArray(value)) copy[key] = Object.assign({}, value);
        });
        Na__SceneSync__StripDoc(copy);
        return copy;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Presentation Block Made Only to Hold Synced Scenes
    // ------------------------------------------------------------
    // For a project with no presentation scenes at all. It is never saved as
    // it stands (see StripDoc), and it is not enabled, so the viewer's
    // carousel reads it exactly as it read no block at all.
    // ------------------------------------------------------------
    function Na__SceneSync__ContainerConfig() {
        return {
            [Na__SceneSync__CONTAINER_KEY]                      : true,
            [Na__SceneSync__ENABLED_KEY]                        : false,
            [Na__SceneSync__SCENES_KEY]                         : []
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Manifest
// -----------------------------------------------------------------------------

    // FUNCTION | Read a Manifest Into Checked Rows (null when it is not one)
    // ------------------------------------------------------------
    // A row needs an id of the GLB Builder's shape, a name and a camera with
    // a finite position and target; anything else in it is optional and is
    // read defensively. The first row of an id wins.
    // ------------------------------------------------------------
    function Na__SceneSync__ReadManifest(json) {
        if (!json || typeof json !== 'object' || json.SceneSyncData__Schema !== Na__SceneSync__MANIFEST_SCHEMA) return null;
        const version = json.SceneSyncData__SchemaVersion;
        if (!Na__SceneSync__Finite(version) || version > Na__SceneSync__MANIFEST_VERSION) return null;   // <-- A newer exporter: not read rather than misread
        const seen = new Set();
        const rows = [];
        (Array.isArray(json.SceneSyncData__Scenes) ? json.SceneSyncData__Scenes : []).forEach((row) => {
            if (!row || typeof row !== 'object') return;
            const id = row.Scene__Id;
            if (typeof id !== 'string' || !Na__SceneSync__ID_RE.test(id) || seen.has(id)) return;
            if (!Na__SceneSync__Text(row.Scene__Name)) return;
            const three = row.Camera && row.Camera.ThreeJs;
            if (!three || !Na__SceneSync__Vec3(three.Position) || !Na__SceneSync__Vec3(three.Target)) return;
            seen.add(id);
            rows.push(row);
        });
        return {
            exportedIso     : Na__SceneSync__Text(json.SceneSyncData__ExportedIso),
            exporterVersion : Na__SceneSync__Text(json.SceneSyncData__ExporterVersion),
            rows            : rows
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Camera
// -----------------------------------------------------------------------------

    // FUNCTION | Euler XYZ (radians) of a Camera at eye Looking at target, Y Up
    // ------------------------------------------------------------
    // three.js's own Matrix4.lookAt for a camera (z = eye - target, the same
    // nudge when the view is straight down an up axis) and its Euler
    // setFromRotationMatrix in XYZ order, written out so this leaf needs no
    // three.js and gives exactly what the app's camera would.
    // ------------------------------------------------------------
    function Na__SceneSync__LookAtEuler(eye, target) {
        const up = [ 0, 1, 0 ];
        let z = Na__SceneSync__Sub(eye, target);
        if (Na__SceneSync__Len(z) === 0) z = [ 0, 0, 1 ];
        z = Na__SceneSync__Norm(z);
        let x = Na__SceneSync__Cross(up, z);
        if (Na__SceneSync__Len(x) === 0) {
            z = Na__SceneSync__Norm([ z[0], z[1], z[2] + 0.0001 ]);
            x = Na__SceneSync__Cross(up, z);
        }
        x = Na__SceneSync__Norm(x);
        const y = Na__SceneSync__Cross(z, x);
        const m11 = x[0], m12 = y[0], m13 = z[0];
        const m22 = y[1], m23 = z[1];
        const m32 = y[2], m33 = z[2];
        const ry = Math.asin(Na__SceneSync__Clamp(m13, -1, 1));
        if (Math.abs(m13) < 0.9999999) return [ Math.atan2(-m23, m33), ry, Math.atan2(-m12, m11) ];
        return [ Math.atan2(m32, m22), ry, 0 ];
    }
    // ------------------------------------------------------------


    // FUNCTION | A Row's Camera as TrueVision Scene Blocks
    // ------------------------------------------------------------
    // Returns { position, orbit, fovDeg, parallel } in TrueVision's own
    // scene format (see the header).
    // ------------------------------------------------------------
    function Na__SceneSync__CameraFor(row, options) {
        const three  = row.Camera.ThreeJs;
        const eyeM   = Na__SceneSync__Vec3(three.Position);
        const tgtM   = Na__SceneSync__Vec3(three.Target);
        let eye      = Na__SceneSync__Scale(eyeM, 1000);
        const target = Na__SceneSync__Scale(tgtM, 1000);
        let dir      = Na__SceneSync__Sub(target, eye);
        let distance = Na__SceneSync__Len(dir);
        if (distance < 1e-6) {                                                   // <-- Eye on its target: look along the camera's own direction
            dir = Na__SceneSync__Norm(Na__SceneSync__Vec3(three.Direction) || [ 0, 0, -1 ]);
            distance = 1000;
        } else {
            dir = Na__SceneSync__Scale(dir, 1 / distance);
        }
        const lo = options.orbitMinMm + 1;
        const hi = Math.max(lo, options.orbitMaxMm - 1);
        const perspective = row.Camera.Projection === 'perspective' && Na__SceneSync__Finite(three.FovVerticalDeg) && three.FovVerticalDeg > 0;
        let fov, pivot;

        if (perspective) {
            fov   = three.FovVerticalDeg;
            pivot = Na__SceneSync__Clamp(distance, lo, hi);                      // <-- The eye stays put: the orbit target moves along the view line
        } else {
            const heightMm = (Na__SceneSync__Finite(three.OrthoHeightM) && three.OrthoHeightM > 0) ? three.OrthoHeightM * 1000 : 10000;
            fov   = options.parallelFovDeg;
            pivot = (heightMm / 2) / Math.tan(fov * Math.PI / 360);
            if (pivot > hi || pivot < lo) {                                      // <-- Out of the orbit's reach: keep the framing by widening (or narrowing) the angle instead
                pivot = Na__SceneSync__Clamp(pivot, lo, hi);
                fov   = Na__SceneSync__Clamp(2 * Math.atan((heightMm / 2) / pivot) * 180 / Math.PI, 1, 120);
            }
            eye = Na__SceneSync__Sub(target, Na__SceneSync__Scale(dir, pivot));  // <-- Pulled back from SketchUp's target, along its view line
        }

        const eyeMm   = eye.map((v) => Na__SceneSync__Round(v, 0));
        const pivotMm = Na__SceneSync__Add(eye, Na__SceneSync__Scale(dir, pivot)).map((v) => Na__SceneSync__Round(v, 0));
        const euler   = Na__SceneSync__LookAtEuler(eyeMm, pivotMm);
        return {
            position : {
                Camera__DefaultPos      : {
                    Camera__DefaultPos__PosX : eyeMm[0],
                    Camera__DefaultPos__PosY : eyeMm[1],
                    Camera__DefaultPos__PosZ : eyeMm[2]
                },
                Camera__DefaultRotation : {
                    Camera__DefaultRotation__RotX : Na__SceneSync__Round(euler[0], 4),
                    Camera__DefaultRotation__RotY : Na__SceneSync__Round(euler[1], 4),
                    Camera__DefaultRotation__RotZ : Na__SceneSync__Round(euler[2], 4)
                },
                Camera__DefaultMisc     : {
                    Camera__DefaultMisc__Fov : Na__SceneSync__Round(fov, 4)
                }
            },
            orbit    : {
                OrbitHelperCube__Position__Description : 'Scene orbit target position. Values are integer millimetres; convert to 3D units in code.',
                OrbitHelperCube__Position__PosX        : pivotMm[0],
                OrbitHelperCube__Position__PosY        : pivotMm[1],
                OrbitHelperCube__Position__PosZ        : pivotMm[2]
            },
            fovDeg   : fov,
            parallel : !perspective
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building the Records
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Model Layer Keys a Row Hides (whole category keys only)
    // ------------------------------------------------------------
    function Na__SceneSync__HiddenKeys(row) {
        const hidden = row.ModelLayers && Array.isArray(row.ModelLayers.Hidden) ? row.ModelLayers.Hidden : [];
        return hidden.filter((key) => typeof key === 'string' && Na__SceneSync__CATEGORY_RE.test(key)).sort();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Drawing's Exclusion Tokens: the Default List Plus Each Hidden Layer, Exactly
    // ------------------------------------------------------------
    // null (the default list) when the scene hides nothing. A hidden layer is
    // an '=' token, an EXACT match: "...Existing" is a substring of
    // "...ExistingWalls" and eight more (the Layout Editor's own model layers
    // learned this first).
    // ------------------------------------------------------------
    function Na__SceneSync__ExcludeTokens(hidden, options) {
        if (!hidden.length) return null;
        return (Array.isArray(options.defaultExcludeTokens) ? options.defaultExcludeTokens.slice() : []).concat(hidden.map((key) => '=' + key));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Frame From the Drawing Block ({ X, Y } and { Width, Height } in mm), or null
    // ------------------------------------------------------------
    function Na__SceneSync__Frame(drawing) {
        const c = drawing && drawing.FrameCentreMm;
        const s = drawing && drawing.FrameSizeMm;
        return {
            centre : (c && Na__SceneSync__Finite(c.X) && Na__SceneSync__Finite(c.Y)) ? { X : c.X, Y : c.Y } : null,
            size   : (s && Na__SceneSync__Finite(s.Height) && s.Height > 0) ? { Width : Na__SceneSync__Finite(s.Width) ? s.Width : null, Height : s.Height } : null
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build Every Record a Manifest Describes
    // ------------------------------------------------------------
    // manifest: from Na__SceneSync__ReadManifest. options: see DEFAULTS.
    // Returns { plans, elevations, scenes, entries }: the records to put in
    // the live arrays, and one plain entry per row for the panels to list.
    // ------------------------------------------------------------
    function Na__SceneSync__Build(manifest, optionsIn) {
        const options = Object.assign({}, Na__SceneSync__DEFAULTS);
        Object.keys(optionsIn || {}).forEach((key) => {                         // <-- A missing or non-finite option keeps its default (an orbit with no maximum, say)
            const value = optionsIn[key];
            if (value === undefined || value === null) return;
            if (typeof Na__SceneSync__DEFAULTS[key] === 'number' && !(Na__SceneSync__Finite(value) && value > 0)) return;
            options[key] = value;
        });
        const out = { plans : [], elevations : [], scenes : [], entries : [] };
        if (!manifest || !Array.isArray(manifest.rows)) return out;

        manifest.rows.forEach((row, index) => {
            const id      = row.Scene__Id;
            const name    = Na__SceneSync__Text(row.Scene__Name);
            const state   = Na__SceneSync__STATES.includes(row.Scene__State) ? row.Scene__State : 'synced';
            const type    = Na__SceneSync__TYPES.includes(row.Scene__Type) ? row.Scene__Type : 'view3d';
            const drawing = (row.Drawing && typeof row.Drawing === 'object') ? row.Drawing : null;
            const order   = options.orderBase + index + 1;
            const hidden  = Na__SceneSync__HiddenKeys(row);
            const frame   = Na__SceneSync__Frame(drawing);
            const camera  = Na__SceneSync__CameraFor(row, options);
            const warnings = (Array.isArray(row.Scene__Warnings) ? row.Scene__Warnings : []).filter((text) => typeof text === 'string' && text.trim() !== '');
            const marks   = {
                [Na__SceneSync__SOURCE_KEY] : Na__SceneSync__SOURCE_SKETCHUP,
                Sync__SceneId               : id,
                Sync__State                 : state,
                Sync__Revision              : Na__SceneSync__Text(row.Scene__Revision),
                Sync__Type                  : type,
                Sync__PointCloudSceneId     : Na__SceneSync__Text(row.Scene__PointCloudSceneId)   // <-- The point cloud scene of the same SketchUp scene: it lays on this drawing exactly
            };
            let kind = 'view3d';

            if (drawing && drawing.Kind === 'plan') {
                kind = 'plan';
                // No horizontal section plane in SketchUp: the whole model seen from
                // above, so the cut goes above everything (and above SketchUp's eye).
                const eyeYMm = row.Camera.ThreeJs.Position[1] * 1000;
                const cutMm  = Na__SceneSync__Finite(drawing.CutHeightMm) ? drawing.CutHeightMm : Math.max(options.noCutHeightMm, eyeYMm);
                out.plans.push(Object.assign({
                    FloorPlan__Id                    : id,
                    FloorPlan__Name                  : name,
                    FloorPlan__Order                 : order,
                    FloorPlan__Enabled               : true,
                    FloorPlan__FloorDatumMm          : Na__SceneSync__Round(cutMm - options.cutOffsetMm, 3),
                    FloorPlan__CutOffsetMm           : options.cutOffsetMm,
                    FloorPlan__ViewDepthMm           : null,
                    FloorPlan__SceneId               : id,
                    FloorPlan__Annotations           : [],
                    FloorPlan__Dimensions            : [],
                    FloorPlan__ExcludeCategoryTokens : Na__SceneSync__ExcludeTokens(hidden, options)
                }, marks, {
                    Sync__CutFromSectionPlane : Na__SceneSync__Finite(drawing.CutHeightMm),
                    Sync__FrameCentreMm       : frame.centre,
                    Sync__FrameSizeMm         : frame.size
                }));
            } else if (drawing && drawing.Kind === 'elevation' && Na__SceneSync__Finite(drawing.AzimuthDeg)) {
                kind = 'elevation';
                const origin = drawing.PlaneOriginMm || {};
                out.elevations.push(Object.assign({
                    Elevation__Id                    : id,
                    Elevation__Name                  : name,                     // <-- SketchUp's, for the panels. No Elevation__NameIsAuto: a scene name is never a title (see the header)
                    Elevation__Order                 : order,
                    Elevation__Enabled               : true,
                    Elevation__AzimuthDeg            : Na__SceneSync__Round(Na__SceneSync__WrapDeg(drawing.AzimuthDeg), 6),
                    Elevation__Mode                  : drawing.Mode === 'section' ? 'section' : 'elevation',
                    Elevation__PlaneOriginMm         : {
                        PosX : Na__SceneSync__Finite(origin.PosX) ? Na__SceneSync__Round(origin.PosX, 3) : 0,
                        PosZ : Na__SceneSync__Finite(origin.PosZ) ? Na__SceneSync__Round(origin.PosZ, 3) : 0
                    },
                    Elevation__ViewDepthMm           : null,
                    Elevation__SceneId               : id,
                    Elevation__Annotations           : [],
                    Elevation__Dimensions            : [],
                    Elevation__ExcludeCategoryTokens : Na__SceneSync__ExcludeTokens(hidden, options)
                }, marks, {
                    Sync__FrameCentreMm : frame.centre,
                    Sync__FrameSizeMm   : frame.size
                }));
            }

            const scene = {
                PresentationMode__Scene__Id                      : id,
                PresentationMode__Scene__Name                    : name,
                PresentationMode__Scene__Order                   : order,
                PresentationMode__Scene__GroupId                 : Na__SceneSync__GROUP_ID,
                PresentationMode__Scene__LayoutEditorOnly        : true,
                PresentationMode__Scene__CameraPosition          : camera.position,
                PresentationMode__Scene__OrbitHelperCubePosition : camera.orbit
            };
            if (kind === 'plan')      scene.PresentationMode__Scene__FloorPlanId = id;
            if (kind === 'elevation') scene.PresentationMode__Scene__ElevationId = id;
            if (hidden.length) {
                const categories = {};
                hidden.forEach((key) => { categories[key] = false; });
                scene.PresentationMode__Scene__Visibility = { PresentationMode__Scene__Visibility__Categories : categories };
            }
            out.scenes.push(Object.assign(scene, marks, { Sync__Projection : camera.parallel ? 'parallel' : 'perspective' }));

            const notes = warnings.slice();
            if (kind === 'view3d' && camera.parallel) notes.push('TrueVision draws 3D views in perspective, so this parallel view is drawn in perspective with the same framing.');
            if (Na__SceneSync__Text(row.Scene__Problem)) notes.push(row.Scene__Problem.trim());
            out.entries.push({
                id                : id,
                name              : name,
                state             : state,
                type              : type,
                typeLabel         : Na__SceneSync__Text(row.Scene__TypeLabel) || type,
                kind              : kind,
                revision          : marks.Sync__Revision,
                syncedIso         : Na__SceneSync__Text(row.Scene__SyncedIso),
                detachedIso       : Na__SceneSync__Text(row.Scene__DetachedIso),
                sourceModel       : Na__SceneSync__Text(row.Scene__SourceModel),
                pointCloudSceneId : Na__SceneSync__Text(row.Scene__PointCloudSceneId),
                frameCentreMm     : frame.centre,
                frameSizeMm       : frame.size,
                hidden            : hidden,
                warnings          : notes
            });
        });
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Synced Records Into a Live Array, In Place (real records win)
    // ------------------------------------------------------------
    // Removes every synced record already there, then appends each synced
    // record whose id no saved record has. The array object itself is kept:
    // other modules hold references to the live arrays.
    // ------------------------------------------------------------
    function Na__SceneSync__ApplyToList(list, synced, idKey) {
        if (!Array.isArray(list)) return 0;
        for (let i = list.length - 1; i >= 0; i--) {
            if (Na__SceneSync__IsSynced(list[i])) list.splice(i, 1);
        }
        const realIds = new Set(list.map((record) => record && record[idKey]));
        let added = 0;
        (synced || []).forEach((record) => {
            if (record && !realIds.has(record[idKey])) { list.push(record); added++; }
        });
        return added;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Saved Copy of a Synced Record (Detach in TrueVision)
    // ------------------------------------------------------------
    // The same id and everything SketchUp gave it, without the marks that keep
    // it out of a save, and with where it came from. The plain fields a synced
    // record carries for the panels (Sync__FrameCentreMm and the like) go too.
    // ------------------------------------------------------------
    function Na__SceneSync__DetachedCopy(record, whenIso) {
        const copy = JSON.parse(JSON.stringify(record));
        [ Na__SceneSync__SOURCE_KEY, 'Sync__State', 'Sync__FrameCentreMm', 'Sync__FrameSizeMm', 'Sync__CutFromSectionPlane', 'Sync__Projection' ].forEach((key) => { delete copy[key]; });
        copy[Na__SceneSync__DETACHED_KEY] = Na__SceneSync__SOURCE_SKETCHUP;
        copy.Sync__DetachedIso = whenIso;
        return copy;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scene Sync Records API
    // ------------------------------------------------------------
    export {
        Na__SceneSync__SOURCE_KEY,
        Na__SceneSync__SOURCE_SKETCHUP,
        Na__SceneSync__CONTAINER_KEY,
        Na__SceneSync__DETACHED_KEY,
        Na__SceneSync__GROUP_ID,
        Na__SceneSync__MANIFEST_SCHEMA,
        Na__SceneSync__ID_RE,
        Na__SceneSync__DEFAULTS,
        Na__SceneSync__IsSynced,
        Na__SceneSync__IsDetached,
        Na__SceneSync__IsSyntheticId,
        Na__SceneSync__SetSyntheticIds,
        Na__SceneSync__StripDoc,
        Na__SceneSync__StrippedCopy,
        Na__SceneSync__ContainerConfig,
        Na__SceneSync__ReadManifest,
        Na__SceneSync__LookAtEuler,
        Na__SceneSync__CameraFor,
        Na__SceneSync__Build,
        Na__SceneSync__ApplyToList,
        Na__SceneSync__DetachedCopy
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
