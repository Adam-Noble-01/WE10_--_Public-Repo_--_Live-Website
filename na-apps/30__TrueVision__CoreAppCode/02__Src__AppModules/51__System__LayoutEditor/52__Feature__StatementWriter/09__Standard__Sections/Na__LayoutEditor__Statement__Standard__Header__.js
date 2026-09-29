// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT STANDARD SECTION - DOCUMENT HEADER
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Standard__Header__.js
// NAMESPACE  : Na__LeStmtHead
// MODULE     : Layout Editor - Statement Writer - Standard Section: Document Header
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw a statement's opening block - logo, title, applicant, site, authority, author, version - in its own styles
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - WHY. Adam, 29-Sep-2026, over RB05's first page: the title, Applicant, Site
//   Address, Local Planning Authority, Prepared By and Document Version are "too
//   constrained" - "give a little bit more space between these ... maybe these
//   top sections also become a standardised element as well. Just so the styles
//   that exist already for headings and stuff don't mess them up". The house
//   header is written as ##### headings, which carry the document stylesheet's
//   negative two millimetres under them, so every label sits hard on its value
//   and every group hard on the next. Drawn here, the block has spacing of its
//   own that no heading rule can reach.
// - THE FIELDS LIVE IN THE MARKER. Unlike the other standard sections this one
//   is different on every job, so its marker holds the job's words, one field
//   a line, readable and editable in the card's Edit box:
//       <div class="na-le-stmt-std-marker" data-na-standard-section="DocumentHeader">
//       Title: Pre-Application Design Statement
//       Applicant: Mr Samuel Stoffel and Miss Rachael Baum
//       Site Address:
//           West Beacon Farm
//           Deans Lane
//       Local Planning Authority: Charnwood Borough Council  -  Parish of Woodhouse
//       Prepared By: Mr Adam Noble of Noble Architecture on behalf of Mr Stoffel and Miss Baum
//       Document Version: Revision A  -  22nd September 2026
//       </div>
//   A line that starts at the margin and has a colon starts a field; an
//   indented line carries the field above it on to a new line. "Title" is the
//   document title; "Logo" may replace the company logo's address; every other
//   field is drawn as a label over its value, in the order written. A Document
//   Version value's " - date" tail is set in the house italic, as it always was.
// - SWITCHING IT ON TAKES OVER THE HEADER ALREADY THERE. The logo, the "##"
//   title and each "#####" label with the paragraph under it, at the top of the
//   file, are read into fields and replaced by the one marker. Anything else in
//   that stretch (RB05's [TO CONFIRM] revision note) is left where it is.
//   Switching it off writes the header back as that same markdown, so nothing
//   is lost either way.
// - IT DOES NOT MOVE. The header is the top of the document; its card has no
//   Move handle.
//
// INTEGRATION:
// - Registered with Na__LayoutEditor__Statement__Standard__Registry__, which
//   calls Adopt when it is switched on, Unwrap when it is switched off and
//   Build to draw it. Styled by .na-le-stmt-std-head in the statement document
//   stylesheet.
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
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Section's Id and Config Block
    // ------------------------------------------------------------
    const Na__LeStmtHead__ID     = 'DocumentHeader';
    const Na__LeStmtHead__BLOCK  = 'StatementStandard__DocumentHeader__Config';
    const Na__LeStmtHead__PREFIX = 'DocumentHeader__';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Built-In Defaults (mirror the config file)
    // ------------------------------------------------------------
    const Na__LeStmtHead__FALLBACKS = {
        Label             : 'Document Header',
        LogoUrl           : 'https://www.noble-architecture.com/assets/NA03_-_LIBR_-_NA-Site_-_Core-Brand-Image-Assets/NA03_01_-_PNG_-_NA_Company_Logo_-_w2048_x_h500px.png',
        LabelsWithoutColon: [ 'Document Version' ],
        NewFields         : [
            'Title: Design and Access Statement',
            'Applicant: [TO CONFIRM: applicant]',
            'Site Address:',
            '    [TO CONFIRM: site address]',
            'Local Planning Authority: [TO CONFIRM: local planning authority]',
            'Prepared By: Mr Adam Noble of Noble Architecture',
            'Document Version: Revision A  -  [TO CONFIRM: date]'
        ],
        FallbackText      : 'Standard Section: Document Header.'
    };
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Markdown Header This Section Takes Over
    // ------------------------------------------------------------
    const Na__LeStmtHead__LOGO_LINE  = /^\s*<img\b[^>]*NA_Company_Logo[^>]*>\s*$/i;
    const Na__LeStmtHead__FIELD_LINE = /^([A-Za-z][A-Za-z &'/-]{0,48}?)\s*:\s*(.*)$/;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Escape Text for HTML
    // ------------------------------------------------------------
    function Na__LeStmtHead__Escape(text) {
        return String(text === undefined || text === null ? '' : text)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Setup, the Config File Over the Built-In Defaults
    // ------------------------------------------------------------
    function Na__LeStmtHead__Setup(config) {
        const block = (config && typeof config === 'object' && config[Na__LeStmtHead__BLOCK] && typeof config[Na__LeStmtHead__BLOCK] === 'object')
            ? config[Na__LeStmtHead__BLOCK] : {};
        const setup = {};
        for (const key of Object.keys(Na__LeStmtHead__FALLBACKS)) {
            const fallback = Na__LeStmtHead__FALLBACKS[key];
            const value    = block[Na__LeStmtHead__PREFIX + key];
            if (Array.isArray(fallback)) setup[key] = Array.isArray(value) && value.length ? value : fallback;
            else                         setup[key] = typeof value === 'string' && value.trim() !== '' ? value : fallback;
        }
        return setup;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read the Marker's Lines Into Fields
    // ------------------------------------------------------------
    // Returns [{ Key, Lines: [..] }] in the order written.
    // ------------------------------------------------------------
    function Na__LeStmtHead__Fields(body) {
        const fields = [];
        for (const raw of String(body || '').split('\n')) {
            if (raw.trim() === '') continue;
            const field = /^\S/.test(raw) ? Na__LeStmtHead__FIELD_LINE.exec(raw.trim()) : null;
            if (field) {
                fields.push({ Key : field[1].trim(), Lines : field[2].trim() === '' ? [] : [ field[2].trim() ] });
            } else if (fields.length) {
                fields[fields.length - 1].Lines.push(raw.trim());               // <-- An indented line carries the field above on
            }
        }
        return fields;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Markdown Inline Marks Out of a Header Line
    // ------------------------------------------------------------
    function Na__LeStmtHead__Plain(text) {
        return String(text || '').replace(/(\*\*|__|\*|_)/g, '').replace(/[ \t]+/g, ' ').replace(/ - /g, '  -  ').trim();
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | The Section's HTML
    // ------------------------------------------------------------
    // overrides.body is the text inside the marker.
    // ------------------------------------------------------------
    function Na__LeStmtHead__Build(config, overrides) {
        const setup  = Na__LeStmtHead__Setup(config);
        const C      = 'na-le-stmt-std-head';
        const fields = Na__LeStmtHead__Fields(overrides && overrides.body);
        const bare   = setup.LabelsWithoutColon.map((label) => String(label).toLowerCase());

        let logo  = setup.LogoUrl;
        let title = '';
        let groups = '';
        for (const field of fields) {
            const key = field.Key.toLowerCase();
            if (key === 'logo')  { logo  = field.Lines.join(' ').trim() || logo; continue; }
            if (key === 'title') { title = field.Lines.join(' ').trim(); continue; }

            const label = Na__LeStmtHead__Escape(field.Key) + (bare.includes(key) ? '' : ':');
            const lines = field.Lines.map((line) => {
                // A version's " - date" tail is the house italic: "Revision A   *-  22nd September 2026*"
                const dated = key === 'document version' ? /^(.*?\S)\s+-\s+(.+)$/.exec(line) : null;
                return dated
                    ? Na__LeStmtHead__Escape(dated[1]) + '<span class="' + C + '__date">&ensp;-&ensp;' + Na__LeStmtHead__Escape(dated[2]) + '</span>'
                    : Na__LeStmtHead__Escape(line).replace(/ {2}- {2}/g, '&ensp;-&ensp;');
            });
            groups += '<div class="' + C + '__field">' +
                          '<div class="' + C + '__label">' + label + '</div>' +
                          '<div class="' + C + '__value">' + (lines.length ? lines.join('<br>') : '&nbsp;') + '</div>' +
                      '</div>';
        }

        return '<header class="na-le-stmt-std ' + C + '">' +
                   (logo ? '<img class="' + C + '__logo" src="' + Na__LeStmtHead__Escape(logo) + '" alt="Noble Architecture">' : '') +
                   (title ? '<h2 class="' + C + '__title">' + Na__LeStmtHead__Escape(title) + '</h2>' : '') +
                   '<div class="' + C + '__fields">' + groups + '</div>' +
               '</header>';
    }
    // ------------------------------------------------------------


    // FUNCTION | Take Over the Markdown Header at the Top of a Statement
    // ------------------------------------------------------------
    // blocks: the statement's tokenised blocks. Returns { Start, End, Body }
    // - the run of blocks [Start, End) that is the header and the marker body
    // that replaces it - or null when the file does not open with one.
    //
    // The run is the logo line (if first), the "##" title, and every "#####"
    // label with the ONE paragraph directly under it, up to the first block
    // that is none of those. A second paragraph under a label ends the run.
    // ------------------------------------------------------------
    function Na__LeStmtHead__Adopt(blocks) {
        let at = 0;
        while (at < blocks.length && (blocks[at].Kind === 'blank' || blocks[at].Kind === 'frontmatter')) at++;
        const start = at;
        const lines = [];

        if (at < blocks.length && blocks[at].Kind === 'html' && Na__LeStmtHead__LOGO_LINE.test(blocks[at].Html || '')) {
            const src = /\ssrc\s*=\s*"([^"]+)"/i.exec(blocks[at].Html);
            if (src && src[1] !== Na__LeStmtHead__FALLBACKS.LogoUrl) lines.push('Logo: ' + src[1]);
            at++;
        }
        if (at < blocks.length && blocks[at].Kind === 'heading' && blocks[at].Level === 2) {
            lines.push('Title: ' + Na__LeStmtHead__Plain(blocks[at].Text));
            at++;
        }
        let fields = 0;
        while (at < blocks.length && blocks[at].Kind === 'heading' && blocks[at].Level === 5) {
            const label = Na__LeStmtHead__Plain(blocks[at].Text).replace(/\s*:\s*$/, '');
            at++;
            const value = (at < blocks.length && blocks[at].Kind === 'paragraph')
                ? String(blocks[at].Text || '').split('\n').map(Na__LeStmtHead__Plain).filter((line) => line !== '')
                : [];
            if (at < blocks.length && blocks[at].Kind === 'paragraph') at++;
            if (value.length <= 1) lines.push(label + ': ' + (value[0] || ''));
            else { lines.push(label + ':'); for (const line of value) lines.push('    ' + line); }
            fields++;
        }
        if (fields === 0) return null;                                          // <-- Not a house header: nothing is taken over
        return { Start : start, End : at, Body : lines.join('\n') };
    }
    // ------------------------------------------------------------


    // FUNCTION | Write the Header Back as Markdown (switching the section off)
    // ------------------------------------------------------------
    // The same shape the house header has always had: the logo line, the
    // "##" title with its spacing, and a "#####" label over each value.
    // ------------------------------------------------------------
    function Na__LeStmtHead__Unwrap(body, config) {
        const setup  = Na__LeStmtHead__Setup(config);
        const fields = Na__LeStmtHead__Fields(body);
        let logo = setup.LogoUrl;
        const out = [];
        let title = '';
        for (const field of fields) {
            const key = field.Key.toLowerCase();
            if (key === 'logo')  { logo  = field.Lines.join(' ').trim() || logo; continue; }
            if (key === 'title') { title = field.Lines.join(' ').trim(); continue; }
            const bold = key === 'document version';
            out.push('##### ' + (bold ? '**' + field.Key + '**' : field.Key + ':'), '');
            const lines = field.Lines.map((line) => {
                const dated = bold ? /^(.*?\S)\s+-\s+(.+)$/.exec(line) : null;
                return dated ? dated[1] + '   *-  ' + dated[2] + '*' : line;
            });
            out.push(...(lines.length ? lines : ['']), '');
        }
        return [ '<img src="' + logo + '" style="width:75mm; margin-left: -3mm; " />', '', '## ' + title, '', ...out ].join('\n');
    }
    // ------------------------------------------------------------


    // FUNCTION | The Section's Definition, for the Registry
    // ------------------------------------------------------------
    function Na__LeStmtHead__Definition() {
        return {
            Id            : Na__LeStmtHead__ID,
            Label         : (config) => Na__LeStmtHead__Setup(config).Label,
            Fallback      : (config) => Na__LeStmtHead__Setup(config).FallbackText,
            PlaceAfter    : () => [ 'Top' ],
            ContentsTitle : () => '',
            NewBody       : (config) => Na__LeStmtHead__Setup(config).NewFields.join('\n'),
            Unit          : 'none',                                             // <-- No divider of its own: the header's divider is the document's
            Movable       : false,
            Adopt         : Na__LeStmtHead__Adopt,
            Unwrap        : Na__LeStmtHead__Unwrap,
            Build         : Na__LeStmtHead__Build
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Standard Section: Document Header
    // ------------------------------------------------------------
    export {
        Na__LeStmtHead__ID,
        Na__LeStmtHead__Build,
        Na__LeStmtHead__Adopt,
        Na__LeStmtHead__Unwrap,
        Na__LeStmtHead__Definition
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
