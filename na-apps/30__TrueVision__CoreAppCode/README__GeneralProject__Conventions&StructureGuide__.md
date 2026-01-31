# NOBLE ARCHITECTURE - CODING STYLE GUIDE
# =============================================================================

## FILE HEADERS
```javascript
// =============================================================================
// NOBLE ARCHITECTURE - [MODULE NAME]
// =============================================================================
//
// FILE       : [FileName.js]
// NAMESPACE  : [App.ModuleName]
// MODULE     : [ModuleName]
// AUTHOR     : Adam Noble - Noble Architecture
// PURPOSE    : [Brief purpose statement]
// CREATED    : 31-Jan-2026
//
// DESCRIPTION:
// - [Bullet point description]
// - [Additional details]
//
// -----------------------------------------------------------------------------
//
// DEVELOPMENT LOG:
// 31-Jan-2026 - Version 1.0.0
// - Initial Stable Release
//   - Blah
//
// 19-Jan-2026 - Version 0.1.0
// - Beta Version
//   - Blah
//
// =============================================================================
```

## FILE NAMING
```
AppCore__[Name]__Main__.js             // Main orchestrator
AppCore__ModuleDependencyManager__.js  // Always first
Data__[ConfigName]__.json              // Configuration
[Feature]__[Module]__.js               // Feature modules

StyleSheet__[Name]__.css              // Stylesheets
```


## REGIONAL STRUCTURE (60-char dividers)
```javascript
// #Region[col10] --------------------------------------------------------
// MODULE/FUNCTION/DATA/HELPER/METHOD/CLASS/ETC | One Line Concise Description Description
// --------------------------------------------------------

    // MODULE CONSTANTS | Section Description
    // --------------------------------------------------------
    const SETTING_ONE         =  true;                     // <-- Aligned
    const SETTING_TWO_LONGER  =  false;                    // <-- Comments
    // --------------------------------------------------------

    // FUNCTION | Function Description
    // --------------------------------------------------------
    function functionName() {
        const localVar       =  value;                    // <-- Inline comment
    }
    // --------------------------------------------------------

// endregion --------------------------------------------------
```

**CRITICAL**: 4-space indent within ALL regions for code folding.



## CONFIGURATION AUTHORITY
```javascript
// JSON is SINGLE SOURCE OF TRUTH
const enabled = appConfig?.setting === true;         // ✅ Strict equality
const visible = appConfig?.markers !== false;        // ✅ Opt-out pattern

// FORBIDDEN
const enabled = appConfig?.setting || true;          // ❌ Default override
```

## MODULE PATTERN
```javascript
window.AppName = window.AppName || {};

(function() {
    'use strict';
    
    // Module code here
    
    // EXPORT PUBLIC API
    window.AppName.ModuleName = {
        initialize: initialize,
        method: method
    };
    
    // MARK AS LOADED
    if (window.AppName.ModuleDependencyManager) {
        window.AppName.ModuleDependencyManager.markModuleLoaded('ModuleName');
    }
})();
```

## COMMENTING STYLE
```javascript
// Inline arrows for explanations
const value = compute();                             // <-- What this does
scene.activeCamera = camera;                         // <-- Set active camera

// Column-align related comments
let sceneRef                 = null;                 // <-- Scene reference
let cameraRef                = null;                 // <-- Camera reference
let moduleInitialized        = false;                // <-- Init state
```

## FUNCTION HIERARCHY
```
FUNCTION              → Main public API functions
SUB FUNCTION          → Major helper functions
SUB HELPER FUNCTION   → Support functions for sub-functions
HELPER FUNCTION       → Reusable utilities
```

Define helpers BEFORE main functions when possible.

## CSS CONVENTIONS
```css
/* =============================================================================
 * NOBLE ARCHITECTURE - [STYLESHEET NAME]
 * =============================================================================
 */

/* -----------------------------------------------------------------------------
 * REGION | CSS Variables
 * ----------------------------------------------------------------------------- */

    :root {
        --App_PrimaryColor         : #555041;            /* Brand color */
        --App_BackgroundLight      : #f5f5f5;            /* Light bg */
        --App_TextPrimary          : #555041;            /* Text color */
    }

/* endregion ------------------------------------------------------------------- */

/* -----------------------------------------------------------------------------
 * REGION | Base Layout
 * ----------------------------------------------------------------------------- */

    body {
        margin                     : 0;                  /* Remove margins */
        padding                    : 0;                  /* Remove padding */
        font-family                : 'Open Sans', sans-serif;
        background                 : var(--App_BackgroundLight);
    }

/* endregion ------------------------------------------------------------------- */
```

**CRITICAL**: Column-align CSS property colons at ~40 characters.

## HTML STRUCTURE (65-char dividers)
```html
<!-- ----------------------------------------------------------------- -->
<!-- REGION | Page Section Description                                -->
<!-- ----------------------------------------------------------------- -->

    <!-- UI MENU | Component Description                              -->
    <!-- ------------------------------------------------------------ -->
    <div id="component">
        <!-- Content -->
    </div>
    <!-- ------------------------------------------------------------ -->

<!-- endregion -------------------------------------------------------- -->
```

## JSON CONFIGURATION
```json
{
    "appName"           :  "AppName",
    "appVersion"        :  "1.0.0",
    "appAuthor"         :  "Adam Noble",
    "appDomain"         :  "https://www.noble-architecture.com/",
    "AppConfig": {
        "feature_Enabled"       :  false,
        "feature_Description"   :  "Feature configuration options",
        "SubFeature": {
            "subFeature_State"       : true,
            "subFeature_Description" : "Sub-feature details"
        }
    }
}
```

## EVENT-DRIVEN ARCHITECTURE
```javascript
// Dispatch events for module coordination
window.dispatchEvent(new CustomEvent('moduleLoaded'));

// Listen for events
window.addEventListener('moduleLoaded', function(event) {
    // Handle event
});

// Promise-based initialization
window.App.configLoadPromise = (async function() {
    const response = await fetch('Data_-_Config.json');
    window.App.Config = await response.json();
    return true;
})();
```

## MODULE DEPENDENCIES
```javascript
// ModuleDependencyManager tracks loading order
const moduleDependencies = {
    RenderingPipeline: ['config'],
    FeatureModule: ['config', 'RenderingPipeline']
};

// Mark modules as loaded
markModuleLoaded('ModuleName');

// Wait for dependencies
await waitForModule('config');
```

## KEY PRINCIPLES
1. ✅ **4-space indent within regions** for code folding
2. ✅ **JSON as single source of truth** - strict equality checks
3. ✅ **ALWAYS call markModuleLoaded()** after module export
4. ✅ **Column-align** constants, comments, CSS properties
5. ✅ **Inline comments** with `// <--` arrows
6. ✅ **Regional organization** with proper dividers
7. ✅ **Namespace pattern** - attach to global object
8. ✅ **Event-driven** coordination between modules
9. ✅ **Descriptive prefixes** in file names
10. ✅ **Helpers first** in function organization


-----------------------------------------------------------
## PROJECT-SPECIFIC CONVENTIONS
**Always Use `NaProjectCode__{FunctionName}` For anything than uses the project code.**
  - This is to ensure that the code is always identifiable and maintainable.
  - Project codes are a key part of the codebase and will be used and referred to extensively.

### Project Identifier System
Two-letter two-digit format: `JH03`, `AB01`, `CM31`
- First two letters: Client initials (first + last name)
- Two digits: 01-99 for duplicate initials
- Use consistently across filenames, routes, database keys

-----------------------------------------------------------



