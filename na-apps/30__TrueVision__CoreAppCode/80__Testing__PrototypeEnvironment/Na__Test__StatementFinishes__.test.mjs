// =============================================================================
// TRUEVISION3D - TEST - STATEMENT FINISHES COMPARISON
// =============================================================================
//
// FILE       : Na__Test__StatementFinishes__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Statement Writer - the existing-versus-proposed finishes, drawn element by element
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the comparison takes over the writer's table in place, draws every row, and gives the table back byte for byte
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - RB05, AS IT STANDS. Its "Material Specification Comparison" is the one
//   table taken over; the heading above it and the block under it do not
//   move; the marker holds the heading words (no width spans), a short
//   separator and every row exactly as typed, with no blank line inside;
//   switched off, the file comes back byte for byte; on again gives the same
//   marker; the Contents lists the same headings either way.
// - WHAT IS DRAWN FROM IT. Nineteen elements, eight tagged NEW with their
//   empty existing line left out ("None of architectural note" is kept - it
//   says something), thirteen [TO CONFIRM] notes lifted out of the sentences
//   and none left in them, a proposal that is only a note drawn as the note,
//   the strip carrying the table's own headings, and no <table> anywhere.
// - A HOUSEHOLDER TABLE (the design and access statement skill's exemplar).
//   "To strictly match existing", "identically match the existing profile"
//   and the same words twice are MATCHES EXISTING; "Not applicable" is NEW;
//   a real change is untagged; "does not match existing" and "to match the
//   joinery" are not matches.
// - THE WRITER'S EXTRAS. A row with only its first cell is a group; a Status
//   column tags in the writer's words; any other column is a labelled line;
//   a two-column table draws proposals only; words above and under the
//   table are an opening line and a note; an empty comparison says how to
//   fill it (in the editor only).
// - SWITCHING ON WITH NOTHING TO TAKE OVER. A floor area table ("Room |
//   Existing | Proposed") is never taken; the comparison lands under the
//   caret's block with the starting rows; with no caret, above 1.0; and the
//   five other sections ignore the caret altogether.
// - SWITCHING OFF WHAT WAS NEVER A HOUSE TABLE writes the house table, which
//   is taken over again the same way. An ampersand and a "<" survive.
// - THE FILE NEVER HOLDS THE DRAWING. Read, it is a section stamped with its
//   id; in the editor, a frozen standard card whose source is the marker.
//
// HOW IT RUNS THE REAL MODULES: as Na__Test__StatementStandard__ does - the
// folders copied into a scratch ES module tree, window a stub with an address
// bar, fetch always failing so the config falls back to its built-in words.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__StatementFinishes__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation (TrueVision3D v2.168.0).
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
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'na-stmt-fin-'));
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
const Std = await load(STD + 'Na__LayoutEditor__Statement__Standard__Registry__.js');
const Fin = await load(STD + 'Na__LayoutEditor__Statement__Standard__Finishes__.js');

const ID         = 'FinishesComparison';
const roundTrips = (text) => Na__LeStmtMd__Join(Na__LeStmtMd__Tokenise(text)) === text;
const markerOf   = (text) => Na__LeStmtMd__Tokenise(text).find((block) => block.Kind === 'html' && Std.Na__LeStmtStd__Detect(block.Html) === ID) || null;
const bodyOf     = (html) => html.replace(/^[^\n]*\n/, '').replace(/\n<\/div>$/, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const headings   = (text) => Na__LeStmtMd__Tokenise(text).filter((block) => block.Kind === 'heading').map((block) => block.Level + ':' + block.Text);
const drawn      = (body) => Fin.Na__LeStmtFin__Build(null, { body : body });
const count      = (html, pattern) => (html.match(pattern) || []).length;
const table      = (head, rows) => [ '| ' + head.join(' | ') + ' |', '| ' + head.map(() => ':---').join(' | ') + ' |' ].concat(rows.map((cells) => '| ' + cells.join(' | ') + ' |')).join('\n');


// -----------------------------------------------------------------------------
// REGION | The Registry
// -----------------------------------------------------------------------------

console.log('\nThe registry');
{
    const row = Std.Na__LeStmtStd__List().find((one) => one.Id === ID);
    check('the Finishes Comparison is on the Standard Sections menu', !!row && row.Label === 'Finishes Comparison');
    check('it has no Move handle (it is part of a section, not a section) and is not redrawn with the headings',
          !Std.Na__LeStmtStd__IsMovable(ID) && !Std.Na__LeStmtStd__DependsOnDocument(ID));
    const marker = Std.Na__LeStmtStd__MarkerLine(ID, table([ 'Building Element', 'Existing', 'Proposed' ], [ [ '**Walls**', 'Brick', 'Brick to match existing' ] ]));
    const blocks = Na__LeStmtMd__Tokenise('Before.\n\n' + marker + '\n\nAfter.\n');
    check('a marker holding a table is ONE raw HTML block (its rows are not a table of their own)',
          blocks.length === 3 && blocks[1].Kind === 'html' && Std.Na__LeStmtStd__Detect(blocks[1].Html) === ID, JSON.stringify(blocks.map((one) => one.Kind)));
    check('and carries no blank line inside it (Typora would end the block there)', !/\n\s*\n/.test(marker));
}

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | RB05, As It Stands
// -----------------------------------------------------------------------------

console.log('\nRB05 - the table taken over in place, and given back');
const RB05 = path.join(repoRoot, 'na-project-portal', '26-Projects', 'RB05__WestFarm', '30__TrueVision__AppContent',
                       '10__StatementDocs', '01__PreApp__Statement', 'RB05_T01_S01__WestFarm__PreApplicationStatement__.md');
const live   = fs.readFileSync(RB05, 'utf8');
const base   = Std.Na__LeStmtStd__RemoveFrom(live, ID);                          // <-- RB05 as a table, whether or not it has been switched on
const before = Na__LeStmtMd__Tokenise(base);
const tables = before.map((block, index) => ({ block, index })).filter((one) => one.block.Kind === 'table' && Fin.Na__LeStmtFin__IsComparison(one.block.Head));
check('RB05 has exactly one comparison table', tables.length === 1, 'found ' + tables.length);
const on = Std.Na__LeStmtStd__InsertInto(base, ID);
{
    const after = Na__LeStmtMd__Tokenise(on);
    const at    = tables.length ? tables[0].index : -1;
    check('switched on, that table is one marker in the same place', at >= 0 && after.length === before.length && Std.Na__LeStmtStd__Detect(after[at].Html || '') === ID);
    check('the heading above it and the block under it do not move',
          at > 0 && after[at - 1].Lines.join('\n') === before[at - 1].Lines.join('\n') && after[at + 1].Lines.join('\n') === before[at + 1].Lines.join('\n'),
          at > 0 ? after[at - 1].Kind + ' / ' + after[at + 1].Kind : '');
    check('every other block is untouched', after.every((block, index) => index === at || block.Lines.join('\n') === before[index].Lines.join('\n')));
    check('the file round-trips through the tokeniser', roundTrips(on));
    check('the Contents lists the same headings (the writer\'s "#### N.N |" line stays outside the marker)', headings(on).join('\n') === headings(base).join('\n'));

    const marker = markerOf(on);
    const body   = marker ? bodyOf(marker.Html) : '';
    const rows   = tables.length ? tables[0].block.Lines.slice(2).filter((line) => line.trim() !== '') : [];
    check('the marker holds the heading words without the width spans', /^\| Building Element \| Existing Dwelling \| Proposed Replacement \|\n\| :--- \| :--- \| :--- \|\n/.test(body), body.split('\n').slice(0, 2).join(' // '));
    check('and every row exactly as typed', rows.length === 19 && rows.every((line) => body.split('\n').includes(line)), rows.length + ' rows');
    check('and no blank line inside it', marker && !/\n\s*\n/.test(marker.Html));
    check('switched off, the file comes back byte for byte', Std.Na__LeStmtStd__RemoveFrom(on, ID) === base);
    check('switched on again, the same marker', Std.Na__LeStmtStd__InsertInto(Std.Na__LeStmtStd__RemoveFrom(on, ID), ID) === on);
    check('switching it on while it is on changes nothing', Std.Na__LeStmtStd__InsertInto(on, ID) === on);
}

console.log('\nRB05 - what is drawn');
{
    const body  = bodyOf(markerOf(on).Html);
    const model = Fin.Na__LeStmtFin__Model(body, null);
    const items = model.Items.filter((item) => item.Kind === 'item');
    const html  = drawn(body);
    check('nineteen elements', items.length === 19, String(items.length));
    const fresh = items.filter((item) => item.Tag && item.Tag.Kind === 'new').map((item) => item.Name);
    check('eight are NEW - every "Not applicable" and the "None"',
          fresh.join(', ') === 'Columns And Pilasters, Entablatures, Ridge Lantern, Dormers, Colonnade Balcony, Lean To Store, Cupola, Coach House External Stair', fresh.join(', '));
    check('a NEW element draws no existing line; "None of architectural note" says something and keeps its line',
          items.filter((item) => item.HideExisting).length === 8 && !items.find((item) => item.Name === 'Dressed Stonework').HideExisting);
    check('the old table\'s "Not applicable" is not printed anywhere', !/Not applicable/.test(html));
    check('no element of a replacement dwelling is claimed to MATCH EXISTING', !items.some((item) => item.Tag && item.Tag.Kind === 'match'));
    check('thirteen [TO CONFIRM] notes are lifted out of their sentences', count(html, /class="na-le-stmt-std-fin__confirm"/g) === 13, String(count(html, /class="na-le-stmt-std-fin__confirm"/g)));
    check('and none is left in a sentence', !/TO CONFIRM/.test(html));
    const stair = items.find((item) => item.Name === 'Coach House External Stair');
    check('a proposal that is only a note is drawn as the note, with no dash', stair.Proposed.Text === '' && stair.Proposed.Confirm.length === 1 && !/&mdash;/.test(html));
    check('the name column loses the bold marks the table needed', items[0].Name === 'External Walling' && !/\*\*/.test(html));
    check('the strip carries the table\'s own headings', /__strip-element">Building Element<\/span><span class="na-le-stmt-std-fin__strip-detail">Existing Dwelling<span class="na-le-stmt-std-fin__strip-arrow">&rarr;<\/span>Proposed Replacement</.test(html));
    check('and it is not a table', !/<table/.test(html));
    check('every element is drawn, each with a proposed line', count(html, /class="na-le-stmt-std-fin__item[ "]/g) === 19 && count(html, /__line--proposed/g) === 19);
    check('eleven existing lines (nineteen less the eight NEW)', count(html, /__line--existing/g) === 11, String(count(html, /__line--existing/g)));
    check('a filled comparison shows no empty-table note', !/__empty/.test(html));
}

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Householder Table
// -----------------------------------------------------------------------------

console.log('\nA householder table - the skill\'s exemplar');
{
    const EXEMPLAR = path.resolve('D:/08__Cloud__Repo__AgentSkills__Private/22-na-planning-documentation-skills/design-and-access-statement-writer/assets/exemplar--gold-standard.md');
    let rows = [
        [ '**External Brickwork**',      'Standard red facing brickwork',                    'Facing brickwork to strictly match existing in colour, size, tone, texture, and mortar colour.' ],
        [ '**Pitched Roofs**',           'Profiled roof tiles',                              'Roof tiles to identically match the existing profile, material, and colour.' ],
        [ '**Crown Roof Flat Section**', 'Not applicable',                                   'Specification unknown at this stage. Likely EPDM or GRP system at the discretion of the building contractor.' ],
        [ '**Rear Windows**',            'White UPVC',                                       'White UPVC' ],
        [ '**Rear Doors**',              'White UPVC French doors',                          'White UPVC or aluminium four panel folding door system.' ],
        [ '**Rainwater Goods**',         'Black UPVC gutters and downpipes',                 'Black UPVC gutters and downpipes to match existing.' ]
    ];
    let text = '#### 5.2 |  Material Specification Comparison Table\n\n' + table([ 'Building Element', 'Existing Materials', 'Proposed Materials' ], rows) + '\n';
    if (fs.existsSync(EXEMPLAR)) {
        text = fs.readFileSync(EXEMPLAR, 'utf8').split('\r\n').join('\n');         // <-- The real exemplar when this machine has it (it is CRLF)
    }
    const adopted = Fin.Na__LeStmtFin__Adopt(Na__LeStmtMd__Tokenise(text));
    check('its table reads as a comparison and is taken over', !!adopted);
    const tags = {};
    for (const item of Fin.Na__LeStmtFin__Model(adopted ? adopted.Body : '', null).Items.filter((one) => one.Kind === 'item')) tags[item.Name] = item.Tag ? item.Tag.Kind : '';
    check('"to strictly match existing" is MATCHES EXISTING', tags['External Brickwork'] === 'match');
    check('"identically match the existing profile" is MATCHES EXISTING', tags['Pitched Roofs'] === 'match');
    check('the same words twice ("White UPVC") is MATCHES EXISTING', tags['Rear Windows'] === 'match');
    check('"Not applicable" is NEW', tags['Crown Roof Flat Section'] === 'new');
    check('a real change is not tagged', tags['Rear Doors'] === '');
}
{
    const rows  = [ [ '**Walls**', 'Brick', 'Render that does not match existing brick.' ], [ '**Joinery**', 'Stained', 'Painted to match the joinery.' ] ];
    const model = Fin.Na__LeStmtFin__Model(table([ 'Building Element', 'Existing', 'Proposed' ], rows), null);
    check('"does not match existing" is not a match, and "to match the joinery" is not either', model.Items.every((item) => !item.Tag));
}

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Writer's Extras
// -----------------------------------------------------------------------------

console.log('\nGroups, a Status column, extra columns, words round the table');
{
    const body = 'All finishes to be agreed with the council.\n' + table([ 'Building Element', 'Existing', 'Proposed', 'Colour', 'Status' ], [
        [ '**Walls And Roofs**', '', '', '', '' ],
        [ '**Chimney**', 'Brick stack', 'Brick stack repaired', 'Red', 'Retained' ],
        [ '**Porch**', 'None', 'Oak framed porch', 'Natural', 'New' ],
        [ '**Door**', 'UPVC', 'Timber', '', 'Replaced' ]
    ]) + '\nSamples to be provided on request.';
    const model = Fin.Na__LeStmtFin__Model(body, null);
    const html  = drawn(body);
    check('a row with only its first cell is a group heading', model.Items[0].Kind === 'group' && model.Items[0].Text === 'Walls And Roofs' && count(html, /__group"/g) === 1);
    check('a Status column tags in the writer\'s own words', model.Items[1].Tag.Text === 'Retained' && model.Items[1].Tag.Kind === 'retained'
          && model.Items[2].Tag.Kind === 'new' && model.Items[3].Tag.Kind === 'other' && /__tag--other">Replaced</.test(html));
    check('any other column is a labelled line of its own, left out where it is empty',
          count(html, /__line--extra/g) === 2 && /__label">Colour</.test(html) && model.Items[3].Extras.length === 0);
    check('the words above the table open it, the words under it close it',
          /^<section[^>]*><p class="na-le-stmt-std-fin__intro">All finishes/.test(html) && /<p class="na-le-stmt-std-fin__note">Samples to be provided on request.<\/p><\/section>$/.test(html));
    const two = Fin.Na__LeStmtFin__Model(table([ 'Material', 'Proposed Finish' ], [ [ 'Walls', 'Render' ] ]), null);
    check('a two-column table draws proposals only', two.Roles.Existing === -1 && two.Roles.Proposed === 1 && two.Items[0].Existing === null && !/__line--existing/.test(drawn(table([ 'Material', 'Proposed Finish' ], [ [ 'Walls', 'Render' ] ]))));
    const empty = drawn(table([ 'Building Element', 'Existing', 'Proposed' ], []));
    check('an empty comparison says how to fill it (the stylesheet shows that in the editor only)', /class="na-le-stmt-std-fin__empty"/.test(empty));
    const windows = Fin.Na__LeStmtFin__Model(table([ 'Building Element', 'Existing', 'Proposed' ], [ [ '**Walls**', 'Brick', 'Brick to match existing' ] ]).split('\n').join('\r\n'), null);
    check('a body with Windows line ends still reads its heading row (one element, not three)', windows.Items.length === 1 && windows.Items[0].Name === 'Walls' && windows.Items[0].Tag.Kind === 'match');
}

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Switching On With Nothing to Take Over
// -----------------------------------------------------------------------------

console.log('\nNothing to take over - the caret decides');
{
    const floor = '### 1.0 |  Introduction\n\nText.\n\n#### 1.1 |  Floor Areas\n\n' + table([ 'Room', 'Existing Area', 'Proposed Area' ], [ [ 'Kitchen', '12 m²', '20 m²' ] ]) + '\n\n#### 1.2 |  Materials\n\nThe palette.\n';
    check('a floor area table ("Room | Existing | Proposed") is not a comparison', !Fin.Na__LeStmtFin__Adopt(Na__LeStmtMd__Tokenise(floor)));
    const lines   = floor.split('\n');
    const caretAt = lines.indexOf('#### 1.2 |  Materials') + 2;                   // <-- The heading's block ends on its blank line
    const placed  = Std.Na__LeStmtStd__InsertInto(floor, ID, { CaretLine : caretAt });
    const blocks  = Na__LeStmtMd__Tokenise(placed);
    const at      = blocks.findIndex((block) => block.Kind === 'html' && Std.Na__LeStmtStd__Detect(block.Html) === ID);
    check('it lands straight under the heading the caret is on', at > 0 && blocks[at - 1].Kind === 'heading' && blocks[at - 1].Text === '1.2 |  Materials' && blocks[at + 1].Kind === 'paragraph',
          blocks.map((block) => block.Kind).join(' / '));
    check('the floor area table is left exactly as it was', placed.includes(table([ 'Room', 'Existing Area', 'Proposed Area' ], [ [ 'Kitchen', '12 m²', '20 m²' ] ])));
    check('it starts from the configured rows, every cell a [TO CONFIRM]', /\| \*\*External Walls\*\* \| \[TO CONFIRM: existing walls\] \| \[TO CONFIRM: proposed walls\] \|/.test(placed));
    check('the file round-trips and the new block does not glue to its neighbours', roundTrips(placed) && /\n\n<div class="na-le-stmt-std-marker"[^\n]*\n/.test(placed) && /<\/div>\n\nThe palette\./.test(placed));
    const free = Std.Na__LeStmtStd__InsertInto(floor, ID);
    const top  = Na__LeStmtMd__Tokenise(free).filter((block) => block.Kind !== 'blank');
    check('with no caret it falls back to the registry\'s default, above 1.0', Std.Na__LeStmtStd__Detect(top[0].Html || '') === ID && top[1].Kind === 'heading');
    const bare = '### 1.0 |  Intro\n\nText.\n';
    check('the five other sections ignore the caret', [ 'DocumentHeader', 'Contents', 'TrueVisionHub', 'DrawingSchedule', 'DocumentFooter' ]
          .every((id) => Std.Na__LeStmtStd__InsertInto(bare, id, { CaretLine : 1 }) === Std.Na__LeStmtStd__InsertInto(bare, id)));
}

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Writing the House Table Back
// -----------------------------------------------------------------------------

console.log('\nOff writes the house table');
{
    const plain = '#### 5.2 |  Materials\n\n' + table([ 'Building Element', 'Existing', 'Proposed' ], [ [ '**Walls**', 'Brick & flint', 'Brick <to match> existing' ] ]) + '\n\nAfter.\n';
    const on    = Std.Na__LeStmtStd__InsertInto(plain, ID);
    check('an ampersand and a "<" are escaped in the file', /Brick &amp;amp; flint|Brick &amp; flint/.test(markerOf(on).Html) && markerOf(on).Html.includes('&lt;to match&gt;'));
    const off   = Std.Na__LeStmtStd__RemoveFrom(on, ID);
    const house = Na__LeStmtMd__Tokenise(off).find((block) => block.Kind === 'table');
    check('switched off it is a house table: width spans on the first two headings, the rest padded to sixty',
          !!house && house.Lines[0] === '| <span style="display:inline-block; width:30mm; white-space:nowrap;">Building Element</span> | <span style="display:inline-block; width:60mm; white-space:nowrap;">Existing</span> | ' + 'Proposed'.padEnd(60, ' ') + ' |',
          house ? house.Lines[0] : 'no table');
    check('with house separators and the row exactly as it was', !!house && house.Lines[1] === '| ' + [0, 1, 2].map(() => ':' + '-'.repeat(59)).join(' | ') + ' |'
          && house.Lines[2] === '| **Walls** | Brick & flint | Brick <to match> existing |');
    check('which is taken over again to the very same marker', Std.Na__LeStmtStd__InsertInto(off, ID) === on);
}

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The File Never Holds the Drawing
// -----------------------------------------------------------------------------

console.log('\nRead and edited');
{
    const read = Na__LeStmtRnd__Markdown(on, { Editable : false });
    check('read, the marker is drawn as the comparison, stamped with its id', /<section data-na-standard-section="FinishesComparison" class="na-le-stmt-std na-le-stmt-std-fin">/.test(read));
    check('and nothing of the marker is left to show', !/na-le-stmt-std-marker/.test(read));
    const edit = Na__LeStmtRnd__Markdown(on, { Editable : true });
    const card = /<div class="na-le-stmt-frozen na-le-stmt-frozen--standard" data-na-stmt-kind="html" contenteditable="false" data-na-stmt-standard="FinishesComparison" data-na-stmt-src="([^"]*)"/.exec(edit);
    check('in the editor it is a frozen standard card', !!card);
    check('whose source is the marker, never the drawing', !!card && /^&lt;div class=&quot;na-le-stmt-std-marker&quot; data-na-standard-section=&quot;FinishesComparison&quot;&gt;/.test(card[1]) && !/std-fin__item/.test(card[1]));
}

// endregion -------------------------------------------------------------------


fs.rmSync(SCRATCH, { recursive : true, force : true });
console.log(failures ? '\n' + failures + ' check(s) FAILED' : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
