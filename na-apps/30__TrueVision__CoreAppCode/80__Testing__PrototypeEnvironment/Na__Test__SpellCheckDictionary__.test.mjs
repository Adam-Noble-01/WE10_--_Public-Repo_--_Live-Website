// =============================================================================
// TRUEVISION3D - TEST - SPELL CHECK DICTIONARY
// =============================================================================
//
// FILE       : Na__Test__SpellCheckDictionary__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Spell Check Dictionary Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the practice's dictionary reads, matches and changes the way the spell-checked boxes rely on
// CREATED    : 22-Sep-2026
//
// DESCRIPTION:
// - THE SHIPPED FILES: the shipped Na__SpellCheck__Dictionary__ reads the
//   shipped Na__SpellCheck__Config__.json and the shipped
//   50__TrueVision__UserConfig/TrueVision__UserSpellings__.json over a stubbed
//   fetch - first as the ProjectVision local server answers its route, then
//   as a plain file on a server with no route.
// - WHAT A WORD IS: the tokeniser's words and offsets, a word at the caret,
//   and the Add rule - which must be the Python server's rule word for word,
//   or the app would offer to add words the server then refuses.
// - MATCHING: any case, 's and ’s, a plural s and es, the words of an entry of
//   several words, and a word the dictionary does not have.
// - THE RANGES a box marks spellcheck="false", on a real specification line.
// - ADD AND REMOVE through the stubbed route: the whole answered dictionary
//   is taken, the change is announced, a read-only dictionary refuses and
//   says why, and a word that is not one word never reaches the server.
// - A FILE BROKEN BY A HAND EDIT: the route's "unreadable" answer is taken
//   as it is - the reason names the line and column, never a restart, the
//   file is not read again to fail the same way, and Add is refused in the
//   word bar's own sentence. Broken after it was read, Add says where and
//   stays on for when the file is put right.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__SpellCheckDictionary__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 22-Sep-2026 - Version 1.0.0
// - Written with the Spell Check feature (TrueVision3D v2.144.0).
//
// =============================================================================

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE     = path.dirname(fileURLToPath(import.meta.url));
const APP      = path.resolve(HERE, '..');
const SRC      = path.resolve(APP, '02__Src__AppModules');
const DIR      = path.resolve(SRC, '55__Feature__SpellCheck');
const CONFIG   = path.join(DIR, 'Na__SpellCheck__Config__.json');
const WORDS    = path.join(APP, '50__TrueVision__UserConfig', 'TrueVision__UserSpellings__.json');
const API_FILE = path.resolve(APP, '..', 'ProjectVision__TrueVisionUserConfig__Api__.py');

let failures = 0;
function check(name, got, want) {
    const passed = JSON.stringify(got) === JSON.stringify(want);
    if (!passed) failures++;
    console.log((passed ? '  PASS  ' : '  FAIL  ') + name);
    if (!passed) console.log('        got  ' + JSON.stringify(got) + '\n        want ' + JSON.stringify(want));
}

// THE SHIPPED FILE, its one import swapped for a stub and nothing else touched.
let loads = 0;
function load(file, stubs) {
    let src = fs.readFileSync(file, 'utf8');
    src = src.replace(/^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm, '');
    if (/^\s*import\s/m.test(src)) { console.error('FAIL: an import survived in ' + file); process.exit(1); }
    const tmp = path.join(os.tmpdir(), 'Na__Test__SpellCheckDictionary__' + (++loads) + '__.mjs');
    fs.writeFileSync(tmp, stubs + '\n' + src, 'utf8');
    return import(pathToFileURL(tmp).href + '?v=' + Math.random().toString(36).slice(2));
}

// -----------------------------------------------------------------------------
// A browser's worth of globals, and a ProjectVision server behind fetch
// -----------------------------------------------------------------------------
const events = [];
globalThis.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init ? init.detail : undefined; } };
globalThis.window = {
    location      : { origin : 'http://localhost:8090', hostname : 'localhost', port : '8090' },
    dispatchEvent : (event) => { events.push(event); return true; },
    addEventListener () {}, removeEventListener () {}
};
globalThis.localhost = true;
const server = { route : true, writable : true, health : true, posts : [], answer : null, document : null, broken : null, fileReads : 0 };
const shipped = () => JSON.parse(fs.readFileSync(WORDS, 'utf8'));
globalThis.fetch = async (url, init) => {
    const where = decodeURIComponent(String(url));
    const json  = (status, body) => ({ ok : status >= 200 && status < 300, status : status, json : async () => body });
    if (/Na__SpellCheck__Config__\.json$/.test(where)) return json(200, JSON.parse(fs.readFileSync(CONFIG, 'utf8')));
    if (/\/api\/health$/.test(where)) return server.health ? json(200, { status : 'ok', service : 'na-projectvision-local-dev' }) : json(404, null);
    if (/\/api\/truevision\/user-config\/spellings$/.test(where)) {
        if (!server.route) return json(405, null);
        if (init && init.method === 'POST') server.posts.push(JSON.parse(init.body));
        if (server.broken) return json(500, { error : server.broken + (init && init.method === 'POST' ? ' - nothing was written' : ''), unreadable : true });   // <-- The server's answer for a file a hand edit broke
        if (init && init.method === 'POST') {
            const body = JSON.parse(init.body);
            return server.answer ? json(200, server.answer(body)) : json(500, { error : 'no answer set' });
        }
        return json(200, { status : 'ok', writable : server.writable, document : server.document || shipped() });
    }
    if (/TrueVision__UserSpellings__\.json$/.test(where)) { server.fileReads++; return json(200, shipped()); }
    return json(404, null);
};
const STUBS = 'const Na__AppUtils__IsRunningOnLocalhost = () => globalThis.localhost === true;';

// -----------------------------------------------------------------------------
// WHAT A WORD IS
// -----------------------------------------------------------------------------
console.log('\nTrueVision3D - Spell Check dictionary\n\n  What a word is');
const D = await load(path.join(DIR, 'Na__SpellCheck__Dictionary__.js'), STUBS);

check('words and their offsets, an apostrophe inside a word kept',
    D.Na__SpellCheck__Words("Kingspan's K15 board - O’Brien's 'quote'"),
    [ { word : "Kingspan's", start : 0, end : 10 }, { word : 'K15', start : 11, end : 14 }, { word : 'board', start : 15, end : 20 },
      { word : 'O’Brien\'s', start : 23, end : 32 }, { word : 'quote', start : 34, end : 39 } ]);
check('a hyphen, a slash, a dot and an ampersand end a word', D.Na__SpellCheck__Words('Marley-Eternit/Cedral.Farrow&Ball').map((w) => w.word), [ 'Marley', 'Eternit', 'Cedral', 'Farrow', 'Ball' ]);
check('letters beyond English are letters (Schlüter, Øresund)', D.Na__SpellCheck__Words('Schlüter Øresund').map((w) => w.word), [ 'Schlüter', 'Øresund' ]);
check('the word the caret is inside', D.Na__SpellCheck__WordAt('fix Velux here', 6), { word : 'Velux', start : 4, end : 9 });
check('the word the caret has just finished', D.Na__SpellCheck__WordAt('fix Velux here', 9), { word : 'Velux', start : 4, end : 9 });
check('no word where the caret is between two spaces', D.Na__SpellCheck__WordAt('fix  here', 4), null);

// THE ADD RULE IS THE SERVER'S: the same candidates through both.
const candidates = [ 'Velux', 'K15', "O'Brien", 'O’Brien', 'Schlüter', '1500', "'tis", "tis'", 'Jeld-Wen', 'two words', '', '<b>x</b>', 'a'.repeat(60), 'a'.repeat(61), 'Æther', '_under' ];
const jsRule = candidates.map((word) => D.Na__SpellCheck__CanAdd(word));
let pyRule = null;
try {
    const code = 'import sys, json\nsys.path.insert(0, ' + JSON.stringify(path.dirname(API_FILE)) + ')\nimport ProjectVision__TrueVisionUserConfig__Api__ as api\nprint(json.dumps([api.clean_word(w) is not None for w in json.loads(sys.stdin.read())]))';
    const ascii = JSON.stringify(candidates).replace(/[\u007f-\uffff]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));   // <-- A Windows pipe is read as cp1252: send the letters escaped
    pyRule = JSON.parse(execFileSync('python', [ '-c', code ], { input : ascii, encoding : 'utf8', env : Object.assign({}, process.env, { PYTHONIOENCODING : 'utf-8' }) }));
} catch (error) { console.log('        (python not available: ' + error.message.split('\n')[0] + ')'); }
if (pyRule) check('Add takes exactly the words the server takes, candidate for candidate', jsRule, pyRule);
check('...which are these', jsRule, [ true, true, true, true, true, false, false, false, false, false, false, false, true, false, true, false ]);

// -----------------------------------------------------------------------------
// THE SHIPPED DICTIONARY, THROUGH THE ROUTE
// -----------------------------------------------------------------------------
console.log('\n  Matching (the shipped dictionary, read through the local server\'s route)');
check('nothing is known before the dictionary is read', D.Na__SpellCheck__IsKnown('Kingspan'), false);
await D.Na__SpellCheck__Ready();
check('once read, it says so, once', [ D.Na__SpellCheck__IsLoaded(), events.filter((e) => e.type === 'na-spellcheck-changed').map((e) => e.detail.reason) ], [ true, [ 'loaded' ] ]);
check('the route says it can be written', [ D.Na__SpellCheck__IsWritable(), D.Na__SpellCheck__WhyReadOnly() ], [ true, null ]);
check('...so there is no reason to give', D.Na__SpellCheck__ReadOnlyMessage(), '');
check('every shipped entry\'s words are known (339 entries, more words)', D.Na__SpellCheck__WordCount() >= 339, true);

const known = (word) => D.Na__SpellCheck__IsKnown(word);
check('in any case', [ 'Kingspan', 'kingspan', 'KINGSPAN' ].map(known), [ true, true, true ]);
check("with 's and with ’s", [ "Kingspan's", 'Kingspan’s', "VELUX'S" ].map(known), [ true, true, true ]);
check('with a plural s and a plural es', [ 'rooflights', 'cills', 'Veluxes', 'upstands' ].map(known), [ true, true, true, true ]);
check('the words of an entry of several words', [ 'Farrow', 'Ball', 'Jeld', 'Wen', 'Axia', 'Pizarras' ].map(known), [ true, true, true, true, true, true ]);
check('abbreviations in any case', [ 'uPVC', 'UPVC', 'upvc', 'GFFL', 'dpc' ].map(known), [ true, true, true, true, true ]);
check('what the dictionary does not have', [ 'Kingspam', 'rooflightx', 'Velu', 'the', '' ].map(known), [ false, false, false, false, false ]);

const velux  = D.Na__SpellCheck__EntryFor('velux');
const farrow = D.Na__SpellCheck__EntryFor('Farrow');
check('an entry says which group holds it, and that the word IS the entry', [ velux.entry, velux.whole, velux.groupKey, velux.groupTitle ], [ 'Velux', true, 'ManufacturersAndBrands', 'Manufacturers and Brands' ]);
check('a word that is part of an entry says so', [ farrow.entry, farrow.whole ], [ 'Farrow & Ball', false ]);

const line = 'Kingspan K15 by Kingspam, with Velux’s conservation rooflights to the RB05 roofs.';
check('the stretches a box leaves to the dictionary, on a specification line',
    D.Na__SpellCheck__KnownRanges(line).map((r) => line.slice(r.start, r.end)), [ 'Kingspan', 'Velux’s', 'rooflights' ]);

// -----------------------------------------------------------------------------
// ADD AND REMOVE
// -----------------------------------------------------------------------------
console.log('\n  Add and Remove (through the stubbed route)');
server.answer = (body) => {
    const doc = shipped();
    doc.TrueVision__UserSpellings__Groups[doc.TrueVision__UserSpellings__Groups.length - 1].Group__Words = body.action === 'add' ? [ body.word ] : [];
    return { status : 'ok', added : body.action === 'add', removed : body.action === 'remove' ? 1 : 0, word : body.word, document : doc };
};
events.length = 0;
let result = await D.Na__SpellCheck__Add('  Zeroflex ');
check('Add sends one word, trimmed, and answers ok and changed', [ server.posts.pop(), result ], [ { action : 'add', word : 'Zeroflex' }, { ok : true, changed : true, word : 'Zeroflex', error : null } ]);
check('...the answered dictionary is taken: the word is known', known('zeroflex'), true);
check('...and the change is announced as added', events.map((e) => [ e.detail.reason, e.detail.word ]), [ [ 'added', 'Zeroflex' ] ]);
check('...in the app\'s own group', D.Na__SpellCheck__EntryFor('Zeroflex').groupKey, 'AddedInTheApp');

result = await D.Na__SpellCheck__Remove('Zeroflex');
check('Remove takes it out again', [ result.ok, result.changed, known('Zeroflex') ], [ true, true, false ]);

const before = server.posts.length;
result = await D.Na__SpellCheck__Add('two words');
check('two words never reach the server, and say why', [ server.posts.length - before, result.ok, /not one word/.test(result.error) ], [ 0, false, true ]);

server.answer = () => ({ status : 'ok', added : false, word : 'Velux', document : shipped() });
result = await D.Na__SpellCheck__Add('Velux');
check('a word the file has already: ok, not changed', [ result.ok, result.changed ], [ true, false ]);

server.broken = "TrueVision__UserSpellings__.json is not valid JSON: line 3, column 1 (Expecting value)";
result = await D.Na__SpellCheck__Add('Zeroflex');
server.broken = null;
check('a file broken by hand after it was read: Add says where, and is not switched off for when it is put right',
    [ result.ok, result.error.includes('line 3, column 1'), known('Zeroflex'), D.Na__SpellCheck__IsWritable() ], [ false, true, false, true ]);

// -----------------------------------------------------------------------------
// WITHOUT THE ROUTE: A SERVER TO RESTART, AND A PLAIN FILE
// -----------------------------------------------------------------------------
console.log('\n  Without the route');
server.route = false;
const D2 = await load(path.join(DIR, 'Na__SpellCheck__Dictionary__.js'), STUBS);
await D2.Na__SpellCheck__Ready();
check('a ProjectVision server without the route: read from the file, and "restart"', [ D2.Na__SpellCheck__IsKnown('Kingspan'), D2.Na__SpellCheck__IsWritable(), D2.Na__SpellCheck__WhyReadOnly() ], [ true, false, 'restart' ]);
const posted = server.posts.length;
result = await D2.Na__SpellCheck__Add('Zeroflex');
check('...and Add refuses without asking the server, saying to restart it', [ server.posts.length - posted, result.ok, /Restart/.test(result.error) ], [ 0, false, true ]);
check('...in the very sentence the word bar shows', result.error, D2.Na__SpellCheck__ReadOnlyMessage());

server.health = false;
const D3 = await load(path.join(DIR, 'Na__SpellCheck__Dictionary__.js'), STUBS);
await D3.Na__SpellCheck__Ready();
check('a static server: read from the file, and "no-server"', [ D3.Na__SpellCheck__IsKnown('Kingspan'), D3.Na__SpellCheck__WhyReadOnly() ], [ true, 'no-server' ]);

globalThis.localhost = false;
server.route = true; server.health = true;
const D4 = await load(path.join(DIR, 'Na__SpellCheck__Dictionary__.js'), STUBS);
await D4.Na__SpellCheck__Ready();
check('the website never asks the route, and reads the file read-only', [ D4.Na__SpellCheck__IsKnown('Velux'), D4.Na__SpellCheck__IsWritable() ], [ true, false ]);

// -----------------------------------------------------------------------------
// A FILE BROKEN BY A HAND EDIT
// -----------------------------------------------------------------------------
console.log('\n  A file broken by a hand edit');
globalThis.localhost = true;
server.broken    = "TrueVision__UserSpellings__.json is not valid JSON: line 14, column 5 (Expecting ',' delimiter)";
server.fileReads = 0;
const D5 = await load(path.join(DIR, 'Na__SpellCheck__Dictionary__.js'), STUBS);
await D5.Na__SpellCheck__Ready();
check('the route\'s word is taken: read-only, "unreadable", nothing known, and the file not read again to fail the same way',
    [ D5.Na__SpellCheck__IsLoaded(), D5.Na__SpellCheck__IsWritable(), D5.Na__SpellCheck__WhyReadOnly(), D5.Na__SpellCheck__IsKnown('Kingspan'), server.fileReads ],
    [ true, false, 'unreadable', false, 0 ]);
check('the reason gives the line and column, and never says to restart a server that is fine',
    [ D5.Na__SpellCheck__ReadOnlyMessage().includes('line 14, column 5'), /Restart/.test(D5.Na__SpellCheck__ReadOnlyMessage()) ], [ true, false ]);
const sentBefore = server.posts.length;
result = await D5.Na__SpellCheck__Add('Zeroflex');
check('...and Add refuses without asking the server, in the same sentence', [ server.posts.length - sentBefore, result.ok, result.error ], [ 0, false, D5.Na__SpellCheck__ReadOnlyMessage() ]);
server.broken = null;

// THE WORD BAR (the shipped one, its dictionary imports bound to one of the dictionaries above)
const BAR_NAMES = [ 'CHANGED_EVENT', 'Ready', 'IsLoaded', 'IsWritable', 'ReadOnlyMessage', 'Label', 'EntryFor', 'Add', 'Remove' ].map((name) => 'Na__SpellCheck__' + name);
const BAR_STUBS = 'const { ' + BAR_NAMES.join(', ') + ' } = globalThis.__NaDictionary;\nconst Na__SpellField__CARET_EVENT = \'na-spellcheck-caret\';';
globalThis.__NaDictionary = D5;
const Bar5 = await load(path.join(DIR, 'Na__SpellCheck__WordBar__.js'), BAR_STUBS);
const said5 = Bar5.Na__SpellBar__Describe({ word : 'Zenitherm', start : 0, end : 9 });
check('the word bar over a broken file: Add shown but off, its hover text the line and column', [ said5.action, said5.disabled, said5.title ], [ 'add', true, D5.Na__SpellCheck__ReadOnlyMessage() ]);
globalThis.__NaDictionary = D;
const Bar1 = await load(path.join(DIR, 'Na__SpellCheck__WordBar__.js'), BAR_STUBS);
const said1 = Bar1.Na__SpellBar__Describe({ word : 'Zenitherm', start : 0, end : 9 });
check('...and over a sound one: Add on, offering the word', [ said1.action, said1.disabled, said1.title.includes('Zenitherm') ], [ 'add', false, true ]);

console.log('\n  ' + (failures === 0 ? 'ALL PASSED' : failures + ' FAILED') + '\n');
process.exit(failures === 0 ? 0 : 1);
