// =============================================================================
// TRUEVISION3D - TEST - PROJECTED LINEWORK - STOREY BAND
// =============================================================================
//
// FILE       : Na__Test__StoreyBand__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Projected Linework Storey Band Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a floor plan keeps the door swings of the storey its cut passes through, and only those
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - The storeys module imports nothing, so it runs here exactly as the app
//   runs it. Node 20 reads the app's .js modules as CommonJS, so it is copied
//   to a temporary .mjs first; so is the config access module, whose built-in
//   fallbacks must equal the JSON the app actually loads.
// - THE FIXTURE IS RB05 WEST FARM, the house that showed the fault: three
//   storeys whose doors were measured in the app on 21-Sep-2026 - 27 ground
//   floor doors standing at -0.026 to 0.05 m, 15 first floor doors at 4.159
//   to 4.2 m, 6 second floor doors at 7.5 m - and three plans cut at 2000,
//   6200 and 8600 mm, every one with its datum at 0.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__StoreyBand__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written with the storey band.
//
// =============================================================================

import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Modules Under Test
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const LINEWORK   = resolve(SCRIPT_DIR, '..', '02__Src__AppModules', '50__System__ProjectedLinework');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-storeyband-'));
    copyFileSync(join(LINEWORK, 'Na__ProjectedLinework__Storeys__.js'),      join(SCRATCH, 'Storeys.mjs'));
    copyFileSync(join(LINEWORK, 'Na__ProjectedLinework__ConfigAccess__.js'), join(SCRATCH, 'ConfigAccess.mjs'));
    const S      = await import(pathToFileURL(join(SCRATCH, 'Storeys.mjs')).href);
    const C      = await import(pathToFileURL(join(SCRATCH, 'ConfigAccess.mjs')).href);
    const CONFIG = JSON.parse(readFileSync(join(LINEWORK, 'Na__ProjectedLinework__AppConfig__.json'), 'utf8'));
    const BLOCK  = CONFIG.ProjectedLinework__Storeys__Config;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fixture - RB05 West Farm
// -----------------------------------------------------------------------------

    // The doors as measured: every value inside each storey's measured range.
    const sample = (key, heights) => heights.map((h) => ({ Key : key, FloorUnits : h }));
    const RB05 = [].concat(
        sample('GroundFloor', [ -0.026, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.02, 0.02, 0.05, 0.05, 0.05, 0.05 ]),
        sample('FirstFloor',  [ 4.159, 4.159, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2, 4.2 ]),
        sample('SecondFloor', [ 7.5, 7.5, 7.5, 7.5, 7.5, 7.5 ])
    );
    const TOL  = 0.5;
    const plan = (cutMm) => ({ NormalX : 0, NormalY : -1, NormalZ : 0, DistanceUnits : -cutMm / 1000, DepthUnits : null });   // <-- As Na__PlView__PlanCut builds it
    const near = (a, b) => Math.abs(a - b) < 1e-9;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, passed, detail) {
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + ((!passed && detail !== undefined) ? '  -> ' + JSON.stringify(detail) : ''));
    }

    console.log('TrueVision3D - projected linework storey band');

    // STOREY KEYS | The storey toggle's Storey__<Key>__<Element> groups
    check('a storey category names its storey', S.Na__PlStorey__KeyOf('Storey__FirstFloor__ProposedDoors') === 'FirstFloor');
    check('a project prefix in front still names it', S.Na__PlStorey__KeyOf('RB05__Storey__GroundFloor__ProposedWalls') === 'GroundFloor');
    check('a category of no storey names none', S.Na__PlStorey__KeyOf('TrueVision__MainBuildingModel__ProposedDoors') === null && S.Na__PlStorey__KeyOf('TrueVision__Linetype__DoorSwings') === null);
    check('a broken name names none', S.Na__PlStorey__KeyOf('Storey__') === null && S.Na__PlStorey__KeyOf('Storey____Doors') === null && S.Na__PlStorey__KeyOf('Storey__Ground') === null && S.Na__PlStorey__KeyOf(null) === null);
    check('another prefix can be configured', S.Na__PlStorey__KeyOf('Level__Mezzanine__Doors', 'Level__') === 'Mezzanine');
    check('a key reads as words', S.Na__PlStorey__DisplayName('FirstFloor') === 'First Floor' && S.Na__PlStorey__DisplayName('GroundFloor') === 'Ground Floor');

    // THE FLOORS | Measured where each storey's doors stand
    const storeys = S.Na__PlStorey__Measure(RB05, TOL);
    const floors  = storeys ? storeys.Floors : [];
    check('RB05 has three floors, bottom to top', floors.length === 3 && floors.map((f) => f.Keys.join()).join(' | ') === 'GroundFloor | FirstFloor | SecondFloor', floors);
    check('RB05 floors stand at 0, 4.2 and 7.5 m', floors.length === 3 && near(floors[0].FloorUnits, 0) && near(floors[1].FloorUnits, 4.2) && near(floors[2].FloorUnits, 7.5), floors.map((f) => f.FloorUnits));
    check('each floor counts its doors', floors.map((f) => f.Doors).join() === '27,15,6', floors.map((f) => f.Doors));
    const stepped = S.Na__PlStorey__Measure(RB05.concat(sample('GroundFloor', [ 1.4, 1.4 ])), TOL);
    check('a couple of doors on a half landing do not move the floor', near(stepped.Floors[0].FloorUnits, 0), stepped.Floors[0]);
    check('one storey with doors is nothing to separate', S.Na__PlStorey__Measure(sample('GroundFloor', [ 0, 0.1 ]), TOL) === null);
    check('no doors at all is nothing to separate', S.Na__PlStorey__Measure([], TOL) === null && S.Na__PlStorey__Measure(null, TOL) === null);
    check('samples with no key or no height are left out', S.Na__PlStorey__Measure([ { Key : '', FloorUnits : 3 }, { Key : 'A', FloorUnits : NaN }, null, { FloorUnits : 1 } ].concat(RB05), TOL).Floors.length === 3);
    const merged = S.Na__PlStorey__Measure(sample('GroundFloor', [ 0 ]).concat(sample('LowerGround', [ 0.2 ]), sample('FirstFloor', [ 3 ])), TOL);
    check('two storeys standing closer than the tolerance are one floor with both keys', merged.Floors.length === 2 && merged.Floors[0].Keys.join() === 'GroundFloor,LowerGround' && merged.Floors[0].Doors === 2, merged);
    check('a missing tolerance is the module default', S.Na__PlStorey__Measure(RB05).ToleranceUnits === S.Na__PlStorey__TOLERANCE_DEFAULT);

    // A PLAN'S STOREY | The storey the cut passes through, whatever the plan is called
    const ground = S.Na__PlStorey__ForCut(storeys, plan(2000));
    const first  = S.Na__PlStorey__ForCut(storeys, plan(6200));
    const second = S.Na__PlStorey__ForCut(storeys, plan(8600));
    check('the Ground Floor Plan, cut at 2000 mm, is the ground floor', ground && ground.Index === 0 && ground.Keys.join() === 'GroundFloor' && near(ground.CutUnits, 2), ground);
    check('the First Floor Plan, cut at 6200 mm, is the first floor', first && first.Index === 1 && first.Keys.join() === 'FirstFloor', first);
    check('the Second Floor Plan, cut at 8600 mm, is the second floor', second && second.Index === 2 && second.Keys.join() === 'SecondFloor', second);
    check('the ground band runs down for ever and stops just under the first floor', ground.BottomUnits === -Infinity && near(ground.TopUnits, 3.7), ground);
    check('the first band runs from just under its floor to just under the second', near(first.BottomUnits, 3.7) && near(first.TopUnits, 7.0), first);
    check('the top band runs up for ever', near(second.BottomUnits, 7.0) && second.TopUnits === Infinity, second);
    check('a cut exactly on a floor is that floor, a millimetre under it the one below', S.Na__PlStorey__ForCut(storeys, plan(4200)).Index === 1 && S.Na__PlStorey__ForCut(storeys, plan(4199)).Index === 0);
    check('a cut below the lowest floor is the lowest storey', S.Na__PlStorey__ForCut(storeys, plan(-1500)).Index === 0);
    check('an elevation or section cut has no storey', S.Na__PlStorey__ForCut(storeys, { NormalX : -1, NormalY : 0, NormalZ : 0, DistanceUnits : -5, DepthUnits : null }) === null);
    check('a cut keeping what is above has no storey', S.Na__PlStorey__ForCut(storeys, { NormalX : 0, NormalY : 1, NormalZ : 0, DistanceUnits : 2, DepthUnits : null }) === null);
    check('no cut, or no storeys, has no storey', S.Na__PlStorey__ForCut(storeys, null) === null && S.Na__PlStorey__ForCut(null, plan(2000)) === null);
    check('a band is said in words', S.Na__PlStorey__Describe(first) === 'First Floor (floor 4200 mm)', S.Na__PlStorey__Describe(first));

    // THE BAND | What each plan keeps: door swings drawn at their floor, RB05 heights
    const holds = (band, y) => S.Na__PlStorey__Holds(band, y);
    check('the ground plan keeps the ground floor swings (0 to 0.1 m)', holds(ground, 0) && holds(ground, 0.1) && holds(ground, -0.026));
    check('the ground plan keeps nothing of the first floor (4.2 m) or the second (7.5 m)', !holds(ground, 4.2) && !holds(ground, 4.26) && !holds(ground, 7.5) && !holds(ground, 7.51));
    check('the ground plan keeps what lies below the ground (a lower terrace, the -10 m strays)', holds(ground, -0.6) && holds(ground, -10));
    check('the first plan keeps its own swings (4.2 m) and a sunken area within the tolerance', holds(first, 4.2) && holds(first, 4.26) && holds(first, 3.75));
    check('the first plan keeps nothing of the ground floor or the second floor', !holds(first, 0) && !holds(first, 0.1) && !holds(first, -10) && !holds(first, 7.5));
    check('the second plan keeps its own swings and nothing below', holds(second, 7.5) && holds(second, 7.51) && !holds(second, 4.26) && !holds(second, 0));
    check('with no band, everything is kept', holds(null, -100) && holds(null, 0) && holds(null, 100));
    check('the automatic swings of RB05 land on their own plan only (leaf bottoms 0-0.1, 4.2-4.42, 7.5 m)',
        [ 0, 0.1 ].every((y) => holds(ground, y) && !holds(first, y) && !holds(second, y)) &&
        [ 4.2, 4.421 ].every((y) => !holds(ground, y) && holds(first, y) && !holds(second, y)) &&
        [ 7.5 ].every((y) => !holds(ground, y) && !holds(first, y) && holds(second, y)));

    // STOREY-BOUND LINES | Only the categories named, and only off their storey
    const KEYS  = [ '', 'Storey__GroundFloor__ProposedDoors', 'TrueVision__Linetype__DoorSwings', 'TrueVision__Linetype__ClearanceLines', 'TrueVision__Linetype__OverheadObjects', 'TrueVision__Linetype__DottedLines' ];
    const marks = S.Na__PlStorey__MarkKeys(KEYS, BLOCK.ProjectedLinework__Storeys__AnnotationTokens);
    check('the shipped tokens mark door swings and clearances, and nothing else', !!marks && Array.from(marks).join() === '0,0,1,1,0,0', marks && Array.from(marks));
    check('a token matches whatever its case', Array.from(S.Na__PlStorey__MarkKeys(KEYS, [ 'linetype__doorswings' ]) || []).join() === '0,0,1,0,0,0');
    check('no tokens, or none that match, mark nothing', S.Na__PlStorey__MarkKeys(KEYS, []) === null && S.Na__PlStorey__MarkKeys(KEYS, [ 'Nothing' ]) === null && S.Na__PlStorey__MarkKeys(null, [ 'x' ]) === null);

    const edge  = (y) => [ 1, y, 2, 3, y, 4 ];
    const LINES = [ [ edge(0.05), 2 ], [ edge(4.26), 2 ], [ edge(7.51), 2 ], [ edge(-10), 2 ], [ edge(4.26), 4 ], [ edge(4.21), 3 ], [ edge(0.01), 3 ] ];
    const edges  = Float64Array.from(LINES.flatMap(([ e ]) => e));
    const owners = Uint16Array.from(LINES.map(([ , id ]) => id));
    const onGround = S.Na__PlStorey__KeepEdges(edges, owners, marks, ground);
    const onFirst  = S.Na__PlStorey__KeepEdges(edges, owners, marks, first);
    const heights  = (kept) => Array.from({ length : kept.Edges.length / 6 }, (_, i) => kept.Edges[(i * 6) + 1]);
    check('the ground plan keeps the ground swing, the -10 m stray, the overhead line and the ground clearance', heights(onGround).join() === '0.05,-10,4.26,0.01' && onGround.Dropped === 3, { kept : heights(onGround), dropped : onGround.Dropped });
    check('the first plan keeps its swing, the overhead line and its clearance', heights(onFirst).join() === '4.26,4.26,4.21' && onFirst.Dropped === 4, { kept : heights(onFirst), dropped : onFirst.Dropped });
    check('each kept edge keeps its owner', Array.from(onFirst.Owners).join() === '2,4,3', Array.from(onFirst.Owners));
    check('a line is judged by its middle', S.Na__PlStorey__KeepEdges(Float64Array.from([ 0, 3.9, 0, 1, 4.6, 1 ]), Uint16Array.from([ 2 ]), marks, first).Dropped === 0);
    const whole = S.Na__PlStorey__KeepEdges(edges, owners, marks, null);
    check('with no band the buffers come back untouched', whole.Edges === edges && whole.Owners === owners && whole.Dropped === 0);
    const none = S.Na__PlStorey__KeepEdges(Float64Array.from(edge(4.25)), Uint16Array.from([ 2 ]), marks, first);
    check('when nothing is dropped the buffers come back untouched', none.Dropped === 0 && none.Edges.length === 6);
    check('owner tags that do not match the edges leave the drawing whole', S.Na__PlStorey__KeepEdges(edges, Uint16Array.from([ 2 ]), marks, ground).Dropped === 0);
    check('with no owners at all nothing can be told apart, and nothing is dropped', S.Na__PlStorey__KeepEdges(edges, null, marks, ground).Dropped === 0);
    check('an empty buffer is fine', S.Na__PlStorey__KeepEdges(new Float64Array(0), new Uint16Array(0), marks, ground).Dropped === 0);

    // THE CONFIG | The shipped block, and fallbacks that equal it
    check('the config ships a storeys block', !!BLOCK);
    const fallback = C.Na__PlCfg__GetStoreySetup();                              // <-- No config fetched: the built-in fallbacks answer
    check('the built-in fallback equals the shipped block',
        fallback.enabled === BLOCK.ProjectedLinework__Storeys__Enabled &&
        fallback.categoryPrefix === BLOCK.ProjectedLinework__Storeys__CategoryPrefix &&
        fallback.floorToleranceMm === BLOCK.ProjectedLinework__Storeys__FloorToleranceMm &&
        JSON.stringify(fallback.annotationTokens) === JSON.stringify(BLOCK.ProjectedLinework__Storeys__AnnotationTokens), { fallback : fallback, shipped : BLOCK });
    check('the fallback build token equals the shipped one', C.Na__PlCfg__GetModelSetup().buildToken === CONFIG.ProjectedLinework__Model__Config.ProjectedLinework__Model__BuildToken, C.Na__PlCfg__GetModelSetup().buildToken);
    check('the storey prefix is the one the storey toggle reads', BLOCK.ProjectedLinework__Storeys__CategoryPrefix === S.Na__PlStorey__CATEGORY_PREFIX);
    check('overhead extents are never kept to a storey by default: they are drawn at the height of the thing above', !BLOCK.ProjectedLinework__Storeys__AnnotationTokens.some((token) => /overhead/i.test(token)));
    check('the shipped tolerance, in metres, is the module default', BLOCK.ProjectedLinework__Storeys__FloorToleranceMm / 1000 === S.Na__PlStorey__TOLERANCE_DEFAULT);

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log(failures === 0 ? '\n  PASS - every check passed.' : '\n  FAIL - ' + failures + ' check(s) failed.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
