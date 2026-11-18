// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - PDF OCR
// =============================================================================
//
// FILE    : MiniApp__TextToReader__PdfOcr__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Read scanned PDF pages on the device: install, check and run
//           PaddleOCR PP-OCRv6 (ONNX Runtime Web in a Web Worker)
// CREATED : 18-Nov-2026
//
// CONTRACT v1 (what MiniApp__TextToReader__PdfRenderer__.js calls):
//   NaPdfOcr__GetStatus()            -> { installed, tier, bytesToDownload, totalBytes, threads }
//   NaPdfOcr__Install({ onProgress, signal })
//                                     downloads this device's tier, checks every
//                                     SHA-256, keeps it in Cache Storage;
//                                     onProgress({ loaded, total, file })
//   NaPdfOcr__RenderScale(wPt, hPt)  -> the pdf.js viewport scale to draw a page at
//   NaPdfOcr__RecognisePage(bitmap, { signal, onProgress })
//                                    -> { width, height, ms, lines: [{ text,
//                                         confidence, box: { x, y, width, height } }] }
//                                     lines top to bottom, then left to right, in
//                                     the bitmap's pixels; the bitmap is
//                                     transferred (closed) here. Rejects with an
//                                     AbortError on abort, with
//                                     Error("NaPdfOcr: not installed") before install,
//                                     with Error("NaPdfOcr: worker stopped") if the
//                                     worker fails mid-page and with
//                                     Error("NaPdfOcr: page timed out") past the
//                                     watchdog (90 s computers, 180 s phones); the
//                                     next page then starts a fresh worker.
//   NaPdfOcr__Dispose()               stops the worker and frees the models
//   NaPdfOcr__Configure({ tier, threads, charset, stallMs, scriptVote, pageTimeoutMs })   optional, for tests
//   NaPdfOcr__TestBreakWorker("crash" | "vanish")                       tests only
//
// FILES:
//   Published by the Pages workflow (and the dev server) into the git-ignored
//   05__PaddleOcrRuntime/ from pinned sources: onnxruntime-web 1.31.1 (npm) and
//   PP-OCRv6 det + rec ONNX (Hugging Face, pinned commits). The installer copies
//   one tier into the cache NaTextToReader__PaddleOcr__v1 under each file's plain
//   URL; the worker reads the models and the wasm from there, and the service
//   worker serves the runtime's two .mjs files from there when offline.
//
// TIERS:
//   small (det 9.9 MB + rec 21.2 MB) on computers; tiny (1.8 MB + 4.5 MB) on
//   phones and devices reporting 4 GB of memory or less. Both share the 14.8 MB
//   ONNX Runtime wasm. Measured 18-Nov-2026 in headless Edge on the studio PC,
//   A4 at 200 DPI, 14 lines: small 2.9 s a page on 4 threads (9.0 s on 1), tiny
//   0.85 s (2.2 s on 1); both read a clean scan and a rotated, noisy phone-photo
//   page word for word (tiny missed one character on the clean scan).
//
// THREADS:
//   ONNX Runtime threads need a cross-origin isolated page, and they are workers
//   started from inside the OCR worker. Some browsers cannot start nested
//   workers (DEVLOG 1.8.0 found it in the Claude desktop app's built-in browser,
//   though there, on 18-Nov-2026, 6 OCR threads started), so a threaded start
//   that has not finished in 20 s is dropped and the worker restarts on one
//   thread, as Phonon does.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Constants
// -----------------------------------------------------------------------------

const NaPdfOcr__RuntimeBase = new URL("../05__PaddleOcrRuntime/", import.meta.url);
// The worker carries this module's own ?v= so a release reloads both together
const NaPdfOcr__WorkerUrl   = new URL("./MiniApp__TextToReader__PdfOcrWorker__.js" + new URL(import.meta.url).search, import.meta.url);
const NaPdfOcr__CacheName   = "NaTextToReader__PaddleOcr__v1";
const NaPdfOcr__CachePrefix = "NaTextToReader__PaddleOcr__";
const NaPdfOcr__StallMs     = 20000;
// Watchdog: a page taking longer than this (or 10 x the slowest page so far, if
// more) fails alone and the worker is replaced. Measured pages take 0.5 to 4 s.
const NaPdfOcr__PageTimeoutMs = { phone: 180000, computer: 90000 };

// Every file, its size and SHA-256, as pinned in .github/workflows/static.yml
const NaPdfOcr__RuntimeFiles = [
    { path: "ort.wasm.min.mjs",            bytes: 53725,    sha256: "c21d9c326d453a4a61398270c804d5979e118540597cb0c07f7b3d64e6098234", type: "text/javascript" },
    { path: "ort-wasm-simd-threaded.mjs",  bytes: 24738,    sha256: "30ed0b5cd1182ede931fea448afb567d4dc705ec957af09f108a2be5f770dac3", type: "text/javascript" },
    { path: "ort-wasm-simd-threaded.wasm", bytes: 14848852, sha256: "4b884c203b0fa48d057be3332c65513ff85aa3c5bddd6946acc0fab7ecda001d", type: "application/wasm" }
];
const NaPdfOcr__TierFiles = {
    small: [
        { path: "models/small/det.onnx", bytes: 9880512,  sha256: "d73e0058b7a8086bbd57f3d10b8bcd4ff95363f67e06e2762b5e814fe9c9410e", type: "application/octet-stream" },
        { path: "models/small/rec.onnx", bytes: 21159378, sha256: "5435fd747c9e0efe15a96d0b378d5bd157e9492ed8fd80edf08f30d02fa24634", type: "application/octet-stream" },
        { path: "models/small/rec.yml",  bytes: 150579,   sha256: "ab078671bb49f06228eadccd34f1bb501e157f7a047095ffb943ba81512c77d1", type: "text/yaml; charset=utf-8" }
    ],
    tiny: [
        { path: "models/tiny/det.onnx",  bytes: 1780590,  sha256: "193bab7a04fca699a6c82e6abb5b81bdb28177f0abd4062552b04908dafb19f8", type: "application/octet-stream" },
        { path: "models/tiny/rec.onnx",  bytes: 4462639,  sha256: "9ef676d6ed3c88256a2d92c640c44f25b0c40947e111b14b8be8f594091563e6", type: "application/octet-stream" },
        { path: "models/tiny/rec.yml",   bytes: 55571,    sha256: "66170210bad538e83fff3c4a3867e547d6bf20b50d64b20347c4b913f3034ea1", type: "text/yaml; charset=utf-8" }
    ]
};

// How finely a page is drawn for OCR, and the longest side allowed (memory, speed)
const NaPdfOcr__Render = {
    small : { dpi: 200, maxSide: 3000 },
    tiny  : { dpi: 150, maxSide: 2000 }
};

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | State
// -----------------------------------------------------------------------------

const NaPdfOcr__State = {
    options   : {},             // NaPdfOcr__Configure overrides
    installed : null,           // the tier last found complete in the cache
    worker    : null,
    ready     : null,           // Promise of { threads } once the worker has loaded
    threads   : null,           // threads the running worker really got
    queue     : Promise.resolve(),
    pending   : new Map(),      // id -> { resolve, reject, onProgress }
    nextId    : 1,
    slowestMs : 0               // the slowest page read so far, for the watchdog
};

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Device
// -----------------------------------------------------------------------------

// FUNCTION | Is this a phone: a touch-first device with a small screen
// ------------------------------------------------------------
function NaPdfOcr__IsPhone() {
    const Na__Coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    const Na__Short  = typeof screen !== "undefined" ? Math.min(screen.width, screen.height) : Infinity;
    return Na__Coarse && Na__Short < 768;
}
// ------------------------------------------------------------


// FUNCTION | The model tier for this device
// ------------------------------------------------------------
function NaPdfOcr__Tier() {
    if (NaPdfOcr__State.options.tier) return NaPdfOcr__State.options.tier;
    const Na__Memory = navigator.deviceMemory;
    return NaPdfOcr__IsPhone() || (Na__Memory && Na__Memory <= 4) ? "tiny" : "small";
}
// ------------------------------------------------------------


// FUNCTION | The threads to ask ONNX Runtime for
// ------------------------------------------------------------
// Computers: one fewer than the cores, at most 6. Phones: 2 to 4. One thread
// when the page is not cross-origin isolated (no SharedArrayBuffer).
function NaPdfOcr__Threads() {
    if (NaPdfOcr__State.options.threads) return NaPdfOcr__State.options.threads;
    if (!globalThis.crossOriginIsolated) return 1;
    const Na__Cores = navigator.hardwareConcurrency || 1;
    if (NaPdfOcr__IsPhone()) return Math.max(1, Math.min(Na__Cores, 4, Math.max(2, Na__Cores - 1)));
    return Math.max(1, Math.min(6, Na__Cores - 1));
}
// ------------------------------------------------------------


// FUNCTION | The files one tier needs, with their plain same-origin URLs
// ------------------------------------------------------------
function NaPdfOcr__Files(Na__Tier) {
    return NaPdfOcr__RuntimeFiles.concat(NaPdfOcr__TierFiles[Na__Tier])
        .map((Na__File) => ({ ...Na__File, url: new URL(Na__File.path, NaPdfOcr__RuntimeBase).href }));
}
// ------------------------------------------------------------


// FUNCTION | The files of a tier not yet in the cache with the right checksum
// ------------------------------------------------------------
// Each cached file carries the SHA-256 it was checked against, so a file left
// from an older pin under the same URL counts as missing.
async function NaPdfOcr__MissingFiles(Na__Tier) {
    const Na__Files = NaPdfOcr__Files(Na__Tier);
    if (typeof caches === "undefined") return Na__Files;
    const Na__Cache = await caches.open(NaPdfOcr__CacheName);
    const Na__Missing = [];
    for (const Na__File of Na__Files) {
        const Na__Hit = await Na__Cache.match(Na__File.url);
        if (!Na__Hit || Na__Hit.headers.get("X-NaPdfOcr-Sha256") !== Na__File.sha256) Na__Missing.push(Na__File);
    }
    return Na__Missing;
}
// ------------------------------------------------------------


// FUNCTION | An AbortError like fetch's own
// ------------------------------------------------------------
function NaPdfOcr__AbortError(Na__Message) {
    return new DOMException(Na__Message || "Text recognition was cancelled", "AbortError");
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Status And Install
// -----------------------------------------------------------------------------

// FUNCTION | Is OCR installed on this device, and what is left to download
// ------------------------------------------------------------
export async function NaPdfOcr__GetStatus() {
    const Na__Tier = NaPdfOcr__Tier();
    const Na__Files = NaPdfOcr__Files(Na__Tier);
    const Na__Missing = await NaPdfOcr__MissingFiles(Na__Tier);
    const Na__Installed = Na__Missing.length === 0;
    NaPdfOcr__State.installed = Na__Installed ? Na__Tier : null;
    return {
        installed       : Na__Installed,
        tier            : Na__Tier,
        bytesToDownload : Na__Missing.reduce((Na__Sum, Na__File) => Na__Sum + Na__File.bytes, 0),
        totalBytes      : Na__Files.reduce((Na__Sum, Na__File) => Na__Sum + Na__File.bytes, 0),
        threads         : NaPdfOcr__State.threads || NaPdfOcr__Threads()
    };
}
// ------------------------------------------------------------


// FUNCTION | Download this device's tier, check every SHA-256, keep it for offline use
// ------------------------------------------------------------
export async function NaPdfOcr__Install({ onProgress, signal } = {}) {
    if (typeof caches === "undefined") throw new Error("NaPdfOcr: this browser has no Cache Storage, so text recognition cannot be kept");
    if (!globalThis.crypto || !crypto.subtle) throw new Error("NaPdfOcr: checksums need a secure page (https or localhost)");
    const Na__Tier = NaPdfOcr__Tier();
    // Caches of older pins are dropped first (the service worker only purges shells)
    for (const Na__Name of await caches.keys()) {
        if (Na__Name.startsWith(NaPdfOcr__CachePrefix) && Na__Name !== NaPdfOcr__CacheName) await caches.delete(Na__Name);
    }
    const Na__Missing = await NaPdfOcr__MissingFiles(Na__Tier);
    const Na__Total = Na__Missing.reduce((Na__Sum, Na__File) => Na__Sum + Na__File.bytes, 0);
    const Na__Cache = await caches.open(NaPdfOcr__CacheName);
    let Na__Done = 0;
    for (const Na__File of Na__Missing) {
        if (signal && signal.aborted) throw NaPdfOcr__AbortError("Text recognition download cancelled");
        const Na__Response = await fetch(Na__File.url, { signal, cache: "no-store" });
        if (!Na__Response.ok) throw new Error(`NaPdfOcr: ${Na__File.path} answered ${Na__Response.status}`);
        const Na__Bytes = new Uint8Array(Na__File.bytes);
        let Na__Got = 0;
        const Na__Reader = Na__Response.body.getReader();
        for (;;) {
            const { done, value } = await Na__Reader.read();
            if (done) break;
            if (Na__Got + value.length > Na__File.bytes) throw new Error(`NaPdfOcr: ${Na__File.path} is larger than expected`);
            Na__Bytes.set(value, Na__Got);
            Na__Got += value.length;
            if (onProgress) onProgress({ loaded: Na__Done + Na__Got, total: Na__Total, file: Na__File.path });
        }
        if (Na__Got !== Na__File.bytes) throw new Error(`NaPdfOcr: ${Na__File.path} is ${Na__Got} bytes, expected ${Na__File.bytes}`);
        const Na__Hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", Na__Bytes)),
            (Na__B) => Na__B.toString(16).padStart(2, "0")).join("");
        if (Na__Hash !== Na__File.sha256) throw new Error(`NaPdfOcr: ${Na__File.path} failed its checksum`);
        await Na__Cache.put(Na__File.url, new Response(Na__Bytes, { headers: {
            "Content-Type"      : Na__File.type,
            "Content-Length"    : String(Na__File.bytes),
            "X-NaPdfOcr-Sha256" : Na__File.sha256
        } }));
        Na__Done += Na__File.bytes;
    }
    NaPdfOcr__State.installed = Na__Tier;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Worker
// -----------------------------------------------------------------------------

// FUNCTION | Start the worker on a number of threads; resolves once both models load
// ------------------------------------------------------------
function NaPdfOcr__StartWorker(Na__Tier, Na__Threads) {
    const Na__Worker = new Worker(NaPdfOcr__WorkerUrl, { type: "module", name: "NaPdfOcr" });
    const Na__Ready = new Promise((Na__Resolve, Na__Reject) => {
        const Na__StallMs = NaPdfOcr__State.options.stallMs || NaPdfOcr__StallMs;
        const Na__Timer = Na__Threads > 1
            ? setTimeout(() => Na__Reject(new Error(`ONNX Runtime threads did not start within ${Na__StallMs / 1000} s`)), Na__StallMs)
            : null;
        Na__Worker.onmessage = (Na__Event) => {
            const Na__Msg = Na__Event.data;
            if (Na__Msg.type === "ready") { clearTimeout(Na__Timer); Na__Resolve(Na__Msg); }
            else if (Na__Msg.type === "error" && Na__Msg.id === undefined) { clearTimeout(Na__Timer); Na__Reject(new Error(Na__Msg.message)); }
        };
        Na__Worker.onerror = (Na__Event) => {
            clearTimeout(Na__Timer);
            Na__Event.preventDefault();
            Na__Reject(new Error(Na__Event.message || "the text recognition worker failed to start"));
        };
    });
    const Na__Files = Object.fromEntries(NaPdfOcr__Files(Na__Tier).map((Na__File) => [Na__File.path.split("/").pop(), Na__File.url]));
    Na__Worker.postMessage({
        type       : "init",
        ortUrl     : Na__Files["ort.wasm.min.mjs"],
        wasmBase   : NaPdfOcr__RuntimeBase.href,
        wasmFile   : "ort-wasm-simd-threaded.wasm",
        threads    : Na__Threads,
        cacheName  : NaPdfOcr__CacheName,
        detUrl     : Na__Files["det.onnx"],
        recUrl     : Na__Files["rec.onnx"],
        dictUrl    : Na__Files["rec.yml"],
        charset    : NaPdfOcr__State.options.charset || "latin",
        scriptVote : NaPdfOcr__State.options.scriptVote !== false,
        detMaxSide : NaPdfOcr__Render[Na__Tier].maxSide
    });
    return { worker: Na__Worker, ready: Na__Ready };
}
// ------------------------------------------------------------


// FUNCTION | The running worker, started once (one thread if threads stall)
// ------------------------------------------------------------
async function NaPdfOcr__EnsureWorker() {
    if (NaPdfOcr__State.ready) return NaPdfOcr__State.ready;
    NaPdfOcr__State.ready = (async () => {
        const Na__Tier = NaPdfOcr__Tier();
        let Na__Threads = NaPdfOcr__Threads();
        let Na__Started = NaPdfOcr__StartWorker(Na__Tier, Na__Threads);
        let Na__Info;
        try {
            Na__Info = await Na__Started.ready;
        } catch (Na__Error) {
            Na__Started.worker.terminate();
            if (Na__Threads <= 1) throw Na__Error;
            console.warn(`Text To Reader: text recognition on 1 thread instead of ${Na__Threads}: ${Na__Error.message}`);
            Na__Threads = 1;
            Na__Started = NaPdfOcr__StartWorker(Na__Tier, 1);
            try {
                Na__Info = await Na__Started.ready;
            } catch (Na__Retry) {
                Na__Started.worker.terminate();
                throw Na__Retry;
            }
        }
        const Na__Worker = Na__Started.worker;
        NaPdfOcr__State.worker = Na__Worker;
        NaPdfOcr__State.threads = Na__Threads;
        Na__Worker.onmessage = NaPdfOcr__OnMessage;
        // A worker that fails (out of memory, a WebAssembly abort) is replaced, never reused
        Na__Worker.onerror = (Na__Event) => {
            Na__Event.preventDefault();
            if (NaPdfOcr__State.worker === Na__Worker) NaPdfOcr__StopWorker(`it failed: ${Na__Event.message || "no message"}`);
        };
        Na__Worker.onmessageerror = () => {
            if (NaPdfOcr__State.worker === Na__Worker) NaPdfOcr__StopWorker("a message from it could not be read");
        };
        return { tier: Na__Tier, threads: Na__Threads, loadMs: Na__Info.ms };
    })();
    try {
        return await NaPdfOcr__State.ready;
    } catch (Na__Error) {
        NaPdfOcr__State.ready = null;
        throw Na__Error;
    }
}
// ------------------------------------------------------------


// FUNCTION | Messages from the running worker: progress, results, errors
// ------------------------------------------------------------
function NaPdfOcr__OnMessage(Na__Event) {
    const Na__Msg = Na__Event.data;
    const Na__Job = NaPdfOcr__State.pending.get(Na__Msg.id);
    if (!Na__Job) return;
    if (Na__Msg.type === "progress") {
        if (Na__Job.onProgress) Na__Job.onProgress({ done: Na__Msg.done, total: Na__Msg.total });
        return;
    }
    NaPdfOcr__State.pending.delete(Na__Msg.id);
    if (Na__Msg.type === "result") Na__Job.resolve(Na__Msg.result);
    else if (Na__Msg.name === "AbortError") Na__Job.reject(NaPdfOcr__AbortError());
    else Na__Job.reject(new Error(Na__Msg.message));
}
// ------------------------------------------------------------


// FUNCTION | Reject every page in flight (the worker died or was disposed)
// ------------------------------------------------------------
function NaPdfOcr__FailAll(Na__Error) {
    for (const Na__Job of NaPdfOcr__State.pending.values()) Na__Job.reject(Na__Error);
    NaPdfOcr__State.pending.clear();
}
// ------------------------------------------------------------


// FUNCTION | Drop a failed or stuck worker: its page fails, the next page starts a fresh one
// ------------------------------------------------------------
// Na__Reason goes to the console, which the activity log records. The page in
// flight fails with a plain Error (not an AbortError: nobody cancelled it).
function NaPdfOcr__StopWorker(Na__Reason, Na__Message = "NaPdfOcr: worker stopped") {
    const Na__Worker = NaPdfOcr__State.worker;
    if (Na__Worker) {
        Na__Worker.onmessage = Na__Worker.onerror = Na__Worker.onmessageerror = null;
        Na__Worker.terminate();
    }
    NaPdfOcr__State.worker = null;
    NaPdfOcr__State.ready = null;
    NaPdfOcr__State.threads = null;
    NaPdfOcr__FailAll(new Error(Na__Message));
    console.warn(`Text To Reader: text recognition worker stopped (${Na__Reason}); a fresh one starts for the next page`);
}
// ------------------------------------------------------------


// FUNCTION | How long one page may take before the watchdog gives up on it
// ------------------------------------------------------------
function NaPdfOcr__PageTimeout() {
    if (NaPdfOcr__State.options.pageTimeoutMs) return NaPdfOcr__State.options.pageTimeoutMs;
    const Na__Base = NaPdfOcr__IsPhone() ? NaPdfOcr__PageTimeoutMs.phone : NaPdfOcr__PageTimeoutMs.computer;
    return Math.max(Na__Base, 10 * NaPdfOcr__State.slowestMs);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | The pdf.js viewport scale to draw a page at for OCR
// ------------------------------------------------------------
// About 200 DPI on computers and 150 DPI on phones, with the longest side capped
// so a large drawing sheet cannot exhaust memory.
export function NaPdfOcr__RenderScale(Na__WidthPt, Na__HeightPt) {
    const Na__Plan = NaPdfOcr__Render[NaPdfOcr__Tier()];
    const Na__Longest = Math.max(1, Na__WidthPt || 0, Na__HeightPt || 0);
    return Math.min(Na__Plan.dpi / 72, Na__Plan.maxSide / Na__Longest);
}
// ------------------------------------------------------------


// FUNCTION | Read one page; resolves with its lines in reading order
// ------------------------------------------------------------
export function NaPdfOcr__RecognisePage(Na__Bitmap, { signal, onProgress } = {}) {
    if (signal && signal.aborted) {
        if (Na__Bitmap && Na__Bitmap.close) Na__Bitmap.close();
        return Promise.reject(NaPdfOcr__AbortError());
    }
    // One page at a time: each job waits for the one before it to finish in the worker
    let Na__Release;
    const Na__Turn = NaPdfOcr__State.queue;
    NaPdfOcr__State.queue = new Promise((Na__Resolve) => { Na__Release = Na__Resolve; });
    return new Promise((Na__Resolve, Na__Reject) => {
        let Na__Settled = false;
        const Na__Finish = (Na__Fn, Na__Value) => { if (!Na__Settled) { Na__Settled = true; Na__Fn(Na__Value); } };
        let Na__Id = 0;
        const Na__OnAbort = () => {
            if (Na__Id && NaPdfOcr__State.worker) NaPdfOcr__State.worker.postMessage({ type: "cancel", id: Na__Id });
            Na__Finish(Na__Reject, NaPdfOcr__AbortError());
        };
        if (signal) signal.addEventListener("abort", Na__OnAbort, { once: true });
        (async () => {
            try {
                await Na__Turn;
                if (signal && signal.aborted) throw NaPdfOcr__AbortError();
                const Na__Tier = NaPdfOcr__Tier();
                if (NaPdfOcr__State.installed !== Na__Tier && !(await NaPdfOcr__GetStatus()).installed) {
                    throw new Error("NaPdfOcr: not installed");
                }
                await NaPdfOcr__EnsureWorker();
                if (signal && signal.aborted) throw NaPdfOcr__AbortError();
                Na__Id = NaPdfOcr__State.nextId++;
                const Na__JobId = Na__Id;
                // Watchdog: a worker that died silently (no error event) never answers
                const Na__TimeoutMs = NaPdfOcr__PageTimeout();
                let Na__Watchdog = 0;
                const Na__Result = await new Promise((Na__Ok, Na__Fail) => {
                    NaPdfOcr__State.pending.set(Na__JobId, { resolve: Na__Ok, reject: Na__Fail, onProgress });
                    Na__Watchdog = setTimeout(() => {
                        if (NaPdfOcr__State.pending.has(Na__JobId)) {
                            NaPdfOcr__StopWorker(`a page took longer than ${Math.round(Na__TimeoutMs / 1000)} s`, "NaPdfOcr: page timed out");
                        }
                    }, Na__TimeoutMs);
                    NaPdfOcr__State.worker.postMessage({ type: "recognise", id: Na__JobId, bitmap: Na__Bitmap }, [Na__Bitmap]);
                    Na__Bitmap = null;
                }).finally(() => clearTimeout(Na__Watchdog));
                NaPdfOcr__State.slowestMs = Math.max(NaPdfOcr__State.slowestMs, Na__Result.ms || 0);
                Na__Finish(Na__Resolve, {
                    width   : Na__Result.width,
                    height  : Na__Result.height,
                    ms      : Na__Result.ms,
                    lines   : Na__Result.lines,
                    tier    : Na__Tier,
                    threads : NaPdfOcr__State.threads,
                    timing  : Na__Result.timing
                });
            } catch (Na__Error) {
                Na__Finish(Na__Reject, Na__Error);
            } finally {
                if (Na__Bitmap && Na__Bitmap.close) Na__Bitmap.close();
                if (signal) signal.removeEventListener("abort", Na__OnAbort);
                Na__Release();
            }
        })();
    });
}
// ------------------------------------------------------------


// FUNCTION | Stop the worker and free the models (they stay installed)
// ------------------------------------------------------------
export function NaPdfOcr__Dispose() {
    if (NaPdfOcr__State.worker) NaPdfOcr__State.worker.terminate();
    NaPdfOcr__FailAll(NaPdfOcr__AbortError("Text recognition was stopped"));
    NaPdfOcr__State.worker = null;
    NaPdfOcr__State.ready = null;
    NaPdfOcr__State.threads = null;
}
// ------------------------------------------------------------


// FUNCTION | Optional overrides for tests: { tier: "small"|"tiny", threads, charset: "latin"|"all", stallMs, scriptVote: false, pageTimeoutMs }
// ------------------------------------------------------------
export function NaPdfOcr__Configure(Na__Options = {}) {
    NaPdfOcr__Dispose();
    NaPdfOcr__State.options = { ...Na__Options };
    NaPdfOcr__State.installed = null;
    NaPdfOcr__State.slowestMs = 0;
}
// ------------------------------------------------------------


// FUNCTION | Tests only: break the running worker. "crash" fires its error event (as an
// out-of-memory or WebAssembly abort would); "vanish" stops it silently, for the watchdog.
// ------------------------------------------------------------
export function NaPdfOcr__TestBreakWorker(Na__Mode = "crash") {
    const Na__Worker = NaPdfOcr__State.worker;
    if (!Na__Worker) return false;
    if (Na__Mode === "vanish") Na__Worker.terminate();
    else Na__Worker.dispatchEvent(new ErrorEvent("error", { message: "test crash", cancelable: true }));
    return true;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
