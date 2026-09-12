// =============================================================================
// TRUEVISION3D - VERIFY - BROWSER MODULE GRAPH RESOLUTION
// =============================================================================
//
// FILE       : Na__Verify__ModuleGraph__.mjs
// NAMESPACE  : Na__Verify
// MODULE     : Module Graph Resolution Walk
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove every import specifier on the page resolves to a file on
//              disk, exactly as the browser would resolve it
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - Reads the import map out of Index.html, then walks the module graph from
//   every entry point the page loads, following relative imports and import-map
//   bare specifiers, INCLUDING the internals of the vendored libraries.
// - `node --check` cannot see this class of fault: each file parses perfectly
//   while the graph as a whole is broken. ValeVision shipped exactly that and
//   the app died on `Failed to resolve module specifier "clipper2-js"`, thrown
//   by a vendor file that no app module imports directly.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Verify__ModuleGraph__.mjs
//
//   Exit 0 = every specifier resolves. Exit 1 = at least one does not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Written for the Phase A r184 vendoring (v2.20.0).
//
// =============================================================================

import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// -----------------------------------------------------------------------------
// REGION | Configuration
// -----------------------------------------------------------------------------

    const Na__Verify__ScriptDir = dirname(fileURLToPath(import.meta.url));                       // <-- 80__Testing__PrototypeEnvironment
    const Na__Verify__AppRoot   = resolve(Na__Verify__ScriptDir, '..');                          // <-- TrueVision app root
    const Na__Verify__IndexPath = resolve(Na__Verify__AppRoot, 'Index.html');                    // <-- The page that declares the import map

    // KNOWN ISSUES | Unresolvable specifiers that are real but not live
    // ------------------------------------------------------------
    // Each entry is a genuine defect in a VENDORED file that no reachable code
    // path imports. They are printed on every run and never silently dropped,
    // but they do not fail the build, because failing on a fault we have
    // deliberately decided not to fix trains people to ignore the harness.
    //
    // Removing an entry from here must mean the defect is gone, never that it
    // became inconvenient.
    // ------------------------------------------------------------
    const Na__Verify__KnownIssues = [
        {
            file      : '04__Vendor__ThreeEdgeProjection__v0.0.10/src/worker/SilhouetteGeneratorWorker.js',
            specifier : '../SilhouetteGenerator',
            reason    : 'Upstream bug in three-edge-projection 0.0.10: an extensionless relative specifier, which no browser can resolve. '
                      + 'Reachable ONLY through the "three-edge-projection/worker" import map entry. Neither TrueVision nor ValeVision '
                      + 'imports that entry - both use the main entry plus a dynamic "three-edge-projection/webgpu", and the projection '
                      + 'system brings its own worker pool. Left unpatched to keep the vendor folder byte-identical across the three apps. '
                      + 'IF PHASE D EVER IMPORTS three-edge-projection/worker, THIS BREAKS THE PAGE - add the .js extension in all three '
                      + 'vendored copies at that point, or drop the map entry.'
        }
    ];
    // ------------------------------------------------------------

    // Static import + dynamic import + re-export, all forms.
    const Na__Verify__SpecifierPattern = /(?:^|[\s;}])(?:import|export)\s*(?:[\s\S]*?\sfrom\s*)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Source Preparation
// -----------------------------------------------------------------------------

    // FUNCTION | Strip Comments Before Scanning for Import Specifiers
    // ------------------------------------------------------------
    // Without this the walk reports phantom imports out of prose. three-mesh-bvh
    // heads its generated files with:
    //     /* This file is generated from "raycast.template.js". */
    // which the specifier pattern reads as `from "raycast.template.js"` and
    // reports as a missing module. A harness that cries wolf twice gets ignored
    // the third time, when it is right.
    //
    // Quotes are tracked so a // or /* inside a string literal is left alone.
    // ------------------------------------------------------------
    function Na__Verify__StripComments(source) {
        let output      = '';
        let index       = 0;
        let quoteChar   = null;                                                                  // <-- Currently open string delimiter, if any

        while (index < source.length) {
            const char = source[index];
            const next = source[index + 1];

            if (quoteChar) {                                                                     // <-- Inside a string literal
                output += char;
                if (char === '\\')      { output += next ?? ''; index += 2; continue; }          // <-- Escape: consume the pair
                if (char === quoteChar) { quoteChar = null; }
                index += 1;
                continue;
            }

            if (char === '"' || char === "'" || char === '`') {                                  // <-- String opens
                quoteChar = char;
                output   += char;
                index    += 1;
                continue;
            }

            if (char === '/' && next === '/') {                                                  // <-- Line comment
                while (index < source.length && source[index] !== '\n') index += 1;
                continue;
            }

            if (char === '/' && next === '*') {                                                  // <-- Block comment
                index += 2;
                while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) index += 1;
                index += 2;
                output += ' ';                                                                   // <-- Keep tokens either side apart
                continue;
            }

            output += char;
            index  += 1;
        }

        return output;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Import Map
// -----------------------------------------------------------------------------

    // FUNCTION | Read the Import Map Declared Inline in Index.html
    // ------------------------------------------------------------
    function Na__Verify__ReadImportMap() {
        const html  = readFileSync(Na__Verify__IndexPath, 'utf8');                               // <-- Read the page
        const match = html.match(/<script[^>]+type=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i); // <-- Find the map block
        if (!match) throw new Error('No <script type="importmap"> found in Index.html');

        const parsed = JSON.parse(match[1]);                                                     // <-- Parse it as the browser would
        return parsed.imports || {};
    }
    // ------------------------------------------------------------


    // FUNCTION | Resolve a Bare Specifier Through the Import Map
    // ------------------------------------------------------------
    // Mirrors the browser's two rules: exact key match, then longest
    // trailing-slash prefix match.
    // ------------------------------------------------------------
    function Na__Verify__ResolveBare(specifier, importMap) {
        if (Object.prototype.hasOwnProperty.call(importMap, specifier)) {
            return resolve(Na__Verify__AppRoot, importMap[specifier]);                           // <-- Exact key
        }

        const prefixKeys = Object.keys(importMap)
            .filter(key => key.endsWith('/') && specifier.startsWith(key))
            .sort((a, b) => b.length - a.length);                                                // <-- Longest prefix wins

        if (prefixKeys.length === 0) return null;

        const key  = prefixKeys[0];
        const tail = specifier.slice(key.length);
        return resolve(Na__Verify__AppRoot, importMap[key] + tail);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Graph Walk
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Resolve a Relative Specifier With Extension Guessing
    // ------------------------------------------------------------
    // A browser does NOT guess extensions. It is done here only to report a
    // near-miss ("meant .js?") as a distinct, more useful failure than a plain
    // not-found, because that is the shape the mistake usually takes.
    // ------------------------------------------------------------
    function Na__Verify__ResolveRelative(specifier, fromFile) {
        const direct = resolve(dirname(fromFile), specifier);                                    // <-- Exactly what the browser does
        if (existsSync(direct) && statSync(direct).isFile()) return { path: direct, exact: true };

        for (const suffix of ['.js', '.mjs', '/index.js', '/index.mjs']) {                       // <-- Diagnostic only
            const guess = `${direct}${suffix}`;
            if (existsSync(guess) && statSync(guess).isFile()) return { path: guess, exact: false };
        }
        return { path: direct, missing: true };
    }
    // ------------------------------------------------------------


    // FUNCTION | Walk the Module Graph From a Set of Entry Points
    // ------------------------------------------------------------
    function Na__Verify__WalkGraph(entryPoints, importMap) {
        const visited  = new Set();                                                              // <-- Files already walked
        const failures = [];                                                                     // <-- Unresolved specifiers
        const queue    = [...entryPoints];

        while (queue.length > 0) {
            const currentFile = queue.pop();
            if (visited.has(currentFile)) continue;
            visited.add(currentFile);

            if (!existsSync(currentFile)) continue;                                              // <-- Reported by whoever queued it

            let source;
            try { source = Na__Verify__StripComments(readFileSync(currentFile, 'utf8')); } catch { continue; }

            Na__Verify__SpecifierPattern.lastIndex = 0;
            let match;
            while ((match = Na__Verify__SpecifierPattern.exec(source)) !== null) {
                const specifier = match[1] || match[2];
                if (!specifier) continue;
                if (specifier.startsWith('data:') || specifier.startsWith('http')) continue;      // <-- Not a disk file
                // A TEMPLATE LITERAL IS NOT A PATH. `import(`./${name}.js`)` is a
                // specifier computed at runtime; there is no file on disk to check
                // and the text between the braces is an expression, not a module.
                if (specifier.indexOf('${') !== -1) continue;

                let resolvedPath = null;

                if (specifier.startsWith('.') || specifier.startsWith('/')) {
                    const outcome = Na__Verify__ResolveRelative(specifier, currentFile);
                    if (outcome.missing) {
                        failures.push({ from: currentFile, specifier, reason: 'relative path not found' });
                        continue;
                    }
                    if (!outcome.exact) {
                        failures.push({ from: currentFile, specifier, reason: `needs an explicit extension (found ${relative(Na__Verify__AppRoot, outcome.path)})` });
                        continue;
                    }
                    resolvedPath = outcome.path;
                } else {
                    resolvedPath = Na__Verify__ResolveBare(specifier, importMap);                 // <-- Bare specifier: import map only
                    if (!resolvedPath) {
                        failures.push({ from: currentFile, specifier, reason: 'bare specifier has no import map entry' });
                        continue;
                    }
                    if (!existsSync(resolvedPath)) {
                        failures.push({ from: currentFile, specifier, reason: `import map target missing on disk (${relative(Na__Verify__AppRoot, resolvedPath)})` });
                        continue;
                    }
                }

                queue.push(resolvedPath);
            }
        }

        return { visited, failures };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Entry Points
// -----------------------------------------------------------------------------

    // FUNCTION | Collect Every Module Index.html Loads Directly
    // ------------------------------------------------------------
    function Na__Verify__CollectEntryPoints() {
        const html      = readFileSync(Na__Verify__IndexPath, 'utf8');
        const entries   = new Set();

        const srcPattern = /<script[^>]+type=["']module["'][^>]*src=["']([^"']+)["']/gi;          // <-- <script type="module" src="...">
        let match;
        while ((match = srcPattern.exec(html)) !== null) {
            entries.add(resolve(Na__Verify__AppRoot, match[1]));
        }

        // Inline module blocks import the real entry points; treat Index.html
        // itself as a pseudo-module so its own import statements are walked.
        entries.add(Na__Verify__IndexPath);

        return [...entries];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Run
// -----------------------------------------------------------------------------

    const importMap   = Na__Verify__ReadImportMap();
    const appEntries  = Na__Verify__CollectEntryPoints();

    console.log('TrueVision3D - module graph resolution walk');
    console.log(`  app root   : ${Na__Verify__AppRoot}`);
    console.log(`  import map : ${Object.keys(importMap).length} entries`);
    console.log('');

    // ---------------------------------------------------------------
    // PASS 1 | The live app graph - what the browser actually loads today
    // ---------------------------------------------------------------
    const appWalk = Na__Verify__WalkGraph(appEntries, importMap);
    console.log(`  [1] app graph      : ${appWalk.visited.size} modules from ${appEntries.length} entry point(s), ${appWalk.failures.length} failure(s)`);

    // ---------------------------------------------------------------
    // PASS 2 | Every import-map target, walked on its own
    // ---------------------------------------------------------------
    // Pass 1 alone has a blind spot, and it is precisely the one that took
    // ValeVision down. A vendor entry point that nothing imports YET is never
    // reached, so its own broken specifier stays invisible until the phase that
    // first imports it - at which point it breaks every module on the page, not
    // just the new one. three-edge-projection importing clipper2-js is exactly
    // this shape. Walking each map target independently finds it now.
    const mapTargets = [];
    for (const [key, target] of Object.entries(importMap)) {
        if (key.endsWith('/')) continue;                                                         // <-- Prefix entry, not a module
        const targetPath = resolve(Na__Verify__AppRoot, target);
        if (!existsSync(targetPath)) {
            appWalk.failures.push({ from: Na__Verify__IndexPath, specifier: key, reason: `import map target missing on disk (${target})` });
            continue;
        }
        mapTargets.push(targetPath);
    }

    const vendorWalk = Na__Verify__WalkGraph(mapTargets, importMap);
    console.log(`  [2] import targets : ${vendorWalk.visited.size} modules from ${mapTargets.length} map target(s), ${vendorWalk.failures.length} failure(s)`);
    console.log('');

    const allFailures = [...appWalk.failures, ...vendorWalk.failures];

    // ---------------------------------------------------------------
    // Split the findings against the known-issue list
    // ---------------------------------------------------------------
    const known = [];
    const fresh = [];
    for (const failure of allFailures) {
        const fromPath = relative(Na__Verify__AppRoot, failure.from).split('\\').join('/');
        const entry    = Na__Verify__KnownIssues.find(issue =>
            fromPath.endsWith(issue.file) && failure.specifier === issue.specifier);
        if (entry) known.push({ failure, entry }); else fresh.push(failure);
    }

    if (known.length > 0) {
        console.log(`  KNOWN ISSUES (${known.length}) - real, documented, not on any reachable path:`);
        console.log('');
        for (const { failure, entry } of known) {
            console.log(`    ${relative(Na__Verify__AppRoot, failure.from)}`);
            console.log(`        "${failure.specifier}"  ->  ${failure.reason}`);
            console.log(`        WHY ALLOWED: ${entry.reason}`);
            console.log('');
        }
    }

    if (fresh.length === 0) {
        console.log('  PASS - every reachable import specifier resolves to a file on disk,');
        console.log('         in the live app graph and in every import map target.');
        if (known.length > 0) console.log(`         (${known.length} known issue(s) listed above, unchanged.)`);
        process.exit(0);
    }

    console.log(`  FAIL - ${fresh.length} unresolved specifier(s):`);
    console.log('');
    for (const failure of fresh) {
        console.log(`    ${relative(Na__Verify__AppRoot, failure.from)}`);
        console.log(`        "${failure.specifier}"  ->  ${failure.reason}`);
    }
    process.exit(1);

// endregion -------------------------------------------------------------------
