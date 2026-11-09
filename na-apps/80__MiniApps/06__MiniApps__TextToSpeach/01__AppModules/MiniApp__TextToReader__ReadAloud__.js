// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - OFFLINE READ ALOUD
// =============================================================================
//
// PURPOSE : On-device WebAssembly synthesis with fully pre-rendered playback.
//           Article text is never sent to a speech API. The voice (a Phonon or
//           Kokoro model plus speaker) is chosen in the voice modal; each one is
//           downloaded once from the CDN and kept for offline use.
// =============================================================================


// REGION | Imports
// --------------------------------------------------------
// @delegate: ./MiniApp__TextToReader__Highlight__.js
import {
    Na__TextToReader__WrapArticle,
    Na__TextToReader__BuildReadingPlan,
    Na__TextToReader__SelectionStartWord,
    Na__TextToReader__TimeSentence,
    Na__TextToReader__SetHighlightTimeline,
    Na__TextToReader__SetOutsideJumpHandler,
    Na__TextToReader__InitialiseHighlight
} from "./MiniApp__TextToReader__Highlight__.js";

// @delegate: ./MiniApp__TextToReader__Sections__.js (read a long document a section at a time)
import {
    Na__TextToReader__CutSections,
    Na__TextToReader__IndexSections,
    Na__TextToReader__UnrenderedStretch,
    Na__TextToReader__RecutSections,
    Na__TextToReader__OpenerSize,
    Na__TextToReader__RecordRenderTiming,
    Na__TextToReader__FitSectionSize,
    Na__TextToReader__PlanSectionRender,
    Na__TextToReader__PackSection,
    Na__TextToReader__SectionWav,
    Na__TextToReader__SectionTimeline,
    Na__TextToReader__SectionCacheGet,
    Na__TextToReader__SectionCacheHas,
    Na__TextToReader__SectionCachePut,
    Na__TextToReader__SectionCacheDrop,
    Na__TextToReader__SectionCacheClear,
    Na__TextToReader__SectionCacheBytes,
    Na__TextToReader__SectionCacheRetain
} from "./MiniApp__TextToReader__Sections__.js";

// @delegate: ./MiniApp__TextToReader__SpeechEngines__.js
import {
    Na__TextToReader__LoadEngine,
    Na__TextToReader__InstallModel,
    Na__TextToReader__IsModelInstalled,
    Na__TextToReader__MissingDownloadBytes
} from "./MiniApp__TextToReader__SpeechEngines__.js";

// @delegate: ./MiniApp__TextToReader__UserConfig__.js (voice, speed and pitch remembered between sessions)
import {
    Na__TextToReader__GetUserSetting,
    Na__TextToReader__SetUserSetting
} from "./MiniApp__TextToReader__UserConfig__.js";

// @delegate: ./MiniApp__TextToReader__ActivityLog__.js
import {
    Na__TextToReader__Log,
    Na__TextToReader__LogTimer
} from "./MiniApp__TextToReader__ActivityLog__.js";
// endregion -------------------------------------------------------------------


// REGION | State
// --------------------------------------------------------
let Na__Reader__Config = null;
let Na__Reader__Article = null;
let Na__Reader__Engine = null;
let Na__Reader__EngineModelId = null;
let Na__Reader__LoadPromise = null;
let Na__Reader__Controller = null;
let Na__Reader__AudioUrl = null;
let Na__Reader__GenerationId = 0;
let Na__Reader__Generating = false;
let Na__Reader__Ready = false;
let Na__Reader__PreparedText = null;
let Na__Reader__SyncTimer = 0;

const Na__Reader__Nodes = {
    panel    : document.getElementById("js__readAloudPanel"),
    prepare  : document.getElementById("js__audioPrepare"),
    pause    : document.getElementById("js__audioPause"),
    stop     : document.getElementById("js__audioStop"),
    speed    : document.getElementById("js__audioSpeed"),
    playing  : document.getElementById("js__audioPlaying"),
    model    : document.getElementById("js__audioModel"),
    status   : document.getElementById("js__audioStatus"),
    progress : document.getElementById("js__audioProgress"),
    audio    : document.getElementById("js__audioElement")
};

const Na__Reader__Modal = {
    dialog   : document.getElementById("js__voiceModal"),
    choices  : document.getElementById("js__voiceModalChoices"),
    sectionsToggle : document.getElementById("js__voiceSectionsToggle"),
    sectionsNote   : document.getElementById("js__voiceSectionsNote"),
    pitchSlider : document.getElementById("js__voicePitchSlider"),
    pitchValue  : document.getElementById("js__voicePitchValue"),
    download : document.getElementById("js__voiceModalDownload"),
    later    : document.getElementById("js__voiceModalLater"),
    status   : document.getElementById("js__voiceModalStatus"),
    progress : document.getElementById("js__voiceModalProgress")
};

const Na__Reader__UserSection = "NaUserConfig__ReadAloud";
const Na__Reader__InstalledIds = new Set();
let Na__Reader__Installing = false;
let Na__Reader__InstallLog = null;
let Na__Reader__OnDismiss = null;
let Na__Reader__ModalChoice = null;
let Na__Reader__ModalForced = false;

const Na__Reader__SpeedSteps = [1, 1.25, 1.5, 2, 2.5];
const Na__Reader__IconBase = "./01__AppAssets__TextToReader/UiIcons__MenuIcons__ReadAloud/";
let Na__Reader__Speed = 2;

// Pitch: -25..+25 %. The WAV header is written at sampleRate x factor, which shifts pitch
// and tempo together; playbackRate then divides the factor back out (pitch preserved), so
// speed stays whatever the speedo says. The PCM is kept so pitch can change without re-preparing.
let Na__Reader__PitchPercent = 0;
let Na__Reader__AppliedPitch = 1;
let Na__Reader__Pcm = null;
let Na__Reader__SampleRate = 0;
let Na__Reader__EncodeWav = null;
let Na__Reader__BaseTimeline = null;

// Sectioned reading (the voice modal's switch): two sentences first, then sections sized to
// what this device can render ahead of the playhead. Run is the active read; SectionAudio is
// the kept section now on the
// audio element, standing in for Pcm when pitch is applied.
let Na__Reader__SectionMode = false;
let Na__Reader__Run = null;
let Na__Reader__SectionAudio = null;
let Na__Reader__SectionStarting = false;
let Na__Reader__QueuedRequest = null;  // Sentence tapped before the first run is ready
let Na__Reader__AutoStartPending = false; // Continue after a missing voice is installed
let Na__Reader__TransportDragging = false;
const Na__Reader__Transport = {
    bar       : document.getElementById("js__audioTransport"),
    previous  : document.getElementById("js__audioPrevSentence"),
    backward  : document.getElementById("js__audioBackTen"),
    seek      : document.getElementById("js__audioSeek"),
    forward   : document.getElementById("js__audioForwardTen"),
    next      : document.getElementById("js__audioNextSentence"),
    elapsed   : document.getElementById("js__audioElapsed"),
    duration  : document.getElementById("js__audioDuration"),
    section   : document.getElementById("js__audioSectionLabel")
};
// endregion -------------------------------------------------------------------


// REGION | User Interface
// --------------------------------------------------------

// FUNCTION | SetStatus - Report installation, rendering or playback status
// --------------------------------------------------------
// The bar's status fades out a few seconds after the last message, but never while
// the progress bar shows work still running (preparing speech, downloading the voice).
const Na__Reader__StatusHoldMs = 2000;
let Na__Reader__StatusTimer = 0;

function Na__Reader__FadeStatusWhenIdle() {
    if (!Na__Reader__Nodes.progress.hidden) {
        Na__Reader__StatusTimer = setTimeout(Na__Reader__FadeStatusWhenIdle, Na__Reader__StatusHoldMs);
        return;
    }
    Na__Reader__Nodes.status.classList.add("TTR__audio-status--faded");
}

function Na__Reader__SetStatus(Na__Message) {
    clearTimeout(Na__Reader__StatusTimer);
    Na__Reader__Nodes.status.textContent = Na__Message;
    Na__Reader__Nodes.status.title = Na__Message;
    Na__Reader__Nodes.status.classList.remove("TTR__audio-status--faded");
    if (Na__Message) Na__Reader__StatusTimer = setTimeout(Na__Reader__FadeStatusWhenIdle, Na__Reader__StatusHoldMs);
    if (Na__Reader__Modal.dialog.open) Na__Reader__Modal.status.textContent = Na__Message;
}
// --------------------------------------------------------


// FUNCTION | SetSpeed - Snap to a speedo step, swing the needle and apply the rate
// --------------------------------------------------------
function Na__Reader__SetSpeed(Na__Requested, Na__Persist) {
    const Na__Speed = Na__Reader__SpeedSteps.reduce((Na__Best, Na__Step) =>
        Math.abs(Na__Step - Na__Requested) < Math.abs(Na__Best - Na__Requested) ? Na__Step : Na__Best);
    const Na__Label = (Number.isInteger(Na__Speed) ? Na__Speed.toFixed(1) : String(Na__Speed)) + "×";
    const Na__Button = Na__Reader__Nodes.speed;

    Na__Reader__Speed = Na__Speed;
    Na__Button.dataset.speed = String(Na__Speed);
    Na__Button.setAttribute("aria-label", "Playback speed " + Na__Label + ". Tap to change.");
    Na__Button.querySelector(".TTR__audio-speed-value").textContent = Na__Label;
    Na__Button.querySelector(".NaSpeedo")?.setAttribute("data-speed", String(Na__Speed));
    Na__Reader__ApplyPlaybackRate();
    if (Na__Persist) Na__TextToReader__SetUserSetting(Na__Reader__UserSection, "NaUserConfig__PlaybackSpeed", Na__Speed);
}
// --------------------------------------------------------


// FUNCTION | ApplyPlaybackRate - Speed, less the pitch factor already baked into the WAV
// --------------------------------------------------------
function Na__Reader__ApplyPlaybackRate() {
    Na__Reader__Nodes.audio.playbackRate = Na__Reader__Speed / Na__Reader__AppliedPitch;
    Na__Reader__Nodes.audio.preservesPitch = true;
}
// --------------------------------------------------------


// FUNCTION | EncodePitched - WAV blob URL at the pitch factor, and the factor actually used
// --------------------------------------------------------
function Na__Reader__EncodePitched(Na__Factor) {
    // A kept section is wrapped at the factor straight from its 16-bit data
    if (Na__Reader__SectionAudio) {
        const Na__SectionRate = Math.round(Na__Reader__SectionAudio.sampleRate * Na__Factor);
        return {
            url       : URL.createObjectURL(Na__TextToReader__SectionWav(Na__Reader__SectionAudio, Na__SectionRate)),
            effective : Na__SectionRate / Na__Reader__SectionAudio.sampleRate
        };
    }
    const Na__Rate = Math.round(Na__Reader__SampleRate * Na__Factor);
    return {
        url       : URL.createObjectURL(Na__Reader__EncodeWav(Na__Reader__Pcm, Na__Rate)),
        effective : Na__Rate / Na__Reader__SampleRate
    };
}
// --------------------------------------------------------


// FUNCTION | ScaleTimeline - The sentence timeline in the pitched file's seconds
// --------------------------------------------------------
function Na__Reader__ScaleTimeline(Na__Factor) {
    if (!Na__Reader__BaseTimeline || Na__Factor === 1) return Na__Reader__BaseTimeline;
    return Na__Reader__BaseTimeline.map((Na__Entry) => ({
        ...Na__Entry,
        start      : Na__Entry.start / Na__Factor,
        end        : Na__Entry.end / Na__Factor,
        wordStarts : Na__Entry.wordStarts.map((Na__Time) => Na__Time / Na__Factor)
    }));
}
// --------------------------------------------------------


// FUNCTION | SetPitch - Sync the slider; on Apply, remember the pitch and re-pitch prepared audio in place
// --------------------------------------------------------
function Na__Reader__SetPitch(Na__Percent, Na__Apply) {
    const Na__Range = Number(Na__Reader__Config?.NaMiniApp__PitchRangePercent) || 25;
    Na__Reader__PitchPercent = Math.max(-Na__Range, Math.min(Na__Range, Math.round(Number(Na__Percent) || 0)));

    const Na__Sign = Na__Reader__PitchPercent > 0 ? "+" : "";
    Na__Reader__Modal.pitchSlider.value = String(Na__Reader__PitchPercent);
    Na__Reader__Modal.pitchValue.textContent = Na__Sign + Na__Reader__PitchPercent + "%";

    if (!Na__Apply) return;
    Na__TextToReader__SetUserSetting(Na__Reader__UserSection, "NaUserConfig__PitchPercent", Na__Reader__PitchPercent);
    Na__Reader__RepitchAudio();
}
// --------------------------------------------------------


// FUNCTION | RepitchAudio - Swap prepared audio for a re-pitched copy, keeping position and play state
// --------------------------------------------------------
function Na__Reader__RepitchAudio() {
    if (!Na__Reader__Ready || !(Na__Reader__Pcm || Na__Reader__SectionAudio)) return;
    const Na__Audio = Na__Reader__Nodes.audio;
    const Na__Pitched = Na__Reader__EncodePitched(1 + Na__Reader__PitchPercent / 100);
    if (Na__Pitched.effective === Na__Reader__AppliedPitch) {
        URL.revokeObjectURL(Na__Pitched.url);
        return;
    }

    const Na__Position = Na__Audio.currentTime * Na__Reader__AppliedPitch / Na__Pitched.effective;
    const Na__WasPlaying = !Na__Audio.paused;
    const Na__OldUrl = Na__Reader__AudioUrl;

    Na__Reader__AppliedPitch = Na__Pitched.effective;
    Na__Reader__AudioUrl = Na__Pitched.url;
    Na__Audio.src = Na__Pitched.url;
    Na__Reader__ApplyPlaybackRate();
    Na__TextToReader__SetHighlightTimeline(Na__Reader__ScaleTimeline(Na__Reader__AppliedPitch));
    Na__Audio.addEventListener("loadedmetadata", () => {
        Na__Audio.currentTime = Na__Position;
        if (Na__WasPlaying) Na__Audio.play().catch(() => {});
    }, { once: true });
    if (Na__OldUrl) URL.revokeObjectURL(Na__OldUrl);
}
// --------------------------------------------------------


// FUNCTION | BuildPitchControls - Slider range from the AppConfig
// --------------------------------------------------------
function Na__Reader__BuildPitchControls() {
    const Na__Range = Number(Na__Reader__Config.NaMiniApp__PitchRangePercent) || 25;
    Na__Reader__Modal.pitchSlider.min = String(-Na__Range);
    Na__Reader__Modal.pitchSlider.max = String(Na__Range);
    Na__Reader__Modal.pitchSlider.step = "1";

    // Label follows the thumb while dragging; the audio is re-pitched once, on release
    Na__Reader__Modal.pitchSlider.addEventListener("input", () =>
        Na__Reader__SetPitch(Number(Na__Reader__Modal.pitchSlider.value), false));
    Na__Reader__Modal.pitchSlider.addEventListener("change", () =>
        Na__Reader__SetPitch(Number(Na__Reader__Modal.pitchSlider.value), true));
}
// --------------------------------------------------------


// FUNCTION | StepSpeed - One tap moves the speedo to the next step, wrapping to 1.0x
// --------------------------------------------------------
function Na__Reader__StepSpeed() {
    const Na__Index = Na__Reader__SpeedSteps.indexOf(Na__Reader__Speed);
    Na__Reader__SetSpeed(Na__Reader__SpeedSteps[(Na__Index + 1) % Na__Reader__SpeedSteps.length], true);
}
// --------------------------------------------------------


// FUNCTION | InlineAnimatedIcon - Inline an animated SVG so its own CSS can move it from a data attribute
// --------------------------------------------------------
async function Na__Reader__InlineAnimatedIcon(Na__File, Na__Holder, Na__Attribute, Na__Value) {
    try {
        const Na__Response = await fetch(Na__Reader__IconBase + Na__File);
        if (!Na__Response.ok) throw new Error("HTTP " + Na__Response.status);
        const Na__Svg = new DOMParser()
            .parseFromString(await Na__Response.text(), "image/svg+xml").documentElement;
        if (Na__Svg.nodeName !== "svg") throw new Error("not an SVG");
        Na__Svg.setAttribute(Na__Attribute, Na__Value);
        Na__Holder.replaceChildren(document.importNode(Na__Svg, true));
    } catch (Na__Error) {
        console.warn(Na__File + " unavailable; the button keeps its label:", Na__Error);
    }
}
// --------------------------------------------------------


// FUNCTION | SetBusy - Disable conflicting actions during synthesis
// --------------------------------------------------------
function Na__Reader__SetBusy(Na__Busy) {
    Na__Reader__Generating = Na__Busy;
    Na__Reader__Nodes.prepare.disabled = Na__Busy;
    Na__Reader__Nodes.stop.disabled = !Na__Busy && !Na__Reader__Ready;
    Na__Reader__Nodes.pause.disabled = !Na__Reader__Ready;
    Na__Reader__RefreshTransport();
}
// --------------------------------------------------------


// FUNCTION | SetProgress - Indicate indeterminate progress or file download fraction
// --------------------------------------------------------
function Na__Reader__SetProgress(Na__Percent) {
    const Na__Bars = Na__Reader__Modal.dialog.open
        ? [Na__Reader__Modal.progress]
        : [Na__Reader__Nodes.progress];
    for (const Na__Bar of Na__Bars) {
        Na__Bar.hidden = false;
        if (Na__Percent === null) {
            Na__Bar.removeAttribute("value");
        } else {
            Na__Bar.value = Math.min(100, Math.max(0, Na__Percent));
        }
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


// FUNCTION | SyncPrepareButton - Hide Prepare once its audio is rendered; return it when the text differs
// --------------------------------------------------------
function Na__Reader__SyncPrepareButton() {
    const Na__Current = Na__Reader__Article ? Na__Reader__ExtractReadingText() : null;
    const Na__Stale = Na__Reader__Ready && Na__Reader__PreparedText !== null && Na__Current !== Na__Reader__PreparedText;
    Na__Reader__Nodes.prepare.hidden = Na__Reader__Ready && !Na__Stale;
    Na__Reader__Nodes.pause.hidden = !Na__Reader__Ready;
    if (Na__Stale && !Na__Reader__Generating) {
        Na__Reader__SetStatus("Text changed. Prepare again to hear the new text.");
    }
}

function Na__Reader__QueueSyncPrepareButton() {
    clearTimeout(Na__Reader__SyncTimer);
    Na__Reader__SyncTimer = setTimeout(() => {
        Na__TextToReader__WrapArticle(Na__Reader__Article);
        Na__Reader__SyncPrepareButton();
    }, 150);
}
// --------------------------------------------------------


// FUNCTION | UpdatePlaybackState - Reflect the actual HTML audio element state
// --------------------------------------------------------
function Na__Reader__UpdatePlaybackState() {
    const Na__Audio = Na__Reader__Nodes.audio;
    const Na__Offer = Na__Audio.paused ? "play" : "pause";
    const Na__Label = Na__Audio.paused ? "Play" : "Pause";
    Na__Reader__Nodes.pause.setAttribute("aria-label", Na__Label);
    Na__Reader__Nodes.pause.title = Na__Label;
    Na__Reader__Nodes.pause.querySelector(".NaPlayPause")?.setAttribute("data-show", Na__Offer);
    Na__Reader__Nodes.playing.hidden = Na__Audio.paused || !Na__Reader__Ready;
    // Play/Pause takes Prepare's place in the bar once audio exists
    Na__Reader__Nodes.pause.hidden = !Na__Reader__Ready;
    Na__Reader__Nodes.pause.disabled = !Na__Reader__Ready;
    Na__Reader__Nodes.stop.disabled = !Na__Reader__Generating && !Na__Reader__Ready;
    Na__Reader__RefreshTransport();
}
// --------------------------------------------------------


// FUNCTION | TransportDuration - Duration of the currently generated WAV, not the whole document
// --------------------------------------------------------
function Na__Reader__TransportDuration() {
    // Prefer the active record, since an audio.src replacement may temporarily retain
    // metadata (including duration) from the previous section.
    if (Na__Reader__SectionAudio) {
        return Na__Reader__SectionAudio.samples /
            (Na__Reader__SectionAudio.sampleRate * Na__Reader__AppliedPitch);
    }
    if (Na__Reader__Pcm && Na__Reader__SampleRate) {
        return Na__Reader__Pcm.length / (Na__Reader__SampleRate * Na__Reader__AppliedPitch);
    }
    const Na__Duration = Na__Reader__Nodes.audio.duration;
    return Number.isFinite(Na__Duration) && Na__Duration > 0 ? Na__Duration : 0;
}
// --------------------------------------------------------


// FUNCTION | TransportClock - Display time in minutes and seconds
// --------------------------------------------------------
function Na__Reader__TransportClock(Na__Seconds) {
    const Na__Time = Math.floor(Math.max(0, Number.isFinite(Na__Seconds) ? Na__Seconds : 0));
    return Math.floor(Na__Time / 60) + ":" + String(Na__Time % 60).padStart(2, "0");
}
// --------------------------------------------------------


// FUNCTION | RefreshTransport - Keep section, seek bar and button states in sync
// --------------------------------------------------------
function Na__Reader__RefreshTransport() {
    const Na__Ui = Na__Reader__Transport;
    if (!Na__Ui.bar) return;
    const Na__Run = Na__Reader__Run;
    const Na__Active = document.body.dataset.ttrMode === "read" &&
        Boolean(Na__Reader__Article?.textContent.trim()) &&
        (Na__Reader__Generating || Na__Reader__Ready || Boolean(Na__Run));
    Na__Ui.bar.hidden = !Na__Active;
    if (!Na__Active) return;

    const Na__Audio = Na__Reader__Nodes.audio;
    const Na__Duration = Na__Reader__Ready ? Na__Reader__TransportDuration() : 0;
    const Na__Playable = Na__Reader__Ready && Na__Duration > 0 &&
        (!Na__Run || (Na__Run.current >= 0 && Na__Run.waitingFor < 0));
    const Na__Time = Na__Playable ? Math.max(0, Math.min(Na__Duration, Na__Audio.currentTime || 0)) : 0;

    Na__Ui.previous.disabled = !Na__Playable;
    Na__Ui.backward.disabled = !Na__Playable;
    Na__Ui.forward.disabled  = !Na__Playable;
    Na__Ui.next.disabled     = !Na__Playable;
    Na__Ui.seek.disabled     = !Na__Playable;
    if (Na__Run) {
        // Counted in sentences: sections are re-cut as reading goes, so their number changes
        const Na__Index = Na__Run.waitingFor >= 0 ? Na__Run.waitingFor : Na__Run.current;
        const Na__Section = Na__Run.sections[Na__Index];
        Na__Ui.section.textContent = Na__Section
            ? "Sentences " + Na__Reader__SentenceSpan(Na__Section) + "/" + Na__Run.plan.length
            : "Preparing…";
    } else {
        Na__Ui.section.textContent = Na__Playable ? "Document" : "Preparing…";
    }
    Na__Ui.seek.setAttribute("aria-label", "Seek within " + Na__Ui.section.textContent.toLowerCase());
    if (!Na__Reader__TransportDragging) {
        Na__Ui.seek.value = Na__Playable ? String(Math.round(1000 * Na__Time / Na__Duration)) : "0";
        Na__Ui.elapsed.textContent = Na__Reader__TransportClock(Na__Time);
    }
    Na__Ui.duration.textContent = Na__Reader__TransportClock(Na__Duration);
}
// --------------------------------------------------------


// FUNCTION | SeekRelative - Skip ten seconds, crossing cached sections where possible
// --------------------------------------------------------
function Na__Reader__SeekRelative(Na__Seconds) {
    const Na__Run = Na__Reader__Run;
    const Na__Audio = Na__Reader__Nodes.audio;
    if (!Na__Reader__Ready || (Na__Run && (Na__Run.current < 0 || Na__Run.waitingFor >= 0))) return;
    const Na__Duration = Na__Reader__TransportDuration();
    if (!Na__Duration) return;

    let Na__Offset = (Na__Audio.currentTime || 0) + Na__Seconds;
    if (!Na__Run) {
        Na__Audio.currentTime = Math.max(0, Math.min(Na__Duration, Na__Offset));
        Na__Reader__RefreshTransport();
        return;
    }

    let Na__Index = Na__Run.current;
    for (let Na__Guard = 0; Na__Guard < Na__Run.sections.length + 1; Na__Guard++) {
        const Na__Record = Na__TextToReader__SectionCacheGet(Na__Run.keys[Na__Index]);
        const Na__Length = Na__Index === Na__Run.current ? Na__Duration :
            (Na__Record ? Na__Record.samples / (Na__Record.sampleRate * Na__Reader__AppliedPitch) : 0);

        if (Na__Offset < 0) {
            if (Na__Index === 0) {
                if (Na__Index === Na__Run.current) Na__Audio.currentTime = 0;
                else Na__Reader__GoToSection(Na__Run, 0, null, 0);
                return;
            }
            Na__Index--;
            const Na__Previous = Na__TextToReader__SectionCacheGet(Na__Run.keys[Na__Index]);
            if (!Na__Previous) {
                const Na__Last = Na__Run.sections[Na__Index].sentences.at(-1)?.words[0] || null;
                Na__Reader__GoToSection(Na__Run, Na__Index, Na__Last);
                return;
            }
            Na__Offset += Na__Previous.samples / (Na__Previous.sampleRate * Na__Reader__AppliedPitch);
            continue;
        }

        if (Na__Length > 0 && Na__Offset >= Na__Length) {
            if (Na__Index === Na__Run.sections.length - 1) {
                const Na__End = Math.max(0, Na__Length - 0.05);
                if (Na__Index === Na__Run.current) Na__Audio.currentTime = Na__End;
                else Na__Reader__GoToSection(Na__Run, Na__Index, null, Na__End);
                return;
            }
            Na__Offset -= Na__Length;
            Na__Index++;
            if (!Na__TextToReader__SectionCacheHas(Na__Run.keys[Na__Index])) {
                Na__Reader__GoToSection(Na__Run, Na__Index, null, Na__Offset);
                return;
            }
            continue;
        }

        if (Na__Index === Na__Run.current) Na__Audio.currentTime = Na__Offset;
        else Na__Reader__GoToSection(Na__Run, Na__Index, null, Na__Offset);
        break;
    }
    Na__Reader__RefreshTransport();
}
// --------------------------------------------------------


// FUNCTION | NavigateSentence - Previous/next sentence within or across sections
// --------------------------------------------------------
function Na__Reader__NavigateSentence(Na__Direction) {
    const Na__Run = Na__Reader__Run;
    if (!Na__Reader__Ready || (Na__Run && Na__Run.waitingFor >= 0)) return;
    const Na__Audio = Na__Reader__Nodes.audio;
    const Na__Timeline = Na__Reader__ScaleTimeline(Na__Reader__AppliedPitch) || [];
    if (!Na__Timeline.length) return;

    const Na__Time = Na__Audio.currentTime || 0;
    let Na__Current = Na__Timeline.findIndex((Na__Sentence) => Na__Time < Na__Sentence.end - 0.015);
    if (Na__Current < 0) Na__Current = Na__Timeline.length - 1;
    const Na__Target = Na__Direction < 0
        ? (Na__Time > Na__Timeline[Na__Current].start + 1.5 ? Na__Current : Na__Current - 1)
        : Na__Current + 1;

    if (Na__Target >= 0 && Na__Target < Na__Timeline.length) {
        Na__Audio.currentTime = Na__Timeline[Na__Target].start;
        Na__Audio.play().catch(() => Na__Reader__SetStatus("Tap Play to continue."));
    } else if (Na__Run && Na__Direction > 0 && Na__Run.current + 1 < Na__Run.sections.length) {
        Na__Reader__GoToSection(Na__Run, Na__Run.current + 1, null);
    } else if (Na__Run && Na__Direction < 0 && Na__Run.current > 0) {
        const Na__PreviousSection = Na__Run.sections[Na__Run.current - 1];
        const Na__LastWord = Na__PreviousSection.sentences.at(-1)?.words[0] || null;
        Na__Reader__GoToSection(Na__Run, Na__Run.current - 1, Na__LastWord);
    } else if (Na__Direction < 0) {
        Na__Audio.currentTime = 0;
    }
    Na__Reader__RefreshTransport();
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------


// REGION | Speech Engine
// --------------------------------------------------------

// FUNCTION | Models - The voices the AppConfig offers
// --------------------------------------------------------
function Na__Reader__Models() {
    return Na__Reader__Config.NaMiniApp__Models || [];
}

function Na__Reader__FindModel(Na__Id) {
    return Na__Reader__Models().find((Na__Model) => Na__Model.NaMiniApp__ModelId === Na__Id) || null;
}
// --------------------------------------------------------


// FUNCTION | SelectedModel - The remembered voice, or the AppConfig default
// --------------------------------------------------------
function Na__Reader__SelectedModel() {
    const Na__Stored = Na__TextToReader__GetUserSetting(Na__Reader__UserSection, "NaUserConfig__VoiceModelId");
    return Na__Reader__FindModel(Na__Stored) ||
        Na__Reader__FindModel(Na__Reader__Config.NaMiniApp__DefaultModelId) ||
        Na__Reader__Models()[0];
}
// --------------------------------------------------------


// FUNCTION | DescribeEngine - Where generation runs, for the voice tooltip and status line
// --------------------------------------------------------
function Na__Reader__DescribeEngine(Na__Engine) {
    if (!Na__Engine) return "";
    if (Na__Engine.device === "webgpu") return "the graphics card";
    return Na__Engine.threads + (Na__Engine.threads === 1 ? " CPU thread" : " CPU threads");
}
// --------------------------------------------------------


// FUNCTION | UpdateModelButton - Show the current voice on the toolbar's voice button
// --------------------------------------------------------
function Na__Reader__UpdateModelButton() {
    const Na__Model = Na__Reader__SelectedModel();
    const Na__Button = Na__Reader__Nodes.model;
    if (!Na__Button || !Na__Model) return;
    const Na__Loaded = Na__Reader__EngineModelId === Na__Model.NaMiniApp__ModelId
        ? " · " + Na__Reader__DescribeEngine(Na__Reader__Engine)
        : "";
    const Na__Label = "Voice: " + Na__Model.NaMiniApp__Label + " (" + Na__Model.NaMiniApp__Note + Na__Loaded + ")";
    Na__Button.title = Na__Label;
    Na__Button.setAttribute("aria-label", Na__Label + ". Tap to change.");
    if ("mediaSession" in navigator && navigator.mediaSession.metadata) {
        navigator.mediaSession.metadata.artist = Na__Model.NaMiniApp__Label;
    }
}
// --------------------------------------------------------


// FUNCTION | SelectModel - Switch voice: drop rendered audio and the loaded engine
// --------------------------------------------------------
function Na__Reader__SelectModel(Na__Id) {
    if (!Na__Reader__FindModel(Na__Id)) return;
    const Na__Previous = Na__Reader__SelectedModel()?.NaMiniApp__ModelId;
    Na__TextToReader__SetUserSetting(Na__Reader__UserSection, "NaUserConfig__VoiceModelId", Na__Id);
    // Kept sections are in the old voice; they could never be reused, so free them now
    if (Na__Previous !== Na__Id) Na__TextToReader__SectionCacheClear();
    if (Na__Reader__EngineModelId !== Na__Id) {
        Na__TextToReader__StopReadAloud();
        Na__Reader__Engine?.dispose();
        Na__Reader__Engine = null;
        Na__Reader__EngineModelId = null;
    }
    Na__Reader__UpdateModelButton();
}
// --------------------------------------------------------


// FUNCTION | LoadEngine - Load the selected voice's engine from the files on this device
// --------------------------------------------------------
async function Na__Reader__LoadEngine() {
    const Na__Model = Na__Reader__SelectedModel();
    if (Na__Reader__Engine && Na__Reader__EngineModelId === Na__Model.NaMiniApp__ModelId) return Na__Reader__Engine;
    if (Na__Reader__LoadPromise) return Na__Reader__LoadPromise;

    Na__Reader__LoadPromise = (async () => {
        Na__Reader__Engine?.dispose();
        Na__Reader__Engine = null;
        Na__Reader__EngineModelId = null;
        Na__Reader__SetStatus("Loading " + Na__Model.NaMiniApp__Label + "…");
        Na__Reader__SetProgress(null);

        const Na__LogDone = Na__TextToReader__LogTimer("Loading " + Na__Model.NaMiniApp__Label);
        let Na__Engine;
        try {
            Na__Engine = await Na__TextToReader__LoadEngine(Na__Model, Na__Reader__Config);
        } catch (Na__Error) {
            Na__LogDone.fail(Na__Error);
            throw Na__Error;
        }
        Na__LogDone(Na__Model.NaMiniApp__Label + " ready on " + Na__Reader__DescribeEngine(Na__Engine) +
            " (" + Na__Engine.threadsReason + ")");
        Na__Reader__Engine = Na__Engine;
        Na__Reader__EngineModelId = Na__Model.NaMiniApp__ModelId;
        Na__Reader__UpdateModelButton();
        console.info("Read aloud: " + Na__Model.NaMiniApp__Label + " on " +
            Na__Reader__DescribeEngine(Na__Engine) + " (" + Na__Engine.threadsReason + ").");
        Na__Reader__Nodes.progress.hidden = true;
        Na__Reader__SetStatus("");
        return Na__Engine;
    })();

    try {
        return await Na__Reader__LoadPromise;

    } finally {
        Na__Reader__LoadPromise = null;
    }
}
// --------------------------------------------------------


// FUNCTION | WholeText - The article's text, selection or not
// --------------------------------------------------------
function Na__Reader__WholeText() {
    return (Na__Reader__Article.innerText || Na__Reader__Article.textContent || "").trim();
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
    return Na__Reader__WholeText();
}
// --------------------------------------------------------


// FUNCTION | RegisterOfflineWorker - Scope the worker to its containing app directory
// --------------------------------------------------------
function Na__Reader__RegisterOfflineWorker() {
    const Na__ScriptUrl = new URL("../MiniApp__TextToReader__ServiceWorker__.js", import.meta.url);
    const Na__ScopeUrl = new URL("./", Na__ScriptUrl);
    return navigator.serviceWorker.register(Na__ScriptUrl.href, {
        scope          : Na__ScopeUrl.href,
        updateViaCache : "none"
    });
}
// --------------------------------------------------------


// FUNCTION | EnsureCrossOriginIsolation - Reload once so the service worker's isolation headers apply
// --------------------------------------------------------
// Both engines generate on several threads only on a cross-origin isolated page. The
// service worker adds the two headers that make it so, but only to pages it serves:
// the first visit (and a hard reload) bypasses it. Then the page reloads once, after
// the worker takes control. One attempt per tab, so a browser that will not isolate
// still reads aloud, on one thread.
async function Na__Reader__EnsureCrossOriginIsolation() {
    const Na__Registration = await Na__Reader__RegisterOfflineWorker();
    if (window.crossOriginIsolated) return;

    const Na__Flag = "NaTextToReader__IsolationReload";
    try {
        if (sessionStorage.getItem(Na__Flag)) return;
    } catch {
        return;
    }
    const Na__Reload = () => {
        sessionStorage.setItem(Na__Flag, "1");
        location.reload();
    };

    await Na__Registration.update().catch(() => {});
    if (Na__Registration.installing || Na__Registration.waiting || !navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener("controllerchange", Na__Reload, { once: true });
        return;
    }
    Na__Reload();
}
// --------------------------------------------------------


// FUNCTION | IsInstalled - Every file of a voice is on this device (remembered once true)
// --------------------------------------------------------
async function Na__Reader__IsInstalled(Na__Model) {
    if (Na__Reader__InstalledIds.has(Na__Model.NaMiniApp__ModelId)) return true;
    const Na__Installed = await Na__TextToReader__IsModelInstalled(Na__Model, Na__Reader__Config);
    if (Na__Installed) Na__Reader__InstalledIds.add(Na__Model.NaMiniApp__ModelId);
    return Na__Installed;
}
// --------------------------------------------------------


// FUNCTION | FormatMegabytes - Download sizes as whole MB, or KB under one MB
// --------------------------------------------------------
function Na__Reader__FormatMegabytes(Na__Bytes) {
    const Na__Mb = Na__Bytes / (1024 * 1024);
    return Na__Mb >= 1 ? Math.round(Na__Mb) + " MB" : Math.max(1, Math.round(Na__Bytes / 1024)) + " KB";
}
// --------------------------------------------------------


// FUNCTION | InstallOffline - Download the chosen voice from the CDN into browser storage
// --------------------------------------------------------
async function Na__Reader__InstallOffline(Na__Model) {
    if (Na__Reader__Installing) return false;
    Na__Reader__Installing = true;
    Na__Reader__Modal.download.disabled = true;
    Na__Reader__Modal.later.disabled = true;
    try {
        Na__Reader__SetStatus("Downloading " + Na__Model.NaMiniApp__Label + "…");
        Na__Reader__SetProgress(null);
        Na__Reader__InstallLog = Na__TextToReader__LogTimer("Downloading " + Na__Model.NaMiniApp__Label);
        await Na__TextToReader__InstallModel(Na__Model, Na__Reader__Config, (Na__Info) => {
            Na__Reader__SetStatus("Downloading " + Na__Model.NaMiniApp__Label + ": " +
                Na__Reader__FormatMegabytes(Na__Info.loaded) + " of " + Na__Reader__FormatMegabytes(Na__Info.total));
            Na__Reader__SetProgress(100 * Na__Info.loaded / Na__Info.total);
        });
        Na__Reader__InstalledIds.add(Na__Model.NaMiniApp__ModelId);
        Na__Reader__InstallLog(Na__Model.NaMiniApp__Label + " downloaded and kept for offline use");
        Na__Reader__SetStatus("");
        return true;

    } catch (Na__Error) {
        Na__Reader__InstallLog?.fail(Na__Error);
        Na__Reader__SetStatus("Download incomplete: " + Na__Error.message);
        Na__Reader__Modal.download.textContent = "Try again";
        return false;

    } finally {
        Na__Reader__Installing = false;
        Na__Reader__Modal.download.disabled = false;
        Na__Reader__Modal.later.disabled = false;
        Na__Reader__Nodes.progress.hidden = true;
        Na__Reader__Modal.progress.hidden = true;
    }
}
// --------------------------------------------------------


// FUNCTION | CloseModal - Dismiss the voice modal
// --------------------------------------------------------
function Na__Reader__CloseModal() {
    if (Na__Reader__Modal.dialog.open) Na__Reader__Modal.dialog.close();
}
// --------------------------------------------------------


// FUNCTION | UpdateModalAction - The main button downloads a missing voice or switches to an installed one
// --------------------------------------------------------
async function Na__Reader__UpdateModalAction() {
    const Na__Model = Na__Reader__FindModel(Na__Reader__ModalChoice);
    if (!Na__Model) return;
    const Na__Installed = await Na__Reader__IsInstalled(Na__Model);
    Na__Reader__Modal.download.textContent = Na__Installed ? "Use this voice" : "Download voice";
    Na__Reader__Modal.download.classList.toggle("TTR__icon-download", !Na__Installed);
}
// --------------------------------------------------------


// FUNCTION | BuildModalChoices - One radio per voice, with its engine and what it would download
// --------------------------------------------------------
function Na__Reader__BuildModalChoices() {
    const Na__List = Na__Reader__Modal.choices;
    if (!Na__List) return;
    Na__List.replaceChildren();

    for (const Na__Model of Na__Reader__Models()) {
        const Na__Id = Na__Model.NaMiniApp__ModelId;
        const Na__Row = document.createElement("label");
        Na__Row.className = "TTR__voice-choice";

        const Na__Radio = document.createElement("input");
        Na__Radio.type = "radio";
        Na__Radio.name = "js__voiceChoice";
        Na__Radio.value = Na__Id;
        Na__Radio.checked = Na__Id === Na__Reader__ModalChoice;
        Na__Radio.addEventListener("change", () => {
            Na__Reader__ModalChoice = Na__Id;
            Na__Reader__Modal.status.textContent = "";
            Na__Reader__UpdateModalAction();
        });

        const Na__Name = document.createElement("span");
        Na__Name.className = "TTR__voice-choice-name";
        Na__Name.textContent = Na__Model.NaMiniApp__Label;

        const Na__Note = document.createElement("span");
        Na__Note.className = "TTR__voice-choice-note";
        Na__Note.textContent = Na__Model.NaMiniApp__Note;

        const Na__State = document.createElement("span");
        Na__State.className = "TTR__voice-choice-state";
        Na__State.textContent = "…";

        Na__Row.append(Na__Radio, Na__Name, Na__Note, Na__State);
        Na__List.append(Na__Row);

        Na__Reader__IsInstalled(Na__Model).then(async (Na__Installed) => {
            if (Na__Installed) {
                Na__State.textContent = "On this device";
                return;
            }
            const Na__Bytes = await Na__TextToReader__MissingDownloadBytes(Na__Model, Na__Reader__Config);
            Na__State.textContent = Na__Bytes === null
                ? "About " + Na__Model.NaMiniApp__DownloadMb + " MB"
                : Na__Reader__FormatMegabytes(Na__Bytes);
        });
    }
}
// --------------------------------------------------------


// FUNCTION | OpenVoiceModal - Choose a voice; forced while the selected one is not downloaded
// --------------------------------------------------------
function Na__Reader__OpenVoiceModal(Na__Forced) {
    if (Na__Reader__Modal.dialog.open) return;
    Na__Reader__ModalForced = Na__Forced;
    Na__Reader__ModalChoice = Na__Reader__SelectedModel().NaMiniApp__ModelId;
    Na__Reader__Modal.status.textContent = "";
    Na__Reader__Modal.progress.hidden = true;
    Na__Reader__Modal.later.textContent = Na__Forced ? "Not now" : "Close";
    Na__Reader__BuildModalChoices();
    Na__Reader__UpdateModalAction();
    Na__Reader__Modal.dialog.showModal();
}
// --------------------------------------------------------


// FUNCTION | ConfirmModalChoice - Download the chosen voice if needed, then switch to it
// --------------------------------------------------------
async function Na__Reader__ConfirmModalChoice() {
    const Na__Model = Na__Reader__FindModel(Na__Reader__ModalChoice);
    if (!Na__Model) return;
    if (!await Na__Reader__IsInstalled(Na__Model) && !await Na__Reader__InstallOffline(Na__Model)) return;
    const Na__Resume = Na__Reader__AutoStartPending;
    const Na__Queued = Na__Reader__QueuedRequest;
    Na__Reader__SelectModel(Na__Model.NaMiniApp__ModelId);
    Na__Reader__CloseModal();
    if (Na__Resume) {
        Na__Reader__QueuedRequest = Na__Queued;
        Na__TextToReader__StartLoadedText();
    }
}
// --------------------------------------------------------


// FUNCTION | EnsureVoiceInstalled - Prompt only when the selected voice's files are not in browser storage
// --------------------------------------------------------
async function Na__Reader__EnsureVoiceInstalled() {
    if (Na__Reader__Modal.dialog.open) return false;
    if (await Na__Reader__IsInstalled(Na__Reader__SelectedModel())) return true;
    if (Na__Reader__Nodes.panel.hidden || Na__Reader__Modal.dialog.open) return false;
    // Another modal (the launch text source) goes first; ask once it closes
    const Na__OtherDialog = document.querySelector("dialog[open]");
    if (Na__OtherDialog) {
        Na__OtherDialog.addEventListener("close", Na__Reader__EnsureVoiceInstalled, { once: true });
        return false;
    }
    Na__Reader__OpenVoiceModal(true);
    return false;
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
    Na__Reader__Pcm = null;
    Na__Reader__SectionAudio = null;
    Na__Reader__EncodeWav = null;
    Na__Reader__BaseTimeline = null;
    Na__Reader__AppliedPitch = 1;
    Na__Reader__Ready = false;
    Na__Reader__PreparedText = null;
    Na__Reader__Nodes.prepare.hidden = false;
    Na__TextToReader__SetHighlightTimeline(null);
    Na__Reader__UpdatePlaybackState();
}
// --------------------------------------------------------


// FUNCTION | StopReadAloud - Cancel inference and playback without touching article DOM
// --------------------------------------------------------
// A sectioned run ends too, but the sections it rendered stay kept: reading the same text
// again in the same voice starts at once.
export function Na__TextToReader__StopReadAloud() {
    Na__Reader__GenerationId++;
    Na__Reader__AutoStartPending = false;
    Na__Reader__QueuedRequest = null;
    if (Na__Reader__Run) {
        Na__Reader__Run.dead = true;
        Na__Reader__Run = null;
    }
    Na__Reader__Controller?.abort();
    Na__Reader__Controller = null;
    Na__Reader__SetBusy(false);
    Na__Reader__ReleaseAudio();
    Na__Reader__Nodes.progress.hidden = true;
}
// --------------------------------------------------------


// FUNCTION | SynthesiseSentences - Render sentences one at a time into one PCM buffer, timing each
// --------------------------------------------------------
// One request per sentence gives each sentence an exact start for the highlight. Na__IsLive is
// asked between chunks; once it answers false the render is dropped and this resolves null.
// Na__OnProgress(samplesSoFar, sentenceIndex) is told after every chunk.
async function Na__Reader__SynthesiseSentences(Na__Tts, Na__Sentences, Na__Signal, Na__IsLive, Na__OnProgress) {
    const Na__Chunks = [];
    const Na__Timeline = [];
    let Na__Samples = 0;

    for (const [Na__Index, Na__Sentence] of Na__Sentences.entries()) {
        const Na__SentenceStart = Na__Samples;
        const Na__SentenceChunks = [];
        const Na__Speech = Na__Tts.stream(Na__Sentence.text, { signal: Na__Signal });

        for await (const Na__Pcm of Na__Speech) {
            if (!Na__IsLive()) {
                Na__Speech.cancel();
                await Na__Speech.done.catch(() => {});
                return null;
            }
            Na__Chunks.push(Na__Pcm);
            Na__SentenceChunks.push(Na__Pcm);
            Na__Samples += Na__Pcm.length;
            Na__OnProgress(Na__Samples, Na__Index);
        }
        await Na__Speech.done;
        if (!Na__IsLive()) return null;

        Na__Timeline.push(Na__TextToReader__TimeSentence(Na__Sentence,
            Na__Tts.concatPcm(Na__SentenceChunks), Na__SentenceStart, Na__Tts.sampleRate));
    }

    return { pcm: Na__Tts.concatPcm(Na__Chunks), samples: Na__Samples, timeline: Na__Timeline };
}
// --------------------------------------------------------


// FUNCTION | PrepareAudio - Render the selection or article sentence by sentence into one gap-free WAV
// --------------------------------------------------------
async function Na__Reader__PrepareAudio() {
    if (Na__Reader__SectionMode) {
        await Na__Reader__PrepareSections(null);
        return;
    }

    const Na__Plan = Na__TextToReader__BuildReadingPlan(Na__Reader__Article);
    const Na__Text = Na__Reader__ExtractReadingText();
    if (!Na__Plan.length) {
        Na__Reader__SetStatus("No article text to read.");
        return;
    }
    if (Na__Text.length > Na__Reader__Config.NaMiniApp__MaxCharacters) {
        Na__Reader__SetStatus("This selection exceeds " +
            Na__Reader__Config.NaMiniApp__MaxCharacters.toLocaleString() +
            " characters. Select a shorter passage to limit mobile memory usage.");
        return;
    }

    Na__Reader__AutoStartPending = true;
    const Na__RequestedGeneration = Na__Reader__GenerationId;
    Na__Reader__SetBusy(true);
    Na__Reader__Nodes.stop.disabled = false;
    Na__Reader__SetStatus("Preparing speech…");
    Na__Reader__SetProgress(null);

    const Na__VoiceReady = await Na__Reader__EnsureVoiceInstalled();
    if (Na__RequestedGeneration !== Na__Reader__GenerationId) return;
    if (!Na__VoiceReady) {
        Na__Reader__SetBusy(false);
        Na__Reader__Nodes.progress.hidden = true;
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
    const Na__PrepareLog = Na__TextToReader__LogTimer("Preparing speech (" + Na__Text.length.toLocaleString() + " characters)");

    try {
        const Na__Tts = await Na__Reader__LoadEngine();
        if (Na__JobId !== Na__Reader__GenerationId) return;

        let Na__NextUpdate = Na__Tts.sampleRate * 2;
        const Na__Start = performance.now();

        const Na__Rendered = await Na__Reader__SynthesiseSentences(Na__Tts, Na__Plan, Na__Controller.signal,
            () => Na__JobId === Na__Reader__GenerationId,
            (Na__Done, Na__Index) => {
                if (Na__Done < Na__NextUpdate) return;
                Na__Reader__SetStatus("Generated " +
                    Na__Reader__FormatSeconds(Na__Done / Na__Tts.sampleRate) +
                    " of speech in " + ((performance.now() - Na__Start) / 1000).toFixed(1) +
                    " s (sentence " + (Na__Index + 1) + " of " + Na__Plan.length + ").");
                Na__NextUpdate += Na__Tts.sampleRate * 2;
            });
        if (!Na__Rendered) return;

        const { pcm: Na__Pcm, samples: Na__Samples, timeline: Na__Timeline } = Na__Rendered;
        Na__Reader__Pcm = Na__Pcm;
        Na__Reader__SampleRate = Na__Tts.sampleRate;
        Na__Reader__EncodeWav = Na__Tts.encodeWav;
        Na__Reader__BaseTimeline = Na__Timeline;
        const Na__Pitched = Na__Reader__EncodePitched(1 + Na__Reader__PitchPercent / 100);
        Na__Reader__AppliedPitch = Na__Pitched.effective;
        Na__Reader__AudioUrl = Na__Pitched.url;
        Na__Reader__Nodes.audio.src = Na__Reader__AudioUrl;
        Na__Reader__ApplyPlaybackRate();
        Na__Reader__Ready = true;
        Na__Reader__PreparedText = Na__Text;
        Na__TextToReader__SetHighlightTimeline(Na__Reader__ScaleTimeline(Na__Reader__AppliedPitch));
        Na__Reader__Nodes.prepare.hidden = true;
        Na__Reader__SetBusy(false);
        Na__Reader__Nodes.progress.hidden = true;
        Na__Reader__SetStatus("Prepared " +
            Na__Reader__FormatSeconds(Na__Samples / Na__Tts.sampleRate) +
            " of audio in " + ((performance.now() - Na__Start) / 1000).toFixed(1) +
            " s on " + Na__Reader__DescribeEngine(Na__Tts) + ".");
        Na__PrepareLog("Prepared " + Na__Reader__FormatSeconds(Na__Samples / Na__Tts.sampleRate) +
            " of audio with " + Na__Reader__SelectedModel().NaMiniApp__Label + " on " +
            Na__Reader__DescribeEngine(Na__Tts) + " (" + Na__Plan.length + " sentences)");

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
            if (Na__Controller.signal.aborted) {
                Na__TextToReader__Log("warn", "Preparation cancelled");
            } else {
                Na__PrepareLog.fail(Na__Error);
            }
            Na__Reader__SetBusy(false);
            Na__Reader__Nodes.progress.hidden = true;
        }

    } finally {
        if (Na__Reader__Controller === Na__Controller) Na__Reader__Controller = null;
    }
}
// --------------------------------------------------------


// endregion -------------------------------------------------------------------


// REGION | Sectioned Reading
// --------------------------------------------------------
// A long document is read a section at a time. The opening section is short
// (AppConfig NaMiniApp__FirstSectionSentences, 2) so reading starts soon. The section the
// listener reaches next is cut, just before it renders, to the most sentences this device
// can render before the playhead gets there (up to NaMiniApp__SectionSentences, 10); others
// are cut at NaMiniApp__IntermediateSectionSentences (4). Rendering runs ahead of the one
// being heard until NaMiniApp__SectionRunwaySeconds of audio is ready, then outwards from it
// (order, cutting, cache and memory budget: Sections__.js). Only one section is on the audio
// element: when it ends the next is loaded, or waited for.
//
// Sections are re-cut while reading, so their count and indices change: anything held across
// an await keeps the section object, never its index. Status lines count sentences.
//
// Run = { plan, modelId, sizes, timing, sections, keys, sectionOf, positionOf, controller, tts,
//         anchor, current, waitingFor, pendingWord, pendingSeconds, rendering, epoch, pumping,
//         dead, finished, failed, completeLogged, largeLogged, behindLogged, startedAt, firstLog }
//   plan        every sentence of the document, in reading order
//   sizes       { first, medium, large } sentences per section (SectionSizes)
//   timing      this device's measured rendering speed and audio rate (Sections__.js RecordRenderTiming)
//   positionOf  a sentence id to its plan position
//   current     the section on the audio element, -1 until the first one plays
//   waitingFor  the section the listener needs that is not rendered yet, else -1
//   anchor      what rendering centres on: the section being heard or waited for
//   pendingWord the word to start from once waitingFor arrives (a jump), else null
//   rendering   the section being rendered, else -1; it is never re-cut
//   epoch       bumped to drop the render in progress when another must come first

// FUNCTION | SectionSizes - Sentences per section: the opener, the steady size and the most
// --------------------------------------------------------
function Na__Reader__SectionSizes() {
    const Na__Large  = Math.max(1, Number(Na__Reader__Config.NaMiniApp__SectionSentences) || 10);
    const Na__Medium = Math.min(Na__Large, Math.max(1, Number(Na__Reader__Config.NaMiniApp__IntermediateSectionSentences) || 4));
    const Na__First  = Math.min(Na__Large, Math.max(1, Number(Na__Reader__Config.NaMiniApp__FirstSectionSentences) || 2));
    return { first: Na__First, medium: Na__Medium, large: Na__Large };
}
// --------------------------------------------------------


// FUNCTION | RunwaySeconds - Audio to have ready ahead of the playhead before rendering behind it
// --------------------------------------------------------
function Na__Reader__RunwaySeconds() {
    return Math.max(0, Number(Na__Reader__Config.NaMiniApp__SectionRunwaySeconds) || 60);
}
// --------------------------------------------------------


// FUNCTION | SentenceSpan - "11–14" (or "5"): a section's sentences, counted from 1
// --------------------------------------------------------
function Na__Reader__SentenceSpan(Na__Section) {
    const Na__First = Na__Section.first + 1;
    const Na__Last = Na__Section.first + Na__Section.sentences.length;
    return Na__First === Na__Last ? String(Na__First) : Na__First + "–" + Na__Last;
}
// --------------------------------------------------------


// FUNCTION | DescribeSection - "sentences 11–14 of 140", for the status line and the log
// --------------------------------------------------------
function Na__Reader__DescribeSection(Na__Run, Na__Index) {
    const Na__Section = Na__Run.sections[Na__Index];
    const Na__Total = Na__Run.plan.length;
    if (!Na__Section) return Na__Total + " sentences";
    return (Na__Section.sentences.length === 1 ? "sentence " : "sentences ") +
        Na__Reader__SentenceSpan(Na__Section) + " of " + Na__Total;
}
// --------------------------------------------------------


// FUNCTION | ReadySentences - How many of the run's sentences are rendered
// --------------------------------------------------------
function Na__Reader__ReadySentences(Na__Run) {
    let Na__Ready = 0;
    Na__Run.sections.forEach((Na__Section, Na__Index) => {
        if (Na__TextToReader__SectionCacheHas(Na__Run.keys[Na__Index])) Na__Ready += Na__Section.sentences.length;
    });
    return Na__Ready;
}
// --------------------------------------------------------


// FUNCTION | ReportSections - Say where the reading is and how much is rendered
// --------------------------------------------------------
function Na__Reader__ReportSections(Na__Run) {
    if (Na__Run.dead) return;
    const Na__Total = Na__Run.plan.length;
    const Na__Ready = Na__Reader__ReadySentences(Na__Run);

    let Na__Message;
    if (Na__Run.waitingFor >= 0) {
        Na__Message = "Preparing " + Na__Reader__DescribeSection(Na__Run, Na__Run.waitingFor) + "…";
    } else if (Na__Run.failed) {
        Na__Message = "Could not prepare every sentence: " + Na__Run.failed;
    } else if (Na__Run.finished) {
        Na__Message = "Finished the last sentence. Press Play to read from the start.";
    } else {
        Na__Message = "Reading " + Na__Reader__DescribeSection(Na__Run, Na__Run.current) + ". " +
            (Na__Ready === Na__Total ? "All sentences prepared." : Na__Ready + " of " + Na__Total + " sentences prepared.");
    }
    Na__Reader__SetStatus(Na__Message);

    // The bar (which also keeps the message on screen) is for someone waiting on a section. Background
    // rendering of the others is silent, so the message fades and never sits over the text on a phone.
    if (Na__Run.waitingFor >= 0) Na__Reader__SetProgress(100 * Na__Ready / Na__Total);
    else Na__Reader__Nodes.progress.hidden = true;
    Na__Reader__RefreshTransport();
}
// --------------------------------------------------------


// FUNCTION | SectionBudgetBytes - Rendered audio kept before the farthest sections are let go
// --------------------------------------------------------
function Na__Reader__SectionBudgetBytes() {
    return (Number(Na__Reader__Config.NaMiniApp__SectionCacheMegabytes) || 400) * 1024 * 1024;
}
// --------------------------------------------------------


// FUNCTION | RenderSection - Render one section to its kept form; null if it was dropped part way
// --------------------------------------------------------
// Returns { section, record, seconds }: the section object (its index may have changed by
// then, as sections around it can be re-cut), the record to keep, and the wall-clock seconds
// the render took, which is what the sizing learns from.
async function Na__Reader__RenderSection(Na__Run, Na__Index) {
    const Na__Section = Na__Run.sections[Na__Index];
    const Na__Key = Na__Run.keys[Na__Index];
    const Na__Epoch = Na__Run.epoch;
    const Na__Tts = Na__Run.tts;
    const Na__Start = performance.now();
    let Na__NextUpdate = Na__Tts.sampleRate * 2;

    const Na__Rendered = await Na__Reader__SynthesiseSentences(Na__Tts, Na__Section.sentences, Na__Run.controller.signal,
        () => !Na__Run.dead && Na__Run.epoch === Na__Epoch,
        (Na__Done, Na__Sentence) => {
            // Only a listener waiting on this section needs a running commentary
            if (Na__Run.sections[Na__Run.waitingFor] !== Na__Section || Na__Done < Na__NextUpdate) return;
            Na__Reader__SetStatus("Preparing " + Na__Reader__DescribeSection(Na__Run, Na__Section.index) + ": " +
                Na__Reader__FormatSeconds(Na__Done / Na__Tts.sampleRate) + " of speech in " +
                ((performance.now() - Na__Start) / 1000).toFixed(1) + " s (sentence " + (Na__Sentence + 1) +
                " of " + Na__Section.sentences.length + ").");
            Na__NextUpdate += Na__Tts.sampleRate * 2;
        });
    if (!Na__Rendered) return null;
    return {
        section : Na__Section,
        record  : Na__TextToReader__PackSection(Na__Key, Na__Rendered.pcm, Na__Tts.sampleRate, Na__Rendered.timeline),
        seconds : (performance.now() - Na__Start) / 1000
    };
}
// --------------------------------------------------------


// FUNCTION | BufferedPlaySeconds - Rendered audio ahead of the playhead, in listening seconds
// --------------------------------------------------------
// The rest of the section being heard plus every rendered section straight after it, stopping
// at the first gap. The audio element's time is converted back to the voice's own time (the
// pitch factor), then to the listener's (the reading speed). 0 while nothing is playing.
function Na__Reader__BufferedPlaySeconds(Na__Run) {
    if (Na__Run.current < 0 || Na__Run.waitingFor >= 0) return 0;
    let Na__Seconds = 0;
    for (let Na__I = Na__Run.current; Na__I < Na__Run.sections.length; Na__I++) {
        const Na__Record = Na__TextToReader__SectionCacheGet(Na__Run.keys[Na__I]);
        if (!Na__Record) break;
        let Na__AudioSeconds = Na__Record.samples / Na__Record.sampleRate;
        if (Na__I === Na__Run.current) {
            const Na__Played = (Number(Na__Reader__Nodes.audio.currentTime) || 0) * Na__Reader__AppliedPitch;
            Na__AudioSeconds = Math.max(0, Na__AudioSeconds - Na__Played);
        }
        Na__Seconds += Na__AudioSeconds / Math.max(0.25, Na__Reader__Speed);
    }
    return Na__Seconds;
}
// --------------------------------------------------------


// FUNCTION | SizeNextSection - Cut the next section the listener reaches to what can render in time
// --------------------------------------------------------
// Only for the first unrendered section after the one being heard, while it plays: its runway
// is everything rendered between the playhead and it. Returns true if the section was re-cut
// (the caller plans again).
function Na__Reader__SizeNextSection(Na__Run, Na__Index, Na__Buffered) {
    if (Na__Run.current < 0 || Na__Run.waitingFor >= 0 || Na__Index <= Na__Run.current) return false;
    for (let Na__I = Na__Run.current; Na__I < Na__Index; Na__I++) {
        if (!Na__TextToReader__SectionCacheHas(Na__Run.keys[Na__I])) return false;   // the listener reaches a gap first
    }
    const Na__Stretch = Na__TextToReader__UnrenderedStretch(Na__Run, Na__Index);
    if (!Na__Stretch) return false;

    const Na__Section = Na__Run.sections[Na__Index];
    const Na__Fit = Na__TextToReader__FitSectionSize(Na__Run.plan, Na__Section.first, Na__Stretch.to,
        Na__Run.timing, Na__Buffered, Na__Run.sizes, Na__Reader__Speed);
    Na__Reader__LogSizing(Na__Run, Na__Fit, Na__Buffered);
    if (Na__Fit.size === Na__Section.sentences.length) return false;
    return Na__TextToReader__RecutSections(Na__Run, Na__Index, Na__Section.first, Na__Fit.size, Na__Run.sizes.medium) >= 0;
}
// --------------------------------------------------------


// FUNCTION | LogSizing - Note in the activity log when the sizing settles, once each way per read
// --------------------------------------------------------
function Na__Reader__LogSizing(Na__Run, Na__Fit, Na__Buffered) {
    const Na__Detail = Na__Buffered.toFixed(1) + " s of audio ready ahead at " + Na__Reader__Speed + "x.";
    if (Na__Fit.fitted && Na__Fit.size >= Na__Run.sizes.large && !Na__Run.largeLogged) {
        Na__Run.largeLogged = true;
        Na__TextToReader__Log("info", "Reading ahead in " + Na__Run.sizes.large + "-sentence sections after " +
            ((performance.now() - Na__Run.startedAt) / 1000).toFixed(0) + " s; " + Na__Detail);
    } else if (Na__Fit.keepsAhead === false && !Na__Run.behindLogged) {
        Na__Run.behindLogged = true;
        Na__TextToReader__Log("warn", "This device is preparing speech slower than it is read: " +
            "short pauses between sections are likely. " + Na__Detail);
    }
}
// --------------------------------------------------------


// FUNCTION | PumpSections - Keep rendering around the anchor until every section is ready
// --------------------------------------------------------
// Safe to call at any time (a section arrived, the anchor moved): a loop already running
// re-plans after each section, and one that stopped, over budget, starts again.
function Na__Reader__PumpSections(Na__Run) {
    if (Na__Run.dead || Na__Run.pumping) return;
    Na__Run.pumping = true;

    (async () => {
        try {
            while (!Na__Run.dead) {
                const Na__Buffered = Na__Reader__BufferedPlaySeconds(Na__Run);
                const Na__Next = Na__TextToReader__PlanSectionRender(Na__Run.sections.length, Na__Run.anchor,
                    (Na__I) => Na__TextToReader__SectionCacheHas(Na__Run.keys[Na__I]),
                    Na__TextToReader__SectionCacheBytes() >= Na__Reader__SectionBudgetBytes(),
                    Na__Buffered < Na__Reader__RunwaySeconds());
                if (Na__Next.render < 0) break;
                if (Na__Reader__SizeNextSection(Na__Run, Na__Next.render, Na__Buffered)) continue;   // re-cut: plan again
                if (Na__Next.evict >= 0) Na__TextToReader__SectionCacheDrop(Na__Run.keys[Na__Next.evict]);

                if (!Na__Run.tts) {
                    // Only needed once something must be rendered: kept sections play with no engine at all
                    Na__Run.tts = await Na__Reader__LoadEngine();
                    continue;
                }

                Na__Run.rendering = Na__Next.render;
                const Na__Rendered = await Na__Reader__RenderSection(Na__Run, Na__Next.render);
                Na__Run.rendering = -1;
                if (!Na__Rendered) continue;   // dropped for a section needed sooner, or the run ended

                // A rendering section is never re-cut, so it is still in the run; its index may have moved
                const Na__Index = Na__Run.sections.indexOf(Na__Rendered.section);
                if (Na__Index < 0) continue;
                Na__TextToReader__RecordRenderTiming(Na__Run.timing, Na__Rendered.section.sentences,
                    Na__Rendered.seconds, Na__Rendered.record.samples / Na__Rendered.record.sampleRate);
                Na__TextToReader__SectionCachePut(Na__Rendered.record);
                Na__Reader__OnSectionReady(Na__Run, Na__Index, Na__Rendered.record);
            }
        } catch (Na__Error) {
            if (!Na__Run.dead) Na__Reader__FailRun(Na__Run, Na__Error);

        } finally {
            Na__Run.pumping = false;
            Na__Run.rendering = -1;
        }
    })();
}
// --------------------------------------------------------


// FUNCTION | OnSectionReady - Start the section a listener is waiting for, otherwise just report
// --------------------------------------------------------
function Na__Reader__OnSectionReady(Na__Run, Na__Index, Na__Record) {
    if (Na__Run.waitingFor === Na__Index) {
        if (Na__Run.firstLog) {
            Na__Run.firstLog("First section ready: " + Na__Reader__FormatSeconds(Na__Record.samples / Na__Record.sampleRate) +
                " of audio (" + Na__Reader__DescribeSection(Na__Run, Na__Index) + ")");
            Na__Run.firstLog = null;
        }
        Na__Reader__LoadSection(Na__Run, Na__Index, Na__Run.pendingWord, Na__Run.pendingSeconds);
    }

    if (!Na__Run.completeLogged && Na__Reader__ReadySentences(Na__Run) === Na__Run.plan.length) {
        Na__Run.completeLogged = true;
        Na__TextToReader__Log("ok", "All " + Na__Run.plan.length + " sentences prepared with " +
            Na__Reader__SelectedModel().NaMiniApp__Label + " on " + Na__Reader__DescribeEngine(Na__Run.tts),
            performance.now() - Na__Run.startedAt);
    }
}
// --------------------------------------------------------


// FUNCTION | FailRun - A section could not be rendered
// --------------------------------------------------------
// Sections already rendered keep playing. If nothing is playing yet the run is abandoned.
function Na__Reader__FailRun(Na__Run, Na__Error) {
    Na__Run.failed = Na__Error.message;
    if (Na__Run.firstLog) {
        Na__Run.firstLog.fail(Na__Error);
        Na__Run.firstLog = null;
    } else {
        Na__TextToReader__Log("error", "Section preparation failed: " + Na__Error.message);
    }
    Na__Reader__SetStatus("Speech preparation failed: " + Na__Error.message);

    if (Na__Run.current < 0) {
        Na__Run.dead = true;
        if (Na__Reader__Run === Na__Run) Na__Reader__Run = null;
        Na__Reader__SetBusy(false);
        Na__Reader__Nodes.progress.hidden = true;
    }
}
// --------------------------------------------------------


// FUNCTION | LoadSection - Put a rendered section on the audio element and play it; false if it is not rendered
// --------------------------------------------------------
// With a word, playback starts at that word's sentence. The page scrolls to follow, as it does
// for any highlighted sentence.
function Na__Reader__LoadSection(Na__Run, Na__Index, Na__Word, Na__Offset = null) {
    const Na__Record = Na__TextToReader__SectionCacheGet(Na__Run.keys[Na__Index]);
    if (!Na__Record) return false;

    const Na__Audio = Na__Reader__Nodes.audio;
    const Na__OldUrl = Na__Reader__AudioUrl;
    const Na__Section = Na__Run.sections[Na__Index];

    Na__Reader__SectionAudio = Na__Record;
    const Na__Pitched = Na__Reader__EncodePitched(1 + Na__Reader__PitchPercent / 100);
    Na__Reader__AppliedPitch = Na__Pitched.effective;
    Na__Reader__AudioUrl = Na__Pitched.url;
    Na__Reader__BaseTimeline = Na__TextToReader__SectionTimeline(Na__Record, Na__Section);
    const Na__Timeline = Na__Reader__ScaleTimeline(Na__Reader__AppliedPitch);

    Na__Audio.src = Na__Pitched.url;
    Na__Reader__ApplyPlaybackRate();
    Na__TextToReader__SetHighlightTimeline(Na__Timeline);

    const Na__Piece = Na__Word?.closest(".TTR__s");
    const Na__Entry = Na__Piece && Na__Timeline.find((Na__Candidate) => Na__Candidate.pieces.includes(Na__Piece));
    if (Na__Entry || Na__Offset !== null) {
        const Na__Wanted = Na__Entry ? Na__Entry.start : Na__Offset;
        Na__Audio.addEventListener("loadedmetadata", () => {
            // A rapid second jump may have replaced the source before metadata arrived. Compared
            // by section, not index: a re-cut behind it can renumber the one now playing.
            if (Na__Run.dead || Na__Reader__Run !== Na__Run || Na__Run.sections[Na__Run.current] !== Na__Section) return;
            Na__Audio.currentTime = Math.max(0, Math.min(Math.max(0, Na__Audio.duration - 0.05), Na__Wanted));
        }, { once: true });
    }
    if (Na__OldUrl) URL.revokeObjectURL(Na__OldUrl);

    Na__Run.current = Na__Index;
    Na__Run.anchor = Na__Index;
    Na__Run.waitingFor = -1;
    Na__Run.pendingWord = null;
    Na__Run.pendingSeconds = null;
    Na__Run.finished = false;

    if (!Na__Reader__Ready) {
        Na__Reader__Ready = true;
        Na__Reader__PreparedText = Na__Reader__WholeText();
        Na__Reader__Nodes.prepare.hidden = true;
        Na__Reader__SetBusy(false);
    }
    Na__Audio.play().catch(() =>
        Na__Reader__SetStatus("Audio prepared. Tap Play to continue; the browser needs a tap to start playback."));
    Na__Reader__UpdatePlaybackState();

    Na__Reader__PumpSections(Na__Run);   // the anchor moved
    Na__Reader__ReportSections(Na__Run);
    return true;
}
// --------------------------------------------------------


// FUNCTION | WaitForSection - Hold playback until a section is rendered, and render it before any other
// --------------------------------------------------------
// The wait is kept as short as it can be: the unrendered stretch is re-cut so a section of the
// opening size starts at the wanted sentence (the word's, else the section's first). A jump by
// seconds (Na__Offset) keeps its section as it is, since the offset counts from its start.
function Na__Reader__WaitForSection(Na__Run, Na__Index, Na__Word, Na__Offset = null) {
    Na__Reader__Nodes.audio.pause();
    if (Na__Offset === null) {
        const Na__Wanted = Na__Run.positionOf.get(Na__Word?.closest(".TTR__s")?.dataset.s) ?? Na__Run.sections[Na__Index].first;
        const Na__Recut = Na__TextToReader__RecutSections(Na__Run, Na__Index, Na__Wanted,
            Na__TextToReader__OpenerSize(Na__Run.plan, Na__Wanted, Na__Run.sizes), Na__Run.sizes.medium);
        if (Na__Recut >= 0) {
            Na__Index = Na__Recut;
            if (Na__Reader__LoadSection(Na__Run, Na__Index, Na__Word)) return;   // the new cut's text was already rendered
        }
    }
    Na__Run.waitingFor = Na__Index;
    Na__Run.anchor = Na__Index;
    Na__Run.pendingWord = Na__Word;
    Na__Run.pendingSeconds = Na__Offset;
    Na__Run.finished = false;
    Na__Run.failed = null;
    if (Na__Run.rendering >= 0 && Na__Run.rendering !== Na__Index) Na__Run.epoch++;
    Na__Reader__PumpSections(Na__Run);
    Na__Reader__ReportSections(Na__Run);
}
// --------------------------------------------------------


// FUNCTION | GoToSection - Play from a section (or a word in it), now if rendered, else as soon as it is
// --------------------------------------------------------
function Na__Reader__GoToSection(Na__Run, Na__Index, Na__Word, Na__Offset = null) {
    if (!Na__Reader__LoadSection(Na__Run, Na__Index, Na__Word, Na__Offset)) {
        Na__Reader__WaitForSection(Na__Run, Na__Index, Na__Word, Na__Offset);
    }
}
// --------------------------------------------------------


// FUNCTION | AdvanceSection - The section on the audio element ended: carry on with the next
// --------------------------------------------------------
function Na__Reader__AdvanceSection() {
    const Na__Run = Na__Reader__Run;
    if (!Na__Run || Na__Run.dead || Na__Run.current < 0 || Na__Run.waitingFor >= 0) return;

    const Na__Next = Na__Run.current + 1;
    if (Na__Next >= Na__Run.sections.length) {
        Na__Run.finished = true;
        Na__Reader__ReportSections(Na__Run);
        return;
    }
    Na__Reader__GoToSection(Na__Run, Na__Next, null);
}
// --------------------------------------------------------


// FUNCTION | PrepareSections - Pick the first section, render and play it, and render the rest while it plays
// --------------------------------------------------------
// Play From Here starts at the given word's sentence, and with Na__WholeSection (Prepare & Play
// This Section) at the start of its section. Without a word the start of the selection is used;
// with no selection it starts at the beginning. Rendered sections from an earlier read
// are reused, so starting again on text already rendered needs no engine and no waiting.
async function Na__Reader__PrepareSections(Na__StartWord, Na__WholeSection = false) {
    if (Na__Reader__SectionStarting) {
        if (Na__StartWord) Na__Reader__QueuedRequest = { word: Na__StartWord, whole: Na__WholeSection };
        return;
    }
    Na__Reader__SectionStarting = true;
    Na__Reader__AutoStartPending = true;
    const Na__RequestedGeneration = Na__Reader__GenerationId;
    Na__Reader__SetBusy(true);
    Na__Reader__Nodes.stop.disabled = false;
    Na__Reader__SetStatus("Preparing the first section…");
    Na__Reader__SetProgress(null);

    try {
        const Na__Plan = Na__TextToReader__BuildReadingPlan(Na__Reader__Article, true);
        if (!Na__Plan.length) {
            Na__Reader__SetStatus("No article text to read.");
            Na__Reader__AutoStartPending = false;
            Na__Reader__SetBusy(false);
            Na__Reader__Nodes.progress.hidden = true;
            return;
        }
        const Na__VoiceReady = await Na__Reader__EnsureVoiceInstalled();
        if (Na__RequestedGeneration !== Na__Reader__GenerationId) return;
        if (!Na__VoiceReady) {
            Na__Reader__SetBusy(false);
            Na__Reader__Nodes.progress.hidden = true;
            return;
        }

        // Cut before the cache is trimmed: the cut reuses whatever of this text is rendered
        const Na__Sizes = Na__Reader__SectionSizes();
        const Na__ModelId = Na__Reader__SelectedModel().NaMiniApp__ModelId;
        const Na__Run = {
            plan        : Na__Plan,
            modelId     : Na__ModelId,
            sizes       : Na__Sizes,
            timing      : { secondsPerWork: null, lastSecondsPerWork: null, audioPerCharacter: null },
            sections    : Na__TextToReader__CutSections(Na__Plan, 0, Na__Plan.length, Na__Sizes.medium, Na__ModelId, Na__Sizes.first),
            keys        : [],
            sectionOf   : new Map(),
            positionOf  : new Map(Na__Plan.map((Na__Sentence, Na__Position) => [Na__Sentence.id, Na__Position])),
            controller  : new AbortController(),
            tts         : null,
            anchor      : -1,
            current     : -1,
            waitingFor  : -1,
            pendingWord : null,
            pendingSeconds : null,
            rendering   : -1,
            epoch       : 0,
            pumping     : false,
            dead        : false,
            finished    : false,
            failed      : null,
            completeLogged : false,
            largeLogged : false,
            behindLogged : false,
            startedAt   : performance.now(),
            firstLog    : null
        };
        Na__TextToReader__IndexSections(Na__Run);

        // No selection is required: default to the first sentence. A tap during voice loading
        // takes priority, and later taps jump immediately within the active run.
        const Na__Queued = Na__Reader__QueuedRequest;
        const Na__Pointed = Na__Queued?.word || Na__StartWord || Na__TextToReader__SelectionStartWord(Na__Reader__Article);
        const Na__Whole = Boolean(Na__Queued?.whole || Na__WholeSection);
        Na__Reader__QueuedRequest = null;
        window.getSelection()?.removeAllRanges();   // The selection has said where to start

        // Unless it is already rendered, the opening section is short and starts AT the wanted
        // sentence (Prepare & Play This Section: at its section's first sentence)
        let Na__Start = Na__Run.sectionOf.get(Na__Pointed?.closest(".TTR__s")?.dataset.s) ?? 0;
        const Na__StartAt = Na__Whole ? null : Na__Pointed;
        const Na__Wanted = (Na__Whole ? null : Na__Run.positionOf.get(Na__Pointed?.closest(".TTR__s")?.dataset.s)) ??
            Na__Run.sections[Na__Start].first;
        const Na__Recut = Na__TextToReader__RecutSections(Na__Run, Na__Start, Na__Wanted,
            Na__TextToReader__OpenerSize(Na__Plan, Na__Wanted, Na__Sizes), Na__Sizes.medium);
        if (Na__Recut >= 0) Na__Start = Na__Recut;
        Na__Run.anchor = Na__Start;
        Na__Run.waitingFor = Na__Start;
        Na__Run.pendingWord = Na__StartAt;

        Na__TextToReader__StopReadAloud();                    // Ends an earlier read; its rendered sections stay
        Na__TextToReader__SectionCacheRetain(Na__Run.keys);   // Drops other text's, which could never be played

        Na__Run.firstLog = Na__TextToReader__LogTimer("Preparing " + Na__Reader__DescribeSection(Na__Run, Na__Start));
        Na__Reader__Run = Na__Run;
        Na__Reader__Controller = Na__Run.controller;
        Na__Reader__SetBusy(true);
        Na__Reader__Nodes.stop.disabled = false;

        if (Na__Reader__LoadSection(Na__Run, Na__Start, Na__StartAt)) {
            Na__Run.firstLog("Already rendered (" + Na__Reader__DescribeSection(Na__Run, Na__Start) + "); playing at once");
            Na__Run.firstLog = null;
            return;
        }
        Na__Reader__SetStatus("Preparing " + Na__Reader__DescribeSection(Na__Run, Na__Start) + "…");
        Na__Reader__SetProgress(null);
        Na__Reader__PumpSections(Na__Run);

    } catch (Na__Error) {
        Na__Reader__SetBusy(false);
        Na__Reader__Nodes.progress.hidden = true;
        Na__Reader__SetStatus("Unable to start reading: " + Na__Error.message);
        Na__TextToReader__Log("error", "Unable to start reading: " + Na__Error.message);
    } finally {
        Na__Reader__SectionStarting = false;
    }
}
// --------------------------------------------------------


// FUNCTION | JumpToWord - Play a word that is not in the section on the audio element
// --------------------------------------------------------
// Registered with the highlight module. Answers false, leaving it to the usual whole-document
// preparation, unless sections are on.
function Na__Reader__JumpToWord(Na__Word) {
    if (!Na__Reader__SectionMode) return false;
    if (!Na__Reader__Run) {
        Na__Reader__PrepareSections(Na__Word);
        return true;
    }
    const Na__Index = Na__Reader__Run.sectionOf.get(Na__Word.closest(".TTR__s")?.dataset.s);
    if (Na__Index !== undefined) Na__Reader__GoToSection(Na__Reader__Run, Na__Index, Na__Word);
    return true;
}
// --------------------------------------------------------


// FUNCTION | PlayThisSection - Prepare and play the section holding the selection, else the given word
// --------------------------------------------------------
// The right-click menu's Prepare & Play This Section (sectioned reading only). Reading starts
// at the section's first sentence, now if it is already rendered, else as soon as it is, and
// the sections around it are rendered while it plays. The selection has done its job: cleared.
export function Na__TextToReader__PlayThisSection(Na__Word) {
    if (!Na__Reader__SectionMode) return;
    const Na__Target = Na__TextToReader__SelectionStartWord(Na__Reader__Article) || Na__Word;
    window.getSelection()?.removeAllRanges();
    if (!Na__Target) return;

    if (!Na__Reader__Run) {
        Na__Reader__PrepareSections(Na__Target, true);
        return;
    }
    const Na__Index = Na__Reader__Run.sectionOf.get(Na__Target.closest(".TTR__s")?.dataset.s);
    if (Na__Index !== undefined) Na__Reader__GoToSection(Na__Reader__Run, Na__Index, null);
}
// --------------------------------------------------------


// FUNCTION | PlayFromStart - From the start of what was prepared; with sections, the start of the document
// --------------------------------------------------------
export function Na__TextToReader__PlayFromStart() {
    if (Na__Reader__Run) {
        Na__Reader__GoToSection(Na__Reader__Run, 0, null);
        return;
    }
    Na__Reader__Nodes.audio.currentTime = 0;
    Na__Reader__Nodes.audio.play().catch((Na__Error) => console.warn("Play from start blocked:", Na__Error));
}
// --------------------------------------------------------


// FUNCTION | SetSectionMode - The voice modal's switch: read in sections, or the whole document at once
// --------------------------------------------------------
function Na__Reader__SetSectionMode(Na__On, Na__Persist) {
    Na__Reader__SectionMode = Boolean(Na__On) && Boolean(Na__Reader__Modal.sectionsToggle);   // An older cached page has no switch
    if (Na__Reader__Modal.sectionsToggle) Na__Reader__Modal.sectionsToggle.checked = Na__Reader__SectionMode;
    document.body.dataset.ttrSections = Na__Reader__SectionMode ? "on" : "off";   // The right-click menu reads this

    const Na__Label = "Prepare & Play";
    Na__Reader__Nodes.prepare.title = Na__Label;
    Na__Reader__Nodes.prepare.setAttribute("aria-label", Na__Label);

    if (!Na__Persist) return;
    Na__TextToReader__SetUserSetting(Na__Reader__UserSection, "NaUserConfig__SectionedReading", Na__Reader__SectionMode);
    Na__TextToReader__StopReadAloud();   // What is prepared was made the other way
    Na__Reader__SetStatus(Na__Reader__SectionMode
        ? "Reading in sections. Starts at the beginning; tap a sentence to jump."
        : "Reading the whole document at once.");
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------


// REGION | Playback Controls
// --------------------------------------------------------

// FUNCTION | TogglePause - Pause or resume pre-generated speech
// --------------------------------------------------------
async function Na__Reader__TogglePause() {
    if (!Na__Reader__Ready) return;
    const Na__Run = Na__Reader__Run;
    if (Na__Run && Na__Run.waitingFor >= 0) {
        // Playback is between sections: pressing Play would replay the one just heard
        Na__Reader__ReportSections(Na__Run);
        return;
    }
    if (Na__Run?.finished && Na__Reader__Nodes.audio.ended) {
        Na__Reader__GoToSection(Na__Run, 0, null);   // After the last section, Play reads the document again
        return;
    }
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


// FUNCTION | StartLoadedText - Begin synthesis on paste, file load or Read
// --------------------------------------------------------
export function Na__TextToReader__StartLoadedText() {
    if (!Na__Reader__Config || !Na__Reader__Article?.textContent.trim()) return;
    if (Na__Reader__SectionMode) void Na__Reader__PrepareSections(null);
    else void Na__Reader__PrepareAudio();
}
// --------------------------------------------------------


// FUNCTION | SetReadAloudVisible - Audio controls belong to the Read tab alone
// --------------------------------------------------------
export function Na__TextToReader__SetReadAloudVisible(Na__Visible) {
    Na__Reader__Nodes.panel.hidden = !Na__Visible;
    if (Na__Visible && Na__Reader__Config) Na__Reader__EnsureVoiceInstalled();
    if (!Na__Visible) Na__Reader__CloseModal();
    Na__Reader__RefreshTransport();
}
// --------------------------------------------------------


// FUNCTION | SetVoiceDeclinedHandler - Let the controller leave the Read tab when the download is declined
// --------------------------------------------------------
export function Na__TextToReader__SetVoiceDeclinedHandler(Na__Handler) {
    Na__Reader__OnDismiss = Na__Handler;
}
// --------------------------------------------------------


// FUNCTION | InitialiseReadAloud - Register controls, preferences and media session
// --------------------------------------------------------
export function Na__TextToReader__InitialiseReadAloud({ config, article }) {
    Na__Reader__Config = config;
    Na__Reader__Article = article;

    // Remembered between sessions by the user config (Main loads it before this runs)
    Na__Reader__BuildPitchControls();
    Na__Reader__SetPitch(Na__TextToReader__GetUserSetting(Na__Reader__UserSection, "NaUserConfig__PitchPercent"), false);

    // Sections: the voice modal's switch and direct sentence tapping; no pick-mode prompt
    const Na__Sizes = Na__Reader__SectionSizes();
    if (Na__Reader__Modal.sectionsNote) Na__Reader__Modal.sectionsNote.textContent =
        "Starts after the first " + Na__Sizes.first + " sentences (a few more if they are very short). " +
        "It then times how fast this device prepares " +
        "speech and makes each next part as long as it can finish before you reach it, up to " +
        Na__Sizes.large + " sentences; a device that cannot keep ahead prepares " + Na__Sizes.medium +
        " at a time. Tap any sentence to jump there: it starts from that sentence, and the rest " +
        "prepare while you listen.";
    // Each (i) button shows or hides the text its aria-controls names
    for (const Na__Info of Na__Reader__Modal.dialog.querySelectorAll(".TTR__voice-info")) {
        Na__Info.addEventListener("click", () => {
            const Na__Text = document.getElementById(Na__Info.getAttribute("aria-controls"));
            const Na__Open = Na__Text.hidden;
            Na__Text.hidden = !Na__Open;
            Na__Info.setAttribute("aria-expanded", String(Na__Open));
        });
    }
    Na__Reader__SetSectionMode(Na__TextToReader__GetUserSetting(Na__Reader__UserSection, "NaUserConfig__SectionedReading"), false);
    Na__Reader__Modal.sectionsToggle?.addEventListener("change", () =>
        Na__Reader__SetSectionMode(Na__Reader__Modal.sectionsToggle.checked, true));
    Na__TextToReader__SetOutsideJumpHandler(Na__Reader__JumpToWord);

    const Na__StoredSpeed = Number(Na__TextToReader__GetUserSetting(Na__Reader__UserSection, "NaUserConfig__PlaybackSpeed"));
    Na__Reader__SetSpeed(Na__StoredSpeed || Number(config.NaMiniApp__DefaultSpeed) || 2, false);
    Na__Reader__InlineAnimatedIcon("Icon__ReadAloud__SpeedDial__.svg",
        Na__Reader__Nodes.speed.querySelector(".TTR__audio-speed-dial"), "data-speed", String(Na__Reader__Speed));
    Na__Reader__InlineAnimatedIcon("Icon__ReadAloud__PlayPause__.svg",
        Na__Reader__Nodes.pause.querySelector(".TTR__audio-playpause"), "data-show",
        Na__Reader__Nodes.audio.paused ? "play" : "pause");

    Na__Reader__Nodes.prepare.addEventListener("click", Na__Reader__PrepareAudio);
    Na__TextToReader__InitialiseHighlight(Na__Reader__Nodes.audio);
    new MutationObserver(Na__Reader__QueueSyncPrepareButton)
        .observe(article, { childList: true, subtree: true, characterData: true });
    document.addEventListener("selectionchange", Na__Reader__QueueSyncPrepareButton);
    Na__Reader__Modal.download.addEventListener("click", Na__Reader__ConfirmModalChoice);
    Na__Reader__Modal.later.addEventListener("click", () => {
        Na__Reader__CloseModal();
        if (Na__Reader__ModalForced) {
            Na__Reader__AutoStartPending = false;
            Na__Reader__QueuedRequest = null;
            Na__Reader__OnDismiss?.();
        }
    });
    Na__Reader__Nodes.model?.addEventListener("click", () => Na__Reader__OpenVoiceModal(false));
    Na__Reader__Modal.dialog.addEventListener("cancel", (Na__Event) => Na__Event.preventDefault());
    Na__Reader__Nodes.stop.addEventListener("click", () => {
        Na__TextToReader__StopReadAloud();
        Na__Reader__SetStatus("Stopped.");
    });
    Na__Reader__Nodes.pause.addEventListener("click", Na__Reader__TogglePause);
    Na__Reader__Nodes.speed.addEventListener("click", Na__Reader__StepSpeed);

    // Transport: direct playback movement; sections are created on demand if missing.
    const Na__Transport = Na__Reader__Transport;
    if (Na__Transport.bar) {
        Na__Transport.previous.addEventListener("click", () => Na__Reader__NavigateSentence(-1));
        Na__Transport.next.addEventListener("click", () => Na__Reader__NavigateSentence(1));
        Na__Transport.backward.addEventListener("click", () => Na__Reader__SeekRelative(-10));
        Na__Transport.forward.addEventListener("click", () => Na__Reader__SeekRelative(10));
        Na__Transport.seek.addEventListener("input", () => {
            Na__Reader__TransportDragging = true;
            const Na__Seconds = Na__Reader__TransportDuration() * Number(Na__Transport.seek.value) / 1000;
            Na__Transport.elapsed.textContent = Na__Reader__TransportClock(Na__Seconds);
        });
        Na__Transport.seek.addEventListener("change", () => {
            const Na__Seconds = Na__Reader__TransportDuration() * Number(Na__Transport.seek.value) / 1000;
            if (Na__Reader__Ready && Number.isFinite(Na__Seconds)) {
                Na__Reader__Nodes.audio.currentTime = Na__Seconds;
            }
            Na__Reader__TransportDragging = false;
            Na__Reader__RefreshTransport();
        });
        Na__Transport.seek.addEventListener("pointercancel", () => {
            Na__Reader__TransportDragging = false;
            Na__Reader__RefreshTransport();
        });
        Na__Transport.seek.addEventListener("blur", () => {
            Na__Reader__TransportDragging = false;
            Na__Reader__RefreshTransport();
        });
    }

    for (const Na__Name of ["play", "pause", "ended"]) {
        Na__Reader__Nodes.audio.addEventListener(Na__Name, Na__Reader__UpdatePlaybackState);
    }
    Na__Reader__Nodes.audio.addEventListener("ended", Na__Reader__AdvanceSection);
    for (const Na__Name of ["loadedmetadata", "timeupdate", "durationchange", "seeked", "emptied"]) {
        Na__Reader__Nodes.audio.addEventListener(Na__Name, Na__Reader__RefreshTransport);
    }

    if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title  : "Text To Reader",
            artist : Na__Reader__SelectedModel()?.NaMiniApp__Label || "Read aloud"
        });
        navigator.mediaSession.setActionHandler("play", () => Na__Reader__Nodes.audio.play());
        navigator.mediaSession.setActionHandler("pause", () => Na__Reader__Nodes.audio.pause());
        navigator.mediaSession.setActionHandler("stop", Na__TextToReader__StopReadAloud);
        // Android's notification / headset commands use the same transport logic.
        for (const [Na__Action, Na__Callback] of [
            ["seekbackward", (Na__Details) => Na__Reader__SeekRelative(-(Na__Details.seekOffset || 10))],
            ["seekforward", (Na__Details) => Na__Reader__SeekRelative(Na__Details.seekOffset || 10)],
            ["previoustrack", () => Na__Reader__NavigateSentence(-1)],
            ["nexttrack", () => Na__Reader__NavigateSentence(1)],
            ["seekto", (Na__Details) => {
                const Na__Duration = Na__Reader__TransportDuration();
                if (Na__Reader__Ready && Na__Duration && Number.isFinite(Na__Details.seekTime)) {
                    Na__Reader__Nodes.audio.currentTime = Math.max(0, Math.min(Na__Duration, Na__Details.seekTime));
                }
            }]
        ]) {
            try { navigator.mediaSession.setActionHandler(Na__Action, Na__Callback); }
            catch (Na__Error) { console.info("Media action unavailable: " + Na__Action, Na__Error); }
        }
    }

    Na__Reader__UpdateModelButton();
    Na__Reader__RefreshTransport();

    if ("serviceWorker" in navigator) {
        Na__Reader__EnsureCrossOriginIsolation().catch((Na__Error) => console.warn("Offline worker not yet installed:", Na__Error));
    }
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------
