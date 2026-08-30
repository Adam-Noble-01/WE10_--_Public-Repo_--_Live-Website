// =============================================================================
// TRUEVISION3D - CLICK TO OPEN DOORS ANIMATION
// =============================================================================
//
// FILE       : 3dObjectIInteraction__Animation__ClickToOpenDoors__.js
// NAMESPACE  : TrueVision3D
// MODULE     : 3D Object Interactions - Door Animation (Click to Open/Close)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Animate doors open/closed on click via scene graph naming convention
// CREATED    : 14-Feb-2026
//
// DESCRIPTION:
// - Scans the loaded GLB scene graph for door assemblies (ADR prefix).
// - Classifies each MOD child as ROT_ONLY, ROT_MVE, MVE_ONLY, or FIXED.
// - Builds a per-ADR panels[] array so single, bifold, and sliding doors share
//   one animation pipeline.
// - Locates ROT rotation point objects to determine hinge pivot positions
//   (one ROT marker per rotating MOD, paired by index for bifold cascades).
// - Resolves MVE axis (X/Y/Z) and signed mm magnitude to a local axis-aligned
//   translation vector for sliding panels and bifold slave panels.
// - Registers pointer event handlers for click detection (with orbit drag filtering).
// - Smoothly animates every lockstep door using a unified [0..1] progress value
//   while explicitly configured ExteriorDoubleDoor ADRs use per-panel progress.
// - Supports mid-animation reversal at door or independent-panel level.
// - Dual model support: animates both mesh and linework models simultaneously.
//
// NAMING CONVENTION (Scene Graph):
// - ADR = Door Assembly (e.g. ADR002__InternalDoor or ADR007__BifoldDoor or ADR009__SlidingDoor)
// - MOD = Modifier object, classified by tags inside the name:
//     * MOD###__ROT__<deg>-Deg__<tag>                                     -> ROT_ONLY (interior + bifold master)
//     * MOD###__ROT__<deg>-Deg__MVE__<axis><signed-mm>-mm__<tag>         -> ROT_MVE  (bifold slave panels)
//     * MOD###__MVE__<axis><signed-mm>-mm__<tag>                         -> MVE_ONLY (sliding moving leaves)
//     * MOD###__FIXED__<tag>                                              -> FIXED   (sliding fixed leaves, never animated)
// - ROT = Rotation/Hinge Point marker (e.g. ROT001__RotationPoint__DoorHingeCentre)
// - MVE = Movement Track marker (e.g. MVE001__MovementPoint__SlidingPanelTrack) - informational only,
//         the canonical MVE axis + magnitude is parsed from the MOD name.
//
// INTEGRATION:
// - Requires door models exported with hierarchy preservation from SketchUp
//   GLB Builder Utility (v1.5.0+) with door handler module.
// - Expects glTF nodes in Y-up coordinate space with conjugated transforms.
// - Call Na__DoorAnimation__Initialize() after GLB models are loaded.
// - Call Na__DoorAnimation__Update(deltaMs) every frame in render loop.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 30-Aug-2026 - Version 1.8.0
// - Click detection is now LEFT BUTTON ONLY. The handlers previously bound
//   pointerdown/pointerup with no button check, so a stationary right-click
//   toggled a door as well. The right button belongs to the Orbit pan gesture
//   and now to the Context Menu System, which surfaces Open / Close Door as a
//   menu row instead. Left-click behaviour is unchanged.
// - Exported Na__DoorAnim__FindAdrAncestor and Na__DoorAnim__ResolveHitPanel so
//   the Context Menu System can resolve a hit to a door without duplicating the
//   ancestor-walk logic, plus a new read-only Na__DoorAnim__IsDoorOpen() used to
//   label the menu row Open or Close. No behavioural change to animation.
//
// 10-Jul-2026 - Version 1.7.0
// - Added config-gated independent panel animation for ADR names containing an
//   approved token (default: ExteriorDoubleDoor). Existing interior, bifold,
//   sliding, and unknown ADRs remain lockstep.
// - Added nearest-MOD hit resolution, per-panel animation state/reversal, and
//   ADR-level compatibility aliases sourced from the primary panel.
//
// 06-Jun-2026 - Version 1.6.0
// - Fixed interior doors swinging inverted in TV. The interior door system
//   (Element Assembly Studio) predates the bifold system and derives its MOD
//   rotation sign from pure SketchUp geometric logic. The bifold/sliding sign
//   convention was later calibrated empirically against TrueVision's actual
//   rendered swing (see ExtFold AllOneWay devlog v1.7.2 "now swings OUTWARD
//   +90 instead of into the room -90"). Interior doors never got that
//   calibration, so they animate 180deg inverted in TV while bifold is correct.
//   Added Na__DoorAnim__ResolveInteriorInversionSign(): when AppConfig flag
//   `InteriorRotationInverted` is true (default), doors whose ADR name contains
//   'InteriorDoor' get a -1 rotation sign so they match the TV-correct bifold
//   convention. Folded into panel.rotationSign alongside the mirror sign.
//   Reversible via AppConfig; no GLB re-export required.
//
// 06-Jun-2026 - Version 1.5.0
// - Fixed mirrored doors swinging 180 degrees the wrong way. Doors that are
//   mirror-copied (or sit under a mirrored storey container) carry a negative-
//   determinant world transform; the fixed local +Y rotation then reverses in
//   world space. Added Na__DoorAnim__ResolveMirrorSign() which inspects the
//   ADR world-matrix determinant and stores panel.rotationSign (-1 when
//   mirrored). ApplyPanelTransform multiplies the swing angle by this sign.
//   Non-mirrored doors are unchanged (+1). MVE translation is deliberately not
//   sign-corrected (panel + track are mirrored together and stay consistent).
//
// 06-Jun-2026 - Version 1.4.0
// - Removed dead legacy exports Na__DoorAnim__FindModRotChild and
//   Na__DoorAnim__ApplyPivotRotation. Both were superseded in v1.2.0 by
//   FindAllAnimatableMods and the progress-based ApplyAllPanels path, but
//   were retained as "backward compat" exports with no known callers.
//
// 17-May-2026 - Version 1.3.0
// - Bifold doors now animate at a slowed-down speed proportional to the new
//   AppConfig key `BifoldDurationMultiplier` (default 3.0). The effective
//   per-door duration is resolved at scan time by sniffing for ROT_MVE
//   panels (the unambiguous bifold-slave signature) and applied for both
//   forward and reversed animations. Single hinged doors and sliding doors
//   retain the base AnimationDurationMs unchanged.
//
// 17-May-2026 - Version 1.2.0
// - Multi-panel door support added: bifold (multi-MOD with rotation+translation
//   cascades) and sliding (MVE-only moving leaves + FIXED leaves) now animate
//   alongside the legacy single ROT-only interior door behaviour.
// - Replaced angle-based animation state (currentAngleRad / animStartAngleRad)
//   with a unified [0..1] progress so mixed ROT/MVE cascades stay synchronised.
// - Introduced AppConfig kill-switch `MultiPanelEnabled` (default true).
//
// 28-Feb-2026 - Version 1.1.0
// - Added Na__DoorAnimation__RebindModelGroups() for safe model-group switching.
// - Door registry now refreshes against newly loaded model roots without
//   duplicating pointer listeners.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Three.js Core Imports
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Render Loop Invalidation
    // ------------------------------------------------------------
    import { Na__RenderLoop__RequestRender } from '../05__RenderPipeline/Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------


    // MODULE IMPORTS | Math / Unit Conversion (mm -> Three.js units)
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Configuration
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Naming Convention Prefixes
    // ------------------------------------------------------------
    const Na__DoorAnim__PREFIX_ADR             = 'ADR';                          // <-- Door assembly prefix
    const Na__DoorAnim__PREFIX_MOD             = 'MOD';                          // <-- Modifier object prefix
    const Na__DoorAnim__PREFIX_ROT             = 'ROT';                          // <-- Rotation point prefix
    const Na__DoorAnim__MOD_ROT_TAG            = '__ROT__';                      // <-- Rotation modifier tag in MOD name
    const Na__DoorAnim__MOD_MVE_TAG            = '__MVE__';                      // <-- Translation modifier tag in MOD name
    const Na__DoorAnim__MOD_FIXED_TAG          = '__FIXED__';                    // <-- Fixed (non-animated) modifier tag in MOD name
    const Na__DoorAnim__DEG_REGEX              = /(-?\d+)-Deg/i;                  // <-- Regex to extract degrees from MOD name (supports negative)
    const Na__DoorAnim__MVE_REGEX              = /__MVE__([XYZ])([+\-]\d+)-mm/i; // <-- Regex to extract MVE axis + signed mm magnitude
    const Na__DoorAnim__Y_AXIS                 = new THREE.Vector3(0, 1, 0);     // <-- Vertical rotation axis (Y-up from GLB Builder export)
    const Na__DoorAnim__X_AXIS                 = new THREE.Vector3(1, 0, 0);     // <-- Local X axis (panel slide direction in SketchUp authoring)
    const Na__DoorAnim__Z_AXIS                 = new THREE.Vector3(0, 0, 1);     // <-- Local Z axis (depth axis after Z-up -> Y-up conjugation)
    // ------------------------------------------------------------


    // MODULE CONSTANTS | MOD Animation Type Tags
    // ------------------------------------------------------------
    const Na__DoorAnim__MOD_TYPE_ROT_ONLY      = 'ROT_ONLY';                     // <-- MOD###__ROT__<deg>-Deg__<tag>
    const Na__DoorAnim__MOD_TYPE_ROT_MVE       = 'ROT_MVE';                      // <-- MOD###__ROT__<deg>-Deg__MVE__<axis><signed-mm>-mm__<tag>
    const Na__DoorAnim__MOD_TYPE_MVE_ONLY      = 'MVE_ONLY';                     // <-- MOD###__MVE__<axis><signed-mm>-mm__<tag>
    const Na__DoorAnim__MOD_TYPE_FIXED         = 'FIXED';                        // <-- MOD###__FIXED__<tag>
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Door State Enum
    // ------------------------------------------------------------
    const Na__DoorAnim__STATE_CLOSED           = 'CLOSED';                       // <-- Door is fully closed
    const Na__DoorAnim__STATE_OPENING          = 'OPENING';                      // <-- Door is animating open
    const Na__DoorAnim__STATE_OPEN             = 'OPEN';                         // <-- Door is fully open
    const Na__DoorAnim__STATE_CLOSING          = 'CLOSING';                      // <-- Door is animating closed
    // ------------------------------------------------------------


    // MODULE VARIABLES | Configuration Defaults (overridden by config)
    // ------------------------------------------------------------
    let Na__DoorAnim__Config__AnimationDurationMs       = 600;                   // <-- Base animation duration (single hinged + sliding doors)
    let Na__DoorAnim__Config__BifoldDurationMultiplier  = 3.0;                   // <-- Bifold-only duration scaler (V1.3.0); detected via ROT_MVE panel
    let Na__DoorAnim__Config__DefaultRotationDeg        = 90;                    // <-- Default rotation if parse fails
    let Na__DoorAnim__Config__ClickThresholdPx          = 4;                     // <-- Max pointer movement for click
    let Na__DoorAnim__Config__MultiPanelEnabled         = true;                  // <-- Bifold/sliding kill-switch (AppConfig source-of-truth)
    let Na__DoorAnim__Config__InteriorRotationInverted  = true;                  // <-- V1.6.0: interior doors use legacy SU-logic sign; invert to match TV (bifold-calibrated) convention
    let Na__DoorAnim__Config__IndependentPanelsEnabled  = true;                  // <-- Exterior-double independent-panel kill-switch
    let Na__DoorAnim__Config__IndependentPanelAdrNameTokens = ['ExteriorDoubleDoor']; // <-- Explicit ADR tokens allowed to animate independently
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Interior Door Name Token (for rotation-inversion targeting)
    // ------------------------------------------------------------
    // The interior door system (Element Assembly Studio) predates the bifold
    // system and derives its MOD rotation sign from pure SketchUp geometric
    // logic. The bifold sign convention was later calibrated empirically
    // against what TrueVision actually renders (see ExtFold AllOneWay devlog
    // v1.7.2). Interior doors therefore animate inverted in TV. We detect them
    // by the ADR name token and flip their rotation sign to land on the same
    // TV-correct convention. Exterior/bifold/sliding doors are unaffected.
    const Na__DoorAnim__INTERIOR_DOOR_NAME_TOKEN = 'InteriorDoor';               // <-- ADR name substring identifying interior doors
    const Na__DoorAnim__BIFOLD_DOOR_NAME_TOKEN   = 'BifoldDoor';                 // <-- Explicit lockstep product token
    const Na__DoorAnim__SLIDING_DOOR_NAME_TOKEN  = 'SlidingDoor';                // <-- Explicit lockstep product token
    const Na__DoorAnim__COUPLING_LOCKSTEP        = 'LOCKSTEP';                   // <-- Whole ADR shares one state/progress
    const Na__DoorAnim__COUPLING_INDEPENDENT     = 'INDEPENDENT';                // <-- Each animatable MOD owns state/progress
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Core References
    // ------------------------------------------------------------
    let Na__DoorAnim__Scene               = null;                                // <-- Three.js scene reference
    let Na__DoorAnim__Camera              = null;                                // <-- Three.js camera reference
    let Na__DoorAnim__RendererDomElement  = null;                                // <-- Renderer canvas DOM element
    let Na__DoorAnim__ModelGroupsMesh     = [];                                  // <-- Array of mesh model groups (solid geometry)
    let Na__DoorAnim__ModelGroupsLinework = [];                                  // <-- Array of linework model groups (edges)
    let Na__DoorAnim__Initialized         = false;                               // <-- Module initialization flag
    // ------------------------------------------------------------


    // MODULE VARIABLES | Raycaster and Pointer State
    // ------------------------------------------------------------
    const Na__DoorAnim__Raycaster        = new THREE.Raycaster();                // <-- Reusable raycaster
    const Na__DoorAnim__PointerNDC       = new THREE.Vector2();                  // <-- Normalized device coordinates
    let Na__DoorAnim__PointerDownX       = 0;                                    // <-- Pointer X at pointerdown
    let Na__DoorAnim__PointerDownY       = 0;                                    // <-- Pointer Y at pointerdown
    let Na__DoorAnim__PointerIsDown      = false;                                // <-- Pointer currently pressed
    // ------------------------------------------------------------


    // MODULE VARIABLES | Door Registry
    // ------------------------------------------------------------
    const Na__DoorAnim__DoorRegistry     = new Map();                            // <-- Map<adrName, doorRecord>
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Graph Scanning and Name Parsing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Parse Rotation Degrees from MOD Object Name
    // ------------------------------------------------------------
    function Na__DoorAnim__ParseDegreesFromName(modName) {
        const match = Na__DoorAnim__DEG_REGEX.exec(modName);                     // <-- Match XX-Deg pattern

        if (match && match[1]) {
            const degrees = parseInt(match[1], 10);                              // <-- Parse integer degrees
            if (Number.isFinite(degrees) && degrees !== 0) {
                return degrees;                                                  // <-- Return parsed value (positive or negative)
            }
        }

        console.warn(`[DoorAnimation] Could not parse degrees from MOD name: "${modName}", using default ${Na__DoorAnim__Config__DefaultRotationDeg}`);
        return Na__DoorAnim__Config__DefaultRotationDeg;                         // <-- Fallback to config default
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Check if Object Name Starts with Prefix
    // ------------------------------------------------------------
    function Na__DoorAnim__NameStartsWith(object, prefix) {
        return object.name && object.name.startsWith(prefix);                    // <-- Simple prefix check
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Find Child Object by Name Prefix
    // ------------------------------------------------------------
    function Na__DoorAnim__FindChildByPrefix(parentObject, prefix) {
        for (const child of parentObject.children) {
            if (Na__DoorAnim__NameStartsWith(child, prefix)) {
                return child;                                                    // <-- Return first match
            }
        }
        return null;                                                             // <-- No match found
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build a Readable Scene Path for Diagnostics
    // ------------------------------------------------------------
    function Na__DoorAnim__BuildDiagnosticPath(object, stopRoot) {
        const pathParts = [];
        let current = object;

        while (current) {
            pathParts.unshift(current.name || current.type || '[unnamed]');
            if (current === stopRoot) break;
            current = current.parent;
        }

        return pathParts.join(' > ');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | List Direct Child Names for Diagnostics
    // ------------------------------------------------------------
    function Na__DoorAnim__ListDirectChildNames(object) {
        if (!object || !Array.isArray(object.children)) return '(no children)';

        return object.children
            .map((child) => child.name || child.type || '[unnamed]')
            .join(', ');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Classify a MOD Object by its Name
    // ------------------------------------------------------------
    // Returns one of MOD_TYPE_ROT_ONLY | ROT_MVE | MVE_ONLY | FIXED, or null if unrecognised.
    // Order matters: __ROT__ + __MVE__ must be checked before plain __ROT__.
    function Na__DoorAnim__ClassifyMod(modName) {
        if (!modName) return null;
        const hasRot   = modName.indexOf(Na__DoorAnim__MOD_ROT_TAG)   !== -1;
        const hasMve   = modName.indexOf(Na__DoorAnim__MOD_MVE_TAG)   !== -1;
        const hasFixed = modName.indexOf(Na__DoorAnim__MOD_FIXED_TAG) !== -1;

        if (hasRot && hasMve) return Na__DoorAnim__MOD_TYPE_ROT_MVE;             // <-- Bifold slave: rotates + slides
        if (hasRot)           return Na__DoorAnim__MOD_TYPE_ROT_ONLY;            // <-- Interior / bifold master / hinged
        if (hasMve)           return Na__DoorAnim__MOD_TYPE_MVE_ONLY;            // <-- Sliding moving leaf
        if (hasFixed)         return Na__DoorAnim__MOD_TYPE_FIXED;               // <-- Sliding fixed leaf (no animation)
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Parse MVE Axis + Signed Magnitude from MOD Name
    // ------------------------------------------------------------
    // Returns { axis: 'X'|'Y'|'Z', signedMm: <signed integer> } or null if not present.
    function Na__DoorAnim__ParseMveFromName(modName) {
        const match = Na__DoorAnim__MVE_REGEX.exec(modName);
        if (!match) return null;

        const axis     = match[1].toUpperCase();                                 // <-- X | Y | Z
        const signedMm = parseInt(match[2], 10);                                 // <-- Signed integer mm (e.g. +1200, -600)
        if (!Number.isFinite(signedMm)) return null;
        return { axis: axis, signedMm: signedMm };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve SketchUp Axis Letter to Three.js Local Axis Vector
    // ------------------------------------------------------------
    // GLB exporter conjugates SketchUp Z-up to Three.js Y-up. SketchUp local X
    // remains Three.js local X. SketchUp local Z (vertical) becomes Three.js Y.
    // SketchUp local Y becomes Three.js -Z (handedness flip is absorbed in the
    // node's local quaternion). For our axis-letter parsing we use the *local*
    // axes of the parent ADR component, which the engine has already aligned.
    function Na__DoorAnim__ResolveAxisVector(axisLetter) {
        switch (axisLetter) {
            case 'X': return Na__DoorAnim__X_AXIS;                               // <-- Panel slide direction (along door head)
            case 'Y': return Na__DoorAnim__Y_AXIS;                               // <-- Vertical (rare for translation)
            case 'Z': return Na__DoorAnim__Z_AXIS;                               // <-- Front/back depth
            default:
                console.warn(`[DoorAnimation] Unknown axis letter "${axisLetter}", defaulting to X`);
                return Na__DoorAnim__X_AXIS;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Find All Animatable MOD Children of an ADR Object
    // ------------------------------------------------------------
    // Returns an ordered array of { mod, type } descriptors. Used in place of
    // the legacy Na__DoorAnim__FindModRotChild() which only ever returned the
    // first ROT-tagged MOD. Multi-panel doors (bifold + sliding) require us to
    // collect every MOD child so each can be animated independently.
    //
    // When the AppConfig kill-switch `MultiPanelEnabled` is false, only the
    // first ROT-only MOD is returned, mirroring the pre-multi-panel behaviour.
    function Na__DoorAnim__FindAllAnimatableMods(adrObject) {
        const descriptors = [];
        for (const child of adrObject.children) {
            if (!Na__DoorAnim__NameStartsWith(child, Na__DoorAnim__PREFIX_MOD)) continue;
            const type = Na__DoorAnim__ClassifyMod(child.name);
            if (!type) continue;                                                 // <-- Unknown / legacy MOD pattern
            descriptors.push({ mod: child, type: type });
        }

        if (Na__DoorAnim__Config__MultiPanelEnabled !== true) {
            const firstRotOnly = descriptors.find((d) => d.type === Na__DoorAnim__MOD_TYPE_ROT_ONLY);
            return firstRotOnly ? [firstRotOnly] : [];
        }

        return descriptors;
    }
    // ------------------------------------------------------------




    // HELPER FUNCTION | Detect Whether a Panel Set Belongs to a Bifold Door
    // ------------------------------------------------------------
    // Bifold doors are the only door type that emits ROT_MVE panels (slave
    // leaves that simultaneously rotate AND translate along the head track).
    // Single hinged doors emit ROT_ONLY only; sliding doors emit MVE_ONLY +
    // FIXED only. A ROT_MVE sighting therefore unambiguously identifies a
    // bifold assembly. V1.3.0 uses this to stretch the animation duration so
    // the user can follow the cascade as the panels accordion-fold.
    function Na__DoorAnim__IsBifoldDoor(panels) {
        if (!Array.isArray(panels)) return false;
        for (let i = 0; i < panels.length; i++) {
            if (panels[i].type === Na__DoorAnim__MOD_TYPE_ROT_MVE) return true;
        }
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Check ADR Name for a Configured Token
    // ------------------------------------------------------------
    function Na__DoorAnim__AdrNameContainsToken(adrName, tokens) {
        if (typeof adrName !== 'string' || !Array.isArray(tokens)) return false;
        return tokens.some((token) => typeof token === 'string' && token.length > 0 && adrName.indexOf(token) !== -1);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve Door Panel Coupling Mode
    // ------------------------------------------------------------
    // Classification is deliberately explicit and backward compatible:
    // configured exterior-double token first, then every known/legacy shape
    // falls back to lockstep. Two ROT_ONLY panels alone never imply independence.
    function Na__DoorAnim__ResolveCouplingMode(adrName, panels) {
        const hasIndependentToken = Na__DoorAnim__AdrNameContainsToken(
            adrName,
            Na__DoorAnim__Config__IndependentPanelAdrNameTokens
        );

        if (Na__DoorAnim__Config__IndependentPanelsEnabled === true && hasIndependentToken) {
            return Na__DoorAnim__COUPLING_INDEPENDENT;
        }
        if (Na__DoorAnim__IsBifoldDoor(panels)) return Na__DoorAnim__COUPLING_LOCKSTEP;
        if (Na__DoorAnim__AdrNameContainsToken(adrName, [Na__DoorAnim__INTERIOR_DOOR_NAME_TOKEN])) {
            return Na__DoorAnim__COUPLING_LOCKSTEP;
        }
        if (Na__DoorAnim__AdrNameContainsToken(adrName, [Na__DoorAnim__BIFOLD_DOOR_NAME_TOKEN])) {
            return Na__DoorAnim__COUPLING_LOCKSTEP;
        }
        if (Na__DoorAnim__AdrNameContainsToken(adrName, [Na__DoorAnim__SLIDING_DOOR_NAME_TOKEN])) {
            return Na__DoorAnim__COUPLING_LOCKSTEP;
        }
        return Na__DoorAnim__COUPLING_LOCKSTEP;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve the Effective Animation Duration for a Door Type
    // ------------------------------------------------------------
    // Bifold cascades animate at AnimationDurationMs * BifoldDurationMultiplier
    // (V1.3.0 default 3.0). Everything else uses the base AnimationDurationMs.
    function Na__DoorAnim__ResolveEffectiveDurationMs(panels) {
        if (!Na__DoorAnim__IsBifoldDoor(panels)) return Na__DoorAnim__Config__AnimationDurationMs;
        const multiplier = Number.isFinite(Na__DoorAnim__Config__BifoldDurationMultiplier) && Na__DoorAnim__Config__BifoldDurationMultiplier > 0
            ? Na__DoorAnim__Config__BifoldDurationMultiplier
            : 1.0;
        return Math.round(Na__DoorAnim__Config__AnimationDurationMs * multiplier);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve Mirror Sign From a Door's World Transform
    // ------------------------------------------------------------
    // The animation rotates each MOD about the door's LOCAL +Y axis. That
    // local rotation only maps to the intended WORLD swing direction when the
    // ADR's accumulated world matrix is a proper rotation (determinant > 0).
    //
    // Mirrored door instances (e.g. a door modelled once and mirror-copied to
    // the opposite room, or a mirrored storey container) carry a NEGATIVE
    // determinant. A mirror turns right-handed rotations into left-handed ones
    // (M · R(theta) · M^-1 = R(-theta) when the mirror plane contains the up
    // axis), so the fixed local +Y rotation appears reversed in world space and
    // the door swings 180 degrees the wrong way.
    //
    // We compensate by returning -1 for mirrored doors so the caller negates the
    // rotation angle, restoring the intended world swing. Non-mirrored doors
    // (determinant >= 0) return +1 and are unaffected. The determinant sign is
    // static for the life of the door (animation never changes scale), so this
    // is resolved once at scan time. MVE translation is intentionally NOT sign-
    // corrected: the panel and its track are mirrored together, so the local
    // translation already lands on the correct (mirrored) side.
    function Na__DoorAnim__ResolveMirrorSign(adrObject) {
        if (!adrObject) return 1;
        adrObject.updateWorldMatrix(true, false);                                // <-- Ensure ancestor + self world matrix current
        const determinant = adrObject.matrixWorld.determinant();                 // <-- Sign of 4x4 == sign of upper-left 3x3 for affine
        return determinant < 0 ? -1 : 1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve Interior-Door Rotation Inversion Sign
    // ------------------------------------------------------------
    // Interior doors (older Element Assembly Studio system) encode their MOD
    // rotation sign from pure SketchUp geometric logic, which renders inverted
    // in TrueVision. The bifold/sliding systems were calibrated against TV and
    // render correctly. When the AppConfig flag is enabled (default), interior
    // doors get a -1 sign so they swing the correct way, matching bifold.
    // Detection is by ADR name token so only interior doors are affected.
    function Na__DoorAnim__ResolveInteriorInversionSign(adrObject) {
        if (Na__DoorAnim__Config__InteriorRotationInverted !== true) return 1;
        if (!adrObject || !adrObject.name) return 1;
        return adrObject.name.indexOf(Na__DoorAnim__INTERIOR_DOOR_NAME_TOKEN) !== -1 ? -1 : 1;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Build a Single Panel Descriptor From a MOD Object
    // ------------------------------------------------------------
    // Captures everything needed to animate one panel back and forth in the
    // 0..1 progress space used by the multi-panel applier. Type-specific
    // fields (targetAngleRad / pivotLocalPosition / mveAxisVector / mveDistanceUnits)
    // are populated only when relevant for the descriptor's animation type.
    function Na__DoorAnim__BuildPanelDescriptor(adrObject, descriptor) {
        const modObject  = descriptor.mod;
        const type       = descriptor.type;

        const panel = {
            type               : type,
            modObjectMesh      : modObject,
            modObjectLinework  : null,                                           // <-- Linked later by linework scan
            rotObjectMesh      : null,                                           // <-- Matching ROT marker used by independent proximity
            rotObjectLinework  : null,                                           // <-- Matching linework ROT marker
            initialPosition    : modObject.position.clone(),                     // <-- MOD initial local position
            initialQuaternion  : modObject.quaternion.clone(),                   // <-- MOD initial local quaternion
            targetAngleRad     : 0,                                              // <-- Populated for ROT_ONLY / ROT_MVE
            pivotLocalPosition : null,                                           // <-- Populated for ROT_ONLY / ROT_MVE
            rotationSign       : 1,                                              // <-- -1 for mirrored doors (corrects reversed swing)
            mveAxisVector      : null,                                           // <-- Populated for ROT_MVE / MVE_ONLY
            mveDistanceUnits   : 0,                                              // <-- Signed distance in Three.js scene units
            state              : Na__DoorAnim__STATE_CLOSED,                    // <-- Independent-panel state
            currentProgress    : 0,                                              // <-- Independent open fraction [0..1]
            animStartProgress  : 0,                                              // <-- Independent animation start
            animEndProgress    : 0,                                              // <-- Independent animation target
            animElapsedMs      : 0,                                              // <-- Independent elapsed animation time
            animDurationMs     : Na__DoorAnim__Config__AnimationDurationMs,      // <-- Independent effective duration
            proximityIsNear    : false                                           // <-- Per-panel Walk/Fly proximity state
        };

        if (type === Na__DoorAnim__MOD_TYPE_ROT_ONLY || type === Na__DoorAnim__MOD_TYPE_ROT_MVE) {
            const targetAngleDeg = Na__DoorAnim__ParseDegreesFromName(modObject.name);
            panel.targetAngleRad = THREE.MathUtils.degToRad(targetAngleDeg);
            // Combine mirror compensation (geometry handedness) with interior-door
            // inversion (legacy SU-logic sign vs TV-calibrated bifold convention).
            panel.rotationSign   = Na__DoorAnim__ResolveMirrorSign(adrObject)
                                 * Na__DoorAnim__ResolveInteriorInversionSign(adrObject);

            // Each rotating MOD is paired with the next ROT### sibling under the ADR.
            // We search the ADR's children index-by-index so multi-MOD doors
            // (bifold) get one ROT pivot per MOD in declaration order.
            const rotSibling = Na__DoorAnim__FindMatchingRotSibling(adrObject, modObject);
            if (rotSibling) {
                panel.rotObjectMesh = rotSibling;
                panel.pivotLocalPosition = rotSibling.position.clone();
            } else {
                console.warn(`[DoorAnimation] No ROT sibling found for MOD "${modObject.name}" - falling back to MOD origin`);
                panel.pivotLocalPosition = new THREE.Vector3(0, 0, 0);
            }
        }

        if (type === Na__DoorAnim__MOD_TYPE_ROT_MVE || type === Na__DoorAnim__MOD_TYPE_MVE_ONLY) {
            const mve = Na__DoorAnim__ParseMveFromName(modObject.name);
            if (mve) {
                panel.mveAxisVector    = Na__DoorAnim__ResolveAxisVector(mve.axis);
                panel.mveDistanceUnits = Na__Math__ConvertMmToUnits(mve.signedMm);
            } else {
                console.warn(`[DoorAnimation] Could not parse MVE from MOD name "${modObject.name}"`);
            }
        }

        return panel;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Find the Nth ROT### Marker Sibling for the Nth Rotating MOD
    // ------------------------------------------------------------
    // Bifold doors place ROT001, ROT002... markers as flat siblings of the
    // MOD001, MOD003 (rotating) panels. Sliding doors only have a placeholder
    // ROT001 (which is unused). This function finds the ROT marker whose
    // *position index* among ROT siblings matches the rotating-MOD position
    // index. That keeps the pairing deterministic regardless of authoring order.
    function Na__DoorAnim__FindMatchingRotSibling(adrObject, modObject) {
        const allRotSiblings    = [];
        const rotatingModSiblings = [];
        for (const child of adrObject.children) {
            if (Na__DoorAnim__NameStartsWith(child, Na__DoorAnim__PREFIX_ROT)) {
                allRotSiblings.push(child);
                continue;
            }
            if (Na__DoorAnim__NameStartsWith(child, Na__DoorAnim__PREFIX_MOD)) {
                const t = Na__DoorAnim__ClassifyMod(child.name);
                if (t === Na__DoorAnim__MOD_TYPE_ROT_ONLY || t === Na__DoorAnim__MOD_TYPE_ROT_MVE) {
                    rotatingModSiblings.push(child);
                }
            }
        }

        const modIndex = rotatingModSiblings.indexOf(modObject);
        if (modIndex === -1) return null;

        // Prefer a 1:1 positional pairing
        if (modIndex < allRotSiblings.length) {
            return allRotSiblings[modIndex];
        }

        // Fallback: re-use the first available ROT sibling
        return allRotSiblings.length > 0 ? allRotSiblings[0] : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Scan Scene Graph and Build Door Registry
    // ------------------------------------------------------------
    function Na__DoorAnimation__ScanForDoors() {
        Na__DoorAnim__DoorRegistry.clear();                                      // <-- Clear previous registry

        if (Na__DoorAnim__ModelGroupsMesh.length === 0 && Na__DoorAnim__ModelGroupsLinework.length === 0) {
            console.warn('[DoorAnimation] No model groups set, cannot scan for doors');
            return;
        }

        // Scan all mesh model groups for ADR assemblies
        for (const meshGroup of Na__DoorAnim__ModelGroupsMesh) {
            meshGroup.traverse((object) => {
                if (!Na__DoorAnim__NameStartsWith(object, Na__DoorAnim__PREFIX_ADR)) {
                    return;                                                      // <-- Skip non-ADR objects
                }

                const adrName = object.name;                                     // <-- Door assembly identifier

                // Collect every animatable MOD child (multi-panel ready)
                const modDescriptors = Na__DoorAnim__FindAllAnimatableMods(object);
                if (modDescriptors.length === 0) {
                    const diagnosticPath = Na__DoorAnim__BuildDiagnosticPath(object, meshGroup);
                    const childNames     = Na__DoorAnim__ListDirectChildNames(object);
                    console.warn(`[DoorAnimation] ADR "${adrName}" (mesh) has no animatable MOD children, skipping. Path="${diagnosticPath}". Direct children=[${childNames}]`);
                    return;
                }

                // Build panel descriptors (one per MOD, including FIXED leaves)
                const panels = modDescriptors.map((d) => Na__DoorAnim__BuildPanelDescriptor(object, d));

                // Find the *first* ROT child (used by Walk Mode proximity for distance checks).
                // For bifold doors this is ROT001, for interior doors it is the only ROT marker.
                const firstRotObject = Na__DoorAnim__FindChildByPrefix(object, Na__DoorAnim__PREFIX_ROT);

                // Resolve the primary rotating panel for backward-compat fields.
                // (Walk Mode reads doorRecord.targetAngleRad on legacy single-door records.)
                const primaryRotPanel = panels.find((p) =>
                    p.type === Na__DoorAnim__MOD_TYPE_ROT_ONLY || p.type === Na__DoorAnim__MOD_TYPE_ROT_MVE
                );
                const targetAngleRad = primaryRotPanel ? primaryRotPanel.targetAngleRad : 0;

                // Resolve per-door effective duration. Bifolds are slowed down
                // by `BifoldDurationMultiplier` (V1.3.0); all other doors use
                // the base AnimationDurationMs verbatim.
                const isBifold              = Na__DoorAnim__IsBifoldDoor(panels);
                const effectiveDurationMs   = Na__DoorAnim__ResolveEffectiveDurationMs(panels);
                const couplingMode          = Na__DoorAnim__ResolveCouplingMode(adrName, panels);
                const isIndependentPanels   = couplingMode === Na__DoorAnim__COUPLING_INDEPENDENT;

                panels.forEach((panel) => {
                    panel.animDurationMs = effectiveDurationMs;
                });

                // Build door record
                const doorRecord = {
                    adrObjectMesh      : object,                                 // <-- Door assembly Object3D (mesh)
                    adrObjectLinework  : null,                                   // <-- Door assembly Object3D (linework) - found later
                    adrName            : adrName,                                // <-- Door assembly name
                    panels             : panels,                                 // <-- NEW: multi-panel descriptor array
                    rotObjectMesh      : firstRotObject,                         // <-- First ROT (for Walk Mode proximity world position)
                    rotObjectLinework  : null,                                   // <-- Linework first ROT (linked later)
                    isBifold           : isBifold,                               // <-- True when any panel is ROT_MVE (V1.3.0)
                    effectiveDurationMs: effectiveDurationMs,                    // <-- Bifold-aware base duration (V1.3.0)
                    couplingMode       : couplingMode,                           // <-- LOCKSTEP unless explicit configured ADR token matches
                    isIndependentPanels: isIndependentPanels,                   // <-- Compatibility-friendly boolean alias
                    legacyPrimaryPanel : primaryRotPanel || panels[0],           // <-- Source for ADR-level compatibility state aliases

                    // Backward-compat fields (legacy single-door consumers)
                    modObjectMesh      : primaryRotPanel ? primaryRotPanel.modObjectMesh : panels[0].modObjectMesh,
                    modObjectLinework  : null,
                    targetAngleRad     : targetAngleRad,
                    initialPosition    : primaryRotPanel ? primaryRotPanel.initialPosition.clone() : panels[0].initialPosition.clone(),
                    initialQuaternion  : primaryRotPanel ? primaryRotPanel.initialQuaternion.clone() : panels[0].initialQuaternion.clone(),
                    pivotLocalPosition : primaryRotPanel ? primaryRotPanel.pivotLocalPosition.clone() : new THREE.Vector3(0, 0, 0),

                    // Animation state (progress 0..1 across all panels)
                    state              : Na__DoorAnim__STATE_CLOSED,             // <-- Current door state
                    currentProgress    : 0,                                      // <-- Current open fraction [0..1]
                    animStartProgress  : 0,                                      // <-- Progress at animation start
                    animEndProgress    : 0,                                      // <-- Target progress for current anim
                    currentAngleRad    : 0,                                      // <-- Backward-compat (mirrors progress * targetAngleRad)
                    animStartAngleRad  : 0,                                      // <-- Backward-compat
                    animEndAngleRad    : 0,                                      // <-- Backward-compat
                    animElapsedMs      : 0,                                      // <-- Elapsed animation time
                    animDurationMs     : effectiveDurationMs                     // <-- Per-door effective duration (V1.3.0)
                };

                Na__DoorAnim__DoorRegistry.set(adrName, doorRecord);             // <-- Register door

                const summary = panels.map((p) => p.type).join('+');
                const tag     = isBifold ? `BIFOLD ${effectiveDurationMs}ms` : `${effectiveDurationMs}ms`;
                console.log(`[DoorAnimation] Registered door (mesh): "${adrName}" panels=[${summary}] coupling=${couplingMode} primary=${THREE.MathUtils.radToDeg(targetAngleRad).toFixed(0)}deg duration=${tag}`);
            });
        }

        // Scan all linework model groups and link to existing door records
        for (const lineworkGroup of Na__DoorAnim__ModelGroupsLinework) {
            lineworkGroup.traverse((object) => {
                if (!Na__DoorAnim__NameStartsWith(object, Na__DoorAnim__PREFIX_ADR)) {
                    return;                                                      // <-- Skip non-ADR objects
                }

                const adrName    = object.name;                                  // <-- Door assembly identifier
                const doorRecord = Na__DoorAnim__DoorRegistry.get(adrName);      // <-- Look up existing record

                if (!doorRecord) {
                    console.warn(`[DoorAnimation] Linework door "${adrName}" has no mesh counterpart, skipping`);
                    return;
                }

                // Pair each linework MOD to a panel descriptor by exact name match
                const lineworkDescriptors = Na__DoorAnim__FindAllAnimatableMods(object);
                lineworkDescriptors.forEach((d) => {
                    const matchingPanel = doorRecord.panels.find((p) => p.modObjectMesh.name === d.mod.name);
                    if (matchingPanel) {
                        matchingPanel.modObjectLinework = d.mod;
                        matchingPanel.rotObjectLinework = Na__DoorAnim__FindMatchingRotSibling(object, d.mod);
                    }
                });

                // First ROT linework (used by Walk Mode proximity reads via rotObjectLinework if mesh missing)
                doorRecord.adrObjectLinework  = object;                          // <-- Linework ADR
                doorRecord.rotObjectLinework  = Na__DoorAnim__FindChildByPrefix(object, Na__DoorAnim__PREFIX_ROT);

                // Backward-compat: link the legacy single MOD pointer if the primary
                // rotating panel got a linework counterpart.
                const primaryPanel = doorRecord.panels.find((p) =>
                    p.type === Na__DoorAnim__MOD_TYPE_ROT_ONLY || p.type === Na__DoorAnim__MOD_TYPE_ROT_MVE
                ) || doorRecord.panels[0];
                doorRecord.modObjectLinework = primaryPanel ? primaryPanel.modObjectLinework : null;

                console.log(`[DoorAnimation] Linked linework for door: "${adrName}" (${lineworkDescriptors.length} panel(s))`);
            });
        }

        console.log(`[DoorAnimation] Scan complete. ${Na__DoorAnim__DoorRegistry.size} door(s) found.`);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Raycaster Click Detection
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Walk Up Scene Graph to Find ADR Ancestor
    // ------------------------------------------------------------
    function Na__DoorAnim__FindAdrAncestor(object) {
        let current = object;                                                    // <-- Start from clicked mesh

        while (current) {
            if (Na__DoorAnim__NameStartsWith(current, Na__DoorAnim__PREFIX_ADR)) {
                return current;                                                  // <-- Found ADR ancestor
            }
            current = current.parent;                                            // <-- Walk up the tree
        }

        return null;                                                             // <-- No ADR ancestor found
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Walk Up Scene Graph to Find Nearest MOD Ancestor
    // ------------------------------------------------------------
    function Na__DoorAnim__FindNearestModAncestor(object) {
        let current = object;

        while (current) {
            if (Na__DoorAnim__NameStartsWith(current, Na__DoorAnim__PREFIX_MOD)) {
                return current;
            }
            if (Na__DoorAnim__NameStartsWith(current, Na__DoorAnim__PREFIX_ADR)) {
                return null;
            }
            current = current.parent;
        }

        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve Raycast Hit to a Registered Panel Descriptor
    // ------------------------------------------------------------
    function Na__DoorAnim__ResolveHitPanel(doorRecord, hitObject) {
        if (!doorRecord || !Array.isArray(doorRecord.panels)) return null;

        const modAncestor = Na__DoorAnim__FindNearestModAncestor(hitObject);
        if (!modAncestor) return null;

        return doorRecord.panels.find((panel) =>
            panel.modObjectMesh === modAncestor
            || panel.modObjectLinework === modAncestor
            || (panel.modObjectMesh && panel.modObjectMesh.name === modAncestor.name)
            || (panel.modObjectLinework && panel.modObjectLinework.name === modAncestor.name)
        ) || null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read Whether a Door (or One Panel) Reads as Open
    // ------------------------------------------------------------
    // Progress-based rather than state-based so a door caught mid-animation
    // still answers sensibly. Used by the Context Menu System to label its
    // Open / Close row. Read-only - it never mutates the record.
    // ------------------------------------------------------------
    function Na__DoorAnim__IsDoorOpen(doorRecordOrPanel) {
        if (!doorRecordOrPanel) return false;

        const progress = doorRecordOrPanel.currentProgress;
        if (Number.isFinite(progress)) return progress > 0.5;                    // <-- Past halfway counts as open

        return doorRecordOrPanel.state === Na__DoorAnim__STATE_OPEN
            || doorRecordOrPanel.state === Na__DoorAnim__STATE_OPENING;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Collect All Meshes from Both Mesh and Linework Door Models
    // ------------------------------------------------------------
    function Na__DoorAnim__CollectDoorMeshes() {
        const meshes = [];                                                       // <-- Array of intersectable meshes

        Na__DoorAnim__DoorRegistry.forEach((doorRecord) => {
            // Multi-panel door: walk every panel's mesh + linework MOD subtree.
            // Includes FIXED panels so the user can click any leaf to toggle.
            for (const panel of doorRecord.panels) {
                if (panel.modObjectMesh) {
                    panel.modObjectMesh.traverse((child) => {
                        if (child.isMesh) meshes.push(child);
                    });
                }
                if (panel.modObjectLinework) {
                    panel.modObjectLinework.traverse((child) => {
                        if (child.isMesh) meshes.push(child);
                    });
                }
            }
        });

        return meshes;                                                           // <-- Return all door meshes
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Handle Pointer Down Event
    // ------------------------------------------------------------
    // LEFT BUTTON ONLY (v1.5.0). The right button is the Orbit pan gesture and
    // is owned by the Context Menu System, which offers Open/Close Door as a
    // menu row instead. Without this gate a stationary right-click would both
    // toggle the door AND open a menu already labelled for the opposite state.
    // ------------------------------------------------------------
    function Na__DoorAnim__OnPointerDown(event) {
        if (event.button !== 0) {                                                // <-- Non-left press cancels any pending click
            Na__DoorAnim__PointerIsDown = false;
            return;
        }

        Na__DoorAnim__PointerDownX = event.clientX;                              // <-- Record pointer X
        Na__DoorAnim__PointerDownY = event.clientY;                              // <-- Record pointer Y
        Na__DoorAnim__PointerIsDown = true;                                      // <-- Mark pointer as pressed
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Handle Pointer Up Event (Click Detection)
    // ------------------------------------------------------------
    function Na__DoorAnim__OnPointerUp(event) {
        if (event.button !== 0) return;                                          // <-- Left button only (see OnPointerDown)
        if (!Na__DoorAnim__PointerIsDown) return;                                // <-- Ignore if no prior pointerdown
        Na__DoorAnim__PointerIsDown = false;                                     // <-- Reset pointer state

        // Check pointer movement to distinguish click from orbit drag
        const deltaX = Math.abs(event.clientX - Na__DoorAnim__PointerDownX);    // <-- Horizontal movement
        const deltaY = Math.abs(event.clientY - Na__DoorAnim__PointerDownY);    // <-- Vertical movement

        if (deltaX > Na__DoorAnim__Config__ClickThresholdPx ||
            deltaY > Na__DoorAnim__Config__ClickThresholdPx) {
            return;                                                              // <-- Too much movement, not a click
        }

        // Calculate NDC from pointer position
        const rect = Na__DoorAnim__RendererDomElement.getBoundingClientRect();   // <-- Canvas bounds
        Na__DoorAnim__PointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;   // <-- NDC X [-1, 1]
        Na__DoorAnim__PointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;  // <-- NDC Y [-1, 1]

        // Perform raycast against door meshes
        Na__DoorAnim__Raycaster.setFromCamera(Na__DoorAnim__PointerNDC, Na__DoorAnim__Camera);

        const doorMeshes = Na__DoorAnim__CollectDoorMeshes();                    // <-- Get all door meshes
        if (doorMeshes.length === 0) return;                                     // <-- No doors to check

        const intersections = Na__DoorAnim__Raycaster.intersectObjects(doorMeshes, false);

        if (intersections.length === 0) return;                                  // <-- No intersection

        // Walk up from the hit mesh to find the ADR ancestor
        const hitObject = intersections[0].object;                               // <-- First intersection
        const adrObject = Na__DoorAnim__FindAdrAncestor(hitObject);

        if (!adrObject) return;                                                  // <-- Not part of a registered door

        // Look up door record and toggle
        const doorRecord = Na__DoorAnim__DoorRegistry.get(adrObject.name);
        if (!doorRecord) return;                                                 // <-- Not in registry

        if (doorRecord.isIndependentPanels === true) {
            const hitPanel = Na__DoorAnim__ResolveHitPanel(doorRecord, hitObject);
            if (hitPanel) {
                Na__DoorAnim__TogglePanel(doorRecord, hitPanel);                  // <-- Exterior double: only clicked MOD
                return;
            }
        }

        Na__DoorAnim__ToggleDoor(doorRecord);                                    // <-- Lockstep fallback / legacy toggle
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Animation Engine
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Ease In-Out Cubic
    // ------------------------------------------------------------
    function Na__DoorAnim__EaseInOutCubic(t) {
        return t < 0.5
            ? 4 * t * t * t                                                     // <-- Ease in (accelerate)
            : 1 - Math.pow(-2 * t + 2, 3) / 2;                                 // <-- Ease out (decelerate)
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Check Whether an Animation State Is Active
    // ------------------------------------------------------------
    function Na__DoorAnim__IsAnimatingState(state) {
        return state === Na__DoorAnim__STATE_OPENING || state === Na__DoorAnim__STATE_CLOSING;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Resolve Opposite Target Progress for a Toggle
    // ------------------------------------------------------------
    function Na__DoorAnim__ResolveToggleEndProgress(animationTarget) {
        if (animationTarget.state === Na__DoorAnim__STATE_CLOSED) return 1;
        if (animationTarget.state === Na__DoorAnim__STATE_OPEN) return 0;
        if (animationTarget.state === Na__DoorAnim__STATE_OPENING) return 0;
        if (animationTarget.state === Na__DoorAnim__STATE_CLOSING) return 1;
        return animationTarget.currentProgress >= 0.5 ? 0 : 1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Start or Reverse One Animation State Target
    // ------------------------------------------------------------
    function Na__DoorAnim__AnimateTargetToProgress(animationTarget, endProgress, baseDurationMs) {
        const startProgress = Number.isFinite(animationTarget.currentProgress)
            ? animationTarget.currentProgress
            : 0;
        const remainingTravel = Math.abs(endProgress - startProgress);

        animationTarget.animStartProgress = startProgress;
        animationTarget.animEndProgress   = endProgress;
        animationTarget.animElapsedMs     = 0;
        animationTarget.animDurationMs    = baseDurationMs * remainingTravel;
        animationTarget.state             = endProgress === 1
            ? Na__DoorAnim__STATE_OPENING
            : Na__DoorAnim__STATE_CLOSING;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Toggle One Animation State Target
    // ------------------------------------------------------------
    function Na__DoorAnim__ToggleAnimationTarget(animationTarget, baseDurationMs) {
        const endProgress = Na__DoorAnim__ResolveToggleEndProgress(animationTarget);
        Na__DoorAnim__AnimateTargetToProgress(animationTarget, endProgress, baseDurationMs);
        return endProgress;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Synchronize ADR-Level Legacy State Aliases
    // ------------------------------------------------------------
    function Na__DoorAnim__SyncLegacyDoorState(doorRecord) {
        if (!doorRecord || doorRecord.isIndependentPanels !== true) return;

        const primaryPanel = doorRecord.legacyPrimaryPanel || doorRecord.panels[0];
        if (!primaryPanel) return;

        doorRecord.state             = primaryPanel.state;
        doorRecord.currentProgress   = primaryPanel.currentProgress;
        doorRecord.animStartProgress = primaryPanel.animStartProgress;
        doorRecord.animEndProgress   = primaryPanel.animEndProgress;
        doorRecord.animElapsedMs     = primaryPanel.animElapsedMs;
        doorRecord.animDurationMs    = primaryPanel.animDurationMs;
        doorRecord.currentAngleRad   = doorRecord.targetAngleRad * primaryPanel.currentProgress;
        doorRecord.animStartAngleRad = doorRecord.targetAngleRad * primaryPanel.animStartProgress;
        doorRecord.animEndAngleRad   = doorRecord.targetAngleRad * primaryPanel.animEndProgress;
    }
    // ------------------------------------------------------------


    // FUNCTION | Toggle Door Open or Closed
    // ------------------------------------------------------------
    // Animation is driven by a unified [0..1] progress value that scales every
    // panel's targetAngleRad / mveDistanceUnits in lockstep. This means a
    // bifold cascade with mixed ROT-only + ROT+MVE panels still finishes its
    // travel at exactly the same instant.
    //
    // V1.3.0: bifolds use `doorRecord.effectiveDurationMs` (the base duration
    // multiplied by `BifoldDurationMultiplier`) so the cascade reads as a slow
    // accordion fold; everything else uses the base AnimationDurationMs.
    function Na__DoorAnim__ToggleDoor(doorRecord) {
        const baseDurationMs = Number.isFinite(doorRecord.effectiveDurationMs) && doorRecord.effectiveDurationMs > 0
            ? doorRecord.effectiveDurationMs
            : Na__DoorAnim__Config__AnimationDurationMs;

        if (doorRecord.isIndependentPanels === true) {
            const endProgress = Na__DoorAnim__ResolveToggleEndProgress(doorRecord);
            doorRecord.panels.forEach((panel) => {
                if (panel.type !== Na__DoorAnim__MOD_TYPE_FIXED) {
                    Na__DoorAnim__AnimateTargetToProgress(panel, endProgress, baseDurationMs);
                }
            });
            Na__DoorAnim__SyncLegacyDoorState(doorRecord);
            console.log(`[DoorAnimation] ${endProgress === 1 ? 'Opening' : 'Closing'} all independent panels: "${doorRecord.adrName}"`);
        } else {
            const wasAnimating = Na__DoorAnim__IsAnimatingState(doorRecord.state);
            const endProgress  = Na__DoorAnim__ToggleAnimationTarget(doorRecord, baseDurationMs);
            const actionLabel  = wasAnimating
                ? 'Reversed mid-animation'
                : (endProgress === 1 ? 'Opening' : 'Closing');
            console.log(`[DoorAnimation] ${actionLabel}: "${doorRecord.adrName}" (${baseDurationMs}ms)`);
        }

        Na__RenderLoop__RequestRender();                                         // <-- Wake render loop so door animation can begin
    }
    // ------------------------------------------------------------


    // FUNCTION | Toggle One Independently Coupled Door Panel
    // ------------------------------------------------------------
    function Na__DoorAnim__TogglePanel(doorRecord, panel) {
        if (!doorRecord || !panel || doorRecord.isIndependentPanels !== true) return false;
        if (!doorRecord.panels.includes(panel) || panel.type === Na__DoorAnim__MOD_TYPE_FIXED) return false;

        const baseDurationMs = Number.isFinite(doorRecord.effectiveDurationMs) && doorRecord.effectiveDurationMs > 0
            ? doorRecord.effectiveDurationMs
            : Na__DoorAnim__Config__AnimationDurationMs;
        const wasAnimating = Na__DoorAnim__IsAnimatingState(panel.state);
        const endProgress  = Na__DoorAnim__ToggleAnimationTarget(panel, baseDurationMs);
        const actionLabel  = wasAnimating
            ? 'Reversed panel mid-animation'
            : (endProgress === 1 ? 'Opening panel' : 'Closing panel');

        Na__DoorAnim__SyncLegacyDoorState(doorRecord);
        Na__RenderLoop__RequestRender();
        console.log(`[DoorAnimation] ${actionLabel}: "${doorRecord.adrName}" / "${panel.modObjectMesh.name}"`);
        return true;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Apply Rotation+Translation to a Single MOD Object
    // ------------------------------------------------------------
    // Panel-aware applier. Resets the MOD to its initial transform and then
    // composes the rotation (around Y, around the hinge pivot) and translation
    // (along the resolved local axis) determined by the panel descriptor.
    function Na__DoorAnim__ApplyPanelTransform(modObject, panel, progress) {
        if (!modObject) return;

        // Step 1: Restore initial transform on the MOD node
        modObject.position.copy(panel.initialPosition);
        modObject.quaternion.copy(panel.initialQuaternion);

        // Step 2: Apply rotation about the hinge pivot for ROT_* panels
        if (panel.type === Na__DoorAnim__MOD_TYPE_ROT_ONLY || panel.type === Na__DoorAnim__MOD_TYPE_ROT_MVE) {
            // rotationSign is -1 for mirrored door instances so the local +Y
            // rotation maps to the intended world swing (see ResolveMirrorSign).
            const angleRad = panel.targetAngleRad * progress * panel.rotationSign;
            const rotQuat  = new THREE.Quaternion().setFromAxisAngle(Na__DoorAnim__Y_AXIS, angleRad);
            const pivot    = panel.pivotLocalPosition;

            // Pivot rotation: shift to pivot-origin, rotate, shift back, then post-multiply orientation.
            modObject.position.sub(pivot);
            modObject.position.applyQuaternion(rotQuat);
            modObject.position.add(pivot);
            modObject.quaternion.premultiply(rotQuat);
        }

        // Step 3: Apply linear translation for MVE_* panels (additive on top of any rotation)
        if (panel.type === Na__DoorAnim__MOD_TYPE_ROT_MVE || panel.type === Na__DoorAnim__MOD_TYPE_MVE_ONLY) {
            if (panel.mveAxisVector) {
                const distance = panel.mveDistanceUnits * progress;
                modObject.position.addScaledVector(panel.mveAxisVector, distance);
            }
        }

        // FIXED panels: no transform change (intentionally untouched).
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply Animation Progress to All Panels (Mesh + Linework)
    // ------------------------------------------------------------
    function Na__DoorAnim__ApplyAllPanels(doorRecord, progress) {
        for (const panel of doorRecord.panels) {
            Na__DoorAnim__ApplyPanelTransform(panel.modObjectMesh,     panel, progress);
            Na__DoorAnim__ApplyPanelTransform(panel.modObjectLinework, panel, progress);
        }

        // Update progress + backward-compat angle for legacy Walk Mode reads
        doorRecord.currentProgress = progress;
        doorRecord.currentAngleRad = doorRecord.targetAngleRad * progress;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Advance One Animation State by a Frame Delta
    // ------------------------------------------------------------
    function Na__DoorAnim__AdvanceAnimationState(animationTarget, deltaMs) {
        animationTarget.animElapsedMs += deltaMs;

        const durationMs = Number.isFinite(animationTarget.animDurationMs) && animationTarget.animDurationMs > 0
            ? animationTarget.animDurationMs
            : 0;
        const rawT   = durationMs > 0 ? Math.min(animationTarget.animElapsedMs / durationMs, 1.0) : 1.0;
        const easedT = Na__DoorAnim__EaseInOutCubic(rawT);
        const progress = animationTarget.animStartProgress
            + (animationTarget.animEndProgress - animationTarget.animStartProgress) * easedT;

        animationTarget.currentProgress = progress;
        return { rawT: rawT, progress: progress };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Complete One Animation State
    // ------------------------------------------------------------
    function Na__DoorAnim__CompleteAnimationState(animationTarget, restDurationMs) {
        if (animationTarget.state === Na__DoorAnim__STATE_OPENING) {
            animationTarget.state = Na__DoorAnim__STATE_OPEN;
        } else if (animationTarget.state === Na__DoorAnim__STATE_CLOSING) {
            animationTarget.state = Na__DoorAnim__STATE_CLOSED;
        }
        animationTarget.currentProgress = animationTarget.animEndProgress;
        animationTarget.animDurationMs  = restDurationMs;
    }
    // ------------------------------------------------------------


    // SUB FUNCTION | Update Independently Coupled Panels for One Door
    // ------------------------------------------------------------
    function Na__DoorAnim__UpdateIndependentPanels(doorRecord, deltaMs) {
        let updatedPanelCount = 0;
        const restDurationMs = Number.isFinite(doorRecord.effectiveDurationMs) && doorRecord.effectiveDurationMs > 0
            ? doorRecord.effectiveDurationMs
            : Na__DoorAnim__Config__AnimationDurationMs;

        doorRecord.panels.forEach((panel) => {
            if (!Na__DoorAnim__IsAnimatingState(panel.state)) return;

            const frame = Na__DoorAnim__AdvanceAnimationState(panel, deltaMs);
            Na__DoorAnim__ApplyPanelTransform(panel.modObjectMesh, panel, frame.progress);
            Na__DoorAnim__ApplyPanelTransform(panel.modObjectLinework, panel, frame.progress);
            updatedPanelCount++;

            if (frame.rawT >= 1.0) {
                Na__DoorAnim__CompleteAnimationState(panel, restDurationMs);
                console.log(`[DoorAnimation] Panel ${panel.state === Na__DoorAnim__STATE_OPEN ? 'opened' : 'closed'}: "${doorRecord.adrName}" / "${panel.modObjectMesh.name}"`);
            }
        });

        if (updatedPanelCount > 0) {
            Na__DoorAnim__SyncLegacyDoorState(doorRecord);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Update All Door Animations (called per frame)
    // ------------------------------------------------------------
    function Na__DoorAnimation__Update(deltaMs) {
        if (!Na__DoorAnim__Initialized) return;                                  // <-- Skip if not initialized
        if (Na__DoorAnim__DoorRegistry.size === 0) return;                       // <-- No doors to animate

        Na__DoorAnim__DoorRegistry.forEach((doorRecord) => {
            if (doorRecord.isIndependentPanels === true) {
                Na__DoorAnim__UpdateIndependentPanels(doorRecord, deltaMs);
                return;
            }

            if (!Na__DoorAnim__IsAnimatingState(doorRecord.state)) {
                return;                                                          // <-- Skip idle doors
            }

            const frame = Na__DoorAnim__AdvanceAnimationState(doorRecord, deltaMs);
            Na__DoorAnim__ApplyAllPanels(doorRecord, frame.progress);             // <-- Cascade transform across every panel

            if (frame.rawT >= 1.0) {
                const restDurationMs = Number.isFinite(doorRecord.effectiveDurationMs) && doorRecord.effectiveDurationMs > 0
                    ? doorRecord.effectiveDurationMs
                    : Na__DoorAnim__Config__AnimationDurationMs;
                Na__DoorAnim__CompleteAnimationState(doorRecord, restDurationMs);
                console.log(`[DoorAnimation] ${doorRecord.state === Na__DoorAnim__STATE_OPEN ? 'Opened' : 'Closed'}: "${doorRecord.adrName}"`);
            }
        });
    }
    // ------------------------------------------------------------




    // FUNCTION | Check Whether Any Door Is Currently Animating
    // ------------------------------------------------------------
    function Na__DoorAnimation__HasActiveAnimations() {
        let hasActiveAnimations = false;

        Na__DoorAnim__DoorRegistry.forEach((doorRecord) => {
            if (doorRecord.isIndependentPanels === true) {
                if (doorRecord.panels.some((panel) => Na__DoorAnim__IsAnimatingState(panel.state))) {
                    hasActiveAnimations = true;
                }
            } else if (Na__DoorAnim__IsAnimatingState(doorRecord.state)) {
                hasActiveAnimations = true;
            }
        });

        return hasActiveAnimations;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Initialize Door Animation System
    // ------------------------------------------------------------
    // Accepts arrays of model groups for multi-storey support.
    // Backward-compatible: a single Group passed for meshGroups or lineworkGroups
    // is automatically wrapped in an array.
    // ------------------------------------------------------------
    function Na__DoorAnimation__Initialize(scene, camera, rendererDomElement, meshGroups, lineworkGroups, config) {
        if (Na__DoorAnim__Initialized) {
            console.warn('[DoorAnimation] Already initialized, skipping');
            return;
        }

        // Store references
        Na__DoorAnim__Scene               = scene;                               // <-- Scene reference
        Na__DoorAnim__Camera              = camera;                              // <-- Camera reference
        Na__DoorAnim__RendererDomElement  = rendererDomElement;                  // <-- Canvas DOM element

        // Normalize inputs: wrap single groups in arrays for backward compatibility
        Na__DoorAnim__ModelGroupsMesh     = Array.isArray(meshGroups)     ? meshGroups     : (meshGroups     ? [meshGroups]     : []);
        Na__DoorAnim__ModelGroupsLinework = Array.isArray(lineworkGroups) ? lineworkGroups  : (lineworkGroups ? [lineworkGroups] : []);

        // Apply config overrides
        if (config) {
            if (Number.isFinite(config['3dObject__Interaction__DoorAnimation__AnimationDurationMs'])) {
                Na__DoorAnim__Config__AnimationDurationMs = config['3dObject__Interaction__DoorAnimation__AnimationDurationMs'];
            }
            if (Number.isFinite(config['3dObject__Interaction__DoorAnimation__BifoldDurationMultiplier'])
                && config['3dObject__Interaction__DoorAnimation__BifoldDurationMultiplier'] > 0) {
                Na__DoorAnim__Config__BifoldDurationMultiplier = config['3dObject__Interaction__DoorAnimation__BifoldDurationMultiplier'];
            }
            if (Number.isFinite(config['3dObject__Interaction__DoorAnimation__DefaultRotationDeg'])) {
                Na__DoorAnim__Config__DefaultRotationDeg = config['3dObject__Interaction__DoorAnimation__DefaultRotationDeg'];
            }
            if (Number.isFinite(config['3dObject__Interaction__DoorAnimation__ClickThresholdPx'])) {
                Na__DoorAnim__Config__ClickThresholdPx = config['3dObject__Interaction__DoorAnimation__ClickThresholdPx'];
            }
            if (typeof config['3dObject__Interaction__DoorAnimation__MultiPanelEnabled'] === 'boolean') {
                Na__DoorAnim__Config__MultiPanelEnabled = config['3dObject__Interaction__DoorAnimation__MultiPanelEnabled'];
            }
            if (typeof config['3dObject__Interaction__DoorAnimation__InteriorRotationInverted'] === 'boolean') {
                Na__DoorAnim__Config__InteriorRotationInverted = config['3dObject__Interaction__DoorAnimation__InteriorRotationInverted'];
            }
            if (typeof config['3dObject__Interaction__DoorAnimation__IndependentPanelsEnabled'] === 'boolean') {
                Na__DoorAnim__Config__IndependentPanelsEnabled = config['3dObject__Interaction__DoorAnimation__IndependentPanelsEnabled'];
            }
            if (Array.isArray(config['3dObject__Interaction__DoorAnimation__IndependentPanelAdrNameTokens'])) {
                const normalizedTokens = config['3dObject__Interaction__DoorAnimation__IndependentPanelAdrNameTokens']
                    .filter((token) => typeof token === 'string')
                    .map((token) => token.trim())
                    .filter((token) => token.length > 0);
                if (normalizedTokens.length > 0) {
                    Na__DoorAnim__Config__IndependentPanelAdrNameTokens = normalizedTokens;
                }
            }
        }

        // Scan scene graph for door assemblies (both mesh and linework)
        Na__DoorAnimation__ScanForDoors();                                       // <-- Build door registry

        // Register pointer event handlers for click detection
        rendererDomElement.addEventListener('pointerdown', Na__DoorAnim__OnPointerDown);  // <-- Pointer down
        rendererDomElement.addEventListener('pointerup',   Na__DoorAnim__OnPointerUp);    // <-- Pointer up

        Na__DoorAnim__Initialized = true;                                        // <-- Mark as initialized
        Na__RenderLoop__RequestRender();                                         // <-- Ensure first door-ready frame is shown
        console.log('[DoorAnimation] Door animation system initialized');
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebind Door Model Groups After Scene Reload
    // ------------------------------------------------------------
    function Na__DoorAnimation__RebindModelGroups(meshGroups, lineworkGroups) {
        if (!Na__DoorAnim__Initialized) {
            console.warn('[DoorAnimation] Cannot rebind before initialization');
            return false;
        }

        Na__DoorAnim__ModelGroupsMesh     = Array.isArray(meshGroups)     ? meshGroups     : (meshGroups     ? [meshGroups]     : []);
        Na__DoorAnim__ModelGroupsLinework = Array.isArray(lineworkGroups) ? lineworkGroups : (lineworkGroups ? [lineworkGroups] : []);

        Na__DoorAnimation__ScanForDoors();
        Na__RenderLoop__RequestRender();                                         // <-- Redraw after swapping model groups
        console.log(`[DoorAnimation] Rebound model groups (${Na__DoorAnim__ModelGroupsMesh.length} mesh, ${Na__DoorAnim__ModelGroupsLinework.length} linework)`);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Door Animation Public API
    // ------------------------------------------------------------
    export {
        Na__DoorAnimation__Initialize,                                           // <-- Initialize system
        Na__DoorAnimation__RebindModelGroups,                                    // <-- Rebind loaded model groups after group switch
        Na__DoorAnimation__Update,                                               // <-- Per-frame update
        Na__DoorAnimation__HasActiveAnimations,                                  // <-- True while any door animation is running
        Na__DoorAnimation__ScanForDoors,                                         // <-- Re-scan scene graph
        Na__DoorAnim__DoorRegistry,                                              // <-- Door registry Map (for proximity system)
        Na__DoorAnim__ToggleDoor,                                                // <-- Toggle whole door open/close (legacy + external callers)
        Na__DoorAnim__TogglePanel,                                               // <-- Toggle one panel on explicitly independent ADRs
        Na__DoorAnim__FindAdrAncestor,                                           // <-- Walk a raycast hit up to its ADR (Context Menu System)
        Na__DoorAnim__ResolveHitPanel,                                           // <-- Resolve a raycast hit to one panel (Context Menu System)
        Na__DoorAnim__IsDoorOpen                                                 // <-- Read-only open/closed query for menu labelling
        // Removed (v1.4.0): Na__DoorAnim__FindModRotChild — superseded by FindAllAnimatableMods
        // Removed (v1.4.0): Na__DoorAnim__ApplyPivotRotation — superseded by ApplyAllPanels progress path
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

