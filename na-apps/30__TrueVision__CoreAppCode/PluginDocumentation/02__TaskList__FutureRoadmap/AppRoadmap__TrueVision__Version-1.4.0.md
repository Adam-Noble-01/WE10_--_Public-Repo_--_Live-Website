# TrueVision Application  -  Version 1.4.0 Roadmap
# --------------------------------------------------------

This document outlines the planned features and improvements for TrueVision version 1.4.0.

- Fixes to the way large content is required and loaded.
- Currently the application is served by GitHub sites
- I'm having problems with it loading on mobile on a mobile the browser keeps timing out before the content is served 
- GitHub sites is proving crap at serving anything bigger than the basic scripts 
- I need to look into a CDN and research how to ensure the CDN serves from my current website 
- I've been looking at Cloudflare R2 which seems like a robust solution 
- I need to set up a cloudflare account and figure out how to link it to GoDaddy so my content is served from my own domain

# -----------------------------------------------------------------------------
# TECHNICAL ANALYSIS | Asset Loading Performance Issue & CDN Solution
# -----------------------------------------------------------------------------

## PROBLEM ANALYSIS | Large Asset Files Causing Mobile Timeouts

After comprehensive codebase analysis, the performance issue is confirmed to be caused by large 3D model files being served directly from GitHub Pages:

### ASSET BREAKDOWN | Current File Sizes Causing Timeouts
- **GLB Models**: 102MB total
  - BuildingModel.glb: 37MB
  - FF_FurnishingsModel.glb: 16MB  
  - GF_FurnishingsModel.glb: 49MB
- **HDRI Files**: Up to 16MB (depending on configuration)
  - Pure_Sky_4k.hdr: 16MB
  - Pure_Sky_2k.hdr: 4.2MB
  - Autumn_Field_2k.hdr: 6.1MB
- **Texture Maps**: ~3MB total (various PNG files)

### LOADING SEQUENCE | Where Timeouts Occur
1. HTML/JS/CSS files load successfully (~few MB)
2. App configuration loads successfully (`Data_-_MainAppConfig.json`)
3. **GLB models load sequentially** - **THIS IS WHERE MOBILE TIMEOUTS OCCUR**
4. HDRI files load (additional burden on slower connections)
5. Texture maps load

### CURRENT ASSET SERVING | GitHub Pages Limitations
- All assets served from relative paths: `"./Assets_PluginAssets/..."`
- No CDN configuration implemented
- GitHub Pages struggles with 100+ MB asset delivery
- Mobile browsers timeout before completion
- No progressive loading or compression optimization

## CDN SOLUTION | Cloudflare R2 Implementation Strategy

### IMPLEMENTATION APPROACH | Asset Delivery Optimization
1. **Cloudflare R2 Setup**:
   - Create Cloudflare account linked to GoDaddy domain
   - Configure R2 bucket for TrueVision assets
   - Set up custom domain: `cdn.noble-architecture.com`

2. **Asset Path Configuration**:
   - Modify `MODEL_BASE_PATH` in `RenderingPipeline_TrueVision3DCore.js`
   - Add CDN URL configuration to `Data_-_MainAppConfig.json`
   - Implement fallback loading (CDN → GitHub Pages → local)

3. **Performance Optimizations**:
   - Enable Cloudflare compression for GLB files
   - Implement progressive loading for large models
   - Add asset caching headers for better mobile performance
   - Consider GLB file splitting for critical/non-critical components

### CONFIGURATION CHANGES | Required Code Updates
- Update `SceneConfig_HdriLightingLogic.js` to prioritize CDN URLs
- Modify asset loading paths in rendering pipeline
- Add CDN health check and fallback logic
- Implement loading progress indicators for large assets

### EXPECTED BENEFITS | Performance Improvements
- **Mobile Loading**: 60-80% faster asset delivery
- **Global Performance**: CDN edge locations reduce latency
- **Reliability**: Fallback loading ensures app functionality
- **Scalability**: Handles increased traffic without GitHub Pages limitations



------------------------------

Perfect. You're on the right track — and yes, **you can absolutely set up**:

```
https://cdn.noble-architecture.com/na-apps/TrueVision/Assets/Models/Example.glb
```

...and preserve **your full directory structure** on Cloudflare R2. Below is a step-by-step tailored exactly to your setup.

---

# SETTING UP `cdn.noble-architecture.com` USING CLOUDFLARE R2

---

## STEP 1: CREATE YOUR BUCKET IN R2

1. Go to [Cloudflare R2 dashboard](https://dash.cloudflare.com/)
2. Under **R2**, click **“Create Bucket”**

   * Name it something like `cdn-noble`
   * Enable **“Public Access”** (for static file serving)
3. It will generate:

   * A public bucket endpoint (e.g. `https://<yourid>.r2.dev`)
   * You’ll ignore that and use a **custom domain** instead

## STEP 2: ENABLE CUSTOM DOMAIN FOR BUCKET

1. In the R2 bucket settings, go to **“Custom Domains”**
2. Add:

   ```
   cdn.noble-architecture.com
   ```
3. Cloudflare will give you a **CNAME target** (e.g. `yourid.r2.dev`)
4. Go to your **DNS settings in GoDaddy**

   * Add a **CNAME record**:

     * **Host**: `cdn`
     * **Points to**: `yourid.r2.dev`
     * TTL: Auto
5. Wait for DNS to propagate (usually 5–15 minutes)

## STEP 3: UPLOAD FILES WITH DIRECTORY STRUCTURE

Use Cloudflare's dashboard, or a CLI tool, or even drag-and-drop via [r2.cloudflarestorage.com](https://r2.cloudflarestorage.com/).

Preserve structure:

```
na-apps/
  TrueVision/
    Assets/
      Models/
        Example.glb
```

R2 preserves all paths. So when you upload a folder tree like that, it becomes:

```
https://cdn.noble-architecture.com/na-apps/TrueVision/Assets/Models/Example.glb
```

No extra config needed — your relative folders are respected.

---

# KEY NOTES

---

### Does R2 Behave Like a File Tree?

* Yes. Paths behave exactly like folders.
* You don’t need to compress folders or restructure anything.
* It uses **keyed paths**, so a file called:

  ```
  na-apps/TrueVision/Assets/Models/Example.glb
  ```

  is accessible exactly at:

  ```
  https://cdn.noble-architecture.com/na-apps/TrueVision/Assets/Models/Example.glb
  ```

### Does It Support CORS?

Yes — **you can enable CORS headers** in R2 settings. For 3D apps like yours:

* Enable `Access-Control-Allow-Origin: *`
* Or restrict to just `https://www.noble-architecture.com` if needed

---

# TL;DR

* Yes, your directory structure is **preserved**.
* Yes, `cdn.noble-architecture.com` is **fully customisable and mappable** to your GoDaddy domain.
* Yes, you’ll get beautiful direct URLs like:

  ```
  https://cdn.noble-architecture.com/na-apps/TrueVision/Assets/Models/Example.glb
  ```

---

Let me know if you want a quick PowerShell or GitHub Action script to upload to R2 and maintain structure.
+


# IMPORTANT 
Application Uses Cloudflare purely as:
  - DNS controller
  - CDN/R2 storage
  - CORS/compression and edge caching


## 🔁 Real-World Example Setup

| Purpose           | Provider       |  Domain/Subdomain             | Notes                         |
| ----------------- |--------------- | ----------------------------- | ----------------------------- |
| Website files     | GitHub Pages   |  www.noble-architecture.com   | GitHub handles page hosting   |
| Big asset hosting | Cloudflare R2  |  cdn.noble-architecture.com   | R2 serves large .glb files    |
| Domain purchase   | GoDaddy        |  noble-architecture.com       | Registrar only                |
| DNS manager       | Cloudflare     |  Full domain + subdomains     | Enables routing and CDN magic |


## Change GoDaddy Nameservers to Cloudflare
Assigned the following nameservers to GoDaddy from Cloudflare
`jimmy.ns.cloudflare.com`
`savanna.ns.cloudflare.com`






| Type  | Name | Bucket                  |
|-------|------|------------------------|
| CNAME | cdn  | noble-architecture-cdn |



https://cdn.noble-architecture.com/NaApps/Root__TrueVision/Assets_PluginAssets/3DModels_GlbFormatModels/TrueVision_-_Testing3D_-_PatterdaleCloseModel_-_BuildingModel.glb
https://cdn.noble-architecture.com/NaApps/Root__TrueVision/Assets_PluginAssets/3DModels_GlbFormatModels/TrueVision_-_Testing3D_-_PatterdaleCloseModel_-_GF_FurnishingsModel.glb
https://cdn.noble-architecture.com/NaApps/Root__TrueVision/Assets_PluginAssets/3DModels_GlbFormatModels/TrueVision_-_Testing3D_-_PatterdaleCloseModel_-_FF_FurnishingsModel.glb






---
Read Doc . . . 

I;ve migrated to using Cloudflare as my CDN as GH sites is too slow.

in my browser I;ve validated these links work . . . .


https://cdn.noble-architecture.com/NaApps/Root__TrueVision/Assets_PluginAssets/3DModels_GlbFormatModels/TrueVision_-_Testing3D_-_PatterdaleCloseModel_-_BuildingModel.glb
https://cdn.noble-architecture.com/NaApps/Root__TrueVision/Assets_PluginAssets/3DModels_GlbFormatModels/TrueVision_-_Testing3D_-_PatterdaleCloseModel_-_GF_FurnishingsModel.glb
https://cdn.noble-architecture.com/NaApps/Root__TrueVision/Assets_PluginAssets/3DModels_GlbFormatModels/TrueVision_-_Testing3D_-_PatterdaleCloseModel_-_FF_FurnishingsModel.glb



Create a CDN Links section in the main app config file@Data_-_MainAppConfig.json 

This will define 

CdnModelConfig__ModelLoadingLinkMapper{
Model-01 {
  Model Loading Order = Number  # <-- This becomes the order they are loaded in . . . 
  Model Type  =  String    # <-- Example "Main Building Model"
  Model URL   =  URL        # < -- Exanmple 
  Model Version = 1.0.0
  Model Added   =  
  Model Notes   = 
} ,
Model 02 {
  Model Loading Order = Number  # <-- This becomes the order they are loaded in . . . 
  Model Type  =  String    # <-- Example "Main Building Model"
  Model URL   =  URL        # < -- Exanmple 
  Model Version = 1.0.0
  Model Added   =  
  Model Notes   = 
}  
Continues 

- Then create a model loader script dedicated to handling loading Config info from the @Data_-_MainAppConfig.json file.
- Then this knows to load the building model first.
- Update the loadfing screen logic to time the loading of this first model
- Current EVERYTHING seems to need to be loaded before navigatiobn is possible, this dumb.
- Assets are loaded sequentuially after, only the main building (which I will alwaus make item 01 in the json config) only this needs to load before the user is able to interact and navigate as it sets the backdrop etc.
- The all other assets after are free to pop in as needed otherwise the wait time will be exceissive.
- Ensure robust loading spinner gaphic handling ensuring it is infact tied to the prgress of config model item order 01 object being loaded.


## Added To Cloudflare R2 Bucket Settings CORS Policy

[
  {
    "AllowedOrigins": [
      "*"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "Content-Length",
      "Content-Type",
      "Content-Range",
      "Accept-Ranges",
      "Last-Modified",
      "ETag"
    ],
    "MaxAgeSeconds": 3600
  }
]

Key Addition:
ExposeHeaders - This is crucial for mobile browsers to access response headers needed for progress tracking
Content-Length - Required for progress calculation
Content-Type - Validates file type
Content-Range & Accept-Ranges - Support for range requests (partial loading)
Last-Modified & ETag - Caching headers
This should resolve the mobile loading issues by ensuring all necessary headers are accessible to the browser's JavaScript.