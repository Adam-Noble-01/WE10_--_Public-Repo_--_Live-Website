// =============================================================================
// TRUEVISION3D - PUBLISHED DOCUMENTS - INDEX AND DOCUMENT LOADING
// =============================================================================
//
// FILE       : Na__PubDoc__Document__.js
// NAMESPACE  : Na__PubDoc
// MODULE     : Published Documents - Index and Document Loading
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Load the project index, load one published document, and build the sheet markup for it
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A KEY HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - THE LOAD ORDER, AND THE FIRST BRANCH IS THE GUARD. The index is downloaded
//   once with the project. Opening a drawing reads its entry, and the very first
//   thing that happens is the published / not-published branch. An unpublished
//   drawing returns a real sheet with a grey panel and never asks for anything
//   of its own: its paper comes from the one shared unpublished sheets file,
//   fetched the first time ANY unpublished drawing is opened and then held.
//   Only once past that branch is a manifest asked for.
// - NOTHING HERE CAN COMPUTE A DRAWING, because nothing in this module's import
//   graph can. There is no fallback that renders, no fingerprint that could fail
//   and trigger one, and no path from a missing file to the projection pipeline.
//   A document is either the published files or an honest grey panel.
// - A FAILURE IS A VALUE THE SHEET CAN SHOW. Every step returns
//   { Ok, State, Reason } rather than throwing, and a Reason reaches the mask, so
//   a client looking at a grey drawing area can read why it is grey.
// - THE MARKUP IS BUILT AS ONE STRING and handed to the parser once, which is the
//   whole performance story: no per-element DOM calls on the device least able to
//   afford them.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Created with Phases 2 and 3 of TrueVision__PLAN__PublishingSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import {
        Na__PubSchema__Ready, Na__PubSchema__States, Na__PubSchema__IndexPath, Na__PubSchema__UnpublishedPath,
        Na__PubSchema__ManifestPath, Na__PubSchema__SheetPath, Na__PubSchema__DocumentFolder,
        Na__PubSchema__Kind, Na__PubSchema__ResolveDocumentRef
    } from '../53__Data__Layout__PublishedSchema/Na__PublishedSchema__Paths__.js';

    import { Na__PubVer__ReadsIndex, Na__PubVer__ReadsManifest } from '../53__Data__Layout__PublishedSchema/Na__PublishedSchema__Version__.js';

    import { Na__PubDoc__Urls__Ready, Na__PubDoc__Urls__Fetch, Na__PubDoc__Urls__Direct } from './Na__PubDoc__Urls__.js';
    import { Na__PubPaint__Sink, Na__PubPaint__Done, Na__PubPaint__Svg } from './Na__PubDoc__Paint__.js';
    import { Na__PubSheet__Paper, Na__PubSheet__Ground, Na__PubSheet__Marks,
             Na__PubSheet__LayersBackToFront, Na__PubSheet__Lineweights } from './Na__PubDoc__Sheet__.js';
    import { Na__PubEl__Paint } from './Na__PubDoc__Elements__.js';
    import { Na__PubVp__Paint, Na__PubVp__Release, Na__PubVp__SetBudget } from './Na__PubDoc__Viewports__.js';
    import { Na__PubMask__Paint } from './Na__PubDoc__Unpublished__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    let Na__PubDoc__Index   = null;                                               // <-- The whole index as published
    let Na__PubDoc__Entries = [];                                                  // <-- Its documents, in order
    let Na__PubDoc__Config  = null;                                                // <-- The reader's own settings
    let Na__PubDoc__Papers  = null;                                                // <-- The unpublished sheets file, as a promise of documentId -> paper
    const Na__PubDoc__Cache = new Map();                                           // <-- documentId -> the loaded document

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Configuration
// -----------------------------------------------------------------------------

    // FUNCTION | Read the Reader's Settings Once (never throws)
    // ------------------------------------------------------------
    async function Na__PubDoc__ReadConfig() {
        if (Na__PubDoc__Config) return Na__PubDoc__Config;
        let whole = null;
        try {
            const response = await fetch(new URL('./Na__PubDoc__Config__.json', import.meta.url), { cache : 'no-store' });
            if (response.ok) whole = await response.json();
        } catch (error) {
            console.warn('[TrueVision3D PubDoc] Reader config unreadable (' + error.message + '); using built-in settings.');
        }
        Na__PubDoc__Config = {
            Sheet       : (whole && whole['PubDoc__Sheet__Config'])       || {},
            Tiers       : (whole && whole['PubDoc__Tiers__Config'])       || {},
            Unpublished : (whole && whole['PubDoc__Unpublished__Config']) || {},
            Labels      : (whole && whole['PubDoc__Labels__Config'])      || {},
            Debug       : (whole && whole['PubDoc__Debug__Config'])       || {}
        };
        const budget = Na__PubDoc__Config.Tiers['Tiers__MaxDecodedBytes'];
        if (budget) Na__PubVp__SetBudget(budget);
        return Na__PubDoc__Config;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Project Index
// -----------------------------------------------------------------------------

    // FUNCTION | Load the Project's Published Drawings Index
    // ------------------------------------------------------------
    // The first file the reader downloads, and a small one: the unpublished
    // sheets' paper lives in its own file. Returns { Ok, Documents, Reason }.
    // ------------------------------------------------------------
    async function Na__PubDoc__LoadIndex() {
        await Na__PubSchema__Ready();
        await Na__PubDoc__Urls__Ready();
        await Na__PubDoc__ReadConfig();

        const got = await Na__PubDoc__Urls__Fetch(Na__PubSchema__IndexPath(), 'json', false);
        if (!got.Ok) {
            Na__PubDoc__Index = null;
            Na__PubDoc__Entries = [];
            return { Ok : false, Documents : [], Reason : 'No drawings have been published for this project yet (' + got.Reason + ').' };
        }

        const verdict = Na__PubVer__ReadsIndex(got.Value);
        if (!verdict.Ok) {
            Na__PubDoc__Index = null;
            Na__PubDoc__Entries = [];
            return { Ok : false, Documents : [], Reason : verdict.Reason };
        }

        Na__PubDoc__Index   = got.Value;
        Na__PubDoc__Entries = (Array.isArray(got.Value['PublishedDocuments__Documents']) ? got.Value['PublishedDocuments__Documents'] : [])
            .slice()
            .sort((a, b) => Number(a['Document__Order'] || 0) - Number(b['Document__Order'] || 0));
        Na__PubDoc__Cache.clear();
        Na__PubDoc__Papers = null;                                                 // <-- Belongs to the index it was written with

        if (Na__PubDoc__Config.Debug['Debug__LogLoads']) {
            console.log('[TrueVision3D PubDoc] Index loaded: ' + Na__PubDoc__Entries.length + ' drawing(s).');
        }
        return { Ok : true, Documents : Na__PubDoc__Entries.slice(), Reason : null };
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Drawing the Index Names, in Order
    // ------------------------------------------------------------
    function Na__PubDoc__Documents() {
        return Na__PubDoc__Entries.slice();
    }
    // ------------------------------------------------------------


    // FUNCTION | One Drawing's Index Entry
    // ------------------------------------------------------------
    function Na__PubDoc__Entry(documentId) {
        return Na__PubDoc__Entries.find((one) => one['Document__Id'] === documentId) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Project Block of the Index
    // ------------------------------------------------------------
    function Na__PubDoc__Project() {
        return (Na__PubDoc__Index && Na__PubDoc__Index['PublishedDocuments__Project']) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Unpublished Drawing's Sheet Paper (null when there is none)
    // ------------------------------------------------------------
    // Read from the unpublished sheets file, which is fetched ONCE - the first
    // time any unpublished drawing is opened - and shared by every one after
    // it. A file that cannot be read is not retried until the index is loaded
    // again: the drawing is still a real sheet size with an honest grey panel,
    // only without its title block.
    // ------------------------------------------------------------
    async function Na__PubDoc__UnpublishedPaper(documentId) {
        if (!Na__PubDoc__Papers) {
            Na__PubDoc__Papers = (async () => {
                const got  = await Na__PubDoc__Urls__Fetch(Na__PubSchema__UnpublishedPath(), 'json', false);
                const list = (got.Ok && got.Value && Array.isArray(got.Value['Unpublished__Documents'])) ? got.Value['Unpublished__Documents'] : [];
                if (!got.Ok) console.warn('[TrueVision3D PubDoc] Unpublished sheets unreadable (' + got.Reason + '); showing plain paper behind the panel.');
                return new Map(list.filter((one) => one && one['Document__Id']).map((one) => [ one['Document__Id'], one ]));
            })();
        }
        return (await Na__PubDoc__Papers).get(documentId) || null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading One Document
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Tell a Progress Listener, Never Letting It Break a Load
    // ------------------------------------------------------------
    // { Key, Kind, Done }: Done false as a request goes out, true as it
    // settles - however it went. The loading screen names its jobs from these.
    // ------------------------------------------------------------
    function Na__PubDoc__Tell(onProgress, key, done, kind) {
        if (typeof onProgress !== 'function') return;
        try { onProgress({ Key : key, Kind : kind || null, Done : !!done }); }
        catch (error) { /* A listener's fault is not the drawing's */ }
    }
    // ------------------------------------------------------------


    // FUNCTION | Load a Published Document's Manifest, Sheet and Element Files
    // ------------------------------------------------------------
    // Returns { Ok, Manifest, Sheet, Elements, Reason }. Element files are
    // fetched together, because they are small and a drawing is not showable
    // without them; the rasters are NOT fetched here - they are <image> hrefs and
    // the browser fetches them as it paints. onProgress (optional) hears each
    // file go out and settle.
    // ------------------------------------------------------------
    async function Na__PubDoc__LoadDocument(documentId, onProgress) {
        if (Na__PubDoc__Cache.has(documentId)) return Na__PubDoc__Cache.get(documentId);

        const manifestPath = Na__PubSchema__ManifestPath(documentId);
        if (!manifestPath) {
            return { Ok : false, Reason : 'that is not a drawing this project can name' };
        }

        Na__PubDoc__Tell(onProgress, 'manifest', false);
        const gotManifest = await Na__PubDoc__Urls__Fetch(manifestPath, 'json', false);
        Na__PubDoc__Tell(onProgress, 'manifest', true);
        if (!gotManifest.Ok) return { Ok : false, Reason : gotManifest.Reason };

        const verdict = Na__PubVer__ReadsManifest(gotManifest.Value);
        if (!verdict.Ok) return { Ok : false, Reason : verdict.Reason };

        Na__PubDoc__Tell(onProgress, 'sheet', false);
        const gotSheet = await Na__PubDoc__Urls__Fetch(Na__PubSchema__SheetPath(documentId), 'json', false);
        Na__PubDoc__Tell(onProgress, 'sheet', true);
        if (!gotSheet.Ok) return { Ok : false, Reason : gotSheet.Reason };

        // THE ELEMENT FILES THE MANIFEST NAMES, and only those. Nothing is
        // guessed at: a kind the manifest does not list simply is not on this
        // drawing, and asking for it would be a 404 for no reason.
        const files    = (gotManifest.Value['PublishedDocument__Files'] || {});
        const listed   = Array.isArray(files['Files__Elements']) ? files['Files__Elements'] : [];
        const elements = {};
        const missing  = [];

        await Promise.all(listed.map(async (entry) => {
            const kind = Na__PubSchema__Kind(entry['File__Type']);
            const name = kind ? kind.name : String(entry['File__Type']);
            const path = Na__PubSchema__DocumentFolder(documentId) + '/' + entry['File__Path'];
            Na__PubDoc__Tell(onProgress, 'element:' + name, false, name);
            const got  = await Na__PubDoc__Urls__Fetch(path, 'json', false);
            Na__PubDoc__Tell(onProgress, 'element:' + name, true, name);
            if (got.Ok) elements[name] = got.Value;
            else missing.push(entry['File__Path']);
        }));

        if (missing.length > 0) {
            // A MANIFEST THAT NAMES A FILE THAT IS NOT THERE MEANS THE DOCUMENT
            // IS NOT WHOLE. The manifest is written last precisely so this cannot
            // happen; when it does, something deleted a file under a live
            // manifest, and half a drawing must not be shown as if it were all of
            // it.
            return { Ok : false, Reason : 'part of this drawing is missing from the bucket (' + missing.join(', ') + ')' };
        }

        const loaded = {
            Ok       : true,
            Id       : documentId,
            Manifest : gotManifest.Value,
            Sheet    : gotSheet.Value,
            Elements : elements,
            Reason   : null
        };
        Na__PubDoc__Cache.set(documentId, loaded);
        return loaded;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building the Sheet
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Paper an Index Entry Describes, for an Unpublished Sheet
    // ------------------------------------------------------------
    function Na__PubDoc__PaperFromEntry(entry) {
        // A real publish writes the exact paper and drawing area on every row, so
        // the grey panel covers precisely the drawing area the sheet has; the
        // example folder names only a size and an orientation.
        return Na__PubSheet__Paper({
            'PublishedSheet__Paper' : {
                'Paper__Size'          : entry['Document__PaperSize'],
                'Paper__Orientation'   : entry['Document__Orientation'],
                'Paper__WidthMm'       : entry['Document__PaperWidthMm'],
                'Paper__HeightMm'      : entry['Document__PaperHeightMm'],
                'Paper__DrawingAreaMm' : entry['Document__DrawingAreaMm']
            }
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Markup for One Drawing, Published or Not
    // ------------------------------------------------------------
    // THE FIRST BRANCH IS THE GUARD. An unpublished drawing never reaches its
    // own folder, a manifest or a raster. Returns { Ok, State, Markup, Paper,
    // Reason }.
    //
    // options : { Density, Zoom } - device pixels per paper mm on screen (the
    //           reader's own rule for the raster tier), or a bare zoom factor.
    //           { OnProgress } hears every file go out and settle:
    //           { Key : 'paper' | 'manifest' | 'sheet' | 'element:<kind>',
    //             Kind, Done } - what the loading screen names its jobs from.
    // ------------------------------------------------------------
    async function Na__PubDoc__Build(documentId, options) {
        await Na__PubDoc__ReadConfig();
        const states = Na__PubSchema__States();
        const entry  = Na__PubDoc__Entry(documentId);

        if (!entry) {
            // NOT IN THE INDEX: never published, or added after the last
            // publish, or nothing has been published for this project at all.
            // Given the sheet's paper by the caller, that is still a real sheet
            // with the grey panel - the same answer as any unpublished drawing.
            const fallback = (options || {}).FallbackPaper;
            if (fallback && Number(fallback.WidthMm) > 0 && Number(fallback.HeightMm) > 0) {
                const paper = Na__PubSheet__Paper({ 'PublishedSheet__Paper' : {
                    'Paper__WidthMm' : fallback.WidthMm, 'Paper__HeightMm' : fallback.HeightMm,
                    'Paper__DrawingAreaMm' : fallback.DrawingAreaMm || null } });
                const context = { DocumentId : documentId, DefPrefix : 'na-x', Defs : Na__PubPaint__Sink(), Style : Na__PubDoc__Config.Sheet };
                return {
                    Ok     : true,
                    State  : states.unpublished,
                    Paper  : paper,
                    Markup : Na__PubDoc__Wrap(documentId, paper,
                                Na__PubSheet__Ground(paper, context) +
                                Na__PubMask__Paint(paper.DrawingArea, 'unpublished', null, Na__PubDoc__Config.Unpublished)),
                    Reason : (options || {}).IndexReason || 'this drawing is not in the published index'
                };
            }
            return { Ok : false, State : 'broken', Markup : null, Paper : null,
                     Reason : 'this drawing is not in the published index' };
        }

        // ---- THE GUARD: not published, so nothing of its own is fetched ------
        if (entry['Document__State'] !== states.published) {
            const paper = Na__PubDoc__PaperFromEntry(entry);
            const inline = (typeof entry['Document__FurnitureSvg'] === 'string') || Array.isArray(entry['Document__Marks']);
            let sheetPaper = entry;
            if (!inline) {
                Na__PubDoc__Tell((options || {}).OnProgress, 'paper', false);
                sheetPaper = Object.assign({}, entry, await Na__PubDoc__UnpublishedPaper(documentId));
                Na__PubDoc__Tell((options || {}).OnProgress, 'paper', true);
            }
            return {
                Ok     : true,
                State  : states.unpublished,
                Paper  : paper,
                Markup : Na__PubDoc__Wrap(documentId, paper,
                            Na__PubDoc__MarksOnly(sheetPaper, paper) +
                            Na__PubMask__Paint(paper.DrawingArea, 'unpublished', null, Na__PubDoc__Config.Unpublished)),
                Reason : null
            };
        }

        // ---- PUBLISHED --------------------------------------------------------
        const loaded = await Na__PubDoc__LoadDocument(documentId, (options || {}).OnProgress);
        if (!loaded.Ok) {
            const paper = Na__PubDoc__PaperFromEntry(entry);
            return {
                Ok     : false,
                State  : 'broken',
                Paper  : paper,
                Markup : Na__PubDoc__Wrap(documentId, paper,
                            Na__PubDoc__MarksOnly(entry, paper) +
                            Na__PubMask__Paint(paper.DrawingArea, 'broken', loaded.Reason, Na__PubDoc__Config.Unpublished)),
                Reason : loaded.Reason
            };
        }

        const paper   = Na__PubSheet__Paper(loaded.Sheet);
        const weights = Na__PubSheet__Lineweights(loaded.Sheet);
        const defs    = Na__PubPaint__Sink();
        const body    = Na__PubPaint__Sink();

        const context = {
            DocumentId  : documentId,
            DefPrefix   : 'na-' + String(documentId).replace(/[^A-Za-z0-9_-]/g, ''),
            Defs        : defs,
            Style       : Na__PubDoc__Config.Sheet,
            DimensionPt : weights.DimensionPt,
            ViewportPt  : weights.ViewportPt,
            Zoom        : Number((options || {}).Zoom) || 1,
            Density     : Number((options || {}).Density) || 0,
            Url         : (projectRelativePath) => projectRelativePath ? Na__PubDoc__Urls__Direct(projectRelativePath) : null,
            Resolve     : (viewport, reference) => Na__PubSchema__ResolveDocumentRef(documentId, reference),
            Tokens      : (markup) => Na__PubDoc__ResolveTokens(documentId, markup)
        };

        body.push(Na__PubSheet__Ground(paper, context));

        const plan = loaded.Sheet['PublishedSheet__PaintPlan'];
        if (Array.isArray(plan) && plan.length > 0) {
            // ---- A REAL PUBLISH: the editor's own rendering, in the PDF's order
            // Every layer's markup and the sheet's own paper arrive as the SVG
            // the editor drew; the plan says what goes under what. Nothing here
            // is laid out, formatted or arranged.
            body.push(context.Tokens(loaded.Sheet['PublishedSheet__UnderlaySvg'] || ''));
            const viewportKind = Na__PubSchema__Kind('viewport');
            const viewports    = (loaded.Elements.viewport && loaded.Elements.viewport[viewportKind.arrayKey]) || [];
            for (const step of plan) {
                const kind = step['Step__Kind'];
                if (kind === 'viewport') {
                    const one = viewports.find((v) => v['Viewport__Id'] === step['Step__Id']);
                    if (one) body.push(Na__PubVp__Paint([ one ], context));
                } else if (kind === 'sheet') {
                    body.push(context.Tokens(loaded.Sheet['PublishedSheet__FurnitureSvg'] || ''));
                } else if (kind === 'layer') {
                    body.push(context.Tokens(Na__PubDoc__LayerSvg(loaded, step['Step__LayerId'])));
                }
            }
        } else {
            // ---- NO PLAN: data painted by the reader's own element painters -----
            // Hand-made documents - the example folder - carry the data and no
            // rendering. Furniture first, then layers from the back forwards:
            // Layer__Order 1 is frontmost, so the highest number paints first.
            body.push(Na__PubSheet__Marks(loaded.Sheet, context));
            for (const layer of Na__PubSheet__LayersBackToFront(loaded.Sheet)) {
                const kind = Na__PubSchema__Kind(layer['Layer__Type']);
                if (!kind) continue;
                if (kind.name === 'viewport') {
                    const whole = loaded.Elements.viewport;
                    const list  = whole ? (whole[kind.arrayKey] || []) : [];
                    body.push(Na__PubVp__Paint(list, context));
                    continue;
                }
                const whole = loaded.Elements[kind.name];
                if (whole) body.push(Na__PubEl__Paint(kind.name, whole, context));
            }
        }

        return {
            Ok       : true,
            State    : states.published,
            Paper    : paper,
            Manifest : loaded.Manifest,
            Markup   : Na__PubPaint__Svg(paper.WidthMm, paper.HeightMm,
                          Na__PubPaint__Done(defs), Na__PubPaint__Done(body),
                          { Class : 'na-pubdoc__sheet', DocumentId : documentId,
                            FontFamily : Na__PubDoc__Config.Sheet['Sheet__FontFamily'] }),
            Reason   : null
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Paper and Whatever Furniture an Unpublished Entry Carries
    // ------------------------------------------------------------
    // A real publish writes Document__UnderlaySvg and Document__FurnitureSvg for
    // every unpublished sheet into the unpublished sheets file - the notes
    // margin, border, title block and QR as the editor draws them (laying a
    // title block out needs no model and no render) - and the caller merges
    // that into the index row. Document__Marks, the reader's own display list,
    // is also accepted. With neither, the sheet is paper and a mask, which is
    // honest but plainer.
    // ------------------------------------------------------------
    function Na__PubDoc__MarksOnly(entry, paper) {
        const documentId = entry['Document__Id'];
        const context = {
            DocumentId : documentId,
            DefPrefix  : 'na-' + String(documentId).replace(/[^A-Za-z0-9_-]/g, ''),
            Defs       : Na__PubPaint__Sink(),
            Style      : (Na__PubDoc__Config && Na__PubDoc__Config.Sheet) || {},
            Url        : (path) => path ? Na__PubDoc__Urls__Direct(path) : null
        };
        const ground = Na__PubSheet__Ground(paper, context);
        const defs   = Na__PubPaint__Done(context.Defs);
        if (typeof entry['Document__FurnitureSvg'] === 'string' && entry['Document__FurnitureSvg']) {
            return (defs ? '<defs>' + defs + '</defs>' : '') + ground +
                   Na__PubDoc__ResolveTokens(documentId, entry['Document__UnderlaySvg'] || '') +
                   Na__PubDoc__ResolveTokens(documentId, entry['Document__FurnitureSvg']);
        }
        const marks = Array.isArray(entry['Document__Marks'])
            ? Na__PubSheet__Marks({ 'PublishedSheet__Marks' : entry['Document__Marks'] }, context)
            : '';
        return (defs ? '<defs>' + defs + '</defs>' : '') + ground + marks;
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve Every na-published: Reference in Some Markup
    // ------------------------------------------------------------
    // The publisher writes a picture or a shared image as
    // href="na-published:<ref>", never as a url, because a url is only right
    // for the host it was written on. Here each one becomes the url THIS host
    // should fetch - R2 on the live site, the repository on localhost.
    // ------------------------------------------------------------
    function Na__PubDoc__ResolveTokens(documentId, markup) {
        if (typeof markup !== 'string' || markup.indexOf('na-published:') === -1) return markup || '';
        return markup.replace(/(href=")na-published:([^"]*)"/g, (whole, attribute, reference) => {
            const clean    = reference.replace(/&amp;/g, '&');
            const relative = Na__PubSchema__ResolveDocumentRef(documentId, clean);
            const url      = relative ? Na__PubDoc__Urls__Direct(relative) : null;
            return attribute + (url ? url.replace(/&/g, '&amp;').replace(/"/g, '&quot;') : '') + '"';
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Layer's Published Markup, From Whichever File Holds It
    // ------------------------------------------------------------
    function Na__PubDoc__LayerSvg(loaded, layerId) {
        const key = (layerId === null || layerId === undefined) ? '__unlayered' : layerId;
        for (const name of Object.keys(loaded.Elements)) {
            const svg = loaded.Elements[name] && loaded.Elements[name]['Elements__LayerSvg'];
            if (svg && typeof svg[key] === 'string') return svg[key];
        }
        return '';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Url of a Published Document's Baked PDF (null when none)
    // ------------------------------------------------------------
    // The PDF was built at publish by the editor's own exporter; the reader only
    // downloads it. Building one here would render every viewport at the export
    // level - the single most expensive thing the app can do.
    // ------------------------------------------------------------
    async function Na__PubDoc__PdfUrl(documentId) {
        const loaded = await Na__PubDoc__LoadDocument(documentId);
        if (!loaded || !loaded.Ok) return null;
        const pdf = loaded.Manifest && loaded.Manifest['PublishedDocument__Files'] && loaded.Manifest['PublishedDocument__Files']['Files__Pdf'];
        if (!pdf || !pdf['File__Path']) return null;
        return Na__PubDoc__Urls__Direct(Na__PubSchema__DocumentFolder(documentId) + '/' + pdf['File__Path']);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wrap a Body in the Sheet Svg
    // ------------------------------------------------------------
    function Na__PubDoc__Wrap(documentId, paper, body) {
        return Na__PubPaint__Svg(paper.WidthMm, paper.HeightMm, '', body, {
            Class      : 'na-pubdoc__sheet',
            DocumentId : documentId,
            FontFamily : (Na__PubDoc__Config && Na__PubDoc__Config.Sheet && Na__PubDoc__Config.Sheet['Sheet__FontFamily']) || null
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | A Document's Paper Without Building It
    // ------------------------------------------------------------
    // The viewer sizes the page before the markup exists, so it can fit the
    // sheet to the screen and THEN pick the raster tier for that fitted size.
    // Read from the index row; the caller's fallback when there is no row.
    // ------------------------------------------------------------
    function Na__PubDoc__PaperOf(documentId, fallback) {
        const entry = Na__PubDoc__Entry(documentId);
        if (entry) return Na__PubDoc__PaperFromEntry(entry);
        if (fallback && Number(fallback.WidthMm) > 0 && Number(fallback.HeightMm) > 0) {
            return Na__PubSheet__Paper({ 'PublishedSheet__Paper' : {
                'Paper__WidthMm' : fallback.WidthMm, 'Paper__HeightMm' : fallback.HeightMm,
                'Paper__DrawingAreaMm' : fallback.DrawingAreaMm || null } });
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Let a Document Go
    // ------------------------------------------------------------
    function Na__PubDoc__Forget(documentId) {
        Na__PubDoc__Cache.delete(documentId);
        Na__PubVp__Release(documentId);
    }
    // ------------------------------------------------------------


    // FUNCTION | Let Everything Go
    // ------------------------------------------------------------
    function Na__PubDoc__ForgetAll() {
        Na__PubDoc__Cache.clear();
        Na__PubDoc__Papers = null;
        Na__PubVp__Release(null);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubDoc__LoadIndex,
        Na__PubDoc__Documents,
        Na__PubDoc__Entry,
        Na__PubDoc__Project,
        Na__PubDoc__LoadDocument,
        Na__PubDoc__Build,
        Na__PubDoc__PaperOf,
        Na__PubDoc__PdfUrl,
        Na__PubDoc__ResolveTokens,
        Na__PubDoc__Forget,
        Na__PubDoc__ForgetAll
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
