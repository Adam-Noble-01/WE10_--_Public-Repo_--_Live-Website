// =============================================================================
// TRUEVISION3D - TEST - PROJECT QR CODE
// =============================================================================
//
// FILE       : Na__Test__ProjectQr__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Project QR Code Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the QR encoder against a decoder written separately from it, and prove that the shipped config prints a code a phone can read and that every project's code resolves
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - THE ENCODER IS READ BACK BY A DECODER THAT SHARES NO CODE WITH IT. This file
//   carries its own: it rebuilds the function pattern map from ISO/IEC 18004,
//   checks the format information's BCH codeword, unmasks, walks the zigzag,
//   de-interleaves the blocks, requires every Reed-Solomon syndrome to be zero
//   (the codeword evaluated at each root - not the encoder's long division run
//   again) and parses the byte mode payload. Every version from 1 to 10 has to
//   come back as the exact string that went in, at the longest and the
//   shortest payload the version takes.
// - THE SHIPPED CONFIG IS HELD TO ITS OWN FLOOR. The title block's code is the
//   strip's height less the quiet zone, so the module a drawing prints is
//   decided by three numbers in two config files. They are read here as
//   shipped: the module must clear MinModuleMm, and a project code one
//   character longer must NOT - which is the guard the config says it is.
// - EVERY PROJECT'S CODE HAS TO RESOLVE. q/index.json at the website root is
//   what turns the short address on a drawing into the project's model. Every
//   project folder in the portal must be in it, under the right year, or a
//   drawing of that project carries a code that opens nothing. It is written
//   by the ProjectVision build script; this fails when it has gone stale.
// - The encoder, the painter and the link builder import nothing the app
//   boots, so they run here exactly as the app runs them. Node 20 reads the
//   app's .js modules as CommonJS, so they are copied to temporary .mjs files.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__ProjectQr__.test.mjs
//     node 80__Testing__PrototypeEnvironment/Na__Test__ProjectQr__.test.mjs --dump <file.json>
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//   --dump writes every encoded case (text and modules) for
//   Na__Test__ProjectQr__Decode__.py, which reads them back with OpenCV.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.1.0
// - Section 6, the colours: the title block's code is black and the Project
//   Portal block's hsl(0, 0%, 35%), both held to 70 per cent symbol contrast
//   against the light colour, and the Symbol module's built-in fallbacks held
//   to the file by loading it once with the config and once without.
//
// 20-Sep-2026 - Version 1.0.0
// - Written with the Project QR Code system.
//
// =============================================================================

import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Modules Under Test and Their Config
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const APP        = resolve(SCRIPT_DIR, '..');
    const MODULES    = join(APP, '02__Src__AppModules');
    const QR_DIR     = join(MODULES, '53__System__ProjectQrCode');
    const REPO_ROOT  = resolve(APP, '..', '..');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-projectqr-'));

    // The link builder imports the project loader, so both go across with the
    // specifier between them rewritten; nothing either does at import time
    // touches a browser.
    const copyAs = (sourcePath, name, rewrite) => {
        let source = readFileSync(sourcePath, 'utf8');
        if (rewrite) source = rewrite(source);
        writeFileSync(join(SCRATCH, name), source, 'utf8');
        return pathToFileURL(join(SCRATCH, name)).href;
    };
    const encoder = await import(copyAs(join(QR_DIR, 'Na__ProjectQr__Encoder__.js'), 'Encoder.mjs'));
    const painter = await import(copyAs(join(QR_DIR, 'Na__ProjectQr__Painter__.js'), 'Painter.mjs'));
    copyAs(join(MODULES, '03__AppUtils', 'Na__AppUtils__ProjectLoader.js'), 'ProjectLoader.mjs');
    const linker  = await import(copyAs(join(QR_DIR, 'Na__ProjectQr__ProjectLink__.js'), 'ProjectLink.mjs',
        (source) => source.replace("'../03__AppUtils/Na__AppUtils__ProjectLoader.js'", "'./ProjectLoader.mjs'")));

    const qrConfig    = JSON.parse(readFileSync(join(QR_DIR, 'Na__ProjectQr__Config__.json'), 'utf8'));
    const titleConfig = JSON.parse(readFileSync(join(MODULES, '51__System__LayoutEditor', '03__Core__Config', 'Na__LayoutEditor__AppConfig__.json'), 'utf8'))['LayoutEditor__TitleBlock__Config'];
    const LINK        = { baseUrl : qrConfig['ProjectQr__Link__Config']['ProjectQr__Link__BaseUrl'], queryPattern : qrConfig['ProjectQr__Link__Config']['ProjectQr__Link__QueryPattern'] };
    const QUIET       = qrConfig['ProjectQr__Symbol__Config']['ProjectQr__Symbol__QuietZoneModules'];
    const MIN_MODULE  = qrConfig['ProjectQr__Symbol__Config']['ProjectQr__Symbol__MinModuleMm'];
    const STRIP_MM    = titleConfig['LayoutEditor__TitleBlock__HeightMm'];

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Check Harness
// -----------------------------------------------------------------------------

    let passed = 0;
    let failed = 0;
    function check(name, condition, detail) {
        if (condition) { passed++; console.log('  ok    ' + name); return; }
        failed++;
        console.log('  FAIL  ' + name + (detail !== undefined ? '\n        ' + detail : ''));
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | A Decoder That Shares Nothing With the Encoder
// -----------------------------------------------------------------------------

    // ISO/IEC 18004, level M, versions 1 to 10: [ ecPerBlock, blocks1, data1, blocks2, data2 ]
    const SPEC_BLOCKS = [ null, [ 10, 1, 16, 0, 0 ], [ 16, 1, 28, 0, 0 ], [ 26, 1, 44, 0, 0 ], [ 18, 2, 32, 0, 0 ], [ 24, 2, 43, 0, 0 ],
                          [ 16, 4, 27, 0, 0 ], [ 18, 4, 31, 0, 0 ], [ 22, 2, 38, 2, 39 ], [ 22, 3, 36, 2, 37 ], [ 26, 4, 43, 1, 44 ] ];
    const SPEC_ALIGN  = [ null, [], [ 6, 18 ], [ 6, 22 ], [ 6, 26 ], [ 6, 30 ], [ 6, 34 ], [ 6, 22, 38 ], [ 6, 24, 42 ], [ 6, 26, 46 ], [ 6, 28, 50 ] ];

    // GF(256) over x^8 + x^4 + x^3 + x^2 + 1, built here rather than borrowed
    const GF_EXP = new Array(512), GF_LOG = new Array(256);
    for (let i = 0, x = 1; i < 255; i++) { GF_EXP[i] = x; GF_LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
    for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
    const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];

    // Which modules carry no data, straight from the specification's geometry
    function functionMap(version) {
        const size = 17 + (4 * version);
        const map  = Array.from({ length : size }, () => new Array(size).fill(false));
        const fill = (r0, c0, rows, cols) => { for (let r = r0; r < r0 + rows; r++) for (let c = c0; c < c0 + cols; c++) if (r >= 0 && c >= 0 && r < size && c < size) map[r][c] = true; };
        fill(0, 0, 9, 9); fill(0, size - 8, 9, 8); fill(size - 8, 0, 8, 9);           // finders, separators and the format information beside them
        fill(6, 0, 1, size); fill(0, 6, size, 1);                                     // timing
        const centres = SPEC_ALIGN[version], last = centres.length - 1;
        centres.forEach((rowCentre, i) => centres.forEach((colCentre, j) => {
            if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
            fill(rowCentre - 2, colCentre - 2, 5, 5);
        }));
        if (version >= 7) { fill(0, size - 11, 6, 3); fill(size - 11, 0, 3, 6); }     // version information
        return map;
    }

    const MASKS = [ (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
                    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
                    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0 ];

    // Returns { text, mask } or throws with the reason the symbol does not read
    function decode(modules, version) {
        const size = 17 + (4 * version);
        if (modules.length !== size) throw new Error('matrix is ' + modules.length + ' across, version ' + version + ' is ' + size);

        // FORMAT INFORMATION | fifteen bits, a BCH(15,5) codeword under a fixed mask
        let format = 0;
        for (let i = 0; i < 15; i++) {
            const bit = i < 6 ? modules[i][8] : i < 8 ? modules[i + 1][8] : i === 8 ? modules[8][7] : modules[8][14 - i];
            if (bit) format |= (1 << i);
        }
        let second = 0;
        for (let i = 0; i < 15; i++) { const bit = i < 8 ? modules[8][size - 1 - i] : modules[size - 15 + i][8]; if (bit) second |= (1 << i); }
        if (second !== format) throw new Error('the two copies of the format information differ');
        format ^= 0x5412;
        let remainder = format;
        for (let bit = 14; bit >= 10; bit--) if (remainder & (1 << bit)) remainder ^= (0x537 << (bit - 10));
        if (remainder !== 0) throw new Error('the format information is not a BCH codeword');
        if (((format >> 13) & 3) !== 0) throw new Error('the format information does not say level M');
        const mask = (format >> 10) & 7;

        // VERSION INFORMATION | eighteen bits, a BCH(18,6) codeword, from version 7
        if (version >= 7) {
            let info = 0;
            for (let i = 0; i < 18; i++) if (modules[Math.floor(i / 3)][size - 11 + (i % 3)]) info |= (1 << i);
            let other = 0;
            for (let i = 0; i < 18; i++) if (modules[size - 11 + (i % 3)][Math.floor(i / 3)]) other |= (1 << i);
            if (other !== info) throw new Error('the two copies of the version information differ');
            let rest = info;
            for (let bit = 17; bit >= 12; bit--) if (rest & (1 << bit)) rest ^= (0x1F25 << (bit - 12));
            if (rest !== 0) throw new Error('the version information is not a BCH codeword');
            if ((info >> 12) !== version) throw new Error('the version information says ' + (info >> 12));
        }
        if (!modules[(4 * version) + 9][8]) throw new Error('the dark module is light');

        // THE ZIGZAG | unmasked as it is read
        const isFunction = functionMap(version);
        const bits = [];
        let upward = true;
        for (let col = size - 1; col > 0; col -= 2) {
            if (col === 6) col--;
            for (let step = 0; step < size; step++) {
                const r = upward ? size - 1 - step : step;
                for (let pair = 0; pair < 2; pair++) {
                    const c = col - pair;
                    if (isFunction[r][c]) continue;
                    bits.push((modules[r][c] !== MASKS[mask](r, c)) ? 1 : 0);
                }
            }
            upward = !upward;
        }

        // BLOCKS | de-interleaved, and every Reed-Solomon syndrome must be zero
        const [ ecPerBlock, n1, d1, n2, d2 ] = SPEC_BLOCKS[version];
        const total = (n1 * (d1 + ecPerBlock)) + (n2 * (d2 + ecPerBlock));
        if (bits.length < total * 8) throw new Error('only ' + bits.length + ' data modules for ' + (total * 8) + ' bits');
        const codewords = [];
        for (let i = 0; i < total; i++) { let value = 0; for (let b = 0; b < 8; b++) value = (value << 1) | bits[(i * 8) + b]; codewords.push(value); }

        const sizes  = [ ...new Array(n1).fill(d1), ...new Array(n2).fill(d2) ];
        const blocks = sizes.map(() => []);
        let cursor = 0;
        for (let i = 0; i < Math.max(d1, d2); i++) sizes.forEach((dataSize, b) => { if (i < dataSize) blocks[b].push(codewords[cursor++]); });
        for (let i = 0; i < ecPerBlock; i++) blocks.forEach((block) => block.push(codewords[cursor++]));

        blocks.forEach((block, index) => {
            for (let root = 0; root < ecPerBlock; root++) {
                let syndrome = 0;
                for (let j = 0; j < block.length; j++) syndrome = gfMul(syndrome, GF_EXP[root]) ^ block[j];
                if (syndrome !== 0) throw new Error('block ' + index + ' fails Reed-Solomon at root ' + root);
            }
        });

        // THE PAYLOAD | byte mode
        const data = [];
        blocks.forEach((block, b) => block.slice(0, sizes[b]).forEach((value) => data.push(value)));
        const stream = [];
        data.forEach((value) => { for (let b = 7; b >= 0; b--) stream.push((value >> b) & 1); });
        const take = (count) => { let value = 0; for (let i = 0; i < count; i++) value = (value << 1) | stream.shift(); return value; };
        if (take(4) !== 4) throw new Error('the payload is not byte mode');
        const length = take(version >= 10 ? 16 : 8);
        const bytes  = [];
        for (let i = 0; i < length; i++) bytes.push(take(8));
        return { text : Buffer.from(bytes).toString('utf8'), mask : mask };
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 1. Every Version Reads Back
// -----------------------------------------------------------------------------

    console.log('\n1. Every version from 1 to 10 reads back through the separate decoder');

    const CAPACITY = [ 0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213 ];
    const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_./?=&';
    const payload  = (length, seed) => { let text = 'https://x.io/', k = seed; while (text.length < length) { k = ((k * 1103515245) + 12345) >>> 0; text += ALPHABET[k % ALPHABET.length]; } return text.slice(0, length); };
    const dump     = [];
    const masksHit = new Set();

    for (let version = 1; version <= 10; version++) {
        [ [ 'longest', CAPACITY[version], 7 * version ], [ 'shortest', CAPACITY[version - 1] + 1, 13 * version ] ].forEach(([ label, length, seed ]) => {
            const text   = payload(length, seed);
            const symbol = encoder.Na__QrEnc__Encode(text);
            let result = null, why = '';
            try { result = decode(symbol.Modules, symbol.Version); } catch (error) { why = error.message; }
            if (result) masksHit.add(result.mask);
            const rebuilt = symbol.Modules.map((row) => row.map(() => false));
            symbol.Runs.forEach((run) => { for (let i = 0; i < run.Length; i++) rebuilt[run.Row][run.Col + i] = true; });
            check('version ' + version + ', ' + label + ' payload (' + length + ' bytes)',
                  symbol.Version === version && symbol.Size === 17 + (4 * version) && !!result && result.text === text &&
                  JSON.stringify(rebuilt) === JSON.stringify(symbol.Modules),
                  why || ('version ' + symbol.Version + ', read back "' + (result ? result.text.slice(0, 40) : '') + '"'));
            dump.push({ name : 'v' + version + '-' + label, text : text, version : symbol.Version, size : symbol.Size, modules : symbol.Modules.map((row) => row.map((m) => (m ? 1 : 0)).join('')) });
        });
    }
    check('the cases between them exercise more than one mask (' + [ ...masksHit ].sort().join(', ') + ')', masksHit.size >= 3);

    const accented = 'https://example.com/café/€/🏠?q=1';
    const accentedSymbol = encoder.Na__QrEnc__Encode(accented);
    check('accents, a euro sign and an emoji go through as UTF-8', decode(accentedSymbol.Modules, accentedSymbol.Version).text === accented);

    const quiet = console.error; console.error = () => {};
    const tooLong = encoder.Na__QrEnc__Encode(payload(214, 3));
    console.error = quiet;
    check('214 bytes is refused rather than truncated', tooLong === null);
    check('an empty string is refused', encoder.Na__QrEnc__Encode('') === null);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 2. The Address a Drawing Carries
// -----------------------------------------------------------------------------

    console.log('\n2. The address a drawing carries, from the shipped config');

    const ps01    = linker.Na__QrLink__BuildUrl(LINK, { projectCode : 'PS01', projectFolder : 'PS01__MustersRoad', year : '26' });
    const ps01Sym = encoder.Na__QrEnc__Encode(ps01);
    check('PS01 is ' + ps01, ps01 === 'https://www.noble-architecture.com/q/?PS01');
    check('which is 42 bytes, exactly what version 3 holds: 29 modules', Buffer.byteLength(ps01) === 42 && ps01Sym.Version === 3 && ps01Sym.Size === 29);
    check('and reads back through the decoder', decode(ps01Sym.Modules, 3).text === ps01);
    check('it is never the address bar: no localhost in it', !/localhost|127\.0\.0\.1/.test(ps01));
    check('a project with no code draws no address', linker.Na__QrLink__BuildUrl(LINK, { projectCode : '', projectFolder : 'X', year : '26' }) === '');
    check('a code is URL-encoded, not pasted', linker.Na__QrLink__BuildUrl(LINK, { projectCode : 'A B&', projectFolder : 'X', year : '26' }).endsWith('?A%20B%26'));

    const longForm = linker.Na__QrLink__BuildUrl({ baseUrl : 'https://www.noble-architecture.com/na-apps/30__TrueVision__CoreAppCode/Index.html',
        queryPattern : '?project={projectCode}&project-folder={projectFolder}&year={year}' }, { projectCode : 'PS01', projectFolder : 'PS01__MustersRoad', year : '26' });
    check('the full TrueVision address would have been version 8, 49 modules (' + Buffer.byteLength(longForm) + ' bytes)', encoder.Na__QrEnc__Encode(longForm).Version === 8);
    dump.push({ name : 'PS01-short', text : ps01, version : 3, size : 29, modules : ps01Sym.Modules.map((row) => row.map((m) => (m ? 1 : 0)).join('')) });

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 3. The Shipped Title Block Prints a Code a Phone Can Read
// -----------------------------------------------------------------------------

    console.log('\n3. The shipped title block against the shipped floor');

    // The title block's rule (Na__LayoutEditor__TitleBlock__QrCell__): N + 2q modules share the strip's height
    const printed = (modules) => STRIP_MM / (modules + (QUIET * 2));
    const moduleMm = printed(ps01Sym.Size);
    check('strip ' + STRIP_MM + ' mm, quiet zone ' + QUIET + ' modules: the code is ' + (moduleMm * ps01Sym.Size).toFixed(2) + ' mm at ' + moduleMm.toFixed(3) + ' mm a module',
          Math.abs((moduleMm * ps01Sym.Size) - 8.79) < 0.01 && Math.abs(moduleMm - 0.303) < 0.001);
    check('which clears the ' + MIN_MODULE + ' mm floor', moduleMm >= MIN_MODULE);

    const fiveChar = encoder.Na__QrEnc__Encode(linker.Na__QrLink__BuildUrl(LINK, { projectCode : 'PS012', projectFolder : 'X', year : '26' }));
    check('a five character code is version 4 at ' + printed(fiveChar.Size).toFixed(3) + ' mm, which does NOT - so the guard would say so',
          fiveChar.Version === 4 && printed(fiveChar.Size) < MIN_MODULE);
    check('the full address in the same strip would have printed ' + printed(49).toFixed(3) + ' mm, far under it', printed(49) < MIN_MODULE);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 4. Every Project's Code Resolves
// -----------------------------------------------------------------------------

    console.log('\n4. q/index.json against the project portal');

    const indexPath = join(REPO_ROOT, 'q', 'index.json');
    const portal    = join(REPO_ROOT, 'na-project-portal');
    check('q/index.html and q/index.json exist at the website root', existsSync(join(REPO_ROOT, 'q', 'index.html')) && existsSync(indexPath));

    if (existsSync(indexPath) && existsSync(portal)) {
        const index   = JSON.parse(readFileSync(indexPath, 'utf8')).projects || {};
        const onDisk  = {};
        readdirSync(portal).filter((name) => /^\d{2}-Projects$/.test(name)).forEach((yearFolder) => {
            readdirSync(join(portal, yearFolder)).forEach((folder) => {
                const match = /^([A-Z]{2}[0-9]{2})(?:__|_-_).+$/.exec(folder);
                if (match && statSync(join(portal, yearFolder, folder)).isDirectory()) onDisk[match[1]] = { projectFolder : folder, projectYear : yearFolder.slice(0, 2) };
            });
        });
        const missing = Object.keys(onDisk).filter((code) => !index[code]);
        const wrong   = Object.keys(onDisk).filter((code) => index[code] && (index[code].projectFolder !== onDisk[code].projectFolder || String(index[code].projectYear) !== onDisk[code].projectYear));
        const ghosts  = Object.keys(index).filter((code) => !onDisk[code]);
        check(Object.keys(onDisk).length + ' project folders, every one in the index', missing.length === 0,
              'not in q/index.json: ' + missing.join(', ') + ' - run ProjectVision__BuildScript__.py --qr-index-only');
        check('each under the folder and year it is really in', wrong.length === 0, 'stale entries: ' + wrong.join(', '));
        check('and nothing in the index that is not on disk', ghosts.length === 0, 'in the index only: ' + ghosts.join(', '));
        const notV3 = Object.keys(index).filter((code) => encoder.Na__QrEnc__Encode(linker.Na__QrLink__BuildUrl(LINK, { projectCode : code, projectFolder : 'x', year : '26' })).Version !== 3);
        check('every project\'s code is a version 3 symbol', notV3.length === 0, 'not version 3: ' + notV3.join(', '));
    } else {
        console.log('  skip  the project portal is not beside this repository copy');
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 5. The Painter
// -----------------------------------------------------------------------------

    console.log('\n5. One path on every surface');

    const group = painter.Na__QrPaint__SvgGroup(ps01Sym, 100, 200, 8.7879, '#000000', '#ffffff');
    check('SVG: one path holding every run (' + ps01Sym.Runs.length + '), crisp edged, light square first',
          (group.match(/<path /g) || []).length === 1 && (group.match(/M\d/g) || []).length === ps01Sym.Runs.length &&
          /shape-rendering="crispEdges"/.test(group) && group.indexOf('<rect') < group.indexOf('<path'));
    check('SVG: a colour that is not a colour cannot get through', /fill="#000000"/.test(painter.Na__QrPaint__SvgGroup(ps01Sym, 0, 0, 10, 'url(#x)', null)));

    const page = painter.Na__QrPaint__SvgDocument(ps01Sym, { title : 'Scan' });
    check('HTML: the viewBox carries four modules of quiet zone on every side', page.indexOf('viewBox="0 0 37 37"') !== -1);

    const calls = [];
    const fakeDoc = { setFillColor : (...a) => calls.push([ 'colour', ...a ]), rect : (...a) => calls.push([ 'rect', ...a ]), fill : () => calls.push([ 'fill' ]) };
    painter.Na__QrPaint__DrawPdf(fakeDoc, ps01Sym, 10, 20, 8.7879, '#000000', '#ffffff');
    const rects = calls.filter((c) => c[0] === 'rect');
    check('PDF: the light square is painted, every run joins ONE path, and fill() paints it once',
          rects.length === ps01Sym.Runs.length + 1 && rects[0][5] === 'F' && rects.slice(1).every((c) => c[5] === null) &&
          calls.filter((c) => c[0] === 'fill').length === 1 && calls[calls.length - 1][0] === 'fill');

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | 6. The Colours a Code Is Painted In
// -----------------------------------------------------------------------------

    console.log('\n6. Black for a document\'s own code, a softer grey for the Portal block\'s');

    // SYMBOL CONTRAST, ISO/IEC 15415: the light reflectance less the dark, with
    // each colour's relative luminance standing in for what the paper and the
    // ink send back. 70 per cent and over is grade A. A phone reads far less
    // than that; the floor is here so that nobody softens a code by eye until
    // it quietly stops reading.
    const SYMBOL_CONFIG = qrConfig['ProjectQr__Symbol__Config'];
    const luminance = (hex) => {
        const channel = (at) => {
            const value = parseInt(hex.substring(at, at + 2), 16) / 255;
            return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
        };
        return (0.2126 * channel(1)) + (0.7152 * channel(3)) + (0.0722 * channel(5));
    };
    const LIGHT_HEX  = SYMBOL_CONFIG['ProjectQr__Symbol__LightColour'];
    const DARK_HEX   = SYMBOL_CONFIG['ProjectQr__Symbol__DarkColour'];
    const PORTAL_HEX = SYMBOL_CONFIG['ProjectQr__Symbol__PortalDarkColour'];
    const contrastOf = (hex) => luminance(LIGHT_HEX) - luminance(hex);
    const GREY_35    = '#' + Math.round(0.35 * 255).toString(16).padStart(2, '0').repeat(3);   // <-- hsl(0, 0%, 35%): no saturation, so every channel is the lightness
    check('a document\'s own code - the title block\'s - is still black', DARK_HEX === '#000000');
    check('the Portal block\'s code is hsl(0, 0%, 35%), which is ' + GREY_35 + ' (Adam, 21-Sep-2026)', PORTAL_HEX === GREY_35 && GREY_35 === '#595959');
    [ [ 'the black', DARK_HEX ], [ 'the Portal grey', PORTAL_HEX ] ].forEach(([ label, hex ]) => {
        const valid = /^#[0-9a-fA-F]{6}$/.test(String(hex)) && /^#[0-9a-fA-F]{6}$/.test(String(LIGHT_HEX));
        check(label + ' against the light colour is ' + (valid ? Math.round(contrastOf(hex) * 100) : '?') + ' per cent symbol contrast, over the 70 of grade A',
              valid && contrastOf(hex) >= 0.70);
    });

    // THE BUILT-IN FALLBACKS ARE THE FILE'S. The Symbol module is loaded twice:
    // once with the config unreadable, once with it served. A fallback that had
    // drifted from the file would bring the black back to the Portal block on
    // any page whose config fetch failed.
    const qrSource   = readFileSync(join(QR_DIR, 'Na__ProjectQr__Symbol__.js'), 'utf8')
        .replace("'./Na__ProjectQr__Encoder__.js'", "'./Encoder.mjs'")
        .replace("'./Na__ProjectQr__ProjectLink__.js'", "'./ProjectLink.mjs'")
        .replace("'../03__AppUtils/Na__AppUtils__ProjectLoader.js'", "'./ProjectLoader.mjs'");
    writeFileSync(join(SCRATCH, 'Symbol.mjs'), qrSource, 'utf8');
    const realFetch = globalThis.fetch;
    const realWarn  = console.warn;
    const setupWith = async (served, tag) => {
        globalThis.fetch = async () => served ? { ok : true, status : 200, json : async () => qrConfig } : { ok : false, status : 404 };
        console.warn = () => {};                                                // <-- The unreadable load says so on the console, which is its job, not this run's
        const module = await import(pathToFileURL(join(SCRATCH, 'Symbol.mjs')).href + '?' + tag);
        const landed = await module.Na__ProjectQr__Ready();
        console.warn = realWarn;
        return { landed : landed, symbol : module.Na__ProjectQr__GetSetup().symbol };
    };
    const fromFile     = await setupWith(true,  'file');
    const fromFallback = await setupWith(false, 'fallback');
    globalThis.fetch = realFetch;
    check('GetSetup hands the Portal grey out as symbol.portalDarkColour, and the black as symbol.darkColour',
          fromFile.landed === true && fromFile.symbol.portalDarkColour === PORTAL_HEX && fromFile.symbol.darkColour === DARK_HEX, fromFile.symbol);
    check('with the config unreadable, the built-in fallbacks give the same two colours',
          fromFallback.landed === false && fromFallback.symbol.portalDarkColour === PORTAL_HEX && fromFallback.symbol.darkColour === DARK_HEX &&
          fromFallback.symbol.lightColour === LIGHT_HEX, fromFallback.symbol);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    const dumpFlag = process.argv.indexOf('--dump');
    if (dumpFlag !== -1 && process.argv[dumpFlag + 1]) {
        writeFileSync(process.argv[dumpFlag + 1], JSON.stringify(dump), 'utf8');
        console.log('\n  wrote ' + dump.length + ' cases to ' + process.argv[dumpFlag + 1]);
    }

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
    process.exit(failed === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
