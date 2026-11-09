// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - SECTIONS
// =============================================================================
//
// FILE    : MiniApp__TextToReader__Sections__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Read a long document in sections, so reading starts once ONE section is
//           rendered instead of once the whole document is
// CREATED : 27-Oct-2026
//
// HOW IT WORKS (the run itself lives in ReadAloud__.js; this file is its parts):
//   - Sections are not fixed. The opening section holds NaMiniApp__FirstSectionSentences (2),
//     so reading starts quickly. After that, the section the listener reaches next is cut,
//     just before it renders, to the most sentences (up to NaMiniApp__SectionSentences, 10)
//     this device can render before the playhead gets there: its measured rendering speed
//     against the audio already rendered ahead. Sections not yet reached are cut at
//     NaMiniApp__IntermediateSectionSentences (4), as is a section when the device cannot
//     keep ahead at all.
//   - A jump to a sentence that is not rendered re-cuts the unrendered stretch so a short
//     section starts AT that sentence: the wait is for two sentences, whatever was planned.
//   - Rendered sections, and the one rendering, are never re-cut. Cutting reuses rendered
//     audio: a run of sentences already rendered becomes a section of its own, so reading the
//     same text again plays at once, whatever size it was cut to the first time.
//   - Rendering runs ahead of the playhead until a runway is built, then outwards from it:
//     the one after, the one before, two after, two before, and so on.
//   - A rendered section is kept as 16-bit PCM in a Blob (half the memory of the engine's
//     floats, and the browser may hold it on disk) with its sentence timing. The WAV header
//     is added when it is played, so a pitch change needs no re-rendering.
//   - The cache is keyed by voice plus the section's text, never by position or by the page
//     elements: leaving Read and coming back (which rebuilds the page) loses nothing, and a
//     section whose text is unchanged stays ready after an edit.
//   - A memory budget keeps the sections nearest the playhead and lets go of the farthest.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports
// -----------------------------------------------------------------------------

// @delegate: ./MiniApp__TextToReader__Highlight__.js
import { Na__TextToReader__BindSentenceTiming } from "./MiniApp__TextToReader__Highlight__.js";

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

const Na__Sections__Cache = new Map();   // key -> { key, data, sampleRate, samples, bytes, timing }

// Section sizing. Rendering cost is counted as "work": a section's characters plus a fixed
// charge per sentence, as every sentence is its own request to the speech engine.
const Na__Sections__WorkPerSentence = 20;     // characters' worth of engine start-up per sentence
const Na__Sections__TimingBlend     = 0.35;   // weight of the newest render in the running average
const Na__Sections__RenderSafety    = 1.25;   // a section must render in 80% of its runway...
const Na__Sections__RenderMargin    = 1.5;    // ...less 1.5 s, so one slow sentence makes no gap
const Na__Sections__OpenerCharacters = 100;   // an opening section holds at least this much text (~6 s)

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sections
// -----------------------------------------------------------------------------

// FUNCTION | CutSections - Cut part of the reading plan into sections, reusing rendered ones
// ------------------------------------------------------------
// Covers plan positions [Na__From, Na__To). Where audio is already rendered for a run of
// sentences (this voice, these exact sentences) that run becomes a section of its own, so the
// same text read again plays at once whatever size it was cut to before. Elsewhere sections
// hold Na__Size sentences (the first one Na__FirstSize), each ended early where a rendered run
// starts. Returns [{ index, first, sentences, text }]: first is the plan position of the
// section's first sentence; index is set when the run is indexed (IndexSections).
export function Na__TextToReader__CutSections(Na__Plan, Na__From, Na__To, Na__Size, Na__ModelId, Na__FirstSize = Na__Size) {
    const Na__Sections = [];
    const Na__Longest = Na__Sections__LongestCached();

    for (let Na__First = Na__From; Na__First < Na__To;) {
        let Na__Count = Na__Sections__CachedRunAt(Na__Plan, Na__First, Na__To, Na__ModelId, Na__Longest);
        if (!Na__Count) {
            const Na__Wanted = Math.max(1, Na__Sections.length === 0 ? Na__FirstSize : Na__Size);
            Na__Count = Math.min(Na__Wanted, Na__To - Na__First);
            for (let Na__Next = Na__First + 1; Na__Next < Na__First + Na__Count; Na__Next++) {
                if (Na__Sections__CachedRunAt(Na__Plan, Na__Next, Na__To, Na__ModelId, Na__Longest)) {
                    Na__Count = Na__Next - Na__First;   // stop where rendered audio starts
                    break;
                }
            }
        }
        Na__Sections.push(Na__Sections__MakeSection(Na__Plan, Na__First, Na__Count));
        Na__First += Na__Count;
    }
    return Na__Sections;
}
// ------------------------------------------------------------


// FUNCTION | IndexSections - Number a run's sections and rebuild its keys and sentence lookup
// ------------------------------------------------------------
// Run.sectionOf maps a sentence id (a .TTR__s element's data-s) to its section's index.
export function Na__TextToReader__IndexSections(Na__Run) {
    Na__Run.sectionOf = new Map();
    Na__Run.sections.forEach((Na__Section, Na__Index) => {
        Na__Section.index = Na__Index;
        for (const Na__Sentence of Na__Section.sentences) Na__Run.sectionOf.set(Na__Sentence.id, Na__Index);
    });
    Na__Run.keys = Na__Run.sections.map((Na__Section) => Na__TextToReader__SectionKey(Na__Run.modelId, Na__Section));
}
// ------------------------------------------------------------


// FUNCTION | UnrenderedStretch - The unbroken run of re-cuttable sections around one
// ------------------------------------------------------------
// A section can be re-cut unless it is rendered or rendering now. Returns { low, high, from, to }
// (section indices, and the plan positions they cover, to exclusive), or null if Na__Index
// itself cannot be re-cut.
export function Na__TextToReader__UnrenderedStretch(Na__Run, Na__Index) {
    const Na__Sections = Na__Run.sections;
    const Na__Fixed = (Na__I) => Na__I === Na__Run.rendering || Na__TextToReader__SectionCacheHas(Na__Run.keys[Na__I]);
    if (!(Na__Index >= 0 && Na__Index < Na__Sections.length) || Na__Fixed(Na__Index)) return null;

    let Na__Low = Na__Index;
    let Na__High = Na__Index;
    while (Na__Low > 0 && !Na__Fixed(Na__Low - 1)) Na__Low--;
    while (Na__High < Na__Sections.length - 1 && !Na__Fixed(Na__High + 1)) Na__High++;
    return {
        low  : Na__Low,
        high : Na__High,
        from : Na__Sections[Na__Low].first,
        to   : Na__Sections[Na__High].first + Na__Sections[Na__High].sentences.length
    };
}
// ------------------------------------------------------------


// FUNCTION | RecutSections - Re-cut the unrendered stretch around a section so one starts at a given sentence
// ------------------------------------------------------------
// Within the stretch around Na__Index (UnrenderedStretch) a section of Na__Size sentences starts
// at plan position Na__Start (shortened if the stretch ends first); what is either side is cut
// at Na__DefaultSize. The run's current, anchor, waitingFor and rendering indices are moved to
// follow what they named. Returns the new section's index; -1, changing nothing, when
// Na__Index is rendered or rendering, or Na__Start is outside the stretch.
export function Na__TextToReader__RecutSections(Na__Run, Na__Index, Na__Start, Na__Size, Na__DefaultSize) {
    const Na__Stretch = Na__TextToReader__UnrenderedStretch(Na__Run, Na__Index);
    if (!Na__Stretch || !(Na__Start >= Na__Stretch.from && Na__Start < Na__Stretch.to)) return -1;
    const Na__End = Math.min(Na__Stretch.to, Na__Start + Math.max(1, Na__Size));

    // Already cut that way: leave it, and every index, alone
    const Na__Existing = Na__Run.sections[Na__Index];
    if (Na__Existing.first === Na__Start && Na__Existing.sentences.length === Na__End - Na__Start) return Na__Index;

    // Each index is remembered by the first sentence of its section, and found again by it
    const Na__Fields = ["current", "anchor", "waitingFor", "rendering"];
    const Na__Positions = Na__Fields.map((Na__Field) => Na__Run.sections[Na__Run[Na__Field]]?.first ?? -1);

    const Na__Behind = Na__TextToReader__CutSections(Na__Run.plan, Na__Stretch.from, Na__Start, Na__DefaultSize, Na__Run.modelId);
    const Na__Target = Na__Sections__MakeSection(Na__Run.plan, Na__Start, Na__End - Na__Start);
    const Na__Ahead  = Na__TextToReader__CutSections(Na__Run.plan, Na__End, Na__Stretch.to, Na__DefaultSize, Na__Run.modelId);
    Na__Run.sections = [
        ...Na__Run.sections.slice(0, Na__Stretch.low),
        ...Na__Behind, Na__Target, ...Na__Ahead,
        ...Na__Run.sections.slice(Na__Stretch.high + 1)
    ];
    Na__TextToReader__IndexSections(Na__Run);

    Na__Fields.forEach((Na__Field, Na__I) => {
        Na__Run[Na__Field] = Na__Positions[Na__I] < 0 ? -1 : Na__Run.sectionOf.get(Na__Run.plan[Na__Positions[Na__I]].id);
    });
    return Na__Target.index;
}
// ------------------------------------------------------------


// FUNCTION | OpenerSize - Sentences in a section the listener is waiting for
// ------------------------------------------------------------
// Na__Sizes.first sentences, and more (up to Na__Sizes.medium) while they come to less than
// Na__Sections__OpenerCharacters: a heading and a one-word line are a second of audio, too
// little for anything after them to render in time.
export function Na__TextToReader__OpenerSize(Na__Plan, Na__Start, Na__Sizes) {
    let Na__Count = 0;
    let Na__Characters = 0;
    while (Na__Start + Na__Count < Na__Plan.length &&
           (Na__Count < Na__Sizes.first || (Na__Count < Na__Sizes.medium && Na__Characters < Na__Sections__OpenerCharacters))) {
        Na__Characters += Na__Plan[Na__Start + Na__Count].text.length;
        Na__Count++;
    }
    return Math.max(1, Na__Count);
}
// ------------------------------------------------------------


// FUNCTION | RecordRenderTiming - Learn this device's speed from a finished section
// ------------------------------------------------------------
// Rendering is counted per unit of work (characters plus a charge per sentence, as every
// sentence is its own engine request), never per sentence: a heading and a long sentence
// differ tenfold. It is wall-clock seconds. Audio is counted per character, in the voice's own
// seconds before reading speed, so a change of speed needs no re-measuring. For rendering both
// a running average (a device that slows down, warm or in a hidden tab, is followed) and the
// newest figure (one slow section counts at once) are kept; sizing uses the slower of the two.
export function Na__TextToReader__RecordRenderTiming(Na__Timing, Na__Sentences, Na__Seconds, Na__AudioSeconds) {
    const Na__Work = Na__Sections__Work(Na__Sentences, Na__Sentences?.length || 0);
    const Na__Characters = Na__Work - (Na__Sentences?.length || 0) * Na__Sections__WorkPerSentence;
    if (!Na__Timing || !(Na__Work > 0) || !(Na__Seconds > 0)) return;
    const Na__Blend = (Na__Old, Na__New) => Na__Old == null
        ? Na__New
        : Na__Old * (1 - Na__Sections__TimingBlend) + Na__New * Na__Sections__TimingBlend;
    const Na__Rate = Na__Seconds / Na__Work;
    Na__Timing.secondsPerWork = Na__Blend(Na__Timing.secondsPerWork, Na__Rate);
    Na__Timing.lastSecondsPerWork = Na__Rate;
    if (Na__AudioSeconds > 0 && Na__Characters > 0) {
        Na__Timing.audioPerCharacter = Na__Blend(Na__Timing.audioPerCharacter, Na__AudioSeconds / Na__Characters);
    }
}
// ------------------------------------------------------------


// FUNCTION | FitSectionSize - The most sentences that can render before the listener needs them
// ------------------------------------------------------------
// Na__Runway is the seconds of rendered audio, at the listener's reading speed (Na__Speed),
// between the playhead and plan position Na__Start; Na__Limit is the plan position the section
// may not reach. Returns { size, fitted, keepsAhead }:
//   - no runway (the listener is waiting): the opening size (OpenerSize), to start sooner
//   - nothing measured yet: Na__Sizes.medium
//   - the next Na__Sizes.medium sentences would render slower than they are listened to
//     (keepsAhead false): a pause is coming whatever the size, so steady medium cycles
//   - otherwise the most sentences, up to Na__Sizes.large, whose rendering fits the runway
//     with a margin (fitted true); if not even one fits, one (the shortest possible wait)
export function Na__TextToReader__FitSectionSize(Na__Plan, Na__Start, Na__Limit, Na__Timing, Na__Runway, Na__Sizes, Na__Speed = 1) {
    const Na__Room = Math.max(1, Math.min(Na__Limit, Na__Plan.length) - Na__Start);
    const Na__Size = (Na__Count) => Math.max(1, Math.min(Na__Count, Na__Room));
    if (!(Na__Runway > 0)) {
        return { size: Na__Size(Na__TextToReader__OpenerSize(Na__Plan, Na__Start, Na__Sizes)), fitted: false, keepsAhead: null };
    }

    const Na__Rate = Math.max(Na__Timing?.secondsPerWork || 0, Na__Timing?.lastSecondsPerWork || 0);
    if (!(Na__Rate > 0)) return { size: Na__Size(Na__Sizes.medium), fitted: false, keepsAhead: null };

    // Judged on the text coming up, not on what was measured: an average rate, and that
    // text's own length in speech
    const Na__Ahead = Na__Plan.slice(Na__Start, Na__Start + Na__Size(Na__Sizes.medium));
    const Na__Listen = (Na__Timing.audioPerCharacter || 0) *
        (Na__Sections__Work(Na__Ahead, Na__Ahead.length) - Na__Ahead.length * Na__Sections__WorkPerSentence) /
        Math.max(0.25, Number(Na__Speed) || 1);
    const Na__KeepsAhead = !(Na__Listen > 0) || Na__Timing.secondsPerWork * Na__Sections__Work(Na__Ahead, Na__Ahead.length) < Na__Listen;
    if (!Na__KeepsAhead) return { size: Na__Size(Na__Sizes.medium), fitted: false, keepsAhead: false };

    let Na__Fit = 0;
    for (let Na__Count = 1; Na__Count <= Math.min(Na__Sizes.large, Na__Room); Na__Count++) {
        const Na__Work = Na__Sections__Work(Na__Plan.slice(Na__Start, Na__Start + Na__Count), Na__Count);
        if (Na__Work * Na__Rate * Na__Sections__RenderSafety + Na__Sections__RenderMargin > Na__Runway) break;
        Na__Fit = Na__Count;
    }
    return { size: Na__Size(Na__Fit || 1), fitted: Na__Fit > 0, keepsAhead: true };
}
// ------------------------------------------------------------


// FUNCTION | Work - How much rendering some sentences are, in characters
// ------------------------------------------------------------
function Na__Sections__Work(Na__Sentences, Na__Count) {
    let Na__Work = 0;
    for (let Na__I = 0; Na__I < Na__Count; Na__I++) Na__Work += Na__Sentences[Na__I].text.length + Na__Sections__WorkPerSentence;
    return Na__Work;
}
// ------------------------------------------------------------


// FUNCTION | MakeSection - One section: plan positions [Na__First, Na__First + Na__Count)
// ------------------------------------------------------------
function Na__Sections__MakeSection(Na__Plan, Na__First, Na__Count) {
    const Na__Sentences = Na__Plan.slice(Na__First, Na__First + Na__Count);
    return {
        index     : -1,
        first     : Na__First,
        sentences : Na__Sentences,
        text      : Na__Sentences.map((Na__Sentence) => Na__Sentence.text).join(" ")
    };
}
// ------------------------------------------------------------


// FUNCTION | LongestCached - The most sentences any rendered section holds (0 if none)
// ------------------------------------------------------------
function Na__Sections__LongestCached() {
    let Na__Longest = 0;
    for (const Na__Record of Na__Sections__Cache.values()) Na__Longest = Math.max(Na__Longest, Na__Record.timing.length);
    return Na__Longest;
}
// ------------------------------------------------------------


// FUNCTION | CachedRunAt - Sentences in the longest rendered section starting at a plan position (0 if none)
// ------------------------------------------------------------
function Na__Sections__CachedRunAt(Na__Plan, Na__First, Na__To, Na__ModelId, Na__Longest) {
    for (let Na__Count = Math.min(Na__Longest, Na__To - Na__First); Na__Count > 0; Na__Count--) {
        const Na__Key = Na__TextToReader__SectionKey(Na__ModelId, { sentences: Na__Plan.slice(Na__First, Na__First + Na__Count) });
        if (Na__Sections__Cache.has(Na__Key)) return Na__Count;
    }
    return 0;
}
// ------------------------------------------------------------


// FUNCTION | SectionKey - What makes rendered audio reusable: the voice and the exact sentences
// ------------------------------------------------------------
export function Na__TextToReader__SectionKey(Na__ModelId, Na__Section) {
    return Na__ModelId + "\n" + Na__Section.sentences.map((Na__Sentence) => Na__Sentence.text).join("\n");
}
// ------------------------------------------------------------


// FUNCTION | PlanSectionRender - Which section to render next, and which to let go of first
// ------------------------------------------------------------
// Outwards from the anchor (the section being heard or waited for): the anchor itself, then
// one after, one before, two after, two before... skipping those already ready and those
// off either end. Ahead wins a tie, because the listener reaches it first.
// With Na__AheadFirst (the runway ahead of the playhead is still short) every section from the
// anchor onwards comes before any behind it: time spent behind is time the playhead gains.
// Over budget, the farthest ready section (behind wins a tie) goes to make room, but only if
// it is farther out than the one to render; otherwise there is nothing better to hold and
// rendering waits for the anchor to move.
// Returns { render, evict }, each an index or -1.
export function Na__TextToReader__PlanSectionRender(Na__Count, Na__Anchor, Na__IsReady, Na__OverBudget, Na__AheadFirst = false) {
    const Na__Centre = Math.max(0, Math.min(Na__Count - 1, Na__Anchor));
    let Na__Render = -1;

    if (Na__AheadFirst) {
        for (let Na__Index = Na__Centre; Na__Index < Na__Count; Na__Index++) {
            if (!Na__IsReady(Na__Index)) {
                Na__Render = Na__Index;
                break;
            }
        }
    }

    search:
    for (let Na__Distance = 0; Na__Render < 0 && Na__Distance < Na__Count; Na__Distance++) {
        for (const Na__Index of Na__Distance === 0 ? [Na__Centre] : [Na__Centre + Na__Distance, Na__Centre - Na__Distance]) {
            if (Na__Index >= 0 && Na__Index < Na__Count && !Na__IsReady(Na__Index)) {
                Na__Render = Na__Index;
                break search;
            }
        }
    }

    if (Na__Render < 0) return { render: -1, evict: -1 };
    if (!Na__OverBudget) return { render: Na__Render, evict: -1 };

    let Na__Evict = -1;
    let Na__EvictDistance = -1;
    for (let Na__Index = 0; Na__Index < Na__Count; Na__Index++) {
        if (!Na__IsReady(Na__Index)) continue;
        const Na__Distance = Math.abs(Na__Index - Na__Centre);
        if (Na__Distance > Na__EvictDistance || (Na__Distance === Na__EvictDistance && Na__Index < Na__Centre)) {
            Na__Evict = Na__Index;
            Na__EvictDistance = Na__Distance;
        }
    }
    return Na__EvictDistance > Math.abs(Na__Render - Na__Centre)
        ? { render: Na__Render, evict: Na__Evict }
        : { render: -1, evict: -1 };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Rendered Audio
// -----------------------------------------------------------------------------

// FUNCTION | PackSection - One rendered section as it is kept: 16-bit PCM in a Blob plus its timing
// ------------------------------------------------------------
// The timing holds only numbers (seconds from the section's start, at the voice's own pitch),
// so it can be bound to a rebuilt page later.
export function Na__TextToReader__PackSection(Na__Key, Na__Pcm, Na__SampleRate, Na__Timeline) {
    const Na__Buffer = new ArrayBuffer(Na__Pcm.length * 2);
    const Na__View = new DataView(Na__Buffer);
    for (let Na__I = 0; Na__I < Na__Pcm.length; Na__I++) {
        // Scaled by 32767 either side of zero, as the speech runtime's own WAV writer does
        Na__View.setInt16(Na__I * 2, Math.max(-1, Math.min(1, Na__Pcm[Na__I])) * 0x7fff, true);
    }
    return {
        key        : Na__Key,
        data       : new Blob([Na__Buffer]),
        sampleRate : Na__SampleRate,
        samples    : Na__Pcm.length,
        bytes      : Na__Buffer.byteLength,
        timing     : Na__Timeline.map((Na__Entry) => ({
            start      : Na__Entry.start,
            end        : Na__Entry.end,
            wordStarts : Na__Entry.wordStarts
        }))
    };
}
// ------------------------------------------------------------


// FUNCTION | SectionWav - A playable WAV for a kept section, its header written at the given rate
// ------------------------------------------------------------
// The rate is the voice's sample rate times the pitch factor: pitch and tempo move together
// and the audio element's playbackRate divides the factor back out.
export function Na__TextToReader__SectionWav(Na__Record, Na__Rate) {
    const Na__View = new DataView(new ArrayBuffer(44));
    const Na__Ascii = (Na__Offset, Na__Text) => {
        for (let Na__I = 0; Na__I < Na__Text.length; Na__I++) Na__View.setUint8(Na__Offset + Na__I, Na__Text.charCodeAt(Na__I));
    };
    Na__Ascii(0, "RIFF");
    Na__View.setUint32(4, 36 + Na__Record.bytes, true);
    Na__Ascii(8, "WAVE");
    Na__Ascii(12, "fmt ");
    Na__View.setUint32(16, 16, true);
    Na__View.setUint16(20, 1, true);              // PCM
    Na__View.setUint16(22, 1, true);              // mono
    Na__View.setUint32(24, Na__Rate, true);
    Na__View.setUint32(28, Na__Rate * 2, true);   // byte rate
    Na__View.setUint16(32, 2, true);              // block align
    Na__View.setUint16(34, 16, true);             // bits per sample
    Na__Ascii(36, "data");
    Na__View.setUint32(40, Na__Record.bytes, true);
    return new Blob([Na__View.buffer, Na__Record.data], { type: "audio/wav" });
}
// ------------------------------------------------------------


// FUNCTION | SectionTimeline - A kept section's timing bound to the page's sentences, for the highlight
// ------------------------------------------------------------
export function Na__TextToReader__SectionTimeline(Na__Record, Na__Section) {
    return Na__Section.sentences.map((Na__Sentence, Na__I) =>
        Na__TextToReader__BindSentenceTiming(Na__Sentence, Na__Record.timing[Na__I]));
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Cache
// -----------------------------------------------------------------------------

export function Na__TextToReader__SectionCacheGet(Na__Key)  { return Na__Sections__Cache.get(Na__Key); }
export function Na__TextToReader__SectionCacheHas(Na__Key)  { return Na__Sections__Cache.has(Na__Key); }
export function Na__TextToReader__SectionCachePut(Na__Record) { Na__Sections__Cache.set(Na__Record.key, Na__Record); }
export function Na__TextToReader__SectionCacheDrop(Na__Key) { Na__Sections__Cache.delete(Na__Key); }
export function Na__TextToReader__SectionCacheClear()       { Na__Sections__Cache.clear(); }


// FUNCTION | SectionCacheBytes - Rendered audio held, in bytes
// ------------------------------------------------------------
export function Na__TextToReader__SectionCacheBytes() {
    let Na__Total = 0;
    for (const Na__Record of Na__Sections__Cache.values()) Na__Total += Na__Record.bytes;
    return Na__Total;
}
// ------------------------------------------------------------


// FUNCTION | SectionCacheRetain - Keep only the sections of the document about to be read
// ------------------------------------------------------------
// Anything else belongs to another document, another voice or text that has since changed.
export function Na__TextToReader__SectionCacheRetain(Na__Keys) {
    const Na__Wanted = new Set(Na__Keys);
    for (const Na__Key of [...Na__Sections__Cache.keys()]) {
        if (!Na__Wanted.has(Na__Key)) Na__Sections__Cache.delete(Na__Key);
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
