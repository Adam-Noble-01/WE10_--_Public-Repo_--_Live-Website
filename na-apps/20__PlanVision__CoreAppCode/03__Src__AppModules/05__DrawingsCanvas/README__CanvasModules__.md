# Canvas System Modules - API Reference

## Module Overview

The Canvas System provides all canvas-related functionality for the PlanVision application, including rendering, view controls, coordinate transformations, and drawing loading.

## Naming Convention

All public API functions use the pattern: **`Na__Canvas__FunctionName`**

This three-part prefix structure makes it clear that:
- `Na__` = Noble Architecture namespace
- `Canvas__` = Canvas system domain
- `FunctionName` = Specific function

---

## Module APIs

### 1. DrawingsCanvas__LoadingStates__.js
**Namespace:** `window.NaPlanVision.DrawingsCanvas.LoadingStates`

#### Functions
- `Na__Canvas__Initialize()` - Initialize loading states system
- `Na__Canvas__ShowLoading()` - Display loading overlay
- `Na__Canvas__HideLoading()` - Hide loading overlay
- `Na__Canvas__DisplayError(message)` - Show error message
- `Na__Canvas__HideError()` - Clear error message

#### Usage Example
```javascript
window.NaPlanVision.DrawingsCanvas.LoadingStates.Na__Canvas__Initialize();
window.NaPlanVision.DrawingsCanvas.LoadingStates.Na__Canvas__ShowLoading();
```

---

### 2. DrawingsCanvas__CoordinateUtils__.js
**Namespace:** `window.NaPlanVision.DrawingsCanvas.CoordinateUtils`

#### Functions
- `Na__Canvas__Initialize(context)` - Initialize coordinate utilities
  - **context.getState()** - Callback to get offsetX, offsetY, zoomFactor
- `Na__Canvas__ToPlanCoords(x, y)` - Convert screen coords to plan coords
- `Na__Canvas__ToScreenCoords(x, y)` - Convert plan coords to screen coords

#### Usage Example
```javascript
window.NaPlanVision.DrawingsCanvas.CoordinateUtils.Na__Canvas__Initialize({
    getState: () => ({ offsetX: 0, offsetY: 0, zoomFactor: 1 })
});

const planCoords = window.NaPlanVision.DrawingsCanvas.CoordinateUtils.Na__Canvas__ToPlanCoords(100, 200);
```

---

### 3. DrawingsCanvas__DrawingLoader__.js
**Namespace:** `window.NaPlanVision.DrawingsCanvas.DrawingLoader`

#### Functions
- `Na__Canvas__Initialize(context)` - Initialize drawing loader
  - **context.planImage** - Image element reference
  - **context.showLoading** - Callback to show loading
  - **context.hideLoading** - Callback to hide loading
  - **context.displayError** - Callback to display errors
  - **context.setImageState** - Callback to update image state
  - **context.resetView** - Callback to reset view after load
- `Na__Canvas__LoadDrawing(drawing)` - Load drawing image and metadata

#### Usage Example
```javascript
window.NaPlanVision.DrawingsCanvas.DrawingLoader.Na__Canvas__Initialize({
    planImage: imageElement,
    showLoading: () => console.log('Loading...'),
    hideLoading: () => console.log('Done'),
    displayError: (msg) => console.error(msg),
    setImageState: (state) => { /* update state */ },
    resetView: () => { /* reset view */ }
});

await window.NaPlanVision.DrawingsCanvas.DrawingLoader.Na__Canvas__LoadDrawing(drawingObject);
```

---

### 4. DrawingsCanvas__ViewControls__.js
**Namespace:** `window.NaPlanVision.DrawingsCanvas.ViewControls`

#### Functions
- `Na__Canvas__Initialize(context)` - Initialize view controls
  - **context.planCanvas** - Canvas element reference
  - **context.planImage** - Image element reference
  - **context.getState()** - Callback to get view state
  - **context.setState(patch)** - Callback to update view state
- `Na__Canvas__ApplyZoom(delta, cx, cy)` - Apply relative zoom change
- `Na__Canvas__SetZoom(z, cx, cy)` - Set absolute zoom level
- `Na__Canvas__ResizeCanvas()` - Update canvas dimensions
- `Na__Canvas__ResetView()` - Reset view to fit drawing
- `Na__Canvas__OnResize()` - Handle window resize event

#### Usage Example
```javascript
window.NaPlanVision.DrawingsCanvas.ViewControls.Na__Canvas__Initialize({
    planCanvas: canvasElement,
    planImage: imageElement,
    getState: () => ({ offsetX: 0, offsetY: 0, zoomFactor: 1, ... }),
    setState: (patch) => { /* update state */ }
});

window.NaPlanVision.DrawingsCanvas.ViewControls.Na__Canvas__ApplyZoom(0.1, centerX, centerY);
window.NaPlanVision.DrawingsCanvas.ViewControls.Na__Canvas__ResetView();
```

---

### 5. DrawingsCanvas__RenderSystem__.js
**Namespace:** `window.NaPlanVision.DrawingsCanvas.RenderSystem`

#### Functions
- `Na__Canvas__Initialize(context)` - Initialize render system
  - **context.planCanvas** - Canvas element reference
  - **context.ctx** - Canvas 2D context
  - **context.planImage** - Image element reference
  - **context.getState()** - Callback to get render state
- `Na__Canvas__StartRendering()` - Begin continuous render loop
- `Na__Canvas__StopRendering()` - Halt render loop
- `Na__Canvas__RenderFrame()` - Render single frame

#### Usage Example
```javascript
window.NaPlanVision.DrawingsCanvas.RenderSystem.Na__Canvas__Initialize({
    planCanvas: canvasElement,
    ctx: canvasContext,
    planImage: imageElement,
    getState: () => ({ offsetX: 0, offsetY: 0, zoomFactor: 1, isImageLoaded: true })
});

window.NaPlanVision.DrawingsCanvas.RenderSystem.Na__Canvas__StartRendering();
```

---

## Module Dependencies

```
LoadingStates (standalone)
    ↓
CoordinateUtils (standalone)
    ↓
DrawingLoader
    ├─ Uses: LoadingStates.Na__Canvas__ShowLoading/HideLoading/DisplayError
    └─ Uses: ViewControls.Na__Canvas__ResetView
    ↓
ViewControls
    ├─ Uses: CoordinateUtils (indirectly via getState)
    └─ Calls: MeasurementTools.clearMeasurements()
    ↓
RenderSystem
    ├─ Coordinates: MarkupToolsSystem.render()
    └─ Coordinates: MeasurementToolsSystem.render()
```

---

## Initialization Order

**Critical:** Modules must be loaded and initialized in this order:

1. **LoadingStates** - No dependencies
2. **CoordinateUtils** - No dependencies
3. **ViewControls** - Needs getState/setState from main app
4. **DrawingLoader** - Needs LoadingStates + ViewControls
5. **RenderSystem** - Needs all canvas state ready

---

## Integration Pattern

All modules follow this integration pattern:

```javascript
// 1. Module checks if its namespace exists
if (window.NaPlanVision && window.NaPlanVision.DrawingsCanvas) {
    
    // 2. Call Na__Canvas__Initialize with context object
    window.NaPlanVision.DrawingsCanvas.ModuleName.Na__Canvas__Initialize({
        // Required references
        // Callback functions
        // State accessors
    });
    
    // 3. Use module functions
    window.NaPlanVision.DrawingsCanvas.ModuleName.Na__Canvas__SomeFunction();
}
```

---

## Benefits of Canvas Prefix

### Clear Domain Identification
- `Na__Canvas__ResetView` - Obviously a canvas operation
- `Na__Canvas__ToPlanCoords` - Obviously a canvas coordinate function
- `Na__Video__PlayVideo` - Would be a video operation (different domain)

### IntelliSense Grouping
- All canvas functions group together in autocomplete
- Easy to discover related functionality
- Prevents naming conflicts with other systems

### Code Searchability
- Search for `Na__Canvas__` finds all canvas functions
- Clear distinction from `Na__Video__`, `Na__Markup__`, etc.
- Easier to understand call hierarchies

---

## Constants

### Zoom Limits
- `MIN_ZOOM = 0.1`
- `MAX_ZOOM = 2.0`

### Paper Sizes (A-Series, width in mm)
- A0: 1189mm
- A1: 841mm
- A2: 594mm
- A3: 420mm
- A4: 297mm

---

## Related Systems

The Canvas System coordinates with:
- **MeasurementToolsSystem** - Renders measurement overlays
- **MarkupToolsSystem** - Renders markup annotations
- **UserInteraction modules** - Receives pan/zoom inputs
- **DrawingsDataManager** - Receives drawing metadata

---

**Last Updated:** 09-Feb-2026  
**Version:** 2.0.5
