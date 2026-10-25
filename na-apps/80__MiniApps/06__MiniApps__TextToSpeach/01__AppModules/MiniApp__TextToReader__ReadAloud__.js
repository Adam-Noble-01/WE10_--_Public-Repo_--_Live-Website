// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - PHONON OFFLINE READ ALOUD
// =============================================================================
//
// PURPOSE : On-device WebAssembly synthesis with fully pre-rendered playback.
//           Article text is never sent to a speech API.
// =============================================================================


// REGION | State
// --------------------------------------------------------
let Na__Reader__Config = null;
let Na__Reader__Article = null;
let Na__Reader__Tts = null;
let Na__Reader__Runtime = null;
let Na__Reader__LoadPromise = null;
let Na__Reader__Controller = null;
let Na__Reader__AudioUrl = null;
let Na__Reader__GenerationId = 0;
let Na__Reader__Generating = false;
let Na__Reader__Ready = false;

const Na__Reader__Nodes = {
    panel    : document.getElementById("js__readAloudPanel"),
    prepare  : document.getElementById("js__audioPrepare"),
    pause    : document.getElementById("js__audioPause"),
    stop     : document.getElementById("js__audioStop"),
    speed    : document.getElementById("js__audioSpeed"),
    install  : document.getElementById("js__audioInstall"),
    status   : document.getElementById("js__audioStatus"),
    progress : document.getElementById("js__audioProgress"),
    engine   : document.getElementById("js__readAloudEngine"),
    audio    : document.getElementById("js__audioElement")
};
// endregion -------------------------------------------------------------------


// REGION | User Interface
// --------------------------------------------------------

// FUNCTION | SetStatus - Report installation, rendering or playback status
// --------------------------------------------------------
function Na__Reader__SetStatus(Na__Message) {
    Na__Reader__Nodes.status.textContent = Na__Message;
}
// --------------------------------------------------------


// FUNCTION | SetBusy - Disable conflicting actions during synthesis
// --------------------------------------------------------
function Na__Reader__SetBusy(Na__Busy) {
    Na__Reader__Generating = Na__Busy;
    Na__Reader__Nodes.prepare.disabled = Na__Busy;
    Na__Reader__Nodes.install.disabled = Na__Busy;
    Na__Reader__Nodes.stop.disabled = !Na__Busy && !Na__Reader__Ready;
    Na__Reader__Nodes.pause.disabled = !Na__Reader__Ready;
}
// --------------------------------------------------------


// FUNCTION | SetProgress - Indicate indeterminate progress or file download fraction
// --------------------------------------------------------
function Na__Reader__SetProgress(Na__Percent) {
    const Na__Bar = Na__Reader__Nodes.progress;
    Na__Bar.hidden = false;
    if (Na__Percent === null) {
        Na__Bar.removeAttribute("value");
    } else {
        Na__Bar.value = Math.min(100, Math.max(0, Na__Percent));
    }
}
// --------------------------------------------------------


// FUNCTION | FormatSeconds - Render audio duration without misleading precision
// --------------------------------------------------------
function Na__Reader__FormatSeconds(Na__Seconds) {
    const Na__Count = Math.round(Na__Seconds);
    return Math.floor(Na__Count / 60) + ":" + String(Na__Count % 60).padStart(2, "0");
}
// --------------------------------------------------------


// FUNCTION | UpdatePlaybackState - Reflect the actual HTML audio element state
// --------------------------------------------------------
function Na__Reader__UpdatePlaybackState() {
    const Na__Audio = Na__Reader__Nodes.audio;
    Na__Reader__Nodes.pause.textContent = Na__Audio.paused ? "Play" : "Pause";
    Na__Reader__Nodes.pause.disabled = !Na__Reader__Ready;
    Na__Reader__Nodes.stop.disabled = !Na__Reader__Generating && !Na__Reader__Ready;
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------


// REGION | Phonon Inference
// --------------------------------------------------------

// FUNCTION | LoadPhonon - Initialise q8 model and Easton voice only on demand
// --------------------------------------------------------
async function Na__Reader__LoadPhonon() {
    if (Na__Reader__Tts) return Na__Reader__Tts;
    if (Na__Reader__LoadPromise) return Na__Reader__LoadPromise;

    Na__Reader__LoadPromise = (async () => {
        Na__Reader__SetStatus("Loading Phonon. The first use downloads the model (about 65 MB plus assets).");
        Na__Reader__SetProgress(null);

        const Na__Url = new URL(Na__Reader__Config.NaMiniApp__RuntimeUrl, document.baseURI).href;
        Na__Reader__Runtime = await import(Na__Url);

        const Na__Tts = await Na__Reader__Runtime.PhononTTS.load({
            lang       : "en",
            model      : Na__Reader__Config.NaMiniApp__Model,
            quant      : "q8",
            device     : "cpu",
            threads    : "auto",
            cache      : true,
            onProgress : (Na__Info) => {
                const Na__Loaded = Na__Info.loaded / (1024 * 1024);
                const Na__Total = Na__Info.total ? Na__Info.total / (1024 * 1024) : null;
                Na__Reader__SetStatus(Na__Info.file + ": " + Na__Loaded.toFixed(1) +
                    (Na__Total ? " / " + Na__Total.toFixed(1) : "") + " MB" +
                    (Na__Info.cached ? " (cached)" : ""));
                Na__Reader__SetProgress(Na__Total ? 100 * Na__Loaded / Na__Total : null);
            }
        });

        try {
            await Na__Tts.addVoice(
                Na__Reader__Config.NaMiniApp__VoiceName,
                Na__Reader__Config.NaMiniApp__VoiceUrl
            );
        } catch (Na__Error) {
            Na__Tts.dispose();
            throw Na__Error;
        }

        Na__Reader__Tts = Na__Tts;
        Na__Reader__Nodes.engine.textContent = "Easton · " +
            Na__Tts.device + " · " + Na__Tts.threads + " CPU thread(s)";
        Na__Reader__Nodes.progress.hidden = true;
        Na__Reader__SetStatus("Easton is ready. Speech generation is entirely on this device.");
        return Na__Tts;
    })();

    try {
        return await Na__Reader__LoadPromise;

    } finally {
        Na__Reader__LoadPromise = null;
    }
}
// --------------------------------------------------------


// FUNCTION | ExtractReadingText - Prefer selected text inside the article
// --------------------------------------------------------
function Na__Reader__ExtractReadingText() {
    const Na__Selection = window.getSelection();
    if (Na__Selection && !Na__Selection.isCollapsed && Na__Selection.rangeCount > 0) {
        const Na__Container = Na__Selection.getRangeAt(0).commonAncestorContainer;
        if (Na__Reader__Article.contains(Na__Container)) {
            const Na__Selected = Na__Selection.toString().trim();
            if (Na__Selected) return Na__Selected;
        }
    }
    return (Na__Reader__Article.innerText || Na__Reader__Article.textContent || "").trim();
}
// --------------------------------------------------------


// FUNCTION | VerifyOfflineModel - Require all checkpoint pieces and Easton in Cache API
// --------------------------------------------------------
async function Na__Reader__VerifyOfflineModel() {
    if (!("caches" in window)) return false;
    const Na__Required = [
        "model.q8.gguf",
        "config.json",
        "tokenizer.json",
        "LMDIYE0Oa377Qh6Z.safetensors"
    ];
    for (let Na__Attempt = 0; Na__Attempt < 16; Na__Attempt++) {
        const Na__Cache = await caches.open(Na__Reader__Config.NaMiniApp__OfflineCacheName);
        const Na__Urls = (await Na__Cache.keys()).map((Na__Key) => Na__Key.url);
        if (Na__Required.every((Na__Filename) =>
            Na__Urls.some((Na__Url) => Na__Url.includes(Na__Filename))
        )) return true;

        await new Promise((Na__Resolve) => setTimeout(Na__Resolve, 400));
    }
    return false;
}
// --------------------------------------------------------


// FUNCTION | InstallOffline - Cache model, Easton and shell with verified presence
// --------------------------------------------------------
async function Na__Reader__InstallOffline() {
    Na__Reader__Nodes.install.disabled = true;
    try {
        if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable.");

        await navigator.serviceWorker.register(
            new URL("../MiniApp__TextToReader__ServiceWorker__.js", import.meta.url),
            { scope: "./" }
        );
        await navigator.serviceWorker.ready;
        await Na__Reader__LoadPhonon();

        if (navigator.storage?.persist) {
            await navigator.storage.persist().catch(() => false);
        }

        if (!await Na__Reader__VerifyOfflineModel()) {
            throw new Error("Model files could not all be confirmed in browser storage.");
        }

        Na__Reader__Nodes.install.textContent = "Offline voice installed";
        Na__Reader__SetStatus("Phonon and Easton are cached. Check offline operation in airplane mode.");

    } catch (Na__Error) {
        Na__Reader__SetStatus("Offline installation incomplete: " + Na__Error.message);

    } finally {
        Na__Reader__Nodes.install.disabled = false;
        Na__Reader__Nodes.progress.hidden = true;
    }
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------


// REGION | Playback
// --------------------------------------------------------

// FUNCTION | ReleaseAudio - Revoke the last rendered file and release memory
// --------------------------------------------------------
function Na__Reader__ReleaseAudio() {
    Na__Reader__Nodes.audio.pause();
    Na__Reader__Nodes.audio.removeAttribute("src");
    Na__Reader__Nodes.audio.load();
    if (Na__Reader__AudioUrl) URL.revokeObjectURL(Na__Reader__AudioUrl);
    Na__Reader__AudioUrl = null;
    Na__Reader__Ready = false;
    Na__Reader__UpdatePlaybackState();
}
// --------------------------------------------------------


// FUNCTION | StopReadAloud - Cancel inference and playback without touching article DOM
// --------------------------------------------------------
export function Na__TextToReader__StopReadAloud() {
    Na__Reader__GenerationId++;
    Na__Reader__Controller?.abort();
    Na__Reader__Controller = null;
    Na__Reader__SetBusy(false);
    Na__Reader__ReleaseAudio();
    Na__Reader__Nodes.progress.hidden = true;
}
// --------------------------------------------------------


// FUNCTION | PrepareAudio - Render all selected text into one gap-free WAV
// --------------------------------------------------------
async function Na__Reader__PrepareAudio() {
    const Na__Text = Na__Reader__ExtractReadingText();
    if (!Na__Text) {
        Na__Reader__SetStatus("No article text to read.");
        return;
    }
    if (Na__Text.length > Na__Reader__Config.NaMiniApp__MaxCharacters) {
        Na__Reader__SetStatus("This selection exceeds " +
            Na__Reader__Config.NaMiniApp__MaxCharacters.toLocaleString() +
            " characters. Select a shorter passage to limit mobile memory usage.");
        return;
    }

    Na__TextToReader__StopReadAloud();
    const Na__JobId = ++Na__Reader__GenerationId;
    const Na__Controller = new AbortController();
    Na__Reader__Controller = Na__Controller;
    Na__Reader__SetBusy(true);
    Na__Reader__Nodes.stop.disabled = false;
    Na__Reader__SetStatus("Preparing speech. Audio plays once generation completes.");
    Na__Reader__SetProgress(null);

    try {
        const Na__Tts = await Na__Reader__LoadPhonon();
        if (Na__JobId !== Na__Reader__GenerationId) return;

        const Na__Chunks = [];
        let Na__Samples = 0;
        let Na__NextUpdate = Na__Tts.sampleRate * 2;
        const Na__Start = performance.now();
        const Na__Speech = Na__Tts.stream(Na__Text, {
            voice  : Na__Reader__Config.NaMiniApp__VoiceName,
            signal : Na__Controller.signal
        });

        for await (const Na__Pcm of Na__Speech) {
            if (Na__JobId !== Na__Reader__GenerationId) {
                Na__Speech.cancel();
                return;
            }
            Na__Chunks.push(Na__Pcm);
            Na__Samples += Na__Pcm.length;
            if (Na__Samples >= Na__NextUpdate) {
                Na__Reader__SetStatus("Generated " +
                    Na__Reader__FormatSeconds(Na__Samples / Na__Tts.sampleRate) +
                    " of speech in " + ((performance.now() - Na__Start) / 1000).toFixed(1) + " s.");
                Na__NextUpdate += Na__Tts.sampleRate * 2;
            }
        }
        await Na__Speech.done;
        if (Na__JobId !== Na__Reader__GenerationId) return;

        const Na__Pcm = Na__Reader__Runtime.concatPcm(Na__Chunks);
        Na__Chunks.length = 0;
        const Na__Blob = Na__Reader__Runtime.encodeWav(Na__Pcm, Na__Tts.sampleRate);
        Na__Reader__AudioUrl = URL.createObjectURL(Na__Blob);
        Na__Reader__Nodes.audio.src = Na__Reader__AudioUrl;
        Na__Reader__Nodes.audio.playbackRate = Number(Na__Reader__Nodes.speed.value);
        Na__Reader__Nodes.audio.preservesPitch = true;
        Na__Reader__Ready = true;
        Na__Reader__SetBusy(false);
        Na__Reader__Nodes.progress.hidden = true;
        Na__Reader__SetStatus("Prepared " +
            Na__Reader__FormatSeconds(Na__Samples / Na__Tts.sampleRate) +
            " of audio in " + ((performance.now() - Na__Start) / 1000).toFixed(1) +
            " s. Playback no longer needs inference.");

        try {
            await Na__Reader__Nodes.audio.play();
        } catch (Na__PlaybackError) {
            Na__Reader__SetStatus("Audio prepared. Tap Play to begin; Android requires a playback gesture.");
        }
        Na__Reader__UpdatePlaybackState();

    } catch (Na__Error) {
        if (Na__JobId === Na__Reader__GenerationId) {
            Na__Reader__SetStatus(Na__Controller.signal.aborted
                ? "Preparation cancelled."
                : "Speech preparation failed: " + Na__Error.message);
            Na__Reader__SetBusy(false);
            Na__Reader__Nodes.progress.hidden = true;
        }

    } finally {
        if (Na__Reader__Controller === Na__Controller) Na__Reader__Controller = null;
    }
}
// --------------------------------------------------------


// FUNCTION | TogglePause - Pause or resume pre-generated speech
// --------------------------------------------------------
async function Na__Reader__TogglePause() {
    if (!Na__Reader__Ready) return;
    if (Na__Reader__Nodes.audio.paused) {
        try {
            await Na__Reader__Nodes.audio.play();
        } catch (Na__Error) {
            Na__Reader__SetStatus("Unable to start playback: " + Na__Error.message);
        }
    } else {
        Na__Reader__Nodes.audio.pause();
    }
    Na__Reader__UpdatePlaybackState();
}
// --------------------------------------------------------


// FUNCTION | SetReadAloudVisible - Audio controls belong to the Read tab alone
// --------------------------------------------------------
export function Na__TextToReader__SetReadAloudVisible(Na__Visible) {
    Na__Reader__Nodes.panel.hidden = !Na__Visible;
}
// --------------------------------------------------------


// FUNCTION | InitialiseReadAloud - Register controls, preferences and media session
// --------------------------------------------------------
export function Na__TextToReader__InitialiseReadAloud({ config, article }) {
    Na__Reader__Config = config;
    Na__Reader__Article = article;

    const Na__StoredSpeed = localStorage.getItem("NaTextToReader__PhononSpeed");
    Na__Reader__Nodes.speed.value = Na__StoredSpeed || String(config.NaMiniApp__DefaultSpeed);

    Na__Reader__Nodes.prepare.addEventListener("click", Na__Reader__PrepareAudio);
    Na__Reader__Nodes.install.addEventListener("click", Na__Reader__InstallOffline);
    Na__Reader__Nodes.stop.addEventListener("click", () => {
        Na__TextToReader__StopReadAloud();
        Na__Reader__SetStatus("Stopped.");
    });
    Na__Reader__Nodes.pause.addEventListener("click", Na__Reader__TogglePause);
    Na__Reader__Nodes.speed.addEventListener("change", () => {
        const Na__Speed = Number(Na__Reader__Nodes.speed.value);
        Na__Reader__Nodes.audio.playbackRate = Na__Speed;
        Na__Reader__Nodes.audio.preservesPitch = true;
        localStorage.setItem("NaTextToReader__PhononSpeed", String(Na__Speed));
    });

    for (const Na__Name of ["play", "pause", "ended"]) {
        Na__Reader__Nodes.audio.addEventListener(Na__Name, Na__Reader__UpdatePlaybackState);
    }

    if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title  : "Text To Reader",
            artist : "Phonon · Easton"
        });
        navigator.mediaSession.setActionHandler("play", () => Na__Reader__Nodes.audio.play());
        navigator.mediaSession.setActionHandler("pause", () => Na__Reader__Nodes.audio.pause());
        navigator.mediaSession.setActionHandler("stop", Na__TextToReader__StopReadAloud);
    }

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register(
            new URL("../MiniApp__TextToReader__ServiceWorker__.js", import.meta.url),
            { scope: "./" }
        ).catch((Na__Error) => console.warn("Offline worker not yet installed:", Na__Error));
    }
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------
