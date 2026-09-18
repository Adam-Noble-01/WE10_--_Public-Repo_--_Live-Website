# Worked Example — LDC Submission Covering Letter

**Project:** PS02 Musters Road — Official PD Pack
**Sent:** 18 September 2026 to Rushcliffe Borough Council
**Files:** `EXAMPLE__LdcSubmission__CoveringLetter.html` / `.txt`

Client name, personal email and telephone are redacted. The site address is
retained because it already appears on the issued drawings. Council email
addresses are genericised.

## Use this example when

Submitting a Lawful Development Certificate or a planning application to a local
planning authority by email, where the pack comprises a signed form plus
drawings plus a specification, and where the appointment ends at submission.

It is also the reference for three patterns that recur elsewhere:

- a **compliance table** — each dimension set against the limit it must satisfy
- a **bounded ask** — a red numbered request with the scope of the reply stated
- a **handover** — formal transfer of correspondence to the client

## What the letter does, section by section

**Header.** Document title only — `PERMITTED DEVELOPMENT CERTIFICATE` — with a
heavy navy rule. No postal letterhead: this is an email body, so the address
lives in the sign-off.

**Recipient block.** FAO line, council, and the date on the council's own line
with an ordinal superscript. There is deliberately no separate date line.

**Subject.** The full statutory title in caps and bold, citing the section and
the Act. An officer can classify the application from this line alone.

**1. Purpose.** States the statute relied on (s.192 TCPA 1990) and the basis
(Schedule 2, Part 1, Class A of the GPDO 2015). Two short paragraphs.

**2. The application form.** Identifies the form version, who signed it and when,
then the compliance table. The table is the heart of the letter: four
dimensions, each with the limit it has to satisfy, so a validating officer can
check the whole PD case in about fifteen seconds. Closes by pointing at the
specification notes that show how each height was measured, with the guidance
cited.

**3. Enclosures.** A numbered schedule matching the document schedule at Section
7 of the form. Reference, then description with scale, sheet size and date.

**4. Fee and the reference we require.** The fee was unpaid at submission, so the
letter says so and explains how it will be paid. The ask is red, numbered `(a)`
and `(b)`, and the scope of the reply is bounded explicitly — one reply, then
correspondence moves to the client.

**5. Correspondence after submission.** The handover. Scope of appointment,
explicit instruction, enumerated categories, contact panel, a request to update
the council's *system*, and a closing line leaving re-engagement open.

## Decisions worth copying

- **The compliance table earns its place.** A prose paragraph listing four
  dimensions gets skimmed. A table with a "position against the limits" column
  gets read.
- **The ask is coloured.** Red `(a)`/`(b)` survives a skim in a way that a
  sentence does not.
- **The reply is bounded.** "This single reply is all that I require, and I would
  ask that it not be treated as an invitation to continue corresponding with me
  thereafter." Firm without being rude.
- **The handover is belt-and-braces.** It is stated at Section 8 of the form
  *and* in the letter, so it is on the council's file twice.
- **The letter does not list itself.** An earlier draft included the covering
  letter in its own attachment list, which reads oddly when the letter is the
  body. It was removed.

## Traps this example was corrected for

1. **Hard-wrapped plain text.** The first `.txt` was wrapped at 78 characters and
   arrived in Outlook broken mid-sentence. Paragraphs are now single continuous
   lines.
2. **Fixed-width indent columns.** Aligning with spaces collapsed in Outlook's
   proportional font. Tables in HTML, simple dashes in plain text.
3. **A filename/content date mismatch.** The specification file was named
   `17-Sep` while its title block said `18 Sep`. The sent version dropped the
   attachment-filename section; if you keep such a section, reconcile the dates
   or explain the discrepancy before the recipient finds it.
4. **A dangling cross-reference.** A "the form records the following:" lead-in
   survived after the list beneath it was cut, so it reads as though something is
   missing. **If you reuse this letter, either restore a list under that line or
   delete the line.** When you cut a section, re-read every cross-reference.

## Related

- Structure: `references/email-types.md` → *1. LPA submission*
- Voice: `references/house-style.md`
- Markup: `references/html-components.md`
- PD compliance itself: the `expert-permitted-development-check` skill. This
  skill writes the letter; it does not decide whether a scheme is lawful.
