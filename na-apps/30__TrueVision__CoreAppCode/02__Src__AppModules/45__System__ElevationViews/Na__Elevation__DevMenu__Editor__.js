// =============================================================================
// TRUEVISION3D - ELEVATION VIEWS - DEV MENU EDITOR
// =============================================================================
//
// FILE       : Na__Elevation__DevMenu__Editor__.js
// NAMESPACE  : Na__ElevDev
// MODULE     : Elevation Views - Dev Menu Editor
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Localhost-only authoring UI for creating and tuning elevations
// CREATED    : 07-Sep-2026
//
// DESCRIPTION:
// - The developer-facing half of the feature: add an elevation, name it, point
//   it at a face of the building, slide its drawing plane, preview it, mark it
//   up, capture its thumbnail, and save.
//
// - SEED N / E / S / W is the one-click start. Four elevations of a square-on
//   building is what almost every drawing set actually needs, and creating
//   them individually is four repetitions of the same four decisions. The
//   planes are centred on the model so all four are immediately meaningful
//   rather than stranded at the world origin.
//
// - EVERY ELEVATION HAS A PLANE IN THE 3D VIEW (47__System__DrawingPlanes). Each
//   row can switch its own on, the bar at the head of the panel switches all of
//   them on, and each carries the elevation's name in its own colour - the
//   swatch beside the row's name. The plane of the row being TOUCHED is always
//   up, as the old single gizmo was, so the numbers always have something
//   visible attached. A plane can be dragged along its normal, snapped to a
//   world grid, sent to a picked face (Move to face) or turned to face a wall
//   (Aim at face, ValeVision's pick) - and every one of those writes the same
//   two numbers the sliders write, so the numbers remain the definition.
//
// - Save writes the whole PresentationMode block through the existing
//   Na__CfApi__MergeAndSaveKeys path. Elevations are nested INSIDE that block,
//   so they ride the same R2 sync every other dev-menu save uses and no
//   dev-owned key list needs touching.
//
// INTEGRATION:
// - Initialized from Index.html alongside the other localhost-only dev tools.
// - Drives Na__Elevation__ModeController__ for preview and markup.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.1.0
// - Elevation planes are shown through the shared Drawing Planes system
//   instead of Na__Elevation__PlaneGizmo__: a Show plane toggle, Move to face
//   and Aim at face on every row, and the Drawing Planes bar (all on, snap and
//   its grid) at the head of the panel. The editor registers an elevation
//   SOURCE with the overlay; a drag or a pick in the 3D view runs the same
//   commit a slider release runs and rebuilds the panel.
// - Closing the panel no longer takes every plane down - only the one that was
//   up because its row was being edited.
// - "Centre on model" and Seed N / E / S / W centre on the BUILDING, on the
//   snap grid. They used the whole model's bounds, whose centre on a real
//   project is the landscape's: PS01's three planes sat at (20 000, -20 000),
//   off the corner of the house, and nothing showed it until the planes did.
//
// 07-Sep-2026 - Version 1.0.0
// - Initial implementation for the Elevation Drawings build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Cloudflare R2 Save Path
    // ------------------------------------------------------------
    import {
        Na__CfApi__GetProjectContext,
        Na__CfApi__MergeAndSaveKeys
    } from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Presentation Scene Config and Thumbnail Capture
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__ProjectJson__GetActiveConfig,
        Na__PresentationMode__ProjectJson__BroadcastScenesChanged
    } from '../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
    import {
        Na__PresentationMode__Thumbnail__CaptureAndUpload
    } from '../21__System__PresentationMode/Na__PresentationMode__Thumbnail__Renderer.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Section Cut Live Update
    // ------------------------------------------------------------
    import {
        Na__SectionCut__SetPlaneDistanceMm
    } from '../41__System__SectionCutEngine/Na__SectionCut__Engine__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Elevation Data, Config, Framing, Gizmo, Link and Mode
    // ------------------------------------------------------------
    // @delegate: ./Na__Elevation__ProjectJson__Data__.js
    // @delegate: ./Na__Elevation__Framing__.js
    // @delegate: ./Na__Elevation__DevMenu__RowBuilders__.js
    // @delegate: ./Na__Elevation__SceneLink__.js
    // @delegate: ./Na__Elevation__ModeController__.js
    // ------------------------------------------------------------
    import {
        Na__ElevData__GetElevations,
        Na__ElevData__CreateElevation,
        Na__ElevData__DeleteElevation,
        Na__ElevData__GetAxes,
        Na__ElevData__GetPlaneOriginMm,
        Na__ElevData__SetPlaneOriginMm,
        Na__ElevData__GetPlaneDistanceMm,
        Na__ElevData__AzimuthFromNormal,
        Na__ElevData__IsSection,
        Na__ElevData__FindSceneFor
    } from './Na__Elevation__ProjectJson__Data__.js';
    import {
        Na__ElevCfg__GetDirectionPresets,
        Na__ElevCfg__GetLabel,
        Na__ElevCfg__FormatLabel,
        Na__ElevCfg__GetSceneGroupTarget
    } from './Na__Elevation__ConfigState__.js';
    import {
        Na__ElevFrame__MeasureModel,
        Na__ElevFrame__GetBounds,
        Na__ElevFrame__GetCentredPlaneOriginMm
    } from './Na__Elevation__Framing__.js';
    import {
        Na__ElevRow__BuildButton,
        Na__ElevRow__BuildElevationRow
    } from './Na__Elevation__DevMenu__RowBuilders__.js';
    import { Na__DrawSceneRow__Build } from '../40__System__DrawingViewCore/Na__DrawView__SceneLinkRow__.js';
    import {
        Na__ElevLink__CreateSceneForElevation,
        Na__ElevLink__RemoveSceneForElevation,
        Na__ElevLink__SyncSceneName,
        Na__ElevLink__SyncSceneCamera
    } from './Na__Elevation__SceneLink__.js';
    import {
        Na__ElevationMode__EnterElevation,
        Na__ElevationMode__ExitElevation,
        Na__ElevationMode__SetEditMode,
        Na__ElevationMode__IsEditMode,
        Na__ElevationMode__IsActive,
        Na__ElevationMode__RefreshActive,
        Na__ElevationMode__GetActiveElevation,
        Na__ElevationMode__StoreActiveFraming,
        Na__ElevMode__CHANGED_EVENT
    } from './Na__Elevation__ModeController__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Planes (the planes shown in the 3D view)
    // ------------------------------------------------------------
    // @delegate: ../47__System__DrawingPlanes/Na__DrawingPlanes__Overlay__.js
    // @delegate: ../47__System__DrawingPlanes/Na__DrawingPlanes__Grip__.js
    // @delegate: ../47__System__DrawingPlanes/Na__DrawingPlanes__DevMenu__Controls__.js
    // @delegate: ../47__System__DrawingPlanes/Na__DrawingPlanes__Maths__.js
    // ------------------------------------------------------------
    import {
        Na__PlaneOverlay__KIND_VERTICAL,
        Na__PlaneOverlay__RegisterSource,
        Na__PlaneOverlay__Select,
        Na__PlaneOverlay__DeselectType,
        Na__PlaneOverlay__Forget,
        Na__PlaneOverlay__Refresh,
        Na__PlaneOverlay__RefreshOne,
        Na__PlaneOverlay__GetSnap
    } from '../47__System__DrawingPlanes/Na__DrawingPlanes__Overlay__.js';
    import { Na__PlaneBounds__Measure } from '../47__System__DrawingPlanes/Na__DrawingPlanes__Bounds__.js';
    import {
        Na__PlaneGrip__MODE_AIM,
        Na__PlaneGrip__CancelFacePick
    } from '../47__System__DrawingPlanes/Na__DrawingPlanes__Grip__.js';
    import {
        Na__PlaneUi__TYPE_ELEVATION,
        Na__PlaneUi__BuildBar,
        Na__PlaneUi__BuildRowControls
    } from '../47__System__DrawingPlanes/Na__DrawingPlanes__DevMenu__Controls__.js';
    import {
        Na__PlaneMath__ApplySnap,
        Na__PlaneMath__FormatMm,
        Na__PlaneMath__MoveOriginToDistance
    } from '../47__System__DrawingPlanes/Na__DrawingPlanes__Maths__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | DOM Identifiers
    // ------------------------------------------------------------
    const Na__ElevDev__PANEL_ID  = 'naElevationDevPanel';
    const Na__ElevDev__ITEM_ID   = 'naElevationDevItem';
    const Na__ElevDev__TOGGLE_ID = 'naElevationDevToggle';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Section Cut Plane Id Prefix (mirrors the controller)
    // ------------------------------------------------------------
    const Na__ElevDev__CUT_ID_PREFIX = 'ElevationCut__';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Host Context
    // ------------------------------------------------------------
    let Na__ElevDev__Panel       = null;
    let Na__ElevDev__ModelRoot   = null;
    let Na__ElevDev__Camera      = null;
    let Na__ElevDev__ShowToast   = null;
    let Na__ElevDev__Initialized = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Get the Live Presentation Scene Config
    // ------------------------------------------------------------
    function Na__ElevDev__GetConfig() {
        return Na__PresentationMode__ProjectJson__GetActiveConfig();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Show a Toast if the Host Supplied One
    // ------------------------------------------------------------
    function Na__ElevDev__Toast(message, isError) {
        if (typeof Na__ElevDev__ShowToast === 'function') Na__ElevDev__ShowToast(message, isError === true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Field of View of the Live Perspective Camera
    // ------------------------------------------------------------
    function Na__ElevDev__Fov() {
        return Na__ElevDev__Camera ? Na__ElevDev__Camera.fov : 30;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Measure the Loaded Model for One Elevation
    // ------------------------------------------------------------
    function Na__ElevDev__Measure(elevation) {
        return Na__ElevFrame__MeasureModel(Na__ElevDev__ModelRoot, Na__ElevDev__Camera, elevation);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Bring Up the Plane of the Row Being Edited
    // ------------------------------------------------------------
    // Selecting a plane puts it up whether or not its Show plane toggle is on,
    // and re-lays it out where the record now says it stands - so the numbers
    // always have something visible attached, as the old single gizmo did.
    // Not while a drawing is previewing: nothing of the overlay is drawn over a
    // drawing anyway, and the selection would only flash up on the way out.
    // ------------------------------------------------------------
    function Na__ElevDev__ShowGizmo(elevation) {
        if (Na__ElevationMode__IsActive()) return;
        Na__PlaneOverlay__Select(Na__PlaneUi__TYPE_ELEVATION, elevation.Elevation__Id);
        Na__PlaneOverlay__RefreshOne(Na__PlaneUi__TYPE_ELEVATION, elevation.Elevation__Id);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Push an Elevation's Live Plane Position to the Engine
    // ------------------------------------------------------------
    // Only meaningful for a section - a plain elevation has no plane
    // registered at all, which is why this is a no-op rather than a guarded
    // write in that case.
    // ------------------------------------------------------------
    function Na__ElevDev__PushLiveCut(elevation, liveDrag) {
        if (!Na__ElevationMode__IsActive()) return;
        if (Na__ElevationMode__GetActiveElevation() !== elevation) return;
        if (!Na__ElevData__IsSection(elevation)) return;

        Na__SectionCut__SetPlaneDistanceMm(
            Na__ElevDev__CUT_ID_PREFIX + elevation.Elevation__Id,
            Na__ElevData__GetPlaneDistanceMm(elevation),
            liveDrag === true
        );
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Re-Derive Everything That Depends on the Plane
    // ------------------------------------------------------------
    // The stored scene pose AND, when the drawing is on screen, the live cut,
    // camera and drawing axes. Called on commit rather than on every input, so
    // dragging stays cheap.
    // ------------------------------------------------------------
    function Na__ElevDev__CommitGeometry(elevation) {
        const config = Na__ElevDev__GetConfig();
        Na__ElevLink__SyncSceneCamera(config, elevation, Na__ElevDev__Measure(elevation), Na__ElevDev__Fov());

        if (Na__ElevationMode__IsActive() && Na__ElevationMode__GetActiveElevation() === elevation) {
            Na__ElevationMode__RefreshActive();
        } else {
            Na__ElevDev__ShowGizmo(elevation);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing Planes Source
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Centre of the BUILDING, on the Snap Grid
    // ------------------------------------------------------------
    // What "Centre on model" and Seed N / E / S / W mean. They used to take the
    // centre of the whole model's bounds, and on a real project that is the
    // centre of the LANDSCAPE: PS01's slab is 80 m square, so its three seeded
    // planes all landed at (20 000, -20 000), off the corner of a house that
    // stands around (15 000, -15 400). Nobody could see that until the planes
    // were drawn. The building's own bounds come from the Drawing Planes
    // system, which never measures the landscape; the old centre stands in only
    // when no building can be told apart.
    // ------------------------------------------------------------
    function Na__ElevDev__BuildingCentreMm(elevation) {
        const measured = Na__PlaneBounds__Measure(Na__ElevDev__ModelRoot);
        if (!measured) return Na__ElevFrame__GetCentredPlaneOriginMm(Na__ElevDev__Measure(elevation || null));

        const snap = Na__PlaneOverlay__GetSnap();
        return {
            xMm : Na__PlaneMath__ApplySnap(((measured.box.min.x + measured.box.max.x) / 2) * 1000, snap),
            zMm : Na__PlaneMath__ApplySnap(((measured.box.min.z + measured.box.max.z) / 2) * 1000, snap)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put an Elevation's Plane a Distance Along Its Own Normal
    // ------------------------------------------------------------
    // The record stores a POINT the plane passes through, which is what the two
    // sliders move. The point slides along the normal and not across it, so the
    // numbers the sliders show change by the least that moves the plane.
    // ------------------------------------------------------------
    function Na__ElevDev__MovePlaneTo(elevation, distanceMm) {
        const axes   = Na__ElevData__GetAxes(elevation);
        const origin = Na__ElevData__GetPlaneOriginMm(elevation);
        const moved  = Na__PlaneMath__MoveOriginToDistance(origin.xMm, origin.zMm, axes.normalX, axes.normalZ, distanceMm);
        return Na__ElevData__SetPlaneOriginMm(elevation, moved.xMm, moved.zMm);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say Where a Plane Is, in the Panel's Own Terms
    // ------------------------------------------------------------
    // A plane square to the world is described by the slider that moves it;
    // only a plane at an angle is described by its distance along the view.
    // ------------------------------------------------------------
    function Na__ElevDev__DescribePlane(elevation) {
        const axes   = Na__ElevData__GetAxes(elevation);
        const origin = Na__ElevData__GetPlaneOriginMm(elevation);
        if (Math.abs(axes.normalZ) < 1e-6) return Na__ElevCfg__GetLabel('PlaneXFieldLabel', 'Plane X') + '  ' + Na__PlaneMath__FormatMm(origin.xMm) + ' mm';
        if (Math.abs(axes.normalX) < 1e-6) return Na__ElevCfg__GetLabel('PlaneZFieldLabel', 'Plane Z') + '  ' + Na__PlaneMath__FormatMm(origin.zMm) + ' mm';
        return Na__PlaneMath__FormatMm(Na__ElevData__GetPlaneDistanceMm(elevation)) + ' mm along the view';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Send an Elevation's Plane to a Picked Building Face
    // ------------------------------------------------------------
    // hit: { pointMm, normal } - the face's world normal, toward the camera.
    // MOVE keeps the bearing and puts the plane through the picked point, on
    // the snap grid. AIM first turns the elevation to face the wall square on -
    // ValeVision's pick - and refuses a floor or a roof, which has no bearing
    // to give. Returns the toast, or null when refused (the pick stays armed).
    // ------------------------------------------------------------
    function Na__ElevDev__ApplyFacePick(elevation, hit, snap, mode) {
        if (mode === Na__PlaneGrip__MODE_AIM) {
            const flat = Math.hypot(hit.normal.x, hit.normal.z);
            if (flat < 0.2) {
                Na__ElevDev__Toast('That face is a floor or a roof - click a wall to aim the elevation at.', true);
                return null;
            }
            elevation.Elevation__AzimuthDeg = Na__ElevData__AzimuthFromNormal(hit.normal.x / flat, hit.normal.z / flat);
        }

        const axes     = Na__ElevData__GetAxes(elevation);
        const distance = (hit.pointMm.x * axes.normalX) + (hit.pointMm.z * axes.normalZ);
        Na__ElevDev__MovePlaneTo(elevation, Na__PlaneMath__ApplySnap(distance, snap));

        return '"' + elevation.Elevation__Name + '" '
            + ((mode === Na__PlaneGrip__MODE_AIM) ? ('now faces that wall (bearing ' + elevation.Elevation__AzimuthDeg + ' deg) - ') : 'moved to the face - ')
            + Na__ElevDev__DescribePlane(elevation) + '.';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tell the Drawing Planes System About Elevations
    // ------------------------------------------------------------
    // Everything the shared overlay and grip need to show, move and pick an
    // elevation's plane. A drag or a pick writes the same fields the sliders
    // write, then runs the same commit a slider release runs - and rebuilds
    // the panel, so the sliders show where the plane landed.
    // ------------------------------------------------------------
    function Na__ElevDev__RegisterPlaneSource() {
        Na__PlaneOverlay__RegisterSource(Na__PlaneUi__TYPE_ELEVATION, {
            kind          : Na__PlaneOverlay__KIND_VERTICAL,
            paletteOffset : 0,
            list          : () => Na__ElevData__GetElevations(null),
            getId         : (elevation) => elevation.Elevation__Id,
            getName       : (elevation) => elevation.Elevation__Name,
            isSection     : (elevation) => Na__ElevData__IsSection(elevation),
            getAxes       : (elevation) => Na__ElevData__GetAxes(elevation),
            getPositionMm : (elevation) => Na__ElevData__GetPlaneDistanceMm(elevation),
            setPositionMm : (elevation, distanceMm) => Na__ElevDev__MovePlaneTo(elevation, distanceMm),
            describe      : (elevation) => Na__ElevDev__DescribePlane(elevation),
            onLive        : (elevation) => Na__ElevDev__PushLiveCut(elevation, true),
            onCommit      : (elevation) => {
                Na__ElevDev__PushLiveCut(elevation, false);
                Na__ElevDev__CommitGeometry(elevation);
                if (Na__ElevDev__Panel && Na__ElevDev__Panel.classList.contains('is-open')) Na__ElevDev__Render();
            },
            applyFacePick : Na__ElevDev__ApplyFacePick
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Row Handler Wiring
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build One Elevation Row With Its Handlers Bound
    // ------------------------------------------------------------
    // The row builder is purely presentational, so everything that actually
    // changes state is assembled here and handed to it.
    // ------------------------------------------------------------
    function Na__ElevDev__BuildRow(elevation) {
        const config   = Na__ElevDev__GetConfig();
        const isActive = Na__ElevationMode__IsActive()
                      && Na__ElevationMode__GetActiveElevation() === elevation;

        return Na__ElevRow__BuildElevationRow(elevation, {
            isActive   : isActive,
            isEditMode : isActive && Na__ElevationMode__IsEditMode(),

            onRename : () => {
                Na__ElevLink__SyncSceneName(config, elevation);
                Na__PresentationMode__ProjectJson__BroadcastScenesChanged();     // <-- The card carries the elevation name
                Na__PlaneOverlay__Refresh();                                     // <-- And so does its plane in the 3D view
            },

            // A new bearing changes the camera basis outright, so the drawing
            // has to be rebuilt rather than nudged.
            onDirectionChange : () => Na__ElevDev__CommitGeometry(elevation),

            // Elevation and section differ only in whether the plane bites,
            // but that IS a change of plane set, so the same full rebuild.
            onModeChange : () => Na__ElevDev__CommitGeometry(elevation),

            onPlaneLive   : () => {
                Na__ElevDev__PushLiveCut(elevation, true);
                Na__ElevDev__ShowGizmo(elevation);
            },
            onPlaneCommit : () => {
                Na__ElevDev__PushLiveCut(elevation, false);
                Na__ElevDev__CommitGeometry(elevation);
            },

            onCentrePlane : () => {
                const centred = Na__ElevDev__BuildingCentreMm(elevation);        // <-- The building's centre, not the landscape's
                if (!centred) {
                    Na__ElevDev__Toast(Na__ElevCfg__GetLabel('NoModelMessage', 'Load a model before adding elevations.'), true);
                    return;
                }
                Na__ElevData__SetPlaneOriginMm(elevation, centred.xMm, centred.zMm);
                Na__ElevDev__PushLiveCut(elevation, false);
                Na__ElevDev__CommitGeometry(elevation);
            },

            // Depth changes the PLANE SET, not just a constant, so the cut has
            // to be rebuilt rather than nudged.
            onDepthChange : () => Na__ElevDev__CommitGeometry(elevation),

            onPreviewToggle : () => {
                if (isActive) {
                    Na__ElevationMode__ExitElevation(null);
                } else {
                    Na__PlaneGrip__CancelFacePick(Na__PlaneUi__TYPE_ELEVATION);  // <-- A face is picked in the 3D view, which is about to go. The planes need no hiding: they are never drawn over a drawing
                    Na__ElevationMode__EnterElevation(elevation);
                }
            },
            onAnnotate  : () => Na__ElevationMode__SetEditMode(!Na__ElevationMode__IsEditMode()),
            onThumbnail : () => Na__ElevDev__SaveThumbnail(elevation),
            onDelete    : () => Na__ElevDev__DeleteElevation(elevation)
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Panel Mutations
// -----------------------------------------------------------------------------

    // FUNCTION | Add One Elevation and Its Scene
    // ------------------------------------------------------------
    function Na__ElevDev__AddElevation(options) {
        const config = Na__ElevDev__GetConfig();
        if (!config) {
            Na__ElevDev__Toast('No presentation scene config loaded.', true);
            return null;
        }

        const elevation = Na__ElevData__CreateElevation(config, options || {});
        if (!elevation) return null;

        Na__ElevLink__CreateSceneForElevation(
            config, elevation, Na__ElevDev__Measure(elevation), Na__ElevDev__Fov()
        );
        Na__PresentationMode__ProjectJson__BroadcastScenesChanged();             // <-- Or the new card stays invisible all session
        Na__ElevDev__Render();
        return elevation;
    }
    // ------------------------------------------------------------


    // FUNCTION | Create One Elevation Per Compass Preset
    // ------------------------------------------------------------
    // Four elevations of a square-on building is what almost every drawing set
    // needs, and their planes are centred on the model so each one is
    // immediately meaningful rather than stranded at the world origin.
    // ------------------------------------------------------------
    function Na__ElevDev__SeedFourSides() {
        // The building's centre in X/Z does not depend on which way an elevation
        // faces, so one measurement with no record serves all four.
        const centred = Na__ElevDev__BuildingCentreMm(null);
        if (!centred) {
            Na__ElevDev__Toast(Na__ElevCfg__GetLabel('NoModelMessage', 'Load a model before adding elevations.'), true);
            return 0;
        }

        const presets = Na__ElevCfg__GetDirectionPresets();

        for (let i = 0; i < presets.length; i++) {
            Na__ElevDev__AddElevation({
                name       : Na__ElevCfg__FormatLabel(
                    'PresetNameFormat', '{preset} Elevation', { preset: presets[i].label }
                ),
                azimuthDeg : presets[i].azimuthDeg,
                originXMm  : centred.xMm,
                originZMm  : centred.zMm
            });
        }

        Na__ElevDev__Toast('Created ' + presets.length + ' elevation(s) around the model.');
        return presets.length;
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete an Elevation, Its Scene and Its Markup
    // ------------------------------------------------------------
    function Na__ElevDev__DeleteElevation(elevation) {
        const config = Na__ElevDev__GetConfig();
        if (!config) return false;

        const prompt = Na__ElevCfg__FormatLabel(
            'DeleteElevationPrompt',
            'Delete the elevation "{name}"? Its scene, annotations and dimensions go with it.',
            { name: elevation.Elevation__Name }
        );
        if (!window.confirm(prompt)) return false;

        if (Na__ElevationMode__IsActive() && Na__ElevationMode__GetActiveElevation() === elevation) {
            Na__ElevationMode__ExitElevation(null);                              // <-- Never leave a deleted drawing on screen
        }
        Na__PlaneGrip__CancelFacePick(Na__PlaneUi__TYPE_ELEVATION);

        const orphanedSceneId = Na__ElevData__DeleteElevation(config, elevation.Elevation__Id);
        if (orphanedSceneId) Na__ElevLink__RemoveSceneForElevation(config, orphanedSceneId);
        Na__PlaneOverlay__Forget(Na__PlaneUi__TYPE_ELEVATION, elevation.Elevation__Id);   // <-- After the record has gone, so the refresh finds nothing to keep up

        Na__PresentationMode__ProjectJson__BroadcastScenesChanged();             // <-- Drop the card with the elevation
        Na__ElevDev__Render();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Capture the Drawing on Screen as Its Scene Thumbnail
    // ------------------------------------------------------------
    // The elevation MUST be previewing for this to mean anything - the capture
    // is of the viewport. The button is disabled otherwise; this is the second
    // guard, because a disabled button is a UI fact rather than a rule.
    // ------------------------------------------------------------
    async function Na__ElevDev__SaveThumbnail(elevation) {
        if (!Na__ElevationMode__IsActive() || Na__ElevationMode__GetActiveElevation() !== elevation) {
            Na__ElevDev__Toast('Preview the elevation before saving its thumbnail.', true);
            return false;
        }

        const config = Na__ElevDev__GetConfig();
        const scene  = config ? Na__ElevData__FindSceneFor(config, elevation) : null;
        if (!scene) {
            Na__ElevDev__Toast('This elevation has no scene to attach a thumbnail to.', true);
            return false;
        }

        // The thumbnail IS the framing. Recording it here means the card and
        // the view it opens at can never disagree.
        Na__ElevationMode__StoreActiveFraming();

        try {
            const result = await Na__PresentationMode__Thumbnail__CaptureAndUpload(
                scene.PresentationMode__Scene__Id
            );
            if (!result.ok) {
                Na__ElevDev__Toast('Thumbnail upload failed: ' + result.error, true);
                return false;
            }
            scene.PresentationMode__Scene__ThumbnailUrl = result.relUrl;         // <-- Saved with the next Save Elevations
            Na__ElevDev__Toast('Thumbnail saved to R2: ' + result.relUrl);
            return true;
        } catch (error) {
            console.error('[TrueVision3D] Elevation thumbnail error:', error);
            Na__ElevDev__Toast('Thumbnail error - see console.', true);
            return false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Save the Whole Presentation Block to R2
    // ------------------------------------------------------------
    // Elevations and their markup are nested inside the block, so this is the
    // same single merge-and-write every other dev-menu save performs.
    // ------------------------------------------------------------
    async function Na__ElevDev__Save() {
        Na__ElevationMode__StoreActiveFraming();                                 // <-- Save what is on screen, not the last gesture

        const context = Na__CfApi__GetProjectContext();
        if (!context.projectFolder) {
            Na__ElevDev__Toast('No project loaded.', true);
            return false;
        }

        const config = Na__ElevDev__GetConfig();
        if (!config) {
            Na__ElevDev__Toast('No presentation scene config loaded.', true);
            return false;
        }

        const result = await Na__CfApi__MergeAndSaveKeys({
            PresentationMode__SavedCameraScenes : config
        });

        if (result.ok) {
            Na__ElevDev__Toast(Na__ElevCfg__GetLabel('SavedMessage', 'Elevations saved to R2.'));
            return true;
        }
        console.error('[TrueVision3D] Elevation save failed:', result.error);
        Na__ElevDev__Toast(Na__ElevCfg__GetLabel('SaveFailedMessage', 'Elevation save failed - see console.'), true);
        return false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Panel Render
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Carousel Card Status and Action for One Elevation
    // ------------------------------------------------------------
    // Creating the card is the same call the Add path makes, so an elevation
    // that lost its card is recovered rather than needing to be rebuilt.
    // ------------------------------------------------------------
    function Na__ElevDev__BuildSceneLinkRow(elevation) {
        const config = Na__ElevDev__GetConfig();

        return Na__DrawSceneRow__Build({
            scene       : config ? Na__ElevData__FindSceneFor(config, elevation) : null,
            groupName   : Na__ElevCfg__GetSceneGroupTarget().groupName,
            drawingWord : 'elevation',
            onCreate    : () => {
                if (!config) {
                    Na__ElevDev__Toast('No presentation scene config loaded.', true);
                    return;
                }
                Na__ElevLink__CreateSceneForElevation(
                    config, elevation, Na__ElevDev__Measure(elevation), Na__ElevDev__Fov()
                );
                Na__PresentationMode__ProjectJson__BroadcastScenesChanged();
                Na__ElevDev__Toast('Added "' + elevation.Elevation__Name + '" to the scene carousel.');
                Na__ElevDev__Render();
            }
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild the Whole Elevation Panel
    // ------------------------------------------------------------
    function Na__ElevDev__Render() {
        if (!Na__ElevDev__Panel) return;
        Na__ElevDev__Panel.innerHTML = '';

        const title = document.createElement('div');
        title.className   = 'na-dropdown-menu__panel-title';
        title.textContent = Na__ElevCfg__GetLabel('SectionTitle', 'Elevations');
        Na__ElevDev__Panel.appendChild(title);

        const config     = Na__ElevDev__GetConfig();
        const elevations = config ? Na__ElevData__GetElevations(config) : [];

        // DRAWING PLANES | Show all, snap and its grid - the same bar the Floor
        // Plans panel carries, because the state behind it is shared.
        const planesBar = (elevations.length > 0) ? Na__PlaneUi__BuildBar() : null;
        if (planesBar) Na__ElevDev__Panel.appendChild(planesBar);

        for (let i = 0; i < elevations.length; i++) {
            const elevationRow = Na__ElevDev__BuildRow(elevations[i]);

            // Under the name, so the swatch that ties this row to its plane in
            // the 3D view is the first thing beside what the plane is called.
            const planeControls = Na__PlaneUi__BuildRowControls(
                Na__PlaneUi__TYPE_ELEVATION, elevations[i].Elevation__Id, { canAim : true }
            );
            if (planeControls) elevationRow.insertBefore(planeControls, elevationRow.children[1] || null);

            elevationRow.appendChild(Na__ElevDev__BuildSceneLinkRow(elevations[i]));
            Na__ElevDev__Panel.appendChild(elevationRow);
        }

        if (elevations.length === 0) {
            const empty = document.createElement('p');
            empty.className   = 'na-fp-dev__empty';
            empty.textContent = 'No elevations yet. Seed the four sides, or add one and point it where you like.';
            Na__ElevDev__Panel.appendChild(empty);
        } else {
            const hint = document.createElement('p');
            hint.className   = 'na-fp-dev__empty';
            hint.textContent = 'Each elevation has a plane in the 3D view, in the colour beside its name, showing where '
                             + 'the drawing is taken from and which way it looks. The one you are editing is always up.';
            Na__ElevDev__Panel.appendChild(hint);
        }

        const actions = document.createElement('div');
        actions.className = 'na-pm-dev__actions';

        actions.appendChild(Na__ElevRow__BuildButton(
            Na__ElevCfg__GetLabel('AddElevationLabel', '+ Add Elevation'), '',
            () => {
                if (!Na__ElevFrame__GetBounds(Na__ElevDev__ModelRoot)) {
                    Na__ElevDev__Toast(Na__ElevCfg__GetLabel('NoModelMessage', 'Load a model before adding elevations.'), true);
                    return;
                }
                Na__ElevDev__AddElevation({});
            }
        ));
        actions.appendChild(Na__ElevRow__BuildButton(
            Na__ElevCfg__GetLabel('SeedFourSidesLabel', 'Seed N / E / S / W'), '',
            Na__ElevDev__SeedFourSides
        ));
        Na__ElevDev__Panel.appendChild(actions);

        const saveActions = document.createElement('div');
        saveActions.className = 'na-pm-dev__actions';
        saveActions.appendChild(Na__ElevRow__BuildButton(
            Na__ElevCfg__GetLabel('SaveLabel', 'Save Elevations'),
            'na-pm-dev__btn--primary',
            Na__ElevDev__Save
        ));
        Na__ElevDev__Panel.appendChild(saveActions);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize the Localhost-Only Elevation Editor
    // ------------------------------------------------------------
    // context: { modelRoot, camera, showToast }
    // Mirrors the Floor Plans section: the wrapper is revealed, the toggle
    // opens the panel, and the panel rebuilds on every open so it can never
    // show data from a previous project.
    // ------------------------------------------------------------
    function Na__Elevation__DevMenu__Initialize(context) {
        const menuItem = document.getElementById(Na__ElevDev__ITEM_ID);
        const toggle   = document.getElementById(Na__ElevDev__TOGGLE_ID);
        const panel    = document.getElementById(Na__ElevDev__PANEL_ID);
        if (!menuItem || !toggle || !panel) return false;                        // <-- Markup absent: nothing to mount into

        Na__ElevDev__Panel       = panel;
        Na__ElevDev__ModelRoot   = (context && context.modelRoot) || null;
        Na__ElevDev__Camera      = (context && context.camera)    || null;
        Na__ElevDev__ShowToast   = (context && context.showToast) || null;
        Na__ElevDev__Initialized = true;

        menuItem.style.display = '';                                             // <-- Reveal alongside the other dev tools
        Na__ElevDev__RegisterPlaneSource();                                      // <-- Elevation planes can now be shown, dragged and picked in the 3D view

        toggle.addEventListener('click', () => {
            const isOpen = panel.classList.contains('is-open');
            panel.classList.toggle('is-open', !isOpen);
            toggle.setAttribute('aria-expanded', String(!isOpen));
            if (!isOpen) {
                Na__ElevDev__Render();                                           // <-- Rebuild on each open so data is fresh
            } else {
                // Authoring is done. The plane that was only up because its row
                // was being edited goes; planes SWITCHED ON stay, which is the
                // point of switching them on.
                Na__PlaneGrip__CancelFacePick(Na__PlaneUi__TYPE_ELEVATION);
                Na__PlaneOverlay__DeselectType(Na__PlaneUi__TYPE_ELEVATION);
            }
        });

        // Preview and Annotate button states are derived from mode, so the
        // panel refreshes whenever the controller reports a change.
        window.addEventListener(Na__ElevMode__CHANGED_EVENT, () => {
            if (panel.classList.contains('is-open')) Na__ElevDev__Render();
        });

        // A project switch during the same session replaces the scene config.
        window.addEventListener('na-presentation-mode-scenes-loaded', () => {
            if (panel.classList.contains('is-open')) Na__ElevDev__Render();
        });

        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Point the Editor at a Different Model Root
    // ------------------------------------------------------------
    function Na__Elevation__DevMenu__SetModelRoot(modelRoot) {
        Na__ElevDev__ModelRoot = modelRoot || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Force a Panel Refresh
    // ------------------------------------------------------------
    function Na__Elevation__DevMenu__Refresh() {
        if (Na__ElevDev__Initialized) Na__ElevDev__Render();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Dev Menu Editor API
    // ------------------------------------------------------------
    export {
        Na__Elevation__DevMenu__Initialize,
        Na__Elevation__DevMenu__SetModelRoot,
        Na__Elevation__DevMenu__Refresh
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
