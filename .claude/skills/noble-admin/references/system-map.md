# System Map

## The four apps

| App | Code lives in | Project content lives in | What it does |
|---|---|---|---|
| **Project Admin / Document System** | `na-apps\10__NaProjectAdmin__DocumentSystem__CoreAppCode\` | `10__ProjectAdmin__AppContent\` | Client-facing portal: welcome letter, quotations, T&Cs, invoices, e-signatures. PIN-gated. |
| **PlanVision** | `na-apps\20__PlanVision__CoreAppCode\` | `20__PlanVision__AppContent\` | Online drawing viewer — PDF/PNG drawing sets by design phase, Design & Access Statement. |
| **TrueVision** | `na-apps\30__TrueVision__CoreAppCode\` | `30__TrueVision__AppContent\` | 3D model viewer — GLB models, walk/fly navigation. |
| **ProjectVision** | `na-apps\05__ProjectVision__CoreAppCode\` | (index only) | Umbrella launcher; holds the master project index across all apps. |

All four are entered with `?project=XX00`.

## Portal folder tree

```
na-project-portal\
  26-Projects\
    EB03__TheFirs\                        <- {CODE}__{PascalCaseName}
      01__Archive\
      10__ProjectAdmin__AppContent\
        ProjectAdmin__ProjectConfig__.json      <- config + brief + contracts + hashed PIN
        ProjectAdmin__Quotations__.json         <- CURRENT: { "quotations": [...] }
        ProjectAdmin__Invoices__.json           <- { "invoices": [...] }
        SpecialTerms__{contractId}__.json       <- CURRENT: one per contract
        ProjectAdmin__Quotation__.json          <- LEGACY singular, ignore
        ProjectAdmin__SpecialTerms__.json       <- LEGACY, ignore
      20__PlanVision__AppContent\
        PlanVision__ProjectData__.json
        DesignPhase01__ConceptDesign__Content\
        DesignPhase02__PlanningApproval__Content\
          01__AdminDocs\
          02__DesignStatment\                   <- note: spelled "Statment" in the tree
            01__Statement__ImageFiles\
        DesignPhase03__BuildingRegs__Content\
          01__Plans\  02__ConstructionDetails\  03__3dViews\
      30__TrueVision__AppContent\
        TrueVision__ProjectData__.json
        DesignPhase01__ConceptDesign__ExistingBuilding\
        DesignPhase01__ConceptDesign__Scheme-01\
```

Year folder = last two digits of the project's start year. `26-Projects` is current (2026).

Folder name = `{CODE}__{ProjectName with spaces removed}`. "The Firs" → `EB03__TheFirs`. Some 2025 folders use legacy `_-_` and hyphens (`GA06_-_Cloves-Wood`) — do not copy that; use `__` and PascalCase.

## Storage boundary — the thing to get right

The MDC rule "dynamic content goes to R2" is about *runtime-written* content. In practice the split is:

**Repo → GitHub Pages** (`https://www.noble-architecture.com/na-project-portal/...`)
- All of `10__ProjectAdmin__AppContent\*.json`
- The app loads these via `projectPortalBase: "/na-project-portal/"`
- Published by `git push` — **Adam's job, never yours**

**Cloudflare R2** (`https://cdn.noble-architecture.com/NaProjectPortal/...`)
- `ClientData__Private__.json.enc` — client PII, AES-256-GCM, via the authenticated worker
- Signature records
- `SharedData/PaymentDetails__BankTransfer__.json.enc`
- PlanVision drawing PDFs/PNGs and TrueVision GLBs

R2 keys mirror local paths exactly: local `na-project-portal\26-Projects\EB03__TheFirs\20__PlanVision__AppContent\x.pdf` → key `NaProjectPortal/26-Projects/EB03__TheFirs/20__PlanVision__AppContent/x.pdf`. Bucket `noble-architecture-cdn`.

`CloudflareR2__ModelSync__Main__.py` syncs **only** `20__PlanVision__AppContent` and `30__TrueVision__AppContent`. It does **not** touch `10__ProjectAdmin__AppContent`.

## Registries — both must be updated for a new project

1. **`AppConfiguration__ProjectKeysIndex__.json`** — `na-apps\10__NaProjectAdmin__DocumentSystem__CoreAppCode\03__Src__AppModules\02__AppData\`
   ```json
   { "26": { "EB03": "EB03__TheFirs" } }
   ```
   Maps code → folder name, grouped by year. The admin app cannot find a project without this.

2. **`ProjectVision__MasterProjectIndex__Core__.json`** — `na-apps\05__ProjectVision__CoreAppCode\05__AppData\`
   ```json
   { "projects": { "EB03": {
       "projectCode": "EB03", "projectName": "The Firs",
       "projectFolder": "EB03__TheFirs", "projectYear": "26",
       "subApps": { "projectAdmin": true, "planVision": true, "trueVision": true }
   } } }
   ```
   `subApps` flags drive which app tiles appear. Set `projectAdmin: true` immediately; `planVision`/`trueVision` become true once real content exists.

`na_new_project.py` updates both.

## GUI editors — where Adam reviews your work

Served by `start_local_server.py` (Flask) in the admin app folder, launched from `start_local_server.bat`.

| Editor | Edits |
|---|---|
| `Editor__ProjectConfig__.html` | Project name, briefs, internal notes, PIN, **client PII** (encrypts to R2 on save) |
| `Editor__QuotationManager__.html` | Multi-quotation list + line item editor |
| `Editor__InvoiceManager__.html` | Invoice list + line items |
| `Editor__ContractManager__.html` | Which contracts are enabled, `specialTermsEnabled` flags, special terms text |
| `Editor__ProjectIndexBuilder__.html` | Registry maintenance |

Point Adam at the right one when you hand back.

## Config files worth knowing

- `03__Src__AppModules\02__AppData\AppConfiguration__MainAppSettings__.json` — app version, contract registry (9 contracts), feature flags, Cloudflare endpoints, company details.
- `03__Src__AppModules\22__InvoiceSystem\InvoiceSystem__AppConfig__.json` — invoice ref format, due days (7), standard note.
- `10__GeneralTerms__Markdown\` — the seven approved standard contract markdown files. **These are the approved standard terms — do not edit them for a single project.** Project-specific variations go in special terms JSON.
