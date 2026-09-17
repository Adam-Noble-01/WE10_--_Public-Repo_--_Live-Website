# Policy & Constraint Research — Sourcing, Logging, Citing

How to gather the evidence and policy base for the statement. Everything cited in the document must pass through this process — the statement's authority rests on being checkable.

## 1. Intake checklist

Facts to hold before full drafting (modes A/B). Gather from the user's brief, the job folder, and targeted questions. Ask in a structured batch, not a drip-feed.

**The application**: applicant name(s) and title · site address and postcode · local planning authority (and parish if any) · application type (householder etc.) · project code and revision letter/date.

**The proposal**: one-sentence description · full schedule of works · rooms/uses created · what remains unchanged.

**The need**: who the scheme serves and why now · what changed in the household · why the existing dwelling cannot meet the need.

**The design reasoning**: each significant design decision *and its why* · alternatives considered and rejected (and why) · self-imposed constraints · elements the client fears will be contentious · any pre-application advice received.

**The context**: estate/area age and character · prevailing materials and motifs · neighbouring precedents (extensions, dormers, ridge heights) · topography and levels relative to neighbours.

**Neighbour geometry**: what each elevation faces · neighbouring windows and their uses · separation distances · existing screening.

**Materials**: existing palette · proposed palette (match or contrast, and why).

**Imagery**: what exists in `01__DaStatement__Images/` · what can be produced (drone, CGI existing/proposed pairs, constraint map captures, annotated sightlines).

Every gap: either the user supplies it or (where researchable) offer to find it online. Present the choice explicitly. Never fill a gap by assumption.

## 2. The constraint sweep

Check each constraint, record the finding, source URL, and date in the research log. A "clear" finding is as valuable as a hit — section 3.0 is built from proven negatives (playbook P2).

| Constraint | Primary source | Record |
| :--- | :--- | :--- |
| Flood zone | GOV.UK "Flood map for planning" (flood-map-for-planning.service.gov.uk) | Zone number; whether FRA required |
| Conservation area | LPA's interactive policies/constraints map or conservation pages | In/out; name and distance of nearest boundary |
| Listed buildings | Historic England — National Heritage List for England (search "the List") | Nearest entry, grade, list number, approximate distance and how measured |
| Tree Preservation Orders | LPA TPO register/map | On-site or adjacent TPOs; conservation-area tree controls |
| Article 4 directions | LPA Article 4 pages/map | Any direction affecting the site; which PD rights removed |
| Green belt | LPA policies map (MAGIC magic.defra.gov.uk as fallback) | In/out |
| Ecology designations | MAGIC (SSSI, SAC, SPA, ancient woodland) | Nearby designations if relevant |
| Planning history | LPA public access portal — search the site *and neighbouring addresses* | Site history; nearby approvals usable as precedent (P5); conditions removing PD rights |
| Situational | Coal mining referral areas, smoke control, radon, airport safeguarding | Only where the locality raises them |

Find the LPA via gov.uk/find-local-council if unknown; in two-tier areas the district/borough handles householder applications.

## 3. The policy harvest

Download the actual documents — the citations come from the PDFs, not from memory or search snippets.

1. **Development plan documents**: the LPA's adopted local plan (often two parts — a core strategy and a development management policies document), found on the LPA website under Planning Policy. Note adoption years. Check for a **made neighbourhood plan** covering the site — it is part of the development plan and parish councils weigh it heavily.
2. **SPDs and design guides**: the householder/residential extensions design guide if the LPA has one — it contains the measurable tests (45-degree rules, separation distances, dormer guidance) the officer will apply directly.
3. **NPPF**: download the current version from gov.uk. **Version warning — treat as live risk**: the NPPF is revised frequently and paragraph numbers move; a wholesale restructuring into coded policies has been in progress (draft December 2025, final expected 2026). At every job, confirm which version is in force on the day, download that, and cite only from it, naming the version in the citation.
4. Identify the 4–8 policies that actually bite on a householder scheme — typically: design/character, residential amenity, extensions-specific policy, parking/access, plus any constraint-triggered policies (heritage, flood, trees).

**Storage** — inside the job folder:

```
00__PlanningPolicy__Reference/
├── 00__ConstraintsAndPolicy__ResearchLog.md
├── 01__Nppf__{{Month-Year}}__.pdf
├── 02__{{Council}}LocalPlan__{{Part-Year}}__.pdf
├── 03__{{Council}}__{{SPD-Name}}__.pdf
└── …
```

If a download fails or web access is unavailable, ask the user to supply the documents. Do not proceed to cite anything that is not in the folder.

## 4. The research log

`00__ConstraintsAndPolicy__ResearchLog.md` records, for the user and future sessions:

```markdown
# Constraints And Policy Research Log — {{ProjectCode}}

## Constraint Findings

| Constraint | Finding | Source | Date Checked |
| :--- | :--- | :--- | :--- |
| Flood zone | Zone 1 | flood-map-for-planning.service.gov.uk | 2026-07-04 |

## Policy Extracts

### Policy {{ref}} — {{Document name and year}} (p.{{n}})
> {{Verbatim wording of the operative parts}}

Relevance: {{which argument this anchors}}
```

Verbatim extracts matter: the compliance table and woven citations are written against these exact words, and the user can audit every characterisation.

## 5. Citation rules

- **Verification is absolute**: cite only policies whose wording sits in the research log, extracted from a document in `00__PlanningPolicy__Reference/`. If it cannot be verified it is not cited — no exceptions, however confident memory feels.
- **Inline citation forms**: "in accordance with Policy 10 of the Rushcliffe Local Plan Part 1: Core Strategy (2014)" · "consistent with paragraph 135 of the NPPF (December 2024)" · "as required by Policy DM1 of the Local Plan Part 2 (2020)". Name the document and year on first use in a section; shorter forms may follow.
- **Faithful characterisation**: describe what the policy actually requires. Officers know their own policies; a stretched characterisation reads as either incompetence or spin.
- **Weave with restraint**: one or two anchors at the point each argument lands — typically in the concluding sentences of a section ("This approach accords fully with Policy…"). The prose must remain readable advocacy, not a legal footnote thicket. The compliance table (structure guide §7) carries the systematic policy-by-policy demonstration; the woven citations carry the rhetorical weight.
- **The conclusion** names the development plan and the NPPF in summary form, as the exemplar does, now backed by the specific citations made earlier.

## 6. Evidence for figures

Constraint findings become figures: screenshot/export the flood map and conservation area map views (with the site clearly identifiable), save to `01__DaStatement__Images/03__FinalImages/` under the naming convention, embed in section 3.0, and cross-reference from the prose. Where a map cannot be captured this session, leave a `[TO CONFIRM: image required — {{map description}}]` marker and list it for the user.
