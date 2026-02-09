# PlanVision Module Architecture
## Updated: 09-Feb-2026 (Post Priority 1 Refactoring)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PlanVision__WebApp__Main__.html                         │
│                         (Main Application Entry Point)                      │
│                                                                             │
│  • Canvas setup and rendering loop                                         │
│  • Global state management (zoom, pan, image)                              │
│  • Module initialization orchestration                                     │
│  • Event listener coordination                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Initializes & Orchestrates
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MODULE LAYER                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────── DATA LAYER ────────────────────────┐
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Loader__DrawingsDataManager__.js                  │   │
│  │  • Fetches project JSON configuration             │   │
│  │  • Manages design phase state                     │   │
│  │  • Provides drawing data to UI modules            │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          │ Provides Data                    │
│                          ▼                                  │
└─────────────────────────────────────────────────────────────┘

┌──────────────────── USER INTERFACE LAYER ──────────────────┐
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  UserInterface__MenuSystem__.js                    │   │
│  │  • Two-tier menu navigation                        │   │
│  │  • Menu state management                           │   │
│  │  • Category filtering (Drawings/Specs)            │   │
│  │  • Coordinates with other UI modules              │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          │ Delegates to                     │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │  UserInterface__DrawingButtons__.js                │   │
│  │  • Creates dynamic document selection buttons      │   │
│  │  • Filters by type and phase                       │   │
│  │  • Handles button click events                     │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          │ Coordinates with                 │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │  UserInterface__HistoricArchive__.js               │   │
│  │  • Historic document warning modals                │   │
│  │  • Archive filtering logic                         │   │
│  │  • Safety checks and user confirmation            │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌────────────────── MEASUREMENT TOOLS LAYER ─────────────────┐
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  MeasurmentToolsSystem__Main__.js                  │   │
│  │  • Orchestrates measurement tools                  │   │
│  │  • Tool state management                           │   │
│  │  • UI injection and event handling                 │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          │ Delegates to                     │
│                          ▼                                  │
│  ┌───────────────────┬──────────────────┬──────────────┐  │
│  │  Linear Tool      │  Area Tool       │  Rect Tool   │  │
│  │  Module           │  Module          │  Module      │  │
│  └───────────────────┴──────────────────┴──────────────┘  │
│                          │                                  │
│                          │ Uses                             │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │  MeasurmentTools__SharedMathHelpers__.js           │   │
│  │  • Common measurement calculations                 │   │
│  │  • Rendering utilities                             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────── MARKUP TOOLS LAYER ─────────────────────┐
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  MarkupToolsSystem__Main__.js                      │   │
│  │  • Orchestrates markup system                      │   │
│  │  • State and event management                      │   │
│  │  • UI wiring                                       │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          │ Delegates to                     │
│                          ▼                                  │
│  ┌─────────────────┬────────────────┬──────────────────┐  │
│  │  Sketchy        │  Selection     │  UI Template     │  │
│  │  Renderers      │  Handlers      │  Generator       │  │
│  └─────────────────┴────────────────┴──────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌───────────────── USER INTERACTION LAYER ───────────────────┐
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  UserIteraction__KeyboardAndMouse__.js             │   │
│  │  • Mouse events (click, drag, wheel)               │   │
│  │  • Keyboard shortcuts                              │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  UserIteraction__TouchScreenDevices__.js           │   │
│  │  • Touch events (tap, drag, pinch)                 │   │
│  │  • Multi-touch gesture handling                    │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌───────────────────── CORE LAYER ───────────────────────────┐
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  AppCore__UrlQuerySystem__.js                      │   │
│  │  • URL parameter parsing                           │   │
│  │  • Project context resolution                      │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  Loader__AppAssetsLoader__.js                      │   │
│  │  • Font loading                                    │   │
│  │  • Icon and graphic URL resolution                │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  CommonUtils__ProjectCodeValidator__.js            │   │
│  │  • Project code validation                         │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  CommonUtils__PolyfillConditionalLoader__.js       │   │
│  │  • Browser compatibility checks                    │   │
│  │  • Dynamic polyfill loading                        │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────── VIDEO PLAYER LAYER ─────────────────────┐
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │  VideoPlayer__Main__.js                            │   │
│  │  • Orchestrates video system                       │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          │ Coordinates                      │
│                          ▼                                  │
│  ┌──────────────┬───────────────────┬──────────────────┐  │
│  │  Core        │  DataLoader       │  Gallery Mgr     │  │
│  │  Module      │  Module           │  Module          │  │
│  └──────────────┴───────────────────┴──────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Relationships (Post Priority 1 Refactoring)

### Data Flow
```
DrawingsDataManager → MenuSystem → DrawingButtons → User Selection → Main HTML (loadDrawing)
                   ↓                                               ↑
              HistoricArchive ─────────────────────────────────────┘
```

### Module Dependencies
```
MenuSystem
  ├─ Requires: DrawingsDataManager (data)
  ├─ Uses: DrawingButtons (rendering)
  └─ Uses: HistoricArchive (warnings)

DrawingButtons
  ├─ Requires: DrawingsDataManager (data)
  ├─ Requires: loadDrawing callback (main HTML)
  └─ Uses: HistoricArchive (navigation)

HistoricArchive
  ├─ Uses: MenuSystem (state queries)
  ├─ Uses: DrawingButtons (filtered rendering)
  └─ Uses: DrawingsDataManager (data access)

DrawingsDataManager
  └─ Standalone (no dependencies)
```

## Benefits of Priority 1 Refactoring

✅ **Clear Separation of Concerns**
- Data fetching isolated from UI rendering
- Menu state separate from button creation
- Historic warnings decoupled from document filtering

✅ **Improved Testability**
- Each module can be tested independently
- Mock data can be injected easily
- State is contained within modules

✅ **Better Maintainability**
- Smaller, focused modules are easier to understand
- Changes to one module don't affect others
- Clear interfaces between modules

✅ **Reduced Main HTML Complexity**
- 420 lines removed from main HTML (-30%)
- Cleaner initialization sequence
- Easier to identify core app logic

