// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT MARKDOWN - INLINE
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Md__Inline__.js
// NAMESPACE  : Na__LeStmtInl
// MODULE     : Layout Editor - Statement Writer - Inline Markdown
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Turn the run of text inside a block into HTML, and back again
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - WHAT COUNTS AS INLINE HERE: bold, italic, inline code, links, images,
//   Typora's ==highlight==, ~~strikethrough~~, a backslash escape, and raw
//   inline HTML, which is passed through as written.
// - A SINGLE NEWLINE IS A LINE BREAK. This is the rule that makes the app
//   agree with Typora, and it is not the CommonMark default. A site address
//   in these statements is six consecutive lines with no trailing spaces and
//   no <br>:
//       West Beacon Farm
//       Deans Lane
//       Woodhouse Eaves
//   CommonMark joins those into one line of prose. Typora renders them
//   stacked, which is what the writer saw and what the client is owed. So a
//   newline inside a paragraph becomes a <br>, and a <br> becomes a newline
//   on the way back.
// - IT IS A SCANNER, NOT A CHAIN OF REPLACEMENTS. Running one regex after
//   another over a whole string is how a URL inside a code span ends up
//   emphasised and how a ** inside a link label eats the link. This walks the
//   string once, and whatever a code span or a raw tag covers is never looked
//   at again.
// - ESCAPING ON THE WAY BACK IS DELIBERATELY LIGHT. The serialiser only
//   regenerates blocks that were actually edited, so an over-eager escape
//   would still reach the file - it would just reach it more rarely. Only the
//   characters that would change how a line parses are escaped, and an
//   underscore in the middle of a word (a drawing number, a file name) is
//   left alone because it cannot open emphasis there.
//
// INTEGRATION:
// - Used by Na__LayoutEditor__Statement__Md__Render__ on the way out and by
//   Na__LayoutEditor__Statement__Md__Serialise__ on the way back.
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
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Inline Recognition
    // ------------------------------------------------------------
    const Na__LeStmtInl__RE_RAW_TAG = /^<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/;   // <-- One inline tag, no nesting
    const Na__LeStmtInl__RE_ENTITY  = /^&(?:#\d{1,7}|#[xX][0-9A-Fa-f]{1,6}|[A-Za-z][A-Za-z0-9]{1,31});/;
    const Na__LeStmtInl__RE_AUTOURL = /^(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | The Paired Delimiters, Longest First
    // ------------------------------------------------------------
    // Order matters: ** must be tried before *, or every bold run opens as an
    // italic one and closes on its own second asterisk.
    // ------------------------------------------------------------
    const Na__LeStmtInl__PAIRS = Object.freeze([
        { Mark : '***', Open : '<strong><em>', Close : '</em></strong>' },
        { Mark : '**',  Open : '<strong>',     Close : '</strong>'      },
        { Mark : '__',  Open : '<strong>',     Close : '</strong>'      },
        { Mark : '~~',  Open : '<del>',        Close : '</del>'         },
        { Mark : '==',  Open : '<mark>',       Close : '</mark>'        },
        { Mark : '*',   Open : '<em>',         Close : '</em>'          },
        { Mark : '_',   Open : '<em>',         Close : '</em>'          }
    ]);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Escape the Three Characters HTML Cannot Take Raw
    // ------------------------------------------------------------
    function Na__LeStmtInl__Escape(text) {
        return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | May an Underscore Open or Close Emphasis Here
    // ------------------------------------------------------------
    // Only at a word boundary, so RB05_T01_S01 and a file name stay as typed.
    // ------------------------------------------------------------
    function Na__LeStmtInl__WordEdge(character) {
        return character === undefined || /[\s\p{P}]/u.test(character);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a Delimiter's Partner Is, or -1
    // ------------------------------------------------------------
    // The closing mark may not sit against a space on its inner side, which is
    // the rule that stops "5 * 3 and 2 * 4" becoming one italic run.
    // ------------------------------------------------------------
    function Na__LeStmtInl__FindClose(text, from, mark, wordEdged) {
        const single = mark.length === 1;
        let at = from;
        while (at < text.length) {
            if (text[at] === '\\') { at += 2; continue; }
            if (text.startsWith(mark, at)) {
                // A SINGLE MARK THAT IS PART OF A LONGER RUN IS NOT THE CLOSER.
                // Without this, "Some **bold" closes its italic on the second
                // asterisk of its own opening pair and puts an empty <em> in
                // the middle of a sentence somebody is still typing.
                if (single && (text[at + 1] === mark || text[at - 1] === mark)) { at++; continue; }
                const inner = text[at - 1];
                if (inner !== undefined && !/\s/.test(inner)) {
                    if (!wordEdged || Na__LeStmtInl__WordEdge(text[at + mark.length])) return at;
                }
            }
            at++;
        }
        return -1;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Bracketed Run, Honouring Nesting
    // ------------------------------------------------------------
    // Returns { Inner, End } where End is the index after the closing bracket.
    // ------------------------------------------------------------
    function Na__LeStmtInl__ReadBracket(text, start, open, close) {
        let depth = 0;
        let at    = start;
        while (at < text.length) {
            const character = text[at];
            if (character === '\\') { at += 2; continue; }
            if (character === open)  depth++;
            if (character === close) {
                depth--;
                if (depth === 0) return { Inner : text.slice(start + 1, at), End : at + 1 };
            }
            at++;
        }
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Markdown to HTML
// -----------------------------------------------------------------------------

    // FUNCTION | Render One Run of Inline Markdown as HTML
    // ------------------------------------------------------------
    function Na__LeStmtInl__ToHtml(text) {
        const source = (typeof text === 'string') ? text : '';
        let   out    = '';
        let   at     = 0;

        while (at < source.length) {
            const character = source[at];

            // BACKSLASH ESCAPE | The next character is literal, whatever it is
            if (character === '\\' && at + 1 < source.length) {
                out += Na__LeStmtInl__Escape(source[at + 1]);
                at  += 2;
                continue;
            }

            // A SINGLE NEWLINE IS A LINE BREAK - see the note at the head
            if (character === '\n') {
                out += '<br>';
                at++;
                continue;
            }

            // INLINE CODE | Whatever it covers is never looked at again
            if (character === '`') {
                let run = 0;
                while (source[at + run] === '`') run++;
                const fence = '`'.repeat(run);
                const close = source.indexOf(fence, at + run);
                if (close !== -1) {
                    out += '<code>' + Na__LeStmtInl__Escape(source.slice(at + run, close)) + '</code>';
                    at   = close + run;
                    continue;
                }
            }

            // RAW INLINE HTML AND ENTITIES | Passed through as written
            if (character === '<') {
                const tag = source.slice(at).match(Na__LeStmtInl__RE_RAW_TAG);
                if (tag) { out += tag[0]; at += tag[0].length; continue; }
            }
            if (character === '&') {
                const entity = source.slice(at).match(Na__LeStmtInl__RE_ENTITY);
                if (entity) { out += entity[0]; at += entity[0].length; continue; }
            }

            // IMAGE | ![alt](src "title")
            if (character === '!' && source[at + 1] === '[') {
                const label = Na__LeStmtInl__ReadBracket(source, at + 1, '[', ']');
                if (label && source[label.End] === '(') {
                    const target = Na__LeStmtInl__ReadBracket(source, label.End, '(', ')');
                    if (target) {
                        const parts = Na__LeStmtInl__SplitTarget(target.Inner);
                        out += '<img src="' + Na__LeStmtInl__Escape(parts.Href).replace(/"/g, '&quot;') + '"'
                             + ' alt="' + Na__LeStmtInl__Escape(label.Inner).replace(/"/g, '&quot;') + '"'
                             + (parts.Title ? ' title="' + Na__LeStmtInl__Escape(parts.Title).replace(/"/g, '&quot;') + '"' : '')
                             + '>';
                        at = target.End;
                        continue;
                    }
                }
            }

            // LINK | [text](href "title")
            if (character === '[') {
                const label = Na__LeStmtInl__ReadBracket(source, at, '[', ']');
                if (label && source[label.End] === '(') {
                    const target = Na__LeStmtInl__ReadBracket(source, label.End, '(', ')');
                    if (target) {
                        const parts = Na__LeStmtInl__SplitTarget(target.Inner);
                        out += '<a href="' + Na__LeStmtInl__Escape(parts.Href).replace(/"/g, '&quot;') + '"'
                             + (parts.Title ? ' title="' + Na__LeStmtInl__Escape(parts.Title).replace(/"/g, '&quot;') + '"' : '')
                             + '>' + Na__LeStmtInl__ToHtml(label.Inner) + '</a>';
                        at = target.End;
                        continue;
                    }
                }
            }

            // A BARE URL becomes a link, as it does in Typora
            if (character === 'h') {
                const bare = source.slice(at).match(Na__LeStmtInl__RE_AUTOURL);
                if (bare) {
                    const href = Na__LeStmtInl__Escape(bare[1]).replace(/"/g, '&quot;');
                    out += '<a href="' + href + '">' + href + '</a>';
                    at  += bare[1].length;
                    continue;
                }
            }

            // PAIRED EMPHASIS | Longest mark first
            let matched = false;
            for (const pair of Na__LeStmtInl__PAIRS) {
                if (!source.startsWith(pair.Mark, at)) continue;
                // THE SAME RULE ON THE WAY IN: one asterisk of a pair is not an
                // italic opener. "**" is tried first, so reaching "*" with
                // another "*" beside it means this is part of a longer run.
                if (pair.Mark.length === 1 && (source[at + 1] === pair.Mark || source[at - 1] === pair.Mark)) continue;
                const wordEdged = (pair.Mark === '_' || pair.Mark === '__');
                if (wordEdged && !Na__LeStmtInl__WordEdge(source[at - 1])) continue;
                if (/\s/.test(source[at + pair.Mark.length] || ' ') && pair.Mark !== '==') continue;   // <-- No opening mark against a space
                const close = Na__LeStmtInl__FindClose(source, at + pair.Mark.length, pair.Mark, wordEdged);
                if (close === -1) continue;
                out += pair.Open + Na__LeStmtInl__ToHtml(source.slice(at + pair.Mark.length, close)) + pair.Close;
                at   = close + pair.Mark.length;
                matched = true;
                break;
            }
            if (matched) continue;

            out += Na__LeStmtInl__Escape(character);
            at++;
        }

        return out;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Split a Link Target Into Its Href and Its Title
    // ------------------------------------------------------------
    function Na__LeStmtInl__SplitTarget(inner) {
        const text  = String(inner).trim();
        const title = text.match(/\s+["'(](.*)["')]$/);
        if (title) return { Href : text.slice(0, title.index).trim().replace(/^<|>$/g, ''), Title : title[1] };
        return { Href : text.replace(/^<|>$/g, ''), Title : '' };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | HTML to Markdown
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Escape What Would Otherwise Parse as a Mark
    // ------------------------------------------------------------
    function Na__LeStmtInl__Unmark(text) {
        return String(text)
            .replace(/\\/g, '\\\\')
            .replace(/([*`\[\]])/g, '\\$1')
            .replace(/(^|[\s\p{P}])_/gu, '$1\\_')                               // <-- Only where it could open emphasis
            .replace(/~~/g, '\\~\\~')
            .replace(/==/g, '\\=\\=');
    }
    // ------------------------------------------------------------


    // FUNCTION | Read a DOM Node's Children Back as Inline Markdown
    // ------------------------------------------------------------
    // node: any element whose children are inline content. Returns the markdown
    // for what is inside it, with a <br> coming back as the newline it was.
    //
    // options.Raw leaves the text EXACTLY as it stands instead of escaping the
    // characters that would otherwise be read as marks. Saving must escape -
    // an asterisk somebody typed in a sentence is an asterisk, not the start
    // of emphasis. The live typing rules must NOT: they read a block back out
    // precisely in order to re-parse it, and text escaped on the way out can
    // never become the formatting it was typed as. The two callers want
    // opposite things from the same walk, so which one is stated rather than
    // guessed.
    // ------------------------------------------------------------
    function Na__LeStmtInl__FromHtml(node, options) {
        if (!node) return '';
        const raw = !!(options && options.Raw);
        let out = '';

        for (const child of Array.from(node.childNodes)) {

            if (child.nodeType === 3) {                                         // <-- Text
                // A NON-BREAKING SPACE HERE IS THE BROWSER'S, NOT THE WRITER'S.
                // contenteditable substitutes one wherever a plain space would
                // collapse - at the end of a line, or against the edge of a
                // bold run - and it would otherwise go into the file as
                // and come back as a word that will not wrap.
                //
                // IT IS ONLY UNDONE ON THE WAY TO THE FILE. Undoing it during a
                // live reflow would hand the renderer a trailing plain space,
                // which HTML collapses to nothing - so the space a writer had
                // just typed would vanish as they typed the next word. The
                // browser put the hard space there for a reason; it keeps it
                // while the page is being edited and loses it on the way out.
                out += raw ? child.nodeValue : Na__LeStmtInl__Unmark(child.nodeValue.replace(/ /g, ' '));
                continue;
            }
            if (child.nodeType !== 1) continue;                                 // <-- Comments and the rest are dropped

            const tag = child.tagName.toLowerCase();

            if (tag === 'br')                       { out += '\n'; continue; }
            if (tag === 'strong' || tag === 'b')    { out += '**' + Na__LeStmtInl__FromHtml(child, options) + '**'; continue; }
            if (tag === 'em' || tag === 'i')        { out += '*'  + Na__LeStmtInl__FromHtml(child, options) + '*';  continue; }
            if (tag === 'del' || tag === 's' || tag === 'strike') { out += '~~' + Na__LeStmtInl__FromHtml(child, options) + '~~'; continue; }
            if (tag === 'mark')                     { out += '==' + Na__LeStmtInl__FromHtml(child, options) + '=='; continue; }

            if (tag === 'code') {
                const body  = child.textContent || '';
                const runs  = body.match(/`+/g) || [];
                const fence = '`'.repeat(runs.reduce((most, run) => Math.max(most, run.length), 0) + 1);
                out += fence + body + fence;
                continue;
            }

            if (tag === 'a') {
                const href  = child.getAttribute('href') || '';
                const title = child.getAttribute('title');
                const label = Na__LeStmtInl__FromHtml(child, options);
                if (label === href && !title) { out += href; continue; }        // <-- A bare URL goes back bare
                out += '[' + label + '](' + href + (title ? ' "' + title + '"' : '') + ')';
                continue;
            }

            if (tag === 'img') {
                // A PICTURE WRITTEN AS HTML KEEPS ITS HTML. These statements
                // size every image with an inline style, so an <img> that
                // carries one is written back as the tag it was, not flattened
                // into markdown that would throw the sizing away.
                if (child.getAttribute('style') || child.getAttribute('class') || child.getAttribute('width')) {
                    out += child.outerHTML;
                    continue;
                }
                const alt   = child.getAttribute('alt') || '';
                const src   = child.getAttribute('src') || '';
                const title = child.getAttribute('title');
                out += '![' + alt + '](' + src + (title ? ' "' + title + '"' : '') + ')';
                continue;
            }

            // ANYTHING ELSE IS RAW INLINE HTML the writer put there: a span, a
            // sup, a styled tag. It goes back exactly as it stands.
            out += child.outerHTML;
        }

        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Inline Markdown API
    // ------------------------------------------------------------
    export {
        Na__LeStmtInl__ToHtml,
        Na__LeStmtInl__FromHtml,
        Na__LeStmtInl__Escape
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
