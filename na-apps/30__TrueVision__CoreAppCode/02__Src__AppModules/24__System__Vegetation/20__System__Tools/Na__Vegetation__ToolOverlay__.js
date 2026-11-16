// =============================================================================
// TRUEVISION3D - VEGETATION - THE TOOLS' DRAWING LAYER
// =============================================================================
//
// FILE       : Na__Vegetation__ToolOverlay__.js
// NAMESPACE  : Na__VegOverlay
// MODULE     : System - Vegetation
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw what a tool needs on top of the model: paths, grips, the brush ring,
//              plants being painted, and the selected plant
// CREATED    : 04-Nov-2026
//
// DESCRIPTION:
// - A 2D CANVAS OVER THE MODEL, NOT OBJECTS IN THE SCENE. The plan first said overlays in
//   the scene, registered so no export prints them. This goes one better: it is not in the
//   WebGL canvas at all, so no export, thumbnail, video or sheet can ever pick it up, no
//   profile pass can outline it, and neither engine has to know. Drawing it costs no
//   render of the model, which is what keeps a brush stroke smooth.
// - ALWAYS ON TOP, as a CAD aid is. A grip behind a wall can still be taken.
// - IT LOOKS AFTER ITS OWN FRAMES. Only while a tool wants it: a frame is skipped unless
//   the camera moved or the tool said something changed, and it stops when the tool does.
//
// FRAMES:
// - Takes world metres, and works out pixels itself with the camera's own matrices. A
//   segment crossing the camera's near plane is cut there, so a path running behind the
//   viewer never streaks across the screen.
//
// INTEGRATION:
// - Used by ./Na__Vegetation__ToolHost__.js.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 24__System__Vegetation/20__System__Tools/Na__Vegetation__ToolOverlay__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : none in behaviour. Entourage is 28__System__Entourage in TrueVision (its 23
//                   is Scene Sync); the vegetation and entourage READMEs list what differs around it.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 05-Nov-2026 - Version 1.2.0 (ValeVision3D v2.88.0)
// - A filled shape, a filled ring and a dot on the pen, for the ring under a figure. Nothing the plants draw changed.
//
// 04-Nov-2026 - Version 1.1.0 (ValeVision3D v2.86.0)
// - A box for a plant whose asset asks for one: a hedge.
//
// 04-Nov-2026 - Version 1.0.0 (ValeVision3D v2.85.0)
// - Initial build: Stage 5 of ValeVision__PLAN__VegetationSystem__.md.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants and Variables
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Look
    // ------------------------------------------------------------
    const Na__VegOverlay__LINE       = '#2f7d4f';
    const Na__VegOverlay__LINE_SOFT  = 'rgba(47, 125, 79, 0.55)';
    const Na__VegOverlay__GRIP_FILL  = '#ffffff';
    const Na__VegOverlay__PROXY_FILL = 'rgba(214, 228, 205, 0.55)';
    const Na__VegOverlay__PROXY_LINE = 'rgba(95, 122, 102, 0.95)';
    const Na__VegOverlay__SELECTED   = '#172b3a';
    const Na__VegOverlay__ERASE      = '#a3322a';
    const Na__VegOverlay__RING_STEPS = 48;
    const Na__VegOverlay__NEAR_M     = 0.05;
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Canvas and Its Loop
    // ------------------------------------------------------------
    const Na__VegOverlay__State = {
        context  : null,
        canvas   : null,
        ctx      : null,
        painter  : null,
        frame    : 0,
        wants    : true,
        signature: new Float64Array(16),
        widthPx  : 0,
        heightPx : 0
    };
    const Na__VegOverlay__V = new THREE.Vector3();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Canvas
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Lay the Layer Exactly Over the Model's Canvas
    // ------------------------------------------------------------
    function Na__VegOverlay__Fit() {
        const state = Na__VegOverlay__State;
        const model = state.context.renderer.domElement;
        const rect  = model.getBoundingClientRect();
        const dpr   = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.round(rect.width * dpr), h = Math.round(rect.height * dpr);
        state.canvas.style.left   = model.offsetLeft + 'px';
        state.canvas.style.top    = model.offsetTop + 'px';
        state.canvas.style.width  = rect.width + 'px';
        state.canvas.style.height = rect.height + 'px';
        if (state.canvas.width !== w || state.canvas.height !== h) {
            state.canvas.width  = w;
            state.canvas.height = h;
            state.wants = true;
        }
        state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        state.widthPx  = rect.width;
        state.heightPx = rect.height;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Has the Camera Moved Since the Last Drawing?
    // ------------------------------------------------------------
    function Na__VegOverlay__CameraMoved() {
        const state = Na__VegOverlay__State;
        const camera = state.context.camera;
        camera.updateMatrixWorld();
        const e = camera.matrixWorld.elements;
        let moved = false;
        for (let k = 0; k < 16; k++) {
            if (state.signature[k] !== e[k]) { state.signature[k] = e[k]; moved = true; }
        }
        return moved;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Frame, If There Is Anything New to Draw
    // ------------------------------------------------------------
    function Na__VegOverlay__Tick() {
        const state = Na__VegOverlay__State;
        if (!state.painter) { state.frame = 0; return; }
        state.frame = requestAnimationFrame(Na__VegOverlay__Tick);
        Na__VegOverlay__Fit();
        if (!Na__VegOverlay__CameraMoved() && !state.wants) return;
        state.wants = false;
        state.ctx.clearRect(0, 0, state.widthPx, state.heightPx);
        state.painter(Na__VegOverlay__Pen);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing in the World
// -----------------------------------------------------------------------------

    // FUNCTION | A World Point on the Screen, in Css Pixels, or Null If Behind the Camera
    // ------------------------------------------------------------
    function Na__VegOverlay__ToScreen(x, y, z) {
        const state = Na__VegOverlay__State;
        const camera = state.context.camera;
        Na__VegOverlay__V.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
        if (!camera.isOrthographicCamera && Na__VegOverlay__V.z > -Na__VegOverlay__NEAR_M) return null;
        Na__VegOverlay__V.applyMatrix4(camera.projectionMatrix);
        return { x : (Na__VegOverlay__V.x * 0.5 + 0.5) * state.widthPx, y : (-Na__VegOverlay__V.y * 0.5 + 0.5) * state.heightPx };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Segment on the Screen, Cut at the Near Plane, or Null
    // ------------------------------------------------------------
    function Na__VegOverlay__Segment(a, b) {
        const state  = Na__VegOverlay__State;
        const camera = state.context.camera;
        const va = new THREE.Vector3(a[0], a[1], a[2]).applyMatrix4(camera.matrixWorldInverse);
        const vb = new THREE.Vector3(b[0], b[1], b[2]).applyMatrix4(camera.matrixWorldInverse);
        const limit = -Na__VegOverlay__NEAR_M;
        if (va.z > limit && vb.z > limit) return null;
        if (va.z > limit) va.lerp(vb, (limit - va.z) / (vb.z - va.z));
        else if (vb.z > limit) vb.lerp(va, (limit - vb.z) / (va.z - vb.z));
        va.applyMatrix4(camera.projectionMatrix);
        vb.applyMatrix4(camera.projectionMatrix);
        return {
            ax : (va.x * 0.5 + 0.5) * state.widthPx, ay : (-va.y * 0.5 + 0.5) * state.heightPx,
            bx : (vb.x * 0.5 + 0.5) * state.widthPx, by : (-vb.y * 0.5 + 0.5) * state.heightPx
        };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Line Through World Points
    // ------------------------------------------------------------
    function Na__VegOverlay__Polyline(points, style) {
        const ctx = Na__VegOverlay__State.ctx;
        ctx.strokeStyle = style.colour || Na__VegOverlay__LINE;
        ctx.lineWidth   = style.width || 2;
        ctx.setLineDash(style.dash || []);
        ctx.beginPath();
        for (let i = 1; i < points.length; i++) {
            const s = Na__VegOverlay__Segment(points[i - 1], points[i]);
            if (!s) continue;
            ctx.moveTo(s.ax, s.ay);
            ctx.lineTo(s.bx, s.by);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Grip at a World Point
    // ------------------------------------------------------------
    function Na__VegOverlay__Grip(point, radiusPx, hot) {
        const screen = Na__VegOverlay__ToScreen(point[0], point[1], point[2]);
        if (!screen) return;
        const ctx = Na__VegOverlay__State.ctx;
        ctx.fillStyle   = hot ? Na__VegOverlay__LINE : Na__VegOverlay__GRIP_FILL;
        ctx.strokeStyle = Na__VegOverlay__LINE;
        ctx.lineWidth   = 2;
        ctx.beginPath();
        ctx.rect(screen.x - radiusPx, screen.y - radiusPx, radiusPx * 2, radiusPx * 2);
        ctx.fill();
        ctx.stroke();
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Ring Lying Level Round a World Point
    // ------------------------------------------------------------
    function Na__VegOverlay__Ring(x, y, z, radiusM, style) {
        const points = [];
        for (let k = 0; k <= Na__VegOverlay__RING_STEPS; k++) {
            const angle = (k / Na__VegOverlay__RING_STEPS) * Math.PI * 2;
            points.push([x + Math.cos(angle) * radiusM, y, z + Math.sin(angle) * radiusM]);
        }
        Na__VegOverlay__Polyline(points, style);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Plant's Proxy, from Its Saved Record in Mm
    // ------------------------------------------------------------
    // The same dome the scene's proxies use, drawn as rings, or its box for a hedge. colour:
    // an outline in place of the sage, for what is selected or about to go.
    // ------------------------------------------------------------
    function Na__VegOverlay__Dome(positionMm, sizeMm, yawDeg, colour, shape) {
        const ctx = Na__VegOverlay__State.ctx;
        const x = positionMm[0] / 1000, y = positionMm[1] / 1000, z = positionMm[2] / 1000;
        const a = sizeMm[0] / 2000, b = sizeMm[1] / 2000, h = sizeMm[2] / 1000;
        const yaw = ((yawDeg || 0) * Math.PI) / 180;
        const c = Math.cos(yaw), s = Math.sin(yaw);
        const at = (px, py, pz) => [x + px * c + pz * s, y + py, z - px * s + pz * c];   // <-- Yaw about +Y carries local x to (cos, 0, -sin)

        if (shape === 'Box') {
            const foot = [at(-a, 0, -b), at(a, 0, -b), at(a, 0, b), at(-a, 0, b), at(-a, 0, -b)];
            const head = [at(-a, h, -b), at(a, h, -b), at(a, h, b), at(-a, h, b), at(-a, h, -b)];
            const style = { colour : colour || Na__VegOverlay__PROXY_LINE, width : colour ? 1.6 : 1 };
            Na__VegOverlay__Polyline(foot, style);
            Na__VegOverlay__Polyline(head, style);
            for (let k = 0; k < 4; k++) Na__VegOverlay__Polyline([foot[k], head[k]], style);
            return;
        }

        const rings = [];
        for (let r = 0; r <= 3; r++) {
            const lat = (r / 3) * (Math.PI / 2) * 0.92;
            const ring = [];
            for (let k = 0; k <= 16; k++) {
                const angle = (k / 16) * Math.PI * 2;
                ring.push(at(Math.cos(angle) * a * Math.cos(lat), h * Math.sin(lat), Math.sin(angle) * b * Math.cos(lat)));
            }
            rings.push(ring);
        }

        // THE SILHOUETTE, ROUGHLY | The base ring's bounds up to the top, filled pale
        const top = Na__VegOverlay__ToScreen(...at(0, h, 0));
        const screens = rings[0].map((p) => Na__VegOverlay__ToScreen(p[0], p[1], p[2])).filter(Boolean);
        if (top && screens.length > 8) {
            ctx.fillStyle = Na__VegOverlay__PROXY_FILL;
            ctx.beginPath();
            screens.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
            ctx.closePath();
            ctx.fill();
            let left = screens[0], right = screens[0];
            screens.forEach((p) => { if (p.x < left.x) left = p; if (p.x > right.x) right = p; });
            ctx.beginPath();
            ctx.moveTo(left.x, left.y);
            ctx.quadraticCurveTo(left.x, top.y, top.x, top.y);
            ctx.quadraticCurveTo(right.x, top.y, right.x, right.y);
            ctx.closePath();
            ctx.fill();
        }
        rings.forEach((ring) => Na__VegOverlay__Polyline(ring, { colour : colour || Na__VegOverlay__PROXY_LINE, width : colour ? 1.6 : 1 }));
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Closed Shape Through World Points, Filled and Outlined
    // ------------------------------------------------------------
    // style: { fill, colour, width, dash }. One point behind the camera and it is not drawn:
    // this is for what stands in front of whoever is working.
    // ------------------------------------------------------------
    function Na__VegOverlay__Polygon(points, style) {
        const ctx = Na__VegOverlay__State.ctx;
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
            const screen = Na__VegOverlay__ToScreen(points[i][0], points[i][1], points[i][2]);
            if (!screen) return;
            if (i === 0) ctx.moveTo(screen.x, screen.y);
            else ctx.lineTo(screen.x, screen.y);
        }
        ctx.closePath();
        if (style.fill) {
            ctx.fillStyle = style.fill;
            ctx.fill();
        }
        if (style.colour) {
            ctx.strokeStyle = style.colour;
            ctx.lineWidth   = style.width || 1;
            ctx.setLineDash(style.dash || []);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Ring Lying Level Round a World Point, Filled
    // ------------------------------------------------------------
    function Na__VegOverlay__Disc(x, y, z, radiusM, style) {
        const points = [];
        for (let k = 0; k < Na__VegOverlay__RING_STEPS; k++) {
            const angle = (k / Na__VegOverlay__RING_STEPS) * Math.PI * 2;
            points.push([x + Math.cos(angle) * radiusM, y, z + Math.sin(angle) * radiusM]);
        }
        Na__VegOverlay__Polygon(points, style);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | A Dot at a World Point, Its Radius in Pixels
    // ------------------------------------------------------------
    function Na__VegOverlay__Dot(point, radiusPx, colour) {
        const screen = Na__VegOverlay__ToScreen(point[0], point[1], point[2]);
        if (!screen) return;
        const ctx = Na__VegOverlay__State.ctx;
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, radiusPx, 0, Math.PI * 2);
        ctx.fill();
    }
    // ------------------------------------------------------------


    // MODULE CONSTANTS | What a Tool's Painter Is Handed
    // ------------------------------------------------------------
    const Na__VegOverlay__Pen = {
        polyline : Na__VegOverlay__Polyline,
        polygon  : Na__VegOverlay__Polygon,
        grip     : Na__VegOverlay__Grip,
        ring     : Na__VegOverlay__Ring,
        disc     : Na__VegOverlay__Disc,
        dot      : Na__VegOverlay__Dot,
        dome     : Na__VegOverlay__Dome,
        toScreen : Na__VegOverlay__ToScreen,
        LINE       : Na__VegOverlay__LINE,
        LINE_SOFT  : Na__VegOverlay__LINE_SOFT,
        SELECTED   : Na__VegOverlay__SELECTED,
        ERASE      : Na__VegOverlay__ERASE
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Put the Layer on the Page, Once
    // ------------------------------------------------------------
    function Na__VegOverlay__Mount(context) {
        const state = Na__VegOverlay__State;
        state.context = context;
        if (state.canvas) return;
        const model = context.renderer.domElement;
        const canvas = document.createElement('canvas');
        canvas.className = 'na-veg-overlay';
        const zIndex = window.getComputedStyle(model).zIndex;
        if (zIndex && zIndex !== 'auto') canvas.style.zIndex = zIndex;         // <-- Later in the page at the same level: on top of the model, under every panel
        model.insertAdjacentElement('afterend', canvas);
        state.canvas = canvas;
        state.ctx    = canvas.getContext('2d');
    }
    // ------------------------------------------------------------


    // FUNCTION | Give the Layer Something to Draw, or Null to Stop
    // ------------------------------------------------------------
    function Na__VegOverlay__SetPainter(painter) {
        const state = Na__VegOverlay__State;
        state.painter = painter;
        state.wants   = true;
        if (painter && !state.frame) {
            state.frame = requestAnimationFrame(Na__VegOverlay__Tick);
        }
        if (!painter && state.canvas) {
            state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Something Changed: Draw Again at the Next Frame
    // ------------------------------------------------------------
    function Na__VegOverlay__Invalidate() {
        Na__VegOverlay__State.wants = true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Tool Overlay API
    // ------------------------------------------------------------
    export {
        Na__VegOverlay__Mount,
        Na__VegOverlay__SetPainter,
        Na__VegOverlay__Invalidate,
        Na__VegOverlay__ToScreen
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
