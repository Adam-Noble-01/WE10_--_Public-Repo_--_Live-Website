# TrueVision3D Development Log
# =========================================================

# ---------------------------------------------------------
## TrueVision3D v2.0.1  -  27-Feb-2026
### Core Codebase Modularization (PlanVision-Aligned Structure)

**Overview**
- Reorganized the TrueVision runtime modules to align with PlanVision-style modular architecture and numbered folder ordering.
- Completed a full source path migration and reference rewrite across runtime code, test environment, config files, and key technical docs.
- Performed final path-integrity validation to confirm module imports and stylesheet links resolve correctly after the restructure.

**Folder Structure Migration**
- Moved all legacy `src__*` module folders into `02__Src__AppModules` and removed `src__` folder prefixes.
- Moved stylesheets from `src__Styles` to `03__Style__AppStylesheets`.
- Introduced numeric folder ordering for module priority and readability:
  - `01__AppCore`, `02__AppData`, `03__AppUtils`, `04__MathUtils`, `05__RenderPipeline`, `06__Scene__LightingEffects`, `07__Scene__EnvironmentEffects`, `10__NavigationAndCameras`, `11__CameraUtils`, `15__ModelLoader`, `20__System__MaterialsSystem`, `26__System__ToggleModelElements`, `30__System__ImageExport`, `90__System__PageLayoutSystem`, `25__System__3dObject__InteractionSystem`, `26__System__ToggleModelElements`.

**AppCore / AppData Separation**
- Consolidated core orchestration scripts under `02__Src__AppModules/01__AppCore`:
  - `Na__AppFlow__LoadingSequence.js`
  - `Na__AppConfig__Loader.js`
- Moved app configuration data into `02__Src__AppModules/02__AppData`:
  - `Na__AppConfig__Main.json`
  - `Na__AppConfig__MaterialsLibrary.json` (+ related data JSON assets)
- Updated config loader fetch path to load from `02__AppData`.

**Reference Rewiring**
- Updated module imports in `index.html` to point to the new numbered module locations.
- Updated internal JS relative imports between moved modules.
- Updated test sandbox imports and config references in:
  - `80__Testing__PrototypeEnvironment/TestEnv__PrototypeTestingSandbox__Main__.js`
  - `80__Testing__PrototypeEnvironment/TestEnv__SubAppData__Config.json`
- Updated relevant `.cursor` rule path references to new AppData location.

**Validation and Fixes**
- Resolved one malformed stylesheet import in `02__Src__AppModules/90__System__PageLayoutSystem/Na__PageLayoutSystem__Styles__Main__.css`.
- Final validation checks completed:
  - JS relative import resolution: **PASS** (`MISSING_JS_IMPORTS=0`)
  - `index.html` local `src`/`href` references: **PASS** (`MISSING_INDEX_LINKS=0`)
  - CSS `@import` local path resolution: **PASS** (`MISSING_CSS_IMPORTS=0`)

# ---------------------------------------------------------
## TrueVision3D v2.0.1  -  27-Feb-2026
### Branding Migration Baseline (ValeVision -> TrueVision)

**Overview**
- Began the formal migration baseline from legacy ValeVision naming to TrueVision naming across runtime modules and core project documents.
- Updated primary app and layout branding assets to use Noble Architecture common-assets web URLs.
- Replaced major legacy branding strings in active code paths and prepared compatibility bridges where legacy project data keys may still exist.

**Branding and Logo Updates**
- Updated main app branding in `index.html`:
  - Noble Architecture logo URL in header.
  - Noble Architecture favicon URL(s).
  - Runtime UI text moved to TrueVision naming.
- Updated `02__Src__AppModules/90__System__PageLayoutSystem/Na__PageLayoutSystem__Layout__.html`:
  - Noble Architecture logo URL in layout header.
  - Noble Architecture favicon URL(s).

**Codebase Naming Updates**
- Performed broad naming migration across active project files:
  - `ValeVision3D` -> `TrueVision3D`
  - `ValeVision` -> `TrueVision`
  - `Vale Garden Houses` -> `Noble Architecture`
- Renamed key legacy-named documentation files to TrueVision equivalents.

**Compatibility Safeguards**
- `02__Src__AppModules/03__AppUtils/Na__AppUtils__ProjectLoader.js` now supports both new `trueVision_*` keys and legacy `valeVision_*` keys when extracting model URLs.
- `02__Src__AppModules/01__AppCore/Na__AppFlow__LoadingSequence.js` now accepts `trueVision_Camera__DefaultPosition` with fallback to legacy `valeVision_Camera__DefaultPosition`.
- `02__Src__AppModules/11__CameraUtils/Na__UiFeature__SaveCameraSettings.js` now removes both `trueVision_*` and `valeVision_*` legacy camera blocks before saving canonical camera payload.

**Supporting Updates**
- Cleaned internal legacy naming in `80__Testing__PrototypeEnvironment/TestEnv__FlaskLocalServer.py` (`VALEVISION_ROOT` -> `TRUEVISION_ROOT`).
- Fixed malformed logo URL in `10__DistributionEmails/Distro__InviteEmailEmbedCard__TrueVision3D.html`.

# ---------------------------------------------------------
## LEGACY ValeVision v1.9.7  -  27-Feb-2026
### Stylesheet Naming Standardization 

**Overview**
- Standardized stylesheet naming to the project namespace pattern (`Na__<DomainOrModule>__Styles__<FeatureOrScope>__.css`) for improved maintainability and clearer ownership by module.
- Updated stylesheet link/import wiring across main app, Page Layout System, and Test Environment to match renamed files.
- Removed all remaining Babylon/BABYLON engine references from TrueVision3D runtime/docs.
- Ported legacy `src__GenerateObjects` helper modules from Babylon APIs to Three.js-compatible utility modules.

**Stylesheet Refactor**
- Renamed `src__Styles` files to namespaced equivalents (Core UI, UiFeature, ImageExport scopes).
- Renamed Page Layout stylesheet to `Na__PageLayoutSystem__Styles__Main__.css`.
- Renamed Test Environment stylesheet to `Na__TestEnv__Styles__PrototypeSandbox__.css`.
- Updated `index.html`, Page Layout HTML, and TestEnv HTML to point at new stylesheet names.
- Updated `Na__CoreUi__Styles__Index__.css` import list to new filenames while preserving import order.


