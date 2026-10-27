// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - SPEECH ENGINES
// =============================================================================
//
// PURPOSE : One interface over the on-device speech models the Read tab can
//           switch between (Phonon and Kokoro), with their files served from
//           cdn.noble-architecture.com and kept in the Cache API for offline use.
//
// INTERFACE (what Na__TextToReader__LoadEngine resolves to):
//   engine.sampleRate                     Hz of every PCM chunk
//   engine.threads / engine.device        what generation actually got
//   engine.stream(text, { signal })       async iterable of mono Float32Array
//   engine.concatPcm / engine.encodeWav   join chunks, wrap PCM as a WAV Blob
//   engine.dispose()                      stop the worker and free the model
//
// OFFLINE INSTALL:
//   Each engine reads its own Cache API store before the network, keyed by the
//   URL it would fetch. The installer downloads every file from the CDN and puts
//   it into that store under that key, so the engine then loads from disk and
//   never reaches Hugging Face. Kokoro's runtime hard-codes Hugging Face URLs,
//   which is why its keys are Hub URLs while its bytes come from the CDN.
//
// THREADS:
//   Both runtimes run multi-threaded WebAssembly only on a cross-origin isolated
//   page (window.crossOriginIsolated). The service worker supplies the headers.
// =============================================================================


// REGION | Constants
// --------------------------------------------------------
const Na__Engines__PhononCacheName      = "phonon-tts-v1";
const Na__Engines__KokoroModelCacheName = "transformers-cache";
const Na__Engines__KokoroVoiceCacheName = "kokoro-voices";
// Same-origin runtime files. The service worker falls back to every cache when a
// file is not in its versioned shell, so these survive app releases offline.
const Na__Engines__KokoroRuntimeCacheName = "NaTextToReader__KokoroRuntime__v1";
const Na__Engines__KokoroRepoId         = "onnx-community/Kokoro-82M-v1.0-ONNX";
const Na__Engines__KokoroHubBase        = "https://huggingface.co/" + Na__Engines__KokoroRepoId + "/resolve/main/";

const Na__Engines__PhononWeightFiles = {
    q8  : "model.q8.gguf",
    f32 : "model.safetensors"
};

const Na__Engines__KokoroWeightFiles = {
    fp32  : "onnx/model.onnx",
    fp16  : "onnx/model_fp16.onnx",
    q8    : "onnx/model_quantized.onnx",
    q4    : "onnx/model_q4.onnx",
    q4f16 : "onnx/model_q4f16.onnx"
};

const Na__Engines__KokoroSampleRate = 24000;
const Na__Engines__ThreadStartMs    = 20000;
// endregion -------------------------------------------------------------------


// REGION | File Lists
// --------------------------------------------------------

// FUNCTION | JoinUrl - Base folder URL plus a relative file path
// --------------------------------------------------------
function Na__Engines__JoinUrl(Na__Base, Na__Path) {
    return new URL(Na__Path, Na__Base.endsWith("/") ? Na__Base : Na__Base + "/").href;
}
// --------------------------------------------------------


// FUNCTION | ListModelFiles - Every file a model needs, where it comes from and where it is kept
// --------------------------------------------------------
// Returns [{ name, sourceUrl, cacheName, cacheKey }].
export function Na__TextToReader__ListModelFiles(Na__Model, Na__Settings) {
    const Na__Base = Na__Settings.NaMiniApp__AssetsBaseUrl;
    const Na__Folder = Na__Engines__JoinUrl(Na__Base, Na__Model.NaMiniApp__Folder);
    const Na__VoiceUrl = Na__Engines__JoinUrl(Na__Base, Na__Model.NaMiniApp__VoiceFile);

    if (Na__Model.NaMiniApp__Engine === "phonon") {
        const Na__Weights = Na__Engines__PhononWeightFiles[Na__Model.NaMiniApp__Quant];
        return [Na__Weights, "config.json", "tokenizer.json"].map((Na__Name) => {
            const Na__Url = Na__Engines__JoinUrl(Na__Folder, Na__Name);
            return { name: Na__Name, sourceUrl: Na__Url, cacheName: Na__Engines__PhononCacheName, cacheKey: Na__Url };
        }).concat([{
            name      : Na__Model.NaMiniApp__VoiceName + " voice",
            sourceUrl : Na__VoiceUrl,
            cacheName : Na__Engines__PhononCacheName,
            cacheKey  : Na__VoiceUrl
        }]);
    }

    const Na__Weights = Na__Engines__KokoroWeightFiles[Na__Model.NaMiniApp__Dtype];
    const Na__ModelFiles = ["config.json", "tokenizer.json", "tokenizer_config.json", Na__Weights].map((Na__Name) => ({
        name      : Na__Name,
        sourceUrl : Na__Engines__JoinUrl(Na__Folder, Na__Name),
        cacheName : Na__Engines__KokoroModelCacheName,
        cacheKey  : Na__Engines__KokoroHubBase + Na__Name
    }));
    const Na__RuntimeBase = new URL(Na__Settings.NaMiniApp__KokoroRuntimeUrl, document.baseURI);
    const Na__RuntimeFiles = ["kokoro.web.js", "ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"].map((Na__Name) => ({
        name      : Na__Name,
        sourceUrl : new URL(Na__Name, Na__RuntimeBase).href,
        cacheName : Na__Engines__KokoroRuntimeCacheName,
        cacheKey  : new URL(Na__Name, Na__RuntimeBase).href
    }));
    return Na__ModelFiles.concat([{
        name      : Na__Model.NaMiniApp__VoiceName + " voice",
        sourceUrl : Na__VoiceUrl,
        cacheName : Na__Engines__KokoroVoiceCacheName,
        cacheKey  : Na__Engines__KokoroHubBase + "voices/" + Na__Model.NaMiniApp__VoiceName + ".bin"
    }], Na__RuntimeFiles);
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------


// REGION | Install And Verify
// --------------------------------------------------------

// FUNCTION | FindCached - Look a file up in its own store
// --------------------------------------------------------
async function Na__Engines__FindCached(Na__File) {
    if (!("caches" in window)) return undefined;
    const Na__Cache = await caches.open(Na__File.cacheName);
    return Na__Cache.match(Na__File.cacheKey);
}
// --------------------------------------------------------


// FUNCTION | IsModelInstalled - True when every file of the model is on this device
// --------------------------------------------------------
export async function Na__TextToReader__IsModelInstalled(Na__Model, Na__Settings) {
    if (!("caches" in window)) return false;
    for (const Na__File of Na__TextToReader__ListModelFiles(Na__Model, Na__Settings)) {
        if (!await Na__Engines__FindCached(Na__File)) return false;
    }
    return true;
}
// --------------------------------------------------------


// FUNCTION | MissingDownloadBytes - Bytes still to download for a model, null when unknown (offline)
// --------------------------------------------------------
// Voices of one engine share its model files, so a second voice is often a few
// hundred KB: the size comes from the files actually missing, not the config.
// Cloudflare compresses the small JSON files and then sends no Content-Length;
// they are a few KB, so they count as nothing.
export async function Na__TextToReader__MissingDownloadBytes(Na__Model, Na__Settings) {
    let Na__Total = 0;
    for (const Na__File of Na__TextToReader__ListModelFiles(Na__Model, Na__Settings)) {
        if (await Na__Engines__FindCached(Na__File)) continue;
        try {
            const Na__Response = await fetch(Na__File.sourceUrl, { method: "HEAD", cache: "no-store" });
            if (!Na__Response.ok) return null;
            Na__Total += Number(Na__Response.headers.get("content-length")) || 0;
        } catch {
            return null;
        }
    }
    return Na__Total;
}
// --------------------------------------------------------


// FUNCTION | ReadWithProgress - Read a response body, reporting bytes as they arrive
// --------------------------------------------------------
async function Na__Engines__ReadWithProgress(Na__Response, Na__OnBytes) {
    if (!Na__Response.body) return new Uint8Array(await Na__Response.arrayBuffer());
    const Na__Reader = Na__Response.body.getReader();
    const Na__Parts = [];
    let Na__Loaded = 0;
    for (;;) {
        const { done, value } = await Na__Reader.read();
        if (done) break;
        Na__Parts.push(value);
        Na__Loaded += value.length;
        Na__OnBytes(Na__Loaded);
    }
    const Na__Bytes = new Uint8Array(Na__Loaded);
    let Na__Offset = 0;
    for (const Na__Part of Na__Parts) {
        Na__Bytes.set(Na__Part, Na__Offset);
        Na__Offset += Na__Part.length;
    }
    return Na__Bytes;
}
// --------------------------------------------------------


// FUNCTION | InstallModel - Download every missing file from the CDN into its store
// --------------------------------------------------------
// onProgress({ loaded, total }) in bytes across the whole download; total is the
// sum of the Content-Length headers known so far, so it settles as files start.
export async function Na__TextToReader__InstallModel(Na__Model, Na__Settings, Na__OnProgress) {
    const Na__Files = Na__TextToReader__ListModelFiles(Na__Model, Na__Settings);
    const Na__Missing = [];
    for (const Na__File of Na__Files) {
        if (!await Na__Engines__FindCached(Na__File)) Na__Missing.push(Na__File);
    }

    let Na__Done = 0;
    let Na__Total = (Na__Model.NaMiniApp__DownloadMb || 0) * 1024 * 1024;
    for (const Na__File of Na__Missing) {
        const Na__Response = await fetch(Na__File.sourceUrl, { cache: "no-store" });
        if (!Na__Response.ok) throw new Error(Na__File.name + ": HTTP " + Na__Response.status);

        const Na__Length = Number(Na__Response.headers.get("content-length")) || 0;
        const Na__Bytes = await Na__Engines__ReadWithProgress(Na__Response, (Na__Loaded) => {
            Na__OnProgress?.({ file: Na__File.name, loaded: Na__Done + Na__Loaded, total: Math.max(Na__Total, Na__Done + Na__Loaded) });
        });
        Na__Done += Na__Bytes.length;
        // Fewer bytes than promised; a compressed reply can only unpack to more
        if (Na__Length && Na__Bytes.length < Na__Length) {
            throw new Error(Na__File.name + ": download was cut short");
        }

        const Na__Cache = await caches.open(Na__File.cacheName);
        await Na__Cache.put(Na__File.cacheKey, new Response(Na__Bytes, {
            headers: {
                "Content-Type"   : Na__Response.headers.get("content-type") || "application/octet-stream",
                "Content-Length" : String(Na__Bytes.length)
            }
        }));
    }

    if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
    if (!await Na__TextToReader__IsModelInstalled(Na__Model, Na__Settings)) {
        throw new Error("Model files could not all be confirmed in browser storage.");
    }
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------


// REGION | Engines
// --------------------------------------------------------

// FUNCTION | PhononThreads - Threads to ask Phonon for on this device
// --------------------------------------------------------
// Phonon's "auto" is 3, which suits phones (big cores only). Measured on a 32-thread
// desktop in Edge: 1 thread 2.8x real time, 3 threads 5.6x, 4 threads 6.4x, 6 threads
// 8.1x. So a machine with enough cores gets more.
function Na__Engines__PhononThreads(Na__Settings) {
    const Na__Cores = navigator.hardwareConcurrency || 1;
    const Na__Desktop = Number(Na__Settings.NaMiniApp__DesktopThreads) || 0;
    const Na__MinCores = Number(Na__Settings.NaMiniApp__DesktopMinCores) || Infinity;
    return Na__Desktop && Na__Cores >= Na__MinCores ? Math.min(Na__Desktop, Na__Cores) : "auto";
}
// --------------------------------------------------------


// FUNCTION | LoadWavHelpers - concatPcm and encodeWav from the Phonon runtime, used by every engine
// --------------------------------------------------------
async function Na__Engines__LoadWavHelpers(Na__Settings) {
    const Na__Url = new URL("wav.js", new URL(Na__Settings.NaMiniApp__RuntimeUrl, document.baseURI));
    const { concatPcm, encodeWav } = await import(Na__Url.href);
    return { concatPcm, encodeWav };
}
// --------------------------------------------------------


// FUNCTION | LoadPhonon - Phonon through phonon-tts, files named explicitly at the CDN
// --------------------------------------------------------
async function Na__Engines__LoadPhonon(Na__Model, Na__Settings) {
    const Na__Runtime = await import(new URL(Na__Settings.NaMiniApp__RuntimeUrl, document.baseURI).href);
    const Na__Files = Na__TextToReader__ListModelFiles(Na__Model, Na__Settings);
    const Na__Voice = Na__Model.NaMiniApp__VoiceName;

    const Na__Load = (Na__Threads, Na__OnProgress) => Na__Runtime.PhononTTS.load({
        lang       : "en",
        quant      : Na__Model.NaMiniApp__Quant,
        device     : Na__Model.NaMiniApp__Device,
        threads    : Na__Threads,
        cache      : true,
        voices     : [Na__Voice],
        onProgress : Na__OnProgress,
        model      : {
            weights      : { [Na__Model.NaMiniApp__Quant]: Na__Files[0].sourceUrl },
            config       : Na__Files[1].sourceUrl,
            tokenizer    : Na__Files[2].sourceUrl,
            voices       : { [Na__Voice]: Na__Files[3].sourceUrl },
            defaultVoice : Na__Voice
        }
    });

    // The thread pool starts before any file is read. A browser that cannot start a
    // worker from inside a worker (the Claude desktop app's pane) never finishes it and
    // never reports progress, so after a quiet spell load again on one thread.
    const Na__Threads = Na__Engines__PhononThreads(Na__Settings);
    let Na__Tts;
    if (Na__Threads === 1) {
        Na__Tts = await Na__Load(1);
    } else {
        let Na__Started = false;
        let Na__Timer = 0;
        const Na__Stalled = new Promise((Na__Resolve) => {
            Na__Timer = setTimeout(() => Na__Resolve(null), Na__Engines__ThreadStartMs);
        });
        Na__Tts = await Promise.race([
            Na__Load(Na__Threads, () => {
                Na__Started = true;
                clearTimeout(Na__Timer);
            }),
            Na__Stalled.then(() => (Na__Started ? new Promise(() => {}) : null))
        ]);
        clearTimeout(Na__Timer);
        if (!Na__Tts) {
            console.warn("Phonon threads did not start; loading on one thread.");
            Na__Tts = await Na__Load(1);
        }
    }

    return {
        sampleRate    : Na__Tts.sampleRate,
        threads       : Na__Tts.threads,
        threadsReason : Na__Tts.threadsReason,
        device        : Na__Tts.device,
        stream        : (Na__Text, Na__Options = {}) => Na__Tts.stream(Na__Text, {
            voice  : Na__Voice,
            signal : Na__Options.signal
        }),
        concatPcm     : Na__Runtime.concatPcm,
        encodeWav     : Na__Runtime.encodeWav,
        dispose       : () => Na__Tts.dispose()
    };
}
// --------------------------------------------------------


// FUNCTION | KokoroThreads - The thread count ONNX Runtime Web picks for itself
// --------------------------------------------------------
function Na__Engines__KokoroThreads(Na__Device) {
    if (Na__Device === "webgpu") return { threads: 1, reason: "generation runs on the GPU" };
    if (!window.crossOriginIsolated) return { threads: 1, reason: "the page is not cross-origin isolated" };
    const Na__Cores = navigator.hardwareConcurrency || 1;
    return { threads: Math.min(4, Math.ceil(Na__Cores / 2)), reason: "default" };
}
// --------------------------------------------------------


// FUNCTION | LoadKokoro - Kokoro 82M through kokoro-js, files pre-filled from the CDN
// --------------------------------------------------------
async function Na__Engines__LoadKokoro(Na__Model, Na__Settings) {
    const Na__RuntimeUrl = new URL(Na__Settings.NaMiniApp__KokoroRuntimeUrl, document.baseURI);
    const Na__Kokoro = await import(new URL("kokoro.web.js", Na__RuntimeUrl).href);
    // ONNX Runtime's loader and wasm sit beside kokoro.web.js, same-origin, so
    // its thread workers can start (the default is a cross-origin CDN).
    Na__Kokoro.env.wasmPaths = Na__RuntimeUrl.href;

    const Na__Device = Na__Model.NaMiniApp__Device;
    const Na__Tts = await Na__Kokoro.KokoroTTS.from_pretrained(Na__Engines__KokoroRepoId, {
        dtype  : Na__Model.NaMiniApp__Dtype,
        device : Na__Device
    });
    const Na__Voice = Na__Model.NaMiniApp__VoiceName;
    const Na__Threads = Na__Engines__KokoroThreads(Na__Device);
    const Na__Wav = await Na__Engines__LoadWavHelpers(Na__Settings);

    // A stream that stops between sentences when the signal aborts. kokoro-js 1.2.1
    // never closes the sentence splitter it makes for a plain string, so its last
    // sentence waits forever: pass one that is already closed.
    async function* Na__Stream(Na__Text, Na__Options = {}) {
        const Na__Splitter = new Na__Kokoro.TextSplitterStream();
        Na__Splitter.push(Na__Text);
        Na__Splitter.close();
        for await (const Na__Part of Na__Tts.stream(Na__Splitter, { voice: Na__Voice })) {
            if (Na__Options.signal?.aborted) return;
            yield Na__Part.audio.audio;
        }
    }

    return {
        sampleRate    : Na__Engines__KokoroSampleRate,
        threads       : Na__Threads.threads,
        threadsReason : Na__Threads.reason,
        device        : Na__Device === "webgpu" ? "webgpu" : "cpu",
        stream        : (Na__Text, Na__Options) => {
            const Na__Iterator = Na__Stream(Na__Text, Na__Options);
            Na__Iterator.done = Promise.resolve();
            Na__Iterator.cancel = () => Na__Iterator.return();
            return Na__Iterator;
        },
        concatPcm     : Na__Wav.concatPcm,
        encodeWav     : Na__Wav.encodeWav,
        dispose       : () => Na__Tts.model?.dispose?.()
    };
}
// --------------------------------------------------------


// FUNCTION | LoadEngine - Load the model's engine from the files already on this device
// --------------------------------------------------------
export function Na__TextToReader__LoadEngine(Na__Model, Na__Settings) {
    return Na__Model.NaMiniApp__Engine === "kokoro"
        ? Na__Engines__LoadKokoro(Na__Model, Na__Settings)
        : Na__Engines__LoadPhonon(Na__Model, Na__Settings);
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------
