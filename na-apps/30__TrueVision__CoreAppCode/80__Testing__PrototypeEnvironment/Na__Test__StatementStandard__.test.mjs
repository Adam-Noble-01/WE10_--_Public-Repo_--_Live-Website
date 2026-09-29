// =============================================================================
// TRUEVISION3D - TEST - STATEMENT STANDARD SECTIONS
// =============================================================================
//
// FILE       : Na__Test__StatementStandard__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Statement Writer - Standard Sections (registry, placement, drawing)
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the standard sections switch on and off cleanly, land in the house order and draw as themselves
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - THE MARKERS. One block in the markdown stands for a whole section (the
//   header's carries its fields between the tags); each must be recognised as
//   one raw HTML block, and nothing else may be.
// - THE HOUSE ORDER, on the real RB05 statement with its static contents list
//   taken out: switched on in any order, the sections end up as
//       header, (the header's own notes), divider, Contents, divider,
//       TrueVision 3D Project Hub, divider, 1.0
//   - every section but the header between two major dividers, never two
//   dividers touching.
// - ON AND OFF LEAVE NO TRACE. The Contents and the hub, switched off, give the
//   file back byte for byte; the header, switched off, is written back as a
//   house header that takes over again to the very same marker. Every file
//   along the way round-trips through the tokeniser byte for byte.
// - THE RENDERER IS STILL PURE. Before the registry is imported a marker is
//   emitted as written; after, it is drawn as its section, given the document.
// - WHAT IS DRAWN. The Contents lists every numbered section and subsection
//   and the hub, in document order; the header draws its fields in its own
//   classes with the version's date in italic; the hub has its code, its
//   button and its bold lead-in, and no printed address, no strap, no tile
//   numbers - and, with no project on the address bar, no access panel.
//
// HOW IT RUNS THE REAL MODULES. The app's .js files are ES modules that node
// would read as CommonJS, so the folders they import across are copied as
// they are into a scratch tree with a package.json saying "module". window is
// a stub carrying only an address bar; fetch always fails, so each config
// falls back to its built-in defaults (which mirror the files).
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__StatementStandard__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.1.0
// - The header and the Contents; the house order; dividers either side.
//
// 29-Sep-2026 - Version 1.0.0
// - Initial implementation.
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
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'na-stmt-std-'));
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

// THE ADDRESS BAR, and nothing else of a browser. No network.
function SetAddress(search) {
    globalThis.window = { location : { search : search, hostname : 'www.noble-architecture.com', port : '' } };
}
SetAddress('?project=RB05&project-folder=RB05__WestFarm&year=26');
globalThis.fetch = async () => ({ ok : false, status : 404, json : async () => null });
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

const HUB = '<div class="na-le-stmt-std-marker" data-na-standard-section="TrueVisionHub">Standard Section: TrueVision 3D Project Hub.</div>';
const roundTrips = (text) => Na__LeStmtMd__Join(Na__LeStmtMd__Tokenise(text)) === text;


// -----------------------------------------------------------------------------
// REGION | The Renderer Before the Registry Exists
// -----------------------------------------------------------------------------

console.log('\nThe renderer on its own');
check('a marker is emitted exactly as written when nothing has registered', Na__LeStmtRnd__Markdown(HUB + '\n', { Editable : false }) === HUB);


// -----------------------------------------------------------------------------
// REGION | The Registry
// -----------------------------------------------------------------------------

const Std   = await load(STD + 'Na__LayoutEditor__Statement__Standard__Registry__.js');
const kinds = (text) => Na__LeStmtMd__Tokenise(text).map((block) => block.Kind === 'html'
    ? (Std.Na__LeStmtStd__Detect(block.Html) || (/Horizontal Page Divider Line/.test(block.Html) ? 'DIVIDER' : 'html'))
    : block.Kind === 'heading' ? 'h' + block.Level + ':' + String(block.Text).slice(0, 18) : block.Kind);

console.log('\nMarkers');
check('the hub marker is recognised', Std.Na__LeStmtStd__Detect(HUB) === 'TrueVisionHub');
check('the menu lists the six in the house order (the three that open a statement, the one in its body, the two that close it)',
      Std.Na__LeStmtStd__List().map((row) => row.Id).join(',') === 'DocumentHeader,Contents,TrueVisionHub,FinishesComparison,DrawingSchedule,DocumentFooter');
check('the header does not move; the others do',
      !Std.Na__LeStmtStd__IsMovable('DocumentHeader') && Std.Na__LeStmtStd__IsMovable('Contents') && Std.Na__LeStmtStd__IsMovable('TrueVisionHub'));
check('an unknown section id is not a marker', Std.Na__LeStmtStd__Detect('<div data-na-standard-section="Nope">x</div>') === null);
check('HTML that only mentions the attribute later is not a marker',
      Std.Na__LeStmtStd__Detect('<p>see <div data-na-standard-section="TrueVisionHub"></div></p>') === null);
{
    const header = Std.Na__LeStmtStd__MarkerLine('DocumentHeader', 'Title: A Statement\nApplicant: Mr A & Mrs B\nSite Address:\n    1 The Street\n    Town');
    const blocks = Na__LeStmtMd__Tokenise('Before.\n\n' + header + '\n\nAfter.\n');
    check('a header marker with its fields is ONE raw HTML block', blocks.length === 3 && blocks[1].Kind === 'html' && Std.Na__LeStmtStd__Detect(blocks[1].Html) === 'DocumentHeader',
          JSON.stringify(blocks.map((one) => one.Kind)));
    check('and carries no blank line inside it (Typora would end the block there)', !/\n\s*\n/.test(header));
    check('and its ampersand is escaped in the file', header.includes('Mr A &amp; Mrs B'));
}

console.log('\nThe house order - RB05, its static contents list taken out');
const RB05 = path.join(repoRoot, 'na-project-portal', '26-Projects', 'RB05__WestFarm', '30__TrueVision__AppContent',
                       '10__StatementDocs', '01__PreApp__Statement', 'RB05_T01_S01__WestFarm__PreApplicationStatement__.md');
let live = fs.readFileSync(RB05, 'utf8');
// Any standard section already switched on is switched off first, and the
// static list (a "### Contents" heading, its block and the divider under it)
// is taken out - what the migration to the standard Contents does. The two
// that close a statement (v2.167.0) are Na__Test__StatementSchedule__'s, the
// Finishes Comparison (v2.168.0) Na__Test__StatementFinishes__'s.
for (const id of ['DocumentFooter', 'DrawingSchedule', 'FinishesComparison', 'TrueVisionHub', 'Contents', 'DocumentHeader']) live = Std.Na__LeStmtStd__RemoveFrom(live, id);
function StripStaticContents(text) {
    const blocks = Na__LeStmtMd__Tokenise(text);
    const at = blocks.findIndex((block) => block.Kind === 'heading' && block.Level === 3 && String(block.Text).trim() === 'Contents');
    if (at === -1) return text;
    let end = at + 1;
    if (blocks[end] && blocks[end].Kind === 'html' && /\|\s+Contents\s+\|/.test(blocks[end].Html)) end++;
    if (blocks[end] && blocks[end].Kind === 'html' && /Horizontal Page Divider Line/.test(blocks[end].Html)) end++;
    blocks.splice(at, end - at);
    return Na__LeStmtMd__Join(blocks);
}
const base = StripStaticContents(live);
check('the base carries no standard section and no static contents', Std.Na__LeStmtStd__Present(base).length === 0 && !/\|\s+Contents\s+\|/.test(base));

const withHub      = Std.Na__LeStmtStd__InsertInto(base, 'TrueVisionHub');
const withContents = Std.Na__LeStmtStd__InsertInto(withHub, 'Contents');           // <-- switched on AFTER the hub, still lands before it
const withAll      = Std.Na__LeStmtStd__InsertInto(withContents, 'DocumentHeader');
{
    const order = kinds(withAll);
    const first = order.findIndex((kind) => /^h3:1\.0/.test(kind));
    const top   = order.slice(0, first + 1).filter((kind) => kind !== 'blank');
    check('the file opens with the header marker', top[0] === 'DocumentHeader', top.slice(0, 3).join(' / '));
    const tail = top.slice(top.indexOf('DIVIDER'));
    check('then divider, Contents, divider, hub, divider, 1.0', tail.join(' / ') === 'DIVIDER / Contents / DIVIDER / TrueVisionHub / DIVIDER / h3:1.0 |  Introductio',
          tail.join(' / '));
    check('the header\'s own notes stay between it and its divider (the [TO CONFIRM] revision note)',
          top.slice(1, top.indexOf('DIVIDER')).every((kind) => kind === 'paragraph'), top.slice(0, top.indexOf('DIVIDER')).join(' / '));
    let touching = false;
    for (let i = 1; i < order.length; i++) if (order[i] === 'DIVIDER' && order[i - 1] === 'DIVIDER') touching = true;
    check('no two dividers touch anywhere in the file', !touching);
    check('every file along the way round-trips through the tokeniser', [withHub, withContents, withAll].every(roundTrips));
    check('switching each on again changes nothing', Std.Na__LeStmtStd__InsertInto(withAll, 'Contents') === withAll && Std.Na__LeStmtStd__InsertInto(withAll, 'TrueVisionHub') === withAll);
}
{
    check('the hub switched off gives the file back byte for byte', Std.Na__LeStmtStd__RemoveFrom(withHub, 'TrueVisionHub') === base);
    check('the Contents switched off gives the file back byte for byte', Std.Na__LeStmtStd__RemoveFrom(withContents, 'Contents') === withHub);
    const unwrapped = Std.Na__LeStmtStd__RemoveFrom(withAll, 'DocumentHeader');
    check('the header switched off is a house header again (## title, ##### labels)',
          /^<img [^\n]*NA_Company_Logo[^\n]*\n\n## Pre-Application Design Statement\n/.test(unwrapped) && /\n##### Applicant:\n/.test(unwrapped) && /\n##### \*\*Document Version\*\*\n/.test(unwrapped));
    check('and switched on again takes it over to the very same marker', Std.Na__LeStmtStd__InsertInto(unwrapped, 'DocumentHeader') === withAll);
}
{
    const header = Na__LeStmtMd__Tokenise(withAll).find((block) => block.Kind === 'html' && Std.Na__LeStmtStd__Detect(block.Html) === 'DocumentHeader');
    check('the header took over every field of RB05\'s header', ['Title: Pre-Application Design Statement', 'Applicant: Mr Samuel Stoffel and Miss Rachael Baum',
          'Site Address:\n    West Beacon Farm\n    Deans Lane', 'Local Planning Authority: Charnwood Borough Council  -  Parish of Woodhouse',
          'Prepared By: Mr Adam Noble of Noble Architecture'].every((piece) => header.Html.includes(piece)) && /Document Version: Revision [A-Z]  -  \S/.test(header.Html), header.Html);
}

console.log('\nFallbacks');
{
    const bare = '### 1.0 |  Intro\n\nText.\n';
    const on   = Std.Na__LeStmtStd__InsertInto(bare, 'TrueVisionHub');
    check('with no header divider the hub goes above 1.0 between two new dividers',
          kinds(on).filter((kind) => kind !== 'blank').slice(0, 4).join(' / ') === 'DIVIDER / TrueVisionHub / DIVIDER / h3:1.0 |  Intro', kinds(on).join(' / '));
    const fresh = Std.Na__LeStmtStd__InsertInto(bare, 'DocumentHeader');
    check('a statement with no header gets the template header at the top', kinds(fresh)[0] === 'DocumentHeader' && fresh.includes('[TO CONFIRM: applicant]'));
}


// -----------------------------------------------------------------------------
// REGION | What Is Drawn
// -----------------------------------------------------------------------------

console.log('\nThe Contents, drawn from RB05');
{
    const html = Na__LeStmtRnd__Markdown(withAll, { Editable : false });
    const toc  = /<section data-na-standard-section="Contents"[\s\S]*?<\/section>/.exec(html);
    check('the Contents is drawn', !!toc);
    const blocks   = Na__LeStmtMd__Tokenise(withAll);
    const numbered = blocks.filter((block) => block.Kind === 'heading' && ((block.Level === 3 && /^\d+\.0\s*\|/.test(block.Text.trim())) || (block.Level === 4 && /^\d+\.\d+\s*\|/.test(block.Text.trim()))));
    const rows     = toc ? (toc[0].match(/class="na-le-stmt-std-toc__(main|sub)"/g) || []).length : 0;
    const parts    = blocks.filter((block) => block.Kind === 'heading' && block.Level === 2 && /Drawing Pack/.test(block.Text)).length;
    check('one row per numbered section and subsection, the hub and the drawing pack (' + rows + ')', rows === numbered.length + 1 + parts, 'expected ' + (numbered.length + 1 + parts));
    check('the hub is listed first, before 1.0, by its title', toc && toc[0].indexOf('Explore This Proposal In TrueVision 3D') < toc[0].indexOf('>1.0<'));
    check('in two columns', toc && (toc[0].match(/class="na-le-stmt-std-toc__column"/g) || []).length === 2);
    check('the Contents does not list itself', toc && !/>Contents<\/span>/.test(toc[0]));
}

console.log('\nThe header, drawn');
{
    const html = Na__LeStmtRnd__Markdown(withAll, { Editable : false });
    const head = /<header data-na-standard-section="DocumentHeader"[\s\S]*?<\/header>/.exec(html);
    check('the header is drawn in its own classes', !!head && head[0].includes('na-le-stmt-std-head__logo') && head[0].includes('class="na-le-stmt-std-head__title">Pre-Application Design Statement<'));
    check('five fields, each a label over its value', head && (head[0].match(/class="na-le-stmt-std-head__field"/g) || []).length === 5,
          head && String((head[0].match(/class="na-le-stmt-std-head__field"/g) || []).length));
    check('labels carry a colon, Document Version does not', head && head[0].includes('>Applicant:<') && head[0].includes('>Document Version<'));
    check('the address is one line each', head && head[0].includes('West Beacon Farm<br>Deans Lane<br>'));
    check('the version\'s date is in the house italic', head && /Revision [A-Z]<span class="na-le-stmt-std-head__date">&ensp;-&ensp;\d/.test(head[0]));
    check('no ##### heading is left above the first divider', !/^#####/m.test(withAll.split('Horizontal Page Divider Line')[0]));
}

console.log('\nThe TrueVision 3D Project Hub, drawn');
{
    const read = Na__LeStmtRnd__Markdown('Before.\n\n' + HUB + '\n\nAfter.\n', { Editable : false });
    check('read mode draws the section, not the marker', read.includes('class="na-le-stmt-std na-le-stmt-std-tvh"') && !read.includes('na-le-stmt-std-marker'));
    check('the button opens the project\'s short address', read.includes('class="na-le-stmt-std-tvh__button" href="https://www.noble-architecture.com/q/?RB05"'));
    check('the code is one inline SVG path in the house navy', (read.match(/<path /g) || []).length === 1 && /<path [^>]*fill="#172b3a"/.test(read));
    check('four quick-reference points open the body, not one lead-in sentence; no strap in the band', (/<ul class="na-le-stmt-std-tvh__points">((<li>[^<]+<\/li>){4})<\/ul>/.test(read)) && read.includes('<li>The complete 3D model of RB05</li>') && !read.includes('__lead-in') && !read.includes('__strap'));
    check('no printed address and no tile numbers', !read.includes('__url') && !read.includes('>noble-architecture.com/q/?RB05<') && !read.includes('tile-number'));
    check('no token left over', !/\{Project(Name|Code)\}|\{ShortUrlText\}/.test(read));
    check('its words assume no site: no street, garden, boundary or neighbour', !/street|garden|boundar|neighbour/i.test(read.replace(/<svg[\s\S]*?<\/svg>/, '')));
    check('it offers ground level and a bird\'s-eye view', read.includes("from ground level and from a bird's-eye view"));
    check('the prose around it is untouched', read.startsWith('<p>Before.</p>') && read.endsWith('<p>After.</p>'));

    const edit = Na__LeStmtRnd__Markdown(HUB + '\n', { Editable : true });
    check('edit mode wraps it in a frozen standard shell whose source is the marker',
          /class="na-le-stmt-frozen na-le-stmt-frozen--standard"[^>]*data-na-stmt-standard="TrueVisionHub"/.test(edit) &&
          edit.includes('data-na-stmt-src="' + HUB.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')));

    const named = Na__LeStmtRnd__Markdown(HUB.replace('data-na-standard-section="TrueVisionHub"', 'data-na-standard-section="TrueVisionHub" data-na-std-name="West Beacon Farm"') + '\n', { Editable : false });
    check('data-na-std-name names the project in the statement\'s own words', named.includes('Open West Beacon Farm In TrueVision 3D'));

    const Qr     = await load('51__System__LayoutEditor/53__Feature__ProjectQrCode/Na__ProjectQr__Symbol__.js');
    const symbol = Qr.Na__ProjectQr__GetSymbol();
    const size   = /style="width:([\d.]+)mm/.exec(read);
    const q      = Qr.Na__ProjectQr__GetSetup().symbol.quietZoneModules;
    const module = size && symbol ? (Number(size[1]) * symbol.Size / (symbol.Size + q * 2)) / symbol.Size : 0;
    check('the code prints at a module a phone can read (' + module.toFixed(2) + ' mm)', module >= Qr.Na__ProjectQr__GetSetup().symbol.minModuleMm * 3);

    SetAddress('');
    const none = Na__LeStmtRnd__Markdown(HUB + '\n', { Editable : false });
    check('with no project on the address bar: no access panel, no code, no link', none.includes('na-le-stmt-std-tvh') && !none.includes('__access') && !none.includes('<svg') && !none.includes('href='));
    SetAddress('?project=RB05&project-folder=RB05__WestFarm&year=26');
}


// -----------------------------------------------------------------------------
// REGION | Done
// -----------------------------------------------------------------------------

fs.rmSync(SCRATCH, { recursive : true, force : true });
console.log('\n' + (failures ? failures + ' check(s) FAILED' : 'All checks passed'));
process.exit(failures ? 1 : 0);
