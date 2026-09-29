// =============================================================================
// TRUEVISION3D - TEST - STATEMENT DRAWING SCHEDULE AND DOCUMENT FOOTER
// =============================================================================
//
// FILE       : Na__Test__StatementSchedule__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Statement Writer - the two standard sections that close a statement
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the Drawing Schedule syncs from the register without touching the writer's words, and the footer is always last
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - THE FOOTER. Switched on over the house footer it takes the copyright line
//   and an end note directly above it into its fields; a note further up is
//   left alone; it always gets a divider over it and never one under; off
//   writes the house lines back and on again gives the same file; the file
//   still ends with one newline; it is drawn as one row, no <h6> left.
// - THE SCHEDULE'S PLACE. Above the footer when there is one, else after the
//   divider that closes the last numbered section; always between two major
//   dividers; never two dividers touching; off gives the file back.
// - SYNC. The first sync fills an empty table; a second with the same data
//   changes nothing (not even the stamp); a renamed, an added and a deleted
//   sheet are each reported; the heading and the paragraphs come back byte
//   for byte; a row typed for someone else's document stays, a stale row of
//   this project's goes; a retitled header row stays while the columns line
//   up and is replaced when they do not; the marker never holds a blank line
//   and keeps its other attributes; nothing syncs without a source.
// - WHAT IS DRAWN. The heading, the words and the table in the document's
//   own styles; the titles column wraps, the rest keep to one line; the
//   Contents lists the schedule under its own heading, where it stands.
// - RB05, when its file carries the two sections: the schedule sits between
//   dividers straight over the footer, the footer is the last thing in the
//   file, and the drawn table has one row per drawing and the specification.
//
// HOW IT RUNS THE REAL MODULES: as Na__Test__StatementStandard__ does - the
// folders copied into a scratch ES module tree, window a stub with an address
// bar, fetch always failing so each config falls back to its built-in words.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__StatementSchedule__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.167.0).
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
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'na-stmt-sched-'));
fs.writeFileSync(path.join(SCRATCH, 'package.json'), '{ "type": "module" }\n');
for (const rel of [
    '51__System__LayoutEditor/52__Feature__StatementWriter/02__Core__Markdown',
    '51__System__LayoutEditor/52__Feature__StatementWriter/09__Standard__Sections',
    '51__System__LayoutEditor/53__Feature__ProjectQrCode',
    '03__AppUtils/Na__AppUtils__ProjectLoader.js'
]) {
    fs.cpSync(path.join(SRC, rel), path.join(SCRATCH, rel), { recursive : true });
}
const load = (rel) => import(url.pathToFileURL(path.join(SCRATCH, rel)).href);

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

const MD  = '51__System__LayoutEditor/52__Feature__StatementWriter/02__Core__Markdown/';
const STD = '51__System__LayoutEditor/52__Feature__StatementWriter/09__Standard__Sections/';
const { Na__LeStmtMd__Tokenise, Na__LeStmtMd__Join } = await load(MD + 'Na__LayoutEditor__Statement__Md__Tokenise__.js');
const { Na__LeStmtRnd__Markdown }                    = await load(MD + 'Na__LayoutEditor__Statement__Md__Render__.js');
const Std   = await load(STD + 'Na__LayoutEditor__Statement__Standard__Registry__.js');
const Sched = await load(STD + 'Na__LayoutEditor__Statement__Standard__DrawingSchedule__.js');
const Foot  = await load(STD + 'Na__LayoutEditor__Statement__Standard__Footer__.js');

const roundTrips = (text) => Na__LeStmtMd__Join(Na__LeStmtMd__Tokenise(text)) === text;
const kinds = (text) => Na__LeStmtMd__Tokenise(text).map((block) => block.Kind === 'html'
    ? (Std.Na__LeStmtStd__Detect(block.Html) || (/Horizontal Page Divider Line/.test(block.Html) ? 'DIVIDER' : /<h6/.test(block.Html) ? 'h6' : 'html'))
    : block.Kind === 'heading' ? 'h' + block.Level + ':' + String(block.Text).slice(0, 14) : block.Kind).filter((kind) => kind !== 'blank');
const touching = (text) => { const order = kinds(text); return order.some((kind, i) => i > 0 && kind === 'DIVIDER' && order[i - 1] === 'DIVIDER'); };
const markerOf = (text, id) => Na__LeStmtMd__Tokenise(text).find((block) => block.Kind === 'html' && Std.Na__LeStmtStd__Detect(block.Html) === id);


// -----------------------------------------------------------------------------
// REGION | A Small Statement in the House Shape
// -----------------------------------------------------------------------------

const DIVIDER = [
    '<div style=" /* | - - - - - - - - - - - -->|  Horizontal Page Divider Line   |<-- - - - - - - - - - - - - - - - -|  */ ',
    '    text-align           :     center;    ',
    '    padding-top          :    05.00mm;    /*  <--- Space Above The Divider Line  */',
    '    padding-bottom       :    05.00mm;    /*  <--- Space Below The Divider Line  */',
    '    margin-top           :    00.00mm;    ',
    '    margin-bottom        :    00.00mm;    ',
    '    ">                                   ',
    '    <div style="                         ',
    '        width            :       100%;    ',
    '        border-style     :      solid;    ',
    '        border-width     :     0.01pt;    ',
    '        border-color     :    #ebebeb;    ',
    '        ">                               ',
    '    </div>                                ',
    '</div>  '
].join('\n');
const H6 = (text) => '<div>  \n    <h6 style="margin-top:02.00mm;font-size:08.00pt;font-color:#ebebeb;">' + text + '</h6>\n</div>  ';

const BODY = '### 1.0 |  Introduction\n\nWords.\n\n' + DIVIDER + '\n\n### 2.0 |  Conclusion\n\nClosing words.\n\n' + DIVIDER + '\n\n';
const HOUSE = BODY + H6('Note To Reader : End Of Main Statement') + '\n\n' + H6('&copy; 2026 Noble Architecture') + '\n';


// -----------------------------------------------------------------------------
// REGION | The Document Footer
// -----------------------------------------------------------------------------

console.log('\nThe Document Footer');
{
    const on = Std.Na__LeStmtStd__InsertInto(HOUSE, 'DocumentFooter');
    const marker = markerOf(on, 'DocumentFooter');
    check('switched on over the house footer, it takes both lines into its fields',
          !!marker && marker.Html.includes('End Note: Note To Reader : End Of Main Statement') && marker.Html.includes('Copyright: © 2026 Noble Architecture'), marker && marker.Html);
    check('no <h6> line is left', !/<h6/.test(on));
    check('it is the last thing in the file, which still ends with one newline', kinds(on).slice(-1)[0] === 'DocumentFooter' && on.endsWith('</div>\n') && !on.endsWith('\n\n'));
    check('the divider already over it is used, not doubled', kinds(on).slice(-2).join(' / ') === 'DIVIDER / DocumentFooter' && !touching(on));
    check('it round-trips through the tokeniser', roundTrips(on));
    check('it is not movable, and has no line in the Contents', !Std.Na__LeStmtStd__IsMovable('DocumentFooter') && Foot.Na__LeStmtFoot__Definition().ContentsTitle() === '');

    const off = Std.Na__LeStmtStd__RemoveFrom(on, 'DocumentFooter');
    check('switched off, the two house lines come back', (off.match(/<h6 style="margin-top:02.00mm;font-size:08.00pt;font-color:#ebebeb;">/g) || []).length === 2 && off.includes('&copy; 2026 Noble Architecture'));
    check('and switched on again it is the very same file', Std.Na__LeStmtStd__InsertInto(off, 'DocumentFooter') === on);

    const html = Na__LeStmtRnd__Markdown(on, { Editable : false });
    const foot = /<footer data-na-standard-section="DocumentFooter"[\s\S]*?<\/footer>/.exec(html);
    check('drawn as one footer: the note left, the copyright right', !!foot
          && /__left"><div class="na-le-stmt-std-foot__note">Note To Reader : End Of Main Statement<\/div><\/div>/.test(foot[0])
          && /__right"><div class="na-le-stmt-std-foot__copyright">© 2026 Noble Architecture<\/div>/.test(foot[0]), foot && foot[0]);
}
{
    // RB05's shape: the end note further up, the copyright straight under a table
    const rb = BODY + H6('Note To Reader : End Of Pre-Application Statement') + '\n\n## Drawing Pack\n\n| A | B |\n| :-- | :-- |\n| 1 | 2 |\n\n\n\n' + H6('&copy; 2026 Noble Architecture') + '\n';
    const on = Std.Na__LeStmtStd__InsertInto(rb, 'DocumentFooter');
    const marker = markerOf(on, 'DocumentFooter');
    check('an end note that is not directly over the copyright is the writer\'s own divide, and stays', !!marker && !marker.Html.includes('End Note') && (on.match(/<h6/g) || []).length === 1);
    check('the footer gets a divider over it where the file had none (RB05\'s copyright sat under a table)', kinds(on).slice(-3).join(' / ') === 'table / DIVIDER / DocumentFooter', kinds(on).slice(-3).join(' / '));
}
{
    const bare = BODY.replace(/\n+$/, '\n');
    const on   = Std.Na__LeStmtStd__InsertInto(bare, 'DocumentFooter');
    const marker = markerOf(on, 'DocumentFooter');
    check('a statement with no footer gets the template lines, this year in the copyright',
          !!marker && marker.Html.includes('End Note: Note To Reader : End Of Statement') && marker.Html.includes('Copyright: © ' + new Date().getFullYear() + ' Noble Architecture'));
    check('at the end, under the Conclusion\'s divider, with the one newline kept', kinds(on).slice(-2).join(' / ') === 'DIVIDER / DocumentFooter' && on.endsWith('</div>\n') && !on.endsWith('\n\n'));
    const noDivider = '### 1.0 |  Only\n\nText.\n';
    const onBare = Std.Na__LeStmtStd__InsertInto(noDivider, 'DocumentFooter');
    check('with no divider at the end at all, it brings one', kinds(onBare).slice(-2).join(' / ') === 'DIVIDER / DocumentFooter', kinds(onBare).join(' / '));
}


// -----------------------------------------------------------------------------
// REGION | The Drawing Schedule - Where It Goes
// -----------------------------------------------------------------------------

console.log('\nThe Drawing Schedule - where it goes');
const WITH_FOOTER = Std.Na__LeStmtStd__InsertInto(HOUSE, 'DocumentFooter');
{
    const on = Std.Na__LeStmtStd__InsertInto(WITH_FOOTER, 'DrawingSchedule');
    check('above the footer, between two dividers', kinds(on).slice(-4).join(' / ') === 'DIVIDER / DrawingSchedule / DIVIDER / DocumentFooter', kinds(on).slice(-4).join(' / '));
    check('no two dividers touch', !touching(on));
    check('switched off, the file comes back byte for byte', Std.Na__LeStmtStd__RemoveFrom(on, 'DrawingSchedule') === WITH_FOOTER);
    check('it round-trips, and switching it on again changes nothing', roundTrips(on) && Std.Na__LeStmtStd__InsertInto(on, 'DrawingSchedule') === on);
    const marker = markerOf(on, 'DrawingSchedule');
    check('a new schedule is a heading, a lead-in and an empty table in the five columns',
          !!marker && marker.Html.includes('\n## Drawing Schedule\nThe drawings listed below accompany this statement.\n| Drawing | Title | Scale | Size | Rev |\n| :--- | :--- | :--- | :--- | :--- |\n</div>'), marker && marker.Html);
    check('and holds no blank line', marker && !/\n\s*\n/.test(marker.Html));
    const drawn = Na__LeStmtRnd__Markdown(on, { Editable : false });
    check('an empty table says how to fill it (the editor alone shows it)', drawn.includes('class="na-le-stmt-std-sched__empty"'));

    const noFooter = Std.Na__LeStmtStd__InsertInto(Std.Na__LeStmtStd__RemoveFrom(WITH_FOOTER, 'DocumentFooter'), 'DrawingSchedule');
    check('with no footer it goes straight after the Conclusion\'s divider, before the house end lines',
          kinds(noFooter).slice(-7).join(' / ') === 'h3:2.0 |  Conclus / paragraph / DIVIDER / DrawingSchedule / DIVIDER / h6 / h6', kinds(noFooter).slice(-7).join(' / '));
    const footerAfter = Std.Na__LeStmtStd__InsertInto(noFooter, 'DocumentFooter');
    check('the footer switched on after it takes the end lines and still goes last',
          kinds(footerAfter).slice(-4).join(' / ') === 'DIVIDER / DrawingSchedule / DIVIDER / DocumentFooter' && !touching(footerAfter), kinds(footerAfter).join(' / '));
}


// -----------------------------------------------------------------------------
// REGION | The Drawing Schedule - Sync
// -----------------------------------------------------------------------------

console.log('\nThe Drawing Schedule - sync');
const SHEETS = [
    { code : 'RB05_T01_D01', name : 'Project Introduction',            scale : 'NTS @ ISO A3',   size : 'ISO A3', revision : 'A' },
    { code : 'RB05_T01_D02', name : 'Front Elevation',                 scale : '1:100 @ ISO A2', size : 'ISO A2', revision : 'A' },
    { code : 'RB05_T01_D09', name : 'Coach House Plan',                scale : '1:100 @ ISO A2', size : 'ISO A2', revision : 'A' },
    { code : 'RB05_T01_D10', name : 'Roof Plan & 3D Bird\'s-eye Views', scale : '1:200 @ ISO A2', size : 'ISO A2', revision : 'Rev B' },
    { Kind : 'specification', code : 'RB05_SPEC', revision : 'B' }
];
const DATA = { ok : true, Rows : SHEETS, ProjectCode : 'RB05', SyncedIso : '2026-09-29T18:52:10.000Z' };
const SCHEDULED = Std.Na__LeStmtStd__InsertInto(WITH_FOOTER, 'DrawingSchedule');
{
    const first = Std.Na__LeStmtStd__ApplySync(SCHEDULED, 'DrawingSchedule', DATA);
    const marker = markerOf(first.markdown, 'DrawingSchedule');
    check('the first sync fills the empty table', first.ok && first.changed && marker.Html.includes('| RB05_T01_D02 | Front Elevation | 1:100 | ISO A2 | A |'), marker && marker.Html);
    check('a scale that repeats its paper prints as the scale alone; NTS stays NTS', marker.Html.includes('| RB05_T01_D01 | Project Introduction | NTS | ISO A3 | A |'));
    check('"Rev B" is written B; & is escaped in the file', marker.Html.includes('| RB05_T01_D10 | Roof Plan &amp; 3D Bird\'s-eye Views | 1:200 | ISO A2 | B |'));
    check('the specification follows the drawings, in its own words', marker.Html.includes('| RB05_SPEC | Project Specification | — | ISO A4 | B |'));
    check('the first sync asks nothing: there was nothing to lose', first.summary.HadRows === false && /filled from the Drawing Register: 5 rows/.test(first.text), first.text);
    check('the marker is stamped with when', Std.Na__LeStmtStd__SyncedIso(marker.Html) === '2026-09-29T18:52:10.000Z');
    check('the heading and the lead-in are untouched', marker.Html.includes('\n## Drawing Schedule\nThe drawings listed below accompany this statement.\n| Drawing |'));
    check('no blank line inside the marker, and the file round-trips', !/\n\s*\n/.test(marker.Html) && roundTrips(first.markdown));
    check('the blocks either side are untouched', first.markdown.replace(marker.Html, '') === SCHEDULED.replace(markerOf(SCHEDULED, 'DrawingSchedule').Html, ''));

    const again = Std.Na__LeStmtStd__ApplySync(first.markdown, 'DrawingSchedule', Object.assign({}, DATA, { SyncedIso : '2026-09-30T09:00:00.000Z' }));
    check('a second sync with the same register changes nothing - not even the stamp', again.ok && !again.changed && again.markdown === first.markdown && /already matches the Drawing Register \(5 rows\)/.test(again.text), again.text);

    // THE WRITER'S OWN WORDS, and the register moving on
    const written = first.markdown.replace('## Drawing Schedule\nThe drawings listed below accompany this statement.',
        '## Pre-Application Drawing Pack\nThe drawings listed below accompany this statement. All are issued at **Revision A**.\n[TO CONFIRM: dates at issue.]')
        .replace('| RB05_SPEC | Project Specification | — | ISO A4 | B |', '| RB05_SPEC | Project Specification | — | ISO A4 | B |\n| TS01 | Tree Survey (Arbtech) | — | ISO A4 | — |\n| RB05_T01_D99 | A Drawing Since Deleted | 1:50 | ISO A3 | A |');
    const moved = SHEETS.filter((row) => row.code !== 'RB05_T01_D09' && row.Kind !== 'specification')      // <-- As the source reads it: the sheets in tab order, the specification last
        .map((row) => row.code === 'RB05_T01_D02' ? Object.assign({}, row, { name : 'Front Elevation (South East)' }) : row)
        .concat([ { code : 'RB05_T01_D15', name : 'Street Scene', scale : '1:200 @ ISO A1', size : 'ISO A1', revision : 'A' } ])
        .concat(SHEETS.filter((row) => row.Kind === 'specification'));
    const next = Std.Na__LeStmtStd__ApplySync(written, 'DrawingSchedule', Object.assign({}, DATA, { Rows : moved, SyncedIso : '2026-09-30T10:00:00.000Z' }));
    const m2 = markerOf(next.markdown, 'DrawingSchedule');
    check('a renamed sheet is reported as changed', next.summary.Changed.join(',') === 'RB05_T01_D02', next.summary.Changed.join(','));
    check('a new sheet is reported as added', next.summary.Added.join(',') === 'RB05_T01_D15', next.summary.Added.join(','));
    check('a deleted sheet, and a stale row of this project, are taken out', next.summary.Removed.join(',') === 'RB05_T01_D09,RB05_T01_D99' && !m2.Html.includes('D99') && !m2.Html.includes('Coach House Plan'), next.summary.Removed.join(','));
    check('a row typed for someone else\'s document is kept, under the register\'s', next.summary.Kept.join(',') === 'TS01' && /\| RB05_SPEC [^\n]*\n\| TS01 \| Tree Survey \(Arbtech\) \|/.test(m2.Html));
    check('the writer\'s heading and words come back byte for byte', m2.Html.includes('\n## Pre-Application Drawing Pack\nThe drawings listed below accompany this statement. All are issued at **Revision A**.\n[TO CONFIRM: dates at issue.]\n| Drawing |'));
    check('the question says what changes, in words', /1 row changes: RB05_T01_D02\./.test(next.text) && /1 row is added: RB05_T01_D15\./.test(next.text) && /2 rows are taken out, no longer in the register: RB05_T01_D09 and RB05_T01_D99\./.test(next.text) && /1 row typed by hand is kept/.test(next.text) && /heading and the words are not touched/.test(next.text), next.text);
    check('the stamp moves on', Std.Na__LeStmtStd__SyncedIso(m2.Html) === '2026-09-30T10:00:00.000Z');

    // THE HEADER ROW
    const retitled = next.markdown.replace('| Drawing | Title | Scale | Size | Rev |', '| Drawing No. | Drawing Title | Scale | Paper | Revision |');
    const kept = Std.Na__LeStmtStd__ApplySync(retitled, 'DrawingSchedule', Object.assign({}, DATA, { Rows : SHEETS }));
    check('a header row the writer retitled is kept while the columns line up', markerOf(kept.markdown, 'DrawingSchedule').Html.includes('| Drawing No. | Drawing Title | Scale | Paper | Revision |'));
    const three = next.markdown.replace(/\| Drawing \| Title \| Scale \| Size \| Rev \|\n\| :--- \| :--- \| :--- \| :--- \| :--- \|/, '| Drawing | Title | Scale And Size |\n| :-- | :-- | :-- |');
    const reset = Std.Na__LeStmtStd__ApplySync(three, 'DrawingSchedule', Object.assign({}, DATA, { Rows : SHEETS }));
    check('a table in other columns (RB05\'s three) takes the configured five, and says so',
          reset.summary.ColumnsChanged && markerOf(reset.markdown, 'DrawingSchedule').Html.includes('| Drawing | Title | Scale | Size | Rev |\n| :--- |') && /columns become Drawing, Title, Scale, Size and Rev/.test(reset.text), reset.text);

    // ATTRIBUTES AND BLANK LINES
    const named = first.markdown.replace('data-na-standard-section="DrawingSchedule"', 'data-na-standard-section="DrawingSchedule" data-na-std-name="West Beacon Farm"');
    const resynced = Std.Na__LeStmtStd__ApplySync(named, 'DrawingSchedule', Object.assign({}, DATA, { Rows : moved }));
    check('a sync keeps the marker\'s other attributes', markerOf(resynced.markdown, 'DrawingSchedule').Html.startsWith('<div class="na-le-stmt-std-marker" data-na-standard-section="DrawingSchedule" data-na-std-name="West Beacon Farm" data-na-std-synced="'));
    check('and the blank lines under it', Na__LeStmtMd__Tokenise(resynced.markdown).filter((b) => b.Kind === 'html' && Std.Na__LeStmtStd__Detect(b.Html) === 'DrawingSchedule')[0].Lines.slice(-1)[0] === '');
    check('a statement without the section cannot be synced', !Std.Na__LeStmtStd__ApplySync(HOUSE, 'DrawingSchedule', DATA).ok);
}


// -----------------------------------------------------------------------------
// REGION | The Drawing Schedule - Drawn, and in the Contents
// -----------------------------------------------------------------------------

console.log('\nThe Drawing Schedule - drawn');
{
    const synced = Std.Na__LeStmtStd__ApplySync(SCHEDULED, 'DrawingSchedule', DATA).markdown
        .replace('## Drawing Schedule', '## Pre-Application Drawing Pack')
        .replace('| RB05_T01_D01 | Project Introduction |', '| **RB05_T01_D01** | Project Introduction |');
    const html  = Na__LeStmtRnd__Markdown(synced, { Editable : false });
    const sched = /<section data-na-standard-section="DrawingSchedule"[\s\S]*?<\/section>/.exec(html);
    check('drawn with the document\'s own heading, paragraph and table', !!sched && sched[0].includes('<h2 class="na-le-stmt-std-sched__title">Pre-Application Drawing Pack</h2>')
          && sched[0].includes('<p>The drawings listed below accompany this statement.</p>') && sched[0].includes('<table class="na-le-stmt-std-sched__table">'), sched && sched[0].slice(0, 400));
    check('one row per sheet and the specification', sched && (sched[0].match(/<tr>/g) || []).length === 6);
    check('the titles column wraps; every other keeps to one line', sched && /<th class="na-le-stmt-std-sched__cell na-le-stmt-std-sched__cell--grow">Title<\/th>/.test(sched[0])
          && (sched[0].match(/__cell--grow/g) || []).length === 6 && /<td class="na-le-stmt-std-sched__cell na-le-stmt-std-sched__cell--fit">RB05_T01_D02<\/td>/.test(sched[0]));
    check('a cell\'s markdown is drawn (bold), its & escaped once', sched && sched[0].includes('<strong>RB05_T01_D01</strong>') && sched[0].includes('Roof Plan &amp; 3D Bird\'s-eye Views') && !sched[0].includes('&amp;amp;'));
    check('no "fill it" line once the table has rows', sched && !sched[0].includes('__empty'));
    check('the marker itself is never printed', !html.includes('na-le-stmt-std-marker'));

    const withToc = synced.replace('### 1.0 |  Introduction', '<div class="na-le-stmt-std-marker" data-na-standard-section="Contents">Standard Section: Table Of Contents.</div>\n\n' + DIVIDER + '\n\n### 1.0 |  Introduction');
    const toc = /<section data-na-standard-section="Contents"[\s\S]*?<\/section>/.exec(Na__LeStmtRnd__Markdown(withToc, { Editable : false }));
    check('the Contents lists it under its own heading, after 2.0, and not the footer', !!toc && toc[0].includes('>Pre-Application Drawing Pack<')
          && toc[0].indexOf('>Conclusion<') < toc[0].indexOf('>Pre-Application Drawing Pack<') && !/End Note|Noble Architecture/.test(toc[0]), toc && toc[0]);
}


// -----------------------------------------------------------------------------
// REGION | The Registry's Sync Plumbing
// -----------------------------------------------------------------------------

console.log('\nSync plumbing');
{
    check('nothing can sync until a source is registered (none is, under node)', !Std.Na__LeStmtStd__CanSync('DrawingSchedule'));
    const refused = await Std.Na__LeStmtStd__Fetch('DrawingSchedule');
    check('and Fetch says so rather than throwing', refused.ok === false && typeof refused.reason === 'string');
    Std.Na__LeStmtStd__RegisterSource('DrawingSchedule', async () => DATA);
    const read = await Std.Na__LeStmtStd__Fetch('DrawingSchedule');
    check('a registered source makes it syncable and is read', Std.Na__LeStmtStd__CanSync('DrawingSchedule') && read.ok && read.Rows.length === 5);
    check('the footer and the hub never sync', !Std.Na__LeStmtStd__CanSync('DocumentFooter') && !Std.Na__LeStmtStd__CanSync('TrueVisionHub'));
    Std.Na__LeStmtStd__RegisterSource('DrawingSchedule', async () => { throw new Error('register gone'); });
    const broken = await Std.Na__LeStmtStd__Fetch('DrawingSchedule');
    check('a source that throws is reported, not thrown', broken.ok === false && /register gone/.test(broken.reason), broken.reason);
    Std.Na__LeStmtStd__RegisterSource('DrawingSchedule', async () => ({ ok : false, reason : 'The Drawing Register has no drawings yet, so there is nothing to sync.' }));
    const empty = await Std.Na__LeStmtStd__Fetch('DrawingSchedule');
    check('and its own reason is passed on', empty.ok === false && /no drawings yet/.test(empty.reason));
    check('each card\'s Edit says what it opens', /table/.test(Std.Na__LeStmtStd__EditHint('DrawingSchedule')) && /End Note/.test(Std.Na__LeStmtStd__EditHint('DocumentFooter')) && Std.Na__LeStmtStd__EditHint('Contents') === '');
}


// -----------------------------------------------------------------------------
// REGION | RB05, When Its File Carries the Two Sections
// -----------------------------------------------------------------------------

console.log('\nRB05');
{
    const RB05 = path.join(repoRoot, 'na-project-portal', '26-Projects', 'RB05__WestFarm', '30__TrueVision__AppContent',
                           '10__StatementDocs', '01__PreApp__Statement', 'RB05_T01_S01__WestFarm__PreApplicationStatement__.md');
    const text = fs.readFileSync(RB05, 'utf8');
    const present = Std.Na__LeStmtStd__Present(text);
    if (!present.includes('DrawingSchedule') || !present.includes('DocumentFooter')) {
        console.log('  SKIP  RB05 does not carry the Drawing Schedule and the Document Footer yet');
    } else {
        const order = kinds(text);
        check('RB05 ends: Conclusion ... divider, Drawing Schedule, divider, footer', order.slice(-4).join(' / ') === 'DIVIDER / DrawingSchedule / DIVIDER / DocumentFooter', order.slice(-6).join(' / '));
        check('no <h6> footer line is left, and no two dividers touch', !/<h6/.test(text.slice(text.lastIndexOf('### 13.0'))) && !touching(text));
        const html  = Na__LeStmtRnd__Markdown(text, { Editable : false });
        const sched = /<section data-na-standard-section="DrawingSchedule"[\s\S]*?<\/section>/.exec(html);
        check('its schedule is drawn under its own heading, one row per drawing and the specification (' + (sched ? (sched[0].match(/<tr>/g) || []).length - 1 : 0) + ')',
              !!sched && sched[0].includes('>Pre-Application Drawing Pack<') && (sched[0].match(/<tr>/g) || []).length - 1 >= 15);
        check('its footer is drawn last with both lines', /<footer data-na-standard-section="DocumentFooter"[\s\S]*End Of Pre-Application Statement[\s\S]*© 2026 Noble Architecture[\s\S]*<\/footer>$/.test(html));
        check('and the file round-trips', roundTrips(text));
    }
}


// -----------------------------------------------------------------------------
// REGION | Done
// -----------------------------------------------------------------------------

fs.rmSync(SCRATCH, { recursive : true, force : true });
console.log('\n' + (failures ? failures + ' check(s) FAILED' : 'All checks passed'));
process.exit(failures ? 1 : 0);
