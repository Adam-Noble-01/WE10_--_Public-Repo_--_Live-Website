// =============================================================================
// TRUEVISION3D - ENTOURAGE - SCENE LAYER
// =============================================================================
//
// FILE       : Na__Entourage__SceneLayer__.js
// NAMESPACE  : Na__EntLayer
// MODULE     : System - Entourage
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Hold the figures in the scene, turned to whichever camera is about to
//              render, as lines and a fill drawn the way the plants' are
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - THE CAMERA FOLLOW, DONE FOR EVERY RENDER. Adam's old billboards (25__System__3dObject__
//   InteractionSystem, CameraFollowBillboards) turn GLB nodes about +Y once a frame. A figure
//   here has no node: its flat lines are written into shared buffers in world space, turned
//   so its front faces the eye. An orthographic camera has no eye, so it faces the view.
// - THREE DRAW CALLS, HOWEVER MANY FIGURES: outlines, inner lines, fill. A figure is a few
//   hundred segments, so writing them all afresh when the eye moves costs far less than a
//   millisecond for dozens of figures, and needs none of the plants' slots or budgets.
// - WORLD SPACE KEEPS THE ONE FILL NORMAL THAT POINTS AT THE EYE. The profile lines run a
//   Sobel over a normal buffer, and that normal encodes to the buffer's clear colour, so
//   nothing is outlined round a figure against the sky. See Na__Vegetation__SceneLayer__.js.
// - EVERYTHING THE PLANTS DO FOR A LOOK, THIS DOES ALIKE, on purpose, so they sit together:
//   LineSegments2 under a group tagged linework, so export line weights reach them; the log
//   depth bias; a fill unlit but toned from the scene's lights to the walls' brightness (T31);
//   a fill that fades as one sheet (two passes from one geometry); AO's alpha mark under
//   MaxEngine; section cuts. Copied rather than imported, so a project with people and no
//   plants never fetches a plant engine. A change to the walls' sums belongs in both.
// - NOT THROUGH A DRAWING, UNLESS ASKED, as the plants. An orthographic camera sees no figures
//   by default, a project can ask for them on its live drawings, and a sheet's viewport ticks
//   them and gets renderDrawingLayer. Looking nearly straight down, as a plan does, a flat
//   figure is edge on, so it never draws there.
// - HIDING. A fat line is never hidden with .visible: the profile pass forces it back on (rule
//   10). Counts are emptied instead, and the root group's .visible stops the whole walk.
// - IN FRONT OF FOG, AS THE PLANTS. The root carries userData.Na__FogPlane__IsOwnLayer, so the
//   fog pass draws the figures alone and fogs them by their own distance: the depth it reads
//   otherwise has no lines, and from the see-through share no fill, so a figure at the
//   default 60% against the sky beyond a fog plane was painted out (v2.98.1).
//   @delegate: ../../29__System__FogPlaneSystem/Na__FogPlaneSystem__OwnLayers__.js
//
// FRAMES:
// - The builder's lines are metres in the figure's own plane, x across, y up. Saved positions
//   are integer mm in three.js axes. Turned by yaw about +Y, a local x runs along
//   (cos yaw, 0, -sin yaw), and the front, local +z, along (sin yaw, 0, cos yaw).
//
// INTEGRATION:
// - Driven by ./Na__Entourage__Runtime__.js. options.host carries everything it needs from the
//   app, so it imports nothing of the app's: getExportScale is not needed, as a figure's lines
//   do not depend on the picture's size. addRenderHook, getClipList, isAoRunning,
//   liveDrawingsWantFigures, requestFrame.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 23__System__Entourage/03__System__SceneLayer/Na__Entourage__SceneLayer__.js (ValeVision3D v2.98.6)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header, console prefix and the Entourage folder's number apart)
// - Divergences   : The render hook hands host.isAoRunning the camera it draws for, so a
//                   host can say AO is not running for a drawing's camera (TrueVision draws
//                   drawings flat, outside the composer, with its AO pass still flagged on).
//                   ValeVision's hosts take no argument, so it can go back unchanged in
//                   behaviour. Entourage is 28__System__Entourage in TrueVision (its 23 is
//                   Scene Sync).
// - Back-port     : candidate (the camera argument).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - TrueVision3D v2.185.0
// - isAoRunning is asked with the camera being drawn for.
//
// 12-Nov-2026 - Version 1.1.1 (ValeVision3D v2.98.1)
// - The root is marked for the fog to draw alone and fog by its own distance.
//
// 11-Nov-2026 - Version 1.1.0 (ValeVision3D v2.95.0)
// - A figure's height is multiplied by its stretch (Jamesification) as well as its scale, drawn and picked.
//
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
// - Initial build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
    import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
    import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Builder
    // ------------------------------------------------------------
    import {
        Na__EntBuild__BuildFigure,
        Na__EntBuild__Inside,
        Na__EntBuild__RulesFrom
    } from '../01__Core__Engine/Na__Entourage__FigureBuilder__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Buffer Sizes
    // ------------------------------------------------------------
    const Na__EntLayer__START_OUTER = 6000;                                    // <-- Segments of 6 floats. The shared buffers start here and grow
    const Na__EntLayer__START_INNER = 2000;
    const Na__EntLayer__START_FILL  = 12000;                                   // <-- Vertices of 3 floats
    const Na__EntLayer__GROWTH      = 1.6;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Draw Order When Transparent (after the opaque model, before the lines)
    // ------------------------------------------------------------
    const Na__EntLayer__FILL_DEPTH_ORDER  = 900;
    const Na__EntLayer__FILL_COLOUR_ORDER = 901;
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Looking This Steeply Down Is a Plan: a Flat Figure Is Edge On
    // ------------------------------------------------------------
    const Na__EntLayer__PLAN_LOOK = 0.92;                                      // <-- The camera's +Z, up: about 23 degrees off straight down
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Materials
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | A Number as GLSL Wants It
    // ------------------------------------------------------------
    function Na__EntLayer__GlslFloat(value) {
        const text = String(value);
        return (text.indexOf('.') >= 0 || text.indexOf('e') >= 0) ? text : text + '.0';
    }
    // ------------------------------------------------------------


    // FUNCTION | Make a Fat Line Material with the Loader's Depth Bias
    // ------------------------------------------------------------
    // @delegate: ../../15__ModelLoader/Na__ModelLoader__MultiModel.js
    // The patch UpgradeLineworkRoot makes, as the plants' lines have it: a share of log depth
    // through a perspective camera, a distance through an orthographic one.
    // ------------------------------------------------------------
    function Na__EntLayer__MakeLineMaterial(colour, widthPx, depthBias, orthoBiasMm, resolution) {
        const material = new LineMaterial({
            color               : colour,
            linewidth           : widthPx,
            resolution          : resolution,
            worldUnits          : false,
            depthTest           : true,
            depthWrite          : true,
            polygonOffset       : true,
            polygonOffsetFactor : -4,
            polygonOffsetUnits  : -4
        });
        let bias = Na__EntLayer__GlslFloat(depthBias);
        const orthoB = Na__EntLayer__GlslFloat(orthoBiasMm / 1000);
        material.onBeforeCompile = (shader) => {
            shader.vertexShader = shader.vertexShader
                .replace('#include <logdepthbuf_pars_vertex>', `#include <logdepthbuf_pars_vertex>
                varying float vNaOrthoDepthPerUnit;`)
                .replace('#include <logdepthbuf_vertex>', `#include <logdepthbuf_vertex>
                vNaOrthoDepthPerUnit = abs( projectionMatrix[ 2 ][ 2 ] ) * 0.5;`);
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <logdepthbuf_pars_fragment>', `#include <logdepthbuf_pars_fragment>
                varying float vNaOrthoDepthPerUnit;`)
                .replace('#include <logdepthbuf_fragment>', `#include <logdepthbuf_fragment>
                #ifdef USE_LOGARITHMIC_DEPTH_BUFFER
                if (gl_FragDepth > 0.0) {
                    gl_FragDepth -= (vIsPerspective == 0.0) ? (${orthoB} * vNaOrthoDepthPerUnit) : ${bias};
                }
                #endif`);
        };
        material.customProgramCacheKey = () => 'naEntLineBias' + bias + orthoB;
        material.naEntSetDepthBias = (value) => {                              // <-- The bias is compiled in, so a new one means a new program
            bias = Na__EntLayer__GlslFloat(value);
            material.needsUpdate = true;
        };
        return material;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | The Layer
// -----------------------------------------------------------------------------

    // FUNCTION | Create the Layer
    // ------------------------------------------------------------
    // options: { scene, lineRules, lineColour, wallColour, resolution, seeThroughPercent, host }
    // ------------------------------------------------------------
    function Na__EntLayer__Create(options) {
        const scene = options.scene;
        const host  = options.host || {};

        let rules    = options.lineRules;
        let builder  = Na__EntBuild__RulesFrom(rules);
        const advanced = rules.Entourage__LineRules__Advanced;
        const weightPx = rules.Entourage__LineRules__LineWeightPx;
        const biasLog  = advanced.Entourage__LineRulesAdvanced__DepthBias;
        const tone     = advanced.Entourage__LineRulesAdvanced__FillTone;

        // THE TREE | Only the lines sit under the linework tag: the profile pass must keep
        // the fill among its meshes, and it leaves anything tagged linework out of them.
        const root = new THREE.Group();
        root.name = 'Na__Entourage__Root';
        root.userData.Na__FogPlane__IsOwnLayer = true;                         // <-- The fog draws the figures alone, by their own distance (see the header)
        const lineGroup = new THREE.Group();
        lineGroup.name = 'Na__Entourage__Lines';
        lineGroup.userData.Na__ModelType = 'linework';                         // <-- Export line weights reach what is under this tag (T14)
        root.add(lineGroup);

        // THE LINES
        const outerMaterial = Na__EntLayer__MakeLineMaterial(options.lineColour, weightPx, biasLog, 2, options.resolution);
        const innerMaterial = Na__EntLayer__MakeLineMaterial(options.lineColour, weightPx * rules.Entourage__LineRules__InnerWeightShare, biasLog, 2, options.resolution);
        innerMaterial.userData.Na__LineworkSettings__OverrideShare = rules.Entourage__LineRules__InnerWeightShare;   // <-- A sheet's own edge width keeps inner lines lighter than outlines

        // SUB FUNCTION | A Fat Line Object over a Buffer That Can Grow
        // ------------------------------------------------------------
        // A GPU buffer cannot be resized, and three caches a geometry's instance limit, so
        // growing means a new buffer and a new geometry over it.
        // ------------------------------------------------------------
        function makeLine(startItems, material, name) {
            const line = new LineSegments2(new LineSegmentsGeometry(), material);
            line.name          = name;
            line.frustumCulled = false;                                        // <-- The bounds change with every view
            line.renderOrder   = 999;
            line.raycast       = () => {};                                     // <-- No pick of the model's stops on a figure
            const entry = { line, cap : 0, array : null, buffer : null };
            entry.grow = (items) => {
                const cap = Math.max(items, Math.ceil(entry.cap * Na__EntLayer__GROWTH), startItems);
                entry.cap   = cap;
                entry.array = new Float32Array(cap * 6);
                const previous = line.geometry;
                const buffer   = new THREE.InstancedInterleavedBuffer(entry.array, 6, 1);
                buffer.setUsage(THREE.DynamicDrawUsage);
                const geometry = new LineSegmentsGeometry();
                geometry.setAttribute('instanceStart', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
                geometry.setAttribute('instanceEnd', new THREE.InterleavedBufferAttribute(buffer, 3, 3));
                geometry.instanceCount = 0;
                line.geometry = geometry;
                entry.buffer  = buffer;
                previous.dispose();
            };
            entry.grow(startItems);
            lineGroup.add(line);
            return entry;
        }
        // ------------------------------------------------------------

        const outerLine = makeLine(Na__EntLayer__START_OUTER, outerMaterial, 'Na__Entourage__OuterLines');
        const innerLine = makeLine(Na__EntLayer__START_INNER, innerMaterial, 'Na__Entourage__InnerLines');

        // THE FILL | Unlit, and its one colour set for each render: see toneFillForCamera. Set
        // in working space, because the composer's route is raw.
        const wallAlbedo   = Number.isFinite(options.wallColour) ? new THREE.Color(options.wallColour) : null;
        const fillMaterial = new THREE.MeshBasicMaterial({
            color : new THREE.Color().setRGB(tone, tone, tone, THREE.LinearSRGBColorSpace),
            side  : THREE.DoubleSide
        });
        const fillNormal = new THREE.InstancedBufferAttribute(new Float32Array([0, 0, 1]), 3, false, 1);
        fillNormal.setUsage(THREE.DynamicDrawUsage);

        const fillMesh = new THREE.Mesh(new THREE.BufferGeometry(), fillMaterial);
        fillMesh.name          = 'Na__Entourage__Fill';
        fillMesh.frustumCulled = false;
        fillMesh.raycast       = () => {};

        // THE FILL'S FIRST PASS WHEN TRANSPARENT | Depth only, from the one geometry, so one
        // layer shows at each pixel. Marked transparent so it sorts after the opaque model.
        const fillDepthMaterial = new THREE.MeshBasicMaterial({
            colorWrite  : false,
            depthWrite  : true,
            side        : THREE.DoubleSide,
            transparent : true
        });
        const drawingDepthMaterial = new THREE.MeshBasicMaterial({ colorWrite : false, side : THREE.DoubleSide });   // <-- The model's depth, for renderDrawingLayer
        const fillDepthMesh = new THREE.Mesh(fillMesh.geometry, fillDepthMaterial);
        fillDepthMesh.name          = 'Na__Entourage__FillDepth';
        fillDepthMesh.frustumCulled = false;
        fillDepthMesh.renderOrder   = Na__EntLayer__FILL_DEPTH_ORDER;
        fillDepthMesh.visible       = false;
        fillDepthMesh.raycast       = () => {};

        const fillStore = { cap : 0, array : null, attribute : null };
        fillStore.grow = (items) => {
            const cap = Math.max(items, Math.ceil(fillStore.cap * Na__EntLayer__GROWTH), Na__EntLayer__START_FILL);
            fillStore.cap   = cap;
            fillStore.array = new Float32Array(cap * 3);
            const previous = fillMesh.geometry;
            const position = new THREE.BufferAttribute(fillStore.array, 3);
            position.setUsage(THREE.DynamicDrawUsage);
            const geometry = new THREE.InstancedBufferGeometry();
            geometry.setAttribute('position', position);
            geometry.setAttribute('normal', fillNormal);                       // <-- One value for all, read once per instance, and there is one instance
            geometry.instanceCount = 1;
            geometry.setDrawRange(0, 0);
            fillMesh.geometry      = geometry;
            fillDepthMesh.geometry = geometry;
            fillStore.attribute    = position;
            previous.dispose();
        };
        fillStore.grow(Na__EntLayer__START_FILL);
        root.add(fillDepthMesh);
        root.add(fillMesh);
        scene.add(root);

        const state = {
            recipes     : new Map(),
            parts       : new Map(),                                           // <-- assetId|seed -> what the builder and triangulation made
            entries     : [],                                                  // <-- { figure, parts, c, s }, the figures being drawn
            hiddenUid   : '',                                                  // <-- Being carried: a tool draws it instead, without a render
            dirty       : true,
            counts      : { outer : 0, inner : 0, fill : 0 },
            shown       : true,
            failed      : false,
            fillMasked  : false,
            transparency: 0,
            seeThrough  : Number.isFinite(options.seeThroughPercent) ? options.seeThroughPercent : 50,
            drawingLayerRunning : false,
            paperTone   : tone,
            wallShare   : Number.isFinite(advanced.Entourage__LineRulesAdvanced__FillWallShare) ? advanced.Entourage__LineRulesAdvanced__FillWallShare : 1,
            depthBias   : biasLog,
            signature   : new Float64Array(7),
            hasView     : false,
            stats       : { figures : 0, outer : 0, inner : 0, fillTris : 0, writeMs : 0 }
        };

        // SUB FUNCTION | Set the Fill and Lines for the Transparency and the AO's Mark
        // ------------------------------------------------------------
        // Four states, as the plants': see Na__Vegetation__SceneLayer__.js. Opaque is exactly
        // what it always was. While AO runs the fill writes alpha 0 so AO leaves it alone.
        // ------------------------------------------------------------
        function applyFillLook() {
            const share = state.transparency / 100;
            const on    = share > 0;
            const alpha = 1 - share;
            const mask  = state.fillMasked && state.transparency < state.seeThrough;

            fillMaterial.transparent = on;
            fillMaterial.depthWrite  = !on;
            fillMaterial.opacity     = on ? alpha : (mask ? 0 : 1);
            if (on && mask) {
                fillMaterial.blending      = THREE.CustomBlending;
                fillMaterial.blendEquation = THREE.AddEquation;
                fillMaterial.blendSrc      = THREE.SrcAlphaFactor;
                fillMaterial.blendDst      = THREE.OneMinusSrcAlphaFactor;
                fillMaterial.blendSrcAlpha = THREE.ZeroFactor;
                fillMaterial.blendDstAlpha = THREE.ZeroFactor;
            } else {
                fillMaterial.blending = (mask && !on) ? THREE.NoBlending : THREE.NormalBlending;
            }
            fillMaterial.needsUpdate = true;
            fillMesh.renderOrder     = on ? Na__EntLayer__FILL_COLOUR_ORDER : 0;
            fillMesh.visible         = true;
            fillDepthMesh.visible    = on;

            [outerMaterial, innerMaterial].forEach((material) => {
                if (material.transparent !== on) {
                    material.transparent = on;
                    material.needsUpdate = true;
                }
                material.opacity = alpha;
            });
        }
        // ------------------------------------------------------------


        // SUB FUNCTION | What an Asset and a Seed Draw, Made Once
        // ------------------------------------------------------------
        function partsFor(figure) {
            const key = figure.assetId + '|' + figure.seed;
            if (state.parts.has(key)) return state.parts.get(key);
            const recipe = state.recipes.get(figure.assetId);
            const built  = recipe ? Na__EntBuild__BuildFigure(recipe, figure.seed, builder) : null;
            if (!built) return null;

            // THE FILL | Each face into triangles, as flat x,y in metres
            const triangles = [];
            built.faces.forEach((face) => {
                if (face.outer.length < 3) return;
                const contour = face.outer.map((point) => new THREE.Vector2(point[0], point[1]));
                const holes   = face.holes.map((hole) => hole.map((point) => new THREE.Vector2(point[0], point[1])));
                const all     = contour.concat(...holes);
                THREE.ShapeUtils.triangulateShape(contour, holes).forEach((triangle) => {
                    for (let v = 0; v < 3; v++) triangles.push(all[triangle[v]].x / 1000, all[triangle[v]].y / 1000);
                });
            });

            const parts = {
                outer    : new Float32Array(built.outer),
                inner    : new Float32Array(built.inner),
                fill     : new Float32Array(triangles),
                faces    : built.faces,
                outlines : built.outlines
            };
            state.parts.set(key, parts);
            return parts;
        }
        // ------------------------------------------------------------


        // SUB FUNCTION | Put the Draw Counts on the Objects
        // ------------------------------------------------------------
        function showCounts() {
            outerLine.line.geometry.instanceCount = state.counts.outer;
            innerLine.line.geometry.instanceCount = state.counts.inner;
            fillMesh.geometry.setDrawRange(0, state.counts.fill);
            state.shown = true;
        }
        function hideCounts() {
            outerLine.line.geometry.instanceCount = 0;
            innerLine.line.geometry.instanceCount = 0;
            fillMesh.geometry.setDrawRange(0, 0);
            state.shown = false;
        }
        // ------------------------------------------------------------


        // SUB FUNCTION | Is This the View the Figures Are Turned For?
        // ------------------------------------------------------------
        // Reads only what a figure's turn depends on: the eye, or the view for an orthographic
        // camera. A refiner's sub-pixel jitter changes neither. Keeps the new one when it is not.
        // ------------------------------------------------------------
        function isSameView(camera) {
            const e = camera.matrixWorld.elements;
            const s = state.signature;
            const ortho = camera.isOrthographicCamera ? 1 : 0;
            const v0 = ortho ? e[8] : e[12], v1 = ortho ? e[9] : e[13], v2 = ortho ? e[10] : e[14];
            let same = state.hasView;
            if (s[0] !== ortho) { s[0] = ortho; same = false; }
            if (s[1] !== v0)    { s[1] = v0;    same = false; }
            if (s[2] !== v1)    { s[2] = v1;    same = false; }
            if (s[3] !== v2)    { s[3] = v2;    same = false; }
            if (s[4] !== e[8])  { s[4] = e[8];  same = false; }                // <-- The fill's normal follows the view, whichever camera
            if (s[5] !== e[9])  { s[5] = e[9];  same = false; }
            if (s[6] !== e[10]) { s[6] = e[10]; same = false; }
            state.hasView = true;
            return same;
        }
        // ------------------------------------------------------------


        // SUB FUNCTION | Write Every Figure into the Buffers, Turned to This Camera
        // ------------------------------------------------------------
        function writeFigures(camera) {
            const startedAt = performance.now();
            const e = camera.matrixWorld.elements;
            const ortho = !!camera.isOrthographicCamera;

            let outerN = 0, innerN = 0, fillN = 0;
            state.entries.forEach((entry) => {
                if (entry.figure.uid === state.hiddenUid) return;
                outerN += entry.parts.outer.length / 4;
                innerN += entry.parts.inner.length / 4;
                fillN  += entry.parts.fill.length / 2;
            });
            if (outerN > outerLine.cap) outerLine.grow(outerN);
            if (innerN > innerLine.cap) innerLine.grow(innerN);
            if (fillN > fillStore.cap) fillStore.grow(fillN);

            const outerOut = outerLine.array, innerOut = innerLine.array, fillOut = fillStore.array;
            let outerAt = 0, innerAt = 0, fillAt = 0;

            state.entries.forEach((entry) => {
                const figure = entry.figure;
                const px = figure.positionMm[0] / 1000, py = figure.positionMm[1] / 1000, pz = figure.positionMm[2] / 1000;
                const toX = ortho ? e[8] : e[12] - px, toZ = ortho ? e[10] : e[14] - pz;
                const yaw = Math.atan2(toX, toZ);
                const c = Math.cos(yaw) * figure.scale, s = Math.sin(yaw) * figure.scale, up = figure.scale * (figure.stretch || 1);
                entry.c = Math.cos(yaw);
                entry.s = Math.sin(yaw);
                if (figure.uid === state.hiddenUid) return;

                const segments = (flat, out, at) => {
                    for (let k = 0; k < flat.length; k += 4) {
                        const x1 = flat[k], y1 = flat[k + 1], x2 = flat[k + 2], y2 = flat[k + 3];
                        out[at++] = px + x1 * c; out[at++] = py + y1 * up; out[at++] = pz - x1 * s;
                        out[at++] = px + x2 * c; out[at++] = py + y2 * up; out[at++] = pz - x2 * s;
                    }
                    return at;
                };
                outerAt = segments(entry.parts.outer, outerOut, outerAt);
                innerAt = segments(entry.parts.inner, innerOut, innerAt);

                const flatFill = entry.parts.fill;
                for (let k = 0; k < flatFill.length; k += 2) {
                    const x = flatFill[k], y = flatFill[k + 1];
                    fillOut[fillAt++] = px + x * c; fillOut[fillAt++] = py + y * up; fillOut[fillAt++] = pz - x * s;
                }
            });

            outerLine.buffer.clearUpdateRanges();
            innerLine.buffer.clearUpdateRanges();
            fillStore.attribute.clearUpdateRanges();
            if (outerAt > 0) { outerLine.buffer.addUpdateRange(0, outerAt); outerLine.buffer.needsUpdate = true; }
            if (innerAt > 0) { innerLine.buffer.addUpdateRange(0, innerAt); innerLine.buffer.needsUpdate = true; }
            if (fillAt > 0) { fillStore.attribute.addUpdateRange(0, fillAt); fillStore.attribute.needsUpdate = true; }

            state.counts.outer = outerN;
            state.counts.inner = innerN;
            state.counts.fill  = fillN;

            // ALL FACING THE EYE | See the header: no Sobel lines on a figure
            const n = fillNormal.array;
            n[0] = e[8]; n[1] = e[9]; n[2] = e[10];
            fillNormal.needsUpdate = true;

            showCounts();
            state.stats.figures  = state.entries.length;
            state.stats.outer    = outerN;
            state.stats.inner    = innerN;
            state.stats.fillTris = fillN / 3;
            state.stats.writeMs  = performance.now() - startedAt;
        }
        // ------------------------------------------------------------


        // SUB FUNCTION | Give the Fill the Brightness of a Wall Facing This Camera
        // ------------------------------------------------------------
        // As the plants': (ambient + sun x dot) / pi, the view's normal with each axis counting by
        // its square. @delegate: ../../24__System__Vegetation/03__System__SceneLayer/Na__Vegetation__SceneLayer__.js
        // A sheet's layer has no walls under it, only paper, so it keeps the paper tone.
        // ------------------------------------------------------------
        function toneFillForCamera(camera) {
            if (!wallAlbedo) return;
            const paper = state.paperTone;
            if (state.drawingLayerRunning) {
                fillMaterial.color.setRGB(paper, paper, paper, THREE.LinearSRGBColorSpace);
                return;
            }

            const eye = camera.matrixWorld.elements;
            const nx = eye[8], ny = eye[9], nz = eye[10];                      // <-- The camera's own +Z: from what it looks at towards the eye
            let r = 0, g = 0, b = 0, lit = false;
            const children = scene.children;
            for (let i = 0; i < children.length; i++) {
                const light = children[i];
                if (!light.isLight || !light.visible) continue;
                let amount;
                if (light.isAmbientLight) {
                    amount = light.intensity;
                } else if (light.isDirectionalLight) {
                    const from = light.matrixWorld.elements, to = light.target.matrixWorld.elements;
                    const dx = from[12] - to[12], dy = from[13] - to[13], dz = from[14] - to[14];
                    const length = Math.hypot(dx, dy, dz) || 1;
                    amount = light.intensity * (
                        nx * nx * Math.max(0, (nx < 0 ? -dx : dx) / length) +
                        ny * ny * Math.max(0, (ny < 0 ? -dy : dy) / length) +
                        nz * nz * Math.max(0, (nz < 0 ? -dz : dz) / length)
                    );
                } else {
                    continue;
                }
                r += light.color.r * amount;
                g += light.color.g * amount;
                b += light.color.b * amount;
                lit = true;
            }
            if (!lit) {
                fillMaterial.color.setRGB(paper, paper, paper, THREE.LinearSRGBColorSpace);
                return;
            }
            const share = state.wallShare / Math.PI;
            fillMaterial.color.setRGB(
                Math.min(1, wallAlbedo.r * r * share),
                Math.min(1, wallAlbedo.g * g * share),
                Math.min(1, wallAlbedo.b * b * share),
                THREE.LinearSRGBColorSpace
            );
        }
        // ------------------------------------------------------------


        // FUNCTION | Run Inside Every renderer.render, for the Camera About to Draw
        // ------------------------------------------------------------
        function onBeforeSceneRender(camera) {
            if (state.failed || !root.visible) return;
            if (!camera.layers.isEnabled(0)) return;                           // <-- An export layer pass: not looking at figures
            if (camera.isOrthographicCamera) {
                const asked = state.drawingLayerRunning || (host.liveDrawingsWantFigures && host.liveDrawingsWantFigures() === true);
                if (!asked || camera.matrixWorld.elements[9] > Na__EntLayer__PLAN_LOOK) {   // <-- A drawing unasked, or a plan: see the header
                    hideCounts();
                    return;
                }
            }
            if (!state.shown) showCounts();

            // SECTION CUTS | The list is the section system's own, or null with none
            if (host.getClipList) {
                const clip = host.getClipList();
                if (fillMaterial.clippingPlanes !== clip) {
                    fillMaterial.clippingPlanes      = clip;
                    fillDepthMaterial.clippingPlanes = clip;
                    outerMaterial.clippingPlanes     = clip;
                    innerMaterial.clippingPlanes     = clip;
                }
            }

            // THE FILL'S MARK | See the plants' header. A program change, so only when it changes
            const wantsMask = host.isAoRunning ? host.isAoRunning(camera) === true : false;   // <-- The camera: a host may say a drawing's camera never runs AO
            if (wantsMask !== state.fillMasked) {
                state.fillMasked = wantsMask;
                applyFillLook();
            }

            // THE NORMAL PASS WHEN TRANSPARENT | An override material is the mark of it
            if (state.transparency > 0) {
                const overriding = !!scene.overrideMaterial;
                fillDepthMesh.visible = !overriding;
                fillMesh.visible      = !(overriding && state.transparency >= state.seeThrough);
            }

            toneFillForCamera(camera);
            const same = isSameView(camera);
            if (!same || state.dirty) {
                state.dirty = false;
                writeFigures(camera);
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Put the Layer in Front of Every Render of the Scene
        // ------------------------------------------------------------
        // A fault in here must never reach the model or the plants: figures are an extra.
        // ------------------------------------------------------------
        function installRenderHook() {
            const hook = (renderer, _scene, camera) => {
                try {
                    onBeforeSceneRender(camera);
                } catch (error) {
                    state.failed = true;
                    root.visible = false;
                    console.warn('[TrueVision3D Entourage] Drawing failed, so figures are off for this visit. The model is unaffected:', error);
                }
            };
            if (host.addRenderHook) host.addRenderHook(hook);
            else scene.onBeforeRender = hook;
        }
        // ------------------------------------------------------------


        // FUNCTION | Draw the Figures Alone for a Drawing on a Sheet
        // ------------------------------------------------------------
        // The plants' way (their renderDrawingLayer): first the model's depth alone, so a wall in
        // front hides a figure behind it, then the figures with nothing else in the scene. A
        // printed sheet does not depend on one device's slider, so opaque. overOther: the plants have
        // just been drawn into this target with the model's depth, so add to that: no clear, no
        // second depth pass, and a person behind a bush stays behind it.
        // ------------------------------------------------------------
        function renderDrawingLayer(renderer, camera, overOther) {
            const was = {
                autoClear   : renderer.autoClear,
                clearAlpha  : renderer.getClearAlpha(),
                clearColour : renderer.getClearColor(new THREE.Color()),
                shadowAuto  : renderer.shadowMap.autoUpdate,
                background  : scene.background,
                override    : scene.overrideMaterial,
                transparency: state.transparency
            };
            const hidden = [];
            const hide = (object) => {
                if (object.visible) {
                    object.visible = false;
                    hidden.push(object);
                }
            };
            const bringBack = () => {
                hidden.forEach((object) => { object.visible = true; });
                hidden.length = 0;
            };
            const rootWasOn = root.visible;
            try {
                if (!overOther) {
                    renderer.setClearColor(0x000000, 0);
                    renderer.clear(true, true, false);
                }
                if (state.entries.length === 0 || !rootWasOn) return true;

                renderer.shadowMap.autoUpdate = false;
                renderer.autoClear = false;
                scene.background   = null;

                // THE MODEL'S DEPTH | No colour. Fat lines go, as for the profile pass
                if (!overOther) {
                    root.visible = false;
                    scene.traverse((object) => { if (object.isLine2 || object.isLineSegments2) hide(object); });
                    drawingDepthMaterial.clippingPlanes = host.getClipList ? host.getClipList() : null;
                    scene.overrideMaterial = drawingDepthMaterial;
                    renderer.render(scene, camera);
                    scene.overrideMaterial = was.override;
                    bringBack();
                    root.visible = true;
                }

                // THE FIGURES | Alone
                scene.children.forEach((child) => { if (child !== root) hide(child); });
                if (was.transparency > 0) setTransparency(0);
                state.drawingLayerRunning = true;
                renderer.render(scene, camera);
                return true;
            } finally {
                state.drawingLayerRunning = false;
                bringBack();
                root.visible           = rootWasOn;
                scene.overrideMaterial = was.override;
                scene.background       = was.background;
                if (was.transparency > 0) setTransparency(was.transparency);
                renderer.setClearColor(was.clearColour, was.clearAlpha);
                renderer.autoClear            = was.autoClear;
                renderer.shadowMap.autoUpdate = was.shadowAuto;
            }
        }
        // ------------------------------------------------------------


        // FUNCTION | Fade the Whole of Every Figure, from 0 to 100
        // ------------------------------------------------------------
        function setTransparency(percent) {
            const value = Math.max(0, Math.min(100, Number(percent) || 0));
            if (value === state.transparency) return;
            state.transparency = value;
            applyFillLook();
        }
        // ------------------------------------------------------------


        // FUNCTION | Show or Hide All of It
        // ------------------------------------------------------------
        function setVisible(visible) {
            root.visible = (visible === true);
            state.dirty  = true;
        }
        // ------------------------------------------------------------


        // FUNCTION | Bring the Figures Being Drawn into Line
        // ------------------------------------------------------------
        // list: figures as Na__EntData__FigureToBuild makes them. One whose asset cannot be read
        // is left out, its record untouched. Keeps each one's last turn, for a pick before a render.
        // ------------------------------------------------------------
        function setFigures(list) {
            const kept = new Map(state.entries.map((entry) => [entry.figure.uid, entry]));
            state.entries = [];
            list.forEach((figure) => {
                const parts = partsFor(figure);
                if (!parts) return;
                const before = kept.get(figure.uid);
                state.entries.push({ figure, parts, c : before ? before.c : 1, s : before ? before.s : 0 });
            });
            state.dirty = true;
        }
        // ------------------------------------------------------------


        // FUNCTION | Which Figure Does a Ray Hit?
        // ------------------------------------------------------------
        // Against each figure's own plane and outline, as it is turned now. tolerancePerM: how
        // far off a line still counts, per metre away, so a far figure is not a fiddle to take.
        // Returns { uid, distanceM } for the nearest, or null.
        // ------------------------------------------------------------
        function pick(origin, direction, tolerancePerM) {
            let best = null, bestT = Infinity;
            state.entries.forEach((entry) => {
                const figure = entry.figure;
                if (figure.uid === state.hiddenUid) return;
                const px = figure.positionMm[0] / 1000, py = figure.positionMm[1] / 1000, pz = figure.positionMm[2] / 1000;
                const denom = direction.x * entry.s + direction.z * entry.c;
                if (Math.abs(denom) < 1e-6) return;
                const t = ((px - origin.x) * entry.s + (pz - origin.z) * entry.c) / denom;
                if (t <= 0 || t >= bestT) return;

                const dx = origin.x + direction.x * t - px;
                const dz = origin.z + direction.z * t - pz;
                const x = ((dx * entry.c - dz * entry.s) / figure.scale) * 1000;
                const y = ((origin.y + direction.y * t - py) / (figure.scale * (figure.stretch || 1))) * 1000;
                const reach = ((t * (tolerancePerM || 0)) / figure.scale) * 1000;
                const spots = [[x, y], [x - reach, y], [x + reach, y], [x, y - reach], [x, y + reach]];
                const hit = entry.parts.faces.some((face) => spots.some((spot) => Na__EntBuild__Inside(spot[0], spot[1], face.outer)));
                if (hit) {
                    bestT = t;
                    best  = { uid : figure.uid, distanceM : t };
                }
            });
            return best;
        }
        // ------------------------------------------------------------


        return {
            root,
            stats : state.stats,
            installRenderHook,
            renderDrawingLayer,
            setFigures,
            setTransparency,
            setVisible,
            pick,
            figures : () => state.entries.map((entry) => entry.figure),

            // What an asset draws, for a card or a tool's aid, whether or not one is placed
            partsFor,

            // The app's assets, once the project's own copies have been resolved
            setRecipes : (list) => {
                state.recipes = new Map(list.map((recipe) => [recipe.Asset__Id, recipe]));
            },

            // An asset's copy changed: draw its figures afresh on the next setFigures
            forgetAsset : (assetId) => {
                Array.from(state.parts.keys()).forEach((key) => { if (key.startsWith(assetId + '|')) state.parts.delete(key); });
            },

            // A figure is being carried: a tool draws it, and the scene leaves it out
            setHiddenUid : (uid) => {
                state.hiddenUid = uid || '';
                state.dirty = true;
            },

            // A panel slider that changes the lines themselves
            setLineRules : (lineRules) => {
                rules   = lineRules;
                builder = Na__EntBuild__RulesFrom(rules);
                state.parts.clear();
                state.entries.forEach((entry) => { entry.parts = partsFor(entry.figure) || entry.parts; });
                state.dirty = true;
            },

            // The panel's Advanced dropdown: one needs new programs, one a new colour
            setDepthBias : (value) => {
                if (value === state.depthBias) return;                         // <-- A new program each time: never for a slider that moved something else
                state.depthBias = value;
                outerMaterial.naEntSetDepthBias(value);
                innerMaterial.naEntSetDepthBias(value);
            },
            setFillTone : (value) => {
                state.paperTone = value;
                if (!wallAlbedo) fillMaterial.color.setRGB(value, value, value, THREE.LinearSRGBColorSpace);
            },
            setFillWallShare : (share) => {
                if (Number.isFinite(share)) state.wallShare = share;
            },

            // The line weights system stashes a material's base width the first time it scales
            // one, and works from that from then on
            setLineWeights : (outerPx, innerPx) => {
                outerMaterial.linewidth = outerPx;
                innerMaterial.linewidth = innerPx;
                if (outerPx > 0) innerMaterial.userData.Na__LineworkSettings__OverrideShare = innerPx / outerPx;
                if (Number.isFinite(outerMaterial.userData.Na__LineworkSettings__BaseWidth)) outerMaterial.userData.Na__LineworkSettings__BaseWidth = outerPx;
                if (Number.isFinite(innerMaterial.userData.Na__LineworkSettings__BaseWidth)) innerMaterial.userData.Na__LineworkSettings__BaseWidth = innerPx;
                state.dirty = true;
            }
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scene Layer API
    // ------------------------------------------------------------
    export {
        Na__EntLayer__Create
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
