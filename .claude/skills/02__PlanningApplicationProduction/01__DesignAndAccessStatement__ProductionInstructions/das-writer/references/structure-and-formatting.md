# Structure & Formatting — Exact Markup Conventions

The statement master file is Typora-flavoured Markdown rendered through the practice's own pipeline to a continuous single-page A4-width PDF. The inline HTML blocks below are load-bearing — reproduce them character-for-character. `assets/skeleton--das-template.md` contains all of them pre-assembled.

## 1. Document anatomy

Canonical order. Bespoke sections (see §6) insert where marked; numbering is always sequential with no gaps.

1. Header block (logo, title, applicant details, revision)
2. `1.0 | Introduction` — with themed subsections and a closing bridge paragraph
3. `2.0 | Site Context And Assessment`
4. `3.0 | Site Constraints` — with constraint map figures
5. `4.0 | Design Strategy` — usage, space required, scale and massing
6. `5.0 | Appearance And Materials` — including the materials comparison table and existing/proposed imagery
7. `6.0 | Protection To Neighbours Privacy` — with sightline figures
8. *Bespoke justification section(s)* — one per contentious issue (e.g. `7.0 | Roof Replacement Justification`)
9. `N.0 | Landscaping Garden & Vegetation`
10. `N.0 | Site Access` — vehicular/parking, inclusive access
11. `N.0 | Planning Policy Compliance` — woven-citation summary plus compliance table
12. `N.0 | Conclusion`
13. End-of-statement marker
14. `## Supplementary Drawing Notes` (§8)
15. Footer copyright block

A major divider block (§3) sits between every numbered section.

## 2. Header block

```markdown
<img src="https://www.noble-architecture.com/assets/NA03_-_LIBR_-_NA-Site_-_Core-Brand-Image-Assets/NA03_01_-_PNG_-_NA_Company_Logo_-_w2048_x_h500px.png" style="width:75mm; margin-left: -3mm; " />

## Design and Access Statement



##### Applicant: 

{{Applicant full name with title}}


##### Site Address:

{{Line 1}}
{{Town}}
{{City}}
{{Postcode}}

##### Prepared By:

Mr Adam Noble of Noble Architecture on behalf of {{applicant surname with title}}


##### **Document Version**

Revision {{A}}   *-  {{30ᵗʰ March 2026}}*
```

Date format: superscript ordinal (ᵗʰ ˢᵗ ⁿᵈ ʳᵈ), month name, full year.

## 3. Divider blocks

**Major divider** — between numbered sections (copy verbatim):

```html
<div style=" /* | - - - - - - - - - - - -->|  Horizontal Page Divider Line   |<-- - - - - - - - - - - - - - - - -|  */ 
    text-align           :     center;    
    padding-top          :    05.00mm;    /*  <--- Space Above The Divider Line  */
    padding-bottom       :    05.00mm;    /*  <--- Space Below The Divider Line  */
    margin-top           :    00.00mm;    
    margin-bottom        :    00.00mm;    
    ">                                   
    <div style="                         
        width            :       100%;    
        border-style     :      solid;    
        border-width     :     0.01pt;    
        border-color     :    #ebebeb;    
        ">                               
    </div>                                
</div>  
```

**Light sub-divider** — within a section, before figure groups or between drawing-note clusters:

```html
<div style="
    text-align      : center;
    padding-top     : 04.00mm;
    padding-bottom  : 01.00mm;
    margin-top      : 00.00mm;
    margin-bottom   : 00.00mm;
">
    <div style="
        width            : 92%;
        margin           : 0 auto;
        border-top       : 0.25px solid #f3f3f3;
        height           : 0;
    "></div>
</div>
```

(In the drawing notes section the light divider is used with `padding-bottom : 04.00mm`.)

## 4. Heading grammar

| Element | Markup | Example |
| :--- | :--- | :--- |
| Main section | `### N.0 \|  Title` | `### 4.0 \|  Design Strategy` |
| Subsection | `#### N.N \|  Title` | `#### 4.1 \|  Usage Of The Proposal` |
| Introduction theme heads | `#### Title` (unnumbered) | `#### Project Drivers And Accommodation Needs` |
| Drawing note | `##### CODE \| Title` | `##### NB01 \|  Front Facing Dormer Windows` |
| Notes elevation group | `### Compass Elevation` | `### North Elevation` |

One space before the pipe, two after. Every Word Capitalised including short words (And, For, To, The).

**Known wrinkles in the exemplar — do not replicate.** The gold standard has minor drift accumulated over its production: section 1.0 is tagged H5 while 2.0–10.0 are H3; early subsections use `N.N - Title` while later ones use `N.N |  Title`; 5.3 is tagged H3 despite being a subsection; figures 3.1/3.2 have swapped captions; a stray double full stop. This guide is the normalised standard. Match the exemplar's voice and blocks, not its drift.

## 5. Figures

**Image embed** (always from `03__FinalImages`):

```html
<img src="./01__DaStatement__Images/03__FinalImages/{{NN__Subject__Descriptor__.png}}" style="zoom: 30%; border: 10px solid #555041; box-shadow: 0 2px 10px rgba(0,0,0,0.8);" />
```

The `#555041` border frame and shadow are the house image treatment — never omit them. `zoom` defaults to 30% and is tuned 25–31% per image so the rendered width fills the text column.

**Caption line** — sits on its own line below the image, blank line between:

```
​		**Fig 5.2  -**  Artist's Impression of the Design Proposal
```

The caption line begins with an invisible zero-width space (U+200B) followed by tab characters — this indents the caption without triggering a Markdown code block in the render pipeline. Copy a caption line from the skeleton and edit its text rather than typing from scratch.

**Numbering and cross-reference.** Figures number `Fig <section>.<sequence>` (Fig 3.1, Fig 3.2, Fig 5.1…). Every figure must be referenced from the prose that relies on it ("As shown in Figure 3.2 the site is safely situated outside of both Flood Zone 2 and Flood Zone 3"). Every caption must accurately describe its own image — verify pairing in the verification pass. Existing/proposed image pairs run existing first, proposed second.

## 6. Bespoke justification sections

Any genuinely contentious element of the scheme — the thing a neighbour will object to or an officer will query — earns a dedicated numbered section between `Protection To Neighbours Privacy` and `Landscaping`. The exemplar's `7.0 | Roof Replacement Justification` is the model: state the visual/contextual evidence, establish the precedent, explain the technical necessity, then present the applicant's restraint as the clinching move. Support with annotated photographic figures.

## 7. Tables

**Materials comparison table** (section 5). The `<span>` blocks in the header row control column widths — keep them:

```markdown
| <span style="display:inline-block; width:30mm; white-space:nowrap;">Building Element</span> | <span style="display:inline-block; width:60mm; white-space:nowrap;">Existing Materials</span> | Proposed Materials                                           |
| :----------------------------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- |
| **External Brickwork**                                       | Standard red facing brickwork                                | Facing brickwork to strictly match existing in colour, size, tone, texture, and mortar colour. |
```

Row order follows the building top-down logic: brickwork, roofs, windows (front/rear), doors, roof glazing, fascias and soffits, rainwater goods. First column bold. "Proposed" cells commit to matching existing wherever true ("to strictly match existing…") and state honest unknowns with a responsible owner ("Specification unknown at this stage. Likely EPDM or GRP system at the discretion of the building contractor.").

**Planning policy compliance table** (penultimate section). Same visual grammar:

```markdown
| <span style="display:inline-block; width:35mm; white-space:nowrap;">Policy Reference</span> | <span style="display:inline-block; width:55mm; white-space:nowrap;">Policy Provision</span> | How The Proposal Complies                                    |
| :----------------------------------------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- |
| **{{Policy 1 — Local Plan Part 2 (2020)}}**                  | {{One-sentence faithful summary of the provision}}           | {{Two or three sentences tying scheme evidence to the provision}} |
```

Open the section with a short comma-light paragraph establishing the development plan for the area and the section 38(6) duty, then the table (NPPF rows after local plan rows), then a closing paragraph asserting full compliance. Table cells use conventional punctuation. Every row must be verified per `policy-research.md` — an unverifiable row is deleted, not guessed.

## 8. Supplementary Drawing Notes

After the conclusion and end-of-statement marker. This section is the bridge between statement and drawing pack: the user copies each note verbatim onto drawings, and it doubles as a consolidated reference for the case officer. Every note must therefore stand alone when read out of context on a drawing.

**Opening**: `## Supplementary Drawing Notes` followed by the standing intro paragraph (see skeleton).

**Elevation groups** in order: North, South, East, West (`### North Elevation` …), each opening with a one-line orientation sentence: "The Northern Elevation of the property faces the street (Ashness Close) and serves as the building's principal elevation." Then Floor Plan Specific Notes (`### Floor Plan Specific Notes`).

**Note codes** — tens digit encodes the group:

| Range | Group |
| :--- | :--- |
| NB01–NB09 | North elevation |
| NB10–NB19 | South elevation |
| NB21–NB29 | East elevation |
| NB31–NB39 | West elevation |
| NB41–NB49 | Floor plan notes |
| ST01+ | Structural flags/disclaimers (within Floor Plan group) |

Adapt group meaning to each site's actual orientation (the group is the elevation, the compass name follows the real building). Number within a group in drawing order. Never renumber existing notes — codes are referenced on drawings.

**Note anatomy**: `##### NB01 |  Title Case Heading` then one or two paragraphs of conventionally punctuated prose. Each note carries: the design intent, the contextual justification (echoing the main statement's argument), and any regulatory handoff ("must be designed and specified in full compliance with current Building Regulations" / "must be independently confirmed and detailed by a qualified structural engineer"). ST notes flag structural provisionals and explicitly scope liability.

**Summary blocks**: three `#####` blocks after the note groups — `Project Overview And Site Context`, `Architectural Design Strategy & Materials`, `Protecting Neighbouring Privacy And Amenity`. Each is a single dense paragraph (150–200 words) condensing the statement for drawing cover sheets, written in the **comma-light main-statement style** (they are statement prose, unlike the notes around them).

**Standing general notes** — boilerplate that closes every document, verbatim from the skeleton with only names/addresses varying: `General Note | Planning Purpose Only`, `Contractor Responsibilities And Verification`, `Limitation Of Liability And Indemnity`, `Copyright And Intellectual Property`.

## 9. End matter markup

End-of-statement marker (after the conclusion's divider):

```html
<div>  
    <h6 style="margin-top:02.00mm;font-size:08.00pt;font-color:#ebebeb;">Note To Reader : End Of Main Statement</h6>
</div>  
```

Footer (final line of the file): same `h6` pattern with `&copy; {{year}} Noble Architecture`.

## 10. File and folder conventions

- Statement master: `{{ProjectCode}}__Design&AccessStatement__.md` (e.g. `NP03_T02_S01__Design&AccessStatement__.md`) — note the trailing double underscore. Exported PDFs append the revision: `…__RevB__.pdf`. Match the project code from existing files in the job folder; if the folder is empty ask the user.
- Images: every job folder has (or must be given) an `01__DaStatement__Images/` folder with three tiers — `01__RawImages/`, `02__Resized/`, `03__FinalImages/`. This structure is never optional: if the tiers don't exist yet, create them; if images are found sitting loose in the folder rather than sorted into a tier, sort and rename them into convention before doing anything else with them. Only `03__FinalImages` files are ever embedded — never link to `01__RawImages` or `02__Resized`, and never link to a file outside `01__DaStatement__Images/` altogether. Image names `NN__Subject__Descriptor__.png`, numbered in tens-groups by subject family (01–09 maps and site analysis · 21–29 front CGI pairs · 31–39 rear CGI pairs · 41–49 supplementary technical/survey imagery, e.g. LiDAR or point cloud captures), existing/proposed pairs adjacent. Embed and caption every image exactly per §5 above — the markup, the border and shadow treatment, and the zero-width-space caption line are never optional either.
- Policy library: `00__PlanningPolicy__Reference/` per `policy-research.md`.
- If an image the argument needs does not exist yet, keep the embed with a `[TO CONFIRM: image required — {{description}}]` caption note and tell the user what to capture (drone view, CGI pair, constraint map screenshot).
