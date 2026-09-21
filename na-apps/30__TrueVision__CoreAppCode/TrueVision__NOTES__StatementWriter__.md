# TrueVision3D — Statement Writer

###### `02__Src__AppModules/51__System__LayoutEditor/52__Feature__StatementWriter/` · first written 20-Sep-2026 for v2.95.0

The project's written documents — a pre-application statement, a design and access
statement, a heritage statement — written in markdown, read as one endless A4 page,
delivered as a PDF, and published to R2 with their pictures on the CDN.

This file is the map. The devlog entry for v2.95.0 is the story of building it;
each module's own header is the detail. What is here is what you need before you
change anything.

---

## 1 · What a statement is

**A folder, not a file.**

```
26-Projects/RB05__WestFarm/30__TrueVision__AppContent/
└── 10__StatementDocs/
    ├── 01__PreApp__Statement/
    │   ├── RB05_T01_S01__WestFarm__PreApplicationStatement__.md   ← the statement
    │   ├── RB05_T01_S01__WestFarm__PreApplicationStatement__.html ← built on publish
    │   ├── RB05_T01_N01__WestFarm__ProjectNotes__.md              ← NOT a statement; left alone
    │   ├── 00__Images__ParkedManifest__.json                      ← what the tidy-up moved
    │   ├── 01_Images__ReferenceImages/                            ← source material, never published
    │   └── 02_StatementDocs__Content__Images/
    │       ├── 02__Site__Location/Location__Far__.png             ← used by the statement
    │       └── 20__Proposed__3dExterior/
    │           └── 00__Images/                                    ← parked: not used, not pushed
    └── 02__DaStatement/
```

The folder cannot say **which** of its markdown files is the statement, so
`TrueVision__StatementDocs__.json` sits beside `TrueVision__ProjectData__.json` and
remembers: for each statement, its folder, its markdown file, its title, and when it
was last published.

**The folder is the truth; the index is the memory.** A statement on disk the index has
never heard of is *offered* in the manager, never adopted on its own.

---

## 2 · The three copies, and which one wins

| copy | written when | who reads it |
|---|---|---|
| the file in the project folder | whenever the typing pauses | Adam, in Typora or in the app |
| the browser draft | a moment after a keystroke | this browser, if the file is older |
| R2 | **only** on Publish | the client, the web viewer, the CDN |

On load the newest is put in front of you **and said so**. Nothing is silently preferred.

`Publish` is the moment a statement becomes something a client can open. Everything
before that is local.

---

## 3 · The byte-for-byte promise

> Open a statement, save it without typing, and the file that comes back is the file
> that went in. Not equivalent markdown — the same bytes.

Every block carries the source lines it was cut from (including the blank lines under
it) and a signature of what it looked like when rendered. A block whose signature still
matches is **copied**, never regenerated. Editing one heading in a 45 KB statement
changes one line.

**If you touch the tokeniser, the renderer or the serialiser, run all three:**

```bash
node 80__Testing__PrototypeEnvironment/Na__Test__StatementRoundTrip__.test.mjs
```

and, in a browser on a served repository:

```
/na-apps/30__TrueVision__CoreAppCode/80__Testing__PrototypeEnvironment/Na__Test__StatementDomRoundTrip__.html
/na-apps/30__TrueVision__CoreAppCode/80__Testing__PrototypeEnvironment/Na__Test__StatementTyping__.html
```

The typing one types a character at a time through the browser's own insertion. It has
to: every bug it has ever caught was invisible to a test that called the handlers
directly.

---

## 4 · The modules

| folder | what it owns |
|---|---|
| `01__Core__Data/` | the index, the open statement, where each copy lives, and which file a picture link means |
| `02__Core__Markdown/` | tokenise → render → serialise. The only place markdown rules live |
| `03__Ui__Page/` | the tab, the bar, and the manager |
| `04__Ui__Editor/` | the live-preview surface, the typing rules, and the frozen raw-HTML cards |
| `05__Ui__Reader/` | the same document with nothing to click. This is what the PDF photographs |
| `06__Export__Pdf/` | the pageless rasterised PDF |
| `07__Export__Publish/` | the HTML build, the picture resizing, and the push to R2 |
| `08__Style__Stylesheets/` | the house document style, and the chrome around it |

**Import the data module by name, never its transport unit** — its export list is the API.

---

## 5 · Three things that will bite you

### The PDF has no text in it, on purpose

Every other exporter in this app embeds Open Sans and writes real text. This one
rasterises. A planning statement is an argument written for a case officer to weigh,
and text that lifts cleanly out of a PDF goes straight into a language model.

**If you make the statement PDF selectable, that is a change of policy, not a bug fix.**
The same note is in the module header and in `LayoutEditor__Statement__PdfNote`.

### The space above a paragraph is load-bearing

The Typora theme never states `p { margin-top }`, so a paragraph keeps the browser's
own `1em` — and h4, h5 and h6 are then given **negative** bottom margins of 2 mm,
measured against exactly that. Set it to zero and every sub-heading lands on top of the
sentence under it. It is stated explicitly in the stylesheet with the reason beside it.

### The local server does not reload its routes

Started without `--debug`, the ProjectVision server on 8090 holds whatever routes it had
when it started. A route added to `ProjectVision__TrueVisionStatements__Api__.py`
answers **405 until Adam restarts it**.

**A stale server does not look broken — it looks empty.** The listing route is a `GET`,
so a server without it does not answer 405; the static file route takes the URL and
answers 404. The tab then reads "This project has no statements yet" over a folder that
holds one, and offers to make a second `01__` folder beside the first. So a failed
listing asks `/api/health` who is answering, and a ProjectVision server missing the
routes gets a red alert at the top of the tab with Create withdrawn.

**Do not probe liveness with a write route.** `POST /api/projects/<code>/files/…` returns
200 by *doing the write* — probing it with `{}` put an empty statement index into a real
project folder. `OPTIONS` cannot tell these routes apart either, because the static
catch-all answers `GET` for every URL. Start the real server on a spare port and probe
*there*:

```bash
python ProjectVision__LocalServer__Main__.py --port 8851 --no-browser --no-app-window
```

A statement route that exists answers **404** to a project that is not there. **405**
means the route is missing.

---

## 6 · Pictures

**Only what the statement links to is published.** RB05's statement folder holds 713 MB;
the statement uses sixteen pictures.

**A link is not a reliable path.** It is whatever Typora wrote, on whichever machine,
before whatever folder rename came after. So the file *name* is trusted and the path is
not: tried as written, then looked for by name anywhere in the statement's folder,
preferring the match whose folders agree most closely with what the link asked for.
Folders named `00__…`, `…__DoNotUse` or `…__Archived` are never searched.

**They go up smaller.** A statement is A4, its text block is 188 mm, and the PDF
rasterises at about 192 dpi — so the widest a picture is ever *seen* at is around
1450 px, against originals 6144 px wide. `ImageMaxEdgePx` is 2000, which keeps a
comfortable margin over anything a reader or a printer can resolve.

**The markdown is never rewritten.** Its links stay relative so the file still opens in
Typora. Only the generated HTML carries CDN URLs.

**The originals on disk are never altered.** Only the copy that is published is resized.

---

## 7 · Git

Nothing under `10__StatementDocs` is tracked except `.md`, `.html` and `.json`. It is an
**allowlist**, because a list of the picture formats seen so far is one new format away
from being wrong — a `.geprint` from a photogrammetry dataset proved that the same day.

`00__Archive`, `00__Archived` and `00__Images` are ignored wherever they appear: somewhere
to park a file without leaving the project folder.

**Already-tracked files are not untracked by a rule.** The repository tracks 5,190 MB,
1,141 MB of it inside `00__Archive` folders, against a GitHub Pages limit of one
gigabyte. Getting that out needs `git rm --cached`, and it is Adam's call.

---

## 8 · Testing it for real

`80__Testing__PrototypeEnvironment/Na__Test__StatementServer__.py` serves the repository
**and** registers the real statement routes against a throwaway copy of the project's
statements folder — markdown copied, photography hard-linked, so a test can rewrite,
move and delete freely and the statement Adam is actually writing is never touched.

```bash
python 80__Testing__PrototypeEnvironment/Na__Test__StatementServer__.py 8841
```

It **cannot** stop the app talking to Cloudflare. Guard `fetch` against `/r2/write`
in the browser before pressing Publish.

---

## 9 · Not done yet

- [ ] **Adam has not confirmed any of it.** Driven end to end against the real RB05
      statement, but nothing has been published to R2 for real.
- [ ] **Not ported to ValeVision.** Every module carries its port note; the transport
      unit is the one that needs its own bucket paths.
- [ ] **The 8090 server needs a restart** before the statement routes answer.
- [ ] **A second statement has never been made** — `02__DaStatement` is an empty folder.
      Create, rename and delete are written and wired but have only been exercised
      through the adopt path.
- [ ] **Dropping a picture in has not been tried with a real file drag** — the code path
      is there and the route takes it, but a pointer has not dragged a file onto the page.
- [ ] **The web viewer reads a published statement from the CDN**, which cannot be true
      until something has been published.

---

## 10 · The picture menu — justify and crop

Right-click a picture in the editor. The menu is the app's own
`Na__ContextMenu__Ui__Open`, so a section is `{ id, rows }` — a bare array of rows
opens an empty menu with no error, which cost half an hour the first time.

| Row | What it writes |
|---|---|
| Justify left / centre / right | `display: block` plus the two margins, on the picture or, once cropped, on its frame |
| Crop… / Crop again… | Opens the drag overlay; Apply writes the frame |
| Remove the crop | Unwraps back to a plain picture keeping the border, the shadow and the size |
| Edit the raw HTML… | The existing frozen-block source editor |
| Take this out of the statement | Deletes the block |

**The rewrite is done on the STRING, never through the DOM.** This is not a style
preference. Set `element.style.border` and read it back and `#555041` returns as
`rgb(85, 80, 65)`; `160.00mm` returns as `160mm`. Both are correct CSS and neither is
what Adam typed, so a single justify would rewrite every figure in the document and the
next save would show forty changed lines. `Na__LeStmtFig__SplitStyle`, `ReadDecl` and
`WriteDecl` work on the attribute text.

### The crop is a frame, and three of its declarations are load-bearing

A crop never touches the image file. It writes a fixed-size `div` with
`overflow: hidden` holding the picture at full size, pushed left and up by what was
trimmed, so Crop again re-picks from the whole original.

```html
<div style="zoom: 100%; display: block; overflow: hidden; box-sizing: content-box;
            width: 169.21mm; height: 105.74mm; border: 10px solid #555041;
            box-shadow: 0 2px 10px rgba(0,0,0,0.8); margin-left: auto; margin-right: auto;">
    <img src="./…/Location__Far__.png"
         style="display: block; max-width: none; width: 188.00mm; margin-left: -18.79mm;" />
</div>
```

- **`box-sizing: content-box`** — the editor sets border-box globally. Under it the 10 mm
  olive border eats into the kept area and shaves a strip off the right and bottom of
  every cropped figure. The trim is measured against the PICTURE, so the frame must be
  sized by its content box.
- **`max-width: none`** — `.na-le-stmt-doc img { max-width: 100% }` is right for an
  ordinary figure and fatal here. A cropped picture is deliberately wider than its frame;
  the clamp shrinks it back and the crop takes nothing away, leaving blank paper on the
  right.
- **`white-space: normal` on `.na-le-stmt-frozen__body`** (in the stylesheet, not the
  markup) — Chrome gives every contenteditable element `white-space: pre-wrap` and it
  inherits down, so the newline and indent before the `<img>` were drawn as a real line
  and pushed the picture a line down inside its own frame. This was never only about
  crops: **any** raw HTML block written across several lines had that gap in the editor
  and not in the reader.

None of the three is visible in the markup. All three were found by measuring the frame's
content box against the picture's box in a rendered document — `Na__Test__StatementFigure__.html`
checks the markup, and only a live render catches these.

---

## 11 · Proving the document matches Typora

Adam's charge, 20-Sep: the fonts are not Open Sans, the heading sizes are nothing like
Typora, the spacing at the top is wrong.

**Do not argue this from reading two stylesheets.** `Na__Test__StatementTypography__.html`
renders the same markup twice — once under `Na__Test__Reference__TyporaTheme__.css`, a
copy of the real theme kept beside it so the reference cannot drift, and once under the
statement stylesheet — and compares family, size, weight, style, colour and both margins
across eighteen kinds of element. It also measures a text run to prove Open Sans is
actually being drawn rather than a lookalike fallback.

The strongest check is outside the harness and worth repeating whenever this is doubted:
render the real RB05 statement under both stylesheets with html2canvas and hash the two
PNGs. On 20-Sep-2026 they were **the same SHA-256**.

**Three differences are stated, not tolerated silently:**

- The theme never names a bare `code` or `pre` — only `.md-fences`, `.CodeMirror` and
  `.code-tooltip`, which exist inside Typora and nowhere else. The statement applies the
  theme's own fence values (06.50pt, `#202930`, `#f4f4f4`) to the elements a browser
  actually gets.
- The theme colours paragraphs `#3c3c3c` and leaves list items, cells and quotes to the
  base stylesheet Typora loads underneath it. The statement carries that one colour
  through the document, so a sentence does not change colour on becoming a bullet.
- Monospace is Lucida Console first, the app's own, ahead of Courier New.

### Two traps that make a correct document look wrong

1. **The font console lies by omission.** The block in `Index.html` used to load three
   named weights and print three fixed lines, written before the Medium (500) cut
   existed — so it reported Regular, SemiBold and Light loaded while every heading was
   asking for the fourth, and read like proof that 500 was missing when it had never been
   asked for. It now loads all four and prints what `document.fonts.check` says for each,
   including the word MISSING.
2. **A stale stylesheet, which is what Adam was actually seeing.** The two statement
   stylesheets used to be injected as `<link>` tags on first mount and were NOT in the
   service worker precache list. Away from `localhost` the shell is served
   stale-while-revalidate, so the first load after either file changed painted the
   statement with the previous release's styling and only a second reload put it right —
   wrong face, wrong heading sizes, loose spacing, and the `<hr>` drawn as an empty box.
   Both are now in `PWA_SW_SHELL_PRECACHE_RELATIVE` so the version token governs them.

**If the styling ever looks wrong again, check in this order:** is the statement CSS in
the page at all (`document.querySelector('link[href*="Styles__Statement__Document"]')`),
does `<hr>` render as a line or a box, and only then look at the stylesheet.

---

## 12 · The figure frame, and the two places the theme collides

### The frame is a class now, not eighteen inline copies

A figure says `class="na-figure"` and
`Na__LayoutEditor__Styles__Statement__Document__.css` draws the edge:

```css
.na-le-stmt-doc .na-figure {
    border      : 02.00px solid #555041;
    box-shadow  : 0 01.00px 06.00px rgba(0, 0, 0, 0.18);
}
```

Until 21-Sep-2026 every figure spelled out `border: 10px solid #555041` and a 0.8-alpha
black shadow inline — eighteen identical copies in the RB05 statement. At 144 dpi that
border prints about 2.5 mm and reads as a picture rail around a white CGI. Adam chose the
olive kept and the weight taken out.

**The crop had to learn this.** The frame is the element with an edge, so:

- `BuildCrop` moves the class OUTWARDS onto the `<div>`; leaving it on the `<img>` would
  draw the border inside the window and clip three sides off it.
- `Uncrop` moves it back IN onto the picture.
- `Na__LeStmtFig__Dress` reads **both** forms — the class and the old inline border/shadow —
  so a statement written before today keeps exactly the frame it was written with instead of
  silently changing the first time somebody crops it. Do not delete that branch.

The logo is an `<img>` too and must NOT wear the class; it is the one picture in the
document with no frame.

### Two places the Typora theme collides with itself

Both are **stated departures from the theme**, not alignments — the theme has the same fault.

1. **A heading immediately before a table.** h4, h5 and h6 end two millimetres SHORT
   (`margin-bottom: -02.00mm`), which works because a paragraph opens with `1em` of its own
   and the two settle into a deliberate 1.53 mm. A table brings nothing —
   `table { margin-top: 00.00mm }` — so the heading gets buried. The theme's own note calls
   h5 the heading "used where zero gap is required... a table heading being the case it was
   added for", but h5 carries the same minus two, so **no heading level in the theme can
   safely introduce a table.** Fixed with `h1..h6 + table { margin-top: 1.00em }`.

2. **A heading immediately after a picture.** A picture is inline and brings no bottom
   margin, so a title under the company logo has only its own 0.83em measured from the
   logo's *baseline*. Fixed with 8 mm.

**Both rules are written twice, once for each shape the document takes.** In the READER a
raw HTML block is emitted as it stands, so a table is a bare `<table>` and a picture a bare
`<img>`. In the EDITOR the identical markup is wrapped in `.na-le-stmt-frozen`, and the
adjacent-sibling selector cannot see through it — hence the `:has(table)` variants. Every
table in these statements is a raw HTML block, because the column widths are set with
spans. Fix only the reader and the heading stays buried in the editor and clear on the page.

---

## 13 · Why the PDF is big, and why there is no clever fix

**9.58 MB at the old default. Do not go looking for a smarter encoder.**

The statement is rasterised ON PURPOSE (section 1) so the text cannot be lifted out of it.
That means the file is images and nothing else, and roughly sixty per cent of the RB05
document's height IS photographs. The only levers are resolution and JPEG quality.

**WebP is not a way out**, which is worth stating because it looks like one: jsPDF exposes a
`processWEBP`, but **PDF has no WebP image format** — it carries DCTDecode (JPEG), Flate and
JPEG2000 — so jsPDF decodes the WebP and re-encodes it anyway.

Measured on the RB05 statement, re-encoding its own tiles:

| RasterScale | JpegQuality | page dpi | file |
|---|---|---|---|
| 2.00 | 0.92 | 192 | 9.58 MB |
| 1.50 | 0.80 | 144 | **4.15 MB** ← the default since 21-Sep-2026 |
| 1.25 | 0.75 | 120 | 2.91 MB |

`LayoutEditor__Statement__PdfPresets` now holds two: `full` (the default, 1.50/0.80) and
`print` (2.00/0.92, the old behaviour). Each preset becomes a button on the statement bar,
so adding a third adds a third button.

**Check zero-text after any change to the exporter** — it is the whole point of the module:

```bash
python -c "import fitz; d=fitz.open('file.pdf'); print(len(d[0].get_text().strip()), 'chars')"
```
