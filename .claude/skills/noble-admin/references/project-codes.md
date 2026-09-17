# Project Codes

The project code is the primary key of the entire Noble Architecture ecosystem. Get it right first; everything else is derived from it.

## Format

```
[A-Z][A-Z][0-9][0-9]        regex: ^[A-Z]{2}\d{2}$
```

- **Letters 1–2** — client initials: first-name initial + surname initial. Always uppercase.
- **Digits 3–4** — sequence `01`–`99`. **Never `00`** (reserved for the `AA00` example project).

Examples: `JH03` (John Harris), `EB03` (The Firs), `NP03` (Ashness Close).

## What the code drives

| Thing | Pattern |
|---|---|
| Portal folder | `26-Projects\EB03__TheFirs\` |
| App URL | `?project=EB03` |
| Quotation ref | `QUO-EB03-2026-001` |
| Invoice ref | `INV-EB03-2026-001` |
| Drawing number | `EB03_T02_D01__ProposedGroundFloorPlan__RevB__` |
| DAS filename | `EB03_T02_S01__Design&AccessStatement__.md` |
| R2 key prefix | `NaProjectPortal/26-Projects/EB03__TheFirs/` |
| Registry keys | both registries key on the bare code |

Changing a code after creation means touching all of the above plus live client links. Treat it as one-way — **confirm with Adam before creating anything.**

## Allocating a new code

1. Take the client's initials. "Sarah Mitchell" → `SM`.
2. Read `AppConfiguration__ProjectKeysIndex__.json` and check **every year**, not just the current one — `SM05` already exists in 2025, so `SM` is in use.
3. Take the next free sequence for those initials across all years. If `SM05` exists and nothing else, the next is `SM06`.
4. If the initials are entirely unused, **start at `01`**.
5. Never reuse a retired code.

### Why the digits look non-sequential

The digits are historically per-client, not global. `EB03`, `JH03`, `NP03`, `SB03`, `RJ03` all being `03` is a legacy artefact, not a rule. Modern allocation: next free number for those initials. If Adam has a different intent for a given client (e.g. a repeat client's second project), ask.

### Company or property-named clients

Initials come from the **client's name**, not the property. "The Firs" is the project name; `EB` is the client. If the input only gives a property name, ask for the client's name before allocating.

## Project name

Separate from the code. Short, human, usually the property or street: "The Firs", "Ashness Close", "West Farm", "Boundary Road".

Folder name = `{CODE}__{ProjectName with spaces stripped}`:
- "The Firs" → `EB03__TheFirs`
- "Ashness Close" → `NP03__AshnessClose`

Apostrophes and ampersands are stripped. Keep the folder ASCII.

## Registry updates

A new project must be added to **both**:

1. `na-apps\10__NaProjectAdmin__DocumentSystem__CoreAppCode\03__Src__AppModules\02__AppData\AppConfiguration__ProjectKeysIndex__.json`
   → `"26": { "EB03": "EB03__TheFirs" }`
2. `na-apps\05__ProjectVision__CoreAppCode\05__AppData\ProjectVision__MasterProjectIndex__Core__.json`
   → full project entry with `subApps` flags

`na_new_project.py` does both. If you edit by hand, do both — a project missing from the keys index is invisible to the admin app.

## Validating a code you've been given

Reject and query anything that fails `^[A-Z]{2}\d{2}$`: lowercase (`eb03`), three letters, one digit, `00`, or a code already in the registry pointing at a different project.
