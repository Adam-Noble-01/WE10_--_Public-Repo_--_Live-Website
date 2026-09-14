// -----------------------------------------------------------------------------
// REGION | Render Effect - Profile Lines (Silhouette / Normal Edge Detection)
// -----------------------------------------------------------------------------
//
// SketchUp-style profile lines: extra visible edges around rounded/cylindrical
// geometry by detecting normal discontinuities and compositing dark lines over
// the scene. Normal buffer is rendered with MeshNormalMaterial override; line
// geometry (LineSegments2) is hidden during that pass to avoid artifacts.
//
// endregion -------------------------------------------------------------------

    // MODULE IMPORTS | Three.js
    // ------------------------------------------------------------
    import * as THREE from 'three';
    import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
    // ------------------------------------------------------------


    // MODULE CONSTANTS | Default Config When Not Provided
    // ------------------------------------------------------------
    const PROFILE_LINES__DEFAULT_EDGE_COLOR            = 3355443;   // <-- Dark grey (0x333333)
    const PROFILE_LINES__DEFAULT_EDGE_THRESHOLD_NORMAL = 0.3;       // <-- Normal gradient sensitivity
    const PROFILE_LINES__DEFAULT_EDGE_THRESHOLD_DEPTH   = 0.002;     // <-- Depth discontinuity (reserved)
    const PROFILE_LINES__DEFAULT_EDGE_WIDTH             = 1.0;       // <-- Line thickness in pixels
    // ------------------------------------------------------------


    // HELPER FUNCTION | Collect Line Objects for Normal-Pass Visibility Toggle
    // ---------------------------------------------------------------
    function collectLineObjects(scene) {
        const lineObjects = [];
        scene.traverseVisible((obj) => {
            if (obj.isLine2 || obj.isLineSegments2) {
                lineObjects.push(obj);
            }
        });
        return lineObjects;
    }
    // ---------------------------------------------------------------


    // HELPER FUNCTION | Integer Color to Three.js Color
    // ---------------------------------------------------------------
    function intColorToThree(intColor) {
        const r = ((intColor >> 16) & 255) / 255;
        const g = ((intColor >> 8) & 255) / 255;
        const b = (intColor & 255) / 255;
        return new THREE.Color(r, g, b);
    }
    // ---------------------------------------------------------------


    // SUB FUNCTION | Build Profile Lines Shader (Sobel on Normals)
    // ---------------------------------------------------------------
    function buildProfileLinesShader(config) {
        const edgeColor = intColorToThree(
            Number.isFinite(config.RenderEffect__ProfileLines__EdgeColor)
                ? config.RenderEffect__ProfileLines__EdgeColor
                : PROFILE_LINES__DEFAULT_EDGE_COLOR
        );
        const edgeThresholdNormal = Number.isFinite(config.RenderEffect__ProfileLines__EdgeThresholdNormal)
            ? config.RenderEffect__ProfileLines__EdgeThresholdNormal
            : PROFILE_LINES__DEFAULT_EDGE_THRESHOLD_NORMAL;
        const edgeWidth = Number.isFinite(config.RenderEffect__ProfileLines__EdgeWidth)
            ? config.RenderEffect__ProfileLines__EdgeWidth
            : PROFILE_LINES__DEFAULT_EDGE_WIDTH;

        return {
            uniforms: {
                tDiffuse:  { value: null },
                tNormal:   { value: null },
                resolution: { value: new THREE.Vector2(1, 1) },
                u_edgeColor: { value: edgeColor },
                u_edgeThresholdNormal: { value: edgeThresholdNormal },
                u_edgeWidth: { value: edgeWidth }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform sampler2D tNormal;
                uniform vec2 resolution;
                uniform vec3 u_edgeColor;
                uniform float u_edgeThresholdNormal;
                uniform float u_edgeWidth;

                varying vec2 vUv;

                void main() {
                    vec2 invRes = 1.0 / resolution;
                    float stepX = invRes.x * u_edgeWidth;
                    float stepY = invRes.y * u_edgeWidth;

                    vec3 nC  = texture2D(tNormal, vUv).rgb;
                    vec3 nL  = texture2D(tNormal, vUv - vec2(stepX, 0.0)).rgb;
                    vec3 nR  = texture2D(tNormal, vUv + vec2(stepX, 0.0)).rgb;
                    vec3 nD  = texture2D(tNormal, vUv - vec2(0.0, stepY)).rgb;
                    vec3 nU  = texture2D(tNormal, vUv + vec2(0.0, stepY)).rgb;

                    float gx = length(nR - nL);
                    float gy = length(nU - nD);
                    float edge = sqrt(gx * gx + gy * gy);

                    vec4 sceneColor = texture2D(tDiffuse, vUv);
                    if (edge > u_edgeThresholdNormal) {
                        gl_FragColor = vec4(u_edgeColor, 1.0);
                    } else {
                        gl_FragColor = sceneColor;
                    }
                }
            `
        };
    }
    // ---------------------------------------------------------------


    // FUNCTION | Create Normal Render Target and Profile Lines Pass
    // ------------------------------------------------------------
    function Na__RenderEffect__ProfileLines__Create(renderer, scene, camera, config, width, height) {
        const pixelRatio = renderer.getPixelRatio();
        const w = (width || window.innerWidth) * pixelRatio;
        const h = (height || window.innerHeight) * pixelRatio;

        const normalRenderTarget = new THREE.WebGLRenderTarget(w, h, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
            depthBuffer: true,
            stencilBuffer: false
        });
        normalRenderTarget.texture.name = 'ProfileLines_NormalBuffer';

        const normalMaterial = new THREE.MeshNormalMaterial();
        const shaderConfig = {
            RenderEffect__ProfileLines__EdgeColor:            config.RenderEffect__ProfileLines__EdgeColor,
            RenderEffect__ProfileLines__EdgeThresholdNormal: config.RenderEffect__ProfileLines__EdgeThresholdNormal,
            RenderEffect__ProfileLines__EdgeThresholdDepth:   config.RenderEffect__ProfileLines__EdgeThresholdDepth,
            RenderEffect__ProfileLines__EdgeWidth:            config.RenderEffect__ProfileLines__EdgeWidth
        };
        const profileLinesShader = buildProfileLinesShader(shaderConfig);
        const profileLinesPass = new ShaderPass(profileLinesShader);
        profileLinesPass.material.uniforms.tNormal.value = normalRenderTarget.texture;

        function setSize(nw, nh) {
            const nwPx = nw * pixelRatio;
            const nhPx = nh * pixelRatio;
            normalRenderTarget.setSize(nwPx, nhPx);
            profileLinesPass.material.uniforms.resolution.value.set(nwPx, nhPx);
        }
        setSize(width || window.innerWidth, height || window.innerHeight);

        function renderProfileNormals() {
            const lineObjects = collectLineObjects(scene);
            lineObjects.forEach((obj) => { obj.visible = false; });

            const overrideMaterial = scene.overrideMaterial;
            const clearColor = renderer.getClearColor(new THREE.Color());
            const clearAlpha = renderer.getClearAlpha();
            renderer.setClearColor(0.5, 0.5, 1.0, 1.0);   // <-- View-space forward normal so background is uniform

            scene.overrideMaterial = normalMaterial;
            renderer.setRenderTarget(normalRenderTarget);
            renderer.clear();
            renderer.render(scene, camera);
            renderer.setRenderTarget(null);
            scene.overrideMaterial = overrideMaterial;

            renderer.setClearColor(clearColor, clearAlpha);
            lineObjects.forEach((obj) => { obj.visible = true; });
        }

        return {
            pass: profileLinesPass,
            normalRenderTarget,
            setSize,
            renderProfileNormals
        };
    }
    // ------------------------------------------------------------


    // MODULE EXPORTS | Profile Lines API
    // ------------------------------------------------------------
    export {
        Na__RenderEffect__ProfileLines__Create
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
