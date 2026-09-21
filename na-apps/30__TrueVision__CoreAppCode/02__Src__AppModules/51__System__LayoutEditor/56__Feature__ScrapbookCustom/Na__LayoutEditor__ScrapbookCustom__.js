// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - CUSTOM SCRAPBOOK
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookCustom__.js
// NAMESPACE  : Na__LeScrapCustom
// MODULE     : Layout Editor - Custom Scrapbook (the library)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : User-made scrapbook items: capture a selection as a portable item, keep the library's index and items, and drop an item back onto a sheet
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - AN ITEM IS A SELECTION, SAVED. Whatever is selected on a sheet - vectors,
//   text, leaders, dimensions, and groups nested to any depth - is captured
//   in the item clipboard's own set shape (entries and roots), rebased so its
//   top left is (0, 0), and written as one JSON file. Dropping it is the item
//   clipboard's InsertSet, the door every scrapbook drop goes through: fresh
//   ids, members remapped, one undo step.
// - MADE PORTABLE ON THE WAY OUT. An item may land in another project, so
//   what only means something where it came from is left behind: layer ids
//   (it lands on the target sheet's own text, dimension and vector layers), a
//   dimension's viewport, a bubble's specification note link, and a
//   parametric element's viewport link (Na__LeParam__Portable). A dimension
//   that read its drawing's scale is told so outright, as a copy is, so it
//   reads the scale of the sheet it lands on. Viewports are refused: a
//   viewport carries a scene, a snapshot and a model source.
// - A SCALE BAR INSIDE AN ITEM STAYS A SCALE BAR. Its Group__Parametric block
//   rides on the group record, and after the drop the viewport link module
//   links it to the drawing it landed beside.
// - Nothing here touches the DOM, and nothing here knows where a file is:
//   Na__LayoutEditor__ScrapbookCustom__Transport__ does the reading and
//   writing.
//
// INTEGRATION:
// - Na__LayoutEditor__Panel__ScrapbookCustom__ is the section.
// // @delegate: ./Na__LayoutEditor__ScrapbookCustom__Transport__.js
// // @delegate: ../30__System__SheetTools/Na__LayoutEditor__ItemClipboard__.js
// // @delegate: ../57__Feature__ScrapbookParametric/Na__LayoutEditor__ScrapbookParametric__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : 1.0.0 ported 20-Sep-2026 as ValeVision3D v2.69.0, verbatim but for one
//                   string. The item document is the same in both apps: a file copied from
//                   one library folder to the other drops in either.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation: the config, the index, the item cache, Capture,
//   BuildSet, Insert, Save and Delete.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Drawing Scale, Markup, Groups, the Item Clipboard, the Parametric Engine and the Transport
    // ------------------------------------------------------------
    import {
        Na__LeModel__GetShapeById,
        Na__LeModel__GetAnnotationById,
        Na__LeModel__GetLeaderById,
        Na__LeModel__GetGroupById
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeDrawScale__DimensionAtScale } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeMarkup__DimensionSkeleton } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeGroup__Expand, Na__LeGroup__ItemsBounds } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LeClip__InsertSet } from '../30__System__SheetTools/Na__LayoutEditor__ItemClipboard__.js';
    import { Na__LeParam__Portable } from '../57__Feature__ScrapbookParametric/Na__LayoutEditor__ScrapbookParametric__.js';
    import { Na__LeParamLink__InsertAdopting } from '../57__Feature__ScrapbookParametric/Na__LayoutEditor__ScrapbookParametric__ViewportLink__.js';
    import { Na__AppUtils__GetProjectCodeFromUrl } from '../../03__AppUtils/Na__AppUtils__ProjectLoader.js';
    import {
        Na__LeScrapCustomIo__Configure,
        Na__LeScrapCustomIo__ReadIndex,
        Na__LeScrapCustomIo__ReadItem,
        Na__LeScrapCustomIo__Save,
        Na__LeScrapCustomIo__Delete
    } from './Na__LayoutEditor__ScrapbookCustom__Transport__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location, Key Prefix, Statuses, Events and the Item Document
    // ------------------------------------------------------------
    const Na__LeScrapCustom__ConfigUrl      = new URL('./Na__LayoutEditor__ScrapbookCustom__Config__.json', import.meta.url);
    const Na__LeScrapCustom__PREFIX         = 'LayoutEditor__ScrapbookCustom__';
    const Na__LeScrapCustom__STATUS_LOADING = 'loading';
    const Na__LeScrapCustom__STATUS_READY   = 'ready';
    const Na__LeScrapCustom__STATUS_FAILED  = 'failed';
    const Na__LeScrapCustom__CHANGED_EVENT  = 'na-layouteditor-scrapbook-custom-changed';   // <-- The index or an item arrived: the section redraws
    const Na__LeScrapCustom__DOC            = 'UserScrapbookItem__';
    const Na__LeScrapCustom__DOC_VERSION    = '1.0.0';
    const Na__LeScrapCustom__KINDS          = Object.freeze([ 'shape', 'annotation', 'leader', 'dimension', 'group' ]);   // <-- When the config gives none
    const Na__LeScrapCustom__REFUSED_KIND   = 'viewport';
    const Na__LeScrapCustom__DECIMALS       = 10000;                            // <-- Saved coordinates keep four decimal places of a millimetre
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Config, the Index and the Items Read So Far
    // ------------------------------------------------------------
    let   Na__LeScrapCustom__Config      = null;
    let   Na__LeScrapCustom__Status      = Na__LeScrapCustom__STATUS_LOADING;
    let   Na__LeScrapCustom__LoadPromise = null;
    let   Na__LeScrapCustom__Index       = [];          // <-- The index's entries: { Item__Id, Item__Name, Item__Category, Item__File, Item__UpdatedIso }
    let   Na__LeScrapCustom__Writable    = false;
    let   Na__LeScrapCustom__Why         = null;        // <-- Why it is not writable: the transport's WHY_ constants
    const Na__LeScrapCustom__Items       = new Map();   // <-- 'file|updated' -> the item document, null for one that could not be read, PENDING while it is being read
    const Na__LeScrapCustom__PENDING     = Object.freeze({ pending : true });
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config and the Index
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Block of the Config, or an Empty One
    // ------------------------------------------------------------
    function Na__LeScrapCustom__Block(name) {
        const block = Na__LeScrapCustom__Config ? Na__LeScrapCustom__Config[Na__LeScrapCustom__PREFIX + name] : null;
        return (block && typeof block === 'object' && !Array.isArray(block)) ? block : {};
    }
    // ------------------------------------------------------------


    // FUNCTION | A Label, With {tokens} Filled In
    // ------------------------------------------------------------
    function Na__LeScrapCustom__Label(key, fallback, tokens) {
        const value = Na__LeScrapCustom__Block('Labels')['Labels__' + key];
        let text = (typeof value === 'string') ? value : fallback;
        Object.keys(tokens || {}).forEach((name) => { text = text.split('{' + name + '}').join(String(tokens[name])); });
        return text;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Tell the Section Something Arrived
    // ------------------------------------------------------------
    function Na__LeScrapCustom__Announce(what) {
        window.dispatchEvent(new CustomEvent(Na__LeScrapCustom__CHANGED_EVENT, { detail : { what : what } }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take In an Index Read
    // ------------------------------------------------------------
    function Na__LeScrapCustom__TakeIndex(read) {
        Na__LeScrapCustom__Index    = Array.isArray(read.items) ? read.items : [];
        Na__LeScrapCustom__Writable = read.writable === true;
        Na__LeScrapCustom__Why      = read.why || null;
        Na__LeScrapCustom__Status   = read.ok ? Na__LeScrapCustom__STATUS_READY : Na__LeScrapCustom__STATUS_FAILED;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fetch the Config and the Index Once
    // ------------------------------------------------------------
    // Never rejects: a missing config or index is an empty library, not a
    // broken editor. The status tells the two apart for the section.
    // ------------------------------------------------------------
    function Na__LeScrapCustom__Ready() {
        if (!Na__LeScrapCustom__LoadPromise) {
            Na__LeScrapCustom__LoadPromise = (async () => {
                try {
                    const response = await fetch(Na__LeScrapCustom__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeScrapCustom__Config = await response.json();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Custom Scrapbook config unavailable - its defaults are used.', error);
                    Na__LeScrapCustom__Config = null;
                }
                Na__LeScrapCustomIo__Configure(Na__LeScrapCustom__Block('Library'));
                Na__LeScrapCustom__TakeIndex(await Na__LeScrapCustomIo__ReadIndex());
                Na__LeScrapCustom__Announce('index');
                return Na__LeScrapCustom__Status;
            })();
        }
        return Na__LeScrapCustom__LoadPromise;
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Index Again (a file may have been added by hand)
    // ------------------------------------------------------------
    async function Na__LeScrapCustom__Reload() {
        await Na__LeScrapCustom__Ready();
        Na__LeScrapCustom__TakeIndex(await Na__LeScrapCustomIo__ReadIndex());
        Na__LeScrapCustom__Announce('index');
        return Na__LeScrapCustom__Status;
    }
    // ------------------------------------------------------------


    // FUNCTION | Accessors
    // ------------------------------------------------------------
    function Na__LeScrapCustom__GetStatus()  { return Na__LeScrapCustom__Status; }
    function Na__LeScrapCustom__IsWritable() { return Na__LeScrapCustom__Writable; }
    function Na__LeScrapCustom__WhyReadOnly() { return Na__LeScrapCustom__Why; }
    function Na__LeScrapCustom__MaxNameLength() {
        const max = Na__LeScrapCustom__Block('Library').Library__MaxNameLength;
        return (typeof max === 'number' && Number.isFinite(max) && max > 0) ? Math.round(max) : 80;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Categories, in the Config's Order
    // ------------------------------------------------------------
    // [{ folder, name }]. A category the index names but the config does not
    // - a folder Adam added by hand - is listed after them under its own
    // folder name, so nothing saved is ever out of reach.
    // ------------------------------------------------------------
    function Na__LeScrapCustom__Categories() {
        const listed = Na__LeScrapCustom__Block('Library').Library__Categories;
        const out    = (Array.isArray(listed) ? listed : [])
            .filter((entry) => !!entry && typeof entry.Category__Folder === 'string' && entry.Category__Folder !== '')
            .map((entry) => ({ folder : entry.Category__Folder, name : (typeof entry.Category__Name === 'string' && entry.Category__Name !== '') ? entry.Category__Name : entry.Category__Folder }));
        Na__LeScrapCustom__Index.forEach((entry) => {
            if (!out.some((category) => category.folder === entry.Item__Category)) out.push({ folder : entry.Item__Category, name : entry.Item__Category });
        });
        return out;
    }
    function Na__LeScrapCustom__CategoryName(folder) {
        const found = Na__LeScrapCustom__Categories().find((category) => category.folder === folder);
        return found ? found.name : String(folder || '');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Index Entries in a Category, Newest First
    // ------------------------------------------------------------
    function Na__LeScrapCustom__EntriesIn(folder) {
        return Na__LeScrapCustom__Index.filter((entry) => entry.Item__Category === folder)
            .sort((a, b) => String(b.Item__UpdatedIso || '').localeCompare(String(a.Item__UpdatedIso || '')));
    }
    function Na__LeScrapCustom__EntryName(entry) {
        if (!entry) return '';
        return (typeof entry.Item__Name === 'string' && entry.Item__Name.trim() !== '') ? entry.Item__Name : entry.Item__File;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Items
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Cache Key of an Entry: Its File and When It Was Written
    // ------------------------------------------------------------
    function Na__LeScrapCustom__Key(entry) {
        return entry.Item__File + '|' + String(entry.Item__UpdatedIso || '');
    }
    // ------------------------------------------------------------


    // FUNCTION | An Entry's Item Document, If It Has Been Read
    // ------------------------------------------------------------
    // undefined when it has not arrived yet, null when it could not be read,
    // else the document.
    // ------------------------------------------------------------
    function Na__LeScrapCustom__GetItem(entry) {
        const held = entry ? Na__LeScrapCustom__Items.get(Na__LeScrapCustom__Key(entry)) : undefined;
        return held === Na__LeScrapCustom__PENDING ? undefined : held;         // <-- On its way reads as not read yet, never as broken
    }
    // ------------------------------------------------------------


    // FUNCTION | Read the Items of a Category That Have Not Been Read Yet
    // ------------------------------------------------------------
    // Resolves to how many arrived. The section is told when any did.
    // ------------------------------------------------------------
    async function Na__LeScrapCustom__LoadCategory(folder) {
        const wanted = Na__LeScrapCustom__EntriesIn(folder).filter((entry) => !Na__LeScrapCustom__Items.has(Na__LeScrapCustom__Key(entry)));
        if (!wanted.length) return 0;
        wanted.forEach((entry) => Na__LeScrapCustom__Items.set(Na__LeScrapCustom__Key(entry), Na__LeScrapCustom__PENDING));   // <-- Marked as asked for, so two refreshes do not both fetch it
        const reads = await Promise.all(wanted.map((entry) => Na__LeScrapCustomIo__ReadItem(entry.Item__File)));
        reads.forEach((read, i) => {
            if (!read.ok) console.warn('[TrueVision3D LayoutEditor] A custom scrapbook item could not be read: ' + wanted[i].Item__File + ' (' + read.error + ')');
            Na__LeScrapCustom__Items.set(Na__LeScrapCustom__Key(wanted[i]), read.ok ? read.item : null);
        });
        Na__LeScrapCustom__Announce('items');
        return reads.length;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Kinds an Item May Hold
    // ------------------------------------------------------------
    function Na__LeScrapCustom__AllowedKinds() {
        const listed = Na__LeScrapCustom__Block('Library').Library__AllowedKinds;
        const kinds  = (Array.isArray(listed) ? listed : []).filter((kind) => typeof kind === 'string' && kind !== Na__LeScrapCustom__REFUSED_KIND);
        return kinds.length ? kinds : Na__LeScrapCustom__KINDS.slice();
    }
    // ------------------------------------------------------------


    // FUNCTION | An Item Document as the Item Clipboard's Set Shape
    // ------------------------------------------------------------
    // { kind : 'set', itemId, roots, entries, origin, size }, the records
    // cloned so a drop can never write into the cached document. Entries of a
    // kind an item may not hold are left out, so a file edited by hand cannot
    // put a viewport on a sheet. Null for a document with nothing to drop.
    // ------------------------------------------------------------
    function Na__LeScrapCustom__BuildSet(itemDocument) {
        if (!itemDocument || typeof itemDocument !== 'object') return null;
        const allowed = Na__LeScrapCustom__AllowedKinds();
        const raw     = itemDocument[Na__LeScrapCustom__DOC + 'Entries'];
        const entries = (Array.isArray(raw) ? raw : [])
            .filter((entry) => !!entry && allowed.indexOf(entry.kind) !== -1 && typeof entry.id === 'string' && entry.record && typeof entry.record === 'object')
            .map((entry) => ({ kind : entry.kind, id : entry.id, record : JSON.parse(JSON.stringify(entry.record)) }));
        if (!entries.length) return null;
        const known = new Set(entries.map((entry) => entry.kind + ':' + entry.id));
        const roots = (Array.isArray(itemDocument[Na__LeScrapCustom__DOC + 'Roots']) ? itemDocument[Na__LeScrapCustom__DOC + 'Roots'] : [])
            .filter((root) => !!root && known.has(root.kind + ':' + root.id)).map((root) => ({ kind : root.kind, id : root.id }));
        const size  = itemDocument[Na__LeScrapCustom__DOC + 'SizeMm'] || {};
        return {
            kind    : 'set',
            itemId  : itemDocument[Na__LeScrapCustom__DOC + 'Id'] || '',
            roots   : roots,
            entries : entries,
            origin  : { x : 0, y : 0 },
            size    : { WidthMm : Number(size.WidthMm) || 0, HeightMm : Number(size.HeightMm) || 0 }
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Drop an Item on a Sheet, Centred on a Paper Point
    // ------------------------------------------------------------
    // One undo step, kept on the paper the way a paste is; the item is
    // selected. A parametric element inside it is linked to the viewport it
    // lands beside as part of that same step, which is why the drop is run
    // through the link module rather than followed by it. Returns the
    // selected roots.
    // ------------------------------------------------------------
    function Na__LeScrapCustom__Insert(sheet, itemDocument, centreMm) {
        if (!sheet || !centreMm || !Number.isFinite(centreMm.x) || !Number.isFinite(centreMm.y)) return null;
        const set = Na__LeScrapCustom__BuildSet(itemDocument);
        if (!set) return null;
        const topLeft = { x : centreMm.x - (set.size.WidthMm / 2), y : centreMm.y - (set.size.HeightMm / 2) };
        return Na__LeParamLink__InsertAdopting(sheet, () => Na__LeClip__InsertSet(sheet, set, topLeft));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Capturing a Selection
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Coordinate Kept to a Tidy Number of Decimals
    // ------------------------------------------------------------
    function Na__LeScrapCustom__Round(value) {
        return Math.round(value * Na__LeScrapCustom__DECIMALS) / Na__LeScrapCustom__DECIMALS;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Record Off the Sheet, by Kind and Id
    // ------------------------------------------------------------
    function Na__LeScrapCustom__RecordOf(sheet, item) {
        if (item.kind === 'shape')      return Na__LeModel__GetShapeById(sheet, item.id);
        if (item.kind === 'annotation') return Na__LeModel__GetAnnotationById(sheet, item.id);
        if (item.kind === 'leader')     return Na__LeModel__GetLeaderById(sheet, item.id);
        if (item.kind === 'group')      return Na__LeModel__GetGroupById(sheet, item.id);
        if (item.kind === 'dimension')  return (sheet.Sheet__Dimensions || []).find((dim) => dim.Dimension__Id === item.id) || null;
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Paper Box Round Everything Captured
    // ------------------------------------------------------------
    // The groups module boxes vectors, text, leaders and groups. A dimension
    // is boxed here by its two measured points and the two ends of its line.
    // ------------------------------------------------------------
    function Na__LeScrapCustom__BoundsOf(sheet, items) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const take = (x, y) => { if (Number.isFinite(x) && Number.isFinite(y)) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); } };
        const box  = Na__LeGroup__ItemsBounds(sheet, items.filter((item) => item.kind !== 'dimension'));
        if (box) { take(box.X, box.Y); take(box.X + box.WidthMm, box.Y + box.HeightMm); }
        items.filter((item) => item.kind === 'dimension').forEach((item) => {
            const dim      = Na__LeScrapCustom__RecordOf(sheet, item);
            const skeleton = dim ? Na__LeMarkup__DimensionSkeleton(dim) : null;
            if (!skeleton) return;
            [ skeleton.S, skeleton.E, skeleton.DS, skeleton.DE ].forEach((point) => { if (point) take(point.x, point.y); });
        });
        if (!Number.isFinite(minX)) return null;
        return { X : minX, Y : minY, WidthMm : maxX - minX, HeightMm : maxY - minY };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Copy of a Record, Moved and Made Portable
    // ------------------------------------------------------------
    // dx and dy carry it to the item's own origin. See the header for what is
    // left behind and why.
    // ------------------------------------------------------------
    function Na__LeScrapCustom__PortableRecord(sheet, kind, record, dx, dy) {
        if (kind === 'group') return Na__LeParam__Portable(record);             // <-- A clone, with a parametric element's viewport link removed
        const copy  = JSON.parse(JSON.stringify(record));
        const shift = (keyX, keyY) => {
            if (Number.isFinite(copy[keyX])) copy[keyX] = Na__LeScrapCustom__Round(copy[keyX] + dx);
            if (Number.isFinite(copy[keyY])) copy[keyY] = Na__LeScrapCustom__Round(copy[keyY] + dy);
        };
        if (kind === 'shape') {
            copy.Shape__Points = (Array.isArray(copy.Shape__Points) ? copy.Shape__Points : []).map((p) => [ Na__LeScrapCustom__Round(p[0] + dx), Na__LeScrapCustom__Round(p[1] + dy) ]);
            delete copy.Shape__LayerId;
            // A MEASURED ROOM KEEPS ITS NAME AND LOSES THE REST. The group it
            // was filed under belongs to the sheet it came from, and a scale
            // set by hand was set for a drawing this item will never see
            // again - dropped into another project it measures itself at
            // whatever is under it, which is the only answer that can be
            // right. The same reasoning as a leader's note id above.
            if (copy.Shape__Area && typeof copy.Shape__Area === 'object') {
                delete copy.Shape__Area.Area__Group;
                delete copy.Shape__Area.Area__ScaleDenominator;
            }
        }
        if (kind === 'annotation') {
            shift('Annotation__PosXMm', 'Annotation__PosYMm');
            shift('Annotation__LeaderXMm', 'Annotation__LeaderYMm');
            delete copy.Annotation__LayerId;
        }
        if (kind === 'leader') {
            shift('Leader__TipXMm', 'Leader__TipYMm');
            shift('Leader__AnchorXMm', 'Leader__AnchorYMm');
            delete copy.Leader__LayerId;
            delete copy.Leader__SpecNoteId;                                      // <-- A note id means nothing in another project's specification
        }
        if (kind === 'dimension') {
            if (typeof copy.Dimension__AtScale !== 'boolean') copy.Dimension__AtScale = Na__LeDrawScale__DimensionAtScale(sheet, record);   // <-- Said outright, as a copy says it: it is about to lose the viewport it read
            shift('Dimension__StartXMm', 'Dimension__StartYMm');
            shift('Dimension__EndXMm', 'Dimension__EndYMm');
            copy.Dimension__ViewportId = null;
            delete copy.Dimension__LayerId;
        }
        return copy;
    }
    // ------------------------------------------------------------


    // FUNCTION | What Saving a Selection Would Take
    // ------------------------------------------------------------
    // { roots, refused }: roots are the selected items an item may hold, and
    // refused counts the viewports among them. The section reads this on
    // every selection change to say what Save would do.
    // ------------------------------------------------------------
    function Na__LeScrapCustom__Saveable(selectionItems) {
        const allowed = Na__LeScrapCustom__AllowedKinds();
        const items   = Array.isArray(selectionItems) ? selectionItems.filter((item) => !!item && !!item.kind && !!item.id) : [];
        return {
            roots   : items.filter((item) => allowed.indexOf(item.kind) !== -1).map((item) => ({ kind : item.kind, id : item.id })),
            refused : items.filter((item) => item.kind === Na__LeScrapCustom__REFUSED_KIND).length
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Capture a Selection as an Item Document
    // ------------------------------------------------------------
    // Groups are opened up to every record they own, as a copy opens them.
    // Null when the selection holds nothing an item may hold. The server adds
    // the id, the name, the category and the times as it saves.
    // ------------------------------------------------------------
    function Na__LeScrapCustom__Capture(sheet, selectionItems) {
        if (!sheet) return null;
        const roots = Na__LeScrapCustom__Saveable(selectionItems).roots;
        if (!roots.length) return null;
        const allowed  = Na__LeScrapCustom__AllowedKinds();
        const expanded = Na__LeGroup__Expand(sheet, roots).filter((item) => allowed.indexOf(item.kind) !== -1);
        const box      = Na__LeScrapCustom__BoundsOf(sheet, expanded);
        if (!box) return null;
        const entries = [];
        expanded.forEach((item) => {
            const record = Na__LeScrapCustom__RecordOf(sheet, item);
            if (record) entries.push({ kind : item.kind, id : item.id, record : Na__LeScrapCustom__PortableRecord(sheet, item.kind, record, -box.X, -box.Y) });
        });
        if (!entries.length) return null;

        const today = new Date();
        const doc   = {};
        doc[Na__LeScrapCustom__DOC + 'Meta'] = {
            Meta__Description : 'A Custom Scrapbook item for the TrueVision 3D Layout Editor: a selection saved from a sheet. Entries are sheet records in paper millimetres, y down, from an origin at the top left of the item; Roots is what a drop selects. Written by the app through the ProjectVision local server; see Na__LayoutEditor__ScrapbookCustom__.js.',
            Meta__Version     : Na__LeScrapCustom__DOC_VERSION,
            Meta__Created     : String(today.getDate()).padStart(2, '0') + '-' + today.toLocaleString('en-GB', { month : 'short' }) + '-' + today.getFullYear(),
            Meta__Author      : 'Adam Noble - Noble Architecture'
        };
        doc[Na__LeScrapCustom__DOC + 'SourceProject'] = Na__AppUtils__GetProjectCodeFromUrl() || '';
        doc[Na__LeScrapCustom__DOC + 'SourceSheet']   = (typeof sheet.Sheet__Name === 'string') ? sheet.Sheet__Name : '';
        doc[Na__LeScrapCustom__DOC + 'SizeMm']        = { WidthMm : Na__LeScrapCustom__Round(box.WidthMm), HeightMm : Na__LeScrapCustom__Round(box.HeightMm) };
        doc[Na__LeScrapCustom__DOC + 'Roots']         = roots;
        doc[Na__LeScrapCustom__DOC + 'Entries']       = entries;
        return doc;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Saving and Deleting
// -----------------------------------------------------------------------------

    // FUNCTION | Save a Selection as a New Item
    // ------------------------------------------------------------
    // Resolves to { ok, entry, error }. The index the server answers with
    // replaces the one held, and the section is told.
    // ------------------------------------------------------------
    async function Na__LeScrapCustom__Save(sheet, selectionItems, name, categoryFolder) {
        const doc = Na__LeScrapCustom__Capture(sheet, selectionItems);
        if (!doc) return { ok : false, entry : null, error : 'nothing in the selection can be saved' };
        const result = await Na__LeScrapCustomIo__Save(categoryFolder, String(name || '').trim().slice(0, Na__LeScrapCustom__MaxNameLength()), doc);
        if (!result.ok) return { ok : false, entry : null, error : result.error };
        if (Array.isArray(result.items)) Na__LeScrapCustom__Index = result.items;
        Na__LeScrapCustom__Announce('index');
        return { ok : true, entry : result.entry, error : null };
    }
    // ------------------------------------------------------------


    // FUNCTION | Delete an Item (its file goes to the quarantine folder)
    // ------------------------------------------------------------
    async function Na__LeScrapCustom__Delete(entry) {
        if (!entry) return { ok : false, error : 'no item' };
        const result = await Na__LeScrapCustomIo__Delete(entry.Item__File);
        if (!result.ok) return { ok : false, error : result.error };
        Na__LeScrapCustom__Items.delete(Na__LeScrapCustom__Key(entry));
        if (Array.isArray(result.items)) Na__LeScrapCustom__Index = result.items;
        Na__LeScrapCustom__Announce('index');
        return { ok : true, error : null };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Custom Scrapbook Library API
    // ------------------------------------------------------------
    export {
        Na__LeScrapCustom__STATUS_LOADING,
        Na__LeScrapCustom__STATUS_READY,
        Na__LeScrapCustom__STATUS_FAILED,
        Na__LeScrapCustom__CHANGED_EVENT,
        Na__LeScrapCustom__Ready,
        Na__LeScrapCustom__Reload,
        Na__LeScrapCustom__Label,
        Na__LeScrapCustom__GetStatus,
        Na__LeScrapCustom__IsWritable,
        Na__LeScrapCustom__WhyReadOnly,
        Na__LeScrapCustom__MaxNameLength,
        Na__LeScrapCustom__Categories,
        Na__LeScrapCustom__CategoryName,
        Na__LeScrapCustom__EntriesIn,
        Na__LeScrapCustom__EntryName,
        Na__LeScrapCustom__GetItem,
        Na__LeScrapCustom__LoadCategory,
        Na__LeScrapCustom__BuildSet,
        Na__LeScrapCustom__Insert,
        Na__LeScrapCustom__Saveable,
        Na__LeScrapCustom__Capture,
        Na__LeScrapCustom__Save,
        Na__LeScrapCustom__Delete
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
