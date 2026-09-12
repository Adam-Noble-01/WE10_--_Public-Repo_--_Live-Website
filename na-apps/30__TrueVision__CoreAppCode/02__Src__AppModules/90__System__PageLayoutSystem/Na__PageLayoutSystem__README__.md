# Page Layout System — Retired

The page layout system itself is gone. It was a ValeVision port: a "Create Drawing"
button in the Export Image panel rendered a still, stashed it on `window`, and opened
`Na__PageLayoutSystem__Layout__.html` in a second browser tab that dropped the image
onto a fixed A3 sheet. `51__System__LayoutEditor` does all of that in-app, on real
sheets, with viewports, markup, dimensions and its own PDF exporter, so the second tab
had nothing left to offer. Button, tab, controls, canvas pipeline, styles and the A3
PDF exporter were all removed together.

## What is left, and why

Two files remain because the Layout Editor reads them by path, not because the old
system is coming back:

| File | Read by |
| --- | --- |
| `01__Dependencies__VersionLocked/jspdf.umd.js` | `Na__LayoutEditor__PdfExporter__.js`, injected via `LayoutEditor__Pdf__JsPdfScriptPath` in `Na__LayoutEditor__AppConfig__.json` |
| `PageLayoutSystem__TitleBlock__A3__.png` | `LayoutEditor__TitleBlock__Images` in `Na__LayoutEditor__AppConfig__.json` (all four sheet sizes currently point at it) |

Moving either one means editing those config paths — and `Na__LayoutEditor__ConfigState__.js`
carries the jsPDF path as a hard-coded fallback default too, so that string has to move
with it. Left in place deliberately rather than half-moved.
