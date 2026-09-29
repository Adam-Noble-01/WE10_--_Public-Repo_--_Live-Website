// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT STANDARD SECTION - DOCUMENT FOOTER
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Standard__Footer__.js
// NAMESPACE  : Na__LeStmtFoot
// MODULE     : Layout Editor - Statement Writer - Standard Section: Document Footer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Close a statement with its end-of-document note and copyright line, always last, in spacing and colours of its own
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - WHY. Adam, 29-Sep-2026, over the end of RB05's pre-application statement:
//   "The footer is not placed correctly and has the drawings table pasted in
//   between ... The footer doesn't seem correct at all." It was not. The
//   house footer is two hand-written lines, each an <h6> in a <div>:
//       <div>
//           <h6 style="margin-top:02.00mm;font-size:08.00pt;font-color:#ebebeb;">Note To Reader : End Of Pre-Application Statement</h6>
//       </div>
//   and on RB05:
//     - the two halves were apart, with the whole drawing pack between them,
//       so the statement "ended" and then carried on;
//     - the copyright line sat straight under the last table, with none of
//       the divider the house template puts above it, so it read as a stray
//       caption rather than the end of the document;
//     - "font-color" is not a CSS property, so the grey the template asks
//       for has never been drawn anywhere (the theme's h6 grey, #787878, is
//       what everyone has seen) - and #ebebeb would be all but invisible on
//       white if it ever were;
//     - an <h6> is a heading, carrying the theme's minus two millimetres
//       under it, for two lines that are not headings of anything.
// - DRAWN BY THE APP, LIKE THE HEADER. The marker holds the two lines as
//   fields, and the section draws them as one quiet row under the last
//   divider: the note to the left, the copyright to the right.
//       <div class="na-le-stmt-std-marker" data-na-standard-section="DocumentFooter">
//       End Note: Note To Reader : End Of Pre-Application Statement
//       Copyright: © 2026 Noble Architecture
//       </div>
//   A line at the margin with a colon starts a field; an indented line
//   carries the field above on. A field left empty (or taken out) is not
//   drawn. Any other field is drawn under the note, in the order written.
// - ALWAYS LAST, UNDER A DIVIDER. It lands at the very end of the statement,
//   with a major divider above it unless one is already there, and it does
//   not move: anything switched on later - the Drawing Schedule - lands above
//   it. That is what stops a table being pasted between the end of a
//   statement and its copyright again.
// - SWITCHING IT ON TAKES OVER THE HOUSE FOOTER. The copyright line at the
//   end of the file, and an end-of-statement note directly above it, are
//   read into the fields and replaced by the marker. A note further up (a
//   design and access statement's "End Of Main Statement" before its
//   supplementary notes) is the writer's own divide and is left where it is.
//   Switching it off writes the two house lines back.
//
// INTEGRATION:
// - Registered with Na__LayoutEditor__Statement__Standard__Registry__, which
//   calls Adopt when it is switched on, Unwrap when it is switched off and
//   Build to draw it. Styled by .na-le-stmt-std-foot in the statement
//   document stylesheet. Pure; runs under node.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (29-Sep-2026).
// - ValeVision    : not yet ported (ValeVision has no statement tab).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.167.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Section's Id and Config Block
    // ------------------------------------------------------------
    const Na__LeStmtFoot__ID     = 'DocumentFooter';
    const Na__LeStmtFoot__BLOCK  = 'StatementStandard__DocumentFooter__Config';
    const Na__LeStmtFoot__PREFIX = 'DocumentFooter__';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Built-In Defaults (mirror the config file)
    // ------------------------------------------------------------
    const Na__LeStmtFoot__FALLBACKS = {
        Label        : 'Document Footer',
        NewFields    : [
            'End Note: Note To Reader : End Of Statement',
            'Copyright: © {Year} Noble Architecture'
        ],
        FallbackText : 'Standard Section: Document Footer.'
    };
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Fields and the House Lines This Section Takes Over
    // ------------------------------------------------------------
    const Na__LeStmtFoot__FIELD_LINE = /^([A-Za-z][A-Za-z &'/-]{0,48}?)\s*:\s*(.*)$/;   // <-- The header's own rule
    const Na__LeStmtFoot__H6_BLOCK   = /^\s*(?:<div[^>]*>\s*)?<h6\b[^>]*>([\s\S]*?)<\/h6>\s*(?:<\/div>)?\s*$/i;
    const Na__LeStmtFoot__COPYRIGHT  = /(&copy;|©|\(c\)|copyright)/i;
    const Na__LeStmtFoot__END_NOTE   = /\bend\s+of\b/i;
    const Na__LeStmtFoot__H6_STYLE   = 'margin-top:02.00mm;font-size:08.00pt;font-color:#ebebeb;';   // <-- The house template's, verbatim, for writing it back
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Escape Text for HTML
    // ------------------------------------------------------------
    function Na__LeStmtFoot__Escape(text) {
        return String(text === undefined || text === null ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Setup, the Config File Over the Built-In Defaults
    // ------------------------------------------------------------
    function Na__LeStmtFoot__Setup(config) {
        const block = (config && typeof config === 'object' && config[Na__LeStmtFoot__BLOCK] && typeof config[Na__LeStmtFoot__BLOCK] === 'object')
            ? config[Na__LeStmtFoot__BLOCK] : {};
        const setup = {};
        for (const key of Object.keys(Na__LeStmtFoot__FALLBACKS)) {
            const fallback = Na__LeStmtFoot__FALLBACKS[key];
            const value    = block[Na__LeStmtFoot__PREFIX + key];
            if (Array.isArray(fallback)) setup[key] = Array.isArray(value) && value.length ? value : fallback;
            else                         setup[key] = typeof value === 'string' && value.trim() !== '' ? value : fallback;
        }
        return setup;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Marker's Lines Into Fields
    // ------------------------------------------------------------
    // [{ Key, Lines : [..] }] in the order written, as the header reads its.
    // ------------------------------------------------------------
    function Na__LeStmtFoot__Fields(body) {
        const fields = [];
        for (const raw of String(body || '').split('\n')) {
            if (raw.trim() === '') continue;
            const field = /^\S/.test(raw) ? Na__LeStmtFoot__FIELD_LINE.exec(raw.trim()) : null;
            if (field) fields.push({ Key : field[1].trim(), Lines : field[2].trim() === '' ? [] : [ field[2].trim() ] });
            else if (fields.length) fields[fields.length - 1].Lines.push(raw.trim());
        }
        return fields;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An <h6> Line's Words, as Plain Text
    // ------------------------------------------------------------
    // The copyright is written "&copy;" in the house markup; it is held as
    // the character itself in the marker, so the fields read as they print.
    // ------------------------------------------------------------
    function Na__LeStmtFoot__H6Text(block) {
        const match = (block && block.Kind === 'html') ? Na__LeStmtFoot__H6_BLOCK.exec(block.Html || '') : null;
        if (!match) return null;
        return match[1]
            .replace(/<[^>]*>/g, '')
            .replace(/&copy;/gi, '©').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"')
            .replace(/\s+/g, ' ')
            .trim();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One House Footer Line, as the Template Writes It
    // ------------------------------------------------------------
    function Na__LeStmtFoot__H6Lines(text) {
        const html = Na__LeStmtFoot__Escape(text).replace(/©/g, '&copy;');
        return [ '<div>  ', '    <h6 style="' + Na__LeStmtFoot__H6_STYLE + '">' + html + '</h6>', '</div>  ' ];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The Section's HTML
    // ------------------------------------------------------------
    // overrides.body is the text inside the marker. The copyright sits to the
    // right; the note and any other field stack on the left.
    // ------------------------------------------------------------
    function Na__LeStmtFoot__Build(config, overrides) {
        const C      = 'na-le-stmt-std-foot';
        const fields = Na__LeStmtFoot__Fields(overrides && overrides.body);
        const text   = (field) => field.Lines.map(Na__LeStmtFoot__Escape).join('<br>');

        let left  = '';
        let right = '';
        for (const field of fields) {
            if (!field.Lines.length) continue;
            if (field.Key.toLowerCase() === 'copyright') right += '<div class="' + C + '__copyright">' + text(field) + '</div>';
            else                                         left  += '<div class="' + C + '__note">' + text(field) + '</div>';
        }
        return '<footer class="na-le-stmt-std ' + C + '">' +
                   '<div class="' + C + '__left">' + left + '</div>' +
                   '<div class="' + C + '__right">' + right + '</div>' +
               '</footer>';
    }
    // ------------------------------------------------------------


    // FUNCTION | A New Footer's Fields
    // ------------------------------------------------------------
    // {Year} is this year: the year the footer is first written, which is
    // then the statement's own and does not roll over with the calendar.
    // ------------------------------------------------------------
    function Na__LeStmtFoot__NewBody(config) {
        const year = String(new Date().getFullYear());
        return Na__LeStmtFoot__Setup(config).NewFields.map((line) => String(line).split('{Year}').join(year)).join('\n');
    }
    // ------------------------------------------------------------


    // FUNCTION | Take Over the House Footer at the End of a Statement
    // ------------------------------------------------------------
    // blocks: the statement's tokenised blocks. Returns { Start, End, Body } -
    // the run [Start, End) replaced by the marker and the fields it carries -
    // or null when the file does not end with a copyright line.
    // ------------------------------------------------------------
    function Na__LeStmtFoot__Adopt(blocks) {
        let last = blocks.length - 1;
        while (last >= 0 && blocks[last].Kind === 'blank') last--;
        const copyright = last >= 0 ? Na__LeStmtFoot__H6Text(blocks[last]) : null;
        if (!copyright || !Na__LeStmtFoot__COPYRIGHT.test(copyright)) return null;

        let start = last;
        let above = last - 1;
        while (above >= 0 && blocks[above].Kind === 'blank') above--;
        const note = above >= 0 ? Na__LeStmtFoot__H6Text(blocks[above]) : null;   // <-- Only when it sits directly above: further up it is the writer's own divide
        const lines = [];
        if (note && Na__LeStmtFoot__END_NOTE.test(note) && !Na__LeStmtFoot__COPYRIGHT.test(note)) {
            lines.push('End Note: ' + note);
            start = above;
        }
        lines.push('Copyright: ' + copyright);
        return { Start : start, End : last + 1, Body : lines.join('\n') };
    }
    // ------------------------------------------------------------


    // FUNCTION | Write the House Footer Back (switching the section off)
    // ------------------------------------------------------------
    // One house line per field, in the order written, as the template has
    // always set them - so the result takes over again to the same marker.
    // ------------------------------------------------------------
    function Na__LeStmtFoot__Unwrap(body) {
        const out = [];
        for (const field of Na__LeStmtFoot__Fields(body)) {
            if (!field.Lines.length) continue;
            if (out.length) out.push('');
            out.push(...Na__LeStmtFoot__H6Lines(field.Lines.join(' ')));
        }
        return out.join('\n');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Section's Definition, for the Registry
    // ------------------------------------------------------------
    function Na__LeStmtFoot__Definition() {
        return {
            Id            : Na__LeStmtFoot__ID,
            Label         : (config) => Na__LeStmtFoot__Setup(config).Label,
            Fallback      : (config) => Na__LeStmtFoot__Setup(config).FallbackText,
            PlaceAfter    : () => [ 'End' ],
            ContentsTitle : () => '',
            EditHint      : 'Edit the footer\'s lines: End Note and Copyright, one a line',
            NewBody       : Na__LeStmtFoot__NewBody,
            Unit          : 'above',                                            // <-- A divider above it, none under: it is the end of the document
            Movable       : false,
            Adopt         : Na__LeStmtFoot__Adopt,
            Unwrap        : Na__LeStmtFoot__Unwrap,
            Build         : Na__LeStmtFoot__Build
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Standard Section: Document Footer
    // ------------------------------------------------------------
    export {
        Na__LeStmtFoot__ID,
        Na__LeStmtFoot__Build,
        Na__LeStmtFoot__NewBody,
        Na__LeStmtFoot__Adopt,
        Na__LeStmtFoot__Unwrap,
        Na__LeStmtFoot__Definition
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
