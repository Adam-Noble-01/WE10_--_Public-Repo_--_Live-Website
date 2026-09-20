// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PARAMETRIC SCRAPBOOK
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookParametric__.js
// NAMESPACE  : Na__LeParam
// MODULE     : Layout Editor - Parametric Scrapbook (the engine)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Scripted sheet elements that keep answering to their parameters: the block a group carries, the element types, the drop and the regeneration
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - A PARAMETRIC ELEMENT IS A GROUP. It lands through the item clipboard's
//   InsertSet as ordinary vectors and text, grouped, so it moves, copies,
//   prints, exports and undoes like anything drawn by hand, and no other
//   module has to learn that it exists. What makes it parametric is one
//   block on the group record, which every part of the editor already
//   carries untouched (NormaliseGroup rewrites Group__Members and nothing
//   else):
//       Group__Parametric : { Parametric__Type, Parametric__Version,
//                             Parametric__Params, Parametric__Link }
// - AN ELEMENT TYPE is registered here as a definition whose build is pure:
//   parameters in, records out, in paper millimetres from an origin of
//   (0, 0). It knows nothing of sheets, ids, layers or the DOM.
// - THE ORIGIN IS NEVER STORED. The Move tool, the arrow keys and a paste
//   shift a group's members and know nothing of this block, so a stored
//   origin would be stale after the first move. Every type writes its origin
//   as the first point of its first vector, and AnchorOf reads it back.
// - REGENERATION EDITS IN PLACE. Members are updated slot for slot, extra
//   ones inserted, left-over ones deleted. Ids stay put, so an undo snapshot
//   and the browser draft barely change, the element keeps its place in the
//   draw order, and it stays on whatever layer it has been moved to.
//   Everything is silent until one announcement, so one change is one undo
//   step however many records it touched.
// - UNGROUP IS EXPLODE. The vectors and text stay; the block goes with the
//   group record.
// - A TYPE STAYS PURE BY BEING HANDED WHAT IT CANNOT REACH. build and handles
//   are given a tools object - today one thing, a way to measure text on the
//   paper - which the panel sets from the editor's own chrome. A type that
//   ignores it, or runs under Node where there is none, draws all the same.
// - AN ELEMENT IS A PRESET OF A TYPE. The library lists elements; two may be
//   one type with different Element__Params, as the Drawing Title is offered
//   with its scale bar and without.
//
// INTEGRATION:
// - Na__LayoutEditor__ScrapbookParametric__ScaleBar__ is the first type.
// - Na__LayoutEditor__ScrapbookParametric__DrawingTitle__ is the second.
// - Na__LayoutEditor__ScrapbookParametric__ViewportLink__ owns Parametric__Link.
// - Na__LayoutEditor__ScrapbookParametric__Grips__ draws and drags the grips.
// - Na__LayoutEditor__Panel__ScrapbookParametric__ registers the types and
//   the two panel sections; it is the subsystem's one entry point.
// // @delegate: ../30__System__SheetTools/Na__LayoutEditor__ItemClipboard__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : not yet ported. Needs ItemClipboard 1.1.0 (InsertSet),
//                   SheetModel Groups 1.1.0 (DeleteItems silent),
//                   Grips 1.8.0 (RegisterGroupProvider) and
//                   Groups 1.2.0 (RegisterLabeller).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.2.0
// - For the Drawing Title. SetTools: build and handles are handed a tools
//   object (measureTextMm). ResetToStandard takes options.patch, so a change
//   of scale and a change of the facts a title is written from are one
//   rebuild. Elements are presets: ElementId, ElementParams and
//   ElementPreviewParams, and a type's name may come from
//   Elements__TypeNames. A type may name the parameters the link module
//   fills from a viewport (definition.facts).
//
// 19-Sep-2026 - Version 1.1.0
// - HandlesOf passes every grip point a type gives, by the name it gives it
//   (the link socket, for the link noodle).
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation: the config, the type registry, the block,
//   BuildSet, Insert, Regenerate, AnchorOf and Portable.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Records, Groups, the Host's Bounds and the Item Clipboard
    // ------------------------------------------------------------
    import {
        Na__LeModel__DRAWING_ARCHITECTURAL,
        Na__LeModel__DRAWING_SITEPLAN,
        Na__LeModel__IsSitePlanSheet,
        Na__LeModel__GetGroups,
        Na__LeModel__GetGroupById,
        Na__LeModel__GetShapeById,
        Na__LeModel__GetAnnotationById,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__InsertShape,
        Na__LeModel__InsertAnnotation,
        Na__LeModel__UpdateShape,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__DeleteItems,
        Na__LeModel__MarkDirty
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeRec__NormaliseAnnotation, Na__LeRec__NormaliseShape } from '../07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js';
    import { Na__LeGroup__Bounds } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LeScrap__Bounds } from '../55__Feature__Scrapbook/Na__LayoutEditor__Scrapbook__.js';
    import { Na__LeClip__InsertSet } from '../30__System__SheetTools/Na__LayoutEditor__ItemClipboard__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location, Key Prefix, Statuses and the Block
    // ------------------------------------------------------------
    const Na__LeParam__ConfigUrl      = new URL('./Na__LayoutEditor__ScrapbookParametric__Config__.json', import.meta.url);
    const Na__LeParam__PREFIX         = 'LayoutEditor__ScrapbookParametric__';
    const Na__LeParam__STATUS_LOADING = 'loading';
    const Na__LeParam__STATUS_READY   = 'ready';
    const Na__LeParam__STATUS_FAILED  = 'failed';
    const Na__LeParam__FIELD          = 'Group__Parametric';                    // <-- The block on a group record
    const Na__LeParam__BLOCK_VERSION  = 1;
    const Na__LeParam__KIND_SHAPE      = 'shape';
    const Na__LeParam__KIND_ANNOTATION = 'annotation';
    const Na__LeParam__DECIMALS       = 10000;                                  // <-- Built coordinates keep four decimal places of a millimetre
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Fetched Config and the Registered Types
    // ------------------------------------------------------------
    let   Na__LeParam__Config      = null;
    let   Na__LeParam__Status      = Na__LeParam__STATUS_LOADING;
    let   Na__LeParam__LoadPromise = null;
    const Na__LeParam__Types       = new Map();     // <-- type name -> definition
    let   Na__LeParam__Tools       = Object.freeze({});   // <-- What a type's build and handles are handed: { measureTextMm(text, sizeMm, weight) }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch the Config Once
    // ------------------------------------------------------------
    // Never rejects: a missing or broken file is an empty library, not a
    // broken editor. The status tells the two apart for the panel. An element
    // already on a sheet still draws - it is plain records - but cannot be
    // regenerated until the config reads.
    // ------------------------------------------------------------
    function Na__LeParam__Ready() {
        if (!Na__LeParam__LoadPromise) {
            Na__LeParam__LoadPromise = (async () => {
                try {
                    const response = await fetch(Na__LeParam__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeParam__Config = await response.json();
                    Na__LeParam__Status = Na__LeParam__STATUS_READY;
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Parametric Scrapbook config unavailable - it has no elements.', error);
                    Na__LeParam__Config = null;
                    Na__LeParam__Status = Na__LeParam__STATUS_FAILED;
                }
                return Na__LeParam__Config;
            })();
        }
        return Na__LeParam__LoadPromise;
    }
    function Na__LeParam__GetStatus() { return Na__LeParam__Status; }
    // ------------------------------------------------------------


    // FUNCTION | One Block of the Config, or an Empty One
    // ------------------------------------------------------------
    function Na__LeParam__Block(name) {
        const block = Na__LeParam__Config ? Na__LeParam__Config[Na__LeParam__PREFIX + name] : null;
        return (block && typeof block === 'object' && !Array.isArray(block)) ? block : {};
    }
    // ------------------------------------------------------------


    // FUNCTION | A Label, With {tokens} Filled In
    // ------------------------------------------------------------
    function Na__LeParam__Label(key, fallback, tokens) {
        const value = Na__LeParam__Block('Labels')['Labels__' + key];
        let text = (typeof value === 'string') ? value : fallback;
        Object.keys(tokens || {}).forEach((name) => { text = text.split('{' + name + '}').join(String(tokens[name])); });
        return text;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Element Types
// -----------------------------------------------------------------------------

    // FUNCTION | Register an Element Type
    // ------------------------------------------------------------
    // definition: {
    //     type                        the name a block carries
    //     keep                        the parameters a change of scale leaves alone
    //     facts                       the parameters the link module fills from the
    //                                 viewport an element is tied to (optional)
    //     defaults(denominator)       the standard parameters at a scale
    //     normalise(params)           made whole and held inside its limits
    //     build(params, tools)        { records : [{ kind, record }] } from an
    //                                 origin of (0, 0), the first record a
    //                                 vector whose first point IS (0, 0)
    //     handles(params)             { stretch, lookup } as { x, y } from the origin
    //     stretchTo(params, xMm, yMm) the parameters a stretch grip at that point gives
    //     describe(params)            { real, paper } for the panel's length line
    // }
    // ------------------------------------------------------------
    function Na__LeParam__RegisterType(definition) {
        if (!definition || typeof definition.type !== 'string' || definition.type === '' || typeof definition.build !== 'function') return false;
        Na__LeParam__Types.set(definition.type, definition);
        return true;
    }
    function Na__LeParam__GetType(type) {
        return Na__LeParam__Types.get(type) || null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Set What a Type's Build and Handles Are Handed
    // ------------------------------------------------------------
    // tools: { measureTextMm(text, sizeMm, weight) -> paper millimetres }.
    // A type is pure - it imports no DOM and no editor module - so whatever
    // it needs from the editor arrives here. The panel sets it once.
    // ------------------------------------------------------------
    function Na__LeParam__SetTools(tools) {
        Na__LeParam__Tools = Object.freeze(Object.assign({}, (tools && typeof tools === 'object') ? tools : {}));
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Elements the Library Offers on a Sheet, by Its Drawing Type
    // ------------------------------------------------------------
    // Only elements whose type is registered. An element without
    // Element__DrawingTypes is offered on every sheet.
    // ------------------------------------------------------------
    function Na__LeParam__ElementsFor(sheet) {
        if (!sheet) return [];
        const list = Na__LeParam__Block('Elements')['Elements__List'];
        const type = Na__LeModel__IsSitePlanSheet(sheet) ? Na__LeModel__DRAWING_SITEPLAN : Na__LeModel__DRAWING_ARCHITECTURAL;
        return (Array.isArray(list) ? list : []).filter((element) =>
            !!element && Na__LeParam__Types.has(element.Element__Type)
            && (!Array.isArray(element.Element__DrawingTypes) || element.Element__DrawingTypes.indexOf(type) !== -1));
    }
    function Na__LeParam__ElementName(element) {
        if (!element) return '';
        return (typeof element.Element__Name === 'string' && element.Element__Name.trim() !== '') ? element.Element__Name : element.Element__Type;
    }
    // ------------------------------------------------------------


    // FUNCTION | An Element's Id, the Parameters It Presets and the Ones Its Tile Is Drawn With
    // ------------------------------------------------------------
    // An element is a preset of a type. Its id is its own - two elements may
    // share a type - and falls back to the type. Element__Params go onto
    // every element dropped from it. Element__PreviewParams are added for
    // the tile and the drag ghost only, so a title's tile can read EXISTING
    // EAST ELEVATION where a real drop reads its own viewport.
    // ------------------------------------------------------------
    function Na__LeParam__ElementId(element) {
        if (!element) return '';
        return (typeof element.Element__Id === 'string' && element.Element__Id.trim() !== '') ? element.Element__Id.trim() : String(element.Element__Type || '');
    }
    function Na__LeParam__ElementParams(element) {
        const params = element ? element.Element__Params : null;
        return (params && typeof params === 'object' && !Array.isArray(params)) ? JSON.parse(JSON.stringify(params)) : {};
    }
    function Na__LeParam__ElementPreviewParams(element) {
        const preview = element ? element.Element__PreviewParams : null;
        return Object.assign(Na__LeParam__ElementParams(element), (preview && typeof preview === 'object' && !Array.isArray(preview)) ? JSON.parse(JSON.stringify(preview)) : {});
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Type Is Called, for the Sheet and the Panel
    // ------------------------------------------------------------
    // The config's Elements__TypeNames entry for it; else the name of the
    // first element the config lists of that type; else the type's own name.
    // ------------------------------------------------------------
    function Na__LeParam__TypeName(type) {
        const names = Na__LeParam__Block('Elements')['Elements__TypeNames'];
        if (names && typeof names === 'object' && typeof names[type] === 'string' && names[type].trim() !== '') return names[type].trim();
        const list = Na__LeParam__Block('Elements')['Elements__List'];
        return Na__LeParam__ElementName((Array.isArray(list) ? list : []).find((element) => !!element && element.Element__Type === type) || { Element__Type : type });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Block on a Group
// -----------------------------------------------------------------------------

    // FUNCTION | A Group's Parametric Block, or Null
    // ------------------------------------------------------------
    // Null for a plain group, and for a block whose type is not registered:
    // an element from a newer build, or a hand-edited file, stays a group that
    // can be moved and printed, and nothing here ever rewrites it.
    // ------------------------------------------------------------
    function Na__LeParam__GetBlock(group) {
        const block = group ? group[Na__LeParam__FIELD] : null;
        if (!block || typeof block !== 'object' || Array.isArray(block)) return null;
        if (!Na__LeParam__Types.has(block.Parametric__Type)) return null;
        return block;
    }
    function Na__LeParam__GetBlockById(sheet, groupId) {
        return Na__LeParam__GetBlock(sheet ? Na__LeModel__GetGroupById(sheet, groupId) : null);
    }
    // ------------------------------------------------------------


    // FUNCTION | An Element's Parameters, Made Whole (null for a plain group)
    // ------------------------------------------------------------
    function Na__LeParam__GetParams(sheet, groupId) {
        const block = Na__LeParam__GetBlockById(sheet, groupId);
        if (!block) return null;
        const definition = Na__LeParam__GetType(block.Parametric__Type);
        const stored     = (block.Parametric__Params && typeof block.Parametric__Params === 'object') ? block.Parametric__Params : {};
        return (typeof definition.normalise === 'function') ? definition.normalise(stored) : Object.assign({}, stored);
    }
    // ------------------------------------------------------------


    // FUNCTION | Every Parametric Group on a Sheet
    // ------------------------------------------------------------
    function Na__LeParam__ListOnSheet(sheet) {
        return Na__LeModel__GetGroups(sheet).filter((group) => !!Na__LeParam__GetBlock(group));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write a Block
    // ------------------------------------------------------------
    function Na__LeParam__MakeBlock(type, params, link) {
        const block = {};
        block.Parametric__Type    = type;
        block.Parametric__Version = Na__LeParam__BLOCK_VERSION;
        block.Parametric__Params  = JSON.parse(JSON.stringify(params || {}));
        block.Parametric__Link    = (link && typeof link === 'object') ? JSON.parse(JSON.stringify(link)) : null;
        return block;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Group Record Made Safe to Leave Its Sheet
    // ------------------------------------------------------------
    // A copy with the viewport link removed. A link names a sheet and a
    // viewport, which mean nothing in another project; the Custom Scrapbook
    // saves group records through here. A plain group comes back as it was.
    // ------------------------------------------------------------
    function Na__LeParam__Portable(groupRecord) {
        if (!groupRecord || typeof groupRecord !== 'object') return groupRecord;
        const copy  = JSON.parse(JSON.stringify(groupRecord));
        const block = copy[Na__LeParam__FIELD];
        if (block && typeof block === 'object' && !Array.isArray(block)) block.Parametric__Link = null;
        return copy;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Members and the Origin
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Coordinate Kept to a Tidy Number of Decimals
    // ------------------------------------------------------------
    function Na__LeParam__Round(value) {
        return Math.round(value * Na__LeParam__DECIMALS) / Na__LeParam__DECIMALS;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Group's Own Vectors, Text and Nested Groups, Each in Member Order
    // ------------------------------------------------------------
    function Na__LeParam__Members(group) {
        const members = (group && Array.isArray(group.Group__Members)) ? group.Group__Members : [];
        return {
            shapes : members.filter((member) => member.kind === Na__LeParam__KIND_SHAPE),
            texts  : members.filter((member) => member.kind === Na__LeParam__KIND_ANNOTATION),
            nested : members.filter((member) => member.kind === 'group')
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Where an Element's Origin Is on the Paper
    // ------------------------------------------------------------
    // The first point of its first vector, which is where every type puts
    // its origin. A group that has lost that vector falls back to the top
    // left of its box. Null for a group that is not on the sheet.
    // ------------------------------------------------------------
    function Na__LeParam__AnchorOf(sheet, groupId) {
        const group = sheet ? Na__LeModel__GetGroupById(sheet, groupId) : null;
        if (!group) return null;
        const first = Na__LeParam__Members(group).shapes[0];
        const shape = first ? Na__LeModel__GetShapeById(sheet, first.id) : null;
        const point = (shape && Array.isArray(shape.Shape__Points)) ? shape.Shape__Points[0] : null;
        if (Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1])) return { x : point[0], y : point[1] };
        const box = Na__LeGroup__Bounds(sheet, groupId);
        return box ? { x : box.X, y : box.Y } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is Any of an Element's Members on a Locked Layer
    // ------------------------------------------------------------
    function Na__LeParam__IsLocked(sheet, groupId) {
        const group = sheet ? Na__LeModel__GetGroupById(sheet, groupId) : null;
        if (!group) return true;
        const members = Na__LeParam__Members(group);
        const lockedShape = members.shapes.some((member) => { const record = Na__LeModel__GetShapeById(sheet, member.id); return !!record && Na__LeModel__IsLayerLocked(sheet, record.Shape__LayerId); });
        const lockedText  = members.texts.some((member) => { const record = Na__LeModel__GetAnnotationById(sheet, member.id); return !!record && Na__LeModel__IsLayerLocked(sheet, record.Annotation__LayerId); });
        return lockedShape || lockedText;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where an Element's Grips Are on the Paper
    // ------------------------------------------------------------
    // { anchor, stretch, lookup, link, params, type } in paper millimetres -
    // every point the type gives, by the name it gives it; null for a plain
    // group, or a type that has no grips.
    // ------------------------------------------------------------
    function Na__LeParam__HandlesOf(sheet, groupId) {
        const block  = Na__LeParam__GetBlockById(sheet, groupId);
        const anchor = block ? Na__LeParam__AnchorOf(sheet, groupId) : null;
        if (!block || !anchor) return null;
        const definition = Na__LeParam__GetType(block.Parametric__Type);
        if (typeof definition.handles !== 'function') return null;
        const params  = Na__LeParam__GetParams(sheet, groupId);
        const handles = definition.handles(params, Na__LeParam__Tools);
        if (!handles) return null;
        const place = (point) => (point ? { x : anchor.x + point.x, y : anchor.y + point.y, away : Array.isArray(point.away) ? point.away : [ 0, 0 ] } : null);   // <-- away: the way the grip stands clear of its point
        return { anchor : anchor, stretch : place(handles.stretch), lookup : place(handles.lookup), link : place(handles.link), params : params, type : block.Parametric__Type };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Building and Dropping an Element
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Type's Records, Normalised and Moved to an Origin
    // ------------------------------------------------------------
    // Ids and layers are left off: a drop gives fresh ids and lands text on
    // the sheet's text layer and vectors on its vector layer.
    // ------------------------------------------------------------
    function Na__LeParam__BuildLeaves(definition, params, originMm) {
        const built = definition.build(params, Na__LeParam__Tools);
        const list  = (built && Array.isArray(built.records)) ? built.records : [];
        const dx    = originMm ? originMm.x : 0;
        const dy    = originMm ? originMm.y : 0;
        const out   = [];
        list.forEach((entry) => {
            if (!entry || !entry.record || typeof entry.record !== 'object') return;
            const record = JSON.parse(JSON.stringify(entry.record));
            if (entry.kind === Na__LeParam__KIND_SHAPE) {
                record.Shape__Points = (Array.isArray(record.Shape__Points) ? record.Shape__Points : [])
                    .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
                    .map((p) => [ Na__LeParam__Round(p[0] + dx), Na__LeParam__Round(p[1] + dy) ]);
                if (record.Shape__Points.length < 2) return;
                out.push({ kind : entry.kind, record : Na__LeRec__NormaliseShape(record, null) });
            } else if (entry.kind === Na__LeParam__KIND_ANNOTATION) {
                record.Annotation__PosXMm = Na__LeParam__Round((Number(record.Annotation__PosXMm) || 0) + dx);
                record.Annotation__PosYMm = Na__LeParam__Round((Number(record.Annotation__PosYMm) || 0) + dy);
                out.push({ kind : entry.kind, record : Na__LeRec__NormaliseAnnotation(record, null) });
            }
        });
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build an Element Into the Item Clipboard's Set Shape
    // ------------------------------------------------------------
    // { kind : 'set', itemId, roots, entries, origin, size }: every vector and
    // text item, then the one group that holds them and carries the block.
    // params may be partial or left out; the type's defaults at its own
    // default scale fill the rest. originMm is where the element's own origin
    // goes on the paper; left out, the set is built at (0, 0), which is all a
    // tile or a ghost needs. Null for an unknown type, or an element that
    // builds to fewer than two records - a group of one is no group.
    // ------------------------------------------------------------
    function Na__LeParam__BuildSet(type, params, link, originMm) {
        const definition = Na__LeParam__GetType(type);
        if (!definition) return null;
        const base   = (typeof definition.defaults === 'function') ? definition.defaults(params ? params.ScaleDenominator : undefined) : {};
        const merged = Object.assign({}, base, params || {});
        const whole  = (typeof definition.normalise === 'function') ? definition.normalise(merged) : merged;
        const leaves = Na__LeParam__BuildLeaves(definition, whole, originMm || null);
        if (leaves.length < 2) return null;
        let   serial = 0;
        const nextId = (prefix) => prefix + String(++serial).padStart(3, '0');   // <-- Local to the set: InsertSet maps them to the sheet's own ids
        const entries = leaves.map((leaf) => ({ kind : leaf.kind, id : nextId(leaf.kind === Na__LeParam__KIND_SHAPE ? 'ParamShape_' : 'ParamText_'), record : leaf.record }));
        const groupId = nextId('ParamGroup_');
        const group   = { Group__Members : entries.map((entry) => ({ kind : entry.kind, id : entry.id })) };
        group[Na__LeParam__FIELD] = Na__LeParam__MakeBlock(type, whole, link);
        const box = Na__LeScrap__Bounds(entries);
        return {
            kind    : 'set',
            itemId  : type,
            roots   : [ { kind : 'group', id : groupId } ],
            entries : entries.concat([ { kind : 'group', id : groupId, record : group } ]),
            origin  : { x : box.X, y : box.Y },
            size    : { WidthMm : box.WidthMm, HeightMm : box.HeightMm }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop an Element on a Sheet, Centred on a Paper Point
    // ------------------------------------------------------------
    // One undo step, kept on the paper the way a paste is. The element is
    // selected, so its grips are up at once; the selected roots are
    // returned, or null.
    //
    // BUILT WHERE IT LANDS, NOT BUILT AND THEN MOVED. A set InsertSet moves has
    // an arbitrary offset added to every coordinate, which leaves each a few
    // parts in 10^14 away from what Regenerate would write there. The first
    // rebuild would then change every record without changing anything that
    // can be seen, and a stretch let go with Escape would not leave the sheet
    // as it found it. So the set is measured at (0, 0), built again with its
    // origin at its tidy final place, and handed over with nothing to add.
    // Only a drop the paper's edge pushes back in is still moved.
    // ------------------------------------------------------------
    function Na__LeParam__Insert(sheet, type, centreMm, params, link) {
        if (!sheet || !centreMm || !Number.isFinite(centreMm.x) || !Number.isFinite(centreMm.y)) return null;
        const measured = Na__LeParam__BuildSet(type, params, link, null);
        if (!measured) return null;
        const origin = {
            x : Na__LeParam__Round(centreMm.x - (measured.size.WidthMm  / 2) - measured.origin.x),
            y : Na__LeParam__Round(centreMm.y - (measured.size.HeightMm / 2) - measured.origin.y)
        };
        const set = Na__LeParam__BuildSet(type, params, link, origin);
        return set ? Na__LeClip__InsertSet(sheet, set, { x : set.origin.x, y : set.origin.y }) : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Regenerating an Element
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | What a Built Record Writes Onto the Member in Its Slot
    // ------------------------------------------------------------
    // Everything the type decides, and nothing it does not: the id and the
    // layer stay the member's own.
    // ------------------------------------------------------------
    function Na__LeParam__ShapePatch(record) {
        return {
            points        : record.Shape__Points,
            closed        : record.Shape__Closed === true,
            strokeColour  : record.Shape__StrokeColour,
            strokePt      : record.Shape__StrokePt,
            fillColour    : (typeof record.Shape__FillColour === 'string') ? record.Shape__FillColour : null,
            stroked       : record.Shape__Stroked !== false,
            fillOpacity   : record.Shape__FillOpacity,
            strokeOpacity : record.Shape__StrokeOpacity,
            gradient      : record.Shape__Gradient || null,
            dash          : record.Shape__LineStyle || null
        };
    }
    function Na__LeParam__TextPatch(record) {
        return {
            text        : record.Annotation__Text,
            posXMm      : record.Annotation__PosXMm,
            posYMm      : record.Annotation__PosYMm,
            sizeMm      : record.Annotation__SizeMm,
            fontWeight  : record.Annotation__FontWeight,
            colour      : record.Annotation__Colour,
            align       : record.Annotation__Align,
            leaderXMm   : null,
            leaderYMm   : null,
            rotationDeg : Number.isFinite(record.Annotation__RotationDeg) ? record.Annotation__RotationDeg : 0
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Announce One Change to an Element (one undo step)
    // ------------------------------------------------------------
    // An empty update of its first vector: the model's own way of announcing
    // a run of silent edits, as a paste does. The history takes one snapshot,
    // which holds everything the silent edits did.
    // ------------------------------------------------------------
    function Na__LeParam__Announce(sheet, groupId) {
        const group = sheet ? Na__LeModel__GetGroupById(sheet, groupId) : null;
        const first = group ? Na__LeParam__Members(group).shapes[0] : null;
        if (!first) { Na__LeModel__MarkDirty(); return false; }
        return Na__LeModel__UpdateShape(sheet, first.id, {}, false);
    }
    // ------------------------------------------------------------


    // FUNCTION | Rebuild an Element From Its Parameters, Where It Stands
    // ------------------------------------------------------------
    // patch is merged over the stored parameters. options:
    //     silent  true makes no announcement; the caller announces, or is
    //             inside an announcement already (a viewport's scale change)
    //     link    undefined leaves the link alone, null removes it, an
    //             object replaces it
    // THE MEMBER LIST IS REWRITTEN BEFORE THE LEFT-OVERS ARE DELETED. The
    // model prunes any group left with fewer than two live members, so
    // deleting first would take the group, and its block, with them.
    // Returns the parameters now stored, or null when nothing was rebuilt.
    // ------------------------------------------------------------
    function Na__LeParam__Regenerate(sheet, groupId, patch, options) {
        const group = sheet ? Na__LeModel__GetGroupById(sheet, groupId) : null;
        const block = Na__LeParam__GetBlock(group);
        if (!block) return null;
        const definition = Na__LeParam__GetType(block.Parametric__Type);
        const anchor     = Na__LeParam__AnchorOf(sheet, groupId);
        if (!anchor) return null;
        const opts   = options || {};
        const stored = (block.Parametric__Params && typeof block.Parametric__Params === 'object') ? block.Parametric__Params : {};
        const merged = Object.assign({}, stored, patch || {});
        const params = (typeof definition.normalise === 'function') ? definition.normalise(merged) : merged;
        const leaves = Na__LeParam__BuildLeaves(definition, params, anchor);
        if (leaves.length < 2) return null;

        const held       = Na__LeParam__Members(group);
        const firstShape = held.shapes[0] ? Na__LeModel__GetShapeById(sheet, held.shapes[0].id) : null;
        const firstText  = held.texts[0]  ? Na__LeModel__GetAnnotationById(sheet, held.texts[0].id) : null;
        const shapeLayer = firstShape ? firstShape.Shape__LayerId : null;        // <-- New members join the layer the element is on
        const textLayer  = firstText  ? firstText.Annotation__LayerId : null;
        const shapes     = [];
        const texts      = [];
        let   shapeSlot  = 0;
        let   textSlot   = 0;

        leaves.forEach((leaf) => {
            if (leaf.kind === Na__LeParam__KIND_SHAPE) {
                const slot = held.shapes[shapeSlot++];
                if (slot && Na__LeModel__UpdateShape(sheet, slot.id, Na__LeParam__ShapePatch(leaf.record), true)) { shapes.push({ kind : leaf.kind, id : slot.id }); return; }
                const made = Na__LeModel__InsertShape(sheet, Object.assign({}, leaf.record, { Shape__LayerId : shapeLayer }), true);
                if (made) shapes.push({ kind : leaf.kind, id : made.Shape__Id });
                return;
            }
            const slot = held.texts[textSlot++];
            if (slot && Na__LeModel__UpdateAnnotation(sheet, slot.id, Na__LeParam__TextPatch(leaf.record), true)) { texts.push({ kind : leaf.kind, id : slot.id }); return; }
            const made = Na__LeModel__InsertAnnotation(sheet, Object.assign({}, leaf.record, { Annotation__LayerId : textLayer }), true);
            if (made) texts.push({ kind : leaf.kind, id : made.Annotation__Id });
        });
        if ((shapes.length + texts.length) < 2) return null;

        const kept      = new Set(shapes.concat(texts).map((member) => member.kind + ':' + member.id));
        const leftOvers = held.shapes.concat(held.texts).filter((member) => !kept.has(member.kind + ':' + member.id));
        group.Group__Members = shapes.concat(texts, held.nested);                // <-- Before the delete, or the prune takes the group
        const link = (opts.link === undefined) ? block.Parametric__Link : opts.link;
        group[Na__LeParam__FIELD] = Na__LeParam__MakeBlock(block.Parametric__Type, params, link);
        if (leftOvers.length) Na__LeModel__DeleteItems(sheet, leftOvers, true);
        Na__LeModel__MarkDirty();
        if (opts.silent !== true) Na__LeParam__Announce(sheet, groupId);
        return params;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put an Element Back to Its Type's Standard at a Scale
    // ------------------------------------------------------------
    // What a change of scale does: the length and the divisions go back to
    // the standard, and the choices that are not about length - named by the
    // type's keep list - stay as they were. options.patch is laid over the
    // result, so whatever else changed with the scale - the facts a title is
    // written from - is part of the one rebuild.
    // ------------------------------------------------------------
    function Na__LeParam__ResetToStandard(sheet, groupId, denominator, options) {
        const block = Na__LeParam__GetBlockById(sheet, groupId);
        if (!block) return null;
        const definition = Na__LeParam__GetType(block.Parametric__Type);
        if (typeof definition.defaults !== 'function') return null;
        const current  = Na__LeParam__GetParams(sheet, groupId) || {};
        const scale    = Number.isFinite(denominator) && denominator > 0 ? denominator : current.ScaleDenominator;
        const standard = definition.defaults(scale);
        (Array.isArray(definition.keep) ? definition.keep : []).forEach((key) => { if (current[key] !== undefined) standard[key] = current[key]; });
        if (options && options.patch && typeof options.patch === 'object') Object.assign(standard, options.patch);
        return Na__LeParam__Regenerate(sheet, groupId, standard, options);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Parametric Scrapbook Engine API
    // ------------------------------------------------------------
    export {
        Na__LeParam__STATUS_LOADING,
        Na__LeParam__STATUS_READY,
        Na__LeParam__STATUS_FAILED,
        Na__LeParam__FIELD,
        Na__LeParam__Ready,
        Na__LeParam__GetStatus,
        Na__LeParam__Block,
        Na__LeParam__Label,
        Na__LeParam__RegisterType,
        Na__LeParam__GetType,
        Na__LeParam__SetTools,
        Na__LeParam__ElementsFor,
        Na__LeParam__ElementName,
        Na__LeParam__ElementId,
        Na__LeParam__ElementParams,
        Na__LeParam__ElementPreviewParams,
        Na__LeParam__TypeName,
        Na__LeParam__GetBlock,
        Na__LeParam__GetBlockById,
        Na__LeParam__GetParams,
        Na__LeParam__ListOnSheet,
        Na__LeParam__Portable,
        Na__LeParam__AnchorOf,
        Na__LeParam__IsLocked,
        Na__LeParam__HandlesOf,
        Na__LeParam__BuildSet,
        Na__LeParam__Insert,
        Na__LeParam__Announce,
        Na__LeParam__Regenerate,
        Na__LeParam__ResetToStandard
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
