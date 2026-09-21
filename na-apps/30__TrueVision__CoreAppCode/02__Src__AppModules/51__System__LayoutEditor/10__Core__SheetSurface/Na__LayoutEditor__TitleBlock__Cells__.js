// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - TITLE BLOCK CELLS
// =============================================================================
//
// FILE       : Na__LayoutEditor__TitleBlock__Cells__.js
// NAMESPACE  : Na__LeTitleCells
// MODULE     : Layout Editor - Title Block Cells
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Solve how wide each cell of the modern title block strip is
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - The strip used to be cut into relative shares, so every cell grew with the
//   paper: on A2 the Client cell was 76 mm for "Mr P. Samra", the Document ID
//   71 mm for a twelve character code, and the Drawing Title - the one value
//   that is ever long - was cut off at 92 mm. Adam, 19-Sep-2026: "there are
//   certain fields that are never going to need more size, so they kind of seem
//   needlessly oversized... The one thing that does need the space is the
//   drawing name."
// - A CELL NOW HAS A WIDTH IN PAPER MILLIMETRES, the same on every paper, the
//   way the logo already is. A cell with a Flex weight takes what the paper
//   has left over; the Drawing Title is the one that ships with it.
// - NO VALUE IS CUT OFF WHILE ANOTHER CELL HAS ROOM TO SPARE. A cell whose text
//   will not fit grows: out of the paper's spare room first, which costs no
//   other cell anything, and only then out of the room other cells are not
//   using, in proportion to how much each has. A pack whose values fit their
//   cells therefore has its dividers in the same place on every sheet, and
//   they only move on the sheet that needs them to.
// - ON PAPER TOO NARROW FOR THE STRIP the sacrifices are made in order. First
//   every cell gives up the room its own text is not using, so an A4 sheet
//   loses the air in its Rev cell before anything is cut. Then THE CELL THAT
//   TAKES THE SPARE ROOM IS THE ONE THAT GIVES IT BACK: the Drawing Title is
//   cut, down to the width of its own label, before any other value is
//   touched - a title cut short still says what the drawing is, where a date
//   or a scale cut short says something false. Only when that is not enough
//   is the whole strip scaled.
//
// INTEGRATION:
// - Called by Na__LeTitleModern__Build, which measures each cell's label and
//   value and hands the numbers in.
// - Imports nothing: numbers in, numbers out. It runs in Node exactly as the
//   app runs it (80__Testing__PrototypeEnvironment/Na__Test__TitleBlockCells__.test.mjs).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : ported verbatim on 20-Sep-2026, this version.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.2.0
// - Widen: every cell but the Flex ones made wider by a factor, which is how
//   A2 and A1 give the small cells more air (Adam, 21-Sep-2026: "20% more
//   space" for the address and each box on the right, the drawing title
//   excepted). THE EXTRA IS PAID ONLY OUT OF THE ROOM THE FLEX CELLS HAVE
//   SPARE past their own text, so it can never cut the drawing title: where
//   the paper cannot afford the whole of it (A2 portrait) each cell gets the
//   same smaller share of it, down to none.
//
// 20-Sep-2026 - Version 1.1.0
// - FIXED. On a strip too narrow even for its cells' text, the Flex cells are
//   cut first, down to a floor (the cell's label), and the lot is scaled only
//   if that is not enough. Until now the scaling came straight after the slack
//   ran out, so EVERY value lost its end together - the date and the drawing
//   number as well as the title. Found by the QR cell's session, whose cell
//   narrowed an A4 strip far enough to reach it. Cell takes a third argument,
//   floorMm; a caller that gives none lets a Flex cell be cut to nothing.
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Width of a Row That Gives None, and the Float Tolerance
    // ------------------------------------------------------------
    const Na__LeTitleCells__DEFAULT_MM = 28;                                     // <-- A row with no WidthMm at all: the strip's own small-cell module
    const Na__LeTitleCells__EPSILON    = 1e-6;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Number Above Zero, or a Fallback
    // ------------------------------------------------------------
    function Na__LeTitleCells__Positive(value, fallback) {
        return (typeof value === 'number' && Number.isFinite(value) && value > 0) ? value : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Sum of a List of Numbers
    // ------------------------------------------------------------
    function Na__LeTitleCells__Sum(list) {
        let total = 0;
        for (let i = 0; i < list.length; i++) total += list[i];
        return total;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Read a Config Row Into the Numbers the Solver Works On
    // ------------------------------------------------------------
    // row: { Key, Label, WidthMm, Flex }. WidthMm is the cell's width in paper
    // millimetres - for a Flex row, the least it is given while the paper has
    // room. needMm is what the cell's own text asks for, padding included: the
    // wider of its label and its value. floorMm is the least a Flex cell may
    // be cut to on paper too narrow for the strip - its label with its padding,
    // so a cell is never cut past saying what it is. Without one a Flex cell
    // can be cut to nothing before any other cell is touched.
    // ------------------------------------------------------------
    function Na__LeTitleCells__Cell(row, needMm, floorMm) {
        const source = (row && typeof row === 'object') ? row : {};
        return {
            base  : Na__LeTitleCells__Positive(source.WidthMm, Na__LeTitleCells__DEFAULT_MM),
            flex  : Na__LeTitleCells__Positive(source.Flex, 0),
            need  : Na__LeTitleCells__Positive(needMm, 0),
            floor : Na__LeTitleCells__Positive(floorMm, 0)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Widen Every Cell but the Flex Ones, Out of the Room the Paper Has Spare
    // ------------------------------------------------------------
    // cells as Cell makes them; factor 1.2 asks for a fifth more on every
    // fixed cell. Returns new cells for Solve, the inputs untouched.
    //
    // A FIFTH MORE THAN THE CELL HAS, NOT THAN ITS BASE. A cell whose text
    // has already grown it past its base - RB05's site address runs to 84 mm
    // of a 70 mm base - is widened from what it prints at, or the one cell
    // that most needed the air would get none (70 x 1.2 is 84 again).
    //
    // The extra comes out of what the strip has left once EVERY cell has the
    // wider of its base and its text - the Flex cells' included - so the
    // drawing title keeps every character it had and at least its own base.
    // When that room is less than the extra asked for, every fixed cell gets
    // the same fraction of its extra, so the cells keep their proportions to
    // one another. A factor of 1 or less, or no room, changes nothing.
    // ------------------------------------------------------------
    function Na__LeTitleCells__Widen(stripWidthMm, cells, factor) {
        const list   = Array.isArray(cells) ? cells : [];
        const copy   = list.map((cell) => Object.assign({}, cell));
        const scale  = Na__LeTitleCells__Positive(factor, 1);
        const strip  = Na__LeTitleCells__Positive(stripWidthMm, 0);
        if (scale <= 1 || strip === 0 || copy.length === 0) return copy;

        const holds    = copy.map((cell) => Math.max(cell.base, cell.need));  // <-- What each cell prints at before the extra: its base, or its text where that is wider
        const extra    = copy.map((cell, i) => (cell.flex > 0) ? 0 : holds[i] * (scale - 1));
        const extraSum = Na__LeTitleCells__Sum(extra);
        const room     = Math.max(0, strip - Na__LeTitleCells__Sum(holds));
        const share    = (extraSum > 0) ? Math.min(1, room / extraSum) : 0;
        if (share <= 0) return copy;                                          // <-- Nothing to spare: the strip is solved exactly as it always was
        copy.forEach((cell, i) => { if (!(cell.flex > 0)) cell.base = holds[i] + (extra[i] * share); });
        return copy;
    }
    // ------------------------------------------------------------


    // FUNCTION | Solve the Width of Every Cell Across a Strip
    // ------------------------------------------------------------
    // cells: [ { base, flex, need, floor } ], left to right. Returns one width
    // per cell, summing to stripWidthMm.
    //
    // 1. Every cell starts at its base.
    // 2. PAPER TO SPARE. A cell whose text overruns its base is made whole out
    //    of the spare room first, and what is left goes to the Flex cells by
    //    weight. With no Flex cell at all the spare is shared in proportion to
    //    the bases, which is exactly how the strip was cut before this module:
    //    a config written for the old shares still draws the old strip.
    // 3. STILL SHORT, OR THE STRIP OVERFULL. The room other cells are not using
    //    is taken, in proportion to how much each has. The strip's own excess
    //    is paid first - the cells must fit the paper - and the rest goes to
    //    the cells that are short, in proportion to what each is short by.
    // 4. STILL OVERFULL. Every cell is down to its text and the strip is still
    //    too wide for the paper, so something has to be cut. The Flex cells go
    //    first, down to their floors: the cell that takes the spare room is the
    //    one that gives it back, and it is the prose on the strip - a title cut
    //    short still says what the drawing is, where a date, a scale or a
    //    drawing number cut short says something false.
    // 5. NOTHING LEFT TO GIVE. The lot is scaled to fit.
    // ------------------------------------------------------------
    function Na__LeTitleCells__Solve(stripWidthMm, cells) {
        const list  = Array.isArray(cells) ? cells : [];
        const strip = Na__LeTitleCells__Positive(stripWidthMm, 0);
        if (list.length === 0) return [];
        if (strip === 0) return list.map(() => 0);

        const widths = list.map((cell) => cell.base);
        const bases  = Na__LeTitleCells__Sum(widths);

        // PAPER TO SPARE | Overruns first, then the Flex cells
        let spare = strip - bases;
        if (spare > 0) {
            const over    = list.map((cell, i) => Math.max(0, cell.need - widths[i]));
            const overSum = Na__LeTitleCells__Sum(over);
            if (overSum > 0) {
                const grant = Math.min(spare, overSum);
                over.forEach((mm, i) => { widths[i] += (mm / overSum) * grant; });
                spare -= grant;
            }
            if (spare > 0) {
                const flexSum = Na__LeTitleCells__Sum(list.map((cell) => cell.flex));
                if (flexSum > 0) list.forEach((cell, i) => { widths[i] += (cell.flex / flexSum) * spare; });
                else             list.forEach((cell, i) => { widths[i] += (cell.base / bases) * spare; });   // <-- No Flex cell: shares, as the strip always was
            }
        }

        // STILL SHORT, OR OVERFULL | Take the room other cells are not using
        const short    = list.map((cell, i) => Math.max(0, cell.need - widths[i]));
        const slack    = list.map((cell, i) => Math.max(0, widths[i] - cell.need));
        const excess   = Math.max(0, Na__LeTitleCells__Sum(widths) - strip);
        const shortSum = Na__LeTitleCells__Sum(short);
        const slackSum = Na__LeTitleCells__Sum(slack);
        const take     = Math.min(excess + shortSum, slackSum);
        if (take > Na__LeTitleCells__EPSILON) {
            slack.forEach((mm, i) => { widths[i] -= (mm / slackSum) * take; });
            const toShort = Math.max(0, take - excess);                          // <-- The paper is paid before any cell is
            if (toShort > 0 && shortSum > 0) short.forEach((mm, i) => { widths[i] += (mm / shortSum) * toShort; });
        }

        // STILL OVERFULL | The Flex cells are cut first, down to their floors
        // Only reached with every cell already down to its text. Before this
        // step the whole strip was scaled here, which cut the date, the scale
        // and the drawing number along with the title - found by the QR cell's
        // session on an A4 strip narrowed by its cell, 20-Sep-2026.
        const overfull = Na__LeTitleCells__Sum(widths) - strip;
        if (overfull > Na__LeTitleCells__EPSILON) {
            const give    = list.map((cell, i) => (cell.flex > 0) ? Math.max(0, widths[i] - cell.floor) : 0);
            const giveSum = Na__LeTitleCells__Sum(give);
            if (giveSum > 0) {
                const cut = Math.min(overfull, giveSum);
                give.forEach((mm, i) => { widths[i] -= (mm / giveSum) * cut; });
            }
        }

        // NOTHING LEFT TO GIVE | Every cell is at its text, the Flex cells at their floors, and the strip is still too wide
        const settled = Na__LeTitleCells__Sum(widths);
        if (settled > strip + Na__LeTitleCells__EPSILON) {
            const ratio = strip / settled;
            for (let i = 0; i < widths.length; i++) widths[i] *= ratio;
        }
        return widths;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Title Block Cells API
    // ------------------------------------------------------------
    export {
        Na__LeTitleCells__Cell,
        Na__LeTitleCells__Widen,
        Na__LeTitleCells__Solve
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
