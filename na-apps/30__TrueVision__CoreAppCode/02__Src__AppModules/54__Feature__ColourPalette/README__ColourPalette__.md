# Colour Palette

**Folder:** `02__Src__AppModules/54__Feature__ColourPalette/`
**Author:** Adam Noble - Noble Architecture
**Created:** 21-Sep-2026 (TrueVision3D)

The standard colours, one click away from every colour field in TrueVision.

Click any colour field - a vector's edge, fill or hatch, a text, a dimension, a leader, a floor area, a gradient
stop, the drawing grid, the 3D tab's plan dimension colour - and two things open together, as one stack beside the
field: **this palette**, one row of swatches per group, and **the browser's own colour mixer directly on top of it**.
Click a swatch and that colour is in the field; both close.

---

## The files

| File | What it is |
| --- | --- |
| `Na__ColourPalette__Config__.json` | **The standard colours.** Palettes hold groups, groups hold colours. Edit this to add or change anything. |
| `Na__ColourPalette__Manager__.js` | Reads the config once and answers which palettes, groups and colours there are. A leaf: it imports nothing. |
| `Na__ColourPalette__Picker__.js` | The palette element: attaching to a field, placing, the proxy that opens the browser's colour menu, picking. |
| `Na__ColourPalette__.js` | **The one door in.** Everything outside this folder imports from here. No code of its own. |
| `Na__ColourPalette__Styles__.css` | The palette's look. Imported by `03__Style__AppStylesheets/Na__CoreUi__Styles__Index__.css`. |

Test: `80__Testing__PrototypeEnvironment/Na__Test__ColourPalette__.test.mjs`.

---

## Adding colours (no code)

Everything is in `Na__ColourPalette__Config__.json`. Three levels, each keyed by its **technical name**:

```
ColourPalette__Palettes
  ColourPalette__Standard                      <-- a PALETTE: one is on show at a time
    Palette__Groups
      ColourPalette__Monochrome                <-- a GROUP: one row of swatches, captioned with its menu name
        Group__Colours
          ColourPalette__Monochrome__DarkGrey  <-- a COLOUR: one swatch
```

- **A colour** - copy a colour block inside its group. Give it a new key, the same text as `Colour__TechnicalName`,
  a `Colour__MenuName`, the group's menu name as `Colour__MenuGroup`, and a `Colour__Hex`. `Colour__Rgb` beside it
  is for reading; the hex is what is used, and the console says so if the two disagree. Swatches show left to right
  in the order written.
- **A group** - copy a group block inside `Palette__Groups`. A group is one row; more than
  `Display__SwatchesPerRow` colours wrap onto a second line of it.
- **A palette** - copy a palette block inside `ColourPalette__Palettes`. With two or more, a menu appears at the head
  of the palette to switch between them; the choice is remembered in the browser. `Display__DefaultPaletteKey` is what
  a new browser starts on.

**Technical names** are three-stage - `ColourPalette__{Group}__{Colour}` - unique across the whole file, and should
not be renamed once something refers to them. **Menu names** are only what a person reads; change them freely.

The test fails, by name, on: a technical name that is not three-stage or does not sit under its own group, a block
whose `Colour__TechnicalName` differs from its key, a `Colour__MenuGroup` that is not the group it sits in, a hex that
disagrees with its rgb, and a name used twice.

### What is in it now

| Group | Colours | Source |
| --- | --- | --- |
| Monochrome | Absolute Black, Soft Black, Dark Grey, Medium Dark Grey, Mid Grey, Light Mid Grey, Near White Grey, Light Grey, Very Light Grey, White | The `MTE100__GreyscaleSeries__` of `Na__DataLib__CoreIndex__EdgeMaterials__.json` v2.1.0, value for value. `Colour__SsotKey` names each SSOT entry. Where the SSOT is installed the test compares the two files directly. |
| Dimensions | Proposed `rgb(150,0,0)`, Existing `rgb(0,0,150)`, Special `rgb(0,150,0)` - red, blue and green, each at 150 | Adam, 21-Sep-2026. The first brief wrote Existing as `rgb(0,0,0)` and Special as `rgb(0,0,150)`; on seeing the row he said Special was meant to be the green and the others red and blue. |

If a grey changes in the SSOT it must be changed here too; the test will say which.

---

## Giving a new colour field the palette

A field built with the Layout Editor's `Na__LePanels__Input('color', name)` **has it already** - the panel host
attaches every colour input it makes.

Anything else:

```js
import { Na__ColourPalette__Attach } from '../54__Feature__ColourPalette/Na__ColourPalette__.js';

const input = document.createElement('input');
input.type = 'color';
Na__ColourPalette__Attach(input);
```

Nothing else changes. The field keeps its value, its events and its handlers: a swatch click writes `input.value` and
dispatches the same bubbling `input` then `change` the browser's menu dispatches, so a handler listening for either
hears a palette pick exactly as it hears a custom colour.

The test scans the source tree: a file that makes its own `<input type="color">` without calling
`Na__ColourPalette__Attach` fails it, by file name.

## Using a standard colour in code

```js
import { Na__ColourPalette__Hex } from '../54__Feature__ColourPalette/Na__ColourPalette__.js';

const red = Na__ColourPalette__Hex('ColourPalette__Dimensions__Proposed', '#960000');
```

The fallback is returned until the config has loaded (`Na__ColourPalette__Ready()`), and for a name the file no longer
has - so a caller never paints with `undefined`.

---

## How it behaves, and why

- **The mixer sits on top of the palette, and the two are one stack.** Above the field where there is room (its foot
  6 px over the field, right edges together); otherwise beside the field - to its left, as the panels are down the
  window's right side, else to its right - with its foot level with the field's and kept inside the window. The order
  never changes: mixer, then palette.
- **The browser's mixer is opened from a proxy, not from the field.** A page cannot say where the browser draws its
  colour mixer: it is hung *under the box of the input it was opened from*, left edges together, and that is all. So
  the field's click is cancelled and the mixer is opened (`showPicker`) from an invisible colour input laid as a one
  pixel strip along the **top** of the stack; hung from there it fills the room kept for it and ends just over the
  palette. What the mixer does to the proxy is relayed to the field event for event: `input` while the colour moves,
  `change` when it closes.
- **The mixer's size cannot be asked for**, so it is in the config: `Display__NativePickerWidthPx` 232 and
  `Display__NativePickerHeightPx` 250, measured off Adam's screen (Chrome and Edge, 21-Sep-2026). If a browser update
  makes it taller it will lap over the palette's title - raise the height; if shorter it will float clear - lower it.
  It is a window of the browser's and does not zoom with the page, so the room is corrected for the page zoom
  (`Display__NativePickerFollowsZoom`) - but only when the window's widths land on one of the browser's zoom steps AND
  the pixel ratio agrees; anything else reads as 100 %.
- **THE PROXY MUST BE LAID OUT WHERE IT IS BEFORE `showPicker`.** The browser hangs the mixer from the proxy's box *as
  last laid out*, and `showPicker` does not lay the page out first. The first build appended the proxy, measured the
  field (which laid the proxy out where an unplaced fixed box falls - the end of the page), then placed it and asked for
  the mixer: it opened in the bottom left corner of the window ("the custom colour mixer is miles away"). The proxy is
  now made with its box already set, and measured once more straight before `showPicker`. It never showed in testing
  because the stand-in for `showPicker` measured the proxy - which is the cure. The test now asserts the ORDER, and
  fails if the measuring line is taken out.
- **A pick beats the menu.** Closing the browser's menu makes it report its last colour. A swatch click settles the
  session first, so that late report cannot land over the swatch just chosen.
- **After a pick the field lets go of the focus**, which is where a colour chosen from the browser's menu ends up too
  once the menu is clicked away. A panel never overwrites the control that has the focus, so with the focus left on the
  field an undo straight after a pick put the drawing back and left the box showing the colour just undone.
- **A press on the palette never moves the focus** (the palette menu excepted - a select cannot open without its press).
- **It stands aside when it has nothing to show**: until the config has loaded, with `Display__Enabled` false, or with no
  colours, the field's click is left alone and the browser's menu opens as it did before this existed. A disabled field
  (the read-only web viewer) never opens it.
- **It closes on** a swatch click, a press anywhere else, Escape, the window resizing and anything scrolling. A click on
  the field while its palette is open asks for the browser's menu again.
- `Display__OpenNativePicker: false` opens the palette alone; a second click on the field then opens the browser's menu.
- **The stylesheet is imported by the style index, never injected on first use.** A lazily injected sheet is outside the
  service worker's precache and paints the previous release on the first load after an edit.

## Not done

- No "recent colours" row, and no editing of the palette from inside the app: the config file is the editor.
- The Model Layers panel's edge colour is a **list of named SSOT colours**, not a colour field, so it has no palette -
  it already is one.
- Not in ValeVision.
