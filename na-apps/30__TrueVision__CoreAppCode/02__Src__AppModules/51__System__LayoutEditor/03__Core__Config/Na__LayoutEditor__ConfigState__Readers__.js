// =============================================================================
// TRUEVISION3D - LAYOUT EDITOR - CONFIG STATE - READERS
// =============================================================================
//
// FILE       : Na__LayoutEditor__ConfigState__Readers__.js
// NAMESPACE  : Na__LeCfg
// MODULE     : Layout Editor - Config State - Readers
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Hold the parsed Layout Editor config, its fetch and the readers every setup block reads through
// CREATED    : 15-Sep-2026
//
// DESCRIPTION:
// - Holds the parsed Na__LayoutEditor__AppConfig__.json, the fetch that fills
//   it, and the readers every setup block and label goes through: Val (one
//   value, or the fallback when absent), Num (a finite number), Unit (an
//   opacity from 0 to 1) and Choice (one of a fixed set of words).
// - The config state sits here with the only function that assigns it, so no
//   other unit writes to it. Na__LeCfg__Config is exported as a live binding
//   for the enabled guard to read.
// - Imports nothing, so every other ConfigState unit can import it without a
//   cycle.
//
// INTEGRATION:
// - Na__LayoutEditor__ConfigState__ calls Fetch from Ready and reads PREFIX,
//   Config and Val for the enabled guard and the labels.
// - The SheetSetup, ToolSetup and EditorSetup units read through Val, Num,
//   Unit and Choice; the KeyMap unit shares PREFIX. Every other module
//   imports Na__LayoutEditor__ConfigState__.js, never this unit.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : the ValeVision3D v2.47.0 split of the same module (same unit, same functions)
// - Parity        : verbatim (moved code)
// - Divergences   : Console prefix only.
// - Back-port     : n/a (this IS the back-port)
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Sep-2026 - Version 1.0.0
// - Split out of Na__LayoutEditor__ConfigState__.js; the code moved verbatim.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants and State
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Config Location and Key Shape
    // ------------------------------------------------------------
    const Na__LeCfg__ConfigUrl  = new URL('./Na__LayoutEditor__AppConfig__.json', import.meta.url);
    const Na__LeCfg__PREFIX     = 'LayoutEditor__';
    // ------------------------------------------------------------

    // MODULE VARIABLES | Parsed Config
    // ------------------------------------------------------------
    let Na__LeCfg__Config      = null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Config Reading
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read One Value From a Block (fallback when absent)
    // ------------------------------------------------------------
    function Na__LeCfg__Val(blockName, keyName, fallback) {
        const block = Na__LeCfg__Config ? Na__LeCfg__Config[Na__LeCfg__PREFIX + blockName + '__Config'] : null;
        const value = block ? block[Na__LeCfg__PREFIX + blockName + '__' + keyName] : undefined;
        return (value === undefined || value === null) ? fallback : value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read a Finite Number, or the Fallback
    // ------------------------------------------------------------
    function Na__LeCfg__Num(blockName, keyName, fallback) {
        const value = Na__LeCfg__Val(blockName, keyName, undefined);
        return (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read an Opacity (0 clear to 1 solid), or the Fallback
    // ------------------------------------------------------------
    function Na__LeCfg__Unit(blockName, keyName, fallback) {
        return Math.max(0, Math.min(1, Na__LeCfg__Num(blockName, keyName, fallback)));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Read One of a Fixed Set of Words, or the Fallback
    // ------------------------------------------------------------
    function Na__LeCfg__Choice(blockName, keyName, allowed, fallback) {
        const value = Na__LeCfg__Val(blockName, keyName, fallback);
        return allowed.indexOf(value) === -1 ? fallback : value;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Fetch the System JSON Once
    // ------------------------------------------------------------
    async function Na__LeCfg__Fetch() {
        try {
            const response = await fetch(Na__LeCfg__ConfigUrl, { cache : 'no-store' });
            if (!response.ok) {
                console.warn('[TrueVision3D LayoutEditor] Config fetch failed (' + response.status + ') - using built-in defaults.');
                return false;
            }
            Na__LeCfg__Config = await response.json();
            return true;
        } catch (error) {
            console.warn('[TrueVision3D LayoutEditor] Config unreadable - using built-in defaults.', error);
            return false;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Layout Editor Config State Readers
    // ------------------------------------------------------------
    export {
        Na__LeCfg__PREFIX,
        Na__LeCfg__Config,
        Na__LeCfg__Val,
        Na__LeCfg__Num,
        Na__LeCfg__Unit,
        Na__LeCfg__Choice,
        Na__LeCfg__Fetch
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
