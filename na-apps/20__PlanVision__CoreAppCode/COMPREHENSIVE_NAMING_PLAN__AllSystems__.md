# Comprehensive Three-Part Naming Plan - ALL Systems

## Date: 09-Feb-2026
## Scope: Complete codebase naming standardization

---

## Executive Summary

Update ALL modules to use consistent three-part naming convention: `Na__Domain__FunctionName`

**Modules to update:** 5 systems  
**Functions to rename:** ~35 public API functions  
**Files to modify:** ~15 files  
**Call sites to update:** ~50 locations

---

## Module Update Groups

### Group 1: Data Loaders (Priority: HIGH)
**Created during this refactoring - should match new standard**

#### 1.1 Loader__DrawingsDataManager__.js
**Current prefix:** `Na__` (two-part)  
**New prefix:** `Na__Data__` (three-part)

**Functions to rename (5):**
```javascript
// Current → New
Na__Initialize               → Na__Data__Initialize
Na__FetchDrawings            → Na__Data__FetchDrawings
Na__GetCurrentDesignPhase    → Na__Data__GetCurrentDesignPhase
Na__GetProjectPhaseConfig    → Na__Data__GetProjectPhaseConfig
Na__GetAllDrawingsData       → Na__Data__GetAllDrawingsData
```

**Call sites:**
- Main HTML: 3 calls (lines 649, 650, 653)
- HistoricArchive.js: 2 calls (`Na__GetAllDrawingsData`, `Na__GetCurrentDesignPhase`)

---

### Group 2: Video Player System (Priority: HIGH)
**Created during this refactoring - should match new standard**

#### 2.1 VideoPlayer__Main__.js
**Current prefix:** `Na__` (two-part)  
**New prefix:** `Na__Video__` (three-part)

**Functions to rename (1):**
```javascript
Na__Initialise → Na__Video__Initialise
```

**Call sites:**
- Main HTML: 1 call (line 701)

#### 2.2 VideoPlayer__Core__.js
**Current prefix:** `Na__` (two-part)  
**New prefix:** `Na__Video__` (three-part)

**Functions to rename (estimated 3-5):**
```javascript
Na__Initialize      → Na__Video__Initialize
Na__OpenVideoPlayer → Na__Video__OpenVideoPlayer
// ... other functions
```

**Call sites:**
- VideoPlayer__Main__.js: 1 call
- VideoPlayer__GalleryManager__.js: 2 calls

#### 2.3 VideoPlayer__DataLoader__.js
**Current prefix:** `Na__` (two-part)  
**New prefix:** `Na__Video__` (three-part)

**Functions to rename (estimated 3-4):**
```javascript
Na__FetchVideos           → Na__Video__FetchVideos
Na__PreloadVideos         → Na__Video__PreloadVideos
Na__BuildSortedVideoList  → Na__Video__BuildSortedVideoList
```

**Call sites:**
- VideoPlayer__Main__.js: 2 calls
- VideoPlayer__GalleryManager__.js: 2 calls

#### 2.4 VideoPlayer__GalleryManager__.js
**Current prefix:** `Na__` (two-part)  
**New prefix:** `Na__Video__` (three-part)

**Functions to rename (estimated 2-3):**
```javascript
Na__CreateMainMenuVideoButton  → Na__Video__CreateMainMenuVideoButton
Na__ResetVideoGalleryState     → Na__Video__ResetVideoGalleryState
```

**Call sites:**
- VideoPlayer__Main__.js: 1 call
- MenuSystem.js: 1 call

---

### Group 3: Markup Tools System (Priority: MEDIUM)
**Pre-existing module - currently no Na__ prefix**

#### 3.1 MarkupToolsSystem__Main__.js
**Current prefix:** None (`.initialise()`)  
**New prefix:** `Na__Markup__` (three-part)

**Functions to rename (7):**
```javascript
// Current → New
initialise        → Na__Markup__Initialise
isActive          → Na__Markup__IsActive
hasMarkup         → Na__Markup__HasMarkup
render            → Na__Markup__Render
handleMouseDown   → Na__Markup__HandleMouseDown
handleMouseMove   → Na__Markup__HandleMouseMove
handleMouseUp     → Na__Markup__HandleMouseUp
handleKeyDown     → Na__Markup__HandleKeyDown
```

**Call sites:**
- Main HTML: 1 call (`initialise`)
- DrawingsCanvas__RenderSystem__.js: 2 calls (`hasMarkup`, `render`)
- UserIteraction__KeyboardAndMouse__.js: 4 calls (`isActive`, `handleMouseDown`, `handleMouseMove`, `handleMouseUp`, `handleKeyDown`)
- UserIteraction__TouchScreenDevices__.js: 3 calls (estimated)

---

### Group 4: User Interaction Modules (Priority: MEDIUM)
**Pre-existing modules - currently no Na__ prefix**

#### 4.1 UserIteraction__KeyboardAndMouse__.js
**Current prefix:** None (`.initialise()`)  
**New prefix:** `Na__Interact__` (three-part)

**Functions to rename (1):**
```javascript
initialise → Na__Interact__Initialise
```

**Call sites:**
- Main HTML: 1 call (line 807)

#### 4.2 UserIteraction__TouchScreenDevices__.js
**Current prefix:** None (`.initialise()`)  
**New prefix:** `Na__Interact__` (three-part)

**Functions to rename (1):**
```javascript
initialise → Na__Interact__Initialise
```

**Call sites:**
- Main HTML: 1 call (line 810)

---

### Group 5: Asset Loaders (Priority: LOW)
**Pre-existing module - currently no Na__ prefix, but works well as-is**

#### 5.1 Loader__AppAssetsLoader__.js
**Current prefix:** None (`.initialise()`)  
**New prefix:** `Na__Assets__` (three-part) - OPTIONAL

**Functions to rename (4):**
```javascript
// Current → New (if updating)
initialise           → Na__Assets__Initialise
getAssetUrl          → Na__Assets__GetAssetUrl
getProjectAssetUrl   → Na__Assets__GetProjectAssetUrl
parseAssetPath       → Na__Assets__ParseAssetPath
```

**Call sites:**
- Main HTML: 1 call (`initialise`)
- Internal self-references: 6 calls within the module

**Note:** This module has many internal self-references. Consider keeping as-is or low priority.

---

##Complete Dependency Trace

### DrawingsDataManager Dependencies
```
DrawingsDataManager (5 functions)
├─ Called by Main HTML (3 functions)
│   ├─ Na__Data__Initialize
│   ├─ Na__Data__FetchDrawings
│   └─ Na__Data__GetCurrentDesignPhase
└─ Called by HistoricArchive.js (2 functions)
    ├─ Na__Data__GetAllDrawingsData
    └─ Na__Data__GetCurrentDesignPhase
```

### Video Player System Dependencies
```
VideoPlayerMain
├─ Called by Main HTML (1 function)
│   └─ Na__Video__Initialise
└─ Calls internally:
    ├─ VideoPlayerCore.Na__Video__Initialize
    ├─ VideoPlayerDataLoader.Na__Video__FetchVideos
    ├─ VideoPlayerDataLoader.Na__Video__PreloadVideos
    └─ VideoPlayerGalleryManager.Na__Video__CreateMainMenuVideoButton

VideoPlayerGalleryManager
├─ Called by MenuSystem.js (1 function)
│   └─ Na__Video__ResetVideoGalleryState
└─ Calls internally:
    ├─ VideoPlayerDataLoader.Na__Video__BuildSortedVideoList
    └─ VideoPlayerCore.Na__Video__OpenVideoPlayer
```

### Markup Tools System Dependencies
```
MarkupToolsSystem.Main (8 functions)
├─ Called by Main HTML (1 function)
│   └─ Na__Markup__Initialise
├─ Called by RenderSystem.js (2 functions)
│   ├─ Na__Markup__HasMarkup
│   └─ Na__Markup__Render
├─ Called by KeyboardAndMouse.js (5 functions)
│   ├─ Na__Markup__IsActive
│   ├─ Na__Markup__HandleMouseDown
│   ├─ Na__Markup__HandleMouseMove
│   ├─ Na__Markup__HandleMouseUp
│   └─ Na__Markup__HandleKeyDown
└─ Called by TouchScreenDevices.js (3+ functions)
    └─ Similar event handlers
```

### User Interaction Dependencies
```
KeyboardAndMouse
└─ Called by Main HTML (1 function)
    └─ Na__Interact__Initialise

TouchScreenDevices
└─ Called by Main HTML (1 function)
    └─ Na__Interact__Initialise
```

### App Assets Loader Dependencies
```
AppAssetsLoader (4 functions)
├─ Called by Main HTML (1 function)
│   └─ Na__Assets__Initialise
└─ Internal self-references (6 calls)
    ├─ getAssetUrl (called 3 times internally)
    └─ parseAssetPath (called 2 times internally)
```

---

## Implementation Order

### Phase 1: Data & Video (Your Created Modules)
1. DrawingsDataManager → `Na__Data__`
2. VideoPlayer system (4 modules) → `Na__Video__`

**Impact:** 8 modules, ~12 functions, ~15 call sites

---

### Phase 2: Markup System
3. MarkupToolsSystem__Main__ → `Na__Markup__`

**Impact:** 1 module, 8 functions, ~15 call sites

---

### Phase 3: User Interaction
4. KeyboardAndMouse → `Na__Interact__`
5. TouchScreenDevices → `Na__Interact__`

**Impact:** 2 modules, 2 functions, 2 call sites

---

### Phase 4: Asset Loader (Optional)
6. AppAssetsLoader → `Na__Assets__`

**Impact:** 1 module, 4 functions, 7 call sites (1 external + 6 internal)

---

## File Modification Summary

### Module Files to Update (12 files)
1. `Loader__DrawingsDataManager__.js` - 5 functions + exports
2. `VideoPlayer__Main__.js` - 1 function + 4 internal calls + exports
3. `VideoPlayer__Core__.js` - 3-5 functions + exports
4. `VideoPlayer__DataLoader__.js` - 3-4 functions + exports
5. `VideoPlayer__GalleryManager__.js` - 2-3 functions + exports
6. `MarkupToolsSystem__Main__.js` - 8 functions + exports
7. `UserIteraction__KeyboardAndMouse__.js` - 1 function + exports
8. `UserIteraction__TouchScreenDevices__.js` - 1 function + exports
9. `Loader__AppAssetsLoader__.js` - 4 functions + 6 internal calls + exports

### Integration Files to Update (4+ files)
10. `PlanVision__WebApp__Main__.html` - ~12 call sites
11. `DrawingsCanvas__RenderSystem__.js` - 2 call sites
12. `DrawingsCanvas__ViewControls__.js` - 1 call site
13. `UserInterface__MenuSystem__.js` - 1 call site
14. `UserInterface__HistoricArchive__.js` - 2 call sites

---

## Complete Function Mapping

### DrawingsDataManager → `Na__Data__`
| Current | New | Calls |
|---------|-----|-------|
| `Na__Initialize` | `Na__Data__Initialize` | HTML (1), HistoricArchive (0) |
| `Na__FetchDrawings` | `Na__Data__FetchDrawings` | HTML (1) |
| `Na__GetCurrentDesignPhase` | `Na__Data__GetCurrentDesignPhase` | HTML (1), HistoricArchive (1) |
| `Na__GetProjectPhaseConfig` | `Na__Data__GetProjectPhaseConfig` | None found |
| `Na__GetAllDrawingsData` | `Na__Data__GetAllDrawingsData` | HistoricArchive (1) |

### VideoPlayer → `Na__Video__`
| Current | New | Calls |
|---------|-----|-------|
| `Na__Initialise` | `Na__Video__Initialise` | HTML (1) |
| `Na__Initialize` | `Na__Video__Initialize` | VideoMain (1) |
| `Na__FetchVideos` | `Na__Video__FetchVideos` | VideoMain (1) |
| `Na__PreloadVideos` | `Na__Video__PreloadVideos` | VideoMain (1) |
| `Na__CreateMainMenuVideoButton` | `Na__Video__CreateMainMenuVideoButton` | VideoMain (1) |
| `Na__ResetVideoGalleryState` | `Na__Video__ResetVideoGalleryState` | MenuSystem (1) |
| `Na__OpenVideoPlayer` | `Na__Video__OpenVideoPlayer` | Gallery (2) |
| `Na__BuildSortedVideoList` | `Na__Video__BuildSortedVideoList` | Gallery (2) |

### Markup System → `Na__Markup__`
| Current | New | Calls |
|---------|-----|-------|
| `initialise` | `Na__Markup__Initialise` | HTML (1) |
| `isActive` | `Na__Markup__IsActive` | Interaction (2+) |
| `hasMarkup` | `Na__Markup__HasMarkup` | RenderSystem (2) |
| `render` | `Na__Markup__Render` | RenderSystem (2) |
| `handleMouseDown` | `Na__Markup__HandleMouseDown` | Interaction (2+) |
| `handleMouseMove` | `Na__Markup__HandleMouseMove` | Interaction (2+) |
| `handleMouseUp` | `Na__Markup__HandleMouseUp` | Interaction (2+) |
| `handleKeyDown` | `Na__Markup__HandleKeyDown` | Interaction (2+) |

### User Interaction → `Na__Interact__`
| Current | New | Calls |
|---------|-----|-------|
| `initialise` | `Na__Interact__Initialise` | HTML (2) |

### Asset Loader → `Na__Assets__` (Optional)
| Current | New | Calls |
|---------|-----|-------|
| `initialise` | `Na__Assets__Initialise` | HTML (1) |
| `getAssetUrl` | `Na__Assets__GetAssetUrl` | Internal (3) |
| `getProjectAssetUrl` | `Na__Assets__GetProjectAssetUrl` | None found |
| `parseAssetPath` | `Na__Assets__ParseAssetPath` | Internal (2) |

---

## Implementation Sequence

### Step 1: DrawingsDataManager (5 functions, 5 call sites)
**Files:**
- Update module: `Loader__DrawingsDataManager__.js`
- Update calls: `PlanVision__WebApp__Main__.html` (3)
- Update calls: `UserInterface__HistoricArchive__.js` (2)

### Step 2: VideoPlayer System (8-10 functions, 12+ call sites)
**Files:**
- Update module: `VideoPlayer__Main__.js` (1 function + 4 internal calls)
- Update module: `VideoPlayer__Core__.js` (3-5 functions)
- Update module: `VideoPlayer__DataLoader__.js` (3-4 functions)
- Update module: `VideoPlayer__GalleryManager__.js` (2-3 functions)
- Update calls: `PlanVision__WebApp__Main__.html` (1)
- Update calls: `UserInterface__MenuSystem__.js` (1)

### Step 3: Markup Tools System (8 functions, 15+ call sites)
**Files:**
- Update module: `MarkupToolsSystem__Main__.js`
- Update calls: `PlanVision__WebApp__Main__.html` (1)
- Update calls: `DrawingsCanvas__RenderSystem__.js` (2)
- Update calls: `UserIteraction__KeyboardAndMouse__.js` (5)
- Update calls: `UserIteraction__TouchScreenDevices__.js` (3+)

### Step 4: User Interaction (2 functions, 2 call sites)
**Files:**
- Update module: `UserIteraction__KeyboardAndMouse__.js`
- Update module: `UserIteraction__TouchScreenDevices__.js`
- Update calls: `PlanVision__WebApp__Main__.html` (2)

### Step 5: Asset Loader (4 functions, 7 call sites) - OPTIONAL
**Files:**
- Update module: `Loader__AppAssetsLoader__.js` (4 functions + 6 internal calls)
- Update calls: `PlanVision__WebApp__Main__.html` (1)

---

## Final Naming Convention Reference

After all updates, ALL modules will use three-part naming:

| Domain | Prefix | Example |
|--------|--------|---------|
| Canvas | `Na__Canvas__` | `Na__Canvas__ResetView()` |
| Menu | `Na__Menu__` | `Na__Menu__ShowMainMenu()` |
| Buttons | `Na__Buttons__` | `Na__Buttons__CreateFilteredDocumentButtons()` |
| Archive | `Na__Archive__` | `Na__Archive__ShowHistoricWarningModal()` |
| Tutorial | `Na__Tutorial__` | `Na__Tutorial__StartFlow()` |
| Toolbar | `Na__Toolbar__` | `Na__Toolbar__Toggle()` |
| Measure | `Na__Measure__` | `Na__Measure__Render()` |
| **Data** | **`Na__Data__`** | **`Na__Data__FetchDrawings()`** |
| **Video** | **`Na__Video__`** | **`Na__Video__OpenVideoPlayer()`** |
| **Markup** | **`Na__Markup__`** | **`Na__Markup__Render()`** |
| **Interact** | **`Na__Interact__`** | **`Na__Interact__Initialise()`** |
| **Assets** | **`Na__Assets__`** | **`Na__Assets__GetAssetUrl()`** |

---

## Estimated Impact

### Code Changes
- **Modules to modify:** 12 files
- **Functions to rename:** ~35 functions
- **Call sites to update:** ~50 locations
- **Cross-module references:** ~20 locations

### Complexity
- **Low complexity:** Data, Video, Interaction (simple updates)
- **Medium complexity:** Markup (many call sites)
- **Low complexity:** Assets (optional, self-contained)

### Risk Assessment
- **Low risk:** All changes are pure renames, no logic changes
- **Testing:** Run app after each group to verify
- **Rollback:** Easy - just revert file changes

---

## Benefits After Completion

**100% Naming Consistency:**
- ALL public APIs use `Na__Domain__Function` pattern
- No exceptions or legacy patterns remaining
- Clear, searchable, maintainable code

**IntelliSense Perfection:**
- Every domain groups its functions
- Easy discovery of all available operations
- No confusion about which system owns a function

**Future-Proof:**
- Pattern established for all new development
- No mixed naming styles
- Professional, consistent codebase

---

## Testing Strategy

**After each group:**
1. Refresh browser
2. Verify no console errors
3. Test affected functionality
4. Verify IntelliSense shows new names
5. Search for old names (should find none)

**Final verification:**
- All systems initialize correctly
- All features functional
- No undefined function errors
- Complete naming consistency achieved

---

## Recommendation

**Implement in phases:**
1. **Phase 1** (HIGH): Data + Video - Your created modules, should match standard
2. **Phase 2** (MEDIUM): Markup + Interaction - High-use systems
3. **Phase 3** (LOW): Assets - Optional, works well as-is

**Or implement all at once** if you want complete consistency now.

---

**Status:** Ready for implementation  
**Scope:** Comprehensive - ALL systems  
**Effort:** ~2-3 hours for complete update  
**Result:** 100% naming consistency across entire codebase
