// =============================================================================
// TRUEVISION3D - TEST - DRAWING DRAFTS, DRAWING USAGE, ELEVATION AUTO NAMES
// =============================================================================
//
// FILE       : Na__Test__DrawingDrafts__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Drawing Drafts Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove that a drawing's draft can be told from its saved state, put back exactly and IN PLACE, and kept out of somebody else's save; that the sheets drawn from a drawing are counted the way the sheet model resolves them; and that an elevation is named from its direction
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - Three modules that import nothing, so they run here exactly as the app
//   runs them. Node 20 reads the app's .js modules as CommonJS, so each is
//   copied to a temporary .mjs first.
// - THE FIXTURE IS PS01, read from the repository copy of its project data
//   when it is there: three elevations at model bearings 90 / 180 / 270 that
//   Adam lettered North / East / South by hand, each drawn twice on the
//   Elevations sheet; two floor plans, one of them drawn twice. Where the file
//   is not on disk the same shapes are built by hand, so the test never skips.
// - WHAT MUST NEVER REGRESS:
//     1. Looking at a drawing is not an edit (the view keys).
//     2. A restore keeps the record AND its arrays the same objects.
//     3. A half-moved drawing goes out of another panel's save as it was.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__DrawingDrafts__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Written with the Floor Plans and Elevations menu rebuild.
//
// =============================================================================

import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Modules Under Test
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const MODULES    = resolve(SCRIPT_DIR, '..', '02__Src__AppModules');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-drafts-'));

    async function load(folder, file, as) {
        copyFileSync(join(MODULES, folder, file), join(SCRATCH, as));
        return import(pathToFileURL(join(SCRATCH, as)).href);
    }

    const maths = await load('40__System__DrawingViewCore', 'Na__DrawView__DraftMaths__.js',   'DraftMaths.mjs');
    const usage = await load('40__System__DrawingViewCore', 'Na__DrawView__DrawingUsage__.js', 'DrawingUsage.mjs');
    const names = await load('45__System__ElevationViews',  'Na__Elevation__AutoNameText__.js', 'AutoNameText.mjs');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fixture
// -----------------------------------------------------------------------------

    const PS01_FILE = resolve(SCRIPT_DIR, '..', '..', '..', 'na-project-portal', '26-Projects', 'PS01__MustersRoad',
        '30__TrueVision__AppContent', 'TrueVision__ProjectData__.json');

    function builtFixture() {
        const viewport = (drawingId, sceneId) => ({ Viewport__Kind : '2d', Viewport__DrawingId : drawingId, Viewport__SceneId : sceneId });
        return {
            LayoutEditor__DrawingsData : {
                LayoutEditor__DrawingsData__Elevations : [
                    { Elevation__Id : 'Elevation_002', Elevation__Name : 'North Elevation', Elevation__AzimuthDeg : 90,
                      Elevation__Mode : 'elevation', Elevation__PlaneOriginMm : { PosX : 20000, PosZ : -20000 }, Elevation__ViewDepthMm : null,
                      Elevation__SceneId : 'Scene_013', Elevation__Annotations : [], Elevation__Dimensions : [],
                      Elevation__CameraZoom : 4.8, Elevation__CameraTargetMm : { PosRun : 8446, PosHeight : 2412 } }
                ],
                LayoutEditor__DrawingsData__FloorPlans : [
                    { FloorPlan__Id : 'FloorPlan_001', FloorPlan__Name : 'Floor Plan 1', FloorPlan__FloorDatumMm : 0, FloorPlan__CutOffsetMm : 1600, FloorPlan__SceneId : 'Scene_011' }
                ],
                LayoutEditor__DrawingsData__Sheets : [
                    { Sheet__Name : 'Floor Plans', Sheet__Fields : { Sheet__Fields__DrawingNumber : 'D01' },
                      Sheet__Viewports : [ viewport('FloorPlan_001', 'Scene_008'), viewport('FloorPlan_001', 'Scene_008') ] },
                    { Sheet__Name : 'Elevations', Sheet__Fields : { Sheet__Fields__DrawingNumber : 'PS01_T02_D02' },
                      Sheet__Viewports : [ viewport('Elevation_002', 'Scene_013'), viewport('Elevation_003', 'Scene_014'), viewport('Elevation_002', 'Scene_013') ] }
                ]
            }
        };
    }

    let project = builtFixture();
    let fromDisk = false;
    if (existsSync(PS01_FILE)) {
        try {
            const parsed = JSON.parse(readFileSync(PS01_FILE, 'utf8'));
            const block  = parsed && parsed.LayoutEditor__DrawingsData;
            if (block && Array.isArray(block.LayoutEditor__DrawingsData__Elevations) && block.LayoutEditor__DrawingsData__Elevations.length > 0) {
                project  = parsed;
                fromDisk = true;
            }
        } catch (_) { /* a project file mid-write: the built fixture stands in */ }
    }

    const BLOCK      = 'LayoutEditor__DrawingsData';
    const ELEVATIONS = 'LayoutEditor__DrawingsData__Elevations';
    const SHEETS     = 'LayoutEditor__DrawingsData__Sheets';
    const VIEW_KEYS  = [ 'Elevation__CameraZoom', 'Elevation__CameraTargetMm' ];

    const clone = (value) => JSON.parse(JSON.stringify(value));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let failures = 0;
    function check(name, passed, detail) {
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + ((!passed && detail !== undefined) ? '  -> ' + JSON.stringify(detail) : ''));
    }

    console.log('TrueVision3D - drawing drafts, drawing usage, elevation auto names');
    console.log('  fixture : ' + (fromDisk ? 'PS01 project data on disk' : 'built by hand (PS01 file not found)'));
    console.log('');

    // -------------------------------------------------------------------------
    console.log('Draft maths - is it changed');
    {
        const record   = clone(project[BLOCK][ELEVATIONS][0]);
        const snapshot = maths.Na__DraftMath__Snapshot(record);

        check('an untouched record is not changed', maths.Na__DraftMath__IsChanged(snapshot, record, VIEW_KEYS) === false);

        // LOOKING IS NOT EDITING | The mode controller writes these as a preview settles.
        record.Elevation__CameraZoom     = 9.99;
        record.Elevation__CameraTargetMm = { PosRun : 1, PosHeight : 2 };
        check('panning and zooming a preview is not a change', maths.Na__DraftMath__IsChanged(snapshot, record, VIEW_KEYS) === false);
        check('...but it IS one when the view keys are not named', maths.Na__DraftMath__IsChanged(snapshot, record, []) === true);

        // KEY ORDER | A restore and a normaliser both reorder keys.
        const reordered = {};
        Object.keys(record).reverse().forEach((key) => { reordered[key] = record[key]; });
        check('the same data in another key order is not a change', maths.Na__DraftMath__IsChanged(snapshot, reordered, VIEW_KEYS) === false);

        record.Elevation__PlaneOriginMm = { PosX : record.Elevation__PlaneOriginMm.PosX + 250, PosZ : record.Elevation__PlaneOriginMm.PosZ };
        record.Elevation__AzimuthDeg    = 95;
        const keys = maths.Na__DraftMath__ChangedKeys(snapshot, record, VIEW_KEYS);
        check('a moved plane and a new bearing are exactly the two changes', JSON.stringify(keys) === JSON.stringify([ 'Elevation__AzimuthDeg', 'Elevation__PlaneOriginMm' ]), keys);

        record.Elevation__NameIsAuto = true;
        check('a key added since the snapshot is a change', maths.Na__DraftMath__ChangedKeys(snapshot, record, VIEW_KEYS).indexOf('Elevation__NameIsAuto') !== -1);

        check('a snapshot of nothing is empty text', maths.Na__DraftMath__Snapshot(null) === '' && maths.Na__DraftMath__Snapshot([]) === '');
        check('nothing is reported against an empty snapshot', maths.Na__DraftMath__ChangedKeys('', record, []).length === 0);
    }

    // -------------------------------------------------------------------------
    console.log('');
    console.log('Draft maths - put it back, in place');
    {
        const record      = clone(project[BLOCK][ELEVATIONS][0]);
        if (!Array.isArray(record.Elevation__Annotations)) record.Elevation__Annotations = [];
        record.Elevation__Annotations.push({ Annotation__Id : 'A1', text : 'kept' });
        const snapshot    = maths.Na__DraftMath__Snapshot(record);
        const heldRecord  = record;
        const heldArray   = record.Elevation__Annotations;                       // <-- What the markup overlay and its undo stack hold
        const viewBefore  = clone(record.Elevation__CameraZoom);

        record.Elevation__AzimuthDeg    = 12;
        record.Elevation__Mode          = 'section';
        record.Elevation__ViewDepthMm   = 4500;
        record.Elevation__NameIsAuto    = true;                                  // <-- Added since
        record.Elevation__Annotations.push({ Annotation__Id : 'A2', text : 'thrown away' });
        record.Elevation__CameraZoom    = 7.5;                                   // <-- View state: must survive the restore

        const touched = maths.Na__DraftMath__RestoreInPlace(record, snapshot, VIEW_KEYS);

        check('after a restore nothing is changed', maths.Na__DraftMath__IsChanged(snapshot, record, VIEW_KEYS) === false);
        check('the record is the SAME object', heldRecord === record);
        check('its annotation array is the SAME array', heldArray === record.Elevation__Annotations);
        check('...holding only what was there before', record.Elevation__Annotations.length === 1 && record.Elevation__Annotations[0].Annotation__Id === 'A1');
        check('a key added since the snapshot has gone', !Object.prototype.hasOwnProperty.call(record, 'Elevation__NameIsAuto'));
        check('the view the author left it at is NOT put back', record.Elevation__CameraZoom === 7.5 && viewBefore !== 7.5);
        check('it says which keys it touched', touched.indexOf('Elevation__AzimuthDeg') !== -1 && touched.indexOf('Elevation__Annotations') !== -1 && touched.indexOf('Elevation__CameraZoom') === -1, touched);
        check('restoring again touches nothing', maths.Na__DraftMath__RestoreInPlace(record, snapshot, VIEW_KEYS).length === 0);
    }

    // -------------------------------------------------------------------------
    console.log('');
    console.log('Draft maths - somebody else saves while a drawing is half moved');
    {
        const live     = clone(project);
        const record   = live[BLOCK][ELEVATIONS][0];
        const id       = record.Elevation__Id;
        const snapshot = maths.Na__DraftMath__Snapshot(record);
        const savedX   = record.Elevation__PlaneOriginMm.PosX;

        record.Elevation__PlaneOriginMm = { PosX : savedX + 900, PosZ : record.Elevation__PlaneOriginMm.PosZ };   // <-- The stray nudge

        const payload = clone(live);                                             // <-- What Save Sheets is about to write
        const swapped = maths.Na__DraftMath__SubstituteRecord(payload, [ BLOCK, ELEVATIONS ], 'Elevation__Id', id, snapshot);

        check('the record is found and swapped', swapped === true);
        check('the save writes the plane where it was last updated', payload[BLOCK][ELEVATIONS][0].Elevation__PlaneOriginMm.PosX === savedX);
        check('the live record still holds the draft', record.Elevation__PlaneOriginMm.PosX === savedX + 900);
        check('every other elevation in the save is untouched',
            JSON.stringify(payload[BLOCK][ELEVATIONS].slice(1)) === JSON.stringify(live[BLOCK][ELEVATIONS].slice(1)));
        check('the sheets in the save are untouched', JSON.stringify(payload[BLOCK][SHEETS]) === JSON.stringify(live[BLOCK][SHEETS]));
        check('a save that does not carry the block is left alone',
            maths.Na__DraftMath__SubstituteRecord({ Other__Key : 1 }, [ BLOCK, ELEVATIONS ], 'Elevation__Id', id, snapshot) === false);
        check('an id that is not in the save swaps nothing',
            maths.Na__DraftMath__SubstituteRecord(clone(live), [ BLOCK, ELEVATIONS ], 'Elevation__Id', 'Elevation_999', snapshot) === false);
    }

    // -------------------------------------------------------------------------
    console.log('');
    console.log('Drawing usage - which sheet viewports are drawn from a drawing');
    {
        const sheets    = project[BLOCK][SHEETS];
        const elevation = project[BLOCK][ELEVATIONS][0];
        const found     = usage.Na__DrawUsage__Count(sheets, elevation.Elevation__Id, elevation.Elevation__SceneId);

        // Counted independently, the long way round, off the same data.
        let expected = 0;
        sheets.forEach((sheet) => (sheet.Sheet__Viewports || []).forEach((vp) => {
            if (vp.Viewport__Kind !== '2d') return;
            if (vp.Viewport__DrawingId ? vp.Viewport__DrawingId === elevation.Elevation__Id
                                       : (elevation.Elevation__SceneId && vp.Viewport__SceneId === elevation.Elevation__SceneId)) expected++;
        }));

        check('"' + elevation.Elevation__Name + '" is drawn by ' + expected + ' viewport(s)', found.viewports === expected && expected > 0, found);
        check('the per-sheet counts add up', found.sheets.reduce((sum, entry) => sum + entry.count, 0) === found.viewports);
        check('a sheet is named by its short code and its name', found.sheets.every((entry) => / - /.test(entry.label) || entry.label.length > 0), found.sheets);
        check('a drawing nothing uses reads as nothing', usage.Na__DrawUsage__Count(sheets, 'Elevation_999', null).viewports === 0);
        check('no drawing id reads as nothing', usage.Na__DrawUsage__Count(sheets, '', 'Scene_001').viewports === 0);

        // A 3D viewport shares a SCENE id space with the drawings' cards but draws no drawing.
        const threeD = [ { Sheet__Name : '3D', Sheet__Viewports : [ { Viewport__Kind : '3d', Viewport__SceneId : 'Scene_013' } ] } ];
        check('a 3D viewport on the same scene is not a use', usage.Na__DrawUsage__Count(threeD, 'Elevation_002', 'Scene_013').viewports === 0);

        // The fallback the sheet model makes: no drawing id of its own, so it draws what its scene shows.
        const byScene = [ { Sheet__Name : 'Old', Sheet__Viewports : [ { Viewport__Kind : '2d', Viewport__SceneId : 'Scene_013' } ] } ];
        check('a 2D viewport with no drawing id falls back to its scene', usage.Na__DrawUsage__Count(byScene, 'Elevation_002', 'Scene_013').viewports === 1);

        check('short code from a register number', usage.Na__DrawUsage__SheetLabel({ Sheet__Name : 'Elevations', Sheet__Fields : { Sheet__Fields__DrawingNumber : 'PS01_T02_D02' } }) === 'D02 - Elevations');
        check('a sheet with no number is just its name', usage.Na__DrawUsage__SheetLabel({ Sheet__Name : 'Elevations' }) === 'Elevations');

        const two = { viewports : 3, sheets : [ { label : 'D02 - Elevations', count : 2 }, { label : 'D05 - Sections', count : 1 } ] };
        check('the sentence names every sheet', usage.Na__DrawUsage__Sentence(two, 'elevation') === '2 viewports on D02 - Elevations and 1 on D05 - Sections are drawn from this elevation.', usage.Na__DrawUsage__Sentence(two, 'elevation'));
        check('one viewport is singular', usage.Na__DrawUsage__Sentence({ viewports : 1, sheets : [ { label : 'D01 - Plans', count : 1 } ] }, 'floor plan') === '1 viewport on D01 - Plans is drawn from this floor plan.');
        check('nothing using it says nothing', usage.Na__DrawUsage__Sentence({ viewports : 0, sheets : [] }, 'elevation') === '');
    }

    // -------------------------------------------------------------------------
    console.log('');
    console.log('Elevation auto names');
    {
        check('an elevation is named from its compass word', names.Na__ElevNameText__ComposeName('East', false, null) === 'East Elevation');
        check('a section says so', names.Na__ElevNameText__ComposeName('North East', true, null) === 'North East Section');
        check('no compass word is NO name, never a guess', names.Na__ElevNameText__ComposeName('', false, null) === '');
        check('config can reword it', names.Na__ElevNameText__ComposeName('East', false, { elevationName : 'Elevation - {facing}' }) === 'Elevation - East');
        check('an empty config format falls back to the shipped one', names.Na__ElevNameText__ComposeName('East', false, { elevationName : '' }) === 'East Elevation');

        const told = names.Na__ElevNameText__ComposeStatement('East', 'West', false, null);
        check('the sentence says which elevation and which way it looks', told.known === true && /East elevation/.test(told.text) && /looking west/.test(told.text), told);
        const asked = names.Na__ElevNameText__ComposeStatement('', '', false, null);
        check('with north not set it says so and claims nothing', asked.known === false && /north/i.test(asked.text) && !/elevation -/.test(asked.text), asked);

        // THE COACH HOUSE | Two buildings, two north elevations.
        check('a name nobody holds is kept', names.Na__ElevNameText__Unique('North Elevation', [ 'East Elevation' ]) === 'North Elevation');
        check('the second of a name is numbered', names.Na__ElevNameText__Unique('North Elevation', [ 'North Elevation' ]) === 'North Elevation 2');
        check('...and the third', names.Na__ElevNameText__Unique('North Elevation', [ 'north elevation ', 'North Elevation 2' ]) === 'North Elevation 3');

        // ADOPTING PS01 | Lettered by hand to the very words the namer gives.
        check('a hand-lettered "North Elevation" is recognised as automatic', names.Na__ElevNameText__IsDerivedForm('North Elevation', 'North Elevation') === true);
        check('so is its numbered twin', names.Na__ElevNameText__IsDerivedForm('North Elevation 2', 'North Elevation') === true);
        check('"Coach House North Elevation" is the author\'s own', names.Na__ElevNameText__IsDerivedForm('Coach House North Elevation', 'North Elevation') === false);
        check('"North Elevation Rear" is the author\'s own', names.Na__ElevNameText__IsDerivedForm('North Elevation Rear', 'North Elevation') === false);
        check('nothing is recognised while north is not set', names.Na__ElevNameText__IsDerivedForm('North Elevation', '') === false);
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    rmSync(SCRATCH, { recursive : true, force : true });

    console.log('');
    console.log(failures === 0 ? 'ALL CHECKS PASSED' : (failures + ' CHECK(S) FAILED'));
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
