// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DOCUMENT PUBLISHING - SHEET AND ELEMENTS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Publish__Sheet__.js
// NAMESPACE  : Na__LePubSheet
// MODULE     : Layout Editor - Document Publishing - Sheet and Elements
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Split a sheet into its published sheet file and one element file per kind, each carrying the editor's own rendering of it
// SCHEMA REF : na-project-portal/26-Projects/AA00__ExampleProjectStructure/
//              30__TrueVision__AppContent/06__Layout__PublishedDocuments
//              ^ The readable schema. CHANGE A KEY HERE, CHANGE IT THERE.
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - TWO THINGS GO INTO EVERY ELEMENT FILE, and they do different jobs.
//     1. THE DATA: every element exactly as the sheet holds it - authoring keys
//        verbatim, so the file reads back into the editor - plus one resolved
//        key wherever the editor computes something at paint time: a
//        dimension's finished text, a room's square metres, a bubble's
//        specification note. That is the record, and it is what a future
//        layer switch or a search would read.
//     2. THE RENDERING: each layer's markup as the editor itself draws it -
//        Na__LeMarkup__BuildLayerPrimitives into Na__LeChrome__ToSvgMarkup,
//        the same two functions the screen and the PDF use - stored as
//        Elements__LayerSvg keyed by layer id. The reader inserts that as it
//        is. Nothing about a dimension's arrangement, a leader's elbow, a
//        hatch's seams or a title's refit is re-derived anywhere: the reader
//        paints what the editor painted.
// - THE PAINT PLAN IS PUBLISHED, NOT GUESSED. Na__LePaint__Plan decides what is
//   under what - and the sheet's own paper (border, title block, notes margin)
//   goes directly over the FRONTMOST group that shows a viewport, not under
//   everything. PublishedSheet__PaintPlan records those steps so the reader
//   stacks the page exactly as the PDF does.
// - PICTURES ARE NEVER EMBEDDED. The editor draws a sheet picture from wherever
//   it loaded it (the repository on localhost, a blob just after a drop), and a
//   logo or a classic title block scan as a data: URL. None of that belongs in a
//   published file. A sheet picture becomes a reference to its own file in
//   05__Layout__DrawingDocs__Images; any other embedded image is stored once, by
//   its hash, in the shared images folder, and referenced. References are
//   written as href="na-published:<ref>" and resolved by the reader.
// - IT CHANGES NOTHING. Every function called here is a reader of the sheet;
//   the sheet object is never written to. Publishing is not an edit.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Created with Phase 4 of TrueVision__PLAN__PublishingSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    import { Na__LeLayout__Solve } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import { Na__LeModel__GetFields } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeChrome__Build, Na__LeChrome__ToSvgMarkup } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    import {
        Na__LeMarkup__BuildLayerPrimitives, Na__LeMarkup__FormatDimension, Na__LeMarkup__DimensionValueMm
    } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LePaint__Plan, Na__LePaint__STEP_VIEWPORT, Na__LePaint__STEP_SHEET } from '../15__Core__Markup/Na__LayoutEditor__PaintOrder__.js';
    import { Na__LeMargin__Push } from '../50__Feature__Specification/Na__LayoutEditor__SpecMargin__.js';
    import { Na__LeSpec__GetNoteEntry } from '../50__Feature__Specification/Na__LayoutEditor__SpecData__Document__.js';
    import { Na__LeArea__Is, Na__LeArea__Value, Na__LeArea__NameOf, Na__LeArea__FormatArea } from '../59__Feature__FloorAreas/Na__LayoutEditor__FloorAreas__.js';

    import { Na__PubSchema__Kind, Na__PubSchema__Get } from '../../53__Data__Layout__PublishedSchema/Na__PublishedSchema__Paths__.js';

    import { Na__LePubRas__Hash } from './Na__LayoutEditor__Publish__Raster__.js';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    const Na__LePubSheet__TOKEN      = 'na-published:';                           // <-- An href the reader resolves
    const Na__LePubSheet__IMAGES_DIR = '05__Layout__DrawingDocs__Images';
    const Na__LePubSheet__SVG_BODY   = /^<svg\b[^>]*>([\s\S]*)<\/svg>\s*$/;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pictures and Embedded Images
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Where Each Sheet Picture Is Filed, by File Name
    // ------------------------------------------------------------
    // A stored picture's name ends in its own hash, so a file name is unique
    // and is enough to find its folder.
    // ------------------------------------------------------------
    function Na__LePubSheet__PictureFolders(sheet) {
        const map = new Map();
        (sheet.Sheet__Shapes || []).forEach((shape) => {
            const block = shape && shape.Shape__Image;
            if (block && block.Image__File && block.Image__Folder) map.set(block.Image__File, block.Image__Folder);
        });
        return map;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Data Url's Bytes and Extension
    // ------------------------------------------------------------
    function Na__LePubSheet__DataUrlBlob(dataUrl) {
        const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(String(dataUrl));
        if (!match) return null;
        const type = match[1];
        const ext  = ({ 'image/png' : 'png', 'image/webp' : 'webp', 'image/jpeg' : 'jpg', 'image/svg+xml' : 'svg' })[type];
        if (!ext) return null;
        let bytes;
        if (match[2]) {
            const binary = atob(match[3]);
            bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        } else {
            bytes = new TextEncoder().encode(decodeURIComponent(match[3]));
        }
        return { blob : new Blob([ bytes ], { type : type }), ext : ext === 'jpg' ? 'jpg' : ext };
    }
    // ------------------------------------------------------------


    // FUNCTION | Make a Primitive List Portable: Every Image Becomes a Reference
    // ------------------------------------------------------------
    // Walks the list and its groups, returning a COPY in which:
    //   - a sheet picture's href is its file in 05__Layout__DrawingDocs__Images,
    //     and it is marked ready so the painter emits the picture, not a
    //     "Loading picture" placeholder;
    //   - an embedded data: image is stored once, by hash, in the shared images
    //     folder and referenced there.
    // assets collects { Path, Blob } for every shared image this list needed.
    // ------------------------------------------------------------
    async function Na__LePubSheet__Portable(primitives, sheet, assets) {
        const folders = Na__LePubSheet__PictureFolders(sheet);
        const shared  = Na__PubSchema__Get().folders.sharedImages;

        const walk = async (list) => {
            const out = [];
            for (const primitive of list) {
                if (!primitive || typeof primitive !== 'object') continue;
                const copy = Object.assign({}, primitive);

                if (copy.Kind === 'picture') {
                    const file   = String(copy.PdfKey || '').split('|')[0];
                    const folder = folders.get(file);
                    if (file && folder) {
                        copy.Href    = Na__LePubSheet__TOKEN + '/../' + Na__LePubSheet__IMAGES_DIR + '/' + folder + '/' + file;
                        copy.State   = 'ready';
                        copy.Caption = '';
                    }
                } else if (copy.Kind === 'image' && typeof copy.DataUrl === 'string' && copy.DataUrl.indexOf('data:') === 0) {
                    const decoded = Na__LePubSheet__DataUrlBlob(copy.DataUrl);
                    if (decoded) {
                        const hash = await Na__LePubRas__Hash(decoded.blob);
                        const path = shared + '/Image__' + hash + '.' + decoded.ext;
                        if (!assets.some((one) => one.Path === path)) assets.push({ Path : path, Blob : decoded.blob });
                        copy.DataUrl = Na__LePubSheet__TOKEN + '/' + path;
                    }
                }

                if (Array.isArray(copy.Children)) copy.Children = await walk(copy.Children);
                out.push(copy);
            }
            return out;
        };
        return walk(Array.isArray(primitives) ? primitives : []);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Primitive List as Svg Markup, the Editor's Own Converter, Unwrapped
    // ------------------------------------------------------------
    // Na__LeChrome__ToSvgMarkup wraps its output in an <svg> the size of the
    // page; the published sheet already is one, so only the body is kept.
    // ------------------------------------------------------------
    function Na__LePubSheet__Svg(primitives, layout) {
        if (!Array.isArray(primitives) || primitives.length === 0) return '';
        const whole = Na__LeChrome__ToSvgMarkup(primitives, layout.Page.WidthMm, layout.Page.HeightMm, '');
        const match = Na__LePubSheet__SVG_BODY.exec(whole);
        return match ? match[1] : '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Resolved Keys
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Dimension With Its Finished Text
    // ------------------------------------------------------------
    // The one text maker the drawing uses: precision, units, the at-scale
    // value, round-up-to-5 and its marker, or the override as typed.
    // ------------------------------------------------------------
    function Na__LePubSheet__Dimension(sheet, dim) {
        const out = Object.assign({}, dim);
        try {
            out.Dimension__Text = Na__LeMarkup__FormatDimension(dim, Na__LeMarkup__DimensionValueMm(sheet, dim));
        } catch (error) {
            out.Dimension__Text = (typeof dim.Dimension__OverrideText === 'string') ? dim.Dimension__OverrideText : null;
        }
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Floor Area Shape With Its Square Metres and Label
    // ------------------------------------------------------------
    // Square metres are never stored on the authoring side - they are worked
    // out from the polygon on every paint. Published, they are a number and a
    // string, written INSIDE the shape's own Shape__Area block beside the
    // Area__ keys it already has.
    // ------------------------------------------------------------
    function Na__LePubSheet__Area(shape) {
        const out   = Object.assign({}, shape);
        const block = Object.assign({}, shape.Shape__Area || {});
        try {
            const value = Na__LeArea__Value(shape);
            block.Area__AreaM2   = Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
            const name = Na__LeArea__NameOf(shape) || block.Area__Name || '';
            block.Area__LabelText = Number.isFinite(value) ? (name ? (name + '\n') : '') + Na__LeArea__FormatArea(value) : name;
        } catch (error) {
            block.Area__AreaM2 = null;
            block.Area__LabelText = block.Area__Name || null;
        }
        out.Shape__Area = block;
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Leader With Its Specification Note Travelling With It
    // ------------------------------------------------------------
    // So tapping a bubble can say what it means without the reader ever loading
    // the specification document. A note that has been created but not written
    // is published with null text, and the reader offers nothing for it.
    // ------------------------------------------------------------
    function Na__LePubSheet__Leader(leader) {
        const out   = Object.assign({}, leader);
        const entry = leader.Leader__SpecNoteId ? Na__LeSpec__GetNoteEntry(leader.Leader__SpecNoteId) : null;
        const note  = entry ? (entry.note || {}) : null;
        out.Leader__SpecCode    = entry ? (entry.code || null) : null;
        out.Leader__SpecHeading = (note && typeof note.Note__Title === 'string' && note.Note__Title.trim()) ? note.Note__Title.trim() : null;
        out.Leader__SpecText    = (note && typeof note.Note__Body === 'string' && note.Note__Body.trim()) ? note.Note__Body.trim() : null;
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Element Files
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Empty Element File of a Kind
    // ------------------------------------------------------------
    function Na__LePubSheet__EmptyFile(kind, documentId) {
        const whole = {
            'Elements__Meta' : {
                'Meta__FileName'  : kind.file,
                'Meta__Kind'      : kind.name,
                'Meta__LayerType' : kind.layerType,
                'Meta__Document'  : documentId,
                'Meta__SchemaRef' : 'na-project-portal/26-Projects/AA00__ExampleProjectStructure/30__TrueVision__AppContent/06__Layout__PublishedDocuments',
                'Meta__Note'      : 'Published by TrueVision. The array is the elements as the sheet holds them, authoring keys verbatim, with resolved keys added. Elements__LayerSvg is each layer\'s markup exactly as the editor draws it; the reader paints that.'
            }
        };
        whole[kind.arrayKey] = [];
        whole['Elements__LayerSvg'] = {};
        return whole;
    }
    // ------------------------------------------------------------


    // FUNCTION | Split a Sheet Into Its Element Files
    // ------------------------------------------------------------
    // Returns { files: { kindName: whole }, counts: { kindName: n } }. Viewports
    // are NOT filled here - the viewport baker writes their entries, because
    // each one needs its baked files' names first.
    // ------------------------------------------------------------
    function Na__LePubSheet__Split(sheet, documentId) {
        const files = {};
        const file  = (name) => {
            if (!files[name]) files[name] = Na__LePubSheet__EmptyFile(Na__PubSchema__Kind(name), documentId);
            return files[name];
        };
        const push = (name, element) => file(name)[Na__PubSchema__Kind(name).arrayKey].push(element);

        (sheet.Sheet__Dimensions || []).forEach((dim) => push('dimension', Na__LePubSheet__Dimension(sheet, dim)));
        (sheet.Sheet__Annotations || []).forEach((note) => push('annotation', Object.assign({}, note)));
        (sheet.Sheet__Leaders || []).forEach((leader) => push('leader', Na__LePubSheet__Leader(leader)));
        (sheet.Sheet__Groups || []).forEach((group) => push('group', Object.assign({}, group)));

        // SHAPES BY WHAT THEY ARE, NOT BY WHICH LAYER THEY SIT ON. A floor area
        // is a shape carrying a Shape__Area block and a picture one carrying a
        // Shape__Image block; everything else is a vector.
        (sheet.Sheet__Shapes || []).forEach((shape) => {
            if (Na__LeArea__Is(shape))  push('area', Na__LePubSheet__Area(shape));
            else if (shape.Shape__Image) push('image', Object.assign({}, shape));
            else                         push('vector', Object.assign({}, shape));
        });
        if (Array.isArray(sheet.Sheet__AreaGroups) && sheet.Sheet__AreaGroups.length) {
            file('area')['Elements__AreaGroups'] = sheet.Sheet__AreaGroups.map((group) => Object.assign({}, group));
        }

        const counts = {};
        Object.keys(files).forEach((name) => { counts[name] = files[name][Na__PubSchema__Kind(name).arrayKey].length; });
        return { files : files, counts : counts };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Sheet File
// -----------------------------------------------------------------------------

    // FUNCTION | Build the Published Sheet and Every Layer's Rendering
    // ------------------------------------------------------------
    // Returns {
    //   Sheet    : the Document__Sheet__.json object,
    //   Files    : { kindName: element file object } - LayerSvg filled in,
    //   Counts   : { kindName: n },
    //   Assets   : [ { Path, Blob } ] - shared images the markup references,
    //   Layout   : the solved layout (the viewport baker needs the page),
    //   Plan     : the raw paint plan (viewport objects included)
    // }
    // ------------------------------------------------------------
    // FUNCTION | A Sheet's Own Paper: Notes Margin, Border, Title Block, QR
    // ------------------------------------------------------------
    // Exactly as the PDF builds it: the chrome once, the classic scan pulled
    // out to go under everything, the notes margin under the border's edge.
    // Needs no model and no render, which is why the index can carry it for a
    // drawing that has NOT been published - the reader can then show the right
    // sheet, number and title behind the grey panel.
    // ------------------------------------------------------------
    async function Na__LePubSheet__Furniture(sheet, assets) {
        const layout = Na__LeLayout__Solve(sheet);
        const fields = Na__LeModel__GetFields(sheet);
        const chrome = Na__LeChrome__Build(layout, sheet, { fields : fields, includeFrames : false });
        const scans  = (layout.TitleBlockStyle === 'classic') ? chrome.filter((p) => p.Kind === 'image') : [];
        const rest   = (layout.TitleBlockStyle === 'classic') ? chrome.filter((p) => p.Kind !== 'image') : chrome;
        const margin = [];
        Na__LeMargin__Push(margin, sheet, layout);                              // <-- The notes column's paper, then the border and title block over its edge
        return {
            Layout       : layout,
            Fields       : fields,
            UnderlaySvg  : Na__LePubSheet__Svg(await Na__LePubSheet__Portable(scans, sheet, assets), layout),
            FurnitureSvg : Na__LePubSheet__Svg(await Na__LePubSheet__Portable(margin.concat(rest), sheet, assets), layout)
        };
    }
    // ------------------------------------------------------------


    async function Na__LePubSheet__Build(sheet, documentId) {
        const assets = [];
        const split  = Na__LePubSheet__Split(sheet, documentId);
        const paper  = await Na__LePubSheet__Furniture(sheet, assets);
        const layout = paper.Layout;
        const fields = paper.Fields;
        const underlaySvg  = paper.UnderlaySvg;
        const furnitureSvg = paper.FurnitureSvg;

        // THE PLAN | What is under what, as the PDF stacks it
        const plan  = Na__LePaint__Plan(sheet);
        const steps = plan.map((step) => {
            if (step.kind === Na__LePaint__STEP_VIEWPORT) return { 'Step__Kind' : 'viewport', 'Step__Id' : step.viewport.Viewport__Id, 'Step__LayerId' : step.layerId };
            if (step.kind === Na__LePaint__STEP_SHEET)    return { 'Step__Kind' : 'sheet' };
            return { 'Step__Kind' : 'layer', 'Step__LayerId' : step.layerId };
        });

        // EACH LAYER'S MARKUP, as the editor draws it, into the element file of
        // the layer's own type. A layer whose type has no elements of its own
        // still gets its file when it has markup to show.
        const layers   = Array.isArray(sheet.Sheet__Layers) ? sheet.Sheet__Layers : [];
        const typeOf   = new Map(layers.map((layer) => [ layer.Layer__Id, layer.Layer__Type ]));
        for (const step of plan) {
            if (step.kind === Na__LePaint__STEP_VIEWPORT || step.kind === Na__LePaint__STEP_SHEET) continue;
            const primitives = await Na__LePubSheet__Portable(Na__LeMarkup__BuildLayerPrimitives(sheet, step.layerId, null), sheet, assets);
            const svg = Na__LePubSheet__Svg(primitives, layout);
            if (!svg) continue;
            const kind = Na__PubSchema__Kind(typeOf.get(step.layerId) || 'vector') || Na__PubSchema__Kind('vector');
            if (!split.files[kind.name]) {
                split.files[kind.name] = Na__LePubSheet__EmptyFile(kind, documentId);
                split.counts[kind.name] = 0;
            }
            split.files[kind.name]['Elements__LayerSvg'][step.layerId === null ? '__unlayered' : step.layerId] = svg;
        }

        const kindOfLayer = (layerType) => {
            const kind = Na__PubSchema__Kind(layerType);
            return kind ? kind : Na__PubSchema__Kind('vector');
        };

        const sheetFile = {
            'PublishedSheet__Meta' : {
                'Meta__FileName'    : Na__PubSchema__Get().files.sheet,
                'Meta__Document'    : documentId,
                'Meta__SourceSheet' : sheet.Sheet__Id,
                'Meta__SchemaRef'   : 'na-project-portal/26-Projects/AA00__ExampleProjectStructure/30__TrueVision__AppContent/06__Layout__PublishedDocuments'
            },
            'PublishedSheet__Paper' : {
                'Paper__Size'          : layout.Page.SizeKey || layout.Page.Label || null,
                'Paper__Orientation'   : layout.Page.Orientation,
                'Paper__WidthMm'       : layout.Page.WidthMm,
                'Paper__HeightMm'      : layout.Page.HeightMm,
                'Paper__OriginCorner'  : 'top-left',
                'Paper__AxisX'         : 'right',
                'Paper__AxisY'         : 'down',
                'Paper__DrawingAreaMm' : { 'X' : layout.Drawing.X, 'Y' : layout.Drawing.Y, 'WidthMm' : layout.Drawing.WidthMm, 'HeightMm' : layout.Drawing.HeightMm }
            },
            'PublishedSheet__TitleBlock' : {
                'TitleBlock__Style'    : layout.TitleBlockStyle,
                'TitleBlock__HeightMm' : layout.TitleBlock ? layout.TitleBlock.HeightMm : null,
                'TitleBlock__Fields'   : {
                    'Fields__DocumentId'    : fields.DocumentId,
                    'Fields__DrawingNumber' : fields.DrawingNumber,
                    'Fields__Phase'         : fields.Phase,
                    'Fields__Title'         : fields.Title,
                    'Fields__Revision'      : fields.Revision,
                    'Fields__Status'        : fields.Status,
                    'Fields__Scale'         : fields.Scale,
                    'Fields__Client'        : fields.Client,
                    'Fields__SiteAddress'   : fields.SiteAddress,
                    'Fields__DrawnBy'       : fields.DrawnBy,
                    'Fields__DateIssued'    : fields.Date
                },
                'TitleBlock__Note'     : 'A record of what the title block says. The reader does not draw the title block from this - it draws PublishedSheet__FurnitureSvg, which is the title block exactly as the editor drew it.'
            },
            'PublishedSheet__Layers' : layers.map((layer) => {
                const kind = kindOfLayer(layer.Layer__Type);
                return {
                    'Layer__Id'      : layer.Layer__Id,
                    'Layer__Name'    : layer.Layer__Name,
                    'Layer__Type'    : layer.Layer__Type,
                    'Layer__Order'   : layer.Layer__Order,
                    'Layer__Visible' : layer.Layer__Visible !== false,
                    'Layer__File'    : Na__PubSchema__Get().folders.elements + '/' + kind.file
                };
            }),
            'PublishedSheet__Lineweights'   : Object.assign({}, sheet.Sheet__Lineweights || {}),
            'PublishedSheet__MarginNotes'   : Object.assign({}, sheet.Sheet__MarginNotes || {}),
            'PublishedSheet__PaintPlan'     : steps,
            'PublishedSheet__PaintPlanNote' : 'The page from the back forwards, exactly as the PDF lays it: each layer group\'s viewports, then (directly over the frontmost group that shows a viewport) the sheet\'s own paper, then that group\'s markup.',
            'PublishedSheet__UnderlaySvg'   : underlaySvg,
            'PublishedSheet__FurnitureSvg'  : furnitureSvg,
            'PublishedSheet__FurnitureNote' : 'The notes margin, border, title block and QR block as the editor drew them, painted at the plan\'s sheet step. Hrefs written na-published:<ref> are resolved by the reader.'
        };

        return { Sheet : sheetFile, Files : split.files, Counts : split.counts, Assets : assets, Layout : layout, Plan : plan, Fields : fields };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    export {
        Na__LePubSheet__TOKEN,
        Na__LePubSheet__Furniture,
        Na__LePubSheet__Build,
        Na__LePubSheet__Split,
        Na__LePubSheet__Portable,
        Na__LePubSheet__Svg
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
