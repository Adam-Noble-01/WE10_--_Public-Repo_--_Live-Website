# TrueVision3D - Plan - Sheet Images
# =========================================================

Pictures (CGIs, photographs) composed onto Layout Editor sheets, the way the project introduction sheets
(EB03_T02_D01, NP03) are built. Shipped as v2.116.0 on 21-Sep-2026. This document is the ledger: what was decided,
why, and what is still open.

---------------------------------------------------------

## 1. The Brief (Adam, 21-Sep-2026)

- New module for inserting and editing pictures on sheets; the frame of the introduction sheets / the Statement
  Writer's figure. Right click: frame on and off, crop.
- Flask and the R2 Worker build the folders: `30__TrueVision__AppContent/05__Layout__DrawingDocs__Images/<drawing id>/`.
  The images folder name never changes and is made when a picture is first inserted, never by the build script;
  one sub-folder per drawing (RB05_T01_D01, RB05_T01_D13, PS02_T02_D98...).
- "If the drawing number is changed, it also updates this folder and then resyncs to R2. Otherwise, it will
  break." The number can be edited in the Sheet panel and in the Drawing Register.
- The viewer resolves picture links through a new URL constructor: R2 first, GitHub Pages only as the absolute
  failure mechanism. Saving the sheet pushes the pictures to R2 and the live version reads them from there.
- Selecting a picture picks up Move. Corner grips only - the aspect can never be stretched; change the aspect by
  cropping. Snapping both ways, in the existing snap system.
- After the first look (same day): the 4 pt border was too heavy; a nicer drop shadow wanted.

## 2. The Decision: a Picture Is a Vector Shape Carrying `Shape__Image`

Floor Areas' decision, for the same reason: every tool, grip, snap, drag, copy, group, layer, lock, print and undo
already knows a vector. The four points are the corners of the part that shows (clockwise from the top left);
nothing else in the record describes where the picture is.

```
Shape__Image : {
    Image__File    'RB03_T01_V10__FrontFascade__SouthElevation__28-Aug-2026__f305e28510.webp'
    Image__Folder  'RB05_T01_D01'   where the file was last FILED - a hint the next save corrects
    Image__PixelW  3840
    Image__PixelH  2160
    Image__Crop    { L, T, R, B }   the kept part as fractions of the picture; absent = the whole picture
    Image__Frame   true             the rule and the shadow, one switch
    Image__Alpha   true             only when the picture has transparency (no shadow; PNG in the PDF)
    Image__Name    'RB03_T01_V10__...png'   the dropped file's name, for the panel and the menu
}
```

- Layer type `image` ("Images"), made directly over the drawings and under the markup; DefaultLayerId answers
  the Vectors layer for `image` on a sheet without one (never the top of the list).
- The normaliser holds a picture to a box of the kept part's proportions whatever wrote its points, and strips
  edge, fill, gradient, hatch, QR and area: a picture is a picture and nothing else.

## 3. Storage and Names

- v2.121.0: stored as WebP q 0.90 (never above 0.99 - Chrome's 1.0 is lossless) at PRINT SIZE, cut by the save
  from the original held in memory - see section 10. Long edge at most 4096; a WebP/JPEG wanted at its own size,
  inside the limits and under 6 MB, is kept byte for byte. Transparency detected on a 512 px copy. (v2.116.0:
  q 0.92 at the render's own size, written at the drop.)
- NAME = the dropped file's name (slugged) + `__` + the first ten hex digits of the stored bytes' SHA-256.
  A name never means two pictures; the same picture dropped twice is stored once; a copy found in ANY folder is
  the right one. The local server refuses bytes that do not hash to their name.
- Files named any other way (Adam's source PNGs) are never moved or archived by the feature.

## 4. Filing by Drawing Number: the Save Step

The folder is `Na__LeRec__DocumentId(sheet)` made safe (`Na__LeImgGeo__FolderFor`). Numbers change in many places
(register renumber/override/move/phase, typed ids, sheets made or deleted in the tab strip), so nothing tracks
the edits: every drawings save re-files. `Na__DrawData__RegisterSaveStep` (ProjectData 1.4.0) - every save runs:

| Phase   | What                                                                                                   |
|---------|--------------------------------------------------------------------------------------------------------|
| before  | every picture copied into its drawing's folder on disk (Flask `reconcile`); onto R2 - copied inside the bucket when R2 has the file anywhere, else uploaded from memory, the repository or the CDN |
| payload | the copy about to be written points each picture at its new folder - only where R2 confirmed it        |
| after   | R2 and the local copy have the drawings: the live records follow; R2 copies nothing names come off; the local ones move into `00__Archive` (only after the LOCAL drawings were written) |

- Register edits ARE saves, so a renumber moves the pictures the moment it is confirmed.
- The register rolls its numbers back when the R2 save fails; the live records only change in `after`, so a
  failed save leaves them pointing at folders that still hold the pictures.
- Fast path: nothing to do (no network) once everything named is known filed on disk and on R2 this session.
- History snapshots keep old hints; an undo that brings one back is corrected by the next save (the file is
  found by name, archive included).

## 5. Sources (`Na__LayoutEditor__SheetImages__Source__`)

- Web viewer: CDN (R2) -> the site's own copy -> `https://www.noble-architecture.com/...` (Pages).
- Editor on localhost: the repository copy -> the CDN.
- Every folder the drawings name for the file is asked before it is "missing". One fetch per picture, held as a
  blob + object URL, so redraws never refetch and the PDF cuts from the same bytes.
- CDN answers `Access-Control-Allow-Origin: *` (checked), so the viewer's CORS fetch works.

## 6. The Frame (config `LayoutEditor__SheetImages__Frame`)

- EB03 at A1 measured: 4 pt rule `#555041` centred on the picture's edge (picture drawn exactly to the rule's path
  rect), over a flat `#e1e1e1` block grown L 2.15 / T 0.71 / R 1.27 / B 2.66 mm.
- Adopted after Adam's first look: 1.5 pt rule, same bronze; soft shadow - Gaussian sigma 1.6 mm, dy 0.9 mm,
  `#1f1d18` at 30%. Screen: SVG `feDropShadow` (filter id made from the settings and a 5% region bucket, so
  duplicate ids are identical filters). PDF: the same blur as a transparent PNG (canvas shadowBlur = 2 sigma).
- Draft mode hides the picture and the shadow's box; the rule (or, unframed, an empty box) is the outline.

## 7. Editing

- Corner grips: a shape grip provider (`Na__LeGrips__RegisterShapeProvider`), DOM grips that take their own
  presses (the parametric stretch-grip pattern) - no change to Resolve / DragFor / ApplyDrag. Scale about the
  opposite corner along the diagonal; snap with the picture excluded; a snap lines up the edge that leaves the
  corner nearest the pointer (nearest the SNAP POINT always picked the side of a landscape picture).
- Crop: the whole picture over the sheet, dimmed round the kept part; eight handles (snapping); a drag inside
  slides the picture under a fixed frame. One undo step. A press elsewhere on the sheet keeps the crop and is
  consumed; toolbar and panel presses go through.
- Menu, panel, Replace (keeps top-left and width, drops the crop), Image button, drag-and-drop (cascade 8 mm,
  40% of the drawing width).

## 8. Traps Found

- `Na__LePanels__SelectedOfKind` answers only for two or more selected items - a one-item panel must read the
  selection itself.
- The pane's requestAnimationFrame can stop entirely: the surface's repaint is rAF-booked, so a "not repainted"
  in the pane is the pane. Test with a rAF shim installed before the app loads (and a fetch guard).
- The editor's structural autosave DOES save to R2 (a Sheet panel edit triggered it in Adam's run) - the save
  step runs there too, which is right; a test tab must block every write before the editor opens.
- `PROJECT_PATTERN` without a leading letter or digit let `project-folder=..` through (fixed in this blueprint;
  the Statements API has the same pattern).
- Node reads the app's `.js` as CommonJS: tests copy leaves to `.mjs` before importing.

## 9. Ledger

| Item                                                       | State                                   |
|------------------------------------------------------------|-----------------------------------------|
| Feature folder, shared hooks, Flask routes, Worker source  | Done, v2.116.0                          |
| Adam's 8090 server restarted for the routes                | Done 21-Sep-2026 12:04 (with consent)   |
| Worker `/r2/upload`, `/r2/copy` deployed                   | OPEN - `CloudflareWorker/deploy.bat`; the fallback works meanwhile |
| Pictures in Custom Scrapbook items / pasted across projects| OPEN - they point at the source project's file ("not found") |
| ProjectVision R2 sync carrying the images folder           | Not needed (the editor's saves push pictures) |
| Source PNGs in the images folder vs the Pages 1 GB limit   | Done v2.121.0: `.gitignore` allowlist (stored names only; no `00__Archive`); the three stray copies recycled 21-Sep |
| Print-size storage (section 10)                            | Done v2.121.0 - NOT signed off          |
| RB05 Sheet_005's two pictures, saved at 3840 px before v2.121.0 | Left as they are (2.34 + 2.26 MB); Replace with each render re-stores them at print size |
| ValeVision port                                            | OPEN - offer after Adam confirms        |

## 10. Print-Size Storage (v2.121.0)

Adam, 21-Sep-2026: "the actual production PNG files, when dragged and dropped in, should be converted and then
discarded ... There's no need to store them at the highest quality because it just makes everything downstream
slower." Calibrated on his own introduction PDFs (the compressed ones he issues: one full-colour JPEG per page at
300 dpi, q~90-94), then approved on seeing the WebP.

- THE TWO LEVERS. Format: WebP 0.90 matches the JPEG q90 of his PDFs (SSIM 0.9906 against 0.9881 on RB05's front
  CGI) at three quarters of its bytes (2.03 against 2.73 MB). Resolution: the PDF never used more than 300 dpi,
  and that CGI sat 196.4 mm wide at 497 dpi.
- NOTHING IS WRITTEN AT THE DROP. Prepare reads the file into memory (the render may vanish from disk the moment
  it drops) and returns it as the SOURCE; the displayed WebP and the source are held (`Na__LeImgPub__Hold`).
- THE SAVE CUTS (`Na__LeImgPub__Normalise`, first in the before phase): for each file whose source is held,
  `Na__LeImgGeo__StoreSize` over every place the drawings show it - PrintDpi x PrintHeadroom at the largest; the
  WHOLE picture at the density the kept part needs; never above the original or the 4096 edge (capped exactly as
  the drop caps it); whole steps of the original's proportions, else nearest pixel; floor 256 px. Cut ONCE from
  the original (`Na__LeImgEnc__Recut`, the drop's encoder: the drop's own size gives the drop's own bytes). The
  live blocks are re-pointed silently (re-read after the await: a repaint renews the record objects), then the
  ordinary filing runs, so only the cut reaches disk and R2.
- SLACK 5% either way (`Na__LeImgGeo__NeedsRecut`): nudges never make files. Resized further this session: cut
  again from the same source. A picture saved in an earlier session: never re-encoded (no generation loss, no
  surprise); the panel says "Stored for a smaller size. Replace it with the original render ..." when it is drawn
  past its stored size and the original had more.
- THE PDF's picture JPEG went to 0.95: a print-size master is on the PDF's own grid, so the second lossy step no
  longer lands on resampled pixels. Against a perfect 300 dpi print: 0.9879 (full-size master at 0.90: 0.9856;
  print-size at 0.90: 0.9819; his compressed PDFs: 0.9871). About +0.3 MB per picture in the PDF.
- PrintHeadroom 1.25 would leave room to enlarge a quarter without Replace, at about half again the bytes
  (0.86 -> ~1.3 MB for the front CGI). Not taken: the PDF cannot use it.
- `Image__SourceW/H` (the original's pixels) ride on the block for the panel; absent on older pictures.
- Measured sizes, RB05 front CGI (13.76 MB PNG): at 196.4 mm 0.86 MB (2320 x 1305); at 280 mm 1.47 MB
  (3312 x 1863); across a full A3 drawing the whole 3840 px is kept (2.03 MB).
