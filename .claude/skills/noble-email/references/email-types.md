# Email Type Playbooks

Identify the type first. Each has a mandatory structure. Follow it rather than
inventing one.

---

## 1. LPA submission — application pack

**Trigger:** submitting an LDC, householder or full application to a council.

**Worked example:** `assets/examples/pd-submission/`

**Sources to read before writing:** the signed application form (extract every
field — applicant, agent, site, declaration date, the Section 7 document
schedule, the correspondence note), every drawing title block, the
specification, and the delivery folder listing.

**Structure:**

```
Header:      {APPLICATION TYPE} e.g. PERMITTED DEVELOPMENT CERTIFICATE
Recipient:   FAO Planning Services / Validation Team + council + date
Subject:     Full statutory title of the application, with the section cited
Details:     Site / Applicant / Proposal
1. Purpose of this submission      — statute relied on, and the Class/Part
2. The application form            — what it is, signed by whom, key dimensions table
3. Enclosures                      — numbered schedule matching Section 7 of the form
4. Fee and the reference we require — red (a)/(b) ask
5. Correspondence after submission  — handover, contact panel
Close:       Confidence in validation, restate the ask
```

**Must contain:**
- The statutory basis, cited precisely (section, Act, Order, Schedule, Part, Class).
- A dimensions table showing each figure *against the limit it has to satisfy*.
  Not just the number — the number and why it passes.
- An enclosures schedule that matches the form's own document schedule exactly.
- If the fee is unpaid at submission, say so plainly and state how it will be paid.

**Never:**
- Claim the application will be granted, or characterise the council's decision.
- List the covering letter among its own attachments.
- State a dimension that isn't on a drawing.

---

## 2. Chasing a reference, decision or response

**Trigger:** no reply from a council or third party; a reference number is
needed; a decision is overdue.

**Structure:** short. Four paragraphs at most.

```
1. What was submitted, when, and by what means
2. What has not yet been received
3. The specific ask, as a red numbered item if there is more than one
4. What happens next / a date by which a reply is needed
```

Reference the original email's date and subject so it can be matched to a case
file. Do not re-attach the whole pack unless asked — offer to resend.

Stay neutral. Never imply delay is anyone's fault.

---

## 3. Issuing drawings to a client

**Trigger:** sending a drawing set or revision to the homeowner.

**Structure:**

```
Header:      {PROJECT} - {STAGE} DRAWINGS
1. What is attached          — numbered schedule, plain-English description
2. What has changed          — only if a revision; list changes against the previous rev
3. What I need from you      — decisions, approvals, a deadline
4. What happens next         — next stage, indicative timing
```

Translate every technical term in the same sentence. "The eaves — the point
where the roof meets the wall — sits 50 mm below the existing house."

State clearly whether the drawings are for comment, for approval, or for
construction. Ambiguity here causes real problems downstream.

---

## 4. Issuing information to a contractor or consultant

**Trigger:** sending drawings, a specification or an instruction to a builder,
engineer or building control body.

**Structure:** brief and instructional.

```
1. What is attached, with drawing numbers and revisions
2. The instruction or the change — lead with it
3. What governs — the drawing and revision that takes precedence
4. Anything to confirm back
```

Always state revisions. Always say which drawing supersedes which. Never leave
two live revisions of the same drawing in play without saying which governs.

---

## 5. Handover and close-out

**Trigger:** a fixed appointment ends; correspondence must transfer to the
client or another party.

May be a standalone email, or a section inside another letter — as in the
PD submission example, where the handover is section 5.

**Must contain:**
- The scope of the appointment and the fact it has concluded.
- An explicit instruction on where correspondence now goes.
- A specific, enumerated list of what that covers — validation queries, fee
  matters, site visits, the decision, objections.
- A contact panel with the new contact's full details.
- A request that the recipient's *system* be updated, not just the reader.
- A closing line leaving re-engagement open on the client's instruction.

Wording is in `house-style.md` under *Closing an appointment*.

---

## 6. Quotation or fee correspondence

**Trigger:** issuing a quotation, a stage payment request, or an invoice note.

Fee content, stage structure and terms come from the **`noble-admin`** skill —
that is the authority for anything touching quotations, invoices, project codes
or special terms. Read it first and do not restate fee mechanics from memory.

This skill governs only the covering email: the voice, the structure and the
HTML. Never state a figure that `noble-admin` or an existing project file has
not produced.

---

## When no playbook fits

Build from the closest one and keep the shell, the tokens and the component
library. Then offer to add a new playbook here and a worked example under
`assets/examples/`, with client PII redacted.
