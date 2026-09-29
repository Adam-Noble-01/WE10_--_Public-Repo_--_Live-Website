// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT MARKDOWN - FIGURE BLOCKS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Md__Figure__.js
// NAMESPACE  : Na__LeStmtFigMd
// MODULE     : Layout Editor - Statement Writer - A Picture and Its Title as One Block
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Hold a figure's picture and its title in one <figure>, so the title is laid out against the picture
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - WHY A FIGURE IS NOW ONE BLOCK. A title used to be a paragraph of its own
//   under the picture, pushed across the page by a zero-width space and two
//   tabs until it looked as if it started where the picture did. It only did
//   in the editor, where contenteditable keeps whitespace: the reader and the
//   PDF collapse it, so every title sat hard against the left margin under a
//   centred picture. Adam, 29-Sep-2026, on RB05's Fig 3.1: "the titles aren't
//   being inset properly against the images".
//   Now the picture and its title are one <figure>. The figure shrinks to the
//   picture's width (the stylesheet makes it a table and the title its
//   caption), so the title starts at the picture's left edge and wraps at its
//   right one, whatever the picture's size, in every view.
// - THE SHAPE, ALWAYS WRITTEN THE SAME WAY:
//       <figure class="na-figure-block" style="margin-left: auto; margin-right: auto;">
//       <img class="na-figure" src="..." style="zoom: 30%; ..." />
//       <figcaption class="na-figure-title"><strong>Fig 3.1  -</strong>  Site Location</figcaption>
//       </figure>
//   There is no blank line inside it, so Typora and the tokeniser both read
//   it as a single HTML block. The picture line is exactly the markup the
//   picture had before it was wrapped, cropped frame and all.
// - THE FIGURE IS WHAT SITS ACROSS THE PAGE. A picture justifies itself with
//   its own margins; wrapped, those margins have nothing to push against, so
//   the figure carries the same pair. It is a MIRROR, never a second setting:
//   the picture's margins are the answer, and every rewrite here copies them
//   onto the figure again.
// - A TITLE SWITCHED OFF IS KEPT. It gains the hidden attribute rather than
//   being deleted, so switching it back on brings back what was written.
// - STRINGS IN, STRINGS OUT. Like the picture menu, nothing here goes through
//   the DOM, so a figure's markup is never re-serialised by a browser.
//
// INTEGRATION:
// - Used by the picture menu (Na__LayoutEditor__Statement__Editor__Figure__)
//   to read and rewrite the picture inside a figure, and by the cards
//   (Na__LayoutEditor__Statement__Editor__Cards__) for the title switch, the
//   title typed in place and a dropped picture.
// - Imports only the markdown modules beside it, so it runs under node.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 29-Sep-2026)
// - Back-port     : offer to ValeVision3D with the statement tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Tokeniser and the Inline Renderer
    // ------------------------------------------------------------
    import { Na__LeStmtMd__Tokenise, Na__LeStmtMd__Join, Na__LeStmtMd__TrailingBlanks } from './Na__LayoutEditor__Statement__Md__Tokenise__.js';
    import { Na__LeStmtInl__ToHtml, Na__LeStmtInl__Escape } from './Na__LayoutEditor__Statement__Md__Inline__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Figure Markup
    // ------------------------------------------------------------
    const Na__LeStmtFigMd__BLOCK_CLASS = 'na-figure-block';                     // <-- The <figure>: the stylesheet shrinks it to its picture
    const Na__LeStmtFigMd__TITLE_CLASS = 'na-figure-title';                     // <-- The <figcaption>: laid out as the figure's caption
    const Na__LeStmtFigMd__TITLE_TAG   = '<figcaption class="' + Na__LeStmtFigMd__TITLE_CLASS + '">';
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Recognising the Pieces
    // ------------------------------------------------------------
    const Na__LeStmtFigMd__RE_OPEN    = /^\s*<figure\b[^>]*>/i;
    const Na__LeStmtFigMd__RE_CLOSE   = /<\/figure>\s*$/i;
    const Na__LeStmtFigMd__RE_TITLE   = /<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/i;
    const Na__LeStmtFigMd__RE_HIDDEN  = /\shidden(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?(?=[\s>])/i;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | What an Old Title Paragraph Looks Like
    // ------------------------------------------------------------
    // The house caption before this module: an optional zero-width space, the
    // tabs or spaces that were standing in for an indent, then "Fig" in bold
    // (or, after the zero-width space, plain). Only a paragraph like that,
    // directly under a picture, is taken in as its title. A sentence that
    // merely starts "Figure 8.1 sets the scene" is the writer's own text - RB05
    // has five of them - so a plain "Fig" with no marker in front is not one.
    // ------------------------------------------------------------
    const Na__LeStmtFigMd__RE_CAPTION = /^(?:[​﻿\s]*(?:\*\*|__)\s*Fig(?:ure)?\b|[​﻿]\s*Fig(?:ure)?\b)/i;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Split the Trailing Whitespace Off a Block's Source
    // ------------------------------------------------------------
    // A card's source ends with the blank lines under it. Every rewrite here
    // is done on the markup alone and the blank lines put back after, so the
    // spacing under a figure never changes because its markup did.
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__SplitTail(markup) {
        const text = String(markup || '');
        const tail = /\s*$/.exec(text)[0];
        return { Core : text.slice(0, text.length - tail.length), Tail : tail };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Declaration Out of the First Tag's Style
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__FirstDecl(markup, property) {
        const tag   = /<[A-Za-z][A-Za-z0-9-]*\b[^<>]*>/.exec(String(markup || ''));
        const style = tag ? /\sstyle\s*=\s*"([^"]*)"/i.exec(tag[0]) : null;
        if (!style) return '';
        const found = new RegExp('(?:^|;)\\s*' + property + '\\s*:\\s*([^;]+)', 'i').exec(style[1]);
        return found ? found[1].trim().toLowerCase() : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Picture Sits Across the Page
    // ------------------------------------------------------------
    // Read the same way the picture menu reads it: both margins auto is
    // centre, the left one alone is right, anything else is left.
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__Justify(body) {
        const left  = Na__LeStmtFigMd__FirstDecl(body, 'margin-left');
        const right = Na__LeStmtFigMd__FirstDecl(body, 'margin-right');
        if (left === 'auto' && right === 'auto') return 'centre';
        if (left === 'auto')                     return 'right';
        return 'left';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Give the Figure Tag the Picture's Margins
    // ------------------------------------------------------------
    // Only margin-left and margin-right are touched; anything else a writer
    // put on the figure tag stays exactly as it was.
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__MirrorJustify(openTag, body) {
        const where  = Na__LeStmtFigMd__Justify(body);
        const left   = (where === 'left')  ? '0' : 'auto';
        const right  = (where === 'right') ? '0' : 'auto';
        const tag    = String(openTag || '<figure class="' + Na__LeStmtFigMd__BLOCK_CLASS + '">');
        const style  = /\sstyle\s*=\s*"([^"]*)"/i.exec(tag);
        const kept   = (style ? style[1] : '').split(';').map((one) => one.trim())
            .filter((one) => one && !/^margin(?:-left|-right)?\s*:/i.test(one));
        const next   = kept.concat([ 'margin-left: ' + left, 'margin-right: ' + right ]).join('; ') + ';';

        if (style) return tag.replace(style[0], ' style="' + next + '"');
        return tag.replace(/\s*>$/, ' style="' + next + '">');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Is a Tag Wearing the hidden Attribute, and Take It Off
    // ------------------------------------------------------------
    // Asked of the tag with every quoted value blanked to the same length, so
    // a class that happens to contain the word cannot answer yes, and the
    // place found in the blanked copy is the same place in the real one.
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__Unquoted(tag) {
        return String(tag || '').replace(/"[^"]*"|'[^']*'/g, (quoted) => quoted[0] + 'x'.repeat(quoted.length - 2) + quoted[0]);
    }

    function Na__LeStmtFigMd__IsHidden(tag) {
        return Na__LeStmtFigMd__RE_HIDDEN.test(Na__LeStmtFigMd__Unquoted(tag));
    }

    function Na__LeStmtFigMd__Unhide(tag) {
        const found = Na__LeStmtFigMd__RE_HIDDEN.exec(Na__LeStmtFigMd__Unquoted(tag));
        return found ? tag.slice(0, found.index) + tag.slice(found.index + found[0].length) : tag;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Picture's File Name as Words
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__NameOf(markup) {
        const source = /<img\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/i.exec(String(markup || ''));
        let   name   = source ? source[1].split(/[?#]/)[0].split('/').pop() : '';
        try { name = decodeURIComponent(name); } catch (error) { /* <-- A name that is not encoded is already words */ }
        return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading and Writing a Figure
// -----------------------------------------------------------------------------

    // FUNCTION | A Figure Taken Apart
    // ------------------------------------------------------------
    // Returns { Wrapped, Open, Body, TitleTag, Title }. Body is the picture's
    // markup - the <img>, or the cropped frame holding it. Title is the
    // title's inner HTML, or null when there is none. A picture that is not
    // wrapped comes back as { Wrapped: false, Body: markup }, so every caller
    // can work on Body without asking first.
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__Parts(markup) {
        const text  = String(markup || '');
        const open  = Na__LeStmtFigMd__RE_OPEN.exec(text);
        const close = open ? Na__LeStmtFigMd__RE_CLOSE.exec(text) : null;
        if (!open || !close || close.index < open[0].length) {
            return { Wrapped : false, Open : '', Body : text, TitleTag : '', Title : null };
        }

        let inside   = text.slice(open[0].length, close.index);
        let titleTag = '';
        let title    = null;
        const found  = Na__LeStmtFigMd__RE_TITLE.exec(inside);
        if (found) {
            titleTag = /^<figcaption\b[^>]*>/i.exec(found[0])[0];
            title    = found[0].slice(titleTag.length, found[0].length - '</figcaption>'.length);
            inside   = inside.slice(0, found.index) + inside.slice(found.index + found[0].length);
        }

        return {
            Wrapped  : true,
            Open     : open[0].trim(),
            Body     : inside.replace(/^\s+/, '').replace(/\s+$/, ''),
            TitleTag : titleTag,
            Title    : title
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Figure Back Together
    // ------------------------------------------------------------
    // Always one shape, one line per piece, no blank lines inside. The figure
    // tag is given the picture's margins every time it is written.
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__Assemble(parts) {
        const lines = [ Na__LeStmtFigMd__MirrorJustify(parts.Open, parts.Body), parts.Body ];
        if (parts.Title !== null && parts.Title !== undefined) {
            lines.push((parts.TitleTag || Na__LeStmtFigMd__TITLE_TAG) + parts.Title + '</figcaption>');
        }
        lines.push('</figure>');
        return lines.join('\n');
    }
    // ------------------------------------------------------------


    // FUNCTION | Rewrite the Picture Inside a Figure
    // ------------------------------------------------------------
    // fn(body) returns the picture's new markup. On a wrapped figure only the
    // picture is handed over, and the figure is put back round the answer
    // with its margins brought up to date; on a bare picture it is the whole
    // markup. Either way the blank lines under it are kept.
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__MapBody(markup, fn) {
        const split = Na__LeStmtFigMd__SplitTail(markup);
        const parts = Na__LeStmtFigMd__Parts(split.Core);
        const body  = fn(parts.Body);
        if (!parts.Wrapped) return body + split.Tail;
        return Na__LeStmtFigMd__Assemble(Object.assign({}, parts, { Body : body })) + split.Tail;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is This Block a Picture That Could Carry a Title
    // ------------------------------------------------------------
    // A bare <img>, a cropped frame holding one, or a figure already.
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__IsPicture(markup) {
        const parts = Na__LeStmtFigMd__Parts(Na__LeStmtFigMd__SplitTail(markup).Core);
        return /^\s*<img\b/i.test(parts.Body)
            || /^\s*<div\b[^>]*\boverflow\s*:\s*hidden[\s\S]*<img\b/i.test(parts.Body);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Title
// -----------------------------------------------------------------------------

    // FUNCTION | What a Figure's Title Is Doing
    // ------------------------------------------------------------
    // Returns { Wrapped, Has, Shown, Html }: Has is a title in the markup,
    // Shown is one that is not switched off.
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__TitleState(markup) {
        const parts = Na__LeStmtFigMd__Parts(Na__LeStmtFigMd__SplitTail(markup).Core);
        const has   = parts.Wrapped && parts.Title !== null;
        return {
            Wrapped : parts.Wrapped,
            Has     : has,
            Shown   : has && !Na__LeStmtFigMd__IsHidden(parts.TitleTag),
            Html    : has ? parts.Title : ''
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Title a New Figure Starts With
    // ------------------------------------------------------------
    // The house form - "Fig  -" in bold, then the picture's name - ready to be
    // numbered and typed over, as the old caption line always was.
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__DefaultTitle(markup) {
        const name = Na__LeStmtFigMd__NameOf(markup);
        return '<strong>Fig  -</strong>  ' + Na__LeStmtInl__Escape(name || 'Title');
    }
    // ------------------------------------------------------------


    // FUNCTION | Switch a Figure's Title On or Off
    // ------------------------------------------------------------
    // on     true or false
    // html   the title to use if the figure has none yet (an old caption
    //        paragraph being taken in); omitted, the house default is used.
    //
    // Off hides the title and keeps it. On shows a kept title, or wraps a bare
    // picture in a figure with a new one. Anything already in the wanted state
    // comes back unchanged, character for character.
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__SetTitle(markup, on, html) {
        const split = Na__LeStmtFigMd__SplitTail(markup);
        const parts = Na__LeStmtFigMd__Parts(split.Core);
        const text  = String(markup || '');

        if (parts.Wrapped && parts.Title !== null) {
            const hidden = Na__LeStmtFigMd__IsHidden(parts.TitleTag);
            if (on === !hidden) return text;
            return text.replace(/<figcaption\b[^>]*>/i, (tag) => on
                ? Na__LeStmtFigMd__Unhide(tag)
                : tag.replace(/\s*>$/, ' hidden>'));
        }

        if (!on) return text;

        const title = (typeof html === 'string') ? html : Na__LeStmtFigMd__DefaultTitle(parts.Body);
        return Na__LeStmtFigMd__Assemble(Object.assign({}, parts, { TitleTag : '', Title : title })) + split.Tail;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put New Words in a Figure's Title
    // ------------------------------------------------------------
    // html is the title's inner HTML. Only what lies between the figcaption's
    // own tags changes; a figure with no title comes back as it was.
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__WriteTitle(markup, html) {
        return String(markup || '').replace(/(<figcaption\b[^>]*>)[\s\S]*?(<\/figcaption>)/i,
            (whole, open, close) => open + String(html || '') + close);
    }
    // ------------------------------------------------------------


    // FUNCTION | A Picture Wrapped in a Figure, With a Title
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__Wrap(body, html) {
        return Na__LeStmtFigMd__SetTitle(body, true, html);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Taking In the Old Caption Paragraphs
// -----------------------------------------------------------------------------

    // FUNCTION | Is This Paragraph an Old-Style Figure Title
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__IsCaption(text) {
        return Na__LeStmtFigMd__RE_CAPTION.test(String(text || ''));
    }
    // ------------------------------------------------------------


    // FUNCTION | An Old Caption Paragraph's Markdown as a Title's HTML
    // ------------------------------------------------------------
    // The indent that stood in for alignment - the zero-width space and the
    // tabs - goes, a wrapped line becomes a space, and the rest is rendered
    // exactly as the paragraph was, bold and all.
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__CaptionToHtml(text) {
        const words = String(text || '').replace(/\s*\n\s*/g, ' ').replace(/^[​﻿\s]+/, '').replace(/[\s​﻿]+$/, '');
        return Na__LeStmtInl__ToHtml(words);
    }
    // ------------------------------------------------------------


    // FUNCTION | Take Every Old Caption Into the Figure Above It
    // ------------------------------------------------------------
    // For a statement written before figures had titles of their own: each
    // picture followed directly by an old-style caption paragraph becomes one
    // figure holding both. The blank lines under the caption are kept under
    // the figure, so the spacing of the document does not move; nothing else
    // in the file is touched. Returns { Markdown, Count }.
    // ------------------------------------------------------------
    function Na__LeStmtFigMd__AdoptCaptions(markdown) {
        const blocks = Na__LeStmtMd__Tokenise(String(markdown || ''));
        const out    = [];
        let   count  = 0;

        for (let at = 0; at < blocks.length; at++) {
            const block = blocks[at];
            const next  = blocks[at + 1];
            const taken = block.Kind === 'html'
                && next && next.Kind === 'paragraph'
                && Na__LeStmtFigMd__IsPicture(block.Html)
                && !Na__LeStmtFigMd__TitleState(block.Html).Has
                && Na__LeStmtFigMd__IsCaption(next.Text);

            if (!taken) { out.push(block); continue; }

            const html   = Na__LeStmtFigMd__SetTitle(block.Html, true, Na__LeStmtFigMd__CaptionToHtml(next.Text));
            const blanks = Na__LeStmtMd__TrailingBlanks(next);
            const lines  = html.split('\n').concat(next.Lines.slice(next.Lines.length - blanks));
            out.push({ Kind : 'html', Lines : lines, Html : html });
            count++;
            at++;                                                               // <-- The caption paragraph is inside the figure now
        }

        return { Markdown : Na__LeStmtMd__Join(out), Count : count };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Figure Block API
    // ------------------------------------------------------------
    export {
        Na__LeStmtFigMd__BLOCK_CLASS,
        Na__LeStmtFigMd__TITLE_CLASS,
        Na__LeStmtFigMd__Parts,
        Na__LeStmtFigMd__Assemble,
        Na__LeStmtFigMd__MapBody,
        Na__LeStmtFigMd__IsPicture,
        Na__LeStmtFigMd__TitleState,
        Na__LeStmtFigMd__DefaultTitle,
        Na__LeStmtFigMd__SetTitle,
        Na__LeStmtFigMd__WriteTitle,
        Na__LeStmtFigMd__Wrap,
        Na__LeStmtFigMd__IsCaption,
        Na__LeStmtFigMd__CaptionToHtml,
        Na__LeStmtFigMd__AdoptCaptions
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
