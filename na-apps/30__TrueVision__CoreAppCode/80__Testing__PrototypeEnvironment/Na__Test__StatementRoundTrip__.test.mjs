// =============================================================================
// TRUEVISION3D - TEST - STATEMENT MARKDOWN ROUND TRIP
// =============================================================================
//
// FILE       : Na__Test__StatementRoundTrip__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Statement Writer - Markdown Round Trip
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a statement survives being read and written back untouched
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - THE ONE PROMISE THE STATEMENT WRITER MAKES ABOUT SOMEONE ELSE'S FILE:
//   opening a statement and saving it without typing anything writes back the
//   file it opened, byte for byte. Blank lines, trailing whitespace inside the
//   divider blocks, the zero-width spaces in front of every figure caption and
//   the superscript in "20th September" all come back exactly as they were.
// - The real RB05 pre-application statement is the specimen, because a file
//   invented for a test proves only that the test was written to pass.
// - It also checks the shapes the tokeniser is supposed to find in that file:
//   the raw HTML blocks must come out whole, the headings must be found, and
//   no divider must be cut in half.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__StatementRoundTrip__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================

import fs   from 'node:fs';
import os   from 'node:os';
import path from 'node:path';
import url  from 'node:url';

const here     = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');

// THE MODULE UNDER TEST is an app .js file, which node reads as CommonJS
// because the app ships no package.json. It is copied to a scratch .mjs and
// imported from there - the pattern every other test in this folder uses.
const SCRATCH  = fs.mkdtempSync(path.join(os.tmpdir(), 'na-stmt-'));
const MD_DIR   = path.join(here, '..', '02__Src__AppModules', '51__System__LayoutEditor',
                           '52__Feature__StatementWriter', '02__Core__Markdown');

function LoadUnit(fileName, asName) {
    const target = path.join(SCRATCH, asName);
    fs.copyFileSync(path.join(MD_DIR, fileName), target);
    return import(url.pathToFileURL(target).href);
}

const {
    Na__LeStmtMd__Tokenise,
    Na__LeStmtMd__Join,
    Na__LeStmtMd__TrailingBlanks
} = await LoadUnit('Na__LayoutEditor__Statement__Md__Tokenise__.js', 'Tokenise.mjs');

let failures = 0;
function check(name, condition, detail) {
    if (condition) { console.log('  PASS  ' + name); return; }
    failures++;
    console.log('  FAIL  ' + name + (detail ? '\n        ' + detail : ''));
}


// -----------------------------------------------------------------------------
// REGION | Specimens
// -----------------------------------------------------------------------------

const specimens = [
    path.join(repoRoot, 'na-project-portal', '26-Projects', 'RB05__WestFarm', '30__TrueVision__AppContent',
              '10__StatementDocs', '01__PreApp__Statement', 'RB05_T01_S01__WestFarm__PreApplicationStatement__.md'),
    path.join(repoRoot, 'na-project-portal', '26-Projects', 'RB05__WestFarm', '30__TrueVision__AppContent',
              '10__StatementDocs', '01__PreApp__Statement', 'RB05_T01_N01__WestFarm__ProjectNotes__.md')
];

// SYNTHETIC CASES | The shapes the real files do not happen to contain
const synthetic = [
    [ 'empty file',            '' ],
    [ 'one line, no newline',  'Just a line' ],
    [ 'trailing newline',      'A paragraph.\n' ],
    [ 'many blank lines',      'One.\n\n\n\n\nTwo.\n' ],
    [ 'front matter',          '---\ntitle: X\n---\n\nBody.\n' ],
    [ 'table',                 '| A | B |\n| --- | :-: |\n| 1 | 2 |\n\nAfter.\n' ],
    [ 'fenced code',           'Before.\n\n```js\nconst a = 1;\n```\n\nAfter.\n' ],
    [ 'nested list',           '- One\n  - Two\n- Three\n\nAfter.\n' ],
    [ 'ordered list',          '1. One\n2. Two\n\nAfter.\n' ],
    [ 'block quote',           '> Quoted.\n> More.\n\nAfter.\n' ],
    [ 'horizontal rule',       'A.\n\n---\n\nB.\n' ],
    [ 'html comment',          '<!-- a note -->\n\nBody.\n' ],
    [ 'void img',              '<img src="a.png" />\n\nCaption.\n' ],
    [ 'nested div',            '<div style="a">\n  <div style="b">\n  </div>\n</div>\n\nAfter.\n' ],
    [ 'windows-ish spacing',   'A.  \nB.  \n\nC.\n' ],
    [ 'no trailing newline',   '# Head\n\nBody, no newline at end.' ]
];

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Checks
// -----------------------------------------------------------------------------

console.log('\nSTATEMENT MARKDOWN ROUND TRIP\n');

console.log('Synthetic cases');
for (const [ name, text ] of synthetic) {
    const back = Na__LeStmtMd__Join(Na__LeStmtMd__Tokenise(text));
    check(name, back === text, 'expected ' + JSON.stringify(text) + '\n        got      ' + JSON.stringify(back));
}

console.log('\nReal statements');
for (const file of specimens) {
    if (!fs.existsSync(file)) {
        console.log('  SKIP  ' + path.basename(file) + ' (not on this machine)');
        continue;
    }
    const text   = fs.readFileSync(file, 'utf8');
    const blocks = Na__LeStmtMd__Tokenise(text);
    const back   = Na__LeStmtMd__Join(blocks);

    let firstDiff = -1;
    if (back !== text) {
        const limit = Math.min(back.length, text.length);
        for (let at = 0; at < limit; at++) { if (back[at] !== text[at]) { firstDiff = at; break; } }
        if (firstDiff === -1) firstDiff = limit;
    }

    check(path.basename(file) + ' - byte for byte (' + text.length + ' bytes, ' + blocks.length + ' blocks)',
          back === text,
          firstDiff === -1 ? '' :
          'first difference at byte ' + firstDiff +
          '\n        file: ' + JSON.stringify(text.slice(Math.max(0, firstDiff - 60), firstDiff + 60)) +
          '\n        back: ' + JSON.stringify(back.slice(Math.max(0, firstDiff - 60), firstDiff + 60)));

    // THE SHAPES | What the tokeniser should have found in this file
    const kinds = {};
    for (const block of blocks) kinds[block.Kind] = (kinds[block.Kind] || 0) + 1;
    console.log('        blocks: ' + Object.entries(kinds).map(([ k, v ]) => k + ' ' + v).join(', '));

    // Every raw HTML block must be whole: its opening tag balanced by a close,
    // or a single void tag. A divider cut in half is the failure this catches.
    const htmlBlocks = blocks.filter((block) => block.Kind === 'html');
    const brokenHtml = htmlBlocks.filter((block) => {
        const opens  = (block.Html.match(/<div\b/gi)  || []).length;
        const closes = (block.Html.match(/<\/div>/gi) || []).length;
        return opens !== closes;
    });
    check('    raw HTML blocks are whole (' + htmlBlocks.length + ' found)',
          brokenHtml.length === 0,
          brokenHtml.length ? JSON.stringify(brokenHtml[0].Html.slice(0, 160)) : '');

    // Every heading line in the file must have become a heading block. An
    // EMPTY heading counts: the project notes hold a bare "## " on line 325,
    // and a heading with nothing after it is still a heading the writer typed
    // and still has to come back as one.
    const headingLines = text.split('\n').filter((line) => /^ {0,3}#{1,6}[ \t]+/.test(line)).length;
    const headingBlocks = blocks.filter((block) => block.Kind === 'heading').length;
    check('    every heading found (' + headingBlocks + ' of ' + headingLines + ')',
          headingBlocks === headingLines);

    // Trailing blank counting must agree with the source
    const withBlanks = blocks.filter((block) => block.Kind !== 'blank' && Na__LeStmtMd__TrailingBlanks(block) > 0).length;
    check('    blank lines are attached to the block above (' + withBlanks + ' blocks carry spacing)', withBlanks > 0);
}

// endregion -------------------------------------------------------------------

console.log('\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED') + '\n');
process.exit(failures === 0 ? 0 : 1);
