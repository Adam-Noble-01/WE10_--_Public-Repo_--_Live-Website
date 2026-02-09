# Complete Naming Convention Reference - All Systems

## Date: 09-Feb-2026
## Status: Current Standard

---

## Three-Part Naming Pattern

**Structure:** `Na__Domain__FunctionName`

**Components:**
1. `Na__` - Noble Architecture namespace (required)
2. `Domain__` - System identifier (Canvas, Menu, Measure, etc.)
3. `FunctionName` - Specific function purpose

---

## Systems Using Descriptive Naming

### UI Layer (5 modules, 24 functions)

**MenuSystem** - `Na__Menu__`
- Initialize, SetDocumentsData
- ShowMainMenu, ShowDrawingsMenu, ShowSpecificationsMenu
- GetCurrentMenuView, GetCurrentDocumentTypeFilter

**DrawingButtons** - `Na__Buttons__`
- Initialize, CreateFilteredDocumentButtons

**HistoricArchive** - `Na__Archive__`
- Initialize, ShowHistoricWarningModal, ShowHistoricWarningModalForCategory
- IsViewingHistoricArchive, SetHistoricArchiveState

**TutorialSystem** - `Na__Tutorial__`
- Initialize, StartFlow, IsMobilePortrait, IsPortrait

**ToolbarManager** - `Na__Toolbar__`
- Initialize, Toggle, Open, Close, IsOpen, CanToggle

---

### Canvas Layer (5 modules, 20 functions)

**LoadingStates** - `Na__Canvas__`
- Initialize, ShowLoading, HideLoading, DisplayError, HideError

**CoordinateUtils** - `Na__Canvas__`
- Initialize, ToPlanCoords, ToScreenCoords

**DrawingLoader** - `Na__Canvas__`
- Initialize, LoadDrawing

**ViewControls** - `Na__Canvas__`
- Initialize, ApplyZoom, SetZoom, ResizeCanvas, ResetView, OnResize

**RenderSystem** - `Na__Canvas__`
- Initialize, StartRendering, StopRendering, RenderFrame

---

### Measurement System (1 module, 9 functions)

**MeasurementToolsSystem** - `Na__Measure__`
- Initialise, Render
- HandleMouseDown, HandleMouseMove, HandleMouseUp
- ClearMeasurements, CancelTool
- HasActiveTool, HasMeasurements

---

## Quick Reference Table

| System | Prefix | Example Functions |
|--------|--------|-------------------|
| Canvas | `Na__Canvas__` | ResetView, ToPlanCoords, LoadDrawing |
| Menu | `Na__Menu__` | ShowMainMenu, SetDocumentsData |
| Buttons | `Na__Buttons__` | Initialize, CreateFilteredDocumentButtons |
| Archive | `Na__Archive__` | ShowHistoricWarningModal |
| Tutorial | `Na__Tutorial__` | StartFlow, IsMobilePortrait |
| Toolbar | `Na__Toolbar__` | Toggle, IsOpen, CanToggle |
| Measure | `Na__Measure__` | Render, ClearMeasurements |

---

## IntelliSense Usage

**Find all functions for a domain:**
```javascript
// Canvas operations
window.NaPlanVision.DrawingsCanvas.ViewControls.Na__Canvas__[Tab]

// Menu operations
window.NaPlanVision.UserInterface.MenuSystem.Na__Menu__[Tab]

// Measurement operations
window.NaPlanVision.MeasurmentToolsSystem.Main.Na__Measure__[Tab]

// Toolbar operations
window.NaPlanVision.UserInterface.ToolbarManager.Na__Toolbar__[Tab]
```

---

## Search Patterns

**Find all operations by domain:**
- `Na__Canvas__` → All canvas operations (20 functions)
- `Na__Menu__` → All menu operations (7 functions)
- `Na__Measure__` → All measurement operations (9 functions)
- `Na__Toolbar__` → All toolbar operations (6 functions)
- `Na__Tutorial__` → All tutorial operations (4 functions)
- `Na__Archive__` → All archive operations (5 functions)
- `Na__Buttons__` → All button operations (2 functions)

---

## Pattern Compliance

**Modules using three-part naming:** 11 modules  
**Total public API functions:** 53  
**Consistency:** 100%

**Systems NOT yet updated (use different patterns):**
- Video Player System (uses `Na__Initialise` - single underscore)
- Markup Tools System (uses `.initialise()`, `.render()` without prefix)
- Individual tool modules (internal APIs, not public-facing)

---

## Future Pattern

**For new modules or refactors:**
```javascript
Na__Video__PlayVideo()
Na__Video__PauseVideo()
Na__Video__GetCurrentTime()

Na__Markup__DrawPath()
Na__Markup__SelectElement()
Na__Markup__DeleteSelected()

Na__Config__Load()
Na__Config__Get()
Na__Config__Validate()
```

---

**Last Updated:** 09-Feb-2026  
**Standard Status:** Established and enforced  
**Coverage:** All extracted modules + Measurement System
