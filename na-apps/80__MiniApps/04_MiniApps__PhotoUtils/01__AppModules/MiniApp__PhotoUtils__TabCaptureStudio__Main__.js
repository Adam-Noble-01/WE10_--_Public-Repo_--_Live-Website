// =============================================================================
// NOBLE ARCHITECTURE - TAB CAPTURE STUDIO - MAIN
// =============================================================================
//
// FILE    : MiniApp__PhotoUtils__TabCaptureStudio__Main__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Config load, settings form, tab sharing, the capture worker, the
//           floating window, the filmstrip and saving (zip or folder)
// CREATED : 12-Nov-2026
//
// FLOW:
//   Choose tab -> getDisplayMedia -> MediaStreamTrackProcessor -> its frame
//   stream is handed to the worker, which decides when to capture and sends
//   back encoded images. This page keeps them, shows them and saves them.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__PhotoUtils__TabCaptureStudio__RegionEditor__.js
import { Na__TabCapture__RegionEditor, Na__TabCapture__FitRegionToAspect } from "./MiniApp__PhotoUtils__TabCaptureStudio__RegionEditor__.js";

// @delegate: ./MiniApp__PhotoUtils__TabCaptureStudio__Overlay__.js
import { Na__TabCapture__Overlay, Na__TabCapture__FormatTime } from "./MiniApp__PhotoUtils__TabCaptureStudio__Overlay__.js";

// @delegate: ./MiniApp__PhotoUtils__TabCaptureStudio__ZipWriter__.js
import { Na__TabCapture__BuildZips, Na__TabCapture__TextEntry } from "./MiniApp__PhotoUtils__TabCaptureStudio__ZipWriter__.js";

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 const Na__ConfigPath  = "./MiniApp__PhotoUtils__TabCaptureStudio__AppConfig__.json";   // Resolved against the page
 const Na__StorageKey  = "NaMiniApp__TabCaptureStudio__Settings__v1";
 const Na__WorkerFile  = "./MiniApp__PhotoUtils__TabCaptureStudio__Worker__.js";        // Resolved against this module

 let Na__Config        = null;
 let Na__Ui            = null;           // NaMiniApp__UiText
 let Na__Cap           = null;           // NaMiniApp__Capture
 let Na__Settings      = null;

 let Na__Stream        = null;
 let Na__Track         = null;
 let Na__ProcTrack     = null;           // clone handed to the frame processor
 let Na__Worker        = null;
 let Na__Editor        = null;
 let Na__Overlay       = null;
 let Na__Stats         = null;
 let Na__WorkerState   = "idle";
 let Na__Saving        = false;
 let Na__LockedRatio   = 0;

 let Na__Entries       = [];
 let Na__TotalBytes    = 0;
 let Na__RunName       = "";
 let Na__RunStartWall  = 0;
 let Na__RootDir       = null;
 let Na__RunDir        = null;           // Promise of the folder this run writes to
 let Na__WriteChain    = Promise.resolve();
 let Na__AudioCtx      = null;
 let Na__ToastTimer    = 0;
 let Na__LastDropToast = 0;

 const Na__Bindings = [
     ["IntervalSec",      "js__intervalSec",      "num"],
     ["SkipDuplicates",   "js__skipDuplicates",   "bool"],
     ["DuplicatePct",     "js__duplicatePct",     "num"],
     ["ChangePct",        "js__changePct",        "num"],
     ["TolerancePct",     "js__tolerancePct",     "num"],
     ["SettleOn",         "js__settleOn",         "bool"],
     ["SettleMs",         "js__settleMs",         "num"],
     ["SettleTimeoutSec", "js__settleTimeoutSec", "num"],
     ["MinGapSec",        "js__minGapSec",        "num"],
     ["Format",           "js__format",           "str"],
     ["Quality",          "js__quality",          "num"],
     ["Scale",            "js__scale",            "num"],
     ["SaveTo",           "js__saveTo",           "str"],
     ["Subfolder",        "js__subfolder",        "bool"],
     ["StartDelaySec",    "js__startDelaySec",    "num"],
     ["MaxImages",        "js__maxImages",        "num"],
     ["MaxMinutes",       "js__maxMinutes",       "num"],
     ["Sound",            "js__sound",            "bool"],
     ["Flash",            "js__flash",            "bool"],
     ["Grid",             "js__grid",             "bool"],
     ["Aspect",           "js__aspect",           "str"]
 ];

 const Na__$ = (Na__Id) => document.getElementById(Na__Id);

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Small Helpers
// -----------------------------------------------------------------------------

// FUNCTION | Show a short message in the workspace
// ------------------------------------------------------------
function Na__Toast(Na__Text, Na__Ms) {
    const t = Na__$("js__toast");
    t.textContent = Na__Text;
    t.classList.add("TCS__toast--show");
    clearTimeout(Na__ToastTimer);
    Na__ToastTimer = setTimeout(() => t.classList.remove("TCS__toast--show"), Na__Ms || 4500);
}
// ------------------------------------------------------------


// FUNCTION | Default set name from the date and time
// ------------------------------------------------------------
function Na__DefaultSetName() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `Capture_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}
// ------------------------------------------------------------


// FUNCTION | Safe file name stem
// ------------------------------------------------------------
function Na__SafeName(Na__Text) {
    const s = String(Na__Text || "").trim().replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").replace(/^\.+/, "");
    return s.slice(0, 80) || Na__DefaultSetName();
}
// ------------------------------------------------------------


// FUNCTION | Megabytes text
// ------------------------------------------------------------
function Na__Mb(Na__Bytes) {
    return Na__Bytes >= 1e9 ? `${(Na__Bytes / 1e9).toFixed(2)} GB` : `${(Na__Bytes / 1e6).toFixed(1)} MB`;
}
// ------------------------------------------------------------


// FUNCTION | Start a browser download of a Blob
// ------------------------------------------------------------
function Na__Download(Na__Blob, Na__Name) {
    const Na__Url = URL.createObjectURL(Na__Blob);
    const a = document.createElement("a");
    a.href = Na__Url;
    a.download = Na__Name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(Na__Url), 120000);
}
// ------------------------------------------------------------


// FUNCTION | Soft shutter click (Web Audio, no sound file)
// ------------------------------------------------------------
function Na__ShutterSound() {
    if (!Na__AudioCtx) return;
    const ctx = Na__AudioCtx;
    const Na__Len = Math.floor(ctx.sampleRate * 0.05);
    const Na__Buf = ctx.createBuffer(1, Na__Len, ctx.sampleRate);
    const Na__Ch  = Na__Buf.getChannelData(0);
    for (let i = 0; i < Na__Len; i++) Na__Ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / Na__Len, 3);
    const Na__Src  = ctx.createBufferSource();
    const Na__Gain = ctx.createGain();
    Na__Gain.gain.value = 0.25;
    Na__Src.buffer = Na__Buf;
    Na__Src.connect(Na__Gain).connect(ctx.destination);
    Na__Src.start();
}
// ------------------------------------------------------------


// FUNCTION | Run state as the page sees it
// ------------------------------------------------------------
function Na__RunState() {
    if (Na__Saving) return "saving";
    if (Na__WorkerState !== "idle") return Na__WorkerState;
    return Na__Stream ? "ready" : "nosource";
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Settings
// -----------------------------------------------------------------------------

// FUNCTION | Defaults from the AppConfig, overlaid with the last saved settings
// ------------------------------------------------------------
function Na__LoadSettings() {
    const Na__Defaults = JSON.parse(JSON.stringify(Na__Config.NaMiniApp__Defaults));
    let Na__Saved = {};
    try { Na__Saved = JSON.parse(localStorage.getItem(Na__StorageKey) || "{}") || {}; } catch (e) { Na__Saved = {}; }
    const s = Object.assign({}, Na__Defaults, Na__Saved);


    // A saved value of the wrong type (1.0.0 saved Scale as null) falls back to the default
    // ------------------------------------
    Object.keys(Na__Defaults).forEach((Na__Key) => {
        const d = Na__Defaults[Na__Key];
        if (typeof d === "number"  && !Number.isFinite(s[Na__Key])) s[Na__Key] = d;
        if (typeof d === "boolean" && typeof s[Na__Key] !== "boolean") s[Na__Key] = d;
        if (typeof d === "string"  && typeof s[Na__Key] !== "string")  s[Na__Key] = d;
    });
    const r = s.Region || {};
    s.Region = (r.w > 0 && r.h > 0) ? r : { x: 0, y: 0, w: 1, h: 1 };
    return s;
}
// ------------------------------------------------------------


// FUNCTION | Persist settings (the set name is not kept)
// ------------------------------------------------------------
function Na__SaveSettings() {
    try { localStorage.setItem(Na__StorageKey, JSON.stringify(Na__Settings)); } catch (e) { /* private window */ }
}
// ------------------------------------------------------------


// FUNCTION | Settings to the form
// ------------------------------------------------------------
function Na__WriteForm() {
    Na__Bindings.forEach(([Na__Key, Na__Id, Na__Kind]) => {
        const n = Na__$(Na__Id);
        if (Na__Kind === "bool") n.checked = !!Na__Settings[Na__Key];
        else n.value = Na__Settings[Na__Key];
    });
    document.querySelectorAll('input[name="js__mode"]').forEach((n) => { n.checked = n.value === Na__Settings.Mode; });
    Na__WriteRegionInputs();
    Na__ApplyFormVisibility();
}
// ------------------------------------------------------------


// FUNCTION | Form to settings (numbers clamped to each input's min and max)
// ------------------------------------------------------------
function Na__ReadForm() {
    const Na__Defaults = Na__Config.NaMiniApp__Defaults;
    Na__Bindings.forEach(([Na__Key, Na__Id, Na__Kind]) => {
        const n = Na__$(Na__Id);
        if (Na__Kind === "bool") { Na__Settings[Na__Key] = n.checked; return; }
        if (Na__Kind === "str")  { Na__Settings[Na__Key] = n.value;   return; }
        // Selects have no min / max: read the attributes, never the properties
        // ------------------------------------
        let v = parseFloat(n.value);
        if (!Number.isFinite(v)) v = Na__Defaults[Na__Key];
        const Na__Min = parseFloat(n.getAttribute("min"));
        const Na__Max = parseFloat(n.getAttribute("max"));
        if (Number.isFinite(Na__Min)) v = Math.max(Na__Min, v);
        if (Number.isFinite(Na__Max)) v = Math.min(Na__Max, v);
        Na__Settings[Na__Key] = v;
    });
    const Na__Mode = document.querySelector('input[name="js__mode"]:checked');
    Na__Settings.Mode = Na__Mode ? Na__Mode.value : "change";
}
// ------------------------------------------------------------


// FUNCTION | Show the panels and fields that apply
// ------------------------------------------------------------
function Na__ApplyFormVisibility() {
    Na__$("js__modeInterval").style.display = Na__Settings.Mode === "interval" ? "block" : "none";
    Na__$("js__modeChange").style.display   = Na__Settings.Mode === "change"   ? "block" : "none";
    Na__$("js__modeManual").style.display   = Na__Settings.Mode === "manual"   ? "block" : "none";
    Na__$("js__qualityField").style.visibility = Na__Settings.Format === "png" ? "hidden" : "visible";
    Na__$("js__folderRow").style.display    = Na__Settings.SaveTo === "folder" ? "flex" : "none";
    document.querySelector(".TCS__film-hint").style.display = Na__Settings.SaveTo === "zip" ? "" : "none";
}
// ------------------------------------------------------------


// FUNCTION | Any form change: read, persist, tell the worker, refresh
// ------------------------------------------------------------
function Na__OnFormChange(Na__Event) {
    Na__ReadForm();
    if (Na__Event && Na__Event.target && Na__Event.target.id === "js__aspect") Na__OnAspectChange();
    Na__ApplyFormVisibility();
    Na__SaveSettings();
    Na__PushSettings();
    if (Na__Editor) Na__Editor.setGrid(Na__Settings.Grid);
    if (Na__Overlay) Na__Overlay.setGrid(Na__Settings.Grid);
    Na__RenderRegion();
    Na__RefreshUi();
}
// ------------------------------------------------------------


// FUNCTION | Send settings to the worker
// ------------------------------------------------------------
function Na__PushSettings() {
    if (Na__Worker) Na__Worker.postMessage({ type: "settings", settings: JSON.parse(JSON.stringify(Na__Settings)) });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Capture Frame (Region)
// -----------------------------------------------------------------------------

// FUNCTION | Source size: from the worker's frames, else the live view
// ------------------------------------------------------------
function Na__SrcSize() {
    if (Na__Stats && Na__Stats.srcW) return { w: Na__Stats.srcW, h: Na__Stats.srcH };
    if (Na__Editor && Na__Editor.srcW) return { w: Na__Editor.srcW, h: Na__Editor.srcH };
    return { w: 0, h: 0 };
}
// ------------------------------------------------------------


// FUNCTION | Current aspect lock as a pixel ratio (0 = free)
// ------------------------------------------------------------
function Na__GetAspect() {
    const a = Na__Settings.Aspect;
    if (a === "free") return 0;
    if (a === "lock") return Na__LockedRatio;
    const [Na__A, Na__B] = a.split(":").map(Number);
    return Na__A > 0 && Na__B > 0 ? Na__A / Na__B : 0;
}
// ------------------------------------------------------------


// FUNCTION | Aspect changed: lock the current ratio or fit the frame to it
// ------------------------------------------------------------
function Na__OnAspectChange() {
    const s = Na__SrcSize();
    const r = Na__Settings.Region;
    if (Na__Settings.Aspect === "lock") {
        Na__LockedRatio = s.w ? (r.w * s.w) / (r.h * s.h) : 0;
        return;
    }
    const Na__Px = Na__GetAspect();
    if (Na__Px > 0 && s.w) Na__SetRegion(Na__TabCapture__FitRegionToAspect(r, Na__Px * s.h / s.w));
}
// ------------------------------------------------------------


// FUNCTION | Label inside the frame: size in pixels and output size
// ------------------------------------------------------------
function Na__RegionLabel(r, Na__W, Na__H) {
    if (!Na__W) return "";
    const w = Math.round(r.w * Na__W), h = Math.round(r.h * Na__H);
    if (Na__Settings.Scale >= 100) return `${w} x ${h} px`;
    const k = Na__Settings.Scale / 100;
    return `${w} x ${h} px (saved ${Math.round(w * k)} x ${Math.round(h * k)})`;
}
// ------------------------------------------------------------


// FUNCTION | Set the frame from any editor or input
// ------------------------------------------------------------
function Na__SetRegion(r) {
    const Na__Round = (v) => Math.round(v * 1e6) / 1e6;
    const w = Math.min(1, Math.max(0.001, r.w));
    const h = Math.min(1, Math.max(0.001, r.h));
    Na__Settings.Region = {
        x : Na__Round(Math.min(1 - w, Math.max(0, r.x))),
        y : Na__Round(Math.min(1 - h, Math.max(0, r.y))),
        w : Na__Round(w),
        h : Na__Round(h)
    };
    Na__RenderRegion();
    Na__WriteRegionInputs();
    Na__PushSettings();
    Na__SaveSettings();
}
// ------------------------------------------------------------


// FUNCTION | Redraw the frame in both views
// ------------------------------------------------------------
function Na__RenderRegion() {
    if (Na__Editor)  Na__Editor.render();
    if (Na__Overlay) Na__Overlay.renderRegion();
}
// ------------------------------------------------------------


// FUNCTION | Frame to the X, Y, W, H inputs (source pixels)
// ------------------------------------------------------------
function Na__WriteRegionInputs() {
    const s = Na__SrcSize();
    const r = Na__Settings.Region;
    const Na__Ids = ["js__regionX", "js__regionY", "js__regionW", "js__regionH"];
    if (!s.w) { Na__Ids.forEach((id) => { Na__$(id).value = ""; }); return; }
    const Na__Vals = [r.x * s.w, r.y * s.h, r.w * s.w, r.h * s.h].map(Math.round);
    Na__Ids.forEach((id, i) => { if (document.activeElement !== Na__$(id)) Na__$(id).value = Na__Vals[i]; });
}
// ------------------------------------------------------------


// FUNCTION | X, Y, W, H inputs to the frame
// ------------------------------------------------------------
function Na__OnRegionInput() {
    const s = Na__SrcSize();
    if (!s.w) return;
    const v = ["js__regionX", "js__regionY", "js__regionW", "js__regionH"].map((id) => parseFloat(Na__$(id).value));
    if (v.some((n) => !Number.isFinite(n))) return;
    const w = Math.min(s.w, Math.max(Na__Cap.NaMiniApp__MinRegionPx, v[2]));
    const h = Math.min(s.h, Math.max(Na__Cap.NaMiniApp__MinRegionPx, v[3]));
    Na__SetRegion({ x: v[0] / s.w, y: v[1] / s.h, w: w / s.w, h: h / s.h });
}
// ------------------------------------------------------------


// FUNCTION | Preset frames
// ------------------------------------------------------------
function Na__Preset(Na__Name) {
    const r = Na__Settings.Region;
    const s = Na__SrcSize();
    const rn = Na__GetAspect() > 0 && s.w ? Na__GetAspect() * s.h / s.w : 0;
    if (Na__Name === "full")     Na__SetRegion(Na__TabCapture__FitRegionToAspect({ x: 0, y: 0, w: 1, h: 1 }, rn));
    if (Na__Name === "centre80") Na__SetRegion(Na__TabCapture__FitRegionToAspect({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, rn));
    if (Na__Name === "centre")   Na__SetRegion({ x: (1 - r.w) / 2, y: (1 - r.h) / 2, w: r.w, h: r.h });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Tab Sharing
// -----------------------------------------------------------------------------

// FUNCTION | Ask the browser for a tab to share
// ------------------------------------------------------------
async function Na__ChooseSource() {
    if (Na__WorkerState !== "idle") return;
    const Na__Controller = "CaptureController" in window ? new CaptureController() : null;
    const Na__Options = {
        // resizeMode "none": the tab's own pixel size. A width / height max
        // made Chrome upscale the tab to fill it (1.0.0 captured at double size).
        video : {
            displaySurface : "browser",
            frameRate      : { ideal: Na__Cap.NaMiniApp__FrameRate, max: Na__Cap.NaMiniApp__FrameRate },
            resizeMode     : "none"
        },
        audio              : false,
        selfBrowserSurface : "exclude",
        surfaceSwitching   : "include",
        preferCurrentTab   : false
    };
    if (Na__Controller) Na__Options.controller = Na__Controller;

    let Na__NewStream;
    try {
        Na__NewStream = await navigator.mediaDevices.getDisplayMedia(Na__Options);
    } catch (Na__Err) {
        Na__Toast(Na__Ui.NaMiniApp__PickCancelled);
        return;
    }


    // Stay on this page after picking, so the frame can be set first
    // ------------------------------------
    try {
        const Na__Surface = Na__NewStream.getVideoTracks()[0].getSettings().displaySurface;
        if (Na__Controller && Na__Surface !== "monitor") Na__Controller.setFocusBehavior("no-focus-change");
    } catch (Na__Err) { /* older browser: focus moves to the shared tab */ }

    Na__AttachSource(Na__NewStream);
}
// ------------------------------------------------------------


// FUNCTION | Wire a new stream to the views and the worker
// ------------------------------------------------------------
function Na__AttachSource(Na__NewStream) {
    const Na__OldStream = Na__Stream;
    const Na__OldProc   = Na__ProcTrack;

    Na__Stream = Na__NewStream;
    Na__Track  = Na__Stream.getVideoTracks()[0];
    try { Na__Track.contentHint = "detail"; } catch (e) { /* not supported */ }
    Na__ProcTrack = Na__Track.clone();
    Na__Stats     = null;


    // Hand the new frames to the worker before the old tab is let go, so the
    // old stream ending is never mistaken for the new one ending
    // ------------------------------------
    const Na__Processor = new MediaStreamTrackProcessor({ track: Na__ProcTrack });
    Na__Worker.postMessage({ type: "source", readable: Na__Processor.readable }, [Na__Processor.readable]);
    const Na__ThisTrack = Na__Track;
    Na__Track.addEventListener("ended", () => { if (Na__Track === Na__ThisTrack) Na__DetachSource(false); }, { once: true });
    try { if (Na__OldStream) Na__OldStream.getTracks().forEach((t) => t.stop()); } catch (e) { /* already stopped */ }
    try { if (Na__OldProc) Na__OldProc.stop(); } catch (e) { /* already stopped */ }


    // Live view with the frame editor
    // ------------------------------------
    Na__$("js__stagePlaceholder").style.display = "none";
    if (!Na__Editor) {
        Na__Editor = new Na__TabCapture__RegionEditor({
            host      : Na__$("js__stageHost"),
            stream    : Na__Stream,
            getRegion : () => Na__Settings.Region,
            onChange  : Na__SetRegion,
            getAspect : Na__GetAspect,
            getLabel  : Na__RegionLabel,
            minPx     : Na__Cap.NaMiniApp__MinRegionPx
        });
        Na__Editor.video.addEventListener("resize", Na__WriteRegionInputs);
    } else {
        Na__Editor.setStream(Na__Stream);
    }
    Na__Editor.setGrid(Na__Settings.Grid);
    if (Na__Overlay) Na__Overlay.setStream(Na__Stream);

    Na__$("js__sourceLabel").textContent = Na__Track.label && !Na__Track.label.startsWith("web-contents-media-stream") ? Na__Track.label : "Shared browser tab";
    Na__RefreshUi();
}
// ------------------------------------------------------------


// FUNCTION | Stop sharing and clear the views
// ------------------------------------------------------------
function Na__DetachSource() {
    if (!Na__Stream) return;
    const Na__OldStream = Na__Stream;
    Na__Stream = null;
    try { Na__OldStream.getTracks().forEach((t) => t.stop()); } catch (e) { /* already stopped */ }
    try { if (Na__ProcTrack) Na__ProcTrack.stop(); } catch (e) { /* already stopped */ }
    Na__Track = null;
    Na__ProcTrack = null;
    Na__Stats = null;

    if (Na__Editor) Na__Editor.setStream(null);
    if (Na__Overlay) Na__Overlay.setStream(null);
    Na__$("js__stagePlaceholder").style.display = "";
    Na__$("js__sourceLabel").textContent = "No tab shared";
    Na__$("js__sourceInfo").textContent  = "";
    Na__Toast(Na__Ui.NaMiniApp__SourceEnded);
    Na__RefreshUi();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Run Control
// -----------------------------------------------------------------------------

// FUNCTION | Start recording (opens the floating window first: needs this click)
// ------------------------------------------------------------
async function Na__StartRun() {
    if (!Na__Stream) { Na__Toast(Na__Ui.NaMiniApp__NeedSource); return; }
    if (Na__RunState() !== "ready") return;
    if (Na__Settings.SaveTo === "folder" && !Na__RootDir) { Na__Toast(Na__Ui.NaMiniApp__NeedFolder); return; }

    if (Na__Overlay && Na__TabCapture__Overlay.isSupported()) {
        try { await Na__Overlay.open(Na__Stream); } catch (Na__Err) { console.warn("Floating window:", Na__Err); }
        Na__Overlay.setGrid(Na__Settings.Grid);
    }
    if (Na__Settings.Sound && !Na__AudioCtx) {
        try { Na__AudioCtx = new AudioContext(); } catch (e) { Na__AudioCtx = null; }
    }


    // New set: clear the previous one (it was saved when it stopped)
    // ------------------------------------
    Na__ClearEntries();
    Na__RunName      = Na__SafeName(Na__$("js__setName").value);
    Na__$("js__setName").value = Na__RunName;
    Na__RunStartWall = Date.now();
    Na__RunDir = null;
    if (Na__Settings.SaveTo === "folder") {
        Na__RunDir = Na__Settings.Subfolder ? Na__RootDir.getDirectoryHandle(Na__RunName, { create: true }) : Promise.resolve(Na__RootDir);
        Na__RunDir.catch(() => Na__Toast(Na__Ui.NaMiniApp__FolderError));
    }

    Na__PushSettings();
    Na__Worker.postMessage({ type: "start", delayMs: Na__Settings.StartDelaySec * 1000 });
}
// ------------------------------------------------------------


// FUNCTION | Pause, resume, stop, capture now
// ------------------------------------------------------------
function Na__Pause()  { if (Na__Worker) Na__Worker.postMessage({ type: "pause" }); }
function Na__Resume() { if (Na__Worker) Na__Worker.postMessage({ type: "resume" }); }
function Na__Stop()   { if (Na__Worker) Na__Worker.postMessage({ type: "stop" }); }
function Na__Snap()   { if (Na__Worker) Na__Worker.postMessage({ type: "snap" }); }

function Na__TogglePause() {
    if (Na__WorkerState === "recording") Na__Pause();
    else if (Na__WorkerState === "paused") Na__Resume();
}
// ------------------------------------------------------------


// FUNCTION | Choose the folder for folder saving
// ------------------------------------------------------------
async function Na__ChooseFolder() {
    if (!("showDirectoryPicker" in window)) { Na__Toast("This browser cannot write to folders. Use Zip download."); return; }
    try {
        Na__RootDir = await window.showDirectoryPicker({ id: "TabCaptureStudio", mode: "readwrite" });
        Na__$("js__folderLabel").textContent = Na__RootDir.name;
    } catch (Na__Err) {
        /* picker cancelled */
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Images, Filmstrip And Saving
// -----------------------------------------------------------------------------

// FUNCTION | File extension for a mime type
// ------------------------------------------------------------
function Na__Ext(Na__Mime) {
    return Na__Mime === "image/png" ? "png" : Na__Mime === "image/webp" ? "webp" : "jpg";
}
// ------------------------------------------------------------


// FUNCTION | A new image arrived from the worker
// ------------------------------------------------------------
function Na__OnCaptured(m) {
    const Na__Entry = {
        index    : m.meta.index,
        name     : `${Na__RunName}_${String(m.meta.index).padStart(4, "0")}.${Na__Ext(m.mime)}`,
        blob     : m.blob,
        crc      : m.crc,
        size     : m.size,
        date     : m.meta.wall,
        meta     : m.meta,
        keep     : true,
        written  : false,
        thumbUrl : URL.createObjectURL(m.thumb)
    };
    Na__Entries.push(Na__Entry);
    Na__TotalBytes += m.size;


    // Folder mode: write now, then let the Blob go
    // ------------------------------------
    if (Na__Settings.SaveTo === "folder" && Na__RunDir) {
        const Na__Dir = Na__RunDir;
        Na__WriteChain = Na__WriteChain
            .then(() => Na__Dir)
            .then((d) => Na__WriteFile(d, Na__Entry.name, Na__Entry.blob))
            .then(() => { Na__Entry.written = true; Na__Entry.blob = null; })
            .catch((e) => { console.error(e); Na__Toast(Na__Ui.NaMiniApp__FolderError); });
    }

    Na__AddFilmItem(Na__Entry);
    if (Na__Overlay) Na__Overlay.setThumb(Na__Entry.thumbUrl);
    Na__RefreshUi();
}
// ------------------------------------------------------------


// FUNCTION | Write one Blob into a folder
// ------------------------------------------------------------
async function Na__WriteFile(Na__Dir, Na__Name, Na__Blob) {
    const Na__Handle   = await Na__Dir.getFileHandle(Na__Name, { create: true });
    const Na__Writable = await Na__Handle.createWritable();
    await Na__Writable.write(Na__Blob);
    await Na__Writable.close();
}
// ------------------------------------------------------------


// FUNCTION | Filmstrip tile (click to leave out of the zip)
// ------------------------------------------------------------
function Na__AddFilmItem(Na__Entry) {
    const Na__Item = document.createElement("button");
    Na__Item.type = "button";
    Na__Item.className = "TCS__film-item";
    Na__Item.title = `${Na__Entry.name}\n${Na__Entry.meta.outW} x ${Na__Entry.meta.outH} px, ${Na__Mb(Na__Entry.size)}, ${Na__Entry.meta.trigger}`;

    const Na__Img = document.createElement("img");
    Na__Img.src = Na__Entry.thumbUrl;
    Na__Img.alt = Na__Entry.name;
    Na__Img.loading = "lazy";

    const Na__Num = document.createElement("span");
    Na__Num.textContent = String(Na__Entry.index);

    Na__Item.append(Na__Img, Na__Num);
    Na__Item.addEventListener("click", () => {
        if (Na__Settings.SaveTo !== "zip" || Na__Entry.written) return;
        Na__Entry.keep = !Na__Entry.keep;
        Na__Item.classList.toggle("TCS__film-item--out", !Na__Entry.keep);
        Na__RefreshUi();
    });

    const Na__Strip = Na__$("js__filmstrip");
    Na__Strip.append(Na__Item);
    Na__Strip.scrollLeft = Na__Strip.scrollWidth;
}
// ------------------------------------------------------------


// FUNCTION | Forget the current set
// ------------------------------------------------------------
function Na__ClearEntries() {
    Na__Entries.forEach((e) => URL.revokeObjectURL(e.thumbUrl));
    Na__Entries    = [];
    Na__TotalBytes = 0;
    Na__$("js__filmstrip").innerHTML = "";
    Na__RefreshUi();
}
// ------------------------------------------------------------


// FUNCTION | Capture log as CSV
// ------------------------------------------------------------
function Na__BuildLogCsv() {
    const Na__Head = ["Index", "FileName", "Kept", "Trigger", "ElapsedSec", "Time", "ChangePct",
                      "FrameX", "FrameY", "FrameW", "FrameH", "SourceW", "SourceH", "OutputW", "OutputH", "Bytes"];
    const Na__Rows = Na__Entries.map((e) => [
        e.index, e.name, e.keep ? "yes" : "no", e.meta.trigger, (e.meta.elapsedMs / 1000).toFixed(2),
        new Date(e.meta.wall).toISOString(), e.meta.changePct,
        e.meta.x, e.meta.y, e.meta.w, e.meta.h, e.meta.srcW, e.meta.srcH, e.meta.outW, e.meta.outH, e.size
    ].join(","));
    return [Na__Head.join(",")].concat(Na__Rows).join("\r\n") + "\r\n";
}
// ------------------------------------------------------------


// FUNCTION | Settings used for the run, as JSON
// ------------------------------------------------------------
function Na__BuildSettingsJson() {
    return JSON.stringify({
        App      : `${Na__Config.NaMiniApp__Meta.NaMiniApp__AppTitle} ${Na__Config.NaMiniApp__Meta.NaMiniApp__Version}`,
        SetName  : Na__RunName,
        Started  : new Date(Na__RunStartWall).toISOString(),
        Source   : Na__Track ? Na__Track.label : "",
        Images   : Na__Entries.length,
        Settings : Na__Settings
    }, null, 4);
}
// ------------------------------------------------------------


// FUNCTION | Build and download the zip (split into parts if very large)
// ------------------------------------------------------------
function Na__SaveZip() {
    const Na__Kept = Na__Entries.filter((e) => e.keep && e.blob);
    if (!Na__Kept.length) { Na__Toast(Na__Ui.NaMiniApp__NothingCaptured); return; }

    Na__Saving = true;
    Na__RefreshUi();
    try {
        const Na__Shared = [
            Na__TabCapture__TextEntry("CaptureLog.csv", Na__BuildLogCsv(), "text/csv"),
            Na__TabCapture__TextEntry("CaptureSettings.json", Na__BuildSettingsJson(), "application/json")
        ];
        const Na__Zips = Na__TabCapture__BuildZips(Na__Kept, Na__Shared, Na__Cap.NaMiniApp__ZipPartMaxBytes);
        Na__Zips.forEach((Na__Zip, i) => {
            const Na__Name = Na__Zips.length > 1 ? `${Na__RunName}_part${i + 1}of${Na__Zips.length}.zip` : `${Na__RunName}.zip`;
            setTimeout(() => Na__Download(Na__Zip, Na__Name), i * 800);
        });
        Na__Toast(`${Na__Ui.NaMiniApp__ZipSaved} ${Na__Kept.length} images, ${Na__Mb(Na__Kept.reduce((a, e) => a + e.size, 0))}.`, 7000);
    } catch (Na__Err) {
        console.error(Na__Err);
        Na__Toast(`Zip failed: ${Na__Err.message}`, 8000);
    } finally {
        Na__Saving = false;
        Na__RefreshUi();
    }
}
// ------------------------------------------------------------


// FUNCTION | Run finished in the worker: save
// ------------------------------------------------------------
async function Na__OnFinished(m) {
    if (m.reason === "cancelled") { Na__RefreshUi(); return; }
    if (!Na__Entries.length) { Na__Toast(Na__Ui.NaMiniApp__NothingCaptured); Na__RefreshUi(); return; }

    if (Na__Settings.SaveTo === "folder" && Na__RunDir) {
        Na__Saving = true;
        Na__RefreshUi();
        try {
            await Na__WriteChain;
            const d = await Na__RunDir;
            await Na__WriteFile(d, "CaptureLog.csv", new Blob([Na__BuildLogCsv()], { type: "text/csv" }));
            await Na__WriteFile(d, "CaptureSettings.json", new Blob([Na__BuildSettingsJson()], { type: "application/json" }));
            Na__Toast(`${Na__Ui.NaMiniApp__FolderSaved} ${Na__Entries.length} images.`, 7000);
        } catch (Na__Err) {
            console.error(Na__Err);
            Na__Toast(Na__Ui.NaMiniApp__FolderError, 8000);
        } finally {
            Na__Saving = false;
        }
    } else {
        Na__SaveZip();
    }

    if (/^Capture_\d{4}-/.test(Na__$("js__setName").value)) Na__$("js__setName").value = Na__DefaultSetName();
    Na__RefreshUi();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Worker Messages
// -----------------------------------------------------------------------------

// FUNCTION | Route messages from the capture worker
// ------------------------------------------------------------
function Na__OnWorkerMessage(Na__Event) {
    const m = Na__Event.data || {};
    switch (m.type) {
        case "stats":
            Na__Stats = m;
            Na__RefreshLive();
            break;

        case "state": {
            const Na__WasIdle = Na__WorkerState === "idle";
            Na__WorkerState = m.state;
            if (Na__WasIdle && m.state === "countdown") Na__Stats = Object.assign({}, Na__Stats, { captured: 0, elapsedMs: 0 });
            Na__RefreshUi();
            break;
        }

        case "shutter":
            if (Na__Overlay) Na__Overlay.shutter(Na__Settings.Flash);
            if (Na__Settings.Sound) Na__ShutterSound();
            break;

        case "captured":
            Na__OnCaptured(m);
            break;

        case "finished":
            Na__OnFinished(m);
            break;

        case "warning":
            if (m.code === "dropped" && performance.now() - Na__LastDropToast > 5000) {
                Na__LastDropToast = performance.now();
                Na__Toast(Na__Ui.NaMiniApp__Dropped);
            }
            break;

        case "error":
            console.error(m.text);
            Na__Toast(m.text, 7000);
            break;

        case "ended":
            Na__DetachSource(false);
            break;
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | UI Refresh
// -----------------------------------------------------------------------------

// FUNCTION | Status text for a state
// ------------------------------------------------------------
function Na__StateText(Na__State, s) {
    switch (Na__State) {
        case "nosource"  : return Na__Ui.NaMiniApp__StatusNoSource;
        case "ready"     : return Na__Ui.NaMiniApp__StatusReady;
        case "countdown" : return `${Na__Ui.NaMiniApp__StatusCountdown} ${Math.ceil(((s && s.countdownMs) || 0) / 1000)}`;
        case "recording" : return Na__Ui.NaMiniApp__StatusRecording;
        case "paused"    : return Na__Ui.NaMiniApp__StatusPaused;
        case "finishing" : return Na__Ui.NaMiniApp__StatusFinishing;
        case "saving"    : return Na__Ui.NaMiniApp__StatusSaving;
        default          : return Na__State;
    }
}
// ------------------------------------------------------------


// FUNCTION | Buttons, status pill, filmstrip header
// ------------------------------------------------------------
function Na__RefreshUi() {
    const Na__State = Na__RunState();
    const Na__Active = ["countdown", "recording", "paused", "finishing", "saving"].includes(Na__State);

    Na__$("js__statusPill").dataset.state = Na__State;
    Na__$("js__statusText").textContent   = Na__StateText(Na__State, Na__Stats);

    Na__$("js__chooseSourceBtn").disabled = Na__Active;
    Na__$("js__chooseSourceBtn").textContent = Na__Stream ? "Change tab" : "Choose tab";
    Na__$("js__stopSourceBtn").disabled   = !Na__Stream || Na__Active;
    Na__$("js__startBtn").disabled        = Na__State !== "ready";
    Na__$("js__pauseBtn").disabled        = !(Na__State === "recording" || Na__State === "paused");
    Na__$("js__pauseBtn").textContent     = Na__State === "paused" ? "Resume" : "Pause";
    Na__$("js__snapBtn").disabled         = !(Na__State === "recording" || Na__State === "paused");
    Na__$("js__stopBtn").disabled         = !(Na__State === "recording" || Na__State === "paused" || Na__State === "countdown");
    Na__$("js__overlayBtn").hidden        = !(Na__Active && Na__Overlay && !Na__Overlay.isOpen && Na__TabCapture__Overlay.isSupported());
    ["js__saveTo", "js__format", "js__chooseFolderBtn", "js__subfolder", "js__setName"].forEach((id) => { Na__$(id).disabled = Na__Active; });


    // Filmstrip header
    // ------------------------------------
    const Na__Kept = Na__Entries.filter((e) => e.keep);
    Na__$("js__filmCount").textContent = Na__Entries.length
        ? `${Na__Entries.length} image${Na__Entries.length === 1 ? "" : "s"}, ${Na__Mb(Na__TotalBytes)}${Na__Kept.length !== Na__Entries.length ? ` (${Na__Kept.length} kept)` : ""}`
        : "No images yet";
    Na__$("js__saveZipBtn").disabled = Na__Active || Na__Settings.SaveTo !== "zip" || !Na__Entries.some((e) => e.keep && e.blob);
    Na__$("js__clearBtn").disabled   = Na__Active || !Na__Entries.length;

    Na__RefreshLive();
}
// ------------------------------------------------------------


// FUNCTION | Live parts: meters, summary, floating window
// ------------------------------------------------------------
function Na__RefreshLive() {
    const s = Na__Stats;
    const Na__State = Na__RunState();


    // Source info and summary line
    // ------------------------------------
    if (s && s.srcW) {
        Na__$("js__sourceInfo").textContent = `${s.srcW} x ${s.srcH} px, ${s.fps} fps`;
        const r = Na__Settings.Region;
        const Na__ModeText = Na__Settings.Mode === "interval" ? `Timed, every ${Na__Settings.IntervalSec} s`
                           : Na__Settings.Mode === "change"   ? `On change, ${Na__Settings.ChangePct}%${Na__Settings.SettleOn ? " when settled" : ""}`
                           : "Manual";
        let Na__Text = `Frame ${Math.round(r.w * s.srcW)} x ${Math.round(r.h * s.srcH)} px  |  ${Na__ModeText}`;
        if (Na__State === "recording" || Na__State === "paused" || Na__State === "finishing") {
            Na__Text += `  |  ${Na__TabCapture__FormatTime(s.elapsedMs)}, ${s.captured} taken`;
            if (s.skipped) Na__Text += `, ${s.skipped} duplicates skipped`;
            if (s.dropped) Na__Text += `, ${s.dropped} dropped`;
        }
        Na__$("js__summaryText").textContent = Na__Text;
        if (Na__State === "countdown") Na__$("js__statusText").textContent = Na__StateText(Na__State, s);
        if (!Na__$("js__regionW").value) Na__WriteRegionInputs();
    } else {
        Na__$("js__summaryText").textContent = "";
    }


    // Meters
    // ------------------------------------
    const Na__Change = s ? s.changePct : 0;
    const Na__Motion = s ? s.motionPct : 0;
    Na__$("js__meterChangeFill").style.width = `${Math.min(100, Na__Change)}%`;
    Na__$("js__meterChangeFill").classList.toggle("TCS__meter-fill--hot", Na__Settings.Mode === "change" && Na__Change >= Na__Settings.ChangePct);
    Na__$("js__meterChangeMark").style.left = `${Math.min(100, Na__Settings.Mode === "interval" ? Na__Settings.DuplicatePct : Na__Settings.ChangePct)}%`;
    Na__$("js__meterChangeText").textContent = `${Na__Change.toFixed(1)}%`;
    Na__$("js__meterMotionFill").style.width = `${Math.min(100, Na__Motion * 5)}%`;
    Na__$("js__meterMotionText").textContent = s && !s.still ? `Moving (${Na__Motion.toFixed(1)}%)` : "Still";


    // Floating window
    // ------------------------------------
    if (Na__Overlay && Na__Overlay.isOpen) {
        Na__Overlay.update({
            state        : Na__State,
            stateText    : Na__StateText(Na__State, s),
            elapsedMs    : s ? s.elapsedMs : 0,
            captured     : s ? s.captured : 0,
            countdownMs  : s ? s.countdownMs : 0,
            mode         : Na__Settings.Mode,
            changePct    : Na__Change,
            changeTarget : Na__Settings.ChangePct,
            waiting      : s ? s.waiting : false,
            still        : s ? s.still : true,
            nextInMs     : s ? s.nextInMs : 0,
            intervalMs   : Na__Settings.IntervalSec * 1000
        });
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Bootstrap
// -----------------------------------------------------------------------------

// FUNCTION | Browser support check
// ------------------------------------------------------------
function Na__CheckSupport() {
    const Na__Core = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)
                  && "MediaStreamTrackProcessor" in window
                  && "OffscreenCanvas" in window
                  && "Worker" in window;
    const Na__Banner = Na__$("js__supportBanner");
    if (!Na__Core) {
        Na__Banner.textContent = Na__Ui.NaMiniApp__Unsupported;
        Na__Banner.style.display = "block";
        Na__$("js__chooseSourceBtn").disabled = true;
    } else if (!Na__TabCapture__Overlay.isSupported()) {
        Na__Banner.textContent = Na__Ui.NaMiniApp__NoOverlay;
        Na__Banner.style.display = "block";
    }
    return Na__Core;
}
// ------------------------------------------------------------


// FUNCTION | Attach every listener
// ------------------------------------------------------------
function Na__RegisterEventListeners() {
    Na__Bindings.forEach(([, Na__Id]) => Na__$(Na__Id).addEventListener("change", Na__OnFormChange));
    document.querySelectorAll('input[name="js__mode"]').forEach((n) => n.addEventListener("change", Na__OnFormChange));
    ["js__regionX", "js__regionY", "js__regionW", "js__regionH"].forEach((id) => Na__$(id).addEventListener("change", Na__OnRegionInput));

    Na__$("js__chooseSourceBtn").addEventListener("click", Na__ChooseSource);
    Na__$("js__stopSourceBtn").addEventListener("click",   () => Na__DetachSource(false));
    Na__$("js__presetFull").addEventListener("click",      () => Na__Preset("full"));
    Na__$("js__presetCentre80").addEventListener("click",  () => Na__Preset("centre80"));
    Na__$("js__presetCentre").addEventListener("click",    () => Na__Preset("centre"));
    Na__$("js__resetReferenceBtn").addEventListener("click", () => Na__Worker && Na__Worker.postMessage({ type: "resetReference" }));
    Na__$("js__chooseFolderBtn").addEventListener("click", Na__ChooseFolder);

    Na__$("js__startBtn").addEventListener("click",   Na__StartRun);
    Na__$("js__pauseBtn").addEventListener("click",   Na__TogglePause);
    Na__$("js__snapBtn").addEventListener("click",    Na__Snap);
    Na__$("js__stopBtn").addEventListener("click",    Na__Stop);
    Na__$("js__overlayBtn").addEventListener("click", async () => {
        try { await Na__Overlay.open(Na__Stream); Na__Overlay.setGrid(Na__Settings.Grid); } catch (e) { console.warn(e); }
        Na__RefreshUi();
    });
    Na__$("js__saveZipBtn").addEventListener("click", Na__SaveZip);
    Na__$("js__clearBtn").addEventListener("click",   Na__ClearEntries);

    window.addEventListener("beforeunload", (e) => {
        if (["countdown", "recording", "paused", "finishing"].includes(Na__WorkerState)) { e.preventDefault(); e.returnValue = ""; }
    });
}
// ------------------------------------------------------------


// FUNCTION | Load config, build the form, start the worker
// ------------------------------------------------------------
async function Na__BootstrapApp() {
    const Na__Response = await fetch(Na__ConfigPath, { cache: "no-cache" });
    if (!Na__Response.ok) throw new Error(`Failed to load app config (HTTP ${Na__Response.status}).`);
    Na__Config = await Na__Response.json();
    Na__Ui     = Na__Config.NaMiniApp__UiText;
    Na__Cap    = Na__Config.NaMiniApp__Capture;

    const Na__Meta = Na__Config.NaMiniApp__Meta;
    document.title = Na__Ui.NaMiniApp__PageTitle;
    Na__$("js__appTitle").textContent    = Na__Meta.NaMiniApp__AppTitle;
    Na__$("js__appSubTitle").textContent = Na__Meta.NaMiniApp__AppSubTitle;
    Na__$("js__appVersion").textContent  = `v${Na__Meta.NaMiniApp__Version}`;
    Na__$("js__setName").value           = Na__DefaultSetName();

    Na__Settings = Na__LoadSettings();
    Na__WriteForm();
    Na__RegisterEventListeners();
    if (!Na__CheckSupport()) { Na__RefreshUi(); return; }


    // Capture worker (versioned by hand: import maps do not reach workers)
    // ------------------------------------
    Na__Worker = new Worker(new URL(`${Na__WorkerFile}?v=${Na__Meta.NaMiniApp__Version}`, import.meta.url), { type: "module" });
    Na__Worker.onmessage = Na__OnWorkerMessage;
    Na__Worker.onerror   = (e) => { console.error(e); Na__Toast(`Capture worker error: ${e.message || "see console"}`, 8000); };
    Na__Worker.postMessage({ type: "init", cfg: Na__Cap, settings: JSON.parse(JSON.stringify(Na__Settings)) });


    // Floating window
    // ------------------------------------
    const Na__Pip = Na__Config.NaMiniApp__Overlay;
    Na__Overlay = new Na__TabCapture__Overlay({
        width     : Na__Pip.NaMiniApp__Width,
        height    : Na__Pip.NaMiniApp__Height,
        uiText    : Na__Ui,
        getRegion : () => Na__Settings.Region,
        setRegion : Na__SetRegion,
        getAspect : Na__GetAspect,
        getLabel  : Na__RegionLabel,
        minPx     : Na__Cap.NaMiniApp__MinRegionPx,
        onPause   : Na__Pause,
        onResume  : Na__Resume,
        onStop    : Na__Stop,
        onSnap    : Na__Snap,
        onClosed  : Na__RefreshUi
    });

    Na__RefreshUi();
}
// ------------------------------------------------------------

Na__BootstrapApp().catch((Na__ErrorObject) => {
    console.error(Na__ErrorObject);
    document.body.innerHTML = `<p class="TCS__error-message">Unable to load app configuration. ${Na__ErrorObject.message}</p>`;
});

// endregion -------------------------------------------------------------------
