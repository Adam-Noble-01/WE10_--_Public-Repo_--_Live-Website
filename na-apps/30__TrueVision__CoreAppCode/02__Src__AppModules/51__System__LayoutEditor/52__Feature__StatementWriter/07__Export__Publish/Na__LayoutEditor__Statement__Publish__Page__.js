// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - STATEMENT PUBLISH - THE PUBLISHED PAGE
// =============================================================================
//
// FILE       : Na__LayoutEditor__Statement__Publish__Page__.js
// NAMESPACE  : Na__LeStmtPubPage
// MODULE     : Layout Editor - Statement Writer - Publishing the Page
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Build the HTML page a published statement is read from, so that it is the page the app's Read view shows
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - THE PUBLISHED PAGE IS THE READ VIEW, TAKEN OUT OF THE APP. The same
//   renderer draws it, standard sections and all. What the app gave that
//   paper for free, and this page must now give it itself, is four things,
//   and a page without them was a different document (RB05, 29-Sep-2026):
//     1. THE APP'S RESET. Every element in the app starts at margin 0,
//        padding 0, border-box (Na__CoreUi__Styles__BaseLayout__.css), and
//        the document stylesheet was drawn and checked on top of it. Without
//        it every section heading took the browser's own 16px above it, every
//        table grew by 9.5px, and a full-width figure drew its frame outside
//        the column.
//     2. THE DOCUMENT STYLESHEET AS IT WAS AT PUBLISHING, written into the
//        page. Linking the live copy meant a statement published before the
//        app was pushed drew its newest sections unstyled - the Finishes
//        Comparison, the Drawing Schedule and the Document Footer on
//        29-Sep-2026 - and a later restyle could break markup an older
//        release had drawn. A published statement is a document of record:
//        it carries the styles it was checked with, and a new house style
//        reaches it when it is published again. The live copy is linked only
//        when the file could not be read at publishing.
//     3. THE FONTS. The app declares Open Sans (Na__CoreUi__Styles__Fonts__);
//        a page that declares nothing is Open Sans only where it happens to be
//        installed - this office's machines - and a stand-in everywhere else.
//     4. A4, ALWAYS. The paper is 100% wide up to 210mm, so on a phone the
//        page reflowed the A4 layout into a 390px column: the Contents' two
//        columns broke one word to a line for screen after screen, and the
//        tables and figures ran off the paper. The Read view keeps A4 and
//        shrinks it. This page does the same: a phone is told the page is
//        842px wide (A4 and the Read view's desk) and scales it to the
//        screen; a desktop window is never allowed to squeeze the paper.
// - A PICTURE KEEPS ITS SIZE. A figure is sized from its picture's own pixels
//   times its Typora zoom, and publishing sends a 2000px copy of a 6144px
//   render - so with nothing said, a figure came out smaller in exact
//   proportion (RB05 Fig 16.1, zoom 19%: 382px wide instead of 622). The
//   published copy is described to the browser by its width with the
//   original's as its size ("srcset ... 2000w", "sizes 6144px"), which is
//   the browser's own way of saying "the full-size picture, at a lower
//   resolution": the same size, the same zoom, the same frame weight.
//   A density ("srcset ... 0.3255x") does NOT do it: the browser then offers
//   the src itself as a 1x copy as well, and takes that one on every screen.
// - THE TITLE is the Document Header's Title field when the statement has
//   one (the header has not been a "#" heading since v2.162.0), then the
//   first heading, then the index entry's title.
// - PURE. It returns strings and reads nothing - the caller hands it the
//   stylesheets' text - so it runs under node in the tests.
//
// INTEGRATION:
// - Called by Na__LayoutEditor__Statement__Publish__, which reads the two
//   stylesheets from the app's own files, sends the pictures and uploads what
//   this builds.
// - Draws with the renderer the Read view uses; a standard section is drawn
//   only where the registry (09__Standard__Sections) has been imported, which
//   the statement page always has by the time anything is published.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : n/a (TrueVision3D first, 29-Sep-2026); the page shape is
//                   Na__LayoutEditor__Statement__Publish__ 1.0.0's.
// - Back-port     : offer to ValeVision3D with the statement tab.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.170.0): the page a statement is
//   published as, moved out of the publisher and given the app's reset, the
//   stylesheet written in, the fonts, A4 on every screen, pictures at their
//   own size and the header's title.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Markdown Engine
    // ------------------------------------------------------------
    import { Na__LeStmtMd__Tokenise } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Tokenise__.js';
    import { Na__LeStmtRnd__Blocks } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Render__.js';
    import { Na__LeStmtInl__Escape } from '../02__Core__Markdown/Na__LayoutEditor__Statement__Md__Inline__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Paper and the Desk
    // ------------------------------------------------------------
    // The same two numbers as the Read view (Na__LeStmtRead__PAPER_CSS_PX and
    // Na__LeStmtRead__DESK_GUTTER), which cannot be imported here without
    // bringing the whole data layer with them.
    // ------------------------------------------------------------
    const Na__LeStmtPubPage__A4_CSS_PX   = 210 / 25.4 * 96;                     // <-- 793.7, A4 across at the 96 dpi a browser lays out in
    const Na__LeStmtPubPage__DESK_GUTTER = 48;                                  // <-- The desk either side of the paper
    const Na__LeStmtPubPage__VIEWPORT_PX = Math.ceil(Na__LeStmtPubPage__A4_CSS_PX + Na__LeStmtPubPage__DESK_GUTTER);   // <-- 842
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The App's Reset
    // ------------------------------------------------------------
    // Na__CoreUi__Styles__BaseLayout__.css, word for word: the ground the
    // document stylesheet is drawn on in the app. The universal selector
    // keeps it at nought specificity, below every rule of the document's.
    // ------------------------------------------------------------
    const Na__LeStmtPubPage__RESET_CSS = [
        '* {',
        '    margin: 0;',
        '    padding: 0;',
        '    box-sizing: border-box;',
        '}'
    ].join('\n');
    // ------------------------------------------------------------


    // MODULE CONSTANTS | The Desk the Paper Lies On
    // ------------------------------------------------------------
    // Written after the document stylesheet so it has the last word. The
    // paper may never be narrower than A4: a phone scales the whole page (the
    // viewport above), a narrow desktop window scrolls, and neither reflows
    // the document. On paper the browser's printable width governs instead.
    // ------------------------------------------------------------
    const Na__LeStmtPubPage__DESK_CSS = [
        'html {',
        '    -webkit-text-size-adjust: 100%;',
        '    text-size-adjust: 100%;',
        '}',
        'body {',
        '    margin: 0;',
        '    background: #fafafa;',
        '}',
        'body > .na-le-stmt-doc {',
        '    min-width: 210mm;',
        '}',
        '@media print {',
        '    body { background: #ffffff; }',
        '    body > .na-le-stmt-doc { min-width: 0; margin: 0; box-shadow: none; }',
        '}'
    ].join('\n');
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Helpers
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Escape a String for an Attribute
    // ------------------------------------------------------------
    function Na__LeStmtPubPage__Attr(value) {
        return Na__LeStmtInl__Escape(String(value === undefined || value === null ? '' : value)).replace(/"/g, '&quot;');
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | An Attribute's Value as It Was Written
    // ------------------------------------------------------------
    // A markdown picture's link reaches the HTML escaped; the links map holds
    // it as the markdown wrote it.
    // ------------------------------------------------------------
    function Na__LeStmtPubPage__Unescape(value) {
        return String(value || '')
            .replace(/&quot;/g, '"').replace(/&#39;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Title and the Pictures
// -----------------------------------------------------------------------------

    // FUNCTION | The Statement's Title, for the Page and the File Name
    // ------------------------------------------------------------
    // The Document Header's Title field when the statement opens with the
    // standard header; the first heading in the document if there is one,
    // because that is what the writer called it; the index entry's title
    // otherwise.
    // ------------------------------------------------------------
    function Na__LeStmtPubPage__Title(markdown, record) {
        const text   = String(markdown || '');
        const header = /<div\b[^>]*\bdata-na-standard-section\s*=\s*["']DocumentHeader["'][^>]*>([\s\S]*?)<\/div>/i.exec(text);
        if (header) {
            const field = /^Title[ \t]*:[ \t]*(\S.*?)[ \t]*$/m.exec(header[1]);   // <-- At the margin: an indented line only carries a field on
            if (field) return field[1];
        }
        const heading = /^\s{0,3}#{1,6}[ \t]+(.+?)\s*#*\s*$/m.exec(text);
        if (heading && heading[1].trim()) return heading[1].trim();
        return (record && record.Doc__Title) || 'Statement';
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Smaller Copy's Own Width and Its Original's
    // ------------------------------------------------------------
    // { made, source } in whole pixels for a picture that was made smaller
    // for publishing; null for one sent as it was, which needs nothing said.
    // ------------------------------------------------------------
    function Na__LeStmtPubPage__Shrunk(link) {
        if (!link || !link.resized) return null;
        const made   = Math.round(Number(link.width));
        const source = Math.round(Number(link.sourceWidth));
        if (!(made > 0) || !(source > made)) return null;
        return { made : made, source : source };
    }
    // ------------------------------------------------------------


    // FUNCTION | Point Every Relative Picture in the HTML at Its CDN URL
    // ------------------------------------------------------------
    // links maps the link as the markdown writes it to what it was published
    // as: { url, width, sourceWidth, resized }. A link with no entry is left
    // as it stands rather than pointed at nothing: the HTML then shows a
    // broken picture where the statement has a broken link, which is the
    // truth and is findable.
    //
    // A picture that was made smaller for publishing also gets a srcset of
    // its own width and a sizes of its original's, so it lays out at the
    // original's size (see above). One that already carries either is the
    // writer's, and is left alone.
    // ------------------------------------------------------------
    function Na__LeStmtPubPage__Relink(html, links) {
        const map = links || {};
        return String(html || '').replace(/<img\b[^>]*>/gi, (tag) => {
            const src = /(\ssrc\s*=\s*")([^"]*)(")/i.exec(tag);
            if (!src) return tag;
            const found = map[src[2]] || map[Na__LeStmtPubPage__Unescape(src[2])];
            if (!found || !found.url) return tag;

            let out = tag.replace(src[0], src[1] + Na__LeStmtPubPage__Attr(found.url) + src[3]);
            const shrunk = Na__LeStmtPubPage__Shrunk(found);
            if (shrunk && !/\s(?:srcset|sizes)\s*=/i.test(out)) {
                const candidate = String(found.url).replace(/ /g, '%20').replace(/,/g, '%2C');   // <-- A srcset splits on spaces and commas
                out = out.replace(/\s*\/?>$/, (end) => ' srcset="' + Na__LeStmtPubPage__Attr(candidate + ' ' + shrunk.made + 'w') + '"'
                                                     + ' sizes="' + shrunk.source + 'px"' + end);
            }
            return out;
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Stylesheets
// -----------------------------------------------------------------------------

    // FUNCTION | A Stylesheet Made Ready to Be Written Into the Page
    // ------------------------------------------------------------
    // text  the stylesheet as it is on disk
    // base  the address it is published at, which its own relative url()s
    //       are read against - a font beside the app, never beside the page
    //
    // Its comments are taken out: they are this office's working notes, and
    // the page is a client's document. A comment's marks inside a quoted
    // string are left, being part of the string.
    // ------------------------------------------------------------
    function Na__LeStmtPubPage__PrepareCss(text, base) {
        let css = String(text || '').replace(/\r\n?/g, '\n');

        css = css.replace(/("(?:\\[\s\S]|[^"\\\n])*"|'(?:\\[\s\S]|[^'\\\n])*')|\/\*[\s\S]*?\*\//g,
            (whole, quoted) => quoted || '');

        if (base) {
            css = css.replace(/url\(\s*(["']?)([^"')]+?)\1\s*\)/gi, (whole, quote, ref) => {
                if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(ref.trim())) return whole;   // <-- Already absolute, data:, or a fragment
                try { return 'url(' + quote + new URL(ref.trim(), base).href + quote + ')'; }
                catch (error) { return whole; }
            });
        }

        return css.split('\n').map((line) => line.replace(/[ \t]+$/, '')).join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
            .replace(/<\/(style)/gi, '<\\/$1');                                 // <-- Can never close the element it is written into
    }
    // ------------------------------------------------------------


    // FUNCTION | Only the @font-face Rules of a Stylesheet
    // ------------------------------------------------------------
    function Na__LeStmtPubPage__FontFaces(css) {
        const faces = String(css || '').match(/@font-face\s*\{[^}]*\}/gi);
        return faces ? faces.join('\n\n') : '';
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Page
// -----------------------------------------------------------------------------

    // FUNCTION | Wrap the Rendered Statement in a Standalone Page
    // ------------------------------------------------------------
    // context: { title, file, projectCode, stamp, styles }
    // styles:  { fontsCss, documentCss, fontsUrl, documentUrl } - the text is
    //          written in; with no text, the published address is linked.
    //
    // The order is the app's: the fonts, the reset, the document, the desk.
    // ------------------------------------------------------------
    function Na__LeStmtPubPage__Page(bodyHtml, context) {
        const c      = context || {};
        const styles = c.styles || {};
        const stamp  = c.stamp || new Date().toISOString();
        const block  = (part, css) => '    <style data-na-style="' + part + '">\n' + css + '\n    </style>';
        const link   = (part, href) => href ? '    <link rel="stylesheet" data-na-style="' + part + '" href="' + Na__LeStmtPubPage__Attr(href) + '">' : '';

        const fonts = styles.fontsCss    ? block('fonts', styles.fontsCss)       : link('fonts', styles.fontsUrl);
        const paper = styles.documentCss ? block('document', styles.documentCss) : link('document', styles.documentUrl);

        return [
            '<!DOCTYPE html>',
            '<html lang="en">',
            '<head>',
            '    <meta charset="UTF-8">',
            '    <meta name="viewport" content="width=' + Na__LeStmtPubPage__VIEWPORT_PX + '">',
            '    <meta name="color-scheme" content="only light">',
            '    <meta name="generator" content="Noble Architecture - TrueVision Statement Writer">',
            '    <meta name="na-project-code" content="' + Na__LeStmtPubPage__Attr(c.projectCode) + '">',
            '    <meta name="na-statement" content="' + Na__LeStmtPubPage__Attr(c.file) + '">',
            '    <meta name="na-generated" content="' + Na__LeStmtPubPage__Attr(stamp) + '">',
            '    <title>' + Na__LeStmtInl__Escape(String(c.title || 'Statement')) + '</title>',
            fonts,
            block('reset', Na__LeStmtPubPage__RESET_CSS),
            paper,
            block('desk', Na__LeStmtPubPage__DESK_CSS),
            '</head>',
            '<body>',
            '<article class="na-le-stmt-doc">',
            bodyHtml,
            '</article>',
            '</body>',
            '</html>',
            ''
        ].filter((line) => line !== '').join('\n') + '\n';
    }
    // ------------------------------------------------------------


    // FUNCTION | Build the Standalone HTML for a Statement
    // ------------------------------------------------------------
    // markdown  the statement
    // record    its index entry (Doc__File, Doc__Title)
    // links     what its pictures were published as (see Relink)
    // context   { projectCode, stamp, styles } for the page
    //
    // Drawn exactly as the Read view draws it: not editable, every standard
    // section expanded with the whole document as its context.
    // ------------------------------------------------------------
    function Na__LeStmtPubPage__Build(markdown, record, links, context) {
        const body = Na__LeStmtRnd__Blocks(Na__LeStmtMd__Tokenise(markdown || ''), { Editable : false });
        return Na__LeStmtPubPage__Page(Na__LeStmtPubPage__Relink(body, links || {}), Object.assign({}, context || {}, {
            title : Na__LeStmtPubPage__Title(markdown, record),
            file  : (record && record.Doc__File) || ''
        }));
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | The Published Page API
    // ------------------------------------------------------------
    export {
        Na__LeStmtPubPage__VIEWPORT_PX,
        Na__LeStmtPubPage__RESET_CSS,
        Na__LeStmtPubPage__Title,
        Na__LeStmtPubPage__Shrunk,
        Na__LeStmtPubPage__Relink,
        Na__LeStmtPubPage__PrepareCss,
        Na__LeStmtPubPage__FontFaces,
        Na__LeStmtPubPage__Page,
        Na__LeStmtPubPage__Build
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
