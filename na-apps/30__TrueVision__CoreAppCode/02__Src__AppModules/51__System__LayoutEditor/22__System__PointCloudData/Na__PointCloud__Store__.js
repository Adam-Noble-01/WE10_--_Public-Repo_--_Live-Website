// =============================================================================
// TRUEVISION3D - POINT CLOUD DATA - STORE
// =============================================================================
//
// FILE       : Na__PointCloud__Store__.js
// NAMESPACE  : Na__PcStore
// MODULE     : Point Cloud Data - Store
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Find the project's point cloud scenes, and load one export of one scene when a viewport asks
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - The GLB Builder's point cloud export (TrueVision Sync 2.11, from the Point
//   Cloud Viewer's Scenes tab, 0.9) writes ONE store per project:
//     30__TrueVision__AppContent/PointCloud__ViewportData/
//       TrueVision__PointCloudData__Manifest__.json   every scene and its current export
//       PointCloudScene__<scene id>/Rev__<10 hex>/      one folder per export, never deleted
//         PointCloudScene__RevisionManifest__.json      the frame, the tiles and the datums
//         PointCloud__Tile__R00__C00__.webp ...         2048 px tiles, transparent where empty
//         PointCloudScene__Preview__.webp               the whole picture, reduced
// - WHERE IT IS READ FROM. The store manifest is the one file that changes, so
//   it is always asked of the network ('no-store').
//   - Localhost, the authoring machine, where the export has just written the
//     repository copy: the local manifest first, then the CDN.
//   - Anywhere else: the CDN, at the folder the ProjectVision build registered
//     in the project data (PointCloud__DataStore), else the conventional path.
//   A revision folder is content addressed - a new export is a new folder -
//   so nothing in one ever changes.
// - EVERY FILE CARRIES THE URLS TO TRY, IN ORDER. The tiles are not in the git
//   repository (.gitignore keeps the manifests only), so on localhost a tile
//   exported on the OTHER computer is not on this one: the local copy is tried
//   and the CDN answers instead.
// - LAZY. Nothing is fetched until a point cloud viewport or the Point Cloud
//   Tools panel asks, and a revision only when a viewport draws it.
// - SCENE IDS, NEVER NAMES. A viewport names its scene by the id the Point
//   Cloud Viewer gave it, which survives the SketchUp scene being renamed.
// - Status and loaded revisions go out on na-pointcloud-store-changed, always
//   on a microtask, never inside the call that caused them (the site plan
//   store's 1.0.1 lesson: a listener that resolves again must not recurse).
//
// INTEGRATION:
// - Reads the loaded project data through Na__CfApi__GetLoadedProjectData and
//   the project folder through Na__AppUtils__ProjectLoader.
// - Read by Na__LayoutEditor__Viewport2d__PointCloud__ and
//   Na__LayoutEditor__Panel__PointCloudTools__.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (point cloud viewports). Reads store schema 1 and
//   revision schema 1; Site Plan scenes (siteplan) from the start.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Project Data and the Project URL
    // ------------------------------------------------------------
    import { Na__CfApi__GetLoadedProjectData } from '../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    import {
        Na__AppUtils__IsRunningOnLocalhost,
        Na__AppUtils__GetProjectFolderFromUrl,
        Na__AppUtils__GetYearFromUrl
    } from '../../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Event, Project Data Key, Paths and Schemas (mirror the GLB Builder and the build)
    // ------------------------------------------------------------
    const Na__PcStore__CHANGED_EVENT   = 'na-pointcloud-store-changed';
    const Na__PcStore__DATA_KEY        = 'PointCloud__DataStore';
    const Na__PcStore__CDN_BASE        = 'https://cdn.noble-architecture.com/NaProjectPortal';
    const Na__PcStore__PORTAL_DIR      = 'na-project-portal';
    const Na__PcStore__CONTENT_DIR     = '30__TrueVision__AppContent';
    const Na__PcStore__FOLDER          = 'PointCloud__ViewportData';
    const Na__PcStore__MANIFEST        = 'TrueVision__PointCloudData__Manifest__.json';
    const Na__PcStore__REVISION_FILE   = 'PointCloudScene__RevisionManifest__.json';
    const Na__PcStore__SCENE_PREFIX    = 'PointCloudScene__';
    const Na__PcStore__SCHEMA_NAME     = 'TrueVision__PointCloudData__Manifest';
    const Na__PcStore__SCHEMA          = 1;
    const Na__PcStore__REVISION_NAME   = 'TrueVision__PointCloudScene__Revision';
    const Na__PcStore__REVISION_SCHEMA = 1;
    const Na__PcStore__DEFAULT_OPACITY = 0.65;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What a Scene Is and What It Lays On
    // ------------------------------------------------------------
    // A Plan and a Site Plan both look straight down and are drawn in world X
    // and Z, so either lays on a plan viewport or a site plan viewport. An
    // Elevation and a Section look level, along a bearing. A 3D View is a
    // perspective picture and has no drawing to lay on yet.
    // ------------------------------------------------------------
    const Na__PcStore__VIEW_TYPES = [
        { id : 'plan',      label : 'Plan' },
        { id : 'siteplan',  label : 'Site Plan' },
        { id : 'elevation', label : 'Elevation' },
        { id : 'section',   label : 'Section' },
        { id : 'view3d',    label : '3D View' }
    ];
    const Na__PcStore__TOP_DOWN = [ 'plan', 'siteplan' ];
    const Na__PcStore__FACING   = [ 'elevation', 'section' ];
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Shapes Names Must Have (nothing else is ever put in a URL)
    // ------------------------------------------------------------
    const Na__PcStore__SCENE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
    const Na__PcStore__REVISION_RE = /^Rev__[0-9a-f]{10}$/;
    const Na__PcStore__FILE_RE     = /^[A-Za-z0-9_.-]{1,128}\.(webp|png)$/;
    const Na__PcStore__MANIFEST_RE = /^PointCloudScene__[A-Za-z0-9_-]{1,64}\/Rev__[0-9a-f]{10}\/[A-Za-z0-9_.-]{1,128}\.json$/;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Status
    // ------------------------------------------------------------
    const Na__PcStore__STATUS_IDLE    = 'idle';                                 // <-- Nothing asked for yet
    const Na__PcStore__STATUS_LOADING = 'loading';                              // <-- Reading the store manifest
    const Na__PcStore__STATUS_READY   = 'ready';                                // <-- The scene list is known
    const Na__PcStore__STATUS_EMPTY   = 'empty';                                // <-- This project has no point cloud scenes that could be read
    // ------------------------------------------------------------

    // MODULE VARIABLES | Session State
    // ------------------------------------------------------------
    let   Na__PcStore__Status     = Na__PcStore__STATUS_IDLE;
    let   Na__PcStore__Note       = null;                                       // <-- Why the store is empty, in plain words
    let   Na__PcStore__Descriptor = null;
    let   Na__PcStore__Pending    = null;                                       // <-- The one resolve in flight
    let   Na__PcStore__Generation = 0;                                          // <-- Bumped by Reload so a slower, older read is dropped
    const Na__PcStore__RevisionPromises = new Map();                            // <-- Revision id -> Promise of the revision
    const Na__PcStore__Revisions        = new Map();                            // <-- Revision id -> the revision, once loaded
    const Na__PcStore__RevisionNotes    = new Map();                            // <-- Revision id -> why it did not load
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Announce a Change (on a microtask, never inside the caller)
    // ------------------------------------------------------------
    function Na__PcStore__Dispatch(reason, detail) {
        const payload = Object.assign({ reason : reason, status : Na__PcStore__Status }, detail || {});
        queueMicrotask(() => window.dispatchEvent(new CustomEvent(Na__PcStore__CHANGED_EVENT, { detail : payload })));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Set the Status and Announce It
    // ------------------------------------------------------------
    function Na__PcStore__SetStatus(status, note) {
        Na__PcStore__Status = status;
        Na__PcStore__Note   = note || null;
        Na__PcStore__Dispatch('status');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Plain String, or a Fallback
    // ------------------------------------------------------------
    function Na__PcStore__Text(value, fallback) {
        return (typeof value === 'string' && value.trim() !== '') ? value.trim() : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Three Number Vector, or null
    // ------------------------------------------------------------
    function Na__PcStore__Vec(value) {
        return (Array.isArray(value) && value.length === 3 && value.every(Number.isFinite)) ? value.slice() : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Project Data Block the Build Wrote, or null
    // ------------------------------------------------------------
    function Na__PcStore__ProjectDataBlock() {
        const projectData = Na__CfApi__GetLoadedProjectData();
        const block = projectData ? projectData[Na__PcStore__DATA_KEY] : null;
        return (block && typeof block === 'object') ? block : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Store Folder's URLs { local, cdn } (local only on localhost)
    // ------------------------------------------------------------
    // The build's registered folder is used only when it is on the practice's
    // own CDN; anything else in the project data is ignored for the
    // conventional path, so a URL nobody wrote is never fetched.
    // ------------------------------------------------------------
    function Na__PcStore__Bases() {
        const projectFolder = Na__AppUtils__GetProjectFolderFromUrl();
        const path  = projectFolder
            ? `${Na__AppUtils__GetYearFromUrl()}-Projects/${projectFolder}/${Na__PcStore__CONTENT_DIR}/${Na__PcStore__FOLDER}`
            : null;
        const block = Na__PcStore__ProjectDataBlock();
        const registered = (block && typeof block.PointCloud__BaseUrl === 'string' && block.PointCloud__BaseUrl.indexOf(Na__PcStore__CDN_BASE + '/') === 0)
            ? block.PointCloud__BaseUrl.replace(/\/+$/, '')
            : null;
        return {
            local : (path && Na__AppUtils__IsRunningOnLocalhost()) ? `${window.location.origin}/${Na__PcStore__PORTAL_DIR}/${path}` : null,
            cdn   : registered || (path ? `${Na__PcStore__CDN_BASE}/${path}` : null)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The URLs of One File Under the Store, In the Order to Try Them
    // ------------------------------------------------------------
    function Na__PcStore__UrlsFor(bases, relativePath) {
        if (!bases || !relativePath) return [];
        return [ bases.local, bases.cdn ].filter(Boolean).map((base) => `${base}/${relativePath}`);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch the First URL That Answers With JSON; Throws the Last Failure
    // ------------------------------------------------------------
    async function Na__PcStore__FetchJson(urls, noStore) {
        let lastError = null;
        for (const url of urls) {
            try {
                const response = await fetch(url, noStore ? { cache : 'no-store' } : undefined);
                if (!response.ok) { lastError = new Error(`${response.status} ${url}`); continue; }
                return { json : await response.json(), url : url };
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error('No URL to fetch');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Store Manifest
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Revision Entry From a Scene Row (null when it is not usable)
    // ------------------------------------------------------------
    function Na__PcStore__RevisionEntry(raw, sceneFolder) {
        if (!raw || typeof raw.Revision__Id !== 'string' || !Na__PcStore__REVISION_RE.test(raw.Revision__Id)) return null;
        const conventional = `${sceneFolder}/${raw.Revision__Id}/${Na__PcStore__REVISION_FILE}`;
        const listed = (typeof raw.Revision__Manifest === 'string' && Na__PcStore__MANIFEST_RE.test(raw.Revision__Manifest)) ? raw.Revision__Manifest : null;
        return {
            Revision__Id          : raw.Revision__Id,
            Revision__ExportedIso : Na__PcStore__Text(raw.Revision__ExportedIso, null),
            Revision__Manifest    : listed || conventional
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Scene From the Store Manifest (null for a row that names nothing to draw)
    // ------------------------------------------------------------
    // A scene from ANOTHER SketchUp model that exports into the same project
    // sits in the same manifest with its own store id; it is read exactly the
    // same way. A row with no export at all is dropped.
    // ------------------------------------------------------------
    function Na__PcStore__Scene(raw) {
        if (!raw || typeof raw !== 'object' || typeof raw.Scene__Id !== 'string' || !Na__PcStore__SCENE_ID_RE.test(raw.Scene__Id)) return null;
        const id     = raw.Scene__Id;
        const folder = Na__PcStore__SCENE_PREFIX + id;
        const revisions = (Array.isArray(raw.Scene__Revisions) ? raw.Scene__Revisions : [])
            .map((entry) => Na__PcStore__RevisionEntry(entry, folder))
            .filter(Boolean);
        const named   = (typeof raw.Scene__CurrentRevision === 'string' && Na__PcStore__REVISION_RE.test(raw.Scene__CurrentRevision)) ? raw.Scene__CurrentRevision : null;
        const current = named || (revisions.length ? revisions[revisions.length - 1].Revision__Id : null);
        if (!current) return null;
        if (!revisions.some((entry) => entry.Revision__Id === current)) {
            const listed = (typeof raw.Scene__CurrentManifest === 'string' && Na__PcStore__MANIFEST_RE.test(raw.Scene__CurrentManifest)) ? raw.Scene__CurrentManifest : null;
            revisions.push({ Revision__Id : current, Revision__ExportedIso : Na__PcStore__Text(raw.Scene__UpdatedIso, null),
                             Revision__Manifest : listed || `${folder}/${current}/${Na__PcStore__REVISION_FILE}` });
        }
        const viewType = Na__PcStore__VIEW_TYPES.some((type) => type.id === raw.Scene__ViewType) ? raw.Scene__ViewType : 'view3d';
        const scale    = raw.Scene__Scale && Number.isFinite(raw.Scene__Scale.Denominator) && raw.Scene__Scale.Denominator > 0 ? raw.Scene__Scale : null;
        const opacity  = Number.isFinite(raw.Scene__DefaultOpacity) ? Math.max(0, Math.min(1, raw.Scene__DefaultOpacity)) : Na__PcStore__DEFAULT_OPACITY;
        return {
            Scene__Id               : id,
            Scene__Name             : Na__PcStore__Text(raw.Scene__Name, id),
            Scene__ViewType         : viewType,
            Scene__ViewTypeLabel    : Na__PcStore__ViewTypeLabel(viewType),
            Scene__Projection       : raw.Scene__Projection === 'orthographic' ? 'orthographic' : 'perspective',
            Scene__ScaleDenominator : scale ? scale.Denominator : null,
            Scene__ScaleLabel       : scale ? Na__PcStore__Text(scale.Label, '1:' + scale.Denominator) : null,
            Scene__DefaultOpacity   : opacity,
            Scene__Status           : raw.Scene__Status === 'retired' ? 'retired' : 'active',
            Scene__SourceModel      : Na__PcStore__Text(raw.Scene__SourceModel, null),
            Scene__UpdatedIso       : Na__PcStore__Text(raw.Scene__UpdatedIso, null),
            Scene__CurrentRevision  : current,
            Scene__Revisions        : revisions
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Whole Store From Its Manifest
    // ------------------------------------------------------------
    function Na__PcStore__Describe(manifest, source, bases) {
        const scenes = (Array.isArray(manifest.PointCloudData__Scenes) ? manifest.PointCloudData__Scenes : [])
            .map(Na__PcStore__Scene)
            .filter(Boolean)
            .sort((a, b) => ((a.Scene__Status === 'active' ? 0 : 1) - (b.Scene__Status === 'active' ? 0 : 1))
                         || a.Scene__Name.localeCompare(b.Scene__Name));
        const datums = (Array.isArray(manifest.PointCloudData__Datums) ? manifest.PointCloudData__Datums : [])
            .map((raw) => ({ Datum__Name : Na__PcStore__Text(raw && raw.Datum__Name, 'Datum'), Datum__PositionM : Na__PcStore__Vec(raw && raw.Datum__PositionM) }))
            .filter((datum) => datum.Datum__PositionM);
        return {
            Store__Source      : source,
            Store__Bases       : bases,
            Store__ExportedIso : Na__PcStore__Text(manifest.PointCloudData__ExportedIso, null),
            Store__Scenes      : scenes,
            Store__Datums      : datums
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Look in Every Place for the Store, In Order; Never Throws
    // ------------------------------------------------------------
    async function Na__PcStore__Find() {
        const bases = Na__PcStore__Bases();
        const notes = [];
        const block = Na__PcStore__ProjectDataBlock();
        const tries = [];
        if (bases.local) tries.push({ url : `${bases.local}/${Na__PcStore__MANIFEST}`, source : 'local' });
        if (bases.cdn)   tries.push({ url : `${bases.cdn}/${Na__PcStore__MANIFEST}`,   source : 'cdn' });
        if (!tries.length) return { descriptor : null, note : 'the page names no project folder' };

        for (const attempt of tries) {
            try {
                const found    = await Na__PcStore__FetchJson([ attempt.url ], true);
                const manifest = found.json;
                if (!manifest || manifest.PointCloudData__Schema !== Na__PcStore__SCHEMA_NAME) { notes.push(`not a point cloud manifest (${attempt.url})`); continue; }
                if (Number.isFinite(manifest.PointCloudData__SchemaVersion) && manifest.PointCloudData__SchemaVersion > Na__PcStore__SCHEMA) {
                    console.warn(`[TrueVision3D] Point cloud manifest schema ${manifest.PointCloudData__SchemaVersion} is newer than this app reads (${Na__PcStore__SCHEMA}); reading what it recognises.`);
                }
                const descriptor = Na__PcStore__Describe(manifest, attempt.source, bases);
                if (descriptor.Store__Scenes.length) return { descriptor : descriptor, note : null };
                notes.push(`the manifest lists no scenes (${attempt.url})`);
            } catch (error) {
                notes.push(String(error && error.message ? error.message : error));
            }
        }
        if (!block) notes.push('the project data registers no point cloud store');
        return { descriptor : null, note : notes.join('; ') };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading One Revision
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Frame Record With Every Number Checked
    // ------------------------------------------------------------
    function Na__PcStore__Frame(raw) {
        const frame = (raw && typeof raw === 'object') ? raw : {};
        const num   = (value) => (Number.isFinite(value) ? value : null);
        return {
            Kind             : frame.Kind === 'orthographic' ? 'orthographic' : 'perspective',
            WidthPx          : num(frame.WidthPx),
            HeightPx         : num(frame.HeightPx),
            ScaleDenominator : num(frame.ScaleDenominator),
            PxPerPaperMm     : num(frame.PxPerPaperMm),
            ReducedFrom      : num(frame.ReducedFromPxPerPaperMm),
            PixelSizeM       : num(frame.PixelSizeM),
            OriginM          : Na__PcStore__Vec(frame.OriginM),
            RightM           : Na__PcStore__Vec(frame.RightM),
            DownM            : Na__PcStore__Vec(frame.DownM),
            NormalM          : Na__PcStore__Vec(frame.NormalM)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Picture File's Record: its place, its size and where to fetch it
    // ------------------------------------------------------------
    function Na__PcStore__Picture(raw, bases, folder) {
        const file = (raw && typeof raw.File === 'string' && Na__PcStore__FILE_RE.test(raw.File)) ? raw.File : null;
        return {
            File    : file,
            HasFile : !!file,
            Urls    : file ? Na__PcStore__UrlsFor(bases, `${folder}/${file}`) : []
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Whole Revision From Its Manifest
    // ------------------------------------------------------------
    function Na__PcStore__Revision(raw, scene, entry, bases) {
        const folder = entry.Revision__Manifest.split('/').slice(0, 2).join('/');
        const image  = (raw.Image && typeof raw.Image === 'object') ? raw.Image : {};
        const tiles  = (Array.isArray(image.Tiles) ? image.Tiles : [])
            .filter((tile) => tile && [ tile.X, tile.Y, tile.W, tile.H ].every(Number.isFinite) && tile.W > 0 && tile.H > 0)
            .map((tile) => Object.assign({ Row : tile.Row, Col : tile.Col, X : tile.X, Y : tile.Y, W : tile.W, H : tile.H }, Na__PcStore__Picture(tile, bases, folder)));
        const rawPreview = (image.Preview && typeof image.Preview === 'object') ? image.Preview : null;
        const preview = rawPreview && Number.isFinite(rawPreview.WidthPx) && Number.isFinite(rawPreview.HeightPx)
            ? Object.assign({ WidthPx : rawPreview.WidthPx, HeightPx : rawPreview.HeightPx,
                              Factor : (Number.isFinite(rawPreview.Factor) && rawPreview.Factor >= 1) ? rawPreview.Factor : 1 },
                            Na__PcStore__Picture(rawPreview, bases, folder))
            : null;
        const datums = (Array.isArray(raw.Datums) ? raw.Datums : [])
            .map((datum) => ({ Datum__Name : Na__PcStore__Text(datum && datum.Datum__Name, 'Datum'), Datum__PositionM : Na__PcStore__Vec(datum && datum.Datum__PositionM) }))
            .filter((datum) => datum.Datum__PositionM);
        const cloud = (raw.PointCloud && typeof raw.PointCloud === 'object') ? raw.PointCloud : {};
        return {
            Revision__Id          : entry.Revision__Id,
            Revision__ExportedIso : Na__PcStore__Text(raw.Revision__ExportedIso, entry.Revision__ExportedIso),
            Scene__Id             : scene.Scene__Id,
            Scene__Name           : Na__PcStore__Text(raw.Scene__Name, scene.Scene__Name),
            Scene__ViewType       : Na__PcStore__VIEW_TYPES.some((type) => type.id === raw.Scene__ViewType) ? raw.Scene__ViewType : scene.Scene__ViewType,
            Scene__ScaleDenominator : (raw.Scene__Scale && Number.isFinite(raw.Scene__Scale.Denominator)) ? raw.Scene__Scale.Denominator : scene.Scene__ScaleDenominator,
            Scene__DefaultOpacity : Number.isFinite(raw.Scene__DefaultOpacity) ? Math.max(0, Math.min(1, raw.Scene__DefaultOpacity)) : scene.Scene__DefaultOpacity,
            Frame                 : Na__PcStore__Frame(raw.Frame),
            Image : {
                WidthPx     : Number.isFinite(image.WidthPx)  ? image.WidthPx  : null,
                HeightPx    : Number.isFinite(image.HeightPx) ? image.HeightPx : null,
                TileSizePx  : Number.isFinite(image.TileSizePx) ? image.TileSizePx : null,
                PointSizePx : Number.isFinite(image.PointSizePx) ? image.PointSizePx : null,
                Tiles       : tiles,
                Preview     : preview
            },
            PointCloud : {
                FileName    : Na__PcStore__Text(cloud.FileName, null),
                ColourMode  : Na__PcStore__Text(cloud.ColourMode, null),
                PointBudget : Number.isFinite(cloud.PointBudget) ? cloud.PointBudget : null,
                TotalPoints : Number.isFinite(cloud.TotalPoints) ? cloud.TotalPoints : null,
                Clipped     : !!(cloud.Clip && typeof cloud.Clip === 'object')
            },
            Datums : datums
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Find the Store Once (resolves its descriptor, or null when the project has none)
    // ------------------------------------------------------------
    function Na__PcStore__Resolve() {
        if (Na__PcStore__Status === Na__PcStore__STATUS_READY || Na__PcStore__Status === Na__PcStore__STATUS_EMPTY) {
            return Promise.resolve(Na__PcStore__Descriptor);
        }
        if (Na__PcStore__Pending) return Na__PcStore__Pending;

        const generation = Na__PcStore__Generation;
        const pending = Na__PcStore__Find().then((found) => {
            if (generation !== Na__PcStore__Generation) return Na__PcStore__Resolve();   // <-- Reloaded meanwhile: follow the newer read
            Na__PcStore__Pending    = null;
            Na__PcStore__Descriptor = found.descriptor;
            if (found.descriptor) {
                console.log(`[TrueVision3D] Point cloud data: ${found.descriptor.Store__Scenes.length} scene(s) from the ${found.descriptor.Store__Source} manifest, exported ${found.descriptor.Store__ExportedIso || 'at an unknown time'}.`);
                Na__PcStore__SetStatus(Na__PcStore__STATUS_READY, null);
            } else {
                console.log(`[TrueVision3D] No point cloud data for this project: ${found.note}`);
                Na__PcStore__SetStatus(Na__PcStore__STATUS_EMPTY, found.note);
            }
            return found.descriptor;
        });
        Na__PcStore__Pending = pending;
        Na__PcStore__SetStatus(Na__PcStore__STATUS_LOADING, null);              // <-- Only once the promise is recorded, so a listener's Resolve joins it
        return pending;
    }
    // ------------------------------------------------------------


    // FUNCTION | Forget the Scene List and Look Again (after a new export while the app is open)
    // ------------------------------------------------------------
    // Loaded revisions are KEPT: a revision folder never changes, so what was
    // read from one is still true. Only which revision is current can change.
    // ------------------------------------------------------------
    function Na__PcStore__Reload() {
        Na__PcStore__Generation += 1;
        Na__PcStore__Pending    = null;
        Na__PcStore__Descriptor = null;
        Na__PcStore__Status     = Na__PcStore__STATUS_IDLE;
        Na__PcStore__Note       = null;
        Na__PcStore__RevisionNotes.clear();
        Na__PcStore__Dispatch('reload');
        return Na__PcStore__Resolve();
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Export a Viewport Draws: Its Pin, Else the Scene's Current One
    // ------------------------------------------------------------
    function Na__PcStore__RevisionIdFor(block, scene) {
        const pinned = block && typeof block.PointCloud__PinnedRevision === 'string' ? block.PointCloud__PinnedRevision : null;
        if (pinned && Na__PcStore__REVISION_RE.test(pinned)) return pinned;
        return scene ? scene.Scene__CurrentRevision : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Load One Export of One Scene Once (resolves the revision, or null)
    // ------------------------------------------------------------
    // A pinned export no longer listed by the manifest is still found: its
    // folder is named by the convention and is never deleted.
    // ------------------------------------------------------------
    function Na__PcStore__LoadRevision(sceneId, revisionId) {
        return Na__PcStore__Resolve().then((descriptor) => {
            const scene = descriptor ? descriptor.Store__Scenes.find((entry) => entry.Scene__Id === sceneId) : null;
            if (!scene || typeof revisionId !== 'string' || !Na__PcStore__REVISION_RE.test(revisionId)) return null;
            if (Na__PcStore__Revisions.has(revisionId)) return Na__PcStore__Revisions.get(revisionId);
            if (Na__PcStore__RevisionPromises.has(revisionId)) return Na__PcStore__RevisionPromises.get(revisionId);

            const entry = scene.Scene__Revisions.find((item) => item.Revision__Id === revisionId)
                || { Revision__Id : revisionId, Revision__ExportedIso : null,
                     Revision__Manifest : `${Na__PcStore__SCENE_PREFIX}${scene.Scene__Id}/${revisionId}/${Na__PcStore__REVISION_FILE}` };
            const bases   = descriptor.Store__Bases;
            const promise = Na__PcStore__FetchJson(Na__PcStore__UrlsFor(bases, entry.Revision__Manifest), false).then((found) => {
                const raw = found.json;
                if (!raw || raw.Revision__Schema !== Na__PcStore__REVISION_NAME) throw new Error('not a point cloud revision manifest (' + found.url + ')');
                if (Number.isFinite(raw.Revision__SchemaVersion) && raw.Revision__SchemaVersion > Na__PcStore__REVISION_SCHEMA) {
                    console.warn(`[TrueVision3D] Point cloud revision schema ${raw.Revision__SchemaVersion} is newer than this app reads (${Na__PcStore__REVISION_SCHEMA}); reading what it recognises.`);
                }
                const revision = Na__PcStore__Revision(raw, scene, entry, bases);
                Na__PcStore__Revisions.set(revisionId, revision);
                Na__PcStore__RevisionNotes.delete(revisionId);
                Na__PcStore__Dispatch('revision-loaded', { sceneId : sceneId, revisionId : revisionId });
                return revision;
            });
            Na__PcStore__RevisionPromises.set(revisionId, promise);
            promise.catch((error) => {
                Na__PcStore__RevisionPromises.delete(revisionId);                // <-- A failure can be retried
                Na__PcStore__RevisionNotes.set(revisionId, String(error && error.message ? error.message : error));
                console.warn(`[TrueVision3D] Point cloud export ${revisionId} of ${sceneId} did not load.`, error);
                Na__PcStore__Dispatch('revision-failed', { sceneId : sceneId, revisionId : revisionId });
            }).then(() => { if (Na__PcStore__Revisions.has(revisionId)) Na__PcStore__RevisionPromises.delete(revisionId); });
            return promise;
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Readers (never fetch)
    // ------------------------------------------------------------
    function Na__PcStore__GetStatus()     { return Na__PcStore__Status; }
    function Na__PcStore__GetNote()       { return Na__PcStore__Note; }
    function Na__PcStore__GetDescriptor() { return Na__PcStore__Descriptor; }
    function Na__PcStore__GetScenes(includeRetired) {
        const scenes = Na__PcStore__Descriptor ? Na__PcStore__Descriptor.Store__Scenes : [];
        return includeRetired ? scenes.slice() : scenes.filter((scene) => scene.Scene__Status === 'active');
    }
    function Na__PcStore__GetScene(sceneId) {
        return Na__PcStore__Descriptor ? (Na__PcStore__Descriptor.Store__Scenes.find((scene) => scene.Scene__Id === sceneId) || null) : null;
    }
    function Na__PcStore__GetRevision(revisionId)     { return Na__PcStore__Revisions.get(revisionId) || null; }
    function Na__PcStore__GetRevisionNote(revisionId) { return Na__PcStore__RevisionNotes.get(revisionId) || null; }
    function Na__PcStore__IsTopDown(viewType)  { return Na__PcStore__TOP_DOWN.indexOf(viewType) !== -1; }
    function Na__PcStore__IsFacing(viewType)   { return Na__PcStore__FACING.indexOf(viewType) !== -1; }
    function Na__PcStore__ViewTypeLabel(viewType) {
        const found = Na__PcStore__VIEW_TYPES.find((type) => type.id === viewType);
        return found ? found.label : String(viewType || '');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Point Cloud Store API
    // ------------------------------------------------------------
    export {
        Na__PcStore__CHANGED_EVENT,
        Na__PcStore__DATA_KEY,
        Na__PcStore__FOLDER,
        Na__PcStore__MANIFEST,
        Na__PcStore__STATUS_IDLE,
        Na__PcStore__STATUS_LOADING,
        Na__PcStore__STATUS_READY,
        Na__PcStore__STATUS_EMPTY,
        Na__PcStore__Resolve,
        Na__PcStore__Reload,
        Na__PcStore__RevisionIdFor,
        Na__PcStore__LoadRevision,
        Na__PcStore__GetStatus,
        Na__PcStore__GetNote,
        Na__PcStore__GetDescriptor,
        Na__PcStore__GetScenes,
        Na__PcStore__GetScene,
        Na__PcStore__GetRevision,
        Na__PcStore__GetRevisionNote,
        Na__PcStore__IsTopDown,
        Na__PcStore__IsFacing,
        Na__PcStore__ViewTypeLabel
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
