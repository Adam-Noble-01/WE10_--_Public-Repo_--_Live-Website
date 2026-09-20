# Project QR Code

One QR code per project, printed automatically on every document in the pack, so
anybody holding a drawing can point a phone at it and be standing in the 3D model.

The code is the same on every sheet of a project and different for every project.
Nothing is typed, chosen or exported by hand: a document asks this system for the
symbol of the project on screen and paints what it is given.

## What is printed, and what happens when it is scanned

```
printed on the drawing     https://www.noble-architecture.com/q/?PS01            42 bytes
        |
        v   q/index.html at the website root looks PS01 up in q/index.json
        |
opened on the phone        .../na-apps/30__TrueVision__CoreAppCode/Index.html
                           ?project=PS01&project-folder=PS01__MustersRoad&year=26   135 bytes
```

**Why the printed address is not the app's address.** How many modules a QR symbol
has is decided by how long its address is, and how big each module prints is what
decides whether a phone can read it.

| Address | Bytes | Symbol | Module in the 10 mm title block |
|---|---|---|---|
| Full TrueVision address | 135 | version 8, 49 modules | 0.19 mm - unreadable |
| `/q/?PS01` | 42 | version 3, 29 modules | **0.30 mm** |

The full address was tried first (19-Sep-2026). It needed a 20 mm title block to
print a readable module, and Adam judged that strip "too tall, too portrait-feeling,
and stretched". The short address prints a larger module than Lantern Designer's
(0.267 mm, 33 modules) in the same 8.8 mm square and the same 10 mm strip.

**42 bytes is exactly what a version 3 symbol holds. There is no headroom.** One more
character anywhere - a folder name longer than `q`, a query key, a five character
project code - is a version 4 symbol and a module about a tenth smaller. The only
lever left is the host: a short domain of its own (`https://na3d.uk/PS01`, 20 bytes)
would be version 2, 25 modules.

## The three things that must never break

1. **The `q` folder at the website root must never be moved, renamed or removed.**
   A code on an issued drawing sits in a site bag or a planning file for years.
2. **`q/index.json` is written by the ProjectVision build script** - never by hand.
   `na-apps/05__ProjectVision__CoreAppCode/ProjectVision__BuildScript__.py` rewrites
   it on every build, listing every valid project folder; `--qr-index-only` rewrites
   it alone. A project TrueVision can open has been through that script, so it has
   its entry. The Project Manager carries a rename or a delete on to it in the same
   breath as the master index (`_update_qr_index`), because a *stale* entry is worse
   than a missing one: the resolver only falls back to the master index when a code is
   not listed at all. It has to be **published** with the rest of the site to take effect.
3. **If the printed pattern ever changes, `q/index.html` must go on answering the
   old one.** It already answers `?PS01`, `?p=PS01`, `?project=PS01` and `#PS01`.

The resolver is also what keeps old paper alive when the *app* moves: the TrueVision
address lives in that one page, and changing it there re-points every code ever
printed.

On the authoring machine this system reads the index once per project and warns on
the console if the project on screen is missing from it, or is listed under another
folder or year - because a drawing exported then would carry a code that opens nothing.

## Files

| File | What it does |
|---|---|
| `Na__ProjectQr__Symbol__.js` | **The one door in.** Config, the cached symbol for the project on screen, the note's words, the index check and the print-size check. |
| `Na__ProjectQr__Encoder__.js` | Text to QR matrix. First-party, no dependencies: byte mode, level M, versions 1-10. Ported from Lantern Designer. |
| `Na__ProjectQr__Painter__.js` | The symbol as **one vector path**: an SVG group, a whole SVG document, or straight into jsPDF. |
| `Na__ProjectQr__ProjectLink__.js` | Builds the address from the config's pattern and the project on the address bar. |
| `Na__ProjectQr__Config__.json` | The address, the symbol's colours, quiet zone and smallest readable module, and the words. |

Where a document *puts* the code is that document's business. The drawing title
block's cell is `51__System__LayoutEditor/10__Core__SheetSurface/Na__LayoutEditor__TitleBlock__QrCell__.js`,
sized by the `QrCell...` keys of `LayoutEditor__TitleBlock__Config`.

## Putting the code on another document

```js
import { Na__ProjectQr__GetSymbol, Na__ProjectQr__GetNote, Na__ProjectQr__GetSetup, Na__ProjectQr__CheckPrint }
    from '../../53__System__ProjectQrCode/Na__ProjectQr__Symbol__.js';

const symbol = Na__ProjectQr__GetSymbol();            // null: no project, or switched off - draw NOTHING, not even the note
if (symbol) {
    const colours = Na__ProjectQr__GetSetup().symbol;
    const note    = Na__ProjectQr__GetNote('drawing register');   // { heading, body, compact }
    Na__ProjectQr__CheckPrint(symbol, sizeMm, clearMarginMm, 'Drawing register');   // warns once if a phone could not read it
    // ...then one of the three painters below
}
```

| The document draws with | Use |
|---|---|
| Sheet chrome primitives (drawing sheets, the Specification PDF) | `Na__LeChrome__PushQr(list, x, y, sizeMm, symbol, colours.darkColour, colours.lightColour)` |
| Raw jsPDF (the Drawing Register PDF) | `Na__QrPaint__DrawPdf(doc, symbol, x, y, sizeMm, dark, light)` |
| HTML (the Specification's reading view) | `Na__QrPaint__SvgDocument(symbol, { title, cssClass })` - its viewBox carries its own quiet zone |

Rules for whoever does it:

- **x, y and sizeMm are the symbol edge to edge.** Keep `quietZoneModules` of clear
  paper round it; rules and type both count as not clear.
- **Size it from the module, not the other way round.** Aim for 0.30 mm a module or
  more: an A4 register has room for a 12 mm code, which is 0.41 mm.
- **Never rasterise it.** The painters draw one filled path, so a viewer cannot leave
  hairlines between modules and the code stays sharp at any zoom.
- **No symbol, no note.** A sentence telling people to scan a code that is not there
  is worse than neither.

## How it was proved

The encoder is first-party, so it was proved three ways, none of which is "it looks
like a QR code":

1. **A decoder written separately from it**, in `80__Testing__PrototypeEnvironment/Na__Test__ProjectQr__.test.mjs`:
   the format and version information must be valid BCH codewords, every Reed-Solomon
   syndrome must be zero, and the payload must come back as the exact string that went
   in - for every version from 1 to 10 at its longest and shortest payload. The Lantern
   original was never exercised above version 4; versions 7 up (the version information
   block, the two-group interleave) are first proved here.
2. **OpenCV's decoder**, which nobody here wrote (`Na__Test__ProjectQr__Decode__.py`):
   every case reads, and in every run there has never been a wrong read.
3. **Real exported PDFs.** Title blocks were exported through the app's own chrome and
   jsPDF options on A1, A2, A3 and A4, rasterised by PyMuPDF at 200 to 600 dpi and read
   by OpenCV. Every clean render decoded to the exact address (a tight crop from 200 dpi,
   the whole corner of the sheet from 300 dpi); each code is one filled path of 217
   rectangles; 80 renderings, no wrong read. A 3 module quiet zone was tried against
   the shipped 2 under identical noise and read *less* often (155 of 384 against 172),
   so the tight margin stayed.

What has **not** been done is a phone pointed at a sheet of paper. OpenCV is a far
fussier reader than a phone, and the module is larger than Lantern Designer's, which
scans - but print one drawing and scan it before the first pack goes out.

The same test holds the shipped config to its own floor on every run, and fails when
`q/index.json` has fallen behind the project folders on disk.
