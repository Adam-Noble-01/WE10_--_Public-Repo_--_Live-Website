// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - SHEET IMAGES - CROP
// =============================================================================
//
// FILE       : Na__LayoutEditor__SheetImages__Crop__.js
// NAMESPACE  : Na__LeImgCrop
// MODULE     : Layout Editor - Sheet Images - Crop
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Crop a picture on the sheet: the whole picture shown dimmed round the kept part, eight handles and a slide
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - OPENED by a double-click on a picture, from its right-click menu, or from
//   the Images panel. The whole stored picture is laid over the sheet at the
//   picture's own scale, dimmed everywhere but the part that is kept - the
//   Statement Writer's crop, on the paper.
// - THE EIGHT HANDLES MOVE THE KEPT PART'S EDGES, and the picture does not
//   move or scale while they do: cropping takes paper away. A handle's edge
//   snaps in the sheet's snap system, so a crop can line up with the next
//   picture's edge. A drag INSIDE the kept part slides the picture under a
//   frame that stays put, for reframing without re-laying out the sheet.
// - Enter or Done keeps the crop as one undo step; Escape or Cancel leaves
//   the picture exactly as it was; a press anywhere else on the sheet keeps
//   it, as clicking away from a text box keeps the text. "Whole picture"
//   takes the crop off - the frame grows back round all of it, the picture
//   staying where it is.
// - THE CROP IS A CROP OF THE STORED FILE. Nothing is re-encoded and nothing
//   is uploaded: Image__Crop records the kept part and every surface cuts it
//   out as it paints, so a crop can always be widened again.
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

    // MODULE IMPORTS | Model, Surface, Snapping, Menus and the Feature
    // ------------------------------------------------------------
    import {
        Na__LeModel__CHANGED_EVENT,
        Na__LeModel__GetActiveSheet,
        Na__LeModel__GetSheetById,
        Na__LeModel__GetShapeById,
        Na__LeModel__UpdateShape,
        Na__LeModel__IsLayerLocked
    } from '../07__Core__SheetData/Na__LayoutEditor__SheetModel__.js';
    import {
        Na__LeSurface__ZOOM_EVENT,
        Na__LeSurface__GetElements,
        Na__LeSurface__GetPixelsPerMm,
        Na__LeSurface__GetZoom,
        Na__LeSurface__ClientToPaperMm
    } from '../10__Core__SheetSurface/Na__LayoutEditor__SheetSurface__.js';
    import { Na__LeOsnap__Snap, Na__LeOsnap__HideMarker } from '../28__System__ObjectSnap/Na__LayoutEditor__ObjectSnap__Search__.js';
    import { Na__LeMenu__Close } from '../30__System__SheetTools/Na__LayoutEditor__ContextMenu__.js';
    import { Na__LeImgGeo__Rect, Na__LeImgGeo__WholeRect, Na__LeImgGeo__NormaliseCrop, Na__LeImgGeo__CropOf, Na__LeImgGeo__RectPoints, Na__LeImgGeo__PrintDpi } from './Na__LayoutEditor__SheetImages__Geometry__.js';
    import { Na__LeImgCfg__Crop, Na__LeImgCfg__Label } from './Na__LayoutEditor__SheetImages__Setup__.js';
    import { Na__LeImgDraw__Block } from './Na__LayoutEditor__SheetImages__Paint__.js';
    import { Na__LeImgSrc__Url } from './Na__LayoutEditor__SheetImages__Source__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Eight Handles, and Which Edges Each One Moves
    // ------------------------------------------------------------
    // The Statement Writer's table: a handle is its place on the kept part and
    // the edges it drags.
    // ------------------------------------------------------------
    const Na__LeImgCrop__HANDLES = Object.freeze([
        { Id : 'nw', Edges : [ 'top', 'left' ],     Cursor : 'nwse-resize', X : 0,   Y : 0   },
        { Id : 'n',  Edges : [ 'top' ],             Cursor : 'ns-resize',   X : 0.5, Y : 0   },
        { Id : 'ne', Edges : [ 'top', 'right' ],    Cursor : 'nesw-resize', X : 1,   Y : 0   },
        { Id : 'e',  Edges : [ 'right' ],           Cursor : 'ew-resize',   X : 1,   Y : 0.5 },
        { Id : 'se', Edges : [ 'bottom', 'right' ], Cursor : 'nwse-resize', X : 1,   Y : 1   },
        { Id : 's',  Edges : [ 'bottom' ],          Cursor : 'ns-resize',   X : 0.5, Y : 1   },
        { Id : 'sw', Edges : [ 'bottom', 'left' ],  Cursor : 'nesw-resize', X : 0,   Y : 1   },
        { Id : 'w',  Edges : [ 'left' ],            Cursor : 'ew-resize',   X : 0,   Y : 0.5 }
    ]);
    const Na__LeImgCrop__GRIP_PX     = 12;                                        // <-- On screen, at any zoom
    const Na__LeImgCrop__STAGE_CLASS = 'na-le-stage--image-cropping';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Crop in Progress
    // ------------------------------------------------------------
    let Na__LeImgCrop__Session = null;   // <-- { sheetId, shapeId, whole, kept, start, els, drag }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Box { x0, y0, x1, y1, w, h } From Its Edges
    // ------------------------------------------------------------
    function Na__LeImgCrop__Box(x0, y0, x1, y1) {
        return { x0 : x0, y0 : y0, x1 : x1, y1 : y1, w : x1 - x0, h : y1 - y0 };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Element With a Class
    // ------------------------------------------------------------
    function Na__LeImgCrop__El(tag, className, text) {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Lay a Paper Box Onto an Element (the paper is in pixels at zoom 1)
    // ------------------------------------------------------------
    function Na__LeImgCrop__Place(element, box, ppm) {
        element.style.left   = (box.x0 * ppm) + 'px';
        element.style.top    = (box.y0 * ppm) + 'px';
        element.style.width  = (box.w * ppm) + 'px';
        element.style.height = (box.h * ppm) + 'px';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Crop the Session Would Write, as Fractions (null = whole)
    // ------------------------------------------------------------
    function Na__LeImgCrop__CropNow(session) {
        const w = session.whole, k = session.kept;
        return Na__LeImgGeo__NormaliseCrop({
            L : (k.x0 - w.x0) / w.w,
            T : (k.y0 - w.y0) / w.h,
            R : (k.x1 - w.x0) / w.w,
            B : (k.y1 - w.y0) / w.h
        }, 0.005);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing the Overlay
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Put Every Part of the Overlay Where the Session Says
    // ------------------------------------------------------------
    // The overlay sits inside the paper, which the surface scales by the zoom,
    // so everything that must keep its screen size - the grips, the outline
    // and the bar - is sized by 1 / zoom.
    // ------------------------------------------------------------
    function Na__LeImgCrop__Draw() {
        const session = Na__LeImgCrop__Session;
        if (!session) return;
        const ppm  = Na__LeSurface__GetPixelsPerMm();
        const zoom = Math.max(1e-6, Na__LeSurface__GetZoom());
        const els  = session.els;
        Na__LeImgCrop__Place(els.picture, session.whole, ppm);
        Na__LeImgCrop__Place(els.kept, session.kept, ppm);
        els.kept.style.outlineWidth = (1 / zoom) + 'px';
        const size = Na__LeImgCrop__GRIP_PX / zoom;
        els.grips.forEach((entry) => {
            entry.el.style.width  = size + 'px';
            entry.el.style.height = size + 'px';
            entry.el.style.left   = ((entry.handle.X * session.kept.w * ppm) - (size / 2)) + 'px';
            entry.el.style.top    = ((entry.handle.Y * session.kept.h * ppm) - (size / 2)) + 'px';
            entry.el.style.borderWidth = (1 / zoom) + 'px';
        });
        els.bar.style.left      = ((session.kept.x0 + (session.kept.w / 2)) * ppm) + 'px';
        els.bar.style.top       = ((session.kept.y1 * ppm) + (10 / zoom)) + 'px';
        els.bar.style.transform = 'translateX(-50%) scale(' + (1 / zoom) + ')';
        const shape = Na__LeModel__GetShapeById(Na__LeModel__GetSheetById(session.sheetId), session.shapeId);
        const block = Na__LeImgDraw__Block(shape);
        const dpi   = block ? Na__LeImgGeo__PrintDpi(session.kept, block.Image__PixelW, block.Image__PixelH, Na__LeImgCrop__CropNow(session)) : 0;
        els.size.textContent = session.kept.w.toFixed(0) + ' x ' + session.kept.h.toFixed(0) + ' mm' + (dpi ? ' - ' + Math.round(dpi) + ' dpi' : '');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Overlay's Elements Inside the Paper
    // ------------------------------------------------------------
    function Na__LeImgCrop__Build(paper, url) {
        const root    = Na__LeImgCrop__El('div', 'na-le-img-crop');
        const picture = Na__LeImgCrop__El('img', 'na-le-img-crop__picture');
        picture.src = url;
        picture.alt = '';
        picture.draggable = false;
        const kept = Na__LeImgCrop__El('div', 'na-le-img-crop__kept');
        kept.title = Na__LeImgCfg__Label('CropHint', 'Drag the handles to crop, or drag inside to move the kept part. Enter keeps it, Esc cancels.');
        kept.addEventListener('pointerdown', (event) => Na__LeImgCrop__PressKept(event));
        const grips = Na__LeImgCrop__HANDLES.map((handle) => {
            const el = Na__LeImgCrop__El('span', 'na-le-img-crop__grip');
            el.style.cursor = handle.Cursor;
            el.addEventListener('pointerdown', (event) => Na__LeImgCrop__PressGrip(event, handle));
            kept.appendChild(el);
            return { handle : handle, el : el };
        });
        const bar    = Na__LeImgCrop__El('div', 'na-le-img-crop__bar');
        const size   = Na__LeImgCrop__El('span', 'na-le-img-crop__size', '');
        const whole  = Na__LeImgCrop__El('button', 'na-le-btn na-le-btn--small', Na__LeImgCfg__Label('CropReset', 'Whole picture'));
        const cancel = Na__LeImgCrop__El('button', 'na-le-btn na-le-btn--small', Na__LeImgCfg__Label('CropCancel', 'Cancel'));
        const done   = Na__LeImgCrop__El('button', 'na-le-btn na-le-btn--small na-le-btn--primary', Na__LeImgCfg__Label('CropDone', 'Done'));
        [ whole, cancel, done ].forEach((button) => { button.type = 'button'; });
        whole.addEventListener('click',  (event) => { event.preventDefault(); Na__LeImgCrop__Reset(); });
        cancel.addEventListener('click', (event) => { event.preventDefault(); Na__LeImgCrop__Close(false); });
        done.addEventListener('click',   (event) => { event.preventDefault(); Na__LeImgCrop__Close(true); });
        bar.appendChild(size);
        bar.appendChild(whole);
        bar.appendChild(cancel);
        bar.appendChild(done);
        root.appendChild(picture);
        root.appendChild(kept);
        root.appendChild(bar);
        // THE OVERLAY'S PRESSES ARE ITS OWN. The stage's sheet tools listen
        // for the same events one level up; a press on the bar that reached
        // them would deselect the picture being cropped.
        [ 'pointerdown', 'dblclick', 'contextmenu', 'click' ].forEach((name) => {
            [ kept, bar ].forEach((element) => element.addEventListener(name, (event) => {
                event.stopPropagation();
                if (name === 'contextmenu' || name === 'dblclick') event.preventDefault();
            }));
        });
        paper.appendChild(root);
        return { root : root, picture : picture, kept : kept, grips : grips, bar : bar, size : size };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dragging a Handle, or the Picture Under the Frame
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Press on a Handle: Drag Its Edges
    // ------------------------------------------------------------
    function Na__LeImgCrop__PressGrip(event, handle) {
        const session = Na__LeImgCrop__Session;
        if (!session || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        const at = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!at) return;
        const k = session.kept;
        session.drag = {
            pointerId : event.pointerId,
            edges     : handle.Edges,
            from      : Object.assign({}, k),
            grabX     : at.x - (k.x0 + (handle.X * k.w)),                       // <-- How far off the handle it was taken, so it does not jump to the pointer
            grabY     : at.y - (k.y0 + (handle.Y * k.h))
        };
        Na__LeImgCrop__Listen(true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Press Inside the Kept Part: Slide the Picture Under It
    // ------------------------------------------------------------
    function Na__LeImgCrop__PressKept(event) {
        const session = Na__LeImgCrop__Session;
        if (!session || event.button !== 0 || event.target !== session.els.kept) return;
        event.preventDefault();
        event.stopPropagation();
        const at = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!at) return;
        session.drag = { pointerId : event.pointerId, slide : true, from : Object.assign({}, session.whole), at : at };
        Na__LeImgCrop__Listen(true);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Pointer Move During a Handle Drag or a Slide
    // ------------------------------------------------------------
    function Na__LeImgCrop__OnMove(event) {
        const session = Na__LeImgCrop__Session;
        const drag    = session ? session.drag : null;
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault();
        event.stopPropagation();
        const at = Na__LeSurface__ClientToPaperMm(event.clientX, event.clientY);
        if (!at) return;
        const whole = session.whole, kept = session.kept;
        if (drag.slide) {
            // THE PICTURE SLIDES, THE FRAME STAYS: the kept part must stay
            // inside the picture, so the slide stops at the picture's edge.
            const dx = at.x - drag.at.x, dy = at.y - drag.at.y;
            const x0 = Math.min(kept.x0, Math.max(kept.x1 - drag.from.w, drag.from.x0 + dx));
            const y0 = Math.min(kept.y0, Math.max(kept.y1 - drag.from.h, drag.from.y0 + dy));
            session.whole = Na__LeImgCrop__Box(x0, y0, x0 + drag.from.w, y0 + drag.from.h);
            Na__LeImgCrop__Draw();
            return;
        }
        // A HANDLE: its edges follow the pointer, snapped in the sheet's own
        // system with the picture left out, held inside the picture and apart
        // by the smallest span.
        const shapeSheet = Na__LeModel__GetSheetById(session.sheetId);
        const aim  = { x : at.x - drag.grabX, y : at.y - drag.grabY };
        const snap = shapeSheet ? Na__LeOsnap__Snap(shapeSheet, aim, { kind : 'shape', id : session.shapeId }) : { snapped : false };
        const px   = snap.snapped ? snap.x : aim.x;
        const py   = snap.snapped ? snap.y : aim.y;
        const span = Na__LeImgCfg__Crop().minSpan;
        const minW = span * whole.w, minH = span * whole.h;
        let x0 = drag.from.x0, y0 = drag.from.y0, x1 = drag.from.x1, y1 = drag.from.y1;
        drag.edges.forEach((edge) => {
            if (edge === 'left')   x0 = Math.min(Math.max(whole.x0, px), x1 - minW);
            if (edge === 'right')  x1 = Math.max(Math.min(whole.x1, px), x0 + minW);
            if (edge === 'top')    y0 = Math.min(Math.max(whole.y0, py), y1 - minH);
            if (edge === 'bottom') y1 = Math.max(Math.min(whole.y1, py), y0 + minH);
        });
        session.kept = Na__LeImgCrop__Box(x0, y0, x1, y1);
        Na__LeImgCrop__Draw();
    }
    function Na__LeImgCrop__OnUp(event) {
        const session = Na__LeImgCrop__Session;
        if (!session || !session.drag || event.pointerId !== session.drag.pointerId) return;
        event.stopPropagation();
        session.drag = null;
        Na__LeOsnap__HideMarker();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Keys, Presses Elsewhere, and Changes Underneath
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Enter Keeps, Escape Cancels - Ahead of the Sheet's Own Keys
    // ------------------------------------------------------------
    // Any other key the sheet would act on - Delete, an arrow nudge, a tool
    // letter - is kept from it while the crop is open: it would act on the
    // picture under the overlay. A shortcut with Ctrl or Cmd (undo, save)
    // keeps the crop first and then goes on, and typing in a box elsewhere is
    // left alone.
    // ------------------------------------------------------------
    function Na__LeImgCrop__OnKey(event) {
        if (!Na__LeImgCrop__Session) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); Na__LeImgCrop__Close(false); return; }
        if (event.key === 'Enter')  { event.preventDefault(); event.stopPropagation(); Na__LeImgCrop__Close(true); return; }
        const target = event.target;
        const typing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName || ''));
        if (typing) return;
        if (event.ctrlKey || event.metaKey) { Na__LeImgCrop__Close(true); return; }
        if (/^(Shift|Control|Alt|Meta)$/.test(event.key)) return;
        event.stopPropagation();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Press Anywhere Off the Overlay Keeps the Crop
    // ------------------------------------------------------------
    // ON THE SHEET THE PRESS DOES THAT AND NOTHING ELSE. Move is up while a
    // picture is selected, so a press that went on to the sheet tools would
    // drag the picture just cropped - a near miss of a handle moved the
    // picture 21 mm in testing. Off the sheet - the toolbar, a panel - the
    // press goes on as meant, so one click both keeps the crop and uses the
    // button.
    // ------------------------------------------------------------
    function Na__LeImgCrop__OnPressAnywhere(event) {
        const session = Na__LeImgCrop__Session;
        if (!session || session.drag) return;
        if (session.els.root.contains(event.target)) return;
        const stage = Na__LeSurface__GetElements().stage;
        Na__LeImgCrop__Close(true);
        if (stage && stage.contains(event.target)) {
            event.preventDefault();
            event.stopPropagation();
            Na__LeImgCrop__SwallowNext();                                       // <-- Its click, too
        }
    }
    function Na__LeImgCrop__SwallowNext() {
        const once = (name) => {
            const swallow = (event) => { event.stopPropagation(); event.preventDefault(); window.removeEventListener(name, swallow, true); };
            window.addEventListener(name, swallow, true);
            window.setTimeout(() => window.removeEventListener(name, swallow, true), 800);   // <-- A click that never comes must not keep the next one
        };
        once('pointerup');
        once('click');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Picture Went Away Underneath (an undo, a delete, another sheet)
    // ------------------------------------------------------------
    function Na__LeImgCrop__OnModel() {
        const session = Na__LeImgCrop__Session;
        if (!session) return;
        const sheet = Na__LeModel__GetActiveSheet();
        if (!sheet || sheet.Sheet__Id !== session.sheetId || !Na__LeModel__GetShapeById(sheet, session.shapeId)) Na__LeImgCrop__Close(false);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Listen for a Drag, or for the Session
    // ------------------------------------------------------------
    function Na__LeImgCrop__Listen(dragging) {
        if (dragging) {
            window.addEventListener('pointermove',   Na__LeImgCrop__OnMove, true);
            window.addEventListener('pointerup',     Na__LeImgCrop__OnUp, true);
            window.addEventListener('pointercancel', Na__LeImgCrop__OnUp, true);
            return;
        }
        window.removeEventListener('pointermove',   Na__LeImgCrop__OnMove, true);
        window.removeEventListener('pointerup',     Na__LeImgCrop__OnUp, true);
        window.removeEventListener('pointercancel', Na__LeImgCrop__OnUp, true);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Open the Crop on a Picture (true when it opened)
    // ------------------------------------------------------------
    function Na__LeImgCrop__Open(sheet, shapeId) {
        if (Na__LeImgCrop__Session) Na__LeImgCrop__Close(true);
        const shape = sheet ? Na__LeModel__GetShapeById(sheet, shapeId) : null;
        const block = Na__LeImgDraw__Block(shape);
        if (!block || Na__LeModel__IsLayerLocked(sheet, shape.Shape__LayerId)) return false;
        const url   = Na__LeImgSrc__Url(block.Image__Folder, block.Image__File);
        const paper = Na__LeSurface__GetElements().paper;
        const stage = Na__LeSurface__GetElements().stage;
        if (!url || !paper) return false;                                       // <-- Not loaded yet: there is nothing to crop against
        Na__LeMenu__Close();
        const rect = Na__LeImgGeo__Rect(shape.Shape__Points);
        const kept = Na__LeImgCrop__Box(rect.x0, rect.y0, rect.x1, rect.y1);
        const whole = Na__LeImgGeo__WholeRect(rect, block.Image__Crop);
        Na__LeImgCrop__Session = {
            sheetId : sheet.Sheet__Id,
            shapeId : shapeId,
            whole   : Na__LeImgCrop__Box(whole.x0, whole.y0, whole.x1, whole.y1),
            kept    : kept,
            start   : { points : shape.Shape__Points.map((p) => [ p[0], p[1] ]), crop : Na__LeImgGeo__CropOf(block.Image__Crop) },
            els     : Na__LeImgCrop__Build(paper, url),
            drag    : null
        };
        if (stage) stage.classList.add(Na__LeImgCrop__STAGE_CLASS);
        Na__LeImgCrop__Draw();
        window.addEventListener('keydown', Na__LeImgCrop__OnKey, true);
        window.addEventListener('pointerdown', Na__LeImgCrop__OnPressAnywhere, true);
        window.addEventListener(Na__LeModel__CHANGED_EVENT, Na__LeImgCrop__OnModel);
        window.addEventListener(Na__LeSurface__ZOOM_EVENT, Na__LeImgCrop__Draw);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Take the Crop Off: the Whole Picture, Where It Is
    // ------------------------------------------------------------
    function Na__LeImgCrop__Reset() {
        const session = Na__LeImgCrop__Session;
        if (!session) return;
        session.kept = Object.assign({}, session.whole);
        Na__LeImgCrop__Draw();
    }
    // ------------------------------------------------------------


    // FUNCTION | Finish: Keep the Crop as One Undo Step, or Leave the Picture Alone
    // ------------------------------------------------------------
    function Na__LeImgCrop__Close(keep) {
        const session = Na__LeImgCrop__Session;
        if (!session) return false;
        Na__LeImgCrop__Session = null;
        Na__LeImgCrop__Listen(false);
        window.removeEventListener('keydown', Na__LeImgCrop__OnKey, true);
        window.removeEventListener('pointerdown', Na__LeImgCrop__OnPressAnywhere, true);
        window.removeEventListener(Na__LeModel__CHANGED_EVENT, Na__LeImgCrop__OnModel);
        window.removeEventListener(Na__LeSurface__ZOOM_EVENT, Na__LeImgCrop__Draw);
        Na__LeOsnap__HideMarker();
        if (session.els.root.parentNode) session.els.root.parentNode.removeChild(session.els.root);
        const stage = Na__LeSurface__GetElements().stage;
        if (stage) stage.classList.remove(Na__LeImgCrop__STAGE_CLASS);
        if (!keep) return false;
        const sheet = Na__LeModel__GetSheetById(session.sheetId);
        if (!sheet || !Na__LeModel__GetShapeById(sheet, session.shapeId)) return false;
        const crop   = Na__LeImgCrop__CropNow(session);
        const points = Na__LeImgGeo__RectPoints(session.kept.x0, session.kept.y0, session.kept.w, session.kept.h);
        const was    = session.start;
        const same   = points.every((p, i) => Math.abs(p[0] - was.points[i][0]) < 1e-6 && Math.abs(p[1] - was.points[i][1]) < 1e-6) &&
            [ 'L', 'T', 'R', 'B' ].every((key) => Math.abs(Na__LeImgGeo__CropOf(crop)[key] - was.crop[key]) < 1e-6);
        if (same) return false;                                                 // <-- Opened and closed: nothing to undo
        return Na__LeModel__UpdateShape(sheet, session.shapeId, { points : points, image : { Image__Crop : crop || null } }, false);
    }
    // ------------------------------------------------------------


    // FUNCTION | Is a Crop Open
    // ------------------------------------------------------------
    function Na__LeImgCrop__IsOpen() { return !!Na__LeImgCrop__Session; }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Sheet Images Crop API
    // ------------------------------------------------------------
    export {
        Na__LeImgCrop__Open,
        Na__LeImgCrop__Reset,
        Na__LeImgCrop__Close,
        Na__LeImgCrop__IsOpen
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
