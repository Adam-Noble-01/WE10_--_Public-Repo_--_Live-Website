// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - PDF RENDERER
// =============================================================================
//
// FILE    : MiniApp__TextToReader__PdfRenderer__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Read a PDF into one continuous Markdown article for the Read view
// CREATED : 18-Nov-2026
//
// PDF.js (pdfjs-dist, pinned, served from 04__PdfJsRuntime) gives each page's text
// items. They are rebuilt here into lines, columns, tables, headings, paragraphs and
// lists. Running headers, footers and page numbers are dropped, line-end hyphens
// rejoined, and paragraphs that cross a page break joined, so a multipage PDF reads as
// one endless article in the reader's own typography, not as page images. Pages are
// marked only by invisible <!-- Page n --> comments, which read-aloud never sees.
//
// Formatting carried over: tables (GFM, in the house table style), bold, italic and
// monospaced runs (from the embedded font names), links, rules, small capital labels,
// quotes, and boxed or zoned two-column blocks, each column read in turn.
//
// Pages with no usable text (scans, or text in a broken font encoding) are drawn to
// a canvas and handed to the OCR module (MiniApp__TextToReader__PdfOcr__.js, OCR
// contract v1) once its model is on the device; the controller asks first. OCR
// lines go through the same reflow, with the box height standing for font size.
//
// The reflow functions are pure (no DOM, no PDF.js), so node can test them.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module-Level Variables
// -----------------------------------------------------------------------------

 // Defaults; AppConfig NaMiniApp__Pdf overrides each one
 const Na__Pdf__Defaults = {
     NaMiniApp__RuntimeUrl        : "./04__PdfJsRuntime/",
     NaMiniApp__RuntimeVersion    : "6.5.438",
     NaMiniApp__MinUsableChars    : 25,      // fewer letters, digits and punctuation: no text layer
     NaMiniApp__MaxGarbageRatio   : 0.3,     // more private-use / U+FFFD / control characters: broken encoding
     NaMiniApp__MinImageCoverage  : 0.3,     // a page this much covered by images, short of text, is a scan
     NaMiniApp__HeaderFooterBand  : 0.08,    // top and bottom share of the page searched for running lines
     NaMiniApp__PartialEveryMs    : 1500     // long PDFs show what is read so far at most this often
 };

 // The OCR module (WORKER__PdfOcr), loaded only when a PDF has scanned pages
 const Na__Pdf__OcrModuleUrl = "./MiniApp__TextToReader__PdfOcr__.js";

 let Na__Pdf__LibraryPromise = null;

 const Na__Pdf__GoodChar   = /[\p{L}\p{N}\p{P}]/u;
 const Na__Pdf__BadChar    = /[\u{E000}-\u{F8FF}\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}\uFFFD\u0000-\u0008\u000E-\u001F]/u;
 const Na__Pdf__Bullet     = /^(?:[\u2022\u25CF\u25AA\u25E6\u2023\u2219\u00B7\u25A0\u25A1\u25BA\u27A2\u2713\u2013\u2014*\-]\s+|[\uF0B7\uF0A7\uF0D8\uF076\uF0FC\uF0AD\uF06E\uF0A8\uF0E0]\s*)(.+)$/u;   // Symbol / Wingdings bullets arrive as private-use characters
 const Na__Pdf__Numbered   = /^(\d{1,3})[.)]\s+(.+)$/;
 const Na__Pdf__Lettered   = /^(\((?:[a-zA-Z]|[ivxIVX]{1,4}|\d{1,2})\)|[a-z][.)]|[ivx]{2,5}[.)])\s+(.+)$/;   // lower-case only when bare: "A. Client" is a name's initial
 const Na__Pdf__PageNumber = /^(?:(?:page|pg\.?|p\.)\s*)?(?:\d{1,4}|[ivxlc]{1,7})(?:\s*(?:of|\/)\s*\d{1,4})?$/i;
 const Na__Pdf__DashedNum  = /^[-\u2013\u2014]\s*\d{1,4}\s*[-\u2013\u2014]$/;
 const Na__Pdf__JoiningEnd = /\b(the|of|and|or|to|a|an|in|for|with|by|on|at|as|from)$/i;

 // A list marker or paragraph number standing on its own, a tab or a wide gap before its text
 // ("1." ... "The site", "3.8" ... "As a result")
 const Na__Pdf__MarkerOnly = /^(?:\d{1,3}[.)]|\d{1,3}(?:\.\d{1,3}){1,3}\.?|\((?:[a-zA-Z]|[ivxIVX]{1,4}|\d{1,2})\)|[a-z][.)]|[ivx]{2,5}[.)]|[\u2022\u25CF\u25AA\u25E6\u2023\u2219\u00B7\u25A0\u25A1\u25BA\u27A2\u2713\u2013\u2014*\-]|[\uF0B7\uF0A7\uF0D8\uF076\uF0FC\uF0AD\uF06E\uF0A8\uF0E0])$/u;

 // Inline styles ride in a block's "rich" text as state marks: private-use characters the
 // PDF's own text never keeps (they are stripped from it first). A mark sets the style from
 // there on, so cutting a list marker off the front never leaves anything unbalanced.
 //   E000 plain, E001 bold, E002 italic, E003 bold italic, E004 monospaced;
 //   E005 <link number> E006 opens a link (Na__Pdf__Links), E007 closes it
 const Na__Pdf__Mark      = ["\uE000", "\uE001", "\uE002", "\uE003", "\uE004"];
 const Na__Pdf__MarkChars = /[\uE000-\uE007]/g;
 const Na__Pdf__Wrap      = ["", "**", "*", "***", "`"];

 // Links found on the document's pages; rich text refers to them by number
 let Na__Pdf__Links = [];

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers - Text
// -----------------------------------------------------------------------------

// FUNCTION | EndsSentence - True when a line or paragraph finishes a sentence
// ------------------------------------------------------------
function Na__Pdf__EndsSentence(Na__Text) {
    return /[.!?\u2026:]["'\u201D\u2019)\]]*$/.test(Na__Text);
}
// ------------------------------------------------------------


// FUNCTION | WordCount - Words in a run of text
// ------------------------------------------------------------
function Na__Pdf__WordCount(Na__Text) {
    return (Na__Text.match(/[\p{L}\p{N}][\p{L}\p{N}'\u2019.,%-]*/gu) || []).length;
}
// ------------------------------------------------------------


// FUNCTION | JoinMode - How two runs of text join, rejoining a word split by a line-end hyphen
// ------------------------------------------------------------
// "inter-" + "national" gives "international"; "Anglo-" + "Saxon" keeps its hyphen, and so
// does "plan-" + "making" when the document writes "plan-making" elsewhere (Na__Compounds,
// set while a document is assembled); a soft hyphen (U+00AD) always goes.
let Na__Pdf__Compounds = new Set();

function Na__Pdf__JoinMode(Na__Before, Na__After) {
    if (!Na__Before || !Na__After) return "direct";
    if (/\u00AD$/.test(Na__Before)) return "soft";
    if (/\p{L}-$/u.test(Na__Before)) {
        if (/^\p{Lu}/u.test(Na__After)) return "direct";
        if (/^\p{Ll}/u.test(Na__After)) {
            const Na__Left  = (Na__Before.match(/(\p{L}+)-$/u) || [])[1] || "";
            const Na__Right = (Na__After.match(/^\p{L}+/u) || [])[0] || "";
            if (Na__Pdf__Compounds.has((Na__Left + "-" + Na__Right).toLowerCase())) return "direct";
            return "hyphen";
        }
    }
    return "space";
}
// ------------------------------------------------------------


// FUNCTION | JoinPair - Join a plain run and its rich twin the same way
// ------------------------------------------------------------
// Returns [plain, rich]. The hyphen to drop is the rich text's last one: style marks only
// ever stand before runs, so its tail is the same text as the plain one's.
function Na__Pdf__JoinPair(Na__Text, Na__Rich, Na__AddText, Na__AddRich) {
    if (!Na__Text) return [Na__AddText, Na__AddRich];
    if (!Na__AddText) return [Na__Text, Na__Rich];
    const Na__Mode = Na__Pdf__JoinMode(Na__Text, Na__AddText);
    const Na__DropLast = (Na__Char) => {
        const Na__At = Na__Rich.lastIndexOf(Na__Char);
        return Na__At >= 0 ? Na__Rich.slice(0, Na__At) + Na__Rich.slice(Na__At + 1) : Na__Rich;
    };
    if (Na__Mode === "soft")   return [Na__Text.slice(0, -1) + Na__AddText, Na__DropLast("\u00AD") + Na__AddRich];
    if (Na__Mode === "hyphen") return [Na__Text.slice(0, -1) + Na__AddText, Na__DropLast("-") + Na__AddRich];
    if (Na__Mode === "direct") return [Na__Text + Na__AddText, Na__Rich + Na__AddRich];
    return [Na__Text + " " + Na__AddText, Na__Rich + " " + Na__AddRich];
}
// ------------------------------------------------------------


// FUNCTION | JoinText - Join two plain runs of text
// ------------------------------------------------------------
function Na__Pdf__JoinText(Na__Before, Na__After) {
    return Na__Pdf__JoinPair(Na__Before, Na__Before, Na__After, Na__After)[0];
}
// ------------------------------------------------------------


// FUNCTION | ContinuesAcrossPage - Whether the next page's first paragraph carries on the last one
// ------------------------------------------------------------
function Na__Pdf__ContinuesAcrossPage(Na__Before, Na__After) {
    if (Na__Pdf__EndsSentence(Na__Before)) return false;
    return /^[\p{Ll}\p{N}]/u.test(Na__After) || /\p{L}-$/u.test(Na__Before) || /[,;]$/.test(Na__Before);
}
// ------------------------------------------------------------


// FUNCTION | JoinBlock - Add a line's text to a block, plain and rich together
// ------------------------------------------------------------
function Na__Pdf__JoinBlock(Na__Block, Na__Text, Na__Rich) {
    [Na__Block.text, Na__Block.rich] = Na__Pdf__JoinPair(Na__Block.text, Na__Block.rich, Na__Text, Na__Rich);
}
// ------------------------------------------------------------


// FUNCTION | RichSkip - A rich text with its plain prefix (a list marker) cut off, its style kept
// ------------------------------------------------------------
function Na__Pdf__RichSkip(Na__Rich, Na__Prefix) {
    let Na__Need = Na__Prefix.replace(/\s+/g, "").length;
    let Na__Kept = "";
    let Na__Index = 0;
    while (Na__Index < Na__Rich.length && Na__Need > 0) {
        const Na__Char = Na__Rich[Na__Index];
        if (Na__Char >= "\uE000" && Na__Char <= "\uE004") Na__Kept = Na__Kept.replace(/[\uE000-\uE004]/g, "") + Na__Char;
        else if (Na__Char === "\uE005") {
            const Na__End = Na__Rich.indexOf("\uE006", Na__Index);
            Na__Kept += Na__Rich.slice(Na__Index, Na__End + 1);
            Na__Index = Na__End;
        } else if (Na__Char === "\uE007") Na__Kept = Na__Kept.replace(/\uE005\d*\uE006/g, "");
        else if (!/\s/.test(Na__Char)) Na__Need--;
        Na__Index++;
    }
    while (Na__Index < Na__Rich.length && /\s/.test(Na__Rich[Na__Index])) Na__Index++;
    return Na__Kept + Na__Rich.slice(Na__Index);
}
// ------------------------------------------------------------


// FUNCTION | EscapeInline - Text that must read as written, never as Markdown or HTML
// ------------------------------------------------------------
function Na__Pdf__EscapeInline(Na__Text) {
    return Na__Text.replace(/([\\`*_[\]<>|~])/g, "\\$1");
}
// ------------------------------------------------------------


// FUNCTION | EscapeLineStart - Stop a line's first characters starting a block (list, heading, rule)
// ------------------------------------------------------------
function Na__Pdf__EscapeLineStart(Na__Text) {
    if (/^\d{1,9}[.)](\s|$)/.test(Na__Text)) return Na__Text.replace(/[.)]/, "\\$&");
    if (/^[#+=-]/.test(Na__Text)) return "\\" + Na__Text;
    return Na__Text;
}
// ------------------------------------------------------------


// FUNCTION | EscapeParagraph - Plain text as a paragraph, every line safe to start with
// ------------------------------------------------------------
function Na__Pdf__EscapeParagraph(Na__Text) {
    return Na__Pdf__EscapeInline(Na__Text).split("\n").map(Na__Pdf__EscapeLineStart).join("  \n");
}
// ------------------------------------------------------------


// FUNCTION | RichMarkdown - Rich text (plain text with style marks) as inline Markdown
// ------------------------------------------------------------
// Styled runs get tight markers (spaces stay outside them); a run of punctuation alone takes
// none; monospaced runs become code spans; links become [text](url). A long block wholly in
// one style is written plain: that is the document's body style, not emphasis.
function Na__Pdf__RichMarkdown(Na__Rich, Na__Paragraph) {
    const Na__Runs = [];
    let Na__Style = 0;
    let Na__Link = -1;
    let Na__Buffer = "";
    const Na__Flush = () => {
        if (!Na__Buffer) return;
        const Na__Last = Na__Runs[Na__Runs.length - 1];
        if (Na__Last && Na__Last.style === Na__Style && Na__Last.link === Na__Link) Na__Last.text += Na__Buffer;
        else Na__Runs.push({ style: Na__Style, link: Na__Link, text: Na__Buffer });
        Na__Buffer = "";
    };
    for (let Na__Index = 0; Na__Index < Na__Rich.length; Na__Index++) {
        const Na__Char = Na__Rich[Na__Index];
        if (Na__Char >= "\uE000" && Na__Char <= "\uE004") {
            Na__Flush();
            Na__Style = Na__Char.charCodeAt(0) - 0xE000;
        } else if (Na__Char === "\uE005") {
            Na__Flush();
            const Na__End = Na__Rich.indexOf("\uE006", Na__Index);
            Na__Link = Number(Na__Rich.slice(Na__Index + 1, Na__End));
            Na__Index = Na__End;
        } else if (Na__Char === "\uE007") {
            Na__Flush();
            Na__Link = -1;
        } else {
            Na__Buffer += Na__Char;
        }
    }
    Na__Flush();

    const Na__Wordy = Na__Runs.filter((Na__Run) => /[\p{L}\p{N}]/u.test(Na__Run.text));
    const Na__Length = Na__Runs.reduce((Na__Sum, Na__Run) => Na__Sum + Na__Run.text.length, 0);
    const Na__AllOne = Na__Wordy.length > 0 && Na__Wordy[0].style !== 4 &&
        Na__Wordy.every((Na__Run) => Na__Run.style === Na__Wordy[0].style) && Na__Length > 200;

    const Na__Write = (Na__Run) => {
        const Na__Style2 = Na__AllOne || !/[\p{L}\p{N}]/u.test(Na__Run.text) ? 0 : Na__Run.style;
        const Na__Lead  = (Na__Run.text.match(/^\s*/) || [""])[0];
        const Na__Trail = Na__Run.text.trim() ? (Na__Run.text.match(/\s*$/) || [""])[0] : "";
        const Na__Core  = Na__Run.text.trim();
        let Na__Inner = "";
        if (Na__Core && Na__Style2 === 4) {
            const Na__Ticks = /`/.test(Na__Core) ? "``" : "`";
            Na__Inner = Na__Ticks.length > 1 ? Na__Ticks + " " + Na__Core + " " + Na__Ticks : "`" + Na__Core + "`";
        } else if (Na__Core) {
            const Na__Escaped = Na__Pdf__EscapeInline(Na__Core);
            Na__Inner = Na__Pdf__Wrap[Na__Style2] + Na__Escaped + Na__Pdf__Wrap[Na__Style2];
        }
        const Na__Url = Na__Run.link >= 0 ? Na__Pdf__Links[Na__Run.link] : "";
        if (Na__Inner && Na__Url) Na__Inner = "[" + Na__Inner + "](" + Na__Url.replace(/[()\s<>]/g, encodeURIComponent) + ")";
        return Na__Lead + Na__Inner + Na__Trail;
    };

    // Runs are written line by line, so no marker ever spans a line break
    let Na__Out = "";
    for (const Na__Run of Na__Runs) {
        Na__Out += Na__Run.text.split("\n").map((Na__Part) => Na__Write({ ...Na__Run, text: Na__Part })).join("\n");
    }
    return Na__Out.split("\n")
        .map((Na__Line) => Na__Line.replace(/[ \t]+/g, " ").trim())
        .map((Na__Line) => (Na__Paragraph ? Na__Pdf__EscapeLineStart(Na__Line) : Na__Line))
        .join("  \n");
}
// ------------------------------------------------------------


// FUNCTION | NormaliseRunningKey - A line's text with its numbers blanked, to spot running heads
// ------------------------------------------------------------
function Na__Pdf__NormaliseRunningKey(Na__Text) {
    return Na__Text.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();
}
// ------------------------------------------------------------


// FUNCTION | FontStyle - A font name's style number: 0 plain, 1 bold, 2 italic, 3 both, 4 monospaced
// ------------------------------------------------------------
function Na__Pdf__FontStyle(Na__Name) {
    const Na__Clean = String(Na__Name || "").replace(/^[A-Z]{6}\+/, "");
    if (/mono|courier|consol|menlo|typewriter|lucida\s*console/i.test(Na__Clean)) return 4;
    const Na__Bold   = /bold|black|heavy|demi/i.test(Na__Clean);
    const Na__Italic = /italic|oblique|[-,]it$|[-,]ital/i.test(Na__Clean);
    return Na__Bold && Na__Italic ? 3 : Na__Bold ? 1 : Na__Italic ? 2 : 0;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers - Geometry
// -----------------------------------------------------------------------------

// FUNCTION | Percentile - The p-th value (0..1) of a list of numbers
// ------------------------------------------------------------
function Na__Pdf__Percentile(Na__Values, Na__P) {
    if (!Na__Values.length) return NaN;
    const Na__Sorted = [...Na__Values].sort((a, b) => a - b);
    return Na__Sorted[Math.min(Na__Sorted.length - 1, Math.max(0, Math.round(Na__P * (Na__Sorted.length - 1))))];
}
// ------------------------------------------------------------


// FUNCTION | WeightedMode - The key carrying the most weight in a Map of key to weight
// ------------------------------------------------------------
function Na__Pdf__WeightedMode(Na__Weights) {
    let Na__Best = null;
    let Na__BestWeight = -1;
    for (const [Na__Key, Na__Weight] of Na__Weights) {
        if (Na__Weight > Na__BestWeight) {
            Na__Best = Na__Key;
            Na__BestWeight = Na__Weight;
        }
    }
    return Na__Best;
}
// ------------------------------------------------------------


// FUNCTION | FindGutter - The x of a two-column page's gutter, or null for one column
// ------------------------------------------------------------
// An x-band in the middle 30-70 % of the width that almost no item crosses, with at least
// a fifth of the text on each side. A few full-width lines (titles) may cross it.
function Na__Pdf__FindGutter(Na__Items, Na__PageWidth) {
    if (Na__Items.length < 20 || !(Na__PageWidth > 0)) return null;
    const Na__Bins = 120;
    const Na__Cover = new Array(Na__Bins).fill(0);
    let Na__Chars = 0;
    for (const Na__Item of Na__Items) {
        const Na__From = Math.max(0, Math.min(Na__Bins - 1, Math.floor(Na__Item.x0 / Na__PageWidth * Na__Bins)));
        const Na__To   = Math.max(0, Math.min(Na__Bins - 1, Math.floor(Na__Item.x1 / Na__PageWidth * Na__Bins)));
        for (let Na__Bin = Na__From; Na__Bin <= Na__To; Na__Bin++) Na__Cover[Na__Bin]++;
        Na__Chars += Na__Item.str.length;
    }
    const Na__Limit = Math.max(2, Na__Items.length * 0.04);
    let Na__Best = null;
    let Na__RunStart = -1;
    for (let Na__Bin = Math.floor(Na__Bins * 0.3); Na__Bin <= Math.ceil(Na__Bins * 0.7); Na__Bin++) {
        const Na__Empty = Na__Bin < Math.ceil(Na__Bins * 0.7) && Na__Cover[Na__Bin] <= Na__Limit;
        if (Na__Empty && Na__RunStart < 0) Na__RunStart = Na__Bin;
        if (!Na__Empty && Na__RunStart >= 0) {
            const Na__Length = Na__Bin - Na__RunStart;
            if (Na__Length >= 2 && (!Na__Best || Na__Length > Na__Best.length)) Na__Best = { start: Na__RunStart, length: Na__Length };
            Na__RunStart = -1;
        }
    }
    if (!Na__Best) return null;
    const Na__GutterX = (Na__Best.start + Na__Best.length / 2) / Na__Bins * Na__PageWidth;
    let Na__Left = 0;
    let Na__Right = 0;
    for (const Na__Item of Na__Items) {
        if (Na__Item.x1 <= Na__GutterX) Na__Left += Na__Item.str.length;
        else if (Na__Item.x0 >= Na__GutterX) Na__Right += Na__Item.str.length;
    }
    if (Na__Left < Na__Chars * 0.2 || Na__Right < Na__Chars * 0.2) return null;
    return Na__GutterX;
}
// ------------------------------------------------------------


// FUNCTION | MakePiece - One run of items on a baseline as a line: plain and rich text, size, style
// ------------------------------------------------------------
function Na__Pdf__MakePiece(Na__LineItems, Na__Baseline0, Na__Column, Na__Row) {
    const Na__SizeWeights = new Map();
    const Na__FontWeights = new Map();
    const Na__StyleWeights = [0, 0, 0, 0, 0];
    let Na__Text = "";
    let Na__Rich = "";
    let Na__Style = 0;
    let Na__Link = -1;
    let Na__Previous = null;
    let Na__Baseline = Na__Baseline0;
    let Na__BaselineWeight = -1;
    for (const Na__Item of Na__LineItems) {
        const Na__Str = Na__Item.str.replace(Na__Pdf__MarkChars, "");
        if (Na__Previous) {
            const Na__Gap = Na__Item.x0 - Na__Previous.x1;
            const Na__Space = Na__Gap > 0.2 * Math.max(Na__Item.size, Na__Previous.size);
            if (Na__Space && !/\s$/.test(Na__Text) && !/^\s/.test(Na__Str)) {
                Na__Text += " ";
                Na__Rich += " ";
            }
        }
        const Na__ItemLink = Na__Item.link === undefined ? -1 : Na__Item.link;
        if (Na__ItemLink !== Na__Link) {
            if (Na__Link >= 0) Na__Rich += "\uE007";
            if (Na__ItemLink >= 0) Na__Rich += "\uE005" + Na__ItemLink + "\uE006";
            Na__Link = Na__ItemLink;
        }
        const Na__ItemStyle = Na__Item.style || 0;
        if (Na__ItemStyle !== Na__Style) {
            Na__Rich += Na__Pdf__Mark[Na__ItemStyle];
            Na__Style = Na__ItemStyle;
        }
        Na__Text += Na__Str;
        Na__Rich += Na__Str;
        const Na__Weight = Na__Str.trim().length;
        const Na__SizeKey = Math.round(Na__Item.size * 10) / 10;
        Na__SizeWeights.set(Na__SizeKey, (Na__SizeWeights.get(Na__SizeKey) || 0) + Na__Weight);
        Na__FontWeights.set(Na__Item.font, (Na__FontWeights.get(Na__Item.font) || 0) + Na__Weight);
        Na__StyleWeights[Na__ItemStyle] += Na__Weight;
        if (Na__Weight > Na__BaselineWeight) {
            Na__Baseline = Na__Item.y;
            Na__BaselineWeight = Na__Weight;
        }
        Na__Previous = Na__Item;
    }
    if (Na__Link >= 0) Na__Rich += "\uE007";
    const Na__Total = Math.max(1, Na__StyleWeights.reduce((a, b) => a + b, 0));
    return {
        text   : Na__Text.replace(/\s+/g, " ").trim(),
        rich   : Na__Rich.replace(/\s+/g, " ").trim(),
        x0     : Na__LineItems[0].x0,
        x1     : Math.max(...Na__LineItems.map((Na__Item) => Na__Item.x1)),
        y      : Na__Baseline,
        size   : Na__Pdf__WeightedMode(Na__SizeWeights),
        font   : Na__Pdf__WeightedMode(Na__FontWeights),
        bold   : (Na__StyleWeights[1] + Na__StyleWeights[3]) / Na__Total,
        italic : (Na__StyleWeights[2] + Na__StyleWeights[3]) / Na__Total,
        mono   : Na__StyleWeights[4] / Na__Total,
        col    : Na__Column,
        row    : Na__Row,
        drop   : false
    };
}
// ------------------------------------------------------------


// FUNCTION | BuildLines - Group items sharing a baseline into lines, read left to right
// ------------------------------------------------------------
// With Na__Split ("text" or "ocr"), a baseline is cut into pieces wherever a gap is far wider
// than a word space: table cells, the two halves of a two-column block, a label and its value.
// Each piece keeps the number of the row it came from. A list marker standing apart from its
// text (a tab after "1.") stays with it.
let Na__Pdf__RowCounter = 0;

function Na__Pdf__BuildLines(Na__Items, Na__Column, Na__Split, Na__Verticals) {
    const Na__Sorted = [...Na__Items].sort((a, b) => a.y - b.y || a.x0 - b.x0);
    const Na__Groups = [];
    for (const Na__Item of Na__Sorted) {
        let Na__Target = null;
        for (let Na__K = Na__Groups.length - 1; Na__K >= Math.max(0, Na__Groups.length - 3); Na__K--) {
            const Na__Group = Na__Groups[Na__K];
            if (Math.abs(Na__Group.y - Na__Item.y) <= 0.45 * Math.max(Na__Group.size, Na__Item.size)) {
                Na__Target = Na__Group;
                break;
            }
        }
        if (Na__Target) Na__Target.items.push(Na__Item);
        else Na__Groups.push({ y: Na__Item.y, size: Na__Item.size, items: [Na__Item] });
    }

    const Na__Pieces = [];
    for (const Na__Group of Na__Groups) {
        // Footnote markers: digits well smaller than the line and raised above its baseline
        const Na__Biggest = Math.max(...Na__Group.items.map((Na__Item) => Na__Item.size));
        const Na__Lowest  = Math.max(...Na__Group.items.map((Na__Item) => Na__Item.y));
        const Na__LineItems = Na__Group.items
            .filter((Na__Item) => !(Na__Group.items.length > 1 && /^\d{1,3}[,;]?$/.test(Na__Item.str.trim()) &&
                Na__Item.size <= Na__Biggest * 0.8 && Na__Lowest - Na__Item.y > Na__Biggest * 0.15))
            .sort((a, b) => a.x0 - b.x0);
        if (!Na__LineItems.length) continue;
        const Na__Row = ++Na__Pdf__RowCounter;

        // Cut at wide gaps: OCR has already cut its boxes at them, so any clear gap counts there
        const Na__Runs = [[Na__LineItems[0]]];
        for (let Na__K = 1; Na__K < Na__LineItems.length; Na__K++) {
            const Na__Item = Na__LineItems[Na__K];
            const Na__Run = Na__Runs[Na__Runs.length - 1];
            const Na__Prev = Na__Run[Na__Run.length - 1];
            const Na__Gap = Na__Item.x0 - Math.max(...Na__Run.map((Na__R) => Na__R.x1));
            const Na__Size = Math.max(Na__Item.size, Na__Prev.size);
            // A table's drawn grid line between two items cuts them apart, however close they sit
            const Na__Ruled = Na__Split && Na__Verticals && Na__Verticals.some((Na__V) =>
                Na__V.x >= Na__Prev.x1 - 0.5 && Na__V.x <= Na__Item.x0 + 0.5 &&
                Na__Item.y - Na__Size * 0.35 >= Na__V.y0 - 1 && Na__Item.y - Na__Size * 0.35 <= Na__V.y1 + 1);
            const Na__Wide = Na__Ruled || (Na__Split === "ocr" ? Na__Gap > 0.3 * Na__Size : Na__Split ? Na__Gap > 1.4 * Na__Size : false);
            const Na__Marker = Na__Runs.length === 1 && Na__Pdf__MarkerOnly.test(Na__Run.map((Na__R) => Na__R.str).join("").trim());
            if (Na__Wide && !Na__Marker) Na__Runs.push([Na__Item]);
            else Na__Run.push(Na__Item);
        }
        for (const Na__Run of Na__Runs) {
            const Na__Piece = Na__Pdf__MakePiece(Na__Run, Na__Group.y, Na__Column, Na__Row);
            if (Na__Piece.text) Na__Pieces.push(Na__Piece);
        }
    }
    return Na__Pieces;
}
// ------------------------------------------------------------


// FUNCTION | GroupRows - Pieces gathered by the row they were cut from, top to bottom
// ------------------------------------------------------------
function Na__Pdf__GroupRows(Na__Pieces) {
    const Na__ByRow = new Map();
    for (const Na__Piece of Na__Pieces) {
        if (!Na__ByRow.has(Na__Piece.row)) Na__ByRow.set(Na__Piece.row, []);
        Na__ByRow.get(Na__Piece.row).push(Na__Piece);
    }
    return [...Na__ByRow.values()].map((Na__List) => {
        Na__List.sort((a, b) => a.x0 - b.x0);
        return {
            y      : Math.min(...Na__List.map((Na__Piece) => Na__Piece.y)),
            size   : Math.max(...Na__List.map((Na__Piece) => Na__Piece.size)),
            pieces : Na__List
        };
    }).sort((a, b) => a.y - b.y);
}
// ------------------------------------------------------------


// FUNCTION | BuildTable - Rows of pieces in known columns as one table line, or null
// ------------------------------------------------------------
// Pieces go to columns by their x-range, so a missing cell (an OCR box that never came) is
// left empty. A row whose cells wrap is gathered back: lines closer than a line apart join,
// and so does a line with nothing in the first column (a cell running on).
function Na__Pdf__BuildTable(Na__Rows, Na__Cols, Na__ColOf, Na__Lines) {
    // Ruled tables: the drawn lines (and row shading edges) across the table part its rows
    const Na__X0 = Na__Cols[0][0];
    const Na__X1 = Na__Cols[Na__Cols.length - 1][1];
    const Na__Top = Na__Rows[0].y - Na__Rows[0].size * 1.5;
    const Na__Foot = Na__Rows[Na__Rows.length - 1].y + Na__Rows[Na__Rows.length - 1].size;
    const Na__Rulings = (Na__Lines || []).filter((Na__H) => Na__H.y >= Na__Top && Na__H.y <= Na__Foot &&
        Math.min(Na__H.x1, Na__X1) - Math.max(Na__H.x0, Na__X0) >= (Na__X1 - Na__X0) * 0.5).map((Na__H) => Na__H.y);
    const Na__Ruled = Na__Rulings.length >= 2;
    // Unruled but padded rows (gaps well over a line apart): a line a single line-pitch down
    // is a cell running on, even in the first column
    let Na__Padded = false;
    for (let Na__K = 1; Na__K < Na__Rows.length; Na__K++) {
        if (Na__Rows[Na__K].y - Na__Rows[Na__K - 1].y >= 1.7 * Na__Rows[Na__K].size) Na__Padded = true;
    }

    const Na__Grid = [];
    let Na__Current = null;
    let Na__PrevY = null;
    for (const Na__Row of Na__Rows) {
        const Na__Gap = Na__PrevY === null ? Infinity : Na__Row.y - Na__PrevY;
        const Na__HasFirst = Na__Row.pieces.some((Na__Piece) => Na__ColOf(Na__Piece) === 0);
        const Na__Parted = Na__Ruled && Na__Rulings.some((Na__Y) => Na__Y > Na__PrevY + 0.1 * Na__Row.size && Na__Y < Na__Row.y - 0.6 * Na__Row.size);
        const Na__Join = Na__Current && (Na__Ruled ? !Na__Parted :
            (Na__Gap < 0.9 * Na__Row.size || (!Na__HasFirst && Na__Gap <= 1.6 * Na__Row.size) ||
             (Na__Padded && Na__Gap <= 1.35 * Na__Row.size)));
        if (!Na__Join) {
            Na__Current = { y: Na__Row.y, cells: Na__Cols.map(() => []) };
            Na__Grid.push(Na__Current);
        }
        for (const Na__Piece of Na__Row.pieces) Na__Current.cells[Math.max(0, Na__ColOf(Na__Piece))].push(Na__Piece);
        Na__PrevY = Na__Row.y;
    }
    if (Na__Grid.length < 2) return null;

    const Na__Table = Na__Grid.map((Na__Entry) => Na__Entry.cells.map((Na__List) => {
        Na__List.sort((a, b) => a.y - b.y || a.x0 - b.x0);
        let Na__Text = "";
        let Na__Rich = "";
        for (const Na__Piece of Na__List) [Na__Text, Na__Rich] = Na__Pdf__JoinPair(Na__Text, Na__Rich, Na__Piece.text, Na__Piece.rich);
        return {
            text : Na__Text,
            rich : Na__Rich,
            x0   : Na__List.length ? Math.min(...Na__List.map((Na__Piece) => Na__Piece.x0)) : NaN,
            x1   : Na__List.length ? Math.max(...Na__List.map((Na__Piece) => Na__Piece.x1)) : NaN
        };
    }));

    // Columns left empty everywhere go; a column of figures whose right edges line up is right-aligned
    const Na__Keep = Na__Cols.map((Na__Col, Na__C) => Na__Table.some((Na__Cells) => Na__Cells[Na__C].text));
    const Na__Aligns = Na__Cols.map((Na__Col, Na__C) => {
        const Na__Cells = Na__Table.slice(1).map((Na__Cells2) => Na__Cells2[Na__C]).filter((Na__Cell) => Na__Cell.text);
        if (Na__Cells.length < 2) return "left";
        const Na__LeftSpread  = Math.max(...Na__Cells.map((Na__Cell) => Na__Cell.x0)) - Math.min(...Na__Cells.map((Na__Cell) => Na__Cell.x0));
        const Na__RightSpread = Math.max(...Na__Cells.map((Na__Cell) => Na__Cell.x1)) - Math.min(...Na__Cells.map((Na__Cell) => Na__Cell.x1));
        return Na__LeftSpread > 2 && Na__RightSpread < Na__LeftSpread * 0.5 ? "right" : "left";
    });
    const Na__Rows2 = Na__Table.map((Na__Cells) => Na__Cells.filter((Na__Cell, Na__C) => Na__Keep[Na__C]));
    if (Na__Rows2[0].length < 2) return null;
    const Na__All = Na__Rows.flatMap((Na__Row) => Na__Row.pieces);
    return {
        kind   : "table",
        rows   : Na__Rows2,
        aligns : Na__Aligns.filter((Na__Align, Na__C) => Na__Keep[Na__C]),
        text   : "",
        rich   : "",
        x0     : Math.min(...Na__All.map((Na__Piece) => Na__Piece.x0)),
        x1     : Math.max(...Na__All.map((Na__Piece) => Na__Piece.x1)),
        y      : Na__Grid[0].y,
        y1     : Na__Rows[Na__Rows.length - 1].y,
        size   : Na__Pdf__Percentile(Na__All.map((Na__Piece) => Na__Piece.size), 0.5),
        font   : null,
        col    : "F",
        drop   : false
    };
}
// ------------------------------------------------------------


// FUNCTION | LayoutBand - A band of rows (between full-width lines) in reading order
// ------------------------------------------------------------
// Rows cut into two or more pieces give the band's columns (their x-ranges merged). Two
// columns of real prose are read one after the other; anything else in columns is a table.
// Rows that join on closely above or below belong to it; a row crossing the columns splits
// the band, and rows further off are laid out on their own.
function Na__Pdf__LayoutBand(Na__Rows, Na__Grid) {
    const Na__Flat = () => Na__Rows.flatMap((Na__Row) => Na__Row.pieces);
    const Na__Multi = Na__Rows.map((Na__Row, Na__K) => (Na__Row.pieces.length >= 2 ? Na__K : -1)).filter((Na__K) => Na__K >= 0);
    if (Na__Multi.length < 2) return Na__Flat();

    const Na__Spans = Na__Multi.flatMap((Na__K) => Na__Rows[Na__K].pieces.map((Na__Piece) => [Na__Piece.x0, Na__Piece.x1]))
        .sort((a, b) => a[0] - b[0]);
    const Na__Cols = [];
    for (const [Na__A, Na__B] of Na__Spans) {
        const Na__Last = Na__Cols[Na__Cols.length - 1];
        if (Na__Last && Na__A <= Na__Last[1] + 1) Na__Last[1] = Math.max(Na__Last[1], Na__B);
        else Na__Cols.push([Na__A, Na__B]);
    }
    if (Na__Cols.length < 2) return Na__Flat();
    const Na__ColOf = (Na__Piece) => {
        let Na__Best = -1;
        let Na__BestOverlap = 0;
        let Na__Hits = 0;
        Na__Cols.forEach(([Na__A, Na__B], Na__C) => {
            const Na__Overlap = Math.min(Na__B, Na__Piece.x1) - Math.max(Na__A, Na__Piece.x0);
            if (Na__Overlap > 0) {
                Na__Hits++;
                if (Na__Overlap > Na__BestOverlap) {
                    Na__BestOverlap = Na__Overlap;
                    Na__Best = Na__C;
                }
            }
        });
        return Na__Hits === 1 ? Na__Best : -1;
    };
    const Na__Fits = (Na__Row) => Na__Row.pieces.every((Na__Piece) => Na__ColOf(Na__Piece) >= 0);

    let Na__First = Na__Multi[0];
    let Na__Last = Na__Multi[Na__Multi.length - 1];
    const Na__Pitches = [];
    for (let Na__K = Na__First + 1; Na__K <= Na__Last; Na__K++) Na__Pitches.push(Na__Rows[Na__K].y - Na__Rows[Na__K - 1].y);
    const Na__Reach = 2 * (Na__Pdf__Percentile(Na__Pitches, 0.5) || Na__Rows[Na__First].size * 1.5);
    while (Na__First > 0 && Na__Rows[Na__First].y - Na__Rows[Na__First - 1].y <= Na__Reach && Na__Fits(Na__Rows[Na__First - 1])) Na__First--;
    while (Na__Last < Na__Rows.length - 1 && Na__Rows[Na__Last + 1].y - Na__Rows[Na__Last].y <= Na__Reach && Na__Fits(Na__Rows[Na__Last + 1])) Na__Last++;
    for (let Na__K = Na__First; Na__K <= Na__Last; Na__K++) {
        if (!Na__Fits(Na__Rows[Na__K])) {
            return [...Na__Pdf__LayoutBand(Na__Rows.slice(0, Na__K), Na__Grid), ...Na__Rows[Na__K].pieces, ...Na__Pdf__LayoutBand(Na__Rows.slice(Na__K + 1), Na__Grid)];
        }
    }

    const Na__Inside = Na__Rows.slice(Na__First, Na__Last + 1);
    const Na__ProseRows = Na__Inside.filter((Na__Row) => Na__Row.pieces.length === 2 &&
        Na__Row.pieces.every((Na__Piece) => Na__Pdf__WordCount(Na__Piece.text) >= 4)).length;
    let Na__Middle = null;
    if (Na__Cols.length === 2 && Na__ProseRows >= 2) {
        Na__Middle = [];
        for (let Na__C = 0; Na__C < 2; Na__C++) {
            for (const Na__Row of Na__Inside) {
                for (const Na__Piece of Na__Row.pieces) {
                    if (Na__ColOf(Na__Piece) !== Na__C) continue;
                    Na__Piece.col = Na__C === 0 ? "L" : "R";
                    Na__Middle.push(Na__Piece);
                }
            }
        }
    } else {
        const Na__Table = Na__Pdf__BuildTable(Na__Inside, Na__Cols, Na__ColOf, Na__Grid && Na__Grid.horizontals);
        Na__Middle = Na__Table ? [Na__Table] : Na__Inside.flatMap((Na__Row) => Na__Row.pieces);
    }
    return [
        ...Na__Pdf__LayoutBand(Na__Rows.slice(0, Na__First), Na__Grid),
        ...Na__Middle,
        ...Na__Pdf__LayoutBand(Na__Rows.slice(Na__Last + 1), Na__Grid)
    ];
}
// ------------------------------------------------------------


// FUNCTION | LayoutRows - A single-column page's rows in reading order, columns and tables found
// ------------------------------------------------------------
// Full-width lines (and a paragraph's short last line under one) cut the page into bands;
// each band is laid out on its own, so a boxed two-column block or a table between ordinary
// paragraphs is found without the whole page being two columns.
function Na__Pdf__LayoutRows(Na__Rows, Na__Grid, Na__Bands) {
    if (!Na__Rows.length) return [];
    const Na__All = Na__Rows.flatMap((Na__Row) => Na__Row.pieces);
    const Na__Left  = Na__Pdf__Percentile(Na__All.map((Na__Piece) => Na__Piece.x0), 0.1);
    const Na__Right = Na__Pdf__Percentile(Na__All.map((Na__Piece) => Na__Piece.x1), 0.9);
    const Na__Width = Math.max(1, Na__Right - Na__Left);
    const Na__Divider = Na__Rows.map(() => false);
    Na__Rows.forEach((Na__Row, Na__K) => {
        // Rows in the running header and footer bands never join a table or columns
        if (Na__Bands && (Na__Row.y - Na__Row.size < Na__Bands.top || Na__Row.y > Na__Bands.foot)) {
            Na__Divider[Na__K] = true;
            return;
        }
        if (Na__Row.pieces.length !== 1) return;
        const Na__Piece = Na__Row.pieces[0];
        if (Na__Piece.x1 - Na__Piece.x0 >= Na__Width * 0.6) {
            Na__Divider[Na__K] = true;
            return;
        }
        const Na__Prev = Na__Rows[Na__K - 1];
        if (Na__Prev && Na__Divider[Na__K - 1] && Na__Prev.pieces.length === 1 &&
            Na__Row.y - Na__Prev.y <= Math.max(Na__Piece.size, Na__Prev.size) * 1.8 &&
            Math.abs(Na__Piece.x0 - Na__Prev.pieces[0].x0) <= Na__Piece.size) Na__Divider[Na__K] = true;
    });
    const Na__Out = [];
    let Na__Band = [];
    Na__Rows.forEach((Na__Row, Na__K) => {
        if (Na__Divider[Na__K]) {
            Na__Out.push(...Na__Pdf__LayoutBand(Na__Band, Na__Grid), ...Na__Row.pieces);
            Na__Band = [];
        } else {
            Na__Band.push(Na__Row);
        }
    });
    Na__Out.push(...Na__Pdf__LayoutBand(Na__Band, Na__Grid));
    return Na__Out;
}
// ------------------------------------------------------------


// FUNCTION | PlaceRules - Put the page's horizontal rules into the reading order
// ------------------------------------------------------------
// A rule goes before the first full-width line or block below it, when there is text above
// and below it, and never inside a table.
function Na__Pdf__PlaceRules(Na__Ordered, Na__Rules) {
    if (!Na__Rules || !Na__Rules.length || !Na__Ordered.length) return Na__Ordered;
    const Na__Out = [...Na__Ordered];
    for (const Na__Rule of [...Na__Rules].sort((a, b) => a.y - b.y)) {
        const Na__InTable = Na__Out.some((Na__Line) => Na__Line.kind === "table" &&
            Na__Rule.y >= Na__Line.y - Na__Line.size * 2.5 && Na__Rule.y <= Na__Line.y1 + Na__Line.size * 1.5);
        if (Na__InTable) continue;
        if (!Na__Out.some((Na__Line) => Na__Line.y < Na__Rule.y)) continue;
        const Na__At = Na__Out.findIndex((Na__Line) => Na__Line.y - Na__Line.size > Na__Rule.y && Na__Line.col === "F");
        if (Na__At < 0) continue;
        Na__Out.splice(Na__At, 0, { kind: "rule", text: "", rich: "", y: Na__Rule.y, x0: Na__Rule.x0, x1: Na__Rule.x1, size: 0, col: "F", drop: false });
    }
    return Na__Out;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers - Reflow
// -----------------------------------------------------------------------------

// FUNCTION | MarkRunningLines - Flag running headers, footers and page numbers on every page
// ------------------------------------------------------------
// A line in the top or bottom band that recurs (numbers blanked) on at least 2 pages, and on
// 3 or 30 % of them in a longer document, is a running head; a bare number, roman numeral
// or "Page n of m" in a band is a page number. Tables and rules are never running lines.
function Na__Pdf__MarkRunningLines(Na__Pages, Na__Band) {
    const Na__Seen = new Map();
    const Na__Banded = [];
    for (const Na__Page of Na__Pages) {
        for (const Na__Line of Na__Page.lines) {
            Na__Line.drop = false;
            if (Na__Line.kind) continue;
            const Na__Top    = (Na__Line.y - Na__Line.size) < Na__Page.height * Na__Band;
            const Na__Bottom = Na__Line.y > Na__Page.height * (1 - Na__Band);
            if (!Na__Top && !Na__Bottom) continue;
            if (Na__Pdf__PageNumber.test(Na__Line.text) || Na__Pdf__DashedNum.test(Na__Line.text)) {
                Na__Line.drop = true;
                continue;
            }
            const Na__Key = (Na__Top ? "T|" : "B|") + Na__Pdf__NormaliseRunningKey(Na__Line.text);
            if (!Na__Seen.has(Na__Key)) Na__Seen.set(Na__Key, new Set());
            Na__Seen.get(Na__Key).add(Na__Page.number);
            Na__Banded.push([Na__Key, Na__Line]);
        }
    }
    const Na__Needed = Math.min(3, Math.max(2, Math.ceil(Na__Pages.length * 0.3)));
    for (const [Na__Key, Na__Line] of Na__Banded) {
        if (Na__Seen.get(Na__Key).size >= Na__Needed) Na__Line.drop = true;
    }
}
// ------------------------------------------------------------


// FUNCTION | GroupStats - Body size, body font, line pitch and heading levels for a set of pages
// ------------------------------------------------------------
// Text-layer pages and OCR pages are measured apart: OCR box heights are not font sizes.
// The body is the size of the running prose (lines of 40 or more characters). Heading sizes
// are gathered into levels, sizes within a few per cent (more for OCR) counting as one, so
// both editions of a document rank their headings alike.
function Na__Pdf__GroupStats(Na__Pages, Na__IsOcr) {
    const Na__Lines = Na__Pages.flatMap((Na__Page) => Na__Page.lines.filter((Na__Line) => !Na__Line.drop && !Na__Line.kind));
    const Na__Prose = new Map();
    const Na__Any = new Map();
    for (const Na__Line of Na__Lines) {
        Na__Any.set(Na__Line.size, (Na__Any.get(Na__Line.size) || 0) + Na__Line.text.length);
        if (Na__Line.text.length >= 40) Na__Prose.set(Na__Line.size, (Na__Prose.get(Na__Line.size) || 0) + Na__Line.text.length);
    }
    const Na__Body = Na__Pdf__WeightedMode(Na__Prose.size ? Na__Prose : Na__Any) || 10;
    // OCR: measured on Adam's benchmark scan, 14 pt sections come out at 12.0-14.4 over a 9.5 body
    // (1.26 and up) and 10.6 pt sub-sections at 9.0-10.8, so 1.22 parts the two
    const Na__HeadingRatio = Na__IsOcr ? 1.22 : 1.15;
    // OCR boxes swing with ascenders and descenders ("Typography" against "PDF Reader"):
    // a fifth either way is still one level there; a title (25 pt) and a section (14 pt) stay apart
    const Na__Tolerance = Na__IsOcr ? 0.22 : 0.08;

    const Na__FontWeights = new Map();
    const Na__Gaps = [];
    const Na__HeadingCounts = new Map();
    for (const Na__Page of Na__Pages) {
        let Na__Previous = null;
        for (const Na__Line of Na__Page.lines) {
            if (Na__Line.drop || Na__Line.kind) continue;
            const Na__IsBody = Math.abs(Na__Line.size - Na__Body) <= Na__Body * 0.1;
            if (Na__IsBody) Na__FontWeights.set(Na__Line.font, (Na__FontWeights.get(Na__Line.font) || 0) + Na__Line.text.length);
            if (Na__Line.size >= Na__Body * Na__HeadingRatio && Na__Line.text.length <= 70 && !/[.!?]$/.test(Na__Line.text)) {
                Na__HeadingCounts.set(Na__Line.size, (Na__HeadingCounts.get(Na__Line.size) || 0) + 1);
            }
            if (Na__Previous && Na__IsBody && Na__Previous.col === Na__Line.col &&
                Math.abs(Na__Previous.size - Na__Body) <= Na__Body * 0.1) {
                const Na__Gap = Na__Line.y - Na__Previous.y;
                if (Na__Gap > 0 && Na__Gap < Na__Body * 3) Na__Gaps.push(Na__Gap);
            }
            Na__Previous = Na__Line;
        }
    }

    // Largest heading sizes first, near sizes as one level; a level used more than 3 times
    // at the top is a section level (h2), not the document's title (h1)
    const Na__Clusters = [];
    for (const Na__Size of [...Na__HeadingCounts.keys()].sort((a, b) => b - a)) {
        const Na__Last = Na__Clusters[Na__Clusters.length - 1];
        if (Na__Last && Na__Size >= Na__Last.top * (1 - Na__Tolerance)) {
            Na__Last.count += Na__HeadingCounts.get(Na__Size);
            Na__Last.bottom = Na__Size;
        } else {
            Na__Clusters.push({ top: Na__Size, bottom: Na__Size, count: Na__HeadingCounts.get(Na__Size) });
        }
    }
    const Na__FirstLevel = Na__Clusters.length && Na__Clusters[0].count > 3 ? 2 : 1;
    Na__Clusters.forEach((Na__Cluster, Na__Rank) => { Na__Cluster.level = Math.min(4, Na__FirstLevel + Na__Rank); });
    const Na__DeepestLevel = Na__Clusters.length ? Na__Clusters[Na__Clusters.length - 1].level : Na__FirstLevel;

    return {
        body         : Na__Body,
        bodyFont     : Na__IsOcr ? null : Na__Pdf__WeightedMode(Na__FontWeights),
        pitch        : Na__Gaps.length ? Na__Pdf__Percentile(Na__Gaps, 0.5) : Na__Body * 1.2,
        headingRatio : Na__HeadingRatio,
        clusters     : Na__Clusters,
        tolerance    : Na__Tolerance,
        firstLevel   : Na__FirstLevel,
        boldLevel    : Math.min(4, Na__DeepestLevel + 1)
    };
}
// ------------------------------------------------------------


// FUNCTION | LevelFor - The heading level of a size, from the nearest heading cluster
// ------------------------------------------------------------
function Na__Pdf__LevelFor(Na__Stats, Na__Size) {
    let Na__Best = null;
    let Na__BestDistance = Infinity;
    for (const Na__Cluster of Na__Stats.clusters) {
        const Na__Distance = Na__Size > Na__Cluster.top ? Na__Size / Na__Cluster.top :
            Na__Size < Na__Cluster.bottom ? Na__Cluster.bottom / Na__Size : 1;
        if (Na__Distance < Na__BestDistance) {
            Na__BestDistance = Na__Distance;
            Na__Best = Na__Cluster;
        }
    }
    return Na__Best ? Na__Best.level : Na__Stats.firstLevel;
}
// ------------------------------------------------------------


// FUNCTION | ClassifyLine - Heading, label, list item, code or body text
// ------------------------------------------------------------
// Na__Context: { standalone, standaloneOcr, ocr, pageHeight, prevText }
function Na__Pdf__ClassifyLine(Na__Line, Na__Stats, Na__Context) {
    const Na__Text = Na__Line.text;
    const Na__Rich = Na__Line.rich === undefined ? Na__Text : Na__Line.rich;
    const Na__Words = Na__Pdf__WordCount(Na__Text);
    // A scan's box heights swing: a long line, a list item, or one running on in lower case is
    // not a heading however tall its box; nor is the line under a sign-off ("Warm Regards,"),
    // a signature; and a word or two in capitals (a logo's wordmark, letterhead or signature
    // block) is a label
    const Na__OcrProse = Na__Context.ocr && (Na__Text.length > 80 || /^\p{Ll}/u.test(Na__Text) ||
        Na__Pdf__Numbered.test(Na__Text) || Na__Pdf__Bullet.test(Na__Text) ||
        /\b(regards|sincerely|faithfully|truly|wishes|thanks)\b,?$/i.test(Na__Context.prevText || ""));
    if (!Na__OcrProse && Na__Line.size >= Na__Stats.body * Na__Stats.headingRatio && Na__Text.length <= 200) {
        if (Na__Context.ocr && !/\p{Ll}/u.test(Na__Text) && !/\d/.test(Na__Text) && Na__Words <= 2) {
            return { type: "label", text: Na__Text, rich: Na__Text };
        }
        // On a scan, a tall box ending a sentence in a word or two is a big paragraph's last line ("jugs.")
        const Na__Tail = Na__Context.ocr && /[.!?]["'\u201D\u2019)]*$/.test(Na__Text) && Na__Words <= 3;
        if (!Na__Tail) return { type: "heading", level: Na__Pdf__LevelFor(Na__Stats, Na__Line.size), text: Na__Text, rich: Na__Rich };
        return { type: "para", text: Na__Text, rich: Na__Rich };
    }
    const Na__Item = (Na__Match, Na__Kind) => ({
        ...Na__Kind,
        text : Na__Match[2],
        rich : Na__Pdf__RichSkip(Na__Rich, Na__Text.slice(0, Na__Text.length - Na__Match[2].length))
    });
    let Na__Match = Na__Text.match(Na__Pdf__Numbered);
    if (Na__Match) return Na__Item(Na__Match, { type: "list", ordered: true, number: Number(Na__Match[1]) });
    Na__Match = Na__Text.match(Na__Pdf__Bullet);
    if (Na__Match) return Na__Item([Na__Match[0], null, Na__Match[1]], { type: "list", ordered: false });
    Na__Match = Na__Text.match(Na__Pdf__Lettered);
    if (Na__Match) return { type: "list", ordered: false, text: Na__Match[1] + " " + Na__Match[2], rich: Na__Rich };

    if (Na__Line.mono >= 0.6) return { type: "code", text: Na__Text, rich: Na__Text };

    // A small capital label ("REFERENCE PHRASE", "LEFT COLUMN"): bold, short, all capitals
    const Na__Capitals = !/\p{Ll}/u.test(Na__Text) && (Na__Text.match(/\p{Lu}/gu) || []).length >= 2 &&
        Na__Text.length <= 40 && Na__Words <= 6 && !Na__Pdf__Numbered.test(Na__Text);
    if (Na__Capitals && (Na__Context.ocr || (Na__Line.bold >= 0.6 && Na__Line.size <= Na__Stats.body * 0.95))) {
        return { type: "label", text: Na__Text, rich: Na__Text };
    }

    // A short line on its own in a different font from the body (usually bold): a sub-heading
    if (Na__Stats.bodyFont && Na__Line.font !== Na__Stats.bodyFont && Na__Context.standalone &&
        Na__Text.length < 80 && /^[\p{Lu}\p{N}]/u.test(Na__Text) && !/[.,;:]$/.test(Na__Text) &&
        !Na__Pdf__JoiningEnd.test(Na__Text) &&
        Math.abs(Na__Line.size - Na__Stats.body) <= Na__Stats.body * 0.15) {
        return { type: "heading", level: Na__Stats.boldLevel, text: Na__Text, rich: Na__Rich };
    }
    // OCR knows no fonts: a short line of words standing apart, with no closing punctuation
    if (Na__Context.ocr && Na__Context.standaloneOcr && Na__Text.length <= 70 && Na__Words >= 2 &&
        /^[\p{Lu}\p{N}]/u.test(Na__Text) && /\p{Ll}/u.test(Na__Text) && !/[.,;:!?)]$/.test(Na__Text) &&
        !Na__Pdf__JoiningEnd.test(Na__Text) && Na__Line.size >= Na__Stats.body * 0.9) {
        return { type: "heading", level: Na__Stats.boldLevel, text: Na__Text, rich: Na__Rich };
    }
    return { type: "para", text: Na__Text, rich: Na__Rich };
}
// ------------------------------------------------------------


// FUNCTION | PageBlocks - One page's lines as headings, paragraphs, lists, tables and the rest
// ------------------------------------------------------------
function Na__Pdf__PageBlocks(Na__Page, Na__Stats) {
    const Na__Lines = Na__Page.lines.filter((Na__Line) => !Na__Line.drop);
    if (!Na__Lines.length) return [];
    const Na__Ocr = Na__Page.source === "ocr";
    const Na__TextLines = Na__Lines.filter((Na__Line) => !Na__Line.kind);

    // Each column's text edges, from its lines
    const Na__Edges = new Map();
    for (const Na__Col of new Set(Na__TextLines.map((Na__Line) => Na__Line.col))) {
        const Na__ColLines = Na__TextLines.filter((Na__Line) => Na__Line.col === Na__Col);
        Na__Edges.set(Na__Col, {
            left  : Na__Pdf__Percentile(Na__ColLines.map((Na__Line) => Na__Line.x0), 0.1),
            right : Na__Pdf__Percentile(Na__ColLines.map((Na__Line) => Na__Line.x1), 0.9)
        });
    }

    // PDF.js names fonts per page (g_d0_f2 is the body on one page, a heading on the next),
    // so the body font that tells a bold sub-heading apart is this page's own
    const Na__PageFonts = new Map();
    let Na__BodyLines = 0;
    for (const Na__Line of Na__TextLines) {
        if (Na__Stats.bodyFont === null || Math.abs(Na__Line.size - Na__Stats.body) > Na__Stats.body * 0.1) continue;
        Na__PageFonts.set(Na__Line.font, (Na__PageFonts.get(Na__Line.font) || 0) + Na__Line.text.length);
        Na__BodyLines++;
    }
    const Na__PageStats = { ...Na__Stats, bodyFont: Na__BodyLines >= 3 ? Na__Pdf__WeightedMode(Na__PageFonts) : null };

    const Na__Gap = (Na__A, Na__B) => (Na__A && Na__B && !Na__A.kind && !Na__B.kind && Na__A.col === Na__B.col) ? Na__B.y - Na__A.y : null;
    const Na__Wide = (Na__G) => Na__G === null || Na__G > Na__Stats.pitch * 1.3;
    const Na__Short = (Na__Line) => {
        const Na__Edge = Na__Edges.get(Na__Line.col);
        if (!Na__Edge) return false;
        return Na__Line.x1 < Na__Edge.right - Math.max(1, Na__Edge.right - Na__Edge.left) * 0.12;
    };
    const Na__Starts = (Na__Line) => Na__Line && !Na__Line.kind && (Na__Pdf__Numbered.test(Na__Line.text) || Na__Pdf__Bullet.test(Na__Line.text));

    const Na__Blocks = [];
    let Na__Current = null;
    let Na__Previous = null;
    Na__Lines.forEach((Na__Line, Na__Index) => {
        // A table or a rule is a block of its own
        if (Na__Line.kind) {
            Na__Current = { ...Na__Line, type: Na__Line.kind };
            Na__Blocks.push(Na__Current);
            Na__Previous = Na__Line;
            return;
        }
        const Na__Next = Na__Lines[Na__Index + 1];
        const Na__Above = Na__Gap(Na__Previous, Na__Line);
        const Na__Below = Na__Gap(Na__Line, Na__Next);
        const Na__Standalone = Na__Wide(Na__Above) &&
            (Na__Wide(Na__Below) || (Na__Next && !Na__Next.kind && Na__Next.font !== Na__Line.font));
        const Na__StandaloneOcr = Na__Wide(Na__Above) &&
            (Na__Below === null || Na__Below > Na__Stats.pitch * 1.15 || Na__Starts(Na__Next));
        const Na__Kind = Na__Pdf__ClassifyLine(Na__Line, Na__PageStats, {
            standalone: Na__Standalone, standaloneOcr: Na__StandaloneOcr, ocr: Na__Ocr, pageHeight: Na__Page.height,
            prevText: Na__Previous && !Na__Previous.kind ? Na__Previous.text : ""
        });
        const Na__G = Na__Above;
        const Na__Edge = Na__Edges.get(Na__Line.col);
        // The line spacing to judge a paragraph gap by: the block's own, else the body's,
        // scaled down for smaller type (a column of 8 pt text under a 9 pt body)
        // (OCR sizes are too noisy to scale by: there the body's spacing stands)
        const Na__Pitch = (Na__Current && Na__Current.pitch) ||
            (Na__Ocr ? Na__Stats.pitch : Na__Stats.pitch * Math.min(1, Na__Line.size / Na__Stats.body));
        let Na__StartNew = true;
        let Na__Break = false;
        // On a scan, a list line with its bullet lost (OCR can miss a small glyph): a new sentence after the
        // item's full stop, further down than the item's own lines, at the item's left edge
        const Na__AsNextItem = () => {
            const Na__Is = Na__Ocr && Na__Current && Na__Current.type === "list" && Na__Kind.type === "para" &&
                Na__Pdf__EndsSentence(Na__Previous.text) && /^[\p{Lu}\p{N}]/u.test(Na__Line.text) &&
                Na__G > (Na__Current.pitch || Na__Pitch) * 1.25 && Na__Line.x0 < Na__Current.x0 + Na__Line.size * 2.5;
            if (Na__Is) {
                Na__Kind.type = "list";
                Na__Kind.ordered = Na__Current.ordered;
                Na__Kind.number = (Na__Current.number || 0) + 1;
            }
            return Na__Is;
        };

        if (Na__Current && Na__Previous && !Na__Previous.kind && !Na__Current.kind) {
            if (Na__Kind.type === "code") {
                Na__StartNew = Na__Current.type !== "code" || (Na__G !== null && Na__G > Na__Stats.pitch * 2.2);
            } else if (Na__Current.type === "code") {
                Na__StartNew = true;
            } else if (Na__Kind.type === "heading") {
                Na__StartNew = !(Na__Current.type === "heading" && Na__Current.level === Na__Kind.level &&
                                 Na__G !== null && Na__G > 0 && Na__G <= Na__Line.size * 1.8);
            } else if (Na__Kind.type === "label") {
                Na__StartNew = !(Na__Current.type === "label" && Na__G !== null && Na__G > 0 && Na__G <= Na__Line.size * 1.8);
            } else if (Na__Kind.type === "list" || Na__Current.type === "heading" || Na__Current.type === "label") {
                Na__StartNew = true;
            } else if (Na__G === null) {
                // Column (or OCR region) change: carry on unless the sentence had ended
                Na__StartNew = Na__Pdf__EndsSentence(Na__Previous.text);
            } else if (Na__G <= 0 || Na__G > Na__Pitch * 1.45) {
                Na__StartNew = true;
                if (Na__G > 0 && Na__G <= Na__Pitch * 2.2) Na__AsNextItem();
            } else if (Na__Current.type === "list") {
                // An item runs on onto lines indented past its marker, or after a line that ran to the edge
                if (Na__AsNextItem()) {
                    Na__StartNew = true;
                } else {
                    Na__StartNew = !(Na__Line.x0 > Na__Current.x0 + Na__Line.size * 0.4 || !Na__Short(Na__Previous));
                }
            } else {
                const Na__Ends = Na__Pdf__EndsSentence(Na__Previous.text);
                const Na__ShortBefore = Na__Short(Na__Previous);
                const Na__Indented = Na__Edge && Na__Line.x0 > Na__Edge.left + Na__Line.size * 1.2;
                if (Na__Ends && (Na__ShortBefore || Na__Indented)) {
                    Na__StartNew = true;
                } else if (Na__ShortBefore && !Na__Ends) {
                    // A short line that ends no sentence: an address or a heading line (short lines
                    // stay lines), or a salutation before the letter's body (a new paragraph)
                    Na__Break = Na__Short(Na__Line) && !/^(dear|to|hi|hello|good (morning|afternoon))\b.*,$/i.test(Na__Previous.text);
                    Na__StartNew = !Na__Break;
                } else {
                    Na__StartNew = false;
                }
            }
        }

        if (Na__StartNew) {
            Na__Current = { ...Na__Kind, x0: Na__Line.x0, size: Na__Line.size, italic: Na__Line.italic || 0 };
            if (Na__Kind.type === "code") Na__Current.lines = [Na__Line.text];
            Na__Current.footnote = Na__Kind.type === "para" && Na__Line.size <= Na__Stats.body * 0.92 &&
                Na__Line.y > Na__Page.height * 0.5;   // small print low on the page (its number, a raised digit, is dropped)
            Na__Blocks.push(Na__Current);
        } else if (Na__Current.type === "code") {
            Na__Current.lines.push(Na__Line.text);
        } else if (Na__Break) {
            Na__Current.text += "\n" + Na__Kind.text;
            Na__Current.rich += "\n" + Na__Kind.rich;
        } else {
            Na__Pdf__JoinBlock(Na__Current, Na__Kind.text, Na__Kind.rich);
        }
        if (!Na__StartNew && Na__G !== null && Na__G > 0) Na__Current.pitch = Math.min(Na__Current.pitch || Infinity, Na__G);
        Na__Previous = Na__Line;
    });

    // A "heading" that reads as a sentence is a lead paragraph (a subtitle), or a quote in italics
    for (const Na__Block of Na__Blocks) {
        if (Na__Block.type !== "heading") continue;
        const Na__Sentence = (Na__Pdf__EndsSentence(Na__Block.text) && !/:$/.test(Na__Block.text) && Na__Block.text.length > 40) ||
            Na__Block.text.length > 100;
        if (Na__Sentence) Na__Block.type = Na__Block.italic >= 0.6 ? "quote" : "para";
    }
    return Na__Blocks;
}
// ------------------------------------------------------------


// FUNCTION | TableMarkdown - A table block as a GFM table (the house table style)
// ------------------------------------------------------------
function Na__Pdf__TableMarkdown(Na__Block) {
    const Na__Head = Na__Block.rows[0].map((Na__Cell) => Na__Pdf__EscapeInline(Na__Cell.text) || " ");
    const Na__Cell = (Na__Cell2) => Na__Pdf__RichMarkdown(Na__Cell2.rich || "", false).replace(/ {2}\n/g, " ") || " ";
    const Na__Lines = [
        "| " + Na__Head.join(" | ") + " |",
        "| " + Na__Block.aligns.map((Na__Align) => (Na__Align === "right" ? "---:" : "---")).join(" | ") + " |"
    ];
    for (const Na__Row of Na__Block.rows.slice(1)) Na__Lines.push("| " + Na__Row.map(Na__Cell).join(" | ") + " |");
    return Na__Lines.join("\n");
}
// ------------------------------------------------------------


// FUNCTION | BlockMarkdown - One block as Markdown
// ------------------------------------------------------------
function Na__Pdf__BlockMarkdown(Na__Block) {
    const Na__Rich = Na__Block.rich === undefined ? Na__Block.text : Na__Block.rich;
    switch (Na__Block.type) {
        case "marker"  : return Na__Block.text;
        case "heading" : return "#".repeat(Na__Block.level) + " " + Na__Pdf__EscapeInline(Na__Block.text.replace(/\n/g, " "));
        case "label"   : return "**" + Na__Pdf__EscapeInline(Na__Block.text) + "**";
        case "quote"   : return Na__Pdf__EscapeParagraph(Na__Block.text).split("\n").map((Na__Line) => "> " + Na__Line).join("\n");
        case "rule"    : return "---";
        case "table"   : return Na__Pdf__TableMarkdown(Na__Block);
        case "code"    : {
            const Na__Body = Na__Block.lines.join("\n");
            const Na__Fence = /```/.test(Na__Body) ? "~~~" : "```";
            return Na__Fence + "text\n" + Na__Body + "\n" + Na__Fence;
        }
        case "list"    : return (Na__Block.ordered ? Na__Block.number + ". " : "- ") + Na__Pdf__RichMarkdown(Na__Rich, false);
        default        : return Na__Pdf__RichMarkdown(Na__Rich, true);
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Internal Helpers - PDF.js
// -----------------------------------------------------------------------------

// FUNCTION | LoadLibrary - Import PDF.js once from the pinned runtime folder
// ------------------------------------------------------------
// Both files carry the pinned version in their URL, so a cached main module can never
// meet a worker from another release (PDF.js refuses a mismatched pair).
function Na__Pdf__LoadLibrary(Na__Settings) {
    if (!Na__Pdf__LibraryPromise) {
        const Na__Base = new URL(Na__Settings.NaMiniApp__RuntimeUrl, document.baseURI);
        const Na__Version = "?v=" + Na__Settings.NaMiniApp__RuntimeVersion;
        Na__Pdf__LibraryPromise = import(new URL("build/pdf.min.mjs" + Na__Version, Na__Base).href)
            .then((Na__Lib) => {
                Na__Lib.GlobalWorkerOptions.workerSrc = new URL("build/pdf.worker.min.mjs" + Na__Version, Na__Base).href;
                if (Na__Lib.version !== Na__Settings.NaMiniApp__RuntimeVersion) {
                    console.warn(`Text To Reader: PDF.js ${Na__Lib.version} loaded, ${Na__Settings.NaMiniApp__RuntimeVersion} expected.`);
                }
                return { lib: Na__Lib, base: Na__Base };
            })
            .catch((Na__Error) => {
                Na__Pdf__LibraryPromise = null;
                throw Na__Error;
            });
    }
    return Na__Pdf__LibraryPromise;
}
// ------------------------------------------------------------


// FUNCTION | PageItems - A page's text items in page points, top-left origin, rotation applied
// ------------------------------------------------------------
// Each item carries its style number (from the font's name) and its link, if a link
// annotation covers it.
function Na__Pdf__PageItems(Na__Lib, Na__TextContent, Na__Viewport, Na__Styles, Na__LinkRects) {
    const Na__Items = [];
    for (const Na__Item of Na__TextContent.items) {
        if (typeof Na__Item.str !== "string" || !Na__Item.str.trim()) continue;
        const Na__Tx = Na__Lib.Util.transform(Na__Viewport.transform, Na__Item.transform);
        if (Math.abs(Math.atan2(Na__Tx[1], Na__Tx[0])) > 0.17) continue;   // rotated: watermarks, margin notes
        const Na__Size = Math.hypot(Na__Tx[2], Na__Tx[3]);
        if (!(Na__Size > 0.5)) continue;
        const Na__Entry = {
            str   : Na__Item.str,
            x0    : Na__Tx[4],
            x1    : Na__Tx[4] + Na__Item.width * Na__Viewport.scale,
            y     : Na__Tx[5],
            size  : Na__Size,
            font  : Na__Item.fontName,
            style : (Na__Styles && Na__Styles.get(Na__Item.fontName)) || 0
        };
        Na__Items.push(...Na__Pdf__SplitAtLinks(Na__Entry, Na__LinkRects));
    }
    return Na__Items;
}
// ------------------------------------------------------------


// FUNCTION | SplitAtLinks - An item cut where a link covers only part of it, the linked words marked
// ------------------------------------------------------------
// PDF.js gives a whole run of text as one item, while a link's rectangle may cover two of its
// words. Character positions are taken as even across the item, snapped to word edges.
function Na__Pdf__SplitAtLinks(Na__Entry, Na__LinkRects) {
    if (!Na__LinkRects || !Na__LinkRects.length) return [Na__Entry];
    const Na__Y = Na__Entry.y - Na__Entry.size * 0.35;
    const Na__Rect = Na__LinkRects.find((Na__R) => Na__Y >= Na__R.y0 - 1 && Na__Y <= Na__R.y1 + 1 &&
        Na__R.x1 > Na__Entry.x0 + 1 && Na__R.x0 < Na__Entry.x1 - 1);
    if (!Na__Rect) return [Na__Entry];
    const Na__Width = Math.max(0.01, Na__Entry.x1 - Na__Entry.x0);
    const Na__Covered = (Math.min(Na__Rect.x1, Na__Entry.x1) - Math.max(Na__Rect.x0, Na__Entry.x0)) / Na__Width;
    if (Na__Covered >= 0.9) return [{ ...Na__Entry, link: Na__Rect.link }];

    const Na__Str = Na__Entry.str;
    const Na__PerPoint = Na__Str.length / Na__Width;
    const Na__Starts = [0];
    const Na__Ends = [];
    for (let Na__K = 1; Na__K < Na__Str.length; Na__K++) {
        if (/\s/.test(Na__Str[Na__K - 1]) && !/\s/.test(Na__Str[Na__K])) Na__Starts.push(Na__K);
        if (!/\s/.test(Na__Str[Na__K - 1]) && /\s/.test(Na__Str[Na__K])) Na__Ends.push(Na__K);
    }
    Na__Ends.push(Na__Str.replace(/[\s.,;:!?)\]]+$/, "").length);
    const Na__Nearest = (Na__List, Na__At) => Na__List.reduce((a, b) => (Math.abs(b - Na__At) < Math.abs(a - Na__At) ? b : a));
    const Na__From = Na__Nearest(Na__Starts, (Math.max(Na__Rect.x0, Na__Entry.x0) - Na__Entry.x0) * Na__PerPoint);
    const Na__To   = Na__Nearest(Na__Ends, (Math.min(Na__Rect.x1, Na__Entry.x1) - Na__Entry.x0) * Na__PerPoint);
    if (!(Na__To > Na__From)) return [Na__Entry];
    const Na__Part = (Na__A, Na__B, Na__Link) => ({
        ...Na__Entry,
        str  : Na__Str.slice(Na__A, Na__B),
        x0   : Na__Entry.x0 + Na__A / Na__PerPoint,
        x1   : Na__Entry.x0 + Na__B / Na__PerPoint,
        link : Na__Link
    });
    return [
        Na__Part(0, Na__From, undefined),
        Na__Part(Na__From, Na__To, Na__Rect.link),
        Na__Part(Na__To, Na__Str.length, undefined)
    ].filter((Na__Piece) => Na__Piece.str.length);
}
// ------------------------------------------------------------


// FUNCTION | TextQuality - Usable and garbage character counts
// ------------------------------------------------------------
function Na__Pdf__TextQuality(Na__Items) {
    let Na__Good = 0;
    let Na__Bad = 0;
    for (const Na__Item of Na__Items) {
        for (const Na__Char of Na__Item.str) {
            if (Na__Pdf__BadChar.test(Na__Char)) Na__Bad++;
            else if (Na__Pdf__GoodChar.test(Na__Char)) Na__Good++;
        }
    }
    return { good: Na__Good, bad: Na__Bad, ratio: Na__Bad / Math.max(1, Na__Good + Na__Bad) };
}
// ------------------------------------------------------------


// FUNCTION | PageGraphics - From one walk of the operator list: image cover, rules, font styles
// ------------------------------------------------------------
// The drawing transform is followed through save, restore, cm and form XObjects.
//   coverage : share of the page (0..1) its images cover. An image is painted into the unit
//              square, so its area is the transform's determinant. Scanners that slice a page
//              into strips add up; stencil masks (JBIG2, CCITT scans) count too.
//   rules    : horizontal lines across much of the page, clear of the top and bottom bands,
//              of table grids (a vertical line through them) and of boxes' edges.
//   styles   : each font's style number, from its name (getDocument fontExtraProperties).
async function Na__Pdf__PageGraphics(Na__Lib, Na__Page, Na__Viewport) {
    const Na__Ops = Na__Lib.OPS;
    const Na__ImageOps = new Set([
        Na__Ops.paintImageXObject, Na__Ops.paintInlineImageXObject, Na__Ops.paintImageMaskXObject
    ]);
    const Na__StrokeOps = new Set([Na__Ops.stroke, Na__Ops.closeStroke]);
    const Na__FillOps   = new Set([Na__Ops.fill, Na__Ops.eoFill, Na__Ops.fillStroke, Na__Ops.eoFillStroke,
                                   Na__Ops.closeFillStroke, Na__Ops.closeEOFillStroke]);
    const Na__Multiply = (Na__M, Na__N) => [
        Na__M[0] * Na__N[0] + Na__M[2] * Na__N[1], Na__M[1] * Na__N[0] + Na__M[3] * Na__N[1],
        Na__M[0] * Na__N[2] + Na__M[2] * Na__N[3], Na__M[1] * Na__N[2] + Na__M[3] * Na__N[3],
        Na__M[0] * Na__N[4] + Na__M[2] * Na__N[5] + Na__M[4], Na__M[1] * Na__N[4] + Na__M[3] * Na__N[5] + Na__M[5]
    ];
    const Na__List = await Na__Page.getOperatorList();
    const Na__Stack = [];
    const Na__FontIds = new Set();
    const Na__Strokes = [];
    const Na__Fills = [];
    let Na__Ctm = [1, 0, 0, 1, 0, 0];
    let Na__Area = 0;
    Na__List.fnArray.forEach((Na__Fn, Na__Index) => {
        const Na__Args = Na__List.argsArray[Na__Index];
        if (Na__Fn === Na__Ops.save) Na__Stack.push(Na__Ctm);
        else if (Na__Fn === Na__Ops.restore) Na__Ctm = Na__Stack.pop() || Na__Ctm;
        else if (Na__Fn === Na__Ops.transform && Na__Args?.length >= 6) Na__Ctm = Na__Multiply(Na__Ctm, Na__Args);
        else if (Na__Fn === Na__Ops.paintFormXObjectBegin) {
            Na__Stack.push(Na__Ctm);
            const Na__Matrix = Na__Args?.[0];
            if (Na__Matrix?.length >= 6) Na__Ctm = Na__Multiply(Na__Ctm, Array.from(Na__Matrix));
        } else if (Na__Fn === Na__Ops.paintFormXObjectEnd) Na__Ctm = Na__Stack.pop() || Na__Ctm;
        else if (Na__ImageOps.has(Na__Fn)) Na__Area += Math.abs(Na__Ctm[0] * Na__Ctm[3] - Na__Ctm[1] * Na__Ctm[2]);
        else if (Na__Fn === Na__Ops.setFont && Na__Args?.[0]) Na__FontIds.add(Na__Args[0]);
        else if (Na__Fn === Na__Ops.constructPath && Na__Args?.[2]) {
            const [Na__Op, , Na__MinMax] = Na__Args;
            const Na__Kind = Na__StrokeOps.has(Na__Op) ? Na__Strokes : Na__FillOps.has(Na__Op) ? Na__Fills : null;
            if (!Na__Kind) return;
            const Na__M = Na__Multiply(Na__Viewport.transform, Na__Ctm);
            const Na__Xs = [];
            const Na__Ys = [];
            for (const [Na__X, Na__Y] of [[Na__MinMax[0], Na__MinMax[1]], [Na__MinMax[2], Na__MinMax[3]], [Na__MinMax[0], Na__MinMax[3]], [Na__MinMax[2], Na__MinMax[1]]]) {
                Na__Xs.push(Na__M[0] * Na__X + Na__M[2] * Na__Y + Na__M[4]);
                Na__Ys.push(Na__M[1] * Na__X + Na__M[3] * Na__Y + Na__M[5]);
            }
            Na__Kind.push({ x0: Math.min(...Na__Xs), x1: Math.max(...Na__Xs), y0: Math.min(...Na__Ys), y1: Math.max(...Na__Ys) });
        }
    });
    const [Na__X0, Na__Y0, Na__X1, Na__Y1] = Na__Page.view;
    const Na__PageArea = Math.abs((Na__X1 - Na__X0) * (Na__Y1 - Na__Y0)) || 1;

    const Na__Styles = new Map();
    for (const Na__Id of Na__FontIds) {
        try {
            if (!Na__Page.commonObjs.has(Na__Id)) continue;
            const Na__Font = Na__Page.commonObjs.get(Na__Id);
            Na__Styles.set(Na__Id, Na__Pdf__FontStyle(Na__Font?.name || ""));
        } catch { /* a font PDF.js could not load: plain */ }
    }

    const Na__W = Na__Viewport.width;
    const Na__H = Na__Viewport.height;
    const Na__Verticals = [...Na__Strokes, ...Na__Fills].filter((Na__S) => Na__S.x1 - Na__S.x0 <= 2 && Na__S.y1 - Na__S.y0 > 5);
    const Na__Boxes = Na__Fills.filter((Na__S) => Na__S.y1 - Na__S.y0 > 4);
    const Na__Rules = [];
    for (const Na__S of [...Na__Strokes.filter((Na__S2) => Na__S2.y1 - Na__S2.y0 <= 1.5), ...Na__Fills.filter((Na__S2) => Na__S2.y1 - Na__S2.y0 <= 2.5)]) {
        const Na__Y = (Na__S.y0 + Na__S.y1) / 2;
        if (Na__S.x1 - Na__S.x0 < Na__W * 0.4 || Na__Y < Na__H * 0.08 || Na__Y > Na__H * 0.92) continue;
        if (Na__Verticals.some((Na__V) => Na__V.x0 >= Na__S.x0 - 2 && Na__V.x1 <= Na__S.x1 + 2 && Na__Y >= Na__V.y0 - 1.5 && Na__Y <= Na__V.y1 + 1.5)) continue;
        if (Na__Boxes.some((Na__B) => Math.abs(Na__B.y0 - Na__Y) <= 1.5 || Math.abs(Na__B.y1 - Na__Y) <= 1.5)) continue;
        if (Na__Rules.some((Na__R) => Math.abs(Na__R.y - Na__Y) <= 3)) continue;
        Na__Rules.push({ y: Na__Y, x0: Na__S.x0, x1: Na__S.x1 });
    }
    // The table grid: vertical lines (cell sides) and horizontal ones with shading edges (row sides)
    const Na__Grid = {
        verticals   : Na__Verticals.map((Na__V) => ({ x: (Na__V.x0 + Na__V.x1) / 2, y0: Na__V.y0, y1: Na__V.y1 })),
        horizontals : [
            ...[...Na__Strokes.filter((Na__S2) => Na__S2.y1 - Na__S2.y0 <= 1.5), ...Na__Fills.filter((Na__S2) => Na__S2.y1 - Na__S2.y0 <= 2.5)]
                .filter((Na__S2) => Na__S2.x1 - Na__S2.x0 > 5).map((Na__S2) => ({ y: (Na__S2.y0 + Na__S2.y1) / 2, x0: Na__S2.x0, x1: Na__S2.x1 })),
            ...Na__Boxes.flatMap((Na__B) => [{ y: Na__B.y0, x0: Na__B.x0, x1: Na__B.x1 }, { y: Na__B.y1, x0: Na__B.x0, x1: Na__B.x1 }])
        ]
    };
    return { coverage: Math.min(1, Na__Area / Na__PageArea), rules: Na__Rules, styles: Na__Styles, grid: Na__Grid };
}
// ------------------------------------------------------------


// FUNCTION | PageLinks - The page's web and mail links as rectangles in page points
// ------------------------------------------------------------
async function Na__Pdf__PageLinks(Na__Page, Na__Viewport) {
    let Na__Annotations = [];
    try {
        Na__Annotations = await Na__Page.getAnnotations();
    } catch {
        return [];
    }
    const Na__Rects = [];
    for (const Na__Annotation of Na__Annotations) {
        if (Na__Annotation.subtype !== "Link" || typeof Na__Annotation.url !== "string" || !Na__Annotation.rect) continue;
        if (!/^(https?:|mailto:)/i.test(Na__Annotation.url)) continue;
        const Na__T = Na__Viewport.transform;
        const [Na__R0, Na__R1, Na__R2, Na__R3] = Na__Annotation.rect;
        const Na__A = Na__T[0] * Na__R0 + Na__T[2] * Na__R1 + Na__T[4];
        const Na__B = Na__T[1] * Na__R0 + Na__T[3] * Na__R1 + Na__T[5];
        const Na__C = Na__T[0] * Na__R2 + Na__T[2] * Na__R3 + Na__T[4];
        const Na__D = Na__T[1] * Na__R2 + Na__T[3] * Na__R3 + Na__T[5];
        let Na__Index = Na__Pdf__Links.indexOf(Na__Annotation.url);
        if (Na__Index < 0) Na__Index = Na__Pdf__Links.push(Na__Annotation.url) - 1;
        Na__Rects.push({
            x0 : Math.min(Na__A, Na__C), x1 : Math.max(Na__A, Na__C),
            y0 : Math.min(Na__B, Na__D), y1 : Math.max(Na__B, Na__D),
            link : Na__Index
        });
    }
    return Na__Rects;
}
// ------------------------------------------------------------


// FUNCTION | LoadOcrModule - The OCR module if it is present and speaks contract v1, else null
// ------------------------------------------------------------
async function Na__Pdf__LoadOcrModule() {
    try {
        const Na__Module = await import(Na__Pdf__OcrModuleUrl);
        const Na__Needed = ["NaPdfOcr__GetStatus", "NaPdfOcr__Install", "NaPdfOcr__RenderScale", "NaPdfOcr__RecognisePage"];
        return Na__Needed.every((Na__Name) => typeof Na__Module[Na__Name] === "function") ? Na__Module : null;
    } catch (Na__Error) {
        console.warn("Text To Reader: text recognition (OCR) module not available:", Na__Error);
        return null;
    }
}
// ------------------------------------------------------------


// FUNCTION | OcrItems - OCR lines as page items, in page points
// ------------------------------------------------------------
// A box is about 1.2 times its text's size (PaddleOCR draws it a little outside the ink),
// so the size is the box height over 1.2, rounded to half a point to quieten the noise.
function Na__Pdf__OcrItems(Na__Lines, Na__Scale) {
    return (Na__Lines || []).filter((Na__Line) => Na__Line.text && Na__Line.text.trim()).map((Na__Line) => ({
        str   : Na__Line.text.trim(),
        x0    : Na__Line.box.x / Na__Scale,
        x1    : (Na__Line.box.x + Na__Line.box.width) / Na__Scale,
        y     : (Na__Line.box.y + Na__Line.box.height * 0.8) / Na__Scale,   // about the baseline
        size  : Math.round(Na__Line.box.height / Na__Scale / 1.2 * 2) / 2,
        font  : "ocr",
        style : 0
    }));
}
// ------------------------------------------------------------


// FUNCTION | RecognisePage - Draw a page for OCR and turn the lines it finds into page items
// ------------------------------------------------------------
async function Na__Pdf__RecognisePage(Na__Ocr, Na__Page, Na__Signal) {
    const Na__Unscaled = Na__Page.getViewport({ scale: 1 });
    const Na__Scale = Na__Ocr.NaPdfOcr__RenderScale(Na__Unscaled.width, Na__Unscaled.height);
    const Na__Viewport = Na__Page.getViewport({ scale: Na__Scale });
    const Na__Canvas = document.createElement("canvas");
    Na__Canvas.width  = Math.ceil(Na__Viewport.width);
    Na__Canvas.height = Math.ceil(Na__Viewport.height);
    try {
        // "print": draw what would print, and step the drawing with microtasks. The default
        // "display" waits on requestAnimationFrame, which never fires in a background tab
        // (or a phone with its screen off), so OCR of a long scan would stall there.
        await Na__Page.render({ canvas: Na__Canvas, viewport: Na__Viewport, intent: "print" }).promise;
        const Na__Bitmap = await createImageBitmap(Na__Canvas);
        const Na__Result = await Na__Ocr.NaPdfOcr__RecognisePage(Na__Bitmap, { signal: Na__Signal });
        return { ms: Na__Result.ms, items: Na__Pdf__OcrItems(Na__Result.lines, Na__Scale) };
    } finally {
        Na__Canvas.width = 0;
        Na__Canvas.height = 0;
    }
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Exports
// -----------------------------------------------------------------------------

// FUNCTION | IsPdfFile - Whether a chosen file is a PDF (by type or name)
// ------------------------------------------------------------
export function Na__TextToReader__IsPdfFile(Na__File) {
    if (!Na__File) return false;
    return Na__File.type === "application/pdf" || /\.pdf$/i.test(Na__File.name || "");
}
// ------------------------------------------------------------


// FUNCTION | ColumnRuns - A column's lines cut into runs wherever the gap is far wider than a line
// ------------------------------------------------------------
function Na__Pdf__ColumnRuns(Na__Lines, Na__GapLimit) {
    const Na__Runs = [];
    for (const Na__Line of Na__Lines) {
        const Na__Run = Na__Runs[Na__Runs.length - 1];
        if (Na__Run && Na__Line.y - Na__Run.foot <= Na__GapLimit) {
            Na__Run.lines.push(Na__Line);
            Na__Run.foot = Na__Line.y;
        } else {
            Na__Runs.push({ top: Na__Line.y - Na__Line.size, foot: Na__Line.y, lines: [Na__Line] });
        }
    }
    return Na__Runs;
}
// ------------------------------------------------------------


// FUNCTION | PdfOrderPageLines - A page's items as lines (and tables) in reading order
// ------------------------------------------------------------
// A whole page in two columns (a gutter down the page): each column is cut into runs of
// closely spaced lines. Runs that sit beside a run of the other column are the columns
// proper; a run with nothing beside it (a title, a heading over both columns, the short last
// line of a full-width paragraph) spans the page, as do lines crossing the gutter. Spanning
// lines cut the page into zones, and inside each zone the left column is read to its foot
// before the right.
// Otherwise the page is laid out band by band (Na__Pdf__LayoutRows): boxed two-column blocks
// and tables are found between its full-width lines.
// Na__Options: { pageHeight, band } keep running header and footer rows out of tables;
// { rules, grid } from PageGraphics: rules are placed between the lines, and the
// table grid's lines cut cells (vertical) and part rows (horizontal).
export function Na__TextToReader__PdfOrderPageLines(Na__Items, Na__PageWidth, Na__Options = {}) {
    const Na__Ocr = Na__Items.length > 0 && Na__Items.every((Na__Item) => Na__Item.font === "ocr");
    const Na__GutterX = Na__Pdf__FindGutter(Na__Items, Na__PageWidth);
    if (Na__GutterX === null) {
        const Na__Grid = Na__Options.grid || null;
        const Na__Bands = Na__Options.pageHeight ? {
            top  : Na__Options.pageHeight * (Na__Options.band || Na__Pdf__Defaults.NaMiniApp__HeaderFooterBand),
            foot : Na__Options.pageHeight * (1 - (Na__Options.band || Na__Pdf__Defaults.NaMiniApp__HeaderFooterBand))
        } : null;
        const Na__Pieces = Na__Pdf__BuildLines(Na__Items, "F", Na__Ocr ? "ocr" : "text", Na__Grid && Na__Grid.verticals);
        return Na__Pdf__PlaceRules(Na__Pdf__LayoutRows(Na__Pdf__GroupRows(Na__Pieces), Na__Grid, Na__Bands), Na__Options.rules);
    }

    const Na__LeftAll  = Na__Pdf__BuildLines(Na__Items.filter((Na__Item) => Na__Item.x1 <= Na__GutterX), "L", false);
    const Na__RightAll = Na__Pdf__BuildLines(Na__Items.filter((Na__Item) => Na__Item.x0 >= Na__GutterX), "R", false);
    const Na__Full     = Na__Pdf__BuildLines(Na__Items.filter((Na__Item) => Na__Item.x0 < Na__GutterX && Na__Item.x1 > Na__GutterX), "F", false);

    // Runs break where a gap is wider than about two and a half lines
    const Na__Pitches = [];
    for (const Na__Col of [Na__LeftAll, Na__RightAll]) {
        for (let Na__K = 1; Na__K < Na__Col.length; Na__K++) {
            const Na__Gap = Na__Col[Na__K].y - Na__Col[Na__K - 1].y;
            if (Na__Gap > 0) Na__Pitches.push(Na__Gap);
        }
    }
    const Na__SizeGuess = Na__Pdf__Percentile([...Na__LeftAll, ...Na__RightAll].map((Na__Line) => Na__Line.size), 0.5) || 10;
    const Na__GapLimit = 2.6 * (Na__Pitches.length ? Na__Pdf__Percentile(Na__Pitches, 0.5) : Na__SizeGuess * 1.2);
    const Na__LeftRuns  = Na__Pdf__ColumnRuns(Na__LeftAll, Na__GapLimit);
    const Na__RightRuns = Na__Pdf__ColumnRuns(Na__RightAll, Na__GapLimit);
    const Na__Beside = (Na__Run, Na__Others) => Na__Others.some((Na__Other) => Na__Run.top <= Na__Other.foot && Na__Other.top <= Na__Run.foot);

    const Na__Left = [];
    const Na__Right = [];
    const Na__Spanning = [...Na__Full];
    for (const Na__Run of Na__LeftRuns) (Na__Beside(Na__Run, Na__RightRuns) ? Na__Left : Na__Spanning).push(...Na__Run.lines);
    for (const Na__Run of Na__RightRuns) (Na__Beside(Na__Run, Na__LeftRuns) ? Na__Right : Na__Spanning).push(...Na__Run.lines);
    for (const Na__Line of Na__Spanning) Na__Line.col = "F";
    Na__Spanning.sort((a, b) => a.y - b.y || a.x0 - b.x0);

    const Na__Ordered = [];
    let Na__ZoneTop = -Infinity;
    for (const Na__Divider of [...Na__Spanning, null]) {
        const Na__ZoneFoot = Na__Divider ? Na__Divider.y : Infinity;
        const Na__InZone = (Na__Line) => Na__Line.y > Na__ZoneTop && Na__Line.y <= Na__ZoneFoot;
        Na__Ordered.push(...Na__Left.filter(Na__InZone), ...Na__Right.filter(Na__InZone));
        if (Na__Divider) Na__Ordered.push(Na__Divider);
        Na__ZoneTop = Na__ZoneFoot;
    }
    return Na__Pdf__PlaceRules(Na__Ordered, Na__Options.rules);
}
// ------------------------------------------------------------


// FUNCTION | PdfPagesToMarkdown - Read pages (lines in reading order) as one Markdown article
// ------------------------------------------------------------
// Na__Pages: [{ number, width, height, source: "text" | "ocr" | "none", lines, note }].
// Pure: it can run again on more pages (a long PDF fills in), never changing its input
// beyond each line's drop flag, which is worked out afresh every time.
export function Na__TextToReader__PdfPagesToMarkdown(Na__Pages, Na__Config) {
    const Na__Settings = { ...Na__Pdf__Defaults, ...(Na__Config || {}) };
    Na__Pdf__MarkRunningLines(Na__Pages, Na__Settings.NaMiniApp__HeaderFooterBand);

    // Hyphenated words the document writes whole somewhere, so a line-end split keeps its hyphen
    Na__Pdf__Compounds = new Set();
    for (const Na__Page of Na__Pages) {
        for (const Na__Line of Na__Page.lines) {
            for (const Na__Word of (Na__Line.text || "").matchAll(/\p{L}+-\p{L}+/gu)) Na__Pdf__Compounds.add(Na__Word[0].toLowerCase());
        }
    }

    const Na__TextStats = Na__Pdf__GroupStats(Na__Pages.filter((Na__Page) => Na__Page.source === "text"), false);
    const Na__OcrStats  = Na__Pdf__GroupStats(Na__Pages.filter((Na__Page) => Na__Page.source === "ocr"), true);

    const Na__Out = [];
    let Na__Last = null;
    for (const Na__Page of Na__Pages) {
        const Na__Stats  = Na__Page.source === "ocr" ? Na__OcrStats : Na__TextStats;
        const Na__Blocks = Na__Pdf__PageBlocks(Na__Page, Na__Stats);
        const Na__Marker = { type: "marker", text: `<!-- Page ${Na__Page.number}${Na__Page.note ? ": " + Na__Page.note : ""} -->` };
        let Na__MarkerPlaced = false;
        Na__Blocks.forEach((Na__Block, Na__Index) => {
            // A paragraph broken by the page carries on: the page marker follows it instead
            if (Na__Index === 0 && Na__Last && Na__Block.type === "para" &&
                (Na__Last.type === "para" || Na__Last.type === "list") &&
                Na__Pdf__ContinuesAcrossPage(Na__Last.text, Na__Block.text)) {
                Na__Pdf__JoinBlock(Na__Last, Na__Block.text, Na__Block.rich === undefined ? Na__Block.text : Na__Block.rich);
                return;
            }
            if (!Na__MarkerPlaced) {
                Na__Out.push(Na__Marker);
                Na__MarkerPlaced = true;
            }
            const Na__Copy = { ...Na__Block };
            Na__Out.push(Na__Copy);
            if (!Na__Copy.footnote) Na__Last = Na__Copy;   // a page's footnotes never take its next page's text
        });
        if (!Na__MarkerPlaced) Na__Out.push(Na__Marker);
    }

    let Na__Markdown = "";
    Na__Out.forEach((Na__Block, Na__Index) => {
        const Na__Prior = Na__Out[Na__Index - 1];
        if (Na__Index > 0) {
            Na__Markdown += (Na__Prior.type === "list" && Na__Block.type === "list" && Na__Prior.ordered === Na__Block.ordered) ? "\n" : "\n\n";
        }
        Na__Markdown += Na__Pdf__BlockMarkdown(Na__Block);
    });
    return Na__Markdown + "\n";
}
// ------------------------------------------------------------


// FUNCTION | PdfToMarkdown - Read a whole PDF; long ones report what is read so far
// ------------------------------------------------------------
// Na__Options:
//   config         AppConfig NaMiniApp__Pdf
//   signal         AbortSignal: a newer file cancels this one
//   onProgress     ({ phase: "open" | "text" | "ocr" | "ocr-failed", page, pages, pageNumber, error })
//                  for the status line; "ocr-failed" names a scanned page whose recognition failed
//   onPartial      (markdown, { pagesRead, pages }) at most every NaMiniApp__PartialEveryMs
//   onOcrConsent   ({ scanPages, pages, status, install }) -> Promise<boolean>: asked when scanned
//                  pages need a model that is not on the device; install({ onProgress, signal })
//                  downloads it. Without it, scanned pages are skipped.
//   library        { lib, base }: tests only, in place of the pinned runtime
// Resolves { markdown, pages, textPages, ocrPages, skippedPages, failedPages, ocrMs, ms }:
// failedPages lists the scanned pages whose recognition failed (they count as skipped too).
export async function Na__TextToReader__PdfToMarkdown(Na__Data, Na__Options = {}) {
    const Na__Settings = { ...Na__Pdf__Defaults, ...(Na__Options.config || {}) };
    const { signal: Na__Signal, onProgress: Na__OnProgress, onPartial: Na__OnPartial, onOcrConsent: Na__OnOcrConsent } = Na__Options;
    const Na__Start = performance.now();
    Na__Pdf__Links = [];

    Na__OnProgress?.({ phase: "open", page: 0, pages: 0 });
    // library: { lib, base } lets a node test pass PDF.js's legacy build (the modern one is browser-only)
    const { lib: Na__Lib, base: Na__Base } = Na__Options.library || await Na__Pdf__LoadLibrary(Na__Settings);
    Na__Signal?.throwIfAborted();

    const Na__Task = Na__Lib.getDocument({
        data                : new Uint8Array(Na__Data),
        wasmUrl             : new URL("wasm/", Na__Base).href,
        standardFontDataUrl : new URL("standard_fonts/", Na__Base).href,
        cMapUrl             : new URL("cmaps/", Na__Base).href,
        cMapPacked          : true,
        iccUrl              : new URL("iccs/", Na__Base).href,
        isEvalSupported     : false,
        useSystemFonts      : false,
        enableXfa           : false,
        fontExtraProperties : true      // font names, for bold, italic and monospaced runs
    });
    const Na__OnAbort = () => Na__Task.destroy();
    Na__Signal?.addEventListener("abort", Na__OnAbort, { once: true });

    let Na__Doc = null;
    try {
        Na__Doc = await Na__Task.promise;
        const Na__PageCount = Na__Doc.numPages;
        const Na__Pages = [];
        let Na__LastPartial = performance.now();
        const Na__MaybePartial = (Na__Force) => {
            if (!Na__OnPartial) return;
            if (!Na__Force && performance.now() - Na__LastPartial < Na__Settings.NaMiniApp__PartialEveryMs) return;
            Na__LastPartial = performance.now();
            Na__OnPartial(Na__TextToReader__PdfPagesToMarkdown(Na__Pages, Na__Settings), {
                pagesRead : Na__Pages.length,
                pages     : Na__PageCount
            });
        };

        // Pass 1: every page's text layer (milliseconds a page); scans are only noted
        for (let Na__Number = 1; Na__Number <= Na__PageCount; Na__Number++) {
            Na__Signal?.throwIfAborted();
            Na__OnProgress?.({ phase: "text", page: Na__Number, pages: Na__PageCount });
            const Na__Page = await Na__Doc.getPage(Na__Number);
            const Na__Viewport = Na__Page.getViewport({ scale: 1 });
            const Na__Content = await Na__Page.getTextContent();
            const Na__Graphics = await Na__Pdf__PageGraphics(Na__Lib, Na__Page, Na__Viewport);
            const Na__Links = await Na__Pdf__PageLinks(Na__Page, Na__Viewport);
            const Na__Items = Na__Pdf__PageItems(Na__Lib, Na__Content, Na__Viewport, Na__Graphics.styles, Na__Links);
            const Na__Quality = Na__Pdf__TextQuality(Na__Items);
            const Na__Record = {
                number : Na__Number,
                width  : Na__Viewport.width,
                height : Na__Viewport.height,
                source : "text",
                lines  : [],
                note   : ""
            };
            // A scan: short of usable text AND mostly image. A blank page, or a short page with
            // a logo, is read as it is, never sent to OCR. Garbled text is only OCR'd when the
            // page is an image underneath too (a bad OCR layer over a scan); otherwise it is dropped.
            const Na__Garbled = Na__Quality.good + Na__Quality.bad > 0 && Na__Quality.ratio > Na__Settings.NaMiniApp__MaxGarbageRatio;
            const Na__Sparse  = Na__Quality.good < Na__Settings.NaMiniApp__MinUsableChars;
            const Na__Scanned = (Na__Sparse || Na__Garbled) && Na__Graphics.coverage >= Na__Settings.NaMiniApp__MinImageCoverage;
            if (Na__Garbled && !Na__Scanned) {
                Na__Record.note = "unreadable text dropped";
            } else if (Na__Scanned) {
                Na__Record.source = "none";
                Na__Record.note = Na__Garbled ? "unreadable text" : "scanned";
            } else {
                Na__Record.lines = Na__TextToReader__PdfOrderPageLines(Na__Items, Na__Viewport.width, {
                    rules: Na__Graphics.rules, grid: Na__Graphics.grid, pageHeight: Na__Viewport.height, band: Na__Settings.NaMiniApp__HeaderFooterBand
                });
            }
            Na__Page.cleanup();
            Na__Pages.push(Na__Record);
            if (Na__Number < Na__PageCount) Na__MaybePartial(false);
        }

        // Pass 2: scanned pages through OCR, with the user's agreement to download its model
        const Na__ScanPages = Na__Pages.filter((Na__Record) => Na__Record.source === "none");
        let Na__OcrPages = 0;
        let Na__OcrMs = 0;
        const Na__FailedPages = [];
        if (Na__ScanPages.length) {
            const Na__Ocr = await Na__Pdf__LoadOcrModule();
            let Na__Allowed = false;
            if (Na__Ocr) {
                const Na__Status = await Na__Ocr.NaPdfOcr__GetStatus();
                Na__Allowed = Na__Status.installed;
                if (!Na__Allowed && Na__OnOcrConsent) {
                    if (Na__Pages.some((Na__Record) => Na__Record.lines.length)) Na__MaybePartial(true);
                    Na__Allowed = await Na__OnOcrConsent({
                        scanPages : Na__ScanPages.length,
                        pages     : Na__PageCount,
                        status    : Na__Status,
                        install   : (Na__InstallOptions) => Na__Ocr.NaPdfOcr__Install(Na__InstallOptions)
                    });
                }
            }
            for (const [Na__Index, Na__Record] of Na__ScanPages.entries()) {
                if (!Na__Allowed) {
                    Na__Record.note += Na__Ocr ? ", text recognition not installed" : ", text recognition unavailable";
                    continue;
                }
                Na__Signal?.throwIfAborted();
                Na__OnProgress?.({ phase: "ocr", page: Na__Index + 1, pages: Na__ScanPages.length, pageNumber: Na__Record.number });
                // One page's failure never costs the others: it is noted, reported and passed over.
                // Only a cancel (a newer file, or Stop) ends the whole PDF.
                let Na__Page = null;
                try {
                    Na__Page = await Na__Doc.getPage(Na__Record.number);
                    const Na__Result = await Na__Pdf__RecognisePage(Na__Ocr, Na__Page, Na__Signal);
                    Na__Record.source = "ocr";
                    Na__Record.note = "text recognised";
                    Na__Record.lines = Na__TextToReader__PdfOrderPageLines(Na__Result.items, Na__Record.width, {
                        pageHeight: Na__Record.height, band: Na__Settings.NaMiniApp__HeaderFooterBand
                    });
                    Na__OcrPages++;
                    Na__OcrMs += Na__Result.ms || 0;
                } catch (Na__Error) {
                    if (Na__Signal?.aborted || Na__Error?.name === "AbortError") throw Na__Error;
                    Na__Record.note += ", text recognition failed";
                    Na__FailedPages.push(Na__Record.number);
                    console.warn(`Text To Reader: text recognition failed on page ${Na__Record.number}:`, Na__Error);
                    Na__OnProgress?.({
                        phase: "ocr-failed", page: Na__Index + 1, pages: Na__ScanPages.length, pageNumber: Na__Record.number,
                        error: Na__Error?.message || String(Na__Error)
                    });
                } finally {
                    try { Na__Page?.cleanup(); } catch { /* the page went with the error */ }
                }
                if (Na__Index < Na__ScanPages.length - 1) Na__MaybePartial(true);
            }
        }

        const Na__Markdown = Na__TextToReader__PdfPagesToMarkdown(Na__Pages, Na__Settings);
        return {
            markdown     : Na__Markdown,
            pages        : Na__PageCount,
            textPages    : Na__Pages.filter((Na__Record) => Na__Record.source === "text").length,
            ocrPages     : Na__OcrPages,
            skippedPages : Na__ScanPages.length - Na__OcrPages,
            failedPages  : Na__FailedPages,
            ocrMs        : Na__OcrMs,
            ms           : performance.now() - Na__Start
        };
    } finally {
        Na__Signal?.removeEventListener("abort", Na__OnAbort);
        // The loading task owns the document and its worker: destroying it frees both
        try { await Na__Task.destroy(); } catch { /* already torn down */ }
    }
}
// ------------------------------------------------------------


// FUNCTION | PdfOcrLinesToMarkdown - Tests only: OCR lines of whole pages through the same reflow
// ------------------------------------------------------------
// Na__OcrPages: [{ number, width, height, scale, lines (OCR contract v1 lines) }]
export function Na__TextToReader__PdfOcrLinesToMarkdown(Na__OcrPages, Na__Config) {
    const Na__Pages = Na__OcrPages.map((Na__Page) => ({
        number : Na__Page.number,
        width  : Na__Page.width,
        height : Na__Page.height,
        source : "ocr",
        note   : "text recognised",
        lines  : Na__TextToReader__PdfOrderPageLines(Na__Pdf__OcrItems(Na__Page.lines, Na__Page.scale), Na__Page.width, { pageHeight: Na__Page.height })
    }));
    return Na__TextToReader__PdfPagesToMarkdown(Na__Pages, Na__Config);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------
