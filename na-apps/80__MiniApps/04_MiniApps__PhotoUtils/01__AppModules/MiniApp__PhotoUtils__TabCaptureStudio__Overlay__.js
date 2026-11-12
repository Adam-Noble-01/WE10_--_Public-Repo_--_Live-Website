// =============================================================================
// NOBLE ARCHITECTURE - TAB CAPTURE STUDIO - FLOATING CONTROL WINDOW
// =============================================================================
//
// FILE    : MiniApp__PhotoUtils__TabCaptureStudio__Overlay__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Always-on-top control window (Document Picture-in-Picture) that
//           floats over the captured tab: REC state, timer, count, live view,
//           change meter, pause, capture now, stop, and the frame editor
// CREATED : 12-Nov-2026
//
// NOTES:
// - Tab capture records only the tab's own pixels, so this window never
//   appears in the images even when it sits over the frame.
// - The window can only be opened from a click on the main page.
// - Its DOM is built from this module's realm; per-window APIs
//   (ResizeObserver, requestAnimationFrame) come from the floating window.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__PhotoUtils__TabCaptureStudio__RegionEditor__.js
import { Na__TabCapture__RegionEditor } from "./MiniApp__PhotoUtils__TabCaptureStudio__RegionEditor__.js";

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Format milliseconds as m:ss
// ------------------------------------------------------------
export function Na__TabCapture__FormatTime(Na__Ms) {
    const Na__Sec = Math.floor(Na__Ms / 1000);
    const Na__H   = Math.floor(Na__Sec / 3600);
    const Na__M   = Math.floor((Na__Sec % 3600) / 60);
    const Na__S   = String(Na__Sec % 60).padStart(2, "0");
    return Na__H ? `${Na__H}:${String(Na__M).padStart(2, "0")}:${Na__S}` : `${Na__M}:${Na__S}`;
}
// ------------------------------------------------------------


// FUNCTION | Copy this page's stylesheets into another document
// ------------------------------------------------------------
function Na__CopyStyles(Na__TargetDoc) {
    [...document.styleSheets].forEach((Na__Sheet) => {
        try {
            const Na__Css   = [...Na__Sheet.cssRules].map((Na__Rule) => Na__Rule.cssText).join("\n");
            const Na__Style = Na__TargetDoc.createElement("style");
            Na__Style.textContent = Na__Css;
            Na__TargetDoc.head.append(Na__Style);
        } catch (Na__Err) {
            if (!Na__Sheet.href) return;
            const Na__Link = Na__TargetDoc.createElement("link");
            Na__Link.rel  = "stylesheet";
            Na__Link.href = Na__Sheet.href;
            Na__TargetDoc.head.append(Na__Link);
        }
    });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Overlay
// -----------------------------------------------------------------------------

// CLASS | Na__TabCapture__Overlay - floating control window
// ------------------------------------------------------------
export class Na__TabCapture__Overlay {

    // METHOD | Is Document Picture-in-Picture available
    // ------------------------------------------------------------
    static isSupported() {
        return "documentPictureInPicture" in window;
    }
    // ------------------------------------------------------------


    // METHOD | Constructor
    // ------------------------------------------------------------
    // Options: width, height, uiText, getRegion, setRegion, getAspect, getLabel,
    //          minPx, onPause, onResume, onStop, onSnap, onClosed
    constructor(Na__Opts) {
        this.o       = Na__Opts;
        this.win     = null;
        this.editor  = null;
        this.view    = "region";
        this.state   = "idle";
        this.rafId   = 0;
        this.lastPaint = 0;
    }
    // ------------------------------------------------------------


    // METHOD | Is the window open
    // ------------------------------------------------------------
    get isOpen() {
        return !!this.win && !this.win.closed;
    }
    // ------------------------------------------------------------


    // METHOD | Open the window (call from a click handler, before any other await)
    // ------------------------------------------------------------
    async open(Na__Stream) {
        if (this.isOpen) return true;
        if (!Na__TabCapture__Overlay.isSupported()) return false;

        const Na__Win = await window.documentPictureInPicture.requestWindow({
            width  : this.o.width,
            height : this.o.height
        });
        this.win = Na__Win;
        const d  = Na__Win.document;
        Na__CopyStyles(d);
        d.title = "Tab Capture";
        d.body.className = "TCS__pip-body";
        this.Na__Build(d);


        // Live view and frame editor
        // ------------------------------------
        this.editor = new Na__TabCapture__RegionEditor({
            host      : this.el.editorHost,
            doc       : d,
            win       : Na__Win,
            stream    : Na__Stream,
            getRegion : this.o.getRegion,
            onChange  : this.o.setRegion,
            getAspect : this.o.getAspect,
            getLabel  : this.o.getLabel,
            minPx     : this.o.minPx
        });
        this.setView(this.view);
        this.Na__Paint = this.Na__Paint.bind(this);
        this.rafId = Na__Win.requestAnimationFrame(this.Na__Paint);


        // Closing the window (its own close button or Back to tab)
        // ------------------------------------
        Na__Win.addEventListener("pagehide", () => {
            if (this.editor) this.editor.destroy();
            this.editor = null;
            this.win    = null;
            if (this.o.onClosed) this.o.onClosed();
        }, { once: true });

        return true;
    }
    // ------------------------------------------------------------


    // METHOD | Build the window's DOM
    // ------------------------------------------------------------
    Na__Build(d) {
        const Na__Make = (Na__Tag, Na__Class, Na__Text) => {
            const n = d.createElement(Na__Tag);
            if (Na__Class) n.className = Na__Class;
            if (Na__Text !== undefined) n.textContent = Na__Text;
            return n;
        };
        const el = {};

        el.root    = Na__Make("div", "TCS__pip");
        el.header  = Na__Make("div", "TCS__pip-header");
        el.dot     = Na__Make("span", "TCS__pip-dot");
        el.state   = Na__Make("span", "TCS__pip-state", "Ready");
        el.timer   = Na__Make("span", "TCS__pip-timer", "0:00");
        el.count   = Na__Make("span", "TCS__pip-count", "0 images");
        el.header.append(el.dot, el.state, el.timer, el.count);

        el.viewBox    = Na__Make("div", "TCS__pip-view");
        el.editorHost = Na__Make("div", "TCS__pip-editor");
        el.crop       = Na__Make("canvas", "TCS__pip-crop");
        el.countdown  = Na__Make("div", "TCS__pip-countdown");
        el.flash      = Na__Make("div", "TCS__pip-flash");
        el.viewBox.append(el.editorHost, el.crop, el.countdown, el.flash);

        el.meterRow  = Na__Make("div", "TCS__pip-meter-row");
        el.meterText = Na__Make("span", "TCS__pip-meter-text", "");
        el.thumb     = Na__Make("img", "TCS__pip-thumb");
        el.thumb.alt = "Last image";
        el.meter     = Na__Make("div", "TCS__meter");
        el.meterFill = Na__Make("div", "TCS__meter-fill");
        el.meterMark = Na__Make("div", "TCS__meter-mark");
        el.meter.append(el.meterFill, el.meterMark);
        const Na__MeterCol = Na__Make("div", "TCS__pip-meter-col");
        Na__MeterCol.append(el.meterText, el.meter);
        el.meterRow.append(Na__MeterCol, el.thumb);

        el.buttons = Na__Make("div", "TCS__pip-buttons");
        el.pause   = Na__Make("button", "TCS__btn TCS__btn--secondary", "Pause");
        el.snap    = Na__Make("button", "TCS__btn TCS__btn--secondary", "Capture now");
        el.stop    = Na__Make("button", "TCS__btn TCS__btn--stop", "Stop and save");
        el.buttons.append(el.pause, el.snap, el.stop);

        el.tabs      = Na__Make("div", "TCS__pip-tabs");
        el.viewCrop  = Na__Make("button", "TCS__pip-tab", "Frame view");
        el.viewFrame = Na__Make("button", "TCS__pip-tab", "Edit frame");
        el.hint      = Na__Make("span", "TCS__pip-hint", "Space: capture, P: pause");
        el.tabs.append(el.viewCrop, el.viewFrame, el.hint);

        el.root.append(el.header, el.viewBox, el.meterRow, el.buttons, el.tabs);
        d.body.append(el.root);
        [el.pause, el.snap, el.stop, el.viewCrop, el.viewFrame].forEach((b) => { b.type = "button"; });


        // Button and key wiring
        // ------------------------------------
        el.pause.addEventListener("click", () => this.Na__TogglePause());
        el.snap.addEventListener("click",  () => this.o.onSnap());
        el.stop.addEventListener("click",  () => this.o.onStop());
        el.viewCrop.addEventListener("click",  () => this.setView("region"));
        el.viewFrame.addEventListener("click", () => this.setView("frame"));
        d.addEventListener("keydown", (e) => {
            if (e.target && e.target.classList && e.target.classList.contains("TCS__region-box") && e.key.startsWith("Arrow")) return;
            if (e.code === "Space") { e.preventDefault(); this.o.onSnap(); }
            if (e.key === "p" || e.key === "P") { e.preventDefault(); this.Na__TogglePause(); }
        });

        this.el = el;
    }
    // ------------------------------------------------------------


    // METHOD | Pause or resume
    // ------------------------------------------------------------
    Na__TogglePause() {
        if (this.state === "recording") this.o.onPause();
        else if (this.state === "paused") this.o.onResume();
    }
    // ------------------------------------------------------------


    // METHOD | Switch between the framed view and the frame editor
    // ------------------------------------------------------------
    setView(Na__View) {
        this.view = Na__View;
        if (!this.el) return;
        const Na__IsRegion = Na__View === "region";
        this.el.crop.style.display = Na__IsRegion ? "block" : "none";
        this.el.viewCrop.classList.toggle("TCS__pip-tab--active", Na__IsRegion);
        this.el.viewFrame.classList.toggle("TCS__pip-tab--active", !Na__IsRegion);
        if (this.editor) {
            this.editor.setEditable(!Na__IsRegion);
            this.editor.layout();
        }
    }
    // ------------------------------------------------------------


    // METHOD | Paint the framed region into the view (about 20 fps)
    // ------------------------------------------------------------
    Na__Paint(Na__T) {
        if (!this.isOpen) return;
        this.rafId = this.win.requestAnimationFrame(this.Na__Paint);
        if (this.view !== "region" || !this.editor || Na__T - this.lastPaint < 48) return;
        this.lastPaint = Na__T;

        const v  = this.editor.video;
        const vw = v.videoWidth, vh = v.videoHeight;
        const c  = this.el.crop;
        const Na__Dpr = this.win.devicePixelRatio || 1;
        const cw = Math.max(1, Math.round(c.clientWidth  * Na__Dpr));
        const ch = Math.max(1, Math.round(c.clientHeight * Na__Dpr));
        if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#0d0f12";
        ctx.fillRect(0, 0, cw, ch);
        if (!vw || !vh) return;

        const r  = this.o.getRegion();
        const sx = r.x * vw, sy = r.y * vh, sw = Math.max(1, r.w * vw), sh = Math.max(1, r.h * vh);
        const s  = Math.min(cw / sw, ch / sh);
        const dw = sw * s, dh = sh * s;
        ctx.drawImage(v, sx, sy, sw, sh, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    }
    // ------------------------------------------------------------


    // METHOD | Swap the stream (a new tab was chosen)
    // ------------------------------------------------------------
    setStream(Na__Stream) {
        if (this.editor) this.editor.setStream(Na__Stream);
    }
    // ------------------------------------------------------------


    // METHOD | Redraw the frame after the region or the grid changed
    // ------------------------------------------------------------
    renderRegion() {
        if (this.editor) this.editor.render();
    }

    setGrid(Na__On) {
        if (this.editor) this.editor.setGrid(Na__On);
    }
    // ------------------------------------------------------------


    // METHOD | Update texts, meter and buttons from a status snapshot
    // ------------------------------------------------------------
    // Snapshot: state, stateText, elapsedMs, captured, countdownMs, mode,
    //           changePct, changeTarget, waiting, still, nextInMs, intervalMs
    update(s) {
        if (!this.isOpen || !this.el) return;
        const el = this.el;
        this.state = s.state;

        el.root.dataset.state = s.state;
        el.state.textContent  = s.stateText;
        el.timer.textContent  = Na__TabCapture__FormatTime(s.elapsedMs || 0);
        el.count.textContent  = `${s.captured} image${s.captured === 1 ? "" : "s"}`;
        el.countdown.textContent  = s.state === "countdown" ? String(Math.ceil(s.countdownMs / 1000)) : "";
        el.countdown.style.display = s.state === "countdown" ? "flex" : "none";

        el.pause.textContent = s.state === "paused" ? "Resume" : "Pause";
        el.pause.disabled    = !(s.state === "recording" || s.state === "paused");
        el.snap.disabled     = !(s.state === "recording" || s.state === "paused");
        el.stop.disabled     = !(s.state === "recording" || s.state === "paused" || s.state === "countdown");


        // Meter: change progress, interval countdown, or nothing in manual
        // ------------------------------------
        if (s.mode === "change") {
            const Na__Pct = Math.min(100, s.changePct);
            el.meterFill.style.width  = `${Na__Pct}%`;
            el.meterMark.style.left   = `${Math.min(100, s.changeTarget)}%`;
            el.meterMark.style.display = "block";
            el.meterFill.classList.toggle("TCS__meter-fill--hot", s.changePct >= s.changeTarget);
            const Na__Wait = s.waiting ? (s.still ? "settled" : "waiting to settle") : (s.still ? "still" : "moving");
            el.meterText.textContent = `Change ${s.changePct.toFixed(1)}% of ${s.changeTarget}% (${Na__Wait})`;
        } else if (s.mode === "interval") {
            const Na__Done = s.intervalMs > 0 ? 100 * (1 - s.nextInMs / s.intervalMs) : 0;
            el.meterFill.style.width   = `${Math.max(0, Math.min(100, Na__Done))}%`;
            el.meterMark.style.display = "none";
            el.meterFill.classList.remove("TCS__meter-fill--hot");
            el.meterText.textContent = s.state === "recording" ? `Next image in ${(s.nextInMs / 1000).toFixed(1)} s` : "Timed";
        } else {
            el.meterFill.style.width   = "0%";
            el.meterMark.style.display = "none";
            el.meterText.textContent   = "Manual: Capture now or Space";
        }
    }
    // ------------------------------------------------------------


    // METHOD | Flash on capture, and show the newest thumbnail
    // ------------------------------------------------------------
    shutter(Na__Flash) {
        if (!this.isOpen || !Na__Flash) return;
        const f = this.el.flash;
        f.classList.remove("TCS__pip-flash--on");
        void f.offsetWidth;
        f.classList.add("TCS__pip-flash--on");
    }

    setThumb(Na__Url) {
        if (this.isOpen && this.el) this.el.thumb.src = Na__Url;
    }
    // ------------------------------------------------------------


    // METHOD | Close the window
    // ------------------------------------------------------------
    close() {
        if (this.isOpen) this.win.close();
    }
    // ------------------------------------------------------------
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
