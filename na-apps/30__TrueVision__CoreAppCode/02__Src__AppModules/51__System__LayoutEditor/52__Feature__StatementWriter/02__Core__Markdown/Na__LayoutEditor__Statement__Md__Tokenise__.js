// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT MARKDOWN - TOKENISER
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Md__Tokenise__.js
// NAMESPACE  : Na__LeStmtMd
// MODULE     : Layout Editor - Statement Writer - Markdown Tokeniser
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Cut a statement into blocks without losing a single byte of it
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - THE ONE RULE THIS FILE EXISTS TO KEEP: tokenising a statement and joining
//   it back together returns the file it started from, byte for byte. Not
//   "equivalent markdown" - the same file. A statement is a document Adam
//   opens in Typora as often as in this app, and an app that silently
//   reformats 45 KB of someone else's typing on every save is an app that
//   makes its own diffs unreadable. Na__LeStmtMd__Join is the proof, and
//   Na__Test__StatementRoundTrip__ runs it over the real RB05 statement.
// - HOW THAT IS KEPT. Every block carries the exact source lines it was cut
//   from, INCLUDING the blank lines that follow it. Join concatenates those
//   line arrays and nothing else, so spacing a writer put in on purpose - the
//   two blank lines under a section, the run of four before a divider - comes
//   back exactly as it was even after the blocks around it were edited.
// - WHAT A BLOCK IS: front matter, a fenced code block, a raw HTML block, an
//   ATX heading, a horizontal rule, a list, a table, a block quote, or a
//   paragraph. There is no fifth kind of thing in a Noble Architecture
//   statement, and a line this file cannot place becomes a paragraph, which
//   is what markdown itself does with it.
// - RAW HTML IS NEVER LOOKED INSIDE. These statements are full of hand-written
//   HTML: every picture is an <img> with its own zoom, border and shadow, and
//   every section break is a nested <div> block with CSS comments and trailing
//   whitespace inside it. The tokeniser finds where such a block ends - by
//   balancing its opening tag against its closing one, or by taking the one
//   line a void tag occupies - and hands the lines on untouched. Nothing
//   parses them, nothing normalises them, nothing reorders their attributes.
//
// INTEGRATION:
// - Read by Na__LayoutEditor__Statement__Md__Render__ (blocks to HTML) and by
//   the editor, which puts each block's source on the element it renders as.
// - Na__LayoutEditor__Statement__Md__Serialise__ is the inverse and shares
//   nothing with this file but the block shape described above.
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

    // MODULE CONSTANTS | Block Recognition
    // ------------------------------------------------------------
    const Na__LeStmtMd__RE_HEADING   = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;   // <-- ATX heading, with optional closing hashes
    const Na__LeStmtMd__RE_RULE      = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
    const Na__LeStmtMd__RE_FENCE     = /^ {0,3}(`{3,}|~{3,})[ \t]*(.*)$/;
    const Na__LeStmtMd__RE_BULLET    = /^([ \t]*)([-*+])[ \t]+(.*)$/;
    const Na__LeStmtMd__RE_ORDERED   = /^([ \t]*)(\d{1,9})([.)])[ \t]+(.*)$/;
    const Na__LeStmtMd__RE_QUOTE     = /^ {0,3}>[ \t]?(.*)$/;
    const Na__LeStmtMd__RE_TABLE_SEP = /^[ \t]*\|?[ \t]*:?-{1,}:?[ \t]*(\|[ \t]*:?-{1,}:?[ \t]*)*\|?[ \t]*$/;
    const Na__LeStmtMd__RE_HTML_OPEN = /^[ \t]*<([A-Za-z][A-Za-z0-9-]*)/;
    const Na__LeStmtMd__RE_COMMENT   = /^[ \t]*<!--/;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | HTML Elements That Never Close
    // ------------------------------------------------------------
    // A void tag has no closing partner, so balancing would never finish. The
    // block is then however many lines that one tag occupies.
    // ------------------------------------------------------------
    const Na__LeStmtMd__VOID_TAGS = Object.freeze([
        'img', 'br', 'hr', 'input', 'meta', 'link', 'source', 'area',
        'base', 'col', 'embed', 'param', 'track', 'wbr'
    ]);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This Line Blank
    // ------------------------------------------------------------
    function Na__LeStmtMd__IsBlank(line) {
        return typeof line !== 'string' || line.trim() === '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Does a Line Open a Block That Is Not a Paragraph
    // ------------------------------------------------------------
    // Asked while a paragraph is being gathered, so it decides where an
    // unbroken run of text stops. A blank line is handled by the caller.
    // ------------------------------------------------------------
    function Na__LeStmtMd__StartsBlock(line) {
        if (Na__LeStmtMd__RE_HEADING.test(line))   return true;
        if (Na__LeStmtMd__RE_RULE.test(line))      return true;
        if (Na__LeStmtMd__RE_FENCE.test(line))     return true;
        if (Na__LeStmtMd__RE_QUOTE.test(line))     return true;
        if (Na__LeStmtMd__RE_BULLET.test(line))    return true;
        if (Na__LeStmtMd__RE_ORDERED.test(line))   return true;
        if (Na__LeStmtMd__RE_COMMENT.test(line))   return true;
        if (Na__LeStmtMd__RE_HTML_OPEN.test(line)) return true;
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take the Blank Lines That Follow a Block
    // ------------------------------------------------------------
    // The blank lines belong to the block ABOVE them, which is what keeps a
    // writer's spacing through an edit: regenerating a paragraph puts the same
    // number of blank lines back under it without anyone having to remember.
    // ------------------------------------------------------------
    function Na__LeStmtMd__TakeBlanks(lines, index) {
        let at = index;
        while (at < lines.length && Na__LeStmtMd__IsBlank(lines[at])) at++;
        return at;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Count a Tag's Openings and Closings on One Line
    // ------------------------------------------------------------
    function Na__LeStmtMd__TagDelta(line, tag) {
        const opens  = line.match(new RegExp('<' + tag + '(?=[\\s/>])', 'gi'));
        const closes = line.match(new RegExp('</' + tag + '[\\s]*>', 'gi'));
        const selfs  = line.match(new RegExp('<' + tag + '\\b[^<>]*/>', 'gi'));
        return (opens ? opens.length : 0) - (closes ? closes.length : 0) - (selfs ? selfs.length : 0);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Block Scanners
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Where a Raw HTML Block Ends
    // ------------------------------------------------------------
    // Returns the index of the first line AFTER the block. Three shapes:
    //   a comment        ends at the line holding -->
    //   a void tag       ends where that one tag's > is
    //   everything else  ends where its opening tag is balanced by its closing
    // A block that never balances - a stray < in prose, a tag left open - ends
    // at the next blank line, so one bad line can never swallow the document.
    // ------------------------------------------------------------
    function Na__LeStmtMd__ScanHtml(lines, start) {
        const first = lines[start];

        if (Na__LeStmtMd__RE_COMMENT.test(first)) {
            let at = start;
            while (at < lines.length && lines[at].indexOf('-->') === -1) at++;
            return Math.min(at + 1, lines.length);
        }

        const match = first.match(Na__LeStmtMd__RE_HTML_OPEN);
        if (!match) return start + 1;
        const tag = match[1].toLowerCase();

        if (Na__LeStmtMd__VOID_TAGS.indexOf(tag) !== -1) {
            let at    = start;
            let depth = 0;                                                      // <-- Angle-bracket depth of the one tag being read
            while (at < lines.length) {
                for (const ch of lines[at]) {
                    if (ch === '<') depth++;
                    else if (ch === '>') depth--;
                }
                at++;
                if (depth <= 0) break;                                          // <-- The tag has closed its own bracket
            }
            return at;
        }

        let depth = 0;
        let at    = start;
        while (at < lines.length) {
            depth += Na__LeStmtMd__TagDelta(lines[at], tag);
            at++;
            if (depth <= 0) return at;                                          // <-- Balanced: the element is closed
            if (Na__LeStmtMd__IsBlank(lines[at - 1]) && depth < 0) return at;
        }
        return at;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Where a List Ends
    // ------------------------------------------------------------
    // A list runs on through its items, through indented continuation lines,
    // and through a single blank line between items. Two blank lines, or a
    // line at column zero that is not an item, end it.
    // ------------------------------------------------------------
    function Na__LeStmtMd__ScanList(lines, start) {
        let at   = start;
        let last = start;
        while (at < lines.length) {
            const line = lines[at];
            if (Na__LeStmtMd__IsBlank(line)) {
                if (at + 1 < lines.length
                    && !Na__LeStmtMd__IsBlank(lines[at + 1])
                    && (Na__LeStmtMd__RE_BULLET.test(lines[at + 1]) || Na__LeStmtMd__RE_ORDERED.test(lines[at + 1]) || /^[ \t]{2,}\S/.test(lines[at + 1]))) {
                    at += 1;                                                    // <-- One blank line inside a loose list
                    continue;
                }
                break;
            }
            if (Na__LeStmtMd__RE_BULLET.test(line) || Na__LeStmtMd__RE_ORDERED.test(line) || /^[ \t]{2,}\S/.test(line)) {
                at++;
                last = at;
                continue;
            }
            break;
        }
        return Math.max(last, start + 1);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Pipe Table Into Head, Alignment and Rows
    // ------------------------------------------------------------
    function Na__LeStmtMd__Cells(line) {
        let text = line.trim();
        if (text.startsWith('|')) text = text.slice(1);
        if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
        return text.split(/(?<!\\)\|/).map((cell) => cell.trim());
    }

    function Na__LeStmtMd__ScanTable(lines, start) {
        let at = start + 2;                                                     // <-- The head row and its separator are already known
        while (at < lines.length && lines[at].indexOf('|') !== -1 && !Na__LeStmtMd__IsBlank(lines[at])) at++;
        return at;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Tokeniser
// -----------------------------------------------------------------------------

    // FUNCTION | Cut a Statement Into Blocks
    // ------------------------------------------------------------
    // text: the statement as it is on disk. Returns an array of blocks, each
    // { Kind, Lines, ... }. Lines holds the block's own source lines plus the
    // blank lines under it, so Na__LeStmtMd__Join(blocks) === text always.
    // ------------------------------------------------------------
    function Na__LeStmtMd__Tokenise(text) {
        const source = (typeof text === 'string') ? text : '';
        const lines  = source.split('\n');
        const blocks = [];
        let   index  = 0;

        // FRONT MATTER | Only at the very top, only fenced by three dashes
        if (lines.length > 1 && lines[0].trim() === '---') {
            let at = 1;
            while (at < lines.length && lines[at].trim() !== '---') at++;
            if (at < lines.length) {
                const end = Na__LeStmtMd__TakeBlanks(lines, at + 1);
                blocks.push({ Kind : 'frontmatter', Lines : lines.slice(0, end), Body : lines.slice(1, at) });
                index = end;
            }
        }

        // LEADING BLANKS | A file that opens with empty lines keeps them
        if (index < lines.length && Na__LeStmtMd__IsBlank(lines[index])) {
            const end = Na__LeStmtMd__TakeBlanks(lines, index);
            if (end > index) {
                blocks.push({ Kind : 'blank', Lines : lines.slice(index, end) });
                index = end;
            }
        }

        while (index < lines.length) {
            const line = lines[index];

            // A LONE TRAILING EMPTY STRING is the newline the file ends with,
            // not a block. It is kept so the join comes out byte for byte.
            if (index === lines.length - 1 && line === '') {
                blocks.push({ Kind : 'blank', Lines : [ '' ] });
                break;
            }

            if (Na__LeStmtMd__IsBlank(line)) {
                const end = Na__LeStmtMd__TakeBlanks(lines, index);
                blocks.push({ Kind : 'blank', Lines : lines.slice(index, end) });
                index = end;
                continue;
            }

            // FENCED CODE
            const fence = line.match(Na__LeStmtMd__RE_FENCE);
            if (fence) {
                const marker = fence[1];
                let at = index + 1;
                while (at < lines.length && !(lines[at].trim().startsWith(marker))) at++;
                const close = Math.min(at + 1, lines.length);
                const end   = Na__LeStmtMd__TakeBlanks(lines, close);
                blocks.push({
                    Kind  : 'code',
                    Lines : lines.slice(index, end),
                    Info  : fence[2].trim(),
                    Body  : lines.slice(index + 1, at)
                });
                index = end;
                continue;
            }

            // RAW HTML
            if (Na__LeStmtMd__RE_COMMENT.test(line) || Na__LeStmtMd__RE_HTML_OPEN.test(line)) {
                const close = Na__LeStmtMd__ScanHtml(lines, index);
                const end   = Na__LeStmtMd__TakeBlanks(lines, close);
                blocks.push({
                    Kind  : 'html',
                    Lines : lines.slice(index, end),
                    Html  : lines.slice(index, close).join('\n')
                });
                index = end;
                continue;
            }

            // HEADING
            const heading = line.match(Na__LeStmtMd__RE_HEADING);
            if (heading) {
                const end = Na__LeStmtMd__TakeBlanks(lines, index + 1);
                blocks.push({
                    Kind  : 'heading',
                    Lines : lines.slice(index, end),
                    Level : heading[1].length,
                    Text  : heading[2]
                });
                index = end;
                continue;
            }

            // HORIZONTAL RULE
            if (Na__LeStmtMd__RE_RULE.test(line)) {
                const end = Na__LeStmtMd__TakeBlanks(lines, index + 1);
                blocks.push({ Kind : 'rule', Lines : lines.slice(index, end) });
                index = end;
                continue;
            }

            // TABLE | A head row and a separator row under it
            if (line.indexOf('|') !== -1
                && index + 1 < lines.length
                && Na__LeStmtMd__RE_TABLE_SEP.test(lines[index + 1])
                && lines[index + 1].indexOf('-') !== -1) {
                const close = Na__LeStmtMd__ScanTable(lines, index);
                const end   = Na__LeStmtMd__TakeBlanks(lines, close);
                blocks.push({
                    Kind  : 'table',
                    Lines : lines.slice(index, end),
                    Head  : Na__LeStmtMd__Cells(line),
                    Align : Na__LeStmtMd__Cells(lines[index + 1]).map((cell) => {
                        const left  = cell.startsWith(':');
                        const right = cell.endsWith(':');
                        return (left && right) ? 'center' : right ? 'right' : left ? 'left' : '';
                    }),
                    Rows  : lines.slice(index + 2, close).map(Na__LeStmtMd__Cells)
                });
                index = end;
                continue;
            }

            // BLOCK QUOTE
            if (Na__LeStmtMd__RE_QUOTE.test(line)) {
                let at = index;
                while (at < lines.length && !Na__LeStmtMd__IsBlank(lines[at]) && Na__LeStmtMd__RE_QUOTE.test(lines[at])) at++;
                const end = Na__LeStmtMd__TakeBlanks(lines, at);
                blocks.push({
                    Kind  : 'quote',
                    Lines : lines.slice(index, end),
                    Text  : lines.slice(index, at).map((one) => one.replace(Na__LeStmtMd__RE_QUOTE, '$1')).join('\n')
                });
                index = end;
                continue;
            }

            // LIST
            if (Na__LeStmtMd__RE_BULLET.test(line) || Na__LeStmtMd__RE_ORDERED.test(line)) {
                const close = Na__LeStmtMd__ScanList(lines, index);
                const end   = Na__LeStmtMd__TakeBlanks(lines, close);
                blocks.push({
                    Kind    : 'list',
                    Lines   : lines.slice(index, end),
                    Ordered : Na__LeStmtMd__RE_ORDERED.test(line),
                    Items   : Na__LeStmtMd__ReadItems(lines.slice(index, close))
                });
                index = end;
                continue;
            }

            // PARAGRAPH | Everything else, up to a blank line or a new block
            let at = index + 1;
            while (at < lines.length && !Na__LeStmtMd__IsBlank(lines[at]) && !Na__LeStmtMd__StartsBlock(lines[at])) at++;
            const end = Na__LeStmtMd__TakeBlanks(lines, at);
            blocks.push({
                Kind  : 'paragraph',
                Lines : lines.slice(index, end),
                Text  : lines.slice(index, at).join('\n')
            });
            index = end;
        }

        return blocks;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a List's Items and Their Nesting
    // ------------------------------------------------------------
    // Depth is counted in indent steps of two columns, a tab being four, which
    // is what Typora writes and what these statements use.
    // ------------------------------------------------------------
    function Na__LeStmtMd__ReadItems(lines) {
        const items = [];
        for (const line of lines) {
            const bullet  = line.match(Na__LeStmtMd__RE_BULLET);
            const ordered = line.match(Na__LeStmtMd__RE_ORDERED);
            if (bullet || ordered) {
                const indent = (bullet ? bullet[1] : ordered[1]).replace(/\t/g, '    ');
                items.push({
                    Depth   : Math.floor(indent.length / 2),
                    Ordered : !!ordered,
                    Marker  : bullet ? bullet[2] : (ordered[2] + ordered[3]),
                    Text    : bullet ? bullet[3] : ordered[4]
                });
                continue;
            }
            if (items.length && !Na__LeStmtMd__IsBlank(line)) {
                items[items.length - 1].Text += '\n' + line.trim();              // <-- A continuation line belongs to the item above it
            }
        }
        return items;
    }
    // ------------------------------------------------------------


    // FUNCTION | Put the Blocks Back Together
    // ------------------------------------------------------------
    // The inverse of Tokenise, and the proof that it lost nothing.
    // ------------------------------------------------------------
    function Na__LeStmtMd__Join(blocks) {
        const lines = [];
        for (const block of (blocks || [])) {
            for (const line of (block.Lines || [])) lines.push(line);
        }
        return lines.join('\n');
    }
    // ------------------------------------------------------------


    // FUNCTION | How Many Blank Lines Follow a Block
    // ------------------------------------------------------------
    // Asked by the serialiser when it regenerates an edited block, so the
    // spacing under it is put back the way the writer left it.
    // ------------------------------------------------------------
    function Na__LeStmtMd__TrailingBlanks(block) {
        const lines = (block && block.Lines) || [];
        let count = 0;
        for (let at = lines.length - 1; at >= 0; at--) {
            if (!Na__LeStmtMd__IsBlank(lines[at])) break;
            count++;
        }
        return count;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Statement Markdown Tokeniser API
    // ------------------------------------------------------------
    export {
        Na__LeStmtMd__Tokenise,
        Na__LeStmtMd__Join,
        Na__LeStmtMd__TrailingBlanks,
        Na__LeStmtMd__IsBlank
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
