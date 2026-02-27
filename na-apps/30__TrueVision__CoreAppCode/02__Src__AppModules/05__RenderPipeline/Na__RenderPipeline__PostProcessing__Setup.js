// -----------------------------------------------------------------------------
// REGION | Render Pipeline - Post Processing Setup
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


    // FUNCTION | Setup Post Processing Composer
    // ------------------------------------------------------------
    function Na__RenderPipeline__SetupComposer(renderer, scene, camera, profileLinesConfig, fogPass) {
        const pixelRatio = renderer.getPixelRatio();
        const width      = window.innerWidth * pixelRatio;
        const height     = window.innerHeight * pixelRatio;

        const depthTexture = new THREE.DepthTexture(width, height); // <-- Required for fog pass depth reads
        depthTexture.type  = THREE.FloatType;

        const renderTarget = new THREE.WebGLRenderTarget(width, height, {
            minFilter    : THREE.LinearFilter,
            magFilter    : THREE.LinearFilter,
            format       : THREE.RGBAFormat,
            type         : THREE.HalfFloatType,
            samples      : 4,
            depthTexture : depthTexture
        });
        
        const composer = new EffectComposer(renderer, renderTarget);
        composer.addPass(new RenderPass(scene, camera));
        
        let renderProfileNormals = () => {};
        let setProfileLinesSize = () => {};
        
        const profileLinesEnabled = profileLinesConfig
            && profileLinesConfig.RenderEffect__ProfileLines__Enabled === true;
        if (profileLinesEnabled) {
            const profileLines = Na__RenderEffect__ProfileLines__Create(renderer, scene, camera, profileLinesConfig, window.innerWidth, window.innerHeight);
            composer.addPass(profileLines.pass);
            renderProfileNormals = profileLines.renderProfileNormals;
            setProfileLinesSize = profileLines.setSize;
        }

        // FOG PASS | Inserted after profile lines, before FXAA
        if (fogPass) {
            fogPass.uniforms['tDepth'].value = depthTexture; // <-- Wire depth texture into fog shader
            composer.addPass(fogPass);
        }
        
        const fxaaPass = new ShaderPass(FXAAShader);
        fxaaPass.material.uniforms['resolution'].value.x = 1 / (window.innerWidth * pixelRatio);
        fxaaPass.material.uniforms['resolution'].value.y = 1 / (window.innerHeight * pixelRatio);
        composer.addPass(fxaaPass);
        
        return {
            composer,
            renderProfileNormals,
            setProfileLinesSize,
            depthTexture
        };
    }
    // ------------------------------------------------------------


    // MODULE EXPORTS | Render Pipeline API
    // ------------------------------------------------------------
    export {
        Na__RenderPipeline__SetupComposer
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
