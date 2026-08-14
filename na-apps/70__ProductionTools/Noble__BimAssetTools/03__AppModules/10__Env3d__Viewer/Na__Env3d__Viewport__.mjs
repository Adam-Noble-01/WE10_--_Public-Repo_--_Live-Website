/* =============================================================================
   NOBLE BIM ASSET TOOLS | 3D ENVIRONMENT - VIEWPORT
   =============================================================================

   FILE       : Na__Env3d__Viewport__.mjs
   NAMESPACE  : Na__BimAssetTools
   MODULE     : Env3d - Viewport
   AUTHOR     : Adam Noble - Noble Architecture
   PURPOSE    : Render, light and navigate the loaded asset for visual inspection
   CREATED    : 14-Aug-2026

   DESCRIPTION:
   - A deliberately plain inspection viewport. This is not a presentation renderer;
     it exists so a component can be judged, which means neutral lighting, an
     honest grid at a known spacing, and display modes that expose defects rather
     than flatter the model.
   - The scene works in millimetres, matching the rest of the application, so the
     camera near and far planes are set in millimetres too.

   ---------------------------------------------------------------------------

   WHY BACK FACES ARE RENDERED RED:

   In shaded mode the material is single sided and the back face colour is a
   distinct red. A face wound the wrong way therefore shows as an obvious red
   patch rather than quietly shading a little darker. That matters because a
   reversed face imports into SketchUp as a blue back face that has to be found
   and corrected one at a time, and it is far cheaper to reject the asset here.

   ============================================================================= */

import * as THREE              from 'three';
import { OrbitControls }       from 'three/addons/controls/OrbitControls.js';
import { GetConfig }           from '../01__AppCore/Na__AppCore__AppState__.mjs';

// =============================================================================
// REGION | Module State
// =============================================================================

    // MODULE STATE | Renderer, Scene and Camera
    // ------------------------------------------------------------
    let RENDERER        =  null;
    let SCENE           =  null;
    let CAMERA          =  null;
    let CONTROLS        =  null;
    let ASSET_ROOT      =  null;                                                 // <-- Group holding whatever asset is on display
    let GRID            =  null;
    let BACK_FACE_MESH  =  null;                                                 // <-- Second pass that paints reversed faces red
    let ANIMATION_HANDLE=  null;
    let RESIZE_OBSERVER =  null;
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Scene Construction
// =============================================================================

// -----------------------------------------------------------------------------
// REGION | Lighting
// -----------------------------------------------------------------------------

    // HELPER FUNCTION | Build a Neutral Three-Point Lighting Rig
    // ------------------------------------------------------------
    // Neutral and slightly flat on purpose. Dramatic lighting hides exactly the
    // surface defects this viewport is meant to reveal.
    function Na__Env3d__BuildLighting(scene) {
        scene.add(new THREE.AmbientLight(0xffffff, 0.55));

        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(1, 2, 1.5).normalize();
        scene.add(key);

        const fill = new THREE.DirectionalLight(0xffffff, 0.5);
        fill.position.set(-1.5, 0.6, -1).normalize();
        scene.add(fill);

        const under = new THREE.DirectionalLight(0xffffff, 0.25);                // <-- Stops the underside going pure black
        under.position.set(0, -1, 0).normalize();
        scene.add(under);
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Build the Reference Grid
    // ------------------------------------------------------------
    function Na__Env3d__BuildGrid(config) {
        const spacing   =  config.viewer.gridSpacingMm;
        const extent    =  config.viewer.gridExtentMm;
        const divisions =  Math.max(2, Math.round(extent / spacing));

        const grid = new THREE.GridHelper(
            extent,
            divisions,
            new THREE.Color(config.viewer.gridMajorColour),
            new THREE.Color(config.viewer.gridColour)
        );

        grid.material.transparent = true;
        grid.material.opacity     = 0.65;
        grid.name                 = 'Na__ReferenceGrid';
        return grid;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Mount and Teardown
// -----------------------------------------------------------------------------

    // FUNCTION | Create the Renderer and Attach It to a Host Element
    // ------------------------------------------------------------
    export function MountViewport(hostElement) {
        const config = GetConfig();

        RENDERER = new THREE.WebGLRenderer({ antialias : true, preserveDrawingBuffer : true });
        RENDERER.setPixelRatio(Math.min(window.devicePixelRatio, 2));            // <-- Capped; beyond 2 costs fill rate for no visible gain
        RENDERER.setSize(hostElement.clientWidth || 800, hostElement.clientHeight || 600);
        RENDERER.outputColorSpace = THREE.SRGBColorSpace;
        hostElement.appendChild(RENDERER.domElement);

        SCENE = new THREE.Scene();
        SCENE.background = new THREE.Color(config.viewer.backgroundColour);

        CAMERA = new THREE.PerspectiveCamera(
            config.viewer.cameraFovDegrees,
            (hostElement.clientWidth || 800) / (hostElement.clientHeight || 600),
            config.viewer.cameraNearMm,
            config.viewer.cameraFarMm
        );
        CAMERA.position.set(2000, 1500, 2500);

        CONTROLS = new OrbitControls(CAMERA, RENDERER.domElement);
        CONTROLS.enableDamping  = true;
        CONTROLS.dampingFactor  = 0.08;
        CONTROLS.screenSpacePanning = true;                                      // <-- Pans in the view plane, which reads as expected for inspection

        Na__Env3d__BuildLighting(SCENE);

        GRID = Na__Env3d__BuildGrid(config);
        SCENE.add(GRID);

        ASSET_ROOT = new THREE.Group();
        ASSET_ROOT.name = 'Na__AssetRoot';
        SCENE.add(ASSET_ROOT);

        // -- Keep the drawing buffer matched to the host element's real size.
        RESIZE_OBSERVER = new ResizeObserver(function Na__Env3d__OnResize() {
            const width  = hostElement.clientWidth;
            const height = hostElement.clientHeight;
            if (width === 0 || height === 0) return;

            CAMERA.aspect = width / height;
            CAMERA.updateProjectionMatrix();
            RENDERER.setSize(width, height);
        });
        RESIZE_OBSERVER.observe(hostElement);

        Na__Env3d__StartRenderLoop();
        return { renderer : RENDERER, scene : SCENE, camera : CAMERA, controls : CONTROLS };
    }
    // ------------------------------------------------------------


    // HELPER FUNCTION | Drive the Render Loop
    // ------------------------------------------------------------
    function Na__Env3d__StartRenderLoop() {
        function Na__Env3d__Frame() {
            ANIMATION_HANDLE = requestAnimationFrame(Na__Env3d__Frame);
            if (CONTROLS) CONTROLS.update();
            if (RENDERER && SCENE && CAMERA) RENDERER.render(SCENE, CAMERA);
        }
        Na__Env3d__Frame();
    }
    // ------------------------------------------------------------


    // FUNCTION | Tear the Viewport Down and Release GPU Resources
    // ------------------------------------------------------------
    export function UnmountViewport() {
        if (ANIMATION_HANDLE) cancelAnimationFrame(ANIMATION_HANDLE);
        if (RESIZE_OBSERVER)  RESIZE_OBSERVER.disconnect();
        if (CONTROLS)         CONTROLS.dispose();
        if (RENDERER) {
            RENDERER.dispose();
            if (RENDERER.domElement.parentNode) RENDERER.domElement.parentNode.removeChild(RENDERER.domElement);
        }

        RENDERER = SCENE = CAMERA = CONTROLS = ASSET_ROOT = GRID = null;
        ANIMATION_HANDLE = RESIZE_OBSERVER = null;
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------

// endregion -------------------------------------------------------------------


// =============================================================================
// REGION | Asset Display
// =============================================================================

    // FUNCTION | Replace the Displayed Asset
    // ------------------------------------------------------------
    // The asset's own Object3D is added directly rather than cloned, so the audit
    // and the exporter measure exactly what is on screen. Removal therefore does
    // NOT dispose it; that is the asset register's responsibility.
    export function ShowAsset(object3d) {
        if (!ASSET_ROOT) return;

        ASSET_ROOT.clear();
        if (BACK_FACE_MESH) { BACK_FACE_MESH = null; }

        if (object3d) {
            ASSET_ROOT.add(object3d);
            FrameAsset(object3d);
        }
    }
    // ------------------------------------------------------------


    // FUNCTION | Frame the Camera on an Object
    // ------------------------------------------------------------
    export function FrameAsset(object3d) {
        if (!object3d || !CAMERA || !CONTROLS) return;

        const config =  GetConfig();
        const box    =  new THREE.Box3().setFromObject(object3d);
        if (box.isEmpty()) return;

        const size   =  new THREE.Vector3(); box.getSize(size);
        const centre =  new THREE.Vector3(); box.getCenter(centre);
        const radius =  Math.max(size.x, size.y, size.z) * 0.5 || 1000;

        // -- Distance that fits the bounding sphere in the vertical field of view.
        const fovRadians =  THREE.MathUtils.degToRad(CAMERA.fov);
        const distance   =  (radius / Math.sin(fovRadians / 2)) * config.viewer.frameOnLoadPadding;

        // -- Approach from a three-quarter view; a straight-on axis view hides
        // -- depth and is a poor first look at an unfamiliar component.
        const direction = new THREE.Vector3(1, 0.65, 1).normalize();
        CAMERA.position.copy(centre).addScaledVector(direction, distance);
        CAMERA.near = Math.max(1, distance / 1000);
        CAMERA.far  = distance * 100;
        CAMERA.updateProjectionMatrix();

        CONTROLS.target.copy(centre);
        CONTROLS.update();
    }
    // ------------------------------------------------------------


    // FUNCTION | Apply a Display Mode to the Current Asset
    // ------------------------------------------------------------
    export function ApplyDisplayMode(mode) {
        if (!ASSET_ROOT) return;
        const config = GetConfig();

        ASSET_ROOT.traverse(function Na__Env3d__SetMode(node) {
            if (!node.isMesh || !node.material) return;

            const materials = Array.isArray(node.material) ? node.material : [node.material];
            for (const material of materials) {
                // -- Cache the material's authored state on first touch so every
                // -- mode can be left again without cumulative drift.
                if (!material.userData.naOriginal) {
                    material.userData.naOriginal = {
                        wireframe : material.wireframe,
                        side      : material.side,
                        opacity   : material.opacity,
                        transparent: material.transparent,
                        flatShading: material.flatShading
                    };
                }
                const original = material.userData.naOriginal;

                material.wireframe   = (mode === 'wireframe');
                material.side        = (mode === 'xray') ? THREE.DoubleSide : original.side;
                material.transparent = (mode === 'xray') ? true : original.transparent;
                material.opacity     = (mode === 'xray') ? 0.35 : original.opacity;
                material.flatShading = (mode === 'normals');
                material.needsUpdate = true;
            }
        });

        if (GRID) GRID.visible = (mode !== 'xray');
    }
    // ------------------------------------------------------------


    // FUNCTION | Toggle Grid Visibility
    // ------------------------------------------------------------
    export function SetGridVisible(isVisible) {
        if (GRID) GRID.visible = isVisible === true;
    }
    // ------------------------------------------------------------


    // FUNCTION | Rotate the Displayed Asset from Z-Up to Y-Up
    // ------------------------------------------------------------
    // Offered for the formats that declare no axis convention. Applied to the
    // asset's own transform, so the audit and the exporter both see the change.
    export function ApplyZUpCorrection(object3d, enabled) {
        if (!object3d) return;
        object3d.rotation.x = enabled ? -Math.PI / 2 : 0;
        object3d.updateMatrixWorld(true);
    }
    // ------------------------------------------------------------


    // FUNCTION | Capture the Current View as a PNG Data URL
    // ------------------------------------------------------------
    export function CaptureSnapshot() {
        if (!RENDERER || !SCENE || !CAMERA) return null;
        RENDERER.render(SCENE, CAMERA);                                           // <-- Force a fresh frame; the buffer may hold a stale one
        return RENDERER.domElement.toDataURL('image/png');
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
