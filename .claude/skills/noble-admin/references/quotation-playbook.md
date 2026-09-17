# Quotation Playbook

Gold reference: `na-project-portal\26-Projects\EB03__TheFirs\10__ProjectAdmin__AppContent\ProjectAdmin__Quotations__.json`.

## Rate card

| | |
|---|---|
| Standard charge-out rate | **£25.00 / hour** |
| VAT | **20%**, `vatApplicable: true` |
| Currency | GBP, `£` |
| Validity | 30 days |
| Initial design consultation | **Free** — always shown, at qty ≠ 0 with `unit: "Free"` and `rate: 0` |

Design fees carry VAT. Pass-through disbursements do not — those are disclosed on the quotation as excluded, and invoiced separately with `vatApplicable: false`.

## Adam thinks in VAT-inclusive totals — you must back-solve

When Adam names a target figure he almost always means the **grand total the client pays, inclusive of VAT**, not the net subtotal. Confirm which he means if there is any doubt, then work backwards:

```
net   = inclusive / 1.2
hours = net / 25
```

**One hour at £25 + 20% VAT moves the inclusive total by exactly £30.** So only multiples of £30 are reachable with whole hours:

| Hours | Net | VAT | **Inclusive** |
|---|---|---|---|
| 64 | £1,600 | £320 | £1,920 |
| 65 | £1,625 | £325 | £1,950 |
| 66 | £1,650 | £330 | £1,980 |
| 67 | £1,675 | £335 | £2,010 |

Before promising a target, check it divides. £1,975 was asked for on SB04 and is **not** reachable — it needs 65.83 hours. Say so immediately, show the two neighbouring figures, and let Adam pick rather than fudging a rate or inventing an adjustment line.

Expect his component figures not to add up on the first pass. On SB04 the first brief gave survey £600 + concept £650 but called phase one £1,350, and a £1,950 total that did not reconcile with a £675 planning pack. **Lay the arithmetic out and ask** — do not silently pick a reading. It is the single highest-risk part of the job.

## Sub-points are numbered, not arrowed

`itemDescription` sub-points use `1. `, `2. `, `3. ` — numbered per line item, restarting at 1 for each.

```
1. Full measured building survey of BOTH the Ground Floor and First Floor.
2. Both floors are required because the internal wall removals will need new beams.
3. Includes travel to and from site.
```

EB03 and NP03 use `-> ` arrow bullets. That is the **old** style, superseded 17-Aug-2026 because Adam's clients use read-aloud and arrows do not verbalise. Read those projects for structure and wording, but renumber when carrying anything across.

## The four canonical groups

Use these exact strings. Older projects have inconsistent spacing — standardise on these:

```
Design Phase - 01 : Concept Design
Design Phase - 02 : Planning Approval
Design Phase - 03 : Building Regulations
Additional Extras : **For Discussion & Consideration!!
Third Party Fees - **Not Included!!
```

The `**` prefix is deliberate house style — it reads as a visual flag in the rendered quotation. Keep it.

## The qty-0 convention — important

Items with `quantity: 0` render on the quotation but contribute **£0** to the subtotal. This is how optional extras and excluded third-party fees are disclosed without inflating the price.

- Priced work → real quantity, real rate
- Optional extras → `quantity: 0`, `unit: "Optional"`, rate = the indicative price
- Third-party fees → `quantity: 0`, `unit: "item"`, rate = the indicative fee
- Free consultation → real quantity (e.g. 6), `unit: "Free"`, `rate: 0`

`subtotal` = Σ(quantity × rate). Recompute every time.

## Standard line-item catalogue

Default hours from EB03 (a ~50 m² two-storey domestic extension with a full DAS). Scale for project size and **always tell Adam which defaults you used**.

### Design Phase - 01 : Concept Design

| Description | Qty | Unit | Rate |
|---|---|---|---|
| Initial Design Consultation | 6 | Free | 0 |
| Building Survey & Travel | 7 | Hours | 25 |
| Model Existing Site Conditions | 24 | Hours | 25 |
| Prepare Design Proposal & Design Development | 10 | Hours | 25 |
| Finalisation of TrueVision Experience & Distribution | 6 | Hours | 25 |
| Coordination & Admin | 2 | Hours | 25 |

Subtotal at these defaults: **£1,225**

`Initial Design Consultation` → `itemDescription`: `"A free on-site design consultation meeting held on DD-MMM-YYYY"`

### Design Phase - 02 : Planning Approval

| Description | Qty | Unit | Rate |
|---|---|---|---|
| Drawing : Introduction Page | 2 | Hours | 25 |
| Drawing : Site & Block Plans | 4 | Hours | 25 |
| Drawing : Existing Floor Plans | 8 | Hours | 25 |
| Drawing : Proposed Floor Plans | 8 | Hours | 25 |
| Drawing : Existing Elevations | 6 | Hours | 25 |
| Drawing : Proposed Elevations | 6 | Hours | 25 |
| Production Of CGIs | 12 | Hours | 25 |
| Document : Design & Access Statement | 16 | Hours | 25 |
| Coordination & Admin | 2 | Hours | 25 |

Subtotal at these defaults: **£1,600**

Standard `itemDescription` values:
- Site & Block Plans — `1. Mandatory Drawing Required by LPA.\n2. Scale = 1:500 & 1:1250\n3. Size  = Iso A2`
- Floor Plans / Elevations — `1. Mandatory Drawing Required by LPA.\n2. Scale = 1:50\n3. Size  = Iso A2`
- Introduction Page — `1. Features CGI's Of Scheme.\n2. Not mandated but usually eliminates frustrating requests for material specifications, as everything can clearly be shown and described on this document.\n3. Size  = Iso A2`
- CGIs — `1. Final CGI's for the Introduction Page.\n2. Not mandatory but boosts chances greatly and reduces RFI's from the LPA.`
- DAS — `1. A robust and in-depth document.\n2. Forms a strong argument for the case, addressing known constraints and concerns proactively.`

### Additional Extras : **For Discussion & Consideration!!

| Description | Qty | Unit | Rate |
|---|---|---|---|
| Managed Planning Application (See Contract) | 0 | Optional | 400 |
| Design Phase 03 - Building Regulations | 0 | Optional | *scale to the job* |
| Planning Portal Fee | 0 | Optional | 85 |

**Scale the optional rates too.** They are qty-0 so they contribute nothing to the total, which makes them easy to copy across unthinkingly — but the client reads them. EB03's building regs figure of £3,400 was for a two-storey job with a first-floor addition; carried onto SB04 (single storey rear extension) Adam cut it to £1,600. Size the figure to the project and flag it for confirmation.

### Third Party Fees - **Not Included!!

| Description | Qty | Unit | Rate |
|---|---|---|---|
| Householder Planning Application Fee | 0 | item | **548** |
| OS Mapping Data | 0 | item | 50 |

⚠ **Verify statutory fees at time of quoting.** The 2026 figures in `10_02__ApprovedStandardTerms__PlanningApproval__DesignPhase-02__.md` are: Householder **£548**, Change of Use £610, Full Application £610/dwelling, Non-Material Amendment £44 householder / £298 other, Planning Portal upload £70.83 + VAT (£85.00). EB03's quotation carried an out-of-date £528 and £95 — the invoice then charged the correct £548 and £91.02. Don't inherit stale figures when re-quoting; check the terms markdown.

OS mapping is bought from MapServe.com; £42 for 1 hectare on EB03, budget £50.

## Refs and naming

- `quotationRef` — `QUO-{CODE}-{YYYY}-{NNN}`, zero-padded to 3, sequential per project. Read the existing file to find the next.
- `quotationName` — human label, "Main Quote" by default. Used when a project has several.
- `status` — new quotations are `"draft"`.
- `signatureRequired` — `true` unless Adam says otherwise.

## Worked example — totals

EB03 at the default catalogue:
```
Concept subtotal   1,225
Planning subtotal  1,600
Optional/3rd party     0   (qty 0)
─────────────────────────
subtotal           2,825
vat (20%)            565
grandTotal         3,390
```

## Re-quoting from another project

When told "same as EB03" or "re-quote what we did on Ashness Close":

1. Read that project's `ProjectAdmin__Quotations__.json`.
2. Carry over the structure, groups and `itemDescription` text.
3. **Re-derive** everything project-specific: ref, date, `projectAddress`, `projectDescription`, and any statutory fee.
4. Adjust hours for the new project's size and scope — don't copy blindly.
5. Report a short diff: what you kept, what you changed and why.

## Multiple quotations on one project

Append to the `quotations` array; don't overwrite. NP03 has a second small quotation (`QUO-NP03-2026-002`) for extra work. The client-facing app shows a picker when there's more than one. Each carries its own signature state.

## Special terms pairing

A quotation nearly always ships with special terms. After writing the quotation, ask which contracts apply if it wasn't stated, then follow `special-terms-playbook.md`. Reference the contract from the quotation where relevant — EB03 uses "(See Contract)" in the Managed Planning Application line.
