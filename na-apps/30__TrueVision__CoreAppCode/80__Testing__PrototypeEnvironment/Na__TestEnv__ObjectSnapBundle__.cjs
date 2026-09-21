// =============================================================================
// TRUEVISION3D - TEST ENVIRONMENT - OBJECT SNAP BUNDLE
// =============================================================================
//
// FILE       : Na__TestEnv__ObjectSnapBundle__.cjs
// NAMESPACE  : Na__TestEnv
// MODULE     : Test Environment - Object Snap Bundle
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The Object Snap folder's units as ONE source text with their imports taken out, so a test can run the real snapping against stubs of everything outside the folder
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - The snapping used to be one file, and the suites loaded that one file with
//   its imports replaced by stubs. It is a folder of units now
//   (51__System__LayoutEditor/28__System__ObjectSnap), and the units import
//   each other - so stripping the imports from one of them would strip the
//   folder out from under it.
// - Na__TestEnv__ObjectSnapBundle reads the units asked for, IN THE ORDER
//   GIVEN (a unit after the ones it reads), takes every import statement and
//   every export block out of each, and joins them. Every top-level name in
//   the folder is unique, so the joined text is one valid module body: what
//   was an import from a sibling unit is simply a name declared further up.
//   What is left undeclared is exactly the folder's OUTSIDE - config, model,
//   surface, viewports, markup, the grid - which the test stubs, as it always
//   did.
// - It hands back { source, names }: the text, and every name the units
//   exported, so an ES module test can append `export { ...names }` and a vm
//   test can simply run the text.
// - Left out unless asked for: the Marker (it needs a document - stub
//   ShowMarker and HideMarker instead), the controller and the Menu (config
//   fetch, DOM).
//
// USAGE (an .mjs suite):
//     import bundle from './Na__TestEnv__ObjectSnapBundle__.cjs';
//     const built = bundle.Na__TestEnv__ObjectSnapBundle(SRC, [ 'State', 'Geometry', 'Index', 'Sources', 'Search' ]);
//     writeFileSync(tmp, stubs + '\n' + built.source + '\nexport { ' + built.names.join(', ') + ' };');
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Written when the snapping moved into its own folder, for
//   Na__Test__ObjectSnap__, Na__Test__DrawingGrid__, Na__Test__LayerMenu__ and
//   Na__Test__GroupMoveSnapping__.
//
// =============================================================================

const fs   = require('node:fs');
const path = require('node:path');


// -----------------------------------------------------------------------------
// REGION | Bundling
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where the Folder Is, and What Is Taken Out of Each Unit
    // ------------------------------------------------------------
    const Na__TestEnv__OSNAP_FOLDER  = '51__System__LayoutEditor/28__System__ObjectSnap/';
    const Na__TestEnv__IMPORT_RULE   = /^[ \t]*import\s+(?:\{[\s\S]*?\}|[\w*\s,]+)\s+from\s+'[^']+';[ \t]*(?:\/\/[^\n]*)?$/gm;   // <-- A whole import statement, its trailing comment included
    const Na__TestEnv__EXPORT_RULE   = /^[ \t]*export\s*\{([\s\S]*?)\};[ \t]*$/gm;                                               // <-- A unit's one export block
    // ------------------------------------------------------------


    // HELPER FUNCTION | The File a Unit's Short Name Stands For
    // ------------------------------------------------------------
    // 'Search' is Na__LayoutEditor__ObjectSnap__Search__.js; a name that
    // already ends in .js is taken as it stands (Na__LayoutEditor__
    // ViewportSnapMove__.js).
    // ------------------------------------------------------------
    function Na__TestEnv__UnitFile(unit) {
        return /\.js$/.test(unit) ? unit : 'Na__LayoutEditor__ObjectSnap__' + unit + '__.js';
    }
    // ------------------------------------------------------------


    // FUNCTION | The Units, Joined, With Their Imports and Exports Taken Out
    // ------------------------------------------------------------
    // srcRoot is the app's 02__Src__AppModules folder. Throws when an import
    // survives the stripping, because a test that quietly ran half a module
    // would prove nothing.
    // ------------------------------------------------------------
    function Na__TestEnv__ObjectSnapBundle(srcRoot, units) {
        const names = [];
        const parts = (units || []).map((unit) => {
            const file = path.resolve(srcRoot, Na__TestEnv__OSNAP_FOLDER, Na__TestEnv__UnitFile(unit));
            let text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');               // <-- CRLF files are read as LF first: the import rule ends a line at ';'
            text = text.replace(Na__TestEnv__IMPORT_RULE, '');
            if (/^\s*import\s/m.test(text)) throw new Error('An import survived in ' + file);
            text = text.replace(Na__TestEnv__EXPORT_RULE, (whole, inner) => {
                inner.split(',').map((name) => name.trim()).filter(Boolean).forEach((name) => { if (names.indexOf(name) === -1) names.push(name); });
                return '';
            });
            if (/^\s*export\s/m.test(text)) throw new Error('An export survived in ' + file);
            return '// ---- ' + unit + ' ----\n' + text;
        });
        return { source : parts.join('\n'), names : names };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


module.exports = { Na__TestEnv__ObjectSnapBundle };
