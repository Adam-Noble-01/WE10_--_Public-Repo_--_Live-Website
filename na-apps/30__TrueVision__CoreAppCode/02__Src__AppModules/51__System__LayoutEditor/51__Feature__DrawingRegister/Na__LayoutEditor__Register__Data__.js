// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DRAWING REGISTER DATA
// =============================================================================
//
// FILE       : Na__LayoutEditor__Register__Data__.js
// NAMESPACE  : Na__LeReg
// MODULE     : Layout Editor - Drawing Register Data
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Own the self-contained register block and its local revision draft
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Sheet metadata stays in the drawing records. Only numbering policy and
//   per-sheet revision history live in LayoutEditor__DrawingRegister.
// - Notes never write to R2 on typing. A browser draft holds the revision
//   history; explicit Save Locally / Save to R2 merge this block and leave
//   every other project key alone.
// - Opening the tab costs no Worker read: the already-loaded project data is
//   adopted, and a stale draft may restore notes but never numbering.
//
// INTEGRATION:
// - Initialised by the mode controller with the editable flag and the toast.
// - The editor, notes, PDF, numbering transactions and sheet model read
//   through this file. Import it, never a caller-side copy of the block.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 19-Sep-2026)
// - Back-port     : offer to ValeVision3D with the register tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.1
// - Headers, region breakdown, function wrapping and the export block brought
//   in line with the Layout Editor coding conventions. No behaviour change.
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Project Code, Cloudflare and Local Mirror
    // ------------------------------------------------------------
    import { Na__LeCfg__GetDrawingRegisterSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import {
        Na__CfApi__GetLoadedProjectData,
        Na__CfApi__MergeAndSaveKeys,
        Na__CfApi__ReadProjectData,
        Na__CfApi__ProjectFileLocation
    } from '../../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js';
    import { Na__LocalMirror__MergeKeys } from '../../03__AppUtils/Na__AppUtils__LocalProjectMirror__.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Project-Data Block Name and Change Event
    // ------------------------------------------------------------
    const Na__LeReg__BLOCK = 'LayoutEditor__DrawingRegister';
    const Na__LeReg__EVENT = 'na-layouteditor-register-changed';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Live Document, Cloud Baseline and Session Flags
    // ------------------------------------------------------------
    let Na__LeReg__Doc      = null;
    let Na__LeReg__Code     = null;
    let Na__LeReg__Base     = null;
    let Na__LeReg__Busy     = false;
    let Na__LeReg__Editable = false;
    let Na__LeReg__Toast    = () => {};
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Document Helpers and Browser Draft
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Deep Clone a Plain JSON Value
    // ------------------------------------------------------------
    function Na__LeReg__Clone(value) {
        return JSON.parse(JSON.stringify(value));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Announce a Register Change to the Editor
    // ------------------------------------------------------------
    function Na__LeReg__Dispatch() {
        window.dispatchEvent(new CustomEvent(Na__LeReg__EVENT));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Browser-Draft Storage Key for This Project
    // ------------------------------------------------------------
    function Na__LeReg__Key() {
        return 'Na__DrawingRegister__Draft__' + Na__LeReg__Code;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Block in the Project's Three-Part JSON Style
    // ------------------------------------------------------------
    function Na__LeReg__Normalise(value) {
        const cfg = Na__LeCfg__GetDrawingRegisterSetup();
        const doc = value && typeof value === 'object' && !Array.isArray(value)
            ? Na__LeReg__Clone(value)
            : {};
        doc.DrawingRegister__Document__Description = 'Drawing register numbering and per-sheet revision history. Sheet ids link to LayoutEditor__DrawingsData; drawing metadata stays in its sheet records.';
        doc.DrawingRegister__Document__Version     = 1;
        doc.DrawingRegister__Document__Updated     = doc.DrawingRegister__Document__Updated || null;
        doc.DrawingRegister__Numbering = Object.assign({
            DrawingRegister__Numbering__Prefix    : cfg.prefix,
            DrawingRegister__Numbering__Start     : cfg.start,
            DrawingRegister__Numbering__Digits    : cfg.digits,
            DrawingRegister__Numbering__Overrides : {}
        }, doc.DrawingRegister__Numbering || {});
        const revisions = doc.DrawingRegister__Revisions;
        doc.DrawingRegister__Revisions = revisions && typeof revisions === 'object' && !Array.isArray(revisions)
            ? revisions
            : {};
        return doc;
    }
    // ------------------------------------------------------------


    // FUNCTION | Hand In the Editable Flag and the Toast
    // ------------------------------------------------------------
    function Na__LeReg__Initialize(options) {
        Na__LeReg__Editable = !!(options && options.editable);
        Na__LeReg__Toast    = (options && options.showToast) || (() => {});
    }
    // ------------------------------------------------------------


    // FUNCTION | Adopt the Already Loaded Project; Opening the Tab Costs No Worker Read
    // ------------------------------------------------------------
    function Na__LeReg__GetDocument() {
        const code = Na__DrawData__GetProjectCode();
        if (!Na__LeReg__Doc || Na__LeReg__Code !== code) {
            Na__LeReg__Code = code;
            const loaded = Na__CfApi__GetLoadedProjectData() || {};
            Na__LeReg__Base = Na__LeReg__Normalise(loaded[Na__LeReg__BLOCK]);
            Na__LeReg__Doc  = Na__LeReg__Clone(Na__LeReg__Base);
            if (Na__LeReg__Editable && code) {
                try {
                    const draft = JSON.parse(window.localStorage.getItem(Na__LeReg__Key()) || 'null');
                    if (draft) {
                        // Only notes are drafts. A stale draft must never restore old numbering.
                        Na__LeReg__Doc.DrawingRegister__Revisions = Na__LeReg__Normalise(draft).DrawingRegister__Revisions;
                    }
                } catch (error) {
                    Na__LeReg__Toast('The saved register draft could not be read.', true);
                }
            }
        }
        return Na__LeReg__Doc;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether the Local Revision Notes Differ from the Cloud Baseline
    // ------------------------------------------------------------
    function Na__LeReg__IsDirty() {
        const doc = Na__LeReg__GetDocument();
        return JSON.stringify(doc.DrawingRegister__Revisions) !== JSON.stringify(Na__LeReg__Base.DrawingRegister__Revisions);
    }
    // ------------------------------------------------------------


    // FUNCTION | Keep the Revision-Notes Draft in This Browser
    // ------------------------------------------------------------
    function Na__LeReg__KeepDraft() {
        if (!Na__LeReg__Editable || !Na__LeReg__Code) return;
        try {
            window.localStorage.setItem(Na__LeReg__Key(), JSON.stringify(Na__LeReg__Doc));
        } catch (error) {
            Na__LeReg__Toast('Browser storage is full. Use Save Locally to keep the revision notes.', true);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Revision Entries for One Sheet
    // ------------------------------------------------------------
    function Na__LeReg__GetRevisions(sheetId) {
        const list = Na__LeReg__GetDocument().DrawingRegister__Revisions[sheetId];
        return Array.isArray(list) ? list : [];
    }
    // ------------------------------------------------------------


    // FUNCTION | Keep a Revision Entry Locally; No Cloud Request
    // ------------------------------------------------------------
    function Na__LeReg__SetRevisions(sheetId, list) {
        if (!Na__LeReg__Editable || Na__LeReg__Busy) return false;
        Na__LeReg__GetDocument().DrawingRegister__Revisions[sheetId] = Na__LeReg__Clone(list);
        Na__LeReg__KeepDraft();
        Na__LeReg__Dispatch();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Cloud and Local Payloads for a Numbering Save
    // ------------------------------------------------------------
    function Na__LeReg__NumberingPayload(numbering) {
        Na__LeReg__GetDocument();
        const cloud = Na__LeReg__Clone(Na__LeReg__Base);
        const local = Na__LeReg__Clone(Na__LeReg__Doc);
        [cloud, local].forEach((doc) => {
            doc.DrawingRegister__Numbering         = Na__LeReg__Clone(numbering);
            doc.DrawingRegister__Document__Updated = new Date().toISOString();
        });
        return {
            cloud : { [Na__LeReg__BLOCK] : cloud },
            local : { [Na__LeReg__BLOCK] : local }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Adopt a Numbering Save That Has Already Reached R2
    // ------------------------------------------------------------
    function Na__LeReg__AdoptNumbering(payload) {
        Na__LeReg__Base = Na__LeReg__Clone(payload.cloud[Na__LeReg__BLOCK]);
        Na__LeReg__Doc.DrawingRegister__Numbering         = Na__LeReg__Clone(Na__LeReg__Base.DrawingRegister__Numbering);
        Na__LeReg__Doc.DrawingRegister__Document__Updated = Na__LeReg__Base.DrawingRegister__Document__Updated;
        Na__LeReg__KeepDraft();
        Na__LeReg__Dispatch();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Explicit Save and Load
// -----------------------------------------------------------------------------

    // FUNCTION | Save Only Notes to the Local Repository or Explicitly to R2
    // ------------------------------------------------------------
    async function Na__LeReg__Save(cloud) {
        if (!Na__LeReg__Editable || Na__LeReg__Busy) return false;
        Na__LeReg__Busy = true;
        try {
            const out = Na__LeReg__Clone(Na__LeReg__GetDocument());
            out.DrawingRegister__Document__Updated = new Date().toISOString();
            if (cloud) {
                const read = await Na__CfApi__ReadProjectData();
                if (!read.ok) throw new Error(read.error || 'R2 could not be read.');
                const remote = Na__LeReg__Normalise((read.data || {})[Na__LeReg__BLOCK]);
                if (JSON.stringify(remote) !== JSON.stringify(Na__LeReg__Base)) {
                    const ok = await Na__AppUtils__ConfirmDialog__Show({
                        title         : 'Replace revision notes on R2?',
                        message       : 'The register on R2 changed since this session loaded it. Replace its revision notes with these notes? Current cloud numbering is preserved.',
                        confirmLabel  : 'Replace notes',
                        isDestructive : true
                    });
                    if (!ok) return false;
                }
                // Notes never write an older numbering policy over a structural save.
                out.DrawingRegister__Numbering = remote.DrawingRegister__Numbering;
                const result = await Na__CfApi__MergeAndSaveKeys({ [Na__LeReg__BLOCK] : out });
                if (!result.ok) throw new Error(result.error || 'R2 write failed.');
                Na__LeReg__Base = Na__LeReg__Clone(out);
            }
            const local = await Na__LocalMirror__MergeKeys({ [Na__LeReg__BLOCK] : out });
            if (!local.ok) {
                throw new Error((cloud ? 'Saved to R2; local save failed: ' : 'Local save failed: ') + (local.error || 'Local server unavailable.'));
            }
            Na__LeReg__Toast(cloud ? 'Drawing register synced to R2 and locally.' : 'Drawing register saved locally.', false);
            return true;
        } catch (error) {
            Na__LeReg__Toast(error.message, true);
            return false;
        } finally {
            Na__LeReg__Busy = false;
            Na__LeReg__Dispatch();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Load Revision Notes Only; Critical Sheet Metadata Is Never Reverted
    // ------------------------------------------------------------
    async function Na__LeReg__Load(cloud) {
        if (!Na__LeReg__Editable || Na__LeReg__Busy) return false;
        if (Na__LeReg__IsDirty()) {
            const ok = await Na__AppUtils__ConfirmDialog__Show({
                title         : 'Replace these revision notes?',
                message       : 'Load replaces the revision notes currently in this browser. Drawing names, numbers, revisions and order stay as saved.',
                confirmLabel  : 'Load notes',
                isDestructive : true
            });
            if (!ok) return false;
        }
        Na__LeReg__Busy = true;
        try {
            let read;
            if (cloud) {
                read = await Na__CfApi__ReadProjectData();
            } else {
                const location = Na__CfApi__ProjectFileLocation('TrueVision__DrawingNotes__.json');
                if (!location) throw new Error('No local project location is available.');
                const response = await fetch(new URL('TrueVision__ProjectData__.json', location.repoUrl).href, { cache : 'no-store' });
                if (!response.ok) throw new Error('Local register could not be read (' + response.status + ').');
                read = { ok : true, data : await response.json() };
            }
            if (!read.ok) throw new Error(read.error || 'Register could not be read.');
            const doc = Na__LeReg__Normalise((read.data || {})[Na__LeReg__BLOCK]);
            Na__LeReg__GetDocument().DrawingRegister__Revisions = doc.DrawingRegister__Revisions;
            if (cloud) Na__LeReg__Base.DrawingRegister__Revisions = Na__LeReg__Clone(doc.DrawingRegister__Revisions);
            Na__LeReg__KeepDraft();
            Na__LeReg__Toast('Revision notes loaded from ' + (cloud ? 'R2.' : 'the local file.'), false);
            return true;
        } catch (error) {
            Na__LeReg__Toast(error.message, true);
            return false;
        } finally {
            Na__LeReg__Busy = false;
            Na__LeReg__Dispatch();
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Save or Load Is in Flight
    // ------------------------------------------------------------
    function Na__LeReg__IsBusy() {
        return Na__LeReg__Busy;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Drawing Register Data API
    // ------------------------------------------------------------
    export {
        Na__LeReg__BLOCK,
        Na__LeReg__EVENT,
        Na__LeReg__Initialize,
        Na__LeReg__Clone,
        Na__LeReg__GetDocument,
        Na__LeReg__GetRevisions,
        Na__LeReg__SetRevisions,
        Na__LeReg__IsDirty,
        Na__LeReg__Save,
        Na__LeReg__Load,
        Na__LeReg__NumberingPayload,
        Na__LeReg__AdoptNumbering,
        Na__LeReg__IsBusy
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
