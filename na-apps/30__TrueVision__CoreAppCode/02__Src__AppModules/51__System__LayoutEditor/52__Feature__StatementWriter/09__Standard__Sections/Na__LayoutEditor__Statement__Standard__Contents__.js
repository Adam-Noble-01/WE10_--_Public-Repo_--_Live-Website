// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT STANDARD SECTION - CONTENTS
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Standard__Contents__.js
// NAMESPACE  : Na__LeStmtToc
// MODULE     : Layout Editor - Statement Writer - Standard Section: Contents
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw a statement's table of contents from its own headings, every time it is shown
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - WHY IT IS A STANDARD SECTION. RB05's Contents was first written into the
//   file by a script (build_contents.py in the design-and-access-statement
//   skill) and had to be rebuilt by hand after every heading change - and a
//   peer's renumbering of sections 6 to 10 made it stale within the hour.
//   Adam, 29-Sep-2026: "We need to make sure the table of contents is set up as
//   an automatic element as well". So the file holds one marker line and the
//   list is drawn from the headings each time the statement is rendered: it
//   cannot fall behind them.
// - WHAT IT LISTS, in document order: every "### N.0 |" section, its
//   "#### N.N |" subsections indented beneath it, any "##" part after the
//   first section (a drawing pack, the supplementary notes), and every other
//   standard section that names a line for itself (the TrueVision 3D Project
//   Hub) - unnumbered, where it stands. Unnumbered "####" headings (theme
//   heads, policy entries, drawing-note codes) are left out on purpose.
// - HOW IT LOOKS. Exactly the Contents RB05 carried: the "Contents" heading,
//   two columns split where the line counts balance and never inside a
//   section, sections in the document's olive, subsections in grey under
//   them, a fixed column for the numbers. No page numbers: a statement is one
//   continuous A4-wide page.
// - WHERE IT LANDS: straight after the header's divider, so it is always the
//   first thing after the header information, with a major divider under it.
//
// INTEGRATION:
// - Registered with Na__LayoutEditor__Statement__Standard__Registry__, which
//   hands Build the statement's tokenised blocks and a way to ask any other
//   standard section's marker for its Contents line.
// - Styled by the Standard Sections region of the statement document
//   stylesheet (.na-le-stmt-std-toc).
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
// - Initial implementation, from the static Contents of RB05 and the
//   build_contents.py script that made it.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Section's Id and Config Block
    // ------------------------------------------------------------
    const Na__LeStmtToc__ID     = 'Contents';
    const Na__LeStmtToc__BLOCK  = 'StatementStandard__Contents__Config';
    const Na__LeStmtToc__PREFIX = 'Contents__';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Built-In Defaults (mirror the config file)
    // ------------------------------------------------------------
    const Na__LeStmtToc__FALLBACKS = {
        Label        : 'Table Of Contents',
        TitleText    : 'Contents',
        PlaceAfter   : [ 'HeaderDivider' ],
        Columns      : 2,
        FallbackText : 'Standard Section: Table Of Contents. It is drawn from this statement\'s own headings by TrueVision\'s Statement Writer; this line is all an editor without it can show.'
    };
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Headings That Are Listed
    // ------------------------------------------------------------
    const Na__LeStmtToc__SECTION    = /^(\d+)\.0\s*\|\s*(.+)$/;               // <-- ### 11.0 |  Planning Policy Context
    const Na__LeStmtToc__SUBSECTION = /^(\d+\.\d+)\s*\|\s*(.+)$/;             // <-- #### 11.1 |  The Charnwood Local Plan 2021-37
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Escape Text for HTML
    // ------------------------------------------------------------
    function Na__LeStmtToc__Escape(text) {
        return String(text === undefined || text === null ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Heading's Words Without Their Markdown
    // ------------------------------------------------------------
    // Headings are plain in these statements, but a stray ** or ` must not
    // print in the Contents. " - " runs of spaces fold to one, as they render.
    // ------------------------------------------------------------
    function Na__LeStmtToc__Plain(text) {
        return String(text || '').replace(/(\*\*|__|\*|_|`|==|~~)/g, '').replace(/\s+-\s+/g, ' - ').replace(/\s+/g, ' ').trim();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Setup, the Config File Over the Built-In Defaults
    // ------------------------------------------------------------
    function Na__LeStmtToc__Setup(config) {
        const block = (config && typeof config === 'object' && config[Na__LeStmtToc__BLOCK] && typeof config[Na__LeStmtToc__BLOCK] === 'object')
            ? config[Na__LeStmtToc__BLOCK] : {};
        const setup = {};
        for (const key of Object.keys(Na__LeStmtToc__FALLBACKS)) {
            const fallback = Na__LeStmtToc__FALLBACKS[key];
            const value    = block[Na__LeStmtToc__PREFIX + key];
            if (Array.isArray(fallback))           setup[key] = Array.isArray(value) && value.length ? value : fallback;
            else if (typeof fallback === 'number') setup[key] = Number.isFinite(value) && value >= 1 ? Math.floor(value) : fallback;
            else                                   setup[key] = typeof value === 'string' && value.trim() !== '' ? value : fallback;
        }
        return setup;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Entries, Grouped Into Sections
    // ------------------------------------------------------------
    // Returns [[{ Kind:'main'|'sub', Number, Text }, ...], ...]: one group per
    // listed section, its subsections inside it.
    // ------------------------------------------------------------
    function Na__LeStmtToc__Sections(blocks, titleOf) {
        const groups = [];
        let begun = false;
        for (const block of (blocks || [])) {
            if (block.Kind === 'heading') {
                const text = Na__LeStmtToc__Plain(block.Text);
                if (block.Level === 3) {
                    const match = Na__LeStmtToc__SECTION.exec(text);
                    if (match) { begun = true; groups.push([{ Kind : 'main', Number : match[1] + '.0', Text : match[2] }]); }
                } else if (block.Level === 4 && begun && groups.length) {
                    const match = Na__LeStmtToc__SUBSECTION.exec(text);
                    if (match) groups[groups.length - 1].push({ Kind : 'sub', Number : match[1], Text : match[2] });
                } else if (block.Level === 2 && begun) {
                    groups.push([{ Kind : 'main', Number : '', Text : text }]);
                }
            } else if (block.Kind === 'html' && typeof titleOf === 'function') {
                const title = titleOf(block.Html || '');                        // <-- Another standard section with a line of its own
                if (title) groups.push([{ Kind : 'main', Number : '', Text : title }]);
            }
        }
        return groups;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Split the Sections Into Columns Whose Line Counts Balance
    // ------------------------------------------------------------
    function Na__LeStmtToc__Split(groups, columns) {
        if (columns <= 1 || groups.length <= 1) return [groups];
        const total = groups.reduce((sum, group) => sum + group.length, 0);
        let best = null, run = 0;
        for (let i = 0; i < groups.length - 1; i++) {
            run += groups[i].length;
            const diff = Math.abs(total - 2 * run);
            if (best === null || diff < best.diff) best = { diff : diff, at : i + 1 };
        }
        return [groups.slice(0, best.at), groups.slice(best.at)];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The Section's HTML
    // ------------------------------------------------------------
    // context : { Blocks, TitleOf } from the registry - the statement's
    //           tokenised blocks, and a function naming another standard
    //           section's Contents line from its marker ('' for anything else).
    // ------------------------------------------------------------
    function Na__LeStmtToc__Build(config, overrides, context) {
        const setup  = Na__LeStmtToc__Setup(config);
        const C      = 'na-le-stmt-std-toc';
        const groups = Na__LeStmtToc__Sections(context && context.Blocks, context && context.TitleOf);
        const cols   = Na__LeStmtToc__Split(groups, Math.min(2, setup.Columns));

        const row = (entry) =>
            '<div class="' + C + '__' + entry.Kind + '">' +
                '<span class="' + C + '__number">' + Na__LeStmtToc__Escape(entry.Number) + '</span>' +
                '<span class="' + C + '__text">' + Na__LeStmtToc__Escape(entry.Text) + '</span>' +
            '</div>';

        const body = groups.length
            ? '<div class="' + C + '__columns">' +
                  cols.map((column) => '<div class="' + C + '__column">' + column.map((group) => group.map(row).join('')).join('') + '</div>').join('') +
              '</div>'
            : '<p class="' + C + '__empty"><i>The contents are listed here once the statement has numbered sections (### 1.0 |  Introduction).</i></p>';

        return '<section class="na-le-stmt-std ' + C + '">' +
                   '<h3 class="' + C + '__title">' + Na__LeStmtToc__Escape(setup.TitleText) + '</h3>' +
                   body +
               '</section>';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Section's Definition, for the Registry
    // ------------------------------------------------------------
    function Na__LeStmtToc__Definition() {
        return {
            Id                : Na__LeStmtToc__ID,
            Label             : (config) => Na__LeStmtToc__Setup(config).Label,
            Fallback          : (config) => Na__LeStmtToc__Setup(config).FallbackText,
            PlaceAfter        : (config) => Na__LeStmtToc__Setup(config).PlaceAfter,
            ContentsTitle     : () => '',                                       // <-- The Contents does not list itself
            DependsOnDocument : true,                                           // <-- Drawn again as the headings change
            Build             : Na__LeStmtToc__Build
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Standard Section: Contents
    // ------------------------------------------------------------
    export {
        Na__LeStmtToc__ID,
        Na__LeStmtToc__Build,
        Na__LeStmtToc__Definition
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
