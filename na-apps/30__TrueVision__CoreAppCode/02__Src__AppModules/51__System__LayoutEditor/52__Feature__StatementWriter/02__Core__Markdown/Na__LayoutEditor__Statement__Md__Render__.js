// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT MARKDOWN - RENDER
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Md__Render__.js
// NAMESPACE  : Na__LeStmtRnd
// MODULE     : Layout Editor - Statement Writer - Block Rendering
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn tokenised blocks into the HTML the editor, the reader, the published file and the PDF all share
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - ONE RENDERER, FOUR DESTINATIONS. What is typed, what is read, what is
//   pushed to the CDN and what is rasterised into the PDF are the same HTML
//   from the same function. There is no second code path that could drift, so
//   a statement cannot look right on screen and wrong on paper.
// - TWO MODES, ONE DIFFERENCE. Editable mode wraps each top-level block in the
//   attributes the editor needs - the exact source it came from, and the
//   markdown mark to show in the gutter while the caret is in it. Read mode
//   emits the same elements without them. Nothing else changes, which is why
//   the two views are the same document rather than two renderings of it.
// - RAW HTML IS EMITTED AS WRITTEN. In read mode it goes out bare, the way
//   ProjectVision's builder has always written a statement. In editable mode
//   it is wrapped in a frozen shell the caret steps over, so a contenteditable
//   surface can never rewrite the inline styles on a picture or reorder the
//   attributes of a divider. The shell is the editor's, not the document's.
// - SOURCE TRAVELS WITH THE BLOCK. Every editable element carries the lines it
//   was cut from, including the blank lines under it. The serialiser writes
//   those back untouched for any block nobody edited, which is what keeps a
//   45 KB statement from churning when one sentence in it changes.
//
// INTEGRATION:
// - Reads blocks from Na__LayoutEditor__Statement__Md__Tokenise__ and inline
//   runs through Na__LayoutEditor__Statement__Md__Inline__.
// - Called by the editor, the reader and the publisher. Returns a string, so
//   it runs under node in the tests as well as in the browser.
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

    // MODULE IMPORTS | The Tokeniser and the Inline Renderer
    // ------------------------------------------------------------
    import { Na__LeStmtMd__Tokenise } from './Na__LayoutEditor__Statement__Md__Tokenise__.js';
    import { Na__LeStmtInl__ToHtml, Na__LeStmtInl__Escape } from './Na__LayoutEditor__Statement__Md__Inline__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Escape a String for Use Inside a Double-Quoted Attribute
    // ------------------------------------------------------------
    function Na__LeStmtRnd__Attr(value) {
        return Na__LeStmtInl__Escape(value === undefined || value === null ? '' : String(value)).replace(/"/g, '&quot;');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Attributes an Editable Block Carries
    // ------------------------------------------------------------
    // Src is the block's exact source lines. Mark is what the gutter shows
    // while the caret is in the block - "##" for a level two heading - so a
    // writer can see what a block IS without leaving the rendered view.
    // ------------------------------------------------------------
    function Na__LeStmtRnd__Carry(block, mark, editable) {
        if (!editable) return '';
        const src = (block.Lines || []).join('\n');
        return ' data-na-stmt-src="' + Na__LeStmtRnd__Attr(src) + '"'
             + (mark ? ' data-na-stmt-mark="' + Na__LeStmtRnd__Attr(mark) + '"' : '');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Block Renderers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A List, With Its Items Nested by Their Indent
    // ------------------------------------------------------------
    // The items arrive flat, each knowing its own depth. They are folded back
    // into nested lists here rather than in the tokeniser, which has no
    // business knowing what a list looks like.
    // ------------------------------------------------------------
    function Na__LeStmtRnd__List(block) {
        const items = block.Items || [];
        if (!items.length) return '';

        const stack = [];                                                       // <-- The list tags open right now, outermost first
        let   out   = '';
        let   liOpen = false;                                                   // <-- Is an item open at the level the stack is at

        for (const item of items) {
            const want = Math.max(0, item.Depth);

            while (stack.length > want + 1) {                                   // <-- Coming back up: shut the deeper lists
                out += '</li></' + stack.pop() + '>';
                liOpen = true;                                                  // <-- The item those lists sat inside is still open
            }
            if (stack.length === want + 1 && liOpen) { out += '</li>'; liOpen = false; }
            while (stack.length < want + 1) {                                   // <-- Going down: open the lists to reach this depth
                const tag = item.Ordered ? 'ol' : 'ul';
                out += '<' + tag + '>';
                stack.push(tag);
            }

            out   += '<li>' + Na__LeStmtInl__ToHtml(item.Text);
            liOpen = true;
        }

        while (stack.length) out += '</li></' + stack.pop() + '>';
        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Pipe Table
    // ------------------------------------------------------------
    function Na__LeStmtRnd__Table(block) {
        const align = block.Align || [];
        const style = (index) => align[index] ? ' style="text-align:' + align[index] + '"' : '';
        let   out   = '<table><thead><tr>';
        (block.Head || []).forEach((cell, index) => {
            out += '<th' + style(index) + '>' + Na__LeStmtInl__ToHtml(cell) + '</th>';
        });
        out += '</tr></thead><tbody>';
        for (const row of (block.Rows || [])) {
            out += '<tr>';
            row.forEach((cell, index) => { out += '<td' + style(index) + '>' + Na__LeStmtInl__ToHtml(cell) + '</td>'; });
            out += '</tr>';
        }
        return out + '</tbody></table>';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Block
    // ------------------------------------------------------------
    function Na__LeStmtRnd__Block(block, editable) {
        const kind = block.Kind;

        if (kind === 'heading') {
            const level = Math.min(6, Math.max(1, block.Level || 1));
            return '<h' + level + Na__LeStmtRnd__Carry(block, '#'.repeat(level), editable) + '>'
                 + Na__LeStmtInl__ToHtml(block.Text) + '</h' + level + '>';
        }

        if (kind === 'paragraph') {
            return '<p' + Na__LeStmtRnd__Carry(block, '', editable) + '>'
                 + Na__LeStmtInl__ToHtml(block.Text) + '</p>';
        }

        if (kind === 'rule') {
            return '<hr' + Na__LeStmtRnd__Carry(block, '---', editable) + '>';
        }

        if (kind === 'quote') {
            return '<blockquote' + Na__LeStmtRnd__Carry(block, '>', editable) + '><p>'
                 + Na__LeStmtInl__ToHtml(block.Text) + '</p></blockquote>';
        }

        if (kind === 'code') {
            const info = block.Info ? ' data-na-stmt-info="' + Na__LeStmtRnd__Attr(block.Info) + '"' : '';
            return '<pre' + Na__LeStmtRnd__Carry(block, '```', editable) + info + '><code>'
                 + Na__LeStmtInl__Escape((block.Body || []).join('\n')) + '</code></pre>';
        }

        if (kind === 'list') {
            // A LIST IS ONE BLOCK, not one element per item: its numbering and
            // its nesting are properties of the whole thing. The wrapper takes
            // the source so the serialiser can put the list back as it stands,
            // markers and indents included, when nobody has touched it.
            const tag  = block.Ordered ? 'ol' : 'ul';
            const html = Na__LeStmtRnd__List(block);
            if (!editable) return html;
            return html.replace('<' + tag + '>', '<' + tag + Na__LeStmtRnd__Carry(block, block.Ordered ? '1.' : '-', editable) + '>');
        }

        if (kind === 'table') {
            if (!editable) return Na__LeStmtRnd__Table(block);
            return '<div class="na-le-stmt-frozen" data-na-stmt-kind="table" contenteditable="false"'
                 + Na__LeStmtRnd__Carry(block, '|', editable) + '>'
                 + '<div class="na-le-stmt-frozen__body">' + Na__LeStmtRnd__Table(block) + '</div></div>';
        }

        if (kind === 'frontmatter') {
            const body = Na__LeStmtInl__Escape((block.Body || []).join('\n'));
            if (!editable) return '<pre class="na-le-stmt-doc__meta">' + body + '</pre>';
            return '<div class="na-le-stmt-frozen" data-na-stmt-kind="frontmatter" contenteditable="false"'
                 + Na__LeStmtRnd__Carry(block, '---', editable) + '>'
                 + '<div class="na-le-stmt-frozen__body"><pre class="na-le-stmt-doc__meta">' + body + '</pre></div></div>';
        }

        if (kind === 'html') {
            // THE WRITER'S OWN HTML. Read mode sends it out bare, exactly as
            // ProjectVision's statement builder always has. Editable mode puts
            // a frozen shell around it so the caret steps over it and nothing
            // inside is ever normalised.
            if (!editable) return block.Html || '';
            const figure = /^[ \t]*<img\b/i.test(block.Html || '');
            return '<div class="na-le-stmt-frozen' + (figure ? ' na-le-stmt-frozen--figure' : '') + '"'
                 + ' data-na-stmt-kind="html" contenteditable="false"'
                 + Na__LeStmtRnd__Carry(block, '<>', editable) + '>'
                 + '<div class="na-le-stmt-frozen__body">' + (block.Html || '') + '</div></div>';
        }

        if (kind === 'blank') {
            // A RUN OF EMPTY LINES that no block above it absorbed - the top of
            // a file, or the newline it ends with. Invisible, but it is in the
            // file and it comes back in the file.
            if (!editable) return '';
            return '<div class="na-le-stmt-frozen na-le-stmt-frozen--gap" data-na-stmt-kind="blank"'
                 + ' contenteditable="false"' + Na__LeStmtRnd__Carry(block, '', editable) + '></div>';
        }

        return '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Render Tokenised Blocks as HTML
    // ------------------------------------------------------------
    // options: { Editable } - true adds the attributes the editor needs and
    // freezes the raw HTML blocks; false is the document as it is read,
    // published and rasterised.
    // ------------------------------------------------------------
    function Na__LeStmtRnd__Blocks(blocks, options) {
        const editable = !!(options && options.Editable);
        let   out      = '';
        for (const block of (blocks || [])) out += Na__LeStmtRnd__Block(block, editable);
        return out;
    }
    // ------------------------------------------------------------


    // FUNCTION | Render a Whole Statement as HTML
    // ------------------------------------------------------------
    function Na__LeStmtRnd__Markdown(text, options) {
        return Na__LeStmtRnd__Blocks(Na__LeStmtMd__Tokenise(text), options);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Block Rendering API
    // ------------------------------------------------------------
    export {
        Na__LeStmtRnd__Blocks,
        Na__LeStmtRnd__Markdown
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
