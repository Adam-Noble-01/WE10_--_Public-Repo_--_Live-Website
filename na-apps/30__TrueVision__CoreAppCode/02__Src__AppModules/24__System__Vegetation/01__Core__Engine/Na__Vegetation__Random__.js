// =============================================================================
// TRUEVISION3D - VEGETATION - SEEDED RANDOM NUMBERS
// =============================================================================
//
// FILE       : Na__Vegetation__Random__.js
// NAMESPACE  : Na__VegRand
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : One small seeded generator, so a plop's seed always draws the same
//              bush on every machine, every load and every export
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - WHY NOT Math.random: a saved plop holds only its asset, its place and its
//   seed. The bush is drawn again from those on every load, so the same seed must
//   always give the same numbers, or a client's view and an exported image would
//   not show the same planting.
// - Mulberry32: 32 bits of state, no dependencies, fast enough to call a few
//   thousand times per plop at load. Imports nothing, so it can run in a worker.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/01__Core__Engine/Na__Vegetation__Random__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.83.0)
// - Moved in from the prototype 85__EarlyStage__VegetationLinework, where the look
//   was agreed. Byte for byte the same numbers.
//
// 04-Nov-2026 - Version 0.1.0
// - Initial build for the isolated aesthetic demo.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Seeded Generator
// -----------------------------------------------------------------------------

    // FUNCTION | Create a Generator from an Integer Seed
    // ------------------------------------------------------------
    function Na__VegRand__Create(seed) {
        let state = (seed >>> 0) || 1;                                         // <-- A zero state would stay zero for its first draws

        function next() {
            state = (state + 0x6D2B79F5) >>> 0;
            let t = state;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        }

        return {
            next,
            range  : (a, b) => a + (b - a) * next(),
            int    : (a, b) => a + Math.floor((b - a + 1) * next()),           // <-- Both ends included
            chance : (p) => next() < p,
            skew   : (a, b, power) => a + (b - a) * Math.pow(next(), power),   // <-- Power above 1 leans towards a: many small, few large
            angle  : () => next() * Math.PI * 2
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Seeded Random API
    // ------------------------------------------------------------
    export {
        Na__VegRand__Create
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
