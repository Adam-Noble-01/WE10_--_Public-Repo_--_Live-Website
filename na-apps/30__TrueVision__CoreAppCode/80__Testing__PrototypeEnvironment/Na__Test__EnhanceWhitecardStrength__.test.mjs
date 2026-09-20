// =============================================================================
// TRUEVISION3D - TEST - ENHANCE WHITECARD STRENGTH
// =============================================================================
//
// FILE       : Na__Test__EnhanceWhitecardStrength__.test.mjs
// NAMESPACE  : Na__Test
// MODULE     : Enhance Whitecard Strength Test
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove the Enhance Whitecard dial runs from nothing at 0 to exactly the old pass at 100, and that every step between is on the straight line
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - THE REAL MODULE IS THE THING UNDER TEST, byte for byte. It is copied into
//   a scratch tree of the same shape with a package.json saying type module,
//   so Node reads the app's .js files as ES modules and the module's own
//   relative imports resolve to stubs written at the exact paths it asks for.
// - THE STUBS RECORD RATHER THAN RENDER. Levels and high-pass sharpen both
//   want a real canvas, so here they only note the parameters they were
//   handed. What is being proved is the ARITHMETIC of the dial, which is
//   where a strength control can quietly go wrong.
// - THE SHIPPED CONFIG IS PART OF THE TEST. The composites JSON the app
//   fetches and the module's built-in fallback must agree about the Enhance
//   Whitecard row, or the panel would show one range before the fetch lands
//   and another after it, and a stored value could be clamped by the wrong
//   bounds on the way in.
// - THE BRIGHTNESS CHECK IS THE POINT OF THE FEATURE. A lower white point
//   sends more of the shaded whitecard to paper white, so a lower strength
//   must leave a mid grey DARKER. That is what Adam is reaching for when he
//   says the effect is too strong, and it is asserted here on the numbers the
//   module actually hands the levels pass.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Test__EnhanceWhitecardStrength__.test.mjs
//
//   Exit 0 = every check passed. Exit 1 = at least one did not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Written with the strength dial.
//
// =============================================================================

import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';


// -----------------------------------------------------------------------------
// REGION | The Module Under Test, in a Tree of Stubs
// -----------------------------------------------------------------------------

    const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
    const EDITOR     = resolve(SCRIPT_DIR, '..', '02__Src__AppModules', '51__System__LayoutEditor');
    const SCRATCH    = mkdtempSync(join(tmpdir(), 'na-enhance-'));

    // THE SHAPE THE MODULE'S OWN IMPORTS EXPECT. Enhance sits in
    // 51__System__LayoutEditor/25__System__RenderStyles and reaches up one for
    // the config and two for the image export effects.
    const DIR_STYLES = join(SCRATCH, '51__System__LayoutEditor', '25__System__RenderStyles');
    const DIR_CONFIG = join(SCRATCH, '51__System__LayoutEditor', '03__Core__Config');
    const DIR_EXPORT = join(SCRATCH, '30__System__ImageExport');
    [ DIR_STYLES, DIR_CONFIG, DIR_EXPORT ].forEach((dir) => mkdirSync(dir, { recursive : true }));

    writeFileSync(join(SCRATCH, 'package.json'), '{ "type": "module" }');        // <-- So Node reads the app's .js as ES modules

    // THE RECORDER. Every call the module makes lands here, in order.
    writeFileSync(join(DIR_EXPORT, 'Na__ImageExport__PostProcessEffects__Levels.js'),
        'export function Na__PostProcess__ApplyLevels(canvas, params) { canvas.calls.push({ effect : "levels", params : params[0] }); return canvas; }\n');
    writeFileSync(join(DIR_EXPORT, 'Na__ImageExport__PostProcessEffects__HighPassSharpen.js'),
        'export function Na__PostProcess__ApplyHighPassSharpen(canvas, params) { canvas.calls.push({ effect : "sharpen", params : params[0] }); return canvas; }\n');

    // THE CONFIG THE PASS READS AT FULL STRENGTH, swappable per check.
    writeFileSync(join(DIR_CONFIG, 'Na__LayoutEditor__ConfigState__.js'),
        'export let SETUP = null;\n' +
        'export function Na__Test__SetEnhanceSetup(next) { SETUP = next; }\n' +
        'export function Na__LeCfg__GetEnhanceSetup() { return SETUP; }\n');

    copyFileSync(join(EDITOR, '25__System__RenderStyles', 'Na__LayoutEditor__Enhance__.js'),
                 join(DIR_STYLES, 'Na__LayoutEditor__Enhance__.js'));

    const ENHANCE = await import(pathToFileURL(join(DIR_STYLES, 'Na__LayoutEditor__Enhance__.js')).href);
    const STUBCFG = await import(pathToFileURL(join(DIR_CONFIG, 'Na__LayoutEditor__ConfigState__.js')).href);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Fixtures and Helpers
// -----------------------------------------------------------------------------

    // THE SHIPPED PARAMETERS, read from the app config rather than retyped, so
    // a change to the white point moves the test with the app.
    const APPCFG = JSON.parse(readFileSync(join(EDITOR, '03__Core__Config', 'Na__LayoutEditor__AppConfig__.json'), 'utf8'));
    const BLOCK  = APPCFG['LayoutEditor__Enhance__Config'];
    const SHIPPED = {
        levelsBlack      : BLOCK['LayoutEditor__Enhance__LevelsBlack'],
        levelsWhite      : BLOCK['LayoutEditor__Enhance__LevelsWhite'],
        levelsGamma      : BLOCK['LayoutEditor__Enhance__LevelsGamma'],
        sharpenEnabled   : BLOCK['LayoutEditor__Enhance__SharpenEnabled'],
        sharpenRadius    : BLOCK['LayoutEditor__Enhance__SharpenRadius'],
        sharpenBlendMode : BLOCK['LayoutEditor__Enhance__SharpenBlendMode'],
        sharpenOpacity   : BLOCK['LayoutEditor__Enhance__SharpenOpacity']
    };

    // A SECOND SETUP THAT MOVES EVERY PARAMETER. The shipped one leaves black
    // at 0 and gamma at 1.0, which are also the no-op values - so on the
    // shipped numbers alone a dial that ignored black and gamma entirely would
    // pass. This one does not let it.
    const AWKWARD = {
        levelsBlack : 20, levelsWhite : 180, levelsGamma : 1.40,
        sharpenEnabled : true, sharpenRadius : 2.0, sharpenBlendMode : 'Overlay', sharpenOpacity : 0.80
    };

    // A CANVAS THAT IS ONLY A NOTEBOOK. The module checks it is truthy and
    // hands it to the effects; the stubs above write into calls.
    function canvas() { return { calls : [] }; }

    async function run(setup, strength) {
        STUBCFG.Na__Test__SetEnhanceSetup(setup);
        const c = canvas();
        await ENHANCE.Na__LeEnhance__Apply(c, strength);
        const levels  = c.calls.find((call) => call.effect === 'levels');
        const sharpen = c.calls.find((call) => call.effect === 'sharpen');
        return {
            count   : c.calls.length,
            black   : levels  ? levels.params['ImageExport__PostProcessEffects__Levels__Parameter__Black'] : null,
            white   : levels  ? levels.params['ImageExport__PostProcessEffects__Levels__Parameter__White'] : null,
            gamma   : levels  ? levels.params['ImageExport__PostProcessEffects__Levels__Parameter__Gamma'] : null,
            opacity : sharpen ? sharpen.params['ImageExport__PostProcessEffects__HighPassSharpen__Parameter__Opacity'] : null,
            radius  : sharpen ? sharpen.params['ImageExport__PostProcessEffects__HighPassSharpen__Parameter__Radius'] : null
        };
    }

    // THE LEVELS REMAP, exactly as Na__ImageExport__PostProcessEffects__Levels
    // computes it for one channel. Used to prove what the dial does to a real
    // grey, which is the thing being asked for.
    function remap(value255, black, white, gamma) {
        const b = black / 255, w = white / 255;
        let v = value255 / 255;
        if (w <= b) v = v < b ? 0 : 1;
        else        v = Math.max(0, Math.min(1, (v - b) / (w - b)));
        if (gamma !== 1.0 && gamma > 0) v = Math.pow(v, 1.0 / gamma);
        return Math.round(v * 255);
    }

    const near = (a, b) => Math.abs(a - b) < 1e-9;

    let failures = 0;
    function check(name, passed, detail) {
        if (!passed) failures++;
        console.log((passed ? '  PASS  ' : '  FAIL  ') + name + ((!passed && detail !== undefined) ? '  -> ' + JSON.stringify(detail) : ''));
    }

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Checks
// -----------------------------------------------------------------------------

    console.log('TrueVision3D - Enhance Whitecard strength');

    // THE TWO ENDS ------------------------------------------------------------
    const full = await run(SHIPPED, 100);
    check('100 is the pass exactly as it was - levels',
        near(full.black, SHIPPED.levelsBlack) && near(full.white, SHIPPED.levelsWhite) && near(full.gamma, SHIPPED.levelsGamma), full);
    check('100 is the pass exactly as it was - sharpen',
        near(full.opacity, SHIPPED.sharpenOpacity) && near(full.radius, SHIPPED.sharpenRadius), full);

    const missing = await run(SHIPPED, undefined);
    check('a caller that passes no strength gets the full pass', JSON.stringify(missing) === JSON.stringify(full), { missing, full });

    const nulled = await run(SHIPPED, null);
    check('a null strength gets the full pass', JSON.stringify(nulled) === JSON.stringify(full), { nulled, full });

    const zero = await run(SHIPPED, 0);
    check('0 runs neither pass - the render is handed back untouched', zero.count === 0, zero);

    // THE STRAIGHT LINE BETWEEN THEM -----------------------------------------
    const half = await run(AWKWARD, 50);
    check('50 puts the white point halfway',  near(half.white,   (255 + AWKWARD.levelsWhite) / 2),  half);
    check('50 puts the black point halfway',  near(half.black,   AWKWARD.levelsBlack / 2),          half);
    check('50 puts the gamma halfway',        near(half.gamma,   (1 + AWKWARD.levelsGamma) / 2),    half);
    check('50 puts the sharpen opacity halfway', near(half.opacity, AWKWARD.sharpenOpacity / 2),    half);

    const quarter = await run(AWKWARD, 25);
    check('25 is a quarter of the way, not a preset',
        near(quarter.white, 255 + ((AWKWARD.levelsWhite - 255) * 0.25)) && near(quarter.black, AWKWARD.levelsBlack * 0.25), quarter);

    // THE RADIUS IS NOT ON THE DIAL. A blur radius that shrank with strength
    // would change WHICH detail the sharpen finds, not how much of it lands.
    check('the sharpen radius does not move with the dial', near(half.radius, AWKWARD.sharpenRadius), half);

    // OUT OF RANGE ------------------------------------------------------------
    const over  = await run(AWKWARD, 400);
    check('a strength over 100 clamps to the full pass', near(over.white, AWKWARD.levelsWhite), over);
    const under = await run(AWKWARD, -30);
    check('a negative strength clamps to nothing at all', under.count === 0, under);

    // THE ZERO-OPACITY TRAP ---------------------------------------------------
    // The export effect reads its opacity with `|| 1.0`. A 0 handed to it comes
    // back as a FULL strength sharpen, so the module must never send one.
    let sentZero = false;
    for (let pct = 0; pct <= 100; pct++) {
        const r = await run(AWKWARD, pct);
        if (r.opacity === 0) sentZero = true;
    }
    check('no strength ever hands the sharpen an opacity of zero', !sentZero);

    // WHAT IT DOES TO A REAL GREY --------------------------------------------
    // 200 is about where a shaded whitecard face sits. At full strength it is
    // driven to paper white; the dial must walk it back down, monotonically.
    const GREY   = 200;
    const LADDER = [ 0, 25, 50, 75, 100 ];
    const greys  = [];
    for (const pct of LADDER) {
        const r = pct === 0 ? null : await run(SHIPPED, pct);
        greys.push(r === null ? GREY : remap(GREY, r.black, r.white, r.gamma));
    }
    check('a lower strength leaves that grey darker, step by step',
        greys[0] < greys[1] && greys[1] < greys[2] && greys[2] < greys[3] && greys[3] < greys[4], greys);
    check('0 leaves it exactly as the renderer wrote it', greys[0] === GREY, greys);

    // CLIPPING IS WHAT THE WHITE POINT IS FOR, and only a grey at or above it
    // clips. 200 sits just under the shipped 205 and lands at 249 - bright, not
    // white - which is why the ladder above is the right test for it and this
    // is the right test for the clip.
    const CLIPS    = SHIPPED.levelsWhite;
    const atFull   = await run(SHIPPED, 100);
    const atLow    = await run(SHIPPED, 20);
    check('full strength clips the whitecard white point to paper white',
        remap(CLIPS, atFull.black, atFull.white, atFull.gamma) === 255, { CLIPS, atFull });
    check('a low strength does not clip it yet - that is the whole point of the dial',
        remap(CLIPS, atLow.black, atLow.white, atLow.gamma) < 255, { CLIPS, atLow });

    // THE SHIPPED COMPOSITE ROW ----------------------------------------------
    const COMPOSITES = JSON.parse(readFileSync(join(EDITOR, '25__System__RenderStyles', 'Na__LayoutEditor__RenderComposites__Config__.json'), 'utf8'));
    const row = COMPOSITES['LayoutEditor__RenderComposites__Layers'].find((r) => r['Composite__Key'] === 'enhanceWhitecard');
    const w   = row ? row['Composite__Weight'] : null;
    check('the shipped config gives Enhance Whitecard a percent weight', !!w && w['Weight__Kind'] === 'percent', w);
    check('its range is 0 to 100',        !!w && w['Weight__Min'] === 0 && w['Weight__Max'] === 100, w);
    check('its default is the full pass', !!w && w['Weight__Default'] === 100, w);

    // AND THE FALLBACK THE PANEL USES BEFORE THE FETCH LANDS MUST AGREE.
    // Different bounds either side of the fetch would clamp a stored value two
    // different ways depending on when the record was read.
    const SOURCE   = readFileSync(join(EDITOR, '25__System__RenderStyles', 'Na__LayoutEditor__RenderComposites__.js'), 'utf8');
    const fbLine   = SOURCE.split('\n').find((line) => line.includes("key : 'enhanceWhitecard'"));
    const fbOk     = !!fbLine
        && fbLine.includes("kind : 'percent'")
        && fbLine.includes('value : ' + w['Weight__Default'])
        && fbLine.includes('min : ' + w['Weight__Min'])
        && fbLine.includes('max : ' + w['Weight__Max']);
    check('the built-in fallback row agrees with the shipped config', fbOk, (fbLine || '').trim());

    // THE RASTER CACHE KEY ----------------------------------------------------
    // A percent weight changes every pixel of the stored picture. If it were
    // left out of the raster token the dial would move and the old render would
    // be handed straight back - the effect would look broken, not subtle.
    const tokenOk = /kind !== 'pixels' && row\.weight\.kind !== 'percent'/.test(SOURCE);
    check('a percent weight is inside the raster cache key', tokenOk);

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Result
// -----------------------------------------------------------------------------

    rmSync(SCRATCH, { recursive : true, force : true });
    console.log('');
    console.log(failures === 0 ? '  PASS - the Enhance Whitecard dial runs 0 to 100 and 100 is the old pass.'
                               : '  FAIL - ' + failures + ' check(s) did not pass.');
    process.exit(failures === 0 ? 0 : 1);

// endregion -------------------------------------------------------------------
