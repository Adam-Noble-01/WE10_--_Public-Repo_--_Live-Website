// =============================================================================
// TRUEVISION3D - PUBLISHED DOCUMENTS - MEASURE
// =============================================================================
//
// FILE       : Na__PubDoc__Measure__.js
// NAMESPACE  : Na__PubMs
// MODULE     : Published Documents - Measure
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Which drawings on a published sheet can be measured, their linework read and indexed on first use, and the reader's measurements for each sheet this session
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
// CREATED    : 19-Oct-2026
//
// DESCRIPTION:
// - THE READER'S SIDE OF THE MEASURING TOOLS, without the tools. Like the
//   point cloud level (Na__PubDoc__PointCloud__), this module holds the data
//   and the controls live in 51__System__LayoutEditor/80__Feature__WebViewer
//   (Na__LayoutEditor__WebViewer__Measure__).
// - WHAT CAN BE MEASURED: every 2D viewport the sheet paints (in the paint
//   plan's order, so the topmost is last), with a scale. A 3D viewport is a
//   picture with no scale, and is never offered.
// - NOTHING IS FETCHED UNTIL A READER MEASURES. A reader who never opens the
//   tools costs nothing: the viewport records are already loaded with the
//   drawing, and its linework files are fetched only by Prepare, the first
//   time the tools open on that sheet. They are fetched together (they are
//   immutable and content-hashed), then built one at a time with a breath
//   between, so the largest plan never holds the page.
// - FETCHED UNDER THE TOOLS' OWN ADDRESS. The sheet paints each linework file
//   as an <image>, and an image asks for it without CORS. The CDN answers a
//   request like that without Access-Control-Allow-Origin, marked immutable
//   for a year, and the browser keeps that answer under the file's address. A
//   fetch of the same address is handed the kept answer and refused, so on
//   the live site (where the repository copy is not served) not one painted
//   drawing could be snapped to. The tools ask for the same file with
//   ?na-measure=1 on it: a request only they make, which the CDN answers with
//   CORS and the browser keeps apart. Each address the reader knows is tried
//   that way, then as it is, past the browser's cache.
// - A DRAWING THAT COULD NOT BE READ IS ASKED FOR AGAIN. It is measured
//   without snapping meanwhile, and the next Prepare (the menu opening, a
//   tool picked) reads it again; the drawings already read are left alone.
// - MEASUREMENTS LIVE FOR THE SESSION, per sheet. Coming back to a sheet shows
//   what was measured on it; leaving the drawings drops nothing until the page
//   goes. They are never saved, shared or printed: the PDF and a share link are
//   the drawing as issued. Release lets a sheet's linework go (it is
//   rebuilt from the cache on the next use) and keeps its measurements.
// - EVERY CHANGE CAN BE UNDONE. Keeping, pulling, deleting and clearing
//   measurements each remember the sheet's measurements as they were, so
//   Undo and Redo step through them (Ctrl+Z, Ctrl+Y), per sheet.
//
// INTEGRATION:
// - Na__LayoutEditor__WebViewer__Measure__ (the dock button and menu) asks
//   Summary whether to show the button, and its tools ask Prepare, Layers,
//   ViewportAt and the store.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.1.0
// - The linework is fetched under the tools' own address (?na-measure=1),
//   each address in turn and then past the browser's cache: the sheet's own
//   <image> left a CDN answer without CORS in the cache, and every painted
//   drawing went unsnapped on the live site. A drawing that still cannot be
//   read is read again on the next Prepare.
// - Undo and Redo of kept measurements, per sheet (TrueVision3D v2.182.0).
//
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.180.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import { Na__PubDoc__LoadDocument } from './Na__PubDoc__Document__.js';
    import { Na__PubDoc__Urls__For } from './Na__PubDoc__Urls__.js';
    import { Na__PubSchema__Kind, Na__PubSchema__ResolveDocumentRef } from '../53__Data__Layout__PublishedSchema/Na__PublishedSchema__Paths__.js';
    import { Na__PubMsLw__Build, Na__PubMsLw__ReadRecord, Na__PubMsLw__FrameContains } from './Na__PubDoc__Measure__Linework__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Fetching the Linework
    // ------------------------------------------------------------
    // The tools' own key on a linework file's address: see FETCHED UNDER THE
    // TOOLS' OWN ADDRESS above. The file is content-hashed, so the key never
    // needs to change.
    // ------------------------------------------------------------
    const Na__PubMs__OWN_KEY    = 'na-measure=1';
    const Na__PubMs__TIMEOUT_MS = 20000;                                         // <-- One address's chance; the largest plan is a few hundred kilobytes
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Undo
    // ------------------------------------------------------------
    const Na__PubMs__HISTORY = 100;                                              // <-- Changes remembered per sheet
    // ------------------------------------------------------------

    // MODULE STATE | One Entry per Sheet a Reader Has Measured or Asked About
    // ------------------------------------------------------------
    // documentId -> {
    //   Records  : [ { Id, Scale, SpinDeg, SitePlan, Frame, File, Record } ] in paint order, or null until read
    //   Layers   : Map id -> built layer (Na__PubMsLw__Build)
    //   Read     : Set of the ids whose linework has been read (or that have none to read)
    //   Prep     : the latest Prepare promise
    //   Busy     : a reading is in flight
    //   Ready    : every drawing has a layer (with its linework, or without it for now)
    //   Progress : { Done, Total }
    //   Failed   : [ { Id, Reason } ] linework the latest reading could not read (measured without snapping until it can)
    //   Measures : [ measurement records ] (Na__PubDoc__Measure__Maths__ describes one)
    //   Next     : the next measurement number
    //   Undo     : [ Measures as they were before each change ], oldest first
    //   Redo     : [ Measures as they were before each undo ], newest last
    // }
    // ------------------------------------------------------------
    const Na__PubMs__Docs = new Map();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Sheet's Drawings
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Fresh Entry, Carrying a Sheet's Measurements and Their History When It Has Them
    // ------------------------------------------------------------
    function Na__PubMs__Fresh(kept) {
        return {
            Records  : null, Layers : new Map(), Read : new Set(), Prep : null, Busy : false, Ready : false,
            Progress : { Done : 0, Total : 0 }, Failed : [],
            Measures : kept ? kept.Measures : [], Next : kept ? kept.Next : 1,
            Undo     : kept ? kept.Undo : [],     Redo : kept ? kept.Redo : [],
            Released : false
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Sheet's Entry, Made When First Asked For
    // ------------------------------------------------------------
    function Na__PubMs__Doc(documentId) {
        let doc = Na__PubMs__Docs.get(documentId);
        if (!doc) {
            doc = Na__PubMs__Fresh(null);
            Na__PubMs__Docs.set(documentId, doc);
        }
        return doc;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Measurable Viewports of a Loaded Document, in the Order the Sheet Paints Them
    // ------------------------------------------------------------
    // A real publish paints exactly what its paint plan lists, in that order;
    // a viewport the plan leaves out is not on the sheet. A hand-made document
    // (the example folder) has no plan, and paints its viewports as listed.
    // ------------------------------------------------------------
    function Na__PubMs__ReadRecords(loaded) {
        const kind = Na__PubSchema__Kind('viewport');
        const all  = (kind && loaded.Elements && loaded.Elements.viewport && loaded.Elements.viewport[kind.arrayKey]) || [];
        const plan = loaded.Sheet && loaded.Sheet['PublishedSheet__PaintPlan'];
        let ordered = all;
        if (Array.isArray(plan) && plan.length > 0) {
            const byId = new Map(all.map((one) => [ one['Viewport__Id'], one ]));
            ordered = plan.filter((step) => step && step['Step__Kind'] === 'viewport')
                          .map((step) => byId.get(step['Step__Id']))
                          .filter(Boolean);
        }
        const out = [];
        for (const record of ordered) {
            const info = Na__PubMsLw__ReadRecord(record);
            if (!info) continue;                                                  // <-- 3D, or no scale: nothing to measure
            const vector = record['Viewport__Vector'];
            info.File   = (vector && typeof vector['Vector__File'] === 'string' && vector['Vector__File']) ? vector['Vector__File'] : null;
            info.Record = record;
            out.push(info);
        }
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Can This Published Sheet Be Measured, and On What
    // ------------------------------------------------------------
    // Returns null when it cannot (not published, or no 2D drawing on it), or
    // { Count, WithLinework, Scales } - the number of measurable drawings, how
    // many of those can be snapped to, and their scales. The document is
    // already loaded by the time a sheet is on screen, so this is a lookup.
    // ------------------------------------------------------------
    async function Na__PubMs__Summary(documentId) {
        if (!documentId) return null;
        const loaded = await Na__PubDoc__LoadDocument(documentId);
        if (!loaded || !loaded.Ok) return null;
        const doc = Na__PubMs__Doc(documentId);
        if (!doc.Records) doc.Records = Na__PubMs__ReadRecords(loaded);
        if (doc.Records.length === 0) return null;
        return {
            Count        : doc.Records.length,
            WithLinework : doc.Records.filter((one) => !!one.File).length,
            Scales       : [ ...new Set(doc.Records.map((one) => one.Scale)) ].sort((a, b) => a - b)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Address With the Tools' Own Key on It
    // ------------------------------------------------------------
    function Na__PubMs__Keyed(url) {
        return url + (url.indexOf('?') === -1 ? '?' : '&') + Na__PubMs__OWN_KEY;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Try at One Address: { Ok, Text, Reason }, Never Throws
    // ------------------------------------------------------------
    // cacheMode 'default' lets the browser keep the answer (the keyed address
    // is the tools' alone); 'no-store' goes past whatever it kept.
    // ------------------------------------------------------------
    async function Na__PubMs__Try(url, cacheMode) {
        const controller = (typeof AbortController === 'function') ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), Na__PubMs__TIMEOUT_MS) : 0;
        try {
            const response = await fetch(url, { mode : 'cors', credentials : 'omit', cache : cacheMode, signal : controller ? controller.signal : undefined });
            if (!response.ok) return { Ok : false, Text : '', Reason : response.status + ' from ' + url };
            return { Ok : true, Text : await response.text() };
        } catch (error) {
            const why = (error && error.name === 'AbortError') ? ('no answer in ' + Math.round(Na__PubMs__TIMEOUT_MS / 1000) + ' s') : ((error && error.message) || 'refused');
            return { Ok : false, Text : '', Reason : why + ' from ' + url };
        } finally {
            if (timer) clearTimeout(timer);                                       // <-- After the body: a stalled download is a try that failed too
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch One Linework File: { Ok, Text, Reason }, Never Throws
    // ------------------------------------------------------------
    // Every address the reader knows for it (the repository copy first on
    // localhost, the CDN first on the live site), each under the tools' own
    // key; then each as it is, straight from the network.
    // ------------------------------------------------------------
    async function Na__PubMs__FetchText(path) {
        const urls = Na__PubDoc__Urls__For(path);
        if (urls.length === 0) return { Ok : false, Text : '', Reason : 'no project is selected, so ' + path + ' cannot be read' };
        const tries = urls.map((url) => [ Na__PubMs__Keyed(url), 'default' ]).concat(urls.map((url) => [ url, 'no-store' ]));
        const reasons = [];
        for (const [ url, cacheMode ] of tries) {
            const got = await Na__PubMs__Try(url, cacheMode);
            if (got.Ok) return got;
            reasons.push(got.Reason);
        }
        return { Ok : false, Text : '', Reason : reasons.join('; ') };
    }
    // ------------------------------------------------------------


    // FUNCTION | Read and Index the Sheet's Linework (What Is Not Read Yet)
    // ------------------------------------------------------------
    // onProgress({ Done, Total }) hears each drawing land. Resolves to
    // { Ok, Layers, Failed }. A drawing whose linework cannot be read still
    // gets a layer - its frame and scale - so it can be measured, without
    // snapping; Failed says which, and why, and the next Prepare reads only
    // those again. While a reading is in flight, or once every drawing is
    // read, Prepare hands back the reading there is.
    // ------------------------------------------------------------
    function Na__PubMs__Prepare(documentId, onProgress) {
        const doc = Na__PubMs__Doc(documentId);
        const tell = () => {
            if (typeof onProgress !== 'function') return;
            try { onProgress({ Done : doc.Progress.Done, Total : doc.Progress.Total }); } catch (error) { /* a listener's fault is its own */ }
        };
        if (doc.Prep && (doc.Busy || doc.Failed.length === 0)) { tell(); return doc.Prep; }

        doc.Busy = true;
        doc.Prep = (async () => {
            await Na__PubMs__Summary(documentId);
            const records = doc.Records || [];
            const todo = records.filter((info) => !doc.Read.has(info.Id));
            doc.Progress = { Done : records.length - todo.length, Total : records.length };
            doc.Failed = [];
            tell();

            const texts = await Promise.all(todo.map(async (info) => {
                if (!info.File) return { Ok : true, Text : '' };                  // <-- A vector-free drawing: measured without snapping
                const path = Na__PubSchema__ResolveDocumentRef(documentId, info.File);
                if (!path) return { Ok : false, Text : '', Reason : 'its linework file is not one this sheet can name', Final : true };
                return Na__PubMs__FetchText(path);
            }));

            for (let i = 0; i < todo.length; i++) {
                if (doc.Released) break;                                          // <-- The sheet was left while this was reading
                const info = todo[i], got = texts[i];
                let layer = null;
                if (got.Ok) {
                    try {
                        layer = Na__PubMsLw__Build(info.Record, got.Text);
                    } catch (error) {
                        doc.Failed.push({ Id : info.Id, Reason : 'its linework could not be read (' + (error && error.message) + ')' });
                    }
                    doc.Read.add(info.Id);                                        // <-- Downloaded: the same bytes will not read better a second time
                } else {
                    doc.Failed.push({ Id : info.Id, Reason : got.Reason });
                    if (got.Final) doc.Read.add(info.Id);
                }
                if (!layer && !doc.Layers.has(info.Id)) layer = Na__PubMsLw__Build(info.Record, '');   // <-- Its frame and scale, until its lines are read
                if (layer) doc.Layers.set(info.Id, layer);
                doc.Progress.Done += 1;
                tell();
                await new Promise((resolve) => setTimeout(resolve, 0));         // <-- A breath between drawings: the page keeps answering
            }
            doc.Busy = false;
            if (doc.Released) return { Ok : false, Layers : [], Failed : [] };
            doc.Ready = true;
            if (doc.Failed.length) console.warn('[TrueVision3D] Measure: ' + documentId + ' measured without snapping on ' + doc.Failed.map((one) => one.Id + ' (' + one.Reason + ')').join(', '));
            if (doc.Failed.every((one) => doc.Read.has(one.Id))) doc.Failed = [];   // <-- Nothing left a second try could read: do not try again
            tell();                                                               // <-- Once more, now it is ready: a listener reading Status hears the end
            return { Ok : doc.Failed.length === 0, Layers : Na__PubMs__Layers(documentId), Failed : doc.Failed.slice() };
        })();
        return doc.Prep;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Linework Reading Has Got To
    // ------------------------------------------------------------
    // { Asked, Ready, Done, Total, Failed } - Asked is false until Prepare has
    // been called for this sheet.
    // ------------------------------------------------------------
    function Na__PubMs__Status(documentId) {
        const doc = Na__PubMs__Docs.get(documentId);
        if (!doc) return { Asked : false, Ready : false, Done : 0, Total : 0, Failed : 0 };
        return { Asked : !!doc.Prep, Ready : doc.Ready, Done : doc.Progress.Done, Total : doc.Progress.Total, Failed : doc.Failed.length };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Built Layers of a Sheet (as many as are ready), Bottom First
    // ------------------------------------------------------------
    function Na__PubMs__Layers(documentId) {
        const doc = Na__PubMs__Docs.get(documentId);
        if (!doc || !doc.Records) return [];
        return doc.Records.map((info) => doc.Layers.get(info.Id)).filter(Boolean);
    }
    // ------------------------------------------------------------


    // FUNCTION | One Built Layer (null until it is built)
    // ------------------------------------------------------------
    function Na__PubMs__Layer(documentId, viewportId) {
        const doc = Na__PubMs__Docs.get(documentId);
        return (doc && doc.Layers.get(viewportId)) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Measurable Drawing Under a Sheet Point (the topmost), or Null
    // ------------------------------------------------------------
    // From the records, not the layers: a reader can start measuring before
    // the linework has arrived. marginMm lets a point just off a frame count.
    // ------------------------------------------------------------
    function Na__PubMs__ViewportAt(documentId, x, y, marginMm) {
        const doc = Na__PubMs__Docs.get(documentId);
        if (!doc || !doc.Records) return null;
        for (let i = doc.Records.length - 1; i >= 0; i--) {
            const info = doc.Records[i];
            if (Na__PubMsLw__FrameContains(info.Frame, info.SpinDeg, x, y, marginMm || 0)) return info;
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Measurable Drawing Under a Sheet Point, Topmost First
    // ------------------------------------------------------------
    function Na__PubMs__ViewportsAt(documentId, x, y, marginMm) {
        const doc = Na__PubMs__Docs.get(documentId);
        if (!doc || !doc.Records) return [];
        const out = [];
        for (let i = doc.Records.length - 1; i >= 0; i--) {
            const info = doc.Records[i];
            if (Na__PubMsLw__FrameContains(info.Frame, info.SpinDeg, x, y, marginMm || 0)) out.push(info);
        }
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Session's Measurements
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Measurement Copied Into the Store's Own Shape
    // ------------------------------------------------------------
    function Na__PubMs__Copy(measure) {
        return {
            Id         : measure.Id || null,
            Tool       : measure.Tool,
            ViewportId : measure.ViewportId || null,
            Scale      : Number(measure.Scale) || 1,
            SpinDeg    : Number(measure.SpinDeg) || 0,
            Points     : (measure.Points || []).map((p) => ({ X : Number(p.X), Y : Number(p.Y), Snap : p.Snap || 'none' }))
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | A Sheet's Measurements, Oldest First (copies: change them with Replace)
    // ------------------------------------------------------------
    function Na__PubMs__List(documentId) {
        const doc = Na__PubMs__Docs.get(documentId);
        return doc ? doc.Measures.map(Na__PubMs__Copy) : [];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Remember a Sheet's Measurements as They Are, Before a Change (a new change ends what Redo could bring back)
    // ------------------------------------------------------------
    function Na__PubMs__Remember(doc) {
        doc.Undo.push(doc.Measures.map(Na__PubMs__Copy));
        if (doc.Undo.length > Na__PubMs__HISTORY) doc.Undo.shift();
        doc.Redo = [];
    }
    // ------------------------------------------------------------


    // FUNCTION | Keep a New Measurement; Returns It With Its Id
    // ------------------------------------------------------------
    // Ids are never given twice, even to one undone: a redo brings a
    // measurement back under its own.
    // ------------------------------------------------------------
    function Na__PubMs__Add(documentId, measure) {
        const doc = Na__PubMs__Doc(documentId);
        const kept = Na__PubMs__Copy(measure);
        kept.Id = 'Measure_' + String(doc.Next++).padStart(3, '0');
        Na__PubMs__Remember(doc);
        doc.Measures = doc.Measures.concat([ kept ]);
        return Na__PubMs__Copy(kept);
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Changed Measurement Back (by its Id); false when there is none, or it did not change
    // ------------------------------------------------------------
    function Na__PubMs__Replace(documentId, measure) {
        const doc = Na__PubMs__Docs.get(documentId);
        if (!doc || !measure) return false;
        const at = doc.Measures.findIndex((one) => one.Id === measure.Id);
        if (at === -1) return false;
        const kept = Na__PubMs__Copy(measure);
        if (JSON.stringify(kept) === JSON.stringify(doc.Measures[at])) return false;   // <-- Pulled and put back where it was: nothing to undo
        Na__PubMs__Remember(doc);
        doc.Measures = doc.Measures.map((one, i) => (i === at ? kept : one));
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove One Measurement
    // ------------------------------------------------------------
    function Na__PubMs__Remove(documentId, id) {
        const doc = Na__PubMs__Docs.get(documentId);
        if (!doc || !doc.Measures.some((one) => one.Id === id)) return false;
        Na__PubMs__Remember(doc);
        doc.Measures = doc.Measures.filter((one) => one.Id !== id);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove Every Measurement on a Sheet; Returns How Many Went (one Undo brings them all back)
    // ------------------------------------------------------------
    function Na__PubMs__Clear(documentId) {
        const doc = Na__PubMs__Docs.get(documentId);
        if (!doc || doc.Measures.length === 0) return 0;
        const count = doc.Measures.length;
        Na__PubMs__Remember(doc);
        doc.Measures = [];
        return count;
    }
    // ------------------------------------------------------------


    // FUNCTION | Undo the Last Change to a Sheet's Measurements; false when there is none
    // ------------------------------------------------------------
    function Na__PubMs__Undo(documentId) {
        const doc = Na__PubMs__Docs.get(documentId);
        if (!doc || doc.Undo.length === 0) return false;
        doc.Redo.push(doc.Measures);
        doc.Measures = doc.Undo.pop();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Redo the Last Change Undone; false when there is none
    // ------------------------------------------------------------
    function Na__PubMs__Redo(documentId) {
        const doc = Na__PubMs__Docs.get(documentId);
        if (!doc || doc.Redo.length === 0) return false;
        doc.Undo.push(doc.Measures);
        doc.Measures = doc.Redo.pop();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | What Undo and Redo Could Do on a Sheet: { CanUndo, CanRedo }
    // ------------------------------------------------------------
    function Na__PubMs__History(documentId) {
        const doc = Na__PubMs__Docs.get(documentId);
        return { CanUndo : !!(doc && doc.Undo.length), CanRedo : !!(doc && doc.Redo.length) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Let a Sheet's Linework Go, Keeping Its Measurements and Their History
    // ------------------------------------------------------------
    // A reading still in flight finishes into an entry nobody holds any more.
    // ------------------------------------------------------------
    function Na__PubMs__Release(documentId) {
        const doc = Na__PubMs__Docs.get(documentId);
        if (!doc) return;
        doc.Released = true;
        Na__PubMs__Docs.set(documentId, Na__PubMs__Fresh(doc));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubMs__Summary,
        Na__PubMs__Prepare,
        Na__PubMs__Status,
        Na__PubMs__Layers,
        Na__PubMs__Layer,
        Na__PubMs__ViewportAt,
        Na__PubMs__ViewportsAt,
        Na__PubMs__List,
        Na__PubMs__Add,
        Na__PubMs__Replace,
        Na__PubMs__Remove,
        Na__PubMs__Clear,
        Na__PubMs__Undo,
        Na__PubMs__Redo,
        Na__PubMs__History,
        Na__PubMs__Release
    };

// endregion -------------------------------------------------------------------
