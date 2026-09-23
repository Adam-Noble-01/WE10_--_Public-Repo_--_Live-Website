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
// REGION | Result
// -----------------------------------------------------------------------------

    globalThis.fetch = realFetch;
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);

// endregion -------------------------------------------------------------------
