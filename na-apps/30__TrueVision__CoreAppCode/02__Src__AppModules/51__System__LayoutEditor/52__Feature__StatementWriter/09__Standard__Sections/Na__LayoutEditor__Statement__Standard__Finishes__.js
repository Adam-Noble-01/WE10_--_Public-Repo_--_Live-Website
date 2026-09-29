// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT STANDARD SECTION - FINISHES COMPARISON
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Standard__Finishes__.js
// NAMESPACE  : Na__LeStmtFin
// MODULE     : Layout Editor - Statement Writer - Standard Section: Finishes Comparison
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw a statement's existing-versus-proposed materials table as an element-by-element comparison a reader can follow
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - WHY. Adam, 29-Sep-2026, over RB05's "6.10 Material Specification
//   Comparison": "a table like this doesn't really cut it ... this is actually
//   really hard to read and understand. Don't use a table like this; it's not
//   fit for it." Three columns on an A4 page leave the proposed words about
//   70 mm, so every proposal wraps four to six lines; half the existing cells
//   say "Not applicable"; and each [TO CONFIRM] note is buried mid-sentence.
// - WHAT IT DRAWS INSTEAD. One entry per building element: the element's name
//   down a column of its own (the one thing the table did well - it scans),
//   and beside it the existing finish over the proposed one, each on a line
//   of its own at almost the full width of the page, labelled EXISTING and
//   PROPOSED. On top, a quiet strip carries the table's own column headings
//   ("Building Element  -  Existing Dwelling -> Proposed Replacement").
//     - An element with nothing existing ("Not applicable", "None") is tagged
//       NEW and loses its empty existing line.
//     - A proposal that matches the existing ("to match existing", or the
//       same words) is tagged MATCHES EXISTING - the argument a householder
//       statement most often makes, now visible at a glance.
//     - Every [TO CONFIRM: ...] is taken out of the sentence and set under it
//       as a labelled note, so the proposal reads clean and what is still
//       open is plain to see.
//     - A row whose only filled cell is the first is a GROUP heading (Walls,
//       Roofs, Windows And Doors ...), which breaks a long list into parts.
//     - A column headed Status (or Change) tags each element in the writer's
//       own words instead ("Retained", "Replaced"); any other extra column is
//       one more labelled line under the proposal.
// - THE MARKER HOLDS THE WRITER'S OWN TABLE. The words stay a markdown table,
//   the one the design and access statement skill already writes, one row a
//   line inside the marker:
//       <div class="na-le-stmt-std-marker" data-na-standard-section="FinishesComparison">
//       | Building Element | Existing Dwelling | Proposed Replacement |
//       | :--- | :--- | :--- |
//       | **External Walling** | White painted render ... | Coursed squared natural stone walling ... [TO CONFIRM: stone type and source] |
//       </div>
//   Edit on the card opens exactly these lines. Nothing is ever computed into
//   them: the tags, the notes and the groups are drawn from the words each
//   time, so the file stays the writer's.
// - SWITCHING IT ON TAKES OVER THE TABLE ALREADY THERE. The first pipe table
//   whose headings read as a comparison (an element column, an existing column
//   and a proposed column) becomes the marker, in place, under the writer's
//   own "#### N.N |" heading - so the Contents and the numbering do not
//   change. The column-width <span>s in its heading row go (they only ever
//   sized a table) and its rows are kept exactly as typed. Switching it off
//   writes the house table back, spans and all: RB05's comes back byte for
//   byte. With no table to take over it lands under the block the caret is in
//   ('Caret'), starting from the configured rows.
// - IT SITS INSIDE A SECTION, not between dividers (Unit 'none'), so it does
//   not move with the section Move handle, which only ever drops a section
//   under a major divider.
//
// INTEGRATION:
// - Registered with Na__LayoutEditor__Statement__Standard__Registry__, which
//   calls Adopt when it is switched on, Unwrap when it is switched off and
//   Build to draw it. Pure: strings in, strings out; runs under node.
// - Styled by .na-le-stmt-std-fin in the statement document stylesheet.
// - Words and rules in StatementStandard__FinishesComparison__Config.
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
// - Initial implementation (TrueVision3D v2.168.0).
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Statement's Own Inline Markdown and Block Spacing
    // ------------------------------------------------------------
    import { Na__LeStmtInl__ToHtml } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Inline__.js';
    import { Na__LeStmtMd__TrailingBlanks } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Tokenise__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Section's Id and Config Block
    // ------------------------------------------------------------
    const Na__LeStmtFin__ID     = 'FinishesComparison';
    const Na__LeStmtFin__BLOCK  = 'StatementStandard__FinishesComparison__Config';
    const Na__LeStmtFin__PREFIX = 'FinishesComparison__';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Built-In Defaults (mirror the config file)
    // ------------------------------------------------------------
    const Na__LeStmtFin__FALLBACKS = {
        Label         : 'Finishes Comparison',
        ExistingLabel : 'Existing',
        ProposedLabel : 'Proposed',
        ConfirmLabel  : 'To confirm',
        NewTagText    : 'New',
        MatchTagText  : 'Matches existing',
        AutoTags      : true,
        NoneWords     : [ 'none', 'not applicable', 'n/a', 'na', 'nil', 'not present', 'no existing', '-', '—', '–' ],
        MatchPattern  : '\\b(match|matches|matching|matched)\\b[^.;]*?\\bexisting\\b',
        NewHeadings   : [ 'Building Element', 'Existing Materials', 'Proposed Materials' ],
        NewRows       : [
            [ '**External Walls**',      '[TO CONFIRM: existing walls]',           '[TO CONFIRM: proposed walls]' ],
            [ '**Roof Covering**',       '[TO CONFIRM: existing roof covering]',   '[TO CONFIRM: proposed roof covering]' ],
            [ '**Windows**',             '[TO CONFIRM: existing windows]',         '[TO CONFIRM: proposed windows]' ],
            [ '**External Doors**',      '[TO CONFIRM: existing doors]',           '[TO CONFIRM: proposed doors]' ],
            [ '**Rainwater Goods**',     '[TO CONFIRM: existing rainwater goods]', '[TO CONFIRM: proposed rainwater goods]' ]
        ],
        HouseWidthsMm : [ 30, 60 ],
        EmptyText     : 'The comparison has no rows yet. Press Edit and add one table row per building element: | **Element** | existing | proposed |.',
        PlaceAfter    : [ 'Caret' ],
        FallbackText  : 'Standard Section: Finishes Comparison.'
    };
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Lines a Body Is Made Of, and What a Heading Means
    // ------------------------------------------------------------
    const Na__LeStmtFin__ROW       = /^[ \t]*\|/;
    const Na__LeStmtFin__SEPARATOR = /^[ \t]*\|?[ \t]*:?-{1,}:?[ \t]*(\|[ \t]*:?-{1,}:?[ \t]*)*\|?[ \t]*$/;   // <-- The tokeniser's own
    const Na__LeStmtFin__CONFIRM   = /\[\s*TO\s+(?:BE\s+)?CONFIRM(?:ED)?\b\s*:?\s*([^\]]*)\]/gi;
    const Na__LeStmtFin__NEGATED   = /\b(?:not|no|never|nor)\s+(?:\S+\s+){0,2}match/i;
    const Na__LeStmtFin__HEAD_ELEMENT  = /\b(element|elements|item|items|material|materials|finish|finishes|component|components)\b/i;
    const Na__LeStmtFin__HEAD_EXISTING = /\b(existing|current|before)\b/i;
    const Na__LeStmtFin__HEAD_PROPOSED = /\b(proposed|proposal|replacement|new|after)\b/i;
    const Na__LeStmtFin__HEAD_STATUS   = /^\s*(status|change|changes|approach|treatment)\s*$/i;
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The House Table, for Writing One Back
    // ------------------------------------------------------------
    // Every cell padded to sixty characters, a separator of a colon and
    // fifty-nine dashes, and the first two headings sized by an inline-block
    // span - the table the design and access statement skill writes, and the
    // one RB05 carried.
    // ------------------------------------------------------------
    const Na__LeStmtFin__HOUSE_CELL = 60;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Escape Text for HTML
    // ------------------------------------------------------------
    function Na__LeStmtFin__Escape(text) {
        return String(text === undefined || text === null ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Setup, the Config File Over the Built-In Defaults
    // ------------------------------------------------------------
    // A value of the wrong type in the file is ignored for that key only.
    // ------------------------------------------------------------
    function Na__LeStmtFin__Setup(config) {
        const block = (config && typeof config === 'object' && config[Na__LeStmtFin__BLOCK] && typeof config[Na__LeStmtFin__BLOCK] === 'object')
            ? config[Na__LeStmtFin__BLOCK] : {};
        const setup = {};
        for (const key of Object.keys(Na__LeStmtFin__FALLBACKS)) {
            const fallback = Na__LeStmtFin__FALLBACKS[key];
            const value    = block[Na__LeStmtFin__PREFIX + key];
            if (Array.isArray(fallback))            setup[key] = Array.isArray(value) && value.length ? value : fallback;
            else if (typeof fallback === 'boolean') setup[key] = typeof value === 'boolean' ? value : fallback;
            else                                    setup[key] = typeof value === 'string' && value.trim() !== '' ? value : fallback;
        }
        setup.NoneSet = new Set(setup.NoneWords.map(Na__LeStmtFin__Loose));
        try       { setup.Match = new RegExp(setup.MatchPattern, 'i'); }
        catch (e) { setup.Match = new RegExp(Na__LeStmtFin__FALLBACKS.MatchPattern, 'i'); }   // <-- A broken pattern in the file never stops the drawing
        return setup;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Cells of One Table Line
    // ------------------------------------------------------------
    // The tokeniser's rule: the outer pipes go, an escaped pipe stays inside
    // its cell, every cell is trimmed.
    // ------------------------------------------------------------
    function Na__LeStmtFin__Cells(line) {
        let text = String(line || '').trim();
        if (text.startsWith('|')) text = text.slice(1);
        if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
        return text.split(/(?<!\\)\|/).map((cell) => cell.trim());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Cell's Words Without Their Markup
    // ------------------------------------------------------------
    // What a heading or a cell SAYS: tags, bold and code marks and escaped
    // pipes gone, spaces folded. An underscore inside a word is left alone.
    // ------------------------------------------------------------
    function Na__LeStmtFin__Plain(text) {
        return String(text === undefined || text === null ? '' : text)
            .replace(/<[^>]*>/g, '')
            .replace(/\*\*|__|`|~~|==/g, '')
            .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, '$1$2')
            .replace(/\\\|/g, '|')
            .replace(/\s+/g, ' ')
            .trim();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Words Folded for Comparing ("Not applicable." = "not applicable")
    // ------------------------------------------------------------
    function Na__LeStmtFin__Loose(text) {
        return Na__LeStmtFin__Plain(text).toLowerCase().replace(/[.\s]+$/, '').trim();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Cell Without One Bold Pair Round All of It
    // ------------------------------------------------------------
    // The house table sets its first column "**External Walling**"; the name
    // column is drawn in its own weight, so the marks would only double it.
    // ------------------------------------------------------------
    function Na__LeStmtFin__Unbold(text) {
        const trimmed = String(text || '').trim();
        const bold    = /^(\*\*|__)([\s\S]+)\1$/.exec(trimmed);
        return bold && bold[2].indexOf(bold[1]) === -1 ? bold[2].trim() : trimmed;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Take the [TO CONFIRM] Notes Out of a Cell
    // ------------------------------------------------------------
    // Returns { Text, Confirm: [ ... ] }: the words with the notes lifted out,
    // and each note's own words (an empty "[TO CONFIRM]" gives '').
    // ------------------------------------------------------------
    function Na__LeStmtFin__Lift(cell) {
        const confirm = [];
        const text    = String(cell === undefined || cell === null ? '' : cell)
            .replace(Na__LeStmtFin__CONFIRM, (whole, words) => { confirm.push(String(words || '').trim()); return ' '; })
            .replace(/[ \t]+([.,;:])/g, '$1')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();
        return { Text : text, Confirm : confirm };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Table Line From Its Cells
    // ------------------------------------------------------------
    function Na__LeStmtFin__RowLine(cells) {
        return '| ' + cells.join(' | ') + ' |';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Separator Cell's Alignment ('left', 'right', 'center' or '')
    // ------------------------------------------------------------
    function Na__LeStmtFin__AlignOf(cell) {
        const text  = String(cell || '').trim();
        const left  = text.startsWith(':');
        const right = text.endsWith(':');
        return (left && right) ? 'center' : right ? 'right' : left ? 'left' : '';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Separator Cell, Short (in the marker) or House Width (in a table)
    // ------------------------------------------------------------
    function Na__LeStmtFin__SeparatorCell(align, width) {
        const dashes = Math.max(3, width - (align === 'center' ? 2 : (align === 'left' || align === 'right') ? 1 : 0));
        const run    = '-'.repeat(dashes);
        return align === 'center' ? ':' + run + ':' : align === 'right' ? run + ':' : align === 'left' ? ':' + run : run;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading a Body
// -----------------------------------------------------------------------------

    // FUNCTION | Cut a Body Into Its Words and Its Table
    // ------------------------------------------------------------
    // The table is the first run of "|" lines. A line above it is an opening
    // sentence, a line under it a note. Returns { Lines, Intro, Notes, Head,
    // Align, Rows, RowLines, Start, End } - Head and Align are null when the
    // run has no separator under its first line (then every line is a row).
    // ------------------------------------------------------------
    function Na__LeStmtFin__Parse(body) {
        const lines = String(body === undefined || body === null ? '' : body).split(/\r?\n/);   // <-- A body pasted with Windows line ends still reads its heading row
        let start = lines.findIndex((line) => Na__LeStmtFin__ROW.test(line));
        let end   = start;
        if (start !== -1) { while (end < lines.length && Na__LeStmtFin__ROW.test(lines[end])) end++; }
        else              { start = end = lines.length; }

        const run       = lines.slice(start, end);
        const separated = run.length > 1 && Na__LeStmtFin__SEPARATOR.test(run[1]) && run[1].indexOf('-') !== -1;
        const words     = (list) => list.map((line) => line.trim()).filter((line) => line !== '');
        return {
            Lines    : lines,
            Intro    : words(lines.slice(0, start)),
            Notes    : words(lines.slice(end)),
            Head     : separated ? Na__LeStmtFin__Cells(run[0]) : null,
            Align    : separated ? Na__LeStmtFin__Cells(run[1]).map(Na__LeStmtFin__AlignOf) : null,
            Rows     : run.slice(separated ? 2 : 0).map(Na__LeStmtFin__Cells),
            RowLines : run.slice(separated ? 2 : 0),
            Start    : start,
            End      : end
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Column Is Which, From the Headings
    // ------------------------------------------------------------
    // headings: plain words. The first column is always the element. The
    // existing and proposed columns are found by their words, else taken as
    // the second and third; a Status column tags; any other is an extra line.
    // Returns { Existing, Proposed, Status, Extras: [index...], Named }, -1
    // for a role no column plays. Named is true when BOTH comparison columns
    // were found by their words - what makes a table a comparison.
    // ------------------------------------------------------------
    function Na__LeStmtFin__Roles(headings) {
        const heads    = Array.isArray(headings) ? headings : [];
        const status   = heads.findIndex((text, index) => index > 0 && Na__LeStmtFin__HEAD_STATUS.test(text));
        let   existing = heads.findIndex((text, index) => index > 0 && index !== status && Na__LeStmtFin__HEAD_EXISTING.test(text));
        let   proposed = heads.findIndex((text, index) => index > 0 && index !== status && index !== existing && Na__LeStmtFin__HEAD_PROPOSED.test(text));
        const named    = existing !== -1 && proposed !== -1;

        // NOT NAMED BY THEIR WORDS: taken by position among the columns left
        const open = heads.map((text, index) => index).filter((index) => index > 0 && index !== status);
        if (!named && open.length >= 2) {
            if (existing === -1) existing = open.find((index) => index !== proposed);
            if (proposed === -1) proposed = open.find((index) => index !== existing);
        } else if (!named && existing === -1 && proposed === -1 && open.length === 1) {
            proposed = open[0];                                                 // <-- Two columns: an element and what is proposed for it
        }
        const extras = open.filter((index) => index !== existing && index !== proposed);
        return { Existing : existing, Proposed : proposed, Status : status, Extras : extras, Named : named };
    }
    // ------------------------------------------------------------


    // FUNCTION | Whether a Pipe Table's Heading Row Reads as a Comparison
    // ------------------------------------------------------------
    // An element column first ("Building Element", "Material", "Finish"),
    // and an existing and a proposed column found by their words. A floor
    // area table ("Room | Existing | Proposed") is not one.
    // ------------------------------------------------------------
    function Na__LeStmtFin__IsComparison(headCells) {
        const heads = (Array.isArray(headCells) ? headCells : []).map(Na__LeStmtFin__Plain);
        return heads.length >= 3 && Na__LeStmtFin__HEAD_ELEMENT.test(heads[0]) && Na__LeStmtFin__Roles(heads).Named;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Comparison, Read Into Groups and Elements
    // ------------------------------------------------------------
    // Returns { Setup, Headings, Roles, Items, Intro, Notes }. Items, in the
    // order written:
    //   { Kind : 'group', Text }
    //   { Kind : 'item', Name, Existing, Proposed, Extras, Tag, HideExisting }
    // where Existing / Proposed are { Text, Confirm } (Existing null when no
    // column plays it), Extras [{ Label, Text, Confirm }] and Tag null or
    // { Kind : 'new' | 'match' | 'retained' | 'other', Text }.
    // ------------------------------------------------------------
    function Na__LeStmtFin__Model(body, config) {
        const setup    = Na__LeStmtFin__Setup(config);
        const parsed   = Na__LeStmtFin__Parse(body);
        const width    = Math.max(parsed.Head ? parsed.Head.length : 0, ...parsed.Rows.map((cells) => cells.length), 1);
        const headings = (parsed.Head || setup.NewHeadings).map(Na__LeStmtFin__Plain);
        while (headings.length < width) headings.push('');
        const roles    = Na__LeStmtFin__Roles(headings);
        const cell     = (cells, index) => (index >= 0 && index < cells.length ? cells[index] : '');
        const isNone   = (text) => setup.NoneSet.has(Na__LeStmtFin__Loose(text)) || Na__LeStmtFin__Loose(text) === '';

        const items = [];
        for (const cells of parsed.Rows) {
            const rest = cells.slice(1).map(Na__LeStmtFin__Plain);
            if (Na__LeStmtFin__Plain(cells[0]) === '' && rest.every((text) => text === '')) continue;   // <-- An empty row draws nothing
            if (rest.every((text) => text === '')) { items.push({ Kind : 'group', Text : Na__LeStmtFin__Unbold(cells[0]) }); continue; }

            const existing = roles.Existing === -1 ? null : Na__LeStmtFin__Lift(cell(cells, roles.Existing));
            const proposed = Na__LeStmtFin__Lift(cell(cells, roles.Proposed));
            const extras   = roles.Extras.map((index) => Object.assign({ Label : headings[index] }, Na__LeStmtFin__Lift(cell(cells, index))))
                                         .filter((extra) => extra.Text !== '' || extra.Confirm.length);
            const nothing  = !!existing && existing.Confirm.length === 0 && isNone(existing.Text);

            // THE TAG: the writer's own Status words, else what the words show
            let tag = null;
            const status = roles.Status === -1 ? '' : Na__LeStmtFin__Plain(cell(cells, roles.Status));
            if (status) {
                const loose = status.toLowerCase();
                tag = { Text : status, Kind : /\bnew\b/.test(loose) ? 'new' : /\bmatch/.test(loose) ? 'match'
                                             : /\b(retain|retained|unchanged|kept|as existing)\b/.test(loose) ? 'retained' : 'other' };
            } else if (setup.AutoTags && existing) {
                const was = Na__LeStmtFin__Loose(existing.Text);
                const now = Na__LeStmtFin__Loose(proposed.Text);
                if (nothing) {
                    tag = { Kind : 'new', Text : setup.NewTagText };
                } else if (now !== '' && ((setup.Match.test(Na__LeStmtFin__Plain(proposed.Text)) && !Na__LeStmtFin__NEGATED.test(Na__LeStmtFin__Plain(proposed.Text))) || now === was)) {
                    tag = { Kind : 'match', Text : setup.MatchTagText };
                }
            }

            items.push({
                Kind         : 'item',
                Name         : Na__LeStmtFin__Unbold(cells[0]),
                Existing     : existing,
                Proposed     : proposed,
                Extras       : extras,
                Tag          : tag,
                HideExisting : nothing                                          // <-- "Not applicable" is said by the NEW tag, not by a line of its own
            });
        }
        return { Setup : setup, Headings : headings, Roles : roles, Items : items, Intro : parsed.Intro, Notes : parsed.Notes };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Labelled Line: Its Words, Then Any Notes Still Open
    // ------------------------------------------------------------
    function Na__LeStmtFin__Line(kind, label, part, setup, C) {
        const words   = part.Text !== '' ? '<span class="' + C + '__words">' + Na__LeStmtInl__ToHtml(part.Text) + '</span>' : '';
        const confirm = part.Confirm.map((note) =>
            '<span class="' + C + '__confirm">' +
                '<span class="' + C + '__confirm-label">' + Na__LeStmtFin__Escape(setup.ConfirmLabel) + '</span>' +
                (note !== '' ? '<span class="' + C + '__confirm-words">' + Na__LeStmtInl__ToHtml(note) + '</span>' : '') +
            '</span>').join('');
        return '<div class="' + C + '__line ' + C + '__line--' + kind + '">' +
                   '<span class="' + C + '__label">' + Na__LeStmtFin__Escape(label) + '</span>' +
                   '<div class="' + C + '__text">' + (words || confirm ? words + confirm : '<span class="' + C + '__words">&mdash;</span>') + '</div>' +
               '</div>';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Section's HTML
    // ------------------------------------------------------------
    // overrides.body is the table inside the marker. A comparison with no
    // rows draws a line saying how to fill it, which only the editor shows:
    // the reader, the PDF and the published page hide it.
    // ------------------------------------------------------------
    function Na__LeStmtFin__Build(config, overrides) {
        const model = Na__LeStmtFin__Model(overrides && overrides.body, config);
        const setup = model.Setup;
        const roles = model.Roles;
        const C     = 'na-le-stmt-std-fin';
        const heads = model.Headings;

        let html = '';
        for (const line of model.Intro) html += '<p class="' + C + '__intro">' + Na__LeStmtInl__ToHtml(line) + '</p>';

        // THE STRIP: the table's own headings over the two columns
        const detail = [ roles.Existing, roles.Proposed ].filter((index) => index !== -1).map((index) => Na__LeStmtFin__Escape(heads[index] || ''))
                                                         .filter((text) => text !== '');
        html += '<div class="' + C + '__strip">' +
                    '<span class="' + C + '__strip-element">' + Na__LeStmtFin__Escape(heads[0] || '') + '</span>' +
                    '<span class="' + C + '__strip-detail">' + detail.join('<span class="' + C + '__strip-arrow">&rarr;</span>') + '</span>' +
                '</div>';

        let count = 0;
        for (const item of model.Items) {
            if (item.Kind === 'group') {
                html += '<div class="' + C + '__group">' + Na__LeStmtInl__ToHtml(item.Text) + '</div>';
                continue;
            }
            count++;
            let lines = '';
            if (item.Existing && !item.HideExisting) lines += Na__LeStmtFin__Line('existing', setup.ExistingLabel, item.Existing, setup, C);
            lines += Na__LeStmtFin__Line('proposed', setup.ProposedLabel, item.Proposed, setup, C);
            for (const extra of item.Extras) lines += Na__LeStmtFin__Line('extra', extra.Label, extra, setup, C);

            html += '<div class="' + C + '__item' + (item.Tag ? ' ' + C + '__item--' + item.Tag.Kind : '') + '">' +
                        '<div class="' + C + '__name">' +
                            '<span class="' + C + '__name-words">' + Na__LeStmtInl__ToHtml(item.Name) + '</span>' +
                            (item.Tag ? '<span class="' + C + '__tag ' + C + '__tag--' + item.Tag.Kind + '">' + Na__LeStmtFin__Escape(item.Tag.Text) + '</span>' : '') +
                        '</div>' +
                        '<div class="' + C + '__detail">' + lines + '</div>' +
                    '</div>';
        }
        if (count === 0) html += '<p class="' + C + '__empty">' + Na__LeStmtFin__Escape(setup.EmptyText) + '</p>';
        for (const line of model.Notes) html += '<p class="' + C + '__note">' + Na__LeStmtInl__ToHtml(line) + '</p>';

        return '<section class="na-le-stmt-std ' + C + '">' + html + '</section>';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Switching On and Off
// -----------------------------------------------------------------------------

    // FUNCTION | Take Over the Statement's Comparison Table
    // ------------------------------------------------------------
    // blocks: the statement's tokenised blocks. Returns { Start, End, Body }
    // for the first pipe table whose headings read as a comparison, or null.
    // The body is that table with its heading row reduced to words (the
    // width spans only ever sized a table) and a short separator; every row
    // comes across exactly as typed.
    // ------------------------------------------------------------
    function Na__LeStmtFin__Adopt(blocks) {
        const list = Array.isArray(blocks) ? blocks : [];
        for (let at = 0; at < list.length; at++) {
            const block = list[at];
            if (!block || block.Kind !== 'table' || !Na__LeStmtFin__IsComparison(block.Head)) continue;
            const lines = (block.Lines || []).slice(0, (block.Lines || []).length - Na__LeStmtMd__TrailingBlanks(block));
            if (lines.length < 2) continue;
            const head  = Na__LeStmtFin__Cells(lines[0]).map(Na__LeStmtFin__Plain);
            const align = Na__LeStmtFin__Cells(lines[1]).map(Na__LeStmtFin__AlignOf);
            const body  = [ Na__LeStmtFin__RowLine(head), Na__LeStmtFin__RowLine(head.map((text, index) => Na__LeStmtFin__SeparatorCell(align[index] || '', 3))) ]
                          .concat(lines.slice(2));
            return { Start : at, End : at + 1, Body : body.join('\n') };
        }
        return null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Write the Comparison Back as the House Table (switching it off)
    // ------------------------------------------------------------
    // The heading row as the skill writes it - the first two headings in
    // their width spans, every other cell padded to sixty characters - the
    // separator at house width, and the rows exactly as they stand. Words
    // written above or under the table come back as paragraphs.
    // ------------------------------------------------------------
    function Na__LeStmtFin__Unwrap(body, config) {
        const setup  = Na__LeStmtFin__Setup(config);
        const parsed = Na__LeStmtFin__Parse(body);
        const out    = [];
        for (const line of parsed.Intro) out.push(line, '');

        if (parsed.End > parsed.Start) {
            if (parsed.Head) {
                const widths = setup.HouseWidthsMm.map(Number);
                const head   = parsed.Head.map((text, index) => {
                    const words = Na__LeStmtFin__Plain(text);
                    const mm    = widths[index];
                    return (Number.isFinite(mm) && mm > 0)
                        ? '<span style="display:inline-block; width:' + mm + 'mm; white-space:nowrap;">' + words + '</span>'
                        : words.padEnd(Na__LeStmtFin__HOUSE_CELL, ' ');
                });
                out.push(Na__LeStmtFin__RowLine(head));
                out.push(Na__LeStmtFin__RowLine(parsed.Head.map((text, index) => Na__LeStmtFin__SeparatorCell((parsed.Align && parsed.Align[index]) || 'left', Na__LeStmtFin__HOUSE_CELL))));
            }
            for (const line of parsed.RowLines) out.push(line);
        }

        if (parsed.Notes.length) { if (out.length) out.push(''); parsed.Notes.forEach((line, index) => { if (index) out.push(''); out.push(line); }); }
        while (out.length && out[out.length - 1] === '') out.pop();
        return out.join('\n');
    }
    // ------------------------------------------------------------


    // FUNCTION | A New Comparison's Body
    // ------------------------------------------------------------
    // The configured headings and starting rows, every cell a [TO CONFIRM]
    // until it is written.
    // ------------------------------------------------------------
    function Na__LeStmtFin__NewBody(config) {
        const setup = Na__LeStmtFin__Setup(config);
        const heads = setup.NewHeadings.map((text) => String(text));
        const rows  = setup.NewRows.filter(Array.isArray).map((cells) => heads.map((text, index) => String(cells[index] === undefined ? '' : cells[index]).replace(/\|/g, '\\|')));
        return [ Na__LeStmtFin__RowLine(heads), Na__LeStmtFin__RowLine(heads.map(() => Na__LeStmtFin__SeparatorCell('left', 3))) ]
            .concat(rows.map(Na__LeStmtFin__RowLine))
            .join('\n');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Section's Definition, for the Registry
    // ------------------------------------------------------------
    function Na__LeStmtFin__Definition() {
        return {
            Id            : Na__LeStmtFin__ID,
            Label         : (config) => Na__LeStmtFin__Setup(config).Label,
            Fallback      : (config) => Na__LeStmtFin__Setup(config).FallbackText,
            PlaceAfter    : (config) => Na__LeStmtFin__Setup(config).PlaceAfter,
            ContentsTitle : () => '',                                           // <-- Its heading is the writer's own "#### N.N |" line, already listed
            EditHint      : 'Edit the comparison as a markdown table, one row per building element: | **Element** | existing | proposed |. A row with only its first cell is a group heading; [TO CONFIRM: ...] is drawn as a note; "Not applicable" or "None" as the existing finish tags the element New.',
            NewBody       : Na__LeStmtFin__NewBody,
            Unit          : 'none',                                             // <-- It sits inside a section, under the writer's heading, not between dividers
            Movable       : false,                                              // <-- The Move handle only ever drops a section under a major divider
            Adopt         : Na__LeStmtFin__Adopt,
            Unwrap        : Na__LeStmtFin__Unwrap,
            Build         : Na__LeStmtFin__Build
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Standard Section: Finishes Comparison
    // ------------------------------------------------------------
    export {
        Na__LeStmtFin__ID,
        Na__LeStmtFin__Parse,
        Na__LeStmtFin__Roles,
        Na__LeStmtFin__IsComparison,
        Na__LeStmtFin__Model,
        Na__LeStmtFin__Build,
        Na__LeStmtFin__Adopt,
        Na__LeStmtFin__Unwrap,
        Na__LeStmtFin__NewBody,
        Na__LeStmtFin__Definition
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
