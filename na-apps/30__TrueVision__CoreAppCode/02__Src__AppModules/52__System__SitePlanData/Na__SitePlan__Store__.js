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
// - A project's site plan data is one folder,
//   30__TrueVision__AppContent/SitePlan__DrawingData: a linework GLB per site
//   plan tag (tags 71-75), a fill GLB for a fill tag with faces, and
//   TrueVision__SitePlanData__Manifest__.json. All three are written by the
//   GLB Builder's Site Plan Export.
// - WHERE THE LAYER LIST COMES FROM. The ProjectVision build registers the
//   folder in the project data as SitePlan__DataStore, with CDN URLs.
//   - Web build: that key first, then the manifest on the CDN.
//   - Localhost - the authoring machine, where the export has just written the
//     repository copy: the local manifest first, then the key, then the CDN.
//     A fresh export draws without a build or a sync.
//   Both sources become one descriptor in the build's own schema
//   (SitePlan__..., Layer__...), except that bounds are drawing millimetres
//   { MinX, MinY, MaxX, MaxY } - drawing y is +world Z.
// - LAZY. Nothing is fetched until a site plan drawing asks. Each layer loads
//   once, linework and fill together. The cache key is the layer and the export
//   time, and the export time rides on each GLB URL as ?v=, so a re-export is
//   never served stale by the browser, the service worker or the CDN.
// - NEVER ENTERS THE 3D SCENE. The lines stay out of the model root, the phase
//   library, the category toggles, walk collision and the profile line caches:
//   they are 2D drawing data only.
// - Status and loaded layers go out on na-siteplan-store-changed.
//
// INTEGRATION:
// - Reads the loaded project data through Na__CfApi__GetLoadedProjectData.
// - Read by the Layout Editor's site plan viewports (plan Phase 5).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
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

    // MODULE CONSTANTS | Event, Project Data Key and Folder (mirror the build and Na__AppUtils__ProjectLoader)
    // ------------------------------------------------------------
    const Na__SpStore__CHANGED_EVENT = 'na-siteplan-store-changed';
    const Na__SpStore__DATA_KEY      = 'SitePlan__DataStore';                   // <-- Build-owned project data key (ProjectVision 0.2.0)
    const Na__SpStore__CDN_BASE      = 'https://cdn.noble-architecture.com/NaProjectPortal';
    const Na__SpStore__PORTAL_DIR    = 'na-project-portal';                     // <-- Repository folder the projects live under
    const Na__SpStore__CONTENT_DIR   = '30__TrueVision__AppContent';
    const Na__SpStore__FOLDER        = 'SitePlan__DrawingData';
    const Na__SpStore__MANIFEST      = 'TrueVision__SitePlanData__Manifest__.json';
    const Na__SpStore__SCHEMA        = 1;                                       // <-- Manifest schema this module reads
    const Na__SpStore__RED_LINE_KEY  = 'TrueVision__SitePlan__RedLineBoundary'; // <-- The layer a new viewport centres on
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Status and Source
    // ------------------------------------------------------------
    const Na__SpStore__STATUS_IDLE    = 'idle';                                 // <-- Nothing asked for yet
    const Na__SpStore__STATUS_LOADING = 'loading';                              // <-- Finding the layer list
    const Na__SpStore__STATUS_READY   = 'ready';                                // <-- A layer list is known
    const Na__SpStore__STATUS_EMPTY   = 'empty';                                // <-- The project has no site plan data that could be read
    const Na__SpStore__SOURCE_PROJECT  = 'project-data';
    const Na__SpStore__SOURCE_MANIFEST = 'manifest';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Session State
    // ------------------------------------------------------------
    let Na__SpStore__Status     = Na__SpStore__STATUS_IDLE;
    let Na__SpStore__Note       = null;                                         // <-- Why the store is empty, for the viewport's message
    let Na__SpStore__Descriptor = null;
    let Na__SpStore__Pending    = null;                                         // <-- The one resolve in flight
    let Na__SpStore__Generation = 0;                                            // <-- Bumped by Reload so a slower, older read is dropped
    const Na__SpStore__LayerPromises = new Map();                               // <-- Cache key (layer and export time) -> Promise of geometry
    const Na__SpStore__LayerData     = new Map();                               // <-- Category key -> geometry once loaded
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
    function Na__SpStore__Dispatch(reason, categoryKey) {
        const detail = { reason : reason, status : Na__SpStore__Status, categoryKey : categoryKey || null };
        queueMicrotask(() => window.dispatchEvent(new CustomEvent(Na__SpStore__CHANGED_EVENT, { detail : detail })));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Set the Status and Announce It
    // ------------------------------------------------------------
    function Na__SpStore__SetStatus(status, note) {
        Na__SpStore__Status = status;
        Na__SpStore__Note   = note || null;
        Na__SpStore__Dispatch('status', null);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Project's Site Plan Folder: { local, cdn } (local only on localhost; null with no project)
    // ------------------------------------------------------------
    function Na__SpStore__FolderUrls() {
        const projectFolder = Na__AppUtils__GetProjectFolderFromUrl();
        if (!projectFolder) return null;
        const path = `${Na__AppUtils__GetYearFromUrl()}-Projects/${projectFolder}/${Na__SpStore__CONTENT_DIR}/${Na__SpStore__FOLDER}`;
        return {
            local : Na__AppUtils__IsRunningOnLocalhost() ? `${window.location.origin}/${Na__SpStore__PORTAL_DIR}/${path}` : null,
            cdn   : `${Na__SpStore__CDN_BASE}/${path}`
        };
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


    // HELPER FUNCTION | A Layer Style With Every Field Present
    // ------------------------------------------------------------
    function Na__SpStore__Style(raw) {
        const style = (raw && typeof raw === 'object') ? raw : {};
        const text  = (value, fallback) => (typeof value === 'string' && value) ? value : fallback;
        const num   = (value, fallback) => Number.isFinite(value) ? value : fallback;
        return {
            LineColourId : text(style.LineColourId, null),
            LineHex      : text(style.LineHex, '#000000'),
            LineType     : text(style.LineType, 'solid'),
            LineWeightMm : num(style.LineWeightMm, 0.25),
            FillColourId : text(style.FillColourId, null),
            FillHex      : text(style.FillHex, null),
            FillOpacity  : num(style.FillOpacity, null)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Layer From the Project Data Key or the Manifest (null when it has no linework)
    // ------------------------------------------------------------
    function Na__SpStore__Layer(raw, source, folderUrls) {
        if (!raw || typeof raw !== 'object' || typeof raw.Layer__CategoryKey !== 'string' || !raw.Layer__CategoryKey) return null;
        const fromManifest = source === Na__SpStore__SOURCE_MANIFEST;
        const url = (urlKey, fileKey) => {
            if (!fromManifest) return (typeof raw[urlKey] === 'string' && raw[urlKey]) ? raw[urlKey] : null;
            return (typeof raw[fileKey] === 'string' && raw[fileKey] && folderUrls) ? `${folderUrls.cdn}/${raw[fileKey]}` : null;
        };
        const layer = {
            Layer__CategoryKey     : raw.Layer__CategoryKey,
            Layer__TagName         : typeof raw.Layer__TagName === 'string' ? raw.Layer__TagName : '',
            Layer__Label           : (typeof raw.Layer__Label === 'string' && raw.Layer__Label) ? raw.Layer__Label : raw.Layer__CategoryKey,
            Layer__Group           : typeof raw.Layer__Group === 'string' ? raw.Layer__Group : '',
            Layer__DrawOrder       : Number.isFinite(raw.Layer__DrawOrder) ? raw.Layer__DrawOrder : 50,
            Layer__LineworkUrl     : url('Layer__LineworkUrl', 'Layer__LineworkFile'),
            Layer__FillUrl         : url('Layer__FillUrl', 'Layer__FillFile'),
            Layer__Style           : Na__SpStore__Style(raw.Layer__Style),
            Layer__VisibleAtScales : Array.isArray(raw.Layer__VisibleAtScales) ? raw.Layer__VisibleAtScales.filter(Number.isFinite) : [],
            Layer__SegmentCount    : Number.isFinite(raw.Layer__SegmentCount) ? raw.Layer__SegmentCount : null,
            Layer__BoundsMm        : Na__SpStore__Bounds(raw.Layer__BoundsMm)
        };
        return layer.Layer__LineworkUrl ? layer : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Whole Store From the Project Data Key or the Manifest
    // ------------------------------------------------------------
    function Na__SpStore__Describe(raw, source, folderUrls) {
        const fromManifest = source === Na__SpStore__SOURCE_MANIFEST;
        const pick   = (manifestKey, dataKey) => raw[fromManifest ? manifestKey : dataKey];
        const layers = (Array.isArray(pick('SitePlanData__Layers', 'SitePlan__Layers')) ? pick('SitePlanData__Layers', 'SitePlan__Layers') : [])
            .map((entry) => Na__SpStore__Layer(entry, source, folderUrls))
            .filter(Boolean)
            .sort((a, b) => a.Layer__DrawOrder - b.Layer__DrawOrder);           // <-- Lowest draws first, so the red line ends on top
        const north = pick('SitePlanData__NorthAngleDeg', 'SitePlan__NorthAngleDeg');
        return {
            SitePlan__Source        : source,
            SitePlan__ExportedIso   : pick('SitePlanData__ExportedIso', 'SitePlan__ExportedIso') || null,
            SitePlan__NorthAngleDeg : Number.isFinite(north) ? north : 0,
            SitePlan__BoundsMm      : Na__SpStore__Bounds(pick('SitePlanData__BoundsMm', 'SitePlan__BoundsMm')),
            SitePlan__Layers        : layers
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Look in Every Place, In Order; Never Throws
    // ------------------------------------------------------------
    async function Na__SpStore__Find() {
        const folderUrls = Na__SpStore__FolderUrls();
        const notes = [];

        const fromManifest = async (manifestUrl) => {
            try {
                const manifest = await Na__SpStore__FetchFirst([ manifestUrl ], true);
                if (Number.isFinite(manifest.SitePlanData__SchemaVersion) && manifest.SitePlanData__SchemaVersion > Na__SpStore__SCHEMA) {
                    console.warn(`[TrueVision3D] Site plan manifest schema ${manifest.SitePlanData__SchemaVersion} is newer than this app reads (${Na__SpStore__SCHEMA}); reading what it recognises.`);
                }
                const described = Na__SpStore__Describe(manifest, Na__SpStore__SOURCE_MANIFEST, folderUrls);
                if (described.SitePlan__Layers.length) return described;
                notes.push(`the manifest lists no layers (${manifestUrl})`);
            } catch (error) {
                notes.push(String(error && error.message ? error.message : error));
            }
            return null;
        };

        if (folderUrls && folderUrls.local) {
            const local = await fromManifest(`${folderUrls.local}/${Na__SpStore__MANIFEST}`);
            if (local) return { descriptor : local, note : null };
        }

        const projectData = Na__CfApi__GetLoadedProjectData();
        const block = projectData ? projectData[Na__SpStore__DATA_KEY] : null;
        if (block && typeof block === 'object') {
            const described = Na__SpStore__Describe(block, Na__SpStore__SOURCE_PROJECT, folderUrls);
            if (described.SitePlan__Layers.length) return { descriptor : described, note : null };
            notes.push(`${Na__SpStore__DATA_KEY} lists no layers`);
        }

        if (folderUrls) {
            const remote = await fromManifest(`${folderUrls.cdn}/${Na__SpStore__MANIFEST}`);
            if (remote) return { descriptor : remote, note : null };
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

    // FUNCTION | Find the Layer List Once (resolves the descriptor, or null when the project has none)
    // ------------------------------------------------------------
    function Na__SpStore__Resolve() {
        if (Na__SpStore__Status === Na__SpStore__STATUS_READY || Na__SpStore__Status === Na__SpStore__STATUS_EMPTY) {
            return Promise.resolve(Na__SpStore__Descriptor);
        }
        if (Na__SpStore__Pending) return Na__SpStore__Pending;

        const generation = Na__SpStore__Generation;
        Na__SpStore__Pending = Na__SpStore__Find().then((found) => {
            if (generation !== Na__SpStore__Generation) return Na__SpStore__Resolve();   // <-- Reloaded meanwhile: follow the newer read
            Na__SpStore__Pending    = null;
            Na__SpStore__Descriptor = found.descriptor;
            if (found.descriptor) {
                console.log(`[TrueVision3D] Site plan data: ${found.descriptor.SitePlan__Layers.length} layer(s) from the ${found.descriptor.SitePlan__Source}, exported ${found.descriptor.SitePlan__ExportedIso || 'at an unknown time'}.`);
                Na__SpStore__SetStatus(Na__SpStore__STATUS_READY, null);
            } else {
                console.log(`[TrueVision3D] No site plan data for this project: ${found.note}`);
                Na__SpStore__SetStatus(Na__SpStore__STATUS_EMPTY, found.note);
            }
            return found.descriptor;
        });
        Na__SpStore__SetStatus(Na__SpStore__STATUS_LOADING, null);                 // <-- Only once the promise is recorded, so a listener's Resolve joins it
        return Na__SpStore__Pending;
    }
    // ------------------------------------------------------------


    // FUNCTION | Forget Everything and Look Again (after a new export while the app is open)
    // ------------------------------------------------------------
    function Na__SpStore__Reload() {
        Na__SpStore__Generation += 1;
        Na__SpStore__Pending    = null;
        Na__SpStore__Descriptor = null;
        Na__SpStore__LayerPromises.clear();
        Na__SpStore__LayerData.clear();
        Na__SpStore__Status = Na__SpStore__STATUS_IDLE;
        Na__SpStore__Note   = null;
        Na__SpStore__Dispatch('reload', null);
        return Na__SpStore__Resolve();
    }
    // ------------------------------------------------------------


    // FUNCTION | Load One Layer's Geometry Once (resolves null for a layer the store does not list)
    // ------------------------------------------------------------
    // Resolves { categoryKey, layer, segments, segmentCount, rings, boundsMm }:
    // segments are [x0, y0, x1, y1, ...] and rings { face, outer, points
    // [x, y, ...] }, all in drawing millimetres. A fill that fails to load is
    // reported and the layer draws its lines alone; a linework failure rejects
    // and is not cached, so the next ask tries again.
    // ------------------------------------------------------------
    function Na__SpStore__LoadLayer(categoryKey) {
        return Na__SpStore__Resolve().then((descriptor) => {
            const layer = descriptor ? descriptor.SitePlan__Layers.find((entry) => entry.Layer__CategoryKey === categoryKey) : null;
            if (!layer) return null;

            const exportedIso = descriptor.SitePlan__ExportedIso;
            const cacheKey    = categoryKey + '|' + (exportedIso || '');
            if (Na__SpStore__LayerPromises.has(cacheKey)) return Na__SpStore__LayerPromises.get(cacheKey);

            const generation = Na__SpStore__Generation;
            const promise = (async () => {
                const lineBytes = await Na__SpStore__FetchFirst(Na__SpStore__Candidates(Na__SpStore__Versioned(layer.Layer__LineworkUrl, exportedIso)), false);
                const lines     = Na__SpGlb__ParseLinework(lineBytes);
                let rings = [];
                if (layer.Layer__FillUrl) {
                    try {
                        const fillBytes = await Na__SpStore__FetchFirst(Na__SpStore__Candidates(Na__SpStore__Versioned(layer.Layer__FillUrl, exportedIso)), false);
                        rings = Na__SpGlb__ParseFill(fillBytes).rings;
                    } catch (error) {
                        console.warn(`[TrueVision3D] Site plan fill for ${categoryKey} did not load; its lines still draw.`, error);
                    }
                }
                const data = {
                    categoryKey  : categoryKey,
                    layer        : layer,
                    segments     : lines.segments,
                    segmentCount : lines.segmentCount,
                    rings        : rings,
                    boundsMm     : lines.boundsMm
                };
                if (generation === Na__SpStore__Generation) {
                    Na__SpStore__LayerData.set(categoryKey, data);
                    Na__SpStore__Dispatch('layer-loaded', categoryKey);
                }
                return data;
            })();
            Na__SpStore__LayerPromises.set(cacheKey, promise);
            promise.catch((error) => {
                Na__SpStore__LayerPromises.delete(cacheKey);                    // <-- A failure can be retried
                console.warn(`[TrueVision3D] Site plan layer ${categoryKey} did not load.`, error);
                Na__SpStore__Dispatch('layer-failed', categoryKey);
            });
            return promise;
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Load Every Layer (resolves the geometry of those that loaded, in draw order)
    // ------------------------------------------------------------
    async function Na__SpStore__LoadAll() {
        const descriptor = await Na__SpStore__Resolve();
        if (!descriptor) return [];
        const settled = await Promise.allSettled(descriptor.SitePlan__Layers.map((layer) => Na__SpStore__LoadLayer(layer.Layer__CategoryKey)));
        return settled.filter((result) => result.status === 'fulfilled' && result.value).map((result) => result.value);
    }
    // ------------------------------------------------------------


    // FUNCTION | Readers (never fetch)
    // ------------------------------------------------------------
    function Na__SpStore__GetStatus()     { return Na__SpStore__Status; }
    function Na__SpStore__GetNote()       { return Na__SpStore__Note; }
    function Na__SpStore__GetDescriptor() { return Na__SpStore__Descriptor; }
    function Na__SpStore__GetLayers()     { return Na__SpStore__Descriptor ? Na__SpStore__Descriptor.SitePlan__Layers : []; }
    function Na__SpStore__GetLayerData(categoryKey) { return Na__SpStore__LayerData.get(categoryKey) || null; }
    // ------------------------------------------------------------


    // FUNCTION | Where a New Site Plan Viewport Centres: the Red Line's Bounds, Else the Whole Store's
    // ------------------------------------------------------------
    function Na__SpStore__GetFocusBoundsMm() {
        const descriptor = Na__SpStore__Descriptor;
        if (!descriptor) return null;
        const redLine = descriptor.SitePlan__Layers.find((layer) => layer.Layer__CategoryKey === Na__SpStore__RED_LINE_KEY);
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
        Na__SpStore__FOLDER,
        Na__SpStore__MANIFEST,
        Na__SpStore__STATUS_IDLE,
        Na__SpStore__STATUS_LOADING,
        Na__SpStore__STATUS_READY,
        Na__SpStore__STATUS_EMPTY,
        Na__SpStore__Resolve,
        Na__SpStore__Reload,
        Na__SpStore__LoadLayer,
        Na__SpStore__LoadAll,
        Na__SpStore__GetStatus,
        Na__SpStore__GetNote,
        Na__SpStore__GetDescriptor,
        Na__SpStore__GetLayers,
        Na__SpStore__GetLayerData,
        Na__SpStore__GetFocusBoundsMm
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
