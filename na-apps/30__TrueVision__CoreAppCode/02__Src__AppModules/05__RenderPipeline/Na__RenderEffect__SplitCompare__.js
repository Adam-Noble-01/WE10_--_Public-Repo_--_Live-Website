// =============================================================================
// TRUEVISION3D - RENDER EFFECT - SPLIT COMPARE
// =============================================================================
//
// FILE       : Na__RenderEffect__SplitCompare__.js
// NAMESPACE  : Na__SplitCompare
// MODULE     : Render Pipeline - Split Compare
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Draw two model roots side by side in one frame, divided at a line the reader drags
// CREATED    : 15-Nov-2026
//
// DESCRIPTION:
// - The Existing and Proposed comparison shows one design phase to the left of
//   a vertical line and another to the right, through the same camera. This
//   module is the drawing half of it: it knows two model roots and a split
//   position, and nothing about phases, buttons or loading.
// - EACH SIDE IS A WHOLE FRAME. The effect chain (the pre-passes and the
//   composer: profile lines, fog, ambient occlusion, FXAA) is run once with
//   only the left root visible and once with only the right, each into a
//   held picture, and the two pictures are joined at the line. Nothing in the
//   chain is told about the split, so neither side's edges, depth or occlusion
//   can see the other's geometry, and the join is exact to the pixel.
// - DRAGGING THE LINE COSTS ONE QUAD. While the camera and the scene stand
//   still the two held pictures are still true, so a frame asked for by the
//   line alone joins them again and runs no part of the chain. That is what
//   keeps the drag smooth on a phone: two chains only when the view changes.
// - THE HELD PICTURES ARE TRUSTED ONLY WHEN NOTHING ELSE ASKED FOR THE FRAME.
//   Any render request that is not the line's own marks them stale
//   (NoteRenderRequest), as does a camera that moved, and a frame the loop
//   calls busy (a door moving, walk or fly, the orbit's settling frames) is
//   never held. When in doubt both sides are drawn again.
// - PROGRESSIVE REFINEMENT SEES ONE PICTURE. A refinement sample runs the chain
//   with the composer writing to its buffer; this module leaves the JOINED
//   picture in that buffer, so the refiner averages the comparison exactly as
//   it averages an ordinary frame, and the parked image is as clean.
//
// INTEGRATION:
// - Na__AppFlow__LoadingSequence.js: its DrawEffectChain hands the chain to
//   Draw while a comparison is on, and RequestRenderOnce calls
//   NoteRenderRequest. The section cut overlay is drawn inside ScissorSide.
// - Na__UiFeature__PhaseCompare__.js calls Begin, SetSplit and End.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Authored in   : TrueVision3D first (15-Nov-2026)
// - ValeVision    : not yet ported.
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - Version 1.0.0 (v2.186.0)
// - Initial implementation, for the Existing and Proposed comparison.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js and the Render Loop's Invalidation
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
    import { Na__RenderLoop__RequestRender } from './Na__RenderLoop__Invalidation.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Constants
// -----------------------------------------------------------------------------

    // MODULE CONSTANTS | Sides and Shaders
    // ------------------------------------------------------------
    const Na__SplitCompare__SIDE_BEFORE = 'before';                           // <-- Left of the line
    const Na__SplitCompare__SIDE_AFTER  = 'after';                            // <-- Right of the line

    const Na__SplitCompare__VERTEX_SHADER = /* glsl */`
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
        }
    `;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module State
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Comparison
    // ------------------------------------------------------------
    let Na__SplitCompare__Active     = false;
    let Na__SplitCompare__BeforeRoot = null;          // <-- Drawn left of the line
    let Na__SplitCompare__AfterRoot  = null;          // <-- Drawn right of the line
    let Na__SplitCompare__LiveSide   = Na__SplitCompare__SIDE_AFTER;   // <-- Which of the two is the 3D view's own model root
    let Na__SplitCompare__Split      = 0.5;           // <-- The line, as a fraction of the view's width from the left
    let Na__SplitCompare__SideHook   = null;          // <-- Told which side is about to be drawn (plants, figures: whatever is one phase's alone)
    // ------------------------------------------------------------

    // MODULE VARIABLES | The Held Pictures
    // ------------------------------------------------------------
    let   Na__SplitCompare__HoldBefore  = null;       // <-- WebGLRenderTarget: the left phase's finished frame
    let   Na__SplitCompare__HoldAfter   = null;       // <-- WebGLRenderTarget: the right phase's finished frame
    let   Na__SplitCompare__HoldsFresh  = false;      // <-- True while both still show what the camera sees
    let   Na__SplitCompare__AskingForSplit = false;   // <-- True inside this module's own render request
    const Na__SplitCompare__HeldCamera  = new Float64Array(32);   // <-- matrixWorld and projectionMatrix the holds were drawn through
    // ------------------------------------------------------------

    // MODULE VARIABLES | Drawing Tools (built on first use) and Counters
    // ------------------------------------------------------------
    let Na__SplitCompare__CopyMaterial  = null;
    let Na__SplitCompare__JoinMaterial  = null;
    let Na__SplitCompare__CopyQuad      = null;
    let Na__SplitCompare__JoinQuad      = null;
    const Na__SplitCompare__Stats = { fullDraws : 0, refineDraws : 0, joinOnlyDraws : 0, lastFullDrawMs : 0 };   // <-- fullDraws: both sides drawn for an ordinary frame; refineDraws: for a refinement sample; joinOnlyDraws: the held pictures joined again
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Held Pictures
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build the Two Quads and Their Materials (once)
    // ------------------------------------------------------------
    // Both are straight copies: no blending, no depth, no colour transform. The
    // composer's buffer is copied to the canvas untouched by the pass it ends
    // with, and a held picture must reach the canvas exactly as that would.
    // ------------------------------------------------------------
    function Na__SplitCompare__EnsureTools() {
        if (Na__SplitCompare__CopyQuad) return;

        Na__SplitCompare__CopyMaterial = new THREE.ShaderMaterial({
            name           : 'Na__SplitCompare__Copy',
            uniforms       : { tSource : { value : null } },
            vertexShader   : Na__SplitCompare__VERTEX_SHADER,
            fragmentShader : /* glsl */`
                uniform sampler2D tSource;
                varying vec2      vUv;
                void main() {
                    gl_FragColor = texture2D(tSource, vUv);
                }
            `,
            blending   : THREE.NoBlending,
            depthTest  : false,
            depthWrite : false
        });

        Na__SplitCompare__JoinMaterial = new THREE.ShaderMaterial({
            name           : 'Na__SplitCompare__Join',
            uniforms       : {
                tBefore : { value : null },
                tAfter  : { value : null },
                uSplit  : { value : 0.5 }
            },
            vertexShader   : Na__SplitCompare__VERTEX_SHADER,
            fragmentShader : /* glsl */`
                uniform sampler2D tBefore;
                uniform sampler2D tAfter;
                uniform float     uSplit;
                varying vec2      vUv;
                void main() {
                    gl_FragColor = (vUv.x < uSplit) ? texture2D(tBefore, vUv) : texture2D(tAfter, vUv);
                }
            `,
            blending   : THREE.NoBlending,
            depthTest  : false,
            depthWrite : false
        });

        Na__SplitCompare__CopyQuad = new FullScreenQuad(Na__SplitCompare__CopyMaterial);
        Na__SplitCompare__JoinQuad = new FullScreenQuad(Na__SplitCompare__JoinMaterial);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | One Held Picture the Size of the Composer's Buffer
    // ------------------------------------------------------------
    function Na__SplitCompare__NewHold(width, height, name) {
        const target = new THREE.WebGLRenderTarget(width, height, {
            minFilter     : THREE.NearestFilter,                              // <-- Pixel for pixel: the holds are never scaled
            magFilter     : THREE.NearestFilter,
            format        : THREE.RGBAFormat,
            type          : THREE.HalfFloatType,                              // <-- As the composer's own buffers
            depthBuffer   : false,
            stencilBuffer : false
        });
        target.texture.name = name;
        return target;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Make the Holds Match the Composer (false when they cannot)
    // ------------------------------------------------------------
    // The composer's buffer is rebuilt on every resize, and its size can be
    // fractional under browser zoom, so it is floored exactly as the
    // progressive refiner floors it.
    // ------------------------------------------------------------
    function Na__SplitCompare__EnsureHolds(composer) {
        const buffer = composer ? composer.readBuffer : null;
        if (!buffer || !(buffer.width > 0) || !(buffer.height > 0)) return false;

        const width  = Math.max(1, Math.floor(buffer.width));
        const height = Math.max(1, Math.floor(buffer.height));

        if (Na__SplitCompare__HoldBefore && Na__SplitCompare__HoldBefore.width === width && Na__SplitCompare__HoldBefore.height === height) return true;

        Na__SplitCompare__DisposeHolds();
        Na__SplitCompare__HoldBefore = Na__SplitCompare__NewHold(width, height, 'Na__SplitCompare__Before');
        Na__SplitCompare__HoldAfter  = Na__SplitCompare__NewHold(width, height, 'Na__SplitCompare__After');
        return true;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Give the Held Pictures Back
    // ------------------------------------------------------------
    function Na__SplitCompare__DisposeHolds() {
        if (Na__SplitCompare__HoldBefore) Na__SplitCompare__HoldBefore.dispose();
        if (Na__SplitCompare__HoldAfter)  Na__SplitCompare__HoldAfter.dispose();
        Na__SplitCompare__HoldBefore = null;
        Na__SplitCompare__HoldAfter  = null;
        Na__SplitCompare__HoldsFresh = false;
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Has the Camera Moved Since the Holds Were Drawn?
    // ------------------------------------------------------------
    function Na__SplitCompare__CameraMatchesHolds(camera) {
        const world      = camera.matrixWorld.elements;
        const projection = camera.projectionMatrix.elements;
        for (let i = 0; i < 16; i++) {
            if (Na__SplitCompare__HeldCamera[i] !== world[i]) return false;
            if (Na__SplitCompare__HeldCamera[16 + i] !== projection[i]) return false;
        }
        return true;
    }
    function Na__SplitCompare__RememberCamera(camera) {
        const world      = camera.matrixWorld.elements;
        const projection = camera.projectionMatrix.elements;
        for (let i = 0; i < 16; i++) {
            Na__SplitCompare__HeldCamera[i]      = world[i];
            Na__SplitCompare__HeldCamera[16 + i] = projection[i];
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Drawing
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Show One Side's Root and Hide the Other's
    // ------------------------------------------------------------
    // liveVisible is the 3D view's own model root's visibility as the frame
    // found it: this module never makes that root visible when something else
    // had hidden it.
    // ------------------------------------------------------------
    function Na__SplitCompare__ShowSide(side, liveVisible) {
        const before = Na__SplitCompare__BeforeRoot;
        const after  = Na__SplitCompare__AfterRoot;
        const beforeIsLive = Na__SplitCompare__LiveSide === Na__SplitCompare__SIDE_BEFORE;

        if (side === Na__SplitCompare__SIDE_BEFORE) {
            before.visible = beforeIsLive ? liveVisible : true;
            after.visible  = false;
        } else {
            after.visible  = beforeIsLive ? true : liveVisible;
            before.visible = false;
        }
        if (typeof Na__SplitCompare__SideHook === 'function') {
            try { Na__SplitCompare__SideHook(side); } catch (error) { console.warn('[TrueVision3D] Comparison side hook failed:', error); }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Leave the Scene as an Ordinary Frame Expects It
    // ------------------------------------------------------------
    // The 3D view's own root as it was found, the other root hidden: every
    // other render path (a still, a thumbnail, a sheet's picture) then sees
    // the model it always saw.
    // ------------------------------------------------------------
    function Na__SplitCompare__RestoreSides(liveVisible) {
        const beforeIsLive = Na__SplitCompare__LiveSide === Na__SplitCompare__SIDE_BEFORE;
        if (Na__SplitCompare__BeforeRoot) Na__SplitCompare__BeforeRoot.visible = beforeIsLive ? liveVisible : false;
        if (Na__SplitCompare__AfterRoot)  Na__SplitCompare__AfterRoot.visible  = beforeIsLive ? false : liveVisible;
        if (typeof Na__SplitCompare__SideHook === 'function') {
            try { Na__SplitCompare__SideHook(null); } catch (error) { console.warn('[TrueVision3D] Comparison side hook failed:', error); }
        }
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Copy a Texture Into a Held Picture
    // ------------------------------------------------------------
    function Na__SplitCompare__CopyInto(renderer, texture, hold) {
        Na__SplitCompare__CopyMaterial.uniforms.tSource.value = texture;
        renderer.setRenderTarget(hold);
        Na__SplitCompare__CopyQuad.render(renderer);
        Na__SplitCompare__CopyMaterial.uniforms.tSource.value = null;         // <-- Drop the reference to the composer's buffer
    }
    // ------------------------------------------------------------


    // FUNCTION | Draw the Comparison in Place of the Effect Chain
    // ------------------------------------------------------------
    // context:
    //   renderer   {THREE.WebGLRenderer}
    //   composer   {EffectComposer}     The live composer
    //   camera     {THREE.Camera}       The camera the chain draws through
    //   drawChain  {function}           The ordinary chain: the pre-passes and composer.render()
    //   cacheable  {boolean}            False for a frame the loop calls busy
    //
    // Where the result goes follows composer.renderToScreen, exactly as the
    // chain's own would: the canvas for an ordinary frame, the composer's read
    // buffer for a refinement sample. Returns false, having drawn nothing,
    // when the comparison cannot be drawn; the caller then runs the chain.
    // ------------------------------------------------------------
    function Na__SplitCompare__Draw(context) {
        const { renderer, composer, camera, drawChain } = context || {};
        if (!Na__SplitCompare__Active || !renderer || !composer || !camera || typeof drawChain !== 'function') return false;
        if (!Na__SplitCompare__BeforeRoot || !Na__SplitCompare__AfterRoot) return false;

        Na__SplitCompare__EnsureTools();
        if (!Na__SplitCompare__EnsureHolds(composer)) return false;

        const toScreen    = composer.renderToScreen;
        const cacheable   = toScreen && context.cacheable !== false;
        const savedTarget = renderer.getRenderTarget();

        const reusable = cacheable && Na__SplitCompare__HoldsFresh && Na__SplitCompare__CameraMatchesHolds(camera);
        if (!reusable) {
            const started     = performance.now();
            const liveRoot    = (Na__SplitCompare__LiveSide === Na__SplitCompare__SIDE_BEFORE) ? Na__SplitCompare__BeforeRoot : Na__SplitCompare__AfterRoot;
            const liveVisible = liveRoot.visible;

            composer.renderToScreen = false;                                  // <-- Each side lands in the composer's read buffer
            try {
                Na__SplitCompare__ShowSide(Na__SplitCompare__SIDE_BEFORE, liveVisible);
                drawChain();
                Na__SplitCompare__CopyInto(renderer, composer.readBuffer.texture, Na__SplitCompare__HoldBefore);

                Na__SplitCompare__ShowSide(Na__SplitCompare__SIDE_AFTER, liveVisible);
                drawChain();
                Na__SplitCompare__CopyInto(renderer, composer.readBuffer.texture, Na__SplitCompare__HoldAfter);
            } finally {
                composer.renderToScreen = toScreen;
                Na__SplitCompare__RestoreSides(liveVisible);
                renderer.setRenderTarget(savedTarget);
            }

            Na__SplitCompare__HoldsFresh = cacheable;                         // <-- A refinement sample is jittered and a busy frame is about to change: neither is kept
            if (cacheable) Na__SplitCompare__RememberCamera(camera);
            if (toScreen) Na__SplitCompare__Stats.fullDraws++;
            else          Na__SplitCompare__Stats.refineDraws++;
            Na__SplitCompare__Stats.lastFullDrawMs = Math.round((performance.now() - started) * 10) / 10;
        } else {
            Na__SplitCompare__Stats.joinOnlyDraws++;
        }

        // THE JOIN | Left of the line from one picture, right of it from the other
        Na__SplitCompare__JoinMaterial.uniforms.tBefore.value = Na__SplitCompare__HoldBefore.texture;
        Na__SplitCompare__JoinMaterial.uniforms.tAfter.value  = Na__SplitCompare__HoldAfter.texture;
        Na__SplitCompare__JoinMaterial.uniforms.uSplit.value  = Na__SplitCompare__Split;
        renderer.setRenderTarget(toScreen ? null : composer.readBuffer);      // <-- A refinement sample is read from the composer's buffer
        Na__SplitCompare__JoinQuad.render(renderer);
        renderer.setRenderTarget(savedTarget);
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Run a Draw Confined to One Side of the Line
    // ------------------------------------------------------------
    // For what is drawn straight onto the finished canvas and belongs to one
    // phase only: the section cut fills are the 3D view's own model's. With no
    // comparison on, draw runs unconfined.
    // ------------------------------------------------------------
    function Na__SplitCompare__ScissorSide(renderer, side, draw) {
        if (typeof draw !== 'function') return;
        if (!Na__SplitCompare__Active || !renderer) { draw(); return; }

        const size   = renderer.getSize(new THREE.Vector2());                 // <-- CSS pixels: setScissor scales by the pixel ratio itself
        const lineX  = Math.round(size.x * Na__SplitCompare__Split);
        const isLeft = side === Na__SplitCompare__SIDE_BEFORE;
        const x      = isLeft ? 0 : lineX;
        const width  = isLeft ? lineX : Math.max(0, size.x - lineX);
        if (width <= 0) return;                                                // <-- That side has no pixels: nothing to draw

        const savedScissor = renderer.getScissor(new THREE.Vector4());
        const savedTest    = renderer.getScissorTest();
        renderer.setScissor(x, 0, width, size.y);
        renderer.setScissorTest(true);
        try {
            draw();
        } finally {
            renderer.setScissor(savedScissor);
            renderer.setScissorTest(savedTest);
        }
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Start Comparing Two Model Roots
    // ------------------------------------------------------------
    // options:
    //   beforeRoot  {THREE.Object3D}  Drawn left of the line
    //   afterRoot   {THREE.Object3D}  Drawn right of the line
    //   liveSide    'before' | 'after'  Which of the two is the 3D view's own model root
    //   split       {number}          Where the line starts, 0 to 1 (default 0.5)
    //   onSide      {function}        Optional: told 'before', 'after', then null as each
    //                                 side is drawn, for whatever belongs to one phase alone
    //
    // Both roots must be in the scene. The one that is not the 3D view's is
    // hidden at once and stays hidden outside this module's own draws.
    // ------------------------------------------------------------
    function Na__SplitCompare__Begin(options) {
        const settings = options || {};
        if (!settings.beforeRoot || !settings.afterRoot || settings.beforeRoot === settings.afterRoot) return false;

        Na__SplitCompare__BeforeRoot = settings.beforeRoot;
        Na__SplitCompare__AfterRoot  = settings.afterRoot;
        Na__SplitCompare__LiveSide   = (settings.liveSide === Na__SplitCompare__SIDE_BEFORE) ? Na__SplitCompare__SIDE_BEFORE : Na__SplitCompare__SIDE_AFTER;
        Na__SplitCompare__SideHook   = (typeof settings.onSide === 'function') ? settings.onSide : null;
        Na__SplitCompare__Split      = Number.isFinite(settings.split) ? Math.min(1, Math.max(0, settings.split)) : 0.5;
        Na__SplitCompare__HoldsFresh = false;
        Na__SplitCompare__Active     = true;

        const other = (Na__SplitCompare__LiveSide === Na__SplitCompare__SIDE_BEFORE) ? Na__SplitCompare__AfterRoot : Na__SplitCompare__BeforeRoot;
        other.visible = false;

        Na__RenderLoop__RequestRender();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Stop Comparing
    // ------------------------------------------------------------
    // The root that is not the 3D view's is left hidden; the caller takes it
    // out of the scene. The held pictures are given back.
    // ------------------------------------------------------------
    function Na__SplitCompare__End() {
        if (!Na__SplitCompare__Active) return false;
        const other = (Na__SplitCompare__LiveSide === Na__SplitCompare__SIDE_BEFORE) ? Na__SplitCompare__AfterRoot : Na__SplitCompare__BeforeRoot;
        if (other) other.visible = false;

        Na__SplitCompare__Active     = false;
        Na__SplitCompare__BeforeRoot = null;
        Na__SplitCompare__AfterRoot  = null;
        Na__SplitCompare__SideHook   = null;
        Na__SplitCompare__DisposeHolds();
        Na__RenderLoop__RequestRender();
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Move the Line
    // ------------------------------------------------------------
    // fraction is the line's place across the view, 0 at the left edge to 1 at
    // the right. The frame it asks for is this module's own, so the held
    // pictures stay trusted and the frame is one quad.
    // ------------------------------------------------------------
    function Na__SplitCompare__SetSplit(fraction) {
        if (!Number.isFinite(fraction)) return false;
        const next = Math.min(1, Math.max(0, fraction));
        if (next === Na__SplitCompare__Split) return false;
        Na__SplitCompare__Split = next;
        if (!Na__SplitCompare__Active) return true;

        Na__SplitCompare__AskingForSplit = true;
        try {
            Na__RenderLoop__RequestRender();
        } finally {
            Na__SplitCompare__AskingForSplit = false;
        }
        return true;
    }
    // ------------------------------------------------------------


    // FUNCTION | A Render Was Asked For
    // ------------------------------------------------------------
    // Called by the render loop on every request. Unless the request is this
    // module's own (the line moved), something about the picture has changed
    // and both sides must be drawn again.
    // ------------------------------------------------------------
    function Na__SplitCompare__NoteRenderRequest() {
        if (!Na__SplitCompare__AskingForSplit) Na__SplitCompare__HoldsFresh = false;
    }
    // ------------------------------------------------------------


    // FUNCTION | Readers
    // ------------------------------------------------------------
    function Na__SplitCompare__IsActive() { return Na__SplitCompare__Active; }
    function Na__SplitCompare__GetSplit() { return Na__SplitCompare__Split; }
    function Na__SplitCompare__GetLiveSide() { return Na__SplitCompare__LiveSide; }
    function Na__SplitCompare__GetStats() {
        return {
            active         : Na__SplitCompare__Active,
            split          : Na__SplitCompare__Split,
            liveSide       : Na__SplitCompare__LiveSide,
            holdsFresh     : Na__SplitCompare__HoldsFresh,
            holdSize       : Na__SplitCompare__HoldBefore ? [ Na__SplitCompare__HoldBefore.width, Na__SplitCompare__HoldBefore.height ] : null,
            fullDraws      : Na__SplitCompare__Stats.fullDraws,
            refineDraws    : Na__SplitCompare__Stats.refineDraws,
            joinOnlyDraws  : Na__SplitCompare__Stats.joinOnlyDraws,
            lastFullDrawMs : Na__SplitCompare__Stats.lastFullDrawMs
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Split Compare API
    // ------------------------------------------------------------
    export {
        Na__SplitCompare__SIDE_BEFORE,
        Na__SplitCompare__SIDE_AFTER,
        Na__SplitCompare__Begin,
        Na__SplitCompare__End,
        Na__SplitCompare__SetSplit,
        Na__SplitCompare__GetSplit,
        Na__SplitCompare__GetLiveSide,
        Na__SplitCompare__IsActive,
        Na__SplitCompare__NoteRenderRequest,
        Na__SplitCompare__Draw,
        Na__SplitCompare__ScissorSide,
        Na__SplitCompare__GetStats
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
