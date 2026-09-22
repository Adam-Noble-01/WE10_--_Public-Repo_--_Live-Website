// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SPECIFICATION MARGIN - COLUMN
// =============================================================================
//
// FILE       : Na__LayoutEditor__SpecMargin__Column__.js
// NAMESPACE  : Na__LeMarginCol
// MODULE     : Layout Editor - Specification Margin - Column
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Lay a list of specification notes down a box - a heading, each note's code and title, its wrapped text - and say how many fitted
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - ONE SET OF RULES FOR EVERY BOX OF NOTES. The notes margin down the right
//   of a sheet and each overspill note region drawn on it are laid out here,
//   by the same code, so a note reads the same wherever it lands. This is
//   Na__LayoutEditor__SpecMargin__'s Plan from 1.3.0, moved verbatim: what
//   was the margin's own rectangle, list, heading and insets is now handed in.
// - HOW A NOTE READS. Its code in bold, a pipe, then its title in bold on
//   the same line; its specification text under that, wrapped to the full
//   inner width at word boundaries (a word wider than the box breaks where it
//   runs out), keeping the line breaks typed into it. A faint rule sits
//   between notes. Optional group headings. The width of every run is
//   measured with the same metrics the PDF uses, so a line breaks in the same
//   place on the screen and on paper.
// - OVERFLOW. Notes are laid top to bottom and a note that would cross the
//   foot of the box is not drawn, nor any after it, so the order is never
//   broken to squeeze a later note in. The plan says how many were laid
//   (shown) and how many were not (overflow): the ones not laid are exactly
//   the list from index shown on, which is what carries on into the next box.
// - SPACING. The gap between two notes has a least and a most (NoteGapMm,
//   NoteGapMaxMm), with the rule centred in it. What fits is decided at the
//   least; when every note is in and the box has room left at the foot, every
//   gap opens by the same amount towards the most. A full box, or one whose
//   notes did not all fit, keeps the least.
// - Pure layout: nothing here touches the DOM or changes the model. It reads
//   the config and measures text, and nothing else, so both the margin and
//   the regions can import it without a cycle.
//
// INTEGRATION:
// - Na__LayoutEditor__SpecMargin__ lays the margin with Lay and re-exports
//   Wrap under its old name; Na__LayoutEditor__NoteRegions__ lays each region.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026), from SpecMargin 1.3.0
// - ValeVision    : not yet ported. Nothing here is app-specific.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation: Wrap and the margin's Plan moved here from
//   Na__LayoutEditor__SpecMargin__ 1.3.0, the Plan as Lay(rect, entries,
//   options). The code is verbatim bar the names of what is now handed in,
//   and one change:
// - A HEADING TOO WIDE FOR ITS BOX WRAPS (HeadingLines). The box's heading
//   and a group heading were one run whatever their length, which ran past
//   the right edge once a region took a long group title ("Building Features
//   - South West Elevation - Main House") as its own. One that fits is still
//   the single run it always was - every margin heading today fits - and
//   Wrap takes the tracking of tracked capitals into its measure.
// - One option added, which the margin never passes: headingGroupId, so a
//   region titled after its one group does not print that group's heading
//   again directly under its title.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config and the Chrome's Text Measure
    // ------------------------------------------------------------
    import { Na__LeCfg__GetMarginNotesSetup, Na__LeCfg__GetStyleSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeChrome__MeasureTextMm } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Typography
    // ------------------------------------------------------------
    const Na__LeMarginCol__CAP_HEIGHT = 0.72;     // <-- Helvetica cap height as a fraction of the font size, as the chrome measures it
    const Na__LeMarginCol__DESCENT    = 0.25;
    const Na__LeMarginCol__PIPE       = ' | ';    // <-- Fallback delimiter between the code and the title
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Wrapping
// -----------------------------------------------------------------------------

    // FUNCTION | Wrap Text to a Width: One String per Printed Line
    // ------------------------------------------------------------
    // Line breaks typed into the text are kept (a blank line stays a blank
    // line); within a line the breaks fall between words, and a word too wide
    // for the box breaks where it runs out. Blank lines at either end go.
    // trackingMm (optional) is measured with each run, for tracked capitals.
    // ------------------------------------------------------------
    function Na__LeMarginCol__Wrap(text, fontMm, weight, widthMm, trackingMm) {
        const lines = [];
        const fits  = (value) => Na__LeChrome__MeasureTextMm(value, fontMm, weight, trackingMm) <= widthMm;
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


    // HELPER FUNCTION | A Heading's Printed Lines: Itself When It Fits, Wrapped Only When It Does Not
    // ------------------------------------------------------------
    // A heading that fits is printed exactly as it always was - one run, its
    // spacing untouched - so every margin whose heading fits reads as before.
    // One too wide for its box (a long group title as a region's title, or as
    // a group heading in a narrow box) wraps rather than running past the
    // box's edge.
    // ------------------------------------------------------------
    function Na__LeMarginCol__HeadingLines(text, fontMm, widthMm, trackingMm) {
        if (Na__LeChrome__MeasureTextMm(text, fontMm, 'bold', trackingMm) <= widthMm) return [ text ];
        const lines = Na__LeMarginCol__Wrap(text, fontMm, 'bold', widthMm, trackingMm);
        return lines.length ? lines : [ text ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Layout
// -----------------------------------------------------------------------------

    // FUNCTION | Lay a List of Notes Down a Box: Where Every Run of Text Goes and What Did Not Fit
    // ------------------------------------------------------------
    // rect     { X, Y, WidthMm, HeightMm } paper millimetres
    // entries  specification entries ({ note, group, code, ... }), in the
    //          order they are to read
    // options  { heading      the words across the top ('' for none), set in
    //                         tracked capitals
    //            padLeft, padRight, padTop, padBottom   the insets, mm
    //            textSizeMm   the body size; titles are TitleScale times it
    //            groupHeadings  a heading above the first note of each group
    //            headingGroupId the group the heading already names, whose
    //                         group heading is not printed again (optional) }
    // Returns { runs [{ text, x, baselineY, fontMm, weight, colour, trackingMm }],
    //   rules [{ X1, Y1, X2, Y2 }], shown, overflow,
    //   noteGapMm (the gap the notes were laid at, NoteGapMm to NoteGapMaxMm) }.
    // The notes not laid are entries.slice(shown).
    // ------------------------------------------------------------
    function Na__LeMarginCol__Lay(rect, entries, options) {
        const setup = Na__LeCfg__GetMarginNotesSetup();
        const style = Na__LeCfg__GetStyleSetup();
        const list  = Array.isArray(entries) ? entries : [];
        const o     = options || {};
        const plan  = { runs : [], rules : [], shown : 0, overflow : 0, noteGapMm : setup.noteGapMm };
        if (!rect) return plan;

        const left     = rect.X + o.padLeft;
        const right    = rect.X + rect.WidthMm - o.padRight;
        const bottom   = rect.Y + rect.HeightMm - o.padBottom;
        const bodyMm   = o.textSizeMm;
        const titleMm  = bodyMm * setup.titleScale;
        const bodyGap  = bodyMm * setup.lineSpacing;
        const titleGap = titleMm * setup.lineSpacing;
        const cap      = Na__LeMarginCol__CAP_HEIGHT;
        let   y        = rect.Y + o.padTop;                                     // <-- The top of the next run of text

        // HEADING | Across the top, tracked capitals; wrapped only when it is too wide
        const inner   = Math.max(1, right - left);
        const heading = String(o.heading || '').trim();
        if (heading) {
            const headingMm = setup.headingSizeMm;
            Na__LeMarginCol__HeadingLines(heading.toUpperCase(), headingMm, inner, setup.headingTrackingMm).forEach((line, k) => {
                if (k > 0) y += headingMm * setup.lineSpacing;
                plan.runs.push({ text : line, x : left, baselineY : y + (headingMm * cap), fontMm : headingMm, weight : 'bold', colour : style.inkColour, trackingMm : setup.headingTrackingMm });
            });
            y += (headingMm * (cap + Na__LeMarginCol__DESCENT)) + setup.headingGapMm;
        }
        if (!list.length) return plan;

        // THE NOTE | Code, a pipe and the title on one line; the body uses the
        // full inner width. A title that wraps hangs under itself after the pipe.
        // ------------------------------------
        const pipe  = (typeof setup.codePipe === 'string') ? setup.codePipe : Na__LeMarginCol__PIPE;

        let lastGroup = null;
        let lastFoot  = y;                                                       // <-- The foot of the last note that fits, at the least gap
        const laid    = [];                                                      // <-- Each note that fits: its runs and the rule above it, placed once the gap is known
        for (let i = 0; i < list.length; i++) {
            const entry  = list[i];
            const runs   = [];
            let   top    = y;

            // GROUP HEADING | When asked for, above the first note of each group; wrapped only when too wide.
            // Not for the group the box's own heading already names.
            if (o.groupHeadings && entry.group !== lastGroup) {
                if (lastGroup) top += setup.groupGapMm;
                const named = !!o.headingGroupId && entry.group.Group__Id === o.headingGroupId;
                const label = String(entry.group.Group__Title || entry.group.Group__Prefix).toUpperCase();
                if (!named) Na__LeMarginCol__HeadingLines(label, bodyMm, inner, setup.headingTrackingMm / 2).forEach((line) => {
                    runs.push({ text : line, x : left, baselineY : top + (bodyMm * cap), fontMm : bodyMm, weight : 'bold', colour : style.mutedTextColour, trackingMm : setup.headingTrackingMm / 2 });
                    top += bodyGap;
                });
            }

            const title     = String(entry.note.Note__Title == null ? '' : entry.note.Note__Title).trim();
            const prefix    = title ? (String(entry.code) + pipe) : String(entry.code);
            const prefixW   = Na__LeChrome__MeasureTextMm(prefix, titleMm, 'bold');
            const titleW    = Math.max(1, inner - (title ? prefixW : 0));
            const titleLines = title ? Na__LeMarginCol__Wrap(title, titleMm, 'bold', titleW) : [];
            const bodyLines  = Na__LeMarginCol__Wrap(entry.note.Note__Body, bodyMm, 'normal', inner);
            let baseline     = top + (titleMm * cap);
            if (titleLines.length) {
                runs.push({ text : prefix + titleLines[0], x : left, baselineY : baseline, fontMm : titleMm, weight : 'bold', colour : style.inkColour, trackingMm : 0 });
                titleLines.slice(1).forEach((line) => {
                    baseline += titleGap;
                    runs.push({ text : line, x : left + prefixW, baselineY : baseline, fontMm : titleMm, weight : 'bold', colour : style.inkColour, trackingMm : 0 });
                });
            } else {
                runs.push({ text : prefix, x : left, baselineY : baseline, fontMm : titleMm, weight : 'bold', colour : style.inkColour, trackingMm : 0 });
            }
            let bottomOfNote = baseline + (titleMm * Na__LeMarginCol__DESCENT);
            if (bodyLines.length) {
                let bodyBaseline = baseline + bodyGap;
                bodyLines.forEach((line, k) => {
                    if (k > 0) bodyBaseline += bodyGap;
                    if (line !== '') runs.push({ text : line, x : left, baselineY : bodyBaseline, fontMm : bodyMm, weight : 'normal', colour : style.inkColour, trackingMm : 0 });
                });
                bottomOfNote = bodyBaseline + (bodyMm * Na__LeMarginCol__DESCENT);
            }

            // OVERFLOW | The first note that would cross the foot ends the list, so the order holds
            if (bottomOfNote > bottom) { plan.overflow = list.length - i; break; }
            laid.push({ runs : runs, ruleY : (plan.shown > 0 && setup.noteGapMm > 0) ? y - (setup.noteGapMm / 2) : null });
            plan.shown++;
            lastGroup = entry.group;
            lastFoot  = bottomOfNote;
            y = bottomOfNote + setup.noteGapMm;
        }

        // SPACING | Room left at the foot opens every gap by the same amount,
        // up to NoteGapMaxMm. Only a box whose notes all fit stretches, and
        // what fits was decided at the least gap, so a stretch never pushes a
        // note out. Each rule stays centred in its gap.
        // ------------------------------------
        const most  = Number.isFinite(setup.noteGapMaxMm) ? setup.noteGapMaxMm : setup.noteGapMm; // <-- A config without the key keeps the least
        const gaps  = laid.length - 1;
        const extra = (gaps > 0 && plan.overflow === 0) ? Math.max(0, Math.min(most - setup.noteGapMm, (bottom - lastFoot) / gaps)) : 0;
        plan.noteGapMm = setup.noteGapMm + extra;
        laid.forEach((note, n) => {
            const shift = extra * n;
            if (note.ruleY !== null) {
                const ruleY = note.ruleY + shift - (extra / 2);
                plan.rules.push({ X1 : left, Y1 : ruleY, X2 : right, Y2 : ruleY });
            }
            note.runs.forEach((run) => { run.baselineY += shift; plan.runs.push(run); });
        });
        return plan;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Specification Margin Column API
    // ------------------------------------------------------------
    export {
        Na__LeMarginCol__Wrap,
        Na__LeMarginCol__Lay
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
