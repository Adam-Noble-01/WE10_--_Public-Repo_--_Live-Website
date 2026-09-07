// =============================================================================
// TRUEVISION3D - ELEVATION VIEWS - PROJECT DATA
// =============================================================================
//
// FILE       : Na__Elevation__ProjectJson__Data__.js
// NAMESPACE  : Na__ElevData
// MODULE     : Elevation Views - Project Data
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read, validate, normalise and mutate the per-project elevations
// CREATED    : 07-Sep-2026
//
// DESCRIPTION:
// - Elevations are stored NESTED INSIDE the existing
//   PresentationMode__SavedCameraScenes block, under ...__Elevations, with a
//   per-scene ...__Scene__ElevationId pointing back at them. This is the same
//   placement the floor plans use and for the same reason: the block is
//   already on all three dev-owned key lists that guard the R2 sync path -
//   Na__DevSavedKeys in Na__AppFlow__LoadingSequence.js,
//   DEV_OWNED_PROJECT_DATA_KEYS in CloudflareR2__ModelSync__Main__.py, and
//   TRUEVISION_DEV_OWNED_KEYS in ProjectVision__BuildScript__.py. A new
//   top-level key would need all three edited in lockstep, and missing one
//   would let a ProjectVision build silently wipe every elevation.
//
// - AN ELEVATION IS TWO NUMBERS AND A MODE, NOT A PICKED FACE.
//     AZIMUTH  - the compass bearing of the side the viewer stands on, so 0
//                draws the north elevation seen from the north. World north
//                is -Z, matching the plan camera's up vector, so a plan and an
//                elevation of the same building agree on which wall is which.
//     ORIGIN   - a world X/Z point the vertical drawing plane passes through.
//                This is what the Dev menu's two sliders move.
//     MODE     - elevation (nothing is cut) or section (everything between the
//                viewer and the plane is removed).
//   Everything else - the clip plane, the camera pose, the framing - is
//   derived from those here, so there is exactly one place the geometry of an
//   elevation is defined.
//
// - THE DRAWING'S OWN AXES ARE ANCHORED AT THE WORLD ORIGIN, NOT AT THE PLANE.
//   The horizontal run of a point is its distance along the elevation's right
//   axis measured from the world origin - never from the movable plane origin.
//   Anchoring to the plane would look tidier but would silently drag every
//   stored annotation and dimension sideways the moment the plane was nudged
//   along X or Z, which is the one edit an author makes constantly. This
//   mirrors the same decision made for the dimension snap grid.
//
// - Annotations and dimensions ride along inside each elevation record, so
//   every elevation carries its own independent markup. This module stores
//   them opaquely; the markup systems own their shape.
// - Pure data layer - no DOM, no Three.js, no camera operations.
//
// INTEGRATION:
// - Na__Elevation__DevMenu__Editor__ mutates through here, then hands the
//   whole PresentationMode block to Na__CfApi__MergeAndSaveKeys.
// - Na__Elevation__ModeController__ reads through here to drive the cut, the
//   camera and the drawing plane mapping.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Sep-2026 - Version 1.0.0
// - Initial implementation for the Elevation Drawings build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Elevation Config Defaults
    // ------------------------------------------------------------
    // @delegate: ./Na__Elevation__ConfigState__.js
    // ------------------------------------------------------------
    import {
        Na__ElevCfg__GetDirectionSetup,
        Na__ElevCfg__GetPlaneOriginRangeMm,
        Na__ElevCfg__GetDefaultViewDepthMm,
        Na__ElevCfg__FormatLabel
    } from './Na__Elevation__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | JSON Key Names
    // ------------------------------------------------------------
    // ELEVATIONS_KEY is nested inside PresentationMode__SavedCameraScenes,
    // never at the top level of the project document. See the header note.
    // ------------------------------------------------------------
    const Na__ElevData__ELEVATIONS_KEY   = 'PresentationMode__SavedCameraScenes__Elevations';
    const Na__ElevData__SCENE_ELEV_ID    = 'PresentationMode__Scene__ElevationId';
    const Na__ElevData__SCENE_ID_KEY     = 'PresentationMode__Scene__Id';
    const Na__ElevData__SCENES_KEY       = 'PresentationMode__SavedCameraScenes__Scenes';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Elevation Record Field Names
    // ------------------------------------------------------------
    const Na__ElevData__F_ID          = 'Elevation__Id';
    const Na__ElevData__F_NAME        = 'Elevation__Name';
    const Na__ElevData__F_ORDER       = 'Elevation__Order';
    const Na__ElevData__F_ENABLED     = 'Elevation__Enabled';
    const Na__ElevData__F_AZIMUTH     = 'Elevation__AzimuthDeg';
    const Na__ElevData__F_MODE        = 'Elevation__Mode';
    const Na__ElevData__F_ORIGIN      = 'Elevation__PlaneOriginMm';
    const Na__ElevData__F_VIEW_DEPTH  = 'Elevation__ViewDepthMm';
    const Na__ElevData__F_SCENE_ID    = 'Elevation__SceneId';
    const Na__ElevData__F_ZOOM        = 'Elevation__CameraZoom';
    const Na__ElevData__F_TARGET      = 'Elevation__CameraTargetMm';
    const Na__ElevData__F_ANNOTATIONS = 'Elevation__Annotations';
    const Na__ElevData__F_DIMENSIONS  = 'Elevation__Dimensions';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Drawing Modes
    // ------------------------------------------------------------
    const Na__ElevData__MODE_ELEVATION = 'elevation';   // <-- Nothing is cut
    const Na__ElevData__MODE_SECTION   = 'section';     // <-- The plane bites
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Id Formatting
    // ------------------------------------------------------------
    const Na__ElevData__ID_PREFIX  = 'Elevation_';
    const Na__ElevData__ID_PADDING = 3;                                          // <-- Elevation_001
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Validation and Normalisation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This a Structurally Valid Elevation Record?
    // ------------------------------------------------------------
    function Na__ElevData__IsValid(elevation) {
        if (!elevation || typeof elevation !== 'object') return false;

        const id   = elevation[Na__ElevData__F_ID];
        const name = elevation[Na__ElevData__F_NAME];
        if (!id || typeof id !== 'string')     return false;                     // <-- Id must exist
        if (!name || typeof name !== 'string') return false;                     // <-- Name must exist

        return Number.isFinite(elevation[Na__ElevData__F_AZIMUTH]);              // <-- A direction is the one thing that cannot be guessed
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wrap an Azimuth Into 0-360
    // ------------------------------------------------------------
    // Applied on read as well as on write, so a hand-edited -90 behaves as 270
    // rather than producing a mirrored drawing.
    // ------------------------------------------------------------
    function Na__ElevData__WrapAzimuth(degrees) {
        if (!Number.isFinite(degrees)) return 0;
        const wrapped = degrees % 360;
        return wrapped < 0 ? wrapped + 360 : wrapped;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fill In Any Missing Optional Fields From Config
    // ------------------------------------------------------------
    // Applied on read so a hand-edited or partially written elevation still
    // drives a correct camera rather than producing NaN geometry.
    // ------------------------------------------------------------
    function Na__ElevData__Normalise(elevation, index) {
        const originRange = Na__ElevCfg__GetPlaneOriginRangeMm();

        elevation[Na__ElevData__F_AZIMUTH] = Na__ElevData__WrapAzimuth(elevation[Na__ElevData__F_AZIMUTH]);

        if (elevation[Na__ElevData__F_MODE] !== Na__ElevData__MODE_SECTION) {
            elevation[Na__ElevData__F_MODE] = Na__ElevData__MODE_ELEVATION;      // <-- Anything unrecognised is a plain elevation
        }
        if (!Number.isFinite(elevation[Na__ElevData__F_ORDER])) {
            elevation[Na__ElevData__F_ORDER] = index + 1;
        }
        if (typeof elevation[Na__ElevData__F_ENABLED] !== 'boolean') {
            elevation[Na__ElevData__F_ENABLED] = true;
        }
        if (!Array.isArray(elevation[Na__ElevData__F_ANNOTATIONS])) {
            elevation[Na__ElevData__F_ANNOTATIONS] = [];
        }
        if (!Array.isArray(elevation[Na__ElevData__F_DIMENSIONS])) {
            elevation[Na__ElevData__F_DIMENSIONS] = [];
        }

        const origin = elevation[Na__ElevData__F_ORIGIN];
        if (!origin || !Number.isFinite(origin.PosX) || !Number.isFinite(origin.PosZ)) {
            elevation[Na__ElevData__F_ORIGIN] = {
                PosX : originRange.defaultXMm,
                PosZ : originRange.defaultZMm
            };
        }

        // View depth is deliberately allowed to stay null - that is the
        // ordinary infinite cut away from the viewer, not a missing value.
        if (elevation[Na__ElevData__F_VIEW_DEPTH] !== null
            && !Number.isFinite(elevation[Na__ElevData__F_VIEW_DEPTH])) {
            elevation[Na__ElevData__F_VIEW_DEPTH] = null;
        }
        return elevation;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Reading Elevations
// -----------------------------------------------------------------------------

    // FUNCTION | Get Every Valid Elevation, Sorted by Order
    // ------------------------------------------------------------
    // sceneConfig is the PresentationMode__SavedCameraScenes block. Returns a
    // new array of the LIVE records, so mutating a returned elevation edits
    // the config the save path will write.
    // ------------------------------------------------------------
    function Na__ElevData__GetElevations(sceneConfig) {
        if (!sceneConfig || typeof sceneConfig !== 'object') return [];

        const raw = sceneConfig[Na__ElevData__ELEVATIONS_KEY];
        if (!Array.isArray(raw)) return [];                                      // <-- A project with no elevations reads as an empty set

        return raw
            .filter(Na__ElevData__IsValid)
            .map(Na__ElevData__Normalise)
            .sort((a, b) => a[Na__ElevData__F_ORDER] - b[Na__ElevData__F_ORDER]);
    }
    // ------------------------------------------------------------


    // FUNCTION | Get Only the Enabled Elevations
    // ------------------------------------------------------------
    function Na__ElevData__GetEnabledElevations(sceneConfig) {
        return Na__ElevData__GetElevations(sceneConfig)
            .filter((elevation) => elevation[Na__ElevData__F_ENABLED] !== false);
    }
    // ------------------------------------------------------------


    // FUNCTION | Get One Elevation by Id
    // ------------------------------------------------------------
    function Na__ElevData__GetElevationById(sceneConfig, elevationId) {
        if (!elevationId) return null;
        const list = Na__ElevData__GetElevations(sceneConfig);
        for (let i = 0; i < list.length; i++) {
            if (list[i][Na__ElevData__F_ID] === elevationId) return list[i];
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Elevation a Scene Drives, If Any
    // ------------------------------------------------------------
    // The hook the carousel path uses: an ordinary 3D scene returns null and
    // behaves exactly as it always has.
    // ------------------------------------------------------------
    function Na__ElevData__GetElevationForScene(sceneConfig, scene) {
        if (!scene || typeof scene !== 'object') return null;
        const elevationId = scene[Na__ElevData__SCENE_ELEV_ID];
        if (!elevationId) return null;
        return Na__ElevData__GetElevationById(sceneConfig, elevationId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Scene an Elevation Scene?
    // ------------------------------------------------------------
    function Na__ElevData__IsElevationScene(scene) {
        return Boolean(scene && typeof scene === 'object' && scene[Na__ElevData__SCENE_ELEV_ID]);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Derived Geometry
// -----------------------------------------------------------------------------

    // FUNCTION | Get the Elevation's Two Horizontal Axes
    // ------------------------------------------------------------
    // THE SINGLE PLACE AN AZIMUTH BECOMES VECTORS. Everything downstream - the
    // clip plane, the camera pose, the drawing plane mapping, the gizmo - reads
    // this, so the direction convention can never drift between them.
    //
    //   normal  points FROM the building TOWARD the viewer
    //   right   is the direction that reads left-to-right on the finished sheet
    //
    // World north is -Z, so azimuth 0 puts the viewer to the north looking
    // south. The right axis is the camera's own screen-right for an upright
    // camera at that heading, which is why it is derived here rather than
    // guessed at each use.
    // ------------------------------------------------------------
    function Na__ElevData__GetAxes(elevation) {
        const azimuthRad = Na__ElevData__WrapAzimuth(
            elevation ? elevation[Na__ElevData__F_AZIMUTH] : 0
        ) * (Math.PI / 180);

        const normalX = Math.sin(azimuthRad);
        const normalZ = -Math.cos(azimuthRad);

        return {
            normalX : normalX,
            normalZ : normalZ,
            rightX  : normalZ,                                                   // <-- cross(worldUp, normal), reduced for a horizontal normal
            rightZ  : -normalX
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Drawing Plane Origin in Millimetres
    // ------------------------------------------------------------
    function Na__ElevData__GetPlaneOriginMm(elevation) {
        const range  = Na__ElevCfg__GetPlaneOriginRangeMm();
        const origin = elevation ? elevation[Na__ElevData__F_ORIGIN] : null;

        return {
            xMm : (origin && Number.isFinite(origin.PosX)) ? origin.PosX : range.defaultXMm,
            zMm : (origin && Number.isFinite(origin.PosZ)) ? origin.PosZ : range.defaultZMm
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Move the Drawing Plane to a New World X/Z Point
    // ------------------------------------------------------------
    function Na__ElevData__SetPlaneOriginMm(elevation, xMm, zMm) {
        if (!elevation) return false;

        const current = Na__ElevData__GetPlaneOriginMm(elevation);
        elevation[Na__ElevData__F_ORIGIN] = {
            PosX : Math.round(Number.isFinite(xMm) ? xMm : current.xMm),
            PosZ : Math.round(Number.isFinite(zMm) ? zMm : current.zMm)
        };
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | How Far Along the View Axis the Plane Sits
    // ------------------------------------------------------------
    // The one number the section cut engine needs, and the one the two origin
    // sliders actually control between them: a move perpendicular to the view
    // changes nothing here, which is exactly right - sliding the plane
    // sideways does not change where it cuts.
    // ------------------------------------------------------------
    function Na__ElevData__GetPlaneDistanceMm(elevation) {
        const axes   = Na__ElevData__GetAxes(elevation);
        const origin = Na__ElevData__GetPlaneOriginMm(elevation);
        return (origin.xMm * axes.normalX) + (origin.zMm * axes.normalZ);
    }
    // ------------------------------------------------------------


    // FUNCTION | Convert a World X/Z Point to Its Horizontal Run on the Sheet
    // ------------------------------------------------------------
    // Measured from the WORLD ORIGIN along the right axis - see the header on
    // why not from the plane. This is drawing axis 1.
    // ------------------------------------------------------------
    function Na__ElevData__WorldToRunMm(elevation, worldXMm, worldZMm) {
        const axes = Na__ElevData__GetAxes(elevation);
        return (worldXMm * axes.rightX) + (worldZMm * axes.rightZ);
    }
    // ------------------------------------------------------------


    // FUNCTION | Convert a Horizontal Run Back to a World X/Z Point on the Plane
    // ------------------------------------------------------------
    // The inverse of WorldToRunMm, landing the point on the drawing plane:
    // run along the right axis plus the plane's own distance along the normal.
    // ------------------------------------------------------------
    function Na__ElevData__RunToWorldMm(elevation, runMm) {
        const axes       = Na__ElevData__GetAxes(elevation);
        const distanceMm = Na__ElevData__GetPlaneDistanceMm(elevation);

        return {
            xMm : (runMm * axes.rightX) + (distanceMm * axes.normalX),
            zMm : (runMm * axes.rightZ) + (distanceMm * axes.normalZ)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Elevation Cut, or Drawn Whole?
    // ------------------------------------------------------------
    function Na__ElevData__IsSection(elevation) {
        return Boolean(elevation && elevation[Na__ElevData__F_MODE] === Na__ElevData__MODE_SECTION);
    }
    // ------------------------------------------------------------


    // FUNCTION | Get an Elevation's View Depth in Millimetres (null = infinite)
    // ------------------------------------------------------------
    function Na__ElevData__GetViewDepthMm(elevation) {
        if (!elevation) return null;
        const depth = elevation[Na__ElevData__F_VIEW_DEPTH];
        return (Number.isFinite(depth) && depth > 0) ? depth : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get an Elevation's Saved Zoom and Pan Target
    // ------------------------------------------------------------
    // The pan target is stored in the DRAWING's axes - horizontal run and
    // height - not in world X/Z, because that is what the camera is moved in
    // and storing it any other way would need a conversion that could drift.
    // Null members mean the elevation has never been framed, which tells the
    // camera module to fit the model instead.
    // ------------------------------------------------------------
    function Na__ElevData__GetSavedView(elevation) {
        if (!elevation) return { zoom: null, runMm: null, heightMm: null };

        const target = elevation[Na__ElevData__F_TARGET];
        const zoom   = elevation[Na__ElevData__F_ZOOM];

        return {
            zoom     : Number.isFinite(zoom) && zoom > 0 ? zoom : null,
            runMm    : (target && Number.isFinite(target.PosRun))    ? target.PosRun    : null,
            heightMm : (target && Number.isFinite(target.PosHeight)) ? target.PosHeight : null
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Store an Elevation's Zoom and Pan Target
    // ------------------------------------------------------------
    function Na__ElevData__SetSavedView(elevation, zoom, runMm, heightMm) {
        if (!elevation) return false;
        if (Number.isFinite(zoom) && zoom > 0) elevation[Na__ElevData__F_ZOOM] = zoom;
        if (Number.isFinite(runMm) && Number.isFinite(heightMm)) {
            elevation[Na__ElevData__F_TARGET] = {
                PosRun    : Math.round(runMm),
                PosHeight : Math.round(heightMm)
            };
        }
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Mutating Elevations
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Ensure the Elevations Array Exists on the Block
    // ------------------------------------------------------------
    function Na__ElevData__EnsureArray(sceneConfig) {
        if (!sceneConfig || typeof sceneConfig !== 'object') return null;
        if (!Array.isArray(sceneConfig[Na__ElevData__ELEVATIONS_KEY])) {
            sceneConfig[Na__ElevData__ELEVATIONS_KEY] = [];
        }
        return sceneConfig[Na__ElevData__ELEVATIONS_KEY];
    }
    // ------------------------------------------------------------


    // FUNCTION | Allocate the Next Free Elevation Id
    // ------------------------------------------------------------
    // Scans for the highest numeric suffix in use rather than counting, so
    // deleting a middle elevation never causes an id collision.
    // ------------------------------------------------------------
    function Na__ElevData__NextElevationId(sceneConfig) {
        const list = Na__ElevData__GetElevations(sceneConfig);
        let highest = 0;

        for (let i = 0; i < list.length; i++) {
            const id = list[i][Na__ElevData__F_ID];
            if (typeof id !== 'string' || !id.startsWith(Na__ElevData__ID_PREFIX)) continue;
            const parsed = parseInt(id.slice(Na__ElevData__ID_PREFIX.length), 10);
            if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
        }

        return Na__ElevData__ID_PREFIX + String(highest + 1).padStart(Na__ElevData__ID_PADDING, '0');
    }
    // ------------------------------------------------------------


    // FUNCTION | Create and Append a New Elevation
    // ------------------------------------------------------------
    // options: { name, azimuthDeg, mode, originXMm, originZMm, viewDepthMm }.
    // Anything omitted falls back to the config default.
    // ------------------------------------------------------------
    function Na__ElevData__CreateElevation(sceneConfig, options) {
        const array = Na__ElevData__EnsureArray(sceneConfig);
        if (!array) return null;

        const opts        = options || {};
        const direction   = Na__ElevCfg__GetDirectionSetup();
        const originRange = Na__ElevCfg__GetPlaneOriginRangeMm();
        const order       = array.length + 1;

        const record = {};
        record[Na__ElevData__F_ID]      = Na__ElevData__NextElevationId(sceneConfig);
        record[Na__ElevData__F_NAME]    = (typeof opts.name === 'string' && opts.name.trim().length > 0)
            ? opts.name.trim()
            : Na__ElevCfg__FormatLabel('NewElevationNameFormat', 'Elevation {index}', { index: order });
        record[Na__ElevData__F_ORDER]   = order;
        record[Na__ElevData__F_ENABLED] = true;
        record[Na__ElevData__F_AZIMUTH] = Na__ElevData__WrapAzimuth(
            Number.isFinite(opts.azimuthDeg) ? opts.azimuthDeg : direction.defaultDeg
        );
        record[Na__ElevData__F_MODE]    = (opts.mode === Na__ElevData__MODE_SECTION)
            ? Na__ElevData__MODE_SECTION
            : Na__ElevData__MODE_ELEVATION;
        record[Na__ElevData__F_ORIGIN]  = {
            PosX : Math.round(Number.isFinite(opts.originXMm) ? opts.originXMm : originRange.defaultXMm),
            PosZ : Math.round(Number.isFinite(opts.originZMm) ? opts.originZMm : originRange.defaultZMm)
        };
        record[Na__ElevData__F_VIEW_DEPTH]  = Number.isFinite(opts.viewDepthMm) && opts.viewDepthMm > 0
            ? opts.viewDepthMm
            : Na__ElevCfg__GetDefaultViewDepthMm();
        record[Na__ElevData__F_SCENE_ID]    = null;                              // <-- Linked when the scene is created
        record[Na__ElevData__F_ANNOTATIONS] = [];
        record[Na__ElevData__F_DIMENSIONS]  = [];

        array.push(record);
        return record;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete an Elevation and Unlink Its Scene
    // ------------------------------------------------------------
    // Returns the id of the scene that should be removed alongside it, or
    // null. The caller owns scene deletion so scene ordering stays in one
    // place rather than being split across two modules.
    // ------------------------------------------------------------
    function Na__ElevData__DeleteElevation(sceneConfig, elevationId) {
        const array = Na__ElevData__EnsureArray(sceneConfig);
        if (!array) return null;

        let orphanedSceneId = null;
        for (let i = 0; i < array.length; i++) {
            if (array[i][Na__ElevData__F_ID] !== elevationId) continue;
            orphanedSceneId = array[i][Na__ElevData__F_SCENE_ID] || null;
            array.splice(i, 1);
            break;
        }

        Na__ElevData__RenumberOrder(sceneConfig);
        return orphanedSceneId;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rewrite Order to a Clean 1..n Sequence
    // ------------------------------------------------------------
    function Na__ElevData__RenumberOrder(sceneConfig) {
        const list = Na__ElevData__GetElevations(sceneConfig);
        for (let i = 0; i < list.length; i++) list[i][Na__ElevData__F_ORDER] = i + 1;
    }
    // ------------------------------------------------------------


    // FUNCTION | Link an Elevation to the Scene That Displays It
    // ------------------------------------------------------------
    // Writes both directions at once so the pair can never half-exist.
    // ------------------------------------------------------------
    function Na__ElevData__LinkToScene(elevation, scene) {
        if (!elevation || !scene) return false;
        elevation[Na__ElevData__F_SCENE_ID] = scene[Na__ElevData__SCENE_ID_KEY];
        scene[Na__ElevData__SCENE_ELEV_ID]  = elevation[Na__ElevData__F_ID];
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Find the Scene an Elevation Is Displayed By
    // ------------------------------------------------------------
    function Na__ElevData__FindSceneFor(sceneConfig, elevation) {
        if (!sceneConfig || !elevation) return null;
        const scenes = sceneConfig[Na__ElevData__SCENES_KEY];
        if (!Array.isArray(scenes)) return null;

        const elevationId = elevation[Na__ElevData__F_ID];
        for (let i = 0; i < scenes.length; i++) {
            if (scenes[i] && scenes[i][Na__ElevData__SCENE_ELEV_ID] === elevationId) return scenes[i];
        }
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Markup Storage
// -----------------------------------------------------------------------------

    // FUNCTION | Get an Elevation's Annotation Array (Live Reference)
    // ------------------------------------------------------------
    // Stored opaquely: the annotations system owns the item shape, this module
    // only guarantees the array exists and is persisted. Handing back the LIVE
    // array is what lets the overlay, the undo stack and the saved record all
    // hold one object rather than three copies.
    // ------------------------------------------------------------
    function Na__ElevData__GetAnnotations(elevation) {
        if (!elevation) return [];
        if (!Array.isArray(elevation[Na__ElevData__F_ANNOTATIONS])) {
            elevation[Na__ElevData__F_ANNOTATIONS] = [];
        }
        return elevation[Na__ElevData__F_ANNOTATIONS];
    }
    // ------------------------------------------------------------


    // FUNCTION | Get an Elevation's Dimension Array (Live Reference)
    // ------------------------------------------------------------
    function Na__ElevData__GetDimensions(elevation) {
        if (!elevation) return [];
        if (!Array.isArray(elevation[Na__ElevData__F_DIMENSIONS])) {
            elevation[Na__ElevData__F_DIMENSIONS] = [];
        }
        return elevation[Na__ElevData__F_DIMENSIONS];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Project Data API
    // ------------------------------------------------------------
    export {
        Na__ElevData__ELEVATIONS_KEY,
        Na__ElevData__SCENE_ELEV_ID,
        Na__ElevData__MODE_ELEVATION,
        Na__ElevData__MODE_SECTION,
        Na__ElevData__GetElevations,
        Na__ElevData__GetEnabledElevations,
        Na__ElevData__GetElevationById,
        Na__ElevData__GetElevationForScene,
        Na__ElevData__IsElevationScene,
        Na__ElevData__GetAxes,
        Na__ElevData__GetPlaneOriginMm,
        Na__ElevData__SetPlaneOriginMm,
        Na__ElevData__GetPlaneDistanceMm,
        Na__ElevData__WorldToRunMm,
        Na__ElevData__RunToWorldMm,
        Na__ElevData__IsSection,
        Na__ElevData__GetViewDepthMm,
        Na__ElevData__GetSavedView,
        Na__ElevData__SetSavedView,
        Na__ElevData__NextElevationId,
        Na__ElevData__CreateElevation,
        Na__ElevData__DeleteElevation,
        Na__ElevData__RenumberOrder,
        Na__ElevData__LinkToScene,
        Na__ElevData__FindSceneFor,
        Na__ElevData__GetAnnotations,
        Na__ElevData__GetDimensions
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
