# Invoice Playbook

Gold reference: `na-project-portal\26-Projects\EB03__TheFirs\10__ProjectAdmin__AppContent\ProjectAdmin__Invoices__.json` — three invoices covering both patterns.

## Rules

| | |
|---|---|
| Ref | `INV-{CODE}-{YYYY}-{NNN}`, zero-padded to 3, sequential per project |
| Payment terms | **7 days** — `dueDate` = `invoiceDate` + 7 |
| VAT on design fees | 20%, `vatApplicable: true` |
| VAT on pass-through disbursements | **0%, `vatApplicable: false`** |
| Standard note | "Thank you for your business. We hope you are satisfied with the service received from Noble Architecture." |
| Billing email | Billing@Noble-Architecture.com |
| Payment method | Bank transfer; details fetched encrypted from R2 at render — **never put bank details in project JSON** |

Read the existing invoices file to find the next ref. Never guess the sequence.

## Two invoice types — never mix them

### 1. Stage payment (design fees, VAT 20%)

One line item per design phase. `description` is the phase group name from the quotation.

```json
{
    "description": "Design Phase - 01 : Concept Design",
    "itemDescription": "-> Stage Payment 1 of 2\n-> Next Due upon completion of Planning Permission Stage\n-> Fee as per Quote Ref: QUO-EB03-2026-001\n\nServices Rendered\n1. Initial Design Consultation\n2. Building Survey & Travel\n3. Model Existing Site Conditions\n4. Prepare Design Proposal & Design Development\n5. Finalisation of TrueVison Experience & Distribution\n6. Handover of Complete agreed Concept Revision_A",
    "quantity": 1,
    "rate": 1225,
    "unit": "item"
}
```

`itemDescription` structure — keep this shape:
1. `-> Stage Payment N of M`
2. `-> ` what triggers the next one, or `-> This is the final invoice for Design Services.`
3. `-> Fee as per Quote Ref: QUO-XXXX-YYYY-NNN`
4. blank line, then `Services Rendered`, then a numbered list

The services-rendered list comes from the quotation's line items for that group. Add anything genuinely delivered beyond the quote (EB03 listed two extra tweak sessions and the concept handover) — but only if Adam says it happened.

`rate` = the group subtotal from the quotation. Verify by summing that group's `quantity × rate`.

### 2. Pass-through / disbursement (VAT 0%)

Third-party fees Noble Architecture collects on the client's behalf. **VAT-exempt** — `vatApplicable: false`, `vatRate: 0`, `vat: 0`, `grandTotal` = `subtotal`.

One line per fee, each with evidence in `itemDescription`: what it is, who set it, the exact amount, the date confirmed.

```json
{
    "description": "Householder Planning Application Fee",
    "itemDescription": "\n-> Fee set by local authority.\n-> Planning Portal service charge: £548.00 - Confirmed 19-Jul-2026.\n-> Noble Architecture agreed to collect the fees on your behalf to pay the council.",
    "quantity": 1, "rate": 548, "unit": "item"
}
```

EB03's disbursement invoice: application fee £548 + Planning Portal £91 + OS mapping £42 = £681, no VAT.

**Never put a disbursement line on a design-fee invoice.** The VAT treatment differs, so they must be separate invoices.

## Totals

```
subtotal   = Σ(quantity × rate)
vat        = round(subtotal × vatRate / 100)
grandTotal = subtotal + vat
```

Design fee: `vatApplicable: true`, `vatRate: 20`.
Disbursement: `vatApplicable: false`, `vatRate: 0`, `vat: 0`.

Always recompute. Never carry totals across from another invoice.

## Status

Only two values are ever stored:

- `unpaid` — issued and outstanding. This is also the renderer's default when `status` is absent.
- `paid` — set `paidDate` alongside it.

**`overdue` is computed, not stored.** `DocumentSystem__InvoiceRenderer__.js` derives it by comparing `dueDate` to today and swaps the badge itself. Writing `"status": "overdue"` is wrong.

`draft` and `sent` are *quotation* statuses — they do not apply to invoices.

Only mark paid when Adam says it's paid.

## Other fields

- `projectDescription` — the scope this invoice covers. EB03's first invoice prefixed it with the phase: "Concept Design Services - Single Storey Extension...". Reuse `projectBriefConcise` and prefix the phase where it helps.
- `projectAddress` — often left `""` on invoices; harmless.
- `group` — optional on invoice items. The renderer groups by `item.group || item.phase || '_default'`; EB03 omits it (one block), NP03 sets it. Omit unless a multi-phase invoice reads better split.
- `personalNote` — the standard note unless Adam gives one.
- `clientDataStorage` — always `"cloudflare-r2-encrypted"`.
- `createdDate` / `lastModified` — GUI writes `DD/MM/YYYY, HH:MM:SS`; `DD-MMM-YYYY at HH:MM` is fine for what you author.

## Typical project sequence

EB03, a concept + planning job:

| Ref | Date | For | Net | VAT | Gross |
|---|---|---|---|---|---|
| INV-EB03-2026-001 | 10-Jun-2026 | Concept, stage 1 of 2 | £1,225 | £245 | £1,470 |
| INV-EB03-2026-002 | 19-Jul-2026 | Planning, stage 2 of 2, final design fee | £1,600 | £320 | £1,920 |
| INV-EB03-2026-003 | 19-Jul-2026 | Third-party pass-through | £681 | £0 | £681 |

Design fees sum to the quotation's £2,825 net / £3,390 gross. Disbursements sit outside it.

## Distribution

Invoice emails are generated from templates in `20__DistributionEmails\`. Not your job unless asked — write the JSON, tell Adam to review in `Editor__InvoiceManager__.html`.
