// =============================================================================
// TRUEVISION3D - RENDER PIPELINE - POST PROCESSING SETUP
// =============================================================================
//
// FILE       : Na__RenderPipeline__PostProcessing__Setup.js
// NAMESPACE  : Na__RenderPipeline
// PURPOSE    : Constructs and returns the EffectComposer post-processing
//              pipeline with all visual effect passes in the correct order.
//
// PASS ORDER (each pass reads from the previous pass's output via tDiffuse):
//
//   ┌──────────────────────────────────────────────────────────┐
//   │  1. RenderPass        – renders the scene to a colour RT │
//   │  2. Profile Lines     – architectural edge outlines      │
//   │  3. Fog               – distance-based atmospheric haze  │
//   │  4. SSAO              – screen-space ambient occlusion   │
//   │  5. AO Blur           – 5×5 gaussian to smooth AO noise  │
//   │  6. FXAA              – fast approximate anti-aliasing   │
//   └──────────────────────────────────────────────────────────┘
//
// DEPTH PRE-PASS:
// The fog and SSAO passes need a depth texture.  This texture is captured
// into a SEPARATE WebGLRenderTarget (depthPrePassTarget) which is rendered
// BEFORE the EffectComposer runs each frame.  This is critical because the
// EffectComposer ping-pongs between two internal render targets — attaching
// a DepthTexture directly to those targets causes a WebGL feedback loop:
//   GL_INVALID_OPERATION: Feedback loop formed between Framebuffer and active Texture
//
// The depth pre-pass is invoked from the render loop via renderDepthPrePass()
// and its size is kept in sync via setDepthPrePassSize() on window resize.
//
// LOGARITHMIC DEPTH:
// The renderer uses logarithmicDepthBuffer: true.  Both the fog shader and
// the SSAO shader invert the log encoding using:
//   clipW = pow(cameraFar + 1.0, storedDepth) - 1.0
//
// DEPTHWRITE / DEPTHTEST:
// All ShaderPass materials have depthWrite=false and depthTest=false.  These
// are fullscreen-quad passes that read from the colour RT; they must NOT
// interfere with the depth buffer state between passes.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Imports
// -----------------------------------------------------------------------------

    // MODULE IMPORTS | Three.js Post Processing
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
    import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
    import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
    import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
    import { Na__RenderEffect__ProfileLines__Create } from './Na__RenderEffect__ProfileLines__.js';
    // ------------------------------------------------------------

    // MODULE IMPORTS | Ambient Occlusion Effect
    // ------------------------------------------------------------
    import {
        Na__RenderEffect__AmbientOcclusion__Create,
        Na__RenderEffect__AmbientOcclusion__CreatePerformanceMonitor
    } from '../07__Scene__EnvironmentEffects/Na__RenderEffect__AmbientOcclusion__.js';
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Composer Setup
// -----------------------------------------------------------------------------

    // FUNCTION | Na__RenderPipeline__SetupComposer
    //
    // Builds the full EffectComposer pipeline and returns an object of
    // functions that the render loop and resize handler need to call:
    //
    //   composer              – the EffectComposer instance
    //   renderDepthPrePass()  – render depth-only into the pre-pass RT
    //   setDepthPrePassSize() – resize the pre-pass RT on window resize
    //   renderProfileNormals()– render normals for profile-line detection
    //   setProfileLinesSize() – resize the profile-lines RT
    //   updateAoUniforms()    – sync camera matrices into the AO shader
    //   setAoSize()           – update AO + blur resolution uniforms
    //   monitorAoFrame()      – feed delta into the perf auto-disable check
    //
    // Parameters:
    //   renderer            – the WebGLRenderer
    //   scene               – the Three.js scene
    //   camera              – the perspective camera
    //   profileLinesConfig  – AppConfig block for profile lines (or null)
    //   fogPass             – pre-built fog ShaderPass (or null)
    //   aoConfig            – AppConfig block for ambient occlusion (or null)
    // ------------------------------------------------------------
    function Na__RenderPipeline__SetupComposer(renderer, scene, camera, profileLinesConfig, fogPass, aoConfig, orbitTarget) {
        const pixelRatio = renderer.getPixelRatio();
        const width      = window.innerWidth * pixelRatio;
        const height     = window.innerHeight * pixelRatio;

        // AO-EXCLUDED LAYER SETUP
        // Materials with AoExclude: true in the library are moved to Three.js layer 1
        // during the material swap pass. Enabling layer 1 here keeps them visible in the
        // main RenderPass. Both depth pre-passes below temporarily disable layer 1 so the
        // SSAO shader never receives depth data for foliage or other AO-excluded geometry.
        camera.layers.enable(1);                                               // <-- Layer 1 = AO-excluded objects (visible in main render)

        // DEPTH PRE-PASS TARGET
        // Separate RT with a FloatType DepthTexture.  Rendered once per frame
        // BEFORE the EffectComposer to provide a clean depth texture for fog
        // and SSAO without triggering a WebGL read/write feedback loop.
        const depthPrePassTarget = new THREE.WebGLRenderTarget(width, height, {
            minFilter    : THREE.NearestFilter,
            magFilter    : THREE.NearestFilter,
            format       : THREE.RedFormat,
            type         : THREE.UnsignedByteType,
            depthTexture : new THREE.DepthTexture(width, height, THREE.FloatType)
        });

        // COLOUR RENDER TARGET
        // Used by the EffectComposer for its internal ping-pong buffers.
        // Deliberately has NO DepthTexture to avoid the feedback loop.
        const renderTarget = new THREE.WebGLRenderTarget(width, height, {
            minFilter    : THREE.LinearFilter,
            magFilter    : THREE.LinearFilter,
            format       : THREE.RGBAFormat,
            type         : THREE.HalfFloatType
        });
        
        const composer = new EffectComposer(renderer, renderTarget);

        // PASS 1 — SCENE RENDER
        composer.addPass(new RenderPass(scene, camera));

        // PASS 2 — PROFILE LINES (optional)
        let renderProfileNormals = () => {};
        let setProfileLinesSize = () => {};
        let invalidateProfileLinesCache = () => {};
        let profileLinesPassRef = null;
        let profileLinesDepthTexture = null;                               // <-- Depth texture from profile normal pass (avoids separate depth pre-pass)
        
        const profileLinesEnabled = profileLinesConfig
            && profileLinesConfig.RenderEffect__ProfileLines__Enabled === true;
        if (profileLinesEnabled) {
            const profileLines = Na__RenderEffect__ProfileLines__Create(renderer, scene, camera, profileLinesConfig, window.innerWidth, window.innerHeight, orbitTarget);
            profileLines.pass.material.depthWrite = false;
            profileLines.pass.material.depthTest  = false;
            composer.addPass(profileLines.pass);
            renderProfileNormals = profileLines.renderProfileNormals;
            setProfileLinesSize = profileLines.setSize;
            invalidateProfileLinesCache = profileLines.invalidateSceneCache;
            profileLinesPassRef = profileLines.pass;
            profileLinesDepthTexture = profileLines.depthTexture;          // <-- Normal pass already writes depth; reuse it
        }

        // DEPTH SOURCE | Use normal-pass depth when available, fall back to dedicated pre-pass
        const depthTexture = profileLinesDepthTexture || depthPrePassTarget.depthTexture;
        const needsSeparateDepthPrePass = !profileLinesDepthTexture;       // <-- Only render the extra depth pass when profile lines are off

        // Depth pre-pass render function — called from the render loop.
        // When profile lines are active, the normal pass already populates an
        // equivalent depth texture, so this becomes a no-op (saving a full scene render).
        function renderDepthPrePass() {
            if (!needsSeparateDepthPrePass) return;                        // <-- Normal pass depth is shared; skip redundant render
            camera.layers.disable(1);                                      // <-- Exclude AO-exempt meshes from depth capture
            renderer.setRenderTarget(depthPrePassTarget);
            renderer.clear();
            renderer.render(scene, camera);
            renderer.setRenderTarget(null);
            camera.layers.enable(1);                                       // <-- Restore layer 1 visibility for main render
        }

        function setDepthPrePassSize(w, h) {
            const currentPixelRatio = renderer.getPixelRatio();
            depthPrePassTarget.setSize(w * currentPixelRatio, h * currentPixelRatio);
        }

        // PASS 3 — FOG (optional)
        if (fogPass) {
            fogPass.material.depthWrite = false;
            fogPass.material.depthTest  = false;
            fogPass.uniforms['tDepth'].value = depthTexture;
            composer.addPass(fogPass);
        }

        // PASS 4 + 5 — SSAO + AO BLUR (optional)
        let updateAoUniforms = () => {};
        let setAoSize        = () => {};
        let monitorAoFrame   = () => {};
        let disableAo        = () => {};
        let enableAo         = () => {};
        let aoPassRef        = null;
        const aoEnabled = aoConfig
            && aoConfig.RenderEffect__AmbientOcclusion__Enabled === true;
        if (aoEnabled) {
            const aoState = Na__RenderEffect__AmbientOcclusion__Create(camera, aoConfig, depthTexture);

            composer.addPass(aoState.pass);      // SSAO
            composer.addPass(aoState.blurPass);   // AO Blur

            updateAoUniforms = aoState.updateUniforms;
            setAoSize        = aoState.setSize;
            disableAo        = aoState.disable;
            enableAo         = aoState.enable;
            aoPassRef        = aoState.pass;
            monitorAoFrame   = Na__RenderEffect__AmbientOcclusion__CreatePerformanceMonitor(aoState, aoConfig);
        }

        // Runtime toggle — returns the new ON/OFF state as a boolean
        function toggleAo() {
            if (!aoPassRef) return false;
            const currentlyOn = aoPassRef.enabled;
            if (currentlyOn) { disableAo(); } else { enableAo(); }
            return !currentlyOn;
        }

        // Runtime toggle — profile lines ON/OFF; returns new state
        let profileLinesRuntimeEnabled = true;
        function toggleProfileLines() {
            if (!profileLinesPassRef) return false;
            profileLinesRuntimeEnabled = !profileLinesRuntimeEnabled;
            profileLinesPassRef.enabled = profileLinesRuntimeEnabled;
            return profileLinesRuntimeEnabled;
        }

        // Wrapped renderProfileNormals that respects the runtime toggle and excludes
        // AO-exempt meshes (layer 1) from the normal/depth capture so the SSAO shader
        // does not process foliage pixels from the profile-lines depth path either.
        const originalRenderProfileNormals = renderProfileNormals;
        renderProfileNormals = () => {
            if (!profileLinesRuntimeEnabled) return;
            camera.layers.disable(1);                                      // <-- Exclude AO-exempt meshes from normals + depth capture
            originalRenderProfileNormals();
            camera.layers.enable(1);                                       // <-- Restore layer 1 visibility for main render
        };
        
        // PASS 6 — FXAA (always last)
        const fxaaPass = new ShaderPass(FXAAShader);
        fxaaPass.material.depthWrite = false;
        fxaaPass.material.depthTest  = false;
        fxaaPass.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
        fxaaPass.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
        composer.addPass(fxaaPass);

        function setFxaaSize(w, h) {
            const currentPixelRatio = renderer.getPixelRatio();
            fxaaPass.material.uniforms['resolution'].value.x = 1 / (w * currentPixelRatio);
            fxaaPass.material.uniforms['resolution'].value.y = 1 / (h * currentPixelRatio);
        }
        
        return {
            composer,
            renderDepthPrePass,
            setDepthPrePassSize,
            renderProfileNormals,
            setProfileLinesSize,
            invalidateProfileLinesCache,
            updateAoUniforms,
            setAoSize,
            monitorAoFrame,
            setFxaaSize,
            toggleAo,
            toggleProfileLines
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Render Pipeline API
    // ------------------------------------------------------------
    export {
        Na__RenderPipeline__SetupComposer
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
