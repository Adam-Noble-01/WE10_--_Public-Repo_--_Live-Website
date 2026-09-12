// =============================================================================
// TRUEVISION3D - DRAWING VIEW CORE - 2D PROFILE LINES
// =============================================================================
//
// FILE       : Na__DrawView__ProfileLines__.js
// NAMESPACE  : Na__DrawProfile
// MODULE     : Drawing View Core - Orthographic Profile Lines
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Give a 2D drawing the silhouette edges a parallel view loses
// CREATED    : 07-Sep-2026
//
// DESCRIPTION:
// - A FLOOR PLAN OR ELEVATION IS RENDERED FLAT, AND FLAT IS WHERE ROUND
//   GEOMETRY DIES. Under a parallel projection with no fog, no ambient
//   occlusion and no tone mapping, a cylinder, a curved wall, a bay window and
//   a downpipe all resolve to a single field of one colour. The linework GLB
//   only carries the edges SketchUp considered hard, so anything whose outline
//   is a smooth tangent - which is every rounded object - reads as a blank
//   patch on the drawing. This module puts the missing outline back.
//
// - THE MECHANISM IS THE SAME NORMAL-DISCONTINUITY SOBEL THE 3D VIEW ALREADY
//   USES, and deliberately so: a drawing and a render of the same building
//   should not disagree about where its edges are. Two off-screen pre-passes
//   are taken through the DRAWING's own orthographic camera -
//
//       NORMAL BUFFER  - the scene under MeshNormalMaterial. Adjacent pixels
//                        differ where a surface turns away, which is exactly
//                        the silhouette of a rounded form.
//       COLOUR BUFFER  - the scene flat-shaded in the edge colour, with the
//                        linework left in so its vertex colours tint the lines
//                        that fall on it.
//
//   A Sobel operator over the normal buffer scores each pixel, a smoothstep
//   turns that score into coverage, and the colour buffer supplies the ink.
//
// - IT COMPOSITES AS A TRANSPARENT OVERLAY, NOT AS A POST-PROCESS CHAIN. The
//   3D pipeline mixes the edge into a scene colour it has already captured
//   into a composer buffer. A drawing has no composer - the render loop draws
//   it straight to the canvas on purpose, because fog, SSAO and tone mapping
//   shade a parallel drawing like a surface, which is exactly wrong - so
//   instead of capturing and re-mixing the beauty image, the edge is drawn
//   OVER it as a full-screen quad whose alpha is the Sobel coverage. Ordinary
//   source-over blending then performs the identical mix:
//
//       out = profileColour * blend + canvas * (1 - blend)
//
//   That is one full-screen quad rather than a colour capture, a copy and a
//   blit, and the beauty pixels are never round-tripped through a render
//   target, so no colour space or tone mapping question arises at all.
//
// - SECTION CLIPPING IS RE-APPLIED BY HAND EVERY PASS. The cut engine assigns
//   its planes to each MATERIAL, and both pre-passes deliberately replace
//   materials wholesale - so without this the pre-passes would see the whole
//   building where the drawing sees a cut through it, and the Sobel would ink
//   the outline of a first floor over a ground floor plan. This is not a
//   defensive nicety; a plan is ALWAYS cut, so it is load-bearing.
//
// - LINE WIDTH IS FIXED, NOT DISTANCE-SCALED. The 3D effect thins its edges
//   with camera distance to imitate aerial perspective. There is no such thing
//   under a parallel projection, and a drawing wants a constant line weight on
//   the sheet regardless of zoom, which is the same thing a drawn line has.
//
// INTEGRATION:
// - Na__AppFlow__LoadingSequence initialises this once the pipeline exists,
//   calls RenderOverlay in the 2D branch of the render loop directly after the
//   flat scene render, and forwards resizes and scene-graph changes.
// - Na__PresentationMode__Thumbnail__Renderer takes the same branch so a saved
//   drawing thumbnail matches what the author is looking at.
// - Buffers are SHARED with Na__RenderEffect__ProfileLines__ when the 3D
//   effect is switched on, because only one of the two can be on screen at a
//   time. Own buffers are allocated only when the 3D effect is off.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 07-Sep-2026 - Version 1.0.0
// - Initial implementation. Rounded geometry was disappearing from plans and
//   elevations because the 2D render path carried no edge pass of any kind.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core
    // ------------------------------------------------------------
    import * as THREE from 'three';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Section Clipping Planes (Shared State)
    // ------------------------------------------------------------
    // Read live every pass rather than cached, because the plane moves with
    // the slider and swaps entirely when a different drawing is opened.
    // ------------------------------------------------------------
    import { Na__SectionClipping__GetClipList } from '../05__RenderPipeline/Na__RenderEffect__SectionClipping__State.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Fallback Appearance Defaults
    // ------------------------------------------------------------
    // Used when the config block is absent. The width is deliberately wider
    // than the 3D effect's near-distance width: a drawing is read at sheet
    // scale, where a quarter-pixel edge simply is not there.
    // ------------------------------------------------------------
    const Na__DrawProfile__FB_ENABLED          = true;
    const Na__DrawProfile__FB_EDGE_COLOR       = 4210752;                        // <-- 0x404040, matching the 3D effect
    const Na__DrawProfile__FB_EDGE_THRESHOLD   = 0.2;                            // <-- Normal gradient sensitivity
    const Na__DrawProfile__FB_EDGE_WIDTH       = 0.55;                           // <-- Fixed sampling width in pixels
    // ------------------------------------------------------------

    // MODULE CONSTANTS | Normal Buffer Clear Colour
    // ------------------------------------------------------------
    // The view-space forward normal encoded the way MeshNormalMaterial writes
    // it. Clearing to this makes the background uniform, so the only gradient
    // at the model's outline is the one the model itself creates.
    // ------------------------------------------------------------
    const Na__DrawProfile__NORMAL_CLEAR = new THREE.Color(0.5, 0.5, 1.0);
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Render Context
    // ------------------------------------------------------------
    let Na__DrawProfile__Renderer = null;                                        // <-- THREE.WebGLRenderer
    let Na__DrawProfile__Scene    = null;                                        // <-- The one model scene
    let Na__DrawProfile__Ready    = false;                                       // <-- Initialise completed without fault
    // ------------------------------------------------------------

    // MODULE VARIABLES | Resolved Settings
    // ------------------------------------------------------------
    let Na__DrawProfile__Enabled       = Na__DrawProfile__FB_ENABLED;
    let Na__DrawProfile__EdgeWidth     = Na__DrawProfile__FB_EDGE_WIDTH;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Off-Screen Buffers
    // ------------------------------------------------------------
    // OwnsTargets records whether these were allocated here or borrowed from
    // the 3D effect, because only buffers we allocated may be resized or
    // disposed by this module.
    // ------------------------------------------------------------
    let Na__DrawProfile__NormalTarget = null;                                    // <-- Full-res normal buffer
    let Na__DrawProfile__ColorTarget  = null;                                    // <-- Half-res profile colour buffer
    let Na__DrawProfile__OwnsTargets  = false;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Pass Materials
    // ------------------------------------------------------------
    let Na__DrawProfile__NormalMaterial = null;                                  // <-- Scene override for the normal pass
    let Na__DrawProfile__ColorMaterial  = null;                                  // <-- Per-mesh swap for the colour pass
    // ------------------------------------------------------------

    // MODULE VARIABLES | Composite Quad
    // ------------------------------------------------------------
    let Na__DrawProfile__QuadScene    = null;
    let Na__DrawProfile__QuadCamera   = null;
    let Na__DrawProfile__QuadMaterial = null;
    let Na__DrawProfile__QuadMesh     = null;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Scene Graph Cache
    // ------------------------------------------------------------
    // Rebuilt only when the scene graph changes, because traversing a loaded
    // model every frame costs more than the two pre-passes it feeds.
    // ------------------------------------------------------------
    let Na__DrawProfile__LineObjects    = [];                                    // <-- Fat lines, hidden during the normal pass
    let Na__DrawProfile__LineVisibility = [];                                    // <-- Their prior visibility, restored afterwards
    let Na__DrawProfile__MeshObjects    = [];                                    // <-- Real surface meshes, swapped for the colour pass
    let Na__DrawProfile__MeshMaterials  = [];                                    // <-- Their original materials, restored afterwards
    let Na__DrawProfile__CacheDirty     = true;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Scratch Objects (Allocation-Free Rendering)
    // ------------------------------------------------------------
    // The renderer's clear colour is read back and restored around the two
    // pre-passes, so it is copied into a long-lived Colour rather than a fresh
    // one each frame.
    // ------------------------------------------------------------
    const Na__DrawProfile__SavedClearColor = new THREE.Color();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Helpers - Config
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Read a Numeric Config Value with a Two-Step Fallback
    // ------------------------------------------------------------
    // Every 2D setting falls back to its 3D counterpart before falling back to
    // a literal, so the drawings inherit a hand-tuned edge colour or threshold
    // without it having to be typed twice and kept in step by hand.
    // ------------------------------------------------------------
    function Na__DrawProfile__CfgNumber(config, key2d, key3d, fallback) {
        if (!config) return fallback;
        if (key2d && Number.isFinite(config[key2d])) return config[key2d];
        if (key3d && Number.isFinite(config[key3d])) return config[key3d];
        return fallback;                                                         // <-- key3d is null where a setting has no 3D counterpart
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Convert a Packed Integer Colour to a Three.js Colour
    // ------------------------------------------------------------
    function Na__DrawProfile__IntToColor(intColor) {
        return new THREE.Color(
            ((intColor >> 16) & 255) / 255,                                      // <-- Red channel
            ((intColor >>  8) & 255) / 255,                                      // <-- Green channel
            ( intColor        & 255) / 255                                       // <-- Blue channel
        );
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Helpers - Scene Graph Cache
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Is This Object Inside a Linework GLB?
    // ------------------------------------------------------------
    // The model loader tags each linework root with Na__ModelType = 'linework'.
    // Walking the chain catches stray Mesh nodes nested inside one, which must
    // never have their material swapped.
    // ------------------------------------------------------------
    function Na__DrawProfile__IsInsideLinework(object) {
        let node = object;
        while (node) {
            if (node.userData && node.userData.Na__ModelType === 'linework') return true;
            node = node.parent;
        }
        return false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Rebuild the Cached Object Lists
    // ------------------------------------------------------------
    // THE MESH FILTER IS THREE TESTS AND ALL THREE MATTER. A LineSegments2 sets
    // isMesh = true internally so the renderer picks it up on the instanced
    // path, and swapping its LineMaterial for a MeshBasicMaterial leaves the
    // instanced draw call in place while binding a shader that cannot read the
    // per-instance attributes - the GPU then chews through a whole scene's
    // worth of corrupted geometry every frame. That mistake is what made the
    // 3D effect ruinous before it was fixed; it is not repeated here.
    // ------------------------------------------------------------
    function Na__DrawProfile__RebuildCache() {
        Na__DrawProfile__LineObjects = [];
        Na__DrawProfile__MeshObjects = [];

        Na__DrawProfile__Scene.traverse((obj) => {
            if (obj.isLine2 || obj.isLineSegments2) {
                Na__DrawProfile__LineObjects.push(obj);                          // <-- Fat lines: hidden for the normal pass only
                return;
            }
            if (!obj.isMesh)                              return;                // <-- Only real meshes are candidates
            if (Na__DrawProfile__IsInsideLinework(obj))   return;                // <-- Defensive: stray nodes inside a linework GLB
            Na__DrawProfile__MeshObjects.push(obj);                              // <-- Surface mesh: eligible for the colour swap
        });

        Na__DrawProfile__LineVisibility = new Array(Na__DrawProfile__LineObjects.length);
        Na__DrawProfile__MeshMaterials  = new Array(Na__DrawProfile__MeshObjects.length);
        Na__DrawProfile__CacheDirty     = false;

        console.log(
            '[TrueVision3D] Drawing profile lines cache rebuilt: '
            + Na__DrawProfile__MeshObjects.length + ' meshes (swap), '
            + Na__DrawProfile__LineObjects.length + ' lines (hide)'
        );
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Helpers - Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Two Off-Screen Buffers
    // ------------------------------------------------------------
    // Only reached when the 3D effect is switched off and has therefore
    // allocated nothing to borrow. The descriptors match its own exactly, so a
    // drawing looks identical either way.
    // ------------------------------------------------------------
    function Na__DrawProfile__AllocateTargets(widthPx, heightPx) {
        Na__DrawProfile__NormalTarget = new THREE.WebGLRenderTarget(widthPx, heightPx, {
            minFilter     : THREE.LinearFilter,
            magFilter     : THREE.LinearFilter,
            format        : THREE.RGBAFormat,
            type          : THREE.UnsignedByteType,
            depthBuffer   : true,
            stencilBuffer : false
        });
        Na__DrawProfile__NormalTarget.texture.name = 'DrawingProfileLines_NormalBuffer';

        Na__DrawProfile__ColorTarget = new THREE.WebGLRenderTarget(
            Math.max(1, Math.ceil(widthPx  * 0.5)),                              // <-- Half-res: the ink is flat, only its outline is sharp
            Math.max(1, Math.ceil(heightPx * 0.5)),
            {
                minFilter     : THREE.LinearFilter,
                magFilter     : THREE.LinearFilter,
                format        : THREE.RGBAFormat,
                type          : THREE.UnsignedByteType,
                depthBuffer   : true,
                stencilBuffer : false
            }
        );
        Na__DrawProfile__ColorTarget.texture.name = 'DrawingProfileLines_ColorBuffer';

        Na__DrawProfile__OwnsTargets = true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Full-Screen Composite Quad
    // ------------------------------------------------------------
    // The fragment shader is the 3D effect's Sobel with its final mix removed:
    // where that one reads the captured scene colour and interpolates towards
    // the edge colour, this one emits the edge colour with the interpolation
    // factor as ALPHA and lets source-over blending do the identical sum
    // against whatever is already on the canvas.
    //
    // Pixels the operator scores at zero are discarded rather than blended as
    // fully transparent, which is the overwhelming majority of the screen.
    // ------------------------------------------------------------
    function Na__DrawProfile__BuildQuad(edgeColor, edgeThreshold) {
        Na__DrawProfile__QuadMaterial = new THREE.ShaderMaterial({
            uniforms : {
                tNormal               : { value : Na__DrawProfile__NormalTarget.texture },
                tProfileColor         : { value : Na__DrawProfile__ColorTarget.texture },
                resolution            : { value : new THREE.Vector2(1, 1) },
                u_edgeThresholdNormal : { value : edgeThreshold },
                u_edgeWidth           : { value : Na__DrawProfile__EdgeWidth },
                u_edgeColor           : { value : edgeColor }
            },
            vertexShader : `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = vec4(position.xy, 0.0, 1.0);
                }
            `,
            fragmentShader : `
                uniform sampler2D tNormal;
                uniform sampler2D tProfileColor;
                uniform vec2      resolution;
                uniform float     u_edgeThresholdNormal;
                uniform float     u_edgeWidth;
                uniform vec3      u_edgeColor;

                varying vec2 vUv;

                void main() {
                    vec2  invRes = 1.0 / resolution;
                    float stepX  = invRes.x * u_edgeWidth;
                    float stepY  = invRes.y * u_edgeWidth;

                    vec3 nL = texture2D(tNormal, vUv - vec2(stepX, 0.0)).rgb;
                    vec3 nR = texture2D(tNormal, vUv + vec2(stepX, 0.0)).rgb;
                    vec3 nD = texture2D(tNormal, vUv - vec2(0.0, stepY)).rgb;
                    vec3 nU = texture2D(tNormal, vUv + vec2(0.0, stepY)).rgb;

                    float gx   = length(nR - nL);
                    float gy   = length(nU - nD);
                    float edge = sqrt(gx * gx + gy * gy);

                    float softness = u_edgeThresholdNormal * 0.5;
                    float blend    = smoothstep(
                        u_edgeThresholdNormal - softness,
                        u_edgeThresholdNormal + softness,
                        edge
                    );

                    if (blend <= 0.0) discard;                 // <-- Most of the sheet is not an edge

                    vec3 ink = texture2D(tProfileColor, vUv).rgb;
                    gl_FragColor = vec4(ink, blend);
                }
            `,
            transparent : true,
            blending    : THREE.NormalBlending,
            depthTest   : false,
            depthWrite  : false
        });

        Na__DrawProfile__QuadMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(2, 2),
            Na__DrawProfile__QuadMaterial
        );
        Na__DrawProfile__QuadMesh.frustumCulled = false;                         // <-- Clip-space quad; the frustum test is meaningless

        Na__DrawProfile__QuadScene  = new THREE.Scene();
        Na__DrawProfile__QuadScene.add(Na__DrawProfile__QuadMesh);
        Na__DrawProfile__QuadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Lifecycle
// -----------------------------------------------------------------------------

    // FUNCTION | Stand the Drawing Profile Line Renderer Up
    // ------------------------------------------------------------
    // sharedTargets is the pipeline state object. When the 3D effect is on it
    // carries profileNormalTarget and profileColorTarget, which are borrowed
    // rather than duplicated: only one of the two effects can be on screen at
    // any moment, so a second pair would be VRAM held for nothing.
    // ------------------------------------------------------------
    function Na__DrawProfile__Initialise(renderer, scene, config, sharedTargets) {
        if (!renderer || !scene) {
            console.warn('[TrueVision3D] Drawing profile lines: no renderer or scene - not initialised.');
            return false;
        }

        Na__DrawProfile__Renderer = renderer;
        Na__DrawProfile__Scene    = scene;

        Na__DrawProfile__Enabled = !(config
            && config.RenderEffect__ProfileLines__Drawing2dEnabled === false);    // <-- Absent means on

        const edgeColorInt = Na__DrawProfile__CfgNumber(
            config,
            'RenderEffect__ProfileLines__Drawing2dEdgeColor',
            'RenderEffect__ProfileLines__EdgeColor',
            Na__DrawProfile__FB_EDGE_COLOR
        );
        const edgeThreshold = Na__DrawProfile__CfgNumber(
            config,
            'RenderEffect__ProfileLines__Drawing2dEdgeThresholdNormal',
            'RenderEffect__ProfileLines__EdgeThresholdNormal',
            Na__DrawProfile__FB_EDGE_THRESHOLD
        );
        Na__DrawProfile__EdgeWidth = Na__DrawProfile__CfgNumber(
            config,
            'RenderEffect__ProfileLines__Drawing2dEdgeWidth',
            null,
            Na__DrawProfile__FB_EDGE_WIDTH
        );

        const edgeColor = Na__DrawProfile__IntToColor(edgeColorInt);

        // BUFFERS | Borrow the 3D effect's pair, or allocate a matching one
        if (sharedTargets && sharedTargets.profileNormalTarget && sharedTargets.profileColorTarget) {
            Na__DrawProfile__NormalTarget = sharedTargets.profileNormalTarget;
            Na__DrawProfile__ColorTarget  = sharedTargets.profileColorTarget;
            Na__DrawProfile__OwnsTargets  = false;
        } else {
            const pixelRatio = renderer.getPixelRatio();
            Na__DrawProfile__AllocateTargets(
                Math.max(1, Math.round(window.innerWidth  * pixelRatio)),
                Math.max(1, Math.round(window.innerHeight * pixelRatio))
            );
        }

        // PASS MATERIALS | Built once, reused every frame
        Na__DrawProfile__NormalMaterial = new THREE.MeshNormalMaterial();
        Na__DrawProfile__ColorMaterial  = new THREE.MeshBasicMaterial({
            color               : edgeColor,
            side                : THREE.DoubleSide,
            polygonOffset       : true,
            polygonOffsetFactor : 2,
            polygonOffsetUnits  : 2
        });

        Na__DrawProfile__BuildQuad(edgeColor, edgeThreshold);
        Na__DrawProfile__HandleResize(window.innerWidth, window.innerHeight);

        Na__DrawProfile__Ready      = true;
        Na__DrawProfile__CacheDirty = true;

        console.log(
            '[TrueVision3D] Drawing profile lines ready ('
            + (Na__DrawProfile__Enabled ? 'enabled' : 'disabled') + ', '
            + (Na__DrawProfile__OwnsTargets ? 'own buffers' : 'shared buffers') + ').'
        );
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Release Everything This Module Allocated
    // ------------------------------------------------------------
    function Na__DrawProfile__Dispose() {
        if (Na__DrawProfile__OwnsTargets) {
            if (Na__DrawProfile__NormalTarget) Na__DrawProfile__NormalTarget.dispose();
            if (Na__DrawProfile__ColorTarget)  Na__DrawProfile__ColorTarget.dispose();
        }
        if (Na__DrawProfile__QuadMesh)       Na__DrawProfile__QuadMesh.geometry.dispose();
        if (Na__DrawProfile__QuadMaterial)   Na__DrawProfile__QuadMaterial.dispose();
        if (Na__DrawProfile__NormalMaterial) Na__DrawProfile__NormalMaterial.dispose();
        if (Na__DrawProfile__ColorMaterial)  Na__DrawProfile__ColorMaterial.dispose();

        Na__DrawProfile__NormalTarget   = null;
        Na__DrawProfile__ColorTarget    = null;
        Na__DrawProfile__QuadMesh       = null;
        Na__DrawProfile__QuadMaterial   = null;
        Na__DrawProfile__QuadScene      = null;
        Na__DrawProfile__QuadCamera     = null;
        Na__DrawProfile__NormalMaterial = null;
        Na__DrawProfile__ColorMaterial  = null;
        Na__DrawProfile__LineObjects    = [];
        Na__DrawProfile__MeshObjects    = [];
        Na__DrawProfile__Ready          = false;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Per-Frame Rendering
// -----------------------------------------------------------------------------

    // FUNCTION | Ink the Silhouettes Over the Drawing Already on the Canvas
    // ------------------------------------------------------------
    // CALLED IMMEDIATELY AFTER THE FLAT SCENE RENDER AND BEFORE THE SECTION
    // OVERLAY. Order matters in both directions: the beauty image has to exist
    // before an edge can be blended onto it, and the cut fills have to land
    // afterwards so a poche stays solid rather than being outlined against its
    // own boundary.
    //
    // Returns true when it drew, so a caller can tell an edge pass that ran
    // from one that was switched off.
    // ------------------------------------------------------------
    function Na__DrawProfile__RenderOverlay(camera) {
        if (!Na__DrawProfile__Ready || !Na__DrawProfile__Enabled || !camera) return false;

        const renderer = Na__DrawProfile__Renderer;
        const scene    = Na__DrawProfile__Scene;

        if (Na__DrawProfile__CacheDirty) Na__DrawProfile__RebuildCache();

        const lineObjects = Na__DrawProfile__LineObjects;
        const meshObjects = Na__DrawProfile__MeshObjects;

        // SECTION CUTS | Both pass materials replace the ones the cut engine
        // clipped, so the live plane list is re-applied to them here.
        const clipList = Na__SectionClipping__GetClipList();
        Na__DrawProfile__NormalMaterial.clippingPlanes = clipList;
        Na__DrawProfile__ColorMaterial.clippingPlanes  = clipList;

        const savedOverride    = scene.overrideMaterial;
        const savedBackground  = scene.background;
        const savedClearAlpha  = renderer.getClearAlpha();
        const savedAutoClear   = renderer.autoClear;
        const savedShadowAuto  = renderer.shadowMap.autoUpdate;
        renderer.getClearColor(Na__DrawProfile__SavedClearColor);                 // <-- Copied in place; restored after the pre-passes

        // WHERE THE BEAUTY IMAGE IS. Usually the canvas, and this used to say
        // so outright. A SUPERSAMPLED BAKE DRAWS THE WHOLE FRAME INTO AN
        // OFFSCREEN TARGET instead, and an edge pass that insists on the canvas
        // would ink onto a buffer nobody is averaging - the picture keeps its
        // flat render and loses every silhouette. So the composite goes back to
        // whatever was bound when this was called, which is the canvas on
        // screen and the sample target during a bake.
        const outputTarget = renderer.getRenderTarget();

        // SHADOWS OFF | Three.js re-renders every shadow map on each render()
        // call, and this function makes two of them. Both draw the scene under
        // an UNLIT material - a normal encode and a flat colour - so not one
        // shadow texel can reach either buffer, and the beauty render that ran
        // moments ago has already brought the maps up to date this frame.
        renderer.shadowMap.autoUpdate = false;

        // BACKGROUND OFF | A project may back its scene with a flat colour or
        // with the HDR environment itself. Either would be painted over the
        // clear colour in both pre-passes: a sky texture in the normal buffer
        // is read by the Sobel as thousands of edges that are not there, and
        // any background at all weakens the model's outer silhouette by
        // narrowing the gradient across it. Cleared to nothing so each buffer
        // gets the uniform field it was designed around.
        scene.background = null;

        // HIDE LINEWORK | Prior visibility is saved rather than assumed, so any
        // line an external system culled this frame stays culled afterwards.
        for (let i = 0, len = lineObjects.length; i < len; i++) {
            Na__DrawProfile__LineVisibility[i] = lineObjects[i].visible;
            lineObjects[i].visible = false;
        }

        // PASS 1 | Normal buffer - meshes only, under the normal override
        renderer.setClearColor(Na__DrawProfile__NORMAL_CLEAR, 1.0);
        scene.overrideMaterial = Na__DrawProfile__NormalMaterial;
        renderer.setRenderTarget(Na__DrawProfile__NormalTarget);
        renderer.clear();
        renderer.render(scene, camera);
        scene.overrideMaterial = savedOverride;

        // PASS 2 | Profile colour - flat meshes plus the linework's own colours
        for (let i = 0, len = lineObjects.length; i < len; i++) {
            lineObjects[i].visible = Na__DrawProfile__LineVisibility[i];
        }
        for (let i = 0, len = meshObjects.length; i < len; i++) {
            Na__DrawProfile__MeshMaterials[i] = meshObjects[i].material;
            meshObjects[i].material = Na__DrawProfile__ColorMaterial;
        }

        renderer.setClearColor(Na__DrawProfile__ColorMaterial.color, 1.0);       // <-- Background takes the ink colour too
        renderer.setRenderTarget(Na__DrawProfile__ColorTarget);
        renderer.clear();
        renderer.render(scene, camera);

        for (let i = 0, len = meshObjects.length; i < len; i++) {
            meshObjects[i].material = Na__DrawProfile__MeshMaterials[i];
        }

        // COMPOSITE | Straight onto the beauty image, over the drawing already there
        scene.background = savedBackground;                                      // <-- Restored before anything else can render the scene
        renderer.setRenderTarget(outputTarget);
        renderer.setClearColor(Na__DrawProfile__SavedClearColor, savedClearAlpha);
        renderer.autoClear = false;                                              // <-- The beauty image must survive this draw
        renderer.render(Na__DrawProfile__QuadScene, Na__DrawProfile__QuadCamera);

        renderer.autoClear            = savedAutoClear;
        renderer.shadowMap.autoUpdate = savedShadowAuto;

        return true;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - State Changes
// -----------------------------------------------------------------------------

    // FUNCTION | Match the Buffers and the Sobel Step to a New Viewport
    // ------------------------------------------------------------
    // The resolution uniform is set whichever buffers are in use, because the
    // Sobel step is measured in pixels of the normal buffer; the buffers
    // themselves are only resized when this module allocated them, since the
    // 3D effect resizes its own.
    // ------------------------------------------------------------
    function Na__DrawProfile__HandleResize(width, height) {
        if (!Na__DrawProfile__QuadMaterial) return;

        const pixelRatio = Na__DrawProfile__Renderer.getPixelRatio();
        const widthPx    = Math.max(1, Math.round((width  || window.innerWidth)  * pixelRatio));
        const heightPx   = Math.max(1, Math.round((height || window.innerHeight) * pixelRatio));

        if (Na__DrawProfile__OwnsTargets) {
            Na__DrawProfile__NormalTarget.setSize(widthPx, heightPx);
            Na__DrawProfile__ColorTarget.setSize(
                Math.max(1, Math.ceil(widthPx  * 0.5)),
                Math.max(1, Math.ceil(heightPx * 0.5))
            );
        }

        Na__DrawProfile__QuadMaterial.uniforms.resolution.value.set(widthPx, heightPx);
    }
    // ------------------------------------------------------------


    // FUNCTION | Forget the Cached Object Lists
    // ------------------------------------------------------------
    // Called whenever the scene graph changes under us - a model load, a design
    // phase switch, a storey isolate. Cheap: the rebuild happens on the next
    // frame that actually draws a drawing, not here.
    // ------------------------------------------------------------
    function Na__DrawProfile__InvalidateSceneCache() {
        Na__DrawProfile__CacheDirty = true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Turn the Effect On or Off at Runtime
    // ------------------------------------------------------------
    function Na__DrawProfile__SetEnabled(flag) {
        Na__DrawProfile__Enabled = (flag === true);
        return Na__DrawProfile__Enabled;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is the Effect Currently On?
    // ------------------------------------------------------------
    function Na__DrawProfile__IsEnabled() {
        return Na__DrawProfile__Ready && Na__DrawProfile__Enabled;
    }
    // ------------------------------------------------------------


    // FUNCTION | Change the Fixed Line Width at Runtime
    // ------------------------------------------------------------
    // Pixels of sampling offset, not a stroke weight: larger values widen the
    // band the operator scores as an edge, so the line thickens with it.
    // ------------------------------------------------------------
    function Na__DrawProfile__SetEdgeWidth(widthPx) {
        if (!Number.isFinite(widthPx) || widthPx <= 0)  return Na__DrawProfile__EdgeWidth;
        Na__DrawProfile__EdgeWidth = widthPx;
        if (Na__DrawProfile__QuadMaterial) {
            Na__DrawProfile__QuadMaterial.uniforms.u_edgeWidth.value = widthPx;
        }
        return Na__DrawProfile__EdgeWidth;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Drawing Profile Lines API
    // ------------------------------------------------------------
    export {
        Na__DrawProfile__Initialise,
        Na__DrawProfile__Dispose,
        Na__DrawProfile__RenderOverlay,
        Na__DrawProfile__HandleResize,
        Na__DrawProfile__InvalidateSceneCache,
        Na__DrawProfile__SetEnabled,
        Na__DrawProfile__IsEnabled,
        Na__DrawProfile__SetEdgeWidth
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
