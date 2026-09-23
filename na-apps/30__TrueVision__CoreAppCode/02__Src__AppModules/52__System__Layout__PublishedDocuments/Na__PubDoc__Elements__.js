// =============================================================================
// TRUEVISION3D - PUBLISHED DOCUMENTS - ELEMENT PAINTERS
// =============================================================================
//
// FILE       : Na__PubDoc__Elements__.js
// NAMESPACE  : Na__PubEl
// MODULE     : Published Documents - Element Painters
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Paint each published element file onto a sheet, one region per kind, deciding nothing
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A KEY HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - ONE MODULE, ONE REGION PER KIND. The published DATA is one file per element
//   kind, which is what makes a layer a file and a future show/hide a load or a
//   drop. The CODE does not need the same split: eight tiny modules painting
//   eight arrays would repeat the same preamble eight times and hide how alike
//   they are. The kinds are separated by region and dispatched by name.
// - IT DECIDES ALMOST NOTHING, because almost everything was decided at publish:
//   a dimension's text is a string in the file, an area's square metres are a
//   number in the file, a paragraph's line breaks are an array in the file. What
//   is left here is arrangement - where a tick goes, which side of the line the
//   text sits - and nothing that could disagree with the drawing about a value.
// - WHAT IS NOT HERE. No text measurement, no number formatting, no unit
//   conversion beyond points to millimetres, no markdown, no specification
//   lookup, no area arithmetic, and no renderer of any kind.
//
// PARITY NOTE, AND IT IS THE ONE PLACE THIS FILE COULD BE WRONG:
// - Dimension ARRANGEMENT is implemented here to the standard convention -
//   text centred along the line, on the far side from the measured points, never
//   upside down. The authoring side arranges its own dimensions in
//   Na__LeDim__ and this module was NOT written by reading that code, so the two
//   could differ by a fraction of a millimetre or by which side the text sits.
//   IT MUST BE CHECKED AGAINST A SCREENSHOT of the same sheet in the editor
//   before any of this is shown to a client. The VALUES cannot differ - those
//   are published strings - only the arrangement.
//
// INTEGRATION:
// - Na__PubDoc__Document__ loads the element files and calls Paint for each.
// - Imports the painter and the schema. Nothing else.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Created with Phase 2 of TrueVision__PLAN__PublishingSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import {
        Na__PubPaint__Sink, Na__PubPaint__Done, Na__PubPaint__Group, Na__PubPaint__GroupEnd,
        Na__PubPaint__Rect, Na__PubPaint__Line, Na__PubPaint__Circle, Na__PubPaint__Points,
        Na__PubPaint__Text, Na__PubPaint__Image,
        Na__PubPaint__Gradient, Na__PubPaint__HatchPattern, Na__PubPaint__ShadowFilter
    } from './Na__PubDoc__Paint__.js';

    import { Na__PubSchema__Kind, Na__PubSchema__ResolveDocumentRef } from '../53__Data__Layout__PublishedSchema/Na__PublishedSchema__Paths__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    const Na__PubEl__INK        = '#172b3a';                                      // <-- The house ink, when a file names no colour
    const Na__PubEl__TEXT_GAP   = 0.6;                                            // <-- Millimetres between a dimension line and its text
                                                                                  //     The font is inherited from the sheet's <svg> and is never set per element.

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Shared Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Array a Published Element File Holds
    // ------------------------------------------------------------
    function Na__PubEl__Array(whole, kindName) {
        const kind = Na__PubSchema__Kind(kindName);
        if (!kind || !whole || typeof whole !== 'object') return [];
        const found = whole[kind.arrayKey];
        return Array.isArray(found) ? found : [];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Number, or a Default
    // ------------------------------------------------------------
    function Na__PubEl__N(value, fallback) {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Unique Definition Id Within One Document
    // ------------------------------------------------------------
    function Na__PubEl__DefId(context, prefix, key) {
        const stem = (context && context.DefPrefix) ? context.DefPrefix : 'na';
        return stem + '-' + prefix + '-' + String(key).replace(/[^A-Za-z0-9_-]/g, '');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Vectors - the Hand-Drawn Shapes
// -----------------------------------------------------------------------------

    // FUNCTION | Paint the Vector Layer
    // ------------------------------------------------------------
    function Na__PubEl__Vectors(whole, context) {
        const sink = Na__PubPaint__Sink();
        const defs = context.Defs;

        for (const shape of Na__PubEl__Array(whole, 'vector')) {
            const id     = shape['Shape__Id'];
            const points = shape['Shape__Points'];
            if (!Array.isArray(points) || points.length === 0) continue;

            let patternId = null;

            // A GRADIENT IS PUBLISHED AS THE RULE IT IS, not baked into a raster.
            if (shape['Shape__Gradient']) {
                patternId = Na__PubPaint__Gradient(defs, Na__PubEl__DefId(context, 'grad', id), shape['Shape__Gradient']);
            }

            // A HATCH REFERENCES A TILE PUBLISHED ONCE PER PROJECT.
            const hatch = shape['Shape__Hatch'];
            if (hatch && hatch['Hatch__TileSvg']) {
                const relative = Na__PubSchema__ResolveDocumentRef(context.DocumentId, hatch['Hatch__TileSvg']);
                const href     = relative ? context.Url(relative) : null;
                if (href) patternId = Na__PubPaint__HatchPattern(defs, Na__PubEl__DefId(context, 'hatch', id), hatch, href);
            }

            Na__PubPaint__Points(sink, points, shape['Shape__Closed'] === true, {
                Id            : id,
                Class         : 'na-pubdoc__vector',
                FillColour    : patternId ? null : shape['Shape__FillColour'],
                FillOpacity   : shape['Shape__FillOpacity'],
                PatternId     : patternId,
                StrokeColour  : (shape['Shape__Stroked'] === false) ? null : shape['Shape__StrokeColour'],
                StrokePt      : Na__PubEl__N(shape['Shape__StrokePt'], 0.35),
                StrokeOpacity : shape['Shape__StrokeOpacity'],
                LineStyle     : shape['Shape__LineStyle']
            });
        }
        return Na__PubPaint__Done(sink);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Text - the Annotations
// -----------------------------------------------------------------------------

    // FUNCTION | Paint the Text Layer
    // ------------------------------------------------------------
    // Annotation__Lines is used when it is there and Annotation__Text only as a
    // last resort, because Lines are the lines the drawing PRINTS - measured at
    // publish with the real font - and Text is the unwrapped original.
    // ------------------------------------------------------------
    function Na__PubEl__Text(whole, context) {
        const sink = Na__PubPaint__Sink();

        for (const note of Na__PubEl__Array(whole, 'annotation')) {
            const lines = Array.isArray(note['Annotation__Lines']) && note['Annotation__Lines'].length > 0
                ? note['Annotation__Lines']
                : [ note['Annotation__Text'] ];
            if (!lines[0] && lines.length === 1) continue;

            const x = Na__PubEl__N(note['Annotation__PosXMm'], 0);
            const y = Na__PubEl__N(note['Annotation__PosYMm'], 0);

            // A LEADER FROM A NOTE, when the note carries one, drawn before the
            // text so the text sits over it.
            const leaderX = note['Annotation__LeaderXMm'];
            const leaderY = note['Annotation__LeaderYMm'];
            if (leaderX != null && leaderY != null) {
                Na__PubPaint__Line(sink, x, y, Na__PubEl__N(leaderX, x), Na__PubEl__N(leaderY, y), {
                    StrokeColour : note['Annotation__Colour'] || Na__PubEl__INK,
                    StrokePt     : 0.25,
                    Class        : 'na-pubdoc__text-leader'
                });
            }

            Na__PubPaint__Text(sink, x, y, lines, {
                Id         : note['Annotation__Id'],
                Class      : 'na-pubdoc__text',
                SizeMm     : Na__PubEl__N(note['Annotation__SizeMm'], 2.5),
                FontWeight : note['Annotation__FontWeight'],
                Colour     : note['Annotation__Colour'] || Na__PubEl__INK,
                Align      : note['Annotation__Align'],
                Runs       : note['Annotation__Runs'],
                Rotation   : note['Annotation__RotationDeg']
            });
        }
        return Na__PubPaint__Done(sink);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dimensions
// -----------------------------------------------------------------------------
//
// THE ONE REGION THAT DOES GEOMETRY. The published file gives the two measured
// points, a perpendicular offset, the tick length, the extension lengths and the
// FINISHED TEXT. From those the line, its ticks, its extensions and the text's
// place are arranged. See the parity note in this file's header: the values here
// cannot be wrong, the arrangement could be.
//
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Frame of One Dimension
    // ------------------------------------------------------------
    // Returns the measured points, the offset line's endpoints, the unit vector
    // along the line and the unit normal it was offset by.
    // ------------------------------------------------------------
    function Na__PubEl__DimFrame(dimension) {
        const sx = Na__PubEl__N(dimension['Dimension__StartXMm'], 0);
        const sy = Na__PubEl__N(dimension['Dimension__StartYMm'], 0);
        const ex = Na__PubEl__N(dimension['Dimension__EndXMm'], 0);
        const ey = Na__PubEl__N(dimension['Dimension__EndYMm'], 0);
        const dx = ex - sx, dy = ey - sy;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 1e-6) return null;

        const ux = dx / length, uy = dy / length;                                 // <-- Along the dimension
        const nx = -uy,         ny = ux;                                          // <-- Its normal
        const offset = Na__PubEl__N(dimension['Dimension__OffsetMm'], 0);

        return {
            sx : sx, sy : sy, ex : ex, ey : ey,
            lx1 : sx + nx * offset, ly1 : sy + ny * offset,                        // <-- The dimension line itself
            lx2 : ex + nx * offset, ly2 : ey + ny * offset,
            ux : ux, uy : uy, nx : nx, ny : ny, length : length, offset : offset
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Paint the Dimension Layer
    // ------------------------------------------------------------
    function Na__PubEl__Dimensions(whole, context) {
        const sink = Na__PubPaint__Sink();

        for (const dimension of Na__PubEl__Array(whole, 'dimension')) {
            const frame = Na__PubEl__DimFrame(dimension);
            if (!frame) continue;

            const colour = dimension['Dimension__Colour'] || '#960000';
            const pt     = Na__PubEl__N(context.DimensionPt, 0.35);
            const stroke = { StrokeColour : colour, StrokePt : pt, Class : 'na-pubdoc__dim-line' };

            Na__PubPaint__Group(sink, {
                Class : 'na-pubdoc__dim',
                Id    : dimension['Dimension__Id'],
                Kind  : 'dimension'
            });

            // THE DIMENSION LINE
            Na__PubPaint__Line(sink, frame.lx1, frame.ly1, frame.lx2, frame.ly2, stroke);

            // THE EXTENSION LINES, from just short of the measured point to just
            // past the dimension line, as a drawn dimension does.
            const startExt = Na__PubEl__N(dimension['Dimension__StartExtensionMm'], 0);
            const endExt   = Na__PubEl__N(dimension['Dimension__EndExtensionMm'], 0);
            if (startExt > 0 || frame.offset !== 0) {
                Na__PubPaint__Line(sink, frame.sx, frame.sy,
                    frame.lx1 + frame.nx * (startExt * Math.sign(frame.offset || 1)),
                    frame.ly1 + frame.ny * (startExt * Math.sign(frame.offset || 1)), stroke);
            }
            if (endExt > 0 || frame.offset !== 0) {
                Na__PubPaint__Line(sink, frame.ex, frame.ey,
                    frame.lx2 + frame.nx * (endExt * Math.sign(frame.offset || 1)),
                    frame.ly2 + frame.ny * (endExt * Math.sign(frame.offset || 1)), stroke);
            }

            // THE TERMINATORS
            const terminator = String(dimension['Dimension__Terminator'] || 'tick');
            const tick       = Na__PubEl__N(dimension['Dimension__TickLengthMm'], 1.5);
            Na__PubEl__DimTerminator(sink, frame, frame.lx1, frame.ly1, terminator, tick, colour, pt, 1);
            Na__PubEl__DimTerminator(sink, frame, frame.lx2, frame.ly2, terminator, tick, colour, pt, -1);

            // THE TEXT: centred along the dimension line, turned to it, lifted
            // clear of it, and never upside down.
            //
            // The lift is taken in the text's OWN up direction rather than along
            // the line's normal. After rotating by angle, the text's local -y
            // axis points along (sin, -cos) in the sheet's space, so lifting the
            // anchor by that vector puts the text visually above its own
            // baseline whichever way the dimension runs - including the flipped
            // case, where lifting along the normal would drop it below the line.
            const text = dimension['Dimension__Text'];
            if (text != null && text !== '') {
                const size = Na__PubEl__N(dimension['Dimension__TextSizeMm'], 2.5);
                const midX = (frame.lx1 + frame.lx2) / 2;
                const midY = (frame.ly1 + frame.ly2) / 2;

                let angle = Math.atan2(frame.ly2 - frame.ly1, frame.lx2 - frame.lx1) * 180 / Math.PI;
                if (angle > 90 || angle < -90) angle += 180;                       // <-- Never read upside down

                const rad  = angle * Math.PI / 180;
                const lift = size * 0.35 + Na__PubEl__TEXT_GAP;
                Na__PubPaint__Text(sink,
                    midX + Math.sin(rad) * lift,
                    midY - Math.cos(rad) * lift,
                    [ text ], {
                        Class    : 'na-pubdoc__dim-text',
                        SizeMm   : size,
                        Colour   : colour,
                        Align    : 'centre',
                        Rotation : angle
                    });
            }

            Na__PubPaint__GroupEnd(sink);
        }
        return Na__PubPaint__Done(sink);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One End Mark of a Dimension
    // ------------------------------------------------------------
    function Na__PubEl__DimTerminator(sink, frame, x, y, terminator, size, colour, pt, sense) {
        if (terminator === 'none') return;
        if (terminator === 'dot') {
            Na__PubPaint__Circle(sink, x, y, Math.max(0.15, size * 0.25),
                { FillColour : colour, Class : 'na-pubdoc__dim-end' });
            return;
        }
        if (terminator === 'arrow') {
            const back = size, half = size * 0.3;
            Na__PubPaint__Points(sink, [
                [ x, y ],
                [ x + frame.ux * back * sense + frame.nx * half, y + frame.uy * back * sense + frame.ny * half ],
                [ x + frame.ux * back * sense - frame.nx * half, y + frame.uy * back * sense - frame.ny * half ]
            ], true, { FillColour : colour, Class : 'na-pubdoc__dim-end' });
            return;
        }
        // THE ARCHITECTURAL TICK: a short slash at 45 degrees across the line.
        const ax = (frame.ux + frame.nx) * size * 0.5;
        const ay = (frame.uy + frame.ny) * size * 0.5;
        Na__PubPaint__Line(sink, x - ax, y - ay, x + ax, y + ay,
            { StrokeColour : colour, StrokePt : pt, Cap : 'butt', Class : 'na-pubdoc__dim-end' });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Areas - the Floor Area Fills
// -----------------------------------------------------------------------------

    // FUNCTION | Paint the Area Layer
    // ------------------------------------------------------------
    // Area__LabelText is the published string, newlines and all, and
    // Area__AreaM2 is the published number. Neither is worked out here: square
    // metres are never stored on the authoring side, so publishing them is what
    // lets the reader hold no area arithmetic at all.
    // ------------------------------------------------------------
    function Na__PubEl__Areas(whole, context) {
        const sink = Na__PubPaint__Sink();

        for (const area of Na__PubEl__Array(whole, 'area')) {
            const points = area['Area__Points'];
            if (!Array.isArray(points) || points.length < 3) continue;

            Na__PubPaint__Group(sink, { Class : 'na-pubdoc__area', Id : area['Area__Id'], Kind : 'area' });

            Na__PubPaint__Points(sink, points, true, {
                FillColour    : area['Area__FillColour'],
                FillOpacity   : area['Area__FillOpacity'],
                StrokeColour  : area['Area__StrokeColour'],
                StrokePt      : Na__PubEl__N(area['Area__StrokePt'], 0.25),
                LineStyle     : area['Area__LineStyle'],
                Class         : 'na-pubdoc__area-fill'
            });

            const label = area['Area__LabelText'];
            if (label) {
                Na__PubPaint__Text(sink,
                    Na__PubEl__N(area['Area__LabelXMm'], 0),
                    Na__PubEl__N(area['Area__LabelYMm'], 0),
                    String(label).split('\n'), {
                        Class      : 'na-pubdoc__area-label',
                        SizeMm     : Na__PubEl__N(area['Area__LabelSizeMm'], 2.5),
                        Colour     : area['Area__LabelColour'] || '#4a5b67',
                        Align      : 'centre',
                        FontWeight : area['Area__LabelWeight']
                    });
            }
            Na__PubPaint__GroupEnd(sink);
        }
        return Na__PubPaint__Done(sink);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Bubbles - the Specification Leaders
// -----------------------------------------------------------------------------

    // FUNCTION | Paint the Bubble Layer
    // ------------------------------------------------------------
    // The specification note travels with each bubble - code, heading and the
    // resolved text - so tapping one can say what it means without the reader
    // ever loading the specification document. A bubble whose note has no text
    // is marked so the reader offers nothing rather than an empty panel.
    // ------------------------------------------------------------
    function Na__PubEl__Bubbles(whole, context) {
        const sink = Na__PubPaint__Sink();

        for (const leader of Na__PubEl__Array(whole, 'leader')) {
            const tipX = Na__PubEl__N(leader['Leader__TipXMm'], null);
            const tipY = Na__PubEl__N(leader['Leader__TipYMm'], null);
            const boxX = Na__PubEl__N(leader['Leader__BubbleXMm'], null);
            const boxY = Na__PubEl__N(leader['Leader__BubbleYMm'], null);
            if (tipX == null || tipY == null || boxX == null || boxY == null) continue;

            const isBubble = String(leader['Leader__Type'] || 'bubble') === 'bubble';
            const radius   = Na__PubEl__N(leader['Leader__BubbleSizeMm'], 9) / 2;
            const hasNote  = leader['Leader__SpecText'] != null && leader['Leader__SpecText'] !== '';

            Na__PubPaint__Group(sink, {
                Class : 'na-pubdoc__bubble' + (hasNote ? ' na-pubdoc__bubble--noted' : ''),
                Id    : leader['Leader__Id'],
                Kind  : 'leader'
            });

            // THE LEADER LINE, stopping at the bubble's edge rather than its
            // centre so it does not show through the fill.
            let endX = boxX, endY = boxY;
            if (isBubble && radius > 0) {
                const dx = boxX - tipX, dy = boxY - tipY;
                const length = Math.sqrt(dx * dx + dy * dy) || 1;
                endX = boxX - (dx / length) * radius;
                endY = boxY - (dy / length) * radius;
            }
            Na__PubPaint__Line(sink, tipX, tipY, endX, endY, {
                StrokeColour  : leader['Leader__LineColour'] || Na__PubEl__INK,
                StrokePt      : Na__PubEl__N(leader['Leader__LinePt'], 0.35),
                StrokeOpacity : leader['Leader__LineOpacity'],
                LineStyle     : leader['Leader__LineStyle'],
                Class         : 'na-pubdoc__bubble-line'
            });

            // THE TIP MARK
            const endSize = Na__PubEl__N(leader['Leader__EndpointSizeMm'], 1.6);
            if (endSize > 0) {
                Na__PubPaint__Circle(sink, tipX, tipY, endSize / 2, {
                    FillColour   : (leader['Leader__EndpointFilled'] === true) ? (leader['Leader__LineColour'] || Na__PubEl__INK) : '#ffffff',
                    StrokeColour : leader['Leader__LineColour'] || Na__PubEl__INK,
                    StrokePt     : Na__PubEl__N(leader['Leader__EndpointPt'], 0.35),
                    Class        : 'na-pubdoc__bubble-tip'
                });
            }

            // THE BUBBLE AND ITS CODE
            if (isBubble) {
                Na__PubPaint__Circle(sink, boxX, boxY, radius, {
                    FillColour   : leader['Leader__FillColour'] || '#f2f4f5',
                    FillOpacity  : leader['Leader__FillOpacity'],
                    StrokeColour : leader['Leader__LineColour'] || Na__PubEl__INK,
                    StrokePt     : Na__PubEl__N(leader['Leader__BubbleEdgePt'], 0.35),
                    Class        : 'na-pubdoc__bubble-ring'
                });
            }
            Na__PubPaint__Text(sink, boxX, boxY, [ leader['Leader__Text'] ], {
                Class      : 'na-pubdoc__bubble-text',
                SizeMm     : Na__PubEl__N(leader['Leader__TextSizeMm'], 2.5),
                FontWeight : leader['Leader__FontWeight'],
                Colour     : leader['Leader__TextColour'] || Na__PubEl__INK,
                Align      : isBubble ? 'centre' : 'start',
                Baseline   : isBubble ? 'central' : 'auto'
            });

            Na__PubPaint__GroupEnd(sink);
        }
        return Na__PubPaint__Done(sink);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Images - the Sheet Pictures
// -----------------------------------------------------------------------------

    // FUNCTION | Paint the Image Layer
    // ------------------------------------------------------------
    // A picture is NOT copied into a published document: it already lives in
    // 05__Layout__DrawingDocs__Images under the document id, immutably named and
    // already cached, so what is published is where it is and which part shows.
    // The frame's shadow is published as the blur it is rather than as a
    // transparent PNG, because a transparent layer over paper is exactly the
    // thing this system exists to stop shipping to phones.
    // ------------------------------------------------------------
    function Na__PubEl__Images(whole, context) {
        const sink = Na__PubPaint__Sink();
        const defs = context.Defs;

        for (const shape of Na__PubEl__Array(whole, 'image')) {
            const block  = shape['Shape__Image'];
            const points = shape['Shape__Points'];
            if (!block || !Array.isArray(points) || points.length < 4) continue;

            const xs = points.map((one) => one[0]), ys = points.map((one) => one[1]);
            const x = Math.min.apply(null, xs), y = Math.min.apply(null, ys);
            const w = Math.max.apply(null, xs) - x, h = Math.max.apply(null, ys) - y;

            const relative = Na__PubSchema__ResolveDocumentRef(context.DocumentId, block['Image__Source']);
            const href     = relative ? context.Url(relative) : null;

            const frame  = shape['Shape__Frame'] || {};
            const shadow = (frame['Frame__Shadow'] === true && block['Image__Alpha'] !== true)
                ? Na__PubPaint__ShadowFilter(defs, Na__PubEl__DefId(context, 'shadow', shape['Shape__Id']), {
                      Colour    : frame['Frame__ShadowColour'],
                      Opacity   : frame['Frame__ShadowOpacity'],
                      BlurMm    : frame['Frame__ShadowBlurMm'],
                      OffsetXMm : frame['Frame__ShadowOffsetXMm'],
                      OffsetYMm : frame['Frame__ShadowOffsetYMm']
                  })
                : null;

            Na__PubPaint__Group(sink, {
                Class     : 'na-pubdoc__image',
                Id        : shape['Shape__Id'],
                Kind      : 'image',
                Transform : null
            });

            if (shadow) sink.push('<g filter="url(#' + shadow + ')">');
            if (href) {
                Na__PubPaint__Image(sink, x, y, w, h, href, {
                    Id    : shape['Shape__Id'],
                    Class : 'na-pubdoc__image-bitmap'
                });
            } else {
                // A PICTURE THAT CANNOT BE FOUND IS A GREY BOX, NOT A GAP, so a
                // reader can see that something belongs there.
                Na__PubPaint__Rect(sink, x, y, w, h, {
                    FillColour : '#e9ebec', StrokeColour : '#c8ccce', StrokePt : 0.35,
                    Class : 'na-pubdoc__image-missing'
                });
            }
            if (shadow) sink.push('</g>');

            if (frame['Frame__Shown'] === true) {
                Na__PubPaint__Rect(sink, x, y, w, h, {
                    FillColour   : null,
                    StrokeColour : frame['Frame__Colour'] || '#555041',
                    StrokePt     : Na__PubEl__N(frame['Frame__WidthPt'], 1.5),
                    Class        : 'na-pubdoc__image-frame'
                });
            }

            Na__PubPaint__GroupEnd(sink);
        }
        return Na__PubPaint__Done(sink);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dispatch
// -----------------------------------------------------------------------------

    const Na__PubEl__PAINTERS = {
        vector     : Na__PubEl__Vectors,
        annotation : Na__PubEl__Text,
        dimension  : Na__PubEl__Dimensions,
        area       : Na__PubEl__Areas,
        leader     : Na__PubEl__Bubbles,
        image      : Na__PubEl__Images,
        group      : null,                                                        // <-- Groups are a record, never drawn
        viewport   : null                                                         // <-- Na__PubDoc__Viewports__ owns these
    };

    // FUNCTION | Paint One Element File
    // ------------------------------------------------------------
    // context : {
    //   DocumentId  - for resolving a shared or cross-folder reference
    //   Url         - (projectRelativePath) => a url the browser can fetch
    //   Defs        - a sink the painter may push gradient/pattern/filter defs onto
    //   DefPrefix   - a per-document prefix so two documents on one page cannot clash
    //   DimensionPt - the sheet's published dimension lineweight
    // }
    // Returns markup, or '' for a kind that is never drawn.
    // ------------------------------------------------------------
    function Na__PubEl__Paint(kindName, whole, context) {
        const kind = Na__PubSchema__Kind(kindName);
        if (!kind) return '';
        const painter = Na__PubEl__PAINTERS[kind.name];
        if (!painter) return '';
        try {
            return painter(whole, context || {});
        } catch (error) {
            // A BAD ELEMENT FILE LOSES ITS OWN LAYER, NEVER THE SHEET. A client
            // seeing a drawing without its dimensions can say so; a client
            // seeing a blank page cannot tell it from a broken app.
            console.warn('[TrueVision3D PubDoc] The ' + kind.name + ' layer of ' +
                         (context && context.DocumentId) + ' could not be painted: ' + error.message);
            return '';
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Kinds This Module Actually Draws
    // ------------------------------------------------------------
    function Na__PubEl__Draws(kindName) {
        const kind = Na__PubSchema__Kind(kindName);
        return !!(kind && Na__PubEl__PAINTERS[kind.name]);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubEl__Paint,
        Na__PubEl__Draws,
        Na__PubEl__Array
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
