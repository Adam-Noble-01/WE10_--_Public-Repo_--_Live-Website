// =============================================================================
// TRUEVISION3D - VERIFY - NAMED EXPORT RESOLUTION
// =============================================================================
//
// FILE       : Na__Verify__Exports__.mjs
// NAMESPACE  : Na__Verify
// MODULE     : Named Export Resolution Check
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Prove every imported name is actually exported by the file it comes from
// CREATED    : 10-Sep-2026
//
// DESCRIPTION:
// - The module graph walker proves every FILE resolves. This proves every NAME
//   does. They are different faults with the same symptom: a blank page.
// - This is the fault the ValeVision port throws constantly, because the two
//   trees drift. A ported module asks for Na__NavToolbar__SetOrbitMode and
//   TrueVision calls it Na__NavToolbar__SetActiveMode; both files parse, the
//   graph resolves, and the import throws at runtime.
// - Static, so it runs without a browser and covers modules no page loads yet.
//
// USAGE:
//     node 80__Testing__PrototypeEnvironment/Na__Verify__Exports__.mjs [subdir ...]
//
//   With no arguments it checks every module under 02__Src__AppModules.
//   Exit 0 = every imported name is exported. Exit 1 = at least one is not.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 10-Sep-2026 - Version 1.0.0
// - Written for the ValeVision re-alignment port.
//
// =============================================================================

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_ROOT   = resolve(SCRIPT_DIR, '..');
const SRC_ROOT   = resolve(APP_ROOT, '02__Src__AppModules');

// -----------------------------------------------------------------------------
// REGION | Source Preparation
// -----------------------------------------------------------------------------

    // FUNCTION | Strip Comments, Tracking String Literals
    // ------------------------------------------------------------
    function StripComments(source) {
        let out = '', i = 0, quote = null;
        while (i < source.length) {
            const c = source[i], n = source[i + 1];
            if (quote) {
                out += c;
                if (c === '\\') { out += n ?? ''; i += 2; continue; }
                if (c === quote) quote = null;
                i += 1; continue;
            }
            if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i += 1; continue; }
            if (c === '/' && n === '/') { while (i < source.length && source[i] !== '\n') i += 1; continue; }
            if (c === '/' && n === '*') { i += 2; while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i += 1; i += 2; out += ' '; continue; }
            out += c; i += 1;
        }
        return out;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Parsing
// -----------------------------------------------------------------------------

    // FUNCTION | Collect the Named Imports a File Asks For
    // ------------------------------------------------------------
    // Returns [{ names: [...], from: 'specifier' }]. Default and namespace
    // imports are ignored - only braces carry names that can go missing.
    // ------------------------------------------------------------
    function CollectNamedImports(source) {
        const results = [];
        const pattern = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g;
        let match;
        while ((match = pattern.exec(source)) !== null) {
            const names = match[1]
                .split(',')
                .map(part => part.trim())
                .filter(Boolean)
                .map(part => part.split(/\s+as\s+/)[0].trim())   // <-- `X as Y` is a request for X
                .filter(Boolean);
            if (names.length > 0) results.push({ names, from: match[2] });
        }
        return results;
    }
    // ------------------------------------------------------------


    // FUNCTION | Collect the Names a File Exports
    // ------------------------------------------------------------
    // Covers `export { a, b }`, `export function a`, `export const a`,
    // `export class a`, and `export * from` (recorded as a wildcard).
    // ------------------------------------------------------------
    function CollectExports(source) {
        const names = new Set();
        let hasWildcard = false;

        const blockPattern = /export\s*\{([^}]*)\}(?!\s*from)/g;
        let match;
        while ((match = blockPattern.exec(source)) !== null) {
            match[1].split(',').map(p => p.trim()).filter(Boolean).forEach((part) => {
                const pieces = part.split(/\s+as\s+/);
                names.add((pieces[1] || pieces[0]).trim());       // <-- `a as b` exports b
            });
        }

        const reExport = /export\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g;
        while ((match = reExport.exec(source)) !== null) {
            match[1].split(',').map(p => p.trim()).filter(Boolean).forEach((part) => {
                const pieces = part.split(/\s+as\s+/);
                names.add((pieces[1] || pieces[0]).trim());
            });
        }

        const declPattern = /export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_$]+)/g;
        while ((match = declPattern.exec(source)) !== null) names.add(match[1]);

        if (/export\s*\*\s*from/.test(source)) hasWildcard = true;

        return { names, hasWildcard };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Walk
// -----------------------------------------------------------------------------

    // FUNCTION | Every .js File Under a Directory
    // ------------------------------------------------------------
    function CollectJsFiles(dir, acc = []) {
        for (const entry of readdirSync(dir)) {
            const full = join(dir, entry);
            const st   = statSync(full);
            if (st.isDirectory()) CollectJsFiles(full, acc);
            else if (entry.endsWith('.js')) acc.push(full);
        }
        return acc;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Run
// -----------------------------------------------------------------------------

    const args    = process.argv.slice(2);
    const roots   = args.length > 0 ? args.map(a => resolve(SRC_ROOT, a)) : [SRC_ROOT];
    const files   = roots.flatMap(r => (existsSync(r) ? CollectJsFiles(r) : []));
    const exportCache = new Map();

    function ExportsOf(path) {
        if (exportCache.has(path)) return exportCache.get(path);
        let result = { names: new Set(), hasWildcard: false, missing: true };
        if (existsSync(path)) {
            try { result = { ...CollectExports(StripComments(readFileSync(path, 'utf8'))), missing: false }; }
            catch { /* leave as missing */ }
        }
        exportCache.set(path, result);
        return result;
    }

    console.log('TrueVision3D - named export resolution');
    console.log(`  files checked : ${files.length}`);
    console.log('');

    const failures = [];

    for (const file of files) {
        const source  = StripComments(readFileSync(file, 'utf8'));
        const imports = CollectNamedImports(source);

        for (const record of imports) {
            if (!record.from.startsWith('.')) continue;            // <-- Bare specifiers are the graph walker's job
            const target = resolve(dirname(file), record.from);
            const info   = ExportsOf(target);
            if (info.missing) {
                failures.push({ file, from: record.from, name: '(whole module)', reason: 'target file not found' });
                continue;
            }
            if (info.hasWildcard) continue;                        // <-- Cannot resolve through `export *` statically
            for (const name of record.names) {
                if (!info.names.has(name)) {
                    failures.push({ file, from: record.from, name, reason: 'not exported by the target' });
                }
            }
        }
    }

    if (failures.length === 0) {
        console.log('  PASS - every named import resolves to a real export.');
        process.exit(0);
    }

    console.log(`  FAIL - ${failures.length} unresolved name(s):`);
    console.log('');
    for (const f of failures) {
        console.log(`    ${relative(APP_ROOT, f.file)}`);
        console.log(`        "${f.name}"  from  "${f.from}"  ->  ${f.reason}`);
    }
    process.exit(1);

// endregion -------------------------------------------------------------------
