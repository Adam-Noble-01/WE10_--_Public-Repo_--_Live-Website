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
answers **405 until Adam restarts it**. Read the running routes with `OPTIONS` (the
`Allow` header), never with a test `POST`.

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
