// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DRAWING AXES OVERLAY
// =============================================================================
//
// FILE       : Na__LayoutEditor__DrawingAxes__.js
// NAMESPACE  : Na__LeAxes
// MODULE     : Layout Editor - Drawing Axes Overlay
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : SketchUp's red and green axes carried by the cursor (F9): two lines through the point under it, out to the edges of the sheet
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - WHAT IT IS. A red horizontal line and a green vertical line that cross
//   at the point under the cursor and run out to the edges of the sheet -
//   SketchUp's red and green axes, but carried by the cursor instead of
//   pinned to the origin. It answers "what lines up with this?" across the
//   whole sheet, in both directions, before anything is clicked: a wall end
//   against a window head three drawings away, a note against a dimension.
//   Adam's brief: "make this axis appear and move with the mouse and radiate
//   out to the ends of the sheet", on the next free F key (F9, after F6 Show
//   Grid, F7 Grid Snap and F8 Ortho), with a toolbar button of its own.
// - WHERE THEY CROSS. At the snap marker whenever one is on show - an
//   endpoint, a midpoint, a grid point (F7), a point held on an axis - so the
//   lines pass exactly through the point a click would place, as SketchUp's
//   axes cross at its inference point (the green dot Adam's screenshot points
//   at). With no marker, at the cursor itself. Behaviour FollowSnapMarker
//   false makes it the cursor always, AutoCAD's crosshair.
// - WHERE THEY RUN. The full width and height of the sheet - the paper's own
//   edges - and no further. Each line is drawn while its own line crosses the
//   paper, so with the cursor out on the grey desk beside the sheet the
//   horizontal one still runs across it at the cursor's height.
// - WHOLE DEVICE PIXELS AT ANY ZOOM. The lines live on the paper, in paper
//   millimetres, so a pan carries them with the sheet and a wheel zoom (which
//   keeps the point under the cursor still) keeps them on the cursor. Their
//   width is taken back out of the paper's scale, and their edges are put on
//   device pixel boundaries, so each is solid ink one pixel wide rather than
//   two half-tones - the same rule the drawing grid draws to.
// - DRAWN BY THE COMPOSITOR, NOT THE PAPER. Each line is a layer of its own
//   and is only ever moved by a transform, so following the cursor never makes
//   the browser paint the sheet under it again: on a heavy sheet a strip the
//   width of the paper repainted on every move would be the whole cost. A move
//   costs one read of the paper's position and two style writes.
// - WHEN THEY SHOW. Only while the pointer is over the sheet's stage (or
//   carrying something across it), never for a finger (a touch has no hover),
//   and not at all until F9 or the button switches them on. Over a panel, the
//   toolbar or the Measurements box they are hidden.
// - NEVER PRINTED. The PDF is drawn from the sheet's primitives and never reads
//   the screen, and nothing here is a primitive, so nothing can reach a PDF, a
//   saved sheet or the browser draft. Attached with the sheet tools, so the
//   web viewer - which never attaches them - never draws it.
// - REMEMBERED IN THIS BROWSER, like Ortho (F8) and Snap (F3): a way of looking
//   at the sheet, not part of it.
//
// INTEGRATION:
// - Na__LayoutEditor__ModeController__ calls Attach and Detach with the sheet
//   input, straight after the drawing grid.
// - Na__LayoutEditor__SheetTools__Keyboard__ runs Toggle on View__AxesToggle
//   (F9, Na__Hotkeys__DrawingTabs__.json); Na__LayoutEditor__Toolbar__ has
//   the Axes button, lit while it is on, and re-syncs on
//   Na__LeAxes__CHANGED_EVENT.
// - Where the snap marker is comes from Na__LeOsnap__GetMarkerPoint (the object
//   snap folder's marker unit), read after the sheet tools have handled the
//   same pointer move: the tools listen on the stage, this listens on window.
// - The stylesheet (Na__LayoutEditor__Styles__DrawingAxes__.css) stacks the
//   layer over the drawings and under the handles, and colours the lines from
//   the custom properties this module sets from the config.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: the config, Set and Toggle with their echo and the
//   remembered flag, and the overlay - two compositor layers on the paper,
//   crossing at the snap marker or the cursor, clipped to the sheet, one
//   device pixel wide at any zoom.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Surface It Draws On, the Model, the Echo Line and the Snap Marker
    // ------------------------------------------------------------
    import {
        Na__LeSurface__ZOOM_EVENT,
        Na__LeSurface__ZOOM_SETTLED_EVENT,
        Na__LeSurface__GetElements,
        Na__LeSurface__GetLayout,
        Na__LeSurface__GetZoom,
        Na__LeSurface__GetPixelsPerMm,
        Na__LeSurface__ClientToPaperMm
    } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeModel__CHANGED_EVENT } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeMeasure__Say } from '../30__System__SheetTools/Na__LayoutEditor__Measurements__.js';
    import { Na__LeOsnap__GetMarkerPoint } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Marker__.js';   // <-- Where a click would land, while a snap is showing
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Config, the Event, Where the Flag Is Remembered, and the Classes
    // ------------------------------------------------------------
    const Na__LeAxes__ConfigUrl     = new URL('./Na__LayoutEditor__DrawingAxes__Config__.json', import.meta.url);
    const Na__LeAxes__PREFIX        = 'LayoutEditor__DrawingAxes__';
    const Na__LeAxes__CHANGED_EVENT = 'na-layouteditor-drawing-axes-changed';   // <-- detail { enabled }
    const Na__LeAxes__STORE_KEY     = 'na-layouteditor-drawing-axes';           // <-- '1' on, '0' off; absent = off
    const Na__LeAxes__LAYER_CLASS   = 'na-le-axes';
    const Na__LeAxes__LINE_CLASS    = 'na-le-axes__line';
    const Na__LeAxes__PANNING_CLASS = 'na-le-stage--panning';                   // <-- The PC and touch controls' mark on the stage while a pan is in flight
    const Na__LeAxes__EPSILON_MM    = 1e-6;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Display and Behaviour, Should the Config Not Load
    // ------------------------------------------------------------
    const Na__LeAxes__DISPLAY = Object.freeze({
        HorizontalColour : '#ff0000',     // <-- SketchUp's red axis
        VerticalColour   : '#00a000',     // <-- SketchUp's green axis, darkened to read on white paper
        LineWidthPx      : 1,
        Opacity          : 1
    });
    const Na__LeAxes__LIMITS = Object.freeze({ LineWidthPx : [ 0.5, 4 ], Opacity : [ 0.1, 1 ] });
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Config, the Flag, the Overlay and the Pointer
    // ------------------------------------------------------------
    let Na__LeAxes__Config   = null;
    let Na__LeAxes__Loading  = null;
    let Na__LeAxes__Look     = Na__LeAxes__DISPLAY;   // <-- The display settings in force: the built-in ones until the config lands
    let Na__LeAxes__On       = null;      // <-- null until first asked, then read from this browser
    let Na__LeAxes__Attached = false;
    let Na__LeAxes__Stage    = null;      // <-- The stage whose scroll and pointer it follows
    let Na__LeAxes__Layer    = null;      // <-- The overlay: one box on the paper holding the two lines
    let Na__LeAxes__LineH    = null;      // <-- Along the sheet's width: red
    let Na__LeAxes__LineV    = null;      // <-- Along the sheet's height: green
    let Na__LeAxes__Pointer  = null;      // <-- { x, y (client px), inside, touch } of the last pointer event
    let Na__LeAxes__Crossing = null;      // <-- { x, y (paper mm), horizontal, vertical, snapped } as last drawn, or null while hidden
    const Na__LeAxes__Handlers = {};
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Block of the Config, a Value From It, and a Label
    // ------------------------------------------------------------
    function Na__LeAxes__Block(name) {
        const block = Na__LeAxes__Config ? Na__LeAxes__Config[Na__LeAxes__PREFIX + name] : null;
        return (block && typeof block === 'object' && !Array.isArray(block)) ? block : {};
    }
    function Na__LeAxes__Value(block, key, fallback) {
        const value = Na__LeAxes__Block(block)[block + '__' + key];
        if (typeof fallback === 'boolean') return (typeof value === 'boolean') ? value : fallback;
        return (typeof value === 'string' && value !== '') ? value : fallback;
    }
    function Na__LeAxes__Label(key, fallback) {
        return Na__LeAxes__Value('Labels', key, fallback);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Display Settings, Each Checked and Held to Its Range
    // ------------------------------------------------------------
    function Na__LeAxes__Display() {
        const block  = Na__LeAxes__Block('Display');
        const out    = Object.assign({}, Na__LeAxes__DISPLAY);
        const colour = (value) => typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim());
        if (colour(block.Display__HorizontalColour)) out.HorizontalColour = block.Display__HorizontalColour.trim();
        if (colour(block.Display__VerticalColour))   out.VerticalColour   = block.Display__VerticalColour.trim();
        Object.keys(Na__LeAxes__LIMITS).forEach((key) => {
            const value = block['Display__' + key];
            const range = Na__LeAxes__LIMITS[key];
            if (Number.isFinite(value)) out[key] = Math.min(range[1], Math.max(range[0], value));
        });
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Fetch the Config Once, Then Colour the Lines From It
    // ------------------------------------------------------------
    // Never rejects. A missing file leaves every reader on its fallback -
    // SketchUp's colours and English words - so F9 still works.
    // ------------------------------------------------------------
    function Na__LeAxes__Ready() {
        if (!Na__LeAxes__Loading) {
            Na__LeAxes__Loading = (async () => {
                try {
                    const response = await fetch(Na__LeAxes__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeAxes__Config = await response.json();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Drawing axes config unavailable - the built-in settings are used.', error);
                    Na__LeAxes__Config = null;
                }
                Na__LeAxes__Look = Na__LeAxes__Display();                    // <-- Worked out once here, not on every pointer move
                if (Na__LeAxes__Layer) Na__LeAxes__ApplyDisplay(Na__LeAxes__Layer);
                window.dispatchEvent(new CustomEvent(Na__LeAxes__CHANGED_EVENT, { detail : { enabled : Na__LeAxes__IsOn(), reason : 'config' } }));   // <-- The toolbar's words can land after it was built
                Na__LeAxes__PlaceNow();
                return Na__LeAxes__Config;
            })();
        }
        return Na__LeAxes__Loading;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Switching the Axes On and Off
// -----------------------------------------------------------------------------

    // FUNCTION | Are the Axes On (read from this browser the first time)
    // ------------------------------------------------------------
    function Na__LeAxes__IsOn() {
        if (Na__LeAxes__On === null) {
            let stored = null;
            try { stored = window.localStorage.getItem(Na__LeAxes__STORE_KEY); } catch (error) { stored = null; }
            Na__LeAxes__On = stored === '1';
        }
        return Na__LeAxes__On;
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch the Axes On or Off: F9, and the Toolbar's Button
    // ------------------------------------------------------------
    // A view, not a tool: the tool, the selection and a point half placed are
    // left alone, so F9 can be pressed in the middle of drawing a line. Shown
    // at once where the pointer last was, if that was over the sheet (a click
    // on the toolbar button leaves them hidden until the pointer comes back).
    // Remembered in this browser, echoed on the line above the Measurements
    // box as F6, F7 and F8 are, and announced for the toolbar. Returns the
    // state.
    // ------------------------------------------------------------
    function Na__LeAxes__Set(flag) {
        const want = flag === true;
        if (want === Na__LeAxes__IsOn()) return want;
        Na__LeAxes__On = want;
        try { window.localStorage.setItem(Na__LeAxes__STORE_KEY, want ? '1' : '0'); } catch (error) { /* storage unavailable: the flag still works for this session */ }
        console.log('[TrueVision3D LayoutEditor] ' + (want
            ? Na__LeAxes__Label('ConsoleOn', 'Drawing Axes Overlay on (F9): a red horizontal and a green vertical line follow the cursor to the edges of the sheet.')
            : Na__LeAxes__Label('ConsoleOff', 'Drawing Axes Overlay off (F9).')));
        if (Na__LeAxes__Value('Behaviour', 'EchoOnSwitch', true)) {
            Na__LeMeasure__Say(want ? Na__LeAxes__Label('EchoOn', '<Drawing axes on>') : Na__LeAxes__Label('EchoOff', '<Drawing axes off>'));
        }
        Na__LeAxes__PlaceNow();
        window.dispatchEvent(new CustomEvent(Na__LeAxes__CHANGED_EVENT, { detail : { enabled : want } }));
        return want;
    }
    function Na__LeAxes__Toggle() {
        return Na__LeAxes__Set(!Na__LeAxes__IsOn());
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Overlay
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Colour the Lines: the Config's Values, as Custom Properties the Stylesheet Reads
    // ------------------------------------------------------------
    function Na__LeAxes__ApplyDisplay(layer) {
        const display = Na__LeAxes__Look;
        layer.style.setProperty('--na-le-axes-horizontal', display.HorizontalColour);
        layer.style.setProperty('--na-le-axes-vertical', display.VerticalColour);
        layer.style.setProperty('--na-le-axes-opacity', String(display.Opacity));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Layer and Its Two Lines, on the Current Paper, Under the Handles
    // ------------------------------------------------------------
    // The paper is built again whenever the editor mounts, so the layer is put
    // back on whichever paper is there each time it is placed. It goes in
    // before the handles layer, at the handles' own depth, so the snap marker
    // and the selection handles are always drawn over the axes and everything
    // else on the sheet under them. Anywhere before the handles will do (the
    // grid's canvas may come between), so a layer already in order is never
    // moved: moving it on every pointer move would rebuild its layer each time.
    // ------------------------------------------------------------
    function Na__LeAxes__Precedes(first, second) {
        for (let node = first.nextSibling; node; node = node.nextSibling) if (node === second) return true;
        return false;
    }
    function Na__LeAxes__EnsureLayer(paper, handles) {
        if (!Na__LeAxes__Layer) {
            const line = (modifier) => {
                const el = document.createElement('div');
                el.className = Na__LeAxes__LINE_CLASS + ' ' + Na__LeAxes__LINE_CLASS + '--' + modifier;
                return el;
            };
            Na__LeAxes__Layer = document.createElement('div');
            Na__LeAxes__Layer.className = Na__LeAxes__LAYER_CLASS;
            Na__LeAxes__Layer.setAttribute('aria-hidden', 'true');
            Na__LeAxes__Layer.hidden = true;
            Na__LeAxes__LineH = line('horizontal');
            Na__LeAxes__LineV = line('vertical');
            Na__LeAxes__Layer.appendChild(Na__LeAxes__LineH);
            Na__LeAxes__Layer.appendChild(Na__LeAxes__LineV);
            Na__LeAxes__ApplyDisplay(Na__LeAxes__Layer);
        }
        const layer   = Na__LeAxes__Layer;
        const onPaper = !!handles && handles.parentNode === paper;
        if (layer.parentNode !== paper || (onPaper && !Na__LeAxes__Precedes(layer, handles))) {
            if (onPaper) paper.insertBefore(layer, handles);
            else paper.appendChild(layer);                                   // <-- No handles yet: they are made later, and so land after it
        }
        return layer;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hide Both Lines
    // ------------------------------------------------------------
    function Na__LeAxes__Hide() {
        if (Na__LeAxes__Layer) Na__LeAxes__Layer.hidden = true;
        Na__LeAxes__Crossing = null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where the Axes Cross, in Paper Millimetres
    // ------------------------------------------------------------
    // The snap marker while one is on show (Behaviour FollowSnapMarker), else
    // the point under the cursor. Not the marker during a pan: the tools stop
    // working out their snaps while the paper is being dragged, so a marker
    // then is left over from before it, and the cursor is what the paper is
    // moving with. Returns { x, y, snapped } or null.
    // ------------------------------------------------------------
    function Na__LeAxes__CrossingPoint(stage) {
        const panning = !!(stage && stage.classList && stage.classList.contains(Na__LeAxes__PANNING_CLASS));
        if (!panning && Na__LeAxes__Value('Behaviour', 'FollowSnapMarker', true)) {
            const marker = Na__LeOsnap__GetMarkerPoint();
            if (marker && Number.isFinite(marker.x) && Number.isFinite(marker.y)) return { x : marker.x, y : marker.y, snapped : true };
        }
        const pointer = Na__LeAxes__Pointer;
        const point   = pointer ? Na__LeSurface__ClientToPaperMm(pointer.x, pointer.y) : null;
        return (point && Number.isFinite(point.x) && Number.isFinite(point.y)) ? { x : point.x, y : point.y, snapped : false } : null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Two Lines Where They Belong Now
    // ------------------------------------------------------------
    // Everything is decided afresh from the pointer, the marker, the paper's
    // position and the zoom, so it can be called from anything that might
    // have moved one of them. Each line is 1 px along its short side,
    // stretched to its width by the same transform that places it: in paper
    // pixels that is t / (dpr x zoom) for t device pixels of ink, which the
    // paper's own scale turns back into exactly t. The edge nearest the point
    // is put on a device pixel boundary, centred on the point as closely as
    // whole pixels allow. Returns true when a line is on show.
    // ------------------------------------------------------------
    function Na__LeAxes__PlaceNow() {
        const pointer = Na__LeAxes__Pointer;
        const touchOk = Na__LeAxes__Value('Behaviour', 'ShowForTouch', false);
        if (!Na__LeAxes__Attached || !Na__LeAxes__IsOn() || !pointer || !pointer.inside || (pointer.touch && !touchOk)) { Na__LeAxes__Hide(); return false; }
        const els    = Na__LeSurface__GetElements();
        const layout = Na__LeSurface__GetLayout();
        if (!els.paper || els.paper.hidden || !layout || !layout.Page) { Na__LeAxes__Hide(); return false; }
        const zoom  = Na__LeSurface__GetZoom();
        const ppm   = Na__LeSurface__GetPixelsPerMm();
        const scale = ppm * zoom;                                            // <-- Screen pixels per paper millimetre
        const point = Na__LeAxes__CrossingPoint(els.stage);
        if (!(scale > 0) || !point) { Na__LeAxes__Hide(); return false; }

        const widthMm    = layout.Page.WidthMm, heightMm = layout.Page.HeightMm;
        const e          = Na__LeAxes__EPSILON_MM;
        const horizontal = point.y >= -e && point.y <= heightMm + e;         // <-- Each line only while it crosses the sheet
        const vertical   = point.x >= -e && point.x <= widthMm + e;
        if (!horizontal && !vertical) { Na__LeAxes__Hide(); return false; }

        const layer = Na__LeAxes__EnsureLayer(els.paper, els.handles);
        const rect  = els.paper.getBoundingClientRect();
        const dpr   = (Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0) ? window.devicePixelRatio : 1;
        const ink   = Math.max(1, Math.round(Na__LeAxes__Look.LineWidthPx * dpr));   // <-- Whole device pixels of ink
        const thick = ink / (dpr * zoom);                                    // <-- ...in paper pixels, before the paper's scale
        if (horizontal) {
            const row = Math.round(((rect.top + (point.y * scale)) * dpr) - (ink / 2));   // <-- The first device row the line covers
            const top = ((row / dpr) - rect.top) / zoom;
            Na__LeAxes__LineH.style.transform = 'translate(0px, ' + top + 'px) scale(1, ' + thick + ')';
        }
        if (vertical) {
            const column = Math.round(((rect.left + (point.x * scale)) * dpr) - (ink / 2));
            const left   = ((column / dpr) - rect.left) / zoom;
            Na__LeAxes__LineV.style.transform = 'translate(' + left + 'px, 0px) scale(' + thick + ', 1)';
        }
        Na__LeAxes__LineH.hidden = !horizontal;
        Na__LeAxes__LineV.hidden = !vertical;
        layer.hidden = false;
        Na__LeAxes__Crossing = { x : point.x, y : point.y, horizontal : horizontal, vertical : vertical, snapped : point.snapped };
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Where the Axes Last Crossed (for the tests and the console), or Null While Hidden
    // ------------------------------------------------------------
    function Na__LeAxes__GetCrossing() {
        return Na__LeAxes__Crossing ? Object.assign({}, Na__LeAxes__Crossing) : null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Attach and Detach With the Sheet
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This Pointer Event Over the Sheet's Stage
    // ------------------------------------------------------------
    // Its target is the stage or inside it - which includes a press the stage
    // has captured while something is carried across a panel. A panel, the
    // toolbar, the Measurements box or a menu over the stage is not.
    // ------------------------------------------------------------
    function Na__LeAxes__OverStage(event) {
        const stage  = Na__LeAxes__Stage;
        const target = event ? event.target : null;
        if (!stage || !target) return false;
        return target === stage || (typeof stage.contains === 'function' && typeof target === 'object' && stage.contains(target));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Follow the Stage's Scroll and Pointer (the editor mounts a new stage each build)
    // ------------------------------------------------------------
    // A new stage forgets the pointer: whether it was over the old one says
    // nothing about the new one, so nothing shows until it is next seen.
    // ------------------------------------------------------------
    function Na__LeAxes__FollowStage() {
        const stage = Na__LeSurface__GetElements().stage || null;
        if (stage === Na__LeAxes__Stage) return;
        if (Na__LeAxes__Stage) {
            Na__LeAxes__Stage.removeEventListener('scroll', Na__LeAxes__Handlers.view);
            Na__LeAxes__Stage.removeEventListener('pointerleave', Na__LeAxes__Handlers.leave);
        }
        Na__LeAxes__Stage   = stage;
        Na__LeAxes__Pointer = null;
        if (stage) {
            stage.addEventListener('scroll', Na__LeAxes__Handlers.view, { passive : true });
            stage.addEventListener('pointerleave', Na__LeAxes__Handlers.leave);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Start Following the Pointer for the Sheet on Screen (with the sheet tools)
    // ------------------------------------------------------------
    // Idempotent: the mode controller attaches the sheet input on every entry.
    // The pointer is heard on window in the bubble phase, so the sheet tools -
    // which listen on the stage - have already moved the snap marker for the
    // same move by the time the axes read it. Keys are heard the same way: a
    // Shift, an arrow key lock, F3, F7 or F8 can each move the marker without
    // the pointer moving. A zoom, a pan, a resize or a sheet change moves the
    // paper under a still cursor, so each places the axes again.
    // ------------------------------------------------------------
    function Na__LeAxes__Attach() {
        if (!Na__LeAxes__Handlers.pointer) {
            Na__LeAxes__Handlers.pointer = (event) => {
                Na__LeAxes__Pointer = { x : event.clientX, y : event.clientY, inside : Na__LeAxes__OverStage(event), touch : event.pointerType === 'touch' };
                Na__LeAxes__PlaceNow();
            };
            Na__LeAxes__Handlers.leave = () => {                             // <-- Off the stage: onto a panel, the toolbar, a menu, or out of the window
                if (Na__LeAxes__Pointer) Na__LeAxes__Pointer.inside = false;
                Na__LeAxes__PlaceNow();
            };
            Na__LeAxes__Handlers.key  = () => { if (Na__LeAxes__Crossing || (Na__LeAxes__Pointer && Na__LeAxes__Pointer.inside)) Na__LeAxes__PlaceNow(); };
            Na__LeAxes__Handlers.view = () => { if (Na__LeAxes__Crossing || (Na__LeAxes__Pointer && Na__LeAxes__Pointer.inside)) Na__LeAxes__PlaceNow(); };
        }
        if (!Na__LeAxes__Attached) {
            Na__LeAxes__Attached = true;
            [ 'pointermove', 'pointerdown', 'pointerup' ].forEach((name) => window.addEventListener(name, Na__LeAxes__Handlers.pointer));
            [ 'keydown', 'keyup' ].forEach((name) => window.addEventListener(name, Na__LeAxes__Handlers.key));
            [ Na__LeSurface__ZOOM_EVENT, Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeModel__CHANGED_EVENT, 'resize' ].forEach((name) => window.addEventListener(name, Na__LeAxes__Handlers.view));
        }
        Na__LeAxes__FollowStage();
        Na__LeAxes__PlaceNow();                                              // <-- Another drawing on the same stage (Page Down under a still cursor): straight onto it
        void Na__LeAxes__Ready();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop Following It (a document tab, the 3D Model tab)
    // ------------------------------------------------------------
    function Na__LeAxes__Detach() {
        if (Na__LeAxes__Attached) {
            [ 'pointermove', 'pointerdown', 'pointerup' ].forEach((name) => window.removeEventListener(name, Na__LeAxes__Handlers.pointer));
            [ 'keydown', 'keyup' ].forEach((name) => window.removeEventListener(name, Na__LeAxes__Handlers.key));
            [ Na__LeSurface__ZOOM_EVENT, Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeModel__CHANGED_EVENT, 'resize' ].forEach((name) => window.removeEventListener(name, Na__LeAxes__Handlers.view));
        }
        Na__LeAxes__Attached = false;
        if (Na__LeAxes__Stage) {
            Na__LeAxes__Stage.removeEventListener('scroll', Na__LeAxes__Handlers.view);
            Na__LeAxes__Stage.removeEventListener('pointerleave', Na__LeAxes__Handlers.leave);
        }
        Na__LeAxes__Stage   = null;
        Na__LeAxes__Pointer = null;
        Na__LeAxes__Hide();
        return true;
    }
    // ------------------------------------------------------------

    // THE CONFIG IS ASKED FOR AS THE EDITOR LOADS, so the toolbar's words and
    // the colours are in before the first key. Never rejects.
    void Na__LeAxes__Ready();

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Drawing Axes Overlay API
    // ------------------------------------------------------------
    export {
        Na__LeAxes__CHANGED_EVENT,
        Na__LeAxes__Ready,
        Na__LeAxes__Label,
        Na__LeAxes__IsOn,
        Na__LeAxes__Set,
        Na__LeAxes__Toggle,
        Na__LeAxes__PlaceNow,
        Na__LeAxes__GetCrossing,
        Na__LeAxes__Attach,
        Na__LeAxes__Detach
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
