// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - MATERIAL PRESET
// =============================================================================
//
// FILE       : Na__DrawView__MaterialPreset__.js
// NAMESPACE  : Na__DrawMat
// MODULE     : Drawing View Core - Material Preset
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Reversible material overrides for the Glass Transparency Off and Whitecard style toggles
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Two of the four per-drawing style toggles (plan decisions D33, D40) are
//   material matters rather than composer matters:
//     Glass Transparency Off  every transparent material is swapped for a
//                             flat opaque pane, so glazing reads as a solid
//                             panel with its SketchUp edges rather than as a
//                             see-through hole in the drawing.
//     Whitecard               under MaxEngine every indexed material is
//                             swapped for the whitecard material, so a drawing
//                             matches the PureEngine look whichever engine is
//                             live. PureEngine already renders whitecard.
// - EVERY SWAP IS STASHED ON THE MESH and put back on exit. The stash key is
//   this module's own, separate from the materials system's na_originalMaterial,
//   so the engine's own restore path never sees a drawing substitute and the
//   drawing never disturbs what the engine will restore.
// - Substitutes copy the original material's clip planes, so a cut applied
//   before the swap still slices them; the section adapter re-assigns the
//   planes afterwards as a second guard.
// - Both swaps walk the model once on entry and once on exit, never per frame.
//
// INTEGRATION:
// - Na__FloorPlan__ModeController__ and the elevation controller call Enter
//   after the composer preset and Exit before it.
// - The projection stage (Phase 4) reads the same toggles: with glass opaque
//   the glazing occludes; with it transparent the panes draw edges only.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 42__System__DrawingViewCore/Na__DrawView__MaterialPreset__.js 1.1.0
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment Phase B)
// - Parity        : adapted
// - Divergences   : WHITECARD IS NOT ENGINE-GATED HERE. ValeVision runs the whitecard swap only
//                   under MaxEngine, because its PureEngine already renders that look and the
//                   swap would be a no-op. TrueVision has a single render pipeline and no engine
//                   state to ask, so the swap always runs. On a project whose materials are
//                   already white this changes nothing; on one with indexed colour materials it
//                   does what the toggle says, which is the behaviour the control promises.
//                   The Na__RenderEngine__State import is dropped rather than stubbed - there is
//                   no such module in TrueVision and a stub would imply a split that does not exist.
// - Back-port     : no. ValeVision's gate is correct for ValeVision.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 09-Sep-2026 - Version 1.1.0
// - Substitute material values read from Na__DrawView__ConfigState__ (port
//   Phase 3) instead of a config block handed in at init.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 2.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Materials System Name Rules and Engine State
    // ------------------------------------------------------------
    import { Na__MaterialsSystem__IsIndexedName } from '../20__System__MaterialsSystem/Na__MaterialsSystem__LibraryLoader.js';
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Drawing Config
    // ------------------------------------------------------------
    // @delegate: ./Na__DrawView__ConfigState__.js
    // ------------------------------------------------------------
    import { Na__DrawCfg__GetMaterialSetup } from './Na__DrawView__ConfigState__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Stash Key
    // ------------------------------------------------------------
    const Na__DrawMat__STASH_KEY = 'Na__DrawPreset__OriginalMaterial';           // <-- Per-mesh stash, this module's own
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Injected References and Active State
    // ------------------------------------------------------------
    let Na__DrawMat__ModelRoot = null;
    let Na__DrawMat__Active    = false;
    let Na__DrawMat__Styles    = null;
    let Na__DrawMat__Touched   = [];      // <-- Meshes holding a stash, so exit walks only those
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Substitute Materials
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This Material Slot Transparent?
    // ------------------------------------------------------------
    // TRANSMISSION IS THE ONE THAT GETS MISSED. Glazing exported through
    // KHR_materials_transmission arrives as a MeshPhysicalMaterial with
    // transparent FALSE and opacity 1 - it is see-through because light passes
    // through it, not because the slot is blended. A detector that only asks
    // about transparent/opacity declares that glass opaque already, skips it,
    // and Glass Transparency Off leaves every window exactly as it was while
    // reporting success.
    //
    // ior alone is not enough to go on: plenty of opaque materials carry one.
    // transmission above zero is the property that actually means "you can see
    // through this".
    function Na__DrawMat__IsTransparent(material) {
        if (!material) return false;
        if (material.transparent === true) return true;
        if (typeof material.opacity === 'number' && material.opacity < 1.0) return true;
        if (typeof material.transmission === 'number' && material.transmission > 0) return true;
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Substitute That Inherits the Original's Clip Planes
    // ------------------------------------------------------------
    function Na__DrawMat__BuildSubstitute(original, colourHex) {
        const setup = Na__DrawCfg__GetMaterialSetup();
        const substitute = new THREE.MeshStandardMaterial({
            color               : new THREE.Color(colourHex),
            roughness           : setup.roughness,
            metalness           : setup.metalness,
            side                : original && original.side !== undefined ? original.side : THREE.DoubleSide,
            polygonOffset       : true,
            polygonOffsetFactor : setup.polygonOffsetFactor,
            polygonOffsetUnits  : setup.polygonOffsetUnits
        });
        if (original) {
            substitute.clippingPlanes   = original.clippingPlanes || null;       // <-- A cut applied before the swap still slices it
            substitute.clipIntersection = original.clipIntersection === true;
            substitute.clipShadows      = original.clipShadows === true;
        }
        substitute.name = original && original.name ? original.name : '';        // <-- Keeps the name rules (indexed, exempt) readable
        substitute.userData.Na__DrawPreset__Substitute = true;
        return substitute;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Swap Every Matching Slot on Every Mesh, Stashing the Originals
    // ------------------------------------------------------------
    // predicate(material) decides which slots change; colour is the flat
    // substitute colour. A mesh already stashed by an earlier pass keeps its
    // first stash, so two toggles never overwrite each other's originals.
    // ------------------------------------------------------------
    function Na__DrawMat__Swap(predicate, colourHex) {
        if (!Na__DrawMat__ModelRoot) return 0;
        let swapped = 0;

        Na__DrawMat__ModelRoot.traverse((node) => {
            if (!node.isMesh || !node.material) return;

            const resolve = (material) => {
                if (!predicate(material)) return material;
                swapped++;
                return Na__DrawMat__BuildSubstitute(material, colourHex);
            };

            const before = node.material;
            const after  = Array.isArray(before) ? before.map(resolve) : resolve(before);
            const changed = Array.isArray(before)
                ? after.some((m, i) => m !== before[i])
                : after !== before;
            if (!changed) return;

            if (node.userData[Na__DrawMat__STASH_KEY] === undefined) {
                node.userData[Na__DrawMat__STASH_KEY] = before;                  // <-- First stash wins
                Na__DrawMat__Touched.push(node);
            }
            node.material = after;
        });

        return swapped;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put Every Stashed Material Back and Drop the Substitutes
    // ------------------------------------------------------------
    function Na__DrawMat__RestoreAll() {
        for (let i = 0; i < Na__DrawMat__Touched.length; i++) {
            const node = Na__DrawMat__Touched[i];
            const current = node.material;
            const dispose = (m) => { if (m && m.userData && m.userData.Na__DrawPreset__Substitute) m.dispose(); };
            if (Array.isArray(current)) current.forEach(dispose); else dispose(current);

            node.material = node.userData[Na__DrawMat__STASH_KEY];
            delete node.userData[Na__DrawMat__STASH_KEY];
        }
        Na__DrawMat__Touched = [];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Apply the Material Toggles for a Drawing
    // ------------------------------------------------------------
    // styles: { glassOpaque, whitecard } - anything else is ignored here.
    // ------------------------------------------------------------
    function Na__DrawView__MaterialPreset__Enter(styles) {
        if (Na__DrawMat__Active) Na__DrawView__MaterialPreset__Exit();          // <-- Re-entry re-walks from a clean model
        // TWO KEY CONVENTIONS, as in the render preset. A drawing record spells
        // these Styles__GlassOpaque / Styles__Whitecard; a Layout Editor viewport
        // spells them glassOpaque / whitecard. Reading one convention only means
        // the other silently takes the defaults, and a ticked Glass Transparency
        // Off renders exactly as though it were not.
        const Na__DrawMat__Read = (recordKey, viewportKey, fallback) => {
            const src = styles || {};
            if (typeof src[recordKey]   === 'boolean') return src[recordKey];
            if (typeof src[viewportKey] === 'boolean') return src[viewportKey];
            return fallback;
        };
        Na__DrawMat__Styles = {
            glassOpaque : Na__DrawMat__Read('Styles__GlassOpaque', 'glassOpaque', false),
            whitecard   : Na__DrawMat__Read('Styles__Whitecard',   'whitecard',   true)
        };
        Na__DrawMat__Active = true;

        const setup = Na__DrawCfg__GetMaterialSetup();
        let swapped = 0;

        // WHITECARD | MaxEngine only; PureEngine is already the whitecard look
        if (Na__DrawMat__Styles.whitecard) {
            swapped += Na__DrawMat__Swap(
                (m) => m && Na__MaterialsSystem__IsIndexedName(m.name) && !Na__DrawMat__IsTransparent(m),
                setup.whitecardColour
            );
        }

        // GLASS TRANSPARENCY OFF | Every transparent slot, exempt glazing included
        if (Na__DrawMat__Styles.glassOpaque) {
            swapped += Na__DrawMat__Swap(
                (m) => Na__DrawMat__IsTransparent(m),
                setup.opaqueGlassColour
            );
        }

        if (swapped > 0) console.log('[TrueVision3D] Drawing material preset swapped ' + swapped + ' material slot(s).');
        Na__RenderLoop__RequestRender();
        return swapped;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put Every Material Back
    // ------------------------------------------------------------
    function Na__DrawView__MaterialPreset__Exit() {
        if (!Na__DrawMat__Active) return false;
        Na__DrawMat__RestoreAll();
        Na__DrawMat__Active = false;
        Na__DrawMat__Styles = null;
        Na__RenderLoop__RequestRender();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change the Toggles While a Drawing Is Up
    // ------------------------------------------------------------
    function Na__DrawView__MaterialPreset__ApplyStyles(styles) {
        if (!Na__DrawMat__Active) return false;
        const next = Object.assign({}, Na__DrawMat__Styles || {}, styles || {});
        Na__DrawView__MaterialPreset__Exit();
        Na__DrawView__MaterialPreset__Enter(next);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Preset Live?
    // ------------------------------------------------------------
    function Na__DrawView__MaterialPreset__IsActive() {
        return Na__DrawMat__Active;
    }
    // ------------------------------------------------------------


    // FUNCTION | Point the Preset at a Different Model Root
    // ------------------------------------------------------------
    function Na__DrawView__MaterialPreset__SetModelRoot(modelRoot) {
        Na__DrawMat__ModelRoot = modelRoot || null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize the Material Preset
    // ------------------------------------------------------------
    // context: { modelRoot }
    // ------------------------------------------------------------
    function Na__DrawView__MaterialPreset__Initialize(context) {
        Na__DrawMat__ModelRoot = (context && context.modelRoot) || null;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Material Preset API
    // ------------------------------------------------------------
    export {
        Na__DrawView__MaterialPreset__Initialize,
        Na__DrawView__MaterialPreset__Enter,
        Na__DrawView__MaterialPreset__Exit,
        Na__DrawView__MaterialPreset__ApplyStyles,
        Na__DrawView__MaterialPreset__IsActive,
        Na__DrawView__MaterialPreset__SetModelRoot
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
