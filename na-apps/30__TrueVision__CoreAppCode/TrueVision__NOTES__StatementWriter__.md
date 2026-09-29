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

**That was the intent; until v2.157.0 it was not what happened** between the first two rows:
a draft that differed from the file was put back unasked (the toast calling the file older
was never checked), and the autosave wrote over the file without looking. The file and the
app's copy are now kept in lockstep and a split is ASKED - section 15.

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
| `02__Core__Markdown/` | tokenise → render → serialise, and a figure's picture + title block (`Md__Figure`). The only place markdown rules live |
| `03__Ui__Page/` | the tab, the bar, and the manager |
| `04__Ui__Editor/` | the live-preview surface, the typing rules, and the frozen raw-HTML cards |
| `05__Ui__Reader/` | the same document with nothing to click. This is what the PDF photographs |
| `06__Export__Pdf/` | the pageless rasterised PDF |
| `07__Export__Publish/` | the push to R2 (`Publish__`), the picture resizing (`Publish__Images__`), and the published page itself (`Publish__Page__`, pure) - see section 20 |
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

**A smaller copy must not make a smaller figure** (v2.170.0). A figure is its picture's pixels times its
Typora zoom, so the published page describes each resized copy by its own width at its original's size -
`srcset="<cdn> 2000w" sizes="6144px"`. Never a density (`0.3255x`): the browser then offers the src as a
1x copy too and always takes it. Section 20.

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

---

## 14 · The keyboard is the documents' own (v2.110.0)

**A letter typed here is a letter.** Until 21-Sep-2026 it was not always: the 3D Model tab's
hotkeys (`Na__Hotkeys__Manager`) listened on the window for the whole session, never asked
which tab was up, and their typing test knew input, textarea and select but not
contenteditable - and this page is contenteditable, the only such surface in the Layout
Editor. So R, B, T, Y, 1-9 and Page Up / Page Down were taken out of the statement to
reset, walk or fly a hidden camera. The drawing tools' keys were never the thief: they are
detached on every document tab.

**Three keyboards, one live at a time** (`03__AppUtils/Na__AppUtils__KeyScope__.js`): model
on the 3D tab, sheet on a drawing tab, document on the Specification, the Register and
here. The mode controller answers which, afresh on every key.

**This tab's keys are bound in the documents' own key map**
(`51__System__LayoutEditor/31__System__DocumentKeys/Na__LayoutEditor__DocumentKeys__Config__.json`),
heard before anything else in the app, and registered by the page:

| key | action | what it does here |
|---|---|---|
| Ctrl+S | `Doc__Save` | writes the statement to its file, as the Save button does. It used to save the SHEETS |
| Ctrl+/ | `Doc__ToggleSource` | the raw markdown, and back (from Read it opens Edit first) |
| Ctrl+. | `Doc__ToggleMono` | Lucida Console, and back; remembered in this browser |

A binding that would type a character is never acted on while the focus takes text,
whatever the key map says. To add a key: a row in the key map, and an action in the
page's `Na__LeDocKeys__Register` call.

**Testing typing: the pane's `type` action proves nothing.** It inserts text WITHOUT firing
keydown, so it passes on code that eats every key. Use the `key` action, which fires
trusted keydowns and inserts their text - but it sends no text for Space or Shift+letter
(a plain textarea gets `ab` from `a space b shift+c`), so compare against a control.
`Na__Test__DocumentKeys__.test.mjs` covers the logic without a browser.

---

## 15 · Lockstep with the file (v2.157.0)

**Agents and Typora write the markdown file directly, behind the app's back.** Adam,
23-Sep-2026: "force you to say, 'I want the JSON if it's newer,' or 'I want the Markdown,' so
you can make that choice in the app." The "JSON" is the app's copy: what is on screen, kept
in this browser between saves as the draft `{ Text, Iso }`.

**When the file is looked at** (`Na__LayoutEditor__Statement__Data__`): on open; every
`LockstepPollMs` (3 s) while the Statements tab shows and the browser tab is visible; when
the window regains focus or the tab becomes visible; and **immediately before every
autosave**. A hidden tab is not polled - it is looked at the moment it comes back.

**The four states** (`Na__LayoutEditor__Statement__Lockstep__`, pure, node-tested):

| file vs last read/written | on screen vs last read/written | state | what happens |
|---|---|---|---|
| same | same | in step | nothing |
| same | changed | app ahead | the ordinary autosave writes it |
| changed | same | file ahead | **asked** |
| changed | changed | diverged | **asked** (unless both now hold the same words: taken as saved) |

**Content decides; the clock only explains.** Nothing compares the browser's clock with the
server's to decide anything. The draft's `Iso` and the server's `Last-Modified` are shown
beside each answer, and "Newer" is badged only when they are more than a second apart.

**The question** (`Na__LayoutEditor__Statement__Page__`): a sheet over the desk with no close
button - nothing is saved while it stands. "Keep the app's copy" writes it to the file
(`ResolveConflict('app')`, a forced save that skips the look); "Load the markdown file"
replaces the app's copy (`'file'`). **The copy not chosen is kept in this browser**:
`localStorage['Na__TrueVision__StatementDiscarded__<folder>__<id>']`, the latest only.

**No server change.** The ProjectVision server already sends `Last-Modified` (and an ETag)
for the markdown, so no new route and no 8090 restart. On localhost the service worker goes
network-first with `no-store`, so the watch always sees the real file.

**Testing it** on the statement test server (`tv-statement`, port 8841, a throwaway copy of
the statements folder): append to the copy's `.md` on disk with Bash to play the agent, or -
to land an outside write inside the autosave's window - import
`03__AppUtils/Na__AppUtils__LocalProjectMirror__.js` in the page and call
`Na__LocalMirror__WriteStatementFile(path, text)`, which bypasses the data module exactly as
Typora does. Drive the data module by its same-URL import (`Na__LeStmt__SetText`,
`StopWatch`, `GetConflict`); answer with real clicks. **Stop the server gracefully or delete
its `%TEMP%\na_statements_live_*` folder** - a hard stop leaves ~700 MB of photography behind
on C:, because hard links fail from D: to C: and it copies instead.

**The Project Specification now runs the same system (v2.163.0, 29-Sep-2026).** Its JSON file
(`TrueVision__DrawingNotes__.json`) is watched while the drawing editor is open and looked at before
every write, with the same verdict: `Na__LayoutEditor__SpecData__Lockstep__` imports this section's
`Na__LeStmtLock__Compare`, `NeedsChoice`, `Newer` and `FromHttpDate`, and its question imports `When`.
**Changing those exports changes the specification too.** Test: `Na__Test__SpecLockstep__.test.mjs`.

## 16 · Standard sections (v2.162.0)

**What they are.** Parts of a statement that are the same on every job apart from the project they name
(the TrueVision 3D Project Hub), the headings they are drawn from (the Contents) or the few fields they
carry (the Document Header). Edit mode > **Standard Sections** on the bar switches each on or off;
a card offers Move (not the header), Edit and Switch Off. Code: `09__Standard__Sections/`.

**Stored as one marker, drawn every time.** The file holds
`<div class="na-le-stmt-std-marker" data-na-standard-section="<Id>">...</div>` and nothing else of the
section. The renderer's expander (`Na__LeStmtRnd__RegisterExpander`) swaps the marker for the drawn
section in every surface - editor, reader, published HTML, PDF - with the document's blocks as context.
Typora and anything else reading the file see the marker's fallback sentence. **The header's marker
holds its fields** between the tags, one a line; a blank line inside it would end the block in Typora,
so the registry never writes one.

**The house order and the dividers.** Adam: 1. the header, 2. the header information, 3. the contents,
4. the TrueVision section, 5. the introduction. The header takes over the top of the file; the Contents
goes after the first divider above 1.0; the hub after the Contents. Every section but the header sits
between two major dividers: on adds the one under it, off takes it away, and Move carries it. **Two
dividers must never touch** - the test checks the whole file for it.

**Three traps.**
1. A card's body is repainted from its source by `Na__LeStmtCard__Repaint`. It must go through
   `Na__LeStmtRnd__Expand`, or a standard card shows its fallback sentence after an Edit.
2. The Contents is drawn from the headings. Inside a full render the renderer hands it the blocks; a
   repaint outside one asks the registry's document source, which the editor sets to the page as it
   stands. Change either and the Contents silently lists stale headings.
3. The PDF photographs the page, so the hub's button would be a picture of a button. `Pdf__.js` lays a
   link annotation over every http(s) link it measures before tiling. Check zero text AND the links
   after any exporter change.

**Tests.** `Na__Test__StatementStandard__.test.mjs` (node, 45 checks, the real modules copied into a
scratch ES module tree); `Na__Test__StatementStandard__.html` (the paper, `?statement=` for a whole
file, `window.__NaTestStd.raster(sel)` through the vendored html2canvas).

## 17 · Figure titles are inside the figure (v2.165.0)

**What changed.** A figure's title used to be a paragraph of its own under the picture, pushed across
by a zero-width space and two tabs (`\u200B\t\t**Fig 3.1  -**  ...`). The editor keeps whitespace
(contenteditable is `pre-wrap`), so the title looked aligned there. The reader and the PDF collapse it,
so every title sat against the page margin under a centred picture. Adam, 29-Sep-2026, on RB05's
Fig 3.1: "the titles aren't being inset properly against the images".

Now the picture and its title are ONE raw HTML block, with no blank line inside:

```html
<figure class="na-figure-block" style="margin-left: auto; margin-right: auto;">
<img class="na-figure" src="./02__DocImages/..." style="zoom: 30%; display: block; margin-left: auto; margin-right: auto;" />
<figcaption class="na-figure-title"><strong>Fig 3.1  -</strong>  Site Location  -  Local Context</figcaption>
</figure>
```

**How it lines up, with no script.** The stylesheet lays the figure out as a `table` and the title as
its `table-caption`. A table with no width of its own is as wide as its picture (zoom included), and a
caption is held to the table's width. So the title starts at the picture's left edge and wraps at its
right edge, at any size, cropped or not. The title is `pre-wrap`, so the house double spaces round each
dash show in every view.

**The figure's margins MIRROR the picture's.** Justify writes the picture's margins as before, and
`Na__LeStmtFigMd__MapBody` copies them onto the `<figure>` every time it puts the figure back together.
The picture's margins are the answer; the figure's are never set on their own.

**Spacing.** 7mm above and below every figure (Adam: the pictures felt "squashed" between the text), collapsing
with the paragraph margins round it; 8mm when a heading follows. The same in Edit and Read.

**Where the code is.**
- `02__Core__Markdown/Na__LayoutEditor__Statement__Md__Figure__.js` (`Na__LeStmtFigMd`, pure strings,
  runs under node): `Parts` / `Assemble` / `MapBody`, `SetTitle` (off = `hidden`, the words kept),
  `WriteTitle`, `AdoptCaptions` (converts a whole file), `IsCaption` (a BOLD `Fig` behind the old indent;
  "Figure 8.1 sets the scene" is prose and is never taken).
- The picture menu (`Editor__Figure__`) does every justify, frame, shadow and crop to the PICTURE inside
  the figure through `MapBody`, and has a **Title On/Off** row.
- The cards (`Editor__Cards__`): the `<figcaption>` is an editing surface inside the frozen card
  (`ArmTitle`, after every paint). Typing rewrites only the words between the figcaption tags
  (`TitleHtml` walks the DOM by hand: text plus b/strong/i/em/u/sup/sub, nothing else). Enter finishes
  the title; Tab does nothing. The card is NOT repainted while typing, so the caret stays put. Title On
  for a picture with no title first takes in an old caption paragraph directly under it.
- A dropped picture is written as a figure with the title `Fig  -  <file name>`.

**Traps.**
1. **Every rewrite of a figure goes through `MapBody`.** The old helpers act on "the FIRST tag"; in a
   figure that is the `<figure>`, and a class or a zoom written there does nothing right.
2. **`MapBody` keeps the blank lines under the block.** Before it, a crop or an uncrop dropped them,
   which glued the next block to the figure in the file.
3. **Right-click on a title is the browser's own menu** (spelling). The Picture menu is on the picture.
4. **In the editor, a title's typing never reaches the page's typing rules.** `input` and Enter/Tab
   `keydown` stop at the card. If a rule ever has to see a title, it must not reflow the card.

**Proved 29-Sep-2026** on a throwaway copy of RB05 (`tv-figure-titles`, port 8846): all 23 figures
measured with the title's left edge and width equal to the picture's, in Edit and Read. A crop, Justify
right and Title Off/On were driven through the real menu, and real key presses were typed into a title.
The PDF (zero text) shows the title flush with the picture. Node: `Na__Test__StatementFigureTitle__.test.mjs`
(32 checks: a legacy document converted with nothing outside its figures changed, and the real RB05 file
still one block per figure, round-tripping, with no old caption left).

**Seen in passing, not caused by this.** In a PDF made on the test origin, Figs 2.1 and 2.2 (the only
two pictures linked straight to `cdn.noble-architecture.com`) print as blank frames. They print blank
bare as well as inside a figure, and local pictures print in both. Not investigated further.

## 18 · The two sections that close a statement (v2.167.0)

**Why.** Adam, 29-Sep-2026, over the end of RB05: "The footer is not placed correctly and has the
drawings table pasted in between ... The footer doesn't seem correct at all." The house footer was two
hand-written `<h6>` lines (the end-of-statement note and the copyright), and on RB05 the drawing pack sat
between them. Each line also asked for its grey through `font-color`, which is not CSS, so it never drew;
the copyright had no divider over it; and the note sat hard on the heading under it (the h6's minus two
millimetres). Two standard sections now close every statement: **Drawing Schedule** and **Document
Footer**, in that order, after the Conclusion.

**The Drawing Schedule is a copy, not a link.** Adam: a sync button "that can sync it with the live
drawing register and pull through all the data, but then still keep it in Markdown ... It doesn't keep a
live link". So unlike the Contents and the hub, its words live INSIDE the marker, as markdown:

```html
<div class="na-le-stmt-std-marker" data-na-standard-section="DrawingSchedule" data-na-std-synced="2026-09-29T18:55:51.362Z">
## Pre-Application Drawing Pack
The drawings listed below accompany this statement.
| Drawing | Title | Scale | Size | Rev |
| :--- | :--- | :--- | :--- | :--- |
| RB05_T01_D01 | Project Introduction | NTS | ISO A3 | A |
</div>
```

A `#` line is the heading (and the Contents line), a run of `|` lines is the table, every other line is a
paragraph above or under it. No blank line inside (Typora would end the block). Edit on the card opens
these lines; they stay as left.

**Sync** (on the card, and straight after the section is switched on) reads the Drawing Register as it
stands: every sheet in tab order through `Na__LeRegPdf__Rows` (the register's own rows), then the Project
Specification when it has notes. It replaces the first table's ROWS and nothing else:
- the heading and the paragraphs are never touched;
- a retitled header row is kept while it has one heading per configured column (else the configured
  columns are written, and the question says so);
- a row whose code does not start with the project's code (a consultant's report typed in) is kept under
  the register's; a row of this project's the register no longer has goes;
- a table that already has rows is ASKED about first, with what changes row by row (`Describe`); nothing
  is written when nothing would change, not even the stamp;
- the source is read before the page, and the page again after the question, so typing is never lost.

Columns, the specification's row, the scale collapse (`1:100 @ ISO A2` beside `ISO A2` prints `1:100`,
as the register PDF does) and the empty-cell mark are in the config (`DrawingSchedule__*`).

**Where the code is.**
- `09__Standard__Sections/Na__LayoutEditor__Statement__Standard__DrawingSchedule__.js` - pure: Parse,
  Build, RowsFrom, Merge, Describe, NewBody.
- `...DrawingSchedule__Live__.js` - reads the register and the specification. **Imported only by the
  Statement page**, never by the registry: it needs the running app, and the node tests copy the folder.
  Importing it is what registers the source (`Na__LeStmtStd__RegisterSource`); no source, no Sync button.
- The registry's sync API: `CanSync`, `Fetch` (never rejects), `ApplySync` (keeps the marker's opening tag
  and every attribute on it, stamps `data-na-std-synced`, keeps the blank lines under it), `SyncedIso`.
- The editor's `Na__LeStmtEd__SyncStandard`; the card's Sync button and its "Synced today at ..." stamp.

**The Document Footer** holds its two lines as fields (`End Note:` and `Copyright:`, the header's field
rule) and draws them as one row under the last divider: the note left, the copyright right, 8pt, the grey
and Light weight the h6 lines always drew. It is always last (`End`), gets a divider over it when the file
has none there (Unit `'above'`), none under, and does not move. Switched on over the house footer it takes
the copyright line at the end of the file and an end note DIRECTLY above it; a note further up (a DAS's
"End Of Main Statement" before its supplementary notes) is the writer's own divide and stays. Off writes
the two house lines back, and on again gives the same file.

**Placement anchors added:** `BeforeStandard:<Id>` (the schedule goes above the footer), `SectionsEnd`
(after the divider that closes the last numbered section), `End`. The Contents now asks another section for
its line WITH its marker words, `ContentsTitle(config, { body })`, so the schedule is listed under its own
heading.

**Traps.**
1. **The confirm prompt is the browser's own.** TrueVision's page has no `naConfirmDialog` markup, so
   `Na__AppUtils__ConfirmDialog__Show` falls back to `window.confirm` everywhere (the register and the
   specification too). A hidden browser pane answers it No. To test the question, stub `window.confirm`.
2. **Sync rewrites titles.** The register's names are the sheets' names ("Front Elevation"); RB05's
   hand-typed table said "Front Elevation (South East)". A sync makes them the register's. Rename the
   sheets, or edit the rows after syncing.
3. **The theme's `td:first-child { white-space: normal }` outranks a bare class.** The schedule's no-wrap
   rule goes through the table's class.

**RB05 migrated 29-Sep-2026 19:58:52** by `D:/_ClaudeScratch/rb05_endmatter/migrate_rb05_endmatter.mjs`:
the drawing pack's heading, both paragraphs and its 3-column table verbatim into the schedule, the two h6
lines into the footer; nothing above the Conclusion's divider changed (checked byte for byte). NOT synced -
the first Sync will turn the table into the five columns (Adam's call). Backup:
`D:/_ClaudeScratch/rb05_endmatter/RB05_before_endmatter__2026-09-29T19-58-46.md`.

**Tests.** `Na__Test__StatementSchedule__.test.mjs` (node, 59 checks: the footer's take-over and its place,
the schedule's place, sync in every case above, what is drawn, the plumbing, and RB05 once it carries both);
`Na__Test__StatementStandard__.test.mjs` updated for five sections. In the app on the statement test server
(`tv-stmt-sched`, port 8849): sync from the real register, re-sync, Edit, off/on from the card and the menu,
the footer off/on, Save.

## 19 · The Finishes Comparison (v2.168.0)

**Why.** Adam, 29-Sep-2026, over RB05's "Material Specification Comparison": "a table like this doesn't
really cut it ... this is actually really hard to read and understand. Don't use a table like this; it's
not fit for it." On A4 three columns leave the proposal about 70 mm, so each one wraps four to six lines;
eight of RB05's nineteen existing cells said "Not applicable" or "None"; and thirteen `[TO CONFIRM]` notes
sat mid-sentence. The design and access statement skill writes the same table into every statement.

**What it draws.** One entry per element: the name in a column of its own down the left (the one thing the
table did well - it scans), and beside it the existing finish (8.5pt grey) over the proposed one (9.5pt ink),
each labelled EXISTING / PROPOSED and almost the full width of the page. A strip on top carries the table's
own headings ("Building Element - Existing Dwelling -> Proposed Replacement").
- **NEW** (olive tag) when the existing cell is none/not applicable/empty - and that empty line is left out.
- **MATCHES EXISTING** (green tag) when the proposal says "match ... existing" within a clause (not negated)
  or repeats the existing words - the householder argument, visible at a glance.
- Every `[TO CONFIRM: ...]` is lifted out and set under its line as a labelled amber note.
- A row whose only filled cell is the first is a **group** heading (Walls, Roofs ...).
- A column headed **Status** (or Change) tags each row in the writer's words (Retained = blue-grey); any
  other extra column is one more labelled line. Words above the table open it; words under it close it.
Three layouts were drawn with the real stylesheet and RB05's rows before choosing: this ledger, before/after
panels (grey "Not present" boxes, the text narrowed again) and two-tone bars (needed a legend, solid bands).

**The marker holds the writer's own table**, one row a line - the words never become anything else:

```html
<div class="na-le-stmt-std-marker" data-na-standard-section="FinishesComparison">
| Building Element | Existing Dwelling | Proposed Replacement |
| :--- | :--- | :--- |
| **External Walling** | White painted render ... | Coursed squared natural stone walling ... [TO CONFIRM: stone type and source] |
</div>
```

Tags, notes and groups are drawn from the words every time; nothing computed is written into the file.

**On and off.** Switched on, it takes over the FIRST pipe table whose headings read as a comparison - an
element column first ("Building Element", "Material", "Finish") and an existing and a proposed column found
by their words - IN PLACE, under the writer's own `#### N.N |` heading, so the Contents and the numbering do
not change. A floor area table ("Room | Existing | Proposed") is never taken. The heading row loses its width
`<span>`s (they only sized a table); every row comes across as typed. Off writes the HOUSE table back (spans
30/60 mm, cells padded to sixty, separators of a colon and fifty-nine dashes): RB05's comes back byte for
byte. With no table to take over it lands under the block the caret is in - the new `'Caret'` anchor: the
editor counts the lines up to the `is-caret` block (`Na__LeStmtEd__CaretLine`) and passes `{ CaretLine }` as
InsertInto's new third argument; no other section asks for it. No caret: the registry default, above 1.0.

**It is part of a section, not a section.** Unit `'none'` (no dividers of its own) and no Move handle -
Move only ever drops a section under a major divider and gives it one. To move one: switch it off (it is a
table again), cut and paste the table, switch it on.

**Spacing.** It opens with a paragraph's one em, so under an h4's minus two it settles at 1.53mm, exactly
like prose - measured 1.53mm in the reader AND the editor (the frozen card has no padding or border, so the
margin collapses through it). It closes with the paragraph's 3.5mm.

**Where the code is.** `09__Standard__Sections/Na__LayoutEditor__Statement__Standard__Finishes__.js`
(`Na__LeStmtFin`, pure: Parse, Roles, IsComparison, Model, Build, Adopt, Unwrap, NewBody); the registry
(definition, `'Caret'`); the editor (`CaretLine`); `.na-le-stmt-std-fin` in the document stylesheet;
`StatementStandard__FinishesComparison__Config` (labels, tag words, NoneWords, MatchPattern, the starting
rows, the house widths).

**Traps.**
1. **The skill's exemplar is CRLF**; the tokeniser reads LF, so a CRLF table is a paragraph and is not
   taken over. Statements in the app are LF.
2. **A row with an empty existing AND proposed is a group heading**, by the rule above - fill a cell with
   `[TO CONFIRM]` to keep an unfinished element an element.
3. **MatchPattern is a regex in JSON**: its backslashes are doubled. A broken pattern falls back to the
   built-in one rather than stopping the drawing.

**Tests.** `Na__Test__StatementFinishes__.test.mjs` (node, 59 checks: RB05 taken over in place and given
back byte for byte, what is drawn from it, the exemplar's tags, groups/Status/extras, Windows line ends in
a marker body (Parse splits on `\r?\n`), the caret, the house table written back, escaping, read and edited). Four deliberate breaks (unwrap padding, the NEW line, the
caret anchor, the notes) each failed exactly the checks meant to catch them. `Na__Test__StatementFinishes__.html`
draws it on the paper through the real modules (`?sample=householder`, `?whole=1`, `?editable=1`) and
rasterises it with the vendored html2canvas (`window.__NaTestFin.raster`). In the app on the statement test
server (`tv-finishes`, port 8856): switched on from the Standard Sections menu over RB05's table, autosaved to
the throwaway copy (diff = exactly the marker), drawn in Edit and Read.

---

## 20 · What Publish puts on the CDN is the Read view (v2.170.0)

**The page is built by `07__Export__Publish/Na__LayoutEditor__Statement__Publish__Page__.js`** (`Na__LeStmtPubPage`,
pure). The body is the Read view's own renderer (not editable, every standard section expanded with the whole
document as context), so every element the writer draws publishes as itself - the six standard sections, figure
blocks with their titles (a title switched off stays off), crops, policy panels, dividers. What the app gives that
paper for free, the page must give itself, and each one was a real fault on 29-Sep-2026:

| the page carries | because without it |
|---|---|
| `<meta name="viewport" content="width=842">` | a phone reflowed A4 into 390px: the Contents broke a word to a line, tables and figures ran off the paper |
| the `@font-face` rules of `Na__CoreUi__Styles__Fonts__.css`, addresses absolute to the website | Open Sans only where it is installed (this office) |
| the app's reset, `* { margin: 0; padding: 0; box-sizing: border-box }`, word for word | 22 headings 16px lower, 6 tables 9.5px taller, 8 frames outside the column |
| the document stylesheet as it stood at publishing, **written in**, comments taken out | the website's copy lacked the newest sections' rules: published before a push, they came out unstyled |
| the desk last: A4 minimum width on screen, the printer's width on paper, no text enlargement | a narrow desktop window squeezed the paper |
| each resized picture as `srcset="<cdn> 2000w" sizes="<original>px"` | a figure sized by zoom shrank with its copy (Fig 16.1: 382px instead of 622) |

**It is a document of record.** 1.0.0 linked the live stylesheet so a restyle reached every statement; now a restyle
reaches a statement when it is published again. A stylesheet the publisher cannot read at publishing is linked from
its published address instead (`Na__LeStmtPublish__Styles`).

**The title** is the Document Header's `Title:` field, then the first heading, then `Doc__Title`.

**Run waits** for `Na__LeStmtStd__Ready()` and `Na__ProjectQr__Ready()` before drawing, so a Publish pressed as the tab
opens cannot bake a hub without its code.

**The web viewer is a different reader.** Its Design Statements tab does not open this HTML: it draws the published
MARKDOWN with the LIVE app. A standard section the live app does not know is shown as its raw marker text (checked
against 55014c6: the Finishes Comparison, the Drawing Schedule and the Document Footer). **Push the app, then publish.**

**How to check a publish without publishing.** Build the page inside the running app with every request that is not a
read aborted, open it on its own, and measure it against the Read view block by block - the scripts are in
`D:/_ClaudeScratch/stmt_publish/` (`publish_check.py`; 0 of 556 blocks differ; phones by Playwright device emulation).
This machine has Open Sans INSTALLED, which hides a missing font in every local test, and an `@font-face` that fails to
load does not hide it either (Chrome falls back to the installed family) - look for faces with status `loaded` in
`document.fonts` instead. Test: `80__Testing__PrototypeEnvironment/Na__Test__StatementPublish__.test.mjs`.
