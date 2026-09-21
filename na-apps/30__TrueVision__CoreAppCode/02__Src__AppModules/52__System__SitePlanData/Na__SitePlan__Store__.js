// =============================================================================
// TRUEVISION3D - SITE PLAN DATA - STORE
// =============================================================================
//
// FILE       : Na__SitePlan__Store__.js
// NAMESPACE  : Na__SpStore
// MODULE     : Site Plan Data - Store
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Find the project's site plan data and load its layers for site plan drawings
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A project holds up to TWO site plan stores under 30__TrueVision__AppContent:
//     SitePlan__DrawingData__Existing    the site as found
//     SitePlan__DrawingData__Proposed    the scheme
//   and, for a project that pre-dates the split, the original single folder
//   SitePlan__DrawingData, which is read as the PROPOSED store and is never
//   renamed - live projects and published R2 keys point at that name.
//   Each holds a linework GLB per site plan tag (71-75), a fill GLB for a fill
//   tag with faces, and TrueVision__SitePlanData__Manifest__.json, all written
//   by the GLB Builder's Site Plan Export.
// - CATEGORY KEYS ARE QUALIFIED BY STORE, and the default store's qualifier is
//   EMPTY. So the proposed store's keys stay exactly as they were
//   (TrueVision__SitePlan__OsMapping) and the existing store's carry a suffix
//   (TrueVision__SitePlan__OsMapping@existing). Every viewport saved before the
//   split keeps its layer toggles and edge overrides with no migration, because
//   its keys are still the keys the proposed store publishes. This is the same
//   shape as Sheet__DrawingType and Viewport__ShowFrame: the default is absent.
//   Both forms still begin TrueVision__SitePlan__, which is what
//   Na__LeRec__SITEPLAN_CATEGORY_PREFIX tests.
// - WHERE THE LAYER LIST COMES FROM, per store. The ProjectVision build
//   registers each folder in the project data - SitePlan__DataStores (an array),
//   or the legacy single SitePlan__DataStore - with CDN URLs.
//   - Web build: that key first, then the store's manifest on the CDN.
//   - Localhost - the authoring machine, where the export has just written the
//     repository copy: the local manifest first, then the key, then the CDN.
//     A fresh export draws without a build or a sync.
//   Both sources become one descriptor in the build's own schema
//   (SitePlan__..., Layer__...), except that bounds are drawing millimetres
//   { MinX, MinY, MaxX, MaxY } - drawing y is +world Z.
// - LAZY, PER STORE. Nothing is fetched until a site plan drawing asks. Each
//   layer loads once, linework and fill together. The cache key is the qualified
//   layer key and its store's export time, and the export time rides on each GLB
//   URL as ?v=, so a re-export is never served stale by the browser, the service
//   worker or the CDN.
// - NEVER ENTERS THE 3D SCENE. The lines stay out of the model root, the phase
//   library, the category toggles, walk collision and the profile line caches:
//   they are 2D drawing data only.
// - Status and loaded layers go out on na-siteplan-store-changed.
//
// INTEGRATION:
// - Reads the loaded project data through Na__CfApi__GetLoadedProjectData.
// - Read by the Layout Editor's site plan viewports.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.2.0
// - A FILL LAYER MAY HAVE NO LINEWORK. Since Site Plan Export 1.4.0 a fill tag
//   whose faces carried no edges of their own ships its fill GLB alone, so Adam can
//   wash a drive or a patio by tagging just its FACE. Na__SpStore__Layer used to
//   drop any layer without a linework URL, and LoadLayer always fetched linework
//   first - so the wash vanished twice over. A faces-only layer now loads with no
//   segments and its rings, takes its bounds from the fill, and REJECTS if that
//   fill fails (it is the whole layer) instead of caching an empty one.
//
// 20-Sep-2026 - Version 1.1.0
// - TWO STORES PER PROJECT, Existing and Proposed. Every piece of session state
//   that was a single value is now keyed by store id, and every reader takes an
//   optional store id. Called with none, a reader answers for the DEFAULT store
//   (proposed) where one answer is wanted, and across EVERY store where a list
//   is wanted - so Model Layers lists both stores without knowing they exist.
// - Category keys are qualified by store, with the default store's qualifier
//   empty, so no saved viewport needs migrating. Na__SpStore__QualifyKey,
//   __SplitKey and __StoreIdForKey are the only places that know the shape.
// - Reads SitePlan__DataStores (array) and still reads the legacy single
//   SitePlan__DataStore as the proposed store.
//
// 14-Sep-2026 - Version 1.0.1
// - Fix: opening a site plan sheet overflowed the stack. Resolve announced
//   'loading' before recording its promise, and the Viewport panel's refresh
//   on that announcement called Resolve again, without end. The promise is now
//   recorded first, and every announcement goes out on a microtask.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation for site plan drawings (plan Phase 4).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Project Data, Project URL and the GLB Parser
    // ------------------------------------------------------------
    import { Na__CfApi__GetLoadedProjectData } from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    import {
        Na__AppUtils__IsRunningOnLocalhost,
        Na__AppUtils__GetProjectFolderFromUrl,
        Na__AppUtils__GetYearFromUrl
    } from '../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    import { Na__SpGlb__ParseLinework, Na__SpGlb__ParseFill } from './Na__SitePlan__GlbParse__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Event, Project Data Keys and Paths (mirror the build and Na__AppUtils__ProjectLoader)
    // ------------------------------------------------------------
    const Na__SpStore__CHANGED_EVENT = 'na-siteplan-store-changed';
    const Na__SpStore__DATA_KEY      = 'SitePlan__DataStore';                   // <-- Legacy single-store key (ProjectVision 0.2.0)
    const Na__SpStore__DATA_KEY_MANY = 'SitePlan__DataStores';                  // <-- Array of stores
    const Na__SpStore__CDN_BASE      = 'https://cdn.noble-architecture.com/NaProjectPortal';
    const Na__SpStore__PORTAL_DIR    = 'na-project-portal';                     // <-- Repository folder the projects live under
    const Na__SpStore__CONTENT_DIR   = '30__TrueVision__AppContent';
    const Na__SpStore__FOLDER        = 'SitePlan__DrawingData';                 // <-- The original single folder, read as Proposed
    const Na__SpStore__MANIFEST      = 'TrueVision__SitePlanData__Manifest__.json';
    const Na__SpStore__SCHEMA        = 1;                                       // <-- Manifest schema this module reads
    const Na__SpStore__RED_LINE_STEM = 'TrueVision__SitePlan__RedLineBoundary'; // <-- The layer a new viewport centres on
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Stores A Project May Hold
    // ------------------------------------------------------------
    // Store__Folders is tried in order, so the proposed store falls back to the
    // original single folder. Store__Default names the one whose category keys
    // carry NO suffix - see Na__SpStore__QualifyKey.
    // ------------------------------------------------------------
    const Na__SpStore__STORE_EXISTING = 'existing';
    const Na__SpStore__STORE_PROPOSED = 'proposed';
    const Na__SpStore__DEFAULT_STORE  = Na__SpStore__STORE_PROPOSED;
    const Na__SpStore__KEY_SEPARATOR  = '@';

    const Na__SpStore__STORES = [
        {
            Store__Id      : Na__SpStore__STORE_EXISTING,
            Store__Label   : 'Existing Site Plan',
            Store__Short   : 'Existing',
            Store__Folders : [ 'SitePlan__DrawingData__Existing' ]
        },
        {
            Store__Id      : Na__SpStore__STORE_PROPOSED,
            Store__Label   : 'Proposed Site Plan',
            Store__Short   : 'Proposed',
            Store__Folders : [ 'SitePlan__DrawingData__Proposed', Na__SpStore__FOLDER ]
        }
    ];
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Status and Source
    // ------------------------------------------------------------
    const Na__SpStore__STATUS_IDLE    = 'idle';                                 // <-- Nothing asked for yet
    const Na__SpStore__STATUS_LOADING = 'loading';                              // <-- Finding the layer list
    const Na__SpStore__STATUS_READY   = 'ready';                                // <-- A layer list is known
    const Na__SpStore__STATUS_EMPTY   = 'empty';                                // <-- This store has no site plan data that could be read
    const Na__SpStore__SOURCE_PROJECT  = 'project-data';
    const Na__SpStore__SOURCE_MANIFEST = 'manifest';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Session State, Per Store
    // ------------------------------------------------------------
    const Na__SpStore__Statuses    = new Map();                                 // <-- Store id -> status
    const Na__SpStore__Notes       = new Map();                                 // <-- Store id -> why it is empty
    const Na__SpStore__Descriptors = new Map();                                 // <-- Store id -> descriptor or null
    const Na__SpStore__Pendings    = new Map();                                 // <-- Store id -> the one resolve in flight
    let   Na__SpStore__Generation  = 0;                                         // <-- Bumped by Reload so a slower, older read is dropped
    const Na__SpStore__LayerPromises = new Map();                               // <-- Cache key (qualified layer and export time) -> Promise of geometry
    const Na__SpStore__LayerData     = new Map();                               // <-- Qualified category key -> geometry once loaded
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Store Identity and Key Qualification
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Store Definition for an Id (the default store for anything unknown)
    // ------------------------------------------------------------
    function Na__SpStore__Def(storeId) {
        return Na__SpStore__STORES.find((store) => store.Store__Id === storeId)
            || Na__SpStore__STORES.find((store) => store.Store__Id === Na__SpStore__DEFAULT_STORE);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Store's Category Key From a Layer Stem
    // ------------------------------------------------------------
    // The DEFAULT store's keys carry no suffix, so every viewport saved before
    // there were two stores still matches. Nothing else in the app may build or
    // split one of these keys by hand.
    // ------------------------------------------------------------
    function Na__SpStore__QualifyKey(stem, storeId) {
        if (!stem) return stem;
        if (!storeId || storeId === Na__SpStore__DEFAULT_STORE) return stem;
        return stem + Na__SpStore__KEY_SEPARATOR + storeId;
    }
    // ------------------------------------------------------------


    // FUNCTION | Split a Category Key Into { stem, storeId }
    // ------------------------------------------------------------
    function Na__SpStore__SplitKey(categoryKey) {
        const key = typeof categoryKey === 'string' ? categoryKey : '';
        const at  = key.lastIndexOf(Na__SpStore__KEY_SEPARATOR);
        if (at === -1) return { stem : key, storeId : Na__SpStore__DEFAULT_STORE };

        const storeId = key.slice(at + 1);
        const known   = Na__SpStore__STORES.some((store) => store.Store__Id === storeId);
        return known
            ? { stem : key.slice(0, at), storeId : storeId }
            : { stem : key, storeId : Na__SpStore__DEFAULT_STORE };             // <-- An '@' that is not a store id belongs to the stem
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Store a Category Key Belongs To
    // ------------------------------------------------------------
    function Na__SpStore__StoreIdForKey(categoryKey) {
        return Na__SpStore__SplitKey(categoryKey).storeId;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Announce a Change (on a microtask, never inside the caller)
    // ------------------------------------------------------------
    // A listener that asks the store for something - a panel that refreshes on
    // 'loading' and calls Resolve - must never run inside the change it is
    // hearing about. Announced synchronously, Resolve said 'loading' before it
    // had recorded its promise; the panel's Resolve started another, and the two
    // recursed until the stack ran out. The status is already set when this runs.
    // ------------------------------------------------------------
    function Na__SpStore__Dispatch(reason, categoryKey, storeId) {
        const detail = {
            reason      : reason,
            status      : Na__SpStore__GetStatus(),
            storeId     : storeId || null,
            categoryKey : categoryKey || null
        };
        queueMicrotask(() => window.dispatchEvent(new CustomEvent(Na__SpStore__CHANGED_EVENT, { detail : detail })));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Set One Store's Status and Announce It
    // ------------------------------------------------------------
    function Na__SpStore__SetStatus(storeId, status, note) {
        Na__SpStore__Statuses.set(storeId, status);
        Na__SpStore__Notes.set(storeId, note || null);
        Na__SpStore__Dispatch('status', null, storeId);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Store's Folder URLs: [{ folder, local, cdn }] (local only on localhost; [] with no project)
    // ------------------------------------------------------------
    function Na__SpStore__FolderUrls(storeId) {
        const projectFolder = Na__AppUtils__GetProjectFolderFromUrl();
        if (!projectFolder) return [];
        const year = Na__AppUtils__GetYearFromUrl();
        const onLocalhost = Na__AppUtils__IsRunningOnLocalhost();

        return Na__SpStore__Def(storeId).Store__Folders.map((folder) => {
            const path = `${year}-Projects/${projectFolder}/${Na__SpStore__CONTENT_DIR}/${folder}`;
            return {
                folder : folder,
                local  : onLocalhost ? `${window.location.origin}/${Na__SpStore__PORTAL_DIR}/${path}` : null,
                cdn    : `${Na__SpStore__CDN_BASE}/${path}`
            };
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where One File Is Read From, In Order
    // ------------------------------------------------------------
    // On localhost a CDN URL is tried first as the repository copy the export
    // wrote, then on the CDN itself; anywhere else only the URL given.
    // ------------------------------------------------------------
    function Na__SpStore__Candidates(url) {
        if (!url) return [];
        const list = [];
        if (Na__AppUtils__IsRunningOnLocalhost() && url.indexOf(Na__SpStore__CDN_BASE + '/') === 0) {
            list.push(`${window.location.origin}/${Na__SpStore__PORTAL_DIR}/` + url.slice(Na__SpStore__CDN_BASE.length + 1));
        }
        list.push(url);
        return list;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Export Time on a URL (?v=)
    // ------------------------------------------------------------
    function Na__SpStore__Versioned(url, exportedIso) {
        if (!url || !exportedIso) return url;
        return url + (url.indexOf('?') === -1 ? '?' : '&') + 'v=' + encodeURIComponent(exportedIso);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch the First URL That Answers (JSON or bytes); Throws the Last Failure
    // ------------------------------------------------------------
    async function Na__SpStore__FetchFirst(urls, asJson) {
        let lastError = null;
        for (const url of urls) {
            try {
                const response = await fetch(url, asJson ? { cache : 'no-store' } : undefined);
                if (!response.ok) { lastError = new Error(`${response.status} ${url}`); continue; }
                return asJson ? await response.json() : await response.arrayBuffer();
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error('No URL to fetch');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Exported Bounds {MinX, MinZ, MaxX, MaxZ} as Drawing Bounds {MinX, MinY, MaxX, MaxY}
    // ------------------------------------------------------------
    function Na__SpStore__Bounds(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const minY = Number.isFinite(raw.MinY) ? raw.MinY : raw.MinZ;           // <-- Drawing y equals +world Z
        const maxY = Number.isFinite(raw.MaxY) ? raw.MaxY : raw.MaxZ;
        const box  = { MinX : raw.MinX, MinY : minY, MaxX : raw.MaxX, MaxY : maxY };
        return [ box.MinX, box.MinY, box.MaxX, box.MaxY ].every(Number.isFinite) ? box : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Layer's 1-10 Z-Index, Derived When It Has None
    // ------------------------------------------------------------
    // An authored value wins. Otherwise it is DERIVED from Layer__DrawOrder, so
    // every manifest published before the Z-index existed still stacks correctly
    // with no re-export: PS01's 20 / 40 / 70 / 71 / 90 become 2 / 4 / 7 / 8 / 9,
    // which is the right hierarchy. The store's own default draw order of 50
    // derives to 5 - Adam's "buildings would be around 5".
    //
    // Layer__DrawOrder is NEVER redefined as 1-10: a published 90 would then sort
    // above every new value and the red line would end up under everything.
    // ------------------------------------------------------------
    function Na__SpStore__ZIndex(value, drawOrder) {
        if (Number.isInteger(value) && value >= 1 && value <= 10) return value;
        if (Number.isFinite(drawOrder)) return Math.min(10, Math.max(1, Math.ceil(drawOrder / 10)));
        return 5;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Layer Style With Every Field Present
    // ------------------------------------------------------------
    // A CLOSED LIST. A style field added upstream - in the Tags SSOT, the Ruby
    // exporter and the build script - reaches here intact and is then DELETED
    // unless it is named below. Add it here in the same change.
    // ------------------------------------------------------------
    function Na__SpStore__Style(raw) {
        const style = (raw && typeof raw === 'object') ? raw : {};
        const text  = (value, fallback) => (typeof value === 'string' && value) ? value : fallback;
        const num   = (value, fallback) => Number.isFinite(value) ? value : fallback;
        return {
            LineColourId   : text(style.LineColourId, null),
            LineHex        : text(style.LineHex, '#000000'),
            LineType       : text(style.LineType, 'solid'),
            LineWeightMm   : num(style.LineWeightMm, 0.25),
            LineWeightPt   : num(style.LineWeightPt, null),                     // <-- What Adam authored; the mm above is the converted figure
            LineDashScale  : num(style.LineDashScale, null),                    // <-- Shrinks this layer's dash pattern; null means the line type as drawn
            FillColourId   : text(style.FillColourId, null),
            FillMaterialId : text(style.FillMaterialId, null),                  // <-- A MAT id from the Materials SSOT
            FillHex        : text(style.FillHex, null),
            FillOpacity    : num(style.FillOpacity, null),
            HatchPatternId : text(style.HatchPatternId, null)                   // <-- Names a pattern in the hatch library
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Layer From the Project Data Key or the Manifest (null when it has neither linework nor a fill)
    // ------------------------------------------------------------
    // A FILL LAYER MAY HAVE NO LINEWORK. Since Site Plan Export 1.4.0 a fill tag
    // whose faces carried no edges of their own ships its fill GLB alone - the
    // natural way to wash an area is to tag just its FACE. Dropping such a layer
    // here, as this did, dropped the wash with it.
    // ------------------------------------------------------------
    function Na__SpStore__Layer(raw, source, folderUrl, storeId) {
        if (!raw || typeof raw !== 'object' || typeof raw.Layer__CategoryKey !== 'string' || !raw.Layer__CategoryKey) return null;
        const fromManifest = source === Na__SpStore__SOURCE_MANIFEST;
        const url = (urlKey, fileKey) => {
            if (!fromManifest) return (typeof raw[urlKey] === 'string' && raw[urlKey]) ? raw[urlKey] : null;
            return (typeof raw[fileKey] === 'string' && raw[fileKey] && folderUrl) ? `${folderUrl.cdn}/${raw[fileKey]}` : null;
        };
        const stem  = raw.Layer__CategoryKey;
        const layer = {
            Layer__CategoryKey     : Na__SpStore__QualifyKey(stem, storeId),    // <-- Qualified; the stem alone is not unique across stores
            Layer__Stem            : stem,
            Layer__StoreId         : storeId,
            Layer__TagName         : typeof raw.Layer__TagName === 'string' ? raw.Layer__TagName : '',
            Layer__Label           : (typeof raw.Layer__Label === 'string' && raw.Layer__Label) ? raw.Layer__Label : stem,
            Layer__Group           : typeof raw.Layer__Group === 'string' ? raw.Layer__Group : '',
            Layer__DrawOrder       : Number.isFinite(raw.Layer__DrawOrder) ? raw.Layer__DrawOrder : 50,
            Layer__ZIndexLine      : Na__SpStore__ZIndex(raw.Layer__ZIndexLine, raw.Layer__DrawOrder),
            Layer__ZIndexFill      : Na__SpStore__ZIndex(raw.Layer__ZIndexFill, raw.Layer__DrawOrder),
            Layer__LineworkUrl     : url('Layer__LineworkUrl', 'Layer__LineworkFile'),
            Layer__FillUrl         : url('Layer__FillUrl', 'Layer__FillFile'),
            Layer__Style           : Na__SpStore__Style(raw.Layer__Style),
            Layer__VisibleAtScales : Array.isArray(raw.Layer__VisibleAtScales) ? raw.Layer__VisibleAtScales.filter(Number.isFinite) : [],
            Layer__SegmentCount    : Number.isFinite(raw.Layer__SegmentCount) ? raw.Layer__SegmentCount : null,
            Layer__BoundsMm        : Na__SpStore__Bounds(raw.Layer__BoundsMm)
        };
        return (layer.Layer__LineworkUrl || layer.Layer__FillUrl) ? layer : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Whole Store From the Project Data Key or the Manifest
    // ------------------------------------------------------------
    function Na__SpStore__Describe(raw, source, folderUrl, storeId) {
        const fromManifest = source === Na__SpStore__SOURCE_MANIFEST;
        const pick   = (manifestKey, dataKey) => raw[fromManifest ? manifestKey : dataKey];
        const layers = (Array.isArray(pick('SitePlanData__Layers', 'SitePlan__Layers')) ? pick('SitePlanData__Layers', 'SitePlan__Layers') : [])
            .map((entry) => Na__SpStore__Layer(entry, source, folderUrl, storeId))
            .filter(Boolean)
            .sort((a, b) => (a.Layer__DrawOrder - b.Layer__DrawOrder)
                         || a.Layer__CategoryKey.localeCompare(b.Layer__CategoryKey));   // <-- Stable across exports, so byte offsets do not shuffle
        const north = pick('SitePlanData__NorthAngleDeg', 'SitePlan__NorthAngleDeg');
        return {
            SitePlan__StoreId       : storeId,
            SitePlan__StoreLabel    : Na__SpStore__Def(storeId).Store__Label,
            SitePlan__FolderName    : folderUrl ? folderUrl.folder : null,
            SitePlan__Source        : source,
            SitePlan__ExportedIso   : pick('SitePlanData__ExportedIso', 'SitePlan__ExportedIso') || null,
            SitePlan__NorthAngleDeg : Number.isFinite(north) ? north : 0,
            SitePlan__BoundsMm      : Na__SpStore__Bounds(pick('SitePlanData__BoundsMm', 'SitePlan__BoundsMm')),
            SitePlan__Layers        : layers
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Project Data Blocks, Keyed By Store Id
    // ------------------------------------------------------------
    // SitePlan__DataStores is the array the build writes now. A project built
    // before the split carries the single SitePlan__DataStore, which IS the
    // proposed store.
    // ------------------------------------------------------------
    function Na__SpStore__ProjectDataBlocks() {
        const projectData = Na__CfApi__GetLoadedProjectData();
        const blocks = new Map();
        if (!projectData) return blocks;

        const many = projectData[Na__SpStore__DATA_KEY_MANY];
        if (Array.isArray(many)) {
            many.forEach((block) => {
                if (!block || typeof block !== 'object') return;
                const id = typeof block.SitePlan__StoreId === 'string' ? block.SitePlan__StoreId : Na__SpStore__DEFAULT_STORE;
                if (!blocks.has(id)) blocks.set(id, block);
            });
        }

        const one = projectData[Na__SpStore__DATA_KEY];
        if (one && typeof one === 'object' && !blocks.has(Na__SpStore__DEFAULT_STORE)) {
            blocks.set(Na__SpStore__DEFAULT_STORE, one);
        }
        return blocks;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Look in Every Place for One Store, In Order; Never Throws
    // ------------------------------------------------------------
    async function Na__SpStore__Find(storeId) {
        const folderUrls = Na__SpStore__FolderUrls(storeId);
        const notes = [];

        const fromManifest = async (manifestUrl, folderUrl) => {
            try {
                const manifest = await Na__SpStore__FetchFirst([ manifestUrl ], true);
                if (Number.isFinite(manifest.SitePlanData__SchemaVersion) && manifest.SitePlanData__SchemaVersion > Na__SpStore__SCHEMA) {
                    console.warn(`[TrueVision3D] Site plan manifest schema ${manifest.SitePlanData__SchemaVersion} is newer than this app reads (${Na__SpStore__SCHEMA}); reading what it recognises.`);
                }
                const described = Na__SpStore__Describe(manifest, Na__SpStore__SOURCE_MANIFEST, folderUrl, storeId);
                if (described.SitePlan__Layers.length) return described;
                notes.push(`the manifest lists no layers (${manifestUrl})`);
            } catch (error) {
                notes.push(String(error && error.message ? error.message : error));
            }
            return null;
        };

        for (const folderUrl of folderUrls) {                                   // <-- Named folder first, then the original one
            if (!folderUrl.local) continue;
            const local = await fromManifest(`${folderUrl.local}/${Na__SpStore__MANIFEST}`, folderUrl);
            if (local) return { descriptor : local, note : null };
        }

        const block = Na__SpStore__ProjectDataBlocks().get(storeId);
        if (block) {
            const described = Na__SpStore__Describe(block, Na__SpStore__SOURCE_PROJECT, folderUrls[0] || null, storeId);
            if (described.SitePlan__Layers.length) return { descriptor : described, note : null };
            notes.push(`the ${storeId} store lists no layers in the project data`);
        }

        if (folderUrls.length) {
            for (const folderUrl of folderUrls) {
                const remote = await fromManifest(`${folderUrl.cdn}/${Na__SpStore__MANIFEST}`, folderUrl);
                if (remote) return { descriptor : remote, note : null };
            }
        } else {
            notes.push('the page URL names no project folder');
        }

        return { descriptor : null, note : notes.join('; ') };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Find One Store's Layer List Once (resolves its descriptor, or null when it has none)
    // ------------------------------------------------------------
    function Na__SpStore__Resolve(storeId) {
        const id     = Na__SpStore__Def(storeId).Store__Id;
        const status = Na__SpStore__Statuses.get(id) || Na__SpStore__STATUS_IDLE;

        if (status === Na__SpStore__STATUS_READY || status === Na__SpStore__STATUS_EMPTY) {
            return Promise.resolve(Na__SpStore__Descriptors.get(id) || null);
        }
        if (Na__SpStore__Pendings.has(id)) return Na__SpStore__Pendings.get(id);

        const generation = Na__SpStore__Generation;
        const pending = Na__SpStore__Find(id).then((found) => {
            if (generation !== Na__SpStore__Generation) return Na__SpStore__Resolve(id);   // <-- Reloaded meanwhile: follow the newer read
            Na__SpStore__Pendings.delete(id);
            Na__SpStore__Descriptors.set(id, found.descriptor);
            if (found.descriptor) {
                console.log(`[TrueVision3D] Site plan data (${id}): ${found.descriptor.SitePlan__Layers.length} layer(s) from the ${found.descriptor.SitePlan__Source}, folder ${found.descriptor.SitePlan__FolderName || 'unknown'}, exported ${found.descriptor.SitePlan__ExportedIso || 'at an unknown time'}.`);
                Na__SpStore__SetStatus(id, Na__SpStore__STATUS_READY, null);
            } else {
                console.log(`[TrueVision3D] No ${id} site plan data for this project: ${found.note}`);
                Na__SpStore__SetStatus(id, Na__SpStore__STATUS_EMPTY, found.note);
            }
            return found.descriptor;
        });
        Na__SpStore__Pendings.set(id, pending);
        Na__SpStore__SetStatus(id, Na__SpStore__STATUS_LOADING, null);          // <-- Only once the promise is recorded, so a listener's Resolve joins it
        return pending;
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve Every Store (so the project's whole site plan picture is known)
    // ------------------------------------------------------------
    function Na__SpStore__ResolveAll() {
        return Promise.all(Na__SpStore__STORES.map((store) => Na__SpStore__Resolve(store.Store__Id)));
    }
    // ------------------------------------------------------------


    // FUNCTION | Forget Everything and Look Again (after a new export while the app is open)
    // ------------------------------------------------------------
    function Na__SpStore__Reload() {
        Na__SpStore__Generation += 1;
        Na__SpStore__Pendings.clear();
        Na__SpStore__Descriptors.clear();
        Na__SpStore__Statuses.clear();
        Na__SpStore__Notes.clear();
        Na__SpStore__LayerPromises.clear();
        Na__SpStore__LayerData.clear();
        Na__SpStore__Dispatch('reload', null, null);
        return Na__SpStore__ResolveAll();
    }
    // ------------------------------------------------------------


    // FUNCTION | Load One Layer's Geometry Once (resolves null for a layer no store lists)
    // ------------------------------------------------------------
    // Takes a QUALIFIED category key, which names its own store. Resolves
    // { categoryKey, storeId, layer, segments, segmentCount, rings, boundsMm }:
    // segments are [x0, y0, x1, y1, ...] and rings { face, outer, points
    // [x, y, ...] }, all in drawing millimetres. A fill that fails to load is
    // reported and the layer draws its lines alone; a linework failure rejects
    // and is not cached, so the next ask tries again.
    // ------------------------------------------------------------
    function Na__SpStore__LoadLayer(categoryKey) {
        const storeId = Na__SpStore__StoreIdForKey(categoryKey);

        return Na__SpStore__Resolve(storeId).then((descriptor) => {
            const layer = descriptor ? descriptor.SitePlan__Layers.find((entry) => entry.Layer__CategoryKey === categoryKey) : null;
            if (!layer) return null;

            const exportedIso = descriptor.SitePlan__ExportedIso;
            const cacheKey    = categoryKey + '|' + (exportedIso || '');
            if (Na__SpStore__LayerPromises.has(cacheKey)) return Na__SpStore__LayerPromises.get(cacheKey);

            const generation = Na__SpStore__Generation;
            const promise = (async () => {
                // A FACES-ONLY FILL LAYER has no linework to fetch: its fill is the
                // whole layer, so a fill that fails to load rejects exactly as a
                // linework failure does, rather than leaving an empty layer cached.
                const facesOnly = !layer.Layer__LineworkUrl;
                const lines = facesOnly
                    ? { segments : new Float64Array(0), segmentCount : 0, boundsMm : null }
                    : Na__SpGlb__ParseLinework(await Na__SpStore__FetchFirst(Na__SpStore__Candidates(Na__SpStore__Versioned(layer.Layer__LineworkUrl, exportedIso)), false));
                let rings = [];
                let fillBoundsMm = null;
                if (layer.Layer__FillUrl) {
                    try {
                        const fillBytes = await Na__SpStore__FetchFirst(Na__SpStore__Candidates(Na__SpStore__Versioned(layer.Layer__FillUrl, exportedIso)), false);
                        const fill = Na__SpGlb__ParseFill(fillBytes);
                        rings = fill.rings;
                        fillBoundsMm = fill.boundsMm || null;
                    } catch (error) {
                        if (facesOnly) throw error;
                        console.warn(`[TrueVision3D] Site plan fill for ${categoryKey} did not load; its lines still draw.`, error);
                    }
                }
                const data = {
                    categoryKey  : categoryKey,
                    storeId      : storeId,
                    layer        : layer,
                    segments     : lines.segments,
                    segmentCount : lines.segmentCount,
                    rings        : rings,
                    boundsMm     : lines.boundsMm || fillBoundsMm
                };
                if (generation === Na__SpStore__Generation) {
                    Na__SpStore__LayerData.set(categoryKey, data);
                    Na__SpStore__Dispatch('layer-loaded', categoryKey, storeId);
                }
                return data;
            })();
            Na__SpStore__LayerPromises.set(cacheKey, promise);
            promise.catch((error) => {
                Na__SpStore__LayerPromises.delete(cacheKey);                    // <-- A failure can be retried
                console.warn(`[TrueVision3D] Site plan layer ${categoryKey} did not load.`, error);
                Na__SpStore__Dispatch('layer-failed', categoryKey, storeId);
            });
            return promise;
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Load Every Layer of One Store (resolves the geometry of those that loaded, in draw order)
    // ------------------------------------------------------------
    async function Na__SpStore__LoadAll(storeId) {
        const id = Na__SpStore__Def(storeId).Store__Id;
        const descriptor = await Na__SpStore__Resolve(id);
        if (!descriptor) return [];
        const settled = await Promise.allSettled(descriptor.SitePlan__Layers.map((layer) => Na__SpStore__LoadLayer(layer.Layer__CategoryKey)));
        return settled.filter((result) => result.status === 'fulfilled' && result.value).map((result) => result.value);
    }
    // ------------------------------------------------------------


    // FUNCTION | Readers (never fetch)
    // ------------------------------------------------------------
    // With no store id, a reader that returns ONE answer answers for the store a
    // viewport gets when it names none, and a reader that returns a LIST answers
    // across every store.
    // ------------------------------------------------------------
    function Na__SpStore__GetStatus(storeId) {
        if (storeId) return Na__SpStore__Statuses.get(Na__SpStore__Def(storeId).Store__Id) || Na__SpStore__STATUS_IDLE;

        const all = Na__SpStore__STORES.map((store) => Na__SpStore__Statuses.get(store.Store__Id) || Na__SpStore__STATUS_IDLE);
        if (all.includes(Na__SpStore__STATUS_LOADING)) return Na__SpStore__STATUS_LOADING;
        if (all.includes(Na__SpStore__STATUS_READY))   return Na__SpStore__STATUS_READY;
        if (all.every((status) => status === Na__SpStore__STATUS_EMPTY)) return Na__SpStore__STATUS_EMPTY;
        return Na__SpStore__STATUS_IDLE;
    }

    function Na__SpStore__GetNote(storeId) {
        if (storeId) return Na__SpStore__Notes.get(Na__SpStore__Def(storeId).Store__Id) || null;
        const notes = Na__SpStore__STORES
            .map((store) => Na__SpStore__Notes.get(store.Store__Id))
            .filter(Boolean);
        return notes.length ? notes[0] : null;
    }

    function Na__SpStore__GetDescriptor(storeId) {
        return Na__SpStore__Descriptors.get(Na__SpStore__Def(storeId).Store__Id) || null;
    }

    function Na__SpStore__GetLayers(storeId) {
        if (storeId) {
            const descriptor = Na__SpStore__GetDescriptor(storeId);
            return descriptor ? descriptor.SitePlan__Layers : [];
        }
        return Na__SpStore__STORES.reduce((list, store) => {
            const descriptor = Na__SpStore__Descriptors.get(store.Store__Id);
            return descriptor ? list.concat(descriptor.SitePlan__Layers) : list;
        }, []);
    }

    function Na__SpStore__GetLayerData(categoryKey) { return Na__SpStore__LayerData.get(categoryKey) || null; }
    // ------------------------------------------------------------


    // FUNCTION | What Stores This Project Actually Holds
    // ------------------------------------------------------------
    // Every store is listed, whether or not it resolved, so a panel can offer
    // one that has not been exported yet and say so. Available means it has
    // layers to draw.
    // ------------------------------------------------------------
    function Na__SpStore__GetStores() {
        return Na__SpStore__STORES.map((store) => {
            const descriptor = Na__SpStore__Descriptors.get(store.Store__Id) || null;
            return {
                Store__Id         : store.Store__Id,
                Store__Label      : store.Store__Label,
                Store__Short      : store.Store__Short,
                Store__IsDefault  : store.Store__Id === Na__SpStore__DEFAULT_STORE,
                Store__Status     : Na__SpStore__Statuses.get(store.Store__Id) || Na__SpStore__STATUS_IDLE,
                Store__FolderName : descriptor ? descriptor.SitePlan__FolderName : null,
                Store__LayerCount : descriptor ? descriptor.SitePlan__Layers.length : 0,
                Store__Available  : !!(descriptor && descriptor.SitePlan__Layers.length)
            };
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Store a Viewport Gets When It Names None
    // ------------------------------------------------------------
    // The default store when it has data, so every viewport saved before the
    // split paints exactly what it painted before. Otherwise the only store that
    // does - which is what a project holding an Existing site plan alone needs.
    // ------------------------------------------------------------
    function Na__SpStore__DefaultStoreId() {
        const available = Na__SpStore__GetStores().filter((store) => store.Store__Available);
        if (!available.length) return Na__SpStore__DEFAULT_STORE;
        const preferred = available.find((store) => store.Store__IsDefault);
        return preferred ? preferred.Store__Id : available[0].Store__Id;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where a New Site Plan Viewport Centres: the Red Line's Bounds, Else the Whole Store's
    // ------------------------------------------------------------
    function Na__SpStore__GetFocusBoundsMm(storeId) {
        const descriptor = Na__SpStore__GetDescriptor(storeId);
        if (!descriptor) return null;
        const redLine = descriptor.SitePlan__Layers.find((layer) => layer.Layer__Stem === Na__SpStore__RED_LINE_STEM);
        return (redLine && redLine.Layer__BoundsMm) || descriptor.SitePlan__BoundsMm || null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Site Plan Store API
    // ------------------------------------------------------------
    export {
        Na__SpStore__CHANGED_EVENT,
        Na__SpStore__DATA_KEY,
        Na__SpStore__DATA_KEY_MANY,
        Na__SpStore__FOLDER,
        Na__SpStore__MANIFEST,
        Na__SpStore__STATUS_IDLE,
        Na__SpStore__STATUS_LOADING,
        Na__SpStore__STATUS_READY,
        Na__SpStore__STATUS_EMPTY,
        Na__SpStore__STORE_EXISTING,
        Na__SpStore__STORE_PROPOSED,
        Na__SpStore__DEFAULT_STORE,
        Na__SpStore__QualifyKey,
        Na__SpStore__SplitKey,
        Na__SpStore__StoreIdForKey,
        Na__SpStore__Resolve,
        Na__SpStore__ResolveAll,
        Na__SpStore__Reload,
        Na__SpStore__LoadLayer,
        Na__SpStore__LoadAll,
        Na__SpStore__GetStatus,
        Na__SpStore__GetNote,
        Na__SpStore__GetDescriptor,
        Na__SpStore__GetLayers,
        Na__SpStore__GetLayerData,
        Na__SpStore__GetStores,
        Na__SpStore__DefaultStoreId,
        Na__SpStore__GetFocusBoundsMm
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
