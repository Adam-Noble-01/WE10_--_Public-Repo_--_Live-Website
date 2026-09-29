// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT STANDARD SECTION - DRAWING SCHEDULE SOURCE
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Standard__DrawingSchedule__Live__.js
// NAMESPACE  : Na__LeStmtSchedLive
// MODULE     : Layout Editor - Statement Writer - The Drawing Schedule's Sync Source
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read the Drawing Register as it stands, for the Drawing Schedule's Sync button
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - WHAT SYNC READS. Every sheet in tab order, exactly as the Drawing
//   Register's own table and PDF read it (Na__LeRegPdf__Rows - one source for
//   the register, its PDF and this), then the Project Specification when it
//   holds at least one note: its document number (RB05_SPEC unless one was
//   typed) and its issued revision. The Drawing Schedule's Merge turns those
//   into the table's rows; this file never touches the statement.
// - READ ONCE, WHEN ASKED. Nothing here listens to the register: the
//   schedule is a copy taken at the moment Sync is pressed, because Adam,
//   29-Sep-2026: "you might not always want the live link in a document
//   that's meant to be set to a certain date and time".
// - APART FROM THE PURE MODULES ON PURPOSE. The register and the
//   specification need the running Layout Editor (the sheets, the loaded
//   project, the specification file), so they are imported here and only
//   here. The Statement Writer page imports this file; the registry, the
//   section module and the node tests never do.
//
// INTEGRATION:
// - Registers itself with Na__LayoutEditor__Statement__Standard__Registry__
//   (RegisterSource) as the Drawing Schedule's source when it is imported.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (29-Sep-2026).
// - ValeVision    : not yet ported (ValeVision has no statement tab).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.167.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Registry, the Section, the Register and the Specification
    // ------------------------------------------------------------
    import { Na__LeStmtStd__RegisterSource } from './Na__LayoutEditor__Statement__Standard__Registry__.js';
    import { Na__LeStmtSched__ID } from './Na__LayoutEditor__Statement__Standard__DrawingSchedule__.js';
    import { Na__LeRegPdf__Rows } from '../../51__Feature__DrawingRegister/Na__LayoutEditor__Register__Pdf__.js';
    import {
        Na__LeSpec__EnsureLoaded,
        Na__LeSpec__IsLoaded,
        Na__LeSpec__ListNotes,
        Na__LeSpec__GetDocumentNumber,
        Na__LeSpec__GetRevision
    } from '../../50__Feature__Specification/Na__LayoutEditor__SpecData__.js';
    import { Na__DrawData__GetProjectCode } from '../../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading the Register
// -----------------------------------------------------------------------------

    // FUNCTION | The Register's Rows, Then the Specification's
    // ------------------------------------------------------------
    // Resolves to { ok, Rows, ProjectCode, Source } or { ok : false, reason }.
    // A specification that cannot be read leaves its row out rather than
    // stopping the drawings: they are what the table is for.
    // ------------------------------------------------------------
    async function Na__LeStmtSchedLive__Read() {
        let sheets;
        try {
            sheets = Na__LeRegPdf__Rows();
        } catch (error) {
            return { ok : false, reason : 'The Drawing Register could not be read (' + ((error && error.message) || error) + ').' };
        }
        if (!Array.isArray(sheets) || !sheets.length) {
            return { ok : false, reason : 'The Drawing Register has no drawings yet, so there is nothing to sync.' };
        }

        const code = String(Na__DrawData__GetProjectCode() || '').trim();
        const rows = sheets.map((row) => ({
            code      : row.code || row.documentCode,
            drawingNo : row.drawingNo,
            phase     : row.phase,
            name      : row.name,
            label     : row.label,
            scale     : row.scale,
            size      : row.size,
            revision  : row.revision,
            status    : row.status
        }));

        try {
            await Na__LeSpec__EnsureLoaded();
            if (Na__LeSpec__IsLoaded() && Na__LeSpec__ListNotes().length) {
                rows.push({ Kind : 'specification', code : Na__LeSpec__GetDocumentNumber(code), revision : Na__LeSpec__GetRevision() });
            }
        } catch (error) {
            console.warn('[TrueVision3D] Statement Writer: the Project Specification could not be read for the Drawing Schedule; its row is left out.', error);
        }

        return { ok : true, Rows : rows, ProjectCode : code, Source : 'Drawing Register', SyncedIso : new Date().toISOString() };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Registration
// -----------------------------------------------------------------------------

    Na__LeStmtStd__RegisterSource(Na__LeStmtSched__ID, Na__LeStmtSchedLive__Read);   // <-- The Drawing Schedule's card now has a Sync button

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | The Drawing Schedule's Sync Source
    // ------------------------------------------------------------
    export {
        Na__LeStmtSchedLive__Read
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
