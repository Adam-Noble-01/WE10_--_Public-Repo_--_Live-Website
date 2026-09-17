# Intake Checklist

Run this at step 2 of every task. Three columns matter:

- **Required** — cannot build without it. Ask.
- **Derivable** — you can get it from a file, the registry, or another project. **Go and get it. Do not ask.**
- **Optional** — build without it, mention it's absent.

Ask everything in **one numbered block**, each item carrying your best-guess default so Adam can answer telegraphically ("1 yes, 2 £548, 3 skip").

---

## New project

**Required**
1. Client full name — drives the code initials. If there are two clients, get both; they go into `clientName` as "A & B"
2. Project name — drives the folder
3. Site address — full, with postcode
4. Project brief — enough for one concise sentence
5. Which contracts apply (see below)
6. **The PIN** — Adam picks memorable four-digit numbers. Ask; don't generate one and make him correct it
7. **Any promised photos, sketches or surveys.** If the message says he is sending something and it isn't attached, stop and ask before building — a single mock-up can carry half the design intent

**Derivable**
- Project code → allocate from the registry per `project-codes.md`, then confirm
- Year folder → current year, `26`
- PIN → generate, hash, report the plain one once
- All file skeletons → templates
- `createdDate` → today

**Optional (build without, flag)**
- Client email / phone / billing address (if different from site)
- Secondary contact
- Full markdown brief — the concise one alone is enough to start
- Budget indication → `specialNotes`
- Site visit date → `specialNotes`

**Common contract sets**
- Concept only: `general-business`, `concept-design`
- Concept + planning (most common): `general-business`, `concept-design`, `planning-approval`
- Add `building-surveying` if you're doing a measured survey
- Add `building-regulations` if you carry past planning — and if the client's builder is taking it on, that's a *special terms* case, see the playbook

---

## Quotation

**Required**
1. Which design phases are in scope
2. Scope detail per phase — enough to pick line items
3. Whether the initial consultation is free (nearly always yes)
4. The target figure, **and whether it is inclusive or exclusive of VAT** — Adam usually means inclusive. Check it divides by £30 before agreeing to it (see the playbook)

**Derivable**
- Next quotation ref → read `ProjectAdmin__Quotations__.json`, increment
- Rate → £25/hour house standard
- VAT → 20%, `vatApplicable: true`
- Standard line items and default hours → `quotation-playbook.md`
- `projectDescription` → reuse `projectBriefConcise` from the config
- `projectAddress` → from the config or the staged PII file
- All totals → compute
- "Same as project X" → read X's quotations file

**Optional**
- Custom hours per item — say which defaults you used if not given
- Optional extras to show at qty 0
- Third-party fees to disclose
- `quotationName` — defaults "Main Quote"

**Always confirm before writing**: the grand total and the hours for anything you estimated. Getting an hours estimate wrong is the single most likely way this goes wrong.

---

## Invoice

**Required**
1. What's being invoiced — which stage, or which pass-through fees
2. Amount, or which quotation lines it corresponds to
3. Invoice date (default: today)

**Derivable**
- Next invoice ref → read `ProjectAdmin__Invoices__.json`, increment
- Due date → invoice date + 7 days
- VAT: 20% on design fees, **0% and `vatApplicable: false` on pass-through disbursements** — never mix the two in one invoice
- `personalNote` → the standard note
- Services-rendered list → from the corresponding quotation lines
- Stage numbering ("2 of 2") → count existing invoices against the quotation

**Optional**
- `paidDate` and `status: "paid"` — only if Adam says it's paid
- Custom note

**Never assume** an amount from the quotation without checking scope actually completed.

---

## Special terms

**Required**
1. Which contract the terms attach to (the contract ID)
2. The substance — what's being varied, limited or added

**Derivable**
- `contractId`, `contractName`, `sectionTitle` → from the contract registry
- `introduction` → standard line
- `id` numbering → sequential
- Whether the contract is enabled → read the project config
- House voice and structure → `special-terms-playbook.md`

**Optional**
- Third-party names (contractor, engineer) — only if named in the input
- Whether existing terms are replaced or appended

**Must also set** `contracts.{id}.specialTermsEnabled: true` in the project config, and `documents.specialTerms: true`. Terms with the flag off render nothing.

---

## Welcome letter

**Required**
1. Enough brief material for `projectBriefConcise`

**Derivable**
- Client name → R2 (rendered at runtime, not your problem)
- Company details, signature graphic → app config
- Structure → rendered by the app

**Optional**
- `projectBriefFull` markdown — much better with it
- `specialNotes` — internal only, never shown to the client

---

## Red flags — stop and ask

- Two different figures for the same fee in the input
- A project code that clashes with the registry
- Client name and project name conflated
- A quotation total that doesn't reconcile with a stated budget
- Any request to change the approved standard terms markdown in `10__GeneralTerms__Markdown\` — that's a business-wide change, not a project one. Confirm explicitly.
- Fees quoted from the standard terms tables that may have moved (planning application fee, Planning Portal charge) — verify the current figure rather than copying an old quotation.
- A target total that doesn't divide cleanly into whole hours, or component figures that don't sum to the stated total. Show the arithmetic and ask; never pick a reading silently.
- A factual assertion inherited from another project's special terms (a contractor's chosen route, a named third party, a site finding). Carry it if instructed, then flag it.
- Adam saying something is missing. Open the app and confirm what is actually absent before editing data.
