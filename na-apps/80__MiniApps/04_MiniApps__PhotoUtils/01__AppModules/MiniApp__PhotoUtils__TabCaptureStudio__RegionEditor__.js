// =============================================================================
// NOBLE ARCHITECTURE - TAB CAPTURE STUDIO - REGION EDITOR
// =============================================================================
//
// FILE    : MiniApp__PhotoUtils__TabCaptureStudio__RegionEditor__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Live view of the shared tab with a movable, resizable capture frame
// CREATED : 12-Nov-2026
//
// NOTES:
// - The frame is held in normalised units (0 to 1 of the source frame), so it
//   survives a change of capture resolution and shows the same on any size of
//   view. The owner keeps the value; this editor reads it and reports edits.
// - Used twice: on the main page and in the floating window. Pass that
//   window's document and window: a ResizeObserver from a hidden page would
//   never fire for the floating window.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Geometry Helpers
// -----------------------------------------------------------------------------

const Na__Clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));


// FUNCTION | Rectangle from a fixed anchor to the pointer, with optional aspect
// ------------------------------------------------------------
// Na__Rn is the aspect in normalised units (width / height), 0 for free.
function Na__FitFromAnchor(ax, ay, px, py, Na__Rn, minW, minH) {
    const Na__Left = px < ax;
    const Na__Up   = py < ay;
    const maxW = Na__Left ? ax : 1 - ax;
    const maxH = Na__Up   ? ay : 1 - ay;
    let w = Math.abs(px - ax);
    let h = Math.abs(py - ay);

    if (Na__Rn > 0) {
        if (w / Math.max(h, 1e-9) > Na__Rn) h = w / Na__Rn; else w = h * Na__Rn;
        if (w > maxW) { w = maxW; h = w / Na__Rn; }
        if (h > maxH) { h = maxH; w = h * Na__Rn; }
        if (w < minW) { w = minW; h = w / Na__Rn; }
        if (h < minH) { h = minH; w = h * Na__Rn; }
    } else {
        w = Na__Clamp(w, minW, maxW);
        h = Na__Clamp(h, minH, maxH);
    }

    return {
        x : Na__Clamp(Na__Left ? ax - w : ax, 0, 1 - w),
        y : Na__Clamp(Na__Up   ? ay - h : ay, 0, 1 - h),
        w, h
    };
}
// ------------------------------------------------------------


// FUNCTION | Resize from an edge handle (n, s, e, w)
// ------------------------------------------------------------
function Na__ResizeEdge(s, Na__Handle, px, py, Na__Rn, minW, minH) {
    let L = s.x, T = s.y, R = s.x + s.w, B = s.y + s.h;
    const cx = s.x + s.w / 2, cy = s.y + s.h / 2;

    if (Na__Handle === "n") T = Na__Clamp(py, 0, B - minH);
    if (Na__Handle === "s") B = Na__Clamp(py, T + minH, 1);
    if (Na__Handle === "w") L = Na__Clamp(px, 0, R - minW);
    if (Na__Handle === "e") R = Na__Clamp(px, L + minW, 1);
    if (!(Na__Rn > 0)) return { x: L, y: T, w: R - L, h: B - T };


    // Aspect locked: the other side follows, centred on the old centre
    // ------------------------------------
    if (Na__Handle === "n" || Na__Handle === "s") {
        let h = B - T, w = h * Na__Rn;
        const maxW = 2 * Math.min(cx, 1 - cx);
        if (w > maxW) { w = maxW; h = w / Na__Rn; }
        return { x: cx - w / 2, y: Na__Handle === "n" ? B - h : T, w, h };
    }
    let w = R - L, h = w / Na__Rn;
    const maxH = 2 * Math.min(cy, 1 - cy);
    if (h > maxH) { h = maxH; w = h * Na__Rn; }
    return { x: Na__Handle === "w" ? R - w : L, y: cy - h / 2, w, h };
}
// ------------------------------------------------------------


// FUNCTION | Fit a region to an aspect, centred inside the current one
// ------------------------------------------------------------
export function Na__TabCapture__FitRegionToAspect(r, Na__Rn) {
    if (!(Na__Rn > 0)) return r;
    let w = r.w, h = r.h;
    if (w / h > Na__Rn) w = h * Na__Rn; else h = w / Na__Rn;
    return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Region Editor
// -----------------------------------------------------------------------------

// CLASS | Na__TabCapture__RegionEditor - live view plus capture frame
// ------------------------------------------------------------
export class Na__TabCapture__RegionEditor {

    // METHOD | Constructor - builds the view inside the host element
    // ------------------------------------------------------------
    // Options: host, stream, doc, win, getRegion(), onChange(region),
    //          getAspect() (pixel ratio, 0 = free), getLabel(region, w, h), minPx
    constructor(Na__Opts) {
        this.doc       = Na__Opts.doc || document;
        this.win       = Na__Opts.win || window;
        this.host      = Na__Opts.host;
        this.getRegion = Na__Opts.getRegion;
        this.onChange  = Na__Opts.onChange;
        this.getAspect = Na__Opts.getAspect || (() => 0);
        this.getLabel  = Na__Opts.getLabel  || null;
        this.minPx     = Na__Opts.minPx || 32;
        this.drag      = null;

        const d = this.doc;
        this.wrap  = d.createElement("div");
        this.wrap.className = "TCS__frame-wrap";

        this.video = d.createElement("video");
        this.video.className   = "TCS__frame-video";
        this.video.muted       = true;
        this.video.autoplay    = true;
        this.video.playsInline = true;

        this.layer = d.createElement("div");
        this.layer.className = "TCS__region-layer";

        this.box = d.createElement("div");
        this.box.className = "TCS__region-box";
        this.box.tabIndex  = 0;
        this.box.setAttribute("aria-label", "Capture frame");

        this.grid = d.createElement("div");
        this.grid.className = "TCS__region-grid";

        this.label = d.createElement("span");
        this.label.className = "TCS__region-label";

        this.box.append(this.grid, this.label);
        ["nw", "n", "ne", "e", "se", "s", "sw", "w"].forEach((Na__H) => {
            const Na__Handle = d.createElement("div");
            Na__Handle.className = `TCS__region-handle TCS__region-handle--${Na__H}`;
            Na__Handle.dataset.handle = Na__H;
            this.box.append(Na__Handle);
        });

        this.layer.append(this.box);
        this.wrap.append(this.video, this.layer);
        this.host.append(this.wrap);


        // Events
        // ------------------------------------
        this.Na__OnLayout = () => this.layout();
        this.video.addEventListener("loadedmetadata", this.Na__OnLayout);
        this.video.addEventListener("resize", this.Na__OnLayout);
        this.observer = new this.win.ResizeObserver(this.Na__OnLayout);
        this.observer.observe(this.host);

        this.layer.addEventListener("pointerdown",   (e) => this.Na__PointerDown(e));
        this.layer.addEventListener("pointermove",   (e) => this.Na__PointerMove(e));
        this.layer.addEventListener("pointerup",     (e) => this.Na__PointerUp(e));
        this.layer.addEventListener("pointercancel", (e) => this.Na__PointerUp(e));
        this.box.addEventListener("keydown",         (e) => this.Na__KeyDown(e));

        this.setStream(Na__Opts.stream);
    }
    // ------------------------------------------------------------


    // METHOD | Attach a MediaStream to the view
    // ------------------------------------------------------------
    setStream(Na__Stream) {
        this.video.srcObject = Na__Stream || null;
        if (Na__Stream) this.video.play().catch(() => {});
        this.layout();
    }
    // ------------------------------------------------------------


    // METHOD | Source size in pixels (0 until the first frame)
    // ------------------------------------------------------------
    get srcW() { return this.video.videoWidth  || 0; }
    get srcH() { return this.video.videoHeight || 0; }
    // ------------------------------------------------------------


    // METHOD | Fit the view to the host, keeping the source aspect
    // ------------------------------------------------------------
    layout() {
        const hw = this.host.clientWidth, hh = this.host.clientHeight;
        const vw = this.srcW, vh = this.srcH;
        if (!vw || !vh || !hw || !hh) {
            this.wrap.style.visibility = vw ? "visible" : "hidden";
            return;
        }
        const s = Math.min(hw / vw, hh / vh);
        this.wrap.style.width      = `${Math.floor(vw * s)}px`;
        this.wrap.style.height     = `${Math.floor(vh * s)}px`;
        this.wrap.style.visibility = "visible";
        this.render();
    }
    // ------------------------------------------------------------


    // METHOD | Draw the frame from the owner's region
    // ------------------------------------------------------------
    render() {
        const r = this.getRegion();
        this.box.style.left   = `${r.x * 100}%`;
        this.box.style.top    = `${r.y * 100}%`;
        this.box.style.width  = `${r.w * 100}%`;
        this.box.style.height = `${r.h * 100}%`;
        const Na__Text = this.getLabel ? this.getLabel(r, this.srcW, this.srcH)
                                       : `${Math.round(r.w * this.srcW)} x ${Math.round(r.h * this.srcH)} px`;
        this.label.textContent = Na__Text;
    }
    // ------------------------------------------------------------


    // METHOD | Grid and edit switches
    // ------------------------------------------------------------
    setGrid(Na__On)     { this.box.classList.toggle("TCS__region-box--grid", !!Na__On); }
    setEditable(Na__On) { this.layer.classList.toggle("TCS__region-layer--locked", !Na__On); }
    // ------------------------------------------------------------


    // METHOD | Remove the view
    // ------------------------------------------------------------
    destroy() {
        this.observer.disconnect();
        this.video.srcObject = null;
        this.wrap.remove();
    }
    // ------------------------------------------------------------


    // METHOD | Aspect ratio in normalised units
    // ------------------------------------------------------------
    Na__NormAspect() {
        const Na__Px = this.getAspect();
        return Na__Px > 0 && this.srcW && this.srcH ? Na__Px * this.srcH / this.srcW : 0;
    }
    // ------------------------------------------------------------


    // METHOD | Pointer position in normalised units
    // ------------------------------------------------------------
    Na__Point(e) {
        const Na__Rect = this.layer.getBoundingClientRect();
        return {
            x : Na__Clamp((e.clientX - Na__Rect.left) / Math.max(1, Na__Rect.width),  0, 1),
            y : Na__Clamp((e.clientY - Na__Rect.top)  / Math.max(1, Na__Rect.height), 0, 1)
        };
    }
    // ------------------------------------------------------------


    // METHOD | Pointer down: resize, move or draw a new frame
    // ------------------------------------------------------------
    Na__PointerDown(e) {
        if (e.button !== 0 || this.layer.classList.contains("TCS__region-layer--locked") || !this.srcW) return;
        const p = this.Na__Point(e);
        const Na__Handle = e.target.dataset ? e.target.dataset.handle : null;
        const Na__Mode = Na__Handle ? "resize" : (this.box.contains(e.target) ? "move" : "draw");
        this.drag = { mode: Na__Mode, handle: Na__Handle, start: { ...this.getRegion() }, p0: p };
        this.layer.setPointerCapture(e.pointerId);
        this.box.focus({ preventScroll: true });
        e.preventDefault();
    }
    // ------------------------------------------------------------


    // METHOD | Pointer move: apply the drag
    // ------------------------------------------------------------
    Na__PointerMove(e) {
        if (!this.drag) return;
        const p    = this.Na__Point(e);
        const s    = this.drag.start;
        const rn   = this.Na__NormAspect();
        const minW = Math.min(1, this.minPx / this.srcW);
        const minH = Math.min(1, this.minPx / this.srcH);
        let r;

        if (this.drag.mode === "move") {
            r = {
                x : Na__Clamp(s.x + (p.x - this.drag.p0.x), 0, 1 - s.w),
                y : Na__Clamp(s.y + (p.y - this.drag.p0.y), 0, 1 - s.h),
                w : s.w, h : s.h
            };
        } else if (this.drag.mode === "draw") {
            r = Na__FitFromAnchor(this.drag.p0.x, this.drag.p0.y, p.x, p.y, rn, minW, minH);
        } else if (this.drag.handle.length === 2) {
            const ax = this.drag.handle.includes("w") ? s.x + s.w : s.x;
            const ay = this.drag.handle.includes("n") ? s.y + s.h : s.y;
            r = Na__FitFromAnchor(ax, ay, p.x, p.y, rn, minW, minH);
        } else {
            r = Na__ResizeEdge(s, this.drag.handle, p.x, p.y, rn, minW, minH);
        }

        this.onChange(r);
    }
    // ------------------------------------------------------------


    // METHOD | Pointer up: end the drag
    // ------------------------------------------------------------
    Na__PointerUp(e) {
        if (!this.drag) return;
        this.drag = null;
        try { this.layer.releasePointerCapture(e.pointerId); } catch (Na__Err) { /* already released */ }
    }
    // ------------------------------------------------------------


    // METHOD | Arrow keys nudge the frame, Alt + arrows resize it
    // ------------------------------------------------------------
    Na__KeyDown(e) {
        const Na__Dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!Na__Dir || !this.srcW || this.layer.classList.contains("TCS__region-layer--locked")) return;
        e.preventDefault();
        const Na__Step = e.shiftKey ? 10 : 1;
        const dx = Na__Dir[0] * Na__Step / this.srcW, dy = Na__Dir[1] * Na__Step / this.srcH;
        const r = { ...this.getRegion() };

        if (e.altKey) {
            r.w = Na__Clamp(r.w + dx, this.minPx / this.srcW, 1 - r.x);
            r.h = Na__Clamp(r.h + dy, this.minPx / this.srcH, 1 - r.y);
        } else {
            r.x = Na__Clamp(r.x + dx, 0, 1 - r.w);
            r.y = Na__Clamp(r.y + dy, 0, 1 - r.h);
        }
        this.onChange(r);
    }
    // ------------------------------------------------------------
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
