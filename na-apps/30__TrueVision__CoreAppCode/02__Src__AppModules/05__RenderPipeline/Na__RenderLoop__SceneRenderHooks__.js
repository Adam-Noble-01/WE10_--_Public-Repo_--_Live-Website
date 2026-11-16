// =============================================================================
// TRUEVISION3D - RENDER LOOP - SCENE RENDER HOOKS
// =============================================================================
//
// FILE       : Na__RenderLoop__SceneRenderHooks__.js
// NAMESPACE  : Na__SceneHooks
// MODULE     : Render Pipeline
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : Let more than one system run inside every renderer.render of the scene
// CREATED    : 05-Nov-2026
//
// DESCRIPTION:
// - scene.onBeforeRender FIRES INSIDE EVERY renderer.render, for whichever camera is about
//   to draw, so one hook serves the live loop, stills, tiles, thumbnails, video frames and
//   sheet pictures alike (note 10, trap T4). But it is one slot, and whoever wrote it
//   second would silently switch off whoever wrote it first: plants and figures both want it.
// - EACH SYSTEM GUARDS ITSELF. A hook must not throw, as a system that fails must leave the
//   model and the other systems drawing: the plants' and the figures' both catch their own.
//
// INTEGRATION:
// - Passed to the vegetation and entourage scene layers by their runtimes, as a host
//   function, so those layers still import nothing of the app's.
// - Only lazily loaded systems import this, so it adds nothing to the start-up path.
//
// -----------------------------------------------------------------------------
//
// PORT NOTE:
// - Ported from   : ValeVision3D 05__RenderPipeline/Na__RenderLoop__SceneRenderHooks__.js 1.0.0 (v2.88.0)
// - Ported on     : 15-Nov-2026 for TrueVision3D v2.185.0
// - Parity        : identical (header apart)
// - Divergences   : none. Nothing else in TrueVision writes scene.onBeforeRender.
// - Back-port     : n/a (this IS the port).
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 15-Nov-2026 - TrueVision3D v2.185.0
// - Ported from ValeVision 3D with the vegetation and entourage systems.
//
// 05-Nov-2026 - Version 1.0.0 (ValeVision3D v2.88.0)
// - Initial build, for the entourage system.
//
// =============================================================================


// -----------------------------------------------------------------------------
// REGION | Module Variables
// -----------------------------------------------------------------------------

    // MODULE VARIABLES | The Hooks on Each Scene
    // ------------------------------------------------------------
    const Na__SceneHooks__ByScene = new WeakMap();
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Public API
// -----------------------------------------------------------------------------

    // FUNCTION | Add a Hook to a Scene
    // ------------------------------------------------------------
    // hook(renderer, scene, camera, renderTarget). Anything already in the slot keeps running,
    // first. Returns a function that takes this hook out again.
    // ------------------------------------------------------------
    function Na__SceneHooks__Add(scene, hook) {
        let hooks = Na__SceneHooks__ByScene.get(scene);
        if (!hooks) {
            hooks = [];
            Na__SceneHooks__ByScene.set(scene, hooks);
            const earlier = scene.onBeforeRender;
            scene.onBeforeRender = (renderer, sceneNow, camera, renderTarget) => {
                if (typeof earlier === 'function') earlier(renderer, sceneNow, camera, renderTarget);
                for (let k = 0; k < hooks.length; k++) hooks[k](renderer, sceneNow, camera, renderTarget);
            };
        }
        hooks.push(hook);
        return () => {
            const at = hooks.indexOf(hook);
            if (at >= 0) hooks.splice(at, 1);
        };
    }
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------


// -----------------------------------------------------------------------------
// REGION | Module Exports
// -----------------------------------------------------------------------------

    // MODULE EXPORTS | Scene Render Hooks API
    // ------------------------------------------------------------
    export {
        Na__SceneHooks__Add
    };
    // ------------------------------------------------------------

// endregion -------------------------------------------------------------------
