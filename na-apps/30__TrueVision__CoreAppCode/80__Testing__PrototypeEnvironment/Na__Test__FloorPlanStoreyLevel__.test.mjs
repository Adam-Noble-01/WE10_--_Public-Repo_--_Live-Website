// =============================================================================
// TRUEVISION3D - TEST - FLOOR PLAN VIEWS - STOREY LEVEL
// =============================================================================
//
// FILE       : Na__Test__FloorPlanStoreyLevel__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Floor Plan Storey Level Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the storeys are offered in the order Adam asked for, that a plan nobody has chosen for is guessed in the bands he gave, and that a pick always beats a guess
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - The storey level module imports nothing, so it runs here exactly as the
//   app runs it. Node 20 reads the app's .js modules as CommonJS, so the
//   module is copied to a temporary .mjs first.
// - THE SHIPPED CONFIG IS PART OF THE TEST. The module's built-in storeys are
//   a fallback that must equal the JSON the app actually loads; a test that
//   only read the fallback would pass while the app guessed from something
//   else. Both are read and compared.
// - THE FIXTURE IS PS01 AND PS02, the two projects with plans: "Floor Plan 1"
//   cut at 1600 mm and "Roof Plan" cut at 6000 mm over a single storey house.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__FloorPlanStoreyLevel__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Written with the storey level.
//
// =============================================================================

import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Module Under Test
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const PLANS      = resolve(SCRIPT_DIR, '..', '02__Src__AppModules', '42__System__FloorPlanViews');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-storeylevel-'));
    copyFileSync(join(PLANS, 'Na__FloorPlan__StoreyLevel__.js'), join(SCRATCH, 'StoreyLevel.mjs'));
    const L      = await import(pathToFileURL(join(SCRATCH, 'StoreyLevel.mjs')).href);
    const CONFIG = JSON.parse(readFileSync(join(PLANS, 'Na__FloorPlan__AppConfig__.json'), 'utf8'));
    const BLOCK  = CONFIG.FloorPlanViews__StoreyLevels__Config;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, passed, detail) {
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + ((!passed && detail !== undefined) ? '  -> ' + JSON.stringify(detail) : ''));
    }

    console.log('TrueVision3D - floor plan storey level');

    const shipped  = L.Na__FpLevel__Setup(BLOCK);
    const builtIn  = L.Na__FpLevel__Setup(null);
    const byHeight = (mm, setup) => L.Na__FpLevel__GuessFromCutMm(mm, setup || shipped);

    // THE LIST | Adam's five, in Adam's order, and the same whichever source it came from
    const labels = L.Na__FpLevel__Choices(shipped).map((choice) => choice.label);
    check('the config ships a storey levels block', !!BLOCK && Array.isArray(BLOCK.FloorPlanViews__StoreyLevels__Levels));
    check('the dropdown offers the five storeys in the order asked for', labels.join(' | ') === 'Ground floor | First floor | Second floor | Roof plan | Basement level', labels);
    check('the built-in fallback equals the shipped config exactly', JSON.stringify(builtIn) === JSON.stringify(shipped), { builtIn : builtIn, shipped : shipped });
    check('a choice is a key and a label, nothing else', JSON.stringify(L.Na__FpLevel__Choices(shipped)[0]) === JSON.stringify({ key : 'ground', label : 'Ground floor' }));

    // THE BANDS | 0 to 2.8 m ground, 2.8 to 5 m first, 5 to 6.8 m second, above that roof, below -1 m basement
    const BANDS = [
        [ 0, 'ground' ], [ 1200, 'ground' ], [ 1600, 'ground' ], [ 2799, 'ground' ],
        [ 2800, 'first' ], [ 3900, 'first' ], [ 4999, 'first' ],
        [ 5000, 'second' ], [ 6000, 'second' ], [ 6799, 'second' ],
        [ 6800, 'roof' ], [ 9000, 'roof' ], [ 20000, 'roof' ],
        [ -1001, 'basement' ], [ -2600, 'basement' ], [ -5000, 'basement' ]
    ];
    const banded = BANDS.map(([ mm ]) => byHeight(mm));
    check('every height lands in the band Adam gave', BANDS.every(([ , key ], i) => banded[i] === key), BANDS.map(([ mm, key ], i) => mm + ':' + banded[i] + (banded[i] === key ? '' : '!=' + key)));
    check('the metre under the datum is still the ground floor', byHeight(-1) === 'ground' && byHeight(-500) === 'ground' && byHeight(-1000) === 'ground');
    check('exactly -1000 is ground and one millimetre lower is a basement', byHeight(-1000) === 'ground' && byHeight(-1001) === 'basement');
    check('no height at all is the storey offered first', byHeight(NaN) === 'ground' && byHeight(undefined) === 'ground' && byHeight(null) === 'ground');
    let covered = true;
    for (let mm = -6000; mm <= 21000; mm += 50) { if (!L.Na__FpLevel__IsKey(byHeight(mm), shipped)) covered = false; }
    check('the bands leave no gap anywhere the datum slider and cut offset can reach', covered);

    // THE NAME | Knows better than the height
    const byName = (name) => L.Na__FpLevel__GuessFromName(name, shipped);
    check('"Roof Plan" is a roof plan', byName('Roof Plan') === 'roof');
    check('"Existing Ground Floor Plan" is the ground floor', byName('Existing Ground Floor Plan') === 'ground');
    check('"FIRST FLOOR" is the first floor, whatever its case', byName('FIRST FLOOR') === 'first');
    check('"Lower Ground Floor" is a basement: the longest match wins', byName('Lower Ground Floor') === 'basement');
    check('"Cellar" is a basement', byName('Cellar') === 'basement');
    check('"Floor Plan 1" says nothing', byName('Floor Plan 1') === '');
    check('whole words only: "Background Plan" and "Roofline Study" say nothing', byName('Background Plan') === '' && byName('Roofline Study') === '');
    check('punctuation is a word boundary: "Plan (roof)" and "second-floor" are found', byName('Plan (roof)') === 'roof' && byName('second-floor plan') === 'second');
    check('an empty or missing name says nothing', byName('') === '' && byName(null) === '' && byName(42) === '');

    // THE GUESS | Name first, then height - and says which it was
    const roofGuess = L.Na__FpLevel__Guess('Roof Plan', 6000, shipped);
    check('PS01 "Roof Plan" cut at 6000: a roof plan, from its name (the height alone says second floor)', roofGuess.key === 'roof' && roofGuess.from === 'name' && byHeight(6000) === 'second', roofGuess);
    const planGuess = L.Na__FpLevel__Guess('Floor Plan 1', 1600, shipped);
    check('PS01 "Floor Plan 1" cut at 1600: the ground floor, from its height', planGuess.key === 'ground' && planGuess.from === 'height', planGuess);
    const noNames = L.Na__FpLevel__Setup(Object.assign({}, BLOCK, { FloorPlanViews__StoreyLevels__GuessFromName : false }));
    check('with name guessing switched off, "Roof Plan" at 6000 goes by its height', L.Na__FpLevel__Guess('Roof Plan', 6000, noNames).key === 'second');

    // A PLAN'S STOREY | A pick beats a guess, and a guess follows the plan
    const picked = L.Na__FpLevel__Resolve('roof', 'Floor Plan 1', 1600, shipped);
    check('a chosen storey is the storey, whatever the name and height say', picked.key === 'roof' && picked.guessed === false && picked.from === 'set', picked);
    check('a chosen storey carries its label and its drawing title', picked.label === 'Roof plan' && picked.title === 'Roof Plan');
    const low  = L.Na__FpLevel__Resolve(undefined, 'Floor Plan 3', 1200, shipped);
    const high = L.Na__FpLevel__Resolve(undefined, 'Floor Plan 3', 4000, shipped);
    check('an unchosen plan follows its cut: 1200 is the ground floor, 4000 the first', low.key === 'ground' && high.key === 'first' && low.guessed && high.guessed, { low : low, high : high });
    check('a guess carries a title too', low.title === 'Ground Floor Plan' && high.title === 'First Floor Plan');
    const stale = L.Na__FpLevel__Resolve('mezzanine', 'Floor Plan 1', 1600, shipped);
    check('a stored key that names no storey counts as nothing chosen', stale.key === 'ground' && stale.guessed === true, stale);
    check('a stored key is matched whatever its case or padding', L.Na__FpLevel__Resolve('  ROOF ', '', 0, shipped).from === 'set');
    check('the five drawing titles are as they are lettered', shipped.levels.map((level) => level.title).join(' | ') === 'Ground Floor Plan | First Floor Plan | Second Floor Plan | Roof Plan | Basement Plan', shipped.levels.map((level) => level.title));

    // THE CONFIG | Made whole, never trusted
    const odd = L.Na__FpLevel__Setup({ FloorPlanViews__StoreyLevels__Levels : [
        { Level__Key : ' Mezzanine ', Level__CutFromMm : 2000, Level__CutBelowMm : 3000 },
        { Level__Key : 'mezzanine', Level__Label : 'A second mezzanine' },
        { Level__Label : 'No key' }, null, 'text',
        { Level__Key : 'loft', Level__Label : 'Loft', Level__NameContains : [ ' Attic ', '', 7 ] }
    ] });
    check('a storey with only a key is offered by it and titled by it', odd.levels[0].key === 'mezzanine' && odd.levels[0].label === 'mezzanine' && odd.levels[0].title === 'mezzanine', odd.levels[0]);
    check('a key given twice keeps its first entry, and entries with no key are dropped', odd.levels.length === 2 && odd.levels[1].key === 'loft', odd.levels.map((level) => level.key));
    check('name tokens are trimmed and lower cased, and the unusable ones dropped', odd.levels[1].nameContains.join() === 'attic', odd.levels[1].nameContains);
    check('a storey with no band is never guessed from a height', L.Na__FpLevel__GuessFromCutMm(9000, odd) === 'mezzanine');
    check('a storey with no title is titled by its label', odd.levels[1].title === 'Loft');
    check('an empty list falls back to the built-in storeys', L.Na__FpLevel__Setup({ FloorPlanViews__StoreyLevels__Levels : [] }).levels.length === 5);
    check('anything that is not a setup is read as the built-in one', L.Na__FpLevel__Choices(null).length === 5 && L.Na__FpLevel__Choices({ levels : [] }).length === 5 && L.Na__FpLevel__IsKey('roof', 'nonsense'));
    const before = JSON.stringify(L.Na__FpLevel__DEFAULT_LEVELS);
    L.Na__FpLevel__Setup(null).levels[0].nameContains.push('changed');
    check('a setup made from the fallback cannot edit the fallback', JSON.stringify(L.Na__FpLevel__DEFAULT_LEVELS) === before);

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log(failures === 0 ? '\n  PASS - every check passed.' : '\n  FAIL - ' + failures + ' check(s) failed.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
