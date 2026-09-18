// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET TOOLS - CONTEXT MENU
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetTools__ContextMenu__.js
// NAMESPACE  : Na__LeTools
// MODULE     : Layout Editor - Sheet Tools - Context Menu
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A right click: finish or cancel a placement, or select what was clicked and open the menu for it
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - OnContextMenu: the PC controls pan on a right drag, so the menu opens
//   only when the right button came up where it went down (MENU_SLOP_PX); a
//   touch long-press opens it too. The inline text field keeps the browser's
//   menu. A right click ends a polyline and cancels a dimension, rectangle or
//   leader being placed. Otherwise the item under the cursor is selected (a
//   right click on one of several selected keeps them all) and the menu
//   opens.
// - MenuItems: the menu for what was right-clicked, in the same order as
//   selection. Several selected: group, ungroup, the clipboard and delete.
//   Bare paper: zoom to fit, snapping, paste and re-render the sheet. Text, a
//   group, a dimension, a leader, a shape or a viewport: its own edits,
//   Arrange where the kind has it, delete, the clipboard, the eyedropper's
//   Copy and Paste properties and Use for new ..., and undo and redo. A
//   viewport's menu leads with the door under the click on a plan
//   (Na__LayoutEditor__PlanDoors__) and lists the design phases it can draw
//   (Na__LayoutEditor__ModelSource__). A read-only session gets Zoom to fit
//   alone.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__ listens on the stage with OnContextMenu.
// - Opens Na__LayoutEditor__ContextMenu__. Its delete items call
//   DeleteSelection in Na__LayoutEditor__SheetTools__Keyboard__, and its
//   viewport items Na__LayoutEditor__SheetTools__ContentEditing__.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : The door and design phase items on a viewport's menu are TrueVision's own.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 17-Sep-2026 - Version 1.1.0
// - THE MENU BELONGS TO THE OPEN CONTAINER. Inside a vector it is about its
//   points - insert one where the click landed, delete the picked ones, close
//   the shape, step back out - and inside a dimension about its value, where
//   that value sits, and the way out. This is where the cut, extend, trim and
//   join tools will sit: they belong to that container and to no other.
// - Outside one, a vector, a dimension and a group each offer the way in (Edit
//   vector points / Edit dimension points / Edit inside group) beside what they
//   already offered.
// - A right click off an open container offers the way out and nothing that
//   would touch the faded sheet.
//
//
// 17-Sep-2026 - Version 1.1.0
// - Paste properties to N selected, on a multi-selection and on a group. The
//   count is what will actually change: the items are expanded past any group
//   first, then the source itself, the other kinds and the locked are left
//   out, and the item does not appear at all when the answer is none.
// - A group whose members are all one kind hands out a style as well as taking
//   one, so a row of bubbles can be copied from without being opened.
//
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__SheetTools__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Markup, Tools, Eyedropper, Viewports, Plan Doors, Snapping, Clipboard, Groups, Model Source, Navigation, History, Menu, Force Render
    // ------------------------------------------------------------
    import { Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel, Na__LeCfg__GetGuards } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import {
        Na__LeModel__KIND_2D,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetViewportById,
        Na__LeModel__IsLayerLocked,
        Na__LeModel__UpdateViewport,
        Na__LeModel__UpdateAnnotation,
        Na__LeModel__UpdateDimension,
        Na__LeModel__UpdateShape,
        Na__LeModel__SetSelection,
        Na__LeModel__GetSelectionItems,
        Na__LeModel__IsSelected,
        Na__LeModel__CanArrange,
        Na__LeModel__Arrange
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeSurface__ClientToPaperMm, Na__LeSurface__GetEditingViewport } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeMarkup__AnnotationRotationDeg } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import { Na__LeShapeGeo__Points, Na__LeShapeGeo__InsertPoint } from '../15__Core__Markup/Na__LayoutEditor__ShapeGeometry__.js';
    import { Na__LeText__BeginEdit, Na__LeText__Commit, Na__LeText__IsEditing, Na__LeText__RotationPatch } from '../35__System__DrawingTools/Na__LayoutEditor__TextTool__.js';
    import { Na__LeDim__Cancel, Na__LeDim__IsPlacing, Na__LeDim__BeginTextEdit } from '../35__System__DrawingTools/Na__LayoutEditor__DimensionTool__.js';
    import { Na__LeShape__Finish, Na__LeShape__IsDrawing } from '../35__System__DrawingTools/Na__LayoutEditor__ShapeTool__.js';
    import { Na__LeRect__Cancel, Na__LeRect__IsDrawing } from '../35__System__DrawingTools/Na__LayoutEditor__RectangleTool__.js';
    import { Na__LeLeader__Cancel, Na__LeLeader__IsPlacing, Na__LeLeader__BeginEdit } from '../35__System__DrawingTools/Na__LayoutEditor__LeaderTool__.js';
    import { Na__LeDrop__Pick, Na__LeDrop__Paint, Na__LeDrop__CanApply, Na__LeDrop__PaletteMenuLabel,
             Na__LeDrop__PaintMany, Na__LeDrop__PaintableIn, Na__LeDrop__HasSource, Na__LeDrop__StyleKeys } from './Na__LayoutEditor__Eyedropper__.js';
    import { Na__LeVp2d__Describe } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeDoors__MenuItems } from '../20__System__Viewports/Na__LayoutEditor__PlanDoors__.js';
    import { Na__LeOsnap__Toggle, Na__LeOsnap__IsEnabled } from './Na__LayoutEditor__Snapping__.js';
    import { Na__LeClip__MenuItems } from './Na__LayoutEditor__ItemClipboard__.js';
    import { Na__LeGroup__Group, Na__LeGroup__Ungroup, Na__LeGroup__CanGroup, Na__LeGroup__CanUngroup, Na__LeGroup__Expand } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    // @delegate: ../15__Core__Markup/Na__LayoutEditor__Groups__.js
    // @delegate: ./Na__LayoutEditor__ItemClipboard__.js
    import { Na__LeSource__MenuItems } from '../20__System__Viewports/Na__LayoutEditor__ModelSource__.js';
    import { Na__LeNav__Fit } from '../10__Core__SheetSurface/Na__LayoutEditor__Navigation__.js';
    import { Na__LeHist__CanUndo, Na__LeHist__CanRedo, Na__LeHist__Undo, Na__LeHist__Redo } from '../07__Core__SheetData/Na__LayoutEditor__History__.js';
    import { Na__LeMenu__Open } from './Na__LayoutEditor__ContextMenu__.js';
    import { Na__LeForce__IsRunning, Na__LeForce__Viewport, Na__LeForce__Sheet } from '../20__System__Viewports/Na__LayoutEditor__ForceRender__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Edit Scope, the Container the Menu Belongs To
    // ------------------------------------------------------------
    import {
        Na__LeScope__IsLeafOpen,
        Na__LeScope__GetVectorId,
        Na__LeScope__GetDimensionId,
        Na__LeScope__SetVertices,
        Na__LeScope__VertexCount,
        Na__LeScope__Clear
    } from './Na__LayoutEditor__EditScope__.js';
    import { Na__LeTools__EnterScope } from './Na__LayoutEditor__SheetTools__PointerPress__.js';
    import { Na__LeTools__DeleteSelection, Na__LeTools__DeleteVertices } from './Na__LayoutEditor__SheetTools__Keyboard__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Sheet Tools Units
    // ------------------------------------------------------------
    import {
        Na__LeTools__MENU_SLOP_PX,
        Na__LeTools__Editable,
        Na__LeTools__RightPress,
        Na__LeTools__WriteRightPress
    } from './Na__LayoutEditor__SheetTools__State__.js';
    import { Na__LeTools__SyncPaletteFrom } from './Na__LayoutEditor__SheetTools__ToolState__.js';
    import { Na__LeTools__Tolerance, Na__LeTools__Resolve, Na__LeTools__Record, Na__LeTools__ShapeInsertHit } from './Na__LayoutEditor__SheetTools__HitResolution__.js';
    import { Na__LeTools__SetEditingViewport, Na__LeTools__RecentreViewport } from './Na__LayoutEditor__SheetTools__ContentEditing__.js';

    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Context Menu
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Menu for What Was Right-Clicked
    // ------------------------------------------------------------
    function Na__LeTools__MenuItems(sheet, found, pointMm) {
        const label   = (key, fallback) => Na__LeCfg__GetLabel(key, fallback);
        const remove  = (key, fallback) => ({ label : label(key, fallback), danger : true, onSelect : () => { void Na__LeTools__DeleteSelection(); } });
        const arrange = (kind, id) => [
            { label : label('MenuBringToFront', 'Bring to front'), disabled : !Na__LeModel__CanArrange(sheet, kind, id, 'front'),    onSelect : () => Na__LeModel__Arrange(sheet, kind, id, 'front') },
            { label : label('MenuBringForward', 'Bring forward'),  disabled : !Na__LeModel__CanArrange(sheet, kind, id, 'forward'),  onSelect : () => Na__LeModel__Arrange(sheet, kind, id, 'forward') },
            { label : label('MenuSendBackward', 'Send backward'),  disabled : !Na__LeModel__CanArrange(sheet, kind, id, 'backward'), onSelect : () => Na__LeModel__Arrange(sheet, kind, id, 'backward') },
            { label : label('MenuSendToBack',   'Send to back'),   disabled : !Na__LeModel__CanArrange(sheet, kind, id, 'back'),     onSelect : () => Na__LeModel__Arrange(sheet, kind, id, 'back') }
        ];

        // STYLE | The eyedropper reached without the hotkey. Copy loads the
        // same dropper the B key uses, so a copy here can be pasted by menu,
        // by clicking with the tool, or both. palette: false leaves off "Use
        // for new ...", which viewports do not have.
        // ------------------------------------
        const style = (kind, id, opts) => {
            const items = [
                { label : label('MenuCopyStyle', 'Copy properties'), onSelect : () => Na__LeDrop__Pick(sheet, kind, id) },
                { label : label('MenuPasteStyle', 'Paste properties'), disabled : !Na__LeDrop__CanApply(sheet, kind, id).ok,
                  onSelect : () => Na__LeDrop__Paint(sheet, kind, id) }
            ];
            if (!opts || opts.palette !== false) {
                items.push({ label : Na__LeDrop__PaletteMenuLabel(kind), onSelect : () => { Na__LeTools__SyncPaletteFrom(sheet, { kind : kind, id : id }); } });
            }
            items.push({ separator : true });
            return items;
        };

        // STYLE, MANY AT ONCE | The same held style over a whole selection, or
        // over the members of a group. The items are expanded past any group
        // first, so a window that took a group paints what is inside it; the
        // count on the label is what will actually change, locked items and
        // other kinds already left out.
        // ------------------------------------
        const styleMany = (items) => {
            if (!Na__LeDrop__HasSource()) return [];
            const targets = Na__LeDrop__PaintableIn(sheet, Na__LeGroup__Expand(sheet, items));
            if (!targets.length) return [];
            return [
                { label : Na__LeCfg__FormatLabel('MenuPasteStyleMany', 'Paste properties to {count} selected', { count : targets.length }),
                  onSelect : () => Na__LeDrop__PaintMany(sheet, targets) },
                { separator : true }
            ];
        };

        const history = [
            { label : label('Undo', 'Undo'), disabled : !Na__LeHist__CanUndo(), onSelect : () => Na__LeHist__Undo() },
            { label : label('Redo', 'Redo'), disabled : !Na__LeHist__CanRedo(), onSelect : () => Na__LeHist__Redo() }
        ];
        if (!Na__LeTools__Editable) return [ { label : label('MenuZoomFit', 'Zoom to fit'), onSelect : () => Na__LeNav__Fit() } ];
        // SEVERAL SELECTED | A right click on one of them is about all of them
        const selected = Na__LeModel__GetSelectionItems();
        if (found && selected.length > 1 && Na__LeModel__IsSelected(found.kind, found.id)) {
            const groupOps = [];
            if (Na__LeGroup__CanGroup(sheet))   groupOps.push({ label : label('MenuGroup', 'Group'),     onSelect : () => { Na__LeGroup__Group(sheet); } });
            if (Na__LeGroup__CanUngroup(sheet)) groupOps.push({ label : label('MenuUngroup', 'Ungroup'), onSelect : () => { Na__LeGroup__Ungroup(sheet); } });
            return groupOps.concat(Na__LeClip__MenuItems(sheet, found, pointMm), [
                { separator : true }
            ], styleMany(selected), [                                           // <-- Copy one, then paste it over the rest in a single click
                { label : Na__LeCfg__FormatLabel('MenuDeleteSelection', 'Delete {count} selected items', { count : selected.length }), danger : true,
                  onSelect : () => { void Na__LeTools__DeleteSelection(); } },
                { separator : true }
            ]).concat(history);
        }
        if (!found && Na__LeScope__IsLeafOpen()) {
            return [
                { label : label('MenuCloseScope', 'Close and step back out'), onSelect : () => { Na__LeScope__Clear(); Na__LeModel__SetSelection(null); } },
                { separator : true }
            ].concat(history);
        }
        if (!found) {
            const snapping = Na__LeOsnap__IsEnabled();
            return [
                { label : label('MenuZoomFit', 'Zoom to fit'), onSelect : () => Na__LeNav__Fit() },
                { label : snapping ? label('MenuSnapOff', 'Snapping off') : label('MenuSnapOn', 'Snapping on'), checked : snapping, onSelect : () => Na__LeOsnap__Toggle() },
                { separator : true }
            ].concat(Na__LeClip__MenuItems(sheet, null, pointMm), [                  // <-- Paste viewport or vector, with its corner at the click
                { separator : true },
                { label : label('MenuForceRenderSheet', 'Re-render every viewport on this sheet'), disabled : Na__LeForce__IsRunning(),
                  onSelect : () => { void Na__LeForce__Sheet(sheet); } },
                { separator : true }
            ]).concat(history);
        }
        if (found.kind === 'annotation') {
            const text = Na__LeTools__Record(sheet, found);
            const turn = (text && Na__LeMarkup__AnnotationRotationDeg(text) !== 0)   // <-- Only on turned text, as Reset text position is only on a moved value
                ? [ { label : label('MenuResetTextRotation', 'Reset rotation'), onSelect : () => Na__LeModel__UpdateAnnotation(sheet, found.id, Na__LeText__RotationPatch(text, 0), false) } ]
                : [];
            return [ { label : label('MenuEditText', 'Edit text'), onSelect : () => Na__LeText__BeginEdit(found.id) } ].concat(turn, [
                     { separator : true } ]).concat(arrange('annotation', found.id), [
                     { separator : true }, remove('MenuDeleteText', 'Delete text'), { separator : true } ])
                     .concat(Na__LeClip__MenuItems(sheet, found, pointMm), style(found.kind, found.id)).concat(history);
        }
        if (found.kind === 'group') {
            // A GROUP HAS A STYLE ONLY WHERE ITS MEMBERS AGREE ON A KIND. Copy
            // is offered when everything inside is the same kind of thing - a
            // row of bubbles, a block of notes - because then there is one
            // answer to "copy properties from what". A mixed group has none, so
            // it takes a style but does not hand one out.
            const members = Na__LeGroup__Expand(sheet, [ found ]).filter((m) => m.kind !== 'group' && Na__LeDrop__StyleKeys(m.kind).length > 0);
            const oneKind = members.length > 0 && members.every((m) => m.kind === members[0].kind);
            const copy    = oneKind
                ? [ { label : label('MenuCopyStyle', 'Copy properties'), onSelect : () => Na__LeDrop__Pick(sheet, members[0].kind, members[0].id) }, { separator : true } ]
                : [];
            return [ { label : label('MenuEnterGroup', 'Edit inside group'), onSelect : () => { Na__LeTools__EnterScope(sheet, { kind : 'group', id : found.id }); } },
                     { label : label('MenuUngroup', 'Ungroup'), disabled : !Na__LeGroup__CanUngroup(sheet), onSelect : () => { Na__LeGroup__Ungroup(sheet); } },
                     remove('MenuDeleteGroup', 'Delete group'), { separator : true } ]
                     .concat(Na__LeClip__MenuItems(sheet, found, pointMm), copy, styleMany([ found ]), history);
        }
        if (found.kind === 'dimension') {
            const dim   = Na__LeTools__Record(sheet, found);
            const moved = !!dim && (Number.isFinite(dim.Dimension__TextDXMm) || Number.isFinite(dim.Dimension__TextDYMm));
            const reset = moved
                ? [ { label : label('MenuResetDimText', 'Reset text position'), onSelect : () => Na__LeModel__UpdateDimension(sheet, found.id, { textDXMm : 0, textDYMm : 0 }, false) } ]
                : [];

            // INSIDE THE DIMENSION the menu is about what it measures: the value
            // it prints, where that value sits, and the way back out. Its grips
            // do the rest - the squares re-pick the two measured points, the
            // round one slides the line - which is what a dimension being
            // "editable" actually means.
            // ------------------------------------
            if (Na__LeScope__GetDimensionId() === found.id) {
                return [
                    { label : label('MenuEditDimText', 'Edit dimension value'), onSelect : () => Na__LeDim__BeginTextEdit(found.id) }
                ].concat(reset, [
                    { separator : true },
                    { label : label('MenuCloseScope', 'Close and step back out'), onSelect : () => { Na__LeScope__Clear(); Na__LeModel__SetSelection(null); } },
                    { separator : true }
                ]).concat(style(found.kind, found.id)).concat(history);
            }

            return [
                { label : label('MenuEnterDimension', 'Edit dimension points'), onSelect : () => { Na__LeTools__EnterScope(sheet, { kind : 'dimension', id : found.id }); } },
                { label : label('MenuEditDimText', 'Edit dimension value'), onSelect : () => Na__LeDim__BeginTextEdit(found.id) }
            ].concat(reset, [{ separator : true }], arrange('dimension', found.id), [
                     { separator : true }, remove('MenuDeleteDimension', 'Delete dimension'), { separator : true } ])
                     .concat(style(found.kind, found.id)).concat(history);
        }
        if (found.kind === 'leader') {
            return [ { label : label('MenuEditLeaderText', 'Edit leader text'), onSelect : () => Na__LeLeader__BeginEdit(found.id) },
                     { separator : true } ].concat(arrange('leader', found.id), [
                     { separator : true }, remove('MenuDeleteLeader', 'Delete leader'), { separator : true } ])
                     .concat(Na__LeClip__MenuItems(sheet, found, pointMm), style(found.kind, found.id)).concat(history);
        }
        if (found.kind === 'shape') {
            const shape  = Na__LeTools__Record(sheet, found);
            const closed = !!shape && shape.Shape__Closed === true;

            // INSIDE THE VECTOR the menu is about its points and nothing else:
            // add one where the click landed, take the picked ones out, or step
            // back out. This is where the cut, extend, trim and join tools will
            // sit when they arrive - they belong to this container and to no
            // other, which is the whole reason for having one.
            // ------------------------------------
            if (Na__LeScope__GetVectorId() === found.id) {
                const picked = Na__LeScope__VertexCount();
                const insert = shape ? Na__LeTools__ShapeInsertHit(sheet, shape, pointMm) : null;
                return [
                    { label : label('MenuInsertVertex', 'Insert point here'), disabled : !insert,
                      onSelect : () => {
                          const points = Na__LeShapeGeo__InsertPoint(Na__LeShapeGeo__Points(shape), insert.index, insert.point);
                          Na__LeScope__SetVertices([ insert.index + 1 ]);
                          Na__LeModel__UpdateShape(sheet, found.id, { points : points }, false);
                      } },
                    { label : picked > 1 ? Na__LeCfg__FormatLabel('MenuDeleteVertices', 'Delete {count} points', { count : picked }) : label('MenuDeleteVertex', 'Delete point'),
                      disabled : picked < 1, danger : true, onSelect : () => { Na__LeTools__DeleteVertices(); } },
                    { separator : true },
                    { label : closed ? label('MenuOpenShape', 'Open shape') : label('MenuCloseShape', 'Close shape'), disabled : !shape || Na__LeShapeGeo__Points(shape).length < 3,
                      onSelect : () => Na__LeModel__UpdateShape(sheet, found.id, { closed : !closed }) },
                    { label : label('MenuCloseScope', 'Close and step back out'), onSelect : () => { Na__LeScope__Clear(); Na__LeModel__SetSelection(null); } },
                    { separator : true }
                ].concat(history);
            }

            return [ { label : label('MenuEnterVector', 'Edit vector points'), onSelect : () => { Na__LeTools__EnterScope(sheet, { kind : 'shape', id : found.id }); } },
                     { label : closed ? label('MenuOpenShape', 'Open shape') : label('MenuCloseShape', 'Close shape'), disabled : !shape || Na__LeShapeGeo__Points(shape).length < 3,
                       onSelect : () => Na__LeModel__UpdateShape(sheet, found.id, { closed : !closed }) },
                     { separator : true } ].concat(arrange('shape', found.id), [
                     { separator : true }, remove('MenuDeleteShape', 'Delete shape'), { separator : true } ])
                     .concat(Na__LeClip__MenuItems(sheet, shape || found, pointMm), style(found.kind, found.id)).concat(history);
        }

        const viewport = Na__LeModel__GetViewportById(sheet, found.id);
        if (!viewport) return history;
        const layerLocked = Na__LeModel__IsLayerLocked(sheet, viewport.Viewport__LayerId);
        const locked      = layerLocked || viewport.Viewport__Locked === true;
        const editing     = Na__LeSurface__GetEditingViewport() === found.id;
        const del         = remove('MenuDeleteViewport', 'Delete viewport');
        del.disabled = locked;
        const doors = Na__LeDoors__MenuItems(sheet, viewport, viewport.Viewport__Kind === Na__LeModel__KIND_2D ? Na__LeVp2d__Describe(viewport) : null, pointMm, Na__LeTools__Tolerance());   // <-- A plan's door under the click leads the menu, locked or not
        return [
            ...doors,
            { label : editing ? label('MenuFinishView', 'Finish editing content') : label('MenuEditView', 'Edit viewport content'), disabled : locked, onSelect : () => Na__LeTools__SetEditingViewport(editing ? null : found.id) },
            { label : label('MenuCentre', 'Recentre content'), disabled : locked, onSelect : () => Na__LeTools__RecentreViewport(sheet, found.id) },
            { label : viewport.Viewport__Locked === true ? label('MenuUnlock', 'Unlock viewport') : label('MenuLock', 'Lock viewport'), disabled : layerLocked, checked : viewport.Viewport__Locked === true,
              onSelect : () => Na__LeModel__UpdateViewport(sheet, found.id, { locked : viewport.Viewport__Locked !== true }) },
            { separator : true }
        ].concat(locked ? [] : style(found.kind, found.id, { palette : false }), Na__LeClip__MenuItems(sheet, viewport, pointMm), Na__LeSource__MenuItems(sheet, viewport, locked), [   // <-- Copy, duplicate and paste viewport; then the design phase it draws
            { separator : true },
            // BOTH SCOPES ARE OFFERED ON A VIEWPORT, not just its own. Half the
            // time the frame under the cursor is simply the one nearest the
            // hand, and the thing actually wanted is the whole sheet; making
            // that require a right click on empty paper would be a small,
            // regular annoyance on a sheet that is mostly viewports.
            { label : label('MenuForceRenderViewport', 'Re-render this viewport'), disabled : Na__LeForce__IsRunning(),
              onSelect : () => { void Na__LeForce__Viewport(sheet, found.id); } },
            { label : label('MenuForceRenderSheet', 'Re-render every viewport on this sheet'), disabled : Na__LeForce__IsRunning(),
              onSelect : () => { void Na__LeForce__Sheet(sheet); } },
            { separator : true }, del, { separator : true }
        ]).concat(history);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Right Click: Finish or Cancel a Placement, Else Select and Open the Menu
    // ------------------------------------------------------------
    // The PC controls pan on a right drag, so the menu only opens when the
    // button came up where it went down. A touch long-press arrives here
    // with no press recorded and opens the menu too.
    // ------------------------------------------------------------
    function Na__LeTools__OnContextMenu(event) {
        const target = event.target;
        if (target && typeof target.closest === 'function' && target.closest(Na__LeCfg__GetGuards().contextMenuKeepSelector)) return;   // <-- The inline text field keeps the browser menu
        event.preventDefault();
        const press = Na__LeTools__RightPress;
        Na__LeTools__WriteRightPress(null);
        if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > Na__LeTools__MENU_SLOP_PX) return;   // <-- That right button panned
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!sheet || !point) return;
        if (Na__LeShape__IsDrawing()) { Na__LeShape__Finish(sheet, false); return; }   // <-- As in CAD, a right click ends the line
        if (Na__LeDim__IsPlacing())   { Na__LeDim__Cancel(sheet); return; }
        if (Na__LeRect__IsDrawing())  { Na__LeRect__Cancel(); return; }        // <-- A rectangle has no half worth keeping
        if (Na__LeLeader__IsPlacing()) { Na__LeLeader__Cancel(sheet); return; }   // <-- Nor has a leader with no head
        if (Na__LeText__IsEditing()) Na__LeText__Commit();
        const found = Na__LeTools__Resolve(sheet, point);
        const keep  = !!found && Na__LeModel__GetSelectionItems().length > 1 && Na__LeModel__IsSelected(found.kind, found.id);   // <-- A right click on one of several selected keeps them all
        if (!keep) Na__LeModel__SetSelection(found ? { kind : found.kind, id : found.id } : null);
        Na__LeMenu__Open(event.clientX, event.clientY, Na__LeTools__MenuItems(sheet, found, point));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Tools Context Menu
    // ------------------------------------------------------------
    export {
        Na__LeTools__OnContextMenu
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
