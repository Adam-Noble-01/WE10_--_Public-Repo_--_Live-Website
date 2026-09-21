// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VIEWPORT CLIPBOARD
// =============================================================================
//
// FILE       : Na__LayoutEditor__ViewportClipboard__.js
// NAMESPACE  : Na__LeClip
// MODULE     : Layout Editor - Viewport Clipboard (copy, paste and duplicate a viewport or a vector)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Copy a set-up viewport or a vector and paste it as a new one: a fresh id, every setting kept
// CREATED    : 13-Sep-2026
//
// DESCRIPTION:
// - Setting a viewport up is the slow part of laying out a sheet: the scene,
//   the scale, the crop, the window, the render composites, the model layers,
//   the per-category edge styles. Copy lifts ALL of it. A paste is a new
//   viewport that differs from the one copied in exactly three things - its
//   id, its name and where it sits - so the only work left is whatever should
//   actually be different, which is usually just the scene.
// - A vector is the same idea without a name: vertices, closed, edges, fill,
//   gradient and opacities. A paste is a new shape that differs in its id and
//   where it sits.
// - Ctrl+C copies the selected viewport or vector, Ctrl+V pastes whatever is
//   held, Ctrl+D duplicates the selection in one step without touching what
//   the clipboard holds. The right-click menu offers the same three.
//
// -----------------------------------------------------------------------------
//
// WHERE A PASTE LANDS:
// - A VECTOR always lands where it was copied from - on this sheet, on top
//   of the original, or on another sheet in the same spot every time - and a
//   toast (ShapePasted) says so, since landing exactly in place would
//   otherwise be invisible. Duplicate (Ctrl+D) is the one that fans out,
//   stepping down and to the right by PasteOffsetMm and again past every
//   copy already sitting in the run: it shows no toast, so the step is what
//   says it worked.
// - A VIEWPORT still fans out on paste, the way both did before: where the
//   copy was taken from, if that spot is free (usually true on another
//   sheet, so a viewport set up once lands in the same place on every sheet
//   of a set); stepped down and to the right by PasteOffsetMm, and again
//   past every copy already sitting in the run, when the original is still
//   on the same sheet.
// - From the right-click menu on bare paper: with its top-left corner at the
//   click, for either kind.
// - Always pulled back onto the paper. For a viewport's fan-out, pinned
//   against the far corner, where stepping down and right would land it
//   straight back on the original, the run steps up and left instead.
//
// THE NAME:
// - "Front Elevation" pastes as "Front Elevation copy", then "Front Elevation
//   copy 2", and so on, unique on the sheet it lands on. A viewport with no
//   name of its own takes the caption it was showing, so the copy is told
//   apart from the original in the data file and on the sheet alike.
// - A copy-name is a placeholder, not a decision. Pointing the copy at a
//   different scene clears it (Na__LeClip__IsCopyName, asked by the Viewport
//   panel), so the caption follows the new scene the way an unnamed
//   viewport's always has. A name somebody typed is never touched.
//
// WHAT DOES NOT TRAVEL:
// - The id, which is always fresh.
// - The lock. A copy arrives unlocked, because the very next thing done to it
//   is moving it.
// - The layer, when the sheet it lands on has no usable layer of that id
//   (missing, hidden or locked): the paste goes to the default viewport layer.
// - Everything else travels, INCLUDING the 3D snapshot reference. The stored
//   picture is keyed on what the camera saw, not on which viewport asked for
//   it, so the copy shows it at once instead of rendering it over again; a
//   later re-render of the copy uploads under its own name and leaves the
//   original's picture alone.
//
// ONE PASTE IS ONE UNDO STEP:
// - The record goes onto the sheet through the sheet model with a single
//   announcement, so Ctrl+Z takes the copy off again and Ctrl+Y puts it back.
//
// THE CLIPBOARD:
// - Lives in this tab's memory. A copy survives a change of sheet, not a reload.
// - Holds a snapshot taken at the moment of copying, not a live reference, so
//   editing or deleting the original afterwards changes nothing about what
//   pastes.
// - What is held carries a kind. Viewports and vectors share the keys and the
//   menu; text, dimensions and leaders can join the same way later.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ owns the keys and the context menu, and asks
//   this module for the key actions (RunKeyAction) and the menu entries
//   (MenuItems).
// - Na__LayoutEditor__Panel__ViewportSettings__ asks IsCopyName when a
//   viewport is pointed at a different scene.
// - Na__LayoutEditor__SheetModel__ does the write (InsertViewport, InsertShape).
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported to      : ValeVision3D 51__System__LayoutEditor (pending)
// - Parity         : authored in TrueVision first, back-port to follow
// - Divergences    : none expected - the viewport record is shared field for field
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.3.0
// - LayerFor refuses a REFERENCE layer (Layer__Selectable false) as it
//   refuses a hidden or a locked one: a pasted viewport or vector there would
//   be out of the pointer's reach the moment it landed. TrueVision first;
//   not yet in ValeVision.
//
// 18-Sep-2026 - Version 1.2.0
// - Paste a vector always lands in place now (Na__LeClip__PasteShape passes
//   fanOut false to LandShape), with a toast (ShapePasted) saying so.
//   Duplicate keeps the old fanned-out placement (fanOut true) since it has
//   no toast of its own. Viewport paste and duplicate are unchanged.
//
// 14-Sep-2026 - Version 1.1.0
// - Vectors join the clipboard. Kind 'shape': copy, paste and duplicate a
//   selected vector the way a viewport already does. A paste is the whole
//   record with a fresh id (Na__LeModel__InsertShape) and a fanned-out
//   position (the bounding-box top-left, the same PasteOffsetMm). From the
//   menu on bare paper that corner goes at the click. The layer is kept when
//   the sheet has a usable vector layer of that id, otherwise the default
//   vector layer. Ctrl+C / Ctrl+V / Ctrl+D and the right-click menu. One
//   paste is one undo step. Viewport copy, paste and duplicate are unchanged.
//
// 13-Sep-2026 - Version 1.0.0
// - First cut. Copy, paste and duplicate for viewports: the placement run, the
//   copy name, and the name handed back when the copy changes scene.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Layout and the Panel Context (for the toast)
    // ------------------------------------------------------------
    import { Na__LeCfg__GetClipboardSetup, Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetSelection,
        Na__LeModel__SetSelection,
        Na__LeModel__GetViewportById,
        Na__LeModel__GetShapeById,
        Na__LeModel__GetLayerById,
        Na__LeModel__InsertViewport,
        Na__LeModel__InsertShape,
        Na__LeModel__ResolveViewportSource
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeLayout__Solve } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__Bounds, Na__LeShapeGeo__Translated } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LePanels__GetContext } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Event, Kind and Placement Limits
    // ------------------------------------------------------------
    const Na__LeClip__CHANGED_EVENT  = 'na-layouteditor-clipboard-changed';
    const Na__LeClip__KIND_VIEWPORT  = 'viewport';
    const Na__LeClip__KIND_SHAPE     = 'shape';
    const Na__LeClip__SAME_SPOT_MM   = 0.5;       // <-- Two frames whose top-left corners are this close sit in the same place
    const Na__LeClip__MAX_STEPS      = 40;        // <-- How far a run of pastes fans out looking for a free spot
    const Na__LeClip__MAX_NAME_TRIES = 999;
    // ------------------------------------------------------------

    // MODULE VARIABLES | What the Clipboard Holds
    // ------------------------------------------------------------
    let Na__LeClip__Held = null;   // <-- { kind, record, sourceId, sourceSheetId, label }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Deep Copy of a Record
    // ------------------------------------------------------------
    function Na__LeClip__Clone(record) {
        return JSON.parse(JSON.stringify(record));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Announce What the Clipboard Now Holds
    // ------------------------------------------------------------
    function Na__LeClip__Dispatch() {
        window.dispatchEvent(new CustomEvent(Na__LeClip__CHANGED_EVENT, {
            detail : { kind : Na__LeClip__Held ? Na__LeClip__Held.kind : null, label : Na__LeClip__Held ? Na__LeClip__Held.label : null }
        }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Short Message, When the Host Offers a Toast
    // ------------------------------------------------------------
    // A copy changes nothing on the screen, so without a word it is impossible
    // to tell whether Ctrl+C was heard at all.
    // ------------------------------------------------------------
    function Na__LeClip__Toast(message) {
        const context = Na__LePanels__GetContext();
        if (context && typeof context.showToast === 'function') context.showToast(message, false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Escape Text for Use Inside a Regular Expression
    // ------------------------------------------------------------
    function Na__LeClip__Escape(text) {
        return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Pattern That Recognises One Copy-Name Format
    // ------------------------------------------------------------
    // The formats are wording, so they live with the labels. The pattern is
    // built FROM the format rather than written out beside it, so rewording
    // the label in the config still lets a copy-name be recognised later.
    // ------------------------------------------------------------
    function Na__LeClip__NamePattern(format) {
        if (typeof format !== 'string' || format.indexOf('{name}') === -1) return null;
        const body = format.split('{name}')
            .map((part) => part.split('{n}').map(Na__LeClip__Escape).join('\\d+'))
            .join('(.+?)');
        return new RegExp('^' + body + '$');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Names
// -----------------------------------------------------------------------------

    // FUNCTION | The Name a Copy Grew From, With Any Copy Suffix Taken Off
    // ------------------------------------------------------------
    // "Front Elevation copy 3" gives back "Front Elevation", so copying a copy
    // names the new one "Front Elevation copy 4" rather than "... copy 3 copy".
    // The numbered format is tried first: "X copy 3" also ends in digits a
    // looser pattern would happily swallow into the name.
    // ------------------------------------------------------------
    function Na__LeClip__BaseName(name) {
        const text  = String(name || '').trim();
        const tests = [
            Na__LeClip__NamePattern(Na__LeCfg__GetLabel('ViewportCopyNameNumbered', '{name} copy {n}')),
            Na__LeClip__NamePattern(Na__LeCfg__GetLabel('ViewportCopyName', '{name} copy'))
        ];
        for (let i = 0; i < tests.length; i++) {
            const match = tests[i] ? text.match(tests[i]) : null;
            if (match && match[1] && match[1].trim()) return match[1].trim();
        }
        return text;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Viewport's Name Still the Placeholder a Paste Gave It
    // ------------------------------------------------------------
    // Asked by the Viewport panel when a viewport is pointed at a different
    // scene. A copy-name describes the OLD scene, so the panel clears it and
    // the caption follows the new one. Only a name that reads as a copy-name
    // counts; a name typed by hand is left exactly as it is.
    // ------------------------------------------------------------
    function Na__LeClip__IsCopyName(viewport) {
        const name = (viewport && typeof viewport.Viewport__Name === 'string') ? viewport.Viewport__Name.trim() : '';
        return !!name && Na__LeClip__BaseName(name) !== name;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Copy Name No Other Viewport on the Sheet Is Already Showing
    // ------------------------------------------------------------
    // Compared against the CAPTION of every viewport, not just the stored
    // names, because an unnamed viewport still shows its scene's name and a
    // copy called the same would be just as hard to tell apart.
    // ------------------------------------------------------------
    function Na__LeClip__UniqueName(sheet, source) {
        const base  = Na__LeClip__BaseName(Na__LeModel__ResolveViewportSource(source).label) || 'Viewport';
        const shown = new Set(sheet.Sheet__Viewports.map((v) => String(Na__LeModel__ResolveViewportSource(v).label || '').trim().toLowerCase()));
        const plain = Na__LeCfg__FormatLabel('ViewportCopyName', '{name} copy', { name : base });
        if (!shown.has(plain.trim().toLowerCase())) return plain;
        for (let n = 2; n <= Na__LeClip__MAX_NAME_TRIES; n++) {
            const candidate = Na__LeCfg__FormatLabel('ViewportCopyNameNumbered', '{name} copy {n}', { name : base, n : n });
            if (!shown.has(candidate.trim().toLowerCase())) return candidate;
        }
        return plain;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Placement
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Where a Frame Goes: the Start Spot, Stepped Clear of Frames Already There
    // ------------------------------------------------------------
    // fanOut false takes the start spot as asked (a menu paste at the click);
    // true steps diagonally until no frame has its corner there.
    // ------------------------------------------------------------
    function Na__LeClip__Place(sheet, frame, startMm, fanOut) {
        const page    = Na__LeLayout__Solve(sheet).Page;
        const maxX    = Math.max(0, page.WidthMm  - frame.WidthMm);
        const maxY    = Math.max(0, page.HeightMm - frame.HeightMm);
        const onPaper = (x, y) => ({ X : Math.min(maxX, Math.max(0, x)), Y : Math.min(maxY, Math.max(0, y)) });
        const taken   = (spot) => sheet.Sheet__Viewports.some((v) =>
            Math.abs(v.Viewport__FrameMm.X - spot.X) < Na__LeClip__SAME_SPOT_MM && Math.abs(v.Viewport__FrameMm.Y - spot.Y) < Na__LeClip__SAME_SPOT_MM);

        let spot = onPaper(startMm.x, startMm.y);
        if (!fanOut) return spot;
        const step = Na__LeCfg__GetClipboardSetup().pasteOffsetMm;
        for (let n = 1; taken(spot) && n <= Na__LeClip__MAX_STEPS; n++) spot = onPaper(startMm.x + (step * n), startMm.y + (step * n));
        for (let n = 1; taken(spot) && n <= Na__LeClip__MAX_STEPS; n++) spot = onPaper(startMm.x - (step * n), startMm.y - (step * n));   // <-- Pinned in the far corner: fan out the other way
        return spot;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Vector Goes: the Bounding-Box Origin, Stepped Clear of Shapes Already There
    // ------------------------------------------------------------
    // The same run as Place, against every shape's bounding-box top-left
    // rather than a viewport frame. A vector has no name and no frame of its
    // own; the box is what you see when you select it.
    // ------------------------------------------------------------
    function Na__LeClip__PlaceShape(sheet, bounds, startMm, fanOut) {
        const page    = Na__LeLayout__Solve(sheet).Page;
        const maxX    = Math.max(0, page.WidthMm  - bounds.WidthMm);
        const maxY    = Math.max(0, page.HeightMm - bounds.HeightMm);
        const onPaper = (x, y) => ({ X : Math.min(maxX, Math.max(0, x)), Y : Math.min(maxY, Math.max(0, y)) });
        const taken   = (spot) => (sheet.Sheet__Shapes || []).some((s) => {
            const box = Na__LeShapeGeo__Bounds(s);
            return Math.abs(box.X - spot.X) < Na__LeClip__SAME_SPOT_MM && Math.abs(box.Y - spot.Y) < Na__LeClip__SAME_SPOT_MM;
        });

        let spot = onPaper(startMm.x, startMm.y);
        if (!fanOut) return spot;
        const step = Na__LeCfg__GetClipboardSetup().pasteOffsetMm;
        for (let n = 1; taken(spot) && n <= Na__LeClip__MAX_STEPS; n++) spot = onPaper(startMm.x + (step * n), startMm.y + (step * n));
        for (let n = 1; taken(spot) && n <= Na__LeClip__MAX_STEPS; n++) spot = onPaper(startMm.x - (step * n), startMm.y - (step * n));
        return spot;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Layer a Paste Keeps, or Null for the Sheet's Default of That Type
    // ------------------------------------------------------------
    // Layer ids are per sheet, so on another sheet the same id can name a
    // layer of a different purpose - or one that is hidden, locked or a
    // reference layer, where a paste would vanish, refuse to move or be out
    // of reach. type, when given, must match (a vector paste must not land on
    // a viewport layer that happens to share an id).
    // ------------------------------------------------------------
    function Na__LeClip__LayerFor(sheet, layerId, type) {
        const layer = layerId ? Na__LeModel__GetLayerById(sheet, layerId) : null;
        if (!layer || layer.Layer__Visible === false || layer.Layer__Locked === true || layer.Layer__Selectable === false) return null;
        if (type && layer.Layer__Type !== type) return null;
        return layer.Layer__Id;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Land a Copy of a Viewport Record on a Sheet (one announcement) and Select It
    // ------------------------------------------------------------
    // atMm: the top-left corner asked for, or null to start from where the
    // record sat and fan out from there.
    // ------------------------------------------------------------
    function Na__LeClip__Land(sheet, source, atMm) {
        const record = Na__LeClip__Clone(source);
        const frame  = record.Viewport__FrameMm || {};
        const spot   = Na__LeClip__Place(sheet, frame, atMm || { x : frame.X, y : frame.Y }, !atMm);
        record.Viewport__FrameMm = Object.assign({}, frame, spot);
        record.Viewport__Name    = Na__LeClip__UniqueName(sheet, source);
        record.Viewport__LayerId = Na__LeClip__LayerFor(sheet, source.Viewport__LayerId);
        record.Viewport__Locked  = false;                                        // <-- The next thing done to a copy is moving it
        if (!Na__LeCfg__GetClipboardSetup().copySnapshot) record.Viewport__SnapshotAsset = null;

        const pasted = Na__LeModel__InsertViewport(sheet, record);
        if (pasted) Na__LeModel__SetSelection({ kind : Na__LeClip__KIND_VIEWPORT, id : pasted.Viewport__Id });
        return pasted;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Land a Copy of a Vector Record on a Sheet (one announcement) and Select It
    // ------------------------------------------------------------
    // atMm: the bounding-box top-left asked for, or null to start from where
    // the record sat. fanOut, when true, steps that spot clear of a shape
    // already sitting there - Duplicate wants that; an ordinary paste does
    // not (it always lands in place, on top of the original if that is
    // where the copy came from).
    // ------------------------------------------------------------
    function Na__LeClip__LandShape(sheet, source, atMm, fanOut) {
        const record = Na__LeClip__Clone(source);
        const bounds = Na__LeShapeGeo__Bounds(source);
        const start  = atMm || { x : bounds.X, y : bounds.Y };
        const spot   = Na__LeClip__PlaceShape(sheet, bounds, start, !!fanOut);
        record.Shape__Points  = Na__LeShapeGeo__Translated(Na__LeShapeGeo__Points(record), spot.X - bounds.X, spot.Y - bounds.Y);
        record.Shape__LayerId = Na__LeClip__LayerFor(sheet, source.Shape__LayerId, 'vector');

        const pasted = Na__LeModel__InsertShape(sheet, record);
        if (pasted) Na__LeModel__SetSelection({ kind : Na__LeClip__KIND_SHAPE, id : pasted.Shape__Id });
        return pasted;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Copy a Viewport Onto the Clipboard
    // ------------------------------------------------------------
    function Na__LeClip__CopyViewport(sheet, viewportId) {
        const viewport = sheet ? Na__LeModel__GetViewportById(sheet, viewportId) : null;
        if (!viewport) return false;
        const label = Na__LeModel__ResolveViewportSource(viewport).label;
        Na__LeClip__Held = { kind : Na__LeClip__KIND_VIEWPORT, record : Na__LeClip__Clone(viewport), sourceId : viewportId, sourceSheetId : sheet.Sheet__Id, label : label };
        Na__LeClip__Dispatch();
        Na__LeClip__Toast(Na__LeCfg__FormatLabel('ViewportCopied', 'Copied "{name}". Ctrl+V pastes it, on this sheet or another.', { name : label }));
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does the Clipboard Hold a Viewport
    // ------------------------------------------------------------
    function Na__LeClip__HasViewport() {
        return !!Na__LeClip__Held && Na__LeClip__Held.kind === Na__LeClip__KIND_VIEWPORT;
    }
    // ------------------------------------------------------------


    // FUNCTION | Paste What Is Held as a New Viewport (null when nothing is held)
    // ------------------------------------------------------------
    function Na__LeClip__PasteViewport(sheet, atMm) {
        if (!sheet || !Na__LeClip__HasViewport()) return null;
        return Na__LeClip__Land(sheet, Na__LeClip__Held.record, atMm || null);
    }
    // ------------------------------------------------------------


    // FUNCTION | Duplicate a Viewport in One Step (the clipboard is left alone)
    // ------------------------------------------------------------
    function Na__LeClip__DuplicateViewport(sheet, viewportId) {
        const viewport = sheet ? Na__LeModel__GetViewportById(sheet, viewportId) : null;
        return viewport ? Na__LeClip__Land(sheet, viewport, null) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Copy a Vector Onto the Clipboard
    // ------------------------------------------------------------
    function Na__LeClip__CopyShape(sheet, shapeId) {
        const shape = sheet ? Na__LeModel__GetShapeById(sheet, shapeId) : null;
        if (!shape || Na__LeShapeGeo__Points(shape).length < 1) return false;
        Na__LeClip__Held = { kind : Na__LeClip__KIND_SHAPE, record : Na__LeClip__Clone(shape), sourceId : shapeId, sourceSheetId : sheet.Sheet__Id, label : 'vector' };
        Na__LeClip__Dispatch();
        Na__LeClip__Toast(Na__LeCfg__GetLabel('ShapeCopied', 'Copied vector. Ctrl+V pastes it, on this sheet or another.'));
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Does the Clipboard Hold a Vector
    // ------------------------------------------------------------
    function Na__LeClip__HasShape() {
        return !!Na__LeClip__Held && Na__LeClip__Held.kind === Na__LeClip__KIND_SHAPE;
    }
    // ------------------------------------------------------------


    // FUNCTION | Paste What Is Held as a New Vector (null when nothing is held)
    // ------------------------------------------------------------
    // Always lands in place - no fan-out - since a toast now says the paste
    // worked instead of a visible offset.
    // ------------------------------------------------------------
    function Na__LeClip__PasteShape(sheet, atMm) {
        if (!sheet || !Na__LeClip__HasShape()) return null;
        const pasted = Na__LeClip__LandShape(sheet, Na__LeClip__Held.record, atMm || null, false);
        if (pasted) Na__LeClip__Toast(Na__LeCfg__GetLabel('ShapePasted', 'Pasted vector in the same place.'));
        return pasted;
    }
    // ------------------------------------------------------------


    // FUNCTION | Duplicate a Vector in One Step (the clipboard is left alone)
    // ------------------------------------------------------------
    // Keeps the fan-out: Duplicate shows no toast, so the step clear of the
    // original is what tells you it worked.
    // ------------------------------------------------------------
    function Na__LeClip__DuplicateShape(sheet, shapeId) {
        const shape = sheet ? Na__LeModel__GetShapeById(sheet, shapeId) : null;
        return shape ? Na__LeClip__LandShape(sheet, shape, null, true) : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Empty the Clipboard
    // ------------------------------------------------------------
    function Na__LeClip__Clear() {
        if (!Na__LeClip__Held) return;
        Na__LeClip__Held = null;
        Na__LeClip__Dispatch();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Selected Viewport's Id on a Sheet, or Null
    // ------------------------------------------------------------
    function Na__LeClip__SelectedViewportId(sheet) {
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection || selection.kind !== Na__LeClip__KIND_VIEWPORT) return null;
        return Na__LeModel__GetViewportById(sheet, selection.id) ? selection.id : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Selected Vector's Id on a Sheet, or Null
    // ------------------------------------------------------------
    function Na__LeClip__SelectedShapeId(sheet) {
        const selection = Na__LeModel__GetSelection();
        if (!sheet || !selection || selection.kind !== Na__LeClip__KIND_SHAPE) return null;
        return Na__LeModel__GetShapeById(sheet, selection.id) ? selection.id : null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Paste Whatever Kind Is Held (null when the clipboard is empty)
    // ------------------------------------------------------------
    function Na__LeClip__PasteHeld(sheet, atMm) {
        if (Na__LeClip__HasShape())    return Na__LeClip__PasteShape(sheet, atMm);
        if (Na__LeClip__HasViewport()) return Na__LeClip__PasteViewport(sheet, atMm);
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Run a Clipboard Key Action (Edit__Copy, Edit__Paste, Edit__Duplicate)
    // ------------------------------------------------------------
    // Returns true when the key did something, so the caller only takes the
    // key away from the browser then: Ctrl+C with nothing selected is left
    // to the browser, which may have text of its own to copy.
    // ------------------------------------------------------------
    function Na__LeClip__RunKeyAction(action, editable) {
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet || !editable) return false;
        const viewportId = Na__LeClip__SelectedViewportId(sheet);
        const shapeId    = Na__LeClip__SelectedShapeId(sheet);
        if (action === 'Edit__Copy') {
            if (shapeId)    return Na__LeClip__CopyShape(sheet, shapeId);
            if (viewportId) return Na__LeClip__CopyViewport(sheet, viewportId);
            return false;
        }
        if (action === 'Edit__Paste')     return !!Na__LeClip__PasteHeld(sheet, null);
        if (action === 'Edit__Duplicate') {
            if (shapeId)    return !!Na__LeClip__DuplicateShape(sheet, shapeId);
            if (viewportId) return !!Na__LeClip__DuplicateViewport(sheet, viewportId);
            return false;
        }
        return false;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Clipboard Entries for the Right-Click Menu
    // ------------------------------------------------------------
    // target  : the viewport or shape right-clicked (the record, or { kind, id }),
    //           or null for bare paper
    // pointMm : where the menu opened. A paste from bare paper puts its
    //           top-left corner there; one from an item fans out as Ctrl+V
    //           does, because a click on an item is not a choice of spot.
    // ------------------------------------------------------------
    function Na__LeClip__MenuItems(sheet, target, pointMm) {
        const label = (key, fallback) => Na__LeCfg__GetLabel(key, fallback);
        const kind  = target
            ? ((target.kind === Na__LeClip__KIND_SHAPE || target.Shape__Id) ? Na__LeClip__KIND_SHAPE
                : ((target.kind === Na__LeClip__KIND_VIEWPORT || target.Viewport__Id) ? Na__LeClip__KIND_VIEWPORT : null))
            : null;
        const paste = {
            label    : (Na__LeClip__HasShape() || (!Na__LeClip__HasViewport() && kind === Na__LeClip__KIND_SHAPE))
                ? label('MenuPasteShape', 'Paste vector')
                : label('MenuPasteViewport', 'Paste viewport'),
            disabled : !Na__LeClip__HasShape() && !Na__LeClip__HasViewport(),
            onSelect : () => { Na__LeClip__PasteHeld(sheet, target ? null : (pointMm || null)); }
        };
        if (kind === Na__LeClip__KIND_SHAPE) {
            const id = target.Shape__Id || target.id;
            if (!Na__LeModel__GetShapeById(sheet, id)) return [ paste ];
            return [
                { label : label('MenuCopyShape', 'Copy vector'),           onSelect : () => { Na__LeClip__CopyShape(sheet, id); } },
                { label : label('MenuDuplicateShape', 'Duplicate vector'), onSelect : () => { Na__LeClip__DuplicateShape(sheet, id); } },
                paste
            ];
        }
        if (kind === Na__LeClip__KIND_VIEWPORT) {
            const viewport = target.Viewport__Id ? target : Na__LeModel__GetViewportById(sheet, target.id);
            if (!viewport) return [ paste ];
            return [
                { label : label('MenuCopyViewport', 'Copy viewport'),           onSelect : () => { Na__LeClip__CopyViewport(sheet, viewport.Viewport__Id); } },
                { label : label('MenuDuplicateViewport', 'Duplicate viewport'), onSelect : () => { Na__LeClip__DuplicateViewport(sheet, viewport.Viewport__Id); } },
                paste
            ];
        }
        return [ paste ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Viewport Clipboard API
    // ------------------------------------------------------------
    export {
        Na__LeClip__CHANGED_EVENT,
        Na__LeClip__CopyViewport,
        Na__LeClip__PasteViewport,
        Na__LeClip__DuplicateViewport,
        Na__LeClip__HasViewport,
        Na__LeClip__CopyShape,
        Na__LeClip__PasteShape,
        Na__LeClip__DuplicateShape,
        Na__LeClip__HasShape,
        Na__LeClip__IsCopyName,
        Na__LeClip__BaseName,
        Na__LeClip__RunKeyAction,
        Na__LeClip__MenuItems,
        Na__LeClip__Clear
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
