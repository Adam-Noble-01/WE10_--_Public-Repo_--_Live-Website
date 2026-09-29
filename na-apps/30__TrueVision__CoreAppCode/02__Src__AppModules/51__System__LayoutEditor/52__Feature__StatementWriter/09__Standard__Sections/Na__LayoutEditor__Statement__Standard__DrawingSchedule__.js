// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT STANDARD SECTION - DRAWING SCHEDULE
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Standard__DrawingSchedule__.js
// NAMESPACE  : Na__LeStmtSched
// MODULE     : Layout Editor - Statement Writer - Standard Section: Drawing Schedule
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : A statement's list of the drawings that go with it - a copy of the Drawing Register taken when Sync is pressed, then edited like any other words
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - WHY. Adam, 29-Sep-2026, over the end of RB05's pre-application statement,
//   where a hand-written "Pre-Application Drawing Pack" table sat between the
//   end-of-statement note and the copyright line: "This drawings table should
//   actually be a standardised item that you can toggle on and off ... It
//   should contain a sync button that can sync it with the live drawing
//   register and pull through all the data, but then still keep it in
//   Markdown or HTML or whatever, so it is editable. It doesn't keep a live
//   link because you might not always want the live link in a document that's
//   meant to be set to a certain date and time".
// - A SNAPSHOT, NOT A LINK. The Contents and the hub are drawn fresh every
//   time. This section is not: its words AND its table live inside the
//   marker, as markdown, one line each, and are drawn exactly as written:
//       <div class="na-le-stmt-std-marker" data-na-standard-section="DrawingSchedule" data-na-std-synced="2026-09-29T18:52:10.000Z">
//       ## Pre-Application Drawing Pack
//       The drawings listed below accompany this statement.
//       | Drawing | Title | Scale | Size | Rev |
//       | :--- | :--- | :--- | :--- | :--- |
//       | RB05_T01_D01 | Project Introduction | NTS | ISO A3 | A |
//       </div>
//   A "#" line is the section's heading (and its line in the Contents), a run
//   of "|" lines is the table, and every other line is a paragraph - above
//   the table or under it, where it stands. There is never a blank line
//   inside: it would end the block in Typora, so the registry never writes
//   one. Edit on the card opens exactly these lines.
// - SYNC REPLACES THE TABLE'S ROWS AND NOTHING ELSE. Merge takes the Drawing
//   Register's rows (read by ...DrawingSchedule__Live__, which the page
//   registers as this section's source) and writes them in place of the old
//   ones:
//     - the heading and the paragraphs are the writer's and are never touched;
//     - a header row the writer retitled is kept while it still has one
//       heading per configured column;
//     - a row for a document the register cannot know about - one whose code
//       does not start with the project's code, a consultant's report typed
//       in by hand - is kept, under the register's rows;
//     - a row the register no longer holds (a deleted drawing) goes.
//   Describe says what a sync would change in words, so the editor can ask
//   before it writes. Until the next Sync the table is the statement's own:
//   edit a title, delete a row, and it stays as it was left.
// - THE COLUMNS ARE CONFIGURED (DrawingSchedule__Columns), each a key into a
//   register row: code, name, label, scale, size, scaleAndSize, revision,
//   status, phase, drawingNo. A scale that repeats the paper its Size column
//   already prints ("1:100 @ ISO A2" beside "ISO A2") is printed as "1:100",
//   as the register's own PDF does; the sheet's field is never changed.
// - HOW IT IS DRAWN. With the document's own heading, paragraph and table
//   styles, so it reads as part of the statement, not as a panel laid on it.
//   The first column is set like the house's bold first column; every column
//   but the one with the longest words keeps to one line, so a drawing code
//   or a scale never breaks.
//
// INTEGRATION:
// - Registered with Na__LayoutEditor__Statement__Standard__Registry__, which
//   calls Build to draw it, ContentsTitle for its line in the Contents, and
//   Merge and Describe when its card's Sync button is pressed. Pure: strings
//   in, strings out, and it runs under node.
// - Styled by .na-le-stmt-std-sched in the statement document stylesheet.
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
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Statement's Own Inline Markdown
    // ------------------------------------------------------------
    import { Na__LeStmtInl__ToHtml } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Inline__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Section's Id and Config Block
    // ------------------------------------------------------------
    const Na__LeStmtSched__ID     = 'DrawingSchedule';
    const Na__LeStmtSched__BLOCK  = 'StatementStandard__DrawingSchedule__Config';
    const Na__LeStmtSched__PREFIX = 'DrawingSchedule__';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Built-In Defaults (mirror the config file)
    // ------------------------------------------------------------
    const Na__LeStmtSched__FALLBACKS = {
        Label                : 'Drawing Schedule',
        NewTitle             : 'Drawing Schedule',
        NewText              : [ 'The drawings listed below accompany this statement.' ],
        Columns              : [
            { Key : 'code',     Heading : 'Drawing', Align : 'left' },
            { Key : 'name',     Heading : 'Title',   Align : 'left' },
            { Key : 'scale',    Heading : 'Scale',   Align : 'left' },
            { Key : 'size',     Heading : 'Size',    Align : 'left' },
            { Key : 'revision', Heading : 'Rev',     Align : 'left' }
        ],
        IncludeSpecification : true,
        SpecificationTitle   : 'Project Specification',
        SpecificationSize    : 'ISO A4',
        CollapseScaleSuffix  : true,
        EmptyCellText        : '—',
        EmptyText            : 'The table is empty. Press Sync on this section to fill it from the Drawing Register.',
        PlaceAfter           : [ 'BeforeStandard:DocumentFooter', 'SectionsEnd', 'End' ],
        FallbackText         : 'Standard Section: Drawing Schedule.'
    };
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Lines a Body Is Made Of
    // ------------------------------------------------------------
    const Na__LeStmtSched__ROW       = /^[ \t]*\|/;
    const Na__LeStmtSched__HEADING   = /^[ \t]{0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
    const Na__LeStmtSched__SEPARATOR = /^[ \t]*\|?[ \t]*:?-{1,}:?[ \t]*(\|[ \t]*:?-{1,}:?[ \t]*)*\|?[ \t]*$/;   // <-- The tokeniser's own
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Escape Text for HTML
    // ------------------------------------------------------------
    function Na__LeStmtSched__Escape(text) {
        return String(text === undefined || text === null ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Setup, the Config File Over the Built-In Defaults
    // ------------------------------------------------------------
    // A value of the wrong type in the file is ignored for that key only. A
    // column needs a Key and a Heading or it is dropped; no usable column at
    // all falls back to the built-in five.
    // ------------------------------------------------------------
    function Na__LeStmtSched__Setup(config) {
        const block = (config && typeof config === 'object' && config[Na__LeStmtSched__BLOCK] && typeof config[Na__LeStmtSched__BLOCK] === 'object')
            ? config[Na__LeStmtSched__BLOCK] : {};
        const setup = {};
        for (const key of Object.keys(Na__LeStmtSched__FALLBACKS)) {
            const fallback = Na__LeStmtSched__FALLBACKS[key];
            const value    = block[Na__LeStmtSched__PREFIX + key];
            if (Array.isArray(fallback))            setup[key] = Array.isArray(value) && value.length ? value : fallback;
            else if (typeof fallback === 'boolean') setup[key] = typeof value === 'boolean' ? value : fallback;
            else                                    setup[key] = typeof value === 'string' && value.trim() !== '' ? value : fallback;
        }
        const columns = setup.Columns.filter((column) => column && typeof column.Key === 'string' && column.Key.trim() !== '' && typeof column.Heading === 'string');
        setup.Columns = columns.length ? columns : Na__LeStmtSched__FALLBACKS.Columns;
        if (typeof block[Na__LeStmtSched__PREFIX + 'EmptyCellText'] === 'string') setup.EmptyCellText = block[Na__LeStmtSched__PREFIX + 'EmptyCellText'];   // <-- "" is a real answer here
        return setup;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Cells of One Table Line
    // ------------------------------------------------------------
    // The tokeniser's rule: the outer pipes go, an escaped pipe stays inside
    // its cell, every cell is trimmed.
    // ------------------------------------------------------------
    function Na__LeStmtSched__Cells(line) {
        let text = String(line || '').trim();
        if (text.startsWith('|')) text = text.slice(1);
        if (text.endsWith('|') && !text.endsWith('\\|')) text = text.slice(0, -1);
        return text.split(/(?<!\\)\|/).map((cell) => cell.trim());
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Cell's Words Without Their Markup
    // ------------------------------------------------------------
    // What a row is known by: "**RB05_T01_D01**" and "RB05_T01_D01" are the
    // same drawing. An underscore inside a code is never touched.
    // ------------------------------------------------------------
    function Na__LeStmtSched__Plain(text) {
        return String(text || '')
            .replace(/<[^>]*>/g, '')
            .replace(/\*\*|`|~~|==/g, '')
            .replace(/^\*(.*)\*$/, '$1')
            .replace(/\\\|/g, '|')
            .replace(/\s+/g, ' ')
            .trim();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Value Made Safe to Stand in a Cell
    // ------------------------------------------------------------
    function Na__LeStmtSched__CellText(value) {
        return String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Table Line From Its Cells
    // ------------------------------------------------------------
    function Na__LeStmtSched__RowLine(cells) {
        return '| ' + cells.join(' | ') + ' |';
    }
    function Na__LeStmtSched__SeparatorLine(columns) {
        return '| ' + columns.map((column) => {
            const align = String(column.Align || 'left').toLowerCase();
            return align === 'center' || align === 'centre' ? ':---:' : align === 'right' ? '---:' : ':---';
        }).join(' | ') + ' |';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drop a Paper Suffix the Size Column Already Prints
    // ------------------------------------------------------------
    // The register PDF's rule, so the two documents print a scale the same
    // way: "1:100 @ ISO A2" beside "ISO A2" is "1:100". A scale that is
    // nothing but its paper keeps printing.
    // ------------------------------------------------------------
    function Na__LeStmtSched__ScaleText(scale, size, collapse) {
        const text = String(scale === undefined || scale === null ? '' : scale).trim();
        if (!collapse || !text) return text;
        const paper = String(size || '').trim().replace(/^ISO\s+/i, '');
        if (!paper) return text;
        const token = paper.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const cut   = text.replace(new RegExp('\\s*@\\s*(ISO\\s*)?' + token + '\\s*$', 'i'), '').trim();
        return cut || text;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Register Row's Value for One Column
    // ------------------------------------------------------------
    function Na__LeStmtSched__Value(row, key, setup) {
        const text  = (value) => String(value === undefined || value === null ? '' : value).replace(/\s+/g, ' ').trim();
        const scale = () => Na__LeStmtSched__ScaleText(row.scale, row.size, setup.CollapseScaleSuffix);
        switch (key) {
            case 'code'         : return text(row.code || row.documentCode);
            case 'label'        : return text(row.label || row.name);
            case 'scale'        : return text(scale());
            case 'scaleAndSize' : return [ text(scale()), text(row.size) ].filter((part) => part !== '').join(', ');
            case 'revision'     : return text(row.revision).replace(/^Rev\s+/i, '');
            default             : return text(row[key]);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading a Body
// -----------------------------------------------------------------------------

    // FUNCTION | Cut a Body Into Its Heading, Paragraphs and Tables
    // ------------------------------------------------------------
    // Returns { Lines, Items } where each item knows the lines it came from:
    //   { Kind : 'heading',   Level, Text,             Start, End }
    //   { Kind : 'paragraph', Text,                    Start, End }
    //   { Kind : 'table',     Head, Align, Rows, RowLines, Start, End }
    // Align is null when the table has no separator row under its head.
    // ------------------------------------------------------------
    function Na__LeStmtSched__Parse(body) {
        const lines = String(body === undefined || body === null ? '' : body).split('\n');
        const items = [];
        let at = 0;
        while (at < lines.length) {
            const line = lines[at];
            if (line.trim() === '') { at++; continue; }

            if (Na__LeStmtSched__ROW.test(line)) {
                const start = at;
                while (at < lines.length && Na__LeStmtSched__ROW.test(lines[at])) at++;
                const separated = at - start > 1 && Na__LeStmtSched__SEPARATOR.test(lines[start + 1]) && lines[start + 1].indexOf('-') !== -1;
                const first     = start + (separated ? 2 : 1);
                items.push({
                    Kind     : 'table',
                    Head     : Na__LeStmtSched__Cells(lines[start]),
                    Align    : separated ? Na__LeStmtSched__Cells(lines[start + 1]).map((cell) => {
                        const left  = cell.startsWith(':');
                        const right = cell.endsWith(':');
                        return (left && right) ? 'center' : right ? 'right' : left ? 'left' : '';
                    }) : null,
                    Rows     : lines.slice(first, at).map(Na__LeStmtSched__Cells),
                    RowLines : lines.slice(first, at),
                    Start    : start,
                    End      : at
                });
                continue;
            }

            const heading = Na__LeStmtSched__HEADING.exec(line);
            if (heading) {
                items.push({ Kind : 'heading', Level : heading[1].length, Text : heading[2], Start : at, End : at + 1 });
            } else {
                items.push({ Kind : 'paragraph', Text : line.trim(), Start : at, End : at + 1 });
            }
            at++;
        }
        return { Lines : lines, Items : items };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Section's Heading, Plain (its line in the Contents)
    // ------------------------------------------------------------
    function Na__LeStmtSched__Title(body) {
        const heading = Na__LeStmtSched__Parse(body).Items.find((item) => item.Kind === 'heading');
        return heading ? Na__LeStmtSched__Plain(heading.Text) : '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Table, Drawn
    // ------------------------------------------------------------
    // Every column keeps to one line except the one whose longest cell is
    // longest - the titles - which takes the slack and wraps.
    // ------------------------------------------------------------
    function Na__LeStmtSched__Table(table, C) {
        const width = Math.max(1, table.Head.length);
        const fit   = (cells) => { const out = cells.slice(0, width); while (out.length < width) out.push(''); return out; };
        const head  = fit(table.Head);
        const rows  = table.Rows.map(fit);

        let grow = 0, most = -1;
        for (let column = 0; column < width; column++) {
            const longest = Math.max(...[ head ].concat(rows).map((cells) => Na__LeStmtSched__Plain(cells[column]).length));
            if (longest > most) { most = longest; grow = column; }
        }

        const align = (column) => {
            const value = table.Align ? table.Align[column] : '';
            return (value && value !== 'left') ? ' style="text-align:' + value + '"' : '';   // <-- Left is where a cell starts anyway
        };
        const cell = (tag, cells) => cells.map((text, column) =>
            '<' + tag + ' class="' + C + '__cell ' + C + (column === grow ? '__cell--grow' : '__cell--fit') + '"' + align(column) + '>'
                + Na__LeStmtInl__ToHtml(text) +
            '</' + tag + '>').join('');

        return '<table class="' + C + '__table">' +
                   '<thead><tr>' + cell('th', head) + '</tr></thead>' +
                   '<tbody>' + rows.map((cells) => '<tr>' + cell('td', cells) + '</tr>').join('') + '</tbody>' +
               '</table>';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Section's HTML
    // ------------------------------------------------------------
    // overrides.body is the markdown inside the marker. A table with no rows
    // yet (or no table) draws a line saying how to fill it, which only the
    // editor shows: the reader, the PDF and the published page hide it.
    // ------------------------------------------------------------
    function Na__LeStmtSched__Build(config, overrides) {
        const setup  = Na__LeStmtSched__Setup(config);
        const C      = 'na-le-stmt-std-sched';
        const parsed = Na__LeStmtSched__Parse(overrides && overrides.body);

        let html = '';
        let rows = 0;
        for (const item of parsed.Items) {
            if (item.Kind === 'heading') {
                const level = Math.min(6, Math.max(1, item.Level));
                html += '<h' + level + ' class="' + C + '__title">' + Na__LeStmtInl__ToHtml(item.Text) + '</h' + level + '>';
            } else if (item.Kind === 'paragraph') {
                html += '<p>' + Na__LeStmtInl__ToHtml(item.Text) + '</p>';
            } else if (item.Kind === 'table') {
                html += Na__LeStmtSched__Table(item, C);
                rows += item.Rows.length;
            }
        }
        if (rows === 0) html += '<p class="' + C + '__empty">' + Na__LeStmtSched__Escape(setup.EmptyText) + '</p>';

        return '<section class="na-le-stmt-std ' + C + '">' + html + '</section>';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Syncing
// -----------------------------------------------------------------------------

    // FUNCTION | The Register's Rows as Table Cells
    // ------------------------------------------------------------
    // rows : the source's rows - one per sheet, as the Drawing Register reads
    //        them ({ code, name, label, scale, size, revision, status, phase,
    //        drawingNo }), and { Kind : 'specification', code, revision } for
    //        the Project Specification, whose title and paper come from the
    //        config. An empty value prints the configured empty-cell mark.
    // ------------------------------------------------------------
    function Na__LeStmtSched__RowsFrom(rows, config) {
        const setup = Na__LeStmtSched__Setup(config);
        return (Array.isArray(rows) ? rows : [])
            .filter((row) => row && typeof row === 'object')
            .filter((row) => row.Kind !== 'specification' || setup.IncludeSpecification)
            .map((row) => row.Kind === 'specification'
                ? Object.assign({ name : setup.SpecificationTitle, label : setup.SpecificationTitle, size : setup.SpecificationSize, scale : '' }, row)
                : row)
            .map((row) => setup.Columns.map((column) => {
                const value = Na__LeStmtSched__CellText(Na__LeStmtSched__Value(row, column.Key, setup));
                return value !== '' ? value : setup.EmptyCellText;
            }));
    }
    // ------------------------------------------------------------


    // FUNCTION | Write the Register's Rows Into a Body
    // ------------------------------------------------------------
    // data : { Rows, ProjectCode } from the section's source.
    // Returns { Body, Summary }. Summary: { Same, HadRows, ColumnsChanged,
    // Added, Removed, Changed, Kept (row codes), Count, Columns (headings) }.
    // Only the first table is written; without one, one is added at the end.
    // Every other line of the body comes back exactly as it was.
    // ------------------------------------------------------------
    function Na__LeStmtSched__Merge(body, data, config) {
        const setup   = Na__LeStmtSched__Setup(config);
        const parsed  = Na__LeStmtSched__Parse(body);
        const table   = parsed.Items.find((item) => item.Kind === 'table') || null;
        const project = String((data && data.ProjectCode) || '').trim().toUpperCase();
        const fresh   = Na__LeStmtSched__RowsFrom(data && data.Rows, config);
        const columns = setup.Columns;

        // THE HEAD: the writer's own words while there is still one heading per column
        const keepHead = !!table && table.Head.length === columns.length;
        const headLine = keepHead ? parsed.Lines[table.Start].trim() : Na__LeStmtSched__RowLine(columns.map((column) => Na__LeStmtSched__CellText(column.Heading)));
        const sepLine  = (keepHead && table.Align) ? parsed.Lines[table.Start + 1].trim() : Na__LeStmtSched__SeparatorLine(columns);

        // THE ROWS: the register's, then any typed by hand for a document it cannot know
        const code       = (cells) => Na__LeStmtSched__Plain(cells[0]);
        const freshCodes = new Set(fresh.map(code));
        const oldRows    = table ? table.Rows.map((cells, index) => ({ Cells : cells, Line : table.RowLines[index].trim(), Code : code(cells) })) : [];
        const kept       = oldRows.filter((row) => row.Code !== '' && !freshCodes.has(row.Code) && !(project && row.Code.toUpperCase().startsWith(project + '_')));
        const lines      = [ headLine, sepLine ].concat(fresh.map(Na__LeStmtSched__RowLine), kept.map((row) => row.Line));

        const out = parsed.Lines.slice();
        if (table) out.splice(table.Start, table.End - table.Start, ...lines);
        else       out.push(...lines);
        const clean  = (text) => String(text === undefined || text === null ? '' : text).split('\n').filter((line) => line.trim() !== '').join('\n');
        const merged = clean(out.join('\n'));

        // WHAT CHANGED, row by row, for the question asked before it is written
        const plainRow = (cells) => cells.map(Na__LeStmtSched__Plain).join(' | ');
        const before   = new Map(oldRows.map((row) => [ row.Code, plainRow(row.Cells) ]));
        const after    = new Map(fresh.map((cells) => [ code(cells), plainRow(cells) ]));
        const columnsChanged = !!table && !keepHead;
        const summary = {
            Same           : merged === clean(body),
            HadRows        : oldRows.length > 0,
            ColumnsChanged : columnsChanged,
            Added          : [ ...after.keys() ].filter((key) => !before.has(key)),
            Removed        : oldRows.filter((row) => row.Code !== '' && !after.has(row.Code) && !kept.includes(row)).map((row) => row.Code),
            Changed        : columnsChanged ? [] : [ ...after.keys() ].filter((key) => before.has(key) && before.get(key) !== after.get(key)),
            Kept           : kept.map((row) => row.Code),
            Count          : fresh.length + kept.length,
            Columns        : columns.map((column) => column.Heading)
        };
        return { Body : merged, Summary : summary };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A List of Codes, Said the Way a Person Would
    // ------------------------------------------------------------
    // "RB05_T01_D10", "RB05_T01_D10 and RB05_SPEC", "A, B and C", and past
    // six "A, B, C, D, E, F and 3 more".
    // ------------------------------------------------------------
    function Na__LeStmtSched__Codes(list) {
        const shown = list.slice(0, 6);
        const more  = list.length - shown.length;
        if (more > 0) return shown.join(', ') + ' and ' + more + ' more';
        return shown.length > 1 ? shown.slice(0, -1).join(', ') + ' and ' + shown[shown.length - 1] : (shown[0] || '');
    }
    // ------------------------------------------------------------


    // FUNCTION | What a Sync Would Change, in Words
    // ------------------------------------------------------------
    function Na__LeStmtSched__Describe(summary) {
        const s = summary || {};
        if (s.Same) return 'The table already matches the Drawing Register (' + s.Count + (s.Count === 1 ? ' row' : ' rows') + ').';
        const rows  = (count, one, many) => count + ' ' + (count === 1 ? one : many);
        const parts = [];
        if (!s.HadRows)             parts.push('The table is filled from the Drawing Register: ' + rows(s.Count, 'row', 'rows') + '.');
        if (s.HadRows && s.ColumnsChanged) parts.push('Its columns become ' + Na__LeStmtSched__Codes(s.Columns || []) + ', and every row is rewritten from the register, so anything typed into a row by hand goes.');
        if (s.HadRows && s.Changed.length) parts.push(rows(s.Changed.length, 'row changes', 'rows change') + ': ' + Na__LeStmtSched__Codes(s.Changed) + '.');
        if (s.HadRows && s.Added.length)   parts.push(rows(s.Added.length, 'row is added', 'rows are added') + ': ' + Na__LeStmtSched__Codes(s.Added) + '.');
        if (s.Removed.length)       parts.push(rows(s.Removed.length, 'row is taken out', 'rows are taken out') + ', no longer in the register: ' + Na__LeStmtSched__Codes(s.Removed) + '.');
        if (s.Kept.length)          parts.push(rows(s.Kept.length, 'row typed by hand is', 'rows typed by hand are') + ' kept under the register\'s: ' + Na__LeStmtSched__Codes(s.Kept) + '.');
        if (!parts.length)          parts.push('The table is rewritten to match the Drawing Register.');
        parts.push('The heading and the words are not touched.');
        return parts.join(' ');
    }
    // ------------------------------------------------------------


    // FUNCTION | A New Section's Body
    // ------------------------------------------------------------
    // The heading, the lead-in and an empty table in the configured columns,
    // ready for the first Sync (which the editor runs straight away).
    // ------------------------------------------------------------
    function Na__LeStmtSched__NewBody(config) {
        const setup = Na__LeStmtSched__Setup(config);
        return [ '## ' + setup.NewTitle ]
            .concat(setup.NewText.filter((line) => typeof line === 'string' && line.trim() !== ''))
            .concat([ Na__LeStmtSched__RowLine(setup.Columns.map((column) => Na__LeStmtSched__CellText(column.Heading))), Na__LeStmtSched__SeparatorLine(setup.Columns) ])
            .join('\n');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Section's Definition, for the Registry
    // ------------------------------------------------------------
    function Na__LeStmtSched__Definition() {
        return {
            Id            : Na__LeStmtSched__ID,
            Label         : (config) => Na__LeStmtSched__Setup(config).Label,
            Fallback      : (config) => Na__LeStmtSched__Setup(config).FallbackText,
            PlaceAfter    : (config) => Na__LeStmtSched__Setup(config).PlaceAfter,
            ContentsTitle : (config, overrides) => Na__LeStmtSched__Title(overrides && overrides.body),
            EditHint      : 'Edit the heading, the words and the table - markdown, one line each. They stay as you leave them until the next Sync.',
            NewBody       : Na__LeStmtSched__NewBody,
            Merge         : Na__LeStmtSched__Merge,
            Describe      : Na__LeStmtSched__Describe,
            Build         : Na__LeStmtSched__Build
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Standard Section: Drawing Schedule
    // ------------------------------------------------------------
    export {
        Na__LeStmtSched__ID,
        Na__LeStmtSched__Parse,
        Na__LeStmtSched__Title,
        Na__LeStmtSched__Build,
        Na__LeStmtSched__RowsFrom,
        Na__LeStmtSched__Merge,
        Na__LeStmtSched__Describe,
        Na__LeStmtSched__NewBody,
        Na__LeStmtSched__Definition
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
