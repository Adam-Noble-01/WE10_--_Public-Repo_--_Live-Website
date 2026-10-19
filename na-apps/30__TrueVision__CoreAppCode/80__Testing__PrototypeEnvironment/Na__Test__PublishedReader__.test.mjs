// =============================================================================
// TRUEVISION3D - TEST - THE PUBLISHED DOCUMENT READER
// =============================================================================
//
// FILE       : Na__Test__PublishedReader__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Published Documents - Reader
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Build every document in the example folder with the real reader and prove what is in the markup, and what was fetched to get it
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - THE READER IS TESTED AGAINST THE FIXTURE, WHICH IS THE POINT OF THE FIXTURE.
//   The example folder is a complete published project on disk, so the reader can
//   be driven end to end with no browser, no server and no model: fetch is stubbed
//   to read files, and what comes back is markup that can be asserted on.
// - THE TWO THINGS THAT MATTER MOST ARE BOTH CHECKED HERE:
//     1. An UNPUBLISHED drawing fetches NOTHING. Every fetch is recorded, so the
//        claim is proved rather than asserted.
//     2. The reader's import graph reaches NO renderer, projection, model loader
//        or image exporter. That is the architectural guarantee of the whole
//        design, and it is checked statically so it cannot rot.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__PublishedReader__.test.mjs
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 19-Oct-2026 - Version 1.1.0
// - Section 10: a point cloud viewport's second picture (where it is painted,
//   at what tier and opacity, against the budget) and the client's slider
//   (TrueVision3D v2.176.0).
//
// 23-Sep-2026 - Version 1.0.0
// - Created with Phases 2 and 3 of TrueVision__PLAN__PublishingSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports and Locations
// -----------------------------------------------------------------------------

    import { readFileSync, existsSync, readdirSync, mkdirSync, writeFileSync, copyFileSync, mkdtempSync } from 'node:fs';
    import { dirname, join, resolve, extname, relative } from 'node:path';
    import { tmpdir } from 'node:os';
    import { fileURLToPath, pathToFileURL } from 'node:url';

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const APP        = resolve(SCRIPT_DIR, '..');
    const MODULES    = join(APP, '02__Src__AppModules');
    const REPO       = resolve(APP, '..', '..');
    const CONTENT    = join(REPO, 'na-project-portal', '26-Projects', 'AA00__ExampleProjectStructure',
                            '30__TrueVision__AppContent');

    const READER = '52__System__Layout__PublishedDocuments';
    const SCHEMA = '53__Data__Layout__PublishedSchema';
    const UTILS  = '03__AppUtils';

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Check Harness
// -----------------------------------------------------------------------------

    let passed = 0, failed = 0;
    function check(name, condition, detail) {
        if (condition) { passed++; console.log('  ok    ' + name); return true; }
        failed++;
        console.log('  FAIL  ' + name + (detail !== undefined ? '\n        ' + detail : ''));
        return false;
    }
    function section(title) { console.log('\n' + title); }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Stage the Reader as .mjs, Keeping Its Folder Structure
// -----------------------------------------------------------------------------
//
// Node reads a .js file as CommonJS, where `import.meta` is a syntax error, so
// the app's modules cannot be imported where they lie. The QR and site plan
// tests copy single modules into a flat temp directory; the reader has
// cross-folder imports, so the FOLDERS are mirrored instead and only the .js
// extension in each specifier is rewritten. Relative paths then survive
// untouched, which is far less fragile than rewriting each one.
//
// -----------------------------------------------------------------------------

    const STAGE = mkdtempSync(join(tmpdir(), 'na-pubreader-'));

    function stageFolder(name) {
        const from = join(MODULES, name);
        const to   = join(STAGE, name);
        mkdirSync(to, { recursive : true });
        for (const entry of readdirSync(from, { withFileTypes : true })) {
            if (!entry.isFile()) continue;
            const source = join(from, entry.name);
            if (extname(entry.name) === '.js') {
                const text = readFileSync(source, 'utf8')
                    .replace(/(from\s*['"][^'"]+?)\.js(['"])/g, '$1.mjs$2')
                    .replace(/(import\(\s*['"][^'"]+?)\.js(['"]\s*\))/g, '$1.mjs$2');
                writeFileSync(join(to, entry.name.replace(/\.js$/, '.mjs')), text, 'utf8');
            } else {
                copyFileSync(source, join(to, entry.name));
            }
        }
    }
    stageFolder(READER);
    stageFolder(SCHEMA);
    stageFolder(UTILS);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A fetch That Reads the Example Folder, and Records Every Call
// -----------------------------------------------------------------------------

    const fetched = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
        const href = (input && input.href) ? input.href : String(input);
        fetched.push(href);

        let path = null;
        if (href.startsWith('file:')) path = fileURLToPath(href);

        if (!path) return { ok : false, status : 599, statusText : 'blocked in test' };
        if (!existsSync(path)) return { ok : false, status : 404, statusText : 'Not Found' };
        const text = readFileSync(path, 'utf8');
        return { ok : true, status : 200, statusText : 'OK',
                 json : async () => JSON.parse(text), text : async () => text };
    };

    const Reader = await import(pathToFileURL(join(STAGE, READER, 'Na__PubDoc__Document__.mjs')).href);
    const Urls   = await import(pathToFileURL(join(STAGE, READER, 'Na__PubDoc__Urls__.mjs')).href);
    const Vp     = await import(pathToFileURL(join(STAGE, READER, 'Na__PubDoc__Viewports__.mjs')).href);

    // Point the reader at the example folder. A base wins over the CDN/Pages
    // pair, which is exactly how a harness or a local static server drives it.
    // A real file: base is used rather than an invented scheme so the reader's
    // own url building is exercised untouched.
    const BASE = pathToFileURL(CONTENT).href;
    Urls.Na__PubDoc__Urls__Use(null, BASE);
    const isContentFetch = (href) => href.indexOf(BASE) === 0;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 1. The Index
// -----------------------------------------------------------------------------

    section('1. The project index');

    const loaded = await Reader.Na__PubDoc__LoadIndex();
    check('the index loads from the example folder', loaded.Ok, loaded.Reason);
    check('it lists five drawings in register order',
        loaded.Documents.length === 5 &&
        loaded.Documents.map((one) => one['Document__Number']).join(',') === 'D01,D02,D03,D04,D06',
        loaded.Documents.map((one) => one['Document__Number']).join(','));
    check('the project block came through',
        (Reader.Na__PubDoc__Project() || {})['Project__Code'] === 'AA00');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 2. An Unpublished Drawing Fetches NOTHING
// -----------------------------------------------------------------------------
//
// The guard, proved rather than asserted: every fetch is recorded, so the claim
// that an unpublished tab cannot start any work is a countable fact.
//
// -----------------------------------------------------------------------------

    section('2. An unpublished drawing fetches nothing at all');

    fetched.length = 0;
    const unpublished = await Reader.Na__PubDoc__Build('AA00_T02_D03', { Zoom : 1 });

    check('it builds successfully rather than failing', unpublished.Ok, unpublished.Reason);
    check('its state is unpublished', unpublished.State === 'unpublished', unpublished.State);
    check('NOT ONE FETCH was made', fetched.length === 0,
        fetched.length + ' request(s): ' + fetched.join(', '));
    check('the sheet is real A2 paper, not a message',
        unpublished.Paper.WidthMm === 594 && unpublished.Paper.HeightMm === 420,
        unpublished.Paper.WidthMm + ' x ' + unpublished.Paper.HeightMm);
    check('the grey mask is on the sheet',
        unpublished.Markup.indexOf('na-pubdoc__mask--unpublished') !== -1 &&
        unpublished.Markup.indexOf('has not yet been published') !== -1);
    check('the title block still shows the drawing number and revision',
        unpublished.Markup.indexOf('AA00_T02_D03') !== -1 &&
        unpublished.Markup.indexOf('REV B') !== -1,
        'an unpublished sheet must still say which drawing it is');
    check('no raster, no linework and no element file is referenced',
        unpublished.Markup.indexOf('03__Viewports__Raster') === -1 &&
        unpublished.Markup.indexOf('02__Viewports__Vector') === -1 &&
        unpublished.Markup.indexOf('01__Elements__Data') === -1);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 3. A Published Elevation
// -----------------------------------------------------------------------------

    section('3. A published elevation, D02');

    fetched.length = 0;
    const d02 = await Reader.Na__PubDoc__Build('AA00_T02_D02', { Zoom : 1 });

    check('it builds', d02.Ok, d02.Reason);
    check('its state is published', d02.State === 'published');
    check('the sheet svg is in paper millimetres',
        d02.Markup.indexOf('viewBox="0 0 594 420"') !== -1);

    check('exactly the manifest, the sheet and its six element files were fetched',
        fetched.filter(isContentFetch).length === 8,
        fetched.filter(isContentFetch).length + ' fetches: ' +
        fetched.filter(isContentFetch).map((one) => one.split('/').pop()).join(', '));

    check('the Tier01 raster is the one referenced, not a bigger tier',
        d02.Markup.indexOf('Viewport_001__Tier01__Fit__4f8a1c27d9.webp') !== -1 &&
        d02.Markup.indexOf('Tier03') === -1,
        'a fitted sheet must open on the smallest published picture');

    check('the linework svg is referenced over it',
        d02.Markup.indexOf('Viewport_001__Linework__4f8a1c27d9.svg') !== -1);

    check('the raster is painted BEFORE the linework',
        d02.Markup.indexOf('Tier01__Fit') < d02.Markup.indexOf('Linework'),
        'two things per viewport, the picture then the lines');

    check('every published dimension STRING is on the sheet, unaltered',
        [ '9,745', '8,275*', '2,850', '6,260 TO RIDGE' ].every((one) => d02.Markup.indexOf(one) !== -1),
        'the asterisk and the override must survive verbatim');

    check('no dimension number was recomputed anywhere',
        d02.Markup.indexOf('9744') === -1 && d02.Markup.indexOf('9745.') === -1);

    check('the pre-wrapped note lines are used, not the unwrapped original',
        d02.Markup.indexOf('repointed in a lime mortar to match the') !== -1 &&
        d02.Markup.indexOf('Existing stonework to be retained and repointed in a lime mortar') === -1,
        'Annotation__Lines is what prints; Annotation__Text is not');

    check('markdown emphasis is painted as runs, never as asterisks',
        d02.Markup.indexOf('**Staffordshire blue**') === -1 &&
        d02.Markup.indexOf('font-weight="700">Staffordshire blue</tspan>') !== -1);

    check('the bubbles and their spec codes are there',
        d02.Markup.indexOf('EL01') !== -1 && d02.Markup.indexOf('EL05') !== -1);

    check('a gradient mask is a real gradient definition, not a baked image',
        d02.Markup.indexOf('<linearGradient') !== -1 &&
        d02.Markup.indexOf('stop-opacity="0"') !== -1);

    check('the GFFL datum keeps its centre-line dash pattern',
        d02.Markup.indexOf('stroke-dasharray') !== -1);

    check('client text is escaped, so one ampersand cannot break the sheet',
        d02.Markup.indexOf('Mr &amp; Mrs Example') !== -1 &&
        d02.Markup.indexOf('Mr & Mrs') === -1);

    check('the layers were painted back to front - viewports under dimensions',
        d02.Markup.indexOf('na-pubdoc__viewport') < d02.Markup.indexOf('na-pubdoc__dim'),
        'Layer__Order 1 is frontmost, so the highest order paints first');

    check('the sheet furniture was emitted from the published marks',
        d02.Markup.indexOf('na-pubdoc__furniture') !== -1 &&
        d02.Markup.indexOf('na-pubdoc__mark--border') !== -1 &&
        d02.Markup.indexOf('NOBLE ARCHITECTURE') !== -1);

    check('the QR block is ONE path, not a module per element',
        (d02.Markup.match(/na-pubdoc__mark--qr/g) || []).length === 3,
        'a white ground, one path of dark modules and its caption');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 4. A Published Plan, and the Layer-Is-a-File Property
// -----------------------------------------------------------------------------

    section('4. A published plan, D06');

    const d06 = await Reader.Na__PubDoc__Build('AA00_T02_D06', { Zoom : 1 });
    check('it builds', d06.Ok, d06.Reason);

    check('the floor areas are painted with their PUBLISHED square metres',
        d06.Markup.indexOf('23.1 m²') !== -1 && d06.Markup.indexOf('172.6 m²') !== -1,
        'm² is never stored on the authoring side, so this can only have come from the file');

    check('the area label\'s two lines are split on the published newline',
        d06.Markup.indexOf('KITCHEN / DINING') !== -1 && d06.Markup.indexOf('1,858 ft²') !== -1);

    check('the hatch is a pattern referencing the SHARED tile',
        d06.Markup.indexOf('<pattern') !== -1 &&
        d06.Markup.indexOf('01__Shared__Patterns/Hatch__Masonry__StoneRubble__7c1e05a92b.svg') !== -1,
        'one tile per project, referenced by every shape that uses it');

    check('the removed wall keeps its dotted style', d06.Markup.indexOf('stroke-dasharray') !== -1);

    check('the published scale bar is drawn from its resolved divisions',
        d06.Markup.indexOf('na-pubdoc__scalebar') !== -1 && d06.Markup.indexOf('1m') !== -1);

    check('the three dimension rows are all present',
        [ '1,370', '5,235', '16,930' ].every((one) => d06.Markup.indexOf(one) !== -1));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 5. A Document With Nothing to Bake
// -----------------------------------------------------------------------------

    section('5. An introduction sheet, which has no viewport at all');

    const d01 = await Reader.Na__PubDoc__Build('AA00_T02_D01', { Zoom : 1 });
    check('it builds', d01.Ok, d01.Reason);
    check('it references no raster and no linework',
        d01.Markup.indexOf('03__Viewports__Raster') === -1 &&
        d01.Markup.indexOf('02__Viewports__Vector') === -1);
    check('its pictures point at the existing sheet-images folder, not a copy',
        d01.Markup.indexOf('05__Layout__DrawingDocs__Images/AA00_T02_D01/') !== -1,
        'publishing copies a picture nowhere');
    check('the frame shadow is a real filter, not a transparent PNG',
        d01.Markup.indexOf('<feDropShadow') !== -1);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 6. The Tier Ladder
// -----------------------------------------------------------------------------

    section('6. The tier ladder');

    Reader.Na__PubDoc__ForgetAll();
    const zoomed = await Reader.Na__PubDoc__Build('AA00_T02_D02', { Zoom : 8 });
    check('zoomed in, the top screen tier is used',
        zoomed.Markup.indexOf('Tier03__Detail') !== -1 && zoomed.Markup.indexOf('Tier01') === -1,
        'the ladder must step up');

    check('the Print tier is never put on screen',
        zoomed.Markup.indexOf('Print__') === -1 && d02.Markup.indexOf('Print__') === -1);

    check('only ONE tier of the viewport is held at a time',
        Vp.Na__PubVp__ShowingTier('AA00_T02_D02', 'Viewport_001') === 'Tier03' &&
        Vp.Na__PubVp__HeldBytes() === 5120 * 1371 * 4,
        'held ' + Vp.Na__PubVp__HeldBytes() + ' bytes');

    Reader.Na__PubDoc__ForgetAll();
    Vp.Na__PubVp__SetBudget(2 * 1024 * 1024);                                     // <-- 2 MB: only the smallest tier fits
    const starved = await Reader.Na__PubDoc__Build('AA00_T02_D02', { Zoom : 8 });
    check('a tight byte budget forces a SMALLER tier rather than refusing to draw',
        starved.Markup.indexOf('Tier01__Fit') !== -1,
        'a slightly soft drawing is still a drawing');
    Vp.Na__PubVp__SetBudget(134217728);

    Reader.Na__PubDoc__ForgetAll();
    Vp.Na__PubVp__Failed('AA00_T02_D02', 'Viewport_001', 'Tier03');
    const afterFail = await Reader.Na__PubDoc__Build('AA00_T02_D02', { Zoom : 8 });
    check('a tier that failed to decode is never asked for again',
        afterFail.Markup.indexOf('Tier03') === -1 && afterFail.Markup.indexOf('Tier02__Read') !== -1,
        'retrying a decode that failed for memory is what takes the page down');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 7. Broken and Refused Documents
// -----------------------------------------------------------------------------

    section('7. A document that cannot be trusted shows the mask, not half a drawing');

    const missing = await Reader.Na__PubDoc__Build('AA00_T02_D99', { Zoom : 1 });
    check('a drawing not in the index is refused with a reason',
        !missing.Ok && missing.State === 'broken' && /not in the published index/.test(missing.Reason),
        missing.Reason);

    check('the version gate refuses a newer schema and the reason reaches the sheet', await (async () => {
        const index = JSON.parse(readFileSync(join(CONTENT, '06__Layout__PublishedDocuments',
                                                   'PublishedDocuments__Index__.json'), 'utf8'));
        const saved = globalThis.fetch;
        globalThis.fetch = async (input) => {
            const href = (input && input.href) ? input.href : String(input);
            if (href.indexOf('PublishedDocuments__Index__.json') !== -1) {
                const bumped = JSON.parse(JSON.stringify(index));
                bumped['PublishedDocuments__Publish']['Publish__SchemaVersion'] = 99;
                return { ok : true, status : 200, json : async () => bumped };
            }
            return saved(input);
        };
        const refused = await Reader.Na__PubDoc__LoadIndex();
        globalThis.fetch = saved;
        const ok = !refused.Ok && /newer version/.test(refused.Reason);
        await Reader.Na__PubDoc__LoadIndex();                                     // <-- put the real index back
        return ok;
    })());

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 7A. The Live-Site Url Shape
// -----------------------------------------------------------------------------
//
// Every other section drives the reader through a base override, which skips the
// real url building entirely - and that is exactly where the one bug that would
// have masked EVERY live drawing lived. The app's folder id carries a two-digit
// year ("26/RB05__WestFarm"); NormalizeProjectFolderId only knows four-digit
// ones and would have turned it into "2026/26/RB05__WestFarm". So the url is
// built here the way the live site builds it, with a window that looks like it.
//
// -----------------------------------------------------------------------------

    section('7A. On the live site, the reader asks R2 for exactly the right key');

    const savedWindow = globalThis.window;
    const pageAt = (href) => {
        const url = new URL(href);
        globalThis.window = { location : { hostname : url.hostname, port : url.port, search : url.search, origin : url.origin } };
    };

    pageAt('https://www.noble-architecture.com/na-apps/30__TrueVision__CoreAppCode/Index.html?project-folder=RB05__WestFarm&year=26');
    Urls.Na__PubDoc__Urls__FromPage();
    const liveUrls = Urls.Na__PubDoc__Urls__All('06__Layout__PublishedDocuments/PublishedDocuments__Index__.json');
    check('the folder id from the page is taken verbatim, not re-normalised',
        Urls.Na__PubDoc__Urls__Project() === '26/RB05__WestFarm', Urls.Na__PubDoc__Urls__Project());
    check('R2 through the CDN is asked FIRST on the live site',
        liveUrls[0] === 'https://cdn.noble-architecture.com/NaProjectPortal/26-Projects/RB05__WestFarm/30__TrueVision__AppContent/06__Layout__PublishedDocuments/PublishedDocuments__Index__.json',
        liveUrls[0]);
    check('the GitHub Pages copy is only the fallback',
        liveUrls[1] === 'https://www.noble-architecture.com/na-project-portal/26-Projects/RB05__WestFarm/30__TrueVision__AppContent/06__Layout__PublishedDocuments/PublishedDocuments__Index__.json',
        liveUrls[1]);
    check('no url contains a doubled year folder',
        liveUrls.every((one) => one.indexOf('/26/') === -1 && one.indexOf('2026/26') === -1), liveUrls.join(' | '));

    pageAt('https://www.noble-architecture.com/na-apps/30__TrueVision__CoreAppCode/Index.html?project-folder=RB05__WestFarm');
    Urls.Na__PubDoc__Urls__FromPage();
    check('with no ?year= the app\'s own default ("26") is used, as the linework store does',
        Urls.Na__PubDoc__Urls__Project() === '26/RB05__WestFarm', Urls.Na__PubDoc__Urls__Project());

    pageAt('http://localhost:8090/na-apps/30__TrueVision__CoreAppCode/Index.html?project-folder=RB05__WestFarm&year=26');
    Urls.Na__PubDoc__Urls__FromPage();
    const localUrls = Urls.Na__PubDoc__Urls__All('06__Layout__PublishedDocuments/PublishedDocuments__Index__.json');
    check('on localhost the REPOSITORY copy is asked first - the file just published is on this disk',
        localUrls[0].indexOf('http://localhost:8090/na-project-portal/26-Projects/RB05__WestFarm/') === 0 &&
        localUrls[1].indexOf('https://cdn.noble-architecture.com/') === 0,
        localUrls.join(' | '));

    globalThis.window = savedWindow;
    Urls.Na__PubDoc__Urls__Use(null, BASE);                                       // <-- back to the fixture for the rest

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 8. THE ARCHITECTURAL GUARANTEE
// -----------------------------------------------------------------------------
//
// The reader must not be able to compute a drawing, and the only way to guarantee
// that is for the code not to be reachable. Checked statically, from the real
// source, so it cannot rot as the reader grows.
//
// -----------------------------------------------------------------------------

    section('8. The reader cannot reach a renderer, and that is the whole design');

    const FORBIDDEN = [
        '05__RenderPipeline', '15__ModelLoader', '30__System__ImageExport',
        '40__System__DrawingViewCore', '41__System__SectionCutEngine',
        '42__System__FloorPlanViews', '45__System__ElevationViews',
        '49__System__ElevationDepthFog', '50__System__ProjectedLinework',
        '51__System__LayoutEditor'
    ];

    const walked = new Set();
    function walk(file) {
        const key = resolve(file);
        if (walked.has(key) || !existsSync(key)) return;
        walked.add(key);
        const code = readFileSync(key, 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .split('\n').map((line) => line.replace(/^\s*\/\/.*$/, '')).join('\n');
        const specs = [ ...code.matchAll(/(?:import|export)[\s\S]{0,400}?from\s*['"]([^'"]+)['"]/g) ].map((m) => m[1])
            .concat([ ...code.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g) ].map((m) => m[1]));
        for (const spec of specs) {
            if (!spec.startsWith('.')) continue;
            walk(resolve(dirname(key), spec));
        }
    }
    for (const name of readdirSync(join(MODULES, READER))) {
        if (extname(name) === '.js') walk(join(MODULES, READER, name));
    }

    const reached = [ ...walked ].map((one) => relative(MODULES, one).replace(/\\/g, '/'));
    const breaches = reached.filter((one) => FORBIDDEN.some((bad) => one.indexOf(bad) === 0));

    check('no renderer, projection, model loader or image exporter is reachable',
        breaches.length === 0, breaches.join('\n        '));
    check('the reader depends on exactly three folders',
        [ ...new Set(reached.map((one) => one.split('/')[0])) ].sort().join(', ') ===
        [ UTILS, READER, SCHEMA ].sort().join(', '),
        [ ...new Set(reached.map((one) => one.split('/')[0])) ].sort().join(', '));

    check('every reader file carries the SCHEMA REF header pointing at the example', (() => {
        const missingRef = [];
        for (const name of readdirSync(join(MODULES, READER))) {
            if (extname(name) !== '.js') continue;
            const head = readFileSync(join(MODULES, READER, name), 'utf8').slice(0, 2400);
            if (head.indexOf('SCHEMA REF') === -1 || head.indexOf('06__Layout__PublishedDocuments') === -1) missingRef.push(name);
        }
        if (missingRef.length) console.log('        ' + missingRef.join(', '));
        return missingRef.length === 0;
    })());

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 9. The Loading Screen Names Real Work
// -----------------------------------------------------------------------------
//
// The cover itself is DOM and is checked in the app. What is checked here is
// that what it SAYS is true: the reader reports every file it asks for, once
// out and once back, and each published file is named for what it is.
//
// -----------------------------------------------------------------------------

    section('9. The loading screen names real work');

    const Load = await import(pathToFileURL(join(STAGE, READER, 'Na__PubDoc__LoadingScreen__.mjs')).href);

    Reader.Na__PubDoc__Forget('AA00_T02_D02');                                    // <-- A cached document is instant and reports nothing
    const heard = [];
    const withProgress = await Reader.Na__PubDoc__Build('AA00_T02_D02', { Zoom : 1, OnProgress : (event) => heard.push(event) });
    check('a published drawing still builds with a listener attached', withProgress.Ok, withProgress.Reason);
    const keys = [ ...new Set(heard.map((one) => one.Key)) ];
    check('the manifest, the sheet and all six element files are reported',
        [ 'manifest', 'sheet', 'element:viewport', 'element:dimension', 'element:annotation',
          'element:vector', 'element:leader', 'element:group' ].every((one) => keys.indexOf(one) !== -1) && keys.length === 8,
        keys.join(', '));
    check('each is reported once going out and once settling, in that order',
        keys.every((key) => {
            const mine = heard.filter((one) => one.Key === key);
            return mine.length === 2 && mine[0].Done === false && mine[1].Done === true;
        }));

    heard.length = 0;
    await Reader.Na__PubDoc__Build('AA00_T02_D02', { Zoom : 1, OnProgress : (event) => heard.push(event) });
    check('a drawing already loaded reports nothing - there is nothing to wait for', heard.length === 0, heard.length + ' event(s)');

    check('the headline names the drawing as its tab does',
        Load.Na__PubLoad__Headline('D02 - Elevations', '{drawing} is now loading') === 'D02 - Elevations is now loading');

    const cdn = 'https://cdn.noble-architecture.com/NaProjectPortal/26-Projects/AA00__ExampleProjectStructure/30__TrueVision__AppContent/';
    const parts = [
        [ '06__Layout__PublishedDocuments/AA00_T02_D02/03__Viewports__Raster/Viewport_001__Tier02__Read__4f8a1c27d9.webp', 'picture', 'Viewport_001' ],
        [ '06__Layout__PublishedDocuments/AA00_T02_D02/03__Viewports__Raster/Viewport_001__FogMask__Tier02__Read__4f8a1c27d9.webp', 'fog', 'Viewport_001' ],
        [ '06__Layout__PublishedDocuments/AA00_T02_D02/02__Viewports__Vector/Viewport_002__Linework__4f8a1c27d9.svg', 'linework', 'Viewport_002' ],
        [ '06__Layout__PublishedDocuments/02__Shared__Images/Image__f89e0e57c8.png', 'shared', null ],
        [ '06__Layout__PublishedDocuments/01__Shared__Patterns/Hatch__Masonry__StoneRubble__7c1e05a92b.svg', 'pattern', null ],
        [ '05__Layout__DrawingDocs__Images/AA00_T02_D01/Photo__0a982a8998.webp', 'sheetImage', null ]
    ];
    check('every published image is recognised for what it is, from its folder and name',
        parts.every(([ path, kind, view ]) => {
            const part = Load.Na__PubLoad__ImagePart(cdn + path);
            return part.Kind === kind && part.ViewportId === view;
        }));
    check('a viewport\'s parts are numbered among the drawing\'s viewports',
        Load.Na__PubLoad__ImageLabel({ Kind : 'picture', ViewportId : 'Viewport_002' }, [ 'Viewport_001', 'Viewport_002' ]) === 'Viewport 2 of 2  -  Picture' &&
        Load.Na__PubLoad__ImageLabel({ Kind : 'fog', ViewportId : 'Viewport_001' }, [ 'Viewport_001' ]) === 'Viewport  -  Depth Fog');
    check('each file the reader reports has a name a reader would use',
        Load.Na__PubLoad__ProgressLabel('element:dimension', 'dimension') === 'Dimensions' &&
        Load.Na__PubLoad__ProgressLabel('element:leader', 'leader') === 'Specification Bubbles' &&
        Load.Na__PubLoad__ProgressLabel('manifest', null) === 'Reading the Drawing');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 10. A Point Cloud Viewport, and the Client's Slider
// -----------------------------------------------------------------------------
//
// A point cloud viewport publishes a second opaque picture - the drawing with
// its point cloud at full strength - that the reader lays over the plain one at
// the viewport's own opacity (19-Oct-2026, TrueVision3D v2.176.0). Checked on a
// viewport element shaped exactly as the publisher writes JW02's, painted by
// the real painter, and on the slider's arithmetic.
//
// -----------------------------------------------------------------------------

    section('10. A point cloud viewport, and the client\'s slider');

    const Pc = await import(pathToFileURL(join(STAGE, READER, 'Na__PubDoc__PointCloud__.mjs')).href);

    const TIERS = [ [ 'Tier01', 'Fit', 1024, 183 ], [ 'Tier02', 'Read', 3072, 549 ], [ 'Tier03', 'Detail', 5120, 915 ] ];
    const tiersOf = (stem) => TIERS.map(([ id, name, w, h ]) => ({
        'Tier__Id' : id, 'Tier__File' : '03__Viewports__Raster/Viewport_001__' + stem + id + '__' + name + '__c2d0429490.webp', 'Tier__PixelW' : w, 'Tier__PixelH' : h }));
    const cloudViewport = (over, opacity, extra) => Object.assign({
        'Viewport__Id'            : 'Viewport_001',
        'Viewport__Kind'          : '2d',
        'Viewport__FrameMm'       : { X : 10, Y : 20, WidthMm : 512, HeightMm : 91.5 },
        'Viewport__RotationDeg'   : 0,
        'Viewport__PictureRectMm' : { X : 0, Y : 0, WidthMm : 512, HeightMm : 91.5 },
        'Viewport__BaseImage'     : true,
        'Viewport__RasterOpaque'  : true,
        'Viewport__Rasters'       : tiersOf(''),
        'Viewport__FogMasks'      : [],
        'Viewport__PointCloud'    : { 'PointCloud__Opacity' : opacity, 'PointCloud__OverLinework' : over,
                                      'PointCloud__Rasters' : tiersOf('PointCloud__'), 'PointCloud__DatumSvg' : '<path d="M1,1L2,2" stroke="#c0392b"/>' },
        'Viewport__Vector'        : { 'Vector__File' : '02__Viewports__Vector/Viewport_001__Linework__c2d0429490.svg', 'Vector__WidthMm' : 512, 'Vector__HeightMm' : 91.5 },
        'Viewport__SceneSvg'      : '<text class="scene-mark">scene</text>',
        'Viewport__FrameSvg'      : ''
    }, extra || {});
    const paintWith = (documentId, viewports, density) => Vp.Na__PubVp__Paint(viewports, {
        DocumentId : documentId, DefPrefix : 'na-t', Defs : [], Zoom : 1, Density : density || 0,
        Url : (relative) => relative ? ('https://cdn.test/' + relative) : null,
        Resolve : (viewport, reference) => 'JW02/' + reference,
        Tokens : (markup) => markup,
        PointCloudOpacity : (base) => Pc.Na__PubPc__OpacityFor(documentId, base)
    });
    const at = (markup, needle) => markup.indexOf(needle);

    // THE SLIDER'S ARITHMETIC
    const jw = Pc.Na__PubPc__Register('JW02_T01_D01', Vp.Na__PubVp__CloudBases([
        cloudViewport(false, 0.35), cloudViewport(false, 0.3), cloudViewport(false, 0.3), cloudViewport(false, 0.3),
        { 'Viewport__Id' : 'Viewport_009', 'Viewport__Rasters' : tiersOf('') } ]));
    check('a drawing\'s point clouds are listed from its viewports, those without one left out (JW02: 35, 30, 30, 30)',
        jw && jw.Count === 4 && jw.HomePercent === 31 && jw.LevelPercent === 31 && jw.AtHome === true, JSON.stringify(jw));
    check('as drawn, every point cloud shows exactly its own opacity',
        Pc.Na__PubPc__OpacityFor('JW02_T01_D01', 0.35) === 0.35 && Pc.Na__PubPc__OpacityFor('JW02_T01_D01', 0.3) === 0.3);
    Pc.Na__PubPc__SetLevel('JW02_T01_D01', 0);
    check('slid to 0: every point cloud off, the bare drawing',
        Pc.Na__PubPc__OpacityFor('JW02_T01_D01', 0.35) === 0 && Pc.Na__PubPc__OpacityFor('JW02_T01_D01', 0.3) === 0);
    Pc.Na__PubPc__SetLevel('JW02_T01_D01', 1);
    check('slid to 100: every point cloud at full strength',
        Pc.Na__PubPc__OpacityFor('JW02_T01_D01', 0.35) === 1 && Pc.Na__PubPc__OpacityFor('JW02_T01_D01', 0.3) === 1);
    Pc.Na__PubPc__Register('JW02_T01_D01', [ 0.35, 0.3, 0.3, 0.3 ]);
    check('the drawing built again (a tier swap) keeps where the reader left the slider',
        Pc.Na__PubPc__Summary('JW02_T01_D01').LevelPercent === 100);
    Pc.Na__PubPc__Register('JW02_T01_D01', [ 0.5, 0.5, 0.3, 0.3 ]);
    check('a re-published drawing with other point clouds starts again as issued',
        Pc.Na__PubPc__Summary('JW02_T01_D01').LevelPercent === 40 && Pc.Na__PubPc__Summary('JW02_T01_D01').AtHome);
    Pc.Na__PubPc__Register('XX01_T01_D01', [ 0.4, 0.4 ]);
    Pc.Na__PubPc__SetLevel('XX01_T01_D01', 0.2);
    const half = Pc.Na__PubPc__OpacityFor('XX01_T01_D01', 0.4);
    Pc.Na__PubPc__SetLevel('XX01_T01_D01', 0.7);
    const raised = Pc.Na__PubPc__OpacityFor('XX01_T01_D01', 0.4);
    check('with equal opacities the slider\'s figure IS the opacity on screen (20 and 70)',
        Math.abs(half - 0.2) < 1e-9 && Math.abs(raised - 0.7) < 1e-9, half + ', ' + raised);
    Pc.Na__PubPc__Register('XX02_T01_D01', [ 0.2, 0.6 ]);
    Pc.Na__PubPc__SetLevel('XX02_T01_D01', 0.7);
    const lowUp = Pc.Na__PubPc__OpacityFor('XX02_T01_D01', 0.2), highUp = Pc.Na__PubPc__OpacityFor('XX02_T01_D01', 0.6);
    Pc.Na__PubPc__SetLevel('XX02_T01_D01', 0.2);
    const lowDown = Pc.Na__PubPc__OpacityFor('XX02_T01_D01', 0.2), highDown = Pc.Na__PubPc__OpacityFor('XX02_T01_D01', 0.6);
    check('mixed opacities move in tandem: each in proportion towards full above as drawn, towards none below',
        Math.abs(lowUp - 0.6) < 1e-9 && Math.abs(highUp - 0.8) < 1e-9 && Math.abs(lowDown - 0.1) < 1e-9 && Math.abs(highDown - 0.3) < 1e-9,
        [ lowUp, highUp, lowDown, highDown ].join(', '));
    check('As drawn puts the sheet back as issued', Pc.Na__PubPc__Reset('XX02_T01_D01').AtHome === true);
    Pc.Na__PubPc__SetLevel('XX02_T01_D01', 1.7);
    check('a figure past 100 is held at 100, and the level is kept to whole percentages',
        Pc.Na__PubPc__Summary('XX02_T01_D01').LevelPercent === 100 && Pc.Na__PubPc__SetLevel('XX02_T01_D01', 0.333).Level === 0.33);
    const fakePictures = [ 0.2, 0.6 ].map((base) => ({ getAttribute : () => String(base), style : {} }));
    Pc.Na__PubPc__SetLevel('XX02_T01_D01', 0);
    const applied = Pc.Na__PubPc__Apply({ querySelectorAll : (selector) => selector === '.na-pubdoc__viewport-pointcloud' ? fakePictures : [] }, 'XX02_T01_D01');
    check('Apply sets every point cloud picture on the sheet from its own opacity and the level',
        applied === 2 && fakePictures.every((one) => one.style.opacity === '0'));
    check('a drawing without point clouds has no slider', Pc.Na__PubPc__Register('XX03_T01_D01', []) === null && Pc.Na__PubPc__Summary('XX03_T01_D01') === null);

    // THE PAINTER
    Pc.Na__PubPc__Register('JW02_T01_D01', [ 0.35 ]);
    Vp.Na__PubVp__Release(null);                                                  // <-- Nothing else held, so the budget sums are this drawing's alone
    const under = paintWith('JW02_T01_D01', [ cloudViewport(false, 0.35) ]);
    check('Linework On Top: the point cloud picture over the plain one and UNDER the linework, then the datum, then the markup',
        at(under, '__raster') < at(under, '__pointcloud') && at(under, '__pointcloud') < at(under, '__linework') &&
        at(under, '__linework') < at(under, 'na-pubdoc__viewport-datum') && at(under, 'na-pubdoc__viewport-datum') < at(under, 'scene-mark'));
    Vp.Na__PubVp__Release('JW02_T01_D01');
    const over = paintWith('JW02_T01_D01', [ cloudViewport(true, 0.35) ]);
    check('the default: the point cloud picture OVER the linework, then the datum, then the markup',
        at(over, '__raster') < at(over, '__linework') && at(over, '__linework') < at(over, '__pointcloud') &&
        at(over, '__pointcloud') < at(over, 'na-pubdoc__viewport-datum') && at(over, 'na-pubdoc__viewport-datum') < at(over, 'scene-mark'));
    check('it is the point cloud picture of the SAME tier as the plain one',
        at(under, 'Viewport_001__Tier01__Fit__') !== -1 && at(under, 'Viewport_001__PointCloud__Tier01__Fit__') !== -1 && at(under, 'Tier02') === -1);
    check('it opens at the viewport\'s own opacity, and carries it for the slider and for print',
        /class="na-pubdoc__viewport-pointcloud"[^>]*data-na-pc-base="0\.35"[^>]*style="--na-pc-base:0\.35"/.test(under) &&
        /<image[^>]*opacity="0\.35"[^>]*na-pubdoc__viewport-pointcloud/.test(under), under.slice(0, 600));
    check('both pictures count against the budget',
        Vp.Na__PubVp__HeldBytes() === 1024 * 183 * 4 * 2, 'held ' + Vp.Na__PubVp__HeldBytes());
    Vp.Na__PubVp__Release('JW02_T01_D01');
    const zoomedIn = paintWith('JW02_T01_D01', [ cloudViewport(false, 0.35) ], 11);
    check('zoomed in, both step up together',
        at(zoomedIn, 'Viewport_001__Tier03__Detail__') !== -1 && at(zoomedIn, 'Viewport_001__PointCloud__Tier03__Detail__') !== -1 && at(zoomedIn, 'Tier01') === -1);
    Vp.Na__PubVp__Release('JW02_T01_D01');
    Vp.Na__PubVp__SetBudget(1024 * 183 * 4 * 2 + 16);
    const squeezed = paintWith('JW02_T01_D01', [ cloudViewport(false, 0.35) ], 11);
    check('a budget with room for one small pair keeps both on the small tier, never one picture without the other',
        at(squeezed, 'Viewport_001__Tier01__Fit__') !== -1 && at(squeezed, 'Viewport_001__PointCloud__Tier01__Fit__') !== -1);
    Vp.Na__PubVp__SetBudget(134217728);
    Pc.Na__PubPc__SetLevel('JW02_T01_D01', 0);
    Vp.Na__PubVp__Release('JW02_T01_D01');
    const slidOff = paintWith('JW02_T01_D01', [ cloudViewport(false, 0.35) ]);
    check('painted again after the slider moved (a zoom\'s tier swap), it is painted where the slider is',
        /<image[^>]*opacity="0"[^>]*na-pubdoc__viewport-pointcloud/.test(slidOff));
    Pc.Na__PubPc__Reset('JW02_T01_D01');
    Vp.Na__PubVp__Release('JW02_T01_D01');
    const noPlain = paintWith('JW02_T01_D01', [ cloudViewport(false, 0.35, { 'Viewport__Rasters' : [], 'Viewport__BaseImage' : false }) ]);
    check('a viewport with no plain picture still shows its point cloud, and no grey "missing" panel',
        at(noPlain, 'Viewport_001__PointCloud__Tier01__Fit__') !== -1 && at(noPlain, 'na-pubdoc__viewport-missing') === -1 && at(noPlain, '__raster') === -1);
    Vp.Na__PubVp__Release('JW02_T01_D01');
    const plain = paintWith('JW02_T01_D01', [ cloudViewport(false, 0.35, { 'Viewport__PointCloud' : null }) ]);
    check('a viewport without a point cloud paints exactly as before: no second picture, no datum',
        at(plain, '__pointcloud') === -1 && at(plain, 'na-pubdoc__viewport-datum') === -1 && at(plain, '__raster') !== -1);
    Vp.Na__PubVp__Release('JW02_T01_D01');

    Reader.Na__PubDoc__Forget('AA00_T02_D02');
    const d02again = await Reader.Na__PubDoc__Build('AA00_T02_D02', { Zoom : 1 });
    check('the example\'s elevation has no point cloud, so the dock offers no slider for it',
        d02again.Ok && d02again.PointClouds === null && d02again.Markup.indexOf('na-pubdoc__viewport-pointcloud') === -1);

    check('the loading cover names the point cloud picture as its own job',
        Load.Na__PubLoad__ImagePart(cdn + '06__Layout__PublishedDocuments/JW02_T01_D01/03__Viewports__Raster/Viewport_002__PointCloud__Tier01__Fit__8f2597e422.webp').Kind === 'pointCloud' &&
        Load.Na__PubLoad__ImageLabel({ Kind : 'pointCloud', ViewportId : 'Viewport_002' }, [ 'Viewport_001', 'Viewport_002' ]) === 'Viewport 2 of 2  -  Point Cloud');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    globalThis.fetch = realFetch;
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);

// endregion -------------------------------------------------------------------
