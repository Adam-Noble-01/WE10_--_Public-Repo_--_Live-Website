# Published Documents — the reader

**Created 23-Sep-2026. Adam Noble — Noble Architecture.**
**Status: the folder exists, the code does not.** Phase 2 of
`TrueVision__PLAN__PublishingSystem__.md`.

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

See `TrueVision__PLAN__PublishingSystem__.md` section 2.2 for the file list. Namespace
`Na__PubDoc__`.
