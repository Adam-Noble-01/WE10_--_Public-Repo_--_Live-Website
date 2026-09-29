# Document Sharing

**Created 29-Sep-2026 (TrueVision v2.166.0). Adam Noble - Noble Architecture.**

A **Share** button in the read view of every tab hands out a link that opens that one
document, read-only, on any device - so a drawing, the Project Specification, the Document
Register or a Design Statement can be sent to a client or a planning officer as a link.

| Where the button is | What it shares |
|---|---|
| Web viewer's dock, beside **PDF** | The drawing on screen (under the register: the register) |
| Editor toolbar, beside **Download PDF** (localhost) | The drawing on screen - always the live site's link |
| Specification bar, **Read** view (and the web viewer) | The Project Specification |
| Document Register bar, **Read** view (and the web viewer) | The Document Register |
| Statements bar, **Read** view (and the web viewer) | The statement open in the picker |

One press copies the link and opens a small box with it: **Copy link**, **Share...** (the
device's own share sheet, where there is one) and **Open**.

## What a link looks like, and how it is answered

```
shared                    https://www.noble-architecture.com/s/?RB05&open=Sheet_004
        |
        v   s/index.html at the website root looks RB05 up in q/index.json
        |   (the QR resolver's index, written by the ProjectVision build script)
        |
opened                    .../na-apps/30__TrueVision__CoreAppCode/Index.html
                          ?project=RB05&project-folder=RB05__WestFarm&year=26&open=Sheet_004
        |
        v   Na__LayoutEditor__Share__Open__ reads open= and opens the READ view
```

**The link carries the project's CODE and the document's KEY and nothing else** - no folder,
no year, no app path. Moving the app, renaming a project folder or changing how jobs are
filed changes none of it: `s/` finds the folder in the index, and the app finds the document.

## The keys - permanent, and chosen from what never moves

| Document | Key | Why this and not something shorter |
|---|---|---|
| A drawing | its sheet id, `Sheet_004` | NOT its number: D02 comes from the register's order, so one dragged row renumbers every drawing below it and a link carrying D02 would quietly open a different drawing. The sheet id survives rename, renumber, a new phase and a new revision. |
| A statement | `Statement_<Doc__Id>` | The statement index hands each id out once and never reuses it. |
| The specification | `Specification` | One per project. |
| The register | `Register` | One per project. |

These are **rules in code** (`Na__LayoutEditor__Share__Links__.js`), not settings: a key is
what an already-sent link carries. A new spelling may be added to `Parse`; none may change.

`Parse` is liberal: `spec`, `statement-2`, `sheet_4`, `SHEET_004` all read back correctly, and
a key it does not recognise is tried as a drawing's document id (`RB05_T01_D02`) or number
(`D02`) - the form a person typing a link by hand would use. A drawing that is gone opens the
Document Register with a toast saying so.

## The share link record - "saving them in a dynamic manifest"

`06__Layout__PublishedDocuments/PublishedDocuments__ShareLinks__.json`, beside the published
index, locally and on R2. Adam, 29-Sep-2026: *"saving them in a dynamic manifest is probably
the best thing, so in the future, it doesn't fuck it up if I change the logic or any of the
placement for new jobs, or how I put things in folders."*

- **Written** by every Publish Drawings, just before the index (to R2 when "Also push to R2" is
  ticked), and again whenever a statement is published (locally and to R2). Never by a Share
  button.
- **Read** by the Share buttons (the address on record is what they hand out) and by the app
  when it is opened by a link (the target on record is what the key opens), before either
  falls back on the rules. So when the rules change, a project published under the old ones
  keeps handing out - and answering - the same links.
- **Holds** every document (published or not), its key, address, label and target identity,
  the resolver the addresses were built against, and `ShareLinks__Aliases` - reserved: an old
  key listed there goes on opening its current document. Aliases are carried forward, never
  rebuilt.
- **Does not hold** whether a drawing is published. The index says that, at the moment it is
  asked; a record carried to R2 by a statement publish must never claim a drawing R2 lacks.
- A project published before v2.166.0 has no record: the buttons build the same links from
  the rules, and the app resolves keys from the project it has. Nothing breaks.

## Files

| File | What it does |
|---|---|
| `Na__LayoutEditor__Share__Links__.js` | **The builder.** Keys, the liberal parser, `SameKey`, `BuildUrl`, the project on screen, the `open=` key on start. No DOM. |
| `Na__LayoutEditor__Share__Manifest__.js` | **The record.** Build it from the project's documents, write it (here first, then R2), read it back, `Find` a key (aliases, case, zero padding), `DrawingState` from the index. |
| `Na__LayoutEditor__Share__Button__.js` | **The Share box** every button opens. Works the link out BEFORE anything is awaited, so Safari lets the copy happen. |
| `Na__LayoutEditor__Share__Open__.js` | **The app's half of the resolver.** On start: waits for the sheets (a reader) or the model (an author), opens the document's Read view, lifts the loading screen off it for a reader, and puts it back if they go to the 3D Model tab before the model has arrived. |
| `Na__LayoutEditor__Share__Config__.json` | The resolver address and pattern, the start-up waits, every word the box says. |
| `Na__LayoutEditor__Styles__Share__.css` | The box. Imported by the stylesheet index, never linked lazily (see the file). |
| `s/index.html` (website root) | **The resolver.** Must never move. |

## The things that must never break

1. **`s/` at the website root must never be moved, renamed or removed.** Its TrueVision
   address (`NA_SHARE_TARGET_APP`) has a twin in `q/index.html` (`NA_QR_TARGET_APP`): if the
   app moves, change both. `Na__Test__ShareLinks__` fails if they differ.
2. **Every form ever handed out must go on being answered** - `s/` also answers `p=`,
   `project=`, `d=`, `doc=` and the key as a bare second token.
3. **A key form must never be removed from `Parse`.**
4. `s/` reads `q/index.json`, so a project must be in that index (the build script puts every
   valid project there) and the site must be deployed for a link to open.

## How it was proved

- `80__Testing__PrototypeEnvironment/Na__Test__ShareLinks__.test.mjs` - 68 checks: the builder
  and parser, the record (write order, local before R2, nothing to R2 when the local write
  fails, queueing, aliases), the record read back, and `s/index.html`'s own script run in a
  sandbox against the real `q/index.json` for every link form.
- `Na__Test__PublishedSchema__` region 6A - the example folder's record.
- In the app (RB05, 29-Sep-2026): each tab's link opened its read view on the read-only build;
  each Share box handed out the right `/s/` address and copied it; the fallbacks and a missing
  drawing behaved; with the 3D model held back 25 s a statement link opened 41 ms after the
  drawings arrived; the author's editor waited for the model; the record built from RB05's 17
  documents went local-then-R2 with identical bytes (both writes faked - nothing was written).
