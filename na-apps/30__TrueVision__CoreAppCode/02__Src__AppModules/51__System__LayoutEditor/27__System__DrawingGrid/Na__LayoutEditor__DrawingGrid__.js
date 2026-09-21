// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DRAWING GRID
// =============================================================================
//
// FILE       : Na__LayoutEditor__DrawingGrid__.js
// NAMESPACE  : Na__LeGrid
// MODULE     : Layout Editor - Drawing Grid
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : SketchUp LayOut's grid on the paper: Show Grid (F6) draws it, Grid Snap (F7) puts every point on it
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - WHAT IT IS. A major grid cut into minor subdivisions - 10 mm into 10 by
//   default, so a point every millimetre and a heavier one every 10 - drawn
//   over the whole paper as points (dots) or as lines, and snapped to by
//   every point placed or dragged while Grid Snap is on. The settings are
//   LayOut's Document Setup > Grid, one for one, in Document Preferences >
//   Drawing Grid; Show Grid and Grid Snap are LayOut's two separate
//   switches, on the keys Adam's own LayOut has them on (F6 and F7).
// - DRAWN AT THE SCREEN'S OWN RESOLUTION, NOT THE PAPER'S. One canvas sits
//   on the paper, sized to the part of the paper in view (plus an overdraw
//   margin), and is sized in paper pixels divided by the zoom, so after the
//   paper's own scale it lands one canvas pixel to one device pixel: every
//   point is the same crisp size at any zoom. A million-point grid is never
//   built - only the points in view are drawn, a row at a time from a strip
//   drawn once, so a redraw costs about a millisecond.
// - WHEN IT IS DRAWN AGAIN. When a zoom settles (Na__LeSurface__
//   ZOOM_SETTLED_EVENT, as everything that follows the zoom is); when a pan
//   or a zoom-out step leaves part of the view uncovered; when the window,
//   the paper or a setting changes. During a zoom gesture the canvas simply
//   scales with the paper, as the handles do, and is drawn crisp once the
//   zoom rests.
// - THE MINOR GRID GIVES WAY WHEN IT WOULD BE A HAZE. Zoomed out, a 1 mm grid
//   is closer than a few pixels and would read as grey paper, so it is left
//   out below Display MinMinorSpacingPx and comes back as the sheet is zoomed
//   in. The snap does not change with the zoom: it is the grid, not the
//   picture of it.
// - NEVER PRINTED. The PDF is drawn from the sheet's own primitives and never
//   reads the screen, and the canvas is not a primitive, so nothing here can
//   reach a PDF, an export or a saved sheet. LayOut's Print Grid is therefore
//   the one option not offered.
// - THE GRID IS AN EDITOR'S AID. It is attached with the sheet tools (the
//   mode controller's AttachSheetInput), so the web viewer - which never
//   attaches them - never draws it.
//
// INTEGRATION:
// - The state and the snap arithmetic live in Na__LayoutEditor__DrawingGrid__State__
//   (a leaf), which Na__LayoutEditor__Snapping__ reads for the grid snap.
//   // @delegate: ./Na__LayoutEditor__DrawingGrid__State__.js
// - Na__LayoutEditor__ModeController__ calls Attach and Detach with the sheet
//   input, and registers the Drawing Grid section
//   (Na__LayoutEditor__Panel__DrawingGrid__).
// - Na__LayoutEditor__SheetTools__Keyboard__ runs ToggleShow on
//   View__GridToggle (F6) and ToggleSnap on Snap__GridToggle (F7);
//   Na__LayoutEditor__Toolbar__ has a Grid and a Grid Snap button.
// - The stylesheet (Na__LayoutEditor__Styles__DrawingGrid__.css) places the
//   canvas over or under the drawings and draws the grid snap marker.
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
// - Initial implementation: the config, Show Grid and Grid Snap with their
//   echoes, the panel's changes and Reset, and the overlay - points or
//   lines, major and minor, clipped to the margins or not, over or under the
//   drawings - drawn at device resolution for the part of the paper in view.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Grid's State, the Surface It Draws On, the Model and the Echo Line
    // ------------------------------------------------------------
    import {
        Na__LeGrid__CHANGED_EVENT,
        Na__LeGrid__TYPE_LINES,
        Na__LeGrid__Get,
        Na__LeGrid__GetLimits,
        Na__LeGrid__AssignDefaults,
        Na__LeGrid__Assign,
        Na__LeGrid__Reset,
        Na__LeGrid__IsShowing,
        Na__LeGrid__IsSnapping,
        Na__LeGrid__MinorMm
    } from './Na__LayoutEditor__DrawingGrid__State__.js';
    import {
        Na__LeSurface__ZOOM_EVENT,
        Na__LeSurface__ZOOM_SETTLED_EVENT,
        Na__LeSurface__GetElements,
        Na__LeSurface__GetLayout,
        Na__LeSurface__GetZoom,
        Na__LeSurface__GetPixelsPerMm
    } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeModel__CHANGED_EVENT } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import { Na__LeMeasure__Say } from '../30__System__SheetTools/Na__LayoutEditor__Measurements__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where the Config Is, Its Prefix, and the Canvas Classes
    // ------------------------------------------------------------
    const Na__LeGrid__ConfigUrl    = new URL('./Na__LayoutEditor__DrawingGrid__Config__.json', import.meta.url);
    const Na__LeGrid__PREFIX       = 'LayoutEditor__DrawingGrid__';
    const Na__LeGrid__CANVAS_CLASS = 'na-le-grid';
    const Na__LeGrid__UNDER_CLASS  = 'na-le-grid--under';       // <-- Draw grid on top is off: on the paper, under the drawings
    const Na__LeGrid__EPSILON_MM   = 1e-6;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Display, Should the Config Not Load
    // ------------------------------------------------------------
    const Na__LeGrid__DISPLAY = Object.freeze({
        MinMinorSpacingPx : 6,
        MinMajorSpacingPx : 6,
        MajorPointPx      : 2.5,
        MinorPointPx      : 1.5,
        MajorLinePx       : 1,
        MinorLinePx       : 1,
        MinorLineDashPx   : [ 1, 2 ],
        OverdrawPx        : 160
    });
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Config, the Overlay and What It Covers
    // ------------------------------------------------------------
    let Na__LeGrid__Config    = null;
    let Na__LeGrid__Loading   = null;
    let Na__LeGrid__Canvas    = null;     // <-- The overlay: one canvas on the paper, sized to the view
    let Na__LeGrid__Attached  = false;
    let Na__LeGrid__Stage     = null;     // <-- The stage whose scroll it follows
    let Na__LeGrid__Frame     = 0;        // <-- The animation frame a draw is booked on
    let Na__LeGrid__Forced    = false;    // <-- The booked draw must happen, covered or not
    let Na__LeGrid__Covered   = null;     // <-- { x0, y0, x1, y1 (paper mm), key } of the last draw
    const Na__LeGrid__Handlers = {};
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch the Config Once, and Hand Its Defaults and Limits to the State
    // ------------------------------------------------------------
    // Never rejects. A missing file leaves every reader on its fallback, so the
    // grid still works with the built-in settings.
    // ------------------------------------------------------------
    function Na__LeGrid__Ready() {
        if (!Na__LeGrid__Loading) {
            Na__LeGrid__Loading = (async () => {
                try {
                    const response = await fetch(Na__LeGrid__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeGrid__Config = await response.json();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Drawing grid config unavailable - the built-in settings are used.', error);
                    Na__LeGrid__Config = null;
                }
                Na__LeGrid__AssignDefaults(Na__LeGrid__Unprefix('Defaults'), Na__LeGrid__Unprefix('Limits'));
                if (document.body) document.body.style.setProperty('--na-le-grid-marker-scale', String(Na__LeGrid__MarkerScale()));   // <-- The grid snap ring's size, for the stylesheet
                window.dispatchEvent(new CustomEvent(Na__LeGrid__CHANGED_EVENT, { detail : { settings : Na__LeGrid__Get(), reason : 'config' } }));
                Na__LeGrid__Schedule(true);
                return Na__LeGrid__Config;
            })();
        }
        return Na__LeGrid__Loading;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Block of the Config, as Written
    // ------------------------------------------------------------
    function Na__LeGrid__Block(name) {
        const block = Na__LeGrid__Config ? Na__LeGrid__Config[Na__LeGrid__PREFIX + name] : null;
        return (block && typeof block === 'object' && !Array.isArray(block)) ? block : {};
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Block With Its Key Prefix Taken Off ("Defaults__Show" -> "Show")
    // ------------------------------------------------------------
    function Na__LeGrid__Unprefix(name) {
        const block = Na__LeGrid__Block(name);
        const out   = {};
        Object.keys(block).forEach((key) => {
            const at = key.indexOf('__');
            if (at !== -1) out[key.slice(at + 2)] = block[key];
        });
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Label, and the Display Settings
    // ------------------------------------------------------------
    function Na__LeGrid__Label(key, fallback) {
        const value = Na__LeGrid__Block('Labels')['Labels__' + key];
        return (typeof value === 'string' && value !== '') ? value : fallback;
    }
    function Na__LeGrid__Display() {
        const block = Na__LeGrid__Unprefix('Display');
        const out   = Object.assign({}, Na__LeGrid__DISPLAY);
        Object.keys(Na__LeGrid__DISPLAY).forEach((key) => {
            const value = block[key];
            if (key === 'MinorLineDashPx') {
                if (Array.isArray(value) && value.length === 2 && value.every((n) => Number.isFinite(n) && n > 0)) out[key] = value.slice();
                return;
            }
            if (Number.isFinite(value) && value >= 0) out[key] = value;
        });
        return out;
    }
    function Na__LeGrid__MarkerScale() {
        const value = Na__LeGrid__Block('Snap').Snap__MarkerScale;
        return (Number.isFinite(value) && value > 0 && value <= 1) ? value : 0.6;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Switching and Setting
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Write Settings, Announce Them and Draw Again
    // ------------------------------------------------------------
    function Na__LeGrid__Apply(patch, reason) {
        const settings = Na__LeGrid__Assign(patch);
        window.dispatchEvent(new CustomEvent(Na__LeGrid__CHANGED_EVENT, { detail : { settings : settings, reason : reason || 'change' } }));
        Na__LeGrid__Schedule(true);
        return settings;
    }
    // ------------------------------------------------------------


    // FUNCTION | Show Grid: F6, and the Toolbar's Grid Button
    // ------------------------------------------------------------
    // A view, not a tool: the tool, the selection and a point half placed are
    // left alone. The Measurements box echoes it, as AutoCAD's command line
    // echoes a drafting aid. Returns the new state.
    // ------------------------------------------------------------
    function Na__LeGrid__SetShow(flag) {
        const on = Na__LeGrid__Apply({ Show : flag === true }, 'show').Show;
        Na__LeMeasure__Say(on ? Na__LeGrid__Label('SayShowOn', '<Grid on>') : Na__LeGrid__Label('SayShowOff', '<Grid off>'));
        return on;
    }
    function Na__LeGrid__ToggleShow() {
        return Na__LeGrid__SetShow(!Na__LeGrid__IsShowing());
    }
    // ------------------------------------------------------------


    // FUNCTION | Grid Snap: F7, and the Toolbar's Grid Snap Button
    // ------------------------------------------------------------
    // Works with the grid shown or hidden, as LayOut's does: the two are
    // separate switches there too. Returns the new state.
    // ------------------------------------------------------------
    function Na__LeGrid__SetSnap(flag) {
        const on = Na__LeGrid__Apply({ Snap : flag === true }, 'snap').Snap;
        Na__LeMeasure__Say(on ? Na__LeGrid__Label('SaySnapOn', '<Grid snap on>') : Na__LeGrid__Label('SaySnapOff', '<Grid snap off>'));
        return on;
    }
    function Na__LeGrid__ToggleSnap() {
        return Na__LeGrid__SetSnap(!Na__LeGrid__IsSnapping());
    }
    // ------------------------------------------------------------


    // FUNCTION | A Change From the Drawing Grid Panel, and Its Reset
    // ------------------------------------------------------------
    function Na__LeGrid__Update(patch) {
        return Na__LeGrid__Apply(patch, 'panel');
    }
    function Na__LeGrid__ResetSettings() {
        const settings = Na__LeGrid__Reset();
        window.dispatchEvent(new CustomEvent(Na__LeGrid__CHANGED_EVENT, { detail : { settings : settings, reason : 'reset' } }));
        Na__LeGrid__Schedule(true);
        return settings;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Overlay: Where It Goes
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Canvas, on the Current Paper, Under the Handles
    // ------------------------------------------------------------
    // The paper is built again whenever the editor mounts, so the canvas is
    // put back on whichever paper is there each time it is drawn. It goes in
    // before the handles layer, so the selection handles and the snap marker
    // are always drawn over the grid; its z-index (the stylesheet) puts it
    // over the drawings or under them.
    // ------------------------------------------------------------
    function Na__LeGrid__EnsureCanvas(paper, handles) {
        if (!Na__LeGrid__Canvas) {
            Na__LeGrid__Canvas = document.createElement('canvas');
            Na__LeGrid__Canvas.className = Na__LeGrid__CANVAS_CLASS;
            Na__LeGrid__Canvas.setAttribute('aria-hidden', 'true');
        }
        const canvas = Na__LeGrid__Canvas;
        if (canvas.parentNode !== paper) {
            if (handles && handles.parentNode === paper) paper.insertBefore(canvas, handles);
            else paper.appendChild(canvas);
        }
        return canvas;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hide the Canvas and Forget What It Covered
    // ------------------------------------------------------------
    function Na__LeGrid__Hide() {
        if (Na__LeGrid__Canvas) Na__LeGrid__Canvas.hidden = true;
        Na__LeGrid__Covered = null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Part of the Paper the Grid Is Drawn Over, in Paper Millimetres
    // ------------------------------------------------------------
    // The whole page, or the border's rectangle when Clip grid to page
    // margins is ticked.
    // ------------------------------------------------------------
    function Na__LeGrid__Bounds(layout, settings) {
        if (settings.ClipToMargins && layout.Content) return { x0 : layout.Content.X, y0 : layout.Content.Y, x1 : layout.Content.X + layout.Content.WidthMm, y1 : layout.Content.Y + layout.Content.HeightMm };
        return { x0 : 0, y0 : 0, x1 : layout.Page.WidthMm, y1 : layout.Page.HeightMm };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The View on the Paper Right Now
    // ------------------------------------------------------------
    // Returns { paperRect, stageRect, scale (screen px per paper mm), bounds,
    // view (the paper mm in view, inside the bounds, or null), key (what the
    // picture depends on) } - or null with nothing to draw on.
    // ------------------------------------------------------------
    function Na__LeGrid__View(settings, overdrawPx) {
        const els    = Na__LeSurface__GetElements();
        const layout = Na__LeSurface__GetLayout();
        if (!els.paper || !els.stage || !layout || els.paper.hidden) return null;
        const zoom      = Na__LeSurface__GetZoom();
        const ppm       = Na__LeSurface__GetPixelsPerMm();
        const scale     = ppm * zoom;
        if (!(scale > 0)) return null;
        const paperRect = els.paper.getBoundingClientRect();
        const stageRect = els.stage.getBoundingClientRect();
        const bounds    = Na__LeGrid__Bounds(layout, settings);
        const pad       = Math.max(0, overdrawPx || 0);
        const view = {
            x0 : Math.max(bounds.x0, (stageRect.left   - pad - paperRect.left) / scale),
            y0 : Math.max(bounds.y0, (stageRect.top    - pad - paperRect.top)  / scale),
            x1 : Math.min(bounds.x1, (stageRect.right  + pad - paperRect.left) / scale),
            y1 : Math.min(bounds.y1, (stageRect.bottom + pad - paperRect.top)  / scale)
        };
        const dpr = (Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0) ? window.devicePixelRatio : 1;
        const key = [ zoom, ppm, dpr, layout.Page.WidthMm, layout.Page.HeightMm, bounds.x0, bounds.y0, bounds.x1, bounds.y1,
                      settings.Type, settings.ShowMajor, settings.MajorSpacingMm, settings.MajorColour,
                      settings.ShowMinor, settings.MinorDivisions, settings.MinorColour, settings.OnTop ].join('|');
        return { els : els, paperRect : paperRect, stageRect : stageRect, zoom : zoom, scale : scale, dpr : dpr, bounds : bounds,
                 view : (view.x1 > view.x0 && view.y1 > view.y0) ? view : null, key : key };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does the Last Drawing Still Cover the View
    // ------------------------------------------------------------
    // Nothing that changes the picture (the zoom, a setting, the paper) and no
    // part of the view outside what was drawn: then a pan or a zoom-in step
    // needs nothing drawn at all.
    // ------------------------------------------------------------
    function Na__LeGrid__StillCovers(settings) {
        const covered = Na__LeGrid__Covered;
        if (!covered) return false;
        const now = Na__LeGrid__View(settings, 0);
        if (!now || now.key !== covered.key) return false;
        if (!now.view) return true;                                          // <-- Nothing of the paper in view: nothing missing
        const e = Na__LeGrid__EPSILON_MM;
        return now.view.x0 >= covered.x0 - e && now.view.y0 >= covered.y0 - e && now.view.x1 <= covered.x1 + e && now.view.y1 <= covered.y1 + e;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Overlay: Drawing It
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Grid Positions Along One Axis Inside a Range
    // ------------------------------------------------------------
    // Multiples of the step from the paper's corner, as indexes: first..last.
    // ------------------------------------------------------------
    function Na__LeGrid__Range(fromMm, toMm, stepMm) {
        return { first : Math.ceil((fromMm / stepMm) - 1e-9), last : Math.floor((toMm / stepMm) + 1e-9) };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Row of Points, Drawn Once Into a Strip
    // ------------------------------------------------------------
    // A strip as wide as the canvas and one point high, holding a point at
    // every column. Each row of the grid is then one drawImage of it, which
    // is what keeps tens of thousands of points to a millisecond. Columns are
    // rounded to device pixels one by one from their exact position, so the
    // points never drift across the sheet.
    // ------------------------------------------------------------
    function Na__LeGrid__Strip(width, size, columns, colour) {
        const strip = document.createElement('canvas');
        strip.width  = Math.max(1, width);
        strip.height = Math.max(1, size);
        const ctx = strip.getContext('2d');
        ctx.fillStyle = colour;
        const round = size >= 3;
        columns.forEach((x) => {
            const left = Math.round(x - (size / 2));
            if (round) { ctx.beginPath(); ctx.arc(left + (size / 2), size / 2, size / 2, 0, Math.PI * 2); ctx.fill(); }
            else ctx.fillRect(left, 0, size, size);
        });
        return strip;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Points: a Dot at Every Minor Point, a Bigger One at Every Major Point
    // ------------------------------------------------------------
    function Na__LeGrid__DrawPoints(ctx, plan) {
        const draw = (stepMm, sizePx, colour) => {
            const cols = Na__LeGrid__Range(plan.view.x0, plan.view.x1, stepMm);
            const rows = Na__LeGrid__Range(plan.view.y0, plan.view.y1, stepMm);
            if (cols.last < cols.first || rows.last < rows.first) return;
            const size = Math.max(1, Math.round(sizePx * plan.dpr));
            const xs   = [];
            for (let i = cols.first; i <= cols.last; i++) xs.push(plan.toX(i * stepMm));
            const strip = Na__LeGrid__Strip(plan.width, size, xs, colour);
            for (let j = rows.first; j <= rows.last; j++) ctx.drawImage(strip, 0, Math.round(plan.toY(j * stepMm) - (size / 2)));
        };
        if (plan.minor) draw(plan.minorMm, plan.display.MinorPointPx, plan.settings.MinorColour);
        if (plan.major) draw(plan.majorMm, plan.display.MajorPointPx, plan.settings.MajorColour);   // <-- Over the minor point at the same place
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Lines: Dotted Minor Lines, Solid Major Lines Over Them
    // ------------------------------------------------------------
    // LayOut's own look. Each line sits on the centre of a device pixel, so a
    // one-pixel line is one pixel of ink rather than two half-tones.
    // ------------------------------------------------------------
    function Na__LeGrid__DrawLines(ctx, plan) {
        const draw = (stepMm, widthPx, colour, dash) => {
            const cols  = Na__LeGrid__Range(plan.view.x0, plan.view.x1, stepMm);
            const rows  = Na__LeGrid__Range(plan.view.y0, plan.view.y1, stepMm);
            const width = Math.max(1, Math.round(widthPx * plan.dpr));
            const half  = (width % 2) ? 0.5 : 0;
            const top   = plan.toY(plan.view.y0), bottom = plan.toY(plan.view.y1);
            const left  = plan.toX(plan.view.x0), right  = plan.toX(plan.view.x1);
            ctx.beginPath();
            for (let i = cols.first; i <= cols.last; i++) { const x = Math.round(plan.toX(i * stepMm)) + half; ctx.moveTo(x, top); ctx.lineTo(x, bottom); }
            for (let j = rows.first; j <= rows.last; j++) { const y = Math.round(plan.toY(j * stepMm)) + half; ctx.moveTo(left, y); ctx.lineTo(right, y); }
            ctx.lineWidth   = width;
            ctx.strokeStyle = colour;
            ctx.setLineDash(dash ? dash.map((n) => Math.max(1, Math.round(n * plan.dpr))) : []);
            ctx.stroke();
        };
        if (plan.minor) draw(plan.minorMm, plan.display.MinorLinePx, plan.settings.MinorColour, plan.display.MinorLineDashPx);
        if (plan.major) draw(plan.majorMm, plan.display.MajorLinePx, plan.settings.MajorColour, null);
        ctx.setLineDash([]);
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Grid Over the Part of the Paper in View, Now
    // ------------------------------------------------------------
    // force false asks only whether the view has left what was drawn last. The
    // canvas is placed in PAPER pixels (the paper's scale is applied over it)
    // and given a backing store of the same area in DEVICE pixels, with its
    // left and top edges on device pixel boundaries: after the paper's scale,
    // one canvas pixel is one device pixel. Returns true when it drew.
    // ------------------------------------------------------------
    function Na__LeGrid__DrawNow(force) {
        const settings = Na__LeGrid__Get();
        if (!Na__LeGrid__Attached || !settings.Show || (!settings.ShowMajor && !settings.ShowMinor)) { Na__LeGrid__Hide(); return false; }
        if (force !== true && Na__LeGrid__StillCovers(settings)) return false;
        const display = Na__LeGrid__Display();
        const at      = Na__LeGrid__View(settings, display.OverdrawPx);
        if (!at || !at.view) { Na__LeGrid__Hide(); if (at) Na__LeGrid__Covered = { x0 : 0, y0 : 0, x1 : 0, y1 : 0, key : at.key }; return false; }

        const majorMm = settings.MajorSpacingMm;
        const minorMm = Na__LeGrid__MinorMm(settings);
        const major   = settings.ShowMajor && (majorMm * at.scale) >= display.MinMajorSpacingPx;
        const minor   = settings.ShowMinor && settings.MinorDivisions > 1 && (minorMm * at.scale) >= display.MinMinorSpacingPx;
        const canvas  = Na__LeGrid__EnsureCanvas(at.els.paper, at.els.handles);
        canvas.classList.toggle(Na__LeGrid__UNDER_CLASS, settings.OnTop === false);

        // WHERE THE CANVAS GOES, on device pixel boundaries
        // ------------------------------------
        const dpr    = at.dpr;
        const left   = Math.floor((at.paperRect.left + (at.view.x0 * at.scale)) * dpr) / dpr;
        const top    = Math.floor((at.paperRect.top  + (at.view.y0 * at.scale)) * dpr) / dpr;
        const right  = Math.ceil((at.paperRect.left  + (at.view.x1 * at.scale)) * dpr) / dpr;
        const bottom = Math.ceil((at.paperRect.top   + (at.view.y1 * at.scale)) * dpr) / dpr;
        const width  = Math.max(1, Math.round((right - left) * dpr));
        const height = Math.max(1, Math.round((bottom - top) * dpr));
        if (canvas.width !== width)   canvas.width  = width;                  // <-- Resizing clears it; the same size is cleared below
        if (canvas.height !== height) canvas.height = height;
        canvas.style.left   = ((left - at.paperRect.left) / at.zoom) + 'px';
        canvas.style.top    = ((top  - at.paperRect.top)  / at.zoom) + 'px';
        canvas.style.width  = ((right - left) / at.zoom) + 'px';
        canvas.style.height = ((bottom - top) / at.zoom) + 'px';

        const ctx = canvas.getContext('2d');
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const plan = {
            settings : settings, display : display, dpr : dpr, view : at.view, width : width,
            majorMm : majorMm, minorMm : minorMm, major : major, minor : minor,
            toX : (mm) => (at.paperRect.left + (mm * at.scale) - left) * dpr,
            toY : (mm) => (at.paperRect.top  + (mm * at.scale) - top)  * dpr
        };
        if (major || minor) {
            if (settings.Type === Na__LeGrid__TYPE_LINES) Na__LeGrid__DrawLines(ctx, plan);
            else Na__LeGrid__DrawPoints(ctx, plan);
        }
        canvas.hidden = !(major || minor);
        Na__LeGrid__Covered = { x0 : at.view.x0, y0 : at.view.y0, x1 : at.view.x1, y1 : at.view.y1, key : at.key };
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Book a Draw on the Next Animation Frame
    // ------------------------------------------------------------
    // Several asks in one frame - a scroll, a zoom step and a settle - are one
    // draw. force true draws whatever the coverage says.
    // ------------------------------------------------------------
    function Na__LeGrid__Schedule(force) {
        if (force === true) Na__LeGrid__Forced = true;
        if (!Na__LeGrid__Attached || Na__LeGrid__Frame) return;
        Na__LeGrid__Frame = window.requestAnimationFrame(() => {
            Na__LeGrid__Frame = 0;
            const forced = Na__LeGrid__Forced;
            Na__LeGrid__Forced = false;
            Na__LeGrid__DrawNow(forced);
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Attach and Detach With the Sheet
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Follow the Stage's Scroll (the editor mounts a new stage each build)
    // ------------------------------------------------------------
    function Na__LeGrid__FollowStage() {
        const stage = Na__LeSurface__GetElements().stage || null;
        if (stage === Na__LeGrid__Stage) return;
        if (Na__LeGrid__Stage) Na__LeGrid__Stage.removeEventListener('scroll', Na__LeGrid__Handlers.scroll);
        Na__LeGrid__Stage = stage;
        if (stage) stage.addEventListener('scroll', Na__LeGrid__Handlers.scroll, { passive : true });
    }
    // ------------------------------------------------------------


    // FUNCTION | Start Drawing the Grid for the Sheet on Screen (with the sheet tools)
    // ------------------------------------------------------------
    // Idempotent: the mode controller attaches the sheet input on every entry.
    // A pan, or a zoom step, draws again only when the view has left what was
    // drawn (a zoom-out step can uncover the edges); a settled zoom, a resize,
    // a changed sheet or setting always draws.
    // ------------------------------------------------------------
    function Na__LeGrid__Attach() {
        if (!Na__LeGrid__Handlers.scroll) {
            Na__LeGrid__Handlers.scroll  = () => Na__LeGrid__Schedule(false);
            Na__LeGrid__Handlers.step    = () => Na__LeGrid__Schedule(false);
            Na__LeGrid__Handlers.settled = () => Na__LeGrid__Schedule(true);
            Na__LeGrid__Handlers.resize  = () => Na__LeGrid__Schedule(true);
            Na__LeGrid__Handlers.model   = () => Na__LeGrid__Schedule(false);   // <-- A new paper size changes the key, so the coverage test catches it
        }
        if (!Na__LeGrid__Attached) {
            Na__LeGrid__Attached = true;
            window.addEventListener(Na__LeSurface__ZOOM_EVENT, Na__LeGrid__Handlers.step);
            window.addEventListener(Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeGrid__Handlers.settled);
            window.addEventListener('resize', Na__LeGrid__Handlers.resize);
            window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LeGrid__Handlers.model);
        }
        Na__LeGrid__FollowStage();
        Na__LeGrid__Covered = null;
        Na__LeGrid__Schedule(true);
        void Na__LeGrid__Ready();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop Drawing It (a document tab, the 3D Model tab)
    // ------------------------------------------------------------
    function Na__LeGrid__Detach() {
        if (Na__LeGrid__Attached) {
            window.removeEventListener(Na__LeSurface__ZOOM_EVENT, Na__LeGrid__Handlers.step);
            window.removeEventListener(Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeGrid__Handlers.settled);
            window.removeEventListener('resize', Na__LeGrid__Handlers.resize);
            window.removeEventListener(Na__LeModel__CHANGED_EVENT, Na__LeGrid__Handlers.model);
        }
        Na__LeGrid__Attached = false;
        if (Na__LeGrid__Stage) Na__LeGrid__Stage.removeEventListener('scroll', Na__LeGrid__Handlers.scroll);
        Na__LeGrid__Stage = null;
        if (Na__LeGrid__Frame) window.cancelAnimationFrame(Na__LeGrid__Frame);
        Na__LeGrid__Frame = 0;
        Na__LeGrid__Forced = false;
        Na__LeGrid__Hide();
        return true;
    }
    // ------------------------------------------------------------

    // THE CONFIG IS ASKED FOR AS THE EDITOR LOADS, so the toolbar's words and
    // the panel's defaults already have it. Never rejects.
    void Na__LeGrid__Ready();

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Drawing Grid API
    // ------------------------------------------------------------
    export {
        Na__LeGrid__CHANGED_EVENT,
        Na__LeGrid__Get,
        Na__LeGrid__GetLimits,
        Na__LeGrid__IsShowing,
        Na__LeGrid__IsSnapping,
        Na__LeGrid__Ready,
        Na__LeGrid__Label,
        Na__LeGrid__MarkerScale,
        Na__LeGrid__SetShow,
        Na__LeGrid__ToggleShow,
        Na__LeGrid__SetSnap,
        Na__LeGrid__ToggleSnap,
        Na__LeGrid__Update,
        Na__LeGrid__ResetSettings,
        Na__LeGrid__DrawNow,
        Na__LeGrid__Attach,
        Na__LeGrid__Detach
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
