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
// 20-Sep-2026 - Version 1.1.0
// - The storey level: PS02 D21's two plan titles, whose viewports carry the
//   typed names "Existing Floor Plan" and "Proposed Floor Plan"; when a typed
//   name beats a storey and when it does not; where a subject came from.
//
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

    // A FLOOR PLAN IS LETTERED FROM ITS STOREY | PS02 D21, as it is on the sheet
    const GROUND = 'Ground Floor Plan';
    const d21 = [
        caps({ kind : 'plan', phase : 'existing', level : GROUND, name : 'Existing Floor Plan', drawing : 'Floor Plan 1' }),
        caps({ kind : 'plan', phase : 'proposed', level : GROUND, name : 'Proposed Floor Plan', drawing : 'Floor Plan 1' })
    ];
    check('PS02 D21: both plan titles come out as Adam lettered them, typed viewport names and all', d21[0].text === 'EXISTING GROUND FLOOR PLAN' && d21[1].text === 'PROPOSED GROUND FLOOR PLAN', d21.map((t) => t.text));
    check('PS02 D21: resolved, and the subject is said to have come from the storey', d21.every((t) => t.resolved && t.missing.length === 0 && t.source === 'level'), d21);
    check('an unnamed plan viewport is its storey, not its record\'s "Floor Plan 1"', caps({ kind : 'plan', phase : 'proposed', level : GROUND, drawing : 'Floor Plan 1' }).text === 'PROPOSED GROUND FLOOR PLAN');
    check('a roof plan is a ROOF PLAN, never a roof floor plan', caps({ kind : 'plan', phase : 'proposed', level : 'Roof Plan', drawing : 'Roof Plan' }).text === 'PROPOSED ROOF PLAN');
    check('a plan with no storey is its record\'s name, as it always was', caps({ kind : 'plan', phase : 'proposed', level : '', drawing : 'Floor Plan 1' }).text === 'PROPOSED FLOOR PLAN 1');
    check('phase mode none leaves a storey title bare', caps({ kind : 'plan', phase : 'proposed', level : GROUND }, { phaseMode : 'none' }).text === 'GROUND FLOOR PLAN');
    check('without capitals a storey title is in its own case', compose({ kind : 'plan', phase : 'existing', level : 'First Floor Plan' }, {}).text === 'Existing First Floor Plan');

    // A TYPED NAME BEATS THE STOREY ONLY BY SAYING MORE
    const coach = caps({ kind : 'plan', phase : 'proposed', level : GROUND, name : 'Coach House Floor Plan' });
    check('a typed name with words of its own is kept exactly as typed', coach.text === 'PROPOSED COACH HOUSE FLOOR PLAN' && coach.source === 'name', coach);
    check('PS02 D21 reassigned to the roof: the typed "Proposed Floor Plan" still gives way, "Floor" saying nothing', caps({ kind : 'plan', phase : 'proposed', level : 'Roof Plan', name : 'Proposed Floor Plan' }).text === 'PROPOSED ROOF PLAN', caps({ kind : 'plan', phase : 'proposed', level : 'Roof Plan', name : 'Proposed Floor Plan' }).text);
    check('a typed name that DISAGREES with the storey is kept: "Ground Floor Plan" on a roof plan', caps({ kind : 'plan', phase : 'proposed', level : 'Roof Plan', name : 'Ground Floor Plan' }).text === 'PROPOSED GROUND FLOOR PLAN');
    check('the words that only say "a plan" come from the config too', compose({ kind : 'plan', phase : 'proposed', level : 'Roof Plan', name : 'Layout Drawing' }, {}, { GenericPlan : 'Layout Drawing' }).text === 'Proposed Roof Plan' && compose({ kind : 'plan', phase : 'proposed', level : 'Roof Plan', name : 'Layout Drawing' }, {}).text === 'Proposed Layout Drawing');
    check('a numbered typed name is kept: "Floor Plan 2"', caps({ kind : 'plan', phase : 'proposed', level : GROUND, name : 'Floor Plan 2' }).text === 'PROPOSED FLOOR PLAN 2');
    check('a typed name that is the storey, or less, gives way to it', [ 'Plan', 'Floor Plan', 'Ground Floor', 'ground-floor plan', 'Proposed', 'Proposed Ground Floor Plan' ].every((name) => caps({ kind : 'plan', phase : 'proposed', level : GROUND, name : name }).text === 'PROPOSED GROUND FLOOR PLAN'));
    check('"Proposed Floor Plan" typed on a viewport of the EXISTING model: the model is believed', caps({ kind : 'plan', phase : 'existing', level : GROUND, name : 'Proposed Floor Plan' }).text === 'EXISTING GROUND FLOOR PLAN');
    check('the opening qualifier is recognised in the configured words too', compose({ kind : 'plan', phase : 'existing', level : GROUND, name : 'As Existing Floor Plan' }, {}, { Existing : 'As Existing' }).text === 'As Existing Ground Floor Plan');
    check('SaysNoMore, asked directly', T.Na__LeViewText__SaysNoMore('Existing Floor Plan', GROUND, null) === true && T.Na__LeViewText__SaysNoMore('Annexe Floor Plan', GROUND, null) === false);

    // ONLY A FLOOR PLAN HAS A STOREY
    check('an elevation that somehow carries a storey is still named by the compass', caps({ kind : 'elevation', phase : 'existing', facing : 'East', level : GROUND }).text === 'EXISTING EAST ELEVATION');
    check('a typed name on an elevation still always wins', caps({ kind : 'elevation', phase : 'existing', facing : 'East', level : 'Elevation', name : 'Elevation' }).text === 'EXISTING ELEVATION');
    check('a site plan and a section ignore a storey', caps({ kind : 'siteplan', level : GROUND, drawing : 'Site Plan' }).text === 'SITE PLAN' && caps({ kind : 'section', phase : 'proposed', level : GROUND, drawing : 'Section A-A' }).text === 'PROPOSED SECTION A-A');

    // WHERE THE SUBJECT CAME FROM
    const sources = [
        caps(facts, { override : 'Street Scene' }).source, caps({ kind : 'elevation', facing : 'East', name : 'Front Elevation' }).source,
        caps({ kind : 'elevation', facing : '' }).source, caps({ kind : 'plan', level : GROUND }).source,
        caps({ kind : 'section', drawing : 'Section A-A' }).source, caps({}).source
    ];
    check('Compose says which fact the subject came from', sources.join() === 'override,name,facing,level,drawing,placeholder', sources);

    // FACTS MADE WHOLE
    const whole = T.Na__LeViewText__NormaliseFacts({ kind : 'spaceship', phase : 7, facing : '  North   East ', level : '  Ground\tFloor  Plan ', name : null, drawing : '  Roof\n Plan ' });
    check('bad facts become their empty values and text is tidied to one line', whole.kind === '' && whole.phase === '' && whole.facing === 'North East' && whole.level === 'Ground Floor Plan' && whole.name === '' && whole.drawing === 'Roof Plan', whole);
    check('facts with no storey at all have an empty one', T.Na__LeViewText__NormaliseFacts({ kind : 'plan' }).level === '' && T.Na__LeViewText__NormaliseFacts(null).level === '');

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log(failures === 0 ? '\n  PASS - every check passed.' : '\n  FAIL - ' + failures + ' check(s) failed.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
