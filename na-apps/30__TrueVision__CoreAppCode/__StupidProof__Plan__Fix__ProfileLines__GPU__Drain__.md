# TrueVision — Profile Lines GPU Drain — Stupid-Proof Plan

**Target Application** : TrueVision3D  
**Target Root Path**   : `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode`  
**Reference Application** : ValeVision3D at `D:\80__External__LiveRepos\ValeCodebase\WebApps\ValeVision3D`  
**Date**               : 24-May-2026  
**Author**             : Adam Noble (plan written by Opus)

---

## 0. Read This First

This plan exists because TrueVision is currently painfully slow whenever Profile Lines are enabled, and toggling them off via the menu produces a **vast** performance improvement. After a full side-by-side comparison with ValeVision3D (which was recently optimised and is fast), the cause has been localised to a **single critical bug** in TrueVision's profile-lines implementation — plus a small set of optional, follow-up improvements.

**You (the implementing agent) MUST follow these rules:**

1. **DO NOT touch Ambient Occlusion.** Anything in `Na__RenderEffect__AmbientOcclusion__.js` and the `RenderEffect__AmbientOcclusion` block in `Na__AppConfig__Main.json` is **off-limits**. AO was hand-tuned and is brittle. Do not "tidy", "refactor", "harmonise" or "improve" any AO-adjacent code. Leave AO entirely alone — even if you spot what looks like a perf issue there.
2. **DO NOT edit the dev log or this plan file.** A separate step at the very end (Step 5) will update the dev log.
3. **DO NOT introduce new abstractions.** Every change in this plan is a small surgical edit to an existing function. If a change feels like it needs new scaffolding, you have misread the plan — re-read it.
4. **DO NOT change the existing public function signatures** of any exported function. Only internal logic and one new optional config flag may be added.
5. **DO test** that profile lines still look visually correct after each change (see Step 4).

Everything you need is in the four files listed in §3.1 below. Do not look elsewhere unless this plan tells you to.

---

## 1. Why TrueVision Is Slow — Root Cause

Three.js's `LineSegments2` (used for the SketchUp-style fat lines exported from the user's GLB exporter) is implemented internally as an **instanced mesh of template quads**. Crucially, every `LineSegments2` instance has `obj.isMesh === true`. Three.js sets this so that the standard `WebGLRenderer` mesh path picks it up for instanced rendering.

TrueVision's profile-lines effect collects "mesh objects" with this helper:

```javascript:88:94:02__Src__AppModules\05__RenderPipeline\Na__RenderEffect__ProfileLines__.js
    function collectMeshObjects(scene) {
        const meshObjects = [];
        scene.traverse((obj) => {
            if (obj.isMesh) meshObjects.push(obj); // <-- Collect all visible mesh objects
        });
        return meshObjects;
    }
```

Because `isMesh` is also `true` on every `LineSegments2`, **every fat-line object in the scene is pushed into `cachedMeshObjects`**. Then in the **profile colour pass (PASS 2)** of `renderProfileNormals()`, every entry in that array has its material swapped to the flat `profileColorFallbackMaterial` (a `MeshBasicMaterial`):

```javascript:321:324:02__Src__AppModules\05__RenderPipeline\Na__RenderEffect__ProfileLines__.js
            for (let i = 0, len = meshObjects.length; i < len; i++) {
                cachedOriginalMaterials[i] = meshObjects[i].material;        // <-- Stash into pre-allocated slot (no per-frame object creation)
                meshObjects[i].material = profileColorFallbackMaterial;      // <-- Swap mesh to flat fallback colour
            }
```

A `LineSegments2` rendered with a `MeshBasicMaterial` is a disaster:

- Three.js still issues the **instanced** draw call (because the object is still a `LineSegments2`).
- The bound shader is `MeshBasicMaterial`'s standard mesh program, which **does not understand** the per-instance `instanceStart`/`instanceEnd`/`instanceColorStart`/`instanceColorEnd` attributes used by `LineMaterial`.
- The vertex attributes are reinterpreted incorrectly, producing huge spans of degenerate / off-screen triangles — but the GPU still has to **process every vertex and instance**.
- For a scene with ~20 linework GLBs containing thousands of line segments each, the GPU spends most of its time chewing through this corrupted instanced-draw garbage **every single frame**.

That is why disabling Profile Lines makes the app feel "vastly" faster. The fix is to **stop putting `LineSegments2` into the mesh-swap array** in the first place.

ValeVision already has the correct one-line filter:

```javascript:84:90:D:\80__External__LiveRepos\ValeCodebase\WebApps\ValeVision3D\02__Src__AppModules\05__RenderPipeline\Na__RenderEffect__ProfileLines__.js
    function collectMeshObjects(scene) {
        const meshObjects = [];
        scene.traverse((obj) => {
            if (obj.isMesh && !obj.isLine2 && !obj.isLineSegments2) meshObjects.push(obj); // <-- Exclude fat-line meshes; their template quad corrupts the normal buffer
        });
        return meshObjects;
    }
```

TrueVision does not. Porting this single condition is the **primary fix**.

---

## 2. The User's Broader Concern — "Don't Render Things Twice"

The user pointed out that every model in TrueVision comes in **two renditions**:

- **Mesh model** (`MeshModel`) — the base layer with surfaces, exported from SketchUp.
- **Linework model** (`LineworkModel`) — the top layer of explicit `LineSegments2` lines, also exported from SketchUp.

The model loader already tags each root with `userData.Na__ModelType` (values `'mesh'` or `'linework'`), see lines 473 and 491 of `Na__ModelLoader__MultiModel.js`.

The post-processing passes should respect this split:

| Pass | Should render mesh? | Should render linework? | Current state |
|---|---|---|---|
| Main scene `RenderPass` | **Yes** | **Yes** | Correct |
| Profile Lines PASS 1 (normal buffer) | **Yes** | **No** (lines hidden via `visible=false`) | Correct |
| Profile Lines PASS 2 (profile colour buffer) | **Yes** (fallback colour swap) | **Yes** (their own `LineMaterial` w/ vertex colours) | **BROKEN** — fat lines have their material swapped to `MeshBasicMaterial` |
| Fog ShaderPass | (reads depth only) | (reads depth only) | Correct — uses normal-pass depth texture |
| AO Pass / AO Blur | (reads depth only) | (reads depth only) | **DO NOT TOUCH** |
| FXAA | (final compositing only) | (final compositing only) | Correct |

After this plan is applied, the **profile colour buffer (PASS 2) will contain**:

- The scene background filled with the fallback profile-line colour (configurable).
- All mesh surfaces re-coloured to the fallback colour.
- All linework rendered with their **original `LineMaterial`** (including SketchUp-exported vertex colours).

This is the same behaviour ValeVision has, and it is what produces the nice SketchUp-style coloured edge tinting where explicit linework exists.

You are **not** being asked to remove or hide linework anywhere it is currently rendered. You are being asked to **stop the profile-lines code from temporarily swapping the linework's material** every frame.

---

## 3. The Actionable Plan

### 3.1 Files in scope

You will edit **exactly two files**:

1. `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\02__Src__AppModules\05__RenderPipeline\Na__RenderEffect__ProfileLines__.js`
2. `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__DEVLOG__.md`

That's it. No other files. Specifically:

- **Do not** touch `Na__RenderEffect__AmbientOcclusion__.js`.
- **Do not** touch `Na__RenderPipeline__PostProcessing__Setup.js` (it's already correctly wired).
- **Do not** touch `Na__ModelLoader__MultiModel.js` (it already tags `Na__ModelType` and already enables `frustumCulled` on fat lines, lines 404 and 370–371).
- **Do not** touch `Na__AppFlow__LoadingSequence.js` (its render loop already runs the depth pre-pass, profile-normals and composer in the right order, lines 656–664).
- **Do not** touch `index.html`, `Na__AppConfig__Main.json`, `Na__Scene__DefaultSceneLighting.js`, or the Image Export module — they already match ValeVision.

### 3.2 Step 1 — CRITICAL FIX: Exclude fat lines from the mesh-swap array

**File**: `02__Src__AppModules\05__RenderPipeline\Na__RenderEffect__ProfileLines__.js`  
**Function**: `collectMeshObjects` (currently lines 88–94)

**FIND** the current implementation:

```javascript:88:94:02__Src__AppModules\05__RenderPipeline\Na__RenderEffect__ProfileLines__.js
    function collectMeshObjects(scene) {
        const meshObjects = [];
        scene.traverse((obj) => {
            if (obj.isMesh) meshObjects.push(obj); // <-- Collect all visible mesh objects
        });
        return meshObjects;
    }
```

**REPLACE** with:

```javascript
    function collectMeshObjects(scene) {
        const meshObjects = [];
        scene.traverse((obj) => {
            if (!obj.isMesh)                       return;        // <-- Only real meshes are considered
            if (obj.isLine2 || obj.isLineSegments2) return;       // <-- LineSegments2 set isMesh=true internally; skip — their LineMaterial must not be swapped
            if (Na__IsInsideLineworkGroup(obj))    return;        // <-- Defensive: ignore any stray mesh nested inside a linework root
            meshObjects.push(obj);                                // <-- Real surface mesh; eligible for the profile-colour swap
        });
        return meshObjects;
    }
```

**THEN** add the following helper **immediately above** `collectMeshObjects`, inside the same `REGION | Helper Utility Functions` block (so it sits between `collectLineObjects` and `collectMeshObjects`):

```javascript
    // HELPER FUNCTION | Walk Parent Chain to Detect Linework Group Membership
    // ---------------------------------------------------------------
    function Na__IsInsideLineworkGroup(obj) {
        let node = obj;
        while (node) {
            if (node.userData && node.userData.Na__ModelType === 'linework') return true; // <-- Root tagged by Na__ModelLoader__MultiModel.js
            node = node.parent;
        }
        return false;
    }
    // ---------------------------------------------------------------
```

**Why both checks?** The `isLine2 / isLineSegments2` check catches Three.js's fat-line objects directly (this alone matches ValeVision). The `Na__IsInsideLineworkGroup` check is a defensive belt-and-braces guarantee: if the SketchUp GLB exporter ever ships a regular `Mesh` node inside a linework GLB by mistake, it will still be skipped because the loader tags the linework root with `userData.Na__ModelType = 'linework'` (see `Na__ModelLoader__MultiModel.js` lines 491 and 527). This is what the user means by "make sure nothing is counted twice".

This is the single biggest performance win in this entire plan. **Do not skip it.**

### 3.3 Step 2 — DEFENSIVE LOG: Log the cache contents once after rebuild

To make it impossible to silently regress this fix in the future, add a single one-time log line so it is obvious when reading the dev console that the split is healthy.

**File**: same — `Na__RenderEffect__ProfileLines__.js`  
**Function**: `rebuildSceneCache` (currently lines 271–276)

**FIND**:

```javascript:271:276:02__Src__AppModules\05__RenderPipeline\Na__RenderEffect__ProfileLines__.js
        function rebuildSceneCache() {
            cachedLineObjects = collectLineObjects(scene);
            cachedMeshObjects = collectMeshObjects(scene);
            cachedOriginalMaterials = new Array(cachedMeshObjects.length);    // <-- Pre-allocate to mesh count; slots reused every frame
            sceneCacheDirty = false;
        }
```

**REPLACE** with:

```javascript
        function rebuildSceneCache() {
            cachedLineObjects = collectLineObjects(scene);
            cachedMeshObjects = collectMeshObjects(scene);
            cachedOriginalMaterials = new Array(cachedMeshObjects.length);    // <-- Pre-allocate to mesh count; slots reused every frame
            sceneCacheDirty = false;
            console.log(                                                       // <-- One-shot per-rebuild diagnostic so regressions are visible
                `[TrueVision3D] ProfileLines cache rebuilt: `
                + `meshes(swap)=${cachedMeshObjects.length}, `
                + `lines(hide)=${cachedLineObjects.length}`
            );
        }
```

**Why a `console.log`?** This fires only when the scene actually changes (model load, model toggle, storey isolate, etc.) — not every frame — so it is cheap. It makes it trivial to confirm in DevTools that the **mesh count never includes the linework count**. The two numbers should be of broadly comparable order (e.g. `meshes=412, lines=380`). If you ever see `meshes` jump to `meshes+lines combined`, the fat-line exclusion has broken and you must investigate before declaring success.

### 3.4 Step 3 — OPTIONAL FAST-PATH: Single-pass mesh-only profile colour buffer

This step is **opt-in**. It is documented here in case the user, after testing Step 1, still wants more performance and is willing to accept the visual trade-off described below.

**Visual trade-off (read carefully):**

- **Current behaviour** (and ValeVision): auto-detected profile lines (those the Sobel filter finds along curved/cylindrical surfaces) inherit the colour of any **explicit** SketchUp linework rendered at the same screen pixel. Where there is no linework underneath, they take the fallback profile-line colour.
- **Fast-path behaviour**: **all** auto-detected profile lines render with the **fallback** profile-line colour. Explicit linework is unaffected and still renders normally via the main scene pass.

In most architectural scenes the difference is barely visible — the curved-edge "silhouette" lines simply become a uniform colour rather than picking up the local linework hue.

**Implementation** (only if the user explicitly asks for it):

**File**: `02__Src__AppModules\05__RenderPipeline\Na__RenderEffect__ProfileLines__.js`  
**Function**: `renderProfileNormals` (currently lines 290–337)

Add a configurable flag near the top of `Na__RenderEffect__ProfileLines__Create` (after the existing `edgeWidthDistRange` block, just before `let cachedLineObjects = [];`):

```javascript
        const colorPassIncludesLinework =
            config.RenderEffect__ProfileLines__ColorPassIncludesLinework !== false; // <-- Default ON; set false in AppConfig for the mesh-only fast-path
```

Then, inside `renderProfileNormals`, change **only** these two lines from:

```javascript:318:319:02__Src__AppModules\05__RenderPipeline\Na__RenderEffect__ProfileLines__.js
            // PASS 2 | Profile colour at half-res (meshes fallback + linework vertex colours)
            lineObjects.forEach((obj) => { obj.visible = true; }); // <-- Restore linework for colour pass
```

to:

```javascript
            // PASS 2 | Profile colour at half-res (meshes fallback + optional linework vertex colours)
            if (colorPassIncludesLinework) {
                lineObjects.forEach((obj) => { obj.visible = true; }); // <-- Restore linework for colour pass (full quality)
            }
            // else: lines remain hidden from PASS 1; PASS 2 renders meshes only — fastest, profile lines take fallback colour
```

And **always** restore line visibility **after** PASS 2 so the main composer's `RenderPass` still sees them. Locate this line (currently line 336):

```javascript:336:336:02__Src__AppModules\05__RenderPipeline\Na__RenderEffect__ProfileLines__.js
            renderer.setClearColor(savedClearColor, savedClearAlpha);
```

Replace it with:

```javascript
            if (!colorPassIncludesLinework) {
                lineObjects.forEach((obj) => { obj.visible = true; }); // <-- Restore linework so the main RenderPass still draws it
            }
            renderer.setClearColor(savedClearColor, savedClearAlpha);
```

The user can then opt in by adding to `Na__AppConfig__Main.json` under `RenderEffect__ProfileLines`:

```json
"RenderEffect__ProfileLines__ColorPassIncludesLinework": false
```

**Default is `true`** — i.e. nothing changes unless the user opts in. **Do not enable this by default.**

---

## 4. Verification — How to Know You're Done

After Steps 1 and 2 (Step 3 is optional and the user will tell you whether to ship it):

### 4.1 Static checks (before running)

1. Open `Na__RenderEffect__ProfileLines__.js`.
2. Confirm the new `Na__IsInsideLineworkGroup` helper is present and sits in the `Helper Utility Functions` region.
3. Confirm `collectMeshObjects` contains both the `obj.isLine2 || obj.isLineSegments2` early-return **and** the `Na__IsInsideLineworkGroup(obj)` early-return.
4. Confirm `rebuildSceneCache` has the new diagnostic `console.log`.
5. Confirm `collectLineObjects` is **unchanged** (it should still match every `isLine2 || isLineSegments2`).
6. Confirm no other file has been touched.

### 4.2 Runtime checks

Open the app in a browser at `http://localhost:8090/na-apps/30__TrueVision__CoreAppCode/Index.html?project=BH03&project-folder=BH03__BoundaryRoad&year=26` and verify:

1. **Console diagnostic**: After models load you should see one log line of the form:
   ```
   [TrueVision3D] ProfileLines cache rebuilt: meshes(swap)=<N>, lines(hide)=<M>
   ```
   Both numbers must be non-zero (assuming the project has linework) and **disjoint** — `meshes(swap)` must **not** equal `meshes+lines combined`. If `lines(hide)=0` and the scene clearly has linework, the line collector is broken — stop and re-check `collectLineObjects`.
2. **Visual sanity**: All explicit linework still renders with its SketchUp-exported colours. Curved edges (cylinders, fillets) still get profile lines drawn over them.
3. **Performance**: Idle GPU usage should drop dramatically. Camera orbit / zoom should feel smooth. If the user reports it is **not** dramatically better, do not ship — investigate before adding any further changes. Likely culprit if perf is still bad: a stray helper that creates a real `Mesh` inside a linework group (in which case the `Na__IsInsideLineworkGroup` guard will already catch it — confirm by reading the cache rebuild log).
4. **Toggle off + on**: Use the menu's Profile Lines toggle. Off → fast (baseline). On → should now be **roughly the same speed as Off**, possibly with a small overhead for the two pre-passes. If toggling Profile Lines On still tanks the framerate, the fix did not land — re-read Step 3.2.

### 4.3 Things that would mean you broke something

- **Linework lines vanish from the main view** → you accidentally left `visible=false` on lines after PASS 1; check the restoration step inside `renderProfileNormals`.
- **Linework lines lose their colour and go uniformly dark** → you mistakenly applied Step 3 without the user asking, OR `collectMeshObjects` is still including fat lines and their material is being swapped.
- **A black or magenta flash on first frame** → harmless (one-frame artifact from cache rebuild). If it persists, you broke the cache invalidation flow — revert and re-read.
- **Console errors about uniforms / programs / WebGL feedback loops** → you accidentally edited `Na__RenderPipeline__PostProcessing__Setup.js`. Revert that file completely.

---

## 5. Dev Log Entry — Final Step Only

Once steps 1, 2 and the verification pass, append the following entry to `D:\WE10_--_Public-Repo_--_Live-Website\na-apps\30__TrueVision__CoreAppCode\TrueVision__DEVLOG__.md` directly under the most recent dated heading (keep the existing entries unchanged):

```markdown
### 24-May-2026 — Profile Lines GPU Drain Final Fix

- Excluded `LineSegments2` / `Line2` from `collectMeshObjects` in
  `Na__RenderEffect__ProfileLines__.js`. Fat lines were being pushed into
  the per-frame material-swap array because Three.js sets `isMesh=true` on
  them. Their `LineMaterial` was being replaced with `MeshBasicMaterial`
  every frame inside PASS 2 (profile colour buffer), which caused the
  instanced fat-line draw call to run with an incompatible shader program
  and chew through GPU cycles producing corrupt geometry.
- Added `Na__IsInsideLineworkGroup` defensive parent-chain guard against
  stray meshes nested inside a linework GLB. Uses the existing
  `userData.Na__ModelType === 'linework'` tag set by
  `Na__ModelLoader__MultiModel.js`.
- Added one-shot diagnostic console log in `rebuildSceneCache` so future
  regressions of the mesh/linework split are visible without a debugger.
- Ambient Occlusion code is intentionally untouched.
```

That's it. Do not edit anything else in the dev log. Do not edit this plan file.

---

## 6. Summary — What Changes, In One Page

| Change | File | Impact |
|---|---|---|
| `collectMeshObjects` filters out `Line2 / LineSegments2` | `Na__RenderEffect__ProfileLines__.js` | **Critical** — eliminates per-frame corrupt instanced draw calls on fat lines |
| New `Na__IsInsideLineworkGroup` helper, used in `collectMeshObjects` | same file | Defensive — guarantees no linework-nested mesh ever gets swapped |
| One-shot diagnostic `console.log` in `rebuildSceneCache` | same file | Makes regressions visually obvious in DevTools |
| (Optional, opt-in) `RenderEffect__ProfileLines__ColorPassIncludesLinework` flag | same file + AppConfig | Fast-path for huge linework scenes; off by default |
| Dev log entry | `TrueVision__DEVLOG__.md` | Documentation |

**Nothing else changes.** No model loader edits. No AO edits. No render-pipeline-setup edits. No render-loop edits. No HTML/UI edits.

If at any point you find yourself editing a different file or adding a new module, stop and re-read this plan from the top.
