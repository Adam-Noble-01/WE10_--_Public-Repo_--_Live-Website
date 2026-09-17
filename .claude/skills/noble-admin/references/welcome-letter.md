# Welcome Letter (Cover Letter)

**There is no welcome letter file.** The cover letter is rendered live by `DocumentSystem__CoverLetterRenderer__.js` from fields in `ProjectAdmin__ProjectConfig__.json`, with the client's name and address pulled from encrypted R2 at render time.

"Write a welcome letter" therefore means: **write `projectBriefConcise` and `projectBriefFull`.**

## What the renderer assembles

| Section | Source |
|---|---|
| Header | `projectName`, `projectCode`, company details, quotation date |
| Greeting | Client name + address — decrypted from R2 at runtime |
| Body | `projectConfig.projectBriefConcise` (falls back to legacy `projectDescription`) |
| Detailed brief | `projectConfig.projectBriefFull`, rendered as markdown |
| Navigation guide | Hard-coded — how to use the portal, highlights special terms |
| Signature | Company details + `NaBrandGraphic__EmailSignature__.png` |

It's the default landing view after PIN login (`CoverLetterSystem.showAsDefaultView: true`).

## The three fields

### `projectBriefConcise` — client-facing, one sentence

Plain, factual, scope-defining. Reused as the quotation's `projectDescription`, so write it to work in both places.

> "Single Storey Extension to rear of Existing House, First Floor Addition on top of the Existing Garage and Utility Room, upgrades to the Existing Greenhouse."

Capitalised element names are house style. Lead with the largest element.

### `projectBriefFull` — client-facing, markdown

The substantial one. EB03's structure, which works well:

```markdown
## Project Overview And Goals
The primary aim, intended use, overall design intent.

## Proposed Ground Floor Alterations
Room by room. Areas in m². Specific features.

## Proposed First Floor Alterations
As above.

## Design Style And Key Features
Architectural language, materials, notable products.

## Key Constraints
Planning route and why. Anything discussed on the visit that shapes the approach.
```

Voice: first person for what was discussed ("During my site visit on 11ᵗʰ April 2026 we went through why…"), third person for the practice elsewhere. Specific over general — "around 44 to 50 square metres", "three sets of three panel bi folding doors", "three Korniche style roof lanterns". Name the constraint and the reasoning: EB03 explains the wrap-around trap, why permitted development fails, and why planning permission is actually the better route.

Adapt headings to the project — a loft conversion doesn't need a ground floor section.

**Everything here is client-facing.** No fee discussion, no internal reservations, nothing you wouldn't say to their face.

### `specialNotes` — internal only, never rendered

Short bullets for Adam:

```
First Visit 11-Apr-2026
- Approved a cost around 3.6kish
```

Budget indications, client temperament, chasers, things to watch. Never client-facing.

## Writing from a WhatsApp dump

1. Separate scope facts (→ brief) from commercial facts (→ `specialNotes` or the quotation) from PII (→ staged privately).
2. Build the concise line from the largest elements only.
3. Build the full brief section by section, using only what's in the input.
4. Where the client was vague — "maybe a bigger kitchen" — either write it as the conditional it is ("a potential reading nook", "if a pool is installed at a later date") or put it on the gap list. Don't harden a maybe into a commitment.
5. Flag anything you couldn't place.

## Handing back

Both brief fields live in `ProjectAdmin__ProjectConfig__.json`. Adam reviews them in `Editor__ProjectConfig__.html` — the two brief textareas near the top, internal notes near the bottom. Client name and address come from R2, so the greeting won't render until the PII file has been loaded and saved.
