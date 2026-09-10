// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - PROJECT DATA
// =============================================================================
//
// FILE       : Na__DrawView__ProjectData__.js
// NAMESPACE  : Na__DrawData
// MODULE     : Drawing View Core - Project Data
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the LayoutEditor__DrawingsData block and the one save path for drawings
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - Every drawing TrueVision authors - floor plans, elevations, sections and
//   Layout Editor sheets - is stored in ONE top-level project data block,
//   LayoutEditor__DrawingsData, with three-stage keys.
// - Scene-side facts (which scene shows which drawing, which group it sits in)
//   stay inside PresentationMode__SavedCameraScenes, exactly where the scene
//   groups live. This module owns the link-key checks so the drawing systems
//   never have to import each other's data modules to answer "is this a
//   drawing scene".
// - Loaded once per project from the loading sequence event. An absent block
//   becomes an empty skeleton in memory and is only written on the first save.
// - ONE WRITER. Save hands the three blocks this system owns to
//   Na__CfApi__MergeAndSaveKeys, which read-merge-writes them into
//   TrueVision__ProjectData__.json on R2: the drawings block, the presentation
//   block (scene links and groups), and the section bindings (TD06). The Floor
//   Plans, Elevations and Layout Editor panels all call this and nothing else
//   writes drawing data.
//
// INTEGRATION:
// - Na__AppFlow__LoadingSequence.js dispatches na-layouteditor-drawingsdata-loaded
//   AFTER Na__PresentationMode__ProjectJson__SetActiveConfig, because the
//   migration below reads the presentation block.
// - Na__FloorPlan__ProjectJson__Data__ and its elevation counterpart read their
//   arrays through GetBlock.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 42__System__DrawingViewCore/Na__DrawView__ProjectData__.js 1.0.1
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment Phase B)
// - Parity        : adapted
// - Divergences   : (1) TRANSPORT. ValeVision fetches project.json from a local Flask
//                       server, merges, and hands the whole document to an R2-first
//                       save utility. TrueVision has no Flask: the na-truevision-api
//                       Worker does the read-merge-write itself, so Save passes only
//                       the two owned blocks and never fetches or rebuilds a document.
//                   (2) SECTION BINDINGS. Carried, exactly as ValeVision does. TrueVision's
//                       SectionCutEngine originally had no persistence of any kind, and an
//                       earlier draft of this module therefore merged only two blocks. That was
//                       right about the engine and wrong about the destination: a section
//                       drawing that cannot reopen with its own cut is not a drawing. Under
//                       TD06 the engine gains a Serialize/Apply pair and a
//                       CrossSection__SceneData block in ValeVision's exact schema, and this
//                       module merges it as the third key. See plan section 3.2.
//                   (3) MIGRATION. TrueVision arrives with drawings nested inside the
//                       presentation block; ValeVision never had them there. The whole
//                       Legacy Migration region below is TrueVision-only.
// - Back-port     : no. Every divergence is a fact about TrueVision's transport or history.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Initial implementation for re-alignment Phase B, with the legacy migration.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Presentation Scene Config (scene links ride in it)
    // ------------------------------------------------------------
    // @delegate: ../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js
    // ------------------------------------------------------------
    import {
        Na__PresentationMode__ProjectJson__GetActiveConfig
    } from '../21__System__PresentationMode/Na__PresentationMode__ProjectJson__SceneData.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Project Utilities
    // ------------------------------------------------------------
    // @delegate: ../03__AppUtils/Na__AppUtils__ProjectLoader.js
    // ------------------------------------------------------------
    import { Na__AppUtils__GetProjectCodeFromUrl } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Cloudflare R2 API Client (the only writer)
    // ------------------------------------------------------------
    // @delegate: ../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js
    // ------------------------------------------------------------
    import {
        Na__CfApi__IsConfigured,
        Na__CfApi__MergeAndSaveKeys
    } from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Block and Key Names
    // ------------------------------------------------------------
    const Na__DrawData__BLOCK_KEY        = 'LayoutEditor__DrawingsData';
    const Na__DrawData__DESCRIPTION_KEY  = 'LayoutEditor__DrawingsData__Description';
    const Na__DrawData__VERSION_KEY      = 'LayoutEditor__DrawingsData__Version';
    const Na__DrawData__CLIENT_DIMS_KEY  = 'LayoutEditor__DrawingsData__ClientDimensionsEnabled';
    const Na__DrawData__FLOOR_PLANS_KEY  = 'LayoutEditor__DrawingsData__FloorPlans';
    const Na__DrawData__ELEVATIONS_KEY   = 'LayoutEditor__DrawingsData__Elevations';
    const Na__DrawData__SHEETS_KEY       = 'LayoutEditor__DrawingsData__Sheets';
    const Na__DrawData__PRESENTATION_KEY = 'PresentationMode__SavedCameraScenes';
    const Na__DrawData__CROSSSECTION_KEY = 'CrossSection__SceneData';
    const Na__DrawData__VERSION          = 1;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Legacy Keys (nested inside the presentation block)
    // ------------------------------------------------------------
    // Where TrueVision kept drawings before v2.21.0. All three migrate; the
    // third is a scalar sitting between two arrays and is the easy one to miss.
    // ------------------------------------------------------------
    const Na__DrawData__LEGACY_FLOOR_PLANS_KEY = 'PresentationMode__SavedCameraScenes__FloorPlans';
    const Na__DrawData__LEGACY_ELEVATIONS_KEY  = 'PresentationMode__SavedCameraScenes__Elevations';
    const Na__DrawData__LEGACY_CLIENT_DIMS_KEY = 'PresentationMode__SavedCameraScenes__ClientDimensionsEnabled';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Scene Link Keys (scene side, presentation block)
    // ------------------------------------------------------------
    const Na__DrawData__SCENE_PLAN_ID_KEY      = 'PresentationMode__Scene__FloorPlanId';
    const Na__DrawData__SCENE_ELEVATION_ID_KEY = 'PresentationMode__Scene__ElevationId';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Events
    // ------------------------------------------------------------
    const Na__DrawData__LOADED_EVENT  = 'na-layouteditor-drawingsdata-loaded';   // <-- Loading sequence hands the raw block over
    const Na__DrawData__CHANGED_EVENT = 'na-layouteditor-drawingsdata-changed';  // <-- Raised after a load or a save
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Block Description Written on First Save
    // ------------------------------------------------------------
    const Na__DrawData__DESCRIPTION = 'TrueVision-owned drawing definitions: floor plans, elevations and sections with their markup, and Layout Editor sheets. Distances are integer millimetres.';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Live Block and Its Project
    // ------------------------------------------------------------
    let Na__DrawData__Block        = null;    // <-- Live LayoutEditor__DrawingsData object (skeleton until a project supplies one)
    let Na__DrawData__ProjectCode  = null;    // <-- Project code the block was loaded for
    let Na__DrawData__Initialized  = false;
    let Na__DrawData__MigratedFrom = null;    // <-- Non-null when this session migrated; cleared by the save that lands it
    // ------------------------------------------------------------


    // MODULE VARIABLES | Section Bindings Provider (TD06)
    // ------------------------------------------------------------
    // The section scene-data module hands its block getter over here at init.
    //
    // A registration hook rather than the hard import ValeVision uses, for one
    // reason: this module is armed before the loading sequence and the section
    // system is not, so importing it here would force the section engine to
    // load on every project whether or not it has a single cut. Registration
    // keeps the save complete when the section system is present and silent
    // when it is not, and neither module has to know the other's load order.
    // ------------------------------------------------------------
    let Na__DrawData__SectionBlockProvider = null;   // <-- () => block | null
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Block Access
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build an Empty Block
    // ------------------------------------------------------------
    function Na__DrawData__BuildSkeleton() {
        const block = {};
        block[Na__DrawData__DESCRIPTION_KEY] = Na__DrawData__DESCRIPTION;
        block[Na__DrawData__VERSION_KEY]     = Na__DrawData__VERSION;
        block[Na__DrawData__CLIENT_DIMS_KEY] = false;
        block[Na__DrawData__FLOOR_PLANS_KEY] = [];
        block[Na__DrawData__ELEVATIONS_KEY]  = [];
        block[Na__DrawData__SHEETS_KEY]      = [];
        return block;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Make Sure Every Array and Flag Exists on a Block
    // ------------------------------------------------------------
    // Applied to whatever the project supplies, so a hand-edited or partial
    // block still reads correctly rather than producing undefined arrays.
    // ------------------------------------------------------------
    function Na__DrawData__Normalise(block) {
        if (typeof block[Na__DrawData__DESCRIPTION_KEY] !== 'string') block[Na__DrawData__DESCRIPTION_KEY] = Na__DrawData__DESCRIPTION;
        if (!Number.isFinite(block[Na__DrawData__VERSION_KEY]))        block[Na__DrawData__VERSION_KEY]     = Na__DrawData__VERSION;
        if (typeof block[Na__DrawData__CLIENT_DIMS_KEY] !== 'boolean') block[Na__DrawData__CLIENT_DIMS_KEY] = false;
        if (!Array.isArray(block[Na__DrawData__FLOOR_PLANS_KEY]))      block[Na__DrawData__FLOOR_PLANS_KEY] = [];
        if (!Array.isArray(block[Na__DrawData__ELEVATIONS_KEY]))       block[Na__DrawData__ELEVATIONS_KEY]  = [];
        if (!Array.isArray(block[Na__DrawData__SHEETS_KEY]))           block[Na__DrawData__SHEETS_KEY]      = [];
        return block;
    }
    // ------------------------------------------------------------


    // FUNCTION | Get the Live Drawings Block (Created Empty on First Use)
    // ------------------------------------------------------------
    // Returns the LIVE object. Mutating a returned array edits what the next
    // save writes, which is the whole point: the drawing records, the markup
    // arrays and the saved document are one object, never three.
    // ------------------------------------------------------------
    function Na__DrawData__GetBlock() {
        if (!Na__DrawData__Block) Na__DrawData__Block = Na__DrawData__BuildSkeleton();
        return Na__DrawData__Block;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Legacy Migration (TrueVision only - see PORT NOTE divergence 3)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Does the Presentation Block Still Hold Drawings?
    // ------------------------------------------------------------
    function Na__DrawData__HasLegacyDrawings(sceneConfig) {
        if (!sceneConfig || typeof sceneConfig !== 'object') return false;
        return Array.isArray(sceneConfig[Na__DrawData__LEGACY_FLOOR_PLANS_KEY])
            || Array.isArray(sceneConfig[Na__DrawData__LEGACY_ELEVATIONS_KEY])
            || typeof sceneConfig[Na__DrawData__LEGACY_CLIENT_DIMS_KEY] === 'boolean';
    }
    // ------------------------------------------------------------


    // FUNCTION | Lift Drawings Out of the Presentation Block
    // ------------------------------------------------------------
    // Runs once per load, only when there is no new block to read. Deliberately
    // NON-DESTRUCTIVE: the legacy keys stay exactly where they are until a save
    // has actually landed the new block on R2, so there is never a moment where
    // the only copy of a drawing is one that has not been written. The save
    // clears them, in the same write that persists the new block.
    //
    // Idempotent by construction - a document that already carries the new block
    // never reaches here.
    // ------------------------------------------------------------
    function Na__DrawData__MigrateFromPresentation(sceneConfig) {
        const block = Na__DrawData__BuildSkeleton();

        const legacyPlans      = sceneConfig[Na__DrawData__LEGACY_FLOOR_PLANS_KEY];
        const legacyElevations = sceneConfig[Na__DrawData__LEGACY_ELEVATIONS_KEY];
        const legacyClientDims = sceneConfig[Na__DrawData__LEGACY_CLIENT_DIMS_KEY];

        if (Array.isArray(legacyPlans))      block[Na__DrawData__FLOOR_PLANS_KEY] = legacyPlans;
        if (Array.isArray(legacyElevations)) block[Na__DrawData__ELEVATIONS_KEY]  = legacyElevations;
        if (typeof legacyClientDims === 'boolean') block[Na__DrawData__CLIENT_DIMS_KEY] = legacyClientDims;

        Na__DrawData__MigratedFrom = {
            plans      : Array.isArray(legacyPlans)      ? legacyPlans.length      : 0,
            elevations : Array.isArray(legacyElevations) ? legacyElevations.length : 0,
            clientDims : (typeof legacyClientDims === 'boolean')
        };

        console.log('[TrueVision3D] Drawings migrated out of the presentation block: '
            + `${Na__DrawData__MigratedFrom.plans} plan(s), `
            + `${Na__DrawData__MigratedFrom.elevations} elevation(s)`
            + (Na__DrawData__MigratedFrom.clientDims ? ', client measuring flag' : '')
            + '. The legacy keys stay on R2 until the next save.');

        return block;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Strip the Legacy Keys From the Live Presentation Config
    // ------------------------------------------------------------
    // Called only from a save that is about to write, and only once the new
    // block is in the same payload. Because Save hands the whole presentation
    // config to the Worker, deleting the keys here is what removes them from R2.
    // ------------------------------------------------------------
    function Na__DrawData__StripLegacyKeys(sceneConfig) {
        if (!sceneConfig || typeof sceneConfig !== 'object') return;
        delete sceneConfig[Na__DrawData__LEGACY_FLOOR_PLANS_KEY];
        delete sceneConfig[Na__DrawData__LEGACY_ELEVATIONS_KEY];
        delete sceneConfig[Na__DrawData__LEGACY_CLIENT_DIMS_KEY];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Load
// -----------------------------------------------------------------------------

    // FUNCTION | Adopt the Block a Project Supplied (null = migrate, or start empty)
    // ------------------------------------------------------------
    // sceneConfig is passed in rather than read from the presentation module,
    // because the migration must not depend on which listener ran first. The
    // loading sequence has the block in hand at dispatch time; asking a second
    // module whether it has been initialised yet is a race waiting to be lost,
    // and losing it would silently skip the migration and look like data loss.
    // ------------------------------------------------------------
    function Na__DrawData__Load(block, projectCode, sceneConfigIn) {
        const hasNewBlock = Boolean(block && typeof block === 'object' && !Array.isArray(block));
        const sceneConfig = sceneConfigIn || Na__PresentationMode__ProjectJson__GetActiveConfig();

        if (hasNewBlock) {
            Na__DrawData__Block = Na__DrawData__Normalise(block);                 // <-- Adopt verbatim; unknown keys are preserved on save

            // A document carrying BOTH shapes means a save was interrupted
            // between writing the new block and clearing the old keys. The new
            // block wins, but this wants eyes on it rather than a silent pick.
            if (Na__DrawData__HasLegacyDrawings(sceneConfig)) {
                console.warn('[TrueVision3D] Project carries BOTH the new LayoutEditor__DrawingsData block '
                    + 'and the legacy presentation-block drawing keys. Reading the new block and ignoring the '
                    + 'legacy keys; the next save clears them. If a drawing is missing, compare the two on R2 '
                    + 'before saving.');
                Na__DrawData__MigratedFrom = { plans: 0, elevations: 0, clientDims: false, staleLegacyOnly: true };
            }

        } else if (Na__DrawData__HasLegacyDrawings(sceneConfig)) {
            Na__DrawData__Block = Na__DrawData__MigrateFromPresentation(sceneConfig);

        } else {
            Na__DrawData__Block = Na__DrawData__BuildSkeleton();
        }

        Na__DrawData__ProjectCode = projectCode || Na__DrawData__ProjectCode || null;

        window.dispatchEvent(new CustomEvent(Na__DrawData__CHANGED_EVENT, {
            detail : { reason : 'loaded', projectCode : Na__DrawData__ProjectCode }
        }));
        return Na__DrawData__Block;
    }
    // ------------------------------------------------------------


    // FUNCTION | Project Code the Block Belongs To
    // ------------------------------------------------------------
    function Na__DrawData__GetProjectCode() {
        return Na__DrawData__ProjectCode
            || Na__AppUtils__GetProjectCodeFromUrl()
            || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Three Record Arrays (Live References)
    // ------------------------------------------------------------
    function Na__DrawData__GetFloorPlansArray() { return Na__DrawData__GetBlock()[Na__DrawData__FLOOR_PLANS_KEY]; }
    function Na__DrawData__GetElevationsArray() { return Na__DrawData__GetBlock()[Na__DrawData__ELEVATIONS_KEY]; }
    function Na__DrawData__GetSheetsArray()     { return Na__DrawData__GetBlock()[Na__DrawData__SHEETS_KEY]; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Client Measuring Grant
// -----------------------------------------------------------------------------

    // FUNCTION | May Clients Measure on This Project?
    // ------------------------------------------------------------
    // Absent reads as OFF: a project nobody has considered never exposes the tool.
    // ------------------------------------------------------------
    function Na__DrawData__GetClientDimensionsEnabled() {
        return Na__DrawData__GetBlock()[Na__DrawData__CLIENT_DIMS_KEY] === true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Grant or Withhold Client Measuring for This Project
    // ------------------------------------------------------------
    function Na__DrawData__SetClientDimensionsEnabled(enabled) {
        Na__DrawData__GetBlock()[Na__DrawData__CLIENT_DIMS_KEY] = (enabled === true);
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Scene Link Checks
// -----------------------------------------------------------------------------

    // FUNCTION | Does This Scene Show a Floor Plan?
    // ------------------------------------------------------------
    function Na__DrawData__IsFloorPlanScene(scene) {
        return Boolean(scene && typeof scene === 'object' && scene[Na__DrawData__SCENE_PLAN_ID_KEY]);
    }
    // ------------------------------------------------------------


    // FUNCTION | Does This Scene Show an Elevation or Section?
    // ------------------------------------------------------------
    function Na__DrawData__IsElevationScene(scene) {
        return Boolean(scene && typeof scene === 'object' && scene[Na__DrawData__SCENE_ELEVATION_ID_KEY]);
    }
    // ------------------------------------------------------------


    // FUNCTION | Does This Scene Show Any 2D Drawing?
    // ------------------------------------------------------------
    function Na__DrawData__IsDrawingScene(scene) {
        return Na__DrawData__IsFloorPlanScene(scene) || Na__DrawData__IsElevationScene(scene);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Save Path (R2, via the Worker)
// -----------------------------------------------------------------------------

    // FUNCTION | Save the Drawings Block and the Scene Links to R2
    // ------------------------------------------------------------
    // Hands the blocks this system owns to the Worker, which does the
    // read-merge-write against TrueVision__ProjectData__.json. Nothing is
    // fetched or rebuilt here: the Worker holds the document, so a key another
    // panel wrote between our load and this save survives untouched. That is
    // the whole reason this is one call rather than ValeVision's three steps.
    //
    // THE SECTION BINDINGS RIDE WITH THIS SAVE (TD06), and must. They are keyed
    // by SCENE NAME, so renaming a drawing re-keys an entry in that block - and
    // a rename that lands the record and the card but not the binding leaves the
    // drawing opening with no cut at all. One write or none.
    //
    // When this session migrated, the legacy keys are stripped from the
    // presentation config FIRST, so the one write both lands the new block and
    // clears the old one. Either the whole thing persists or none of it does,
    // and a failure leaves R2 exactly as it was - still holding the drawings in
    // their old home, which is why the migration never deletes on load.
    // ------------------------------------------------------------
    async function Na__DrawData__Save(showToast) {
        const toast       = (typeof showToast === 'function') ? showToast : () => {};
        const projectCode = Na__DrawData__GetProjectCode();

        if (!projectCode) {
            toast('No project loaded.', true);
            return false;
        }
        if (!Na__CfApi__IsConfigured()) {
            toast('Cloudflare Worker not configured. Drawings cannot be saved.', true);
            return false;
        }

        const sceneConfig    = Na__PresentationMode__ProjectJson__GetActiveConfig();
        const wasMigration   = Boolean(Na__DrawData__MigratedFrom);
        const payload        = {};

        if (wasMigration && sceneConfig) Na__DrawData__StripLegacyKeys(sceneConfig);  // <-- Same write clears the old home

        payload[Na__DrawData__BLOCK_KEY] = Na__DrawData__GetBlock();
        if (sceneConfig) payload[Na__DrawData__PRESENTATION_KEY] = sceneConfig;

        // SECTION BINDINGS | Third block, TD06. The provider returns null until
        // something loads or captures a section, so a project that has never had
        // a cut never gains the key - the same rule ValeVision follows.
        if (Na__DrawData__SectionBlockProvider) {
            try {
                const sectionBlock = Na__DrawData__SectionBlockProvider();
                if (sectionBlock) payload[Na__DrawData__CROSSSECTION_KEY] = sectionBlock;
            } catch (providerError) {
                // A broken provider must not cost the drawings their save. The
                // cut is recoverable by re-capturing; an unsaved drawing is not.
                console.warn('[TrueVision3D] Section bindings provider failed; saving drawings without them.', providerError);
            }
        }

        try {
            const result = await Na__CfApi__MergeAndSaveKeys(payload);
            if (!result || !result.ok) {
                const reason = (result && result.error) ? result.error : 'unknown error';
                toast(`Drawings save failed: ${reason}`, true);
                return false;
            }

            if (wasMigration) {
                Na__DrawData__MigratedFrom = null;                                   // <-- Landed; later saves are ordinary
                console.log('[TrueVision3D] Drawings migration written to R2. The legacy presentation-block keys are gone.');
            }

            window.dispatchEvent(new CustomEvent(Na__DrawData__CHANGED_EVENT, {
                detail : { reason : 'saved', projectCode : projectCode }
            }));
            return true;

        } catch (error) {
            console.error('[TrueVision3D] Drawings save error:', error);
            toast(`Drawings save failed: ${error.message}`, true);
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Initialization
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Section Bindings Block Getter (TD06)
    // ------------------------------------------------------------
    // Called by Na__SectionCut__SceneData__ when it initialises. Passing a
    // non-function clears the registration rather than throwing at save time.
    // ------------------------------------------------------------
    function Na__DrawData__RegisterSectionBlockProvider(getter) {
        Na__DrawData__SectionBlockProvider = (typeof getter === 'function') ? getter : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Listen for the Project Block From the Loading Sequence
    // ------------------------------------------------------------
    function Na__DrawView__ProjectData__Initialize() {
        if (Na__DrawData__Initialized) return;
        Na__DrawData__Initialized = true;

        window.addEventListener(Na__DrawData__LOADED_EVENT, (event) => {
            const detail = event.detail || {};
            Na__DrawData__Load(detail.block || null, detail.projectCode || null, detail.sceneConfig || null);
            const block = Na__DrawData__GetBlock();
            console.log('[TrueVision3D] Drawings data loaded: '
                + block[Na__DrawData__FLOOR_PLANS_KEY].length + ' plan(s), '
                + block[Na__DrawData__ELEVATIONS_KEY].length + ' elevation(s), '
                + block[Na__DrawData__SHEETS_KEY].length + ' sheet(s).');
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawings Project Data API
    // ------------------------------------------------------------
    export {
        Na__DrawData__BLOCK_KEY,
        Na__DrawData__FLOOR_PLANS_KEY,
        Na__DrawData__ELEVATIONS_KEY,
        Na__DrawData__SHEETS_KEY,
        Na__DrawData__SCENE_PLAN_ID_KEY,
        Na__DrawData__SCENE_ELEVATION_ID_KEY,
        Na__DrawData__LOADED_EVENT,
        Na__DrawData__CHANGED_EVENT,
        Na__DrawView__ProjectData__Initialize,
        Na__DrawData__RegisterSectionBlockProvider,
        Na__DrawData__GetBlock,
        Na__DrawData__Load,
        Na__DrawData__GetProjectCode,
        Na__DrawData__GetFloorPlansArray,
        Na__DrawData__GetElevationsArray,
        Na__DrawData__GetSheetsArray,
        Na__DrawData__GetClientDimensionsEnabled,
        Na__DrawData__SetClientDimensionsEnabled,
        Na__DrawData__IsFloorPlanScene,
        Na__DrawData__IsElevationScene,
        Na__DrawData__IsDrawingScene,
        Na__DrawData__Save
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
