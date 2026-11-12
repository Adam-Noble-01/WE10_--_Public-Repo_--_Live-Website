// =============================================================================
// NOBLE ARCHITECTURE - TAB CAPTURE STUDIO - CAPTURE WORKER
// =============================================================================
//
// FILE    : MiniApp__PhotoUtils__TabCaptureStudio__Worker__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Reads the shared tab's frames, decides when to capture, crops,
//           encodes and checksums each image off the main thread
// CREATED : 12-Nov-2026
//
// WHY A WORKER:
// - While you work in the captured tab, this app's tab is hidden and its main
//   thread timers are throttled. Frames and timers here are not, so timing
//   and change detection stay accurate in the background.
// - Self-contained on purpose: import maps do not reach workers, so the
//   CRC32 table is duplicated from the ZipWriter module.
//
// PROTOCOL (main -> worker):
//   init { cfg, settings } | source { readable } | settings { settings }
//   start { delayMs } | pause | resume | stop | snap | resetReference
// PROTOCOL (worker -> main):
//   stats {...} | state { state } | shutter { index } | captured {...}
//   finished { count, reason } | warning { code } | error { text } | ended
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module-Level State
// -----------------------------------------------------------------------------

 let Na__Cfg            = null;          // NaMiniApp__Capture block
 let Na__Set            = null;          // live settings from the page
 let Na__Reader         = null;          // ReadableStreamDefaultReader of VideoFrames
 let Na__Latest         = null;          // newest VideoFrame (only one is ever held)
 let Na__FrameSeq       = 0;
 let Na__FpsCount       = 0;
 let Na__FpsStamp       = 0;
 let Na__Fps            = 0;

 let Na__State          = "idle";        // idle | countdown | recording | paused | finishing
 let Na__CountdownEnd   = 0;
 let Na__StartT         = 0;
 let Na__PausedTotal    = 0;
 let Na__PauseT         = 0;
 let Na__NextDue        = 0;
 let Na__LastCaptureT   = -1e12;
 let Na__CaptureIndex   = 0;
 let Na__PendingCapture = 0;
 let Na__StopReason     = "";

 let Na__Reference      = null;          // luma of the last saved image (or the idle baseline)
 let Na__RefKey         = "";
 let Na__PrevLuma       = null;
 let Na__PrevKey        = "";
 let Na__LastMotionT    = 0;
 let Na__LastAnalysisT  = 0;
 let Na__AnalysedSeq    = -1;
 let Na__Analysing      = false;
 let Na__ChangePct      = 0;
 let Na__MotionPct      = 0;
 let Na__TriggerT       = 0;             // change mode: waiting for the view to settle since

 let Na__Queue          = [];
 let Na__Encoding       = false;
 let Na__Dropped        = 0;
 let Na__Skipped        = 0;
 let Na__LastStatsT     = 0;
 let Na__TickHandle     = 0;

 const Na__LumaCanvas   = new OffscreenCanvas(1, 1);
 const Na__LumaCtx      = Na__LumaCanvas.getContext("2d", { willReadFrequently: true });

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

// FUNCTION | CRC32 table and checksum (duplicate of ZipWriter, see header)
// ------------------------------------------------------------
const Na__CrcTable = (() => {
    const Na__Table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        Na__Table[n] = c >>> 0;
    }
    return Na__Table;
})();

function Na__Crc32(Na__Bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < Na__Bytes.length; i++) c = Na__CrcTable[(c ^ Na__Bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}
// ------------------------------------------------------------


// FUNCTION | Post a message to the page
// ------------------------------------------------------------
function Na__Post(Na__Message, Na__Transfer) {
    self.postMessage(Na__Message, Na__Transfer || []);
}
// ------------------------------------------------------------


// FUNCTION | Frame region in source pixels, clamped and at least the minimum size
// ------------------------------------------------------------
function Na__RegionPx(Na__Fw, Na__Fh) {
    const Na__R   = Na__Set.Region;
    const Na__Min = Math.min(Na__Cfg.NaMiniApp__MinRegionPx, Na__Fw, Na__Fh);
    let w = Math.max(Na__Min, Math.round(Na__R.w * Na__Fw));
    let h = Math.max(Na__Min, Math.round(Na__R.h * Na__Fh));
    w = Math.min(w, Na__Fw);
    h = Math.min(h, Na__Fh);
    const x = Math.min(Math.max(0, Math.round(Na__R.x * Na__Fw)), Na__Fw - w);
    const y = Math.min(Math.max(0, Math.round(Na__R.y * Na__Fh)), Na__Fh - h);
    return { x, y, w, h };
}
// ------------------------------------------------------------


// FUNCTION | Analysis size: fixed width, height from the frame aspect
// ------------------------------------------------------------
function Na__AnalysisSize(Na__W, Na__H) {
    const aw = Na__Cfg.NaMiniApp__AnalysisWidth;
    const ah = Math.max(8, Math.min(aw * 2, Math.round(aw * Na__H / Na__W)));
    return { aw, ah, key: `${aw}x${ah}` };
}
// ------------------------------------------------------------


// FUNCTION | Luma array from a small bitmap
// ------------------------------------------------------------
function Na__ToLuma(Na__Bitmap) {
    const w = Na__Bitmap.width, h = Na__Bitmap.height;
    if (Na__LumaCanvas.width !== w || Na__LumaCanvas.height !== h) {
        Na__LumaCanvas.width  = w;
        Na__LumaCanvas.height = h;
    }
    Na__LumaCtx.drawImage(Na__Bitmap, 0, 0);
    const d = Na__LumaCtx.getImageData(0, 0, w, h).data;
    const Na__Out = new Uint8Array(w * h);
    for (let i = 0, j = 0; j < Na__Out.length; i += 4, j++) {
        Na__Out[j] = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    }
    return Na__Out;
}
// ------------------------------------------------------------


// FUNCTION | Percent of pixels that differ by more than the tolerance
// ------------------------------------------------------------
function Na__DiffPct(Na__A, Na__B) {
    if (!Na__A || !Na__B || Na__A.length !== Na__B.length) return 100;
    const Na__Tol = Math.max(1, Math.round(Na__Set.TolerancePct * 2.55));
    let Na__Count = 0;
    for (let i = 0; i < Na__A.length; i++) {
        const d = Na__A[i] - Na__B[i];
        if (d > Na__Tol || d < -Na__Tol) Na__Count++;
    }
    return (Na__Count / Na__A.length) * 100;
}
// ------------------------------------------------------------


// FUNCTION | Active run time in ms (paused time left out)
// ------------------------------------------------------------
function Na__ActiveElapsed(Na__Now) {
    if (Na__State === "idle" || Na__State === "countdown") return 0;
    const Na__PausedNow = Na__State === "paused" ? (Na__Now - Na__PauseT) : 0;
    return Math.max(0, Na__Now - Na__StartT - Na__PausedTotal - Na__PausedNow);
}
// ------------------------------------------------------------


// FUNCTION | Mime type and quality for the chosen format
// ------------------------------------------------------------
function Na__Encoding__Options() {
    const Na__Type = Na__Set.Format === "png" ? "image/png" : Na__Set.Format === "webp" ? "image/webp" : "image/jpeg";
    return Na__Type === "image/png" ? { type: Na__Type } : { type: Na__Type, quality: Math.min(1, Math.max(0.5, Na__Set.Quality / 100)) };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Frame Reader
// -----------------------------------------------------------------------------

// FUNCTION | Keep only the newest frame; close everything else straight away
// ------------------------------------------------------------
async function Na__ReadLoop(Na__ThisReader) {
    try {
        for (;;) {
            const { value, done } = await Na__ThisReader.read();
            if (done) break;
            if (Na__ThisReader !== Na__Reader) { value.close(); break; }

            if (Na__Latest) Na__Latest.close();
            Na__Latest = value;
            Na__FrameSeq++;
            Na__FpsCount++;
        }
    } catch (Na__Err) {
        // Stream errored or was cancelled: handled below
    }


    if (Na__ThisReader === Na__Reader) {
        if (Na__Latest) { Na__Latest.close(); Na__Latest = null; }
        Na__Reader = null;
        if (Na__State !== "idle") Na__Stop("ended");
        Na__Post({ type: "ended" });
    }
}
// ------------------------------------------------------------


// FUNCTION | Swap to a new frame stream
// ------------------------------------------------------------
function Na__SetSource(Na__Readable) {
    const Na__Old = Na__Reader;
    Na__Reader = Na__Readable.getReader();
    if (Na__Old) Na__Old.cancel().catch(() => {});
    if (Na__Latest) { Na__Latest.close(); Na__Latest = null; }
    Na__Reference = null;
    Na__PrevLuma  = null;
    Na__ReadLoop(Na__Reader);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Change Analysis
// -----------------------------------------------------------------------------

// FUNCTION | Compare the framed view with the last image and the last check
// ------------------------------------------------------------
async function Na__Analyse(Na__Now) {
    if (Na__Analysing || !Na__Latest || Na__AnalysedSeq === Na__FrameSeq) return;
    Na__Analysing   = true;
    Na__AnalysedSeq = Na__FrameSeq;

    const Na__Frame = Na__Latest.clone();
    try {
        const r = Na__RegionPx(Na__Frame.displayWidth, Na__Frame.displayHeight);
        const s = Na__AnalysisSize(r.w, r.h);
        const Na__Small = await createImageBitmap(Na__Frame, r.x, r.y, r.w, r.h,
            { resizeWidth: s.aw, resizeHeight: s.ah, resizeQuality: "medium" });
        const Na__Luma = Na__ToLuma(Na__Small);
        Na__Small.close();


        // Movement between consecutive checks (for "settled")
        // ------------------------------------
        if (Na__PrevLuma && Na__PrevKey === s.key) {
            Na__MotionPct = Na__DiffPct(Na__PrevLuma, Na__Luma);
            if (Na__MotionPct > Na__Cfg.NaMiniApp__StillPct) Na__LastMotionT = Na__Now;
        } else {
            Na__MotionPct  = 0;
            Na__LastMotionT = Na__Now;
        }
        Na__PrevLuma = Na__Luma;
        Na__PrevKey  = s.key;


        // Change since the reference (the last saved image)
        // ------------------------------------
        if (!Na__Reference || Na__RefKey !== s.key) {
            Na__Reference = Na__Luma;
            Na__RefKey    = s.key;
            Na__ChangePct = 0;
        } else {
            Na__ChangePct = Na__DiffPct(Na__Reference, Na__Luma);
        }
    } catch (Na__Err) {
        // A frame closed mid-read or a zero-size frame: skip this check
    } finally {
        Na__Frame.close();
        Na__Analysing = false;
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Capture And Encode
// -----------------------------------------------------------------------------

// FUNCTION | Grab the framed region of the newest frame and queue it for encoding
// ------------------------------------------------------------
async function Na__Capture(Na__Trigger) {
    if (!Na__Latest) return;
    if (Na__Queue.length + Na__PendingCapture >= Na__Cfg.NaMiniApp__MaxQueue) {
        Na__Dropped++;
        Na__Post({ type: "warning", code: "dropped" });
        return;
    }

    const Na__Now    = performance.now();
    Na__LastCaptureT = Na__Now;
    Na__TriggerT     = 0;
    Na__PendingCapture++;

    const Na__Index  = ++Na__CaptureIndex;
    const Na__Frame  = Na__Latest.clone();
    const fw = Na__Frame.displayWidth, fh = Na__Frame.displayHeight;
    const r  = Na__RegionPx(fw, fh);
    const Na__Scale = Number.isFinite(Na__Set.Scale) ? Math.min(1, Math.max(0.05, Na__Set.Scale / 100)) : 1;
    const ow = Math.max(1, Math.round(r.w * Na__Scale));
    const oh = Math.max(1, Math.round(r.h * Na__Scale));

    const Na__Meta = {
        index     : Na__Index,
        trigger   : Na__Trigger,
        elapsedMs : Math.round(Na__ActiveElapsed(Na__Now)),
        wall      : Date.now(),
        changePct : Math.round(Na__ChangePct * 10) / 10,
        srcW : fw, srcH : fh, x : r.x, y : r.y, w : r.w, h : r.h, outW : ow, outH : oh
    };
    Na__Post({ type: "shutter", index: Na__Index });


    let Na__Bitmap = null;
    try {
        Na__Bitmap = Na__Scale === 1
            ? await createImageBitmap(Na__Frame, r.x, r.y, r.w, r.h)
            : await createImageBitmap(Na__Frame, r.x, r.y, r.w, r.h, { resizeWidth: ow, resizeHeight: oh, resizeQuality: "high" });
    } catch (Na__Err) {
        Na__Post({ type: "error", text: `Capture ${Na__Index} failed: ${Na__Err.message}` });
    } finally {
        Na__Frame.close();
    }


    // The saved image becomes the new reference for change detection
    // ------------------------------------
    if (Na__Bitmap) {
        try {
            const s = Na__AnalysisSize(Na__Bitmap.width, Na__Bitmap.height);
            const Na__Small = await createImageBitmap(Na__Bitmap, { resizeWidth: s.aw, resizeHeight: s.ah, resizeQuality: "medium" });
            Na__Reference = Na__ToLuma(Na__Small);
            Na__RefKey    = s.key;
            Na__ChangePct = 0;
            Na__Small.close();
        } catch (Na__Err) { /* keep the old reference */ }

        Na__Queue.push({ bitmap: Na__Bitmap, meta: Na__Meta, enc: Na__Encoding__Options(), needCrc: Na__Set.SaveTo === "zip" });
    }

    Na__PendingCapture--;
    Na__PumpEncoder();
}
// ------------------------------------------------------------


// FUNCTION | Encode queued images one at a time and hand them to the page
// ------------------------------------------------------------
async function Na__PumpEncoder() {
    if (Na__Encoding) return;
    Na__Encoding = true;

    while (Na__Queue.length) {
        const Na__Job = Na__Queue.shift();
        try {
            const b = Na__Job.bitmap;
            const Na__Canvas = new OffscreenCanvas(b.width, b.height);
            const Na__Ctx    = Na__Canvas.getContext("2d", { alpha: false });
            Na__Ctx.drawImage(b, 0, 0);
            const Na__Blob = await Na__Canvas.convertToBlob(Na__Job.enc);


            // Thumbnail for the filmstrip and the floating window
            // ------------------------------------
            const tw = Math.min(Na__Cfg.NaMiniApp__ThumbWidth, b.width);
            const th = Math.max(1, Math.round(tw * b.height / b.width));
            const Na__ThumbCanvas = new OffscreenCanvas(tw, th);
            const Na__ThumbCtx    = Na__ThumbCanvas.getContext("2d", { alpha: false });
            Na__ThumbCtx.imageSmoothingQuality = "high";
            Na__ThumbCtx.drawImage(b, 0, 0, tw, th);
            const Na__Thumb = await Na__ThumbCanvas.convertToBlob({ type: "image/jpeg", quality: 0.75 });
            b.close();


            const Na__Crc = Na__Job.needCrc ? Na__Crc32(new Uint8Array(await Na__Blob.arrayBuffer())) : 0;
            Na__Post({ type: "captured", meta: Na__Job.meta, blob: Na__Blob, thumb: Na__Thumb, crc: Na__Crc, size: Na__Blob.size, mime: Na__Blob.type });
        } catch (Na__Err) {
            try { Na__Job.bitmap.close(); } catch (e) { /* already closed */ }
            Na__Post({ type: "error", text: `Encoding image ${Na__Job.meta.index} failed: ${Na__Err.message}` });
        }
    }

    Na__Encoding = false;
    Na__MaybeFinish();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Run Control
// -----------------------------------------------------------------------------

// FUNCTION | Set the run state and tell the page
// ------------------------------------------------------------
function Na__SetState(Na__NewState) {
    Na__State = Na__NewState;
    Na__Post({ type: "state", state: Na__NewState });
}
// ------------------------------------------------------------


// FUNCTION | Start a run (after the start delay)
// ------------------------------------------------------------
function Na__Start(Na__DelayMs) {
    if (Na__State !== "idle") return;
    Na__CaptureIndex = 0;
    Na__Dropped      = 0;
    Na__Skipped      = 0;
    Na__TriggerT     = 0;
    Na__StopReason   = "";
    Na__CountdownEnd = performance.now() + Math.max(0, Na__DelayMs);
    Na__SetState("countdown");
}
// ------------------------------------------------------------


// FUNCTION | Countdown finished: begin recording, first image straight away
// ------------------------------------------------------------
function Na__BeginRecording(Na__Now) {
    Na__StartT       = Na__Now;
    Na__PausedTotal  = 0;
    Na__NextDue      = Na__Now + Na__Set.IntervalSec * 1000;
    Na__LastCaptureT = -1e12;
    Na__LastMotionT  = Na__Now;
    Na__SetState("recording");
    if (Na__Set.Mode !== "manual") Na__Capture("first");
}
// ------------------------------------------------------------


// FUNCTION | Stop: cancel a countdown, or finish encoding then report
// ------------------------------------------------------------
function Na__Stop(Na__Reason) {
    if (Na__State === "idle") return;
    Na__StopReason = Na__Reason || "user";

    if (Na__State === "countdown") {
        Na__SetState("idle");
        Na__Post({ type: "finished", count: 0, reason: "cancelled" });
        return;
    }

    Na__SetState("finishing");
    Na__MaybeFinish();
}
// ------------------------------------------------------------


// FUNCTION | Report finished once every image has been encoded
// ------------------------------------------------------------
function Na__MaybeFinish() {
    if (Na__State !== "finishing") return;
    if (Na__Encoding || Na__Queue.length || Na__PendingCapture) return;
    Na__SetState("idle");
    Na__Post({ type: "finished", count: Na__CaptureIndex, reason: Na__StopReason, dropped: Na__Dropped, skipped: Na__Skipped });
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Tick (timing, triggers, stats)
// -----------------------------------------------------------------------------

// FUNCTION | Runs every TickMs: drives the countdown, the modes and the stats
// ------------------------------------------------------------
function Na__Tick() {
    if (!Na__Set) return;
    const Na__Now = performance.now();


    // Frame rate
    // ------------------------------------
    if (Na__Now - Na__FpsStamp >= 1000) {
        Na__Fps      = Math.round(Na__FpsCount * 1000 / (Na__Now - Na__FpsStamp));
        Na__FpsCount = 0;
        Na__FpsStamp = Na__Now;
    }


    // Change analysis
    // ------------------------------------
    if (Na__Now - Na__LastAnalysisT >= Na__Cfg.NaMiniApp__AnalysisMs) {
        Na__LastAnalysisT = Na__Now;
        Na__Analyse(Na__Now);
    }


    // Countdown
    // ------------------------------------
    if (Na__State === "countdown" && Na__Now >= Na__CountdownEnd) Na__BeginRecording(Na__Now);


    // Recording triggers
    // ------------------------------------
    if (Na__State === "recording") {
        const Na__Elapsed = Na__ActiveElapsed(Na__Now);

        if (Na__Set.MaxImages > 0 && Na__CaptureIndex >= Na__Set.MaxImages) {
            Na__Stop("limit-images");
        } else if (Na__Set.MaxMinutes > 0 && Na__Elapsed >= Na__Set.MaxMinutes * 60000) {
            Na__Stop("limit-time");
        } else if (Na__Set.Mode === "interval") {
            if (Na__Now >= Na__NextDue) {
                Na__NextDue += Na__Set.IntervalSec * 1000;
                if (Na__NextDue <= Na__Now) Na__NextDue = Na__Now + Na__Set.IntervalSec * 1000;
                if (Na__Set.SkipDuplicates && Na__Reference && Na__ChangePct < Na__Set.DuplicatePct) {
                    Na__Skipped++;
                } else {
                    Na__Capture("interval");
                }
            }
        } else if (Na__Set.Mode === "change") {
            const Na__GapOk = (Na__Now - Na__LastCaptureT) >= Na__Set.MinGapSec * 1000;
            if (!Na__TriggerT) {
                if (Na__GapOk && Na__ChangePct >= Na__Set.ChangePct) {
                    if (Na__Set.SettleOn) Na__TriggerT = Na__Now;
                    else Na__Capture("change");
                }
            } else if (Na__ChangePct < Na__Set.ChangePct * 0.7) {
                Na__TriggerT = 0;                                   // moved back towards the last image
            } else if (Na__Now - Na__LastMotionT >= Na__Set.SettleMs) {
                Na__Capture("change");
            } else if (Na__Now - Na__TriggerT >= Na__Set.SettleTimeoutSec * 1000) {
                Na__Capture("change-timeout");
            }
        }
    }


    // Stats for the page and the floating window
    // ------------------------------------
    if (Na__Now - Na__LastStatsT >= Na__Cfg.NaMiniApp__StatsMs) {
        Na__LastStatsT = Na__Now;
        const Na__Src = Na__Latest ? { w: Na__Latest.displayWidth, h: Na__Latest.displayHeight } : { w: 0, h: 0 };
        Na__Post({
            type        : "stats",
            state       : Na__State,
            fps         : Na__Fps,
            srcW        : Na__Src.w,
            srcH        : Na__Src.h,
            changePct   : Na__ChangePct,
            motionPct   : Na__MotionPct,
            still       : (Na__Now - Na__LastMotionT) >= (Na__Set.SettleMs || 0),
            waiting     : !!Na__TriggerT,
            countdownMs : Na__State === "countdown" ? Math.max(0, Na__CountdownEnd - Na__Now) : 0,
            nextInMs    : Na__State === "recording" && Na__Set.Mode === "interval" ? Math.max(0, Na__NextDue - Na__Now) : 0,
            elapsedMs   : Na__ActiveElapsed(Na__Now),
            captured    : Na__CaptureIndex,
            queue       : Na__Queue.length + Na__PendingCapture,
            dropped     : Na__Dropped,
            skipped     : Na__Skipped
        });
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------



// -----------------------------------------------------------------------------
// REGION | Message Router
// -----------------------------------------------------------------------------

self.onmessage = (Na__Event) => {
    const m   = Na__Event.data || {};
    const Now = performance.now();

    switch (m.type) {
        case "init":
            Na__Cfg = m.cfg;
            Na__Set = m.settings;
            if (!Na__TickHandle) Na__TickHandle = setInterval(Na__Tick, Na__Cfg.NaMiniApp__TickMs);
            break;

        case "source":
            Na__SetSource(m.readable);
            break;

        case "settings": {
            const Na__Old = Na__Set ? Na__Set.Region : null;
            const Na__Neu = m.settings.Region;
            const Na__RegionMoved = !Na__Old || Na__Old.x !== Na__Neu.x || Na__Old.y !== Na__Neu.y || Na__Old.w !== Na__Neu.w || Na__Old.h !== Na__Neu.h;
            const Na__IntervalChanged = Na__Set && Na__Set.IntervalSec !== m.settings.IntervalSec;
            Na__Set = m.settings;
            if (Na__RegionMoved) { Na__Reference = null; Na__PrevLuma = null; Na__TriggerT = 0; }
            if (Na__IntervalChanged && Na__State === "recording") Na__NextDue = Now + Na__Set.IntervalSec * 1000;
            break;
        }

        case "start":
            Na__Start(m.delayMs || 0);
            break;

        case "pause":
            if (Na__State === "recording") { Na__PauseT = Now; Na__TriggerT = 0; Na__SetState("paused"); }
            break;

        case "resume":
            if (Na__State === "paused") {
                Na__PausedTotal += Now - Na__PauseT;
                Na__NextDue      = Now + Na__Set.IntervalSec * 1000;
                Na__SetState("recording");
            }
            break;

        case "stop":
            Na__Stop("user");
            break;

        case "snap":
            if (Na__State === "recording" || Na__State === "paused") Na__Capture("manual");
            break;

        case "resetReference":
            Na__Reference = null;
            Na__ChangePct = 0;
            break;
    }
};

// endregion -------------------------------------------------------------------
