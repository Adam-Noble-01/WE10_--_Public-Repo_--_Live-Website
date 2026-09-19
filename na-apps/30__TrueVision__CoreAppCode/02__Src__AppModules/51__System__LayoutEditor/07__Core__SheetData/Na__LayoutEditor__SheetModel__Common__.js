// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET MODEL - COMMON TITLE BLOCK FIELDS
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetModel__Common__.js
// NAMESPACE  : Na__LeCommon
// MODULE     : Layout Editor - Sheet Model - Common Title Block Fields
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Hold the client and the site address once for the whole drawing pack
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - A householder project has one client and one site. Every sheet in the pack
//   prints the same two lines, and TrueVision used to store them per sheet -
//   which meant typing them again on every new drawing, and meant four sheets
//   could disagree. PS01 did: three sheets ended the postcode with a trailing
//   space and one did not, and all four said "Nottinghamshire" where the
//   quotation said "Nottingham".
// - So the two values live ONCE, on the drawings block, and each sheet carries
//   a single Common switch. On - the default, and absent reads as on - the
//   sheet shows the pack's values and editing either edits the whole pack.
//   Off, the sheet keeps its own, for the one drawing in a career that needs
//   a different address.
//
// THE SWITCH COVERS BOTH FIELDS:
// - One switch, not two. A sheet that needs its own address almost always
//   needs its own client with it, and a row of half-linked fields is harder to
//   read than it is useful. Turning it off writes BOTH current values onto the
//   sheet, so the override starts from what was printed rather than from blank.
//
// MIGRATION:
// - A pack that has never had common values adopts them from its own sheets,
//   NOT from the admin record. An issued drawing must not quietly change its
//   printed address because a quotation spells the county differently - the
//   sheets are the truth about what was issued, and the admin record is then
//   offered beside them for Adam to take or leave.
// - A project with nothing typed anywhere - a new one - seeds straight from
//   the admin record, which is the whole point of the feature.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetRecords__ reads Get() for its field defaults.
// - Na__LayoutEditor__Panel__Sheet__ draws the switch and the two rows.
// - Na__LayoutEditor__ProjectRecord__ supplies the admin record.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Pack-Level Store and the Admin Record
    // ------------------------------------------------------------
    // Both leaves from here. This module is deliberately NOT allowed to import
    // the sheet model's state unit: Na__LayoutEditor__SheetRecords__ reads Get
    // and Uses out of here for its field defaults, and the state unit imports
    // SheetRecords, so importing state back would close a three-module cycle.
    // Seed and AdoptFromSheets are handed the sheet array instead, and the
    // caller marks the model dirty.
    // ------------------------------------------------------------
    import { Na__DrawData__GetCommonFields, Na__DrawData__SetCommonField } from '../../40__System__DrawingViewCore/Na__DrawView__ProjectData__.js';
    import { Na__LeRecord__Fetch }                                         from './Na__LayoutEditor__ProjectRecord__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Two Fields the Switch Governs
    // ------------------------------------------------------------
    const Na__LeCommon__KEYS      = [ 'Client', 'SiteAddress' ];
    const Na__LeCommon__FLAG_KEY  = 'Sheet__CommonFields';                      // <-- Written only when false; absent reads as on
    const Na__LeCommon__FIELD     = (key) => 'Sheet__Fields__' + key;
    // ------------------------------------------------------------


    // MODULE VARIABLES | The Admin Record, Once the Seed Has Fetched It
    // ------------------------------------------------------------
    // Kept so the panel can offer a value that differs from the pack's without
    // fetching again, and so the offer survives a panel rebuild.
    // ------------------------------------------------------------
    let Na__LeCommon__Record = null;    // <-- { Client, SiteAddress } or null before the first fetch
    let Na__LeCommon__Seeded = false;   // <-- One seed per project load
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading and Writing the Pack's Values
// -----------------------------------------------------------------------------

    // FUNCTION | The Client and Site Address the Pack Shares
    // ------------------------------------------------------------
    function Na__LeCommon__Get() {
        return Na__DrawData__GetCommonFields();
    }
    // ------------------------------------------------------------


    // FUNCTION | Set One of the Pack's Values
    // ------------------------------------------------------------
    // Every sheet on Common repaints from this, so the caller announces once
    // rather than touching each sheet.
    // ------------------------------------------------------------
    function Na__LeCommon__Set(key, value) {
        if (Na__LeCommon__KEYS.indexOf(key) === -1) return false;
        Na__DrawData__SetCommonField(key, value);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Sheet on the Pack's Values?
    // ------------------------------------------------------------
    // Absent reads as ON: every sheet ever drawn joins the pack by default,
    // and only a deliberate opt-out is written down.
    // ------------------------------------------------------------
    function Na__LeCommon__Uses(sheet) {
        if (!sheet || typeof sheet !== 'object') return true;
        return sheet[Na__LeCommon__FLAG_KEY] !== false;
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Sheet's Two Fields Actually Read
    // ------------------------------------------------------------
    // The one answer both the panel and the title block ask for: on Common the
    // pack's value, off Common the sheet's own, and neither falls back to the
    // other - a sheet that opted out and then cleared a box means it empty.
    // ------------------------------------------------------------
    function Na__LeCommon__Value(sheet, key) {
        if (Na__LeCommon__KEYS.indexOf(key) === -1) return '';
        if (Na__LeCommon__Uses(sheet)) return Na__LeCommon__Get()[key] || '';
        const stored = (sheet && sheet.Sheet__Fields) ? sheet.Sheet__Fields[Na__LeCommon__FIELD(key)] : undefined;
        return (typeof stored === 'string') ? stored : '';
    }
    // ------------------------------------------------------------


    // FUNCTION | Join a Sheet to the Pack, or Cut It Loose
    // ------------------------------------------------------------
    // Cutting it loose copies what the sheet is printing NOW onto the sheet, so
    // the override opens with the right address in it and Adam edits a word
    // rather than retyping a postcode. Joining drops the sheet's copies, which
    // is what makes the pack agree with itself again.
    // ------------------------------------------------------------
    function Na__LeCommon__SetUses(sheet, on) {
        if (!sheet || typeof sheet !== 'object') return false;
        const joining = (on === true);
        if (joining === Na__LeCommon__Uses(sheet)) return false;                 // <-- Already there: no edit, no undo step
        const carried = {};
        Na__LeCommon__KEYS.forEach((key) => { carried[key] = Na__LeCommon__Value(sheet, key); });
        const fields = sheet.Sheet__Fields || (sheet.Sheet__Fields = {});
        if (joining) {
            delete sheet[Na__LeCommon__FLAG_KEY];
            Na__LeCommon__KEYS.forEach((key) => { delete fields[Na__LeCommon__FIELD(key)]; });
        } else {
            sheet[Na__LeCommon__FLAG_KEY] = false;
            Na__LeCommon__KEYS.forEach((key) => { if (carried[key]) fields[Na__LeCommon__FIELD(key)] = carried[key]; });
        }
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Seeding a Pack That Has No Common Values
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Value Most of the Pack Already Agrees On
    // ------------------------------------------------------------
    // Trimmed before counting, so "NG2 7DD" and "NG2 7DD " are one value and
    // not two - which is exactly the disagreement this feature exists to end.
    // A tie goes to the sheet nearest the front of the pack.
    // ------------------------------------------------------------
    function Na__LeCommon__Consensus(sheets, key) {
        const tally = new Map();
        sheets.forEach((sheet) => {
            const raw = (sheet && sheet.Sheet__Fields) ? sheet.Sheet__Fields[Na__LeCommon__FIELD(key)] : undefined;
            const text = (typeof raw === 'string') ? raw.trim() : '';
            if (!text) return;
            if (!tally.has(text)) tally.set(text, 0);
            tally.set(text, tally.get(text) + 1);
        });
        let best = '', bestCount = 0;
        tally.forEach((count, text) => { if (count > bestCount) { best = text; bestCount = count; } });
        return best;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take the Pack's Own Typed Values Up to the Pack Level
    // ------------------------------------------------------------
    // The sheets that already agree with the consensus lose their copies and
    // stay on Common; a sheet that genuinely differs is switched off Common and
    // keeps exactly what it was printing. Nothing a title block shows changes,
    // except a trailing space nobody could see.
    // ------------------------------------------------------------
    function Na__LeCommon__AdoptFromSheets(sheetList) {
        const sheets = (Array.isArray(sheetList) ? sheetList : []).filter((s) => s && typeof s === 'object');
        const agreed = {};
        let found = false;
        Na__LeCommon__KEYS.forEach((key) => {
            agreed[key] = Na__LeCommon__Consensus(sheets, key);
            if (agreed[key]) found = true;
        });
        if (!found) return false;

        Na__LeCommon__KEYS.forEach((key) => { if (agreed[key]) Na__DrawData__SetCommonField(key, agreed[key]); });

        sheets.forEach((sheet) => {
            const fields = sheet.Sheet__Fields || (sheet.Sheet__Fields = {});
            const differs = Na__LeCommon__KEYS.some((key) => {
                const raw  = fields[Na__LeCommon__FIELD(key)];
                const text = (typeof raw === 'string') ? raw.trim() : '';
                return text !== '' && text !== agreed[key];                      // <-- Blank is not a disagreement: it was already showing the default
            });
            if (differs) {
                sheet[Na__LeCommon__FLAG_KEY] = false;
                Na__LeCommon__KEYS.forEach((key) => {
                    const raw  = fields[Na__LeCommon__FIELD(key)];
                    const text = (typeof raw === 'string') ? raw.trim() : '';
                    if (!text && agreed[key]) fields[Na__LeCommon__FIELD(key)] = agreed[key];   // <-- Off Common means it carries both, stated
                    else if (text) fields[Na__LeCommon__FIELD(key)] = text;
                });
            } else {
                Na__LeCommon__KEYS.forEach((key) => { delete fields[Na__LeCommon__FIELD(key)]; });
            }
        });
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Seed the Pack's Values, Once Per Project Load
    // ------------------------------------------------------------
    // Order: what the sheets already print, then the admin record, then
    // nothing. Resolves to true when something was written, so the caller can
    // mark the model dirty and repaint - the seed rides out with the next save
    // rather than writing to R2 on its own, exactly as the v2.21.0 drawings
    // migration does.
    // ------------------------------------------------------------
    async function Na__LeCommon__Seed(sheetList) {
        if (Na__LeCommon__Seeded) return false;
        Na__LeCommon__Seeded = true;

        const current = Na__LeCommon__Get();
        let changed = false;
        if (!current.Client && !current.SiteAddress) changed = Na__LeCommon__AdoptFromSheets(sheetList);

        Na__LeCommon__Record = await Na__LeRecord__Fetch();
        const after = Na__LeCommon__Get();
        Na__LeCommon__KEYS.forEach((key) => {
            if (!after[key] && Na__LeCommon__Record[key]) {                      // <-- Nothing typed anywhere: the admin record IS the answer
                Na__DrawData__SetCommonField(key, Na__LeCommon__Record[key]);
                changed = true;
            }
        });

        return changed;
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Admin Record Says, Where It Differs from the Pack
    // ------------------------------------------------------------
    // Empty keys where the record agrees or has nothing, so the panel can show
    // an offer only when there is a real difference to show.
    // ------------------------------------------------------------
    function Na__LeCommon__RecordOffer() {
        const offer = {};
        const current = Na__LeCommon__Get();
        Na__LeCommon__KEYS.forEach((key) => {
            const record = (Na__LeCommon__Record && Na__LeCommon__Record[key]) || '';
            offer[key] = (record && record !== current[key]) ? record : '';
        });
        return offer;
    }
    // ------------------------------------------------------------


    // FUNCTION | Forget the Seed (a project change)
    // ------------------------------------------------------------
    function Na__LeCommon__Reset() {
        Na__LeCommon__Record = null;
        Na__LeCommon__Seeded = false;
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Common Title Block Fields API
    // ------------------------------------------------------------
    export {
        Na__LeCommon__KEYS,
        Na__LeCommon__Get,
        Na__LeCommon__Set,
        Na__LeCommon__Uses,
        Na__LeCommon__SetUses,
        Na__LeCommon__Value,
        Na__LeCommon__Seed,
        Na__LeCommon__RecordOffer,
        Na__LeCommon__Reset
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
