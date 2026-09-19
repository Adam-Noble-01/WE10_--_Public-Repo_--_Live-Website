// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SCRAPBOOK
// =============================================================================
//
// FILE       : Na__LayoutEditor__Scrapbook__.js
// NAMESPACE  : Na__LeScrap
// MODULE     : Layout Editor - Scrapbook
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Ready-made sheet items: read them from their config, preview them and put them on a sheet
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - Owns Na__LayoutEditor__Scrapbook__Config__.json: pieces (sheet records in
//   paper millimetres), the items the panel offers, made of pieces, the
//   tokens their text can quote and the panel's wording. SketchUp LayOut's
//   scrapbooks are the model.
// - An item is built into the item clipboard's set shape - entries, roots,
//   origin and size - and dropped through its InsertSet, so it lands as
//   ordinary records: fresh ids, text on the text layer, vectors on the
//   vector layer, grouped. It then moves, copies, prints, ungroups and undoes
//   like anything drawn by hand, and one drop is one undo step.
// - An item is built afresh for every preview and every drop, so {Year} is
//   always the year it lands in.
// - Nothing here touches the DOM: the preview is SVG markup, which the panel
//   puts in place.
//
// INTEGRATION:
// - Na__LayoutEditor__Panel__Scrapbook__ lists the items and drags them.
// // @delegate: ../30__System__SheetTools/Na__LayoutEditor__ItemClipboard__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific, but the
//                   first items are offered on site plan sheets, which
//                   ValeVision does not have.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.1.0
// - PreviewSvg draws a set's leaders and dimensions as well as its text and
//   vectors. It is the one preview every scrapbook library shares
//   (Na__LayoutEditor__Scrapbook__TileDrag__), and a Custom item may hold
//   either. A Standard piece is still text and vectors.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation: the Mapping Data Credentials block and the north
//   point, together and apart, for site plan sheets.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Records, Geometry, Markup, Chrome and the Item Clipboard
    // ------------------------------------------------------------
    import {
        Na__LeModel__DRAWING_ARCHITECTURAL,
        Na__LeModel__DRAWING_SITEPLAN,
        Na__LeModel__IsSitePlanSheet
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeRec__NormaliseAnnotation, Na__LeRec__NormaliseShape } from '../07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js';
    import { Na__LeShapeGeo__Bounds } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeMarkup__AnnotationBounds, Na__LeMarkup__BuildSheetPrimitives } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeChrome__ToSvgMarkup } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeClip__InsertSet } from '../30__System__SheetTools/Na__LayoutEditor__ItemClipboard__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location, Key Prefix and Statuses
    // ------------------------------------------------------------
    const Na__LeScrap__ConfigUrl      = new URL('./Na__LayoutEditor__Scrapbook__Config__.json', import.meta.url);
    const Na__LeScrap__PREFIX         = 'LayoutEditor__Scrapbook__';
    const Na__LeScrap__STATUS_LOADING = 'loading';
    const Na__LeScrap__STATUS_READY   = 'ready';
    const Na__LeScrap__STATUS_FAILED  = 'failed';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Record Kinds, Tokens, Circles and the Preview
    // ------------------------------------------------------------
    const Na__LeScrap__KIND_ANNOTATION = 'annotation';
    const Na__LeScrap__KIND_SHAPE      = 'shape';
    const Na__LeScrap__KIND_LEADER     = 'leader';                              // <-- Previewed only: a Standard piece is text and vectors
    const Na__LeScrap__KIND_DIMENSION  = 'dimension';
    const Na__LeScrap__YEAR_TOKEN      = 'Year';                                // <-- Built in: the year an item is dropped in
    const Na__LeScrap__TOKEN_PATTERN   = /\{([A-Za-z0-9_]+)\}/g;
    const Na__LeScrap__CIRCLE_SEGMENTS = Object.freeze({ min : 8, fallback : 64, max : 360 });
    const Na__LeScrap__PREVIEW_PAD_MM  = 0.6;                                   // <-- Room round a preview, so its outer edges are not clipped
    const Na__LeScrap__DECIMALS        = 10000;                                 // <-- Built coordinates keep four decimal places of a millimetre
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Fetched Config
    // ------------------------------------------------------------
    let Na__LeScrap__Config      = null;
    let Na__LeScrap__Status      = Na__LeScrap__STATUS_LOADING;
    let Na__LeScrap__LoadPromise = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch the Config Once
    // ------------------------------------------------------------
    // Never rejects: a missing or broken file is an empty scrapbook, not a
    // broken editor. The status tells the two apart for the panel.
    // ------------------------------------------------------------
    function Na__LeScrap__Ready() {
        if (!Na__LeScrap__LoadPromise) {
            Na__LeScrap__LoadPromise = (async () => {
                try {
                    const response = await fetch(Na__LeScrap__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeScrap__Config = await response.json();
                    Na__LeScrap__Status = Na__LeScrap__STATUS_READY;
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Scrapbook config unavailable - the Scrapbook has no items.', error);
                    Na__LeScrap__Config = null;
                    Na__LeScrap__Status = Na__LeScrap__STATUS_FAILED;
                }
                return Na__LeScrap__Config;
            })();
        }
        return Na__LeScrap__LoadPromise;
    }
    function Na__LeScrap__GetStatus() { return Na__LeScrap__Status; }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Block of the Config, or an Empty One
    // ------------------------------------------------------------
    function Na__LeScrap__Block(name) {
        const block = Na__LeScrap__Config ? Na__LeScrap__Config[Na__LeScrap__PREFIX + name] : null;
        return (block && typeof block === 'object' && !Array.isArray(block)) ? block : {};
    }
    // ------------------------------------------------------------


    // FUNCTION | A Label, With {tokens} Filled In
    // ------------------------------------------------------------
    function Na__LeScrap__Label(key, fallback, tokens) {
        const value = Na__LeScrap__Block('Labels')['Labels__' + key];
        let text = (typeof value === 'string') ? value : fallback;
        Object.keys(tokens || {}).forEach((name) => { text = text.split('{' + name + '}').join(String(tokens[name])); });
        return text;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Items
// -----------------------------------------------------------------------------

    // FUNCTION | Every Item the Config Offers, in Its Order
    // ------------------------------------------------------------
    function Na__LeScrap__Items() {
        const list = Na__LeScrap__Block('Items')['Items__List'];
        return (Array.isArray(list) ? list : []).filter((item) =>
            !!item && typeof item.Item__Id === 'string' && item.Item__Id !== '' && Array.isArray(item.Item__Pieces) && item.Item__Pieces.length > 0);
    }
    function Na__LeScrap__GetItem(itemId) {
        return Na__LeScrap__Items().find((item) => item.Item__Id === itemId) || null;
    }
    function Na__LeScrap__ItemName(item) {
        if (!item) return '';
        return (typeof item.Item__Name === 'string' && item.Item__Name.trim() !== '') ? item.Item__Name : item.Item__Id;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Items Offered on a Sheet, by Its Drawing Type
    // ------------------------------------------------------------
    // An item without Item__DrawingTypes is offered on every sheet.
    // ------------------------------------------------------------
    function Na__LeScrap__ItemsFor(sheet) {
        if (!sheet) return [];
        const type = Na__LeModel__IsSitePlanSheet(sheet) ? Na__LeModel__DRAWING_SITEPLAN : Na__LeModel__DRAWING_ARCHITECTURAL;
        return Na__LeScrap__Items().filter((item) => !Array.isArray(item.Item__DrawingTypes) || item.Item__DrawingTypes.indexOf(type) !== -1);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building an Item Into Records
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Coordinate Kept to a Tidy Number of Decimals
    // ------------------------------------------------------------
    function Na__LeScrap__Round(value) {
        return Math.round(value * Na__LeScrap__DECIMALS) / Na__LeScrap__DECIMALS;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Token Values - the Config's Own, and the Year
    // ------------------------------------------------------------
    function Na__LeScrap__Tokens() {
        const block  = Na__LeScrap__Block('Tokens');
        const tokens = {};
        Object.keys(block).forEach((key) => {
            if (key.indexOf('Tokens__') !== 0 || key === 'Tokens__Description') return;
            const value = block[key];
            if (typeof value === 'string' || typeof value === 'number') tokens[key.slice('Tokens__'.length)] = String(value);
        });
        tokens[Na__LeScrap__YEAR_TOKEN] = String(new Date().getFullYear());
        return tokens;
    }
    function Na__LeScrap__FillTokens(text, tokens) {
        return String(text).replace(Na__LeScrap__TOKEN_PATTERN, (match, name) => (Object.prototype.hasOwnProperty.call(tokens, name) ? tokens[name] : match));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Circle Written Out as a Closed Polygon
    // ------------------------------------------------------------
    // The first point sits at three o'clock; the rest run round clockwise on
    // the paper, which is y down.
    // ------------------------------------------------------------
    function Na__LeScrap__CirclePoints(spec) {
        const centre = Array.isArray(spec.CentreMm) ? spec.CentreMm : [ 0, 0 ];
        const cx     = Number(centre[0]) || 0;
        const cy     = Number(centre[1]) || 0;
        const radius = Number(spec.RadiusMm);
        if (!(radius > 0)) return [];
        const limits = Na__LeScrap__CIRCLE_SEGMENTS;
        const asked  = Number.isFinite(spec.Segments) ? Math.round(spec.Segments) : limits.fallback;
        const count  = Math.min(limits.max, Math.max(limits.min, asked));
        const points = [];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            points.push([ cx + (Math.cos(angle) * radius), cy + (Math.sin(angle) * radius) ]);
        }
        return points;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Piece Record as a Normalised Sheet Record, Moved by Its Piece's Offset
    // ------------------------------------------------------------
    // Ids and layers are dropped: InsertSet gives fresh ids, and a record with
    // no layer lands on the sheet's own text or vector layer. Null for anything
    // that is neither a text item nor a vector of two points or more.
    // ------------------------------------------------------------
    function Na__LeScrap__BuildRecord(raw, dx, dy, tokens) {
        if (!raw || typeof raw !== 'object') return null;
        const record = JSON.parse(JSON.stringify(raw));
        const kind   = record.Record__Kind;
        delete record.Record__Kind;

        if (kind === Na__LeScrap__KIND_ANNOTATION) {
            delete record.Annotation__Id;
            delete record.Annotation__LayerId;
            record.Annotation__Text   = Na__LeScrap__FillTokens(typeof record.Annotation__Text === 'string' ? record.Annotation__Text : '', tokens);
            record.Annotation__PosXMm = Na__LeScrap__Round((Number(record.Annotation__PosXMm) || 0) + dx);
            record.Annotation__PosYMm = Na__LeScrap__Round((Number(record.Annotation__PosYMm) || 0) + dy);
            if (Number.isFinite(record.Annotation__LeaderXMm)) record.Annotation__LeaderXMm = Na__LeScrap__Round(record.Annotation__LeaderXMm + dx);
            if (Number.isFinite(record.Annotation__LeaderYMm)) record.Annotation__LeaderYMm = Na__LeScrap__Round(record.Annotation__LeaderYMm + dy);
            return { kind : kind, record : Na__LeRec__NormaliseAnnotation(record, null) };
        }

        if (kind === Na__LeScrap__KIND_SHAPE) {
            delete record.Shape__Id;
            delete record.Shape__LayerId;
            if (record.Scrapbook__Circle && typeof record.Scrapbook__Circle === 'object') {
                record.Shape__Points = Na__LeScrap__CirclePoints(record.Scrapbook__Circle);
                record.Shape__Closed = true;
            }
            delete record.Scrapbook__Circle;
            const points = Array.isArray(record.Shape__Points) ? record.Shape__Points : [];
            record.Shape__Points = points
                .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
                .map((p) => [ Na__LeScrap__Round(p[0] + dx), Na__LeScrap__Round(p[1] + dy) ]);
            if (record.Shape__Points.length < 2) return null;
            return { kind : kind, record : Na__LeRec__NormaliseShape(record, null) };
        }
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Paper Box Round Text Items and Vectors
    // ------------------------------------------------------------
    function Na__LeScrap__Bounds(leaves) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        leaves.forEach((leaf) => {
            const box = (leaf.kind === Na__LeScrap__KIND_SHAPE) ? Na__LeShapeGeo__Bounds(leaf.record) : Na__LeMarkup__AnnotationBounds(leaf.record);
            if (!box) return;
            minX = Math.min(minX, box.X);
            minY = Math.min(minY, box.Y);
            maxX = Math.max(maxX, box.X + box.WidthMm);
            maxY = Math.max(maxY, box.Y + box.HeightMm);
        });
        if (!Number.isFinite(minX)) return { X : 0, Y : 0, WidthMm : 0, HeightMm : 0 };
        return { X : minX, Y : minY, WidthMm : maxX - minX, HeightMm : maxY - minY };
    }
    // ------------------------------------------------------------


    // FUNCTION | Build an Item Into the Item Clipboard's Set Shape
    // ------------------------------------------------------------
    // { kind : 'set', itemId, roots, entries, origin, size }. The entries list
    // every text item and vector first, in the order the pieces give them,
    // then the groups: each piece of two or more records, then the item itself
    // when it has two or more pieces, which InsertSet nests in that order.
    // roots is what a drop selects; origin and size are the paper box of the
    // whole item. Null for an unknown item, or one that builds to nothing.
    // ------------------------------------------------------------
    function Na__LeScrap__BuildSet(itemOrId) {
        const item = (typeof itemOrId === 'string') ? Na__LeScrap__GetItem(itemOrId) : itemOrId;
        if (!item || !Array.isArray(item.Item__Pieces)) return null;
        const pieces     = Na__LeScrap__Block('Pieces');
        const tokens     = Na__LeScrap__Tokens();
        const leaves     = [];
        const groups     = [];
        const pieceRoots = [];
        let   serial     = 0;
        const nextId     = (prefix) => prefix + String(++serial).padStart(3, '0');   // <-- Local to the set: InsertSet maps them to the sheet's own ids

        item.Item__Pieces.forEach((use) => {
            const piece   = (use && typeof use.Piece === 'string') ? pieces['Pieces__' + use.Piece] : null;
            const records = (piece && Array.isArray(piece.Piece__Records)) ? piece.Piece__Records : [];
            const offset  = (use && Array.isArray(use.OffsetMm)) ? use.OffsetMm : [ 0, 0 ];
            const dx      = Number(offset[0]) || 0;
            const dy      = Number(offset[1]) || 0;
            const members = [];
            records.forEach((raw) => {
                const built = Na__LeScrap__BuildRecord(raw, dx, dy, tokens);
                if (!built) return;
                const id = nextId(built.kind === Na__LeScrap__KIND_SHAPE ? 'ScrapShape_' : 'ScrapText_');
                leaves.push({ kind : built.kind, id : id, record : built.record });
                members.push({ kind : built.kind, id : id });
            });
            if (members.length === 0) return;
            if (members.length === 1) { pieceRoots.push(members[0]); return; }   // <-- A group of one is no group
            const groupId = nextId('ScrapGroup_');
            groups.push({ kind : 'group', id : groupId, record : { Group__Members : members } });
            pieceRoots.push({ kind : 'group', id : groupId });
        });
        if (leaves.length === 0) return null;

        let roots = pieceRoots;
        if (pieceRoots.length > 1) {
            const outerId = nextId('ScrapGroup_');
            groups.push({ kind : 'group', id : outerId, record : { Group__Members : pieceRoots.slice() } });
            roots = [ { kind : 'group', id : outerId } ];
        }

        const box = Na__LeScrap__Bounds(leaves);
        return {
            kind    : 'set',
            itemId  : item.Item__Id,
            roots   : roots,
            entries : leaves.concat(groups),
            origin  : { x : box.X, y : box.Y },
            size    : { WidthMm : box.WidthMm, HeightMm : box.HeightMm }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Preview and Drop
// -----------------------------------------------------------------------------

    // FUNCTION | An Item's Preview as SVG Markup
    // ------------------------------------------------------------
    // Drawn by the sheet's own markup builder from a sheet holding only the
    // item, so the preview is exactly what lands. Returns { markup, leftMm,
    // topMm, widthMm, heightMm }: the viewBox, which is the item's box with a
    // little room round it. The markup fills whatever box it is put in and
    // keeps its proportions - a tile fits it, and the drag ghost sizes it by
    // widthMm and heightMm at the sheet's zoom.
    // ------------------------------------------------------------
    function Na__LeScrap__PreviewSvg(set, className) {
        if (!set || !Array.isArray(set.entries)) return null;
        const sheet = { Sheet__Layers : [], Sheet__Shapes : [], Sheet__Annotations : [], Sheet__Dimensions : [], Sheet__Leaders : [], Sheet__Groups : [] };
        set.entries.forEach((entry) => {
            if (entry.kind === Na__LeScrap__KIND_SHAPE)      sheet.Sheet__Shapes.push(entry.record);
            if (entry.kind === Na__LeScrap__KIND_ANNOTATION) sheet.Sheet__Annotations.push(entry.record);
            if (entry.kind === Na__LeScrap__KIND_LEADER)     sheet.Sheet__Leaders.push(entry.record);      // <-- A Custom item may hold leaders and dimensions
            if (entry.kind === Na__LeScrap__KIND_DIMENSION)  sheet.Sheet__Dimensions.push(entry.record);
        });
        const pad      = Na__LeScrap__PREVIEW_PAD_MM;
        const leftMm   = set.origin.x - pad;
        const topMm    = set.origin.y - pad;
        const widthMm  = set.size.WidthMm  + (pad * 2);
        const heightMm = set.size.HeightMm + (pad * 2);
        const viewBox  = [ leftMm, topMm, widthMm, heightMm ].map(Na__LeScrap__Round).join(' ');
        const markup   = Na__LeChrome__ToSvgMarkup(Na__LeMarkup__BuildSheetPrimitives(sheet, null, null), widthMm, heightMm, className || '')
            .replace(/viewBox="[^"]*"/, 'viewBox="' + viewBox + '"')                                  // <-- The root's: the first in the markup
            .replace('preserveAspectRatio="none"', 'preserveAspectRatio="xMidYMid meet"');
        return { markup : markup, leftMm : leftMm, topMm : topMm, widthMm : widthMm, heightMm : heightMm };
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop an Item on a Sheet, Centred on a Paper Point
    // ------------------------------------------------------------
    // One undo step, kept on the paper the way a paste is. The item is
    // selected; the selected roots are returned, or null.
    // ------------------------------------------------------------
    function Na__LeScrap__Insert(sheet, itemId, centreMm) {
        if (!sheet || !centreMm || !Number.isFinite(centreMm.x) || !Number.isFinite(centreMm.y)) return null;
        const set = Na__LeScrap__BuildSet(itemId);
        if (!set) return null;
        const topLeft = { x : centreMm.x - (set.size.WidthMm / 2), y : centreMm.y - (set.size.HeightMm / 2) };
        return Na__LeClip__InsertSet(sheet, set, topLeft);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Scrapbook API
    // ------------------------------------------------------------
    export {
        Na__LeScrap__STATUS_LOADING,
        Na__LeScrap__STATUS_READY,
        Na__LeScrap__STATUS_FAILED,
        Na__LeScrap__Ready,
        Na__LeScrap__GetStatus,
        Na__LeScrap__Label,
        Na__LeScrap__ItemsFor,
        Na__LeScrap__GetItem,
        Na__LeScrap__ItemName,
        Na__LeScrap__Bounds,
        Na__LeScrap__BuildSet,
        Na__LeScrap__PreviewSvg,
        Na__LeScrap__Insert
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
