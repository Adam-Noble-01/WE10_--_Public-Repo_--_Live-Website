// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - READ ALOUD
// =============================================================================
//
// FILE    : MiniApp__TextToReader__ReadAloud__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Speak the Read view with the browser's own voices, highlighting the
//           sentence and word being spoken
// CREATED : 10-Oct-2026
//
// NOTES   : Edge gives its own Read aloud voices ("Microsoft ... Online (Natural)")
//           to window.speechSynthesis, free and with no key. Edge's default voice
//           for scripts is the robotic local "George", so the voice is always
//           chosen here. Measured in Edge 154 on 10-Oct-2026:
//           - every new utterance waits 200-400 ms for the voice, so a paragraph
//             is spoken as one utterance (an 867-character one ran to its end);
//           - "word" boundary events arrive as each word is spoken, with charIndex
//             and charLength, and drive the highlights;
//           - cancel() fires "interrupted" on the utterance, and a speak() straight
//             after it plays. Speech therefore starts inside the click itself,
//             which iOS insists on.
//           Highlights use the CSS Custom Highlight API, so the article's DOM is
//           never changed.
//           Voice and speed are picked in the menu and remembered per device
//           (localStorage); the AppConfig gives the defaults. Edge on Android
//           gives pages NO voices (getVoices() is empty; reported to Microsoft in
//           2024), so there the phone's own voice reads, steered by language.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 const Na__TextToReader__ReadBlockSelector = "p, h1, h2, h3, h4, h5, h6, li, pre, blockquote, th, td, dt, dd, figcaption, caption";
 const Na__TextToReader__HighlightSentence = "ttr-read-sentence";
 const Na__TextToReader__HighlightWord     = "ttr-read-word";
 const Na__TextToReader__HighlightPaused   = "ttr-read-paused";
 const Na__TextToReader__FallbackClass     = "TTR__read-block--active";
 const Na__TextToReader__NoveltyVoice      = /eloquence|com\.apple\.speech\.synthesis|\b(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Kathy|Ralph)\b/i;
 const Na__TextToReader__FallbackErrors    = ["network", "synthesis-failed", "synthesis-unavailable", "voice-unavailable", "language-unavailable"];
 const Na__TextToReader__PrefsKey          = "NaTextToReader__ReadAloud__Prefs";   // this device's voice and speed
 const Na__TextToReader__PhoneVoicePrefix  = "lang:";                              // a voice id that is only a language
 const Na__TextToReader__RegionOrder       = ["GB", "US", "IE", "AU", "NZ", "CA", "IN", "ZA"];

 // Offered when the browser lists no voices at all (Edge on Android): the phone's
 // own voice, steered by language, which picks the accent.
 const Na__TextToReader__PhoneLanguages = [
     ["en-GB", "English (UK)"],
     ["en-US", "English (US)"],
     ["en-AU", "English (Australia)"],
     ["en-IE", "English (Ireland)"],
     ["en-IN", "English (India)"]
 ];

 let Na__TextToReader__Article             = null;
 let Na__TextToReader__Session             = null;    // the reading in progress, or null
 let Na__TextToReader__Segmenter           = null;
 let Na__TextToReader__BoundariesSeen      = false;   // the voice has proved it sends word boundaries
 let Na__TextToReader__FallbackBlock       = null;    // block lit when the Highlight API is missing
 let Na__TextToReader__LastUserScroll      = 0;
 let Na__TextToReader__LastAutoScroll      = 0;
 let Na__TextToReader__Prefs               = { Na__VoiceId: null, Na__Rate: null };
 let Na__TextToReader__RestartTimer        = 0;
 let Na__TextToReader__VoiceListeners      = [];

 const Na__TextToReader__ReadSettings = {
     Na__PreferredVoices : [],
     Na__PreferredLang   : "en-GB",
     Na__Rate            : 1,
     Na__RateMin         : 0.5,
     Na__RateMax         : 3,
     Na__RateStep        : 0.1,
     Na__Pitch           : 1,
     Na__MaxChunkChars   : 900,
     Na__FollowPauseMs   : 4000
 };

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers - Text
// -----------------------------------------------------------------------------

// FUNCTION | True when this browser can speak at all
// ------------------------------------------------------------
function Na__TextToReader__CanSpeak() {
    return typeof window !== "undefined"
        && "speechSynthesis" in window
        && typeof window.SpeechSynthesisUtterance === "function";
}
// ------------------------------------------------------------


// FUNCTION | The block a text node belongs to (the article itself for loose text)
// ------------------------------------------------------------
function Na__TextToReader__BlockOf(Na__TextNode) {
    const Na__Parent = Na__TextNode.parentElement;
    const Na__Block  = Na__Parent ? Na__Parent.closest(Na__TextToReader__ReadBlockSelector) : null;

    if (Na__Block && Na__TextToReader__Article.contains(Na__Block)) return Na__Block;
    return Na__TextToReader__Article;
}
// ------------------------------------------------------------


// FUNCTION | Collect the article's text as runs, one per block, in reading order
// ------------------------------------------------------------
// A run's text is its text nodes joined, line breaks swapped 1:1 for spaces, so an
// offset in the run maps straight back to a node and an offset inside it.
function Na__TextToReader__CollectRuns() {
    const Na__Runs = [];
    if (!Na__TextToReader__Article) return Na__Runs;

    const Na__Walker = document.createTreeWalker(
        Na__TextToReader__Article,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
    );

    let Na__Run       = null;
    let Na__AfterBreak = false;

    for (let Na__Node = Na__Walker.nextNode(); Na__Node; Na__Node = Na__Walker.nextNode()) {
        if (Na__Node.nodeType === Node.ELEMENT_NODE) {
            if (Na__Node.tagName === "BR") Na__AfterBreak = true;
            continue;
        }

        const Na__Data = Na__Node.data;
        if (!Na__Data) continue;

        const Na__Owner = Na__TextToReader__BlockOf(Na__Node);

        if (!Na__Run || Na__Run.Na__Element !== Na__Owner) {
            Na__Run = { Na__Element: Na__Owner, Na__Text: "", Na__Pieces: [] };
            Na__Runs.push(Na__Run);
        } else if (Na__AfterBreak && !/\s$/.test(Na__Run.Na__Text) && !/^\s/.test(Na__Data)) {
            Na__Run.Na__Text += " ";   // a <br> between two words: keep them apart when spoken
        }
        Na__AfterBreak = false;

        const Na__Start = Na__Run.Na__Text.length;
        Na__Run.Na__Text += Na__Data.replace(/[\r\n\t\f\v]/g, " ");
        Na__Run.Na__Pieces.push({ Na__Node, Na__Start, Na__End: Na__Run.Na__Text.length });
    }

    return Na__Runs.filter((Na__Each) => Na__Each.Na__Text.trim() !== "");
}
// ------------------------------------------------------------


// FUNCTION | Map a run offset back to a DOM text node and offset
// ------------------------------------------------------------
function Na__TextToReader__PointAt(Na__Run, Na__Offset) {
    for (const Na__Piece of Na__Run.Na__Pieces) {
        if (Na__Offset <= Na__Piece.Na__End) {
            const Na__Local = Math.max(0, Na__Offset - Na__Piece.Na__Start);
            return { Na__Node: Na__Piece.Na__Node, Na__Offset: Math.min(Na__Local, Na__Piece.Na__Node.data.length) };
        }
    }

    const Na__Last = Na__Run.Na__Pieces[Na__Run.Na__Pieces.length - 1];
    return { Na__Node: Na__Last.Na__Node, Na__Offset: Na__Last.Na__Node.data.length };
}
// ------------------------------------------------------------


// FUNCTION | A DOM Range covering run offsets [start, end)
// ------------------------------------------------------------
function Na__TextToReader__RangeFor(Na__Run, Na__Start, Na__End) {
    const Na__From  = Na__TextToReader__PointAt(Na__Run, Na__Start);
    const Na__To    = Na__TextToReader__PointAt(Na__Run, Na__End);
    const Na__Range = document.createRange();

    Na__Range.setStart(Na__From.Na__Node, Na__From.Na__Offset);
    Na__Range.setEnd(Na__To.Na__Node, Na__To.Na__Offset);
    return Na__Range;
}
// ------------------------------------------------------------


// FUNCTION | Find a DOM boundary point (from a Range) as a run index and offset
// ------------------------------------------------------------
function Na__TextToReader__Locate(Na__Runs, Na__Container, Na__Offset, Na__Side) {
    if (Na__Container.nodeType === Node.TEXT_NODE) {
        for (let Na__Index = 0; Na__Index < Na__Runs.length; Na__Index += 1) {
            const Na__Piece = Na__Runs[Na__Index].Na__Pieces.find((Na__Each) => Na__Each.Na__Node === Na__Container);
            if (Na__Piece) {
                return {
                    Na__Index,
                    Na__Offset: Na__Piece.Na__Start + Math.min(Na__Offset, Na__Container.data.length)
                };
            }
        }
    }

    // An element boundary (or a whitespace-only node): take the nearest piece on the correct side.
    const Na__Probe = document.createRange();
    try {
        Na__Probe.setStart(Na__Container, Na__Offset);
    } catch (Na__Error) {
        return null;
    }
    Na__Probe.collapse(true);

    if (Na__Side === "start") {
        for (let Na__Index = 0; Na__Index < Na__Runs.length; Na__Index += 1) {
            for (const Na__Piece of Na__Runs[Na__Index].Na__Pieces) {
                if (Na__Probe.comparePoint(Na__Piece.Na__Node, Na__Piece.Na__Node.data.length) > 0) {
                    return { Na__Index, Na__Offset: Na__Piece.Na__Start };
                }
            }
        }
        return null;
    }

    for (let Na__Index = Na__Runs.length - 1; Na__Index >= 0; Na__Index -= 1) {
        const Na__Pieces = Na__Runs[Na__Index].Na__Pieces;
        for (let Na__P = Na__Pieces.length - 1; Na__P >= 0; Na__P -= 1) {
            if (Na__Probe.comparePoint(Na__Pieces[Na__P].Na__Node, 0) < 0) {
                return { Na__Index, Na__Offset: Na__Pieces[Na__P].Na__End };
            }
        }
    }
    return null;
}
// ------------------------------------------------------------


// FUNCTION | Sentence spans inside [from, to) of a text, whitespace trimmed off each
// ------------------------------------------------------------
function Na__TextToReader__SentenceSpans(Na__Text, Na__From, Na__To) {
    const Na__Slice = Na__Text.slice(Na__From, Na__To);
    const Na__Spans = [];

    const Na__Push = (Na__Start, Na__End) => {
        while (Na__Start < Na__End && /\s/.test(Na__Slice[Na__Start])) Na__Start += 1;
        while (Na__End > Na__Start && /\s/.test(Na__Slice[Na__End - 1])) Na__End -= 1;
        if (Na__End > Na__Start) Na__Spans.push({ Na__Start: Na__From + Na__Start, Na__End: Na__From + Na__End });
    };

    if (!Na__TextToReader__Segmenter && typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
        Na__TextToReader__Segmenter = new Intl.Segmenter(Na__TextToReader__ReadSettings.Na__PreferredLang, { granularity: "sentence" });
    }

    if (!Na__TextToReader__Segmenter) {
        Na__Push(0, Na__Slice.length);   // no segmenter: the whole block is one "sentence"
        return Na__Spans;
    }

    for (const Na__Part of Na__TextToReader__Segmenter.segment(Na__Slice)) {
        Na__Push(Na__Part.index, Na__Part.index + Na__Part.segment.length);
    }
    return Na__Spans;
}
// ------------------------------------------------------------


// FUNCTION | Cut one over-long sentence at spaces so no piece passes the cap
// ------------------------------------------------------------
function Na__TextToReader__SplitLongSpan(Na__Text, Na__Span, Na__MaxChars) {
    const Na__Out = [];
    let Na__Start = Na__Span.Na__Start;

    while (Na__Span.Na__End - Na__Start > Na__MaxChars) {
        let Na__Cut = Na__Text.lastIndexOf(" ", Na__Start + Na__MaxChars);
        if (Na__Cut <= Na__Start) Na__Cut = Na__Start + Na__MaxChars;

        Na__Out.push({ Na__Start, Na__End: Na__Cut });
        Na__Start = Na__Cut;
        while (Na__Start < Na__Span.Na__End && Na__Text[Na__Start] === " ") Na__Start += 1;
    }

    if (Na__Span.Na__End > Na__Start) Na__Out.push({ Na__Start, Na__End: Na__Span.Na__End });
    return Na__Out;
}
// ------------------------------------------------------------


// FUNCTION | Group a run's sentences into utterance-sized chunks
// ------------------------------------------------------------
function Na__TextToReader__BuildChunks(Na__Run, Na__From, Na__To, Na__MaxChars) {
    const Na__Chunks = [];
    let Na__Chunk    = null;

    Na__TextToReader__SentenceSpans(Na__Run.Na__Text, Na__From, Na__To).forEach((Na__Sentence) => {
        Na__TextToReader__SplitLongSpan(Na__Run.Na__Text, Na__Sentence, Na__MaxChars).forEach((Na__Piece) => {
            if (Na__Chunk && (Na__Piece.Na__End - Na__Chunk.Na__Start) <= Na__MaxChars) {
                Na__Chunk.Na__End = Na__Piece.Na__End;
                Na__Chunk.Na__Sentences.push(Na__Piece);
                return;
            }

            Na__Chunk = { Na__Run, Na__Start: Na__Piece.Na__Start, Na__End: Na__Piece.Na__End, Na__Sentences: [Na__Piece] };
            Na__Chunks.push(Na__Chunk);
        });
    });

    return Na__Chunks;
}
// ------------------------------------------------------------


// FUNCTION | Length of the word starting at an offset (for voices without charLength)
// ------------------------------------------------------------
function Na__TextToReader__WordLength(Na__Text, Na__At) {
    const Na__Match = /^\S+/.exec(Na__Text.slice(Na__At, Na__At + 80));
    if (!Na__Match) return 0;

    const Na__Trimmed = Na__Match[0].replace(/[.,;:!?)"'\]’”]+$/, "");
    return Na__Trimmed.length > 0 ? Na__Trimmed.length : Na__Match[0].length;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers - Where To Start
// -----------------------------------------------------------------------------

// FUNCTION | True when (x, y) falls inside any of the rectangles (with a little slack)
// ------------------------------------------------------------
function Na__TextToReader__PointInRects(Na__Rects, Na__X, Na__Y, Na__Slack) {
    return Na__Rects.some((Na__Rect) =>
        Na__X >= Na__Rect.left - Na__Slack && Na__X <= Na__Rect.right + Na__Slack &&
        Na__Y >= Na__Rect.top - Na__Slack && Na__Y <= Na__Rect.bottom + Na__Slack
    );
}
// ------------------------------------------------------------


// FUNCTION | The sentence under a screen point, as a run and the sentence's start offset
// ------------------------------------------------------------
// Hit-tests sentence rectangles rather than using caret APIs, because those return
// nothing useful on phones, where the Read view's text is not selectable.
function Na__TextToReader__SentenceAtPoint(Na__Runs, Na__X, Na__Y) {
    const Na__Hit = document.elementFromPoint(Na__X, Na__Y);
    if (!Na__Hit || !Na__TextToReader__Article.contains(Na__Hit)) return null;

    const Na__Block = Na__Hit.closest(Na__TextToReader__ReadBlockSelector);
    if (!Na__Block || !Na__TextToReader__Article.contains(Na__Block)) return null;

    const Na__Candidates = Na__Runs.filter((Na__Run) =>
        Na__Run.Na__Element === Na__Block || Na__Block.contains(Na__Run.Na__Element)
    );

    let Na__LineStart = null;   // the last sentence starting at or above the point
    for (const Na__Run of Na__Candidates) {
        const Na__Spans = Na__TextToReader__SentenceSpans(Na__Run.Na__Text, 0, Na__Run.Na__Text.length);

        for (const Na__Span of Na__Spans) {
            const Na__Rects = Array.from(
                Na__TextToReader__RangeFor(Na__Run, Na__Span.Na__Start, Na__Span.Na__End).getClientRects()
            );
            if (Na__TextToReader__PointInRects(Na__Rects, Na__X, Na__Y, 2)) {
                return { Na__Run, Na__Offset: Na__Span.Na__Start };
            }
            if (Na__Rects.length > 0 && Na__Rects[0].top <= Na__Y) {
                Na__LineStart = { Na__Run, Na__Offset: Na__Span.Na__Start };
            }
        }
    }
    return Na__LineStart;
}
// ------------------------------------------------------------


// FUNCTION | The element that scrolls the article (the Read view's page container)
// ------------------------------------------------------------
function Na__TextToReader__ScrollerOf(Na__Element) {
    for (let Na__Node = Na__Element ? Na__Element.parentElement : null; Na__Node; Na__Node = Na__Node.parentElement) {
        const Na__Overflow = window.getComputedStyle(Na__Node).overflowY;
        if ((Na__Overflow === "auto" || Na__Overflow === "scroll") && Na__Node.scrollHeight > Na__Node.clientHeight) {
            return Na__Node;
        }
    }
    return document.scrollingElement || document.documentElement;
}
// ------------------------------------------------------------


// FUNCTION | The scroller's visible box in client coordinates
// ------------------------------------------------------------
function Na__TextToReader__ViewBoxOf(Na__Scroller) {
    if (Na__Scroller === document.scrollingElement || Na__Scroller === document.documentElement) {
        return { top: 0, bottom: window.innerHeight };
    }

    const Na__Rect = Na__Scroller.getBoundingClientRect();
    return { top: Math.max(0, Na__Rect.top), bottom: Math.min(window.innerHeight, Na__Rect.bottom) };
}
// ------------------------------------------------------------


// FUNCTION | A collapsed Range at a run offset (where reading will begin)
// ------------------------------------------------------------
function Na__TextToReader__CollapsedRange(Na__Run, Na__Offset) {
    return Na__TextToReader__RangeFor(Na__Run, Na__Offset, Na__Offset);
}
// ------------------------------------------------------------


// FUNCTION | "From here": the sentence under the point, else the next block down
// ------------------------------------------------------------
function Na__TextToReader__ResolvePointStart(Na__X, Na__Y) {
    const Na__Runs = Na__TextToReader__CollectRuns();
    if (Na__Runs.length === 0) return null;

    const Na__HasPoint = Number.isFinite(Na__X) && Number.isFinite(Na__Y);
    if (Na__HasPoint) {
        const Na__Hit = Na__TextToReader__SentenceAtPoint(Na__Runs, Na__X, Na__Y);
        if (Na__Hit) return Na__TextToReader__CollapsedRange(Na__Hit.Na__Run, Na__Hit.Na__Offset);
    }

    // Off the text (margins, gaps between paragraphs) or no point at all (keyboard):
    // the first block whose bottom is below the point, or below the top of the view.
    const Na__Edge = Na__HasPoint
        ? Na__Y
        : Na__TextToReader__ViewBoxOf(Na__TextToReader__ScrollerOf(Na__TextToReader__Article)).top;

    const Na__Next = Na__Runs.find((Na__Run) =>
        Na__TextToReader__RangeFor(Na__Run, 0, Na__Run.Na__Text.length).getBoundingClientRect().bottom > Na__Edge
    );
    const Na__Run   = Na__Next || Na__Runs[0];
    const Na__First = Na__Run.Na__Text.search(/\S/);

    return Na__TextToReader__CollapsedRange(Na__Run, Math.max(0, Na__First));
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers - Voice
// -----------------------------------------------------------------------------

// FUNCTION | Score a voice: named favourites, then Natural / Premium / Enhanced, then language
// ------------------------------------------------------------
function Na__TextToReader__ScoreVoice(Na__Voice) {
    const Na__Name     = Na__Voice.name || "";
    const Na__Ident    = `${Na__Name} ${Na__Voice.voiceURI || ""}`;
    const Na__Lang     = String(Na__Voice.lang || "").replace("_", "-").toLowerCase();
    const Na__Wanted   = String(Na__TextToReader__ReadSettings.Na__PreferredLang || "en-GB").toLowerCase();
    const Na__Favourite = Na__TextToReader__ReadSettings.Na__PreferredVoices.findIndex((Na__Each) =>
        Na__Each === Na__Name || Na__Each === Na__Voice.voiceURI
    );

    let Na__Score = 0;
    if (Na__Favourite >= 0)           Na__Score += 10000 - (Na__Favourite * 100);
    if (/\bNatural\b/.test(Na__Name)) Na__Score += 500;
    if (/premium/i.test(Na__Ident))   Na__Score += 300;
    else if (/enhanced/i.test(Na__Ident)) Na__Score += 200;
    if (/^Google\b/.test(Na__Name))   Na__Score += 60;

    if (Na__Lang === Na__Wanted)                                  Na__Score += 100;
    else if (Na__Lang.split("-")[0] === Na__Wanted.split("-")[0]) Na__Score += 50;
    else                                                          Na__Score -= 2000;

    if (/network|neural/i.test(Na__Ident))              Na__Score += 150;   // Android's online voices
    if (Na__TextToReader__NoveltyVoice.test(Na__Ident)) Na__Score -= 400;
    if (Na__Voice.default)                              Na__Score += 5;
    return Na__Score;
}
// ------------------------------------------------------------


// FUNCTION | A voice's id for the menu and the saved choice
// ------------------------------------------------------------
function Na__TextToReader__VoiceIdOf(Na__Voice) {
    return Na__Voice.voiceURI || Na__Voice.name;
}
// ------------------------------------------------------------


// FUNCTION | "UK", "US", "AU"... from a language tag
// ------------------------------------------------------------
function Na__TextToReader__RegionOf(Na__Lang) {
    const Na__Part = String(Na__Lang || "").replace("_", "-").split("-")[1];
    if (!Na__Part) return "";

    const Na__Code = Na__Part.toUpperCase();
    return Na__Code === "GB" ? "UK" : Na__Code;
}
// ------------------------------------------------------------


// FUNCTION | Short menu name: "Steffan (US)", "George (UK)", or the browser's own name
// ------------------------------------------------------------
function Na__TextToReader__VoiceLabel(Na__Voice) {
    const Na__Region = Na__TextToReader__RegionOf(Na__Voice.lang);
    const Na__Suffix = Na__Region ? ` (${Na__Region})` : "";

    const Na__Natural = /^Microsoft\s+(.+?)\s+Online\s+\(Natural\)/.exec(Na__Voice.name || "");
    if (Na__Natural) return `${Na__Natural[1]}${Na__Suffix}`;

    const Na__Desktop = /^Microsoft\s+(.+?)\s+-\s+/.exec(Na__Voice.name || "");
    if (Na__Desktop) return `${Na__Desktop[1]}${Na__Suffix}`;

    return Na__Voice.name || Na__Voice.lang || "Voice";
}
// ------------------------------------------------------------


// FUNCTION | Read and write this device's choices (private windows may refuse storage)
// ------------------------------------------------------------
function Na__TextToReader__LoadPrefs() {
    try {
        const Na__Saved = JSON.parse(window.localStorage.getItem(Na__TextToReader__PrefsKey) || "{}");
        return {
            Na__VoiceId : typeof Na__Saved.Na__VoiceId === "string" ? Na__Saved.Na__VoiceId : null,
            Na__Rate    : Number(Na__Saved.Na__Rate) > 0 ? Number(Na__Saved.Na__Rate) : null
        };
    } catch (Na__Error) {
        return { Na__VoiceId: null, Na__Rate: null };
    }
}

function Na__TextToReader__SavePrefs() {
    try {
        window.localStorage.setItem(Na__TextToReader__PrefsKey, JSON.stringify(Na__TextToReader__Prefs));
    } catch (Na__Error) {
        // Not stored: the choice still holds until the page closes.
    }
}
// ------------------------------------------------------------


// FUNCTION | The speed in force: this device's choice, else the AppConfig default
// ------------------------------------------------------------
function Na__TextToReader__CurrentRate() {
    const Na__Settings = Na__TextToReader__ReadSettings;
    const Na__Rate     = Na__TextToReader__Prefs.Na__Rate || Number(Na__Settings.Na__Rate) || 1;
    return Math.min(Na__Settings.Na__RateMax, Math.max(Na__Settings.Na__RateMin, Na__Rate));
}
// ------------------------------------------------------------


// FUNCTION | Language for an utterance with no voice object: the chosen phone language, else the default
// ------------------------------------------------------------
function Na__TextToReader__ChosenLang() {
    const Na__Id = Na__TextToReader__Prefs.Na__VoiceId || "";
    if (Na__Id.startsWith(Na__TextToReader__PhoneVoicePrefix)) return Na__Id.slice(Na__TextToReader__PhoneVoicePrefix.length);
    return Na__TextToReader__ReadSettings.Na__PreferredLang;
}
// ------------------------------------------------------------


// FUNCTION | The best voice on offer right now: this device's choice first (local voices only, when asked)
// ------------------------------------------------------------
function Na__TextToReader__PickVoice(Na__LocalOnly) {
    if (!Na__TextToReader__CanSpeak()) return null;

    const Na__Voices = window.speechSynthesis.getVoices() || [];
    const Na__Chosen = Na__TextToReader__Prefs.Na__VoiceId;
    if (Na__Chosen && Na__LocalOnly !== true) {
        const Na__Match = Na__Voices.find((Na__Voice) => Na__TextToReader__VoiceIdOf(Na__Voice) === Na__Chosen);
        if (Na__Match) return Na__Match;
    }

    let Na__Best      = null;
    let Na__BestScore = -Infinity;

    Na__Voices.forEach((Na__Voice) => {
        if (Na__LocalOnly === true && Na__Voice.localService === false) return;

        const Na__Score = Na__TextToReader__ScoreVoice(Na__Voice);
        if (Na__Score > Na__BestScore) {
            Na__Best      = Na__Voice;
            Na__BestScore = Na__Score;
        }
    });
    return Na__Best;
}
// ------------------------------------------------------------


// FUNCTION | Chunk cap for a voice: Chrome's online Google voices cut out after ~15 s
// ------------------------------------------------------------
function Na__TextToReader__ChunkCapFor(Na__Voice) {
    const Na__Cap = Number(Na__TextToReader__ReadSettings.Na__MaxChunkChars) || 900;
    if (Na__Voice && Na__Voice.localService === false && /^Google\b/.test(Na__Voice.name)) return Math.min(Na__Cap, 220);
    return Na__Cap;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers - Highlights And Scrolling
// -----------------------------------------------------------------------------

// FUNCTION | True when the CSS Custom Highlight API is available
// ------------------------------------------------------------
function Na__TextToReader__HasHighlightApi() {
    return typeof CSS !== "undefined" && !!CSS.highlights && typeof window.Highlight === "function";
}
// ------------------------------------------------------------


// FUNCTION | Paint (or clear, with no range) one named highlight
// ------------------------------------------------------------
function Na__TextToReader__SetHighlight(Na__Name, Na__Range) {
    if (!Na__TextToReader__HasHighlightApi()) return;

    if (Na__Range) {
        CSS.highlights.set(Na__Name, new window.Highlight(Na__Range));
    } else {
        CSS.highlights.delete(Na__Name);
    }
}
// ------------------------------------------------------------


// FUNCTION | Without the Highlight API, light the whole block being read instead
// ------------------------------------------------------------
function Na__TextToReader__SetFallbackBlock(Na__Element) {
    if (Na__TextToReader__HasHighlightApi()) return;
    if (Na__TextToReader__FallbackBlock === Na__Element) return;

    if (Na__TextToReader__FallbackBlock) Na__TextToReader__FallbackBlock.classList.remove(Na__TextToReader__FallbackClass);
    Na__TextToReader__FallbackBlock = Na__Element || null;
    if (Na__TextToReader__FallbackBlock) Na__TextToReader__FallbackBlock.classList.add(Na__TextToReader__FallbackClass);
}
// ------------------------------------------------------------


// FUNCTION | Keep the words being read on screen, unless the reader has scrolled away
// ------------------------------------------------------------
function Na__TextToReader__FollowRange(Na__Range) {
    if (Date.now() - Na__TextToReader__LastUserScroll < Na__TextToReader__ReadSettings.Na__FollowPauseMs) return;

    const Na__Rect = Na__Range.getBoundingClientRect();
    if (!Na__Rect || (Na__Rect.width === 0 && Na__Rect.height === 0)) return;

    const Na__Scroller = Na__TextToReader__ScrollerOf(Na__TextToReader__Article);
    const Na__View     = Na__TextToReader__ViewBoxOf(Na__Scroller);
    const Na__Height   = Na__View.bottom - Na__View.top;
    const Na__Margin   = Na__Height * 0.12;

    if (Na__Rect.top >= Na__View.top + Na__Margin && Na__Rect.bottom <= Na__View.bottom - Na__Margin) return;

    Na__TextToReader__LastAutoScroll = Date.now();
    Na__Scroller.scrollBy({ top: Na__Rect.top - Na__View.top - (Na__Height * 0.30), behavior: "smooth" });
}
// ------------------------------------------------------------


// FUNCTION | Light a sentence (or a whole chunk) and bring it on screen
// ------------------------------------------------------------
function Na__TextToReader__ShowSentence(Na__Session, Na__Run, Na__Span) {
    const Na__Range = Na__TextToReader__RangeFor(Na__Run, Na__Span.Na__Start, Na__Span.Na__End);

    Na__Session.Na__Sentence      = Na__Span;
    Na__Session.Na__SentenceRange = Na__Range;

    Na__TextToReader__SetHighlight(Na__TextToReader__HighlightSentence, Na__Range);
    Na__TextToReader__SetFallbackBlock(Na__Run.Na__Element);
    Na__TextToReader__FollowRange(Na__Range);
}
// ------------------------------------------------------------


// FUNCTION | Clear every reading highlight (the paused marker too, when asked)
// ------------------------------------------------------------
function Na__TextToReader__ClearHighlights(Na__AlsoPaused) {
    Na__TextToReader__SetHighlight(Na__TextToReader__HighlightSentence, null);
    Na__TextToReader__SetHighlight(Na__TextToReader__HighlightWord, null);
    if (Na__AlsoPaused === true) Na__TextToReader__SetHighlight(Na__TextToReader__HighlightPaused, null);
    Na__TextToReader__SetFallbackBlock(null);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers - Speaking
// -----------------------------------------------------------------------------

// FUNCTION | Speak the session's current chunk; its end event speaks the next
// ------------------------------------------------------------
function Na__TextToReader__SpeakChunk(Na__Session) {
    if (Na__TextToReader__Session !== Na__Session) return;

    const Na__Chunk = Na__Session.Na__Chunks[Na__Session.Na__Index];
    if (!Na__Chunk) {
        Na__TextToReader__FinishSession(Na__Session);
        return;
    }

    const Na__Run = Na__Chunk.Na__Run;
    if (!Na__Run.Na__Element.isConnected) {
        Na__TextToReader__StopReadAloud();   // the article was rendered again under us
        return;
    }

    const Na__Settings  = Na__TextToReader__ReadSettings;
    const Na__Voice     = Na__Session.Na__Voice;
    const Na__Utterance = new window.SpeechSynthesisUtterance(Na__Run.Na__Text.slice(Na__Chunk.Na__Start, Na__Chunk.Na__End));

    if (Na__Voice) Na__Utterance.voice = Na__Voice;
    Na__Utterance.lang  = Na__Voice ? Na__Voice.lang : Na__TextToReader__ChosenLang();
    Na__Utterance.rate  = Na__TextToReader__CurrentRate();
    Na__Utterance.pitch = Number(Na__Settings.Na__Pitch) || 1;

    const Na__IsLive = () => Na__TextToReader__Session === Na__Session && Na__Session.Na__Utterance === Na__Utterance;

    Na__Utterance.onstart = () => {
        if (!Na__IsLive()) return;

        // Until the voice proves it sends word boundaries, light the whole chunk.
        const Na__Span = Na__TextToReader__BoundariesSeen
            ? Na__Chunk.Na__Sentences[0]
            : { Na__Start: Na__Chunk.Na__Start, Na__End: Na__Chunk.Na__End };

        Na__TextToReader__SetHighlight(Na__TextToReader__HighlightWord, null);
        Na__TextToReader__ShowSentence(Na__Session, Na__Run, Na__Span);
    };

    Na__Utterance.onboundary = (Na__Event) => {
        if (!Na__IsLive()) return;
        if (Na__Event.name && Na__Event.name !== "word") return;

        Na__TextToReader__BoundariesSeen = true;

        const Na__At       = Na__Chunk.Na__Start + (Na__Event.charIndex || 0);
        const Na__Length   = Na__Event.charLength > 0 ? Na__Event.charLength : Na__TextToReader__WordLength(Na__Run.Na__Text, Na__At);
        const Na__Sentence = Na__Chunk.Na__Sentences.find((Na__Each) => Na__At >= Na__Each.Na__Start && Na__At < Na__Each.Na__End);

        if (Na__Sentence && Na__Sentence !== Na__Session.Na__Sentence) {
            Na__TextToReader__ShowSentence(Na__Session, Na__Run, Na__Sentence);
        }

        if (Na__Length > 0) {
            const Na__WordRange = Na__TextToReader__RangeFor(Na__Run, Na__At, Math.min(Na__At + Na__Length, Na__Chunk.Na__End));
            Na__TextToReader__SetHighlight(Na__TextToReader__HighlightWord, Na__WordRange);
            Na__TextToReader__FollowRange(Na__WordRange);   // a long sentence can run past the fold
        }
    };

    Na__Utterance.onend = () => {
        if (!Na__IsLive()) return;

        Na__Session.Na__Index += 1;
        Na__TextToReader__SpeakChunk(Na__Session);
    };

    Na__Utterance.onerror = (Na__Event) => {
        if (!Na__IsLive()) return;   // our own cancel() reports "interrupted" here

        // A Natural voice needs the internet: carry on with the best voice on this device.
        const Na__Code = Na__Event.error;
        if (Na__Voice && Na__Voice.localService === false && !Na__Session.Na__FellBack &&
            Na__TextToReader__FallbackErrors.includes(Na__Code)) {
            Na__Session.Na__FellBack = true;
            Na__Session.Na__Voice    = Na__TextToReader__PickVoice(true);
            Na__TextToReader__SpeakChunk(Na__Session);
            return;
        }

        console.warn(`Text To Reader: read aloud stopped (${Na__Code}).`);
        Na__TextToReader__StopReadAloud();
    };

    Na__Session.Na__Utterance = Na__Utterance;   // hold it: Chromium drops events for collected utterances
    window.speechSynthesis.speak(Na__Utterance);
}
// ------------------------------------------------------------


// FUNCTION | Reading reached the end on its own
// ------------------------------------------------------------
function Na__TextToReader__FinishSession(Na__Session) {
    if (Na__TextToReader__Session !== Na__Session) return;

    Na__TextToReader__Session = null;
    Na__TextToReader__ClearHighlights(true);
}
// ------------------------------------------------------------


// FUNCTION | Start again from the sentence being read, in the new voice or speed
// ------------------------------------------------------------
// An utterance's voice and rate are fixed once it starts, so a change mid-read
// restarts the current sentence. A selection still stops at its own end.
function Na__TextToReader__RestartFromCurrentSentence() {
    const Na__Session = Na__TextToReader__Session;
    if (!Na__Session) return;

    const Na__From  = Na__Session.Na__SentenceRange || Na__Session.Na__Start.Na__Range;
    const Na__Range = document.createRange();
    try {
        Na__Range.setStart(Na__From.startContainer, Na__From.startOffset);
        if (Na__Session.Na__Start.Na__Kind === "selection") {
            const Na__Whole = Na__Session.Na__Start.Na__Range;
            Na__Range.setEnd(Na__Whole.endContainer, Na__Whole.endOffset);
        }
    } catch (Na__Error) {
        return;
    }

    Na__TextToReader__StartReadAloud({ Na__Kind: Na__Session.Na__Start.Na__Kind, Na__Range });
}
// ------------------------------------------------------------


// FUNCTION | Restart once the taps stop, so five quick "+" presses restart once
// ------------------------------------------------------------
function Na__TextToReader__ScheduleRestart() {
    if (!Na__TextToReader__Session) return;

    window.clearTimeout(Na__TextToReader__RestartTimer);
    Na__TextToReader__RestartTimer = window.setTimeout(Na__TextToReader__RestartFromCurrentSentence, 450);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | Wire the reader to the article and apply config settings
// ------------------------------------------------------------
export function Na__TextToReader__InitialiseReadAloud(Na__Config) {
    const {
        article,
        settings
    } = Na__Config || {};

    Na__TextToReader__Article = article || null;

    const Na__Settings = settings || {};
    const Na__Target   = Na__TextToReader__ReadSettings;
    if (Array.isArray(Na__Settings.NaMiniApp__PreferredVoices)) Na__Target.Na__PreferredVoices = Na__Settings.NaMiniApp__PreferredVoices.slice();
    if (Na__Settings.NaMiniApp__PreferredLang)                  Na__Target.Na__PreferredLang   = Na__Settings.NaMiniApp__PreferredLang;
    if (Number(Na__Settings.NaMiniApp__Rate)  > 0)              Na__Target.Na__Rate            = Number(Na__Settings.NaMiniApp__Rate);
    if (Number(Na__Settings.NaMiniApp__Pitch) > 0)              Na__Target.Na__Pitch           = Number(Na__Settings.NaMiniApp__Pitch);
    if (Number(Na__Settings.NaMiniApp__MaxChunkChars) > 40)     Na__Target.Na__MaxChunkChars   = Number(Na__Settings.NaMiniApp__MaxChunkChars);
    if (Number(Na__Settings.NaMiniApp__FollowPauseMs) >= 0)     Na__Target.Na__FollowPauseMs   = Number(Na__Settings.NaMiniApp__FollowPauseMs);
    if (Number(Na__Settings.NaMiniApp__RateMin)  > 0)           Na__Target.Na__RateMin         = Number(Na__Settings.NaMiniApp__RateMin);
    if (Number(Na__Settings.NaMiniApp__RateMax)  > 0)           Na__Target.Na__RateMax         = Number(Na__Settings.NaMiniApp__RateMax);
    if (Number(Na__Settings.NaMiniApp__RateStep) > 0)           Na__Target.Na__RateStep        = Number(Na__Settings.NaMiniApp__RateStep);

    Na__TextToReader__Prefs = Na__TextToReader__LoadPrefs();

    if (!Na__TextToReader__Article || !Na__TextToReader__CanSpeak()) return false;

    // Voices load asynchronously (Edge's Natural voices after its local ones; on
    // Android perhaps only after the first speech): ask now, and tell the menu
    // whenever the list changes.
    const Na__Synth  = window.speechSynthesis;
    const Na__Notify = () => {
        Na__TextToReader__VoiceListeners.forEach((Na__Listener) => {
            try {
                Na__Listener();
            } catch (Na__Error) {
                console.warn("Text To Reader: voice list listener failed.", Na__Error);
            }
        });
    };
    if (typeof Na__Synth.addEventListener === "function") {
        Na__Synth.addEventListener("voiceschanged", Na__Notify);
    } else {
        Na__Synth.onvoiceschanged = Na__Notify;
    }

    Na__Synth.cancel();   // a reload can inherit speech still playing
    Na__Synth.getVoices();

    // A scroll we did not start means the reader is looking elsewhere: stop following for a while.
    document.addEventListener("scroll", () => {
        if (Date.now() - Na__TextToReader__LastAutoScroll > 1200) Na__TextToReader__LastUserScroll = Date.now();
    }, { capture: true, passive: true });
    ["wheel", "touchmove"].forEach((Na__Type) => {
        document.addEventListener(Na__Type, () => { Na__TextToReader__LastUserScroll = Date.now(); }, { capture: true, passive: true });
    });

    window.addEventListener("pagehide", () => {
        if (Na__TextToReader__Session) window.speechSynthesis.cancel();
    });

    return true;
}
// ------------------------------------------------------------


// FUNCTION | True when the article holds anything to read
// ------------------------------------------------------------
export function Na__TextToReader__HasReadableText() {
    return !!Na__TextToReader__Article && Na__TextToReader__Article.textContent.trim() !== "";
}
// ------------------------------------------------------------


// FUNCTION | Fix where Read aloud will start: the selection under the point, else "from here"
// ------------------------------------------------------------
// Resolved when the menu opens and held as a live Range, so later scrolling, focus
// changes or a click that clears the selection cannot move it.
export function Na__TextToReader__ResolveReadStart(Na__X, Na__Y, Na__AllowSelection) {
    if (!Na__TextToReader__Article) return null;

    if (Na__AllowSelection !== false) {
        const Na__Selected = Na__TextToReader__GetReadableSelection(Na__X, Na__Y);
        if (Na__Selected) return { Na__Kind: "selection", Na__Range: Na__Selected };
    }

    const Na__Point = Na__TextToReader__ResolvePointStart(Na__X, Na__Y);
    return Na__Point ? { Na__Kind: "point", Na__Range: Na__Point } : null;
}
// ------------------------------------------------------------


// FUNCTION | The article selection, clipped to the article, if the point is on it
// ------------------------------------------------------------
export function Na__TextToReader__GetReadableSelection(Na__X, Na__Y) {
    const Na__Selection = window.getSelection ? window.getSelection() : null;
    if (!Na__Selection || Na__Selection.rangeCount === 0 || Na__Selection.isCollapsed) return null;

    const Na__Range = Na__Selection.getRangeAt(0);
    if (!Na__Range.intersectsNode(Na__TextToReader__Article)) return null;

    if (Number.isFinite(Na__X) && Number.isFinite(Na__Y)) {
        if (!Na__TextToReader__PointInRects(Array.from(Na__Range.getClientRects()), Na__X, Na__Y, 3)) return null;
    }

    const Na__Clipped = Na__Range.cloneRange();
    const Na__Whole   = document.createRange();
    Na__Whole.selectNodeContents(Na__TextToReader__Article);

    if (Na__Clipped.compareBoundaryPoints(Range.START_TO_START, Na__Whole) < 0) {
        Na__Clipped.setStart(Na__Whole.startContainer, Na__Whole.startOffset);
    }
    if (Na__Clipped.compareBoundaryPoints(Range.END_TO_END, Na__Whole) > 0) {
        Na__Clipped.setEnd(Na__Whole.endContainer, Na__Whole.endOffset);
    }

    return Na__Clipped.toString().trim() ? Na__Clipped : null;
}
// ------------------------------------------------------------


// FUNCTION | Start reading from a resolved start (a selection reads only itself)
// ------------------------------------------------------------
// Call straight from the click: iOS will not start speech outside a user gesture.
export function Na__TextToReader__StartReadAloud(Na__Start) {
    if (!Na__Start || !Na__Start.Na__Range || !Na__TextToReader__CanSpeak()) return false;

    const Na__Range = Na__Start.Na__Range;
    if (!Na__TextToReader__Article.contains(Na__Range.startContainer)) return false;   // rendered again since

    const Na__Runs = Na__TextToReader__CollectRuns();
    if (Na__Runs.length === 0) return false;

    const Na__LastRun = Na__Runs[Na__Runs.length - 1];
    const Na__From    = Na__TextToReader__Locate(Na__Runs, Na__Range.startContainer, Na__Range.startOffset, "start");
    const Na__To      = Na__Start.Na__Kind === "selection"
        ? Na__TextToReader__Locate(Na__Runs, Na__Range.endContainer, Na__Range.endOffset, "end")
        : { Na__Index: Na__Runs.length - 1, Na__Offset: Na__LastRun.Na__Text.length };

    if (!Na__From || !Na__To || Na__To.Na__Index < Na__From.Na__Index) return false;

    const Na__Voice  = Na__TextToReader__PickVoice(false);
    const Na__Cap    = Na__TextToReader__ChunkCapFor(Na__Voice);
    const Na__Chunks = [];

    for (let Na__Index = Na__From.Na__Index; Na__Index <= Na__To.Na__Index; Na__Index += 1) {
        const Na__Run   = Na__Runs[Na__Index];
        const Na__Begin = Na__Index === Na__From.Na__Index ? Na__From.Na__Offset : 0;
        const Na__End   = Na__Index === Na__To.Na__Index   ? Na__To.Na__Offset   : Na__Run.Na__Text.length;

        if (Na__End > Na__Begin) Na__Chunks.push(...Na__TextToReader__BuildChunks(Na__Run, Na__Begin, Na__End, Na__Cap));
    }
    if (Na__Chunks.length === 0) return false;

    // Replace any reading in progress. The old session is dropped before cancel(),
    // so its "interrupted" error is ignored.
    Na__TextToReader__Session = null;
    window.clearTimeout(Na__TextToReader__RestartTimer);
    window.speechSynthesis.cancel();
    Na__TextToReader__ClearHighlights(true);

    const Na__Session = {
        Na__Start,
        Na__Chunks,
        Na__Index         : 0,
        Na__Voice,
        Na__Utterance     : null,
        Na__Sentence      : null,
        Na__SentenceRange : null,
        Na__FellBack      : false
    };

    Na__TextToReader__Session        = Na__Session;
    Na__TextToReader__LastUserScroll = 0;   // follow the reading from the start
    Na__TextToReader__SpeakChunk(Na__Session);
    return true;
}
// ------------------------------------------------------------


// FUNCTION | Stop reading; the sentence it was on stays marked as a place to carry on from
// ------------------------------------------------------------
export function Na__TextToReader__StopReadAloud() {
    const Na__Session = Na__TextToReader__Session;
    Na__TextToReader__Session = null;

    if (Na__TextToReader__CanSpeak()) window.speechSynthesis.cancel();

    Na__TextToReader__ClearHighlights(true);
    if (Na__Session && Na__Session.Na__SentenceRange) {
        Na__TextToReader__SetHighlight(Na__TextToReader__HighlightPaused, Na__Session.Na__SentenceRange);
    }
}
// ------------------------------------------------------------


// FUNCTION | Stop and forget the place (the article is about to change or hide)
// ------------------------------------------------------------
export function Na__TextToReader__ResetReadAloud() {
    const Na__WasReading = Na__TextToReader__Session !== null;
    Na__TextToReader__Session = null;

    if (Na__WasReading && Na__TextToReader__CanSpeak()) window.speechSynthesis.cancel();
    Na__TextToReader__ClearHighlights(true);
}
// ------------------------------------------------------------


// FUNCTION | True while reading is in progress
// ------------------------------------------------------------
export function Na__TextToReader__IsReadingAloud() {
    return Na__TextToReader__Session !== null;
}
// ------------------------------------------------------------


// FUNCTION | Voices for the menu, grouped, with the one that will read selected
// ------------------------------------------------------------
// Groups: "natural" (Microsoft Natural - Edge on a computer), "device" (voices of
// this computer or phone) and, only when the browser lists none at all (Edge on
// Android), "phone": the phone's own voice by language.
export function Na__TextToReader__GetReadAloudVoiceOptions() {
    const Na__Voices  = Na__TextToReader__CanSpeak() ? (window.speechSynthesis.getVoices() || []) : [];
    const Na__Wanted  = String(Na__TextToReader__ReadSettings.Na__PreferredLang || "en-GB").split("-")[0].toLowerCase();
    const Na__Natural = [];
    const Na__Device  = [];

    Na__Voices.forEach((Na__Voice) => {
        const Na__Lang = String(Na__Voice.lang || "").replace("_", "-");
        if (Na__Lang.split("-")[0].toLowerCase() !== Na__Wanted) return;
        if (Na__TextToReader__NoveltyVoice.test(`${Na__Voice.name} ${Na__Voice.voiceURI || ""}`)) return;

        const Na__Entry = {
            Na__Id     : Na__TextToReader__VoiceIdOf(Na__Voice),
            Na__Label  : Na__TextToReader__VoiceLabel(Na__Voice),
            Na__Region : (Na__Lang.split("-")[1] || "").toUpperCase()   // GB, US... for the sort order
        };
        (/\bNatural\b/.test(Na__Voice.name || "") ? Na__Natural : Na__Device).push(Na__Entry);
    });

    const Na__Rank = (Na__Region) => {
        const Na__At = Na__TextToReader__RegionOrder.indexOf(Na__Region);
        return Na__At >= 0 ? Na__At : Na__TextToReader__RegionOrder.length;
    };
    const Na__Sort = (Na__List) => Na__List.sort((Na__A, Na__B) =>
        (Na__Rank(Na__A.Na__Region) - Na__Rank(Na__B.Na__Region)) ||
        Na__A.Na__Region.localeCompare(Na__B.Na__Region) ||
        Na__A.Na__Label.localeCompare(Na__B.Na__Label)
    );

    const Na__Groups = [];
    if (Na__Natural.length > 0) Na__Groups.push({ Na__Key: "natural", Na__Options: Na__Sort(Na__Natural) });
    if (Na__Device.length > 0)  Na__Groups.push({ Na__Key: "device",  Na__Options: Na__Sort(Na__Device) });

    if (Na__Groups.length > 0) {
        const Na__Picked = Na__TextToReader__PickVoice(false);
        const Na__Listed = Na__Groups.some((Na__Group) => Na__Group.Na__Options.some((Na__Option) =>
            Na__Picked && Na__Option.Na__Id === Na__TextToReader__VoiceIdOf(Na__Picked)
        ));
        return {
            Na__Groups,
            Na__SelectedId : Na__Listed ? Na__TextToReader__VoiceIdOf(Na__Picked) : Na__Groups[0].Na__Options[0].Na__Id
        };
    }

    const Na__Phone = Na__TextToReader__PhoneLanguages.map(([Na__Lang, Na__Label]) => ({
        Na__Id    : `${Na__TextToReader__PhoneVoicePrefix}${Na__Lang}`,
        Na__Label
    }));
    const Na__Lang  = Na__TextToReader__ChosenLang();
    if (!Na__Phone.some((Na__Option) => Na__Option.Na__Id === `${Na__TextToReader__PhoneVoicePrefix}${Na__Lang}`)) {
        Na__Phone.unshift({ Na__Id: `${Na__TextToReader__PhoneVoicePrefix}${Na__Lang}`, Na__Label: Na__Lang });
    }

    return {
        Na__Groups     : [{ Na__Key: "phone", Na__Options: Na__Phone }],
        Na__SelectedId : `${Na__TextToReader__PhoneVoicePrefix}${Na__Lang}`
    };
}
// ------------------------------------------------------------


// FUNCTION | Choose the voice (an id from the menu), remember it, apply it at once
// ------------------------------------------------------------
export function Na__TextToReader__SetReadAloudVoice(Na__Id) {
    Na__TextToReader__Prefs.Na__VoiceId = Na__Id ? String(Na__Id) : null;
    Na__TextToReader__SavePrefs();
    Na__TextToReader__ScheduleRestart();
}
// ------------------------------------------------------------


// FUNCTION | The speed in force, and its limits for the menu's - and + buttons
// ------------------------------------------------------------
export function Na__TextToReader__GetReadAloudRate() {
    return Na__TextToReader__CurrentRate();
}

export function Na__TextToReader__GetReadAloudRateLimits() {
    return {
        Na__Min : Na__TextToReader__ReadSettings.Na__RateMin,
        Na__Max : Na__TextToReader__ReadSettings.Na__RateMax
    };
}
// ------------------------------------------------------------


// FUNCTION | One step slower (-1) or faster (+1); remembered and applied at once
// ------------------------------------------------------------
export function Na__TextToReader__StepReadAloudRate(Na__Direction) {
    const Na__Settings = Na__TextToReader__ReadSettings;
    const Na__Next     = Math.round((Na__TextToReader__CurrentRate() + (Na__Direction * Na__Settings.Na__RateStep)) * 100) / 100;

    Na__TextToReader__Prefs.Na__Rate = Math.min(Na__Settings.Na__RateMax, Math.max(Na__Settings.Na__RateMin, Na__Next));
    Na__TextToReader__SavePrefs();
    Na__TextToReader__ScheduleRestart();
    return Na__TextToReader__Prefs.Na__Rate;
}
// ------------------------------------------------------------


// FUNCTION | Call back whenever the browser's voice list changes
// ------------------------------------------------------------
export function Na__TextToReader__OnReadAloudVoicesChanged(Na__Callback) {
    if (typeof Na__Callback === "function") Na__TextToReader__VoiceListeners.push(Na__Callback);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
