// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DRAWING REGISTER TRANSACTIONS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Register__Transactions__.js
// NAMESPACE  : Na__LeRegEdit
// MODULE     : Layout Editor - Drawing Register Transactions
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Confirm and save pack metadata through the existing R2-first path
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Autosave is drained before a transaction. R2 failure restores metadata;
//   local failure keeps the R2 result and offers a local-only retry.
// - No alias numbers, no changed sheet ids, and no cloud writes on keystrokes.
//   Enter in a cell is the confirm; the dialog handles the next Enter.
//
// INTEGRATION:
// - Initialised by the mode controller. The register editor, the tab strip
//   and the sheet panel call Metadata, Move, Renumber and Override.
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
// 19-Sep-2026 - Version 1.2.0
// - Metadata takes 'status': what a drawing is issued for, chosen on its row
//   in the register. It is the one key that may be cleared, and clearing it is
//   asked about in its own words. What is stored comes from the config's
//   StatusToStore, the function the Sheet panel's Status box asks too.
//
// 19-Sep-2026 - Version 1.1.0
// - Short tab names. A rename goes through the sheet model's ApplySheetName,
//   so a Drawing Title typed separately from the name survives it - it used to
//   be overwritten with the new name, which would have cost a project its
//   title block titles the first time its tabs were shortened. A drawing code
//   typed in front of the new name is taken off before the save
//   (CleanSheetName), and the confirmation names the sheet as its tab does.
//
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

    // MODULE IMPORTS | Sheets, Autosave, Project Data and Register Units
    // ------------------------------------------------------------
    import {
        Na__LeModel__GetSheets,
        Na__LeModel__GetFields,
        Na__LeModel__GetTabLabel,
        Na__LeModel__GetPhase,
        Na__LeModel__GetDrawingNumber,
        Na__LeModel__ComposeDocumentId,
        Na__LeModel__CleanSheetName,
        Na__LeModel__ApplySheetName,
        Na__LeModel__FinishRegisterDeletion,
        Na__LeModel__NotifyRegister
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeCfg__StatusToStore } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeAuto__Suspend, Na__LeAuto__Resume, Na__LeAuto__DiscardSavedDraft } from '../07__Core__SheetData/Na__LayoutEditor__AutoSave__.js';
    import { Na__DrawData__Save, Na__DrawData__GetBlock, Na__DrawData__GetProjectCode } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__LocalMirror__MergeKeys } from '../../03__AppUtils/Na__AppUtils__LocalProjectMirror__.js';
    import { Na__AppUtils__ConfirmDialog__Show } from '../../03__AppUtils/Na__AppUtils__ConfirmDialog.js';
    import {
        Na__LeReg__Clone,
        Na__LeReg__GetDocument,
        Na__LeReg__NumberingPayload,
        Na__LeReg__AdoptNumbering,
        Na__LeReg__IsBusy
    } from './Na__LayoutEditor__Register__Data__.js';
    // @delegate: ./Na__LayoutEditor__Register__DeleteDialog__.js
    import { Na__LeRegDelete__Confirm } from './Na__LayoutEditor__Register__DeleteDialog__.js';
    import { Na__LeRegNum__Plan, Na__LeRegNum__Apply } from './Na__LayoutEditor__Register__Numbering__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Busy Guard, Pending Local Snapshot and Toast
    // ------------------------------------------------------------
    let Na__LeRegEdit__Busy         = false;
    let Na__LeRegEdit__Editable     = false;
    let Na__LeRegEdit__PendingLocal = null;
    let Na__LeRegEdit__Toast        = () => {};
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Confirmed Save
// -----------------------------------------------------------------------------

    // FUNCTION | Hand In the Editable Flag and the Toast
    // ------------------------------------------------------------
    function Na__LeRegEdit__Initialize(options) {
        Na__LeRegEdit__Editable = !!(options && options.editable);
        Na__LeRegEdit__Toast    = (options && options.showToast) || (() => {});
    }
    // ------------------------------------------------------------


    // FUNCTION | Block New UI Edits While the Two Copies Are Being Written
    // ------------------------------------------------------------
    function Na__LeRegEdit__Lock() {
        const dialog = document.createElement('dialog');
        dialog.className = 'na-le-register__saving';
        dialog.textContent = 'Saving drawing data to R2 and locally…';
        dialog.addEventListener('cancel', (event) => event.preventDefault());
        document.body.appendChild(dialog);
        dialog.showModal();
        return () => {
            dialog.close();
            dialog.remove();
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | One Critical Operation, With an Honest Partial-Success State
    // ------------------------------------------------------------
    async function Na__LeRegEdit__Commit(message, apply) {
        if (!Na__LeRegEdit__Editable || Na__LeRegEdit__Busy || Na__LeReg__IsBusy()) return false;
        if (Na__LeRegEdit__PendingLocal) {
            Na__LeRegEdit__Toast('Retry the local sync before changing more drawing metadata.', true);
            return false;
        }
        Na__LeRegEdit__Busy = true;
        let unlock      = () => {};
        let before      = null;
        let cloudSaved  = false;
        try {
            const confirmed = await Na__AppUtils__ConfirmDialog__Show({
                title        : 'Update the drawing pack?',
                message      : message + ' Do you want to do this? This saves the drawing data to R2 and locally.',
                confirmLabel : 'Update and sync'
            });
            if (!confirmed) return false;
            unlock = Na__LeRegEdit__Lock();
            await Na__LeAuto__Suspend();
            const sheets = Na__LeModel__GetSheets();
            before = sheets.map((sheet) => ({
                sheet,
                name   : sheet.Sheet__Name,
                order  : sheet.Sheet__Order,
                fields : Na__LeReg__Clone(sheet.Sheet__Fields || {})
            }));
            const numbering = Na__LeReg__Clone(Na__LeReg__GetDocument().DrawingRegister__Numbering);
            apply(sheets, numbering);
            const payload = Na__LeReg__NumberingPayload(numbering);
            const report  = {};
            cloudSaved = await Na__DrawData__Save((text, error) => {
                if (error) Na__LeRegEdit__Toast(text, true);
            }, report, payload);
            if (!cloudSaved) {
                throw new Error('The change was not saved to R2. The previous drawing metadata has been restored.');
            }
            Na__LeReg__AdoptNumbering(payload);
            if (!report.local || !report.local.ok) {
                // The cloud is authoritative now. Never roll it back in memory just
                // because disk failed; retry the exact snapshot without a Worker call.
                Na__LeRegEdit__PendingLocal = report.localKeys || Object.assign(
                    { LayoutEditor__DrawingsData : Na__LeReg__Clone(Na__DrawData__GetBlock()) },
                    payload.local
                );
                Na__LeRegEdit__Toast('Saved to R2, but local sync failed. Use Retry Local Sync in the register. ' + ((report.local && report.local.error) || ''), true);
                return false;
            }
            Na__LeRegEdit__Toast('Drawing data synced to R2 and locally.', false);
            return true;
        } catch (error) {
            if (!cloudSaved && before) {
                before.forEach((entry) => {
                    entry.sheet.Sheet__Name   = entry.name;
                    entry.sheet.Sheet__Order  = entry.order;
                    entry.sheet.Sheet__Fields = entry.fields;
                });
            }
            Na__LeRegEdit__Toast(error.message, true);
            return false;
        } finally {
            if (before) Na__LeModel__NotifyRegister();
            Na__LeAuto__Resume();
            unlock();
            Na__LeRegEdit__Busy = false;
            window.dispatchEvent(new CustomEvent('na-layouteditor-register-changed'));
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Edit the Actual Sheet Name, Title, Revision, Phase and Status
    // ------------------------------------------------------------
    function Na__LeRegEdit__Metadata(sheetId, key, value) {
        const sheet = Na__LeModel__GetSheets().find((item) => item.Sheet__Id === sheetId);
        if (!sheet || !['name', 'revision', 'phase', 'status'].includes(key)) return Promise.resolve(false);
        const next  = key === 'name' ? Na__LeModel__CleanSheetName(sheet, value) : String(value || '').trim();   // <-- A drawing code typed in front of a name comes off before it is kept: the tab carries the register's
        if (!next && key !== 'status') {                                         // <-- A status may be cleared: "Not set" is a real answer, where a drawing with no name or revision is a mistake
            Na__LeRegEdit__Toast('A drawing needs a ' + key + '.', true);
            return Promise.resolve(false);
        }
        const current = key === 'name'   ? sheet.Sheet__Name
                      : key === 'phase'  ? Na__LeModel__GetPhase(sheet)
                      : key === 'status' ? Na__LeModel__GetFields(sheet).Status
                      : Na__LeModel__GetFields(sheet).Revision;
        if (current === next) return Promise.resolve(true);
        // A phase change moves the drawing's whole identifier, so the confirmation
        // says so outright rather than naming a code the reader has to work out.
        const asked = key === 'phase'
            ? 'Move ' + Na__LeModel__GetTabLabel(sheet) + ' to phase ' + next + '? Its document code becomes ' +
              Na__LeModel__ComposeDocumentId(Na__DrawData__GetProjectCode(), next, Na__LeModel__GetDrawingNumber(sheet)) + '.'
            : (key === 'status' && !next)
            ? 'Clear the status of ' + Na__LeModel__GetTabLabel(sheet) + '? Its title block will print none.'
            : 'Change ' + Na__LeModel__GetTabLabel(sheet) + ' ' + key + ' to “' + next + '”?';
        return Na__LeRegEdit__Commit(asked, (sheets) => {
            const live = sheets.find((item) => item.Sheet__Id === sheetId);
            if (!live) throw new Error('This sheet no longer exists.');
            live.Sheet__Fields = live.Sheet__Fields || {};
            if (key === 'name') {
                Na__LeModel__ApplySheetName(live, next);                          // <-- A Drawing Title typed separately survives; one that only followed the name follows it
            } else if (key === 'phase') {
                live.Sheet__Fields.Sheet__Fields__Phase = next;                   // <-- The code itself is never written: it recomposes from this
            } else if (key === 'status') {
                const stored = Na__LeCfg__StatusToStore(next);                    // <-- The Sheet panel's Status box asks the same function, so the two store alike
                if (stored === null) delete live.Sheet__Fields.Sheet__Fields__Status;
                else live.Sheet__Fields.Sheet__Fields__Status = stored;
            } else {
                live.Sheet__Fields.Sheet__Fields__Revision = next.replace(/^Rev\s+/i, '');
            }
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Renumber the Pack, Optionally Changing the Series or One Jump
    // ------------------------------------------------------------
    function Na__LeRegEdit__Renumber(patch, clearOverrides) {
        return Na__LeRegEdit__Commit(
            'Renumber all drawings in tab order' + (clearOverrides ? ' and remove number jumps?' : '?'),
            (sheets, numbering) => {
                Object.assign(numbering, patch || {});
                if (clearOverrides) numbering.DrawingRegister__Numbering__Overrides = {};
                Na__LeRegNum__Apply(sheets, Na__LeRegNum__Plan(sheets, numbering));
            }
        );
    }
    // ------------------------------------------------------------


    // FUNCTION | Set or Clear One Row's Optional Number Jump
    // ------------------------------------------------------------
    function Na__LeRegEdit__Override(sheetId, value) {
        const overrides = Na__LeReg__Clone(Na__LeReg__GetDocument().DrawingRegister__Numbering.DrawingRegister__Numbering__Overrides || {});
        if (String(value).trim() === '') delete overrides[sheetId];
        else overrides[sheetId] = Number(value);
        return Na__LeRegEdit__Renumber({ DrawingRegister__Numbering__Overrides : overrides }, false);
    }
    // ------------------------------------------------------------


    // FUNCTION | Reorder and Renumber as One Saved Operation
    // ------------------------------------------------------------
    function Na__LeRegEdit__Move(sheetId, targetIndex) {
        return Na__LeRegEdit__Commit('Move this drawing and renumber the pack in the new order?', (sheets, numbering) => {
            const from = sheets.findIndex((sheet) => sheet.Sheet__Id === sheetId);
            if (from < 0) throw new Error('This sheet no longer exists.');
            const [moved] = sheets.splice(from, 1);
            sheets.splice(Math.max(0, Math.min(targetIndex, sheets.length)), 0, moved);
            Na__LeRegNum__Apply(sheets, Na__LeRegNum__Plan(sheets, numbering));
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete a Sheet Locally First, Then Persist the Same Removal to R2
    // ------------------------------------------------------------
    async function Na__LeRegEdit__Delete(sheetId) {
        if (!Na__LeRegEdit__Editable || Na__LeRegEdit__Busy || Na__LeReg__IsBusy()) return false;
        if (Na__LeRegEdit__PendingLocal) { Na__LeRegEdit__Toast('Retry the local sync before deleting a drawing.', true); return false; }
        const sheet = Na__LeModel__GetSheets().find((entry) => entry.Sheet__Id === sheetId);
        if (!sheet) return false;
        const number = Na__LeModel__GetFields(sheet).DrawingNumber;
        Na__LeRegEdit__Busy = true;
        let unlock = () => {};
        let before = null;
        let beforeRefs = null;
        let beforeLocal = null;
        let suspended = false;
        const report = {};
        try {
            if (!await Na__LeRegDelete__Confirm(number, sheet.Sheet__Name)) return false;
            unlock = Na__LeRegEdit__Lock();
            await Na__LeAuto__Suspend(); suspended = true;
            if (Na__LeModel__GetFields(sheet).DrawingNumber !== number) throw new Error('The drawing number changed. Please confirm the current number.');
            const block = Na__DrawData__GetBlock();
            const live = block.LayoutEditor__DrawingsData__Sheets;
            const index = live.findIndex((entry) => entry.Sheet__Id === sheetId);
            if (index < 0) throw new Error('This drawing no longer exists.');
            before = Na__LeReg__Clone(live);
            beforeRefs = live.slice();
            beforeLocal = {
                LayoutEditor__DrawingsData : Na__LeReg__Clone(block),
                LayoutEditor__DrawingRegister : Na__LeReg__Clone(Na__LeReg__GetDocument())
            };
            const numbering = Na__LeReg__Clone(Na__LeReg__GetDocument().DrawingRegister__Numbering);
            delete numbering.DrawingRegister__Numbering__Overrides[sheetId];
            const remaining = Na__LeModel__GetSheets().filter((entry) => entry.Sheet__Id !== sheetId);
            const plan = Na__LeRegNum__Plan(remaining, numbering);
            const payload = Na__LeReg__NumberingPayload(numbering);
            [payload.cloud, payload.local].forEach((keys) => { delete keys.LayoutEditor__DrawingRegister.DrawingRegister__Revisions[sheetId]; });
            payload.localFirst = true;
            live.splice(index, 1);
            Na__LeRegNum__Apply(remaining, plan);
            const saved = await Na__DrawData__Save((message, error) => { if (error) Na__LeRegEdit__Toast(message, true); }, report, payload);
            if (!saved) throw new Error('Deletion could not be synced to R2.');
            Na__LeReg__AdoptNumbering(payload, sheetId);
            Na__LeModel__FinishRegisterDeletion(sheetId);
            // A stale browser draft must never restore the removed drawing at reload.
            Na__LeAuto__DiscardSavedDraft();
            Na__LeRegEdit__Toast(number + ' deleted locally and synced to R2.', false);
            return true;
        } catch (error) {
            if (before && !report.cloudSaved) {
                const live = Na__DrawData__GetBlock().LayoutEditor__DrawingsData__Sheets;
                before.forEach((record, index) => Object.assign(beforeRefs[index], record));
                live.splice(0, live.length, ...beforeRefs);
                if (report.localFirstWritten) {
                    const restored = await Na__LocalMirror__MergeKeys(beforeLocal);
                    if (!restored.ok) {
                        Na__LeRegEdit__PendingLocal = beforeLocal;
                        Na__LeRegEdit__Toast('Deletion was not completed. R2 retains the drawing; local restoration failed. Use Retry Local Sync. ' + (restored.error || ''), true);
                        return false;
                    }
                }
                Na__LeModel__NotifyRegister();
            }
            Na__LeRegEdit__Toast(error.message + (report.cloudSaved ? ' The deletion is already saved; reload the app.' : ' The drawing has been kept.'), true);
            return false;
        } finally {
            if (suspended) Na__LeAuto__Resume();
            unlock(); Na__LeRegEdit__Busy = false;
            window.dispatchEvent(new CustomEvent('na-layouteditor-register-changed'));
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Retry the Local Snapshot After an R2-Only Success
    // ------------------------------------------------------------
    async function Na__LeRegEdit__RetryLocal() {
        if (!Na__LeRegEdit__PendingLocal || Na__LeRegEdit__Busy) return false;
        Na__LeRegEdit__Busy = true;
        try {
            const result = await Na__LocalMirror__MergeKeys(Na__LeRegEdit__PendingLocal);
            if (!result.ok) throw new Error(result.error || 'Local sync failed.');
            Na__LeRegEdit__PendingLocal = null;
            Na__LeRegEdit__Toast('Drawing data synced to R2 and locally.', false);
            return true;
        } catch (error) {
            Na__LeRegEdit__Toast(error.message, true);
            return false;
        } finally {
            Na__LeRegEdit__Busy = false;
            window.dispatchEvent(new CustomEvent('na-layouteditor-register-changed'));
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Local Retry Is Waiting
    // ------------------------------------------------------------
    function Na__LeRegEdit__NeedsLocal() {
        return !!Na__LeRegEdit__PendingLocal;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Transaction Is in Flight
    // ------------------------------------------------------------
    function Na__LeRegEdit__IsBusy() {
        return Na__LeRegEdit__Busy;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Drawing Register Transactions API
    // ------------------------------------------------------------
    export {
        Na__LeRegEdit__Delete,
        Na__LeRegEdit__Initialize,
        Na__LeRegEdit__Metadata,
        Na__LeRegEdit__Renumber,
        Na__LeRegEdit__Override,
        Na__LeRegEdit__Move,
        Na__LeRegEdit__RetryLocal,
        Na__LeRegEdit__NeedsLocal,
        Na__LeRegEdit__IsBusy
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
