// =============================================================================
// TRUEVISION3D - ELEVATION DEPTH FOG - RENDER LAYER
// =============================================================================
//
// FILE       : Na__ElevationDepthFog__RenderLayer__.js
// NAMESPACE  : Na__ElevFog
// MODULE     : Elevation Depth Fog - Render Layer
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw a drawing's depth fog as a render layer - over the 3D viewport, or as an image of its own for a sheet
// CREATED    : 20-Sep-2026
//
// DESCRIPTION:
// - THE FOG IS A LAYER, NOT A PASS IN A CHAIN AND NOT A MATERIAL TRICK. A
//   drawing is rendered flat, straight to the canvas, with the composer
//   bypassed on purpose: the 3D view's fog, its SSAO and its tone mapping
//   shade a parallel drawing like a surface, which is exactly wrong. So there
//   is no chain to join. And the fog has to fade the LINEWORK as well as the
//   surfaces - the fat SketchUp edges, the Sobel silhouettes, and on a sheet
//   the projected vectors, none of which a material's fog would reach alike.
//   What reaches all of them is a layer laid over the finished drawing, which
//   is what Na__DrawView__ProfileLines__ already is, and this follows it.
//
// - TWO STEPS, EVERY TIME IT DRAWS:
//     DEPTH   the scene once more through the DRAWING'S OWN CAMERA into a
//             target with a depth texture, under its own materials. Its own,
//             because three things only real materials know: where a section
//             cut has clipped the model, what a fat line's shader does with
//             its instanced quads, and what is glass. An override material
//             gets all three wrong.
//     FOG     one full-screen quad reading that depth - the Shader module.
//
// - THE PLANE AND THE NUMBERS COME FROM A SOURCE, READ LIVE. Whoever has put a
//   drawing on screen hands over { getSettings, getPlane } - two closures over
//   the drawing's record - and takes them away again. Read per frame, so a
//   number typed in the Dev menu is on screen on the next frame with nothing
//   told to refresh, and a draft reverted is reverted here too. SetSource
//   answers what it replaced, so a borrower (a sheet viewport's render) can
//   put it back.
//
// - NOTHING IS SIZED IN ADVANCE. The depth target follows whatever is being
//   drawn into at the moment of drawing: the canvas on screen, one tile of an
//   export, a supersampler's sample target. A buffer that had to be TOLD about
//   a resize is one a future render path forgets to tell - which is how the
//   drawing silhouettes came to be inked at viewport resolution and stretched
//   across a sheet until v2.25.0.
//
// - IT GOES BACK TO WHATEVER TARGET WAS BOUND WHEN IT WAS CALLED, and hands
//   back every piece of renderer state it touched. This runs against the live
//   renderer, between other people's draws.
//
// - A PERSPECTIVE CAMERA GETS NO FOG. The depth solve refuses it; see the
//   Maths module. Drawings are parallel, so nothing that should be fogged is.
//
// INTEGRATION:
// - Index.html initialises it with the renderer and the scene.
// - Na__Elevation__ModeController__ sets the source while an elevation is on
//   screen and clears it on leaving.
// - Na__AppFlow__LoadingSequence, Na__DrawView__RenderPreset__ and
//   Na__PresentationMode__Thumbnail__Renderer call RenderOverlay in the 2D
//   drawing sequence: flat render, silhouettes, FOG, cut fills. After the
//   silhouettes so it fades them; before the cut fills so a poche - which is
//   ON the plane, in front of any fog - stays solid.
// - Na__LayoutEditor__SnapshotRenderer__ borrows the source and calls
//   RenderLayerFrame as a tiled render's frame, for a sheet viewport's fog
//   image.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (20-Sep-2026)
// - ValeVision    : not yet ported. ValeVision keeps its composer running for a
//                   drawing (DIV-1), so the two calls land in different places
//                   there; the layer itself carries over as it stands.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 20-Sep-2026 - Version 1.0.0
// - Initial implementation for the Elevation Depth Fog build.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Core and the Shared Full-Screen Quad
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Unit Conversion
    // ------------------------------------------------------------
    import { Na__Math__ConvertMmToUnits } from '../04__MathUtils/Na__Math__Units.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | The Section Cut's Caps, for the Depth Pre-Pass
    // ------------------------------------------------------------
    // The cut faces live in the section engine's own overlay scene, outside the
    // model scene this module renders, so their depth has to be asked for.
    // @delegate: ../41__System__SectionCutEngine/Na__SectionCut__Engine__.js
    // ------------------------------------------------------------
    import { Na__SectionCut__RenderDepthInto } from '../41__System__SectionCutEngine/Na__SectionCut__Engine__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Fog Config, Maths and Shader
    // ------------------------------------------------------------
    // @delegate: ./Na__ElevationDepthFog__ConfigState__.js
    // @delegate: ./Na__ElevationDepthFog__Maths__.js
    // @delegate: ./Na__ElevationDepthFog__Shader__.js
    // ------------------------------------------------------------
    import {
        Na__ElevFogCfg__Load,
        Na__ElevFogCfg__IsEnabled,
        Na__ElevFogCfg__GetLimits,
        Na__ElevFogCfg__GetAppearance
    } from './Na__ElevationDepthFog__ConfigState__.js';
    import {
        Na__ElevFogMath__FalloffToBias,
        Na__ElevFogMath__DepthBehindPlane,
        Na__ElevFogMath__SolveAffineDepth,
        Na__ElevFogMath__ParseColour,
        Na__ElevFogMath__SrgbToLinear
    } from './Na__ElevationDepthFog__Maths__.js';
    import {
        Na__ElevFogShader__VERTEX,
        Na__ElevFogShader__FRAGMENT
    } from './Na__ElevationDepthFog__Shader__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | The Two Ways Out of the Shader
    // ------------------------------------------------------------
    const Na__ElevFog__MODE_OVER_PICTURE = 0;   // <-- Blended onto what is already there
    const Na__ElevFog__MODE_OWN_LAYER    = 1;   // <-- Premultiplied, onto a cleared transparent target
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | Render Context
    // ------------------------------------------------------------
    let Na__ElevFog__Renderer = null;                                            // <-- THREE.WebGLRenderer
    let Na__ElevFog__Scene    = null;                                            // <-- The one model scene
    // ------------------------------------------------------------

    // MODULE VARIABLES | Whose Fog Is Being Drawn
    // ------------------------------------------------------------
    // { getSettings() -> { enabled, startDepthMm, endDepthMm, falloffPercent } | null,
    //   getPlane()    -> { normalX, normalY, normalZ, distanceMm } | null }
    // Null means no drawing has fog to offer, and every draw below is a no-op.
    // ------------------------------------------------------------
    let Na__ElevFog__Source = null;
    // ------------------------------------------------------------

    // MODULE VARIABLES | GPU Resources (built on the first draw that needs them)
    // ------------------------------------------------------------
    let Na__ElevFog__DepthTarget = null;                                         // <-- Colour is never read; the depth texture is the point
    let Na__ElevFog__Uniforms    = null;
    let Na__ElevFog__OverQuad    = null;                                         // <-- Source-over, for a picture already on the target
    let Na__ElevFog__LayerQuad   = null;                                         // <-- Unblended, for a layer of its own
    let Na__ElevFog__WarnedPerspective = false;
    // ------------------------------------------------------------

    // MODULE VARIABLES | Scratch Objects (Allocation-Free Rendering)
    // ------------------------------------------------------------
    const Na__ElevFog__ScratchPoint      = new THREE.Vector3();
    const Na__ElevFog__ScratchSize       = new THREE.Vector2();
    const Na__ElevFog__SavedClearColour  = new THREE.Color();
    const Na__ElevFog__LentMaterials     = [];                                   // <-- The glass lent a depth write for one pre-pass; emptied as it is handed back
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Helpers - Construction
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Two Quads Over One Set of Uniforms
    // ------------------------------------------------------------
    // Two materials rather than one whose blending is flipped per draw: the
    // uniforms are shared, so there is one place a number is set, and neither
    // material's GL state is ever something the other has to undo.
    // ------------------------------------------------------------
    function Na__ElevFog__BuildQuads() {
        Na__ElevFog__Uniforms = {
            tDepth         : { value : null },
            uTexel         : { value : new THREE.Vector2(1, 1) },
            uDepthAffine   : { value : new THREE.Vector4(0, 0, 0, 0) },
            uFogStart      : { value : 0 },
            uFogEnd        : { value : 1 },
            uFogBias       : { value : 0.5 },
            uFogMaxOpacity : { value : 1 },
            uFogColour     : { value : new THREE.Vector3(1, 1, 1) },
            uEdgeGuard     : { value : 1 },
            uEmptyReach    : { value : 12 },
            uOutputMode    : { value : Na__ElevFog__MODE_OVER_PICTURE },
            uEncodeFollows : { value : 0 }
        };

        const overMaterial = new THREE.ShaderMaterial({
            name           : 'Na__ElevationDepthFog__OverPicture',
            uniforms       : Na__ElevFog__Uniforms,
            vertexShader   : Na__ElevFogShader__VERTEX,
            fragmentShader : Na__ElevFogShader__FRAGMENT,
            transparent    : true,
            blending       : THREE.NormalBlending,
            depthTest      : false,
            depthWrite     : false
        });

        const layerMaterial = new THREE.ShaderMaterial({
            name           : 'Na__ElevationDepthFog__OwnLayer',
            uniforms       : Na__ElevFog__Uniforms,
            vertexShader   : Na__ElevFogShader__VERTEX,
            fragmentShader : Na__ElevFogShader__FRAGMENT,
            blending       : THREE.NoBlending,                                   // <-- Premultiplied values onto a cleared target: nothing to blend with
            depthTest      : false,
            depthWrite     : false
        });

        Na__ElevFog__OverQuad  = new FullScreenQuad(overMaterial);
        Na__ElevFog__LayerQuad = new FullScreenQuad(layerMaterial);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Make the Depth Target the Size of What Is Being Drawn Into
    // ------------------------------------------------------------
    // FloatType depth, as the 3D pipeline's own depth textures are. Nearest,
    // because a depth averaged across a silhouette is a depth nothing is at.
    // ------------------------------------------------------------
    function Na__ElevFog__EnsureDepthTarget(widthPx, heightPx) {
        const width  = Math.max(1, Math.round(widthPx));
        const height = Math.max(1, Math.round(heightPx));

        if (!Na__ElevFog__DepthTarget) {
            Na__ElevFog__DepthTarget = new THREE.WebGLRenderTarget(width, height, {
                minFilter     : THREE.NearestFilter,
                magFilter     : THREE.NearestFilter,
                format        : THREE.RGBAFormat,
                type          : THREE.UnsignedByteType,
                depthBuffer   : true,
                stencilBuffer : false,
                depthTexture  : new THREE.DepthTexture(width, height, THREE.FloatType)
            });
            Na__ElevFog__DepthTarget.texture.name = 'Na__ElevationDepthFog__DepthPrePass';
        } else if (Na__ElevFog__DepthTarget.width !== width || Na__ElevFog__DepthTarget.height !== height) {
            Na__ElevFog__DepthTarget.setSize(width, height);
        }

        Na__ElevFog__Uniforms.tDepth.value = Na__ElevFog__DepthTarget.depthTexture;
        Na__ElevFog__Uniforms.uTexel.value.set(1 / width, 1 / height);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Private Helpers - What to Draw
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | The Fog the Source Is Offering Right Now, or Null
    // ------------------------------------------------------------
    // Null for every reason there can be nothing to draw - no source, the
    // system switched off, the drawing's own fog off, a plane that is not one.
    // A source that throws is treated as offering nothing: it is somebody
    // else's closure, and a drawing must still draw.
    // ------------------------------------------------------------
    function Na__ElevFog__ResolveWanted() {
        if (!Na__ElevFog__Source || !Na__ElevFogCfg__IsEnabled()) return null;

        let settings = null;
        let plane    = null;
        try {
            settings = Na__ElevFog__Source.getSettings();
            if (!settings || settings.enabled !== true) return null;
            plane = Na__ElevFog__Source.getPlane();
        } catch (sourceError) {
            console.warn('[TrueVision3D] Elevation depth fog: the drawing could not say what its fog is.', sourceError);
            return null;
        }

        if (!plane || ![ plane.normalX, plane.normalY, plane.normalZ, plane.distanceMm ].every(Number.isFinite)) return null;
        return { settings : settings, plane : plane };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Solve This Camera's Depth and Load Every Uniform
    // ------------------------------------------------------------
    // Returns false when the camera is not a parallel one. The four samples go
    // through the camera's matrices AS THEY STAND - zoom, a tile's view offset
    // and a supersample's jitter are all already in them.
    // ------------------------------------------------------------
    function Na__ElevFog__LoadUniforms(camera, wanted, outputMode, targetIsLinear) {
        const planeUnits = {
            normalX  : wanted.plane.normalX,
            normalY  : wanted.plane.normalY,
            normalZ  : wanted.plane.normalZ,
            distance : Na__Math__ConvertMmToUnits(wanted.plane.distanceMm)
        };

        const point  = Na__ElevFog__ScratchPoint;
        const solved = Na__ElevFogMath__SolveAffineDepth((u, v, s) => {
            point.set((2 * u) - 1, (2 * v) - 1, (2 * s) - 1)                     // <-- Window 0-1 to NDC; a parallel camera's depth is linear in both
                 .applyMatrix4(camera.projectionMatrixInverse)
                 .applyMatrix4(camera.matrixWorld);
            return Na__ElevFogMath__DepthBehindPlane(point.x, point.y, point.z, planeUnits);
        });

        if (!solved) {
            if (!Na__ElevFog__WarnedPerspective) {
                console.warn('[TrueVision3D] Elevation depth fog: the camera is not a parallel one - no fog drawn.');
                Na__ElevFog__WarnedPerspective = true;
            }
            return false;
        }

        const limits     = Na__ElevFogCfg__GetLimits();
        const appearance = Na__ElevFogCfg__GetAppearance();
        const colour     = Na__ElevFogMath__ParseColour(appearance.colour);
        const uniforms   = Na__ElevFog__Uniforms;

        uniforms.uDepthAffine.value.set(solved.a, solved.b, solved.c, solved.d);
        uniforms.uFogStart.value      = Na__Math__ConvertMmToUnits(wanted.settings.startDepthMm);
        uniforms.uFogEnd.value        = Na__Math__ConvertMmToUnits(wanted.settings.endDepthMm);
        uniforms.uFogBias.value       = Na__ElevFogMath__FalloffToBias(wanted.settings.falloffPercent, limits.falloffEdgePercent);
        uniforms.uFogMaxOpacity.value = appearance.maxOpacity;
        uniforms.uEdgeGuard.value     = appearance.edgeGuardPx;
        uniforms.uEmptyReach.value    = appearance.emptyReachPx;
        uniforms.uOutputMode.value    = outputMode;

        // THE COLOUR IS A DISPLAY COLOUR. Blended onto the canvas it is used as
        // it stands. Blended onto a LINEAR working target it is made linear
        // first, so the picture's later encode returns it. A layer of its own
        // does its own sum in the shader, after premultiplying, because that is
        // the value the encode will see.
        const blendIntoLinear = (outputMode === Na__ElevFog__MODE_OVER_PICTURE) && targetIsLinear;
        uniforms.uFogColour.value.set(
            blendIntoLinear ? Na__ElevFogMath__SrgbToLinear(colour.r) : colour.r,
            blendIntoLinear ? Na__ElevFogMath__SrgbToLinear(colour.g) : colour.g,
            blendIntoLinear ? Na__ElevFogMath__SrgbToLinear(colour.b) : colour.b
        );
        uniforms.uEncodeFollows.value = (outputMode === Na__ElevFog__MODE_OWN_LAYER && targetIsLinear) ? 1 : 0;
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Have Glass Write Depth for the Length of One Pre-Pass
    // ------------------------------------------------------------
    // GLASS DOES NOT WRITE DEPTH. The loader builds every blended material
    // with depthWrite off, as it should - a pane must not hide what is behind
    // it. But a depth buffer without the panes puts a window's fog wherever the
    // thing BEHIND it is, and where that is open sky there is nothing behind
    // it at all: the pixel reads as empty paper and the glazing of a far wing
    // stays dark and sharp while its walls and its frames fade round it. Found
    // on RB05's South West Elevation, where it was the first thing anyone
    // would see.
    //
    // So for this one render every visible UNTEXTURED blended material is lent
    // a depth write, and the pane is fogged at the pane. depthWrite is GL state,
    // not a shader define, so nothing recompiles; the list is rebuilt per draw
    // because the whitecard and opaque-glass presets swap materials between
    // draws, and a held list would be a list of materials no longer in use.
    //
    // A TEXTURED blended material is left alone on purpose. A cut-out tree or
    // figure is a whole quad, most of it clear; lending it a depth write would
    // fog the building seen through its clear texels as though it stood at the
    // tree, and print the quad's rectangle into the fog behind it. Left alone
    // it takes the fog of what stands behind it, which is the lesser fault.
    // ------------------------------------------------------------
    function Na__ElevFog__LendDepthToGlass(scene) {
        const lent = Na__ElevFog__LentMaterials;
        lent.length = 0;

        scene.traverseVisible((object) => {
            if (!object.isMesh || !object.material) return;
            const materials = Array.isArray(object.material) ? object.material : [ object.material ];
            for (let i = 0; i < materials.length; i++) {
                const material = materials[i];
                if (!material || material.transparent !== true || material.depthWrite !== false) continue;
                if (material.map || material.alphaMap) continue;                 // <-- A cut-out: see above
                material.depthWrite = true;
                lent.push(material);                                             // <-- Shared materials appear once: the second meeting finds depthWrite already true
            }
        });
        return lent;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Hand the Depth Writes Back
    // ------------------------------------------------------------
    function Na__ElevFog__ReturnDepthToGlass(lent) {
        for (let i = 0; i < lent.length; i++) lent[i].depthWrite = false;
        lent.length = 0;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Draw the Fog Onto the Target That Is Bound, One Way or the Other
    // ------------------------------------------------------------
    // THE ONE ROUTINE BOTH PUBLIC DRAWS SHARE, so the state saved and handed
    // back is written down once. outputMode decides only two things: whether
    // the target is cleared to transparent first, and which quad draws.
    // ------------------------------------------------------------
    function Na__ElevFog__Draw(camera, outputMode) {
        const renderer = Na__ElevFog__Renderer;
        const scene    = Na__ElevFog__Scene;
        const ownLayer = (outputMode === Na__ElevFog__MODE_OWN_LAYER);

        // WHERE THE DRAWING IS. The canvas on screen; a supersampler's sample
        // target during a bake. A bound target is a LINEAR working buffer whose
        // owner encodes it on the way out (three never encodes into a target);
        // the canvas is already display-referred.
        const outputTarget   = renderer.getRenderTarget();
        const targetIsLinear = (outputTarget !== null);

        const savedAutoClear  = renderer.autoClear;
        const savedClearAlpha = renderer.getClearAlpha();
        const savedShadowAuto = renderer.shadowMap.autoUpdate;
        renderer.getClearColor(Na__ElevFog__SavedClearColour);

        const wanted = Na__ElevFog__ResolveWanted();
        let   drew   = false;

        try {
            // A LAYER OF ITS OWN STARTS FROM NOTHING, whether or not there turns
            // out to be fog to put on it: a sample target is handed over with
            // the last sample still in it, and "no fog" must be an empty image,
            // not the previous tile's.
            if (ownLayer) {
                renderer.setClearColor(0x000000, 0);
                renderer.clear(true, true, false);
            }
            if (!wanted) return false;

            if (!Na__ElevFog__Uniforms) Na__ElevFog__BuildQuads();

            if (outputTarget) Na__ElevFog__EnsureDepthTarget(outputTarget.width, outputTarget.height);
            else {
                renderer.getDrawingBufferSize(Na__ElevFog__ScratchSize);
                Na__ElevFog__EnsureDepthTarget(Na__ElevFog__ScratchSize.x, Na__ElevFog__ScratchSize.y);
            }

            camera.updateMatrixWorld();                                          // <-- The solve reads matrixWorld; a camera posed since its last render has a stale one
            if (!Na__ElevFog__LoadUniforms(camera, wanted, outputMode, targetIsLinear)) return false;

            // DEPTH | The scene under its own materials, shadows left alone:
            // no shadow texel reaches a depth buffer, and the beauty render
            // that ran a moment ago has already brought the maps up to date.
            renderer.shadowMap.autoUpdate = false;
            renderer.autoClear = true;
            renderer.setRenderTarget(Na__ElevFog__DepthTarget);
            renderer.setClearColor(0x000000, 0);
            renderer.clear(true, true, true);
            Na__ElevFog__LendDepthToGlass(scene);                                // <-- A pane is fogged at the pane, not at the sky behind it
            try {
                renderer.render(scene, camera);
                Na__SectionCut__RenderDepthInto(camera);                         // <-- A section's cut faces lie ON the plane and must read so: without them a poche has the depth of the room behind it. Nothing on a plain elevation
            } finally {
                Na__ElevFog__ReturnDepthToGlass(Na__ElevFog__LentMaterials);     // <-- Before anything else can draw the scene: glass that hid what is behind it would be a different building
            }

            // FOG | Back onto whatever was bound, over what is there
            renderer.setRenderTarget(outputTarget);
            renderer.autoClear = false;                                          // <-- The picture - or the transparent clear - must survive this draw
            (ownLayer ? Na__ElevFog__LayerQuad : Na__ElevFog__OverQuad).render(renderer);
            drew = true;
            return true;
        } catch (drawError) {
            console.warn('[TrueVision3D] Elevation depth fog could not be drawn - the drawing is shown without it.', drawError);
            return drew;
        } finally {
            renderer.setRenderTarget(outputTarget);
            renderer.setClearColor(Na__ElevFog__SavedClearColour, savedClearAlpha);
            renderer.autoClear            = savedAutoClear;
            renderer.shadowMap.autoUpdate = savedShadowAuto;
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Lifecycle and Source
// -----------------------------------------------------------------------------

    // FUNCTION | Stand the Fog Layer Up
    // ------------------------------------------------------------
    // context: { renderer, scene }. Nothing is allocated here: a project that
    // never switches a fog on never pays for a depth target.
    // ------------------------------------------------------------
    function Na__ElevFog__Initialise(context) {
        if (!context || !context.renderer || !context.scene) {
            console.warn('[TrueVision3D] Elevation depth fog: no renderer or scene - not initialised.');
            return false;
        }
        Na__ElevFog__Renderer = context.renderer;
        Na__ElevFog__Scene    = context.scene;
        Na__ElevFogCfg__Load();                                                  // <-- Fallbacks mirror the JSON, so nothing waits on this
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Say Whose Fog Is to Be Drawn, and Learn Whose It Was
    // ------------------------------------------------------------
    // source: { getSettings, getPlane } or null. Returns the source it
    // replaced, which a borrower hands straight back when it is done.
    // ------------------------------------------------------------
    function Na__ElevFog__SetSource(source) {
        const previous = Na__ElevFog__Source;
        const usable   = source && typeof source.getSettings === 'function' && typeof source.getPlane === 'function';
        Na__ElevFog__Source = usable ? source : null;
        return previous;
    }
    // ------------------------------------------------------------


    // FUNCTION | Whose Fog Is Being Drawn (null When Nobody's)
    // ------------------------------------------------------------
    function Na__ElevFog__GetSource() {
        return Na__ElevFog__Source;
    }
    // ------------------------------------------------------------


    // FUNCTION | Is There Any Fog to Draw Right Now?
    // ------------------------------------------------------------
    function Na__ElevFog__IsWanted() {
        return Boolean(Na__ElevFog__Renderer) && Na__ElevFog__ResolveWanted() !== null;
    }
    // ------------------------------------------------------------


    // FUNCTION | Release Everything This Module Allocated
    // ------------------------------------------------------------
    // The quads' shared triangle is left alone on purpose: every ShaderPass in
    // the app draws with it, and freeing it would have the live pipeline upload
    // it again on its next frame for nothing.
    // ------------------------------------------------------------
    function Na__ElevFog__Dispose() {
        if (Na__ElevFog__DepthTarget) {
            if (Na__ElevFog__DepthTarget.depthTexture) Na__ElevFog__DepthTarget.depthTexture.dispose();
            Na__ElevFog__DepthTarget.dispose();
        }
        if (Na__ElevFog__OverQuad)  Na__ElevFog__OverQuad.material.dispose();
        if (Na__ElevFog__LayerQuad) Na__ElevFog__LayerQuad.material.dispose();

        Na__ElevFog__DepthTarget = null;
        Na__ElevFog__Uniforms    = null;
        Na__ElevFog__OverQuad    = null;
        Na__ElevFog__LayerQuad   = null;
        Na__ElevFog__Source      = null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API - Drawing
// -----------------------------------------------------------------------------

    // FUNCTION | Lay the Fog Over the Drawing Already on the Target
    // ------------------------------------------------------------
    // CALLED AFTER THE SILHOUETTE OVERLAY AND BEFORE THE CUT FILLS. After, so
    // the inked outlines fade with everything else; before, so a poche is never
    // touched - it lies ON the plane, and the plane is in front of any fog.
    //
    // Returns true when it drew. With no fog to draw it costs one null check.
    // ------------------------------------------------------------
    function Na__ElevFog__RenderOverlay(camera) {
        if (!Na__ElevFog__Renderer || !Na__ElevFog__Source || !camera) return false;
        return Na__ElevFog__Draw(camera, Na__ElevFog__MODE_OVER_PICTURE);
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Fog Alone, as One Frame of a Transparent Image
    // ------------------------------------------------------------
    // The frame routine a tiled render is handed for a sheet viewport's fog
    // layer. The bound target is cleared to nothing and the fog written
    // premultiplied, so the tiles assemble into a PNG whose alpha IS the fog -
    // which a sheet lays over its linework and a PDF over its vectors.
    // ------------------------------------------------------------
    function Na__ElevFog__RenderLayerFrame(camera) {
        if (!Na__ElevFog__Renderer || !camera) return false;
        return Na__ElevFog__Draw(camera, Na__ElevFog__MODE_OWN_LAYER);
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Elevation Depth Fog Render Layer API
    // ------------------------------------------------------------
    export {
        Na__ElevFog__Initialise,
        Na__ElevFog__SetSource,
        Na__ElevFog__GetSource,
        Na__ElevFog__IsWanted,
        Na__ElevFog__RenderOverlay,
        Na__ElevFog__RenderLayerFrame,
        Na__ElevFog__Dispose
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
