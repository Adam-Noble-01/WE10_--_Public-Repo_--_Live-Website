# Published Documents — the reader

**Created 23-Sep-2026. Adam Noble — Noble Architecture.**
**Status: BUILT and live (TrueVision v2.155.0, loading screen v2.156.0).** Phase 2 of
`TrueVision__PLAN__PublishingSystem__.md`; the DEVLOG entries say what was proved.

---

## SCHEMA REF

```
na-project-portal/26-Projects/AA00__ExampleProjectStructure/
    30__TrueVision__AppContent/06__Layout__PublishedDocuments/
```

The readable schema, and the fixture this module is written against. Change a key here,
change it there — the rule and the version check are in
`53__Data__Layout__PublishedSchema/README__PublishedSchema__.md`.

---

## What this module is

The reader that shows a **published** drawing to somebody on the live web. It reads baked
files and paints them. **It contains no renderer, and that is the whole point.**

Nothing in this folder may import, directly or transitively:

- `50__System__ProjectedLinework` — no projection, no workers, no styling rules
- `51__System__LayoutEditor` — no sheet surface, no tools, no panels
- `30__System__ImageExport` — no tiled renderer, no supersampler, no sharpener
- `05__RenderPipeline`, `15__ModelLoader` — no model, no Three.js

A drawing tab must not be able to start a render on a reader's device even by accident.
The guarantee is structural: if the code is not in the module graph, no branch can reach
it. A fingerprint check that falls back to computing the drawing is what crashes phones,
and there is no fingerprint check here — a document is either published, or the reader
draws the sheet and a grey mask saying it is not.

## Why this is top-level and not inside the editor

Because it must be loadable **without** the editor. It is mounted by
`51__System__LayoutEditor/80__Feature__WebViewer`, which owns the dock and the tab strip,
and that one file is the only bridge between the two halves. The dependency runs one way:
the editor's viewer shell may reach in here; nothing here reaches back.

## The files

| File | What it does |
|---|---|
| `Na__PubDoc__Document__.js` | Loads the index, a drawing's manifest, sheet and element files; builds the sheet as one SVG string. Reports each file's progress to a listener. |
| `Na__PubDoc__Urls__.js` | Where a published file is: R2 through the CDN first on the live site, the repository copy first on localhost. |
| `Na__PubDoc__Viewports__.js` | A viewport: its picture at the tier the screen needs, its linework, its fog mask. |
| `Na__PubDoc__Sheet__.js`, `Na__PubDoc__Paint__.js`, `Na__PubDoc__Elements__.js` | The paper, SVG helpers, and the painters for a sheet with no paint plan (the example folder). |
| `Na__PubDoc__Unpublished__.js` | The grey panel: "Drawing has not yet been published officially". |
| `Na__PubDoc__LoadingScreen__.js` | The cover over a drawing while it arrives: "D02 - Elevations is now loading", the work outstanding underneath, lifted when every file, picture and font is on the page. Imports nothing. |
| `Na__PubDoc__Config__.json` | Every setting the reader may decide: fetch, tiers, sheet, grey panel, loading screen, labels. |
| `Na__PubDoc__Styles__Main__.css` | Host-only styles. Nothing on a published sheet depends on it. |

Namespaces `Na__PubDoc__` (and `Na__PubLoad__` for the loading screen).
