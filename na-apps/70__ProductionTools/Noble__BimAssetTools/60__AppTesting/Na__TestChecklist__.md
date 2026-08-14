# Noble BIM Asset Tools — Test Checklist v0.1.0

Run through this in the browser. Automated checks already cover the IFC, Revit and
GLB paths (results in the DEVLOG); this is the hand pass that covers the things a
script cannot judge — how it looks, how it feels, and whether the numbers match
the real world.

**Start:** run `Na__LocalServer__Main__.bat`

---

## 1 · Boot

- [ ] App opens at `http://localhost:8009/Na__BimAssetTools__App__.html`
- [ ] Header shows **BIM Asset Tools** and `v0.1.0`
- [ ] Status line reads *"Noble BIM Asset Tools ready. Drop a file or folder to begin."*
- [ ] Browser console (F12) shows no red errors
- [ ] Three panels visible: assets left, viewport centre, inspector right

---

## 2 · Revit family — the Guttermaster set

Drag the whole folder in:
`C:\Users\adamw\Downloads\BB_6037 - Guttermaster BIM Objects\Rectangular Box Gutter System\Fittings`

- [ ] All **6** `.rfa` files appear in the asset list
- [ ] Each shows a **blue** dot and reads *"N types · Revit 2015"*
- [ ] Click `..._RctnglrBx_Angle.rfa`

Inspector should show:

- [ ] **128 × 128 preview thumbnail** of the actual fitting
- [ ] Family, Category *(Specialty Equipment)*, OmniClass, Host, **16 types**
- [ ] Authored in **Revit 2015**, Build `20160512_1515(x64)` *(complete, with closing bracket)*
- [ ] Original save path beginning `B:\01. Projects\...`
- [ ] Parameter table, **16 rows**, dimension columns first

**Verify against the real data** — first row should read exactly:

| Type | W (mm) | VertOffset (mm) | L (mm) | Angle (°) | D (mm) |
|---|---|---|---|---|---|
| REX90/4x3 | 98 | -73 | 248 | 90.00° | 73 |

- [ ] Row matches
- [ ] Warning present: geometry cannot be read from Revit files
- [ ] Table scrolls sideways without the page scrolling

**Try the whole download** — drag the top-level `BB_6037` folder:

- [ ] All **86** Revit files load; PDFs and zips are ignored
- [ ] Takes a few seconds, nothing hangs
- [ ] Every file shows a thumbnail and a type count

---

## 3 · Revit project file

Drag `Rectangular Box Gutter System\Guttermaster_ExtGrvtyRnwtrDrngSym_Rectangular_Range.rvt`

- [ ] Loads without error *(schedule comes from the zipped `ProjectInformation` stream)*
- [ ] Preview thumbnail present
- [ ] Revit version shown
- [ ] Inspector shows a **Project parameters** section — Project Issue Date,
      Project Status, Client Name, Project Address
- [ ] It does **not** say "No family types were recovered"

---

## 3b · Revit → IFC conversion  *(the v0.2.0 feature)*

Server banner on start should read `Revit to IFC : ENABLED`.

With the `.rvt` above selected:

- [ ] An orange **Convert to IFC** button is visible in the toolbar
- [ ] Click it. Status line counts up: *"Converting … — NN% · Converting geometry… (Ns)"*
- [ ] Completes in roughly 4 seconds for this 10.7 MB file
- [ ] The converted IFC is added to the asset list **and selected automatically**
- [ ] Geometry appears in the viewport
- [ ] Audit reports roughly `44,174 triangles`, `30547 × 1438 × 24571 mm`
- [ ] Source unit **millimetre**, declared

Then re-select the original `.rvt`:

- [ ] The button now reads **Show converted IFC**
- [ ] Clicking it jumps to the converted asset rather than converting again

Select the converted IFC:

- [ ] The Convert button is hidden *(it is already an IFC)*
- [ ] **Export GLB** works and verification passes

Negative case:

- [ ] Stop the server and open the app from `file://` — no Convert button appears,
      and Revit files still load for metadata audit

---

## 4 · IFC — the real geometry route

Drag `D:\02_CoreLib__SketchUp\30__Software__3dSoftware__Tools&Utils\3dTool__Tool__RevitToIfc__Converter\RevitToSketchUpTest\Test\No4 Huntingdon Drive_rvt.ifc`

- [ ] Loads in about half a second
- [ ] **Model appears in the viewport, the right way up** *(not on its side)*
- [ ] Camera frames it automatically
- [ ] Asset row reads `16,043 tris · 61777 × 14056 × 48720 mm`

Inspector — Source and units:

- [ ] Source unit **millimetre**, shown green
- [ ] Unit basis **"Declared by the file"**, green
- [ ] Declaration reads `IFCSIUNIT MILLI METRE`
- [ ] Axis convention **Y-up**

Inspector — Geometry audit:

- [ ] Verdict banner reads **CRITICAL** in red
- [ ] Bounding box `61777.2 × 14056.1 × 48720.0 mm`
- [ ] Non-manifold edges flagged critical
- [ ] Open edges, inconsistent winding, degenerate triangles all flagged
- [ ] Each finding has a plain-English explanation underneath

> The CRITICAL verdict is correct — it is describing the RVT2IFC converter's
> output, not a fault in the tool.

---

## 5 · Viewport

With the IFC loaded:

- [ ] **Orbit** — left-drag rotates
- [ ] **Pan** — right-drag or middle-drag
- [ ] **Zoom** — wheel
- [ ] Motion is smooth, no stutter
- [ ] **Shaded** — neutral grey, readable
- [ ] **Edges** / **Wireframe** — triangle density visible
- [ ] **Flat** — faceting and bad normals stand out
- [ ] **X-ray** — see-through, grid hides itself
- [ ] **Grid** toggle works; squares are 1 m
- [ ] **Frame** re-centres the view
- [ ] Resizing the window keeps the render sharp and correctly proportioned

---

## 6 · GLB export — the critical test

With the IFC selected, click **Export GLB**.

- [ ] `Test__HuntingdonDrive__.glb` (or `No4 Huntingdon Drive_rvt.glb`) downloads
- [ ] Status line reports the verification, ending with something like
      *"61777.2 × 14056.1 × 48720.0 mm verified to within 0.0017 mm (tolerance 0.01 mm)"*
- [ ] Deviation is well under 0.01 mm

**Then the real proof — open the GLB in SketchUp:**

- [ ] Imports without error
- [ ] **Measure a known dimension with the tape tool. It must match the source
      within a millimetre.** This is the check the whole tool exists to pass.
- [ ] Model is upright, not lying on its side
- [ ] Model sits near the origin

---

## 7 · Error handling

- [ ] Drop a `.txt` or `.pdf` → warning listing supported formats, no crash
- [ ] Select a `.rfa` and click **Export GLB** → clear message that Revit files
      carry no geometry and should be converted to IFC first
- [ ] Rename a `.rfa` to `.ifc` and drop it → warns that contents disagree with
      the extension
- [ ] Remove an asset with the **×** → disappears, viewport clears
- [ ] Load ten files then remove them all → no slowdown *(no GPU memory leak)*

---

## 8 · Untested — needs a fixture

- [ ] **STEP / IGES.** Written but never run against a real file. Download any
      manufacturer `.step` and confirm: it loads, dimensions match the data sheet,
      the tessellation note appears, and GLB export verifies.

---

## Notes

Record anything that fails here, with the file that caused it:

```
```
