# HTML Component Library — Outlook-Safe

Every Noble Architecture email is built from these components. Copy them
verbatim and change the text. Do not invent new styling — consistency across
letters is the whole point of this file.

## Why the markup looks like this

The HTML has to survive being copied out of a browser and pasted into Outlook
web, and then being read in Outlook desktop, which renders with the Word engine.
That imposes hard constraints:

- **Every style is inline.** A `<style>` block is stripped on paste.
- **No CSS classes.** They have nothing to bind to once the block is gone.
- **Tables for layout.** Flexbox and grid are not supported by the Word engine.
- **No external anything** — no web fonts, no images, no scripts, no links to
  CDNs. Everything must render offline, forever.
- **Points, not pixels, for type.** Outlook thinks in points.
- **Explicit margins on every `<p>`.** Margin collapsing is unreliable.

If a component is not in this file and you need one, build it from a table with
inline styles, and add it here afterwards.

## Design tokens

| Token | Value | Used for |
|---|---|---|
| Heading navy | `#172b3a` | Document title, section headings, table headers, label column |
| Body text | `#1a1a1a` | Default body colour |
| Secondary text | `#333333` | Panel body text |
| Muted text | `#555555` | Enclosure descriptions, sign-off contact line |
| Action red | `#c00000` | Numbered asks the reader must act on |
| Accent maroon | `#960000` | Left border on a contact panel |
| Table header fill | `#f2f4f5` | Data table header row |
| Panel fill | `#f7f8f9` | Contact panels, filename blocks |
| Rule / border | `#d8dcdf` | Table borders, sign-off rule |

Font stack: `Calibri,'Segoe UI',Arial,sans-serif`
Body size `11pt`, line-height `1.5`. Tables `10.5pt`. Sign-off contact `10pt`.
Container `max-width:700px`.

## Document shell

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{Short description - site - document type}</title>
</head>
<body style="margin:0; padding:24px; background:#ffffff;">

<div style="max-width:700px; font-family:Calibri,'Segoe UI',Arial,sans-serif; font-size:11pt; line-height:1.5; color:#1a1a1a;">

  <!-- components go here -->

</div>

</body>
</html>
```

## Header

The document title in caps, with a heavy rule beneath. This replaces a postal
letterhead in an email body.

```html
<div style="border-bottom:2px solid #172b3a; padding-bottom:10px; margin-bottom:24px;">
  <div style="font-size:15pt; font-weight:bold; letter-spacing:0.5px; color:#172b3a;">PERMITTED DEVELOPMENT CERTIFICATE</div>
</div>
```

## Recipient block with date

The date sits on the recipient's line, with an ordinal superscript. There is no
separate date line above.

```html
<p style="margin:0 0 22px 0;">
  FAO: Planning Services / Validation Team<br>
  Rushcliffe Borough Council - 18<sup style="font-size:65%; line-height:0;">th</sup> September 2026
</p>
```

Ordinals: `1st`, `2nd`, `3rd`, `4th`…`20th`, `21st`, `22nd`, `23rd`, `24th`…
`31st`. The `line-height:0` stops the superscript opening up the line.

## Salutation and subject

```html
<p style="margin:0 0 16px 0;">Dear Sir or Madam,</p>

<p style="margin:0 0 18px 0; font-weight:bold; color:#172b3a;">
  APPLICATION FOR A LAWFUL DEVELOPMENT CERTIFICATE FOR A PROPOSED USE OR DEVELOPMENT
  &mdash; SECTION 192, TOWN AND COUNTRY PLANNING ACT 1990
</p>
```

Subject line is caps, bold, navy. Use `&mdash;` for the dash, not a hyphen.

## Key details block

A two-column label/value table. Label column fixed at 95px.

```html
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; margin:0 0 24px 0; font-family:Calibri,'Segoe UI',Arial,sans-serif; font-size:11pt;">
  <tr>
    <td style="padding:5px 12px 5px 0; vertical-align:top; font-weight:bold; width:95px; color:#172b3a;">Site</td>
    <td style="padding:5px 0; vertical-align:top;">255 Musters Road, West Bridgford, Nottinghamshire, NG2 7DD</td>
  </tr>
  <tr>
    <td style="padding:5px 12px 5px 0; vertical-align:top; font-weight:bold; color:#172b3a;">Applicant</td>
    <td style="padding:5px 0; vertical-align:top;">Mr A Client</td>
  </tr>
</table>
```

## Section heading and body paragraph

```html
<p style="margin:0 0 10px 0; font-weight:bold; color:#172b3a;">1. Purpose of this submission</p>

<p style="margin:0 0 12px 0;">Body text.</p>
<p style="margin:0 0 24px 0;">Last paragraph of the section takes the 24px margin.</p>
```

Margin rhythm: `10px` under a heading, `12px` between paragraphs, `24px` before
the next section heading.

## Data table

Bordered, with a shaded header row. Use for dimensions, schedules, comparisons.

```html
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; margin:0 0 18px 0; font-family:Calibri,'Segoe UI',Arial,sans-serif; font-size:10.5pt;">
  <tr style="background:#f2f4f5;">
    <td style="padding:7px 10px; border:1px solid #d8dcdf; font-weight:bold; color:#172b3a;">Measurement</td>
    <td style="padding:7px 10px; border:1px solid #d8dcdf; font-weight:bold; color:#172b3a; width:80px;">Proposed</td>
    <td style="padding:7px 10px; border:1px solid #d8dcdf; font-weight:bold; color:#172b3a;">Position against the Class A limits</td>
  </tr>
  <tr>
    <td style="padding:7px 10px; border:1px solid #d8dcdf; vertical-align:top;">Rear projection</td>
    <td style="padding:7px 10px; border:1px solid #d8dcdf; vertical-align:top;">3.150 m</td>
    <td style="padding:7px 10px; border:1px solid #d8dcdf; vertical-align:top;">Below the 4 m limit for a detached dwellinghouse</td>
  </tr>
</table>
```

## Numbered schedule

For enclosures and document lists. Three columns: number, reference, description.

```html
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse; width:100%; margin:0 0 30px 0; font-family:Calibri,'Segoe UI',Arial,sans-serif; font-size:10.5pt;">
  <tr>
    <td style="padding:5px 10px 5px 0; vertical-align:top; width:22px;">1.</td>
    <td style="padding:5px 12px 5px 0; vertical-align:top; width:165px;">PS01_T02_D10 Rev C</td>
    <td style="padding:5px 0; vertical-align:top; color:#555555;">Site, block and location plan &mdash; 1:500 and 1:1250 at A2, dated 18 September 2026</td>
  </tr>
</table>
```

## Action items (red)

For things the recipient must send back. The colour is repeated on every cell —
Outlook does not reliably inherit it from the table.

```html
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin:0 0 14px 0; font-family:Calibri,'Segoe UI',Arial,sans-serif; font-size:11pt; color:#c00000;">
  <tr>
    <td style="padding:4px 10px 4px 0; vertical-align:top; width:34px; color:#c00000;">(a)</td>
    <td style="padding:4px 0; vertical-align:top; color:#c00000;">the application reference number allocated to this submission; and</td>
  </tr>
  <tr>
    <td style="padding:4px 10px 4px 0; vertical-align:top; color:#c00000;">(b)</td>
    <td style="padding:4px 0; vertical-align:top; color:#c00000;">the name, direct telephone number and email address of the officer or team he should call to make payment.</td>
  </tr>
</table>
```

## Contact panel

A shaded panel with a maroon left border. Use when naming the person who takes
over correspondence, or any contact the reader must record.

```html
<div style="margin:0 0 14px 0; padding:14px 16px; background:#f7f8f9; border-left:3px solid #960000;">
  <div style="font-weight:bold; margin-bottom:6px; color:#172b3a;">Mr A Client</div>
  <div style="color:#333333; line-height:1.5;">
    255 Musters Road, West Bridgford, Nottinghamshire, NG2 7DD<br>
    Telephone: +44 7xxx xxxxxx<br>
    Email: client@example.com
  </div>
</div>
```

## Filename block

Monospace, shaded, navy left border. Use when listing actual attachment
filenames. Read the directory first — never retype filenames from memory.

```html
<div style="margin:0 0 14px 0; padding:12px 14px; background:#f7f8f9; border-left:3px solid #172b3a; font-family:Consolas,'Courier New',monospace; font-size:10pt; line-height:1.7; color:#333333;">
  255-Musters-Road_LDC-Application_Signed.pdf<br>
  PS01_T02_D10__SitePlan__A2__RevC__18-Sep-2026__.pdf
</div>
```

Omit this block entirely when the letter is the email body and the attachment
list would include the letter itself.

## Inline emphasis

```html
<b>all further correspondence to the applicant</b>
```

Use `<b>`, not `<strong>`. Bold only — never underline (reads as a broken link),
never italic for emphasis (italic is for the sign-off qualifier only).

## Sign-off

```html
<p style="margin:0 0 20px 0;">I trust the enclosed is in order and sufficient for validation. I look forward to receiving the application reference and payment contact by return.</p>

<p style="margin:0 0 30px 0;">Yours faithfully,</p>

<div style="border-top:1px solid #d8dcdf; padding-top:14px;">
  <div style="font-weight:bold; color:#172b3a;">Adam Noble</div>
  <div style="color:#333333;">Noble Architecture</div>
  <div style="color:#555555; font-size:10pt; margin-top:4px;">
    Adam@Noble-Architecture.com &nbsp;&middot;&nbsp; +44 7707 445405
  </div>
</div>
```

An optional italic qualifier may follow the contact line when the capacity needs
stating:

```html
<div style="color:#777777; font-size:9.5pt; font-style:italic; margin-top:10px;">
  Agent for the applicant, for preparation and submission only.
</div>
```

## Validating before delivery

Run this over the finished file:

```bash
python -c "
from html.parser import HTMLParser
import re,sys
VOID={'br','meta','img','hr','input','link'}
class P(HTMLParser):
    def __init__(s): super().__init__(); s.stack=[]; s.err=[]
    def handle_starttag(s,t,a):
        if t not in VOID: s.stack.append(t)
    def handle_endtag(s,t):
        if not s.stack: s.err.append('extra </%s>'%t); return
        if s.stack[-1]!=t: s.err.append('mismatch %s/%s'%(s.stack[-1],t))
        else: s.stack.pop()
src=open(sys.argv[1],encoding='utf-8').read()
p=P(); p.feed(src)
print('unclosed:', p.stack or 'none', '| errors:', p.err or 'none')
print('style blocks:', src.count('<style'), '| classes:', src.count('class='), '| external:', len(re.findall(r'https?:|src=',src)))
print('section headings:', re.findall(r'>(\d\. [A-Z][a-z][^<]*)<', src))
" <file.html>
```

All four must be true: no unclosed tags, no `<style>` blocks, no `class=`
attributes, no external references. The printed section headings let you confirm
the numbering runs 1, 2, 3… with no gaps.
