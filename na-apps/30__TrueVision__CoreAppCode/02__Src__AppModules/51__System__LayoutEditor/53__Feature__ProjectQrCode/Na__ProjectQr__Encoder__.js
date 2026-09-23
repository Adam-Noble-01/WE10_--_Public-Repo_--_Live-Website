// =============================================================================
// TRUEVISION3D - PROJECT QR CODE - ENCODER
// =============================================================================
//
// FILE       : Na__ProjectQr__Encoder__.js
// NAMESPACE  : Na__QrEnc
// MODULE     : Project QR Code - Encoder
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Encode a string as a QR module matrix, with no dependencies
// CREATED    : 19-Sep-2026
//
// DESCRIPTION:
// - Takes a string and returns a square boolean matrix of QR modules, and the
//   same matrix merged into horizontal runs. That is the whole of the public
//   surface. No DOM, no canvas, no config, no side effects.
// - Byte mode, error correction level M, versions 1 to 10, which carries up to
//   213 bytes. A project's code carries 42 (https://www.noble-architecture.com/q/?PS01),
//   which is exactly what version 3 holds: 29 modules across.
// - The caller decides what a module looks like. Na__ProjectQr__Painter__
//   draws them as one vector path, on screen and on paper.
//
// INTEGRATION:
// - Read by Na__ProjectQr__Symbol__, which encodes the project's live address
//   once and hands the result to every document that prints it.
// - Imports nothing, so it runs in Node exactly as the app runs it
//   (80__Testing__PrototypeEnvironment/Na__Test__ProjectQr__.test.mjs).
//
// -----------------------------------------------------------------------------
//
// WHY THIS IS WRITTEN RATHER THAN INSTALLED:
// 04__Lib__ThirdParty__VersionLocked is a deliberate, CDN-independent set, and
// the application is an installable PWA that has to work offline. Pulling a QR
// library from a CDN would break both of those. The algorithm is fully
// specified in ISO/IEC 18004 and fits in one file, so it is a first-party
// module.
//
// WHY ERROR CORRECTION LEVEL M:
// A drawing is printed, folded, and scanned on site in poor light. Level L
// recovers 7 percent of a damaged symbol, M recovers 15. For a project's 42
// byte address L buys NOTHING: version 2 holds 32 bytes at L, so the symbol is
// version 3 either way, and L would halve what a crease or a coffee ring can
// take out of it before it stops reading, for no larger a module.
//
// WHY THE VERSION TABLE STOPS AT 10:
// Version 10 holds 213 bytes at level M, which is a project folder name of 95
// characters. Going further would mean carrying the alignment pattern and
// block structure tables for thirty more versions to serve a payload this
// application will never produce, so an over-long string is reported as
// unencodable rather than silently accommodated. A truncated address scans to
// the wrong page.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : Vale Lantern Designer 03__AppUtils/VghLantern__AppUtils__QrEncoder__.js
// - Ported on     : 19-Sep-2026 for TrueVision3D
// - Parity        : the algorithm verbatim
// - Divergences   : An ES module with named exports rather than a window
//                   global. Encode returns the merged runs with the matrix, so
//                   a symbol is merged once rather than on every repaint.
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Sep-2026 - Version 1.0.0
// - Initial implementation. Every version from 1 to 10 proved against an
//   independent decoder (OpenCV), which the Lantern original never was above
//   version 4: the version information block and the two-group interleave
//   (versions 7 and 8 up) are first exercised here.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants - Specification Tables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Galois Field Definition
    // ------------------------------------------------------------
    // The field GF(256) modulo x^8 + x^4 + x^3 + x^2 + 1, which is the field the
    // QR specification defines its Reed-Solomon arithmetic over. Not a tunable.
    // ------------------------------------------------------------
    const Na__QrEnc__GF_PRIMITIVE_POLYNOMIAL = 0x11D;
    const Na__QrEnc__GF_ORDER                = 256;
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Encoding Mode and Padding
    // ------------------------------------------------------------
    const Na__QrEnc__MODE_INDICATOR_BYTE = 0x4;                                  // <-- 0100, byte mode
    const Na__QrEnc__TERMINATOR_MAX_BITS = 4;
    const Na__QrEnc__PAD_CODEWORD_A      = 0xEC;
    const Na__QrEnc__PAD_CODEWORD_B      = 0x11;
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Format and Version Information Encoding
    // ------------------------------------------------------------
    const Na__QrEnc__FORMAT_BCH_GENERATOR     = 0x537;                           // <-- BCH(15,5) generator
    const Na__QrEnc__FORMAT_BCH_DEGREE        = 10;                              // <-- Highest set bit of 0x537
    const Na__QrEnc__FORMAT_DATA_BITS         = 5;                               // <-- 2 error correction bits plus 3 mask bits
    const Na__QrEnc__FORMAT_XOR_MASK          = 0x5412;                          // <-- Applied so an all-zero format is never valid
    const Na__QrEnc__VERSION_BCH_GENERATOR    = 0x1F25;                          // <-- BCH(18,6) generator
    const Na__QrEnc__VERSION_BCH_DEGREE       = 12;                              // <-- Highest set bit of 0x1F25
    const Na__QrEnc__VERSION_DATA_BITS        = 6;                               // <-- Version number, 7 to 40
    const Na__QrEnc__ERROR_CORRECTION_BITS_M  = 0x0;                             // <-- Level M is 00 in the format string
    const Na__QrEnc__VERSION_INFO_MIN_VERSION = 7;                               // <-- Below this no version block is written
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Block Structure per Version, Error Correction Level M
    // ------------------------------------------------------------
    // ISO/IEC 18004 Table 9, level M rows only. Each entry is
    // [ ecCodewordsPerBlock, group1BlockCount, group1DataCodewords,
    //   group2BlockCount, group2DataCodewords ]. Index 0 is unused so the array
    // can be indexed by version number directly.
    // ------------------------------------------------------------
    const Na__QrEnc__BLOCK_STRUCTURE_M = [
        null,
        [ 10, 1, 16, 0,  0 ],
        [ 16, 1, 28, 0,  0 ],
        [ 26, 1, 44, 0,  0 ],
        [ 18, 2, 32, 0,  0 ],
        [ 24, 2, 43, 0,  0 ],
        [ 16, 4, 27, 0,  0 ],
        [ 18, 4, 31, 0,  0 ],
        [ 22, 2, 38, 2, 39 ],
        [ 22, 3, 36, 2, 37 ],
        [ 26, 4, 43, 1, 44 ]
    ];
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Byte Mode Payload Capacity per Version, Level M
    // ------------------------------------------------------------
    // Data codewords less the mode indicator and the character count indicator.
    // Index 0 unused, as above.
    // ------------------------------------------------------------
    const Na__QrEnc__BYTE_CAPACITY_M = [ 0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213 ];
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Alignment Pattern Centres per Version
    // ------------------------------------------------------------
    // Row and column coordinates whose intersections carry an alignment
    // pattern, except the three occupied by finder patterns. Index 0 unused.
    // ------------------------------------------------------------
    const Na__QrEnc__ALIGNMENT_CENTRES = [
        null,
        [],
        [ 6, 18 ],
        [ 6, 22 ],
        [ 6, 26 ],
        [ 6, 30 ],
        [ 6, 34 ],
        [ 6, 22, 38 ],
        [ 6, 24, 42 ],
        [ 6, 26, 46 ],
        [ 6, 28, 50 ]
    ];
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Fixed Pattern Geometry
    // ------------------------------------------------------------
    const Na__QrEnc__FINDER_SIZE               = 7;
    const Na__QrEnc__TIMING_TRACK_INDEX        = 6;                              // <-- Row and column carrying the timing pattern
    const Na__QrEnc__COUNT_BITS_SHORT          = 8;                              // <-- Byte mode, versions 1 to 9
    const Na__QrEnc__COUNT_BITS_LONG           = 16;                             // <-- Byte mode, versions 10 and above
    const Na__QrEnc__COUNT_LONG_FROM_VERSION   = 10;
    const Na__QrEnc__MASK_PATTERN_COUNT        = 8;
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Mask Penalty Weights
    // ------------------------------------------------------------
    // ISO/IEC 18004 Table 11. Fixed by the specification, not design values.
    // ------------------------------------------------------------
    const Na__QrEnc__PENALTY_ADJACENT_BASE    = 3;                               // <-- Score for the first five same-colour modules in a run
    const Na__QrEnc__PENALTY_ADJACENT_RUN_MIN = 5;
    const Na__QrEnc__PENALTY_BLOCK            = 3;                               // <-- Score per 2 x 2 same-colour block
    const Na__QrEnc__PENALTY_FINDER_LIKE      = 40;                              // <-- Score per finder-like sequence in a line
    const Na__QrEnc__PENALTY_BALANCE_STEP     = 10;                              // <-- Score per five percent deviation from an even dark ratio
    // ------------------------------------------------------------


    // MODULE VARIABLES | Galois Field Log Tables
    // ------------------------------------------------------------
    // Built once on first use, so every Reed-Solomon multiply below is a table
    // lookup rather than a carry-less multiply.
    // ------------------------------------------------------------
    let Na__QrEnc__ExpTable = null;
    let Na__QrEnc__LogTable = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Galois Field Arithmetic
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the GF(256) Exponent and Log Tables Once
    // ------------------------------------------------------------
    function Na__QrEnc__EnsureFieldTables() {
        if (Na__QrEnc__ExpTable) return;

        const exp = new Uint8Array(Na__QrEnc__GF_ORDER * 2);
        const log = new Uint8Array(Na__QrEnc__GF_ORDER);
        let value = 1;

        for (let i = 0; i < Na__QrEnc__GF_ORDER - 1; i++) {
            exp[i]     = value;
            log[value] = i;
            value      = value << 1;
            if (value & Na__QrEnc__GF_ORDER) value = value ^ Na__QrEnc__GF_PRIMITIVE_POLYNOMIAL;
        }
        for (let i = Na__QrEnc__GF_ORDER - 1; i < Na__QrEnc__GF_ORDER * 2; i++) {
            exp[i] = exp[i - (Na__QrEnc__GF_ORDER - 1)];                         // <-- Wrapped copy removes a modulo from every multiply
        }

        Na__QrEnc__ExpTable = exp;
        Na__QrEnc__LogTable = log;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Multiply Two Field Elements
    // ------------------------------------------------------------
    function Na__QrEnc__FieldMultiply(a, b) {
        if (a === 0 || b === 0) return 0;
        Na__QrEnc__EnsureFieldTables();
        return Na__QrEnc__ExpTable[Na__QrEnc__LogTable[a] + Na__QrEnc__LogTable[b]];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Reed-Solomon Generator Polynomial of a Given Degree
    // ------------------------------------------------------------
    // The product of (x - 2^i) for i from 0 to degree-1, in coefficient order
    // with the highest power first.
    // ------------------------------------------------------------
    function Na__QrEnc__BuildGeneratorPolynomial(degree) {
        Na__QrEnc__EnsureFieldTables();

        let generator = [ 1 ];
        for (let i = 0; i < degree; i++) {
            const next = new Array(generator.length + 1).fill(0);
            for (let j = 0; j < generator.length; j++) {
                next[j]     = next[j] ^ generator[j];
                next[j + 1] = next[j + 1] ^ Na__QrEnc__FieldMultiply(generator[j], Na__QrEnc__ExpTable[i]);
            }
            generator = next;
        }
        return generator;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Compute the Error Correction Codewords for One Data Block
    // ------------------------------------------------------------
    // Polynomial long division of the data block by the generator, in the
    // field. The remainder is the error correction block.
    // ------------------------------------------------------------
    function Na__QrEnc__ComputeErrorCorrection(dataBlock, ecCodewordCount) {
        const generator = Na__QrEnc__BuildGeneratorPolynomial(ecCodewordCount);
        const remainder = new Array(ecCodewordCount).fill(0);

        for (let i = 0; i < dataBlock.length; i++) {
            const factor = dataBlock[i] ^ remainder[0];
            remainder.shift();
            remainder.push(0);
            if (factor === 0) continue;
            for (let j = 0; j < ecCodewordCount; j++) {
                remainder[j] = remainder[j] ^ Na__QrEnc__FieldMultiply(generator[j + 1], factor);
            }
        }
        return remainder;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Data Encoding
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Convert a String to UTF-8 Bytes
    // ------------------------------------------------------------
    // Byte mode carries raw octets, and an address with an accented character
    // would be mis-scanned if the string's UTF-16 code units were written
    // straight out.
    // ------------------------------------------------------------
    function Na__QrEnc__Utf8Bytes(text) {
        const value = String(text === undefined || text === null ? '' : text);
        const bytes = [];

        for (let i = 0; i < value.length; i++) {
            let code = value.charCodeAt(i);

            if (code < 0x80) {
                bytes.push(code);
            } else if (code < 0x800) {
                bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
            } else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < value.length) {
                code = 0x10000 + ((code - 0xD800) << 10) + (value.charCodeAt(++i) - 0xDC00);
                bytes.push(0xF0 | (code >> 18), 0x80 | ((code >> 12) & 0x3F),
                           0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
            } else {
                bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
            }
        }
        return bytes;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Choose the Smallest Version That Holds the Payload
    // ------------------------------------------------------------
    // Returns 0 when the payload is too long for the supported range, which the
    // caller reports rather than truncating.
    // ------------------------------------------------------------
    function Na__QrEnc__ResolveVersion(byteLength) {
        for (let version = 1; version < Na__QrEnc__BYTE_CAPACITY_M.length; version++) {
            if (byteLength <= Na__QrEnc__BYTE_CAPACITY_M[version]) return version;
        }
        return 0;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Data Codewords for a Payload at a Given Version
    // ------------------------------------------------------------
    function Na__QrEnc__BuildDataCodewords(dataBytes, version, dataCodewordTotal) {
        const bits = [];
        const pushBits = (value, bitCount) => {
            for (let b = bitCount - 1; b >= 0; b--) bits.push((value >> b) & 1);  // <-- Most significant bit first
        };

        const countBits = (version >= Na__QrEnc__COUNT_LONG_FROM_VERSION) ? Na__QrEnc__COUNT_BITS_LONG : Na__QrEnc__COUNT_BITS_SHORT;

        pushBits(Na__QrEnc__MODE_INDICATOR_BYTE, 4);
        pushBits(dataBytes.length, countBits);
        for (let i = 0; i < dataBytes.length; i++) pushBits(dataBytes[i], 8);

        // Terminator, then pad to a byte boundary, then alternating pad
        // codewords until the version's data capacity is filled exactly.
        const capacityBits = dataCodewordTotal * 8;
        const terminator   = Math.min(Na__QrEnc__TERMINATOR_MAX_BITS, capacityBits - bits.length);
        for (let i = 0; i < terminator; i++) bits.push(0);
        while (bits.length % 8 !== 0) bits.push(0);

        const codewords = [];
        for (let i = 0; i < bits.length; i += 8) {
            codewords.push(
                (bits[i] << 7) | (bits[i + 1] << 6) | (bits[i + 2] << 5) | (bits[i + 3] << 4) |
                (bits[i + 4] << 3) | (bits[i + 5] << 2) | (bits[i + 6] << 1) | bits[i + 7]
            );
        }

        let padIndex = 0;
        while (codewords.length < dataCodewordTotal) {
            codewords.push((padIndex++ % 2 === 0) ? Na__QrEnc__PAD_CODEWORD_A : Na__QrEnc__PAD_CODEWORD_B);
        }
        return codewords;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Split Into Blocks, Add Error Correction and Interleave
    // ------------------------------------------------------------
    // Interleaving is what makes the error correction useful: a crease across
    // the printed symbol damages one codeword in many blocks rather than many
    // codewords in one, and each block can then recover independently.
    // ------------------------------------------------------------
    function Na__QrEnc__BuildCodewordSequence(dataCodewords, version) {
        const structure   = Na__QrEnc__BLOCK_STRUCTURE_M[version];
        const ecPerBlock  = structure[0];
        const group1Count = structure[1];
        const group1Size  = structure[2];
        const group2Count = structure[3];
        const group2Size  = structure[4];

        const dataBlocks = [];
        const ecBlocks   = [];
        let   cursor     = 0;

        for (let b = 0; b < group1Count + group2Count; b++) {
            const size  = (b < group1Count) ? group1Size : group2Size;
            const block = dataCodewords.slice(cursor, cursor + size);
            cursor += size;
            dataBlocks.push(block);
            ecBlocks.push(Na__QrEnc__ComputeErrorCorrection(block, ecPerBlock));
        }

        const sequence = [];
        const maxData  = Math.max(group1Size, group2Size);

        for (let i = 0; i < maxData; i++) {
            for (let b = 0; b < dataBlocks.length; b++) {
                if (i < dataBlocks[b].length) sequence.push(dataBlocks[b][i]);
            }
        }
        for (let i = 0; i < ecPerBlock; i++) {
            for (let b = 0; b < ecBlocks.length; b++) sequence.push(ecBlocks[b][i]);
        }
        return sequence;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Matrix Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Create an Empty Matrix of Unset Modules
    // ------------------------------------------------------------
    // Modules start null rather than false so "reserved by a function pattern"
    // and "a light data module" stay distinguishable while the matrix fills.
    // ------------------------------------------------------------
    function Na__QrEnc__CreateMatrix(size) {
        const matrix = new Array(size);
        for (let r = 0; r < size; r++) matrix[r] = new Array(size).fill(null);
        return matrix;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Place One Finder Pattern and Its Separator
    // ------------------------------------------------------------
    function Na__QrEnc__PlaceFinder(matrix, size, originRow, originCol) {
        for (let r = -1; r <= Na__QrEnc__FINDER_SIZE; r++) {
            for (let c = -1; c <= Na__QrEnc__FINDER_SIZE; c++) {
                const row = originRow + r;
                const col = originCol + c;
                if (row < 0 || row >= size || col < 0 || col >= size) continue;

                const isRing = (r === 0 || r === 6 || c === 0 || c === 6);
                const isCore = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
                matrix[row][col] = (r >= 0 && r <= 6 && c >= 0 && c <= 6 && (isRing || isCore));
            }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Place Every Alignment Pattern for a Version
    // ------------------------------------------------------------
    // The three intersections that would collide with a finder pattern are skipped.
    // ------------------------------------------------------------
    function Na__QrEnc__PlaceAlignmentPatterns(matrix, version) {
        const centres = Na__QrEnc__ALIGNMENT_CENTRES[version];
        const last    = centres.length - 1;

        for (let i = 0; i < centres.length; i++) {
            for (let j = 0; j < centres.length; j++) {
                const isCollision = (i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0);
                if (isCollision) continue;

                for (let r = -2; r <= 2; r++) {
                    for (let c = -2; c <= 2; c++) {
                        matrix[centres[i] + r][centres[j] + c] = (Math.max(Math.abs(r), Math.abs(c)) !== 1);
                    }
                }
            }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Place the Timing Tracks and the Permanent Dark Module
    // ------------------------------------------------------------
    function Na__QrEnc__PlaceTimingAndDarkModule(matrix, size, version) {
        const track = Na__QrEnc__TIMING_TRACK_INDEX;
        for (let i = Na__QrEnc__FINDER_SIZE + 1; i < size - Na__QrEnc__FINDER_SIZE - 1; i++) {
            if (matrix[track][i] === null) matrix[track][i] = (i % 2 === 0);
            if (matrix[i][track] === null) matrix[i][track] = (i % 2 === 0);
        }
        matrix[(4 * version) + 9][8] = true;                                     // <-- Always dark, by specification
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Reserve the Cells the Format and Version Blocks Will Occupy
    // ------------------------------------------------------------
    // Reserved before data placement so the zigzag skips them, then written for
    // real once the mask is chosen. Reserving with false rather than null is
    // what keeps them out of the data path.
    // ------------------------------------------------------------
    function Na__QrEnc__ReserveInformationAreas(matrix, size, version) {
        for (let i = 0; i < 9; i++) {
            if (matrix[8][i] === null) matrix[8][i] = false;
            if (matrix[i][8] === null) matrix[i][8] = false;
        }
        for (let i = 0; i < 8; i++) {
            if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
            if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
        }

        if (version < Na__QrEnc__VERSION_INFO_MIN_VERSION) return;

        for (let r = 0; r < 6; r++) {
            for (let c = 0; c < 3; c++) {
                matrix[r][size - 11 + c] = false;
                matrix[size - 11 + c][r] = false;
            }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Walk the Zigzag and Place Every Data Bit
    // ------------------------------------------------------------
    // Two module columns at a time, upward then downward, from the bottom
    // right, skipping the vertical timing track. Any cell already set belongs
    // to a function pattern and is stepped over.
    // ------------------------------------------------------------
    function Na__QrEnc__PlaceDataBits(matrix, size, codewords) {
        const totalBits = codewords.length * 8;
        let   bitIndex  = 0;
        let   upward    = true;

        for (let col = size - 1; col > 0; col -= 2) {
            if (col === Na__QrEnc__TIMING_TRACK_INDEX) col--;                    // <-- The timing track is not a data column

            for (let row = 0; row < size; row++) {
                const r = upward ? (size - 1 - row) : row;

                for (let pair = 0; pair < 2; pair++) {
                    const targetCol = col - pair;
                    if (matrix[r][targetCol] !== null) continue;

                    let bit = 0;
                    if (bitIndex < totalBits) bit = (codewords[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
                    matrix[r][targetCol] = (bit === 1);
                    bitIndex++;
                }
            }
            upward = !upward;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Masking
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Test One Mask Condition at a Cell
    // ------------------------------------------------------------
    function Na__QrEnc__MaskCondition(maskIndex, row, col) {
        switch (maskIndex) {
            case 0 : return ((row + col) % 2) === 0;
            case 1 : return (row % 2) === 0;
            case 2 : return (col % 3) === 0;
            case 3 : return ((row + col) % 3) === 0;
            case 4 : return ((Math.floor(row / 2) + Math.floor(col / 3)) % 2) === 0;
            case 5 : return (((row * col) % 2) + ((row * col) % 3)) === 0;
            case 6 : return ((((row * col) % 2) + ((row * col) % 3)) % 2) === 0;
            default: return ((((row + col) % 2) + ((row * col) % 3)) % 2) === 0;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read One Cell of a Row-Wise or Column-Wise Line
    // ------------------------------------------------------------
    // The two penalty rules below run identically along rows and columns, so
    // the orientation is a flag rather than two near-identical loops.
    // ------------------------------------------------------------
    function Na__QrEnc__ReadLineCell(matrix, lineIndex, offset, isRow) {
        return isRow ? matrix[lineIndex][offset] : matrix[offset][lineIndex];
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Score Same-Colour Runs Along One Line
    // ------------------------------------------------------------
    function Na__QrEnc__ScoreLineRuns(matrix, size, lineIndex, isRow) {
        let score     = 0;
        let runColour = null;
        let runLength = 0;

        for (let i = 0; i < size; i++) {
            const cell = Na__QrEnc__ReadLineCell(matrix, lineIndex, i, isRow);
            if (cell === runColour) { runLength++; continue; }
            if (runLength >= Na__QrEnc__PENALTY_ADJACENT_RUN_MIN) {
                score += Na__QrEnc__PENALTY_ADJACENT_BASE + (runLength - Na__QrEnc__PENALTY_ADJACENT_RUN_MIN);
            }
            runColour = cell;
            runLength = 1;
        }
        if (runLength >= Na__QrEnc__PENALTY_ADJACENT_RUN_MIN) {
            score += Na__QrEnc__PENALTY_ADJACENT_BASE + (runLength - Na__QrEnc__PENALTY_ADJACENT_RUN_MIN);
        }
        return score;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Score Finder-Like Sequences Along One Line
    // ------------------------------------------------------------
    // 1011101 with four light modules on one side reads to a scanner like a
    // finder pattern and can cost it the symbol's orientation. 0x5D0 is
    // 10111010000 and 0x05D is 00001011101, the two forms the specification
    // penalises.
    // ------------------------------------------------------------
    function Na__QrEnc__ScoreLineFinderLike(matrix, size, lineIndex, isRow) {
        let score   = 0;
        let pattern = 0;

        for (let i = 0; i < size; i++) {
            pattern = ((pattern << 1) & 0x7FF) | (Na__QrEnc__ReadLineCell(matrix, lineIndex, i, isRow) ? 1 : 0);
            if (i < 10) continue;
            if (pattern === 0x5D0 || pattern === 0x05D) score += Na__QrEnc__PENALTY_FINDER_LIKE;
        }
        return score;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Score a Masked Matrix Against the Four Penalty Rules
    // ------------------------------------------------------------
    // Lower is better. The rules exist to avoid symbols that a scanner would
    // find hard to lock onto: long same-colour runs, solid blocks, sequences
    // that read like a finder pattern, and a badly skewed dark ratio.
    // ------------------------------------------------------------
    function Na__QrEnc__ScoreMatrix(matrix, size) {
        let score     = 0;
        let darkCount = 0;

        for (let i = 0; i < size; i++) {
            score += Na__QrEnc__ScoreLineRuns(matrix, size, i, true);
            score += Na__QrEnc__ScoreLineFinderLike(matrix, size, i, true);
            score += Na__QrEnc__ScoreLineRuns(matrix, size, i, false);
            score += Na__QrEnc__ScoreLineFinderLike(matrix, size, i, false);
        }

        for (let r = 0; r < size - 1; r++) {
            for (let c = 0; c < size - 1; c++) {
                if (matrix[r][c] === matrix[r][c + 1] &&
                    matrix[r][c] === matrix[r + 1][c] &&
                    matrix[r][c] === matrix[r + 1][c + 1]) {
                    score += Na__QrEnc__PENALTY_BLOCK;
                }
            }
        }

        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (matrix[r][c]) darkCount++;
            }
        }

        const darkPercent = (darkCount * 100) / (size * size);
        score += Math.floor(Math.abs(darkPercent - 50) / 5) * Na__QrEnc__PENALTY_BALANCE_STEP;
        return score;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Format and Version Information
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Compute a BCH Remainder for a Value
    // ------------------------------------------------------------
    // Polynomial long division over GF(2). The data value is shifted up by the
    // generator's degree to make room for the check bits, then each data bit
    // position is cleared from the top down. What is left below the shift is
    // the remainder. generatorDegree is the index of the generator's highest
    // set bit: 10 for the format generator 0x537, 12 for the version generator
    // 0x1F25.
    // ------------------------------------------------------------
    function Na__QrEnc__BchRemainder(dataValue, generator, generatorDegree, dataBitCount) {
        let remainder = dataValue << generatorDegree;
        for (let bit = dataBitCount - 1; bit >= 0; bit--) {
            if (remainder & (1 << (bit + generatorDegree))) remainder = remainder ^ (generator << bit);
        }
        return remainder;                                                        // <-- Low generatorDegree bits only
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Two Copies of the Format Information
    // ------------------------------------------------------------
    // Written twice, in two places, so a symbol whose corner is damaged is
    // still readable. Both copies carry the same fifteen bits.
    // ------------------------------------------------------------
    function Na__QrEnc__WriteFormatInformation(matrix, size, maskIndex) {
        const raw    = (Na__QrEnc__ERROR_CORRECTION_BITS_M << 3) | maskIndex;
        const format = ((raw << Na__QrEnc__FORMAT_BCH_DEGREE) |
                        Na__QrEnc__BchRemainder(raw, Na__QrEnc__FORMAT_BCH_GENERATOR, Na__QrEnc__FORMAT_BCH_DEGREE, Na__QrEnc__FORMAT_DATA_BITS))
                       ^ Na__QrEnc__FORMAT_XOR_MASK;

        for (let i = 0; i < 15; i++) {
            const bit = ((format >> i) & 1) === 1;

            if (i < 6)        matrix[i][8]             = bit;
            else if (i < 8)   matrix[i + 1][8]         = bit;
            else if (i === 8) matrix[8][7]             = bit;
            else              matrix[8][14 - i]        = bit;

            if (i < 8)        matrix[8][size - 1 - i]  = bit;
            else              matrix[size - 15 + i][8] = bit;
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Write the Two Copies of the Version Information
    // ------------------------------------------------------------
    // Only versions 7 and above carry it. Below that a scanner infers the
    // version from the symbol's module count, which is the case for a project's
    // version 3 code; this is here for whatever longer payload comes next, and
    // is proved from version 7 to 10 by the test beside the app.
    // ------------------------------------------------------------
    function Na__QrEnc__WriteVersionInformation(matrix, size, version) {
        if (version < Na__QrEnc__VERSION_INFO_MIN_VERSION) return;

        const info = (version << Na__QrEnc__VERSION_BCH_DEGREE) |
                     Na__QrEnc__BchRemainder(version, Na__QrEnc__VERSION_BCH_GENERATOR, Na__QrEnc__VERSION_BCH_DEGREE, Na__QrEnc__VERSION_DATA_BITS);

        for (let i = 0; i < 18; i++) {
            const bit = ((info >> i) & 1) === 1;
            const row = Math.floor(i / 3);
            const col = size - 11 + (i % 3);
            matrix[row][col] = bit;
            matrix[col][row] = bit;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Merge Horizontal Runs of Dark Modules Into Rectangles
    // ------------------------------------------------------------
    // PS01's 29 x 29 symbol holds 436 dark modules. One mark per module is 436
    // path segments on every sheet redraw and every export; merging each row's
    // consecutive dark modules cuts that to 217 with an identical result on
    // the page.
    //
    // Returns [ { Col, Row, Length } ] in module coordinates.
    // ------------------------------------------------------------
    function Na__QrEnc__MergeRuns(modules, size) {
        const runs = [];
        if (!Array.isArray(modules)) return runs;

        for (let r = 0; r < size; r++) {
            let c = 0;
            while (c < size) {
                if (!modules[r][c]) { c++; continue; }
                const runStart = c;
                while (c < size && modules[r][c]) c++;
                runs.push({ Col : runStart, Row : r, Length : c - runStart });
            }
        }
        return runs;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Most Bytes a Symbol Can Carry
    // ------------------------------------------------------------
    function Na__QrEnc__MaxBytes() {
        return Na__QrEnc__BYTE_CAPACITY_M[Na__QrEnc__BYTE_CAPACITY_M.length - 1];
    }
    // ------------------------------------------------------------


    // FUNCTION | Encode a String as a QR Symbol
    // ------------------------------------------------------------
    // Returns { Text, Version, Size, Modules, Runs } on success, or null when
    // the payload is empty or longer than the supported range. Modules is a
    // Size x Size array of booleans, true meaning a dark module, row first;
    // Runs is the same matrix merged for painting.
    // ------------------------------------------------------------
    function Na__QrEnc__Encode(text) {
        const dataBytes = Na__QrEnc__Utf8Bytes(text);
        if (!dataBytes.length) return null;

        const version = Na__QrEnc__ResolveVersion(dataBytes.length);
        if (!version) {
            console.error('[TrueVision3D ProjectQr] A payload of ' + dataBytes.length + ' bytes is over the ' +
                          Na__QrEnc__MaxBytes() + ' a symbol can carry. Nothing was encoded.');
            return null;
        }

        const structure = Na__QrEnc__BLOCK_STRUCTURE_M[version];
        const dataTotal = (structure[1] * structure[2]) + (structure[3] * structure[4]);
        const size      = 17 + (version * 4);
        const codewords = Na__QrEnc__BuildCodewordSequence(Na__QrEnc__BuildDataCodewords(dataBytes, version, dataTotal), version);

        // The function patterns are identical under every mask, so the base
        // matrix is built once and each candidate mask is applied to a copy.
        const base = Na__QrEnc__CreateMatrix(size);
        Na__QrEnc__PlaceFinder(base, size, 0, 0);
        Na__QrEnc__PlaceFinder(base, size, 0, size - Na__QrEnc__FINDER_SIZE);
        Na__QrEnc__PlaceFinder(base, size, size - Na__QrEnc__FINDER_SIZE, 0);
        Na__QrEnc__PlaceAlignmentPatterns(base, version);
        Na__QrEnc__PlaceTimingAndDarkModule(base, size, version);
        Na__QrEnc__ReserveInformationAreas(base, size, version);

        const isFunctionCell = base.map((row) => row.map((cell) => cell !== null));
        Na__QrEnc__PlaceDataBits(base, size, codewords);

        let bestMatrix = null;
        let bestScore  = Infinity;

        for (let maskIndex = 0; maskIndex < Na__QrEnc__MASK_PATTERN_COUNT; maskIndex++) {
            const candidate = base.map((row, r) => row.map((cell, c) =>
                isFunctionCell[r][c] ? cell : (cell !== Na__QrEnc__MaskCondition(maskIndex, r, c))));

            Na__QrEnc__WriteFormatInformation(candidate, size, maskIndex);
            Na__QrEnc__WriteVersionInformation(candidate, size, version);

            const score = Na__QrEnc__ScoreMatrix(candidate, size);
            if (score < bestScore) {
                bestScore  = score;
                bestMatrix = candidate;
            }
        }

        return {
            Text    : String(text),
            Version : version,
            Size    : size,
            Modules : bestMatrix,
            Runs    : Na__QrEnc__MergeRuns(bestMatrix, size)
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Project QR Code Encoder API
    // ------------------------------------------------------------
    export {
        Na__QrEnc__Encode,
        Na__QrEnc__MergeRuns,
        Na__QrEnc__MaxBytes
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
