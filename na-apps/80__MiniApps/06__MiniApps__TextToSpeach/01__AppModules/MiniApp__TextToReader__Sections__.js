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
//   - The reading plan's sentences are cut into sections of NaMiniApp__SectionSentences
//     (10). The reader picks the first section by clicking or selecting
//     in the text, renders it, plays it, and keeps rendering outwards from the section
//     being heard: the one after, the one before, two after, two before, and so on.
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

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Sections
// -----------------------------------------------------------------------------

// FUNCTION | SplitSections - Cut the reading plan into sections of a fixed number of sentences
// ------------------------------------------------------------
// Returns [{ index, first, sentences, text }]; first is the 0-based plan position of the
// section's first sentence. Na__FirstSize (optional) makes the opening section shorter, so
// reading from the top starts sooner; every later section has Na__Size sentences.
export function Na__TextToReader__SplitSections(Na__Plan, Na__Size, Na__FirstSize = Na__Size) {
    const Na__Sections = [];
    for (let Na__First = 0; Na__First < Na__Plan.length;) {
        const Na__Count = Na__Sections.length === 0 ? Na__FirstSize : Na__Size;
        const Na__Sentences = Na__Plan.slice(Na__First, Na__First + Na__Count);
        Na__Sections.push({
            index     : Na__Sections.length,
            first     : Na__First,
            sentences : Na__Sentences,
            text      : Na__Sentences.map((Na__Sentence) => Na__Sentence.text).join(" ")
        });
        Na__First += Na__Count;
    }
    return Na__Sections;
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
// Over budget, the farthest ready section (behind wins a tie) goes to make room, but only if
// it is farther out than the one to render; otherwise there is nothing better to hold and
// rendering waits for the anchor to move.
// Returns { render, evict }, each an index or -1.
export function Na__TextToReader__PlanSectionRender(Na__Count, Na__Anchor, Na__IsReady, Na__OverBudget) {
    const Na__Centre = Math.max(0, Math.min(Na__Count - 1, Na__Anchor));
    let Na__Render = -1;

    search:
    for (let Na__Distance = 0; Na__Distance < Na__Count; Na__Distance++) {
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
