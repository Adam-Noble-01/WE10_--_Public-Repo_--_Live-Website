// =============================================================================
// TRUEVISION3D - PUBLISHED DOCUMENTS - SHEET AND FURNITURE
// =============================================================================
//
// FILE       : Na__PubDoc__Sheet__.js
// NAMESPACE  : Na__PubSheet
// MODULE     : Published Documents - Sheet and Furniture
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Emit the paper and the published mark list, laying nothing out
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A KEY HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - THIS MODULE IS DELIBERATELY DULL, and its dullness is the design. The border,
//   the title block and its cells, the logo, the QR block, the drawing title and
//   its underline, the scale bar, the compass and the margin notes all arrive as
//   a RESOLVED MARK LIST in Document__Sheet__.json. Each mark says what it is and
//   where it goes; this file turns each one into one SVG element.
// - IT LAYS OUT NOTHING, and must never start to. The authoring side positions
//   all of that with Na__LeChrome__ - measuring text, fitting it to cells,
//   placing a logo by its aspect, wrapping the QR body to a line count - and the
//   publisher runs that same code and writes down what it produced. A reader that
//   laid the title block out itself would diverge from the drawing that was
//   approved, in ways nobody would see until a client did.
// - WHY THE PUBLISHER AND NOT THE READER: SheetChrome transitively reaches the
//   snapshot renderer, the Viewport2d family and EdgeStyles, so importing it here
//   would drag the whole renderer into the reader and undo the point of the
//   split. Proven by walking its import graph, 23-Sep-2026.
// - A MARK THIS BUILD DOES NOT KNOW IS SKIPPED, not guessed at. A newer publisher
//   adding a mark type must not make an older reader draw something wrong; the
//   version gate already refuses a newer schema outright, so this is the belt to
//   that braces.
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
        Na__PubPaint__Rect, Na__PubPaint__Line, Na__PubPaint__Circle, Na__PubPaint__Path,
        Na__PubPaint__Text, Na__PubPaint__Image, Na__PubPaint__ShadowFilter
    } from './Na__PubDoc__Paint__.js';

    import { Na__PubSchema__ResolveDocumentRef } from '../53__Data__Layout__PublishedSchema/Na__PublishedSchema__Paths__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Paper Sizes
// -----------------------------------------------------------------------------

    // A published sheet states its own paper in millimetres, so this table is
    // only a floor for a document that somehow did not.
    const Na__PubSheet__PAPER = {
        A0 : [ 1189, 841 ], A1 : [ 841, 594 ], A2 : [ 594, 420 ],
        A3 : [ 420, 297 ],  A4 : [ 297, 210 ]
    };

    // FUNCTION | The Paper of a Published Sheet, in Millimetres
    // ------------------------------------------------------------
    function Na__PubSheet__Paper(sheet) {
        const block = (sheet && sheet['PublishedSheet__Paper']) || {};
        let width  = Number(block['Paper__WidthMm']);
        let height = Number(block['Paper__HeightMm']);

        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            const size = Na__PubSheet__PAPER[String(block['Paper__Size'] || 'A3').toUpperCase()] || Na__PubSheet__PAPER.A3;
            const landscape = String(block['Paper__Orientation'] || 'landscape') !== 'portrait';
            width  = landscape ? size[0] : size[1];
            height = landscape ? size[1] : size[0];
        }
        return {
            WidthMm      : width,
            HeightMm     : height,
            Size         : block['Paper__Size'] || null,
            Orientation  : block['Paper__Orientation'] || 'landscape',
            OriginCorner : block['Paper__OriginCorner'] || 'top-left',
            AxisY        : block['Paper__AxisY'] || 'down',
            DrawingArea  : Na__PubSheet__Area(block, width, height)
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Drawing Area - What the Grey Mask Covers
    // ------------------------------------------------------------
    function Na__PubSheet__Area(block, width, height) {
        const area = block['Paper__DrawingAreaMm'];
        if (area && Number.isFinite(Number(area['WidthMm'])) && Number.isFinite(Number(area['HeightMm']))) {
            return {
                XMm : Number(area['X']) || 0, YMm : Number(area['Y']) || 0,
                WidthMm : Number(area['WidthMm']), HeightMm : Number(area['HeightMm'])
            };
        }
        // A sheet that did not say: the paper less a sensible margin and a title
        // block strip. Better than nothing to mask.
        const margin = 8;
        return { XMm : margin, YMm : margin, WidthMm : width - margin * 2, HeightMm : height - margin * 2 - 38 };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Paper Itself
// -----------------------------------------------------------------------------

    // FUNCTION | The White Sheet, With Its Drop Shadow
    // ------------------------------------------------------------
    function Na__PubSheet__Ground(paper, context) {
        const sink  = Na__PubPaint__Sink();
        const style = (context && context.Style) || {};

        if (style.PaperShadow !== false && context && context.Defs) {
            const id = Na__PubPaint__ShadowFilter(context.Defs, (context.DefPrefix || 'na') + '-paper-shadow', {
                Colour    : style.ShadowColour,
                Opacity   : style.ShadowOpacity,
                BlurMm    : style.ShadowBlurMm,
                OffsetYMm : style.ShadowOffsetYMm
            });
            sink.push('<g filter="url(#' + id + ')">');
            Na__PubPaint__Rect(sink, 0, 0, paper.WidthMm, paper.HeightMm,
                { FillColour : style.PaperColour || '#ffffff', Class : 'na-pubdoc__paper' });
            sink.push('</g>');
        } else {
            Na__PubPaint__Rect(sink, 0, 0, paper.WidthMm, paper.HeightMm,
                { FillColour : style.PaperColour || '#ffffff', Class : 'na-pubdoc__paper' });
        }
        return Na__PubPaint__Done(sink);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Published Mark List
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Style Block Shared by Every Mark Type
    // ------------------------------------------------------------
    function Na__PubSheet__MarkStyle(mark, role) {
        return {
            Class         : 'na-pubdoc__mark' + (role ? (' na-pubdoc__mark--' + role) : ''),
            FillColour    : mark['Mark__FillColour'],
            FillOpacity   : mark['Mark__FillOpacity'],
            StrokeColour  : mark['Mark__StrokeColour'],
            StrokePt      : (mark['Mark__StrokePt'] == null) ? 0.35 : mark['Mark__StrokePt'],
            StrokeOpacity : mark['Mark__StrokeOpacity'],
            LineStyle     : mark['Mark__LineStyle']
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Emit the Sheet's Resolved Marks
    // ------------------------------------------------------------
    // One mark in, one element out, in the order the publisher wrote them. The
    // order IS the paint order; nothing is sorted here.
    // ------------------------------------------------------------
    function Na__PubSheet__Marks(sheet, context) {
        const marks = (sheet && sheet['PublishedSheet__Marks']);
        if (!Array.isArray(marks) || marks.length === 0) return '';

        const sink    = Na__PubPaint__Sink();
        let   skipped = 0;

        Na__PubPaint__Group(sink, { Class : 'na-pubdoc__furniture' });

        for (const mark of marks) {
            const type = String(mark['Mark__Type'] || '');
            const role = mark['Mark__Role'] || null;
            const style = Na__PubSheet__MarkStyle(mark, role);

            switch (type) {
                case 'rect':
                    Na__PubPaint__Rect(sink, mark['Mark__XMm'], mark['Mark__YMm'],
                        mark['Mark__WidthMm'], mark['Mark__HeightMm'], style);
                    break;

                case 'line':
                    Na__PubPaint__Line(sink, mark['Mark__X1Mm'], mark['Mark__Y1Mm'],
                        mark['Mark__X2Mm'], mark['Mark__Y2Mm'],
                        Object.assign(style, { Cap : mark['Mark__Cap'] || 'butt' }));
                    break;

                case 'path':
                    Na__PubPaint__Path(sink, mark['Mark__D'], style);
                    break;

                case 'circle':
                    Na__PubPaint__Circle(sink, mark['Mark__CxMm'], mark['Mark__CyMm'],
                        mark['Mark__RadiusMm'], style);
                    break;

                case 'text':
                    Na__PubPaint__Text(sink, mark['Mark__XMm'], mark['Mark__YMm'],
                        Array.isArray(mark['Mark__Lines']) ? mark['Mark__Lines'] : [ mark['Mark__Lines'] ], {
                            Class      : style.Class,
                            SizeMm     : mark['Mark__SizeMm'],
                            LeadingMm  : mark['Mark__LeadingMm'],
                            FontWeight : mark['Mark__FontWeight'],
                            Colour     : mark['Mark__Colour'] || mark['Mark__FillColour'] || '#172b3a',
                            Align      : mark['Mark__Align'],
                            Baseline   : mark['Mark__Baseline'],
                            Runs       : mark['Mark__Runs'],
                            Rotation   : mark['Mark__RotationDeg']
                        });
                    break;

                case 'image': {
                    const relative = Na__PubSchema__ResolveDocumentRef(context.DocumentId, mark['Mark__Source']);
                    const href     = relative ? context.Url(relative) : (mark['Mark__Href'] || null);
                    if (href) {
                        Na__PubPaint__Image(sink, mark['Mark__XMm'], mark['Mark__YMm'],
                            mark['Mark__WidthMm'], mark['Mark__HeightMm'], href,
                            { Class : style.Class, Aspect : mark['Mark__Aspect'] || 'xMidYMid meet' });
                    }
                    break;
                }

                default:
                    // A MARK TYPE THIS BUILD DOES NOT KNOW IS LEFT OUT, never
                    // approximated. Drawing a guess at somebody's title block is
                    // worse than leaving a gap they can see and report.
                    skipped++;
            }
        }

        Na__PubPaint__GroupEnd(sink);

        if (skipped > 0) {
            console.warn('[TrueVision3D PubDoc] ' + skipped + ' sheet mark(s) of a type this build does not know were left out of ' +
                         (context && context.DocumentId) + '. The document may have been published by a newer app.');
        }
        return Na__PubPaint__Done(sink);
    }
    // ------------------------------------------------------------


    // FUNCTION | The Layers a Published Sheet Declares, in Paint Order
    // ------------------------------------------------------------
    // Layer__Order 1 is FRONTMOST, exactly as the authoring side's layer stack
    // means it, so painting runs from the highest order number down. Getting
    // this backwards puts the viewports over the dimensions.
    // ------------------------------------------------------------
    function Na__PubSheet__LayersBackToFront(sheet) {
        const layers = (sheet && sheet['PublishedSheet__Layers']);
        if (!Array.isArray(layers)) return [];
        return layers
            .filter((one) => one && one['Layer__Visible'] !== false)
            .slice()
            .sort((a, b) => Number(b['Layer__Order'] || 0) - Number(a['Layer__Order'] || 0));
    }
    // ------------------------------------------------------------


    // FUNCTION | The Sheet's Published Lineweights
    // ------------------------------------------------------------
    function Na__PubSheet__Lineweights(sheet) {
        const block = (sheet && sheet['PublishedSheet__Lineweights']) || {};
        return {
            ViewportPt  : Number(block['ViewportPt'])  || 0.3,
            DimensionPt : Number(block['DimensionPt']) || 0.35
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__PubSheet__Paper,
        Na__PubSheet__Ground,
        Na__PubSheet__Marks,
        Na__PubSheet__LayersBackToFront,
        Na__PubSheet__Lineweights
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
