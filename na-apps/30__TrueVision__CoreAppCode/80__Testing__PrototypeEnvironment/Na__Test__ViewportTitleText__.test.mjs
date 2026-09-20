// =============================================================================
// TRUEVISION3D - TEST - LAYOUT EDITOR - VIEWPORT TITLE TEXT
// =============================================================================
//
// FILE       : Na__Test__ViewportTitleText__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Viewport Title Text Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a drawing's title is written the way Adam letters them by hand, that a missing fact shows as a {{placeholder}} and never as a guess, and that a typed name is left as typed
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - The title text module imports nothing, so it runs here exactly as the app
//   runs it. Node 20 reads the app's .js modules as CommonJS, so the module is
//   copied to a temporary .mjs first.
// - THE FIXTURE IS PS02. Its eight hand-lettered titles are the house pattern:
//   EXISTING EAST ELEVATION, PROPOSED NORTH ELEVATION, EXISTING GROUND FLOOR
//   PLAN - qualifier, then subject, in capitals, no punctuation.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ViewportTitleText__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Written with the parametric drawing title.
//
// =============================================================================

import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Module Under Test
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const VIEWPORTS  = resolve(SCRIPT_DIR, '..', '02__Src__AppModules', '51__System__LayoutEditor', '20__System__Viewports');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-titletext-'));
    copyFileSync(join(VIEWPORTS, 'Na__LayoutEditor__ViewportTitleText__.js'), join(SCRATCH, 'TitleText.mjs'));
    const T = await import(pathToFileURL(join(SCRATCH, 'TitleText.mjs')).href);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, passed, detail) {
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + ((!passed && detail !== undefined) ? '  -> ' + JSON.stringify(detail) : ''));
    }
    const compose = (facts, options, words) => T.Na__LeViewText__Compose(facts, options, words || null);
    const caps    = (facts, options) => compose(facts, Object.assign({ uppercase : true }, options || {}));

    console.log('TrueVision3D - viewport title text');

    // THE HOUSE PATTERN | PS02's hand-lettered titles, from the facts alone
    const PS02 = [
        [ 'EXISTING EAST ELEVATION',  { kind : 'elevation', phase : 'existing', facing : 'East'  } ],
        [ 'EXISTING NORTH ELEVATION', { kind : 'elevation', phase : 'existing', facing : 'North' } ],
        [ 'EXISTING SOUTH ELEVATION', { kind : 'elevation', phase : 'existing', facing : 'South' } ],
        [ 'PROPOSED EAST ELEVATION',  { kind : 'elevation', phase : 'proposed', facing : 'East'  } ],
        [ 'PROPOSED NORTH ELEVATION', { kind : 'elevation', phase : 'proposed', facing : 'North' } ],
        [ 'PROPOSED SOUTH ELEVATION', { kind : 'elevation', phase : 'proposed', facing : 'South' } ]
    ];
    const written = PS02.map(([ , facts ]) => caps(facts).text);
    check('PS02: all six elevation titles come out as Adam lettered them', PS02.every(([ title ], i) => written[i] === title), written);
    check('PS02: every one of them is resolved, with nothing missing', PS02.every(([ , facts ]) => { const t = caps(facts); return t.resolved && t.missing.length === 0; }));
    check('a plan is its qualifier and its drawing\'s own name', caps({ kind : 'plan', phase : 'proposed', drawing : 'Ground Floor Plan' }).text === 'PROPOSED GROUND FLOOR PLAN');
    check('a section is named by its record, not by a compass word', caps({ kind : 'section', phase : 'existing', facing : 'East', drawing : 'Section A-A' }).text === 'EXISTING SECTION A-A');
    check('an elevation is named by the compass, not by its record\'s name', caps({ kind : 'elevation', phase : 'existing', facing : 'North', drawing : 'East Elevation' }).text === 'EXISTING NORTH ELEVATION');
    check('without capitals it is written in the words\' own case', compose({ kind : 'elevation', phase : 'existing', facing : 'North East' }, {}).text === 'Existing North East Elevation');

    // A MISSING FACT IS SHOWN, NEVER GUESSED
    const noNorth = caps({ kind : 'elevation', phase : 'existing', facing : '' });
    check('north not set: the direction is a placeholder in double braces', noNorth.text === 'EXISTING {{DIRECTION}} ELEVATION', noNorth.text);
    check('north not set: unresolved, and it says what is missing', noNorth.resolved === false && noNorth.missing.join() === 'direction', noNorth);
    const untied = caps({});
    check('tied to nothing: {{DRAWING}}, with no qualifier in front of it', untied.text === '{{DRAWING}}' && untied.missing.join() === 'drawing', untied);
    check('tied to nothing: a forced qualifier still does not qualify a placeholder', caps({}, { phaseMode : 'existing' }).text === '{{DRAWING}}');
    check('a 2D viewport whose drawing has gone reads {{DRAWING}} too', caps({ kind : '', phase : 'existing' }).text === '{{DRAWING}}');
    check('HasPlaceholder finds one, and is not fooled by single braces', T.Na__LeViewText__HasPlaceholder('EXISTING {{DIRECTION}} ELEVATION') && !T.Na__LeViewText__HasPlaceholder('EXISTING {EAST} ELEVATION') && !T.Na__LeViewText__HasPlaceholder(''));

    // A TYPED NAME IS THE SUBJECT, AS TYPED
    check('a typed viewport name is the subject, and still gets its qualifier', caps({ kind : 'elevation', phase : 'existing', facing : 'East', name : 'Front Elevation' }).text === 'EXISTING FRONT ELEVATION');
    check('a typed name needs no north: nothing is missing', caps({ kind : 'elevation', phase : 'proposed', facing : '', name : 'Rear Elevation' }).resolved === true);
    check('a typed name that opens with the qualifier is not qualified twice', caps({ kind : 'plan', phase : 'existing', name : 'Existing Floor Plan' }).text === 'EXISTING FLOOR PLAN');
    check('a typed name that opens with the OTHER qualifier is left saying what was typed', caps({ kind : 'plan', phase : 'existing', name : 'Proposed Floor Plan' }).text === 'PROPOSED FLOOR PLAN');
    check('a name that merely contains the word is still qualified', caps({ kind : 'plan', phase : 'proposed', name : 'Plan of Existing Drains' }).text === 'PROPOSED PLAN OF EXISTING DRAINS');
    check('a site plan has no phase, so no qualifier', caps({ kind : 'siteplan', phase : '', name : 'Block Plan', drawing : 'Site Plan' }).text === 'BLOCK PLAN');

    // THE QUALIFIER | From the model, forced, or off
    const facts = { kind : 'elevation', phase : 'existing', facing : 'West' };
    check('phase mode none leaves the qualifier out', caps(facts, { phaseMode : 'none' }).text === 'WEST ELEVATION');
    check('phase mode proposed overrides what the model says', caps(facts, { phaseMode : 'proposed' }).text === 'PROPOSED WEST ELEVATION');
    check('an unknown phase writes no qualifier', caps({ kind : 'elevation', phase : '', facing : 'West' }).text === 'WEST ELEVATION');
    check('a bad phase mode reads as automatic', caps(facts, { phaseMode : 'sideways' }).text === 'EXISTING WEST ELEVATION');

    // AN OVERRIDE IS WHAT WAS TYPED
    const typed = caps(facts, { override : '  Street Scene, as existing  ' });
    check('a typed title replaces everything, trimmed, and is not recased', typed.text === 'Street Scene, as existing' && typed.resolved === true, typed);
    check('a blank override is no override', caps(facts, { override : '   ' }).text === 'EXISTING WEST ELEVATION');

    // WORDS FROM CONFIG | Whatever it leaves out is the plain English
    const words = { Existing : 'As Existing', Elevation : 'Elev.', PlaceholderDirection : 'Set North' };
    check('configured words are used', compose({ kind : 'elevation', phase : 'existing', facing : 'East' }, {}, words).text === 'As Existing East Elev.');
    check('a configured placeholder word is used', compose({ kind : 'elevation', phase : 'proposed', facing : '' }, {}, words).text === 'Proposed {{Set North}} Elev.');

    // FACTS MADE WHOLE
    const whole = T.Na__LeViewText__NormaliseFacts({ kind : 'spaceship', phase : 7, facing : '  North   East ', name : null, drawing : '  Roof\n Plan ' });
    check('bad facts become their empty values and text is tidied to one line', whole.kind === '' && whole.phase === '' && whole.facing === 'North East' && whole.name === '' && whole.drawing === 'Roof Plan', whole);

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log(failures === 0 ? '\n  PASS - every check passed.' : '\n  FAIL - ' + failures + ' check(s) failed.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
