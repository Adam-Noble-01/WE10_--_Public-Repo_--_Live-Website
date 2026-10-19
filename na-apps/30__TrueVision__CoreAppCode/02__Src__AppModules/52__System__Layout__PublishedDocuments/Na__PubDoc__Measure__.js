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
//   immutable, content-hashed and usually already in the browser's cache from
//   painting the sheet), then built one at a time with a breath between, so
//   the largest plan never holds the page.
// - MEASUREMENTS LIVE FOR THE SESSION, per sheet. Coming back to a sheet shows
//   what was measured on it; leaving the drawings drops nothing until the page
//   goes. They are never saved, shared or printed: the PDF and a share link are
//   the drawing as issued. Release lets a sheet's linework go (it is
//   rebuilt from the cache on the next use) and keeps its measurements.
//
// INTEGRATION:
// - Na__LayoutEditor__WebViewer__Measure__ (the dock button and menu) asks
//   Summary whether to show the button, and its tools ask Prepare, Layers,
//   ViewportAt and the store.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.180.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import { Na__PubDoc__LoadDocument } from './Na__PubDoc__Document__.js';
    import { Na__PubDoc__Urls__Fetch } from './Na__PubDoc__Urls__.js';
    import { Na__PubSchema__Kind, Na__PubSchema__ResolveDocumentRef } from '../53__Data__Layout__PublishedSchema/Na__PublishedSchema__Paths__.js';
    import { Na__PubMsLw__Build, Na__PubMsLw__ReadRecord, Na__PubMsLw__FrameContains } from './Na__PubDoc__Measure__Linework__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE STATE | One Entry per Sheet a Reader Has Measured or Asked About
    // ------------------------------------------------------------
    // documentId -> {
    //   Records  : [ { Id, Scale, SpinDeg, SitePlan, Frame, File, Record } ] in paint order, or null until read
    //   Layers   : Map id -> built layer (Na__PubMsLw__Build)
    //   Prep     : the Prepare promise, once asked
    //   Ready    : every layer built
    //   Progress : { Done, Total }
    //   Failed   : [ { Id, Reason } ] linework that could not be read (measured without snapping)
    //   Measures : [ measurement records ] (Na__PubDoc__Measure__Maths__ describes one)
    //   Next     : the next measurement number
    // }
    // ------------------------------------------------------------
    const Na__PubMs__Docs = new Map();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Sheet's Drawings
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Sheet's Entry, Made When First Asked For
    // ------------------------------------------------------------
    function Na__PubMs__Doc(documentId) {
        let doc = Na__PubMs__Docs.get(documentId);
        if (!doc) {
            doc = { Records : null, Layers : new Map(), Prep : null, Ready : false, Progress : { Done : 0, Total : 0 }, Failed : [], Measures : [], Next : 1, Released : false };
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


    // FUNCTION | Read and Index the Sheet's Linework, Once
    // ------------------------------------------------------------
    // onProgress({ Done, Total }) hears each drawing land. Resolves to
    // { Ok, Layers, Failed }. A drawing whose linework cannot be read still
    // gets a layer - its frame and scale - so it can be measured, without
    // snapping; Failed says which, and why.
    // ------------------------------------------------------------
    function Na__PubMs__Prepare(documentId, onProgress) {
        const doc = Na__PubMs__Doc(documentId);
        const tell = () => {
            if (typeof onProgress !== 'function') return;
            try { onProgress({ Done : doc.Progress.Done, Total : doc.Progress.Total }); } catch (error) { /* a listener's fault is its own */ }
        };
        if (doc.Prep) { tell(); return doc.Prep; }

        doc.Prep = (async () => {
            await Na__PubMs__Summary(documentId);
            const records = doc.Records || [];
            doc.Progress = { Done : 0, Total : records.length };
            tell();

            const texts = await Promise.all(records.map(async (info) => {
                if (!info.File) return { Ok : true, Text : '' };                  // <-- A vector-free drawing: measured without snapping
                const path = Na__PubSchema__ResolveDocumentRef(documentId, info.File);
                if (!path) return { Ok : false, Text : '', Reason : 'its linework file is not one this sheet can name' };
                const got = await Na__PubDoc__Urls__Fetch(path, 'text', true);
                return got.Ok ? { Ok : true, Text : String(got.Value || '') } : { Ok : false, Text : '', Reason : got.Reason };
            }));

            for (let i = 0; i < records.length; i++) {
                if (doc.Released) break;                                          // <-- The sheet was left while this was reading
                const info = records[i], got = texts[i];
                if (!got.Ok) doc.Failed.push({ Id : info.Id, Reason : got.Reason });
                let layer = null;
                try {
                    layer = Na__PubMsLw__Build(info.Record, got.Text);
                } catch (error) {
                    doc.Failed.push({ Id : info.Id, Reason : 'its linework could not be read (' + (error && error.message) + ')' });
                    layer = Na__PubMsLw__Build(info.Record, '');
                }
                if (layer) doc.Layers.set(info.Id, layer);
                doc.Progress.Done = i + 1;
                tell();
                await new Promise((resolve) => setTimeout(resolve, 0));         // <-- A breath between drawings: the page keeps answering
            }
            doc.Ready = !doc.Released;
            tell();                                                               // <-- Once more, now it is ready: a listener reading Status hears the end
            if (doc.Failed.length) console.warn('[TrueVision3D] Measure: ' + documentId + ' measured without snapping on ' + doc.Failed.map((one) => one.Id + ' (' + one.Reason + ')').join(', '));
            return { Ok : doc.Failed.length === 0, Layers : [ ...doc.Layers.values() ], Failed : doc.Failed.slice() };
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


    // FUNCTION | Keep a New Measurement; Returns It With Its Id
    // ------------------------------------------------------------
    function Na__PubMs__Add(documentId, measure) {
        const doc = Na__PubMs__Doc(documentId);
        const kept = Na__PubMs__Copy(measure);
        kept.Id = 'Measure_' + String(doc.Next++).padStart(3, '0');
        doc.Measures.push(kept);
        return Na__PubMs__Copy(kept);
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Changed Measurement Back (by its Id); false when there is none
    // ------------------------------------------------------------
    function Na__PubMs__Replace(documentId, measure) {
        const doc = Na__PubMs__Docs.get(documentId);
        if (!doc || !measure) return false;
        const at = doc.Measures.findIndex((one) => one.Id === measure.Id);
        if (at === -1) return false;
        doc.Measures[at] = Na__PubMs__Copy(measure);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove One Measurement
    // ------------------------------------------------------------
    function Na__PubMs__Remove(documentId, id) {
        const doc = Na__PubMs__Docs.get(documentId);
        if (!doc) return false;
        const before = doc.Measures.length;
        doc.Measures = doc.Measures.filter((one) => one.Id !== id);
        return doc.Measures.length !== before;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove Every Measurement on a Sheet; Returns How Many Went
    // ------------------------------------------------------------
    function Na__PubMs__Clear(documentId) {
        const doc = Na__PubMs__Docs.get(documentId);
        if (!doc) return 0;
        const count = doc.Measures.length;
        doc.Measures = [];
        return count;
    }
    // ------------------------------------------------------------


    // FUNCTION | Let a Sheet's Linework Go, Keeping Its Measurements
    // ------------------------------------------------------------
    // A reading still in flight finishes into an entry nobody holds any more.
    // ------------------------------------------------------------
    function Na__PubMs__Release(documentId) {
        const doc = Na__PubMs__Docs.get(documentId);
        if (!doc) return;
        doc.Released = true;
        Na__PubMs__Docs.set(documentId, {
            Records : null, Layers : new Map(), Prep : null, Ready : false, Progress : { Done : 0, Total : 0 }, Failed : [],
            Measures : doc.Measures, Next : doc.Next, Released : false
        });
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
        Na__PubMs__Release
    };

// endregion -------------------------------------------------------------------
