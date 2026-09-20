// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT MARKDOWN - SERIALISE
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Md__Serialise__.js
// NAMESPACE  : Na__LeStmtSer
// MODULE     : Layout Editor - Statement Writer - DOM to Markdown
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Write the edited page back out as the markdown file it came from
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - AN UNTOUCHED BLOCK IS NOT REGENERATED, IT IS COPIED. Every block rendered
//   into the editor carries the source lines it was cut from and a signature
//   of what it looked like when it was rendered. If the signature still
//   matches, the source goes back out byte for byte - no re-escaping, no
//   re-wrapping, no change of quote style. Only blocks whose HTML actually
//   moved are written from the DOM.
//   That is the whole reason a 45 KB statement can be opened, one sentence
//   changed, and saved with a one-line diff.
// - SPACING SURVIVES A REWRITE. A regenerated block puts back exactly as many
//   blank lines as the source had under it, so the rhythm a writer set up -
//   two blank lines before a section, four before a divider - is not quietly
//   normalised to one.
// - FROZEN BLOCKS ARE ALWAYS COPIED, never read back from the DOM. The image
//   widget and the raw box edit the stored source directly, so the source IS
//   the truth for them and the rendered HTML is only a picture of it.
// - WHAT contenteditable LEAVES BEHIND is cleaned up on the way out: a bare
//   <div> a browser inserted for a new line becomes a paragraph, an empty
//   block with nothing but a <br> in it becomes an empty line, and the
//   zero-width markers the gutter draws with never existed in the DOM to
//   begin with because they are pseudo-elements.
//
// INTEGRATION:
// - Inverse of Na__LayoutEditor__Statement__Md__Render__ in editable mode.
// - Inline runs go back through Na__LayoutEditor__Statement__Md__Inline__.
// - Called by the editor whenever the document is read out: the browser draft,
//   the local save, the R2 sync and the publish all take the same string.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 20-Sep-2026)
// - Back-port     : offer to ValeVision3D with the statement tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Inline Serialiser
    // ------------------------------------------------------------
    import { Na__LeStmtInl__FromHtml } from './Na__LayoutEditor__Statement__Md__Inline__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Defaults for a Block That Has No Source Yet
    // ------------------------------------------------------------
    const Na__LeStmtSer__NEW_BLOCK_TRAIL = 1;                                   // <-- One blank line under a block typed just now
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | How Many Blank Lines a Stored Source Ends With
    // ------------------------------------------------------------
    function Na__LeStmtSer__TrailOf(src) {
        if (typeof src !== 'string') return Na__LeStmtSer__NEW_BLOCK_TRAIL;
        const lines = src.split('\n');
        let   count = 0;
        for (let at = lines.length - 1; at >= 0; at--) {
            if (lines[at].trim() !== '') break;
            count++;
        }
        return count;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Has This Block Moved Since It Was Rendered
    // ------------------------------------------------------------
    // No signature at all means the block was typed into existence just now,
    // which counts as moved.
    // ------------------------------------------------------------
    function Na__LeStmtSer__Changed(element) {
        const sig = element.getAttribute('data-na-stmt-sig');
        if (sig === null) return true;
        return element.innerHTML !== sig;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Stamp a Block With What It Looks Like Now
    // ------------------------------------------------------------
    // Called by the editor after a render and after a save, so the next save
    // compares against what was last written rather than what was first built.
    // ------------------------------------------------------------
    function Na__LeStmtSer__Stamp(root) {
        if (!root) return;
        for (const element of Array.from(root.children)) {
            element.setAttribute('data-na-stmt-sig', element.innerHTML);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Table Cell's Alignment Back Out
    // ------------------------------------------------------------
    function Na__LeStmtSer__Align(cell) {
        const align = (cell && cell.style && cell.style.textAlign) || '';
        if (align === 'center') return ':-:';
        if (align === 'right')  return '---:';
        if (align === 'left')   return ':---';
        return '---';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Element to Markdown
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Items of a List, However Deep They Go
    // ------------------------------------------------------------
    function Na__LeStmtSer__Items(list, depth, out, options) {
        const ordered = list.tagName.toLowerCase() === 'ol';
        let   number  = 1;

        for (const item of Array.from(list.children)) {
            if (item.tagName.toLowerCase() !== 'li') continue;

            const nested = Array.from(item.children).filter((child) => /^(ul|ol)$/i.test(child.tagName));
            const clone  = item.cloneNode(true);
            for (const child of Array.from(clone.children)) {
                if (/^(ul|ol)$/i.test(child.tagName)) clone.removeChild(child);  // <-- The nested list is written after this item, not inside its text
            }

            const marker = ordered ? (number++) + '.' : '-';
            const text   = Na__LeStmtInl__FromHtml(clone, options).replace(/\n+$/, '');
            const indent = '  '.repeat(Math.max(0, depth));
            const first  = text.split('\n');

            out.push(indent + marker + '   ' + (first[0] || ''));
            for (const extra of first.slice(1)) out.push(indent + '    ' + extra);

            for (const child of nested) Na__LeStmtSer__Items(child, depth + 1, out, options);
        }
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Top-Level Element as Markdown Content Lines
    // ------------------------------------------------------------
    // Returns the block's own lines, with no blank lines under them: the
    // caller puts the spacing back.
    // ------------------------------------------------------------
    function Na__LeStmtSer__Element(element, options) {
        const tag = element.tagName.toLowerCase();

        const heading = tag.match(/^h([1-6])$/);
        if (heading) {
            return [ '#'.repeat(Number(heading[1])) + ' ' + Na__LeStmtInl__FromHtml(element, options).replace(/\n/g, ' ') ];
        }

        if (tag === 'hr') return [ '---' ];

        if (tag === 'pre') {
            const info = element.getAttribute('data-na-stmt-info') || '';
            const body = (element.textContent || '').replace(/\n$/, '');
            return [ '```' + info ].concat(body.split('\n')).concat([ '```' ]);
        }

        if (tag === 'blockquote') {
            const inner = Array.from(element.children).length
                ? Array.from(element.children).map((child) => Na__LeStmtInl__FromHtml(child, options)).join('\n')
                : Na__LeStmtInl__FromHtml(element, options);
            return inner.split('\n').map((line) => '> ' + line);
        }

        if (tag === 'ul' || tag === 'ol') {
            return Na__LeStmtSer__Items(element, 0, [], options);
        }

        if (tag === 'table') {
            const rows  = Array.from(element.querySelectorAll('tr'));
            if (!rows.length) return [];
            const lines = [];
            const head  = Array.from(rows[0].children);
            lines.push('| ' + head.map((cell) => Na__LeStmtInl__FromHtml(cell, options)).join(' | ') + ' |');
            lines.push('| ' + head.map(Na__LeStmtSer__Align).join(' | ') + ' |');
            for (const row of rows.slice(1)) {
                lines.push('| ' + Array.from(row.children).map((cell) => Na__LeStmtInl__FromHtml(cell, options)).join(' | ') + ' |');
            }
            return lines;
        }

        // A PARAGRAPH, AND ANYTHING contenteditable INVENTED. A browser drops a
        // bare <div> in when a new line is made in some positions; it is the
        // same thing as a paragraph and is written as one.
        const text = Na__LeStmtInl__FromHtml(element, options);
        if (text.trim() === '') return [ '' ];
        return text.split('\n');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Write the Edited Page Back Out as Markdown
    // ------------------------------------------------------------
    // root: the element holding one child per block, which is what the editor
    // renders into. Returns the whole statement as a string.
    // ------------------------------------------------------------
    function Na__LeStmtSer__FromRoot(root) {
        if (!root) return '';
        const lines = [];

        for (const element of Array.from(root.children)) {
            const src = element.getAttribute('data-na-stmt-src');

            // A FROZEN BLOCK IS ITS SOURCE. The raw box and the image widget
            // write to that attribute, so reading the rendered HTML back would
            // be reading a picture of the answer instead of the answer.
            if (element.classList && element.classList.contains('na-le-stmt-frozen')) {
                if (src !== null) { for (const line of src.split('\n')) lines.push(line); }
                continue;
            }

            // AN UNTOUCHED BLOCK IS COPIED, not rebuilt
            if (src !== null && !Na__LeStmtSer__Changed(element)) {
                for (const line of src.split('\n')) lines.push(line);
                continue;
            }

            const content = Na__LeStmtSer__Element(element);
            const trail   = (src !== null) ? Na__LeStmtSer__TrailOf(src) : Na__LeStmtSer__NEW_BLOCK_TRAIL;
            for (const line of content) lines.push(line);
            for (let at = 0; at < trail; at++) lines.push('');
        }

        return lines.join('\n');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement DOM to Markdown API
    // ------------------------------------------------------------
    export {
        Na__LeStmtSer__FromRoot,
        Na__LeStmtSer__Element,                                                 // <-- One block on its own, for the live typing rules
        Na__LeStmtSer__Stamp,
        Na__LeStmtSer__Changed
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
