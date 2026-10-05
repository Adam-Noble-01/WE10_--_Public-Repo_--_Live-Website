# Email Type Playbooks

Identify the type first. Each has a mandatory structure. Follow it rather than
inventing one.

In every NA covering email, a house divider separates **every** section from the
next, and the draft `.md` carries the house header and signature blocks, so it looks
like the email it will become (SKILL.md, *The draft looks like the email*).

**The gold standard for every email to a council is RB05** (`assets/examples/pre-app-enquiry/`,
sent 05-Oct-2026): its format, section order, tone, and the rule that the first
correspondence says nothing negative. NP03 (`assets/examples/planning-application/`) is
the **secondary reference**: use it for what is specific to a planning application (the
statutory submission line, payment instructions, the appointment ending at
validation), written the RB05 way.

---

## 1a. Planning application covering email

**Trigger:** submitting a householder or full planning application to a council by email.

**Gold standard:** RB05 (`assets/examples/pre-app-enquiry/`) for format, order and tone. **Secondary reference:** NP03 (`assets/examples/planning-application/`, 31-Mar-2026) for the planning-application sections. Read both READMEs first.
**Template:** `assets/templates/planning-application__template.md`

**Sources to read before writing:** the Design and Access Statement (its summary blocks give the proposal paragraphs; its `DrawingSchedule` gives the schedule), the application form (applicant name as signed, application type), the pack folder in `10__ContentDelivered\`, and the client's contact details from the project admin data.

**Structure:**

```
House header      Planning Application Covering Letter / Subject: CODE | Site - Planning Documents Pack / Date
#### Dear {Council} Planning Team,
[optional] resubmission note, and how the pack is split across emails (1 of 3...)
Opening           two short paragraphs, no bold: the statutory {type} submission for {site} on behalf of
                  {applicant} / what is provided and where
---
The Proposal      two or three short paragraphs from the DAS, positive only (proposal, design, neighbours);
                  a constraints line only if every finding is favourable
---
Downloading The Documents     (only when too big to attach) as RB05
---
Supporting Documentation      DrawingSchedule; N/A in cells that do not apply
---
Fees And Payment  applicant pays direct; council sends instructions, reference, payment link to the applicant;
                  bold: Noble Architecture pays nothing, ask it for nothing
---
Confirmation Of Receipt       (a) received complete, (b) the application reference once validated
---
Agent Role Handover           appointment ends at validation; everything after to the applicant; contact panel
---
TrueVisionHub     the project in 3D
---
Closing lines     thanks; access problems to Adam; everything else to the applicant
House signature
```

**Must contain:**
- A proposal taken from the DAS, positive only. Never a claim the DAS does not make, and nothing negative (SKILL.md rule 9).
- A schedule that agrees with the files being attached (`--pack`).
- The handover with the client's details, so the council's system is updated before validation.

**Never:**
- Link to PlanVision / ProjectVision, or call anything a "Project Portal".
- Claim the application will be granted.
- List the covering email among its own attachments.
- "Please do not hesitate to contact me" (NP03 as sent): say who to contact and why, as RB05's closing lines do.

---

## 1b. Pre-application enquiry (GOLD STANDARD)

**Trigger:** asking a council for pre-application advice.

**Gold standard:** `assets/examples/pre-app-enquiry/` (RB05, Adam's own edit, signed off and sent 05-Oct-2026). Read its README first.
**Template:** `assets/templates/pre-app-enquiry__template.md`

**Sources:** the pre-application statement (TrueVision Statement Writer, `10__StatementDocs\01__PreApp__Statement\`), its `DrawingSchedule`, the filled request form, the pack folder, and the council's own pre-application advice page for the service name and fee. Never quote a fee from memory.

**Structure:**

```
House header      Pre-Application Covering Letter / Subject: CODE | Site - Pre-Application Enquiry / Date
#### Dear {Council} Development Management Team,
Opening           two short paragraphs, no bold: on behalf of the applicants, at the site address, under the
                  council's service / what is provided and where to find it
---
The Proposal      TWO short paragraphs: the house, then the grounds. Positive only.
---
Downloading The Documents     (only when too big to attach) WeTransfer + Google Drive, button AND plain URL each
---
Pre-Application Pack          DrawingSchedule; N/A in cells that do not apply
---
Fees And Payment  applicant pays all; council contacts applicant; bold: Noble Architecture pays nothing, ask it for nothing
---
Confirmation Of Receipt       (a) received / downloaded and complete, (b) reference; the only reply required
---
Agent Role Handover           role ends at sending + receipt; applicant is the contact; panel; record on system
---
TrueVisionHub     the project in 3D
---
On-Site Meeting   (when wanted) dates, arranged with the applicant
---
Closing lines     thanks; access problems to Adam; everything else to the applicant
House signature
```

**Must contain:**
- A proposal that only presents. **Say nothing negative in the first correspondence.**
- The fee position stated so plainly that the practice is never invoiced.
- The handover to the applicant, unless Adam says he stays the contact.

**Never:**
- A constraints paragraph that lists anything against the scheme (flood risk, TPOs, heritage records, priority habitat, countryside policy), a floorspace or size comparison, woodland or tree removals, or policy tests. All of that is in the statement, in context.
- The list of questions on which advice is sought. The statement's own section holds it.
- Vivid or loaded words where plain ones do: "earmarked for removal" not "removed", "swimming pool" not "infinity edge pool".

---

## 1c. LDC / permitted development submission

**Trigger:** submitting an LDC (s.192) or prior approval pack to a council.

**Worked example:** `assets/examples/pd-submission/` (a formal letter in the `html-components.md` style). For a new one, use the 1a template and shell (header, hub, schedule, signature), and carry over the content below.

## 1. LPA submission — application pack (formal letter, PS02 style)

**Trigger:** submitting an LDC, householder or full application to a council as a formal letter.

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
