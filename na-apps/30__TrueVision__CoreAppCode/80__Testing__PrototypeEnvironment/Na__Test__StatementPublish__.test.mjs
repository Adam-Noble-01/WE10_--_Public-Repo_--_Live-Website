// =============================================================================
// TRUEVISION3D - TEST - STATEMENT PUBLISH (THE PUBLISHED PAGE)
// =============================================================================
//
// FILE       : Na__Test__StatementPublish__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Statement Writer - Publishing the Page
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a published statement carries every element the Statement Writer draws, and the page around it that makes it the Read view
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - EVERY ELEMENT PUBLISHES AS ITSELF. With all six standard sections switched
//   on the way the menu switches them on - and again on RB05's statement as it
//   stands on disk - every marker is drawn as its section, once, and none is
//   left as a marker; every figure keeps its picture and its title; no editor
//   attribute reaches the page.
// - THE TITLE is the Document Header's Title field (the header has not been a
//   "#" heading since v2.162.0), then the first heading, then the index title.
// - A PICTURE KEEPS ITS SIZE: a copy made smaller for publishing carries a
//   srcset of its own width and a sizes of its original's (never a density,
//   which the browser overrules with the src at 1x); one sent as it was
//   carries nothing; a writer's own srcset is left alone.
// - THE PAGE: A4 on a phone (the viewport), the app's fonts, the app's reset
//   word for word from Na__CoreUi__Styles__BaseLayout__.css, the document
//   stylesheet written in without its comments, the desk last; and the old
//   links when the stylesheets could not be read.
//
// HOW IT RUNS THE REAL MODULES. As Na__Test__StatementStandard__: the folders
// the page module imports across are copied into a scratch tree with a
// package.json saying "module". window is a stub carrying only an address bar;
// fetch always fails, so each config falls back to its built-in defaults.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__StatementPublish__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.170.0).
//
// =============================================================================

import fs   from 'node:fs';
import os   from 'node:os';
import path from 'node:path';
import url  from 'node:url';

const here     = path.dirname(url.fileURLToPath(import.meta.url));
const appRoot  = path.resolve(here, '..');
const repoRoot = path.resolve(here, '..', '..', '..');
const SRC      = path.join(appRoot, '02__Src__AppModules');

// THE SCRATCH TREE: the same folder layout, so relative imports resolve.
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'na-stmt-pub-'));
fs.writeFileSync(path.join(SCRATCH, 'package.json'), '{ "type": "module" }\n');
for (const rel of [
    '51__System__LayoutEditor/52__Feature__StatementWriter/02__Core__Markdown',
    '51__System__LayoutEditor/52__Feature__StatementWriter/09__Standard__Sections',
    '51__System__LayoutEditor/52__Feature__StatementWriter/07__Export__Publish/Na__LayoutEditor__Statement__Publish__Page__.js',
    '51__System__LayoutEditor/52__Feature__StatementWriter/01__Core__Data/Na__LayoutEditor__Statement__Images__.js',
    '51__System__LayoutEditor/53__Feature__ProjectQrCode',
    '03__AppUtils/Na__AppUtils__ProjectLoader.js'
]) {
    fs.cpSync(path.join(SRC, rel), path.join(SCRATCH, rel), { recursive : true });
}
const load = (rel) => import(url.pathToFileURL(path.join(SCRATCH, rel)).href);

// THE ADDRESS BAR, and nothing else of a browser. No network.
globalThis.window = { location : { search : '?project=RB05&project-folder=RB05__WestFarm&year=26', hostname : 'www.noble-architecture.com', port : '' } };
globalThis.fetch  = async () => ({ ok : false, status : 404, json : async () => null });
const quiet = console.warn;
console.warn = (...args) => { if (!/unreadable/.test(String(args[0]))) quiet(...args); };

let failures = 0;
function check(name, condition, detail) {
    if (condition) { console.log('  PASS  ' + name); return; }
    failures++;
    console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
}
const count = (text, pattern) => (String(text).match(pattern) || []).length;

const STMT = '51__System__LayoutEditor/52__Feature__StatementWriter/';
const Page = await load(STMT + '07__Export__Publish/Na__LayoutEditor__Statement__Publish__Page__.js');
const Std  = await load(STMT + '09__Standard__Sections/Na__LayoutEditor__Statement__Standard__Registry__.js');   // <-- Registers the expander, as the statement page does

const SIX = [ 'DocumentHeader', 'Contents', 'TrueVisionHub', 'FinishesComparison', 'DrawingSchedule', 'DocumentFooter' ];


// -----------------------------------------------------------------------------
// REGION | The Title
// -----------------------------------------------------------------------------

console.log('\nThe title');
{
    const header = Std.Na__LeStmtStd__MarkerLine('DocumentHeader', 'Title: Design and Access Statement\nApplicant: Mr A\nSite Address:\n    1 The Street');
    check('the Document Header\'s Title field', Page.Na__LeStmtPubPage__Title(header + '\n\n### 1.0 |  Introduction\n', null) === 'Design and Access Statement');

    const indented = Std.Na__LeStmtStd__MarkerLine('DocumentHeader', 'Applicant: Mr A\n    Title: carried on, not the title\nTitle: The Real Title');
    check('an indented line carrying a field on is never taken for the title', Page.Na__LeStmtPubPage__Title(indented, null) === 'The Real Title');

    check('no header: the first heading', Page.Na__LeStmtPubPage__Title('Intro words.\n\n## My Statement\n\n### 1.0 |  Introduction\n', null) === 'My Statement');
    check('no heading: the index entry\'s title', Page.Na__LeStmtPubPage__Title('Just words.\n', { Doc__Title : 'PreApp Statement' }) === 'PreApp Statement');
    check('nothing at all: "Statement"', Page.Na__LeStmtPubPage__Title('', null) === 'Statement');
}


// -----------------------------------------------------------------------------
// REGION | The Pictures
// -----------------------------------------------------------------------------

console.log('\nThe pictures');
{
    const CDN   = 'https://cdn.noble-architecture.com/NaProjectPortal/26-Projects/X/a.webp';
    const small = { url : CDN, width : 2000, sourceWidth : 6144, resized : true };
    const shrunk = Page.Na__LeStmtPubPage__Shrunk(small);
    check('a smaller copy: its own width and its original\'s', !!shrunk && shrunk.made === 2000 && shrunk.source === 6144);
    check('nothing for a picture sent as it was', Page.Na__LeStmtPubPage__Shrunk({ url : CDN, width : 1200, sourceWidth : 1200, resized : false }) === null);
    check('nothing when the original\'s size is not known', Page.Na__LeStmtPubPage__Shrunk({ url : CDN, width : 2000, resized : true }) === null);

    const tag = '<img class="na-figure" src="./02__DocImages/a.png" style="zoom: 26%; display: block;" />';
    const out = Page.Na__LeStmtPubPage__Relink(tag, { './02__DocImages/a.png' : small });
    check('a resized picture points at the CDN', out.includes(' src="' + CDN + '"'));
    check('and is described by its own width at its original\'s size, so it lays out as the original',
          out.includes(' srcset="' + CDN + ' 2000w" sizes="6144px"'), out);
    check('never by a density, which the browser overrules with the src at 1x', !/\d+(\.\d+)?x"/.test(out));
    check('and its zoom, its class and its self-closing tag are untouched', out.includes('style="zoom: 26%; display: block;"') && out.includes('class="na-figure"') && /" \/>$/.test(out), out);

    const same = Page.Na__LeStmtPubPage__Relink(tag, { './02__DocImages/a.png' : { url : CDN, width : 900, sourceWidth : 900, resized : false } });
    check('a picture sent as it was gets no srcset', same.includes(' src="' + CDN + '"') && !same.includes('srcset') && !same.includes('sizes'));

    check('a picture with no published copy is left as the statement has it', Page.Na__LeStmtPubPage__Relink(tag, {}) === tag);

    const own = '<img src="./b.png" srcset="./b.png 2x">';
    const kept = Page.Na__LeStmtPubPage__Relink(own, { './b.png' : small });
    check('a writer\'s own srcset is not doubled, nor given a sizes', count(kept, /srcset=/g) === 1 && !kept.includes('sizes='));

    const escaped = '<img src="./c&amp;d.png">';
    check('a link that reaches the HTML escaped still finds its copy', Page.Na__LeStmtPubPage__Relink(escaped, { './c&d.png' : small }).includes(' src="' + CDN + '"'));

    const spaced = Page.Na__LeStmtPubPage__Relink('<img src="./e.png">', { './e.png' : { url : 'https://cdn.example/a b,c.webp', width : 10, sourceWidth : 20, resized : true } });
    check('a space or comma in the address cannot split the srcset', spaced.includes('srcset="https://cdn.example/a%20b%2Cc.webp 10w" sizes="20px"'), spaced);

    check('only pictures are relinked', Page.Na__LeStmtPubPage__Relink('<iframe src="./02__DocImages/a.png"></iframe>', { './02__DocImages/a.png' : small }).includes('src="./02__DocImages/a.png"'));
}


// -----------------------------------------------------------------------------
// REGION | The Web Viewer's Pictures
// -----------------------------------------------------------------------------

// The web viewer never opens the published page: it draws the published
// markdown and points each picture somewhere (Na__LeStmtImg__Apply). A page of
// fake pictures is enough to see where.
console.log('\nThe web viewer\'s pictures');
{
    const Img = await load(STMT + '01__Core__Data/Na__LayoutEditor__Statement__Images__.js');
    const picture = (src) => {
        const attrs = { src : src };
        return { attrs, getAttribute : (k) => (k in attrs ? attrs[k] : null), setAttribute : (k, v) => { attrs[k] = String(v); }, hasAttribute : (k) => k in attrs };
    };
    const page = (pictures) => ({ querySelectorAll : () => pictures });
    const BASE = 'https://cdn.noble-architecture.com/NaProjectPortal/26-Projects/RB05__WestFarm/30__TrueVision__AppContent/10__StatementDocs/01__PreApp__Statement/';
    const PUBLISHED = [
        { Img__Src : './02__DocImages/02__Site__Location/Location__Near__.png', Img__Url : BASE + '02__DocImages/02__Site__Location/Location__Near__.webp',
          Img__Width : 2000, Img__SourceWidth : 2390 },
        { Img__Src : './02__DocImages/ExistingSitePlan.jpg', Img__Url : BASE + '02__DocImages/ExistingSitePlan.jpg', Img__Width : 1200, Img__SourceWidth : 1200 },
        { Img__Src : './02__DocImages/Older.png', Img__Url : BASE + '02__DocImages/Older.webp' }                     // <-- Published before sizes were recorded
    ];
    const resized = picture('./02__DocImages/02__Site__Location/Location__Near__.png');
    const same    = picture('./02__DocImages/ExistingSitePlan.jpg');
    const older   = picture('./02__DocImages/Older.png');
    const absent  = picture('./02__DocImages/NotYetPublished.png');
    const outside = picture('https://cdn.noble-architecture.com/elsewhere.webp');
    Img.Na__LeStmtImg__Apply(page([ resized, same, older, absent, outside ]), BASE, '01__PreApp__Statement', [], PUBLISHED);

    check('a resized picture is shown from its published copy, not its original (the 404s on the live site)',
          resized.attrs.src === BASE + '02__DocImages/02__Site__Location/Location__Near__.webp', resized.attrs.src);
    check('and keeps its original\'s size', resized.attrs.srcset === BASE + '02__DocImages/02__Site__Location/Location__Near__.webp 2000w' && resized.attrs.sizes === '2390px');
    check('and can be drawn into a PDF', resized.attrs.crossorigin === 'anonymous');
    check('a picture sent as it was is shown from its copy, with nothing more', same.attrs.src === BASE + '02__DocImages/ExistingSitePlan.jpg' && !('srcset' in same.attrs) && !('sizes' in same.attrs));
    check('a copy published before sizes were recorded is still found', older.attrs.src === BASE + '02__DocImages/Older.webp' && !('srcset' in older.attrs));
    check('a picture the index does not list falls back to the folder, as before', absent.attrs.src === BASE + '02__DocImages/NotYetPublished.png');
    check('an absolute link is the writer\'s own, and is left alone', outside.attrs.src === 'https://cdn.noble-architecture.com/elsewhere.webp' && !('crossorigin' in outside.attrs));

    const local = picture('./02__DocImages/02__Site__Location/Location__Near__.png');
    Img.Na__LeStmtImg__Apply(page([ local ]), 'http://localhost:8090/project/10__StatementDocs/01__PreApp__Statement/', '01__PreApp__Statement', []);
    check('with no published list (this machine) the original in the project folder is shown, as before',
          local.attrs.src === 'http://localhost:8090/project/10__StatementDocs/01__PreApp__Statement/02__DocImages/02__Site__Location/Location__Near__.png' && !('srcset' in local.attrs));

    const escaped = picture('./02__DocImages/a&b.png');
    Img.Na__LeStmtImg__Apply(page([ escaped ]), BASE, '01__PreApp__Statement', [], [ { Img__Src : './02__DocImages/a&amp;b.png', Img__Url : BASE + 'x.webp' } ]);
    check('a link written with &amp; in the markdown still finds its copy', escaped.attrs.src === BASE + 'x.webp');

    // THE READER passes the list off localhost only - by the same test that sends the base to the CDN
    const reader    = fs.readFileSync(path.join(SRC, STMT, '05__Ui__Reader', 'Na__LayoutEditor__Statement__Reader__.js'), 'utf8');
    const transport = fs.readFileSync(path.join(SRC, STMT, '01__Core__Data', 'Na__LayoutEditor__Statement__Data__Transport__.js'), 'utf8');
    check('the reader hands the index\'s copies over off localhost, and only there',
          /const published\s*=\s*\(record && !Na__AppUtils__IsRunningOnLocalhost\(\)\) \? record\.Doc__Images : null;/.test(reader) &&
          /Na__LeStmtImg__Apply\(.*, published\);/.test(reader));
    check('by the same test that points its pictures at the CDN', /Na__AppUtils__IsRunningOnLocalhost\(\) \? location\.repoUrl : location\.cdnUrl/.test(transport));

    // THE PUBLISHER records what the reader needs
    const runner = fs.readFileSync(path.join(SRC, STMT, '07__Export__Publish', 'Na__LayoutEditor__Statement__Publish__.js'), 'utf8');
    check('the index records every copy\'s width and its original\'s',
          /Img__Width\s*:\s*pictures\.links\[src\]\.width/.test(runner) && /Img__SourceWidth\s*:\s*pictures\.links\[src\]\.sourceWidth/.test(runner));
}


// -----------------------------------------------------------------------------
// REGION | The Stylesheets
// -----------------------------------------------------------------------------

console.log('\nThe stylesheets');
{
    const css = '/* a working note, quoting nobody */\r\n.a { content: "/* kept */"; color: red; }\n\n\n\n/* two */\n'
              + '@font-face { font-family: "Open Sans"; src: url(\'../../fonts/x.ttf\') format("truetype"), url("https://abs.example/x.ttf"); }\n'
              + '.b { background: url(data:image/png;base64,AA==); mask: url(#m); }\n.c::after { content: "</style>"; }\n';
    const base = 'https://www.noble-architecture.com/na-apps/30__TrueVision__CoreAppCode/03__Style__AppStylesheets/Na__CoreUi__Styles__Fonts__.css';
    const out  = Page.Na__LeStmtPubPage__PrepareCss(css, base);
    check('comments are taken out', !out.includes('working note') && !out.includes('/* two */'));
    check('a comment\'s marks inside a string are kept', out.includes('content: "/* kept */"'));
    check('a relative address is read against where the stylesheet is published',
          out.includes('url(\'https://www.noble-architecture.com/na-apps/fonts/x.ttf\')'), out);
    check('absolute, data: and fragment addresses are left alone',
          out.includes('url("https://abs.example/x.ttf")') && out.includes('url(data:image/png;base64,AA==)') && out.includes('url(#m)'));
    check('nothing in it can close the <style> it is written into', !/<\/style/i.test(out));
    check('no carriage returns and no run of blank lines', !out.includes('\r') && !/\n\n\n/.test(out));
    check('with no published address a relative url is left as written', Page.Na__LeStmtPubPage__PrepareCss(css, null).includes('url(\'../../fonts/x.ttf\')'));

    const faces = Page.Na__LeStmtPubPage__FontFaces(out);
    check('only the @font-face rules of the fonts stylesheet are kept', faces.startsWith('@font-face') && !faces.includes('.a {') && count(faces, /@font-face/g) === 1);

    // THE REAL FONTS FILE, as the publisher reads it
    const fontsFile = fs.readFileSync(path.join(appRoot, '03__Style__AppStylesheets', 'Na__CoreUi__Styles__Fonts__.css'), 'utf8');
    const realFaces = Page.Na__LeStmtPubPage__FontFaces(Page.Na__LeStmtPubPage__PrepareCss(fontsFile, base));
    const weights   = (realFaces.match(/font-weight\s*:\s*(\d+)/g) || []).map((one) => one.replace(/\D/g, '')).sort().join(',');
    check('the app\'s own fonts file gives every weight it declares (' + weights + ')', weights === '300,400,500,600', realFaces.slice(0, 400));
    check('and every one of them is loaded from the website, never beside the page',
          !/url\(\s*['"]?\.\.?\//.test(realFaces) && count(realFaces, /https:\/\/www\.noble-architecture\.com\/na-apps\/01__Assets__NaApps__CommonAssets\/NaApps__CommonFonts\/CommonFont-01__OpenSans__/g) >= 4);

    // THE RESET, word for word the app's
    const base2   = fs.readFileSync(path.join(appRoot, '03__Style__AppStylesheets', 'Na__CoreUi__Styles__BaseLayout__.css'), 'utf8');
    const rule    = /(^|\n)\*\s*\{([^}]*)\}/.exec(base2);
    const decls   = (text) => text.split(';').map((one) => one.replace(/\s+/g, '')).filter(Boolean).sort().join(';');
    const ours    = /\*\s*\{([^}]*)\}/.exec(Page.Na__LeStmtPubPage__RESET_CSS);
    check('the reset is the app\'s own, declaration for declaration', !!rule && !!ours && decls(rule[2]) === decls(ours[1]),
          (rule && decls(rule[2])) + '  vs  ' + (ours && decls(ours[1])));
}


// -----------------------------------------------------------------------------
// REGION | The Page
// -----------------------------------------------------------------------------

console.log('\nThe page');
{
    const styles = { fontsCss : '@font-face { font-family: "Open Sans"; }', documentCss : '.na-le-stmt-doc { color: #3c3c3c; }',
                     fontsUrl : 'https://www.example/fonts.css', documentUrl : 'https://www.example/document.css' };
    const html = Page.Na__LeStmtPubPage__Page('<p>Body</p>', { title : 'A & B', file : 'X.md', projectCode : 'RB05', stamp : '2026-09-29T20:00:00.000Z', styles });
    const at   = (needle) => html.indexOf(needle);

    check('a phone lays the page out A4 wide (842px) and scales it, as the Read view does', html.includes('<meta name="viewport" content="width=842">') && Page.Na__LeStmtPubPage__VIEWPORT_PX === 842);
    check('the fonts, the reset, the document, the desk - in that order',
          at('data-na-style="fonts"') > 0 && at('data-na-style="fonts"') < at('data-na-style="reset"') &&
          at('data-na-style="reset"') < at('data-na-style="document"') && at('data-na-style="document"') < at('data-na-style="desk"'));
    check('the stylesheets given as text are written in, and nothing is linked', html.includes('.na-le-stmt-doc { color: #3c3c3c; }') && !html.includes('<link'));
    check('the paper is never narrower than A4 on a screen, and the printer decides on paper',
          /body > \.na-le-stmt-doc \{\s*min-width: 210mm;/.test(html) && /@media print[\s\S]*min-width: 0/.test(html));
    check('text is never enlarged by a phone', html.includes('-webkit-text-size-adjust: 100%;') && html.includes('text-size-adjust: 100%;'));
    check('the title is escaped, and the stamp and code are written', html.includes('<title>A &amp; B</title>') && html.includes('content="2026-09-29T20:00:00.000Z"') && html.includes('content="RB05"'));
    check('the statement sits on one A4 paper', /<article class="na-le-stmt-doc">\n<p>Body<\/p>\n<\/article>/.test(html));

    const linked = Page.Na__LeStmtPubPage__Page('<p>Body</p>', { title : 'T', styles : { fontsUrl : 'https://www.example/fonts.css', documentUrl : 'https://www.example/document.css' } });
    check('stylesheets that could not be read are linked from where they are published',
          linked.includes('<link rel="stylesheet" data-na-style="fonts" href="https://www.example/fonts.css">') &&
          linked.includes('<link rel="stylesheet" data-na-style="document" href="https://www.example/document.css">') &&
          linked.indexOf('data-na-style="reset"') < linked.indexOf('data-na-style="document"'));
}


// -----------------------------------------------------------------------------
// REGION | Every Element the Statement Writer Draws
// -----------------------------------------------------------------------------

// WHAT A PUBLISHED PAGE MUST NEVER HOLD: a marker left undrawn, the editor's
// wrappers and attributes, or a picture still pointing beside the markdown.
function Clean(html, label) {
    check(label + ': no marker is left undrawn', !html.includes('na-le-stmt-std-marker'));
    check(label + ': nothing of the editor reaches the page',
          !/data-na-stmt-src|data-na-stmt-mark|contenteditable|na-le-stmt-frozen/.test(html));
}

console.log('\nAll six standard sections, switched on as the menu switches them on');
{
    let md = [
        '### 1.0 |  Introduction',
        '',
        'The words of the introduction.',
        '',
        '#### 1.1 |  Materials',
        '',
        '| <span style="display:inline-block; width:30mm;">Building Element</span> | <span style="display:inline-block; width:60mm;">Existing Materials</span> | Proposed Materials |',
        '| :--- | :--- | :--- |',
        '| **Walls** | Red brick | Brick to match the existing |',
        '| **Roof** | Not applicable | Slate [TO CONFIRM: supplier] |',
        '',
        '<figure class="na-figure-block" style="margin-left: auto; margin-right: auto;">',
        '<img class="na-figure" src="./02__DocImages/a.png" style="zoom: 30%; display: block; margin-left: auto; margin-right: auto;" />',
        '<figcaption class="na-figure-title"><strong>Fig 1.1  -</strong>  A Picture</figcaption>',
        '</figure>',
        '',
        '<figure class="na-figure-block">',
        '<img class="na-figure" src="./02__DocImages/b.png" style="zoom: 50%;" />',
        '<figcaption class="na-figure-title" hidden><strong>Fig 1.2  -</strong>  A Title Switched Off</figcaption>',
        '</figure>',
        '',
        '### 2.0 |  Conclusion',
        '',
        'The words of the conclusion.',
        ''
    ].join('\n');
    for (const id of SIX) md = Std.Na__LeStmtStd__InsertInto(md, id);
    const carried = SIX.filter((id) => md.includes('data-na-standard-section="' + id + '"'));
    check('the sample carries all six markers', carried.length === 6, 'carried: ' + carried.join(','));

    const links = { './02__DocImages/a.png' : { url : 'https://cdn.example/a.webp', width : 2000, sourceWidth : 6144, resized : true },
                    './02__DocImages/b.png' : { url : 'https://cdn.example/b.png',  width : 800,  sourceWidth : 800,  resized : false } };
    const html  = Page.Na__LeStmtPubPage__Build(md, { Doc__File : 'X.md', Doc__Title : 'Index Title' }, links, { stamp : 'S', styles : {} });
    const body  = html.slice(html.indexOf('<article'));

    for (const id of SIX) {
        check(id + ' is drawn, once', count(body, new RegExp('data-na-standard-section="' + id + '"', 'g')) === 1);
    }
    Clean(body, 'the sample');
    check('the header draws its title and its fields', /<h2 class="na-le-stmt-std-head__title">Design and Access Statement<\/h2>/.test(body) && body.includes('na-le-stmt-std-head__field'));
    check('the page takes the header\'s title', html.includes('<title>Design and Access Statement</title>'));
    check('the Contents lists the document\'s own sections', /na-le-stmt-std-toc[\s\S]*Introduction[\s\S]*Conclusion/.test(body));
    check('the hub draws its code and its link', body.includes('<svg') && body.includes('/q/?RB05'));
    check('the Finishes Comparison draws the table it wraps, element by element, and no pipe row is left',
          count(body, /na-le-stmt-std-fin__item/g) >= 2 && !/\|\s*:?-{3,}/.test(body));
    check('its [TO CONFIRM] is lifted out as a note', /class="[^"]*na-le-stmt-std-fin__confirm[^"]*"[^>]*>[\s\S]{0,200}supplier/.test(body));
    check('the Drawing Schedule draws its own table', body.includes('na-le-stmt-std-sched'));
    check('the Document Footer closes the page', body.includes('na-le-stmt-std-foot') && body.lastIndexOf('data-na-standard-section="DocumentFooter"') > body.lastIndexOf('data-na-standard-section="DrawingSchedule"'));
    check('both figures publish with their titles', count(body, /<figure class="na-figure-block"/g) === 2 && count(body, /<figcaption class="na-figure-title"/g) === 2);
    check('a title switched off stays off', /<figcaption class="na-figure-title" hidden>/.test(body));
    check('the resized picture keeps its size; the one sent as it was needs nothing',
          body.includes('src="https://cdn.example/a.webp"') && body.includes('srcset="https://cdn.example/a.webp 2000w" sizes="6144px"') &&
          body.includes('src="https://cdn.example/b.png"') && count(body, /srcset=/g) === 1);
    check('no picture still points beside the markdown', !body.includes('./02__DocImages/'));
}

console.log('\nRB05\'s statement, as it stands on disk');
{
    const file = path.join(repoRoot, 'na-project-portal', '26-Projects', 'RB05__WestFarm', '30__TrueVision__AppContent', '10__StatementDocs',
                           '01__PreApp__Statement', 'RB05_T01_S01__WestFarm__PreApplicationStatement__.md');
    if (!fs.existsSync(file)) {
        console.log('  SKIP  RB05\'s statement is not on this machine');
    } else {
        const md    = fs.readFileSync(file, 'utf8');
        const ids   = SIX.filter((id) => md.includes('data-na-standard-section="' + id + '"'));
        const links = {};
        for (const match of md.matchAll(/<img\b[^>]*?\bsrc\s*=\s*"(\.\/[^"]+)"/g)) {
            links[match[1]] = { url : 'https://cdn.example/' + encodeURI(match[1].slice(2)), width : 2000, sourceWidth : 6144, resized : true };
        }
        const html = Page.Na__LeStmtPubPage__Build(md, { Doc__File : path.basename(file), Doc__Title : 'PreApp Statement' }, links, { stamp : 'S', styles : {} });
        const body = html.slice(html.indexOf('<article'));

        console.log('        (' + ids.length + ' standard sections, ' + count(md, /<figure\b/g) + ' figures, ' + Object.keys(links).length + ' linked pictures)');
        for (const id of ids) check(id + ' is drawn, once', count(body, new RegExp('data-na-standard-section="' + id + '"', 'g')) === 1);
        Clean(body, 'RB05');
        check('every figure publishes, with its title', count(body, /<figure class="na-figure-block"/g) === count(md, /<figure class="na-figure-block"/g) &&
              count(body, /<figcaption\b/g) === count(md, /<figcaption\b/g));
        check('every divider and every policy panel publishes', count(body, /Horizontal Page Divider Line/g) === count(md, /Horizontal Page Divider Line/g) &&
              count(body, /Policy Provision Panel/gi) === count(md, /Policy Provision Panel/gi));
        check('every picture the statement links points at its published copy, at its own size',
              !body.includes('src="./') && count(body, /srcset="https:\/\/cdn\.example\/[^"]* 2000w" sizes="6144px"/g) === count(body, /<img\b[^>]*src="https:\/\/cdn\.example\//g));
        if (ids.includes('DocumentHeader')) {
            const title = /<h2 class="na-le-stmt-std-head__title">([^<]*)<\/h2>/.exec(body);
            check('the page is titled as the header is (' + (title ? title[1] : '?') + ')', !!title && html.includes('<title>' + title[1] + '</title>'));
        }
    }
}


// -----------------------------------------------------------------------------
// REGION | Done
// -----------------------------------------------------------------------------

fs.rmSync(SCRATCH, { recursive : true, force : true });
console.log('\n' + (failures ? failures + ' check(s) FAILED' : 'All checks passed'));
process.exit(failures ? 1 : 0);
