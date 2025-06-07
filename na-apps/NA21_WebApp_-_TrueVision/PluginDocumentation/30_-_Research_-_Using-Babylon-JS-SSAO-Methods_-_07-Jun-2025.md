# =============================================================================
# Research |  Using Babylon JS SSAO (Screen Space Ambient Occlusion) Methods
# =============================================================================
#### Research Notes Compiled - 07-Jun-2025


# Implementing Screen Space Ambient Occlusion (SSAO) in Babylon.js (2025) for Architectural Interiors

## Introduction to SSAO in Architectural Visualization

Screen Space Ambient Occlusion (SSAO) is a real-time rendering technique that darkens creases, corners, and contact points to simulate ambient shadowing. In static or minimally navigable architectural interior scenes, SSAO adds depth and realism by emphasizing corners where light is occluded. For example, SSAO can produce subtle shadowing along where walls meet floors or under furniture, grounding objects in the scene. This guide covers how to implement SSAO in Babylon.js (as of 2025) to enhance visual clarity for interior viewers, focusing on performance, quality trade-offs, and cross-platform considerations.

## SSAO Methods in Babylon.js (Legacy vs Latest)

Babylon.js supports two SSAO rendering pipelines as of 2025:

* **SSAORenderingPipeline (Legacy):** The original SSAO implementation, compatible with WebGL1. It computes ambient occlusion using multiple post-process passes (scene depth, blur, combine) and works even on older devices. This pipeline can achieve good results but is less optimized than the newer version. It was introduced to apply SSAO in Babylon.js and later updated to use bilateral blur for reduced noise. Use this for fallback on devices or browsers that don’t support WebGL2.

* **SSAO2RenderingPipeline (Latest):** An improved SSAO pipeline that leverages WebGL2 features for better performance and quality. SSAO2 uses multiple render targets (MRT) or Babylon’s PrePass renderer to access scene depth and normals in one pass, making it faster. It is **WebGL2-only**, but offers a superior performance profile and allows higher sample counts for better quality. Visually, at equal sample counts the quality is similar to the legacy SSAO, but because SSAO2 runs faster, you can increase the sample count or resolution to achieve smoother results. This is the recommended SSAO method on modern devices.

Both pipelines produce an ambient occlusion effect as a post-process. Functionally they darken ambient light in creases; the main differences lie in performance and supported platforms. In practice, you can use SSAO2 when available and automatically fall back to SSAO for broader compatibility.

## Integrating SSAO into a Babylon.js Scene

Adding SSAO in Babylon.js involves creating the SSAO render pipeline and attaching it to your camera. You can set up either pipeline in just a few lines of code. Below is an example of using SSAO2 when supported, with a fallback to the legacy SSAO pipeline if needed:

```javascript
// Determine which SSAO pipeline to use based on support
if (BABYLON.SSAO2RenderingPipeline.IsSupported) {
    // Configure render target ratios (SSAO at half res, blur at half res, combine at full res)
    const ssaoRatio = {
        ssaoRatio: 0.5,    // SSAO computation at 50% resolution for performance
        blurRatio: 0.5,    // SSAO blur at 50% resolution
        combineRatio: 1    // Combine pass at full resolution (apply AO to the scene)
    };
    // Create SSAO2 pipeline and attach to the active camera
    var ssaoPipeline = new BABYLON.SSAO2RenderingPipeline("ssao", scene, ssaoRatio);
    scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera);
} else {
    // Fallback: create legacy SSAO pipeline (for WebGL1 or older devices)
    var ssaoPipeline = new BABYLON.SSAORenderingPipeline("ssao", scene, { ssaoRatio: 0.5, combineRatio: 1 }, [camera]);
    scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera);
}
```

This code uses `SSAO2RenderingPipeline.IsSupported` to detect WebGL2 support. We create the SSAO2 pipeline with specified resolution ratios, then use the `PostProcessRenderPipelineManager` to attach it to our camera. If WebGL2 is unavailable, we create an SSAORenderingPipeline with similar settings as a fallback. By default, the pipeline will automatically gather the necessary depth and normal information (using the PrePass renderer on WebGL2, or its own geometry buffer on WebGL1).

**Important:** When instantiating SSAO2, you can optionally force it to use the legacy geometry buffer instead of the PrePass system. This is done by passing a boolean as the fifth parameter of the constructor. In most cases you won’t need to set this (the default uses PrePass for efficiency), but it’s a useful trick if you encounter compatibility issues with other effects (discussed later).

After creation, the SSAO effect is active. By default, the pipeline will composite the AO on top of your scene’s lighting. You can verify it’s working by noticing darker creases and corners in the rendered output. Babylon’s Inspector also allows adding SSAO via the UI and tweaking its parameters live (under **Rendering Pipelines** in the scene explorer).

## Configuring SSAO Quality and Performance

SSAO is a screen-space effect that can be performance-intensive, so tuning its settings is crucial for real-time use. Babylon.js provides several parameters to balance quality versus speed:

* **Resolution Ratio:** As shown above, you can render the SSAO at a lower resolution than the full scene. Reducing `ssaoRatio` (and `blurRatio`) to 0.5 or 0.75 can significantly improve frame rate at the cost of some precision. The final combine pass should typically stay at full resolution (`combineRatio = 1`) to avoid upscaling artifacts. In practice, half-resolution SSAO with a blur still yields good visual results while almost halving the fillrate cost.

* **Sample Count:** The `samples` property on SSAO pipelines controls how many sample directions are used for occlusion. More samples yield smoother, less noisy AO at the cost of performance. For example, `ssaoPipeline.samples = 16` uses 16 samples; increasing to 32 or 64 improves quality but will slow down the effect. SSAO2 can handle higher sample counts more efficiently thanks to WebGL2 optimizations. In 2024, SSAO2’s algorithm was improved to handle low sample counts better by introducing an `epsilon` parameter to reduce artifacts when `samples < 16`. By default `epsilon` is 0.02 (applied automatically), which fixes excessive darkening on flat surfaces at low samples. You can tweak this (even set `epsilon = 0` to revert to the old behavior) if you notice banding or too much occlusion on large flat areas.

* **Radius:** The `radius` setting defines the sample radius (in scene units) for occlusion. This essentially determines how far out to look for occluding geometry. A smaller radius gives tight contact shadows (good for small details and object bases), while a larger radius produces broader soft shadows (useful for larger structural corners). In architectural scenes, you may start with a radius around 0.1–0.3 (assuming your units are meters) and adjust as needed. For example, `ssaoPipeline.radius = 0.2;` sets a moderate radius. Be careful: too large a radius can cause halo artifacts around objects and will increase the cost (samples have to cover more area).

* **Strength (Intensity) and Base:** `totalStrength` controls how dark the occlusion shadows are (higher values = darker, stronger AO effect). Values around 0.5 to 2.0 are common; for a subtle architectural AO you might use \~1.0 (100% effect) or less. The `base` parameter is an additive factor that raises the base lighting level; effectively it can be used to lighten the darkest occluded areas (preventing pure black shadows). Setting `base = 0` applies full occlusion, while a higher base (like 0.5) retains more ambient light in creases. For example, in the legacy SSAO a `base` of 0.5 was used to avoid overly dark corners. In SSAO2, leaving base at 0 is common if you want maximum contact shadow, since you can always tone it down by reducing `totalStrength`. Adjust these to taste so that the AO looks natural – in interiors, a slight ambient shadow is desirable, but too strong AO can look like dirt or grime in corners.

* **Blur Filter:** Both SSAO pipelines apply a blur (denoising filter) to the raw AO output to smooth out noise. SSAORenderingPipeline historically used a separable blur and later a bilateral blur to preserve edges. SSAO2 by default uses a bilateral blur as well, with an option for an “expensive” blur that preserves details better. The property `expensiveBlur` (boolean) enables a higher quality blur at the cost of performance. In 2023, Babylon.js made the expensive blur’s parameters configurable (kernel shape, depth tolerance) and also allowed disabling all blurs for debugging. For practical use, you’ll typically leave the blur on (to remove the “speckled” look of raw SSAO) and use `expensiveBlur = true` if you notice regular blur causing loss of contact shadow detail or bleeding across edges. Keep in mind the expensive blur is heavier, so consider using it only on high-end devices or if your scene is static enough that a few extra milliseconds of processing is acceptable.

* **Depth Range (minZ/maxZ):** SSAO can be limited to operate within a certain depth range. The `maxZ` parameter defines a cutoff distance beyond which AO is not calculated (pixels farther than this distance won’t receive AO). For interiors, you might set `ssaoPipeline.maxZ` to the approximate extent of the room – e.g., if the room is \~10 units long, a maxZ of 100 (as in the example) is effectively “infinite” for the room. But in an open scene, limiting maxZ (and possibly using a lower `minZAspect` for distant geometry) can save performance and prevent distant large polygons from introducing low-frequency darkening. `minZAspect` is a tuning factor that affects how AO radius scales with distance; the default (around 0.2) helps maintain effect consistency for far objects. These are advanced tweaks – for most interior scenes, you may not need to adjust minZAspect, but know that they exist if you face issues with very close or very far geometry.

**Performance Tips:** SSAO effectively renders the scene at least twice – once to gather depth/normal, then AO, blur, etc. This doubles the rendering cost of your scene (or more, depending on blur passes and resolution). To optimize:

* Lower the `ssaoRatio` (and blur ratio) as much as you can tolerate visually – half or even quarter resolution AO can still look good after blurring.

* Use fewer samples on lower-end devices and rely on the blur to smooth results. The improved SSAO2 with `epsilon` can handle 8 samples reasonably well now.

* Avoid very large radii; keep radius just big enough to cover the largest meaningful contact shadows in your scene (e.g., the gap under furniture).

* If the scene is **static or the camera is fixed**, consider **baking** the SSAO result once or infrequently. For instance, you could render the AO to a texture and reuse it until the camera moves significantly. Babylon doesn’t have built-in static AO baking, but you can hack around it by pausing the pipeline (e.g., detach it or set its samples to 0) when not needed. Since our use-case is fixed positions, you might precompute a high-quality AO at those positions and swap it in. This is an advanced optimization and only worthwhile if you absolutely need to save every frame, as implementing it is non-trivial. Most often, real-time SSAO at reduced settings suffices.

* Combine SSAO with **multisampling or post-AA** to reduce aliasing. Because SSAO works in screen-space, its dark edges can appear jagged, especially at half resolution. By default, render target textures don’t use MSAA (multi-sample anti-aliasing). In WebGL2, Babylon allows using MSAA for post-process pipelines: for example, the DefaultRenderingPipeline supports setting `pipeline.samples = 4` or higher for MSAA. You can similarly enable MSAA on the SSAO pipeline’s render target via engine settings (Babylon.js 5+ automatically uses a MSAA texture for postprocess if supported). Alternatively, use FXAA or SMAA post-process after SSAO. Babylon’s DefaultRenderingPipeline includes an FXAA stage which you can enable (`fxaaEnabled = true`). **Tip:** Enabling FXAA or MSAA is recommended when SSAO is on, to smooth out high-contrast edges that SSAO produces. In practice, using SSAO2 with 4x MSAA (or FXAA) yields much better visual results by eliminating the “jaggies”.

## Compatibility with PBR Materials and Reflective Surfaces

**PBR Material Integration:** Babylon.js’s SSAO pipelines work out-of-the-box with PBR materials. The ambient occlusion is applied as a full-screen effect, essentially multiplying the scene’s ambient lighting contribution. In a PBR workflow, materials often have an AO texture channel (static AO map). The SSAO post-process is **separate** from that – it doesn’t feed into the material’s AO input, but rather darkens the final pixel colors. This means SSAO will affect everything in the scene’s final composite, regardless of material type (Standard or PBR). Glossy materials like polished marble or metal will also be darkened by SSAO wherever occlusion is detected in the depth buffer.

While SSAO can enhance realism by adding contact shadows even on reflective surfaces, be mindful of a few things:

* Very reflective/glossy surfaces in reality might not show strong darkening from ambient occlusion because most of their lighting is from reflection. In the engine, however, SSAO will still darken those areas since it cannot differentiate material glossiness when applying the effect. For example, a shiny marble floor in a corner will get darker with SSAO, potentially more than it would physically. It’s usually a subtle effect and often desirable for grounding reflections, but you may need to fine-tune the intensity. If a surface is mirror-like, you might consider reducing AO strength or radius in that area if possible.
* **Screen-space Reflections (SSR) interaction:** If you use SSR (another post-process) for reflective materials, SSAO can complement it by providing shadowing. Typically you want SSAO to apply *before* bloom and tone mapping, but *after* SSR, so that reflections are also occluded. In Babylon’s pipeline system, the order in which you attach pipelines matters. Attaching both SSAO and a reflection pipeline (SSR) to the camera will by default run them in sequence. If you encounter an ordering issue, you might need to manually compose effects (e.g., using PrePass to feed both). Generally, enabling SSAO and SSR together works, but test that the AO darkening appears consistent in reflections. Babylon’s developers have noted the need to improve SSAO with mirror reflections and refractions for more physically correct results. As of 2025, this is still an open area of improvement, so perfect reflection+AO might require custom tweaking.
* **AO on Transparent Objects:** By default, transparent objects (like windows or glass) can still write to the depth buffer and thus could cause SSAO artifacts (e.g., dark halos where glass overlaps other objects). In an architectural scene, you often *don’t* want glass or very transparent surfaces to cast occlusion. A simple solution is to prevent transparent meshes from contributing to SSAO. Babylon’s geometry buffer and pre-pass system has a flag for this: for example, you can do `scene.enableGeometryBufferRenderer().renderTransparentMeshes = false;` to exclude transparent objects from the AO pass. This way, only opaque geometry is considered for occlusion. Another approach is setting `mesh.material.needDepthPrePass = false` for transparent materials so they don’t write depth (if you had enabled depth prepass). Use whichever method ensures that windows and other see-through elements don’t receive or cause unnatural AO darkening. The code above shows one such fix applied after creating the SSAO pipeline.
* **Custom Shaders and Node Materials:** If you use Babylon’s Node Material Editor (NME) or custom shaders for materials, make sure they output depth and normal information for SSAO to work. The SSAO2 pipeline relies on either the PrePass renderer or geometry buffer to get scene normals. Standard materials handle this automatically, but a custom NodeMaterial might need a *PrePassOutput* node. Babylon’s documentation notes that to make a NodeMaterial work with SSAO, you should include the *ViewDepth* and *ViewNormal* outputs via a PrePass block. Without this, those materials might appear unoccluded or cause holes in the SSAO effect.

In summary, SSAO is generally compatible with all materials and lighting. It acts as a screen-space multiplier on ambient lighting/reflections. Just be aware of special cases (mirrors, glass) and leverage engine settings to fine-tune where SSAO applies.

## Cross-Platform Considerations (Mobile & iOS)

Real-time 3D on mobile devices – especially iOS browsers – requires extra care. SSAO is a high-overhead effect, so optimizing for mobile is crucial:

* **WebGL2 vs WebGL1:** Many older mobile browsers (and older iOS Safari versions) support only WebGL1. In these cases, SSAO2 won’t be available. Ensure your app checks `SSAO2RenderingPipeline.IsSupported` and falls back gracefully to SSAORenderingPipeline if needed, as shown in the integration code. The legacy pipeline will run on WebGL1, though it may be slower and possibly lower quality. If WebGL2 is present (modern Android Chrome, iOS 15+ Safari), SSAO2 should work – but keep in mind some early WebGL2 implementations on iOS had bugs affecting SSAO2. By 2025 these issues have largely been ironed out, but testing on target devices is important.

* **Performance on iOS:** iOS Safari is known to be quite restrictive with heavy WebGL usage. One key tip is **not to request high-performance GPU mode** on battery-powered devices. Babylon.js by default sets the WebGL context `powerPreference` to "high-performance", which on iOS can trigger the OS to throttle or kill the web page if it uses too much power. For an architectural viewer that needs to run on iPads/iPhones, you should initialize the engine with `powerPreference: "default"`. This gives Safari the freedom to manage performance and prevents immediate shutdowns due to perceived high load. Developers have reported that changing to default power mode stopped Safari from killing their app and improved stability. For example:

  ```js
  var engine = new BABYLON.Engine(canvas, true, { powerPreference: "default" });
  ```

  This is highly recommended for any intensive graphics on iOS.

* **Memory Limitations:** Mobile devices have limited memory for textures and framebuffers. SSAO uses additional render targets (depth, normal, AO, blur), which can consume a lot of memory especially at high resolution. On older or memory-constrained devices, you might hit Safari’s memory ceiling and crash or reset the GL context. To mitigate this:

  * Use the lowest practical resolution for SSAO (e.g., half or quarter size). Every reduction dramatically cuts memory use (since memory scales with area).
  * Avoid very large draw calls or huge textures in the scene that compound the issue. Since interiors can be detailed, consider texture compression and mipmaps to reduce GPU memory usage.
  * If using Babylon’s DefaultRenderingPipeline *together* with SSAO, note that the default pipeline itself allocates multiple buffers (for bloom, depth of field, etc.). Combining many effects can strain mobile GPUs. It may be wise to create a simpler pipeline on mobile – for instance, enable SSAO and FXAA, but disable heavy effects like Depth of Field or volumetric lighting on phones.
  * Be aware of **memory leaks or cleanup issues**. Always dispose of the SSAO pipeline if you switch scenes or cameras (`ssaoPipeline.dispose()`), so that internal textures are released. Mobile Safari particularly can leak if resources aren’t freed, eventually leading to a crash after navigating between a few heavy pages.

* **Performance Scaling:** It’s a good practice to detect device capabilities (using user agent or Babylon’s engine caps) and adjust SSAO settings. For example, on an iPhone or low-end Android, use 4–8 samples, 0.5 ratio, small radius, and perhaps `expensiveBlur = false`. On a powerful desktop GPU, you can crank up to 32 samples, full resolution AO for the crispest quality. Babylon doesn’t have an automatic quality scaling for SSAO, so you’ll implement this logic based on device. You can also give users a setting to toggle AO or select “Low/High Quality” modes for the ambient occlusion.

* **Safari/WebGL Quirks:** By 2024, Babylon.js introduced an automatic workaround for a known iOS WebGL2 quirk involving uniform buffers. In earlier versions, enabling WebGL2’s UBOs could break some effects on Safari. The engine now detects iOS and disables uniform buffers internally, but if you ever see strange behavior with SSAO on iOS (like the effect not appearing or weird artifacts), ensure you’re on the latest Babylon version where this fix is in place. In case you need a manual fix, you could set `engine.disableUniformBuffers = true` on iOS devices as a precaution. This might slightly reduce performance but improves compatibility.

* **Testing on Actual Devices:** There is no substitute for testing your interior viewer on real hardware. Desktop Chrome might run SSAO at 120 FPS, but an iPhone could struggle to hit 30 FPS with the same settings or could exhibit specific bugs (like the SSAO turning white due to precision issues). During development, use Babylon’s **Hardware Scaling** feature to simulate lower resolution rendering on desktop (e.g., `engine.setHardwareScalingLevel(2)` to render at half resolution) and see how the AO looks. This can mimic mobile display density and performance. Also use the **Spector.js** or Babylon Inspector’s statistics to monitor memory use and frame times while SSAO is enabled.

In summary, for mobile: **keep SSAO cheap** – low res, fewer samples, possibly disable on very old devices – and **use the correct engine options for iOS** to avoid shutdowns. By following these practices, it’s feasible to have SSAO-enhanced interiors even on tablets and phones, adding nice depth without crashing them.

## Using SSAO with Other Post-Processing (Render Pipelines)

In an architectural viewer, you will likely combine SSAO with other effects: anti-aliasing, bloom, tone mapping, etc. Babylon.js provides the DefaultRenderingPipeline which aggregates many common post-processes. However, SSAO is *not* part of the default pipeline and is enabled separately. You have two main ways to integrate SSAO with other effects:

* **Via the DefaultRenderingPipeline:** You can create a `DefaultRenderingPipeline` for things like MSAA/FXAA, bloom, lens effects, then also create an SSAO pipeline. Babylon’s `PostProcessRenderPipelineManager` allows attaching multiple pipelines to the same camera. Simply instantiate both and attach both to your camera. For example:

  ```js
  // Create default pipeline for HDR/bloom/FXAA
  var defaultPipeline = new BABYLON.DefaultRenderingPipeline("default", true, scene, [camera]);
  defaultPipeline.fxaaEnabled = true;
  defaultPipeline.samples = 4; // 4x MSAA

  // Create SSAO2 pipeline (as shown earlier)
  var ssaoPipeline = new BABYLON.SSAO2RenderingPipeline("ssao", scene, ssaoRatio);
  scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera);
  ```

  The order in which you attach might influence the final result. Internally, each pipeline is a chain of post-processes. In practice, SSAO should be applied before final color grading/tone mapping, and typically before bloom (so that bloom doesn’t brighten the occluded dark areas). The DefaultRenderingPipeline applies FXAA at the very end by default, which is fine (it will smooth out AO edges). In testing, simply attaching SSAO in addition to the default pipeline works: you get the AO effect on top of all the default pipeline’s effects. If you notice any issues (for instance, in the past there were bugs combining prepass-based SSAO2 with the default pipeline’s image processing), ensure you’re on the latest Babylon version. As a troubleshooting measure, you can force SSAO2 to use geometry buffer mode if the default pipeline also uses prepass features, to avoid conflicts. But Babylon’s team has been improving multi-pipeline support, and by 2025 combining SSAO with the default pipeline is a common and supported use-case.

* **Custom Composition:** For maximum control, you might bypass the default pipeline and manually compose post-processes. This is advanced, but you could retrieve the SSAO texture and blend it yourself with a custom shader, especially if you want a non-standard combination (e.g., apply AO only to certain render layers). Babylon allows you to disable the combine pass of the SSAO pipeline and use your own if needed (there’s an option to skip the built-in combine stage). Most scenarios won’t require this – it’s typically easier to use the provided pipeline – but it’s good to know it’s possible. The majority of developers will use the first approach (multiple pipelines attached together), which is simpler and sufficient.

When chaining post-processes, always test the final output for any unintended side effects. One known interaction: if you disable SSAO mid-run and have FXAA after it, there was a bug that left behind artifacts (framebuffer not clearing). This was fixed by ensuring autoClear on the FXAA pass when SSAO is toggled off. The lesson is that toggling pipelines on/off can be tricky; if your app lets users turn SSAO on or off at runtime, make sure to handle enabling/disabling properly (attach or detach the pipeline, and possibly clear the buffers). Alternatively, you can always keep it attached but just set `ssaoPipeline.totalStrength = 0` to effectively disable it without removing the pipeline.

## Best Practices for Real-Time Architectural Interior Viewers

Finally, here are some best practices specific to architectural visualization using SSAO in Babylon.js:

* **Use SSAO to Enhance, Not Overwhelm:** The goal is to subtly improve depth perception – a common mistake is making SSAO too strong or too large radius, which can make a clean interior scene look dirty or overly dark. Aim for a barely-noticeable effect that the user “feels” more than sees explicitly. Test with different interior materials (white walls will show dark AO more than busy textures, for instance) and find a balance that works for all.

* **Calibrate AO to Scene Scale:** Architecture models have a real-world scale. Ensure the `radius` of SSAO corresponds to a realistic occlusion radius. For example, if your units are meters, a radius of 0.2 (20cm) might make sense for small-scale contact shadows (floor trim, furniture legs), whereas 1.0 (1m) would cast very broad shadows not typical for ambient occlusion. Matching the scale keeps the effect physically plausible. If your scene or model scale is off (e.g., everything is 100x too large), you may need an accordingly larger radius – but it’s better to fix the scale or use the minZAspect parameter to compensate in depth scaling.

* **Leverage PrePass for Multiple Effects:** Babylon’s PrePass renderer is a mechanism to collect geometry data (depth, normals, motion vectors, etc.) once and share it among effects like SSAO, SSR, motion blur, etc. When using SSAO2, if you also plan to use SSR (reflections) or DoF that require depth, enabling the PrePass system can be beneficial. It ensures the scene depth/normal is calculated only once and reused. By default, SSAO2 will automatically use PrePass if available, so you usually don’t have to do anything special other than creating the pipelines. Just be cautious of known bugs or the need to mark certain render targets to not use prepass (as discussed earlier for RTTs). The Babylon team continues to refine the PrePass/GeometryBuffer internally for better integration. Keeping your engine up to date will give you the latest fixes here.

* **Optimize when Camera is Static:** In many interior viewers, the camera might jump between preset positions or allow only limited rotation. Take advantage of this to optimize SSAO:

  * If the camera is completely static (no movement), you could even consider taking a screenshot of the AO once and simply overlaying it as a static ambient occlusion layer (since the AO would not change until the camera moves). Babylon doesn’t have a built-in for this, but you could render the scene with only SSAO (there’s a way to output the SSAO render target by disabling the combine pass or using debugLayer) and use that texture until camera changes.
  * If the camera only rotates (but position is fixed), the SSAO will remain largely correct for the static geometry. Minor artifacts can occur at grazing angles, but you can likely still get away with updating SSAO less frequently. For example, you might run the SSAO pipeline at half frame rate or update it on a short interval rather than every frame. There’s no direct API to tick the SSAO on demand, but you could detach it and reattach when needed to simulate this. This is an advanced optimization and may not be necessary unless you profile and find SSAO is the bottleneck.
  * Use `scene.freezeActiveMeshes()` for static scenes to reduce CPU overhead, so the additional cost of SSAO is purely GPU. Also consider `camera.freezeProjectionMatrix()` if the camera doesn’t move; it can save some math per frame. These don’t directly affect SSAO, but free up resources that might make running SSAO smoother.

* **Test Glossy Surfaces with AO:** If your interior has shiny floors or mirrors, evaluate the visual result of SSAO there. Sometimes SSAO may create a shadow where a mirror should reflect light (for instance, in a corner with a mirror, physically the mirror would reflect a bright part of the room, not a dark shadow). If it looks off, you have a few choices: you could reduce AO strength in those areas by adjusting material or light (not straightforward), or live with the approximation. Another workaround is placing small invisible light sources in corners to counteract over-darkening – essentially artistic tweaks. This falls outside pure SSAO settings, but is something lighting artists do in rendering to balance ambient occlusion.

* **Keep an Eye on Updates:** Babylon.js is evolving, and SSAO is no exception. Check Babylon’s documentation or release notes for any new SSAO features or changes. For example, any “SSAO3” or major overhaul would be in the docs if it came out. As of 2025, improvements are planned but SSAO2 remains the latest. Stay updated via the Babylon.js forum – many SSAO tips and tricks are discussed there (the community often shares Playground examples for tuning SSAO settings, eliminating noise, etc.).

By following this guide, you should be able to integrate SSAO into your Babylon.js architectural viewer effectively. Done right, SSAO will add a layer of depth and professionalism to your interior renders, making static scenes feel more lifelike by highlighting the subtle play of light and shadow in corners and creases. Happy coding, and enjoy the richer visual experience in your virtual buildings!

**Sources:** The information above is based on the Babylon.js documentation and community expertise up to 2025. Key references include official forum answers on SSAO vs SSAO2 performance, code examples of SSAO pipeline usage, mobile optimization advice from Babylon.js developers, and Babylon’s own release notes and issue tracker for SSAO improvements. These ensure the guide is up-to-date with Babylon.js 6.x and the current best practices in real-time archviz rendering.
