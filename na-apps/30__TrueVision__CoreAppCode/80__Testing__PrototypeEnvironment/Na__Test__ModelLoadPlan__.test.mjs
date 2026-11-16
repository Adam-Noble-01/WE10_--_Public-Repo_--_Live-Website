// =============================================================================
// TRUEVISION3D - TEST - MODEL LOAD PLAN
// =============================================================================
//
// FILE       : Na__Test__ModelLoadPlan__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Model Load Plan Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove that the staged model load fetches the building first and
//              the heavier tiers after it, and that the category groups still
//              sit under the model root in exactly the order they always did
// CREATED    : 15-Nov-2026
//
// DESCRIPTION:
// - Runs 15__ModelLoader/Na__ModelLoader__LoadPlan__.js exactly as the app runs
//   it (it is pure: no imports), in a temporary folder with a package.json
//   that marks it an ES module.
// - THE ATTACH ORDER IS THE POINT. The model fingerprint hashes the categories
//   in the order their groups sit under the model root, and every stored
//   drawing and sheet picture is keyed by it. This test works that order out
//   the way the loader did before v2.186.0 - the priority list first, then the
//   rest in the order the project's file list first names them - and requires
//   the plan to give the same, for a fixed list and for every design phase of
//   every project in the portal (skipped when the portal is not beside the app).
// - The priority list and the two file-name patterns are READ FROM THE LOADER'S
//   SOURCE, so the test cannot drift from them.
// - Two wiring facts are read from the loader's source too: every category
//   group is created from the attach order before any file is fetched, and a
//   category's mesh root goes into its group before its linework root (the
//   content stamp reads them in that order).
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ModelLoadPlan__.test.mjs
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (15-Nov-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - Version 1.0.0 (TrueVision3D v2.186.0)
// - Initial implementation, with the staged model load.
//
// =============================================================================

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Module Under Test and the Loader's Own Constants
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const APP_ROOT   = resolve(SCRIPT_DIR, '..');
    const MODULES    = resolve(APP_ROOT, '02__Src__AppModules');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-loadplan-'));
    const PLAN_FILE  = '15__ModelLoader/Na__ModelLoader__LoadPlan__.js';

    mkdirSync(dirname(join(SCRATCH, PLAN_FILE)), { recursive : true });
    copyFileSync(join(MODULES, PLAN_FILE), join(SCRATCH, PLAN_FILE));
    writeFileSync(join(SCRATCH, 'package.json'), JSON.stringify({ type : 'module' }));

    const Plan = await import(pathToFileURL(join(SCRATCH, PLAN_FILE)).href);

    const LOADER_SOURCE   = readFileSync(join(MODULES, '15__ModelLoader/Na__ModelLoader__MultiModel.js'), 'utf8');
    const SEQUENCE_SOURCE = readFileSync(join(MODULES, '01__AppCore/Na__AppFlow__LoadingSequence.js'), 'utf8');
    const APP_CONFIG      = JSON.parse(readFileSync(join(MODULES, '02__AppData/Na__AppConfig__Main.json'), 'utf8'));

    // THE PRIORITY LIST | Read from the loader, comments and all
    const LOAD_ORDER = (() => {
        const start = LOADER_SOURCE.indexOf('const Na__ModelCategories__LoadOrder = [');
        const end   = LOADER_SOURCE.indexOf('];', start);
        if (start === -1 || end === -1) return null;
        return LOADER_SOURCE.slice(start, end).split('\n')
            .map((line) => line.replace(/\/\/.*$/, ''))
            .join('\n')
            .match(/"[^"]+"/g)
            .map((quoted) => quoted.slice(1, -1));
    })();

    // THE TWO FILE-NAME PATTERNS | Read from the loader
    const readRegex = (name) => {
        const match = new RegExp('const ' + name + '\\s*=\\s*(/.+/[a-z]*);').exec(LOADER_SOURCE);
        if (!match) return null;
        const body  = match[1];
        const slash = body.lastIndexOf('/');
        return new RegExp(body.slice(1, slash), body.slice(slash + 1));
    };
    const PARSE_REGEX  = readRegex('Na__ModelUrl__ParseRegex');
    const STOREY_REGEX = readRegex('Na__ModelUrl__StoreyParseRegex');
    const ORBIT_REGEX  = readRegex('Na__ModelUrl__OrbitCubeRegex');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Order the Loader Always Attached In (before v2.186.0)
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A File's Category, as the Loader Reads Its Name
    // ------------------------------------------------------------
    function categoryOf(url) {
        const filename = String(url).split('/').pop();
        const match = PARSE_REGEX.exec(filename);
        if (match) return 'TrueVision__' + match[2];
        const storey = STOREY_REGEX.exec(filename);
        if (storey) return 'Storey__' + storey[1] + '__' + storey[2];
        return null;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Categories of a File List, in the Order First Met
    // ------------------------------------------------------------
    function categoriesInFileOrder(urls) {
        const seen = [];
        urls.forEach((url) => {
            if (ORBIT_REGEX.test(String(url).split('/').pop())) return;         // <-- The orbit cube is separated before the models load
            const category = categoryOf(url);
            if (category && seen.indexOf(category) === -1) seen.push(category);
        });
        return seen;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | The Old Loader's Attach Order, Worked Out Its Way
    // ------------------------------------------------------------
    // Two loops: every category the priority list names, in its order; then
    // every other category in the order the file list first names it.
    // ------------------------------------------------------------
    function legacyAttachOrder(urls) {
        const found   = categoriesInFileOrder(urls);
        const ordered = [];
        for (const category of LOAD_ORDER) if (found.indexOf(category) !== -1) ordered.push(category);
        for (const category of found) if (ordered.indexOf(category) === -1) ordered.push(category);
        return ordered;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    let passed = 0;
    let failed = 0;
    function check(label, condition, detail) {
        if (condition) { passed++; console.log('  PASS  ' + label); return; }
        failed++;
        console.log('  FAIL  ' + label + (detail !== undefined ? '\n          ' + String(detail) : ''));
    }
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    try {
        console.log('\nTrueVision3D - model load plan\n');

        // 1. THE SOURCE CONSTANTS WERE FOUND
        check('the loader\'s priority list is read from its source', Array.isArray(LOAD_ORDER) && LOAD_ORDER.length >= 30, LOAD_ORDER && LOAD_ORDER.length);
        check('the loader\'s file-name patterns are read from its source', PARSE_REGEX instanceof RegExp && STOREY_REGEX instanceof RegExp && ORBIT_REGEX instanceof RegExp);

        // 2. A FIXED LIST | Storey categories in alphabetical file order, as a project's data lists them
        const base  = 'https://cdn.example/NaProjectPortal/26-Projects/XX00__Test/30__TrueVision__AppContent/DesignPhase01__ConceptDesign__Scheme-01/';
        const names = [
            '01__OrbitHelperCube__MeshModel__.glb',
            'Storey__FirstFloor__ProposedDoors', 'Storey__FirstFloor__ProposedFixtures', 'Storey__FirstFloor__ProposedFloors',
            'Storey__FirstFloor__ProposedFurniture', 'Storey__FirstFloor__ProposedInteriorDecor', 'Storey__FirstFloor__ProposedRoofs',
            'Storey__FirstFloor__ProposedStairs', 'Storey__FirstFloor__ProposedWalls', 'Storey__FirstFloor__ProposedWindows',
            'Storey__GroundFloor__ExistingWalls', 'Storey__GroundFloor__ProposedColumns', 'Storey__GroundFloor__ProposedDoors',
            'Storey__GroundFloor__ProposedFurniture', 'Storey__GroundFloor__ProposedWalls',
            'TrueVision__GroundFloorFurniture', 'TrueVision__LandscapeEnvironment', 'TrueVision__Linetype__DoorSwings',
            'TrueVision__MainBuildingModel__ProposedDoors', 'TrueVision__SiteVegetation2D'
        ];
        const urls = [];
        names.forEach((name) => {
            if (name.endsWith('.glb')) { urls.push(base + name); return; }
            urls.push(base + name + '__LineworkModel__.glb');
            if (name.indexOf('Linetype__') === -1) urls.push(base + name + '__MeshModel__.glb');
        });

        const settings = Plan.Na__LoadPlan__ResolveSettings(APP_CONFIG.models);
        const found    = categoriesInFileOrder(urls);
        const plan     = Plan.Na__LoadPlan__Build(found, LOAD_ORDER, settings.tiers);
        const legacy   = legacyAttachOrder(urls);

        check('fixed list: the groups attach in the order the loader always used', same(plan.attachOrder, legacy), plan.attachOrder.join(' | '));
        check('fixed list: the priority list still leads (a main building category, then the landscape)',
            plan.attachOrder[0] === 'TrueVision__MainBuildingModel__ProposedDoors' && plan.attachOrder[1] === 'TrueVision__LandscapeEnvironment', plan.attachOrder.slice(0, 3));
        check('fixed list: every category is in exactly one stage',
            same(plan.stages.reduce((all, stage) => all.concat(stage.keys), []).slice().sort(), plan.attachOrder.slice().sort()));

        const stageNames = plan.stages.map((stage) => stage.name);
        check('fixed list: the stages run Architecture, Fixtures, Furniture, InteriorDecor, Context, DrawingLinework',
            same(stageNames, [ 'Architecture', 'Fixtures', 'Furniture', 'InteriorDecor', 'Context', 'DrawingLinework' ]), stageNames);

        const first = plan.stages[0].keys;
        const heavy = first.filter((key) => /Fixtures|Furniture|Decor/.test(key));
        check('fixed list: no fixtures, furniture or decor in the first stage', heavy.length === 0, heavy);
        const at = (token) => first.findIndex((key) => key.endsWith(token));
        check('fixed list: in the first stage walls come before roofs, the landscape, then doors',
            at('Walls') !== -1 && at('Walls') < at('Roofs') && at('Roofs') < at('LandscapeEnvironment') && at('LandscapeEnvironment') < at('Doors'), first.join(' | '));
        check('fixed list: a category no tier names loads with the building, after what the tier names',
            first.indexOf('Storey__GroundFloor__ProposedColumns') === first.length - 1, first.slice(-2));
        check('fixed list: a linetype named after a door is drawing linework, not a door',
            plan.stages[plan.stages.length - 1].keys.indexOf('TrueVision__Linetype__DoorSwings') !== -1);
        check('fixed list: stage indices count the stages present', same(plan.stages.map((stage) => stage.index), plan.stages.map((_, index) => index)));

        // 3. CLASSIFICATION, CASE BY CASE
        const tierName = (key) => settings.tiers[Plan.Na__LoadPlan__TierOf(key, settings.tiers).tier].name;
        check('TrueVision__MainBuildingModel__Existing (the massing) is Architecture', tierName('TrueVision__MainBuildingModel__Existing') === 'Architecture');
        check('TrueVision__GroundFloorFurniture is Furniture, not Floors', tierName('TrueVision__GroundFloorFurniture') === 'Furniture');
        check('TrueVision__GroundFloorDecor is InteriorDecor', tierName('TrueVision__GroundFloorDecor') === 'InteriorDecor');
        check('Storey__FirstFloor__ExistingInteriorDecor is InteriorDecor', tierName('Storey__FirstFloor__ExistingInteriorDecor') === 'InteriorDecor');
        check('TrueVision__SiteVegetation2D is Context', tierName('TrueVision__SiteVegetation2D') === 'Context');
        check('Storey__SecondFloor__ProposedStairs is Architecture', tierName('Storey__SecondFloor__ProposedStairs') === 'Architecture');
        check('the element of Storey__GroundFloor__ProposedWalls is Walls', Plan.Na__LoadPlan__ElementOf('Storey__GroundFloor__ProposedWalls') === 'Walls');
        check('the element of TrueVision__MainBuildingModel__Proposed is empty', Plan.Na__LoadPlan__ElementOf('TrueVision__MainBuildingModel__Proposed') === '');

        // 4. SETTINGS
        check('the app config names six tiers, the building first', settings.tiers.length === 6 && settings.tiers[0].name === 'Architecture', settings.tiers.map((tier) => tier.name));
        check('the app config shows the model after the Architecture tier', settings.revealAfterTier === 'Architecture');
        check('the app config keeps an author waiting for the whole model', settings.revealEarlyWhenAuthoring === false);
        check('the app config loads the comparison\'s other phase in the background', settings.preloadCounterpart === true && settings.minCachedPhases >= 2);

        const fallback = Plan.Na__LoadPlan__ResolveSettings({});
        check('no config at all: staged, the built-in tiers, six files in flight',
            fallback.enabled === true && fallback.tiers.length === Plan.Na__LoadPlan__DEFAULT_TIERS.length && fallback.filesInFlight === 6 && fallback.revealAfterTier === 'Architecture');
        const odd = Plan.Na__LoadPlan__ResolveSettings({ ModelLoading : {
            ModelLoading__Staged__Enabled : false, ModelLoading__Staged__FilesInFlight : 999, ModelLoading__Staged__RevealAfterTier : null,
            ModelLoading__Tiers : [ { ModelLoading__Tier__Name : '', ModelLoading__Tier__ElementTokens : [ 'Walls' ] }, 'nonsense' ]
        } });
        check('a config that switches staging off, asks for 999 files and names no usable tier is held to sense',
            odd.enabled === false && odd.filesInFlight === 16 && odd.revealAfterTier === null && odd.tiers.length === Plan.Na__LoadPlan__DEFAULT_TIERS.length, JSON.stringify(odd).slice(0, 200));

        // 5. EVERY DESIGN PHASE OF EVERY PROJECT IN THE PORTAL
        const portal = resolve(APP_ROOT, '..', '..', 'na-project-portal', '26-Projects');
        if (!existsSync(portal)) {
            console.log('  SKIP  the project portal is not beside the app: the real projects were not checked');
        } else {
            let phases = 0;
            let wrong  = [];
            let noFirstStageHeavy = true;
            readdirSync(portal, { withFileTypes : true }).filter((entry) => entry.isDirectory()).forEach((entry) => {
                const file = join(portal, entry.name, '30__TrueVision__AppContent', 'TrueVision__ProjectData__.json');
                if (!existsSync(file)) return;
                let data = null;
                try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (error) { return; }
                (Array.isArray(data.modelGroups) ? data.modelGroups : []).forEach((group) => {
                    const groupUrls = Array.isArray(group.modelUrls) ? group.modelUrls : [];
                    if (groupUrls.length === 0) return;
                    phases++;
                    const real = Plan.Na__LoadPlan__Build(categoriesInFileOrder(groupUrls), LOAD_ORDER, settings.tiers);
                    if (!same(real.attachOrder, legacyAttachOrder(groupUrls))) wrong.push(entry.name + ' / ' + group.label);
                    if (real.stages.length > 0 && real.stages[0].name === 'Architecture' && real.stages[0].keys.some((key) => /Fixtures|Furniture|Decor/.test(key))) noFirstStageHeavy = false;
                });
            });
            check('real projects: ' + phases + ' design phase(s) attach in the order the loader always used', phases > 0 && wrong.length === 0, wrong.join('; '));
            check('real projects: no fixtures, furniture or decor in any first stage', noFirstStageHeavy);
        }

        // 6. THE LOADER AND THE LOADING SEQUENCE, AS WRITTEN
        const groupsAt = LOADER_SOURCE.indexOf('plan.attachOrder.forEach((category) => {');
        const loadsAt  = LOADER_SOURCE.indexOf('const loadCategory = async (category, stage) => {');
        check('the loader creates every category group from the attach order before it fetches a file', groupsAt !== -1 && loadsAt !== -1 && groupsAt < loadsAt);
        const meshAt     = LOADER_SOURCE.indexOf('if (built.meshRoot)     categoryGroup.add(built.meshRoot);');
        const lineworkAt = LOADER_SOURCE.indexOf('if (built.lineworkRoot) categoryGroup.add(built.lineworkRoot);');
        check('the loader puts a category\'s mesh root in its group before its linework root', meshAt !== -1 && lineworkAt !== -1 && meshAt < lineworkAt);

        const finishAt = SEQUENCE_SOURCE.indexOf('const Na__FinishLiveModel = () => {');
        const finishTo = SEQUENCE_SOURCE.indexOf('// HELPER FUNCTION | The Reader Left the 3D View While the Model Is Still Arriving');
        const liveCall = 'Na__PhaseLib__SetLive(undefined, Na__LoadedModelGroups);';
        const liveAt   = SEQUENCE_SOURCE.indexOf(liveCall);
        check('the loading sequence tells the design phase library the model is live only when it is whole',
            finishAt !== -1 && finishTo > finishAt && liveAt > finishAt && liveAt < finishTo && SEQUENCE_SOURCE.indexOf(liveCall, liveAt + 1) === -1);
        check('the loading sequence shows an author the model only when it is whole, unless the config says otherwise',
            SEQUENCE_SOURCE.indexOf('(!Na__DevGate__IsAuthoringEnabled() || Na__LoadSettings.revealEarlyWhenAuthoring)') !== -1);

    } finally {
        rmSync(SCRATCH, { recursive : true, force : true });
    }

    console.log('\n  ' + passed + ' passed, ' + failed + ' failed\n');
    process.exit(failed === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
