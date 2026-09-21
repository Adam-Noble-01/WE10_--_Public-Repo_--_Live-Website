// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET IMAGES - PUBLISH
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetImages__Publish__.js
// NAMESPACE  : Na__LeImgPub
// MODULE     : Layout Editor - Sheet Images - Publish
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Every drawings save files each picture under its drawing's document id, on disk and on R2, before the drawings point at it
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - THE DRAWING NUMBER DECIDES THE FOLDER. A picture on RB05_T01_D01 lives in
//   05__Layout__DrawingDocs__Images/RB05_T01_D01/. The document id is composed
//   from the project, the phase and the drawing number (Na__LeRec__DocumentId),
//   so a renumber, a phase change, a register move, a typed id or a sheet made
//   or deleted in the tab strip can all change it - and none of them has to
//   know pictures exist. This is a SAVE STEP (Na__DrawData__RegisterSaveStep)
//   and every drawings save runs it: Save Sheets, and every register edit,
//   which saves the moment it is confirmed. So the moment a drawing's number
//   changes and is saved, its pictures follow it.
// - A PICTURE IS CUT TO ITS PRINT SIZE BEFORE IT IS FILED. Nothing is written
//   when a picture is dropped: its original stays in memory, and the first
//   save after the drop cuts the picture that is kept from it - the pixels a
//   print at Storage PrintDpi needs at the largest size a drawing shows it
//   (Na__LeImgGeo__StoreSize), never above the original - and points the
//   drawings at that. Resized again this session, the next save cuts it
//   again, from the same original. A picture saved in an earlier session has
//   no original here and is never re-encoded; Replace brings one back.
// - IN THREE PHASES, so the live site is never shown a drawing pointing at a
//   picture that is not there:
//     before   every picture dropped this session is cut to its print size;
//              then every picture is filed where its drawing's id says -
//              copied on disk through the local server, and onto R2 (copied
//              inside the bucket when R2 already has it anywhere, uploaded
//              otherwise)
//     payload  the copy of the drawings about to be written points each
//              picture at its new folder - only where R2 confirmed it
//     after    R2 has the drawings: the live records adopt the new folders;
//              every picture nothing points at is taken off R2 and moved into
//              the project's 00__Archive on disk (never deleted there)
//   A save that fails part way leaves the drawings on R2 pointing at the
//   folders they pointed at before, which still hold their pictures, and the
//   next save finishes the job. A picture that cannot be found anywhere is
//   named in the save's toast.
// - NOTHING HERE TRUSTS A FOLDER NAME. Image__Folder is where a picture was
//   last filed, a hint the next save corrects; the picture is known by its
//   file name, which carries its content hash, so any copy found anywhere is
//   the right one. An undo that brings back an old hint is corrected by the
//   next save the same way.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - The before phase first cuts every picture dropped or replaced this
//   session to its print size, from the original held in memory (Hold's new
//   source argument), and re-points the drawings at the cut; the save's toast
//   says how much lighter. Pictures are no longer written at the drop, so
//   NoteOnDisk has gone. HasSource tells the panel whether a save will cut.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Drawings Block, the Document Id, R2, the Local Store, the Source
    // ------------------------------------------------------------
    import { Na__DrawData__RegisterSaveStep, Na__DrawData__GetSheetsArray, Na__DrawData__SHEETS_KEY } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__LeRec__DocumentId } from '../07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js';
    import {
        Na__CfApi__IsConfigured,
        Na__CfApi__SHEET_IMAGES_ARCHIVE,
        Na__CfApi__ListSheetImages,
        Na__CfApi__UploadSheetImage,
        Na__CfApi__CopySheetImage,
        Na__CfApi__DeleteSheetImage
    } from '../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    import { Na__LeImgStore__Reconcile, Na__LeImgStore__Upload, Na__LeImgStore__IsLocal } from './Na__LayoutEditor__SheetImages__Store__.js';
    import { Na__LeImgSrc__Blob, Na__LeImgSrc__Retry, Na__LeImgSrc__Adopt } from './Na__LayoutEditor__SheetImages__Source__.js';
    import { Na__LeImgGeo__FolderFor, Na__LeImgGeo__IsManagedName, Na__LeImgGeo__Rect, Na__LeImgGeo__StoreSize, Na__LeImgGeo__NeedsRecut } from './Na__LayoutEditor__SheetImages__Geometry__.js';
    import { Na__LeImgCfg__Label, Na__LeImgCfg__Storage } from './Na__LayoutEditor__SheetImages__Setup__.js';
    import { Na__LeImgEnc__Recut } from './Na__LayoutEditor__SheetImages__Encode__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Step's Name, and How Far From Its Print Size a Picture May Drift Before It Is Cut Again
    // ------------------------------------------------------------
    const Na__LeImgPub__STEP_ID     = 'Sheet pictures';
    const Na__LeImgPub__RECUT_SLACK = 0.05;                                      // <-- Nudging a picture a few per cent bigger or smaller never makes a new file
    // ------------------------------------------------------------

    // MODULE VARIABLES | What Is Known to Be Where, This Session
    // ------------------------------------------------------------
    let   Na__LeImgPub__OnR2       = null;       // <-- Set of 'folder/file' on R2; null until listed this session
    const Na__LeImgPub__OnDisk     = new Set();  // <-- 'folder/file' confirmed in the project folder this session
    const Na__LeImgPub__Held       = new Map();  // <-- file -> Blob: pictures dropped this session, and their cuts, until R2 has them
    const Na__LeImgPub__Sources    = new Map();  // <-- file -> the original it was made from (dropped or replaced this session): what the save cuts from
    let   Na__LeImgPub__Registered = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | 'folder/file'
    // ------------------------------------------------------------
    function Na__LeImgPub__Key(folder, file) { return folder + '/' + file; }
    // ------------------------------------------------------------


    // FUNCTION | The Folder a Sheet's Pictures Belong In: Its Document Id
    // ------------------------------------------------------------
    // The id the title block prints, made safe as a folder name; the sheet's
    // own id when there is nothing to compose it from. Works on a live sheet
    // and on the plain copy a save is about to write alike.
    // ------------------------------------------------------------
    function Na__LeImgPub__FolderOf(sheet) {
        return Na__LeImgGeo__FolderFor(Na__LeRec__DocumentId(sheet), sheet ? sheet.Sheet__Id : '', Na__CfApi__SHEET_IMAGES_ARCHIVE);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Every Picture on a List of Sheets, With the Folder It Belongs In
    // ------------------------------------------------------------
    function Na__LeImgPub__Collect(sheets) {
        const items = [];
        (Array.isArray(sheets) ? sheets : []).forEach((sheet) => {
            const shapes = sheet && Array.isArray(sheet.Sheet__Shapes) ? sheet.Sheet__Shapes : [];
            let folder = null;
            shapes.forEach((shape) => {
                const block = shape ? shape.Shape__Image : null;
                if (!block || typeof block !== 'object' || typeof block.Image__File !== 'string' || !block.Image__File) return;
                if (folder === null) folder = Na__LeImgPub__FolderOf(sheet);
                items.push({ sheet : sheet, shape : shape, block : block, folder : folder, file : block.Image__File, key : Na__LeImgPub__Key(folder, block.Image__File) });
            });
        });
        return items;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Entry per Folder and File, With Every Folder It Was Seen In
    // ------------------------------------------------------------
    function Na__LeImgPub__Wanted(items) {
        const wanted = new Map();
        items.forEach((item) => {
            const entry = wanted.get(item.key) || { folder : item.folder, file : item.file, from : new Set(), alpha : false };
            if (item.block.Image__Folder) entry.from.add(item.block.Image__Folder);
            wanted.set(item.key, entry);
        });
        return wanted;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Picture's Bytes: Held in Memory, the Folder Just Filed, or Wherever the Source Finds It
    // ------------------------------------------------------------
    async function Na__LeImgPub__BytesOf(entry) {
        const held = Na__LeImgPub__Held.get(entry.file);
        if (held) return held;
        Na__LeImgSrc__Retry([ entry.file ]);                                    // <-- A picture the screen gave up on may have just been filed
        const blob = await Na__LeImgSrc__Blob(entry.folder, entry.file);
        if (blob) return blob;
        for (const folder of entry.from) {
            const found = await Na__LeImgSrc__Blob(folder, entry.file);
            if (found) return found;
        }
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Megabytes for the Toast
    // ------------------------------------------------------------
    function Na__LeImgPub__Mb(bytes) {
        return (bytes / 1e6).toFixed(bytes < 1e7 ? 2 : 1);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Cut Every Picture Dropped This Session to the Size the Drawings Print It
    // ------------------------------------------------------------
    // Only a picture whose original is still in memory - dropped or replaced
    // this session - and only when the file it has is more than the slack
    // away from StoreSize: cut ONCE from that original, for the largest place
    // any drawing shows it, and every drawing showing it is pointed at the
    // cut. Silently, as the after phase re-points folders: the picture is
    // where it was, only lighter, so there is no edit to undo - and an undo
    // that brings the old name back is cut again by the next save, from the
    // same original, to the same bytes and the same name.
    // A picture saved in an earlier session has no original here and is left
    // exactly as it is: a stored picture is never re-encoded.
    // ------------------------------------------------------------
    async function Na__LeImgPub__Normalise(state) {
        if (!Na__LeImgPub__Sources.size) return;
        const setup = Na__LeImgCfg__Storage();
        const using = (file) => Na__LeImgPub__Collect(Na__DrawData__GetSheetsArray()).filter((item) => item.file === file);
        const files = new Set(Na__LeImgPub__Collect(Na__DrawData__GetSheetsArray()).map((item) => item.file).filter((file) => Na__LeImgPub__Sources.has(file)));
        for (const file of files) {
            const source = Na__LeImgPub__Sources.get(file);
            const items  = using(file);
            if (!items.length) continue;
            const want = Na__LeImgGeo__StoreSize(source.pixelW, source.pixelH,
                items.map((item) => ({ rect : Na__LeImgGeo__Rect(item.shape.Shape__Points), crop : item.block.Image__Crop })),
                setup.printDpi * setup.printHeadroom, setup.maxEdgePx);
            const have = { w : Number(items[0].block.Image__PixelW) || 0, h : Number(items[0].block.Image__PixelH) || 0 };
            if (!Na__LeImgGeo__NeedsRecut(have, want, Na__LeImgPub__RECUT_SLACK)) continue;
            let cut = null;
            try { cut = await Na__LeImgEnc__Recut(source, want.w, want.h); }
            catch (error) { console.warn('[TrueVision3D LayoutEditor] A picture could not be cut to its print size; it is filed as dropped: ' + file, error); }
            if (!cut || cut.fileName === file) continue;
            Na__LeImgPub__Held.set(cut.fileName, cut.blob);
            Na__LeImgPub__Sources.set(cut.fileName, source);
            Na__LeImgSrc__Adopt(cut.fileName, cut.blob);                          // <-- The sheet draws the cut from memory at once
            // THE LIVE RECORDS ARE READ AGAIN: the sheet may have been redrawn,
            // and its records renewed, while the picture was being cut.
            using(file).forEach((item) => {
                item.block.Image__File   = cut.fileName;
                item.block.Image__PixelW = cut.pixelW;
                item.block.Image__PixelH = cut.pixelH;
            });
            state.sized.push({ dropped : source.blob.size, stored : cut.blob.size });
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Three Phases
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Before: File Every Picture Where Its Drawing Wants It
    // ------------------------------------------------------------
    async function Na__LeImgPub__Before(ctx) {
        const state  = { confirmed : new Set(), missing : [], failed : [], pushed : 0, refiled : 0, sized : [] };
        ctx.state.sheetImages = state;
        await Na__LeImgPub__Normalise(state);                                    // <-- First: what is filed below is the cut, never the drop
        if (state.sized.length) {
            const sum = (key) => state.sized.reduce((total, entry) => total + entry[key], 0);
            ctx.note(Na__LeImgCfg__Label('SaveSized', '{count} picture(s) stored at {dpi} dpi for their size on the sheet: {stored} MB, from {dropped} MB dropped.', {
                count : state.sized.length, dpi : Math.round(Na__LeImgCfg__Storage().printDpi), stored : Na__LeImgPub__Mb(sum('stored')), dropped : Na__LeImgPub__Mb(sum('dropped'))
            }), false);
        }
        const items  = Na__LeImgPub__Collect(Na__DrawData__GetSheetsArray());
        if (!items.length && Na__LeImgPub__OnR2 !== null && Na__LeImgPub__OnR2.size === 0 && Na__LeImgPub__OnDisk.size === 0) return;   // <-- A project with no pictures anywhere: nothing to do, and nothing asked of anyone
        const wanted = Na__LeImgPub__Wanted(items);

        // ON DISK | Through the local server: each copied from wherever it is.
        if (Na__LeImgStore__IsLocal() && wanted.size) {
            const needed = Array.from(wanted.entries()).filter(([ key ]) => !Na__LeImgPub__OnDisk.has(key));
            if (needed.length) {
                const result = await Na__LeImgStore__Reconcile(needed.map(([ , entry ]) => ({ folder : entry.folder, file : entry.file, from : Array.from(entry.from) })));
                if (result.ok) {
                    for (const row of (Array.isArray(result.results) ? result.results : [])) {
                        const key = Na__LeImgPub__Key(row.folder, row.file);
                        if (row.state === 'present' || row.state === 'copied') { Na__LeImgPub__OnDisk.add(key); if (row.state === 'copied') state.refiled++; continue; }
                        if (row.state !== 'missing') continue;
                        const entry = wanted.get(key);
                        const blob  = entry ? await Na__LeImgPub__BytesOf(entry) : null;   // <-- Not on disk anywhere: from memory, or from R2 if the screen had it
                        if (blob && (await Na__LeImgStore__Upload(row.folder, row.file, blob)).ok) Na__LeImgPub__OnDisk.add(key);
                    }
                } else if (!result.skipped) {
                    console.warn('[TrueVision3D LayoutEditor] Sheet pictures were not filed on disk: ' + result.error);
                    ctx.note(Na__LeImgCfg__Label('SaveLocal', 'Pictures were not filed in the project folder ({error}).', { error : result.error }), true);
                }
            }
        }

        // ON R2 | Copied inside the bucket when R2 has the picture anywhere, uploaded otherwise.
        if (!Na__CfApi__IsConfigured()) return;
        if (Na__LeImgPub__OnR2 === null || Array.from(wanted.keys()).some((key) => !Na__LeImgPub__OnR2.has(key))) {
            const listed = await Na__CfApi__ListSheetImages();
            if (listed.ok) Na__LeImgPub__OnR2 = new Set(listed.objects.map((object) => Na__LeImgPub__Key(object.folder, object.file)));
            else console.warn('[TrueVision3D LayoutEditor] The pictures on R2 could not be listed: ' + listed.error);
        }
        for (const [ key, entry ] of wanted) {
            if (Na__LeImgPub__OnR2 && Na__LeImgPub__OnR2.has(key)) { state.confirmed.add(key); continue; }
            let done = false, error = null;
            const elsewhere = Na__LeImgPub__OnR2 ? Array.from(Na__LeImgPub__OnR2).find((other) => other.slice(other.indexOf('/') + 1) === entry.file) : null;
            if (elsewhere) {
                const copied = await Na__CfApi__CopySheetImage(elsewhere.slice(0, elsewhere.indexOf('/')), entry.folder, entry.file);
                done = copied.ok;
                if (done) state.refiled++; else error = copied.error;
            }
            if (!done) {
                const blob = await Na__LeImgPub__BytesOf(entry);
                if (!blob) { state.missing.push(entry.file); continue; }
                const uploaded = await Na__CfApi__UploadSheetImage(entry.folder, entry.file, blob);
                done = uploaded.ok;
                if (done) state.pushed++; else error = uploaded.error;
            }
            if (done) {
                if (Na__LeImgPub__OnR2) Na__LeImgPub__OnR2.add(key);
                state.confirmed.add(key);
            } else {
                state.failed.push({ file : entry.file, error : error || 'failed' });
            }
        }

        if (state.pushed)  ctx.note(Na__LeImgCfg__Label('SavePushed', '{count} picture(s) pushed to R2.', { count : state.pushed }), false);
        if (state.refiled) ctx.note(Na__LeImgCfg__Label('SaveRefiled', '{count} picture(s) filed under their new document id.', { count : state.refiled }), false);
        if (state.failed.length)  ctx.note(Na__LeImgCfg__Label('SaveFailed', '{count} picture(s) could not be pushed to R2 ({error}).', { count : state.failed.length, error : state.failed[0].error }), true);
        if (state.missing.length) ctx.note(Na__LeImgCfg__Label('SaveMissing', '{count} picture(s) could not be found anywhere: {files}.', { count : state.missing.length, files : state.missing.slice(0, 3).join(', ') + (state.missing.length > 3 ? '...' : '') }), true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Payload: the Copy About to Be Written Points at the Filed Pictures
    // ------------------------------------------------------------
    // Only where R2 confirmed the picture in its new folder; anything else
    // keeps pointing where it did, which still holds it. What the copy then
    // points at is recorded: nothing it names is tidied away.
    // ------------------------------------------------------------
    function Na__LeImgPub__Payload(ctx) {
        const state = ctx.state.sheetImages;
        if (!state || !ctx.block) return;
        const sheets = Array.isArray(ctx.block[Na__DrawData__SHEETS_KEY]) ? ctx.block[Na__DrawData__SHEETS_KEY] : [];
        state.written = new Set();
        Na__LeImgPub__Collect(sheets).forEach((item) => {
            if (state.confirmed.has(item.key)) item.block.Image__Folder = item.folder;
            if (item.block.Image__Folder) state.written.add(Na__LeImgPub__Key(item.block.Image__Folder, item.file));
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | After: Adopt the New Folders, Then Tidy What Nothing Points At
    // ------------------------------------------------------------
    async function Na__LeImgPub__After(ctx) {
        const state = ctx.state.sheetImages;
        if (!state || !state.written) return;

        // THE LIVE RECORDS follow what was written. Silently: this is where the
        // picture already was a moment ago, only filed, so it is no edit to
        // undo - and an undo that brings the old hint back is put right by the
        // next save exactly as this one put it right.
        Na__LeImgPub__Collect(Na__DrawData__GetSheetsArray()).forEach((item) => {
            if (item.block.Image__Folder !== item.folder && state.written.has(item.key)) item.block.Image__Folder = item.folder;
        });

        // R2 | Every picture of this project that the drawings just written do
        // not name comes off - only files this feature stored, only once the
        // drawings are safely there.
        if (Na__LeImgPub__OnR2 && Na__CfApi__IsConfigured()) {
            const stale = Array.from(Na__LeImgPub__OnR2).filter((key) => !state.written.has(key) && Na__LeImgGeo__IsManagedName(key.slice(key.indexOf('/') + 1)));
            for (const key of stale) {
                const gone = await Na__CfApi__DeleteSheetImage(key.slice(0, key.indexOf('/')), key.slice(key.indexOf('/') + 1));
                if (gone.ok) Na__LeImgPub__OnR2.delete(key);
                else console.warn('[TrueVision3D LayoutEditor] A picture no drawing uses could not be taken off R2: ' + key + ' (' + gone.error + ')');
            }
            if (stale.length) console.log('[TrueVision3D LayoutEditor] Took ' + stale.length + ' picture(s) no drawing uses off R2.');
        }

        // ON DISK | Only when the repository's copy of the drawings was written
        // too: until it is, the old folders are what it points at.
        if (Na__LeImgStore__IsLocal() && ctx.local && ctx.local.ok) {
            const keep   = Array.from(state.written).map((key) => ({ folder : key.slice(0, key.indexOf('/')), file : key.slice(key.indexOf('/') + 1) }));
            const result = await Na__LeImgStore__Reconcile(keep, { archive : true });
            if (result.ok) {
                Na__LeImgPub__OnDisk.clear();
                (Array.isArray(result.results) ? result.results : []).forEach((row) => {
                    if (row.state === 'present' || row.state === 'copied') Na__LeImgPub__OnDisk.add(Na__LeImgPub__Key(row.folder, row.file));
                });
                if (Array.isArray(result.archived) && result.archived.length) console.log('[TrueVision3D LayoutEditor] Archived ' + result.archived.length + ' picture(s) no drawing uses: ' + result.archived.join(', '));
            }
        }
        // PICTURES NOW ON R2 need not be held in memory any longer.
        Array.from(Na__LeImgPub__Held.keys()).forEach((file) => {
            if (Array.from(state.confirmed).some((key) => key.slice(key.indexOf('/') + 1) === file)) Na__LeImgPub__Held.delete(file);
        });
        Na__LeImgSrc__Retry();                                                   // <-- Anything the screen could not find a moment ago is filed now
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Register the Save Step (the editor only; once)
    // ------------------------------------------------------------
    function Na__LeImgPub__Register() {
        if (Na__LeImgPub__Registered) return true;
        Na__LeImgPub__Registered = Na__DrawData__RegisterSaveStep({
            id      : Na__LeImgPub__STEP_ID,
            before  : Na__LeImgPub__Before,
            payload : Na__LeImgPub__Payload,
            after   : Na__LeImgPub__After
        });
        return Na__LeImgPub__Registered;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Picture Just Dropped or Replaced: Held in Memory Until a Save Files It
    // ------------------------------------------------------------
    // Nothing is written at the drop. source (Na__LeImgEnc__Prepare's) is the
    // original the save cuts the stored picture from once the sheet says how
    // large it prints; without one, the picture is filed as it is.
    // ------------------------------------------------------------
    function Na__LeImgPub__Hold(file, blob, source) {
        if (!file || !(blob instanceof Blob)) return;
        Na__LeImgPub__Held.set(file, blob);
        if (source && source.blob instanceof Blob && source.pixelW > 0 && source.pixelH > 0) Na__LeImgPub__Sources.set(file, source);
    }
    // ------------------------------------------------------------


    // FUNCTION | Will a Save Cut This Picture From Its Original (dropped or replaced this session)
    // ------------------------------------------------------------
    function Na__LeImgPub__HasSource(file) {
        return !!file && Na__LeImgPub__Sources.has(file);
    }
    // ------------------------------------------------------------


    // FUNCTION | Forget What Is Known to Be Where (a new project)
    // ------------------------------------------------------------
    function Na__LeImgPub__Reset() {
        Na__LeImgPub__OnR2 = null;
        Na__LeImgPub__OnDisk.clear();
        Na__LeImgPub__Held.clear();
        Na__LeImgPub__Sources.clear();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Sheet Images Publish API
    // ------------------------------------------------------------
    export {
        Na__LeImgPub__FolderOf,
        Na__LeImgPub__Register,
        Na__LeImgPub__Hold,
        Na__LeImgPub__HasSource,
        Na__LeImgPub__Reset
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
