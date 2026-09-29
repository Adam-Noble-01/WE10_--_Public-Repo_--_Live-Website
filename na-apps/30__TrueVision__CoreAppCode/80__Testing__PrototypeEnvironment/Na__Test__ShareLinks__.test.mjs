// =============================================================================
// TRUEVISION3D - TEST - DOCUMENT SHARE LINKS
// =============================================================================
//
// FILE       : Na__Test__ShareLinks__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Document Sharing - Links, the Share Link Record, and the s/ Resolver
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove a shared link is built one way, read back every way, recorded at publish, and resolved to the right document by s/index.html
// CREATED    : 29-Sep-2026
//
// DESCRIPTION:
// - THE BUILDER (Na__LayoutEditor__Share__Links__), run as it ships: a key is
//   built in exactly one form, read back in every form a person or a messaging
//   app might produce, and an address is never built with a hole in it.
// - THE RECORD (Na__LayoutEditor__Share__Manifest__), run as it ships with the
//   sheet model, the statements and the file transport stood in for: what a
//   publish writes, in which order, where, and what a key read back finds -
//   aliases, case and leading zeros included.
// - THE RESOLVER (s/index.html at the website root), its own inline script run
//   in a sandbox against the REAL q/index.json: every form a link can arrive
//   in lands on the project's address with the key handed through, a key that
//   is not a key is dropped, and an unknown project redirects nowhere.
// - THE TWO ENDS AGREE: the key pattern in the resolver and in the app, the
//   query key the resolver hands on and the app reads, and the TrueVision
//   address in s/ and its twin in q/.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ShareLinks__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 29-Sep-2026 - Version 1.0.0
// - Created with TrueVision3D v2.166.0.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Imports and Locations
// -----------------------------------------------------------------------------

    import { readFileSync, existsSync } from 'node:fs';
    import { dirname, join, resolve } from 'node:path';
    import { fileURLToPath, pathToFileURL } from 'node:url';
    import { register } from 'node:module';
    import vm from 'node:vm';

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const APP        = resolve(SCRIPT_DIR, '..');
    const MODULES    = join(APP, '02__Src__AppModules');
    const SHARING    = join(MODULES, '51__System__LayoutEditor', '66__Feature__DocumentSharing');
    const REPO       = resolve(APP, '..', '..');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Check Harness
// -----------------------------------------------------------------------------

    let passed = 0;
    let failed = 0;
    function check(name, condition, detail) {
        if (condition) { passed++; console.log('  ok    ' + name); return true; }
        failed++;
        console.log('  FAIL  ' + name + (detail !== undefined ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''));
        return false;
    }
    function section(title) { console.log('\n' + title); }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Loading the Real Modules
// -----------------------------------------------------------------------------
//
// The app's .js files are ES modules with no package.json saying so, and Node
// reads them as CommonJS. A loader hook, registered from a data: URL so this
// file needs nothing beside it, marks every .js under the app as a module and
// swaps FOUR modules for stand-ins: the sheet model, the statements, the
// drawings data and the publisher's file transport - the things that would
// otherwise pull in the whole editor, the DOM and the network. Everything else
// the record touches runs for real: the published schema, the reader's Urls,
// the project loader and the link builder.
//
// -----------------------------------------------------------------------------

    const HOOKS = `
        let STUBS = {};
        export async function initialize(data) { STUBS = (data && data.stubs) || {}; }
        export async function load(url, context, next) {
            for (const tail of Object.keys(STUBS)) {
                if (url.endsWith(tail)) return { format : 'module', source : STUBS[tail], shortCircuit : true };
            }
            if (url.startsWith('file:') && url.endsWith('.js') && url.indexOf('30__TrueVision__CoreAppCode') !== -1) {
                const loaded = await next(url, Object.assign({}, context, { format : 'module' }));
                return Object.assign({}, loaded, { format : 'module' });
            }
            return next(url, context);
        }
    `;

    // THE STAND-INS | Each reads its state off globalThis.Na__TestShare, set below
    const STUBS = {
        '/07__Core__SheetData/Na__LayoutEditor__SheetModel__.js' : `
            const S = () => globalThis.Na__TestShare;
            export const Na__LeModel__CHANGED_EVENT = 'na-layouteditor-sheets-changed';
            export function Na__LeModel__GetSheets() { return S().sheets.slice(); }
            export function Na__LeModel__GetSheetById(id) { return S().sheets.find((one) => one.Sheet__Id === id) || null; }
            export function Na__LeModel__GetShortCode(sheet) { return sheet.Number; }
            export function Na__LeModel__GetDrawingNumber(sheet) { return sheet.Number; }
            export function Na__LeModel__GetDocumentId(sheet) { return 'RB05_T01_' + sheet.Number; }
            export function Na__LeModel__GetTabLabel(sheet) { return sheet.Number + ' - ' + sheet.Sheet__Name; }
        `,
        '/01__Core__Data/Na__LayoutEditor__Statement__Data__.js' : `
            export const Na__LeStmt__CHANGED_EVENT = 'na-layouteditor-statement-changed';
            export async function Na__LeStmt__EnsureLoaded() { return true; }
            export function Na__LeStmt__List() { return globalThis.Na__TestShare.statements.slice(); }
        `,
        '/40__System__DrawingViewCore/Na__DrawView__ProjectData__.js' : `
            export function Na__DrawData__GetProjectCode() { return 'RB05'; }
            export function Na__DrawData__IsLoaded() { return true; }
        `,
        '/65__Feature__DocumentPublishing/Na__LayoutEditor__Publish__Transport__.js' : `
            const S = () => globalThis.Na__TestShare;
            export async function Na__LePubNet__WriteLocal(path, blob) {
                if (S().localFails) return { Ok : false, Reason : 'the local server is not answering' };
                S().writes.push({ to : 'local', path, text : await blob.text() }); return { Ok : true };
            }
            export async function Na__LePubNet__ReadLocal(path) { return S().previous; }
            export function Na__LePubNet__R2Ready() { return S().r2Configured ? { Ok : true } : { Ok : false, Reason : 'the Cloudflare Worker is not configured' }; }
            export async function Na__LePubNet__PushR2(path, blob) {
                if (S().r2Fails) return { Ok : false, Reason : 'Worker unreachable' };
                S().writes.push({ to : 'r2', path, text : await blob.text() }); return { Ok : true };
            }
        `
    };

    register('data:text/javascript,' + encodeURIComponent(HOOKS), { parentURL : import.meta.url, data : { stubs : STUBS } });

    // THE PAGE | A project on screen, on localhost, and a fetch that reads files and serves the "published" folder
    const SEARCH = '?project=RB05&project-folder=RB05__WestFarm&year=26&open=Sheet_004';
    globalThis.window = {
        location : { search : SEARCH, hash : '', hostname : 'localhost', port : '8090', origin : 'http://localhost:8090' },
        addEventListener : () => {}, removeEventListener : () => {}, dispatchEvent : () => true
    };
    globalThis.Na__TestShare = {
        sheets : [
            { Sheet__Id : 'Sheet_005', Sheet__Name : 'Project Introduction', Number : 'D01' },
            { Sheet__Id : 'Sheet_001', Sheet__Name : 'Front Elevation',      Number : 'D02' },
            { Sheet__Id : 'Sheet_016', Sheet__Name : 'Coach House Elevation', Number : 'D05' }
        ],
        statements : [
            { Doc__Id : 1, Doc__Title : 'RB05 Pre-Application Statement', Doc__Folder : '01__PreApp__Statement', Doc__File : 'RB05_T01_S01__WestFarm__PreApplicationStatement__.md' }
        ],
        writes : [], previous : null, r2Configured : true, r2Fails : false, localFails : false,
        served : {}                                                            // <-- url tail -> JSON the "published" folder holds
    };
    const realFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
        const href = (input && input.href) ? input.href : String(input);
        if (href.startsWith('file:')) {
            const path = fileURLToPath(href);
            if (!existsSync(path)) return { ok : false, status : 404, statusText : 'Not Found' };
            const text = readFileSync(path, 'utf8');
            return { ok : true, status : 200, statusText : 'OK', json : async () => JSON.parse(text), text : async () => text };
        }
        for (const tail of Object.keys(globalThis.Na__TestShare.served)) {
            if (href.endsWith(tail)) {
                const value = globalThis.Na__TestShare.served[tail];
                return { ok : true, status : 200, statusText : 'OK', json : async () => value, text : async () => JSON.stringify(value) };
            }
        }
        return { ok : false, status : 404, statusText : 'Not Found' };
    };

    const Links    = await import(pathToFileURL(join(SHARING, 'Na__LayoutEditor__Share__Links__.js')).href);
    const Manifest = await import(pathToFileURL(join(SHARING, 'Na__LayoutEditor__Share__Manifest__.js')).href);
    await Links.Na__LeShareLink__Ready();

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 1. Keys: Built One Way, Read Back Every Way
// -----------------------------------------------------------------------------

    section('1. A key is built in one form and read back in every form');

    const K = Links;
    check('a drawing\'s key is its sheet id, verbatim', K.Na__LeShareLink__KeyFor({ kind : 'drawing', sheetId : 'Sheet_004' }) === 'Sheet_004');
    check('the specification and the register have one key each',
        K.Na__LeShareLink__KeyFor({ kind : 'specification' }) === 'Specification' && K.Na__LeShareLink__KeyFor({ kind : 'register' }) === 'Register');
    check('a statement\'s key is Statement_ and its id', K.Na__LeShareLink__KeyFor({ kind : 'statement', statementId : 2 }) === 'Statement_2');
    check('nothing is keyed without an identity',
        K.Na__LeShareLink__KeyFor({ kind : 'statement' }) === '' && K.Na__LeShareLink__KeyFor({ kind : 'drawing', sheetId : 'a b' }) === '' && K.Na__LeShareLink__KeyFor({ kind : 'x' }) === '');

    const parsed = (text) => { const one = K.Na__LeShareLink__Parse(text); return one ? one.kind + ':' + one.key + (one.loose ? ':loose' : '') : null; };
    check('"spec", "SPECIFICATION" read back as the specification', parsed('spec') === 'specification:Specification' && parsed('SPECIFICATION') === 'specification:Specification');
    check('"register", "document-register" read back as the register', parsed('register') === 'register:Register' && parsed('document-register') === 'register:Register');
    check('"statement-2", "Statement_2", "statement2" read back as statement 2',
        [ 'statement-2', 'Statement_2', 'statement2' ].every((one) => parsed(one) === 'statement:Statement_2'));
    check('"sheet-004", "SHEET_004" read back as Sheet_004', parsed('sheet-004') === 'drawing:Sheet_004' && parsed('SHEET_004') === 'drawing:Sheet_004');
    check('a document id or a number reads back as a LOOSE drawing, for the opener to look for',
        parsed('RB05_T01_D02') === 'drawing:RB05_T01_D02:loose' && parsed('D02') === 'drawing:D02:loose');
    check('what is not a key is refused, never guessed',
        [ '', ' ', '<script>', 'Sheet 4', 'a/b', '../x', '%2e%2e' ].every((one) => K.Na__LeShareLink__Parse(one) === null));
    check('case and a sheet id\'s leading zeros never matter; kinds never cross',
        K.Na__LeShareLink__SameKey('Sheet_4', 'sheet_004') && K.Na__LeShareLink__SameKey('spec', 'Specification') &&
        !K.Na__LeShareLink__SameKey('Sheet_4', 'Sheet_40') && !K.Na__LeShareLink__SameKey('Register', 'Specification') &&
        !K.Na__LeShareLink__SameKey('Statement_1', 'Sheet_001'));

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 2. Addresses: the Live Resolver, Never the Address Bar, Never a Hole
// -----------------------------------------------------------------------------

    section('2. An address is the live resolver\'s, and is never built with a hole in it');

    const setup = K.Na__LeShareLink__GetSetup();
    const config = JSON.parse(readFileSync(join(SHARING, 'Na__LayoutEditor__Share__Config__.json'), 'utf8'));
    check('the settings were read from the config, not the floor',
        setup.link.baseUrl === config['LayoutEditor__Share__Link']['Link__BaseUrl'] && setup.link.queryPattern === config['LayoutEditor__Share__Link']['Link__QueryPattern']);
    check('the base is the live site\'s /s/, never localhost', /^https:\/\/www\.noble-architecture\.com\/s\/$/.test(setup.link.baseUrl));
    check('the drawing on screen shares as /s/?RB05&open=Sheet_004 (read off a LOCALHOST address bar)',
        K.Na__LeShareLink__UrlFor({ kind : 'drawing', sheetId : 'Sheet_004' }) === 'https://www.noble-architecture.com/s/?RB05&open=Sheet_004',
        K.Na__LeShareLink__UrlFor({ kind : 'drawing', sheetId : 'Sheet_004' }));
    check('the specification, the register and a statement share the same way',
        K.Na__LeShareLink__UrlFor({ kind : 'specification' }) === 'https://www.noble-architecture.com/s/?RB05&open=Specification' &&
        K.Na__LeShareLink__UrlFor({ kind : 'register' }) === 'https://www.noble-architecture.com/s/?RB05&open=Register' &&
        K.Na__LeShareLink__UrlFor({ kind : 'statement', statementId : 1 }) === 'https://www.noble-architecture.com/s/?RB05&open=Statement_1');
    check('a pattern token with no value gives NO address', K.Na__LeShareLink__BuildUrl(setup.link, 'RB05', '') === '' && K.Na__LeShareLink__BuildUrl(setup.link, '', 'Register') === '');
    check('a code or a key that is not safe gives no address', K.Na__LeShareLink__BuildUrl(setup.link, 'RB05&x=1', 'Register') === '' && K.Na__LeShareLink__BuildUrl(setup.link, 'RB05', 'a b') === '');
    check('the key the app was opened with is read off the address', K.Na__LeShareLink__ReadOpenParam() === 'Sheet_004');

    const was = window.location.search;
    window.location.search = '?project=rb05&project-folder=RB05__WestFarm';
    check('a lower-case code in the address still shares upper-case', K.Na__LeShareLink__UrlFor({ kind : 'register' }) === 'https://www.noble-architecture.com/s/?RB05&open=Register');
    window.location.search = '?project=RB05';
    check('half a project in the address shares nothing (as the QR code draws nothing)', K.Na__LeShareLink__UrlFor({ kind : 'register' }) === '');
    window.location.search = '?project=RB05&project-folder=RB05__WestFarm&open=%3Cscript%3E';
    check('an open= that is not a key is ignored', K.Na__LeShareLink__ReadOpenParam() === '');
    window.location.search = was;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 3. The Record: What a Publish Writes, and Where
// -----------------------------------------------------------------------------

    section('3. The share link record: every document, written here first, then R2');

    const S = globalThis.Na__TestShare;
    S.previous = { 'ShareLinks__Aliases' : { 'Aliases__Note' : 'old note', 'Old_Front' : 'Sheet_001' } };
    const json = (value) => JSON.stringify(value, null, 4) + '\n';
    const recorded = await Manifest.Na__LeShareMf__Record({ toR2 : true, json : json, appVersion : 'v2.166.0', reason : 'drawings' });
    const record = recorded.Manifest || {};
    const docs = record['ShareLinks__Documents'] || [];

    check('recorded: ok, locally and on R2', recorded.Ok && recorded.Local && recorded.R2, recorded);
    check('the local copy is written FIRST, then R2, both to the file the schema names',
        S.writes.length === 2 && S.writes[0].to === 'local' && S.writes[1].to === 'r2' && S.writes.every((one) => one.path === 'PublishedDocuments__ShareLinks__.json'),
        S.writes.map((one) => one.to + ' ' + one.path));
    check('what went to R2 is byte for byte what went to disk', S.writes.length === 2 && S.writes[0].text === S.writes[1].text);
    check('every drawing (in register order), then the specification, the register and the statements',
        docs.map((one) => one['Share__Key']).join(',') === 'Sheet_005,Sheet_001,Sheet_016,Specification,Register,Statement_1',
        docs.map((one) => one['Share__Key']).join(','));
    check('each entry carries its address, as the builder makes it',
        docs.every((one) => one['Share__Url'] === 'https://www.noble-architecture.com/s/?RB05&open=' + one['Share__Key']));
    check('a drawing records the sheet, document id and number it opens',
        JSON.stringify(docs[1]['Share__Target']) === JSON.stringify({ 'Target__SheetId' : 'Sheet_001', 'Target__DocumentId' : 'RB05_T01_D02', 'Target__Number' : 'D02' }) && docs[1]['Share__Label'] === 'D02 - Front Elevation');
    check('a statement records its id, folder and file', docs[5]['Share__Target']['Target__StatementId'] === 1 && docs[5]['Share__Target']['Target__Folder'] === '01__PreApp__Statement');
    check('the aliases are carried forward, and the note is the current one',
        record['ShareLinks__Aliases']['Old_Front'] === 'Sheet_001' && record['ShareLinks__Aliases']['Aliases__Note'] !== 'old note');
    check('no entry claims a publication state', docs.every((one) => !('Share__State' in one)));
    check('the resolver the addresses were built against is recorded',
        record['ShareLinks__Resolver']['Resolver__BaseUrl'] === setup.link.baseUrl && record['ShareLinks__Resolver']['Resolver__OpenParam'] === 'open');
    check('the stamp says which app wrote it and why', record['ShareLinks__Publish']['Publish__ByAppVersion'] === 'v2.166.0' && record['ShareLinks__Publish']['Publish__Reason'] === 'drawings');
    check('the record just written is the one this tab now holds', Manifest.Na__LeShareMf__Current() === record);

    S.writes.length = 0;
    const localOnly = await Manifest.Na__LeShareMf__Record({ toR2 : false, json : json });
    check('without Also push to R2, only this disk is written', localOnly.Ok && localOnly.Local && !localOnly.R2 && S.writes.length === 1 && S.writes[0].to === 'local');

    S.writes.length = 0;
    S.localFails = true;
    const noLocal = await Manifest.Na__LeShareMf__Record({ toR2 : true, json : json });
    check('when this disk cannot be written, NOTHING goes to R2', !noLocal.Ok && S.writes.length === 0, noLocal);
    S.localFails = false;

    S.r2Fails = true;
    const noR2 = await Manifest.Na__LeShareMf__Record({ toR2 : true, json : json });
    check('an R2 failure is reported, with the local copy kept', !noR2.Ok && noR2.Local && !noR2.R2 && /R2/.test(noR2.Reason), noR2);
    S.r2Fails = false;

    S.writes.length = 0;
    const both = await Promise.all([ Manifest.Na__LeShareMf__Record({ toR2 : false, json : json }), Manifest.Na__LeShareMf__Record({ toR2 : false, json : json }) ]);
    check('two records asked for at once are written one after the other', both.every((one) => one.Ok) && S.writes.length === 2);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 4. Reading the Record Back, and What a Key Finds
// -----------------------------------------------------------------------------

    section('4. The record read back, and what a key finds in it');

    const published = JSON.parse(JSON.stringify(record));
    published['ShareLinks__Documents'][1]['Share__Url'] = 'https://www.noble-architecture.com/s/?RB05&open=Sheet_001&v=older-rules';   // <-- Recorded under older rules
    S.served = { '06__Layout__PublishedDocuments/PublishedDocuments__ShareLinks__.json' : published };
    const loaded = await Manifest.Na__LeShareMf__Load(true);
    check('the record is read through the reader\'s own Urls', loaded.Ok && /06__Layout__PublishedDocuments\/PublishedDocuments__ShareLinks__\.json$/.test(loaded.Url || ''), loaded);
    check('a key finds its entry, whatever the case', (Manifest.Na__LeShareMf__Find('sheet_001') || {})['Share__Key'] === 'Sheet_001');
    check('the address ON RECORD is what is handed out, not the one the rules would build now',
        (Manifest.Na__LeShareMf__Find('Sheet_001') || {})['Share__Url'].indexOf('older-rules') !== -1);
    check('leading zeros never matter', (Manifest.Na__LeShareMf__Find('Sheet_5') || {})['Share__Key'] === 'Sheet_005');
    check('an old key listed as an alias opens the document it now names', (Manifest.Na__LeShareMf__Find('Old_Front') || {})['Share__Key'] === 'Sheet_001');
    check('"spec" finds the specification', (Manifest.Na__LeShareMf__Find('spec') || {})['Share__Kind'] === 'specification');
    check('a key the record does not hold finds nothing', Manifest.Na__LeShareMf__Find('Sheet_099') === null && Manifest.Na__LeShareMf__Find('D02') === null);

    S.served = {};
    const none = await Manifest.Na__LeShareMf__Load(true);
    check('no record (a project not published since v2.166.0) is an answer, not an error', !none.Ok && Manifest.Na__LeShareMf__Current() === null && /no share link record yet/.test(none.Reason));
    S.served = { '06__Layout__PublishedDocuments/PublishedDocuments__ShareLinks__.json' : { nothing : true } };
    const broken = await Manifest.Na__LeShareMf__Load(true);
    check('a record that is not one is refused with a reason', !broken.Ok && /ShareLinks__Documents/.test(broken.Reason));

    S.served = { '06__Layout__PublishedDocuments/PublishedDocuments__Index__.json' : { 'PublishedDocuments__Documents' : [
        { 'Document__Id' : 'RB05_T01_D02', 'Document__State' : 'published' },
        { 'Document__Id' : 'RB05_T01_D05', 'Document__State' : 'unpublished' }
    ] } };
    check('whether a drawing is published is read from the index at the moment it is asked',
        (await Manifest.Na__LeShareMf__DrawingState('RB05_T01_D02')) === 'published' &&
        (await Manifest.Na__LeShareMf__DrawingState('RB05_T01_D05')) === 'unpublished' &&
        (await Manifest.Na__LeShareMf__DrawingState('RB05_T01_D99')) === 'unpublished');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 5. The Resolver Page: s/index.html, Run as It Ships
// -----------------------------------------------------------------------------

    section('5. s/index.html sends every form of a link to the right address');

    const RESOLVER = join(REPO, 's', 'index.html');
    const QPAGE    = join(REPO, 'q', 'index.html');
    const QINDEX   = JSON.parse(readFileSync(join(REPO, 'q', 'index.json'), 'utf8'));
    const MASTER   = JSON.parse(readFileSync(join(REPO, 'na-apps', '05__ProjectVision__CoreAppCode', '05__AppData', 'ProjectVision__MasterProjectIndex__Core__.json'), 'utf8'));
    const page     = readFileSync(RESOLVER, 'utf8');
    const script   = (/<script>([\s\S]*?)<\/script>/.exec(page) || [])[1] || '';
    check('s/index.html is at the website root and carries its script', existsSync(RESOLVER) && script.length > 1000);

    // RUN IT | One sandbox per address; resolves with where it sent the reader, or what it said
    const runResolver = (search, hash, options) => new Promise((resolveRun) => {
        const said = [];
        const status = {
            firstChild : null,
            removeChild () { this.firstChild = null; },
            appendChild (node) { said.push(node.text || ''); this.firstChild = node; return node; }
        };
        let done = false;
        const finish = (value) => { if (!done) { done = true; resolveRun(value); } };
        const sandbox = {
            window   : { location : { search, hash : hash || '', replace : (url) => finish({ to : url, said : said.join('') }) } },
            document : {
                getElementById    : () => status,
                createTextNode    : (text) => ({ text : String(text) }),
                createElement     : () => ({ className : '', href : '', appendChild (node) { this.text = node.text; return node; } })
            },
            fetch : async (url) => {
                const body = (options && options.noQIndex && /q\/index\.json$/.test(url)) ? null
                           : /q\/index\.json$/.test(url) ? QINDEX
                           : /MasterProjectIndex__Core__\.json$/.test(url) ? MASTER : null;
                return body ? { ok : true, status : 200, json : async () => body } : { ok : false, status : 404, json : async () => null };
            },
            decodeURIComponent, encodeURIComponent, setTimeout
        };
        sandbox.window.fetch = sandbox.fetch;
        vm.runInNewContext(script, sandbox);
        setTimeout(() => finish({ to : null, said : said.join('') }), 250);
    });

    const APP_BASE = '../na-apps/30__TrueVision__CoreAppCode/Index.html?project=RB05&project-folder=RB05__WestFarm&year=26';
    const cases = [
        [ '?RB05&open=Sheet_004',                   APP_BASE + '&open=Sheet_004',     'the form a Share button hands out' ],
        [ '?rb05&open=Specification',               APP_BASE + '&open=Specification', 'a lower-case code' ],
        [ '?p=RB05&open=Register',                  APP_BASE + '&open=Register',      'p=' ],
        [ '?project=RB05&d=Statement_1',            APP_BASE + '&open=Statement_1',   'project= and d=' ],
        [ '?RB05&doc=Sheet_004',                    APP_BASE + '&open=Sheet_004',     'doc=' ],
        [ '?RB05&Sheet_004',                        APP_BASE + '&open=Sheet_004',     'the key as a second bare token (open= stripped)' ],
        [ '?RB05&open=Sheet_004&fbclid=IwAR0abc',   APP_BASE + '&open=Sheet_004',     'a messaging app\'s tracking key on the end' ],
        [ '?RB05',                                  APP_BASE,                          'a code alone opens the project, as q/ does' ],
        [ '?RB05&open=%3Cscript%3Ealert(1)',        APP_BASE,                          'a key that is not a key is dropped, never passed on' ],
        [ '?RB05&open=..%2F..%2Fq',                 APP_BASE,                          'a path in the key is dropped' ]
    ];
    for (const [ search, want, why ] of cases) {
        const got = await runResolver(search);
        check('s/' + search + '  ->  ' + (want === APP_BASE ? 'the project, no key' : want.slice(APP_BASE.length + 1)) + '   (' + why + ')', got.to === want, got);
    }
    const hashed = await runResolver('', '#RB05');
    check('#RB05 is answered too', hashed.to === APP_BASE, hashed);
    const master = await runResolver('?RB05&open=Register', '', { noQIndex : true });
    check('with q/index.json unreadable, the master index answers', master.to === APP_BASE + '&open=Register', master);
    const unknown = await runResolver('?ZZ99&open=Sheet_001');
    check('an unknown project redirects NOWHERE and says so', unknown.to === null && /could not find project ZZ99/.test(unknown.said), unknown);
    const empty = await runResolver('');
    check('no project at all redirects nowhere and says so', empty.to === null && /does not name a project/.test(empty.said), empty);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 6. The Two Ends Agree
// -----------------------------------------------------------------------------

    section('6. The resolver and the app agree, and s/ and q/ point at the same app');

    const constant = (source, name) => { const m = new RegExp('var\\s+' + name + '\\s*=\\s*([^;]+);').exec(source); return m ? m[1].trim() : null; };
    const sKey = constant(script, 'NA_SHARE_KEY_PATTERN');
    check('the key pattern in s/ is the app\'s own', sKey === String(K.Na__LeShareLink__KEY_PATTERN), sKey + ' vs ' + String(K.Na__LeShareLink__KEY_PATTERN));
    check('the key s/ hands on is the key the app reads', constant(script, 'NA_SHARE_OPEN_PARAM') === "'" + setup.link.openParam + "'");
    const qScript = (/<script>([\s\S]*?)<\/script>/.exec(readFileSync(QPAGE, 'utf8')) || [])[1] || '';
    check('s/ and q/ send readers to the same TrueVision address (the twin constants)',
        constant(script, 'NA_SHARE_TARGET_APP') === constant(qScript, 'NA_QR_TARGET_APP') && constant(script, 'NA_SHARE_TARGET_APP') !== null);
    check('s/ reads the same index q/ does', constant(script, 'NA_SHARE_INDEX_URL') === "'../q/index.json'" && constant(qScript, 'NA_QR_INDEX_URL') === "'./index.json'");
    check('the app\'s base address is the folder s/index.html lives in', setup.link.baseUrl.endsWith('/s/') && existsSync(RESOLVER));
    check('every project in q/index.json can be shared (its code passes the app\'s code rule)',
        Object.keys(QINDEX.projects).every((code) => K.Na__LeShareLink__BuildUrl(setup.link, code, 'Register') !== ''));

    globalThis.fetch = realFetch;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);

// endregion -------------------------------------------------------------------
