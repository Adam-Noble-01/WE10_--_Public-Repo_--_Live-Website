// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION MARGIN
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecMargin__.js
// NAMESPACE  : Na__LeMargin
// MODULE     : Layout Editor - Specification Margin
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Lay out a sheet's notes margin - which specification notes it lists, in what order, wrapped to its width - and draw it as primitives
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - THE COLUMN. A sheet with its margin switched on reserves a column down
//   the right of its content area, from the top of the border to the title
//   block (Na__LeLayout__MarginRect). It is painted paper, so a viewport
//   pushed beneath it never prints through the notes, with a divider down its
//   left edge - the edge the grip drags.
// - WHAT IT LISTS, AND IN WHAT ORDER. The notes this sheet's bubbles link to
//   (on visible layers), in specification order - group by group, note by
//   note, so codes read in sequence - and then the general notes, always last.
//   A general note is listed on every sheet whose margin includes general
//   notes, and on any sheet whose bubbles link to it. A priority band that
//   comes first is reserved here for when notes can be marked important.
// - HOW A NOTE READS. Its code in bold, in a code column as wide as the widest
//   code listed; its title in bold beside the code; its specification text
//   under the title, wrapped to the column at word boundaries (a word wider
//   than the column breaks where it runs out), keeping the line breaks typed
//   into it. Optional group headings. The width of every run is measured with
//   the same metrics the PDF uses, so a line breaks in the same place on the
//   screen and on paper.
// - OVERFLOW. Notes are laid top to bottom and a note that would cross the
//   foot of the column is not drawn, nor any after it, so the order is never
//   broken to squeeze a later note in. Report says how many did not fit; the
//   panel, the grip badge and the PDF export warn about it.
// - Pure layout: nothing here touches the DOM or changes the model.
//
// INTEGRATION:
// - Na__LayoutEditor__MarkupBridge__ pushes the margin first in the sheet's
//   markup, so the screen and the PDF draw it from the same primitives.
// - Na__LayoutEditor__Panel__MarginNotes__, __MarginGrip__ and __PdfExporter__
//   read Report.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Chrome Primitives, Layout, Records, Specification and Links
    // ------------------------------------------------------------
    import {
        Na__LeCfg__GetMarginNotesSetup,
        Na__LeCfg__GetStyleSetup,
        Na__LeCfg__GetTextSetup,
        Na__LeCfg__GetSheetSetup,
        Na__LeCfg__PtToMm
    } from './Na__LayoutEditor__ConfigState__.js';
    import { Na__LeChrome__MeasureTextMm, Na__LeChrome__PushRect, Na__LeChrome__PushLine, Na__LeChrome__PushText } from './Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeLayout__Solve, Na__LeLayout__MarginRect } from './Na__LayoutEditor__SheetLayout__.js';
    import { Na__LeRec__MarginNotes } from './Na__LayoutEditor__SheetRecords__.js';
    import { Na__LeSpec__IsLoaded, Na__LeSpec__ListNotes } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeSpecLink__LinkedNoteIds } from './Na__LayoutEditor__SpecLinks__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Typography
    // ------------------------------------------------------------
    const Na__LeMargin__CAP_HEIGHT = 0.72;     // <-- Helvetica cap height as a fraction of the font size, as the chrome measures it
    const Na__LeMargin__DESCENT    = 0.25;
    const Na__LeMargin__CODE_SHARE = 0.4;      // <-- The code column never takes more than this share of the inner width
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What the Margin Lists
// -----------------------------------------------------------------------------

    // FUNCTION | The Notes a Sheet's Margin Lists, in Order
    // ------------------------------------------------------------
    // Returns { entries, linked, general, pending }: entries are specification
    // entries ({ note, group, code, ... }); linked counts the notes listed
    // because this sheet's bubbles link to them, in whatever group; general
    // counts the general notes listed only because the margin lists general
    // notes; pending is true while the specification has not loaded, when
    // nothing can be listed yet.
    // ------------------------------------------------------------
    function Na__LeMargin__Entries(sheet) {
        const settings = Na__LeRec__MarginNotes(sheet);
        if (!Na__LeSpec__IsLoaded()) return { entries : [], linked : 0, general : 0, pending : true };
        const linkedIds = Na__LeSpecLink__LinkedNoteIds(sheet, true);
        const priority  = [];                                                    // <-- Reserved: notes marked important will be listed first
        const standard  = [];
        const general   = [];
        let   linked    = 0;
        Na__LeSpec__ListNotes().forEach((entry) => {
            const isLinked = linkedIds.has(entry.note.Note__Id);
            if (isLinked) linked++;
            if (entry.group.Group__IsGeneral) { if (isLinked || settings.IncludeGeneral) general.push(entry); return; }
            if (isLinked) standard.push(entry);
        });
        const generalOnly = general.filter((entry) => !linkedIds.has(entry.note.Note__Id)).length;
        return { entries : priority.concat(standard, general), linked : linked, general : generalOnly, pending : false };
    }
    // ------------------------------------------------------------


    // FUNCTION | Wrap Text to a Width: One String per Printed Line
    // ------------------------------------------------------------
    // Line breaks typed into the text are kept (a blank line stays a blank
    // line); within a line the breaks fall between words, and a word too wide
    // for the column breaks where it runs out. Blank lines at either end go.
    // ------------------------------------------------------------
    function Na__LeMargin__Wrap(text, fontMm, weight, widthMm) {
        const lines = [];
        const fits  = (value) => Na__LeChrome__MeasureTextMm(value, fontMm, weight) <= widthMm;
        String(text === undefined || text === null ? '' : text).split(/\r?\n/).forEach((paragraph) => {
            const words = paragraph.split(/\s+/).filter((word) => word !== '');
            if (!words.length) { lines.push(''); return; }
            let line = '';
            words.forEach((word) => {
                const trial = line ? line + ' ' + word : word;
                if (fits(trial)) { line = trial; return; }
                if (line) lines.push(line);
                line = '';
                if (fits(word)) { line = word; return; }
                let piece = '';
                Array.from(word).forEach((character) => {
                    if (piece && !fits(piece + character)) { lines.push(piece); piece = ''; }
                    piece += character;
                });
                line = piece;
            });
            if (line) lines.push(line);
        });
        while (lines.length && lines[lines.length - 1] === '') lines.pop();
        while (lines.length && lines[0] === '') lines.shift();
        return lines;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Layout
// -----------------------------------------------------------------------------

    // FUNCTION | Plan the Column: Where Every Run of Text Goes and What Did Not Fit
    // ------------------------------------------------------------
    // Returns null when the sheet has no margin, else
    // { rect, runs [{ text, x, baselineY, fontMm, weight, colour, trackingMm }],
    //   total, shown, overflow, linked, general, pending }.
    // layout is the solved sheet layout; the margin itself is measured afresh
    // from the sheet, so a width dragged since the last solve is honoured.
    // ------------------------------------------------------------
    function Na__LeMargin__Plan(sheet, layout) {
        const lay  = layout || (sheet ? Na__LeLayout__Solve(sheet) : null);
        const rect = lay ? Na__LeLayout__MarginRect(sheet, lay.Content, lay.TitleBlock) : null;
        if (!rect) return null;
        const setup    = Na__LeCfg__GetMarginNotesSetup();
        const style    = Na__LeCfg__GetStyleSetup();
        const settings = Na__LeRec__MarginNotes(sheet);
        const found    = Na__LeMargin__Entries(sheet);
        const plan     = { rect : rect, runs : [], total : found.entries.length, shown : 0, overflow : 0, linked : found.linked, general : found.general, pending : found.pending };

        const pad     = Math.min(setup.paddingMm, rect.WidthMm / 4);
        const left    = rect.X + pad;
        const right   = rect.X + rect.WidthMm - pad;
        const bottom  = rect.Y + rect.HeightMm - pad;
        const bodyMm  = settings.TextSizeMm;
        const titleMm = bodyMm * setup.titleScale;
        const bodyGap = bodyMm * setup.lineSpacing;
        const titleGap = titleMm * setup.lineSpacing;
        const cap     = Na__LeMargin__CAP_HEIGHT;
        let   y       = rect.Y + pad;                                            // <-- The top of the next run of text

        // HEADING | Across the top, tracked capitals
        const heading = String(settings.Heading || setup.headingText || '').trim();
        if (heading) {
            const headingMm = setup.headingSizeMm;
            plan.runs.push({ text : heading.toUpperCase(), x : left, baselineY : y + (headingMm * cap), fontMm : headingMm, weight : 'bold', colour : style.inkColour, trackingMm : setup.headingTrackingMm });
            y += (headingMm * (cap + Na__LeMargin__DESCENT)) + setup.headingGapMm;
        }
        if (!found.entries.length) return plan;

        // THE CODE COLUMN | As wide as the widest code listed, never more than a share of the width
        const inner   = Math.max(1, right - left);
        const widest  = found.entries.reduce((w, entry) => Math.max(w, Na__LeChrome__MeasureTextMm(entry.code, titleMm, 'bold')), 0);
        const codeW   = Math.min(inner * Na__LeMargin__CODE_SHARE, widest + setup.codeGapMm);
        const textX   = left + codeW;
        const textW   = Math.max(1, right - textX);

        let lastGroup = null;
        for (let i = 0; i < found.entries.length; i++) {
            const entry  = found.entries[i];
            const runs   = [];
            let   top    = y;

            // GROUP HEADING | When asked for, above the first note of each group
            if (settings.GroupHeadings && entry.group !== lastGroup) {
                if (lastGroup) top += setup.groupGapMm;
                const label = String(entry.group.Group__Title || entry.group.Group__Prefix).toUpperCase();
                runs.push({ text : label, x : left, baselineY : top + (bodyMm * cap), fontMm : bodyMm, weight : 'bold', colour : style.mutedTextColour, trackingMm : setup.headingTrackingMm / 2 });
                top += bodyGap;
            }

            // THE NOTE | Code, title lines, then body lines under the title
            const titleLines = Na__LeMargin__Wrap(entry.note.Note__Title, titleMm, 'bold', textW);
            const bodyLines  = Na__LeMargin__Wrap(entry.note.Note__Body, bodyMm, 'normal', textW);
            const firstMm    = titleLines.length ? titleMm : bodyMm;
            runs.push({ text : entry.code, x : left, baselineY : top + (firstMm * cap), fontMm : titleMm, weight : 'bold', colour : style.inkColour, trackingMm : 0 });
            let baseline = top + (titleMm * cap);
            titleLines.forEach((line, k) => {
                if (k > 0) baseline += titleGap;
                runs.push({ text : line, x : textX, baselineY : baseline, fontMm : titleMm, weight : 'bold', colour : style.inkColour, trackingMm : 0 });
            });
            let bottomOfNote = titleLines.length ? baseline + (titleMm * Na__LeMargin__DESCENT) : top;
            if (bodyLines.length) {
                let bodyBaseline = titleLines.length ? baseline + bodyGap : top + (bodyMm * cap);
                bodyLines.forEach((line, k) => {
                    if (k > 0) bodyBaseline += bodyGap;
                    if (line !== '') runs.push({ text : line, x : textX, baselineY : bodyBaseline, fontMm : bodyMm, weight : 'normal', colour : style.inkColour, trackingMm : 0 });
                });
                bottomOfNote = bodyBaseline + (bodyMm * Na__LeMargin__DESCENT);
            }
            bottomOfNote = Math.max(bottomOfNote, top + (titleMm * (cap + Na__LeMargin__DESCENT)));   // <-- A note with no title and no body still holds its code's line

            // OVERFLOW | The first note that would cross the foot ends the list, so the order holds
            if (bottomOfNote > bottom) { plan.overflow = found.entries.length - i; break; }
            runs.forEach((run) => plan.runs.push(run));
            plan.shown++;
            lastGroup = entry.group;
            y = bottomOfNote + setup.noteGapMm;
        }
        return plan;
    }
    // ------------------------------------------------------------


    // FUNCTION | Push a Sheet's Margin as Primitives: Paper, Divider, Text (returns the plan, or null)
    // ------------------------------------------------------------
    // The paper stops a border stroke short of the content border and the title
    // block, so on screen - where the chrome is under the markup - it never
    // covers the lines it sits between.
    // ------------------------------------------------------------
    function Na__LeMargin__Push(list, sheet, layout) {
        const plan = Na__LeMargin__Plan(sheet, layout);
        if (!plan) return null;
        const setup  = Na__LeCfg__GetMarginNotesSetup();
        const style  = Na__LeCfg__GetStyleSetup();
        const inset  = Na__LeCfg__GetSheetSetup().borderStrokeMm;
        const family = Na__LeCfg__GetTextSetup().fontFamily;
        const rect   = plan.rect;
        Na__LeChrome__PushRect(list, rect.X, rect.Y + inset, Math.max(0, rect.WidthMm - inset), Math.max(0, rect.HeightMm - (inset * 2)), null, 0, style.paperColour);
        const dividerMm = Na__LeCfg__PtToMm(setup.dividerPt);
        if (dividerMm > 0) Na__LeChrome__PushLine(list, rect.X, rect.Y, rect.X, rect.Y + rect.HeightMm, style.inkColour, dividerMm);
        plan.runs.forEach((run) => {
            Na__LeChrome__PushText(list, {
                X : run.x, BaselineY : run.baselineY, Text : run.text, FontMm : run.fontMm, Weight : run.weight,
                Colour : run.colour, Align : 'left', FontFamily : family, TrackingMm : run.trackingMm
            });
        });
        return plan;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Sheet's Margin in Numbers, for the Panel, the Grip and the PDF
    // ------------------------------------------------------------
    // { on, settings, rect, total, shown, overflow, linked, general, pending }
    // ------------------------------------------------------------
    function Na__LeMargin__Report(sheet, layout) {
        const settings = Na__LeRec__MarginNotes(sheet);
        const plan     = (sheet && settings.Enabled === true) ? Na__LeMargin__Plan(sheet, layout) : null;
        return {
            on       : !!plan,
            settings : settings,
            rect     : plan ? plan.rect : null,
            total    : plan ? plan.total : 0,
            shown    : plan ? plan.shown : 0,
            overflow : plan ? plan.overflow : 0,
            linked   : plan ? plan.linked : 0,
            general  : plan ? plan.general : 0,
            pending  : plan ? plan.pending : !Na__LeSpec__IsLoaded()
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Margin API
    // ------------------------------------------------------------
    export {
        Na__LeMargin__Entries,
        Na__LeMargin__Wrap,
        Na__LeMargin__Plan,
        Na__LeMargin__Push,
        Na__LeMargin__Report
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
