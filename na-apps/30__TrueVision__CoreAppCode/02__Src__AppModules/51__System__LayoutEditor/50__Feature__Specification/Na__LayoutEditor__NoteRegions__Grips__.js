// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - OVERSPILL NOTE REGIONS - GRIPS
// =============================================================================
//
// FILE       : Na__LayoutEditor__NoteRegions__Grips__.js
// NAMESPACE  : Na__LeRegionGrip
// MODULE     : Layout Editor - Overspill Note Regions - Grips
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Take hold of a note region on the sheet - its edges and corners to resize it, the tab above it to move it - snapping as every grip does, and say when its notes do not fit
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - THE MARGIN GRIP'S WAY, FOR A BOX. The notes margin has one grip down its
//   divider (Na__LayoutEditor__MarginGrip__); a region has one down each of its
//   four sides, one on each corner and a tab above the middle of its top
//   side. They live in a layer of their own over the paper, counter-scaled so
//   they are the same size on screen at any zoom, and show nothing until the
//   pointer finds them: the side under it lights, the region's outline and its
//   tab come up. The Margin Notes panel lights them too, while the pointer is
//   over that region's fold (Highlight).
// - THEY SNAP LIKE EVERY OTHER GRIP (Na__LeOsnap__Snap): the drawings'
//   linework, the sheet's own vectors, the border, the title block, the notes
//   margin, the other regions, and the drawing grid when Grid Snap is on. A
//   side is handed the far side as where it is drawn FROM, so Perpendicular
//   finds the line square to it: dragged towards the margin's divider or the
//   top of the title block, a side lands flush on it wherever along it the
//   pointer is. The region itself is left out, so it never snaps to itself.
// - THE TAB MOVES IT WHOLE, as a vector is moved: every corner is offered at
//   where the move would put it and the nearest snap wins; with none in reach
//   the top left corner is put on the grid (Grid Snap). Shift, or Ortho, holds
//   the move to one axis, as the Move tool's.
// - A REGION IS NEVER SMALLER THAN IT MAY BE and never leaves the paper.
// - ONE UNDO STEP PER DRAG. The frame is set silently while the pointer moves
//   and announced once on release; Escape puts it back where it was. The
//   press never reaches the sheet tools, and the grips are only there with
//   the Select tool up in an editable session (or a Move that came up by
//   itself), so a leader's tip or a dimension's end can still be placed
//   exactly on a region's edge with their own tools.
// - A BADGE AT THE FOOT of the region where the list ran out says how many
//   notes are not shown. A screen-only warning, as the margin's is.
//
// INTEGRATION:
// - Attached and detached by the mode controller with the sheet tools, beside
//   the margin grip. Reads Na__LeMargin__Report for where each region is drawn
//   and what it lost; writes through Na__LeModel__UpdateNoteRegion.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (22-Sep-2026)
// - ValeVision    : not yet ported - it goes with the rest of the regions.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Config, Model, Surface, Layout, Tools, Snapping, Grid, Ortho, Specification and the Margin
    // ------------------------------------------------------------
    import { Na__LeCfg__GetMarginNotesSetup, Na__LeCfg__GetLabel, Na__LeCfg__FormatLabel } from '../03__Core__Config/Na__LayoutEditor__ConfigState__.js';
    import { Na__LeModel__CHANGED_EVENT, Na__LeModel__GetActiveSheet, Na__LeModel__UpdateNoteRegion } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeSurface__ZOOM_SETTLED_EVENT,
        Na__LeSurface__GetElements,
        Na__LeSurface__GetPixelsPerMm,
        Na__LeSurface__GetZoom,
        Na__LeSurface__GetLayout,
        Na__LeSurface__ClientToPaperMm,
        Na__LeSurface__Refresh
    } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeLayout__Solve } from '../07__Core__SheetData/Na__LayoutEditor__SheetLayout__.js';
    import { Na__LeTools__CHANGED_EVENT, Na__LeTools__TOOL_SELECT, Na__LeTools__GetTool, Na__LeTools__IsMoveAuto } from '../30__System__SheetTools/Na__LayoutEditor__SheetTools__.js';
    import { Na__LeOsnap__KIND_GRID, Na__LeOsnap__Snap, Na__LeOsnap__Find, Na__LeOsnap__ShowMarker, Na__LeOsnap__HideMarker } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Search__.js';
    import { Na__LeGrid__IsSnapping, Na__LeGrid__Nearest } from '../27__System__DrawingGrid/Na__LayoutEditor__DrawingGrid__State__.js';   // <-- A leaf: the grid's settings and its nearest point
    import { Na__LeOrtho__Resolve } from '../32__System__OrthoMode/Na__LayoutEditor__OrthoMode__State__.js';                               // <-- Shift, or Ortho, holds a move to one axis
    import { Na__LeSpec__CHANGED_EVENT } from './Na__LayoutEditor__SpecData__.js';
    import { Na__LeMargin__Report } from './Na__LayoutEditor__SpecMargin__.js';
    import { Na__LeRegionTool__PLACED_EVENT } from './Na__LayoutEditor__NoteRegions__Tool__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | What Moves the Grips, the Drag Slop, and the Grips Themselves
    // ------------------------------------------------------------
    const Na__LeRegionGrip__EVENTS  = [ Na__LeModel__CHANGED_EVENT, Na__LeSurface__ZOOM_SETTLED_EVENT, Na__LeTools__CHANGED_EVENT, Na__LeSpec__CHANGED_EVENT, Na__LeRegionTool__PLACED_EVENT, 'resize' ];   // <-- The margin grip's list: a zoom counts when it SETTLES
    const Na__LeRegionGrip__SLOP_PX = 2;                                      // <-- A press that moves less than this changes nothing
    const Na__LeRegionGrip__HANDLES = Object.freeze([                         // <-- part, class, cursor: the sides and corners a press takes hold of
        [ 'n',  'edge',   'ns-resize'   ], [ 'e',  'edge',   'ew-resize'   ], [ 's',  'edge',   'ns-resize'   ], [ 'w',  'edge',   'ew-resize'   ],
        [ 'nw', 'corner', 'nwse-resize' ], [ 'ne', 'corner', 'nesw-resize' ], [ 'se', 'corner', 'nwse-resize' ], [ 'sw', 'corner', 'nesw-resize' ],
        [ 'move', 'move', 'move' ]
    ]);
    // ------------------------------------------------------------

    // MODULE VARIABLES | Elements, Session, the Drag and the Region Lit From the Panel
    // ------------------------------------------------------------
    let Na__LeRegionGrip__Layer     = null;
    let Na__LeRegionGrip__Boxes     = new Map();   // <-- regionId -> { root, parts : { n, e, ... }, badge }
    let Na__LeRegionGrip__Editable  = false;
    let Na__LeRegionGrip__Attached  = false;
    let Na__LeRegionGrip__Frame     = 0;
    let Na__LeRegionGrip__Drag      = null;        // <-- { pointerId, sheetId, regionId, part, startX, startY, startMm, rect : { x0, y0, x1, y1 }, frame, moved }
    let Na__LeRegionGrip__Lit       = null;        // <-- The region the panel is pointing at
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendering
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Layer Once, and Keep It on the Paper
    // ------------------------------------------------------------
    function Na__LeRegionGrip__Ensure(paper) {
        if (!Na__LeRegionGrip__Layer) {
            const layer = document.createElement('div');
            layer.className = 'na-le-region-layer';
            Na__LeRegionGrip__Layer = layer;
        }
        if (Na__LeRegionGrip__Layer.parentNode !== paper) paper.appendChild(Na__LeRegionGrip__Layer);   // <-- A remounted surface has a new paper
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Region's Grips: Its Outline, Its Sides, Its Corners, Its Tab and Its Badge
    // ------------------------------------------------------------
    function Na__LeRegionGrip__Build(regionId) {
        const L    = Na__LeCfg__GetLabel;
        const root = document.createElement('div');
        root.className = 'na-le-region';
        root.setAttribute('data-na-region', regionId);
        const outline = document.createElement('div');
        outline.className = 'na-le-region__outline';
        root.appendChild(outline);
        const parts = {};
        Na__LeRegionGrip__HANDLES.forEach((spec) => {
            const part = document.createElement('div');
            part.className = 'na-le-region__' + spec[1] + ' na-le-region__' + spec[1] + '--' + spec[0];
            part.style.cursor = spec[2];
            part.title = spec[1] === 'move' ? L('RegionMoveTitle', 'Drag to move the region') : L('RegionGripTitle', 'Drag to resize the region');
            part.setAttribute('data-na-part', spec[0]);
            part.addEventListener('pointerdown', (event) => Na__LeRegionGrip__OnDown(event, regionId, spec[0]));
            part.addEventListener('dblclick', (event) => { event.preventDefault(); event.stopPropagation(); });   // <-- Never a double click into a viewport under the edge
            root.appendChild(part);
            parts[spec[0]] = part;
        });
        const badge = document.createElement('div');
        badge.className = 'na-le-margin-badge na-le-region__badge';           // <-- The margin's badge, word for word in its look
        root.appendChild(badge);
        return { root : root, parts : parts, badge : badge };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Place One Region's Grips Over the Box It Is Drawn In
    // ------------------------------------------------------------
    // rect is paper millimetres; everything is laid in paper pixels (the paper
    // is scaled by the zoom), and the grips' reach is divided by the zoom so
    // it is the same on screen at any zoom.
    // ------------------------------------------------------------
    function Na__LeRegionGrip__Place(box, rect, lost, gripsOn, ppm, zoom) {
        const reach = Na__LeCfg__GetMarginNotesSetup().regionGripPx / zoom;
        const x = rect.X * ppm, y = rect.Y * ppm, w = rect.WidthMm * ppm, h = rect.HeightMm * ppm;
        const set = (el, left, top, width, height) => { el.style.left = left + 'px'; el.style.top = top + 'px'; el.style.width = width + 'px'; el.style.height = height + 'px'; };
        set(box.root, x, y, w, h);
        const half = reach / 2, corner = reach * 1.4;
        const p = box.parts;
        set(p.n,  0, -half, w, reach);
        set(p.s,  0, h - half, w, reach);
        set(p.w,  -half, 0, reach, h);
        set(p.e,  w - half, 0, reach, h);
        set(p.nw, -corner / 2, -corner / 2, corner, corner);
        set(p.ne, w - (corner / 2), -corner / 2, corner, corner);
        set(p.se, w - (corner / 2), h - (corner / 2), corner, corner);
        set(p.sw, -corner / 2, h - (corner / 2), corner, corner);
        const tabW = reach * 3.2, tabH = reach * 1.3;
        set(p.move, (w - tabW) / 2, -tabH - (reach * 0.4), tabW, tabH);        // <-- Above the top side, clear of the title the region prints
        Object.keys(p).forEach((key) => { p[key].hidden = !gripsOn; });
        box.root.style.setProperty('--na-le-region-line', (1 / zoom) + 'px'); // <-- One screen pixel inside the paper's scale, for the outline
        box.badge.hidden = !(lost > 0);
        if (!box.badge.hidden) {
            box.badge.textContent     = Na__LeCfg__FormatLabel('RegionOverflowBadge', '{count} not shown - enlarge the region', { count : lost });
            box.badge.style.left      = (1.5 * ppm) + 'px';
            box.badge.style.bottom    = (1.5 * ppm) + 'px';
            box.badge.style.transform = 'scale(' + (1 / zoom) + ')';          // <-- Readable at any zoom, anchored at its lower left
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take Every Grip and Badge Away
    // ------------------------------------------------------------
    function Na__LeRegionGrip__Hide() {
        if (Na__LeRegionGrip__Layer) Na__LeRegionGrip__Layer.hidden = true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Place Every Drawn Region's Grips, and the Badge Where the List Ran Out
    // ------------------------------------------------------------
    function Na__LeRegionGrip__Render() {
        Na__LeRegionGrip__Frame = 0;
        const paper = Na__LeSurface__GetElements().paper;
        const sheet = Na__LeModel__GetActiveSheet();
        if (!Na__LeRegionGrip__Attached || !paper || !sheet) { Na__LeRegionGrip__Hide(); return; }
        const layout  = Na__LeSurface__GetLayout() || Na__LeLayout__Solve(sheet);
        const regions = Na__LeMargin__Report(sheet, layout).regions;
        if (!regions.length) {
            Na__LeRegionGrip__Hide();
            Na__LeRegionGrip__Boxes.forEach((box) => { if (box.root.parentNode) box.root.parentNode.removeChild(box.root); });
            Na__LeRegionGrip__Boxes = new Map();
            return;
        }
        Na__LeRegionGrip__Ensure(paper);
        Na__LeRegionGrip__Layer.hidden = false;

        const ppm     = Na__LeSurface__GetPixelsPerMm();
        const zoom    = Na__LeSurface__GetZoom() || 1;
        const drag    = Na__LeRegionGrip__Drag;
        const gripsOn = Na__LeRegionGrip__Editable && (!!drag || Na__LeTools__GetTool() === Na__LeTools__TOOL_SELECT || Na__LeTools__IsMoveAuto());   // <-- A Move that came up by itself is still Select at rest
        const alive   = new Set();
        regions.forEach((region) => {
            alive.add(region.id);
            let box = Na__LeRegionGrip__Boxes.get(region.id);
            if (!box) { box = Na__LeRegionGrip__Build(region.id); Na__LeRegionGrip__Boxes.set(region.id, box); }
            if (box.root.parentNode !== Na__LeRegionGrip__Layer) Na__LeRegionGrip__Layer.appendChild(box.root);
            Na__LeRegionGrip__Place(box, region.rect, region.lost, gripsOn, ppm, zoom);
            box.root.classList.toggle('is-dragging', !!drag && drag.regionId === region.id);
            box.root.classList.toggle('is-lit', Na__LeRegionGrip__Lit === region.id || (!!drag && drag.regionId === region.id));
            box.root.classList.toggle('is-editable', gripsOn);
        });
        Na__LeRegionGrip__Boxes.forEach((box, id) => {
            if (alive.has(id)) return;
            if (box.root.parentNode) box.root.parentNode.removeChild(box.root);
            Na__LeRegionGrip__Boxes.delete(id);
        });
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Redraw on the Next Animation Frame (asking twice costs nothing)
    // ------------------------------------------------------------
    function Na__LeRegionGrip__Schedule() {
        if (!Na__LeRegionGrip__Attached || Na__LeRegionGrip__Frame) return;
        Na__LeRegionGrip__Frame = window.requestAnimationFrame(Na__LeRegionGrip__Render);
    }
    // ------------------------------------------------------------


    // FUNCTION | Light One Region's Outline and Grips From the Panel (null for none)
    // ------------------------------------------------------------
    // The pointer over a region's fold in the Margin Notes panel says "that
    // one" on the sheet, so a region with no border lines and nothing in it
    // yet can still be found.
    // ------------------------------------------------------------
    function Na__LeRegionGrip__Highlight(regionId) {
        const next = regionId || null;
        if (Na__LeRegionGrip__Lit === next) return;
        Na__LeRegionGrip__Lit = next;
        Na__LeRegionGrip__Boxes.forEach((box, id) => box.root.classList.toggle('is-lit', id === next || (!!Na__LeRegionGrip__Drag && Na__LeRegionGrip__Drag.regionId === id)));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dragging
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Frame a Resize Gives: the Side or Corner Where It Snapped, Never Too Small, Kept on the Paper
    // ------------------------------------------------------------
    // The carried point is where the grabbed side or corner has been taken -
    // its starting place plus the pointer's travel, so a press a hair off the
    // line does not jump it. The far side is handed in as where the side is
    // drawn FROM, so Perpendicular lands it flush on a line square to it.
    // ------------------------------------------------------------
    function Na__LeRegionGrip__Resize(sheet, drag, dMm, page) {
        const least = Na__LeCfg__GetMarginNotesSetup().regionMinSizeMm;
        const r     = drag.rect;
        const part  = drag.part;
        const moveX = part.indexOf('e') !== -1 ? 'x1' : (part.indexOf('w') !== -1 ? 'x0' : null);
        const moveY = part.indexOf('s') !== -1 ? 'y1' : (part.indexOf('n') !== -1 ? 'y0' : null);
        const carried = {
            x : moveX ? r[moveX] + dMm.x : drag.startMm.x + dMm.x,
            y : moveY ? r[moveY] + dMm.y : drag.startMm.y + dMm.y
        };
        const from = [];
        if (moveX) from.push({ x : moveX === 'x1' ? r.x0 : r.x1, y : carried.y });
        if (moveY) from.push({ x : carried.x, y : moveY === 'y1' ? r.y0 : r.y1 });
        const snap = Na__LeOsnap__Snap(sheet, carried, { kind : 'noteregion', id : drag.regionId }, { from : from });
        const at   = snap.snapped ? snap : carried;
        const next = { x0 : r.x0, y0 : r.y0, x1 : r.x1, y1 : r.y1 };
        if (moveX === 'x0') next.x0 = Math.max(0, Math.min(r.x1 - least, at.x));
        if (moveX === 'x1') next.x1 = Math.min(page.WidthMm, Math.max(r.x0 + least, at.x));
        if (moveY === 'y0') next.y0 = Math.max(0, Math.min(r.y1 - least, at.y));
        if (moveY === 'y1') next.y1 = Math.min(page.HeightMm, Math.max(r.y0 + least, at.y));
        return { X : next.x0, Y : next.y0, WidthMm : next.x1 - next.x0, HeightMm : next.y1 - next.y0 };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Frame a Move Gives: the Corner Nearest a Snap Lands on It, Held to an Axis When Asked
    // ------------------------------------------------------------
    // Every corner is offered at where the move would put it; the nearest snap
    // wins and the move becomes whatever puts THAT corner on it. With none in
    // reach and Grid Snap on, the top left corner goes on the grid. A held
    // axis stays held through a snap, as the Move tool's does.
    // ------------------------------------------------------------
    function Na__LeRegionGrip__Move(sheet, drag, dMm, held, page) {
        const r    = drag.rect;
        const lock = held ? (Math.abs(dMm.x) >= Math.abs(dMm.y) ? 'x' : 'y') : null;
        const axis = lock === 'x' ? { x : dMm.x, y : 0 } : (lock === 'y' ? { x : 0, y : dMm.y } : dMm);
        const exclude = { kind : 'noteregion', id : drag.regionId };
        let best = null;
        [ [ r.x0, r.y0 ], [ r.x1, r.y0 ], [ r.x1, r.y1 ], [ r.x0, r.y1 ] ].forEach((c) => {
            const hit = Na__LeOsnap__Find(sheet, { x : c[0] + axis.x, y : c[1] + axis.y }, exclude);
            if (hit && (!best || hit.score < best.hit.score)) best = { hit : hit, ox : c[0], oy : c[1] };
        });
        let move = axis;
        if (best) {
            move = { x : lock === 'y' ? axis.x : best.hit.x - best.ox, y : lock === 'x' ? axis.y : best.hit.y - best.oy };
            Na__LeOsnap__ShowMarker(Object.assign({}, best.hit, { x : best.ox + move.x, y : best.oy + move.y }));
        } else if (Na__LeGrid__IsSnapping()) {
            const on = Na__LeGrid__Nearest({ x : r.x0 + axis.x, y : r.y0 + axis.y });
            move = { x : lock === 'y' ? axis.x : on.x - r.x0, y : lock === 'x' ? axis.y : on.y - r.y0 };
            Na__LeOsnap__ShowMarker({ x : r.x0 + move.x, y : r.y0 + move.y, kind : Na__LeOsnap__KIND_GRID });
        } else {
            Na__LeOsnap__HideMarker();
        }
        const w = r.x1 - r.x0, h = r.y1 - r.y0;
        return {
            X        : Math.max(0, Math.min(page.WidthMm - w, r.x0 + move.x)),
            Y        : Math.max(0, Math.min(page.HeightMm - h, r.y0 + move.y)),
            WidthMm  : w,
            HeightMm : h
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Press: Take the Pointer Before the Sheet Tools Do
    // ------------------------------------------------------------
    function Na__LeRegionGrip__OnDown(event, regionId, part) {
        if (event.button !== 0 || Na__LeRegionGrip__Drag || !Na__LeRegionGrip__Editable) return;   // <-- A right drag still pans the sheet from over a grip
        const sheet = Na__LeModel__GetActiveSheet();
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!sheet || !point) return;
        const layout = Na__LeSurface__GetLayout() || Na__LeLayout__Solve(sheet);
        const region = Na__LeMargin__Report(sheet, layout).regions.find((entry) => entry.id === regionId);
        if (!region) return;
        event.preventDefault();
        event.stopPropagation();                                                  // <-- The stage never sees it: no selection box, no click-through
        const rect = region.rect;
        Na__LeRegionGrip__Drag = {
            pointerId : event.pointerId,
            sheetId   : sheet.Sheet__Id,
            regionId  : regionId,
            part      : part,
            startX    : event.clientX,
            startY    : event.clientY,
            startMm   : point,
            rect      : { x0 : rect.X, y0 : rect.Y, x1 : rect.X + rect.WidthMm, y1 : rect.Y + rect.HeightMm },
            frame     : { X : rect.X, Y : rect.Y, WidthMm : rect.WidthMm, HeightMm : rect.HeightMm },
            moved     : false
        };
        try { event.currentTarget.setPointerCapture(event.pointerId); } catch (err) { /* A scripted pointer has nothing to capture; the window still hears it */ }
        window.addEventListener('pointermove',   Na__LeRegionGrip__OnMove, true);
        window.addEventListener('pointerup',     Na__LeRegionGrip__OnUp, true);
        window.addEventListener('pointercancel', Na__LeRegionGrip__OnUp, true);
        window.addEventListener('keydown',       Na__LeRegionGrip__OnKey, true);
        document.body.classList.add('na-le-dragging');
        Na__LeRegionGrip__Render();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Move: Re-Frame the Region Silently and Redraw Its Notes
    // ------------------------------------------------------------
    function Na__LeRegionGrip__OnMove(event) {
        const drag = Na__LeRegionGrip__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet || sheet.Sheet__Id !== drag.sheetId) { Na__LeRegionGrip__End(false); return; }
        if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < Na__LeRegionGrip__SLOP_PX) return;
        const point = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!point) return;
        drag.moved = true;
        const page  = (Na__LeSurface__GetLayout() || Na__LeLayout__Solve(sheet)).Page;
        const dMm   = { x : point.x - drag.startMm.x, y : point.y - drag.startMm.y };
        const frame = drag.part === 'move' ? Na__LeRegionGrip__Move(sheet, drag, dMm, Na__LeOrtho__Resolve(!!event.shiftKey), page) : Na__LeRegionGrip__Resize(sheet, drag, dMm, page);
        Na__LeModel__UpdateNoteRegion(sheet, drag.regionId, { frameMm : frame }, true);
        Na__LeSurface__Refresh('markup');
        Na__LeRegionGrip__Render();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Release, Cancel or Escape
    // ------------------------------------------------------------
    function Na__LeRegionGrip__OnUp(event) {
        const drag = Na__LeRegionGrip__Drag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.stopPropagation();
        Na__LeRegionGrip__End(event.type === 'pointerup');
    }
    function Na__LeRegionGrip__OnKey(event) {
        if (event.key !== 'Escape' || !Na__LeRegionGrip__Drag) return;
        event.preventDefault();
        event.stopPropagation();                                                  // <-- Escape puts the region back, not the tool down
        Na__LeRegionGrip__End(false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | End the Drag: One Announcement, or the Frame Put Back
    // ------------------------------------------------------------
    function Na__LeRegionGrip__End(commit) {
        const drag = Na__LeRegionGrip__Drag;
        if (!drag) return;
        Na__LeRegionGrip__Drag = null;
        window.removeEventListener('pointermove',   Na__LeRegionGrip__OnMove, true);
        window.removeEventListener('pointerup',     Na__LeRegionGrip__OnUp, true);
        window.removeEventListener('pointercancel', Na__LeRegionGrip__OnUp, true);
        window.removeEventListener('keydown',       Na__LeRegionGrip__OnKey, true);
        document.body.classList.remove('na-le-dragging');
        Na__LeOsnap__HideMarker();
        const sheet = Na__LeModel__GetActiveSheet();
        if (sheet && sheet.Sheet__Id === drag.sheetId && drag.moved) {
            if (commit) {
                const kept = (sheet.Sheet__MarginNotes && Array.isArray(sheet.Sheet__MarginNotes.Regions)) ? sheet.Sheet__MarginNotes.Regions.find((region) => region.Region__Id === drag.regionId) : null;
                Na__LeModel__UpdateNoteRegion(sheet, drag.regionId, { frameMm : kept ? kept.Region__FrameMm : drag.frame }, false);   // <-- One announcement: one undo step for the whole drag
            } else {
                Na__LeModel__UpdateNoteRegion(sheet, drag.regionId, { frameMm : drag.frame }, true);
                Na__LeSurface__Refresh('markup');
            }
        }
        Na__LeRegionGrip__Render();
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
    function Na__LeRegionGrip__Attach(options) {
        Na__LeRegionGrip__Editable = !!(options && options.editable);
        if (!Na__LeRegionGrip__Attached) {
            Na__LeRegionGrip__Attached = true;
            Na__LeRegionGrip__EVENTS.forEach((name) => window.addEventListener(name, Na__LeRegionGrip__Schedule));
        }
        Na__LeRegionGrip__Schedule();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop Following, Drop a Drag in Progress, Hide
    // ------------------------------------------------------------
    function Na__LeRegionGrip__Detach() {
        if (Na__LeRegionGrip__Drag) Na__LeRegionGrip__End(false);
        if (Na__LeRegionGrip__Attached) {
            Na__LeRegionGrip__Attached = false;
            Na__LeRegionGrip__EVENTS.forEach((name) => window.removeEventListener(name, Na__LeRegionGrip__Schedule));
        }
        if (Na__LeRegionGrip__Frame) { window.cancelAnimationFrame(Na__LeRegionGrip__Frame); Na__LeRegionGrip__Frame = 0; }
        Na__LeRegionGrip__Lit = null;
        Na__LeRegionGrip__Hide();
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Region Being Dragged
    // ------------------------------------------------------------
    function Na__LeRegionGrip__IsDragging() { return !!Na__LeRegionGrip__Drag; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Note Region Grips API
    // ------------------------------------------------------------
    export {
        Na__LeRegionGrip__Attach,
        Na__LeRegionGrip__Detach,
        Na__LeRegionGrip__Render,
        Na__LeRegionGrip__Highlight,
        Na__LeRegionGrip__IsDragging
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
