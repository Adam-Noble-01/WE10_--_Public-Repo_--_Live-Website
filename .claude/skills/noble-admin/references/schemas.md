# JSON Schemas

Exact shapes the live apps read. Reference project: `na-project-portal\26-Projects\EB03__TheFirs\`.

**Formatting:** 4-space indent, trailing newline, UTF-8. Keys sorted alphabetically when the GUI editor wrote the file — match that if editing an existing file, otherwise use the logical order below.

**Dates:** two formats coexist, both correct in context.
- `"11-Apr-2026"` — display dates written by hand (`quotationDate`, `invoiceDate`, `dueDate`, `paidDate`, `createdDate`)
- `"11-Apr-2026 at 18:19"` — display date+time
- `"2026-04-11T19:53:17.932Z"` — ISO, written by GUI editors into `lastModified` / `lastUpdated`
Write display format for anything you author; leave ISO values alone if already present.

---

## ProjectAdmin__ProjectConfig__.json

```json
{
    "projectCode": "EB03",
    "projectName": "The Firs",
    "projectBriefConcise": "One sentence. Renders as the welcome-letter summary and is reused as quotation projectDescription.",
    "projectBriefFull": "## Project Overview And Goals\nMarkdown. Renders as the detailed brief.",
    "specialNotes": "Internal only — never client-facing.",
    "projectPin": "sha256:6dd6d777...",
    "clientDataStorage": "cloudflare-r2-encrypted",
    "contracts": {
        "general-business": {
            "enabled": true,
            "signed": false,
            "signatureRef": null,
            "signedDate": null,
            "specialTermsEnabled": false
        }
    },
    "documents": { "quotation": true, "specialTerms": true },
    "createdDate": "11-Apr-2026",
    "lastModified": "11-Apr-2026 at 19:53"
}
```

- `projectPin` — SHA-256 hex of the plain PIN, prefixed `sha256:`. Plain PINs still validate but are dev-only. Generate with `na_new_project.py`; the plain PIN is printed once, give it to Adam, then it is unrecoverable.
- `contracts` — one entry per enabled contract. Contract IDs in `project-codes.md` → no, see `special-terms-playbook.md`.
- `specialTermsEnabled: true` **and** a matching `SpecialTerms__{id}__.json` are both required for the yellow box to render.
- `clientName` may appear in older files — legacy, PII now lives in R2.

## ProjectAdmin__Quotations__.json

```json
{
    "quotations": [
        {
            "quotationRef": "QUO-EB03-2026-001",
            "quotationName": "Main Quote",
            "signatureRequired": true,
            "quotationDate": "11-Apr-2026",
            "projectAddress": "The Firs, Lowdham Road, Gunthorpe, NG14 7ES",
            "projectDescription": "Single Storey Extension to rear of Existing House...",
            "clientDataStorage": "cloudflare-r2-encrypted",
            "status": "draft",
            "lineItems": [
                {
                    "description": "Building Survey & Travel",
                    "itemDescription": "-> Optional detail, one point per line.\n-> Renders under the description.",
                    "quantity": 7,
                    "unit": "Hours",
                    "rate": 25,
                    "group": "Design Phase - 01 : Concept Design"
                }
            ],
            "totals": {
                "subtotal": 2825,
                "vatApplicable": true,
                "vatRate": 20,
                "vat": 565,
                "grandTotal": 3390
            },
            "additionalTerms": "",
            "createdDate": "11-Apr-2026 at 18:19",
            "lastModified": "11-Apr-2026 at 20:10"
        }
    ]
}
```

- `status` — `draft` | `sent` | `accepted` | `declined`. New quotations start `draft`.
- `signatureRequired` — defaults `true`. `false` hides the sign button entirely.
- `subtotal` = Σ(`quantity` × `rate`). `vat` = round(subtotal × vatRate/100). `grandTotal` = subtotal + vat. **Always recompute; never copy across from another project.**
- `itemDescription` — optional multi-line detail, `\n` separated. House style is **numbered** sub-points (`1. `, `2. `, restarting per item) so they verbalise under read-aloud. EB03 and NP03 still carry the old `-> ` arrows. Empty string when unused.
- Client address/email/phone are **not** in this file. Only `projectAddress` (the site) is.

## ProjectAdmin__Invoices__.json

```json
{
    "invoices": [
        {
            "invoiceRef": "INV-EB03-2026-001",
            "invoiceDate": "10-Jun-2026",
            "dueDate": "17-Jun-2026",
            "paidDate": "21-Jun-2026",
            "status": "paid",
            "projectAddress": "",
            "projectDescription": "Concept Design Services - Single Storey Extension...",
            "clientDataStorage": "cloudflare-r2-encrypted",
            "lineItems": [
                {
                    "description": "Design Phase - 01 : Concept Design",
                    "itemDescription": "-> Stage Payment 1 of 2\n-> Fee as per Quote Ref: QUO-EB03-2026-001\n\nServices Rendered\n1. Initial Design Consultation\n2. Building Survey & Travel",
                    "quantity": 1,
                    "rate": 1225,
                    "unit": "item"
                }
            ],
            "totals": {
                "subtotal": 1225,
                "vatApplicable": true,
                "vatRate": 20,
                "vat": 245,
                "grandTotal": 1470
            },
            "personalNote": "Thank you for your business. We hope you are satisfied with the service received from Noble Architecture.",
            "createdDate": "10/06/2026, 07:24:07",
            "lastModified": "21/06/2026, 12:16:26"
        }
    ]
}
```

- `status` — `unpaid` | `paid` only. **`overdue` is derived** from `dueDate` at render time — never store it. `draft`/`sent` are quotation statuses and do not apply here. Omit `paidDate` until paid.
- `dueDate` = `invoiceDate` + 7 days.
- `group` is optional on invoice line items. The renderer groups by `item.group || item.phase || '_default'`, so omitting it puts everything in one block — that's what EB03 does. NP03 sets groups. Either is fine.
- `createdDate`/`lastModified` on invoices use `DD/MM/YYYY, HH:MM:SS` — GUI-written. Use `DD-MMM-YYYY at HH:MM` for anything you author; both parse.

## SpecialTerms__{contractId}__.json

```json
{
    "contractId": "planning-approval",
    "contractName": "Planning Approval Stage",
    "sectionTitle": "Special Terms - Planning",
    "introduction": "The following special conditions apply to this contract.",
    "terms": [
        { "id": 1, "title": "Planning Application Preparation & Submission Only", "content": "Full paragraph." }
    ],
    "lastUpdated": "2026-04-11T17:51:38.650Z"
}
```

- Filename must match `contractId` exactly: `SpecialTerms__planning-approval__.json`.
- `id` is 1-based and sequential. `terms: []` is valid (renders nothing).
- `content` supports `**bold**`. Keep it to plain prose paragraphs.

## PlanVision__ProjectData__.json

```json
{
    "na-project-data-library": {
        "project-details": {
            "project-name": "The Firs",
            "project-name-nickname": "The Firs",
            "project-address": "",
            "project-description": "",
            "client-name": ""
        },
        "project-phase-config": {
            "active-design-phase": "DesignPhase02",
            "available-phases": ["DesignPhase01", "DesignPhase02"],
            "phase-last-updated": "20-Jul-2026"
        },
        "project-documentation": {
            "phase-content": {
                "DesignPhase02": {
                    "phase-folder": "DesignPhase02__PlanningApproval__Content",
                    "folder-structure": [
                        {
                            "label": "Plans",
                            "document-type": "Drawing",
                            "document-scale": "1:50",
                            "document-size": "A2",
                            "files": ["EB03_T02_D01__ExistingGroundFloorPlan__RevB__"]
                        }
                    ]
                }
            }
        },
        "design-access-statement": { "das-enabled": false }
    }
}
```

**Note the kebab-case** — PlanVision alone uses it; every other file is camelCase.

`files` entries are basenames with **no extension** — the app appends `.pdf` and `.png`. Naming is `{CODE}_T{phase}_D{nn}__{Title}__Rev{X}__`. Do not fabricate these; on a new project leave `folder-structure: []` until real drawings exist. For splitting and naming a drawing set, use the separate `planvision-file-naming` skill.

Full `design-access-statement` block (only when a DAS exists) — copy from `AA00__ExampleProjectStructure`.

## TrueVision__ProjectData__.json

```json
{
    "projectCode": "EB03",
    "projectName": "The Firs",
    "activeGroupIndex": 0,
    "modelGroups": [
        { "groupId": "DesignPhase01__ConceptDesign__ExistingBuilding",
          "label": "Concept Design - Existing Building",
          "modelUrls": ["https://cdn.noble-architecture.com/NaProjectPortal/26-Projects/EB03__TheFirs/30__TrueVision__AppContent/DesignPhase01__ConceptDesign__ExistingBuilding/....glb"] }
    ],
    "Camera__DefaultPosition": {
        "Camera__DefaultPos": { "Camera__DefaultPos__PosX": 21166, "Camera__DefaultPos__PosY": 1809, "Camera__DefaultPos__PosZ": -39467 },
        "Camera__DefaultRotation": { "Camera__DefaultRotation__RotX": -3.104, "Camera__DefaultRotation__RotY": 0.4849, "Camera__DefaultRotation__RotZ": 3.1241 },
        "Camera__DefaultMisc": { "Camera__DefaultMisc__Fov": 45 }
    },
    "Navmode__EnabledModes": { "Navmode__EnabledModes__Walk": true, "Navmode__EnabledModes__Fly": true }
}
```

`modelUrls` is generated from actual GLB exports by the R2 model sync. **Never hand-author model URLs.** On a new project write `modelGroups: []`. Camera positions are integer millimetres, set by Adam from SketchUp.

## ClientData__Private__.json  (PII — stage privately, never in the repo)

```json
{
    "clientName": "Jane Smith",
    "clientEmail": "jane@example.com",
    "clientPhone": "07700 900123",
    "clientAddress": {
        "houseNameNo": "42", "street": "Meadow Lane",
        "district": "West Bridgford", "county": "Nottinghamshire", "postcode": "NG2 3BQ"
    },
    "projectAddress": {
        "houseNameNo": "The Firs", "street": "Lowdham Road",
        "district": "Gunthorpe", "county": "Nottinghamshire", "postcode": "NG14 7ES"
    },
    "secondaryContact": { "name": "", "email": "", "phone": "" }
}
```

`clientAddress` = where the client lives (billing). `projectAddress` = the site. Often the same — ask rather than assume. Write to `C:\Users\Administrator\.claude\noble-admin-private\clientdata\{CODE}__ClientData__Private__.json`, then push with `python scripts/na_push_clientdata.py {CODE}`.

**Joint clients — a couple, two names.** Every renderer reads `clientName` and nothing else; `secondaryContact` is stored but never displayed. So put both names in `clientName`:

```json
"clientName": "Sirisha Balmuri & Ashish Alurwar"
```

That drives the welcome-letter address block, the salutation ("Dear …,") and the quotation TO block together. Keep the second person's own email and phone in `secondaryContact`. Drop middle initials — Adam prefers the salutation to read naturally.

Address formatting is now consistent across all three renderers: `houseNameNo` and `street` join onto one line ("273 Wollaton Road"), then district, county, postcode. `QuotationRenderer` and `InvoiceRenderer` used to split them onto separate lines; fixed 17-Aug-2026 to match `CoverLetterRenderer`. If you see a house number orphaned on its own line, that regression is back.

Nothing client-facing renders a name or address until this is pushed — the welcome-letter greeting and the quotation TO block both fall back to "Client Name". If Adam reports those as blank, this is why.

Worker endpoint `POST /projectadmin/clientdata`, body `{projectCode, year, projectName, clientData, sessionToken}`. The session token is plain `base64("CODE:timestampMs:random")` with no shared secret; the Worker checks the code matches and the timestamp is recent. Retrieval is `GET ?project=CODE&token=...` and returns the payload under **`data`**, not `clientData`.
