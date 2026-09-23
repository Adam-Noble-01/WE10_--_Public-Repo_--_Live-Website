# Published Schema — the shared contract

**Created 23-Sep-2026. Adam Noble — Noble Architecture.**
**Status: the folder exists, the code does not.** This README and the parity link are
Phase 1 of `TrueVision__PLAN__PublishingSystem__.md`; the three modules below are written
when Phase 1 starts.

---

## ⚠ PARITY: THE READABLE SCHEMA LIVES OUTSIDE THIS APP

**Read this before changing any published data structure.**

```
na-project-portal/26-Projects/AA00__ExampleProjectStructure/
    30__TrueVision__AppContent/06__Layout__PublishedDocuments/
```

That folder is a complete worked published project — index, three documents, every
element file, the viewport SVGs, the four raster tiers, a revision archive zip. **It is
the schema in its readable form**, and it is the template Adam looks at to see the shape
of a published drawing for every job.

It is deliberately in the project portal and not in this app, because it is a *document*
about documents rather than code. That is also the danger: **nobody working in here will
trip over it.** Hence this note, and hence the `SCHEMA REF` line in the header of every
file in all three publishing modules.

### The rule

**A change to any published key, file name, folder name or raster tier is not finished
until the example folder matches it.**

- Add a key to an element file in code → add it in the example.
- Rename a folder → rename it in the example.
- Change the tier ladder → change `PublishedDocuments__Index__.json` in the example.
- Delete a key → delete it there, and say why in the example's ReadMe.

### The check

`Publish__SchemaVersion` is carried in both places:

| | File | Key |
|---|---|---|
| here | `Na__PublishedSchema__.json` | `PublishedSchema__Version` |
| there | `PublishedDocuments__Index__.json` | `PublishedDocuments__Publish.Publish__SchemaVersion` |

**If the two numbers differ, the example is stale and the schema is undocumented.**
Bumping the version is a deliberate act: a reader that understands schema 2 has no
obligation to understand schema 1, so every published document in the R2 bucket must be
re-published.

The example folder's own `PublishedDocuments__ReadMe__.md` carries the matching note
pointing back here. A note at only one end is a note somebody will not read.

---

## What this module is for

The vocabulary both halves of the publishing system share, and the only module either of
them imports from the other's side:

- `51__System__LayoutEditor/65__Feature__DocumentPublishing` — the baker, authoring only
- `52__System__Layout__PublishedDocuments` — the reader, loaded by everyone

Neither imports the other. Both import this. **If a key exists in both the publisher and
the reader and not here, that is the bug** — it is how the two drift, and drift between a
writer and a reader of the same file shows up as a blank drawing on a client's phone.

```
53__Data__Layout__PublishedSchema/
    Na__PublishedSchema__.json          Schema version, file names, folder names, the tier table
    Na__PublishedSchema__Paths__.js     Folder and file name builders; both sides use these
    Na__PublishedSchema__Version__.js   The version gate: what a reader will and will not read
    README__PublishedSchema__.md        This file
```

Namespace `Na__PubSchema__`.

## Why 52 and 53 at root

`51` is the editor, `52` the published documents, `53` their schema — one run, read in
that order. Freeing the two numbers on 23-Sep-2026 moved `52__System__SitePlanData` to
`51__System__LayoutEditor/21__System__SitePlanData` and `53__System__ProjectQrCode` to
`51__System__LayoutEditor/53__Feature__ProjectQrCode`, both being layout-editor-only.
`54__Feature__ColourPalette` was left at root deliberately: it is imported by
`43__System__PlanAnnotations` as well as by the editor, so it is a shared UI utility and
does not belong inside either.
