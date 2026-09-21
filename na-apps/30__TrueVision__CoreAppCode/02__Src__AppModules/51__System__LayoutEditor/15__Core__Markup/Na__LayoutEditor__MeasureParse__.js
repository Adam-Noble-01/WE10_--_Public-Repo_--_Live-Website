// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - MEASUREMENT PARSING
// =============================================================================
//
// FILE       : Na__LayoutEditor__MeasureParse__.js
// NAMESPACE  : Na__LeMParse
// MODULE     : Layout Editor - Measurement Parsing
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Read what is typed into the Measurements box as millimetres, and write millimetres back for it to show
// CREATED    : 14-Sep-2026
//
// DESCRIPTION:
// - A LENGTH is a number with an optional unit: 2500, 2,500, 2500mm, 250cm,
//   2.5m or 2.5 M. A number with no unit is millimetres. Case never matters.
//   A leading minus sign reverses the direction it is drawn in.
// - COMMAS ARE THOUSANDS SEPARATORS in a length, as a UK drawing writes them:
//   2,000 and 3,555 are two thousand and three thousand five hundred and
//   fifty-five millimetres. A comma only counts as one where exactly three
//   digits follow it, so 2,5 is refused rather than read as two and a half.
// - A PAIR is the Rectangle tool's width and height. x, X, * or ; always
//   separates the two (3000 x 2000). A comma separates them too, which
//   means a comma in a pair can be either thing; the rule that settles it
//   is written out at Na__LeMParse__ReadLength and suits the sizes a
//   building drawing uses: 3000,2000 and 900,600 are pairs, 1,500 is one
//   figure, 1,500,900 is 1500 by 900. Either side may be left out to keep
//   the size the cursor gives (3000, or ,2000); a single figure with no
//   separator means a square.
// - AN ARRAY is SketchUp's Move tool count, typed after a copy: 3x, x3, *3 or
//   3* for copies at one, two and three times the copy's distance, /3 or 3/
//   for copies dividing that distance into three.
// - Pure: no imports, no DOM, no config. The caller hands in the separator
//   and precision to format with, so the rules can be tested in Node.
//
// INTEGRATION:
// - Na__LayoutEditor__Measurements__ reads the box with it and formats the
//   live readings with it.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - Array: SketchUp's Move tool multiplier (3x, x3, *3, 3*) and divider (/3,
//   3/), for a Ctrl-drag copy (Na__LayoutEditor__SheetTools__CopyDrag__).
//
// 14-Sep-2026 - Version 1.0.0
// - Initial implementation: lengths with units and thousands separators,
//   width and height pairs, and the readout format.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Units in Millimetres, Longest Name First
    // ------------------------------------------------------------
    const Na__LeMParse__UNITS = Object.freeze([
        { name : 'mm', factor : 1    },
        { name : 'cm', factor : 10   },
        { name : 'm',  factor : 1000 }
    ]);
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Pair Separators and the Size of a Pair Figure
    // ------------------------------------------------------------
    const Na__LeMParse__PAIR_SEPARATORS = 'xX*;';   // <-- Always separate the width from the height
    const Na__LeMParse__PAIR_MAX_DIGITS = 6;        // <-- A comma group that would take a pair figure past this is a separator instead
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Why a Reading Failed
    // ------------------------------------------------------------
    const Na__LeMParse__REASON_EMPTY  = 'empty';    // <-- Nothing typed
    const Na__LeMParse__REASON_NUMBER = 'number';   // <-- Not a number this reader understands
    const Na__LeMParse__REASON_UNIT   = 'unit';     // <-- A number followed by a unit it does not know
    const Na__LeMParse__REASON_PAIR   = 'pair';     // <-- Not a width and a height
    const Na__LeMParse__REASON_COUNT  = 'count';    // <-- An array whose count is not a whole number of at least one
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Two Kinds of Array (SketchUp's Move tool)
    // ------------------------------------------------------------
    const Na__LeMParse__ARRAY_TIMES  = 'times';     // <-- 3x, x3, *3, 3*: copies at the move's distance, twice it, three times it
    const Na__LeMParse__ARRAY_DIVIDE = 'divide';    // <-- /3, 3/: copies that divide the move's distance into equal parts
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is a Character One of the Ten Digits
    // ------------------------------------------------------------
    function Na__LeMParse__IsDigit(ch) {
        return typeof ch === 'string' && ch.length === 1 && ch >= '0' && ch <= '9';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Step Past Spaces
    // ------------------------------------------------------------
    function Na__LeMParse__SkipSpaces(text, index) {
        let i = index;
        while (i < text.length && text[i] === ' ') i++;
        return i;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read One Length Starting at an Index
    // ------------------------------------------------------------
    // Returns { valueMm, end, unit } - end is the index after what was read -
    // or { error } when there is no length there.
    //
    // THE COMMA RULE. A comma followed by exactly three digits, and then by
    // anything but a fourth digit, is a thousands separator: 2,000 and 12,500.
    // In a PAIR (pairMode) two more rules stop it swallowing the separator
    // between the width and the height:
    // - a figure that begins with three digits takes no comma group, so
    //   900,600 is 900 then 600 rather than nine hundred thousand six hundred;
    // - a figure never grows past six digits, so 1,500,900 is 1500 then 900.
    // One and two digit leads still group: 1,500 and 12,500 are one figure.
    // ------------------------------------------------------------
    function Na__LeMParse__ReadLength(text, index, pairMode) {
        let i = Na__LeMParse__SkipSpaces(text, index);
        let sign = 1;
        if (text[i] === '-' || text[i] === '+') {
            if (text[i] === '-') sign = -1;
            i = Na__LeMParse__SkipSpaces(text, i + 1);
        }

        // WHOLE PART | Digits, then any comma groups the rule allows
        let whole = '';
        while (Na__LeMParse__IsDigit(text[i])) { whole += text[i]; i++; }
        if (whole.length >= 1 && whole.length <= 3) {
            const lead = whole.length;
            while (text[i] === ',' && Na__LeMParse__IsDigit(text[i + 1]) && Na__LeMParse__IsDigit(text[i + 2]) && Na__LeMParse__IsDigit(text[i + 3]) && !Na__LeMParse__IsDigit(text[i + 4])) {
                if (pairMode && lead === 3 && whole.length === 3) break;                          // <-- 900,600: a three-digit figure, then the next
                if (pairMode && whole.length + 3 > Na__LeMParse__PAIR_MAX_DIGITS) break;          // <-- 1,500,900: 1500, then 900
                whole += text.substr(i + 1, 3);
                i += 4;
            }
        }

        // FRACTION | A point and its digits; "2." is still two
        let fraction = '';
        if (text[i] === '.') {
            let j = i + 1;
            while (Na__LeMParse__IsDigit(text[j])) { fraction += text[j]; j++; }
            if (fraction.length || whole.length) i = j;
        }
        if (!whole.length && !fraction.length) return { error : Na__LeMParse__REASON_NUMBER };
        const magnitude = parseFloat((whole || '0') + '.' + (fraction || '0'));
        if (!Number.isFinite(magnitude)) return { error : Na__LeMParse__REASON_NUMBER };

        // UNIT | Optional, after optional spaces; a letter left touching it is not a unit
        const afterNumber = i;
        i = Na__LeMParse__SkipSpaces(text, i);
        const rest = text.slice(i).toLowerCase();
        let unit = null;
        for (let u = 0; u < Na__LeMParse__UNITS.length; u++) {
            if (rest.indexOf(Na__LeMParse__UNITS[u].name) === 0) { unit = Na__LeMParse__UNITS[u]; break; }
        }
        if (unit) {
            const next = text[i + unit.name.length];
            if (next !== undefined && /[a-zA-Z]/.test(next)) return { error : Na__LeMParse__REASON_UNIT };
            i += unit.name.length;
        } else {
            if (/^[a-zA-Z]/.test(rest) && Na__LeMParse__PAIR_SEPARATORS.indexOf(rest.charAt(0)) === -1) return { error : Na__LeMParse__REASON_UNIT };
            i = afterNumber;                                                                    // <-- The spaces belong to whatever comes next
        }
        return { valueMm : sign * magnitude * (unit ? unit.factor : 1), end : i, unit : unit ? unit.name : null };
    }
    // ------------------------------------------------------------


    // FUNCTION | Read One Length (a figure and an optional unit, nothing else)
    // ------------------------------------------------------------
    // Returns { ok : true, valueMm } or { ok : false, reason }.
    // ------------------------------------------------------------
    function Na__LeMParse__Length(text) {
        const src = String(text === undefined || text === null ? '' : text).trim();
        if (!src) return { ok : false, reason : Na__LeMParse__REASON_EMPTY };
        const token = Na__LeMParse__ReadLength(src, 0, false);
        if (token.error) return { ok : false, reason : token.error };
        if (Na__LeMParse__SkipSpaces(src, token.end) !== src.length) return { ok : false, reason : Na__LeMParse__REASON_NUMBER };
        return { ok : true, valueMm : token.valueMm };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Two Sides Split Off an Explicit Separator
    // ------------------------------------------------------------
    function Na__LeMParse__Sides(left, right) {
        const a = left.trim(), b = right.trim();
        if (!a && !b) return { ok : false, reason : Na__LeMParse__REASON_PAIR };
        const first  = a ? Na__LeMParse__Length(a) : null;
        const second = b ? Na__LeMParse__Length(b) : null;
        if ((first && !first.ok) || (second && !second.ok)) return { ok : false, reason : Na__LeMParse__REASON_PAIR };
        return { ok : true, first : first ? first.valueMm : null, second : second ? second.valueMm : null, square : false };
    }
    // ------------------------------------------------------------


    // FUNCTION | Read a Width and a Height
    // ------------------------------------------------------------
    // Returns { ok : true, first, second, square } or { ok : false, reason }.
    // first and second are millimetres, or null for a side left out to keep
    // what the cursor gives. square is true for a single figure with no
    // separator at all, which gives both sides.
    // ------------------------------------------------------------
    function Na__LeMParse__Pair(text) {
        const src = String(text === undefined || text === null ? '' : text).trim();
        if (!src) return { ok : false, reason : Na__LeMParse__REASON_EMPTY };

        // EXPLICIT | x, X, * or ; - there may be only one
        let explicitAt = -1, explicitCount = 0;
        for (let c = 0; c < src.length; c++) {
            if (Na__LeMParse__PAIR_SEPARATORS.indexOf(src[c]) !== -1) { explicitCount++; if (explicitAt === -1) explicitAt = c; }
        }
        if (explicitCount > 1) return { ok : false, reason : Na__LeMParse__REASON_PAIR };
        if (explicitCount === 1) return Na__LeMParse__Sides(src.slice(0, explicitAt), src.slice(explicitAt + 1));

        // COMMA | A figure, then perhaps a comma and a second figure
        let i = 0, first = null;
        if (src[0] !== ',') {
            const token = Na__LeMParse__ReadLength(src, 0, true);
            if (token.error) return { ok : false, reason : token.error === Na__LeMParse__REASON_UNIT ? token.error : Na__LeMParse__REASON_PAIR };
            first = token.valueMm;
            i = Na__LeMParse__SkipSpaces(src, token.end);
            if (i === src.length) return { ok : true, first : first, second : first, square : true };
        }
        if (src[i] !== ',') return { ok : false, reason : Na__LeMParse__REASON_PAIR };
        i = Na__LeMParse__SkipSpaces(src, i + 1);
        if (i === src.length) return first === null ? { ok : false, reason : Na__LeMParse__REASON_PAIR } : { ok : true, first : first, second : null, square : false };
        const token = Na__LeMParse__ReadLength(src, i, true);
        if (token.error) return { ok : false, reason : token.error === Na__LeMParse__REASON_UNIT ? token.error : Na__LeMParse__REASON_PAIR };
        if (Na__LeMParse__SkipSpaces(src, token.end) !== src.length) return { ok : false, reason : Na__LeMParse__REASON_PAIR };
        return { ok : true, first : first, second : token.valueMm, square : false };
    }
    // ------------------------------------------------------------


    // FUNCTION | Read an Array Count (SketchUp's Move Tool Multiplier and Divider)
    // ------------------------------------------------------------
    // Typed after a copy: 3x, x3, *3 and 3* ask for copies at the copy's
    // distance, twice it and three times it; /3 and 3/ divide the distance into
    // three equal parts with a copy at each. x is either case and spaces may
    // sit either side of the sign. Returns { ok : true, mode, count }, or
    // { ok : false, reason } - REASON_COUNT when it is an array but its count
    // is not a whole number of at least one (0x, 2.5x, /0), REASON_NUMBER
    // when it is not an array at all, so a length can be tried instead.
    // ------------------------------------------------------------
    function Na__LeMParse__Array(text) {
        const src = String(text === undefined || text === null ? '' : text).trim();
        if (!src) return { ok : false, reason : Na__LeMParse__REASON_EMPTY };
        const found = /^(?:([xX*])\s*([0-9.,]+)|([0-9.,]+)\s*([xX*])|\/\s*([0-9.,]+)|([0-9.,]+)\s*\/)$/.exec(src);
        if (!found) return { ok : false, reason : Na__LeMParse__REASON_NUMBER };
        const digits = found[2] || found[3] || found[5] || found[6];
        const mode   = (found[5] || found[6]) ? Na__LeMParse__ARRAY_DIVIDE : Na__LeMParse__ARRAY_TIMES;
        if (!/^[0-9]+$/.test(digits)) return { ok : false, reason : Na__LeMParse__REASON_COUNT };
        const count = parseInt(digits, 10);
        if (!(count >= 1)) return { ok : false, reason : Na__LeMParse__REASON_COUNT };
        return { ok : true, mode : mode, count : count };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Writing
// -----------------------------------------------------------------------------

    // FUNCTION | Millimetres as the Box Shows Them
    // ------------------------------------------------------------
    // options: { precision (decimal places, 0 to 3), thousandsSep, suffix }.
    // Trailing zeros after the point are dropped, so a whole number never
    // reads 2,500.0 - and a length that needs its tenth still shows it.
    // ------------------------------------------------------------
    function Na__LeMParse__Format(valueMm, options) {
        const o = options || {};
        if (!Number.isFinite(valueMm)) return '';
        const precision = Number.isFinite(o.precision) ? Math.max(0, Math.min(3, Math.round(o.precision))) : 0;
        const separator = typeof o.thousandsSep === 'string' ? o.thousandsSep : ',';
        let fixed = Math.abs(valueMm).toFixed(precision);
        if (fixed.indexOf('.') !== -1) fixed = fixed.replace(/0+$/, '').replace(/[.]$/, '');
        const parts = fixed.split('.');
        if (separator) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, separator);
        const negative = valueMm < 0 && parseFloat(fixed) !== 0;
        return (negative ? '-' : '') + parts.join('.') + (typeof o.suffix === 'string' ? o.suffix : '');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Measurement Parsing API
    // ------------------------------------------------------------
    export {
        Na__LeMParse__REASON_EMPTY,
        Na__LeMParse__REASON_NUMBER,
        Na__LeMParse__REASON_UNIT,
        Na__LeMParse__REASON_PAIR,
        Na__LeMParse__REASON_COUNT,
        Na__LeMParse__ARRAY_TIMES,
        Na__LeMParse__ARRAY_DIVIDE,
        Na__LeMParse__Length,
        Na__LeMParse__Pair,
        Na__LeMParse__Array,
        Na__LeMParse__Format
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
