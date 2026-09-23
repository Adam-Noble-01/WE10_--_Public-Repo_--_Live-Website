// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DOCUMENT PUBLISHING
// =============================================================================
//
// FILE       : Na__LayoutEditor__Publish__.js
// NAMESPACE  : Na__LePub
// MODULE     : Layout Editor - Document Publishing
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Publish drawings: bake each one into its folder, archive a superseded revision, push to R2 in a safe order, and write the index last
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A KEY HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - PUBLISHING IS THE POINT AT WHICH FILES ARE MADE FOR THE READER. In the code
//   it is "baking"; on screen and to a client it is "publishing". It runs on the
//   authoring machine only, where the renderer already is, and produces a
//   folder the web viewer can show without rendering anything.
// - IT IS NOT AN EDIT. Nothing here writes to the sheet or the project data.
//   Ctrl+S stays exactly what it was. A drawing can be published, changed and
//   saved many times, and the client sees the published version until the next
//   publish.
// - THE ORDER, AND WHY IT IS THIS ORDER. For each document:
//     1. A different revision letter from the one already published archives
//        the whole folder to 00__Archive__Revisions (local only) first; the
//        same letter overwrites in place.
//     2. Every file is written to the project folder, the manifest LAST.
//     3. The document's folder is pruned to what the manifest names.
//     4. With R2 asked for: every file is uploaded, then LISTED BACK and checked
//        for size, and only then is the manifest uploaded - a manifest must
//        never name a file that is not whole in the bucket. Then the keys under
//        THAT ONE DOCUMENT that the new manifest does not name are removed.
//   And for the project, the unpublished sheets file and then the index are
//   written LAST of all, locally and then to R2, so a reader never sees a
//   half-finished publish: until the index moves, every reader is still
//   reading the previous one.
// - A PUBLISH NEVER SWEEPS. Pruning takes one document id and a keep list. A
//   published document whose sheet has gone (renumbered, re-phased, deleted) is
//   retired - archived here and taken off R2 - only when EVERY sheet is being
//   published at once, and otherwise only reported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Created with Phases 4 and 5 of TrueVision__PLAN__PublishingSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import {
        Na__LeModel__GetSheets, Na__LeModel__GetSheetById, Na__LeModel__GetDocumentId, Na__LeModel__GetFields
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSpec__EnsureLoaded } from '../50__Feature__Specification/Na__LayoutEditor__SpecData__.js';
    import { Na__LePdf__BuildDocument } from '../60__Feature__PdfExport/Na__LayoutEditor__PdfExporter__.js';
    import { Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__AppUtils__GetProjectFolderFromUrl, Na__AppUtils__GetYearFromUrl } from '../../03__AppUtils/Na__AppUtils__ProjectLoader.js';

    import {
        Na__PubSchema__Ready, Na__PubSchema__Get, Na__PubSchema__States, Na__PubSchema__IsDocumentId,
        Na__PubSchema__Kind, Na__PubSchema__Tiers, Na__PubSchema__PdfPath
    } from '../../53__Data__Layout__PublishedSchema/Na__PublishedSchema__Paths__.js';
    import { Na__PubVer__Stamp } from '../../53__Data__Layout__PublishedSchema/Na__PublishedSchema__Version__.js';

    import { Na__LePubRas__Sha } from './Na__LayoutEditor__Publish__Raster__.js';
    import { Na__LePubSheet__Build, Na__LePubSheet__Furniture } from './Na__LayoutEditor__Publish__Sheet__.js';
    import { Na__LePubVp__Bake } from './Na__LayoutEditor__Publish__Viewports__.js';
    import {
        Na__LePubNet__LocalReady, Na__LePubNet__WriteLocal, Na__LePubNet__ReadLocal, Na__LePubNet__ListLocal,
        Na__LePubNet__Archive, Na__LePubNet__PruneLocal, Na__LePubNet__R2Ready, Na__LePubNet__PushR2,
        Na__LePubNet__VerifyR2, Na__LePubNet__PruneR2
    } from './Na__LayoutEditor__Publish__Transport__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State and Configuration
// -----------------------------------------------------------------------------

    let Na__LePub__Setup = null;
    let Na__LePub__Busy  = false;

    const Na__LePub__F = {                                                        // <-- The built-in floor
        appVersion : 'v2.155.0', pushToR2Default : false, bakePdf : true,
        retireOrphans : true, specLoadTimeoutMs : 15000, labels : {}
    };

    // FUNCTION | Read the Publishing Settings Once (never throws)
    // ------------------------------------------------------------
    async function Na__LePub__Ready() {
        if (Na__LePub__Setup) return Na__LePub__Setup;
        await Na__PubSchema__Ready();
        let whole = null;
        try {
            const response = await fetch(new URL('./Na__LayoutEditor__Publish__Config__.json', import.meta.url), { cache : 'no-store' });
            if (response.ok) whole = await response.json();
        } catch (error) { whole = null; }
        const b = (whole && whole['LayoutEditor__Publish__Behaviour']) || {};
        Na__LePub__Setup = {
            appVersion        : b['Behaviour__AppVersion'] || Na__LePub__F.appVersion,
            pushToR2Default   : b['Behaviour__PushToR2Default'] === true,
            bakePdf           : b['Behaviour__BakePdf'] !== false,
            retireOrphans     : b['Behaviour__RetireOrphansOnFullPublish'] !== false,
            specLoadTimeoutMs : Number(b['Behaviour__SpecLoadTimeoutMs']) || Na__LePub__F.specLoadTimeoutMs,
            labels            : (whole && whole['LayoutEditor__Publish__Labels']) || {}
        };
        return Na__LePub__Setup;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Label, With {Tokens} Filled
    // ------------------------------------------------------------
    function Na__LePub__Label(key, fallback, tokens) {
        const labels = (Na__LePub__Setup && Na__LePub__Setup.labels) || {};
        let text = (typeof labels['Labels__' + key] === 'string') ? labels['Labels__' + key] : fallback;
        Object.keys(tokens || {}).forEach((name) => { text = text.split('{' + name + '}').join(String(tokens[name])); });
        return text;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Json in the House Style
// -----------------------------------------------------------------------------

    // FUNCTION | A Value as Json, Four-Space Indented, Sibling Colons Aligned
    // ------------------------------------------------------------
    // The published folder is also the thing Adam reads to see what a
    // published drawing is, so it is written the way every hand-made JSON
    // file in the app is laid out: within each run of sibling keys, the
    // colons line up.
    // ------------------------------------------------------------
    function Na__LePub__Json(value) {
        const lines = JSON.stringify(value, null, 4).split('\n');
        const KEY   = /^(\s*)("(?:[^"\\]|\\.)*"): (.*)$/;
        const out   = lines.slice();
        let run = [], indent = -1;
        const flush = () => {
            if (run.length > 1) {
                const width = Math.max.apply(null, run.map((i) => KEY.exec(lines[i])[2].length));
                run.forEach((i) => {
                    const m = KEY.exec(lines[i]);
                    out[i] = m[1] + m[2] + ' '.repeat(width - m[2].length) + ' : ' + m[3];
                });
            } else if (run.length === 1) {
                const m = KEY.exec(lines[run[0]]);
                out[run[0]] = m[1] + m[2] + ' : ' + m[3];
            }
            run = []; indent = -1;
        };
        lines.forEach((line, i) => {
            const m = KEY.exec(line);
            if (!m) { flush(); return; }
            if (m[1].length !== indent) { flush(); indent = m[1].length; }
            run.push(i);
        });
        flush();
        return out.join('\n') + '\n';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Json File as a Blob
    // ------------------------------------------------------------
    function Na__LePub__JsonBlob(value) {
        return new Blob([ Na__LePub__Json(value) ], { type : 'application/json' });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Status
// -----------------------------------------------------------------------------

    // FUNCTION | What Is Published for Each Sheet, and Is It Current
    // ------------------------------------------------------------
    // Returns [ { SheetId, Name, DocumentId, Revision, PublishedRevision, State } ]
    // with State 'published' | 'stale' | 'never'. Read from the local index,
    // which is what the last publish wrote.
    // ------------------------------------------------------------
    async function Na__LePub__Status() {
        await Na__LePub__Ready();
        const index = await Na__LePubNet__ReadLocal(Na__PubSchema__Get().files.index);
        const byId  = new Map(((index && index['PublishedDocuments__Documents']) || [])
            .filter((one) => one['Document__State'] === Na__PubSchema__States().published)
            .map((one) => [ one['Document__Id'], one ]));
        return Na__LeModel__GetSheets().map((sheet) => {
            const documentId = Na__LeModel__GetDocumentId(sheet);
            const revision   = String(Na__LeModel__GetFields(sheet).Revision || '');
            const entry      = byId.get(documentId);
            const published  = entry ? String(entry['Document__Revision'] || '') : null;
            return {
                SheetId           : sheet.Sheet__Id,
                Name              : sheet.Sheet__Name,
                DocumentId        : documentId,
                Revision          : revision,
                PublishedRevision : published,
                PublishedAtIso    : entry ? entry['Document__PublishedAtIso'] : null,
                State             : !entry ? 'never' : (published === revision ? 'published' : 'stale')
            };
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Publish One Document
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Upload a Batch of { Path, Blob } Files to One Destination
    // ------------------------------------------------------------
    async function Na__LePub__Put(files, put) {
        for (const file of files) {
            const result = await put(file.Path, file.Blob);
            if (!result.Ok) return { Ok : false, Reason : file.Path + ': ' + result.Reason };
        }
        return { Ok : true };
    }
    // ------------------------------------------------------------


    // FUNCTION | Bake and File One Sheet
    // ------------------------------------------------------------
    // Returns { Ok, DocumentId, Entry (the index row), Assets, Warnings,
    // Archived, Reason }.
    // ------------------------------------------------------------
    async function Na__LePub__PublishOne(sheet, context) {
        const setup      = Na__LePub__Setup;
        const schema     = Na__PubSchema__Get();
        const documentId = Na__LeModel__GetDocumentId(sheet);
        const say        = (stage) => context.OnProgress({ Stage : stage, Name : sheet.Sheet__Name, DocumentId : documentId });
        const warnings   = [];

        if (!Na__PubSchema__IsDocumentId(documentId)) {
            return { Ok : false, DocumentId : documentId, Reason : 'the sheet has no document id to publish under - give it a drawing number in the register' };
        }
        const fields   = Na__LeModel__GetFields(sheet);
        const revision = String(fields.Revision || 'A').trim() || 'A';

        // ---- 1. THE REVISION ---------------------------------------------------
        say('checking the revision');
        let revisionAction = 'new';
        let archived = null;
        const oldManifest = await Na__LePubNet__ReadLocal(documentId + '/' + schema.files.manifest);
        if (oldManifest) {
            const identity = oldManifest['PublishedDocument__Identity'] || {};
            const oldRevision = String(identity['Document__Revision'] || '').trim();
            if (oldRevision && oldRevision !== revision) {
                const result = await Na__LePubNet__Archive(documentId, oldRevision);
                if (!result.Ok) return { Ok : false, DocumentId : documentId, Reason : 'revision ' + oldRevision + ' could not be archived (' + result.Reason + '), so nothing was replaced' };
                archived = { Revision : oldRevision, File : result.Archived };
                revisionAction = 'archived-and-rebuilt';
            } else {
                revisionAction = 'overwritten';
            }
        }

        // ---- 2. THE SHEET AND ITS ELEMENTS -------------------------------------
        say('sheet and markup');
        const built = await Na__LePubSheet__Build(sheet, documentId);
        const files = [];                                                         // <-- { Path (root-relative), Blob }
        const assets = built.Assets.slice();

        // ---- 3. THE VIEWPORTS, in the order the page stacks them ---------------
        const viewportKind = Na__PubSchema__Kind('viewport');
        const viewportFile = built.Files.viewport || (built.Files.viewport = {
            'Elements__Meta' : { 'Meta__FileName' : viewportKind.file, 'Meta__Kind' : 'viewport', 'Meta__Document' : documentId },
            'Elements__LayerSvg' : {}
        });
        viewportFile[viewportKind.arrayKey] = [];
        const manifestViewports = [];
        const planViewports = built.Plan.filter((step) => step.kind === 'viewport').map((step) => step.viewport);
        for (let i = 0; i < planViewports.length; i++) {
            const viewport = planViewports[i];
            const baked = await Na__LePubVp__Bake(sheet, viewport, documentId, (stage) => say('viewport ' + (i + 1) + ' of ' + planViewports.length + ', ' + stage));
            viewportFile[viewportKind.arrayKey].push(baked.Element);
            manifestViewports.push(baked.Manifest);
            baked.Files.forEach((one) => files.push(one));
            baked.Assets.forEach((one) => { if (!assets.some((a) => a.Path === one.Path)) assets.push(one); });
            baked.Warnings.forEach((one) => warnings.push(one));
        }
        if (viewportFile[viewportKind.arrayKey].length === 0 && Object.keys(viewportFile['Elements__LayerSvg']).length === 0) {
            delete built.Files.viewport;                                          // <-- A sheet with no viewport has no viewport file
        }

        // ---- 4. THE PDF, baked by the editor's own exporter ---------------------
        let pdfEntry = null;
        if (setup.bakePdf) {
            say('PDF');
            try {
                // 'FAST' PACKING: every viewport picture's rows are stored against
                // the pixel to their left, never the row above, because Chrome's
                // PDF engine - Android's viewer too - paints black streaks over a
                // row-above picture past 60 MB decoded, and a client's phone is
                // exactly where this file is opened.
                const pdf  = await Na__LePdf__BuildDocument(sheet, { strict : false, pictureCompression : 'FAST' });
                const blob = pdf.doc.output('blob');
                const hash = (await Na__LePubRas__Sha(blob)).slice(0, schema.files.hashLength);
                const path = Na__PubSchema__PdfPath(documentId, hash);
                files.push({ Path : path.slice(path.indexOf('/') + 1), Blob : blob });
                pdfEntry = { 'File__Path' : path.slice(path.indexOf('/') + documentId.length + 2), 'File__Bytes' : blob.size, 'File__Sha256' : hash, 'File__Name' : pdf.filename };
            } catch (error) {
                warnings.push(documentId + ': the PDF could not be baked (' + error.message + '); readers will have no PDF for it.');
            }
        }

        // ---- 5. THE ELEMENT FILES AND THE SHEET FILE ---------------------------
        const elementEntries = [];
        for (const name of Object.keys(built.Files)) {
            const kind  = Na__PubSchema__Kind(name);
            const whole = built.Files[name];
            const blob  = Na__LePub__JsonBlob(whole);
            const local = schema.folders.elements + '/' + kind.file;
            files.push({ Path : documentId + '/' + local, Blob : blob });
            elementEntries.push({
                'File__Type'   : kind.name,
                'File__Layers' : Object.keys(whole['Elements__LayerSvg'] || {}),
                'File__Path'   : local,
                'File__Count'  : Array.isArray(whole[kind.arrayKey]) ? whole[kind.arrayKey].length : 0,
                'File__Bytes'  : blob.size,
                'File__Sha256' : (await Na__LePubRas__Sha(blob)).slice(0, schema.files.hashLength)
            });
        }
        const sheetBlob = Na__LePub__JsonBlob(built.Sheet);
        files.push({ Path : documentId + '/' + schema.files.sheet, Blob : sheetBlob });

        // ---- 6. THE MANIFEST -----------------------------------------------------
        const layout = built.Layout;
        const manifest = {
            'PublishedDocument__Meta' : {
                'Meta__FileName'  : schema.files.manifest,
                'Meta__Note'      : 'Everything this published document is made of. Written LAST, after every file it names is in place, so its presence means the document is whole.',
                'Meta__SchemaRef' : 'na-project-portal/26-Projects/AA00__ExampleProjectStructure/30__TrueVision__AppContent/06__Layout__PublishedDocuments'
            },
            'PublishedDocument__Identity' : {
                'Document__Id'            : documentId,
                'Document__ProjectCode'   : Na__DrawData__GetProjectCode() || null,
                'Document__Phase'         : fields.Phase,
                'Document__Number'        : fields.DrawingNumber,
                'Document__Name'          : sheet.Sheet__Name,
                'Document__Revision'      : revision,
                'Document__Status'        : fields.Status || null,
                'Document__SourceSheetId' : sheet.Sheet__Id
            },
            'PublishedDocument__Publish' : Object.assign(Na__PubVer__Stamp(setup.appVersion), {
                'Publish__RevisionAction' : revisionAction,
                'Publish__Archived'       : archived ? archived.File : null
            }),
            'PublishedDocument__Files' : {
                'Files__Sheet'     : { 'File__Path' : schema.files.sheet, 'File__Bytes' : sheetBlob.size,
                                       'File__Sha256' : (await Na__LePubRas__Sha(sheetBlob)).slice(0, schema.files.hashLength) },
                'Files__Elements'  : elementEntries,
                'Files__Viewports' : manifestViewports,
                'Files__Pdf'       : pdfEntry,
                'Files__TotalBytes': files.reduce((sum, one) => sum + one.Blob.size, 0)
            }
        };
        const manifestBlob = Na__LePub__JsonBlob(manifest);
        const manifestFile = { Path : documentId + '/' + schema.files.manifest, Blob : manifestBlob };
        const keep = files.map((one) => one.Path).concat([ manifestFile.Path ]);

        // ---- 7. LOCAL: files, manifest last, then prune this one document -----
        say('filing locally');
        const sharedOk = await Na__LePub__Put(assets, Na__LePubNet__WriteLocal);
        if (!sharedOk.Ok) return { Ok : false, DocumentId : documentId, Reason : sharedOk.Reason };
        const localOk = await Na__LePub__Put(files, Na__LePubNet__WriteLocal);
        if (!localOk.Ok) return { Ok : false, DocumentId : documentId, Reason : localOk.Reason };
        const manifestOk = await Na__LePubNet__WriteLocal(manifestFile.Path, manifestFile.Blob);
        if (!manifestOk.Ok) return { Ok : false, DocumentId : documentId, Reason : manifestOk.Reason };
        const pruned = await Na__LePubNet__PruneLocal(documentId, keep);
        if (!pruned.Ok) warnings.push(documentId + ': old local files could not be pruned (' + pruned.Reason + ').');

        // ---- 8. R2: files, verify, manifest, then prune this one document -----
        if (context.ToR2) {
            say('pushing to R2');
            const r2Assets = await Na__LePub__Put(assets, Na__LePubNet__PushR2);
            if (!r2Assets.Ok) return { Ok : false, DocumentId : documentId, Local : true, Reason : 'R2: ' + r2Assets.Reason };
            const r2Files = await Na__LePub__Put(files, Na__LePubNet__PushR2);
            if (!r2Files.Ok) return { Ok : false, DocumentId : documentId, Local : true, Reason : 'R2: ' + r2Files.Reason };
            say('checking R2');
            const verified = await Na__LePubNet__VerifyR2(documentId, files.filter((one) => one.Path.indexOf(documentId + '/') === 0)
                .map((one) => ({ Path : one.Path, Bytes : one.Blob.size })));
            if (!verified.Ok) return { Ok : false, DocumentId : documentId, Local : true, Reason : 'R2 did not hold what was sent - ' + verified.Reason + '. The previous published version is untouched.' };
            const r2Manifest = await Na__LePubNet__PushR2(manifestFile.Path, manifestFile.Blob);
            if (!r2Manifest.Ok) return { Ok : false, DocumentId : documentId, Local : true, Reason : 'R2 manifest: ' + r2Manifest.Reason };
            const r2Pruned = await Na__LePubNet__PruneR2(documentId, keep);
            if (!r2Pruned.Ok) warnings.push(documentId + ': ' + r2Pruned.Reason + '.');
        }

        const entry = {
            'Document__Id'             : documentId,
            'Document__Number'         : fields.DrawingNumber,
            'Document__Phase'          : fields.Phase,
            'Document__Name'           : sheet.Sheet__Name,
            'Document__PaperSize'      : layout.Page.SizeKey || layout.Page.Label || null,
            'Document__Orientation'    : layout.Page.Orientation,
            'Document__PaperWidthMm'   : layout.Page.WidthMm,
            'Document__PaperHeightMm'  : layout.Page.HeightMm,
            'Document__DrawingAreaMm'  : { 'X' : layout.Drawing.X, 'Y' : layout.Drawing.Y, 'WidthMm' : layout.Drawing.WidthMm, 'HeightMm' : layout.Drawing.HeightMm },
            'Document__Revision'       : revision,
            'Document__Status'         : fields.Status || null,
            'Document__State'          : Na__PubSchema__States().published,
            'Document__Folder'         : documentId,
            'Document__PublishedAtIso' : manifest['PublishedDocument__Publish']['Publish__AtIso'],
            'Document__HasViewports'   : planViewports.length > 0,
            'Document__HasPdf'         : !!pdfEntry
        };
        return { Ok : true, DocumentId : documentId, Entry : entry, Warnings : warnings, Archived : archived, Bytes : manifest['PublishedDocument__Files']['Files__TotalBytes'] };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Index
// -----------------------------------------------------------------------------

    // FUNCTION | An Index Row, and Its Sheet Paper, for a Sheet That Is NOT Published
    // ------------------------------------------------------------
    // The paper - border, title block, notes margin - is drawn by the editor, so
    // the reader shows the right sheet, number and title behind the grey panel;
    // laying it out needs no model and no render. It goes to the unpublished
    // file, NOT the row: at about 30 KB a sheet it would otherwise be nearly all
    // of the index, which every reader downloads first.
    // Returns { Row, Paper }.
    // ------------------------------------------------------------
    async function Na__LePub__UnpublishedEntry(sheet, assets) {
        const paper  = await Na__LePubSheet__Furniture(sheet, assets);
        const layout = paper.Layout;
        const fields = paper.Fields;
        const id     = Na__LeModel__GetDocumentId(sheet);
        const row = {
            'Document__Id'             : id,
            'Document__Number'         : fields.DrawingNumber,
            'Document__Phase'          : fields.Phase,
            'Document__Name'           : sheet.Sheet__Name,
            'Document__PaperSize'      : layout.Page.SizeKey || layout.Page.Label || null,
            'Document__Orientation'    : layout.Page.Orientation,
            'Document__PaperWidthMm'   : layout.Page.WidthMm,
            'Document__PaperHeightMm'  : layout.Page.HeightMm,
            'Document__DrawingAreaMm'  : { 'X' : layout.Drawing.X, 'Y' : layout.Drawing.Y, 'WidthMm' : layout.Drawing.WidthMm, 'HeightMm' : layout.Drawing.HeightMm },
            'Document__Revision'       : String(fields.Revision || ''),
            'Document__Status'         : fields.Status || null,
            'Document__State'          : Na__PubSchema__States().unpublished,
            'Document__Folder'         : null,
            'Document__PublishedAtIso' : null
        };
        return {
            Row   : row,
            Paper : { 'Document__Id' : id, 'Document__UnderlaySvg' : paper.UnderlaySvg, 'Document__FurnitureSvg' : paper.FurnitureSvg }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Project Index, and the Unpublished Sheets File, From the Register
    // ------------------------------------------------------------
    // Every sheet of the register has a row, in the register's order: the ones
    // published now, the ones published before that are still whole on disk,
    // and the rest as unpublished, whose paper goes to the unpublished file.
    // Returns { Index, Unpublished }.
    // ------------------------------------------------------------
    async function Na__LePub__BuildIndex(publishedNow, oldIndex, assets) {
        const states  = Na__PubSchema__States();
        const oldRows = new Map(((oldIndex && oldIndex['PublishedDocuments__Documents']) || [])
            .filter((one) => one['Document__State'] === states.published)
            .map((one) => [ one['Document__Id'], one ]));
        const localFiles = await Na__LePubNet__ListLocal(null);
        const whole = new Set((localFiles.Files || [])
            .map((one) => one.path)
            .filter((path) => /\/Document__Manifest__\.json$/.test(path))
            .map((path) => path.split('/')[0]));

        const rows = [];
        const papers = [];
        const sheets = Na__LeModel__GetSheets();
        for (let i = 0; i < sheets.length; i++) {
            const sheet = sheets[i];
            const id    = Na__LeModel__GetDocumentId(sheet);
            let row;
            if (publishedNow.has(id)) row = Object.assign({}, publishedNow.get(id));
            else if (oldRows.has(id) && whole.has(id)) row = Object.assign({}, oldRows.get(id));
            else {
                const unpublished = await Na__LePub__UnpublishedEntry(sheet, assets);
                row = unpublished.Row;
                papers.push(unpublished.Paper);
            }
            row['Document__Order'] = i + 1;
            rows.push(row);
        }

        const schema = Na__PubSchema__Get();
        const projectFolder = Na__AppUtils__GetProjectFolderFromUrl();
        const stamp = Na__PubVer__Stamp(Na__LePub__Setup.appVersion);
        const index = {
            'PublishedDocuments__Meta' : {
                'Meta__FileName'  : schema.files.index,
                'Meta__Note'      : 'Which drawings of this project are published. The first file a reader downloads. An unpublished drawing\'s sheet paper is in ' + schema.files.unpublished + ', fetched only when one is opened. Written LAST by a publish.',
                'Meta__SchemaRef' : 'na-project-portal/26-Projects/AA00__ExampleProjectStructure/30__TrueVision__AppContent/06__Layout__PublishedDocuments'
            },
            'PublishedDocuments__Project' : {
                'Project__Code'          : Na__DrawData__GetProjectCode() || null,
                'Project__Folder'        : Na__AppUtils__GetYearFromUrl() + '-Projects/' + projectFolder,
                'Project__ContentFolder' : '30__TrueVision__AppContent/' + Na__PubSchema__Get().folders.root
            },
            'PublishedDocuments__Publish' : Object.assign(stamp, {
                'Publish__LastPublishedIso' : stamp['Publish__AtIso'],
                'Publish__DocumentCount'    : rows.filter((one) => one['Document__State'] === states.published).length,
                'Publish__UnpublishedCount' : rows.filter((one) => one['Document__State'] !== states.published).length,
                'Publish__ArchiveFolder'    : Na__PubSchema__Get().folders.archive
            }),
            'PublishedDocuments__RasterTiers' : {
                'RasterTiers__Tiers' : Na__PubSchema__Tiers().map((tier) => ({
                    'Tier__Id' : tier.id, 'Tier__Name' : tier.name, 'Tier__PixelsPerMm' : tier.pixelsPerMm,
                    'Tier__MaxPixels' : tier.maxPixels, 'Tier__Format' : tier.format, 'Tier__Quality' : tier.quality,
                    'Tier__UpToZoom' : tier.upToZoom
                }))
            },
            'PublishedDocuments__Documents'  : rows,
            'PublishedDocuments__Superseded' : { 'Superseded__Documents' : [] }
        };
        const unpublished = {
            'Unpublished__Meta' : {
                'Meta__FileName'  : schema.files.unpublished,
                'Meta__Note'      : 'The sheet paper of every drawing the index lists as unpublished - border, title block, notes margin and QR as the editor draws them - for the reader to show behind the grey panel. Fetched only when an unpublished drawing is opened. Written just before the index.',
                'Meta__SchemaRef' : 'na-project-portal/26-Projects/AA00__ExampleProjectStructure/30__TrueVision__AppContent/06__Layout__PublishedDocuments'
            },
            'Unpublished__Documents' : papers
        };
        return { Index : index, Unpublished : unpublished };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Publish Sheets
    // ------------------------------------------------------------
    // sheetIds : the sheets to publish, or null for every sheet.
    // options  : { ToR2, OnProgress({ Stage, Name, DocumentId, Index, Total }) }
    // Returns { Ok, Published:[id], Failed:[{ DocumentId, Reason }], Warnings,
    //           Archived:[{ DocumentId, Revision, File }], Orphans:[id],
    //           Retired:[id], Reason }.
    // ------------------------------------------------------------
    async function Na__LePub__PublishSheets(sheetIds, options) {
        if (Na__LePub__Busy) return { Ok : false, Reason : 'a publish is already running' };
        Na__LePub__Busy = true;
        const o = options || {};
        const progress = (typeof o.OnProgress === 'function') ? o.OnProgress : () => {};
        const result = { Ok : true, Published : [], Failed : [], Warnings : [], Archived : [], Orphans : [], Retired : [], Reason : null };
        try {
            const setup = await Na__LePub__Ready();

            const local = await Na__LePubNet__LocalReady();
            if (!local.Ok) return Object.assign(result, { Ok : false, Reason : local.Reason });
            const toR2 = o.ToR2 === true;
            if (toR2) {
                const r2 = Na__LePubNet__R2Ready();
                if (!r2.Ok) return Object.assign(result, { Ok : false, Reason : r2.Reason });
            }

            // The notes margin and every bubble's note need the specification.
            await Promise.race([ Na__LeSpec__EnsureLoaded(), new Promise((resolve) => setTimeout(resolve, setup.specLoadTimeoutMs)) ]);

            const all    = Na__LeModel__GetSheets();
            const chosen = Array.isArray(sheetIds) ? sheetIds.map((id) => Na__LeModel__GetSheetById(id)).filter(Boolean) : all.slice();
            const full   = chosen.length === all.length;
            const oldIndex = await Na__LePubNet__ReadLocal(Na__PubSchema__Get().files.index);

            const publishedNow = new Map();
            for (let i = 0; i < chosen.length; i++) {
                const sheet = chosen[i];
                const context = {
                    ToR2 : toR2,
                    OnProgress : (event) => progress(Object.assign({ Index : i + 1, Total : chosen.length }, event))
                };
                let one;
                try {
                    one = await Na__LePub__PublishOne(sheet, context);
                } catch (error) {
                    console.error('[TrueVision3D Publish] ' + sheet.Sheet__Name + ' failed:', error);
                    one = { Ok : false, DocumentId : Na__LeModel__GetDocumentId(sheet), Reason : error.message || String(error) };
                }
                (one.Warnings || []).forEach((warning) => result.Warnings.push(warning));
                if (one.Archived) result.Archived.push(Object.assign({ DocumentId : one.DocumentId }, one.Archived));
                if (one.Ok) { result.Published.push(one.DocumentId); publishedNow.set(one.DocumentId, one.Entry); }
                else result.Failed.push({ DocumentId : one.DocumentId, Name : sheet.Sheet__Name, Reason : one.Reason });
            }

            // ORPHANS | Published before, and no sheet produces that id any more
            const current = new Set(all.map((sheet) => Na__LeModel__GetDocumentId(sheet)));
            const oldPublished = ((oldIndex && oldIndex['PublishedDocuments__Documents']) || [])
                .filter((one) => one['Document__State'] === Na__PubSchema__States().published);
            for (const row of oldPublished) {
                const id = row['Document__Id'];
                if (current.has(id)) continue;
                if (!(full && setup.retireOrphans)) { result.Orphans.push(id); continue; }
                progress({ Stage : 'retiring', Name : id, DocumentId : id });
                const archived = await Na__LePubNet__Archive(id, String(row['Document__Revision'] || 'X'));
                if (!archived.Ok) { result.Warnings.push(id + ': could not be retired (' + archived.Reason + ').'); continue; }
                if (toR2) {
                    const removed = await Na__LePubNet__PruneR2(id, []);
                    if (!removed.Ok) result.Warnings.push(id + ': ' + removed.Reason + '.');
                }
                result.Retired.push(id);
            }

            // THE INDEX, LAST OF ALL - locally, then on R2. The unpublished
            // sheets file lands just before it: a reader still holding the
            // previous index that opens a drawing published a moment ago finds
            // no paper for it and shows plain paper behind the panel, which is
            // the only thing a publish in progress can make it see.
            progress({ Stage : 'writing the index', Name : '', DocumentId : null });
            const files  = Na__PubSchema__Get().files;
            const assets = [];
            const built  = await Na__LePub__BuildIndex(publishedNow, oldIndex, assets);
            const shared = await Na__LePub__Put(assets, Na__LePubNet__WriteLocal);
            if (!shared.Ok) return Object.assign(result, { Ok : false, Reason : shared.Reason });
            const unpublishedBlob = Na__LePub__JsonBlob(built.Unpublished);
            const indexBlob       = Na__LePub__JsonBlob(built.Index);
            const wroteLocalPaper = await Na__LePubNet__WriteLocal(files.unpublished, unpublishedBlob);
            if (!wroteLocalPaper.Ok) return Object.assign(result, { Ok : false, Reason : 'the unpublished sheets could not be written (' + wroteLocalPaper.Reason + ')' });
            const wroteLocal = await Na__LePubNet__WriteLocal(files.index, indexBlob);
            if (!wroteLocal.Ok) return Object.assign(result, { Ok : false, Reason : 'the index could not be written (' + wroteLocal.Reason + ')' });
            if (toR2) {
                const r2Shared = await Na__LePub__Put(assets, Na__LePubNet__PushR2);
                if (!r2Shared.Ok) return Object.assign(result, { Ok : false, Reason : 'R2: ' + r2Shared.Reason });
                const wroteR2Paper = await Na__LePubNet__PushR2(files.unpublished, unpublishedBlob);
                if (!wroteR2Paper.Ok) return Object.assign(result, { Ok : false, Reason : 'R2 unpublished sheets: ' + wroteR2Paper.Reason });
                const wroteR2 = await Na__LePubNet__PushR2(files.index, indexBlob);
                if (!wroteR2.Ok) return Object.assign(result, { Ok : false, Reason : 'R2 index: ' + wroteR2.Reason });
            }
            result.IndexBytes       = indexBlob.size;
            result.UnpublishedBytes = unpublishedBlob.size;

            result.Ok = result.Failed.length === 0;
            if (!result.Ok) result.Reason = result.Failed.map((one) => one.Name + ': ' + one.Reason).join('; ');
            if (result.Warnings.length) console.warn('[TrueVision3D Publish] ' + result.Warnings.length + ' warning(s):\n  ' + result.Warnings.join('\n  '));
            return result;
        } finally {
            Na__LePub__Busy = false;
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Publish Running
    // ------------------------------------------------------------
    function Na__LePub__IsBusy() { return Na__LePub__Busy; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__LePub__Ready,
        Na__LePub__Label,
        Na__LePub__Json,
        Na__LePub__Status,
        Na__LePub__PublishSheets,
        Na__LePub__IsBusy
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
