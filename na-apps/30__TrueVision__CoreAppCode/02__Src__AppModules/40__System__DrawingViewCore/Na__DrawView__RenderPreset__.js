// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - RENDER PRESET
// =============================================================================
//
// FILE       : Na__DrawView__RenderPreset__.js
// NAMESPACE  : Na__DrawView__RenderPreset
// MODULE     : Drawing View Core - Render Preset
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Present ValeVision's composer-preset interface over TrueVision's overlay route
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - Everything that renders a drawing - the mode controllers on screen, and the
//   Layout Editor rendering a sheet viewport offscreen - goes through this one
//   module, so the callers are identical in both apps.
// - THE TWO APPS RENDER A DRAWING BY OPPOSITE ROUTES, and both are right.
//   ValeVision keeps its EffectComposer running and swaps the RenderPass camera
//   to ortho, switching the fog and AO passes off with a preset. TrueVision
//   BYPASSES the composer entirely and composites the Sobel edge as a
//   transparent full-screen quad over the finished flat render (v2.19.0).
//   Routing a TrueVision drawing back through its composer would drag fog and
//   SSAO onto it, which shades a parallel drawing like a surface - exactly what
//   a drawing must not look like.
// - So this file shares ValeVision's INTERFACE and none of its implementation.
//   That is the whole design: the seam is the eight function names, and what
//   happens behind them is each app's own business.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 42__System__DrawingViewCore/Na__DrawView__ComposerPreset__.js 1.2.0
//                   (interface only - see DESCRIPTION)
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment Phase B)
// - Parity        : diverged (identical exports, opposite render route)
// - Divergences   : (1) No composer. The frame is renderer.render() plus two overlay passes.
//                   (2) No ortho-aware pre-pass twin to manage; Na__DrawProfile__ already
//                       owns both pre-passes and their buffers.
//                   (3) GetCamera defers to Na__DrawView__ActiveView__, which is where a
//                       TrueVision drawing's camera actually lives - the preset never owns one.
// - Back-port     : no.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation for re-alignment Phase B.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Config, Materials and the Active View Broker
    // ------------------------------------------------------------
    // @delegate: ./Na__DrawView__ConfigState__.js
    // @delegate: ./Na__DrawView__MaterialPreset__.js
    // @delegate: ./Na__DrawView__ActiveView__.js
    // ------------------------------------------------------------
    import { Na__DrawCfg__GetRenderSetup } from './Na__DrawView__ConfigState__.js';
    import { Na__DrawView__GetCamera as Na__DrawView__ActiveCamera } from './Na__DrawView__ActiveView__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Silhouette Edge Overlay and the Cut Overlay
    // ------------------------------------------------------------
    // @delegate: ./Na__DrawView__ProfileLines__.js
    // @delegate: ../41__System__SectionCutEngine/Na__SectionCut__Engine__.js
    // ------------------------------------------------------------
    import {
        Na__DrawProfile__RenderOverlay,
        Na__DrawProfile__SetEnabled,
        Na__DrawProfile__IsEnabled,
        Na__DrawProfile__SetEdgeWidth
    } from './Na__DrawView__ProfileLines__.js';
    import { Na__SectionCut__RenderOverlay } from '../41__System__SectionCutEngine/Na__SectionCut__Engine__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Render Context and Saved State
    // ------------------------------------------------------------
    let Na__DrawPreset__Renderer      = null;   // <-- WebGLRenderer
    let Na__DrawPreset__Scene         = null;   // <-- THREE.Scene
    let Na__DrawPreset__Active        = false;  // <-- Is a drawing currently presented?
    let Na__DrawPreset__Styles        = null;   // <-- The style toggles in force

    // Saved renderer / scene state, restored on Exit. Every field here is one
    // that a drawing changes and a 3D view would otherwise inherit.
    let Na__DrawPreset__SavedBackground   = undefined;
    let Na__DrawPreset__SavedProfileState = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Style Normalisation
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fill In Every Style Toggle
    // ------------------------------------------------------------
    // TWO KEY CONVENTIONS REACH THIS FUNCTION, and they are both correct.
    // A drawing record stores its toggles under `Styles__ProjectedLinework`
    // (FloorPlan__Styles / Elevation__Styles), while a Layout Editor viewport
    // stores the same toggles under plain `projectedLinework` in
    // Viewport__Styles. Reading only one convention does not throw and does not
    // log: every toggle simply falls back to its default, so a viewport with
    // Glass Transparency Off ticked renders exactly as though it were not, and
    // the control looks broken rather than absent.
    //
    // A record written before a toggle existed genuinely lacks the key in either
    // spelling, so each default is the value that reproduces the old behaviour.
    // ------------------------------------------------------------
    function Na__DrawPreset__NormaliseStyles(styles) {
        const s = (styles && typeof styles === 'object') ? styles : {};

        // Reads the record spelling, then the viewport spelling, then the default.
        const read = (recordKey, viewportKey, fallback) => {
            if (typeof s[recordKey]   === 'boolean') return s[recordKey];
            if (typeof s[viewportKey] === 'boolean') return s[viewportKey];
            return fallback;
        };

        return {
            projectedLinework : read('Styles__ProjectedLinework', 'projectedLinework', true),
            profileLinework   : read('Styles__ProfileLinework',   'profileLinework',   true),
            glassOpaque       : read('Styles__GlassOpaque',       'glassOpaque',       false),
            whitecard         : read('Styles__Whitecard',         'whitecard',         false),
            hiddenLines       : read('Styles__HiddenLines',       'hiddenLines',       false),
            baseImage         : read('Styles__BaseImage',         'baseImage',         true),
            contextLayer      : read('Styles__ContextLayer',      'contextLayer',      true),
            enhanceWhitecard  : read('Styles__EnhanceWhitecard',  'enhanceWhitecard',  false)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Lifecycle
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Render Context
    // ------------------------------------------------------------
    function Na__DrawView__RenderPreset__Initialize(context) {
        if (!context) return false;
        Na__DrawPreset__Renderer = context.renderer || null;
        Na__DrawPreset__Scene    = context.scene    || null;
        return Boolean(Na__DrawPreset__Renderer && Na__DrawPreset__Scene);
    }
    // ------------------------------------------------------------


    // FUNCTION | Enter Drawing Presentation
    // ------------------------------------------------------------
    // Saves what a drawing is about to change, then applies the drawing look:
    // a flat white background and the silhouette edge pass at the drawing's own
    // fixed line weight.
    // ------------------------------------------------------------
    // Accepts either a plain styles object or ValeVision's { camera, styles }
    // options bag. The camera is not stored - TrueVision's mode controllers own
    // their cameras and the broker knows which is live - but accepting the bag
    // means the shared callers, above all the Layout Editor's snapshot renderer,
    // are byte-identical between the two trees.
    function Na__DrawView__RenderPreset__Enter(options) {
        if (!Na__DrawPreset__Renderer || !Na__DrawPreset__Scene) return false;
        const styles = (options && options.styles !== undefined) ? options.styles : options;

        if (!Na__DrawPreset__Active) {
            Na__DrawPreset__SavedBackground   = Na__DrawPreset__Scene.background;
            Na__DrawPreset__SavedProfileState = Na__DrawProfile__IsEnabled();     // <-- Restored on Exit; see the note there
        }

        const setup = Na__DrawCfg__GetRenderSetup();

        // THE SCENE BACKGROUND IS REPLACED, not merely cleared. A project may
        // back its scene with the HDR environment itself, and an environment
        // texture behind a parallel drawing reads as a photograph the drawing is
        // floating on.
        Na__DrawPreset__Scene.background = new THREE.Color(setup.backgroundColour);

        Na__DrawPreset__Active = true;
        Na__DrawView__RenderPreset__ApplyStyles(styles);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Leave Drawing Presentation
    // ------------------------------------------------------------
    // RESTORING THE PROFILE-LINES PASS IS LOAD-BEARING, and it is the one thing
    // this module gets wrong if it is written carelessly. Enter forces the pass
    // ON for the drawing. An offscreen render - a Layout Editor viewport bake -
    // enters and exits without any 3D view being involved, so if Exit left the
    // pass forced on, the next 3D scene would silently gain edges the user had
    // switched off. ValeVision shipped exactly that bug and fixed it in v2.21.2.
    // ------------------------------------------------------------
    function Na__DrawView__RenderPreset__Exit() {
        if (!Na__DrawPreset__Active) return false;

        if (Na__DrawPreset__Scene && Na__DrawPreset__SavedBackground !== undefined) {
            Na__DrawPreset__Scene.background = Na__DrawPreset__SavedBackground;
        }
        if (Na__DrawPreset__SavedProfileState !== null) {
            Na__DrawProfile__SetEnabled(Na__DrawPreset__SavedProfileState);      // <-- Hand the user's own setting back
        }

        Na__DrawPreset__SavedBackground   = undefined;
        Na__DrawPreset__SavedProfileState = null;
        Na__DrawPreset__Styles            = null;
        Na__DrawPreset__Active            = false;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Styles
// -----------------------------------------------------------------------------

    // FUNCTION | Apply the Per-Drawing Style Toggles
    // ------------------------------------------------------------
    // Announces the change, because the projected linework overlay and the
    // Layout Editor both key their caches on the styles in force: a viewport
    // that does not hear about a toggle keeps showing the previous picture.
    // ------------------------------------------------------------
    function Na__DrawView__RenderPreset__ApplyStyles(styles) {
        const resolved = Na__DrawPreset__NormaliseStyles(styles);
        Na__DrawPreset__Styles = resolved;

        const setup = Na__DrawCfg__GetRenderSetup();

        Na__DrawProfile__SetEnabled(resolved.profileLinework && setup.profileEnabled !== false);
        if (Number.isFinite(setup.edgeWidth)) Na__DrawProfile__SetEdgeWidth(setup.edgeWidth);

        window.dispatchEvent(new CustomEvent('na-drawview-styles-changed', {
            detail : { styles : resolved }
        }));

        return resolved;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Frame
// -----------------------------------------------------------------------------

    // FUNCTION | Draw One Drawing Frame With the Given Camera
    // ------------------------------------------------------------
    // The same four steps the main render loop takes for an on-screen drawing,
    // in the same order and for the same reasons: the flat beauty render, then
    // the silhouette edges which BLEND ONTO it, then the cut fills which must
    // land on top so a poche stays solid. Markup is not drawn here - it is DOM,
    // and an offscreen render has no DOM to reproject onto.
    //
    // Exposed so the Layout Editor can bake a viewport through the identical
    // path the screen uses. A sheet that renders by a different route than the
    // screen is a sheet that prints differently than it previews.
    // ------------------------------------------------------------
    function Na__DrawView__RenderPreset__RenderFrame(camera) {
        if (!Na__DrawPreset__Renderer || !Na__DrawPreset__Scene || !camera) return false;

        Na__DrawPreset__Renderer.render(Na__DrawPreset__Scene, camera);           // <-- Flat, composer bypassed
        Na__DrawProfile__RenderOverlay(camera);                                   // <-- Silhouettes, blended onto the above
        Na__SectionCut__RenderOverlay(camera);                                    // <-- Cut fills, on top so poche stays solid
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Query
// -----------------------------------------------------------------------------

    // FUNCTION | Is a Drawing Being Presented?
    // ------------------------------------------------------------
    function Na__DrawView__RenderPreset__IsActive() {
        return Na__DrawPreset__Active;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Camera the Active Drawing Is Using
    // ------------------------------------------------------------
    // Deferred to the active view broker rather than held here. In ValeVision
    // the preset owns an orthographic camera because it has to hand one to the
    // composer's RenderPass; TrueVision's mode controllers build and own their
    // own, and the broker is the single place that knows which is live.
    // ------------------------------------------------------------
    function Na__DrawView__RenderPreset__GetCamera() {
        return Na__DrawView__ActiveCamera();
    }
    // ------------------------------------------------------------


    // FUNCTION | Overrides an Image Export Must Apply
    // ------------------------------------------------------------
    // The export path renders at a different size through a tiled renderer, and
    // needs to know which of the drawing's choices survive that. Line weight
    // does NOT scale with the tile: a drawing wants a constant weight on the
    // sheet at any zoom, which is what a drawn line has.
    // ------------------------------------------------------------
    function Na__DrawView__RenderPreset__GetExportOverrides() {
        const setup = Na__DrawCfg__GetRenderSetup();
        return {
            backgroundColour : setup.backgroundColour,
            edgeWidth        : setup.edgeWidth,
            edgeWidthScales  : false,
            profileEnabled   : Boolean(Na__DrawPreset__Styles && Na__DrawPreset__Styles.profileLinework),
            styles           : Na__DrawPreset__Styles
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Render Preset API (identical to ValeVision's composer preset)
    // ------------------------------------------------------------
    export {
        Na__DrawView__RenderPreset__Initialize,
        Na__DrawView__RenderPreset__Enter,
        Na__DrawView__RenderPreset__Exit,
        Na__DrawView__RenderPreset__ApplyStyles,
        Na__DrawView__RenderPreset__RenderFrame,
        Na__DrawView__RenderPreset__IsActive,
        Na__DrawView__RenderPreset__GetCamera,
        Na__DrawView__RenderPreset__GetExportOverrides
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
