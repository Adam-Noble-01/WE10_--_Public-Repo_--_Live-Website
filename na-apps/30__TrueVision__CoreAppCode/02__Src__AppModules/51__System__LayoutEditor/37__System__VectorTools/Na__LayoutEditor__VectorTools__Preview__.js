// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS - PREVIEW
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__Preview__.js
// NAMESPACE  : Na__LeVecPrev
// MODULE     : Layout Editor - Vector Tools - Preview
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : What a vector tool shows BEFORE the click: the piece a trim will take, the run an extend will add, a circle or an arc being stretched, a fence
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - ONE SVG IN THE HANDLES LAYER, drawn in paper millimetres. The rubber band
//   and the rubber box the older tools stretch are single DIVs, which is all a
//   straight edge or a square needs; a curve, or a span of a polyline with its
//   corners, needs real linework, so this overlay is an SVG whose viewBox is
//   the page. It sits in the same layer the band does, above the sheet and
//   below nothing, takes no pointer events, and is never part of a sheet: not
//   saved, not printed, not in the web viewer.
// - TONES say what a click will do, the way AutoCAD's and LayOut's previews
//   do: 'remove' (red, dashed - this goes), 'add' (blue, dashed - this
//   arrives), 'held' (blue, solid, heavier - the line Join or Fillet is holding
//   while it waits for the next), 'ghost' (the band's own blue - the shape
//   being drawn) and 'fence' (purple - the line drawn across several).
// - WEIGHTS ARE SCREEN PIXELS. The paper is scaled by a CSS transform, which
//   vector-effect: non-scaling-stroke does not undo, so every width and dash
//   is divided by pixels-per-millimetre times the zoom as it is written, the
//   way the grips counter-scale theirs.
// - The handles layer's own clearing (Na__LeHandles__Clear) takes grips and
//   handles and leaves this alone, as it leaves the band; the tools clear it
//   themselves when they have nothing to show.
//
// INTEGRATION:
// - Every tool in this folder calls Show and Clear. The adapter clears it when
//   a tool is put down.
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
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Surface and the Config
    // ------------------------------------------------------------
    import { Na__LeSurface__GetElements, Na__LeSurface__GetPixelsPerMm, Na__LeSurface__GetZoom, Na__LeSurface__GetLayout } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeVecCfg__Value } from './Na__LayoutEditor__VectorTools__Setup__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Tones, Marker Kinds and the SVG Namespace
    // ------------------------------------------------------------
    const Na__LeVecPrev__TONE_REMOVE = 'remove';
    const Na__LeVecPrev__TONE_ADD    = 'add';
    const Na__LeVecPrev__TONE_HELD   = 'held';
    const Na__LeVecPrev__TONE_GHOST  = 'ghost';
    const Na__LeVecPrev__TONE_FENCE  = 'fence';
    const Na__LeVecPrev__MARK_CROSS  = 'cross';     // <-- LayOut's red X: two lines cross here
    const Na__LeVecPrev__MARK_DOT    = 'dot';       // <-- A point that matters: a centre, where an end will land
    const Na__LeVecPrev__SVG_NS      = 'http://www.w3.org/2000/svg';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Overlay
    // ------------------------------------------------------------
    let Na__LeVecPrev__Svg = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Colour of a Tone
    // ------------------------------------------------------------
    function Na__LeVecPrev__Colour(tone) {
        if (tone === Na__LeVecPrev__TONE_REMOVE) return Na__LeVecCfg__Value('Preview', 'RemoveColour', '#d93025');
        if (tone === Na__LeVecPrev__TONE_ADD)    return Na__LeVecCfg__Value('Preview', 'AddColour',    '#1a73e8');
        if (tone === Na__LeVecPrev__TONE_HELD)   return Na__LeVecCfg__Value('Preview', 'HeldColour',   '#1a73e8');
        if (tone === Na__LeVecPrev__TONE_FENCE)  return Na__LeVecCfg__Value('Preview', 'FenceColour',  '#8e24aa');
        return Na__LeVecCfg__Value('Preview', 'GhostColour', '#336699');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Overlay, Made on First Use and Put Back if the Layer Was Rebuilt
    // ------------------------------------------------------------
    function Na__LeVecPrev__Ensure() {
        if (typeof document === 'undefined') return null;
        const layer  = Na__LeSurface__GetElements().handles;
        const layout = Na__LeSurface__GetLayout();
        if (!layer || !layout || !layout.Page) return null;
        if (!Na__LeVecPrev__Svg) {
            Na__LeVecPrev__Svg = document.createElementNS(Na__LeVecPrev__SVG_NS, 'svg');
            Na__LeVecPrev__Svg.setAttribute('class', 'na-le-vec-preview');
            Na__LeVecPrev__Svg.setAttribute('aria-hidden', 'true');
            Na__LeVecPrev__Svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible;pointer-events:none;';
        }
        if (Na__LeVecPrev__Svg.parentNode !== layer) layer.appendChild(Na__LeVecPrev__Svg);
        const ppm = Na__LeSurface__GetPixelsPerMm();
        Na__LeVecPrev__Svg.setAttribute('viewBox', '0 0 ' + layout.Page.WidthMm + ' ' + layout.Page.HeightMm);
        Na__LeVecPrev__Svg.style.width  = (layout.Page.WidthMm * ppm) + 'px';
        Na__LeVecPrev__Svg.style.height = (layout.Page.HeightMm * ppm) + 'px';
        return Na__LeVecPrev__Svg;
    }
    // ------------------------------------------------------------


    // FUNCTION | Show What the Next Click Will Do
    // ------------------------------------------------------------
    // parts   : [{ points : [[x, y], ...], closed, tone, dashed }] paper mm
    // markers : [{ x, y, kind, tone }]
    // Whatever was showing is replaced. Returns true when something was drawn.
    // ------------------------------------------------------------
    function Na__LeVecPrev__Show(parts, markers) {
        const svg = Na__LeVecPrev__Ensure();
        if (!svg) return false;
        while (svg.firstChild) svg.removeChild(svg.firstChild);
        const perPx  = 1 / Math.max(1e-6, Na__LeSurface__GetPixelsPerMm() * Na__LeSurface__GetZoom());   // <-- Paper millimetres in one screen pixel
        const linePx = Na__LeVecCfg__Value('Preview', 'LinePx', 2);
        const heldPx = Na__LeVecCfg__Value('Preview', 'HeldPx', 3);
        const dashPx = Na__LeVecCfg__Value('Preview', 'DashPx', [ 6, 4 ]);
        let drawn = false;
        (Array.isArray(parts) ? parts : []).forEach((part) => {
            if (!part || !Array.isArray(part.points) || part.points.length < 2) return;
            const el = document.createElementNS(Na__LeVecPrev__SVG_NS, part.closed === true ? 'polygon' : 'polyline');
            el.setAttribute('points', part.points.map((p) => p[0] + ',' + p[1]).join(' '));
            el.setAttribute('fill', 'none');
            el.setAttribute('stroke', Na__LeVecPrev__Colour(part.tone));
            el.setAttribute('stroke-width', String((part.tone === Na__LeVecPrev__TONE_HELD ? heldPx : linePx) * perPx));
            el.setAttribute('stroke-linejoin', 'round');
            el.setAttribute('stroke-linecap', 'round');
            if (part.dashed === true) el.setAttribute('stroke-dasharray', dashPx.map((n) => n * perPx).join(' '));
            svg.appendChild(el);
            drawn = true;
        });
        const size = Na__LeVecCfg__Value('Preview', 'MarkerPx', 9) * perPx;
        (Array.isArray(markers) ? markers : []).forEach((mark) => {
            if (!mark || !Number.isFinite(mark.x) || !Number.isFinite(mark.y)) return;
            const colour = Na__LeVecPrev__Colour(mark.tone);
            if (mark.kind === Na__LeVecPrev__MARK_CROSS) {
                const el = document.createElementNS(Na__LeVecPrev__SVG_NS, 'path');
                const h  = size / 2;
                el.setAttribute('d', 'M' + (mark.x - h) + ' ' + (mark.y - h) + 'L' + (mark.x + h) + ' ' + (mark.y + h) + 'M' + (mark.x - h) + ' ' + (mark.y + h) + 'L' + (mark.x + h) + ' ' + (mark.y - h));
                el.setAttribute('fill', 'none');
                el.setAttribute('stroke', colour);
                el.setAttribute('stroke-width', String(linePx * perPx));
                el.setAttribute('stroke-linecap', 'round');
                svg.appendChild(el);
            } else {
                const el = document.createElementNS(Na__LeVecPrev__SVG_NS, 'circle');
                el.setAttribute('cx', String(mark.x));
                el.setAttribute('cy', String(mark.y));
                el.setAttribute('r', String(size / 3));
                el.setAttribute('fill', '#ffffff');
                el.setAttribute('stroke', colour);
                el.setAttribute('stroke-width', String(linePx * perPx));
                svg.appendChild(el);
            }
            drawn = true;
        });
        return drawn;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Preview Away
    // ------------------------------------------------------------
    function Na__LeVecPrev__Clear() {
        if (!Na__LeVecPrev__Svg) return false;
        const had = !!Na__LeVecPrev__Svg.firstChild;
        while (Na__LeVecPrev__Svg.firstChild) Na__LeVecPrev__Svg.removeChild(Na__LeVecPrev__Svg.firstChild);
        return had;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools Preview API
    // ------------------------------------------------------------
    export {
        Na__LeVecPrev__TONE_REMOVE,
        Na__LeVecPrev__TONE_ADD,
        Na__LeVecPrev__TONE_HELD,
        Na__LeVecPrev__TONE_GHOST,
        Na__LeVecPrev__TONE_FENCE,
        Na__LeVecPrev__MARK_CROSS,
        Na__LeVecPrev__MARK_DOT,
        Na__LeVecPrev__Show,
        Na__LeVecPrev__Clear
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
