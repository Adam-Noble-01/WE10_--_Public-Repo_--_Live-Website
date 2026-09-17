# Special Terms Playbook — "the yellow box"

Standard contract terms are **fixed and approved**, held as markdown in `na-apps\10__NaProjectAdmin__DocumentSystem__CoreAppCode\10__GeneralTerms__Markdown\`. They are business-wide. **Do not edit them for one project.**

Project-specific variations go in special terms JSON, which the app renders in a highlighted box above the standard terms.

## Contract registry

From `AppConfiguration__MainAppSettings__.json` → `ContractRegistry.available`.

| contractId | contractName | shortName | Standard terms markdown |
|---|---|---|---|
| `general-business` | General Business Terms | General Terms | `10_00__ApprovedStandardTerms__GeneralBuisinesTerms__.md` |
| `concept-design` | Concept Design Stage | Concept Design | `10_01__...ConceptStage__DesignPhase-02__.md` |
| `planning-approval` | Planning Approval Stage | Planning | `10_02__...PlanningApproval__DesignPhase-02__.md` |
| `building-regulations` | Building Regulations Stage | Building Regs | `10_03__...BuildingRegulations__DesignPhase-03__.md` |
| `project-management` | Project Management Stage | Project Mgmt | `10_04__...ProjectManagement__DesignPhase-04__.md` |
| `building-surveying` | Building Surveying Service | Surveying | `10_10__...BuildingSurveyingSurvey__.md` |
| `planvision-app` | PlanVision App Terms | PlanVision | `10_20__...PlanVisionApp__.md` |
| `truevision-app` | TrueVision App Terms | TrueVision | `10_30__...TrueVisionApp__.md` |
| `project-vision` | ProjectVision App Terms | ProjectVision | `10_40__...ProjectVision__.md` |

`general-business` is `required: true` — always enabled. Defaults for a new project: `general-business` + `concept-design`.

## Two switches, both needed

For the yellow box to render:

1. `ProjectAdmin__ProjectConfig__.json` → `contracts.{id}.enabled: true`
2. `ProjectAdmin__ProjectConfig__.json` → `contracts.{id}.specialTermsEnabled: true`
3. `SpecialTerms__{id}__.json` exists with a non-empty `terms` array
4. `documents.specialTerms: true`

Miss any one and the client sees nothing. Always set them together.

## File shape

```json
{
    "contractId": "planning-approval",
    "contractName": "Planning Approval Stage",
    "sectionTitle": "Special Terms - Planning",
    "introduction": "The following special conditions apply to this contract.",
    "terms": [
        { "id": 1, "title": "Short Title Case Heading", "content": "One or two paragraphs of prose." }
    ],
    "lastUpdated": "2026-04-11T17:51:38.650Z"
}
```

`sectionTitle` convention: `"Special Terms - {shortName}"`.

## House voice

Read `SpecialTerms__building-regulations__.json` on EB03 — ten terms, and the best example of the register. Characteristics:

- **Third person, named party.** "**Noble Architecture** will prepare and submit…", not "we will". Bold the party names on first significant use.
- **Title Case headings**, short, naming the risk: "Limitation of Noble Architecture's Appointment", "Transfer of Technical Responsibility After Planning", "Drainage And Build Over Agreements".
- **Prose paragraphs**, not bullets. One idea per term.
- **Cite the statute** where a duty transfers: "In accordance with the Building Safety Act 2022 and the Building Regulations etc. (Amendment) (England) Regulations 2023…".
- **Anchor to what actually happened.** "During my site visit on 11ᵗʰ April 2026 we went through…" — real dates, real conversations. This is what makes the terms defensible.
- **State the limit plainly, then who picks it up.** Never leave a gap with nobody holding it.
- Mark optional add-ons in the title: `"Optional Agency Services - **Optional Add-On"`.

## Recurring patterns

These come up repeatedly — adapt, don't copy verbatim, and only include when the facts support them.

**Scope ends at planning** (`building-regulations` or `planning-approval`)
Noble Architecture's appointment concludes at submission of the planning application unless the quotation explicitly includes Design Phase 03. Planning drawings are illustrative concept documents and must not be relied on for fabrication, procurement, setting-out or construction.

**Principal Designer transfer** (`building-regulations`)
The statutory Principal Designer role is phase-specific. Unless retained in writing for the Building Regulations phase, Noble Architecture's role concludes at planning submission and transfers to the party in control of the building work.

**Building Notice route elected by the contractor** (`building-regulations`)
No pre-approved technical plans; Building Control approves retrospectively on site. Faster but higher financial risk. Noble Architecture accepts no liability for remedial or abortive works arising.

**Structural engineers / independent verification** (`building-regulations`)
The contractor appoints their own engineers. Nothing Noble Architecture issues constitutes a measured building survey. Specialists must verify dimensions on site.

**Planning application preparation and submission only** (`planning-approval`)
Prepare and submit to the agreed scope; responsibility for LPA correspondence transfers to the client on validation. Optional agency service must be agreed in writing before submission, with fees adjusted.

**Site-specific physical findings** (any)
Drains, foundations, underpinning, moisture migration, party walls, trees. Written from what was actually observed on the visit. These are the highest-value terms — they are the ones that stop an argument later.

**Re-engagement** (`building-regulations`)
Later requests for a full technical package are a new instruction: fresh quotation, 30-day validity, minimum 6-week lead time.

## Writing a set

1. Confirm which contract each term belongs to. A term about drains at construction stage belongs to `building-regulations`, not `general-business`.
2. Order: scope limits and responsibility transfers first, then site-specific findings, then commercial/re-engagement terms last.
3. Number `id` from 1, sequentially, per file.
4. Set both config flags.
5. Tell Adam to review in `Editor__ContractManager__.html`.

## What does *not* belong here

- Payment schedules and fee structures → the quotation, or general business terms
- Anything contradicting the approved standard terms — that's a business-wide change; flag it and ask
- Internal notes → `specialNotes` in the project config
- Boilerplate already covered by the standard markdown — don't restate it
