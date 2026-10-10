---
name: noble-email
description: Write and format emails and covering letters as Noble Architecture - drafted as Markdown in the job folder, then built by script into Outlook-safe HTML carrying the TrueVision 3D Project Hub and the drawing schedule. Use whenever asked to write, draft, format or clean up an email or covering letter for Noble Architecture; to submit a planning application, a pre-application enquiry, an LDC or permitted development pack to a local planning authority or building control body; to issue drawings to a client or contractor; to chase a fee, a reference number, a decision or a validation query; or to hand a project over and close out an appointment. Also triggers on "write an NA email", "covering letter", "covering email", "planning app email", "pre-app email", "email the council", "email the client", "make this paste into Outlook", "build the email".
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
   Design and Access Statement, the specification, the project JSON — or from
   Adam. If it isn't there, it stays a `[TO CONFIRM: …]` and you **ask**. The
   build refuses to write HTML while one is left.

2. **Read the source before you write the letter.** If the email accompanies a
   form, open the form and extract the fields. If it accompanies drawings, read
   the title blocks for number, revision, scale, sheet size and date. Then make
   the letter agree with them, exactly. See *Cross-checking* below.

3. **The Markdown is the master; the HTML is built from it.** Write and edit the
   `.md` in the job's correspondence folder, where Adam can edit it too (Typora
   or any editor). When it is ready, `scripts/build_email.py` builds the `.html`
   beside it. Never hand-edit the HTML; change the `.md` and rebuild. The `.md`
   is also the record copy.

4. **Never hard-wrap.** Each paragraph is one continuous line in the `.md`.
   A single line break is kept as a line break (the client details block
   relies on it), so a pre-wrapped paragraph arrives in Outlook broken
   mid-sentence. The build warns when it sees one.

5. **Never tell Adam to drag the HTML file into Outlook.** Dragging attaches it
   as a file; it does not become the body. The only workflow that works is:
   open the HTML in a browser, `Ctrl+A`, `Ctrl+C`, paste into the compose window.
   Say this every time you deliver an HTML letter.

6. **Client PII never enters the skills repo.** If you file an example, a
   template or a reference copy anywhere in this skill, redact the client's
   name, personal email, personal telephone and any secondary contact. Site
   addresses that already appear on issued drawings are acceptable.

7. **British English, Adam's voice.** First person: "I", "my", never "we" or
   "our team". "Organise", "recognise", "programme", "enquiry". No filler and no
   buzzwords; every word must count. Dates in prose `18 September 2026`. Money
   `£1,225`. Never "off of", never "reach out".

8. **PlanVision / ProjectVision is retired.** TrueVision is the single platform
   for the 3D model, the drawings and the documents. Never link to
   `05__ProjectVision__CoreAppCode` or call anything a "Project Portal". The
   project's way in is the `TrueVisionHub` section. The build errors on any
   mention of the old platform.

9. **Say nothing negative in the first correspondence.** The covering email
   presents; the statement argues. No size comparisons, no constraints that count
   against the scheme (flood risk, TPOs, heritage records, priority habitat,
   countryside policy), no tree removals, no policy tests, no list of the questions
   put to the council. Describe the proposal in two short, positive paragraphs in
   plain words ("earmarked for removal"). Adam, 05-Oct-2026: "There's literally no
   point in saying anything bad in that email." See `references/house-style.md`.

10. **`N/A` in a table cell that does not apply.** Never an em dash or a blank.

## Paths

| What | Where |
|---|---|
| This skill | `D:\08__Cloud__Repo__AgentSkills__Private\21-na-admin-system-skills\noble-email\` |
| Job folders (2026) | `D:\02__NobleArchitecture__MasterLibrary\02__Projects\NA_Projects__2026\{CODE}__{Site}__{Client}\` |
| Where an email lives | the job's `06__Correspodance\` folder (the folder's own spelling) |
| Attachments to check against | the job's `10__ContentDelivered\{NN}__{Pack}__Rev-X__{date}\` folder |
| Website / TrueVision repo | `D:\WE10_--_Public-Repo_--_Live-Website` (TrueVision at `na-apps\30__TrueVision__CoreAppCode`) |
| Project statements (DAS, pre-app) | `<website>\na-project-portal\{YY}-Projects\{CODE}__{Name}\30__TrueVision__AppContent\10__StatementDocs\` |
| Builder | `scripts/build_email.py` |
| Templates | `assets/templates/` |
| Worked examples / gold standards | `assets/examples/` |
| House style | `references/house-style.md` |
| Email type playbooks | `references/email-types.md` |
| Formal-letter HTML components (LDC style) | `references/html-components.md` |

## Every email follows this loop

**1. Identify the type.** Route via `references/email-types.md`. The type decides
the template, the section order and the mandatory content. Do not invent a new
structure when a playbook exists.

**2. Gather the facts.** Open the sources: the application form, the Design and
Access Statement (or pre-application statement), the drawing title blocks, the
delivery folder listing. Build a short internal list of every fact you will state.

**3. Gap-check and ask once.** Present what's missing as one numbered list with
your best-guess default where you have one, so Adam can reply "1 yes, 2 is
Rushcliffe, 3 leave out". Never ask for something a file already told you.

**4. Write the `.md`.** Copy the type's template from `assets/templates/` into the
job's `06__Correspodance\` folder under the filename convention below, and fill it.
Read the gold standard for the type first; it sets the voice and the depth. Keep the
template's house header, signature and dividers (see *The draft looks like the email*).
After the salutation and the opening paragraph, the proposal comes first; practical
matters (how the documents are sent, fees, contacts) come after it.

**5. Build and cross-check.**

```bash
python scripts/build_email.py "<job>\06__Correspodance\<email>.md" --pack "<job>\10__ContentDelivered\<pack folder>"
```

The build lints the Markdown (placeholders, retired platform, filler words,
"we", hard wraps), checks every schedule row against the files in `--pack`
(document number present, revision matches the filename), confirms the
project's TrueVision link resolves, and writes the HTML only when there are no
errors. Fix every error. Read every warning, then fix it or tell Adam why it stands.

**6. Look at it.** Open the HTML in the browser pane and check the header, the
hub, the schedule and the signature render.

**7. Deliver.** State the two filenames, report anything you could not verify,
and give the paste workflow.

## The draft looks like the email

Adam proofreads the `.md` in Typora and in his TextToReader app (Marked.js), so the
draft must look like the email that will be sent, **even in draft form**: the logo,
title, subject and date at the top, a divider between every section, the schedule as
a real table, and the signature at the bottom. Copy all of this from the template.
Never hand him a draft that shows `Title:` / `Sign-off:` field lines or raw table
pipes (05-Oct-2026, RB05: "a really bad job at inserting the correct header ... and
the correct footer").

| Block | How it is written in the `.md` | What the build does |
|---|---|---|
| **Header** | The NP03 house header as raw HTML (logo, `<h1>` title, `Subject:` line, `Date:` line, 2 mm divider), wrapped in `<!-- NA:EmailHeader -->` … `<!-- /NA:EmailHeader -->`. Edit only the title, subject and date text. | Reads the title, subject and date and draws its Outlook-safe header in place of the block. |
| **Dividers** | The house `Horizontal Page Divider Line` block (5 mm) between **every** section. | Turns each one into a thin rule. |
| **Signature** | The NP03 house signature block (sign-off, handwritten signature, email signature), wrapped in `<!-- NA:Signature -->` … `<!-- /NA:Signature -->`. | Draws its Outlook-safe signature in place of the block. |

The comment wrappers are invisible in every viewer. The house blocks use mm and
flex, which Outlook desktop ignores, which is why the build swaps them rather than
passing them through. The older `EmailHeader` / `Signature` marker form
(`Title:` / `Subject:` / `Date:` lines) still builds, but never write it in a new email.

## Standard sections (marker lines in the Markdown)

The hub and the schedule reuse the TrueVision Statement Writer's marker grammar, so
a schedule copied from a statement works unchanged.

| Section | Marker `data-na-standard-section` | What the `.md` holds |
|---|---|---|
| TrueVision 3D Project Hub | `TrueVisionHub` | The marker, with one line of text inside it saying the hub is drawn here (the draft shows it; the build ignores it). `data-na-std-name="7 Ashness Close"` names the project; `data-na-std-statement="the pre-application statement"` when it is not a DAS; `data-na-std-code` only if the filename does not start with the code; `data-na-qr-src="https://…png"` only once a hosted QR image exists. |
| Drawing Schedule | `DrawingSchedule` | A `###` heading, paragraph lines and a pipe table, as in the statement. **A blank line after the opening tag and before `</div>`**, or Typora and Marked show the table as raw pipes. This is the opposite of the statement rule (no blank line inside a marker), which exists only so TrueVision can draw the section itself. Copy it from the DAS, or `data-na-from="<relative path to the statement .md>"` with an empty body. |

**The hub's words are TrueVision's.** The builder reads them live from
`Na__LayoutEditor__Statement__Standard__Config__.json`, so a sentence improved
there reaches every email. Only two statement-only phrases and the no-QR access
words are swapped, in `assets/truevision-hub__email-overrides.json`. If
TrueVision rewords one of those phrases, the build stops with an error naming
it. Update the override; never patch the words in the HTML. If the TrueVision
repo is not on disk, the build falls back to `assets/truevision-hub__config-snapshot.json`
and warns.

**The link** is `https://www.noble-architecture.com/q/?{CODE}`, the same
resolver the QR codes on the drawings use. The build errors if the code is not
in `q/index.json`, because the link would open nothing. A new project is
missing until the index is rebuilt; `na_new_project.py` does not add it. Fix:

```bash
python "D:/WE10_--_Public-Repo_--_Live-Website/na-apps/05__ProjectVision__CoreAppCode/ProjectVision__BuildScript__.py" --qr-index-only
```

Then commit and push `q/index.json` with Adam's say-so, and confirm the Pages
deploy finished before sending. Every other website repo script, and who may
run it, is in noble-admin's `references/website-scripts.md`.

**No QR code in emails yet.** Outlook strips the inline SVG the statement draws.
Without a hosted PNG the hub drops the "scan" words and keeps the button, as
TrueVision itself does when there is no code.

## Filename convention

Adam's document numbering, the same as the drawings:

```
{CODE}_{Phase}_N{nn}__{Subject}__{Qualifier}__{DD-Mon-YYYY}__.md      ← master, edited
{CODE}_{Phase}_N{nn}__{Subject}__{Qualifier}__{DD-Mon-YYYY}__.html    ← built, pasted
```

Example: `NP03_T02_N30__PlanningAppEmail__Scheme-01__31-Mar-2026__.md`

Phase: `T01` concept/pre-app, `T02` planning, `T03` building regulations, `T04`
site. Take the next free `N` number from the job's `06__Correspodance\` folder,
and confirm it with Adam if the folder is ambiguous.

## Email subject lines

`{CODE} | {Site or project short name} - {What this is}`

- `NP03 | 7 Ashness Close - Planning Documents Pack`
- `RB05 | West Beacon Farm - Pre-Application Enquiry`
- `EB03 | The Firs - Building Regulations Drawings Issue`

Keep it under about 60 characters. No "RE:" unless replying. No exclamation marks.

## Cross-checking (mandatory before delivery)

The build does the mechanical part; you do the rest.

- **Dimensions.** These must match the drawings and, where one exists, the
  application form. Watch the unit convention: drawings state `3,150 mm`, letters
  and forms state `3.150 m`.
- **Drawing references.** The number, revision, scale, sheet size and date must
  match the title block on the actual PDF, not the filename. `--pack` checks the
  filename. You check the title block for anything the letter states beyond it.
- **The case paragraphs.** Every claim must be one the DAS makes. Copy the
  substance from its summary blocks, never from memory.
- **Names and contact details.** Copy these from the signed form, character for
  character, including the spelling of the recipient authority.
- **Self-reference.** The email body must not list itself in its own
  attachment list.

## What good looks like

| Example | Use it for |
|---|---|
| `assets/examples/pre-app-enquiry/` | **THE GOLD STANDARD for every NA email to a council (RB05, Adam's own edit, signed off and sent 05-Oct-2026: "This was excellent in the end").** Pre-application enquiry with the pack on WeTransfer and Google Drive: the house header, a divider between every section, a two-paragraph positive proposal and nothing negative, download buttons with plain URLs, the pack table with `N/A`, applicant pays every fee and the practice none, receipt confirmation, handover to the applicant, the hub, an on-site meeting request, closing lines, the house signature. Its README lists exactly what Adam cut from the first draft and why. Follow its format, order and tone whatever the email type. |
| `assets/examples/planning-application/` | **Secondary reference (NP03, the original Adam supplied, 31-Mar-2026).** Use it for what is specific to a planning application: the statutory submission line, payment instructions, the agent role ending at validation. Where it differs from RB05 (adjective-heavy case paragraphs, bold address, "do not hesitate", the hub before the schedule), RB05 wins. As-sent and rebuilt copies. |
| `assets/examples/pd-submission/` | LDC / permitted development submission written as a formal letter (the older `html-components.md` style): compliance table against the Class limits, red bounded ask, handover. Its section content still applies; build new ones from the planning application template plus that content. |

Read the RB05 README before writing any email to a council, and the NP03 README as well for a planning application.

When Adam signs off a letter with little or no editing, and its type is not yet
covered, **offer to file it as a new worked example** under
`assets/examples/{type}/` with the client details redacted and a README like the
planning application one: structure, what changed, open points.

## Things that have gone wrong before

- **Hard-wrapped plain text** arrived in Outlook broken mid-sentence.
- **A covering letter listed itself** among its own email attachments.
- **A filename date disagreed with the title-block date** (17-Sep vs 18-Sep) and
  had to be explained in the letter.
- **Fixed-width indent columns** collapsed in a proportional font. Use tables.
- **The NP03 email's attachment list disagreed with the pack folder** (it listed
  Rev B drawings; the 31-Mar folder held Rev C, and the DAS under a different
  number). `--pack` now catches this. Run it every time.
- **A retired platform link** (ProjectVision portal) was the email's main call to
  action. The build now refuses it.
- **A draft with marker-only header and footer** (RB05, 05-Oct-2026) showed Adam
  `Title: … Subject: … Date: …` run together on one line, `Sign-off: Warm Regards,`
  as text, no dividers, and the schedule as raw pipes, because Marked and Typora do
  not parse Markdown inside a `<div>` block. The draft must carry the house header,
  dividers and signature, and the schedule marker needs its inner blank lines.
- **The same draft volunteered every difficulty in the statement** (the floorspace
  increase, flood risk, TPOs, the heritage record, woodland clearance) and listed all
  seven questions for the council. Adam cut the lot: "you left me open with loads of
  cans of worms". Rule 9 now forbids it.
