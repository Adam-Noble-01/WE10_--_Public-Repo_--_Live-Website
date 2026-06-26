# =============================================================================
# VECTORFORGE — DEVELOPMENT LOG
# =============================================================================
#
# PROJECT  : VectorForge
# AUTHOR   : Adam Noble - Noble Architecture
# PURPOSE  : Vanilla JS SVG vector editor for architectural linework
#
# -----------------------------------------------------------------------------
#
# VERSION SCHEME:
# X.Y.Z — Major.Minor.Patch
#   X — Major (breaking changes or complete rebuilds)
#   Y — Minor (new features, structural changes)
#   Z — Patch (bug fixes, small improvements)
#
# 0.x.x — Development / Beta
# 1.0.0 — First Stable Release
#
# =============================================================================


# =============================================================================

## VectorForge | v0.2.7 | 26-Jun-2026

### Select Tool — Escape Hotkey

- **Select tool shortcuts** (`VF__AppCore__Keybindings__.js` → v1.2.0):
  - `V` — activate select tool (Illustrator/Figma convention; already present).
  - `Escape` — return to select tool from any drawing tool; works even when focus
    is in the code textarea or a property input.
- **HotkeyManager** (`VF__AppCore__HotkeyManager__.js` → v1.2.0):
  - New `_allowHotkeyInInput()` helper — `Escape` for `tool_select` is no longer
    blocked by the input-focus guard (letter tool keys remain suppressed while typing).
- **Toolbar** — select button tooltip updated to `Select (V / Esc)`.

---

## VectorForge | v0.2.6 | 26-Jun-2026

### SVG Import — Point Edit Handles Now Work on Imported Elements

- **Transform-aware handle placement** (`VF__AppCore__PointEditManager__.js` → v1.2.0):
  - `_buildHandlesFor` computes a *relative* CTM via
    `svgRoot.getScreenCTM().inverse() × el.getScreenCTM()`. This cancels the
    viewBox/display scaling (which `getCTM()` alone would include) and leaves only
    the parent `<g>` transform chain expressed in SVG root user-coordinate units —
    the same space where handle circle `cx`/`cy` attributes are interpreted. Using
    raw `getCTM()` directly caused handles to appear offset/scaled because viewport
    coordinates were being written into user-space attributes.
  - Stored as `_editCTM` / `_editCTMInverse`.
  - Two new helpers: `_toSvgSpace(x, y)` transforms a local-space coordinate to SVG
    root space using the CTM; `_toLocalSpace(x, y)` applies the inverse for write-back.
  - `_buildLineHandles`, `_buildRectHandles`, and `_buildPathHandles` all pass each
    coordinate through `_toSvgSpace` before calling `_makeHandle`, so circle handles
    land exactly on the rendered shape even when the path is nested inside a `<g>` with
    a translate, rotate, or scale transform.
  - `_dragLinePoint`, `_dragPathPoint` convert the incoming mouse position (SVG root
    space from `getSVGPoint`) through `_toLocalSpace` before writing back to element
    attributes, keeping geometry in the element's own coordinate space.
  - `_dragRectCorner` converts the drag point to local space for the rect attribute
    update, then re-transforms all four computed corners back to SVG root space to
    correctly reposition each corner handle circle.
  - `_clearHandles` nulls `_editCTM` / `_editCTMInverse` along with the other handle
    state.

- **Polyline/polygon normalisation at import** (`VF__SVG__UploadManager__.js` → v1.1.0):
  - New `_normaliseImportElement(el)` helper checks if an imported top-level element is
    `<polyline>` or `<polygon>`. If so, it converts the `points` attribute to an
    equivalent `<path d="M x0 y0 L x1 y1 ...">` (with `Z` appended for polygons).
    All presentation attributes (`fill`, `stroke`, `stroke-width`, `opacity`, etc.) are
    copied across. Elements of all other tag types are returned unchanged.
  - Applied inside `_handleSVGUpload` before each child is appended to the layer group,
    so these element types are transparently converted at the point of import and
    immediately editable in point-edit mode.

---

## VectorForge | v0.2.5 | 26-Jun-2026

### Right Panel — Drag-to-Resize

- Added `VF__UI__PanelResizeHandle__.js` — a dedicated module that makes the right
  panel drag-resizable via a 6 px grab strip on its left edge.
- Panel width is clamped between 180 px and 640 px.
- Final width persists to `localStorage` (`vf_right_panel_width`) and is restored on
  next page load.
- Handle highlights blue on hover and during drag; document cursor and text-selection
  are locked for the duration of the drag to prevent flicker.
- Updated `index.html` to add `id="right-panel"` and the `#panel-resize-handle` child element.
- Updated `VF__StyleSheet__EditorTheme__.css` with `.panel-resize-handle` rules.
- `VF__App__Main__.js` imports and calls `VF__PanelResizeHandle__Init()` at bootstrap.

---

## VectorForge | v0.2.4 | 26-Jun-2026

### Shift Ortho Lock + Ctrl Vertex Edit Shortcut

- **Shift — Orthogonal axis lock (Line, Path, Point Edit):**
  - New shared utility `VF__CommonUtils__OrthoConstraint__.js` exports
    `VF__CommonUtils__ConstrainPointToOrtho(anchorX, anchorY, cursorX, cursorY, shiftHeld)`.
    Dominant axis (H or V from anchor) is inferred from `|dx| vs |dy|`; returns cursor
    unchanged when Shift is not held.
  - `VF__LineworkTools__LineTool__.js` — holding Shift during mousemove locks the live
    preview endpoint to H or V from the start point. Shift held at the commit click also
    constrains the final segment.
  - `VF__LineworkTools__PathTool__.js` — holding Shift while dragging constrains each new
    segment to H or V relative to the previous vertex. Collinear points on the same axis
    are replaced in-place to avoid duplicate vertices; a direction change starts a new
    stair-step segment.
  - `VF__AppCore__PointEditManager__.js` — Shift held while dragging a handle constrains
    to H or V. Line handles anchor to the opposite endpoint; path handles anchor to the
    previous command's endpoint (or the next for the first M command). Rect handles are
    excluded (Shift has no clear single-axis semantic on a corner).

- **Ctrl — Chord-safe tap to toggle vertex edit mode:**
  - `VF__AppCore__HotkeyManager__.js` now listens to `window keyup` in addition to
    `keydown`. A `_ctrlTapPending` flag is set on Control keydown and cleared immediately
    if any other key is pressed before keyup (detecting a chord like Ctrl+Z). On a clean
    Control keyup with the flag still set, `hotkey:togglePointEdit` is emitted — no
    changes to Keybindings or PointEditManager needed. Mac Cmd key is unaffected.
  - `index.html` — `#point-edit-btn` tooltip updated to `Toggle Vector Point Edit (E / Ctrl)`.

---

## VectorForge | v0.2.4 | 26-Jun-2026

### Dot Grid — Snap Toggle Wired + Grid/Snap Alignment

- **Dot grid now starts hidden.** `snapToGrid` defaults to `false`, so `#canvas-dot-grid`
  is created with `display:none` and only becomes visible when snap is turned on.
- **Snap toggle shows/hides the dot grid.** The Snap button in `VF__App__Main__.js` now
  calls `svgCanvas.setDotGridVisible(appState.snapToGrid)` after flipping the state.
- **Snap interval aligned to dot spacing.** `AppState.gridSize` is now explicitly `20`
  (matching the 20px dot-grid pattern), so cursor snap lands on dot positions.
- **`ensureEditorChrome()` updated** to call `setDotGridVisible(appState.snapToGrid)`
  after restoring, so the grid respects the current snap state after code-panel sync.
- **`setDotGridVisible(visible)`** new public method on `SVGCanvas` that toggles
  `display` on `#canvas-dot-grid` without removing it from the DOM.

---

## VectorForge | v0.2.3 | 26-Jun-2026

### Dot Grid — SVG Overlay Over the Page

- Moved the dot grid from a CSS `radial-gradient` on `.canvas-container` into an
  in-SVG `<pattern>` + overlay rect (`#canvas-dot-grid`). Dots now render directly
  over the white page and zoom/pan correctly with the canvas `viewBox`.
- Added `_createDotGridPattern()` in `VF__SVG__Canvas__.js` — injects `<defs id="vf-editor-defs">`
  with the `#vf-dot-grid` pattern and a `pointer-events:none` overlay rect above all layer groups.
- Added `ensureEditorChrome()` — public helper that restores the paper rect and dot-grid
  after any external DOM replacement (e.g. code-panel sync via Ctrl+Shift+Enter).
- Added `_maintainOverlayOrder()` — called from `_createLayerGroup()` to ensure new layers
  are never stacked above the dot grid or point-edit handles.
- Updated `VF__SVG__Serialization__.js` to strip `#canvas-dot-grid`, `#vf-editor-defs`,
  and `#vf-point-edit-overlay` so exported SVG is clean of all editor chrome.
- Updated `VF__UI__CodePanel__.js` to call `svgCanvas.ensureEditorChrome()` after
  code-to-canvas sync, replacing the former inline paper-rect reconstruction.
- Removed `background-image` and `background-size` from `.canvas-container` in
  `VF__StyleSheet__EditorTheme__.css`; solid `--color-slate-300` workspace remains.

---

## VectorForge | v0.2.2 | 26-Jun-2026

### Header Branding

- NA favicon SVG placed beside the app title on the top-left of the header bar.
- Title updated to `VectorForge | v0.2.2 - Alpha`.
- Removed duplicate NA mark from the top-right controls area.

## VectorForge | v0.2.1 | 26-Jun-2026

### CSS Cleanup — Remove Inline Styles from index.html

- Moved all inline styles from `index.html` into `VF__StyleSheet__EditorTheme__.css`.
- Added reusable classes: `.top-bar__*`, `.btn`, `.btn--secondary`, `.btn--primary`,
  `.panel-tabs`, `.tab-btn`, toolbar SVG sizing, and tab content visibility helpers.
- Updated `VF__App__Main__.js` and `VF__UI__CodePanel__.js` to toggle `.active` /
  `.is-visible` / `.is-hidden` classes instead of manipulating inline styles.
- Fixed unclosed file header comment block in the stylesheet.

### Color Properties + Vector Point Edit Mode

- **Color Properties Panel** — Properties panel now shows Stroke Color and Fill Color
  pickers for all selected elements. Fill panel includes a "None" toggle checkbox
  for linework elements where fill should remain transparent. Stroke color changes
  sync the SelectionManager's originalStroke cache so highlight/restore works correctly.
  Styles: new `.props-fill-row`, `.props-fill-none-label` layout; `input[type="color"]`
  aligned with existing form controls.

- **Vector Point Edit Mode** — New `VF__AppCore__PointEditManager__.js` module.
  Toggle via "Points: Off/On" button in the top bar or press `E`.
  - `<line>` elements: two draggable endpoint handles (x1/y1, x2/y2).
  - `<rect>` elements: four corner handles (TL, TR, BR, BL); all corners sync on drag.
  - `<path>` elements: one handle per M/L endpoint; bezier C/Q control points rendered
    as smaller handles. H and V commands normalised to L. Relative commands converted
    to absolute during parsing. Arc (A) endpoints are draggable.
  - Grid snap respected via svgCanvas.getSVGPoint (uses appState.snapToGrid).
  - Drag mouseup triggers UndoManager's existing debounced snapshot automatically.
  - Click propagation from handles stopped so SelectionManager is not affected.
  - `AppState.pointEditMode` flag added as shared state.
  - `E` keybinding added to `VF__AppData__Keybindings__` → emits `hotkey:togglePointEdit`.


# =============================================================================

## VectorForge | v0.2.0 | 26-Jun-2026

### Structural Refactor — Adam Noble Coding Style Conventions

- Removed Vite, React, Tailwind CSS, and all AI Studio scaffold dependencies.
  App is now pure vanilla JS ES modules with zero build step required.
- Removed: `package.json`, `vite.config.ts`, `tsconfig.json`, `setup.ts`,
  `metadata.json`, `src/`, `assets/`.
- Reorganised folder structure to ValeDesignSuite conventions:
  - `01__Core/` → `03__AppModules/01__AppCore/`
  - `02__UI/`   → `03__AppModules/02__UI/`
  - `04__SVG/`  → `03__AppModules/03__SVG/`
  - `05__Styles/` → `03__AppStyles/`
  - `main.js` → `VF__App__Main__.js`
- All files renamed to `VF__{{System}}__{{FeatureOrPurpose}}__.js` convention.
- Added `02__AppData/VF__AppData__AppConfig__.json` — single source of truth
  for canvas defaults, with `_JsonConvention` object documenting naming rules.
- Applied ValeDesignSuite code style to all 19 JS files:
  - File headers (FILE / NAMESPACE / MODULE / AUTHOR / PURPOSE / DESCRIPTION /
    DEVELOPMENT LOG).
  - Regional structure (`// REGION |` with 4-space content indentation).
  - Function/class headers (`// FUNCTION |`, `// HELPER FUNCTION |`, etc.).
  - Inline arrow comments (`// <--`) column-aligned.
- CSS: replaced `@import "tailwindcss"` and `@theme {}` with a self-contained
  `:root` variables block — no build tool needed.
- `index.html`: removed Tailwind utility classes from header logo block,
  converted to inline styles. Updated title, CSS link, and script src.
- Fixed cross-module import paths:
  - `HotkeyManager` → `VF__AppCore__Keybindings__.js`
  - `CodePanel` → `VF__SVG__Serialization__.js` (export renamed to
    `VF__SVG__FormatSVG`).


# =============================================================================

## VectorForge | v0.1.0 | Jun-2026

### Initial Prototype

- Initial Google AI Studio rapid prototype.
- Vanilla JS SVG editor with Vite scaffold (unused React/Tailwind/Gemini
  dependencies present but not wired).
- Folder structure: `01__Core/`, `02__UI/`, `03__AppModules/`, `04__SVG/`,
  `05__Styles/`.
- Core systems: EventBus, AppState, HotkeyManager, SelectionManager, UndoManager.
- SVG layer system with named layer groups.
- Drawing tools: Line, Rectangle, Freehand Path.
- View navigation: scroll-to-zoom, right/middle-click pan.
- Right panel: Layers list, Properties inspector, SVG code editor tab.
- SVG file upload and import to new layer.
- Status bar: zoom, cursor position, canvas dimensions (px and mm).


# =============================================================================
