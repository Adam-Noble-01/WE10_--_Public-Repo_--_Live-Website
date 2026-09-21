// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - DRAFT MODE
// =============================================================================
//
// FILE       : Na__LayoutEditor__DraftMode__.js
// NAMESPACE  : Na__LeDraft
// MODULE     : Layout Editor - Draft Mode
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : SketchUp LayOut's Draft Mode on the same key: a bare, fast sheet to navigate and draw over
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - WHAT DRAFT DRAWS. In every viewport only the projected vector linework;
//   on the paper every line - the linework, the sheet's vectors, dimensions,
//   leaders, annotations, the border and title block - as a hairline one
//   device pixel wide in its own colour, with no dashes and no fills. Text
//   stays. A shape that had only a fill is outlined in the draft ink, so it
//   does not vanish. No raster picture is drawn anywhere: base images, depth
//   fog and 3D pictures are display:none, which costs no paint and no
//   composite, and no new one is RENDERED while Draft is on - the viewport
//   modules ask Na__LeDraft__IsOn before booking any raster render.
// - WHY THIS IS FAST. Nothing on the sheet is regenerated on zoom - a zoom is
//   one CSS transform on the paper - but the browser rasterises the whole
//   paper again at every zoom step: every line at its full width with round
//   caps, every dash, every hatch, gradient and fill, every picture resampled.
//   Draft leaves it only hairlines to draw, which is the cheapest stroke there
//   is, and while a zoom gesture is under way it holds the paper as one
//   composited layer so each step scales pixels already drawn (LayOut's Pan
//   and Zoom Redraw Delay); the crisp hairlines are drawn once, when the wheel
//   rests.
// - THE WHOLE LOOK IS ONE STYLESHEET (Na__LayoutEditor__Styles__DraftMode__.css)
//   keyed on a class on the body. Strokes and fills on the paper are SVG
//   presentation attributes, which any author rule overrides, so switching
//   Draft on or off rebuilds no markup and repaints no linework string - and
//   the PDF, which never reads the screen, cannot see it at all.
// - THE HAIRLINE WIDTH. Every paper SVG has its own viewBox (paper mm for the
//   sheet, drawing mm for a viewport), so the stylesheet uses
//   vector-effect: non-scaling-stroke, which measures the width in the SVG's
//   own CSS pixels. The paper's zoom is a CSS transform ABOVE the SVG, which
//   non-scaling-stroke does not undo, so the width is written here as
//   HairlineDevicePx / (zoom x devicePixelRatio). Proved in headless Chrome:
//   exactly one device pixel of ink at every zoom and display scaling tried.
// - A SESSION VIEW, NOTHING SAVED. Draft never writes a sheet, a viewport
//   record, the browser draft or localStorage. It is off on every load and
//   stays as it was set across sheets and across leaving the editor.
//
// INTEGRATION:
// - Na__LayoutEditor__SheetTools__Keyboard__ runs Na__LeDraft__Toggle on the
//   View__DraftToggle binding (K); Na__LayoutEditor__Toolbar__ has a Draft
//   button beside Snap, lit while Draft is on, and re-syncs on
//   Na__LeDraft__CHANGED_EVENT.
// - The flag itself lives in Na__LayoutEditor__DraftMode__State__ (a leaf), so
//   the viewport modules can read it without an import cycle through the
//   sheet surface this module refreshes.
// // @delegate: ./Na__LayoutEditor__DraftMode__State__.js
// // @delegate: ../20__System__Viewports/Na__LayoutEditor__Viewport2d__.js
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026, v2.107.0)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation: Set and Toggle, the body classes, the hairline
//   width per zoom and device pixel ratio, the zoom hold, the frame refresh,
//   the config and every label.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Flag, and the Sheet Surface It Refreshes
    // ------------------------------------------------------------
    import { Na__LeDraft__CHANGED_EVENT, Na__LeDraft__IsOn, Na__LeDraft__AssignOn } from './Na__LayoutEditor__DraftMode__State__.js';
    import { Na__LeSurface__ZOOM_EVENT, Na__LeSurface__GetZoom, Na__LeSurface__Refresh } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where the Config Is, and the Classes the Stylesheet Keys On
    // ------------------------------------------------------------
    const Na__LeDraft__ConfigUrl    = new URL('./Na__LayoutEditor__DraftMode__Config__.json', import.meta.url);
    const Na__LeDraft__PREFIX       = 'LayoutEditor__DraftMode__';
    const Na__LeDraft__BODY_CLASS   = 'na-le-draft';            // <-- Draft is on
    const Na__LeDraft__MOVING_CLASS = 'na-le-draft--moving';    // <-- A zoom gesture is under way: the paper is held as one composited layer
    const Na__LeDraft__CRISP_CLASS  = 'na-le-draft--crisp';     // <-- Lines__Smooth false: aliased hairlines
    const Na__LeDraft__DELAY_MIN_MS = 100;                      // <-- LayOut's range for its redraw delay
    const Na__LeDraft__DELAY_MAX_MS = 3000;
    const Na__LeDraft__PROPERTIES   = [ '--na-le-draft-hairline', '--na-le-draft-inv-zoom', '--na-le-draft-fill-ink', '--na-le-draft-raster-note', '--na-le-draft-3d-note' ];
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Config, the Settle Timer, the Zoom Listener
    // ------------------------------------------------------------
    let Na__LeDraft__Config      = null;
    let Na__LeDraft__Loading     = null;
    let Na__LeDraft__SettleTimer = null;
    let Na__LeDraft__Listening   = false;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Config
// -----------------------------------------------------------------------------

    // FUNCTION | Fetch the Config Once
    // ------------------------------------------------------------
    // Never rejects. A missing file leaves every reader on its fallback, so
    // Draft still draws hairlines rather than failing to switch on.
    // ------------------------------------------------------------
    function Na__LeDraft__Ready() {
        if (!Na__LeDraft__Loading) {
            Na__LeDraft__Loading = (async () => {
                try {
                    const response = await fetch(Na__LeDraft__ConfigUrl, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeDraft__Config = await response.json();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Draft mode config unavailable - the built-in settings are used.', error);
                    Na__LeDraft__Config = null;
                }
                return Na__LeDraft__Config;
            })();
        }
        return Na__LeDraft__Loading;
    }
    // ------------------------------------------------------------


    // FUNCTION | One Block of the Config, a Value From It, and a Label
    // ------------------------------------------------------------
    function Na__LeDraft__Block(name) {
        const block = Na__LeDraft__Config ? Na__LeDraft__Config[Na__LeDraft__PREFIX + name] : null;
        return (block && typeof block === 'object' && !Array.isArray(block)) ? block : {};
    }
    function Na__LeDraft__Value(block, key, fallback) {
        const value = Na__LeDraft__Block(block)[key];
        if (typeof fallback === 'number') return (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
        if (typeof fallback === 'boolean') return (typeof value === 'boolean') ? value : fallback;
        return (typeof value === 'string' && value !== '') ? value : fallback;
    }
    function Na__LeDraft__Label(key, fallback) {
        return Na__LeDraft__Value('Labels', 'Labels__' + key, fallback);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Look
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Hairline Width for a Zoom, Written for the Stylesheet
    // ------------------------------------------------------------
    // HairlineDevicePx / (zoom x devicePixelRatio), in CSS pixels, because
    // non-scaling-stroke measures a width in the SVG's own CSS pixels and the
    // paper's zoom is a transform above the SVG that it does not undo. The
    // inverse zoom goes out too, for the few Draft decorations that are sized
    // in screen pixels (a raster-only viewport's outline and its note).
    // ------------------------------------------------------------
    function Na__LeDraft__ApplyWidths(zoom) {
        const root = document.body;
        if (!root) return;
        const z      = (Number.isFinite(zoom) && zoom > 0) ? zoom : 1;
        const dpr    = (Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0) ? window.devicePixelRatio : 1;
        const device = Math.max(0.25, Na__LeDraft__Value('Lines', 'Lines__HairlineDevicePx', 1));
        root.style.setProperty('--na-le-draft-hairline', Number((device / (z * dpr)).toPrecision(6)) + 'px');
        root.style.setProperty('--na-le-draft-inv-zoom', String(Number((1 / z).toPrecision(6))));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Put the Look On, or Take It Off
    // ------------------------------------------------------------
    // The two notes go out as CSS strings (JSON quoting is a valid CSS string)
    // so the stylesheet can write them with content: var(...) and every word
    // stays in the config.
    // ------------------------------------------------------------
    function Na__LeDraft__ApplyLook(on) {
        const root = document.body;
        if (!root) return;
        root.classList.toggle(Na__LeDraft__BODY_CLASS, on);
        root.classList.toggle(Na__LeDraft__CRISP_CLASS, on && Na__LeDraft__Value('Lines', 'Lines__Smooth', true) === false);
        if (!on) {
            root.classList.remove(Na__LeDraft__MOVING_CLASS);
            Na__LeDraft__PROPERTIES.forEach((name) => root.style.removeProperty(name));
            return;
        }
        root.style.setProperty('--na-le-draft-fill-ink', Na__LeDraft__Value('Lines', 'Lines__FillOnlyInk', '#7a8591'));
        root.style.setProperty('--na-le-draft-raster-note', JSON.stringify(Na__LeDraft__Label('RasterNote', 'Raster only - not drawn in Draft (K)')));
        root.style.setProperty('--na-le-draft-3d-note', JSON.stringify(Na__LeDraft__Label('Picture3dNote', '3D picture - not drawn in Draft (K)')));
        Na__LeDraft__ApplyWidths(Na__LeSurface__GetZoom());
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Zoom Hold (LayOut's Pan and Zoom Redraw Delay)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | How Long the Wheel Must Rest, Clamped to LayOut's Range
    // ------------------------------------------------------------
    function Na__LeDraft__DelayMs() {
        const ms = Na__LeDraft__Value('Navigation', 'Navigation__RedrawDelayMs', 300);
        return Math.min(Na__LeDraft__DELAY_MAX_MS, Math.max(Na__LeDraft__DELAY_MIN_MS, ms));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Zoom Has Rested: Draw the Hairlines Crisp at It
    // ------------------------------------------------------------
    // The width and the release of the held layer happen in the same task, so
    // the browser rasterises the paper ONCE, at the new zoom, with the new
    // width - not once for each.
    // ------------------------------------------------------------
    function Na__LeDraft__Settle() {
        Na__LeDraft__SettleTimer = null;
        if (!document.body) return;
        if (Na__LeDraft__IsOn()) Na__LeDraft__ApplyWidths(Na__LeSurface__GetZoom());
        document.body.classList.remove(Na__LeDraft__MOVING_CLASS);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Zoom Step While Draft Is On
    // ------------------------------------------------------------
    // WITH THE HOLD (the default) the width is NOT re-solved per step. A new
    // width is a paint change on every line, and a paint change inside the
    // held layer would make the browser rasterise it again - the one thing the
    // hold is there to stop. The lines scale with the picture for the length
    // of the gesture and come back to one pixel when it rests.
    // WITHOUT IT every step rasterises anyway, so the width follows every step.
    // ------------------------------------------------------------
    function Na__LeDraft__OnZoom(event) {
        if (!Na__LeDraft__IsOn() || !document.body) return;
        const zoom = (event && event.detail && Number.isFinite(event.detail.zoom)) ? event.detail.zoom : Na__LeSurface__GetZoom();
        if (Na__LeDraft__Value('Navigation', 'Navigation__HoldWhileZooming', true) === false) {
            Na__LeDraft__ApplyWidths(zoom);
            return;
        }
        document.body.classList.add(Na__LeDraft__MOVING_CLASS);
        if (Na__LeDraft__SettleTimer) window.clearTimeout(Na__LeDraft__SettleTimer);
        Na__LeDraft__SettleTimer = window.setTimeout(Na__LeDraft__Settle, Na__LeDraft__DelayMs());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Listen for Zoom Steps Only While Draft Is On
    // ------------------------------------------------------------
    function Na__LeDraft__Listen(on) {
        if (on === Na__LeDraft__Listening) return;
        Na__LeDraft__Listening = on;
        if (on) { window.addEventListener(Na__LeSurface__ZOOM_EVENT, Na__LeDraft__OnZoom); return; }
        window.removeEventListener(Na__LeSurface__ZOOM_EVENT, Na__LeDraft__OnZoom);
        if (Na__LeDraft__SettleTimer) { window.clearTimeout(Na__LeDraft__SettleTimer); Na__LeDraft__SettleTimer = null; }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Switching Draft On and Off
// -----------------------------------------------------------------------------

    // FUNCTION | Switch Draft Mode On or Off
    // ------------------------------------------------------------
    // THE FRAMES ARE REFRESHED EITHER WAY. Going on, every viewport's Fill runs
    // again and cancels any raster render still waiting on its debounce (one
    // already inside the renderer finishes, and its picture waits, hidden, for
    // Draft to end). Coming off, Fill books a render for any picture that went
    // stale meanwhile - a viewport panned, a composite ticked - and the rest
    // simply show again, because nothing was thrown away. Returns the state.
    // ------------------------------------------------------------
    function Na__LeDraft__Set(flag) {
        const want = flag === true;
        if (want === Na__LeDraft__IsOn()) return want;
        Na__LeDraft__AssignOn(want);
        Na__LeDraft__Listen(want);
        Na__LeDraft__ApplyLook(want);
        if (want && !Na__LeDraft__Config) void Na__LeDraft__Ready().then(() => { if (Na__LeDraft__IsOn()) Na__LeDraft__ApplyLook(true); });   // <-- The config's own settings once it is in
        console.log('[TrueVision3D LayoutEditor] ' + (want
            ? Na__LeDraft__Label('ConsoleOn', 'Draft mode on: vector linework only, hairlines, no fills, no raster renders.')
            : Na__LeDraft__Label('ConsoleOff', 'Draft mode off: the full composite is drawn again.')));
        window.dispatchEvent(new CustomEvent(Na__LeDraft__CHANGED_EVENT, { detail : { enabled : want } }));
        Na__LeSurface__Refresh('frames');
        return want;
    }
    function Na__LeDraft__Toggle() {
        return Na__LeDraft__Set(!Na__LeDraft__IsOn());
    }
    // ------------------------------------------------------------

    // THE CONFIG IS ASKED FOR AS THE EDITOR LOADS, so the toolbar's label and
    // the first switch-on already have it. Never rejects.
    void Na__LeDraft__Ready();

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Draft Mode API
    // ------------------------------------------------------------
    export {
        Na__LeDraft__CHANGED_EVENT,
        Na__LeDraft__IsOn,
        Na__LeDraft__Set,
        Na__LeDraft__Toggle,
        Na__LeDraft__Label,
        Na__LeDraft__Ready
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
