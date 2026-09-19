# TrueVision3D — Drawing Numbering Schema

**Written 19-Sep-2026.** Read this before changing anything that writes a drawing
number, a phase, or a title block identifier.

---

## The short version

A drawing is identified by **three separate facts**, not one string:

| Part | Example | Who owns it | Where it is stored |
|---|---|---|---|
| Project code | `PS01` | The project data | `Na__DrawData__GetProjectCode()` — not on the sheet |
| Project phase | `T02` | The drawing register | `Sheet__Fields__Phase` |
| Drawing number | `D01` | The drawing register's numbering | `Sheet__Fields__DrawingNumber` |

Joined, they make the **Document ID**: `PS01_T02_D01`.

That is what the title block prints, what the exported PDF is named after, and what
the register's DOCUMENT CODE column shows. **It is composed on every read and never
stored**, which is the whole point — see "Why composed" below.

---

## What each part means

### Project code — which job

The job number used across the whole system: `PS01`, `EB03`, `RB05`. Two letters for
the client or site, two digits for the job. It comes from the project data, not from
the sheet, so every drawing in a project carries the same one and none of them can
drift.

### Project phase — which stage of the job

| Code | Stage |
|---|---|
| `T01` | Concept Design |
| `T02` | Planning Approval |
| `T03` | Building Regulations |
| `T04` | Site & Remedial |

**Held per sheet, not per project.** A live job runs several stages at once: a
planning set stays issued and unchanged while building regulations drawings are being
drawn against it. A per-project phase would force those to share one label, and
re-labelling the planning set to `T03` would silently rewrite the identity of drawings
that are already out in the world with a local authority.

A sheet that has never been given a phase reads as the configured default,
`LayoutEditor__DrawingRegister__DefaultPhase`, which is `T01` Concept Design. Adam
chose that on 19-Sep-2026: a drawing that has not declared its stage is a concept
drawing, and saying so is honest, where defaulting to Planning would quietly mislabel
a whole back catalogue as approved work.

### Drawing number — which sheet

`D01`, `D02`, `D10`. The register's numbering writes it and nothing else does. The
prefix, the first number and the zero-padding are the register's numbering series;
a sheet can also carry a jump, so a pack can go `D01, D02, D03, D10`.

This is **also what the tabs read**. A tab has room for `D03`, not for
`PS01_T02_D03`, so `Na__LeModel__GetShortCode` cuts the short code off the end of the
number and `Na__LeModel__GetTabLabel` puts the sheet's short name behind it:
`D03 - 3D Images`.

---

## Why composed, never stored

**This is the part that matters, and it is written down because getting it wrong cost
a project its drawing numbers.**

Until 19-Sep-2026 `Sheet__Fields__DrawingNumber` was expected to hold the *whole*
identifier — `PS01_T02_D01`. But `Na__LeRegNum__Plan`, the register's numbering, only
ever wrote the sequence:

```js
number : prefix + String(next++).padStart(digits, '0')    // "D01", and nothing else
```

So the first time anyone renumbered a pack, or dragged a row to reorder it, the
project code and the phase were overwritten with nothing. PS01's four sheets were
found storing `D01`–`D04` with the `PS01_T02_` gone from disk, and Site Plan's `D10`
flattened to `D04`, taking its numbering jump with it. Nothing failed, nothing warned:
the title block simply started printing `D03` where it used to print `PS01_T02_D03`.

Composing removes the failure mode entirely. Each part has exactly one owner and one
writer, and the identifier is assembled fresh every time it is asked for, so:

- a renumber changes the drawing number and the title block follows;
- a phase change in the register changes the phase and the file name follows;
- **nothing can write two thirds of the identifier by writing one third.**

If you are ever tempted to store the composed code "for speed" — don't. It is a string
join of three values already in memory.

### The escape hatch

A sheet may carry `Sheet__Fields__DocumentId`. If it is a non-empty string it wins,
for that sheet alone. That is for a drawing inherited from another practice, or one
whose code was fixed on an issued document before this schema existed. Nothing in the
app writes it; it is set by hand.

---

## The register shows the construction

The Drawing Register's first three columns are deliberately the three parts, in the
order they compose, so the table reads left to right as *how the identifier is built*:

```
DRAWING No.   PHASE   DOCUMENT CODE   DOCUMENT NAME      SCALE   SIZE     REV
D01           T02     PS01_T02_D01    D01 - Floor Plans  1:50    ISO A2   Rev B
```

Only **PHASE** is editable — it is the one part that is a choice. The drawing number
belongs to the numbering series (change it in *Numbering series*, or by dragging rows),
and the document code is not a field at all, it is the other two behind the project
code.

The old **TYPE** column was dropped when these arrived. It printed the constant
`"Drawing"` on every row — the register builds it in code and no sheet can say anything
else — and eight columns do not fit A4 portrait: measured, adding it back breaks
`Drawing` across two lines and takes `ISO A2` and `Rev B` with it. The row still
carries `type`, so restoring the column is one line in
`LayoutEditor__DrawingRegister__Columns`, but the page has to go landscape first.

---

## "Document ID", not "Drawing Number"

The title block cell was relabelled on 19-Sep-2026. Adam's reasoning, which is the
right one: *it's more than a number; it's a code with multiple levels of meaning.*

`PS01_T02_D01` answers three questions — which job, which stage of it, which sheet of
that stage. Calling that a "number" invites exactly the mistake above: treating it as
one opaque value that any one process may rewrite.

The title block row key changed from `DrawingNumber` to `DocumentId` at the same time,
so the old key keeps holding what it now actually holds — the sequence alone.

---

## Where the code lives

| Concern | Function | File |
|---|---|---|
| Sequence | `Na__LeRec__DrawingNumber` | `07__Core__SheetData/Na__LayoutEditor__SheetRecords__.js` |
| Phase | `Na__LeRec__Phase` | same |
| Compose | `Na__LeRec__ComposeDocumentId` | same |
| Read the identifier | `Na__LeRec__DocumentId` | same |
| Model access | `Na__LeModel__GetPhase`, `Na__LeModel__GetDocumentId` | `Na__LayoutEditor__SheetModel__.js` |
| Tab short code | `Na__LeRec__ShortCode`, `Na__LeModel__GetTabLabel` | `SheetRecords` / `SheetModel__Sheets__` |
| Numbering | `Na__LeRegNum__Plan` | `51__Feature__DrawingRegister/…__Register__Numbering__.js` |
| Phase edit | `Na__LeRegEdit__Metadata(id, 'phase', code)` | `…__Register__Transactions__.js` |

Configuration is the `LayoutEditor__DrawingRegister__Config` block:
`Phases`, `DefaultPhase`, `DocumentCodeFormat`, `Columns`.

`DocumentCodeFormat` is `{project}_{phase}_{drawing}`. An empty part takes its
separator with it, so a project with no phase set reads `PS01_D01` rather than
`PS01__D01`, and anything the format puts in front of the first part is kept.

---

## If you are recovering a project whose codes were flattened

The phase cannot be recovered from the data — it was never stored separately, and the
prefix that carried it is gone. Set it per sheet in the register's PHASE column. The
drawing numbers survive as the sequence, so once the phase is right the whole
identifier recomposes correctly everywhere at once.

A numbering jump that was flattened (PS01's `D10` becoming `D04`) has to be re-entered
as a jump in the register's *Numbering series*.
