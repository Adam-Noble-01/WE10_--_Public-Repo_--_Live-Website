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

    // ---------------------------------------------------------------
    // PASS 2 | Na__ identifiers used but never imported or declared
    // ---------------------------------------------------------------
    // Pass 1 checks that every import RESOLVES. It is blind to the opposite
    // fault: an identifier USED with no import at all. Both end in a blank page,
    // and the second is the one a hand-edit produces - add a call, forget the
    // import line, and every static check still passes.
    //
    // A general no-undef needs full scope analysis. This does not, because the
    // codebase is rigorously Na__-prefixed: any Na__ identifier a file uses must
    // be declared in that file or imported into it. That single convention turns
    // an expensive check into a cheap one, and it is worth having - it is how
    // Na__ProjectedLinework__WebGpuBackend__GetProbe reached the browser as a
    // ReferenceError on 12-Sep-2026 with both harnesses reporting success.
    const undefinedUses = [];

    for (const file of files) {
        const source = StripComments(readFileSync(file, 'utf8'));

        const imported = new Set();
        const namedImport = /import\s*\{([^}]*)\}\s*from/g;
        let m;
        while ((m = namedImport.exec(source)) !== null) {
            m[1].split(',').map(p => p.trim()).filter(Boolean).forEach((part) => {
                const pieces = part.split(/\s+as\s+/);
                imported.add((pieces[1] || pieces[0]).trim());       // <-- `X as Y` binds Y
            });
        }
        // Namespace and default imports bind one local name each.
        const nsImport = /import\s+(?:\*\s+as\s+)?([A-Za-z0-9_$]+)\s+from/g;
        while ((m = nsImport.exec(source)) !== null) imported.add(m[1]);

        const declared = new Set();
        const declPattern = /(?:function|class|const|let|var)\s+(Na__[A-Za-z0-9_$]*)/g;
        while ((m = declPattern.exec(source)) !== null) declared.add(m[1]);

        // DESTRUCTURING BINDS NAMES TOO, and this codebase leans on it: the
        // loading sequence takes one options object and renames every field out
        // of it - `const { distanceCulling : Na__Config__DistanceCulling } = ...`.
        // Those are declarations, not uses, and missing them reports the whole
        // of a module's configuration as undefined.
        const destructure = /(?:const|let|var)\s*\{([\s\S]*?)\}\s*=/g;
        while ((m = destructure.exec(source)) !== null) {
            const renamed = /:\s*(Na__[A-Za-z0-9_$]+)/g;
            let r;
            while ((r = renamed.exec(m[1])) !== null) declared.add(r[1]);
            const shorthand = /(^|[,{\s])(Na__[A-Za-z0-9_$]+)\s*(?=[,}])/g;
            while ((r = shorthand.exec(m[1])) !== null) declared.add(r[2]);
        }

        // Function parameters, for the same reason.
        const params = /function\s+[A-Za-z0-9_$]*\s*\(([^)]*)\)/g;
        while ((m = params.exec(source)) !== null) {
            const p = /(Na__[A-Za-z0-9_$]+)/g;
            let r;
            while ((r = p.exec(m[1])) !== null) declared.add(r[1]);
        }

        // STRING LITERALS ARE STRIPPED BEFORE THE USE SCAN, because in this
        // codebase the module FILENAMES are Na__-prefixed too. Without this,
        // every `from '../80__CloudflareIntegration/Na__CloudflareIntegration__ApiClient__.js'`
        // reads as a use of an identifier by that name and the check reports a
        // dozen faults that are not faults - which is exactly how a checker
        // stops being read.
        // Also drop the import statements themselves. `import { X as Y }` binds
        // Y, but the line still contains the text X, which would otherwise read
        // as a use of an identifier this file never has.
        const codeOnly = source
            .replace(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, "''")
            .replace(/import\s*\{[^}]*\}\s*from[^;\n]*;?/g, '')
            .replace(/import\s+[^;\n]*from[^;\n]*;?/g, '')
            // Export blocks too. `export { X as Y }` PUBLISHES Y under a new
            // name; it is not a use of Y, and this codebase aliases on export
            // constantly to give a module a public name distinct from its
            // internal one. Without this every one of those reads as undefined.
            .replace(/export\s*\{[^}]*\}(\s*from[^;\n]*)?;?/g, '');

        // PROPERTY KEYS ARE NOT IDENTIFIERS. userData.Na__ModelType and
        // { Na__DrawPreset__Substitute : true } are data this codebase stamps on
        // three.js objects, and they follow the same naming convention as the
        // functions because they belong to the same modules. A check that cannot
        // tell a property from a binding reports every one of them.
        const used = new Set();
        // No lookahead inside this pattern. A trailing (?!...) makes the engine
        // backtrack into the identifier to satisfy itself, so Na__LeTabs__HEIGHT_PX
        // gets reported as Na__LeTabs__HEIGHT_P. The object-key test below is done
        // on the text AFTER the match instead, where it cannot chew the name.
        const usePattern = /(^|[^.\w$])(Na__[A-Za-z0-9_$]+)/g;
        while ((m = usePattern.exec(codeOnly)) !== null) {
            const after = codeOnly.slice(m.index + m[0].length);
            if (/^\s*:/.test(after)) continue;                   // <-- object literal key
            used.add(m[2]);
        }

        for (const name of used) {
            if (imported.has(name) || declared.has(name)) continue;
            undefinedUses.push({ file, name });
        }
    }

    if (undefinedUses.length > 0) {
        console.log(`  FAIL - ${undefinedUses.length} Na__ identifier(s) used but never imported or declared:`);
        console.log('');
        for (const u of undefinedUses) {
            console.log(`    ${relative(APP_ROOT, u.file)}`);
            console.log(`        "${u.name}"  ->  no import and no declaration in this file`);
        }
        if (failures.length > 0) {
            console.log('');
            console.log(`  ...and ${failures.length} unresolved import(s), listed below.`);
            for (const f of failures) {
                console.log(`    ${relative(APP_ROOT, f.file)}`);
                console.log(`        "${f.name}"  from  "${f.from}"  ->  ${f.reason}`);
            }
        }
        process.exit(1);
    }

    if (failures.length === 0) {
        console.log('  PASS - every named import resolves to a real export,');
        console.log('         and every Na__ identifier used is imported or declared.');
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
