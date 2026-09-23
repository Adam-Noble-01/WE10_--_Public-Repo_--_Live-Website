// =============================================================================
// TRUEVISION3D - PUBLISHED DOCUMENTS - THE UNPUBLISHED MASK
// =============================================================================
//
// FILE       : Na__PubDoc__Unpublished__.js
// NAMESPACE  : Na__PubMask
// MODULE     : Published Documents - The Unpublished Mask
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw a real sheet with a grey drawing area and an honest sentence, and fetch nothing
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A KEY HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - THIS FILE IS THE GUARD, and it is the reason the whole system is safe. A
//   drawing that has not been published gets a REAL sheet - the right paper, the
//   right orientation, the title block filled in from the index entry - and then
//   a grey panel over the drawing area saying so.
// - IT FETCHES NOTHING AND COMPUTES NOTHING. No manifest, no element file, no
//   raster, no linework, and above all no renderer. Every fact it needs is
//   already in the project index, which the reader downloaded once.
// - WHY A REAL SHEET RATHER THAN A MESSAGE. A client who taps a drawing tab and
//   gets a blank page cannot tell that from a broken app. A client who gets the
//   right sheet with the right number and a sentence explaining that this one is
//   not issued yet has been told something true, and can say which drawing they
//   were looking for.
// - IT ALSO CARRIES THE BROKEN CASE: a document whose manifest names a file that
//   cannot be fetched, or whose schema this build refuses. The reason string from
//   the version gate is put on the sheet, so "why is this drawing blank" is
//   answerable by looking at it.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Created with Phase 3 of TrueVision__PLAN__PublishingSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import {
        Na__PubPaint__Sink, Na__PubPaint__Done, Na__PubPaint__Group, Na__PubPaint__GroupEnd,
        Na__PubPaint__Rect, Na__PubPaint__Text
    } from './Na__PubDoc__Paint__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants - the Built-In Wording
// -----------------------------------------------------------------------------

    const Na__PubMask__F = {
        FillColour    : '#e9ebec',
        FillOpacity   : 1,
        EdgeColour    : '#c8ccce',
        EdgePt        : 0.5,
        TextColour    : '#6b7478',
        HeadingSizeMm : 6,
        BodySizeMm    : 3,
        Heading       : 'Drawing has not yet been published officially',
        Body          : 'It is drawn but has not been issued for viewing. The sheet, its number and its title block are correct; the drawing itself will appear here once it is published.',
        BrokenHeading : 'This drawing could not be loaded',
        BrokenBody    : 'Part of the published drawing is missing or is from a different version of the app. Nothing has been drawn rather than a drawing you could not trust.',
        ReasonPrefix  : 'Reason: ',
        ShowReason    : true
    };

    const Na__PubMask__WRAP_CHARS_PER_MM = 0.42;                                  // <-- Rough, and only ever used on this module's own sentences

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Wording
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Fold the Reader Config Onto the Built-In Wording
    // ------------------------------------------------------------
    function Na__PubMask__Setup(block) {
        const setup = Object.assign({}, Na__PubMask__F);
        if (!block || typeof block !== 'object') return setup;
        const map = {
            FillColour : 'Unpublished__FillColour', FillOpacity : 'Unpublished__FillOpacity',
            EdgeColour : 'Unpublished__EdgeColour', EdgePt : 'Unpublished__EdgePt',
            TextColour : 'Unpublished__TextColour', HeadingSizeMm : 'Unpublished__HeadingSizeMm',
            BodySizeMm : 'Unpublished__BodySizeMm', Heading : 'Unpublished__Heading',
            Body : 'Unpublished__Body', BrokenHeading : 'Unpublished__BrokenHeading',
            BrokenBody : 'Unpublished__BrokenBody', ReasonPrefix : 'Unpublished__ReasonPrefix',
            ShowReason : 'Unpublished__ShowReason'
        };
        Object.keys(map).forEach((key) => {
            const value = block[map[key]];
            if (value !== undefined && value !== null && value !== '') setup[key] = value;
        });
        return setup;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Break One of This Module's Own Sentences to a Width
    // ------------------------------------------------------------
    // The ONLY text wrapping anywhere in the reader, and it is allowed here for
    // one reason: these sentences are this module's own, not a published
    // document's. Every word that came out of a drawing arrives already broken
    // into the lines it prints.
    // ------------------------------------------------------------
    function Na__PubMask__Wrap(text, widthMm, sizeMm) {
        const perLine = Math.max(16, Math.floor(widthMm * Na__PubMask__WRAP_CHARS_PER_MM * (2.6 / Math.max(1, sizeMm))));
        const words   = String(text == null ? '' : text).split(/\s+/).filter(Boolean);
        const lines   = [];
        let   line    = '';
        for (const word of words) {
            if (line === '') line = word;
            else if ((line.length + 1 + word.length) <= perLine) line += ' ' + word;
            else { lines.push(line); line = word; }
        }
        if (line !== '') lines.push(line);
        return lines;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Mask
// -----------------------------------------------------------------------------

    // FUNCTION | The Grey Panel and Its Sentence, Over a Sheet's Drawing Area
    // ------------------------------------------------------------
    // area   : { XMm, YMm, WidthMm, HeightMm } - the sheet's drawing area
    // state  : 'unpublished' | 'broken'
    // reason : the version gate's or the fetch's own words, or null
    // ------------------------------------------------------------
    function Na__PubMask__Paint(area, state, reason, config) {
        const setup  = Na__PubMask__Setup(config);
        const broken = String(state) === 'broken';
        const sink   = Na__PubPaint__Sink();

        const x = Number(area && area.XMm) || 0;
        const y = Number(area && area.YMm) || 0;
        const w = Number(area && area.WidthMm) || 0;
        const h = Number(area && area.HeightMm) || 0;
        if (w <= 0 || h <= 0) return '';

        Na__PubPaint__Group(sink, {
            Class : 'na-pubdoc__mask na-pubdoc__mask--' + (broken ? 'broken' : 'unpublished'),
            Kind  : 'mask'
        });

        Na__PubPaint__Rect(sink, x, y, w, h, {
            FillColour   : setup.FillColour,
            FillOpacity  : setup.FillOpacity,
            StrokeColour : setup.EdgeColour,
            StrokePt     : setup.EdgePt,
            Class        : 'na-pubdoc__mask-panel'
        });

        const heading   = broken ? setup.BrokenHeading : setup.Heading;
        const body      = broken ? setup.BrokenBody    : setup.Body;
        const bodyWidth = Math.min(w * 0.7, 190);
        const bodyLines = Na__PubMask__Wrap(body, bodyWidth, setup.BodySizeMm);
        const showWhy   = broken && setup.ShowReason && reason;
        const whyLines  = showWhy ? Na__PubMask__Wrap(setup.ReasonPrefix + reason, bodyWidth, setup.BodySizeMm * 0.8) : [];

        // Centred as a block: the heading, the body, then the reason.
        const headHeight = Number(setup.HeadingSizeMm) * 1.3;
        const bodyLead   = Number(setup.BodySizeMm) * 1.45;
        const whyLead    = Number(setup.BodySizeMm) * 0.8 * 1.45;
        const total      = headHeight + (bodyLines.length * bodyLead) + (whyLines.length ? (bodyLead + whyLines.length * whyLead) : 0);
        let   at          = y + (h - total) / 2 + Number(setup.HeadingSizeMm);

        Na__PubPaint__Text(sink, x + w / 2, at, [ heading ], {
            Class      : 'na-pubdoc__mask-heading',
            SizeMm     : setup.HeadingSizeMm,
            FontWeight : 600,
            Colour     : setup.TextColour,
            Align      : 'centre'
        });
        at += headHeight;

        if (bodyLines.length > 0) {
            Na__PubPaint__Text(sink, x + w / 2, at, bodyLines, {
                Class     : 'na-pubdoc__mask-body',
                SizeMm    : setup.BodySizeMm,
                LeadingMm : bodyLead,
                Colour    : setup.TextColour,
                Align     : 'centre'
            });
            at += bodyLines.length * bodyLead;
        }

        if (whyLines.length > 0) {
            Na__PubPaint__Text(sink, x + w / 2, at + bodyLead, whyLines, {
                Class     : 'na-pubdoc__mask-reason',
                SizeMm    : Number(setup.BodySizeMm) * 0.8,
                LeadingMm : whyLead,
                Colour    : setup.TextColour,
                Align     : 'centre'
            });
        }

        Na__PubPaint__GroupEnd(sink);
        return Na__PubPaint__Done(sink);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubMask__Paint
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
