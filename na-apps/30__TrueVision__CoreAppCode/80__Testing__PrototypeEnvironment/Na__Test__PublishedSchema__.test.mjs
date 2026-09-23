// =============================================================================
// TRUEVISION3D - TEST - PUBLISHED SCHEMA AGAINST THE EXAMPLE FOLDER
// =============================================================================
//
// FILE       : Na__Test__PublishedSchema__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Published Schema - Paths, Tables and Version Gate
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the schema module and the readable example folder agree, file by file
// CREATED    : 23-Sep-2026
//
// DESCRIPTION:
// - THIS IS THE PARITY CHECK, MADE EXECUTABLE. The example folder in the project
//   portal is the readable schema; this test walks it and asserts that every
//   path the schema module builds is a file that actually exists there, that
//   every tier's pixel arithmetic reproduces the figures the example's manifests
//   record, and that the version gate accepts the example and refuses a bumped
//   one. A key that moves in code and not in the example fails here.
// - IT ALSO PROVES THE FALLBACK. The module is loaded twice: once with fetch
//   reading the real schema JSON off disk, once with fetch refusing, so the
//   built-in tables are exercised as well as the document.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__PublishedSchema__.test.mjs
//
//   Exit 0 = the code and the example folder agree. Exit 1 = they do not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 23-Sep-2026 - Version 1.0.0
// - Created with Phase 1 of TrueVision__PLAN__PublishingSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports and Locations
// -----------------------------------------------------------------------------

    import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync, mkdtempSync } from 'node:fs';
    import { dirname, join, resolve } from 'node:path';
    import { tmpdir } from 'node:os';
    import { fileURLToPath, pathToFileURL } from 'node:url';

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const APP        = resolve(SCRIPT_DIR, '..');
    const MODULES    = join(APP, '02__Src__AppModules');
    const SCHEMA_DIR = join(MODULES, '53__Data__Layout__PublishedSchema');
    const REPO       = resolve(APP, '..', '..');

    // The readable schema: the example project's published documents folder.
    const CONTENT    = join(REPO, 'na-project-portal', '26-Projects', 'AA00__ExampleProjectStructure',
                            '30__TrueVision__AppContent');
    const EXAMPLE    = join(CONTENT, '06__Layout__PublishedDocuments');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Check Harness
// -----------------------------------------------------------------------------

    let passed = 0;
    let failed = 0;
    function check(name, condition, detail) {
        if (condition) { passed++; console.log('  ok    ' + name); return true; }
        failed++;
        console.log('  FAIL  ' + name + (detail !== undefined ? '\n        ' + detail : ''));
        return false;
    }
    function section(title) { console.log('\n' + title); }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Stage the Modules and Load Them
// -----------------------------------------------------------------------------
//
// Node reads a .js file as CommonJS, so an app module cannot be imported where it
// lies - `import.meta` is a syntax error there. The house pattern (the QR and
// site plan store tests both do this) is to copy the modules into a temp
// directory as .mjs with the specifier between them rewritten. The schema JSON
// goes across too, so `new URL('./Na__PublishedSchema__.json', import.meta.url)`
// finds it and the REAL folding path is exercised against the REAL document,
// rather than quietly testing the built-in fallback and calling that a pass.
//
// Node's fetch cannot read a file: URL at all, so it is stubbed to read from
// disk. Region 7 then stages a second copy with NO JSON beside it, which
// exercises the fallback for real.
//
// -----------------------------------------------------------------------------

    const realFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
        const href = (input && input.href) ? input.href : String(input);
        if (href.startsWith('file:')) {
            const path = fileURLToPath(href);
            if (!existsSync(path)) return { ok : false, status : 404, statusText : 'Not Found' };
            const text = readFileSync(path, 'utf8');
            return { ok : true, status : 200, statusText : 'OK', json : async () => JSON.parse(text), text : async () => text };
        }
        return { ok : false, status : 599, statusText : 'blocked in test' };
    };

    // HELPER | Stage the schema modules into a directory as .mjs, optionally with the JSON
    const stage = (withJson) => {
        const dir = mkdtempSync(join(tmpdir(), 'na-pubschema-'));
        // MATCHED WITHOUT ITS SPELLING, deliberately: an exact-string rewrite is
        // what broke the QR test when its module moved (23-Sep-2026).
        const paths = readFileSync(join(SCHEMA_DIR, 'Na__PublishedSchema__Paths__.js'), 'utf8');
        writeFileSync(join(dir, 'Paths.mjs'), paths, 'utf8');
        const version = readFileSync(join(SCHEMA_DIR, 'Na__PublishedSchema__Version__.js'), 'utf8')
            .replace(/'\.\/Na__PublishedSchema__Paths__\.js'/, "'./Paths.mjs'");
        writeFileSync(join(dir, 'Version.mjs'), version, 'utf8');
        if (withJson) copyFileSync(join(SCHEMA_DIR, 'Na__PublishedSchema__.json'), join(dir, 'Na__PublishedSchema__.json'));
        return dir;
    };

    const STAGED  = stage(true);
    const Paths   = await import(pathToFileURL(join(STAGED, 'Paths.mjs')).href);
    const Version = await import(pathToFileURL(join(STAGED, 'Version.mjs')).href);

    const setup = await Paths.Na__PubSchema__Ready();

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 1. The Schema JSON Folded, and the Example Folder Is Where It Says
// -----------------------------------------------------------------------------

    section('1. The schema document folded, and the example folder is where it says');

    const schemaJson = JSON.parse(readFileSync(join(SCHEMA_DIR, 'Na__PublishedSchema__.json'), 'utf8'));

    check('the schema JSON was read, not the built-in fallback',
        setup.tiers.length === schemaJson['PublishedSchema__RasterTiers']['RasterTiers__Tiers'].length &&
        setup.kinds.length === schemaJson['PublishedSchema__Elements']['Elements__Kinds'].length,
        'folded ' + setup.tiers.length + ' tiers and ' + setup.kinds.length + ' kinds');

    check('the example folder exists at the declared root name',
        existsSync(EXAMPLE) && Paths.Na__PubSchema__RootFolder() === '06__Layout__PublishedDocuments',
        Paths.Na__PubSchema__RootFolder());

    check('the SCHEMA REF in the schema JSON points at the example folder',
        existsSync(join(REPO, schemaJson['PublishedSchema__Meta']['Meta__SchemaRef'])),
        schemaJson['PublishedSchema__Meta']['Meta__SchemaRef']);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 2. Every Built Path Is a File That Exists in the Example
// -----------------------------------------------------------------------------
//
// A path builder is only correct if the file is there. Paths are project-content
// relative, so they resolve against 30__TrueVision__AppContent.
//
// -----------------------------------------------------------------------------

    section('2. Every path the module builds is a real file in the example');

    const onDisk = (projectRelative) => existsSync(join(CONTENT, projectRelative));

    const indexPath = Paths.Na__PubSchema__IndexPath();
    check('IndexPath -> ' + indexPath, onDisk(indexPath));

    const index      = JSON.parse(readFileSync(join(CONTENT, indexPath), 'utf8'));
    const documents  = index['PublishedDocuments__Documents'];
    const STATES     = Paths.Na__PubSchema__States();
    const published  = documents.filter((one) => one['Document__State'] === STATES.published);
    const unpublished= documents.filter((one) => one['Document__State'] === STATES.unpublished);

    check('the index lists documents in both states the reader branches on',
        published.length === 3 && unpublished.length === 2,
        published.length + ' published, ' + unpublished.length + ' unpublished');

    for (const entry of published) {
        const id = entry['Document__Id'];

        check('DocumentId(' + entry['Document__Number'] + ') composes to the folder name',
            Paths.Na__PubSchema__DocumentId(index['PublishedDocuments__Project']['Project__Code'],
                                            entry['Document__Phase'], entry['Document__Number']) === id,
            id);

        check(id + ' ManifestPath', onDisk(Paths.Na__PubSchema__ManifestPath(id)));
        check(id + ' SheetPath',    onDisk(Paths.Na__PubSchema__SheetPath(id)));

        // Every element file the manifest names must be the path the builder makes
        const manifest = JSON.parse(readFileSync(join(CONTENT, Paths.Na__PubSchema__ManifestPath(id)), 'utf8'));
        const elements = manifest['PublishedDocument__Files']['Files__Elements'];
        let elementsOk = true;
        for (const file of elements) {
            const built = Paths.Na__PubSchema__ElementPath(id, file['File__Type'] || file['File__Path'].split('/').pop());
            const want  = Paths.Na__PubSchema__DocumentFolder(id) + '/' + file['File__Path'];
            if (built !== want || !onDisk(built)) {
                elementsOk = false;
                console.log('        ' + file['File__Type'] + ': built ' + built + ' wanted ' + want);
            }
        }
        check(id + ' every element file in the manifest is where ElementPath says (' + elements.length + ')', elementsOk);

        // Element array keys must be the ones the files actually use
        let keysOk = true;
        for (const file of elements) {
            const kind  = Paths.Na__PubSchema__Kind(file['File__Type']) || Paths.Na__PubSchema__Kind(file['File__Path'].split('/').pop());
            const whole = JSON.parse(readFileSync(join(CONTENT, Paths.Na__PubSchema__DocumentFolder(id) + '/' + file['File__Path']), 'utf8'));
            if (!kind || !Array.isArray(whole[kind.arrayKey])) {
                keysOk = false;
                console.log('        ' + file['File__Path'] + ' has no array at ' + (kind ? kind.arrayKey : '(no kind)'));
            }
        }
        check(id + ' every element file holds its array at the declared Kind__ArrayKey', keysOk);

        // Viewport vector and raster paths
        const viewports = manifest['PublishedDocument__Files']['Files__Viewports'];
        let viewportsOk = true;
        for (const viewport of viewports) {
            const vid  = viewport['Viewport__Id'];
            const hash = viewport['Viewport__Hash'];
            const vector = Paths.Na__PubSchema__VectorPath(id, vid, hash);
            const wantV  = Paths.Na__PubSchema__DocumentFolder(id) + '/' + viewport['Viewport__Vector']['File__Path'];
            if (vector !== wantV || !onDisk(vector)) {
                viewportsOk = false;
                console.log('        vector: built ' + vector + ' wanted ' + wantV);
            }
            for (const raster of viewport['Viewport__Rasters']) {
                const built = Paths.Na__PubSchema__RasterPath(id, vid, raster['Tier__Id'], hash);
                const wantR = Paths.Na__PubSchema__DocumentFolder(id) + '/' + raster['File__Path'];
                if (built !== wantR || !onDisk(built)) {
                    viewportsOk = false;
                    console.log('        ' + raster['Tier__Id'] + ': built ' + built + ' wanted ' + wantR);
                }
            }
        }
        check(id + ' every viewport vector and raster path is exact and on disk', viewportsOk);
    }

    for (const entry of unpublished) {
        check(entry['Document__Id'] + ' is unpublished and has NO folder on disk',
            entry['Document__Folder'] === null && !existsSync(join(EXAMPLE, entry['Document__Id'])),
            'the grey-mask path must have nothing to fetch');
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 3. The Tier Arithmetic Reproduces the Example's Own Figures
// -----------------------------------------------------------------------------
//
// The manifests record File__PixelW / File__PixelH for every tier of every
// viewport. Those were worked out by hand when the example was written; the
// module must arrive at the same numbers from the viewport's paper size, or the
// publisher will write files whose names and dimensions disagree with the plan.
//
// -----------------------------------------------------------------------------

    section('3. TierPixels reproduces every pixel size the example records');

    let tierOk = true;
    let tierCount = 0;
    for (const entry of published) {
        const id = entry['Document__Id'];
        const manifest = JSON.parse(readFileSync(join(CONTENT, Paths.Na__PubSchema__ManifestPath(id)), 'utf8'));
        // D01 is the introduction sheet: no model viewport, so no viewport element
        // file and no raster folder at all. A document with nothing to bake is a
        // case the reader must handle, so the test must not assume the file exists.
        const viewportFile = join(CONTENT, Paths.Na__PubSchema__ElementPath(id, 'viewport'));
        const viewportElements = existsSync(viewportFile)
            ? (JSON.parse(readFileSync(viewportFile, 'utf8'))['Elements__Viewports'] || [])
            : [];

        for (const viewport of manifest['PublishedDocument__Files']['Files__Viewports']) {
            const element = viewportElements.find((one) => one['Viewport__Id'] === viewport['Viewport__Id']);
            if (!element) { tierOk = false; console.log('        no element for ' + viewport['Viewport__Id']); continue; }
            const frame = element['Viewport__FrameMm'];
            for (const raster of viewport['Viewport__Rasters']) {
                const got = Paths.Na__PubSchema__TierPixels(raster['Tier__Id'], frame['WidthMm'], frame['HeightMm']);
                tierCount++;
                if (!got || got.PixelW !== raster['File__PixelW'] || got.PixelH !== raster['File__PixelH']) {
                    tierOk = false;
                    console.log('        ' + id + ' ' + raster['Tier__Id'] + ': computed ' +
                                (got ? got.PixelW + 'x' + got.PixelH : 'null') +
                                ', example records ' + raster['File__PixelW'] + 'x' + raster['File__PixelH']);
                }
            }
        }
    }
    check('every tier pixel size matches the example (' + tierCount + ' checked)', tierOk);

    // EVERY IMAGE FILE'S REAL DIMENSIONS, read out of its own header. The figures
    // in a manifest are a promise; this is the only check that the file keeps it.
    // The example's Tier02/Tier03/Print sizes were originally worked out from a
    // ROUNDED frame height and disagreed with the frame its own element file
    // records - caught here on the first run, 23-Sep-2026.
    const imageSize = (path) => {
        const bytes = readFileSync(path);
        if (bytes.slice(0, 8).equals(Buffer.from([ 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a ]))) {
            return { w : bytes.readUInt32BE(16), h : bytes.readUInt32BE(20) };     // <-- PNG IHDR
        }
        if (bytes.slice(0, 4).toString('latin1') === 'RIFF' && bytes.slice(8, 12).toString('latin1') === 'WEBP') {
            const kind = bytes.slice(12, 16).toString('latin1');
            if (kind === 'VP8 ') return { w : bytes.readUInt16LE(26) & 0x3fff, h : bytes.readUInt16LE(28) & 0x3fff };
            if (kind === 'VP8L') {
                const bits = bytes.readUInt32LE(21);
                return { w : (bits & 0x3fff) + 1, h : ((bits >> 14) & 0x3fff) + 1 };
            }
            if (kind === 'VP8X') return { w : (bytes.readUIntLE(24, 3) & 0xffffff) + 1, h : (bytes.readUIntLE(27, 3) & 0xffffff) + 1 };
        }
        return null;
    };

    check('every raster FILE is the pixel size its manifest promises', (() => {
        let ok = true;
        for (const entry of published) {
            const manifest = JSON.parse(readFileSync(join(CONTENT,
                Paths.Na__PubSchema__ManifestPath(entry['Document__Id'])), 'utf8'));
            for (const viewport of manifest['PublishedDocument__Files']['Files__Viewports']) {
                for (const raster of viewport['Viewport__Rasters']) {
                    const size = imageSize(join(CONTENT, Paths.Na__PubSchema__DocumentFolder(entry['Document__Id']) + '/' + raster['File__Path']));
                    if (!size) { console.log('        unreadable header: ' + raster['File__Path']); ok = false; continue; }
                    if (size.w !== raster['File__PixelW'] || size.h !== raster['File__PixelH']) {
                        ok = false;
                        console.log('        ' + raster['File__Path'] + ': file ' + size.w + 'x' + size.h +
                                    ', manifest ' + raster['File__PixelW'] + 'x' + raster['File__PixelH']);
                    }
                }
            }
        }
        return ok;
    })());

    check('DecodedBytes in the example is width x height x 4 throughout', (() => {
        for (const entry of published) {
            const manifest = JSON.parse(readFileSync(join(CONTENT,
                Paths.Na__PubSchema__ManifestPath(entry['Document__Id'])), 'utf8'));
            for (const viewport of manifest['PublishedDocument__Files']['Files__Viewports']) {
                for (const raster of viewport['Viewport__Rasters']) {
                    if (raster['File__PixelW'] * raster['File__PixelH'] * 4 !== raster['File__DecodedBytes']) {
                        console.log('        ' + raster['File__Path'] + ': ' +
                                    (raster['File__PixelW'] * raster['File__PixelH'] * 4) +
                                    ' computed vs ' + raster['File__DecodedBytes'] + ' recorded');
                        return false;
                    }
                }
            }
        }
        return true;
    })());

    // THE MANIFEST AND THE VIEWPORT ELEMENT FILE BOTH RECORD TIER SIZES, and the
    // reader reads the ELEMENT file while every earlier check read the manifest.
    // They drifted apart the first time the manifests were corrected, and nothing
    // here noticed until the reader's byte accounting came out 20,480 bytes wrong.
    check('the manifest and the viewport element file agree about every tier size', (() => {
        let ok = true;
        for (const entry of published) {
            const id       = entry['Document__Id'];
            const manifest = JSON.parse(readFileSync(join(CONTENT, Paths.Na__PubSchema__ManifestPath(id)), 'utf8'));
            const file     = join(CONTENT, Paths.Na__PubSchema__ElementPath(id, 'viewport'));
            if (!existsSync(file)) continue;
            const elements = JSON.parse(readFileSync(file, 'utf8'))['Elements__Viewports'] || [];
            for (const viewport of manifest['PublishedDocument__Files']['Files__Viewports']) {
                const element = elements.find((one) => one['Viewport__Id'] === viewport['Viewport__Id']);
                if (!element) { ok = false; console.log('        ' + id + ': no element for ' + viewport['Viewport__Id']); continue; }
                for (const raster of viewport['Viewport__Rasters']) {
                    const tier = (element['Viewport__Rasters'] || []).find((one) => one['Tier__Id'] === raster['Tier__Id']);
                    if (!tier) { ok = false; console.log('        ' + id + ': element has no ' + raster['Tier__Id']); continue; }
                    if (tier['Tier__PixelW'] !== raster['File__PixelW'] || tier['Tier__PixelH'] !== raster['File__PixelH']) {
                        ok = false;
                        console.log('        ' + id + ' ' + raster['Tier__Id'] + ': element ' +
                                    tier['Tier__PixelW'] + 'x' + tier['Tier__PixelH'] + ', manifest ' +
                                    raster['File__PixelW'] + 'x' + raster['File__PixelH']);
                    }
                    if (tier['Tier__File'] !== raster['File__Path']) {
                        ok = false;
                        console.log('        ' + id + ' ' + raster['Tier__Id'] + ': element names ' + tier['Tier__File'] +
                                    ', manifest names ' + raster['File__Path']);
                    }
                }
            }
        }
        return ok;
    })());

    check('the tier ladder is ordered and only the last screen tier is open-ended', (() => {
        const screen = Paths.Na__PubSchema__ScreenTiers();
        for (let i = 0; i < screen.length - 1; i++) {
            if (screen[i].pixelsPerMm >= screen[i + 1].pixelsPerMm) return false;
            if (screen[i].upToZoom == null) return false;
        }
        return screen.length > 0 && screen[screen.length - 1].upToZoom == null;
    })());

    check('TierForZoom walks the ladder and never falls off either end', (() => {
        const screen = Paths.Na__PubSchema__ScreenTiers();
        const cases  = [ [ 0, screen[0].id ], [ -5, screen[0].id ], [ 1, screen[0].id ],
                         [ 1.5, screen[0].id ], [ 1.51, screen[1].id ], [ 4.5, screen[1].id ],
                         [ 4.51, screen[2].id ], [ 64, screen[2].id ], [ NaN, screen[0].id ] ];
        return cases.every(([ zoom, want ]) => Paths.Na__PubSchema__TierForZoom(zoom).id === want);
    })());

    check('the Print tier is never offered as a screen tier',
        Paths.Na__PubSchema__ScreenTiers().every((one) => one.id !== 'Print') &&
        Paths.Na__PubSchema__Tier('Print') !== null);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 4. Shared and Cross-Folder References Resolve
// -----------------------------------------------------------------------------

    section('4. Shared and cross-folder references resolve to real files');

    const shared = '/01__Shared__Patterns/Hatch__Masonry__StoneRubble__7c1e05a92b.svg';
    check('a leading-slash shared reference resolves under the published root',
        onDisk(Paths.Na__PubSchema__SharedPath(shared)), Paths.Na__PubSchema__SharedPath(shared));

    check('the hatch tile named by D06 is the shared file that exists', (() => {
        const vectors = JSON.parse(readFileSync(join(CONTENT,
            Paths.Na__PubSchema__ElementPath('AA00_T02_D06', 'vector')), 'utf8'))['Elements__Vectors'];
        const hatched = vectors.find((one) => one['Shape__Hatch']);
        if (!hatched) return false;
        const resolved = Paths.Na__PubSchema__ResolveDocumentRef('AA00_T02_D06', hatched['Shape__Hatch']['Hatch__TileSvg']);
        return resolved !== null && onDisk(resolved);
    })());

    check('a "/../" picture reference leaves the published root but stays in the project', (() => {
        const images = JSON.parse(readFileSync(join(CONTENT,
            Paths.Na__PubSchema__ElementPath('AA00_T02_D01', 'image')), 'utf8'))['Elements__Images'];
        const resolved = Paths.Na__PubSchema__ResolveDocumentRef('AA00_T02_D01', images[0]['Shape__Image']['Image__Source']);
        return resolved === '05__Layout__DrawingDocs__Images/AA00_T02_D01/' + images[0]['Shape__Image']['Image__File'];
    })());

    check('a reference that tries to climb out of the project is refused',
        Paths.Na__PubSchema__ResolveDocumentRef('AA00_T02_D02', '../../../secrets.json') === null &&
        Paths.Na__PubSchema__SharedPath('/../../secrets.json') === null);

    check('a document id that is not a segment builds no path at all',
        Paths.Na__PubSchema__DocumentFolder('../../etc') === null &&
        Paths.Na__PubSchema__ManifestPath('') === null &&
        Paths.Na__PubSchema__RasterPath('AA00_T02_D02', 'Viewport_001', 'NoSuchTier', 'abc') === null);

    check('the archive zip name and its local-only path match the example', (() => {
        const name = Paths.Na__PubSchema__ArchiveName('AA00_T02_D02', 'A');
        return name === 'AA00_T02_D02__Revision__A.zip' &&
               onDisk(Paths.Na__PubSchema__ArchivePath('AA00_T02_D02', 'A')) &&
               Paths.Na__PubSchema__ArchivePath('AA00_T02_D02', 'A').indexOf('/00__') !== -1;
    })(), 'the 00__ prefix is what keeps archives off R2');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 5. The Version Gate
// -----------------------------------------------------------------------------

    section('5. The version gate accepts the example and refuses anything else');

    check('the example index passes the gate', Version.Na__PubVer__ReadsIndex(index).Ok,
        Version.Na__PubVer__ReadsIndex(index).Reason);

    check('the schema JSON and the example index carry the SAME schema version',
        index['PublishedDocuments__Publish']['Publish__SchemaVersion'] === Version.Na__PubVer__Current(),
        'example ' + index['PublishedDocuments__Publish']['Publish__SchemaVersion'] +
        ' vs code ' + Version.Na__PubVer__Current() + ' - if these differ the example is stale');

    let manifestsOk = true;
    for (const entry of published) {
        const manifest = JSON.parse(readFileSync(join(CONTENT,
            Paths.Na__PubSchema__ManifestPath(entry['Document__Id'])), 'utf8'));
        if (!Version.Na__PubVer__ReadsManifest(manifest).Ok) {
            manifestsOk = false;
            console.log('        ' + entry['Document__Id'] + ': ' + Version.Na__PubVer__ReadsManifest(manifest).Reason);
        }
    }
    check('every published manifest passes the gate', manifestsOk);

    check('a NEWER schema is refused, with a reason naming both versions', (() => {
        const bumped = JSON.parse(JSON.stringify(index));
        bumped['PublishedDocuments__Publish']['Publish__SchemaVersion'] = Version.Na__PubVer__Current() + 1;
        const verdict = Version.Na__PubVer__ReadsIndex(bumped);
        return !verdict.Ok && verdict.Code === 'tooNew' && verdict.Reason.indexOf('newer') !== -1;
    })());

    check('an OLDER schema is refused, and the reason says to publish again', (() => {
        const stale = JSON.parse(JSON.stringify(index));
        stale['PublishedDocuments__Publish']['Publish__SchemaVersion'] = Version.Na__PubVer__Current() - 1;
        const verdict = Version.Na__PubVer__ReadsIndex(stale);
        return !verdict.Ok && verdict.Code === 'tooOld' && verdict.Reason.indexOf('publishing again') !== -1;
    })());

    check('a file with no version at all is refused rather than read optimistically',
        !Version.Na__PubVer__ReadsIndex({}).Ok && !Version.Na__PubVer__ReadsManifest(null).Ok);

    check('the publish stamp carries the current schema version, never a typed one', (() => {
        const stamp = Version.Na__PubVer__Stamp('v2.142.0');
        return stamp.Publish__SchemaVersion === Version.Na__PubVer__Current() &&
               stamp.Publish__ByAppVersion === 'v2.142.0' &&
               Number.isInteger(stamp.Publish__AtEpochMs);
    })());

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 6. Nothing in the Example Is Unaccounted For
// -----------------------------------------------------------------------------
//
// The checks above walk from the code outwards. This one walks from the folder
// inwards, so a file sitting in the example that no manifest names - the shape a
// half-finished schema change takes - is caught too.
//
// -----------------------------------------------------------------------------

    section('6. Every file in the example folder is one the schema accounts for');

    const walk = (dir, into = []) => {
        for (const name of readdirSync(dir, { withFileTypes : true })) {
            const full = join(dir, name.name);
            if (name.isDirectory()) walk(full, into);
            else into.push(full.slice(EXAMPLE.length + 1).replace(/\\/g, '/'));
        }
        return into;
    };
    const everyFile = walk(EXAMPLE);

    const accounted = new Set([ setup.files.index, setup.files.readMe ]);
    accounted.add(setup.folders.archive + '/Archive__ReadMe__.note');
    accounted.add(setup.folders.archive + '/' + Paths.Na__PubSchema__ArchiveName('AA00_T02_D02', 'A'));
    accounted.add(setup.folders.shared + '/Hatch__Masonry__StoneRubble__7c1e05a92b.svg');
    for (const entry of published) {
        const id = entry['Document__Id'];
        const manifest = JSON.parse(readFileSync(join(CONTENT, Paths.Na__PubSchema__ManifestPath(id)), 'utf8'));
        accounted.add(id + '/' + setup.files.manifest);
        accounted.add(id + '/' + manifest['PublishedDocument__Files']['Files__Sheet']['File__Path']);
        for (const file of manifest['PublishedDocument__Files']['Files__Elements']) accounted.add(id + '/' + file['File__Path']);
        for (const viewport of manifest['PublishedDocument__Files']['Files__Viewports']) {
            accounted.add(id + '/' + viewport['Viewport__Vector']['File__Path']);
            for (const raster of viewport['Viewport__Rasters']) accounted.add(id + '/' + raster['File__Path']);
        }
    }

    const orphans = everyFile.filter((one) => !accounted.has(one));
    check('no file in the example is unaccounted for (' + everyFile.length + ' files)',
        orphans.length === 0, orphans.join('\n        '));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 7. The Built-In Fallback Works With No Schema JSON At All
// -----------------------------------------------------------------------------

    section('7. The built-in tables carry the app when the schema JSON cannot be read');

    const BARE     = stage(false);                                           // <-- No schema JSON beside it
    const Fallback = await import(pathToFileURL(join(BARE, 'Paths.mjs')).href);
    const fallbackSetup = await Fallback.Na__PubSchema__Ready();

    check('the fallback tables match the schema document, tier for tier',
        fallbackSetup.tiers.length === setup.tiers.length &&
        fallbackSetup.tiers.every((one, i) => one.id === setup.tiers[i].id &&
                                             one.pixelsPerMm === setup.tiers[i].pixelsPerMm &&
                                             one.maxPixels === setup.tiers[i].maxPixels),
        'the built-in floor must not drift from the document');

    check('the fallback tables match the schema document, kind for kind',
        fallbackSetup.kinds.length === setup.kinds.length &&
        fallbackSetup.kinds.every((one, i) => one.file === setup.kinds[i].file &&
                                             one.arrayKey === setup.kinds[i].arrayKey));

    check('paths still build on the fallback',
        Fallback.Na__PubSchema__ManifestPath('AA00_T02_D02') === Paths.Na__PubSchema__ManifestPath('AA00_T02_D02'));

    globalThis.fetch = realFetch;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);

// endregion -------------------------------------------------------------------
