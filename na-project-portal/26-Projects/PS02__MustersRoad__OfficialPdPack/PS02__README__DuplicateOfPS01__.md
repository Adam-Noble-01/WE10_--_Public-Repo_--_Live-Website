# PS02 is a duplicate of PS01 - read this before touching this project

**PS02__MustersRoad__OfficialPdPack** is a deliberate duplicate of **PS01__MustersRoad**, created 17-Sep-2026.

## Why this exists

PS01 carries a detailed builder's set of drawings for Musters Road. That set is overkill for a
Permitted Development application - the Local Planning Authority (Rushcliffe Borough Council) needs
a strictly-legal-minimum "dumbed-down" pack: existing/proposed site plans, floor plans and elevations,
nothing more.

Rather than maintain two divergent versions of the same TrueVision model and drawing layouts inside
one job number, this is a completely separate job code. TrueVision isn't yet set up for that kind of
parallel version control (i.e. two genuinely different models/layouts living under one project), so
keeping the simplified PD pack under its own code keeps the two data sets from bleeding into each
other.

## What was copied verbatim (byte-for-byte, unmodified) from PS01

- `30__TrueVision__AppContent/` - every GLB model, export log, the site plan drawing data, the
  drawing notes JSON and `TrueVision__ProjectData__.json` (internal `projectCode` still reads `PS01`
  in places - deliberately left as-is; Adam will resolve this manually via the Layout Editor when he
  strips the layouts back).
- `20__PlanVision__AppContent/` - the empty phase-folder scaffold and `PlanVision__ProjectData__.json`.
- `01__Archive/` placeholder.

**Nothing in TrueVision or PlanVision has been adjusted.** Adam will manually strip the drawing
layouts back to the Permitted Development minimum using the Layout Editor app, and will re-save
simplified GLB model exports over the copied files himself.

## What was rebuilt/simplified for PS02 (the admin system side)

All client-facing admin documents under `10__ProjectAdmin__AppContent/` were copied from PS01 and
then stripped back so nothing here reads as a second, live, billable engagement:

- **Welcome letter** (`projectBriefConcise` / `projectBriefFull` in the Project Config) now reads
  only: *"This is not the live case. Please instead see the live project, which is PS01."*
- **Quotation** (`QUO-PS02-2026-001`) - single zero-value line item, "See PS01 For Fees".
- **Invoice** (`INV-PS02-2026-001`) - single zero-value line item, "Paid In Full", Ref: **CPS 01**,
  status `paid`, dated 17-Sep-2026. All real fees and payment history remain under PS01's own
  invoice (`INV-PS01-2026-001`).
- **Special terms** (all five contracts) - stripped to a single redirect note each, and
  `specialTermsEnabled` set to `false` in the Project Config so none of them render.
- **Project PIN** - reuses PS01's PIN hash verbatim. Same client, same portal access code.
- **Client PII** has **not** been duplicated to R2 under PS02 - no separate client data push was
  made for this code. If a real portal login/rendering is ever needed for PS02, push it via
  `na_push_clientdata.py PS02` from the PS01 client data first.

## Registries

PS02 has been added to both `AppConfiguration__ProjectKeysIndex__.json` and
`ProjectVision__MasterProjectIndex__Core__.json` under year `26`, folder
`PS02__MustersRoad__OfficialPdPack`.

## Not committed

None of this has been committed or pushed. Review in the GUI editors (Project Config, Quotation
Manager, Contract Manager, Invoice Manager) before doing so.
