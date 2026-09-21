// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - MARGIN GRIP
// =============================================================================
//
// FILE       : Na__LayoutEditor__MarginGrip__.js
// NAMESPACE  : Na__LeMarginGrip
// MODULE     : Layout Editor - Margin Grip
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The handle on a notes margin's left edge that drags it wider or narrower, and the badge that says when notes do not fit
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A thin strip along the margin's divider, in a layer of its own over the
//   paper, counter-scaled so it is the same width on screen at any zoom. Drag
//   it left for a wider margin, right for a narrower one: the notes re-wrap
//   while it moves, and the width stays inside the margin's limits. The whole
//   drag is one undo step - the width is set silently while the pointer moves
//   and announced once on release. Escape puts it back where it was.
// - It takes the press before the sheet tools see it, and only with the
//   Select tool in an editable session, so a leader's tip or a dimension's end
//   can still be placed exactly on the divider with their own tools.
// - A badge at the foot of the margin says how many notes do not fit. It is a
//   screen-only warning: none of it reaches the sheet, the draft or the PDF.
//
// INTEGRATION:
// - Attached and detached by the mode controller with the sheet tools.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (14-Sep-2026)
// - ValeVision    : not yet ported. Nothing here is app-specific.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.2.0
// - The grip is placed when a zoom settles (Na__LeSurface__ZOOM_SETTLED_EVENT),
//   not on every frame of one. Render re-plans the whole notes margin - every
//   note wrapped and measured through jsPDF - and nothing in that plan depends
//   on the zoom; only the grip's width and the badge's scale do, and they can
//   wait for the wheel to rest like the handles do.
//
// 19-Sep-2026 - Version 1.1.0
// - The grip stays up under a Move tool that came up by itself
//   (Na__LeTools__IsMoveAuto), as it does under Select. Picking a note now
//   picks Move up, and that must not take the margin's handle away.
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Layout, Tools, Specification and the Margin
    // ------------------------------------------------------------
    import { Na__LeCfg__GetMarginNotesSetup, Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__CHANGED_EVENT, Na__LeModel__GetActiveSheet, Na__LeModel__UpdateMarginNotes } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeSurface__ZOOM_SETTLED_EVENT,
        Na__LeSurface__GetElements,
        Na__LeSurface__GetPixelsPerMm,
        Na__LeSurface__GetZoom,
        Na__LeSurface__GetLayout,
        Na__LeSurface__Refresh
    } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeLayout__Solve } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import { Na__LeTools__CHANGED_EVENT, Na__LeTools__TOOL_SELECT, Na__LeTools__GetTool, Na__LeTools__IsMoveAuto } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__.js';
    import { Na__LeSpec__CHANGED_EVENT } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeMargin__Report } from './Na__LayoutEditor__SpecMargin__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | What Moves the Grip, and the Drag Slop
    // ------------------------------------------------------------
    const Na__LeMarginGrip__EVENTS  = [ Na__LeModel__CHANGED_EVENT, Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeTools__CHANGED_EVENT, Na__LeSpec__CHANGED_EVENT, 'resize' ];   // <-- A zoom counts when it SETTLES: Render re-plans the whole margin, and it used to on every frame of a wheel
    const Na__LeMarginGrip__SLOP_PX = 2;     // <-- A press that moves less than this changes nothing
    // ------------------------------------------------------------

    // MODULE VARIABLES | Elements, Session and the Drag
    // ------------------------------------------------------------
    let Na__LeMarginGrip__Layer    = null;
    let Na__LeMarginGrip__Grip     = null;
    let Na__LeMarginGrip__Badge    = null;
    let Na__LeMarginGrip__Editable = false;
    let Na__LeMarginGrip__Attached = false;
    let Na__LeMarginGrip__Frame    = 0;
    let Na__LeMarginGrip__Drag     = null;   // <-- { pointerId, sheetId, startX, startWidth, width, maxWidth, moved }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Layer Once, and Keep It on the Paper
    // ------------------------------------------------------------
    function Na__LeMarginGrip__Ensure(paper) {
        if (!Na__LeMarginGrip__Layer) {
            const layer = document.createElement('div');
            layer.className = 'na-le-margin-layer';
            const grip = document.createElement('div');
            grip.className = 'na-le-margin-grip';
            grip.title     = Na__LeCfg__GetLabel('MarginGripTitle', 'Drag to make the notes margin wider or narrower');
            grip.addEventListener('pointerdown', Na__LeMarginGrip__OnDown);
            grip.addEventListener('dblclick', (event) => { event.preventDefault(); event.stopPropagation(); });   // <-- Never a double-click into a viewport under the edge
            const badge = document.createElement('div');
            badge.className = 'na-le-margin-badge';
            layer.appendChild(grip);
            layer.appendChild(badge);
            Na__LeMarginGrip__Layer = layer;
            Na__LeMarginGrip__Grip  = grip;
            Na__LeMarginGrip__Badge = badge;
        }
        if (Na__LeMarginGrip__Layer.parentNode !== paper) paper.appendChild(Na__LeMarginGrip__Layer);   // <-- A remounted surface has a new paper
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take the Grip and the Badge Away
    // ------------------------------------------------------------
    function Na__LeMarginGrip__Hide() {
        if (Na__LeMarginGrip__Layer) Na__LeMarginGrip__Layer.hidden = true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Place the Grip on the Divider and the Badge at the Foot
    // ------------------------------------------------------------
    function Na__LeMarginGrip__Render() {
        Na__LeMarginGrip__Frame = 0;
        const paper = Na__LeSurface__GetElements().paper;
        const sheet = Na__LeModel__GetActiveSheet();
        if (!Na__LeMarginGrip__Attached || !paper || !sheet) { Na__LeMarginGrip__Hide(); return; }
        const layout = Na__LeSurface__GetLayout() || Na__LeLayout__Solve(sheet);
        const report = Na__LeMargin__Report(sheet, layout);
        if (!report.on) { Na__LeMarginGrip__Hide(); return; }
        Na__LeMarginGrip__Ensure(paper);
        Na__LeMarginGrip__Layer.hidden = false;

        const setup   = Na__LeCfg__GetMarginNotesSetup();
        const ppm     = Na__LeSurface__GetPixelsPerMm();
        const zoom    = Na__LeSurface__GetZoom() || 1;
        const rect    = report.rect;
        const widthPx = setup.gripWidthPx / zoom;                                // <-- The paper is scaled by the zoom, so this is constant on screen
        const grip    = Na__LeMarginGrip__Grip;
        grip.style.left   = ((rect.X * ppm) - (widthPx / 2)) + 'px';
        grip.style.top    = (rect.Y * ppm) + 'px';
        grip.style.width  = widthPx + 'px';
        grip.style.height = (rect.HeightMm * ppm) + 'px';
        grip.hidden = !(Na__LeMarginGrip__Editable && (Na__LeMarginGrip__Drag || Na__LeTools__GetTool() === Na__LeTools__TOOL_SELECT || Na__LeTools__IsMoveAuto()));   // <-- A Move that came up by itself is still Select at rest: picking a note must not take the grip away
        grip.classList.toggle('is-dragging', !!Na__LeMarginGrip__Drag);

        const badge = Na__LeMarginGrip__Badge;
        badge.hidden = !(report.overflow > 0);
        if (!badge.hidden) {
            badge.textContent  = Na__LeCfg__FormatLabel('MarginOverflowBadge', '{count} not shown - widen the margin', { count : report.overflow });
            badge.style.left   = ((rect.X + 1.5) * ppm) + 'px';
            badge.style.bottom = ((layout.Page.HeightMm - (rect.Y + rect.HeightMm - 1.5)) * ppm) + 'px';
            badge.style.transform = 'scale(' + (1 / zoom) + ')';                 // <-- Readable at any zoom, anchored at its lower left
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Redraw on the Next Animation Frame (asking twice costs nothing)
    // ------------------------------------------------------------
    function Na__LeMarginGrip__Schedule() {
        if (!Na__LeMarginGrip__Attached || Na__LeMarginGrip__Frame) return;
        Na__LeMarginGrip__Frame = window.requestAnimationFrame(Na__LeMarginGrip__Render);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dragging the Edge
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Press: Take the Pointer Before the Sheet Tools Do
    // ------------------------------------------------------------
    function Na__LeMarginGrip__OnDown(event) {
        if (event.button !== 0 || Na__LeMarginGrip__Drag || !Na__LeMarginGrip__Editable) return;
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet) return;
        const layout = Na__LeSurface__GetLayout() || Na__LeLayout__Solve(sheet);
        const report = Na__LeMargin__Report(sheet, layout);
        if (!report.on) return;
        event.preventDefault();
        event.stopPropagation();                                                  // <-- The stage never sees it: no selection box, no click-through
        const setup = Na__LeCfg__GetMarginNotesSetup();
        Na__LeMarginGrip__Drag = {
            pointerId  : event.pointerId,
            sheetId    : sheet.Sheet__Id,
            startX     : event.clientX,
            startWidth : report.rect.WidthMm,
            width      : report.rect.WidthMm,
            maxWidth   : Math.max(setup.minWidthMm, layout.Content.WidthMm * setup.maxWidthFraction),
            moved      : false
        };
        try { Na__LeMarginGrip__Grip.setPointerCapture(event.pointerId); } catch (err) { /* A scripted pointer has nothing to capture; the window still hears it */ }
        window.addEventListener('pointermove',   Na__LeMarginGrip__OnMove, true);
        window.addEventListener('pointerup',     Na__LeMarginGrip__OnUp, true);
        window.addEventListener('pointercancel', Na__LeMarginGrip__OnUp, true);
        window.addEventListener('keydown',       Na__LeMarginGrip__OnKey, true);
        document.body.classList.add('na-le-dragging');
        Na__LeMarginGrip__Render();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move: Re-Width the Margin Silently and Redraw the Notes
    // ------------------------------------------------------------
    function Na__LeMarginGrip__OnMove(event) {
        const drag = Na__LeMarginGrip__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet || sheet.Sheet__Id !== drag.sheetId) { Na__LeMarginGrip__End(false); return; }
        const dx = event.clientX - drag.startX;
        if (!drag.moved && Math.abs(dx) < Na__LeMarginGrip__SLOP_PX) return;
        drag.moved = true;
        const scale = Na__LeSurface__GetPixelsPerMm() * (Na__LeSurface__GetZoom() || 1);
        const setup = Na__LeCfg__GetMarginNotesSetup();
        drag.width  = Math.round(Math.max(setup.minWidthMm, Math.min(drag.maxWidth, drag.startWidth - (dx / scale))) * 10) / 10;   // <-- Left is wider; tenths of a millimetre
        Na__LeModel__UpdateMarginNotes(sheet, { widthMm : drag.width }, true);
        Na__LeSurface__Refresh('markup');
        Na__LeMarginGrip__Render();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Release, Cancel or Escape
    // ------------------------------------------------------------
    function Na__LeMarginGrip__OnUp(event) {
        const drag = Na__LeMarginGrip__Drag;
        if (drag && event.pointerId === drag.pointerId) Na__LeMarginGrip__End(event.type === 'pointerup');
    }
    function Na__LeMarginGrip__OnKey(event) {
        if (event.key !== 'Escape' || !Na__LeMarginGrip__Drag) return;
        event.preventDefault();
        event.stopPropagation();                                                  // <-- Escape puts the margin back, not the tool down
        Na__LeMarginGrip__End(false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | End the Drag: One Announcement, or the Width Put Back
    // ------------------------------------------------------------
    function Na__LeMarginGrip__End(commit) {
        const drag = Na__LeMarginGrip__Drag;
        if (!drag) return;
        Na__LeMarginGrip__Drag = null;
        window.removeEventListener('pointermove',   Na__LeMarginGrip__OnMove, true);
        window.removeEventListener('pointerup',     Na__LeMarginGrip__OnUp, true);
        window.removeEventListener('pointercancel', Na__LeMarginGrip__OnUp, true);
        window.removeEventListener('keydown',       Na__LeMarginGrip__OnKey, true);
        document.body.classList.remove('na-le-dragging');
        try { if (Na__LeMarginGrip__Grip) Na__LeMarginGrip__Grip.releasePointerCapture(drag.pointerId); } catch (err) { /* already released */ }
        const sheet = Na__LeModel__GetActiveSheet();
        if (sheet && sheet.Sheet__Id === drag.sheetId && drag.moved) {
            if (commit) Na__LeModel__UpdateMarginNotes(sheet, { widthMm : drag.width }, false);   // <-- One announcement: one undo step for the whole drag
            else { Na__LeModel__UpdateMarginNotes(sheet, { widthMm : drag.startWidth }, true); Na__LeSurface__Refresh('markup'); }
        }
        Na__LeMarginGrip__Render();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Attach and Detach
// -----------------------------------------------------------------------------

    // FUNCTION | Follow the Sheet While Its Tools Are Attached
    // ------------------------------------------------------------
    // options: { editable }
    // ------------------------------------------------------------
    function Na__LeMarginGrip__Attach(options) {
        Na__LeMarginGrip__Editable = !!(options && options.editable);
        if (!Na__LeMarginGrip__Attached) {
            Na__LeMarginGrip__Attached = true;
            Na__LeMarginGrip__EVENTS.forEach((name) => window.addEventListener(name, Na__LeMarginGrip__Schedule));
        }
        Na__LeMarginGrip__Schedule();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop Following, Drop a Drag in Progress, Hide
    // ------------------------------------------------------------
    function Na__LeMarginGrip__Detach() {
        if (Na__LeMarginGrip__Drag) Na__LeMarginGrip__End(false);
        if (Na__LeMarginGrip__Attached) {
            Na__LeMarginGrip__Attached = false;
            Na__LeMarginGrip__EVENTS.forEach((name) => window.removeEventListener(name, Na__LeMarginGrip__Schedule));
        }
        if (Na__LeMarginGrip__Frame) { window.cancelAnimationFrame(Na__LeMarginGrip__Frame); Na__LeMarginGrip__Frame = 0; }
        Na__LeMarginGrip__Hide();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Margin Grip API
    // ------------------------------------------------------------
    export {
        Na__LeMarginGrip__Attach,
        Na__LeMarginGrip__Detach,
        Na__LeMarginGrip__Render
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
