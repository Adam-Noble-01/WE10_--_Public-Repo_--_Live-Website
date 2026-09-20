// =============================================================================
// TRUEVISION3D - DRAWING PLANES - MATHS
// =============================================================================
//
// FILE       : Na__DrawingPlanes__Maths__.js
// NAMESPACE  : Na__PlaneMath
// MODULE     : Drawing Planes - Maths
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : The snap grid, the drag solve, the plane's own 2D frame and the two record solves, with no imports at all
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - IMPORTS NOTHING, so Node runs it exactly as the app does and every rule in
//   here is proved by Na__Test__DrawingPlanes__.test.mjs rather than by eye.
//   Vectors are plain { x, y, z } objects; a THREE.Vector3 is one, so the
//   callers pass theirs straight in.
//
// - THE SNAP IS ABSOLUTE. A plane's position is one number: how far along its
//   own normal it sits from the world origin (a height, for a floor plan).
//   That number is what is snapped - never the distance dragged. So a plane
//   that started at 20 013 lands on 20 000 or 20 050, not 20 063, and every
//   plane in a model shares one grid whatever it was before. For the four
//   compass elevations the normal IS a world axis, so the grid is the world's.
//
// - THE DRAG IS THE POINT ON THE NORMAL CLOSEST TO THE POINTER RAY. The same
//   solve the old gizmo grip used, so a plane can only ever travel along its
//   own normal. It also reports how well conditioned the answer is: when the
//   normal points almost straight at the camera one pixel becomes metres, and
//   the grip holds the plane still rather than fling it.
//
// - A PLANE HAS ITS OWN 2D FRAME: an origin at its bottom-left corner, a unit
//   u along its width and a unit v up its height, with u x v pointing at the
//   viewer. Everything a plane shows is laid out in that frame, and a pointer
//   ray is turned into frame coordinates to find what it is over - exact, with
//   no scene raycast, and indifferent to whether the overlay is being drawn.
//
// - THE GROUND UNDER A VERTICAL PLANE is found by cutting the landscape's own
//   triangles with the plane. It lives here, not with the bounds, because it
//   is arithmetic on a flat array and can be proved without a scene.
//
// - TWO RECORD SOLVES. An elevation stores a POINT its plane passes through,
//   so moving the plane means sliding that point along the normal. A floor
//   plan stores a floor level and a cut above it, so moving its plane means
//   changing the cut - and carrying the floor level down only when the cut
//   would otherwise fall under its minimum.
//
// INTEGRATION:
// - Na__DrawingPlanes__Grip__, Na__DrawingPlanes__Overlay__ and the two Dev
//   menu editors' source adapters.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation for the Drawing Planes build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Tolerances
    // ------------------------------------------------------------
    const Na__PlaneMath__PARALLEL_EPSILON = 1e-9;   // <-- Below this a ray and a plane, or two lines, are treated as parallel
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Snap Grid
// -----------------------------------------------------------------------------

    // FUNCTION | The Multiple of an Increment Nearest to a Value
    // ------------------------------------------------------------
    // A bad increment returns the value rounded to a whole millimetre, which
    // is what "no snapping" means everywhere else in this system.
    // ------------------------------------------------------------
    function Na__PlaneMath__ToIncrement(valueMm, incrementMm) {
        if (!Number.isFinite(valueMm)) return 0;
        if (!Number.isFinite(incrementMm) || incrementMm <= 0) return Math.round(valueMm) + 0;
        return (Math.round(valueMm / incrementMm) * incrementMm) + 0;            // <-- + 0 turns a negative zero into zero
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply the Snap State to a Value
    // ------------------------------------------------------------
    // snap: { enabled, incrementMm }. Off still rounds to a whole millimetre:
    // records are stored in whole millimetres and a dragged 1 234.567 would
    // otherwise be one number on screen and another in the saved file.
    // ------------------------------------------------------------
    function Na__PlaneMath__ApplySnap(valueMm, snap) {
        if (snap && snap.enabled === true) return Na__PlaneMath__ToIncrement(valueMm, snap.incrementMm);
        return Na__PlaneMath__ToIncrement(valueMm, 1);
    }
    // ------------------------------------------------------------


    // FUNCTION | Write a Millimetre Value With Its Thousands Grouped
    // ------------------------------------------------------------
    // "20 000", "-1 250". A space rather than a comma: on a drawing a
    // comma is a decimal point to half of Europe. Used by the drag readout,
    // the toasts and both panels' descriptions, so they cannot disagree.
    // ------------------------------------------------------------
    function Na__PlaneMath__FormatMm(valueMm) {
        if (!Number.isFinite(valueMm)) return '0';
        const whole = Math.round(valueMm);
        const text  = String(Math.abs(whole)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        return (whole < 0 ? '-' : '') + text;
    }
    // ------------------------------------------------------------


    // FUNCTION | The Member of a List Nearest to a Value
    // ------------------------------------------------------------
    // Used to bring a stored increment back onto a list that has since
    // changed. Ties go to the smaller member.
    // ------------------------------------------------------------
    function Na__PlaneMath__NearestInList(list, value) {
        if (!Array.isArray(list) || list.length === 0) return value;
        let best = list[0];
        for (let i = 1; i < list.length; i++) {
            if (Math.abs(list[i] - value) < Math.abs(best - value)) best = list[i];
        }
        return best;
    }
    // ------------------------------------------------------------


    // FUNCTION | Step to the Next or Previous Increment in a Sorted List
    // ------------------------------------------------------------
    // direction > 0 steps up, otherwise down. Stops at the ends rather than
    // wrapping: going past 500 to land on 10 would be a surprise mid-task.
    // ------------------------------------------------------------
    function Na__PlaneMath__StepInList(list, current, direction) {
        if (!Array.isArray(list) || list.length === 0) return current;
        const at   = list.indexOf(Na__PlaneMath__NearestInList(list, current));
        const next = Math.min(list.length - 1, Math.max(0, at + (direction > 0 ? 1 : -1)));
        return list[next];
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Drag Solve
// -----------------------------------------------------------------------------

    // FUNCTION | Where Along an Axis Is the Point Closest to a Ray
    // ------------------------------------------------------------
    // axisDir and rayDir must be unit length. Returns
    //   { param, alignment }
    // param is the distance along the axis from axisOrigin; alignment is
    // |axisDir . rayDir|, 0 when the axis lies across the view (the best case)
    // and 1 when it points straight at the camera (no answer at all). Null
    // when the two are parallel.
    // ------------------------------------------------------------
    function Na__PlaneMath__ClosestParamOnAxis(axisOrigin, axisDir, rayOrigin, rayDir) {
        const wx = axisOrigin.x - rayOrigin.x;
        const wy = axisOrigin.y - rayOrigin.y;
        const wz = axisOrigin.z - rayOrigin.z;

        const b  = (axisDir.x * rayDir.x) + (axisDir.y * rayDir.y) + (axisDir.z * rayDir.z);
        const dw = (axisDir.x * wx) + (axisDir.y * wy) + (axisDir.z * wz);
        const ew = (rayDir.x * wx)  + (rayDir.y * wy)  + (rayDir.z * wz);

        const denom = 1 - (b * b);                                               // <-- Both directions are unit length
        if (Math.abs(denom) < Na__PlaneMath__PARALLEL_EPSILON) return null;

        return { param : ((b * ew) - dw) / denom, alignment : Math.abs(b) };
    }
    // ------------------------------------------------------------


    // FUNCTION | Is an Axis Too Nearly in Line With the View to Be Dragged
    // ------------------------------------------------------------
    // alignment is the value ClosestParamOnAxis reports. Inside minAngleDeg of
    // the view direction a pixel of pointer travel becomes metres of plane.
    // ------------------------------------------------------------
    function Na__PlaneMath__IsAxisTooSteep(alignment, minAngleDeg) {
        if (!Number.isFinite(alignment)) return true;
        const limit = Math.cos((Number.isFinite(minAngleDeg) ? minAngleDeg : 0) * (Math.PI / 180));
        return alignment > limit;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Plane's Own 2D Frame
// -----------------------------------------------------------------------------

    // FUNCTION | The Frame's Normal, Pointing at the Viewer
    // ------------------------------------------------------------
    function Na__PlaneMath__FrameNormal(frame) {
        const u = frame.u, v = frame.v;
        return {
            x : (u.y * v.z) - (u.z * v.y),
            y : (u.z * v.x) - (u.x * v.z),
            z : (u.x * v.y) - (u.y * v.x)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Turn a Ray Into Frame Coordinates
    // ------------------------------------------------------------
    // frame: { origin, u, v, width, height } with u and v unit length.
    // Returns { x, y, distance, inside } where the ray meets the frame's plane
    // in FRONT of the ray origin, or null. x and y are measured from the
    // bottom-left corner along u and v; inside says whether that is on the
    // plane's rectangle.
    // ------------------------------------------------------------
    function Na__PlaneMath__RayToFrame(frame, rayOrigin, rayDir) {
        const n     = Na__PlaneMath__FrameNormal(frame);
        const denom = (n.x * rayDir.x) + (n.y * rayDir.y) + (n.z * rayDir.z);
        if (Math.abs(denom) < Na__PlaneMath__PARALLEL_EPSILON) return null;      // <-- Edge on: the ray never meets the plane

        const ox = frame.origin.x - rayOrigin.x;
        const oy = frame.origin.y - rayOrigin.y;
        const oz = frame.origin.z - rayOrigin.z;
        const distance = ((n.x * ox) + (n.y * oy) + (n.z * oz)) / denom;
        if (!(distance > 0)) return null;                                        // <-- Behind the camera

        const px = (rayOrigin.x + (rayDir.x * distance)) - frame.origin.x;
        const py = (rayOrigin.y + (rayDir.y * distance)) - frame.origin.y;
        const pz = (rayOrigin.z + (rayDir.z * distance)) - frame.origin.z;
        const x  = (px * frame.u.x) + (py * frame.u.y) + (pz * frame.u.z);
        const y  = (px * frame.v.x) + (py * frame.v.y) + (pz * frame.v.z);

        return {
            x        : x,
            y        : y,
            distance : distance,
            inside   : (x >= 0 && x <= frame.width && y >= 0 && y <= frame.height)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Which Named Rectangle of a Frame Holds a Point
    // ------------------------------------------------------------
    // regions: [{ name, x0, y0, x1, y1 }] in frame coordinates. The first one
    // holding the point wins, so the caller lists the small ones first.
    // ------------------------------------------------------------
    function Na__PlaneMath__RegionAt(regions, x, y) {
        if (!Array.isArray(regions)) return null;
        for (let i = 0; i < regions.length; i++) {
            const r = regions[i];
            if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) return r.name;
        }
        return null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Ground Under a Vertical Plane
// -----------------------------------------------------------------------------

    // FUNCTION | The Highest Point Where a Vertical Plane Meets the Ground
    // ------------------------------------------------------------
    // ground is a flat array of world-space triangles, nine numbers each
    // (ax ay az bx by bz cx cy cz). The plane is x*normalX + z*normalZ =
    // distance. Only the part of it whose RUN - the distance along
    // rightX/rightZ - lies inside runMin..runMax is considered, so ground
    // rising thirty metres away cannot lift a plane that never reaches it.
    // Any one unit throughout. Null when the plane meets no ground there.
    //
    // Exact rather than sampled: each triangle is cut by the plane and the
    // crossing is clipped to the span, so a level slab and a sloping terrain
    // are the same code and a step in a patio is found whatever its width.
    // ------------------------------------------------------------
    function Na__PlaneMath__GroundLevel(ground, normalX, normalZ, distance, rightX, rightZ, runMin, runMax) {
        if (!ground || ground.length < 9) return null;

        let highest = null;
        const d  = [0, 0, 0];                                                    // <-- Allocated once, not per triangle
        const px = [0, 0], py = [0, 0], pz = [0, 0];

        for (let t = 0; t + 8 < ground.length; t += 9) {
            d[0] = (ground[t]     * normalX) + (ground[t + 2] * normalZ) - distance;
            d[1] = (ground[t + 3] * normalX) + (ground[t + 5] * normalZ) - distance;
            d[2] = (ground[t + 6] * normalX) + (ground[t + 8] * normalZ) - distance;

            if ((d[0] > 0 && d[1] > 0 && d[2] > 0) || (d[0] < 0 && d[1] < 0 && d[2] < 0)) continue;   // <-- Wholly on one side
            if (d[0] === 0 && d[1] === 0 && d[2] === 0) continue;                                      // <-- Lying IN the plane: no line to read

            // Where the triangle's edges cross the plane. A vertex on the
            // plane is a crossing of both its edges; the second copy is dropped.
            let found = 0;
            for (let e = 0; e < 3 && found < 2; e++) {
                const i0 = e, i1 = (e + 1) % 3;
                const d0 = d[i0], d1 = d[i1];
                if ((d0 > 0 && d1 > 0) || (d0 < 0 && d1 < 0)) continue;
                if (d0 === 0 && d1 === 0) continue;                              // <-- An edge lying in the plane: its ends arrive by the other edges

                const s  = d0 / (d0 - d1);
                const o0 = t + (i0 * 3), o1 = t + (i1 * 3);
                const x  = ground[o0]     + ((ground[o1]     - ground[o0])     * s);
                const y  = ground[o0 + 1] + ((ground[o1 + 1] - ground[o0 + 1]) * s);
                const z  = ground[o0 + 2] + ((ground[o1 + 2] - ground[o0 + 2]) * s);
                if (found === 1 && x === px[0] && y === py[0] && z === pz[0]) continue;
                px[found] = x; py[found] = y; pz[found] = z;
                found++;
            }
            if (found === 0) continue;
            if (found === 1) { px[1] = px[0]; py[1] = py[0]; pz[1] = pz[0]; }

            // Clip the crossing to the plane's own span along its run.
            const r0 = (px[0] * rightX) + (pz[0] * rightZ);
            const r1 = (px[1] * rightX) + (pz[1] * rightZ);
            if (Math.max(r0, r1) < runMin || Math.min(r0, r1) > runMax) continue;

            let y0 = py[0], y1 = py[1];
            if (r0 !== r1) {
                const slope = (py[1] - py[0]) / (r1 - r0);
                if (r0 < runMin) y0 = py[0] + (slope * (runMin - r0)); else if (r0 > runMax) y0 = py[0] + (slope * (runMax - r0));
                if (r1 < runMin) y1 = py[0] + (slope * (runMin - r0)); else if (r1 > runMax) y1 = py[0] + (slope * (runMax - r0));
            }

            const top = Math.max(y0, y1);
            if (highest === null || top > highest) highest = top;
        }
        return highest;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Two Record Solves
// -----------------------------------------------------------------------------

    // FUNCTION | Slide an Elevation's Plane Origin Along Its Normal to a Distance
    // ------------------------------------------------------------
    // An elevation stores a world X/Z point its plane passes through; its
    // position along the normal is origin . normal. To put the plane at
    // targetDistanceMm the point moves along the normal by the difference and
    // not at all across it, so the numbers the two sliders show change by the
    // least that moves the plane. Returned unrounded - the data layer rounds.
    // ------------------------------------------------------------
    function Na__PlaneMath__MoveOriginToDistance(originXMm, originZMm, normalX, normalZ, targetDistanceMm) {
        const current = (originXMm * normalX) + (originZMm * normalZ);
        const shift   = targetDistanceMm - current;
        return {
            xMm : originXMm + (normalX * shift),
            zMm : originZMm + (normalZ * shift)
        };
    }
    // ------------------------------------------------------------


    // FUNCTION | Put a Floor Plan's Cut at a Height
    // ------------------------------------------------------------
    // The cut is floor level + cut above floor. Moving the plane changes the
    // CUT ABOVE FLOOR and leaves the floor level where the author set it. Only
    // when that would take the cut under its minimum is the floor level
    // carried down with it, so the plane always goes where it was put.
    // ------------------------------------------------------------
    function Na__PlaneMath__SolvePlanCut(datumMm, targetCutMm, minOffsetMm) {
        const floor = Number.isFinite(datumMm) ? datumMm : 0;
        const least = (Number.isFinite(minOffsetMm) && minOffsetMm > 0) ? minOffsetMm : 0;

        const offset = targetCutMm - floor;
        if (offset >= least) return { datumMm : floor, offsetMm : offset };
        return { datumMm : targetCutMm - least, offsetMm : least };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Planes Maths API
    // ------------------------------------------------------------
    export {
        Na__PlaneMath__ToIncrement,
        Na__PlaneMath__ApplySnap,
        Na__PlaneMath__FormatMm,
        Na__PlaneMath__NearestInList,
        Na__PlaneMath__StepInList,
        Na__PlaneMath__ClosestParamOnAxis,
        Na__PlaneMath__IsAxisTooSteep,
        Na__PlaneMath__FrameNormal,
        Na__PlaneMath__RayToFrame,
        Na__PlaneMath__RegionAt,
        Na__PlaneMath__GroundLevel,
        Na__PlaneMath__MoveOriginToDistance,
        Na__PlaneMath__SolvePlanCut
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
