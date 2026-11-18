// =============================================================================
// NOBLE ARCHITECTURE - TEXT TO READER - PDF OCR WORKER
// =============================================================================
//
// FILE    : MiniApp__TextToReader__PdfOcrWorker__.js
// AUTHOR  : Adam Noble - Noble Architecture
// PURPOSE : Read the text on a scanned page: PaddleOCR PP-OCRv6 text detection
//           and recognition (ONNX) on ONNX Runtime Web, inside a Web Worker
// CREATED : 18-Nov-2026
//
// HOW IT RUNS:
//   MiniApp__TextToReader__PdfOcr__.js starts this file as a module worker and
//   talks to it by message: "init" loads ONNX Runtime and the two models (bytes
//   read from Cache Storage, where the installer put them), "recognise" takes a
//   page as an ImageBitmap and answers with its lines, "cancel" stops a page
//   between batches. Node tests import the pipeline functions directly: the
//   message handler is only attached inside a worker.
//
// THE PIPELINE (PaddleOCR's own, re-implemented here without OpenCV):
//   1. Detection: the page as BGR, normalised (x/255 - mean) / std, both sides a
//      multiple of 32, into PP-OCRv6 det. It returns a text probability map.
//   2. DB post-process: threshold the map, take each connected blob, its
//      smallest rotated rectangle (convex hull + rotating calipers), keep it if
//      its mean probability passes, grow it ("unclip") by area * ratio /
//      perimeter, scale back to page pixels.
//   3. Crops: each rectangle is sampled straight from the page into a 48 px
//      high strip (bilinear, supersampled when shrinking), turned upright when
//      it is 1.5 times taller than wide, normalised (x/255 - 0.5) / 0.5, BGR.
//   4. Recognition: strips batched by aspect ratio into PP-OCRv6 rec, decoded
//      by CTC (class 0 is the blank, class i is dictionary entry i - 1, and the
//      last class is the space appended to the dictionary).
//   5. Reading order: lines grouped into rows by their vertical centres, rows
//      top to bottom, lines in a row left to right.
//
// ATTRIBUTION:
//   The constants and the processing order follow PaddleOCR's official browser
//   SDK, @paddleocr/paddleocr-js 0.4.2 (Apache-2.0, Copyright PaddlePaddle
//   Authors, github.com/PaddlePaddle/PaddleOCR/tree/main/paddleocr-js), and its
//   default OCR pipeline config: det limit_side_len 64 / limit_type min /
//   max_side_limit 4000, thresh 0.3, box_thresh 0.6, unclip_ratio 1.5,
//   max_candidates 3000, rec image_shape [3, 48, 320], max width 3200, batch 6,
//   score_thresh 0. The models are PaddlePaddle's PP-OCRv6 ONNX exports
//   (Apache-2.0). This file is new code; no SDK source is copied.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Constants
// -----------------------------------------------------------------------------

// Detection: PaddleOCR's default OCR pipeline values (see ATTRIBUTION).
// Mean and std apply to the B, G and R planes in that order (the models were
// trained on OpenCV's BGR images).
export const NaOcr__DetConfig = Object.freeze({
    mean          : [0.485, 0.456, 0.406],
    std           : [0.229, 0.224, 0.225],
    limitSideLen  : 64,          // limit_type "min": only pages smaller than this grow
    maxSideLimit  : 4000,        // the model's own ceiling; the caller may set a lower one
    thresh        : 0.3,
    boxThresh     : 0.6,
    unclipRatio   : 1.5,
    maxCandidates : 3000,
    minSide       : 3            // boxes thinner than this are noise (SDK DET_BOX_MIN_SIZE)
});

// Recognition: input height 48, width at least 320 and at most 3200 px.
export const NaOcr__RecConfig = Object.freeze({
    height     : 48,
    baseWidth  : 320,
    maxWidth   : 3200,
    batchSize  : 6,
    scoreThresh: 0
});

// Characters kept when the charset is "latin": PP-OCRv6 rec reads about 50
// languages from one 18,708-entry dictionary (CJK included). On English pages a
// smudge can come out as a CJK look-alike, so by default only these blocks may
// win the CTC vote. Each range is [first, last] code point, inclusive.
const NaOcr__LatinRanges = [
    [0x0020, 0x007E],   // Basic Latin
    [0x00A0, 0x024F],   // Latin-1 Supplement, Latin Extended-A and -B
    [0x0370, 0x03FF],   // Greek (mu, omega, pi in technical text)
    [0x2010, 0x205E],   // General Punctuation: dashes, quotes, bullet, ellipsis
    [0x20A0, 0x20CF],   // Currency symbols
    [0x2100, 0x218F],   // Letterlike symbols and number forms (TM, No., fractions)
    [0x2190, 0x21FF],   // Arrows
    [0x2200, 0x22FF],   // Mathematical operators
    [0x25A0, 0x25FF]    // Geometric shapes (square and round bullets)
];

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Dictionary
// -----------------------------------------------------------------------------

// FUNCTION | Read the character dictionary out of the rec model's inference.yml
// ------------------------------------------------------------
// The dictionary is the YAML list under PostProcess > character_dict. Its items
// are plain scalars or single-quoted ('' stands for one quote); double quotes
// are handled too. A full YAML parser is not needed for this one list.
export function NaOcr__ParseDictionary(Na__YamlText) {
    const Na__Lines = Na__YamlText.split(/\r?\n/);
    const Na__Dict = [];
    let Na__InDict = false;
    for (const Na__Line of Na__Lines) {
        if (!Na__InDict) {
            if (/^\s*character_dict:\s*$/.test(Na__Line)) Na__InDict = true;
            continue;
        }
        const Na__Match = /^(\s*)- (.*)$/.exec(Na__Line);
        if (!Na__Match) {
            if (Na__Line.trim() === "") continue;
            break;                                   // the next key ends the list
        }
        Na__Dict.push(NaOcr__YamlScalar(Na__Match[2]));
    }
    if (Na__Dict.length === 0) throw new Error("NaPdfOcr: no character_dict in the rec inference.yml");
    return Na__Dict;
}
// ------------------------------------------------------------


// FUNCTION | One YAML scalar as written in the dictionary list
// ------------------------------------------------------------
function NaOcr__YamlScalar(Na__Raw) {
    if (Na__Raw.length >= 2 && Na__Raw[0] === "'" && Na__Raw[Na__Raw.length - 1] === "'") {
        return Na__Raw.slice(1, -1).replace(/''/g, "'");
    }
    if (Na__Raw.length >= 2 && Na__Raw[0] === "\"" && Na__Raw[Na__Raw.length - 1] === "\"") {
        return JSON.parse(Na__Raw.replace(/\\x([0-9A-Fa-f]{2})/g, "\\u00$1")
                                  .replace(/\\U([0-9A-Fa-f]{8})/g, (_, Na__Hex) =>
                                      String.fromCodePoint(parseInt(Na__Hex, 16))));
    }
    return Na__Raw;
}
// ------------------------------------------------------------


// FUNCTION | The class indices allowed to win the CTC vote for a charset
// ------------------------------------------------------------
// Classes: 0 = CTC blank, 1..N = dictionary entries, N + 1 = the space the
// decoder appends. Returns null for "all" (every class may win).
export function NaOcr__AllowedClasses(Na__Dict, Na__Charset) {
    if (Na__Charset === "all") return null;
    const Na__Allowed = [0];
    for (let i = 0; i < Na__Dict.length; i += 1) {
        let Na__Ok = true;
        for (const Na__Char of Na__Dict[i]) {
            const Na__Code = Na__Char.codePointAt(0);
            if (!NaOcr__LatinRanges.some(([a, b]) => Na__Code >= a && Na__Code <= b)) { Na__Ok = false; break; }
        }
        if (Na__Ok || Na__Dict[i] === "\u3000") Na__Allowed.push(i + 1);   // the ideographic space reads as a space
    }
    Na__Allowed.push(Na__Dict.length + 1);           // the appended space
    return Int32Array.from(Na__Allowed);
}
// ------------------------------------------------------------


// FUNCTION | The classes of each script, for the word-level script vote
// ------------------------------------------------------------
// Returns { letterScript: per class 0 common (digit, punctuation, symbol,
// blank, space) / 1 Latin / 2 Greek / 3 Cyrillic / 4 another script,
// sets: [{ name, classes }] } where each set is the common classes plus one
// script's letters. PP-OCRv6's dictionaries hold Latin and Greek but no
// Cyrillic at all (18-Nov-2026), so its set is simply absent.
export function NaOcr__ScriptClasses(Na__Dict, Na__Allowed) {
    const Na__Count = Na__Dict.length + 2;
    const Na__Classes = Na__Allowed || Int32Array.from({ length: Na__Count }, (_, i) => i);
    const Na__LetterScript = new Int8Array(Na__Count);
    const Na__Common = [], Na__Currency = [], Na__ByScript = { latin: [], greek: [], cyrillic: [] };
    for (const k of Na__Classes) {
        const ch = k >= 1 && k <= Na__Dict.length ? Na__Dict[k - 1] : " ";
        if (!/\p{L}/u.test(ch)) {                    // every non-letter stays in every script's pass
            Na__Common.push(k);
            if (/^\p{Sc}$/u.test(ch)) Na__Currency.push(k);
            continue;
        }
        if (/^\p{Script=Latin}+$/u.test(ch))         { Na__ByScript.latin.push(k);    Na__LetterScript[k] = 1; }
        else if (/^\p{Script=Greek}+$/u.test(ch))    { Na__ByScript.greek.push(k);    Na__LetterScript[k] = 2; }
        else if (/^\p{Script=Cyrillic}+$/u.test(ch)) { Na__ByScript.cyrillic.push(k); Na__LetterScript[k] = 3; }
        else Na__LetterScript[k] = 4;
    }
    // Look-alike twins: the model gives an identical glyph (Greek capital Epsilon,
    // Latin E) wholly to one script, so each script's reading also counts its
    // twin's probability, written as its own letter, even a letter the model has
    // no class for (tiny has no "ά"). pairs: [{ from: class, to: character }].
    const Na__Index = new Map();
    for (const k of Na__Classes) if (k >= 1 && k <= Na__Dict.length) Na__Index.set(Na__Dict[k - 1], k);
    const Na__Pairs = { latin: [], greek: [], cyrillic: [] };
    for (const [Na__Latin, Na__Greek] of NaOcr__LatinGreekTwins) {
        const l = Na__Index.get(Na__Latin), g = Na__Index.get(Na__Greek);
        if (l !== undefined) Na__Pairs.greek.push({ from: l, to: Na__Greek });   // a Latin twin read as Greek
        if (g !== undefined) Na__Pairs.latin.push({ from: g, to: Na__Latin });   // a Greek twin read as Latin
    }
    const Na__Sets = Object.entries(Na__ByScript)
        .filter(([, Na__Idx]) => Na__Idx.length)
        .map(([Na__Name, Na__Idx]) => ({ name: Na__Name, classes: Int32Array.from(Na__Common.concat(Na__Idx)),
                                         pairs: Na__Pairs[Na__Name] }));
    return { letterScript: Na__LetterScript, sets: Na__Sets, currency: Int32Array.from(Na__Currency) };
}
// ------------------------------------------------------------


// Latin and Greek letters that look alike or nearly so, for the script vote
const NaOcr__LatinGreekTwins = [
    ["A", "\u0391"], ["B", "\u0392"], ["E", "\u0395"], ["Z", "\u0396"], ["H", "\u0397"], ["I", "\u0399"], ["K", "\u039A"], ["M", "\u039C"],
    ["N", "\u039D"], ["O", "\u039F"], ["P", "\u03A1"], ["T", "\u03A4"], ["Y", "\u03A5"], ["X", "\u03A7"],
    ["a", "\u03B1"], ["o", "\u03BF"], ["v", "\u03BD"], ["k", "\u03BA"], ["i", "\u03B9"], ["u", "\u03C5"], ["p", "\u03C1"], ["n", "\u03B7"],
    ["t", "\u03C4"], ["x", "\u03C7"], ["y", "\u03B3"], ["w", "\u03C9"],
    ["\u00E1", "\u03AC"], ["\u00E9", "\u03AD"], ["\u00ED", "\u03AF"], ["\u00F3", "\u03CC"], ["\u00FA", "\u03CD"], ["\u00EF", "\u03CA"]
];

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Pixels
// -----------------------------------------------------------------------------
// An image here is { data: RGBA bytes, width, height }, as ImageData gives it.

// FUNCTION | Resize RGBA pixels (bilinear, averaged over several taps when shrinking)
// ------------------------------------------------------------
// Used where OffscreenCanvas is missing (Node tests). In the worker the canvas
// does the detection resize.
export function NaOcr__ResizeRgba(Na__Src, Na__DstW, Na__DstH) {
    const { data: s, width: sw, height: sh } = Na__Src;
    const d = new Uint8ClampedArray(Na__DstW * Na__DstH * 4);
    const fx = sw / Na__DstW, fy = sh / Na__DstH;
    const tx = Math.max(1, Math.ceil(fx)), ty = Math.max(1, Math.ceil(fy));
    const px = [0, 0, 0, 0];
    for (let y = 0; y < Na__DstH; y += 1) {
        for (let x = 0; x < Na__DstW; x += 1) {
            px[0] = px[1] = px[2] = px[3] = 0;
            for (let j = 0; j < ty; j += 1) {
                const sy = (y + (j + 0.5) / ty) * fy - 0.5;
                for (let i = 0; i < tx; i += 1) {
                    NaOcr__SampleAdd(s, sw, sh, (x + (i + 0.5) / tx) * fx - 0.5, sy, px, 1);
                }
            }
            const n = tx * ty, o = (y * Na__DstW + x) * 4;
            d[o] = px[0] / n; d[o + 1] = px[1] / n; d[o + 2] = px[2] / n; d[o + 3] = 255;
        }
    }
    return { data: d, width: Na__DstW, height: Na__DstH };
}
// ------------------------------------------------------------


// FUNCTION | Add one bilinear sample (edges repeated) times a weight into acc[0..2]
// ------------------------------------------------------------
function NaOcr__SampleAdd(s, sw, sh, x, y, acc, w) {
    if (x < 0) x = 0; else if (x > sw - 1) x = sw - 1;
    if (y < 0) y = 0; else if (y > sh - 1) y = sh - 1;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = x0 + 1 < sw ? x0 + 1 : x0, y1 = y0 + 1 < sh ? y0 + 1 : y0;
    const ax = x - x0, ay = y - y0;
    const w00 = (1 - ax) * (1 - ay) * w, w10 = ax * (1 - ay) * w, w01 = (1 - ax) * ay * w, w11 = ax * ay * w;
    const o00 = (y0 * sw + x0) * 4, o10 = (y0 * sw + x1) * 4, o01 = (y1 * sw + x0) * 4, o11 = (y1 * sw + x1) * 4;
    acc[0] += s[o00] * w00 + s[o10] * w10 + s[o01] * w01 + s[o11] * w11;
    acc[1] += s[o00 + 1] * w00 + s[o10 + 1] * w10 + s[o01 + 1] * w01 + s[o11 + 1] * w11;
    acc[2] += s[o00 + 2] * w00 + s[o10 + 2] * w10 + s[o01 + 2] * w01 + s[o11 + 2] * w11;
}
// ------------------------------------------------------------


// FUNCTION | The detection input size for a page (PaddleOCR DetResizeForTest)
// ------------------------------------------------------------
export function NaOcr__DetSize(Na__SrcW, Na__SrcH, Na__MaxSide) {
    const c = NaOcr__DetConfig;
    const Na__Limit = Math.max(32, Math.min(c.maxSideLimit, Na__MaxSide || c.maxSideLimit));
    let Na__Scale = 1;
    const Na__MinSide = Math.min(Na__SrcW, Na__SrcH);
    if (Na__MinSide < c.limitSideLen) Na__Scale = c.limitSideLen / Math.max(1, Na__MinSide);
    if (Math.max(Na__SrcW, Na__SrcH) * Na__Scale > Na__Limit) Na__Scale = Na__Limit / Math.max(Na__SrcW, Na__SrcH);
    const Na__W = Math.max(32, Math.round(Na__SrcW * Na__Scale / 32) * 32);
    const Na__H = Math.max(32, Math.round(Na__SrcH * Na__Scale / 32) * 32);
    return { width: Na__W, height: Na__H };
}
// ------------------------------------------------------------


// FUNCTION | RGBA pixels to the detection tensor's data (CHW, BGR, normalised)
// ------------------------------------------------------------
export function NaOcr__DetTensorData(Na__Img) {
    const { data: s, width: w, height: h } = Na__Img;
    const { mean, std } = NaOcr__DetConfig;
    const hw = w * h, out = new Float32Array(3 * hw);
    const kb = 1 / (255 * std[0]), kg = 1 / (255 * std[1]), kr = 1 / (255 * std[2]);
    const bb = mean[0] / std[0], bg = mean[1] / std[1], br = mean[2] / std[2];
    for (let i = 0, p = 0; i < hw; i += 1, p += 4) {
        out[i]          = s[p + 2] * kb - bb;    // B plane
        out[i + hw]     = s[p + 1] * kg - bg;    // G plane
        out[i + 2 * hw] = s[p]     * kr - br;    // R plane
    }
    return out;
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | DB Post-Process
// -----------------------------------------------------------------------------

// FUNCTION | Text boxes from the detection probability map
// ------------------------------------------------------------
// Returns [{ quad: [[x,y] top-left, top-right, bottom-right, bottom-left], score }]
// in page pixels. Blobs are 8-connected, as OpenCV's contours are.
export function NaOcr__DbBoxes(Na__Prob, w, h, Na__SrcW, Na__SrcH) {
    const c = NaOcr__DetConfig;
    const n = w * h;
    const on = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) on[i] = Na__Prob[i] > c.thresh ? 1 : 0;
    const seen = new Uint8Array(n);
    const stack = new Int32Array(n);
    const boxes = [];
    let blobs = 0;
    for (let start = 0; start < n; start += 1) {
        if (!on[start] || seen[start]) continue;
        if (blobs >= c.maxCandidates) break;
        blobs += 1;
        // Flood fill, keeping only boundary pixels (their hull is the blob's hull)
        const pts = [];
        let top = 0;
        stack[top++] = start; seen[start] = 1;
        while (top > 0) {
            const p = stack[--top];
            const x = p % w, y = (p - x) / w;
            const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 ||
                         !on[p - 1] || !on[p + 1] || !on[p - w] || !on[p + w];
            if (edge) pts.push(x, y);
            for (let dy = -1; dy <= 1; dy += 1) {
                const yy = y + dy;
                if (yy < 0 || yy >= h) continue;
                for (let dx = -1; dx <= 1; dx += 1) {
                    const xx = x + dx;
                    if (xx < 0 || xx >= w || (dx === 0 && dy === 0)) continue;
                    const q = yy * w + xx;
                    if (on[q] && !seen[q]) { seen[q] = 1; stack[top++] = q; }
                }
            }
        }
        if (pts.length < 8) continue;                       // under 4 points: OpenCV skips it too
        const mini = NaOcr__MinAreaRect(NaOcr__ConvexHull(pts));
        if (!mini || mini.side < c.minSide) continue;
        const score = NaOcr__MeanInQuad(Na__Prob, w, h, mini.quad);
        if (score < c.boxThresh) continue;
        const grown = NaOcr__Unclip(mini, c.unclipRatio);
        if (grown.side < c.minSide + 2) continue;
        const sx = Na__SrcW / w, sy = Na__SrcH / h;
        const quad = grown.quad.map(([x, y]) => [
            Math.min(Na__SrcW, Math.max(0, Math.round(x * sx))),
            Math.min(Na__SrcH, Math.max(0, Math.round(y * sy)))
        ]);
        boxes.push({ quad, score });
    }
    return boxes;
}
// ------------------------------------------------------------


// FUNCTION | Convex hull of flat [x0, y0, x1, y1, ...] points (monotone chain)
// ------------------------------------------------------------
export function NaOcr__ConvexHull(Na__Flat) {
    const pts = [];
    for (let i = 0; i < Na__Flat.length; i += 2) pts.push([Na__Flat[i], Na__Flat[i + 1]]);
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (pts.length < 3) return pts;
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [], upper = [];
    for (const p of pts) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
        lower.push(p);
    }
    for (let i = pts.length - 1; i >= 0; i -= 1) {
        const p = pts[i];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
        upper.push(p);
    }
    upper.pop(); lower.pop();
    return lower.concat(upper);
}
// ------------------------------------------------------------


// FUNCTION | Smallest rotated rectangle round a convex hull (rotating calipers)
// ------------------------------------------------------------
// Returns { quad (ordered as PaddleOCR orders it), side (the shorter side),
// center, ux, uy (unit axes), hw, hh (half sizes) }.
export function NaOcr__MinAreaRect(Na__Hull) {
    if (Na__Hull.length < 2) return null;
    let best = null;
    const m = Na__Hull.length;
    for (let i = 0; i < m; i += 1) {
        const a = Na__Hull[i], b = Na__Hull[(i + 1) % m];
        let ex = b[0] - a[0], ey = b[1] - a[1];
        const len = Math.hypot(ex, ey);
        if (len === 0) continue;
        ex /= len; ey /= len;
        let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
        for (const p of Na__Hull) {
            const u = p[0] * ex + p[1] * ey, v = -p[0] * ey + p[1] * ex;
            if (u < minU) minU = u; if (u > maxU) maxU = u;
            if (v < minV) minV = v; if (v > maxV) maxV = v;
        }
        const area = (maxU - minU) * (maxV - minV);
        if (!best || area < best.area) best = { area, ex, ey, minU, maxU, minV, maxV };
    }
    if (!best) return null;
    const { ex, ey, minU, maxU, minV, maxV } = best;
    const cu = (minU + maxU) / 2, cv = (minV + maxV) / 2;
    const center = [cu * ex - cv * ey, cu * ey + cv * ex];
    return NaOcr__RectFromAxes(center, ex, ey, (maxU - minU) / 2, (maxV - minV) / 2);
}
// ------------------------------------------------------------


// FUNCTION | A rectangle from its centre, one unit axis and half sizes
// ------------------------------------------------------------
function NaOcr__RectFromAxes(Na__C, ex, ey, hu, hv) {
    const corner = (su, sv) => [Na__C[0] + su * hu * ex - sv * hv * ey, Na__C[1] + su * hu * ey + sv * hv * ex];
    const quad = NaOcr__OrderQuad([corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)]);
    return { quad, side: Math.min(2 * hu, 2 * hv), center: Na__C, ex, ey, hu, hv };
}
// ------------------------------------------------------------


// FUNCTION | Order four corners top-left, top-right, bottom-right, bottom-left
// ------------------------------------------------------------
// PaddleOCR's own rule: sort by x, then the upper of each pair comes first.
export function NaOcr__OrderQuad(Na__Pts) {
    const p = Na__Pts.slice().sort((a, b) => a[0] - b[0]);
    const [a, d] = p[1][1] > p[0][1] ? [p[0], p[1]] : [p[1], p[0]];
    const [b, c] = p[3][1] > p[2][1] ? [p[2], p[3]] : [p[3], p[2]];
    return [a, b, c, d];
}
// ------------------------------------------------------------


// FUNCTION | Mean probability inside a quad (PaddleOCR box_score_fast)
// ------------------------------------------------------------
export function NaOcr__MeanInQuad(Na__Prob, w, h, Na__Quad) {
    let minX = w, maxX = 0, minY = h, maxY = 0;
    for (const [x, y] of Na__Quad) {
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    minX = Math.max(0, Math.floor(minX)); maxX = Math.min(w - 1, Math.ceil(maxX));
    minY = Math.max(0, Math.floor(minY)); maxY = Math.min(h - 1, Math.ceil(maxY));
    let sum = 0, count = 0;
    for (let y = minY; y <= maxY; y += 1) {
        for (let x = minX; x <= maxX; x += 1) {
            if (NaOcr__InQuad(Na__Quad, x, y)) { sum += Na__Prob[y * w + x]; count += 1; }
        }
    }
    return count ? sum / count : 0;
}
// ------------------------------------------------------------


// FUNCTION | Is a point inside a convex quad (edges count as inside)
// ------------------------------------------------------------
function NaOcr__InQuad(q, x, y) {
    let sign = 0;
    for (let i = 0; i < 4; i += 1) {
        const a = q[i], b = q[(i + 1) % 4];
        const cr = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
        if (Math.abs(cr) < 1e-9) continue;
        const s = cr > 0 ? 1 : -1;
        if (sign === 0) sign = s; else if (s !== sign) return false;
    }
    return true;
}
// ------------------------------------------------------------


// FUNCTION | Grow a rectangle by area * ratio / perimeter on every side
// ------------------------------------------------------------
// PaddleOCR offsets the polygon with Clipper (round joins) and takes the
// smallest rectangle round the result: for a rectangle that is the rectangle
// grown by the offset distance on each side, computed here directly.
export function NaOcr__Unclip(Na__Rect, Na__Ratio) {
    const w = 2 * Na__Rect.hu, h = 2 * Na__Rect.hv;
    const d = (w * h * Na__Ratio) / Math.max(1e-6, 2 * (w + h));
    return NaOcr__RectFromAxes(Na__Rect.center, Na__Rect.ex, Na__Rect.ey, Na__Rect.hu + d, Na__Rect.hv + d);
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Recognition
// -----------------------------------------------------------------------------

// FUNCTION | Sample one text box into a 48 px high strip (CHW, BGR, normalised)
// ------------------------------------------------------------
// Straight from the page pixels: an affine map from the box's own axes, with
// 2 x 2 or more taps per pixel when the box is shrunk, so large headings do not
// alias. A box 1.5 times taller than wide is read turned 90 degrees
// counter-clockwise, as PaddleOCR does.
export function NaOcr__CropStrip(Na__Img, Na__Quad) {
    const { height: H, baseWidth, maxWidth } = NaOcr__RecConfig;
    let [tl, tr, br, bl] = Na__Quad;
    let cw = Math.max(1, Math.floor(Math.max(Math.hypot(tr[0] - tl[0], tr[1] - tl[1]), Math.hypot(br[0] - bl[0], br[1] - bl[1]))));
    let ch = Math.max(1, Math.floor(Math.max(Math.hypot(bl[0] - tl[0], bl[1] - tl[1]), Math.hypot(br[0] - tr[0], br[1] - tr[1]))));
    if (ch / cw >= 1.5) {                                   // upright it: right along the old top edge
        [tl, tr, br, bl] = [tr, br, bl, tl];
        [cw, ch] = [ch, cw];
    }
    const ratio = cw / ch;
    const recW = Math.min(maxWidth, Math.max(1, Math.trunc(H * Math.max(baseWidth / H, ratio))));
    const outW = Math.max(1, Math.min(recW, Math.ceil(H * ratio)));
    // Affine axes: one output pixel step in x and in y, in page pixels
    const ux = [(tr[0] - tl[0]) / outW, (tr[1] - tl[1]) / outW];
    const vy = [(bl[0] - tl[0]) / H, (bl[1] - tl[1]) / H];
    const taps = Math.max(1, Math.min(4, Math.ceil(Math.max(Math.hypot(ux[0], ux[1]), Math.hypot(vy[0], vy[1])))));
    const { data: s, width: sw, height: sh } = Na__Img;
    const plane = H * outW, chw = new Float32Array(3 * plane);
    const acc = [0, 0, 0], k = 1 / (taps * taps);
    for (let y = 0; y < H; y += 1) {
        for (let x = 0; x < outW; x += 1) {
            acc[0] = acc[1] = acc[2] = 0;
            for (let j = 0; j < taps; j += 1) {
                const fy = y + (j + 0.5) / taps;
                for (let i = 0; i < taps; i += 1) {
                    const fx = x + (i + 0.5) / taps;
                    NaOcr__SampleAdd(s, sw, sh, tl[0] + fx * ux[0] + fy * vy[0] - 0.5, tl[1] + fx * ux[1] + fy * vy[1] - 0.5, acc, k);
                }
            }
            const o = y * outW + x;
            chw[o]             = acc[2] / 127.5 - 1;   // B
            chw[o + plane]     = acc[1] / 127.5 - 1;   // G
            chw[o + 2 * plane] = acc[0] / 127.5 - 1;   // R
        }
    }
    return { chw, width: outW, recW, ratio };
}
// ------------------------------------------------------------


// FUNCTION | Batch strips into one tensor's data, right-padded with zeros
// ------------------------------------------------------------
export function NaOcr__RecBatchData(Na__Strips) {
    const H = NaOcr__RecConfig.height;
    const maxW = Na__Strips.reduce((m, s) => Math.max(m, s.recW), 1);
    const out = new Float32Array(Na__Strips.length * 3 * H * maxW);
    Na__Strips.forEach((s, b) => {
        for (let c = 0; c < 3; c += 1) {
            for (let y = 0; y < H; y += 1) {
                const src = c * H * s.width + y * s.width;
                out.set(s.chw.subarray(src, src + s.width), b * 3 * H * maxW + c * H * maxW + y * maxW);
            }
        }
    });
    return { data: out, dims: [Na__Strips.length, 3, H, maxW] };
}
// ------------------------------------------------------------


// FUNCTION | The best class at one CTC frame among a list of classes
// ------------------------------------------------------------
function NaOcr__FrameBest(Na__Data, Na__Base, Na__List, Na__Classes, Na__Out) {
    let best = 0, bestVal = -Infinity;
    if (Na__List) {
        for (let k = 0; k < Na__List.length; k += 1) {
            const v = Na__Data[Na__Base + Na__List[k]];
            if (v > bestVal) { bestVal = v; best = Na__List[k]; }
        }
    } else {
        for (let k = 0; k < Na__Classes; k += 1) {
            const v = Na__Data[Na__Base + k];
            if (v > bestVal) { bestVal = v; best = k; }
        }
    }
    Na__Out[0] = best; Na__Out[1] = bestVal;
}
// ------------------------------------------------------------


// FUNCTION | CTC greedy decode of one sample (PaddleOCR CTCLabelDecode), then a word-level script vote
// ------------------------------------------------------------
// Na__Allowed: the classes that may win (null = all). Na__Scripts: from
// NaOcr__ScriptClasses, or null to skip the vote. Returns { text, score }.
//
// The vote: the greedy read can mix look-alike scripts inside one word
// ("Ελληνικά" read as "Eλλnvιká"). Each word (the frames between space frames)
// that holds a Greek or Cyrillic letter is decoded again restricted to each
// script in turn (its letters plus digits, punctuation and symbols, with each
// look-alike twin from the other script counted as its own letter: E for
// Epsilon, n for eta), and the script with the highest summed log-probability
// wins. The mixed reading stays
// only when no single script comes within NaOcr__ScriptMargin nats a
// character of it (a real mix such as "μm"). Words of Latin letters alone are
// never re-decoded, so English pages cost nothing extra.
const NaOcr__ScriptMargin = 1.0;
const NaOcr__CurrencyRatio = 0.5;   // a currency sign at half the lone letter's probability or more wins
export function NaOcr__CtcDecode(Na__Data, Na__Offset, Na__Steps, Na__Classes, Na__Dict, Na__Allowed, Na__Scripts) {
    const space = Na__Dict.length + 1;
    const isSpace = (k) => k === space || (k >= 1 && Na__Dict[k - 1] === "\u3000");
    const charOf = (k) => (isSpace(k) ? " " : Na__Dict[k - 1]);
    const bestK = new Int32Array(Na__Steps), bestV = new Float32Array(Na__Steps), out = [0, 0];
    for (let t = 0; t < Na__Steps; t += 1) {
        NaOcr__FrameBest(Na__Data, Na__Offset + t * Na__Classes, Na__Allowed, Na__Classes, out);
        bestK[t] = out[0]; bestV[t] = out[1];
    }
    let text = "", sum = 0, count = 0, prev = -1;
    // Collapse frames [a, b) of a path: repeats merge unless a blank parts them
    const collapse = (ks, vs, a, b, prevK, pairs) => {
        let s = "", p = prevK, n = 0, sv = 0, log = 0, foreign = false;
        for (let t = a; t < b; t += 1) {
            const k = ks[t];
            log += Math.log(Math.max(vs[t], 1e-12));
            if (k !== 0 && k !== p) {
                s += k < 0 ? pairs[-k - 1].to : charOf(k); sv += vs[t]; n += 1;
                if (Na__Scripts && k > 0) { const sc = Na__Scripts.letterScript[k]; if (sc === 2 || sc === 3) foreign = true; }
            }
            p = k;
        }
        return { s, n, sv, log, foreign };
    };
    let t = 0;
    while (t < Na__Steps) {
        if (isSpace(bestK[t]) || bestK[t] === 0) {               // spaces and blanks between words
            if (bestK[t] > 0 && bestK[t] !== prev) { text += " "; sum += bestV[t]; count += 1; }
            prev = bestK[t]; t += 1; continue;
        }
        let e = t;
        while (e < Na__Steps && !isSpace(bestK[e])) e += 1;
        let word = collapse(bestK, bestV, t, e, prev);
        if (Na__Scripts && word.foreign && Na__Scripts.sets.length > 1) {
            let pick = null;
            for (const set of Na__Scripts.sets) {
                const ks = new Int32Array(Na__Steps), vs = new Float32Array(Na__Steps);
                for (let f = t; f < e; f += 1) {
                    const base = Na__Offset + f * Na__Classes;
                    NaOcr__FrameBest(Na__Data, base, set.classes, Na__Classes, out);
                    for (let q = 0; q < set.pairs.length; q += 1) {          // twins, written in this script
                        const v = Na__Data[base + set.pairs[q].from];
                        if (v > out[1]) { out[0] = -(q + 1); out[1] = v; }   // negative: twin q's letter
                    }
                    ks[f] = out[0]; vs[f] = out[1];
                }
                const cand = collapse(ks, vs, t, e, prev, set.pairs);
                if (!pick || cand.log > pick.log) pick = cand;
            }
            if (pick && (word.log - pick.log) <= NaOcr__ScriptMargin * Math.max(1, pick.n)) word = pick;
        }
        // A lone letter that is not an English word, nearly read as a currency sign, is
        // the sign: small read a lone "£" as "f" (f 0.521, £ 0.444) on Adam's benchmark.
        if (Na__Scripts && word.n === 1 && /^\p{L}$/u.test(word.s) && !/^[aAIi]$/.test(word.s)) {
            let tf = -1;
            for (let f = t; f < e; f += 1) {
                if (bestK[f] > 0 && charOf(bestK[f]) === word.s && (tf < 0 || bestV[f] > bestV[tf])) tf = f;
            }
            if (tf >= 0) {
                NaOcr__FrameBest(Na__Data, Na__Offset + tf * Na__Classes, Na__Scripts.currency, Na__Classes, out);
                if (out[1] >= NaOcr__CurrencyRatio * bestV[tf]) {
                    word = { ...word, s: charOf(out[0]), sv: word.sv - bestV[tf] + out[1] };
                }
            }
        }
        text += word.s; sum += word.sv; count += word.n;
        prev = bestK[e - 1];
        t = e;
    }
    return { text, score: count ? sum / count : 0 };
}
// ------------------------------------------------------------


// FUNCTION | Put back the word spaces PP-OCRv6 rec sometimes drops beside punctuation
// ------------------------------------------------------------
// The small model, on a page drawn by pdf.js, read "1.Site", "tel.01234" and
// "48,500(including" (18-Nov-2026 test), which read aloud badly. Only these
// unambiguous joins are split: a full stop between a word or number and a
// capitalised word ("1.Site", "Mr.Smith"; "U.S.A" and "3.14" stay); a full stop
// between a word and a number ("tel.01234", "Fig.3"; "v1.2" stays); an opening
// bracket glued to a word of three or more letters ("500(including";
// "item(s)" stays). Adam's benchmark (Test__Ocr__PdfTest__.pdf, 18-Nov-2026)
// added three more: a word glued to what follows its colon ("token:RIGHT",
// "date_iso:2026"; "16:18:00", "C:" and "https://" stay); symbols run together
// ("÷°≥", "→←"; only non-ASCII symbols, so "<=" stays); and a glued bar ("|v1.0").
export function NaOcr__RestoreSpaces(Na__Text) {
    return Na__Text
        .replace(/([0-9a-z])\.([A-Z][a-z])/g, "$1. $2")
        .replace(/([A-Za-z]{2,})\.(\d)/g, "$1. $2")
        .replace(/([0-9A-Za-z])\((?=[A-Za-z]{3,})/g, "$1 (")
        .replace(/([A-Za-z_]{2,}):(?=[A-Za-z0-9])/g, "$1: ")
        .replace(/([^\x00-\x7F])(?=[^\x00-\x7F])/gu, (Na__Pair, Na__Char, Na__At, Na__All) =>
            /[\p{Sm}\p{So}\p{Sc}]/u.test(Na__Char) && /[\p{Sm}\p{So}\p{Sc}]/u.test(String.fromCodePoint(Na__All.codePointAt(Na__At + Na__Char.length)))
                ? Na__Char + " " : Na__Char)
        .replace(/\s*\|\s*/g, " | ")
        .trim();
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Page
// -----------------------------------------------------------------------------

// FUNCTION | Lines in reading order: rows by vertical centre, then left to right
// ------------------------------------------------------------
export function NaOcr__ReadingOrder(Na__Lines) {
    const items = Na__Lines.slice().sort((a, b) => (a.box.y + a.box.height / 2) - (b.box.y + b.box.height / 2));
    const rows = [];
    for (const it of items) {
        const cy = it.box.y + it.box.height / 2;
        const row = rows[rows.length - 1];
        if (row && Math.abs(cy - row.cy) < 0.5 * Math.min(row.h, it.box.height)) {
            row.items.push(it);
            row.cy = (row.cy * (row.items.length - 1) + cy) / row.items.length;
            row.h = Math.min(row.h, it.box.height);
        } else {
            rows.push({ cy, h: it.box.height, items: [it] });
        }
    }
    return rows.flatMap((r) => r.items.sort((a, b) => a.box.x - b.box.x));
}
// ------------------------------------------------------------


// FUNCTION | Read a page: detection, crops, recognition, reading order
// ------------------------------------------------------------
// Na__Ctx: { ort, det, rec, dict, allowed, detMaxSide, detPixels(w, h),
//            cancelled(), progress(done, total) }. Na__Img is the full page.
export async function NaOcr__RecognisePixels(Na__Ctx, Na__Img) {
    const t0 = Date.now();
    const size = NaOcr__DetSize(Na__Img.width, Na__Img.height, Na__Ctx.detMaxSide);
    const detImg = Na__Ctx.detPixels
        ? Na__Ctx.detPixels(size.width, size.height)
        : (size.width === Na__Img.width && size.height === Na__Img.height ? Na__Img : NaOcr__ResizeRgba(Na__Img, size.width, size.height));
    const detIn = new Na__Ctx.ort.Tensor("float32", NaOcr__DetTensorData(detImg), [1, 3, size.height, size.width]);
    const detOut = await Na__Ctx.det.run({ [Na__Ctx.det.inputNames[0]]: detIn });
    const map = detOut[Na__Ctx.det.outputNames[0]];
    const mh = map.dims[map.dims.length - 2], mw = map.dims[map.dims.length - 1];
    const boxes = NaOcr__DbBoxes(map.data, mw, mh, Na__Img.width, Na__Img.height);
    const tDet = Date.now();
    if (Na__Ctx.cancelled && Na__Ctx.cancelled()) return null;

    // Crops, sorted by aspect ratio so each batch pads little (PaddleOCR does the same)
    const strips = boxes.map((b, i) => ({ i, ...NaOcr__CropStrip(Na__Img, b.quad) }));
    strips.sort((a, b) => a.ratio - b.ratio);
    const results = new Array(boxes.length);
    const B = NaOcr__RecConfig.batchSize;
    for (let s = 0; s < strips.length; s += B) {
        if (Na__Ctx.cancelled && Na__Ctx.cancelled()) return null;
        const batch = strips.slice(s, s + B);
        const packed = NaOcr__RecBatchData(batch);
        const recIn = new Na__Ctx.ort.Tensor("float32", packed.data, packed.dims);
        const recOut = await Na__Ctx.rec.run({ [Na__Ctx.rec.inputNames[0]]: recIn });
        const out = recOut[Na__Ctx.rec.outputNames[0]];
        const [n, steps, classes] = out.dims;
        for (let k = 0; k < n; k += 1) {
            results[batch[k].i] = NaOcr__CtcDecode(out.data, k * steps * classes, steps, classes, Na__Ctx.dict, Na__Ctx.allowed, Na__Ctx.scripts || null);
        }
        if (Na__Ctx.progress) Na__Ctx.progress(Math.min(strips.length, s + B), strips.length);
    }

    const lines = [];
    boxes.forEach((b, i) => {
        const r = results[i];
        const text = r ? NaOcr__RestoreSpaces(r.text.replace(/\s+/g, " ").trim()) : "";
        if (!text || r.score < NaOcr__RecConfig.scoreThresh) return;
        const xs = b.quad.map((p) => p[0]), ys = b.quad.map((p) => p[1]);
        const x = Math.min(...xs), y = Math.min(...ys);
        lines.push({ text, confidence: Math.round(r.score * 1000) / 1000,
                     box: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y } });
    });
    return {
        width: Na__Img.width, height: Na__Img.height,
        lines: NaOcr__ReadingOrder(lines),
        timing: { detMs: tDet - t0, recMs: Date.now() - tDet, boxes: boxes.length }
    };
}
// ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Worker
// -----------------------------------------------------------------------------
// Messages in:  { type: "init", ortUrl, wasmBase, wasmFile, threads, cacheName,
//                 detUrl, recUrl, dictUrl, charset, detMaxSide }
//               { type: "recognise", id, bitmap }      { type: "cancel", id }
// Messages out: { type: "ready", threads, ms }   { type: "progress", id, done, total }
//               { type: "result", id, result }   { type: "error", id?, name, message }

const NaOcr__Worker = { ctx: null, cancelled: new Set() };

// FUNCTION | Bytes of a same-origin file: the OCR cache first, then the network
// ------------------------------------------------------------
async function NaOcr__Bytes(Na__CacheName, Na__Url) {
    try {
        const Na__Cache = await caches.open(Na__CacheName);
        const Na__Hit = await Na__Cache.match(Na__Url);
        if (Na__Hit) return new Uint8Array(await Na__Hit.arrayBuffer());
    } catch (Na__Err) { /* no Cache Storage here: fall through to the network */ }
    const Na__Response = await fetch(Na__Url);
    if (!Na__Response.ok) throw new Error(`NaPdfOcr: ${Na__Url} answered ${Na__Response.status}`);
    return new Uint8Array(await Na__Response.arrayBuffer());
}
// ------------------------------------------------------------


// FUNCTION | Load ONNX Runtime and both models
// ------------------------------------------------------------
async function NaOcr__Init(m) {
    const t0 = Date.now();
    const ort = await import(m.ortUrl);
    ort.env.wasm.numThreads = m.threads;
    ort.env.wasm.proxy = false;                     // this worker is already off the main thread
    ort.env.wasm.wasmPaths = m.wasmBase;            // the threaded glue .mjs is imported from here
    ort.env.wasm.wasmBinary = (await NaOcr__Bytes(m.cacheName, m.wasmBase + m.wasmFile)).buffer;
    const opts = { executionProviders: ["wasm"], graphOptimizationLevel: "all" };
    const [detBytes, recBytes, dictText] = await Promise.all([
        NaOcr__Bytes(m.cacheName, m.detUrl),
        NaOcr__Bytes(m.cacheName, m.recUrl),
        NaOcr__Bytes(m.cacheName, m.dictUrl).then((b) => new TextDecoder().decode(b))
    ]);
    const det = await ort.InferenceSession.create(detBytes, opts);
    const rec = await ort.InferenceSession.create(recBytes, opts);
    const dict = NaOcr__ParseDictionary(dictText);
    const allowed = NaOcr__AllowedClasses(dict, m.charset || "latin");
    NaOcr__Worker.ctx = { ort, det, rec, dict, allowed, scripts: m.scriptVote === false ? null : NaOcr__ScriptClasses(dict, allowed), detMaxSide: m.detMaxSide };
    return Date.now() - t0;
}
// ------------------------------------------------------------


// FUNCTION | Read one page sent as an ImageBitmap
// ------------------------------------------------------------
async function NaOcr__Recognise(m) {
    const ctx = NaOcr__Worker.ctx;
    if (!ctx) throw new Error("NaPdfOcr: the worker has not been initialised");
    const bitmap = m.bitmap;
    const W = bitmap.width, H = bitmap.height;
    const canvas = new OffscreenCanvas(W, H);
    const g = canvas.getContext("2d", { willReadFrequently: true });
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);      // transparent PDF pages read as white paper
    g.drawImage(bitmap, 0, 0);
    const page = g.getImageData(0, 0, W, H);
    const pageCtx = {
        ...ctx,
        detPixels: (w, h) => {
            if (w === W && h === H) return page;
            const small = new OffscreenCanvas(w, h);
            const sg = small.getContext("2d", { willReadFrequently: true });
            sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = "high";
            sg.drawImage(canvas, 0, 0, w, h);
            return sg.getImageData(0, 0, w, h);
        },
        cancelled: () => NaOcr__Worker.cancelled.has(m.id),
        progress: (done, total) => self.postMessage({ type: "progress", id: m.id, done, total })
    };
    bitmap.close();
    return NaOcr__RecognisePixels(pageCtx, page);
}
// ------------------------------------------------------------


// Attach the message handler only when running as a worker (not in Node tests)
if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
    self.onmessage = async (Na__Event) => {
        const m = Na__Event.data;
        try {
            if (m.type === "init") {
                const ms = await NaOcr__Init(m);
                self.postMessage({ type: "ready", threads: m.threads, ms });
            } else if (m.type === "cancel") {
                NaOcr__Worker.cancelled.add(m.id);
            } else if (m.type === "recognise") {
                const t0 = Date.now();
                const result = await NaOcr__Recognise(m);
                if (result === null || NaOcr__Worker.cancelled.has(m.id)) {
                    NaOcr__Worker.cancelled.delete(m.id);
                    self.postMessage({ type: "error", id: m.id, name: "AbortError", message: "OCR cancelled" });
                    return;
                }
                result.ms = Date.now() - t0;
                self.postMessage({ type: "result", id: m.id, result });
            }
        } catch (Na__Err) {
            self.postMessage({ type: "error", id: m.id, name: Na__Err.name || "Error", message: String(Na__Err.message || Na__Err) });
        }
    };
}

// endregion -------------------------------------------------------------------
