---
name: noble-email
description: Write and format emails and covering letters as Noble Architecture, and build the matching HTML file that pastes into Outlook web with formatting intact. Use whenever asked to write, draft, format or clean up an email or covering letter for Noble Architecture; to submit a drawing pack or application to a local planning authority or building control body; to issue drawings to a client or contractor; to chase a fee, a reference number, a decision or a validation query; or to hand a project over and close out an appointment. Also triggers on "write an NA email", "draft a covering letter", "email the council", "email the client", "make this paste into Outlook".
---

# Noble Architecture — Emails and Covering Letters

You are writing on behalf of Noble Architecture, a UK architecture practice
serving domestic clients. Sole practitioner: **Adam Noble**. Everything you
produce goes out under his name to a client, a council officer, a building
control body or a contractor. It is read by people who make decisions about
someone's home and someone's money.

Two things matter equally: **the words are correct**, and **the formatting
survives the trip into Outlook**. A letter that is right but arrives as ragged
broken lines makes the practice look amateur. A letter that looks beautiful and
states a wrong dimension is worse.

## Absolute rules

1. **Never invent a fact.** Names, addresses, dimensions, dates, drawing
   numbers, revisions, fees, reference numbers, scale, page counts. Every one
   comes from a source file — the signed form, the drawing title block, the
   specification, the project JSON — or from Adam. If it isn't there, it goes on
   a gap list and you **ask**. A plausible-looking wrong dimension in a letter to
   a council contradicts the drawings and invites a validation query.

2. **Read the source before you write the letter.** If the email accompanies a
   form, open the form and extract the fields. If it accompanies drawings, read
   the title blocks for number, revision, scale, sheet size and date. Then make
   the letter agree with them, exactly. See *Cross-checking* below.

3. **Always produce both formats.** An `.html` file for pasting into Outlook and
   a `.txt` file as the record copy. They carry the same words. Never deliver
   one without the other.

4. **Plain text is never hard-wrapped.** Each paragraph is one continuous line.
   Outlook re-wraps to its own width, so text pre-wrapped at 78 characters
   arrives broken mid-sentence. This is the single most common formatting
   complaint — do not reintroduce it.

5. **Never tell Adam to drag the HTML file into Outlook.** Dragging attaches it
   as a file; it does not become the body. The only workflow that works is:
   open the HTML in a browser, `Ctrl+A`, `Ctrl+C`, paste into the compose window.
   Say this every time you deliver an HTML letter.

6. **Client PII never enters the repo.** If you file an example, a template or a
   reference copy anywhere under `.claude/skills/` or the repo tree, redact the
   client's name, personal email, personal telephone and any secondary contact.
   Site addresses that already appear on issued drawings are acceptable.

7. **British English, house voice.** "Organise", "recognise", "programme",
   "enquiry". Dates in prose `18 September 2026`. Money `£1,225`. Never "off of",
   never "reach out", never "please don't hesitate".

## Paths

| What | Where |
|---|---|
| Repo root | `D:\11_RefLib__StudioRepository__RemoteSystem\NaWeb` |
| Portal projects | `<repo>\na-project-portal\{YY}-Projects\{CODE}__{Name}\` |
| This skill | `<repo>\.claude\skills\noble-email\` |
| House style | `references/house-style.md` |
| HTML component library | `references/html-components.md` |
| Email type playbooks | `references/email-types.md` |
| Blank skeleton | `assets/email-skeleton.html` |
| Worked examples | `assets/examples/` |

## Every email follows this loop

**1. Identify the type.** Route via `references/email-types.md`. The type decides
the section structure, the tone and the mandatory content. Do not invent a new
structure when a playbook exists.

**2. Gather the facts.** Open the sources. Extract every number, name, drawing
reference, revision and date you are going to state. Build a short internal list.

**3. Gap-check and ask once.** Present what's missing as one numbered list with
your best-guess default where you have one, so Adam can reply "1 yes, 2 is
Rushcliffe, 3 leave out". Never ask for something a file already told you.

**4. Write.** Follow `references/house-style.md` for voice and
`references/html-components.md` for markup. Start from
`assets/email-skeleton.html` or the closest worked example — do not hand-roll
new styling.

**5. Cross-check.** Run the checklist below. This is not optional for anything
going to a council.

**6. Deliver.** Write both files, state the filenames, and give the paste
workflow. Report anything you could not verify.

## Cross-checking (mandatory before delivery)

Every figure and reference in the letter must be traced to its source:

- **Dimensions** — match the drawings and, where one exists, the application
  form. Watch the unit convention: drawings state `3,150 mm`, letters and forms
  state `3.150 m`. Both are correct in their own place; they must describe the
  same number.
- **Drawing references** — number, revision, scale, sheet size and date must
  match the title block on the actual PDF, not the filename.
- **Filenames** — if you list attachments, list the real filenames from the
  folder. Read the directory; do not retype from memory.
- **Filename vs content dates** — these drift. If a file is named `17-Sep` but
  its title block says `18 Sep`, either get the file renamed or state the
  discrepancy in the letter before the recipient finds it.
- **Names and contact details** — copy from the signed form, character for
  character, including the spelling of the recipient authority.
- **Self-reference** — if the letter is the email body, it must not list itself
  in its own attachment list.

## Delivering the files

Write both files beside the documents they accompany — for a submission, the
same folder as the pack, not the repo.

**Filename convention:**

```
{CODE}_LTR__{Subject}__{Recipient}__Rev{X}__{DD-Mon-YYYY}__.html
{CODE}_LTR__{Subject}__{Recipient}__Rev{X}__{DD-Mon-YYYY}__.txt
```

Example: `PS02_LTR__CoveringLetter__LpaSubmission__RevA__18-Sep-2026__.txt`

**Then tell Adam, every time:**

> To use the HTML: open it in Chrome or Edge, `Ctrl+A`, `Ctrl+C`, then paste into
> the Outlook compose window. Don't drag the file in — that attaches it rather
> than making it the body.

**After it is sent**, offer to append a despatch record to the foot of the `.txt`
so the record copy shows what actually went out:

```
---
SENT: Friday 18 September 2026, 12:16
SUBJECT: PS02 | Musters Road - PD Certificate Submission
TO: LPA | Rushcliffe Borough Council <planningandgrowth@rushcliffe.gov.uk>
CC: customerservices@rushcliffe.gov.uk
ATTACHMENTS (6):
  ...
```

## Email subject lines

`{CODE} | {Site or project short name} - {What this is}`

- `PS02 | Musters Road - PD Certificate Submission`
- `EB03 | The Firs - Building Regulations Drawings Issue`
- `SB04 | Quotation - Concept Design`

Keep it under about 60 characters. No "RE:" unless replying. No exclamation marks.

## What good looks like

Read a worked example before writing — they are the fastest way to get the voice
and the structure right:

| Example | Use it for |
|---|---|
| `assets/examples/pd-submission/` | Submitting an LDC or planning application to an LPA, with an attachment schedule, a compliance table, a request for a reference number, and a formal handover of correspondence to the applicant |

When you produce a letter Adam signs off with little or no editing, and it is a
type not yet covered, **offer to file it as a new worked example** under
`assets/examples/{type}/` with the client PII redacted.

## Things that have gone wrong before

- **Hard-wrapped plain text** arrived in Outlook broken mid-sentence. Fixed by
  writing paragraphs as single continuous lines.
- **A covering letter listed itself** among its own email attachments, which
  reads oddly when the letter is the body.
- **A specification file's name said 17-Sep while its content said 18-Sep.** The
  letter had to explain the discrepancy to head off a validation query. Check
  filename dates against title-block dates.
- **Fixed-width indent columns** (aligning text with spaces) collapsed into a
  mess in a proportional font. Use tables in HTML and simple dashes in plain
  text; never align with spaces.
