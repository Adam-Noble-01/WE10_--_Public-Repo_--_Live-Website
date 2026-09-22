# Spell Check

**Folder:** `02__Src__AppModules/55__Feature__SpellCheck/`
**Author:** Adam Noble - Noble Architecture
**Created:** 22-Sep-2026 (TrueVision3D v2.144.0)

Spell-checked text boxes for TrueVision, and the practice's own dictionary of the words a browser does not know -
manufacturers, product names, stone and quarry names, construction terms, abbreviations - so Kingspan, Velux,
rooflight and uPVC are never underlined, and Kingspam still is.

The first box to use it is the row editor in the drawing editor's Specification tab (right-click a row, **Edit spec
item**). Any text box written from now on can have it with two lines of code.

---

## The files

| File | What it is |
| --- | --- |
| `Na__SpellCheck__Config__.json` | Where the dictionary is, the language (`en-GB`), how a word is matched, the box's undo, and **every word the feature shows** (`SpellCheck__Labels`). |
| `Na__SpellCheck__Dictionary__.js` | Reads the dictionary (the local server's route, else the file), matches words, finds the dictionary's words in a text, and adds or takes out a word. |
| `Na__SpellCheck__Field__.js` | The spell-checked box: plain text, the browser's own spell check, the dictionary's words marked to be passed by, its own undo, Enter / Shift+Enter / Escape. |
| `Na__SpellCheck__WordBar__.js` | The line under the boxes: **Add "word" to Dictionary**, or **Remove** for a word the app added. |
| `Na__SpellCheck__.js` | **The one door in.** Everything outside this folder imports from here. No code of its own. |
| `Na__SpellCheck__Styles__.css` | The box and the bar. Imported by `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css`. |

The dictionary itself is **not** in this folder. It belongs to the practice, not to the code:

    na-apps/30__TrueVision__CoreAppCode/50__TrueVision__UserConfig/TrueVision__UserSpellings__.json

Server side: `na-apps/ProjectVision__TrueVisionUserConfig__Api__.py` (registered by `ProjectVision__LocalServer__Main__.py`).

Tests, in `80__Testing__PrototypeEnvironment/`:
`Na__Test__SpellCheckDictionary__.test.mjs` (Node), `Na__Test__UserSpellingsApi__.test.py` (Python, Flask's test
client) and `Na__Test__SpellCheckField__.html` (open it on the local server; it types into a real box).

---

## Adding words

### By hand (no code)

Open `TrueVision__UserSpellings__.json` and put the word in any group's `Group__Words`, one to a line, spelt and
capitalised the way it should be written:

```
TrueVision__UserSpellings__Groups
  Group__Key    : "ManufacturersAndBrands"       <-- a GROUP: a heading for people; the app does not care which
  Group__Title  : "Manufacturers and Brands"
  Group__Words  : [ "Kingspan", "Velux", ... ]  <-- one word, or one name of several words, to a line
```

- **A new group** is a copy of a group block with its own `Group__Key` and `Group__Title`.
- **Reload TrueVision** to pick up a hand edit.
- **Keep it valid JSON.** If a comma goes missing, nothing is lost and nothing is written over: the word bar's Add
  button goes grey and its hover text says **which line and column** to look at. The server log says the same.
- A byte order mark, which some Windows editors put at the front of a file they save, is read past.

### From the app

Put the caret in the word in any spell-checked box and press **Add "word" to Dictionary** under it. It lands in the
`AddedInTheApp` group, which the app keeps in alphabetical order and is the only group it ever writes to. Move a word
from there into a proper group by hand whenever you like. **Remove** is offered only for a word in `AddedInTheApp` -
the groups written by hand are never changed by the app.

Adding needs the **ProjectVision local server**. On the website the dictionary is read from the file and is
read-only; the button says so. A local server started before this feature existed does not have the route yet: the
button says **restart the ProjectVision local server**, and once restarted it works.

### How a word is matched

- **In any case**: VELUX, Velux and velux are the same word.
- **With 's after it** (Velux's, Velux’s) and **with a plural s or es** (rooflights for rooflight). Each is a switch in
  the config (`Dictionary__AcceptPossessive`, `Dictionary__AcceptPlural`).
- **An entry of several words accepts each of its words**: `Farrow & Ball` makes Farrow and Ball known, `Jeld-Wen`
  makes Jeld and Wen known. A hyphen ends a word, for the browser's checker as for this one.
- **What a word is**: letters and digits (any alphabet), with an apostrophe only inside it. It is the same rule in
  JavaScript and in Python, and a test fails if the two ever disagree about a word - so the app never offers to add a
  word the server would refuse.

### What is in it now

| Group | Entries | What |
| --- | --- | --- |
| Manufacturers and Brands | 240 | Kingspan, Velux, Crittall, Marley, Cedral, Siniat, Keim ... |
| Product Names | 14 | Aquapanel, Earthwool, Marmoleum, Thermowood ... |
| Stone and Quarry Names | 13 | Ancaster, Clipsham, Collyweston, Hornton ... |
| Construction Terms | 32 | rooflight, cill, monocouche, weatherboarding, upstand ... |
| Abbreviations | 26 | uPVC, GFFL, DPC ... |
| Practice and Software | 14 | TrueVision, ProjectVision, SketchUp ... |
| Added in TrueVision | 0 | The app's own group, empty until something is added. |

339 entries in all. An ordinary English word needs no entry: the browser already knows it.

---

## Giving a new text box the spell check

```js
import { Na__SpellCheck__Field, Na__SpellCheck__WordBar } from '<path>/55__Feature__SpellCheck/Na__SpellCheck__.js';

const box = Na__SpellCheck__Field({ text, multiline : true, label, placeholder, onSubmit, onCancel });
const bar = Na__SpellCheck__WordBar({ fields : [ box ], showToast });
parent.append(box.element, bar.element);
```

and `box.destroy()` / `bar.destroy()` when they go. One bar can serve several boxes (the row editor's title and text
share one); it follows whichever box last moved its caret.

The box's handle: `element`, `getText()` (exactly as typed), `setText(text)`, `focus(at)` (an offset, `'start'` or
`'end'`), `select(start, end)`, `getSelection()`, `wordAtCaret()`, `isComposing()`, `destroy()`.

---

## How it behaves, and why

- **The browser checks the spelling; this only says what it must leave alone.** The browser's checker has the better
  dictionary and its own suggestions (right-click an underlined word), but a web page cannot teach it a word. What a
  page can do is mark a stretch of text `spellcheck="false"`, and Chromium does not underline a word inside one (its
  own web test, `spelling-attribute-at-child.html`). So every dictionary word in a box is wrapped in
  `<span class="na-spellcheck-known" spellcheck="false">`, and nothing else is.
- **The box redraws only when the words it marks change**, and puts the caret back where it was, so typing carries on
  exactly where it was going. A letter typed onto the end of a marked word (Kingspanx) unmarks it for the checker.
- **It keeps its own undo** (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z, and the browser menu's Undo), because a redraw clears the
  browser's. Typing within `Field__UndoMergeMs` (800 ms) of the last change is one step; a line break and a paste are
  steps of their own.
- **Enter asks the owner to save, Escape to cancel; Shift+Enter is a new line** in a box of several lines and nothing
  in a box of one. None of the three reaches the page, so the sheet behind never also hears them. An input method's
  own Enter and Escape, mid-word, are left to it.
- **A paste is always plain text**, and a box of one line folds a paste of several lines onto one.
- **The word bar offers Add for whatever word the caret is in**, ordinary English included, because a page cannot see
  which words the browser underlined. Adding an ordinary word does no harm; it is simply never needed.
- **Nothing about the dictionary is kept in the browser.** Every change goes to the file through the server, which
  reads the file fresh for each one (a word typed in by hand a moment ago is kept), writes it through a temporary file
  moved over the old one (a crash never leaves half a dictionary), and keeps its house style byte for byte (the first
  Add changes one line of it in git, not all of them).
- **A missing or broken dictionary is an empty one.** Every word goes to the browser's own check, exactly as before
  this feature existed, and nothing throws.

## Worth knowing

- **Spell check itself is the browser's setting.** In Edge or Chrome it is under Settings > Languages: spell check
  on, with English (United Kingdom) among the languages checked. With it off, no box underlines anything, dictionary
  or not.
- Only a box built with `Na__SpellCheck__Field` gets the dictionary. The other text boxes in TrueVision are the
  browser's plain inputs and are checked by the browser alone.
- NOT in ValeVision.
