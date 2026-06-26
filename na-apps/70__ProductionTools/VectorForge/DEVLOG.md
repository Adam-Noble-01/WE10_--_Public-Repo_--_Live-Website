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
