// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PARAMETRIC SCRAPBOOK - PROJECT PORTAL
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookParametric__ProjectQr__.js
// NAMESPACE  : Na__LeParamQr
// MODULE     : Layout Editor - Parametric Scrapbook - Project Portal QR Block
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The block that invites the person holding a drawing to scan it - the project's own QR code, a Scan Me button, and the few lines that make them want to
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - A DRAWING IS A PIECE OF PAPER AND THE MODEL IS A BUILDING. The title
//   block already carries the project's code in an 8.8 mm square, which is
//   enough for somebody who already knows to look for it. This element is for
//   somebody who does not: a code big enough to see across a table, a button
//   that says to scan it, and four lines saying what happens when they do.
// - TWO FORMS, ONE TYPE. COMPACT is a column - code, button, caption, heading,
//   bullets - for the edge of a sheet. FULL stands that column beside a
//   heading and a paragraph, for a cover sheet or a presentation drawing.
//   They are two presets of this one type and the lookup grip swaps between
//   them, because they are the same block with more or less said.
// - THE CODE IS THE PROJECT'S OWN, AND IS NEVER BUILT HERE. The box is one
//   ordinary vector carrying a Shape__Qr block, which the shape painter fills
//   with whatever symbol the Project QR Code system answers for the project on
//   screen - so a block dragged in shows this project's code, a block copied
//   to another project shows that one's, and this module, which must stay
//   pure, never encodes anything. One record, not one per module.
// - THE CODE'S SIZE IS THE PARAMETER. 20 mm as shipped, and the lookup grip
//   offers the rest of the list. Everything drawn round the code is set in
//   paper millimetres and does NOT scale with it: type on a drawing is house
//   sizes or it is wrong, and a 20 mm code with 1.8 mm bullets under it would
//   be a block nobody could read pointing at a code everybody could.
// - THE MARGIN ROUND THE CODE IS A FRACTION OF IT, not a millimetre count,
//   which is what keeps the clear zone at the two modules the QR system asks
//   for whatever size the code is drawn at (0.07 x 29 modules = 2.03). The
//   painter reports the printed size to that system's own check, so a size
//   that would not scan says so on the console.
// - THE PROJECT NAME IS A FACT, NOT TYPING, and is read through the tools the
//   engine hands a type - live, so renaming the project rewrites the block.
//   A name typed into the panel wins and stops it following, the way a drawing
//   title's typed text does. With no way to ask - under Node, or before the
//   project has loaded - it reads {{Project}}, the placeholder idiom.
//
// INTEGRATION:
// - Registered by Na__LayoutEditor__Panel__ScrapbookParametric__ with a reader
//   for the config's ProjectQr block.
// - PURE: no DOM, no editor modules, no imports at all. Parameters in, records
//   out, in paper millimetres from an origin of (0, 0) at the code box's top
//   left corner. Whatever it cannot reach arrives in `tools`.
// - The Shape__Qr block it writes is painted by 15__Core__Markup/
//   Na__LayoutEditor__ShapeGeometry__, which is what knows the Project QR Code
//   system. // @delegate: ../53__Feature__ProjectQrCode/Na__ProjectQr__Symbol__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported. It needs Shape__Qr in the record layer and
//                   the shape painter, and a Project QR Code system of its own.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.3.0
// - A block dropped from the Scrapbook is 20 mm, not 30 (Adam, 21-Sep-2026),
//   and its type is smaller to suit: the body text - the full form's
//   paragraph and both forms' bullets - 2.2 mm (was 3.1 and 2.7), the
//   "Use your phone or tablet camera" caption 1.5 (was 2.1). The gaps and
//   pitches round them were re-set against a rendering at 20 mm so the air
//   between lines stays about what it was. A block already placed keeps its
//   size; its type follows on its next rebuild.
//
// 21-Sep-2026 - Version 1.2.0
// - The handset in the Scan Me button is a modern smartphone: a slimmer,
//   taller body (4.6 mm, was 4.0) with rounder corners and a filled Dynamic
//   Island pill at the top, in place of the bar across the foot of a squat
//   box that did not read as a phone. Still two records, in the same slots.
//
// 21-Sep-2026 - Version 1.1.0
// - The type is set properly. Every gap in this block is a BASELINE TO
//   BASELINE distance, and the first numbers were chosen as though they were
//   the space between two lines - so each line sat on the descenders of the
//   one above it, worst under the full form's 5.4 mm title where the project
//   name had no air at all. Re-set against a rendering of both forms with the
//   real Open Sans cuts, and the title now has a gap of its own
//   (TitleNameGapMm) because one number cannot serve a 3.5 mm heading and a
//   5.4 mm title at once.
// - The caption is ranged LEFT with the rest of the column instead of being
//   centred on the code box: the wording is a fixed width and the box is not,
//   so centring hung it over both edges at any size under 25 mm and moved the
//   block's own left edge with the code size.
// - The size list is 15, 20, 25, 30. A block already set to 40 or 50 keeps it.
// - The block's height runs to the foot of its last line rather than to that
//   line's baseline.
//
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the two forms, the size list, the Scan Me button,
//   the wrapped paragraph and the grips.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Type, What a Resize Leaves Alone, and the Two Forms
    // ------------------------------------------------------------
    const Na__LeParamQr__TYPE         = 'ProjectQr';
    const Na__LeParamQr__FORM_COMPACT = 'compact';
    const Na__LeParamQr__FORM_FULL    = 'full';
    const Na__LeParamQr__FORMS        = Object.freeze([ Na__LeParamQr__FORM_COMPACT, Na__LeParamQr__FORM_FULL ]);
    const Na__LeParamQr__KEEP         = Object.freeze([ 'SizeMm', 'Form', 'BodyWidthMm', 'ProjectName' ]);
    const Na__LeParamQr__MAX_NAME     = 80;
    const Na__LeParamQr__NAME_MISSING = '{{Project}}';                       // <-- The placeholder idiom: a fact not yet known is shown in double braces, never guessed
    const Na__LeParamQr__DESCENDER    = 0.24;                                // <-- How far Open Sans hangs below the baseline, as a fraction of the size: what the block's height owes its last line
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What Every Value Falls Back To
    // ------------------------------------------------------------
    // Mirrors the shipped config block, so a config that could not be read
    // draws the shipped block rather than nothing.
    // ------------------------------------------------------------
    const Na__LeParamQr__FALLBACK = Object.freeze({
        SizeMm              : 20,
        SizeMinMm           : 15,
        SizeMaxMm           : 120,
        MarginFraction      : 0.07,
        BoxColour           : '#858585',
        BoxStrokePt         : 0.7,

        ButtonGapMm         : 2.6,
        ButtonHeightMm      : 7.0,
        ButtonPadMm         : 2.6,
        ButtonColour        : '#858585',
        ButtonStrokePt      : 0.7,
        ButtonTextSizeMm    : 3.2,
        ButtonTextWeight    : 600,
        ButtonTextColour    : '#172b3a',
        ButtonIconWidthMm   : 2.4,
        ButtonIconHeightMm  : 4.6,
        ButtonIconGapMm     : 2.0,
        ButtonIconStrokePt  : 0.6,

        CaptionGapMm        : 2.8,
        CaptionSizeMm       : 1.5,
        CaptionWeight       : 400,
        CaptionColour       : '#5f6b74',

        HeadingGapMm        : 6.2,
        HeadingSizeMm       : 3.5,
        HeadingWeight       : 600,
        HeadingColour       : '#172b3a',

        NameGapMm           : 4.4,
        NameSizeMm          : 2.4,
        NameWeight          : 400,
        NameColour          : '#5f6b74',

        BulletsGapMm        : 5.0,
        BulletSizeMm        : 2.2,
        BulletWeight        : 400,
        BulletColour        : '#5f6b74',
        BulletPitchMm       : 3.6,
        BulletMark          : '·   ',

        ColumnGapMm         : 11,
        TitleSizeMm         : 5.4,
        TitleWeight         : 600,
        TitleColour         : '#172b3a',
        TitleBaselineMm     : 4.6,
        TitleNameGapMm      : 5.8,
        BodyGapMm           : 4.6,
        BodySizeMm          : 2.2,
        BodyWeight          : 400,
        BodyColour          : '#5f6b74',
        BodyPitchMm         : 3.4,
        BodyWidthMm         : 95,
        BodyWidthMinMm      : 45,
        BodyWidthMaxMm      : 260,
        BodyWidthStepMm     : 5,

        ButtonText          : 'Scan Me',
        CaptionText         : 'Use your phone or tablet camera',
        HeadingText         : 'View Project Portal',
        TitleText           : 'Project Portal',
        BodyText            : 'Point your phone or tablet camera at the code and the whole building opens in 3D. Walk through it at full size, step between the saved views and scenes, measure anything you like, and read every drawing live online. Nothing to download - it opens straight in your browser.',
        Bullets             : [ 'Walk Through the 3D Model', 'Saved Scenes and Viewpoints', 'Measuring Tools', 'Live Drawings Online' ],
        SizeChoicesMm       : [ 15, 20, 25, 30 ]
    });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config Readers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Value of the ProjectQr Block, or Its Fallback
    // ------------------------------------------------------------
    function Na__LeParamQr__Number(config, key) {
        const value = config ? config['ProjectQr__' + key] : undefined;
        return (typeof value === 'number' && Number.isFinite(value)) ? value : Na__LeParamQr__FALLBACK[key];
    }
    function Na__LeParamQr__Text(config, key) {
        const value = config ? config['ProjectQr__' + key] : undefined;
        return (typeof value === 'string' && value !== '') ? value : Na__LeParamQr__FALLBACK[key];
    }
    function Na__LeParamQr__List(config, key) {
        const value = config ? config['ProjectQr__' + key] : undefined;
        return Array.isArray(value) ? value.slice() : Na__LeParamQr__FALLBACK[key].slice();
    }
    // ------------------------------------------------------------


    // FUNCTION | The Code Sizes the Lookup Grip and the Panel Offer
    // ------------------------------------------------------------
    // Sorted, deduplicated and held inside the type's limits, so a config
    // that lists a size twice, out of order, or beyond what a sheet could
    // carry still offers a sensible menu.
    // ------------------------------------------------------------
    function Na__LeParamQr__SizeChoices(config) {
        const least = Na__LeParamQr__Number(config, 'SizeMinMm');
        const most  = Math.max(least, Na__LeParamQr__Number(config, 'SizeMaxMm'));
        const seen  = [];
        Na__LeParamQr__List(config, 'SizeChoicesMm').forEach((value) => {
            const size = Number(value);
            if (!Number.isFinite(size) || size < least || size > most) return;
            if (seen.indexOf(size) === -1) seen.push(size);
        });
        seen.sort((a, b) => a - b);
        return seen.length ? seen : [ Na__LeParamQr__Number(config, 'SizeMm') ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Parameters
// -----------------------------------------------------------------------------

    // FUNCTION | The Standard Block
    // ------------------------------------------------------------
    // No scale in it anywhere: a QR code is the size it is printed, not the
    // size a drawing is drawn at, so this type takes no ScaleDenominator and
    // is never put back to a standard by a change of one.
    // ------------------------------------------------------------
    function Na__LeParamQr__Standard(config) {
        return {
            SizeMm      : Na__LeParamQr__Number(config, 'SizeMm'),
            Form        : Na__LeParamQr__FORM_COMPACT,
            BodyWidthMm : Na__LeParamQr__Number(config, 'BodyWidthMm'),
            ProjectName : ''
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Parameters Made Whole and Held Inside Their Limits
    // ------------------------------------------------------------
    // The size is kept to a tenth of a millimetre and the body width to a
    // tenth too, so a rebuild writes the same number it wrote last time and
    // an element let go with Escape leaves the sheet as it found it.
    // ------------------------------------------------------------
    function Na__LeParamQr__Normalise(config, params) {
        const given    = (params && typeof params === 'object') ? params : {};
        const standard = Na__LeParamQr__Standard(config);
        const least    = Math.max(1, Na__LeParamQr__Number(config, 'SizeMinMm'));
        const most     = Math.max(least, Na__LeParamQr__Number(config, 'SizeMaxMm'));
        const size     = (typeof given.SizeMm === 'number' && Number.isFinite(given.SizeMm)) ? given.SizeMm : standard.SizeMm;
        const narrow   = Math.max(1, Na__LeParamQr__Number(config, 'BodyWidthMinMm'));
        const wide     = Math.max(narrow, Na__LeParamQr__Number(config, 'BodyWidthMaxMm'));
        const body     = (typeof given.BodyWidthMm === 'number' && Number.isFinite(given.BodyWidthMm)) ? given.BodyWidthMm : standard.BodyWidthMm;
        return {
            SizeMm      : Math.round(Math.min(most, Math.max(least, size)) * 10) / 10,
            Form        : (Na__LeParamQr__FORMS.indexOf(given.Form) !== -1) ? given.Form : standard.Form,
            BodyWidthMm : Math.round(Math.min(wide, Math.max(narrow, body)) * 10) / 10,
            ProjectName : (typeof given.ProjectName === 'string') ? given.ProjectName.replace(/\s+/g, ' ').trim().slice(0, Na__LeParamQr__MAX_NAME) : ''
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Block Calls the Project: { text, resolved }
    // ------------------------------------------------------------
    // A name typed into the panel wins and stops the block following the
    // project, exactly as a drawing title's typed text does; clearing the box
    // puts it back. Otherwise it is asked for through the tools, which is
    // live: rename the project and the block rewrites itself. With no way to
    // ask - under Node, or before the project data has landed - it reads
    // {{Project}} and says it is not resolved, so the panel can explain why.
    // ------------------------------------------------------------
    function Na__LeParamQr__ProjectText(config, params, tools) {
        const whole = Na__LeParamQr__Normalise(config, params);
        if (whole.ProjectName !== '') return { text : whole.ProjectName, resolved : true, typed : true };
        let told = '';
        if (tools && typeof tools.projectName === 'function') {
            try { told = String(tools.projectName() || '').replace(/\s+/g, ' ').trim(); } catch (error) { told = ''; }
        }
        if (told === '') return { text : Na__LeParamQr__NAME_MISSING, resolved : false, typed : false };
        return { text : told.slice(0, Na__LeParamQr__MAX_NAME), resolved : true, typed : false };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Text Setting
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | How Wide a Run of Words Is on the Paper
    // ------------------------------------------------------------
    // Through the measurer the engine hands over - the editor's own, so a
    // line breaks in the same place on the screen as on paper. With none, an
    // estimate at the same 0.52 of the font size the chrome falls back to,
    // which is what keeps this module drawing under Node.
    // ------------------------------------------------------------
    function Na__LeParamQr__Measure(text, sizeMm, weight, tools) {
        const value = String(text === undefined || text === null ? '' : text);
        if (value === '') return 0;
        if (tools && typeof tools.measureTextMm === 'function') {
            try {
                const width = Number(tools.measureTextMm(value, sizeMm, weight));
                if (Number.isFinite(width) && width >= 0) return width;
            } catch (error) { /* fall through to the estimate */ }
        }
        return value.length * sizeMm * 0.52;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Wrap a Paragraph to a Paper Width
    // ------------------------------------------------------------
    // A plain greedy fill, measured word by word. A word longer than the
    // column gets a line of its own and runs over it rather than being cut:
    // this is sales copy on a drawing, and a word broken in half reads as a
    // fault where a slightly long line reads as a line.
    // ------------------------------------------------------------
    function Na__LeParamQr__Wrap(text, sizeMm, weight, widthMm, tools) {
        const words = String(text || '').split(/\s+/).filter((word) => word !== '');
        const lines = [];
        let   line  = '';
        if (!(widthMm > 0) || words.length === 0) return lines;
        words.forEach((word) => {
            const candidate = (line === '') ? word : line + ' ' + word;
            if (line !== '' && Na__LeParamQr__Measure(candidate, sizeMm, weight, tools) > widthMm) { lines.push(line); line = word; return; }
            line = candidate;
        });
        if (line !== '') lines.push(line);
        return lines;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Sizes the Block Is Drawn From, on the Paper
    // ------------------------------------------------------------
    // codeMm is the symbol edge to edge - the size the lookup grip sets and
    // the only thing that makes this element bigger or smaller. marginMm is
    // the clear paper it is owed inside its box, taken as a FRACTION of the
    // code so the clear zone stays the same number of modules at any size.
    // boxMm is the two together, which is the column the button lines up with.
    // ------------------------------------------------------------
    function Na__LeParamQr__Metrics(config, whole) {
        const codeMm   = whole.SizeMm;
        const fraction = Math.max(0, Na__LeParamQr__Number(config, 'MarginFraction'));
        const marginMm = Math.round(codeMm * fraction * 1000) / 1000;
        return { codeMm : codeMm, marginMm : marginMm, boxMm : Math.round((codeMm + (marginMm * 2)) * 1000) / 1000 };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Rounded Rectangle as a Closed Run of Points
    // ------------------------------------------------------------
    // The Scan Me button. A shape record holds points and nothing else, so
    // each corner is walked round in steps; a radius of half the height makes
    // the stadium Adam drew. Eight steps a corner is smooth at any print size
    // and is 32 points in the record, which is nothing.
    // ------------------------------------------------------------
    function Na__LeParamQr__RoundedRect(x, y, widthMm, heightMm, radiusMm) {
        const r     = Math.max(0, Math.min(radiusMm, widthMm / 2, heightMm / 2));
        const steps = 8;
        const out   = [];
        const arc   = (cx, cy, from) => {
            for (let i = 0; i <= steps; i++) {
                const angle = from + ((Math.PI / 2) * (i / steps));
                out.push([ cx + (Math.cos(angle) * r), cy + (Math.sin(angle) * r) ]);
            }
        };
        if (r <= 0) return [ [ x, y ], [ x + widthMm, y ], [ x + widthMm, y + heightMm ], [ x, y + heightMm ] ];
        arc(x + widthMm - r, y + r,             -Math.PI / 2);                // <-- Top right, clockwise from due north
        arc(x + widthMm - r, y + heightMm - r,   0);                          // <-- Bottom right
        arc(x + r,           y + heightMm - r,   Math.PI / 2);                // <-- Bottom left
        arc(x + r,           y + r,              Math.PI);                    // <-- Top left
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Phone Glyph Inside the Button
    // ------------------------------------------------------------
    // Two records: the handset, a slim rounded rectangle, and the Dynamic
    // Island - a filled pill across the top of the screen. Drawn from the top
    // left of its own box. It is what tells somebody who has never met a QR
    // code what the square beside it is for, which is the whole point of the
    // button.
    //
    // IT HAS TO READ AS THE PHONE IN THEIR POCKET. The first glyph was a
    // squat box with a bar across its foot, and at 4 mm that could as well
    // have been a door, a battery or a tablet (Adam, 21-Sep-2026: "a bit too
    // ambiguous"). A body about half as wide as it is tall, corners rounded
    // well past a rectangle's, and the pill at the top are the three things
    // every current phone shares. Every size in it is a fraction of the
    // width, so a wider or narrower handset in the config keeps its look.
    //
    // STILL TWO RECORDS, AND IN THE SAME ORDER, so a block already on a sheet
    // rebuilds into the slots it has. The pill writes every key the old bar
    // did, so nothing of the bar is left behind in the record.
    // ------------------------------------------------------------
    function Na__LeParamQr__PhoneGlyph(config, x, y, widthMm, heightMm) {
        const colour   = Na__LeParamQr__Text(config, 'ButtonTextColour');
        const strokePt = Na__LeParamQr__Number(config, 'ButtonIconStrokePt');
        const islandW  = widthMm * 0.42;
        const islandH  = widthMm * 0.15;
        return [
            { kind : 'shape', record : {
                Shape__Points       : Na__LeParamQr__RoundedRect(x, y, widthMm, heightMm, widthMm * 0.29),
                Shape__Closed       : true,
                Shape__Stroked      : true,
                Shape__StrokeColour : colour,
                Shape__StrokePt     : strokePt,
                Shape__FillColour   : null
            } },
            { kind : 'shape', record : {
                Shape__Points       : Na__LeParamQr__RoundedRect(x + ((widthMm - islandW) / 2), y + (widthMm * 0.18), islandW, islandH, islandH / 2),
                Shape__Closed       : true,
                Shape__Stroked      : false,                                  // <-- A solid pill, no rule round it: a 0.2 mm rule would swallow a 0.36 mm shape
                Shape__StrokeColour : colour,
                Shape__StrokePt     : strokePt,
                Shape__FillColour   : colour
            } }
        ];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Line of Text as a Record
    // ------------------------------------------------------------
    function Na__LeParamQr__TextRecord(text, x, baselineY, sizeMm, weight, colour, align) {
        return { kind : 'annotation', record : {
            Annotation__Text       : text,
            Annotation__PosXMm     : x,
            Annotation__PosYMm     : baselineY,
            Annotation__SizeMm     : sizeMm,
            Annotation__FontWeight : weight,
            Annotation__Colour     : colour,
            Annotation__Align      : align || 'left'
        } };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building the Block
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Left Column: the Code, the Button, the Caption, the Bullets
    // ------------------------------------------------------------
    // Returns { shapes, texts, widthMm, heightMm }, from an origin of (0, 0)
    // at the code box's top left corner. THE FIRST SHAPE IS THE CODE BOX AND
    // ITS FIRST POINT IS THAT ORIGIN, which is how the engine finds the block
    // again after it has been moved.
    //
    // withName says whether the project's name is lettered under this
    // column's heading: it is in the compact form, where this column IS the
    // block, and it is not in the full one, where the heading beside it
    // carries the name instead and saying it twice would read as a mistake.
    // ------------------------------------------------------------
    function Na__LeParamQr__BuildColumn(config, whole, metrics, named, tools) {
        const shapes = [];
        const texts  = [];

        // THE CODE | One record: a box with the project's symbol inside it
        shapes.push({ kind : 'shape', record : {
            Shape__Points       : [ [ 0, 0 ], [ metrics.boxMm, 0 ], [ metrics.boxMm, metrics.boxMm ], [ 0, metrics.boxMm ] ],
            Shape__Closed       : true,
            Shape__Stroked      : true,
            Shape__StrokeColour : Na__LeParamQr__Text(config, 'BoxColour'),
            Shape__StrokePt     : Na__LeParamQr__Number(config, 'BoxStrokePt'),
            Shape__FillColour   : null,
            Shape__Qr           : { Qr__MarginMm : metrics.marginMm }
        } });

        // THE BUTTON | A stadium the width of the box, with the handset and the
        // words centred in it as one pair, so the two move together when the
        // code is made bigger or the wording is changed.
        //
        // IT IS THE BOX'S WIDTH OR ITS OWN CONTENT'S, WHICHEVER IS MORE. The
        // words and the handset are house sizes and do NOT shrink with the
        // code, so below about 18 mm of code they are wider than the box and a
        // button locked to the box has its own label hanging out of both ends.
        // Found at 15 mm, the size this list gained on 21-Sep-2026. From 20 mm
        // up the content fits and the button is exactly the box, as it was.
        //
        // The pair is measured BEFORE the stadium is drawn, because the stadium
        // is sized from it - but the records are still pushed in the same order
        // as ever (box, button, handset, bar), which is what keeps the engine's
        // slots still across a rebuild.
        const buttonY  = metrics.boxMm + Na__LeParamQr__Number(config, 'ButtonGapMm');
        const buttonH  = Na__LeParamQr__Number(config, 'ButtonHeightMm');
        const words    = Na__LeParamQr__Text(config, 'ButtonText');
        const wordMm   = Na__LeParamQr__Number(config, 'ButtonTextSizeMm');
        const wordWt   = Na__LeParamQr__Number(config, 'ButtonTextWeight');
        const iconW    = Na__LeParamQr__Number(config, 'ButtonIconWidthMm');
        const iconH    = Na__LeParamQr__Number(config, 'ButtonIconHeightMm');
        const iconGap  = Na__LeParamQr__Number(config, 'ButtonIconGapMm');
        const wordsMm  = Na__LeParamQr__Measure(words, wordMm, wordWt, tools);
        const pairMm   = iconW + iconGap + wordsMm;
        const buttonW  = Math.max(metrics.boxMm, pairMm + (Na__LeParamQr__Number(config, 'ButtonPadMm') * 2));

        shapes.push({ kind : 'shape', record : {
            Shape__Points       : Na__LeParamQr__RoundedRect(0, buttonY, buttonW, buttonH, buttonH / 2),
            Shape__Closed       : true,
            Shape__Stroked      : true,
            Shape__StrokeColour : Na__LeParamQr__Text(config, 'ButtonColour'),
            Shape__StrokePt     : Na__LeParamQr__Number(config, 'ButtonStrokePt'),
            Shape__FillColour   : null
        } });

        const pairX   = (buttonW - pairMm) / 2;
        Na__LeParamQr__PhoneGlyph(config, pairX, buttonY + ((buttonH - iconH) / 2), iconW, iconH).forEach((entry) => shapes.push(entry));
        texts.push(Na__LeParamQr__TextRecord(words, pairX + iconW + iconGap, buttonY + ((buttonH + (wordMm * 0.72)) / 2),
            wordMm, wordWt, Na__LeParamQr__Text(config, 'ButtonTextColour'), 'left'));                                  // <-- 0.72 of the font is its cap height: what centres CAPITALS on a line rather than their line box

        // THE CAPTION | Under the button and RANGED LEFT on the column's own
        // edge, with the heading and the bullets below it. The one line that
        // tells somebody who has never scanned anything what to point at it.
        //
        // IT USED TO BE CENTRED ON THE CODE BOX, and that is what made the
        // block look crooked. The wording is a fixed thirty millimetres of type
        // and the box is whatever the code is: at 20 mm the caption is half as
        // wide again as the box, so centring hung it over BOTH edges, and the
        // block's left edge - the line an author lines up with a viewport or a
        // margin - moved with the code size. One edge, at every size, is worth
        // more here than a centred line under a button.
        let   y       = buttonY + buttonH;
        const caption = Na__LeParamQr__Text(config, 'CaptionText');
        let   widthMm = Math.max(metrics.boxMm, buttonW);
        if (caption !== '') {
            const capMm = Na__LeParamQr__Number(config, 'CaptionSizeMm');
            const capWt = Na__LeParamQr__Number(config, 'CaptionWeight');
            y += Na__LeParamQr__Number(config, 'CaptionGapMm');
            texts.push(Na__LeParamQr__TextRecord(caption, 0, y, capMm, capWt, Na__LeParamQr__Text(config, 'CaptionColour'), 'left'));
            widthMm = Math.max(widthMm, Na__LeParamQr__Measure(caption, capMm, capWt, tools));   // <-- Ranged left, so it is part of the column's width now
        }

        // THE HEADING, THE PROJECT AND THE BULLETS | Ranged left off the box's
        // own left edge, which is the line the whole column reads down
        const headingMm = Na__LeParamQr__Number(config, 'HeadingSizeMm');
        const heading   = Na__LeParamQr__Text(config, 'HeadingText');
        y += Na__LeParamQr__Number(config, 'HeadingGapMm');
        texts.push(Na__LeParamQr__TextRecord(heading, 0, y, headingMm, Na__LeParamQr__Number(config, 'HeadingWeight'), Na__LeParamQr__Text(config, 'HeadingColour'), 'left'));
        widthMm = Math.max(widthMm, Na__LeParamQr__Measure(heading, headingMm, Na__LeParamQr__Number(config, 'HeadingWeight'), tools));

        if (named) {
            const nameMm = Na__LeParamQr__Number(config, 'NameSizeMm');
            const told   = Na__LeParamQr__ProjectText(config, whole, tools);
            y += Na__LeParamQr__Number(config, 'NameGapMm');
            texts.push(Na__LeParamQr__TextRecord(told.text, 0, y, nameMm, Na__LeParamQr__Number(config, 'NameWeight'), Na__LeParamQr__Text(config, 'NameColour'), 'left'));
            widthMm = Math.max(widthMm, Na__LeParamQr__Measure(told.text, nameMm, Na__LeParamQr__Number(config, 'NameWeight'), tools));
        }

        const bulletMm = Na__LeParamQr__Number(config, 'BulletSizeMm');
        const bulletWt = Na__LeParamQr__Number(config, 'BulletWeight');
        const pitchMm  = Na__LeParamQr__Number(config, 'BulletPitchMm');
        const mark     = Na__LeParamQr__Text(config, 'BulletMark');
        const bullets  = Na__LeParamQr__List(config, 'Bullets').filter((line) => typeof line === 'string' && line.trim() !== '');
        let   lastMm   = named ? Na__LeParamQr__Number(config, 'NameSizeMm') : headingMm;
        bullets.forEach((line, index) => {
            const text = mark + line.trim();
            y += (index === 0) ? Na__LeParamQr__Number(config, 'BulletsGapMm') : pitchMm;
            texts.push(Na__LeParamQr__TextRecord(text, 0, y, bulletMm, bulletWt, Na__LeParamQr__Text(config, 'BulletColour'), 'left'));
            widthMm = Math.max(widthMm, Na__LeParamQr__Measure(text, bulletMm, bulletWt, tools));
            lastMm  = bulletMm;
        });

        // THE HEIGHT RUNS TO THE FOOT OF THE LAST LINE, not to its baseline.
        // A box that stops at the baseline cuts the descenders off the bottom
        // line of the block, so a selection looks a whisker short and anything
        // stacked under it sits on the tail of a 'g'.
        return { shapes : shapes, texts : texts, widthMm : widthMm, heightMm : y + (lastMm * Na__LeParamQr__DESCENDER) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Right Column of the Full Form: the Heading and the Paragraph
    // ------------------------------------------------------------
    // Returns { texts, heightMm }. Its first baseline sits TitleBaselineMm
    // below the top of the code box, so the heading's capitals line up with
    // the top of the code rather than hanging above it.
    // ------------------------------------------------------------
    function Na__LeParamQr__BuildNote(config, whole, atX, named, tools) {
        const texts   = [];
        const titleMm = Na__LeParamQr__Number(config, 'TitleSizeMm');
        const titleWt = Na__LeParamQr__Number(config, 'TitleWeight');
        let   y       = Na__LeParamQr__Number(config, 'TitleBaselineMm');
        texts.push(Na__LeParamQr__TextRecord(Na__LeParamQr__Text(config, 'TitleText'), atX, y, titleMm, titleWt, Na__LeParamQr__Text(config, 'TitleColour'), 'left'));

        // THE NAME UNDER THE TITLE HAS ITS OWN GAP, and that is the whole
        // reason the key exists. The compact form's NameGapMm is the drop from
        // a 3.5 mm heading; this title is 5.4 mm, and the same number put the
        // name's capitals into the title's descenders.
        let lastMm = titleMm;
        if (named) {
            const nameMm = Na__LeParamQr__Number(config, 'NameSizeMm');
            const told   = Na__LeParamQr__ProjectText(config, whole, tools);
            y += Na__LeParamQr__Number(config, 'TitleNameGapMm');
            texts.push(Na__LeParamQr__TextRecord(told.text, atX, y, nameMm, Na__LeParamQr__Number(config, 'NameWeight'), Na__LeParamQr__Text(config, 'NameColour'), 'left'));
            lastMm = nameMm;
        }

        const bodyMm  = Na__LeParamQr__Number(config, 'BodySizeMm');
        const bodyWt  = Na__LeParamQr__Number(config, 'BodyWeight');
        const pitchMm = Na__LeParamQr__Number(config, 'BodyPitchMm');
        const lines   = Na__LeParamQr__Wrap(Na__LeParamQr__Text(config, 'BodyText'), bodyMm, bodyWt, whole.BodyWidthMm, tools);
        lines.forEach((line, index) => {
            y += (index === 0) ? Na__LeParamQr__Number(config, 'BodyGapMm') : pitchMm;
            texts.push(Na__LeParamQr__TextRecord(line, atX, y, bodyMm, bodyWt, Na__LeParamQr__Text(config, 'BodyColour'), 'left'));
            lastMm = bodyMm;
        });
        return { texts : texts, heightMm : y + (lastMm * Na__LeParamQr__DESCENDER) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Block: Parameters In, Records Out
    // ------------------------------------------------------------
    // { records : [{ kind : 'shape' | 'annotation', record }], sizeMm }, from
    // an origin of (0, 0) at the code box's top left corner.
    //
    // EVERY SHAPE FIRST, THEN EVERY TEXT, and each in a fixed order however
    // the block is set, so the engine's slots stay put: the code box is
    // always vector one, and a rebuild after a resize updates the records
    // that are already there rather than deleting and drawing again.
    // ------------------------------------------------------------
    function Na__LeParamQr__Build(config, params, tools) {
        const whole   = Na__LeParamQr__Normalise(config, params);
        const metrics = Na__LeParamQr__Metrics(config, whole);
        const full    = whole.Form === Na__LeParamQr__FORM_FULL;
        const column  = Na__LeParamQr__BuildColumn(config, whole, metrics, !full, tools);
        let   widthMm = column.widthMm;
        let   heightMm = column.heightMm;
        const texts   = column.texts.slice();

        if (full) {
            const atX  = metrics.boxMm + Na__LeParamQr__Number(config, 'ColumnGapMm');
            const note = Na__LeParamQr__BuildNote(config, whole, atX, true, tools);
            note.texts.forEach((entry) => texts.push(entry));
            widthMm  = Math.max(widthMm, atX + whole.BodyWidthMm);
            heightMm = Math.max(heightMm, note.heightMm);
        }

        return { records : column.shapes.concat(texts), sizeMm : { WidthMm : widthMm, HeightMm : heightMm } };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Grips, the Menu and the Panel's Words
// -----------------------------------------------------------------------------

    // FUNCTION | Where the Block's Grips Stand, From Its Origin
    // ------------------------------------------------------------
    // The LOOKUP triangle stands off the code box's top right corner, where
    // the size list and the two forms are. The STRETCH arrow belongs to the
    // full form alone, at the right-hand end of the paragraph, and sets how
    // wide the words are set; the compact form is as wide as its own lines
    // and has nothing to drag. There is no link socket either way: this block
    // reads the project, not a drawing.
    // ------------------------------------------------------------
    function Na__LeParamQr__Handles(config, params) {
        const whole   = Na__LeParamQr__Normalise(config, params);
        const metrics = Na__LeParamQr__Metrics(config, whole);
        const lookup  = { x : metrics.boxMm, y : 0, away : [ Math.SQRT1_2, -Math.SQRT1_2 ] };
        if (whole.Form !== Na__LeParamQr__FORM_FULL) return { stretch : null, lookup : lookup, slide : null, link : null };
        const atX = metrics.boxMm + Na__LeParamQr__Number(config, 'ColumnGapMm');
        return {
            stretch : { x : atX + whole.BodyWidthMm, y : Na__LeParamQr__Number(config, 'TitleBaselineMm'), away : [ 1, 0 ] },
            lookup  : lookup,
            slide   : null,
            link    : null
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Parameters a Stretch Grip Dragged to a Point Gives
    // ------------------------------------------------------------
    // xMm is from the origin, so the column it sets runs from the end of the
    // code box and its gap to the pointer. Stepped, so a drag lands on a
    // round number and a rebuild writes what the last one wrote.
    // ------------------------------------------------------------
    function Na__LeParamQr__StretchTo(config, params, xMm) {
        const whole = Na__LeParamQr__Normalise(config, params);
        if (whole.Form !== Na__LeParamQr__FORM_FULL || !Number.isFinite(xMm)) return whole;
        const metrics = Na__LeParamQr__Metrics(config, whole);
        const atX     = metrics.boxMm + Na__LeParamQr__Number(config, 'ColumnGapMm');
        const step    = Math.max(0.1, Na__LeParamQr__Number(config, 'BodyWidthStepMm'));
        return Na__LeParamQr__Normalise(config, Object.assign({}, whole, { BodyWidthMm : Math.round((xMm - atX) / step) * step }));
    }
    // ------------------------------------------------------------


    // FUNCTION | What the Lookup Grip's Menu Offers
    // ------------------------------------------------------------
    // The code sizes, then the two forms. Each entry is a patch the engine
    // merges over the element's parameters as one undo step - the same
    // rebuild the panel's controls make, so the grip and the panel can never
    // disagree about what a choice does.
    // ------------------------------------------------------------
    function Na__LeParamQr__Choices(config, params, labels) {
        const whole = Na__LeParamQr__Normalise(config, params);
        const words = (labels && typeof labels === 'object') ? labels : {};
        const items = Na__LeParamQr__SizeChoices(config).map((sizeMm) => ({
            label   : String(sizeMm) + ' mm',
            checked : Math.abs(whole.SizeMm - sizeMm) < 0.05,
            patch   : { SizeMm : sizeMm }
        }));
        items.push({ separator : true });
        items.push({ label : words.compact || 'Code and list', checked : whole.Form === Na__LeParamQr__FORM_COMPACT, patch : { Form : Na__LeParamQr__FORM_COMPACT } });
        items.push({ label : words.full    || 'With the full description', checked : whole.Form === Na__LeParamQr__FORM_FULL, patch : { Form : Na__LeParamQr__FORM_FULL } });
        return items;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Type
// -----------------------------------------------------------------------------

    // FUNCTION | The Project Portal Block's Definition, for the Engine's Registry
    // ------------------------------------------------------------
    // getConfig() answers the config's ProjectQr block and getMenuWords() the
    // two form names as the config words them, each read fresh on every call.
    // linkable is false: this block is never tied to a viewport.
    // ------------------------------------------------------------
    function Na__LeParamQr__CreateType(getConfig, getMenuWords) {
        const config = () => ((typeof getConfig === 'function' ? getConfig() : null) || {});
        const words  = () => ((typeof getMenuWords === 'function' ? getMenuWords() : null) || null);
        return {
            type        : Na__LeParamQr__TYPE,
            keep        : Na__LeParamQr__KEEP.slice(),
            linkable    : false,
            defaults    : ()                 => Na__LeParamQr__Standard(config()),
            normalise   : (params)           => Na__LeParamQr__Normalise(config(), params),
            build       : (params, tools)    => Na__LeParamQr__Build(config(), params, tools),
            handles     : (params)           => Na__LeParamQr__Handles(config(), params),
            stretchTo   : (params, xMm)      => Na__LeParamQr__StretchTo(config(), params, xMm),
            choices     : (params)           => Na__LeParamQr__Choices(config(), params, words()),
            hasBar      : ()                 => false,
            sizeChoices : ()                 => Na__LeParamQr__SizeChoices(config()),
            projectText : (params, tools)    => Na__LeParamQr__ProjectText(config(), params, tools)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Project Portal QR Block API
    // ------------------------------------------------------------
    export {
        Na__LeParamQr__TYPE,
        Na__LeParamQr__FORM_COMPACT,
        Na__LeParamQr__FORM_FULL,
        Na__LeParamQr__FORMS,
        Na__LeParamQr__NAME_MISSING,
        Na__LeParamQr__Standard,
        Na__LeParamQr__Normalise,
        Na__LeParamQr__Metrics,
        Na__LeParamQr__SizeChoices,
        Na__LeParamQr__ProjectText,
        Na__LeParamQr__Build,
        Na__LeParamQr__Handles,
        Na__LeParamQr__StretchTo,
        Na__LeParamQr__Choices,
        Na__LeParamQr__CreateType
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
