// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET SURFACE
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetSurface__.js
// NAMESPACE  : Na__LeSurface
// MODULE     : Layout Editor - Sheet Surface
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The paper on screen: frames, chrome, markup and selection, sized in true paper pixels
// CREATED    : 09-Sep-2026
//
// DESCRIPTION:
// - The stage is a grey scrolling area. Inside it a scaler box the size of
//   the zoomed paper holds the paper element, which is laid out at
//   ScreenPixelsPerMm and scaled with a CSS transform. Everything on the
//   paper is placed in paper millimetres times that constant, so a zoom
//   never re-lays anything out.
// - Layers on the paper, bottom to top: THE STACK, then the focus layer (an
//   open container redrawn over the faded sheet), then the selection layer
//   (outline and handles, drawn by the handles module and counter-scaled so
//   they stay the same size at any zoom).
// - THE STACK is the sheet itself, in the Layers list's order, top of the list
//   frontmost (Na__LayoutEditor__PaintOrder__). The viewport frames (one
//   clipped box each, filled by the 2D and 3D viewport modules) and SVG slots
//   of primitives are interleaved by z-index inside one stacking context: a
//   viewport's own frame line and caption straight over it, the sheet's own
//   paper (border, title block, notes margin) over the frontmost viewports,
//   each layer's markup where the list puts it, and the selection highlights
//   in a last slot of their own. Chrome and markup never share an SVG, so
//   .na-le-paper__chrome and .na-le-paper__markup still name what they hold.
// - The surface never listens to pointer events itself; the sheet tools own
//   the interaction and ask it for millimetres.
//
// INTEGRATION:
// - Mounted by the mode controller; refreshed on sheet model changes.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 51__System__LayoutEditor/Na__LayoutEditor__SheetSurface__.js
// - Ported on     : 10-Sep-2026 for TrueVision3D v2.21.0 (re-alignment)
// - Parity        : adapted
// - Divergences   : Console prefix, header and folder numbers; the viewport cache of
//                   1.6.0 is authored here first; ported 18-Sep-2026 as ValeVision3D v2.57.0.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.8.0 (TrueVision)
// - ZOOM NOW, REDRAW WHEN IT RESTS. A wheel or pinch step now opens a zoom
//   gesture (NoteZoomGesture, called by the navigation module). Until the
//   zoom has rested for ZoomSettleMs only the paper's scale changes: the
//   handles are not rebuilt per step, and the paper carries
//   na-le-paper--zooming, which holds it as one composited layer so a step
//   scales the picture already drawn instead of rasterising the sheet again.
//   Then SettleZoom takes the hold off, counter-scales the handles and
//   announces ZOOM_SETTLED_EVENT, in one task, so the sheet is drawn once,
//   crisp. A single zoom (Fit, 100%, a resize) settles at once. The listeners
//   that used to run on every step - the notes margin grip, the Measurements
//   box, the sheet tools' counter-scaled boxes, Draft mode's hairlines - now
//   listen for the settle; ZOOM_EVENT is left to what must track the zoom
//   live (the toolbar's readout).
//
// 21-Sep-2026 - Version 1.7.0 (TrueVision)
// - THE LAYERS LIST IS THE STACK. Every viewport used to sit in one box at
//   z-index 1 under one chrome SVG and one markup SVG, so the list only ever
//   ordered viewports against each other: a layer dragged below the Viewports
//   layer still drew over the drawing. The frames and the primitives now
//   share one stacking context, div.na-le-paper__stack, and RefreshStack lays
//   them down in the order Na__LePaint__Plan gives - a viewport's frame gets
//   the z-index of its place, and the primitives between two viewports are one
//   SVG slot. The frames container keeps its class and its frames, but is no
//   longer a stacking context of its own, which is what lets them interleave.
// - The chrome is built once per chrome change and kept (Na__LeSurface__Chrome),
//   so a markup refresh - every frame of a drag - does not measure the title
//   block again; and a slot whose markup is unchanged is not re-parsed.
//
// 18-Sep-2026 - Version 1.6.0 (TrueVision)
// - THE VIEWPORT CACHE. Showing another sheet used to release every frame of
//   the one being left: the base images, the painted linework SVG, the 3D
//   snapshots and the keys they were rendered under all went, so coming back
//   to a drawing tab rendered every viewport on it again from nothing, however
//   many times it had been drawn already. Each sheet now has its own frames
//   container. Leaving a sheet PARKS it: the container is lifted off the paper
//   whole and the viewport modules hand over their states (Na__LeVp2d__Park,
//   Na__LeVp3d__Park) to be kept beside it. Showing the sheet again puts both
//   back before RefreshFrames runs, and Fill - which has always compared keys
//   before asking for a render - finds every key unchanged and asks for
//   nothing. A tab change is a DOM swap.
// - Nothing new decides when a picture is stale. The keys Fill already builds
//   cover the frame, the window, the scale, the styles, the composite weights,
//   the model layers, the raster level, the scene and the model, and they are
//   compared when the sheet is shown again, so a change made while a sheet was
//   parked (a raster level, a scene edit, a design phase) re-renders exactly
//   the viewports it touches, then. Force Render is untouched.
// - Why the states move rather than stay in the viewport modules' maps: those
//   maps are keyed by viewport id, and every sheet numbers its viewports from
//   one. Two sheets' Viewport_1 cannot share a map, so a parked state is never
//   in it. Release now names the frame body for the same reason.
// - Least recently shown sheets are dropped past ViewportCache MaxParkedSheets
//   (0 switches the cache off); a sheet deleted from the set is dropped when
//   the next sheet is shown. Leaving the editor parks too, so the 3D Model tab
//   and back costs nothing either. The PDF never reads any of this.
//
// 17-Sep-2026 - Version 1.5.0
// - RefreshScope and the focus layer: while a container is open
//   (Na__LayoutEditor__EditScope__) the paper takes na-le-paper--scoped, which
//   fades the viewport frames, the chrome and the markup to EditScope
//   FadeOpacity, and the contents of that container are drawn again at full
//   strength in a new layer above them (Na__LeMarkup__BuildItemPrimitives). The
//   faded copy underneath is the same markup in the same place, so nothing
//   shifts as a container opens and closes. 'scope' is a refresh reason of its
//   own and rides along with 'markup'.
//
//
// 14-Sep-2026 - Version 1.4.0
// - Several selected items: the markup highlights every one, and the selection
//   layer outlines every selected viewport - without handles or grips, which
//   edit one item at a time (Na__LeHandles__RenderOutlines).
//
// 13-Sep-2026 - Version 1.3.0
// - Refresh is coalesced onto the next animation frame, so a drag that asks for
//   a rebuild on every pointer move gets one per painted frame, and several
//   listeners reacting to one change share one rebuild. RefreshNow is the
//   synchronous path; SetSheet and Unmount cancel anything still booked.
//
// 10-Sep-2026 - Version 1.2.0
// - Grips for a selected dimension or shape in the handles layer.
//
// 10-Sep-2026 - Version 1.1.0
// - Editing and locked outline states; a full stage of margin on every side so the paper roams freely.
//
// 09-Sep-2026 - Version 1.0.0
// - Initial implementation for port Phase 5.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Layout, Model, Chrome, Markup, Viewports and Handles
    // ------------------------------------------------------------
    import { Na__LeCfg__GetEditScopeSetup, Na__LeCfg__GetViewportCacheSetup, Na__LeCfg__GetNavigationSetup } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeLayout__Solve } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import {
        Na__LeModel__KIND_3D,
        Na__LeModel__GetSheetById,
        Na__LeModel__GetFields,
        Na__LeModel__GetSelection,
        Na__LeModel__GetSelectionItems,
        Na__LeModel__IsLayerVisible,
        Na__LeModel__IsLayerLocked
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeChrome__ASSET_EVENT,
        Na__LeChrome__Build,
        Na__LeChrome__BuildViewportFrame,
        Na__LeChrome__ToSvgMarkup
    } from './Na__LayoutEditor__SheetChrome__.js';
    import { Na__LeMarkup__BuildLayerPrimitives, Na__LeMarkup__BuildHighlightPrimitives } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    import {
        Na__LePaint__STEP_VIEWPORT,
        Na__LePaint__STEP_SHEET,
        Na__LePaint__Plan
    } from '../15__Core__Markup/Na__LayoutEditor__PaintOrder__.js';
    import { Na__LeMargin__Push } from '../50__Feature__Specification/Na__LayoutEditor__SpecMargin__.js';
    import { Na__LeVp2d__Fill, Na__LeVp2d__Release, Na__LeVp2d__Park, Na__LeVp2d__Restore } from '../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js';
    import { Na__LeVp3d__Fill, Na__LeVp3d__Release, Na__LeVp3d__Park, Na__LeVp3d__Restore } from '../20__System__Viewports/Na__LayoutEditor__Viewport3d__.js';
    import { Na__LeHandles__Render, Na__LeHandles__RenderOutlines, Na__LeHandles__Clear } from '../20__System__Viewports/Na__LayoutEditor__ViewportHandles__.js';
    import { Na__LeGrips__Render } from '../30__System__SheetTools/Na__LayoutEditor__Grips__.js';
    import { Na__LeScope__Get, Na__LeScope__Contents } from '../30__System__SheetTools/Na__LayoutEditor__EditScope__.js';
    import { Na__LeMarkup__BuildItemPrimitives } from '../15__Core__Markup/Na__LayoutEditor__MarkupBridge__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Class Names and Events
    // ------------------------------------------------------------
    const Na__LeSurface__ZOOM_EVENT   = 'na-layouteditor-zoom-changed';     // <-- Every step, as it happens: only what must track the zoom live listens here
    const Na__LeSurface__ZOOM_SETTLED_EVENT = 'na-layouteditor-zoom-settled';   // <-- The zoom has come to rest: once per wheel or pinch gesture, at once for a single zoom
    const Na__LeSurface__CLASS_ZOOMING = 'na-le-paper--zooming';          // <-- A gesture is under way: the paper is held as one composited layer
    const Na__LeSurface__CLASS_ROOM   = 'na-le-room';
    const Na__LeSurface__CLASS_SCALER = 'na-le-scaler';
    const Na__LeSurface__CLASS_PAPER  = 'na-le-paper';
    const Na__LeSurface__CLASS_FRAME  = 'na-le-frame';
    const Na__LeSurface__CLASS_FRAMES = 'na-le-paper__viewports';
    const Na__LeSurface__CLASS_STACK  = 'na-le-paper__stack';    // <-- The sheet in the Layers list's order: frames and SVG slots in one stacking context
    const Na__LeSurface__CLASS_SLOT   = 'na-le-paper__slot';
    const Na__LeSurface__CLASS_CHROME = 'na-le-paper__chrome';
    const Na__LeSurface__CLASS_MARKUP = 'na-le-paper__markup';
    const Na__LeSurface__CLASS_MARKS  = 'na-le-paper__highlights'; // <-- The selection, over the whole stack
    const Na__LeSurface__CLASS_SCOPED = 'na-le-paper--scoped';   // <-- A container is open: everything outside it is faded back
    // ------------------------------------------------------------

    // MODULE VARIABLES | Elements and Current Sheet
    // ------------------------------------------------------------
    let Na__LeSurface__Stage     = null;
    let Na__LeSurface__Room      = null;    // <-- Paper plus a whole stage of room on every side
    let Na__LeSurface__Scaler    = null;
    let Na__LeSurface__Paper     = null;
    let Na__LeSurface__Stack     = null;    // <-- Holds the frames container and the SVG slots, interleaved by z-index
    let Na__LeSurface__Frames    = null;    // <-- Container of viewport frames: the shown sheet's own, swapped as sheets change
    let Na__LeSurface__Slots     = [];      // <-- The stack's SVG slots, back to front: { el, markup, className }
    let Na__LeSurface__Chrome    = null;    // <-- { sheet : primitives, frames : Map(viewportId -> primitives) }, rebuilt when the chrome changes
    let Na__LeSurface__FocusSvg  = null;    // <-- What is inside the open container, redrawn crisp over the faded sheet
    let Na__LeSurface__Handles   = null;
    let Na__LeSurface__Sheet     = null;
    let Na__LeSurface__Layout    = null;
    let Na__LeSurface__Zoom      = 1;
    let Na__LeSurface__Ppm       = 3.2;     // <-- Screen pixels per paper millimetre at zoom 1
    let Na__LeSurface__Editable  = false;
    let Na__LeSurface__EditingId = null;    // <-- Viewport whose content is being repositioned (double-click)
    let Na__LeSurface__OnAsset   = null;
    let Na__LeSurface__Pending   = null;    // <-- Reasons waiting for the next animation frame
    let Na__LeSurface__Frame     = 0;       // <-- The requestAnimationFrame handle holding them
    let Na__LeSurface__ZoomGesture = false; // <-- A wheel or pinch zoom is under way and has not yet rested
    let Na__LeSurface__ZoomTimer   = 0;     // <-- The timer that settles it
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Viewport Cache (sheets kept rendered while another is shown)
    // ------------------------------------------------------------
    // sheetId -> { frames : the sheet's container, off the paper, states : Map(viewportId -> { is3d, state }) }
    // A Map keeps insertion order, and a sheet is re-inserted each time it is
    // parked, so the first key is always the least recently shown.
    // ------------------------------------------------------------
    const Na__LeSurface__Parked  = new Map();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mount and Teardown
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build an Element With a Class
    // ------------------------------------------------------------
    function Na__LeSurface__El(tagName, className, parent) {
        const el = document.createElement(tagName);
        el.className = className;
        if (parent) parent.appendChild(el);
        return el;
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Paper Inside a Stage Element
    // ------------------------------------------------------------
    function Na__LeSurface__Mount(stageElement, options) {
        if (!stageElement) return false;
        Na__LeSurface__Unmount();
        Na__LeSurface__Stage    = stageElement;
        Na__LeSurface__Editable = !!(options && options.editable);
        Na__LeSurface__Room     = Na__LeSurface__El('div', Na__LeSurface__CLASS_ROOM, stageElement);
        Na__LeSurface__Scaler   = Na__LeSurface__El('div', Na__LeSurface__CLASS_SCALER, Na__LeSurface__Room);
        Na__LeSurface__Paper    = Na__LeSurface__El('div', Na__LeSurface__CLASS_PAPER, Na__LeSurface__Scaler);
        Na__LeSurface__Stack    = Na__LeSurface__El('div', Na__LeSurface__CLASS_STACK, Na__LeSurface__Paper);
        Na__LeSurface__Frames   = Na__LeSurface__El('div', Na__LeSurface__CLASS_FRAMES, Na__LeSurface__Stack);
        Na__LeSurface__Slots    = [];
        Na__LeSurface__Chrome   = null;
        Na__LeSurface__Handles  = null;                                          // <-- Created after the SVG layers so it sits on top
        Na__LeSurface__OnAsset  = () => Na__LeSurface__RefreshChrome();
        window.addEventListener(Na__LeChrome__ASSET_EVENT, Na__LeSurface__OnAsset);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Remove the Paper and Forget the Sheet
    // ------------------------------------------------------------
    function Na__LeSurface__Unmount() {
        Na__LeSurface__CancelPending();                                          // <-- A booked rebuild must not land on a torn-down paper
        if (Na__LeSurface__ZoomTimer) window.clearTimeout(Na__LeSurface__ZoomTimer);   // <-- Nor a zoom settling on a paper that has gone
        Na__LeSurface__ZoomTimer = 0; Na__LeSurface__ZoomGesture = false;
        if (Na__LeSurface__OnAsset) window.removeEventListener(Na__LeChrome__ASSET_EVENT, Na__LeSurface__OnAsset);
        Na__LeSurface__OnAsset = null;
        if (Na__LeSurface__Sheet) Na__LeSurface__ReleaseFrames();
        Na__LeSurface__Parked.clear();                                           // <-- Parked states are in no map but this one: forgetting them is releasing them
        if (Na__LeSurface__Room && Na__LeSurface__Room.parentNode) Na__LeSurface__Room.parentNode.removeChild(Na__LeSurface__Room);
        Na__LeSurface__Stage = Na__LeSurface__Room = Na__LeSurface__Scaler = Na__LeSurface__Paper = Na__LeSurface__Stack = Na__LeSurface__Frames = null;
        Na__LeSurface__FocusSvg = Na__LeSurface__Handles = null;
        Na__LeSurface__Slots  = [];
        Na__LeSurface__Chrome = null;
        Na__LeSurface__Sheet = Na__LeSurface__Layout = null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Let the Viewport Modules Drop Their Per-Frame State
    // ------------------------------------------------------------
    function Na__LeSurface__ReleaseFrames() {
        if (!Na__LeSurface__Frames) return;
        Array.from(Na__LeSurface__Frames.children).forEach((frame) => {
            const id = frame.getAttribute('data-na-viewport-id');
            if (frame.classList.contains(Na__LeSurface__CLASS_FRAME + '--3d')) Na__LeVp3d__Release(id, frame.firstElementChild); else Na__LeVp2d__Release(id, frame.firstElementChild);
        });
        Na__LeSurface__Frames.innerHTML = '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Viewport Cache
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Lift the Shown Sheet's Frames Off the Paper and Keep Them
    // ------------------------------------------------------------
    // The container leaves the DOM whole, so nothing in it is laid out or
    // painted while it waits, and the viewport modules hand over each frame's
    // state - timers cleared, no render booked - to wait with it. The paper
    // is left with a fresh, empty container, so everything that reads
    // Na__LeSurface__Frames finds one as it always has.
    //
    // With the cache off (MaxParkedSheets 0) this is the old release.
    // ------------------------------------------------------------
    function Na__LeSurface__ParkFrames(sheetId) {
        if (!Na__LeSurface__Frames || !Na__LeSurface__Paper) return;
        const limit = Na__LeCfg__GetViewportCacheSetup().maxParkedSheets;
        if (!sheetId || limit <= 0) { Na__LeSurface__ReleaseFrames(); return; }

        const states = new Map();
        Array.from(Na__LeSurface__Frames.children).forEach((frame) => {
            const id    = frame.getAttribute('data-na-viewport-id');
            const is3d  = frame.classList.contains(Na__LeSurface__CLASS_FRAME + '--3d');
            const state = is3d ? Na__LeVp3d__Park(id, frame.firstElementChild) : Na__LeVp2d__Park(id, frame.firstElementChild);
            if (state) states.set(id, { is3d : is3d, state : state });
        });

        const parkedFrames = Na__LeSurface__Frames;
        Na__LeSurface__Frames = document.createElement('div');                   // <-- The stand-in the next sheet fills, or that TakeFrames swaps for a parked one
        Na__LeSurface__Frames.className = Na__LeSurface__CLASS_FRAMES;
        parkedFrames.parentNode.replaceChild(Na__LeSurface__Frames, parkedFrames);   // <-- Same place in the stack; the frames' z-indexes interleave them with its slots

        Na__LeSurface__Parked.delete(sheetId);                                   // <-- Re-inserted, so it is the most recently shown
        Na__LeSurface__Parked.set(sheetId, { frames : parkedFrames, states : states });
        while (Na__LeSurface__Parked.size > limit) {
            Na__LeSurface__Parked.delete(Na__LeSurface__Parked.keys().next().value);   // <-- The least recently shown goes; its states are in no other map
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put a Parked Sheet's Frames Back on the Paper
    // ------------------------------------------------------------
    // Called with the paper holding the empty stand-in ParkFrames (or Mount)
    // left. The states go back into the viewport modules' maps BEFORE
    // RefreshFrames runs, so Fill meets the body it knows and the keys it
    // rendered under. Sheets deleted from the set meanwhile are dropped here.
    // ------------------------------------------------------------
    function Na__LeSurface__TakeFrames(sheetId) {
        Array.from(Na__LeSurface__Parked.keys()).forEach((id) => {
            if (!Na__LeModel__GetSheetById(id)) Na__LeSurface__Parked.delete(id);
        });
        const entry = Na__LeSurface__Parked.get(sheetId);
        if (!entry || !Na__LeSurface__Frames || !Na__LeSurface__Paper) return false;
        Na__LeSurface__Parked.delete(sheetId);
        Na__LeSurface__ReleaseFrames();                                          // <-- The stand-in is empty; this only keeps the maps honest if it ever is not
        Na__LeSurface__Frames.parentNode.replaceChild(entry.frames, Na__LeSurface__Frames);
        Na__LeSurface__Frames = entry.frames;
        entry.states.forEach((held, id) => { if (held.is3d) Na__LeVp3d__Restore(id, held.state); else Na__LeVp2d__Restore(id, held.state); });
        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sheet and Paper
// -----------------------------------------------------------------------------

    // FUNCTION | Show a Sheet (full rebuild)
    // ------------------------------------------------------------
    function Na__LeSurface__SetSheet(sheet) {
        if (!Na__LeSurface__Paper) return false;
        Na__LeSurface__CancelPending();                                          // <-- A full rebuild covers whatever was queued

        // ANOTHER SHEET (or none): the one on screen is parked, not released, and
        // the one arriving takes its own frames back if it has been shown before.
        const changing = !Na__LeSurface__Sheet || !sheet || sheet.Sheet__Id !== Na__LeSurface__Sheet.Sheet__Id;
        if (changing && Na__LeSurface__Sheet) Na__LeSurface__ParkFrames(Na__LeSurface__Sheet.Sheet__Id);
        if (changing && sheet) Na__LeSurface__TakeFrames(sheet.Sheet__Id);
        Na__LeSurface__Sheet  = sheet || null;
        Na__LeSurface__Layout = sheet ? Na__LeLayout__Solve(sheet) : null;
        Na__LeSurface__Paper.hidden = !sheet;
        if (!sheet) return true;
        Na__LeSurface__Ppm = Na__LeSurface__Layout.ScreenPixelsPerMm;
        Na__LeSurface__Paper.style.width  = (Na__LeSurface__Layout.Page.WidthMm  * Na__LeSurface__Ppm) + 'px';
        Na__LeSurface__Paper.style.height = (Na__LeSurface__Layout.Page.HeightMm * Na__LeSurface__Ppm) + 'px';
        Na__LeSurface__ApplyZoom();
        Na__LeSurface__RefreshFrames();
        Na__LeSurface__RefreshChrome();                                          // <-- The chrome afresh and the whole stack with it, markup included
        Na__LeSurface__RefreshScope();
        Na__LeSurface__RefreshSelection();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Refresh Part of the Paper After a Model Change
    // ------------------------------------------------------------
    // reason: 'frames' | 'chrome' | 'markup' | 'scope' | 'selection' | 'sheet' | 'all'
    //
    // COALESCED ONTO THE NEXT ANIMATION FRAME. Every redraw here rebuilds a
    // whole SVG layer as a string and swaps the node in, which is affordable
    // once a frame and ruinous once a pointer event. A gaming mouse reports
    // several hundred moves a second and a shape drag called this on every
    // one of them, so the editor spent its time rebuilding pictures nobody
    // ever saw - the screen only shows sixty. Several callers also react to
    // the same model change, so one edit could ask for the same rebuild three
    // or four times over.
    //
    // Asking twice in a frame is now free: the reasons are merged and the
    // work happens once, just before the browser paints. Use RefreshNow only
    // where the DOM must be correct before the next statement runs.
    // ------------------------------------------------------------
    function Na__LeSurface__Refresh(reason) {
        if (!Na__LeSurface__Sheet) return;
        if (!Na__LeSurface__Pending) Na__LeSurface__Pending = new Set();
        Na__LeSurface__Pending.add(reason || 'all');
        if (Na__LeSurface__Frame) return;                                        // <-- Already booked for this frame
        Na__LeSurface__Frame = window.requestAnimationFrame(() => {
            Na__LeSurface__Frame = 0;
            const reasons = Na__LeSurface__Pending;
            Na__LeSurface__Pending = null;
            if (!reasons || !Na__LeSurface__Sheet) return;
            if (reasons.has('all') || reasons.has('sheet')) { Na__LeSurface__RefreshNow(reasons.has('all') ? 'all' : 'sheet'); return; }
            reasons.forEach((name) => Na__LeSurface__RefreshNow(name));
        });
    }
    // ------------------------------------------------------------


    // FUNCTION | Refresh Part of the Paper Right Now, Without Waiting for a Frame
    // ------------------------------------------------------------
    function Na__LeSurface__RefreshNow(reason) {
        if (!Na__LeSurface__Sheet) return;
        const all = !reason || reason === 'all';
        if (all || reason === 'sheet') { Na__LeSurface__Layout = Na__LeLayout__Solve(Na__LeSurface__Sheet); Na__LeSurface__SetSheet(Na__LeSurface__Sheet); return; }
        if (all || reason === 'frames')    Na__LeSurface__RefreshFrames();
        if (all || reason === 'frames' || reason === 'chrome') Na__LeSurface__RefreshChrome();
        if (all || reason === 'markup')    Na__LeSurface__RefreshMarkup();
        if (all || reason === 'markup' || reason === 'scope') Na__LeSurface__RefreshScope();   // <-- The focus layer is a copy of the markup, so it is rebuilt with it
        if (all || reason === 'frames' || reason === 'markup' || reason === 'scope' || reason === 'selection') Na__LeSurface__RefreshSelection();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop a Frame That Is Still Booked
    // ------------------------------------------------------------
    // A pending rebuild must never land on a sheet that has since been torn
    // down or swapped, so leaving the editor and changing sheet both cancel.
    // ------------------------------------------------------------
    function Na__LeSurface__CancelPending() {
        if (Na__LeSurface__Frame) window.cancelAnimationFrame(Na__LeSurface__Frame);
        Na__LeSurface__Frame   = 0;
        Na__LeSurface__Pending = null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Apply the Zoom to the Paper and Size the Scaler
    // ------------------------------------------------------------
    function Na__LeSurface__ApplyZoom() {
        if (!Na__LeSurface__Paper || !Na__LeSurface__Layout) return;
        const widthPx  = Na__LeSurface__Layout.Page.WidthMm  * Na__LeSurface__Ppm * Na__LeSurface__Zoom;
        const heightPx = Na__LeSurface__Layout.Page.HeightMm * Na__LeSurface__Ppm * Na__LeSurface__Zoom;
        Na__LeSurface__Paper.style.transform = 'scale(' + Na__LeSurface__Zoom + ')';
        Na__LeSurface__Scaler.style.width    = widthPx  + 'px';
        Na__LeSurface__Scaler.style.height   = heightPx + 'px';
        // ROOM TO ROAM | The paper sits a whole stage in from every edge of an
        // explicitly sized room, so it can be pushed clear of the window in any
        // direction the way a LayOut page can; Fit centres it by scrolling into
        // that room. Explicit sizes, because a scroll container does not
        // reliably count an end margin as scrollable.
        const stageW = Math.min(Na__LeSurface__Stage.clientWidth,  window.innerWidth);    // <-- The visible box, so a stage that ever grew with its content cannot feed back
        const stageH = Math.min(Na__LeSurface__Stage.clientHeight, window.innerHeight);
        Na__LeSurface__Room.style.width    = (widthPx  + (stageW * 2)) + 'px';
        Na__LeSurface__Room.style.height   = (heightPx + (stageH * 2)) + 'px';
        Na__LeSurface__Scaler.style.left   = stageW + 'px';
        Na__LeSurface__Scaler.style.top    = stageH + 'px';
        // Handles are counter-scaled - but not step by step while a gesture is
        // under way. Rebuilt on every wheel notch, a selected viewport's
        // outline (as big as the viewport) was torn down and put back each
        // time, and the browser drew everything under it again with it: the
        // whole viewport's linework, per notch. They scale with the paper for
        // the length of the gesture and are put right once, when it settles.
        if (Na__LeSurface__Handles && !Na__LeSurface__ZoomGesture) Na__LeSurface__RefreshSelection();
    }
    // ------------------------------------------------------------


    // FUNCTION | Set the Zoom (the navigation module keeps the cursor point fixed)
    // ------------------------------------------------------------
    // ZOOM_EVENT goes out on every step. A single zoom (Fit, 100%, a resize)
    // has nothing to wait for, so it settles at once; a wheel or pinch step
    // (NoteZoomGesture) settles when the gesture rests.
    // ------------------------------------------------------------
    function Na__LeSurface__SetZoom(zoom) {
        if (!Number.isFinite(zoom) || zoom <= 0) return Na__LeSurface__Zoom;
        Na__LeSurface__Zoom = zoom;
        Na__LeSurface__ApplyZoom();
        window.dispatchEvent(new CustomEvent(Na__LeSurface__ZOOM_EVENT, { detail : { zoom : zoom } }));
        if (!Na__LeSurface__ZoomGesture) window.dispatchEvent(new CustomEvent(Na__LeSurface__ZOOM_SETTLED_EVENT, { detail : { zoom : zoom } }));
        return Na__LeSurface__Zoom;
    }
    function Na__LeSurface__GetZoom() { return Na__LeSurface__Zoom; }
    // ------------------------------------------------------------


    // FUNCTION | A Wheel or Pinch Step: Zoom Now, Redraw When It Rests
    // ------------------------------------------------------------
    // Called by the navigation module just before the step's SetZoom. It opens
    // (or extends) a gesture: until ZoomSettleMs pass with no further step,
    // only the paper's scale changes - the handles are not rebuilt, the
    // listeners of ZOOM_SETTLED_EVENT wait, and (HoldPaperWhileZooming) the
    // paper is held as ONE composited layer, so each step scales the picture
    // already drawn instead of rasterising every line, fill, hatch and picture
    // on the sheet again. The browser draws it crisp once, when it settles.
    // Measured on RB05's ground floor plan: 76-110 ms a step without the hold,
    // 17-20 ms with it (TrueVision__PLAN__DraftMode__.md, section 9).
    // ------------------------------------------------------------
    function Na__LeSurface__NoteZoomGesture() {
        if (!Na__LeSurface__Paper) return;
        const setup = Na__LeCfg__GetNavigationSetup();
        Na__LeSurface__ZoomGesture = true;
        Na__LeSurface__Paper.classList.toggle(Na__LeSurface__CLASS_ZOOMING, setup.holdPaperWhileZooming !== false);
        if (Na__LeSurface__ZoomTimer) window.clearTimeout(Na__LeSurface__ZoomTimer);
        Na__LeSurface__ZoomTimer = window.setTimeout(Na__LeSurface__SettleZoom, setup.zoomSettleMs);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Zoom Has Rested: Everything That Waited, Together
    // ------------------------------------------------------------
    // The hold comes off, the handles are counter-scaled again and
    // ZOOM_SETTLED_EVENT goes out - all in one task, so the browser lays out
    // and rasterises the sheet ONCE, at its new zoom, with whatever the
    // listeners change (Draft mode's hairline width among them).
    // ------------------------------------------------------------
    function Na__LeSurface__SettleZoom() {
        if (Na__LeSurface__ZoomTimer) window.clearTimeout(Na__LeSurface__ZoomTimer);
        Na__LeSurface__ZoomTimer = 0;
        if (!Na__LeSurface__ZoomGesture) return;
        Na__LeSurface__ZoomGesture = false;
        if (Na__LeSurface__Paper) Na__LeSurface__Paper.classList.remove(Na__LeSurface__CLASS_ZOOMING);
        if (Na__LeSurface__Handles) Na__LeSurface__RefreshSelection();
        window.dispatchEvent(new CustomEvent(Na__LeSurface__ZOOM_SETTLED_EVENT, { detail : { zoom : Na__LeSurface__Zoom } }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Screen Pixels per Paper Millimetre at Zoom 1
    // ------------------------------------------------------------
    function Na__LeSurface__GetPixelsPerMm() { return Na__LeSurface__Ppm; }
    // ------------------------------------------------------------


    // FUNCTION | Client Pixel to Paper Millimetre and Back
    // ------------------------------------------------------------
    function Na__LeSurface__ClientToPaperMm(clientX, clientY) {
        if (!Na__LeSurface__Paper) return null;
        const rect  = Na__LeSurface__Paper.getBoundingClientRect();
        const scale = Na__LeSurface__Ppm * Na__LeSurface__Zoom;
        return { x : (clientX - rect.left) / scale, y : (clientY - rect.top) / scale };
    }
    function Na__LeSurface__PaperMmToClient(xMm, yMm) {
        if (!Na__LeSurface__Paper) return null;
        const rect  = Na__LeSurface__Paper.getBoundingClientRect();
        const scale = Na__LeSurface__Ppm * Na__LeSurface__Zoom;
        return { x : rect.left + (xMm * scale), y : rect.top + (yMm * scale) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Accessors
    // ------------------------------------------------------------
    function Na__LeSurface__SetEditingViewport(viewportId) { Na__LeSurface__EditingId = viewportId || null; Na__LeSurface__RefreshSelection(); }
    function Na__LeSurface__GetEditingViewport() { return Na__LeSurface__EditingId; }
    function Na__LeSurface__GetSheet()  { return Na__LeSurface__Sheet; }
    function Na__LeSurface__GetLayout() { return Na__LeSurface__Layout; }
    function Na__LeSurface__GetElements() {
        return { stage : Na__LeSurface__Stage, scaler : Na__LeSurface__Scaler, paper : Na__LeSurface__Paper, frames : Na__LeSurface__Frames, handles : Na__LeSurface__Handles };
    }
    function Na__LeSurface__GetFrameBody(viewportId) {
        const frame = Na__LeSurface__Frames ? Na__LeSurface__Frames.querySelector('[data-na-viewport-id="' + viewportId + '"]') : null;
        return frame ? frame.firstElementChild : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Layers
// -----------------------------------------------------------------------------

    // FUNCTION | Rebuild or Reposition Every Viewport Frame
    // ------------------------------------------------------------
    // Frames are reused across refreshes so the viewport modules can keep
    // their rendered content; a frame whose viewport is gone is released.
    // WHERE A FRAME SITS IN THE STACK is not decided here: RefreshStack gives
    // each one its z-index among the SVG slots, and every path that reaches
    // this goes on to it.
    // ------------------------------------------------------------
    function Na__LeSurface__RefreshFrames() {
        const sheet = Na__LeSurface__Sheet;
        if (!sheet || !Na__LeSurface__Frames) return;
        const ppm   = Na__LeSurface__Ppm;
        const alive = new Set();

        sheet.Sheet__Viewports.forEach((viewport) => {
            const id   = viewport.Viewport__Id;
            const is3d = viewport.Viewport__Kind === Na__LeModel__KIND_3D;
            alive.add(id);
            let frame = Na__LeSurface__Frames.querySelector('[data-na-viewport-id="' + id + '"]');
            if (frame && frame.classList.contains(Na__LeSurface__CLASS_FRAME + '--3d') !== is3d) { frame.remove(); frame = null; }
            if (!frame) {
                frame = Na__LeSurface__El('div', Na__LeSurface__CLASS_FRAME + ' ' + Na__LeSurface__CLASS_FRAME + (is3d ? '--3d' : '--2d'), Na__LeSurface__Frames);
                frame.setAttribute('data-na-viewport-id', id);
                Na__LeSurface__El('div', 'na-le-frame__body', frame);
            }
            const rect = viewport.Viewport__FrameMm;
            frame.style.left   = (rect.X * ppm) + 'px';
            frame.style.top    = (rect.Y * ppm) + 'px';
            frame.style.width  = (rect.WidthMm  * ppm) + 'px';
            frame.style.height = (rect.HeightMm * ppm) + 'px';
            frame.hidden = !Na__LeModel__IsLayerVisible(sheet, viewport.Viewport__LayerId);
            frame.classList.toggle(Na__LeSurface__CLASS_FRAME + '--locked', Na__LeModel__IsLayerLocked(sheet, viewport.Viewport__LayerId));
            if (frame.hidden) return;
            const body = frame.firstElementChild;
            if (is3d) Na__LeVp3d__Fill(body, sheet, viewport, ppm); else Na__LeVp2d__Fill(body, sheet, viewport, ppm);
        });

        Array.from(Na__LeSurface__Frames.children).forEach((frame) => {
            const id = frame.getAttribute('data-na-viewport-id');
            if (alive.has(id)) return;
            if (frame.classList.contains(Na__LeSurface__CLASS_FRAME + '--3d')) Na__LeVp3d__Release(id, frame.firstElementChild); else Na__LeVp2d__Release(id, frame.firstElementChild);
            frame.remove();
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Replace an SVG Layer on the Paper
    // ------------------------------------------------------------
    function Na__LeSurface__SwapSvg(current, markup, className, before) {
        const holder = document.createElement('div');
        holder.innerHTML = markup;
        const svg = holder.firstElementChild;
        if (!svg) return current;
        svg.setAttribute('class', className);
        svg.style.width  = Na__LeSurface__Paper.style.width;
        svg.style.height = Na__LeSurface__Paper.style.height;
        if (current && current.parentNode) current.parentNode.replaceChild(svg, current);
        else if (before && before.parentNode) Na__LeSurface__Paper.insertBefore(svg, before);
        else Na__LeSurface__Paper.appendChild(svg);
        return svg;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Chrome Once and Keep It
    // ------------------------------------------------------------
    // The sheet's own chrome (the border and title block, or the classic scan
    // and its field texts) apart from each viewport's frame line and caption,
    // so the stack can lay every frame's chrome straight over its viewport.
    // Kept until the chrome changes: the markup refresh a drag asks for every
    // frame does not measure the title block over again.
    // ------------------------------------------------------------
    function Na__LeSurface__BuildChrome(sheet) {
        const frames = new Map();
        (sheet.Sheet__Viewports || []).forEach((viewport) => frames.set(viewport.Viewport__Id, Na__LeChrome__BuildViewportFrame(sheet, viewport)));
        Na__LeSurface__Chrome = {
            sheetId : sheet.Sheet__Id,
            sheet   : Na__LeChrome__Build(Na__LeSurface__Layout, sheet, { fields : Na__LeModel__GetFields(sheet), includeFrames : false }),
            frames  : frames
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put One SVG Slot in the Stack at a Depth
    // ------------------------------------------------------------
    // The slot at this index is kept when its markup has not changed - most of
    // a sheet does not, frame to frame - and only its depth is set. className
    // is written into the markup, so it is part of what is compared.
    // ------------------------------------------------------------
    function Na__LeSurface__PutSlot(index, primitives, className, zIndex) {
        const layout = Na__LeSurface__Layout;
        const markup = Na__LeChrome__ToSvgMarkup(primitives, layout.Page.WidthMm, layout.Page.HeightMm, className);
        let slot = Na__LeSurface__Slots[index];
        if (!slot || slot.markup !== markup || slot.el.parentNode !== Na__LeSurface__Stack) {
            const holder = document.createElement('div');
            holder.innerHTML = markup;
            const svg = holder.firstElementChild;
            if (!svg) return;
            svg.setAttribute('class', className);
            svg.style.width  = Na__LeSurface__Paper.style.width;
            svg.style.height = Na__LeSurface__Paper.style.height;
            if (slot && slot.el.parentNode === Na__LeSurface__Stack) Na__LeSurface__Stack.replaceChild(svg, slot.el);
            else Na__LeSurface__Stack.appendChild(svg);
            slot = { el : svg, markup : markup };
            Na__LeSurface__Slots[index] = slot;
        }
        slot.el.style.zIndex = String(zIndex);
    }
    // ------------------------------------------------------------


    // FUNCTION | Lay the Sheet Down in the Layers List's Order
    // ------------------------------------------------------------
    // Walks Na__LePaint__Plan back to front. A viewport step gives its frame
    // the next depth and starts a new run with the frame's own line and
    // caption; whatever comes before the next viewport joins that run, split
    // only where it turns from chrome to markup or back, so every SVG slot
    // holds one or the other and its class says which. The selection
    // highlights are the last slot, over everything: a highlight belongs to
    // what is selected, not to the layer it is on.
    // rebuildChrome: the chrome changed, or the sheet did - build it afresh.
    // ------------------------------------------------------------
    function Na__LeSurface__RefreshStack(rebuildChrome) {
        const sheet = Na__LeSurface__Sheet;
        if (!sheet || !Na__LeSurface__Layout || !Na__LeSurface__Paper || !Na__LeSurface__Stack) return;
        if (rebuildChrome || !Na__LeSurface__Chrome || Na__LeSurface__Chrome.sheetId !== sheet.Sheet__Id) Na__LeSurface__BuildChrome(sheet);
        const chrome  = Na__LeSurface__Chrome;
        const options = { showBrokenHalos : true };                              // <-- The editor only: a PDF or an SVG export never opts in
        const CHROME  = Na__LeSurface__CLASS_CHROME, MARKUP = Na__LeSurface__CLASS_MARKUP;

        const runs = [];                                                         // <-- { frameId } or { className, primitives }, back to front
        const add  = (className, primitives) => {
            if (!primitives || primitives.length === 0) return;
            const last = runs[runs.length - 1];
            if (last && last.className === className) { for (let i = 0; i < primitives.length; i++) last.primitives.push(primitives[i]); return; }
            runs.push({ className : className, primitives : primitives.slice() });
        };
        Na__LePaint__Plan(sheet).forEach((step) => {
            if (step.kind === Na__LePaint__STEP_VIEWPORT) {
                const id = step.viewport.Viewport__Id;
                runs.push({ frameId : id });
                if (!chrome.frames.has(id)) chrome.frames.set(id, Na__LeChrome__BuildViewportFrame(sheet, step.viewport));   // <-- One arrived without a chrome refresh
                add(CHROME, chrome.frames.get(id));
                return;
            }
            if (step.kind === Na__LePaint__STEP_SHEET) {
                const margin = [];
                Na__LeMargin__Push(margin, sheet, Na__LeSurface__Layout);       // <-- The notes column's paper, then the border and title block over its edge
                add(MARKUP, margin);
                add(CHROME, chrome.sheet);
                return;
            }
            add(MARKUP, Na__LeMarkup__BuildLayerPrimitives(sheet, step.layerId, options));
        });

        let depth = 0, slot = 0;
        runs.forEach((run) => {
            depth += 1;
            if (run.frameId) {
                const frame = Na__LeSurface__Frames ? Na__LeSurface__Frames.querySelector('[data-na-viewport-id="' + CSS.escape(run.frameId) + '"]') : null;
                if (frame) frame.style.zIndex = String(depth);
                return;
            }
            Na__LeSurface__PutSlot(slot++, run.primitives, run.className + ' ' + Na__LeSurface__CLASS_SLOT, depth);
        });
        Na__LeSurface__PutSlot(slot++, Na__LeMarkup__BuildHighlightPrimitives(sheet, Na__LeModel__GetSelectionItems()),
            MARKUP + ' ' + Na__LeSurface__CLASS_MARKS + ' ' + Na__LeSurface__CLASS_SLOT, depth + 1);
        while (Na__LeSurface__Slots.length > slot) {                             // <-- Slots a fuller stack needed and this one does not
            const gone = Na__LeSurface__Slots.pop();
            if (gone && gone.el.parentNode) gone.el.parentNode.removeChild(gone.el);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Redraw the Chrome (border, title block, captions) and the Stack
    // ------------------------------------------------------------
    function Na__LeSurface__RefreshChrome() { Na__LeSurface__RefreshStack(true); }
    // ------------------------------------------------------------


    // FUNCTION | Redraw the Sheet's Own Markup (the stack, the chrome kept)
    // ------------------------------------------------------------
    function Na__LeSurface__RefreshMarkup() { Na__LeSurface__RefreshStack(false); }
    // ------------------------------------------------------------


    // FUNCTION | Fade the Sheet Back and Redraw What Is Open Over It
    // ------------------------------------------------------------
    // SketchUp's rule, on paper: while a container is open, everything outside
    // it dims and everything inside it stays as it was. The dimming is one
    // class on the paper, which fades the viewport frames, the chrome and the
    // markup together; the contents of the container are then drawn AGAIN, at
    // full strength, in a layer above the faded ones - so the vector being
    // edited is the only thing on the sheet at normal contrast, and the drawing
    // behind it is still legible enough to work against.
    //
    // Nothing else changes: the faded copy underneath is the same markup, in
    // the same place, so nothing shifts as a container opens and closes.
    // ------------------------------------------------------------
    function Na__LeSurface__RefreshScope() {
        const sheet = Na__LeSurface__Sheet;
        if (!sheet || !Na__LeSurface__Layout || !Na__LeSurface__Paper) return;
        const open  = Na__LeScope__Get();
        Na__LeSurface__Paper.classList.toggle(Na__LeSurface__CLASS_SCOPED, !!open);
        Na__LeSurface__Paper.style.setProperty('--na-le-scope-fade', String(Na__LeCfg__GetEditScopeSetup().fadeOpacity));
        if (!open) {
            if (Na__LeSurface__FocusSvg && Na__LeSurface__FocusSvg.parentNode) Na__LeSurface__FocusSvg.parentNode.removeChild(Na__LeSurface__FocusSvg);
            Na__LeSurface__FocusSvg = null;
            return;
        }
        const primitives = Na__LeMarkup__BuildItemPrimitives(sheet, Na__LeScope__Contents(sheet));
        const markup     = Na__LeChrome__ToSvgMarkup(primitives, Na__LeSurface__Layout.Page.WidthMm, Na__LeSurface__Layout.Page.HeightMm, 'na-le-paper__focus');
        Na__LeSurface__FocusSvg = Na__LeSurface__SwapSvg(Na__LeSurface__FocusSvg, markup, 'na-le-paper__focus', Na__LeSurface__Handles);
    }
    // ------------------------------------------------------------


    // FUNCTION | Redraw the Selected Viewport's Outline and Handles
    // ------------------------------------------------------------
    // With several items selected every selected viewport gets an outline and
    // nothing gets handles or grips: they edit one item, so they wait for one.
    // ------------------------------------------------------------
    function Na__LeSurface__RefreshSelection() {
        const sheet = Na__LeSurface__Sheet;
        if (!sheet || !Na__LeSurface__Paper) return;
        if (!Na__LeSurface__Handles) Na__LeSurface__Handles = Na__LeSurface__El('div', 'na-le-paper__handles', Na__LeSurface__Paper);
        const items = Na__LeModel__GetSelectionItems();
        if (items.length > 1) {
            const chosen    = new Set(items.filter((item) => item.kind === 'viewport').map((item) => item.id));
            const viewports = sheet.Sheet__Viewports.filter((v) => chosen.has(v.Viewport__Id) && Na__LeModel__IsLayerVisible(sheet, v.Viewport__LayerId));
            Na__LeSurface__Frames.querySelectorAll('.' + Na__LeSurface__CLASS_FRAME).forEach((frame) => {
                frame.classList.toggle(Na__LeSurface__CLASS_FRAME + '--selected', chosen.has(frame.getAttribute('data-na-viewport-id')));
            });
            Na__LeSurface__EditingId = null;                                     // <-- Content editing belongs to one selected viewport
            Na__LeHandles__RenderOutlines(Na__LeSurface__Handles, viewports, Na__LeSurface__Ppm, Na__LeSurface__Zoom,
                (v) => Na__LeModel__IsLayerLocked(sheet, v.Viewport__LayerId) || v.Viewport__Locked === true);
            return;
        }
        const selection = Na__LeModel__GetSelection();
        const viewport  = (selection && selection.kind === 'viewport')
            ? sheet.Sheet__Viewports.find((v) => v.Viewport__Id === selection.id) || null
            : null;
        Na__LeSurface__Frames.querySelectorAll('.' + Na__LeSurface__CLASS_FRAME).forEach((frame) => {
            frame.classList.toggle(Na__LeSurface__CLASS_FRAME + '--selected', !!viewport && frame.getAttribute('data-na-viewport-id') === viewport.Viewport__Id);
        });
        if (!viewport) {
            Na__LeSurface__EditingId = null;
            Na__LeHandles__Clear(Na__LeSurface__Handles);
            if (selection && Na__LeSurface__Editable) Na__LeGrips__Render(Na__LeSurface__Handles, sheet, selection, Na__LeSurface__Ppm, Na__LeSurface__Zoom);   // <-- Dimension and shape grips
            return;
        }
        if (!Na__LeModel__IsLayerVisible(sheet, viewport.Viewport__LayerId)) { Na__LeSurface__EditingId = null; Na__LeHandles__Clear(Na__LeSurface__Handles); return; }
        const locked = Na__LeModel__IsLayerLocked(sheet, viewport.Viewport__LayerId) || viewport.Viewport__Locked === true;
        if (Na__LeSurface__EditingId && (Na__LeSurface__EditingId !== viewport.Viewport__Id || locked)) Na__LeSurface__EditingId = null;   // <-- Content editing ends with the selection, or with a lock
        Na__LeHandles__Render(Na__LeSurface__Handles, viewport, Na__LeSurface__Ppm, Na__LeSurface__Zoom, Na__LeSurface__Editable && !locked,
            { editing : Na__LeSurface__EditingId === viewport.Viewport__Id, locked : locked });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Sheet Surface API
    // ------------------------------------------------------------
    export {
        Na__LeSurface__ZOOM_EVENT,
        Na__LeSurface__ZOOM_SETTLED_EVENT,
        Na__LeSurface__NoteZoomGesture,
        Na__LeSurface__Mount,
        Na__LeSurface__Unmount,
        Na__LeSurface__SetSheet,
        Na__LeSurface__Refresh,
        Na__LeSurface__RefreshNow,
        Na__LeSurface__SetZoom,
        Na__LeSurface__GetZoom,
        Na__LeSurface__GetPixelsPerMm,
        Na__LeSurface__ClientToPaperMm,
        Na__LeSurface__PaperMmToClient,
        Na__LeSurface__SetEditingViewport,
        Na__LeSurface__GetEditingViewport,
        Na__LeSurface__GetSheet,
        Na__LeSurface__GetLayout,
        Na__LeSurface__GetElements,
        Na__LeSurface__GetFrameBody
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
