// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - PARAMETRIC SCRAPBOOK - LINK NOODLE
// =============================================================================
//
// FILE       : Na__LayoutEditor__ScrapbookParametric__LinkNoodle__.js
// NAMESPACE  : Na__LeParamNoodle
// MODULE     : Layout Editor - Parametric Scrapbook - Link Noodle
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Show what a selected parametric element is tied to - a noodle from the element to its drawing - and let the noodle be dragged onto another
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - SELECT A PARAMETRIC ELEMENT AND ITS TIE IS DRAWN. A noodle runs from a
//   round socket on the element to what it reads its scale from, the way a
//   node editor wires one node to another, and that thing is outlined: the
//   viewport's frame, or the title block's Scale cell for an element tied to
//   the sheet's own scale. An element tied to nothing shows a hollow socket
//   and no noodle, so "is this bar following anything?" is answered by
//   looking at it. Adam asked for exactly this: "so you can see what it is
//   tied to".
// - DRAG EITHER END TO RE-TIE IT. The round SOCKET on the element, to draw a
//   new noodle out of it; or the PLUG where the noodle lands, to pull the one
//   that is there off its drawing and carry it to another, as a cable is moved
//   from one socket to the next. Some people see the element and reach for
//   that; others see the noodle already tied to something and reach for its
//   end. Both are the same drag from the moment they start. The noodle
//   follows the pointer, and whatever it is over that it could be tied to
//   lights up. Let go
//       on a 2D viewport      tied to that drawing, at its scale
//       on the title block    tied to the sheet's own scale
//       on bare paper         untied: it keeps the scale it has
//   Escape puts it back. Each is one undo step, and a toast says what
//   happened, since an untie is otherwise invisible.
// - THE NOODLE IS SVG IN THE HANDLES LAYER, drawn in paper millimetres on a
//   viewBox the size of the page, with every width divided by the zoom so it
//   is the same weight on screen at any zoom, like the grips. It carries the
//   na-le-grip class, so whatever clears the grips clears it. It takes no
//   pointer events; the socket and the plug, which are grips laid over its
//   two ends, do.
// - THE SCALE CELL IS FOUND, NOT WORKED OUT. The title block modules lay their
//   cells out privately, and repeating their arithmetic here would drift from
//   it. The chrome SVG already holds the Scale label as text at its cell's
//   left padding, so the cell is read off that. A title block that has no
//   such label - or has cut it short - gets the whole band instead.
//
// INTEGRATION:
// - Registered with Na__LayoutEditor__Grips__ as a group grip provider, beside
//   Na__LayoutEditor__ScrapbookParametric__Grips__; attached by the panel.
// - Everything about what a link IS belongs to
//   Na__LayoutEditor__ScrapbookParametric__ViewportLink__. This module draws
//   what that one describes and asks it to change it.
// // @delegate: ./Na__LayoutEditor__ScrapbookParametric__ViewportLink__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (19-Sep-2026)
// - ValeVision    : 1.2.0 ported 20-Sep-2026 as ValeVision3D v2.68.0, verbatim
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.2.0
// - THE PLUG. The noodle's far end is a handle as well as its near one. Adam:
//   "for a lot of users it's going to be more logical to grab the end point and
//   move that to whatever they want to tag... like dragging a rope or a cable".
//   Both ends start the one drag, so there is one behaviour, not two.
// - The plug is hidden while either end is dragged. The live noodle took the
//   finished tie away but left the plug's dot sitting at the far end of a
//   noodle that was no longer there - found while testing the ValeVision port.
//   Hidden rather than removed: it may be the element the press began on.
//
// 20-Sep-2026 - Version 1.1.0
// - Untying an element that has no scale bar - a Drawing Title on its own -
//   says it keeps what it says, not that it keeps a scale.
//
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation: the noodle, the outlined target, the socket and
//   the drag that re-ties.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Drawing Scale, Surface, Grips, the Panel Host, the Engine and the Link
    // ------------------------------------------------------------
    import { Na__LeCfg__GetTitleBlockSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__GetSheetById } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeDrawScale__ViewportAt, Na__LeDrawScale__Label } from '../07__Core__SheetData/Na__LayoutEditor__DrawingScale__.js';
    import {
        Na__LeSurface__ClientToPaperMm,
        Na__LeSurface__GetElements,
        Na__LeSurface__GetLayout,
        Na__LeSurface__GetPixelsPerMm,
        Na__LeSurface__GetZoom,
        Na__LeSurface__Refresh
    } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeGrips__RegisterGroupProvider } from '../30__System__SheetTools/Na__LayoutEditor__Grips__.js';
    import { Na__LeMenu__Close } from '../30__System__SheetTools/Na__LayoutEditor__ContextMenu__.js';
    import { Na__LePanels__GetContext } from '../40__Ui__Panels/Na__LayoutEditor__PanelHost__.js';
    import {
        Na__LeParam__Block,
        Na__LeParam__Label,
        Na__LeParam__GetType,
        Na__LeParam__GetBlockById,
        Na__LeParam__GetParams,
        Na__LeParam__IsLocked,
        Na__LeParam__HandlesOf
    } from './Na__LayoutEditor__ScrapbookParametric__.js';
    import {
        Na__LeParamLink__KIND_VIEWPORT,
        Na__LeParamLink__KIND_SHEET,
        Na__LeParamLink__KIND_NONE,
        Na__LeParamLink__DescribeById,
        Na__LeParamLink__SetLink,
        Na__LeParamLink__SetSheetLink
    } from './Na__LayoutEditor__ScrapbookParametric__ViewportLink__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Classes, the Scale Field and the Sizes Used When the Config Gives None
    // ------------------------------------------------------------
    const Na__LeParamNoodle__SVG_NS       = 'http://www.w3.org/2000/svg';
    const Na__LeParamNoodle__CLASS        = 'na-le-grip na-le-param-noodle';                       // <-- na-le-grip: cleared with the grips
    const Na__LeParamNoodle__CLASS_LIVE   = 'na-le-grip na-le-param-noodle na-le-param-noodle--live';
    const Na__LeParamNoodle__CLASS_SOCKET = 'na-le-grip na-le-grip--param na-le-grip--param-link';
    const Na__LeParamNoodle__CLASS_PLUG   = 'na-le-grip na-le-grip--param na-le-grip--param-plug';   // <-- The noodle's far end, where it lands on what it is tied to
    const Na__LeParamNoodle__BODY_CLASS   = 'na-le-param-linking';
    const Na__LeParamNoodle__SCALE_KEY    = 'Scale';                                               // <-- The title block row an element tied to the sheet points at
    const Na__LeParamNoodle__SWALLOWED    = Object.freeze([ 'pointerup', 'click', 'dblclick' ]);
    const Na__LeParamNoodle__FALLBACK     = Object.freeze({
        LinkSizePx : 11, LinkOffsetPx : 16, PlugSizePx : 13, ClickSlopPx : 4,
        LinePx : 2, CasingPx : 4.5, TargetDotPx : 4.5, HighlightPx : 1.5, MinReachMm : 10, MaxReachMm : 70, ScaleCellInsetMm : 8,
        Colour : '#12a5dc', Casing : '#ffffff'
    });
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Drag in Hand
    // ------------------------------------------------------------
    let Na__LeParamNoodle__Drag       = null;   // <-- { pointerId, sheetId, groupId, startX, startY, moved, over }
    let Na__LeParamNoodle__Registered = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Settings and Small Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Setting: the Grips Block for the Socket, the Noodle Block for the Rest
    // ------------------------------------------------------------
    function Na__LeParamNoodle__Setting(key) {
        const grips  = Na__LeParam__Block('Grips')['Grips__' + key];
        const noodle = Na__LeParam__Block('Noodle')['Noodle__' + key];
        const value  = (noodle !== undefined) ? noodle : grips;
        const spare  = Na__LeParamNoodle__FALLBACK[key];
        if (typeof spare === 'string') return (typeof value === 'string' && value !== '') ? value : spare;
        return (typeof value === 'number' && Number.isFinite(value) && value >= 0) ? value : spare;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Say Something in the Editor's Toast
    // ------------------------------------------------------------
    function Na__LeParamNoodle__Toast(message) {
        const context = Na__LePanels__GetContext();
        if (context && typeof context.showToast === 'function') context.showToast(message, false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An SVG Element With Its Attributes
    // ------------------------------------------------------------
    function Na__LeParamNoodle__El(name, attributes, parent) {
        const el = document.createElementNS(Na__LeParamNoodle__SVG_NS, name);
        Object.keys(attributes || {}).forEach((key) => el.setAttribute(key, String(attributes[key])));
        if (parent) parent.appendChild(el);
        return el;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Screen Pixels as Paper Millimetres at the Present Zoom
    // ------------------------------------------------------------
    // The handles layer sits inside the paper's scale(zoom), so a length meant
    // to be constant on screen is divided by both.
    // ------------------------------------------------------------
    function Na__LeParamNoodle__PxToMm(px) {
        const scale = Na__LeSurface__GetPixelsPerMm() * (Na__LeSurface__GetZoom() || 1);
        return px / Math.max(1e-6, scale);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Geometry
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Where the Socket Stands, in Paper Millimetres
    // ------------------------------------------------------------
    // The point the element's type gives, stood off the way it says by the
    // socket's offset on screen.
    // ------------------------------------------------------------
    function Na__LeParamNoodle__SocketOf(handles) {
        const point = handles ? handles.link : null;
        if (!point) return null;
        const clear = Na__LeParamNoodle__PxToMm(Na__LeParamNoodle__Setting('LinkOffsetPx'));
        return { x : point.x + (point.away[0] * clear), y : point.y + (point.away[1] * clear), away : point.away };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Noodle Lands on a Box, and the Way It Comes In
    // ------------------------------------------------------------
    // The point of the box's edge nearest where the noodle leaves from, and
    // that edge's outward normal, so the noodle arrives square to the edge from
    // outside it. An element standing INSIDE the box lands on the edge nearest
    // to it, from within.
    // ------------------------------------------------------------
    function Na__LeParamNoodle__LandOn(box, from) {
        const left = box.X, top = box.Y, right = box.X + box.WidthMm, bottom = box.Y + box.HeightMm;
        const x = Math.min(right, Math.max(left, from.x));
        const y = Math.min(bottom, Math.max(top, from.y));
        if (from.y > bottom) return { x : x, y : bottom, normal : [ 0,  1 ] };
        if (from.y < top)    return { x : x, y : top,    normal : [ 0, -1 ] };
        if (from.x < left)   return { x : left,  y : y,  normal : [ -1, 0 ] };
        if (from.x > right)  return { x : right, y : y,  normal : [  1, 0 ] };
        const gaps = [ [ bottom - from.y, { x : from.x, y : bottom, normal : [ 0, -1 ] } ], [ from.y - top, { x : from.x, y : top, normal : [ 0, 1 ] } ],
                       [ from.x - left, { x : left, y : from.y, normal : [ 1, 0 ] } ], [ right - from.x, { x : right, y : from.y, normal : [ -1, 0 ] } ] ];
        return gaps.sort((a, b) => a[0] - b[0])[0][1];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Noodle's Path: Out the Way the Socket Faces, In Square to Where It Lands
    // ------------------------------------------------------------
    // One cubic curve. How far each end reaches before it turns grows with the
    // distance between them, inside limits, so a short tie is a gentle hook
    // and a long one a proper noodle.
    // ------------------------------------------------------------
    function Na__LeParamNoodle__PathD(socket, land) {
        const span  = Math.hypot(land.x - socket.x, land.y - socket.y);
        const reach = Math.min(Na__LeParamNoodle__Setting('MaxReachMm'), Math.max(Na__LeParamNoodle__Setting('MinReachMm'), span * 0.5));
        const r     = (value) => Math.round(value * 1000) / 1000;
        const c1    = { x : socket.x + (socket.away[0] * reach), y : socket.y + (socket.away[1] * reach) };
        const c2    = { x : land.x + (land.normal[0] * reach),   y : land.y + (land.normal[1] * reach) };
        return 'M' + r(socket.x) + ' ' + r(socket.y) + ' C' + r(c1.x) + ' ' + r(c1.y) + ' ' + r(c2.x) + ' ' + r(c2.y) + ' ' + r(land.x) + ' ' + r(land.y);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Title Block's Scale Cell, Read Off the Chrome
    // ------------------------------------------------------------
    // { box, point }: the cell to outline and where on its top edge a noodle
    // lands. The Scale row's label is a text element at the cell's left
    // padding; the next label along the same baseline is where the cell ends.
    // Without a label to find, the whole band, landing three quarters along.
    // Null when the sheet has no title block.
    // ------------------------------------------------------------
    function Na__LeParamNoodle__ScaleCell() {
        const layout = Na__LeSurface__GetLayout();
        const band   = layout ? layout.TitleBlock : null;
        if (!band || !(band.WidthMm > 0)) return null;
        const whole  = { box : band, point : { x : band.X + (band.WidthMm * 0.75), y : band.Y } };
        const paper  = Na__LeSurface__GetElements().paper;
        const chrome = paper ? paper.querySelector('.na-le-paper__chrome') : null;
        const setup  = Na__LeCfg__GetTitleBlockSetup();
        const row    = (setup && Array.isArray(setup.rows)) ? setup.rows.find((entry) => entry && entry.Key === Na__LeParamNoodle__SCALE_KEY) : null;
        if (!chrome || !row) return whole;
        const wanted = String(row.Label || row.Key).trim().toLowerCase();
        const inBand = Array.from(chrome.querySelectorAll('text')).map((el) => ({ x : parseFloat(el.getAttribute('x')), y : parseFloat(el.getAttribute('y')), text : (el.textContent || '').trim().toLowerCase() }))
            .filter((t) => Number.isFinite(t.x) && Number.isFinite(t.y) && t.y >= band.Y && t.y <= band.Y + band.HeightMm);
        const label  = inBand.find((t) => t.text === wanted);
        if (!label) return whole;
        const pad    = (setup && Number.isFinite(setup.fieldPaddingHMm)) ? setup.fieldPaddingHMm : 0;
        const next   = inBand.filter((t) => Math.abs(t.y - label.y) < 0.05 && t.x > label.x + 0.5).sort((a, b) => a.x - b.x)[0];
        const left   = label.x - pad;
        const right  = next ? next.x - pad : band.X + band.WidthMm;
        const box    = { X : left, Y : band.Y, WidthMm : Math.max(1, right - left), HeightMm : band.HeightMm };
        return { box : box, point : { x : left + Math.min(box.WidthMm / 2, Na__LeParamNoodle__Setting('ScaleCellInsetMm')), y : band.Y } };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What Lies Under a Paper Point That an Element Could Be Tied To
    // ------------------------------------------------------------
    // { kind, viewport, box }: a 2D viewport, else the title block, else none.
    // ------------------------------------------------------------
    function Na__LeParamNoodle__TargetAt(sheet, pointMm) {
        const none = { kind : Na__LeParamLink__KIND_NONE, viewport : null, box : null };
        if (!sheet || !pointMm) return none;
        const viewport = Na__LeDrawScale__ViewportAt(sheet, pointMm);
        if (viewport) return { kind : Na__LeParamLink__KIND_VIEWPORT, viewport : viewport, box : viewport.Viewport__FrameMm };
        const layout = Na__LeSurface__GetLayout();
        const band   = layout ? layout.TitleBlock : null;
        if (band && pointMm.x >= band.X && pointMm.x <= band.X + band.WidthMm && pointMm.y >= band.Y && pointMm.y <= band.Y + band.HeightMm) {
            const cell = Na__LeParamNoodle__ScaleCell();
            return { kind : Na__LeParamLink__KIND_SHEET, viewport : null, box : cell ? cell.box : band };
        }
        return none;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | An Empty Overlay the Size of the Page, Drawn in Millimetres
    // ------------------------------------------------------------
    function Na__LeParamNoodle__Overlay(layer, className) {
        const layout = Na__LeSurface__GetLayout();
        const page   = layout ? layout.Page : null;
        if (!layer || !page) return null;
        const ppm = Na__LeSurface__GetPixelsPerMm();
        const svg = Na__LeParamNoodle__El('svg', { 'class' : className, viewBox : '0 0 ' + page.WidthMm + ' ' + page.HeightMm, 'aria-hidden' : 'true' });
        svg.style.left   = '0px';
        svg.style.top    = '0px';
        svg.style.width  = (page.WidthMm  * ppm) + 'px';
        svg.style.height = (page.HeightMm * ppm) + 'px';
        layer.appendChild(svg);
        return svg;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Outline a Box, Draw a Noodle to a Landing Point and Cap It
    // ------------------------------------------------------------
    // The noodle is drawn twice - a white casing under the line - so it reads
    // over black linework and over white paper alike. live dashes it.
    // ------------------------------------------------------------
    function Na__LeParamNoodle__Draw(svg, socket, land, box, live) {
        const colour = Na__LeParamNoodle__Setting('Colour');
        const mm     = (key) => Na__LeParamNoodle__PxToMm(Na__LeParamNoodle__Setting(key));
        if (box) {
            Na__LeParamNoodle__El('rect', { x : box.X, y : box.Y, width : box.WidthMm, height : box.HeightMm, fill : colour, 'fill-opacity' : live ? 0.10 : 0.04,
                                            stroke : colour, 'stroke-width' : mm('HighlightPx'), 'stroke-dasharray' : (mm('HighlightPx') * 4) + ' ' + (mm('HighlightPx') * 3) }, svg);
        }
        if (!socket || !land) return;
        const d = Na__LeParamNoodle__PathD(socket, land);
        Na__LeParamNoodle__El('path', { d : d, fill : 'none', stroke : Na__LeParamNoodle__Setting('Casing'), 'stroke-width' : mm('CasingPx'), 'stroke-linecap' : 'round' }, svg);
        const line = Na__LeParamNoodle__El('path', { d : d, fill : 'none', stroke : colour, 'stroke-width' : mm('LinePx'), 'stroke-linecap' : 'round' }, svg);
        if (live) line.setAttribute('stroke-dasharray', (mm('LinePx') * 3) + ' ' + (mm('LinePx') * 3));
        Na__LeParamNoodle__El('circle', { cx : land.x, cy : land.y, r : mm('TargetDotPx'), fill : colour, stroke : Na__LeParamNoodle__Setting('Casing'), 'stroke-width' : mm('LinePx') / 2 }, svg);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | What a Tie Lands On: Its Box and the Point on It
    // ------------------------------------------------------------
    function Na__LeParamNoodle__LandingFor(tied, socket) {
        if (tied.kind === Na__LeParamLink__KIND_VIEWPORT && tied.viewport) {
            const box = tied.viewport.Viewport__FrameMm;
            return { box : box, land : Na__LeParamNoodle__LandOn(box, socket) };
        }
        if (tied.kind === Na__LeParamLink__KIND_SHEET) {
            const cell = Na__LeParamNoodle__ScaleCell();
            if (!cell) return null;
            return { box : cell.box, land : { x : cell.point.x, y : cell.point.y, normal : [ 0, -1 ] } };   // <-- Down onto the top of the cell
        }
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Round Handle on the Noodle: the Socket or the Plug
    // ------------------------------------------------------------
    // at is in paper millimetres. Either handle starts the same drag, and
    // keeps its press to itself: the plug lies on a viewport's frame, and a
    // press that reached the sheet tools there would pick the viewport up.
    // ------------------------------------------------------------
    function Na__LeParamNoodle__Handle(layer, className, title, at, sizeKey, ppm, zoom, sheet, groupId) {
        const scale  = zoom > 0 ? zoom : 1;
        const sizePx = Na__LeParamNoodle__Setting(sizeKey) / scale;
        const grip   = document.createElement('div');
        grip.className         = className;
        grip.title             = title;
        grip.style.left        = ((at.x * ppm) - (sizePx / 2)) + 'px';
        grip.style.top         = ((at.y * ppm) - (sizePx / 2)) + 'px';
        grip.style.width       = sizePx + 'px';
        grip.style.height      = sizePx + 'px';
        grip.style.borderWidth = (2 / scale) + 'px';
        grip.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.stopPropagation();                                          // <-- The handle's press, not the sheet tools'
            Na__LeParamNoodle__OnDown(event, sheet, groupId);
        });
        Na__LeParamNoodle__SWALLOWED.forEach((name) => grip.addEventListener(name, (event) => event.stopPropagation()));
        layer.appendChild(grip);
        return grip;
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw a Selected Parametric Element's Tie, Its Socket and Its Plug
    // ------------------------------------------------------------
    // The group grip provider. Nothing for a plain group or a type with no
    // link point. While either end is being dragged only the live noodle
    // shows, so a repaint in the middle of a drag does not draw the old tie
    // under it - nor a plug at the end of a noodle that is not there. An
    // element on a locked layer still shows what it is tied to, but has
    // neither handle to take hold of. An element tied to nothing has no far
    // end, so no plug: the socket is how a first noodle is drawn.
    // ------------------------------------------------------------
    function Na__LeParamNoodle__Render(layer, sheet, selection, ppm, zoom) {
        if (!layer || !sheet || !selection || selection.kind !== 'group') return false;
        const handles = Na__LeParam__HandlesOf(sheet, selection.id);
        const socket  = Na__LeParamNoodle__SocketOf(handles);
        if (!socket) return false;
        const groupId = selection.id;
        const tied    = Na__LeParamLink__DescribeById(sheet, groupId);
        const drag    = Na__LeParamNoodle__Drag;
        const landing = (drag && drag.groupId === groupId) ? null : Na__LeParamNoodle__LandingFor(tied, socket);
        if (landing) { const svg = Na__LeParamNoodle__Overlay(layer, Na__LeParamNoodle__CLASS); if (svg) Na__LeParamNoodle__Draw(svg, socket, landing.land, landing.box, false); }
        if (Na__LeParam__IsLocked(sheet, groupId)) return true;

        const isTied = tied.kind !== Na__LeParamLink__KIND_NONE;
        const told   = isTied ? Na__LeParam__Label('GripLinkTied', 'Tied to {target}.', { target : tied.name }) + ' ' : '';
        Na__LeParamNoodle__Handle(layer, Na__LeParamNoodle__CLASS_SOCKET + (isTied ? ' is-tied' : ''),
            told + Na__LeParam__Label('GripLink', 'Drag onto a drawing to tie this to it, or onto the title block for the sheet\'s scale. Let go on bare paper to untie it.'),
            socket, 'LinkSizePx', ppm, zoom, sheet, groupId);
        if (landing) {
            Na__LeParamNoodle__Handle(layer, Na__LeParamNoodle__CLASS_PLUG,
                told + Na__LeParam__Label('GripPlug', 'Drag this end onto another drawing to move the tie there, or onto the title block for the sheet\'s scale. Let go on bare paper to untie it.'),
                landing.land, 'PlugSizePx', ppm, zoom, sheet, groupId);   // <-- After the socket, so where the two meet on a very short noodle the plug is the one on top
        }
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dragging Either End
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Redraw the Live Noodle: Socket to Pointer, and What It Is Over
    // ------------------------------------------------------------
    // Over something it can be tied to, the noodle lands on it the way the
    // finished tie will, so what is about to happen is what is on screen.
    // ------------------------------------------------------------
    function Na__LeParamNoodle__DrawLive(drag, pointMm) {
        const layer = Na__LeSurface__GetElements().handles;
        const sheet = Na__LeModel__GetSheetById(drag.sheetId);
        if (!layer || !sheet) return;
        layer.querySelectorAll('.na-le-param-noodle').forEach((el) => el.remove());       // <-- The finished tie goes while the live one is up
        layer.querySelectorAll('.na-le-grip--param-plug').forEach((el) => { el.style.visibility = 'hidden'; });   // <-- ...and the plug at its far end with it. Hidden, not removed: it may be the element the press began on, and the repaint at the end of the drag replaces it
        const socket = Na__LeParamNoodle__SocketOf(Na__LeParam__HandlesOf(sheet, drag.groupId));
        const svg    = socket ? Na__LeParamNoodle__Overlay(layer, Na__LeParamNoodle__CLASS_LIVE) : null;
        if (!svg) return;
        const over = Na__LeParamNoodle__TargetAt(sheet, pointMm);
        drag.over  = over;
        let land   = { x : pointMm.x, y : pointMm.y, normal : [ 0, (pointMm.y < socket.y) ? 1 : -1 ] };
        if (over.kind === Na__LeParamLink__KIND_VIEWPORT) land = Na__LeParamNoodle__LandOn(over.box, socket);
        if (over.kind === Na__LeParamLink__KIND_SHEET) { const cell = Na__LeParamNoodle__ScaleCell(); if (cell) land = { x : cell.point.x, y : cell.point.y, normal : [ 0, -1 ] }; }
        Na__LeParamNoodle__Draw(svg, socket, land, over.box, true);
    }
    // ------------------------------------------------------------


    // FUNCTION | End the Drag
    // ------------------------------------------------------------
    // apply true ties the element to what the noodle was let go over - or
    // unties it, over bare paper - and says so. apply false changes nothing.
    // Either way the selection is redrawn, which draws the tie as it now is.
    // ------------------------------------------------------------
    function Na__LeParamNoodle__End(apply) {
        const drag = Na__LeParamNoodle__Drag;
        Na__LeParamNoodle__Drag = null;
        window.removeEventListener('pointermove',   Na__LeParamNoodle__OnMove, true);
        window.removeEventListener('pointerup',     Na__LeParamNoodle__OnUp, true);
        window.removeEventListener('pointercancel', Na__LeParamNoodle__OnCancel, true);
        window.removeEventListener('keydown',       Na__LeParamNoodle__OnKey, true);
        document.body.classList.remove(Na__LeParamNoodle__BODY_CLASS);
        const layer = Na__LeSurface__GetElements().handles;
        if (layer) layer.querySelectorAll('.na-le-param-noodle--live').forEach((el) => el.remove());
        if (!drag) return;
        const sheet = Na__LeModel__GetSheetById(drag.sheetId);
        if (sheet && apply && drag.moved && drag.over) {
            const over = drag.over;
            if (over.kind === Na__LeParamLink__KIND_VIEWPORT) {
                Na__LeParamLink__SetLink(sheet, drag.groupId, over.viewport.Viewport__Id);
            } else if (over.kind === Na__LeParamLink__KIND_SHEET) {
                Na__LeParamLink__SetSheetLink(sheet, drag.groupId);
            } else if (Na__LeParamLink__DescribeById(sheet, drag.groupId).kind !== Na__LeParamLink__KIND_NONE) {
                Na__LeParamLink__SetLink(sheet, drag.groupId, null);
            }
            const now    = Na__LeParamLink__DescribeById(sheet, drag.groupId);
            const params = Na__LeParam__GetParams(sheet, drag.groupId) || {};
            const block  = Na__LeParam__GetBlockById(sheet, drag.groupId);
            const type   = block ? Na__LeParam__GetType(block.Parametric__Type) : null;
            const barless = !!type && typeof type.hasBar === 'function' && !type.hasBar(params);   // <-- A title on its own has no scale to keep
            Na__LeParamNoodle__Toast(now.kind === Na__LeParamLink__KIND_NONE
                ? (barless ? Na__LeParam__Label('ToastUntiedTitle', 'Untied. It keeps what it says.')
                           : Na__LeParam__Label('ToastUntied', 'Untied. It keeps {scale}.', { scale : Na__LeDrawScale__Label(params.ScaleDenominator) }))
                : Na__LeParam__Label('ToastTied', 'Tied to {target}.', { target : now.name }));
        }
        Na__LeSurface__Refresh('selection');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take Hold of the Socket or the Plug, Move, Let Go, Cancel
    // ------------------------------------------------------------
    // One drag for both ends: whichever was pressed, the live noodle runs from
    // the element's socket to the pointer, which is what the finished tie will
    // do. The drag listens on the window and holds ids, never the handle's
    // element: a repaint replaces it. A press that never moves further than
    // ClickSlopPx is not a drag and ties nothing.
    // ------------------------------------------------------------
    function Na__LeParamNoodle__OnDown(event, sheet, groupId) {
        if (Na__LeParamNoodle__Drag) return;
        Na__LeMenu__Close();
        Na__LeParamNoodle__Drag = { pointerId : event.pointerId, sheetId : sheet.Sheet__Id, groupId : groupId, startX : event.clientX, startY : event.clientY, moved : false, over : null };
        document.body.classList.add(Na__LeParamNoodle__BODY_CLASS);
        window.addEventListener('pointermove',   Na__LeParamNoodle__OnMove, true);
        window.addEventListener('pointerup',     Na__LeParamNoodle__OnUp, true);
        window.addEventListener('pointercancel', Na__LeParamNoodle__OnCancel, true);
        window.addEventListener('keydown',       Na__LeParamNoodle__OnKey, true);
    }
    function Na__LeParamNoodle__OnMove(event) {
        const drag = Na__LeParamNoodle__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < Na__LeParamNoodle__Setting('ClickSlopPx')) return;
        drag.moved = true;
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (point) Na__LeParamNoodle__DrawLive(drag, point);
    }
    function Na__LeParamNoodle__OnUp(event) {
        if (!Na__LeParamNoodle__Drag || event.pointerId !== Na__LeParamNoodle__Drag.pointerId) return;
        event.stopPropagation();
        Na__LeParamNoodle__End(true);
    }
    function Na__LeParamNoodle__OnCancel(event) {
        if (Na__LeParamNoodle__Drag && event.pointerId === Na__LeParamNoodle__Drag.pointerId) Na__LeParamNoodle__End(false);
    }
    function Na__LeParamNoodle__OnKey(event) {
        if (!Na__LeParamNoodle__Drag || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();                                             // <-- The drag's Escape, not the sheet tools'
        Na__LeParamNoodle__End(false);
    }
    // ------------------------------------------------------------


    // FUNCTION | Register With the Grips Module (once)
    // ------------------------------------------------------------
    function Na__LeParamNoodle__Attach() {
        if (Na__LeParamNoodle__Registered) return false;
        Na__LeParamNoodle__Registered = Na__LeGrips__RegisterGroupProvider(Na__LeParamNoodle__Render);
        return Na__LeParamNoodle__Registered;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Parametric Scrapbook Link Noodle API
    // ------------------------------------------------------------
    export {
        Na__LeParamNoodle__Attach,
        Na__LeParamNoodle__Render,
        Na__LeParamNoodle__PathD,
        Na__LeParamNoodle__LandOn,
        Na__LeParamNoodle__ScaleCell,
        Na__LeParamNoodle__TargetAt
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
