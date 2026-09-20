// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PARAMETRIC SCRAPBOOK - GRIPS
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookParametric__Grips__.js
// NAMESPACE  : Na__LeParamGrips
// MODULE     : Layout Editor - Parametric Scrapbook - Grips
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The grips a selected parametric element shows on the sheet: the stretch arrow that lengthens it, the slide arrow that carries it along, and the lookup triangle that opens its menu
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - AN AUTOCAD DYNAMIC BLOCK'S TWO GRIPS. Select a parametric element and an
//   arrow stands off its far end and a triangle off its near one, both level
//   with its middle, and its box is tagged with its name instead of "Group".
//     Stretch  drag the arrow and the element follows, live, in whole steps
//              (a scale bar's divisions). One undo step when it is let go.
//              Escape puts it back.
//     Slide    the double arrow a type puts on an end that is meant to be
//              PLACED rather than pulled - today, the far end of a scale bar
//              stood to the right of its title. It carries the element's part
//              along without changing its length, and it SNAPS: the projected
//              linework of the drawing above is searched exactly as the Draw
//              tool searches it, so the end can be put on a corner of the
//              building, and a dashed guide is drawn from that corner down to
//              the bar while the drag is held. Off a snap it steps by whatever
//              the type says (50 mm for a bar). Same undo step, same Escape.
//     Lookup   click the triangle for a menu: the scales, From viewport,
//              Split first division, Show units and Reset length.
// - THE GRIPS OWN THEIR OWN PRESS. They are elements in the handles layer
//   that take pointer events and stop them there. The stage hears presses in
//   the bubble phase, so the sheet tools never see one that landed on a grip
//   and not a line of the pointer pipeline had to change. They carry the
//   na-le-grip class, so whatever clears the grips clears these.
// - THE GRIP IS DESTROYED BY ITS OWN DRAG. Every step of a stretch redraws
//   the markup, which redraws the selection, which clears the handles layer
//   and draws new grips. So the drag listens on the window, holds the ids
//   and never the element, and the arrow under the pointer is simply always
//   the newest one.
// - Counter-scaled like every grip: the same size on screen at any zoom, and
//   a fixed number of screen pixels clear of the element.
//
// INTEGRATION:
// - Registered with Na__LayoutEditor__Grips__ as a group grip provider, which
//   calls Render after the group's own box is drawn, and only while the
//   sheet is editable and one item is selected.
// - Registered with Na__LayoutEditor__Groups__ as a labeller, which asks
//   LabelFor what to tag a selected group's box with.
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__.js
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__ViewportLink__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : 1.1.0 ported 20-Sep-2026 as ValeVision3D v2.68.0, verbatim
// - Ahead of it   : 1.2.0 (the slide grip) is TrueVision only.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.2.0
// - The slide grip, and with it the drag it shares with the stretch grip: one
//   drag state carrying which of the two is in hand, because everything about
//   holding, regenerating, letting go, cancelling and Escape is the same and
//   only the question put to the type differs. A slide asks the snapping
//   module first, hands the type the snapped point and whether it WAS snapped,
//   and draws the dashed guide from the vertex down to the element. It leaves
//   the element's OWN vectors out of that search: the grip sits on one of
//   them, and caught in its own radius the bar locks onto itself and will not
//   move. Found on the sheet, 20-Sep, the first time the arrow was dragged.
// - The lookup menu offers a scale bar's placement when the element has one.
//
// 19-Sep-2026 - Version 1.1.0
// - The lookup menu offers the sheet's own scale beside the viewport, and says
//   which of the two the element is tied to.
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation: the stretch grip, the lookup grip and its menu.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Model, Scale Labels, Surface, Grips, the Menu, the Panel Host, the Engine and the Link
    // ------------------------------------------------------------
    import { Na__LeModel__GetSheetById, Na__LeModel__GetGroupById } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeDrawScale__Label } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeSurface__ClientToPaperMm, Na__LeSurface__Refresh, Na__LeSurface__GetElements, Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeOsnap__TONE_VERTEX, Na__LeOsnap__Snap, Na__LeOsnap__HideMarker } from '../30__System__SheetTools/Na__LayoutEditor__Snapping__.js';
    import { Na__LeGroup__RegisterLabeller } from '../15__Core__Markup/Na__LayoutEditor__Groups__.js';
    import { Na__LeGrips__RegisterGroupProvider } from '../30__System__SheetTools/Na__LayoutEditor__Grips__.js';
    import { Na__LeMenu__Open, Na__LeMenu__Close } from '../30__System__SheetTools/Na__LayoutEditor__ContextMenu__.js';
    import { Na__LePanels__GetContext } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import {
        Na__LeParam__Block,
        Na__LeParam__Label,
        Na__LeParam__TypeName,
        Na__LeParam__GetType,
        Na__LeParam__GetBlockById,
        Na__LeParam__GetParams,
        Na__LeParam__AnchorOf,
        Na__LeParam__IsLocked,
        Na__LeParam__HandlesOf,
        Na__LeParam__Announce,
        Na__LeParam__Regenerate,
        Na__LeParam__ResetToStandard
    } from './Na__LayoutEditor__ScrapbookParametric__.js';
    import {
        Na__LeParamLink__KIND_VIEWPORT,
        Na__LeParamLink__KIND_SHEET,
        Na__LeParamLink__KIND_NONE,
        Na__LeParamLink__DescribeById,
        Na__LeParamLink__ViewportName,
        Na__LeParamLink__SetLink,
        Na__LeParamLink__SetSheetLink,
        Na__LeParamLink__LinkNearest
    } from './Na__LayoutEditor__ScrapbookParametric__ViewportLink__.js';
    import { Na__LeDrawScale__SheetDenominator } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import { Na__LeParamTitle__PLACE_BELOW, Na__LeParamTitle__PLACE_RIGHT } from './Na__LayoutEditor__ScrapbookParametric__DrawingTitle__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Classes and the Sizes Used When the Config Gives None
    // ------------------------------------------------------------
    const Na__LeParamGrips__CLASS_STRETCH = 'na-le-grip na-le-grip--param na-le-grip--param-stretch';
    const Na__LeParamGrips__CLASS_SLIDE   = 'na-le-grip na-le-grip--param na-le-grip--param-slide';
    const Na__LeParamGrips__CLASS_LOOKUP  = 'na-le-grip na-le-grip--param na-le-grip--param-lookup';
    const Na__LeParamGrips__CLASS_GUIDE   = 'na-le-grip na-le-param-guide';   // <-- na-le-grip so whatever clears the grips clears it
    const Na__LeParamGrips__CLASS_TAG     = 'na-le-group-label--param';
    const Na__LeParamGrips__BODY_CLASS    = 'na-le-param-stretching';
    const Na__LeParamGrips__MODE_STRETCH  = 'stretch';
    const Na__LeParamGrips__MODE_SLIDE    = 'slide';
    const Na__LeParamGrips__SWALLOWED     = Object.freeze([ 'pointerup', 'click', 'dblclick', 'contextmenu' ]);   // <-- Kept from the stage as well as the press
    const Na__LeParamGrips__FALLBACK      = Object.freeze({ StretchSizePx : 13, LookupSizePx : 13, SlideSizePx : 13, StretchOffsetPx : 12, LookupOffsetPx : 12, SlideOffsetPx : 12, SnapGuidePx : 1.25, ClickSlopPx : 4 });
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Drag in Hand, and the Guide It Draws
    // ------------------------------------------------------------
    let Na__LeParamGrips__Drag       = null;    // <-- { pointerId, sheetId, groupId, mode, start, steps, changed }
    let Na__LeParamGrips__Guide      = null;    // <-- The dashed line from a snapped vertex down to the element, kept and re-hung like the snap marker
    let Na__LeParamGrips__Registered = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Grip Setting, in Screen Pixels
    // ------------------------------------------------------------
    function Na__LeParamGrips__Px(key) {
        const value = Na__LeParam__Block('Grips')['Grips__' + key];
        return (typeof value === 'number' && Number.isFinite(value) && value >= 0) ? value : Na__LeParamGrips__FALLBACK[key];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say Something in the Editor's Toast
    // ------------------------------------------------------------
    function Na__LeParamGrips__Toast(message) {
        const context = Na__LePanels__GetContext();
        if (context && typeof context.showToast === 'function') context.showToast(message, false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Grip Element, Centred on a Point of the Unzoomed Paper
    // ------------------------------------------------------------
    // Presses other than the left button pass through, so a right drag still
    // pans the sheet from over a grip.
    // ------------------------------------------------------------
    function Na__LeParamGrips__Add(layer, className, xPx, yPx, sizePx, title, onPress) {
        const grip = document.createElement('div');
        grip.className    = className;
        grip.title        = title;
        grip.style.left   = (xPx - (sizePx / 2)) + 'px';
        grip.style.top    = (yPx - (sizePx / 2)) + 'px';
        grip.style.width  = sizePx + 'px';
        grip.style.height = sizePx + 'px';
        grip.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();                                          // <-- The grip's press, not the sheet tools'
            onPress(event);
        });
        Na__LeParamGrips__SWALLOWED.forEach((name) => grip.addEventListener(name, (event) => { if (event.button === 0 || name === 'dblclick') event.stopPropagation(); }));
        layer.appendChild(grip);
        return grip;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Stretch and Slide Grips
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Redraw the Paper After a Silent Rebuild
    // ------------------------------------------------------------
    // The markup, and with it the selection: the group's box and these grips
    // move to the element's new end.
    // ------------------------------------------------------------
    function Na__LeParamGrips__Repaint() {
        Na__LeSurface__Refresh('markup');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Dashed Guide From a Snapped Vertex Down to the Element
    // ------------------------------------------------------------
    // A slide is a horizontal move, so a vertex a metre above the bar decides
    // its x and nothing else; without a line drawn between them there is no
    // saying WHICH corner the end has been put under. hit is the snapping
    // module's, toMm the element's own y. Kept and re-hung rather than rebuilt
    // because the rebuild behind every step clears the handles layer under it.
    // ------------------------------------------------------------
    function Na__LeParamGrips__ShowGuide(hit, toMm) {
        const layer = Na__LeSurface__GetElements().handles;
        if (!layer || !hit || !Number.isFinite(toMm)) { Na__LeParamGrips__HideGuide(); return; }
        if (!Na__LeParamGrips__Guide) Na__LeParamGrips__Guide = document.createElement('div');
        const guide = Na__LeParamGrips__Guide;
        guide.className = Na__LeParamGrips__CLASS_GUIDE;
        if (guide.parentNode !== layer) layer.appendChild(guide);
        const ppm  = Na__LeSurface__GetPixelsPerMm();
        const zoom = Na__LeSurface__GetZoom() > 0 ? Na__LeSurface__GetZoom() : 1;
        const wide = Na__LeParamGrips__Px('SnapGuidePx') / zoom;
        guide.style.left            = ((hit.x * ppm) - (wide / 2)) + 'px';
        guide.style.top             = (Math.min(hit.y, toMm) * ppm) + 'px';
        guide.style.height          = (Math.abs(toMm - hit.y) * ppm) + 'px';
        guide.style.borderLeftWidth = wide + 'px';
        guide.hidden                = false;
    }
    function Na__LeParamGrips__HideGuide() {
        if (Na__LeParamGrips__Guide) Na__LeParamGrips__Guide.hidden = true;
    }
    // ------------------------------------------------------------


    // FUNCTION | End the Stretch
    // ------------------------------------------------------------
    // keep true announces what the drag did, once: one undo step. keep false
    // puts the element back as it was when the arrow was taken, silently -
    // the rebuild is in place, so the sheet is exactly what it was and the
    // history sees no change at all.
    // ------------------------------------------------------------
    function Na__LeParamGrips__EndStretch(keep) {
        const drag = Na__LeParamGrips__Drag;
        Na__LeParamGrips__Drag = null;
        window.removeEventListener('pointermove',   Na__LeParamGrips__OnStretchMove, true);
        window.removeEventListener('pointerup',     Na__LeParamGrips__OnStretchUp, true);
        window.removeEventListener('pointercancel', Na__LeParamGrips__OnStretchCancel, true);
        window.removeEventListener('keydown',       Na__LeParamGrips__OnStretchKey, true);
        document.body.classList.remove(Na__LeParamGrips__BODY_CLASS);
        Na__LeParamGrips__HideGuide();
        Na__LeOsnap__HideMarker();                                            // <-- A slide leaves the snapping module's marker up; nothing else takes it down
        if (!drag || !drag.changed) return;
        const sheet = Na__LeModel__GetSheetById(drag.sheetId);
        if (!sheet) return;
        if (keep) { Na__LeParam__Announce(sheet, drag.groupId); return; }
        Na__LeParam__Regenerate(sheet, drag.groupId, drag.start, { silent : true });
        Na__LeParamGrips__Repaint();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Element's Own Vectors, as Snap Exclusions
    // ------------------------------------------------------------
    // A SLIDE MUST NEVER SNAP TO THE THING BEING SLID. The grip sits on the
    // bar's own far corner, so without this the very first nudge finds that
    // corner inside the snap radius, locks onto it and the bar will not move
    // at all - the haunted grip every CAD program has had once. The snapping
    // module already takes the exclusions a selection move passes; these are
    // simply the element's own. Taken once, when the arrow is picked up: a
    // slide changes no record's identity, only where its points are.
    // ------------------------------------------------------------
    function Na__LeParamGrips__OwnVectors(sheet, groupId) {
        const group   = sheet ? Na__LeModel__GetGroupById(sheet, groupId) : null;
        const members = (group && Array.isArray(group.Group__Members)) ? group.Group__Members : [];
        return members.filter((member) => member.kind === 'shape').map((member) => ({ kind : 'shape', id : member.id }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take Hold of an Arrow
    // ------------------------------------------------------------
    // mode says which of the two was taken. Everything from here on - the
    // window listeners, the live rebuild, the one undo step, Escape - is the
    // same for both, so only the question put to the type is ever branched on.
    // ------------------------------------------------------------
    function Na__LeParamGrips__OnStretchDown(event, sheet, groupId, mode) {
        if (Na__LeParamGrips__Drag) return;
        const start = Na__LeParam__GetParams(sheet, groupId);
        if (!start) return;
        Na__LeMenu__Close();
        Na__LeParamGrips__Drag = { pointerId : event.pointerId, sheetId : sheet.Sheet__Id, groupId : groupId, mode : mode || Na__LeParamGrips__MODE_STRETCH, start : start, steps : JSON.stringify(start), changed : false,
                                   exclude : Na__LeParamGrips__OwnVectors(sheet, groupId) };
        document.body.classList.add(Na__LeParamGrips__BODY_CLASS);
        window.addEventListener('pointermove',   Na__LeParamGrips__OnStretchMove, true);
        window.addEventListener('pointerup',     Na__LeParamGrips__OnStretchUp, true);
        window.addEventListener('pointercancel', Na__LeParamGrips__OnStretchCancel, true);
        window.addEventListener('keydown',       Na__LeParamGrips__OnStretchKey, true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a Slide's Pointer Point Really Is: the Nearest Vertex, or Itself
    // ------------------------------------------------------------
    // The snapping module's own search, in the vertex tone, so a slide looks
    // for a corner exactly where the Draw tool would and marks it the same
    // blue - the projected linework of the drawing above first, the sheet's
    // own vectors after it, and the element's own left out (see OwnVectors).
    // It draws its own marker; the dashed guide down to the element is this
    // module's, and is drawn against the grip's own y - the element has not
    // moved yet, and half a division's error there would be invisible.
    // ------------------------------------------------------------
    function Na__LeParamGrips__SnapSlide(sheet, groupId, point, exclude) {
        const hit = Na__LeOsnap__Snap(sheet, point, exclude || null, Na__LeOsnap__TONE_VERTEX);
        if (!hit || !hit.snapped) { Na__LeParamGrips__HideGuide(); return { x : point.x, exact : false }; }
        const handles = Na__LeParam__HandlesOf(sheet, groupId);
        Na__LeParamGrips__ShowGuide(hit, (handles && handles.slide) ? handles.slide.y : point.y);
        return { x : hit.x, exact : true };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move: Rebuild Only When the Pointer Crosses Into Another Step
    // ------------------------------------------------------------
    // The pointer is read against the element's origin, which neither a
    // stretch nor a slide ever moves. The offset the arrow stands off the end
    // is ignored on purpose: the element's end follows the pointer, and the
    // arrow rides just ahead.
    // ------------------------------------------------------------
    function Na__LeParamGrips__OnStretchMove(event) {
        const drag = Na__LeParamGrips__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const sheet  = Na__LeModel__GetSheetById(drag.sheetId);
        const block  = sheet ? Na__LeParam__GetBlockById(sheet, drag.groupId) : null;
        const anchor = block ? Na__LeParam__AnchorOf(sheet, drag.groupId) : null;
        const point  = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        const type   = block ? Na__LeParam__GetType(block.Parametric__Type) : null;
        const sliding = drag.mode === Na__LeParamGrips__MODE_SLIDE;
        if (!anchor || !point || !type) return;
        if (sliding ? typeof type.slideTo !== 'function' : typeof type.stretchTo !== 'function') return;
        const params = Na__LeParam__GetParams(sheet, drag.groupId);
        const next   = sliding
            ? (() => { const at = Na__LeParamGrips__SnapSlide(sheet, drag.groupId, point, drag.exclude); return type.slideTo(params, at.x - anchor.x, at.exact); })()
            : type.stretchTo(params, point.x - anchor.x, point.y - anchor.y);
        const key  = JSON.stringify(next);
        if (key === drag.steps) return;
        drag.steps   = key;
        drag.changed = key !== JSON.stringify(drag.start);
        if (Na__LeParam__Regenerate(sheet, drag.groupId, next, { silent : true })) Na__LeParamGrips__Repaint();
    }
    function Na__LeParamGrips__OnStretchUp(event) {
        if (!Na__LeParamGrips__Drag || event.pointerId !== Na__LeParamGrips__Drag.pointerId) return;
        event.stopPropagation();
        Na__LeParamGrips__EndStretch(true);
    }
    function Na__LeParamGrips__OnStretchCancel(event) {
        if (Na__LeParamGrips__Drag && event.pointerId === Na__LeParamGrips__Drag.pointerId) Na__LeParamGrips__EndStretch(false);
    }
    function Na__LeParamGrips__OnStretchKey(event) {
        if (!Na__LeParamGrips__Drag || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();                                             // <-- The stretch's Escape, not the sheet tools'
        Na__LeParamGrips__EndStretch(false);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Lookup Grip
// -----------------------------------------------------------------------------

    // FUNCTION | The Menu a Parametric Element Offers
    // ------------------------------------------------------------
    // Built from the parameters the element has, so a type without a scale or
    // without a split simply has a shorter menu. Picking a scale by hand lets
    // go of the viewport: the element cannot both follow a drawing and be
    // told what scale to be. Every entry is one undo step.
    // ------------------------------------------------------------
    function Na__LeParamGrips__MenuItems(sheet, groupId) {
        const params = Na__LeParam__GetParams(sheet, groupId);
        if (!params) return [];
        const items  = [];
        const tied   = Na__LeParamLink__DescribeById(sheet, groupId);
        const linked = tied.kind === Na__LeParamLink__KIND_VIEWPORT ? tied.viewport : null;

        if (params.ScaleDenominator !== undefined) {
            if (linked) {
                items.push({ label : Na__LeParam__Label('MenuFromViewport', 'From viewport ({scale})', { scale : Na__LeParamLink__ViewportName(linked) }), checked : true,
                             onSelect : () => { Na__LeParamLink__SetLink(sheet, groupId, null); } });   // <-- Ticked: picking it again lets go
            } else {
                items.push({ label : Na__LeParam__Label('MenuFromNearest', 'Link to nearest viewport'), onSelect : () => {
                    const viewport = Na__LeParamLink__LinkNearest(sheet, groupId);
                    Na__LeParamGrips__Toast(viewport
                        ? Na__LeParam__Label('ToastLinked', 'Linked to {viewport} at {scale}.', { viewport : Na__LeParamLink__ViewportName(viewport), scale : Na__LeDrawScale__Label(viewport.Viewport__ScaleDenominator) })
                        : Na__LeParam__Label('ToastNoViewport', 'No 2D viewport is near enough to link to.'));
                } });
            }
            items.push({ label : Na__LeParam__Label('MenuFromSheet', 'From the sheet\'s scale ({scale})', { scale : Na__LeDrawScale__Label(Na__LeDrawScale__SheetDenominator(sheet)) }),
                         checked : tied.kind === Na__LeParamLink__KIND_SHEET,
                         onSelect : () => { if (tied.kind === Na__LeParamLink__KIND_SHEET) Na__LeParamLink__SetLink(sheet, groupId, null); else Na__LeParamLink__SetSheetLink(sheet, groupId); } });   // <-- Ticked: picking it again lets go
            items.push({ separator : true });
            const scales = Na__LeParam__Block('ScaleBar').ScaleBar__MenuScaleDenominators;
            (Array.isArray(scales) ? scales : []).filter((d) => typeof d === 'number' && d > 0).forEach((denominator) => {
                items.push({ label : Na__LeDrawScale__Label(denominator), checked : tied.kind === Na__LeParamLink__KIND_NONE && params.ScaleDenominator === denominator,
                             onSelect : () => { Na__LeParam__ResetToStandard(sheet, groupId, denominator, { link : null }); } });
            });
            items.push({ separator : true });
        }
        if (params.SubdivideFirst !== undefined) items.push({ label : Na__LeParam__Label('MenuSubdivide', 'Split first division'), checked : params.SubdivideFirst === true,
                                                              onSelect : () => { Na__LeParam__Regenerate(sheet, groupId, { SubdivideFirst : !params.SubdivideFirst }); } });
        if (params.ShowUnits !== undefined)      items.push({ label : Na__LeParam__Label('MenuUnits', 'Show units'), checked : params.ShowUnits === true,
                                                              onSelect : () => { Na__LeParam__Regenerate(sheet, groupId, { ShowUnits : !params.ShowUnits }); } });
        if (params.BarPlacement !== undefined && params.ShowScaleBar === true) {
            const right = params.BarPlacement === Na__LeParamTitle__PLACE_RIGHT;
            items.push({ label : Na__LeParam__Label('MenuBarRight', 'Scale bar to the right'), checked : right,
                         onSelect : () => { Na__LeParam__Regenerate(sheet, groupId, { BarPlacement : right ? Na__LeParamTitle__PLACE_BELOW : Na__LeParamTitle__PLACE_RIGHT }); } });
        }
        if (params.ScaleDenominator !== undefined) {
            items.push({ separator : true });
            items.push({ label : Na__LeParam__Label('MenuReset', 'Reset length'), onSelect : () => { Na__LeParam__ResetToStandard(sheet, groupId, params.ScaleDenominator); } });
        }
        return items;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Press on the Triangle: a Click Opens the Menu
    // ------------------------------------------------------------
    // Counted from the press to the release on the window, since the triangle
    // itself may be redrawn in between. A press that wanders further than
    // ClickSlopPx was not a click.
    // ------------------------------------------------------------
    function Na__LeParamGrips__OnLookupDown(event, sheet, groupId) {
        const pointerId = event.pointerId;
        const startX    = event.clientX;
        const startY    = event.clientY;
        const sheetId   = sheet.Sheet__Id;
        const done = (up) => {
            if (up.pointerId !== pointerId) return;
            window.removeEventListener('pointerup', done, true);
            window.removeEventListener('pointercancel', done, true);
            if (up.type !== 'pointerup' || Math.hypot(up.clientX - startX, up.clientY - startY) > Na__LeParamGrips__Px('ClickSlopPx')) return;
            up.stopPropagation();
            const live = Na__LeModel__GetSheetById(sheetId);
            if (live) Na__LeMenu__Open(up.clientX, up.clientY, Na__LeParamGrips__MenuItems(live, groupId));
        };
        window.addEventListener('pointerup', done, true);
        window.addEventListener('pointercancel', done, true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // FUNCTION | What a Parametric Element's Box Is Tagged With
    // ------------------------------------------------------------
    // The groups module's labeller. A selected group's box is tagged "Group"
    // inside its top left corner; an element's reads the element's name
    // instead, ABOVE the box - a scale bar is 2 mm tall, and a tag inside its
    // corner covers the first cell and the zero. Answered to the groups module
    // rather than written onto its tag afterwards, because the box has two
    // painters - the grips, and the sheet tools' own redraw a frame later -
    // and the second put back what was re-worded after the first. Null for a
    // plain group.
    // ------------------------------------------------------------
    function Na__LeParamGrips__LabelFor(sheet, groupId) {
        const block = Na__LeParam__GetBlockById(sheet, groupId);
        return block ? { text : Na__LeParam__TypeName(block.Parametric__Type), className : Na__LeParamGrips__CLASS_TAG } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw a Selected Parametric Element's Grips
    // ------------------------------------------------------------
    // The group grip provider. Nothing for a plain group, and nothing for an
    // element on a locked layer: it can be selected, but not changed.
    // ------------------------------------------------------------
    function Na__LeParamGrips__Render(layer, sheet, selection, ppm, zoom) {
        if (!layer || !sheet || !selection || selection.kind !== 'group') return false;
        const handles = Na__LeParam__HandlesOf(sheet, selection.id);
        if (!handles || Na__LeParam__IsLocked(sheet, selection.id)) return false;
        const scale   = zoom > 0 ? zoom : 1;
        const groupId = selection.id;
        const clear   = (point, offsetPx) => ({ x : (point.x * ppm) + (point.away[0] * offsetPx / scale), y : (point.y * ppm) + (point.away[1] * offsetPx / scale) });   // <-- A point of the unzoomed paper, stood off the way the type says
        if (handles.stretch) {
            const at   = clear(handles.stretch, Na__LeParamGrips__Px('StretchOffsetPx'));
            const back = handles.stretch.away[0] < 0 && !!handles.slide;      // <-- An arrow pointing back at the title: the reversed stretch of a bar stood to the right
            Na__LeParamGrips__Add(layer, Na__LeParamGrips__CLASS_STRETCH + (back ? ' is-reversed' : ''), at.x, at.y,
                Na__LeParamGrips__Px('StretchSizePx') / scale,
                back ? Na__LeParam__Label('GripStretchBack', 'Drag towards the title to lengthen; the far end stays put') : Na__LeParam__Label('GripStretch', 'Drag to lengthen or shorten'),
                (event) => Na__LeParamGrips__OnStretchDown(event, sheet, groupId, Na__LeParamGrips__MODE_STRETCH));
        }
        if (handles.slide) {
            const at = clear(handles.slide, Na__LeParamGrips__Px('SlideOffsetPx'));
            Na__LeParamGrips__Add(layer, Na__LeParamGrips__CLASS_SLIDE, at.x, at.y,
                Na__LeParamGrips__Px('SlideSizePx') / scale, Na__LeParam__Label('GripSlide', 'Drag to carry the bar along - it snaps to the corners of the drawing above'),
                (event) => Na__LeParamGrips__OnStretchDown(event, sheet, groupId, Na__LeParamGrips__MODE_SLIDE));
        }
        if (handles.lookup) {
            const at = clear(handles.lookup, Na__LeParamGrips__Px('LookupOffsetPx'));
            Na__LeParamGrips__Add(layer, Na__LeParamGrips__CLASS_LOOKUP, at.x, at.y,
                Na__LeParamGrips__Px('LookupSizePx') / scale, Na__LeParam__Label('GripLookup', 'Scale and options'),
                (event) => Na__LeParamGrips__OnLookupDown(event, sheet, groupId));
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Register With the Grips Module (once)
    // ------------------------------------------------------------
    function Na__LeParamGrips__Attach() {
        if (Na__LeParamGrips__Registered) return false;
        Na__LeParamGrips__Registered = Na__LeGrips__RegisterGroupProvider(Na__LeParamGrips__Render);
        Na__LeGroup__RegisterLabeller(Na__LeParamGrips__LabelFor);
        return Na__LeParamGrips__Registered;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Parametric Scrapbook Grips API
    // ------------------------------------------------------------
    export {
        Na__LeParamGrips__Attach,
        Na__LeParamGrips__Render,
        Na__LeParamGrips__LabelFor,
        Na__LeParamGrips__MenuItems
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
