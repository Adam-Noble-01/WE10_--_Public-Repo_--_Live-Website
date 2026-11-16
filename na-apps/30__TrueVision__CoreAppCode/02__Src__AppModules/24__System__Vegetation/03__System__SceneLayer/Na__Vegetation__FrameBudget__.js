// =============================================================================
// TRUEVISION3D - VEGETATION - FRAME BUDGET
// =============================================================================
//
// FILE       : Na__Vegetation__FrameBudget__.js
// NAMESPACE  : Na__VegBudget
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Decide which plants are worth redrawing while the camera moves, most
//              wrong first, and stop when this frame's time is spent
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - WHY A PLANT CAN WAIT. Its lines sit in world space, so a plant not redrawn stays
//   exactly where it was. Only its outline goes slowly out of date, because the eye
//   has moved round it. So the question each frame is not "has it changed" but "how
//   many pixels wrong would it look", and most plants, most frames, are under one.
// - THE ERROR, IN PIXELS. How far round the plant the eye has come since it was drawn
//   (a chord on the unit sphere, near enough the angle) times its radius on screen,
//   since a line on a ball of that radius moves that far. A far plant barely moves
//   however fast the orbit. Walking towards one adds its own term: its lines are still
//   right, but drawn too coarsely for how big it has become.
// - THREE KINDS OF DRAWING (the scene layer picks, this module does the sums):
//     FULL      every plant, now. Any render that is not the live loop's, so a render
//               path nobody has thought of gets the whole picture without knowing this
//               exists. Also the first live frame, and the frame after a rule changes.
//     MOVING    a live frame with the camera moving: this frame's time, most wrong
//               first, with a cheaper drawing that drops the smallest balls and samples
//               less closely. A frame nobody studies, like the reduced AO kernel.
//     SETTLING  a later live frame with the same view: the exact drawing, a frame's
//               worth at a time, so stopping for one frame in a slow drag never costs a
//               long frame. The refiner stands off until this finishes, because each of
//               these frames asks for the next, and a request restarts its wait.
// - WHY THE MOVING DRAWING HAS TO BE CHEAP (measured, 04-Nov-2026). At a steady orbit the
//   worst error settles at (turn per frame) x (the plants' radii added up) / (plants
//   redrawn per frame). 236 plants of 35 px, at 60 degrees a second, redrawn at 1 ms
//   each in a 5 ms budget: 36 px, which reads as cardboard. A frame rate alone hid this.
// - NOTHING HERE TOUCHES THREE.JS OR THE CLOCK, so it runs in Node for checks.
//
// INTEGRATION:
// - Used by Na__Vegetation__SceneLayer__.js.
// - Tuned from Vegetation__FrameBudget__Config in ../Na__Vegetation__AppConfig__.json.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/03__System__SceneLayer/Na__Vegetation__FrameBudget__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.84.0)
// - Initial build: Stage 2 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | The Page Test
    // ------------------------------------------------------------
    import { Na__VegContour__PageRadiusPx } from '../01__Core__Engine/Na__Vegetation__Contour__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Fallback Tuning and the Never-Drawn Score
    // ------------------------------------------------------------
    const Na__VegBudget__DEFAULTS = {
        movingMs          : 5,
        settlingMs        : 12,
        staleErrorPx      : 0.6,
        zoomErrorPx       : 8,
        movingBallSkipPx  : 3,
        movingSegmentPx   : 6,
        movingMinK        : 10,
        movingBisectSteps : 2
    };
    const Na__VegBudget__NEVER_DRAWN = 1e9;                                    // <-- A hole in the picture beats any stale line, the nearest first
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Tuning
// -----------------------------------------------------------------------------

    // FUNCTION | Read the Config Block, or the Fallbacks Without One
    // ------------------------------------------------------------
    function Na__VegBudget__ReadTuning(config) {
        const read = (key, fallback) => (config && Number.isFinite(config[key])) ? config[key] : fallback;
        return {
            movingMs          : read('Vegetation__FrameBudget__MovingMs', Na__VegBudget__DEFAULTS.movingMs),
            settlingMs        : read('Vegetation__FrameBudget__SettlingMs', Na__VegBudget__DEFAULTS.settlingMs),
            staleErrorPx      : read('Vegetation__FrameBudget__StaleErrorPx', Na__VegBudget__DEFAULTS.staleErrorPx),
            zoomErrorPx       : read('Vegetation__FrameBudget__ZoomErrorPx', Na__VegBudget__DEFAULTS.zoomErrorPx),
            movingBallSkipPx  : read('Vegetation__FrameBudget__MovingBallSkipPx', Na__VegBudget__DEFAULTS.movingBallSkipPx),
            movingSegmentPx   : read('Vegetation__FrameBudget__MovingSegmentPx', Na__VegBudget__DEFAULTS.movingSegmentPx),
            movingMinK        : read('Vegetation__FrameBudget__MovingMinK', Na__VegBudget__DEFAULTS.movingMinK),
            movingBisectSteps : read('Vegetation__FrameBudget__MovingBisectSteps', Na__VegBudget__DEFAULTS.movingBisectSteps)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | The Cheaper Drawing for a Moving Frame, from the Exact One
    // ------------------------------------------------------------
    function Na__VegBudget__MovingStyle(style, tuning) {
        return Object.assign({}, style, {
            lodSkipPx   : Math.max(style.lodSkipPx, tuning.movingBallSkipPx),
            segmentPx   : Math.max(style.segmentPx, tuning.movingSegmentPx),
            minK        : tuning.movingMinK,
            bisectSteps : tuning.movingBisectSteps
        });
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | What Needs Drawing
// -----------------------------------------------------------------------------

    // FUNCTION | Note Where a Plant Was Seen From, as It Is Drawn
    // ------------------------------------------------------------
    // A plant is { bush, everDrawn, exactStamp, dirX, dirY, dirZ, drawnRadiusPx, errorPx,
    // radiusPx }. exactStamp is the view it was last drawn exactly for: a moving frame's
    // drawing does not count, so the frames after the camera stops still come to it.
    // ------------------------------------------------------------
    function Na__VegBudget__NoteDrawn(plant, view, stamp, exact) {
        const bush = plant.bush;
        const dx = view.eyeX - bush.boundsCx, dy = view.eyeY - bush.boundsCy, dz = view.eyeZ - bush.boundsCz;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        plant.dirX = dx / length;
        plant.dirY = dy / length;
        plant.dirZ = dz / length;
        plant.drawnRadiusPx = plant.radiusPx;
        plant.everDrawn     = true;
        if (exact) plant.exactStamp = stamp;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | How Many Pixels Wrong a Plant Looks from This View
    // ------------------------------------------------------------
    function Na__VegBudget__ErrorPx(plant, view, radiusPx, tuning) {
        if (!plant.everDrawn) return Na__VegBudget__NEVER_DRAWN + radiusPx;

        const bush = plant.bush;
        const dx = view.eyeX - bush.boundsCx, dy = view.eyeY - bush.boundsCy, dz = view.eyeZ - bush.boundsCz;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const cx = dx / length - plant.dirX, cy = dy / length - plant.dirY, cz = dz / length - plant.dirZ;
        const chord = Math.sqrt(cx * cx + cy * cy + cz * cz);

        const growth = plant.drawnRadiusPx > 0 ? radiusPx / plant.drawnRadiusPx : 1;
        return radiusPx * chord + Math.abs(growth - 1) * tuning.zoomErrorPx;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Most Wrong First
    // ------------------------------------------------------------
    function Na__VegBudget__MostWrongFirst(a, b) {
        return b.errorPx - a.errorPx;
    }
    // ------------------------------------------------------------


    // FUNCTION | List the Plants on the Page Not Yet Drawn Exactly for This View, Most Wrong First
    // ------------------------------------------------------------
    // rank is a list kept by the caller and reused, so a frame makes no garbage.
    // A plant off the page is not listed: it keeps its last lines, which nobody can
    // see, and costs nothing until it comes back. Returns how many are listed.
    // ------------------------------------------------------------
    function Na__VegBudget__Rank(plants, view, stamp, tuning, rank) {
        let count = 0;
        for (let p = 0; p < plants.length; p++) {
            const plant = plants[p];
            const radiusPx = Na__VegContour__PageRadiusPx(plant.bush, view);
            plant.radiusPx = radiusPx;
            if (radiusPx < 0 || plant.exactStamp === stamp) continue;
            plant.errorPx = Na__VegBudget__ErrorPx(plant, view, radiusPx, tuning);
            rank[count++] = plant;
        }
        rank.length = count;
        rank.sort(Na__VegBudget__MostWrongFirst);
        return count;
    }
    // ------------------------------------------------------------


    // FUNCTION | Spend This Frame's Time on the Ranked Plants
    // ------------------------------------------------------------
    // budgetMs null means draw them all. With a budget, stop when the time is gone or
    // when what is left is less wrong than minErrorPx. The first plant always draws, so
    // a slow device still gets somewhere. now is passed in, to test without a clock.
    // Returns how many were drawn.
    // ------------------------------------------------------------
    function Na__VegBudget__Spend(rank, count, budgetMs, minErrorPx, drawOne, now) {
        if (budgetMs === null) {
            for (let r = 0; r < count; r++) drawOne(rank[r]);
            return count;
        }
        const startedAt = now();
        let drawn = 0;
        for (let r = 0; r < count; r++) {
            if (rank[r].errorPx < minErrorPx) break;                           // <-- Sorted: everything after this is smaller still
            if (drawn > 0 && now() - startedAt >= budgetMs) break;
            drawOne(rank[r]);
            drawn++;
        }
        return drawn;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Frame Budget API
    // ------------------------------------------------------------
    export {
        Na__VegBudget__NEVER_DRAWN,
        Na__VegBudget__ReadTuning,
        Na__VegBudget__MovingStyle,
        Na__VegBudget__NoteDrawn,
        Na__VegBudget__Rank,
        Na__VegBudget__Spend
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
