// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - READ ALONG HIGHLIGHT
// =============================================================================
//
// PURPOSE : Wraps the rendered article into sentence and word spans, times each
//           word against the synthesised audio and highlights the sentence
//           (grey) and word (yellow) being spoken.
// TIMING  : Sentences are synthesised one by one, so their start and end are
//           exact. Phonon gives no word timestamps, so words are spread across
//           the sentence's voiced audio in proportion to their spoken length.
// =============================================================================


// REGION | State
// --------------------------------------------------------
const Na__Highlight__BlockSelector = "p,li,h1,h2,h3,h4,h5,h6,td,th,blockquote,pre,dd,dt,figcaption,caption,tr,div";
const Na__Highlight__SkipSelector = "script,style,noscript,.TTR__w";
const Na__Highlight__Abbreviations = new Set(["mr", "mrs", "ms", "dr", "st", "e.g", "i.e", "etc", "vs", "no", "approx", "inc", "ltd"]);

let Na__Highlight__Article = null;
let Na__Highlight__Audio = null;
let Na__Highlight__Timeline = null;
let Na__Highlight__Frame = 0;
let Na__Highlight__Sentence = null;
let Na__Highlight__Word = null;
let Na__Highlight__OutsideJump = null;
// endregion -------------------------------------------------------------------


// REGION | Article Wrapping
// --------------------------------------------------------

// FUNCTION | EndsSentence - A word closing on . ! ? or … that is not a known abbreviation
// --------------------------------------------------------
function Na__Highlight__EndsSentence(Na__Word) {
    if (!/[.!?…]["')\]’”]*$/.test(Na__Word)) return false;
    const Na__Bare = Na__Word.toLowerCase().replace(/^["'(\[‘“]+/, "").replace(/\.["')\]’”]*$/, "");
    return !Na__Highlight__Abbreviations.has(Na__Bare);
}
// --------------------------------------------------------


// FUNCTION | WrapArticle - Split article text into sentence pieces holding word spans
// --------------------------------------------------------
export function Na__TextToReader__WrapArticle(Na__Article) {
    Na__Highlight__Article = Na__Article;
    if (Na__Article.querySelector(".TTR__w")) return;

    const Na__Walker = document.createTreeWalker(Na__Article, NodeFilter.SHOW_TEXT, {
        acceptNode: (Na__Node) => (!Na__Node.nodeValue.trim() || Na__Node.parentElement.closest(Na__Highlight__SkipSelector))
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT
    });
    const Na__TextNodes = [];
    while (Na__Walker.nextNode()) Na__TextNodes.push(Na__Walker.currentNode);

    let Na__SentenceId = 0;
    let Na__SentenceHasWords = false;
    let Na__LastBlock = null;
    let Na__AfterSpace = true;

    for (const Na__Node of Na__TextNodes) {
        const Na__Block = Na__Node.parentElement.closest(Na__Highlight__BlockSelector);
        if (Na__Block !== Na__LastBlock && Na__SentenceHasWords) {
            Na__SentenceId++;
            Na__SentenceHasWords = false;
        }
        if (Na__Block !== Na__LastBlock) Na__AfterSpace = true;
        Na__LastBlock = Na__Block;

        // Pass 1: tokens with the sentence each word belongs to
        const Na__Tokens = Na__Node.nodeValue.split(/(\s+)/).filter(Boolean).map((Na__Text) => {
            if (/^\s+$/.test(Na__Text)) {
                Na__AfterSpace = true;
                return { Na__Text, Na__Space: true, Na__Open: Na__SentenceHasWords };
            }
            // Glued: written straight after the previous word, e.g. the stop after **bold**.
            const Na__Token = { Na__Text, Na__Space: false, Na__Sentence: Na__SentenceId, Na__Glued: !Na__AfterSpace && Na__SentenceHasWords };
            Na__AfterSpace = false;
            Na__SentenceHasWords = true;
            if (Na__Highlight__EndsSentence(Na__Text)) {
                Na__SentenceId++;
                Na__SentenceHasWords = false;
            }
            return Na__Token;
        });

        // Pass 2: spaces inside an open sentence join its piece so the grey band is unbroken
        const Na__Fragment = document.createDocumentFragment();
        let Na__Piece = null;
        for (const Na__Token of Na__Tokens) {
            if (Na__Token.Na__Space) {
                if (Na__Piece && Na__Token.Na__Open) Na__Piece.append(Na__Token.Na__Text);
                else {
                    Na__Fragment.append(Na__Token.Na__Text);
                    Na__Piece = null;
                }
                continue;
            }
            if (!Na__Piece || Na__Piece.dataset.s !== String(Na__Token.Na__Sentence)) {
                Na__Piece = document.createElement("span");
                Na__Piece.className = "TTR__s";
                Na__Piece.dataset.s = String(Na__Token.Na__Sentence);
                Na__Fragment.append(Na__Piece);
            }
            const Na__Word = document.createElement("span");
            Na__Word.className = "TTR__w";
            Na__Word.textContent = Na__Token.Na__Text;
            if (Na__Token.Na__Glued) Na__Word.dataset.g = "1";
            Na__Piece.append(Na__Word);
        }
        Na__Node.replaceWith(Na__Fragment);
    }
}
// --------------------------------------------------------


// FUNCTION | SelectedWords - The words (of those given) inside the article's current selection
// --------------------------------------------------------
function Na__Highlight__SelectedWords(Na__Article, Na__Words) {
    const Na__Selection = window.getSelection();
    if (!Na__Selection || Na__Selection.isCollapsed || Na__Selection.rangeCount === 0 ||
        !Na__Article.contains(Na__Selection.getRangeAt(0).commonAncestorContainer)) return [];
    return Na__Words.filter((Na__Word) => Na__Selection.containsNode(Na__Word, true));
}
// --------------------------------------------------------


// FUNCTION | SelectionStartWord - The first word of the selection inside the article, or null
// --------------------------------------------------------
export function Na__TextToReader__SelectionStartWord(Na__Article) {
    Na__TextToReader__WrapArticle(Na__Article);
    return Na__Highlight__SelectedWords(Na__Article, [...Na__Article.querySelectorAll(".TTR__w")])[0] || null;
}
// --------------------------------------------------------


// FUNCTION | BuildReadingPlan - Sentences to speak: the selection's words if any, else the whole article
// --------------------------------------------------------
// With Na__WholeArticle the selection is ignored: sectioned reading always plans the whole
// document, and uses the selection only to choose where to start.
export function Na__TextToReader__BuildReadingPlan(Na__Article, Na__WholeArticle = false) {
    Na__TextToReader__WrapArticle(Na__Article);
    let Na__Words = [...Na__Article.querySelectorAll(".TTR__w")];

    if (!Na__WholeArticle) {
        const Na__Selected = Na__Highlight__SelectedWords(Na__Article, Na__Words);
        if (Na__Selected.length) Na__Words = Na__Selected;
    }

    // One pass groups every sentence's pieces; asking the page per sentence is quadratic on a long document
    const Na__PiecesById = new Map();
    for (const Na__Piece of Na__Article.querySelectorAll(".TTR__s")) {
        const Na__Id = Na__Piece.dataset.s;
        if (!Na__PiecesById.has(Na__Id)) Na__PiecesById.set(Na__Id, []);
        Na__PiecesById.get(Na__Id).push(Na__Piece);
    }

    const Na__Sentences = [];
    for (const Na__Word of Na__Words) {
        const Na__Id = Na__Word.parentElement.dataset.s;
        let Na__Sentence = Na__Sentences[Na__Sentences.length - 1];
        if (!Na__Sentence || Na__Sentence.id !== Na__Id) {
            Na__Sentence = { id: Na__Id, words: [], pieces: Na__PiecesById.get(Na__Id) || [] };
            Na__Sentences.push(Na__Sentence);
        }
        Na__Sentence.words.push(Na__Word);
    }

    return Na__Sentences
        .map((Na__Sentence) => {
            const Na__Text = Na__Sentence.words
                .map((Na__Word, Na__I) => (Na__I && !Na__Word.dataset.g ? " " : "") + Na__Word.textContent)
                .join("");
            // A closing stop gives headings and list items a natural falling end and pause
            Na__Sentence.text = /[.!?:;…]["')\]’”]*$/.test(Na__Text) ? Na__Text : Na__Text + ".";
            return Na__Sentence;
        })
        .filter((Na__Sentence) => /[\p{L}\p{N}]/u.test(Na__Sentence.text));
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------


// REGION | Word Timing
// --------------------------------------------------------

// FUNCTION | VoicedSpan - First and last 10 ms window louder than a level relative to the sentence peak
// --------------------------------------------------------
function Na__Highlight__VoicedSpan(Na__Pcm, Na__SampleRate) {
    const Na__Window = Math.max(1, Math.round(Na__SampleRate / 100));
    const Na__Levels = [];
    for (let Na__I = 0; Na__I < Na__Pcm.length; Na__I += Na__Window) {
        let Na__Sum = 0;
        const Na__End = Math.min(Na__Pcm.length, Na__I + Na__Window);
        for (let Na__J = Na__I; Na__J < Na__End; Na__J++) Na__Sum += Na__Pcm[Na__J] * Na__Pcm[Na__J];
        Na__Levels.push(Math.sqrt(Na__Sum / (Na__End - Na__I)));
    }
    const Na__Threshold = Math.max(0.004, 0.08 * Math.max(0, ...Na__Levels));
    const Na__First = Na__Levels.findIndex((Na__Level) => Na__Level > Na__Threshold);
    if (Na__First < 0) return [0, Na__Pcm.length];
    let Na__Last = Na__Levels.length - 1;
    while (Na__Last > Na__First && Na__Levels[Na__Last] <= Na__Threshold) Na__Last--;
    return [Na__First * Na__Window, Math.min(Na__Pcm.length, (Na__Last + 1) * Na__Window)];
}
// --------------------------------------------------------


// FUNCTION | WordWeight - Approximate spoken length: letters, longer digits, a pause after commas
// --------------------------------------------------------
function Na__Highlight__WordWeight(Na__Text) {
    const Na__Letters = (Na__Text.match(/\p{L}/gu) || []).length;
    const Na__Digits = (Na__Text.match(/\p{N}/gu) || []).length;
    const Na__Pause = /[,;:–—]["')\]’”]*$/.test(Na__Text) ? 3 : 0;
    return 1.5 + Na__Letters + 2.5 * Na__Digits + Na__Pause;
}
// --------------------------------------------------------


// FUNCTION | SpokenWords - The sentence's words that get a highlight timing
// --------------------------------------------------------
// Punctuation glued to a word (the stop after **bold**) is not spoken: the word before keeps the highlight
function Na__Highlight__SpokenWords(Na__Sentence) {
    return Na__Sentence.words.filter((Na__Word) =>
        !(Na__Word.dataset.g && !/[\p{L}\p{N}]/u.test(Na__Word.textContent)));
}
// --------------------------------------------------------


// FUNCTION | BindSentenceTiming - Timeline entry from timing kept earlier, on the page's current elements
// --------------------------------------------------------
// The timing is { start, end, wordStarts } in seconds. Used by sectioned reading, which keeps
// rendered audio across page rebuilds and so cannot keep the elements themselves.
export function Na__TextToReader__BindSentenceTiming(Na__Sentence, Na__Timing) {
    return {
        start      : Na__Timing.start,
        end        : Na__Timing.end,
        pieces     : Na__Sentence.pieces,
        words      : Na__Highlight__SpokenWords(Na__Sentence),
        wordStarts : Na__Timing.wordStarts
    };
}
// --------------------------------------------------------


// FUNCTION | TimeSentence - Timeline entry for one synthesised sentence
// --------------------------------------------------------
export function Na__TextToReader__TimeSentence(Na__Sentence, Na__Pcm, Na__StartSample, Na__SampleRate) {
    const [Na__VoicedStart, Na__VoicedEnd] = Na__Highlight__VoicedSpan(Na__Pcm, Na__SampleRate);
    const Na__Words = Na__Highlight__SpokenWords(Na__Sentence);
    const Na__Weights = Na__Words.map((Na__Word) => Na__Highlight__WordWeight(Na__Word.textContent));
    const Na__Total = Na__Weights.reduce((Na__A, Na__B) => Na__A + Na__B, 0) || 1;
    const Na__Voiced = (Na__VoicedEnd - Na__VoicedStart) / Na__SampleRate;
    const Na__Offset = (Na__StartSample + Na__VoicedStart) / Na__SampleRate;

    let Na__Running = 0;
    const Na__WordStarts = Na__Weights.map((Na__Weight) => {
        const Na__Start = Na__Offset + Na__Voiced * Na__Running / Na__Total;
        Na__Running += Na__Weight;
        return Na__Start;
    });

    return {
        start      : Na__StartSample / Na__SampleRate,
        end        : (Na__StartSample + Na__Pcm.length) / Na__SampleRate,
        pieces     : Na__Sentence.pieces,
        words      : Na__Words,
        wordStarts : Na__WordStarts
    };
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------


// REGION | Playback Highlight
// --------------------------------------------------------

// FUNCTION | LastAtOrBefore - Index of the last start not after the time, or -1
// --------------------------------------------------------
function Na__Highlight__LastAtOrBefore(Na__Starts, Na__Time) {
    let Na__Low = 0;
    let Na__High = Na__Starts.length - 1;
    let Na__Found = -1;
    while (Na__Low <= Na__High) {
        const Na__Mid = (Na__Low + Na__High) >> 1;
        if (Na__Starts[Na__Mid] <= Na__Time) {
            Na__Found = Na__Mid;
            Na__Low = Na__Mid + 1;
        } else {
            Na__High = Na__Mid - 1;
        }
    }
    return Na__Found;
}
// --------------------------------------------------------


// FUNCTION | Show - Move the grey sentence band and yellow word to the given entries
// --------------------------------------------------------
function Na__Highlight__Show(Na__Sentence, Na__Word) {
    if (Na__Sentence !== Na__Highlight__Sentence) {
        Na__Highlight__Sentence?.pieces.forEach((Na__Piece) => Na__Piece.classList.remove("TTR__s--on"));
        Na__Sentence?.pieces.forEach((Na__Piece) => Na__Piece.classList.add("TTR__s--on"));
        Na__Highlight__Sentence = Na__Sentence;
        const Na__First = Na__Sentence?.pieces[0];
        if (Na__First) {
            const Na__Box = Na__First.getBoundingClientRect();
            if (Na__Box.top < 0 || Na__Box.bottom > window.innerHeight) {
                Na__First.scrollIntoView({ block: "center", behavior: "smooth" });
            }
        }
    }
    if (Na__Word !== Na__Highlight__Word) {
        Na__Highlight__Word?.classList.remove("TTR__w--on");
        Na__Word?.classList.add("TTR__w--on");
        Na__Highlight__Word = Na__Word;
    }
}
// --------------------------------------------------------


// FUNCTION | Update - Highlight whatever is being spoken at the audio's current time
// --------------------------------------------------------
function Na__Highlight__Update() {
    const Na__Timeline = Na__Highlight__Timeline;
    if (!Na__Timeline || !Na__Timeline.length) return;
    const Na__Time = Na__Highlight__Audio.currentTime;
    const Na__Index = Na__Highlight__LastAtOrBefore(Na__Timeline.starts, Na__Time);
    if (Na__Index < 0) {
        Na__Highlight__Show(null, null);
        return;
    }
    const Na__Sentence = Na__Timeline[Na__Index];
    const Na__WordIndex = Na__Highlight__LastAtOrBefore(Na__Sentence.wordStarts, Na__Time);
    Na__Highlight__Show(Na__Sentence, Na__WordIndex < 0 ? null : Na__Sentence.words[Na__WordIndex]);
}
// --------------------------------------------------------


// FUNCTION | Loop - Follow the audio every frame while it plays
// --------------------------------------------------------
function Na__Highlight__Loop() {
    Na__Highlight__Update();
    Na__Highlight__Frame = Na__Highlight__Audio.paused ? 0 : requestAnimationFrame(Na__Highlight__Loop);
}
// --------------------------------------------------------


// FUNCTION | SetTimeline - Attach a new timeline, or clear the highlight with null
// --------------------------------------------------------
export function Na__TextToReader__SetHighlightTimeline(Na__Timeline) {
    cancelAnimationFrame(Na__Highlight__Frame);
    Na__Highlight__Frame = 0;
    Na__Highlight__Show(null, null);
    Na__Highlight__Timeline = Na__Timeline;
    if (Na__Timeline) Na__Timeline.starts = Na__Timeline.map((Na__Entry) => Na__Entry.start);
    // Words become jump targets (hover cue, no touch callout) only while there is audio to jump in
    Na__Highlight__Article?.classList.toggle("TTR__jump-ready", Boolean(Na__Timeline));
}
// --------------------------------------------------------


// FUNCTION | HasHighlightTimeline - True while prepared audio can be jumped within
// --------------------------------------------------------
export function Na__TextToReader__HasHighlightTimeline() {
    return Boolean(Na__Highlight__Timeline && Na__Highlight__Timeline.length);
}
// --------------------------------------------------------


// FUNCTION | SetOutsideJumpHandler - Who plays a word that is not in the audio on the element
// --------------------------------------------------------
// Sectioned reading holds one section on the audio element at a time; a word in another
// section is played by the reader, which loads that section first. The handler is given the
// word and answers true when it takes the jump.
export function Na__TextToReader__SetOutsideJumpHandler(Na__Handler) {
    Na__Highlight__OutsideJump = Na__Handler;
}
// --------------------------------------------------------


// FUNCTION | PlayFromWord - Seek to the start of the word's sentence and play; false if it is not in the audio
// --------------------------------------------------------
export function Na__TextToReader__PlayFromWord(Na__Word) {
    const Na__Piece = Na__Word?.closest(".TTR__s");
    const Na__Entry = Na__Piece && Na__Highlight__Timeline?.find((Na__Candidate) => Na__Candidate.pieces.includes(Na__Piece));
    if (!Na__Entry) return Boolean(Na__Word && Na__Highlight__OutsideJump?.(Na__Word));

    Na__Highlight__Audio.currentTime = Na__Entry.start;
    Na__Highlight__Update();
    Na__Highlight__Audio.play().catch((Na__Error) => console.warn("Play from word blocked:", Na__Error));
    return true;
}
// --------------------------------------------------------


// FUNCTION | InitialiseHighlight - Bind to the audio element's playback events
// --------------------------------------------------------
export function Na__TextToReader__InitialiseHighlight(Na__Audio) {
    Na__Highlight__Audio = Na__Audio;
    Na__Audio.addEventListener("play", () => {
        cancelAnimationFrame(Na__Highlight__Frame);
        Na__Highlight__Frame = requestAnimationFrame(Na__Highlight__Loop);
    });
    Na__Audio.addEventListener("seeked", Na__Highlight__Update);
    // Coarse fallback for when animation frames are paused (hidden tab) but audio keeps playing
    Na__Audio.addEventListener("timeupdate", Na__Highlight__Update);
    Na__Audio.addEventListener("ended", () => Na__Highlight__Show(null, null));
}
// --------------------------------------------------------

// endregion -------------------------------------------------------------------
