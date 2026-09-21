// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - VECTOR TOOLS - SETUP
// =============================================================================
//
// FILE       : Na__LayoutEditor__VectorTools__Setup__.js
// NAMESPACE  : Na__LeVecCfg
// MODULE     : Layout Editor - Vector Tools - Setup
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Reads the vector tools' config once and answers for it: how the tools behave, what the previews look like, and every label
// CREATED    : 21-Sep-2026
//
// DESCRIPTION:
// - Na__LayoutEditor__VectorTools__Config__.json is fetched once, as the
//   editor loads. It never rejects: a file that is missing or will not parse
//   leaves every reader on the fallback written beside its call, which is the
//   shipped behaviour and the English words, so the tools still work.
// - When it lands, the defaults block is handed to the State unit, which keeps
//   whatever this browser has already chosen.
//
// INTEGRATION:
// - Every unit in this folder asks here for a number, a switch, a colour or a
//   label. Imports only the State leaf.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (21-Sep-2026)
// - ValeVision    : not yet ported - it waits for Adam's sign-off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 21-Sep-2026 - Version 1.0.0
// - Initial implementation.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Settings That Take the Config's Defaults
    // ------------------------------------------------------------
    import { Na__LeVec__ApplyDefaults } from './Na__LayoutEditor__VectorTools__State__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Where the Config Is
    // ------------------------------------------------------------
    const Na__LeVecCfg__Url    = new URL('./Na__LayoutEditor__VectorTools__Config__.json', import.meta.url);
    const Na__LeVecCfg__PREFIX = 'LayoutEditor__VectorTools__';
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Config
    // ------------------------------------------------------------
    let Na__LeVecCfg__Config  = null;
    let Na__LeVecCfg__Loading = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | One Block of the Config
    // ------------------------------------------------------------
    function Na__LeVecCfg__Block(name) {
        const block = Na__LeVecCfg__Config ? Na__LeVecCfg__Config[Na__LeVecCfg__PREFIX + name] : null;
        return (block && typeof block === 'object' && !Array.isArray(block)) ? block : {};
    }
    // ------------------------------------------------------------


    // FUNCTION | A Number, a Switch, a Colour or a List From the Config
    // ------------------------------------------------------------
    // The fallback's own type decides what is accepted, so a number written as
    // a string in the file is refused rather than quietly used as text.
    // ------------------------------------------------------------
    function Na__LeVecCfg__Value(block, key, fallback) {
        const value = Na__LeVecCfg__Block(block)[block + '__' + key];
        if (typeof fallback === 'boolean') return (typeof value === 'boolean') ? value : fallback;
        if (typeof fallback === 'number')  return (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
        if (Array.isArray(fallback))       return (Array.isArray(value) && value.length && value.every((n) => typeof n === 'number' && Number.isFinite(n))) ? value.slice() : fallback.slice();
        return (typeof value === 'string' && value !== '') ? value : fallback;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Label, and a Label With {tokens} Filled In
    // ------------------------------------------------------------
    function Na__LeVecCfg__Label(key, fallback) {
        return Na__LeVecCfg__Value('Labels', key, fallback);
    }
    function Na__LeVecCfg__Format(key, fallback, tokens) {
        return Na__LeVecCfg__Label(key, fallback).replace(/\{(\w+)\}/g, (whole, name) => (tokens && tokens[name] !== undefined && tokens[name] !== null) ? String(tokens[name]) : whole);
    }
    // ------------------------------------------------------------


    // FUNCTION | Fetch the Config Once
    // ------------------------------------------------------------
    function Na__LeVecCfg__Ready() {
        if (!Na__LeVecCfg__Loading) {
            Na__LeVecCfg__Loading = (async () => {
                try {
                    const response = await fetch(Na__LeVecCfg__Url, { cache : 'no-store' });
                    if (!response.ok) throw new Error('HTTP ' + response.status);
                    Na__LeVecCfg__Config = await response.json();
                } catch (error) {
                    console.warn('[TrueVision3D LayoutEditor] Vector tools config unavailable - the built-in settings are used.', error);
                    Na__LeVecCfg__Config = null;
                }
                const defaults = Na__LeVecCfg__Block('Behaviour').Behaviour__Defaults;
                Na__LeVec__ApplyDefaults((defaults && typeof defaults === 'object') ? defaults : {});
                return Na__LeVecCfg__Config;
            })();
        }
        return Na__LeVecCfg__Loading;
    }
    // ------------------------------------------------------------

    // THE CONFIG IS ASKED FOR AS THE EDITOR LOADS, so the panel's words are in
    // before it is first drawn. Never rejects. Skipped where there is no fetch
    // to ask with (a Node test), which leaves every reader on its fallback.
    if (typeof fetch === 'function' && typeof window !== 'undefined') void Na__LeVecCfg__Ready();

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Vector Tools Setup
    // ------------------------------------------------------------
    export {
        Na__LeVecCfg__Value,
        Na__LeVecCfg__Label,
        Na__LeVecCfg__Format,
        Na__LeVecCfg__Ready
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
