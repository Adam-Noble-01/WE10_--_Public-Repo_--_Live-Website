# TrueVision3D

## Project Placeholder

This README is intentionally reset as part of the `v2.0.1` migration from ValeVision to TrueVision.

## Status

- Core migration in progress
- Branding and naming standardisation underway
- Documentation rewrite pending

## TODO

- Add project overview
- Add architecture and module map
- Add setup and local development instructions
- Add configuration reference (`02__Src__AppModules/02__AppData/Na__AppConfig__Main.json`)
- Add deployment and environment notes

---

# Real-Time Screen-Space Ambient Occlusion (SSAO)

## Why Custom SSAO?

TrueVision3D renders large architectural scenes using Three.js with `logarithmicDepthBuffer: true`. The logarithmic depth buffer is essential for handling the scale range of architecture (millimetre details near the camera alongside buildings 50+ metres away), but it breaks every off-the-shelf SSAO implementation because they all assume a **linear** depth buffer.

Three.js ships two built-in AO passes (`SSAOPass` and `SAOPass`). Both call `perspectiveDepthToViewZ()` internally, which inverts a standard linear depth encoding. With a logarithmic depth buffer the stored depth values follow an entirely different curve:

```
Three.js writes:   gl_FragDepth = log2(1.0 + clipW) / log2(cameraFar + 1.0)
```

Feeding these values through a linear inverter produces garbage view-space positions, so the AO kernel samples land in the wrong places and the entire effect collapses. We needed a custom shader that inverts the log encoding correctly.

## How the Effect Works

### Hemisphere Sampling

The SSAO technique places a small hemisphere of random sample points around each pixel's surface position. For each sample it asks: "Is there geometry closer to the camera than this sample point?" If yes, that pixel is partially occluded and receives a contact shadow.

The hemisphere is oriented to the surface normal, which we reconstruct cheaply from depth derivatives (`dFdx`/`dFdy`) rather than requiring a separate normal render pass.

### Logarithmic Depth Inversion

The key to making this work with a log depth buffer is the correct inversion formula:

```glsl
float reconstructClipW(float storedDepth) {
    return pow(uCameraFar + 1.0, storedDepth) - 1.0;
}
```

This recovers the clip-space W (camera distance) for any pixel. We then build a ray through the pixel via the inverse projection matrix and scale it by the recovered W to get view-space XYZ. This same formula was already proven in the fog pass (`Na__Scene__DefaultFogEffect.js`), which gave us confidence it would work for SSAO.

### View-Space Position Reconstruction

```glsl
vec3 getViewPosition(vec2 screenUv) {
    float depth = texture2D(tDepth, screenUv).x;
    if (depth >= 1.0) return vec3(0.0);  // sky / far plane

    float clipW = reconstructClipW(depth);

    vec2 ndc = screenUv * 2.0 - 1.0;
    vec4 clipPos = vec4(ndc, 0.0, 1.0);
    vec4 viewRay = uInverseProjectionMatrix * clipPos;
    vec3 viewDir = normalize(viewRay.xyz / viewRay.w);

    return viewDir * (clipW / max(-viewDir.z, 0.0001));
}
```

This runs for every pixel and for every kernel sample, so it needs to be fast. The `max(-viewDir.z, 0.0001)` guard prevents division by zero for edge-on rays.

## Pipeline Architecture

The full post-processing chain runs in this order:

```
[RenderPass] → [Profile Lines] → [Fog] → [SSAO] → [AO Blur] → [FXAA]
```

Each pass reads the previous pass's output via `tDiffuse` (the EffectComposer's internal ping-pong mechanism). The SSAO and Fog passes additionally read from a dedicated depth texture.

### The Feedback Loop Problem

This was the single hardest bug to diagnose. The initial implementation attached a `DepthTexture` directly to the EffectComposer's `WebGLRenderTarget`. The composer ping-pongs between two render targets, and when a ShaderPass tried to **read** the depth texture while the framebuffer it was attached to was the **write** target, WebGL threw:

```
GL_INVALID_OPERATION: Feedback loop formed between Framebuffer and active Texture
```

This error is non-obvious because:
1. It only fires during the `glDrawArrays` call, not during setup.
2. The scene appeared to load normally (the RenderPass writes fine; the error only triggers on subsequent ShaderPasses that sample the same RT's depth attachment).
3. The error message doesn't tell you *which* texture is the problem.

We spent several iterations trying to fix this through other means (disabling MSAA, toggling `renderer.autoClear`, reordering passes) before identifying the true cause from the WebGL spec.

### The Solution: Depth Pre-Pass

The fix is a separate render target dedicated exclusively to depth capture:

```javascript
const depthPrePassTarget = new THREE.WebGLRenderTarget(width, height, {
    minFilter    : THREE.NearestFilter,
    magFilter    : THREE.NearestFilter,
    format       : THREE.RedFormat,
    type         : THREE.UnsignedByteType,
    depthTexture : new THREE.DepthTexture(width, height, THREE.FloatType)
});
```

Every frame, **before** the EffectComposer runs, we render the scene into this target:

```javascript
function renderDepthPrePass() {
    renderer.setRenderTarget(depthPrePassTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
}
```

Both the fog pass and SSAO pass sample `depthPrePassTarget.depthTexture`. Since this texture is never attached to the EffectComposer's framebuffers, no feedback loop can form. The cost is one extra scene render per frame (depth only, no colour), which is acceptable given the relatively low polygon counts of whitecard architectural models.

### depthWrite / depthTest on ShaderPasses

Another subtle issue: Three.js `ShaderPass` materials default to `depthWrite: true` and `depthTest: true`. When multiple fullscreen-quad passes run in sequence, earlier passes can corrupt the depth buffer state for later passes. All ShaderPass materials must explicitly set:

```javascript
pass.material.depthWrite = false;
pass.material.depthTest  = false;
```

This applies to Profile Lines, Fog, SSAO, AO Blur, and FXAA.

## Alpha-Channel Blur Strategy

### The Problem with Naive Blur

The first blur implementation was a straightforward 5x5 gaussian blur on the entire composited output. This smoothed the AO noise, but it also blurred geometry edges, textures, and the linework — making the whole scene look soft.

### The Solution: Blur Only the Alpha Channel

The SSAO pass was restructured to output its data differently:
- **RGB** = the sharp, unmodified scene colour (passed through from the previous pass)
- **Alpha** = the AO factor (1.0 = no shadow, <1.0 = occluded)

The downstream blur pass then:
1. Reads the center pixel's RGB (keeping geometry crisp).
2. Blurs ONLY the alpha channel across the 5x5 kernel.
3. Composites: `gl_FragColor = vec4(center.rgb * blurredAo, 1.0)`

This gives soft, smooth ambient occlusion shadows without any loss of edge sharpness in the scene.

## Performance Optimisations

### AO Cull Distance

The `CullDistanceMm` config value (default 10,000mm = 10 metres) skips the kernel loop entirely for pixels beyond this distance from the camera. A smooth fade-out over the last 20% of the range prevents the AO from popping off at the boundary:

```glsl
float fadeStart = uAoCullDistance * 0.8;
cullFade = 1.0 - smoothstep(fadeStart, uAoCullDistance, pixelDist);
```

### FPS-Based Auto-Disable

After a 60-frame warmup period, the performance monitor samples the next 120 frames. If the average FPS falls below 24, both the SSAO and blur passes are disabled and the user sees a toast: "Shadows have been switched off to improve performance. For the full experience, please use a more capable device."

The word "Shadows" is used deliberately throughout the UI because end users are architects, not graphics programmers. "Ambient occlusion" would mean nothing to them.

### Real-Time Toggle

A "Shadows" toggle in the "Tools & Settings" dropdown allows manual ON/OFF control. The toggle calls `pipeline.toggleAo()`, which enables or disables both the SSAO and blur passes. If the performance monitor auto-disables AO, a `na-ao-disabled` custom event synchronises the toggle UI.

## Configuration Reference

All values live in `Na__AppConfig__Main.json` under the `RenderEffect__AmbientOcclusion` block:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `Enabled` | bool | `true` | Master on/off |
| `RadiusMm` | int | `50` | Sampling hemisphere radius in mm — controls shadow strip width |
| `Intensity` | float | `1.2` | Occlusion strength multiplier (0-2) |
| `Bias` | float | `0.005` | Minimum depth difference to count as occluded |
| `Samples` | int | `16` | Hemisphere kernel sample count |
| `CullDistanceMm` | int | `10000` | Max camera distance for AO (mm); 0 = unlimited |
| `BlurRadius` | float | `1.2` | Texel spread multiplier for gaussian blur (1-3) |
| `FpsThreshold` | int | `24` | Auto-disable if avg FPS falls below this |
| `FpsSampleFrames` | int | `120` | Frames to average for performance check |
| `PerformanceMonitorStartupDelayMs` | int | `3000` | Wait before starting perf monitor |
| `DebugMode` | int | `0` | 0=off, 1=raw depth, 2=linear Z, 3=normals, 4=raw AO |

## File Map

```
02__Src__AppModules/
  07__Scene__EnvironmentEffects/
    Na__RenderEffect__AmbientOcclusion__.js        ← JS orchestration, kernel gen, perf monitor
    Na__RenderEffect__AmbientOcclusion__Shader.js  ← GLSL source (SSAO + blur shaders)
  05__RenderPipeline/
    Na__RenderPipeline__PostProcessing__Setup.js   ← Composer setup, depth pre-pass, pass ordering
  01__AppCore/
    Na__AppFlow__LoadingSequence.js                ← Render loop (calls depth pre-pass + composer)
  02__AppData/
    Na__AppConfig__Main.json                       ← All AO config values
Index.html                                         ← Shadows toggle in Tools & Settings dropdown
03__Style__AppStylesheets/
  Na__UiFeature__Styles__DropdownAndToast__.css     ← Dropdown/toggle/toast styling
```

## Lessons Learned

1. **Never attach a DepthTexture to the EffectComposer's render target.** The ping-pong mechanism means any pass that reads it will trigger a feedback loop. Always use a separate depth pre-pass RT.

2. **Logarithmic depth changes everything.** Any depth-dependent post-processing effect needs custom inversion. The standard `perspectiveDepthToViewZ()` and `readDepth()` helpers in Three.js addons silently produce wrong results with log depth.

3. **ShaderPass materials need `depthWrite=false, depthTest=false`.** These are fullscreen quads; they must not interfere with the depth buffer between passes.

4. **Blur the AO, not the scene.** A naive gaussian blur destroys edge sharpness. The alpha-channel strategy (store AO in alpha, blur only alpha, composite) gives smooth shadows with crisp geometry.

5. **Use debug modes during development.** The 4-level debug mode (`DebugMode` 1-4) was invaluable for isolating whether the problem was depth readback, view-space reconstruction, normal estimation, or the AO kernel itself.

6. **Name things for your users, not for engineers.** "Shadows" is immediately understood; "Screen-Space Ambient Occlusion" is not. This applies to toast messages, toggle labels, and error states.
