// =============================================================================
// TRUEVISION3D - TEST - STATEMENT FIGURE TITLES
// =============================================================================
//
// FILE       : Na__Test__StatementFigureTitle__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Statement Writer - A Picture and Its Title as One Block
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a figure's title lives inside the figure, switches on and off, and old captions are taken in whole
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - WHAT THIS GUARDS. A figure's title used to be a paragraph faked into
//   place under the picture with a zero-width space and two tabs; now the
//   picture and its title are one <figure> (Md__Figure). These checks prove
//   the markup the module writes is one block the tokeniser keeps whole,
//   that every rewrite of the picture keeps the figure and the blank lines
//   under it, that a title switched off is kept, that taking in old captions
//   changes nothing else in a document, and that the real RB05 statement -
//   converted or not - comes out one block per figure.
// - WHERE THE LAYOUT IS PROVED. Whether the title actually lines up with the
//   picture is a question for a browser, not node: that was measured in the
//   app on all 23 of RB05's figures, in Edit, Read and the PDF (DEVLOG).
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__StatementFigureTitle__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================

import fs   from 'node:fs';
import os   from 'node:os';
import path from 'node:path';
import url  from 'node:url';

const here     = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

// THE MARKDOWN FOLDER IS COPIED WHOLE, beside a package.json that makes node
// read .js as a module: Md__Figure imports its neighbours by their own names.
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'na-stmt-fig-'));
const MD_DIR  = path.join(here, '..', '02__Src__AppModules', '51__System__LayoutEditor',
                          '52__Feature__StatementWriter', '02__Core__Markdown');
for (const name of fs.readdirSync(MD_DIR)) {
    if (name.endsWith('.js')) fs.copyFileSync(path.join(MD_DIR, name), path.join(SCRATCH, name));
}
fs.writeFileSync(path.join(SCRATCH, 'package.json'), '{ "type": "module" }\n');
const load = (name) => import(url.pathToFileURL(path.join(SCRATCH, name)).href);

const Fig = await load('Na__LayoutEditor__Statement__Md__Figure__.js');
const { Na__LeStmtMd__Tokenise, Na__LeStmtMd__Join } = await load('Na__LayoutEditor__Statement__Md__Tokenise__.js');

let failures = 0;
function check(name, condition, detail) {
    if (condition) { console.log('  PASS  ' + name); return; }
    failures++;
    console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
}


// -----------------------------------------------------------------------------
// REGION | Specimens
// -----------------------------------------------------------------------------

const PICTURE = '<img class="na-figure" src="./02__DocImages/02__Site__Location/Location__Near__.png" style="zoom: 26%; display: block; margin-left: auto; margin-right: auto;" />';
const CROPPED = '<div class="na-figure" style="zoom: 100%; display: block; overflow: hidden; box-sizing: content-box; width: 124.08mm; height: 112.14mm; margin-left: auto; margin-right: auto;">\n'
              + '    <img src="./a/Location__Near__.png" style="display: block; max-width: none; width: 164.56mm;" />\n'
              + '</div>';
const OLD_CAPTION = '​\t\t**Fig 3.1  -**  Site Location  -  Local Context To Woodhouse Eaves And Deans Lane';

const RB05 = path.join(repoRoot, 'na-project-portal', '26-Projects', 'RB05__WestFarm', '30__TrueVision__AppContent',
                       '10__StatementDocs', '01__PreApp__Statement', 'RB05_T01_S01__WestFarm__PreApplicationStatement__.md');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Checks
// -----------------------------------------------------------------------------

console.log('\nSTATEMENT FIGURE TITLES\n');

console.log('Switching a title on');
const titled = Fig.Na__LeStmtFigMd__SetTitle(PICTURE + '\n', true, Fig.Na__LeStmtFigMd__CaptionToHtml(OLD_CAPTION));
const lines  = titled.split('\n');
check('a bare picture is wrapped in a figure', /^<figure class="na-figure-block"/.test(lines[0]), lines[0]);
check('the picture line is the picture, untouched', lines[1] === PICTURE, lines[1]);
check('the old caption loses its fake indent and keeps its bold',
      lines[2] === '<figcaption class="na-figure-title"><strong>Fig 3.1  -</strong>  Site Location  -  Local Context To Woodhouse Eaves And Deans Lane</figcaption>', lines[2]);
check('the blank line under the block is kept', titled.endsWith('</figure>\n'), JSON.stringify(titled.slice(-20)));
const blocks = Na__LeStmtMd__Tokenise(titled + 'Next paragraph.\n');
check('the figure is ONE raw HTML block', blocks[0].Kind === 'html' && blocks[0].Html.split('\n').length === 4 && blocks[1].Kind === 'paragraph',
      blocks.map((b) => b.Kind).join(','));
check('the figure carries the picture\'s centring', /style="margin-left: auto; margin-right: auto;"/.test(lines[0]), lines[0]);
check('switching on again changes nothing', Fig.Na__LeStmtFigMd__SetTitle(titled, true) === titled);

console.log('\nSwitching it off and back on');
const off = Fig.Na__LeStmtFigMd__SetTitle(titled, false);
check('off hides the title and keeps its words', /<figcaption class="na-figure-title" hidden><strong>Fig 3\.1/.test(off), off.split('\n')[2]);
check('off reads as not shown', Fig.Na__LeStmtFigMd__TitleState(off).Shown === false && Fig.Na__LeStmtFigMd__TitleState(off).Has === true);
check('on again is the figure it was, character for character', Fig.Na__LeStmtFigMd__SetTitle(off, true) === titled);
check('a class containing "hidden" is not the attribute',
      Fig.Na__LeStmtFigMd__TitleState('<figure>\n' + PICTURE + '\n<figcaption class="x hidden-y">t</figcaption>\n</figure>').Shown === true);
check('a bare picture switched off is left alone', Fig.Na__LeStmtFigMd__SetTitle(PICTURE, false) === PICTURE);

console.log('\nThe picture inside the figure');
const moved = Fig.Na__LeStmtFigMd__MapBody(titled, (picture) => picture.replace('margin-left: auto; margin-right: auto', 'margin-left: auto; margin-right: 0'));
check('a picture justified right moves the figure right', moved.split('\n')[0].includes('margin-left: auto; margin-right: 0;'), moved.split('\n')[0]);
check('the title comes through a picture rewrite', moved.split('\n')[2] === lines[2]);
check('and the blank line under it', moved.endsWith('</figure>\n'));
const cropped = Fig.Na__LeStmtFigMd__MapBody(titled, () => CROPPED);
check('a cropped frame is held inside the figure as one block',
      Na__LeStmtMd__Tokenise(cropped + 'After.\n').filter((b) => b.Kind === 'html').length === 1, cropped);
check('Parts reads the cropped frame back out whole', Fig.Na__LeStmtFigMd__Parts(cropped).Body === CROPPED);
check('a picture that is not wrapped is handed over whole', Fig.Na__LeStmtFigMd__MapBody(PICTURE + '\n', (p) => p) === PICTURE + '\n');

console.log('\nNew words in a title');
const retitled = Fig.Na__LeStmtFigMd__WriteTitle(titled, '<strong>Fig 3.9  -</strong>  $& $1 costs');
check('only the words between the figcaption tags change', retitled.split('\n')[2] === '<figcaption class="na-figure-title"><strong>Fig 3.9  -</strong>  $& $1 costs</figcaption>'
      && retitled.split('\n')[1] === PICTURE, retitled.split('\n')[2]);
const dropped = Fig.Na__LeStmtFigMd__Wrap('<img class="na-figure" src="./02__DocImages/My%20Site_Photo-01.jpg" style="zoom: 30%;" />');
check('a new figure is titled from its file name', dropped.includes('<strong>Fig  -</strong>  My Site Photo 01</figcaption>'), dropped);

console.log('\nWhat counts as an old caption');
check('a bold Fig behind a zero-width space and tabs', Fig.Na__LeStmtFigMd__IsCaption(OLD_CAPTION));
check('a bold Fig behind spaces', Fig.Na__LeStmtFigMd__IsCaption('   **Fig 3.2  -**  The Application Site'));
check('NOT a sentence that starts with "Figure"', !Fig.Na__LeStmtFigMd__IsCaption('Figure 8.1 sets the scene. The barn at SE02 fills the left of the view.'));

console.log('\nTaking in old captions across a document');
const LEGACY = [
    '# 3.0 |  The Site', '', 'Some text.', '', '',
    PICTURE, '', OLD_CAPTION, '', '',
    '#### 3.2 |  Next', '', 'Figure 3.1 above shows the site. It is prose, not a caption.', '',
    CROPPED, '', '   **Fig 3.2  -**  The Application Site  -  Three Spaces In Front', '',
    '<img src="./logo.png" style="zoom: 20%;" />', '', 'A picture with no caption under it stays a bare picture.', ''
].join('\n');
const adopted = Fig.Na__LeStmtFigMd__AdoptCaptions(LEGACY);
check('both captioned pictures are taken in, the logo is not', adopted.Count === 2, adopted.Count + ' taken');
check('the prose "Figure 3.1 above..." is left where it is', adopted.Markdown.includes('\n\nFigure 3.1 above shows the site.'));
const unwrapped = adopted.Markdown
    .replace(/<figure class="na-figure-block"[^>]*>\n/g, '')
    .replace(/\n<figcaption class="na-figure-title">[\s\S]*?<\/figcaption>\n<\/figure>/g, '');
const stripped  = LEGACY.replace(/\n\n[​\s]*\*\*Fig [^\n]*/g, '');
check('nothing outside the figures changed', unwrapped === stripped, JSON.stringify(unwrapped));
check('the spacing under each caption is kept under its figure', adopted.Markdown.includes('</figure>\n\n\n#### 3.2'));
check('a second pass takes in nothing', Fig.Na__LeStmtFigMd__AdoptCaptions(adopted.Markdown).Count === 0);

console.log('\nThe real RB05 statement (converted 29-Sep-2026, or not yet)');
if (!fs.existsSync(RB05)) {
    console.log('  SKIP  RB05 statement not found at ' + RB05);
} else {
    const text    = fs.readFileSync(RB05, 'utf8');
    const result  = Fig.Na__LeStmtFigMd__AdoptCaptions(text);
    const figures = Na__LeStmtMd__Tokenise(result.Markdown).filter((b) => b.Kind === 'html' && /^<figure\b/.test(b.Html));
    check('every figure is one block (' + figures.length + ', at least 23)', figures.length >= 23
          && figures.every((b) => b.Html.split('\n').length >= 4 && /<\/figure>$/.test(b.Html)), figures.length + ' figures');
    check('no old caption is left directly under a picture',
          !Na__LeStmtMd__Tokenise(result.Markdown).some((b, i, all) => b.Kind === 'paragraph' && Fig.Na__LeStmtFigMd__IsCaption(b.Text)
              && all[i - 1] && all[i - 1].Kind === 'html' && Fig.Na__LeStmtFigMd__IsPicture(all[i - 1].Html)));
    check('the result still round-trips byte for byte', Na__LeStmtMd__Join(Na__LeStmtMd__Tokenise(result.Markdown)) === result.Markdown);
    check('a second pass takes in nothing', Fig.Na__LeStmtFigMd__AdoptCaptions(result.Markdown).Count === 0);
}

// endregion -------------------------------------------------------------------


fs.rmSync(SCRATCH, { recursive : true, force : true });
console.log(failures ? '\n' + failures + ' CHECK(S) FAILED\n' : '\nALL CHECKS PASSED\n');
process.exit(failures ? 1 : 0);
