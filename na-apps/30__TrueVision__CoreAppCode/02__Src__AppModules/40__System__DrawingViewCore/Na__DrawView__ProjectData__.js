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
// - AND A LOCAL COPY. On localhost the same blocks then go into the
//   repository's TrueVision__ProjectData__.json through the ProjectVision local
//   server, so a save lands in R2 and on disk (Na__AppUtils__LocalProjectMirror__).
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
//                   (4) IS LOADED. Na__DrawData__IsLoaded, TrueVision first on 22-Sep-2026, for
//                       the Layout Editor's late start (see the 1.5.0 log entry).
// - Back-port     : no for (1) to (3), every one a fact about TrueVision's transport or history.
//                   (4) goes with the sheet model's late start fix, if that is ever back-ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.6.0
// - THE DRAWINGS SAVE GUARD. The base - what the drawings block was when this
//   session loaded or last saved it - is learned after every load (on
//   localhost the local server's fingerprint of the file on disk, elsewhere
//   the block's own saved stamp; GetBase, WhenBaseKnown). Save asks the local
//   server, BEFORE R2 is written, whether the block on disk is still that
//   one, and refuses with a toast when it is not: the sheets would have gone
//   back to how this window had them, over whatever another window - or an
//   agent, or a git checkout - had saved since. The local write carries the
//   base too (Na__LocalMirror__MergeKeys options.drawingsBase), so the server
//   refuses a save that slipped past the check, and answers the file's new
//   fingerprint, which becomes the base. Every save now stamps the block with
//   LayoutEditor__DrawingsData__SavedIso. RB05, 22-Sep-2026: a window that
//   had loaded D10 before its 24 bubbles were added saved after them, and
//   the bubbles were gone; then its browser draft put them back to gone.
//
// 22-Sep-2026 - Version 1.5.0
// - Na__DrawData__IsLoaded: true once a project's block has been adopted.
//   GetProjectCode cannot answer that - it falls back to the address bar,
//   which names the project from the first moment - and a module that starts
//   after the load (the Layout Editor, once its configs are in) needs to know
//   the load it listens for has already happened. The sheet model announces
//   such a load itself; the auto save keeps its draft out of reach until then.
//
// 21-Sep-2026 - Version 1.4.0
// - Save steps: Na__DrawData__RegisterSaveStep. A feature whose records point
//   at FILES - the pictures placed on Layout Editor sheets - registers a step
//   that every save runs: before (put the files in place on R2 and on disk),
//   payload (point the copy about to be written at them) and after (once the
//   drawings have landed, adopt the pointers and tidy what nothing uses).
//   Every save runs them because every save writes the whole drawings block:
//   a register renumber moves a drawing's pictures as surely as Save Sheets.
//   Their notes ride on report.steps; without a report, a failure is shown.
//
// 20-Sep-2026 - Version 1.3.0
// - Payload guard: Na__DrawData__RegisterPayloadGuard. The copy a save is about
//   to write is handed to the draft guard first, so a floor plan or elevation
//   still being edited in its Dev menu row goes out as it was last UPDATED,
//   whoever is saving. The local copy is cut from the guarded payload, so R2
//   and the repository file still get the same thing.
//
// 19-Sep-2026 - Version 1.2.0
// - Common title block fields: CommonClient and CommonSiteAddress hold the
//   client and the site address ONCE for the whole pack. They sit beside the
//   client measuring grant because they are the same kind of thing - a fact
//   about the project, not about any one sheet.
//
// 14-Sep-2026 - Version 1.1.0
// - Save writes a local copy too: once R2 has the blocks, they are merged into
//   the repository's TrueVision__ProjectData__.json through the ProjectVision
//   local server (Na__AppUtils__LocalProjectMirror__), on localhost only. The
//   blocks are copied before the R2 write, so both copies get the same content
//   whatever is edited while the save is in flight.
// - Save(showToast, report): a caller that passes a report object receives the
//   local result on report.local and says where the save landed itself (the
//   Layout Editor's confirmation). Without one, a local failure is shown here.
//
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
    import { Na__AppUtils__GetProjectCodeFromUrl, Na__AppUtils__IsRunningOnLocalhost } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
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

    // MODULE IMPORTS | Local Project Data Mirror (the repository copy follows R2)
    // ------------------------------------------------------------
    // @delegate: ../03__AppUtils/Na__AppUtils__LocalProjectMirror__.js
    // ------------------------------------------------------------
    import { Na__LocalMirror__MergeKeys, Na__LocalMirror__DrawingsFingerprint } from '../03__AppUtils/Na__AppUtils__LocalProjectMirror__.js';
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
    const Na__DrawData__COMMON_CLIENT_KEY = 'LayoutEditor__DrawingsData__CommonClient';
    const Na__DrawData__COMMON_SITE_KEY   = 'LayoutEditor__DrawingsData__CommonSiteAddress';
    const Na__DrawData__FLOOR_PLANS_KEY  = 'LayoutEditor__DrawingsData__FloorPlans';
    const Na__DrawData__ELEVATIONS_KEY   = 'LayoutEditor__DrawingsData__Elevations';
    const Na__DrawData__SHEETS_KEY       = 'LayoutEditor__DrawingsData__Sheets';
    const Na__DrawData__SAVED_ISO_KEY    = 'LayoutEditor__DrawingsData__SavedIso';   // <-- When the block was last saved, written by the save: for people, and for the draft's question
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
    let Na__DrawData__Loaded       = false;   // <-- A project's block has been adopted (the skeleton alone is not a load)
    let Na__DrawData__Initialized  = false;
    let Na__DrawData__MigratedFrom = null;    // <-- Non-null when this session migrated; cleared by the save that lands it
    // ------------------------------------------------------------


    // MODULE VARIABLES | The Base: What the Drawings Were When This Session Took Them
    // ------------------------------------------------------------
    // The identity of the drawings block this session loaded, or last saved:
    // on localhost the local server's fingerprint of the block on disk
    // ('sha1:...'), on the web build the block's own saved stamp ('iso:...');
    // null for a project that had no block; undefined until it has been
    // asked for after a load. A save is built on it: the local server refuses
    // one built on a block that is no longer the one on disk, and the browser
    // draft records it so a draft grown from drawings since saved elsewhere is
    // asked about rather than put back over them (Na__LayoutEditor__AutoSave__).
    // Judged is true only once the fingerprint route has answered: a server
    // without it, or one that did not answer, leaves saves unjudged as they
    // always were rather than refused for a reason that is not theirs.
    // ------------------------------------------------------------
    let Na__DrawData__Base        = undefined;               // <-- 'sha1:...' | 'iso:...' | null | undefined
    let Na__DrawData__BaseJudged  = false;                   // <-- The local server fingerprinted the block: saves say what they were built on
    let Na__DrawData__BaseKnown   = Promise.resolve(undefined);   // <-- Settles with the base once it has been asked for after a load
    let Na__DrawData__BaseWarned  = false;                   // <-- The route missing is said once a session
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


    // MODULE VARIABLES | Payload Guard (drafts stay out of other people's saves)
    // ------------------------------------------------------------
    // Save writes the WHOLE drawings block, whoever calls it - Save Sheets, the
    // register, north, a rename. A floor plan or an elevation that is half way
    // through being moved in its Dev menu row is in that block too, and used to
    // go out with the next save from anywhere: nudge a plane, save a sheet an
    // hour later, and every viewport of that drawing had moved under its
    // dimensions. The draft guard registers here and is handed the COPY about
    // to be written, so it can put the last updated record back into it.
    // A hook for the same reason the section provider is one: this module is
    // armed on every project and the Dev menu panels are not.
    // @delegate: ./Na__DrawView__DraftGuard__.js
    // ------------------------------------------------------------
    let Na__DrawData__PayloadGuard = null;           // <-- (payloadCopy) => void
    // ------------------------------------------------------------


    // MODULE VARIABLES | Save Steps (files that must be in place before the drawings point at them)
    // ------------------------------------------------------------
    // A drawing that points at a FILE - a picture placed on a sheet - must not
    // reach R2 before the file does, whoever is saving: Save Sheets, a register
    // renumber, a rename. So a feature that owns such files registers a step,
    // and EVERY save runs it, in three phases:
    //   before(ctx)   put the files where the drawings are about to point
    //   payload(ctx)  edit ctx.block - the copy about to be written - to point
    //                 at them (the live records are left alone until it lands)
    //   after(ctx)    once R2 and the local copy have the drawings: adopt the
    //                 new pointers in the live records and tidy what nothing
    //                 points at any more
    // A step that throws costs its own work and a note, never the save.
    // @delegate: ../51__System__LayoutEditor/54__Feature__SheetImages/Na__LayoutEditor__SheetImages__Publish__.js
    // ------------------------------------------------------------
    const Na__DrawData__SaveSteps = [];              // <-- [{ id, before, payload, after }]
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
        Na__DrawData__Loaded      = true;                                        // <-- Before the announcement: a listener may ask
        Na__DrawData__Base        = undefined;                                   // <-- Not known for this load until the server answers
        Na__DrawData__BaseJudged  = false;
        Na__DrawData__BaseKnown   = Na__DrawData__LearnBase();

        window.dispatchEvent(new CustomEvent(Na__DrawData__CHANGED_EVENT, {
            detail : { reason : 'loaded', projectCode : Na__DrawData__ProjectCode }
        }));
        return Na__DrawData__Block;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Base, and a Promise of It
    // ------------------------------------------------------------
    // GetBase answers undefined until the base has been learned for the
    // current load; WhenBaseKnown resolves with it once it has.
    // ------------------------------------------------------------
    function Na__DrawData__GetBase() { return Na__DrawData__Base; }
    function Na__DrawData__WhenBaseKnown() { return Na__DrawData__BaseKnown; }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Learn What the Drawings Are, After a Load
    // ------------------------------------------------------------
    // The block's own saved stamp first, which every build has; then, on
    // localhost, the local server's fingerprint of the file on disk, which
    // sees a change made by anything - another window's save, an agent
    // editing the file, a git checkout - not only one that wrote a stamp.
    // ------------------------------------------------------------
    async function Na__DrawData__LearnBase() {
        const block = Na__DrawData__GetBlock();
        const iso   = block[Na__DrawData__SAVED_ISO_KEY];
        let   base  = (typeof iso === 'string' && iso) ? 'iso:' + iso : null;
        let   judged = false;
        if (Na__AppUtils__IsRunningOnLocalhost()) {
            const answer = await Na__LocalMirror__DrawingsFingerprint();
            if (answer.ok) { base = answer.drawings.digest || null; judged = true; }
            else if (!answer.skipped && !Na__DrawData__BaseWarned) {
                Na__DrawData__BaseWarned = true;
                console.warn('[TrueVision3D] The drawings on disk could not be fingerprinted; saves from this window will not be checked against the file: ' + (answer.error || 'no answer'));
            }
        }
        if (block !== Na__DrawData__GetBlock()) return Na__DrawData__Base;   // <-- Another project loaded meanwhile: its own LearnBase answers for it
        Na__DrawData__Base       = base;
        Na__DrawData__BaseJudged = judged;
        return base;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Before a Save: Are the Drawings on Disk Still the Ones This Window Loaded
    // ------------------------------------------------------------
    // Asked BEFORE R2 is written, because R2 is written first and the local
    // server's own refusal (409) would come too late to protect it. Answers
    // { ok, message }: ok false is a refusal, with the words for the toast.
    // Unjudged sessions, and a fingerprint that cannot be read right now, save
    // as they always did - the local server still judges the write itself.
    // ------------------------------------------------------------
    async function Na__DrawData__CheckBase() {
        await Na__DrawData__BaseKnown;
        if (!Na__DrawData__BaseJudged || !Na__AppUtils__IsRunningOnLocalhost()) return { ok : true, message : null };
        const answer = await Na__LocalMirror__DrawingsFingerprint();
        if (!answer.ok) return { ok : true, message : null };
        const onDisk = answer.drawings.digest || null;
        if (onDisk === Na__DrawData__Base) return { ok : true, message : null };
        return { ok : false, message : Na__DrawData__ConflictWords(answer.drawings) };
    }
    function Na__DrawData__ConflictWords(drawings) {
        const when = (drawings && drawings.savedIso) ? Na__DrawData__ClockWords(drawings.savedIso) : null;
        return 'Not saved: the project\'s drawings on disk are not the ones this window loaded - they were saved '
             + (when ? 'elsewhere at ' + when : 'elsewhere, or changed on disk,') + ' since. Reload to pick them up; '
             + 'this window\'s unsaved changes will be offered as a draft.';
    }
    function Na__DrawData__ClockWords(iso) {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return iso;
        const pad = (n) => String(n).padStart(2, '0');
        return pad(date.getHours()) + ':' + pad(date.getMinutes()) + ' on ' + pad(date.getDate()) + '/' + pad(date.getMonth() + 1);
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


    // FUNCTION | Has a Project's Block Been Adopted Yet
    // ------------------------------------------------------------
    // Not the same question as GetProjectCode, which falls back to the address
    // bar and so names the project before its drawings are here. Until this
    // answers true the block is the empty skeleton, whatever the code says. A
    // module that starts after the load asks this to know that the load it
    // listens for has already happened.
    // ------------------------------------------------------------
    function Na__DrawData__IsLoaded() { return Na__DrawData__Loaded; }
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
// REGION | Common Title Block Fields
// -----------------------------------------------------------------------------

    // FUNCTION | The Client and Site Address the Whole Pack Shares
    // ------------------------------------------------------------
    // One project, one client, one address: on a householder job the three
    // are the same on every drawing, and typing them per sheet is how four
    // sheets come to disagree about whether the postcode has a space after it.
    // A sheet that genuinely differs turns Common off and keeps its own.
    // Absent reads as empty, never as null, so callers can always concatenate.
    // ------------------------------------------------------------
    function Na__DrawData__GetCommonFields() {
        const block = Na__DrawData__GetBlock();
        const read  = (key) => (typeof block[key] === 'string') ? block[key] : '';
        return { Client : read(Na__DrawData__COMMON_CLIENT_KEY), SiteAddress : read(Na__DrawData__COMMON_SITE_KEY) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Set One Common Field for the Whole Pack
    // ------------------------------------------------------------
    // Trimmed on the way in - a trailing space is invisible in the panel and
    // shifts the printed cell - and an empty value removes the key rather than
    // storing "", so an unanswered project reads the same as a new one.
    // ------------------------------------------------------------
    function Na__DrawData__SetCommonField(key, value) {
        const mapKey = (key === 'Client') ? Na__DrawData__COMMON_CLIENT_KEY
                     : (key === 'SiteAddress') ? Na__DrawData__COMMON_SITE_KEY : null;
        if (!mapKey) return false;
        const block = Na__DrawData__GetBlock();
        const text  = (typeof value === 'string') ? value.trim() : '';
        if (text) block[mapKey] = text;
        else delete block[mapKey];
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
// REGION | Save Path (R2 via the Worker, then the local copy)
// -----------------------------------------------------------------------------

    // FUNCTION | Save the Drawings Block and the Scene Links to R2 (and the Local Copy)
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
    //
    // report (optional object): report.local receives the local copy's result,
    // { ok, skipped, error }, and the caller then owns saying where the save
    // landed. Without one, only a local failure is shown, as an error.
    // ------------------------------------------------------------
    async function Na__DrawData__Save(showToast, report, registerKeys) {
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

        // SAVE STEPS | Files the drawings point at go first (see SaveSteps).
        // Their notes ride on the report for a caller that says where the save
        // landed; any other caller is shown the ones that went wrong.
        const stepNotes   = [];
        const stepContext = {
            report   : report || null,
            state    : {},
            block    : null,
            local    : null,
            note     : (message, isError) => { if (message) stepNotes.push({ message : String(message), error : isError === true }); }
        };
        if (report && typeof report === 'object') report.steps = stepNotes;

        // THE DRAWINGS SAVE GUARD | Before anything is written, R2 included:
        // are the drawings on disk still the ones this window loaded? A window
        // that loaded them before another window saved would write every
        // sheet back to how it had them, and R2 is written first, so the local
        // server's own refusal would come too late for it.
        const guard = await Na__DrawData__CheckBase();
        if (!guard.ok) {
            console.warn('[TrueVision3D] Drawings save refused: ' + guard.message);
            toast(guard.message, true);
            if (report && typeof report === 'object') report.conflict = true;
            return false;
        }
        await Na__DrawData__RunSaveSteps('before', stepContext);

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
            if (registerKeys && registerKeys.cloud) Object.assign(payload, registerKeys.cloud);
            const cloudKeys = JSON.parse(JSON.stringify(payload));
            const stampIso  = new Date().toISOString();
            if (cloudKeys[Na__DrawData__BLOCK_KEY]) cloudKeys[Na__DrawData__BLOCK_KEY][Na__DrawData__SAVED_ISO_KEY] = stampIso;   // <-- When: read back by people, and by the draft's question on the next load
            Na__DrawData__ApplyPayloadGuard(cloudKeys);                              // <-- A drawing still being edited goes out as it was last updated
            stepContext.block = cloudKeys[Na__DrawData__BLOCK_KEY] || null;
            await Na__DrawData__RunSaveSteps('payload', stepContext);                // <-- The copy about to be written points at the files the before phase put in place
            const localKeys = JSON.parse(JSON.stringify(cloudKeys));                 // <-- The local copy gets exactly what R2 gets, whatever is edited during the write
            const mirrorOptions = Na__DrawData__BaseJudged ? { drawingsBase : Na__DrawData__Base } : undefined;   // <-- What this save was built on: the local server refuses it if the disk has moved on
            // DELETION | Explicit local-first mode; a local failure never reaches R2.
            let firstLocal = null;
            if (registerKeys && registerKeys.localFirst) {
                if (registerKeys.local) Object.assign(localKeys, registerKeys.local);
                firstLocal = await Na__LocalMirror__MergeKeys(localKeys, mirrorOptions);
                if (report) { report.local = firstLocal; report.localKeys = localKeys; report.localFirstWritten = !!firstLocal.ok; }
                if (!firstLocal.ok) { toast('Drawing deletion was not saved locally: ' + (firstLocal.error || 'Local server unavailable.'), true); return false; }
            }
            const result = await Na__CfApi__MergeAndSaveKeys(cloudKeys);
            if (!result || !result.ok) {
                const reason = (result && result.error) ? result.error : 'unknown error';
                toast(`Drawings save failed: ${reason}`, true);
                return false;
            }

            if (report) report.cloudSaved = true;
            Na__DrawData__GetBlock()[Na__DrawData__SAVED_ISO_KEY] = stampIso;      // <-- The live block now says when it was saved, as the copies do
            if (!Na__DrawData__BaseJudged) Na__DrawData__Base = 'iso:' + stampIso;  // <-- Unjudged (the web build): the stamp is the drawings' identity from here

            if (wasMigration) {
                Na__DrawData__MigratedFrom = null;                                   // <-- Landed; later saves are ordinary
                console.log('[TrueVision3D] Drawings migration written to R2. The legacy presentation-block keys are gone.');
            }

            window.dispatchEvent(new CustomEvent(Na__DrawData__CHANGED_EVENT, {
                detail : { reason : 'saved', projectCode : projectCode }
            }));

            // LOCAL COPY | R2 has the blocks; the repository copy takes them next.
            // A failure here costs R2 nothing, so the save still returns true, but
            // it is never silent: a caller with a report says so in its own
            // confirmation, and any other caller is shown it here as an error.
            if (registerKeys && registerKeys.local) Object.assign(localKeys, registerKeys.local);
            if (report && typeof report === 'object') report.localKeys = localKeys;
            const local = firstLocal || await Na__LocalMirror__MergeKeys(localKeys, mirrorOptions);
            if (local.ok && local.drawings) { Na__DrawData__Base = local.drawings.digest || null; Na__DrawData__BaseJudged = true; }   // <-- The file's new identity: the next save is built on this one
            if (local.conflict) console.warn('[TrueVision3D] Drawings saved to R2, but the local server refused the copy: the drawings on disk were saved elsewhere since this window loaded them. Reload before saving again.');
            else if (!local.ok && !local.skipped) console.warn('[TrueVision3D] Drawings saved to R2; the local copy was not written:', local.error);
            if (report && typeof report === 'object') report.local = local;
            else if (!local.ok && !local.skipped) toast(`Drawings saved to R2, but the local copy was not written: ${local.error}`, true);
            stepContext.local = local;
            await Na__DrawData__RunSaveSteps('after', stepContext);                  // <-- R2 has the drawings: the steps adopt their pointers and tidy up
            if (!(report && typeof report === 'object')) {
                const failed = stepNotes.filter((entry) => entry.error).map((entry) => entry.message);
                if (failed.length) toast(failed.join(' '), true);
            }
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


    // FUNCTION | Register the Guard That Keeps Unfinished Drafts Out of a Save
    // ------------------------------------------------------------
    // Called by Na__DrawView__DraftGuard__ as it loads. Passing a non-function
    // clears the registration.
    // ------------------------------------------------------------
    function Na__DrawData__RegisterPayloadGuard(guard) {
        Na__DrawData__PayloadGuard = (typeof guard === 'function') ? guard : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Register a Save Step (one per id; a second registration replaces the first)
    // ------------------------------------------------------------
    // step: { id, before(ctx), payload(ctx), after(ctx) } - any may be left
    // out, any may be async. See the SaveSteps state above for the phases.
    // ------------------------------------------------------------
    function Na__DrawData__RegisterSaveStep(step) {
        if (!step || typeof step !== 'object' || typeof step.id !== 'string' || !step.id) return false;
        const index = Na__DrawData__SaveSteps.findIndex((entry) => entry.id === step.id);
        if (index !== -1) Na__DrawData__SaveSteps.splice(index, 1);
        Na__DrawData__SaveSteps.push(step);
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Run One Phase of Every Save Step, in Registration Order
    // ------------------------------------------------------------
    async function Na__DrawData__RunSaveSteps(phase, context) {
        for (const step of Na__DrawData__SaveSteps.slice()) {
            if (typeof step[phase] !== 'function') continue;
            try {
                await step[phase](context);
            } catch (stepError) {
                console.warn(`[TrueVision3D] Save step "${step.id}" failed in its ${phase} phase; the drawings save goes on.`, stepError);
                context.note(`${step.id}: ${(stepError && stepError.message) || 'failed'}.`, true);
            }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Run the Guard Over a Payload Copy
    // ------------------------------------------------------------
    // A guard that throws must not cost the save: the payload then goes out as
    // it stood, which is what happened before there was a guard at all.
    // ------------------------------------------------------------
    function Na__DrawData__ApplyPayloadGuard(payloadCopy) {
        if (!Na__DrawData__PayloadGuard) return;
        try {
            Na__DrawData__PayloadGuard(payloadCopy);
        } catch (guardError) {
            console.warn('[TrueVision3D] Drawings payload guard failed; saving the block as it stands.', guardError);
        }
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
        Na__DrawData__RegisterPayloadGuard,
        Na__DrawData__RegisterSaveStep,
        Na__DrawData__GetBlock,
        Na__DrawData__Load,
        Na__DrawData__GetProjectCode,
        Na__DrawData__IsLoaded,
        Na__DrawData__GetBase,
        Na__DrawData__WhenBaseKnown,
        Na__DrawData__GetFloorPlansArray,
        Na__DrawData__GetElevationsArray,
        Na__DrawData__GetSheetsArray,
        Na__DrawData__GetClientDimensionsEnabled,
        Na__DrawData__SetClientDimensionsEnabled,
        Na__DrawData__GetCommonFields,
        Na__DrawData__SetCommonField,
        Na__DrawData__IsFloorPlanScene,
        Na__DrawData__IsElevationScene,
        Na__DrawData__IsDrawingScene,
        Na__DrawData__Save
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
