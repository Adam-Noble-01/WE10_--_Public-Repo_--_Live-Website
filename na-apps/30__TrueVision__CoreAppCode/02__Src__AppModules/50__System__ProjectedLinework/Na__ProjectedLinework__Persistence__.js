// =============================================================================
// TRUEVISION3D - PROJECTED LINEWORK - PERSISTENCE
// =============================================================================
//
// FILE       : Na__ProjectedLinework__Persistence__.js
// NAMESPACE  : Na__PlStore
// MODULE     : Projected Linework - Persistence
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Keep rendered linework as an R2 asset per drawing, and know when it is stale
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - Turns a rendered result into a JSON block and back, stores the block as
//   a project asset on R2 (plan decision D20) with a reference in the drawing
//   record, and keeps a copy in the browser so a reload does not refetch.
//
// - THREE GATES ON LOAD, exactly as the Lantern Designer reads its block: the
//   schema version, the model build token, and the fingerprint of the model
//   state and record that produced it. Fail any and the block is ignored;
//   the pipeline renders afresh, which is always safe.
//
// - THE SHAPE OF WHAT IS WRITTEN. Plain numbers in plain arrays, four per
//   segment, in drawing millimetres, one array per line class, rounded to
//   two decimals. Something other than this module should be able to read
//   it later without finding this file first.
//
// - BAKING. Save Floor Plans and Save Elevations call BakeBeforeSave, which
//   renders every drawing whose asset is missing or stale, uploads it, and
//   writes the reference into the record before the project save. The web
//   build then loads the asset and only computes when it is missing.
//
// INTEGRATION:
// - Na__ProjectedLinework__Pipeline__ loads through LoadForDefinition; the
//   drawing editors and the Dev menu bake.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 50__System__ProjectedLinework/Na__ProjectedLinework__Persistence__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : verbatim
// - Divergences   : Console prefix, header and folder numbers only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.1.0
// - RememberRender keeps a fresh render in IndexedDB so a reload paints without computing.
// - BakeAll and BakeBeforeSave skip drawings with Projected Linework off unless a caller names them (sheet viewports) or forces.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 4.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Asset Upload, URL Resolution, Project Code
    // ------------------------------------------------------------
    import { Na__AppUtils__R2AssetUpload } from '../03__AppUtils/Na__AppUtils__R2AssetUpload__.js';
    import {
        Na__AppUtils__ResolveAssetUrl,
        Na__AppUtils__NormalizeProjectFolderId,
        Na__AppUtils__IsRunningOnLocalhost
    } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    import { Na__DrawData__GetProjectCode } from '../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Config, Views, Stage and the Pipeline's Render
    // ------------------------------------------------------------
    import {
        Na__PlCfg__IsEnabled,
        Na__PlCfg__GetPersistenceSetup,
        Na__PlCfg__GetModelSetup,
        Na__PlCfg__GetLabel
    } from './Na__ProjectedLinework__ConfigAccess__.js';
    import {
        Na__PlView__FromAllDrawings,
        Na__PlView__Fingerprint,
        Na__PlView__CacheKey
    } from './Na__ProjectedLinework__ViewDefinition__.js';
    import {
        Na__PlPipe__RenderDefinition,
        Na__PlPipe__Remember,
        Na__PlPipe__GetCached,
        Na__PlPipe__GetModelFingerprint
    } from './Na__ProjectedLinework__Pipeline__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Block Identity and Record Slots
    // ------------------------------------------------------------
    const Na__PlStore__SCHEMA_VERSION = 1;
    const Na__PlStore__DECIMALS       = 2;
    const Na__PlStore__FACTOR         = Math.pow(10, Na__PlStore__DECIMALS);
    const Na__PlStore__CLASSES        = [ 'visible', 'hidden', 'authored', 'section' ];
    const Na__PlStore__SLOT_PLAN      = 'FloorPlan__LineworkAsset';
    const Na__PlStore__SLOT_ELEVATION = 'Elevation__LineworkAsset';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Browser Cache (IndexedDB)
    // ------------------------------------------------------------
    const Na__PlStore__DB_NAME  = 'TrueVision3D__ProjectedLinework';
    const Na__PlStore__DB_STORE = 'blocks';
    let   Na__PlStore__DbPromise = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Block Shape
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Round One Segment Buffer for Storage
    // ------------------------------------------------------------
    function Na__PlStore__RoundBuffer(segments) {
        const out = new Array(segments.length);
        for (let i = 0; i < segments.length; i++) out[i] = Math.round(segments[i] * Na__PlStore__FACTOR) / Na__PlStore__FACTOR;
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Asset Block From a Rendered Result
    // ------------------------------------------------------------
    // Returns null when a class is over the storage ceiling, which the caller
    // treats as "do not bake" rather than as "bake half a drawing".
    // ------------------------------------------------------------
    function Na__PlStore__Serialise(definition, classes, meta) {
        const setup   = Na__PlCfg__GetPersistenceSetup();
        const blocks  = {};
        let   total   = 0;

        for (let i = 0; i < Na__PlStore__CLASSES.length; i++) {
            const name     = Na__PlStore__CLASSES[i];
            const segments = classes[name] || new Float32Array(0);
            const count    = Math.floor(segments.length / 4);
            if (count > setup.maxSegmentsPerView) {
                console.warn('[TrueVision3D ProjectedLinework] ' + definition.ViewKey + ' ' + name + ' has ' + count +
                             ' segments, over the ' + setup.maxSegmentsPerView + ' storage ceiling. Not baked.');
                return null;
            }
            total += count;
            blocks[name] = { SegmentCount : count, Coordinates : Na__PlStore__RoundBuffer(segments) };
        }

        const stamp = new Date();
        return {
            Meta : {
                Description        : 'Projected linework for one TrueVision drawing, rendered from the model and stored so the web build never computes it. Coordinates are drawing millimetres, x right and y down, four numbers per segment: x0, y0, x1, y1. A plan reads world X and world Z; an elevation reads the run along the facade and minus the height. Ignore the block if Fingerprint does not match the drawing and model you hold.',
                SchemaVersion      : Na__PlStore__SCHEMA_VERSION,
                ModelBuildToken    : Na__PlCfg__GetModelSetup().buildToken,
                DrawingId          : definition.DrawingId,
                ViewKey            : definition.ViewKey,
                Kind               : definition.Kind,
                Fingerprint        : meta.Fingerprint,
                RenderedAtIso      : stamp.toISOString(),
                RenderedAtEpochMs  : stamp.getTime(),
                Backend            : meta.Backend || 'unknown',
                CoordinateSpace    : 'drawing millimetres, x right, y down',
                CoordinateOrder    : 'x0, y0, x1, y1',
                CoordinateDecimals : Na__PlStore__DECIMALS,
                SegmentCount       : total
            },
            Classes : blocks
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Recover the Classes From an Asset Block (null when refused)
    // ------------------------------------------------------------
    function Na__PlStore__Deserialise(block, fingerprint) {
        if (!block || !block.Meta || !block.Classes) return null;
        if (block.Meta.SchemaVersion !== Na__PlStore__SCHEMA_VERSION) {
            console.info('[TrueVision3D ProjectedLinework] Stored linework is schema v' + block.Meta.SchemaVersion + '; ignoring it.');
            return null;
        }
        if (block.Meta.ModelBuildToken !== Na__PlCfg__GetModelSetup().buildToken) {
            console.info('[TrueVision3D ProjectedLinework] Stored linework was sampled by build "' + block.Meta.ModelBuildToken + '"; ignoring it.');
            return null;
        }
        if (!fingerprint || block.Meta.Fingerprint !== fingerprint) {
            console.info('[TrueVision3D ProjectedLinework] Stored linework belongs to an earlier state of this drawing; ignoring it.');
            return null;
        }

        const classes = {};
        for (let i = 0; i < Na__PlStore__CLASSES.length; i++) {
            const name  = Na__PlStore__CLASSES[i];
            const entry = block.Classes[name];
            const coordinates = (entry && Array.isArray(entry.Coordinates)) ? entry.Coordinates : [];
            const usable = Math.floor(coordinates.length / 4) * 4;
            const out    = new Float32Array(usable);
            for (let k = 0; k < usable; k++) out[k] = coordinates[k];
            classes[name] = out;
        }
        return classes;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Record Slots and Asset Paths
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Record Key Holding the Asset Reference
    // ------------------------------------------------------------
    function Na__PlStore__SlotKey(definition) {
        return definition.Kind === 'plan' ? Na__PlStore__SLOT_PLAN : Na__PlStore__SLOT_ELEVATION;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Relative Asset Path for a Drawing
    // ------------------------------------------------------------
    function Na__PlStore__AssetPath(definition) {
        const folder = Na__PlCfg__GetPersistenceSetup().assetFolder.replace(/\/+$/, '');
        return folder + '/' + String(definition.DrawingId).replace(/[^A-Za-z0-9_.-]/g, '_') + '.json';
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Asset Reference Off the Record (null when none)
    // ------------------------------------------------------------
    function Na__PlStore__GetSlot(definition) {
        const slot = definition.Record ? definition.Record[Na__PlStore__SlotKey(definition)] : null;
        return (slot && typeof slot === 'object' && typeof slot.Asset__Path === 'string') ? slot : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Write the Asset Reference Onto the Record
    // ------------------------------------------------------------
    function Na__PlStore__SetSlot(definition, info) {
        if (!definition.Record) return false;
        definition.Record[Na__PlStore__SlotKey(definition)] = info ? {
            Asset__Path          : info.Path,
            Asset__Fingerprint   : info.Fingerprint,
            Asset__SegmentCount  : info.SegmentCount,
            Asset__RenderedAtIso : info.RenderedAtIso,
            Asset__SchemaVersion : Na__PlStore__SCHEMA_VERSION
        } : null;
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Drawing's Asset Cached, Stale or Missing for This Model State?
    // ------------------------------------------------------------
    function Na__PlStore__AssetStatus(definition, modelFingerprint) {
        const slot = Na__PlStore__GetSlot(definition);
        if (!slot) return 'missing';
        return slot.Asset__Fingerprint === Na__PlView__Fingerprint(definition, modelFingerprint) ? 'cached' : 'stale';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Browser Cache (IndexedDB)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Open the Database Once
    // ------------------------------------------------------------
    function Na__PlStore__Db() {
        if (Na__PlStore__DbPromise) return Na__PlStore__DbPromise;
        Na__PlStore__DbPromise = new Promise((resolve) => {
            try {
                if (typeof indexedDB === 'undefined') { resolve(null); return; }
                const request = indexedDB.open(Na__PlStore__DB_NAME, 1);
                request.onupgradeneeded = () => { request.result.createObjectStore(Na__PlStore__DB_STORE); };
                request.onsuccess = () => resolve(request.result);
                request.onerror   = () => resolve(null);
            } catch (openError) {
                resolve(null);
            }
        });
        return Na__PlStore__DbPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read a Block From the Browser Cache (null when absent)
    // ------------------------------------------------------------
    async function Na__PlStore__ReadFromBrowser(cacheKey) {
        if (!Na__PlCfg__GetPersistenceSetup().cacheInBrowser) return null;
        const db = await Na__PlStore__Db();
        if (!db) return null;
        return new Promise((resolve) => {
            try {
                const request = db.transaction(Na__PlStore__DB_STORE, 'readonly').objectStore(Na__PlStore__DB_STORE).get(cacheKey);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror   = () => resolve(null);
            } catch (readError) {
                resolve(null);
            }
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Keep a Block in the Browser Cache (best effort)
    // ------------------------------------------------------------
    async function Na__PlStore__StoreInBrowser(cacheKey, block) {
        if (!Na__PlCfg__GetPersistenceSetup().cacheInBrowser) return false;
        const db = await Na__PlStore__Db();
        if (!db) return false;
        return new Promise((resolve) => {
            try {
                const request = db.transaction(Na__PlStore__DB_STORE, 'readwrite').objectStore(Na__PlStore__DB_STORE).put(block, cacheKey);
                request.onsuccess = () => resolve(true);
                request.onerror   = () => resolve(false);
            } catch (writeError) {
                resolve(false);
            }
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fetch the Asset From R2, Falling Back to GitHub Pages
    // ------------------------------------------------------------
    async function Na__PlStore__FetchAsset(relativePath) {
        const folderId = Na__AppUtils__NormalizeProjectFolderId(Na__DrawData__GetProjectCode());
        if (!folderId) return null;
        const urls = Na__AppUtils__ResolveAssetUrl(folderId, relativePath);
        const tries = [ urls.primary, urls.fallback ].filter((u, i, all) => u && all.indexOf(u) === i);

        for (let i = 0; i < tries.length; i++) {
            try {
                const response = await fetch(tries[i], { cache : 'no-cache' });
                if (response.ok) return await response.json();
            } catch (fetchError) { /* try the next */ }
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Find Stored Linework for a Definition (null when none usable)
    // ------------------------------------------------------------
    // The browser copy first, then the record's asset when its fingerprint
    // matches. A fetched block is kept in the browser for next time.
    // ------------------------------------------------------------
    async function Na__PlStore__LoadForDefinition(definition, fingerprint, cacheKey) {
        if (!Na__PlCfg__GetPersistenceSetup().enabled) return null;

        const local = await Na__PlStore__ReadFromBrowser(cacheKey);
        if (local) {
            const classes = Na__PlStore__Deserialise(local, fingerprint);
            if (classes) return classes;
        }

        const slot = Na__PlStore__GetSlot(definition);
        if (!slot || slot.Asset__Fingerprint !== fingerprint) return null;    // <-- Stale or absent: not worth a fetch

        const block = await Na__PlStore__FetchAsset(slot.Asset__Path);
        if (!block) return null;

        const classes = Na__PlStore__Deserialise(block, fingerprint);
        if (classes) void Na__PlStore__StoreInBrowser(cacheKey, block);
        return classes;
    }
    // ------------------------------------------------------------


    // FUNCTION | Keep a Fresh Render in the Browser So a Reload Never Recomputes It
    // ------------------------------------------------------------
    // result: { Classes, Fingerprint, CacheKey, Report } from the pipeline.
    // Over the storage ceiling nothing is written (Serialise refuses).
    // ------------------------------------------------------------
    async function Na__PlStore__RememberRender(definition, result) {
        if (!definition || !result || !result.Classes || !result.CacheKey) return false;
        if (!Na__PlCfg__GetPersistenceSetup().enabled) return false;
        const block = Na__PlStore__Serialise(definition, result.Classes, { Fingerprint : result.Fingerprint, Backend : result.Report ? result.Report.Backend : 'cpu' });
        if (!block) return false;
        return Na__PlStore__StoreInBrowser(result.CacheKey, block);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Baking
// -----------------------------------------------------------------------------

    // FUNCTION | Render (if needed), Upload and Reference One Drawing's Linework
    // ------------------------------------------------------------
    // Returns 'baked' | 'skipped' | 'refused' | 'failed'.
    // ------------------------------------------------------------
    async function Na__PlStore__BakeOne(definition, modelFingerprint, showToast, force) {
        if (!force && Na__PlStore__AssetStatus(definition, modelFingerprint) === 'cached') return 'skipped';

        const fingerprint = Na__PlView__Fingerprint(definition, modelFingerprint);
        const cacheKey    = Na__PlView__CacheKey(definition, modelFingerprint);
        let   classes     = Na__PlPipe__GetCached(definition);
        let   backend     = 'cache';

        if (!classes) {
            const result = await Na__PlPipe__RenderDefinition(definition, null, null, null);
            classes = result.Classes;
            backend = result.Report.Backend;
            Na__PlPipe__Remember(cacheKey, definition, classes, fingerprint, 'render');
        }

        const block = Na__PlStore__Serialise(definition, classes, { Fingerprint : fingerprint, Backend : backend });
        if (!block) return 'refused';

        const path   = Na__PlStore__AssetPath(definition);
        const result = await Na__AppUtils__R2AssetUpload(block, Na__DrawData__GetProjectCode(), path, showToast);
        if (!result || !result.r2Success) return 'failed';

        Na__PlStore__SetSlot(definition, {
            Path          : path,
            Fingerprint   : fingerprint,
            SegmentCount  : block.Meta.SegmentCount,
            RenderedAtIso : block.Meta.RenderedAtIso
        });
        void Na__PlStore__StoreInBrowser(cacheKey, block);
        return 'baked';
    }
    // ------------------------------------------------------------


    // FUNCTION | Bake Every Drawing Whose Asset Is Missing or Stale
    // ------------------------------------------------------------
    // options: { showToast, force, onProgress({ index, total, name }) }
    // Returns { baked, skipped, refused, failed }.
    // ------------------------------------------------------------
    async function Na__PlStore__BakeAll(options) {
        const settings = options || {};
        const counts   = { baked : 0, skipped : 0, refused : 0, failed : 0, off : 0 };
        if (!Na__PlCfg__IsEnabled() || !Na__PlCfg__GetPersistenceSetup().enabled) return counts;

        const definitions      = Na__PlView__FromAllDrawings();
        const modelFingerprint = Na__PlPipe__GetModelFingerprint();
        if (modelFingerprint === 'no-model') return counts;                      // <-- Nothing loaded: nothing to bake

        // ONLY WHAT ASKS | A drawing with Projected Linework off is never
        // computed; a sheet viewport that wants it names the drawing in
        // includeDrawingIds. force bakes everything regardless.
        const wanted = new Set(Array.isArray(settings.includeDrawingIds) ? settings.includeDrawingIds : (settings.includeDrawingIds instanceof Set ? Array.from(settings.includeDrawingIds) : []));
        for (let i = 0; i < definitions.length; i++) {
            const definition = definitions[i];
            if (settings.force !== true && !definition.Styles.projectedLinework && !wanted.has(definition.DrawingId)) { counts.off++; continue; }
            if (typeof settings.onProgress === 'function') settings.onProgress({ index : i + 1, total : definitions.length, name : definition.DrawingName });
            try {
                const outcome = await Na__PlStore__BakeOne(definition, modelFingerprint, settings.showToast, settings.force === true);
                counts[outcome]++;
            } catch (bakeError) {
                console.error('[TrueVision3D ProjectedLinework] Bake failed for ' + definition.ViewKey + ':', bakeError);
                counts.failed++;
            }
        }
        return counts;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Save Hook: Bake on Localhost, Then Let the Save Proceed
    // ------------------------------------------------------------
    // Never throws and never blocks a save: a failed bake costs a compute on
    // the web build, not a lost project.json.
    // ------------------------------------------------------------
    async function Na__PlStore__BakeBeforeSave(showToast, includeDrawingIds) {
        if (!Na__AppUtils__IsRunningOnLocalhost()) return null;
        if (!Na__PlCfg__IsEnabled() || !Na__PlCfg__GetPersistenceSetup().bakeOnSave) return null;

        try {
            const counts = await Na__PlStore__BakeAll({ showToast : showToast, includeDrawingIds : includeDrawingIds });
            if (counts.baked > 0 && typeof showToast === 'function') {
                showToast(Na__PlCfg__GetLabel('BakedMessage', 'Linework baked to R2.') + ' (' + counts.baked + ')', false);
            }
            if (counts.failed > 0 && typeof showToast === 'function') {
                showToast(Na__PlCfg__GetLabel('BakeFailedMessage', 'Linework bake failed - see console.'), true);
            }
            return counts;
        } catch (bakeError) {
            console.error('[TrueVision3D ProjectedLinework] Bake before save failed:', bakeError);
            return null;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Projected Linework Persistence API
    // ------------------------------------------------------------
    export {
        Na__PlStore__Serialise,
        Na__PlStore__Deserialise,
        Na__PlStore__AssetPath,
        Na__PlStore__GetSlot,
        Na__PlStore__SetSlot,
        Na__PlStore__AssetStatus,
        Na__PlStore__LoadForDefinition,
        Na__PlStore__RememberRender,
        Na__PlStore__BakeOne,
        Na__PlStore__BakeAll,
        Na__PlStore__BakeBeforeSave
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
